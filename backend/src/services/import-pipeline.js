/**
 * Import Pipeline Orchestrator — ARCH-INT-01 FASE 5
 *
 * Manages the full lifecycle of an Import Job:
 * received → profiling → mapping → validating → selecting → staging → homologating → committed | discarded | failed
 *
 * In-memory mode (file driver / test): staging stored in importJobsStore
 * PostgreSQL mode: staging stored in app_import_staging table
 */

import crypto from "node:crypto";
import { applyMapping } from "./mapping-engine.js";
import { runValidation } from "./validation-engine.js";
import { applySelection } from "./population-selection.js";

// ── In-memory store (file driver / test mode) ─────────────────────────────

const importJobsStore = new Map();
const importStagingStore = new Map(); // jobId → { patients, events }
const importRawStore = new Map();     // jobId → raw payload

// ── Source Profile Registry ───────────────────────────────────────────────

const SOURCE_PROFILES = {
  "sp-pec-aps-v01": {
    id: "sp-pec-aps-v01",
    name: "e-SUS PEC APS",
    type: "pec",
    version: "4.2",
    encoding: "UTF-8",
    format: "json",
    locale: "pt-BR",
    capabilities: {
      hasCpf: true,
      hasCns: true,
      hasClinicalRecords: true,
      hasVisits: true,
      hasMicroArea: true,
    },
    certifiedBy: "system",
    certifiedAt: "2026-06-23T00:00:00Z",
    status: "certified",
  },
};

export function getSourceProfile(profileId) {
  return SOURCE_PROFILES[profileId] || null;
}

// ── Job CRUD ──────────────────────────────────────────────────────────────

export function createImportJob({ unitId, teamId, sourceProfileId, lgpdConsentRecordId, createdBy, localFilters }) {
  const id = crypto.randomUUID();
  const job = {
    id,
    unitId,
    teamId,
    sourceProfileId,
    sourceSystem: SOURCE_PROFILES[sourceProfileId]?.name || sourceProfileId,
    status: "received",
    lgpdConsentRecordId: lgpdConsentRecordId || "consent-required",
    createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localFilters: localFilters || {},
    stats: {
      totalRaw: 0,
      profiled: 0,
      mapped: 0,
      validated: 0,
      rejected: 0,
      selected: 0,
      staged: 0,
      committed: 0,
    },
    errors: [],
    homologationResult: null,
    homologatedBy: null,
    homologatedAt: null,
    commitAt: null,
    auditHash: null,
  };
  importJobsStore.set(id, job);
  return job;
}

export function getImportJob(id) {
  return importJobsStore.get(id) || null;
}

