import { v4 as uuidv4 } from "uuid";
import express from "express";
import { readDb, withDb, pool, isPostgresMode } from "../db.js";
import { requireAuth, requireSupportAdmin } from "../middlewares/auth.js";
import { ensureDbShape } from "../utils/domain.js";
import { canonicalRole, hasCapability, isValidEmail, isPlatformRole } from "../utils/helpers.js";
import { hashPassword, generateTempPassword } from "../services/crypto.js";
import { generateVitrasId } from "../utils/vitras-id.js";
import { addAuditLog } from "../services/audit.js";
import {
  createLicense,
  updateLicense,
  changeLicenseStatus,
  renewLicense,
  createMunicipalCustomer,
  changeCustomerStatus,
  checkUnitLimit,
  getLicenseSummary,
  computeCurrentUnits,
  PLAN_TEMPLATES,
  CUSTOMER_STATUS,
  LICENSE_STATUS,
} from "../services/license.js";
import {
  createDeployment,
  advanceDeployment,
  pauseDeployment,
  resumeDeployment,
  cancelDeployment,
  suspendDeployment,
  updateChecklistItem,
  assignEngineer,
  getChecklistSummary,
  getMunicipalConsolidation,
} from "../services/deployment.js";

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
    // Legacy single-field address kept for backward compat
    address:          u.address          || "",
    // Structured address fields — must be included so TerritoryTab re-syncs correctly
    cep:              u.cep              || null,
    street:           u.street          || "",
    streetNumber:     u.streetNumber    || "",
    neighborhood:     u.neighborhood    || "",
    complement:       u.complement      || null,
    reference:        u.reference       || null,
    lat:              u.lat             ?? null,
    lng:              u.lng             ?? null,
    geocodingStatus:  u.geocodingStatus || "none",
    geocodedAt:       u.geocodedAt      || null,
    contactEmail:     u.contactEmail    || "",
    phone:            u.phone           || "",
    status:           VALID_STATUSES.includes(u.status) ? u.status : "draft",
    createdAt:        u.createdAt       || "",
    updatedAt:        u.updatedAt       || "",
    createdBy:        u.createdBy       || "",
    createdByName:    creator ? (creator.name || creator.email || "") : "system",
    activatedAt:      u.activatedAt     || "",
    suspendedAt:      u.suspendedAt     || "",
    enabledModules:   u.enabledModules  || [],
    configuration:    u.configuration   || {},
    operationalRules: u.operationalRules || {},
    ...stats
  };
}

// ── Municipality helpers ──────────────────────────────────────────────────────

/**
 * Query municipalities from Postgres.
 * Falls back to empty array in JSON-only test environments.
 */
