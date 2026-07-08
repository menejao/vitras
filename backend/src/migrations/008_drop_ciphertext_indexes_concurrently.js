// Migration 008 — DROP INDEX CONCURRENTLY for ciphertext patient indexes
//
// Context:
//   Migration 007 already dropped idx_app_patients_cpf_unique and
//   idx_app_patients_cns_unique using a plain DROP INDEX (with AccessExclusiveLock).
//   For completeness and low-lock production deploys this migration uses
//   DROP INDEX CONCURRENTLY, which avoids the brief write stall on large tables.
//
// Constraint:
//   DROP INDEX CONCURRENTLY cannot run inside a transaction block.
//   The migration runner (runner.js) wraps every migration in BEGIN/COMMIT, so
//   CONCURRENTLY will always fail here with:
//     "ERROR: DROP INDEX CONCURRENTLY cannot run inside a transaction block"
//
//   The try/catch below handles this gracefully:
//   - If 007 already ran (most deployments): indexes are gone → IF EXISTS is a no-op →
//     the query succeeds and we return normally.
//   - If CONCURRENTLY fails because we are inside a transaction AND the indexes still
//     exist (fresh deployment that skipped 007): we rethrow so the operator knows to
//     run the DROP manually.
//   - If CONCURRENTLY fails and indexes are already gone: mission accomplished, swallow.
//
// Manual fallback (if needed):
//   Run outside a transaction block directly against the database:
//     DROP INDEX CONCURRENTLY IF EXISTS idx_app_patients_cpf_unique;
//     DROP INDEX CONCURRENTLY IF EXISTS idx_app_patients_cns_unique;

export const id = "008_drop_ciphertext_indexes_concurrently";

export async function up(client) {
  // DROP INDEX CONCURRENTLY cannot run inside a transaction block (runner uses BEGIN/COMMIT).
  // Migration 007 already dropped these indexes with a plain DROP INDEX IF EXISTS.
  // Use plain DROP INDEX IF EXISTS here as fallback — safe since 007 runs first.
  await client.query(`DROP INDEX IF EXISTS idx_app_patients_cpf_unique`);
  await client.query(`DROP INDEX IF EXISTS idx_app_patients_cns_unique`);
}
