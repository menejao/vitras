/**
 * seed-demo-santa-aurora.mjs
 *
 * Populates a clean VITRAS staging DB with synthetic demo data for 3 UBS
 * in Município de Santa Aurora (synthetic, fictional).
 *
 * UBS 1: Jardim Horizonte  — main, full clinical flows, most volume
 * UBS 2: Vila Esperança    — secondary, unit-switching demo
 * UBS 3: Parque das Águas  — smaller, scalability demo
 *
 * Safety guards:
 *   - Requires DEMO_SEED_ALLOWED=true
 *   - Blocks if RENDER env present
 *   - Idempotent (skips existing IDs)
 *
 * Usage:
 *   node --env-file=.env scripts/seed-demo-santa-aurora.mjs
 *   node --env-file=.env scripts/seed-demo-santa-aurora.mjs --dry-run
 */

import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

if (process.env.DEMO_SEED_ALLOWED !== 'true') {
  console.error('❌ DEMO_SEED_ALLOWED=true required.');
  process.exit(2);
}
if (process.env.RENDER) {
  console.error('❌ RENDER environment detected — refusing to seed on Render.');
  process.exit(2);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const NOW = new Date().toISOString();

function dAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString();
}
function dateAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}
function dateAhead(n) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `s1$${salt}$${key}`;
}

function genVitrasId(existing) {
  let t = 0;
  while (t++ < 200) {
    const c = String(100000000 + crypto.randomInt(0, 900000000));
    if (!existing.has(c)) { existing.add(c); return c; }
  }
  throw new Error('Cannot generate unique vitrasId');
}

function uuid() { return crypto.randomUUID(); }

// ── Constants ─────────────────────────────────────────────────────────────────
const MUNICIPALITY_ID = '4299999'; // Santa Aurora (synthetic — non-conflicting IBGE code)
const MUNICIPALITY_NAME = 'Santa Aurora';
const UF = 'SC';

const DEMO_PASSWORD = 'Demo@2026!';

// ── UBS definitions ───────────────────────────────────────────────────────────
const UNITS = [
  { id: 'ubs-horizonte',  name: 'UBS Jardim Horizonte',  cnes: '1000001', label: 'horizonte' },
  { id: 'ubs-esperanca',  name: 'UBS Vila Esperança',    cnes: '1000002', label: 'esperanca' },
  { id: 'ubs-aguas',      name: 'UBS Parque das Águas',  cnes: '1000003', label: 'aguas'     },
];

// 3 teams per UBS
const TEAMS = [
  // Jardim Horizonte
  { id: 'team-horizonte-azul',    name: 'Equipe Azul',    unitId: 'ubs-horizonte', ine: '0001000001', tipoEquipe: 'ESF' },
  { id: 'team-horizonte-verde',   name: 'Equipe Verde',   unitId: 'ubs-horizonte', ine: '0001000002', tipoEquipe: 'ESF' },
  { id: 'team-horizonte-amarelo', name: 'Equipe Amarelo', unitId: 'ubs-horizonte', ine: '0001000003', tipoEquipe: 'ESF' },
  // Vila Esperança
  { id: 'team-esperanca-prata',   name: 'Equipe Prata',   unitId: 'ubs-esperanca', ine: '0002000001', tipoEquipe: 'ESF' },
  { id: 'team-esperanca-ouro',    name: 'Equipe Ouro',    unitId: 'ubs-esperanca', ine: '0002000002', tipoEquipe: 'ESF' },
  { id: 'team-esperanca-bronze',  name: 'Equipe Bronze',  unitId: 'ubs-esperanca', ine: '0002000003', tipoEquipe: 'NASF' },
  // Parque das Águas
  { id: 'team-aguas-coral',       name: 'Equipe Coral',   unitId: 'ubs-aguas',     ine: '0003000001', tipoEquipe: 'ESF' },
  { id: 'team-aguas-safira',      name: 'Equipe Safira',  unitId: 'ubs-aguas',     ine: '0003000002', tipoEquipe: 'ESF' },
  { id: 'team-aguas-esmeralda',   name: 'Equipe Esmeralda', unitId: 'ubs-aguas',   ine: '0003000003', tipoEquipe: 'ESF' },
];

