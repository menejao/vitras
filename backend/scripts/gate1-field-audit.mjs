/**
 * Gate 1 — Levantamento de valores reais dos campos de enum (Seção 8.1)
 * Roda sobre a mesma infraestrutura de test (JSON file DB com seed completo).
 * Equivale às queries SQL da Seção 8.1 para ambiente Postgres staging.
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-gate1-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "gate1-jwt-secret-audit-only";
process.env.DATA_ENCRYPTION_KEY = "gate1-data-enc-key-32-bytes-pads";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "gate1-backup-key";
process.env.TEST_DB_PATH = tmpDb;
// Enable demo seed users
process.env.ENABLE_DEFAULT_USERS = "true";
process.env.SEED_DEMO_DATA = "true";

process.on("exit", () => { try { rmSync(tmpDir, { recursive: true }); } catch {} });

const { default: app } = await import("../src/app.js");

const server = createServer(app);
await new Promise((resolve, reject) =>
  server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()))
);
const { port } = server.address();
const BASE = `http://127.0.0.1:${port}`;

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  try { return { status: res.status, json: await res.json() }; }
  catch { return { status: res.status, json: null }; }
}

// Login
const { json: loginJson } = await req("POST", "/auth/login", { email: "ana@clinica.local", password: "123456" });
const token = loginJson?.token || loginJson?.accessToken;
if (!token) { console.error("Login failed"); process.exit(1); }

// Seed demo patients via the demo seed endpoint or inject directly
// Since SEED_DEMO_DATA=true the app may have seeded on startup; check patients list
let patientsRes = await req("GET", "/patients", null, token);
let patients = Array.isArray(patientsRes.json) ? patientsRes.json : [];

// If no patients, inject some via the seed utility directly to the DB
if (patients.length === 0) {
  // Seed patients by creating them directly via POST
  const { withDb } = await import("../src/db.js");
  const { ensureDbShape } = await import("../src/utils/domain.js");
  const { buildSeedPatient } = await import("../src/utils/seed.js");

  await withDb((db) => {
    ensureDbShape(db);
    const teamIds = db.teams.map((t) => t.id);
    const acsIds = db.users.filter((u) => u.role === "acs").map((u) => u.id);
    for (let i = 0; i < 50; i++) {
      const p = buildSeedPatient({ index: i, teamIds, acsIds, incomplete: i % 7 === 0 });
      db.patients.push(p);
    }
  });
  patientsRes = await req("GET", "/patients", null, token);
  patients = Array.isArray(patientsRes.json) ? patientsRes.json : [];
}

console.log(`\nTotal pacientes no DB: ${patients.length}`);

// Gate 1 function — count distinct values
function countDistinct(patients, field) {
  const counts = {};
  for (const p of patients) {
    const val = p[field];
    const key = val === undefined ? "__AUSENTE__"
              : val === null ? "__NULL__"
              : val === "" ? "__VAZIO__"
              : String(val);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

const FIELDS = ["racaCor", "sexAtBirth", "maritalStatus", "genderIdentity"];
const results = {};

for (const field of FIELDS) {
  results[field] = countDistinct(patients, field);
}

// Print Gate 1 table
console.log("\n========================================");
console.log("GATE 1 — LEVANTAMENTO DE VALORES REAIS");
console.log("========================================");

for (const [field, entries] of Object.entries(results)) {
  console.log(`\n[${field}]`);
  console.log(`${"Valor".padEnd(40)} | Qtd`);
  console.log("-".repeat(50));
  for (const [val, count] of entries) {
    console.log(`${val.padEnd(40)} | ${count}`);
  }
}

// Classify problems
console.log("\n========================================");
console.log("GATE 1 — PROBLEMAS IDENTIFICADOS");
console.log("========================================");

const ENUM_RACECOR = new Set(["BRANCA","PRETA","PARDA","AMARELA","INDIGENA"]);
const ENUM_SEXATBIRTH = new Set(["M","F","I"]);
const ENUM_MARITAL = new Set(["SOLTEIRO","CASADO","DIVORCIADO","VIUVO","UNIAO_ESTAVEL","SEPARADO","NAO_INFORMADO"]);
const ENUM_GENDER = new Set(["MULHER_CIS","HOMEM_CIS","MULHER_TRANS","HOMEM_TRANS","NAO_BINARIO","NAO_INFORMADO"]);

const fieldEnums = {
  racaCor: ENUM_RACECOR,
  sexAtBirth: ENUM_SEXATBIRTH,
  maritalStatus: ENUM_MARITAL,
  genderIdentity: ENUM_GENDER,
};

for (const [field, entries] of Object.entries(results)) {
  const valid = fieldEnums[field];
  const problems = entries.filter(([val]) => !valid.has(val) && val !== "__VAZIO__" && val !== "__NULL__" && val !== "__AUSENTE__");
  const missing = entries.filter(([val]) => val === "__VAZIO__" || val === "__NULL__" || val === "__AUSENTE__");
  if (problems.length) {
    console.log(`\n${field} — valores FORA DO ENUM (precisam normalização):`);
    for (const [val, count] of problems) console.log(`  "${val}" → ${count} pacientes`);
  }
  if (missing.length) {
    const total = missing.reduce((s, [, c]) => s + c, 0);
    console.log(`${field} — valores ausentes/vazios: ${total} pacientes`);
  }
}

if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));
process.exit(0);
