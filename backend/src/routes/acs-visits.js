import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { requireAuth } from "../middlewares/auth.js";
import { hasCapability, isAcs, isManager } from "../utils/helpers.js";
import { validate, AcsVisitCreateSchema, AcsVisitUpdateSchema } from "../schemas.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

function canReadVisits(user) {
  return hasCapability(user, "acs.visit.read");
}

function canCreateVisit(user) {
  return hasCapability(user, "acs.visit.create");
}

function canUpdateVisit(user, visit) {
  if (!hasCapability(user, "acs.visit.update")) return false;
  // ACS may only update their own visits
  if (isAcs(user)) return visit.acsId === user.id;
  return true;
}

function scopeFilter(user, visits) {
  if (user.role === "break_glass_admin") return visits;
  if (isAcs(user)) return visits.filter(v => v.acsId === user.id);
  // nurse_manager, gestor, doctor, security_auditor: team scope
  return visits.filter(v => v.teamId === user.teamId);
}

function auditActor(req) {
  return {
    ...(req.user || {}),
    id: String(req.user?.id || "system"),
    name: String(req.user?.name || "system"),
    teamId: String(req.user?.teamId || ""),
    requestMeta: {
      requestId: req.requestId || "",
      ip: String(req.ip || req.socket?.remoteAddress || ""),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 512),
      method: String(req.method || ""),
      path: String(req.originalUrl || req.path || ""),
      authTransport: String(req.user?.authTransport || "anonymous")
    }
  };
}

// GET /acs-visits — list with optional filters: acsId, patientId, from, to, desfecho
router.get("/acs-visits", requireAuth, async (req, res) => {
  if (!canReadVisits(req.user)) {
    return res.status(403).json({ error: "Sem permissão para consultar visitas ACS" });
  }

  const db = await readDb();
  ensureDbShape(db);

  let visits = scopeFilter(req.user, db.acsVisits);

  const { acsId, patientId, from, to, desfecho, householdId } = req.query;
  if (acsId)       visits = visits.filter(v => v.acsId === acsId);
  if (patientId)   visits = visits.filter(v => v.patientId === patientId);
  if (householdId) visits = visits.filter(v => v.householdId === householdId);
  if (desfecho)    visits = visits.filter(v => v.desfecho === desfecho);
  if (from)        visits = visits.filter(v => v.date >= from);
  if (to)          visits = visits.filter(v => v.date <= to);

  visits = [...visits].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return res.json(visits);
});

// GET /acs-visits/:id
router.get("/acs-visits/:id", requireAuth, async (req, res) => {
  if (!canReadVisits(req.user)) {
    return res.status(403).json({ error: "Sem permissão para consultar visitas ACS" });
  }

  const db = await readDb();
  ensureDbShape(db);

  const visit = db.acsVisits.find(v => v.id === req.params.id);
  if (!visit) return res.status(404).json({ error: "Visita não encontrada" });

  const scoped = scopeFilter(req.user, [visit]);
  if (!scoped.length) return res.status(403).json({ error: "Sem permissão para visualizar esta visita" });

  return res.json(visit);
});

// GET /acs-visits/patient/:patientId
router.get("/acs-visits/patient/:patientId", requireAuth, async (req, res) => {
  if (!canReadVisits(req.user)) {
    return res.status(403).json({ error: "Sem permissão para consultar visitas ACS" });
  }

  const db = await readDb();
  ensureDbShape(db);

  const patient = db.patients.find(p => p.id === req.params.patientId);
  if (!patient) return res.status(404).json({ error: "Paciente não encontrado" });

  let visits = db.acsVisits.filter(v => v.patientId === req.params.patientId);
  visits = scopeFilter(req.user, visits);
  visits = [...visits].sort((a, b) => b.date.localeCompare(a.date));

  return res.json(visits);
});

