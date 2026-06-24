import crypto from "node:crypto";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb, listUsersSnapshot, findUserById, listRolePermissionsSnapshot } from "../db.js";
import { USER_ONLINE_THRESHOLD_MS, MUNICIPALITY_ID } from "../config.js";
import { requireManager } from "../middlewares/auth.js";
import { ensureDbShape, sanitizeUser } from "../utils/domain.js";
import {
  canonicalRole, isStrongPassword, isValidEmail, roleNeedsCouncil,
  councilTypeForRole, getClientIp, isAnaAdminUser, hasCapability
} from "../utils/helpers.js";
import { validateCouncilData, verifyCouncilExternally } from "../utils/council.js";
import { generateVitrasId } from "../utils/vitras-id.js";
import { hashPassword, generateTempPassword } from "../services/crypto.js";
import { addAuditLog } from "../services/audit.js";
import { getTeamUserUsage } from "../utils/metrics.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate, TeamPatchSchema } from "../schemas.js";

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
    updatedAt: String(user.updatedAt || user.createdAt || ""),
    // F4-03: cnsProfissional is SENSITIVE — SHA-256 hash only, never plaintext in audit log
    cnsProfissional: user.cnsProfissional
      ? crypto.createHash("sha256").update(String(user.cnsProfissional)).digest("hex")
      : ""
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

// C22: GET /teams/:id — authenticated, returns full team metadata (ine, tipoEquipe)
router.get("/teams/:id", requireAuth, async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const teamId = String(req.params.id || "").trim();

  // Scope: can only read own team unless has users.read.all
  if (req.user.teamId && req.user.teamId !== teamId && !hasCapability(req.user, "users.read.all")) {
    return res.status(403).json({ error: "Sem permissão para visualizar esta equipe" });
  }

  const team = db.teams.find((t) => t.id === teamId);
  if (!team) return res.status(404).json({ error: "Equipe não encontrada" });

  return res.json({
    id: team.id,
    name: team.name || "",
    ine: team.ine || "",
    tipoEquipe: team.tipoEquipe || "",
    updatedAt: team.updatedAt || ""
  });
});

