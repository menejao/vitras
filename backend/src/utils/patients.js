import { canAccessAllPatients, canAccessScopedPatients, normalizeDemandType, eventDate, canonicalRole } from "./helpers.js";
import { ensureArray, getProtocolTemplateMap, normalizeCategory, normalizeChronicConditions } from "./domain.js";

function isAnonymizedPatient(patient) {
  return Boolean(patient?.privacy?.anonymizedAt);
}

function getPatientActivityDate(db, patientId) {
  const patient = db.patients.find((p) => p.id === patientId);
  const dates = [
    patient?.updatedAt,
    patient?.createdAt,
    ...db.agendaEntries.filter((a) => a.patientId === patientId).map((a) => `${a.date || ""}T${a.time || "00:00"}`),
    ...db.appointments.filter((a) => a.patientId === patientId).map((a) => a.date || a.createdAt),
    ...db.clinicalRecords.filter((r) => r.patientId === patientId).map((r) => r.date || r.createdAt),
    ...db.messages.filter((m) => m.patientId === patientId).map((m) => m.createdAt),
    ...db.tasks.filter((t) => t.patientId === patientId).map((t) => t.updatedAt || t.createdAt),
    ...db.referrals.filter((r) => r.patientId === patientId).map((r) => r.updatedAt || r.createdAt),
    ...db.suppliesLogs.filter((r) => r.patientId === patientId).map((r) => r.ts),
    ...db.exams.filter((r) => r.patientId === patientId).map((r) => r.updatedAt || r.createdAt)
  ].filter(Boolean);

  if (!dates.length) return null;
  dates.sort((a, b) => String(b).localeCompare(String(a)));
  return dates[0];
}

function buildPatientAccessReport(db, patient) {
  const patientId = patient.id;
  const appointments = db.appointments.filter((a) => a.patientId === patientId);
  const agendaEntries = db.agendaEntries.filter((a) => a.patientId === patientId);
  const records = db.clinicalRecords.filter((r) => r.patientId === patientId);
  const messages = db.messages.filter((m) => m.patientId === patientId);
  const tasks = db.tasks.filter((t) => t.patientId === patientId);
  const referrals = db.referrals.filter((r) => r.patientId === patientId);
  const suppliesLogs = db.suppliesLogs.filter((r) => r.patientId === patientId);
  const suppliesContinuous = db.suppliesContinuous.filter((r) => r.patientId === patientId);
  const exams = db.exams.filter((r) => r.patientId === patientId);
  const lastActivityAt = getPatientActivityDate(db, patientId);

  return {
    generatedAt: new Date().toISOString(),
    patient: {
      id: patient.id,
      name: patient.name,
      motherName: patient.motherName || "",
      cpf: patient.cpf || "",
      cns: patient.cns || "",
      cnsCpf: patient.cnsCpf || "",
      phone: patient.phone || "",
      phoneAlt: patient.phoneAlt || "",
      address: patient.address || "",
      careCategory: patient.careCategory || "general",
      chronicConditions: normalizeChronicConditions(patient.chronicConditions),
      maritalStatus: patient.maritalStatus || "",
      sexAtBirth: patient.sexAtBirth || "",
      genderIdentity: patient.genderIdentity || "",
      birthDate: patient.birthDate || "",
      pregnancyStartDate: patient.pregnancyStartDate || "",
      expectedDeliveryDate: patient.expectedDeliveryDate || "",
      gestationalAgeDumWeeks: Number.isFinite(Number(patient.gestationalAgeDumWeeks))
        ? Number(patient.gestationalAgeDumWeeks)
        : "",
      gestationalAgeDumDays: Number.isFinite(Number(patient.gestationalAgeDumDays))
        ? Number(patient.gestationalAgeDumDays)
        : "",
      gestationalAgeUsgWeeks: Number.isFinite(Number(patient.gestationalAgeUsgWeeks))
        ? Number(patient.gestationalAgeUsgWeeks)
        : "",
      gestationalAgeUsgDays: Number.isFinite(Number(patient.gestationalAgeUsgDays))
        ? Number(patient.gestationalAgeUsgDays)
        : "",
      usgDate1: patient.usgDate1 || "",
      usgDate2: patient.usgDate2 || "",
      usgDate3: patient.usgDate3 || "",
      prenatalStartDate: patient.prenatalStartDate || "",
      postpartumStartDate: patient.postpartumStartDate || "",
      assignedAcsId: patient.assignedAcsId || "",
      comorbidities: patient.comorbidities || "",
      medications: patient.medications || "",
      allergies: patient.allergies || ""
    },
    summary: {
      agendaEntries: agendaEntries.length,
      appointments: appointments.length,
      clinicalRecords: records.length,
      messages: messages.length,
      tasks: tasks.length,
      referrals: referrals.length,
      suppliesLogs: suppliesLogs.length,
      suppliesContinuous: suppliesContinuous.length,
      exams: exams.length,
      lastActivityAt
    },
    appointments: appointments.map((a) => ({
      id: a.id,
      date: a.date,
      summary: a.summary,
      demandType: normalizeDemandType(a.demandType),
      conduct: a.conduct || "",
      nextStep: a.nextStep || "",
      createdAt: a.createdAt
    })),
    clinicalRecords: records.map((r) => ({
      id: r.id,
      type: r.type,
      date: r.date,
      title: r.title,
      details: r.details || "",
      protocolTag: r.protocolTag || "",
      createdAt: r.createdAt
    })),
    messages: messages.map((m) => ({
      id: m.id,
      text: m.text,
      authorName: m.authorName,
      createdAt: m.createdAt
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      notes: t.notes || "",
      status: t.status,
      dueDate: t.dueDate || "",
      createdAt: t.createdAt,
      updatedAt: t.updatedAt || t.createdAt
    }))
  };
}

