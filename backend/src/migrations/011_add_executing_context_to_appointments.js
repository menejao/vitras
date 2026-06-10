export const id = "011_add_executing_context_to_appointments";

// NOTE: queueEntries and agendaEntries are pure JSONB in app_state — no shadow tables.
// Only app_appointments has a shadow table and requires DDL changes.

export async function up(client) {
  await client.query(`ALTER TABLE app_appointments ADD COLUMN IF NOT EXISTS executing_team_id TEXT NOT NULL DEFAULT ''`);
  await client.query(`ALTER TABLE app_appointments ADD COLUMN IF NOT EXISTS executing_unit_id TEXT NOT NULL DEFAULT ''`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_appointments_executing_team_id ON app_appointments (executing_team_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_appointments_executing_unit_id ON app_appointments (executing_unit_id)`);
  // Backfill: use patient's team_id as proxy for existing appointments
  await client.query(`
    UPDATE app_appointments aa
    SET executing_team_id = COALESCE(
      aa.payload->>'teamId',
      (SELECT ap.team_id FROM app_patients ap WHERE ap.id = aa.patient_id LIMIT 1),
      ''
    )
    WHERE executing_team_id = ''
  `);
  await client.query(`
    UPDATE app_appointments aa
    SET executing_unit_id = COALESCE(
      (
        SELECT ap.unit_id FROM app_patients ap WHERE ap.id = aa.patient_id LIMIT 1
      ),
      ''
    )
    WHERE executing_unit_id = ''
  `);
}
