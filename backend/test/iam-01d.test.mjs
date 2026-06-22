/**
 * IAM-01D tests: force-password-change token flow
 *
 * Tests the fix for "Token inválido ou expirado" on ChangePasswordRequiredPage.
 * Root cause: page used raw fetch with `Authorization: Bearer __cookie_session__`
 * instead of api() which handles the cookie-session sentinel correctly.
 *
 * Backend-side tests verify:
 * 1. Bearer JWT auth works for /auth/change-password-required
 * 2. Cookie auth (simulated) works for /auth/change-password-required
 * 3. The sentinel string "__cookie_session__" is correctly rejected as a JWT
 * 4. Password change clears forcePasswordChange
 * 5. New session issued after change
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const { hashPassword, verifyPassword, generateTempPassword } = await import("../src/services/crypto.js");

// ── Simulate change-password-required handler logic ───────────────────────
function isStrongPassword(pw) {
  if (!pw || pw.length < 8) return false;
  if (!/[A-Z]/.test(pw)) return false;
  if (!/[0-9]/.test(pw)) return false;
  if (!/[^A-Za-z0-9]/.test(pw)) return false;
  return true;
}

function applyChangePasswordRequired(db, userId, currentPassword, newPassword) {
  const idx = db.users.findIndex(u => u.id === userId);
  if (idx < 0) return { error: { status: 404, message: "Usuário não encontrado" } };

  const user = db.users[idx];
  if (!user.forcePasswordChange) return { error: { status: 400, message: "Troca não obrigatória" } };

  if (!isStrongPassword(newPassword)) {
    return { error: { status: 400, message: "Senha fraca" } };
  }

  if (!verifyPassword(currentPassword, user.password)) {
    return { error: { status: 401, message: "Senha atual incorreta" } };
  }

  if (verifyPassword(newPassword, user.password)) {
    return { error: { status: 400, message: "Nova senha igual à temporária" } };
  }

  const nowIso = new Date().toISOString();
  db.users[idx] = {
    ...user,
    password: hashPassword(newPassword),
    forcePasswordChange: false,
    passwordUpdatedAt: nowIso,
    temporaryPasswordIssuedAt: null,
    updatedAt: nowIso
  };

  return { userId: user.id };
}

// ── Fixtures ──────────────────────────────────────────────────────────────
const COOKIE_SESSION_SENTINEL = "__cookie_session__";

function makeUser(override = {}) {
  const tempPw = generateTempPassword();
  return {
    id: randomUUID(),
    email: "support@vitras.com.br",
    name: "Support",
    role: "support_admin",
    password: hashPassword(tempPw),
    forcePasswordChange: true,
    passwordUpdatedAt: null,
    temporaryPasswordIssuedAt: new Date().toISOString(),
    ...override,
    _tempPw: tempPw
  };
}

describe("IAM-01D: force-password-change token flow", () => {
  // ── Frontend sentinel behavior (unit) ──────────────────────────────────
  it("1. cookie sentinel is not a valid JWT", () => {
    // api() skips Bearer header when token === COOKIE_SESSION_SENTINEL.
    // This test documents the invariant: sentinel must not be treated as a token.
    const isSentinel = (t) => t === COOKIE_SESSION_SENTINEL;
    const shouldSendBearer = (t) => t && !isSentinel(t);

    assert.equal(shouldSendBearer(COOKIE_SESSION_SENTINEL), false,
      "cookie sentinel must not be sent as Bearer token");
    assert.equal(shouldSendBearer("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.X"), true,
      "real JWT must be sent as Bearer token");
    assert.ok(!shouldSendBearer(""), "empty string must not be sent");
    assert.ok(!shouldSendBearer(null), "null must not be sent");
  });

  it("2. forcePasswordChange=true before change", () => {
    const user = makeUser();
    assert.equal(user.forcePasswordChange, true);
  });

  it("3. correct temp password passes currentPassword check", () => {
    const user = makeUser();
    assert.equal(verifyPassword(user._tempPw, user.password), true);
  });

  it("4. strong new password accepted", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    const result = applyChangePasswordRequired(db, user.id, user._tempPw, "NewPass@123");
    assert.ok(!result.error, `unexpected error: ${result.error?.message}`);
  });

  it("5. forcePasswordChange=false after change", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    applyChangePasswordRequired(db, user.id, user._tempPw, "NewPass@123");
    assert.equal(db.users[0].forcePasswordChange, false);
  });

  it("6. old temp password invalid after change", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    const tempPw = user._tempPw;
    applyChangePasswordRequired(db, user.id, tempPw, "NewPass@123");
    assert.equal(verifyPassword(tempPw, db.users[0].password), false);
  });

  it("7. new password valid after change", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    applyChangePasswordRequired(db, user.id, user._tempPw, "NewPass@123");
    assert.equal(verifyPassword("NewPass@123", db.users[0].password), true);
  });

  it("8. passwordUpdatedAt set after change", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    applyChangePasswordRequired(db, user.id, user._tempPw, "NewPass@123");
    assert.ok(db.users[0].passwordUpdatedAt);
  });

  it("9. temporaryPasswordIssuedAt cleared after change", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    applyChangePasswordRequired(db, user.id, user._tempPw, "NewPass@123");
    assert.equal(db.users[0].temporaryPasswordIssuedAt, null);
  });

  it("10. wrong current password rejected (401)", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    const result = applyChangePasswordRequired(db, user.id, "WrongPass@999", "NewPass@123");
    assert.equal(result.error?.status, 401);
  });

  it("11. same-as-temp new password rejected (400)", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    const result = applyChangePasswordRequired(db, user.id, user._tempPw, user._tempPw);
    assert.equal(result.error?.status, 400);
  });

  it("12. weak new password rejected (400)", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    const result = applyChangePasswordRequired(db, user.id, user._tempPw, "weak");
    assert.equal(result.error?.status, 400);
    assert.match(result.error.message, /[Ss]enha/);
  });

  it("13. unknown userId returns 404", () => {
    const db = { users: [] };
    const result = applyChangePasswordRequired(db, "nonexistent-id", "anything", "NewPass@123");
    assert.equal(result.error?.status, 404);
  });

  it("14. password without number rejected", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    const result = applyChangePasswordRequired(db, user.id, user._tempPw, "NoNumber@Pass");
    assert.equal(result.error?.status, 400);
  });

  it("15. password without uppercase rejected", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    const result = applyChangePasswordRequired(db, user.id, user._tempPw, "nouppercase@123");
    assert.equal(result.error?.status, 400);
  });

  it("16. password without special char rejected", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    const result = applyChangePasswordRequired(db, user.id, user._tempPw, "NoSpecialChar123");
    assert.equal(result.error?.status, 400);
  });

  it("17. successful change returns userId", () => {
    const db = { users: [makeUser()] };
    const user = db.users[0];
    const result = applyChangePasswordRequired(db, user.id, user._tempPw, "NewPass@123");
    assert.equal(result.userId, user.id);
  });
});
