#!/usr/bin/env node
/**
 * Production smoke tests for SaudeUbs/SIGUS.
 *
 * Usage:
 *   node scripts/smoke-production.js --base https://api.saudeubs.com.br
 *   node scripts/smoke-production.js --base http://localhost:3001
 *
 * Optional env vars for authenticated tests:
 *   SMOKE_EMAIL     — gestor account email
 *   SMOKE_PASSWORD  — gestor account password
 *
 * Exit 0 = all tests passed
 * Exit 1 = one or more tests failed
 */

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return null;
}

const BASE = getArg("--base") || "http://localhost:3001";
const SMOKE_EMAIL = process.env.SMOKE_EMAIL || "";
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD || "";
const SMOKE_BACKUP_KEY = process.env.SMOKE_BACKUP_KEY || "";
const SMOKE_ORIGIN = process.env.SMOKE_ORIGIN;
if (!SMOKE_ORIGIN) {
  console.error("ERRO: SMOKE_ORIGIN nao definido. Defina a URL do frontend de staging antes de executar o smoke.");
  process.exit(1);
}

// ── test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, { headers });
  return { res, body: await res.json().catch(() => null) };
}

async function post(path, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  return { res, body: await res.json().catch(() => null) };
}

// ── tests ─────────────────────────────────────────────────────────────────────

console.log(`\nSmoke tests → ${BASE}\n`);

// --- Public endpoints ---

console.log("Public endpoints:");

await test("GET /health returns 200 with ok:true", async () => {
  const { res, body } = await get("/health");
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(body?.ok === true, `Expected {ok:true}, got ${JSON.stringify(body)}`);
  assert(typeof body?.timestamp === "string", "Missing timestamp");
});

await test("GET /readyz returns 200 (liveness gate — EB health check path)", async () => {
  const { res } = await get("/readyz");
  assert(res.status === 200, `Expected 200, got ${res.status} — app not ready or postgres unreachable`);
});

await test("GET /health has security headers (HSTS, X-Frame-Options)", async () => {
  const res = await fetch(`${BASE}/health`);
  const hsts = res.headers.get("strict-transport-security");
  const xframe = res.headers.get("x-frame-options");
  // HSTS only sent over HTTPS — skip check for localhost
  if (!BASE.startsWith("http://localhost")) {
    assert(hsts, "Missing Strict-Transport-Security header");
  }
  assert(xframe, "Missing X-Frame-Options header");
});

await test("POST /auth/login with bad credentials returns 401 or 400 (not 500)", async () => {
  const { res } = await post("/auth/login", {
    email: "notareal@email.com",
    password: "wrong-password-smoke-test"
  });
  assert(res.status === 400 || res.status === 401, `Expected 400 or 401, got ${res.status}`);
});

await test("POST /auth/login with invalid payload returns 400", async () => {
  const { res, body } = await post("/auth/login", { email: "not-an-email" });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(body?.error || body?.errors, `Expected error in body, got ${JSON.stringify(body)}`);
});

