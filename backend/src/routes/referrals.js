import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { validate, ReferralCreateSchema, ReferralPatchSchema } from "../schemas.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability, canAccessTeamScope, resolveActiveUnit } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

function canReadReferrals(user) {
  return hasCapability(user, "referrals.read") || hasCapability(user, "referrals.write");
}

function canWriteReferrals(user) {
  return hasCapability(user, "referrals.write");
}


// REGULACAO-REFERENCIA-01: aceita 11 status + legados (backward-compat)
const VALID_REFERRAL_STATUSES = [
  "pending", "sent_to_regulation", "under_analysis", "returned_for_complement",
  "regulated", "waiting_slot", "scheduled", "attended", "counter_referral_received",
  "closed", "done", "cancelled",
];

function normalizeReferralStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (VALID_REFERRAL_STATUSES.includes(raw)) return raw;
  return "pending";
}

function normalizeReferralPriority(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["urgent", "priority", "routine"].includes(raw)) return raw;
  return "routine";
}

function buildReferralSnapshot(entry) {
  if (!entry) return null;
  return {
    id: String(entry.id || ""),
    patientId: String(entry.patientId || ""),
    patientName: String(entry.patientName || ""),
    teamId: String(entry.teamId || ""),
    specialty: String(entry.specialty || ""),
    priority: String(entry.priority || ""),
    status: String(entry.status || ""),
    date: String(entry.date || ""),
    reason: String(entry.reason || ""),
    notes: String(entry.notes || ""),
    doctorId: String(entry.doctorId || ""),
    doctorName: String(entry.doctorName || ""),
    updatedAt: String(entry.updatedAt || entry.createdAt || "")
  };
}

function listScopedReferrals(db, user) {
  ensureDbShape(db);
  return db.referrals
    .filter((entry) => canReadReferrals(user) && canAccessTeamScope(user, entry.teamId) && String(entry.status || "") !== "cancelled")
    .sort((left, right) => {
      const dateCmp = String(right.date || "").localeCompare(String(left.date || ""));
      if (dateCmp !== 0) return dateCmp;
      return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
    });
}

router.get("/referrals", async (req, res) => {
  if (!canReadReferrals(req.user)) {
    return res.status(403).json({ error: "Sem permissão para encaminhamentos" });
  }
  const db = await readDb();
  return res.json(listScopedReferrals(db, req.user));
});

router.post("/referrals", validate(ReferralCreateSchema), async (req, res) => {
  if (!canWriteReferrals(req.user)) {
    return res.status(403).json({ error: "Sem permissão para encaminhamentos" });
  }

  const payload = req.body || {};
  const result = await withDb((db) => {
    ensureDbShape(db);
    const patient = db.patients.find((item) => item.id === String(payload.patientId || ""));
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };
    if (!canAccessTeamScope(req.user, patient.teamId)) {
      return { error: { status: 403, message: "Paciente fora da equipe atual" } };
    }

    const doctor = db.users.find((item) => item.id === String(req.user.id || "")) || null;
    const now = new Date().toISOString();
    const userName = String(req.user?.name || req.user?.email || req.user?.id || "").trim();
    const entry = {
      id: uuidv4(),
      patientId: patient.id,
      patientName: patient.name,
      teamId: patient.teamId,
      specialty: String(payload.specialty || "").trim(),
      reason: String(payload.reason || "").trim(),
      priority: normalizeReferralPriority(payload.priority),
      date: String(payload.date || "").trim(),
      notes: String(payload.notes || "").trim(),
      status: normalizeReferralStatus(payload.status),
      contrarreferencia: "",
      executingUnitId: resolveActiveUnit(req),
      executingTeamId: String(req.user.teamId || ""),
      executingProfessionalId: String(req.user.id || ""),
      referenceUnitIdAtEvent: String(patient.referenceUnitId || patient.unitId || ""),
      referenceTeamIdAtEvent: String(patient.teamId || ""),
      municipalityId: String(patient.municipalityId || ""),
      doctorId: String(req.user.id || ""),
      doctorName: String(doctor?.name || req.user?.name || "").trim(),
      createdAt: now,
      createdBy: req.user.id,
      updatedAt: now,
      updatedBy: req.user.id,
      // REGULACAO-REFERENCIA-01: histórico de movimentações embutido no documento
      events: [
        { ts: now, userId: req.user.id, userName, type: "created", description: "Encaminhamento criado" }
      ]
    };

    db.referrals.push(entry);
    addAuditLog(db, req.user, "referral.created", "referral", entry.id, {
      patientId: patient.id,
      teamId: patient.teamId,
      after: buildReferralSnapshot(entry)
    });
    return { entry };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.entry);
});

