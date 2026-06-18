/**
 * Smoke tests Deploy 2C — F2-04 (genderIdentity enum) + F2-07 (cnsCpf @deprecated)
 * Isolated temp DB, no permanent side effects.
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d2c-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy2c-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy2c";
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

const GENDER_ENUM = ["HOMEM_CISSGENERO", "MULHER_CISSGENERO", "HOMEM_TRANSGENERO", "MULHER_TRANSGENERO", "NAO_BINARIO", "OUTRO", "NAO_INFORMADO"];

// ============================================================
// Smoke 1 — POST com genderIdentity válido
// ============================================================
let s1Id = null;
{
  const s1 = await post("/patients", {
    name: "Paciente Smoke 2C S1",
    phone: "(11)98000-0031",
    careCategory: "general",
    motherName: "Mãe S1",
    sexAtBirth: "F",
    genderIdentity: "MULHER_TRANS GENERO", // wrong first, use valid below
  }, token);

  // Actually use valid value
  const s1Valid = await post("/patients", {
    name: "Paciente Smoke 2C S1v",
    phone: "(11)98000-0031v",
    careCategory: "general",
    motherName: "Mãe S1v",
    sexAtBirth: "F",
    genderIdentity: "MULHER_CISSGENERO",
  }, token);

  s1Id = s1Valid.json?.id;
  let pass = s1Valid.status === 201 || s1Valid.status === 200;
  let evidence = { status: s1Valid.status, error: s1Valid.json?.error };

  if (s1Id) {
    const p = await getPatientById(s1Id, token);
    pass = pass && p?.genderIdentity === "MULHER_CISSGENERO";
    evidence = { ...evidence, stored: p?.genderIdentity, expected: "MULHER_CISSGENERO" };
  }
  record("Smoke 1 — POST genderIdentity válido (MULHER_CISSGENERO) persistido", pass, evidence);
}

// ============================================================
// Smoke 2 — POST com genderIdentity inválido → 400
// ============================================================
{
  const INVALID_VALUES = ["mulher_cis", "mulher_cisgenero", "female", "feminino", "trans"];
  const rejectResults = await Promise.all(
    INVALID_VALUES.map(v => post("/patients", {
      name: "Paciente Smoke 2C S2",
      phone: "(11)98000-0032",
      careCategory: "general",
      motherName: "Mãe S2",
      genderIdentity: v,
    }, token))
  );
  const allRejected = rejectResults.every(r => r.status === 400);
  record("Smoke 2 — POST genderIdentity inválido rejeitado (400)", allRejected,
    rejectResults.map((r, i) => ({ value: INVALID_VALUES[i], status: r.status })));
}

// ============================================================
// Smoke 3 — PUT com todos os valores do enum (canônico aceito)
// ============================================================
{
  let allPass = true;
  const evidence = [];
  for (const val of GENDER_ENUM) {
    if (!s1Id) { allPass = false; evidence.push({ val, error: "no patient" }); continue; }
    const r = await put(`/patients/${s1Id}`, { genderIdentity: val }, token);
    const p = r.status === 200 ? await getPatientById(s1Id, token) : null;
    const ok = r.status === 200 && p?.genderIdentity === val;
    if (!ok) allPass = false;
    evidence.push({ val, status: r.status, stored: p?.genderIdentity, ok });
  }
  record("Smoke 3 — PUT todos os 7 valores enum canônico aceitos", allPass, evidence);
}

// ============================================================
// Smoke 4 — anonymizePatientBundle remove genderIdentity
// ============================================================
{
  let s4Pass = false;
  let s4Evidence = {};
  if (s1Id) {
    const { withDb } = await import("../src/db.js");
    const { anonymizePatientBundle } = await import("../src/utils/patients.js");
    const fakeUser = { id: "smoke-2c-anon-user", role: "nurse_manager" };

    // Set a known genderIdentity first
    await put(`/patients/${s1Id}`, { genderIdentity: "NAO_BINARIO" }, token);

    const outcome = await withDb((db) => {
      const patient = db.patients?.find(p => p.id === s1Id);
      if (!patient) return { changed: false };
      return anonymizePatientBundle(db, fakeUser, patient, "smoke-2c-lgpd-test");
    });

    if (outcome?.changed) {
      const { readFileSync } = await import("node:fs");
      const { tmpDb: dbPath } = { tmpDb };
      // Read directly from DB after anonymize
      await withDb((db) => {
        const p = db.patients?.find(p => p.id === s1Id);
        s4Pass = p?.genderIdentity === "" || p?.genderIdentity === null || p?.genderIdentity === undefined;
        s4Evidence = { changed: true, genderIdentity: p?.genderIdentity, expected: "" };
      });
    } else {
      s4Evidence = { changed: false, note: "anonymizePatientBundle returned changed=false" };
    }
  } else {
    s4Evidence = { error: "No patient from Smoke 1" };
  }
  record("Smoke 4 — anonymizePatientBundle remove genderIdentity (SPECIAL_CATEGORY)", s4Pass, s4Evidence);
}

// ============================================================
// Smoke 5 — cnsCpf leitura/escrita/compatibilidade (@deprecated)
// ============================================================
{
  const s5 = await post("/patients", {
    name: "Paciente Smoke 2C S5",
    phone: "(11)98000-0035",
    careCategory: "general",
    motherName: "Mãe S5",
    cnsCpf: "700000000000055",
  }, token);

  let s5Pass = false;
  let s5Evidence = { status: s5.status };

  if (s5.status === 201 || s5.status === 200) {
    const s5Id = s5.json?.id;
    const p = await getPatientById(s5Id, token);
    // cnsCpf is masked in GET response (maskSensitivePatientFields); verify field present (not absent)
    const readOk = "cnsCpf" in (p || {});

    // PUT still accepts cnsCpf (write compatibility)
    const s5Put = s5Id ? await put(`/patients/${s5Id}`, { cnsCpf: "700000000000056" }, token) : null;
    const writeOk = s5Put?.status === 200;

    // Verify raw DB has the written value (bypassing mask)
    const { withDb } = await import("../src/db.js");
    let rawCnsCpf = null;
    await withDb((db) => {
      const raw = db.patients?.find(pp => pp.id === s5Id);
      rawCnsCpf = raw?.cnsCpf;
    });
    const rawOk = rawCnsCpf === "700000000000056";

    s5Pass = readOk && writeOk && rawOk;
    s5Evidence = { status: s5.status, fieldPresentInGet: readOk, maskedValue: p?.cnsCpf, putStatus: s5Put?.status, rawCnsCpf, rawOk };
  }
  record("Smoke 5 — cnsCpf @deprecated: leitura + escrita preservadas", s5Pass, s5Evidence);
}

// ============================================================
// Smoke 6 — Regressão Deploy 2A
// ============================================================
const backendDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
{
  const r = spawnSync("node", ["test/smoke-deploy2a.mjs"], { cwd: backendDir, encoding: "utf8", timeout: 60000, shell: true });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = r.status === 0 && out.includes("APPROVED FOR DEPLOY 2A") && out.includes("5/5 PASS");
  record("Smoke 6 — Regressão Deploy 2A (5/5 PASS)", pass,
    { exitCode: r.status, lastLines: out.split("\n").filter(Boolean).slice(-4).join(" | ") });
}

// ============================================================
// Smoke 7 — Regressão Deploy 2B
// ============================================================
{
  const r = spawnSync("node", ["test/smoke-deploy2b.mjs"], { cwd: backendDir, encoding: "utf8", timeout: 120000, shell: true });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = r.status === 0 && out.includes("APPROVED FOR DEPLOY 2B") && out.includes("7/7 PASS");
  record("Smoke 7 — Regressão Deploy 2B (7/7 PASS)", pass,
    { exitCode: r.status, lastLines: out.split("\n").filter(Boolean).slice(-4).join(" | ") });
}

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 2C — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 2C — PHASE 2 COMPLETE" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
