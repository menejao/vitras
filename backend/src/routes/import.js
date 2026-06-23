/**
 * Import Routes — MIG-01
 *
 * REST API for Import Job lifecycle management.
 * All endpoints require authentication. Commit and homologation require
 * break_glass_admin or support_admin.
 */

import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import { canonicalRole } from "../utils/helpers.js";
import { withDb, readDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";
import {
  createImportJob,
  getImportJob,
  listImportJobs,
  getSourceProfile,
  getStagedRecords,
  runFullPipeline,
  submitHomologation,
  executeCommit,
} from "../services/import-pipeline.js";

const router = express.Router();

function requireImportAccess(req, res, next) {
  const role = canonicalRole(req.user?.role);
  if (role !== "support_admin" && role !== "break_glass_admin") {
    return res.status(403).json({ error: "Acesso restrito a support_admin e break_glass_admin" });
  }
  next();
}

// ── POST /import/jobs — create Import Job ─────────────────────────────────

router.post("/import/jobs", requireAuth, requireImportAccess, async (req, res) => {
  const { unitId, teamId, sourceProfileId, lgpdConsentRecordId, localFilters } = req.body || {};

  if (!sourceProfileId) {
    return res.status(400).json({ error: "sourceProfileId obrigatório" });
  }

  const profile = getSourceProfile(sourceProfileId);
  if (!profile) {
    return res.status(400).json({ error: `Source Profile ${sourceProfileId} não encontrado` });
  }
  if (profile.status === "deprecated") {
    return res.status(400).json({ error: "Source Profile deprecado — use uma versão certificada" });
  }

  const db = await readDb();
  ensureDbShape(db);

  const targetUnitId = unitId || req.user.unitId || "";
  const targetTeamId = teamId || req.user.teamId || "";

  if (!targetUnitId) {
    return res.status(400).json({ error: "unitId obrigatório" });
  }

  const job = createImportJob({
    unitId: targetUnitId,
    teamId: targetTeamId,
    sourceProfileId,
    lgpdConsentRecordId: lgpdConsentRecordId || "pending",
    createdBy: req.user.id,
    localFilters: localFilters || {},
  });

  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, req.user, "import.job.created", "import_job", job.id, {
      outcome: "success",
      sourceProfileId,
      unitId: targetUnitId,
    });
  });

  return res.status(201).json(job);
});

// ── GET /import/jobs — list Import Jobs ───────────────────────────────────

router.get("/import/jobs", requireAuth, requireImportAccess, (req, res) => {
  const jobs = listImportJobs();
  return res.json(jobs);
});

// ── GET /import/jobs/:id — get Import Job ────────────────────────────────

router.get("/import/jobs/:id", requireAuth, requireImportAccess, (req, res) => {
  const job = getImportJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Import Job não encontrado" });
  return res.json(job);
});

// ── POST /import/jobs/:id/run — advance pipeline ─────────────────────────

router.post("/import/jobs/:id/run", requireAuth, requireImportAccess, async (req, res) => {
  const job = getImportJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Import Job não encontrado" });

  if (!["received", "mapping"].includes(job.status)) {
    return res.status(409).json({ error: `Import Job está em status ${job.status} — não pode ser re-executado` });
  }

  const rawPayload = req.body?.payload;
  if (!rawPayload) {
    return res.status(400).json({ error: "payload obrigatório no body" });
  }

  const db = await readDb();
  ensureDbShape(db);

  // Build existing production identity index for deduplication
  const existingProductionIds = {
    byCpf: new Map(db.patients.filter((p) => p.cpf).map((p) => [p.cpf, p.id])),
    byCns: new Map(db.patients.filter((p) => p.cns).map((p) => [p.cns, p.id])),
  };

  const context = {
    teamId: job.teamId,
    unitId: job.unitId,
    municipalityId: req.body.municipalityId || "",
    defaultAcsUserId: req.body.defaultAcsUserId || req.user.id,
    existingProductionIds,
  };

  const result = await runFullPipeline(job.id, rawPayload, context, withDb, addAuditLog);

  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, req.user, "import.pipeline.run", "import_job", job.id, {
      outcome: result.ok ? "success" : "failed",
      stage: result.ok ? "staging" : result.stage,
      patientsStaged: result.staged?.patients?.length || 0,
      eventsStaged: result.staged?.events?.length || 0,
    });
  });

  return res.json(result);
});

