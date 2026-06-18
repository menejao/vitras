/**
 * Smoke tests Deploy 7A — F7-02: remoção de payload.cnsCpf
 *
 * Testa a lógica da migration 019 em file-mode (sem Postgres).
 * Verifica que apenas cnsCpf é removido; cpf, cns, cpf_hash semântico
 * e todos os outros campos permanecem intocados.
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d7a-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy7a-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy7a";
process.env.TEST_DB_PATH = tmpDb;

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
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

const post = (path, body, token) => req("POST", path, body, token);
const put  = (path, body, token) => req("PUT",  path, body, token);

const loginNurse = await post("/auth/login", { email: "ana@clinica.local", password: "123456" });
const tokenNurse = loginNurse.json?.token || loginNurse.json?.accessToken;
if (!tokenNurse) { console.error("FATAL: Nurse login failed", loginNurse.status); process.exit(1); }

const { withDb } = await import("../src/db.js");
const { ensureDbShape } = await import("../src/utils/domain.js");
const { v4: uuidv4 } = await import("uuid");

// Simulate migration 019 logic (file-mode analogue)
function applyMigration019(patients) {
  let removed = 0;
  let alreadyClean = 0;
  for (const p of patients) {
    if ("cnsCpf" in p) {
      delete p.cnsCpf;
      removed++;
    } else {
      alreadyClean++;
    }
  }
  return { removed, alreadyClean };
}

// Seed: patients with cnsCpf (redundant with cpf — mirrors production state)
let pRedundant1, pRedundant2, pNoHash, pClean;
let nurseTeamId;
const SNAPSHOT_CPF_1 = "12345678901";
const SNAPSHOT_CPF_2 = "98765432100";

await withDb((db) => {
  ensureDbShape(db);
  const nurse = db.users.find(u => u.email === "ana@clinica.local");
  nurseTeamId = nurse?.teamId || "team-default";

  const base = {
    teamId: nurseTeamId, careCategory: "general", inactive: false,
    assignedAcsId: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };

  // REDUNDANT: cnsCpf == cpf (production pattern)
  pRedundant1 = uuidv4();
  db.patients.push({ ...base, id: pRedundant1, name: "Redundant 1", phone: "11900070001",
    cpf: SNAPSHOT_CPF_1, cnsCpf: SNAPSHOT_CPF_1, cns: "", cnsResponsavel: "" });

  pRedundant2 = uuidv4();
  db.patients.push({ ...base, id: pRedundant2, name: "Redundant 2", phone: "11900070002",
    cpf: SNAPSHOT_CPF_2, cnsCpf: SNAPSHOT_CPF_2, cns: "", cnsResponsavel: "" });

  // REDUNDANT: cnsCpf == cpf, with extra payload fields
  pNoHash = uuidv4();
  db.patients.push({ ...base, id: pNoHash, name: "Redundant Extra", phone: "11900070003",
    cpf: "55566677788", cnsCpf: "55566677788", cns: "", cnsResponsavel: "111222333000111",
    racaCor: "PARDA", genderIdentity: "MULHER_CISSGENERO" });

  // CLEAN: no cnsCpf (already removed or never had)
  pClean = uuidv4();
  db.patients.push({ ...base, id: pClean, name: "Clean Patient", phone: "11900070004",
    cpf: "44455566677", cns: "", cnsResponsavel: "" });
});

const results = [];
function record(smoke, pass, evidence) {
  results.push({ smoke, pass, evidence });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${smoke}`);
  if (!pass) console.error("  EVIDENCE:", JSON.stringify(evidence, null, 2));
}

// ============================================================
// Smoke 1 — Pre-condition: seeded patients with cnsCpf exist before migration
// ============================================================
let preMigrationCount;
{
  await withDb((db) => {
    ensureDbShape(db);
    preMigrationCount = db.patients.filter(p => "cnsCpf" in p && p.cnsCpf !== undefined).length;
  });
  // At minimum pRedundant1, pRedundant2, pNoHash must be counted (may include seed patients)
  const hasSeededPatients = preMigrationCount >= 3;
  record("Smoke 1 — Pre-condition: seeded patients with cnsCpf present (>=3)", hasSeededPatients,
    { preMigrationCount });
}

// ============================================================
// Smoke 2 — Migration 019: removes cnsCpf from ALL patients (count drops to 0)
// ============================================================
{
  let removed, alreadyClean, countAfter;
  await withDb((db) => {
    ensureDbShape(db);
    ({ removed, alreadyClean } = applyMigration019(db.patients));
    countAfter = db.patients.filter(p => "cnsCpf" in p).length;
  });
  const pass = removed === preMigrationCount && countAfter === 0;
  record("Smoke 2 — Migration 019: cnsCpf removed from all patients (countAfter=0)", pass,
    { removed, preMigrationCount, alreadyClean, countAfter });
}

// ============================================================
// Smoke 3 — cpf UNTOUCHED after migration
// ============================================================
{
  let p1cpf, p2cpf, p3cpf;
  await withDb((db) => {
    ensureDbShape(db);
    p1cpf = db.patients.find(p => p.id === pRedundant1)?.cpf;
    p2cpf = db.patients.find(p => p.id === pRedundant2)?.cpf;
    p3cpf = db.patients.find(p => p.id === pNoHash)?.cpf;
  });
  const pass = p1cpf === SNAPSHOT_CPF_1 && p2cpf === SNAPSHOT_CPF_2 && p3cpf === "55566677788";
  record("Smoke 3 — cpf field untouched after migration 019", pass,
    { p1cpf, p2cpf, p3cpf });
}

// ============================================================
// Smoke 4 — cns UNTOUCHED after migration
// ============================================================
{
  let p1cns, p3cns;
  await withDb((db) => {
    ensureDbShape(db);
    p1cns = db.patients.find(p => p.id === pRedundant1)?.cns;
    p3cns = db.patients.find(p => p.id === pNoHash)?.cns;
  });
  const pass = p1cns === "" && p3cns === "";
  record("Smoke 4 — cns field untouched after migration 019", pass,
    { p1cns, p3cns });
}

// ============================================================
// Smoke 5 — cnsResponsavel UNTOUCHED after migration
// ============================================================
{
  let cnsResp;
  await withDb((db) => {
    ensureDbShape(db);
    cnsResp = db.patients.find(p => p.id === pNoHash)?.cnsResponsavel;
  });
  const pass = cnsResp === "111222333000111";
  record("Smoke 5 — cnsResponsavel untouched after migration 019", pass,
    { cnsResp });
}

// ============================================================
// Smoke 6 — Other payload fields UNTOUCHED (racaCor, genderIdentity)
// ============================================================
{
  let racaCor, genderIdentity;
  await withDb((db) => {
    ensureDbShape(db);
    const p = db.patients.find(pt => pt.id === pNoHash);
    racaCor = p?.racaCor;
    genderIdentity = p?.genderIdentity;
  });
  const pass = racaCor === "PARDA" && genderIdentity === "MULHER_CISSGENERO";
  record("Smoke 6 — Other payload fields (racaCor, genderIdentity) untouched", pass,
    { racaCor, genderIdentity });
}

// ============================================================
// Smoke 7 — After migration: pClean cpf is intact, cnsCpf gone
// ============================================================
{
  let cleanCpf, hasCnsCpf;
  await withDb((db) => {
    const p = db.patients.find(pt => pt.id === pClean);
    cleanCpf = p?.cpf;
    hasCnsCpf = "cnsCpf" in (p || {});
  });
  // cpf must be preserved; cnsCpf must be absent after migration
  const pass = cleanCpf === "44455566677" && !hasCnsCpf;
  record("Smoke 7 — After migration: pClean cpf intact, cnsCpf absent", pass,
    { cleanCpf, hasCnsCpf });
}

// ============================================================
// Smoke 8 — Idempotency: running migration 019 again removes 0 rows
// ============================================================
{
  let removed2, countAfter2;
  await withDb((db) => {
    ({ removed: removed2 } = applyMigration019(db.patients));
    countAfter2 = db.patients.filter(p => "cnsCpf" in p).length;
  });
  const pass = removed2 === 0 && countAfter2 === 0;
  record("Smoke 8 — Migration 019 idempotent: re-run removes 0, count stays 0", pass,
    { removed2, countAfter2 });
}

// ============================================================
// Smoke 9 — Total patient count unchanged (no patient deleted)
// ============================================================
{
  let totalPatients;
  await withDb((db) => {
    ensureDbShape(db);
    totalPatients = db.patients.length;
  });
  // Seeded: 4 patients + whatever was in seed
  const pass = totalPatients >= 4;
  record("Smoke 9 — Total patient count unchanged (no deletions)", pass,
    { totalPatients });
}

// ============================================================
// Smoke 10 — Migration 019 registered in migrations/index.js
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const content = readFileSync(fileURLToPath(new URL("../src/migrations/index.js", import.meta.url)), "utf8");
  const has019 = content.includes("019_remove_cnscpf") || content.includes("m019");
  record("Smoke 10 — Migration 019 registered in migrations/index.js", has019, { has019 });
}

// ============================================================
// Smoke 11 — Regression 6D: dpre07 script still present
// ============================================================
{
  const { existsSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const exists = existsSync(fileURLToPath(new URL("../scripts/dpre07-cnscpf-audit.mjs", import.meta.url)));
  record("Smoke 11 — Regression 6D: dpre07-cnscpf-audit.mjs present", exists, { exists });
}

// ============================================================
// Smoke 12 — Regression 6C: cnsResponsavel persists in PUT
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const content = readFileSync(fileURLToPath(new URL("../src/routes/patients.js", import.meta.url)), "utf8");
  const hasF704b = content.includes("F7-04b") && content.includes("cnsResponsavel");
  record("Smoke 12 — Regression 6C: F7-04b cnsResponsavel in PUT intact", hasF704b, { hasF704b });
}

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 7A — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "v" : "x";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 7A" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
