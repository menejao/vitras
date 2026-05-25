import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb, findUserByEmail, findUserById, findRefreshTokenByHash } from "../db.js";
import {
  TWOFA_CHALLENGE_TTL_MS,
  TWOFA_MAX_ATTEMPTS,
  PUBLIC_SELF_REGISTER_ROLES,
  COOKIE_REFRESH_NAME
} from "../config.js";
import { validate, LoginSchema, RegisterSchema, AccessRequestCreateSchema } from "../schemas.js";
import { authRateLimit } from "../middlewares/rate-limits.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  canonicalRole,
  isStrongPassword,
  isValidEmail,
  roleNeedsCouncil,
  councilTypeForRole,
  getClientIp,
  hasCapability
} from "../utils/helpers.js";
import { ensureDbShape, buildAccessContextUser } from "../utils/domain.js";
import { validateCouncilData, verifyCouncilExternally } from "../utils/council.js";
import { hashPassword, isHashedPassword, verifyPassword, hashToken } from "../services/crypto.js";
import { verifyTotpCode } from "../services/totp.js";
import { createToken, createRefreshToken } from "../services/tokens.js";
import { addAuditLog } from "../services/audit.js";
import { ensureDemoManagerIfNeeded } from "../services/startup.js";
import { trackLoginAttempt } from "../middlewares/logging.js";
import {
  clearSessionCookies,
  createCsrfToken,
  issueSessionCookies,
  parseCookies
} from "../utils/session-cookies.js";

const router = express.Router();

function maskEmail(email) {
  const raw = String(email || "").trim();
  if (!raw || !raw.includes("@")) return "[email inválido]";
  const [local, domain] = raw.split("@");
  const maskedLocal = local.length > 0 ? `${local[0]}***` : "***";
  const dotIndex = domain.lastIndexOf(".");
  const maskedDomain = dotIndex > 0
    ? `${domain[0]}***${domain.slice(dotIndex)}`
    : `${domain[0]}***`;
  return `${maskedLocal}@${maskedDomain}`;
}

function buildAuditActorFromRequest(req, identity = {}) {
  return {
    id: String(identity.id || ""),
    name: String(identity.name || identity.email || "anonymous"),
    role: canonicalRole(identity.role || ""),
    teamId: String(identity.teamId || ""),
    teamName: String(identity.teamName || ""),
    requestId: req.requestId || "",
    authTransport: "anonymous",
    requestMeta: {
      requestId: req.requestId || "",
      ip: getClientIp(req),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 512),
      method: String(req.method || ""),
      path: String(req.originalUrl || ""),
      authTransport: "anonymous"
    }
  };
}

function issueSession(res, user, db, sessionContext = {}, refreshRaw = "", sessionId = "") {
  const token = createToken(user, db, {
    ...sessionContext,
    sessionId
  });
  const csrfToken = createCsrfToken();
  issueSessionCookies(res, {
    accessToken: token,
    refreshToken: refreshRaw,
    csrfToken
  });
  return {
    user: buildAccessContextUser(user, db, sessionContext),
    token,
    refreshToken: refreshRaw,
    csrfToken
  };
}

function requireAccessRequestsRead(req, res, next) {
  if (!hasCapability(req.user, "access_requests.read")) {
    return res.status(403).json({ error: "Sem permissão para administrar solicitações de acesso" });
  }
  return next();
}

router.post("/auth/access-requests", authRateLimit, validate(AccessRequestCreateSchema), async (req, res) => {
  const payload = req.body || {};
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const jobTitle = canonicalRole(payload.jobTitle || "");

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "E-mail inválido" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    if (db.users.some((user) => String(user.email || "").toLowerCase() === email)) {
      return { error: "Já existe usuário cadastrado com este e-mail", status: 409 };
    }
    const duplicatedPending = db.accessRequests.find((item) => String(item.email || "").toLowerCase() === email && item.status === "pending");
    if (duplicatedPending) {
      return { error: "Já existe solicitação pendente para este e-mail", status: 409 };
    }

    const requestItem = {
      id: uuidv4(),
      name,
      email,
      jobTitle,
      status: "pending",
      createdAt: new Date().toISOString(),
      createdByIp: getClientIp(req),
      decidedAt: "",
      decidedBy: "",
      rejectionReason: ""
    };
    db.accessRequests.push(requestItem);
    addAuditLog(
      db,
      buildAuditActorFromRequest(req, { email, name }),
      "access_request.created",
      "access_request",
      requestItem.id,
      {
        email,
        jobTitle,
        outcome: "success"
      }
    );
    return { requestItem };
  });

  if (result?.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }

  return res.status(201).json(result.requestItem);
});

