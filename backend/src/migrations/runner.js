/**
 * Migration runner for Postgres mode.
 * No-ops in file mode (migrations are only needed for schema changes in Postgres).
 *
 * Usage: called from server.js when RUN_MIGRATIONS=true.
 *
 * Each migration file exports:
 *   export const id = "001_create_app_state";
 *   export async function up(client) { ... }
 */

import { Pool } from "pg";
import { logInfo, logWarn } from "../utils/logger.js";
import { getPoolSslConfig } from "../db.js";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

function stripSslParams(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    ["sslmode", "sslcert", "sslkey", "sslrootcert", "sslpassword"].forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

async function runMigrations() {
  if (!DATABASE_URL) {
    logInfo("migration_skipped_file_mode", { event: "migration_skipped_file_mode", message: "modo arquivo — sem migrations SQL" });
    return;
  }

  // KI-03: use shared SSL config with CA bundle validation
  const pool = new Pool({
    connectionString: stripSslParams(DATABASE_URL),
    ssl: getPoolSslConfig(),
    max: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    // Advisory lock prevents race when multiple instances start simultaneously.
    // Lock key 7261747261 = "vitras" in ASCII digits — unique per application.
    await client.query("SELECT pg_advisory_lock(7261747261)");

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { migrations } = await import("./index.js");

    for (const migration of migrations) {
      const { rows } = await client.query(
        "SELECT id FROM schema_migrations WHERE id = $1",
        [migration.id]
      );
      if (rows.length > 0) {
        logInfo("migration_already_applied", { event: "migration_already_applied", migrationId: migration.id });
        continue;
      }

      logInfo("migration_applying", { event: "migration_applying", migrationId: migration.id });
      await client.query("BEGIN");
      try {
        await migration.up(client);
        await client.query(
          "INSERT INTO schema_migrations (id) VALUES ($1)",
          [migration.id]
        );
        await client.query("COMMIT");
        logInfo("migration_applied_ok", { event: "migration_applied_ok", migrationId: migration.id });
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${migration.id} falhou: ${err.message}`);
      }
    }

    logInfo("migration_all_applied", { event: "migration_all_applied" });
  } finally {
    try { await client.query("SELECT pg_advisory_unlock(7261747261)"); } catch (_) {}
    client.release();
    await pool.end();
  }
}

export { runMigrations };
