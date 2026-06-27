import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import {
  validate,
  SuppliesStockCreateSchema,
  SuppliesAdjustSchema,
  SuppliesDispenseSchema,
  SuppliesCloseContinuousSchema,
} from "../schemas.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

const SUPPLIES_CATALOG = [
  { id: "i01", name: "Atadura de Crepe 6 cm", category: "Curativo", unit: "unidade", maxQty: 30 },
  { id: "i02", name: "Atadura de Crepe 10 cm", category: "Curativo", unit: "unidade", maxQty: 30 },
  { id: "i03", name: "Atadura de Crepe 15 cm", category: "Curativo", unit: "unidade", maxQty: 30 },
  { id: "i04", name: "Atadura de Crepe 20 cm", category: "Curativo", unit: "unidade", maxQty: 30 },
  { id: "i05", name: "Atadura de Rayon", category: "Curativo", unit: "unidade", maxQty: 30 },
  { id: "i06", name: "Cadarco", category: "Curativo", unit: "rolo", maxQty: 1 },
  { id: "i07", name: "Clorexidina Degermante", category: "Antisseptico", unit: "frasco", maxQty: 3 },
  { id: "i08", name: "Compressa Gaze", category: "Curativo", unit: "unidade", maxQty: 180 },
  { id: "i09", name: "Esparadrapo Impermeavel P", category: "Curativo", unit: "rolo", maxQty: 4 },
  { id: "i10", name: "Esparadrapo Impermeavel G", category: "Curativo", unit: "rolo", maxQty: 2 },
  { id: "i11", name: "Micropore Pequeno", category: "Curativo", unit: "rolo", maxQty: 4 },
  { id: "i12", name: "Micropore Grande", category: "Curativo", unit: "rolo", maxQty: 2 },
  { id: "i13", name: "Fita Adesiva Hospitalar", category: "Curativo", unit: "rolo", maxQty: 2 },
  { id: "i14", name: "Equipo para Nutricao Enteral", category: "Nutricao Enteral", unit: "unidade", maxQty: 60 },
  { id: "i15", name: "Frasco para Nutricao Enteral", category: "Nutricao Enteral", unit: "unidade", maxQty: 60 },
  { id: "i16", name: "Luva P (caixa 100 un)", category: "EPI", unit: "caixa", maxQty: 2 },
  { id: "i17", name: "Luva M (caixa 100 un)", category: "EPI", unit: "caixa", maxQty: 2 },
  { id: "i18", name: "Luva G (caixa 100 un)", category: "EPI", unit: "caixa", maxQty: 2 },
  { id: "i19", name: "Seringa 20 mL", category: "Seringa", unit: "unidade", maxQty: 60 },
  { id: "i20", name: "Seringa 60 mL", category: "Seringa", unit: "unidade", maxQty: 30 },
  { id: "i21", name: "Sonda Aspiracao Traqueal com Valvula no 08", category: "Sonda", unit: "unidade", maxQty: 180 },
  { id: "i22", name: "Sonda Aspiracao Traqueal com Valvula no 10", category: "Sonda", unit: "unidade", maxQty: 180 },
  { id: "i23", name: "Sonda Aspiracao Traqueal com Valvula no 12", category: "Sonda", unit: "unidade", maxQty: 180 },
  { id: "i24", name: "Sonda Uretral no 04", category: "Sonda", unit: "unidade", maxQty: 180 },
  { id: "i25", name: "Sonda Uretral no 06", category: "Sonda", unit: "unidade", maxQty: 180 },
  { id: "i26", name: "Sonda Uretral no 08", category: "Sonda", unit: "unidade", maxQty: 180 },
  { id: "i27", name: "Sonda Uretral no 10", category: "Sonda", unit: "unidade", maxQty: 180 },
  { id: "i28", name: "Sonda Uretral no 12", category: "Sonda", unit: "unidade", maxQty: 180 },
  { id: "i29", name: "Sonda Uretral no 14", category: "Sonda", unit: "unidade", maxQty: 180 },
  { id: "i30", name: "Sonda Uretral no 16", category: "Sonda", unit: "unidade", maxQty: 180 },
  { id: "i31", name: "Vaselina", category: "Topico", unit: "frasco", maxQty: 3 },
  { id: "i32", name: "Cloreto de Sodio 0,9% para Curativo 500 mL", category: "Soro/Curativo", unit: "frasco", maxQty: 10 },
  { id: "i33", name: "Dersani", category: "Topico", unit: "frasco", maxQty: 3 },
  { id: "i34", name: "Colagenase + Cloranfenicol", category: "Topico", unit: "bisnaga", maxQty: 3 },
  { id: "i35", name: "Lidocaina", category: "Topico", unit: "bisnaga", maxQty: 3 },
  { id: "i36", name: "Alginato", category: "Topico", unit: "bisnaga", maxQty: 1 },
  { id: "i37", name: "Sulfadiazina de Prata", category: "Topico", unit: "bisnaga", maxQty: 3 },
  { id: "i38", name: "Tiras Reagentes Hemoanalise (cx 50 tiras)", category: "Diabetes", unit: "caixa", maxQty: 100, notes: "Exclusivo usuarios de insulina ou gestante diabetica." },
  { id: "i39", name: "Micro Lancetas (cx 100 unidades)", category: "Diabetes", unit: "caixa", maxQty: 2, notes: "Exclusivo usuarios de insulina ou gestante diabetica." },
  { id: "i40", name: "Aparelho para Hemoanalise (Glicosimetro)", category: "Diabetes", unit: "aparelho", maxQty: 1, notes: "Retirada unica para usuario de insulina ou gestante diabetica." },
  { id: "i41", name: "Agulha para Caneta de Insulina", category: "Diabetes", unit: "unidade", maxQty: 30, notes: "1 agulha por dia." },
  { id: "i42", name: "Seringa 1 mL para Insulina", category: "Diabetes", unit: "unidade", maxQty: 60, notes: "Liberado para aplicacao de insulina frasco ou somatropina." },
];

