import crypto from "node:crypto";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { pool, readDb, withDb, listPatientsSnapshot, findPatientByIdSnapshot, listAppointmentsByPatientId } from "../db.js";
import {
  validate,
  PatientCreateSchema,
  PatientUpdateSchema,
  AppointmentCreateSchema,
  RecordCreateSchema,
  VisitCreateSchema,
  CriticalActionReasonSchema
} from "../schemas.js";
import { requireManagerOrDoctor } from "../middlewares/auth.js";
import {
  ensureDbShape, getProtocolTemplateMap, normalizeCategory, normalizeChronicConditions
} from "../utils/domain.js";
import { syncPatientFamilyGroup } from "../utils/family-groups.js";
import {
  isManager, isDoctor, isAcs, hasCapability, normalizeDemandType, canonicalRole,
  detectConsultationSpecialtyFromTitle, normalizeConsultationTitle
} from "../utils/helpers.js";
import {
  getAllowedPatients, canAccessPatient, getPatientOrError, buildPatientHistory, maskSensitivePatientFields, buildReceptionistPatientSummary
} from "../utils/patients.js";
import { buildProtocolSummary, restrictSummaryAlertsForForeignTeam } from "../utils/protocol-eval.js";
import { validateClinicalRecordPayload, buildMonthlyDemandMetric, buildDataQualityMetric } from "../utils/metrics.js";
import { addAuditLog } from "../services/audit.js";
import { sensitiveDataRateLimit } from "../middlewares/rate-limits.js";
import { MUNICIPALITY_ID } from "../config.js";

const CLINICAL_PRESCRIBER_ROLES = new Set(["doctor", "dentist"]);
const DOCTOR_ONLY_TYPES = new Set(["prescription", "medical_attest"]);

// F5-01: Household fields — extracted from patient payload; persisted in db.households
const HOUSEHOLD_FIELDS = ["housingType", "waterSupply", "sewage", "garbage", "electricity", "homeVisitFreq", "familyCode"];

function extractHouseholdFields(payload) {
  const household = {};
  for (const field of HOUSEHOLD_FIELDS) {
    if (payload[field] !== undefined) household[field] = payload[field];
  }
  return household;
}

// F5-04: actor param accepts full user object so audit log can record who triggered the upsert
function upsertHousehold(db, patientId, teamId, householdPayload, actor) {
  if (!Object.keys(householdPayload).length) return;
  const now = new Date().toISOString();
  const existing = db.households.findIndex((h) => h.patientId === patientId);
  if (existing >= 0) {
    const current = db.households[existing];
    const next = {
      ...current,
      ...Object.fromEntries(
        Object.entries(householdPayload).map(([k, v]) => [k, String(v || "").trim()])
      ),
      updatedAt: now
    };
    db.households[existing] = next;
    // F5-04: audit — household updated via PATCH /patients/:id internal extraction
    addAuditLog(db, actor, "household.updated", "household", current.id, {
      patientId,
      teamId: current.teamId || "",
      changedFields: Object.keys(householdPayload),
      outcome: "success",
      before: { ...current },
      after: { ...next }
    });
  } else {
    const household = {
      id: uuidv4(),
      patientId,
      teamId: String(teamId || ""),
      familyCode: String(householdPayload.familyCode || "").trim(),
      housingType: String(householdPayload.housingType || householdPayload.tipoImovel || "").trim(),
      waterSupply: String(householdPayload.waterSupply || "").trim(),
      sewage: String(householdPayload.sewage || "").trim(),
      garbage: String(householdPayload.garbage || "").trim(),
      electricity: String(householdPayload.electricity || "").trim(),
      homeVisitFreq: String(householdPayload.homeVisitFreq || "").trim(),
      createdAt: now,
      updatedAt: now
    };
    db.households.push(household);
    // F5-04: audit — household created via PATCH /patients/:id internal extraction
    addAuditLog(db, actor, "household.created", "household", household.id, {
      patientId,
      teamId: household.teamId,
      outcome: "success",
      after: { ...household }
    });
  }
}
// F7-03: gestor role does not receive SPECIAL_CATEGORY fields (LGPD Art. 11 — not a clinical professional)
function filterGestorSpecialCategory(patient, user) {
  if (canonicalRole(user?.role) !== "gestor") return patient;
  // Sprint 5B Grupo A: situacaoRua + deficiencia; C14: hivGestante + sifilis — all SPECIAL_CATEGORY LGPD Art. 11
  const { racaCor: _rc, etnia: _et, genderIdentity: _gi, situacaoRua: _sr, deficiencia: _def, hivGestante: _hg, sifilis: _sif, ...rest } = patient;
  return rest;
}

// F2-05: roles authorized to receive cnsResponsavel in API responses
const CNS_RESPONSAVEL_AUTHORIZED_ROLES = new Set(["doctor", "nurse_manager", "dentist", "nursing_tech", "break_glass_admin"]);

function filterCnsResponsavel(patient, user) {
  if (!patient) return patient;
  const role = canonicalRole(user?.role);
  if (CNS_RESPONSAVEL_AUTHORIZED_ROLES.has(role)) return patient;
  const { cnsResponsavel: _removed, ...rest } = patient;
  return rest;
}

// Grupo F — NIS: roles autorizados a receber o NIS nas respostas da API
// gestor e receptionist NÃO recebem NIS (dado pessoal sem relação com acesso clínico)
const NIS_AUTHORIZED_ROLES = new Set(["acs", "doctor", "nurse_manager", "dentist", "nursing_tech", "admin"]);

function filterNis(patient, user) {
  if (!patient) return patient;
  const role = canonicalRole(user?.role);
  if (NIS_AUTHORIZED_ROLES.has(role)) return patient;
  const { nis: _removed, ...rest } = patient;
  return rest;
}

const router = express.Router();

// CID-10: busca por código ou texto — rota declarada ANTES das rotas parametrizadas /:id
// Autenticação garantida pelo requireAuth global em app.js (linha 58, antes do patientsRouter)
router.get("/cid10/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Parâmetro q obrigatório" });

  const rawLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;

  // Modo arquivo (dev/test): pool não existe
  if (!pool) {
    return res.json({ results: [], total: 0 });
  }

  try {
    let result;
    // Detecta se q parece ser um código CID (letra seguida de dígito)
    if (/^[A-Za-z]\d/i.test(q)) {
      result = await pool.query(
        `SELECT code, description, chapter, is_billable
           FROM cid10
          WHERE code ILIKE $1 AND active = true
          ORDER BY code
          LIMIT $2`,
        [q.toUpperCase() + "%", limit]
      );
    } else {
      result = await pool.query(
        `SELECT code, description, chapter, is_billable
           FROM cid10
          WHERE to_tsvector('portuguese', description) @@ plainto_tsquery('portuguese', $1)
            AND active = true
          ORDER BY ts_rank(to_tsvector('portuguese', description), plainto_tsquery('portuguese', $1)) DESC
          LIMIT $2`,
        [q, limit]
      );
    }
    return res.json({ results: result.rows, total: result.rows.length });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar CID-10" });
  }
});

// CIAP-2: busca por código ou texto — rota declarada ANTES das rotas parametrizadas /:id
router.get("/ciap2/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Parâmetro q obrigatório" });

  const rawLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;

  if (!pool) {
    return res.json({ results: [], total: 0 });
  }

  try {
    let result;
    if (/^[A-Za-z]\d/i.test(q)) {
      result = await pool.query(
        `SELECT code, description, chapter, chapter_name, component
           FROM ciap2
          WHERE code ILIKE $1
          ORDER BY code
          LIMIT $2`,
        [q.toUpperCase() + "%", limit]
      );
    } else {
      result = await pool.query(
        `SELECT code, description, chapter, chapter_name, component
           FROM ciap2
          WHERE to_tsvector('portuguese', description) @@ plainto_tsquery('portuguese', $1)
          ORDER BY ts_rank(to_tsvector('portuguese', description), plainto_tsquery('portuguese', $1)) DESC
          LIMIT $2`,
        [q, limit]
      );
    }
    return res.json({ results: result.rows, total: result.rows.length });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar CIAP-2" });
  }
});

