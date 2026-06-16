export async function up(client) {
  await client.query(`ALTER TABLE app_patients ADD COLUMN IF NOT EXISTS nis TEXT`);
}
export async function down(client) {
  await client.query(`ALTER TABLE app_patients DROP COLUMN IF EXISTS nis`);
}
