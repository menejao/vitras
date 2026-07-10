import { v4 as uuidv4 } from "uuid";
import express from "express";
import { readDb, withDb } from "../db.js";
import { requireAuth, requireSupportAdmin } from "../middlewares/auth.js";
import { ensureDbShape } from "../utils/domain.js";
import { canonicalRole, hasCapability, isValidEmail, isPlatformRole } from "../utils/helpers.js";
import { hashPassword, generateTempPassword } from "../services/crypto.js";
import { generateVitrasId } from "../utils/vitras-id.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

// All /platform routes require support_admin.
// The path prefix "/platform" is mandatory: without it, router.use() would intercept
// every request (including /bootstrap, /patients, etc.) because this router is mounted
// at "/" in app.js BEFORE the global requireAuth middleware.
router.use("/platform", requireAuth, requireSupportAdmin);

// ── Unit lifecycle ─────────────────────────────────────────────────────────
const VALID_STATUSES = ["draft", "onboarding", "homologation", "active", "suspended"];

// Allowed transitions: draft→onboarding, onboarding→homologation, homologation→active,
// active→suspended, suspended→active, and support_admin may also go back one step.
// Map: from → allowed next states
const STATUS_TRANSITIONS = {
  draft:        ["onboarding"],
  onboarding:   ["homologation", "draft"],
  homologation: ["active", "onboarding"],
  active:       ["suspended"],
  suspended:    ["active"]
};