// F7-01: SHA-256 hash for SENSITIVE identifiers in audit snapshots — value never stored in clear
function sha256Hex(val) {
  if (!val) return "";
  return crypto.createHash("sha256").update(String(val)).digest("hex");
}

function buildPatientAuditSnapshot(patient) {
  if (!patient) return null;
  return {
    id: String(patient.id || ""),
    teamId: String(patient.teamId || ""),
    name: String(patient.name || ""),
    assignedAcsId: String(patient.assignedAcsId || ""),
    careCategory: String(patient.careCategory || ""),
    chronicConditions: Array.isArray(patient.chronicConditions) ? [...patient.chronicConditions] : [],
    incompleteProfile: Boolean(patient.incompleteProfile),
    inactive: Boolean(patient.inactive),
    inactivationReason: String(patient.inactivationReason || ""),
    birthDate: String(patient.birthDate || ""),
    updatedAt: String(patient.updatedAt || patient.createdAt || ""),
    // F7-01: SENSITIVE identifiers — SHA-256 hash only, never plaintext
    cpf: sha256Hex(patient.cpf),
    cns: sha256Hex(patient.cns),
    // F7-01: phone — last 4 digits masked
    phone: patient.phone ? String(patient.phone).replace(/\d{4}$/, "****") : "",
    // F5-02: SPECIAL_CATEGORY fields included so audit.js can apply [REDACTED-SPECIAL-CATEGORY]
    genderIdentity: patient.genderIdentity || "",
    racaCor: patient.racaCor || "",
    etnia: patient.etnia || ""
  };
}

async function logPatientRead(req, patient, action, details = {}) {
  if (!patient?.id) return;
  await withDb((db) => {
    ensureDbShape(db);
    addAuditLog(db, req.user, action, "patient", patient.id, {
      patientId: patient.id,
      teamId: patient.teamId,
      patientName: patient.name,
      careCategory: patient.careCategory,
      outcome: "success",
      ...details
    });
  });
}

// F6-03: fire-and-forget audit for patient access denied — mirrors chart.access_denied pattern
function auditPatientAccessDenied(actor, patientId, reason) {
  withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    addAuditLog(mutableDb, actor, "patient.access_denied", "patient", String(patientId), {
      outcome: "denied",
      reason,
      actorRole: String(actor?.role || "")
    });
  }).catch(() => {});
}

function hasSameTeamPatientAccess(user, patient, mode = "write") {
  return canAccessPatient(user, patient, mode);
}

router.get("/patients", sensitiveDataRateLimit, async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);

  // D-12: receptionist busca municipal — retorna sumário restrito sem dados clínicos/sensíveis
  if (canonicalRole(req.user?.role) === "receptionist") {
    const patients = getAllowedPatients(db, req.user, req.query);
    await withDb((auditDb) => {
      ensureDbShape(auditDb);
      addAuditLog(auditDb, req.user, "patient.list_read", "patient", req.user.municipalityId || "municipal", {
        outcome: "success",
        scope: "municipal_receptionist",
        totalReturned: patients.length
      });
    });
    return res.json(patients.map((p) => buildReceptionistPatientSummary(p)));
  }

  const snapshotPatients = await listPatientsSnapshot({
    teamId: req.user?.teamId || "",
    microArea: req.query.microArea ? String(req.query.microArea).trim() : "",
    assignedAcsId: req.query.acsId ? String(req.query.acsId).trim() : "",
    careCategory: req.query.careCategory ? String(req.query.careCategory).trim() : ""
  });
  const patients = snapshotPatients.length ? getAllowedPatients({ ...db, patients: snapshotPatients }, req.user, req.query) : getAllowedPatients(db, req.user, req.query);
  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, req.user, "patient.list_read", "patient", req.user.teamId || "scoped", {
      outcome: "success",
      teamId: req.user.teamId,
      totalReturned: patients.length,
      filters: {
        microArea: String(req.query.microArea || ""),
        acsId: String(req.query.acsId || ""),
        careCategory: String(req.query.careCategory || "")
      }
    });
  });
  res.json(patients.map((p) => filterNis(filterGestorSpecialCategory(filterCnsResponsavel(maskSensitivePatientFields(p), req.user), req.user), req.user)));
});

router.get("/patients/protocol-summaries", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);

  const idsParam = String(req.query.ids || "").trim();
  const requestedIds = idsParam
    ? idsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : [];
  const requestedSet = new Set(requestedIds);
  const protocolMap = getProtocolTemplateMap(db, req.user.teamId);
  const allowedPatients = getAllowedPatients(db, req.user, req.query)
    .filter((patient) => !requestedSet.size || requestedSet.has(patient.id));

  const summaries = {};
  for (const patient of allowedPatients) {
    const history = buildPatientHistory(db, patient.id);
    const summary = buildProtocolSummary(patient, history, protocolMap);
    summaries[patient.id] = patient.teamId && patient.teamId !== req.user.teamId
      ? restrictSummaryAlertsForForeignTeam(summary)
      : summary;
  }

  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, req.user, "patient.protocol_summaries_read", "patient", req.user.teamId || "scoped", {
      outcome: "success",
      teamId: req.user.teamId,
      requestedCount: requestedIds.length,
      returnedCount: Object.keys(summaries).length
    });
  });

  return res.json({
    count: Object.keys(summaries).length,
    summaries
  });
});

