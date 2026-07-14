/* ── Role utilities ── */

function canonicalRole(role) {
  const input = String(role || "").trim().toLowerCase();
  if (input === "nurse") return "nurse_manager";
  if (input === "medica") return "doctor";
  if (input === "enfermeiro") return "nurse_manager";
  return input;
}

const ROLE_CAPABILITIES = {
  nurse_manager: [
    "dashboard.read",
    "patients.read.all",
    "patients.write",
    "agenda.read",
    "agenda.write",
    "referrals.read",
    "referrals.write",
    "records.read",
    "records.write",
    "exams.read",
    "exams.write",
    "exams.request",
    "exams.execute",
    "exams.result",
    "appointments.write",
    "tasks.read",
    "tasks.write",
    "messages.read",
    "messages.write",
    "protocols.manage",
    "reports.read",
    "diagnostics.read",
    "pharmacy.read",
    "receitas.read",
    "receitas.write",
    "supplies.read",
    "supplies.write",
    "users.read.scoped",
    "users.manage.scoped",
    "audit.read",
    "privacy.manage",
    "team.manage",
    "backup.export",
    "admin.seed",
    "metrics.internal.read",
    "ai.access",
    "acs.visit.read",
    "acs.visit.update"
  ],
  doctor: [
    "dashboard.read",
    "patients.read.all",
    "patients.write",
    "agenda.read",
    "agenda.write",
    "referrals.read",
    "referrals.write",
    "records.read",
    "records.write",
    "exams.read",
    "exams.write",
    "exams.request",
    "appointments.write",
    "tasks.read",
    "tasks.write",
    "messages.read",
    "messages.write",
    "protocols.manage",
    "reports.read",
    "diagnostics.read",
    "pharmacy.read",
    "receitas.read",
    "receitas.write",
    "supplies.read",
    "users.read.scoped",
    "audit.read",
    "ai.access",
    "acs.visit.read"
  ],
  dentist: [
    "dashboard.read",
    "patients.read.all",
    "records.read",
    "records.write",
    "exams.read",
    "exams.write",
    "exams.request",
    "referrals.read",
    "referrals.write",
    "reports.read",
    "dental.read",
    "dental.write",
    "diagnostics.read",
    "receitas.read",
    "receitas.write",
    "users.read.scoped",
    "ai.access"
  ],
  gestor: [
    "dashboard.read",
    "patients.read.all",
    "agenda.read",
    "referrals.read",
    "referrals.write",
    "records.read",
    "exams.read",
    "reports.read",
    "diagnostics.read",
    "pharmacy.read",
    "receitas.read",
    "dispensacoes.read",
    "supplies.read",
    "dental.read",
    "almoxarifado.read",
    "users.read.all",
    "users.manage.all",
    "audit.read",
    "access_requests.read",
    "backup.export",
    "admin.seed",
    "metrics.internal.read",
    "cds.export",
    "acs.visit.read",
    "schedule.configuration.read",
    "schedule.configuration.update",
    "schedule.block.manage"
  ],
  acs: [
    "dashboard.read",
    "patients.read.scoped",
    "records.read",
    "records.write",
    "referrals.read",
    "referrals.write",
    "tasks.read",
    "tasks.write",
    "acs.visit.create",
    "acs.visit.read",
    "acs.visit.update"
  ],
  nursing_tech: [
    "dashboard.read",
    "queue.read",
    "queue.write",
    "agenda.read",
    "referrals.read",
    "referrals.write",
    "patients.read.all",
    "records.read",
    "exams.read",
    "exams.write",
    "exams.request",
    "exams.execute",
    "exams.result",
    "reports.read",
    "supplies.read",
    "supplies.write"
  ],
  pharmacist: [
    "dashboard.read",
    "pharmacy.read",
    "pharmacy.write",
    "receitas.read",
    "receitas.write",
    "dispensacoes.read",
    "dispensacoes.write",
    "supplies.read",
    "supplies.write",
    "almoxarifado.read",
    "almoxarifado.write"
  ],
  pharmacy_tech: [
    "dashboard.read",
    "pharmacy.read",
    "receitas.read",
    "dispensacoes.read",
    "dispensacoes.write",
    "supplies.read",
    "supplies.write",
    "almoxarifado.read"
  ],
  receptionist: [
    "dashboard.read",
    "patients.read.scoped",
    "queue.read",
    "queue.write",
    "agenda.read",
    "agenda.write"
  ],
  developer_readonly: [
    "dashboard.read",
    "patients.read.scoped",
    "records.read",
    "reports.read",
    "diagnostics.read",
    "users.read.all",
    "session.impersonate"
  ],
  support_operator: [
    "dashboard.read",
    "patients.read.scoped",
    "records.read",
    "reports.read",
    "diagnostics.read",
    "users.read.all",
    "session.impersonate"
  ],
  qa_operator: [
    "dashboard.read",
    "patients.read.scoped",
    "records.read",
    "reports.read",
    "diagnostics.read",
    "users.read.all",
    "session.impersonate"
  ],
  security_auditor: [
    "dashboard.read",
    "patients.read.scoped",
    "records.read",
    "reports.read",
    "diagnostics.read",
    "users.read.all",
    "audit.read",
    "users.activity_log.read",
    "metrics.internal.read",
    "session.impersonate",
    "acs.visit.read"
  ],
  break_glass_admin: [
    "dashboard.read",
    "patients.read.all",
    "patients.write",
    "records.read",
    "records.write",
    "exams.read",
    "exams.write",
    "exams.request",
    "exams.execute",
    "exams.result",
    "exams.admin",
    "appointments.write",
    "tasks.read",
    "tasks.write",
    "messages.read",
    "messages.write",
    "protocols.manage",
    "reports.read",
    "diagnostics.read",
    "queue.read",
    "queue.write",
    "agenda.read",
    "agenda.write",
    "referrals.read",
    "referrals.write",
    "pharmacy.read",
    "pharmacy.write",
    "receitas.read",
    "receitas.write",
    "dispensacoes.read",
    "dispensacoes.write",
    "supplies.read",
    "supplies.write",
    "dental.read",
    "dental.write",
    "almoxarifado.read",
    "almoxarifado.write",
    "users.read.all",
    "users.manage.all",
    "audit.read",
    "privacy.manage",
    "team.manage",
    "backup.export",
    "users.activity_log.read",
    "access_requests.read",
    "admin.seed",
    "metrics.internal.read",
    "session.impersonate",
    "session.break_glass.activate",
    "ai.access",
    "cds.export",
    "acs.visit.create",
    "acs.visit.read",
    "acs.visit.update"
  ],
  oral_health_aux: [
    "dashboard.read",
    "patients.read.all",
    "records.read",
    "records.write",
    "exams.read",
    "referrals.read",
    "dental.read",
    "users.read.scoped"
  ],
  oral_health_tech: [
    "dashboard.read",
    "patients.read.all",
    "records.read",
    "records.write",
    "exams.read",
    "exams.write",
    "referrals.read",
    "referrals.write",
    "users.read.scoped"
  ],
  psychologist: [
    "dashboard.read",
    "patients.read.all",
    "records.read",
    "records.write",
    "referrals.read",
    "referrals.write",
    "tasks.read",
    "tasks.write",
    "users.read.scoped"
  ],
  physical_therapist: [
    "dashboard.read",
    "patients.read.all",
    "records.read",
    "records.write",
    "referrals.read",
    "referrals.write",
    "tasks.read",
    "tasks.write",
    "users.read.scoped"
  ],
  social_worker: [
    "dashboard.read",
    "patients.read.all",
    "records.read",
    "records.write",
    "referrals.read",
    "referrals.write",
    "tasks.read",
    "tasks.write",
    "users.read.scoped"
  ],
  nutritionist: [
    "dashboard.read",
    "patients.read.all",
    "records.read",
    "records.write",
    "referrals.read",
    "referrals.write",
    "tasks.read",
    "tasks.write",
    "users.read.scoped"
  ],
  physical_educator: [
    "dashboard.read",
    "patients.read.all",
    "records.read",
    "records.write",
    "tasks.read",
    "tasks.write",
    "users.read.scoped"
  ],
  local_admin: [
    "dashboard.read",
    "patients.read.all",
    "agenda.read",
    "referrals.read",
    "reports.read",
    "diagnostics.read",
    "pharmacy.read",
    "supplies.read",
    "users.read.all",
    "users.manage.scoped",
    "audit.read",
    "metrics.internal.read"
  ],
  aps_coordinator: [
    "dashboard.read",
    "patients.read.all",
    "agenda.read",
    "referrals.read",
    "referrals.write",
    "records.read",
    "exams.read",
    "reports.read",
    "diagnostics.read",
    "pharmacy.read",
    "supplies.read",
    "users.read.all",
    "audit.read",
    "metrics.internal.read",
    "cds.export",
    "acs.visit.read"
  ],
  support_admin: [
    "platform.unit.create",
    "platform.unit.read",
    "platform.unit.update",
    "platform.unit.deactivate",
    "platform.team.create",
    "platform.initial_manager.create",
    "platform.password.reset",
    "platform.audit.read",
    "platform.health.read",
    "platform.citizen_portal.read",
    "platform.citizen_portal.update",
    "schedule.configuration.read",
    "schedule.configuration.update",
    "schedule.block.manage"
  ]
};

