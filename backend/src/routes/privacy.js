import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { validate, PrivacyRequestCreateSchema } from "../schemas.js";
import { requireManager } from "../middlewares/auth.js";
import { ensureDbShape } from "../utils/domain.js";
import { PRIVACY_REQUEST_TYPES, PRIVACY_REQUEST_STATUS } from "../utils/helpers.js";
import {
  getPatientOrError, isAnonymizedPatient, getPatientActivityDate,
  anonymizePatientBundle, applyPatientCorrection, buildPatientAccessReport
} from "../utils/patients.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

function buildPrivacyRequestAuditSnapshot(item) {
  if (!item) return null;
  return {
    id: String(item.id || ""),
    teamId: String(item.teamId || ""),
    patientId: String(item.patientId || ""),
    type: String(item.type || ""),
    status: String(item.status || ""),
    createdBy: String(item.createdBy || ""),
    decidedBy: String(item.decidedBy || ""),
    completedAt: String(item.completedAt || "")
  };
}

router.get("/privacy/requests", requireManager, async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const status = String(req.query.status || "").trim();
  const type = String(req.query.type || "").trim();
  const patientId = String(req.query.patientId || "").trim();

  const items = db.privacyRequests
    .filter((item) => item.teamId === req.user.teamId)
    .filter((item) => !status || item.status === status)
    .filter((item) => !type || item.type === type)
    .filter((item) => !patientId || item.patientId === patientId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return res.json(items.slice(0, 300));
});

router.post("/privacy/requests", requireManager, validate(PrivacyRequestCreateSchema), async (req, res) => {
  const payload = req.body || {};
  const patientId = String(payload.patientId || "").trim();
  const type = String(payload.type || "").trim().toLowerCase();
  const notes = String(payload.notes || "").trim();
  const correctionData = payload.correctionData && typeof payload.correctionData === "object"
    ? payload.correctionData
    : {};

  if (!patientId || !PRIVACY_REQUEST_TYPES.has(type)) {
    return res.status(400).json({ error: "patientId e type (access|correction|deletion) são obrigatórios" });
  }

  if (type === "correction" && !Object.keys(correctionData).length) {
    return res.status(400).json({ error: "correctionData é obrigatório para solicitação de correção" });
  }

  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, patientId);
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });

  const created = await withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    const requestItem = {
      id: uuidv4(),
      teamId: req.user.teamId,
      patientId,
      type,
      status: "pending",
      notes,
      correctionData: type === "correction" ? correctionData : {},
      createdBy: req.user.id,
      createdByName: req.user.name,
      createdAt: new Date().toISOString(),
      decidedAt: "",
      decidedBy: "",
      completedAt: "",
      result: {}
    };
    mutableDb.privacyRequests.push(requestItem);
    addAuditLog(mutableDb, req.user, "privacy.request_created", "privacy_request", requestItem.id, {
      patientId,
      type,
      after: buildPrivacyRequestAuditSnapshot(requestItem)
    });
    return requestItem;
  });

  return res.status(201).json(created);
});

router.patch("/privacy/requests/:id", requireManager, async (req, res) => {
  const id = String(req.params.id || "").trim();
  const payload = req.body || {};
  const nextStatus = payload.status !== undefined ? String(payload.status || "").trim().toLowerCase() : "";
  const notes = payload.notes !== undefined ? String(payload.notes || "").trim() : undefined;
  const correctionData = payload.correctionData && typeof payload.correctionData === "object"
    ? payload.correctionData
    : undefined;

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.privacyRequests.findIndex((item) => item.id === id && item.teamId === req.user.teamId);
    if (index < 0) return null;
    const current = db.privacyRequests[index];
    const before = buildPrivacyRequestAuditSnapshot(current);
    const next = { ...current };

    if (nextStatus) {
      if (!PRIVACY_REQUEST_STATUS.has(nextStatus)) {
        return "invalid_status";
      }
      if (nextStatus === "completed") {
        return "manual_completed_not_allowed";
      }
      next.status = nextStatus;
      next.decidedAt = new Date().toISOString();
      next.decidedBy = req.user.id;
    }

    if (notes !== undefined) next.notes = notes;
    if (correctionData !== undefined && next.type === "correction") next.correctionData = correctionData;

    next.updatedAt = new Date().toISOString();
    next.updatedBy = req.user.id;
    db.privacyRequests[index] = next;

    addAuditLog(db, req.user, "privacy.request_updated", "privacy_request", id, {
      changedFields: Object.keys(payload || {}),
      before,
      after: buildPrivacyRequestAuditSnapshot(next)
    });

    return next;
  });

  if (result === "invalid_status") return res.status(400).json({ error: "status inválido" });
  if (result === "manual_completed_not_allowed") return res.status(400).json({ error: "Use /privacy/requests/:id/execute para concluir a solicitação" });
  if (!result) return res.status(404).json({ error: "Solicitação não encontrada" });
  return res.json(result);
});

