import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { validate, AgendaCreateSchema, AgendaPatchSchema } from "../schemas.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability, normalizeDemandType } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

const VALID_SPECIALTY_KEYS = ["medico_familia", "enfermagem", "odontologia", "pediatria", "psicologia", "fisioterapia", "nutricao", "vacinacao", "curativo"];

function resolveSpecialtyKey(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "";
  if (VALID_SPECIALTY_KEYS.includes(s)) return s;
  if (["odonto", "dental", "dentist"].some(k => s.includes(k))) return "odontologia";
  if (["enferma", "nurse", "nursing"].some(k => s.includes(k))) return "enfermagem";
  if (["médico", "medico", "familia", "família", "geral", "clínica", "clinica", "doctor", "ginecol"].some(k => s.includes(k))) return "medico_familia";
  if (["pediatr", "criança", "child"].some(k => s.includes(k))) return "pediatria";
  if (["psicol", "mental"].some(k => s.includes(k))) return "psicologia";
  if (["fisio", "physio"].some(k => s.includes(k))) return "fisioterapia";
  if (["nutri"].some(k => s.includes(k))) return "nutricao";
  if (["vacin", "vaccin", "imuniz"].some(k => s.includes(k))) return "vacinacao";
  if (["curativ", "wound", "dressing"].some(k => s.includes(k))) return "curativo";
  return s;
}

function canReadAgenda(user) {
  return hasCapability(user, "agenda.read") || hasCapability(user, "agenda.write");
}

function canWriteAgenda(user) {
  return hasCapability(user, "agenda.write");
}

function canAccessTeam(user, teamId) {
  const currentTeamId = String(user?.teamId || "").trim();
  if (!currentTeamId) return false; // fail-safe: no teamId = no access
  return currentTeamId === String(teamId || "").trim();
}

function normalizeAgendaStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["scheduled", "arrived", "attending", "done", "absent"].includes(raw)) return raw;
  return "scheduled";
}

function normalizeAgendaType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["consultation", "return", "procedure", "other"].includes(raw)) return raw;
  return "consultation";
}

function buildAgendaSnapshot(entry) {
  if (!entry) return null;
  return {
    id: String(entry.id || ""),
    patientId: String(entry.patientId || ""),
    patientName: String(entry.patientName || ""),
    teamId: String(entry.teamId || ""),
    doctorId: String(entry.doctorId || ""),
    doctorName: String(entry.doctorName || ""),
    date: String(entry.date || ""),
    time: String(entry.time || ""),
    type: String(entry.type || "consultation"),
    specialty: String(entry.specialty || ""),
    status: String(entry.status || "scheduled"),
    notes: String(entry.notes || ""),
    updatedAt: String(entry.updatedAt || entry.createdAt || "")
  };
}

function buildAgendaSummary(type, notes) {
  const labelMap = {
    consultation: "Consulta agendada",
    return: "Retorno agendado",
    procedure: "Procedimento agendado",
    other: "Agendamento registrado"
  };
  const base = labelMap[normalizeAgendaType(type)] || labelMap.consultation;
  const suffix = String(notes || "").trim();
  return suffix ? `${base}: ${suffix}` : base;
}

function buildAgendaView(entry, patient, doctor) {
  const patientName = String(entry.patientName || patient?.name || "");
  const doctorName = String(entry.doctorName || doctor?.name || "");
  const incompletePatient = patient ? Boolean(patient.incompleteProfile) : Boolean(entry.incompletePatient);
  return {
    ...entry,
    patientName,
    doctorName,
    incompletePatient
  };
}

function listScopedAgendaEntries(db, user, filters = {}) {
  ensureDbShape(db);
  const patientMap = new Map(db.patients.map((patient) => [patient.id, patient]));
  const doctorMap = new Map(db.users.map((doctor) => [doctor.id, doctor]));
  const from = String(filters.from || "").trim();
  const to = String(filters.to || "").trim();
  const doctorId = String(filters.doctorId || "").trim();
  const patientId = String(filters.patientId || "").trim();
  const status = String(filters.status || "").trim();

  return db.agendaEntries
    .filter((entry) => {
      if (!canReadAgenda(user)) return false;
      if (!canAccessTeam(user, entry.teamId)) return false;
      if (String(entry.status || "") === "cancelled") return false;
      if (from && String(entry.date || "") < from) return false;
      if (to && String(entry.date || "") > to) return false;
      if (doctorId && String(entry.doctorId || "") !== doctorId) return false;
      if (patientId && String(entry.patientId || "") !== patientId) return false;
      if (status && String(entry.status || "") !== status) return false;
      return true;
    })
    .map((entry) => buildAgendaView(entry, patientMap.get(entry.patientId), doctorMap.get(entry.doctorId)))
    .sort((left, right) => {
      const dateCmp = String(left.date || "").localeCompare(String(right.date || ""));
      if (dateCmp !== 0) return dateCmp;
      const timeCmp = String(left.time || "").localeCompare(String(right.time || ""));
      if (timeCmp !== 0) return timeCmp;
      return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
    });
}

