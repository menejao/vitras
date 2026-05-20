import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb, listUsersSnapshot, findUserById, listRolePermissionsSnapshot } from "../db.js";
import { USER_ONLINE_THRESHOLD_MS } from "../config.js";
import { requireManager } from "../middlewares/auth.js";
import { ensureDbShape, sanitizeUser } from "../utils/domain.js";
import {
  canonicalRole, isStrongPassword, isValidEmail, roleNeedsCouncil,
  councilTypeForRole, getClientIp, isAnaAdminUser, hasCapability
} from "../utils/helpers.js";
import { validateCouncilData, verifyCouncilExternally } from "../utils/council.js";
import { hashPassword } from "../services/crypto.js";
import { addAuditLog } from "../services/audit.js";
import { getTeamUserUsage } from "../utils/metrics.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

function buildUserAuditSnapshot(user) {
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
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    updatedAt: String(user.updatedAt || user.createdAt || "")
  };
}

function buildReadAuditActor(req) {
  return {
    ...req.user,
    requestMeta: req.user?.requestMeta || {
      ip: getClientIp(req),
      userAgent: String(req.headers["user-agent"] || ""),
      method: String(req.method || ""),
      path: String(req.originalUrl || req.path || ""),
      authTransport: String(req.user?.authTransport || "")
    }
  };
}

router.use(async (req, _res, next) => {
  if (!req.user || req.method !== "GET") return next();
  if (!["/users/activity-log"].includes(req.path) && !/^\/users\/[^/]+\/usage$/.test(req.path)) return next();

  await withDb((db) => {
    ensureDbShape(db);

    if (req.path === "/users/activity-log") {
      const now = Date.now();
      const items = db.users
        .map((u) => {
          const lastSeenAt = String(u.lastSeenAt || u.lastLoginAt || "");
          const lastSeenTs = Date.parse(lastSeenAt);
          const online = Number.isFinite(lastSeenTs) ? (now - lastSeenTs <= USER_ONLINE_THRESHOLD_MS) : false;
          return { id: u.id, online };
        });

      addAuditLog(db, buildReadAuditActor(req), "user.activity_log_read", "user", "", {
        teamId: req.user?.teamId || "",
        returnedCount: items.length,
        onlineWindowSeconds: Math.floor(USER_ONLINE_THRESHOLD_MS / 1000),
        outcome: "success"
      });
      return;
    }

    const pathParts = String(req.path || "").split("/").filter(Boolean);
    const id = String(pathParts[1] || "").trim();
    const target = db.users.find((u) => u.id === id && u.teamId === req.user.teamId);
    if (!target) return;
    const usage = getTeamUserUsage(db, target.id, req.user.teamId);
    addAuditLog(db, buildReadAuditActor(req), "user.usage_read", "user", target.id, {
      teamId: target.teamId || req.user?.teamId || "",
      role: canonicalRole(target.role),
      outcome: "success",
      after: {
        userId: target.id,
        role: canonicalRole(target.role),
        linkedTotal: usage.linkedTotal,
        canDelete: usage.linkedTotal === 0
      }
    });
  });

  return next();
});

