import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";

const publicRouter = express.Router();
const authRouter = express.Router();

function requireLabApiKey(req, res, next) {
  const key = String(req.headers["x-api-key"] || "").trim();
  const expected = String(process.env.LAB_INTEGRATION_API_KEY || "").trim();
  if (!expected) {
    return res.status(503).json({ error: "Integração laboratorial não configurada. Defina LAB_INTEGRATION_API_KEY no servidor." });
  }
  if (!key || key !== expected) {
    return res.status(401).json({ error: "Chave de API inválida." });
  }
  next();
}

/*
  POST /integrations/lab/results
  Auth:       x-api-key header (LAB_INTEGRATION_API_KEY env var)
  Tracking:   x-request-id header (arbitrary string, returned in response)
  Idempotency: idempotency-key header — same key → same response, no duplicate

  Payload example:
  {
    "patientCpf":     "001.001.009-09",        // OR patientId
    "patientId":      "seed-p-g09",            // optional if patientCpf provided
    "examTitle":      "Glicemia de Jejum",
    "collectionDate": "2026-05-20",
    "resultDate":     "2026-05-22",
    "result":         "102 mg/dL",
    "unit":           "mg/dL",
    "referenceRange": "70–99 mg/dL",
    "lab":            "Laboratório Municipal",
    "notes":          ""
  }
*/
publicRouter.post("/integrations/lab/results", requireLabApiKey, express.json({ limit: "1mb" }), async (req, res) => {
  const requestId = String(req.headers["x-request-id"] || uuidv4()).trim().slice(0, 128);
  const idempotencyKey = String(req.headers["idempotency-key"] || "").trim().slice(0, 256);

  const {
    patientCpf,
    patientId: bodyPatientId,
    examTitle,
    collectionDate,
    resultDate,
    result,
    lab,
    unit,
    referenceRange,
    notes,
  } = req.body || {};

  if (!examTitle || !result) {
    await withDb((db) => {
      ensureDbShape(db);
      addAuditLog(db, { id: "lab-integration", role: "system" }, "lab_integration.validation_error", "lab_integration", requestId, {
        requestId,
        idempotencyKey,
        error: "examTitle e result são obrigatórios",
      });
    }).catch(() => {});
    return res.status(400).json({ error: "examTitle e result são obrigatórios." });
  }

  const outcome = await withDb((db) => {
    ensureDbShape(db);
    const now = new Date().toISOString();

    // Idempotency check — same idempotency-key returns cached response
    if (idempotencyKey) {
      const existing = db.labIntegrations.find((r) => r.idempotencyKey === idempotencyKey);
      if (existing) {
        addAuditLog(db, { id: "lab-integration", role: "system" }, "lab_integration.duplicate_attempt", "lab_integration", existing.id, {
          requestId,
          idempotencyKey,
          originalRequestId: existing.requestId,
          examId: existing.examId,
        });
        return { skipped: true, examId: existing.examId, requestId, idempotencyKey };
      }
    }

    // Log request received
    const integrationId = uuidv4();
    addAuditLog(db, { id: "lab-integration", role: "system" }, "lab_integration.request_received", "lab_integration", integrationId, {
      requestId,
      idempotencyKey,
      examTitle: String(examTitle || ""),
      patientCpf: patientCpf ? String(patientCpf).replace(/[\d]/g, "*") : undefined,
      patientId: bodyPatientId || undefined,
    });

    // Resolve patient
    let patient = null;
    if (bodyPatientId) {
      patient = db.patients.find((p) => p.id === String(bodyPatientId));
    }
    if (!patient && patientCpf) {
      const norm = String(patientCpf).replace(/[\s.\-]/g, "");
      patient = db.patients.find((p) => String(p.cpf || "").replace(/[\s.\-]/g, "") === norm);
    }
    if (!patient) {
      addAuditLog(db, { id: "lab-integration", role: "system" }, "lab_integration.patient_not_found", "lab_integration", integrationId, {
        requestId, idempotencyKey,
      });
      return { error: { status: 404, message: "Paciente não encontrado." } };
    }

    const title = String(examTitle || "").trim();
    const details = [
      "[EXAME REALIZADO NO POSTO]",
      result ? `Resultado: ${String(result).trim()}` : "",
      unit ? `Unidade: ${String(unit).trim()}` : "",
      referenceRange ? `Referência: ${String(referenceRange).trim()}` : "",
      notes ? `Obs: ${String(notes).trim()}` : "",
    ].filter(Boolean).join("\n");

    // Try to update an existing pending posto exam with same title
    const idx = db.exams.findIndex(
      (e) =>
        e.patientId === patient.id &&
        e.title === title &&
        e.source !== "externo" &&
        e.status !== "result_available" &&
        !String(e.details || "").includes("[EXAME EXTERNO")
    );

    let exam;
    let isNew = false;

    if (idx >= 0) {
      exam = {
        ...db.exams[idx],
        status: "result_available",
        resultDate: String(resultDate || now.slice(0, 10)),
        lab: String(lab || ""),
        externalId: idempotencyKey || (db.exams[idx].externalId || ""),
        details,
        source: "posto",
        updatedAt: now,
        updatedBy: "lab-integration",
      };
      db.exams[idx] = exam;
      addAuditLog(db, { id: "lab-integration", role: "system" }, "lab_integration.result_updated", "exam", exam.id, {
        requestId, idempotencyKey, patientId: patient.id, lab: lab || "", isNew: false,
      });
    } else {
      isNew = true;
      exam = {
        id: uuidv4(),
        patientId: patient.id,
        teamId: patient.teamId,
        title,
        date: String(collectionDate || now.slice(0, 10)),
        status: "result_available",
        resultDate: String(resultDate || now.slice(0, 10)),
        lab: String(lab || ""),
        source: "posto",
        externalId: idempotencyKey || "",
        details,
        attachments: [],
        createdAt: now,
        createdBy: "lab-integration",
        updatedAt: now,
        updatedBy: "lab-integration",
      };
      db.exams.push(exam);
      addAuditLog(db, { id: "lab-integration", role: "system" }, "lab_integration.result_created", "exam", exam.id, {
        requestId, idempotencyKey, patientId: patient.id, lab: lab || "", isNew: true,
      });
    }

    // Store integration record for idempotency
    db.labIntegrations.push({
      id: integrationId,
      requestId,
      idempotencyKey: idempotencyKey || "",
      examId: exam.id,
      patientId: patient.id,
      teamId: patient.teamId,
      examTitle: title,
      status: "result_received",
      lab: String(lab || ""),
      createdAt: now,
    });

    // Persist notification
    db.notifications.push({
      id: uuidv4(),
      type: "info",
      title: `Resultado disponível: ${title}`,
      detail: `Saiu o resultado do exame ${title} do paciente ${patient.name}.`,
      patientId: patient.id,
      teamId: patient.teamId,
      examId: exam.id,
      createdAt: now,
      read: false,
    });

    return { exam, patient, isNew, requestId };
  });

  if (outcome?.error) return res.status(outcome.error.status).json({ error: outcome.error.message });
  if (outcome.skipped) return res.json({ ok: true, skipped: true, examId: outcome.examId, requestId: outcome.requestId });
  return res.status(outcome.isNew ? 201 : 200).json({
    ok: true,
    examId: outcome.exam.id,
    patientName: outcome.patient.name,
    requestId: outcome.requestId,
  });
});

// GET /notifications — auth required (placed after requireAuth in app.js)
authRouter.get("/notifications", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const teamId = req.user?.teamId;
  const userId = req.user?.id;
  const items = db.notifications
    .filter((n) => {
      if (teamId && n.teamId && n.teamId !== teamId) return false;
      if (n.targetUserId && n.targetUserId !== userId) return false;
      return true;
    })
    .slice(-50)
    .reverse();
  return res.json(items);
});

export { publicRouter as labPublicRouter, authRouter as labNotificationsRouter };
