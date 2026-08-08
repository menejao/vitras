/**
 * Platform Governance and Compliance service — ERP-09
 *
 * Baseline: estado oficial imutável pós-aprovação.
 * ADR: decisão arquitetural permanente com histórico de substituição.
 * Policy: política versionada com vigência.
 * Exception: exceção temporária, aprovada, com expiresAt obrigatório.
 * Compliance Engine: avalia conformidade; nunca executa correções.
 *
 * Nenhum dado clínico é acessado ou exposto por este módulo.
 */

import { randomUUID } from "node:crypto";

// ── Enums ────────────────────────────────────────────────────────────────────

export const BASELINE_STATUS = {
  DRAFT:      "DRAFT",
  REVIEW:     "REVIEW",
  APPROVED:   "APPROVED",
  SUPERSEDED: "SUPERSEDED",
  ARCHIVED:   "ARCHIVED",
};

export const ADR_STATUS = {
  PROPOSED:   "PROPOSED",
  ACCEPTED:   "ACCEPTED",
  SUPERSEDED: "SUPERSEDED",
  REJECTED:   "REJECTED",
  ARCHIVED:   "ARCHIVED",
};

export const POLICY_STATUS = {
  DRAFT:      "DRAFT",
  ACTIVE:     "ACTIVE",
  EXPIRING:   "EXPIRING",   // within 30 days of effectiveUntil
  EXPIRED:    "EXPIRED",
  ARCHIVED:   "ARCHIVED",
};

export const POLICY_CATEGORY = {
  SECURITY:    "SECURITY",
  BACKUP:      "BACKUP",
  DEPLOYMENT:  "DEPLOYMENT",
  RELEASE:     "RELEASE",
  BREAK_GLASS: "BREAK_GLASS",
  SUPPORT:     "SUPPORT",
  DATA:        "DATA",
  ACCESS:      "ACCESS",
  COMPLIANCE:  "COMPLIANCE",
  OPERATIONS:  "OPERATIONS",
};

export const EXCEPTION_STATUS = {
  PENDING:   "PENDING",
  APPROVED:  "APPROVED",
  REJECTED:  "REJECTED",
  EXPIRED:   "EXPIRED",
  REVOKED:   "REVOKED",
};

export const RISK_LEVEL = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL" };

// ── Code generators ───────────────────────────────────────────────────────────

function codeGen(items, prefix, field) {
  const year = new Date().getFullYear();
  const full = `${prefix}-${year}-`;
  const nums = (items || [])
    .map(i => i[field] || "")
    .filter(c => c.startsWith(full))
    .map(c => parseInt(c.slice(full.length), 10))
    .filter(n => !isNaN(n));
  return `${full}${String(nums.length ? Math.max(...nums) + 1 : 1).padStart(4, "0")}`;
}

export const generateBaselineCode  = (items) => codeGen(items, "BAS", "baselineCode");
export const generateAdrCode       = (items) => codeGen(items, "ADR", "adrCode");
export const generatePolicyCode    = (items) => codeGen(items, "POL", "policyCode");
export const generateExceptionCode = (items) => codeGen(items, "EXC", "exceptionCode");

// ── Baseline ─────────────────────────────────────────────────────────────────

const BASELINE_TRANSITIONS = {
  DRAFT:      ["REVIEW", "ARCHIVED"],
  REVIEW:     ["APPROVED", "DRAFT", "ARCHIVED"],
  APPROVED:   ["SUPERSEDED"],           // immutable — only supersession allowed
  SUPERSEDED: [],
  ARCHIVED:   [],
};