function applyPatientCorrection(db, user, patient, corrections = {}) {
  const allowed = new Set([
    "name", "motherName", "phone", "phoneAlt", "cpf", "cns",
    "address", "microArea", "assignedAcsId", "careCategory", "chronicConditions",
    "maritalStatus", "sexAtBirth", "genderIdentity", "birthDate",
    "pregnancyStartDate", "expectedDeliveryDate",
    "gestationalAgeDumWeeks", "gestationalAgeDumDays",
    "gestationalAgeUsgWeeks", "gestationalAgeUsgDays",
    "usgDate1", "usgDate2", "usgDate3", "prenatalStartDate", "postpartumStartDate",
    "comorbidities", "medications", "allergies"
  ]);
  const next = { ...patient };
  const changedFields = [];

  for (const [key, value] of Object.entries(corrections || {})) {
    if (!allowed.has(key)) continue;
    if (key === "careCategory") {
      const normalized = normalizeCategory(
        String(value || "").trim(),
        getProtocolTemplateMap(db, user.teamId)
      );
      if (next[key] !== normalized) {
        next[key] = normalized;
        changedFields.push(key);
      }
      continue;
    }
    if (key === "chronicConditions") {
      const normalized = normalizeChronicConditions(value);
      const current = normalizeChronicConditions(next[key]);
      if (JSON.stringify(current) !== JSON.stringify(normalized)) {
        next[key] = normalized;
        changedFields.push(key);
      }
      continue;
    }
    const normalized = String(value || "").trim();
    if (String(next[key] || "") !== normalized) {
      next[key] = normalized;
      changedFields.push(key);
    }
  }

  next.updatedAt = new Date().toISOString();
  next.updatedBy = user.id;
  return { next, changedFields };
}

