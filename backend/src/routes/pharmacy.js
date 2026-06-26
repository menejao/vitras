import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import {
  validate,
  PharmacyAdjustSchema,
  PharmacyDispenseSchema,
  PharmacyStockCreateSchema,
  PharmacyStockUpdateSchema,
} from "../schemas.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability, councilTypeForRole } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

const DEFAULT_STOCK = [
  { key: "paracetamol-500", name: "Paracetamol 500mg", category: "Analgésico", unit: "comprimido", qty: 1200, minQty: 200, location: "Prateleira A1" },
  { key: "dipirona-500", name: "Dipirona 500mg", category: "Analgésico", unit: "comprimido", qty: 800, minQty: 150, location: "Prateleira A1" },
  { key: "ibuprofeno-600", name: "Ibuprofeno 600mg", category: "Anti-inflamatorio", unit: "comprimido", qty: 500, minQty: 100, location: "Prateleira A2" },
  { key: "amoxicilina-500", name: "Amoxicilina 500mg", category: "Antibiotico", unit: "capsula", qty: 400, minQty: 80, location: "Prateleira B1" },
  { key: "azitromicina-500", name: "Azitromicina 500mg", category: "Antibiotico", unit: "comprimido", qty: 200, minQty: 50, location: "Prateleira B1" },
  { key: "enalapril-10", name: "Enalapril 10mg", category: "Cardiovascular", unit: "comprimido", qty: 900, minQty: 200, location: "Prateleira C1" },
  { key: "losartana-50", name: "Losartana 50mg", category: "Cardiovascular", unit: "comprimido", qty: 900, minQty: 200, location: "Prateleira C1" },
  { key: "metformina-850", name: "Metformina 850mg", category: "Diabetes", unit: "comprimido", qty: 1000, minQty: 200, location: "Prateleira D1" },
  { key: "insulina-nph", name: "Insulina NPH 100UI/mL", category: "Diabetes", unit: "frasco", qty: 80, minQty: 20, location: "Geladeira G1" },
  { key: "fluoxetina-20", name: "Fluoxetina 20mg", category: "Saude Mental", unit: "comprimido", qty: 400, minQty: 80, location: "Prateleira E1" },
  { key: "salbutamol-100", name: "Salbutamol spray 100mcg", category: "Respiratorio", unit: "frasco", qty: 60, minQty: 15, location: "Prateleira F1" },
  { key: "sulfato-ferroso-40", name: "Sulfato Ferroso 40mg", category: "Gestante", unit: "comprimido", qty: 600, minQty: 120, location: "Prateleira G2" },
  { key: "acido-folico-5", name: "Acido Folico 5mg", category: "Gestante", unit: "comprimido", qty: 600, minQty: 120, location: "Prateleira G2" },
  { key: "omeprazol-20", name: "Omeprazol 20mg", category: "Gastrointestinal", unit: "capsula", qty: 500, minQty: 100, location: "Prateleira A3" },
  { key: "soro-0-9-500", name: "Soro Fisiologico 0,9% 500mL", category: "Soros", unit: "bolsa", qty: 50, minQty: 10, location: "Armario S1" },
];

function canReadPharmacy(user) {
  return hasCapability(user, "pharmacy.read") || hasCapability(user, "pharmacy.write");
}

function canWritePharmacy(user) {
  return hasCapability(user, "pharmacy.write");
}

function canAccessTeam(user, teamId) {
  const currentTeamId = String(user?.teamId || "").trim();
  if (currentTeamId && currentTeamId === String(teamId || "")) return true;
  return !currentTeamId && hasCapability(user, "team.manage");
}