export function assertBaselineTransition(from, to) {
  const allowed = BASELINE_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Transição de baseline inválida: ${from} → ${to}. Permitidas: ${allowed.join(", ") || "nenhuma (terminal)"}`),
      { statusCode: 422 }
    );
  }
}

export function createBaseline({
  name, version, description = "", scope, artifacts = [],
  documentationVersion = null, releaseId = null, operator, existingBaselines = [],
}) {
  if (!name?.trim())    throw Object.assign(new Error("name obrigatório"),    { statusCode: 400 });
  if (!version?.trim()) throw Object.assign(new Error("version obrigatória"), { statusCode: 400 });
  if (!scope?.trim())   throw Object.assign(new Error("scope obrigatório"),   { statusCode: 400 });
  const now = new Date().toISOString();
  return {
    id:                   randomUUID(),
    baselineCode:         generateBaselineCode(existingBaselines),
    name:                 name.trim(),
    version:              version.trim(),
    status:               BASELINE_STATUS.DRAFT,
    description:          description || "",
    scope:                scope.trim(),
    artifacts:            Array.isArray(artifacts) ? artifacts : [],
    documentationVersion: documentationVersion || null,
    releaseId:            releaseId || null,
    createdBy:            { id: operator.id, name: operator.name },
    approvedBy:           null,
    approvedAt:           null,
    supersededBy:         null,
    timeline:             [{ id: randomUUID(), event: "CREATED", by: operator, at: now }],
    audit:                [{ id: randomUUID(), action: "baseline.created", by: operator, at: now, before: null, after: { name, version, scope } }],
    createdAt:            now,
    updatedAt:            now,
  };
}

export function changeBaselineStatus(baseline, { toStatus, operator, reason = null }) {
  assertBaselineTransition(baseline.status, toStatus);
  if (baseline.status === BASELINE_STATUS.APPROVED) {
    throw Object.assign(new Error("Baseline aprovada é imutável. Crie uma nova baseline para substituir."), { statusCode: 422 });
  }
  const before = { status: baseline.status };
  baseline.status    = toStatus;
  baseline.updatedAt = new Date().toISOString();
  if (toStatus === BASELINE_STATUS.APPROVED) {
    baseline.approvedBy = { id: operator.id, name: operator.name };
    baseline.approvedAt = baseline.updatedAt;
  }
  baseline.timeline.push({ id: randomUUID(), event: "STATUS_CHANGED", from: before.status, to: toStatus, by: operator, at: baseline.updatedAt, reason });
  baseline.audit.push({ id: randomUUID(), action: "baseline.status_changed", by: operator, at: baseline.updatedAt, reason, before, after: { status: toStatus } });
  return baseline;
}

// ── ADR ──────────────────────────────────────────────────────────────────────

const ADR_TRANSITIONS = {
  PROPOSED:   ["ACCEPTED", "REJECTED", "ARCHIVED"],
  ACCEPTED:   ["SUPERSEDED", "ARCHIVED"],
  SUPERSEDED: [],
  REJECTED:   ["ARCHIVED"],
  ARCHIVED:   [],
};

export function assertAdrTransition(from, to) {
  const allowed = ADR_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Transição de ADR inválida: ${from} → ${to}. Permitidas: ${allowed.join(", ") || "nenhuma"}`),
      { statusCode: 422 }
    );
  }
}

export function createAdr({
  title, context, decision, consequences = "", alternatives = [],
  supersedes = null, tags = [], author, operator, existingAdrs = [],
}) {
  if (!title?.trim())    throw Object.assign(new Error("title obrigatório"),    { statusCode: 400 });
  if (!context?.trim())  throw Object.assign(new Error("context obrigatório"),  { statusCode: 400 });
  if (!decision?.trim()) throw Object.assign(new Error("decision obrigatório"), { statusCode: 400 });
  const now = new Date().toISOString();
  return {
    id:           randomUUID(),
    adrCode:      generateAdrCode(existingAdrs),
    title:        title.trim(),
    status:       ADR_STATUS.PROPOSED,
    context:      context.trim(),
    decision:     decision.trim(),
    consequences: consequences || "",
    alternatives: Array.isArray(alternatives) ? alternatives : [],
    supersedes:   supersedes || null,
    supersededBy: null,
    tags:         Array.isArray(tags) ? tags : [],
    author:       author || (operator ? operator.name : null),
    reviewer:     null,
    approvedAt:   null,
    createdBy:    { id: operator.id, name: operator.name },
    timeline:     [{ id: randomUUID(), event: "CREATED", by: operator, at: now }],
    audit:        [{ id: randomUUID(), action: "adr.created", by: operator, at: now, before: null, after: { title, status: "PROPOSED" } }],
    createdAt:    now,
    updatedAt:    now,
  };
}

