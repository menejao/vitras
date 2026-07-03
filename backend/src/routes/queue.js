import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { validate, QueueCreateSchema, QueuePatchSchema } from "../schemas.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability, normalizeDemandType } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

function canReadQueue(user) {
  return hasCapability(user, "queue.read") || hasCapability(user, "queue.write");
}

function canWriteQueue(user) {
  return hasCapability(user, "queue.write");
}

function buildQueueSnapshot(entry) {
  if (!entry) return null;
  return {
    id: String(entry.id || ""),
    patientId: String(entry.patientId || ""),
    patientName: String(entry.patientName || ""),
    teamId: String(entry.teamId || ""),
    priority: String(entry.priority || "normal"),
    demandType: String(entry.demandType || "scheduled"),
    destination: String(entry.destination || ""),
    status: String(entry.status || "waiting"),
    arrivedAt: String(entry.arrivedAt || ""),
    updatedAt: String(entry.updatedAt || entry.arrivedAt || "")
  };
}

const ACTIVE_Q_STATUSES = ["waiting", "triage", "ready", "attending", "aguardando_triagem", "liberado", "chamado", "em_atendimento"];
const TERMINAL_Q_STATUSES = ["done", "atendido", "faltou", "cancelado"];

function normalizeQueueStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  const valid = [...ACTIVE_Q_STATUSES, ...TERMINAL_Q_STATUSES];
  if (valid.includes(raw)) return raw;
  return "waiting";
}

function sortQueue(entries = []) {
  const priorityOrder = { urgent: 0, elderly: 1, pregnant: 2, child: 3, normal: 4 };
  return [...entries].sort((a, b) => {
    const aDone = TERMINAL_Q_STATUSES.includes(String(a.status || ""));
    const bDone = TERMINAL_Q_STATUSES.includes(String(b.status || ""));
    if (aDone && !bDone) return 1;
    if (bDone && !aDone) return -1;
    const pa = priorityOrder[String(a.priority || "normal")] ?? 4;
    const pb = priorityOrder[String(b.priority || "normal")] ?? 4;
    if (pa !== pb) return pa - pb;
    return String(a.arrivedAt || "").localeCompare(String(b.arrivedAt || ""));
  });
}

function getScopedQueueEntries(db, user) {
  ensureDbShape(db);
  const teamId = String(user?.teamId || "").trim();
  return db.queueEntries.filter((entry) => {
    if (!canReadQueue(user)) return false;
    const entryStatus = String(entry.status || "");
    if (entryStatus === "removed" || entryStatus === "cleared") return false;
    if (teamId && String(entry.teamId || "") === teamId) return true;
    return false; // fail-safe: no teamId = no access
  });
}

router.get("/queue", async (req, res) => {
  if (!canReadQueue(req.user)) {
    return res.status(403).json({ error: "Sem permissão para fila" });
  }
  const db = await readDb();
  const entries = sortQueue(getScopedQueueEntries(db, req.user));
  return res.json(entries);
});

router.post("/queue", validate(QueueCreateSchema), async (req, res) => {
  if (!canWriteQueue(req.user)) {
    return res.status(403).json({ error: "Sem permissão para atualizar fila" });
  }

  const payload = req.body;
  const result = await withDb((db) => {
    ensureDbShape(db);
    const patient = db.patients.find((item) => item.id === String(payload.patientId));
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };
    if (String(patient.teamId || "") !== String(req.user.teamId || "")) {
      return { error: { status: 403, message: "Paciente fora da equipe atual" } };
    }
    const duplicate = db.queueEntries.find((item) =>
      item.patientId === patient.id &&
      ACTIVE_Q_STATUSES.includes(String(item.status || ""))
    );
    if (duplicate) {
      return { error: { status: 409, message: "Paciente já está na fila ativa" } };
    }

    const now = new Date().toISOString();
    const initialStatus = payload.needsTriage === false ? "liberado" : "aguardando_triagem";
    const entry = {
      id: uuidv4(),
      patientId: patient.id,
      patientName: patient.name,
      teamId: patient.teamId,
      priority: String(payload.priority || "normal"),
      reason: String(payload.reason || "").trim(),
      demandType: normalizeDemandType(payload.demandType),
      destination: payload.destination ? String(payload.destination) : null,
      specialty: String(payload.specialty || payload.specialtyKey || "").trim(),
      specialtyKey: String(payload.specialtyKey || payload.specialty || "").trim(),
      agendaRef: String(payload.agendaRef || "").trim(),
      needsTriage: payload.needsTriage !== false,
      professionalId: String(payload.professionalId || "").trim() || null,
      professionalName: String(payload.professionalName || "").trim() || null,
      status: initialStatus,
      arrivedAt: now,
      createdAt: now,
      createdBy: req.user.id,
      updatedAt: now,
      updatedBy: req.user.id,
      executingTeamId: String(req.user.teamId || ""),
      executingUnitId: String(req.user.unitId || ""),
      triageBy: "",
      triageStart: "",
      triageDone: "",
      vitals: null
    };
    db.queueEntries.push(entry);
    addAuditLog(db, req.user, "queue.entry_created", "queue_entry", entry.id, {
      patientId: patient.id,
      teamId: patient.teamId,
      after: buildQueueSnapshot(entry)
    });
    return { entry };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.entry);
});

