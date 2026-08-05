/**
 * seed-demo-parte3.mjs
 *
 * VITRAS-DEMO-READINESS-01 — Parte 3
 * Usuários canônicos com IDs fixos para demonstração institucional.
 *
 * O que faz:
 *   1. Atualiza vitrasId de usuários v2 existentes para IDs canônicos (faixas reservadas)
 *   2. Cria novos usuários de demonstração (prefixo v3-)
 *   3. Cria memberships multi-UBS necessários
 *   4. Cria edge-cases: membership inativo, usuário sem UBS
 *
 * Idempotente: usa ON CONFLICT para shadow, e limpeza de v3- antes de inserir.
 *
 * Usage:
 *   DEMO_SEED_ALLOWED=true node --env-file=.env scripts/seed-demo-parte3.mjs
 *   DEMO_SEED_ALLOWED=true node --env-file=.env scripts/seed-demo-parte3.mjs --dry-run
 */

import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

if (process.env.DEMO_SEED_ALLOWED !== 'true') { console.error('❌ DEMO_SEED_ALLOWED=true required'); process.exit(2); }
if (process.env.RENDER) { console.error('❌ RENDER env — refusing'); process.exit(2); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const T0 = Date.now();
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const elapsed = () => `${((Date.now() - T0) / 1000).toFixed(1)}s`;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `s1$${salt}$${crypto.scryptSync(String(pw), salt, 64).toString('hex')}`;
}

const DEMO_PW = hashPassword('Demo@2026!');
const NOW = new Date().toISOString();
const MUNICIPALITY_ID = '4299999';
const V3_PREFIX = 'v3-';

// ── Canonical vitrasId mappings ───────────────────────────────────────────────
// Maps existing v2 user ID → canonical vitrasId to assign
const VITRASID_PATCHES = [
  // Gestão Municipal
  { id: 'v2-gestor-sms',  vitrasId: '100000001' }, // Dra. Clara Mendes — Gestor Multi-UBS

  // Jardim Horizonte
  { id: 'v2-ges-hzn',     vitrasId: '110000001' }, // Priscila Rocha — Gestor Horizonte
  { id: 'v2-rec-hzn-1',   vitrasId: '110000002' }, // Eliane Costa — Recepção Horizonte
  { id: 'v2-doc-hzn-1',   vitrasId: '110000003' }, // Dr. Márcio Alves — Médico Horizonte
  { id: 'v2-enf-hzn-1',   vitrasId: '110000004' }, // Enf. Sílvia Nascimento
  { id: 'v2-acs-hzn-1',   vitrasId: '110000006' },
  { id: 'v2-acs-hzn-2',   vitrasId: '110000007' },
  { id: 'v2-acs-hzn-3',   vitrasId: '110000008' },
  { id: 'v2-acs-hzn-4',   vitrasId: '110000009' },
  { id: 'v2-acs-hzn-5',   vitrasId: '110000010' },
  { id: 'v2-acs-hzn-6',   vitrasId: '110000011' },
  { id: 'v2-acs-hzn-7',   vitrasId: '110000012' },
  { id: 'v2-acs-hzn-8',   vitrasId: '110000013' },
  { id: 'v2-acs-hzn-9',   vitrasId: '110000014' },
  { id: 'v2-acs-hzn-10',  vitrasId: '110000015' },
  { id: 'v2-acs-hzn-11',  vitrasId: '110000016' },

  // Vila Esperança
  { id: 'v2-ges-esp',     vitrasId: '120000001' }, // Cássia Teixeira — Gestor Esperança
  { id: 'v2-rec-esp',     vitrasId: '120000002' }, // Paulo Sérgio — Recepção Esperança
  { id: 'v2-doc-esp-1',   vitrasId: '120000003' }, // Dr. Leonardo Farias
  { id: 'v2-enf-esp-1',   vitrasId: '120000004' }, // Enf. Natália Campos
  { id: 'v2-acs-esp-1',   vitrasId: '120000006' },
  { id: 'v2-acs-esp-2',   vitrasId: '120000007' },
  { id: 'v2-acs-esp-3',   vitrasId: '120000008' },
  { id: 'v2-acs-esp-4',   vitrasId: '120000009' },
  { id: 'v2-acs-esp-5',   vitrasId: '120000010' },
  { id: 'v2-acs-esp-6',   vitrasId: '120000011' },

  // Parque das Águas
  { id: 'v2-ges-agu',     vitrasId: '130000001' }, // André Borges — Gestor Águas
  { id: 'v2-rec-agu',     vitrasId: '130000002' }, // Estela Matos — Recepção Águas
  { id: 'v2-doc-agu-1',   vitrasId: '130000003' }, // Dra. Simone Freitas
  { id: 'v2-enf-agu-1',   vitrasId: '130000004' }, // Enf. Mauro Carvalho
  { id: 'v2-acs-agu-1',   vitrasId: '130000006' },
  { id: 'v2-acs-agu-2',   vitrasId: '130000007' },
  { id: 'v2-acs-agu-3',   vitrasId: '130000008' },
];