const catalogById = new Map(SUPPLIES_CATALOG.map((item) => [item.id, item]));

function canReadSupplies(user) {
  return hasCapability(user, "supplies.read") || hasCapability(user, "supplies.write");
}

function canWriteSupplies(user) {
  return hasCapability(user, "supplies.write");
}

function canAccessTeam(user, teamId) {
  const currentTeamId = String(user?.teamId || "").trim();
  if (currentTeamId && currentTeamId === String(teamId || "")) return true;
  return !currentTeamId && hasCapability(user, "team.manage");
}

function ensureTeamSupplies(db, teamId, actorId = "") {
  const scoped = db.suppliesStock.filter((item) => String(item.teamId || "") === String(teamId || ""));
  if (scoped.length > 0) return;
  const now = new Date().toISOString();
  db.suppliesStock.push(
    ...SUPPLIES_CATALOG.map((item) => ({
      id: item.id,
      teamId,
      name: item.name,
      category: item.category,
      unit: item.unit,
      maxQty: Number(item.maxQty || 0),
      qty: 0,
      notes: item.notes || "",
      createdAt: now,
      createdBy: actorId,
      updatedAt: now,
      updatedBy: actorId,
    }))
  );
}

function listScopedStock(db, user) {
  ensureDbShape(db);
  const currentTeamId = String(user?.teamId || "").trim();
  if (currentTeamId) ensureTeamSupplies(db, currentTeamId, String(user?.id || ""));
  return db.suppliesStock
    .filter((item) => canAccessTeam(user, item.teamId))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "pt-BR"));
}

function listScopedLogs(db, user) {
  ensureDbShape(db);
  return db.suppliesLogs
    .filter((item) => canAccessTeam(user, item.teamId))
    .sort((left, right) => String(right.ts || "").localeCompare(String(left.ts || "")));
}

function listScopedContinuous(db, user) {
  ensureDbShape(db);
  return db.suppliesContinuous
    .filter((item) => canAccessTeam(user, item.teamId))
    .sort((left, right) => String(right.dtInicio || "").localeCompare(String(left.dtInicio || "")));
}

function buildStockSnapshot(item) {
  if (!item) return null;
  return {
    id: String(item.id || ""),
    teamId: String(item.teamId || ""),
    name: String(item.name || ""),
    category: String(item.category || ""),
    unit: String(item.unit || ""),
    maxQty: Number(item.maxQty || 0),
    qty: Number(item.qty || 0),
    updatedAt: String(item.updatedAt || item.createdAt || ""),
  };
}

function buildContinuousSnapshot(entry) {
  if (!entry) return null;
  return {
    id: String(entry.id || ""),
    teamId: String(entry.teamId || ""),
    patientId: String(entry.patientId || ""),
    patientName: String(entry.patientName || ""),
    ativo: Boolean(entry.ativo),
    dtInicio: String(entry.dtInicio || ""),
    dtFim: String(entry.dtFim || ""),
    items: Array.isArray(entry.items) ? entry.items.map((item) => ({ id: String(item.id || ""), qty: Number(item.qty || 0) })) : [],
  };
}

