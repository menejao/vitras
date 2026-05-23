import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";

const publicRouter = express.Router();
const authRouter = express.Router();

function requireLabApiKey(req, res, next) {
  const key = String(req.headers["x-lab-api-key"] || "").trim();
  const expected = String(process.env.LAB_API_KEY || "").trim();
  if (!expected) {
    return res.status(503).json({ error: "Integração laboratorial não configurada. Defina LAB_API_KEY no servidor." });
  }
  if (!key || key !== expected) {
    return res.status(401).json({ error: "Chave de API inválida." });
  }
  next();
}

/*
  POST /integrations/lab/results
  Auth: x-lab-api-key header (LAB_API_KEY env var)

  Payload example:
  {
    "externalId":     "LAB-2026-00123",       // idempotency key (optional but recommended)
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
  const {
    externalId,
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
    return res.status(400).json({ error: "examTitle e result são obrigatórios." });
  }

  const outcome = await withDb((db) => {
    ensureDbShape(db);

    // Resolve patient
    let patient = null;
    if (bodyPatientId) {
      patient = db.patients.find((p) => p.id === String(bodyPatientId));
    }
    if (!patient && patientCpf) {
      const norm = String(patientCpf).replace(/[\s.\-]/g, "");
      patient = db.patients.find((p) => String(p.cpf || "").replace(/[\s.\-]/g, "") === norm);
    }
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado." } };

    // Idempotency
    if (externalId) {
      const dup = db.exams.find((e) => e.externalId === String(externalId));
      if (dup) return { exam: dup, patient, skipped: true };
    }

    const title = String(examTitle || "").trim();
    const now = new Date().toISOString();

    const details = [
      "[EXAME REALIZADO NO POSTO]",
      result ? `Resultado: ${String(result).trim()}` : "",
      unit ? `Unidade: ${String(unit).trim()}` : "",
      referenceRange ? `Referência: ${String(referenceRange).trim()}` : "",
      notes ? `Obs: ${String(notes).trim()}` : "",
    ].filter(Boolean).join("\n");

    // Try to update an existing unresolved posto exam with same title
    const idx = db.exams.findIndex(
      (e) =>
        e.patientId === patient.id &&
        e.title === title &&
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
        externalId: externalId ? String(externalId) : (db.exams[idx].externalId || ""),
        details,
        updatedAt: now,
        updatedBy: "lab-integration",
      };
      db.exams[idx] = exam;
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
        externalId: externalId ? String(externalId) : "",
        details,
        attachments: [],
        createdAt: now,
        createdBy: "lab-integration",
        updatedAt: now,
        updatedBy: "lab-integration",
      };
      db.exams.push(exam);
    }

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

    addAuditLog(
      db,
      { id: "lab-integration", role: "system" },
      "exam.lab_result_received",
      "exam",
      exam.id,
      { patientId: patient.id, externalId: externalId || "", isNew, lab: lab || "" }
    );

    return { exam, patient, isNew };
  });

  if (outcome?.error) return res.status(outcome.error.status).json({ error: outcome.error.message });
  if (outcome.skipped) return res.json({ ok: true, skipped: true, examId: outcome.exam.id });
  return res.status(outcome.isNew ? 201 : 200).json({ ok: true, examId: outcome.exam.id, patientName: outcome.patient.name });
});

// GET /notifications — auth required (placed after requireAuth in app.js)
authRouter.get("/notifications", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const teamId = req.user?.teamId;
  const items = db.notifications
    .filter((n) => !teamId || !n.teamId || n.teamId === teamId)
    .slice(-50)
    .reverse();
  return res.json(items);
});

export { publicRouter as labPublicRouter, authRouter as labNotificationsRouter };
