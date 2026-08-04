import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";

describe("Auth endpoints", () => {
  before(startTestServer);
  after(stopTestServer);

  // ── unauthenticated access ─────────────────────────────────────────────────

  it("GET /patients without token returns 401", async () => {
    const { status } = await get("/patients");
    assert.equal(status, 401);
  });

  it("GET /me without token returns 401", async () => {
    const { status } = await get("/me");
    assert.equal(status, 401);
  });

  it("GET /audit-logs without token returns 401", async () => {
    const { status } = await get("/audit-logs");
    assert.equal(status, 401);
  });

  it("GET /users without token returns 401", async () => {
    const { status } = await get("/users");
    assert.equal(status, 401);
  });

  // ── login validation ───────────────────────────────────────────────────────

  it("POST /auth/login with missing fields returns 400", async () => {
    const { status, json } = await post("/auth/login", { email: "not-an-email" });
    assert.equal(status, 400);
    assert.ok(json.error || json.errors, "Expected error body");
  });

  it("POST /auth/login with wrong credentials returns 401", async () => {
    const { status } = await post("/auth/login", {
      identifier: "nobody@test.com",
      password: "wrongpassword123"
    });
    assert.equal(status, 401);
  });

  // ── register + login + refresh flow ───────────────────────────────────────

  const testEmail = `test-${Date.now()}@integration.test`;
  const testPassword = "TestPass@12345!";
  let accessToken = null;
  let refreshToken = null;

  it("POST /auth/register creates a gestor account", async () => {
    const { status, json } = await post("/auth/register", {
      name: "Test Gestor",
      email: testEmail,
      password: testPassword,
      role: "gestor",
      unitId: "unit-default",
      councilType: "COREN",
      councilNumber: "874231",
      councilUf: "SP"
    });
    // Allow 201 (created) or 409 (duplicate if test re-run)
    assert.ok(
      status === 201 || status === 409,
      `Expected 201 or 409, got ${status}: ${JSON.stringify(json)}`
    );
  });

  it("POST /auth/login with valid credentials returns token", async () => {
    const { status, json } = await post("/auth/login", {
      identifier: testEmail,
      password: testPassword
    });
    if (status === 403 && json?.requiresTwoFactor) {
      // 2FA enabled — skip token-dependent tests gracefully
      return;
    }
    assert.equal(status, 200, `Login failed: ${JSON.stringify(json)}`);
    assert.ok(json.token || json.accessToken, "Missing token in response");
    accessToken = json.token || json.accessToken;
    refreshToken = json.refreshToken;
  });

  it("GET /me with valid token returns user data", async () => {
    if (!accessToken) return; // skipped if login failed
    const { status, json } = await get("/me", accessToken);
    assert.equal(status, 200);
    assert.equal(json.email, testEmail);
    assert.ok(json.role);
  });

  it("GET /patients with valid token returns array", async () => {
    if (!accessToken) return;
    const { status, json } = await get("/patients", accessToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json));
  });

  it("POST /auth/refresh with valid refresh token returns new access token", async () => {
    if (!refreshToken) return;
    const { status, json } = await post("/auth/refresh", { refreshToken });
    assert.equal(status, 200, `Refresh failed: ${JSON.stringify(json)}`);
    assert.ok(json.token || json.accessToken, "Missing token in refresh response");
  });

  it("POST /auth/refresh with invalid token returns 401 or 403", async () => {
    const { status } = await post("/auth/refresh", { refreshToken: "invalid-token-xyz" });
    assert.ok(status === 401 || status === 403, `Expected 401 or 403, got ${status}`);
  });

  it("GET /me with expired/invalid token returns 401", async () => {
    const { status } = await get("/me", "invalid.jwt.token");
    assert.equal(status, 401);
  });
});