// F4-05: PATCH /teams/:id — update INE and tipoEquipe (stored in JSONB)
router.patch("/teams/:id", requireAuth, validate(TeamPatchSchema), async (req, res) => {
  if (!hasCapability(req.user, "team.manage")) {
    return res.status(403).json({ error: "Sem permissão para editar equipe" });
  }

  const teamId = String(req.params.id || "").trim();
  const payload = req.body || {};

  const result = await withDb((db) => {
    ensureDbShape(db);
    const idx = db.teams.findIndex((t) => t.id === teamId);
    if (idx < 0) return { error: { status: 404, message: "Equipe não encontrada" } };

    const current = db.teams[idx];

    // Scope check: non-global-manager can only edit their own team
    if (req.user.teamId && req.user.teamId !== teamId && !hasCapability(req.user, "users.manage.all")) {
      return { error: { status: 403, message: "Sem permissão para editar esta equipe" } };
    }

    const next = { ...current };
    if (payload.ine !== undefined) next.ine = String(payload.ine || "").trim();
    if (payload.tipoEquipe !== undefined) next.tipoEquipe = payload.tipoEquipe;
    next.updatedAt = new Date().toISOString();

    db.teams[idx] = next;

    addAuditLog(db, req.user, "team.updated", "team", teamId, {
      teamId,
      changedFields: Object.keys(payload),
      outcome: "success",
      before: { ine: current.ine || "", tipoEquipe: current.tipoEquipe || "" },
      after: { ine: next.ine || "", tipoEquipe: next.tipoEquipe || "" }
    });

    return { team: next };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.team);
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

router.post("/users", requireAuth, async (req, res) => {
  const callerRole = canonicalRole(req.user?.role);
  const isGestor = callerRole === "gestor";
  const isManager = callerRole === "nurse_manager" || hasCapability(req.user, "team.manage");

  if (!isGestor && !isManager) {
    return res.status(403).json({ error: "Somente gestor ou enfermeira podem cadastrar usuários" });
  }

  const payload = req.body || {};
  const name  = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const role  = canonicalRole(payload.role);

  if (!name || !role) {
    return res.status(400).json({ error: "name e role são obrigatórios" });
  }

  // Roles nurse_manager can create
  const managerAllowedRoles = ["acs", "doctor"];
  // Roles gestor can create (all local, no platform/admin roles)
  const gestorAllowedRoles = [
    "acs", "doctor", "nurse_manager", "nursing_tech", "dentist",
    "pharmacist", "pharmacy_tech", "receptionist", "coordinator",
    "oral_health_aux", "oral_health_tech", "psychologist", "physical_therapist",
    "social_worker", "nutritionist", "physical_educator", "local_admin", "aps_coordinator"
  ];
  const forbiddenRoles = ["support_admin", "break_glass_admin", "developer_readonly", "security_auditor", "qa_operator", "support_operator"];

  if (forbiddenRoles.includes(role)) {
    return res.status(400).json({ error: "Perfil não pode ser criado por este operador" });
  }
  if (!isGestor && !managerAllowedRoles.includes(role)) {
    return res.status(400).json({ error: "A enfermeira pode cadastrar apenas ACS ou Médico(a)" });
  }
  if (isGestor && !gestorAllowedRoles.includes(role)) {
    return res.status(400).json({ error: "Perfil não disponível para criação pelo gestor" });
  }

  const councilType = councilTypeForRole(role);
  const councilValidation = validateCouncilData(role, payload.councilNumber, payload.councilUf);
  if (!councilValidation.ok) {
    return res.status(400).json({ error: councilValidation.message });
  }

  const externalCheck = roleNeedsCouncil(role)
    ? await verifyCouncilExternally({
        role, councilType,
        councilNumber: councilValidation.councilNumber || "",
        councilUf: councilValidation.councilUf || "",
        name, email
      })
    : { checked: false, valid: true, provider: "not-required", status: "skipped" };

  if (!externalCheck.valid) {
    return res.status(400).json({ error: externalCheck.error || "Conselho não validado no provedor externo" });
  }

  // Generate temp password for new user
  const tempPassword = generateTempPassword();

  const result = await withDb((db) => {
    ensureDbShape(db);
    // sem validação de email — email não é mais obrigatório

    const duplicatedCouncil = roleNeedsCouncil(role) && db.users.some((u) => {
      const uRole = canonicalRole(u.role);
      return roleNeedsCouncil(uRole)
        && String(u.councilType || "").toUpperCase() === councilType
        && String(u.councilNumber || "") === councilValidation.councilNumber
        && String(u.councilUf || "").toUpperCase() === councilValidation.councilUf;
    });
    if (duplicatedCouncil) return { error: `${councilType} já cadastrado para outro usuário` };

    // Gestor can only create users for their own unit
    if (isGestor && payload.unitId && payload.unitId !== (req.user.unitId || "")) {
      return { error: "Gestor não pode criar usuário em outra UBS" };
    }

    const targetTeamId = isGestor
      ? (String(payload.teamId || "").trim() || "")
      : req.user.teamId;
    const targetUnitId = req.user.unitId || "";

    const userMunicipalityId = String(req.user.municipalityId || MUNICIPALITY_ID || "").trim();
    if (!userMunicipalityId) {
      return { error: "Município não configurado neste deployment (MUNICIPALITY_ID ausente)", status: 500 };
    }

    const nowIso = new Date().toISOString();
    const user = {
      id: uuidv4(),
      vitrasId: generateVitrasId(db.users),
      name,
      role,
      cargo: String(payload.cargo || role),
      email: email || "",
      password: hashPassword(tempPassword),
      teamId: targetTeamId,
      unitId: targetUnitId,
      municipalityId: userMunicipalityId,
      councilType,
      councilNumber: councilValidation.councilNumber || "",
      councilUf: councilValidation.councilUf || "",
      councilVerification: {
        checked: externalCheck.checked,
        provider: externalCheck.provider,
        status: externalCheck.status,
        verifiedAt: nowIso
      },
      twoFactorEnabled: false,
      twoFactorSecret: "",
      twoFactorPendingSecret: "",
      twoFactorPendingCreatedAt: "",
      forcePasswordChange: true,
      passwordUpdatedAt: null,
      temporaryPasswordIssuedAt: nowIso,
      createdBySupport: false,
      createdByUserId: req.user.id,
      lastPasswordResetAt: null,
      passwordResetBy: null,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    db.users.push(user);
    addAuditLog(db, req.user, "LOCAL_USER_CREATED", "user", user.id, {
      role: user.role,
      teamId: user.teamId,
      unitId: user.unitId,
      createdBy: req.user.id,
      outcome: "success"
      // tempPassword deliberately excluded
    });
    return { user, db };
  });

  if (result.error) return res.status(result.status || 400).json({ error: result.error });

  const safeUser = sanitizeUser(result.user, result.db);
  const { password: _pw, ...userWithoutPassword } = safeUser;
  return res.status(201).json({
    ...userWithoutPassword,
    temporaryPassword: tempPassword  // shown once — caller must record
  });
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

router.post("/users/:id/deactivate", requireAuth, async (req, res) => {
  const callerRole = canonicalRole(req.user?.role);
  const isGestorCaller = callerRole === "gestor";
  const isManagerCaller = callerRole === "nurse_manager" || hasCapability(req.user, "team.manage");
  if (!isGestorCaller && !isManagerCaller) {
    return res.status(403).json({ error: "Sem permissão para desativar usuários" });
  }

  const targetId = String(req.params.id || "").trim();
  const result = await withDb((db) => {
    ensureDbShape(db);
    const idx = db.users.findIndex(u => u.id === targetId);
    if (idx < 0) return { error: { status: 404, message: "Usuário não encontrado" } };

    const target = db.users[idx];
    if (isGestorCaller && target.unitId !== req.user.unitId) {
      return { error: { status: 403, message: "Gestor só pode desativar usuários da própria UBS" } };
    }
    if (target.id === req.user.id) {
      return { error: { status: 400, message: "Não é possível desativar sua própria conta" } };
    }
    const forbidden = ["support_admin", "break_glass_admin", "developer_readonly", "security_auditor"];
    if (forbidden.includes(canonicalRole(target.role))) {
      return { error: { status: 403, message: "Perfil não pode ser desativado por este operador" } };
    }

    const nowIso = new Date().toISOString();
    db.users[idx] = { ...target, inactive: true, updatedAt: nowIso };
    addAuditLog(db, req.user, "user.deactivated", "user", target.id, {
      targetRole: canonicalRole(target.role),
      targetUnitId: target.unitId,
      outcome: "success"
    });
    return { user: db.users[idx] };
  });

  if (result?.error) return res.status(result.error.status || 400).json({ error: result.error.message });
  const { password: _pw, ...safe } = result.user;
  return res.json(safe);
});

router.post("/users/:id/reset-password", requireAuth, async (req, res) => {
  const callerRole = canonicalRole(req.user?.role);
  const isGestor = callerRole === "gestor";
  const isManager = callerRole === "nurse_manager" || hasCapability(req.user, "team.manage");

  if (!isGestor && !isManager) {
    return res.status(403).json({ error: "Somente gestor ou enfermeira podem resetar senhas" });
  }

  const targetId = String(req.params.id || "").trim();
  if (targetId === req.user.id) {
    return res.status(400).json({ error: "Use o perfil para alterar sua própria senha" });
  }

  const tempPassword = generateTempPassword();
  const nowIso = new Date().toISOString();

  const result = await withDb((db) => {
    ensureDbShape(db);

    const idx = db.users.findIndex((u) => {
      if (u.id !== targetId) return false;
      // Gestor: must be same unit
      if (isGestor) return (u.unitId || "") === (req.user.unitId || "");
      // Nurse_manager: must be same team
      return (u.teamId || "") === (req.user.teamId || "");
    });

    if (idx < 0) return { error: { status: 404, message: "Usuário não encontrado na sua unidade" } };

    const target = db.users[idx];

    // Prevent resetting support_admin or break_glass_admin passwords
    if (["support_admin", "break_glass_admin"].includes(canonicalRole(target.role))) {
      return { error: { status: 403, message: "Não é permitido resetar senha deste perfil" } };
    }

    // Revoke all active sessions
    db.refreshTokens = (db.refreshTokens || []).map((t) =>
      t.userId === targetId && !t.revokedAt ? { ...t, revokedAt: nowIso } : t
    );

    db.users[idx] = {
      ...target,
      password: hashPassword(tempPassword),
      forcePasswordChange: true,
      temporaryPasswordIssuedAt: nowIso,
      lastPasswordResetAt: nowIso,
      passwordResetBy: req.user.id,
      updatedAt: nowIso
    };

    addAuditLog(db, req.user, "USER_PASSWORD_RESET", "user", targetId, {
      resetBy: req.user.id,
      unitId: req.user.unitId || "",
      teamId: req.user.teamId || "",
      outcome: "success"
      // tempPassword deliberately excluded
    });

    return { ok: true };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({
    temporaryPassword: tempPassword,
    message: "Senha resetada. Comunique ao usuário — será exigida troca no próximo login."
  });
});

export default router;