function appendSupplyLog(db, user, payload) {
  const entry = {
    id: uuidv4(),
    ts: new Date().toISOString(),
    professionalId: String(user?.id || ""),
    professionalName: String(user?.name || ""),
    professionalRole: String(user?.role || ""),
    teamId: String(payload.teamId || user?.teamId || ""),
    ...payload,
  };
  db.suppliesLogs.unshift(entry);
  return entry;
}

router.post("/supplies/stock", validate(SuppliesStockCreateSchema), async (req, res) => {
  if (!canWriteSupplies(req.user)) {
    return res.status(403).json({ error: "Sem permissao para cadastrar insumos" });
  }
  const result = await withDb((db) => {
    ensureDbShape(db);
    const teamId = String(req.user?.teamId || "").trim();
    if (!teamId && !hasCapability(req.user, "team.manage")) {
      return { error: { status: 400, message: "Equipe do usuario nao definida" } };
    }
    const now = new Date().toISOString();
    const item = {
      id: uuidv4(),
      teamId,
      name: req.body.name,
      category: req.body.category,
      unit: req.body.unit,
      qty: Number(req.body.qty || 0),
      maxQty: Number(req.body.maxQty || 0),
      notes: String(req.body.notes || ""),
      createdAt: now,
      createdBy: req.user.id,
      updatedAt: now,
      updatedBy: req.user.id,
    };
    db.suppliesStock.push(item);
    appendSupplyLog(db, req.user, {
      type: "cadastro",
      itemId: item.id,
      itemName: item.name,
      qty: item.qty,
      date: now.slice(0, 10),
      teamId,
    });
    addAuditLog(db, req.user, "supplies.stock_item.created", "supplies_stock_item", item.id, {
      teamId,
      after: buildStockSnapshot(item),
    });
    return { item };
  });
  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.item);
});

router.get("/supplies/stock", async (req, res) => {
  if (!canReadSupplies(req.user)) {
    return res.status(403).json({ error: "Sem permissao para insumos" });
  }
  const db = await readDb();
  return res.json(listScopedStock(db, req.user));
});

router.get("/supplies/logs", async (req, res) => {
  if (!canReadSupplies(req.user)) {
    return res.status(403).json({ error: "Sem permissao para insumos" });
  }
  const db = await readDb();
  return res.json(listScopedLogs(db, req.user));
});

router.get("/supplies/continuous", async (req, res) => {
  if (!canReadSupplies(req.user)) {
    return res.status(403).json({ error: "Sem permissao para insumos" });
  }
  const db = await readDb();
  return res.json(listScopedContinuous(db, req.user));
});

