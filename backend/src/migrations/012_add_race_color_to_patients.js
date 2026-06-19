export const id = "012_add_race_color_to_patients";

// Rollback: ALTER TABLE app_patients DROP COLUMN IF EXISTS race_color;

export async function up(client) {
  await client.query(`
    ALTER TABLE app_patients ADD COLUMN IF NOT EXISTS race_color VARCHAR(20) NOT NULL DEFAULT ''
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_patients_race_color ON app_patients (race_color)
    WHERE race_color != ''
  `);
}
