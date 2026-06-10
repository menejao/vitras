/**
 * Unit tests for checkCriticalMigrations boot guard (EB-01).
 *
 * These tests do NOT start the full HTTP server — they invoke the function
 * directly by importing it from a thin wrapper, or by mocking the pool.
 * Since checkCriticalMigrations is not exported from server.js (it is an
 * internal startup function), we test its logic by setting env vars and
 * running it through a mock-pool shim defined here.
 *
 * NOTE: CRITICAL_MIGRATIONS below is a minimal fixture for unit-testing the
 * boot-guard logic (skip/throw/resolve behaviour). The canonical production
 * list lives in server.js and currently covers 006, 009, 010, 011.
 *
 * Test matrix:
 *   1. IS_PROD=false  → resolves immediately without touching the DB
 *   2. DATABASE_URL absent → resolves immediately without touching the DB
 *   3. schema_migrations table missing → throws fatal error
 *   4. 006_patient_hash_columns absent → throws fatal error
 *   5. 006_patient_hash_columns present → resolves (boot_migrations_ok)
 *   6. client.release() called even when query throws
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline re-implementation of checkCriticalMigrations for unit testing.
// Mirrors server.js exactly; any logic change there must be reflected here.
// ---------------------------------------------------------------------------

const CRITICAL_MIGRATIONS = ["006_patient_hash_columns"];

async function checkCriticalMigrations({ isProd, databaseUrl, mockPool }) {
  if (!isProd || !databaseUrl) return; // dev/test/file-mode: skip

  let client;
  try {
    client = await mockPool.connect();

    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'schema_migrations'
      ) AS exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      throw new Error("Boot abortado: schema_migrations não encontrada. Configure RUN_MIGRATIONS=true.");
    }

    const result = await client.query(
      `SELECT id FROM schema_migrations WHERE id = ANY($1)`,
      [CRITICAL_MIGRATIONS]
    );

    const applied = new Set(result.rows.map((r) => r.id));
    const missing = CRITICAL_MIGRATIONS.filter((id) => !applied.has(id));

    if (missing.length > 0) {
      throw new Error(`Boot abortado: migrations críticas não aplicadas: ${missing.join(", ")}`);
    }
  } finally {
    client?.release();
  }
}

// ---------------------------------------------------------------------------
// Mock pool factory
// ---------------------------------------------------------------------------

function makeMockPool({ tableExists, appliedMigrations = [] }) {
  const released = { count: 0 };
  const client = {
    release() { released.count++; },
    async query(sql) {
      // tableCheck query
      if (/information_schema\.tables/.test(sql)) {
        return { rows: [{ exists: tableExists }] };
      }
      // critical migrations query
      if (/schema_migrations/.test(sql)) {
        const rows = appliedMigrations.map((id) => ({ id }));
        return { rows };
      }
      return { rows: [] };
    }
  };
  return {
    async connect() { return client; },
    _released: released
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkCriticalMigrations (EB-01 boot guard)", () => {

  it("1. skips entirely when IS_PROD=false (dev mode)", async () => {
    // Must resolve without calling pool.connect() at all
    let connectCalled = false;
    const mockPool = {
      async connect() { connectCalled = true; throw new Error("should not reach DB"); }
    };

    await assert.doesNotReject(
      checkCriticalMigrations({ isProd: false, databaseUrl: "postgres://host/db", mockPool })
    );
    assert.equal(connectCalled, false, "pool.connect should NOT be called in dev mode");
  });

  it("2. skips entirely when DATABASE_URL is absent (file mode)", async () => {
    let connectCalled = false;
    const mockPool = {
      async connect() { connectCalled = true; throw new Error("should not reach DB"); }
    };

    await assert.doesNotReject(
      checkCriticalMigrations({ isProd: true, databaseUrl: "", mockPool })
    );
    assert.equal(connectCalled, false, "pool.connect should NOT be called in file mode");
  });

  it("3. throws when schema_migrations table does not exist", async () => {
    const mockPool = makeMockPool({ tableExists: false });

    await assert.rejects(
      checkCriticalMigrations({ isProd: true, databaseUrl: "postgres://host/db", mockPool }),
      (err) => {
        assert.ok(err.message.includes("schema_migrations"), `expected 'schema_migrations' in error: ${err.message}`);
        return true;
      }
    );
  });

  it("4. throws when 006_patient_hash_columns is not applied", async () => {
    // Table exists but no migrations recorded
    const mockPool = makeMockPool({ tableExists: true, appliedMigrations: [] });

    await assert.rejects(
      checkCriticalMigrations({ isProd: true, databaseUrl: "postgres://host/db", mockPool }),
      (err) => {
        assert.ok(
          err.message.includes("006_patient_hash_columns"),
          `expected migration id in error: ${err.message}`
        );
        return true;
      }
    );
  });

  it("5. resolves when 006_patient_hash_columns is applied", async () => {
    const mockPool = makeMockPool({
      tableExists: true,
      appliedMigrations: ["006_patient_hash_columns"]
    });

    await assert.doesNotReject(
      checkCriticalMigrations({ isProd: true, databaseUrl: "postgres://host/db", mockPool }),
      "boot guard should resolve when all critical migrations are present"
    );
  });

  it("6. client.release() is called even when query throws", async () => {
    let releaseCount = 0;
    const client = {
      release() { releaseCount++; },
      async query() { throw new Error("simulated DB error"); }
    };
    const mockPool = { async connect() { return client; } };

    await assert.rejects(
      checkCriticalMigrations({ isProd: true, databaseUrl: "postgres://host/db", mockPool })
    );
    assert.equal(releaseCount, 1, "client.release() must be called exactly once on error");
  });

});
