/**
 * Smoke tests Deploy 6C — F7-04b: cnsResponsavel persistido no PUT /patients/:id
 *                         F7-03:  CNES validação 7 dígitos (já implementado — evidência)
 *                         F7-04:  CNS profissional 15 dígitos (já implementado — evidência)
 * Regressão 6A + 6B inline
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d6c-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy6c-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32bytes-pads!";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy6c";
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
const patch = (path, body, token) => req("PATCH", path, body, token);

// Nurse login
const loginNurse = await post("/auth/login", { email: "ana@clinica.local", password: "123456" });
const tokenNurse = loginNurse.json?.token || loginNurse.json?.accessToken;
if (!tokenNurse) { console.error("FATAL: Nurse login failed", loginNurse.status, loginNurse.json); process.exit(1); }

// Create patient
const createRes = await post("/patients", {
  name: "Paciente 6C Test",
  phone: "11900004444",
  careCategory: "general"
}, tokenNurse);
if (createRes.status !== 201) { console.error("FATAL: Patient creation failed", createRes.status, createRes.json); process.exit(1); }
const patientId = createRes.json?.id;

const { withDb } = await import("../src/db.js");
const { ensureDbShape } = await import("../src/utils/domain.js");
const ENC_PREFIX = "enc1:";

const results = [];
function record(smoke, pass, evidence) {
  results.push({ smoke, pass, evidence });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${smoke}`);
  if (!pass) console.error("  EVIDENCE:", JSON.stringify(evidence, null, 2));
}

// ============================================================
// Smoke 1 — F7-04b: PUT /patients/:id persiste cnsResponsavel
// ============================================================
{
  const res = await put(`/patients/${patientId}`, {
    name: "Paciente 6C CNS Update",
    cnsResponsavel: "111222333000111"
  }, tokenNurse);

  const pass = res.status === 200;
  record("Smoke 1 — F7-04b: PUT /patients/:id com cnsResponsavel → 200", pass,
    { status: res.status, error: res.json?.error });
}

// ============================================================
// Smoke 2 — F7-04b: cnsResponsavel armazenado como ciphertext no arquivo após PUT
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const rawFile = readFileSync(tmpDb, "utf8");
  const plaintextInFile = rawFile.includes('"111222333000111"');
  const ciphertextInFile = rawFile.includes(ENC_PREFIX);
  const encrypted = ciphertextInFile && !plaintextInFile;
  record("Smoke 2 — F7-04b: cnsResponsavel ciphertext no arquivo após PUT", encrypted,
    { ciphertextInFile, plaintextInFile, encrypted });
}

// ============================================================
// Smoke 3 — F7-04b: PUT response retorna cnsResponsavel decriptado (nurse_manager autorizado)
// ============================================================
{
  const res = await put(`/patients/${patientId}`, {
    name: "Paciente 6C CNS Read"
  }, tokenNurse);
  const cns = res.json?.cnsResponsavel;
  const isDecrypted = cns === "111222333000111";
  const notCiphertext = typeof cns !== "string" || !cns.startsWith(ENC_PREFIX);
  const pass = res.status === 200 && isDecrypted && notCiphertext;
  record("Smoke 3 — F7-04b: PUT response retorna cnsResponsavel decriptado", pass,
    { status: res.status, cns, isDecrypted, notCiphertext });
}

// ============================================================
// Smoke 4 — F7-04b: cnsResponsavel preservado entre PUTs sem re-envio
// ============================================================
{
  // PUT without cnsResponsavel field — should keep existing value
  const res = await put(`/patients/${patientId}`, {
    name: "Paciente 6C No CNS Field"
  }, tokenNurse);
  const cns = res.json?.cnsResponsavel;
  const preserved = cns === "111222333000111";
  record("Smoke 4 — F7-04b: cnsResponsavel preservado entre PUTs sem re-envio", preserved,
    { status: res.status, cns, preserved });
}

// ============================================================
// Smoke 5 — F7-04b: PUT com cnsResponsavel vazio limpa o campo
// ============================================================
{
  const res = await put(`/patients/${patientId}`, {
    name: "Paciente 6C CNS Clear",
    cnsResponsavel: ""
  }, tokenNurse);
  const cns = res.json?.cnsResponsavel;
  // After clearing, cnsResponsavel should be empty (or absent for unauthorized roles)
  const cleared = cns === "" || cns === undefined;
  const pass = res.status === 200 && cleared;
  record("Smoke 5 — F7-04b: PUT com cnsResponsavel vazio limpa o campo", pass,
    { status: res.status, cns, cleared });
}

// ============================================================
// Smoke 6 — F7-03: CNES validation (7 dígitos) — já implementado em schemas
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const content = readFileSync(fileURLToPath(new URL("../src/schemas.js", import.meta.url)), "utf8");
  const hasCnesRegex = content.includes('/^\\d{7}$/') || content.includes("d{7}");
  const hasCnesField = content.includes("optionalCnesField");
  const pass = hasCnesRegex && hasCnesField;
  record("Smoke 6 — F7-03: CNES validação 7 dígitos presente em schemas.js", pass,
    { hasCnesRegex, hasCnesField });
}

// ============================================================
// Smoke 7 — F7-04: CNS profissional 15 dígitos — já implementado em schemas
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const content = readFileSync(fileURLToPath(new URL("../src/schemas.js", import.meta.url)), "utf8");
  const hasCnsProfRegex = content.includes("cnsProfissional") && (content.includes("d{15}") || content.includes("15}"));
  const pass = hasCnsProfRegex;
  record("Smoke 7 — F7-04: CNS profissional 15 dígitos presente em schemas.js", pass,
    { hasCnsProfRegex });
}

// ============================================================
// Smoke 8 — Regressão 6B inline (SPECIAL_CATEGORY + cnsResponsavel AES no POST)
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const auditContent = readFileSync(fileURLToPath(new URL("../src/services/audit.js", import.meta.url)), "utf8");
  const hasRedact = auditContent.includes("redactSpecialCategory") && auditContent.includes("REDACTED-SPECIAL-CATEGORY");
  const dbContent = readFileSync(fileURLToPath(new URL("../src/db.js", import.meta.url)), "utf8");
  const hasCnsInSensitive = /SENSITIVE_PATIENT_FIELDS\s*=\s*\[([^\]]*)\]/.exec(dbContent)?.[1]?.includes("cnsResponsavel");
  const pass = hasRedact && !!hasCnsInSensitive;
  record("Smoke 8 — Regressão 6B: SPECIAL_CATEGORY masking + cnsResponsavel encrypt intactos", pass,
    { hasRedact, hasCnsInSensitive });
}

// ============================================================
// Smoke 9 — Regressão 6A (Household intacto)
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const content = readFileSync(fileURLToPath(new URL("../src/routes/households.js", import.meta.url)), "utf8");
  const pass = content.includes('"household.created"') && content.includes('"household.updated"') && content.includes("router.get");
  record("Smoke 9 — Regressão 6A: Household intacto", pass, {});
}

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 6C — SUMMARY ===");
const total = results.length;
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach(r => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 6C" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
