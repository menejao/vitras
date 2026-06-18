import express from "express";
import crypto from "node:crypto";
import { COOKIE_REFRESH_NAME, BREAK_GLASS_TTL_MS } from "../config.js";
import { readDb, withDb } from "../db.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  validate,
  MePatchSchema,
  ImpersonationStartSchema,
  BreakGlassSchema
} from "../schemas.js";
import { ensureDbShape, sanitizeUser, buildAccessContextUser, getTeamNameById } from "../utils/domain.js";
import {
  canonicalRole,
  roleNeedsCouncil,
  councilTypeForRole,
  isValidEmail,
  isStrongPassword,
  getClientIp,
  hasCapability
} from "../utils/helpers.js";
import { validateCouncilData, verifyCouncilExternally } from "../utils/council.js";
import { hashPassword, hashToken, verifyPassword } from "../services/crypto.js";
import { generateTotpSecret, verifyTotpCode, buildOtpAuthUrl, normalizeTotpSecret } from "../services/totp.js";
import { createToken, createRefreshToken } from "../services/tokens.js";
import { addAuditLog } from "../services/audit.js";
import { createCsrfToken, issueSessionCookies, parseCookies } from "../utils/session-cookies.js";

const router = express.Router();

function hashCnsProfissional(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // F4-03: SHA-256 of raw cnsProfissional — never log plaintext
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildMeAuditSnapshot(user) {
  if (!user) return null;
  return {
    id: String(user.id || ""),
    teamId: String(user.teamId || ""),
    name: String(user.name || ""),
    email: String(user.email || ""),
    role: canonicalRole(user.role),
    councilType: String(user.councilType || ""),
    councilNumber: String(user.councilNumber || ""),
    councilUf: String(user.councilUf || ""),
    // F4-01/F4-03: cnsProfissional stored as SHA-256 hash — never plaintext in audit
    cnsProfissionalHash: hashCnsProfissional(user.cnsProfissional),
    // F4-02: CBO fields in audit snapshot
    cboCodigo: String(user.cboCodigo || ""),
    cboDescricao: String(user.cboDescricao || ""),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    updatedAt: String(user.updatedAt || user.createdAt || "")
  };
}

function getRequestAccessContext(req, db) {
  return {
    scopeTeamId: String(req.user?.teamId || "").trim(),
    impersonation: req.user?.impersonation?.active ? {
      targetUserId: String(req.user.impersonation.targetUserId || ""),
      targetUserName: String(req.user.impersonation.targetUserName || ""),
      targetUserRole: String(req.user.impersonation.targetUserRole || ""),
      targetTeamId: String(req.user.impersonation.targetTeamId || ""),
      targetTeamName: String(req.user.impersonation.targetTeamName || getTeamNameById(db, req.user.impersonation.targetTeamId) || ""),
      reason: String(req.user.impersonation.reason || ""),
      startedAt: String(req.user.impersonation.startedAt || "")
    } : null,
    breakGlass: req.user?.breakGlass?.active ? {
      active: true,
      reason: String(req.user.breakGlass.reason || ""),
      activatedAt: String(req.user.breakGlass.activatedAt || ""),
      expiresAt: String(req.user.breakGlass.expiresAt || "")
    } : null
  };
}

function buildSessionResponse(res, actorUser, db, sessionContext = {}, ip = "") {
  const refresh = createRefreshToken(actorUser.id, ip, db, sessionContext);
  const token = createToken(actorUser, db, {
    ...sessionContext,
    sessionId: refresh.sessionId
  });
  const user = buildAccessContextUser(actorUser, db, sessionContext);
  const csrfToken = createCsrfToken();
  issueSessionCookies(res, {
    accessToken: token,
    refreshToken: refresh.raw,
    csrfToken
  });
  return { user, token, refreshToken: refresh.raw, sessionId: refresh.sessionId, csrfToken };
}

function revokeCurrentRefreshToken(db, req) {
  const rawToken = String(parseCookies(req)[COOKIE_REFRESH_NAME] || "").trim();
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  const index = db.refreshTokens.findIndex((item) => item.tokenHash === tokenHash && !item.revokedAt);
  if (index >= 0) {
    db.refreshTokens[index].revokedAt = new Date().toISOString();
  }
}

function revokeAllUserRefreshTokens(db, userId, exceptSessionId = "") {
  let revokedCount = 0;
  for (const token of db.refreshTokens) {
    if (String(token.userId || "") !== String(userId || "")) continue;
    if (exceptSessionId && String(token.id || "") === String(exceptSessionId)) continue;
    if (!token.revokedAt) {
      token.revokedAt = new Date().toISOString();
      revokedCount += 1;
    }
  }
  return revokedCount;
}

router.use(async (req, _res, next) => {
  if (!req.user || req.method !== "GET") return next();
  if (!["/me", "/me/access-context", "/me/2fa/status"].includes(req.path)) return next();

  await withDb((db) => {
    ensureDbShape(db);
    const user = db.users.find((u) => u.id === req.user.id);
    if (!user) return;

    if (req.path === "/me") {
      addAuditLog(db, req.user, "me.read", "user", user.id, {
        teamId: user.teamId || "",
        outcome: "success",
        after: buildMeAuditSnapshot(user)
      });
      return;
    }

    if (req.path === "/me/access-context") {
      const responseUser = buildAccessContextUser(user, db, getRequestAccessContext(req, db));
      addAuditLog(db, req.user, "me.access_context_read", "auth", user.id, {
        teamId: user.teamId || "",
        outcome: "success",
        after: {
          scopeTeamId: String(responseUser.teamId || ""),
          impersonationActive: Boolean(responseUser.impersonation?.active),
          breakGlassActive: Boolean(responseUser.breakGlass?.active)
        }
      });
      return;
    }

    addAuditLog(db, req.user, "auth.2fa_status_read", "user", user.id, {
      teamId: user.teamId || "",
      outcome: "success",
      after: {
        enabled: Boolean(user.twoFactorEnabled && user.twoFactorSecret),
        pendingSetup: Boolean(user.twoFactorPendingSecret)
      }
    });
  });

  return next();
});

router.get("/me", requireAuth, async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  return res.json(buildAccessContextUser(user, db, getRequestAccessContext(req, db)));
});

