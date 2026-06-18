/**
 * Smoke tests Deploy 6A — F7-01: Household endpoint (GET/POST/PATCH)
 *                         A7-03: household.created e household.updated audit
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d6a-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy6a-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy6a";
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

const get   = (path, token) => req("GET",   path, null, token);
const post  = (path, body, token) => req("POST",  path, body, token);
const patch = (path, body, token) => req("PATCH", path, body, token);

// ---------------------------------------------------------------
// Nurse login (manager)
// ---------------------------------------------------------------
const loginNurse = await post("/auth/login", { email: "ana@clinica.local", password: "123456" });
const tokenNurse = loginNurse.json?.token || loginNurse.json?.accessToken;
if (!tokenNurse) { console.error("FATAL: Nurse login failed", loginNurse.status, loginNurse.json); process.exit(1); }

const { withDb } = await import("../src/db.js");
const { ensureDbShape } = await import("../src/utils/domain.js");
const { v4: uuidv4 } = await import("uuid");

// Inject a patient on nurse's team
let patientId, crossTeamPatientId;

await withDb((db) => {
  ensureDbShape(db);
  const nurseUser = db.users.find(u => u.email === "ana@clinica.local");
  const nurseTeamId = nurseUser?.teamId || "team-default";

  patientId = uuidv4();
  db.patients.push({
    id: patientId, name: "Paciente Household Test", phone: "11900001111",
    teamId: nurseTeamId, assignedAcsId: "", careCategory: "general",
    inactive: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  if (!db.teams.find(t => t.id === "team-cross-6a")) {
    db.teams.push({ id: "team-cross-6a", name: "Equipe Cross 6A", unitId: "unit-default", createdAt: new Date().toISOString() });
  }
  crossTeamPatientId = uuidv4();
  db.patients.push({
    id: crossTeamPatientId, name: "Paciente Outra Equipe 6A", phone: "11900001112",
    teamId: "team-cross-6a", assignedAcsId: "", careCategory: "general",
    inactive: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
});

const results = [];
function record(smoke, pass, evidence) {
  results.push({ smoke, pass, evidence });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${smoke}`);
  if (!pass) console.error("  EVIDENCE:", JSON.stringify(evidence, null, 2));
}

let householdId = null;

// ============================================================
// Smoke 1 — POST /households → 201 + id retornado
// ============================================================
{
  const res = await post("/households", {
    patientId,
    familyCode: "FAM-001",
    housingType: "CASA",
    waterSupply: "REDE_PUBLICA",
    sewage: "REDE_PUBLICA",
    garbage: "COLETADO",
    electricity: "SIM",
    homeVisitFreq: "MENSAL"
  }, tokenNurse);
  householdId = res.json?.id;
  const pass = res.status === 201 && !!householdId;
  record("Smoke 1 — POST /households → 201, id retornado", pass,
    { status: res.status, id: householdId, error: res.json?.error });
}

// ============================================================
// Smoke 2 — A7-03: household.created auditado
// ============================================================
{
  let auditFound = false;
  await withDb((db) => {
    ensureDbShape(db);
    auditFound = db.auditLogs.some(l =>
      l.action === "household.created" && l.entityId === householdId
    );
  });
  record("Smoke 2 — A7-03: household.created auditado", auditFound, { auditFound, householdId });
}

// ============================================================
// Smoke 3 — GET /households?patientId= → retorna array com household
// ============================================================
{
  const res = await get(`/households?patientId=${patientId}`, tokenNurse);
  const found = Array.isArray(res.json) && res.json.some(h => h.id === householdId);
  const pass = res.status === 200 && found;
  record("Smoke 3 — GET /households?patientId → 200, household presente", pass,
    { status: res.status, count: Array.isArray(res.json) ? res.json.length : "N/A", found });
}

// ============================================================
// Smoke 4 — PATCH /households/:id → 200, campo atualizado
// ============================================================
{
  const res = await patch(`/households/${householdId}`, { familyCode: "FAM-002" }, tokenNurse);
  const pass = res.status === 200 && res.json?.familyCode === "FAM-002";
  record("Smoke 4 — PATCH /households/:id → 200, familyCode atualizado", pass,
    { status: res.status, familyCode: res.json?.familyCode, error: res.json?.error });
}

// ============================================================
// Smoke 5 — A7-03: household.updated auditado
// ============================================================
{
  let auditFound = false;
  await withDb((db) => {
    ensureDbShape(db);
    auditFound = db.auditLogs.some(l =>
      l.action === "household.updated" && l.entityId === householdId
    );
  });
  record("Smoke 5 — A7-03: household.updated auditado", auditFound, { auditFound });
}

// ============================================================
// Smoke 6 — GET /households sem patientId → 400
// ============================================================
{
  const res = await get("/households", tokenNurse);
  const pass = res.status === 400;
  record("Smoke 6 — GET /households sem patientId → 400", pass,
    { status: res.status, error: res.json?.error });
}

// ============================================================
// Smoke 7 — POST cross-team → 403
// ============================================================
{
  const res = await post("/households", { patientId: crossTeamPatientId, familyCode: "FAM-X" }, tokenNurse);
  const pass = res.status === 403;
  record("Smoke 7 — POST cross-team patient → 403", pass,
    { status: res.status, error: res.json?.error });
}

// ============================================================
// Smoke 8 — Regressão Deploy 5B inline (F6-01/02 + F6-03/04/05)
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { ROLE_CAPABILITIES } = await import("../src/utils/helpers.js");
  const patientsUtil = readFileSync(fileURLToPath(new URL("../src/utils/patients.js", import.meta.url)), "utf8");
  const hasF601 = patientsUtil.includes("assignedAcsId") && patientsUtil.includes("canonicalRole(user?.role) === \"acs\"");
  const tasksContent = readFileSync(fileURLToPath(new URL("../src/routes/tasks.js", import.meta.url)), "utf8");
  const hasF605 = tasksContent.includes('"task.access_denied"');
  const hasF604 = (ROLE_CAPABILITIES["acs"] || []).includes("tasks.write");
  const patientsRoute = readFileSync(fileURLToPath(new URL("../src/routes/patients.js", import.meta.url)), "utf8");
  const hasF603 = patientsRoute.includes('"patient.access_denied"');
  const pass = hasF601 && hasF603 && hasF604 && hasF605;
  record("Smoke 8 — Regressão 5B inline (F6-01/02/03/04/05 intactos)", pass,
    { hasF601, hasF603, hasF604, hasF605 });
}

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 6A — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 6A" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
