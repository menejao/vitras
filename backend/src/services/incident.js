/**
 * Incident service — ERP-05
 *
 * Tracks technical platform incidents during deployment and operations.
 * Never touches clinical domain (no patient, no clinical event, no CDS).
 *
 * Linkage to external entities is reference-only (string IDs):
 *   municipalityId, unitId, deploymentId, licenseId, breakGlassSessionId
 */

import { randomUUID } from "node:crypto";

// ── Categories ─────────────────────────────────────────────────────────────

export const INCIDENT_CATEGORIES = [
  "AUTH", "RBAC", "BREAK_GLASS", "DEPLOYMENT", "MIGRATION",
  "DATABASE", "API", "INTEGRATION", "BACKUP", "RESTORE",
  "PORTAL", "PERFORMANCE", "CONFIGURATION", "SECURITY",
  "OBSERVABILITY", "OTHER",
];

// ── Severity ───────────────────────────────────────────────────────────────

export const SEVERITY = {
  LOW:      "LOW",
  MEDIUM:   "MEDIUM",
  HIGH:     "HIGH",
  CRITICAL: "CRITICAL",
};

export const SEVERITY_PRIORITY = {
  CRITICAL: 1,
  HIGH:     2,
  MEDIUM:   3,
  LOW:      4,
};

// ── Status machine ─────────────────────────────────────────────────────────

export const INCIDENT_STATUS = {
  NEW:         "NEW",
  TRIAGED:     "TRIAGED",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING:     "WAITING",
  RESOLVED:    "RESOLVED",
  CLOSED:      "CLOSED",
  CANCELLED:   "CANCELLED",
  REOPENED:    "REOPENED",
};

const TERMINAL = new Set(["CLOSED", "CANCELLED"]);

const TRANSITIONS = {
  NEW:         ["TRIAGED", "CANCELLED"],
  TRIAGED:     ["IN_PROGRESS", "WAITING", "CANCELLED"],
  IN_PROGRESS: ["WAITING", "RESOLVED", "CANCELLED"],
  WAITING:     ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED:    ["CLOSED", "REOPENED"],
  CLOSED:      ["REOPENED"],
  CANCELLED:   [],
  REOPENED:    ["IN_PROGRESS", "WAITING", "CANCELLED"],
};