router.get("/me/access-context", requireAuth, async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  return res.json({
    user: buildAccessContextUser(user, db, getRequestAccessContext(req, db))
  });
});

router.get("/me/2fa/status", requireAuth, async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  return res.json({
    enabled: Boolean(user.twoFactorEnabled && user.twoFactorSecret),
    pendingSetup: Boolean(user.twoFactorPendingSecret)
  });
});

router.post("/me/2fa/setup", requireAuth, async (req, res) => {
  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.users.findIndex((u) => u.id === req.user.id);
    if (index < 0) return { error: { status: 404, message: "Usuário não encontrado" } };
    const user = db.users[index];
    const secret = generateTotpSecret();
    db.users[index].twoFactorPendingSecret = secret;
    db.users[index].twoFactorPendingCreatedAt = new Date().toISOString();
    db.users[index].updatedAt = new Date().toISOString();
    addAuditLog(db, user, "auth.2fa_setup_started", "user", user.id, {});
    return {
      secret,
      otpauthUrl: buildOtpAuthUrl(user, secret)
    };
  });
  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
});

router.post("/me/2fa/enable", requireAuth, async (req, res) => {
  const code = String(req.body?.code || "").replace(/\D+/g, "");
  if (code.length !== 6) return res.status(400).json({ error: "Código 2FA inválido" });

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.users.findIndex((u) => u.id === req.user.id);
    if (index < 0) return { error: { status: 404, message: "Usuário não encontrado" } };
    const user = db.users[index];
    const pendingSecret = normalizeTotpSecret(user.twoFactorPendingSecret || "");
    if (!pendingSecret) {
      return { error: { status: 400, message: "Inicie a configuração 2FA antes de confirmar" } };
    }
    if (!verifyTotpCode(pendingSecret, code)) {
      return { error: { status: 401, message: "Código 2FA inválido para ativação" } };
    }
    db.users[index].twoFactorSecret = pendingSecret;
    db.users[index].twoFactorEnabled = true;
    db.users[index].twoFactorPendingSecret = "";
    db.users[index].twoFactorPendingCreatedAt = "";
    db.users[index].updatedAt = new Date().toISOString();
    addAuditLog(db, user, "auth.2fa_enabled", "user", user.id, {});
    return { user: db.users[index], db };
  });
  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  const token = createToken(result.user, result.db, getRequestAccessContext(req, result.db));
  return res.json({ user: buildAccessContextUser(result.user, result.db, getRequestAccessContext(req, result.db)), token });
});