// Users per UBS — doctor, nurse_manager, ACS × 3, receptionist, gestor (shared)
function makeUsers(vitrasIds) {
  const pw = hashPassword(DEMO_PASSWORD);
  const base = {
    password: pw, inactive: false, twoFactorEnabled: false, twoFactorSecret: '',
    twoFactorPendingSecret: '', twoFactorPendingCreatedAt: '',
    lastLoginAt: '', lastSeenAt: '', lastSeenIp: '',
    councilType: '', councilNumber: '', councilUf: '',
    createdBy: 'system-seed', createdAt: dAgo(60), updatedAt: dAgo(1),
  };

  const users = [
    // ── Gestor multi-UBS (can switch units) ──────────────────────────────────
    {
      ...base, id: 'user-gestor-mario', name: 'Dr. Mário Henrique Fonseca',
      email: 'mario.gestor@santa-aurora.vitras.local',
      role: 'gestor', unitId: 'ubs-horizonte', teamId: 'team-horizonte-azul',
      teamName: 'Equipe Azul', municipalityId: MUNICIPALITY_ID,
      vitrasId: genVitrasId(vitrasIds),
    },

    // ── Jardim Horizonte ──────────────────────────────────────────────────────
    {
      ...base, id: 'user-doc-horizonte-1', name: 'Dra. Patrícia Almeida Melo',
      email: 'patricia.medica@horizonte.vitras.local',
      role: 'doctor', unitId: 'ubs-horizonte', teamId: 'team-horizonte-azul',
      teamName: 'Equipe Azul', municipalityId: MUNICIPALITY_ID,
      councilType: 'CRM', councilNumber: '12345', councilUf: 'SC',
      vitrasId: genVitrasId(vitrasIds),
    },
    {
      ...base, id: 'user-enf-horizonte-1', name: 'Enf. Carla Souza Braga',
      email: 'carla.enfermeira@horizonte.vitras.local',
      role: 'nurse_manager', unitId: 'ubs-horizonte', teamId: 'team-horizonte-azul',
      teamName: 'Equipe Azul', municipalityId: MUNICIPALITY_ID,
      councilType: 'COREN', councilNumber: 'SC-23456', councilUf: 'SC',
      vitrasId: genVitrasId(vitrasIds),
    },
    {
      ...base, id: 'user-acs-horizonte-1', name: 'ACS Fernanda Lima',
      email: 'fernanda.acs@horizonte.vitras.local',
      role: 'acs', unitId: 'ubs-horizonte', teamId: 'team-horizonte-azul',
      teamName: 'Equipe Azul', municipalityId: MUNICIPALITY_ID,
      vitrasId: genVitrasId(vitrasIds),
    },
    {
      ...base, id: 'user-acs-horizonte-2', name: 'ACS Robson Pereira',
      email: 'robson.acs@horizonte.vitras.local',
      role: 'acs', unitId: 'ubs-horizonte', teamId: 'team-horizonte-verde',
      teamName: 'Equipe Verde', municipalityId: MUNICIPALITY_ID,
      vitrasId: genVitrasId(vitrasIds),
    },
    {
      ...base, id: 'user-doc-horizonte-2', name: 'Dr. Eduardo Câmara Neto',
      email: 'eduardo.medico@horizonte.vitras.local',
      role: 'doctor', unitId: 'ubs-horizonte', teamId: 'team-horizonte-verde',
      teamName: 'Equipe Verde', municipalityId: MUNICIPALITY_ID,
      councilType: 'CRM', councilNumber: '22345', councilUf: 'SC',
      vitrasId: genVitrasId(vitrasIds),
    },
    {
      ...base, id: 'user-recep-horizonte', name: 'Recepcionista Ana Clara',
      email: 'ana.recep@horizonte.vitras.local',
      role: 'receptionist', unitId: 'ubs-horizonte', teamId: 'team-horizonte-azul',
      teamName: 'Equipe Azul', municipalityId: MUNICIPALITY_ID,
      vitrasId: genVitrasId(vitrasIds),
    },

    // ── Vila Esperança ────────────────────────────────────────────────────────
    {
      ...base, id: 'user-doc-esperanca-1', name: 'Dr. Carlos Antônio Ribeiro',
      email: 'carlos.medico@esperanca.vitras.local',
      role: 'doctor', unitId: 'ubs-esperanca', teamId: 'team-esperanca-prata',
      teamName: 'Equipe Prata', municipalityId: MUNICIPALITY_ID,
      councilType: 'CRM', councilNumber: '33456', councilUf: 'SC',
      vitrasId: genVitrasId(vitrasIds),
    },
    {
      ...base, id: 'user-enf-esperanca-1', name: 'Enf. Daniela Matos Cunha',
      email: 'daniela.enf@esperanca.vitras.local',
      role: 'nurse_manager', unitId: 'ubs-esperanca', teamId: 'team-esperanca-prata',
      teamName: 'Equipe Prata', municipalityId: MUNICIPALITY_ID,
      councilType: 'COREN', councilNumber: 'SC-34567', councilUf: 'SC',
      vitrasId: genVitrasId(vitrasIds),
    },
    {
      ...base, id: 'user-acs-esperanca-1', name: 'ACS Juliana Rocha',
      email: 'juliana.acs@esperanca.vitras.local',
      role: 'acs', unitId: 'ubs-esperanca', teamId: 'team-esperanca-prata',
      teamName: 'Equipe Prata', municipalityId: MUNICIPALITY_ID,
      vitrasId: genVitrasId(vitrasIds),
    },
    {
      ...base, id: 'user-recep-esperanca', name: 'Recepcionista Paulo Mendes',
      email: 'paulo.recep@esperanca.vitras.local',
      role: 'receptionist', unitId: 'ubs-esperanca', teamId: 'team-esperanca-prata',
      teamName: 'Equipe Prata', municipalityId: MUNICIPALITY_ID,
      vitrasId: genVitrasId(vitrasIds),
    },

    // ── Parque das Águas ──────────────────────────────────────────────────────
    {
      ...base, id: 'user-doc-aguas-1', name: 'Dra. Renata Vieira Campos',
      email: 'renata.medica@aguas.vitras.local',
      role: 'doctor', unitId: 'ubs-aguas', teamId: 'team-aguas-coral',
      teamName: 'Equipe Coral', municipalityId: MUNICIPALITY_ID,
      councilType: 'CRM', councilNumber: '44567', councilUf: 'SC',
      vitrasId: genVitrasId(vitrasIds),
    },
    {
      ...base, id: 'user-acs-aguas-1', name: 'ACS Marcos Teixeira',
      email: 'marcos.acs@aguas.vitras.local',
      role: 'acs', unitId: 'ubs-aguas', teamId: 'team-aguas-coral',
      teamName: 'Equipe Coral', municipalityId: MUNICIPALITY_ID,
      vitrasId: genVitrasId(vitrasIds),
    },
    {
      ...base, id: 'user-recep-aguas', name: 'Recepcionista Simone Ferraz',
      email: 'simone.recep@aguas.vitras.local',
      role: 'receptionist', unitId: 'ubs-aguas', teamId: 'team-aguas-coral',
      teamName: 'Equipe Coral', municipalityId: MUNICIPALITY_ID,
      vitrasId: genVitrasId(vitrasIds),
    },
  ];

  return users;
}

