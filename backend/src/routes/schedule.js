/**
 * schedule.js — Rotas de configuração de agenda do VITRAS.
 *
 * Registrado ANTES de blockSupportAdminFromClinical (app.js) para que
 * support_admin possa configurar agendas via Console Nacional.
 * Configuração de agenda é administrativa, não dados clínicos de pacientes.
 *
 * LGPD: não armazena dados de pacientes nessas coleções.
 * RBAC: capabilities schedule.configuration.* validadas em cada rota.
 * Isolamento por UBS: professionalId só vale dentro da unitId do solicitante
 *   (exceto support_admin, que pode especificar qualquer unitId).
 */

import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { hasCapability } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";
import { ensureDbShape } from "../utils/domain.js";
import {
  validateScheduleConfig,
  detectConflictingAppointments,
  getAvailableSlots,
} from "../services/scheduleEngine.js";

const router = express.Router();

// ── Guards de acesso ─────────────────────────────────────────────────────────

function canReadSchedule(user) {
  return hasCapability(user, "schedule.configuration.read");
}

function canUpdateSchedule(user) {
  return hasCapability(user, "schedule.configuration.update");
}

function canManageBlocks(user) {
  return hasCapability(user, "schedule.block.manage") ||
         hasCapability(user, "schedule.configuration.update");
}

/**
 * Resolve a unitId que o usuário tem permissão de acessar.
 * support_admin pode especificar qualquer unitId via query/body.
 * Outros usuários ficam restritos ao próprio unitId.
 */
function resolveUnitId(user, requestedUnitId) {
  const isSupport = user?.role === "support_admin";
  if (isSupport && requestedUnitId) return String(requestedUnitId);
  return String(user?.unitId || "");
}

// ── Configurações de escala (professionalSchedules) ──────────────────────────

/**
 * GET /schedule/configurations
 * Lista todas as configurações de escala de uma UBS.
 */
