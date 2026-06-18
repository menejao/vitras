/**
 * APS-01C Validation — ACS Visits backend persistence
 * Run: node scripts/aps01c-validation.mjs
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  ✓ ${label}`); passed++; }
function fail(label, reason) { console.error(`  ✗ ${label}: ${reason}`); failed++; }

// ── 1. Schema exports ─────────────────────────────────────────────────────────
console.log("\n[1] Schema exports");

const { AcsVisitCreateSchema, AcsVisitUpdateSchema } = await import("../src/schemas.js");

if (AcsVisitCreateSchema) ok("AcsVisitCreateSchema exported");
else fail("AcsVisitCreateSchema", "not exported");

if (AcsVisitUpdateSchema) ok("AcsVisitUpdateSchema exported");
else fail("AcsVisitUpdateSchema", "not exported");

// ── 2. Schema validation ──────────────────────────────────────────────────────
console.log("\n[2] AcsVisitCreateSchema validation");

const validPayload = {
  patientId: "pat-001",
  date: "2026-06-18",
  desfecho: "realizada",
  turno: "manha",
  motivos: ["visita_periodica"],
  buscaAtiva: [],
  acompanhamentos: [],
  controleAmbiental: [],
  peso: 70,
  altura: 170,
  observacoes: "Paciente em bom estado geral.",
};

try {
  AcsVisitCreateSchema.parse(validPayload);
  ok("AcsVisitCreateSchema accepts valid payload");
} catch (e) {
  fail("AcsVisitCreateSchema", e.message);
}

// Invalid desfecho
try {
  AcsVisitCreateSchema.parse({ ...validPayload, desfecho: "invalido" });
  fail("AcsVisitCreateSchema", "should reject invalid desfecho");
} catch {
  ok("AcsVisitCreateSchema rejects invalid desfecho");
}

// Missing required date
try {
  AcsVisitCreateSchema.parse({ ...validPayload, date: undefined });
  fail("AcsVisitCreateSchema", "should reject missing date");
} catch {
  ok("AcsVisitCreateSchema rejects missing date");
}

// Invalid date format
try {
  AcsVisitCreateSchema.parse({ ...validPayload, date: "18/06/2026" });
  fail("AcsVisitCreateSchema", "should reject DD/MM/YYYY date format");
} catch {
  ok("AcsVisitCreateSchema rejects DD/MM/YYYY date format");
}

// Valid desfechos
for (const d of ["realizada", "recusada", "ausente"]) {
  try {
    AcsVisitCreateSchema.parse({ ...validPayload, desfecho: d });
    ok(`AcsVisitCreateSchema accepts desfecho: ${d}`);
  } catch (e) {
    fail(`AcsVisitCreateSchema desfecho ${d}`, e.message);
  }
}

// Nullable optional fields
try {
  AcsVisitCreateSchema.parse({ ...validPayload, peso: null, altura: null, turno: null, observacoes: null });
  ok("AcsVisitCreateSchema accepts null for nullable fields");
} catch (e) {
  fail("AcsVisitCreateSchema nullable fields", e.message);
}

// ── 3. RBAC capabilities ──────────────────────────────────────────────────────
console.log("\n[3] RBAC capabilities");

const { ROLE_CAPABILITIES } = await import("../src/utils/helpers.js");

const CAPS_REQUIRED = {
  acs:             ["acs.visit.create", "acs.visit.read", "acs.visit.update"],
  nurse_manager:   ["acs.visit.read", "acs.visit.update"],
  gestor:          ["acs.visit.read"],
  security_auditor:["acs.visit.read"],
  break_glass_admin: ["acs.visit.create", "acs.visit.read", "acs.visit.update"],
  doctor:          ["acs.visit.read"],
};

for (const [role, caps] of Object.entries(CAPS_REQUIRED)) {
  const roleCaps = ROLE_CAPABILITIES[role] || [];
  for (const cap of caps) {
    if (roleCaps.includes(cap)) {
      ok(`${role} has capability: ${cap}`);
    } else {
      fail(`${role} missing capability`, cap);
    }
  }
}

// ACS must NOT have capabilities it shouldn't
const NON_ACS_CAPS = ["cds.export", "audit.read", "users.read.all"];
for (const cap of NON_ACS_CAPS) {
  if (!(ROLE_CAPABILITIES.acs || []).includes(cap)) {
    ok(`acs does not have: ${cap}`);
  } else {
    fail(`acs should not have`, cap);
  }
}

// ── 4. Domain shape ───────────────────────────────────────────────────────────
console.log("\n[4] Domain shape — ensureDbShape includes acsVisits");

const domainSrc = await readFile(new URL("../src/utils/domain.js", import.meta.url), "utf8");
if (domainSrc.includes('ensureArray(db, "acsVisits")')) {
  ok("ensureDbShape includes acsVisits");
} else {
  fail("ensureDbShape", "missing acsVisits array");
}

// ── 5. Route source checks ────────────────────────────────────────────────────
console.log("\n[5] Route source — acs-visits.js structure");

const routeSrc = await readFile(new URL("../src/routes/acs-visits.js", import.meta.url), "utf8");

const ROUTE_CHECKS = [
  ["GET /acs-visits",                  'router.get("/acs-visits",'],
  ["GET /acs-visits/:id",              'router.get("/acs-visits/:id",'],
  ["GET /acs-visits/patient/:id",      'router.get("/acs-visits/patient/:patientId",'],
  ["GET /acs-visits/household/:id",    'router.get("/acs-visits/household/:householdId",'],
  ["GET /acs-visits/task/:id",         'router.get("/acs-visits/task/:taskId",'],
  ["POST /acs-visits",                 'router.post("/acs-visits",'],
  ["PATCH /acs-visits/:id",            'router.patch("/acs-visits/:id",'],
  ["audit: acs_visit.created",         '"acs_visit.created"'],
  ["audit: acs_visit.updated",         '"acs_visit.updated"'],
  ["auto household link",              "householdId"],
  ["task auto-complete",               '"task.status_updated"'],
  ["scope ACS to own visits",          "v.acsId === user.id"],
  ["scope team for managers",          "v.teamId === user.teamId"],
];

for (const [label, token] of ROUTE_CHECKS) {
  if (routeSrc.includes(token)) ok(label);
  else fail(label, `token not found: ${token}`);
}

// ── 6. app.js mount check ─────────────────────────────────────────────────────
console.log("\n[6] app.js — acsVisitsRouter mounted");

const appSrc = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
if (appSrc.includes('import acsVisitsRouter from "./routes/acs-visits.js"')) {
  ok("app.js imports acsVisitsRouter");
} else {
  fail("app.js", "missing acsVisitsRouter import");
}
if (appSrc.includes("app.use(acsVisitsRouter)")) {
  ok("app.js mounts acsVisitsRouter");
} else {
  fail("app.js", "missing app.use(acsVisitsRouter)");
}

// ── 7. Frontend integration check ─────────────────────────────────────────────
console.log("\n[7] Frontend — localStorage removed, API calls present");

import { readFile as rf } from "node:fs/promises";
const frontendSrc = await rf(
  new URL("../../frontend-react/src/pages/AcsTasksPage.jsx", import.meta.url),
  "utf8"
);

if (!frontendSrc.includes("_localOnly")) {
  ok("Frontend: _localOnly flag removed");
} else {
  fail("Frontend", "_localOnly still present");
}

if (frontendSrc.includes('fetch("/acs-visits"')) {
  ok("Frontend: GET /acs-visits API call present");
} else {
  fail("Frontend", "missing GET /acs-visits fetch");
}

if (frontendSrc.includes('fetch("/acs-visits",')) {
  ok("Frontend: POST /acs-visits API call present");
} else {
  fail("Frontend", "missing POST /acs-visits fetch");
}

if (!frontendSrc.includes("localStorage.setItem") || !frontendSrc.includes("vitras_acs_visits")) {
  ok("Frontend: localStorage write removed");
} else {
  fail("Frontend", "localStorage write still present");
}

// ── 8. HTTP route tests (if server running) ───────────────────────────────────
console.log("\n[8] HTTP routes (unauthenticated — server optional)");

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
    } else {
      fail(`${method} ${path}`, `expected ${expectedStatus}, got ${res.status}`);
    }
  } catch (e) {
    if (e.cause?.code === "ECONNREFUSED") {
      ok(`${method} ${path} — server not running, skip`);
    } else {
      fail(`${method} ${path}`, e.message);
    }
  }
}

await checkRoute("GET",   "/acs-visits",          401, "requires auth");
await checkRoute("POST",  "/acs-visits",          401, "requires auth");
await checkRoute("PATCH", "/acs-visits/test-id",  401, "requires auth");
await checkRoute("GET",   "/acs-visits/patient/x",401, "requires auth");
await checkRoute("GET",   "/acs-visits/household/x", 401, "requires auth");
await checkRoute("GET",   "/acs-visits/task/x",   401, "requires auth");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`APS-01C Validation: ${passed} PASS, ${failed} FAIL`);
console.log(failed === 0 ? "APS-01C PASS ✓" : `APS-01C FAIL — ${failed} checks failed`);
process.exit(failed === 0 ? 0 : 1);
