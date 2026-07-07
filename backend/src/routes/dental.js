// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { validate, DentalStockCreateSchema, DentalAdjustSchema, DentalDispenseSchema } from "../schemas.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

const DENTAL_CATALOG = [
  { key: "luva-latex-m", name: "Luva de Látex Tamanho M", category: "EPI", unit: "par", qty: 500, minQty: 100 },
  { key: "mascara-cirurgica", name: "Máscara Cirúrgica", category: "EPI", unit: "unidade", qty: 1000, minQty: 200 },
  { key: "gorro-descartavel", name: "Gorro Descartável", category: "EPI", unit: "unidade", qty: 500, minQty: 100 },
  { key: "babador-descartavel", name: "Babador Descartável", category: "Descartável", unit: "unidade", qty: 500, minQty: 100 },
  { key: "seringa-carpule", name: "Seringa Carpule", category: "Anestesia", unit: "unidade", qty: 200, minQty: 50 },
  { key: "agulha-curta", name: "Agulha Curta Descartável", category: "Anestesia", unit: "unidade", qty: 200, minQty: 50 },
  { key: "anestesico-lidocaina", name: "Lidocaína 2% c/ Vasoconstritor", category: "Anestesia", unit: "tubete", qty: 100, minQty: 20 },
  { key: "broca-alta-rotacao", name: "Broca Alta Rotação Carbide", category: "Instrumental", unit: "unidade", qty: 30, minQty: 5 },
  { key: "resina-composta", name: "Resina Composta A2", category: "Restauração", unit: "seringa", qty: 10, minQty: 3 },
  { key: "acido-fosfórico", name: "Ácido Fosfórico 37%", category: "Restauração", unit: "bisnaga", qty: 10, minQty: 2 },
  { key: "ionômero-vidro", name: "Cimento de Ionômero de Vidro", category: "Restauração", unit: "kit", qty: 5, minQty: 1 },
  { key: "algodao-rolo", name: "Algodão em Rolo", category: "Descartável", unit: "pacote", qty: 20, minQty: 5 },
  { key: "fio-dental", name: "Fio Dental", category: "Higiene", unit: "rolo", qty: 30, minQty: 10 },
];

function canReadDental(user) {
  return hasCapability(user, "dental.read") || hasCapability(user, "dental.write");
}
function canWriteDental(user) {
  return hasCapability(user, "dental.write");
}

function ensureTeamDentalStock(db, teamId, actorId = "") {
  const scoped = (db.dentalStock || []).filter(s => String(s.teamId || "") === String(teamId || ""));
  if (scoped.length) return;
  const now = new Date().toISOString();
  for (const item of DENTAL_CATALOG) {
    db.dentalStock.push({
      id: uuidv4(),
      key: item.key,
      name: item.name,
      category: item.category,
      unit: item.unit,
      qty: item.qty,
      minQty: item.minQty,
      teamId,
      notes: null,
      createdAt: now,
      createdBy: actorId,
      updatedAt: now,
    });
  }
}

// GET /dental/stock
router.get("/dental/stock", async (req, res) => {
  const user = req.user;
  if (!canReadDental(user)) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureDbShape(db);

  const teamId = user.teamId || "";
  ensureTeamDentalStock(db, teamId, user.id);

  let items = (db.dentalStock || []).filter(s => String(s.teamId || "") === String(teamId));
  res.json({ data: items });
});

// POST /dental/stock
router.post("/dental/stock", validate(DentalStockCreateSchema), (req, res) => {
  const user = req.user;
  if (!canWriteDental(user)) return res.status(403).json({ error: "Sem permissão" });

  const body = req.body;
  const result = withDb(db => {
    ensureDbShape(db);
    const now = new Date().toISOString();
    const item = {
      id: uuidv4(),
      key: null,
      name: body.name,
      category: body.category,
      unit: body.unit,
      qty: body.qty ?? 0,
      minQty: body.minQty ?? 0,
      teamId: user.teamId || null,
      notes: body.notes || null,
      createdAt: now,
      createdBy: user.id,
      updatedAt: now,
    };
    db.dentalStock.push(item);
    addAuditLog(db, user, "create", "dentalStock", item.id, { name: item.name });
    return { data: item };
  });

  res.status(201).json(result);
});

// POST /dental/stock/:id/adjust
router.post("/dental/stock/:id/adjust", validate(DentalAdjustSchema), (req, res) => {
  const user = req.user;
  if (!canWriteDental(user)) return res.status(403).json({ error: "Sem permissão" });

  const result = withDb(db => {
    ensureDbShape(db);
    const idx = db.dentalStock.findIndex(s => s.id === req.params.id);
    if (idx === -1) return { error: "Item não encontrado", status: 404 };

    const item = db.dentalStock[idx];
    const prevQty = item.qty;
    item.qty = Math.max(0, item.qty + req.body.delta);
    item.updatedAt = new Date().toISOString();

    const logEntry = {
      id: uuidv4(),
      type: req.body.operationType || "ajuste",
      itemId: item.id,
      teamId: item.teamId,
      delta: req.body.delta,
      prevQty,
      newQty: item.qty,
      reason: req.body.reason,
      lote: req.body.lote || null,
      validade: req.body.validade || null,
      obs: req.body.obs || null,
      actorId: user.id,
      actorName: user.name || user.username,
      at: new Date().toISOString(),
    };
    db.dentalLogs.push(logEntry);
    addAuditLog(db, user, "adjust", "dentalStock", item.id, { delta: req.body.delta, prevQty, newQty: item.qty });
    return { data: item };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.json(result);
});

// POST /dental/dispense — multi-item, no patient required
router.post("/dental/dispense", validate(DentalDispenseSchema), (req, res) => {
  const user = req.user;
  if (!canWriteDental(user)) return res.status(403).json({ error: "Sem permissão" });

  const result = withDb(db => {
    ensureDbShape(db);
    const teamId = user.teamId || "";

    for (const it of req.body.items) {
      const stock = db.dentalStock.find(s => s.id === it.id && String(s.teamId || "") === String(teamId));
      if (!stock) return { error: `Item não encontrado: ${it.id}`, status: 404 };
      if (stock.qty < it.qty) return { error: `Estoque insuficiente: ${stock.name}`, status: 400 };
    }

    const dispensed = [];
    for (const it of req.body.items) {
      const idx = db.dentalStock.findIndex(s => s.id === it.id);
      const stock = db.dentalStock[idx];
      const prevQty = stock.qty;
      stock.qty -= it.qty;
      stock.updatedAt = new Date().toISOString();

      const logEntry = {
        id: uuidv4(),
        type: "dispense",
        itemId: stock.id,
        teamId: stock.teamId,
        delta: -it.qty,
        prevQty,
        newQty: stock.qty,
        actorId: user.id,
        actorName: user.name || user.username,
        obs: req.body.obs || null,
        at: new Date().toISOString(),
      };
      db.dentalLogs.push(logEntry);
      dispensed.push({ id: stock.id, nome: stock.name, qty: it.qty });
    }

    addAuditLog(db, user, "dispense", "dentalStock", teamId, { itens: dispensed });
    return { data: { dispensed } };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.status(201).json(result);
});

// GET /dental/logs
router.get("/dental/logs", async (req, res) => {
  const user = req.user;
  if (!canReadDental(user)) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureDbShape(db);

  const teamId = user.teamId || "";
  const logs = [...(db.dentalLogs || [])]
    .filter(l => String(l.teamId || "") === String(teamId))
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
    .slice(0, 200);

  res.json({ data: logs });
});

export default router;