router.post("/patients", requireManagerOrDoctor, validate(PatientCreateSchema), async (req, res) => {
  // F1-05/F1-06/F1-07/F1-08: normalize legacy aliases to canonical field names before persistence
  const payload = (() => {
    const p = { ...(req.body || {}) };
    if (p.raceColor !== undefined && p.racaCor === undefined) p.racaCor = p.raceColor;
    if (p.educationLevel !== undefined && p.escolaridade === undefined) p.escolaridade = p.educationLevel;
    if (p.address !== undefined && p.addressLegacy === undefined) p.addressLegacy = p.address;
    if (p.zipCode !== undefined && p.cep === undefined) p.cep = p.zipCode;
    if (p.number !== undefined && p.numero === undefined) p.numero = p.number;
    if (p.complement !== undefined && p.complemento === undefined) p.complemento = p.complement;
    if (p.neighborhood !== undefined && p.bairro === undefined) p.bairro = p.neighborhood;
    if (p.city !== undefined && p.municipioIbge === undefined) p.municipioIbge = p.city;
    if (p.state !== undefined && p.uf === undefined) p.uf = p.state;
    return p;
  })();
  const db = await readDb();
  ensureDbShape(db);
  const protocolMap = getProtocolTemplateMap(db, req.user.teamId);

  if (!payload.name || !payload.phone) {
    return res.status(400).json({ error: "Nome e telefone são obrigatórios" });
  }

  const patientTeamId = req.user.teamId;
  if (!patientTeamId) {
    return res.status(400).json({ error: "Equipe responsável é obrigatória" });
  }
  const teamExists = db.teams.some((t) => t.id === patientTeamId);
  if (!teamExists) {
    return res.status(400).json({ error: "Equipe responsável inválida" });
  }

  // Derive unitId from the team that owns this patient
  const patientTeam = db.teams.find((t) => t.id === patientTeamId);
  const patientUnitId = String(patientTeam?.unitId || req.user.unitId || "");
  const patientMunicipalityId = String(req.user.municipalityId || MUNICIPALITY_ID || "");

  const patient = {
    id: uuidv4(),
    teamId: patientTeamId,
    unitId: patientUnitId,
    municipalityId: patientMunicipalityId,
    name: String(payload.name).trim(),
    nomeSocial: payload.nomeSocial ? String(payload.nomeSocial).trim() : "",
    motherName: payload.motherName ? String(payload.motherName).trim() : "",
    guardianName: payload.guardianName ? String(payload.guardianName).trim() : "",
    cpf: payload.cpf ? String(payload.cpf).trim() : "",
    cns: payload.cns ? String(payload.cns).trim() : "",

    address: payload.address ? String(payload.address).trim() : "",
    phone: String(payload.phone).trim(),
    phoneAlt: payload.phoneAlt ? String(payload.phoneAlt).trim() : "",
    microArea: payload.microArea ? String(payload.microArea).trim() : "",
    assignedAcsId: payload.assignedAcsId ? String(payload.assignedAcsId).trim() : "",
    careCategory: normalizeCategory(payload.careCategory, protocolMap),
    chronicConditions: normalizeChronicConditions(payload.chronicConditions),
    // F2-03: maritalStatus stored as canonical enum value (uppercase); no lowercase transform
    maritalStatus: payload.maritalStatus ? String(payload.maritalStatus).trim() : "",
    incompleteProfile: Boolean(payload.incompleteProfile),
    inactive: Boolean(payload.inactive),
    inactivationReason: payload.inactivationReason ? String(payload.inactivationReason).trim() : "",
    inactivatedBy: payload.inactivatedBy ? String(payload.inactivatedBy).trim() : "",
    inactivatedAt: payload.inactivatedAt ? String(payload.inactivatedAt).trim() : "",
    sexAtBirth: payload.sexAtBirth ? String(payload.sexAtBirth).trim() : "",
    genderIdentity: payload.genderIdentity ? String(payload.genderIdentity).trim() : "",
    birthDate: payload.birthDate ? String(payload.birthDate).trim() : "",
    pregnancyStartDate: payload.pregnancyStartDate ? String(payload.pregnancyStartDate).trim() : "",
    expectedDeliveryDate: payload.expectedDeliveryDate ? String(payload.expectedDeliveryDate).trim() : "",
    gestationalAgeDumWeeks: Number.isFinite(Number(payload.gestationalAgeDumWeeks))
      ? Math.max(0, Math.min(45, Number(payload.gestationalAgeDumWeeks)))
      : "",
    gestationalAgeDumDays: Number.isFinite(Number(payload.gestationalAgeDumDays))
      ? Math.max(0, Math.min(6, Number(payload.gestationalAgeDumDays)))
      : "",
    gestationalAgeUsgWeeks: Number.isFinite(Number(payload.gestationalAgeUsgWeeks))
      ? Math.max(0, Math.min(45, Number(payload.gestationalAgeUsgWeeks)))
      : "",
    gestationalAgeUsgDays: Number.isFinite(Number(payload.gestationalAgeUsgDays))
      ? Math.max(0, Math.min(6, Number(payload.gestationalAgeUsgDays)))
      : "",
    usgDate1: payload.usgDate1 ? String(payload.usgDate1).trim() : "",
    usgDate2: payload.usgDate2 ? String(payload.usgDate2).trim() : "",
    usgDate3: payload.usgDate3 ? String(payload.usgDate3).trim() : "",
    prenatalStartDate: payload.prenatalStartDate ? String(payload.prenatalStartDate).trim() : "",
    postpartumStartDate: payload.postpartumStartDate ? String(payload.postpartumStartDate).trim() : "",
    comorbidities: payload.comorbidities ? String(payload.comorbidities).trim() : "",
    medications: payload.medications ? String(payload.medications).trim() : "",
    allergies: payload.allergies ? String(payload.allergies).trim() : "",
    // F1-01: fields previously in silent data loss — now persisted
    motherUnknown: payload.motherUnknown === true,
    addressLegacy: payload.addressLegacy ? String(payload.addressLegacy).trim() : "",
    birthCity: payload.birthCity ? String(payload.birthCity).trim() : "",
    birthState: payload.birthState ? String(payload.birthState).trim() : "",
    logradouro: payload.logradouro ? String(payload.logradouro).trim() : "",
    numero: payload.numero ? String(payload.numero).trim() : "",
    complemento: payload.complemento ? String(payload.complemento).trim() : "",
    bairro: payload.bairro ? String(payload.bairro).trim() : "",
    cep: payload.cep ? String(payload.cep).trim() : "",
    municipioIbge: payload.municipioIbge ? String(payload.municipioIbge).trim() : "",
    uf: payload.uf ? String(payload.uf).trim() : "",
    tipoLogradouroCnes: payload.tipoLogradouroCnes ? String(payload.tipoLogradouroCnes).trim() : "",
    escolaridade: payload.escolaridade ? String(payload.escolaridade).trim() : "",
    occupation: payload.occupation ? String(payload.occupation).trim() : "",
    familySituation: payload.familySituation ? String(payload.familySituation).trim() : "",
    familySupport: payload.familySupport ? String(payload.familySupport).trim() : "",
    socialVulnerability: payload.socialVulnerability ? String(payload.socialVulnerability).trim() : "",
    socialBenefit: payload.socialBenefit ? String(payload.socialBenefit).trim() : "",
    substanceDependency: payload.substanceDependency ? String(payload.substanceDependency).trim() : "",
    domesticViolence: payload.domesticViolence ? String(payload.domesticViolence).trim() : "",
    // C14: hivGestante + sifilis — SPECIAL_CATEGORY LGPD Art. 11
    hivGestante: payload.hivGestante === true,
    sifilis: payload.sifilis === true,
    racaCor: payload.racaCor ? String(payload.racaCor).trim() : "",
    // F2-01: new e-SUS demographic fields
    etnia: payload.etnia ? String(payload.etnia).trim() : "",
    nacionalidade: payload.nacionalidade ? String(payload.nacionalidade).trim() : "",
    municipioNascimentoIbge: payload.municipioNascimentoIbge ? String(payload.municipioNascimentoIbge).trim() : "",
    situacaoMercadoTrabalho: payload.situacaoMercadoTrabalho ? String(payload.situacaoMercadoTrabalho).trim() : "",
    rendaFamiliar: payload.rendaFamiliar ? String(payload.rendaFamiliar).trim() : "",
    responsavelFamiliar: payload.responsavelFamiliar ? String(payload.responsavelFamiliar).trim() : "",
    // F2-05: cnsResponsavel persisted as top-level field; AES-256-GCM applied by SENSITIVE_PATIENT_FIELDS in db.js
    cnsResponsavel: payload.cnsResponsavel ? String(payload.cnsResponsavel).trim() : "",
    // Grupo F — NIS; AES-256-GCM via SENSITIVE_PATIENT_FIELDS (db.js); dado pessoal comum
    nis: payload.nis ? String(payload.nis).trim() : "",
    // APS-01G: TRIA — Triagem para Risco de Insegurança Alimentar
    triaAlimentosAcabaram: payload.triaAlimentosAcabaram === true ? true : (payload.triaAlimentosAcabaram === false ? false : null),
    triaTipoUnico: payload.triaTipoUnico === true ? true : (payload.triaTipoUnico === false ? false : null),
    responsible: payload.responsible && typeof payload.responsible === "object" ? {
      name: payload.responsible.name ? String(payload.responsible.name).trim() : "",
      cpf: payload.responsible.cpf ? String(payload.responsible.cpf).trim() : "",
      phone: payload.responsible.phone ? String(payload.responsible.phone).trim() : "",
      relationship: payload.responsible.relationship ? String(payload.responsible.relationship).trim() : ""
    } : undefined,
    createdAt: new Date().toISOString(),
    createdBy: req.user.id
  };

  try {
    await withDb((db) => {
      ensureDbShape(db);
      const cpfValue = String(patient.cpf || "").trim();
      if (cpfValue) {
        const existing = db.patients.find(
          (p) => String(p.cpf || "").trim() === cpfValue && !p.inactive
        );
        if (existing) {
          throw Object.assign(new Error("CPF já cadastrado"), { statusCode: 409, code: "CPF_DUPLICATE" });
        }
      }
      const cnsValue = String(patient.cns || "").trim();
      if (cnsValue) {
        const existingCns = db.patients.find(
          (p) => String(p.cns || "").trim() === cnsValue && !p.inactive
        );
        if (existingCns) {
          throw Object.assign(new Error("CNS já cadastrado"), { statusCode: 409, code: "CNS_DUPLICATE" });
        }
      }
      db.patients.push(patient);
      // F5-01: Extract household fields from payload and persist in db.households
      const householdFromCreate = extractHouseholdFields(payload);
      upsertHousehold(db, patient.id, patient.teamId, householdFromCreate, req.user);
      addAuditLog(db, req.user, "patient.created", "patient", patient.id, {
        name: patient.name,
        teamId: patient.teamId,
        microArea: patient.microArea,
        assignedAcsId: patient.assignedAcsId,
        careCategory: patient.careCategory,
        after: buildPatientAuditSnapshot(patient)
      });
      syncPatientFamilyGroup(db, patient, req.user, "Cadastro de novo paciente");
    });
  } catch (err) {
    if (err.code === "CPF_DUPLICATE" || (err.code === "23505" && err.detail?.toLowerCase().includes("cpf_hash"))) {
      return res.status(409).json({ error: "Paciente com este CPF já existe" });
    }
    if (err.code === "CNS_DUPLICATE" || (err.code === "23505" && err.detail?.toLowerCase().includes("cns_hash"))) {
      return res.status(409).json({ error: "Paciente com este CNS já existe" });
    }
    throw err;
  }

  return res.status(201).json(filterNis(filterCnsResponsavel(patient, req.user), req.user));
});

