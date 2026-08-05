/**
 * seed-demo-santa-aurora-v2.mjs
 *
 * Seed municipal completo para demonstração institucional.
 * Município de Santa Aurora — 3 UBS | 6 Equipes ESF | ~57 Profissionais | 850 Pacientes
 *
 * Dados: 100% sintéticos, determinísticos, reproduzíveis.
 * Idempotente: limpa prefixo "v2-" antes de reinserir.
 *
 * Usage:
 *   DEMO_SEED_ALLOWED=true node --env-file=.env scripts/seed-demo-santa-aurora-v2.mjs
 *   DEMO_SEED_ALLOWED=true node --env-file=.env scripts/seed-demo-santa-aurora-v2.mjs --dry-run
 */

import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

if (process.env.DEMO_SEED_ALLOWED !== 'true') { console.error('❌ DEMO_SEED_ALLOWED=true required'); process.exit(2); }
if (process.env.RENDER) { console.error('❌ RENDER env — refusing'); process.exit(2); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });
const T0 = Date.now();
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const elapsed = () => `${((Date.now() - T0) / 1000).toFixed(1)}s`;

// ── Time helpers ──────────────────────────────────────────────────────────────
const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);
function dAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
function dateAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function dateAhead(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function workdayAhead(n) { // skip Sun only
  const d = new Date(); let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) added++; }
  return d.toISOString().slice(0, 10);
}
function tsAt(date, h, m = 0) { return `${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`; }

// ── Crypto helpers ────────────────────────────────────────────────────────────
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `s1$${salt}$${crypto.scryptSync(String(pw), salt, 64).toString('hex')}`;
}
const _DEMO_PW = hashPassword('Demo@2026!'); // hash once, reuse

const vitrasIdPool = new Set();
function genVitrasId() {
  let t = 0;
  while (t++ < 300) {
    const c = String(100000000 + crypto.randomInt(0, 900000000));
    if (!vitrasIdPool.has(c)) { vitrasIdPool.add(c); return c; }
  }
  throw new Error('vitrasId exhausted');
}

// ── Synthetic data generators ─────────────────────────────────────────────────
const MALE_NAMES   = ['João','Carlos','Paulo','José','Antônio','Francisco','Luiz','Marcos','Raimundo','Cláudio',
                      'Fernando','Roberto','Ricardo','André','Thiago','Edson','Gilson','Wanderley','Osvaldo','Clóvis',
                      'Nilton','Plínio','Geraldo','Gilberto','Henrique','Leandro','Flávio','Rogério','Evandro','Benedito',
                      'Dirceu','Cícero','Ernesto','Wagner','Mauro','Sandro','Valter','Rodolfo','Norberto','Élcio'];
const FEMALE_NAMES = ['Maria','Ana','Francisca','Tereza','Sandra','Cláudia','Débora','Adriana','Juliana','Letícia',
                      'Renata','Andréia','Vanessa','Simone','Marta','Beatriz','Luciana','Patrícia','Fernanda','Daniela',
                      'Cristina','Rosangela','Sônia','Ivone','Olga','Selma','Dilma','Carmen','Natalia','Bruna',
                      'Camila','Eliza','Yasmin','Aline','Priscila','Luana','Vitória','Isabela','Larissa','Marlene',
                      'Tereza','Neusa','Ivete','Josefina','Wanda','Nilza','Heloísa','Rita','Estela','Lorena'];
const LAST_NAMES   = ['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Ferreira','Rodrigues','Almeida',
                      'Melo','Barbosa','Cunha','Gomes','Rocha','Araújo','Carvalho','Monteiro','Nascimento','Fonseca',
                      'Tavares','Borges','Moura','Corrêa','Machado','Peixoto','Castro','Guimarães','Teixeira','Freitas',
                      'Mendonça','Azevedo','Andrade','Pires','Leite','Ramos','Coelho','Nunes','Campos','Cruz',
                      'Cardoso','Ribeiro','Mendes','Lopes','Gonçalves','Vieira','Santana','Dutra','Torres','Figueiredo'];
const STREETS      = ['Rua das Flores','Rua das Laranjeiras','Rua da Esperança','Rua do Pinheiro','Rua da Paz',
                      'Av. Brasil','Av. Principal','Av. dos Trabalhadores','Travessa das Palmeiras','Rua do Sol',
                      'Rua Nova','Rua Boa Vista','Rua das Acácias','Alameda Verde','Rua Panorâmica',
                      'Estrada do Pomar','Rua Santa Luzia','Rua São João','Rua Primavera','Rua das Mangueiras',
                      'Rua Esperança','Rua Dom Pedro II','Rua dos Ipês','Rua Marechal','Rua das Violetas',
                      'Beco do Moinho','Rua Clementina','Rua Antônio Carlos','Rua Henrique Dias','Rua do Horto'];
const BAIRROS_H    = ['Jardim Horizonte','Centro','Jardim América','Bairro Alto','Vila Bela'];
const BAIRROS_E    = ['Vila Esperança','Vila Nova','Centro','Bairro Industrial'];
const BAIRROS_A    = ['Parque das Águas','Loteamento Central','Jardim Sereno'];