router.get("/agenda", async (req, res) => {
  if (!canReadAgenda(req.user)) {
    return res.status(403).json({ error: "Sem permissão para agenda" });
  }
  const db = await readDb();
  const items = listScopedAgendaEntries(db, req.user, req.query || {});
  return res.json(items);
});

router.post("/agenda", validate(AgendaCreateSchema), async (req, res) => {
  if (!canWriteAgenda(req.user)) {
    return res.status(403).json({ error: "Sem permissão para agenda" });
  }

  const payload = req.body || {};
  const result = await withDb((db) => {
    ensureDbShape(db);
    const patient = db.patients.find((item) => item.id === String(payload.patientId || ""));
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };
    if (!canAccessTeam(req.user, patient.teamId)) {
      return { error: { status: 403, message: "Paciente fora da equipe atual" } };
    }

    const doctorId = String(payload.doctorId || "").trim();
    const doctor = doctorId ? db.users.find((item) => item.id === doctorId) : null;
    if (doctorId && !doctor) {
      return { error: { status: 404, message: "Profissional não encontrado" } };
    }

    const apptDate = String(payload.date || "").trim();
    const apptTime = String(payload.time || "").trim();

    if (doctorId && apptDate && apptTime) {
      const doctorConflict = db.agendaEntries.find(
        (item) =>
          item.doctorId === doctorId &&
          String(item.date || "") === apptDate &&
          String(item.time || "") === apptTime &&
          item.status !== "cancelled"
      );
      if (doctorConflict) {
        return { error: { status: 409, message: "Profissional já tem agendamento neste horário" } };
      }
    }

    const now = new Date().toISOString();
    const entry = {
      id: uuidv4(),
      patientId: patient.id,
      patientName: patient.name,
      teamId: patient.teamId,
      doctorId,
      doctorName: doctor?.name || "",
      date: String(payload.date || "").trim(),
      time: String(payload.time || "").trim(),
      type: normalizeAgendaType(payload.type),
      specialty: String(payload.specialty || "").trim(),
      notes: String(payload.notes || "").trim(),
      status: normalizeAgendaStatus(payload.status),
      incompletePatient: Boolean(patient.incompleteProfile),
      summary: buildAgendaSummary(payload.type, payload.notes),
      createdAt: now,
      createdBy: req.user.id,
      updatedAt: now,
      updatedBy: req.user.id,
      executingTeamId: String(req.user.teamId || ""),
      executingUnitId: String(req.user.unitId || "")
    };

    db.agendaEntries.push(entry);
    addAuditLog(db, req.user, "agenda.entry_created", "agenda_entry", entry.id, {
      patientId: patient.id,
      teamId: patient.teamId,
      after: buildAgendaSnapshot(entry)
    });
    return { entry: buildAgendaView(entry, patient, doctor) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.entry);
});

router.patch("/agenda/:id", validate(AgendaPatchSchema), async (req, res) => {
  if (!canWriteAgenda(req.user)) {
    return res.status(403).json({ error: "Sem permissão para agenda" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.agendaEntries.findIndex((item) => item.id === String(req.params.id || ""));
    if (index < 0) return { error: { status: 404, message: "Agendamento não encontrado" } };

    const current = db.agendaEntries[index];
    if (!canAccessTeam(req.user, current.teamId)) {
      return { error: { status: 403, message: "Sem permissão para este agendamento" } };
    }

    const doctorId = req.body.doctorId !== undefined ? String(req.body.doctorId || "").trim() : String(current.doctorId || "");
    const doctor = doctorId ? db.users.find((item) => item.id === doctorId) : null;
    if (doctorId && !doctor) {
      return { error: { status: 404, message: "Profissional não encontrado" } };
    }

    const patient = db.patients.find((item) => item.id === current.patientId) || null;
    const next = {
      ...current,
      ...(req.body.date !== undefined ? { date: String(req.body.date || "").trim() } : {}),
      ...(req.body.time !== undefined ? { time: String(req.body.time || "").trim() } : {}),
      ...(req.body.type !== undefined ? { type: normalizeAgendaType(req.body.type) } : {}),
      ...(req.body.notes !== undefined ? { notes: String(req.body.notes || "").trim() } : {}),
      ...(req.body.status !== undefined ? { status: normalizeAgendaStatus(req.body.status) } : {}),
      ...(req.body.doctorId !== undefined ? { doctorId } : {}),
      ...(req.body.doctorId !== undefined ? { doctorName: doctor?.name || "" } : {}),
      ...(req.body.specialty !== undefined ? { specialty: String(req.body.specialty || "").trim() } : {}),
      incompletePatient: patient ? Boolean(patient.incompleteProfile) : Boolean(current.incompletePatient),
      summary: buildAgendaSummary(req.body.type !== undefined ? req.body.type : current.type, req.body.notes !== undefined ? req.body.notes : current.notes),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };

    db.agendaEntries[index] = next;
    addAuditLog(db, req.user, "agenda.entry_updated", "agenda_entry", next.id, {
      patientId: next.patientId,
      teamId: next.teamId,
      changedFields: Object.keys(req.body || {}),
      before: buildAgendaSnapshot(current),
      after: buildAgendaSnapshot(next)
    });
    return { entry: buildAgendaView(next, patient, doctor) };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.entry);
});

router.delete("/agenda/:id", async (req, res) => {
  if (!canWriteAgenda(req.user)) {
    return res.status(403).json({ error: "Sem permissão para agenda" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.agendaEntries.findIndex((item) => item.id === String(req.params.id || ""));
    if (index < 0) return { error: { status: 404, message: "Agendamento não encontrado" } };

    const removed = db.agendaEntries[index];
    if (!canAccessTeam(req.user, removed.teamId)) {
      return { error: { status: 403, message: "Sem permissão para este agendamento" } };
    }

    const now = new Date().toISOString();
    const cancellationReason = String(req.body?.reason || req.headers["x-justification"] || "").trim();
    db.agendaEntries[index] = {
      ...removed,
      status: "cancelled",
      cancelledAt: now,
      cancelledById: req.user.id,
      cancellationReason
    };
    addAuditLog(db, req.user, "agenda.cancelled", "agenda_entry", removed.id, {
      patientId: removed.patientId,
      teamId: removed.teamId,
      cancellationReason,
      before: buildAgendaSnapshot(removed),
      after: buildAgendaSnapshot(db.agendaEntries[index])
    });
    return { ok: true };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({ ok: true });
});

router.post("/agenda/:id/dar-entrada", async (req, res) => {
  if (!hasCapability(req.user, "queue.write")) {
    return res.status(403).json({ error: "Sem permissão para dar entrada na fila" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const agendaIndex = db.agendaEntries.findIndex((item) => item.id === String(req.params.id || ""));
    if (agendaIndex < 0) return { error: { status: 404, message: "Agendamento não encontrado" } };

    const appt = db.agendaEntries[agendaIndex];
    if (!canAccessTeam(req.user, appt.teamId)) {
      return { error: { status: 403, message: "Sem permissão para este agendamento" } };
    }
    if (appt.status !== "scheduled") {
      return { error: { status: 409, message: "Agendamento já foi processado" } };
    }

    const patient = db.patients.find((item) => item.id === appt.patientId);
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };

    const ACTIVE_Q = ["waiting", "triage", "ready", "attending", "aguardando_triagem", "liberado", "chamado", "em_atendimento"];
    const duplicate = db.queueEntries.find((item) =>
      item.patientId === patient.id && ACTIVE_Q.includes(String(item.status || ""))
    );
    if (duplicate) {
      return { error: { status: 409, message: "Paciente já está na fila ativa" } };
    }

    const priority = String(req.body?.priority || "normal");
    // Resolve specialty from priority chain: appt fields → body fields → destination fallback
    const rawSpecialty =
      appt.specialtyKey ||
      req.body?.specialtyKey ||
      appt.specialty ||
      req.body?.specialty ||
      appt.destination ||
      req.body?.destination ||
      "";
    const specialtyKey = resolveSpecialtyKey(rawSpecialty);
    if (!specialtyKey) {
      return { error: { status: 400, message: "Especialidade obrigatória para dar entrada na fila." } };
    }
    const needsTriage = req.body?.needsTriage !== false;
    const now = new Date().toISOString();

    const queueEntry = {
      id: uuidv4(),
      patientId: patient.id,
      patientName: patient.name,
      teamId: patient.teamId,
      priority,
      reason: String(req.body?.reason || "").trim(),
      demandType: normalizeDemandType("scheduled"),
      destination: null,
      specialty: specialtyKey,
      specialtyKey,
      agendaRef: appt.id,
      needsTriage,
      status: needsTriage ? "aguardando_triagem" : "liberado",
      professionalId: String(appt.doctorId || "").trim() || null,
      professionalName: String(appt.doctorName || "").trim() || null,
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
    db.queueEntries.push(queueEntry);

    db.agendaEntries[agendaIndex] = {
      ...appt,
      status: "arrived",
      updatedAt: now,
      updatedBy: req.user.id
    };

    addAuditLog(db, req.user, "agenda.dar_entrada", "agenda_entry", appt.id, {
      patientId: patient.id,
      teamId: patient.teamId,
      queueEntryId: queueEntry.id,
      specialty: specialtyKey
    });

    return { entry: queueEntry, appt: db.agendaEntries[agendaIndex] };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result);
});

export default router;
