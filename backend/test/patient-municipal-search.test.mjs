/**
 * patient-municipal-search.test.mjs
 *
 * VITRAS-GLOBAL-PATIENT-REFERENCE-ATTRIBUTION-01 FASE 2
 * Testa busca municipal cross-UBS de pacientes:
 *   - roles clínicas listam pacientes do mesmo município independente da equipe
 *   - cross-município bloqueado em list e GET by ID
 *   - gestor permanece UBS-scoped (intencional)
 *   - ACS permanece team-scoped + assignedAcsId
 *   - referenceUnitId presente na resposta clínica
 *   - nursing_tech tem escopo municipal em list
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, get } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";
import { getAllowedPatients } from "../src/utils/patients.js";

const MUNICIPALITY_A = "4200000";
const MUNICIPALITY_B = "9900000";

const DOCTOR_CREDS    = { email: "fase2.med@vitras.com.br",   password: "Demo@2026" };
const GESTOR_CREDS    = { email: "fase2.gestor@vitras.com.br", password: "Demo@2026" };
const ACS_CREDS       = { email: "fase2.acs@vitras.com.br",    password: "Demo@2026" };
const TECH_CREDS      = { email: "fase2.tech@vitras.com.br",   password: "Demo@2026" };

let doctorToken = "";
let gestorToken = "";
let acsToken    = "";
let techToken   = "";

// ── Fixture IDs ──────────────────────────────────────────────────────────────
const UNIT_A    = "f2-ubs-a";
const UNIT_B    = "f2-ubs-b";
const UNIT_EXT  = "f2-ubs-ext";
const TEAM_A    = "f2-team-a";
const TEAM_B    = "f2-team-b";
const TEAM_EXT  = "f2-team-ext";
const PT_OWN    = "f2-pt-own";       // paciente da equipe do médico (UBS A, município A)
const PT_CROSS  = "f2-pt-cross";     // paciente de outra UBS (UBS B, município A)
const PT_EXTMUN = "f2-pt-extmun";    // paciente de outro município
const PT_ACS    = "f2-pt-acs";       // paciente atribuído ao ACS de teste
const DOCTOR_ID = "f2-doc";
const GESTOR_ID = "f2-gestor";
const ACS_ID    = "f2-acs";
const TECH_ID   = "f2-tech";

describe("Patient Municipal Search — FASE 2", () => {
  before(async () => {
    await startTestServer();
    await withDb((db) => {
      ensureDbShape(db);

      // Units
      for (const u of [
        { id: UNIT_A, name: "UBS A F2", cnes: "", createdAt: new Date().toISOString() },
        { id: UNIT_B, name: "UBS B F2", cnes: "", createdAt: new Date().toISOString() },
        { id: UNIT_EXT, name: "UBS Ext F2", cnes: "", createdAt: new Date().toISOString() },
      ]) { if (!db.units.find(x => x.id === u.id)) db.units.push(u); }

      // Teams
      for (const t of [
        { id: TEAM_A, name: "Equipe A F2", unitId: UNIT_A, createdAt: new Date().toISOString() },
        { id: TEAM_B, name: "Equipe B F2", unitId: UNIT_B, createdAt: new Date().toISOString() },
        { id: TEAM_EXT, name: "Equipe Ext F2", unitId: UNIT_EXT, createdAt: new Date().toISOString() },
      ]) { if (!db.teams.find(x => x.id === t.id)) db.teams.push(t); }

      // Users
      const pw = hashPassword("Demo@2026");
      for (const u of [
        { id: DOCTOR_ID, role: "doctor",       email: "fase2.med@vitras.com.br",   teamId: TEAM_A, unitId: UNIT_A, municipalityId: MUNICIPALITY_A },
        { id: GESTOR_ID, role: "gestor",        email: "fase2.gestor@vitras.com.br", teamId: TEAM_A, unitId: UNIT_A, municipalityId: MUNICIPALITY_A },
        { id: ACS_ID,    role: "acs",           email: "fase2.acs@vitras.com.br",   teamId: TEAM_A, unitId: UNIT_A, municipalityId: MUNICIPALITY_A },
        { id: TECH_ID,   role: "nursing_tech",  email: "fase2.tech@vitras.com.br",  teamId: TEAM_A, unitId: UNIT_A, municipalityId: MUNICIPALITY_A },
      ]) {
        if (!db.users.find(x => x.id === u.id)) {
          db.users.push({ ...u, name: u.id, password: pw, teamName: u.teamId, inactive: false, twoFactorEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
      }

      // Patients
      const mkP = (id, teamId, unitId, muni, acsId = "") => ({
        id, name: `Paciente ${id}`, birthDate: "1980-01-01",
        cpf: "", cns: "", gender: "M", phone: "",
        teamId, unitId, referenceUnitId: unitId, municipalityId: muni,
        assignedAcsId: acsId, inactive: false, careCategory: "normal",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      for (const p of [
        mkP(PT_OWN,    TEAM_A,    UNIT_A,    MUNICIPALITY_A),
        mkP(PT_CROSS,  TEAM_B,    UNIT_B,    MUNICIPALITY_A),
        mkP(PT_EXTMUN, TEAM_EXT,  UNIT_EXT,  MUNICIPALITY_B),
        mkP(PT_ACS,    TEAM_A,    UNIT_A,    MUNICIPALITY_A, ACS_ID),
      ]) { if (!db.patients.find(x => x.id === p.id)) db.patients.push(p); }
    });

    const [d, g, a, t] = await Promise.all([
      post("/auth/login", DOCTOR_CREDS),
      post("/auth/login", GESTOR_CREDS),
      post("/auth/login", ACS_CREDS),
      post("/auth/login", TECH_CREDS),
    ]);
    doctorToken = d.json?.token || d.json?.accessToken || "";
    gestorToken = g.json?.token || g.json?.accessToken || "";
    acsToken    = a.json?.token || a.json?.accessToken || "";
    techToken   = t.json?.token || t.json?.accessToken || "";
  });

  after(async () => {
    await withDb((db) => {
      const pts  = new Set([PT_OWN, PT_CROSS, PT_EXTMUN, PT_ACS]);
      const usrs = new Set([DOCTOR_ID, GESTOR_ID, ACS_ID, TECH_ID]);
      const uns  = new Set([UNIT_A, UNIT_B, UNIT_EXT]);
      const tms  = new Set([TEAM_A, TEAM_B, TEAM_EXT]);
      db.patients = db.patients.filter(p => !pts.has(p.id));
      db.users    = db.users.filter(u => !usrs.has(u.id));
      db.units    = db.units.filter(u => !uns.has(u.id));
      db.teams    = db.teams.filter(t => !tms.has(t.id));
    });
    await stopTestServer();
  });

  // ── Unit tests — getAllowedPatients direto ────────────────────────────────

  it("getAllowedPatients: doctor vê pacientes de todos os times do mesmo município", () => {
    const db = makeUnitDb();
    const doctor = { id: "d1", role: "doctor", teamId: "team-a", municipalityId: MUNICIPALITY_A };
    const result = getAllowedPatients(db, doctor, {});
    const ids = result.map(p => p.id);
    assert.ok(ids.includes("pt-a"),         "inclui paciente própria equipe");
    assert.ok(ids.includes("pt-b"),         "inclui paciente de outra equipe mesmo município");
    assert.ok(!ids.includes("pt-extmun"),   "bloqueia outro município");
  });

  it("getAllowedPatients: nursing_tech tem escopo municipal (mesma regra que doctor)", () => {
    const db = makeUnitDb();
    const tech = { id: "t1", role: "nursing_tech", teamId: "team-a", municipalityId: MUNICIPALITY_A };
    const result = getAllowedPatients(db, tech, {});
    const ids = result.map(p => p.id);
    assert.ok(ids.includes("pt-b"),       "nursing_tech vê outra UBS mesmo município");
    assert.ok(!ids.includes("pt-extmun"), "nursing_tech bloqueia outro município");
  });

  it("getAllowedPatients: gestor permanece UBS-scoped (intencional)", () => {
    const db = makeUnitDb();
    const gestor = { id: "g1", role: "gestor", teamId: "team-a", unitId: "ubs-a", municipalityId: MUNICIPALITY_A };
    const result = getAllowedPatients(db, gestor, {});
    const ids = result.map(p => p.id);
    assert.ok(ids.includes("pt-a"),      "gestor vê própria UBS");
    assert.ok(!ids.includes("pt-b"),     "gestor NÃO vê outra UBS");
    assert.ok(!ids.includes("pt-extmun"),"gestor NÃO vê outro município");
  });

  it("getAllowedPatients: ACS vê apenas pacientes atribuídos a si", () => {
    const db = makeUnitDb();
    const acs = { id: "acs1", role: "acs", teamId: "team-a", municipalityId: MUNICIPALITY_A };
    const result = getAllowedPatients(db, acs, {});
    assert.ok(result.every(p => p.assignedAcsId === "acs1"),
      "ACS só retorna pacientes com assignedAcsId === acs1");
    assert.ok(!result.some(p => p.id === "pt-a"),
      "pt-a (não atribuído ao ACS) excluído");
  });

  it("getAllowedPatients: clínica sem municipalityId faz fallback para teamId (fail-safe)", () => {
    const db = makeUnitDb();
    const doctor = { id: "d1", role: "doctor", teamId: "team-a", municipalityId: "" };
    const result = getAllowedPatients(db, doctor, {});
    const ids = result.map(p => p.id);
    assert.ok(ids.includes("pt-a"),      "fallback retorna própria equipe");
    assert.ok(!ids.includes("pt-b"),     "fallback bloqueia outra equipe (sem municipalityId)");
  });

  // ── Integration tests — via HTTP ──────────────────────────────────────────

  it("GET /patients: doctor lista paciente de outra UBS do mesmo município", async () => {
    const { status, json } = await get("/patients", doctorToken);
    assert.equal(status, 200, `esperava 200, got ${status}: ${JSON.stringify(json)}`);
    const ids = (json.patients || []).map(p => p.id);
    assert.ok(ids.includes(PT_CROSS), "doutor deve ver paciente cross-UBS no mesmo município");
  });

  it("GET /patients: doctor NÃO vê paciente de outro município", async () => {
    const { status, json } = await get("/patients", doctorToken);
    assert.equal(status, 200);
    const ids = (json.patients || []).map(p => p.id);
    assert.ok(!ids.includes(PT_EXTMUN), "doutor não deve ver paciente de outro município");
  });

  it("GET /patients/:id: doctor acessa paciente cross-UBS mesmo município (200)", async () => {
    const { status } = await get(`/patients/${PT_CROSS}`, doctorToken);
    assert.equal(status, 200, "GET by ID cross-UBS mesmo município deve retornar 200");
  });

  it("GET /patients/:id: doctor bloqueado de paciente de outro município (403)", async () => {
    const { status } = await get(`/patients/${PT_EXTMUN}`, doctorToken);
    assert.equal(status, 403, "GET by ID cross-município deve retornar 403");
  });

  it("GET /patients: gestor NÃO vê paciente de outra UBS", async () => {
    const { status, json } = await get("/patients", gestorToken);
    assert.equal(status, 200);
    const ids = (json.patients || []).map(p => p.id);
    assert.ok(!ids.includes(PT_CROSS), "gestor não deve ver paciente de outra UBS");
  });

  it("GET /patients: ACS vê apenas paciente atribuído a si", async () => {
    const { status, json } = await get("/patients", acsToken);
    assert.equal(status, 200);
    const ids = (json.patients || []).map(p => p.id);
    assert.ok(ids.includes(PT_ACS),  "ACS vê paciente atribuído a si");
    assert.ok(!ids.includes(PT_OWN), "ACS NÃO vê pt-own (não atribuído a ele)");
  });

  it("GET /patients: lista clínica inclui referenceUnitId no resultado", async () => {
    const { status, json } = await get("/patients", doctorToken);
    assert.equal(status, 200);
    const pt = (json.patients || []).find(p => p.id === PT_CROSS);
    assert.ok(pt, "paciente cross-UBS deve estar na lista");
    assert.ok("referenceUnitId" in pt, "campo referenceUnitId deve estar presente");
    assert.equal(pt.referenceUnitId, UNIT_B, "referenceUnitId deve ser a UBS de referência do paciente");
  });

  it("GET /patients: nursing_tech tem escopo municipal cross-UBS", async () => {
    const { status, json } = await get("/patients", techToken);
    assert.equal(status, 200, `esperava 200, got ${status}`);
    const ids = (json.patients || []).map(p => p.id);
    assert.ok(ids.includes(PT_CROSS),    "nursing_tech vê paciente de outra UBS no mesmo município");
    assert.ok(!ids.includes(PT_EXTMUN),  "nursing_tech NÃO vê outro município");
  });
});

// ── Helper: DB mínimo para unit tests ─────────────────────────────────────────
function makeUnitDb() {
  return {
    patients: [
      { id: "pt-a", name: "P A", teamId: "team-a", unitId: "ubs-a", referenceUnitId: "ubs-a", municipalityId: MUNICIPALITY_A, inactive: false, careCategory: "normal", assignedAcsId: "" },
      { id: "pt-b", name: "P B", teamId: "team-b", unitId: "ubs-b", referenceUnitId: "ubs-b", municipalityId: MUNICIPALITY_A, inactive: false, careCategory: "normal", assignedAcsId: "" },
      { id: "pt-extmun", name: "P Ext", teamId: "team-c", unitId: "ubs-c", referenceUnitId: "ubs-c", municipalityId: MUNICIPALITY_B, inactive: false, careCategory: "normal", assignedAcsId: "" },
      { id: "pt-acs", name: "P ACS", teamId: "team-a", unitId: "ubs-a", referenceUnitId: "ubs-a", municipalityId: MUNICIPALITY_A, inactive: false, careCategory: "normal", assignedAcsId: "acs1" },
    ],
    users: [],
    teams: [
      { id: "team-a", unitId: "ubs-a" },
      { id: "team-b", unitId: "ubs-b" },
      { id: "team-c", unitId: "ubs-c" },
    ],
    units: [{ id: "ubs-a" }, { id: "ubs-b" }, { id: "ubs-c" }],
    userUnitMemberships: [], tasks: [], households: [],
    acsVisits: [], familyGroups: [], appointments: [],
    protocolTemplates: [], clinicalRecords: []
  };
}