function isValidTransition(from, to) {
  if (from === to) return false;
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

// ── National homologation criteria ─────────────────────────────────────────
// These criteria are uniform across all UBS — no municipal exceptions.

function checkOnboardingCriteria(unit, db) {
  // Criteria to advance from onboarding → homologation
  const users    = db.users    || [];
  const teams    = db.teams    || [];
  const unitId   = unit.id;

  const gestors = users.filter((u) => (u.unitId || "") === unitId && canonicalRole(u.role) === "gestor" && !u.inactive);
  const activeUsers = users.filter((u) => (u.unitId || "") === unitId && !u.inactive);
  const unitTeams = teams.filter((t) => (t.unitId || "") === unitId);

  // Gestor must have completed first-access (forcePasswordChange cleared)
  const gestorCompletedFirstAccess = gestors.some((g) => g.forcePasswordChange === false);

  const criteria = [
    { id: "gestor_exists",              label: "Gestor inicial criado",                    pass: gestors.length > 0 },
    { id: "gestor_first_access",        label: "Gestor realizou primeiro acesso",           pass: gestorCompletedFirstAccess },
    { id: "team_exists",                label: "Pelo menos uma equipe cadastrada",          pass: unitTeams.length > 0 },
    { id: "user_exists",                label: "Pelo menos um usuário ativo",               pass: activeUsers.length > 0 },
    { id: "institutional_data",         label: "Dados institucionais preenchidos (CNES, nome, município, UF)", pass: !!(unit.cnes && unit.name && unit.municipalityName && unit.uf) },
  ];

  const blocked = criteria.filter((c) => !c.pass);
  return { criteria, blocked, ok: blocked.length === 0 };
}

function checkHomologationCriteria(unit, db) {
  // Criteria to advance from homologation → active
  // Must satisfy all onboarding criteria PLUS explicit homologation approval
  const base = checkOnboardingCriteria(unit, db);

  const homologChecklist = unit.homologationChecklist || {};
  const checklistItems = [
    { id: "auth_working",         label: "Autenticação funcionando",            pass: !!homologChecklist.auth_working },
    { id: "rbac_working",         label: "RBAC funcionando por perfil",         pass: !!homologChecklist.rbac_working },
    { id: "team_configured",      label: "Equipe configurada e ativa",          pass: !!homologChecklist.team_configured },
    { id: "user_created",         label: "Usuário operacional criado",          pass: !!homologChecklist.user_created },
    { id: "patient_cadastro",     label: "Cadastro de cidadão funcionando",     pass: !!homologChecklist.patient_cadastro },
    { id: "household_cadastro",   label: "Cadastro domiciliar funcionando",     pass: !!homologChecklist.household_cadastro },
    { id: "individual_cadastro",  label: "Cadastro individual funcionando",     pass: !!homologChecklist.individual_cadastro },
    { id: "audit_working",        label: "Trilha de auditoria funcionando",     pass: !!homologChecklist.audit_working },
    { id: "approval_recorded",    label: "Aprovação técnica registrada",        pass: !!(unit.homologationApprovedBy && unit.homologationApprovedAt) },
  ];

  const allCriteria = [...base.criteria, ...checklistItems];
  const blocked = allCriteria.filter((c) => !c.pass);
  return { criteria: allCriteria, blocked, ok: blocked.length === 0 };
}

// ── Units ──────────────────────────────────────────────────────────────────

function buildUnitStats(unitId, db) {
  const users    = db.users    || [];
  const teams    = db.teams    || [];
  const patients = db.patients || [];
  const gestorCount = users.filter((u) => (u.unitId || "") === unitId && canonicalRole(u.role) === "gestor" && !u.inactive).length;
  const userCount   = users.filter((u) => (u.unitId || "") === unitId && !u.inactive).length;
  const teamCount   = teams.filter((t) => (t.unitId || "") === unitId).length;
  const patientCount = patients.filter((p) => (p.unitId || "") === unitId).length;
  return { gestorCount, userCount, teamCount, patientCount };
}

function enrichUnit(u, db) {
  const stats = buildUnitStats(u.id, db);
  const creator = u.createdBy ? (db.users || []).find((usr) => usr.id === u.createdBy) : null;
  return {
    id:               u.id,
    name:             u.name             || "",
    cnes:             u.cnes             || "",
    municipalityName: u.municipalityName || "",
    uf:               u.uf               || "",
    municipalityId:   u.municipalityId   || "",
    address:          u.address          || "",
    contactEmail:     u.contactEmail     || "",
    phone:            u.phone            || "",
    status:           VALID_STATUSES.includes(u.status) ? u.status : "draft",
    createdAt:        u.createdAt        || "",
    updatedAt:        u.updatedAt        || "",
    createdBy:        u.createdBy        || "",
    createdByName:    creator ? (creator.name || creator.email || "") : "system",
    activatedAt:      u.activatedAt      || "",
    suspendedAt:      u.suspendedAt      || "",
    ...stats
  };
}

router.get("/platform/summary", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const db = await readDb();
  ensureDbShape(db);
  const units = db.units || [];
  const users = db.users || [];
  const totalUnits     = units.length;
  const onboarding     = units.filter((u) => (u.status || "onboarding") === "onboarding").length;
  const active         = units.filter((u) => u.status === "active").length;
  const inactive       = units.filter((u) => u.status === "inactive").length;
  const totalGestors   = users.filter((u) => canonicalRole(u.role) === "gestor" && !u.inactive).length;
  const totalUsers     = users.filter((u) => !u.inactive && !isPlatformRole(u)).length;
  const totalTeams     = (db.teams || []).length;
  return res.json({ totalUnits, onboarding, active, inactive, totalGestors, totalUsers, totalTeams });
});

router.get("/platform/units", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const db = await readDb();
  ensureDbShape(db);

  const search  = String(req.query.search  || "").trim().toLowerCase();
  const uf      = String(req.query.uf      || "").trim().toUpperCase();
  const status  = String(req.query.status  || "").trim();
  const sortBy  = ["name","cnes","status","createdAt","municipalityName"].includes(req.query.sortBy) ? req.query.sortBy : "name";
  const sortDir = req.query.sortDir === "desc" ? -1 : 1;
  const page    = Math.max(1, parseInt(req.query.page  || "1",  10) || 1);
  const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit || "25", 10) || 25));

  let units = (db.units || []).map((u) => enrichUnit(u, db));

  if (search) {
    units = units.filter((u) =>
      u.name.toLowerCase().includes(search) ||
      u.cnes.includes(search) ||
      u.municipalityName.toLowerCase().includes(search) ||
      // search by gestor name/email
      (db.users || []).some((usr) =>
        (usr.unitId || "") === u.id &&
        canonicalRole(usr.role) === "gestor" &&
        (String(usr.name || "").toLowerCase().includes(search) || String(usr.email || "").toLowerCase().includes(search))
      )
    );
  }
  if (uf)     units = units.filter((u) => u.uf.toUpperCase() === uf);
  if (status) units = units.filter((u) => u.status === status);

  units.sort((a, b) => {
    const av = String(a[sortBy] || "").toLowerCase();
    const bv = String(b[sortBy] || "").toLowerCase();
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });

  const total = units.length;
  const pages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const paged = units.slice(start, start + limit);

  return res.json({ units: paged, total, page, limit, pages });
});