const BREAK_GLASS_CAPABILITIES = [
  "patients.read.all",
  "patients.write",
  "records.read",
  "records.write",
  "appointments.write",
  "tasks.read",
  "tasks.write",
  "messages.read",
  "messages.write",
  "protocols.manage",
  "reports.read",
  "diagnostics.read",
  "users.read.all",
  "users.manage.all",
  "audit.read",
  "privacy.manage",
  "team.manage",
  "ai.access"
];

function uniqueCapabilities(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function isBreakGlassSessionActive(breakGlass) {
  if (!breakGlass?.active) return false;
  const expiresAt = String(breakGlass?.expiresAt || "").trim();
  if (!expiresAt) return true;
  const expiresTs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresTs)) return false;
  return expiresTs > Date.now();
}

function getRoleCapabilities(role) {
  return ROLE_CAPABILITIES[canonicalRole(role)] || [];
}

function getCapabilitiesForUser(user, options = {}) {
  const base = options.capabilities
    ? uniqueCapabilities(options.capabilities)
    : uniqueCapabilities(getRoleCapabilities(user?.role));
  if (isBreakGlassSessionActive(options.breakGlass || user?.breakGlass)) {
    return uniqueCapabilities([...base, ...BREAK_GLASS_CAPABILITIES]);
  }
  return base;
}

