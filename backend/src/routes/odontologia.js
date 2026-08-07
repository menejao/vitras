// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability, resolveActiveUnit } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

function canRead(user) {
  return hasCapability(user, "dental.read") || hasCapability(user, "dental.write") || hasCapability(user, "dental.admin");
}
function canWrite(user) {
  return hasCapability(user, "dental.write") || hasCapability(user, "dental.admin");
}

const VALID_FDI = new Set([
  "11","12","13","14","15","16","17","18",
  "21","22","23","24","25","26","27","28",
  "31","32","33","34","35","36","37","38",
  "41","42","43","44","45","46","47","48",
  "51","52","53","54","55",
  "61","62","63","64","65",
  "71","72","73","74","75",
  "81","82","83","84","85",
]);

const VALID_CONDITIONS = [
  "higido","carie","restauracao","fratura","ausente",
  "extraido","implante","coroa","canal","protese","selante","lesao",
];

const VALID_FACES = ["vestibular","lingual","mesial","distal","oclusal"];

const VALID_PROC_TYPES = [
  "restauracao","exodontia","profilaxia","fluor","endodontia",
  "raspagem","protese","cimentacao","implante","selante","outro",
];

const VALID_STATUSES = ["planejado","em_andamento","concluido","cancelado"];

function validateFdi(fdi) {
  return VALID_FDI.has(String(fdi));
}

// GET /odontologia/chart/:patientId
router.get("/odontologia/chart/:patientId", async (req, res) => {
  const user = req.user;
  if (!canRead(user)) return res.status(403).json({ error: "Sem permissÃ£o" });

  const { patientId } = req.params;
  const db = await readDb();
  ensureDbShape(db);

  const odontogram = (db.odontograms || []).find(o => o.patientId === patientId) || {
    patientId,
    teeth: {},
  };

  const procedures = (db.odontoProcedures || [])
    .filter(p => p.patientId === patientId && !p.deletedAt)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  res.json({ data: { odontogram, procedures } });
});

