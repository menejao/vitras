export const id = "019_remove_cnscpf_from_payload";

// F7-02: Remove legacy cnsCpf field from app_patients.payload
//
// Pre-condition: D-PRE-07 v2 confirmed REDUNDANT_ONLY (41 records).
// All cnsCpf values are duplicates of payload.cpf — no unique data lost.
// Migration 018 ran first: skippedRedundant=41, zero real UPDATEs.
//
// This migration does ONE thing: remove the 'cnsCpf' key from payload JSONB.
// No other field is touched. cpf, cpf_hash, cns, cns_hash, cnsResponsavel
// and all other payload keys are untouched.
//
// Idempotent: WHERE payload ? 'cnsCpf' means re-running on already-cleaned
// rows is a no-op (condition false → zero rows updated).

export async function up(client) {
  const before = await client.query(
    `SELECT COUNT(*) AS n FROM app_patients WHERE payload ? 'cnsCpf'`
  );
  const beforeCount = Number(before.rows[0].n);

  if (beforeCount === 0) {
    console.log("[019] cnsCpf absent from all rows — nothing to do (idempotent)");
    return;
  }

  await client.query(`
    UPDATE app_patients
    SET payload = payload - 'cnsCpf'
    WHERE payload ? 'cnsCpf'
  `);

  const after = await client.query(
    `SELECT COUNT(*) AS n FROM app_patients WHERE payload ? 'cnsCpf'`
  );
  const afterCount = Number(after.rows[0].n);

  console.log(`[019] cnsCpf removed from payload:`);
  console.log(`  rows updated: ${beforeCount}`);
  console.log(`  rows remaining with cnsCpf: ${afterCount}`);

  if (afterCount !== 0) {
    throw new Error(`[019] FAIL: ${afterCount} rows still have cnsCpf after migration`);
  }
}
