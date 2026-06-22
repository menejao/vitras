#!/usr/bin/env node
/**
 * Reset support_admin password. Works in both file mode and Postgres mode.
 *
 * File mode  (no DATABASE_URL): reads/writes data/db.json directly.
 * Postgres mode (DATABASE_URL set): reads app_state; if user not found there,
 *   falls back to db.json and migrates the user into app_state before resetting.
 *
 * Usage:
 *   node scripts/reset-support-admin-password.mjs --email <email>
 *   DATABASE_URL=<url> node scripts/reset-support-admin-password.mjs --email <email>
 *
 * Security: password shown once, never in audit log, never stored in plaintext.
 */
import { createRequire }  from "node:module";
import { randomUUID }     from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath }  from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_FILE   = resolve(__dirname, "../data/db.json");

const require = createRequire(import.meta.url);

// ── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? (args[idx + 1] || null) : null;
}

const email = (getArg("email") || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/reset-support-admin-password.mjs --email <email>");
  process.exit(1);
}

const { hashPassword, generateTempPassword } = await import("../src/services/crypto.js");

// ── Core reset logic (mode-agnostic) ──────────────────────────────────────
function applyReset(db, normalizedEmail) {
  if (!Array.isArray(db.users))        db.users = [];
  if (!Array.isArray(db.auditLogs))    db.auditLogs = [];
  if (!Array.isArray(db.refreshTokens)) db.refreshTokens = [];

  const idx = db.users.findIndex(
    u => String(u.email || "").toLowerCase() === normalizedEmail
  );

  if (idx < 0) return { error: `User ${normalizedEmail} not found.` };

  const user = db.users[idx];
  if (String(user.role || "").toLowerCase() !== "support_admin") {
    return { error: `User ${normalizedEmail} has role '${user.role}', not support_admin. Refusing.` };
  }

  const tempPassword  = generateTempPassword();
  const nowIso        = new Date().toISOString();

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
    password:                  hashPassword(tempPassword),
    forcePasswordChange:       true,
    passwordUpdatedAt:         null,
    temporaryPasswordIssuedAt: nowIso,
    lastPasswordResetAt:       nowIso,
    passwordResetBy:           "system-reset-cli",
    updatedAt:                 nowIso
  };

  db.auditLogs.push({
    id:       randomUUID(),
    action:   "SUPPORT_ADMIN_PASSWORD_RESET",
    entity:   "user",
    entityId: user.id,
    category: "iam",
    severity: "high",
    userId:   "system-reset-cli",
    userName: "system",
    userRole: "system",
    teamId:   "",
    unitId:   "",
    details: {
      email:           normalizedEmail,
      revokedSessions,
      method:          "reset-cli",
      outcome:         "success"
      // tempPassword deliberately excluded
    },
    createdAt: nowIso
  });

  return { tempPassword, revokedSessions, userId: user.id, updatedUser: db.users[idx] };
}

// ── Print result ───────────────────────────────────────────────────────────
function printResult(email, userId, revokedSessions, tempPassword) {
  console.log("\n========================================");
  console.log("  VITRAS — support_admin password reset");
  console.log("========================================");
  console.log(`  Email:            ${email}`);
  console.log(`  ID:               ${userId}`);
  console.log(`  Sessions revoked: ${revokedSessions}`);
  console.log("\n  ⚠ TEMPORARY PASSWORD (shown once):\n");
  console.log(`     ${tempPassword}\n`);
  console.log("  Record this password now.");
  console.log("  User must change it on first login.");
  console.log("========================================\n");
}

// ── FILE MODE ──────────────────────────────────────────────────────────────
async function runFileMode() {
  const db = JSON.parse(readFileSync(DB_FILE, "utf8"));
  const result = applyReset(db, email);
  if (result.error) { console.error("Error:", result.error); process.exit(1); }

  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  printResult(email, result.userId, result.revokedSessions, result.tempPassword);
}

// ── POSTGRES MODE ──────────────────────────────────────────────────────────
async function runPostgresMode(databaseUrl) {
  const { Client } = require("pg");
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query("BEGIN");

    const stateRes = await client.query("SELECT data FROM app_state WHERE id = 1 FOR UPDATE");
    if (!stateRes.rows.length) {
      await client.query("ROLLBACK");
      console.error("Error: app_state not initialized. Run the backend server first.");
      process.exit(1);
    }

    const db = stateRes.rows[0].data;
    if (!Array.isArray(db.users)) db.users = [];

    // If user missing from app_state, migrate from db.json (handles sync gap)
    const inState = db.users.some(u => String(u.email || "").toLowerCase() === email);
    if (!inState) {
      console.log(`  User not in app_state — checking db.json for migration...`);
      let fileDb;
      try {
        fileDb = JSON.parse(readFileSync(DB_FILE, "utf8"));
      } catch {
        await client.query("ROLLBACK");
        console.error(`Error: user ${email} not found in app_state and db.json is unreadable.`);
        process.exit(1);
      }

      const fileUser = (fileDb.users || []).find(
        u => String(u.email || "").toLowerCase() === email
      );
      if (!fileUser) {
        await client.query("ROLLBACK");
        console.error(`Error: user ${email} not found in app_state or db.json.`);
        process.exit(1);
      }

      console.log(`  Found in db.json — migrating to app_state...`);
      db.users.push(fileUser);
    }

    const result = applyReset(db, email);
    if (result.error) {
      await client.query("ROLLBACK");
      console.error("Error:", result.error);
      process.exit(1);
    }

    // Write back to app_state
    await client.query(
      "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
      [JSON.stringify(db)]
    );

    // Sync app_users shadow table
    await client.query(`
      INSERT INTO app_users (id, email, name, role, team_id, unit_id, municipality_id, created_at, payload)
      VALUES ($1, $2, $3, 'support_admin', '', '', '', $4, $5::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        payload    = EXCLUDED.payload,
        updated_at = NOW()
    `, [
      result.userId,
      email,
      result.updatedUser.name || "",
      result.updatedUser.createdAt || new Date().toISOString(),
      JSON.stringify(result.updatedUser)
    ]);

    await client.query("COMMIT");
    printResult(email, result.userId, result.revokedSessions, result.tempPassword);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Reset failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// ── Entry point ────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (DATABASE_URL) {
  await runPostgresMode(DATABASE_URL);
} else {
  await runFileMode();
}
