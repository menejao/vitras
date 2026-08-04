/**
 * p0-login-normalization.test.mjs — P0-3: Login identifier normalization
 *
 * Verifica:
 * - [P0-3-A] Login via e-mail (case-insensitive)
 * - [P0-3-B] Login via e-mail com espaços extras no campo identifier
 * - [P0-3-C] Login via alias "email" (retrocompatibilidade)
 * - [P0-3-D] LoginSchema rejeita identifier vazio
 * - [P0-3-E] LoginSchema rejeita identifier muito longo (>255 chars)
 * - [P0-3-F] Senha nunca é normalizada — case-sensitive
 * - [P0-3-G] identifierNormalizer: normalizeEmail, normalizeCns, normalizeCpf
 * - [P0-3-H] identifierNormalizer: detectIdentifierType
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

// ── Isolated test environment ─────────────────────────────────────────────────
const _tmpDir = mkdtempSync(join(tmpdir(), "vitras-p03-test-"));
const _tmpDb = join(_tmpDir, "db.json");
writeFileSync(_tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-p03-jwt-secret-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "test-p03-enc-key-32-bytes-pad00x";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "test-p03-backup-key-for-integration-tests";
process.env.TEST_DB_PATH = _tmpDb;
if (!process.env.MUNICIPALITY_ID) process.env.MUNICIPALITY_ID = "3550308";

let _server = null;
let _base = null;

async function startServer() {
  if (_server) return _base;
  const { default: app } = await import("../src/app.js");
  _server = createServer(app);
  _server.unref();
  await new Promise((res, rej) => _server.listen(0, "127.0.0.1", e => e ? rej(e) : res()));
  _base = `http://127.0.0.1:${_server.address().port}`;
  return _base;
}

async function stopServer() {
  if (!_server) return;
  if (typeof _server.closeAllConnections === "function") _server.closeAllConnections();
  await new Promise(res => _server.close(res));
  _server = null;
  _base = null;
}

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${_base}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { }
  return { status: r.status, json, text };
}

const post = (path, body, token) => req("POST", path, body, token);

const stamp = Date.now();
const testEmail = `p03.user.${stamp}@VITRAS.TEST`; // uppercase — tests case-insensitive login
const testEmailLower = testEmail.toLowerCase();
const testPass = "LoginP03@Correct!";
const wrongPass = "WrongPassword!999";

describe("P0-3: Login identifier normalization", () => {
  before(async () => {
    await startServer();

    // Register a user with LOWERCASE email (as stored in DB)
    // unit-default is created automatically by ensureDbShape when no units exist
    const reg = await post("/auth/register", {
      name: "P03 Test User",
      email: testEmailLower, // stored lowercase
      password: testPass,
      role: "gestor",
      unitId: "unit-default",
      councilType: "CRM",
      councilNumber: `${stamp}`.slice(-6),
      councilUf: "SP"
    });
    assert.ok(
      reg.status === 201 || reg.status === 409,
      `Register failed: ${JSON.stringify(reg.json)}`
    );
  });

  after(stopServer);

  // ── [P0-3-A] Email login — case-insensitive ─────────────────────────────
  it("[P0-3-A] Login com e-mail em uppercase é aceito (case-insensitive)", async () => {
    const res = await post("/auth/login", {
      identifier: testEmail, // UPPERCASE
      password: testPass
    });
    if (res.status === 403 && res.json?.requiresTwoFactor) return; // 2FA skip
    assert.equal(
      res.status, 200,
      `Expected 200 for case-insensitive email login, got ${res.status}: ${JSON.stringify(res.json)}`
    );
    assert.ok(res.json?.token || res.json?.accessToken, "Token must be present in response");
  });

  // ── [P0-3-B] Email with leading/trailing spaces ─────────────────────────
  it("[P0-3-B] Login com e-mail com espaços extras no identifier é aceito", async () => {
    const res = await post("/auth/login", {
      identifier: `  ${testEmailLower}  `, // spaces around
      password: testPass
    });
    if (res.status === 403 && res.json?.requiresTwoFactor) return;
    assert.equal(
      res.status, 200,
      `Expected 200 for trimmed email login, got ${res.status}: ${JSON.stringify(res.json)}`
    );
  });

  // ── [P0-3-C] Legacy "email" field alias ─────────────────────────────────
  it("[P0-3-C] Login com campo 'email' (alias legado) funciona", async () => {
    const res = await post("/auth/login", {
      email: testEmailLower, // legacy field
      password: testPass
    });
    if (res.status === 403 && res.json?.requiresTwoFactor) return;
    assert.equal(
      res.status, 200,
      `Expected 200 with legacy 'email' field, got ${res.status}: ${JSON.stringify(res.json)}`
    );
  });

  // ── [P0-3-D] Empty identifier returns 400 ───────────────────────────────
  it("[P0-3-D] Login com identifier vazio retorna 400", async () => {
    const res = await post("/auth/login", {
      identifier: "",
      password: testPass
    });
    assert.equal(res.status, 400, `Expected 400 for empty identifier, got ${res.status}`);
  });

  // ── [P0-3-E] Very long identifier returns 400 ───────────────────────────
  it("[P0-3-E] Login com identifier >255 chars retorna 400", async () => {
    const longId = "a".repeat(256) + "@test.com";
    const res = await post("/auth/login", {
      identifier: longId,
      password: testPass
    });
    assert.equal(res.status, 400, `Expected 400 for too-long identifier, got ${res.status}`);
  });

  // ── [P0-3-F] Password is case-sensitive ─────────────────────────────────
  it("[P0-3-F] Senha é case-sensitive — password errado retorna 401", async () => {
    const res = await post("/auth/login", {
      identifier: testEmailLower,
      password: testPass.toLowerCase() // lowercase version of correct pass
    });
    // Must not return 200 if password is wrong (lowercase != original)
    if (testPass === testPass.toLowerCase()) {
      // If the password happens to be all lowercase, this test is a no-op
      console.warn("[P0-3-F] Skipping: test password is already lowercase");
      return;
    }
    assert.notEqual(
      res.status, 200,
      "Lowercase password should NOT match case-sensitive original password"
    );
  });

  it("[P0-3-F2] Senha correta funciona (baseline)", async () => {
    const res = await post("/auth/login", {
      identifier: testEmailLower,
      password: testPass
    });
    if (res.status === 403 && res.json?.requiresTwoFactor) return;
    assert.equal(res.status, 200, `Correct password must work, got ${res.status}`);
  });

  it("[P0-3-F3] Credenciais erradas retornam 401", async () => {
    const res = await post("/auth/login", {
      identifier: testEmailLower,
      password: wrongPass
    });
    assert.equal(res.status, 401, `Wrong password must return 401, got ${res.status}`);
  });

  // ── [P0-3-G] identifierNormalizer unit tests ────────────────────────────
  it("[P0-3-G] identifierNormalizer.normalizeEmail faz trim + lowercase", async () => {
    const { normalizeEmail } = await import("../src/services/identifierNormalizer.js");
    assert.equal(normalizeEmail("  Ana@UBS.br  "), "ana@ubs.br");
    assert.equal(normalizeEmail("USER@EXAMPLE.COM"), "user@example.com");
    assert.equal(normalizeEmail(""), "");
    assert.equal(normalizeEmail(null), "");
  });

  it("[P0-3-G2] identifierNormalizer.normalizeCns remove não-dígitos", async () => {
    const { normalizeCns } = await import("../src/services/identifierNormalizer.js");
    assert.equal(normalizeCns("147 852 036 985 412"), "147852036985412");
    assert.equal(normalizeCns("  147852036985412  "), "147852036985412");
    assert.equal(normalizeCns(""), "");
  });

  it("[P0-3-G3] identifierNormalizer.normalizeCpf remove não-dígitos", async () => {
    const { normalizeCpf } = await import("../src/services/identifierNormalizer.js");
    assert.equal(normalizeCpf("123.456.789-00"), "12345678900");
    assert.equal(normalizeCpf("  12345678900  "), "12345678900");
    assert.equal(normalizeCpf(""), "");
  });

  // ── [P0-3-H] detectIdentifierType ───────────────────────────────────────
  it("[P0-3-H] identifierNormalizer.detectIdentifierType identifica tipos", async () => {
    const { detectIdentifierType } = await import("../src/services/identifierNormalizer.js");
    assert.equal(detectIdentifierType("123456789"), "vitrasId");
    assert.equal(detectIdentifierType("user@ubs.br"), "email");
    assert.equal(detectIdentifierType("147852036985412"), "cns"); // 15 digits
    assert.equal(detectIdentifierType("12345678900"), "cpf");    // 11 digits
    assert.equal(detectIdentifierType("abc-unknown"), "unknown");
  });
});