async function queryMunicipalities({ search, uf, page = 1, limit = 50 }) {
  if (!isPostgresMode()) return { municipalities: [], total: 0, pages: 1 };
  const params = [];
  const conditions = ["active = true"];

  if (uf) {
    params.push(uf.toUpperCase());
    conditions.push(`uf = $${params.length}`);
  }
  if (search) {
    const term = `%${search.toLowerCase()}%`;
    params.push(term);
    conditions.push(`(LOWER(name) LIKE $${params.length} OR ibge_code LIKE $${params.length})`);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM municipalities ${where}`,
    params
  );
  const total = countResult.rows[0]?.total || 0;

  params.push(limit, offset);
  const result = await pool.query(
    `SELECT id, ibge_code, name, uf, region, is_capital, active, ibge_version, created_at, updated_at
     FROM municipalities ${where}
     ORDER BY name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const municipalities = result.rows.map(rowToMunicipality);
  return { municipalities, total, pages: Math.ceil(total / limit) || 1 };
}

function rowToMunicipality(row) {
  return {
    id:         row.id,
    ibgeCode:   row.ibge_code?.trim(),
    name:       row.name,
    uf:         row.uf?.trim(),
    region:     row.region || null,
    isCapital:  row.is_capital || false,
    active:     row.active !== false,
    ibgeVersion: row.ibge_version || null,
    createdAt:  row.created_at || null,
    updatedAt:  row.updated_at || null,
  };
}

async function findMunicipalityById(id) {
  if (!isPostgresMode()) return null;
  const { rows } = await pool.query(
    `SELECT id, ibge_code, name, uf, region, is_capital, active, ibge_version, created_at, updated_at
     FROM municipalities WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToMunicipality(rows[0]) : null;
}

async function findMunicipalityByIbge(ibgeCode) {
  if (!isPostgresMode()) return null;
  const { rows } = await pool.query(
    `SELECT id, ibge_code, name, uf, region, is_capital, active, ibge_version, created_at, updated_at
     FROM municipalities WHERE ibge_code = $1`,
    [String(ibgeCode).trim()]
  );
  return rows[0] ? rowToMunicipality(rows[0]) : null;
}

// ── GET /platform/municipalities ─────────────────────────────────────────────
// List municipalities from the IBGE reference dataset with search/filter.
// Support admin searches here to select a municipality when creating a UBS.

router.get("/platform/municipalities", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) {
    return res.status(403).json({ error: "Sem permissão" });
  }

  const search = String(req.query.search || "").trim();
  const uf     = String(req.query.uf || "").trim();
  const page   = Math.max(1, parseInt(req.query.page  || "1",  10) || 1);
  const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10) || 50));

  try {
    const result = await queryMunicipalities({ search, uf, page, limit });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar municípios" });
  }
});

// ── GET /platform/municipalities/:municipalityId ──────────────────────────────
// Municipality detail with units count.

router.get("/platform/municipalities/:municipalityId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) {
    return res.status(403).json({ error: "Sem permissão" });
  }

  const { municipalityId } = req.params;

  try {
    const municipality = await findMunicipalityById(municipalityId);
    if (!municipality) return res.status(404).json({ error: "Município não encontrado" });

    // Count units for this municipality (from JSON db)
    const db = await readDb();
    ensureDbShape(db);
    const units = (db.units || []).filter(
      (u) => u.municipalityId === municipality.ibgeCode
    );
    const unitsCount = units.length;
    const activeUnitsCount = units.filter((u) => u.status === "active").length;

    return res.json({ ...municipality, unitsCount, activeUnitsCount });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar município" });
  }
});

// ── GET /platform/summary ─────────────────────────────────────────────────────
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

  const search         = String(req.query.search  || "").trim().toLowerCase();
  const uf             = String(req.query.uf      || "").trim().toUpperCase();
  const status         = String(req.query.status  || "").trim();
  // municipalityId filter: accepts UUID (new internal ID) or IBGE code (legacy compat)
  const municipalityIdParam = String(req.query.municipalityId || "").trim();
  const sortBy  = ["name","cnes","status","createdAt","municipalityName"].includes(req.query.sortBy) ? req.query.sortBy : "name";
  const sortDir = req.query.sortDir === "desc" ? -1 : 1;
  const page    = Math.max(1, parseInt(req.query.page  || "1",  10) || 1);
  const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit || "25", 10) || 25));

  // Resolve municipalityId UUID → ibgeCode for filtering
  let ibgeCodeFilter = null;
  if (municipalityIdParam) {
    if (/^\d{7}$/.test(municipalityIdParam)) {
      ibgeCodeFilter = municipalityIdParam; // legacy: IBGE code supplied directly
    } else if (/^[0-9a-f-]{36}$/i.test(municipalityIdParam)) {
      const muni = await findMunicipalityById(municipalityIdParam).catch(() => null);
      if (!muni) return res.status(404).json({ error: "Município não encontrado" });
      ibgeCodeFilter = muni.ibgeCode;
    }
  }

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

  if (ibgeCodeFilter) {
    units = units.filter((u) => u.municipalityId === ibgeCodeFilter);
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

  // Validate municipality exists in reference dataset
  const muniRecord = await findMunicipalityByIbge(municipalityId).catch(() => null);
  if (isPostgresMode() && !muniRecord) {
    return res.status(422).json({ error: "Município não encontrado na base de dados. Selecione um município válido." });
  }
  // Sync denormalized fields from authoritative dataset when available
  const resolvedMunicipalityName = muniRecord?.name || municipalityName;
  const resolvedUf               = muniRecord?.uf   || uf;

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

    // ERP-04: check unit limit from active license
    if (!Array.isArray(db.licenses)) db.licenses = [];
    const activeLicense = db.licenses.find(
      l => l.municipalityId === municipalityId && l.status === LICENSE_STATUS.ACTIVE
    ) || null;
    const currentUnitCount = computeCurrentUnits(db, municipalityId);
    const limitCheck = checkUnitLimit({ license: activeLicense, currentUnitCount });
    if (!limitCheck.ok) return { error: limitCheck.message, statusCode: 422 };

    const unit = {
      id: uuidv4(),
      name,
      cnes,
      municipalityName: resolvedMunicipalityName,
      uf: resolvedUf,
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
      municipalityName: resolvedMunicipalityName,
      uf: resolvedUf,
      municipalityId,
      outcome: "success"
    });
    return { unit };
  });

  if (result?.error) return res.status(result.statusCode || 409).json({ error: result.error });
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
  // Return enriched unit (same shape as GET) so frontend can re-sync without a second request
  const db2 = await readDb();
  return res.json(enrichUnit(result.unit, db2));
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

// ══════════════════════════════════════════════════════════════════════════
// ERP-03 — Deployment Lifecycle
// ══════════════════════════════════════════════════════════════════════════

function deploymentOperator(user) {
  return { id: user.id, name: user.name, role: user.role };
}

function ensureDeployments(db) {
  ensureDbShape(db);
  if (!Array.isArray(db.deployments)) db.deployments = [];
}

function deploymentWithSummary(d) {
  return { ...d, checklistSummary: getChecklistSummary(d) };
}

// GET /platform/deployments
router.get("/platform/deployments", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const { municipalityId, type, status, page: pageRaw = "1", limit: limitRaw = "25" } = req.query;
  const page  = Math.max(1, parseInt(pageRaw, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 25));

  const db = await readDb();
  ensureDeployments(db);

  let list = db.deployments || [];
  if (municipalityId) list = list.filter(d => d.municipalityId === municipalityId);
  if (type)           list = list.filter(d => d.type === type.toUpperCase());
  if (status)         list = list.filter(d => d.status === status.toUpperCase());

  const total = list.length;
  const pages = Math.ceil(total / limit) || 1;
  const paged = list.slice((page - 1) * limit, page * limit).map(deploymentWithSummary);

  return res.json({ deployments: paged, total, pages });
});

// GET /platform/deployments/:deploymentId
router.get("/platform/deployments/:deploymentId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureDeployments(db);
  const dep = (db.deployments || []).find(d => d.id === req.params.deploymentId);
  if (!dep) return res.status(404).json({ error: "Implantação não encontrada" });

  // Consolidation for MUNICIPAL type
  let consolidation = null;
  if (dep.type === "MUNICIPAL") {
    const children = (db.deployments || []).filter(d => d.municipalityDeploymentId === dep.id);
    consolidation = getMunicipalConsolidation(dep, children);
  }

  return res.json({ ...deploymentWithSummary(dep), consolidation });
});

// POST /platform/deployments
router.post("/platform/deployments", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.create")) return res.status(403).json({ error: "Sem permissão" });

  const { type, municipalityId, municipalityDeploymentId, unitId, plannedGoLive, notes } = req.body || {};
  const operator = deploymentOperator(req.user);

  const result = await withDb((db) => {
    ensureDeployments(db);

    // Validate municipality exists
    if (isPostgresMode()) {
      // async validation happens outside withDb; skip here, validate via findMunicipalityByIbge if needed
    }

    // For UBS: parent must exist
    if (type === "UBS" && municipalityDeploymentId) {
      const parent = (db.deployments || []).find(d => d.id === municipalityDeploymentId && d.type === "MUNICIPAL");
      if (!parent) return { error: { status: 422, message: "Deployment municipal pai não encontrado" } };
    }

    let dep;
    try {
      dep = createDeployment({
        type,
        municipalityId,
        municipalityDeploymentId: municipalityDeploymentId || null,
        unitId: unitId || null,
        plannedGoLive: plannedGoLive || null,
        notes: notes || "",
        createdBy: operator,
        existingDeployments: db.deployments,
      });
    } catch (e) {
      return { error: { status: e.statusCode || 400, message: e.message } };
    }

    db.deployments.push(dep);

    addAuditLog(db, req.user, "deployment.created", "deployment", dep.id, {
      deploymentCode: dep.deploymentCode, type: dep.type, municipalityId, status: dep.status,
    });

    return { deployment: deploymentWithSummary(dep) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.deployment);
});

// PATCH /platform/deployments/:deploymentId — update notes/plannedGoLive
router.patch("/platform/deployments/:deploymentId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { notes, plannedGoLive, unitId } = req.body || {};
  const operator = deploymentOperator(req.user);

  const result = await withDb((db) => {
    ensureDeployments(db);
    const idx = (db.deployments || []).findIndex(d => d.id === req.params.deploymentId);
    if (idx < 0) return { error: { status: 404, message: "Implantação não encontrada" } };
    const dep = db.deployments[idx];

    if (notes !== undefined)       { dep.notes = String(notes || ""); }
    if (plannedGoLive !== undefined){ dep.plannedGoLive = plannedGoLive || null; }
    if (unitId !== undefined && dep.type === "UBS") { dep.unitId = unitId || null; }
    dep.updatedAt = new Date().toISOString();

    addAuditLog(db, req.user, "deployment.updated", "deployment", dep.id, { operator, fields: { notes, plannedGoLive, unitId } });
    return { deployment: deploymentWithSummary(dep) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.deployment);
});

// POST /platform/deployments/:deploymentId/advance — advance to next status
router.post("/platform/deployments/:deploymentId/advance", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { toStatus, reason } = req.body || {};
  if (!toStatus) return res.status(400).json({ error: "toStatus obrigatório" });
  const operator = deploymentOperator(req.user);

  const result = await withDb((db) => {
    ensureDeployments(db);
    const idx = (db.deployments || []).findIndex(d => d.id === req.params.deploymentId);
    if (idx < 0) return { error: { status: 404, message: "Implantação não encontrada" } };
    try {
      advanceDeployment(db.deployments[idx], { toStatus, operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "deployment.status_changed", "deployment", db.deployments[idx].id, {
      toStatus, reason, deploymentCode: db.deployments[idx].deploymentCode,
    });
    return { deployment: deploymentWithSummary(db.deployments[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.deployment);
});

// POST /platform/deployments/:deploymentId/pause
router.post("/platform/deployments/:deploymentId/pause", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { reason } = req.body || {};
  const operator = deploymentOperator(req.user);

  const result = await withDb((db) => {
    ensureDeployments(db);
    const idx = (db.deployments || []).findIndex(d => d.id === req.params.deploymentId);
    if (idx < 0) return { error: { status: 404, message: "Implantação não encontrada" } };
    try {
      pauseDeployment(db.deployments[idx], { operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "deployment.paused", "deployment", db.deployments[idx].id, { reason });
    return { deployment: deploymentWithSummary(db.deployments[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.deployment);
});

// POST /platform/deployments/:deploymentId/resume
router.post("/platform/deployments/:deploymentId/resume", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { reason } = req.body || {};
  const operator = deploymentOperator(req.user);

  const result = await withDb((db) => {
    ensureDeployments(db);
    const idx = (db.deployments || []).findIndex(d => d.id === req.params.deploymentId);
    if (idx < 0) return { error: { status: 404, message: "Implantação não encontrada" } };
    try {
      resumeDeployment(db.deployments[idx], { operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "deployment.resumed", "deployment", db.deployments[idx].id, { reason });
    return { deployment: deploymentWithSummary(db.deployments[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.deployment);
});

// POST /platform/deployments/:deploymentId/cancel
router.post("/platform/deployments/:deploymentId/cancel", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { reason } = req.body || {};
  const operator = deploymentOperator(req.user);

  const result = await withDb((db) => {
    ensureDeployments(db);
    const idx = (db.deployments || []).findIndex(d => d.id === req.params.deploymentId);
    if (idx < 0) return { error: { status: 404, message: "Implantação não encontrada" } };
    try {
      cancelDeployment(db.deployments[idx], { operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "deployment.cancelled", "deployment", db.deployments[idx].id, { reason });
    return { deployment: deploymentWithSummary(db.deployments[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.deployment);
});

// POST /platform/deployments/:deploymentId/suspend
router.post("/platform/deployments/:deploymentId/suspend", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { reason } = req.body || {};
  const operator = deploymentOperator(req.user);

  const result = await withDb((db) => {
    ensureDeployments(db);
    const idx = (db.deployments || []).findIndex(d => d.id === req.params.deploymentId);
    if (idx < 0) return { error: { status: 404, message: "Implantação não encontrada" } };
    try {
      suspendDeployment(db.deployments[idx], { operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "deployment.suspended", "deployment", db.deployments[idx].id, { reason });
    return { deployment: deploymentWithSummary(db.deployments[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.deployment);
});

// PATCH /platform/deployments/:deploymentId/checklist/:itemId
router.patch("/platform/deployments/:deploymentId/checklist/:itemId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { done, observation } = req.body || {};
  const operator = deploymentOperator(req.user);

  const result = await withDb((db) => {
    ensureDeployments(db);
    const idx = (db.deployments || []).findIndex(d => d.id === req.params.deploymentId);
    if (idx < 0) return { error: { status: 404, message: "Implantação não encontrada" } };
    try {
      updateChecklistItem(db.deployments[idx], {
        itemId: req.params.itemId,
        done: Boolean(done),
        observation,
        operator: { id: req.user.id, name: req.user.name },
      });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "deployment.checklist_updated", "deployment", db.deployments[idx].id, {
      itemId: req.params.itemId, done,
    });
    return { deployment: deploymentWithSummary(db.deployments[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.deployment);
});

// POST /platform/deployments/:deploymentId/assign
router.post("/platform/deployments/:deploymentId/assign", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { engineer } = req.body || {};
  const operator = deploymentOperator(req.user);

  const result = await withDb((db) => {
    ensureDeployments(db);
    const idx = (db.deployments || []).findIndex(d => d.id === req.params.deploymentId);
    if (idx < 0) return { error: { status: 404, message: "Implantação não encontrada" } };
    assignEngineer(db.deployments[idx], { engineer: engineer || null, operator });
    addAuditLog(db, req.user, "deployment.engineer_assigned", "deployment", db.deployments[idx].id, { engineer });
    return { deployment: deploymentWithSummary(db.deployments[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.deployment);
});

// ══════════════════════════════════════════════════════════════════════════
// ERP-04 — Licensing and Customer Lifecycle
// ══════════════════════════════════════════════════════════════════════════

function ensureLicenses(db) {
  ensureDbShape(db);
  if (!Array.isArray(db.licenses)) db.licenses = [];
  if (!Array.isArray(db.municipalCustomers)) db.municipalCustomers = [];
}

function licenseOperator(user) {
  return { id: user.id, name: user.name, role: user.role };
}

function licenseSummaryEnrich(license, db) {
  const s = getLicenseSummary(license, db);
  return { ...license, currentUnits: s.currentUnits, currentUsers: s.currentUsers, isExpired: s.isExpired, daysToExpiry: s.daysToExpiry };
}

// GET /platform/licenses
router.get("/platform/licenses", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const { municipalityId, status, page: pageRaw = "1", limit: limitRaw = "25" } = req.query;
  const page  = Math.max(1, parseInt(pageRaw, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 25));

  const db = await readDb();
  ensureLicenses(db);

  let list = db.licenses || [];
  if (municipalityId) list = list.filter(l => l.municipalityId === municipalityId);
  if (status)         list = list.filter(l => l.status === status.toUpperCase());

  const total = list.length;
  const pages = Math.ceil(total / limit) || 1;
  const paged = list.slice((page - 1) * limit, page * limit).map(l => licenseSummaryEnrich(l, db));

  return res.json({ licenses: paged, total, pages });
});

// GET /platform/licenses/:licenseId
router.get("/platform/licenses/:licenseId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureLicenses(db);
  const lic = (db.licenses || []).find(l => l.id === req.params.licenseId);
  if (!lic) return res.status(404).json({ error: "Licença não encontrada" });
  return res.json(licenseSummaryEnrich(lic, db));
});

// POST /platform/licenses
router.post("/platform/licenses", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.create")) return res.status(403).json({ error: "Sem permissão" });

  const { municipalityId, plan, contractNumber, contractStart, contractEnd, renewalDate, limits, features, notes } = req.body || {};
  const operator = licenseOperator(req.user);

  const result = await withDb((db) => {
    ensureLicenses(db);
    let lic;
    try {
      lic = createLicense({
        municipalityId, plan, contractNumber, contractStart, contractEnd,
        renewalDate, limits: limits || {}, features: features || [],
        notes, operator, existingLicenses: db.licenses,
      });
    } catch (e) {
      return { error: { status: e.statusCode || 400, message: e.message } };
    }
    db.licenses.push(lic);
    addAuditLog(db, req.user, "license.created", "license", lic.id, {
      licenseCode: lic.licenseCode, municipalityId, plan: lic.plan,
    });
    return { license: licenseSummaryEnrich(lic, db) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.license);
});

// PATCH /platform/licenses/:licenseId — update editable fields
router.patch("/platform/licenses/:licenseId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { reason, ...patch } = req.body || {};
  const operator = licenseOperator(req.user);

  const result = await withDb((db) => {
    ensureLicenses(db);
    const idx = (db.licenses || []).findIndex(l => l.id === req.params.licenseId);
    if (idx < 0) return { error: { status: 404, message: "Licença não encontrada" } };
    try {
      updateLicense(db.licenses[idx], { patch, operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "license.updated", "license", db.licenses[idx].id, { patch, reason });
    return { license: licenseSummaryEnrich(db.licenses[idx], db) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.license);
});

// POST /platform/licenses/:licenseId/status — change license status
router.post("/platform/licenses/:licenseId/status", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { toStatus, reason } = req.body || {};
  if (!toStatus) return res.status(400).json({ error: "toStatus obrigatório" });
  const operator = licenseOperator(req.user);

  const result = await withDb((db) => {
    ensureLicenses(db);
    const idx = (db.licenses || []).findIndex(l => l.id === req.params.licenseId);
    if (idx < 0) return { error: { status: 404, message: "Licença não encontrada" } };
    try {
      changeLicenseStatus(db.licenses[idx], { toStatus, operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "license.status_changed", "license", db.licenses[idx].id, { toStatus, reason });
    return { license: licenseSummaryEnrich(db.licenses[idx], db) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.license);
});

// POST /platform/licenses/:licenseId/renew
router.post("/platform/licenses/:licenseId/renew", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { newContractEnd, newRenewalDate, reason } = req.body || {};
  const operator = licenseOperator(req.user);

  const result = await withDb((db) => {
    ensureLicenses(db);
    const idx = (db.licenses || []).findIndex(l => l.id === req.params.licenseId);
    if (idx < 0) return { error: { status: 404, message: "Licença não encontrada" } };
    try {
      renewLicense(db.licenses[idx], { newContractEnd, newRenewalDate, operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "license.renewed", "license", db.licenses[idx].id, { newContractEnd, newRenewalDate, reason });
    return { license: licenseSummaryEnrich(db.licenses[idx], db) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.license);
});

// GET /platform/plan-templates — expose plan templates to UI
router.get("/platform/plan-templates", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });
  return res.json({ templates: PLAN_TEMPLATES });
});

// ── Customer lifecycle ─────────────────────────────────────────────────────

// GET /platform/customers
router.get("/platform/customers", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const { municipalityId, customerStatus } = req.query;
  const db = await readDb();
  ensureLicenses(db);

  let list = db.municipalCustomers || [];
  if (municipalityId)  list = list.filter(c => c.municipalityId === municipalityId);
  if (customerStatus)  list = list.filter(c => c.customerStatus === customerStatus.toUpperCase());
  return res.json({ customers: list, total: list.length });
});

// GET /platform/customers/:customerId
router.get("/platform/customers/:customerId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureLicenses(db);
  const c = (db.municipalCustomers || []).find(c => c.id === req.params.customerId);
  if (!c) return res.status(404).json({ error: "Cliente não encontrado" });
  return res.json(c);
});

// POST /platform/customers
router.post("/platform/customers", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.create")) return res.status(403).json({ error: "Sem permissão" });

  const { municipalityId } = req.body || {};
  const operator = licenseOperator(req.user);

  const result = await withDb((db) => {
    ensureLicenses(db);
    if ((db.municipalCustomers || []).some(c => c.municipalityId === municipalityId)) {
      return { error: { status: 409, message: "Município já possui registro de cliente" } };
    }
    let customer;
    try {
      customer = createMunicipalCustomer({ municipalityId, operator });
    } catch (e) {
      return { error: { status: e.statusCode || 400, message: e.message } };
    }
    if (!Array.isArray(db.municipalCustomers)) db.municipalCustomers = [];
    db.municipalCustomers.push(customer);
    addAuditLog(db, req.user, "customer.created", "customer", customer.id, { municipalityId });
    return { customer };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.customer);
});

// POST /platform/customers/:customerId/status
router.post("/platform/customers/:customerId/status", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { toStatus, reason } = req.body || {};
  if (!toStatus) return res.status(400).json({ error: "toStatus obrigatório" });
  const operator = licenseOperator(req.user);

  const result = await withDb((db) => {
    ensureLicenses(db);
    const idx = (db.municipalCustomers || []).findIndex(c => c.id === req.params.customerId);
    if (idx < 0) return { error: { status: 404, message: "Cliente não encontrado" } };
    try {
      changeCustomerStatus(db.municipalCustomers[idx], { toStatus, operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "customer.status_changed", "customer", db.municipalCustomers[idx].id, { toStatus, reason });
    return { customer: db.municipalCustomers[idx] };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.customer);
});

// GET /platform/licenses-dashboard
router.get("/platform/licenses-dashboard", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureLicenses(db);
  const licenses   = db.licenses || [];
  const customers  = db.municipalCustomers || [];
  const today      = new Date();
  const in30Days   = new Date(today.getTime() + 30 * 86400000);

  const count = (arr, pred) => arr.filter(pred).length;

  return res.json({
    licenses: {
      total:      licenses.length,
      draft:      count(licenses, l => l.status === "DRAFT"),
      active:     count(licenses, l => l.status === "ACTIVE"),
      suspended:  count(licenses, l => l.status === "SUSPENDED"),
      expired:    count(licenses, l => l.status === "EXPIRED"),
      terminated: count(licenses, l => l.status === "TERMINATED"),
      expiringIn30Days: count(licenses, l => l.status === "ACTIVE" && l.contractEnd
        && new Date(l.contractEnd) >= today && new Date(l.contractEnd) <= in30Days),
    },
    customers: {
      total:         customers.length,
      lead:          count(customers, c => c.customerStatus === "LEAD"),
      active:        count(customers, c => c.customerStatus === "ACTIVE"),
      implementation:count(customers, c => c.customerStatus === "IMPLEMENTATION"),
      suspended:     count(customers, c => c.customerStatus === "SUSPENDED"),
      terminated:    count(customers, c => c.customerStatus === "TERMINATED"),
    },
  });
});

// GET /platform/deployments-dashboard — summary cards
router.get("/platform/deployments-dashboard", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureDeployments(db);
  const all = db.deployments || [];

  const count = (status) => all.filter(d => d.status === status).length;
  return res.json({
    planned:         count("PLANNED"),
    configuring:     count("CONFIGURING"),
    migrating:       count("MIGRATING"),
    validating:      count("VALIDATING"),
    training:        count("TRAINING"),
    readyForGoLive:  count("READY_FOR_GO_LIVE"),
    goLive:          count("GO_LIVE"),
    operational:     count("OPERATIONAL"),
    paused:          count("PAUSED"),
    suspended:       count("SUSPENDED"),
    cancelled:       count("CANCELLED"),
    total:           all.length,
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ERP-05 — Support Operations and Incident Management
// ══════════════════════════════════════════════════════════════════════════

import {
  createIncident, changeIncidentStatus, changeIncidentSeverity,
  assignIncident, addComment, updateIncident,
  getIncidentWithSla, generateIncidentCode,
  INCIDENT_CATEGORIES, SEVERITY, INCIDENT_STATUS,
} from "../services/incident.js";

function ensureIncidents(db) {
  ensureDbShape(db);
  if (!Array.isArray(db.incidents)) db.incidents = [];
}

function incidentOperator(user) {
  return { id: user.id, name: user.name, role: user.role };
}

// ── Search / filter helper ─────────────────────────────────────────────────

function filterIncidents(incidents, q) {
  const {
    status, severity, category, municipalityId, unitId, deploymentId,
    licenseId, breakGlassSessionId, assignedToId, search,
  } = q;

  let list = incidents;
  if (status)              list = list.filter(i => i.status === status.toUpperCase());
  if (severity)            list = list.filter(i => i.severity === severity.toUpperCase());
  if (category)            list = list.filter(i => i.category === category.toUpperCase());
  if (municipalityId)      list = list.filter(i => i.municipalityId === municipalityId);
  if (unitId)              list = list.filter(i => i.unitId === unitId);
  if (deploymentId)        list = list.filter(i => i.deploymentId === deploymentId);
  if (licenseId)           list = list.filter(i => i.licenseId === licenseId);
  if (breakGlassSessionId) list = list.filter(i => i.breakGlassSessionId === breakGlassSessionId);
  if (assignedToId)        list = list.filter(i => i.assignedTo?.id === assignedToId);

  if (search) {
    const q2 = search.toLowerCase();
    list = list.filter(i =>
      (i.incidentCode || "").toLowerCase().includes(q2) ||
      (i.title        || "").toLowerCase().includes(q2) ||
      (i.description  || "").toLowerCase().includes(q2) ||
      (i.tags         || []).some(t => t.toLowerCase().includes(q2))
    );
  }

  // Sort: priority asc (CRITICAL first), then createdAt desc
  return list.slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

// GET /platform/incidents
router.get("/platform/incidents", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const { page: pageRaw = "1", limit: limitRaw = "25", ...filters } = req.query;
  const page  = Math.max(1, parseInt(pageRaw, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 25));

  const db    = await readDb();
  ensureIncidents(db);

  const sorted = filterIncidents(db.incidents, filters);
  const total  = sorted.length;
  const pages  = Math.ceil(total / limit) || 1;
  const paged  = sorted.slice((page - 1) * limit, page * limit).map(getIncidentWithSla);

  return res.json({ incidents: paged, total, pages });
});

// GET /platform/incidents/:incidentId
router.get("/platform/incidents/:incidentId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureIncidents(db);
  const inc = db.incidents.find(i => i.id === req.params.incidentId);
  if (!inc) return res.status(404).json({ error: "Incidente não encontrado" });
  return res.json(getIncidentWithSla(inc));
});

// POST /platform/incidents
router.post("/platform/incidents", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.create")) return res.status(403).json({ error: "Sem permissão" });

  const {
    title, description, category, severity,
    municipalityId, unitId, deploymentId, licenseId, breakGlassSessionId,
    tags,
  } = req.body || {};
  const operator = incidentOperator(req.user);

  const result = await withDb((db) => {
    ensureIncidents(db);
    let inc;
    try {
      inc = createIncident({
        title, description, category, severity,
        municipalityId, unitId, deploymentId, licenseId, breakGlassSessionId,
        tags, operator, existingIncidents: db.incidents,
      });
    } catch (e) {
      return { error: { status: e.statusCode || 400, message: e.message } };
    }
    db.incidents.push(inc);
    addAuditLog(db, req.user, "incident.created", "incident", inc.id, {
      incidentCode: inc.incidentCode, title: inc.title, category, severity,
    });
    return { incident: getIncidentWithSla(inc) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.incident);
});

// PATCH /platform/incidents/:incidentId — update editable fields
router.patch("/platform/incidents/:incidentId", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { reason, ...patch } = req.body || {};
  const operator = incidentOperator(req.user);

  const result = await withDb((db) => {
    ensureIncidents(db);
    const idx = db.incidents.findIndex(i => i.id === req.params.incidentId);
    if (idx < 0) return { error: { status: 404, message: "Incidente não encontrado" } };
    try {
      updateIncident(db.incidents[idx], { patch, operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "incident.updated", "incident", db.incidents[idx].id, { patch, reason });
    return { incident: getIncidentWithSla(db.incidents[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.incident);
});

// PATCH /platform/incidents/:incidentId/assign
router.patch("/platform/incidents/:incidentId/assign", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { assigneeId, assigneeName, reason } = req.body || {};
  const operator = incidentOperator(req.user);

  const result = await withDb((db) => {
    ensureIncidents(db);
    const idx = db.incidents.findIndex(i => i.id === req.params.incidentId);
    if (idx < 0) return { error: { status: 404, message: "Incidente não encontrado" } };
    const assignee = assigneeId ? { id: assigneeId, name: assigneeName || assigneeId } : null;
    assignIncident(db.incidents[idx], { assignee, operator, reason: reason || null });
    addAuditLog(db, req.user, "incident.assigned", "incident", db.incidents[idx].id, { assigneeId, reason });
    return { incident: getIncidentWithSla(db.incidents[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.incident);
});

// PATCH /platform/incidents/:incidentId/severity
router.patch("/platform/incidents/:incidentId/severity", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { toSeverity, reason } = req.body || {};
  if (!toSeverity) return res.status(400).json({ error: "toSeverity obrigatório" });
  const operator = incidentOperator(req.user);

  const result = await withDb((db) => {
    ensureIncidents(db);
    const idx = db.incidents.findIndex(i => i.id === req.params.incidentId);
    if (idx < 0) return { error: { status: 404, message: "Incidente não encontrado" } };
    try {
      changeIncidentSeverity(db.incidents[idx], { toSeverity, operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "incident.severity_changed", "incident", db.incidents[idx].id, { toSeverity, reason });
    return { incident: getIncidentWithSla(db.incidents[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.incident);
});

// PATCH /platform/incidents/:incidentId/status
router.patch("/platform/incidents/:incidentId/status", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { toStatus, reason, rootCause, resolution } = req.body || {};
  if (!toStatus) return res.status(400).json({ error: "toStatus obrigatório" });
  const operator = incidentOperator(req.user);

  const result = await withDb((db) => {
    ensureIncidents(db);
    const idx = db.incidents.findIndex(i => i.id === req.params.incidentId);
    if (idx < 0) return { error: { status: 404, message: "Incidente não encontrado" } };
    try {
      changeIncidentStatus(db.incidents[idx], { toStatus, operator, reason: reason || null, rootCause, resolution });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "incident.status_changed", "incident", db.incidents[idx].id, { toStatus, reason });
    return { incident: getIncidentWithSla(db.incidents[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.incident);
});

// POST /platform/incidents/:incidentId/comment
router.post("/platform/incidents/:incidentId/comment", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { text } = req.body || {};
  const operator = incidentOperator(req.user);

  const result = await withDb((db) => {
    ensureIncidents(db);
    const idx = db.incidents.findIndex(i => i.id === req.params.incidentId);
    if (idx < 0) return { error: { status: 404, message: "Incidente não encontrado" } };
    try {
      addComment(db.incidents[idx], { text, operator });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    return { incident: getIncidentWithSla(db.incidents[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.incident);
});

// POST /platform/incidents/:incidentId/close  (shortcut: status→CLOSED)
router.post("/platform/incidents/:incidentId/close", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { reason } = req.body || {};
  const operator   = incidentOperator(req.user);

  const result = await withDb((db) => {
    ensureIncidents(db);
    const idx = db.incidents.findIndex(i => i.id === req.params.incidentId);
    if (idx < 0) return { error: { status: 404, message: "Incidente não encontrado" } };
    try {
      changeIncidentStatus(db.incidents[idx], { toStatus: INCIDENT_STATUS.CLOSED, operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "incident.closed", "incident", db.incidents[idx].id, { reason });
    return { incident: getIncidentWithSla(db.incidents[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.incident);
});

// POST /platform/incidents/:incidentId/reopen  (shortcut: status→REOPENED)
router.post("/platform/incidents/:incidentId/reopen", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.update")) return res.status(403).json({ error: "Sem permissão" });

  const { reason } = req.body || {};
  const operator   = incidentOperator(req.user);

  const result = await withDb((db) => {
    ensureIncidents(db);
    const idx = db.incidents.findIndex(i => i.id === req.params.incidentId);
    if (idx < 0) return { error: { status: 404, message: "Incidente não encontrado" } };
    try {
      changeIncidentStatus(db.incidents[idx], { toStatus: INCIDENT_STATUS.REOPENED, operator, reason: reason || null });
    } catch (e) {
      return { error: { status: e.statusCode || 422, message: e.message } };
    }
    addAuditLog(db, req.user, "incident.reopened", "incident", db.incidents[idx].id, { reason });
    return { incident: getIncidentWithSla(db.incidents[idx]) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.incident);
});

// GET /platform/incidents-dashboard
router.get("/platform/incidents-dashboard", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });

  const db  = await readDb();
  ensureIncidents(db);
  const inc = db.incidents || [];

  const today  = new Date().toDateString();
  const cnt    = (pred) => inc.filter(pred).length;
  const avg    = (arr)  => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

  const resolutionTimes = inc
    .filter(i => i.resolvedAt)
    .map(i => Math.round((new Date(i.resolvedAt) - new Date(i.createdAt)) / 60000));

  const byCat = {};
  for (const cat of INCIDENT_CATEGORIES) {
    const n = cnt(i => i.category === cat);
    if (n > 0) byCat[cat] = n;
  }
  const bySev = {};
  for (const sev of Object.keys(SEVERITY)) {
    bySev[sev] = cnt(i => i.severity === sev);
  }

  const affectedMunicipalities = [...new Set(inc.filter(i => i.municipalityId && i.status !== "CLOSED" && i.status !== "CANCELLED").map(i => i.municipalityId))];
  const affectedDeployments    = [...new Set(inc.filter(i => i.deploymentId   && i.status !== "CLOSED" && i.status !== "CANCELLED").map(i => i.deploymentId))];

  return res.json({
    summary: {
      total:           inc.length,
      new:             cnt(i => i.status === "NEW"),
      triaged:         cnt(i => i.status === "TRIAGED"),
      inProgress:      cnt(i => i.status === "IN_PROGRESS"),
      waiting:         cnt(i => i.status === "WAITING"),
      critical:        cnt(i => i.severity === "CRITICAL" && !["CLOSED","CANCELLED"].includes(i.status)),
      resolvedToday:   cnt(i => i.resolvedAt && new Date(i.resolvedAt).toDateString() === today),
      closedToday:     cnt(i => i.closedAt   && new Date(i.closedAt).toDateString()   === today),
      avgResolutionMinutes: avg(resolutionTimes),
    },
    byCategory: byCat,
    bySeverity: bySev,
    affectedMunicipalities: affectedMunicipalities.length,
    affectedDeployments:    affectedDeployments.length,
  });
});

// GET /platform/incident-categories — expose categories to UI
router.get("/platform/incident-categories", async (req, res) => {
  if (!hasCapability(req.user, "platform.unit.read")) return res.status(403).json({ error: "Sem permissão" });
  return res.json({ categories: INCIDENT_CATEGORIES, severities: Object.keys(SEVERITY) });
});

export default router;

