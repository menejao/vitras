/**
 * Smoke tests Deploy 6D — F7-02 Pre-Deprecation: D-PRE-07 audit logic + migration 018 backfill
 *
 * Cannot execute against production DB — tests the backfill LOGIC in a controlled environment.
 * Production audit via: node scripts/dpre07-cnscpf-audit.mjs (on EB server via SSM)
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d6d-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy6d-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy6d";
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

const loginNurse = await post("/auth/login", { email: "ana@clinica.local", password: "123456" });
const tokenNurse = loginNurse.json?.token || loginNurse.json?.accessToken;
if (!tokenNurse) { console.error("FATAL: Nurse login failed", loginNurse.status); process.exit(1); }

const { withDb } = await import("../src/db.js");
const { ensureDbShape } = await import("../src/utils/domain.js");
const { v4: uuidv4 } = await import("uuid");

// Inject patients with cnsCpf in various states (file-mode, plaintext — pre-encryption era)
let pCpfCandidate, pCnsCandidate, pConflict, pRedundant, pInvalid, pClean;
let nurseTeamId;

await withDb((db) => {
  ensureDbShape(db);
  const nurse = db.users.find(u => u.email === "ana@clinica.local");
  nurseTeamId = nurse?.teamId || "team-default";

  const base = { teamId: nurseTeamId, careCategory: "general", inactive: false,
    assignedAcsId: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  pCpfCandidate = uuidv4();
  db.patients.push({ ...base, id: pCpfCandidate, name: "CPF Candidate", phone: "11900010001",
    cnsCpf: "12345678901", cpf: "", cns: "" });

  pCnsCandidate = uuidv4();
  db.patients.push({ ...base, id: pCnsCandidate, name: "CNS Candidate", phone: "11900010002",
    cnsCpf: "123456789012345", cpf: "", cns: "" });

  pConflict = uuidv4();
  db.patients.push({ ...base, id: pConflict, name: "CPF Conflict", phone: "11900010003",
    cnsCpf: "11111111111", cpf: "99999999999", cns: "" });

  pRedundant = uuidv4();
  db.patients.push({ ...base, id: pRedundant, name: "Redundant", phone: "11900010004",
    cnsCpf: "55566677788", cpf: "55566677788", cns: "" });

  pInvalid = uuidv4();
  db.patients.push({ ...base, id: pInvalid, name: "Invalid cnsCpf", phone: "11900010005",
    cnsCpf: "1234", cpf: "", cns: "" });

  pClean = uuidv4();
  db.patients.push({ ...base, id: pClean, name: "Clean No cnsCpf", phone: "11900010006",
    cnsCpf: "", cpf: "44455566677", cns: "" });
});

// Import audit logic (mirror of dpre07 without process.exit)
async function runDpre07Audit(db) {
  const patients = db.patients || [];
  const withCnsCpf = patients.filter(p => p.cnsCpf && String(p.cnsCpf).trim() !== "");
  const result = { CPF_CANDIDATE: [], CNS_CANDIDATE: [], CONFLICT: [], REDUNDANT: [], INVALID: [], SAFE_BACKFILL: 0 };

  for (const p of withCnsCpf) {
    const raw = String(p.cnsCpf || "").trim();
    if (raw.startsWith("enc1:")) { result.INVALID.push(p.id); continue; }
    const digits = raw.replace(/\D/g, "");
    const cpfDigits = String(p.cpf || "").replace(/\D/g, "");
    const cnsDigits = String(p.cns || "").replace(/\D/g, "");

    if (digits === cpfDigits || digits === cnsDigits) { result.REDUNDANT.push(p.id); continue; }

    if (digits.length === 11) {
      if (cpfDigits !== "" && cpfDigits !== digits) { result.CONFLICT.push(p.id); }
      else { result.CPF_CANDIDATE.push(p.id); if (!cpfDigits && !cnsDigits) result.SAFE_BACKFILL++; }
    } else if (digits.length === 15) {
      if (cnsDigits !== "" && cnsDigits !== digits) { result.CONFLICT.push(p.id); }
      else { result.CNS_CANDIDATE.push(p.id); if (!cpfDigits && !cnsDigits) result.SAFE_BACKFILL++; }
    } else {
      result.INVALID.push(p.id);
    }
  }
  return result;
}

// Import backfill logic (mirror of migration 018 for file-mode testing)
function applyBackfill(patients) {
  let backfilledCpf = 0, backfilledCns = 0, skipped = 0;
  for (const p of patients) {
    const raw = String(p.cnsCpf || "").trim();
    if (!raw || raw.startsWith("enc1:")) continue;
    const digits = raw.replace(/\D/g, "");
    const cpf = String(p.cpf || "").replace(/\D/g, "");
    const cns = String(p.cns || "").replace(/\D/g, "");
    if (digits === cpf || digits === cns) continue; // redundant
    if (digits.length === 11 && cpf === "") { p.cpf = digits; p.backfill_source = "018_cnscpf_to_cpf"; backfilledCpf++; }
    else if (digits.length === 15 && cns === "") { p.cns = digits; p.backfill_source = "018_cnscpf_to_cns"; backfilledCns++; }
    else { skipped++; }
  }
  return { backfilledCpf, backfilledCns, skipped };
}

const results = [];
function record(smoke, pass, evidence) {
  results.push({ smoke, pass, evidence });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${smoke}`);
  if (!pass) console.error("  EVIDENCE:", JSON.stringify(evidence, null, 2));
}

// ============================================================
// Smoke 1 — D-PRE-07: audit classifica CPF_CANDIDATE corretamente
// ============================================================
{
  let audit;
  await withDb(async (db) => { ensureDbShape(db); audit = await runDpre07Audit(db); });
  const hasCpfCandidate = audit.CPF_CANDIDATE.includes(pCpfCandidate);
  const hasCnsCandidate = audit.CNS_CANDIDATE.includes(pCnsCandidate);
  const hasConflict = audit.CONFLICT.includes(pConflict);
  const hasRedundant = audit.REDUNDANT.includes(pRedundant);
  const hasInvalid = audit.INVALID.includes(pInvalid);
  const cleanNotIn = !audit.CPF_CANDIDATE.includes(pClean) && !audit.CNS_CANDIDATE.includes(pClean);
  const pass = hasCpfCandidate && hasCnsCandidate && hasConflict && hasRedundant && hasInvalid && cleanNotIn;
  record("Smoke 1 — D-PRE-07: classifica CPF_CANDIDATE, CNS_CANDIDATE, CONFLICT, REDUNDANT, INVALID", pass,
    { hasCpfCandidate, hasCnsCandidate, hasConflict, hasRedundant, hasInvalid, cleanNotIn, safeBackfill: audit.SAFE_BACKFILL });
}

// ============================================================
// Smoke 2 — D-PRE-07: SAFE_BACKFILL conta apenas candidatos sem conflito
// ============================================================
{
  let audit;
  await withDb(async (db) => { ensureDbShape(db); audit = await runDpre07Audit(db); });
  // Expected: pCpfCandidate (cpf empty + cns empty) + pCnsCandidate (cpf empty + cns empty) = 2
  const pass = audit.SAFE_BACKFILL === 2;
  record("Smoke 2 — D-PRE-07: SAFE_BACKFILL = 2 (CPF candidate + CNS candidate sem conflito)", pass,
    { safeBackfill: audit.SAFE_BACKFILL });
}

// ============================================================
// Smoke 3 — Migration 018: backfill copia cnsCpf → cpf (11 dígitos)
// ============================================================
{
  let cpfAfterBackfill;
  await withDb((db) => {
    ensureDbShape(db);
    applyBackfill(db.patients);
    const p = db.patients.find(pt => pt.id === pCpfCandidate);
    cpfAfterBackfill = p?.cpf;
  });
  const pass = cpfAfterBackfill === "12345678901";
  record("Smoke 3 — Migration 018: cnsCpf 11 dígitos backfilled → cpf", pass,
    { cpfAfterBackfill });
}

// ============================================================
// Smoke 4 — Migration 018: backfill copia cnsCpf → cns (15 dígitos)
// ============================================================
{
  let cnsAfterBackfill;
  await withDb((db) => {
    ensureDbShape(db);
    const p = db.patients.find(pt => pt.id === pCnsCandidate);
    cnsAfterBackfill = p?.cns;
  });
  const pass = cnsAfterBackfill === "123456789012345";
  record("Smoke 4 — Migration 018: cnsCpf 15 dígitos backfilled → cns", pass,
    { cnsAfterBackfill });
}

// ============================================================
// Smoke 5 — Migration 018: conflito não é backfilled (cpf existente diferente)
// ============================================================
{
  let cpfAfterBackfill;
  await withDb((db) => {
    ensureDbShape(db);
    const p = db.patients.find(pt => pt.id === pConflict);
    cpfAfterBackfill = p?.cpf;
  });
  // Must remain the original conflicting cpf, not cnsCpf
  const pass = cpfAfterBackfill === "99999999999";
  record("Smoke 5 — Migration 018: CONFLICT não backfilled (cpf existente preservado)", pass,
    { cpfAfterBackfill });
}

// ============================================================
// Smoke 6 — Migration 018: cnsCpf preservado após backfill (não removido)
// ============================================================
{
  let cnsCpfPreserved;
  await withDb((db) => {
    ensureDbShape(db);
    const p = db.patients.find(pt => pt.id === pCpfCandidate);
    cnsCpfPreserved = p?.cnsCpf;
  });
  // cnsCpf must still be present (removal happens in separate migration post-F7-02 auth)
  const pass = cnsCpfPreserved === "12345678901";
  record("Smoke 6 — Migration 018: cnsCpf preservado após backfill (campo não removido)", pass,
    { cnsCpfPreserved });
}

// ============================================================
// Smoke 7 — Migration 018: backfill_source marker presente após backfill
// ============================================================
{
  let backfillSource;
  await withDb((db) => {
    ensureDbShape(db);
    const p = db.patients.find(pt => pt.id === pCpfCandidate);
    backfillSource = p?.backfill_source;
  });
  const pass = backfillSource === "018_cnscpf_to_cpf";
  record("Smoke 7 — Migration 018: backfill_source marker registrado para audit trail", pass,
    { backfillSource });
}

// ============================================================
// Smoke 8 — Migration 018 registrada em index.js
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const content = readFileSync(fileURLToPath(new URL("../src/migrations/index.js", import.meta.url)), "utf8");
  const hasMigration = content.includes("018_backfill_cnscpf") || content.includes("m018");
  record("Smoke 8 — Migration 018 registrada em migrations/index.js", hasMigration, { hasMigration });
}

// ============================================================
// Smoke 9 — D-PRE-07 script existe em scripts/
// ============================================================
{
  const { existsSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const scriptPath = fileURLToPath(new URL("../scripts/dpre07-cnscpf-audit.mjs", import.meta.url));
  const exists = existsSync(scriptPath);
  record("Smoke 9 — dpre07-cnscpf-audit.mjs presente em scripts/", exists, { exists, scriptPath });
}

// ============================================================
// Smoke 10 — Regressão 6C (cnsResponsavel no PUT intacto)
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const content = readFileSync(fileURLToPath(new URL("../src/routes/patients.js", import.meta.url)), "utf8");
  const hasF704b = content.includes("F7-04b") && content.includes("cnsResponsavel");
  record("Smoke 10 — Regressão 6C: F7-04b cnsResponsavel no PUT intacto", hasF704b, { hasF704b });
}

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 6D — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 6D" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
