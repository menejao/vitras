// Migration 007 — Drop inert unique indexes from migration 005
//
// Problem: migration 005 created unique indexes on payload->>'cpf' and payload->>'cns',
// which are AES-256-GCM ciphertext. Because AES-GCM uses a random IV per encryption,
// the same plaintext produces a different ciphertext each time — those indexes never
// enforced real uniqueness and gave zero protection against duplicate CPF/CNS.
//
// Fix: drop them. Migration 006 already created correct uniqueness enforcement via
// cpf_hash/cns_hash HMAC-SHA256 columns with proper unique partial indexes.
//
// Safe: IF EXISTS means this is idempotent — clean installs without 005 are unaffected.

export const id = "007_drop_ciphertext_patient_indexes";

export async function up(client) {
  await client.query(`DROP INDEX IF EXISTS idx_app_patients_cpf_unique`);
  await client.query(`DROP INDEX IF EXISTS idx_app_patients_cns_unique`);
}
