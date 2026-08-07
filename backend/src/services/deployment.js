/**
 * Deployment lifecycle service — ERP-03
 *
 * Two deployment types:
 *   MUNICIPAL — one per municipality; parent of UBS deployments
 *   UBS       — one per unit; child of a MUNICIPAL deployment
 *
 * State machine is the single source of truth for all transitions.
 * No transition happens outside assertTransition().
 */

import { randomUUID } from "node:crypto";

// ── Status catalogue ───────────────────────────────────────────────────────

export const DEPLOYMENT_STATUS = {
  PLANNED:            "PLANNED",
  CONFIGURING:        "CONFIGURING",
  MIGRATING:          "MIGRATING",
  VALIDATING:         "VALIDATING",
  TRAINING:           "TRAINING",
  READY_FOR_GO_LIVE:  "READY_FOR_GO_LIVE",
  GO_LIVE:            "GO_LIVE",
  OPERATIONAL:        "OPERATIONAL",
  PAUSED:             "PAUSED",
  SUSPENDED:          "SUSPENDED",
  CANCELLED:          "CANCELLED",
};

export const TERMINAL_STATUSES = new Set(["CANCELLED"]);
export const PAUSE_RESUMABLE   = new Set(["PAUSED", "SUSPENDED"]);

// Valid forward transitions (excluding PAUSED/CANCELLED which are handled separately)
const FORWARD = {
  PLANNED:           ["CONFIGURING"],
  CONFIGURING:       ["MIGRATING"],
  MIGRATING:         ["VALIDATING"],
  VALIDATING:        ["TRAINING"],
  TRAINING:          ["READY_FOR_GO_LIVE"],
  READY_FOR_GO_LIVE: ["GO_LIVE"],
  GO_LIVE:           ["OPERATIONAL"],
  OPERATIONAL:       [],
  PAUSED:            [], // resume restores previousStatus
  SUSPENDED:         [],
  CANCELLED:         [], // terminal
};

// Statuses that can be paused
const PAUSEABLE = new Set([
  "CONFIGURING","MIGRATING","VALIDATING","TRAINING","READY_FOR_GO_LIVE","GO_LIVE","OPERATIONAL"
]);
// Statuses that can be cancelled
const CANCELLABLE = new Set([
  "PLANNED","CONFIGURING","MIGRATING","VALIDATING","TRAINING","READY_FOR_GO_LIVE","PAUSED","SUSPENDED"
]);
// Statuses that can be suspended (operational issues)
const SUSPENDABLE = new Set(["OPERATIONAL"]);

