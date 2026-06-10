export const id = "004_add_org_scope_columns";

export async function up(client) {
  // Units shadow table — one unit = one UBS
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      inactive BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NULL,
      updated_at TIMESTAMPTZ NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_units_name ON app_units (name)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_units_inactive ON app_units (inactive)`);

  // Add unit_id to users (idempotent — IF NOT EXISTS requires Postgres 9.6+)
  await client.query(`
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS unit_id TEXT NOT NULL DEFAULT ''
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_users_unit_id ON app_users (unit_id)`);
}
