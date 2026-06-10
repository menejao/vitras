#!/usr/bin/env node
/**
 * check-status.js — Verifica o estado das migrations no banco.
 *
 * Usage:
 *   node backend/src/migrations/check-status.js
 *   (or via npm script: npm run migration:check)
 *
 * Connects to the database using DATABASE_URL, compares schema_migrations
 * against the canonical list in index.js, and reports any pending migrations.
 *
 * Exit 0 = all migrations applied
 * Exit 1 = pending migrations exist or DB unreachable
 *
 * Dependencies: pg (already in backend/package.json)
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

// ---------------------------------------------------------------------------
// Resolve canonical migration list without importing the full app
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamically import the migration index — each migration exports an `id`
async function getCanonicalIds() {
  const indexPath = path.join(__dirname, "index.js");
  const { migrations } = await import(indexPath);
  return migrations.map((m) => m.id);
}

// ---------------------------------------------------------------------------
// DB helpers — standalone, no shared pool from the server
// ---------------------------------------------------------------------------

async function getAppliedIds(client) {
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'schema_migrations'
    ) AS exists
  `);

  if (!tableCheck.rows[0]?.exists) {
    return null; // table does not exist yet
  }

  const result = await client.query("SELECT id FROM schema_migrations ORDER BY applied_at");
  return result.rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

  if (!DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set — cannot check migration status.");
    process.exit(1);
  }

  // Strip SSL query params that may conflict with the local pg driver
  let connectionString = DATABASE_URL;
  try {
    const u = new URL(DATABASE_URL);
    ["sslmode", "sslcert", "sslkey", "sslrootcert", "sslpassword"].forEach((p) =>
      u.searchParams.delete(p)
    );
    connectionString = u.toString();
  } catch {
    // invalid URL — use as-is
  }

  // Lazy import pg to avoid top-level side effects
  const { default: pgModule } = await import("pg");
  // pg exports Pool/Client as named exports via CJS interop; handle both shapes
  const Pool = pgModule.Pool ?? pgModule.default?.Pool;
  if (!Pool) {
    console.error("ERROR: could not load pg.Pool — ensure pg is installed.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 5000,
  });

  let client;
  try {
    client = await pool.connect();

    const canonicalIds = await getCanonicalIds();
    const appliedIds = await getAppliedIds(client);

    console.log("\nmigration:check\n");

    if (appliedIds === null) {
      console.warn("  WARN  schema_migrations table does not exist.");
      console.warn("        Run with RUN_MIGRATIONS=true to initialize.\n");
      console.error(`Pending: all ${canonicalIds.length} migrations\n`);
      process.exit(1);
    }

    const appliedSet = new Set(appliedIds);
    const pending = canonicalIds.filter((id) => !appliedSet.has(id));
    const unknown = appliedIds.filter((id) => !canonicalIds.includes(id));

    console.log(`  Canonical : ${canonicalIds.length} migrations`);
    console.log(`  Applied   : ${appliedIds.length} migrations`);
    console.log(`  Pending   : ${pending.length}`);
    if (unknown.length > 0) {
      console.log(`  Unknown   : ${unknown.length} (applied but not in codebase)`);
    }
    console.log();

    if (appliedIds.length > 0) {
      console.log("Applied:");
      for (const id of appliedIds) {
        console.log(`  + ${id}`);
      }
      console.log();
    }

    if (pending.length > 0) {
      console.log("Pending:");
      for (const id of pending) {
        console.log(`  - ${id}`);
      }
      console.log();
      console.error(`${pending.length} migration(s) pending — run with RUN_MIGRATIONS=true before deploy.\n`);
      process.exit(1);
    }

    if (unknown.length > 0) {
      console.warn("Unknown migrations (applied but not in codebase — may be from a future branch):");
      for (const id of unknown) {
        console.warn(`  ? ${id}`);
      }
      console.log();
    }

    console.log("All migrations applied.\n");
    process.exit(0);
  } catch (err) {
    console.error(`\nERROR: ${err.message}\n`);
    process.exit(1);
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

main();
