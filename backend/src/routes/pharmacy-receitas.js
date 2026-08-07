// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { validate, ReceitaCreateSchema, DispensacaoCreateSchema } from "../schemas.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability, resolveActiveUnit } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

function canReadReceitas(user) {
  return hasCapability(user, "receitas.read") || hasCapability(user, "receitas.write");
}
function canWriteReceitas(user) {
  return hasCapability(user, "receitas.write");
}
function canReadDispensacoes(user) {
  return hasCapability(user, "dispensacoes.read") || hasCapability(user, "dispensacoes.write");
}
function canWriteDispensacoes(user) {
  return hasCapability(user, "dispensacoes.write");
}

// GET /pharmacy/receitas?patientId=&status=
router.get("/pharmacy/receitas", async (req, res) => {
  const user = req.user;
  if (!canReadReceitas(user)) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureDbShape(db);

  let items = db.prescricoes || [];
  if (req.query.patientId) {
    items = items.filter(r => r.patientId === req.query.patientId);
  }
  if (req.query.status) {
    const statuses = req.query.status.split(",").map(s => s.trim());
    items = items.filter(r => statuses.includes(r.status));
  } else {
    // Default: exclude cancelled and fully dispensed
    items = items.filter(r => r.status !== "cancelada" && r.status !== "dispensada");
  }
  // Sort newest first
  items = [...items].sort((a, b) => (b.criadaEm || "").localeCompare(a.criadaEm || ""));

  res.json({ data: items });
});

// GET /pharmacy/receitas/:id
router.get("/pharmacy/receitas/:id", async (req, res) => {
  const user = req.user;
  if (!canReadReceitas(user)) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureDbShape(db);

  const receita = (db.prescricoes || []).find(r => r.id === req.params.id);
  if (!receita) return res.status(404).json({ error: "Receita não encontrada" });

  res.json({ data: receita });
});

