import { v4 as uuidv4 } from "uuid";
import express from "express";
import { readDb, withDb } from "../db.js";
import { requireAuth, requireSupportAdmin } from "../middlewares/auth.js";
import { ensureDbShape } from "../utils/domain.js";
import { canonicalRole, hasCapability, isValidEmail } from "../utils/helpers.js";
import { hashPassword, generateTempPassword } from "../services/crypto.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

// All /platform routes require support_admin
router.use(requireAuth, requireSupportAdmin);

// ── Units ──────────────────────────────────────────────────────────────────

router.get("/platform/units", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const db = await readDb();
  ensureDbShape(db);
  const units = (db.units || []).map((u) => ({
    id: u.id,
    name: u.name || "",
    cnes: u.cnes || "",
    municipalityName: u.municipalityName || "",
    uf: u.uf || "",
    municipalityId: u.municipalityId || "",
    contactEmail: u.contactEmail || "",
    phone: u.phone || "",
    status: u.status || "onboarding",
    createdAt: u.createdAt || "",
    updatedAt: u.updatedAt || ""
  }));
  return res.json(units);
});

router.get("/platform/units/:unitId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const db = await readDb();
  ensureDbShape(db);
  const unit = (db.units || []).find((u) => u.id === req.params.unitId);
  if (!unit) return res.status(404).json({ error: "UBS não encontrada" });
  return res.json(unit);
});

