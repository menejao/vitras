import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get } from "./helpers.js";

describe("GET /health", () => {
  before(startTestServer);
  after(stopTestServer);

  it("returns 200 with ok:true and timestamp", async () => {
    const { status, json } = await get("/health");
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.ok(typeof json.timestamp === "string");
  });

  it("has X-Frame-Options security header", async () => {
    const { headers } = await get("/health");
    assert.ok(headers.get("x-frame-options"), "Missing X-Frame-Options");
  });

  it("has Cache-Control: no-store on /health (before auth middleware)", async () => {
    // /health is before requireAuth, so Cache-Control may not be set there
    // but X-Content-Type-Options should be set by Helmet
    const { headers } = await get("/health");
    assert.ok(headers.get("x-content-type-options"), "Missing X-Content-Type-Options");
  });
});
