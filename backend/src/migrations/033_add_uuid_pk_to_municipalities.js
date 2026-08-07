// 033_add_uuid_pk_to_municipalities.js
// Adds internal UUID PK to municipalities table.
// ibge_code remains UNIQUE NOT NULL — used for FK from app_units and CDS export.
// All new internal relationships (future epics) reference municipalities.id (UUID).
export const id = "033_add_uuid_pk_to_municipalities";

export async function up(client) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await client.query(`
    ALTER TABLE municipalities
      ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid()
  `);

  await client.query(`
    UPDATE municipalities SET id = gen_random_uuid() WHERE id IS NULL
  `);

  await client.query(`
    ALTER TABLE municipalities ALTER COLUMN id SET NOT NULL
  `);

  await client.query(`
    ALTER TABLE municipalities
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  // Drop FK from app_units that references municipalities(ibge_code) as PK.
  // Required before we can drop the PK constraint — Postgres blocks PK removal
  // while a FK in another table references it.
  await client.query(`
    ALTER TABLE app_units
      DROP CONSTRAINT IF EXISTS fk_app_units_municipality_id
  `);

  // Drop old PK (ibge_code was PRIMARY KEY in migration 021)
  await client.query(`
    ALTER TABLE municipalities DROP CONSTRAINT IF EXISTS municipalities_pkey
  `);

  // New PK on UUID
  await client.query(`
    ALTER TABLE municipalities ADD PRIMARY KEY (id)
  `);

  // ibge_code remains UNIQUE — FK from app_units and CDS export depend on it
  await client.query(`
    ALTER TABLE municipalities
      ADD CONSTRAINT municipalities_ibge_code_key UNIQUE (ibge_code)
  `);

  // Re-create FK now referencing the UNIQUE constraint on ibge_code (not the PK)
  await client.query(`
    ALTER TABLE app_units
      ADD CONSTRAINT fk_app_units_municipality_id
      FOREIGN KEY (municipality_id)
      REFERENCES municipalities (ibge_code)
      ON DELETE RESTRICT
  `);

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
