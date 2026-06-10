export const id = "009_add_unit_id_to_patients";

export async function up(client) {
  // Add unit_id to app_patients shadow table
  await client.query(`
    ALTER TABLE app_patients ADD COLUMN IF NOT EXISTS unit_id TEXT NOT NULL DEFAULT ''
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_patients_unit_id ON app_patients (unit_id)
  `);
  // Backfill: derive unit_id from app_state.data.teams for each patient's team_id
  await client.query(`
    UPDATE app_patients ap
    SET unit_id = COALESCE(
      (
        SELECT elem->>'unitId'
        FROM app_state,
             jsonb_array_elements(data->'teams') AS elem
        WHERE elem->>'id' = ap.team_id
        LIMIT 1
      ),
      ''
    )
    WHERE unit_id = ''
  `);
}
