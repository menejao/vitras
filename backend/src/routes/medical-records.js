import express from "express";
import { readDb, withDb, findUserByEmail } from "../db.js";
import { verifyPassword } from "../services/crypto.js";
import { addAuditLog } from "../services/audit.js";
import { logError, logInfo } from "../utils/logger.js";

const router = express.Router();

const CHART_ROLES = new Set(["doctor", "dentist", "nurse_manager"]);

function canViewChart(user) {
  return CHART_ROLES.has(user?.role)
    || (Array.isArray(user?.capabilities) && user.capabilities.includes("records.read"));
}

function auditAsync(fn) {
  withDb(fn).catch(() => {});
}

function findPatientForAccess(patients, patientId, hint = null) {
  const id = String(patientId || "").trim();
  const hintId = String(hint?.id || "").trim();
  const cpf = String(hint?.cpf || "").trim().replace(/\D/g, "");
  const name = String(hint?.name || "").trim().toLowerCase();

  for (const p of patients) {
    const pid = String(p.id || "").trim();
    if (id && pid === id) return p;
    if (hintId && pid === hintId) return p;
  }

  if (cpf) {
    for (const p of patients) {
      const pcpf = String(p.cpf || p.cnsCpf || "").replace(/\D/g, "");
      if (pcpf && pcpf === cpf) return p;
    }
  }

  if (name) {
    for (const p of patients) {
      if (String(p.name || "").trim().toLowerCase() === name) return p;
    }
  }

  return null;
}

router.post("/medical-records/access/verify", async (req, res) => {
  try {
    const actor = req.user;
    const { patientId, password, patientHint } = req.body || {};

    if (!patientId || !password) {
      return res.status(400).json({ error: "Paciente inválido ou não selecionado." });
    }

    if (!canViewChart(actor)) {
      auditAsync((db) => {
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
    const patient = findPatientForAccess(db.patients || [], patientId, patientHint);

    logInfo("chart.access.verify.lookup", {
      actorId: String(actor.id || ""),
      actorRole: String(actor.role || ""),
      receivedPatientId: String(patientId || ""),
      hintName: String(patientHint?.name || ""),
      hintCpf: String(patientHint?.cpf || "").replace(/\d/g, "*"),
      patientFound: Boolean(patient),
      resolvedId: String(patient?.id || ""),
      totalPatients: (db.patients || []).length,
    });

    if (!patient) {
      auditAsync((mutableDb) => {
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
      auditAsync((mutableDb) => {
        addAuditLog(mutableDb, actor, "chart.access_denied", "patient", patient.id, {
          outcome: "denied",
          reason: "wrong_password",
          patientId: String(patient.id || ""),
          patientName: String(patient.name || ""),
        });
      });
      return res.status(422).json({ error: "Senha incorreta." });
    }

    auditAsync((mutableDb) => {
      addAuditLog(mutableDb, actor, "chart.access_authorized", "patient", patient.id, {
        outcome: "success",
        patientId: String(patient.id || ""),
        patientName: String(patient.name || ""),
      });
    });

    return res.json({ ok: true, patientId: String(patient.id || "") });
  } catch (err) {
    logError("chart.access.verify.error", {
      actorId: String(req.user?.id || ""),
      patientId: String(req.body?.patientId || ""),
      error: err,
    });
    return res.status(500).json({ error: "Não foi possível validar sua identidade agora." });
  }
});

export default router;
