import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { validate, ExamCreateSchema, ExamAttachmentCreateSchema } from "../schemas.js";
import { ensureDbShape } from "../utils/domain.js";
import { canAccessPatient, getPatientOrError } from "../utils/patients.js";
import { hasAnyCapability, resolveActiveUnit } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";
import { recordMetric } from "../services/metrics.js";

const router = express.Router();
const attachmentJsonParser = express.json({ type: "application/x.valens-exam-attachment+json", limit: "20mb" });
const EXAM_FILE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"]);
const BASE64_PATTERN = /^[A-Za-z0-9+/=\s]+$/;

function canReadExams(user) {
  return hasAnyCapability(user, ["exams.read", "exams.write"]);
}

function canWriteExams(user) {
  return hasAnyCapability(user, ["exams.write"]);
}

function normalizeExamResponse(exam) {
  return {
    ...exam,
    attachments: Array.isArray(exam.attachments)
      ? exam.attachments.map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
          contentType: attachment.contentType,
          size: attachment.size,
          createdAt: attachment.createdAt,
          createdBy: attachment.createdBy,
          url: `data:${attachment.contentType};base64,${attachment.dataBase64}`
        }))
      : []
  };
}

function buildExamAuditSnapshot(exam) {
  if (!exam) return null;
  return {
    id: String(exam.id || ""),
    patientId: String(exam.patientId || ""),
    teamId: String(exam.teamId || ""),
    title: String(exam.title || ""),
    date: String(exam.date || ""),
    details: String(exam.details || ""),
    attachmentsCount: Array.isArray(exam.attachments) ? exam.attachments.length : 0,
    updatedAt: String(exam.updatedAt || exam.createdAt || "")
  };
}

function sanitizeBase64Payload(value) {
  const normalized = String(value || "").replace(/\s+/g, "");
  if (!normalized || !BASE64_PATTERN.test(normalized)) return "";
  return normalized;
}

router.get("/patients/:id/exams", async (req, res) => {
  if (!canReadExams(req.user)) {
    return res.status(403).json({ error: "Sem permissão para consultar exames" });
  }

  const db = await readDb();
  ensureDbShape(db);

  const lookup = getPatientOrError(db, req.user, String(req.params.id || "").trim());
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });

  const exams = db.exams
    .filter((exam) => exam.patientId === lookup.patient.id && String(exam.status || "") !== "inactive")
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .map(normalizeExamResponse);

  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, req.user, "exam.list_read", "patient", lookup.patient.id, {
      patientId: lookup.patient.id,
      teamId: lookup.patient.teamId,
      totalReturned: exams.length,
      outcome: "success"
    });
  });

  return res.json(exams);
});

router.post("/patients/:id/exams", validate(ExamCreateSchema), async (req, res) => {
  if (!canWriteExams(req.user)) {
    return res.status(403).json({ error: "Sem permissão para registrar exames" });
  }

  const patientId = String(req.params.id || "").trim();
  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, patientId);
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });

  const exam = {
    id: uuidv4(),
    patientId,
    teamId: lookup.patient.teamId,
    executingUnitId: resolveActiveUnit(req),
    title: String(req.body.title || "").trim(),
    date: String(req.body.date || "").trim(),
    details: String(req.body.notes || "").trim(),
    source: req.body.source === "externo" ? "externo" : "posto",
    attachments: [],
    createdAt: new Date().toISOString(),
    createdBy: req.user.id,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.id
  };

  await withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    mutableDb.exams.push(exam);
    recordMetric("exam.created", 1, { teamId: exam.teamId, unitId: req.user?.unitId || "-" });
    addAuditLog(mutableDb, req.user, "exam.created", "exam", exam.id, {
      patientId,
      teamId: exam.teamId,
      after: buildExamAuditSnapshot(exam)
    });
  });

  return res.status(201).json(normalizeExamResponse(exam));
});

router.post("/patients/:id/exams/:examId/attachments", attachmentJsonParser, validate(ExamAttachmentCreateSchema), async (req, res) => {
  if (!canWriteExams(req.user)) {
    return res.status(403).json({ error: "Sem permissão para anexar exames" });
  }

  const patientId = String(req.params.id || "").trim();
  const examId = String(req.params.examId || "").trim();
  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, patientId);
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });

  const contentType = String(req.body.contentType || "").trim().toLowerCase();
  const dataBase64 = sanitizeBase64Payload(req.body.dataBase64);
  if (!EXAM_FILE_TYPES.has(contentType)) {
    return res.status(400).json({ error: "Tipo de arquivo não suportado" });
  }
  if (!dataBase64) {
    return res.status(400).json({ error: "Arquivo inválido" });
  }

  const result = await withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    const examIndex = mutableDb.exams.findIndex((exam) => exam.id === examId && exam.patientId === patientId);
    if (examIndex < 0) return { error: { status: 404, message: "Exame não encontrado" } };

    const current = mutableDb.exams[examIndex];
    if (!canAccessPatient(req.user, lookup.patient) || current.teamId !== lookup.patient.teamId) {
      return { error: { status: 403, message: "Sem permissão para este paciente" } };
    }

    const before = buildExamAuditSnapshot(current);
    const attachment = {
      id: uuidv4(),
      name: String(req.body.name || "").trim(),
      contentType,
      size: Number(req.body.size || 0),
      dataBase64,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };

    const next = {
      ...current,
      attachments: [...(Array.isArray(current.attachments) ? current.attachments : []), attachment],
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };
    mutableDb.exams[examIndex] = next;
    addAuditLog(mutableDb, req.user, "exam.attachment_added", "exam", examId, {
      patientId,
      attachmentId: attachment.id,
      attachmentName: attachment.name,
      before,
      after: buildExamAuditSnapshot(next)
    });
    return { attachment: normalizeExamResponse(next).attachments.at(-1) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.attachment);
});

router.delete("/patients/:id/exams/:examId", async (req, res) => {
  if (!canWriteExams(req.user)) {
    return res.status(403).json({ error: "Sem permissão para excluir exames" });
  }

  const patientId = String(req.params.id || "").trim();
  const examId = String(req.params.examId || "").trim();
  const justification = String(req.headers["x-justification"] || "").trim();
  if (justification.length < 5) {
    return res.status(400).json({ error: "Justificativa obrigatória para excluir exame" });
  }

  const result = await withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    const lookup = getPatientOrError(mutableDb, req.user, patientId);
    if (lookup.error) return { error: lookup.error };
    const examIndex = mutableDb.exams.findIndex((exam) => exam.id === examId && exam.patientId === patientId);
    if (examIndex < 0) return { error: { status: 404, message: "Exame não encontrado" } };

    const current = mutableDb.exams[examIndex];
    const before = buildExamAuditSnapshot(current);
    const now = new Date().toISOString();
    mutableDb.exams[examIndex] = {
      ...current,
      status: "inactive",
      inactivatedAt: now,
      inactivatedById: req.user.id,
      inactivationReason: justification
    };
    addAuditLog(mutableDb, req.user, "exam.inactivated", "exam", examId, {
      patientId,
      justification,
      before,
      after: buildExamAuditSnapshot(mutableDb.exams[examIndex])
    });
    return { ok: true };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({ ok: true });
});

export default router;
