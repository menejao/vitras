/**
 * migration-022-event-attribution.mjs
 *
 * FASE 8 — VITRAS-CLINICAL-EVENT-ATTRIBUTION-01
 *
 * Backfills canonical attribution fields on all existing clinical events:
 *   acsVisits, agendaEntries, exams, examRequests, referrals,
 *   dentalEncounters, odontoProcedures, prescricoes, dispensacoes, tasks
 *
 * Fields backfilled (where missing):
 *   executingUnitId        — from professional.unitId
 *   executingTeamId        — from professional.teamId
 *   executingProfessionalId — from existing professional ID alias (acsId, doctorId, etc.)
 *   referenceUnitIdAtEvent — from patient.referenceUnitId || patient.unitId
 *   referenceTeamIdAtEvent — from patient.teamId
 *   referenceAcsIdAtEvent  — acsVisits only: patient.assignedAcsId at snapshot time
 *   municipalityId         — from patient.municipalityId
 *
 * Invariants:
 *   - Never overwrites a field that is already set (non-empty string)
 *   - teamId legacy field is NEVER removed
 *   - cds-export.js unchanged
 *   - Idempotent: running UP twice produces same result
 *
 * Usage:
 *   node --env-file=.env scripts/migration-022-event-attribution.mjs           # dry run
 *   node --env-file=.env scripts/migration-022-event-attribution.mjs UP        # apply
 *   node --env-file=.env scripts/migration-022-event-attribution.mjs DOWN      # rollback
 */

import pg from 'pg';

const { Pool } = pg;

