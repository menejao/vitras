/**
 * One-shot patch: remove stale unit-default active membership for v3-inact-101.
 * Usage: node --env-file=.env scripts/patch-neon-remove-stale-membership.mjs
 */
import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não setado');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });

const { rows } = await pool.query('SELECT data FROM app_state WHERE id = 1');
if (!rows.length) { console.error('❌ app_state vazio'); await pool.end(); process.exit(1); }

const state = rows[0].data;
const before = (state.userUnitMemberships || []).filter(m => m.userId === 'v3-inact-101');
console.log('ANTES (v3-inact-101 memberships):');
before.forEach(m => console.log(` id=${m.id} unitId=${m.unitId} status=${m.status}`));

// Remove STALE unit-default active membership for v3-inact-101 specifically
const stale = state.userUnitMemberships.filter(
  m => m.userId === 'v3-inact-101' && m.unitId === 'unit-default'
);
if (stale.length === 0) {
  console.log('✓ Nenhuma membership unit-default para v3-inact-101 — nada a fazer.');
  await pool.end(); process.exit(0);
}

state.userUnitMemberships = state.userUnitMemberships.filter(
  m => !(m.userId === 'v3-inact-101' && m.unitId === 'unit-default')
);

await pool.query('UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1', [JSON.stringify(state)]);

const after = (state.userUnitMemberships || []).filter(m => m.userId === 'v3-inact-101');
console.log('DEPOIS (v3-inact-101 memberships):');
after.forEach(m => console.log(` id=${m.id} unitId=${m.unitId} status=${m.status}`));
console.log(`✓ Removidas ${stale.length} membership(s) stale. Neon atualizado.`);

await pool.end();