router.post("/me/2fa/disable", requireAuth, async (req, res) => {
  const code = String(req.body?.code || "").replace(/\D+/g, "");
  if (code.length !== 6) return res.status(400).json({ error: "Código 2FA inválido" });

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.users.findIndex((u) => u.id === req.user.id);
    if (index < 0) return { error: { status: 404, message: "Usuário não encontrado" } };
    const user = db.users[index];
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return { error: { status: 400, message: "2FA já está desativado" } };
    }
    if (!verifyTotpCode(user.twoFactorSecret, code)) {
      return { error: { status: 401, message: "Código 2FA inválido" } };
    }

    db.users[index].twoFactorEnabled = false;
    db.users[index].twoFactorSecret = "";
    db.users[index].twoFactorPendingSecret = "";
    db.users[index].twoFactorPendingCreatedAt = "";
    db.users[index].updatedAt = new Date().toISOString();
    addAuditLog(db, user, "auth.2fa_disabled", "user", user.id, {});
    return { user: db.users[index], db };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  const token = createToken(result.user, result.db, getRequestAccessContext(req, result.db));
  return res.json({ user: buildAccessContextUser(result.user, result.db, getRequestAccessContext(req, result.db)), token });
});

router.post("/me/presence", requireAuth, async (req, res) => {
  const nowIso = new Date().toISOString();
  await withDb((db) => {
    ensureDbShape(db);
    const idx = db.users.findIndex((u) => u.id === req.user.id);
    if (idx >= 0) {
      db.users[idx].lastSeenAt = nowIso;
      db.users[idx].lastSeenIp = getClientIp(req);
      db.users[idx].updatedAt = nowIso;
    }
  });
  return res.json({ ok: true, lastSeenAt: nowIso });
});

router.patch("/me", requireAuth, validate(MePatchSchema), async (req, res) => {
  const payload = req.body || {};

  const result = await withDb(async (db) => {
    ensureDbShape(db);
    const index = db.users.findIndex((u) => u.id === req.user.id);
    if (index < 0) return { error: { status: 404, message: "Usuário não encontrado" } };

    const current = db.users[index];
    const next = { ...current };
    const changingEmail = payload.email !== undefined && String(payload.email || "").trim().toLowerCase() !== String(current.email || "").trim().toLowerCase();
    const changingPassword = payload.password !== undefined;
    if ((changingEmail || changingPassword) && !verifyPassword(String(payload.currentPassword || ""), current.password)) {
      return { error: { status: 401, message: "Senha atual inválida para alterar e-mail ou senha" } };
    }

    if (payload.name !== undefined) {
      const name = String(payload.name || "").trim();
      if (!name) return { error: { status: 400, message: "Nome não pode ficar vazio" } };
      next.name = name;
    }

    if (payload.email !== undefined) {
      const email = String(payload.email || "").trim().toLowerCase();
      if (!email) return { error: { status: 400, message: "Email não pode ficar vazio" } };
      if (!isValidEmail(email)) return { error: { status: 400, message: "E-mail inválido" } };
      const exists = db.users.some((u) => u.id !== current.id && String(u.email).toLowerCase() === email);
      if (exists) return { error: { status: 409, message: "E-mail já em uso por outro usuário" } };
      next.email = email;
    }

    if (payload.password !== undefined) {
      const password = String(payload.password || "");
      if (!isStrongPassword(password)) {
        return { error: { status: 400, message: "Senha fraca: mínimo de 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial" } };
      }
      next.password = hashPassword(password);
    }

    const role = canonicalRole(current.role);
    if (roleNeedsCouncil(role) && (payload.councilNumber !== undefined || payload.councilUf !== undefined)) {
      const candidateNumber = payload.councilNumber !== undefined ? payload.councilNumber : current.councilNumber;
      const candidateUf = payload.councilUf !== undefined ? payload.councilUf : current.councilUf;

      const localCheck = validateCouncilData(role, candidateNumber, candidateUf);
      if (!localCheck.ok) return { error: { status: 400, message: localCheck.message } };

      const councilType = councilTypeForRole(role);
      const duplicated = db.users.some((u) => {
        if (u.id === current.id) return false;
        return String(u.councilType || "").toUpperCase() === councilType
          && String(u.councilNumber || "") === localCheck.councilNumber
          && String(u.councilUf || "").toUpperCase() === localCheck.councilUf;
      });

      if (duplicated) {
        return { error: { status: 409, message: `${councilType} já cadastrado para outro usuário` } };
      }

      const unchangedCouncil = String(current.councilType || "").toUpperCase() === String(councilType || "").toUpperCase()
        && String(current.councilNumber || "") === String(localCheck.councilNumber || "")
        && String(current.councilUf || "").toUpperCase() === String(localCheck.councilUf || "").toUpperCase();

      if (!unchangedCouncil) {
        const external = await verifyCouncilExternally({
          role,
          councilType,
          councilNumber: localCheck.councilNumber,
          councilUf: localCheck.councilUf,
          name: next.name,
          email: next.email
        });

        if (!external.valid) {
          return { error: { status: 400, message: external.error || "Conselho não validado no provedor externo" } };
        }

        next.councilVerification = {
          checked: external.checked,
          provider: external.provider,
          status: external.status,
          verifiedAt: new Date().toISOString()
        };
      }

      next.councilType = councilType;
      next.councilNumber = localCheck.councilNumber;
      next.councilUf = localCheck.councilUf;
    }

    // F4-01: cnsProfissional — stored as plaintext (public professional identifier, D-PRE-06 resolved)
    if (payload.cnsProfissional !== undefined) {
      next.cnsProfissional = String(payload.cnsProfissional || "").trim();
    }
    // F4-02: CBO fields
    if (payload.cboCodigo !== undefined) {
      next.cboCodigo = String(payload.cboCodigo || "").trim();
    }
    if (payload.cboDescricao !== undefined) {
      next.cboDescricao = String(payload.cboDescricao || "").trim();
    }

    next.updatedAt = new Date().toISOString();
    db.users[index] = next;
    const revokedSessions = (changingEmail || changingPassword)
      ? revokeAllUserRefreshTokens(db, next.id, req.user?.sessionId || "")
      : 0;

    addAuditLog(db, next, "user.profile_updated", "user", next.id, {
      changedFields: Object.keys(payload || {}),
      revokedSessions,
      before: buildMeAuditSnapshot(current),
      after: buildMeAuditSnapshot(next)
    });
    if (changingEmail || changingPassword) {
      addAuditLog(db, next, "auth.sessions_revoked_after_profile_change", "auth", next.id, {
        outcome: "success",
        changedEmail: changingEmail,
        changedPassword: changingPassword,
        revokedSessions
      });
    }

    const token = createToken(next, db, getRequestAccessContext(req, db));
    return { user: buildAccessContextUser(next, db, getRequestAccessContext(req, db)), token };
  });

  if (result.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
});

router.post("/me/verify-password", requireAuth, async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "Senha obrigatória." });
  const result = await withDb(async (db) => {
    ensureDbShape(db);
    const user = db.users.find((u) => u.id === req.user.id);
    if (!user) return { error: { status: 404, message: "Usuário não encontrado" } };
    if (!verifyPassword(String(password), user.password)) {
      return { error: { status: 401, message: "Senha incorreta." } };
    }
    return { ok: true };
  });
  if (result.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
});

