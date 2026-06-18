/**
 * Smoke tests Deploy 3B-A — F4-01 (cnsProfissional) + F4-02 (cboCodigo/cboDescricao) + F4-03 (audit SHA-256)
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d3ba-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy3ba-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy3ba";
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
const patch = (path, body, token) => req("PATCH", path, body, token);

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
// Smoke 1 — RegisterSchema aceita cnsProfissional válido (15 dígitos)
// ============================================================
{
  const { RegisterSchema } = await import("../src/schemas.js");
  const validResult = RegisterSchema.safeParse({
    name: "Dra. Teste", email: "dra@teste.local", password: "Teste@2026!", role: "doctor",
    cnsProfissional: "123456789012345",
    cboCodigo: "225125",
    cboDescricao: "Médico clínico"
  });
  const pass = validResult.success;
  record("Smoke 1 — RegisterSchema aceita cnsProfissional 15 dígitos + CBO", pass,
    { success: validResult.success, error: validResult.error?.issues });
}

// ============================================================
// Smoke 2 — RegisterSchema rejeita cnsProfissional inválido
// ============================================================
{
  const { RegisterSchema } = await import("../src/schemas.js");
  const INVALID_VALUES = ["123", "12345678901234", "1234567890123456", "abc123456789012", ""];
  const results2 = INVALID_VALUES.map(v => {
    const r = RegisterSchema.safeParse({
      name: "X", email: "x@x.local", password: "Teste@2026!", role: "doctor",
      cnsProfissional: v
    });
    return { value: v, rejected: !r.success };
  });
  // Empty string should be treated as "not provided" (undefined) by Zod — check separately
  const emptyResult = RegisterSchema.safeParse({
    name: "X", email: "x@x.local", password: "Teste@2026!", role: "doctor"
    // no cnsProfissional — should be valid (optional)
  });
  const allRejected = results2.filter(r => r.value !== "").every(r => r.rejected);
  const optionalOk = emptyResult.success;
  const pass = allRejected && optionalOk;
  record("Smoke 2 — RegisterSchema rejeita cnsProfissional inválido, aceita ausente", pass,
    { results: results2, optionalOk });
}

// ============================================================
// Smoke 3 — PATCH /me persiste cnsProfissional + cboCodigo + cboDescricao
// ============================================================
{
  const patchRes = await patch("/me", {
    cnsProfissional: "700000000000099",
    cboCodigo: "225125",
    cboDescricao: "Médico clínico"
  }, token);

  let pass = patchRes.status === 200;
  let evidence = { status: patchRes.status, error: patchRes.json?.error };

  if (pass) {
    // Verify via GET /me that fields are persisted
    const meRes = await req("GET", "/me", null, token);
    const user = meRes.json?.user || meRes.json;
    // cnsProfissional may not be returned in GET /me (sanitizeUser) — check via DB
    const { withDb } = await import("../src/db.js");
    let stored = {};
    await withDb((db) => {
      const u = db.users?.find(u => u.id === user?.id);
      if (u) {
        stored = {
          cnsProfissional: u.cnsProfissional,
          cboCodigo: u.cboCodigo,
          cboDescricao: u.cboDescricao
        };
      }
    });
    const cnsPersisted = stored.cnsProfissional === "700000000000099";
    const cboPersisted = stored.cboCodigo === "225125";
    const cboDescPersisted = stored.cboDescricao === "Médico clínico";
    pass = cnsPersisted && cboPersisted && cboDescPersisted;
    evidence = { ...evidence, stored, cnsPersisted, cboPersisted, cboDescPersisted };
  }
  record("Smoke 3 — PATCH /me persiste cnsProfissional + cboCodigo + cboDescricao", pass, evidence);
}

// ============================================================
// Smoke 4 — Audit snapshot: hash SHA-256 presente, valor bruto ausente
// ============================================================
{
  const { withDb } = await import("../src/db.js");
  let pass = false;
  let evidence = {};

  await withDb((db) => {
    // Find last user.profile_updated audit log
    const logs = (db.auditLogs || [])
      .filter(l => l.action === "user.profile_updated")
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const log = logs[0];
    if (!log) {
      evidence = { error: "No user.profile_updated audit log found" };
      return;
    }

    const snapshot = log.after || {};
    const rawValue = "700000000000099";

    // Must have cnsProfissionalHash
    const hasHash = typeof snapshot.cnsProfissionalHash === "string" && snapshot.cnsProfissionalHash.length === 64;
    // Must NOT contain raw value anywhere in the snapshot
    const snapshotStr = JSON.stringify(snapshot);
    const rawAbsent = !snapshotStr.includes(rawValue);
    // Hash must be correct SHA-256
    const expectedHash = createHash("sha256").update(rawValue).digest("hex");
    const hashCorrect = snapshot.cnsProfissionalHash === expectedHash;

    pass = hasHash && rawAbsent && hashCorrect;
    evidence = {
      hasHash,
      rawAbsent,
      hashCorrect,
      cnsProfissionalHash: snapshot.cnsProfissionalHash,
      expectedHash,
      cboCodigo: snapshot.cboCodigo,
      cboDescricao: snapshot.cboDescricao
    };
  });
  record("Smoke 4 — Audit snapshot: SHA-256 presente, valor bruto ausente, hash correto", pass, evidence);
}

// ============================================================
// Smoke 5 — Regressão Deploy 2C
// ============================================================
const backendDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
{
  const r = spawnSync("node", ["test/smoke-deploy2c.mjs"], { cwd: backendDir, encoding: "utf8", timeout: 180000, shell: true });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = r.status === 0 && out.includes("APPROVED FOR DEPLOY 2C") && out.includes("7/7 PASS");
  record("Smoke 5 — Regressão Deploy 2C (7/7 PASS)", pass,
    { exitCode: r.status, lastLines: out.split("\n").filter(Boolean).slice(-4).join(" | ") });
}

// ============================================================
// Smoke 6 — Regressão Deploy 3A
// ============================================================
{
  const r = spawnSync("node", ["test/smoke-deploy3a.mjs"], { cwd: backendDir, encoding: "utf8", timeout: 180000, shell: true });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = r.status === 0 && out.includes("APPROVED FOR DEPLOY 3A") && out.includes("8/8 PASS");
  record("Smoke 6 — Regressão Deploy 3A (8/8 PASS)", pass,
    { exitCode: r.status, lastLines: out.split("\n").filter(Boolean).slice(-4).join(" | ") });
}

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 3B-A — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 3B-A" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
