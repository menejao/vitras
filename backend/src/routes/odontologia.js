// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability } from "../utils/helpers.js";
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
router.get("/odontologia/chart/:patientId", (req, res) => {
  const user = req.user;
  if (!canRead(user)) return res.status(403).json({ error: "Sem permissão" });

  const { patientId } = req.params;
  const db = readDb();
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
router.patch("/odontologia/chart/:patientId/tooth/:fdi", (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissão" });

  const { patientId, fdi } = req.params;
  if (!validateFdi(fdi)) return res.status(400).json({ error: "FDI inválido" });

  const { condition, faces, notes } = req.body;
  if (condition && !VALID_CONDITIONS.includes(condition)) {
    return res.status(400).json({ error: "Condição inválida" });
  }
  if (faces) {
    for (const [face, cond] of Object.entries(faces)) {
      if (!VALID_FACES.includes(face)) return res.status(400).json({ error: `Face inválida: ${face}` });
      if (cond && !VALID_CONDITIONS.includes(cond)) return res.status(400).json({ error: `Condição de face inválida: ${cond}` });
    }
  }

  const result = withDb(db => {
    ensureDbShape(db);
    const patient = (db.patients || []).find(p => p.id === patientId);
    if (!patient) return { error: "Paciente não encontrado", status: 404 };

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
router.post("/odontologia/procedures", (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissão" });

  const { patientId, toothFdi, face, type, date, notes, status } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatório" });
  if (!validateFdi(toothFdi)) return res.status(400).json({ error: "FDI inválido" });
  if (!type || !VALID_PROC_TYPES.includes(type)) return res.status(400).json({ error: "Tipo inválido" });
  if (face && !VALID_FACES.includes(face)) return res.status(400).json({ error: "Face inválida" });
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Status inválido" });

  const result = withDb(db => {
    ensureDbShape(db);
    const patient = (db.patients || []).find(p => p.id === patientId);
    if (!patient) return { error: "Paciente não encontrado", status: 404 };

    const now = new Date().toISOString();
    const proc = {
      id: uuidv4(),
      patientId,
      teamId: user.teamId || null,
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
router.patch("/odontologia/procedures/:id", (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissão" });

  const { status, notes, date } = req.body;
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Status inválido" });

  const result = withDb(db => {
    ensureDbShape(db);
    const proc = (db.odontoProcedures || []).find(p => p.id === req.params.id && !p.deletedAt);
    if (!proc) return { error: "Procedimento não encontrado", status: 404 };

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

// DELETE /odontologia/procedures/:id — logical delete
router.delete("/odontologia/procedures/:id", (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissão" });

  const result = withDb(db => {
    ensureDbShape(db);
    const proc = (db.odontoProcedures || []).find(p => p.id === req.params.id && !p.deletedAt);
    if (!proc) return { error: "Procedimento não encontrado", status: 404 };

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
router.get("/odontologia/encounters", (req, res) => {
  const user = req.user;
  if (!canRead(user)) return res.status(403).json({ error: "Sem permissão" });
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatório" });
  const db = readDb();
  ensureDbShape(db);
  const encounters = (db.dentalEncounters || [])
    .filter(e => e.patientId === patientId)
    .sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  res.json({ data: encounters });
});

// POST /odontologia/encounters
router.post("/odontologia/encounters", (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissão" });
  const { patientId, tipo, motivo } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatório" });
  if (tipo && !VALID_ENCOUNTER_TIPOS.includes(tipo)) return res.status(400).json({ error: "Tipo inválido" });

  const result = withDb(db => {
    ensureDbShape(db);
    const open = (db.dentalEncounters || []).find(
      e => e.patientId === patientId && ["aberto", "em_atendimento"].includes(e.status)
    );
    if (open) return { error: "Já existe atendimento em aberto", status: 409, existing: open };

    const now = new Date().toISOString();
    const encounter = {
      id: uuidv4(),
      patientId,
      professionalId: user.id,
      professionalName: user.name || user.username || "",
      teamId: user.teamId || null,
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
router.patch("/odontologia/encounters/:id", (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissão" });
  const { status, obs, motivo, endedAt } = req.body;
  if (status && !VALID_ENCOUNTER_STATUS.includes(status)) return res.status(400).json({ error: "Status inválido" });

  const result = withDb(db => {
    ensureDbShape(db);
    const encounter = (db.dentalEncounters || []).find(e => e.id === req.params.id);
    if (!encounter) return { error: "Atendimento não encontrado", status: 404 };
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
router.get("/odontologia/plan-items", (req, res) => {
  const user = req.user;
  if (!canRead(user)) return res.status(403).json({ error: "Sem permissão" });
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatório" });
  const db = readDb();
  ensureDbShape(db);
  const PRIO_ORD = { alta: 0, media: 1, baixa: 2 };
  const items = (db.odontoPlanItems || [])
    .filter(i => i.patientId === patientId && !i.deletedAt)
    .sort((a, b) => (PRIO_ORD[a.prioridade] ?? 1) - (PRIO_ORD[b.prioridade] ?? 1));
  res.json({ data: items });
});

// POST /odontologia/plan-items
router.post("/odontologia/plan-items", (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissão" });
  const { patientId, descricao, procedimento, dente, prioridade, previsao, encounterId } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId obrigatório" });
  if (!descricao) return res.status(400).json({ error: "descricao obrigatória" });
  if (prioridade && !VALID_PLAN_PRIO.includes(prioridade)) return res.status(400).json({ error: "Prioridade inválida" });

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
router.patch("/odontologia/plan-items/:id", (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissão" });
  const { status, prioridade, previsao } = req.body;
  if (status && !VALID_PLAN_STATUS.includes(status)) return res.status(400).json({ error: "Status inválido" });
  if (prioridade && !VALID_PLAN_PRIO.includes(prioridade)) return res.status(400).json({ error: "Prioridade inválida" });

  const result = withDb(db => {
    ensureDbShape(db);
    const item = (db.odontoPlanItems || []).find(i => i.id === req.params.id && !i.deletedAt);
    if (!item) return { error: "Item não encontrado", status: 404 };
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

// DELETE /odontologia/plan-items/:id — logical
router.delete("/odontologia/plan-items/:id", (req, res) => {
  const user = req.user;
  if (!canWrite(user)) return res.status(403).json({ error: "Sem permissão" });

  const result = withDb(db => {
    ensureDbShape(db);
    const item = (db.odontoPlanItems || []).find(i => i.id === req.params.id && !i.deletedAt);
    if (!item) return { error: "Item não encontrado", status: 404 };
    item.deletedAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    addAuditLog(db, user, "delete", "odontoPlanItem", item.id, {});
    return { data: { id: item.id } };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.json(result);
});

export default router;