// ── Patient builders ──────────────────────────────────────────────────────────
function buildPatient({ id, name, cpf, birthDate, sexAtBirth, careCategory, conditions, unitId, teamId, acsId, microArea, address, phone, extra = {} }) {
  return {
    id,
    name,
    cpf,
    cns: '',
    cnsCpf: cpf,
    motherName: '',
    birthDate,
    sexAtBirth,
    genderIdentity: '',
    maritalStatus: '',
    phone,
    phoneAlt: '',
    address,
    microArea,
    careCategory,
    chronicConditions: conditions || [],
    comorbidities: (conditions || []).map(c => c === 'hypertension' ? 'Hipertensão Arterial' : 'Diabetes Mellitus').join(', '),
    medications: '',
    allergies: '',
    incompleteProfile: false,
    inactive: false,
    inactivationReason: '',
    unitId,
    teamId,
    municipalityId: MUNICIPALITY_ID,
    assignedAcsId: acsId,
    createdAt: dAgo(90),
    createdBy: 'system-seed',
    updatedAt: dAgo(7),
    updatedBy: 'system-seed',
    ...extra,
  };
}

function makePatients() {
  const patients = [];

  // ── UBS Jardim Horizonte (≈ 50 patients) ─────────────────────────────────

  // Equipe Azul — ACS Fernanda
  const azulAcs = 'user-acs-horizonte-1';
  [
    { id: 'p-h-001', name: 'Roberto Carlos Menezes',    cpf: '100.001.001-01', birthDate: '1975-03-12', sexAtBirth: 'male',   conditions: ['hypertension'],              microArea: 'MA-1', address: 'Rua das Laranjeiras, 45',    phone: '(49) 9 8001-0001' },
    { id: 'p-h-002', name: 'Maria Aparecida Cunha',     cpf: '100.001.002-02', birthDate: '1968-07-22', sexAtBirth: 'female', conditions: ['hypertension', 'diabetes'],  microArea: 'MA-1', address: 'Rua das Laranjeiras, 47',    phone: '(49) 9 8001-0002' },
    { id: 'p-h-003', name: 'Lucas Pereira da Silva',    cpf: '100.001.003-03', birthDate: '1992-11-05', sexAtBirth: 'male',   conditions: [],                            microArea: 'MA-1', address: 'Av. Jardim Horizonte, 200', phone: '(49) 9 8001-0003' },
    { id: 'p-h-004', name: 'Ana Beatriz Rodrigues',     cpf: '100.001.004-04', birthDate: '1988-04-18', sexAtBirth: 'female', conditions: [],                            microArea: 'MA-2', address: 'Av. Jardim Horizonte, 350', phone: '(49) 9 8001-0004' },
    { id: 'p-h-005', name: 'João Carlos Oliveira',      cpf: '100.001.005-05', birthDate: '1955-09-30', sexAtBirth: 'male',   conditions: ['hypertension'],              microArea: 'MA-2', address: 'Rua do Pinheiro, 18',       phone: '(49) 9 8001-0005' },
    { id: 'p-h-006', name: 'Tereza Cristina Alves',     cpf: '100.001.006-06', birthDate: '1948-01-14', sexAtBirth: 'female', conditions: ['hypertension', 'diabetes'],  microArea: 'MA-2', address: 'Rua do Pinheiro, 20',       phone: '(49) 9 8001-0006' },
    { id: 'p-h-007', name: 'Marcos Antônio Barbosa',    cpf: '100.001.007-07', birthDate: '1980-06-25', sexAtBirth: 'male',   conditions: ['diabetes'],                  microArea: 'MA-3', address: 'Travessa das Flores, 7',    phone: '(49) 9 8001-0007' },
    { id: 'p-h-008', name: 'Lúcia Santos de Moraes',    cpf: '100.001.008-08', birthDate: '1962-12-08', sexAtBirth: 'female', conditions: [],                            microArea: 'MA-3', address: 'Travessa das Flores, 9',    phone: '(49) 9 8001-0008' },
    { id: 'p-h-009', name: 'Fábio Henrique Lima',       cpf: '100.001.009-09', birthDate: '1983-08-17', sexAtBirth: 'male',   conditions: [],                            microArea: 'MA-3', address: 'Rua Esperança, 101',        phone: '(49) 9 8001-0009' },
    { id: 'p-h-010', name: 'Tatiane Gomes Ferreira',    cpf: '100.001.010-10', birthDate: '1990-02-22', sexAtBirth: 'female', conditions: [],                            microArea: 'MA-1', address: 'Rua Esperança, 103',        phone: '(49) 9 8001-0010' },
    // gestantes
    { id: 'p-h-011', name: 'Bruna Cavalcanti Martins',  cpf: '100.001.011-11', birthDate: '1997-05-03', sexAtBirth: 'female', conditions: [],                            microArea: 'MA-1', address: 'Rua das Violetas, 14',      phone: '(49) 9 8001-0011',
      extra: { careCategory: 'gestante', pregnancyStartDate: dateAgo(112), expectedDeliveryDate: dateAhead(168), gestationalAgeDumWeeks: 16, gestationalAgeDumDays: 0 } },
    { id: 'p-h-012', name: 'Larissa Souza Andrade',     cpf: '100.001.012-12', birthDate: '1994-10-29', sexAtBirth: 'female', conditions: [],                            microArea: 'MA-2', address: 'Rua Boa Vista, 66',         phone: '(49) 9 8001-0012',
      extra: { careCategory: 'gestante', pregnancyStartDate: dateAgo(196), expectedDeliveryDate: dateAhead(84), gestationalAgeDumWeeks: 28, gestationalAgeDumDays: 0 } },
    // crianças
    { id: 'p-h-013', name: 'Valentina Rocha Albuquerque', cpf: '100.001.013-13', birthDate: dateAgo(35), sexAtBirth: 'female', conditions: [],                           microArea: 'MA-3', address: 'Rua das Laranjeiras, 51',   phone: '(49) 9 8001-0013',
      extra: { careCategory: 'crianca', motherName: 'Priscila Rocha Albuquerque' } },
    { id: 'p-h-014', name: 'Matheus Lima Santos',         cpf: '100.001.014-14', birthDate: dateAgo(180), sexAtBirth: 'male', conditions: [],                            microArea: 'MA-1', address: 'Av. Jardim Horizonte, 412', phone: '(49) 9 8001-0014',
      extra: { careCategory: 'crianca', motherName: 'Fernanda Lima Santos' } },
    // puerperais
    { id: 'p-h-015', name: 'Adriana Coelho Tavares',    cpf: '100.001.015-15', birthDate: '1993-07-11', sexAtBirth: 'female', conditions: [],                            microArea: 'MA-2', address: 'Rua dos Ipês, 33',          phone: '(49) 9 8001-0015',
      extra: { careCategory: 'puerpera', daysSinceBirth: 8 } },
    // idosos
    { id: 'p-h-016', name: 'Antônio Ramos da Costa',    cpf: '100.001.016-16', birthDate: '1945-03-19', sexAtBirth: 'male',   conditions: ['hypertension'],              microArea: 'MA-2', address: 'Rua do Pinheiro, 30',       phone: '(49) 9 8001-0016' },
    { id: 'p-h-017', name: 'Marlene Freitas Borges',    cpf: '100.001.017-17', birthDate: '1950-11-27', sexAtBirth: 'female', conditions: ['hypertension', 'diabetes'],  microArea: 'MA-3', address: 'Travessa das Flores, 12',   phone: '(49) 9 8001-0017' },
  ].forEach(def => {
    patients.push(buildPatient({
      ...def,
      careCategory: def.extra?.careCategory || (def.conditions?.length ? 'cronico' : 'geral'),
      unitId: 'ubs-horizonte', teamId: 'team-horizonte-azul', acsId: azulAcs,
      extra: def.extra || {},
    }));
  });

  // Equipe Verde — ACS Robson
  const verdeAcs = 'user-acs-horizonte-2';
  [
    { id: 'p-h-101', name: 'Sônia Maria Carvalho',      cpf: '100.002.001-01', birthDate: '1972-04-08', sexAtBirth: 'female', conditions: ['hypertension'],             microArea: 'MA-4', address: 'Rua das Castanheiras, 12',  phone: '(49) 9 8002-0001' },
    { id: 'p-h-102', name: 'Gilson Leite Gonçalves',    cpf: '100.002.002-02', birthDate: '1967-08-14', sexAtBirth: 'male',   conditions: ['diabetes'],                 microArea: 'MA-4', address: 'Rua das Castanheiras, 14',  phone: '(49) 9 8002-0002' },
    { id: 'p-h-103', name: 'Natalia Guimarães Pires',   cpf: '100.002.003-03', birthDate: '1995-01-30', sexAtBirth: 'female', conditions: [],                           microArea: 'MA-4', address: 'Alameda Verde, 55',          phone: '(49) 9 8002-0003' },
    { id: 'p-h-104', name: 'Edson Moreira da Luz',      cpf: '100.002.004-04', birthDate: '1978-06-20', sexAtBirth: 'male',   conditions: [],                           microArea: 'MA-5', address: 'Alameda Verde, 57',          phone: '(49) 9 8002-0004' },
    { id: 'p-h-105', name: 'Débora Nunes Azevedo',      cpf: '100.002.005-05', birthDate: '1986-12-05', sexAtBirth: 'female', conditions: [],                           microArea: 'MA-5', address: 'Rua Panorâmica, 89',         phone: '(49) 9 8002-0005' },
    { id: 'p-h-106', name: 'Wanderley Pinto Machado',   cpf: '100.002.006-06', birthDate: '1958-09-17', sexAtBirth: 'male',   conditions: ['hypertension'],             microArea: 'MA-5', address: 'Rua Panorâmica, 91',         phone: '(49) 9 8002-0006' },
    { id: 'p-h-107', name: 'Elisabete Monteiro Cruz',   cpf: '100.002.007-07', birthDate: '1963-03-28', sexAtBirth: 'female', conditions: ['hypertension', 'diabetes'], microArea: 'MA-6', address: 'Estrada do Pomar, 200',      phone: '(49) 9 8002-0007' },
    // gestante
    { id: 'p-h-108', name: 'Camila Torres Nascimento',  cpf: '100.002.008-08', birthDate: '1999-08-12', sexAtBirth: 'female', conditions: [],                           microArea: 'MA-6', address: 'Estrada do Pomar, 202',      phone: '(49) 9 8002-0008',
      extra: { careCategory: 'gestante', pregnancyStartDate: dateAgo(252), expectedDeliveryDate: dateAhead(28), gestationalAgeDumWeeks: 36, gestationalAgeDumDays: 0 } },
    // idosos
    { id: 'p-h-109', name: 'Geraldo Aparecido Lima',    cpf: '100.002.009-09', birthDate: '1942-05-15', sexAtBirth: 'male',   conditions: ['hypertension'],             microArea: 'MA-6', address: 'Alameda Verde, 80',          phone: '(49) 9 8002-0009' },
    { id: 'p-h-110', name: 'Ivone Barbosa Machado',     cpf: '100.002.010-10', birthDate: '1949-10-03', sexAtBirth: 'female', conditions: ['diabetes'],                 microArea: 'MA-4', address: 'Rua das Castanheiras, 30',  phone: '(49) 9 8002-0010' },
  ].forEach(def => {
    patients.push(buildPatient({
      ...def,
      careCategory: def.extra?.careCategory || (def.conditions?.length ? 'cronico' : 'geral'),
      unitId: 'ubs-horizonte', teamId: 'team-horizonte-verde', acsId: verdeAcs,
      extra: def.extra || {},
    }));
  });

  // ── UBS Vila Esperança (≈ 30 patients) ────────────────────────────────────
  const pratAcs = 'user-acs-esperanca-1';
  [
    { id: 'p-e-001', name: 'Ricardo Moura Santana',     cpf: '200.001.001-01', birthDate: '1977-02-14', sexAtBirth: 'male',   conditions: ['hypertension'],             microArea: 'MA-1', address: 'Rua da Esperança, 10',      phone: '(49) 9 9001-0001' },
    { id: 'p-e-002', name: 'Claudia Araújo Leite',      cpf: '200.001.002-02', birthDate: '1970-08-20', sexAtBirth: 'female', conditions: ['hypertension', 'diabetes'], microArea: 'MA-1', address: 'Rua da Esperança, 12',      phone: '(49) 9 9001-0002' },
    { id: 'p-e-003', name: 'Bruno Cavalcante Macedo',   cpf: '200.001.003-03', birthDate: '1989-05-07', sexAtBirth: 'male',   conditions: [],                           microArea: 'MA-2', address: 'Av. Vila Esperança, 300',   phone: '(49) 9 9001-0003' },
    { id: 'p-e-004', name: 'Solange Lima Parreira',     cpf: '200.001.004-04', birthDate: '1984-11-19', sexAtBirth: 'female', conditions: [],                           microArea: 'MA-2', address: 'Av. Vila Esperança, 302',   phone: '(49) 9 9001-0004' },
    { id: 'p-e-005', name: 'Henrique Peixoto Saraiva',  cpf: '200.001.005-05', birthDate: '1952-07-03', sexAtBirth: 'male',   conditions: ['hypertension'],             microArea: 'MA-3', address: 'Rua das Palmeiras, 88',     phone: '(49) 9 9001-0005' },
    { id: 'p-e-006', name: 'Carmen Souza Figueiredo',   cpf: '200.001.006-06', birthDate: '1946-03-31', sexAtBirth: 'female', conditions: ['diabetes'],                 microArea: 'MA-3', address: 'Rua das Palmeiras, 90',     phone: '(49) 9 9001-0006' },
    { id: 'p-e-007', name: 'Andréia Vieira Torres',     cpf: '200.001.007-07', birthDate: '1998-09-25', sexAtBirth: 'female', conditions: [],                           microArea: 'MA-1', address: 'Rua da Paz, 55',            phone: '(49) 9 9001-0007',
      extra: { careCategory: 'gestante', pregnancyStartDate: dateAgo(140), expectedDeliveryDate: dateAhead(140), gestationalAgeDumWeeks: 20, gestationalAgeDumDays: 0 } },
    { id: 'p-e-008', name: 'Eliza Costa Dutra',         cpf: '200.001.008-08', birthDate: '1991-06-15', sexAtBirth: 'female', conditions: [],                           microArea: 'MA-2', address: 'Rua da Paz, 57',            phone: '(49) 9 9001-0008',
      extra: { careCategory: 'gestante', pregnancyStartDate: dateAgo(56), expectedDeliveryDate: dateAhead(224), gestationalAgeDumWeeks: 8, gestationalAgeDumDays: 0 } },
    { id: 'p-e-009', name: 'Pedro Alves Nascimento',    cpf: '200.001.009-09', birthDate: dateAgo(21),  sexAtBirth: 'male',   conditions: [],                           microArea: 'MA-3', address: 'Rua das Palmeiras, 92',     phone: '(49) 9 9001-0009',
      extra: { careCategory: 'crianca', motherName: 'Juliana Alves Nascimento' } },
    { id: 'p-e-010', name: 'Clara Santos Lopes',        cpf: '200.001.010-10', birthDate: '1973-01-09', sexAtBirth: 'female', conditions: ['hypertension'],             microArea: 'MA-1', address: 'Av. Vila Esperança, 400',   phone: '(49) 9 9001-0010' },
    { id: 'p-e-011', name: 'Valter Rocha Novaes',       cpf: '200.001.011-11', birthDate: '1966-04-12', sexAtBirth: 'male',   conditions: [],                           microArea: 'MA-2', address: 'Rua das Palmeiras, 100',    phone: '(49) 9 9001-0011' },
    { id: 'p-e-012', name: 'Dilma Ferreira Castelo',    cpf: '200.001.012-12', birthDate: '1960-12-01', sexAtBirth: 'female', conditions: ['diabetes'],                 microArea: 'MA-3', address: 'Rua da Esperança, 30',      phone: '(49) 9 9001-0012' },
    { id: 'p-e-013', name: 'Rodrigo Matos Borba',       cpf: '200.001.013-13', birthDate: '1985-03-28', sexAtBirth: 'male',   conditions: [],                           microArea: 'MA-1', address: 'Av. Vila Esperança, 500',   phone: '(49) 9 9001-0013' },
    { id: 'p-e-014', name: 'Ivana Campos Proença',      cpf: '200.001.014-14', birthDate: '1993-07-17', sexAtBirth: 'female', conditions: [],                           microArea: 'MA-2', address: 'Rua da Paz, 70',            phone: '(49) 9 9001-0014' },
  ].forEach(def => {
    patients.push(buildPatient({
      ...def,
      careCategory: def.extra?.careCategory || (def.conditions?.length ? 'cronico' : 'geral'),
      unitId: 'ubs-esperanca', teamId: 'team-esperanca-prata', acsId: pratAcs,
      extra: def.extra || {},
    }));
  });

  // ── UBS Parque das Águas (≈ 20 patients) ──────────────────────────────────
  const coralAcs = 'user-acs-aguas-1';
  [
    { id: 'p-a-001', name: 'Osvaldo Teixeira Mendes',   cpf: '300.001.001-01', birthDate: '1969-11-08', sexAtBirth: 'male',   conditions: ['hypertension'],             microArea: 'MA-1', address: 'Rua das Águas, 15',         phone: '(49) 9 7001-0001' },
    { id: 'p-a-002', name: 'Rosângela Pires Andrade',   cpf: '300.001.002-02', birthDate: '1974-06-19', sexAtBirth: 'female', conditions: ['diabetes'],                 microArea: 'MA-1', address: 'Rua das Águas, 17',         phone: '(49) 9 7001-0002' },
    { id: 'p-a-003', name: 'Clóvis Ramos Guimarães',    cpf: '300.001.003-03', birthDate: '1981-02-25', sexAtBirth: 'male',   conditions: [],                           microArea: 'MA-2', address: 'Av. Parque das Águas, 100', phone: '(49) 9 7001-0003' },
    { id: 'p-a-004', name: 'Tatiana Monteiro Almeida',  cpf: '300.001.004-04', birthDate: '1987-09-14', sexAtBirth: 'female', conditions: [],                           microArea: 'MA-2', address: 'Av. Parque das Águas, 102', phone: '(49) 9 7001-0004' },
    { id: 'p-a-005', name: 'Nei Borges Cavalcanti',     cpf: '300.001.005-05', birthDate: '1955-04-22', sexAtBirth: 'male',   conditions: ['hypertension', 'diabetes'], microArea: 'MA-1', address: 'Rua das Águas, 25',         phone: '(49) 9 7001-0005' },
    { id: 'p-a-006', name: 'Olga Santana de Freitas',   cpf: '300.001.006-06', birthDate: '1948-12-30', sexAtBirth: 'female', conditions: ['hypertension'],             microArea: 'MA-2', address: 'Av. Parque das Águas, 200', phone: '(49) 9 7001-0006' },
    { id: 'p-a-007', name: 'Daniela Fonseca Corrêa',    cpf: '300.001.007-07', birthDate: '1996-03-05', sexAtBirth: 'female', conditions: [],                           microArea: 'MA-2', address: 'Rua das Águas, 35',         phone: '(49) 9 7001-0007',
      extra: { careCategory: 'gestante', pregnancyStartDate: dateAgo(168), expectedDeliveryDate: dateAhead(112), gestationalAgeDumWeeks: 24, gestationalAgeDumDays: 0 } },
    { id: 'p-a-008', name: 'Nilton Araújo Campos',      cpf: '300.001.008-08', birthDate: '1972-08-11', sexAtBirth: 'male',   conditions: [],                           microArea: 'MA-1', address: 'Rua das Águas, 40',         phone: '(49) 9 7001-0008' },
    { id: 'p-a-009', name: 'Selma Rocha Lacerda',       cpf: '300.001.009-09', birthDate: '1979-05-27', sexAtBirth: 'female', conditions: [],                           microArea: 'MA-2', address: 'Av. Parque das Águas, 300', phone: '(49) 9 7001-0009' },
    { id: 'p-a-010', name: 'Plínio Moreira Coelho',     cpf: '300.001.010-10', birthDate: '1944-01-16', sexAtBirth: 'male',   conditions: ['hypertension'],             microArea: 'MA-1', address: 'Rua das Águas, 50',         phone: '(49) 9 7001-0010' },
  ].forEach(def => {
    patients.push(buildPatient({
      ...def,
      careCategory: def.extra?.careCategory || (def.conditions?.length ? 'cronico' : 'geral'),
      unitId: 'ubs-aguas', teamId: 'team-aguas-coral', acsId: coralAcs,
      extra: def.extra || {},
    }));
  });

  return patients;
}