router.post("/platform/units", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.create")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const payload = req.body || {};
  const name             = String(payload.name || "").trim();
  const cnes             = String(payload.cnes || "").trim();
  const municipalityName = String(payload.municipalityName || "").trim();
  const uf               = String(payload.uf || "").trim().toUpperCase();
  const municipalityId   = String(payload.municipalityId || "").trim();
  const contactEmail     = String(payload.contactEmail || "").trim().toLowerCase();
  const phone            = String(payload.phone || "").trim();
  const status           = ["onboarding", "active", "inactive"].includes(payload.status)
    ? payload.status
    : "onboarding";

  if (!name || !cnes || !municipalityName || !uf || !municipalityId) {
    return res.status(400).json({ error: "name, cnes, municipalityName, uf, municipalityId são obrigatórios" });
  }
  if (!/^\d{7}$/.test(municipalityId)) {
    return res.status(400).json({ error: "municipalityId deve ter exatamente 7 dígitos (código IBGE)" });
  }
  if (!/^\d{7}$/.test(cnes)) {
    return res.status(400).json({ error: "cnes deve ter exatamente 7 dígitos" });
  }
  if (contactEmail && !isValidEmail(contactEmail)) {
    return res.status(400).json({ error: "contactEmail inválido" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    if (!Array.isArray(db.units)) db.units = [];
    if (db.units.some((u) => u.cnes === cnes)) {
      return { error: "CNES já cadastrado para outra UBS" };
    }

    const unit = {
      id: uuidv4(),
      name,
      cnes,
      municipalityName,
      uf,
      municipalityId,
      contactEmail,
      phone,
      status,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.units.push(unit);

    addAuditLog(db, req.user, "PLATFORM_UNIT_CREATED", "platform_unit", unit.id, {
      name,
      cnes,
      municipalityName,
      uf,
      municipalityId,
      outcome: "success"
    });
    return { unit };
  });

  if (result?.error) return res.status(409).json({ error: result.error });
  return res.status(201).json(result.unit);
});

router.patch("/platform/units/:unitId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const { unitId } = req.params;
  const payload = req.body || {};

  const result = await withDb((db) => {
    ensureDbShape(db);
    if (!Array.isArray(db.units)) db.units = [];
    const idx = db.units.findIndex((u) => u.id === unitId);
    if (idx < 0) return { error: { status: 404, message: "UBS não encontrada" } };

    const current = db.units[idx];
    const next = { ...current, updatedAt: new Date().toISOString() };

    if (payload.name !== undefined)         next.name = String(payload.name || "").trim();
    if (payload.contactEmail !== undefined) next.contactEmail = String(payload.contactEmail || "").trim().toLowerCase();
    if (payload.phone !== undefined)        next.phone = String(payload.phone || "").trim();
    if (payload.status !== undefined && ["onboarding", "active", "inactive"].includes(payload.status)) {
      next.status = payload.status;
    }

    db.units[idx] = next;
    addAuditLog(db, req.user, "PLATFORM_UNIT_UPDATED", "platform_unit", unitId, {
      changedFields: Object.keys(payload),
      outcome: "success"
    });
    return { unit: next };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.unit);
});

// ── Teams ──────────────────────────────────────────────────────────────────

router.post("/platform/units/:unitId/teams", async (req, res) => {
  if (!hasCapability(req.user, "platform.team.create")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const { unitId } = req.params;
  const payload = req.body || {};
  const name       = String(payload.name || "").trim();
  const ine        = String(payload.ine || "").trim();
  const tipoEquipe = String(payload.tipoEquipe || "").trim();

  if (!name) return res.status(400).json({ error: "name é obrigatório" });

  const result = await withDb((db) => {
    ensureDbShape(db);
    if (!Array.isArray(db.units)) db.units = [];
    const unit = db.units.find((u) => u.id === unitId);
    if (!unit) return { error: { status: 404, message: "UBS não encontrada" } };

    const team = {
      id: uuidv4(),
      name,
      ine,
      tipoEquipe,
      unitId,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.teams.push(team);

    addAuditLog(db, req.user, "PLATFORM_TEAM_CREATED", "platform_team", team.id, {
      name,
      ine,
      unitId,
      outcome: "success"
    });
    return { team };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.team);
});

// ── Initial manager ────────────────────────────────────────────────────────

router.post("/platform/units/:unitId/initial-manager", async (req, res) => {
  if (!hasCapability(req.user, "platform.initial_manager.create")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const { unitId } = req.params;
  const payload = req.body || {};
  const name  = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const cpf   = String(payload.cpf || "").replace(/\D/g, "");
  const cns   = String(payload.cns || "").replace(/\D/g, "");
  const cbo   = String(payload.cbo || "").trim();
  const phone = String(payload.phone || "").trim();

  if (!name || !email) {
    return res.status(400).json({ error: "name e email são obrigatórios" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "E-mail inválido" });
  }

  const db0 = await readDb();
  ensureDbShape(db0);
  if (!Array.isArray(db0.units)) db0.units = [];
  const unit = db0.units.find((u) => u.id === unitId);
  if (!unit) return res.status(404).json({ error: "UBS não encontrada" });

  // Generate temp password BEFORE withDb — never persisted in plaintext
  const tempPassword = generateTempPassword();

  const result = await withDb((db) => {
    ensureDbShape(db);
    if (db.users.some((u) => String(u.email || "").toLowerCase() === email)) {
      return { error: "E-mail já cadastrado" };
    }

    const nowIso = new Date().toISOString();
    const user = {
      id: uuidv4(),
      name,
      role: "gestor",
      email,
      password: hashPassword(tempPassword),  // stored hashed — plaintext never persisted
      cpf,
      cns,
      cbo,
      phone,
      teamId: "",
      unitId,
      municipalityId: unit.municipalityId || "",
      twoFactorEnabled: false,
      twoFactorSecret: "",
      twoFactorPendingSecret: "",
      twoFactorPendingCreatedAt: "",
      forcePasswordChange: true,
      passwordUpdatedAt: null,
      temporaryPasswordIssuedAt: nowIso,
      createdBySupport: true,
      createdByUserId: req.user.id,
      lastPasswordResetAt: null,
      passwordResetBy: null,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.users.push(user);

    // Audit — NEVER log tempPassword
    addAuditLog(db, req.user, "PLATFORM_INITIAL_MANAGER_CREATED", "platform_user", user.id, {
      unitId,
      email,
      role: "gestor",
      outcome: "success"
      // tempPassword deliberately excluded
    });

    return { userId: user.id };
  });

  if (result?.error) return res.status(409).json({ error: result.error });

  // Temp password returned ONCE in response — caller must record it
  return res.status(201).json({
    userId: result.userId,
    email,
    temporaryPassword: tempPassword,
    message: "Gestor inicial criado. Comunique a senha temporária ao gestor — será exigida troca no primeiro acesso."
  });
});

// ── Password reset (support resets gestor) ────────────────────────────────

router.post("/platform/units/:unitId/initial-manager/:userId/reset-password", async (req, res) => {
  if (!hasCapability(req.user, "platform.password.reset")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const { unitId, userId } = req.params;
  const tempPassword = generateTempPassword();
  const nowIso = new Date().toISOString();

  const result = await withDb((db) => {
    ensureDbShape(db);
    const idx = db.users.findIndex((u) => {
      return u.id === userId
        && canonicalRole(u.role) === "gestor"
        && (u.unitId || "") === unitId;
    });
    if (idx < 0) return { error: { status: 404, message: "Gestor não encontrado nesta UBS" } };

    // Revoke all active sessions for this user
    db.refreshTokens = (db.refreshTokens || []).map((t) =>
      t.userId === userId && !t.revokedAt ? { ...t, revokedAt: nowIso } : t
    );

    db.users[idx] = {
      ...db.users[idx],
      password: hashPassword(tempPassword),  // plaintext never stored
      forcePasswordChange: true,
      temporaryPasswordIssuedAt: nowIso,
      lastPasswordResetAt: nowIso,
      passwordResetBy: req.user.id,
      updatedAt: nowIso
    };

    // Audit — NEVER log tempPassword
    addAuditLog(db, req.user, "USER_PASSWORD_RESET", "platform_user", userId, {
      resetBy: req.user.id,
      unitId,
      outcome: "success"
    });

    return { ok: true };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({
    temporaryPassword: tempPassword,
    message: "Senha resetada. Comunique a nova senha temporária ao gestor — será exigida troca no próximo login."
  });
});

export default router;