// PATCH /odontologia/chart/:patientId/tooth/:fdi
router.patch("/odontologia/chart/:patientId/tooth/:fdi", async (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissÃ£o" });

  const { patientId, fdi } = req.params;
  if (!validateFdi(fdi)) return res.status(400).json({ error: "FDI invÃ¡lido" });

  const { condition, faces, notes } = req.body;
  if (condition && !VALID_CONDITIONS.includes(condition)) {
    return res.status(400).json({ error: "CondiÃ§Ã£o invÃ¡lida" });
  }
  if (faces) {
    for (const [face, cond] of Object.entries(faces)) {
      if (!VALID_FACES.includes(face)) return res.status(400).json({ error: `Face invÃ¡lida: ${face}` });
      if (cond && !VALID_CONDITIONS.includes(cond)) return res.status(400).json({ error: `CondiÃ§Ã£o de face invÃ¡lida: ${cond}` });
    }
  }

  const result = withDb(db => {
    ensureDbShape(db);
    const patient = (db.patients || []).find(p => p.id === patientId);
    if (!patient) return { error: "Paciente nÃ£o encontrado", status: 404 };

    let chart = db.odontograms.find(o => o.patientId === patientId);
    if (!chart) {
      chart = {
        id: uuidv4(),
        patientId,
        teamId: user.teamId || null,
        teeth: {},
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        updatedAt: new Date().toISOString(),
      };
      db.odontograms.push(chart);
    }

    if (!chart.teeth[fdi]) chart.teeth[fdi] = { faces: {} };
    const tooth = chart.teeth[fdi];

    if (condition !== undefined) tooth.condition = condition;
    if (faces) tooth.faces = { ...(tooth.faces || {}), ...faces };
    if (notes !== undefined) tooth.notes = notes;
    tooth.updatedAt = new Date().toISOString();
    tooth.updatedBy = user.id;
    chart.updatedAt = new Date().toISOString();

    addAuditLog(db, user, "update", "odontogram", `${patientId}:${fdi}`, {
      fdi, condition, faces,
    });

    return { data: { fdi, tooth } };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.json(result);
});

// POST /odontologia/procedures
router.post("/odontologia/procedures", async (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissÃ£o" });

  const { patientId, toothFdi, face, type, date, notes, status } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatÃ³rio" });
  if (!validateFdi(toothFdi)) return res.status(400).json({ error: "FDI invÃ¡lido" });
  if (!type || !VALID_PROC_TYPES.includes(type)) return res.status(400).json({ error: "Tipo invÃ¡lido" });
  if (face && !VALID_FACES.includes(face)) return res.status(400).json({ error: "Face invÃ¡lida" });
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Status invÃ¡lido" });

  const result = withDb(db => {
    ensureDbShape(db);
    const patient = (db.patients || []).find(p => p.id === patientId);
    if (!patient) return { error: "Paciente nÃ£o encontrado", status: 404 };

    const now = new Date().toISOString();
    const proc = {
      id: uuidv4(),
      patientId,
      teamId: user.teamId || null,
      executingUnitId: resolveActiveUnit(req),
      executingTeamId: String(user.teamId || ""),
      executingProfessionalId: String(user.id || ""),
      referenceUnitIdAtEvent: String(patient.referenceUnitId || patient.unitId || ""),
      referenceTeamIdAtEvent: String(patient.teamId || ""),
      municipalityId: String(patient.municipalityId || ""),
      toothFdi: String(toothFdi),
      face: face || null,
      type,
      status: status || "planejado",
      date: date || now.slice(0, 10),
      notes: notes || null,
      professionalId: user.id,
      professionalName: user.name || user.username || "",
      createdAt: now,
      createdBy: user.id,
      updatedAt: now,
      deletedAt: null,
    };

    db.odontoProcedures.push(proc);
    addAuditLog(db, user, "create", "odontoProcedure", proc.id, {
      patientId, toothFdi, type, status: proc.status,
    });

    return { data: proc };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.status(201).json(result);
});

// PATCH /odontologia/procedures/:id
router.patch("/odontologia/procedures/:id", async (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissÃ£o" });

  const { status, notes, date } = req.body;
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Status invÃ¡lido" });

  const result = withDb(db => {
    ensureDbShape(db);
    const proc = (db.odontoProcedures || []).find(p => p.id === req.params.id && !p.deletedAt);
    if (!proc) return { error: "Procedimento nÃ£o encontrado", status: 404 };

    if (status !== undefined) proc.status = status;
    if (notes !== undefined) proc.notes = notes;
    if (date !== undefined) proc.date = date;
    proc.updatedAt = new Date().toISOString();

    addAuditLog(db, user, "update", "odontoProcedure", proc.id, { status, notes });
    return { data: proc };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.json(result);
});

// DELETE /odontologia/procedures/:id â€” logical delete
router.delete("/odontologia/procedures/:id", async (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissÃ£o" });

  const result = withDb(db => {
    ensureDbShape(db);
    const proc = (db.odontoProcedures || []).find(p => p.id === req.params.id && !p.deletedAt);
    if (!proc) return { error: "Procedimento nÃ£o encontrado", status: 404 };

    proc.deletedAt = new Date().toISOString();
    proc.deletedBy = user.id;
    proc.updatedAt = new Date().toISOString();

    addAuditLog(db, user, "delete", "odontoProcedure", proc.id, {});
    return { data: { id: proc.id } };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.json(result);
});

const VALID_ENCOUNTER_STATUS = ["aberto", "em_atendimento", "encerrado", "cancelado"];
const VALID_ENCOUNTER_TIPOS = ["programado", "demanda_espontanea", "urgencia", "retorno", "encaixe", "avulso"];
const VALID_PLAN_STATUS = ["pendente", "em_andamento", "concluido", "cancelado"];
const VALID_PLAN_PRIO = ["alta", "media", "baixa"];

// GET /odontologia/encounters?patientId=X
router.get("/odontologia/encounters", async (req, res) => {
  const user = req.user;
  if (!canRead(user)) return res.status(403).json({ error: "Sem permissÃ£o" });
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatÃ³rio" });
  const db = await readDb();
  ensureDbShape(db);
  const encounters = (db.dentalEncounters || [])
    .filter(e => e.patientId === patientId)
    .sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  res.json({ data: encounters });
});

// POST /odontologia/encounters
router.post("/odontologia/encounters", async (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissÃ£o" });
  const { patientId, tipo, motivo } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatÃ³rio" });
  if (tipo && !VALID_ENCOUNTER_TIPOS.includes(tipo)) return res.status(400).json({ error: "Tipo invÃ¡lido" });

  const result = withDb(db => {
    ensureDbShape(db);
    const open = (db.dentalEncounters || []).find(
      e => e.patientId === patientId && ["aberto", "em_atendimento"].includes(e.status)
    );
    if (open) return { error: "JÃ¡ existe atendimento em aberto", status: 409, existing: open };

    const encPatient = (db.patients || []).find(p => p.id === patientId);

    const now = new Date().toISOString();
    const encounter = {
      id: uuidv4(),
      patientId,
      professionalId: user.id,
      professionalName: user.name || user.username || "",
      teamId: user.teamId || null,
      executingUnitId: resolveActiveUnit(req),
      executingTeamId: String(user.teamId || ""),
      executingProfessionalId: String(user.id || ""),
      referenceUnitIdAtEvent: String(encPatient?.referenceUnitId || encPatient?.unitId || ""),
      referenceTeamIdAtEvent: String(encPatient?.teamId || ""),
      municipalityId: String(encPatient?.municipalityId || ""),
      date: now.slice(0, 10),
      startedAt: now,
      endedAt: null,
      status: "em_atendimento",
      tipo: tipo || "demanda_espontanea",
      motivo: motivo || "",
      obs: "",
      createdAt: now,
      updatedAt: now,
    };
    db.dentalEncounters.push(encounter);
    addAuditLog(db, user, "create", "dentalEncounter", encounter.id, { patientId, tipo: encounter.tipo });
    return { data: encounter };
  });

  if (result.error && result.status === 409) {
    return res.status(409).json({ error: result.error, data: { existing: result.existing } });
  }
  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.status(201).json(result);
});

// PATCH /odontologia/encounters/:id
router.patch("/odontologia/encounters/:id", async (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissÃ£o" });
  const { status, obs, motivo, endedAt } = req.body;
  if (status && !VALID_ENCOUNTER_STATUS.includes(status)) return res.status(400).json({ error: "Status invÃ¡lido" });

  const result = withDb(db => {
    ensureDbShape(db);
    const encounter = (db.dentalEncounters || []).find(e => e.id === req.params.id);
    if (!encounter) return { error: "Atendimento nÃ£o encontrado", status: 404 };
    if (status !== undefined) encounter.status = status;
    if (obs !== undefined) encounter.obs = obs;
    if (motivo !== undefined) encounter.motivo = motivo;
    if (endedAt !== undefined) encounter.endedAt = endedAt;
    encounter.updatedAt = new Date().toISOString();
    addAuditLog(db, user, "update", "dentalEncounter", encounter.id, { status });
    return { data: encounter };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.json(result);
});

// GET /odontologia/plan-items?patientId=X
router.get("/odontologia/plan-items", async (req, res) => {
  const user = req.user;
  if (!canRead(user)) return res.status(403).json({ error: "Sem permissÃ£o" });
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatÃ³rio" });
  const db = await readDb();
  ensureDbShape(db);
  const PRIO_ORD = { alta: 0, media: 1, baixa: 2 };
  const items = (db.odontoPlanItems || [])
    .filter(i => i.patientId === patientId && !i.deletedAt)
    .sort((a, b) => (PRIO_ORD[a.prioridade] ?? 1) - (PRIO_ORD[b.prioridade] ?? 1));
  res.json({ data: items });
});

// POST /odontologia/plan-items
router.post("/odontologia/plan-items", async (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissÃ£o" });
  const { patientId, descricao, procedimento, dente, prioridade, previsao, encounterId } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatÃ³rio" });
  if (!descricao) return res.status(400).json({ error: "descricao obrigatÃ³ria" });
  if (prioridade && !VALID_PLAN_PRIO.includes(prioridade)) return res.status(400).json({ error: "Prioridade invÃ¡lida" });

  const result = withDb(db => {
    ensureDbShape(db);
    const now = new Date().toISOString();
    const item = {
      id: uuidv4(),
      patientId,
      encounterId: encounterId || null,
      descricao,
      procedimento: procedimento || null,
      dente: dente || null,
      prioridade: prioridade || "media",
      status: "pendente",
      previsao: previsao || null,
      responsavel: user.name || user.username || "",
      concluidoEm: null,
      createdAt: now,
      createdBy: user.id,
      updatedAt: now,
      deletedAt: null,
    };
    db.odontoPlanItems.push(item);
    addAuditLog(db, user, "create", "odontoPlanItem", item.id, { patientId, descricao });
    return { data: item };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.status(201).json(result);
});

// PATCH /odontologia/plan-items/:id
router.patch("/odontologia/plan-items/:id", async (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissÃ£o" });
  const { status, prioridade, previsao } = req.body;
  if (status && !VALID_PLAN_STATUS.includes(status)) return res.status(400).json({ error: "Status invÃ¡lido" });
  if (prioridade && !VALID_PLAN_PRIO.includes(prioridade)) return res.status(400).json({ error: "Prioridade invÃ¡lida" });

  const result = withDb(db => {
    ensureDbShape(db);
    const item = (db.odontoPlanItems || []).find(i => i.id === req.params.id && !i.deletedAt);
    if (!item) return { error: "Item nÃ£o encontrado", status: 404 };
    if (status !== undefined) {
      item.status = status;
      if (status === "concluido") item.concluidoEm = new Date().toISOString();
    }
    if (prioridade !== undefined) item.prioridade = prioridade;
    if (previsao !== undefined) item.previsao = previsao;
    item.updatedAt = new Date().toISOString();
    addAuditLog(db, user, "update", "odontoPlanItem", item.id, { status });
    return { data: item };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.json(result);
});

// DELETE /odontologia/plan-items/:id â€” logical
router.delete("/odontologia/plan-items/:id", async (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissÃ£o" });

  const result = withDb(db => {
    ensureDbShape(db);
    const item = (db.odontoPlanItems || []).find(i => i.id === req.params.id && !i.deletedAt);
    if (!item) return { error: "Item nÃ£o encontrado", status: 404 };
    item.deletedAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    addAuditLog(db, user, "delete", "odontoPlanItem", item.id, {});
    return { data: { id: item.id } };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.json(result);
});

// GET /odontologia/queue-hoje?date=YYYY-MM-DD
// Single source of truth: only reads queueEntries filtered by specialty=odontologia.
// Agenda is not a queue â€” patients appear here only after "Dar entrada" creates a Queue record.
router.get("/odontologia/queue-hoje", async (req, res) => {
  const user = req.user;
  if (!canRead(user)) return res.status(403).json({ error: "Sem permissÃ£o" });

  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const db = await readDb();
  ensureDbShape(db);
  const teamId = String(user.teamId || "");

  const DEMAND_LABEL = {
    scheduled: "Agendado", spontaneous: "EspontÃ¢neo",
  };

  const STATUS_ORDER = {
    em_atendimento: 0, liberado: 1, aguardando_triagem: 2,
    atendido: 3, faltou: 4, cancelado: 5,
  };

  const queueItems = (db.queueEntries || []).filter(e => {
    const entryDate = String(e.arrivedAt || "").slice(0, 10);
    const specialtyKey = String(e.specialtyKey || e.specialty || "").toLowerCase();
    const dest = String(e.destination || "").toLowerCase();
    const isOdonto =
      specialtyKey === "odontologia" ||
      specialtyKey.includes("odonto") ||
      dest.includes("odontolog") ||
      dest.includes("odonto");
    return (
      entryDate === date &&
      String(e.teamId || "") === teamId &&
      isOdonto &&
      e.status !== "removed" && e.status !== "cleared"
    );
  });

  const result = queueItems.map(entry => {
    const patient = (db.patients || []).find(p => p.id === entry.patientId);
    const age = patient?.birthDate
      ? Math.floor((Date.now() - new Date(patient.birthDate + "T12:00:00").getTime()) / (365.25 * 86400000))
      : null;
    return {
      id: entry.id,
      patientId: entry.patientId,
      patientName: entry.patientName || patient?.name || "",
      patientAge: age,
      horario: entry.arrivedAt ? String(entry.arrivedAt).slice(11, 16) : null,
      demandType: DEMAND_LABEL[entry.demandType] || entry.demandType || "",
      specialty: entry.specialty || entry.specialtyKey || "odontologia",
      specialtyKey: entry.specialtyKey || entry.specialty || "odontologia",
      status: entry.status,
      priority: entry.priority || null,
      needsTriage: entry.needsTriage !== false,
      arrivedAt: entry.arrivedAt || null,
      professionalId: entry.professionalId || null,
      professionalName: entry.professionalName || null,
      notes: entry.reason || null,
    };
  });

  result.sort((a, b) => {
    const ao = STATUS_ORDER[a.status] ?? 10;
    const bo = STATUS_ORDER[b.status] ?? 10;
    if (ao !== bo) return ao - bo;
    return (a.horario || "").localeCompare(b.horario || "");
  });

  res.json({ data: result });
});

// POST /odontologia/prescricoes
router.post("/odontologia/prescricoes", async (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissÃ£o" });

  const { patientId, itens, dtReceita, validade, obs, encounterId, cro } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatÃ³rio" });
  if (!itens || !itens.length) return res.status(400).json({ error: "Itens obrigatÃ³rios" });

  const result = await withDb(async db => {
    ensureDbShape(db);
    if (!db.prescricoes) db.prescricoes = [];
    const patient = (db.patients || []).find(p => p.id === patientId);
    if (!patient) return { error: "Paciente nÃ£o encontrado", status: 404 };

    const now = new Date().toISOString();
    const receita = {
      id: uuidv4(),
      patientId,
      prescriberId: user.id,
      prescritorNome: user.name || user.username || "",
      cro: cro || user.cro || null,
      teamId: user.teamId || null,
      executingUnitId: resolveActiveUnit(req),
      executingTeamId: String(user.teamId || ""),
      executingProfessionalId: String(user.id || ""),
      referenceUnitIdAtEvent: String(patient.referenceUnitId || patient.unitId || ""),
      referenceTeamIdAtEvent: String(patient.teamId || ""),
      municipalityId: String(patient.municipalityId || ""),
      dtReceita: dtReceita || now.slice(0, 10),
      validade: validade || "",
      itens: (itens || []).map(it => ({ ...it, dispensado: 0 })),
      obs: obs || null,
      status: "ativa",
      origem: "odontologia",
      encounterId: encounterId || null,
      criadaEm: now,
      criadaPor: user.id,
    };
    db.prescricoes.push(receita);
    addAuditLog(db, user, "create", "receita_odonto", receita.id, { patientId });
    return { data: receita };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.status(201).json(result);
});

// GET /odontologia/prescricoes?patientId=X
router.get("/odontologia/prescricoes", async (req, res) => {
  const user = req.user;
  if (!canRead(user)) return res.status(403).json({ error: "Sem permissÃ£o" });
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatÃ³rio" });
  const db = await readDb();
  ensureDbShape(db);
  const list = (db.prescricoes || [])
    .filter(r => r.patientId === patientId && r.origem === "odontologia")
    .sort((a, b) => (b.criadaEm || "").localeCompare(a.criadaEm || ""));
  res.json({ data: list });
});

export default router;