// ── Appointments ──────────────────────────────────────────────────────────────
function makeAppointments(patients) {
  const appts = [];
  const today = new Date().toISOString().slice(0, 10);
  const doctors = {
    'ubs-horizonte': 'user-doc-horizonte-1',
    'ubs-esperanca': 'user-doc-esperanca-1',
    'ubs-aguas':     'user-doc-aguas-1',
  };

  // Sample of 15 appointments spread across units
  const samples = [
    { pid: 'p-h-001', time: `${today}T08:00:00.000Z`, status: 'scheduled', type: 'consulta', notes: 'Retorno PA' },
    { pid: 'p-h-002', time: `${today}T08:30:00.000Z`, status: 'scheduled', type: 'consulta', notes: 'Controle diabetes + HAS' },
    { pid: 'p-h-011', time: `${today}T09:00:00.000Z`, status: 'scheduled', type: 'prenatal', notes: 'Pré-natal 16 semanas' },
    { pid: 'p-h-012', time: `${today}T09:30:00.000Z`, status: 'scheduled', type: 'prenatal', notes: 'Pré-natal 28 semanas' },
    { pid: 'p-h-013', time: `${today}T10:00:00.000Z`, status: 'scheduled', type: 'consulta', notes: '' },
    { pid: 'p-h-015', time: `${today}T10:30:00.000Z`, status: 'scheduled', type: 'puerperal', notes: 'Consulta puerperal 8 dias' },
    { pid: 'p-h-101', time: `${today}T14:00:00.000Z`, status: 'scheduled', type: 'consulta', notes: 'HAS — controle mensal' },
    { pid: 'p-e-001', time: `${today}T08:00:00.000Z`, status: 'scheduled', type: 'consulta', notes: 'Controle pressão' },
    { pid: 'p-e-007', time: `${today}T09:00:00.000Z`, status: 'scheduled', type: 'prenatal', notes: 'Pré-natal 20 semanas' },
    { pid: 'p-a-001', time: `${today}T08:00:00.000Z`, status: 'scheduled', type: 'consulta', notes: 'Retorno HAS' },
    { pid: 'p-a-007', time: `${today}T09:00:00.000Z`, status: 'scheduled', type: 'prenatal', notes: 'Pré-natal 24 semanas' },
    // past attended
    { pid: 'p-h-007', time: new Date(Date.now() - 3*24*60*60*1000).toISOString(), status: 'attended', type: 'consulta', notes: 'Controle glicemia' },
    { pid: 'p-h-005', time: new Date(Date.now() - 7*24*60*60*1000).toISOString(), status: 'attended', type: 'consulta', notes: 'HAS — renovação receita' },
    { pid: 'p-e-002', time: new Date(Date.now() - 5*24*60*60*1000).toISOString(), status: 'attended', type: 'consulta', notes: '' },
    { pid: 'p-a-005', time: new Date(Date.now() - 2*24*60*60*1000).toISOString(), status: 'attended', type: 'consulta', notes: 'Diabetes + HAS' },
  ];

  for (const s of samples) {
    const pat = patients.find(p => p.id === s.pid);
    if (!pat) continue;
    appts.push({
      id: `appt-${s.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      patientId: s.pid,
      patientName: pat.name,
      doctorId: doctors[pat.unitId],
      unitId: pat.unitId,
      teamId: pat.teamId,
      municipalityId: MUNICIPALITY_ID,
      scheduledAt: s.time,
      duration: 20,
      type: s.type,
      status: s.status,
      notes: s.notes,
      createdAt: dAgo(3),
      createdBy: 'system-seed',
      updatedAt: NOW,
    });
  }

  return appts;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
function makeTasks(patients) {
  const tasks = [];
  const taskDefs = [
    { pid: 'p-h-001', title: 'Verificar PA em domicílio',        priority: 'high',   assignee: 'user-acs-horizonte-1', dueIn: 3 },
    { pid: 'p-h-002', title: 'Busca ativa — faltou consulta',    priority: 'high',   assignee: 'user-acs-horizonte-1', dueIn: 1 },
    { pid: 'p-h-011', title: 'Confirmar pré-natal marcado',      priority: 'medium', assignee: 'user-acs-horizonte-1', dueIn: 5 },
    { pid: 'p-h-015', title: 'Visita puerperal — 8 dias',        priority: 'urgent', assignee: 'user-acs-horizonte-1', dueIn: 0 },
    { pid: 'p-h-013', title: 'Verificar coleta de PCCU',         priority: 'medium', assignee: 'user-enf-horizonte-1', dueIn: 7 },
    { pid: 'p-h-107', title: 'Busca ativa — controle DM+HAS',    priority: 'high',   assignee: 'user-acs-horizonte-2', dueIn: 2 },
    { pid: 'p-e-001', title: 'Aferir PA semanal',                priority: 'medium', assignee: 'user-acs-esperanca-1', dueIn: 7 },
    { pid: 'p-e-007', title: 'Verificar exames pré-natal',       priority: 'high',   assignee: 'user-acs-esperanca-1', dueIn: 3 },
    { pid: 'p-a-010', title: 'Visita domiciliar — idoso solo',   priority: 'high',   assignee: 'user-acs-aguas-1',     dueIn: 2 },
    { pid: 'p-a-007', title: 'Acompanhar pré-natal 24 sem',      priority: 'medium', assignee: 'user-acs-aguas-1',     dueIn: 5 },
  ];

  for (const t of taskDefs) {
    const pat = patients.find(p => p.id === t.pid);
    if (!pat) continue;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + t.dueIn);
    tasks.push({
      id: `task-${t.pid}-${Math.random().toString(36).slice(2, 8)}`,
      patientId: t.pid,
      patientName: pat.name,
      title: t.title,
      priority: t.priority,
      status: 'pending',
      assignedToId: t.assignee,
      unitId: pat.unitId,
      teamId: pat.teamId,
      municipalityId: MUNICIPALITY_ID,
      dueDate: dueDate.toISOString().slice(0, 10),
      notes: '',
      createdAt: dAgo(1),
      createdBy: 'system-seed',
      updatedAt: NOW,
    });
  }

  return tasks;
}

// ── Shadow table sync ─────────────────────────────────────────────────────────
async function syncShadow(client, users, units, patients) {
  // app_units
  for (const u of units) {
    await client.query(`
      INSERT INTO app_units (id, name, cnes, municipality_id, payload, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5::jsonb,NOW(),NOW())
      ON CONFLICT (id) DO UPDATE
        SET name=$2, cnes=$3, municipality_id=$4, payload=$5::jsonb, updated_at=NOW()
    `, [u.id, u.name, u.cnes, u.municipalityId, JSON.stringify(u)]);
  }

  // app_users
  for (const u of users) {
    await client.query(`
      INSERT INTO app_users (id, email, role, team_id, unit_id, municipality_id, inactive, payload, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW(),NOW())
      ON CONFLICT (id) DO UPDATE
        SET email=$2, role=$3, team_id=$4, unit_id=$5, municipality_id=$6, inactive=$7, payload=$8::jsonb, updated_at=NOW()
    `, [u.id, u.email, u.role, u.teamId || '', u.unitId || '', u.municipalityId || '', u.inactive || false, JSON.stringify(u)]);
  }

  // app_patients
  for (const p of patients) {
    const birthDateStr = p.birthDate && p.birthDate.length === 10 ? p.birthDate : p.birthDate?.slice(0, 10);
    await client.query(`
      INSERT INTO app_patients (id, name, cpf_hash, unit_id, team_id, municipality_id, assigned_acs_id, inactive, care_category, payload, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,NOW(),NOW())
      ON CONFLICT (id) DO UPDATE
        SET name=$2, unit_id=$4, team_id=$5, municipality_id=$6, assigned_acs_id=$7, inactive=$8, care_category=$9, payload=$10::jsonb, updated_at=NOW()
    `, [
      p.id, p.name,
      p.cpf ? crypto.createHash('sha256').update(p.cpf).digest('hex') : '',
      p.unitId, p.teamId, p.municipalityId, p.assignedAcsId || '',
      p.inactive || false, p.careCategory || 'geral',
      JSON.stringify(p)
    ]);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log('=== VITRAS Demo Seed — Município de Santa Aurora ===');
  log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE'}`);

  const vitrasIds = new Set();

  // Collect existing vitrasIds from BG user
  const { rows: bgRows } = await pool.query("SELECT payload->>'vitrasId' AS vid FROM app_users WHERE role='break_glass_admin'");
  for (const r of bgRows) if (r.vid) vitrasIds.add(r.vid);

  const units = UNITS.map(u => ({
    ...u, municipalityId: MUNICIPALITY_ID, municipalityName: MUNICIPALITY_NAME, uf: UF,
    contactEmail: '', phone: '', status: 'active',
    createdBy: 'system-seed', createdAt: dAgo(30), updatedAt: NOW,
  }));

  const teams = TEAMS.map(t => ({
    ...t, municipalityId: MUNICIPALITY_ID, managerUserId: '', createdAt: dAgo(30), updatedAt: NOW,
  }));

  const users = makeUsers(vitrasIds);
  const patients = makePatients();
  const appointments = makeAppointments(patients);
  const tasks = makeTasks(patients);

  log(`Units:        ${units.length}`);
  log(`Teams:        ${teams.length}`);
  log(`Users:        ${users.length}`);
  log(`Patients:     ${patients.length}`);
  log(`Appointments: ${appointments.length}`);
  log(`Tasks:        ${tasks.length}`);

  if (DRY_RUN) {
    log('DRY RUN complete — no changes made.');
    process.exit(0);
  }

  // Read current app_state
  const { rows: stateRows } = await pool.query('SELECT data FROM app_state WHERE id = 1');
  if (!stateRows.length) {
    log('❌ app_state missing — run server once first.');
    process.exit(1);
  }

  const db = stateRows[0].data;

  // Initialize arrays
  for (const key of ['units','teams','users','patients','appointments','tasks']) {
    if (!Array.isArray(db[key])) db[key] = [];
  }

  // Upsert (skip existing by id)
  function upsert(arr, items) {
    for (const item of items) {
      const idx = arr.findIndex(x => x.id === item.id);
      if (idx >= 0) { log(`  SKIP existing ${item.id}`); }
      else arr.push(item);
    }
  }

  // Municipality — ensure Santa Aurora present
  if (!Array.isArray(db.municipalities)) db.municipalities = [];
  const mIdx = db.municipalities.findIndex(m => m.id === MUNICIPALITY_ID);
  const muniObj = { id: MUNICIPALITY_ID, ibge: MUNICIPALITY_ID, name: MUNICIPALITY_NAME, uf: UF, state: 'Santa Catarina', region: 'Sul' };
  if (mIdx < 0) db.municipalities.push(muniObj);

  upsert(db.units, units);
  upsert(db.teams, teams);
  upsert(db.users, users);
  upsert(db.patients, patients);
  upsert(db.appointments, appointments);
  upsert(db.tasks, tasks);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Ensure synthetic municipality exists (FK target)
    await client.query(`
      INSERT INTO municipalities (ibge_code, name, uf, region, is_capital, active, ibge_version, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (ibge_code) DO NOTHING
    `, [MUNICIPALITY_ID, MUNICIPALITY_NAME, UF, 'Sul', false, true, 'demo']);
    log('✓ Municipality ensured in municipalities table');
    await client.query('UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1', [JSON.stringify(db)]);
    log('✓ app_state.data updated');
    await syncShadow(client, users, units, patients);
    log('✓ Shadow tables synced (app_units, app_users, app_patients)');
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // Verify
  const counts = {};
  for (const t of ['app_units','app_users','app_patients','app_appointments']) {
    const r = await pool.query(`SELECT count(*) FROM ${t}`);
    counts[t] = parseInt(r.rows[0].count, 10);
  }

  log('\n=== POST-SEED VERIFICATION ===');
  log(`app_units:        ${counts.app_units}  (expected ≥ ${units.length})`);
  log(`app_users:        ${counts.app_users}  (expected ≥ ${users.length + 1})`); // +1 BG
  log(`app_patients:     ${counts.app_patients}  (expected ≥ ${patients.length})`);

  const ubsNames = units.map(u => `  ${u.id}: ${u.name}`).join('\n');
  log(`\nUBS seeded:\n${ubsNames}`);

  log('\n=== DEMO CREDENTIALS ===');
  log(`Password for ALL demo users: ${DEMO_PASSWORD}`);
  log('Accounts:');
  for (const u of users) log(`  ${u.role.padEnd(14)} ${u.email}`);

  log('\n✅ SEED COMPLETE — Ready for demo validation.');
}

main()
  .catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); })
  .finally(() => pool.end());
