/**
 * Smoke tests Deploy 2B — F2-01 + F2-02 + F2-03 + F2-06
 * Isolated temp DB, no permanent side effects.
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d2b-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy2b-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy2b";
process.env.TEST_DB_PATH = tmpDb;

process.on("exit", () => { try { rmSync(tmpDir, { recursive: true }); } catch {} });

const { default: app } = await import("../src/app.js");
const { normalizeJsonDb, validateEnums } = await import("../scripts/normalize-enums.mjs");

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
const put = (path, body, token) => req("PUT", path, body, token);

async function getPatientById(id, token) {
  const r = await req("GET", "/patients", null, token);
  if (r.status !== 200 || !Array.isArray(r.json)) return null;
  return r.json.find((p) => p.id === id) || null;
}

const loginRes = await post("/auth/login", { email: "ana@clinica.local", password: "123456" });
const token = loginRes.json?.token || loginRes.json?.accessToken;
if (!token) { console.error("FATAL: Login failed", loginRes.status, loginRes.json); process.exit(1); }

const results = [];
function record(smoke, pass, evidence, risco = "CRITICAL") {
  results.push({ smoke, pass, evidence, risco });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${smoke}`);
  if (!pass) console.error("  EVIDENCE:", JSON.stringify(evidence, null, 2));
}

// ============================================================
// Smoke 1 — Pré-condição: scripts normalization + validação 0 fora do enum
// Inject patients with old enum values → run normalization → verify 0 non-canonical
// ============================================================
{
  const { withDb } = await import("../src/db.js");
  const { ensureDbShape } = await import("../src/utils/domain.js");

  // Inject patients with old-style values directly to DB (bypass schema validation)
  await withDb((db) => {
    ensureDbShape(db);
    const team = db.teams?.[0];
    db.patients.push(
      { id: "norm-test-1", teamId: team?.id || "t1", name: "Norm Test 1", phone: "1199", sexAtBirth: "feminino", maritalStatus: "solteira", racaCor: "parda" },
      { id: "norm-test-2", teamId: team?.id || "t1", name: "Norm Test 2", phone: "1199", sexAtBirth: "masculino", maritalStatus: "casado", racaCor: "BRANCA" },
      { id: "norm-test-3", teamId: team?.id || "t1", name: "Norm Test 3", phone: "1199", sexAtBirth: "F", maritalStatus: "SOLTEIRO", racaCor: "" },
    );
  });

  // Run normalization (pre-condition script)
  const normResult = normalizeJsonDb(tmpDb);

  // Read DB and validate
  const rawDb = JSON.parse(readFileSync(tmpDb, "utf8"));
  const issues = validateEnums(rawDb.patients || []);

  const pass = issues.length === 0 && normResult.stats.sexAtBirth >= 2 && normResult.stats.maritalStatus >= 2 && normResult.stats.racaCor >= 1;
  record("Smoke 1 — Normalização executada + 0 valores fora do enum", pass, {
    normResult, issues,
    patientsAfterNorm: rawDb.patients?.filter(p => ["norm-test-1","norm-test-2","norm-test-3"].includes(p.id)).map(p => ({ id: p.id, sexAtBirth: p.sexAtBirth, maritalStatus: p.maritalStatus, racaCor: p.racaCor }))
  });
}

// ============================================================
// Smoke 2 — POST com campos F2-01 completos
// ============================================================
const s2Payload = {
  name: "Paciente Smoke 2B S2",
  phone: "(11)98000-0021",
  careCategory: "general",
  motherName: "Mãe Smoke 2B",
  sexAtBirth: "F",
  maritalStatus: "CASADO",
  racaCor: "PARDA",
  etnia: "nao_informada",
  nacionalidade: "brasileira",
  municipioNascimentoIbge: "3550308",
  situacaoMercadoTrabalho: "empregado",
  rendaFamiliar: "1_2_salarios",
  responsavelFamiliar: "Ana Maria",
  cep: "14020-000",
};

const s2 = await post("/patients", s2Payload, token);
const s2Pass = s2.status === 201 || s2.status === 200;
const s2Id = s2.json?.id;
let s2Evidence = { status: s2.status, error: s2.json?.error };

if (s2Id) {
  const p = await getPatientById(s2Id, token);
  const checks = {
    sexAtBirth: p?.sexAtBirth === "F",
    maritalStatus: p?.maritalStatus === "CASADO",
    racaCor: p?.racaCor === "PARDA",
    etnia: p?.etnia === "nao_informada",
    nacionalidade: p?.nacionalidade === "brasileira",
    municipioNascimentoIbge: p?.municipioNascimentoIbge === "3550308",
    situacaoMercadoTrabalho: p?.situacaoMercadoTrabalho === "empregado",
    rendaFamiliar: p?.rendaFamiliar === "1_2_salarios",
    responsavelFamiliar: p?.responsavelFamiliar === "Ana Maria",
    // F2-06: CEP normalizado
    cep: p?.cep === "14020000",
  };
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  s2Evidence = { status: s2.status, failed, values: Object.fromEntries(Object.keys(checks).map(k => [k, p?.[k]])) };
  record("Smoke 2 — POST F2-01 campos completos + persistência", failed.length === 0, s2Evidence);
} else {
  record("Smoke 2 — POST F2-01 campos completos + persistência", false, s2Evidence);
}

// ============================================================
// Smoke 3 — PUT com enums válidos (M/F/I, SOLTEIRO, PRETA)
// ============================================================
let s3Pass = false;
let s3Evidence = {};
if (s2Id) {
  const s3 = await put(`/patients/${s2Id}`, {
    sexAtBirth: "M",
    maritalStatus: "DIVORCIADO",
    racaCor: "PRETA",
  }, token);
  if (s3.status === 200) {
    const p = await getPatientById(s2Id, token);
    const checks = {
      sexAtBirth: p?.sexAtBirth === "M",
      maritalStatus: p?.maritalStatus === "DIVORCIADO",
      racaCor: p?.racaCor === "PRETA",
    };
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    s3Pass = failed.length === 0;
    s3Evidence = { status: s3.status, failed, values: { sexAtBirth: p?.sexAtBirth, maritalStatus: p?.maritalStatus, racaCor: p?.racaCor } };
  } else {
    s3Evidence = { status: s3.status, error: s3.json?.error };
  }
} else { s3Evidence = { error: "No patient ID from Smoke 2" }; }
record("Smoke 3 — PUT com enums válidos aceitos", s3Pass, s3Evidence);

// ============================================================
// Smoke 4 — PUT com enum inválido — rejeição 400
// ============================================================
let s4Pass = false;
let s4Evidence = {};
if (s2Id) {
  const cases = [
    { sexAtBirth: "female" },
    { maritalStatus: "casado" },
    { racaCor: "parda" },
  ];
  const rejectResults = await Promise.all(
    cases.map(payload => put(`/patients/${s2Id}`, payload, token))
  );
  const allRejected = rejectResults.every(r => r.status === 400);
  s4Pass = allRejected;
  s4Evidence = rejectResults.map((r, i) => ({ payload: cases[i], status: r.status, error: r.json?.error }));
} else { s4Evidence = { error: "No patient ID from Smoke 2" }; }
record("Smoke 4 — PUT com enum inválido rejeitado (400)", s4Pass, s4Evidence);

// ============================================================
// Smoke 5 — CEP com hífen → normalizado para 8 dígitos
// ============================================================
let s5Pass = false;
let s5Evidence = {};
{
  const s5 = await post("/patients", {
    name: "Paciente Smoke 2B S5",
    phone: "(11)98000-0025",
    careCategory: "general",
    motherName: "Mãe S5",
    cep: "14020-000",
  }, token);
  if (s5.status === 201 || s5.status === 200) {
    const p5 = await getPatientById(s5.json?.id, token);
    s5Pass = p5?.cep === "14020000";
    s5Evidence = { sent: "14020-000", stored: p5?.cep, expected: "14020000" };
  } else {
    s5Evidence = { status: s5.status, error: s5.json?.error };
  }
}
record("Smoke 5 — CEP com hífen normalizado para 8 dígitos", s5Pass, s5Evidence);

// ============================================================
// Smoke 6 — Regressão Deploy 1 (sub-processo via shell)
// ============================================================
import { spawnSync } from "node:child_process";
const backendDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

let s6Pass = false;
let s6Evidence = {};
{
  const r = spawnSync("node", ["test/smoke-deploy1.mjs"], {
    cwd: backendDir,
    encoding: "utf8",
    timeout: 60000,
    shell: true,
  });
  const out = (r.stdout || "") + (r.stderr || "");
  s6Pass = r.status === 0 && out.includes("APPROVED FOR DEPLOY") && out.includes("6/6 PASS");
  s6Evidence = { exitCode: r.status, lastLines: out.split("\n").filter(Boolean).slice(-4).join(" | ") };
}
record("Smoke 6 — Regressão Deploy 1 (6/6 PASS)", s6Pass, s6Evidence);

// ============================================================
// Smoke 7 — Regressão Deploy 2A (sub-processo via shell)
// ============================================================
let s7Pass = false;
let s7Evidence = {};
{
  const r = spawnSync("node", ["test/smoke-deploy2a.mjs"], {
    cwd: backendDir,
    encoding: "utf8",
    timeout: 60000,
    shell: true,
  });
  const out = (r.stdout || "") + (r.stderr || "");
  s7Pass = r.status === 0 && out.includes("APPROVED FOR DEPLOY 2A") && out.includes("5/5 PASS");
  s7Evidence = { exitCode: r.status, lastLines: out.split("\n").filter(Boolean).slice(-4).join(" | ") };
}
record("Smoke 7 — Regressão Deploy 2A (5/5 PASS)", s7Pass, s7Evidence);

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 2B — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 2B" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