// POST /pharmacy/receitas
router.post("/pharmacy/receitas", validate(ReceitaCreateSchema), async (req, res) => {
  const user = req.user;
  if (!canWriteReceitas(user)) return res.status(403).json({ error: "Sem permissão" });

  const body = req.body;
  const result = await withDb(async db => {
    ensureDbShape(db);

    const patient = (db.patients || []).find(p => p.id === body.patientId);
    if (!patient) return { error: "Paciente não encontrado", status: 404 };

    const receita = {
      id: uuidv4(),
      patientId: body.patientId,
      patientName: body.patientName || patient.name || null,
      prescriberId: body.prescriberId,
      prescritorNome: user.name || user.username,
      prescritorRegistro: body.prescritorRegistro || null,
      teamId: user.teamId || null,
      executingUnitId: resolveActiveUnit(req),
      executingTeamId: String(user.teamId || ""),
      executingProfessionalId: String(user.id || ""),
      referenceUnitIdAtEvent: String(patient.referenceUnitId || patient.unitId || ""),
      referenceTeamIdAtEvent: String(patient.teamId || ""),
      municipalityId: String(patient.municipalityId || ""),
      dtReceita: body.dtReceita,
      validade: body.validade,
      validUntil: body.validUntil || null,
      itens: body.itens.map(it => ({ ...it, dispensado: 0 })),
      obs: body.obs || null,
      origem: body.origem || "medicina",
      status: "ativa",
      criadaEm: new Date().toISOString(),
      criadaPor: user.id,
    };

    db.prescricoes.push(receita);
    addAuditLog(db, user, "create", "receita", receita.id, { patientId: body.patientId });
    return { data: receita };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.status(201).json(result);
});

// POST /pharmacy/dispensacoes — patient-first dispensation against a receita
router.post("/pharmacy/dispensacoes", validate(DispensacaoCreateSchema), async (req, res) => {
  const user = req.user;
  if (!canWriteDispensacoes(user)) return res.status(403).json({ error: "Sem permissão" });

  const body = req.body;
  const result = await withDb(async db => {
    ensureDbShape(db);

    const receita = (db.prescricoes || []).find(r => r.id === body.receitaId);
    if (!receita) return { error: "Receita não encontrada", status: 404 };
    if (receita.status === "cancelada") return { error: "Receita cancelada", status: 400 };

    const dispPatient = (db.patients || []).find(p => p.id === receita.patientId);
    const teamId = user.teamId || receita.teamId;
    const stockItems = (db.pharmacyStock || []).filter(s => String(s.teamId || "") === String(teamId || ""));

    // Validate stock only for items with qty > 0
    for (const it of body.itens) {
      if (!it.qtd || it.qtd === 0) continue;
      const stock = stockItems.find(s => s.id === it.stockItemId);
      if (!stock) return { error: `Item de estoque não encontrado: ${it.stockItemId}`, status: 404 };
      if (stock.qty < it.qtd) return { error: `Estoque insuficiente para ${stock.name}`, status: 400 };
    }

    const dispensacaoItens = [];
    for (const it of body.itens) {
      if (!it.qtd || it.qtd === 0) {
        dispensacaoItens.push({
          stockItemId: null,
          nome: it.prescricaoItemNome || "—",
          qtd: 0,
          lote: null,
          naoDispensado: true,
        });
        continue;
      }
      const stockIdx = db.pharmacyStock.findIndex(s => s.id === it.stockItemId);
      const stock = db.pharmacyStock[stockIdx];
      const prevQty = stock.qty;
      stock.qty -= it.qtd;
      stock.updatedAt = new Date().toISOString();
      dispensacaoItens.push({
        stockItemId: it.stockItemId,
        nome: stock.name,
        qtd: it.qtd,
        lote: it.lote || null,
        prevQty,
        newQty: stock.qty,
      });
    }

    const dispensacao = {
      id: uuidv4(),
      receitaId: body.receitaId,
      patientId: receita.patientId,
      dispensadoPor: user.id,
      dispensadoPorNome: user.name || user.username,
      teamId,
      executingUnitId: resolveActiveUnit(req),
      executingTeamId: String(user.teamId || ""),
      executingProfessionalId: String(user.id || ""),
      referenceUnitIdAtEvent: String(dispPatient?.referenceUnitId || dispPatient?.unitId || ""),
      referenceTeamIdAtEvent: String(dispPatient?.teamId || ""),
      municipalityId: String(dispPatient?.municipalityId || ""),
      itens: dispensacaoItens,
      obs: body.obs || null,
      realizadaEm: new Date().toISOString(),
    };

    db.dispensacoes.push(dispensacao);

    const anyDispensed = dispensacaoItens.some(i => !i.naoDispensado);
    const anySkipped = dispensacaoItens.some(i => i.naoDispensado);
    receita.status = anyDispensed && anySkipped ? "parcialmente_dispensada" : anyDispensed ? "dispensada" : "ativa";
    if (anyDispensed || anySkipped) receita.dispensadaEm = new Date().toISOString();

    addAuditLog(db, user, "create", "dispensacao", dispensacao.id, {
      patientId: receita.patientId,
      receitaId: body.receitaId,
      itens: dispensacaoItens.map(i => ({ id: i.stockItemId, nome: i.nome, qtd: i.qtd })),
    });

    return { data: dispensacao };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.status(201).json(result);
});

// GET /pharmacy/dispensacoes?patientId=&receitaId=
router.get("/pharmacy/dispensacoes", async (req, res) => {
  const user = req.user;
  if (!canReadDispensacoes(user)) return res.status(403).json({ error: "Sem permissão" });

  const db = await readDb();
  ensureDbShape(db);

  let items = db.dispensacoes || [];
  if (req.query.patientId) items = items.filter(d => d.patientId === req.query.patientId);
  if (req.query.receitaId) items = items.filter(d => d.receitaId === req.query.receitaId);
  items = [...items].sort((a, b) => (b.realizadaEm || "").localeCompare(a.realizadaEm || ""));

  res.json({ data: items });
});

export default router;