export function changeAdrStatus(adr, { toStatus, operator, reason = null, supersededByCode = null }) {
  assertAdrTransition(adr.status, toStatus);
  const before = { status: adr.status };
  adr.status    = toStatus;
  adr.updatedAt = new Date().toISOString();
  if (toStatus === ADR_STATUS.ACCEPTED) {
    adr.reviewer   = operator.name;
    adr.approvedAt = adr.updatedAt;
  }
  if (toStatus === ADR_STATUS.SUPERSEDED && supersededByCode) {
    adr.supersededBy = supersededByCode;
  }
  adr.timeline.push({ id: randomUUID(), event: "STATUS_CHANGED", from: before.status, to: toStatus, by: operator, at: adr.updatedAt, reason });
  adr.audit.push({ id: randomUUID(), action: "adr.status_changed", by: operator, at: adr.updatedAt, reason, before, after: { status: toStatus } });
  return adr;
}

// ── Policy ───────────────────────────────────────────────────────────────────

export function createPolicy({
  name, category, description = "", effectiveFrom, effectiveUntil = null,
  version = "1.0", owner = null, approvedBy = null, content = "",
  relatedPolicyIds = [], operator, existingPolicies = [],
}) {
  if (!name?.trim())     throw Object.assign(new Error("name obrigatório"),     { statusCode: 400 });
  if (!POLICY_CATEGORY[category]) throw Object.assign(new Error(`category inválida: ${category}`), { statusCode: 400 });
  if (!effectiveFrom)    throw Object.assign(new Error("effectiveFrom obrigatório"), { statusCode: 400 });

  const now    = new Date().toISOString();
  const status = _computePolicyStatus(effectiveFrom, effectiveUntil, "DRAFT");
  return {
    id:               randomUUID(),
    policyCode:       generatePolicyCode(existingPolicies),
    name:             name.trim(),
    category,
    description:      description || "",
    content:          content || "",
    version,
    status:           "DRAFT",
    effectiveFrom,
    effectiveUntil:   effectiveUntil || null,
    owner:            owner || null,
    approvedBy:       approvedBy || null,
    approvedAt:       null,
    relatedPolicyIds: Array.isArray(relatedPolicyIds) ? relatedPolicyIds : [],
    versionHistory:   [],
    createdBy:        { id: operator.id, name: operator.name },
    timeline:         [{ id: randomUUID(), event: "CREATED", by: operator, at: now }],
    audit:            [{ id: randomUUID(), action: "policy.created", by: operator, at: now, before: null, after: { name, category, version } }],
    createdAt:        now,
    updatedAt:        now,
  };
}

function _computePolicyStatus(effectiveFrom, effectiveUntil, currentStatus) {
  if (["ARCHIVED","DRAFT"].includes(currentStatus)) return currentStatus;
  const now = new Date();
  if (effectiveUntil && new Date(effectiveUntil) < now) return "EXPIRED";
  if (effectiveUntil) {
    const daysLeft = (new Date(effectiveUntil) - now) / 86_400_000;
    if (daysLeft <= 30) return "EXPIRING";
  }
  return "ACTIVE";
}