await test("GET /patients without auth returns 401", async () => {
  const { res } = await get("/patients");
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test("GET /audit-logs without auth returns 401", async () => {
  const { res } = await get("/audit-logs");
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test("GET /admin/backup/export without key returns 401 or 403", async () => {
  const { res } = await get("/admin/backup/export");
  assert(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
});

await test("GET /admin/backup/export with wrong key returns 401 or 403", async () => {
  const res = await fetch(`${BASE}/admin/backup/export`, {
    headers: { "x-backup-key": "wrong-key-smoke-test" }
  });
  assert(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
});

await test("CORS preflight from allowed origin returns 204", async () => {
  const origin = BASE.includes("localhost") ? "http://localhost:5174" : SMOKE_ORIGIN;
  const res = await fetch(`${BASE}/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type,Authorization"
    }
  });
  assert(
    res.status === 204 || res.status === 200,
    `CORS preflight: Expected 204 or 200, got ${res.status}`
  );
  const acao = res.headers.get("access-control-allow-origin");
  assert(acao, `Missing access-control-allow-origin header`);
});

await test("CORS without Origin is blocked outside localhost", async () => {
  if (BASE.includes("localhost")) return;
  const res = await fetch(`${BASE}/auth/login`, {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST"
    }
  });
  assert(res.status >= 400, `Expected blocked preflight without Origin, got ${res.status}`);
});

// --- Authenticated tests (only if credentials provided) ---

if (SMOKE_EMAIL && SMOKE_PASSWORD) {
  console.log("\nAuthenticated endpoints:");

  let token = null;

  await test("POST /auth/login with valid credentials returns token", async () => {
    const { res, body } = await post("/auth/login", {
      email: SMOKE_EMAIL,
      password: SMOKE_PASSWORD
    });
    if (res.status === 200) {
      assert(body?.token || body?.accessToken, "Missing token in response");
      token = body.token || body.accessToken;
    } else if (res.status === 403 && body?.twoFactorRequired) {
      console.log("    (2FA required — skipping authenticated tests)");
      token = null;
    } else {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  if (token) {
    await test("GET /patients returns array", async () => {
      const { res, body } = await get("/patients", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(body), `Expected array, got ${typeof body}`);
    });

    await test("GET /me returns current user", async () => {
      const { res, body } = await get("/me", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(body?.id, "Missing id in /me response");
      assert(body?.email, "Missing email in /me response");
      assert(body?.role, "Missing role in /me response");
    });

    await test("GET /audit-logs returns paginated envelope", async () => {
      const { res, body } = await get("/audit-logs", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(body && typeof body === "object", `Expected object, got ${typeof body}`);
      assert(Array.isArray(body.items), "Expected items array");
      assert(typeof body.totalMatched === "number", "Expected totalMatched number");
    });

    await test("GET /me/access-context returns contextual user", async () => {
      const { res, body } = await get("/me/access-context", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(body?.user?.id, "Missing contextual user");
    });

    await test("GET /audit-logs/export returns JSON envelope", async () => {
      const { res, body } = await get("/audit-logs/export?limit=5", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(body?.items), "Expected export items array");
    });

    await test("GET /protocol/templates returns array or object", async () => {
      const { res, body } = await get("/protocol/templates", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(body !== null, "Empty body");
    });

    await test("GET /users returns array (manager role required)", async () => {
      const { res, body } = await get("/users", token);
      assert(
        res.status === 200 || res.status === 403,
        `Expected 200 or 403, got ${res.status}`
      );
      if (res.status === 200) assert(Array.isArray(body), "Expected array");
    });

    await test("GET /metrics/internal returns object, 403, or 404 by environment contract", async () => {
      const { res, body } = await get("/metrics/internal", token);
      assert(
        res.status === 200 || res.status === 403 || res.status === 404,
        `Expected 200, 403, or 404, got ${res.status}`
      );
      if (res.status === 200) {
        assert(body !== null && typeof body === "object", `Expected object, got ${typeof body}`);
      }
    });

    if (SMOKE_BACKUP_KEY) {
      await test("GET /admin/backup/export with valid key returns encrypted snapshot", async () => {
        const res = await fetch(`${BASE}/admin/backup/export`, {
          headers: { "x-backup-key": SMOKE_BACKUP_KEY }
        });
        const body = await res.json().catch(() => null);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(typeof body?.generatedAt === "string", "Missing generatedAt");
        assert(body?.encryptedSnapshot, "Missing encryptedSnapshot");
      });
    }
  }
} else {
  console.log("\n  (Skipping authenticated tests — SMOKE_EMAIL/SMOKE_PASSWORD not set)");
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  ✗ ${f.name}: ${f.error}`);
  }
}

console.log();
process.exit(failed > 0 ? 1 : 0);
