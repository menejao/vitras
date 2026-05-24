import { canAccessAllPatients, canAccessScopedPatients, normalizeDemandType, eventDate } from "./helpers.js";
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
    "name", "motherName", "phone", "phoneAlt", "cpf", "cns", "cnsCpf",
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
    cnsCpf: "",
    phone: "",
    phoneAlt: "",
    address: "",
    microArea: "",
    assignedAcsId: "",
    chronicConditions: [],
    maritalStatus: "",
    sexAtBirth: "",
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

function canAccessPatient(user, patient) {
  if (!patient) return false;
  if (canAccessAllPatients(user)) return true;
  if (canAccessScopedPatients(user)) {
    return String(patient.teamId || "") === String(user?.teamId || "");
  }
  return false;
}

function getAllowedPatients(db, user, query) {
  const microArea = query.microArea ? String(query.microArea).trim() : "";
  const acsId = query.acsId ? String(query.acsId).trim() : "";
  const careCategory = query.careCategory ? String(query.careCategory).trim() : "";
  // includeInactive=true allows managers to retrieve inactive patients explicitly
  const includeInactive = String(query.includeInactive || "").trim() === "true";

  return db.patients.filter((p) => {
    if (!includeInactive && p.inactive) return false;
    if (!canAccessPatient(user, p)) return false;
    if (microArea && p.microArea !== microArea) return false;
    if (acsId && p.assignedAcsId !== acsId) return false;
    if (careCategory && p.careCategory !== careCategory) return false;
    return true;
  });
}

function getPatientOrError(db, user, patientId) {
  const patient = db.patients.find((p) => p.id === patientId);
  if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };
  if (!canAccessPatient(user, patient)) {
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
  if (masked.cnsCpf) masked.cnsCpf = "***.***.***-**";
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
  maskSensitivePatientFields
};
