export const id = "020_cleanup_cnscpf_from_state";

// F7-02 completion: migration 019 updated app_patients.payload directly via SQL,
// but app_state (the authoritative JSONB blob read by withDb) still contains
// cnsCpf for all patients. The next withDb call overwrites app_patients from
// app_state, restoring cnsCpf. This migration cleans app_state and re-syncs
// app_patients to eliminate cnsCpf permanently.
//
// Idempotent: removing a non-existent key is a no-op in JSONB.

export async function up(client) {
  // Step 1: Remove cnsCpf from every patient inside the app_state JSONB blob
  const stateResult = await client.query(`
    UPDATE app_state
    SET data = jsonb_set(
      data,
      '{patients}',
      COALESCE(
        (
          SELECT jsonb_agg(patient - 'cnsCpf')
          FROM jsonb_array_elements(COALESCE(data->'patients', '[]'::jsonb)) AS patient
        ),
        '[]'::jsonb
      )
    )
    WHERE id = 1
      AND data ? 'patients'
    RETURNING 1
  `);
  const stateUpdated = stateResult.rowCount > 0;

  // Step 2: Re-sync app_patients shadow table (idempotent — was cleaned by 019
  // but may have been overwritten by subsequent withDb calls)
  const before = await client.query(
    `SELECT COUNT(*) AS n FROM app_patients WHERE payload ? 'cnsCpf'`
  );
  const beforeCount = Number(before.rows[0].n);

  if (beforeCount > 0) {
    await client.query(`
      UPDATE app_patients
      SET payload = payload - 'cnsCpf'
      WHERE payload ? 'cnsCpf'
    `);
  }

  const after = await client.query(
    `SELECT COUNT(*) AS n FROM app_patients WHERE payload ? 'cnsCpf'`
  );
  const afterCount = Number(after.rows[0].n);

  console.log("[020] cnsCpf cleanup from app_state + app_patients:");
  console.log(`  app_state updated: ${stateUpdated}`);
  console.log(`  app_patients rows with cnsCpf before: ${beforeCount}`);
  console.log(`  app_patients rows with cnsCpf after:  ${afterCount}`);

  if (afterCount !== 0) {
    throw new Error(`[020] FAIL: ${afterCount} rows still have cnsCpf in app_patients`);
  }
}