function hasCapability(user, capability) {
  const expected = String(capability || "").trim();
  if (!expected) return false;
  return getCapabilitiesForUser(user).includes(expected);
}

function hasAnyCapability(user, capabilities = []) {
  return capabilities.some((capability) => hasCapability(user, capability));
}

function normalizeDemandType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "spontaneous" || raw === "espontanea" || raw === "espontânea") return "spontaneous";
  return "scheduled";
}

function councilTypeForRole(role) {
  if (role === "doctor") return "CRM";
  if (role === "nurse_manager") return "COREN";
  return "";
}

function roleNeedsCouncil(role) {
  return ["doctor", "nurse_manager"].includes(role);
}

function hasRole(user, allowedRoles = []) {
  const current = canonicalRole(user?.role);
  return allowedRoles.map((r) => canonicalRole(r)).includes(current);
}

function isManager(user) {
  const role = canonicalRole(user?.role);
  return role === "nurse_manager" || role === "break_glass_admin";
}

function isDoctor(user) {
  return canonicalRole(user?.role) === "doctor";
}

function isAcs(user) {
  return canonicalRole(user?.role) === "acs";
}

function isGestor(user) {
  return canonicalRole(user?.role) === "gestor";
}

function canAccessUnit(user, unitId) {
  const userUnitId = String(user?.unitId || "").trim();
  if (!userUnitId) return false; // fail-safe: no unitId = no unit-scoped access
  return userUnitId === String(unitId || "").trim();
}

function canAccessAllPatients(user) {
  return canonicalRole(user?.role) === "break_glass_admin";
}

// Centralized team-scope check with break_glass_admin bypass.
// break_glass_admin has UBS-wide access and is not bound to any clinical team.
// All other roles: require user.teamId === targetTeamId.
function canAccessTeamScope(user, targetTeamId) {
  if (canonicalRole(user?.role) === "break_glass_admin") return true;
  const userTeamId = String(user?.teamId || "").trim();
  if (!userTeamId) return false;
  return userTeamId === String(targetTeamId || "").trim();
}

