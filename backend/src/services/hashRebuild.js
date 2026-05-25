// F-07: Patient hash re-backfill utility
//
// When PATIENT_LOOKUP_HASH_KEY is rotated, existing cpf_hash/cns_hash values in
// app_patients become stale (computed with the old key). This utility re-computes
// all hashes using the current key and writes them to app_patients via direct SQL.
//
// Only applicable in Postgres mode — file-mode hashes are recomputed on every
// syncShadowTables call, so they are always current.

import { computeLookupHash } from "../db.js";
import { PATIENT_LOOKUP_HASH_KEY } from "../config.js";
import { logInfo, logWarn, logError } from "../utils/logger.js";

const BATCH_SIZE = 100;

let _rebuildLock = false; // prevent concurrent executions

/**
 * Re-compute cpf_hash and cns_hash for all active patients using the current
 * PATIENT_LOOKUP_HASH_KEY and update app_patients directly via pool.
 *
 * @param {import('pg').Pool} pool  - pg Pool instance (must be non-null for Postgres mode)
 * @param {object}            db    - current in-memory DB snapshot (has .patients array)
 * @param {object}            [opts]
 * @param {boolean}           [opts.dryRun=false] - if true, counts only — no DB writes
 * @returns {{ processed: number, updated: number, skipped: number, dryRun: boolean }}
 */
export async function rebuildPatientHashes(pool, db, { dryRun = false } = {}) {
  if (_rebuildLock) {
    throw Object.assign(new Error("Rebuild já em andamento"), { code: "REBUILD_IN_PROGRESS" });
  }

  _rebuildLock = true;
  const key = PATIENT_LOOKUP_HASH_KEY;

  if (!key) {
    _rebuildLock = false;
    throw new Error("PATIENT_LOOKUP_HASH_KEY não configurado");
  }

  const patients = Array.isArray(db?.patients) ? db.patients.filter((p) => !p.inactive) : [];

  logInfo("hash_rebuild_started", {
    event: "hash_rebuild_started",
    dryRun,
    patientCount: patients.length,
    timestamp: new Date().toISOString()
  });

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // Process in batches
    for (let i = 0; i < patients.length; i += BATCH_SIZE) {
      const batch = patients.slice(i, i + BATCH_SIZE);

      for (const patient of batch) {
        const cpfHash = computeLookupHash(patient.cpf, key);
        const cnsHash = computeLookupHash(patient.cns, key);

        if (!dryRun && pool) {
          try {
            await pool.query(
              `UPDATE app_patients SET cpf_hash = $1, cns_hash = $2 WHERE id = $3`,
              [cpfHash || null, cnsHash || null, patient.id]
            );
            updated++;
          } catch (err) {
            logWarn("hash_rebuild_row_error", {
              event: "hash_rebuild_row_error",
              patientId: patient.id,
              error: err.message
            });
            skipped++;
          }
        } else {
          updated++; // dry-run: count as if updated
        }
        processed++;
      }

      if (processed % 500 === 0 || processed === patients.length) {
        logInfo("hash_rebuild_progress", {
          event: "hash_rebuild_progress",
          processed,
          total: patients.length,
          updated,
          skipped,
          dryRun
        });
      }
    }

    logInfo("hash_rebuild_completed", {
      event: "hash_rebuild_completed",
      processed,
      updated,
      skipped,
      dryRun,
      timestamp: new Date().toISOString()
    });

    return { processed, updated, skipped, dryRun };

  } catch (err) {
    logError("hash_rebuild_failed", {
      event: "hash_rebuild_failed",
      error: err.message,
      dryRun
    });
    throw err;
  } finally {
    _rebuildLock = false;
  }
}