router.post("/me/impersonation/start", requireAuth, validate(ImpersonationStartSchema), async (req, res) => {
  if (!hasCapability(req.user, "session.impersonate")) {
    return res.status(403).json({ error: "Sessão atual não pode assumir contexto de outro usuário" });
  }

  const payload = req.body || {};
  const result = await withDb((db) => {
    ensureDbShape(db);
    const actor = db.users.find((u) => u.id === req.user.id);
    if (!actor) return { error: { status: 404, message: "Usuário autenticado não encontrado" } };
    const target = db.users.find((u) => u.id === String(payload.targetUserId || ""));
    if (!target) return { error: { status: 404, message: "Usuário de destino não encontrado" } };
    if (target.id === actor.id) return { error: { status: 400, message: "Use sua própria sessão sem impersonation" } };

    const IMPERSONATION_BLOCKED_ROLES = ["break_glass_admin", "gestor", "nurse_manager", "security_auditor"];
    if (IMPERSONATION_BLOCKED_ROLES.includes(canonicalRole(target.role))) {
      addAuditLog(db, actor, "auth.impersonation_blocked", "auth", actor.id, {
        actorUserId: actor.id,
        targetUserId: target.id,
        targetRole: canonicalRole(target.role),
        reason: String(payload.reason || ""),
        blockedAt: new Date().toISOString()
      });
      return { error: { status: 403, message: "Não é permitido impersonar usuários com perfil privilegiado" } };
    }

    revokeCurrentRefreshToken(db, req);
    const sessionContext = {
      scopeTeamId: String(target.teamId || actor.teamId || ""),
      impersonation: {
        targetUserId: target.id,
        targetUserName: target.name,
        targetUserRole: target.role,
        targetTeamId: target.teamId || "",
        targetTeamName: getTeamNameById(db, target.teamId),
        reason: String(payload.reason || ""),
        startedAt: new Date().toISOString()
      },
      breakGlass: null
    };
    const session = buildSessionResponse(res, actor, db, sessionContext, getClientIp(req));
    addAuditLog(db, actor, "auth.impersonation_started", "auth", session.sessionId, {
      actorUserId: actor.id,
      targetUserId: target.id,
      targetRole: canonicalRole(target.role),
      targetTeamId: target.teamId || "",
      reason: String(payload.reason || "")
    });
    return session;
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
});

router.post("/me/impersonation/stop", requireAuth, async (req, res) => {
  if (!req.user?.impersonation?.active) {
    return res.status(400).json({ error: "Sessão atual não está em modo de impersonation" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const actor = db.users.find((u) => u.id === req.user.id);
    if (!actor) return { error: { status: 404, message: "Usuário autenticado não encontrado" } };

    revokeCurrentRefreshToken(db, req);
    const sessionContext = {
      scopeTeamId: actor.teamId || "",
      impersonation: null,
      breakGlass: req.user?.breakGlass?.active
        ? {
          active: true,
          reason: String(req.user.breakGlass.reason || ""),
          activatedAt: String(req.user.breakGlass.activatedAt || new Date().toISOString()),
          expiresAt: String(req.user.breakGlass.expiresAt || "")
        }
        : null
    };
    const session = buildSessionResponse(res, actor, db, sessionContext, getClientIp(req));
    addAuditLog(db, actor, "auth.impersonation_stopped", "auth", session.sessionId, {
      actorUserId: actor.id,
      targetUserId: String(req.user.impersonation.targetUserId || ""),
      targetRole: String(req.user.impersonation.targetUserRole || ""),
      targetTeamId: String(req.user.impersonation.targetTeamId || "")
    });
    return session;
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
});

router.post("/me/break-glass/activate", requireAuth, validate(BreakGlassSchema), async (req, res) => {
  if (!hasCapability(req.user, "session.break_glass.activate")) {
    return res.status(403).json({ error: "Sessão atual não pode ativar break-glass" });
  }
  if (req.user?.breakGlass?.active) {
    return res.status(400).json({ error: "Break-glass já está ativo nesta sessão" });
  }

  const payload = req.body || {};
  const result = await withDb((db) => {
    ensureDbShape(db);
    const actor = db.users.find((u) => u.id === req.user.id);
    if (!actor) return { error: { status: 404, message: "Usuário autenticado não encontrado" } };

    revokeCurrentRefreshToken(db, req);
    const sessionContext = {
      scopeTeamId: String(req.user?.teamId || actor.teamId || ""),
      impersonation: req.user?.impersonation?.active ? {
        targetUserId: String(req.user.impersonation.targetUserId || ""),
        targetUserName: String(req.user.impersonation.targetUserName || ""),
        targetUserRole: String(req.user.impersonation.targetUserRole || ""),
        targetTeamId: String(req.user.impersonation.targetTeamId || ""),
        targetTeamName: String(req.user.impersonation.targetTeamName || ""),
        reason: String(req.user.impersonation.reason || ""),
        startedAt: String(req.user.impersonation.startedAt || "")
      } : null,
      breakGlass: {
        active: true,
        reason: String(payload.reason || ""),
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + BREAK_GLASS_TTL_MS).toISOString()
      }
    };
    const session = buildSessionResponse(res, actor, db, sessionContext, getClientIp(req));
    addAuditLog(db, actor, "auth.break_glass_activated", "auth", session.sessionId, {
      actorUserId: actor.id,
      reason: String(payload.reason || ""),
      impersonationTargetUserId: String(req.user?.impersonation?.targetUserId || "")
    });
    return session;
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
});

router.post("/me/break-glass/deactivate", requireAuth, async (req, res) => {
  if (!req.user?.breakGlass?.active) {
    return res.status(400).json({ error: "Break-glass não está ativo nesta sessão" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const actor = db.users.find((u) => u.id === req.user.id);
    if (!actor) return { error: { status: 404, message: "Usuário autenticado não encontrado" } };

    revokeCurrentRefreshToken(db, req);
    const sessionContext = {
      scopeTeamId: String(req.user?.teamId || actor.teamId || ""),
      impersonation: req.user?.impersonation?.active ? {
        targetUserId: String(req.user.impersonation.targetUserId || ""),
        targetUserName: String(req.user.impersonation.targetUserName || ""),
        targetUserRole: String(req.user.impersonation.targetUserRole || ""),
        targetTeamId: String(req.user.impersonation.targetTeamId || ""),
        targetTeamName: String(req.user.impersonation.targetTeamName || ""),
        reason: String(req.user.impersonation.reason || ""),
        startedAt: String(req.user.impersonation.startedAt || "")
      } : null,
      breakGlass: null
    };
    const session = buildSessionResponse(res, actor, db, sessionContext, getClientIp(req));
    addAuditLog(db, actor, "auth.break_glass_deactivated", "auth", session.sessionId, {
      actorUserId: actor.id,
      impersonationTargetUserId: String(req.user?.impersonation?.targetUserId || "")
    });
    return session;
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
});

export default router;
