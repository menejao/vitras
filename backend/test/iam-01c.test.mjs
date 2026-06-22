/**
 * IAM-01C tests: reset-support-admin-password logic
 * Uses Node.js built-in test runner (node:test).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const { hashPassword, verifyPassword, generateTempPassword } = await import("../src/services/crypto.js");

// ── Core reset logic (mirrors reset-support-admin-password.mjs) ──────────

function resetSupportAdminPassword(db, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email required.");

  const idx = db.users.findIndex(
    u => String(u.email || "").toLowerCase() === normalizedEmail
  );
  if (idx < 0) throw new Error(`User ${normalizedEmail} not found.`);

  const user = db.users[idx];
  if (String(user.role || "").toLowerCase() !== "support_admin") {
    throw new Error(`User ${normalizedEmail} has role '${user.role}', not support_admin.`);
  }

  const tempPassword = generateTempPassword();
  const nowIso = new Date().toISOString();

  let revokedSessions = 0;
  db.refreshTokens = (db.refreshTokens || []).map(t => {
    if (t.userId === user.id && !t.revokedAt) {
      revokedSessions++;
      return { ...t, revokedAt: nowIso };
    }
    return t;
  });

  db.users[idx] = {
    ...user,
    password: hashPassword(tempPassword),
    forcePasswordChange: true,
    passwordUpdatedAt: null,
    temporaryPasswordIssuedAt: nowIso,
    lastPasswordResetAt: nowIso,
    passwordResetBy: "system-reset-cli",
    updatedAt: nowIso
  };

  db.auditLogs = db.auditLogs || [];
  const auditEntry = {
    id: randomUUID(),
    action: "SUPPORT_ADMIN_PASSWORD_RESET",
    entity: "user",
    entityId: user.id,
    details: { email: normalizedEmail, revokedSessions, outcome: "success" }
  };
  db.auditLogs.push(auditEntry);

  return { tempPassword, revokedSessions, userId: user.id, auditEntry };
}

// ── Fixtures ──────────────────────────────────────────────────────────────

const SA_ID = "user-sa-01";

function makeDb(userOverride = {}) {
  return {
    users: [
      {
        id: SA_ID,
        email: "admin@vitras.com.br",
        name: "Admin",
        role: "support_admin",
        password: hashPassword("OldPass@123"),
        forcePasswordChange: false,
        passwordUpdatedAt: "2026-06-01T00:00:00.000Z",
        temporaryPasswordIssuedAt: null,
        ...userOverride
      }
    ],
    refreshTokens: [
      { id: "tok1", userId: SA_ID,       tokenHash: "abc", revokedAt: null },
      { id: "tok2", userId: SA_ID,       tokenHash: "def", revokedAt: null },
      { id: "tok3", userId: "other-user", tokenHash: "xyz", revokedAt: null }
    ],
    auditLogs: []
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("IAM-01C: reset-support-admin-password", () => {
  let db;
  beforeEach(() => { db = makeDb(); });

  it("1. support_admin exists in fixture", () => {
    assert.ok(db.users.some(u => u.role === "support_admin"));
  });

  it("2. support_admin active (no inactive flag)", () => {
    const u = db.users.find(u => u.role === "support_admin");
    assert.notEqual(u.active, false);
  });

  it("3. reset returns tempPassword ≥14 chars", () => {
    const { tempPassword } = resetSupportAdminPassword(db, "admin@vitras.com.br");
    assert.equal(typeof tempPassword, "string");
    assert.ok(tempPassword.length >= 14);
  });

  it("4. old password invalid after reset", () => {
    resetSupportAdminPassword(db, "admin@vitras.com.br");
    const u = db.users.find(u => u.email === "admin@vitras.com.br");
    assert.equal(verifyPassword("OldPass@123", u.password), false);
  });

  it("5. new temp password valid after reset", () => {
    const { tempPassword } = resetSupportAdminPassword(db, "admin@vitras.com.br");
    const u = db.users.find(u => u.email === "admin@vitras.com.br");
    assert.equal(verifyPassword(tempPassword, u.password), true);
  });

  it("6. forcePasswordChange=true after reset", () => {
    resetSupportAdminPassword(db, "admin@vitras.com.br");
    const u = db.users.find(u => u.email === "admin@vitras.com.br");
    assert.equal(u.forcePasswordChange, true);
  });

  it("7. passwordUpdatedAt=null after reset", () => {
    resetSupportAdminPassword(db, "admin@vitras.com.br");
    const u = db.users.find(u => u.email === "admin@vitras.com.br");
    assert.equal(u.passwordUpdatedAt, null);
  });

  it("8. temporaryPasswordIssuedAt set after reset", () => {
    resetSupportAdminPassword(db, "admin@vitras.com.br");
    const u = db.users.find(u => u.email === "admin@vitras.com.br");
    assert.ok(u.temporaryPasswordIssuedAt);
  });

  it("9. active refresh tokens for user revoked", () => {
    resetSupportAdminPassword(db, "admin@vitras.com.br");
    const userTokens = db.refreshTokens.filter(t => t.userId === SA_ID);
    const active = userTokens.filter(t => !t.revokedAt);
    assert.equal(active.length, 0);
    assert.ok(userTokens.every(t => t.revokedAt));
  });

  it("10. other user tokens unaffected", () => {
    resetSupportAdminPassword(db, "admin@vitras.com.br");
    const other = db.refreshTokens.find(t => t.userId === "other-user");
    assert.equal(other.revokedAt, null);
  });

  it("11. audit log entry created with correct action", () => {
    resetSupportAdminPassword(db, "admin@vitras.com.br");
    const entry = db.auditLogs.find(e => e.action === "SUPPORT_ADMIN_PASSWORD_RESET");
    assert.ok(entry);
    assert.equal(entry.details.outcome, "success");
  });

  it("12. tempPassword absent from audit log", () => {
    const { tempPassword } = resetSupportAdminPassword(db, "admin@vitras.com.br");
    const auditStr = JSON.stringify(db.auditLogs);
    assert.ok(!auditStr.includes(tempPassword));
    assert.ok(!auditStr.includes("tempPassword"));
  });

  it("13. throws on nonexistent email", () => {
    assert.throws(
      () => resetSupportAdminPassword(db, "nobody@vitras.com.br"),
      /not found/
    );
  });

  it("14. refuses non-support_admin role", () => {
    db.users.push({ id: "u2", email: "gestor@ubs.br", role: "gestor", password: hashPassword("x") });
    assert.throws(
      () => resetSupportAdminPassword(db, "gestor@ubs.br"),
      /not support_admin/
    );
  });

  it("15. two successive resets produce distinct passwords", () => {
    const { tempPassword: p1 } = resetSupportAdminPassword(db, "admin@vitras.com.br");
    const { tempPassword: p2 } = resetSupportAdminPassword(db, "admin@vitras.com.br");
    assert.notEqual(p1, p2);
    const u = db.users.find(u => u.email === "admin@vitras.com.br");
    assert.equal(verifyPassword(p2, u.password), true);
    assert.equal(verifyPassword(p1, u.password), false);
  });
});