router.put("/patients/:id", validate(PatientUpdateSchema), async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (!(isManager(req.user) || isDoctor(req.user))) {
    return res.status(403).json({ error: "Sem permissão para editar paciente" });
  }

  let updated;
  try {
  updated = await withDb((db) => {
    ensureDbShape(db);
    const index = db.patients.findIndex((p) => p.id === id);
    if (index < 0) return null;

    const current = db.patients[index];
    if (!canAccessPatient(req.user, current)) {
      addAuditLog(db, req.user, "patient.access_denied", "patient", id, { outcome: "denied", reason: "access_control", actorRole: String(req.user?.role || "") });
      return "forbidden";
    }

    // Duplicate CPF/CNS check — skip the patient being updated (compare by id)
    const incomingCpf = payload?.cpf !== undefined ? String(payload.cpf || "").trim() : null;
    const incomingCns = payload?.cns !== undefined ? String(payload.cns || "").trim() : null;
    if (incomingCpf) {
      const dupCpf = db.patients.find(
        (p) => p.id !== id && String(p.cpf || "").trim() === incomingCpf && !p.inactive
      );
      if (dupCpf) {
        throw Object.assign(new Error("CPF já cadastrado"), { statusCode: 409, code: "CPF_DUPLICATE" });
      }
    }
    if (incomingCns) {
      const dupCns = db.patients.find(
        (p) => p.id !== id && String(p.cns || "").trim() === incomingCns && !p.inactive
      );
      if (dupCns) {
        throw Object.assign(new Error("CNS já cadastrado"), { statusCode: 409, code: "CNS_DUPLICATE" });
      }
    }

    const before = buildPatientAuditSnapshot(current);
    const protocolMap = getProtocolTemplateMap(db, req.user.teamId);
    const doctorAllowed = new Set([
      "phone", "phoneAlt", "address", "comorbidities", "medications", "allergies",
      "birthDate", "pregnancyStartDate", "expectedDeliveryDate",
      "gestationalAgeDumWeeks", "gestationalAgeDumDays",
      "gestationalAgeUsgWeeks", "gestationalAgeUsgDays",
      "usgDate1", "usgDate2", "usgDate3", "prenatalStartDate", "postpartumStartDate",
      "incompleteProfile"
    ]);
    // F1-05/F1-06/F1-07/F1-08: normalize legacy aliases to canonical field names before persistence
    const safePayload = (() => {
      const raw = isDoctor(req.user)
        ? Object.fromEntries(Object.entries(payload || {}).filter(([k]) => doctorAllowed.has(k)))
        : { ...payload };
      if (raw.raceColor !== undefined && raw.racaCor === undefined) raw.racaCor = raw.raceColor;
      if (raw.educationLevel !== undefined && raw.escolaridade === undefined) raw.escolaridade = raw.educationLevel;
      if (raw.address !== undefined && raw.addressLegacy === undefined) raw.addressLegacy = raw.address;
      if (raw.zipCode !== undefined && raw.cep === undefined) raw.cep = raw.zipCode;
      if (raw.number !== undefined && raw.numero === undefined) raw.numero = raw.number;
      if (raw.complement !== undefined && raw.complemento === undefined) raw.complemento = raw.complement;
      if (raw.neighborhood !== undefined && raw.bairro === undefined) raw.bairro = raw.neighborhood;
      if (raw.city !== undefined && raw.municipioIbge === undefined) raw.municipioIbge = raw.city;
      if (raw.state !== undefined && raw.uf === undefined) raw.uf = raw.state;
      delete raw.raceColor; delete raw.educationLevel; delete raw.address;
      delete raw.zipCode; delete raw.number; delete raw.complement;
      delete raw.neighborhood; delete raw.city; delete raw.state;
      // F5-01: remove household fields from patient payload — redirected to db.households
      for (const field of HOUSEHOLD_FIELDS) delete raw[field];
      return raw;
    })();
    // F5-01: capture household fields before they are removed from safePayload
    const householdFromPatch = extractHouseholdFields(req.body || {});
    const next = {
      ...current,
      ...safePayload,
      teamId: current.teamId,
      motherName: safePayload?.motherName !== undefined
        ? String(safePayload.motherName || "").trim()
        : String(current.motherName || ""),
      phoneAlt: safePayload?.phoneAlt !== undefined
        ? String(safePayload.phoneAlt || "").trim()
        : String(current.phoneAlt || ""),
      cpf: safePayload?.cpf !== undefined
        ? String(safePayload.cpf || "").trim()
        : String(current.cpf || ""),
      cns: safePayload?.cns !== undefined
        ? String(safePayload.cns || "").trim()
        : String(current.cns || ""),

      careCategory: safePayload?.careCategory ? normalizeCategory(safePayload.careCategory, protocolMap) : current.careCategory,
      incompleteProfile: safePayload?.incompleteProfile !== undefined
        ? Boolean(safePayload.incompleteProfile)
        : Boolean(current.incompleteProfile),
      inactive: safePayload?.inactive !== undefined
        ? Boolean(safePayload.inactive)
        : Boolean(current.inactive),
      inactivationReason: safePayload?.inactivationReason !== undefined
        ? String(safePayload.inactivationReason || "").trim()
        : String(current.inactivationReason || ""),
      inactivatedBy: safePayload?.inactivatedBy !== undefined
        ? String(safePayload.inactivatedBy || "").trim()
        : String(current.inactivatedBy || ""),
      inactivatedAt: safePayload?.inactivatedAt !== undefined
        ? String(safePayload.inactivatedAt || "").trim()
        : String(current.inactivatedAt || ""),
      chronicConditions: safePayload?.chronicConditions !== undefined
        ? normalizeChronicConditions(safePayload.chronicConditions)
        : normalizeChronicConditions(current.chronicConditions),
      // F2-02/F2-03: enum values stored as-is (uppercase canonical); no toLowerCase
      maritalStatus: safePayload?.maritalStatus !== undefined
        ? String(safePayload.maritalStatus || "").trim()
        : String(current.maritalStatus || ""),
      sexAtBirth: safePayload?.sexAtBirth !== undefined
        ? String(safePayload.sexAtBirth || "").trim()
        : String(current.sexAtBirth || ""),
      genderIdentity: safePayload?.genderIdentity !== undefined
        ? String(safePayload.genderIdentity || "").trim()
        : String(current.genderIdentity || ""),
      gestationalAgeDumWeeks: safePayload?.gestationalAgeDumWeeks !== undefined
        ? (Number.isFinite(Number(safePayload.gestationalAgeDumWeeks))
          ? Math.max(0, Math.min(45, Number(safePayload.gestationalAgeDumWeeks)))
          : "")
        : (Number.isFinite(Number(current.gestationalAgeDumWeeks)) ? Number(current.gestationalAgeDumWeeks) : ""),
      gestationalAgeDumDays: safePayload?.gestationalAgeDumDays !== undefined
        ? (Number.isFinite(Number(safePayload.gestationalAgeDumDays))
          ? Math.max(0, Math.min(6, Number(safePayload.gestationalAgeDumDays)))
          : "")
        : (Number.isFinite(Number(current.gestationalAgeDumDays)) ? Number(current.gestationalAgeDumDays) : ""),
      gestationalAgeUsgWeeks: safePayload?.gestationalAgeUsgWeeks !== undefined
        ? (Number.isFinite(Number(safePayload.gestationalAgeUsgWeeks))
          ? Math.max(0, Math.min(45, Number(safePayload.gestationalAgeUsgWeeks)))
          : "")
        : (Number.isFinite(Number(current.gestationalAgeUsgWeeks)) ? Number(current.gestationalAgeUsgWeeks) : ""),
      gestationalAgeUsgDays: safePayload?.gestationalAgeUsgDays !== undefined
        ? (Number.isFinite(Number(safePayload.gestationalAgeUsgDays))
          ? Math.max(0, Math.min(6, Number(safePayload.gestationalAgeUsgDays)))
          : "")
        : (Number.isFinite(Number(current.gestationalAgeUsgDays)) ? Number(current.gestationalAgeUsgDays) : ""),
      usgDate1: safePayload?.usgDate1 !== undefined
        ? String(safePayload.usgDate1 || "").trim()
        : String(current.usgDate1 || ""),
      usgDate2: safePayload?.usgDate2 !== undefined
        ? String(safePayload.usgDate2 || "").trim()
        : String(current.usgDate2 || ""),
      usgDate3: safePayload?.usgDate3 !== undefined
        ? String(safePayload.usgDate3 || "").trim()
        : String(current.usgDate3 || ""),
      // F7-04b: cnsResponsavel — persisted on PUT; AES-256-GCM applied by SENSITIVE_PATIENT_FIELDS in db.js
      cnsResponsavel: safePayload?.cnsResponsavel !== undefined
        ? String(safePayload.cnsResponsavel || "").trim()
        : String(current.cnsResponsavel || ""),
      // APS-01G: TRIA
      triaAlimentosAcabaram: safePayload?.triaAlimentosAcabaram !== undefined
        ? (safePayload.triaAlimentosAcabaram === true ? true : safePayload.triaAlimentosAcabaram === false ? false : null)
        : (current.triaAlimentosAcabaram ?? null),
      triaTipoUnico: safePayload?.triaTipoUnico !== undefined
        ? (safePayload.triaTipoUnico === true ? true : safePayload.triaTipoUnico === false ? false : null)
        : (current.triaTipoUnico ?? null),
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };

    if (next.inactive && !String(next.inactivationReason || "").trim()) {
      return { error: { status: 400, message: "Justificativa obrigatória para desativar paciente" } };
    }

    db.patients[index] = next;
    // F5-01: persist household fields in db.households (extracted from patient payload)
    upsertHousehold(db, id, next.teamId, householdFromPatch, req.user);
    addAuditLog(db, req.user, "patient.updated", "patient", id, {
      changedFields: Object.keys(safePayload || {}),
      before,
      after: buildPatientAuditSnapshot(next)
    });

    const addressChanged = (next.address || "") !== (current.address || "")
      || (next.addressLegacy || "") !== (current.addressLegacy || "");
    const acsChanged = (next.assignedAcsId || "") !== (current.assignedAcsId || "");
    if (addressChanged || acsChanged) {
      const reason = addressChanged
        ? "Atualização automática por alteração de endereço do paciente"
        : "Atualização automática por mudança de ACS responsável";
      syncPatientFamilyGroup(db, next, req.user, reason);
    }

    return next;
  });
  } catch (err) {
    if (err.code === "CPF_DUPLICATE" || (err.code === "23505" && err.detail?.toLowerCase().includes("cpf_hash"))) {
      return res.status(409).json({ error: "Paciente com este CPF já existe" });
    }
    if (err.code === "CNS_DUPLICATE" || (err.code === "23505" && err.detail?.toLowerCase().includes("cns_hash"))) {
      return res.status(409).json({ error: "Paciente com este CNS já existe" });
    }
    throw err;
  }

  if (!updated) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }
  if (updated === "forbidden") {
    return res.status(403).json({ error: "Sem permissão para editar paciente" });
  }

  return res.json(filterNis(filterCnsResponsavel(updated, req.user), req.user));
});