function anonymizePatientBundle(db, user, patient, reason = "", requestId = "") {
  const now = new Date().toISOString();
  const prefix = String(patient.id || "").slice(0, 8);
  const anonymizedName = `Paciente Anonimizado ${prefix}`;
  const idxPatient = db.patients.findIndex((p) => p.id === patient.id);
  if (idxPatient < 0) return { changed: false, stats: {} };

  db.patients[idxPatient] = {
    ...db.patients[idxPatient],
    name: anonymizedName,
    motherName: "",
    cpf: "",
    cns: "",
    phone: "",
    phoneAlt: "",
    address: "",
    microArea: "",
    assignedAcsId: "",
    chronicConditions: [],
    maritalStatus: "",
    sexAtBirth: "",
    // F2-04: SPECIAL_CATEGORY (LGPD Art. 11) — anonimizado obrigatoriamente
    genderIdentity: "",
    birthDate: "",
    pregnancyStartDate: "",
    expectedDeliveryDate: "",
    gestationalAgeDumWeeks: "",
    gestationalAgeDumDays: "",
    gestationalAgeUsgWeeks: "",
    gestationalAgeUsgDays: "",
    usgDate1: "",
    usgDate2: "",
    usgDate3: "",
    prenatalStartDate: "",
    postpartumStartDate: "",
    comorbidities: "",
    medications: "",
    allergies: "",
    // F2-08: special-category / LGPD sensitive fields
    racaCor: "",
    etnia: "",
    rendaFamiliar: "",
    cnsResponsavel: "",
    socialVulnerability: "",
    substanceDependency: "",
    domesticViolence: "",
    updatedAt: now,
    updatedBy: user.id,
    privacy: {
      anonymizedAt: now,
      anonymizedBy: user.id,
      reason: String(reason || "").slice(0, 300),
      requestId: requestId || ""
    }
  };

  const appointments = db.appointments.filter((a) => a.patientId === patient.id).length;
  const agendaEntries = db.agendaEntries.filter((a) => a.patientId === patient.id).length;
  const clinicalRecords = db.clinicalRecords.filter((r) => r.patientId === patient.id).length;
  const messages = db.messages.filter((m) => m.patientId === patient.id).length;
  const tasks = db.tasks.filter((t) => t.patientId === patient.id).length;
  const referrals = db.referrals.filter((r) => r.patientId === patient.id).length;
  const suppliesLogs = db.suppliesLogs.filter((r) => r.patientId === patient.id).length;
  const suppliesContinuous = db.suppliesContinuous.filter((r) => r.patientId === patient.id).length;
  const exams = db.exams.filter((r) => r.patientId === patient.id).length;

  db.agendaEntries = db.agendaEntries.filter((a) => a.patientId !== patient.id);
  db.appointments = db.appointments.filter((a) => a.patientId !== patient.id);
  db.clinicalRecords = db.clinicalRecords.filter((r) => r.patientId !== patient.id);
  db.messages = db.messages.filter((m) => m.patientId !== patient.id);
  db.tasks = db.tasks.filter((t) => t.patientId !== patient.id);
  db.referrals = db.referrals.filter((r) => r.patientId !== patient.id);
  db.suppliesLogs = db.suppliesLogs.filter((r) => r.patientId !== patient.id);
  db.suppliesContinuous = db.suppliesContinuous.filter((r) => r.patientId !== patient.id);
  db.exams = db.exams.filter((r) => r.patientId !== patient.id);

  return {
    changed: true,
    stats: { agendaEntries, appointments, clinicalRecords, messages, tasks, referrals, suppliesLogs, suppliesContinuous, exams }
  };
}

// Roles com acesso de leitura clinica cross-UBS dentro do mesmo municipio (US-204)
const CLINICAL_READ_ROLES = new Set(["doctor", "nurse_manager", "dentist", "nursing_tech"]);

// D-07: roles autorizadas a registrar atendimento cross-team na APS municipal
const CLINICAL_WRITE_CROSS_TEAM_ROLES = new Set(["doctor", "nurse_manager", "dentist"]);

