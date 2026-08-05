/**
 * apply-031-032.mjs
 * Applies migrations 031 and 032 directly without importing config.js.
 * Usage: node --env-file=.env scripts/apply-031-032.mjs
 */
import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function alreadyApplied(id) {
  const { rows } = await pool.query('SELECT id FROM schema_migrations WHERE id = $1', [id]);
  return rows.length > 0;
}

async function markApplied(client, id) {
  await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
}

// ── Migration 031 ─────────────────────────────────────────────────────────────
async function up031(client) {
  const { rows: stateRows } = await client.query(
    'SELECT data FROM app_state WHERE id = 1 FOR UPDATE'
  );
  if (!stateRows.length) {
    console.log('[031] app_state vazio — skip.');
    return;
  }
  const state = stateRows[0].data || {};
  const users = Array.isArray(state.users) ? state.users : [];

  const existingIds = new Set();
  for (const u of users) {
    if (u.vitrasId) existingIds.add(String(u.vitrasId));
  }
  try {
    const { rows } = await client.query(
      "SELECT payload->>'vitrasId' AS vid FROM app_users WHERE payload->>'vitrasId' IS NOT NULL AND payload->>'vitrasId' != ''"
    );
    for (const r of rows) if (r.vid) existingIds.add(r.vid);
  } catch { /* shadow table might not have rows */ }

  function genId() {
    let tries = 0;
    while (tries++ < 200) {
      const c = String(100000000 + crypto.randomInt(0, 900000000));
      if (!existingIds.has(c)) return c;
    }
    throw new Error('Impossível gerar vitrasId único');
  }

  let changed = 0;
  const updated = users.map(u => {
    if (u.vitrasId && String(u.vitrasId).trim()) return u;
    const vitrasId = genId();
    existingIds.add(vitrasId);
    changed++;
    console.log(`[031] ${u.name || u.id} → vitrasId ${vitrasId}`);
    return { ...u, vitrasId, updatedAt: new Date().toISOString() };
  });

  if (changed === 0) {
    console.log('[031] todos os usuários já têm vitrasId — skip.');
    return;
  }

  await client.query(
    'UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1',
    [JSON.stringify({ ...state, users: updated })]
  );

  for (const u of updated) {
    if (!u.vitrasId) continue;
    try {
      await client.query(
        'UPDATE app_users SET payload = payload || $1::jsonb, updated_at = NOW() WHERE id = $2',
        [JSON.stringify({ vitrasId: u.vitrasId }), u.id]
      );
    } catch { /* shadow desync is non-fatal */ }
  }
  console.log(`[031] ${changed} usuário(s) migrado(s).`);
}

// ── Migration 032 ─────────────────────────────────────────────────────────────
// CONCURRENTLY cannot run inside a transaction — run outside
async function up032() {
  const client = await pool.connect();
  try {
    console.log('[032] Creating idx_app_patients_unit_active ...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_patients_unit_active
        ON app_patients (unit_id, inactive)
        WHERE inactive = false
    `);
    console.log('[032] Creating idx_app_patients_unit_team ...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_patients_unit_team
        ON app_patients (unit_id, team_id)
        WHERE inactive = false
    `);
    console.log('[032] Creating idx_app_patients_unit_acs ...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_patients_unit_acs
        ON app_patients (unit_id, assigned_acs_id)
        WHERE inactive = false
    `);
  } finally {
    client.release();
  }
}

async function main() {
  console.log('=== Applying migrations 031 and 032 ===');

  // Migration 031
  if (await alreadyApplied('031_fix_vitrasids_in_app_state')) {
    console.log('[031] already applied — skip.');
  } else {
    await withTransaction(async (client) => {
      await up031(client);
      await markApplied(client, '031_fix_vitrasids_in_app_state');
    });
    console.log('[031] ✓ Applied and recorded.');
  }

  // Migration 032
  if (await alreadyApplied('032_add_composite_patient_indexes')) {
    console.log('[032] already applied — skip.');
  } else {
    await up032();
    // record in its own transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await markApplied(client, '032_add_composite_patient_indexes');
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    console.log('[032] ✓ Applied and recorded.');
  }

  // Verify
  const { rows } = await pool.query(
    "SELECT id FROM schema_migrations WHERE id IN ('031_fix_vitrasids_in_app_state','032_add_composite_patient_indexes') ORDER BY id"
  );
  console.log(`\nVerification: ${rows.length}/2 migrations recorded — ${rows.map(r => r.id).join(', ')}`);

  const { rows: idxRows } = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'app_patients'
      AND indexname IN ('idx_app_patients_unit_active','idx_app_patients_unit_team','idx_app_patients_unit_acs')
    ORDER BY indexname
  `);
  console.log(`Indexes created: ${idxRows.length}/3 — ${idxRows.map(r => r.indexname).join(', ')}`);

  if (rows.length === 2 && idxRows.length === 3) {
    console.log('\n✅ Migrations 031 and 032 PASS');
  } else {
    console.log('\n❌ Verification FAILED');
    process.exit(1);
  }
}

main()
  .catch(e => { console.error('FATAL:', e.message); process.exit(1); })
  .finally(() => pool.end());