router.post("/privacy/requests/:id/execute", requireManager, async (req, res) => {
  const id = String(req.params.id || "").trim();
  const payload = req.body || {};

  const outcome = await withDb((db) => {
    ensureDbShape(db);
    const reqIndex = db.privacyRequests.findIndex((item) => item.id === id && item.teamId === req.user.teamId);
    if (reqIndex < 0) return { error: { status: 404, message: "Solicitação não encontrada" } };

    const requestItem = db.privacyRequests[reqIndex];
    const before = buildPrivacyRequestAuditSnapshot(requestItem);
    if (requestItem.status === "completed") {
      return { error: { status: 409, message: "Solicitação já concluída" } };
    }
    if (requestItem.status === "rejected") {
      return { error: { status: 409, message: "Solicitação rejeitada. Não pode ser executada." } };
    }

    const patient = db.patients.find((p) => p.id === requestItem.patientId && p.teamId === req.user.teamId);
    if (!patient) return { error: { status: 404, message: "Paciente da solicitação não encontrado" } };

    let result = {};
    if (requestItem.type === "access") {
      const report = buildPatientAccessReport(db, patient);
      result = {
        reportSummary: report.summary,
        generatedAt: report.generatedAt
      };
      requestItem.result = result;
      requestItem.status = "completed";
      requestItem.completedAt = new Date().toISOString();
      requestItem.decidedAt = new Date().toISOString();
      requestItem.decidedBy = req.user.id;
      requestItem.executedBy = req.user.id;

      addAuditLog(db, req.user, "privacy.request_executed_access", "privacy_request", requestItem.id, {
        patientId: patient.id,
        before,
        after: buildPrivacyRequestAuditSnapshot(requestItem)
      });
      db.privacyRequests[reqIndex] = requestItem;
      return { request: requestItem, report };
    }

    if (requestItem.type === "correction") {
      const data = payload.correctionData && typeof payload.correctionData === "object"
        ? payload.correctionData
        : requestItem.correctionData || {};
      const correction = applyPatientCorrection(db, req.user, patient, data);
      const patientIndex = db.patients.findIndex((p) => p.id === patient.id);
      if (patientIndex >= 0) db.patients[patientIndex] = correction.next;

      result = { changedFields: correction.changedFields };
      requestItem.result = result;
      requestItem.status = "completed";
      requestItem.completedAt = new Date().toISOString();
      requestItem.decidedAt = new Date().toISOString();
      requestItem.decidedBy = req.user.id;
      requestItem.executedBy = req.user.id;
      db.privacyRequests[reqIndex] = requestItem;

      addAuditLog(db, req.user, "privacy.request_executed_correction", "privacy_request", requestItem.id, {
        patientId: patient.id,
        changedFields: correction.changedFields,
        before,
        after: buildPrivacyRequestAuditSnapshot(requestItem)
      });
      return { request: requestItem, patient: correction.next };
    }

    if (requestItem.type === "deletion") {
      if (isAnonymizedPatient(patient)) {
        return { error: { status: 409, message: "Paciente já anonimizado anteriormente" } };
      }
      const reason = String(payload.reason || requestItem.notes || "").trim();

      // ITEM 8: Pre-flight audit — fires BEFORE anonymization as a pre-flight record
      addAuditLog(db, req.user, "anonymization_warning_acknowledged", "patient", patient.id, {
        outcome: "preflight",
        requestId: requestItem.id,
        actorId: String(req.user?.id || ""),
        patientId: patient.id,
        reason,
        note: "Pre-flight record: anonymization about to execute. CFM 1821/2007 clinical snapshot residue acknowledged."
      });

      const anonymize = anonymizePatientBundle(db, req.user, patient, reason, requestItem.id);

      result = { anonymized: anonymize.changed, stats: anonymize.stats };
      requestItem.result = result;
      requestItem.status = "completed";
      requestItem.completedAt = new Date().toISOString();
      requestItem.decidedAt = new Date().toISOString();
      requestItem.decidedBy = req.user.id;
      requestItem.executedBy = req.user.id;
      db.privacyRequests[reqIndex] = requestItem;

      addAuditLog(db, req.user, "privacy.request_executed_deletion", "privacy_request", requestItem.id, {
        patientId: patient.id,
        stats: anonymize.stats,
        before,
        after: buildPrivacyRequestAuditSnapshot(requestItem)
      });
      return { request: requestItem };
    }

    return { error: { status: 400, message: "Tipo de solicitação não suportado" } };
  });

  if (outcome.error) return res.status(outcome.error.status).json({ error: outcome.error.message });
  return res.json(outcome);
});

