import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";
import { setReadiness } from "../src/services/runtime-state.js";

describe("Observability — requestId, logs, health, security events", () => {
  before(async () => {
    await startTestServer();
    setReadiness(true);
  });
  after(stopTestServer);

  it("GET /health returns X-Request-Id header", async () => {
    const { headers } = await get("/health");
    assert.ok(headers.get("x-request-id"), "X-Request-Id must be present on every response");
  });

  it("GET /health returns X-Correlation-Id header", async () => {
    const { headers } = await get("/health");
    assert.ok(headers.get("x-correlation-id"), "X-Correlation-Id must be present on every response");
  });

  it("GET /health echoes X-Request-Id sent by client", async () => {
    const sentId = "test-correlation-abc-123";
    const { headers } = await get("/health", null, { "x-request-id": sentId });
    assert.equal(headers.get("x-request-id"), sentId);
  });

  it("GET /health includes version and uptimeSeconds", async () => {
    const { json } = await get("/health");
    assert.ok("version" in json, "health must include version");
    assert.ok("uptimeSeconds" in json, "health must include uptimeSeconds");
    assert.ok(typeof json.uptimeSeconds === "number" && json.uptimeSeconds >= 0);
  });

  it("GET /health includes subsystems object", async () => {
    const { json } = await get("/health");
    assert.ok(json.subsystems && typeof json.subsystems === "object", "health must include subsystems");
  });

  it("GET /patients without auth returns 401 (not 500)", async () => {
    const { status } = await get("/patients");
    assert.equal(status, 401);
  });

  it("POST /auth/login with invalid payload returns 400 and X-Request-Id", async () => {
    const { status, headers } = await post("/auth/login", { email: "not-an-email" });
    assert.ok(status === 400 || status === 401 || status === 422);
    assert.ok(headers.get("x-request-id"), "X-Request-Id must be present even on error responses");
  });

  it("requestId is propagated consistently across request lifecycle", async () => {
    const clientId = `obs-test-${Date.now()}`;
    const { headers, status } = await get("/health", null, { "x-request-id": clientId });
    assert.equal(headers.get("x-request-id"), clientId, "requestId must round-trip unchanged");
    assert.equal(headers.get("x-correlation-id"), clientId, "correlationId must match requestId when only one is provided");
    assert.equal(status, 200);
  });
});
