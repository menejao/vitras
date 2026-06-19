export const id = "018_backfill_cnscpf";

// Rollback:
//   This migration is data-only and non-destructive.
//   It only sets cpf/cns from cnsCpf where cpf/cns were empty.
//   No rollback is needed — the original cnsCpf value is preserved in payload.
//   To undo: manually clear cpf/cns for affected rows (require manual review).

/**
 * Safe backfill rules (applied only when no conflict exists):
 *   cnsCpf 11 numeric digits + cpf empty → copy to cpf
 *   cnsCpf 15 numeric digits + cns empty → copy to cns
 *   cnsCpf = existing cpf or cns → REDUNDANT (skip)
 *   cnsCpf conflicts with existing cpf/cns → SKIP (requires manual resolution)
 *   cnsCpf not 11 or 15 digits → SKIP (invalid, requires manual resolution)
 *
 * cnsCpf is NOT cleared by this migration — field removal happens in a
 * subsequent migration after F7-02 is fully authorized.
 *
 * All backfilled records get a backfill_source marker in payload for audit trail.
 */
export async function up(client) {
  // Read all patients with cnsCpf set
  const result = await client.query(`
    SELECT id, payload
    FROM app_patients
    WHERE payload->>'cnsCpf' IS NOT NULL
      AND payload->>'cnsCpf' != ''
  `);

  let backfilledCpf = 0;
  let backfilledCns = 0;
  let skippedConflict = 0;
  let skippedInvalid = 0;
  let skippedRedundant = 0;

  for (const row of result.rows) {
    const payload = row.payload || {};
    const cnsCpfRaw = String(payload.cnsCpf || "").trim();
    const digits = cnsCpfRaw.replace(/\D/g, "");
    const cpf = String(payload.cpf || "").trim();
    const cns = String(payload.cns || "").trim();

    // Skip if cnsCpf is just the enc1: prefix (encrypted — skip, must run on server with keys)
    if (cnsCpfRaw.startsWith("enc1:")) {
      // Cannot process encrypted value in SQL migration — skip
      // Must run dpre07-cnscpf-audit.mjs on server first to get plaintext counts
      skippedInvalid++;
      continue;
    }

    const cpfDigits = cpf.replace(/\D/g, "");
    const cnsDigits = cns.replace(/\D/g, "");

    // Check redundancy
    if (digits === cpfDigits || digits === cnsDigits) {
      skippedRedundant++;
      continue;
    }

    if (digits.length === 11) {
      if (cpf !== "") {
        skippedConflict++;
        continue;
      }
      // Safe: backfill cnsCpf → cpf
      const updatedPayload = {
        ...payload,
        cpf: digits,
        backfill_source: "018_cnscpf_to_cpf"
      };
      await client.query(
        "UPDATE app_patients SET payload = $1 WHERE id = $2",
        [JSON.stringify(updatedPayload), row.id]
      );
      backfilledCpf++;

    } else if (digits.length === 15) {
      if (cns !== "") {
        skippedConflict++;
        continue;
      }
      // Safe: backfill cnsCpf → cns
      const updatedPayload = {
        ...payload,
        cns: digits,
        backfill_source: "018_cnscpf_to_cns"
      };
      await client.query(
        "UPDATE app_patients SET payload = $1 WHERE id = $2",
        [JSON.stringify(updatedPayload), row.id]
      );
      backfilledCns++;

    } else {
      skippedInvalid++;
    }
  }

  console.log(`[018] backfill cnsCpf complete:`);
  console.log(`  → cpf backfilled: ${backfilledCpf}`);
  console.log(`  → cns backfilled: ${backfilledCns}`);
  console.log(`  → skipped conflict: ${skippedConflict}`);
  console.log(`  → skipped invalid/encrypted: ${skippedInvalid}`);
  console.log(`  → skipped redundant: ${skippedRedundant}`);
}
