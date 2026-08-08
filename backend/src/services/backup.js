/**
 * Backup, Restore and Business Continuity service — ERP-08
 *
 * Governa e audita políticas de backup, execuções registradas, testes de
 * restauração e perfis de continuidade de negócio.
 *
 * NÃO executa backups. NÃO acessa infraestrutura remota. NÃO usa dados clínicos.
 */

import { randomUUID } from "node:crypto";

// ── Enums ────────────────────────────────────────────────────────────────────

export const BACKUP_TYPE = {
  FULL:         "FULL",
  INCREMENTAL:  "INCREMENTAL",
  DIFFERENTIAL: "DIFFERENTIAL",
  SNAPSHOT:     "SNAPSHOT",
};

export const BACKUP_FREQUENCY = {
  HOURLY:  "HOURLY",
  DAILY:   "DAILY",
  WEEKLY:  "WEEKLY",
  MONTHLY: "MONTHLY",
  MANUAL:  "MANUAL",
};

export const BACKUP_SCOPE = {
  DATABASE:    "DATABASE",
  FILES:       "FILES",
  FULL_SYSTEM: "FULL_SYSTEM",
  CONFIG:      "CONFIG",
  AUDIT_LOG:   "AUDIT_LOG",
};

export const EXECUTION_STATUS = {
  PENDING:   "PENDING",
  RUNNING:   "RUNNING",
  SUCCESS:   "SUCCESS",
  FAILED:    "FAILED",
  CANCELLED: "CANCELLED",
  PARTIAL:   "PARTIAL",
};

export const RESTORE_STATUS = {
  PLANNED:   "PLANNED",
  RUNNING:   "RUNNING",
  SUCCESS:   "SUCCESS",
  FAILED:    "FAILED",
  CANCELLED: "CANCELLED",
};

export const RISK_LEVEL = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL" };

// ── Code generators ───────────────────────────────────────────────────────────

function nextSeq(items, prefix) {
  const year   = new Date().getFullYear();
  const full   = `${prefix}-${year}-`;
  const nums   = (items || [])
    .map(i => (i.policyCode || i.executionCode || i.restoreCode || ""))
    .filter(c => c.startsWith(full))
    .map(c => parseInt(c.slice(full.length), 10))
    .filter(n => !isNaN(n));
  return `${full}${String(nums.length ? Math.max(...nums) + 1 : 1).padStart(4, "0")}`;
}

export const generatePolicyCode    = (items) => nextSeq(items, "BKP");
export const generateExecutionCode = (items) => nextSeq(items, "EXC");
export const generateRestoreCode   = (items) => nextSeq(items, "RST");

// ── BackupPolicy factory & mutation ──────────────────────────────────────────

export function createBackupPolicy({
  name, scope, backupType, frequency, retentionDays, rpoTargetMinutes, rtoTargetMinutes,
  description = "", environment = "PRODUCTION", municipalityScope = [],
  unitScope = [], providerHint = null, operator, existingPolicies = [],
}) {
  if (!name?.trim())  throw Object.assign(new Error("name obrigatório"),        { statusCode: 400 });
  if (!BACKUP_SCOPE[scope])     throw Object.assign(new Error(`scope inválido: ${scope}`),    { statusCode: 400 });
  if (!BACKUP_TYPE[backupType]) throw Object.assign(new Error(`backupType inválido: ${backupType}`), { statusCode: 400 });
  if (!BACKUP_FREQUENCY[frequency]) throw Object.assign(new Error(`frequency inválido: ${frequency}`), { statusCode: 400 });
  if (!retentionDays || retentionDays < 1) throw Object.assign(new Error("retentionDays deve ser >= 1"), { statusCode: 400 });

  const now = new Date().toISOString();
  return {
    id:                 randomUUID(),
    policyCode:         generatePolicyCode(existingPolicies),
    name:               name.trim(),
    description:        description || "",
    scope,
    backupType,
    frequency,
    environment,
    retentionDays:      Number(retentionDays),
    rpoTargetMinutes:   rpoTargetMinutes ?? null,
    rtoTargetMinutes:   rtoTargetMinutes ?? null,
    municipalityScope:  Array.isArray(municipalityScope) ? municipalityScope : [],
    unitScope:          Array.isArray(unitScope) ? unitScope : [],
    providerHint:       providerHint || null,
    enabled:            true,
    version:            1,
    history:            [],
    createdBy:          { id: operator.id, name: operator.name },
    createdAt:          now,
    updatedAt:          now,
    audit:              [{ id: randomUUID(), action: "policy.created", by: operator, at: now, before: null, after: { name, scope, backupType, frequency, retentionDays } }],
  };
}

