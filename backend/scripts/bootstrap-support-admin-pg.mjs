#!/usr/bin/env node
/**
 * One-shot bootstrap (Postgres mode): creates first support_admin in app_state + app_users.
 * Usage: DATABASE_URL=<url> node scripts/bootstrap-support-admin-pg.mjs --vitrasId <9-digit-id> --email <email> --name <name>
 *
 * Security: no hardcoded creds, password shown once, never in audit log.
 */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

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

const vitrasId = (getArg("vitrasId") || "").trim();
const email    = (getArg("email") || "").trim().toLowerCase();
const name     = (getArg("name")  || "").trim();

if (!vitrasId || !email || !name) {
  console.error("Usage: DATABASE_URL=<url> node scripts/bootstrap-support-admin-pg.mjs --vitrasId <9-digit-id> --email <email> --name <name>");
  process.exit(1);
}
if (!/^\d{9}$/.test(vitrasId)) {
  console.error("Invalid vitrasId format — must be exactly 9 digits.");
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Invalid email format.");
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

  // Read app_state
  const stateRes = await client.query("SELECT data FROM app_state WHERE id = 1 FOR UPDATE");
  if (!stateRes.rows.length) {
    console.error("Error: app_state not initialized. Run the backend server first.");
    await client.query("ROLLBACK");
    process.exit(1);
  }

  const db = stateRes.rows[0].data;
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.auditLogs)) db.auditLogs = [];

  // Guard: only create if no support_admin exists
  const existing = db.users.filter(u =>
    String(u.role || "").toLowerCase() === "support_admin"
  );
  if (existing.length > 0) {
    await client.query("ROLLBACK");
    console.log("✓ support_admin already exists in Postgres — no action taken.");
    console.log(`  Existing: ${existing.map(u => u.vitrasId || u.email).join(", ")}`);
    process.exit(0);
  }

  // Guard: vitrasId collision
  if (db.users.some(u => String(u.vitrasId || "") === vitrasId)) {
    await client.query("ROLLBACK");
    console.error(`Error: vitrasId ${vitrasId} already in use.`);
    process.exit(1);
  }

  // Guard: email collision
  if (db.users.some(u => String(u.email || "").toLowerCase() === email)) {
    await client.query("ROLLBACK");
    console.error(`Error: email ${email} already registered under a different role.`);
    process.exit(1);
  }

  const tempPassword = generateTempPassword();
  const nowIso = new Date().toISOString();
  const userId = randomUUID();

  const user = {
    id: userId,
    vitrasId,
    name,
    email,
    role: "support_admin",
    password: hashPassword(tempPassword),
    unitId: "",
    teamId: "",
    municipalityId: "",
    forcePasswordChange: true,
    passwordUpdatedAt: null,
    temporaryPasswordIssuedAt: nowIso,
    createdBySupport: true,
    createdByUserId: "system-bootstrap",
    lastPasswordResetAt: null,
    passwordResetBy: null,
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: nowIso,
    updatedAt: nowIso
  };

  db.users.push(user);

  // Audit log — NO password
  db.auditLogs.push({
    id: randomUUID(),
    action: "SUPPORT_ADMIN_BOOTSTRAPPED",
    entity: "user",
    entityId: userId,
    category: "iam",
    severity: "high",
    userId: "system-bootstrap",
    userName: "system",
    userRole: "system",
    teamId: "",
    unitId: "",
    details: { email, name, method: "bootstrap-cli-pg", outcome: "success" },
    createdAt: nowIso
  });

  // Write back to app_state
  await client.query(
    "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
    [JSON.stringify(db)]
  );

  // Sync to app_users shadow table (upsert)
  await client.query(`
    INSERT INTO app_users (id, email, name, role, team_id, unit_id, municipality_id, created_at, payload)
    VALUES ($1, $2, $3, $4, '', '', '', $5, $6::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      payload = EXCLUDED.payload,
      updated_at = NOW()
  `, [userId, email, name, "support_admin", nowIso, JSON.stringify(user)]);

  await client.query("COMMIT");

  console.log("\n========================================");
  console.log("  VITRAS — support_admin bootstrapped (Postgres)");
  console.log("========================================");
  console.log(`  VitrasId: ${vitrasId}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Name:     ${name}`);
  console.log(`  ID:       ${userId}`);
  console.log("\n  ⚠ TEMPORARY PASSWORD (shown once):\n");
  console.log(`     ${tempPassword}\n`);
  console.log("  Record this password now.");
  console.log("  User must change it on first login.");
  console.log("========================================\n");

} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Bootstrap failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