router.get("/platform/units/:unitId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const db = await readDb();
  ensureDbShape(db);
  const unit = (db.units || []).find((u) => u.id === req.params.unitId);
  if (!unit) return res.status(404).json({ error: "UBS não encontrada" });

  // Return enriched unit with operational stats
  const enriched = enrichUnit(unit, db);

  // Also return gestor list for this unit (without password)
  const gestors = (db.users || [])
    .filter((u) => (u.unitId || "") === unit.id && canonicalRole(u.role) === "gestor" && !u.inactive)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, forcePasswordChange: u.forcePasswordChange }));

  const teams = (db.teams || [])
    .filter((t) => (t.unitId || "") === unit.id)
    .map((t) => ({ id: t.id, name: t.name, ine: t.ine, tipoEquipe: t.tipoEquipe }));

  return res.json({ ...enriched, gestors, teams });
});

router.get("/platform/units/:unitId/checklist", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const db = await readDb();
  ensureDbShape(db);
  const unit = (db.units || []).find((u) => u.id === req.params.unitId);
  if (!unit) return res.status(404).json({ error: "UBS não encontrada" });

  const status = unit.status || "draft";
  if (status === "onboarding") {
    const result = checkOnboardingCriteria(unit, db);
    return res.json({ transition: "onboarding → homologation", ...result });
  }
  if (status === "homologation") {
    const result = checkHomologationCriteria(unit, db);
    return res.json({ transition: "homologation → active", ...result });
  }
  return res.json({ transition: null, criteria: [], blocked: [], ok: true });
});