// ── New users (v3-) to create ─────────────────────────────────────────────────
// Only edge-case users not covered by v2 seed.
// Multi-UBS demo uses EXISTING v2 users with extra memberships (see EXTRA_MEMBERSHIPS).
// No special "multi-UBS" users — one person = one vitrasId = multiple memberships.
const NEW_USERS = [
  {
    id: 'v3-single-50',
    vitrasId: '110000050',
    name: 'Dra. Carla Pinto Azevedo',
    email: 'carla.single@horizonte.vitras.local',
    role: 'doctor',
    unitId: 'v2-ubs-horizonte',
    teamId: 'v2-team-hzn-azul',
    teamName: 'Horizonte Azul',
    councilType: 'CRM', councilNumber: '11050', councilUf: 'SC',
    // Single UBS — no unit-selector shown
  },
  {
    id: 'v3-supadmin',
    vitrasId: '190000001',
    name: 'Suporte Vitras Plataforma',
    email: 'suporte@vitras.local',
    role: 'support_admin',
    unitId: '',
    teamId: '',
    teamName: '',
    // NO memberships — Console Nacional only; blocked from all clinical routes
  },
  {
    id: 'v3-inact-101',
    vitrasId: '190000101',
    name: 'Usuário Membership Inativo',
    email: 'inativo.demo@horizonte.vitras.local',
    role: 'receptionist',
    unitId: 'v2-ubs-horizonte',
    teamId: 'v2-team-hzn-azul',
    teamName: 'Horizonte Azul',
    // Will have INACTIVE membership — login blocked (403)
  },
  {
    id: 'v3-noubs-201',
    vitrasId: '190000201',
    name: 'Usuário Sem Unidade',
    email: 'semubs.demo@santa-aurora.vitras.local',
    role: 'receptionist',
    unitId: '',
    teamId: '',
    teamName: '',
    // No membership at all — safe error handling test
  },
];

