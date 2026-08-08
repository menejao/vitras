/**
 * CMDB — Configuration Management Database — ERP-10
 *
 * Fonte única de verdade sobre ativos operacionais da plataforma e seus relacionamentos.
 * CMDB referencia entidades existentes; nunca as substitui.
 * Impact Analysis Engine analisa dependências; nunca executa ações corretivas.
 * Nenhum dado clínico é acessado ou exposto.
 */

import { randomUUID } from "node:crypto";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const CI_TYPE = {
  PLATFORM:           "PLATFORM",
  MUNICIPALITY:       "MUNICIPALITY",
  UNIT:               "UNIT",
  TEAM:               "TEAM",
  DEPLOYMENT:         "DEPLOYMENT",
  LICENSE:            "LICENSE",
  RELEASE:            "RELEASE",
  ROLL_OUT:           "ROLL_OUT",
  BACKUP_POLICY:      "BACKUP_POLICY",
  BACKUP_EXECUTION:   "BACKUP_EXECUTION",
  RESTORE_TEST:       "RESTORE_TEST",
  INCIDENT:           "INCIDENT",
  POLICY:             "POLICY",
  BASELINE:           "BASELINE",
  ADR:                "ADR",
  MAINTENANCE_WINDOW: "MAINTENANCE_WINDOW",
  DATABASE:           "DATABASE",
  API:                "API",
  AUTH_SERVICE:       "AUTH_SERVICE",
  STORAGE:            "STORAGE",
  SCHEDULER:          "SCHEDULER",
  INTEGRATION:        "INTEGRATION",
  CUSTOM:             "CUSTOM",
};

export const CI_STATUS = {
  PLANNED:     "PLANNED",
  ACTIVE:      "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  SUSPENDED:   "SUSPENDED",
  RETIRED:     "RETIRED",
  ARCHIVED:    "ARCHIVED",
};

const CI_TRANSITIONS = {
  PLANNED:     ["ACTIVE", "ARCHIVED"],
  ACTIVE:      ["MAINTENANCE", "SUSPENDED", "RETIRED"],
  MAINTENANCE: ["ACTIVE", "SUSPENDED", "RETIRED"],
  SUSPENDED:   ["ACTIVE", "RETIRED", "ARCHIVED"],
  RETIRED:     ["ARCHIVED"],
  ARCHIVED:    [],
};

