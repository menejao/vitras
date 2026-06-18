export const id = "003_create_patient_agenda_permission_shadow_tables";

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_patients (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL DEFAULT '',
      assigned_acs_id TEXT NOT NULL DEFAULT '',
      care_category TEXT NOT NULL DEFAULT '',
      inactive BOOLEAN NOT NULL DEFAULT FALSE,
      incomplete_profile BOOLEAN NOT NULL DEFAULT FALSE,
      name TEXT NOT NULL DEFAULT '',
      micro_area TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NULL,
      updated_at TIMESTAMPTZ NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_patients_team_id ON app_patients (team_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_patients_assigned_acs_id ON app_patients (assigned_acs_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_patients_care_category ON app_patients (care_category)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_patients_inactive ON app_patients (inactive)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_patients_name ON app_patients (name)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS app_appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      demand_type TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_appointments_patient_id ON app_appointments (patient_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_appointments_created_by ON app_appointments (created_by)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_appointments_date ON app_appointments (date DESC)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS app_role_permissions (
      role TEXT NOT NULL,
      capability TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (role, capability)
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_role_permissions_role ON app_role_permissions (role)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_role_permissions_capability ON app_role_permissions (capability)`);
}