// ── GET /import/staging/:jobId/records — get staging records ─────────────

router.get("/import/staging/:jobId/records", requireAuth, requireImportAccess, (req, res) => {
  const job = getImportJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Import Job não encontrado" });

  if (!["homologating", "staging"].includes(job.status)) {
    return res.status(409).json({ error: "Staging disponível apenas para jobs em homologating ou staging" });
  }

  const staged = getStagedRecords(req.params.jobId);
  if (!staged) return res.status(404).json({ error: "Staging não encontrado para este Import Job" });

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
  const offset = (page - 1) * limit;

  const patients = staged.patients.slice(offset, offset + limit);
  const total = staged.patients.length;

  return res.json({
    patients,
    events: staged.events.filter((e) =>
      patients.some((p) => p.sourceId === e.patientSourceId)
    ),
    paginationMeta: {
      total,
      page,
      limit,
      hasNextPage: offset + limit < total,
      totalPages: Math.ceil(total / limit) || 1,
      eventsTotal: staged.events.length,
    },
  });
});

// ── GET /import/staging/:jobId/stats — staging summary ───────────────────

router.get("/import/staging/:jobId/stats", requireAuth, requireImportAccess, (req, res) => {
  const job = getImportJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Import Job não encontrado" });

  const staged = getStagedRecords(req.params.jobId);

  return res.json({
    job,
    staging: staged
      ? {
          totalPatients: staged.patients.length,
          totalEvents: staged.events.length,
          mergeCandidate: staged.patients.filter((p) => p.mergeCandidate).length,
          incompleteProfile: staged.patients.filter((p) => p.incompleteProfile).length,
          byValidationStatus: {
            valid: staged.patients.filter((p) => p.validationStatus === "valid").length,
            warning: staged.patients.filter((p) => p.validationStatus === "warning").length,
            rejected: staged.patients.filter((p) => p.validationStatus === "rejected").length,
          },
        }
      : null,
  });
});

// ── POST /import/jobs/:id/homologate — GO / NO GO ────────────────────────

router.post("/import/jobs/:id/homologate", requireAuth, requireImportAccess, async (req, res) => {
  const { decision, justification } = req.body || {};

  if (!decision || !["GO", "NO_GO"].includes(decision)) {
    return res.status(400).json({ error: "decision deve ser GO ou NO_GO" });
  }
  if (!justification || justification.trim().length < 10) {
    return res.status(400).json({ error: "Justificativa obrigatória (mínimo 10 caracteres)" });
  }

  let result;
  try {
    result = submitHomologation(req.params.id, decision, justification, req.user.id);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, req.user, `import.homologation.${decision.toLowerCase()}`, "import_job", req.params.id, {
      outcome: "success",
      decision,
      justification: justification.slice(0, 200),
    });
  });

  return res.json(result);
});

// ── POST /import/jobs/:id/commit — execute commit ────────────────────────

router.post("/import/jobs/:id/commit", requireAuth, requireImportAccess, async (req, res) => {
  const job = getImportJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Import Job não encontrado" });

  if (job.homologationResult !== "GO") {
    return res.status(409).json({ error: "Commit requer GO da homologação" });
  }

  let result;
  try {
    result = await executeCommit(job.id, withDb, addAuditLog, null);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, req.user, "import.committed", "import_job", job.id, {
      outcome: "success",
      committed: result.committed,
      auditHash: result.auditHash,
    });
  });

  return res.json(result);
});

export default router;