// PATCH homologation checklist items (support_admin marks items as done)
router.patch("/platform/units/:unitId/homologation-checklist", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const { unitId } = req.params;
  const payload = req.body || {};

  const VALID_ITEMS = ["auth_working","rbac_working","team_configured","user_created","patient_cadastro","household_cadastro","individual_cadastro","audit_working"];

  const result = await withDb((db) => {
    ensureDbShape(db);
    const idx = (db.units || []).findIndex((u) => u.id === unitId);
    if (idx < 0) return { error: { status: 404, message: "UBS não encontrada" } };
    const unit = db.units[idx];
    if (unit.status !== "homologation") {
      return { error: { status: 422, message: "Checklist de homologação só pode ser preenchido no estado homologation" } };
    }

    const checklist = { ...(unit.homologationChecklist || {}) };
    for (const item of VALID_ITEMS) {
      if (item in payload) checklist[item] = !!payload[item];
    }

    // Record approver if all items checked
    const nowIso = new Date().toISOString();
    const allChecked = VALID_ITEMS.every((k) => !!checklist[k]);
    const updated = {
      ...unit,
      homologationChecklist: checklist,
      updatedAt: nowIso,
      ...(allChecked && !unit.homologationApprovedBy
        ? { homologationApprovedBy: req.user.id, homologationApprovedAt: nowIso }
        : {})
    };
    db.units[idx] = updated;

    addAuditLog(db, req.user, "PLATFORM_HOMOLOGATION_CHECKLIST_UPDATED", "platform_unit", unitId, {
      updatedItems: Object.keys(payload).filter((k) => VALID_ITEMS.includes(k)),
      allChecked,
      outcome: "success"
    });

    return { checklist, allChecked, homologationApprovedBy: updated.homologationApprovedBy, homologationApprovedAt: updated.homologationApprovedAt };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
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
  const address          = String(payload.address || "").trim();
  const street           = String(payload.street || "").trim();
  const streetNumber     = String(payload.streetNumber || "").trim();
  const neighborhood     = String(payload.neighborhood || "").trim();
  const cep              = String(payload.cep || "").replace(/\D/g, "");
  const contactEmail     = String(payload.contactEmail || "").trim().toLowerCase();
  const phone            = String(payload.phone || "").trim();
  const status           = VALID_STATUSES.includes(payload.status) ? payload.status : "draft";
  // Location — stored as-is; geocoding future sprint
  const lat              = payload.lat  != null ? Number(payload.lat)  : null;
  const lng              = payload.lng  != null ? Number(payload.lng)  : null;

  if (!name || !cnes || !municipalityName || !uf) {
    return res.status(400).json({ error: "name, cnes, municipalityName e uf são obrigatórios" });
  }
  if (!street)       return res.status(400).json({ error: "logradouro (street) é obrigatório" });
  if (!streetNumber) return res.status(400).json({ error: "número (streetNumber) é obrigatório" });
  if (!neighborhood) return res.status(400).json({ error: "bairro (neighborhood) é obrigatório" });
  if (lat !== null && (isNaN(lat) || lat < -90  || lat > 90))  return res.status(400).json({ error: "lat inválido" });
  if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) return res.status(400).json({ error: "lng inválido" });
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
      address,
      street,
      streetNumber,
      neighborhood,
      cep: cep || null,
      lat: lat !== null ? lat : null,
      lng: lng !== null ? lng : null,
      geocodingStatus: (lat !== null && lng !== null) ? "manual" : "none",
      geocodedAt: (lat !== null && lng !== null) ? new Date().toISOString() : null,
      contactEmail,
      phone,
      status,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activatedAt: null,
      suspendedAt: null
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
    const nowIso = new Date().toISOString();
    const next = { ...current, updatedAt: nowIso };

    if (payload.name !== undefined)             next.name             = String(payload.name || "").trim();
    if (payload.cnes !== undefined) {
      const cnesVal = String(payload.cnes || "").trim();
      if (!/^\d{7}$/.test(cnesVal)) return { error: { status: 400, message: "cnes deve ter exatamente 7 dígitos" } };
      if (db.units.some((u, i) => u.cnes === cnesVal && i !== idx)) return { error: { status: 409, message: "CNES já cadastrado para outra UBS" } };
      next.cnes = cnesVal;
    }
    if (payload.municipalityName !== undefined) next.municipalityName = String(payload.municipalityName || "").trim();
    if (payload.uf !== undefined)               next.uf               = String(payload.uf || "").trim().toUpperCase();
    if (payload.municipalityId !== undefined) {
      const ibge = String(payload.municipalityId || "").trim();
      if (ibge && !/^\d{7}$/.test(ibge)) return { error: { status: 400, message: "municipalityId deve ter 7 dígitos" } };
      next.municipalityId = ibge || null;
    }
    if (payload.address !== undefined)          next.address          = String(payload.address || "").trim();
    if (payload.street !== undefined)           next.street           = String(payload.street || "").trim();
    if (payload.streetNumber !== undefined)     next.streetNumber     = String(payload.streetNumber || "").trim();
    if (payload.neighborhood !== undefined)     next.neighborhood     = String(payload.neighborhood || "").trim();
    if (payload.complement !== undefined)       next.complement       = String(payload.complement || "").trim() || null;
    if (payload.reference !== undefined)        next.reference        = String(payload.reference || "").trim() || null;
    if (payload.cep !== undefined)              next.cep              = String(payload.cep || "").replace(/\D/g, "") || null;
    if (payload.lat !== undefined) {
      const latVal = payload.lat != null ? Number(payload.lat) : null;
      if (latVal !== null && (isNaN(latVal) || latVal < -90 || latVal > 90)) {
        return { error: { status: 400, message: "lat inválido" } };
      }
      next.lat = latVal;
    }
    if (payload.lng !== undefined) {
      const lngVal = payload.lng != null ? Number(payload.lng) : null;
      if (lngVal !== null && (isNaN(lngVal) || lngVal < -180 || lngVal > 180)) {
        return { error: { status: 400, message: "lng inválido" } };
      }
      next.lng = lngVal;
    }
    if (next.lat != null && next.lng != null && !next.geocodingStatus) {
      next.geocodingStatus = "manual";
      next.geocodedAt = next.geocodedAt || nowIso;
    }
    if (payload.contactEmail !== undefined) next.contactEmail = String(payload.contactEmail || "").trim().toLowerCase();
    if (payload.phone !== undefined)        next.phone = String(payload.phone || "").trim();

    if (payload.status !== undefined) {
      const requestedStatus = String(payload.status || "").trim();
      if (!VALID_STATUSES.includes(requestedStatus)) {
        return { error: { status: 400, message: `Status inválido. Valores aceitos: ${VALID_STATUSES.join(", ")}` } };
      }
      if (!isValidTransition(current.status || "draft", requestedStatus)) {
        return { error: { status: 422, message: `Transição inválida: ${current.status || "draft"} → ${requestedStatus}` } };
      }

      // National homologation gate — enforce criteria before advancing
      if (requestedStatus === "homologation" && (current.status || "draft") === "onboarding") {
        const check = checkOnboardingCriteria(current, db);
        if (!check.ok) {
          return { error: { status: 422, message: "Critérios de homologação não cumpridos", blocked: check.blocked } };
        }
      }
      if (requestedStatus === "active" && current.status === "homologation") {
        const check = checkHomologationCriteria(current, db);
        if (!check.ok) {
          return { error: { status: 422, message: "Critérios de ativação não cumpridos", blocked: check.blocked } };
        }
      }

      next.status = requestedStatus;
      if (requestedStatus === "active" && !next.activatedAt) next.activatedAt = nowIso;
      if (requestedStatus === "suspended") next.suspendedAt = nowIso;
    }

    db.units[idx] = next;
    addAuditLog(db, req.user, "PLATFORM_UNIT_UPDATED", "platform_unit", unitId, {
      changedFields: Object.keys(payload),
      previousStatus: current.status,
      newStatus: next.status,
      outcome: "success"
    });
    return { unit: next };
  });

  if (result?.error) {
    const { status, message, blocked } = result.error;
    return res.status(status).json({ error: message, ...(blocked ? { blocked } : {}) });
  }
  return res.json(result.unit);
});