export function listImportJobs() {
  return Array.from(importJobsStore.values()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

function updateJob(id, updates) {
  const job = importJobsStore.get(id);
  if (!job) return null;
  const updated = { ...job, ...updates, updatedAt: new Date().toISOString() };
  importJobsStore.set(id, updated);
  return updated;
}

// ── Stage 1: Profiling ────────────────────────────────────────────────────

export function runProfiling(jobId, rawPayload) {
  const job = importJobsStore.get(jobId);
  if (!job) throw new Error(`Import Job ${jobId} não encontrado`);

  // Store raw (immutable)
  const rawHash = crypto.createHash("sha256").update(JSON.stringify(rawPayload)).digest("hex");
  importRawStore.set(jobId, { payload: rawPayload, hash: rawHash, receivedAt: new Date().toISOString() });

  const profile = SOURCE_PROFILES[job.sourceProfileId];
  if (!profile) {
    updateJob(jobId, { status: "failed", errors: [{ stage: "profiling", reason: `Source Profile ${job.sourceProfileId} não encontrado` }] });
    return { ok: false, reason: "Source Profile não encontrado" };
  }
  if (profile.status === "deprecated") {
    updateJob(jobId, { status: "failed", errors: [{ stage: "profiling", reason: "Source Profile deprecado" }] });
    return { ok: false, reason: "Source Profile deprecado" };
  }

  const totalRaw = Array.isArray(rawPayload.pacientes) ? rawPayload.pacientes.length : 0;
  updateJob(jobId, {
    status: "mapping",
    "stats.totalRaw": totalRaw,
    stats: { ...job.stats, totalRaw, profiled: totalRaw },
  });

  return { ok: true, profile, rawHash, totalRaw };
}

// ── Stage 2: Mapping ──────────────────────────────────────────────────────

export function runMapping(jobId, rawPayload, context) {
  const job = importJobsStore.get(jobId);
  if (!job) throw new Error(`Import Job ${jobId} não encontrado`);

  const mappingResult = applyMapping(rawPayload, {
    importJobId: jobId,
    sourceSystem: job.sourceSystem,
    targetTeamId: context.teamId || job.teamId,
    targetUnitId: context.unitId || job.unitId,
    targetMunicipalityId: context.municipalityId,
    defaultAcsUserId: context.defaultAcsUserId,
  });

  const { stats } = mappingResult;
  updateJob(jobId, {
    status: "validating",
    stats: {
      ...job.stats,
      mapped: stats.patientsMapped,
      rejected: stats.patientsRejected,
    },
    errors: [
      ...job.errors,
      ...mappingResult.patients.rejected.flatMap((p) => p.errors.map((e) => ({ stage: "mapping", sourceId: p.sourceId, ...e }))),
      ...mappingResult.events.rejected.flatMap((e) => e.errors.map((err) => ({ stage: "mapping", sourceId: e.sourceId, ...err }))),
    ],
  });

  return mappingResult;
}

// ── Stage 3: Validation ───────────────────────────────────────────────────

export function runValidationStage(jobId, mappingResult, existingProductionIds) {
  const job = importJobsStore.get(jobId);
  if (!job) throw new Error(`Import Job ${jobId} não encontrado`);

  const validationResult = runValidation(mappingResult, existingProductionIds);

  if (validationResult.shouldFail) {
    updateJob(jobId, {
      status: "failed",
      errors: [
        ...job.errors,
        { stage: "validation", reason: `Taxa de eventos órfãos excedeu threshold (${(validationResult.thresholds.orphanEventRate.value * 100).toFixed(1)}%)` },
      ],
    });
    return { ok: false, validationResult };
  }

  updateJob(jobId, {
    status: "selecting",
    stats: {
      ...job.stats,
      validated: validationResult.stats.validPatients,
      rejected: job.stats.rejected + validationResult.stats.invalidPatients,
    },
  });

  return { ok: true, validationResult };
}

// ── Stage 4: Population Selection ────────────────────────────────────────

export function runSelectionStage(jobId, validationResult) {
  const job = importJobsStore.get(jobId);
  if (!job) throw new Error(`Import Job ${jobId} não encontrado`);

  const selectionResult = applySelection(validationResult, null, job.localFilters, new Date());

  updateJob(jobId, {
    status: "staging",
    stats: {
      ...job.stats,
      selected: selectionResult.stats.selected,
      rejected: job.stats.rejected + selectionResult.stats.rejected,
    },
  });

  return selectionResult;
}

// ── Stage 5: Staging ──────────────────────────────────────────────────────

export function stageRecords(jobId, selectionResult) {
  const job = importJobsStore.get(jobId);
  if (!job) throw new Error(`Import Job ${jobId} não encontrado`);

  const staged = {
    patients: selectionResult.selected.map((p) => ({
      importJobId: jobId,
      entityType: "patient",
      canonicalData: p.canonical,
      sourceId: p.sourceId,
      validationStatus: p.mergeCandidate ? "warning" : "valid",
      mergeCandidate: p.mergeCandidate || false,
      mergeTargetId: null,
      incompleteProfile: p.incompleteProfile || false,
      createdAt: new Date().toISOString(),
    })),
    events: selectionResult.events.map((e) => ({
      importJobId: jobId,
      entityType: "clinical_event",
      canonicalData: e.canonical,
      sourceId: e.sourceId,
      patientSourceId: e.patientSourceId,
      validationStatus: "valid",
      mergeCandidate: false,
      createdAt: new Date().toISOString(),
    })),
  };

  importStagingStore.set(jobId, staged);

  updateJob(jobId, {
    status: "homologating",
    stats: {
      ...job.stats,
      staged: staged.patients.length,
    },
  });

  return staged;
}

export function getStagedRecords(jobId) {
  return importStagingStore.get(jobId) || null;
}

// ── Stage 6: Homologation ─────────────────────────────────────────────────

export function submitHomologation(jobId, decision, justification, homologatedBy) {
  const job = importJobsStore.get(jobId);
  if (!job) throw new Error(`Import Job ${jobId} não encontrado`);
  if (job.status !== "homologating") {
    throw new Error(`Import Job ${jobId} não está em homologating (status atual: ${job.status})`);
  }

  if (decision !== "GO" && decision !== "NO_GO") {
    throw new Error("decision deve ser GO ou NO_GO");
  }

  if (!justification || justification.trim().length < 10) {
    throw new Error("Justificativa obrigatória (mínimo 10 caracteres)");
  }

  const now = new Date().toISOString();

  if (decision === "NO_GO") {
    // Clear staging
    importStagingStore.delete(jobId);
    updateJob(jobId, {
      status: "discarded",
      homologationResult: "NO_GO",
      homologatedBy,
      homologatedAt: now,
    });
    return { ok: true, decision: "NO_GO" };
  }

  updateJob(jobId, {
    homologationResult: "GO",
    homologatedBy,
    homologatedAt: now,
    // status remains 'homologating' until commit
  });

  return { ok: true, decision: "GO" };
}

// ── Stage 7: Commit ───────────────────────────────────────────────────────

export async function executeCommit(jobId, withDbFn, addAuditLogFn, buildAuditActor) {
  const job = importJobsStore.get(jobId);
  if (!job) throw new Error(`Import Job ${jobId} não encontrado`);

  if (job.homologationResult !== "GO") {
    throw new Error(`Commit requer homologação GO (atual: ${job.homologationResult})`);
  }

  // Idempotency guard
  if (job.status === "committed") {
    return { ok: true, idempotent: true };
  }

  const staged = importStagingStore.get(jobId);
  if (!staged) throw new Error(`Staging para ${jobId} não encontrado`);

  const now = new Date().toISOString();
  let committed = 0;

  await withDbFn((db) => {
    if (!db.patients) db.patients = [];
    if (!db.acsVisits) db.acsVisits = [];

    for (const sp of staged.patients) {
      const canonical = sp.canonicalData;
      const existingIdx = db.patients.findIndex(
        (p) => (canonical.cpf && p.cpf === canonical.cpf) || (canonical.cns && p.cns === canonical.cns)
      );

      if (existingIdx >= 0 && sp.mergeCandidate) {
        // Merge: update existing record with newer data where production record is older
        const existing = db.patients[existingIdx];
        db.patients[existingIdx] = {
          ...existing,
          ...canonical,
          id: existing.id, // preserve production ID
          importJobId: jobId,
          sourceSystem: canonical.sourceSystem,
          updatedAt: now,
        };
      } else if (existingIdx < 0) {
        // New record
        const { v4: uuidv4 } = { v4: () => crypto.randomUUID() };
        db.patients.push({
          ...canonical,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        });
        committed++;
      }
    }

    // Commit clinical events (visits)
    for (const se of staged.events) {
      const canonical = se.canonicalData;
      if (canonical.type !== "visit") continue;

      // Find the production patientId from sourceId
      const stagedPat = staged.patients.find((sp) => sp.sourceId === se.patientSourceId);
      if (!stagedPat) continue;

      const prodPat = db.patients.find(
        (p) => (stagedPat.canonicalData.cpf && p.cpf === stagedPat.canonicalData.cpf) ||
                (stagedPat.canonicalData.cns && p.cns === stagedPat.canonicalData.cns) ||
                (p.sourceId === se.patientSourceId && p.importJobId === jobId)
      );
      if (!prodPat) continue;

      // Idempotency: skip if same sourceId+importJobId already exists
      const alreadyExists = (db.acsVisits || []).some(
        (v) => v.sourceId === canonical.sourceId && v.importJobId === jobId
      );
      if (alreadyExists) continue;

      db.acsVisits.push({
        id: crypto.randomUUID(),
        patientId: prodPat.id,
        teamId: canonical.teamId,
        acsId: canonical.createdBy,
        dataVisita: canonical.dataVisita,
        turno: canonical.turno,
        tipoVisita: canonical.tipoVisita,
        motivosVisita: canonical.motivosVisita,
        desfecho: canonical.desfecho,
        sourceId: canonical.sourceId,
        importJobId: jobId,
        sourceSystem: canonical.sourceSystem,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  const auditHash = crypto
    .createHash("sha256")
    .update(`${jobId}:${now}:committed:${staged.patients.length}`)
    .digest("hex");

  updateJob(jobId, {
    status: "committed",
    commitAt: now,
    auditHash,
    stats: { ...job.stats, committed },
  });

  // Clear staging after commit
  importStagingStore.delete(jobId);

  return { ok: true, committed, auditHash };
}

// ── Full pipeline run (for testing and API) ───────────────────────────────

export async function runFullPipeline(jobId, rawPayload, context, withDbFn, addAuditLogFn) {
  const job = importJobsStore.get(jobId);
  if (!job) throw new Error(`Import Job ${jobId} não encontrado`);

  // Stage 1: Profiling
  const profilingResult = runProfiling(jobId, rawPayload);
  if (!profilingResult.ok) return { ok: false, stage: "profiling", reason: profilingResult.reason };

  // Stage 2: Mapping
  const mappingResult = runMapping(jobId, rawPayload, context);

  // Stage 3: Validation
  const validationStageResult = runValidationStage(jobId, mappingResult, context.existingProductionIds || null);
  if (!validationStageResult.ok) return { ok: false, stage: "validation", validationResult: validationStageResult.validationResult };

  // Stage 4: Population Selection
  const selectionResult = runSelectionStage(jobId, validationStageResult.validationResult);

  // Stage 5: Staging
  const staged = stageRecords(jobId, selectionResult);

  return {
    ok: true,
    profilingResult,
    mappingResult,
    validationResult: validationStageResult.validationResult,
    selectionResult,
    staged,
    job: importJobsStore.get(jobId),
  };
}