router.post("/auth/register", authRateLimit, validate(RegisterSchema), async (req, res) => {
  const payload = req.body || {};
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const role = canonicalRole(payload.role);
  const councilType = councilTypeForRole(role);

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "name, email, password e role são obrigatórios" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "E-mail inválido" });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: "Senha fraca: mínimo de 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial"
    });
  }
  if (!PUBLIC_SELF_REGISTER_ROLES.includes(role)) {
    return res.status(400).json({ error: "Perfil não disponível para auto cadastro público" });
  }

  const councilValidation = validateCouncilData(role, payload.councilNumber, payload.councilUf);
  if (!councilValidation.ok) {
    return res.status(400).json({ error: councilValidation.message });
  }

  const externalCheck = roleNeedsCouncil(role)
    ? await verifyCouncilExternally({
      role,
      councilType,
      councilNumber: councilValidation.councilNumber || "",
      councilUf: councilValidation.councilUf || "",
      name,
      email
    })
    : {
      checked: false,
      valid: true,
      provider: "not-required",
      status: "skipped"
    };
  if (!externalCheck.valid) {
    return res.status(400).json({
      error: externalCheck.error || "Conselho não validado no provedor externo"
    });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    if (db.users.some((u) => String(u.email || "").toLowerCase() === email)) {
      return { error: "E-mail já cadastrado", status: 409 };
    }

    const duplicatedCouncil = roleNeedsCouncil(role) && db.users.some((u) => {
      const userRole = canonicalRole(u.role);
      return roleNeedsCouncil(userRole)
        && String(u.councilType || "").toUpperCase() === councilType
        && String(u.councilNumber || "") === councilValidation.councilNumber
        && String(u.councilUf || "").toUpperCase() === councilValidation.councilUf;
    });
    if (duplicatedCouncil) {
      return { error: `${councilType} já cadastrado para outro usuário`, status: 409 };
    }

    const requiresTeam = role !== "gestor";
    const requiresUnit = role === "gestor";
    const teamId = String(payload.teamId || "").trim();
    const unitId = String(payload.unitId || "").trim();
    const team = requiresTeam ? db.teams.find((t) => t.id === teamId) : null;
    const unit = requiresUnit ? (db.units || []).find((u) => u.id === unitId) : null;

    if (requiresTeam && !teamId) {
      return { error: "teamId é obrigatório para cadastro", status: 400 };
    }
    if (requiresTeam && !team) {
      return { error: "Equipe informada não existe", status: 400 };
    }
    if (requiresUnit && !unitId) {
      return { error: "unitId é obrigatório para gestor", status: 400 };
    }
    if (requiresUnit && !unit) {
      return { error: "Unidade informada não existe", status: 400 };
    }

    const derivedUnitId = requiresUnit ? unitId : (team?.unitId || "");

    const user = {
      id: uuidv4(),
      name,
      role,
      email,
      password: hashPassword(password),
      teamId: requiresTeam ? teamId : "",
      unitId: derivedUnitId,
      councilType,
      councilNumber: councilValidation.councilNumber || "",
      councilUf: councilValidation.councilUf || "",
      councilVerification: {
        checked: externalCheck.checked,
        provider: externalCheck.provider,
        status: externalCheck.status,
        verifiedAt: new Date().toISOString()
      },
      twoFactorEnabled: false,
      twoFactorSecret: "",
      twoFactorPendingSecret: "",
      twoFactorPendingCreatedAt: "",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      lastSeenIp: getClientIp(req)
    };
    db.users.push(user);
    if (role === "nurse_manager" && team && !team.managerUserId) {
      team.managerUserId = user.id;
      team.updatedAt = new Date().toISOString();
    }
    const refresh = createRefreshToken(user.id, getClientIp(req), db);
    addAuditLog(db, user, "auth.register", "auth", refresh.sessionId, { userId: user.id });
    return { user, db, refresh };
  });

  if (result?.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  return res.status(201).json(
    issueSession(res, result.user, result.db, {}, result.refresh.raw, result.refresh.sessionId)
  );
});

