// Migration 006 — CPF/CNS deterministic HMAC-SHA256 shadow columns
//
// Problem: migration 005 created unique indexes on payload->>'cpf' (encrypted text).
// AES-256-GCM uses a random 12-byte IV per call, so the same CPF produces a
// different ciphertext each time — those indexes never fire and give zero protection.
//
// Fix:
//  1. Add cpf_hash / cns_hash TEXT columns to app_patients
//  2. Backfill: read the decrypted app_state JSONB, compute HMAC-SHA256(plaintext, key)
//     for every patient, and write the hash to the shadow column
//  3. Pre-flight duplicate check on the hash values
//  4. Create unique partial indexes on cpf_hash / cns_hash (active patients only)
//  5. Create non-unique lookup indexes for SELECT queries

import crypto from "node:crypto";

const ENC_PREFIX = "enc1:";

function isEncryptedText(value) {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

// Minimal inline decrypt matching db.js — avoids circular import in migration context
function decryptField(value, aesKey) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!isEncryptedText(raw)) return raw; // already plaintext (dev/test)
  if (!aesKey) throw new Error("DATA_ENCRYPTION_KEY required to decrypt patient fields in migration 006");

  const [, payload] = raw.split(ENC_PREFIX);
  const [ivB64, encB64, tagB64] = String(payload || "").split(":");
  if (!ivB64 || !encB64 || !tagB64) throw new Error("Invalid encrypted field format in migration 006");

  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function computeLookupHash(value, hmacKey) {
  if (!value || !hmacKey) return null;
  const normalised = String(value).trim();
  if (!normalised) return null;
  return crypto.createHmac("sha256", hmacKey).update(normalised).digest("hex");
}

export const id = "006_patient_hash_columns";

export async function up(client) {
  // Step 1: add hash columns (idempotent)
  await client.query(`ALTER TABLE app_patients ADD COLUMN IF NOT EXISTS cpf_hash TEXT`);
  await client.query(`ALTER TABLE app_patients ADD COLUMN IF NOT EXISTS cns_hash TEXT`);

  // Step 2: backfill hashes from the decrypted app_state JSONB
  const rawDataEncKey = String(process.env.DATA_ENCRYPTION_KEY || "").trim();
  const rawHashKey = String(process.env.PATIENT_LOOKUP_HASH_KEY || process.env.DATA_ENCRYPTION_KEY || "").trim();

  if (!rawHashKey) {
    // No key configured — skip backfill and index creation; columns exist for future use
    console.warn("[migration 006] PATIENT_LOOKUP_HASH_KEY not set — skipping backfill and unique index creation");
    return;
  }

  // Derive AES key the same way db.js does (SHA-256 of the raw string)
  const aesKey = rawDataEncKey
    ? crypto.createHash("sha256").update(rawDataEncKey).digest()
    : null;

  const stateResult = await client.query("SELECT data FROM app_state WHERE id = 1");
  const stateData = stateResult.rows[0]?.data || {};
  const patients = Array.isArray(stateData.patients) ? stateData.patients : [];

  let backfillCount = 0;
  for (const patient of patients) {
    if (!patient?.id) continue;

    let cpfPlain = "";
    let cnsPlain = "";
    try {
      cpfPlain = patient.cpf ? decryptField(patient.cpf, aesKey) : "";
      cnsPlain = patient.cns ? decryptField(patient.cns, aesKey) : "";
    } catch (decErr) {
      // Log and skip — better to have null hash than to abort the whole migration
      console.warn(`[migration 006] Could not decrypt fields for patient ${patient.id}: ${decErr.message}`);
      continue;
    }

    const cpfHash = computeLookupHash(cpfPlain, rawHashKey);
    const cnsHash = computeLookupHash(cnsPlain, rawHashKey);

    if (cpfHash || cnsHash) {
      await client.query(
        `UPDATE app_patients SET cpf_hash = $1, cns_hash = $2 WHERE id = $3`,
        [cpfHash || null, cnsHash || null, String(patient.id)]
      );
      backfillCount++;
    }
  }

  console.log(`[migration 006] Backfilled ${backfillCount} of ${patients.length} patients`);

  // Step 3: non-unique lookup indexes (for SELECT performance)
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_patients_cpf_hash_lookup
    ON app_patients (cpf_hash)
    WHERE cpf_hash IS NOT NULL AND cpf_hash != ''
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_patients_cns_hash_lookup
    ON app_patients (cns_hash)
    WHERE cns_hash IS NOT NULL AND cns_hash != ''
  `);

  // Step 4: pre-flight duplicate check before creating unique indexes
  const cpfDupes = await client.query(`
    SELECT cpf_hash, COUNT(*) AS cnt
    FROM app_patients
    WHERE cpf_hash IS NOT NULL AND cpf_hash != ''
      AND (payload->>'inactive')::boolean IS NOT TRUE
    GROUP BY cpf_hash
    HAVING COUNT(*) > 1
  `);

  if (cpfDupes.rows.length > 0) {
    const detail = cpfDupes.rows.map((r) => `hash=${r.cpf_hash?.slice(0, 12)}… (${r.cnt}x)`).join(", ");
    throw new Error(
      `Migration 006 abortada: CPF hash duplicados detectados em pacientes ativos: ${detail}. Corrija os duplicados antes de prosseguir.`
    );
  }

  const cnsDupes = await client.query(`
    SELECT cns_hash, COUNT(*) AS cnt
    FROM app_patients
    WHERE cns_hash IS NOT NULL AND cns_hash != ''
      AND (payload->>'inactive')::boolean IS NOT TRUE
    GROUP BY cns_hash
    HAVING COUNT(*) > 1
  `);

  if (cnsDupes.rows.length > 0) {
    const detail = cnsDupes.rows.map((r) => `hash=${r.cns_hash?.slice(0, 12)}… (${r.cnt}x)`).join(", ");
    throw new Error(
      `Migration 006 abortada: CNS hash duplicados detectados em pacientes ativos: ${detail}. Corrija os duplicados antes de prosseguir.`
    );
  }

  // Step 5: create unique partial indexes on hash columns (active patients only)
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_patients_cpf_hash_unique
    ON app_patients (cpf_hash)
    WHERE cpf_hash IS NOT NULL AND cpf_hash != ''
      AND (payload->>'inactive')::boolean IS NOT TRUE
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_patients_cns_hash_unique
    ON app_patients (cns_hash)
    WHERE cns_hash IS NOT NULL AND cns_hash != ''
      AND (payload->>'inactive')::boolean IS NOT TRUE
  `);

  console.log("[migration 006] cpf_hash/cns_hash unique partial indexes created successfully");
}
