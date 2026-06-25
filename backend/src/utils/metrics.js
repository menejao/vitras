import { normalizeDemandType, toDateOnlySafe, normalizeText, isAcs, isDoctor, isDentalText } from "./helpers.js";
import { normalizeCategory, DEFAULT_CARE_PROTOCOLS, getProtocolTemplateMap } from "./domain.js";
import { getAllowedPatients, buildPatientHistory } from "./patients.js";
import { buildProtocolSummary } from "./protocol-eval.js";

function parseMonthPeriod(monthText = "") {
  const now = new Date();
  const fallbackYear = now.getFullYear();
  const fallbackMonth = now.getMonth() + 1;
  const raw = String(monthText || "").trim();
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  const year = match ? Number(match[1]) : fallbackYear;
  const month = match ? Number(match[2]) : fallbackMonth;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { year, month, start, end, key: `${year}-${String(month).padStart(2, "0")}` };
}

function buildMonthlyDemandMetric(db, teamId, monthText = "") {
  const period = parseMonthPeriod(monthText);
  if (!period) return null;

  const teamPatientIds = new Set(db.patients.filter((p) => p.teamId === teamId).map((p) => p.id));
  const inMonth = db.appointments.filter((a) => {
    if (!teamPatientIds.has(a.patientId)) return false;
    const d = new Date(a.date || a.createdAt || "");
    if (Number.isNaN(d.getTime())) return false;
    return d >= period.start && d < period.end;
  });

  const scheduled = inMonth.filter((a) => normalizeDemandType(a.demandType) === "scheduled").length;
  const spontaneous = inMonth.filter((a) => normalizeDemandType(a.demandType) === "spontaneous").length;
  const total = scheduled + spontaneous;
  const ratioScheduled = total > 0 ? Number(((scheduled / total) * 100).toFixed(2)) : 0;
  const min = 50;
  const max = 70;
  const outOfRange = total > 0 && (ratioScheduled < min || ratioScheduled > max);

  return {
    month: period.key,
    range: {
      start: period.start.toISOString(),
      endExclusive: period.end.toISOString()
    },
    totals: {
      scheduled,
      spontaneous,
      total
    },
    ratioScheduled,
    target: { min, max },
    status: total === 0 ? "no_data" : (outOfRange ? "out_of_range" : "in_range"),
    alert: outOfRange
      ? `Razão programada fora da faixa (50-70%). Atual: ${ratioScheduled.toFixed(2)}%.`
      : ""
  };
}

function buildDataQualityMetric(db, teamId) {
  const teamPatients = db.patients.filter((p) => p.teamId === teamId);
  const total = teamPatients.length;
  const cpfIndex = new Map();
  const cnsIndex = new Map();
  const stats = {
    totalPatients: total,
    missingPhone: 0,
    missingAddress: 0,
    missingCpf: 0,
    missingCns: 0,
    missingAcs: 0,
    duplicatedCpfPatients: 0,
    duplicatedCnsPatients: 0
  };

  for (const patient of teamPatients) {
    const phone = String(patient.phone || "").trim();
    const address = String(patient.address || "").trim();
    const cpf = String(patient.cpf || "").replace(/\D+/g, "");
    const cns = String(patient.cns || "").replace(/\D+/g, "");
    if (!phone) stats.missingPhone += 1;
    if (!address) stats.missingAddress += 1;
    if (!cpf) stats.missingCpf += 1;
    if (!cns) stats.missingCns += 1;
    if (!String(patient.assignedAcsId || "").trim()) stats.missingAcs += 1;
    if (cpf) cpfIndex.set(cpf, (cpfIndex.get(cpf) || 0) + 1);
    if (cns) cnsIndex.set(cns, (cnsIndex.get(cns) || 0) + 1);
  }

  stats.duplicatedCpfPatients = teamPatients.filter((p) => {
    const cpf = String(p.cpf || "").replace(/\D+/g, "");
    return cpf && (cpfIndex.get(cpf) || 0) > 1;
  }).length;
  stats.duplicatedCnsPatients = teamPatients.filter((p) => {
    const cns = String(p.cns || "").replace(/\D+/g, "");
    return cns && (cnsIndex.get(cns) || 0) > 1;
  }).length;

  const critical = stats.missingPhone + stats.missingAcs + stats.duplicatedCpfPatients + stats.duplicatedCnsPatients;
  const warning = stats.missingAddress + stats.missingCpf + stats.missingCns;
  const score = total > 0 ? Math.max(0, Math.min(100, Math.round(100 - ((critical * 2 + warning) / total) * 25))) : 100;

  return {
    generatedAt: new Date().toISOString(),
    score,
    stats,
    summary: `Qualidade de dados: ${score}/100. Críticos: ${critical}. Alertas: ${warning}.`
  };
}

function buildAiPatientContext(db, user, patient) {
  const history = buildPatientHistory(db, patient.id);
  const protocolSummary = buildProtocolSummary(patient, history, getProtocolTemplateMap(db, user.teamId));
  const tasks = db.tasks.filter((t) => t.patientId === patient.id);
  const appointments = db.appointments.filter((a) => a.patientId === patient.id);
  const messages = db.messages.filter((m) => m.patientId === patient.id);
  return {
    patient,
    history,
    tasks,
    appointments,
    messages,
    protocolSummary
  };
}

