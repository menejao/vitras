#!/usr/bin/env node
/**
 * Reset support_admin password in Postgres app_state + app_users shadow table.
 * Usage: DATABASE_URL=<url> node scripts/reset-support-admin-password.mjs --email <email>
 *
 * Security: password shown once, never in audit log, never in logs.
 */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL env var required.");
  process.exit(1);
}

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? (args[idx + 1] || null) : null;
}

const email = (getArg("email") || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: DATABASE_URL=<url> node scripts/reset-support-admin-password.mjs --email <email>");
  process.exit(1);
}

const { hashPassword, generateTempPassword } = await import("../src/services/crypto.js");

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
await client.connect();

try {
  await client.query("BEGIN");

  const stateRes = await client.query("SELECT data FROM app_state WHERE id = 1 FOR UPDATE");
  if (!stateRes.rows.length) {
    await client.query("ROLLBACK");
    console.error("Error: app_state not initialized.");
    process.exit(1);
  }

  const db = stateRes.rows[0].data;
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
  if (!Array.isArray(db.refreshTokens)) db.refreshTokens = [];

  const idx = db.users.findIndex(
    u => String(u.email || "").toLowerCase() === email
  );

  if (idx < 0) {
    await client.query("ROLLBACK");
    console.error(`Error: user ${email} not found.`);
    process.exit(1);
  }

  const user = db.users[idx];

  if (String(user.role || "").toLowerCase() !== "support_admin") {
    await client.query("ROLLBACK");
    console.error(`Error: user ${email} has role '${user.role}', not support_admin. Refusing.`);
    process.exit(1);
  }

  const tempPassword = generateTempPassword();
  const nowIso = new Date().toISOString();

  // Revoke all active refresh tokens for this user
  let revokedSessions = 0;
  db.refreshTokens = db.refreshTokens.map(t => {
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

  // Audit — no password
  db.auditLogs.push({
    id: randomUUID(),
    action: "SUPPORT_ADMIN_PASSWORD_RESET",
    entity: "user",
    entityId: user.id,
    category: "iam",
    severity: "high",
    userId: "system-reset-cli",
    userName: "system",
    userRole: "system",
    teamId: "",
    unitId: "",
    details: {
      email,
      revokedSessions,
      method: "reset-cli-pg",
      outcome: "success"
      // tempPassword deliberately excluded
    },
    createdAt: nowIso
  });

  // Write back to app_state
  await client.query(
    "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
    [JSON.stringify(db)]
  );

  // Sync app_users shadow table
  await client.query(`
    UPDATE app_users
    SET payload = $1::jsonb, updated_at = NOW()
    WHERE id = $2
  `, [JSON.stringify(db.users[idx]), user.id]);

  await client.query("COMMIT");

  console.log("\n========================================");
  console.log("  VITRAS — support_admin password reset");
  console.log("========================================");
  console.log(`  Email:            ${email}`);
  console.log(`  ID:               ${user.id}`);
  console.log(`  Sessions revoked: ${revokedSessions}`);
  console.log("\n  ⚠ TEMPORARY PASSWORD (shown once):\n");
  console.log(`     ${tempPassword}\n`);
  console.log("  Record this password now.");
  console.log("  User must change it on first login.");
  console.log("========================================\n");

} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Reset failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