router.post("/privacy/retention/anonymize", requireManager, async (req, res) => {
  const payload = req.body || {};
  const olderThanDays = Number(payload.olderThanDays || 365 * 5);
  const dryRun = Boolean(payload.dryRun);

  if (!Number.isFinite(olderThanDays) || olderThanDays < 30) {
    return res.status(400).json({ error: "olderThanDays deve ser número >= 30" });
  }

  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  const cutoffIso = new Date(cutoff).toISOString();

  const result = await withDb((db) => {
    ensureDbShape(db);
    const candidates = db.patients.filter((patient) => {
      if (patient.teamId !== req.user.teamId) return false;
      if (isAnonymizedPatient(patient)) return false;
      const activity = getPatientActivityDate(db, patient.id) || patient.updatedAt || patient.createdAt;
      if (!activity) return false;
      return String(activity) < cutoffIso;
    });

    const sample = candidates.slice(0, 20).map((p) => ({
      id: p.id,
      name: p.name,
      lastActivityAt: getPatientActivityDate(db, p.id) || p.updatedAt || p.createdAt
    }));

    if (dryRun) {
      return {
        dryRun: true,
        cutoffIso,
        candidateCount: candidates.length,
        sample
      };
    }

    let anonymizedCount = 0;
    const stats = {
      appointments: 0,
      clinicalRecords: 0,
      messages: 0,
      tasks: 0
    };

    for (const patient of candidates) {
      // ITEM 8: Pre-flight audit for each patient in bulk anonymization
      addAuditLog(db, req.user, "anonymization_warning_acknowledged", "patient", patient.id, {
        outcome: "preflight",
        requestId: "",
        actorId: String(req.user?.id || ""),
        patientId: patient.id,
        reason: `Retenção automática: sem atividade desde antes de ${cutoffIso}`,
        note: "Bulk retention pre-flight. CFM 1821/2007 clinical snapshot residue acknowledged."
      });

      const output = anonymizePatientBundle(
        db,
        req.user,
        patient,
        `Retenção automática: sem atividade desde antes de ${cutoffIso}`,
        ""
      );
      if (!output.changed) continue;
      anonymizedCount += 1;
      stats.appointments += output.stats.appointments || 0;
      stats.clinicalRecords += output.stats.clinicalRecords || 0;
      stats.messages += output.stats.messages || 0;
      stats.tasks += output.stats.tasks || 0;
    }

    addAuditLog(db, req.user, "privacy.retention_anonymize_run", "privacy_retention", req.user.teamId, {
      cutoffIso,
      olderThanDays,
      candidates: candidates.length,
      anonymizedCount,
      stats
    });

    return {
      dryRun: false,
      cutoffIso,
      candidateCount: candidates.length,
      anonymizedCount,
      stats,
      sample
    };
  });

  return res.json(result);
});

export default router;