function pick(arr, i) { return arr[Math.abs(Math.floor(i)) % arr.length]; }
function isFemale(i) { return i % 5 < 3; } // ~60% female
function name(i) {
  const female = isFemale(i);
  const fn = female ? pick(FEMALE_NAMES, i) : pick(MALE_NAMES, i);
  const ln1 = pick(LAST_NAMES, i * 7 + 3);
  const ln2 = pick(LAST_NAMES, i * 13 + 7);
  return `${fn} ${ln1} ${ln2}`;
}
function cpf(ubsIdx, seq) {
  const a = String(500 + ubsIdx * 100 + Math.floor(seq / 10000)).slice(-3);
  const b = String(100000 + seq).slice(-3);
  const c = String(seq % 1000).padStart(3, '0');
  const d = String((seq * 3 + ubsIdx * 7 + 11) % 100).padStart(2, '0');
  return `${a}.${b}.${c}-${d}`;
}
function cns(seq) {
  const n = String(seq + 7000000000000000).slice(-15);
  return `7${n.slice(0, 14)}`;
}
function phone(seq, ubsIdx) {
  const area = pick(['(49)','(47)','(48)'], ubsIdx);
  const n = 90000000 + (seq % 10000000);
  return `${area} 9 ${String(n).slice(0,4)}-${String(n).slice(4,8)}`;
}
function address(seq, bairros) {
  const st = pick(STREETS, seq * 3 + 1);
  const num = (seq % 999) + 1;
  const bairro = pick(bairros, seq * 5);
  return `${st}, ${num} — ${bairro}`;
}
function birthDateByAge(targetAge, i) {
  const variance = (i * 37 + 11) % 365;
  const days = targetAge * 365 + variance;
  return dateAgo(days);
}
function ageForCategory(cat, i) {
  switch (cat) {
    case 'crianca':     return (i * 17 + 3)  % 12;           // 0-11
    case 'adolescente': return ((i * 13 + 5) % 6) + 12;      // 12-17
    case 'adulto':      return ((i * 11 + 7) % 35) + 20;     // 20-54
    case 'cronico':     return ((i * 9 + 13) % 35) + 30;     // 30-64
    case 'gestante':    return ((i * 7 + 3)  % 22) + 18;     // 18-39
    case 'puerpera':    return ((i * 11 + 5) % 22) + 18;     // 18-39
    case 'idoso':       return ((i * 13 + 7) % 25) + 62;     // 62-86
    default:            return 35;
  }
}
function conditionsForCategory(cat, i) {
  if (cat === 'cronico') {
    const t = i % 3;
    if (t === 0) return ['hypertension'];
    if (t === 1) return ['diabetes'];
    return ['hypertension', 'diabetes'];
  }
  return [];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MUNICIPALITY_ID   = '4299999';
const MUNICIPALITY_NAME = 'Santa Aurora';
const UF = 'SC';
const DEMO_SEED_PREFIX  = 'v2-';

// ── UBS ───────────────────────────────────────────────────────────────────────
const UNITS = [
  { id: 'v2-ubs-horizonte', name: 'UBS Jardim Horizonte', cnes: '1000001', label: 'horizonte', idx: 1, bairros: BAIRROS_H },
  { id: 'v2-ubs-esperanca', name: 'UBS Vila Esperança',   cnes: '1000002', label: 'esperanca', idx: 2, bairros: BAIRROS_E },
  { id: 'v2-ubs-aguas',     name: 'UBS Parque das Águas', cnes: '1000003', label: 'aguas',     idx: 3, bairros: BAIRROS_A },
];

// ── Equipes ───────────────────────────────────────────────────────────────────
const TEAMS = [
  { id: 'v2-team-hzn-azul',  name: 'Horizonte Azul',   unitId: 'v2-ubs-horizonte', ine: '0001000001', tipoEquipe: 'ESF' },
  { id: 'v2-team-hzn-sol',   name: 'Caminhos do Sol',  unitId: 'v2-ubs-horizonte', ine: '0001000002', tipoEquipe: 'ESF' },
  { id: 'v2-team-hzn-vida',  name: 'Nova Vida',         unitId: 'v2-ubs-horizonte', ine: '0001000003', tipoEquipe: 'ESF' },
  { id: 'v2-team-esp-norte', name: 'Esperança Norte',   unitId: 'v2-ubs-esperanca', ine: '0002000001', tipoEquipe: 'ESF' },
  { id: 'v2-team-esp-sul',   name: 'Esperança Sul',     unitId: 'v2-ubs-esperanca', ine: '0002000002', tipoEquipe: 'ESF' },
  { id: 'v2-team-aguas-c',   name: 'Parque Central',    unitId: 'v2-ubs-aguas',     ine: '0003000001', tipoEquipe: 'ESF' },
];

// ── Microáreas e Territórios ──────────────────────────────────────────────────
const MICRO_AREAS = [
  // Jardim Horizonte — 11 ACS = 11 microáreas
  { id:'v2-ma-hzn-01', name:'MA-01', territory:'Território Norte', teamId:'v2-team-hzn-azul',  unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-1' },
  { id:'v2-ma-hzn-02', name:'MA-02', territory:'Território Norte', teamId:'v2-team-hzn-azul',  unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-2' },
  { id:'v2-ma-hzn-03', name:'MA-03', territory:'Território Norte', teamId:'v2-team-hzn-azul',  unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-3' },
  { id:'v2-ma-hzn-04', name:'MA-04', territory:'Território Norte', teamId:'v2-team-hzn-azul',  unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-4' },
  { id:'v2-ma-hzn-05', name:'MA-05', territory:'Território Sul',   teamId:'v2-team-hzn-sol',   unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-5' },
  { id:'v2-ma-hzn-06', name:'MA-06', territory:'Território Sul',   teamId:'v2-team-hzn-sol',   unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-6' },
  { id:'v2-ma-hzn-07', name:'MA-07', territory:'Território Sul',   teamId:'v2-team-hzn-sol',   unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-7' },
  { id:'v2-ma-hzn-08', name:'MA-08', territory:'Território Sul',   teamId:'v2-team-hzn-sol',   unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-8' },
  { id:'v2-ma-hzn-09', name:'MA-09', territory:'Território Leste', teamId:'v2-team-hzn-vida',  unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-9' },
  { id:'v2-ma-hzn-10', name:'MA-10', territory:'Território Leste', teamId:'v2-team-hzn-vida',  unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-10' },
  { id:'v2-ma-hzn-11', name:'MA-11', territory:'Território Leste', teamId:'v2-team-hzn-vida',  unitId:'v2-ubs-horizonte', acsKey:'v2-acs-hzn-11' },
  // Vila Esperança — 6 ACS
  { id:'v2-ma-esp-01', name:'MA-01', territory:'Zona Norte', teamId:'v2-team-esp-norte', unitId:'v2-ubs-esperanca', acsKey:'v2-acs-esp-1' },
  { id:'v2-ma-esp-02', name:'MA-02', territory:'Zona Norte', teamId:'v2-team-esp-norte', unitId:'v2-ubs-esperanca', acsKey:'v2-acs-esp-2' },
  { id:'v2-ma-esp-03', name:'MA-03', territory:'Zona Norte', teamId:'v2-team-esp-norte', unitId:'v2-ubs-esperanca', acsKey:'v2-acs-esp-3' },
  { id:'v2-ma-esp-04', name:'MA-04', territory:'Zona Sul',   teamId:'v2-team-esp-sul',   unitId:'v2-ubs-esperanca', acsKey:'v2-acs-esp-4' },
  { id:'v2-ma-esp-05', name:'MA-05', territory:'Zona Sul',   teamId:'v2-team-esp-sul',   unitId:'v2-ubs-esperanca', acsKey:'v2-acs-esp-5' },
  { id:'v2-ma-esp-06', name:'MA-06', territory:'Zona Sul',   teamId:'v2-team-esp-sul',   unitId:'v2-ubs-esperanca', acsKey:'v2-acs-esp-6' },
  // Parque das Águas — 3 ACS
  { id:'v2-ma-agu-01', name:'MA-01', territory:'Área Central', teamId:'v2-team-aguas-c', unitId:'v2-ubs-aguas', acsKey:'v2-acs-agu-1' },
  { id:'v2-ma-agu-02', name:'MA-02', territory:'Área Central', teamId:'v2-team-aguas-c', unitId:'v2-ubs-aguas', acsKey:'v2-acs-agu-2' },
  { id:'v2-ma-agu-03', name:'MA-03', territory:'Área Central', teamId:'v2-team-aguas-c', unitId:'v2-ubs-aguas', acsKey:'v2-acs-agu-3' },
];

// ── Profissionais ─────────────────────────────────────────────────────────────
function makeUsers() {
  const base = {
    password: _DEMO_PW, inactive: false,
    twoFactorEnabled: false, twoFactorSecret: '', twoFactorPendingSecret: '', twoFactorPendingCreatedAt: '',
    lastLoginAt: '', lastSeenAt: '', lastSeenIp: '',
    createdBy: 'system-seed', createdAt: dAgo(60), updatedAt: dAgo(1),
  };
  function u(id, name, email, role, unitId, teamId, teamName, extra = {}) {
    return { ...base, id, name, email, role, unitId, teamId, teamName, municipalityId: MUNICIPALITY_ID,
      vitrasId: genVitrasId(), councilType: '', councilNumber: '', councilUf: '', ...extra };
  }
  function doc(id, name, email, unitId, teamId, teamName, crm) {
    return u(id, name, email, 'doctor', unitId, teamId, teamName, { councilType: 'CRM', councilNumber: crm, councilUf: 'SC' });
  }
  function enf(id, name, email, unitId, teamId, teamName, coren) {
    return u(id, name, email, 'nurse_manager', unitId, teamId, teamName, { councilType: 'COREN', councilNumber: coren, councilUf: 'SC' });
  }
  function tec(id, name, email, unitId, teamId, teamName) { return u(id, name, email, 'nurse', unitId, teamId, teamName); }
  function acs(id, name, email, unitId, teamId, teamName) { return u(id, name, email, 'acs', unitId, teamId, teamName); }
  function rec(id, name, email, unitId, teamId, teamName) { return u(id, name, email, 'receptionist', unitId, teamId, teamName); }
  function ges(id, name, email, unitId, teamId, teamName) { return u(id, name, email, 'gestor', unitId, teamId, teamName); }

  return [
    // ── Multi-UBS / Secretaria ──────────────────────────────────────────────
    ges('v2-gestor-sms', 'Dra. Clara Mendes Figueiredo', 'clara.sms@santa-aurora.vitras.local', 'v2-ubs-horizonte', 'v2-team-hzn-azul', 'Horizonte Azul'),

    // ── UBS Jardim Horizonte ────────────────────────────────────────────────
    // Equipe Horizonte Azul
    doc('v2-doc-hzn-1',  'Dr. Márcio Alves Pereira',       'marcio.medico@horizonte.vitras.local',   'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul','11001'),
    enf('v2-enf-hzn-1',  'Enf. Sílvia Nascimento Couto',   'silvia.enf@horizonte.vitras.local',      'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul','SC-21001'),
    tec('v2-tec-hzn-1',  'Téc. Rafaela Borges Lima',        'rafaela.tec@horizonte.vitras.local',     'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    acs('v2-acs-hzn-1',  'ACS Antônia Ferreira Silva',      'antonia.acs@horizonte.vitras.local',     'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    acs('v2-acs-hzn-2',  'ACS Marcos Gomes Barbosa',        'marcos.acs@horizonte.vitras.local',      'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    acs('v2-acs-hzn-3',  'ACS Cláudia Santos Moura',        'claudia.acs@horizonte.vitras.local',     'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    acs('v2-acs-hzn-4',  'ACS Hélio Ramos Cunha',           'helio.acs@horizonte.vitras.local',       'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    // Equipe Caminhos do Sol
    doc('v2-doc-hzn-2',  'Dra. Fernanda Martins Castro',    'fernanda.medica@horizonte.vitras.local', 'v2-ubs-horizonte','v2-team-hzn-sol', 'Caminhos do Sol','11002'),
    enf('v2-enf-hzn-2',  'Enf. Cláudio Pereira Matos',     'claudio.enf@horizonte.vitras.local',     'v2-ubs-horizonte','v2-team-hzn-sol', 'Caminhos do Sol','SC-21002'),
    tec('v2-tec-hzn-2',  'Téc. Bruna Fonseca Torres',       'bruna.tec@horizonte.vitras.local',       'v2-ubs-horizonte','v2-team-hzn-sol', 'Caminhos do Sol'),
    acs('v2-acs-hzn-5',  'ACS Gilberto Pinto Araújo',       'gilberto.acs@horizonte.vitras.local',    'v2-ubs-horizonte','v2-team-hzn-sol', 'Caminhos do Sol'),
    acs('v2-acs-hzn-6',  'ACS Amélia Rodrigues Lima',       'amelia.acs@horizonte.vitras.local',      'v2-ubs-horizonte','v2-team-hzn-sol', 'Caminhos do Sol'),
    acs('v2-acs-hzn-7',  'ACS Sebastião Vieira Costa',      'sebastiao.acs@horizonte.vitras.local',   'v2-ubs-horizonte','v2-team-hzn-sol', 'Caminhos do Sol'),
    acs('v2-acs-hzn-8',  'ACS Neusa Almeida Rocha',         'neusa.acs@horizonte.vitras.local',       'v2-ubs-horizonte','v2-team-hzn-sol', 'Caminhos do Sol'),
    // Equipe Nova Vida
    doc('v2-doc-hzn-3',  'Dr. Paulo Henrique Cardoso',      'paulo.medico@horizonte.vitras.local',    'v2-ubs-horizonte','v2-team-hzn-vida','Nova Vida','11003'),
    enf('v2-enf-hzn-3',  'Enf. Marcela Guimarães Souza',   'marcela.enf@horizonte.vitras.local',     'v2-ubs-horizonte','v2-team-hzn-vida','Nova Vida','SC-21003'),
    tec('v2-tec-hzn-3',  'Téc. Danilo Santos Freitas',      'danilo.tec@horizonte.vitras.local',      'v2-ubs-horizonte','v2-team-hzn-vida','Nova Vida'),
    acs('v2-acs-hzn-9',  'ACS Rosalva Teixeira Mendes',     'rosalva.acs@horizonte.vitras.local',     'v2-ubs-horizonte','v2-team-hzn-vida','Nova Vida'),
    acs('v2-acs-hzn-10', 'ACS Benedito Corrêa Silva',       'benedito.acs@horizonte.vitras.local',    'v2-ubs-horizonte','v2-team-hzn-vida','Nova Vida'),
    acs('v2-acs-hzn-11', 'ACS Ivete Campos Dutra',          'ivete.acs@horizonte.vitras.local',       'v2-ubs-horizonte','v2-team-hzn-vida','Nova Vida'),
    // Shared Horizonte
    ges('v2-ges-hzn',    'Priscila Rocha Andrade',           'priscila.gestora@horizonte.vitras.local','v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    rec('v2-rec-hzn-1',  'Eliane Costa Santos',              'eliane.recep@horizonte.vitras.local',    'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    rec('v2-rec-hzn-2',  'Orlando Matos Lima',               'orlando.recep@horizonte.vitras.local',   'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    doc('v2-dent-hzn',   'Dra. Adriana Lima Melo',           'adriana.dent@horizonte.vitras.local',    'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul', {councilType:'CRO',councilNumber:'SC-5001',councilUf:'SC'}),
    tec('v2-aux-hzn-1',  'Aux. Wagner Fonseca Braga',        'wagner.aux@horizonte.vitras.local',      'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    tec('v2-aux-hzn-2',  'Tânia Coelho Pereira',             'tania.aux@horizonte.vitras.local',       'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    tec('v2-farm-hzn',   'Antônio Lopes Cruz',               'antonio.farm@horizonte.vitras.local',    'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    tec('v2-admin-hzn',  'Juliana Borges Melo',              'juliana.admin@horizonte.vitras.local',   'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),
    tec('v2-assis-hzn',  'Vera Santos Lima',                 'vera.assis@horizonte.vitras.local',      'v2-ubs-horizonte','v2-team-hzn-azul','Horizonte Azul'),

    // ── UBS Vila Esperança ──────────────────────────────────────────────────
    // Equipe Esperança Norte
    doc('v2-doc-esp-1',  'Dr. Leonardo Farias Souza',        'leonardo.medico@esperanca.vitras.local', 'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte','22001'),
    enf('v2-enf-esp-1',  'Enf. Natália Campos Braga',        'natalia.enf@esperanca.vitras.local',     'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte','SC-22001'),
    tec('v2-tec-esp-1',  'Téc. Vagner Lima Santos',          'vagner.tec@esperanca.vitras.local',      'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte'),
    acs('v2-acs-esp-1',  'ACS Tereza Oliveira Cruz',         'tereza.acs@esperanca.vitras.local',      'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte'),
    acs('v2-acs-esp-2',  'ACS Dirceu Mendes Rocha',          'dirceu.acs@esperanca.vitras.local',      'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte'),
    acs('v2-acs-esp-3',  'ACS Josefina Carvalho Pires',      'josefina.acs@esperanca.vitras.local',    'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte'),
    // Equipe Esperança Sul
    doc('v2-doc-esp-2',  'Dra. Beatriz Cunha Monteiro',      'beatriz.medica@esperanca.vitras.local',  'v2-ubs-esperanca','v2-team-esp-sul',  'Esperança Sul','22002'),
    enf('v2-enf-esp-2',  'Enf. Silvano Moura Figueiredo',   'silvano.enf@esperanca.vitras.local',     'v2-ubs-esperanca','v2-team-esp-sul',  'Esperança Sul','SC-22002'),
    tec('v2-tec-esp-2',  'Téc. Lorena Araújo Corrêa',        'lorena.tec@esperanca.vitras.local',      'v2-ubs-esperanca','v2-team-esp-sul',  'Esperança Sul'),
    acs('v2-acs-esp-4',  'ACS Wanda Gonçalves Lima',         'wanda.acs@esperanca.vitras.local',       'v2-ubs-esperanca','v2-team-esp-sul',  'Esperança Sul'),
    acs('v2-acs-esp-5',  'ACS Cícero Pereira Andrade',       'cicero.acs@esperanca.vitras.local',      'v2-ubs-esperanca','v2-team-esp-sul',  'Esperança Sul'),
    acs('v2-acs-esp-6',  'ACS Nilza Ferreira Costa',         'nilza.acs@esperanca.vitras.local',       'v2-ubs-esperanca','v2-team-esp-sul',  'Esperança Sul'),
    // Shared Esperança
    ges('v2-ges-esp',    'Cássia Teixeira Lima',              'cassia.gestora@esperanca.vitras.local',  'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte'),
    rec('v2-rec-esp',    'Paulo Sérgio Ramos',                'paulo.recep@esperanca.vitras.local',     'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte'),
    doc('v2-dent-esp',   'Dr. Ricardo Melo Barbosa',          'ricardo.dent@esperanca.vitras.local',    'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte', {councilType:'CRO',councilNumber:'SC-5002',councilUf:'SC'}),
    tec('v2-aux-esp',    'Elza Pinto Sousa',                  'elza.aux@esperanca.vitras.local',        'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte'),
    tec('v2-admin-esp',  'Sandra Borges Lima',                'sandra.admin@esperanca.vitras.local',    'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte'),
    tec('v2-psico-esp',  'Andréia Sousa Campos',              'andreia.psico@esperanca.vitras.local',   'v2-ubs-esperanca','v2-team-esp-norte','Esperança Norte'),

    // ── UBS Parque das Águas ────────────────────────────────────────────────
    doc('v2-doc-agu-1',  'Dra. Simone Freitas Albuquerque',  'simone.medica@aguas.vitras.local',       'v2-ubs-aguas','v2-team-aguas-c','Parque Central','33001'),
    enf('v2-enf-agu-1',  'Enf. Mauro Carvalho Neto',         'mauro.enf@aguas.vitras.local',           'v2-ubs-aguas','v2-team-aguas-c','Parque Central','SC-33001'),
    tec('v2-tec-agu-1',  'Téc. Cristiana Lima Barros',       'cristiana.tec@aguas.vitras.local',       'v2-ubs-aguas','v2-team-aguas-c','Parque Central'),
    acs('v2-acs-agu-1',  'ACS Heloísa Souza Corrêa',         'heloisa.acs@aguas.vitras.local',         'v2-ubs-aguas','v2-team-aguas-c','Parque Central'),
    acs('v2-acs-agu-2',  'ACS Ernesto Guimarães Campos',     'ernesto.acs@aguas.vitras.local',         'v2-ubs-aguas','v2-team-aguas-c','Parque Central'),
    acs('v2-acs-agu-3',  'ACS Rita Mendes Teixeira',          'rita.acs@aguas.vitras.local',            'v2-ubs-aguas','v2-team-aguas-c','Parque Central'),
    ges('v2-ges-agu',    'André Borges Lima',                 'andre.gestora@aguas.vitras.local',       'v2-ubs-aguas','v2-team-aguas-c','Parque Central'),
    rec('v2-rec-agu',    'Estela Matos Cunha',                'estela.recep@aguas.vitras.local',        'v2-ubs-aguas','v2-team-aguas-c','Parque Central'),
  ];
}

// ── Patient generator ─────────────────────────────────────────────────────────

// Microarea → ACS mapping for each UBS
const MA_ACS_HZN = { // 11 microareas, each 1 ACS
  0:'v2-acs-hzn-1', 1:'v2-acs-hzn-2',  2:'v2-acs-hzn-3',  3:'v2-acs-hzn-4',
  4:'v2-acs-hzn-5', 5:'v2-acs-hzn-6',  6:'v2-acs-hzn-7',  7:'v2-acs-hzn-8',
  8:'v2-acs-hzn-9', 9:'v2-acs-hzn-10', 10:'v2-acs-hzn-11',
};
const MA_ACS_ESP = { 0:'v2-acs-esp-1', 1:'v2-acs-esp-2', 2:'v2-acs-esp-3', 3:'v2-acs-esp-4', 4:'v2-acs-esp-5', 5:'v2-acs-esp-6' };
const MA_ACS_AGU = { 0:'v2-acs-agu-1', 1:'v2-acs-agu-2', 2:'v2-acs-agu-3' };
const MA_TEAMS_HZN = { 0:'v2-team-hzn-azul',0:null,1:null,2:null,3:null }; // built below

function acsForPatient(ubsId, seq, numMa) {
  const maIdx = seq % numMa;
  if (ubsId === 'v2-ubs-horizonte') {
    return { acsId: MA_ACS_HZN[maIdx], maName: `MA-${String(maIdx+1).padStart(2,'0')}` };
  }
  if (ubsId === 'v2-ubs-esperanca') {
    return { acsId: MA_ACS_ESP[maIdx], maName: `MA-${String(maIdx+1).padStart(2,'0')}` };
  }
  return { acsId: MA_ACS_AGU[maIdx], maName: `MA-${String(maIdx+1).padStart(2,'0')}` };
}

function teamForPatient(ubsId, seq) {
  if (ubsId === 'v2-ubs-horizonte') {
    const t = seq % 3;
    const ids  = ['v2-team-hzn-azul','v2-team-hzn-sol','v2-team-hzn-vida'];
    const nms  = ['Horizonte Azul','Caminhos do Sol','Nova Vida'];
    return { teamId: ids[t], teamName: nms[t] };
  }
  if (ubsId === 'v2-ubs-esperanca') {
    const t = seq % 2;
    return t === 0
      ? { teamId:'v2-team-esp-norte', teamName:'Esperança Norte' }
      : { teamId:'v2-team-esp-sul',   teamName:'Esperança Sul' };
  }
  return { teamId:'v2-team-aguas-c', teamName:'Parque Central' };
}

// Care category distribution by UBS
function categoryFor(seq, total, ubsIdx) {
  // Horizonte: geral 44%, cronico 20%, gestante 6%, puerpera 3%, crianca 16%, idoso 11%
  // Esperança: geral 44%, cronico 20%, gestante 6%, puerpera 3%, crianca 16%, idoso 11%
  // Águas:     geral 44%, cronico 20%, gestante 6%, puerpera 3%, crianca 16%, idoso 11%
  const pct = seq / total;
  if (pct < 0.44) return 'adulto';
  if (pct < 0.64) return 'cronico';
  if (pct < 0.70) return 'gestante';
  if (pct < 0.73) return 'puerpera';
  if (pct < 0.89) return 'crianca';
  return 'idoso';
}

function buildPatient(seq, total, ubsId, ubsIdx, bairros) {
  const cat  = categoryFor(seq, total, ubsIdx);
  const age  = ageForCategory(cat, seq);
  const female = (cat === 'gestante' || cat === 'puerpera') ? true : isFemale(seq);
  const sexAtBirth = female ? 'female' : 'male';
  const conds = conditionsForCategory(cat, seq);
  const { teamId, teamName } = teamForPatient(ubsId, seq);
  const numMa = ubsId === 'v2-ubs-horizonte' ? 11 : ubsId === 'v2-ubs-esperanca' ? 6 : 3;
  const { acsId, maName } = acsForPatient(ubsId, seq, numMa);
  const bd = cat === 'crianca' ? dateAgo(age * 365 + (seq % 180)) : birthDateByAge(age, seq);

  const nameIdx = female
    ? (FEMALE_NAMES.indexOf(name(seq).split(' ')[0]) >= 0 ? seq : seq + 1)
    : seq;

  const p = {
    id: `v2-p-${ubsIdx}${String(seq).padStart(4,'0')}`,
    name: name(seq),
    cpf: cpf(ubsIdx, seq),
    cns: cns(ubsIdx * 10000 + seq),
    cnsCpf: cpf(ubsIdx, seq),
    motherName: cat === 'crianca' ? name(seq + 5000) : '',
    birthDate: bd,
    sexAtBirth,
    genderIdentity: '',
    maritalStatus: seq % 5 === 0 ? 'casado' : seq % 5 === 1 ? 'solteiro' : seq % 5 === 2 ? 'divorciado' : '',
    phone: phone(seq, ubsIdx),
    phoneAlt: '',
    address: address(seq, bairros),
    microArea: maName,
    careCategory: cat === 'adulto' ? 'geral' : cat,
    chronicConditions: conds,
    comorbidities: conds.map(c => c === 'hypertension' ? 'Hipertensão Arterial' : 'Diabetes Mellitus').join(', '),
    medications: conds.length ? pick(['Enalapril 10mg, Losartana 50mg','Metformina 850mg','Metformina + Glibenclamida'], seq) : '',
    allergies: seq % 20 === 0 ? 'Penicilina' : seq % 31 === 0 ? 'Dipirona' : '',
    incompleteProfile: seq % 40 === 0,
    inactive: false,
    inactivationReason: '',
    unitId: ubsId,
    teamId,
    teamName,
    municipalityId: MUNICIPALITY_ID,
    assignedAcsId: acsId,
    createdAt: dAgo(180 - (seq % 150)),
    createdBy: 'system-seed',
    updatedAt: dAgo(seq % 60),
    updatedBy: 'system-seed',
  };

  // Category-specific fields
  if (cat === 'gestante') {
    const weeks = ((seq * 7 + 3) % 33) + 6;
    p.pregnancyStartDate = dateAgo(weeks * 7);
    p.expectedDeliveryDate = dateAhead(280 - weeks * 7);
    p.gestationalAgeDumWeeks = weeks;
    p.gestationalAgeDumDays = 0;
  }
  if (cat === 'puerpera') {
    p.daysSinceBirth = ((seq * 5 + 1) % 42) + 1;
  }

  return p;
}

function generatePatients(count, ubsId, ubsIdx, bairros) {
  const patients = [];
  for (let i = 1; i <= count; i++) {
    patients.push(buildPatient(i, count, ubsId, ubsIdx, bairros));
  }
  // Deliberate same-name collisions for isolation demo
  if (ubsId === 'v2-ubs-horizonte') {
    patients[10].name = 'Mariana Silva Rocha';
    patients[50].name = 'Carlos Souza Neto';
  }
  if (ubsId === 'v2-ubs-esperanca') {
    patients[8].name  = 'Mariana Silva Pereira'; // different person, different CPF/DOB
  }
  if (ubsId === 'v2-ubs-aguas') {
    patients[5].name  = 'Carlos Souza Lima'; // different from Horizonte
  }
  return patients;
}

// ── Appointment generator ─────────────────────────────────────────────────────
const APPT_TYPES = ['consulta','retorno','enfermagem','procedimento','visita_domiciliar','preventivo'];
const APPT_HOURS = [8,8,8,9,9,9,10,10,10,11,13,13,14,14,14,15,15,16];

function generateAppointments(patients, users) {
  const appts = [];
  function docOf(ubsId, seq) {
    const docs = users.filter(u => u.role === 'doctor' && u.unitId === ubsId && !u.councilType.startsWith('CRO'));
    return pick(docs, seq);
  }

  // Future appointments — next 12 working days
  let seq = 0;
  for (const ubsId of ['v2-ubs-horizonte','v2-ubs-esperanca','v2-ubs-aguas']) {
    const ubsPatients = patients.filter(p => p.unitId === ubsId);
    const volume = ubsId === 'v2-ubs-horizonte' ? 60 : ubsId === 'v2-ubs-esperanca' ? 36 : 15;
    for (let i = 0; i < volume; i++) {
      const pat  = pick(ubsPatients, i * 17 + 3);
      const doc  = docOf(ubsId, i);
      const day  = workdayAhead(Math.floor(i / 6) + 1);
      const hour = APPT_HOURS[i % APPT_HOURS.length];
      const min  = (i % 3) * 20;
      const type = pick(APPT_TYPES, pat.careCategory === 'gestante' ? 0 : i);
      appts.push({
        id: `v2-appt-fut-${ubsId.slice(-3)}-${String(i).padStart(3,'0')}`,
        patientId: pat.id, patientName: pat.name,
        doctorId: doc?.id || '', doctorName: doc?.name || '',
        unitId: ubsId, teamId: pat.teamId, municipalityId: MUNICIPALITY_ID,
        scheduledAt: tsAt(day, hour, min), duration: 20,
        type: pat.careCategory === 'gestante' ? 'prenatal' : type,
        status: 'scheduled', notes: '',
        createdAt: dAgo(7), createdBy: 'system-seed', updatedAt: dAgo(1),
      });
      seq++;
    }

    // Past appointments — last 30 days (attended, some no-show)
    const pastVol = Math.floor(volume * 0.6);
    for (let i = 0; i < pastVol; i++) {
      const pat  = pick(ubsPatients, i * 11 + 7);
      const doc  = docOf(ubsId, i + 5);
      const daysAgo = (i % 30) + 1;
      const hour = APPT_HOURS[(i + 5) % APPT_HOURS.length];
      const status = i % 7 === 0 ? 'no_show' : i % 11 === 0 ? 'cancelled' : 'attended';
      appts.push({
        id: `v2-appt-past-${ubsId.slice(-3)}-${String(i).padStart(3,'0')}`,
        patientId: pat.id, patientName: pat.name,
        doctorId: doc?.id || '', doctorName: doc?.name || '',
        unitId: ubsId, teamId: pat.teamId, municipalityId: MUNICIPALITY_ID,
        scheduledAt: tsAt(dateAgo(daysAgo), hour), duration: 20,
        type: pick(APPT_TYPES, i), status,
        notes: status === 'attended' ? 'Consulta realizada.' : '',
        createdAt: dAgo(daysAgo + 3), createdBy: 'system-seed', updatedAt: dAgo(daysAgo),
      });
    }
  }
  return appts;
}

// ── Queue entries (fila de hoje) ──────────────────────────────────────────────
const Q_STATUSES = ['aguardando_triagem','liberado','em_atendimento','atendido','faltou','cancelado'];
const Q_PRIORITIES = ['normal','normal','normal','urgente','emergencia'];
const Q_DEMANDS = ['consulta','retorno','curativo','vacina','medicacao','declaracao'];

function generateQueue(patients, users) {
  const entries = [];
  function docOf(ubsId, i) {
    const docs = users.filter(u => u.role === 'doctor' && u.unitId === ubsId && !u.councilType?.startsWith?.('CRO'));
    return pick(docs, i);
  }
  const volumes = { 'v2-ubs-horizonte': 22, 'v2-ubs-esperanca': 12, 'v2-ubs-aguas': 6 };
  for (const [ubsId, vol] of Object.entries(volumes)) {
    const ubsPats = patients.filter(p => p.unitId === ubsId);
    for (let i = 0; i < vol; i++) {
      const pat    = pick(ubsPats, i * 23 + 5);
      const doc    = docOf(ubsId, i);
      const status = Q_STATUSES[i % Q_STATUSES.length];
      const arrivedMins = (i * 7 + 10) % 240;
      const arrivedAt = new Date(Date.now() - arrivedMins * 60000).toISOString();
      entries.push({
        id: `v2-q-${ubsId.slice(-3)}-${String(i).padStart(2,'0')}`,
        patientId: pat.id, patientName: pat.name,
        teamId: pat.teamId, unitId: ubsId, municipalityId: MUNICIPALITY_ID,
        priority: pick(Q_PRIORITIES, i),
        reason: pick(['Consulta de rotina','Dor abdominal','Controle de PA','Retorno de exame','Vacinação','Renovação de receita'], i),
        demandType: pick(Q_DEMANDS, i),
        destination: null, specialty: '', agendaRef: '',
        needsTriage: i % 3 !== 0,
        professionalId: status === 'em_atendimento' ? (doc?.id || null) : null,
        professionalName: status === 'em_atendimento' ? (doc?.name || null) : null,
        status,
        arrivedAt,
        createdAt: arrivedAt, createdBy: 'system-seed',
        updatedAt: arrivedAt, updatedBy: 'system-seed',
      });
    }
  }
  return entries;
}

// ── Exames ────────────────────────────────────────────────────────────────────
const EXAM_TITLES = [
  'Hemograma Completo','Glicemia em Jejum','Colesterol Total e Frações','TSH','Urina Tipo I',
  'Parasitológico de Fezes','Raio-X de Tórax','Ultrassonografia Abdominal','Eletrocardiograma',
  'HbA1c','Creatinina','Ureia','Ácido Úrico','TGO/TGP','PSA Total (>50 anos)',
  'Sorologia para Sífilis','HIV','Hepatite B e C','Ultrassonografia Obstétrica','PCCU',
];
const EXAM_STATUSES = ['solicitado','solicitado','coletado','em_analise','concluido','cancelado'];

function generateExams(patients, users) {
  const exams = [];
  function docOf(ubsId, i) {
    const docs = users.filter(u => u.role === 'doctor' && u.unitId === ubsId);
    return pick(docs, i);
  }
  const volumes = { 'v2-ubs-horizonte': 80, 'v2-ubs-esperanca': 40, 'v2-ubs-aguas': 15 };
  for (const [ubsId, vol] of Object.entries(volumes)) {
    const ubsPats = patients.filter(p => p.unitId === ubsId);
    for (let i = 0; i < vol; i++) {
      const pat  = pick(ubsPats, i * 19 + 3);
      const doc  = docOf(ubsId, i);
      const stat = EXAM_STATUSES[i % EXAM_STATUSES.length];
      const daysAgo = stat === 'solicitado' ? (i % 5) : (i % 20) + 5;
      exams.push({
        id: `v2-exam-${ubsId.slice(-3)}-${String(i).padStart(3,'0')}`,
        patientId: pat.id, patientName: pat.name,
        teamId: pat.teamId, executingUnitId: ubsId,
        title: pick(EXAM_TITLES, i),
        date: dateAgo(daysAgo),
        details: stat === 'concluido' ? 'Resultado dentro dos parâmetros normais.' : '',
        source: i % 5 === 0 ? 'externo' : 'posto',
        status: stat,
        attachments: [],
        createdAt: dAgo(daysAgo + 1),
        createdBy: doc?.id || 'system-seed',
        updatedAt: dAgo(daysAgo),
        updatedBy: doc?.id || 'system-seed',
      });
    }
  }
  return exams;
}

// ── Encaminhamentos ───────────────────────────────────────────────────────────
const SPECIALTIES  = ['Cardiologia','Endocrinologia','Oftalmologia','Ortopedia','Ginecologia','Neurologia','Dermatologia'];
const REF_STATUSES = ['solicitado','regulado','agendado','concluido','cancelado'];
const REF_PRIORITIES = ['normal','urgente','normal','normal'];

function generateReferrals(patients, users) {
  const refs = [];
  function docOf(ubsId, i) {
    const docs = users.filter(u => u.role === 'doctor' && u.unitId === ubsId && !u.councilType?.startsWith?.('CRO'));
    return pick(docs, i);
  }
  const volumes = { 'v2-ubs-horizonte': 20, 'v2-ubs-esperanca': 10, 'v2-ubs-aguas': 5 };
  for (const [ubsId, vol] of Object.entries(volumes)) {
    const ubsPats = patients.filter(p => p.unitId === ubsId);
    for (let i = 0; i < vol; i++) {
      const pat  = pick(ubsPats, i * 31 + 7);
      const doc  = docOf(ubsId, i);
      const stat = REF_STATUSES[i % REF_STATUSES.length];
      const daysAgo = (i % 25) + 1;
      refs.push({
        id: `v2-ref-${ubsId.slice(-3)}-${String(i).padStart(2,'0')}`,
        patientId: pat.id, patientName: pat.name,
        teamId: pat.teamId, executingUnitId: ubsId,
        specialty: pick(SPECIALTIES, i),
        reason: `Encaminhamento para ${pick(SPECIALTIES, i).toLowerCase()} — avaliação especializada.`,
        priority: pick(REF_PRIORITIES, i),
        date: dateAgo(daysAgo),
        notes: stat === 'concluido' ? 'Parecer recebido. Retorno ao médico de referência.' : '',
        status: stat,
        contrarreferencia: stat === 'concluido' ? 'Paciente acompanhado. Sem intercorrências.' : '',
        doctorId: doc?.id || '',
        doctorName: doc?.name || '',
        createdAt: dAgo(daysAgo + 1), createdBy: doc?.id || 'system-seed',
        updatedAt: dAgo(daysAgo), updatedBy: doc?.id || 'system-seed',
        events: [{ ts: dAgo(daysAgo + 1), userId: doc?.id || '', userName: doc?.name || '', from: null, to: stat }],
      });
    }
  }
  return refs;
}

// ── Tarefas ───────────────────────────────────────────────────────────────────
const TASK_TITLES = [
  'Visita domiciliar — paciente acamado','Busca ativa — faltou consulta','Verificar PA em domicílio',
  'Confirmar pré-natal agendado','Visita puerperal','Acompanhar glicemia semanal',
  'Contato para renovação de receita','Verificar exame pendente','Agendar consulta de retorno',
  'Atualizar cadastro — dados incompletos','Verificar coleta de PCCU','Acompanhar criança — crescimento',
  'Entrega de medicação contínua','Verificar vacinação em atraso','Acompanhamento idoso solo',
];
const TASK_PRIORITIES = ['urgente','alta','alta','media','media','media','baixa'];

function generateTasks(patients, users) {
  const tasks = [];
  function acsOf(ubsId, i) {
    const list = users.filter(u => u.role === 'acs' && u.unitId === ubsId);
    return pick(list, i);
  }
  function enfOf(ubsId, i) {
    const list = users.filter(u => u.role === 'nurse_manager' && u.unitId === ubsId);
    return pick(list, i);
  }
  const volumes = { 'v2-ubs-horizonte': 35, 'v2-ubs-esperanca': 18, 'v2-ubs-aguas': 8 };
  for (const [ubsId, vol] of Object.entries(volumes)) {
    const ubsPats = patients.filter(p => p.unitId === ubsId);
    for (let i = 0; i < vol; i++) {
      const pat     = pick(ubsPats, i * 13 + 5);
      const assignee = i % 4 === 0 ? enfOf(ubsId, i) : acsOf(ubsId, i);
      const status  = i % 5 === 0 ? 'concluida' : i % 7 === 0 ? 'em_andamento' : 'pendente';
      const dueIn   = status === 'concluida' ? -(i % 10) : (i % 14);
      tasks.push({
        id: `v2-task-${ubsId.slice(-3)}-${String(i).padStart(2,'0')}`,
        patientId: pat.id, patientName: pat.name,
        title: pick(TASK_TITLES, i + (ubsId === 'v2-ubs-esperanca' ? 5 : ubsId === 'v2-ubs-aguas' ? 10 : 0)),
        priority: pick(TASK_PRIORITIES, i),
        status,
        assignedToId: assignee?.id || '',
        unitId: ubsId, teamId: pat.teamId, municipalityId: MUNICIPALITY_ID,
        dueDate: dueIn >= 0 ? dateAhead(dueIn) : dateAgo(-dueIn),
        notes: status === 'concluida' ? 'Tarefa concluída com sucesso.' : '',
        createdAt: dAgo(7 + i % 20), createdBy: 'system-seed',
        updatedAt: dAgo(i % 7), updatedBy: 'system-seed',
      });
    }
  }
  return tasks;
}

// ── Shadow table sync ─────────────────────────────────────────────────────────
async function syncShadow(client, users, units, patients) {
  for (const u of units) {
    await client.query(`
      INSERT INTO app_units (id, name, cnes, municipality_id, payload, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5::jsonb,NOW(),NOW())
      ON CONFLICT (id) DO UPDATE SET name=$2,cnes=$3,municipality_id=$4,payload=$5::jsonb,updated_at=NOW()
    `, [u.id, u.name, u.cnes, u.municipalityId, JSON.stringify(u)]);
  }
  log(`  → app_units: ${units.length} upserted`);

  for (const u of users) {
    await client.query(`
      INSERT INTO app_users (id,email,role,team_id,unit_id,municipality_id,inactive,payload,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW(),NOW())
      ON CONFLICT (id) DO UPDATE SET email=$2,role=$3,team_id=$4,unit_id=$5,municipality_id=$6,inactive=$7,payload=$8::jsonb,updated_at=NOW()
    `, [u.id,u.email,u.role,u.teamId||'',u.unitId||'',u.municipalityId||'',u.inactive||false,JSON.stringify(u)]);
  }
  log(`  → app_users: ${users.length} upserted`);

  // Batch patients in chunks of 100
  const CHUNK = 100;
  for (let i = 0; i < patients.length; i += CHUNK) {
    const chunk = patients.slice(i, i + CHUNK);
    for (const p of chunk) {
      const cpfHash = p.cpf ? crypto.createHash('sha256').update(p.cpf).digest('hex') : '';
      await client.query(`
        INSERT INTO app_patients (id,name,cpf_hash,unit_id,team_id,municipality_id,assigned_acs_id,inactive,care_category,payload,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,NOW(),NOW())
        ON CONFLICT (id) DO UPDATE SET name=$2,unit_id=$4,team_id=$5,municipality_id=$6,assigned_acs_id=$7,inactive=$8,care_category=$9,payload=$10::jsonb,updated_at=NOW()
      `, [p.id,p.name,cpfHash,p.unitId,p.teamId,p.municipalityId,p.assignedAcsId||'',p.inactive||false,p.careCategory||'geral',JSON.stringify(p)]);
    }
  }
  log(`  → app_patients: ${patients.length} upserted`);
}

// ── Cleanup previous seed data ────────────────────────────────────────────────
function cleanPreviousSeed(db) {
  let removed = 0;
  const prefix = (arr, key) => arr?.filter(x => !String(x?.id||'').startsWith('v2-') || String(x?.[key]||'').startsWith('v2-'));

  // Remove v1 seed data (old prefixes from seed-demo-santa-aurora.mjs v1)
  const oldPrefixes = ['p-h-','p-e-','p-a-','user-doc-','user-enf-','user-acs-','user-rec-','user-ges-','user-gestor-',
    'appt-p-','task-p-','ubs-horizonte','ubs-esperanca','ubs-aguas','team-horizonte-','team-esperanca-','team-aguas-',
    'team-hzn-','team-esp-','team-agu-'];
  const isOld = (id) => oldPrefixes.some(p => String(id||'').startsWith(p));

  for (const col of ['users','units','teams','patients','appointments','queueEntries','exams','referrals','tasks','microAreas']) {
    if (!Array.isArray(db[col])) db[col] = [];
    const before = db[col].length;
    db[col] = db[col].filter(x => {
      const id = String(x?.id || '');
      return !id.startsWith('v2-') && !isOld(id) ? true : id.startsWith('v2-') ? false : !isOld(id);
    });
    removed += before - db[col].length;
  }
  // Also clean by v2- prefix in shadow tables (done by upsert, no action needed here)
  return removed;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log('══════════════════════════════════════════════════════════════════════');
  log('  VITRAS Demo Seed v2 — Município de Santa Aurora');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE'}`);
  log('══════════════════════════════════════════════════════════════════════');

  // Ensure BG vitrasId in pool to avoid collision
  const { rows: bgRows } = await pool.query("SELECT payload->>'vitrasId' AS vid FROM app_users WHERE role='break_glass_admin'");
  for (const r of bgRows) if (r.vid) vitrasIdPool.add(r.vid);
  // Also existing v1 users
  const { rows: v1Rows } = await pool.query("SELECT payload->>'vitrasId' AS vid FROM app_users WHERE id NOT LIKE 'v2-%'");
  for (const r of v1Rows) if (r.vid) vitrasIdPool.add(r.vid);

  // Generate all data
  log('[1/6] Generating users...');
  const users = makeUsers();
  log(`      ${users.length} profissionais`);

  log('[2/6] Generating patients...');
  const patientsH = generatePatients(500, 'v2-ubs-horizonte', 1, BAIRROS_H);
  const patientsE = generatePatients(250, 'v2-ubs-esperanca', 2, BAIRROS_E);
  const patientsA = generatePatients(100, 'v2-ubs-aguas',     3, BAIRROS_A);
  const patients  = [...patientsH, ...patientsE, ...patientsA];
  log(`      ${patients.length} pacientes (H:${patientsH.length} E:${patientsE.length} A:${patientsA.length})`);

  log('[3/6] Generating agenda + fila...');
  const appointments = generateAppointments(patients, users);
  const queueEntries = generateQueue(patients, users);
  log(`      ${appointments.length} consultas, ${queueEntries.length} entradas de fila`);

  log('[4/6] Generating exams + referrals...');
  const exams     = generateExams(patients, users);
  const referrals = generateReferrals(patients, users);
  log(`      ${exams.length} exames, ${referrals.length} encaminhamentos`);

  log('[5/6] Generating tasks...');
  const tasks = generateTasks(patients, users);
  log(`      ${tasks.length} tarefas`);

  const units = UNITS.map(u => ({
    ...u, municipalityId: MUNICIPALITY_ID, municipalityName: MUNICIPALITY_NAME, uf: UF,
    contactEmail: `contato.${u.label}@santa-aurora.sc.gov.br`,
    phone: `(49) ${3000 + u.idx}-0000`,
    status: 'active', createdBy: 'system-seed', createdAt: dAgo(90), updatedAt: dAgo(1),
  }));
  const teams = TEAMS.map(t => ({
    ...t, municipalityId: MUNICIPALITY_ID, managerUserId: '', createdAt: dAgo(90), updatedAt: dAgo(1),
  }));
  const microAreas = MICRO_AREAS.map(m => ({
    ...m, municipalityId: MUNICIPALITY_ID,
    description: `${m.territory} — ${m.name}`,
    createdAt: dAgo(90), updatedAt: dAgo(1),
  }));

  if (DRY_RUN) {
    log('\n[DRY RUN] Summary:');
    log(`  Units:        ${units.length}`);
    log(`  Teams:        ${teams.length}`);
    log(`  MicroAreas:   ${microAreas.length}`);
    log(`  Users:        ${users.length}`);
    log(`  Patients:     ${patients.length}`);
    log(`  Appointments: ${appointments.length}`);
    log(`  Queue:        ${queueEntries.length}`);
    log(`  Exams:        ${exams.length}`);
    log(`  Referrals:    ${referrals.length}`);
    log(`  Tasks:        ${tasks.length}`);
    log(`\nDRY RUN complete (${elapsed()}). No changes made.`);
    return;
  }

  log('[6/6] Writing to database...');

  // Load app_state
  const { rows: stateRows } = await pool.query('SELECT data FROM app_state WHERE id = 1');
  if (!stateRows.length) { log('❌ app_state missing'); process.exit(1); }
  const db = stateRows[0].data;
  for (const col of ['units','teams','users','patients','appointments','queueEntries','exams','referrals','tasks','microAreas','municipalities']) {
    if (!Array.isArray(db[col])) db[col] = [];
  }

  // Ensure municipality in app_state
  if (!db.municipalities.some(m => m.id === MUNICIPALITY_ID)) {
    db.municipalities.push({ id: MUNICIPALITY_ID, ibge: MUNICIPALITY_ID, name: MUNICIPALITY_NAME, uf: UF, region: 'Sul', state: 'Santa Catarina' });
  }

  // Clean previous seed data
  const removed = cleanPreviousSeed(db);
  log(`  → Cleaned ${removed} old seed entries from app_state`);

  // Upsert all new data
  function upsertAll(col, items) {
    let inserted = 0;
    for (const item of items) {
      const idx = db[col].findIndex(x => x.id === item.id);
      if (idx >= 0) db[col][idx] = item;
      else { db[col].push(item); inserted++; }
    }
    return inserted;
  }

  upsertAll('units', units);
  upsertAll('teams', teams);
  upsertAll('users', users);
  upsertAll('patients', patients);
  upsertAll('appointments', appointments);
  upsertAll('queueEntries', queueEntries);
  upsertAll('exams', exams);
  upsertAll('referrals', referrals);
  upsertAll('tasks', tasks);
  upsertAll('microAreas', microAreas);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure synthetic municipality in municipalities table
    await client.query(`
      INSERT INTO municipalities (ibge_code, name, uf, region, is_capital, active, ibge_version, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (ibge_code) DO NOTHING
    `, [MUNICIPALITY_ID, MUNICIPALITY_NAME, UF, 'Sul', false, true, 'demo']);

    // Delete v1 shadow table data
    await client.query("DELETE FROM app_patients WHERE id NOT LIKE 'v2-%' AND id LIKE 'p-%'");
    await client.query("DELETE FROM app_units WHERE id NOT LIKE 'v2-%' AND id IN ('ubs-horizonte','ubs-esperanca','ubs-aguas')");
    await client.query(`DELETE FROM app_users WHERE id NOT LIKE 'v2-%' AND id LIKE 'user-%'`);

    // Write app_state
    await client.query('UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1', [JSON.stringify(db)]);
    log('  → app_state.data updated');

    // Sync shadow tables
    await syncShadow(client, users, units, patients);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // ── Post-seed verification ────────────────────────────────────────────────
  log('\n══ POST-SEED VERIFICATION ══');
  const counts = {};
  for (const t of ['app_units','app_users','app_patients']) {
    const r = await pool.query(`SELECT count(*) FROM ${t}`);
    counts[t] = parseInt(r.rows[0].count, 10);
  }
  const { rows: v2Units } = await pool.query("SELECT count(*) FROM app_units WHERE id LIKE 'v2-%'");
  const { rows: v2Pats  } = await pool.query("SELECT count(*) FROM app_patients WHERE id LIKE 'v2-%'");
  const { rows: v2Users } = await pool.query("SELECT count(*) FROM app_users WHERE id LIKE 'v2-%'");
  const { rows: bgCheck } = await pool.query("SELECT count(*) FROM app_users WHERE role='break_glass_admin'");

  log(`  app_units total:    ${counts.app_units}  (v2: ${v2Units[0].count})`);
  log(`  app_users total:    ${counts.app_users}  (v2: ${v2Users[0].count}, BG: ${bgCheck[0].count})`);
  log(`  app_patients total: ${counts.app_patients}  (v2: ${v2Pats[0].count})`);

  const catCounts = {};
  for (const p of patients) catCounts[p.careCategory] = (catCounts[p.careCategory] || 0) + 1;
  log(`\n  Patient distribution:`);
  for (const [cat, cnt] of Object.entries(catCounts).sort()) log(`    ${cat.padEnd(12)}: ${cnt}`);

  log(`\n══ DEMO CREDENTIALS ══`);
  log(`  Password for ALL demo users: Demo@2026!`);
  log(`  Multi-UBS gestor: clara.sms@santa-aurora.vitras.local`);
  log(`\n  UBS Jardim Horizonte:`);
  log(`    Médico (Azul):  marcio.medico@horizonte.vitras.local`);
  log(`    Médico (Sol):   fernanda.medica@horizonte.vitras.local`);
  log(`    Médico (Vida):  paulo.medico@horizonte.vitras.local`);
  log(`    Enfermeira:     silvia.enf@horizonte.vitras.local`);
  log(`    Recepção:       eliane.recep@horizonte.vitras.local`);
  log(`    Gestora:        priscila.gestora@horizonte.vitras.local`);
  log(`\n  UBS Vila Esperança:`);
  log(`    Médico Norte:   leonardo.medico@esperanca.vitras.local`);
  log(`    Médico Sul:     beatriz.medica@esperanca.vitras.local`);
  log(`    Recepção:       paulo.recep@esperanca.vitras.local`);
  log(`\n  UBS Parque das Águas:`);
  log(`    Médica:         simone.medica@aguas.vitras.local`);
  log(`    Recepção:       estela.recep@aguas.vitras.local`);

  log(`\n✅ SEED COMPLETE (${elapsed()})`);
  log(`   850 pacientes | ${appointments.length} consultas | ${exams.length} exames | ${referrals.length} encaminhamentos | ${tasks.length} tarefas`);
}

main()
  .catch(e => { console.error('FATAL:', e.message, '\n', e.stack); process.exit(1); })
  .finally(() => pool.end());
