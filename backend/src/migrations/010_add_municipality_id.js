export const id = "010_add_municipality_id";

export async function up(client) {
  // app_units
  await client.query(`ALTER TABLE app_units ADD COLUMN IF NOT EXISTS municipality_id TEXT NOT NULL DEFAULT ''`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_units_municipality_id ON app_units (municipality_id)`);
  await client.query(`UPDATE app_units SET municipality_id = '' WHERE municipality_id IS NULL`);

  // app_patients
  await client.query(`ALTER TABLE app_patients ADD COLUMN IF NOT EXISTS municipality_id TEXT NOT NULL DEFAULT ''`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_patients_municipality_id ON app_patients (municipality_id)`);
  await client.query(`UPDATE app_patients SET municipality_id = '' WHERE municipality_id IS NULL`);

  // app_users
  await client.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS municipality_id TEXT NOT NULL DEFAULT ''`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_users_municipality_id ON app_users (municipality_id)`);
  await client.query(`UPDATE app_users SET municipality_id = '' WHERE municipality_id IS NULL`);

  // app_audit_logs
  await client.query(`ALTER TABLE app_audit_logs ADD COLUMN IF NOT EXISTS municipality_id TEXT NOT NULL DEFAULT ''`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_audit_logs_municipality_id ON app_audit_logs (municipality_id)`);
  await client.query(`UPDATE app_audit_logs SET municipality_id = '' WHERE municipality_id IS NULL`);
}
