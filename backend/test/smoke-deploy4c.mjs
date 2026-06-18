/**
 * Smoke tests Deploy 4C — F5-03: VisitCreateSchema + F5-06: canonical maritalStatus seed
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d4c-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy4c-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy4c";
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

const post = (path, body, token) => req("POST",  path, body, token);
const put  = (path, body, token) => req("PUT",   path, body, token);

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
// Smoke 1 — F5-03: VisitCreateSchema exported and validates correctly
// ============================================================
{
  const { VisitCreateSchema } = await import("../src/schemas.js");

  const validVisit = VisitCreateSchema.safeParse({
    type: "visit", dataVisita: "2026-06-11",
    turno: "MANHA", tipoVisita: "VISITA_PERIODICA",
    motivosVisita: ["ACOMPANHAMENTO_ADULTO"], desfecho: "VISITA_REALIZADA"
  });
  const missingDataVisita = !VisitCreateSchema.safeParse({
    type: "visit", turno: "MANHA", tipoVisita: "VISITA_PERIODICA",
    motivosVisita: ["OUTRO"], desfecho: "VISITA_REALIZADA"
  }).success;
  const emptyMotivos = !VisitCreateSchema.safeParse({
    type: "visit", dataVisita: "2026-06-11", turno: "MANHA", tipoVisita: "VISITA_PERIODICA",
    motivosVisita: [], desfecho: "VISITA_REALIZADA"
  }).success;
  const invalidTurno = !VisitCreateSchema.safeParse({
    type: "visit", dataVisita: "2026-06-11", turno: "NOITE_TARDIO", tipoVisita: "VISITA_PERIODICA",
    motivosVisita: ["OUTRO"], desfecho: "VISITA_REALIZADA"
  }).success;
  const rejectsUnknown = !VisitCreateSchema.safeParse({
    type: "visit", dataVisita: "2026-06-11", turno: "TARDE", tipoVisita: "OUTRO",
    motivosVisita: ["OUTRO"], desfecho: "AUSENTE", campoDesconhecido: "x"
  }).success;
  const withOpcional = VisitCreateSchema.safeParse({
    type: "visit", dataVisita: "2026-06-11", turno: "NOITE", tipoVisita: "BUSCA_ATIVA",
    motivosVisita: ["BUSCA_TB", "EDUCACAO_SAUDE"], desfecho: "RECUSOU",
    peso: 70.5, altura: 170
  }).success;

  const pass = validVisit.success && missingDataVisita && emptyMotivos && invalidTurno && rejectsUnknown && withOpcional;
  record("Smoke 1 — F5-03: VisitCreateSchema válido + .strict() + campos opcionais", pass,
    { validVisit: validVisit.success, missingDataVisita, emptyMotivos, invalidTurno, rejectsUnknown, withOpcional });
}

// ============================================================
// Smoke 2 — F5-03: POST /patients/:id/records type=visit com VisitCreateSchema — HTTP 201
// ============================================================
let patientId = null;
let visitRecordId = null;
{
  const pRes = await post("/patients", { name: "Visit Smoke Patient", phone: "11999990020" }, token);
  patientId = pRes.json?.id;
  if (!patientId) {
    record("Smoke 2 — POST records type=visit: HTTP 201", false, { error: "failed to create patient", pStatus: pRes.status, pJson: pRes.json });
  } else {
    const rRes = await post(`/patients/${patientId}/records`, {
      type: "visit",
      dataVisita: "2026-06-11",
      turno: "MANHA",
      tipoVisita: "VISITA_PERIODICA",
      motivosVisita: ["ACOMPANHAMENTO_ADULTO", "VISITA_PERIODICA"],
      desfecho: "VISITA_REALIZADA",
      peso: 68.0,
      altura: 165
    }, token);
    visitRecordId = rRes.json?.id;
    const pass = rRes.status === 201 && !!visitRecordId && rRes.json?.type === "visit";
    record("Smoke 2 — POST records type=visit: HTTP 201 + tipo=visit", pass,
      { status: rRes.status, id: visitRecordId, type: rRes.json?.type, error: rRes.json?.error });
  }
}

// ============================================================
// Smoke 3 — F5-03: visit record persisted with correct metadata fields
// ============================================================
{
  if (!visitRecordId) {
    record("Smoke 3 — Visit record metadata CDS", false, { error: "no visitRecordId from Smoke 2" });
  } else {
    let stored = null;
    await withDb((db) => {
      stored = db.clinicalRecords.find(r => r.id === visitRecordId);
    });
    const hasDataVisita = stored?.date === "2026-06-11";
    const hasTurno = stored?.metadata?.turno === "MANHA";
    const hasTipoVisita = stored?.metadata?.tipoVisita === "VISITA_PERIODICA";
    const hasMotivos = Array.isArray(stored?.metadata?.motivosVisita) && stored.metadata.motivosVisita.length === 2;
    const hasDesfecho = stored?.metadata?.desfecho === "VISITA_REALIZADA";
    const hasPeso = stored?.metadata?.peso === 68.0;
    const pass = hasDataVisita && hasTurno && hasTipoVisita && hasMotivos && hasDesfecho && hasPeso;
    record("Smoke 3 — CDS metadata (turno/tipoVisita/motivosVisita/desfecho/peso) persistido", pass,
      { hasDataVisita, hasTurno, hasTipoVisita, hasMotivos, hasDesfecho, hasPeso, metadata: stored?.metadata });
  }
}

// ============================================================
// Smoke 4 — F5-03: type=visit rejeita campos do RecordCreateSchema (strict)
// ============================================================
{
  if (!patientId) {
    record("Smoke 4 — type=visit rejeita payload RecordCreateSchema", false, { error: "no patientId" });
  } else {
    const rRes = await post(`/patients/${patientId}/records`, {
      type: "visit",
      date: "2026-06-11",
      title: "Visita manual",
      details: "dados antigos"
    }, token);
    // VisitCreateSchema requires dataVisita/turno/tipoVisita/motivosVisita/desfecho → 400
    const pass = rRes.status === 400;
    record("Smoke 4 — type=visit com payload RecordCreateSchema retorna 400 (strict)", pass,
      { status: rRes.status, error: rRes.json?.error, details: rRes.json?.details });
  }
}

// ============================================================
// Smoke 5 — F5-03: non-visit type still works with RecordCreateSchema
// ============================================================
{
  if (!patientId) {
    record("Smoke 5 — type=note ainda usa RecordCreateSchema", false, { error: "no patientId" });
  } else {
    const rRes = await post(`/patients/${patientId}/records`, {
      type: "note",
      date: "2026-06-11",
      title: "Observação clínica"
    }, token);
    const pass = rRes.status === 201 && rRes.json?.type === "note";
    record("Smoke 5 — type=note retorna HTTP 201 (RecordCreateSchema)", pass,
      { status: rRes.status, type: rRes.json?.type, error: rRes.json?.error });
  }
}

// ============================================================
// Smoke 6 — F5-06: seed maritalStatus usa valores canônicos uppercase
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const seedPath = new URL("../src/utils/seed.js", import.meta.url);
  const content = readFileSync(fileURLToPath(seedPath), "utf8");
  const hasLowercase = content.includes('"solteiro"') || content.includes('"casado"') ||
    content.includes('"divorciado"') || content.includes('"viuvo"') || content.includes('"uniao_estavel"');
  const hasCanonical = content.includes('"SOLTEIRO"') && content.includes('"CASADO"') &&
    content.includes('"DIVORCIADO"') && content.includes('"VIUVO"') && content.includes('"UNIAO_ESTAVEL"');
  const pass = !hasLowercase && hasCanonical;
  record("Smoke 6 — F5-06: seed maritalStatus canonical uppercase, sem lowercase", pass,
    { hasLowercase, hasCanonical });
}

// ============================================================
// Smoke 7 — Regressão Deploy 4B
// ============================================================
const backendDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
{
  const r = spawnSync("node", ["test/smoke-deploy4b.mjs"], { cwd: backendDir, encoding: "utf8", timeout: 180000, shell: true });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = r.status === 0 && out.includes("APPROVED FOR DEPLOY 4B") && out.includes("8/8 PASS");
  record("Smoke 7 — Regressão Deploy 4B (8/8 PASS)", pass,
    { exitCode: r.status, lastLines: out.split("\n").filter(Boolean).slice(-4).join(" | ") });
}

// ============================================================
// Smoke 8 — Phase 5 COMPLETE: all 4 deploys pass
// ============================================================
{
  const r4a = spawnSync("node", ["test/smoke-deploy4a.mjs"], { cwd: backendDir, encoding: "utf8", timeout: 180000, shell: true });
  const out4a = (r4a.stdout || "") + (r4a.stderr || "");
  const pass4a = r4a.status === 0 && out4a.includes("APPROVED FOR DEPLOY 4A") && out4a.includes("8/8 PASS");
  record("Smoke 8a — Phase 5: Deploy 4A still PASS", pass4a,
    { exitCode: r4a.status, lastLines: out4a.split("\n").filter(Boolean).slice(-3).join(" | ") });
}

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 4C — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 4C — PHASE 5 COMPLETE" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
