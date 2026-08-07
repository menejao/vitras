/**
 * Release Management service — ERP-07
 *
 * Release = versão oficial publicada da plataforma VITRAS.
 * Rollout = evento administrativo registrando qual versão está num município/UBS.
 * Rollback = evento administrativo revertendo versão instalada.
 * MaintenanceWindow = janela de manutenção registrada com detecção de sobreposição.
 *
 * Nenhuma execução de deploy, migration ou rollback automático ocorre aqui.
 * Tudo é registro com rastreabilidade completa.
 */

import { randomUUID } from "node:crypto";

// ── Release types & statuses ────────────────────────────────────────────────

export const RELEASE_TYPE = {
  MAJOR:   "MAJOR",
  MINOR:   "MINOR",
  PATCH:   "PATCH",
  HOTFIX:  "HOTFIX",
  ROLLBACK: "ROLLBACK",
};

export const RELEASE_STATUS = {
  DRAFT:     "DRAFT",
  APPROVED:  "APPROVED",
  ACTIVE:    "ACTIVE",    // currently being rolled out
  STABLE:    "STABLE",    // fully rolled out
  DEPRECATED: "DEPRECATED",
  ROLLED_BACK: "ROLLED_BACK",
};

const RELEASE_TRANSITIONS = {
  DRAFT:       ["APPROVED", "DEPRECATED"],
  APPROVED:    ["ACTIVE", "DRAFT", "DEPRECATED"],
  ACTIVE:      ["STABLE", "ROLLED_BACK", "DEPRECATED"],
  STABLE:      ["DEPRECATED"],
  DEPRECATED:  [],
  ROLLED_BACK: [],
};

export function assertReleaseTransition(from, to) {
  const allowed = RELEASE_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Transição de release inválida: ${from} → ${to}. Permitidas: ${allowed.join(", ") || "nenhuma"}`),
      { statusCode: 422 }
    );
  }
}

// ── Rollout statuses ────────────────────────────────────────────────────────

export const ROLLOUT_STATUS = {
  PLANNED:     "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED:   "COMPLETED",
  FAILED:      "FAILED",
  ROLLED_BACK: "ROLLED_BACK",
  CANCELLED:   "CANCELLED",
};

const ROLLOUT_TRANSITIONS = {
  PLANNED:     ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "FAILED", "ROLLED_BACK", "CANCELLED"],
  COMPLETED:   ["ROLLED_BACK"],
  FAILED:      ["IN_PROGRESS", "CANCELLED"],
  ROLLED_BACK: [],
  CANCELLED:   [],
};

export function assertRolloutTransition(from, to) {
  const allowed = ROLLOUT_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Transição de rollout inválida: ${from} → ${to}. Permitidas: ${allowed.join(", ") || "nenhuma"}`),
      { statusCode: 422 }
    );
  }
}

// ── Maintenance window statuses ─────────────────────────────────────────────