// GET /acs-visits/household/:householdId
router.get("/acs-visits/household/:householdId", requireAuth, async (req, res) => {
  if (!canReadVisits(req.user)) {
    return res.status(403).json({ error: "Sem permissão para consultar visitas ACS" });
  }

  const db = await readDb();
  ensureDbShape(db);

  let visits = db.acsVisits.filter(v => v.householdId === req.params.householdId);
  visits = scopeFilter(req.user, visits);
  visits = [...visits].sort((a, b) => b.date.localeCompare(a.date));

  return res.json(visits);
});

// GET /acs-visits/task/:taskId
router.get("/acs-visits/task/:taskId", requireAuth, async (req, res) => {
  if (!canReadVisits(req.user)) {
    return res.status(403).json({ error: "Sem permissão para consultar visitas ACS" });
  }

  const db = await readDb();
  ensureDbShape(db);

  let visits = db.acsVisits.filter(v => v.taskId === req.params.taskId);
  visits = scopeFilter(req.user, visits);
  visits = [...visits].sort((a, b) => b.date.localeCompare(a.date));

  return res.json(visits);
});

// POST /acs-visits
router.post("/acs-visits", requireAuth, validate(AcsVisitCreateSchema), async (req, res) => {
  if (!canCreateVisit(req.user)) {
    return res.status(403).json({ error: "Sem permissão para registrar visita ACS" });
  }

  const payload = req.body;

  const result = await withDb((db) => {
    ensureDbShape(db);

    const patient = db.patients.find(p => p.id === payload.patientId);
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };

    // Scope: ACS may only create visits for their assigned patients (or break_glass)
    if (isAcs(req.user) && patient.assignedAcsId !== req.user.id && req.user.role !== "break_glass_admin") {
      return { error: { status: 403, message: "ACS só pode registrar visita de pacientes da sua microárea" } };
    }

    // Auto-link most recent household if not provided
    let householdId = payload.householdId || null;
    if (!householdId && db.households?.length) {
      const patientHouseholds = db.households
        .filter(h => h.patientId === payload.patientId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (patientHouseholds.length) householdId = patientHouseholds[0].id;
    }

    const now = new Date().toISOString();
    const visit = {
      id:                uuidv4(),
      patientId:         String(payload.patientId),
      patientName:       String(patient.socialName || patient.name || ""),
      householdId:       householdId,
      taskId:            payload.taskId || null,
      acsId:             String(req.user.id),
      acsName:           String(req.user.name || ""),
      teamId:            String(patient.teamId || req.user.teamId || ""),
      date:              String(payload.date),
      turno:             payload.turno || null,
      microarea:         payload.microarea || null,
      foraArea:           payload.foraArea === true,
      tipoImovel:         payload.tipoImovel || null,
      visitaCompartilhada: payload.visitaCompartilhada === true,
      desfecho:           String(payload.desfecho),
      motivos:            Array.isArray(payload.motivos) ? payload.motivos : [],
      buscaAtiva:         Array.isArray(payload.buscaAtiva) ? payload.buscaAtiva : [],
      acompanhamentos:    Array.isArray(payload.acompanhamentos) ? payload.acompanhamentos : [],
      controleAmbiental:  Array.isArray(payload.controleAmbiental) ? payload.controleAmbiental : [],
      peso:               payload.peso ?? null,
      altura:             payload.altura ?? null,
      temperatura:        payload.temperatura ?? null,
      paSistolica:        payload.paSistolica ?? null,
      paDiastolica:       payload.paDiastolica ?? null,
      glicemia:           payload.glicemia ?? null,
      momentoGlicemia:    payload.glicemia != null ? (payload.momentoGlicemia || "aleatorio") : null,
      observacoes:        payload.observacoes || null,
      cadastroIndividual: payload.cadastroIndividual ?? null,
      cadastroDomiciliar: payload.cadastroDomiciliar ?? null,
      createdAt:          now,
      updatedAt:          now
    };

    db.acsVisits.push(visit);

    addAuditLog(db, auditActor(req), "acs_visit.created", "acs_visit", visit.id, {
      patientId: visit.patientId,
      acsId: visit.acsId,
      householdId: visit.householdId,
      taskId: visit.taskId,
      date: visit.date,
      desfecho: visit.desfecho,
      outcome: "success"
    });

    // If this visit originated from a task, mark task done when desfecho=realizada
    if (visit.taskId && visit.desfecho === "realizada") {
      const taskIdx = db.tasks.findIndex(t => t.id === visit.taskId);
      if (taskIdx >= 0 && db.tasks[taskIdx].status !== "done") {
        const task = db.tasks[taskIdx];
        db.tasks[taskIdx] = { ...task, status: "done", updatedAt: now, updatedBy: req.user.id };
        addAuditLog(db, auditActor(req), "task.status_updated", "task", visit.taskId, {
          reason: "acs_visit_completed",
          visitId: visit.id,
          before: { status: task.status },
          after: { status: "done" }
        });
      }
    }

    return { visit };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.visit);
});

// PATCH /acs-visits/:id
router.patch("/acs-visits/:id", requireAuth, validate(AcsVisitUpdateSchema), async (req, res) => {
  const visitId = String(req.params.id || "").trim();
  const payload = req.body;

  const result = await withDb((db) => {
    ensureDbShape(db);

    const idx = db.acsVisits.findIndex(v => v.id === visitId);
    if (idx < 0) return { error: { status: 404, message: "Visita não encontrada" } };

    const current = db.acsVisits[idx];

    if (!canUpdateVisit(req.user, current)) {
      return { error: { status: 403, message: "Sem permissão para editar esta visita" } };
    }

    // Optimistic locking: if client sends updatedAt, detect concurrent edits
    const clientUpdatedAt = payload.updatedAt;
    if (clientUpdatedAt && current.updatedAt && clientUpdatedAt !== current.updatedAt) {
      return { error: { status: 409, message: "Este registro foi alterado por outro usuário. Atualize os dados antes de salvar novamente.", code: "CONFLICT" } };
    }

    const now = new Date().toISOString();
    const next = { ...current, updatedAt: now };
    if (payload.desfecho          !== undefined) next.desfecho          = payload.desfecho;
    if (payload.turno             !== undefined) next.turno             = payload.turno;
    if (payload.motivos           !== undefined) next.motivos           = payload.motivos;
    if (payload.buscaAtiva        !== undefined) next.buscaAtiva        = payload.buscaAtiva;
    if (payload.acompanhamentos   !== undefined) next.acompanhamentos   = payload.acompanhamentos;
    if (payload.controleAmbiental !== undefined) next.controleAmbiental = payload.controleAmbiental;
    if (payload.peso              !== undefined) next.peso              = payload.peso;
    if (payload.altura            !== undefined) next.altura            = payload.altura;
    if (payload.observacoes       !== undefined) next.observacoes       = payload.observacoes;

    db.acsVisits[idx] = next;

    addAuditLog(db, auditActor(req), "acs_visit.updated", "acs_visit", visitId, {
      patientId: current.patientId,
      acsId: current.acsId,
      changedFields: Object.keys(payload),
      outcome: "success"
    });

    // If desfecho changed to realizada and task not yet done
    if (payload.desfecho === "realizada" && current.taskId) {
      const taskIdx = db.tasks.findIndex(t => t.id === current.taskId);
      if (taskIdx >= 0 && db.tasks[taskIdx].status !== "done") {
        const task = db.tasks[taskIdx];
        db.tasks[taskIdx] = { ...task, status: "done", updatedAt: now, updatedBy: req.user.id };
        addAuditLog(db, auditActor(req), "task.status_updated", "task", current.taskId, {
          reason: "acs_visit_completed",
          visitId: visitId,
          before: { status: task.status },
          after: { status: "done" }
        });
      }
    }

    return { visit: next };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.visit);
});

export default router;