function canAccessScopedPatients(user) {
  return hasCapability(user, "patients.read.scoped");
}

function isAnaAdminUser(user) {
  return hasCapability(user, "users.activity_log.read");
}

function isSupportAdmin(user) {
  return canonicalRole(user?.role) === "support_admin";
}

// Roles that belong to the technical/platform team — invisible in UBS user listings.
const PLATFORM_ROLES = new Set([
  "support_admin", "break_glass_admin", "developer_readonly",
  "security_auditor", "qa_operator", "support_operator"
]);

function isPlatformRole(roleOrUser) {
  const r = typeof roleOrUser === "string"
    ? canonicalRole(roleOrUser)
    : canonicalRole(roleOrUser?.role);
  return PLATFORM_ROLES.has(r);
}

/* ── Validators ── */

function isStrongPassword(password) {
  const value = String(password || "");
  if (value.length < 8) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/\d/.test(value)) return false;
  if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]\/+=~`]/.test(value)) return false;
  return true;
}

function isValidEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSequentialDigits(input) {
  const chars = [...input].map((c) => Number(c));
  let asc = true;
  let desc = true;
  for (let i = 1; i < chars.length; i += 1) {
    if (chars[i] !== chars[i - 1] + 1) asc = false;
    if (chars[i] !== chars[i - 1] - 1) desc = false;
  }
  return asc || desc;
}

function isRepeatedDigits(input) {
  return /^(\d)\1+$/.test(input);
}

/* ── Network ── */

function getClientIp(req) {
  const headerIp = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return headerIp || String(req.ip || req.socket?.remoteAddress || "unknown");
}

/* ── Text utilities ── */

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function isDentalText(textValue = "") {
  const text = normalizeText(textValue);
  return /dent|odont|bucal|cirurgiao dentista/.test(text);
}

function isDentalConsultationTitle(textValue = "") {
  const text = normalizeText(textValue);
  if (!text) return false;
  return /(consulta|atendimento).*(odont|dent|bucal)|odontolog|dentista/.test(text);
}

function detectConsultationSpecialtyFromTitle(textValue = "") {
  const text = normalizeText(textValue);
  if (!text) return "general";
  if (/(odont|dent|bucal|dentista)/.test(text)) return "dental";
  if (/enferm/.test(text)) return "nursing";
  if (/(medic|pre natal|prenatal)/.test(text)) return "medical";
  return "general";
}

function normalizeConsultationTitle(title = "", specialty = "general") {
  if (specialty === "medical") return "Consulta médica";
  if (specialty === "nursing") return "Consulta de enfermagem";
  if (specialty === "dental") return "Consulta odontológica";
  return String(title || "").trim() || "Consulta";
}

function isDentalRecord(entry) {
  const type = String(entry?.type || "").toLowerCase();
  const title = String(entry?.title || "");
  const specialty = normalizeText(entry?.metadata?.specialty || "");
  if (type === "consultation") {
    if (/odont|dent|bucal/.test(specialty)) return true;
    return isDentalConsultationTitle(title);
  }
  const text = `${entry?.title || ""} ${entry?.details || ""}`;
  return isDentalText(text);
}

function isMedicalOrNursingConsultationText(textValue = "") {
  const text = normalizeText(textValue);
  if (!text) return false;
  return /consulta/.test(text) && /(medic|enferm|pre natal|prenatal)/.test(text);
}

function isClinicalConsultation(entry) {
  if (!entry) return false;
  if (entry.type === "consultation") {
    return !isDentalRecord(entry);
  }
  if (["procedure", "note"].includes(String(entry.type || ""))) {
    const text = `${entry?.title || ""} ${entry?.details || ""}`;
    return isMedicalOrNursingConsultationText(text);
  }
  return false;
}

/* ── Date utilities ── */

function parseFlexibleDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getTime());
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const brMatch = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateOnlySafe(value) {
  const d = parseFlexibleDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysDiff(from, to = new Date()) {
  const left = toDateOnlySafe(from);
  const right = toDateOnlySafe(to);
  if (!left || !right) return null;
  return Math.floor((right.getTime() - left.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(baseDate, days) {
  const d = toDateOnlySafe(baseDate);
  if (!d) return null;
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function addMonths(baseDate, months) {
  const d = toDateOnlySafe(baseDate);
  if (!d) return null;
  d.setMonth(d.getMonth() + Number(months || 0));
  return d;
}

/* ── Severity helpers ── */

function deadlineSeverity(daysLeft) {
  const value = Number(daysLeft);
  if (!Number.isFinite(value)) return "low";
  if (value < 0) return "high";
  if (value <= 5) return "medium";
  return "low";
}

function vaccineDeadlineSeverity(daysLeft) {
  const value = Number(daysLeft);
  if (!Number.isFinite(value)) return "low";
  if (value < 0) return "high";
  if (value <= 2) return "medium";
  return "low";
}

function homeVisitSeverityByDaysLeft(daysLeft) {
  const value = Number(daysLeft);
  if (!Number.isFinite(value)) return "low";
  if (value < 0) return "lost";
  if (value <= 3) return "high";
  if (value <= 7) return "medium";
  return "low";
}

function monitorWindowDaysLeft(patient, windowDays) {
  const now = toDateOnlySafe(new Date());
  const anchor = toDateOnlySafe(patient?.createdAt || patient?.updatedAt || now);
  const elapsed = Math.max(Number(daysDiff(anchor, now) || 0), 0);
  return Number(windowDays || 0) - elapsed;
}

/* ── Event date helper (used in protocol eval and patient history) ── */

function eventDate(entry) {
  return toDateOnlySafe(entry?.date || entry?.createdAt || "");
}

/* ── Rapid test detection ── */

function parseRapidTestTrimester(text = "") {
  const firstTrimesterPattern =
    /(?:\b1\s*(?:o|º)?\b|\bprimeir[oa]\b|\bt1\b)\s*(?:trim|trimestre|semestre)|(?:trim|trimestre|semestre)\s*(?:\b1\s*(?:o|º)?\b|\bprimeir[oa]\b|\bt1\b)/;
  const thirdTrimesterPattern =
    /(?:\b3\s*(?:o|º)?\b|\bterceir[oa]\b|\bt3\b)\s*(?:trim|trimestre|semestre)|(?:trim|trimestre|semestre)\s*(?:\b3\s*(?:o|º)?\b|\bterceir[oa]\b|\bt3\b)/;
  return {
    explicitFirst: firstTrimesterPattern.test(text),
    explicitThird: thirdTrimesterPattern.test(text)
  };
}

function detectRapidTestCoverage(entries, gestationStartDate) {
  const coverage = { hivFirst: false, sifFirst: false, hivThird: false, sifThird: false };
  for (const entry of entries) {
    const text = normalizeText(`${entry?.title || ""} ${entry?.details || ""}`);
    const metadataTrimester = normalizeText(entry?.metadata?.rapidTestTrimester || "");
    const hasExamContext =
      /(teste|exame|sorolog|colet|resultado|solicit|avali|procedimento|vdrl|treponem|fta)/.test(text);
    const hasTarget = /(hiv|sifil|vdrl|treponem|fta)/.test(text);
    if (!hasExamContext || !hasTarget) continue;
    const hasHiv = /(hiv|anti hiv|hiv 1|hiv 2)/.test(text);
    const hasSif = /(sifil|sifilis|vdrl|treponem|fta)/.test(text);
    if (!hasHiv && !hasSif) continue;
    const { explicitFirst, explicitThird } = parseRapidTestTrimester(text);
    const explicitFirstByMeta = /(first_trimester|primeiro|1o|1º|t1)/.test(metadataTrimester);
    const explicitThirdByMeta = /(third_trimester|terceiro|3o|3º|t3)/.test(metadataTrimester);
    const finalExplicitFirst = explicitFirst || explicitFirstByMeta;
    const finalExplicitThird = explicitThird || explicitThirdByMeta;
    const d = eventDate(entry);
    const week = d ? Math.floor((daysDiff(gestationStartDate, d) || 0) / 7) : null;
    const weekInFirst = week !== null && week >= 0 && week <= 13;
    const weekInThird = week !== null && week >= 28 && week <= 45;
    const markFirst = finalExplicitFirst || (!finalExplicitThird && weekInFirst);
    const markThird = finalExplicitThird || (!finalExplicitFirst && weekInThird);
    if (markFirst) {
      if (hasHiv) coverage.hivFirst = true;
      if (hasSif) coverage.sifFirst = true;
    }
    if (markThird) {
      if (hasHiv) coverage.hivThird = true;
      if (hasSif) coverage.sifThird = true;
    }
  }
  return coverage;
}

function matchesAnyAlias(text, aliases = []) {
  return aliases.some((alias) => normalizeText(text).includes(normalizeText(alias)));
}

/* ── Constants ── */

const ALLOWED_SELF_REGISTER_ROLES = ["nurse_manager", "doctor", "gestor"];
const PRIVACY_REQUEST_TYPES = new Set(["access", "correction", "deletion"]);
const PRIVACY_REQUEST_STATUS = new Set(["pending", "in_review", "approved", "rejected", "completed"]);
const VALID_UF = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]);

const APS_CARGO_CATALOG = [
  { id: "receptionist",       label: "Recepcionista",                   teamRequired: false },
  { id: "acs",                label: "Agente Comunitário de Saúde",      teamRequired: true  },
  { id: "nursing_tech",       label: "Técnico de Enfermagem",            teamRequired: true  },
  { id: "nurse_manager",      label: "Enfermeiro(a)",                    teamRequired: true  },
  { id: "doctor",             label: "Médico(a)",                        teamRequired: true  },
  { id: "dentist",            label: "Dentista",                         teamRequired: true  },
  { id: "oral_health_aux",    label: "Auxiliar de Saúde Bucal",          teamRequired: true  },
  { id: "oral_health_tech",   label: "Técnico de Saúde Bucal",           teamRequired: true  },
  { id: "pharmacist",         label: "Farmacêutico(a)",                  teamRequired: false },
  { id: "psychologist",       label: "Psicólogo(a)",                     teamRequired: false },
  { id: "physical_therapist", label: "Fisioterapeuta",                   teamRequired: false },
  { id: "social_worker",      label: "Assistente Social",                teamRequired: false },
  { id: "nutritionist",       label: "Nutricionista",                    teamRequired: false },
  { id: "physical_educator",  label: "Educador(a) Físico(a)",            teamRequired: false },
  { id: "gestor",             label: "Gestor(a) UBS",                    teamRequired: false },
  { id: "local_admin",        label: "Administrador(a) Local",           teamRequired: false },
  { id: "aps_coordinator",    label: "Coordenador(a) APS",               teamRequired: false },
];

export {
  canonicalRole,
  normalizeDemandType,
  councilTypeForRole,
  roleNeedsCouncil,
  hasRole,
  getRoleCapabilities,
  getCapabilitiesForUser,
  isBreakGlassSessionActive,
  hasCapability,
  hasAnyCapability,
  isManager,
  isDoctor,
  isAcs,
  isGestor,
  canAccessUnit,
  canAccessAllPatients,
  canAccessTeamScope,
  canAccessScopedPatients,
  isAnaAdminUser,
  isSupportAdmin,
  PLATFORM_ROLES,
  isPlatformRole,
  isStrongPassword,
  isValidEmail,
  isSequentialDigits,
  isRepeatedDigits,
  getClientIp,
  normalizeText,
  isDentalText,
  isDentalConsultationTitle,
  detectConsultationSpecialtyFromTitle,
  normalizeConsultationTitle,
  isDentalRecord,
  isMedicalOrNursingConsultationText,
  isClinicalConsultation,
  parseFlexibleDate,
  toDateOnlySafe,
  daysDiff,
  addDays,
  addMonths,
  deadlineSeverity,
  vaccineDeadlineSeverity,
  homeVisitSeverityByDaysLeft,
  monitorWindowDaysLeft,
  eventDate,
  parseRapidTestTrimester,
  detectRapidTestCoverage,
  matchesAnyAlias,
  ROLE_CAPABILITIES,
  BREAK_GLASS_CAPABILITIES,
  ALLOWED_SELF_REGISTER_ROLES,
  PRIVACY_REQUEST_TYPES,
  PRIVACY_REQUEST_STATUS,
  VALID_UF,
  APS_CARGO_CATALOG
};
