#!/usr/bin/env node
/**
 * One-shot bootstrap: creates the first support_admin user if none exist.
 *
 * Usage:
 *   node scripts/bootstrap-support-admin.mjs --email <email> --name <name>
 *
 * Security contract:
 *   - No hardcoded credentials.
 *   - Idempotent: exits 0 with no changes if a support_admin already exists.
 *   - Temp password printed to stdout ONCE; never written to audit log.
 *   - forcePasswordChange=true on all created accounts.
 *   - Does NOT auto-run on server startup.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_DB_PATH = resolve(__dirname, "../data/db.json");

// ── Exported core function ────────────────────────────────────────────────────

/**
 * Bootstrap a support_admin user.
 *
 * @param {{ email: string, name: string, dbPath?: string }} opts
 * @returns {{ created: boolean, userId?: string, tempPassword?: string, message: string }}
 *
 * NOTE: `tempPassword` is returned only for testing purposes.
 *       The CLI entry point prints it to stdout and does NOT forward it to the audit log.
 */
export async function bootstrapSupportAdmin({ email, name, dbPath = REAL_DB_PATH }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName  = String(name  || "").trim();

  if (!normalizedEmail || !normalizedName) {
    throw new Error("Both email and name are required.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error(`Invalid email format: ${normalizedEmail}`);
  }

  const { hashPassword, generateTempPassword } = await import("../src/services/crypto.js");

  const rawDb = readFileSync(dbPath, "utf8");
  const db = JSON.parse(rawDb);
  if (!Array.isArray(db.users))     db.users     = [];
  if (!Array.isArray(db.auditLogs)) db.auditLogs = [];

  // Guard: only create if no active support_admin exists
  const existing = db.users.filter(
    (u) => String(u.role || "").toLowerCase() === "support_admin" && u.active !== false
  );
  if (existing.length > 0) {
    return {
      created: false,
      message: `support_admin already exists: ${existing.map((u) => u.email).join(", ")}`
    };
  }

  // Guard: email must not already be in use (any role)
  if (db.users.some((u) => String(u.email || "").toLowerCase() === normalizedEmail)) {
    throw new Error(`Email ${normalizedEmail} is already registered under a different role.`);
  }

  const tempPassword = generateTempPassword();
  const nowIso       = new Date().toISOString();
  const userId       = randomUUID();

  const user = {
    id: userId,
    name: normalizedName,
    email: normalizedEmail,
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

  // Audit log — tempPassword deliberately excluded
  const auditEntry = {
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
    details: {
      email: normalizedEmail,
      name: normalizedName,
      method: "bootstrap-cli",
      outcome: "success"
      // tempPassword deliberately excluded — never stored in audit log
    },
    createdAt: nowIso
  };
  db.auditLogs.push(auditEntry);

  writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");

  return {
    created: true,
    userId,
    tempPassword, // returned only so tests can verify hashing; CLI does NOT log this
    message: "support_admin created successfully."
  };
}

// ── CLI entry point ───────────────────────────────────────────────────────────
// Only runs when executed directly (not when imported by tests).

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);

  function getArg(argName) {
    const idx = args.indexOf(`--${argName}`);
    return idx >= 0 ? args[idx + 1] : null;
  }

  const email = getArg("email");
  const name  = getArg("name");

  if (!email || !name) {
    console.error("Usage: node scripts/bootstrap-support-admin.mjs --email <email> --name <name>");
    process.exit(1);
  }

  try {
    const result = await bootstrapSupportAdmin({ email, name, dbPath: REAL_DB_PATH });

    if (!result.created) {
      console.log(`\n  support_admin already exists — no action taken.`);
      console.log(`  ${result.message}\n`);
      process.exit(0);
    }

    // Print temp password ONCE to stdout — never to audit log
    console.log("\n========================================");
    console.log("  VITRAS — support_admin bootstrapped");
    console.log("========================================");
    console.log(`  Email : ${email.trim().toLowerCase()}`);
    console.log(`  Name  : ${name.trim()}`);
    console.log(`  ID    : ${result.userId}`);
    console.log("\n  TEMPORARY PASSWORD (shown once):");
    console.log(`\n     ${result.tempPassword}\n`);
    console.log("  Record this password now.");
    console.log("  User must change it on first login.");
    console.log("========================================\n");
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