router.post("/auth/register/request-code", authRateLimit, async (_req, res) => {
  return res.status(410).json({ error: "Fluxo de código desativado. Use /auth/register." });
});

router.post("/auth/register/confirm", authRateLimit, async (_req, res) => {
  return res.status(410).json({ error: "Fluxo de código desativado. Use /auth/register." });
});

router.post("/auth/login", authRateLimit, validate(LoginSchema), async (req, res) => {
  const { email, password } = req.body || {};
  let db = await readDb();
  ensureDbShape(db);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const inputPassword = String(password || "");
  let user = await findUserByEmail(normalizedEmail);
  if (user && !verifyPassword(inputPassword, user.password)) {
    user = null;
  }
  if (!user) {
    user = db.users.find(
      (item) => String(item.email || "").toLowerCase() === normalizedEmail && verifyPassword(inputPassword, item.password)
    );
  }

  if (!user) {
    const recovered = await ensureDemoManagerIfNeeded(email, password);
    if (recovered?.user) {
      user = recovered.user;
      db = recovered.db;
    }
  }
  if (!user) {
    trackLoginAttempt(false);
    await withDb((auditDb) => {
      ensureDbShape(auditDb);
      addAuditLog(
        auditDb,
        buildAuditActorFromRequest(req, { email: maskEmail(normalizedEmail), name: maskEmail(normalizedEmail) }),
        "auth.login_failed",
        "auth",
        normalizedEmail || "anonymous",
        { outcome: "denied", emailMasked: maskEmail(normalizedEmail) }
      );
    });
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  if (!isHashedPassword(user.password)) {
    await withDb((mutableDb) => {
      ensureDbShape(mutableDb);
      const index = mutableDb.users.findIndex((item) => item.id === user.id);
      if (index >= 0) {
        mutableDb.users[index].password = hashPassword(inputPassword);
        mutableDb.users[index].updatedAt = new Date().toISOString();
      }
    });
    db = await readDb();
    ensureDbShape(db);
    user = db.users.find((item) => item.id === user.id) || user;
  }

  const nowIso = new Date().toISOString();

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const challenge = await withDb((mutableDb) => {
      ensureDbShape(mutableDb);
      const index = mutableDb.users.findIndex((item) => item.id === user.id);
      if (index < 0) return null;
      const expiresAt = new Date(Date.now() + TWOFA_CHALLENGE_TTL_MS).toISOString();
      const challengeItem = {
        id: uuidv4(),
        userId: user.id,
        createdAt: nowIso,
        expiresAt,
        attempts: 0,
        consumed: false
      };
      mutableDb.loginChallenges = (mutableDb.loginChallenges || [])
        .filter((item) => !item.consumed)
        .filter((item) => String(item.userId || "") !== String(user.id))
        .slice(-50);
      mutableDb.loginChallenges.push(challengeItem);
      mutableDb.users[index].lastSeenAt = nowIso;
      mutableDb.users[index].lastSeenIp = getClientIp(req);
      mutableDb.users[index].updatedAt = nowIso;
      addAuditLog(mutableDb, user, "auth.login_challenge_created", "auth", challengeItem.id, {
        userId: user.id
      });
      return challengeItem;
    });

    return res.json({
      twoFactorRequired: true,
      challengeId: challenge?.id || "",
      challengeExpiresAt: challenge?.expiresAt || ""
    });
  }

  const refresh = await withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    const index = mutableDb.users.findIndex((item) => item.id === user.id);
    if (index >= 0) {
      mutableDb.users[index].lastLoginAt = nowIso;
      mutableDb.users[index].lastSeenAt = nowIso;
      mutableDb.users[index].lastSeenIp = getClientIp(req);
      mutableDb.users[index].updatedAt = nowIso;
    }
    const tokenRecord = createRefreshToken(user.id, getClientIp(req), mutableDb);
    addAuditLog(mutableDb, user, "auth.login", "auth", tokenRecord.sessionId, { userId: user.id, sessionId: tokenRecord.sessionId, refreshTokenId: tokenRecord.id });
    return tokenRecord;
  });

  {
    const latestDb = await readDb();
    ensureDbShape(latestDb);
    user = latestDb.users.find((item) => item.id === user.id) || user;
    db = latestDb;
  }

  trackLoginAttempt(true);
  return res.json(issueSession(res, user, db, {}, refresh.raw, refresh.sessionId));
});

