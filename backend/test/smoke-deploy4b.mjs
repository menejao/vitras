/**
 * Smoke tests Deploy 4B — F5-01: Household entity
 * Migration 015, POST /households, PATCH /households/:id,
 * extraction from PATCH /patients, frontend compat.
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d4b-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy4b-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy4b";
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

const post  = (path, body, token) => req("POST",  path, body, token);
const patch = (path, body, token) => req("PATCH", path, body, token);
const put   = (path, body, token) => req("PUT",   path, body, token);

const loginRes = await post("/auth/login", { email: "ana@clinica.local", password: "123456" });
const token = loginRes.json?.token || loginRes.json?.accessToken;
if (!token) { console.error("FATAL: Login failed", loginRes.status, loginRes.json); process.exit(1); }

const { withDb } = await import("../src/db.js");

const results = [];
function record(smoke, pass, evidence, risco = "CRITICAL") {
  results.push({ smoke, pass, evidence, risco });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${smoke}`);
  if (!pass) console.error("  EVIDENCE:", JSON.stringify(evidence, null, 2));
}

// ============================================================
// Smoke 1 — Migration 015: schema HouseholdCreate/Update exist and validate
// ============================================================
{
  const { HouseholdCreateSchema, HouseholdUpdateSchema } = await import("../src/schemas.js");

  const validCreate = HouseholdCreateSchema.safeParse({
    patientId: "p-001",
    housingType: "DOMICILIO",
    waterSupply: "REDE_ENCANADA"
  });
  const missingPatientId = !HouseholdCreateSchema.safeParse({ housingType: "DOMICILIO" }).success;
  const validUpdate = HouseholdUpdateSchema.safeParse({ housingType: "COMERCIO", sewage: "FOSSA_SEPTICA" }).success;
  const emptyUpdateOk = HouseholdUpdateSchema.safeParse({}).success;
  const rejectsUnknown = !HouseholdUpdateSchema.safeParse({ unknownField: "x" }).success;

  const pass = validCreate.success && missingPatientId && validUpdate && emptyUpdateOk && rejectsUnknown;
  record("Smoke 1 — Migration 015: HouseholdCreateSchema + HouseholdUpdateSchema válidos", pass,
    { validCreate: validCreate.success, missingPatientId, validUpdate, emptyUpdateOk, rejectsUnknown });
}

// ============================================================
// Smoke 2 — Migration 015: idempotente (db.households array exists after ensureDbShape)
// ============================================================
{
  const { ensureDbShape } = await import("../src/utils/domain.js");
  let householdsIsArray = false;
  await withDb((db) => {
    ensureDbShape(db);
    householdsIsArray = Array.isArray(db.households);
  });
  record("Smoke 2 — Migration 015: db.households array criado por ensureDbShape (idempotente)", householdsIsArray,
    { householdsIsArray });
}

// ============================================================
// Smoke 3 — POST /households: HTTP 201
// ============================================================
let householdId = null;
let patientId = null;
{
  // First create a patient
  const pRes = await post("/patients", { name: "Household Smoke Patient", phone: "11999990010" }, token);
  patientId = pRes.json?.id;
  if (!patientId) {
    record("Smoke 3 — POST /households: HTTP 201", false, { error: "failed to create patient", pStatus: pRes.status, pJson: pRes.json });
  } else {
    const hRes = await post("/households", {
      patientId,
      housingType: "DOMICILIO",
      waterSupply: "REDE_ENCANADA",
      sewage: "FOSSA_SEPTICA",
      garbage: "S",
      electricity: "S",
      familyCode: "FC-001"
    }, token);
    householdId = hRes.json?.id;
    const pass = hRes.status === 201 && !!householdId;
    record("Smoke 3 — POST /households: HTTP 201", pass,
      { status: hRes.status, id: householdId, error: hRes.json?.error });
  }
}

// ============================================================
// Smoke 4 — PATCH /households/:id: HTTP 200
// ============================================================
{
  if (!householdId) {
    record("Smoke 4 — PATCH /households/:id: HTTP 200", false, { error: "no householdId from Smoke 3" });
  } else {
    const pRes = await patch(`/households/${householdId}`, {
      housingType: "COMERCIO",
      waterSupply: "POCO_ARTESIANO"
    }, token);
    let storedType = null;
    await withDb((db) => { storedType = db.households.find(h => h.id === householdId)?.housingType; });
    const pass = pRes.status === 200 && storedType === "COMERCIO";
    record("Smoke 4 — PATCH /households/:id: HTTP 200 + campo persistido", pass,
      { status: pRes.status, storedType, error: pRes.json?.error });
  }
}

// ============================================================
// Smoke 5 — PATCH /patients com housingType: Patient NÃO recebe; Household recebe
// ============================================================
{
  // Create fresh patient
  const pRes2 = await post("/patients", { name: "Extraction Smoke Patient", phone: "11999990011" }, token);
  const pid2 = pRes2.json?.id;
  if (!pid2) {
    record("Smoke 5 — Extração Household do PATCH /patients", false,
      { error: "failed to create patient", pStatus: pRes2.status });
  } else {
    await put(`/patients/${pid2}`, {
      name: "Extraction Smoke Patient Updated",
      phone: "11999990011",
      housingType: "DOMICILIO",
      waterSupply: "REDE_ENCANADA",
      sewage: "FOSSA_SEPTICA"
    }, token);

    let patientHasHousingType = false;
    let householdHasHousingType = false;
    await withDb((db) => {
      const p = db.patients.find(x => x.id === pid2);
      patientHasHousingType = p?.housingType !== undefined && p?.housingType !== "" && p?.housingType !== null;
      const h = db.households.find(x => x.patientId === pid2);
      householdHasHousingType = h?.housingType === "DOMICILIO";
    });
    const pass = !patientHasHousingType && householdHasHousingType;
    record("Smoke 5 — Patient NÃO recebe housingType; Household recebe", pass,
      { patientHasHousingType, householdHasHousingType });
  }
}

// ============================================================
// Smoke 6 — Compatibilidade frontend: payload legado aceito sem erro
// ============================================================
{
  const pRes3 = await post("/patients", { name: "Frontend Compat Patient", phone: "11999990012" }, token);
  const pid3 = pRes3.json?.id;
  if (!pid3) {
    record("Smoke 6 — Compat frontend: payload legado aceito", false,
      { error: "failed to create patient", pStatus: pRes3.status });
  } else {
    const patchRes = await put(`/patients/${pid3}`, {
      name: "Frontend Compat Patient Updated",
      phone: "11999990012",
      housingType: "ABRIGO",
      waterSupply: "CISTERNAS",
      sewage: "VALA_CEU_ABERTO",
      garbage: "N",
      electricity: "N",
      homeVisitFreq: "quinzenal",
      familyCode: "FC-002"
    }, token);
    const pass = patchRes.status === 200;
    record("Smoke 6 — Compat frontend: payload legado retorna HTTP 200", pass,
      { status: patchRes.status, error: patchRes.json?.error });
  }
}

// ============================================================
// Smoke 7 — Rollback documentado em migration 015
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const migPath = new URL("../src/migrations/015_create_app_households.js", import.meta.url);
  const content = readFileSync(fileURLToPath(migPath), "utf8");
  const hasRollback = content.includes("DROP TABLE IF EXISTS app_households");
  const hasIfNotExists = content.includes("IF NOT EXISTS");
  record("Smoke 7 — Migration 015: rollback documentado + IF NOT EXISTS", hasRollback && hasIfNotExists,
    { hasRollback, hasIfNotExists });
}

// ============================================================
// Smoke 8 — Regressão Deploy 4A
// ============================================================
const backendDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
{
  const r = spawnSync("node", ["test/smoke-deploy4a.mjs"], { cwd: backendDir, encoding: "utf8", timeout: 180000, shell: true });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = r.status === 0 && out.includes("APPROVED FOR DEPLOY 4A") && out.includes("8/8 PASS");
  record("Smoke 8 — Regressão Deploy 4A (8/8 PASS)", pass,
    { exitCode: r.status, lastLines: out.split("\n").filter(Boolean).slice(-4).join(" | ") });
}

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 4B — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 4B" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
