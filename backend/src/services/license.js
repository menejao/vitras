/**
 * License and Customer Lifecycle service — ERP-04
 *
 * License = operational contract between Municipality and VITRAS.
 * CustomerStatus = administrative lifecycle of the municipality as a client.
 * Both are decoupled from Deployment (ERP-03).
 *
 * Limits model is extensible: `limits` is a free-form object with named keys.
 * New limit types (storage, integrations, etc.) are added without schema changes.
 *
 * Every license change appends a versioned entry to history[].
 * Nothing is ever silently overwritten.
 */

import { randomUUID } from "node:crypto";

// ── Plan templates ─────────────────────────────────────────────────────────
// Templates provide defaults; all fields are overridable at create/edit time.

export const PLAN_TEMPLATES = {
  STARTER: {
    limits: { maxUnits: 1, maxUsers: 20 },
    features: ["portal", "acs"],
  },
  PROFESSIONAL: {
    limits: { maxUnits: 5, maxUsers: 100 },
    features: ["portal", "acs", "farmacia", "odontologia"],
  },
  ENTERPRISE: {
    limits: { maxUnits: 20, maxUsers: 500 },
    features: ["portal", "acs", "farmacia", "odontologia", "indicadores", "laboratorio"],
  },
  CUSTOM: {
    limits: {},
    features: [],
  },
};

export const KNOWN_FEATURES = [
  "portal", "acs", "farmacia", "odontologia", "indicadores",
  "laboratorio", "agendamento", "telemedicina",
];

// ── License statuses ───────────────────────────────────────────────────────

export const LICENSE_STATUS = {
  DRAFT:      "DRAFT",
  ACTIVE:     "ACTIVE",
  SUSPENDED:  "SUSPENDED",
  EXPIRED:    "EXPIRED",
  TERMINATED: "TERMINATED",
};

const LICENSE_TRANSITIONS = {
  DRAFT:      ["ACTIVE", "TERMINATED"],
  ACTIVE:     ["SUSPENDED", "EXPIRED", "TERMINATED"],
  SUSPENDED:  ["ACTIVE", "TERMINATED"],
  EXPIRED:    ["ACTIVE", "TERMINATED"],
  TERMINATED: [],
};

export function assertLicenseTransition(from, to) {
  const allowed = LICENSE_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Transição de licença inválida: ${from} → ${to}. Permitidas: ${allowed.join(", ") || "nenhuma"}`),
      { statusCode: 422 }
    );
  }
}

// ── Customer lifecycle statuses ────────────────────────────────────────────

export const CUSTOMER_STATUS = {
  LEAD:               "LEAD",
  CONTRACT_PENDING:   "CONTRACT_PENDING",
  IMPLEMENTATION:     "IMPLEMENTATION",
  TRAINING:           "TRAINING",
  READY_FOR_GO_LIVE:  "READY_FOR_GO_LIVE",
  ACTIVE:             "ACTIVE",
  SUSPENDED:          "SUSPENDED",
  CANCELLED:          "CANCELLED",
  TERMINATED:         "TERMINATED",
};

const CUSTOMER_TRANSITIONS = {
  LEAD:               ["CONTRACT_PENDING", "CANCELLED"],
  CONTRACT_PENDING:   ["IMPLEMENTATION", "LEAD", "CANCELLED"],
  IMPLEMENTATION:     ["TRAINING", "CANCELLED"],
  TRAINING:           ["READY_FOR_GO_LIVE", "CANCELLED"],
  READY_FOR_GO_LIVE:  ["ACTIVE", "CANCELLED"],
  ACTIVE:             ["SUSPENDED", "TERMINATED"],
  SUSPENDED:          ["ACTIVE", "TERMINATED"],
  CANCELLED:          [],
  TERMINATED:         [],
};

export const CUSTOMER_TERMINAL = new Set(["CANCELLED", "TERMINATED"]);

export function assertCustomerTransition(from, to) {
  if (CUSTOMER_TERMINAL.has(from)) {
    throw Object.assign(
      new Error(`Cliente em estado terminal ${from} não pode ser alterado`),
      { statusCode: 422 }
    );
  }
  const allowed = CUSTOMER_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Transição de cliente inválida: ${from} → ${to}. Permitidas: ${allowed.join(", ") || "nenhuma"}`),
      { statusCode: 422 }
    );
  }
}