router.patch("/referrals/:id", validate(ReferralPatchSchema), async (req, res) => {
  if (!canWriteReferrals(req.user)) {
    return res.status(403).json({ error: "Sem permissão para encaminhamentos" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.referrals.findIndex((item) => item.id === String(req.params.id || ""));
    if (index < 0) return { error: { status: 404, message: "Encaminhamento não encontrado" } };

    const current = db.referrals[index];
    if (!canAccessTeamScope(req.user, current.teamId)) {
      return { error: { status: 403, message: "Sem permissão para este encaminhamento" } };
    }

    const now = new Date().toISOString();
    const userName = String(req.user?.name || req.user?.email || req.user?.id || "").trim();
    const currentEvents = Array.isArray(current.events) ? current.events : [];
    const newEvents = [...currentEvents];

    // REGULACAO-REFERENCIA-01: registrar evento de mudança de status
    const newStatus = req.body.status !== undefined ? normalizeReferralStatus(req.body.status) : current.status;
    if (req.body.status !== undefined && newStatus !== current.status) {
      newEvents.push({
        ts: now,
        userId: req.user.id,
        userName,
        type: "status_change",
        fromStatus: current.status,
        toStatus: newStatus,
        note: String(req.body.eventNote || "").trim()
      });
    }

    // REGULACAO-REFERENCIA-01: registrar evento quando contrarreferência é adicionada pela primeira vez
    const newContrarreferencia = req.body.contrarreferencia !== undefined
      ? String(req.body.contrarreferencia || "").trim()
      : (current.contrarreferencia || "");
    const hadContrarreferencia = Boolean(current.contrarreferencia && current.contrarreferencia.trim());
    if (!hadContrarreferencia && newContrarreferencia) {
      newEvents.push({
        ts: now,
        userId: req.user.id,
        userName,
        type: "counter_referral_received",
        note: "Contrarreferência registrada"
      });
    }

    // eventNote sem mudança de status: registrar nota avulsa se fornecida
    if (req.body.eventNote && req.body.status === undefined) {
      newEvents.push({
        ts: now,
        userId: req.user.id,
        userName,
        type: "note",
        note: String(req.body.eventNote || "").trim()
      });
    }

    const next = {
      ...current,
      ...(req.body.specialty !== undefined ? { specialty: String(req.body.specialty || "").trim() } : {}),
      ...(req.body.reason !== undefined ? { reason: String(req.body.reason || "").trim() } : {}),
      ...(req.body.priority !== undefined ? { priority: normalizeReferralPriority(req.body.priority) } : {}),
      ...(req.body.date !== undefined ? { date: String(req.body.date || "").trim() } : {}),
      ...(req.body.notes !== undefined ? { notes: String(req.body.notes || "").trim() } : {}),
      status: newStatus,
      contrarreferencia: newContrarreferencia,
      events: newEvents,
      updatedAt: now,
      updatedBy: req.user.id
    };

    db.referrals[index] = next;
    addAuditLog(db, req.user, "referral.updated", "referral", next.id, {
      patientId: next.patientId,
      teamId: next.teamId,
      changedFields: Object.keys(req.body || {}),
      before: buildReferralSnapshot(current),
      after: buildReferralSnapshot(next)
    });
    return { entry: next };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.entry);
});

router.delete("/referrals/:id", async (req, res) => {
  if (!canWriteReferrals(req.user)) {
    return res.status(403).json({ error: "Sem permissão para encaminhamentos" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.referrals.findIndex((item) => item.id === String(req.params.id || ""));
    if (index < 0) return { error: { status: 404, message: "Encaminhamento não encontrado" } };

    const removed = db.referrals[index];
    if (!canAccessTeamScope(req.user, removed.teamId)) {
      return { error: { status: 403, message: "Sem permissão para este encaminhamento" } };
    }

    const now = new Date().toISOString();
    const cancellationReason = String(req.body?.reason || req.headers["x-justification"] || "").trim();
    db.referrals[index] = {
      ...removed,
      status: "cancelled",
      cancelledAt: now,
      cancelledById: req.user.id,
      cancellationReason
    };
    addAuditLog(db, req.user, "referral.cancelled", "referral", removed.id, {
      patientId: removed.patientId,
      teamId: removed.teamId,
      cancellationReason,
      before: buildReferralSnapshot(removed),
      after: buildReferralSnapshot(db.referrals[index])
    });
    return { ok: true };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({ ok: true });
});

export default router;