export function assertIncidentTransition(from, to) {
  if (TERMINAL.has(from) && from !== "CLOSED") {
    throw Object.assign(
      new Error(`Incidente em estado terminal ${from} não pode ser alterado`),
      { statusCode: 422 }
    );
  }
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Transição inválida: ${from} → ${to}. Permitidas: ${allowed.join(", ") || "nenhuma"}`),
      { statusCode: 422 }
    );
  }
}

// ── Incident code generator ────────────────────────────────────────────────

export function generateIncidentCode(incidents) {
  const year   = new Date().getFullYear();
  const prefix = `INC-${year}-`;
  const existing = (incidents || [])
    .map(i => i.incidentCode || "")
    .filter(c => c.startsWith(prefix))
    .map(c => parseInt(c.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ── Default SLA config (minutes) ───────────────────────────────────────────

export const DEFAULT_SLA = {
  CRITICAL: { firstResponse: 15,  resolution: 240  },
  HIGH:     { firstResponse: 60,  resolution: 480  },
  MEDIUM:   { firstResponse: 240, resolution: 1440 },
  LOW:      { firstResponse: 480, resolution: 4320 },
};

export function computeSlaDeadlines(severity, createdAt, slaConfig = DEFAULT_SLA) {
  const cfg   = slaConfig[severity] || slaConfig.LOW;
  const base  = new Date(createdAt).getTime();
  return {
    firstResponseDeadline: new Date(base + cfg.firstResponse * 60000).toISOString(),
    resolutionDeadline:    new Date(base + cfg.resolution    * 60000).toISOString(),
  };
}

export function computeSlaStatus(incident) {
  const now = Date.now();
  const frd = incident.sla?.firstResponseDeadline ? new Date(incident.sla.firstResponseDeadline).getTime() : null;
  const rd  = incident.sla?.resolutionDeadline    ? new Date(incident.sla.resolutionDeadline).getTime()    : null;

  const firstResponseBreached = !incident.firstResponseAt && frd && now > frd;
  const resolutionBreached    = !incident.resolvedAt && rd && now > rd;

  let responseAge = null;
  if (incident.firstResponseAt) {
    responseAge = Math.round((new Date(incident.firstResponseAt) - new Date(incident.createdAt)) / 60000);
  }
  let resolutionAge = null;
  if (incident.resolvedAt) {
    resolutionAge = Math.round((new Date(incident.resolvedAt) - new Date(incident.createdAt)) / 60000);
  }

  return {
    firstResponseBreached,
    resolutionBreached,
    responseAgeMinutes:    responseAge,
    resolutionAgeMinutes:  resolutionAge,
  };
}

// ── Timeline helper ────────────────────────────────────────────────────────

export function addIncidentTimeline(incident, { event, by, from = null, to = null, reason = null, meta = {} }) {
  if (!incident.timeline) incident.timeline = [];
  incident.timeline.push({
    id: randomUUID(), event, from, to, by,
    at: new Date().toISOString(), reason: reason || null, meta,
  });
  incident.updatedAt = new Date().toISOString();
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createIncident({
  title,
  description = "",
  category,
  severity    = SEVERITY.MEDIUM,
  municipalityId      = null,
  unitId              = null,
  deploymentId        = null,
  licenseId           = null,
  breakGlassSessionId = null,
  tags                = [],
  operator,
  existingIncidents   = [],
  slaConfig           = DEFAULT_SLA,
}) {
  if (!title?.trim())    throw Object.assign(new Error("title obrigatório"),    { statusCode: 400 });
  if (!category)         throw Object.assign(new Error("category obrigatória"), { statusCode: 400 });
  if (!INCIDENT_CATEGORIES.includes(category)) {
    throw Object.assign(new Error(`category inválida: ${category}`), { statusCode: 400 });
  }
  if (!SEVERITY[severity]) {
    throw Object.assign(new Error(`severity inválida: ${severity}`), { statusCode: 400 });
  }

  const now = new Date().toISOString();
  const slaDeadlines = computeSlaDeadlines(severity, now, slaConfig);

  const incident = {
    id:           randomUUID(),
    incidentCode: generateIncidentCode(existingIncidents),
    title:        title.trim(),
    description:  description || "",
    category,
    severity,
    priority:     SEVERITY_PRIORITY[severity],
    status:       INCIDENT_STATUS.NEW,
    municipalityId,
    unitId,
    deploymentId,
    licenseId,
    breakGlassSessionId,
    reportedBy:   { id: operator.id, name: operator.name },
    assignedTo:   null,
    assignmentHistory: [],
    firstResponseAt:   null,
    resolvedAt:        null,
    closedAt:          null,
    rootCause:    "",
    resolution:   "",
    tags:         Array.isArray(tags) ? tags : [],
    sla:          { ...slaDeadlines, config: slaConfig[severity] },
    timeline:     [],
    attachmentsMetadata: [],
    audit:        [],
    createdAt:    now,
    updatedAt:    now,
  };

  addIncidentTimeline(incident, { event: "CREATED", by: operator, reason: null });
  addAuditEntry(incident, { operator, action: "incident.created", before: null, after: { status: incident.status, severity, category } });

  return incident;
}

// ── Audit entry ────────────────────────────────────────────────────────────

export function addAuditEntry(incident, { operator, action, before, after, reason = null }) {
  if (!incident.audit) incident.audit = [];
  incident.audit.push({
    id: randomUUID(), action, by: operator,
    at: new Date().toISOString(), reason: reason || null, before, after,
  });
}

// ── Status transition ──────────────────────────────────────────────────────

export function changeIncidentStatus(incident, { toStatus, operator, reason = null, rootCause, resolution }) {
  assertIncidentTransition(incident.status, toStatus);

  const from   = incident.status;
  const before = { status: from };
  incident.status    = toStatus;
  incident.updatedAt = new Date().toISOString();

  if (toStatus === INCIDENT_STATUS.RESOLVED) {
    incident.resolvedAt = incident.updatedAt;
    if (rootCause)  incident.rootCause  = rootCause;
    if (resolution) incident.resolution = resolution;
  }
  if (toStatus === INCIDENT_STATUS.CLOSED) {
    incident.closedAt = incident.updatedAt;
  }
  if (toStatus === INCIDENT_STATUS.REOPENED) {
    incident.resolvedAt = null;
    incident.closedAt   = null;
  }

  addIncidentTimeline(incident, { event: "STATUS_CHANGED", by: operator, from, to: toStatus, reason });
  addAuditEntry(incident, { operator, action: "incident.status_changed", before, after: { status: toStatus }, reason });
  return incident;
}

// ── Severity change ────────────────────────────────────────────────────────

export function changeIncidentSeverity(incident, { toSeverity, operator, reason = null }) {
  if (!SEVERITY[toSeverity]) {
    throw Object.assign(new Error(`severity inválida: ${toSeverity}`), { statusCode: 400 });
  }
  const before = { severity: incident.severity, priority: incident.priority };
  incident.severity  = toSeverity;
  incident.priority  = SEVERITY_PRIORITY[toSeverity];
  incident.updatedAt = new Date().toISOString();

  addIncidentTimeline(incident, { event: "SEVERITY_CHANGED", by: operator, from: before.severity, to: toSeverity, reason });
  addAuditEntry(incident, { operator, action: "incident.severity_changed", before, after: { severity: toSeverity, priority: incident.priority }, reason });
  return incident;
}

// ── Assignment ─────────────────────────────────────────────────────────────

export function assignIncident(incident, { assignee, operator, reason = null }) {
  const prev = incident.assignedTo;
  incident.assignedTo = assignee ? { id: assignee.id, name: assignee.name } : null;
  incident.updatedAt  = new Date().toISOString();

  if (!incident.firstResponseAt && assignee) {
    incident.firstResponseAt = incident.updatedAt;
  }

  incident.assignmentHistory.push({
    id: randomUUID(), from: prev, to: incident.assignedTo,
    by: operator, at: incident.updatedAt, reason: reason || null,
  });

  addIncidentTimeline(incident, { event: "ASSIGNED", by: operator, reason,
    meta: { prev, next: incident.assignedTo } });
  addAuditEntry(incident, { operator, action: "incident.assigned",
    before: { assignedTo: prev }, after: { assignedTo: incident.assignedTo }, reason });
  return incident;
}

// ── Comment (internal) ─────────────────────────────────────────────────────

export function addComment(incident, { text, operator }) {
  if (!text?.trim()) throw Object.assign(new Error("text obrigatório"), { statusCode: 400 });
  addIncidentTimeline(incident, { event: "COMMENT", by: operator, meta: { text: text.trim() } });
  addAuditEntry(incident, { operator, action: "incident.comment_added",
    before: null, after: { text: text.trim() } });
  return incident;
}

// ── Update editable fields ─────────────────────────────────────────────────

export function updateIncident(incident, { patch, operator, reason = null }) {
  const EDITABLE = ["title", "description", "tags", "rootCause", "resolution",
                    "municipalityId", "unitId", "deploymentId", "licenseId",
                    "breakGlassSessionId", "attachmentsMetadata"];
  const before = {};
  const after  = {};
  for (const k of EDITABLE) {
    if (patch[k] !== undefined) {
      before[k] = incident[k];
      incident[k] = patch[k];
      after[k]  = patch[k];
    }
  }
  incident.updatedAt = new Date().toISOString();
  addAuditEntry(incident, { operator, action: "incident.updated", before, after, reason });
  return incident;
}

// ── Read helpers ───────────────────────────────────────────────────────────

export function getIncidentWithSla(incident) {
  return { ...incident, slaStatus: computeSlaStatus(incident) };
}
