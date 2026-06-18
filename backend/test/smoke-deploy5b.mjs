/**
 * Smoke tests Deploy 5B — F6-01: ACS patient visibility restriction
 *                         F6-02: ACS patient write restriction (via visit record creation)
 * CRC-01, CRC-02, CRC-03, S-6A, S-6B, S-6C, S-6D
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d5b-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy5b-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy5b";
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

const get  = (path, token) => req("GET",  path, null, token);
const post = (path, body, token) => req("POST", path, body, token);
const put  = (path, body, token) => req("PUT",  path, body, token);

const { withDb } = await import("../src/db.js");
const { ensureDbShape } = await import("../src/utils/domain.js");
const { v4: uuidv4 } = await import("uuid");

// ---------------------------------------------------------------
// Nurse login (manager) for manager regression tests
// ---------------------------------------------------------------
const loginNurse = await post("/auth/login", { email: "ana@clinica.local", password: "123456" });
const tokenNurse = loginNurse.json?.token || loginNurse.json?.accessToken;
if (!tokenNurse) { console.error("FATAL: Nurse login failed", loginNurse.status, loginNurse.json); process.exit(1); }

// ---------------------------------------------------------------
// Inject test fixtures
// ---------------------------------------------------------------
let acs1Id, acs2Id, patientOwnId, patientCrossAssignId, patientCrossTeamId;
let nurseTeamId;
let tokenAcs1;

await withDb((db) => {
  ensureDbShape(db);
  const nurseUser = db.users.find(u => u.email === "ana@clinica.local");
  nurseTeamId = nurseUser?.teamId || "team-default";

  acs1Id = "smoke-acs-f6-1";
  acs2Id = "smoke-acs-f6-2";
  db.users = db.users.filter(u => !["smoke-acs-f6-1","smoke-acs-f6-2"].includes(u.id));

  db.users.push({
    id: acs1Id, name: "ACS Smoke 1", email: "acs1-smoke5b@test.local",
    role: "acs", teamId: nurseTeamId, inactive: false, createdAt: new Date().toISOString()
  });
  db.users.push({
    id: acs2Id, name: "ACS Smoke 2", email: "acs2-smoke5b@test.local",
    role: "acs", teamId: nurseTeamId, inactive: false, createdAt: new Date().toISOString()
  });

  // Patient assigned to ACS-1 (same team) — happy path
  patientOwnId = uuidv4();
  db.patients.push({
    id: patientOwnId, name: "Paciente ACS1 Proprio", phone: "11900000001",
    teamId: nurseTeamId, assignedAcsId: acs1Id, careCategory: "general",
    inactive: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  // Patient assigned to ACS-2 (same team) — cross-assignee
  patientCrossAssignId = uuidv4();
  db.patients.push({
    id: patientCrossAssignId, name: "Paciente ACS2 CrossAssign", phone: "11900000002",
    teamId: nurseTeamId, assignedAcsId: acs2Id, careCategory: "general",
    inactive: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  // Patient on different team — cross-team
  patientCrossTeamId = uuidv4();
  if (!db.teams.find(t => t.id === "team-other-5b")) {
    db.teams.push({ id: "team-other-5b", name: "Equipe Outro", unitId: "unit-default", createdAt: new Date().toISOString() });
  }
  db.patients.push({
    id: patientCrossTeamId, name: "Paciente Outra Equipe", phone: "11900000003",
    teamId: "team-other-5b", assignedAcsId: "some-other-acs", careCategory: "general",
    inactive: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
});

import jwt from "jsonwebtoken";
const JWT_OPTS = { expiresIn: "1h", issuer: "vitras-backend", audience: "vitras-client" };
tokenAcs1 = jwt.sign({ id: acs1Id, role: "acs", teamId: nurseTeamId }, process.env.JWT_SECRET, JWT_OPTS);

const visitPayload = {
  type: "visit",
  dataVisita: "2026-06-12",
  turno: "MANHA",
  tipoVisita: "VISITA_PERIODICA",
  motivosVisita: ["VISITA_PERIODICA"],
  desfecho: "VISITA_REALIZADA"
};

const results = [];
function record(smoke, pass, evidence) {
  results.push({ smoke, pass, evidence });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${smoke}`);
  if (!pass) console.error("  EVIDENCE:", JSON.stringify(evidence, null, 2));
}

// ============================================================
// CRC-01 / S-6A — ACS GET /patients: vê apenas seus
// ============================================================
{
  const res = await get("/patients", tokenAcs1);
  const ids = Array.isArray(res.json) ? res.json.map(p => p.id) : [];
  const seesOwn = ids.includes(patientOwnId);
  const seesCrossAssign = ids.includes(patientCrossAssignId);
  const seesCrossTeam = ids.includes(patientCrossTeamId);
  const pass = res.status === 200 && seesOwn && !seesCrossAssign && !seesCrossTeam;
  record("CRC-01/S-6A — ACS GET /patients: vê próprio, não vê cross-assign nem cross-team", pass,
    { status: res.status, seesOwn, seesCrossAssign, seesCrossTeam, count: ids.length });
}

// ============================================================
// CRC-02 / S-6A — ACS cria visita em próprio paciente → 201
// (canAccessPatient write mode via getPatientOrError)
// ============================================================
{
  const res = await post(`/patients/${patientOwnId}/records`, visitPayload, tokenAcs1);
  const pass = res.status === 201;
  record("CRC-02/S-6A — ACS POST visit em próprio paciente → 201", pass,
    { status: res.status, error: res.json?.error });
}

// ============================================================
// CRC-02 / S-6B — ACS bloqueado ao criar visita em paciente de outro ACS
// ============================================================
{
  const res = await post(`/patients/${patientCrossAssignId}/records`, visitPayload, tokenAcs1);
  const pass = res.status === 403;
  record("CRC-02/S-6B — ACS POST visit cross-assign → 403", pass,
    { status: res.status, error: res.json?.error });
}

// ============================================================
// S-6B — patient.access_denied auditado para cross-assign
// ============================================================
{
  let auditFound = false;
  await withDb((db) => {
    ensureDbShape(db);
    auditFound = db.auditLogs.some(l =>
      l.action === "patient.access_denied" && l.entityId === patientCrossAssignId
    );
  });
  record("S-6B — patient.access_denied auditado para cross-assign (F6-03 + F6-02 integração)", auditFound,
    { auditFound });
}

// ============================================================
// S-6C — ACS bloqueado ao criar visita em paciente de outra equipe
// ============================================================
{
  const res = await post(`/patients/${patientCrossTeamId}/records`, visitPayload, tokenAcs1);
  const pass = res.status === 403;
  record("S-6C — ACS POST visit cross-team → 403", pass,
    { status: res.status, error: res.json?.error });
}

// ============================================================
// CRC-03 / S-6D — Manager GET /patients: vê todos da equipe
// ============================================================
{
  const res = await get("/patients", tokenNurse);
  const ids = Array.isArray(res.json) ? res.json.map(p => p.id) : [];
  const seesOwn = ids.includes(patientOwnId);
  const seesCrossAssign = ids.includes(patientCrossAssignId);
  const pass = res.status === 200 && seesOwn && seesCrossAssign;
  record("CRC-03/S-6D — Manager GET /patients: vê todos da equipe (sem regressão)", pass,
    { status: res.status, seesOwn, seesCrossAssign, count: ids.length });
}

// ============================================================
// CRC-03 / S-6D — Manager cria visita em qualquer paciente da equipe
// ============================================================
{
  const res = await post(`/patients/${patientCrossAssignId}/records`, visitPayload, tokenNurse);
  const pass = res.status === 201;
  record("CRC-03/S-6D — Manager POST visit em qualquer paciente da equipe → 201", pass,
    { status: res.status, error: res.json?.error });
}

// ============================================================
// Regressão inline Deploy 5A — F6-03 audit endpoint, F6-04 capability, F6-05 code
// (não executa smoke-deploy5a.mjs: Smoke 6 lá testa ausência de F6-01, agora implementado)
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");

  // F6-04: ACS tem tasks.write
  const { ROLE_CAPABILITIES } = await import("../src/utils/helpers.js");
  const hasTasksWrite = (ROLE_CAPABILITIES["acs"] || []).includes("tasks.write");

  // F6-05: task.access_denied presente em tasks.js
  const tasksContent = readFileSync(fileURLToPath(new URL("../src/routes/tasks.js", import.meta.url)), "utf8");
  const hasTaskAudit = tasksContent.includes('"task.access_denied"');

  // F6-03: patient.access_denied presente em patients.js
  const patientsContent = readFileSync(fileURLToPath(new URL("../src/routes/patients.js", import.meta.url)), "utf8");
  const hasPatientAudit = patientsContent.includes('"patient.access_denied"');

  const pass = hasTasksWrite && hasTaskAudit && hasPatientAudit;
  record("Regressão 5A inline — F6-03 patient.access_denied, F6-04 tasks.write, F6-05 task.access_denied", pass,
    { hasPatientAudit, hasTasksWrite, hasTaskAudit });
}

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 5B — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 5B" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