export function updateBackupPolicy(policy, { patch, operator, reason = null }) {
  const EDITABLE = ["name","description","frequency","retentionDays","rpoTargetMinutes",
                    "rtoTargetMinutes","municipalityScope","unitScope","providerHint","environment"];
  const before = {}, after = {};
  for (const k of EDITABLE) {
    if (patch[k] !== undefined) { before[k] = policy[k]; policy[k] = patch[k]; after[k] = patch[k]; }
  }
  if (patch.enabled !== undefined) {
    before.enabled = policy.enabled;
    policy.enabled = Boolean(patch.enabled);
    after.enabled  = policy.enabled;
  }
  policy.version  += 1;
  policy.updatedAt = new Date().toISOString();
  policy.history.push({ version: policy.version - 1, snapshot: { ...before }, archivedAt: policy.updatedAt });
  policy.audit.push({ id: randomUUID(), action: "policy.updated", by: operator, at: policy.updatedAt, reason, before, after });
  return policy;
}

// ── BackupExecution factory ───────────────────────────────────────────────────

export function createBackupExecution({
  policyId, startedAt, finishedAt = null, status,
  backupProvider = null, backupReference = null,
  sizeBytes = null, checksum = null, verified = false,
  environment = "PRODUCTION", errorMessage = null,
  operator, existingExecutions = [],
}) {
  if (!policyId) throw Object.assign(new Error("policyId obrigatório"), { statusCode: 400 });
  if (!EXECUTION_STATUS[status]) throw Object.assign(new Error(`status inválido: ${status}`), { statusCode: 400 });
  const now = new Date().toISOString();
  const duration = startedAt && finishedAt
    ? Math.round((new Date(finishedAt) - new Date(startedAt)) / 1000)
    : null;
  return {
    id:               randomUUID(),
    executionCode:    generateExecutionCode(existingExecutions),
    policyId,
    startedAt:        startedAt || now,
    finishedAt:       finishedAt || null,
    durationSeconds:  duration,
    status,
    backupProvider:   backupProvider || null,
    backupReference:  backupReference || null,
    sizeBytes:        sizeBytes ?? null,
    checksum:         checksum || null,
    verified:         Boolean(verified),
    environment,
    errorMessage:     errorMessage || null,
    recordedBy:       { id: operator.id, name: operator.name },
    createdAt:        now,
    updatedAt:        now,
  };
}

// ── RestoreTest factory & mutation ────────────────────────────────────────────

export function createRestoreTest({
  backupExecutionId, environment, startedAt, finishedAt = null,
  status, verifiedBy = null, notes = "", evidence = [],
  rpoAchievedMinutes = null, rtoAchievedMinutes = null,
  operator, existingTests = [],
}) {
  if (!backupExecutionId) throw Object.assign(new Error("backupExecutionId obrigatório"), { statusCode: 400 });
  if (!environment)       throw Object.assign(new Error("environment obrigatório"),       { statusCode: 400 });
  if (!RESTORE_STATUS[status]) throw Object.assign(new Error(`status inválido: ${status}`), { statusCode: 400 });
  const now = new Date().toISOString();
  const duration = startedAt && finishedAt
    ? Math.round((new Date(finishedAt) - new Date(startedAt)) / 1000)
    : null;
  return {
    id:                  randomUUID(),
    restoreCode:         generateRestoreCode(existingTests),
    backupExecutionId,
    environment,
    startedAt:           startedAt || now,
    finishedAt:          finishedAt || null,
    durationSeconds:     duration,
    status,
    rpoAchievedMinutes:  rpoAchievedMinutes ?? null,
    rtoAchievedMinutes:  rtoAchievedMinutes ?? null,
    verifiedBy:          verifiedBy || null,
    notes:               notes || "",
    evidence:            Array.isArray(evidence) ? evidence : [],
    recordedBy:          { id: operator.id, name: operator.name },
    createdAt:           now,
    updatedAt:           now,
    audit:               [{ id: randomUUID(), action: "restore.created", by: operator, at: now }],
  };
}

export function updateRestoreTest(test, { patch, operator }) {
  const EDITABLE = ["status","verifiedBy","notes","finishedAt","rpoAchievedMinutes","rtoAchievedMinutes"];
  for (const k of EDITABLE) {
    if (patch[k] !== undefined) test[k] = patch[k];
  }
  if (Array.isArray(patch.addEvidence)) {
    for (const ev of patch.addEvidence) test.evidence.push({ ...ev, addedAt: new Date().toISOString() });
  }
  if (test.startedAt && test.finishedAt && !test.durationSeconds) {
    test.durationSeconds = Math.round((new Date(test.finishedAt) - new Date(test.startedAt)) / 1000);
  }
  test.updatedAt = new Date().toISOString();
  test.audit.push({ id: randomUUID(), action: "restore.updated", by: operator, at: test.updatedAt, patch: { ...patch } });
  return test;
}

// ── Business Continuity Profile ───────────────────────────────────────────────

