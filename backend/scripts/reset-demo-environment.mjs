/**
 * reset-demo-environment.mjs
 *
 * Resets the connected Neon database to a clean state ready for demo seeding.
 *
 * SAFETY GUARDS:
 *   - Requires DEMO_RESET_ALLOWED=true in environment
 *   - Blocks if RENDER environment is detected without explicit override
 *   - Preserves break_glass_admin account exactly
 *   - Preserves schema_migrations, ciap2, cid10, municipalities tables
 *   - Requires explicit --execute flag (default is --dry-run)
 *   - Logs every action with timestamps
 *   - Non-zero exit on any failure
 *
 * Usage:
 *   node --env-file=.env scripts/reset-demo-environment.mjs --dry-run
 *   node --env-file=.env scripts/reset-demo-environment.mjs --execute
 *
 * Environment:
 *   DEMO_RESET_ALLOWED=true   (required)
 *   DATABASE_URL              (required)
 *   DEMO_TARGET_ENV=staging   (optional, for documentation)
 */

import pg from 'pg';
import { createHmac } from 'crypto';

const { Pool } = pg;

// ── CLI Args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute') || args.includes('--dry-run');
const isExecute = args.includes('--execute') && !args.includes('--dry-run');

if (!isDryRun && !isExecute) {
  console.error('Usage: reset-demo-environment.mjs [--dry-run|--execute]');
  process.exit(1);
}

// ── Safety Guards ─────────────────────────────────────────────────────────────
function guard(condition, message) {
  if (!condition) {
    console.error(`\n❌ BLOCKED: ${message}\n`);
    process.exit(2);
  }
}

guard(
  process.env.DEMO_RESET_ALLOWED === 'true',
  'DEMO_RESET_ALLOWED=true is required. Set it explicitly to confirm this is a demo environment.'
);

guard(
  !!process.env.DATABASE_URL,
  'DATABASE_URL not set.'
);

