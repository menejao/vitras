// 033_add_uuid_pk_to_municipalities.js
// Adds internal UUID PK to municipalities table.
// ibge_code remains UNIQUE NOT NULL — used for FK from app_units and CDS export.
// All new internal relationships (future epics) reference municipalities.id (UUID).
export const id = "033_add_uuid_pk_to_municipalities";

export async function up(client) {
  // Enable pgcrypto if not already (gen_random_uuid may use it on older PG)
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  // Add id column (nullable first so we can backfill)
  await client.query(`
    ALTER TABLE municipalities
      ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid()
  `);

  // Backfill any rows that somehow got NULL (should be none due to DEFAULT)
  await client.query(`
    UPDATE municipalities SET id = gen_random_uuid() WHERE id IS NULL
  `);

  // Make NOT NULL
  await client.query(`
    ALTER TABLE municipalities ALTER COLUMN id SET NOT NULL
  `);

  // Add created_at (was missing in 021)
  await client.query(`
    ALTER TABLE municipalities
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  // Drop old PK (ibge_code was PRIMARY KEY in 021)
  await client.query(`
    ALTER TABLE municipalities DROP CONSTRAINT IF EXISTS municipalities_pkey
  `);

  // New PK on UUID
  await client.query(`
    ALTER TABLE municipalities ADD PRIMARY KEY (id)
  `);

  // ibge_code must remain UNIQUE (FK from app_units + CDS export depends on it)
  await client.query(`
    ALTER TABLE municipalities
      ADD CONSTRAINT municipalities_ibge_code_key UNIQUE (ibge_code)
  `);

  // Index on id for UUID lookups
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_municipalities_id ON municipalities (id)
  `);
}

export async function down(client) {
  // Restore ibge_code as PRIMARY KEY, remove UUID column.
  // Safe only if no other table references municipalities.id.
  await client.query(`DROP INDEX IF EXISTS idx_municipalities_id`);
  await client.query(`ALTER TABLE municipalities DROP CONSTRAINT IF EXISTS municipalities_ibge_code_key`);
  await client.query(`ALTER TABLE municipalities DROP CONSTRAINT IF EXISTS municipalities_pkey`);
  await client.query(`ALTER TABLE municipalities ADD PRIMARY KEY (ibge_code)`);
  await client.query(`ALTER TABLE municipalities DROP COLUMN IF EXISTS id`);
  await client.query(`ALTER TABLE municipalities DROP COLUMN IF EXISTS created_at`);
}