// ── Memberships to create (beyond auto-generated primary) ─────────────────────
// Format: { userId, unitId, teamId, status, primary }
// Primary membership for v2 users already auto-created by ensureDbShape.
// We only need to add EXTRA memberships here.
const EXTRA_MEMBERSHIPS = [
  // ── Usuários comuns v2 com memberships em múltiplas UBS ──────────────────────
  // Regra: uma pessoa = um vitrasId = memberships adicionais. Sem contas duplicadas.

  // v2-gestor-sms (100000001) — Dra. Clara Mendes, gestor, 3 UBS
  { id: 'v3-mem-sms-hzn', userId: 'v2-gestor-sms', unitId: 'v2-ubs-horizonte', teamId: 'v2-team-hzn-azul',  status: 'active', primary: true  },
  { id: 'v3-mem-sms-esp', userId: 'v2-gestor-sms', unitId: 'v2-ubs-esperanca', teamId: 'v2-team-esp-norte', status: 'active', primary: false },
  { id: 'v3-mem-sms-agu', userId: 'v2-gestor-sms', unitId: 'v2-ubs-aguas',     teamId: 'v2-team-aguas-c',  status: 'active', primary: false },

  // v2-ges-hzn (110000001) — Priscila Rocha, gestor, Horizonte primário + Esperança + Águas
  // Demonstra: gestor comum com vínculo em 3 UBS via fluxo de membership
  { id: 'v3-mem-ges-hzn', userId: 'v2-ges-hzn',    unitId: 'v2-ubs-horizonte', teamId: 'v2-team-hzn-azul',  status: 'active', primary: true  },
  { id: 'v3-mem-ges-esp', userId: 'v2-ges-hzn',    unitId: 'v2-ubs-esperanca', teamId: 'v2-team-esp-norte', status: 'active', primary: false },
  { id: 'v3-mem-ges-agu', userId: 'v2-ges-hzn',    unitId: 'v2-ubs-aguas',     teamId: 'v2-team-aguas-c',  status: 'active', primary: false },

  // v2-doc-hzn-1 (110000003) — Dr. Márcio Alves, doctor, Horizonte primário + Esperança
  // Demonstra: médico atuando em 2 UBS com mesmo vitrasId
  { id: 'v3-mem-doc-hzn', userId: 'v2-doc-hzn-1',  unitId: 'v2-ubs-horizonte', teamId: 'v2-team-hzn-azul',  status: 'active', primary: true  },
  { id: 'v3-mem-doc-esp', userId: 'v2-doc-hzn-1',  unitId: 'v2-ubs-esperanca', teamId: 'v2-team-esp-norte', status: 'active', primary: false },

  // v2-enf-hzn-1 (110000004) — Enf. Sílvia Nascimento, nurse_manager, Horizonte primário + Águas
  // Demonstra: enfermeiro vinculado a 2 UBS
  { id: 'v3-mem-enf-hzn', userId: 'v2-enf-hzn-1',  unitId: 'v2-ubs-horizonte', teamId: 'v2-team-hzn-azul',  status: 'active', primary: true  },
  { id: 'v3-mem-enf-agu', userId: 'v2-enf-hzn-1',  unitId: 'v2-ubs-aguas',     teamId: 'v2-team-aguas-c',  status: 'active', primary: false },

  // ── Edge cases ─────────────────────────────────────────────────────────────
  // v3-single-50 (110000050) — Dra. Carla Pinto, doctor, única UBS (sem seletor)
  { id: 'v3-mem-s50-hzn',  userId: 'v3-single-50', unitId: 'v2-ubs-horizonte', teamId: 'v2-team-hzn-azul',  status: 'active', primary: true  },

  // v3-inact-101 — membership INATIVO (acesso negado)
  { id: 'v3-mem-inact-hzn', userId: 'v3-inact-101', unitId: 'v2-ubs-horizonte', teamId: 'v2-team-hzn-azul', status: 'inactive', primary: false },

  // v3-noubs-201 — sem membership (edge case: usuário sem UBS)
  // v3-supadmin — sem membership (platform role, não passa por membership check)
];