router.get("/teams/public", async (_req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const items = db.teams
    .map((t) => ({ id: t.id, name: t.name }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  res.json(items);
});

router.get("/users", requireAuth, async (req, res) => {
  const snapshotUsers = await listUsersSnapshot();
  const result = await withDb((db) => {
    ensureDbShape(db);
    const canReadAllUsers = hasCapability(req.user, "users.read.all");

    const sourceUsers = snapshotUsers.length ? snapshotUsers : db.users;
    const safeUsers = sourceUsers
      .filter((u) => canReadAllUsers || u.teamId === req.user.teamId)
      .map((u) => sanitizeUser(u, db));

    addAuditLog(db, buildReadAuditActor(req), "user.list_read", "user", "", {
      teamId: req.user?.teamId || "",
      scope: canReadAllUsers ? "all" : "team",
      returnedCount: safeUsers.length,
      outcome: "success"
    });

    return safeUsers.map(({ password, ...u }) => u);
  });

  return res.json(result);
});

router.get("/users/activity-log", requireAuth, async (req, res) => {
  if (!isAnaAdminUser(req.user)) {
    return res.status(403).json({ error: "Sessão atual não pode acessar este painel" });
  }
  const db = await readDb();
  ensureDbShape(db);
  const now = Date.now();
  const teamNameById = Object.fromEntries((db.teams || []).map((t) => [String(t.id || ""), String(t.name || "Sem equipe")]));
  const items = db.users
    .map((u) => {
      const lastSeenAt = String(u.lastSeenAt || u.lastLoginAt || "");
      const lastSeenTs = Date.parse(lastSeenAt);
      const online = Number.isFinite(lastSeenTs) ? (now - lastSeenTs <= USER_ONLINE_THRESHOLD_MS) : false;
      return {
        id: u.id,
        name: u.name,
        role: canonicalRole(u.role),
        email: u.email,
        teamId: u.teamId || "",
        teamName: teamNameById[String(u.teamId || "")] || "Sem equipe",
        lastLoginAt: u.lastLoginAt || "",
        lastSeenAt,
        online
      };
    })
    .sort((a, b) =>
      String(a.teamName || "").localeCompare(String(b.teamName || ""), "pt-BR")
      || Number(b.online) - Number(a.online)
      || String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")
    );

  return res.json({
    generatedAt: new Date().toISOString(),
    onlineWindowSeconds: Math.floor(USER_ONLINE_THRESHOLD_MS / 1000),
    items
  });
});

router.post("/users", requireAuth, requireManager, async (req, res) => {
  const payload = req.body || {};
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const role = canonicalRole(payload.role);

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "name, email, password e role são obrigatórios" });
  }

  if (!["acs", "doctor"].includes(role)) {
    return res.status(400).json({ error: "A enfermeira pode cadastrar apenas ACS ou Medico(a)" });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: "Senha fraca: mínimo de 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial" });
  }

  const councilType = councilTypeForRole(role);
  const councilValidation = validateCouncilData(role, payload.councilNumber, payload.councilUf);
  if (!councilValidation.ok) {
    return res.status(400).json({ error: councilValidation.message });
  }

  const externalCheck = await verifyCouncilExternally({
    role,
    councilType,
    councilNumber: councilValidation.councilNumber || "",
    councilUf: councilValidation.councilUf || "",
    name,
    email
  });

  if (!externalCheck.valid) {
    return res.status(400).json({
      error: externalCheck.error || "Conselho não validado no provedor externo"
    });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    if (db.users.some((u) => String(u.email).toLowerCase() === email)) {
      return { error: "E-mail já cadastrado" };
    }

    const duplicatedCouncil = roleNeedsCouncil(role) && db.users.some((u) => {
      const uRole = canonicalRole(u.role);
      return roleNeedsCouncil(uRole)
        && String(u.councilType || "").toUpperCase() === councilType
        && String(u.councilNumber || "") === councilValidation.councilNumber
        && String(u.councilUf || "").toUpperCase() === councilValidation.councilUf;
    });

    if (duplicatedCouncil) {
      return { error: `${councilType} já cadastrado para outro usuário` };
    }

    const user = {
      id: uuidv4(),
      name,
      role,
      email,
      password: hashPassword(password),
      teamId: req.user.teamId,
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
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    addAuditLog(db, req.user, "user.created_by_manager", "user", user.id, {
      role: user.role,
      teamId: user.teamId,
      after: buildUserAuditSnapshot(user)
    });
    return { user, db };
  });

  if (result.error) return res.status(409).json({ error: result.error });
  return res.status(201).json(sanitizeUser(result.user, result.db));
});

router.get("/users/:id/usage", requireAuth, requireManager, async (req, res) => {
  const id = String(req.params.id || "").trim();
  const db = await readDb();
  ensureDbShape(db);
  const target = (await findUserById(id)) || db.users.find((u) => u.id === id && u.teamId === req.user.teamId);
  if (!target) return res.status(404).json({ error: "Usuário não encontrado" });
  if (!["acs", "doctor"].includes(canonicalRole(target.role))) {
    return res.status(400).json({ error: "Somente ACS/Médico podem ser gerenciados nesta tela" });
  }
  const usage = getTeamUserUsage(db, target.id, req.user.teamId);
  const capabilities = await listRolePermissionsSnapshot(target.role);
  return res.json({
    userId: target.id,
    role: canonicalRole(target.role),
    capabilities,
    ...usage,
    canDelete: usage.linkedTotal === 0
  });
});