function buildAiTeamContexts(db, user) {
  const patients = getAllowedPatients(db, user, {});
  return patients.map((patient) => buildAiPatientContext(db, user, patient));
}

function getTeamUserUsage(db, userId, teamId) {
  const teamPatientIds = new Set(db.patients.filter((p) => p.teamId === teamId).map((p) => p.id));
  const assignedPatients = db.patients.filter((p) => p.teamId === teamId && p.assignedAcsId === userId).length;
  const openTasksAssigned = db.tasks.filter((t) => teamPatientIds.has(t.patientId) && t.assigneeId === userId && t.status !== "done").length;
  const appointmentsAuthored = db.appointments.filter((a) => teamPatientIds.has(a.patientId) && a.createdBy === userId).length;
  const messagesAuthored = db.messages.filter((m) => teamPatientIds.has(m.patientId) && m.authorId === userId).length;
  const clinicalRecordsAuthored = db.clinicalRecords.filter((r) => teamPatientIds.has(r.patientId) && r.createdBy === userId).length;
  const linkedTotal = assignedPatients + openTasksAssigned + appointmentsAuthored + messagesAuthored + clinicalRecordsAuthored;
  return {
    assignedPatients,
    openTasksAssigned,
    appointmentsAuthored,
    messagesAuthored,
    clinicalRecordsAuthored,
    linkedTotal
  };
}

function validateClinicalRecordPayload({ user, patient, type, title, date, details, metadata }) {
  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle) return { ok: false, error: "Título do registro é obrigatório" };
  if (!toDateOnlySafe(date)) return { ok: false, error: "Data do registro inválida" };
  if (String(normalizedTitle).length > 180) return { ok: false, error: "Título excede o limite de 180 caracteres" };
  if (String(details || "").length > 4000) return { ok: false, error: "Detalhes excedem o limite de 4000 caracteres" };

  if (isAcs(user)) {
    if (type !== "visit") return { ok: false, error: "ACS pode registrar apenas visita domiciliar" };
    if (normalizeText(normalizedTitle) !== "visita acs") {
      return { ok: false, error: "ACS deve registrar o título padrão 'Visita ACS'" };
    }
  }

  if (isDoctor(user) && type === "visit") {
    return { ok: false, error: "Médica não registra visita domiciliar" };
  }
  if (type === "visit" && !String(patient?.assignedAcsId || "").trim()) {
    return { ok: false, error: "Não é possível registrar visita sem ACS responsável vinculado ao paciente" };
  }

  if (type === "vaccine") {
    const vaccineName = String(metadata?.vaccineName || normalizedTitle).trim();
    if (!vaccineName) return { ok: false, error: "Informe o nome da vacina no título ou em metadata.vaccineName" };
  }

  const patientCategory = normalizeCategory(patient?.careCategory || "general", DEFAULT_CARE_PROTOCOLS);
  if (patientCategory === "pregnant" && type === "consultation" && isDentalText(normalizedTitle)) {
    return { ok: true, warning: "Consulta odontológica registrada separadamente das consultas pré-natais." };
  }

  return { ok: true };
}

function buildTeamDemandByProfessional(db, teamId, monthText = "") {
  const period = parseMonthPeriod(monthText);
  if (!period) return [];

  const teamPatientIds = new Set(db.patients.filter((p) => p.teamId === teamId).map((p) => p.id));
  const inMonth = db.appointments.filter((a) => {
    if (!teamPatientIds.has(a.patientId)) return false;
    const d = new Date(a.date || a.createdAt || "");
    if (Number.isNaN(d.getTime())) return false;
    return d >= period.start && d < period.end;
  });

  const clinicalRoles = new Set(["doctor", "nurse_manager", "dentist", "nursing_tech"]);
  const professionals = (db.users || []).filter(
    (u) => u.teamId === teamId && clinicalRoles.has(u.role)
  );

  const min = 50;
  const max = 70;

  return professionals.map((prof) => {
    const profAppts = inMonth.filter((a) => a.createdBy === prof.id);
    const scheduled = profAppts.filter((a) => normalizeDemandType(a.demandType) === "scheduled").length;
    const spontaneous = profAppts.filter((a) => normalizeDemandType(a.demandType) === "spontaneous").length;
    const total = scheduled + spontaneous;
    const ratioScheduled = total > 0 ? Number(((scheduled / total) * 100).toFixed(2)) : 0;
    const outOfRange = total > 0 && (ratioScheduled < min || ratioScheduled > max);
    return {
      userId: prof.id,
      name: prof.name,
      role: prof.role,
      scheduled,
      spontaneous,
      total,
      ratioScheduled,
      status: total === 0 ? "no_data" : (outOfRange ? "out_of_range" : "in_range"),
    };
  });
}

export {
  parseMonthPeriod,
  buildMonthlyDemandMetric,
  buildTeamDemandByProfessional,
  buildDataQualityMetric,
  buildAiPatientContext,
  buildAiTeamContexts,
  getTeamUserUsage,
  validateClinicalRecordPayload
};