export const MW_STATUS = {
  PLANNED:   "PLANNED",
  ACTIVE:    "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

// ── Risk levels ─────────────────────────────────────────────────────────────

export const RISK_LEVEL = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL" };

// ── Release code generator ──────────────────────────────────────────────────

export function generateReleaseCode(releases) {
  const year   = new Date().getFullYear();
  const prefix = `REL-${year}-`;
  const existing = (releases || [])
    .map(r => r.releaseCode || "")
    .filter(c => c.startsWith(prefix))
    .map(c => parseInt(c.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ── Changelog item factory ──────────────────────────────────────────────────

export function createChangelogItem({
  category, description, breakingChange = false, migrationRequired = false,
  frontend = false, backend = false, database = false, api = false,
  security = false, documentation = false, riskLevel = "LOW",
}) {
  return {
    id: randomUUID(), category, description,
    breakingChange, migrationRequired,
    frontend, backend, database, api, security, documentation,
    riskLevel,
  };
}

// ── Release factory ────────────────────────────────────────────────────────

export function createRelease({
  version, releaseType, title, description = "", plannedReleaseDate = null,
  rollbackAvailable = false, rollbackReleaseId = null,
  changelog = [], affectedModules = [], affectedMigrations = [],
  documentationVersion = null, operator, existingReleases = [],
}) {
  if (!version?.trim())    throw Object.assign(new Error("version obrigatória"), { statusCode: 400 });
  if (!title?.trim())      throw Object.assign(new Error("title obrigatório"),   { statusCode: 400 });
  if (!RELEASE_TYPE[releaseType]) {
    throw Object.assign(new Error(`releaseType inválido: ${releaseType}. Válidos: ${Object.keys(RELEASE_TYPE).join(", ")}`), { statusCode: 400 });
  }
  if (existingReleases.some(r => r.version === version.trim())) {
    throw Object.assign(new Error(`Versão ${version} já existe`), { statusCode: 409 });
  }

  const now = new Date().toISOString();
  return {
    id:                  randomUUID(),
    releaseCode:         generateReleaseCode(existingReleases),
    version:             version.trim(),
    releaseType,
    title:               title.trim(),
    description:         description || "",
    status:              RELEASE_STATUS.DRAFT,
    releaseDate:         null,
    plannedReleaseDate:  plannedReleaseDate || null,
    createdBy:           { id: operator.id, name: operator.name },
    approvedBy:          null,
    rollbackAvailable:   Boolean(rollbackAvailable),
    rollbackReleaseId:   rollbackReleaseId || null,
    changelog:           changelog.map(c => typeof c === "string"
      ? createChangelogItem({ category: "GENERAL", description: c })
      : createChangelogItem(c)),
    affectedModules:     Array.isArray(affectedModules) ? affectedModules : [],
    affectedMigrations:  Array.isArray(affectedMigrations) ? affectedMigrations : [],
    documentationVersion: documentationVersion || null,
    timeline:            [{ id: randomUUID(), event: "CREATED", by: operator, at: now, reason: null }],
    audit:               [{ id: randomUUID(), action: "release.created", by: operator, at: now, before: null, after: { version, status: "DRAFT" } }],
    createdAt:           now,
    updatedAt:           now,
  };
}

// ── Release mutations ────────────────────────────────────────────────────────

export function changeReleaseStatus(release, { toStatus, operator, reason = null }) {
  assertReleaseTransition(release.status, toStatus);
  const before = { status: release.status };
  release.status    = toStatus;
  release.updatedAt = new Date().toISOString();

  if (toStatus === RELEASE_STATUS.APPROVED) {
    release.approvedBy = { id: operator.id, name: operator.name };
  }
  if (toStatus === RELEASE_STATUS.ACTIVE || toStatus === RELEASE_STATUS.STABLE) {
    if (!release.releaseDate) release.releaseDate = release.updatedAt;
  }

  release.timeline.push({ id: randomUUID(), event: "STATUS_CHANGED", from: before.status, to: toStatus, by: operator, at: release.updatedAt, reason });
  release.audit.push({ id: randomUUID(), action: "release.status_changed", by: operator, at: release.updatedAt, reason, before, after: { status: toStatus } });
  return release;
}

export function updateRelease(release, { patch, operator, reason = null }) {
  const EDITABLE = ["title", "description", "plannedReleaseDate", "rollbackAvailable",
                    "rollbackReleaseId", "affectedModules", "affectedMigrations", "documentationVersion"];
  const before = {}, after = {};
  for (const k of EDITABLE) {
    if (patch[k] !== undefined) { before[k] = release[k]; release[k] = patch[k]; after[k] = patch[k]; }
  }
  // changelog items: additive only
  if (Array.isArray(patch.addChangelog)) {
    for (const item of patch.addChangelog) {
      release.changelog.push(createChangelogItem(typeof item === "string" ? { category: "GENERAL", description: item } : item));
    }
    before.changelogLen = release.changelog.length - patch.addChangelog.length;
    after.changelogLen  = release.changelog.length;
  }
  release.updatedAt = new Date().toISOString();
  release.audit.push({ id: randomUUID(), action: "release.updated", by: operator, at: release.updatedAt, reason, before, after });
  return release;
}

// ── Rollout factory & mutation ───────────────────────────────────────────────

export function createRollout({
  releaseId, releaseVersion, targetType, municipalityId, unitId = null,
  operator, existingRollouts = [],
}) {
  if (!releaseId)      throw Object.assign(new Error("releaseId obrigatório"),   { statusCode: 400 });
  if (!targetType)     throw Object.assign(new Error("targetType obrigatório"),   { statusCode: 400 });
  if (!["MUNICIPALITY","UNIT"].includes(targetType)) {
    throw Object.assign(new Error("targetType deve ser MUNICIPALITY ou UNIT"), { statusCode: 400 });
  }
  if (!municipalityId) throw Object.assign(new Error("municipalityId obrigatório"), { statusCode: 400 });
  if (targetType === "UNIT" && !unitId) {
    throw Object.assign(new Error("unitId obrigatório para targetType UNIT"), { statusCode: 400 });
  }

  const now = new Date().toISOString();
  return {
    id:               randomUUID(),
    releaseId,
    releaseVersion:   releaseVersion || null,
    targetType,
    municipalityId,
    unitId:           unitId || null,
    status:           ROLLOUT_STATUS.PLANNED,
    installedVersion: null,
    startedAt:        null,
    completedAt:      null,
    rolledBackAt:     null,
    operator:         { id: operator.id, name: operator.name },
    history:          [{ id: randomUUID(), event: "CREATED", status: "PLANNED", by: operator, at: now }],
    notes:            "",
    createdAt:        now,
    updatedAt:        now,
  };
}

export function advanceRollout(rollout, { toStatus, operator, notes = null }) {
  assertRolloutTransition(rollout.status, toStatus);
  const prev = rollout.status;
  rollout.status    = toStatus;
  rollout.updatedAt = new Date().toISOString();

  if (toStatus === ROLLOUT_STATUS.IN_PROGRESS && !rollout.startedAt) rollout.startedAt = rollout.updatedAt;
  if (toStatus === ROLLOUT_STATUS.COMPLETED) {
    rollout.completedAt      = rollout.updatedAt;
    rollout.installedVersion = rollout.releaseVersion;
  }
  if (toStatus === ROLLOUT_STATUS.ROLLED_BACK) rollout.rolledBackAt = rollout.updatedAt;
  if (notes) rollout.notes = notes;

  rollout.history.push({ id: randomUUID(), event: "STATUS_CHANGED", from: prev, to: toStatus, by: operator, at: rollout.updatedAt, notes });
  return rollout;
}

// ── Migration log factory ───────────────────────────────────────────────────

export function createMigrationLog({
  migrationCode, releaseId = null, description = "", status,
  executedAt = null, rollbackAvailable = false, executionTimeMs = null,
  result = null, operator,
}) {
  if (!migrationCode) throw Object.assign(new Error("migrationCode obrigatório"), { statusCode: 400 });
  const now = new Date().toISOString();
  return {
    id: randomUUID(), migrationCode, releaseId: releaseId || null,
    description, status: status || "PENDING",
    executedAt: executedAt || null, rollbackAvailable: Boolean(rollbackAvailable),
    executionTimeMs: executionTimeMs || null, result: result || null,
    recordedBy: { id: operator.id, name: operator.name },
    createdAt: now, updatedAt: now,
  };
}

// ── Maintenance Window factory & mutation ───────────────────────────────────

export function createMaintenanceWindow({
  title, description = "", startAt, endAt, reason = null,
  municipalityScope = [], unitScope = [], operator,
  existingWindows = [],
}) {
  if (!title?.trim()) throw Object.assign(new Error("title obrigatório"), { statusCode: 400 });
  if (!startAt)       throw Object.assign(new Error("startAt obrigatório"), { statusCode: 400 });
  if (!endAt)         throw Object.assign(new Error("endAt obrigatório"), { statusCode: 400 });
  if (new Date(endAt) <= new Date(startAt)) {
    throw Object.assign(new Error("endAt deve ser posterior a startAt"), { statusCode: 400 });
  }

  // Overlap detection (PLANNED or ACTIVE windows)
  const overlap = existingWindows.filter(w =>
    !["COMPLETED","CANCELLED"].includes(w.status) &&
    new Date(w.startAt) < new Date(endAt) &&
    new Date(w.endAt)   > new Date(startAt)
  );
  if (overlap.length > 0) {
    throw Object.assign(
      new Error(`Janela de manutenção sobrepõe ${overlap.length} janela(s) existente(s): ${overlap.map(w => w.title).join(", ")}`),
      { statusCode: 409 }
    );
  }

  const now = new Date().toISOString();
  return {
    id:                randomUUID(),
    title:             title.trim(),
    description:       description || "",
    startAt,
    endAt,
    status:            MW_STATUS.PLANNED,
    municipalityScope: Array.isArray(municipalityScope) ? municipalityScope : [],
    unitScope:         Array.isArray(unitScope) ? unitScope : [],
    reason:            reason || null,
    approvedBy:        null,
    createdBy:         { id: operator.id, name: operator.name },
    audit:             [{ id: randomUUID(), action: "maintenance.created", by: operator, at: now }],
    createdAt:         now,
    updatedAt:         now,
  };
}

export function updateMaintenanceWindow(mw, { patch, operator }) {
  const EDITABLE = ["title","description","startAt","endAt","reason","municipalityScope","unitScope","status","approvedBy"];
  for (const k of EDITABLE) {
    if (patch[k] !== undefined) mw[k] = patch[k];
  }
  mw.updatedAt = new Date().toISOString();
  mw.audit.push({ id: randomUUID(), action: "maintenance.updated", by: operator, at: mw.updatedAt, patch });
  return mw;
}