// Block if this appears to be the Render production service
// Render sets RENDER=true in its environment
guard(
  !process.env.RENDER,
  'RENDER environment variable detected — refusing to reset on Render service. Run only against local/staging DB.'
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const dryLog = (msg) => console.log(`[DRY-RUN] ${msg}`);
const sep = () => console.log('─'.repeat(70));

function maskUrl(url) {
  try {
    return url.replace(/:\/\/[^@]*@/, '://***:***@');
  } catch { return '***'; }
}

// ── Connection ─────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── Probe Phase ───────────────────────────────────────────────────────────────
async function probeEnvironment() {
  sep();
  log('=== ENVIRONMENT PROBE ===');
  sep();

  const dbInfo = await query("SELECT current_database() as db, pg_size_pretty(pg_database_size(current_database())) as size");
  log(`DATABASE:    ${dbInfo.rows[0].db}`);
  log(`DB SIZE:     ${dbInfo.rows[0].size}`);
  log(`DB URL:      ${maskUrl(process.env.DATABASE_URL)}`);
  log(`MODE:        ${isDryRun ? 'DRY RUN (no changes)' : 'EXECUTE (destructive!)'}`);
  log(`NODE_ENV:    ${process.env.NODE_ENV || 'not set'}`);
  sep();

  // Count records
  const counts = {};
  const tables = ['app_state', 'app_patients', 'app_users', 'app_audit_logs',
    'app_refresh_tokens', 'app_appointments', 'app_households', 'app_units',
    'app_role_permissions', 'app_import_jobs', 'app_import_staging', 'app_import_raw'];

  for (const t of tables) {
    try {
      const r = await query(`SELECT count(*) FROM ${t}`);
      counts[t] = parseInt(r.rows[0].count, 10);
      log(`COUNT ${t.padEnd(28)}: ${counts[t]}`);
    } catch (e) {
      counts[t] = -1;
      log(`COUNT ${t.padEnd(28)}: ERROR (${e.message})`);
    }
  }
  sep();

  // Migrations
  const migs = await query("SELECT id FROM schema_migrations ORDER BY applied_at");
  log(`MIGRATIONS APPLIED: ${migs.rows.length}`);
  log(`LAST 3: ${migs.rows.slice(-3).map(r => r.id).join(', ')}`);
  sep();

  // Break Glass
  const bg = await query("SELECT id, email, role, inactive FROM app_users WHERE role = 'break_glass_admin'");
  if (bg.rows.length === 0) {
    log('⚠️  NO BREAK GLASS ACCOUNT FOUND');
  } else {
    bg.rows.forEach(u => {
      log(`BREAK_GLASS: id=${u.id} | email=${u.email} | inactive=${u.inactive}`);
    });
  }
  sep();

  return { counts, migrations: migs.rows.length, breakGlass: bg.rows };
}

// ── Backup Plan ────────────────────────────────────────────────────────────────
async function describeBackupPlan() {
  log('=== BACKUP PLAN ===');
  log('Neon auto-creates point-in-time restore snapshots.');
  log('Manual backup: GET /admin/backup/export (requires BACKUP_EXPORT_KEY)');
  log('Neon branch snapshot: use Neon console > Branches > Create restore point');
  log('RECOMMENDATION: Create a Neon branch from main before executing reset.');
  sep();
}

// ── Reset Plan ─────────────────────────────────────────────────────────────────
async function describeResetPlan(breakGlass) {
  log('=== RESET PLAN ===');

  const bgIds = breakGlass.map(u => u.id);
  log(`PRESERVE Break Glass accounts: ${bgIds.join(', ')}`);
  log('PRESERVE support_admin accounts (platform role — persists across resets)');
  log('PRESERVE schema_migrations (migrations history)');
  log('PRESERVE ciap2, cid10, municipalities (catalog tables)');
  log('PRESERVE app_role_permissions (RBAC capabilities)');
  log('');
  log('WILL DELETE / CLEAR:');
  log('  1. app_refresh_tokens — all rows');
  log('  2. app_appointments — all rows');
  log('  3. app_households — all rows');
  log('  4. app_audit_logs — all rows');
  log('  5. app_import_jobs, app_import_staging, app_import_raw — all rows');
  log('  6. app_patients — all rows');
  log('  7. app_users WHERE role != break_glass_admin — removes all non-BG users');
  log('  8. app_units — all rows');
  log('  9. app_state.data — RESET to empty VITRAS structure');
  log('');
  log('DELETION ORDER respects foreign key constraints (no FK errors expected).');
  log('app_state.data reset preserves existing JSONB structure, clears all collections.');
  sep();
}

// ── Execute Reset ─────────────────────────────────────────────────────────────
async function executeReset(breakGlass) {
  const bgIds = breakGlass.map(u => u.id);

  // Also preserve support_admin accounts (platform role, needed across resets)
  const saResult = await query("SELECT id FROM app_users WHERE role = 'support_admin' AND (inactive IS NULL OR inactive = false)");
  const saIds = saResult.rows.map(r => r.id);
  if (saIds.length > 0) {
    log(`PRESERVE support_admin accounts: ${saIds.join(', ')}`);
  }

  const preservedIds = [...new Set([...bgIds, ...saIds])];
  const bgIdPlaceholders = preservedIds.map((_, i) => `$${i + 1}`).join(', ');

  log('=== EXECUTING RESET ===');

  await withTransaction(async (client) => {

    // 1. Refresh tokens
    const r1 = await client.query('DELETE FROM app_refresh_tokens');
    log(`✓ Deleted app_refresh_tokens: ${r1.rowCount} rows`);

    // 2. Appointments
    const r2 = await client.query('DELETE FROM app_appointments');
    log(`✓ Deleted app_appointments: ${r2.rowCount} rows`);

    // 3. Households
    const r3 = await client.query('DELETE FROM app_households');
    log(`✓ Deleted app_households: ${r3.rowCount} rows`);

    // 4. Audit logs
    const r4 = await client.query('DELETE FROM app_audit_logs');
    log(`✓ Deleted app_audit_logs: ${r4.rowCount} rows`);

    // 5. Import tables
    try {
      const r5a = await client.query('DELETE FROM app_import_staging');
      log(`✓ Deleted app_import_staging: ${r5a.rowCount} rows`);
    } catch { log('  app_import_staging: skipped'); }
    try {
      const r5b = await client.query('DELETE FROM app_import_raw');
      log(`✓ Deleted app_import_raw: ${r5b.rowCount} rows`);
    } catch { log('  app_import_raw: skipped'); }
    try {
      const r5c = await client.query('DELETE FROM app_import_jobs');
      log(`✓ Deleted app_import_jobs: ${r5c.rowCount} rows`);
    } catch { log('  app_import_jobs: skipped'); }

    // 6. Patients
    const r6 = await client.query('DELETE FROM app_patients');
    log(`✓ Deleted app_patients: ${r6.rowCount} rows`);

    // 7. Users — preserve break_glass_admin and support_admin
    let r7;
    if (preservedIds.length > 0) {
      r7 = await client.query(
        `DELETE FROM app_users WHERE id NOT IN (${bgIdPlaceholders})`,
        preservedIds
      );
    } else {
      r7 = await client.query('DELETE FROM app_users');
    }
    log(`✓ Deleted app_users (preserved BG+SA): ${r7.rowCount} rows`);

    // 8. Units
    const r8 = await client.query('DELETE FROM app_units');
    log(`✓ Deleted app_units: ${r8.rowCount} rows`);

    // 9. Reset app_state.data — preserve audit chain anchor structure
    // Build an empty but valid VITRAS state
    const emptyState = {
      users: [],
      patients: [],
      teams: [],
      units: [],
      municipalities: [],
      userUnitMemberships: [],
      auditLogs: [],
      auditLogChainAnchors: [],
      refreshTokens: [],
      loginChallenges: [],
      appointments: [],
      agendaEntries: [],
      scheduleBlocks: [],
      professionalSchedules: [],
      queueEntries: [],
      tasks: [],
      clinicalRecords: [],
      prescricoes: [],
      messages: [],
      exams: [],
      examRequests: [],
      referrals: [],
      familyGroups: [],
      households: [],
      microAreas: [],
      acsVisits: [],
      dentalLogs: [],
      dentalStock: [],
      odontograms: [],
      odontoPlanItems: [],
      odontoProcedures: [],
      dentalEncounters: [],
      pharmacyLogs: [],
      pharmacyStock: [],
      pharmacyReceitas: [],
      dispensacoes: [],
      suppliesLogs: [],
      suppliesStock: [],
      suppliesContinuous: [],
      almoxRequisicoes: [],
      labOrders: [],
      labIntegrations: [],
      catalogItems: [],
      protocolTemplates: [],
      protocolTemplateVersions: [],
      accessRequests: [],
      privacyRequests: [],
      exportHistory: [],
      auditPruneExports: [],
      registerVerifications: [],
      notifications: [],
    };

    // Re-add break_glass_admin and support_admin to app_state.data.users
    if (preservedIds.length > 0) {
      const preservedUsers = await client.query(
        `SELECT payload FROM app_users WHERE id IN (${bgIdPlaceholders})`,
        preservedIds
      );
      emptyState.users = preservedUsers.rows.map(r => r.payload).filter(Boolean);
      const bgCount = emptyState.users.filter(u => u.role === 'break_glass_admin').length;
      const saCount = emptyState.users.filter(u => u.role === 'support_admin').length;
      log(`✓ Preserved in app_state.data.users: ${emptyState.users.length} (BG: ${bgCount}, SA: ${saCount})`);
    }

    const r9 = await client.query(
      'UPDATE app_state SET data = $1 WHERE id = 1',
      [emptyState]
    );
    log(`✓ Reset app_state.data: ${r9.rowCount} rows updated`);
  });

  log('✓ Transaction committed successfully');
  sep();
}

// ── Verify Post-Reset ─────────────────────────────────────────────────────────
async function verifyReset(expectedBgIds) {
  log('=== POST-RESET VERIFICATION ===');

  const checks = [
    { table: 'app_patients', expected: 0 },
    { table: 'app_audit_logs', expected: 0 },
    { table: 'app_refresh_tokens', expected: 0 },
    { table: 'app_appointments', expected: 0 },
    { table: 'app_households', expected: 0 },
    { table: 'app_units', expected: 0 },
  ];

  let allPass = true;

  for (const { table, expected } of checks) {
    const r = await query(`SELECT count(*) FROM ${table}`);
    const actual = parseInt(r.rows[0].count, 10);
    const pass = actual === expected;
    log(`${pass ? '✓' : '✗'} ${table.padEnd(28)}: ${actual} rows (expected ${expected})`);
    if (!pass) allPass = false;
  }

  // Users: only break_glass_admin and support_admin should remain
  const users = await query("SELECT id, email, role FROM app_users");
  const platformOnly = users.rows.every(u => ['break_glass_admin','support_admin'].includes(u.role));
  log(`${platformOnly ? '✓' : '✗'} app_users: ${users.rows.length} rows (only platform roles: ${platformOnly})`);
  if (!platformOnly) {
    log(`  Remaining: ${users.rows.filter(u => !['break_glass_admin','support_admin'].includes(u.role)).map(u => `${u.email}(${u.role})`).join(', ')}`);
    allPass = false;
  }

  // Break glass preserved
  for (const bgId of expectedBgIds) {
    const bg = await query("SELECT id, email, inactive FROM app_users WHERE id = $1", [bgId]);
    const found = bg.rows.length > 0 && !bg.rows[0].inactive;
    log(`${found ? '✓' : '✗'} Break Glass ${bgId.slice(0, 8)}...: ${found ? 'PRESERVED' : 'MISSING OR INACTIVE'}`);
    if (!found) allPass = false;
  }

  // Migrations intact
  const migs = await query("SELECT count(*) FROM schema_migrations");
  const migCount = parseInt(migs.rows[0].count, 10);
  log(`✓ schema_migrations: ${migCount} rows (preserved)`);

  sep();
  return allPass;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n');
  sep();
  log(`VITRAS Demo Environment Reset — v1.1.0-rc.1`);
  log(`Mode: ${isDryRun ? 'DRY RUN' : '⚠️  EXECUTE (DESTRUCTIVE)'}`);
  sep();
  console.log('\n');

  try {
    const { counts, migrations, breakGlass } = await probeEnvironment();
    await describeBackupPlan();
    await describeResetPlan(breakGlass);

    if (isDryRun) {
      dryLog('DRY RUN COMPLETE — No changes were made.');
      dryLog('Review the plan above, then run with --execute to proceed.');
      dryLog('Remember to create a Neon branch snapshot before executing.');
      sep();
      log('STATUS: DRY RUN PASS — AWAITING RESET APPROVAL');
      process.exit(0);
    }

    // Execute mode
    console.log('\n');
    log('⚠️  ABOUT TO EXECUTE DESTRUCTIVE RESET ⚠️');
    log(`Break Glass accounts to preserve: ${breakGlass.map(u => u.email).join(', ')}`);
    log('Starting in 3 seconds... (Ctrl+C to abort)');
    await new Promise(r => setTimeout(r, 3000));

    await executeReset(breakGlass);

    const bgIds = breakGlass.map(u => u.id);
    const pass = await verifyReset(bgIds);

    if (pass) {
      log('✅ RESET COMPLETE — All verifications PASS');
      log('Next step: run seed-demo-environment.mjs to populate demo data.');
      process.exit(0);
    } else {
      log('❌ RESET VERIFICATION FAILED — Check errors above');
      process.exit(3);
    }

  } catch (e) {
    log(`FATAL ERROR: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
