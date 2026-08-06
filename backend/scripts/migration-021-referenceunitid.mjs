/**
 * migration-021-referenceunitid.mjs
 *
 * FASE 1 — VITRAS-GLOBAL-PATIENT-REFERENCE-ATTRIBUTION-01
 *
 * Mapeia patient.unitId → referenceUnitId para todos os 851 pacientes.
 * Preserva unitId intacto (backward compat com cds-export.js).
 * Corrige o 1 paciente com municipalityId ausente (unit-default).
 *
 * Modos:
 *   DRY_RUN (padrão)   — sem escrita, apenas relatório
 *   UP                  — aplica a migration
 *   DOWN                — rollback: remove referenceUnitId de todos os pacientes
 *
 * Usage:
 *   node --env-file=.env scripts/migration-021-referenceunitid.mjs           # dry run
 *   node --env-file=.env scripts/migration-021-referenceunitid.mjs UP        # apply
 *   node --env-file=.env scripts/migration-021-referenceunitid.mjs DOWN      # rollback
 *
 * Invariantes:
 *   - Nunca sobrescreve referenceUnitId já preenchido sem comparar com unitId
 *   - Divergência entre unitId e referenceUnitId preexistente → BLOCKED, sem escrita
 *   - cds-export.js não é tocado
 *   - appointment.unitId não é tocado
 */

import pg from 'pg';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
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

const MUNICIPALITY_ID = process.env.MUNICIPALITY_ID || '4299999';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });

function log(msg) { console.log(`[migration-021] ${msg}`); }

async function loadState(client) {
  const { rows } = await client.query('SELECT data FROM app_state WHERE id = 1 FOR UPDATE');
  if (!rows.length) throw new Error('app_state não encontrado');
  return rows[0].data;
}

async function run() {
  log(`══════════════════════════════════════════════════════`);
  log(`  Migration 021 — referenceUnitId    MODE: ${MODE}`);
  log(`══════════════════════════════════════════════════════`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const db = await loadState(client);
    const patients = db.patients || [];

    log(`Pacientes totais: ${patients.length}`);

    // ── Análise ────────────────────────────────────────────────────────────────
    let wouldSet = 0;        // unitId → referenceUnitId (novo)
    let alreadySet = 0;      // referenceUnitId já preenchido, igual a unitId
    let diverged = [];       // referenceUnitId preexistente ≠ unitId → BLOCKED
    let missingMuni = [];    // municipalityId ausente
    let wouldFixMuni = 0;    // pacientes que receberiam municipalityId via correção

    for (const p of patients) {
      const uid = String(p.unitId || '').trim();
      const refUid = String(p.referenceUnitId || '').trim();
      const muni = String(p.municipalityId || '').trim();

      // municipalityId ausente
      if (!muni) missingMuni.push({ id: p.id, name: p.name, unitId: uid });

      if (MODE === 'DOWN') continue; // análise DOWN apenas conta

      if (refUid) {
        // Já tem referenceUnitId — verificar divergência
        if (refUid !== uid) {
          diverged.push({ id: p.id, name: p.name, unitId: uid, referenceUnitId: refUid });
        } else {
          alreadySet++;
        }
      } else {
        // Não tem — vai receber referenceUnitId = unitId
        wouldSet++;
      }
    }

    // ── Relatório pré-execução ─────────────────────────────────────────────────
    log(`\nRelatório:`);
    log(`  Sem referenceUnitId (seriam preenchidos): ${wouldSet}`);
    log(`  Já com referenceUnitId correto:           ${alreadySet}`);
    log(`  Com divergência (BLOCKED):                ${diverged.length}`);
    log(`  Sem municipalityId (seriam corrigidos):   ${missingMuni.length}`);

    if (missingMuni.length) {
      log(`\n  Pacientes sem municipalityId:`);
      missingMuni.forEach(p => log(`    id=${p.id} name="${p.name}" unitId=${p.unitId}`));
    }

    if (diverged.length > 0) {
      log(`\n❌ BLOCKED — Divergência detectada em ${diverged.length} paciente(s):`);
      diverged.forEach(p => log(`  id=${p.id} name="${p.name}" unitId=${p.unitId} referenceUnitId=${p.referenceUnitId}`));
      log(`  Nenhuma escrita realizada.`);
      await client.query('ROLLBACK');
      process.exit(2);
    }

    if (MODE === 'DRY_RUN') {
      log(`\n✓ DRY RUN concluído. Nenhuma escrita realizada.`);
      log(`  Para aplicar: node --env-file=.env scripts/migration-021-referenceunitid.mjs UP`);
      await client.query('ROLLBACK');
      return;
    }

    // ── DOWN: rollback ─────────────────────────────────────────────────────────
    if (MODE === 'DOWN') {
      let removed = 0;
      const patched = patients.map(p => {
        if ('referenceUnitId' in p) {
          removed++;
          const { referenceUnitId, ...rest } = p;
          return rest;
        }
        return p;
      });
      const newDb = { ...db, patients: patched };
      await client.query('UPDATE app_state SET data = $1 WHERE id = 1', [newDb]);
      await client.query('COMMIT');
      log(`\n✓ DOWN concluído. referenceUnitId removido de ${removed} pacientes.`);
      return;
    }

    // ── UP: aplicar ────────────────────────────────────────────────────────────
    let applied = 0;
    let muniFixed = 0;

    const patched = patients.map(p => {
      const uid = String(p.unitId || '').trim();
      const muni = String(p.municipalityId || '').trim();
      let updated = { ...p };

      // Preencher referenceUnitId onde ausente
      if (!String(p.referenceUnitId || '').trim()) {
        updated.referenceUnitId = uid;
        applied++;
      }

      // Corrigir municipalityId ausente
      if (!muni) {
        updated.municipalityId = MUNICIPALITY_ID;
        muniFixed++;
        log(`  ✓ municipalityId preenchido: id=${p.id} name="${p.name}" → ${MUNICIPALITY_ID}`);
      }

      return updated;
    });

    // ── Validação pós-patch ────────────────────────────────────────────────────
    const postDiverged = patched.filter(p => {
      const uid = String(p.unitId || '').trim();
      const refUid = String(p.referenceUnitId || '').trim();
      return refUid && uid && refUid !== uid;
    });

    if (postDiverged.length > 0) {
      log(`\n❌ BLOCKED — Divergência pós-patch em ${postDiverged.length} paciente(s). Fazendo ROLLBACK.`);
      postDiverged.forEach(p => log(`  id=${p.id} unitId=${p.unitId} referenceUnitId=${p.referenceUnitId}`));
      await client.query('ROLLBACK');
      process.exit(3);
    }

    const newDb = { ...db, patients: patched };
    await client.query('UPDATE app_state SET data = $1 WHERE id = 1', [newDb]);
    await client.query('COMMIT');

    log(`\n✓ UP concluído.`);
    log(`  referenceUnitId preenchido: ${applied} pacientes`);
    log(`  municipalityId corrigido:   ${muniFixed} pacientes`);
    log(`\n  Distribuição final de referenceUnitId:`);

    // distribuição pós-aplicação
    const dist = {};
    patched.forEach(p => {
      const k = p.referenceUnitId || '(vazio)';
      dist[k] = (dist[k] || 0) + 1;
    });
    Object.entries(dist).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => log(`    ${k}: ${v}`));

    log(`\n  Para rollback: node --env-file=.env scripts/migration-021-referenceunitid.mjs DOWN`);

  } catch (err) {
    await client.query('ROLLBACK');
    log(`❌ Erro: ${err.message}`);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