router.patch("/queue/:id", validate(QueuePatchSchema), async (req, res) => {
  if (!canWriteQueue(req.user)) {
    return res.status(403).json({ error: "Sem permissão para atualizar fila" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.queueEntries.findIndex((item) => item.id === String(req.params.id || ""));
    if (index < 0) return { error: { status: 404, message: "Entrada da fila não encontrada" } };

    const current = db.queueEntries[index];
    if (String(current.teamId || "") !== String(req.user.teamId || "") && !hasCapability(req.user, "team.manage")) {
      return { error: { status: 403, message: "Sem permissão para esta fila" } };
    }

    const before = buildQueueSnapshot(current);
    const next = {
      ...current,
      ...(req.body.priority !== undefined ? { priority: String(req.body.priority || "normal") } : {}),
      ...(req.body.reason !== undefined ? { reason: String(req.body.reason || "").trim() } : {}),
      ...(req.body.demandType !== undefined ? { demandType: normalizeDemandType(req.body.demandType) } : {}),
      ...(req.body.destination !== undefined ? { destination: req.body.destination ? String(req.body.destination) : null } : {}),
      ...(req.body.status !== undefined ? { status: normalizeQueueStatus(req.body.status) } : {}),
      ...(req.body.triageStart !== undefined ? { triageStart: String(req.body.triageStart || "") } : {}),
      ...(req.body.triageDone !== undefined ? { triageDone: String(req.body.triageDone || "") } : {}),
      ...(req.body.startedAt !== undefined ? { startedAt: String(req.body.startedAt || "") } : {}),
      ...(req.body.endedAt !== undefined ? { endedAt: String(req.body.endedAt || "") } : {}),
      ...(req.body.vitals !== undefined ? { vitals: req.body.vitals || null } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };

    if (next.status === "triage") {
      next.triageBy = req.user.id;
      if (!next.triageStart) next.triageStart = next.updatedAt;
    }
    if (next.status === "waiting") {
      next.triageBy = "";
      next.triageStart = "";
    }
    if (next.status === "ready" && !next.triageDone) {
      next.triageDone = next.updatedAt;
    }

    db.queueEntries[index] = next;
    addAuditLog(db, req.user, "queue.entry_updated", "queue_entry", next.id, {
      patientId: next.patientId,
      teamId: next.teamId,
      changedFields: Object.keys(req.body || {}),
      before,
      after: buildQueueSnapshot(next)
    });
    return { entry: next };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.entry);
});

router.delete("/queue/:id", async (req, res) => {
  if (!canWriteQueue(req.user)) {
    return res.status(403).json({ error: "Sem permissão para atualizar fila" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.queueEntries.findIndex((item) => item.id === String(req.params.id || ""));
    if (index < 0) return { error: { status: 404, message: "Entrada da fila não encontrada" } };
    const current = db.queueEntries[index];
    if (String(current.teamId || "") !== String(req.user.teamId || "") && !hasCapability(req.user, "team.manage")) {
      return { error: { status: 403, message: "Sem permissão para esta fila" } };
    }
    const now = new Date().toISOString();
    db.queueEntries[index] = {
      ...current,
      status: "removed",
      removedAt: now,
      removedById: req.user.id
    };
    addAuditLog(db, req.user, "queue.entry_removed", "queue_entry", current.id, {
      patientId: current.patientId,
      teamId: current.teamId,
      before: buildQueueSnapshot(current),
      after: buildQueueSnapshot(db.queueEntries[index])
    });
    return { ok: true };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({ ok: true });
});

router.post("/queue/clear-done", async (req, res) => {
  if (!canWriteQueue(req.user)) {
    return res.status(403).json({ error: "Sem permissão para atualizar fila" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const teamId = String(req.user.teamId || "");
    const beforeCount = db.queueEntries.length;
    const now = new Date().toISOString();
    let clearedCount = 0;
    db.queueEntries = db.queueEntries.map((entry) => {
      if (String(entry.teamId || "") === teamId && TERMINAL_Q_STATUSES.includes(String(entry.status || ""))) {
        clearedCount += 1;
        return { ...entry, status: "cleared", clearedAt: now, clearedById: req.user.id };
      }
      return entry;
    });
    addAuditLog(db, req.user, "queue.done_cleared", "queue_entry", teamId || "team", {
      teamId,
      clearedCount,
      beforeCount,
      afterCount: db.queueEntries.length
    });
    return { removedCount: clearedCount };
  });

  return res.json(result);
});

export default router;