router.delete("/patients/:id", requireManagerOrDoctor, validate(CriticalActionReasonSchema), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const result = await withDb((db) => {
    ensureDbShape(db);
    const patientIndex = db.patients.findIndex((p) => p.id === id);
    if (patientIndex < 0) return { error: "Paciente não encontrado" };

    const patient = db.patients[patientIndex];
    if (!canAccessPatient(req.user, patient)) {
      addAuditLog(db, req.user, "patient.access_denied", "patient", id, { outcome: "denied", reason: "access_control", actorRole: String(req.user?.role || "") });
      return { error: "Sem permissão para inativar paciente" };
    }

    if (patient.inactive) return { error: "Paciente já está inativo" };

    const before = buildPatientAuditSnapshot(patient);
    const now = new Date().toISOString();

    // Soft-delete: mark inactive, preserve all records intact (CFM 1821/2007 / LGPD)
    patient.inactive = true;
    patient.inactivatedAt = now;
    patient.inactivatedById = req.user.id;
    patient.inactivatedBy = req.user.name || req.user.email || req.user.id;
    patient.inactivationReason = String(reason || "").trim();
    patient.updatedAt = now;

    const after = buildPatientAuditSnapshot(patient);

    addAuditLog(db, req.user, "patient.inactivated", "patient", id, {
      name: patient.name,
      inactivationReason: patient.inactivationReason,
      before,
      after
    });

    return { ok: true, inactive: true, patientId: id };
  });

  if (result?.error) {
    const isAlreadyInactive = String(result.error).toLowerCase().includes("já está");
    const status = String(result.error).toLowerCase().includes("permissão") ? 403
      : isAlreadyInactive ? 409 : 404;
    return res.status(status).json({ error: result.error });
  }
  return res.json(result);
});