export function assertCiTransition(from, to) {
  const allowed = CI_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Transição de CI inválida: ${from} → ${to}. Permitidas: ${allowed.join(", ") || "nenhuma"}`),
      { statusCode: 422 }
    );
  }
}

export const CRITICALITY = {
  LOW:              "LOW",
  MEDIUM:           "MEDIUM",
  HIGH:             "HIGH",
  CRITICAL:         "CRITICAL",
  MISSION_CRITICAL: "MISSION_CRITICAL",
};

export const REL_TYPE = {
  DEPENDS_ON:   "DEPENDS_ON",
  USES:         "USES",
  HOSTED_ON:    "HOSTED_ON",
  OWNED_BY:     "OWNED_BY",
  IMPLEMENTS:   "IMPLEMENTS",
  GENERATED_BY: "GENERATED_BY",
  PROTECTED_BY: "PROTECTED_BY",
  SUPERSEDES:   "SUPERSEDES",
  RELATED_TO:   "RELATED_TO",
};

// Inverse relationship type for bidirectional traversal
const REL_INVERSE = {
  DEPENDS_ON:   "DEPENDENCY_OF",
  USES:         "USED_BY",
  HOSTED_ON:    "HOSTS",
  OWNED_BY:     "OWNS",
  IMPLEMENTS:   "IMPLEMENTED_BY",
  GENERATED_BY: "GENERATES",
  PROTECTED_BY: "PROTECTS",
  SUPERSEDES:   "SUPERSEDED_BY",
  RELATED_TO:   "RELATED_TO",
};

// ── Code generator ─────────────────────────────────────────────────────────────

export function generateCiCode(items) {
  const year = new Date().getFullYear();
  const pfx  = `CI-${year}-`;
  const nums = (items || [])
    .map(i => i.ciCode || "")
    .filter(c => c.startsWith(pfx))
    .map(c => parseInt(c.slice(pfx.length), 10))
    .filter(n => !isNaN(n));
  return `${pfx}${String(nums.length ? Math.max(...nums) + 1 : 1).padStart(4, "0")}`;
}

export function generateRelCode(rels) {
  const year = new Date().getFullYear();
  const pfx  = `REL-${year}-`;
  const nums = (rels || [])
    .map(r => r.relCode || "")
    .filter(c => c.startsWith(pfx))
    .map(c => parseInt(c.slice(pfx.length), 10))
    .filter(n => !isNaN(n));
  return `${pfx}${String(nums.length ? Math.max(...nums) + 1 : 1).padStart(4, "0")}`;
}

// ── CI factory & mutations ─────────────────────────────────────────────────────

export function createCi({
  name, type, criticality = "MEDIUM", owner = null, environment = "PRODUCTION",
  description = "", tags = [], metadata = {}, externalRef = null,
  operator, existingItems = [],
}) {
  if (!name?.trim()) throw Object.assign(new Error("name obrigatório"), { statusCode: 400 });
  if (!CI_TYPE[type]) throw Object.assign(new Error(`type inválido: ${type}. Válidos: ${Object.keys(CI_TYPE).join(", ")}`), { statusCode: 400 });
  if (!CRITICALITY[criticality]) throw Object.assign(new Error(`criticality inválida: ${criticality}`), { statusCode: 400 });

  const now = new Date().toISOString();
  return {
    id:          randomUUID(),
    ciCode:      generateCiCode(existingItems),
    name:        name.trim(),
    type,
    status:      CI_STATUS.ACTIVE,
    criticality,
    owner:       owner || null,
    environment,
    description: description || "",
    tags:        Array.isArray(tags) ? tags : [],
    metadata:    typeof metadata === "object" ? metadata : {},
    externalRef: externalRef || null,
    createdBy:   { id: operator.id, name: operator.name },
    timeline:    [{ id: randomUUID(), event: "CREATED", by: operator, at: now }],
    audit:       [{ id: randomUUID(), action: "ci.created", by: operator, at: now, before: null, after: { name, type, criticality } }],
    createdAt:   now,
    updatedAt:   now,
  };
}

export function updateCi(ci, { patch, operator, reason = null }) {
  const EDITABLE = ["name","description","owner","environment","tags","metadata","externalRef","criticality"];
  const before = {}, after = {};
  for (const k of EDITABLE) {
    if (patch[k] !== undefined) { before[k] = ci[k]; ci[k] = patch[k]; after[k] = patch[k]; }
  }
  ci.updatedAt = new Date().toISOString();
  ci.audit.push({ id: randomUUID(), action: "ci.updated", by: operator, at: ci.updatedAt, reason, before, after });
  return ci;
}

export function changeCiStatus(ci, { toStatus, operator, reason = null }) {
  assertCiTransition(ci.status, toStatus);
  const before = { status: ci.status };
  ci.status    = toStatus;
  ci.updatedAt = new Date().toISOString();
  ci.timeline.push({ id: randomUUID(), event: "STATUS_CHANGED", from: before.status, to: toStatus, by: operator, at: ci.updatedAt, reason });
  ci.audit.push({ id: randomUUID(), action: "ci.status_changed", by: operator, at: ci.updatedAt, reason, before, after: { status: toStatus } });
  return ci;
}

// ── Relationship factory ───────────────────────────────────────────────────────

export function createRelationship({
  sourceId, targetId, relType, description = "", operator, existingRels = [], items = [],
}) {
  if (!sourceId) throw Object.assign(new Error("sourceId obrigatório"), { statusCode: 400 });
  if (!targetId) throw Object.assign(new Error("targetId obrigatório"), { statusCode: 400 });
  if (!REL_TYPE[relType]) throw Object.assign(new Error(`relType inválido: ${relType}`), { statusCode: 400 });
  if (sourceId === targetId) throw Object.assign(new Error("sourceId e targetId não podem ser o mesmo CI"), { statusCode: 400 });

  // Validate CIs exist
  if (items.length > 0) {
    if (!items.some(i => i.id === sourceId)) throw Object.assign(new Error("CI de origem não encontrado"), { statusCode: 404 });
    if (!items.some(i => i.id === targetId)) throw Object.assign(new Error("CI de destino não encontrado"), { statusCode: 404 });
  }

  // Duplicate check
  if (existingRels.some(r => r.sourceId === sourceId && r.targetId === targetId && r.relType === relType)) {
    throw Object.assign(new Error("Relacionamento já existe entre estes CIs com este tipo"), { statusCode: 409 });
  }

  const now = new Date().toISOString();
  return {
    id:          randomUUID(),
    relCode:     generateRelCode(existingRels),
    sourceId,
    targetId,
    relType,
    inverseType: REL_INVERSE[relType] || "RELATED_TO",
    description: description || "",
    createdBy:   { id: operator.id, name: operator.name },
    createdAt:   now,
  };
}

// ── Impact Analysis Engine ────────────────────────────────────────────────────

/**
 * BFS traversal — find all CIs that depend (directly or indirectly) on ciId.
 * Returns { affected: [{ci, depth, path, relType}], maxDepth, totalAffected }.
 * Never accesses clinical data.
 */
export function analyzeImpact(ciId, items, relationships, maxDepth = 10) {
  const itemMap = new Map(items.map(i => [i.id, i]));

  // Build adjacency: for each CI, which CIs DEPEND_ON | USE | HOSTED_ON it?
  // i.e., if A DEPENDS_ON B, then B's failure impacts A
  const impactMap = new Map(); // ciId → [{dependentId, relType}]
  for (const rel of relationships) {
    if (["DEPENDS_ON","USES","HOSTED_ON","IMPLEMENTS","PROTECTED_BY"].includes(rel.relType)) {
      if (!impactMap.has(rel.targetId)) impactMap.set(rel.targetId, []);
      impactMap.get(rel.targetId).push({ dependentId: rel.sourceId, relType: rel.relType });
    }
  }

  const affected  = [];
  const visited   = new Set([ciId]);
  const queue     = [{ id: ciId, depth: 0, path: [] }];

  while (queue.length > 0) {
    const { id, depth, path } = queue.shift();
    if (depth >= maxDepth) continue;

    const dependents = impactMap.get(id) || [];
    for (const { dependentId, relType } of dependents) {
      if (visited.has(dependentId)) continue;
      visited.add(dependentId);
      const ci        = itemMap.get(dependentId);
      const newPath   = [...path, id];
      affected.push({ ci: ci || { id: dependentId, name: "Unknown CI" }, depth: depth + 1, path: newPath, relType });
      queue.push({ id: dependentId, depth: depth + 1, path: newPath });
    }
  }

  // Sort by criticality weight then depth
  const CRIT_W = { MISSION_CRITICAL: 5, CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  affected.sort((a, b) => {
    const wa = CRIT_W[a.ci.criticality] || 0;
    const wb = CRIT_W[b.ci.criticality] || 0;
    return wb - wa || a.depth - b.depth;
  });

  const rootCi = itemMap.get(ciId);
  return {
    ciId,
    ciCode:        rootCi?.ciCode || null,
    name:          rootCi?.name   || "Unknown",
    type:          rootCi?.type   || null,
    criticality:   rootCi?.criticality || null,
    totalAffected: affected.length,
    maxDepth:      affected.length ? Math.max(...affected.map(a => a.depth)) : 0,
    affected,
    analyzedAt:    new Date().toISOString(),
  };
}

// ── CMDB Dashboard ────────────────────────────────────────────────────────────

export function computeCmdbDashboard(items, relationships) {
  const byType = {};
  const byCrit = {};
  for (const i of items) {
    byType[i.type] = (byType[i.type] || 0) + 1;
    byCrit[i.criticality] = (byCrit[i.criticality] || 0) + 1;
  }

  const missionCritical = items.filter(i => i.criticality === "MISSION_CRITICAL");
  const critical        = items.filter(i => i.criticality === "CRITICAL");
  const active          = items.filter(i => i.status === "ACTIVE");
  const maintenance     = items.filter(i => i.status === "MAINTENANCE");
  const retired         = items.filter(i => i.status === "RETIRED" || i.status === "ARCHIVED");

  // Items with most relationships (top 5 hubs)
  const relCount = {};
  for (const r of relationships) {
    relCount[r.sourceId] = (relCount[r.sourceId] || 0) + 1;
    relCount[r.targetId] = (relCount[r.targetId] || 0) + 1;
  }
  const hubs = items
    .filter(i => relCount[i.id])
    .sort((a, b) => (relCount[b.id] || 0) - (relCount[a.id] || 0))
    .slice(0, 5)
    .map(i => ({ id: i.id, ciCode: i.ciCode, name: i.name, type: i.type, criticality: i.criticality, relationships: relCount[i.id] || 0 }));

  return {
    total:             items.length,
    active:            active.length,
    maintenance:       maintenance.length,
    retiredArchived:   retired.length,
    missionCritical:   missionCritical.length,
    critical:          critical.length,
    totalRelationships: relationships.length,
    byType,
    byCriticality:     byCrit,
    topHubs:           hubs,
    generatedAt:       new Date().toISOString(),
  };
}
