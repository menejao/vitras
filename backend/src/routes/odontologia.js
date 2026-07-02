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

  const patient = (db.patients || []).find(p => p.id === patientId);
  if (!patient) return res.status(404).json({ error: "Paciente não encontrado" });

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

export default router;