// ── Unit Modules ───────────────────────────────────────────────────────────

const VALID_MODULES = ["nutricao", "psicologia", "fisioterapia", "servico_social", "terapia_ocupacional", "fonoaudiologia"];

router.patch("/platform/units/:unitId/modules", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const { unitId } = req.params;
  const payload = req.body || {};

  if (!payload.enabledModules || !Array.isArray(payload.enabledModules)) {
    return res.status(400).json({ error: "enabledModules deve ser um array" });
  }
  const requested = payload.enabledModules;
  const invalid = requested.filter((m) => !VALID_MODULES.includes(m));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Módulos inválidos: ${invalid.join(", ")}. Válidos: ${VALID_MODULES.join(", ")}` });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const idx = (db.units || []).findIndex((u) => u.id === unitId);
    if (idx < 0) return { error: { status: 404, message: "UBS não encontrada" } };

    const current = db.units[idx];
    const previous = current.enabledModules || [];
    const nowIso = new Date().toISOString();

    db.units[idx] = { ...current, enabledModules: requested, updatedAt: nowIso };

    // Audit: one entry per changed module
    const enabled  = requested.filter((m) => !previous.includes(m));
    const disabled = previous.filter((m) => !requested.includes(m));
    for (const mod of enabled) {
      addAuditLog(db, req.user, "PLATFORM_MODULE_ENABLED", "platform_unit", unitId, {
        module: mod, unitId, unitName: current.name, previousValue: false, newValue: true, outcome: "success"
      });
    }
    for (const mod of disabled) {
      addAuditLog(db, req.user, "PLATFORM_MODULE_DISABLED", "platform_unit", unitId, {
        module: mod, unitId, unitName: current.name, previousValue: true, newValue: false, outcome: "success"
      });
    }

    return { enabledModules: requested };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
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

  if (!name) {
    return res.status(400).json({ error: "name é obrigatório" });
  }
  if (email && !isValidEmail(email)) {
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
    if (email && db.users.some((u) => String(u.email || "").toLowerCase() === email)) {
      return { error: "E-mail já cadastrado" };
    }

    const nowIso = new Date().toISOString();
    const user = {
      id: uuidv4(),
      vitrasId: generateVitrasId(db.users),
      name,
      role: "gestor",
      cargo: "gestor",
      email: email || "",
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

    // Auto-transition: draft → onboarding when first gestor is created
    const unitIdx = db.units.findIndex((u) => u.id === unitId);
    if (unitIdx >= 0) {
      const unitCurrent = db.units[unitIdx];
      if ((unitCurrent.status || "draft") === "draft") {
        db.units[unitIdx] = { ...unitCurrent, status: "onboarding", updatedAt: nowIso };
      }
    }

    // Audit — NEVER log tempPassword
    addAuditLog(db, req.user, "PLATFORM_INITIAL_MANAGER_CREATED", "platform_user", user.id, {
      unitId,
      email,
      role: "gestor",
      autoTransitionedUnit: (db.units[unitIdx]?.status === "onboarding") ? unitId : null,
      outcome: "success"
      // tempPassword deliberately excluded
    });

    return { userId: user.id, vitrasId: user.vitrasId };
  });

  if (result?.error) return res.status(409).json({ error: result.error });

  // Temp password returned ONCE in response — caller must record it
  return res.status(201).json({
    userId: result.userId,
    vitrasId: result.vitrasId,
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

// ── Unit General Configuration (operational toggles) ──────────────────────

export const DEFAULT_UNIT_CONFIG = {
  general: {
    ativo: true,
    atendimentoHabilitado: true,
    cadastroPacientes: true,
    cadastroFamilias: true,
    cadastroTerritorial: true,
    operacaoPorEquipes: true,
    operacaoPorMicroareas: false,
    atendimentoEspontaneo: true,
    atendimentoAgendado: false,
    visitasDomiciliares: true,
    triagem: false,
    acompanhamentoLongitudinal: true,
    encaminhamentos: false,
    notificacoesInternas: true,
  }
};

export const DEFAULT_OPERATIONAL_RULES = {
  agendas: {
    maxAgendasPorProfissional: 20,
    antecedenciaMinDias: 1,
    antecedenciaMaxDias: 30,
    duracaoPadraoConsultaMin: 20,
    toleranciaAtrasoMin: 15,
    confirmacaoObrigatoria: false,
    cancelamentoPermitido: true,
    remarcacaoPermitida: true,
    limiteEncaixes: 2,
    listaEspera: false,
  },
  visitas: {
    frequenciaMaxMensal: 4,
    registroObrigatorio: true,
  },
  atribuicao: {
    porEquipe: true,
    porMicroarea: false,
    maxPacientesPorAcs: 750,
  }
};

function mergeConfigDeep(defaults, stored) {
  if (!stored || typeof stored !== "object") return { ...defaults };
  const result = {};
  for (const key of Object.keys(defaults)) {
    if (defaults[key] !== null && typeof defaults[key] === "object" && !Array.isArray(defaults[key])) {
      result[key] = mergeConfigDeep(defaults[key], stored[key]);
    } else {
      result[key] = (stored && key in stored) ? stored[key] : defaults[key];
    }
  }
  return result;
}

router.get("/platform/units/:unitId/configuration", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });
  const db = await readDb();
  ensureDbShape(db);
  const unit = (db.units || []).find((u) => u.id === req.params.unitId);
  if (!unit) return res.status(404).json({ error: "UBS não encontrada" });

  const unitOverrides = unit.configuration || {};
  const effective = mergeConfigDeep(DEFAULT_UNIT_CONFIG, unitOverrides);
  return res.json({ unitId: unit.id, systemDefaults: DEFAULT_UNIT_CONFIG, unitOverrides, effective, hasOverrides: Object.keys(unitOverrides).length > 0 });
});

router.put("/platform/units/:unitId/configuration", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });
  const { unitId } = req.params;
  const payload = req.body || {};

  const result = await withDb((db) => {
    ensureDbShape(db);
    const idx = (db.units || []).findIndex((u) => u.id === unitId);
    if (idx < 0) return { error: { status: 404, message: "UBS não encontrada" } };
    const current = db.units[idx];
    const nextConfig = { ...(current.configuration || {}) };
    for (const section of Object.keys(payload)) {
      if (payload[section] && typeof payload[section] === "object") {
        nextConfig[section] = { ...(nextConfig[section] || {}), ...payload[section] };
      }
    }
    db.units[idx] = { ...current, configuration: nextConfig, updatedAt: new Date().toISOString() };
    addAuditLog(db, req.user, "PLATFORM_UNIT_CONFIGURATION_UPDATED", "platform_unit", unitId, {
      changedSections: Object.keys(payload), unitName: current.name, outcome: "success"
    });
    return { unitOverrides: nextConfig, effective: mergeConfigDeep(DEFAULT_UNIT_CONFIG, nextConfig) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
});

// ── Operational Rules ──────────────────────────────────────────────────────

router.get("/platform/units/:unitId/operational-rules", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });
  const db = await readDb();
  ensureDbShape(db);
  const unit = (db.units || []).find((u) => u.id === req.params.unitId);
  if (!unit) return res.status(404).json({ error: "UBS não encontrada" });

  const unitRules = unit.operationalRules || {};
  const effective = mergeConfigDeep(DEFAULT_OPERATIONAL_RULES, unitRules);
  return res.json({ unitId: unit.id, systemDefaults: DEFAULT_OPERATIONAL_RULES, unitRules, effective, hasOverrides: Object.keys(unitRules).length > 0 });
});

router.put("/platform/units/:unitId/operational-rules", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });
  const { unitId } = req.params;
  const payload = req.body || {};

  const result = await withDb((db) => {
    ensureDbShape(db);
    const idx = (db.units || []).findIndex((u) => u.id === unitId);
    if (idx < 0) return { error: { status: 404, message: "UBS não encontrada" } };
    const current = db.units[idx];
    const nextRules = { ...(current.operationalRules || {}) };
    for (const section of Object.keys(payload)) {
      if (payload[section] && typeof payload[section] === "object") {
        nextRules[section] = { ...(nextRules[section] || {}), ...payload[section] };
      }
    }
    db.units[idx] = { ...current, operationalRules: nextRules, updatedAt: new Date().toISOString() };
    addAuditLog(db, req.user, "PLATFORM_UNIT_RULES_UPDATED", "platform_unit", unitId, {
      changedSections: Object.keys(payload), unitName: current.name, outcome: "success"
    });
    return { unitRules: nextRules, effective: mergeConfigDeep(DEFAULT_OPERATIONAL_RULES, nextRules) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
});

// ── Unit Users list ────────────────────────────────────────────────────────

router.get("/platform/units/:unitId/users", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });
  const db = await readDb();
  ensureDbShape(db);
  const unit = (db.units || []).find((u) => u.id === req.params.unitId);
  if (!unit) return res.status(404).json({ error: "UBS não encontrada" });

  const users = (db.users || [])
    .filter((u) => (u.unitId || "") === unit.id && !isPlatformRole(u.role))
    .map((u) => {
      const team = u.teamId ? (db.teams || []).find((t) => t.id === u.teamId) : null;
      return {
        id: u.id,
        vitrasId: u.vitrasId || "",
        name: u.name || "",
        role: canonicalRole(u.role),
        teamId: u.teamId || "",
        teamName: team ? team.name : "",
        email: u.email || "",
        inactive: !!u.inactive,
        forcePasswordChange: !!u.forcePasswordChange,
        lastLoginAt: u.lastLoginAt || null,
        createdAt: u.createdAt || "",
      };
    });

  users.sort((a, b) => {
    const order = { gestor: 0, medico: 1, enfermeiro: 2, acs: 3 };
    const aOrd = order[a.role] ?? 9;
    const bOrd = order[b.role] ?? 9;
    if (aOrd !== bOrd) return aOrd - bOrd;
    return String(a.name).localeCompare(String(b.name), "pt-BR");
  });

  return res.json({ users, total: users.length });
});

// ── Team edit ──────────────────────────────────────────────────────────────

router.patch("/platform/units/:unitId/teams/:teamId", async (req, res) => {
  if (!hasCapability(req.user, "platform.team.create")) return res.status(403).json({ error: "Sem permissão" });
  const { unitId, teamId } = req.params;
  const payload = req.body || {};

  const result = await withDb((db) => {
    ensureDbShape(db);
    if (!(db.units || []).some((u) => u.id === unitId)) return { error: { status: 404, message: "UBS não encontrada" } };
    const idx = (db.teams || []).findIndex((t) => t.id === teamId && (t.unitId || "") === unitId);
    if (idx < 0) return { error: { status: 404, message: "Equipe não encontrada nesta UBS" } };
    const current = db.teams[idx];
    const next = { ...current, updatedAt: new Date().toISOString() };
    if (payload.name !== undefined) next.name = String(payload.name || "").trim();
    if (payload.ine !== undefined) next.ine = String(payload.ine || "").trim();
    if (payload.tipoEquipe !== undefined) next.tipoEquipe = String(payload.tipoEquipe || "").trim();
    if (payload.inactive !== undefined) next.inactive = !!payload.inactive;
    db.teams[idx] = next;
    addAuditLog(db, req.user, "PLATFORM_TEAM_UPDATED", "platform_team", teamId, {
      changedFields: Object.keys(payload), unitId, outcome: "success"
    });
    return { team: next };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.team);
});

// ── Unit Audit Log ─────────────────────────────────────────────────────────

const PLATFORM_UNIT_AUDIT_ACTIONS = new Set([
  "PLATFORM_UNIT_CREATED", "PLATFORM_UNIT_UPDATED",
  "PLATFORM_MODULE_ENABLED", "PLATFORM_MODULE_DISABLED",
  "PLATFORM_TEAM_CREATED", "PLATFORM_TEAM_UPDATED",
  "PLATFORM_INITIAL_MANAGER_CREATED", "USER_PASSWORD_RESET",
  "PLATFORM_HOMOLOGATION_CHECKLIST_UPDATED",
  "PLATFORM_UNIT_CONFIGURATION_UPDATED", "PLATFORM_UNIT_RULES_UPDATED",
  "CITIZEN_PORTAL_UNIT_CONFIG_UPDATED",
]);

router.get("/platform/units/:unitId/audit-log", async (req, res) => {
  if (!hasCapability(req.user, "platform.audit.read")) return res.status(403).json({ error: "Sem permissão" });
  const { unitId } = req.params;
  const db = await readDb();
  ensureDbShape(db);
  const unit = (db.units || []).find((u) => u.id === unitId);
  if (!unit) return res.status(404).json({ error: "UBS não encontrada" });

  const since = req.query.since || null;
  const until = req.query.until || null;
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10) || 50));

  const logs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  const filtered = logs.filter((e) => {
    if (!PLATFORM_UNIT_AUDIT_ACTIONS.has(e.action)) return false;
    if (e.entityId !== unitId && e.details?.unitId !== unitId) return false;
    if (since && String(e.createdAt || "") < since) return false;
    if (until && String(e.createdAt || "") > until) return false;
    return true;
  });

  filtered.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const paged = filtered.slice(0, limit);

  const enriched = paged.map((e) => {
    const actor = e.userId ? (db.users || []).find((u) => u.id === e.userId) : null;
    return {
      id: e.id || "",
      action: e.action || "",
      entityId: e.entityId || "",
      userId: e.userId || "",
      userName: actor ? (actor.name || actor.email || e.userId) : (e.userId || "system"),
      details: e.details || {},
      createdAt: e.createdAt || "",
    };
  });

  return res.json({ entries: enriched, total: filtered.length, limit });
});

export default router;