export function activatePolicy(policy, { operator, reason = null }) {
  if (!["DRAFT"].includes(policy.status)) {
    throw Object.assign(new Error(`Política não pode ser ativada no status ${policy.status}`), { statusCode: 422 });
  }
  const before = { status: policy.status };
  policy.status     = _computePolicyStatus(policy.effectiveFrom, policy.effectiveUntil, "ACTIVE");
  policy.approvedBy = { id: operator.id, name: operator.name };
  policy.approvedAt = new Date().toISOString();
  policy.updatedAt  = policy.approvedAt;
  policy.timeline.push({ id: randomUUID(), event: "ACTIVATED", by: operator, at: policy.updatedAt, reason });
  policy.audit.push({ id: randomUUID(), action: "policy.activated", by: operator, at: policy.updatedAt, reason, before, after: { status: policy.status } });
  return policy;
}

export function updatePolicy(policy, { patch, operator, reason = null }) {
  const EDITABLE = ["description","content","effectiveFrom","effectiveUntil","owner","relatedPolicyIds"];
  const before = {}, after = {};
  for (const k of EDITABLE) {
    if (patch[k] !== undefined) { before[k] = policy[k]; policy[k] = patch[k]; after[k] = patch[k]; }
  }
  if (patch.version && patch.version !== policy.version) {
    policy.versionHistory.push({ version: policy.version, archivedAt: new Date().toISOString() });
    before.version = policy.version;
    policy.version = patch.version;
    after.version  = patch.version;
  }
  if (patch.status === "ARCHIVED") {
    before.status = policy.status;
    policy.status = "ARCHIVED";
    after.status  = "ARCHIVED";
  }
  policy.updatedAt = new Date().toISOString();
  // Recompute status if effectiveUntil changed and policy is active
  if ((patch.effectiveFrom || patch.effectiveUntil) && !["DRAFT","ARCHIVED"].includes(policy.status)) {
    policy.status = _computePolicyStatus(policy.effectiveFrom, policy.effectiveUntil, policy.status);
  }
  policy.audit.push({ id: randomUUID(), action: "policy.updated", by: operator, at: policy.updatedAt, reason, before, after });
  return policy;
}

// ── Exception ─────────────────────────────────────────────────────────────────

export function createException({
  policyId, reason, riskLevel, expiresAt, mitigations = "",
  requestedBy = null, operator, existingExceptions = [],
}) {
  if (!policyId)  throw Object.assign(new Error("policyId obrigatório"),  { statusCode: 400 });
  if (!reason?.trim()) throw Object.assign(new Error("reason obrigatório"), { statusCode: 400 });
  if (!expiresAt) throw Object.assign(new Error("expiresAt obrigatório (exceções devem ser temporárias)"), { statusCode: 400 });
  if (!RISK_LEVEL[riskLevel]) throw Object.assign(new Error(`riskLevel inválido: ${riskLevel}`), { statusCode: 400 });
  if (new Date(expiresAt) <= new Date()) throw Object.assign(new Error("expiresAt deve ser uma data futura"), { statusCode: 400 });

  const now = new Date().toISOString();
  return {
    id:             randomUUID(),
    exceptionCode:  generateExceptionCode(existingExceptions),
    policyId,
    reason:         reason.trim(),
    riskLevel,
    mitigations:    mitigations || "",
    requestedBy:    requestedBy || null,
    status:         EXCEPTION_STATUS.PENDING,
    expiresAt,
    approvedBy:     null,
    approvedAt:     null,
    revokedAt:      null,
    revokedReason:  null,
    createdBy:      { id: operator.id, name: operator.name },
    timeline:       [{ id: randomUUID(), event: "CREATED", by: operator, at: now }],
    audit:          [{ id: randomUUID(), action: "exception.created", by: operator, at: now, before: null, after: { policyId, riskLevel, expiresAt } }],
    createdAt:      now,
    updatedAt:      now,
  };
}