// ── DB helpers ────────────────────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log('══════════════════════════════════════════════════════════════════════');
  log('  VITRAS Demo Seed — Parte 3: Usuários e Permissões');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE'}`);
  log('══════════════════════════════════════════════════════════════════════');

  // ── Step 1: Load app_state ──────────────────────────────────────────────────
  log('[1/5] Loading app_state...');
  const { rows: stateRows } = await pool.query('SELECT data FROM app_state WHERE id = 1');
  if (!stateRows.length) { console.error('❌ app_state empty'); process.exit(1); }
  const state = stateRows[0].data;

  const users       = Array.isArray(state.users)               ? state.users               : [];
  const memberships = Array.isArray(state.userUnitMemberships) ? state.userUnitMemberships : [];

  log(`  app_state loaded: ${users.length} users, ${memberships.length} memberships`);

  // ── Step 2: Patch vitrasIds on existing v2 users ────────────────────────────
  log('[2/5] Patching vitrasIds on existing v2 users...');
  const userById = new Map(users.map(u => [u.id, u]));
  const usedVitrasIds = new Set(users.map(u => String(u.vitrasId || '')).filter(Boolean));

  let patched = 0;
  const vitrasIdPatchMap = {}; // userId → new vitrasId (for shadow sync)

  for (const patch of VITRASID_PATCHES) {
    const user = userById.get(patch.id);
    if (!user) {
      log(`  ⚠  ${patch.id} not found in app_state — skip`);
      continue;
    }
    if (String(user.vitrasId || '') === patch.vitrasId) {
      log(`  ✓  ${patch.id} already has vitrasId ${patch.vitrasId}`);
      continue;
    }
    if (usedVitrasIds.has(patch.vitrasId)) {
      // Check if it's used by ANOTHER user (not this one)
      const existing = users.find(u => String(u.vitrasId||'') === patch.vitrasId && u.id !== patch.id);
      if (existing) {
        log(`  ⚠  vitrasId ${patch.vitrasId} already used by ${existing.id} — clearing from that user first`);
        existing.vitrasId = '';
      }
    }
    log(`  → ${patch.id} (${user.name || '?'}) vitrasId: ${user.vitrasId || '[none]'} → ${patch.vitrasId}`);
    user.vitrasId = patch.vitrasId;
    usedVitrasIds.add(patch.vitrasId);
    vitrasIdPatchMap[patch.id] = patch.vitrasId;
    patched++;
  }
  log(`  Patched: ${patched} users`);

  // ── Step 3: Clean v3 and add new users ─────────────────────────────────────
  log('[3/5] Adding new v3 users...');

  // Remove any existing v3- users and their memberships
  const v3UserIds = new Set(NEW_USERS.map(u => u.id));
  const v3MembershipIds = new Set(EXTRA_MEMBERSHIPS.map(m => m.id));

  const cleanedUsers = users.filter(u => !String(u.id||'').startsWith(V3_PREFIX));
  const cleanedMemberships = memberships.filter(m =>
    !String(m.id||'').startsWith(V3_PREFIX) &&
    !v3UserIds.has(m.userId)  // also remove any auto-created memberships for v3 users
  );
  log(`  Removed ${users.length - cleanedUsers.length} stale v3 users`);
  log(`  Removed ${memberships.length - cleanedMemberships.length} stale v3 memberships`);

  // Also remove any extra memberships for v2-gestor-sms that are v3-prefixed
  const finalMemberships = cleanedMemberships.filter(m =>
    !String(m.id||'').startsWith(V3_PREFIX)
  );

  // Add new v3 users
  for (const u of NEW_USERS) {
    if (usedVitrasIds.has(u.vitrasId)) {
      // Clear from whoever has it
      const clash = cleanedUsers.find(x => String(x.vitrasId||'') === u.vitrasId);
      if (clash) { log(`  ⚠  clearing vitrasId ${u.vitrasId} from ${clash.id}`); clash.vitrasId = ''; }
    }
    const newUser = {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      vitrasId: u.vitrasId,
      unitId: u.unitId || '',
      teamId: u.teamId || '',
      teamName: u.teamName || '',
      municipalityId: u.unitId ? MUNICIPALITY_ID : '',
      password: DEMO_PW,
      inactive: false,
      twoFactorEnabled: false,
      twoFactorSecret: '',
      twoFactorPendingSecret: '',
      twoFactorPendingCreatedAt: '',
      councilType: u.councilType || '',
      councilNumber: u.councilNumber || '',
      councilUf: u.councilUf || '',
      createdAt: NOW,
      updatedAt: NOW,
      lastLoginAt: '',
      lastSeenAt: '',
      lastSeenIp: '',
      createdBy: 'seed-parte3',
    };
    cleanedUsers.push(newUser);
    usedVitrasIds.add(u.vitrasId);
    log(`  + ${u.id} (${u.name}) [${u.role}] vitrasId=${u.vitrasId}`);
  }

  // ── Step 4: Add memberships ─────────────────────────────────────────────────
  log('[4/5] Adding memberships...');

  // Rebuild membership map for dedup
  const memKey = (userId, unitId) => `${userId}:${unitId}`;
  const existingMemKeys = new Set(finalMemberships.map(m => memKey(m.userId, m.unitId)));

  let addedMem = 0;
  for (const m of EXTRA_MEMBERSHIPS) {
    const key = memKey(m.userId, m.unitId);
    if (existingMemKeys.has(key)) {
      // Update status if needed (e.g., ensure inactive stays inactive)
      const existing = finalMemberships.find(x => memKey(x.userId, x.unitId) === key);
      if (existing && existing.status !== m.status) {
        log(`  ~ membership ${m.userId}→${m.unitId}: status ${existing.status}→${m.status}`);
        existing.status = m.status;
        existing.id = m.id; // normalize id
      }
      continue;
    }
    finalMemberships.push({
      id: m.id,
      userId: m.userId,
      unitId: m.unitId,
      teamId: m.teamId,
      status: m.status,
      primary: m.primary,
      createdAt: NOW,
      updatedAt: NOW,
    });
    existingMemKeys.add(key);
    addedMem++;
    log(`  + membership ${m.userId} → ${m.unitId} [${m.status}${m.primary ? ', primary' : ''}]`);
  }
  log(`  Added: ${addedMem} memberships`);

  // ── Step 5: Write back ──────────────────────────────────────────────────────
  log('[5/5] Writing to DB...');

  const newState = {
    ...state,
    users: cleanedUsers,
    userUnitMemberships: finalMemberships,
  };

  if (DRY_RUN) {
    log('\n[DRY RUN] Would write:');
    log(`  users: ${cleanedUsers.length} (was ${users.length})`);
    log(`  memberships: ${finalMemberships.length} (was ${memberships.length})`);
    log(`  vitrasId patches: ${patched}`);
    log(`  new v3 users: ${NEW_USERS.length}`);
    log(`  extra memberships: ${addedMem}`);
    log('\n[DRY RUN] No changes written.');
    await pool.end();
    return;
  }

  await withTransaction(async (client) => {
    // Write app_state
    await client.query(
      'UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1',
      [JSON.stringify(newState)]
    );

    // Sync shadow table app_users for patched v2 users
    for (const [userId, vitrasId] of Object.entries(vitrasIdPatchMap)) {
      await client.query(
        `UPDATE app_users SET payload = payload || $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify({ vitrasId }), userId]
      );
    }

    // Remove stale v3 shadow rows not in current NEW_USERS
    const currentV3Ids = NEW_USERS.map(u => u.id);
    if (currentV3Ids.length > 0) {
      await client.query(
        `DELETE FROM app_users WHERE id LIKE 'v3-%' AND id NOT IN (${currentV3Ids.map((_,i)=>`$${i+1}`).join(',')})`,
        currentV3Ids
      );
    }

    // Upsert new v3 users into shadow table app_users
    for (const u of NEW_USERS) {
      const payload = {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        vitrasId: u.vitrasId,
        unitId: u.unitId || '',
        teamId: u.teamId || '',
        municipalityId: u.unitId ? MUNICIPALITY_ID : '',
        inactive: false,
        createdAt: NOW,
        updatedAt: NOW,
      };
      await client.query(
        `INSERT INTO app_users (id, name, role, unit_id, municipality_id, inactive, payload, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW(),NOW())
         ON CONFLICT (id) DO UPDATE SET
           name=$2, role=$3, unit_id=$4, municipality_id=$5, inactive=$6,
           payload=$7::jsonb, updated_at=NOW()`,
        [u.id, u.name, u.role, u.unitId||'', u.unitId ? MUNICIPALITY_ID : '', false, JSON.stringify(payload)]
      );
    }

    log(`  app_state updated, ${Object.keys(vitrasIdPatchMap).length} shadow patches, ${NEW_USERS.length} shadow upserts`);
  });

  // ── Verification ────────────────────────────────────────────────────────────
  log('\n══ Verification ════════════════════════════════════════════════════════');

  const { rows: stateCheck } = await pool.query('SELECT data FROM app_state WHERE id = 1');
  const checkState = stateCheck[0].data;
  const checkUsers = checkState.users || [];
  const checkMems  = checkState.userUnitMemberships || [];

  // Check canonical vitrasIds (sem 14000000x — removidos por violar regra de usuário único)
  const canonicalIds = [
    '100000001','110000001','110000002','110000003','110000004',
    '110000006','110000007','110000008','110000009','110000010',
    '110000011','110000012','110000013','110000014','110000015','110000016',
    '120000001','120000002','120000003','120000004',
    '120000006','120000007','120000008','120000009','120000010','120000011',
    '130000001','130000002','130000003','130000004',
    '130000006','130000007','130000008',
    '110000050','190000001','190000101','190000201',
  ];

  const foundIds = new Set(checkUsers.map(u => String(u.vitrasId||'')));
  let passCount = 0; let failCount = 0;

  for (const vid of canonicalIds) {
    const ok = foundIds.has(vid);
    if (ok) passCount++;
    else { failCount++; log(`  ❌ MISSING vitrasId ${vid}`); }
  }
  log(`  vitrasId check: ${passCount}/${canonicalIds.length} PASS${failCount > 0 ? `, ${failCount} FAIL` : ''}`);

  // Check multi-UBS memberships em usuários comuns (uma pessoa = um vitrasId)
  const multiUbs = [
    { id: 'v2-gestor-sms', label: 'Clara Mendes (100000001) gestor 3 UBS', expected: 3 },
    { id: 'v2-ges-hzn',    label: 'Priscila Rocha (110000001) gestor 3 UBS', expected: 3 },
    { id: 'v2-doc-hzn-1',  label: 'Dr. Márcio (110000003) médico 2 UBS',    expected: 2 },
    { id: 'v2-enf-hzn-1',  label: 'Enf. Sílvia (110000004) enf 2 UBS',      expected: 2 },
  ];
  for (const m of multiUbs) {
    const mems = checkMems.filter(x => x.userId === m.id && x.status === 'active');
    const ok = mems.length >= m.expected;
    log(`  ${ok ? '✓' : '❌'} ${m.label}: ${mems.length} active memberships (expected ≥${m.expected})`);
  }

  // Check inactive membership
  const inactMems = checkMems.filter(x => x.userId === 'v3-inact-101' && x.status === 'inactive');
  log(`  ${inactMems.length > 0 ? '✓' : '❌'} v3-inact-101: ${inactMems.length} inactive membership(s)`);

  // Check no-UBS user
  const noUbsUser = checkUsers.find(u => u.id === 'v3-noubs-201');
  log(`  ${noUbsUser ? '✓' : '❌'} v3-noubs-201: ${noUbsUser ? `unitId="${noUbsUser.unitId || '[empty]'}"` : 'NOT FOUND'}`);

  // Check support_admin
  const saUser = checkUsers.find(u => u.id === 'v3-supadmin');
  log(`  ${saUser ? '✓' : '❌'} v3-supadmin (190000001): role=${saUser?.role || 'NOT FOUND'}`);

  // Shadow table check
  const { rows: shadowRows } = await pool.query(`
    SELECT COUNT(*) AS cnt FROM app_users
    WHERE id LIKE 'v2-%' AND payload->>'vitrasId' IN (${canonicalIds.slice(0,16).map((_,i)=>`$${i+1}`).join(',')})
  `, canonicalIds.slice(0,16));
  log(`  Shadow app_users vitrasId patches: ${shadowRows[0].cnt}/16 v2-Horizonte users updated`);

  const { rows: v3shadow } = await pool.query(
    `SELECT id FROM app_users WHERE id LIKE 'v3-%'`
  );
  log(`  Shadow v3 users: ${v3shadow.length}/${NEW_USERS.length}`);

  log(`\n══ Done in ${elapsed()} ════════════════════════════════════════════════`);
  log('');
  log('CREDENCIAIS DE DEMONSTRAÇÃO (senha: Demo@2026!)');
  log('─────────────────────────────────────────────────────────────────────────');
  log('ID           Role           Nome / Memberships');
  log('─────────────────────────────────────────────────────────────────────────');
  log('100000001    gestor         Dra. Clara Mendes Figueiredo [H+E+A] → seletor');
  log('110000001    gestor         Priscila Rocha Andrade [H+E+A] → seletor');
  log('110000002    receptionist   Eliane Costa Santos [Horizonte]');
  log('110000003    doctor         Dr. Márcio Alves Pereira [H+E] → seletor');
  log('110000004    nurse_manager  Enf. Sílvia Nascimento Couto [H+A] → seletor');
  log('110000006    acs            ACS Antônia Ferreira Silva [MA-01 Horizonte]');
  log('110000007..  acs            ACS Horizonte MA-02..11 (IDs 110000007..016)');
  log('120000001    gestor         Cássia Teixeira Lima [Esperança]');
  log('120000002    receptionist   Paulo Sérgio Ramos [Esperança]');
  log('120000003    doctor         Dr. Leonardo Farias Souza [Esperança]');
  log('120000004    nurse_manager  Enf. Natália Campos Braga [Esperança]');
  log('120000006..  acs            ACS Esperança MA-01..06 (IDs 120000006..011)');
  log('130000001    gestor         André Borges Lima [Águas]');
  log('130000002    receptionist   Estela Matos Cunha [Águas]');
  log('130000003    doctor         Dra. Simone Freitas Albuquerque [Águas]');
  log('130000004    nurse_manager  Enf. Mauro Carvalho Neto [Águas]');
  log('130000006..  acs            ACS Águas MA-01..03 (IDs 130000006..008)');
  log('110000050    doctor         Dra. Carla Pinto Azevedo [Horizonte] → entrada direta');
  log('190000001    support_admin  Suporte Vitras Plataforma [sem UBS] → Console Nacional');
  log('190000101    receptionist   [BLOQUEADO] membership inativo');
  log('190000201    receptionist   [EDGE] sem membership — tratamento seguro');
  log('─────────────────────────────────────────────────────────────────────────');
  log('Demonstração de multi-UBS: mesma pessoa, múltiplos memberships, único vitrasId');
}

main()
  .catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); })
  .finally(() => pool.end());
