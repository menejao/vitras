/**
 * Smoke tests Deploy 3B-B1 — F4-05: INE + tipoEquipe (schema + PATCH /teams/:id)
 * No seed, no CNES, no migrations, no shadow column.
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d3bb1-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy3bb1-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy3bb1";
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

// Get team ID from DB
const { withDb } = await import("../src/db.js");
let teamId = null;
await withDb((db) => { teamId = db.teams?.[0]?.id || null; });
if (!teamId) { console.error("FATAL: No team in DB"); process.exit(1); }

const results = [];
function record(smoke, pass, evidence, risco = "CRITICAL") {
  results.push({ smoke, pass, evidence, risco });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${smoke}`);
  if (!pass) console.error("  EVIDENCE:", JSON.stringify(evidence, null, 2));
}

// ============================================================
// Smoke 1 — INE válido aceito pelo schema (10 dígitos)
// ============================================================
{
  const { TeamPatchSchema } = await import("../src/schemas.js");
  const VALID = ["1234567890", "0000000000", "9999999999"];
  const allOk = VALID.every(v => TeamPatchSchema.safeParse({ ine: v }).success);
  const optionalOk = TeamPatchSchema.safeParse({}).success; // ine optional
  const pass = allOk && optionalOk;
  record("Smoke 1 — Schema aceita INE 10 dígitos e ausente (opcional)", pass,
    { allOk, optionalOk, tested: VALID });
}

// ============================================================
// Smoke 2 — INE inválido rejeitado
// ============================================================
{
  const { TeamPatchSchema } = await import("../src/schemas.js");
  const INVALID = ["123", "12345678901", "ABCDEFGHIJ", "123456789a", "", "1234 56789"];
  const results2 = INVALID.map(v => ({
    value: v,
    rejected: !TeamPatchSchema.safeParse({ ine: v }).success
  }));
  // Empty string: Zod receives "" — should be rejected (regex requires 10 digits, "" fails)
  const allRejected = results2.every(r => r.rejected);
  record("Smoke 2 — Schema rejeita INE inválido (< 10, > 10, não-numérico, vazio)", allRejected,
    { results: results2 });
}

// ============================================================
// Smoke 3 — tipoEquipe válido aceito
// ============================================================
{
  const { TeamPatchSchema } = await import("../src/schemas.js");
  // F5-04: enum canônico e-SUS CDS v3.2 (atualizado Deploy 4A — EAP→EAPS, OUTRA→OUTROS)
  const VALID_TIPOS = ["ESF", "NASF", "CEO", "EMAP", "EMAD", "EAPS", "OUTROS"];
  const allOk = VALID_TIPOS.every(v => TeamPatchSchema.safeParse({ tipoEquipe: v }).success);
  const optionalOk = TeamPatchSchema.safeParse({}).success;
  record("Smoke 3 — Schema aceita todos os valores de tipoEquipe", allOk && optionalOk,
    { allOk, optionalOk, tested: VALID_TIPOS });
}

// ============================================================
// Smoke 4 — tipoEquipe inválido rejeitado
// ============================================================
{
  const { TeamPatchSchema } = await import("../src/schemas.js");
  const INVALID_TIPOS = ["esf", "Esf", "UBSF", "FMH", "eSF", ""];
  const results4 = INVALID_TIPOS.map(v => ({
    value: v,
    rejected: !TeamPatchSchema.safeParse({ tipoEquipe: v }).success
  }));
  const allRejected = results4.every(r => r.rejected);
  record("Smoke 4 — Schema rejeita tipoEquipe fora do enum", allRejected, { results: results4 });
}

// ============================================================
// Smoke 5 — PATCH /teams/:id persiste INE e tipoEquipe no JSONB
// ============================================================
{
  const patchRes = await patch(`/teams/${teamId}`, {
    ine: "7654321098",
    tipoEquipe: "ESF"
  }, token);

  let pass = patchRes.status === 200;
  let evidence = { status: patchRes.status, error: patchRes.json?.error };

  if (pass) {
    // Verify JSONB directly via withDb
    let stored = {};
    await withDb((db) => {
      const team = db.teams?.find(t => t.id === teamId);
      if (team) stored = { ine: team.ine, tipoEquipe: team.tipoEquipe };
    });
    const inePersisted = stored.ine === "7654321098";
    const tipoPersisted = stored.tipoEquipe === "ESF";
    pass = inePersisted && tipoPersisted;
    evidence = { ...evidence, stored, inePersisted, tipoPersisted };
  }
  record("Smoke 5 — PATCH /teams/:id persiste INE + tipoEquipe em JSONB", pass, evidence);
}

// ============================================================
// Smoke 6 — Regressão Deploy 3B-A (F4-01/F4-02/F4-03)
// ============================================================
const backendDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
{
  const r = spawnSync("node", ["test/smoke-deploy3b-a.mjs"], { cwd: backendDir, encoding: "utf8", timeout: 180000, shell: true });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = r.status === 0 && out.includes("APPROVED FOR DEPLOY 3B-A") && out.includes("6/6 PASS");
  record("Smoke 6 — Regressão Deploy 3B-A (6/6 PASS)", pass,
    { exitCode: r.status, lastLines: out.split("\n").filter(Boolean).slice(-4).join(" | ") });
}

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 3B-B1 — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 3B-B1" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