const MODE = (process.argv[2] || 'DRY_RUN').toUpperCase();
const VALID_MODES = ['DRY_RUN', 'UP', 'DOWN'];
if (!VALID_MODES.includes(MODE)) {
  console.error(`Modo inválido: ${MODE}. Use DRY_RUN, UP ou DOWN.`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não definido');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });

function log(msg) { console.log(`[migration-022] ${msg}`); }

const ATTRIBUTION_FIELDS = [
  'executingUnitId', 'executingTeamId', 'executingProfessionalId',
  'referenceUnitIdAtEvent', 'referenceTeamIdAtEvent', 'municipalityId',
];

function isSet(v) { return v !== null && v !== undefined && v !== ''; }

async function loadState(client) {
  const { rows } = await client.query('SELECT data FROM app_state WHERE id = 1 FOR UPDATE');
  if (!rows.length) throw new Error('app_state não encontrado');
  return rows[0].data;
}

function buildLookups(db) {
  const patients = {};
  for (const p of (db.patients || [])) patients[p.id] = p;

  const users = {};
  for (const u of (db.users || [])) users[u.id] = u;

  return { patients, users };
}

function fillAttribution(record, { patients, users }, opts = {}) {
  const {
    professionalId,  // field name for the executing professional ID
    patientIdField = 'patientId',
    isAcsVisit = false,
  } = opts;

  const patient = patients[record[patientIdField]];
  const profId = record[professionalId] || record.createdBy || record.dispensadoPor;
  const prof = users[profId];

  let changed = 0;

  if (!isSet(record.executingUnitId) && prof?.unitId) {
    record.executingUnitId = String(prof.unitId);
    changed++;
  }
  if (!isSet(record.executingTeamId) && (prof?.teamId || record.teamId)) {
    record.executingTeamId = String(prof?.teamId || record.teamId || '');
    changed++;
  }
  if (!isSet(record.executingProfessionalId) && profId) {
    record.executingProfessionalId = String(profId);
    changed++;
  }
  if (patient) {
    if (!isSet(record.referenceUnitIdAtEvent)) {
      record.referenceUnitIdAtEvent = String(patient.referenceUnitId || patient.unitId || '');
      changed++;
    }
    if (!isSet(record.referenceTeamIdAtEvent)) {
      record.referenceTeamIdAtEvent = String(patient.teamId || '');
      changed++;
    }
    if (!isSet(record.municipalityId)) {
      record.municipalityId = String(patient.municipalityId || '');
      changed++;
    }
    if (isAcsVisit && !isSet(record.referenceAcsIdAtEvent)) {
      record.referenceAcsIdAtEvent = String(patient.assignedAcsId || '');
      changed++;
    }
  }

  return changed;
}

function processCollection(db, collectionKey, opts, report) {
  const items = db[collectionKey] || [];
  let touched = 0;
  for (const item of items) {
    const n = fillAttribution(item, { patients: report.patients, users: report.users }, opts);
    if (n > 0) touched++;
  }
  report.collections[collectionKey] = { total: items.length, touched };
}

async function run() {
  log(`══════════════════════════════════════════════════════`);
  log(`  Migration 022 — Clinical Event Attribution    MODE: ${MODE}`);
  log(`══════════════════════════════════════════════════════`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const db = await loadState(client);

    const { patients, users } = buildLookups(db);
    const report = { patients, users, collections: {} };

    if (MODE === 'DOWN') {
      log('DOWN — removing attribution fields from all events...');
      const collections = [
        'acsVisits', 'agendaEntries', 'exams', 'examRequests', 'referrals',
        'dentalEncounters', 'odontoProcedures', 'prescricoes', 'dispensacoes',
      ];
      for (const key of collections) {
        let touched = 0;
        for (const item of (db[key] || [])) {
          let changed = false;
          for (const f of ATTRIBUTION_FIELDS) {
            if (f in item) { delete item[f]; changed = true; }
          }
          if ('referenceAcsIdAtEvent' in item) { delete item.referenceAcsIdAtEvent; changed = true; }
          if (changed) touched++;
        }
        report.collections[key] = { total: (db[key] || []).length, touched };
      }
      // tasks: remove unitId and municipalityId (keep teamId — it was set before)
      for (const item of (db.tasks || [])) {
        if ('unitId' in item) delete item.unitId;
        if ('municipalityId' in item) delete item.municipalityId;
      }
      report.collections.tasks = { total: (db.tasks || []).length, touched: (db.tasks || []).length };
    } else {
      // UP / DRY_RUN
      processCollection(db, 'acsVisits', { professionalId: 'acsId', isAcsVisit: true }, report);
      processCollection(db, 'agendaEntries', { professionalId: 'doctorId' }, report);
      processCollection(db, 'exams', { professionalId: 'createdBy' }, report);
      processCollection(db, 'examRequests', { professionalId: 'requestedById' }, report);
      processCollection(db, 'referrals', { professionalId: 'doctorId' }, report);
      processCollection(db, 'dentalEncounters', { professionalId: 'professionalId' }, report);
      processCollection(db, 'odontoProcedures', { professionalId: 'professionalId' }, report);
      processCollection(db, 'prescricoes', { professionalId: 'prescriberId' }, report);
      processCollection(db, 'dispensacoes', { professionalId: 'dispensadoPor' }, report);

      // tasks: only teamId, unitId (from creator), municipalityId
      let tasksTouched = 0;
      for (const task of (db.tasks || [])) {
        const prof = users[task.createdBy];
        const patient = patients[task.patientId];
        let changed = 0;
        if (!isSet(task.teamId) && prof?.teamId) { task.teamId = String(prof.teamId); changed++; }
        if (!isSet(task.unitId) && prof?.unitId) { task.unitId = String(prof.unitId); changed++; }
        if (!isSet(task.municipalityId) && patient?.municipalityId) {
          task.municipalityId = String(patient.municipalityId); changed++;
        }
        if (changed > 0) tasksTouched++;
      }
      report.collections.tasks = { total: (db.tasks || []).length, touched: tasksTouched };
    }

    log('');
    log('REPORT:');
    for (const [key, stat] of Object.entries(report.collections)) {
      log(`  ${key.padEnd(22)} total=${stat.total}, touched=${stat.touched}`);
    }
    log('');

    if (MODE === 'UP' || MODE === 'DOWN') {
      await client.query('UPDATE app_state SET data = $1 WHERE id = 1', [db]);
      await client.query('COMMIT');
      log(`✅ Migration 022 ${MODE} aplicada com sucesso.`);
    } else {
      await client.query('ROLLBACK');
      log('ℹ️  DRY_RUN — nenhuma alteração persistida.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    log(`❌ Erro: ${err.message}`);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => process.exit(1));
