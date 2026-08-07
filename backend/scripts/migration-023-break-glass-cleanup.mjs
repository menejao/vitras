/**
 * migration-023-break-glass-cleanup.mjs
 *
 * VITRAS-ACCESS-SCOPE-BREAKGLASS-AND-MUNICIPAL-HIERARCHY-01
 *
 * Cleans up the break_glass_admin legacy account:
 *   - Removes unitId from the account (platform-level, not UBS-scoped)
 *   - Removes teamId from the account (not bound to any clinical team)
 *   - Removes any userUnitMemberships rows for break_glass_admin users
 *   - Adds breakGlassSessions array to app_state if absent
 *
 * Invariants:
 *   - Does NOT delete the account (ID preserved for audit trail)
 *   - Does NOT change role, password, capabilities
 *   - Idempotent: running UP twice produces same result
 *
 * Usage:
 *   node --env-file=.env scripts/migration-023-break-glass-cleanup.mjs           # dry run
 *   node --env-file=.env scripts/migration-023-break-glass-cleanup.mjs UP        # apply
 *   node --env-file=.env scripts/migration-023-break-glass-cleanup.mjs DOWN      # rollback (restore unitId/teamId from backup)
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

function log(msg) { console.log(`[migration-023] ${msg}`); }

async function main() {
  log(`Modo: ${MODE}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(202300)');

    const { rows } = await client.query('SELECT data FROM app_state WHERE id = 1 FOR UPDATE');
    if (!rows.length) {
      log('❌ app_state vazio — banco não inicializado');
      await client.query('ROLLBACK');
      return;
    }

    const state = rows[0].data;
    const users = state.users || [];

    const bgaUsers = users.filter((u) => u.role === 'break_glass_admin');
    log(`break_glass_admin accounts encontradas: ${bgaUsers.length}`);

    if (MODE === 'DRY_RUN') {
      bgaUsers.forEach((u) => {
        log(`  DRY_RUN: id=${u.id} name=${u.name} unitId=${u.unitId || '(vazio)'} teamId=${u.teamId || '(vazio)'}`);
      });

      // Show memberships
      const memberships = state.userUnitMemberships || [];
      const bgaMemberships = memberships.filter((m) => bgaUsers.some((u) => u.id === m.userId));
      log(`  Memberships para break_glass_admin: ${bgaMemberships.length}`);

      // Show breakGlassSessions
      const sessions = state.breakGlassSessions;
      log(`  breakGlassSessions array: ${Array.isArray(sessions) ? `presente (${sessions.length} registros)` : 'ausente — será criado no UP'}`);

      await client.query('ROLLBACK');
      log('DRY_RUN concluído — nenhuma alteração realizada');
      return;
    }

    if (MODE === 'UP') {
      let changed = 0;

      // Clean unitId/teamId from break_glass_admin users
      state.users = users.map((u) => {
        if (u.role !== 'break_glass_admin') return u;
        const next = { ...u };
        // Preserve for rollback reference in backup field
        if (next.unitId) { next._backup_unitId = next.unitId; delete next.unitId; changed++; }
        if (next.teamId) { next._backup_teamId = next.teamId; delete next.teamId; }
        return next;
      });

      // Remove userUnitMemberships for break_glass_admin accounts
      const memberships = state.userUnitMemberships || [];
      const bgaIds = new Set(bgaUsers.map((u) => u.id));
      const originalCount = memberships.length;
      state.userUnitMemberships = memberships.filter((m) => !bgaIds.has(m.userId));
      const removedMemberships = originalCount - state.userUnitMemberships.length;
      if (removedMemberships > 0) { log(`  Removidas ${removedMemberships} membership(s)`); changed++; }

      // Ensure breakGlassSessions array exists
      if (!Array.isArray(state.breakGlassSessions)) {
        state.breakGlassSessions = [];
        log('  Criado array breakGlassSessions');
        changed++;
      }

      await client.query('UPDATE app_state SET data = $1, updated_at = NOW() WHERE id = 1', [JSON.stringify(state)]);
      await client.query('COMMIT');
      log(`UP concluído — ${changed} operações realizadas`);
      return;
    }

    if (MODE === 'DOWN') {
      let restored = 0;

      state.users = users.map((u) => {
        if (u.role !== 'break_glass_admin') return u;
        const next = { ...u };
        if (next._backup_unitId) { next.unitId = next._backup_unitId; delete next._backup_unitId; restored++; }
        if (next._backup_teamId) { next.teamId = next._backup_teamId; delete next._backup_teamId; }
        return next;
      });

      await client.query('UPDATE app_state SET data = $1, updated_at = NOW() WHERE id = 1', [JSON.stringify(state)]);
      await client.query('COMMIT');
      log(`DOWN concluído — ${restored} contas restauradas`);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    log(`❌ Erro: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