export function changeExceptionStatus(exc, { toStatus, operator, reason = null }) {
  const VALID = ["APPROVED","REJECTED","REVOKED"];
  if (!VALID.includes(toStatus)) throw Object.assign(new Error(`Status inválido: ${toStatus}`), { statusCode: 400 });
  if (["EXPIRED","REVOKED","REJECTED"].includes(exc.status)) {
    throw Object.assign(new Error(`Exceção em status ${exc.status} não pode ser alterada`), { statusCode: 422 });
  }
  const before    = { status: exc.status };
  exc.status      = toStatus;
  exc.updatedAt   = new Date().toISOString();
  if (toStatus === "APPROVED") {
    exc.approvedBy = { id: operator.id, name: operator.name };
    exc.approvedAt = exc.updatedAt;
  }
  if (toStatus === "REVOKED") {
    exc.revokedAt     = exc.updatedAt;
    exc.revokedReason = reason;
  }
  exc.timeline.push({ id: randomUUID(), event: "STATUS_CHANGED", from: before.status, to: toStatus, by: operator, at: exc.updatedAt, reason });
  exc.audit.push({ id: randomUUID(), action: "exception.status_changed", by: operator, at: exc.updatedAt, reason, before, after: { status: toStatus } });
  return exc;
}

// ── Compliance Engine ──────────────────────────────────────────────────────────

const COMP_STATUS = { PASS: "PASS", WARNING: "WARNING", FAIL: "FAIL" };

function check(code, title, status, detail, recommendation = "") {
  return { code, title, status, detail, recommendation };
}

