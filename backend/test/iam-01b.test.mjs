/**
 * IAM-01B — bootstrap-support-admin tests
 *
 * Tests operate on a temporary copy of db.json so the real DB is never touched.
 * The bootstrapSupportAdmin() function is imported directly (no subprocess).
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_DB   = resolve(__dirname, "../data/db.json");
const TMP_DIR   = resolve(__dirname, "../data");
const TMP_DB    = resolve(TMP_DIR, `_test_bootstrap_${Date.now()}.json`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadTmpDb() {
  return JSON.parse(readFileSync(TMP_DB, "utf8"));
}

function resetTmpDb(initialUsers = []) {
  const blank = {
    users: initialUsers,
    auditLogs: [],
    patients: [],
    familyGroups: [],
    acsVisits: [],
    tasks: [],
    households: []
  };
  writeFileSync(TMP_DB, JSON.stringify(blank, null, 2), "utf8");
}

// Import the function under test once (ESM modules are cached).
const { bootstrapSupportAdmin } = await import("../scripts/bootstrap-support-admin.mjs");

// ── Test suite ────────────────────────────────────────────────────────────────

describe("IAM-01B: bootstrap-support-admin", () => {
  before(() => {
    if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
    resetTmpDb();
  });

  after(() => {
    if (existsSync(TMP_DB)) unlinkSync(TMP_DB);
  });

  beforeEach(() => {
    // Start each test with a clean, empty DB
    resetTmpDb();
  });

  // ── Test 1: creates user on clean DB ──────────────────────────────────────

  it("creates support_admin when no support_admin exists", async () => {
    const result = await bootstrapSupportAdmin({
      email: "admin@vitras.test",
      name:  "Admin Bootstrap",
      dbPath: TMP_DB
    });

    assert.equal(result.created, true, "expected created=true");
    assert.ok(result.userId,      "missing userId");
    assert.ok(result.tempPassword, "missing tempPassword");
  });

  // ── Test 2: idempotent — second run is no-op ──────────────────────────────

  it("is a no-op when a support_admin already exists", async () => {
    // First run
    await bootstrapSupportAdmin({
      email: "admin@vitras.test",
      name:  "Admin Bootstrap",
      dbPath: TMP_DB
    });

    // Second run
    const result = await bootstrapSupportAdmin({
      email: "admin2@vitras.test",
      name:  "Admin Bootstrap 2",
      dbPath: TMP_DB
    });

    assert.equal(result.created, false, "expected created=false on second run");

    // Only one user should exist
    const db = loadTmpDb();
    const admins = db.users.filter((u) => u.role === "support_admin");
    assert.equal(admins.length, 1, `expected exactly 1 support_admin, got ${admins.length}`);
  });

  // ── Test 3: missing email throws ─────────────────────────────────────────

  it("throws when email is missing", async () => {
    await assert.rejects(
      () => bootstrapSupportAdmin({ email: "", name: "Admin", dbPath: TMP_DB }),
      /required/i
    );
  });

  // ── Test 4: missing name throws ───────────────────────────────────────────

  it("throws when name is missing", async () => {
    await assert.rejects(
      () => bootstrapSupportAdmin({ email: "admin@vitras.test", name: "", dbPath: TMP_DB }),
      /required/i
    );
  });

  // ── Test 5: invalid email throws ─────────────────────────────────────────

  it("throws on invalid email format", async () => {
    await assert.rejects(
      () => bootstrapSupportAdmin({ email: "notanemail", name: "Admin", dbPath: TMP_DB }),
      /invalid email/i
    );
  });

  // ── Test 6: created user has role=support_admin ───────────────────────────

  it("created user has role=support_admin", async () => {
    const result = await bootstrapSupportAdmin({
      email: "admin@vitras.test",
      name:  "Admin Bootstrap",
      dbPath: TMP_DB
    });

    const db   = loadTmpDb();
    const user = db.users.find((u) => u.id === result.userId);
    assert.ok(user, "user not found in DB");
    assert.equal(user.role, "support_admin");
  });

  // ── Test 7: forcePasswordChange=true ─────────────────────────────────────

  it("created user has forcePasswordChange=true", async () => {
    const result = await bootstrapSupportAdmin({
      email: "admin@vitras.test",
      name:  "Admin Bootstrap",
      dbPath: TMP_DB
    });

    const db   = loadTmpDb();
    const user = db.users.find((u) => u.id === result.userId);
    assert.ok(user, "user not found in DB");
    assert.equal(user.forcePasswordChange, true);
  });

  // ── Test 8: password is hashed, not plaintext ────────────────────────────

  it("stored password is hashed (not plaintext)", async () => {
    const result = await bootstrapSupportAdmin({
      email: "admin@vitras.test",
      name:  "Admin Bootstrap",
      dbPath: TMP_DB
    });

    const db   = loadTmpDb();
    const user = db.users.find((u) => u.id === result.userId);
    assert.ok(user, "user not found in DB");

    // Hash format: s1$<32 hex chars>$<128 hex chars>
    assert.match(user.password, /^s1\$[a-f0-9]{32}\$[a-f0-9]{128}$/i,
      "password is not in expected hash format");

    // Must not equal the raw temp password
    assert.notEqual(user.password, result.tempPassword,
      "password stored as plaintext — security violation");
  });

  // ── Test 9: audit log contains SUPPORT_ADMIN_BOOTSTRAPPED ────────────────

  it("writes SUPPORT_ADMIN_BOOTSTRAPPED audit entry", async () => {
    const result = await bootstrapSupportAdmin({
      email: "admin@vitras.test",
      name:  "Admin Bootstrap",
      dbPath: TMP_DB
    });

    const db      = loadTmpDb();
    const entries = (db.auditLogs || []).filter(
      (e) => e.action === "SUPPORT_ADMIN_BOOTSTRAPPED" && e.entityId === result.userId
    );
    assert.ok(entries.length > 0, "audit log entry not found");
    assert.equal(entries[0].category, "iam");
    assert.equal(entries[0].severity, "high");
  });

  // ── Test 10: audit log does NOT contain tempPassword ─────────────────────

  it("audit log does NOT contain the temp password — LGPD guard", async () => {
    const result = await bootstrapSupportAdmin({
      email: "admin@vitras.test",
      name:  "Admin Bootstrap",
      dbPath: TMP_DB
    });

    const db      = loadTmpDb();
    const entries = (db.auditLogs || []).filter(
      (e) => e.action === "SUPPORT_ADMIN_BOOTSTRAPPED" && e.entityId === result.userId
    );
    assert.ok(entries.length > 0, "audit entry missing");

    const serialized = JSON.stringify(entries);
    assert.ok(
      !serialized.includes(result.tempPassword),
      "LGPD violation: tempPassword found in audit log"
    );
  });

  // ── Test 11: email already in use under a different role ─────────────────

  it("throws when email is already registered under a different role", async () => {
    // Pre-insert a regular user with that email
    const db = loadTmpDb();
    db.users.push({
      id: randomUUID(),
      email: "taken@vitras.test",
      role: "gestor",
      name: "Existing Gestor",
      password: "s1$aabbcc" + "a".repeat(26) + "$" + "b".repeat(128),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    writeFileSync(TMP_DB, JSON.stringify(db, null, 2), "utf8");

    await assert.rejects(
      () => bootstrapSupportAdmin({ email: "taken@vitras.test", name: "Admin", dbPath: TMP_DB }),
      /already registered/i
    );
  });

  // ── Test 12: tempPassword is at least 14 characters ──────────────────────

  it("generated tempPassword is at least 14 characters", async () => {
    const result = await bootstrapSupportAdmin({
      email: "admin@vitras.test",
      name:  "Admin Bootstrap",
      dbPath: TMP_DB
    });

    assert.ok(
      result.tempPassword.length >= 14,
      `tempPassword too short: ${result.tempPassword.length} chars`
    );
  });
});