router.get("/patients/:id/appointments", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  ensureDbShape(db);
  const patient = await findPatientByIdSnapshot(id);
  const lookup = patient ? { patient } : getPatientOrError(db, req.user, id, "read");
  if (lookup.error) {
    if (lookup.error.status === 403) auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(lookup.error.status).json({ error: lookup.error.message });
  }
  if (patient && !canAccessPatient(req.user, patient, "read")) {
    auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(403).json({ error: "Sem permissão para este paciente" });
  }

  const appointmentsSource = await listAppointmentsByPatientId(id);
  const appointments = (appointmentsSource.length ? appointmentsSource : db.appointments.filter((a) => a.patientId === id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((a) => ({
      ...a,
      demandType: normalizeDemandType(a.demandType)
    }));

  await logPatientRead(req, lookup.patient, "patient.appointments_read", {
    totalReturned: appointments.length
  });
  return res.json(appointments);
});

router.post("/patients/:id/appointments", validate(AppointmentCreateSchema), async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (!(isManager(req.user) || isDoctor(req.user))) {
    return res.status(403).json({ error: "Sem permissão para criar atendimento" });
  }

  if (!payload.date || !payload.summary) {
    return res.status(400).json({ error: "Data e resumo são obrigatórios" });
  }

  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, id);
  if (lookup.error) {
    if (lookup.error.status === 403) auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(lookup.error.status).json({ error: lookup.error.message });
  }

  const appointment = {
    id: uuidv4(),
    patientId: id,
    date: String(payload.date),
    summary: String(payload.summary),
    demandType: normalizeDemandType(payload.demandType),
    conduct: payload.conduct ? String(payload.conduct) : "",
    nextStep: payload.nextStep ? String(payload.nextStep) : "",
    executingTeamId: String(req.user.teamId || ""),
    executingUnitId: String(req.user.unitId || ""),
    createdBy: req.user.id,
    createdAt: new Date().toISOString()
  };

  await withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    mutableDb.appointments.push(appointment);
    addAuditLog(mutableDb, req.user, "appointment.created", "appointment", appointment.id, {
      patientId: id
    });
  });

  return res.status(201).json(appointment);
});

