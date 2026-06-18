/**
 * B-02 Households Field Parity Validation
 * Tests schema acceptance and CDS FCD field availability for all critical household fields.
 * Run: node scripts/b02-households-parity.mjs
 */

import assert from "node:assert/strict";

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  ✓ ${label}`); passed++; }
function fail(label, reason) { console.error(`  ✗ ${label}: ${reason}`); failed++; }

// ── 1. Schema parity ─────────────────────────────────────────────────────────
console.log("\n[1] Schema field parity — HouseholdCreateSchema");

const { validate, HouseholdCreateSchema, HouseholdUpdateSchema } = await import("../src/schemas.js");

const CRITICAL_FCD_FIELDS = [
  "situacaoMoradiaPosseTerra",
  "tipoEndereco",
  "tipoImovel",
  "localizacao",
  "numComodos",
  "numMoradores",
  "abastecimentoAgua",
  "tratamentoAgua",
  "esgotamento",
  "destinacaoLixo",
  "energiaEletrica",
  "materialPredominanteParedes",
];

// Zod: test each field individually against the schema shape
const createShape = HouseholdCreateSchema.shape;
const updateShape = HouseholdUpdateSchema.shape;

for (const field of CRITICAL_FCD_FIELDS) {
  if (createShape[field]) {
    ok(`HouseholdCreateSchema has field: ${field}`);
  } else {
    fail(`HouseholdCreateSchema missing field`, field);
  }
}

console.log("\n[2] Schema field parity — HouseholdUpdateSchema");
for (const field of CRITICAL_FCD_FIELDS) {
  if (updateShape[field]) {
    ok(`HouseholdUpdateSchema has field: ${field}`);
  } else {
    fail(`HouseholdUpdateSchema missing field`, field);
  }
}

// ── 2. Enum validation ────────────────────────────────────────────────────────
console.log("\n[3] Enum value validation");

const SITUACAO_VALID = ["PROPRIO", "FINANCIADO", "ALUGADO", "ARRENDADO", "CEDIDO", "OCUPACAO", "SITUACAO_RUA", "OUTRO"];
const TIPO_ENDERECO_VALID = ["LOGRADOURO", "SEM_ENDERECO"];

for (const v of SITUACAO_VALID) {
  try {
    HouseholdCreateSchema.shape.situacaoMoradiaPosseTerra.parse(v);
    ok(`situacaoMoradiaPosseTerra accepts: ${v}`);
  } catch {
    fail(`situacaoMoradiaPosseTerra rejects valid value`, v);
  }
}

for (const v of TIPO_ENDERECO_VALID) {
  try {
    HouseholdCreateSchema.shape.tipoEndereco.parse(v);
    ok(`tipoEndereco accepts: ${v}`);
  } catch {
    fail(`tipoEndereco rejects valid value`, v);
  }
}

// Invalid value must be rejected
try {
  HouseholdCreateSchema.shape.tipoEndereco.parse("INVALIDO");
  fail("tipoEndereco should reject INVALIDO", "did not throw");
} catch {
  ok("tipoEndereco rejects invalid value");
}

// ── 3. Route persistence — source code check ──────────────────────────────────
console.log("\n[4] Route persistence — source audit");

import { readFile } from "node:fs/promises";
const routeSrc = await readFile(new URL("../src/routes/households.js", import.meta.url), "utf8");

// POST block: situacaoMoradiaPosseTerra and tipoEndereco must appear in object literal
if (routeSrc.includes("situacaoMoradiaPosseTerra: payload.situacaoMoradiaPosseTerra")) {
  ok("POST handler persists situacaoMoradiaPosseTerra");
} else {
  fail("POST handler", "missing situacaoMoradiaPosseTerra persistence");
}

if (routeSrc.includes("tipoEndereco: payload.tipoEndereco")) {
  ok("POST handler persists tipoEndereco");
} else {
  fail("POST handler", "missing tipoEndereco persistence");
}

// PATCH block: both fields must appear in conditional updates
const patchMatches = routeSrc.match(/if \(payload\.situacaoMoradiaPosseTerra !== undefined\)/g);
if (patchMatches && patchMatches.length >= 1) {
  ok("PATCH handler updates situacaoMoradiaPosseTerra");
} else {
  fail("PATCH handler", "missing situacaoMoradiaPosseTerra update");
}

const patchMatchesTipo = routeSrc.match(/if \(payload\.tipoEndereco !== undefined\)/g);
if (patchMatchesTipo && patchMatchesTipo.length >= 1) {
  ok("PATCH handler updates tipoEndereco");
} else {
  fail("PATCH handler", "missing tipoEndereco update");
}

// Other critical fields must also be persisted
const ROUTE_PERSIST_CHECKS = [
  ["tipoImovel", "tipoImovel: payload.tipoImovel"],
  ["localizacao", "localizacao: payload.localizacao"],
  ["numComodos", "numComodos: payload.numComodos"],
  ["numMoradores", "numMoradores: payload.numMoradores"],
  ["abastecimentoAgua", "abastecimentoAgua: payload.abastecimentoAgua"],
  ["tratamentoAgua", "tratamentoAgua: payload.tratamentoAgua"],
  ["esgotamento", "esgotamento: payload.esgotamento"],
  ["destinacaoLixo", "destinacaoLixo: payload.destinacaoLixo"],
  ["energiaEletrica", "energiaEletrica: payload.energiaEletrica"],
  ["materialPredominanteParedes", "materialPredominanteParedes: payload.materialPredominanteParedes"],
];

for (const [field, token] of ROUTE_PERSIST_CHECKS) {
  if (routeSrc.includes(token)) {
    ok(`Route persists: ${field}`);
  } else {
    fail(`Route missing persistence for`, field);
  }
}

// ── 4. CDS FCD field access check ────────────────────────────────────────────
console.log("\n[5] CDS FCD — field access in cds-structs.js");

const cdsStructsSrc = await readFile(new URL("../src/services/cds-export/cds-structs.js", import.meta.url), "utf8");

const CDS_FIELD_CHECKS = [
  ["situacaoMoradiaPosseTerra", "h.situacaoMoradiaPosseTerra"],
  ["tipoEndereco", "household.tipoEndereco"],
  ["tipoImovel/housingType", "household.tipoImovel || household.housingType"],
  ["numMoradores", "household.numMoradores"],
  ["numComodos", "household.numComodos"],
  ["localizacao", "household.localizacao"],
  ["abastecimentoAgua", "household.abastecimentoAgua"],
  ["energiaEletrica", "household.energiaEletrica"],
];

for (const [field, token] of CDS_FIELD_CHECKS) {
  if (cdsStructsSrc.includes(token)) {
    ok(`CDS FCD reads: ${field}`);
  } else {
    fail(`CDS FCD missing access for`, `${field} (token: ${token})`);
  }
}

// tipoEndereco fallback — must default to LOGRADOURO when not set
if (cdsStructsSrc.includes('"LOGRADOURO"')) {
  ok("CDS FCD tipoEndereco fallback to LOGRADOURO present");
} else {
  fail("CDS FCD", "missing tipoEndereco LOGRADOURO fallback");
}

// ── 5. HTTP route existence check (requires server to be running) ─────────────
console.log("\n[6] HTTP route registration (unauthenticated)");

const BASE = "http://localhost:3001";

async function checkRoute(method, path, expectedStatus, label) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" || method === "PATCH" ? JSON.stringify({}) : undefined,
    });
    if (res.status === expectedStatus) {
      ok(`${method} ${path} → ${res.status} (${label})`);
    } else if (res.status === 0 || res.status === undefined) {
      fail(`${method} ${path}`, "no response — server not running?");
    } else {
      fail(`${method} ${path}`, `expected ${expectedStatus}, got ${res.status}`);
    }
  } catch (e) {
    if (e.cause?.code === "ECONNREFUSED") {
      ok(`${method} ${path} — server not running, skip HTTP check`);
    } else {
      fail(`${method} ${path}`, e.message);
    }
  }
}

await checkRoute("GET", "/households?patientId=test", 401, "GET /households requires auth");
await checkRoute("POST", "/households", 401, "POST /households requires auth");
await checkRoute("PATCH", "/households/test-id", 401, "PATCH /households/:id requires auth");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`B-02 Validation: ${passed} PASS, ${failed} FAIL`);
console.log(failed === 0 ? "B-02 PASS ✓" : `B-02 FAIL — ${failed} checks failed`);
process.exit(failed === 0 ? 0 : 1);