router.get("/schedule/configurations", async (req, res) => {
  if (!canReadSchedule(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const unitId = resolveUnitId(req.user, req.query.unitId);
  if (!unitId) return res.status(400).json({ error: "unitId obrigatório" });

  const db = await readDb();
  ensureDbShape(db);

  const configs = (db.professionalSchedules || [])
    .filter(c => String(c.unitId || "") === unitId)
    .sort((a, b) => String(a.professionalName || "").localeCompare(String(b.professionalName || "")));

  return res.json({ data: configs, total: configs.length });
});

/**
 * GET /schedule/configurations/:id
 * Detalhe de uma configuração específica.
 */
router.get("/schedule/configurations/:id", async (req, res) => {
  if (!canReadSchedule(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureDbShape(db);
  const config = (db.professionalSchedules || []).find(c => c.id === req.params.id);
  if (!config) return res.status(404).json({ error: "Configuração não encontrada" });

  const unitId = resolveUnitId(req.user, null);
  if (req.user?.role !== "support_admin" && config.unitId !== unitId) {
    return res.status(403).json({ error: "Sem permissão para esta UBS" });
  }

  return res.json(config);
});

/**
 * POST /schedule/configurations
 * Cria ou atualiza (upsert) configuração de escala de um profissional.
 * Se já existe config para o mesmo professionalId+unitId, sobrescreve.
 */
router.post("/schedule/configurations", async (req, res) => {
  if (!canUpdateSchedule(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const body = req.body || {};
  const unitId = resolveUnitId(req.user, body.unitId);
  if (!unitId) return res.status(400).json({ error: "unitId obrigatório" });

  const professionalId = String(body.professionalId || "").trim();
  if (!professionalId) return res.status(400).json({ error: "professionalId obrigatório" });

  const payload = {
    ...body,
    unitId,
    professionalId,
  };

  const validation = validateScheduleConfig(payload);
  if (!validation.valid) {
    return res.status(400).json({ error: "Configuração inválida", details: validation.errors });
  }

  const result = await withDb(async db => {
    ensureDbShape(db);

    // Verificar que o profissional existe (na própria UBS)
    const professional = (db.users || []).find(u => u.id === professionalId);
    if (!professional) return { error: "Profissional não encontrado", status: 404 };

    const now = new Date().toISOString();
    const existing = (db.professionalSchedules || []).findIndex(
      c => c.unitId === unitId && c.professionalId === professionalId
    );

    let config;
    if (existing >= 0) {
      // Update
      config = {
        ...db.professionalSchedules[existing],
        status: String(body.status || "open"),
        slotDurationMinutes: Number(body.slotDurationMinutes || 30),
        weeklySchedule: body.weeklySchedule || db.professionalSchedules[existing].weeklySchedule,
        updatedAt: now,
        updatedBy: req.user.id,
      };
      db.professionalSchedules[existing] = config;

      addAuditLog(db, req.user, "SCHEDULE_CONFIGURATION_UPDATED", "professional_schedule", config.id, {
        unitId,
        professionalId,
        professionalName: professional.name || professional.username,
      });
    } else {
      // Create
      config = {
        id: uuidv4(),
        unitId,
        professionalId,
        professionalName: professional.name || professional.username || professionalId,
        status: String(body.status || "open"),
        slotDurationMinutes: Number(body.slotDurationMinutes || 30),
        weeklySchedule: body.weeklySchedule || [],
        effectiveFrom: body.effectiveFrom || now.slice(0, 10),
        createdAt: now,
        createdBy: req.user.id,
        updatedAt: now,
        updatedBy: req.user.id,
      };
      db.professionalSchedules.push(config);

      addAuditLog(db, req.user, "SCHEDULE_CONFIGURATION_CREATED", "professional_schedule", config.id, {
        unitId,
        professionalId,
        professionalName: config.professionalName,
      });
    }

    return { data: config };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  return res.status(201).json(result.data);
});

/**
 * PUT /schedule/configurations/:id
 * Atualiza configuração existente.
 */
router.put("/schedule/configurations/:id", async (req, res) => {
  if (!canUpdateSchedule(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const body = req.body || {};
  const unitId = resolveUnitId(req.user, body.unitId);

  const validation = validateScheduleConfig({ ...body, unitId, professionalId: body.professionalId || "x" });
  if (!validation.valid) {
    return res.status(400).json({ error: "Configuração inválida", details: validation.errors });
  }

  const result = await withDb(async db => {
    ensureDbShape(db);
    const idx = (db.professionalSchedules || []).findIndex(c => c.id === req.params.id);
    if (idx < 0) return { error: "Configuração não encontrada", status: 404 };

    const current = db.professionalSchedules[idx];
    if (req.user?.role !== "support_admin" && current.unitId !== unitId) {
      return { error: "Sem permissão para esta UBS", status: 403 };
    }

    const now = new Date().toISOString();
    const updated = {
      ...current,
      status:               String(body.status || current.status),
      slotDurationMinutes:  Number(body.slotDurationMinutes  || current.slotDurationMinutes),
      weeklySchedule:       body.weeklySchedule || current.weeklySchedule,
      updatedAt: now,
      updatedBy: req.user.id,
    };
    db.professionalSchedules[idx] = updated;

    addAuditLog(db, req.user, "SCHEDULE_CONFIGURATION_UPDATED", "professional_schedule", updated.id, {
      unitId: current.unitId,
      professionalId: current.professionalId,
    });

    return { data: updated };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  return res.json(result.data);
});

/**
 * POST /schedule/configurations/:id/status
 * Abre ou fecha agenda de um profissional.
 */
router.post("/schedule/configurations/:id/status", async (req, res) => {
  if (!canUpdateSchedule(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const { status, reason } = req.body || {};
  if (!["open", "closed"].includes(status)) {
    return res.status(400).json({ error: "Status deve ser 'open' ou 'closed'" });
  }

  const result = await withDb(async db => {
    ensureDbShape(db);
    const idx = (db.professionalSchedules || []).findIndex(c => c.id === req.params.id);
    if (idx < 0) return { error: "Configuração não encontrada", status: 404 };

    const unitId = resolveUnitId(req.user, null);
    const current = db.professionalSchedules[idx];
    if (req.user?.role !== "support_admin" && current.unitId !== unitId) {
      return { error: "Sem permissão para esta UBS", status: 403 };
    }

    const now = new Date().toISOString();
    db.professionalSchedules[idx] = { ...current, status, updatedAt: now, updatedBy: req.user.id };

    const auditAction = status === "open" ? "SCHEDULE_OPENED" : "SCHEDULE_CLOSED";
    addAuditLog(db, req.user, auditAction, "professional_schedule", current.id, {
      unitId: current.unitId,
      professionalId: current.professionalId,
      reason: reason || null,
    });

    return { data: db.professionalSchedules[idx] };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  return res.json(result.data);
});

// ── Bloqueios (scheduleBlocks) ────────────────────────────────────────────────

/**
 * GET /schedule/blocks
 * Lista bloqueios de uma UBS.
 */
router.get("/schedule/blocks", async (req, res) => {
  if (!canReadSchedule(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const unitId = resolveUnitId(req.user, req.query.unitId);
  if (!unitId) return res.status(400).json({ error: "unitId obrigatório" });

  const db = await readDb();
  ensureDbShape(db);

  let blocks = (db.scheduleBlocks || []).filter(b => String(b.unitId || "") === unitId);

  if (req.query.professionalId) {
    blocks = blocks.filter(b => !b.professionalId || b.professionalId === req.query.professionalId);
  }
  if (req.query.fromDate) {
    blocks = blocks.filter(b => b.endDate >= req.query.fromDate);
  }
  if (req.query.toDate) {
    blocks = blocks.filter(b => b.startDate <= req.query.toDate);
  }

  blocks = blocks.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return res.json({ data: blocks, total: blocks.length });
});

/**
 * POST /schedule/blocks
 * Cria um bloqueio de agenda.
 * Retorna lista de agendamentos conflitantes (sem cancelamento automático).
 */
router.post("/schedule/blocks", async (req, res) => {
  if (!canManageBlocks(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const body = req.body || {};
  const unitId = resolveUnitId(req.user, body.unitId);
  if (!unitId) return res.status(400).json({ error: "unitId obrigatório" });

  const VALID_TYPES = ["absence", "holiday", "meeting", "course", "vacation", "other"];
  const type = String(body.type || "other");
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido. Aceitos: ${VALID_TYPES.join(", ")}` });
  }
  if (!body.startDate || !body.endDate) {
    return res.status(400).json({ error: "startDate e endDate obrigatórios" });
  }
  if (body.startDate > body.endDate) {
    return res.status(400).json({ error: "startDate deve ser anterior ou igual a endDate" });
  }
  if (type === "other" && !body.reason) {
    return res.status(400).json({ error: "Para tipo 'other', reason é obrigatório" });
  }

  const result = await withDb(async db => {
    ensureDbShape(db);

    const now = new Date().toISOString();
    const block = {
      id: uuidv4(),
      unitId,
      professionalId: body.professionalId ? String(body.professionalId) : null,
      type,
      reason: String(body.reason || type),
      startDate: String(body.startDate),
      endDate: String(body.endDate),
      startTime: body.startTime ? String(body.startTime) : null,
      endTime: body.endTime ? String(body.endTime) : null,
      createdAt: now,
      createdBy: req.user.id,
    };

    db.scheduleBlocks.push(block);

    // Detectar conflitos com agendamentos existentes (não cancela automaticamente)
    const conflicts = detectConflictingAppointments(db, {
      professionalId: block.professionalId || null,
      unitId,
      startDate: block.startDate,
      endDate: block.endDate,
      startTime: block.startTime,
      endTime: block.endTime,
    });

    addAuditLog(db, req.user, "SCHEDULE_BLOCK_CREATED", "schedule_block", block.id, {
      unitId,
      professionalId: block.professionalId,
      type: block.type,
      startDate: block.startDate,
      endDate: block.endDate,
      conflictCount: conflicts.length,
    });

    return { data: block, conflicts };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  return res.status(201).json(result);
});

/**
 * PUT /schedule/blocks/:id
 * Atualiza um bloqueio existente.
 */
router.put("/schedule/blocks/:id", async (req, res) => {
  if (!canManageBlocks(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const body = req.body || {};

  const result = await withDb(async db => {
    ensureDbShape(db);
    const idx = (db.scheduleBlocks || []).findIndex(b => b.id === req.params.id);
    if (idx < 0) return { error: "Bloqueio não encontrado", status: 404 };

    const current = db.scheduleBlocks[idx];
    const unitId = resolveUnitId(req.user, null);
    if (req.user?.role !== "support_admin" && current.unitId !== unitId) {
      return { error: "Sem permissão para este bloqueio", status: 403 };
    }

    const updated = {
      ...current,
      type:      body.type       || current.type,
      reason:    body.reason     || current.reason,
      startDate: body.startDate  || current.startDate,
      endDate:   body.endDate    || current.endDate,
      startTime: body.startTime !== undefined ? (body.startTime || null) : current.startTime,
      endTime:   body.endTime   !== undefined ? (body.endTime   || null) : current.endTime,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id,
    };
    db.scheduleBlocks[idx] = updated;

    addAuditLog(db, req.user, "SCHEDULE_BLOCK_UPDATED", "schedule_block", updated.id, {
      unitId: current.unitId,
    });

    return { data: updated };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  return res.json(result.data);
});

/**
 * DELETE /schedule/blocks/:id
 * Remove um bloqueio.
 */
router.delete("/schedule/blocks/:id", async (req, res) => {
  if (!canManageBlocks(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const result = await withDb(async db => {
    ensureDbShape(db);
    const idx = (db.scheduleBlocks || []).findIndex(b => b.id === req.params.id);
    if (idx < 0) return { error: "Bloqueio não encontrado", status: 404 };

    const current = db.scheduleBlocks[idx];
    const unitId = resolveUnitId(req.user, null);
    if (req.user?.role !== "support_admin" && current.unitId !== unitId) {
      return { error: "Sem permissão para este bloqueio", status: 403 };
    }

    db.scheduleBlocks.splice(idx, 1);

    addAuditLog(db, req.user, "SCHEDULE_BLOCK_REMOVED", "schedule_block", current.id, {
      unitId: current.unitId,
      professionalId: current.professionalId,
      type: current.type,
      startDate: current.startDate,
      endDate: current.endDate,
    });

    return { ok: true };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  return res.json({ ok: true });
});

/**
 * GET /schedule/preview
 * Pré-visualiza disponibilidade de um período para uma configuração.
 * Não persiste nada. Usado pela UI para mostrar impacto antes de salvar.
 */
router.get("/schedule/preview", async (req, res) => {
  if (!canReadSchedule(req.user)) return res.status(403).json({ error: "Sem permissão" });

  const { professionalId, startDate, endDate } = req.query;
  const unitId = resolveUnitId(req.user, req.query.unitId);

  if (!professionalId || !startDate || !endDate) {
    return res.status(400).json({ error: "professionalId, startDate e endDate obrigatórios" });
  }
  if (startDate > endDate) {
    return res.status(400).json({ error: "startDate deve ser anterior ou igual a endDate" });
  }

  const db = await readDb();
  ensureDbShape(db);

  const days = [];
  let currentDate = startDate;
  let count = 0;
  while (currentDate <= endDate && count < 90) {
    const slots = getAvailableSlots(db, { date: currentDate, doctorId: professionalId, unitId });
    days.push({ date: currentDate, slots, count: slots.length });
    // Increment date
    const d = new Date(currentDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    currentDate = d.toISOString().slice(0, 10);
    count++;
  }

  const totalSlots = days.reduce((acc, d) => acc + d.count, 0);
  const activeDays = days.filter(d => d.count > 0).length;

  return res.json({ days, totalSlots, activeDays, professionalId, unitId, startDate, endDate });
});

export default router;