router.delete("/patients/:id/appointments/:appointmentId", validate(CriticalActionReasonSchema), async (req, res) => {
  const patientId = String(req.params.id || "").trim();
  const appointmentId = String(req.params.appointmentId || "").trim();

  if (!(isManager(req.user) || isDoctor(req.user))) {
    return res.status(403).json({ error: "Sem permissão para excluir atendimento" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };
    if (!canAccessPatient(req.user, patient)) {
      addAuditLog(db, req.user, "patient.access_denied", "patient", patientId, { outcome: "denied", reason: "access_control", actorRole: String(req.user?.role || "") });
      return { error: { status: 403, message: "Sem permissão para este paciente" } };
    }

    const index = db.appointments.findIndex((a) => a.id === appointmentId && a.patientId === patientId);
    if (index < 0) return { error: { status: 404, message: "Atendimento não encontrado" } };

    const removed = db.appointments[index];
    db.appointments.splice(index, 1);
    addAuditLog(db, req.user, "appointment.deleted", "appointment", appointmentId, {
      patientId,
      summary: removed.summary || "",
      reason: String(req.body.reason || "").trim()
    });
    return { ok: true };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({ ok: true });
});

router.get("/records/prescriptions", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const allowedPatients = getAllowedPatients(db, req.user, {});
  const prescriptions = [];
  for (const p of allowedPatients) {
    const recs = (db.clinicalRecords || []).filter(r =>
      r.patientId === p.id && String(r.type || "").toLowerCase() === "prescription"
    );
    for (const r of recs) {
      prescriptions.push({ ...r, patientName: p.name, patientId: p.id });
    }
  }
  prescriptions.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return res.json({ prescriptions });
});

router.post("/patients/:id/records", async (req, res) => {
  const { id } = req.params;
  const rawBody = req.body || {};
  const type = String(rawBody.type || "");

  // F5-03: type=visit uses exclusively VisitCreateSchema
  if (type === "visit") {
    const visitParsed = VisitCreateSchema.safeParse(rawBody);
    if (!visitParsed.success) {
      return res.status(400).json({
        error: "Dados inválidos",
        details: visitParsed.error.issues.map((i) => {
          const path = i.path.length ? i.path.join(".") : "body";
          return `${path}: ${i.message}`;
        })
      });
    }
    const visitData = visitParsed.data;

    if (!hasCapability(req.user, "records.write")) {
      return res.status(403).json({ error: "Sem permissão para criar registros clínicos" });
    }

    const db = await readDb();
    ensureDbShape(db);
    const lookup = getPatientOrError(db, req.user, id);
    if (lookup.error) {
      if (lookup.error.status === 403) auditPatientAccessDenied(req.user, id, "access_control");
      return res.status(lookup.error.status).json({ error: lookup.error.message });
    }

    const visitRecord = {
      id: uuidv4(),
      patientId: id,
      type: "visit",
      title: "Visita Domiciliar",
      details: "",
      date: visitData.dataVisita,
      // D-10: protocolTag usa equipe de referência do paciente, não do ator
      protocolTag: normalizeCategory(lookup.patient.careCategory, getProtocolTemplateMap(db, lookup.patient.teamId)),
      metadata: {
        turno: visitData.turno,
        tipoVisita: visitData.tipoVisita,
        motivosVisita: visitData.motivosVisita,
        desfecho: visitData.desfecho,
        ...(visitData.peso !== undefined ? { peso: visitData.peso } : {}),
        ...(visitData.altura !== undefined ? { altura: visitData.altura } : {})
      },
      // D-05: campos de rastreabilidade assistencial
      executingProfessionalId: req.user.id,
      executingTeamId: String(req.user.teamId || ""),
      executingUnitId: String(req.user.unitId || ""),
      patientReferenceTeamId: String(lookup.patient.teamId || ""),
      patientReferenceUnitId: String(lookup.patient.unitId || ""),
      municipalityId: String(lookup.patient.municipalityId || ""),
      isCrossTeam: String(req.user.teamId || "") !== String(lookup.patient.teamId || ""),
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    };

    await withDb((mutableDb) => {
      ensureDbShape(mutableDb);
      mutableDb.clinicalRecords.push(visitRecord);
      addAuditLog(mutableDb, req.user, "clinical_record.created", "clinical_record", visitRecord.id, {
        patientId: id,
        type: "visit",
        protocolTag: visitRecord.protocolTag
      });
    });

    return res.status(201).json(visitRecord);
  }

  // Non-visit types: use RecordCreateSchema
  const recordParsed = RecordCreateSchema.safeParse(rawBody);
  if (!recordParsed.success) {
    return res.status(400).json({
      error: "Dados inválidos",
      details: recordParsed.error.issues.map((i) => {
        const path = i.path.length ? i.path.join(".") : "body";
        return `${path}: ${i.message}`;
      })
    });
  }
  const payload = recordParsed.data;

  if (!payload.type || !payload.date || !payload.title) {
    return res.status(400).json({ error: "type, date e title são obrigatórios" });
  }

  const allowedTypes = ["consultation", "vaccine", "procedure", "note", "prescription", "exam_request", "referral", "nursing", "evolution", "attendance_attest", "medical_attest"];
  const typeStr = String(payload.type);
  if (!allowedTypes.includes(typeStr)) {
    return res.status(400).json({ error: "Tipo de registro inválido" });
  }

  // CRT-04: guard de capability — apenas roles com records.write podem criar registros clínicos
  if (!hasCapability(req.user, "records.write")) {
    return res.status(403).json({ error: "Sem permissão para criar registros clínicos" });
  }

  // ACS só pode registrar visitas — visit path handled above, so ACS always blocked here
  if (isAcs(req.user)) {
    return res.status(403).json({ error: "ACS só pode criar registros do tipo visita" });
  }

  // Prescrições e atestados médicos são exclusivos de médico e dentista
  if (DOCTOR_ONLY_TYPES.has(typeStr) && !CLINICAL_PRESCRIBER_ROLES.has(canonicalRole(req.user.role))) {
    await withDb((auditDb) => {
      ensureDbShape(auditDb);
      addAuditLog(auditDb, req.user, "record.creation_blocked", "clinical_record", id, {
        type: typeStr,
        reason: "Tipo reservado para médico/dentista"
      });
    });
    return res.status(403).json({ error: "Apenas médico pode criar prescrição ou atestado médico" });
  }

  const db = await readDb();
  ensureDbShape(db);
  // D-06: clinical_write mode permite cross-team para roles autorizadas no mesmo município
  const lookup = getPatientOrError(db, req.user, id, "clinical_write");
  if (lookup.error) {
    if (lookup.error.status === 403) auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(lookup.error.status).json({ error: lookup.error.message });
  }

  // D-08: justificativa obrigatória quando cross-team
  const isCrossTeam = String(req.user.teamId || "") !== String(lookup.patient.teamId || "");
  if (isCrossTeam) {
    const justification = String(payload.crossTeamJustification || "").trim();
    if (justification.length < 20) {
      return res.status(400).json({
        error: "crossTeamJustification obrigatória (mínimo 20 caracteres) para atendimento em paciente de outra equipe"
      });
    }
  }

  const integrityCheck = validateClinicalRecordPayload({
    user: req.user,
    patient: lookup.patient,
    type: typeStr,
    title: payload.title,
    date: payload.date,
    details: payload.details,
    metadata: payload.metadata
  });
  if (!integrityCheck.ok) {
    return res.status(400).json({ error: integrityCheck.error });
  }

  // CID-10: validação de existência na tabela cid10 (somente em modo Postgres)
  if (pool) {
    if (payload.cidPrincipal) {
      const cidPrincipalResult = await pool.query(
        "SELECT code FROM cid10 WHERE code = $1 AND active = true",
        [payload.cidPrincipal]
      );
      if (cidPrincipalResult.rowCount === 0) {
        return res.status(400).json({ error: "CID principal não encontrado: " + payload.cidPrincipal });
      }
    }
    if (Array.isArray(payload.cidSecundarios) && payload.cidSecundarios.length > 0) {
      const cidSecResult = await pool.query(
        "SELECT code FROM cid10 WHERE code = ANY($1::text[]) AND active = true",
        [payload.cidSecundarios]
      );
      if (cidSecResult.rowCount < payload.cidSecundarios.length) {
        return res.status(400).json({ error: "CID secundário inválido" });
      }
    }
    // CIAP-2: validação de existência na tabela ciap2
    if (payload.ciapPrincipal) {
      const ciapResult = await pool.query(
        "SELECT code FROM ciap2 WHERE code = $1",
        [payload.ciapPrincipal]
      );
      if (ciapResult.rowCount === 0) {
        return res.status(400).json({ error: "CIAP-2 não encontrado: " + payload.ciapPrincipal });
      }
    }
  }

  const incomingMetadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  const consultationSpecialty = typeStr === "consultation"
    ? detectConsultationSpecialtyFromTitle(payload.title)
    : "";
  const normalizedTitle = typeStr === "consultation"
    ? normalizeConsultationTitle(payload.title, consultationSpecialty)
    : String(payload.title);

  // B-05: Capture a clinical-legal snapshot at record creation time for high-stakes record types.
  // Preserves patient and actor context even if records are later anonymised or patient is updated.
  // Snapshot is stored on the record itself — append-only records mean it persists forever.
  const SNAPSHOT_TYPES = new Set(["prescription", "medical_attest", "referral"]);
  const clinicalSnapshot = SNAPSHOT_TYPES.has(typeStr)
    ? {
        capturedAt: new Date().toISOString(),
        patient: {
          name: String(lookup.patient.name || ""),
          cpfMasked: maskSensitivePatientFields(lookup.patient).cpf || "",
          birthDate: String(lookup.patient.birthDate || ""),
          teamId: String(lookup.patient.teamId || "")
        },
        actor: {
          name: String(req.user.name || ""),
          role: String(req.user.role || ""),
          teamId: String(req.user.teamId || "")
        }
      }
    : undefined;

  // D-10: protocolTag usa equipe de referência do paciente, não do ator executante
  const patientTeamId = String(lookup.patient.teamId || "");
  const record = {
    id: uuidv4(),
    patientId: id,
    type: typeStr,
    title: normalizedTitle,
    details: payload.details ? String(payload.details) : "",
    date: String(payload.date),
    protocolTag: payload.protocolTag
      ? normalizeCategory(String(payload.protocolTag), getProtocolTemplateMap(db, patientTeamId))
      : normalizeCategory(lookup.patient.careCategory, getProtocolTemplateMap(db, patientTeamId)),
    metadata: {
      ...incomingMetadata,
      ...(typeStr === "consultation" ? { specialty: consultationSpecialty } : {})
    },
    ...(clinicalSnapshot !== undefined ? { clinicalSnapshot } : {}),
    // D-05: campos de rastreabilidade assistencial APS municipal
    executingProfessionalId: req.user.id,
    executingTeamId: String(req.user.teamId || ""),
    executingUnitId: String(req.user.unitId || ""),
    patientReferenceTeamId: patientTeamId,
    patientReferenceUnitId: String(lookup.patient.unitId || ""),
    municipalityId: String(lookup.patient.municipalityId || ""),
    isCrossTeam,
    ...(isCrossTeam ? { crossTeamJustification: String(payload.crossTeamJustification || "").trim() } : {}),
    // CID-10 + CIAP-2 — persistidos no record dentro de app_state; campos opcionais
    ...(payload.cidPrincipal ? { cidPrincipal: payload.cidPrincipal } : {}),
    ...(Array.isArray(payload.cidSecundarios) && payload.cidSecundarios.length > 0
      ? { cidSecundarios: payload.cidSecundarios }
      : {}),
    ...(payload.ciapPrincipal ? { ciapPrincipal: payload.ciapPrincipal } : {}),
    // C04C-G1: turno do atendimento (LEDI APS 7.4.0)
    ...(payload.turno ? { turno: payload.turno } : {}),
    // C04C-G2: local de atendimento (LEDI APS 7.4.0)
    ...(payload.localDeAtendimento ? { localDeAtendimento: payload.localDeAtendimento } : {}),
    createdBy: req.user.id,
    createdAt: new Date().toISOString()
  };

  await withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    mutableDb.clinicalRecords.push(record);

    // D-09: audit trail completo com campos de rastreabilidade APS municipal
    if (isCrossTeam) {
      const isCrossUnit = String(req.user.unitId || "") !== String(lookup.patient.unitId || "");
      addAuditLog(mutableDb, req.user, isCrossUnit ? "clinical_record.cross_unit" : "clinical_record.cross_team", "patient", id, {
        executingProfessionalId: req.user.id,
        executingTeamId: record.executingTeamId,
        executingUnitId: record.executingUnitId,
        patientReferenceTeamId: record.patientReferenceTeamId,
        patientReferenceUnitId: record.patientReferenceUnitId,
        municipalityId: record.municipalityId,
        crossTeamJustification: record.crossTeamJustification || "",
        resource: "clinical_record.create"
      });
    }

    addAuditLog(mutableDb, req.user, "clinical_record.created", "clinical_record", record.id, {
      patientId: id,
      type: record.type,
      protocolTag: record.protocolTag,
      executingTeamId: record.executingTeamId,
      patientReferenceTeamId: record.patientReferenceTeamId,
      isCrossTeam
    });
  });

  return res.status(201).json({
    ...record,
    warning: integrityCheck.warning || ""
  });
});

