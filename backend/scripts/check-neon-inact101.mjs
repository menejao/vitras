/**
 * Diagnóstico: verifica estado de v3-inact-101 no Neon.
 * Usage: node --env-file=.env scripts/check-neon-inact101.mjs
 */
import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não setado — não conectará ao Neon');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });

const { rows } = await pool.query('SELECT data FROM app_state WHERE id = 1');
if (!rows.length) { console.error('❌ app_state vazio'); await pool.end(); process.exit(1); }

const state = rows[0].data;
const users = state.users || [];
const mems = state.userUnitMemberships || [];

console.log(`✓ Neon conectado: ${users.length} users, ${mems.length} memberships`);

const u = users.find(x => x.id === 'v3-inact-101');
console.log(u ? `  v3-inact-101: unitId="${u.unitId}" updatedAt=${u.updatedAt}` : '  ❌ v3-inact-101 NÃO encontrado');

const umems = mems.filter(m => m.userId === 'v3-inact-101');
if (umems.length === 0) {
  console.log('  memberships: NENHUMA');
} else {
  umems.forEach(m => console.log(`  membership: unitId=${m.unitId} status=${m.status} id=${m.id}`));
}

await pool.end();