function canAccessPatient(user, patient, mode = "write") {
  // Guard obrigatorio — PRIMEIRA linha, antes de qualquer branch de mode
  if (!patient) return false;
  // break_glass_admin sempre tem acesso em qualquer modo
  if (canonicalRole(user?.role) === "break_glass_admin") return true;

  if (mode === "read") {
    const role = canonicalRole(user?.role);
    if (!CLINICAL_READ_ROLES.has(role)) return false;
    const userMuni = String(user?.municipalityId || "").trim();
    const patientMuni = String(patient.municipalityId || "").trim();
    // Fallback seguro: se municipalityId ausente em qualquer lado, exige teamId match
    if (!userMuni || !patientMuni) {
      return String(patient.teamId || "") === String(user?.teamId || "");
    }
    // Cross-municipio: sempre negar
    if (userMuni !== patientMuni) return false;
    // Mesmo municipio com role clinica: permitir leitura cross-UBS
    return true;
  }

  // D-06: clinical_write — permite cross-team dentro do mesmo municipio para roles autorizadas
  if (mode === "clinical_write") {
    const role = canonicalRole(user?.role);
    if (!CLINICAL_WRITE_CROSS_TEAM_ROLES.has(role)) return false;
    const userMuni = String(user?.municipalityId || "").trim();
    const patientMuni = String(patient.municipalityId || "").trim();
    // Sem municipalityId em qualquer lado: exige teamId match (fail-safe)
    if (!userMuni || !patientMuni) {
      return String(patient.teamId || "") === String(user?.teamId || "");
    }
    // Cross-municipio: sempre negar
    if (userMuni !== patientMuni) return false;
    // Mesmo municipio com role clinica autorizada: permitir escrita cross-team
    return true;
  }

  // F6-02: ACS write — exige teamId match E assignedAcsId match
  if (canonicalRole(user?.role) === "acs") {
    return String(patient.teamId || "") === String(user?.teamId || "")
      && String(patient.assignedAcsId || "") === String(user?.id || "");
  }

  // mode === "write" (default): comportamento original preservado integralmente
  return String(patient.teamId || "") === String(user?.teamId || "");
}

// D-12: sumário restrito para busca municipal de recepção — sem dados clínicos ou sensíveis
function buildReceptionistPatientSummary(patient) {
  if (!patient) return null;
  const masked = maskSensitivePatientFields(patient);
  return {
    id: patient.id,
    name: patient.name,
    birthDate: patient.birthDate || "",
    cpf: masked.cpf || "",
    cns: masked.cns || "",
    unitId: patient.unitId || "",
    teamId: patient.teamId || "",
    inactive: patient.inactive || false
  };
}

function buildGestorUnitTeamIds(db, user) {
  const userUnitId = String(user?.unitId || "").trim();
  if (!userUnitId) return null; // null = gestor without unitId = no access
  return new Set(
    (db.teams || []).filter((t) => String(t.unitId || "").trim() === userUnitId).map((t) => t.id)
  );
}