router.delete("/patients/:id/records/:recordId", validate(CriticalActionReasonSchema), async (req, res) => {
  const patientId = String(req.params.id || "").trim();
  const recordId = String(req.params.recordId || "").trim();

  const result = await withDb((db) => {
    ensureDbShape(db);
    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };
    if (!canAccessPatient(req.user, patient)) {
      addAuditLog(db, req.user, "patient.access_denied", "patient", patientId, { outcome: "denied", reason: "access_control", actorRole: String(req.user?.role || "") });
      return { error: { status: 403, message: "Sem permissão para este paciente" } };
    }

    const index = db.clinicalRecords.findIndex((r) => r.id === recordId && r.patientId === patientId);
    if (index < 0) return { error: { status: 404, message: "Registro não encontrado" } };

    const current = db.clinicalRecords[index];
    if (isAcs(req.user)) {
      const canInactivate = current.type === "visit" && current.createdBy === req.user.id;
      if (!canInactivate) {
        return { error: { status: 403, message: "ACS pode inativar apenas visita própria registrada por ele" } };
      }
    } else if (!(isManager(req.user) || isDoctor(req.user))) {
      return { error: { status: 403, message: "Sem permissão para inativar registro" } };
    }

    db.clinicalRecords[index] = {
      ...current,
      status: "inactive",
      statusReason: String(req.body.reason || "").trim(),
      statusChangedAt: new Date().toISOString(),
      statusChangedBy: req.user.id,
    };
    addAuditLog(db, req.user, "clinical_record.inactivated", "clinical_record", recordId, {
      patientId,
      type: current.type,
      reason: String(req.body.reason || "").trim()
    });
    return { ok: true };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({ ok: true });
});

router.patch("/patients/:id/records/:recordId/inactivate", async (req, res) => {
  const patientId = String(req.params.id || "").trim();
  const recordId = String(req.params.recordId || "").trim();
  const reason = String(req.body?.reason || "").trim();
  const newStatus = req.body?.status === "cancelled" ? "cancelled" : "inactive";

  if (reason.length < 8 || reason.length > 1000) {
    return res.status(400).json({ error: "Justificativa obrigatória (mínimo 8, máximo 1000 caracteres)." });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };
    if (!canAccessPatient(req.user, patient)) {
      addAuditLog(db, req.user, "patient.access_denied", "patient", patientId, { outcome: "denied", reason: "access_control", actorRole: String(req.user?.role || "") });
      return { error: { status: 403, message: "Sem permissão para este paciente" } };
    }

    const index = db.clinicalRecords.findIndex((r) => r.id === recordId && r.patientId === patientId);
    if (index < 0) return { error: { status: 404, message: "Registro não encontrado" } };

    const current = db.clinicalRecords[index];
    if (current.status === "inactive" || current.status === "cancelled") {
      return { error: { status: 409, message: "Registro já está inativo ou cancelado." } };
    }

    if (isAcs(req.user)) {
      const canInactivate = current.type === "visit" && current.createdBy === req.user.id;
      if (!canInactivate) return { error: { status: 403, message: "ACS pode inativar apenas visita própria." } };
    } else if (!(isManager(req.user) || isDoctor(req.user))) {
      return { error: { status: 403, message: "Sem permissão para inativar registro clínico." } };
    }

    db.clinicalRecords[index] = {
      ...current,
      status: newStatus,
      statusReason: reason,
      statusChangedAt: new Date().toISOString(),
      statusChangedBy: req.user.id,
    };
    addAuditLog(db, req.user, "clinical_record.inactivated", "clinical_record", recordId, {
      patientId,
      type: current.type,
      newStatus,
      reason,
    });
    return { ok: true, record: db.clinicalRecords[index] };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({ ok: true, record: result.record });
});

router.get("/patients/:id/history", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  ensureDbShape(db);

  const lookup = getPatientOrError(db, req.user, id, "read");
  if (lookup.error) {
    if (lookup.error.status === 403) auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(lookup.error.status).json({ error: lookup.error.message });
  }
  if (!hasSameTeamPatientAccess(req.user, lookup.patient, "read")) {
    auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(403).json({ error: "Sem permissão para este paciente" });
  }

  const history = buildPatientHistory(db, id);
  await logPatientRead(req, lookup.patient, "patient.history_read", {
    totalReturned: history.length
  });
  return res.json(history);
});

router.get("/patients/:id/protocol-summary", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  ensureDbShape(db);

  const lookup = getPatientOrError(db, req.user, id, "read");
  if (lookup.error) {
    if (lookup.error.status === 403) auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(lookup.error.status).json({ error: lookup.error.message });
  }
  if (!hasSameTeamPatientAccess(req.user, lookup.patient, "read")) {
    auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(403).json({ error: "Sem permissão para este paciente" });
  }

  const history = buildPatientHistory(db, id);
  const summary = buildProtocolSummary(lookup.patient, history, getProtocolTemplateMap(db, req.user.teamId));
  await logPatientRead(req, lookup.patient, "patient.protocol_summary_read", {
    alertCount: Array.isArray(summary?.alerts) ? summary.alerts.length : 0
  });
  return res.json(summary);
});

router.get("/patients/:id/messages", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  ensureDbShape(db);

  const lookup = getPatientOrError(db, req.user, id, "read");
  if (lookup.error) {
    if (lookup.error.status === 403) auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(lookup.error.status).json({ error: lookup.error.message });
  }
  if (!hasSameTeamPatientAccess(req.user, lookup.patient, "read")) {
    auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(403).json({ error: "Sem permissão para este paciente" });
  }

  const messages = db.messages
    .filter((m) => m.patientId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  await logPatientRead(req, lookup.patient, "patient.messages_read", {
    totalReturned: messages.length
  });
  return res.json(messages);
});

router.post("/patients/:id/messages", async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (isAcs(req.user)) {
    return res.status(403).json({ error: "ACS não pode enviar mensagens neste módulo" });
  }

  if (!payload.text) {
    return res.status(400).json({ error: "text é obrigatório" });
  }

  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, id);
  if (lookup.error) {
    if (lookup.error.status === 403) auditPatientAccessDenied(req.user, id, "access_control");
    return res.status(lookup.error.status).json({ error: lookup.error.message });
  }

  const message = {
    id: uuidv4(),
    patientId: id,
    authorId: req.user.id,
    authorName: req.user.name,
    text: String(payload.text),
    createdAt: new Date().toISOString()
  };

  await withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    mutableDb.messages.push(message);
    addAuditLog(mutableDb, req.user, "message.created", "message", message.id, {
      patientId: id
    });
  });

  return res.status(201).json(message);
});

router.get("/metrics/demand/monthly", async (req, res) => {
  if (!(isManager(req.user) || isDoctor(req.user))) {
    return res.status(403).json({ error: "Apenas enfermeira e médica podem acessar este indicador" });
  }
  const db = await readDb();
  ensureDbShape(db);
  const month = String(req.query.month || "").trim();
  const metric = buildMonthlyDemandMetric(db, req.user.teamId, month);
  if (!metric) {
    return res.status(400).json({ error: "Parâmetro month inválido. Use YYYY-MM." });
  }
  return res.json(metric);
});

router.get("/metrics/data-quality", async (req, res) => {
  if (!(isManager(req.user) || isDoctor(req.user))) {
    return res.status(403).json({ error: "Apenas enfermeira e médica podem acessar qualidade de dados" });
  }
  const db = await readDb();
  ensureDbShape(db);
  return res.json(buildDataQualityMetric(db, req.user.teamId));
});

export default router;