// ── License code generator ─────────────────────────────────────────────────

export function generateLicenseCode(licenses) {
  const year   = new Date().getFullYear();
  const prefix = `LIC-${year}-`;
  const existing = (licenses || [])
    .map(l => l.licenseCode || "")
    .filter(c => c.startsWith(prefix))
    .map(c => parseInt(c.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ── License history entry ──────────────────────────────────────────────────

function historyEntry({ version, operator, reason, before, after }) {
  return {
    version,
    at:           new Date().toISOString(),
    operatorId:   operator.id,
    operatorName: operator.name,
    reason:       reason || null,
    before,
    after,
  };
}

// ── License factory ────────────────────────────────────────────────────────

export function createLicense({
  municipalityId,
  plan = "CUSTOM",
  contractNumber = "",
  contractStart = null,
  contractEnd = null,
  renewalDate = null,
  limits = {},
  features = [],
  notes = "",
  operator,
  existingLicenses = [],
}) {
  if (!municipalityId) {
    throw Object.assign(new Error("municipalityId obrigatório"), { statusCode: 400 });
  }
  const planKey = String(plan).toUpperCase();
  if (!PLAN_TEMPLATES[planKey]) {
    throw Object.assign(new Error(`Plano inválido: ${plan}. Válidos: ${Object.keys(PLAN_TEMPLATES).join(", ")}`), { statusCode: 400 });
  }

  const template = PLAN_TEMPLATES[planKey];
  // Merge template defaults with explicit overrides (overrides win)
  const resolvedLimits   = { ...template.limits, ...limits };
  const resolvedFeatures = features.length > 0 ? features : [...template.features];

  const now = new Date().toISOString();
  const id  = randomUUID();

  const license = {
    id,
    licenseCode:    generateLicenseCode(existingLicenses),
    municipalityId,
    plan:           planKey,
    status:         LICENSE_STATUS.DRAFT,
    contractNumber: contractNumber || "",
    contractStart:  contractStart  || null,
    contractEnd:    contractEnd    || null,
    renewalDate:    renewalDate    || null,
    limits:         resolvedLimits,
    features:       resolvedFeatures,
    notes:          notes || "",
    history:        [],
    createdBy:      { id: operator.id, name: operator.name },
    createdAt:      now,
    updatedAt:      now,
  };

  license.history.push(historyEntry({
    version: 1,
    operator,
    reason:  "Licença criada",
    before:  null,
    after:   { status: license.status, plan: planKey, limits: resolvedLimits, features: resolvedFeatures },
  }));

  return license;
}

// ── License mutations ──────────────────────────────────────────────────────

export function updateLicense(license, { patch, operator, reason }) {
  const before = {
    status: license.status, plan: license.plan,
    limits: { ...license.limits }, features: [...license.features],
    contractNumber: license.contractNumber, contractStart: license.contractStart,
    contractEnd: license.contractEnd, renewalDate: license.renewalDate, notes: license.notes,
  };

  const EDITABLE = ["contractNumber","contractStart","contractEnd","renewalDate","notes","limits","features","plan"];
  for (const key of EDITABLE) {
    if (patch[key] !== undefined) {
      if (key === "limits")   { license.limits   = { ...license.limits, ...patch.limits }; }
      else if (key === "plan") {
        const planKey = String(patch.plan).toUpperCase();
        if (!PLAN_TEMPLATES[planKey]) throw Object.assign(new Error(`Plano inválido: ${patch.plan}`), { statusCode: 400 });
        license.plan = planKey;
      }
      else { license[key] = patch[key]; }
    }
  }

  license.updatedAt = new Date().toISOString();
  const version = (license.history?.length || 0) + 1;
  license.history.push(historyEntry({
    version, operator, reason: reason || "Licença atualizada",
    before, after: {
      status: license.status, plan: license.plan,
      limits: { ...license.limits }, features: [...license.features],
      contractNumber: license.contractNumber, contractStart: license.contractStart,
      contractEnd: license.contractEnd, renewalDate: license.renewalDate,
    },
  }));
  return license;
}

export function changeLicenseStatus(license, { toStatus, operator, reason }) {
  assertLicenseTransition(license.status, toStatus);

  const before = { status: license.status };
  license.status    = toStatus;
  license.updatedAt = new Date().toISOString();

  const version = (license.history?.length || 0) + 1;
  license.history.push(historyEntry({
    version, operator, reason: reason || `Status alterado para ${toStatus}`,
    before, after: { status: toStatus },
  }));
  return license;
}

export function renewLicense(license, { newContractEnd, newRenewalDate, operator, reason }) {
  if (!newContractEnd) throw Object.assign(new Error("newContractEnd obrigatório"), { statusCode: 400 });

  const before = { contractEnd: license.contractEnd, renewalDate: license.renewalDate, status: license.status };
  license.contractEnd  = newContractEnd;
  license.renewalDate  = newRenewalDate || null;
  // Auto-reactivate if EXPIRED
  if (license.status === LICENSE_STATUS.EXPIRED) license.status = LICENSE_STATUS.ACTIVE;
  license.updatedAt = new Date().toISOString();

  const version = (license.history?.length || 0) + 1;
  license.history.push(historyEntry({
    version, operator, reason: reason || "Licença renovada",
    before, after: { contractEnd: license.contractEnd, renewalDate: license.renewalDate, status: license.status },
  }));
  return license;
}

// ── Customer lifecycle entity ──────────────────────────────────────────────

export function createMunicipalCustomer({ municipalityId, operator }) {
  if (!municipalityId) throw Object.assign(new Error("municipalityId obrigatório"), { statusCode: 400 });

  const now = new Date().toISOString();
  const customer = {
    id:             randomUUID(),
    municipalityId,
    customerStatus: CUSTOMER_STATUS.LEAD,
    statusHistory:  [],
    createdBy:      { id: operator.id, name: operator.name },
    createdAt:      now,
    updatedAt:      now,
  };
  customer.statusHistory.push({
    id: randomUUID(), from: null, to: CUSTOMER_STATUS.LEAD,
    by: operator, at: now, reason: "Cliente criado",
  });
  return customer;
}

export function changeCustomerStatus(customer, { toStatus, operator, reason }) {
  assertCustomerTransition(customer.customerStatus, toStatus);
  const from = customer.customerStatus;
  customer.customerStatus = toStatus;
  customer.updatedAt      = new Date().toISOString();
  customer.statusHistory.push({
    id: randomUUID(), from, to: toStatus,
    by: operator, at: customer.updatedAt, reason: reason || null,
  });
  return customer;
}

// ── Limit checker ──────────────────────────────────────────────────────────

export function checkUnitLimit({ license, currentUnitCount }) {
  if (!license || license.status !== LICENSE_STATUS.ACTIVE) return { ok: true }; // no active license = no limit
  const max = license.limits?.maxUnits;
  if (max == null) return { ok: true }; // unlimited
  if (currentUnitCount >= max) {
    return {
      ok: false,
      message: `Limite de UBS atingido: ${currentUnitCount}/${max} unidades contratadas (plano ${license.plan}). Atualize o contrato para adicionar mais UBS.`,
    };
  }
  return { ok: true };
}

export function checkUserLimit({ license, currentUserCount }) {
  if (!license || license.status !== LICENSE_STATUS.ACTIVE) return { ok: true };
  const max = license.limits?.maxUsers;
  if (max == null) return { ok: true };
  if (currentUserCount >= max) {
    return {
      ok: false,
      message: `Limite de usuários atingido: ${currentUserCount}/${max} usuários contratados (plano ${license.plan}).`,
    };
  }
  return { ok: true };
}

// ── Read helpers ───────────────────────────────────────────────────────────

export function computeCurrentUnits(db, municipalityId) {
  return (db.units || []).filter(
    u => u.municipalityId === municipalityId && u.status !== "suspended"
  ).length;
}

export function computeCurrentUsers(db, municipalityId) {
  return (db.users || []).filter(
    u => u.municipalityId === municipalityId && !u.inactive
  ).length;
}

export function getLicenseSummary(license, db) {
  const currentUnits = computeCurrentUnits(db, license.municipalityId);
  const currentUsers = computeCurrentUsers(db, license.municipalityId);
  const isExpired    = license.contractEnd && new Date(license.contractEnd) < new Date();
  const daysToExpiry = license.contractEnd
    ? Math.ceil((new Date(license.contractEnd) - new Date()) / 86400000)
    : null;
  return { currentUnits, currentUsers, isExpired, daysToExpiry };
}