function ensureTeamStock(db, teamId, actorId = "") {
  const scoped = db.pharmacyStock.filter((item) => String(item.teamId || "") === String(teamId || ""));
  if (scoped.length > 0) return;
  const now = new Date().toISOString();
  db.pharmacyStock.push(
    ...DEFAULT_STOCK.map((item) => ({
      id: uuidv4(),
      teamId,
      name: item.name,
      category: item.category,
      unit: item.unit,
      qty: Number(item.qty || 0),
      minQty: Number(item.minQty || 0),
      location: item.location,
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
  if (currentTeamId) ensureTeamStock(db, currentTeamId, String(user?.id || ""));
  return db.pharmacyStock
    .filter((item) => canAccessTeam(user, item.teamId))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "pt-BR"));
}

function listScopedLogs(db, user) {
  ensureDbShape(db);
  return db.pharmacyLogs
    .filter((item) => canAccessTeam(user, item.teamId))
    .sort((left, right) => String(right.ts || "").localeCompare(String(left.ts || "")));
}

function buildStockSnapshot(item) {
  if (!item) return null;
  return {
    id: String(item.id || ""),
    teamId: String(item.teamId || ""),
    name: String(item.name || ""),
    category: String(item.category || ""),
    unit: String(item.unit || ""),
    qty: Number(item.qty || 0),
    minQty: Number(item.minQty || 0),
    location: String(item.location || ""),
    updatedAt: String(item.updatedAt || item.createdAt || ""),
  };
}

function buildDispenseSnapshot(entry) {
  if (!entry) return null;
  return {
    id: String(entry.id || ""),
    teamId: String(entry.teamId || ""),
    itemId: String(entry.itemId || ""),
    itemName: String(entry.itemName || ""),
    patientId: String(entry.patientId || ""),
    patient: String(entry.patient || ""),
    prescriberId: String(entry.prescriberId || ""),
    prescriber: String(entry.prescriber || ""),
    qty: Number(entry.qty || 0),
    numReceita: String(entry.numReceita || ""),
    lote: String(entry.lote || ""),
    dtReceita: String(entry.dtReceita || ""),
    ts: String(entry.ts || ""),
  };
}

function appendPharmacyLog(db, user, payload) {
  const entry = {
    id: uuidv4(),
    ts: new Date().toISOString(),
    pharma: String(user?.name || ""),
    pharmaId: String(user?.id || ""),
    teamId: String(payload.teamId || user?.teamId || ""),
    ...payload,
  };
  db.pharmacyLogs.unshift(entry);
  return entry;
}

router.get("/pharmacy/stock", async (req, res) => {
  if (!canReadPharmacy(req.user)) {
    return res.status(403).json({ error: "Sem permissao para farmacia" });
  }
  const db = await readDb();
  return res.json(listScopedStock(db, req.user));
});

router.get("/pharmacy/logs", async (req, res) => {
  if (!canReadPharmacy(req.user)) {
    return res.status(403).json({ error: "Sem permissao para farmacia" });
  }
  const db = await readDb();
  return res.json(listScopedLogs(db, req.user));
});

router.post("/pharmacy/stock", validate(PharmacyStockCreateSchema), async (req, res) => {
  if (!canWritePharmacy(req.user)) {
    return res.status(403).json({ error: "Sem permissao para editar farmacia" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const teamId = String(req.user?.teamId || "").trim();
    if (!teamId && !hasCapability(req.user, "team.manage")) {
      return { error: { status: 400, message: "Equipe do usuario nao definida" } };
    }
    ensureTeamStock(db, teamId, req.user.id);
    const now = new Date().toISOString();
    const item = {
      id: uuidv4(),
      teamId,
      name: req.body.name,
      category: req.body.category,
      unit: req.body.unit,
      qty: Number(req.body.qty || 0),
      minQty: Number(req.body.minQty || 0),
      location: req.body.location,
      createdAt: now,
      createdBy: req.user.id,
      updatedAt: now,
      updatedBy: req.user.id,
    };
    db.pharmacyStock.push(item);
    appendPharmacyLog(db, req.user, {
      type: "cadastro",
      itemId: item.id,
      itemName: item.name,
      qty: item.qty,
      location: item.location,
      teamId,
    });
    addAuditLog(db, req.user, "pharmacy.stock_item.created", "pharmacy_stock_item", item.id, {
      teamId,
      after: buildStockSnapshot(item),
    });
    return { item };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result.item);
});

router.patch("/pharmacy/stock/:id", validate(PharmacyStockUpdateSchema), async (req, res) => {
  if (!canWritePharmacy(req.user)) {
    return res.status(403).json({ error: "Sem permissao para editar farmacia" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.pharmacyStock.findIndex((item) => item.id === String(req.params.id || ""));
    if (index < 0) return { error: { status: 404, message: "Medicamento nao encontrado" } };
    const current = db.pharmacyStock[index];
    if (!canAccessTeam(req.user, current.teamId)) {
      return { error: { status: 403, message: "Sem permissao para este estoque" } };
    }
    const next = {
      ...current,
      ...req.body,
      qty: req.body.qty !== undefined ? Number(req.body.qty) : Number(current.qty || 0),
      minQty: req.body.minQty !== undefined ? Number(req.body.minQty) : Number(current.minQty || 0),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id,
    };
    db.pharmacyStock[index] = next;
    appendPharmacyLog(db, req.user, {
      type: "edicao",
      itemId: next.id,
      itemName: next.name,
      teamId: next.teamId,
    });
    addAuditLog(db, req.user, "pharmacy.stock_item.updated", "pharmacy_stock_item", next.id, {
      teamId: next.teamId,
      before: buildStockSnapshot(current),
      after: buildStockSnapshot(next),
      changedFields: Object.keys(req.body || {}),
    });
    return { item: next };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.item);
});

router.post("/pharmacy/stock/:id/adjust", validate(PharmacyAdjustSchema), async (req, res) => {
  if (!canWritePharmacy(req.user)) {
    return res.status(403).json({ error: "Sem permissao para editar farmacia" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const index = db.pharmacyStock.findIndex((item) => item.id === String(req.params.id || ""));
    if (index < 0) return { error: { status: 404, message: "Medicamento nao encontrado" } };
    const current = db.pharmacyStock[index];
    if (!canAccessTeam(req.user, current.teamId)) {
      return { error: { status: 403, message: "Sem permissao para este estoque" } };
    }
    const nextQty = Math.max(0, Number(current.qty || 0) + Number(req.body.delta || 0));
    const next = {
      ...current,
      qty: nextQty,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id,
    };
    db.pharmacyStock[index] = next;
    const isEntrada = Number(req.body.delta || 0) > 0;
    const logEntry = appendPharmacyLog(db, req.user, {
      type: isEntrada ? "entrada" : "ajuste",
      itemId: next.id,
      itemName: next.name,
      delta: Number(req.body.delta || 0),
      reason: String(req.body.reason || ""),
      lote: String(req.body.lote || ""),
      validade: String(req.body.validade || ""),
      obs: String(req.body.obs || ""),
      teamId: next.teamId,
    });
    addAuditLog(db, req.user, "pharmacy.stock_item.adjusted", "pharmacy_stock_item", next.id, {
      teamId: next.teamId,
      before: buildStockSnapshot(current),
      after: buildStockSnapshot(next),
      reason: logEntry.reason,
      delta: logEntry.delta,
    });
    return { item: next };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result.item);
});

router.post("/pharmacy/dispense", validate(PharmacyDispenseSchema), async (req, res) => {
  if (!canWritePharmacy(req.user)) {
    return res.status(403).json({ error: "Sem permissao para dispensacao" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const stockIndex = db.pharmacyStock.findIndex((item) => item.id === String(req.body.itemId || ""));
    if (stockIndex < 0) return { error: { status: 404, message: "Medicamento nao encontrado" } };
    const stockItem = db.pharmacyStock[stockIndex];
    if (!canAccessTeam(req.user, stockItem.teamId)) {
      return { error: { status: 403, message: "Sem permissao para este estoque" } };
    }
    const patient = db.patients.find((item) => item.id === String(req.body.patientId || ""));
    if (!patient) return { error: { status: 404, message: "Paciente nao encontrado" } };
    const prescriber = db.users.find((item) => item.id === String(req.body.prescriberId || ""));
    if (!prescriber) return { error: { status: 404, message: "Prescritor nao encontrado" } };
    if (String(patient.teamId || "") !== String(stockItem.teamId || "")) {
      return { error: { status: 400, message: "Paciente fora da equipe do estoque" } };
    }
    const qty = Number(req.body.qty || 0);
    if (qty > Number(stockItem.qty || 0)) {
      return { error: { status: 409, message: "Quantidade maior que o estoque disponivel" } };
    }

    const updatedStock = {
      ...stockItem,
      qty: Number(stockItem.qty || 0) - qty,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id,
    };
    db.pharmacyStock[stockIndex] = updatedStock;

    const councilType = councilTypeForRole(prescriber.role);
    const prescriberCouncil = prescriber.councilNumber
      ? `${councilType} ${prescriber.councilNumber}/${String(prescriber.councilUf || "").trim()}`
      : "";

    const dispenseEntry = appendPharmacyLog(db, req.user, {
      type: "dispensa",
      itemId: updatedStock.id,
      itemName: updatedStock.name,
      patientId: patient.id,
      patient: patient.name,
      prescriberId: prescriber.id,
      prescriber: prescriber.name,
      prescriberCouncil,
      qty,
      numReceita: req.body.numReceita,
      lote: String(req.body.lote || ""),
      dtReceita: req.body.dtReceita,
      notes: String(req.body.notes || ""),
      teamId: updatedStock.teamId,
    });

    addAuditLog(db, req.user, "pharmacy.dispense.created", "pharmacy_log", dispenseEntry.id, {
      teamId: updatedStock.teamId,
      before: buildStockSnapshot(stockItem),
      after: buildStockSnapshot(updatedStock),
      dispense: buildDispenseSnapshot(dispenseEntry),
    });

    return { stockItem: updatedStock, dispense: dispenseEntry };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.status(201).json(result);
});

export default router;