router.put("/users/:id", requireAuth, requireManager, async (req, res) => {
  const id = String(req.params.id || "").trim();
  const payload = req.body || {};
  const result = await withDb(async (db) => {
    ensureDbShape(db);
    const index = db.users.findIndex((u) => u.id === id && u.teamId === req.user.teamId);
    if (index < 0) return { error: { status: 404, message: "Usuário não encontrado" } };
    const current = db.users[index];
    const role = canonicalRole(current.role);
    if (!["acs", "doctor"].includes(role)) {
      return { error: { status: 400, message: "Somente ACS/Médico podem ser editados nesta tela" } };
    }

    const next = { ...current };
    const before = buildUserAuditSnapshot(current);
    if (payload.name !== undefined) {
      const name = String(payload.name || "").trim();
      if (!name) return { error: { status: 400, message: "Nome não pode ficar vazio" } };
      next.name = name;
    }
    if (payload.email !== undefined) {
      const email = String(payload.email || "").trim().toLowerCase();
      if (!email || !isValidEmail(email)) return { error: { status: 400, message: "E-mail inválido" } };
      const duplicated = db.users.some((u) => u.id !== current.id && String(u.email || "").toLowerCase() === email);
      if (duplicated) return { error: { status: 409, message: "E-mail já em uso por outro usuário" } };
      next.email = email;
    }
    if (payload.password !== undefined) {
      const password = String(payload.password || "");
      if (!password) {
        return { error: { status: 400, message: "Senha não pode ficar vazia" } };
      }
      if (!isStrongPassword(password)) {
        return { error: { status: 400, message: "Senha fraca: mínimo de 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial" } };
      }
      next.password = hashPassword(password);
    }

    if (roleNeedsCouncil(role) && (payload.councilNumber !== undefined || payload.councilUf !== undefined)) {
      const candidateNumber = payload.councilNumber !== undefined ? payload.councilNumber : current.councilNumber;
      const candidateUf = payload.councilUf !== undefined ? payload.councilUf : current.councilUf;
      const localCheck = validateCouncilData(role, candidateNumber, candidateUf);
      if (!localCheck.ok) return { error: { status: 400, message: localCheck.message } };
      const councilType = councilTypeForRole(role);
      const duplicatedCouncil = db.users.some((u) => {
        if (u.id === current.id) return false;
        return String(u.councilType || "").toUpperCase() === councilType
          && String(u.councilNumber || "") === localCheck.councilNumber
          && String(u.councilUf || "").toUpperCase() === localCheck.councilUf;
      });
      if (duplicatedCouncil) return { error: { status: 409, message: `${councilType} já cadastrado para outro usuário` } };

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

    next.updatedAt = new Date().toISOString();
    db.users[index] = next;
    addAuditLog(db, req.user, "user.updated_by_manager", "user", next.id, {
      changedFields: Object.keys(payload || {}),
      before,
      after: buildUserAuditSnapshot(next)
    });
    return { user: sanitizeUser(next, db) };
  });
  if (result.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.user);
});

router.delete("/users/:id", requireAuth, requireManager, async (req, res) => {
  const id = String(req.params.id || "").trim();
  const reason = String(req.body?.reason || "").trim();
  if (id === req.user.id) {
    return res.status(400).json({ error: "Não é permitido excluir o próprio usuário" });
  }
  if (reason.length < 8) {
    return res.status(400).json({ error: "Justificativa obrigatória para excluir usuário" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.users.findIndex((u) => u.id === id && u.teamId === req.user.teamId);
    if (index < 0) return { error: { status: 404, message: "Usuário não encontrado" } };
    const current = db.users[index];
    const role = canonicalRole(current.role);
    if (!["acs", "doctor"].includes(role)) {
      return { error: { status: 400, message: "Somente ACS/Médico podem ser excluídos nesta tela" } };
    }

    const usage = getTeamUserUsage(db, current.id, req.user.teamId);
    if (usage.linkedTotal > 0) {
      return {
        error: {
          status: 409,
          message: "Ação bloqueada: usuário possui vínculos ativos. Realoque/remova vínculos antes de excluir.",
          details: usage
        }
      };
    }

    db.users.splice(index, 1);
    addAuditLog(db, req.user, "user.deleted_by_manager", "user", current.id, {
      role,
      before: buildUserAuditSnapshot(current),
      after: null,
      reason
    });
    return { ok: true };
  });

  if (result.error) return res.status(result.error.status).json({ error: result.error.message, details: result.error.details || {} });
  return res.json({ ok: true });
});

export default router;