router.post("/supplies/stock/:id/adjust", validate(SuppliesAdjustSchema), async (req, res) => {
  if (!canWriteSupplies(req.user)) {
    return res.status(403).json({ error: "Sem permissao para ajustar insumos" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const teamId = String(req.user?.teamId || "").trim();
    if (!teamId && !hasCapability(req.user, "team.manage")) {
      return { error: { status: 400, message: "Equipe do usuario nao definida" } };
    }
    ensureTeamSupplies(db, teamId, req.user.id);
    const index = db.suppliesStock.findIndex(
      (item) => item.id === String(req.params.id || "") && String(item.teamId || "") === teamId
    );
    if (index < 0) return { error: { status: 404, message: "Insumo nao encontrado" } };
    const current = db.suppliesStock[index];
    const next = {
      ...current,
      qty: Number(current.qty || 0) + Number(req.body.qty || 0),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id,
    };
    db.suppliesStock[index] = next;
    appendSupplyLog(db, req.user, {
      type: "entrada",
      itemId: next.id,
      itemName: next.name,
      qty: Number(req.body.qty || 0),
      patientId: "",
      patientName: "",
      continuo: false,
      obs: "",
      date: new Date().toISOString().slice(0, 10),
      teamId,
    });
    addAuditLog(db, req.user, "supplies.stock_item.adjusted", "supplies_stock_item", next.id, {
      teamId,
      before: buildStockSnapshot(current),
      after: buildStockSnapshot(next),
      qtyAdded: Number(req.body.qty || 0),
    });
    return { item: next };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.item);
});

router.post("/supplies/dispense", validate(SuppliesDispenseSchema), async (req, res) => {
  if (!canWriteSupplies(req.user)) {
    return res.status(403).json({ error: "Sem permissao para dispensar insumos" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const teamId = String(req.user?.teamId || "").trim();
    if (!teamId && !hasCapability(req.user, "team.manage")) {
      return { error: { status: 400, message: "Equipe do usuario nao definida" } };
    }
    ensureTeamSupplies(db, teamId, req.user.id);
    const patient = db.patients.find((item) => item.id === String(req.body.patientId || ""));
    if (!patient) return { error: { status: 404, message: "Paciente nao encontrado" } };
    if (String(patient.teamId || "") !== teamId) {
      return { error: { status: 400, message: "Paciente fora da equipe do usuario" } };
    }

    const selectedItems = req.body.items.map((item) => ({ id: String(item.id || ""), qty: Number(item.qty || 0) }));
    for (const selected of selectedItems) {
      const stockIndex = db.suppliesStock.findIndex((item) => item.id === selected.id && String(item.teamId || "") === teamId);
      if (stockIndex < 0) return { error: { status: 404, message: "Insumo nao encontrado" } };
      const stockItem = db.suppliesStock[stockIndex];
      const catalogItem = catalogById.get(selected.id);
      const activeContinuous = db.suppliesContinuous.find((entry) => entry.patientId === patient.id && entry.ativo);
      const continuousLimit = activeContinuous?.items?.find((item) => item.id === selected.id)?.qty;
      const maxAllowed = Number(continuousLimit || catalogItem?.maxQty || stockItem.maxQty || 0);
      if (selected.qty > Number(stockItem.qty || 0)) {
        return { error: { status: 409, message: `Quantidade indisponivel para ${stockItem.name}` } };
      }
      if (maxAllowed > 0 && selected.qty > maxAllowed) {
        return { error: { status: 409, message: `Quantidade acima do limite para ${stockItem.name}` } };
      }
    }

    const beforeSnapshots = [];
    const updatedItems = [];
    for (const selected of selectedItems) {
      const stockIndex = db.suppliesStock.findIndex((item) => item.id === selected.id && String(item.teamId || "") === teamId);
      const current = db.suppliesStock[stockIndex];
      beforeSnapshots.push(buildStockSnapshot(current));
      const next = {
        ...current,
        qty: Number(current.qty || 0) - selected.qty,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id,
      };
      db.suppliesStock[stockIndex] = next;
      updatedItems.push(next);
    }

    let continuousEntry = db.suppliesContinuous.find((entry) => entry.patientId === patient.id && entry.ativo);
    if (Boolean(req.body.continuo) && !continuousEntry) {
      continuousEntry = {
        id: uuidv4(),
        patientId: patient.id,
        patientName: patient.name,
        teamId,
        items: selectedItems,
        profissional: String(req.user?.name || ""),
        dtInicio: new Date().toISOString().slice(0, 10),
        dtFim: "",
        ativo: true,
        obs: String(req.body.obs || ""),
      };
      db.suppliesContinuous.unshift(continuousEntry);
    }

    const dispenseEntry = appendSupplyLog(db, req.user, {
      type: "dispensa",
      patientId: patient.id,
      patientName: patient.name,
      continuo: Boolean(req.body.continuo),
      items: selectedItems,
      obs: String(req.body.obs || ""),
      date: new Date().toISOString().slice(0, 10),
      teamId,
    });

    addAuditLog(db, req.user, "supplies.dispense.created", "supplies_log", dispenseEntry.id, {
      teamId,
      patientId: patient.id,
      before: beforeSnapshots,
      after: updatedItems.map(buildStockSnapshot),
      continuous: buildContinuousSnapshot(continuousEntry),
    });

    return {
      stock: updatedItems,
      dispense: dispenseEntry,
      continuous: continuousEntry || null,
    };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result);
});

router.post("/supplies/continuous/:id/close", validate(SuppliesCloseContinuousSchema), async (req, res) => {
  if (!canWriteSupplies(req.user)) {
    return res.status(403).json({ error: "Sem permissao para encerrar acompanhamento" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.suppliesContinuous.findIndex((entry) => entry.id === String(req.params.id || ""));
    if (index < 0) return { error: { status: 404, message: "Acompanhamento continuo nao encontrado" } };
    const current = db.suppliesContinuous[index];
    if (!canAccessTeam(req.user, current.teamId)) {
      return { error: { status: 403, message: "Sem permissao para este acompanhamento" } };
    }
    const next = {
      ...current,
      ativo: false,
      dtFim: new Date().toISOString().slice(0, 10),
      closedBy: req.user.id,
      closeReason: String(req.body.reason || ""),
    };
    db.suppliesContinuous[index] = next;
    addAuditLog(db, req.user, "supplies.continuous.closed", "supplies_continuous", next.id, {
      teamId: next.teamId,
      patientId: next.patientId,
      before: buildContinuousSnapshot(current),
      after: buildContinuousSnapshot(next),
      reason: String(req.body.reason || "").trim()
    });
    return { entry: next };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.entry);
});

export default router;
