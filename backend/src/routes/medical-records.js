import express from "express";
import { readDb, withDb, findUserByEmail } from "../db.js";
import { verifyPassword } from "../services/crypto.js";
import { addAuditLog } from "../services/audit.js";
import { logError } from "../utils/logger.js";

const router = express.Router();

const CHART_ROLES = new Set(["doctor", "dentist", "nurse_manager"]);

function canViewChart(user) {
  return CHART_ROLES.has(user?.role) || (Array.isArray(user?.capabilities) && user.capabilities.includes("records.read"));
}

async function appendChartAudit(actor, patientId, details = {}) {
  try {
    await withDb((db) => {
      addAuditLog(db, actor, details.action, "patient", String(patientId), details);
    });
  } catch (error) {
    logError("medical_records.access.audit_failed", {
      requestId: actor?.requestId || "",
      correlationId: actor?.requestMeta?.requestId || actor?.requestId || "",
      actorId: String(actor?.id || ""),
      patientId: String(patientId || ""),
      action: String(details?.action || ""),
      error
    });
  }
}

router.post("/medical-records/access/verify", async (req, res) => {
  try {
    const actor = req.user;
    const { patientId, password } = req.body || {};

    if (!patientId || !password) {
      return res.status(400).json({ error: "patientId e password são obrigatórios." });
    }

    if (!canViewChart(actor)) {
      await appendChartAudit(actor, patientId, {
        action: "chart.access_denied",
        outcome: "denied",
        reason: "role_not_authorized",
        actorRole: actor.role,
        patientId: String(patientId),
      });
      return res.status(403).json({ error: "Acesso negado. Perfil sem autorização para acessar prontuários." });
    }

    const db = await readDb();
    const patient = (db.patients || []).find((p) => p.id === patientId);
    if (!patient) {
      await appendChartAudit(actor, patientId, {
        action: "chart.access_denied",
        outcome: "denied",
        reason: "patient_not_found",
        patientId: String(patientId),
      });
      return res.status(404).json({ error: "Paciente não encontrado." });
    }

    const userRecord = await findUserByEmail(actor.email).catch(() => null)
      || (db.users || []).find((u) => u.id === actor.id);
    const storedPassword = userRecord?.password;
    if (!storedPassword) {
      return res.status(500).json({ error: "Não foi possível verificar identidade." });
    }

    const ok = verifyPassword(String(password || ""), storedPassword);

    if (!ok) {
      await appendChartAudit(actor, patientId, {
        action: "chart.access_denied",
        outcome: "denied",
        reason: "wrong_password",
        patientId: String(patientId),
        patientName: patient.name || "",
      });
      return res.status(422).json({ error: "Senha incorreta. Acesso negado." });
    }

    await appendChartAudit(actor, patientId, {
      action: "chart.access_authorized",
      outcome: "success",
      patientId: String(patientId),
      patientName: patient.name || "",
    });

    return res.json({ ok: true });
  } catch (err) {
    logError("medical_records.access.verify_failed", {
      requestId: req.requestId || "",
      correlationId: req.correlationId || req.requestId || "",
      actorId: String(req.user?.id || ""),
      patientId: String(req.body?.patientId || ""),
      error: err
    });
    return res.status(500).json({ error: "Não foi possível validar sua identidade agora." });
  }
});

export default router;
