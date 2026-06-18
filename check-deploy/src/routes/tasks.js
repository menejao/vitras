import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { validate, TaskCreateSchema, TaskPatchSchema } from "../schemas.js";
import { requireManagerOrDoctor } from "../middlewares/auth.js";
import { ensureDbShape } from "../utils/domain.js";
import { canonicalRole, isManager, isDoctor, isAcs } from "../utils/helpers.js";
import { getAllowedPatients, canAccessPatient, getPatientOrError } from "../utils/patients.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

function buildTaskAuditSnapshot(task) {
  if (!task) return null;
  return {
    id: String(task.id || ""),
    patientId: String(task.patientId || ""),
    assigneeId: String(task.assigneeId || ""),
    title: String(task.title || ""),
    status: String(task.status || ""),
    dueDate: String(task.dueDate || ""),
    updatedAt: String(task.updatedAt || task.createdAt || "")
  };
}

router.get("/tasks", async (req, res) => {
  const { patientId, assigneeId } = req.query;
  const db = await readDb();
  ensureDbShape(db);

  const allowedPatientIds = new Set(getAllowedPatients(db, req.user, {}).map((p) => p.id));

  const filtered = db.tasks.filter((t) => {
    if (!allowedPatientIds.has(t.patientId)) return false;
    if (patientId && t.patientId !== patientId) return false;
    if (assigneeId && t.assigneeId !== assigneeId) return false;
    return true;
  });

  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json(filtered);
});

router.post("/tasks", requireManagerOrDoctor, validate(TaskCreateSchema), async (req, res) => {
  const payload = req.body;

  if (!payload.patientId || !payload.assigneeId || !payload.title) {
    return res.status(400).json({ error: "patientId, assigneeId e title são obrigatórios" });
  }

  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, String(payload.patientId));
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });

  const assignee = db.users.find((u) => u.id === String(payload.assigneeId));
  if (!assignee || canonicalRole(assignee.role) !== "acs" || assignee.teamId !== req.user.teamId) {
    return res.status(400).json({ error: "Responsável deve ser ACS da mesma equipe" });
  }

  const task = {
    id: uuidv4(),
    patientId: String(payload.patientId),
    assigneeId: String(payload.assigneeId),
    title: String(payload.title),
    notes: payload.notes ? String(payload.notes) : "",
    status: payload.status ? String(payload.status) : "pending",
    dueDate: payload.dueDate ? String(payload.dueDate) : "",
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    mutableDb.tasks.push(task);
    addAuditLog(mutableDb, req.user, "task.created", "task", task.id, {
      patientId: task.patientId,
      assigneeId: task.assigneeId,
      after: buildTaskAuditSnapshot(task)
    });
    mutableDb.notifications.push({
      id: uuidv4(),
      type: "info",
      title: "Nova tarefa atribuída",
      detail: `${req.user.name || "Equipe"} atribuiu uma tarefa para ${lookup.patient?.name || "paciente"}: "${task.title}"`,
      targetUserId: task.assigneeId,
      patientId: task.patientId,
      taskId: task.id,
      teamId: req.user.teamId,
      createdAt: task.createdAt,
      read: false,
    });
  });

  return res.status(201).json(task);
});

router.patch("/tasks/:id", validate(TaskPatchSchema), async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  const updated = await withDb((db) => {
    ensureDbShape(db);
    const index = db.tasks.findIndex((t) => t.id === id);
    if (index < 0) return null;

    const current = db.tasks[index];
    const patient = db.patients.find((p) => p.id === current.patientId);
    if (!patient || !canAccessPatient(req.user, patient)) return "forbidden";

    if (isAcs(req.user)) {
      // ACS may only update their own tasks and only status/notes fields
      if (current.assigneeId !== req.user.id) return "forbidden";

      const before = buildTaskAuditSnapshot(current);
      const acsPatch = {};
      if (payload.status !== undefined) acsPatch.status = payload.status;
      if (payload.notes !== undefined) acsPatch.notes = payload.notes;

      const nextForAcs = {
        ...current,
        ...acsPatch,
        id,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id
      };

      db.tasks[index] = nextForAcs;
      addAuditLog(db, req.user, "task.status_updated", "task", id, {
        changedFields: Object.keys(acsPatch),
        before,
        after: buildTaskAuditSnapshot(nextForAcs)
      });
      return nextForAcs;
    }

    if (isManager(req.user) || isDoctor(req.user)) {
      const before = buildTaskAuditSnapshot(current);
      const nextForManager = {
        ...current,
        ...payload,
        id,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id
      };

      db.tasks[index] = nextForManager;
      addAuditLog(db, req.user, "task.updated", "task", id, {
        changedFields: Object.keys(payload),
        before,
        after: buildTaskAuditSnapshot(nextForManager)
      });
      return nextForManager;
    }

    return "forbidden";
  });

  if (updated === "forbidden") {
    return res.status(403).json({ error: "Sem permissão para atualizar esta tarefa" });
  }

  if (!updated) {
    return res.status(404).json({ error: "Tarefa não encontrada" });
  }

  return res.json(updated);
});

export default router;
