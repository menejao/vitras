#!/usr/bin/env node
/**
 * One-shot repair: removes migration 033 from schema_migrations (if present)
 * and re-runs it. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/repair-migration-033.mjs
 */
import pg from "pg";
import { up } from "../src/migrations/033_add_uuid_pk_to_municipalities.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }

function stripSsl(url) {
  try {
    const u = new URL(url);
    ["sslmode","sslcert","sslkey","sslrootcert","sslpassword"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return url; }
}

const pool = new pg.Pool({ connectionString: stripSsl(DATABASE_URL), ssl: { rejectUnauthorized: true }, max: 1 });
const client = await pool.connect();

try {
  // Check current state
  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'municipalities' AND column_name = 'id'
  `);
  if (cols.length > 0) {
    console.log("✓ municipalities.id already exists — migration 033 already applied. Nothing to do.");
    process.exit(0);
  }

  // Check if registered in schema_migrations
  const { rows: reg } = await client.query(
    "SELECT id FROM schema_migrations WHERE id = '033_add_uuid_pk_to_municipalities'"
  );
  if (reg.length > 0) {
    console.log("⚠ Migration 033 registered in schema_migrations but column absent — was a partial failure.");
    console.log("  Removing stale schema_migrations entry...");
    await client.query("DELETE FROM schema_migrations WHERE id = '033_add_uuid_pk_to_municipalities'");
    console.log("  Removed.");
  } else {
    console.log("Migration 033 not yet applied. Running now...");
  }

  // Run migration
  await client.query("BEGIN");
  try {
    await up(client);
    await client.query(
      "INSERT INTO schema_migrations (id) VALUES ('033_add_uuid_pk_to_municipalities') ON CONFLICT DO NOTHING"
    );
    await client.query("COMMIT");
    console.log("\n✓ Migration 033 applied successfully.");
    console.log("  municipalities.id UUID PK created.");
    console.log("  FK fk_app_units_municipality_id recreated → municipalities(ibge_code).");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n✗ Migration failed:", err.message);
    process.exit(1);
  }

  // Verify
  const { rows: verify } = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'municipalities' AND column_name IN ('id', 'created_at')
    ORDER BY column_name
  `);
  console.log("\nVerification:");
  verify.forEach(r => console.log(`  municipalities.${r.column_name} — ${r.data_type}`));

} finally {
  client.release();
  await pool.end();
}
