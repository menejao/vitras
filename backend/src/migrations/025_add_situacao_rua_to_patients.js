export const id = "025_add_situacao_rua_to_patients";

// Rollback: ALTER TABLE app_patients DROP COLUMN IF EXISTS situacao_rua;
export async function up(client) {
  await client.query(`
    ALTER TABLE app_patients
      ADD COLUMN IF NOT EXISTS situacao_rua BOOLEAN DEFAULT NULL
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_patients_situacao_rua
      ON app_patients (situacao_rua)
      WHERE situacao_rua = true
  `);
}