export function computeBusinessContinuity(db) {
  const policies   = db.backupPolicies   || [];
  const executions = db.backupExecutions || [];
  const tests      = db.restoreTests     || [];

  const enabledPolicies = policies.filter(p => p.enabled);
  const successExecs    = executions.filter(e => e.status === "SUCCESS").sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const successTests    = tests.filter(t => t.status === "SUCCESS").sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const lastBackup    = successExecs[0] || null;
  const lastRestore   = successTests[0] || null;

  const now = Date.now();
  const hoursSinceBackup  = lastBackup  ? (now - new Date(lastBackup.startedAt).getTime())  / 3_600_000 : null;
  const daysSinceRestore  = lastRestore ? (now - new Date(lastRestore.startedAt).getTime()) / 86_400_000 : null;

  // RPO: smallest rpoTargetMinutes among enabled policies
  const rpoTargets = enabledPolicies.map(p => p.rpoTargetMinutes).filter(x => x != null);
  const rtoTargets = enabledPolicies.map(p => p.rtoTargetMinutes).filter(x => x != null);
  const rpoTarget  = rpoTargets.length ? Math.min(...rpoTargets) : null;
  const rtoTarget  = rtoTargets.length ? Math.min(...rtoTargets) : null;

  const rpoActual = lastBackup ? Math.round(hoursSinceBackup * 60) : null;
  const rpoStatus = rpoTarget == null ? "UNKNOWN"
    : rpoActual == null ? "UNKNOWN"
    : rpoActual <= rpoTarget ? "OK" : "BREACHED";

  // Risk assessment
  const disabledPolicies = policies.filter(p => !p.enabled).length;
  const failedExecs      = executions.filter(e => e.status === "FAILED").length;
  const backupOverdue    = hoursSinceBackup != null && rpoTarget != null && (hoursSinceBackup * 60) > rpoTarget;
  const restoreNotTested = daysSinceRestore == null || daysSinceRestore > 30;

  let riskLevel = "LOW";
  if (backupOverdue && restoreNotTested) riskLevel = "CRITICAL";
  else if (backupOverdue || failedExecs > 0) riskLevel = "HIGH";
  else if (restoreNotTested || disabledPolicies > 0) riskLevel = "MEDIUM";

  // Next test due: 30 days after last restore
  const nextTestDue = lastRestore
    ? new Date(new Date(lastRestore.startedAt).getTime() + 30 * 86_400_000).toISOString()
    : null;

  return {
    rpoTargetMinutes:      rpoTarget,
    rtoTargetMinutes:      rtoTarget,
    rpoActualMinutes:      rpoActual,
    rpoStatus,
    riskLevel,
    lastBackup:            lastBackup ? { id: lastBackup.id, executionCode: lastBackup.executionCode, startedAt: lastBackup.startedAt, provider: lastBackup.backupProvider } : null,
    lastRestoreTest:       lastRestore ? { id: lastRestore.id, restoreCode: lastRestore.restoreCode, startedAt: lastRestore.startedAt, environment: lastRestore.environment } : null,
    nextRestoreTestDue:    nextTestDue,
    backupOverdue,
    restoreTestOverdue:    restoreNotTested,
    policies: {
      total:    policies.length,
      enabled:  enabledPolicies.length,
      disabled: disabledPolicies,
    },
    executions: {
      total:   executions.length,
      success: successExecs.length,
      failed:  failedExecs,
    },
    restoreTests: {
      total:   tests.length,
      success: successTests.length,
      failed:  tests.filter(t => t.status === "FAILED").length,
    },
    checkedAt: new Date().toISOString(),
  };
}

// ── Backup alerts ─────────────────────────────────────────────────────────────

export function runBackupDiagnostics(db) {
  const bcp    = computeBusinessContinuity(db);
  const alerts = [];

  if (bcp.backupOverdue) {
    alerts.push({ code: "BKP-001", title: "Backup em atraso", severity: "CRITICAL",
      recommendation: "Verificar política de backup e registrar execução mais recente." });
  }
  if (bcp.restoreTestOverdue) {
    alerts.push({ code: "BKP-002", title: "Teste de restore não realizado há mais de 30 dias", severity: "HIGH",
      recommendation: "Agendar e registrar novo teste de restauração." });
  }
  if (bcp.rpoStatus === "BREACHED") {
    alerts.push({ code: "BKP-003", title: "RPO excedido", severity: "CRITICAL",
      recommendation: `RPO alvo: ${bcp.rpoTargetMinutes} min. Atual: ${bcp.rpoActualMinutes} min.` });
  }
  const disabledWithoutSuccessRecent = (db.backupPolicies || []).filter(p => !p.enabled).length;
  if (disabledWithoutSuccessRecent > 0) {
    alerts.push({ code: "BKP-004", title: `${disabledWithoutSuccessRecent} política(s) desabilitada(s)`, severity: "MEDIUM",
      recommendation: "Revisar e reativar políticas desabilitadas ou arquivá-las formalmente." });
  }
  // Retention: executions older than retentionDays (flag only, no deletion)
  const now = Date.now();
  for (const policy of (db.backupPolicies || [])) {
    const overRetention = (db.backupExecutions || []).filter(e =>
      e.policyId === policy.id &&
      e.status === "SUCCESS" &&
      (now - new Date(e.startedAt).getTime()) / 86_400_000 > policy.retentionDays
    );
    if (overRetention.length) {
      alerts.push({ code: "BKP-005", title: `Política ${policy.policyCode}: ${overRetention.length} execução(ões) além da retenção`, severity: "LOW",
        recommendation: `Política define retenção de ${policy.retentionDays} dias. Executar arquivamento conforme processo operacional.` });
    }
  }
  return alerts;
}
