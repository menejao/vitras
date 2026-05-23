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

function normalizePatientLookupCandidates(rawPatientId, rawPatient = null) {
  const values = [
    rawPatientId,
    rawPatient?.id,
    rawPatient?.patientId,
    rawPatient?.externalId,
    rawPatient?.legacyId,
    rawPatient?.cnsCpf,
    rawPatient?.cpf,
    rawPatient?.cns,
  ];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function findPatientForChartAccess(patients = [], rawPatientId, rawPatient = null) {
  const candidates = normalizePatientLookupCandidates(rawPatientId, rawPatient);
  const patient = patients.find((entry) => {
    const keys = new Set([
      entry?.id,
      entry?.patientId,
      entry?.externalId,
      entry?.legacyId,
      entry?.cnsCpf,
      entry?.cpf,
      entry?.cns,
    ].map((value) => String(value || "").trim()).filter(Boolean));
    return candidates.some((candidate) => keys.has(candidate));
  }) || null;
  return { patient, candidates };
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
      error,
    });
  }
}

router.post("/medical-records/access/verify", async (req, res) => {
  try {
    const actor = req.user;
    const { patientId, password, patient } = req.body || {};
    const lookupCandidates = normalizePatientLookupCandidates(patientId, patient);

    if (!lookupCandidates.length || !password) {
      return res.status(400).json({ error: "Paciente inválido ou não selecionado." });
    }

    if (!canViewChart(actor)) {
      await appendChartAudit(actor, lookupCandidates[0], {
        action: "chart.access_denied",
        outcome: "denied",
        reason: "role_not_authorized",
        actorRole: actor.role,
        patientId: String(lookupCandidates[0] || ""),
      });
      return res.status(403).json({ error: "Acesso negado. Perfil sem autorização para acessar prontuários." });
    }

    const db = await readDb();
    const lookup = findPatientForChartAccess(db.patients || [], patientId, patient);

    logInfo("medical_records.access.verify.lookup", {
      requestId: req.requestId || "",
      correlationId: req.correlationId || req.requestId || "",
      actorId: String(actor?.id || ""),
      actorRole: String(actor?.role || ""),
      receivedPatientId: String(patientId || ""),
      lookupCandidates,
      patientFound: Boolean(lookup.patient),
      patientResolvedId: String(lookup.patient?.id || ""),
      patientResolvedName: String(lookup.patient?.name || ""),
    });

    if (!lookup.patient) {
      await appendChartAudit(actor, lookupCandidates[0], {
        action: "chart.access_denied",
        outcome: "denied",
        reason: "patient_not_found",
        patientId: String(lookupCandidates[0] || ""),
      });
      return res.status(404).json({ error: "Paciente não encontrado." });
    }

    const userRecord = await findUserByEmail(actor.email).catch(() => null)
      || (db.users || []).find((entry) => entry.id === actor.id);
    const storedPassword = userRecord?.password;

    if (!storedPassword) {
      return res.status(500).json({ error: "Não foi possível verificar identidade." });
    }

    const ok = verifyPassword(String(password || ""), storedPassword);

    if (!ok) {
      await appendChartAudit(actor, lookup.patient.id, {
        action: "chart.access_denied",
        outcome: "denied",
        reason: "wrong_password",
        patientId: String(lookup.patient.id || ""),
        patientName: String(lookup.patient.name || ""),
      });
      return res.status(422).json({ error: "Senha incorreta." });
    }

    await appendChartAudit(actor, lookup.patient.id, {
      action: "chart.access_authorized",
      outcome: "success",
      patientId: String(lookup.patient.id || ""),
      patientName: String(lookup.patient.name || ""),
    });

    return res.json({
      ok: true,
      patientId: String(lookup.patient.id || ""),
    });
  } catch (err) {
    logError("medical_records.access.verify_failed", {
      requestId: req.requestId || "",
      correlationId: req.correlationId || req.requestId || "",
      actorId: String(req.user?.id || ""),
      patientId: String(req.body?.patientId || ""),
      error: err,
    });
    return res.status(500).json({ error: "Não foi possível validar sua identidade agora." });
  }
});

export default router;