function getAllowedPatients(db, user, query) {
  const microArea = query.microArea ? String(query.microArea).trim() : "";
  const acsId = query.acsId ? String(query.acsId).trim() : "";
  const careCategory = query.careCategory ? String(query.careCategory).trim() : "";
  const includeInactive = String(query.includeInactive || "").trim() === "true";

  // D-12: Receptionist — busca municipal com sumário restrito (sem dados clínicos/sensíveis)
  // Retorna todos os pacientes do município; filtragem de campos ocorre na rota via buildReceptionistPatientSummary
  if (canonicalRole(user?.role) === "receptionist") {
    const userMuni = String(user?.municipalityId || "").trim();
    return db.patients.filter((p) => {
      if (!includeInactive && p.inactive) return false;
      if (userMuni) {
        const patientMuni = String(p.municipalityId || "").trim();
        if (patientMuni && patientMuni !== userMuni) return false;
      } else {
        // Sem municipalityId: fallback para mesma equipe (seguro)
        if (String(p.teamId || "") !== String(user?.teamId || "")) return false;
      }
      if (careCategory && p.careCategory !== careCategory) return false;
      return true;
    });
  }

  // F6-01: ACS — vê apenas pacientes atribuídos a si (assignedAcsId === user.id)
  if (canonicalRole(user?.role) === "acs") {
    return db.patients.filter((p) => {
      if (!includeInactive && p.inactive) return false;
      if (String(p.teamId || "") !== String(user?.teamId || "")) return false;
      if (String(p.assignedAcsId || "") !== String(user?.id || "")) return false;
      if (microArea && p.microArea !== microArea) return false;
      if (careCategory && p.careCategory !== careCategory) return false;
      return true;
    });
  }

  // Gestor: unit-scoped access — can only see patients in teams of their unit
  if (canonicalRole(user?.role) === "gestor") {
    const unitTeamIds = buildGestorUnitTeamIds(db, user);
    if (!unitTeamIds) return []; // fail-safe: gestor without unitId sees nothing
    return db.patients.filter((p) => {
      if (!includeInactive && p.inactive) return false;
      if (!unitTeamIds.has(String(p.teamId || "").trim())) return false;
      if (microArea && p.microArea !== microArea) return false;
      if (acsId && p.assignedAcsId !== acsId) return false;
      if (careCategory && p.careCategory !== careCategory) return false;
      return true;
    });
  }

  return db.patients.filter((p) => {
    if (!includeInactive && p.inactive) return false;
    if (!canAccessPatient(user, p)) return false;
    if (microArea && p.microArea !== microArea) return false;
    if (acsId && p.assignedAcsId !== acsId) return false;
    if (careCategory && p.careCategory !== careCategory) return false;
    return true;
  });
}

function getPatientOrError(db, user, patientId, mode = "write") {
  const patient = db.patients.find((p) => p.id === patientId);
  if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };

  // Gestor: unit-scoped access check — gestor tem path proprio, mode nao se aplica
  if (canonicalRole(user?.role) === "gestor") {
    const unitTeamIds = buildGestorUnitTeamIds(db, user);
    if (!unitTeamIds) return { error: { status: 403, message: "Gestor sem unidade definida" } };
    if (!unitTeamIds.has(String(patient.teamId || "").trim())) {
      return { error: { status: 403, message: "Sem permissão para este paciente" } };
    }
    return { patient };
  }

  if (!canAccessPatient(user, patient, mode)) {
    return { error: { status: 403, message: "Sem permissão para este paciente" } };
  }
  return { patient };
}

function buildPatientHistory(db, patientId) {
  const appointmentEvents = db.appointments
    .filter((a) => a.patientId === patientId)
    .map((a) => ({
      id: a.id,
      patientId,
      date: a.date,
      type: "appointment",
      title: a.summary,
      details: [a.conduct, a.nextStep].filter(Boolean).join(" | "),
      source: "appointment",
      createdBy: a.createdBy,
      createdAt: a.createdAt,
      metadata: { demandType: normalizeDemandType(a.demandType) }
    }));

  const clinicalEvents = db.clinicalRecords
    .filter((r) => r.patientId === patientId)
    .map((r) => ({ ...r, source: "clinicalRecord" }));

  return [...appointmentEvents, ...clinicalEvents].sort((a, b) => {
    const da = eventDate(a);
    const dbDate = eventDate(b);
    if (da && dbDate) return dbDate.getTime() - da.getTime();
    if (da) return -1;
    if (dbDate) return 1;
    return String(b.date || "").localeCompare(String(a.date || ""));
  });
}

function maskSensitivePatientFields(patient) {
  if (!patient) return patient;
  const masked = { ...patient };
  if (masked.cpf) masked.cpf = "***.***.***-**";
  if (masked.cns) masked.cns = "***.***.***.*****-**";
  return masked;
}

export {
  isAnonymizedPatient,
  getPatientActivityDate,
  buildPatientAccessReport,
  applyPatientCorrection,
  anonymizePatientBundle,
  canAccessPatient,
  getAllowedPatients,
  getPatientOrError,
  buildPatientHistory,
  maskSensitivePatientFields,
  buildReceptionistPatientSummary,
  CLINICAL_WRITE_CROSS_TEAM_ROLES
};
