import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { requireAuth } from "../middlewares/auth.js";
import { hasCapability, canonicalRole, resolveActiveUnit } from "../utils/helpers.js";
import { ensureDbShape } from "../utils/domain.js";
import { verifyPassword } from "../services/crypto.js";
import { addAuditLog } from "../services/audit.js";
import { MUNICIPALITY_ID } from "../config.js";

const router = express.Router();

const BREAK_GLASS_TTL_MS = 30 * 60 * 1000; // 30 minutes

function validateSessionPassword(user, password) {
  if (!password || typeof password !== "string") return false;
  return verifyPassword(password, user.password);
}

// POST /break-glass/activate
// Requires: break_glass.activate capability + password reauth + patientId
router.post("/break-glass/activate", requireAuth, async (req, res) => {
  if (!hasCapability(req.user, "break_glass.activate")) {
    return res.status(403).json({ error: "Perfil não autorizado a ativar Break Glass" });
  }

  const patientId = String(req.body?.patientId || "").trim();
  const password = String(req.body?.password || "");

  if (!patientId) return res.status(400).json({ error: "patientId obrigatório" });
  if (!password) return res.status(400).json({ error: "Senha obrigatória para ativar Break Glass" });

  const result = await withDb((db) => {
    ensureDbShape(db);

    const patient = (db.patients || []).find((p) => p.id === patientId);
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };

    const userRecord = (db.users || []).find((u) => u.id === req.user.id);
    if (!userRecord) return { error: { status: 403, message: "Usuário não encontrado" } };

    if (!validateSessionPassword(userRecord, password)) {
      addAuditLog(db, req.user, "break_glass.activate_failed", "break_glass_session", patientId, {
        reason: "wrong_password",
        patientId,
        unitId: resolveActiveUnit(req),
        municipalityId: String(req.user.municipalityId || MUNICIPALITY_ID || "")
      });
      return { error: { status: 401, message: "Senha incorreta — Break Glass não ativado" } };
    }

    // Deactivate any existing active session for this user
    const now = new Date().toISOString();
    (db.breakGlassSessions || []).forEach((s) => {
      if (s.activatedBy === req.user.id && !s.deactivatedAt) {
        s.deactivatedAt = now;
        s.deactivatedReason = "superseded_by_new_activation";
      }
    });

    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + BREAK_GLASS_TTL_MS).toISOString();

    const session = {
      id: sessionId,
      activatedBy: req.user.id,
      activatedByRole: canonicalRole(req.user.role),
      patientId,
      unitId: resolveActiveUnit(req),
      municipalityId: String(req.user.municipalityId || MUNICIPALITY_ID || ""),
      activatedAt: now,
      expiresAt,
      deactivatedAt: null,
      deactivatedReason: null
    };

    db.breakGlassSessions.push(session);

    addAuditLog(db, req.user, "break_glass.activated", "break_glass_session", sessionId, {
      patientId,
      unitId: session.unitId,
      municipalityId: session.municipalityId,
      expiresAt,
      outcome: "success"
    });

    return { sessionId, expiresAt, patientId };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result);
});

// POST /break-glass/deactivate
router.post("/break-glass/deactivate", requireAuth, async (req, res) => {
  const sessionId = String(req.headers["x-break-glass-session"] || req.body?.sessionId || "").trim();

  await withDb((db) => {
    ensureDbShape(db);
    const now = new Date().toISOString();
    const sessions = db.breakGlassSessions || [];

    const deactivated = [];
    sessions.forEach((s) => {
      if (s.activatedBy !== req.user.id || s.deactivatedAt) return;
      if (sessionId && s.id !== sessionId) return;
      s.deactivatedAt = now;
      s.deactivatedReason = "manual_deactivation";
      deactivated.push(s.id);
    });

    if (deactivated.length) {
      addAuditLog(db, req.user, "break_glass.deactivated", "break_glass_session", deactivated[0], {
        sessionIds: deactivated,
        reason: "manual_deactivation",
        outcome: "success"
      });
    }
  });

  return res.json({ ok: true });
});

// GET /break-glass/status
router.get("/break-glass/status", requireAuth, async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const now = Date.now();

  const active = (db.breakGlassSessions || []).find((s) =>
    s.activatedBy === req.user.id
    && !s.deactivatedAt
    && Date.parse(String(s.expiresAt || "")) > now
  );

  if (!active) return res.json({ active: false });

  return res.json({
    active: true,
    sessionId: active.id,
    patientId: active.patientId,
    expiresAt: active.expiresAt,
    activatedAt: active.activatedAt
  });
});

export default router;
