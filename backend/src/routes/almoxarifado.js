// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { validate, AlmoxRequisicaoCreateSchema, AlmoxRecebimentoSchema } from "../schemas.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

function canReadAlmox(user) {
  return hasCapability(user, "almoxarifado.read") || hasCapability(user, "almoxarifado.write");
}
function canWriteAlmox(user) {
  return hasCapability(user, "almoxarifado.write");
}

// GET /almoxarifado/requisicoes
router.get("/almoxarifado/requisicoes", (req, res) => {
  const user = req.user;
  if (!canReadAlmox(user)) return res.status(403).json({ error: "Sem permissão" });

  const db = readDb();
  ensureDbShape(db);

  const teamId = user.teamId || "";
  let items = (db.almoxRequisicoes || []).filter(r => String(r.teamId || "") === String(teamId));
  items = [...items].sort((a, b) => (b.criadaEm || "").localeCompare(a.criadaEm || ""));

  res.json({ data: items });
});

// POST /almoxarifado/requisicoes
router.post("/almoxarifado/requisicoes", validate(AlmoxRequisicaoCreateSchema), (req, res) => {
  const user = req.user;
  if (!canWriteAlmox(user)) return res.status(403).json({ error: "Sem permissão" });

  const body = req.body;
  const result = withDb(db => {
    ensureDbShape(db);

    const requisicao = {
      id: uuidv4(),
      teamId: user.teamId || null,
      criadaPor: user.id,
      criadaPorNome: user.name || user.username,
      criadaEm: new Date().toISOString(),
      status: "rascunho",
      itens: body.itens.map(it => ({
        ...it,
        qtdRecebida: 0,
        status: "pendente",
      })),
      obs: body.obs || null,
      enviadaEm: null,
      recebidaEm: null,
    };

    db.almoxRequisicoes.push(requisicao);
    addAuditLog(db, user, "create", "almoxRequisicao", requisicao.id, { itens: body.itens.length });
    return { data: requisicao };
  });

  res.status(201).json(result);
});

// POST /almoxarifado/requisicoes/:id/enviar
router.post("/almoxarifado/requisicoes/:id/enviar", (req, res) => {
  const user = req.user;
  if (!canWriteAlmox(user)) return res.status(403).json({ error: "Sem permissão" });

  const result = withDb(db => {
    ensureDbShape(db);
    const req_ = (db.almoxRequisicoes || []).find(r => r.id === req.params.id);
    if (!req_) return { error: "Requisição não encontrada", status: 404 };
    if (req_.status !== "rascunho") return { error: "Requisição já enviada ou recebida", status: 400 };

    req_.status = "enviada";
    req_.enviadaEm = new Date().toISOString();
    req_.enviadaPor = user.id;

    addAuditLog(db, user, "send", "almoxRequisicao", req_.id, {});
    return { data: req_ };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.json(result);
});

// POST /almoxarifado/requisicoes/:id/receber — partial receiving, auto-updates stock
router.post("/almoxarifado/requisicoes/:id/receber", validate(AlmoxRecebimentoSchema), (req, res) => {
  const user = req.user;
  if (!canWriteAlmox(user)) return res.status(403).json({ error: "Sem permissão" });

  const body = req.body;
  const result = withDb(db => {
    ensureDbShape(db);
    const almoxReq = (db.almoxRequisicoes || []).find(r => r.id === req.params.id);
    if (!almoxReq) return { error: "Requisição não encontrada", status: 404 };
    if (almoxReq.status === "cancelada") return { error: "Requisição cancelada", status: 400 };

    const teamId = almoxReq.teamId || "";

    for (const recv of body.itens) {
      const item = almoxReq.itens[recv.itemIdx];
      if (!item) return { error: `Índice inválido: ${recv.itemIdx}`, status: 400 };

      item.qtdRecebida = (item.qtdRecebida || 0) + recv.qtdRecebida;
      if (recv.lote) item.lote = recv.lote;
      if (recv.validade) item.validade = recv.validade;
      if (recv.obs) item.obsRecebimento = recv.obs;
      item.status = item.qtdRecebida >= item.qtdSolicitada ? "recebido" : "parcial";

      // Auto-update respective stock based on dominio
      if (recv.qtdRecebida > 0) {
        const stockKey = item.dominio === "pharmacy"
          ? "pharmacyStock"
          : item.dominio === "dental"
          ? "dentalStock"
          : "suppliesStock";

        const stock = (db[stockKey] || []).find(
          s => String(s.teamId || "") === String(teamId) &&
               s.name.toLowerCase() === item.nome.toLowerCase()
        );
        if (stock) {
          stock.qty += recv.qtdRecebida;
          stock.updatedAt = new Date().toISOString();
        }
      }
    }

    const allReceived = almoxReq.itens.every(it => it.status === "recebido");
    almoxReq.status = allReceived ? "recebido" : "recebimento_parcial";
    almoxReq.recebidaEm = new Date().toISOString();
    almoxReq.recebidaPor = user.id;

    addAuditLog(db, user, "receive", "almoxRequisicao", almoxReq.id, { obs: body.obs });
    return { data: almoxReq };
  });

  if (result.error) return res.status(result.status || 500).json({ error: result.error });
  res.json(result);
});

export default router;
