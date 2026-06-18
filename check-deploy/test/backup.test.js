import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";

const TEST_BACKUP_KEY = process.env.BACKUP_EXPORT_KEY || "test-backup-key-for-integration-tests";

describe("Backup export endpoint", () => {
  let base;
  let token;
  before(async () => { base = await startTestServer(); });
  after(stopTestServer);

  before(async () => {
    const email = `backup-${Date.now()}@integration.test`;
    await post("/auth/register", {
      name: "Backup Gestor",
      email,
      password: "BackupGestor@123!",
      role: "gestor",
      unitId: "unit-default",
      councilType: "COREN",
      councilNumber: "998877",
      councilUf: "SP"
    });
    const loginResponse = await post("/auth/login", {
      email,
      password: "BackupGestor@123!"
    });
    token = loginResponse.json?.token || null;
  });

  it("GET /admin/backup/export without auth returns 401", async () => {
    const { status } = await get("/admin/backup/export");
    assert.equal(status, 401);
  });

  it("GET /admin/backup/export with wrong key returns 403", async () => {
    const res = await fetch(`${base}/admin/backup/export`, {
      headers: {
        "x-backup-key": "completely-wrong-key",
        Authorization: `Bearer ${token}`
      }
    });
    assert.equal(res.status, 403);
  });

  it("GET /admin/backup/export with correct key returns valid backup JSON", async () => {
    const res = await fetch(`${base}/admin/backup/export`, {
      headers: {
        "x-backup-key": TEST_BACKUP_KEY,
        Authorization: `Bearer ${token}`
      }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.generatedAt, "Missing generatedAt");
    assert.ok(body.encryptedSnapshot !== undefined, "Missing encryptedSnapshot");
    assert.ok(body.driver === "file" || body.driver === "postgres", `Invalid driver: ${body.driver}`);
  });
});