export function assertTransition(from, to) {
  if (TERMINAL_STATUSES.has(from)) {
    throw Object.assign(new Error(`Deployment em estado terminal ${from} não pode ser alterado`), { statusCode: 422 });
  }
  if (to === "PAUSED") {
    if (!PAUSEABLE.has(from)) throw Object.assign(new Error(`Status ${from} não pode ser pausado`), { statusCode: 422 });
    return;
  }
  if (to === "CANCELLED") {
    if (!CANCELLABLE.has(from)) throw Object.assign(new Error(`Status ${from} não pode ser cancelado`), { statusCode: 422 });
    return;
  }
  if (to === "SUSPENDED") {
    if (!SUSPENDABLE.has(from)) throw Object.assign(new Error(`Apenas deployments OPERATIONAL podem ser suspensos`), { statusCode: 422 });
    return;
  }
  if (from === "PAUSED") {
    // resume — caller passes the target (previousStatus); validated by resume handler
    return;
  }
  const allowed = FORWARD[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Transição inválida: ${from} → ${to}. Transições permitidas: ${allowed.join(", ") || "nenhuma"}`),
      { statusCode: 422 }
    );
  }
}

// ── Checklist templates ───────────────────────────────────────────────────

const MUNICIPAL_CHECKLIST_TEMPLATE = [
  { category: "contrato",   description: "Município criado no sistema",         required: true  },
  { category: "contrato",   description: "Contrato assinado",                   required: true  },
  { category: "contrato",   description: "Licença emitida",                     required: true  },
  { category: "portal",     description: "Portal configurado",                  required: true  },
  { category: "config",     description: "Configurações gerais aplicadas",      required: true  },
  { category: "seguranca",  description: "Segurança configurada",               required: true  },
  { category: "usuarios",   description: "Usuários administrativos criados",    required: true  },
];

const UBS_CHECKLIST_TEMPLATE = [
  { category: "cadastro",    description: "Cadastro da UBS realizado",          required: true  },
  { category: "cadastro",    description: "CNES validado",                      required: true  },
  { category: "equipes",     description: "Equipes configuradas",               required: true  },
  { category: "usuarios",    description: "Usuários criados e treinados",       required: true  },
  { category: "territorio",  description: "Território definido",                required: false },
  { category: "agenda",      description: "Agenda configurada",                 required: true  },
  { category: "importacao",  description: "Importação de dados realizada",      required: false },
  { category: "validacao",   description: "Smoke test executado",               required: true  },
  { category: "treinamento", description: "Treinamento da equipe realizado",    required: true  },
  { category: "golive",      description: "Go Live autorizado pelo município",  required: true  },
];

export function buildDefaultChecklist(type) {
  const template = type === "MUNICIPAL" ? MUNICIPAL_CHECKLIST_TEMPLATE : UBS_CHECKLIST_TEMPLATE;
  return template.map(item => ({
    id:          randomUUID(),
    category:    item.category,
    description: item.description,
    required:    item.required,
    done:        false,
    doneBy:      null,
    doneAt:      null,
    observation: null,
  }));
}

// ── Deployment code generator ─────────────────────────────────────────────

export function generateDeploymentCode(deployments) {
  const year = new Date().getFullYear();
  const prefix = `IMP-${year}-`;
  const existing = (deployments || [])
    .map(d => d.deploymentCode || "")
    .filter(c => c.startsWith(prefix))
    .map(c => parseInt(c.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ── Factory ───────────────────────────────────────────────────────────────

export function createDeployment({
  type,
  municipalityId,
  municipalityDeploymentId = null,
  unitId = null,
  plannedGoLive = null,
  notes = "",
  createdBy,
  existingDeployments = [],
}) {
  if (!["MUNICIPAL", "UBS"].includes(type)) {
    throw Object.assign(new Error("type deve ser MUNICIPAL ou UBS"), { statusCode: 400 });
  }
  if (!municipalityId) {
    throw Object.assign(new Error("municipalityId obrigatório"), { statusCode: 400 });
  }
  if (type === "UBS" && !municipalityDeploymentId) {
    throw Object.assign(new Error("municipalityDeploymentId obrigatório para deployments do tipo UBS"), { statusCode: 400 });
  }

  const now = new Date().toISOString();
  const id  = randomUUID();
  const checklist = buildDefaultChecklist(type);

  const deployment = {
    id,
    deploymentCode:          generateDeploymentCode(existingDeployments),
    type,
    municipalityId,
    municipalityDeploymentId,
    unitId,
    status:                  DEPLOYMENT_STATUS.PLANNED,
    previousStatus:          null,
    createdBy,
    assignedEngineer:        null,
    plannedGoLive:           plannedGoLive || null,
    actualGoLive:            null,
    startedAt:               null,
    finishedAt:              null,
    notes:                   notes || "",
    checklist,
    timeline:                [],
    createdAt:               now,
    updatedAt:               now,
  };

  addTimelineEntry(deployment, {
    event:  "CREATED",
    by:     createdBy,
    reason: null,
  });

  return deployment;
}

// ── Timeline ──────────────────────────────────────────────────────────────

export function addTimelineEntry(deployment, { event, from = null, to = null, by, reason = null, meta = {} }) {
  if (!deployment.timeline) deployment.timeline = [];
  deployment.timeline.push({
    id:     randomUUID(),
    event,
    from,
    to,
    by,
    at:     new Date().toISOString(),
    reason: reason || null,
    meta,
  });
  deployment.updatedAt = new Date().toISOString();
}

// ── Status transitions ────────────────────────────────────────────────────

export function advanceDeployment(deployment, { toStatus, operator, reason = null }) {
  const from = deployment.status;
  assertTransition(from, toStatus);

  if (toStatus === DEPLOYMENT_STATUS.GO_LIVE) {
    const incompleteRequired = deployment.checklist.filter(i => i.required && !i.done);
    if (incompleteRequired.length > 0) {
      throw Object.assign(
        new Error(`Go Live bloqueado: ${incompleteRequired.length} item(ns) obrigatório(s) do checklist pendente(s)`),
        { statusCode: 422 }
      );
    }
  }

  const now = new Date().toISOString();
  deployment.status    = toStatus;
  deployment.updatedAt = now;

  if (toStatus === DEPLOYMENT_STATUS.CONFIGURING && !deployment.startedAt) {
    deployment.startedAt = now;
  }
  if (toStatus === DEPLOYMENT_STATUS.OPERATIONAL) {
    deployment.finishedAt = now;
  }
  if (toStatus === DEPLOYMENT_STATUS.GO_LIVE) {
    deployment.actualGoLive = now;
  }

  addTimelineEntry(deployment, { event: "STATUS_CHANGED", from, to: toStatus, by: operator, reason });
  return deployment;
}

export function pauseDeployment(deployment, { operator, reason }) {
  assertTransition(deployment.status, "PAUSED");
  const prev = deployment.status;
  deployment.previousStatus = prev;
  deployment.status         = DEPLOYMENT_STATUS.PAUSED;
  deployment.updatedAt      = new Date().toISOString();
  addTimelineEntry(deployment, { event: "PAUSED", from: prev, to: "PAUSED", by: operator, reason });
  return deployment;
}

export function resumeDeployment(deployment, { operator, reason }) {
  if (deployment.status !== DEPLOYMENT_STATUS.PAUSED) {
    throw Object.assign(new Error("Deployment não está pausado"), { statusCode: 422 });
  }
  const target = deployment.previousStatus;
  if (!target) {
    throw Object.assign(new Error("Estado anterior não disponível para retomada"), { statusCode: 422 });
  }
  deployment.status         = target;
  deployment.previousStatus = null;
  deployment.updatedAt      = new Date().toISOString();
  addTimelineEntry(deployment, { event: "RESUMED", from: "PAUSED", to: target, by: operator, reason });
  return deployment;
}

export function cancelDeployment(deployment, { operator, reason }) {
  assertTransition(deployment.status, "CANCELLED");
  const prev = deployment.status;
  deployment.status    = DEPLOYMENT_STATUS.CANCELLED;
  deployment.updatedAt = new Date().toISOString();
  addTimelineEntry(deployment, { event: "CANCELLED", from: prev, to: "CANCELLED", by: operator, reason });
  return deployment;
}

export function suspendDeployment(deployment, { operator, reason }) {
  assertTransition(deployment.status, "SUSPENDED");
  const prev = deployment.status;
  deployment.status         = DEPLOYMENT_STATUS.SUSPENDED;
  deployment.previousStatus = prev;
  deployment.updatedAt      = new Date().toISOString();
  addTimelineEntry(deployment, { event: "SUSPENDED", from: prev, to: "SUSPENDED", by: operator, reason });
  return deployment;
}

// ── Checklist ─────────────────────────────────────────────────────────────

export function updateChecklistItem(deployment, { itemId, done, observation, operator }) {
  const item = deployment.checklist.find(i => i.id === itemId);
  if (!item) throw Object.assign(new Error("Item de checklist não encontrado"), { statusCode: 404 });

  const prev = { done: item.done, observation: item.observation };
  item.done        = Boolean(done);
  item.doneBy      = done ? { userId: operator.id, name: operator.name } : null;
  item.doneAt      = done ? new Date().toISOString() : null;
  item.observation = observation !== undefined ? (observation || null) : item.observation;

  addTimelineEntry(deployment, {
    event:  "CHECKLIST_ITEM_UPDATED",
    by:     operator,
    reason: null,
    meta:   { itemId, description: item.description, prev, next: { done: item.done, observation: item.observation } },
  });
  return deployment;
}

// ── Assign engineer ───────────────────────────────────────────────────────

export function assignEngineer(deployment, { engineer, operator }) {
  const prev = deployment.assignedEngineer;
  deployment.assignedEngineer = engineer;
  deployment.updatedAt        = new Date().toISOString();
  addTimelineEntry(deployment, {
    event:  "ENGINEER_ASSIGNED",
    by:     operator,
    reason: null,
    meta:   { prev, next: engineer },
  });
  return deployment;
}

// ── Read helpers ──────────────────────────────────────────────────────────

export function getChecklistSummary(deployment) {
  const total    = deployment.checklist.length;
  const required = deployment.checklist.filter(i => i.required).length;
  const done     = deployment.checklist.filter(i => i.done).length;
  const reqDone  = deployment.checklist.filter(i => i.required && i.done).length;
  return { total, required, done, requiredDone: reqDone, readyForGoLive: reqDone === required };
}

export function getMunicipalConsolidation(municipalDeployment, ubsDeployments) {
  const total       = ubsDeployments.length;
  const operational = ubsDeployments.filter(d => d.status === "OPERATIONAL").length;
  const goLive      = ubsDeployments.filter(d => d.status === "GO_LIVE").length;
  const cancelled   = ubsDeployments.filter(d => d.status === "CANCELLED").length;
  const active      = total - cancelled;
  return {
    totalUbs: total,
    activeUbs: active,
    operationalUbs: operational,
    goLiveUbs: goLive,
    cancelledUbs: cancelled,
    progressPct: active > 0 ? Math.round((operational / active) * 100) : 0,
  };
}
