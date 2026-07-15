import express from "express";
import { v4 as uuidv4 } from "uuid";
import { withDb, readDb } from "../db.js";
import { hasAnyCapability, resolveActiveUnit } from "../utils/helpers.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

const VALID_STATUSES = [
  "pendente", "agendado", "em_execucao", "coletado",
  "aguardando_resultado", "resultado_disponivel", "concluido", "cancelado"
];

function canRequest(user) {
  return hasAnyCapability(user, ["exams.request", "exams.write"]);
}
function canRead(user) {
  return hasAnyCapability(user, ["exams.request", "exams.read", "exams.execute", "exams.result", "exams.admin", "exams.write"]);
}
function canExecute(user) {
  return hasAnyCapability(user, ["exams.execute", "exams.admin", "exams.write"]);
}

// POST /exam-requests
router.post("/exam-requests", async (req, res) => {
  if (!canRequest(req.user)) return res.status(403).json({ error: "Sem permissão para solicitar exames" });
  const body = req.body;
  if (!body.patientId) return res.status(400).json({ error: "patientId obrigatório" });
  if (!Array.isArray(body.exams) || body.exams.length === 0) return res.status(400).json({ error: "Informe ao menos um exame" });

  const result = await withDb(async db => {
    ensureDbShape(db);
    const patient = (db.patients || []).find(p => p.id === body.patientId);
    if (!patient) return { error: "Paciente não encontrado", status: 404 };

    const teamId = req.user.teamId || patient.teamId || null;
    const now = new Date().toISOString();
    const request = {
      id: uuidv4(),
      patientId: body.patientId,
      patientName: body.patientName || patient.name || null,
      clinicalRecordId: body.clinicalRecordId || null,
      requestedById: req.user.id,
      requestedByName: req.user.name || req.user.username || null,
      requestedByCouncil: body.requestedByCouncil || null,
      origin: body.origin || "medicina",
      teamId,
      requestedAt: now,
      exams: body.exams.map(e => ({
        name: String(e.name || "").trim(),
        urgency: ["urgente", "prioritario", "rotina"].includes(e.urgency) ? e.urgency : "rotina",
        notes: String(e.notes || "").trim(),
      })),
      priority: body.priority || "rotina",
      clinicalJustification: String(body.clinicalJustification || "").trim(),
      scheduledDate: body.scheduledDate || null,
      scheduledTime: body.scheduledTime || null,
      executionType: body.executionType || "unidade",
      status: "pendente",
      executedById: null,
      executedByName: null,
      executedAt: null,
      resultNotes: null,
      resultDate: null,
      notes: String(body.notes || "").trim(),
      createdAt: now,
      updatedAt: now,
    };

    db.examRequests.push(request);
    addAuditLog(db, req.user, "exam_request.created", "exam_request", request.id, {
      patientId: body.patientId,
      teamId,
      exams: request.exams.map(e => e.name),
      priority: request.priority,
    });
    return { data: request };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  return res.status(201).json(result);
});

// GET /exam-requests
router.get("/exam-requests", async (req, res) => {
  if (!canRead(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureDbShape(db);

  const teamId = req.user.teamId;
  let items = (db.examRequests || []).filter(r => !teamId || String(r.teamId || "") === String(teamId || ""));

  if (req.query.patientId) items = items.filter(r => r.patientId === req.query.patientId);
  if (req.query.status) {
    const statuses = req.query.status.split(",").map(s => s.trim());
    items = items.filter(r => statuses.includes(r.status));
  }
  if (req.query.date) items = items.filter(r => String(r.requestedAt || "").slice(0, 10) === req.query.date || r.scheduledDate === req.query.date);
  if (req.query.priority) items = items.filter(r => r.priority === req.query.priority);
  if (req.query.origin) items = items.filter(r => r.origin === req.query.origin);

  items = items.sort((a, b) => String(b.requestedAt || "").localeCompare(String(a.requestedAt || "")));

  return res.json({ data: items, total: items.length });
});

// GET /exam-requests/:id
router.get("/exam-requests/:id", async (req, res) => {
  if (!canRead(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureDbShape(db);
  const item = (db.examRequests || []).find(r => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Pedido não encontrado" });

  return res.json({ data: item });
});

// Statuses that cannot be transitioned away from
const FINAL_STATUSES = new Set(["concluido", "cancelado"]);

// PATCH /exam-requests/:id/status
router.patch("/exam-requests/:id/status", async (req, res) => {
  if (!canExecute(req.user)) return res.status(403).json({ error: "Sem permissão para executar exames" });

  const body = req.body;
  if (!VALID_STATUSES.includes(body.status)) {
    return res.status(400).json({ error: `Status inválido. Aceitos: ${VALID_STATUSES.join(", ")}` });
  }

  // Only concluido and cancelado allowed as new terminal transitions via this interface
  if (!FINAL_STATUSES.has(body.status)) {
    return res.status(400).json({ error: "Apenas Finalizado ou Cancelado são permitidos por esta interface." });
  }

  if (body.status === "cancelado" && !body.cancellationReason) {
    return res.status(400).json({ error: "Motivo do cancelamento é obrigatório." });
  }

  const result = await withDb(async db => {
    ensureDbShape(db);
    const idx = (db.examRequests || []).findIndex(r => r.id === req.params.id);
    if (idx < 0) return { error: "Pedido não encontrado", status: 404 };

    const current = db.examRequests[idx];

    // Block transitions from final states
    if (FINAL_STATUSES.has(current.status)) {
      return { error: `Pedido já encerrado (${current.status}). Transição não permitida.`, status: 409 };
    }

    const now = new Date().toISOString();
    const next = {
      ...current,
      status: body.status,
      updatedAt: now,
    };

    if (body.status === "concluido") {
      next.completedAt = now;
      next.completedBy = req.user.id;
      next.completedByName = req.user.name || req.user.username || null;
    }
    if (body.status === "cancelado") {
      next.cancelledAt = now;
      next.cancelledBy = req.user.id;
      next.cancelledByName = req.user.name || req.user.username || null;
      next.cancellationReason = String(body.cancellationReason || "").trim();
      if (body.cancellationNotes) next.cancellationNotes = String(body.cancellationNotes || "").slice(0, 500).trim();
    }
    if (body.notes !== undefined) next.notes = String(body.notes || "").trim();

    db.examRequests[idx] = next;

    const auditAction = body.status === "concluido" ? "LAB_ORDER_COMPLETED" : "LAB_ORDER_CANCELLED";
    addAuditLog(db, req.user, auditAction, "exam_request", req.params.id, {
      patientId: current.patientId,
      unitId: resolveActiveUnit(req),
      previousStatus: current.status,
      newStatus: body.status,
      cancellationReason: next.cancellationReason || undefined,
    });
    return { data: next };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  return res.json(result);
});

export default router;
