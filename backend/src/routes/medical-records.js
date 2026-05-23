import express from "express";
import { readDb, withDb, findUserByEmail } from "../db.js";
import { verifyPassword } from "../services/crypto.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

const CHART_ROLES = new Set(["doctor", "dentist", "nurse_manager"]);

function canViewChart(user) {
  return CHART_ROLES.has(user?.role) || (Array.isArray(user?.capabilities) && user.capabilities.includes("records.read"));
}

router.post("/medical-records/access/verify", async (req, res) => {
  const actor = req.user;
  const { patientId, password } = req.body || {};

  if (!patientId || !password) {
    return res.status(400).json({ error: "patientId e password são obrigatórios." });
  }

  if (!canViewChart(actor)) {
    await withDb((db) => {
      addAuditLog(db, actor, "chart.access_denied", "patient", String(patientId), {
        outcome: "denied",
        reason: "role_not_authorized",
        actorRole: actor.role,
        patientId: String(patientId),
      });
    });
    return res.status(403).json({ error: "Acesso negado. Perfil sem autorização para acessar prontuários." });
  }

  const db = await readDb();
  const patient = (db.patients || []).find((p) => p.id === patientId);
  if (!patient) {
    await withDb((mutableDb) => {
      addAuditLog(mutableDb, actor, "chart.access_denied", "patient", String(patientId), {
        outcome: "denied",
        reason: "patient_not_found",
        patientId: String(patientId),
      });
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
    await withDb((mutableDb) => {
      addAuditLog(mutableDb, actor, "chart.access_denied", "patient", String(patientId), {
        outcome: "denied",
        reason: "wrong_password",
        patientId: String(patientId),
        patientName: patient.name || "",
      });
    });
    return res.status(401).json({ error: "Senha incorreta. Acesso negado." });
  }

  await withDb((mutableDb) => {
    addAuditLog(mutableDb, actor, "chart.access_authorized", "patient", String(patientId), {
      outcome: "success",
      patientId: String(patientId),
      patientName: patient.name || "",
    });
  });

  return res.json({ ok: true });
});

export default router;