export function runComplianceEngine(db) {
  const results = [];
  const now     = new Date();

  const baselines  = db.govBaselines   || [];
  const adrs       = db.govAdrs        || [];
  const policies   = db.govPolicies    || [];
  const exceptions = db.govExceptions  || [];
  const deployments = db.deployments   || [];
  const incidents   = db.incidents     || [];
  const backupPols  = db.backupPolicies || [];
  const backupExecs = db.backupExecutions || [];
  const restoreTests = db.restoreTests  || [];
  const releases    = db.releases       || [];

  // GOV-C01 — At least one active baseline
  const activeBaselines = baselines.filter(b => b.status === "APPROVED");
  results.push(check("GOV-C01", "Baseline ativa",
    activeBaselines.length > 0 ? "PASS" : "FAIL",
    activeBaselines.length > 0 ? `${activeBaselines.length} baseline(s) aprovada(s)` : "Nenhuma baseline aprovada na plataforma.",
    "Criar e aprovar uma baseline representando o estado atual."
  ));

  // GOV-C02 — No PROPOSED ADRs older than 90 days
  const staleAdrs = adrs.filter(a => a.status === "PROPOSED" && (now - new Date(a.createdAt)) / 86_400_000 > 90);
  results.push(check("GOV-C02", "ADRs em revisão há mais de 90 dias",
    staleAdrs.length === 0 ? "PASS" : "WARNING",
    staleAdrs.length === 0 ? "Todas as ADRs propostas estão dentro do prazo." : `${staleAdrs.length} ADR(s) sem resolução há > 90 dias.`,
    "Aceitar, rejeitar ou arquivar ADRs pendentes."
  ));

  // GOV-C03 — At least one active policy per key category
  const KEY_CATS = ["SECURITY","BACKUP","DEPLOYMENT","BREAK_GLASS"];
  const missingCats = KEY_CATS.filter(cat =>
    !policies.some(p => p.category === cat && ["ACTIVE","EXPIRING"].includes(p.status))
  );
  results.push(check("GOV-C03", "Políticas obrigatórias vigentes",
    missingCats.length === 0 ? "PASS" : "FAIL",
    missingCats.length === 0 ? "Todas as categorias obrigatórias possuem políticas ativas." : `Categorias sem política ativa: ${missingCats.join(", ")}.`,
    "Criar e ativar políticas para as categorias ausentes."
  ));

  // GOV-C04 — No approved exceptions past expiresAt
  const expiredApproved = exceptions.filter(e =>
    e.status === "APPROVED" && new Date(e.expiresAt) < now
  );
  results.push(check("GOV-C04", "Exceções expiradas ainda aprovadas",
    expiredApproved.length === 0 ? "PASS" : "FAIL",
    expiredApproved.length === 0 ? "Nenhuma exceção aprovada está vencida." : `${expiredApproved.length} exceção(ões) aprovada(s) mas com expiresAt no passado.`,
    "Revogar ou renovar exceções expiradas."
  ));

  // GOV-C05 — No STABLE releases without at least one rollout
  const stableNoRollout = releases.filter(r => r.status === "STABLE" &&
    !(db.releaseRollouts || []).some(ro => ro.releaseId === r.id)
  );
  results.push(check("GOV-C05", "Releases STABLE sem rollout registrado",
    stableNoRollout.length === 0 ? "PASS" : "WARNING",
    stableNoRollout.length === 0 ? "Todas as releases STABLE possuem rollout." : `${stableNoRollout.length} release(s) STABLE sem rollout registrado.`,
    "Registrar rollout para releases que já estão em produção."
  ));

  // GOV-C06 — Active deployments without a linked release
  const deploysNoRelease = deployments.filter(d =>
    d.status === "active" && !d.releaseId
  );
  results.push(check("GOV-C06", "Deployments sem release vinculada",
    deploysNoRelease.length === 0 ? "PASS" : "WARNING",
    deploysNoRelease.length === 0 ? "Todos os deployments ativos possuem release." : `${deploysNoRelease.length} deployment(s) ativo(s) sem releaseId.`,
    "Vincular cada deployment a uma release oficial."
  ));

  // GOV-C07 — Backup coverage (at least one active policy)
  const activeBackupPols = backupPols.filter(p => p.enabled);
  results.push(check("GOV-C07", "Política de backup ativa",
    activeBackupPols.length > 0 ? "PASS" : "FAIL",
    activeBackupPols.length > 0 ? `${activeBackupPols.length} política(s) de backup ativa(s).` : "Nenhuma política de backup ativa.",
    "Criar e habilitar ao menos uma política de backup."
  ));

  // GOV-C08 — Restore tested in last 30 days
  const recentRestore = restoreTests.some(t =>
    t.status === "SUCCESS" && (now - new Date(t.startedAt)) / 86_400_000 <= 30
  );
  results.push(check("GOV-C08", "Restore testado nos últimos 30 dias",
    recentRestore ? "PASS" : "WARNING",
    recentRestore ? "Restore validado recentemente." : "Nenhum teste de restore bem-sucedido nos últimos 30 dias.",
    "Agendar e registrar teste de restauração."
  ));

  // GOV-C09 — Critical incidents with assignee
  const unassignedCritical = incidents.filter(i =>
    i.severity === "CRITICAL" && ["NEW","TRIAGED","IN_PROGRESS"].includes(i.status) && !i.assignedTo
  );
  results.push(check("GOV-C09", "Incidentes críticos sem responsável",
    unassignedCritical.length === 0 ? "PASS" : "FAIL",
    unassignedCritical.length === 0 ? "Todos os incidentes críticos possuem responsável." : `${unassignedCritical.length} incidente(s) crítico(s) sem responsável.`,
    "Atribuir responsável imediatamente aos incidentes críticos abertos."
  ));

  // GOV-C10 — Policies expiring within 30 days
  const expiringPols = policies.filter(p => p.status === "EXPIRING");
  results.push(check("GOV-C10", "Políticas com expiração próxima (≤ 30 dias)",
    expiringPols.length === 0 ? "PASS" : "WARNING",
    expiringPols.length === 0 ? "Nenhuma política com expiração próxima." : `${expiringPols.length} política(s) expirando em breve.`,
    "Renovar ou arquivar políticas com expiração próxima."
  ));

  // Overall score
  const counts = { PASS: 0, WARNING: 0, FAIL: 0 };
  for (const r of results) counts[r.status]++;
  const overallStatus = counts.FAIL > 0 ? "FAIL" : counts.WARNING > 0 ? "WARNING" : "PASS";

  return { results, counts, overallStatus, evaluatedAt: now.toISOString() };
}
