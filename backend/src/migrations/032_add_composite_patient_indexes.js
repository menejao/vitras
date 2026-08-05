/**
 * VITRAS-PERFORMANCE-SCALE-01: Add composite indexes on app_patients for
 * common multi-filter query patterns.
 *
 * Without these, queries filtering by (unit_id, inactive) or (unit_id, team_id)
 * require two separate index scans and a bitmap AND — O(N/unit) instead of O(match).
 */
export async function up(client) {
  // Most common filter: active patients per unit
  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_patients_unit_active
      ON app_patients (unit_id, inactive)
      WHERE inactive = false
  `);

  // Team scope within a unit
  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_patients_unit_team
      ON app_patients (unit_id, team_id)
      WHERE inactive = false
  `);

  // ACS view: unit + assigned ACS
  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_patients_unit_acs
      ON app_patients (unit_id, assigned_acs_id)
      WHERE inactive = false
  `);
}

export async function down(client) {
  await client.query(`DROP INDEX IF EXISTS idx_app_patients_unit_active`);
  await client.query(`DROP INDEX IF EXISTS idx_app_patients_unit_team`);
  await client.query(`DROP INDEX IF EXISTS idx_app_patients_unit_acs`);
}