router.post("/auth/login/verify", authRateLimit, async (req, res) => {
  const challengeId = String(req.body?.challengeId || "").trim();
  const code = String(req.body?.code || "").replace(/\D+/g, "");
  if (!challengeId || code.length !== 6) {
    return res.status(400).json({ error: "challengeId e code (6 dígitos) são obrigatórios" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const challengeIndex = db.loginChallenges.findIndex((item) => String(item.id || "") === challengeId);
    if (challengeIndex < 0) return { error: { status: 404, message: "Desafio de login não encontrado" } };
    const challenge = db.loginChallenges[challengeIndex];
    if (challenge.consumed) return { error: { status: 400, message: "Desafio de login já utilizado" } };
    if (Date.parse(String(challenge.expiresAt || "")) < Date.now()) {
      challenge.consumed = true;
      return { error: { status: 401, message: "Desafio de login expirado" } };
    }

    const userIndex = db.users.findIndex((u) => u.id === challenge.userId);
    if (userIndex < 0) return { error: { status: 404, message: "Usuário do desafio não encontrado" } };
    const user = db.users[userIndex];
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return { error: { status: 400, message: "2FA não está habilitado para este usuário" } };
    }

    const ok = verifyTotpCode(user.twoFactorSecret, code);
    if (!ok) {
      challenge.attempts = Number(challenge.attempts || 0) + 1;
      if (challenge.attempts >= TWOFA_MAX_ATTEMPTS) {
        challenge.consumed = true;
      }
      return { error: { status: 401, message: "Código 2FA inválido" } };
    }

    challenge.consumed = true;
    const nowIso = new Date().toISOString();
    db.users[userIndex].lastLoginAt = nowIso;
    db.users[userIndex].lastSeenAt = nowIso;
    db.users[userIndex].lastSeenIp = getClientIp(req);
    db.users[userIndex].updatedAt = nowIso;
    const refresh = createRefreshToken(user.id, getClientIp(req), db);
    addAuditLog(db, user, "auth.login_2fa_verified", "auth", challengeId, {
      userId: user.id,
      sessionId: refresh.sessionId
    });
    return { user: db.users[userIndex], db, refresh };
  });

  if (result?.error) {
    trackLoginAttempt(false);
    return res.status(result.error.status).json({ error: result.error.message });
  }
  trackLoginAttempt(true);
  return res.json(issueSession(res, result.user, result.db, {}, result.refresh.raw, result.refresh.sessionId));
});

