#!/usr/bin/env python3
"""Generates SSM JSON payload for GD-01..GD-23 smoke tests (deploy 11b).
Embeds Node.js script as base64 to avoid heredoc/quote issues in SSM commands.
Usage: python3 gen-smoke-gd-ssm.py
Then: aws ssm send-command --instance-ids <ID> --cli-input-json file:///tmp/smoke-gd-11b-ssm.json --region sa-east-1
"""
import json, base64, sys

NODE_SCRIPT = """
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const { spawnSync, execSync } = require('child_process');
const { createHmac } = require('crypto');
const fs = require('fs');

function readEnvFromProc() {
  try {
    const pid = execSync("pgrep -f 'node src/server.js' | head -1", { encoding: 'utf8' }).trim();
    if (!pid) return process.env;
    const raw = fs.readFileSync('/proc/' + pid + '/environ', 'utf8');
    const vars = {};
    raw.split('\\0').forEach(e => { const i = e.indexOf('='); if (i > 0) vars[e.slice(0, i)] = e.slice(i + 1); });
    return vars;
  } catch { return process.env; }
}

const env = readEnvFromProc();
const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
const JWT_SECRET = env.JWT_SECRET || process.env.JWT_SECRET || 'dev-only-jwt-secret-change-me';
const MUNICIPALITY_ID = env.MUNICIPALITY_ID || process.env.MUNICIPALITY_ID || '3534401';
if (!DATABASE_URL) { console.error('FATAL: DATABASE_URL not found'); process.exit(1); }
console.log('DB found, MUNICIPALITY_ID=' + MUNICIPALITY_ID);

function b64url(buf) {
  return buf.toString('base64').replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
}
function signJwt(payload) {
  const h = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const b = b64url(Buffer.from(JSON.stringify({
    ...payload, iss: 'vitras-backend', aud: 'vitras-client',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600
  })));
  const s = b64url(createHmac('sha256', JWT_SECRET).update(h + '.' + b).digest());
  return h + '.' + b + '.' + s;
}

async function withDb(fn) {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query('SELECT data FROM app_state WHERE id=1 FOR UPDATE');
    const db = r.rows[0].data;
    fn(db);
    await c.query('UPDATE app_state SET data=$1 WHERE id=1', [JSON.stringify(db)]);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { await c.end(); }
}

async function readDb() {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try { const r = await c.query('SELECT data FROM app_state WHERE id=1'); return r.rows[0].data; }
  finally { await c.end(); }
}

function http(method, path, token, body) {
  const args = ['-s', '-o', '/tmp/gd-resp.txt', '-w', '%{http_code}',
    '-X', method, 'http://localhost:3001' + path,
    '-H', 'Authorization: Bearer ' + token,
    '-H', 'Content-Type: application/json'];
  if (body) args.push('-d', JSON.stringify(body));
  const r = spawnSync('curl', args, { timeout: 12000 });
  const code = parseInt((r.stdout || '').toString().trim()) || 0;
  let rb = {};
  try { rb = JSON.parse(fs.readFileSync('/tmp/gd-resp.txt', 'utf8')); } catch {}
  return { code, body: rb };
}

const ts = Date.now();
const IDS = {
  muniA: MUNICIPALITY_ID, muniB: '9999999',
  unitA: 'gd-ua-' + ts, unitB: 'gd-ub-' + ts,
  teamX: 'gd-tx-' + ts, teamY: 'gd-ty-' + ts,
  patY: 'gd-py-' + ts, patMB: 'gd-pmb-' + ts,
  uDoc: 'gd-doc-' + ts, uNur: 'gd-nur-' + ts, uDen: 'gd-den-' + ts,
  uAcs: 'gd-acs-' + ts, uNt: 'gd-nt-' + ts, uGes: 'gd-ges-' + ts, uRec: 'gd-rec-' + ts,
  createdRecords: []
};

async function setup() {
  await withDb(db => {
    const now = new Date().toISOString();
    if (!db.units) db.units = [];
    if (!db.teams) db.teams = [];
    if (!db.patients) db.patients = [];
    if (!db.users) db.users = [];
    if (!db.clinicalRecords) db.clinicalRecords = [];
    if (!db.auditLogs) db.auditLogs = [];
    db.units.push(
      { id: IDS.unitA, name: 'UBS GD-A', cnes: 'GDA0001', municipalityId: IDS.muniA, createdAt: now },
      { id: IDS.unitB, name: 'UBS GD-B', cnes: 'GDB0001', municipalityId: IDS.muniA, createdAt: now }
    );
    db.teams.push(
      { id: IDS.teamX, name: 'ESF GD-X', unitId: IDS.unitA, municipalityId: IDS.muniA, createdAt: now },
      { id: IDS.teamY, name: 'ESF GD-Y', unitId: IDS.unitB, municipalityId: IDS.muniA, createdAt: now }
    );
    db.patients.push(
      {
        id: IDS.patY, name: 'Paciente GD-Y', teamId: IDS.teamY, unitId: IDS.unitB,
        municipalityId: IDS.muniA, microArea: 'MA-GD', assignedAcsId: IDS.uAcs,
        careCategory: 'general', birthDate: '1980-01-15', phone: '(11) 99999-9999',
        cpf: '', cns: '', inactive: false, createdAt: now
      },
      {
        id: IDS.patMB, name: 'Paciente GD-MB', teamId: IDS.teamY, unitId: IDS.unitB,
        municipalityId: IDS.muniB, microArea: '', assignedAcsId: '',
        careCategory: 'general', birthDate: '1970-05-20', phone: '(11) 88888-8888',
        cpf: '', cns: '', inactive: false, createdAt: now
      }
    );
    const mk = (id, role, tid, uid) => ({
      id, name: 'GD ' + role, email: id + '@gd.invalid', role,
      teamId: tid, unitId: uid, municipalityId: IDS.muniA, active: true, createdAt: now
    });
    db.users.push(
      mk(IDS.uDoc, 'doctor', IDS.teamX, IDS.unitA),
      mk(IDS.uNur, 'nurse_manager', IDS.teamX, IDS.unitA),
      mk(IDS.uDen, 'dentist', IDS.teamX, IDS.unitA),
      mk(IDS.uAcs, 'acs', IDS.teamX, IDS.unitA),
      mk(IDS.uNt, 'nursing_tech', IDS.teamX, IDS.unitA),
      mk(IDS.uGes, 'gestor', IDS.teamX, IDS.unitA),
      mk(IDS.uRec, 'receptionist', IDS.teamX, IDS.unitA)
    );
    console.log('setup: 2 units, 2 teams, 2 patients, 7 users');
  });
}

async function cleanup() {
  await withDb(db => {
    const gdIds = new Set(Object.values(IDS).filter(v => typeof v === 'string' && v.startsWith('gd-')));
    const recIds = new Set(IDS.createdRecords);
    db.units = (db.units || []).filter(u => !gdIds.has(u.id));
    db.teams = (db.teams || []).filter(t => !gdIds.has(t.id));
    db.patients = (db.patients || []).filter(p => !gdIds.has(p.id));
    db.users = (db.users || []).filter(u => !gdIds.has(u.id));
    db.clinicalRecords = (db.clinicalRecords || []).filter(r => !recIds.has(r.id) && !gdIds.has(r.patientId));
    db.auditLogs = (db.auditLogs || []).filter(l => !gdIds.has(l.actorId) && !gdIds.has(l.resourceId));
    console.log('cleanup done');
  });
}

const results = [];
const PASS = (id, d) => { results.push({ id, s: 'PASS', d }); console.log('[PASS] ' + id + ' — ' + d); };
const FAIL = (id, d) => { results.push({ id, s: 'FAIL', d }); console.log('[FAIL] ' + id + ' — ' + d); };

async function runSmokes() {
  const J = 'Atendimento emergencial APS municipal integrada cross-team GD';
  const mkTok = (id, role, tid, uid) => signJwt({ sub: id, id, role, teamId: tid, unitId: uid, municipalityId: IDS.muniA, name: 'GD ' + role });
  const tDoc = mkTok(IDS.uDoc, 'doctor', IDS.teamX, IDS.unitA);
  const tNur = mkTok(IDS.uNur, 'nurse_manager', IDS.teamX, IDS.unitA);
  const tDen = mkTok(IDS.uDen, 'dentist', IDS.teamX, IDS.unitA);
  const tAcs = mkTok(IDS.uAcs, 'acs', IDS.teamX, IDS.unitA);
  const tNt  = mkTok(IDS.uNt, 'nursing_tech', IDS.teamX, IDS.unitA);
  const tGes = mkTok(IDS.uGes, 'gestor', IDS.teamX, IDS.unitA);
  const tRec = mkTok(IDS.uRec, 'receptionist', IDS.teamX, IDS.unitA);

  // GD-01: doctor cross-team -> 201
  const r01 = http('POST', '/patients/' + IDS.patY + '/records', tDoc, {
    type: 'consultation', date: '2026-06-15', title: 'Consulta GD-01 doctor cross-team', crossTeamJustification: J
  });
  if (r01.code === 201) { IDS.createdRecords.push(r01.body.id); PASS('GD-01', '201 id=' + r01.body.id); }
  else FAIL('GD-01', 'expected 201 got ' + r01.code + ' ' + JSON.stringify(r01.body));

  // GD-02..05: patient territoriality unchanged
  const dbA = await readDb();
  const pA = (dbA.patients || []).find(p => p.id === IDS.patY);
  pA && pA.teamId === IDS.teamY ? PASS('GD-02', 'teamId intact=' + pA.teamId) : FAIL('GD-02', 'teamId=' + pA?.teamId + ' expected ' + IDS.teamY);
  pA && pA.unitId === IDS.unitB ? PASS('GD-03', 'unitId intact=' + pA.unitId) : FAIL('GD-03', 'unitId=' + pA?.unitId + ' expected ' + IDS.unitB);
  pA && pA.microArea === 'MA-GD' ? PASS('GD-04', 'microArea intact=' + pA.microArea) : FAIL('GD-04', 'microArea=' + pA?.microArea);
  pA && pA.assignedAcsId === IDS.uAcs ? PASS('GD-05', 'assignedAcsId intact=' + pA.assignedAcsId) : FAIL('GD-05', 'assignedAcsId=' + pA?.assignedAcsId);

  // GD-06..10: record context fields
  if (r01.code === 201) {
    const rec = r01.body;
    rec.executingTeamId === IDS.teamX ? PASS('GD-06', 'executingTeamId=' + rec.executingTeamId) : FAIL('GD-06', 'got=' + rec.executingTeamId + ' want=' + IDS.teamX);
    rec.executingUnitId === IDS.unitA ? PASS('GD-07', 'executingUnitId=' + rec.executingUnitId) : FAIL('GD-07', 'got=' + rec.executingUnitId + ' want=' + IDS.unitA);
    rec.executingProfessionalId === IDS.uDoc ? PASS('GD-08', 'executingProfessionalId=' + rec.executingProfessionalId) : FAIL('GD-08', 'got=' + rec.executingProfessionalId);
    rec.patientReferenceTeamId === IDS.teamY ? PASS('GD-09', 'patientReferenceTeamId=' + rec.patientReferenceTeamId) : FAIL('GD-09', 'got=' + rec.patientReferenceTeamId + ' want=' + IDS.teamY);
    rec.patientReferenceUnitId === IDS.unitB ? PASS('GD-10', 'patientReferenceUnitId=' + rec.patientReferenceUnitId) : FAIL('GD-10', 'got=' + rec.patientReferenceUnitId + ' want=' + IDS.unitB);
  } else {
    ['GD-06', 'GD-07', 'GD-08', 'GD-09', 'GD-10'].forEach(id => FAIL(id, 'GD-01 failed — no record'));
  }

  // GD-11: nurse_manager cross-team -> 201
  const r11 = http('POST', '/patients/' + IDS.patY + '/records', tNur, {
    type: 'nursing', date: '2026-06-15', title: 'Enfermagem GD-11 cross-team', crossTeamJustification: J
  });
  if (r11.code === 201) { IDS.createdRecords.push(r11.body.id); PASS('GD-11', '201'); }
  else FAIL('GD-11', 'expected 201 got ' + r11.code + ' ' + JSON.stringify(r11.body));

  // GD-12: dentist cross-team -> 201
  const r12 = http('POST', '/patients/' + IDS.patY + '/records', tDen, {
    type: 'consultation', date: '2026-06-15', title: 'Odonto GD-12 cross-team', crossTeamJustification: J
  });
  if (r12.code === 201) { IDS.createdRecords.push(r12.body.id); PASS('GD-12', '201'); }
  else FAIL('GD-12', 'expected 201 got ' + r12.code + ' ' + JSON.stringify(r12.body));

  // GD-13: ACS -> 403
  const r13 = http('POST', '/patients/' + IDS.patY + '/records', tAcs, {
    type: 'consultation', date: '2026-06-15', title: 'ACS tentativa GD-13', crossTeamJustification: J
  });
  r13.code === 403 ? PASS('GD-13', '403 ACS blocked') : FAIL('GD-13', 'expected 403 got ' + r13.code);

  // GD-14: nursing_tech -> 403
  const r14 = http('POST', '/patients/' + IDS.patY + '/records', tNt, {
    type: 'consultation', date: '2026-06-15', title: 'NT tentativa GD-14', crossTeamJustification: J
  });
  r14.code === 403 ? PASS('GD-14', '403 nursing_tech blocked') : FAIL('GD-14', 'expected 403 got ' + r14.code);

  // GD-15: gestor -> 403
  const r15 = http('POST', '/patients/' + IDS.patY + '/records', tGes, {
    type: 'consultation', date: '2026-06-15', title: 'Gestor tentativa GD-15', crossTeamJustification: J
  });
  r15.code === 403 ? PASS('GD-15', '403 gestor blocked') : FAIL('GD-15', 'expected 403 got ' + r15.code);

  // GD-16: cross-municipality -> 403
  const r16 = http('POST', '/patients/' + IDS.patMB + '/records', tDoc, {
    type: 'consultation', date: '2026-06-15', title: 'Cross-muni GD-16', crossTeamJustification: J
  });
  r16.code === 403 ? PASS('GD-16', '403 cross-municipality blocked') : FAIL('GD-16', 'expected 403 got ' + r16.code);

  // GD-17: crossTeamJustification < 20 chars -> 400
  const r17 = http('POST', '/patients/' + IDS.patY + '/records', tDoc, {
    type: 'consultation', date: '2026-06-15', title: 'Justif curta GD-17', crossTeamJustification: 'curta'
  });
  r17.code === 400 ? PASS('GD-17', '400 short justification rejected') : FAIL('GD-17', 'expected 400 got ' + r17.code + ' ' + JSON.stringify(r17.body));

  // GD-18: audit log fields
  const dbB = await readDb();
  const auditEv = (dbB.auditLogs || []).find(l =>
    (l.event === 'clinical_record.cross_team' || l.event === 'clinical_record.cross_unit') &&
    l.actorId === IDS.uDoc
  );
  if (auditEv) {
    const d = auditEv.details || {};
    const ok = d.executingTeamId && d.executingUnitId && d.executingProfessionalId &&
      d.patientReferenceTeamId && d.patientReferenceUnitId && d.municipalityId &&
      d.crossTeamJustification !== undefined;
    ok ? PASS('GD-18', 'audit fields present event=' + auditEv.event) : FAIL('GD-18', 'missing: ' + JSON.stringify(Object.keys(d)));
  } else {
    FAIL('GD-18', 'cross_team audit not found actorId=' + IDS.uDoc + ' events=' + (dbB.auditLogs || []).slice(-5).map(l => l.event).join(','));
  }

  // GD-19: static code check — records handler uses patient.teamId
  try {
    const src = fs.readFileSync('/var/app/current/src/routes/patients.js', 'utf8');
    const hasPatientTeamId = src.includes('getProtocolTemplateMap(db, patientTeamId)');
    hasPatientTeamId ? PASS('GD-19', 'getProtocolTemplateMap uses patientTeamId in records handler') : FAIL('GD-19', 'patientTeamId pattern not found in source');
  } catch (e) { FAIL('GD-19', 'file read error: ' + e.message); }

  // GD-20: territoriality intact after all writes
  const dbC = await readDb();
  const pC = (dbC.patients || []).find(p => p.id === IDS.patY);
  const ok20 = pC && pC.teamId === IDS.teamY && pC.unitId === IDS.unitB &&
    pC.microArea === 'MA-GD' && pC.assignedAcsId === IDS.uAcs;
  ok20 ? PASS('GD-20', 'territory intact after ' + IDS.createdRecords.length + ' records written') :
    FAIL('GD-20', 'territory changed: ' + JSON.stringify({ teamId: pC?.teamId, unitId: pC?.unitId, microArea: pC?.microArea, acsId: pC?.assignedAcsId }));

  // GD-21: receptionist GET /patients -> 200 + finds cross-UBS patient
  const r21 = http('GET', '/patients', tRec, null);
  if (r21.code === 200 && Array.isArray(r21.body)) {
    const found = r21.body.some(p => p.id === IDS.patY);
    found ? PASS('GD-21', '200 patY found total=' + r21.body.length) : FAIL('GD-21', '200 but patY not found total=' + r21.body.length);
  } else {
    FAIL('GD-21', 'expected 200 array got ' + r21.code + ' ' + JSON.stringify(r21.body).slice(0, 200));
  }

  // GD-22: receptionist sees only allowed fields
  if (r21.code === 200 && Array.isArray(r21.body) && r21.body.length > 0) {
    const sample = r21.body.find(p => p.id === IDS.patY) || r21.body[0];
    const allowed = new Set(['id', 'name', 'birthDate', 'cpf', 'cns', 'unitId', 'teamId', 'inactive']);
    const extra = Object.keys(sample).filter(k => !allowed.has(k));
    extra.length === 0 ? PASS('GD-22', 'fields=' + Object.keys(sample).join(',')) : FAIL('GD-22', 'extra fields: ' + extra.join(','));
  } else FAIL('GD-22', 'no data from GD-21');

  // GD-23: no forbidden fields
  if (r21.code === 200 && Array.isArray(r21.body) && r21.body.length > 0) {
    const forbidden = ['phone', 'phoneAlt', 'address', 'genderIdentity', 'racaCor', 'deficiencia',
      'situacaoRua', 'cnsResponsavel', 'motherName', 'careCategory', 'chronicConditions',
      'comorbidities', 'medications', 'allergies', 'socialVulnerability', 'substanceDependency',
      'sexAtBirth', 'cpfEncrypted', 'cnsEncrypted'];
    const sample = r21.body.find(p => p.id === IDS.patY) || r21.body[0];
    const found = forbidden.filter(f => sample[f] !== undefined);
    found.length === 0 ? PASS('GD-23', 'no forbidden fields') : FAIL('GD-23', 'forbidden present: ' + found.join(','));
  } else FAIL('GD-23', 'no data from GD-21');
}

async function main() {
  console.log('=== GD SMOKES 11B START ===');
  console.log('muniA=' + IDS.muniA + ' unitA=' + IDS.unitA + ' unitB=' + IDS.unitB + ' teamX=' + IDS.teamX + ' teamY=' + IDS.teamY);
  try {
    await setup();
    await runSmokes();
  } finally {
    await cleanup();
  }
  console.log('\\n=== RESULTS ===');
  let p = 0, f = 0;
  for (const r of results) {
    if (r.s !== 'PASS') console.log('[FAIL] ' + r.id + ' — ' + r.d);
    r.s === 'PASS' ? p++ : f++;
  }
  console.log('\\nTOTAL: ' + p + ' PASS / ' + f + ' FAIL');
  console.log(f === 0 ? '\\nGRUPO D COMPLETE' : '\\nSMOKES FAILED');
  process.exit(f > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
"""

# Encode script as base64 to avoid any shell quoting issues
script_b64 = base64.b64encode(NODE_SCRIPT.encode('utf-8')).decode('ascii')

commands = [
    "echo " + script_b64 + " | base64 -d > /var/app/current/gd-smokes-11b.mjs",
    "cd /var/app/current && node gd-smokes-11b.mjs ; RC=$? ; rm -f /var/app/current/gd-smokes-11b.mjs ; exit $RC",
    "echo EXIT_CODE=$?"
]

payload = {
    "DocumentName": "AWS-RunShellScript",
    "Parameters": {"commands": commands}
}

out = "/tmp/smoke-gd-11b-ssm.json"
with open(out, "w") as fh:
    json.dump(payload, fh, indent=2)

print(f"Written: {out}")
print(f"Script b64 length: {len(script_b64)} chars")
print()
print("Run:")
print(f'  aws ssm send-command \\')
print(f'    --instance-ids <INSTANCE_ID> \\')
print(f'    --cli-input-json file://{out} \\')
print(f'    --region sa-east-1 \\')
print(f'    --output json')