router.post("/auth/refresh", authRateLimit, async (req, res) => {
  const rawToken = String(req.body?.refreshToken || parseCookies(req)[COOKIE_REFRESH_NAME] || "").trim();
  if (!rawToken) return res.status(400).json({ error: "refreshToken é obrigatório" });
  const tokenHash = hashToken(rawToken);
  const preloadedRecord = await findRefreshTokenByHash(tokenHash);
  if (!preloadedRecord) return res.status(401).json({ error: "Refresh token inválido" });
  const preloadedUser = await findUserById(preloadedRecord.userId);
  if (!preloadedUser) return res.status(401).json({ error: "Usuário não encontrado" });

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.refreshTokens.findIndex((item) => item.tokenHash === tokenHash);
    if (index < 0) return { error: { status: 401, message: "Refresh token inválido" } };

    const record = db.refreshTokens[index];
    if (record.revokedAt) return { error: { status: 401, message: "Sessão encerrada" } };
    if (new Date(record.expiresAt) < new Date()) {
      db.refreshTokens[index].revokedAt = new Date().toISOString();
      return { error: { status: 401, message: "Sessão expirada" } };
    }

    const user = db.users.find((item) => item.id === record.userId);
    if (!user) return { error: { status: 401, message: "Usuário não encontrado" } };

    db.refreshTokens[index].revokedAt = new Date().toISOString();
    const refresh = createRefreshToken(user.id, record.ip, db, record.sessionContext || {});
    addAuditLog(db, user, "auth.refresh", "auth", refresh.sessionId, {
      prevSession: record.id,
      sessionId: refresh.sessionId,
      refreshTokenId: refresh.id,
      impersonationTargetUserId: String(record.sessionContext?.impersonation?.targetUserId || ""),
      breakGlass: Boolean(record.sessionContext?.breakGlass?.active)
    });
    return { user, db, refresh, sessionContext: record.sessionContext || {} };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(
    issueSession(
      res,
      result.user,
      result.db,
      result.sessionContext || {},
      result.refresh.raw,
      result.refresh.sessionId
    )
  );
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  const rawToken = String(req.body?.refreshToken || parseCookies(req)[COOKIE_REFRESH_NAME] || "").trim();
  await withDb((db) => {
    ensureDbShape(db);
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const index = db.refreshTokens.findIndex(
        (item) => item.tokenHash === tokenHash && item.userId === req.user.id
      );
      if (index >= 0 && !db.refreshTokens[index].revokedAt) {
        db.refreshTokens[index].revokedAt = new Date().toISOString();
      }
    }
    addAuditLog(db, req.user, "auth.logout", "auth", req.user.id, {
      hadRefreshToken: Boolean(rawToken),
      sessionId: String(req.user?.sessionId || ""),
      impersonationTargetUserId: String(req.user?.impersonation?.targetUserId || ""),
      breakGlass: Boolean(req.user?.breakGlass?.active)
    });
  });
  clearSessionCookies(res);
  return res.json({ ok: true });
});

router.get("/auth/access-requests", requireAuth, requireAccessRequestsRead, async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const requests = [...db.accessRequests].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, req.user, "access_request.list_read", "access_request", req.user.id, {
      totalReturned: requests.length,
      outcome: "success"
    });
  });

  return res.json({ requests });
});

router.post("/auth/access-requests/:id/approve", requireAuth, requireAccessRequestsRead, async (req, res) => {
  const requestId = String(req.params.id || "").trim();
  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.accessRequests.findIndex((item) => item.id === requestId);
    if (index < 0) return { error: { status: 404, message: "Solicitação não encontrada" } };
    if (db.accessRequests[index].status !== "pending") {
      return { error: { status: 409, message: "Solicitação já foi decidida" } };
    }

    db.accessRequests[index] = {
      ...db.accessRequests[index],
      status: "approved",
      decidedAt: new Date().toISOString(),
      decidedBy: req.user.id,
      rejectionReason: ""
    };
    addAuditLog(db, req.user, "access_request.approved", "access_request", requestId, {
      email: db.accessRequests[index].email,
      jobTitle: db.accessRequests[index].jobTitle,
      outcome: "success"
    });
    return { requestItem: db.accessRequests[index] };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.requestItem);
});

router.post("/auth/access-requests/:id/reject", requireAuth, requireAccessRequestsRead, async (req, res) => {
  const requestId = String(req.params.id || "").trim();
  const rejectionReason = String(req.body?.reason || "").trim();
  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.accessRequests.findIndex((item) => item.id === requestId);
    if (index < 0) return { error: { status: 404, message: "Solicitação não encontrada" } };
    if (db.accessRequests[index].status !== "pending") {
      return { error: { status: 409, message: "Solicitação já foi decidida" } };
    }

    db.accessRequests[index] = {
      ...db.accessRequests[index],
      status: "rejected",
      decidedAt: new Date().toISOString(),
      decidedBy: req.user.id,
      rejectionReason
    };
    addAuditLog(db, req.user, "access_request.rejected", "access_request", requestId, {
      email: db.accessRequests[index].email,
      jobTitle: db.accessRequests[index].jobTitle,
      rejectionReason,
      outcome: "success"
    });
    return { requestItem: db.accessRequests[index] };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.requestItem);
});

export default router;

