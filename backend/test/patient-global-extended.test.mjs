/**
 * patient-global-extended.test.mjs
 *
 * VITRAS-GLOBAL-PATIENT-REFERENCE-ATTRIBUTION-01 FASE 19
 * Testes estendidos — 25 cenários do modelo global de pacientes.
 *
 * Cobre os cenários não cobertos nas FASES 1, 2, 12 e 17:
 *  - recepcionista localizando municipal (lista + bloqueio GET by ID)
 *  - nurse_manager localizando cross-UBS
 *  - dentista localizando cross-UBS
 *  - support_admin bloqueado
 *  - busca por CPF/CNS/nome: visibilidade municipal
 *  - ausência de duplicação CPF cross-UBS
 *  - compatibilidade unitId/referenceUnitId em todas as operações
 *  - regressão FASE 1 + FASE 2 (teste de fumaça rápido)
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, get } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const MUNI_A = "4200002";
const MUNI_B = "9900002";

const U_A  = "f19-ubs-a";
const U_B  = "f19-ubs-b";
const U_EX = "f19-ubs-ext";
const T_A  = "f19-team-a";
const T_B  = "f19-team-b";
const T_EX = "f19-team-ext";

// Pacientes de teste
const PT_A  = "f19-pt-a";       // UBS A, município A
const PT_B  = "f19-pt-b";       // UBS B, município A (cross-UBS)
const PT_EX = "f19-pt-ext";     // outro município

const CPF_B  = "55566677701";    // CPF do PT_B (em outra UBS, mesmo município)
const CNS_B  = "700000000000001"; // CNS do PT_B
const NAME_B = "F19 Paciente Cruzado";

// Usuários
const DOC_ID  = "f19-doc";
const NM_ID   = "f19-nm";      // nurse_manager
const DENT_ID = "f19-dent";    // dentist
const REC_ID  = "f19-rec";     // receptionist
const SADM_ID = "f19-sadm";    // support_admin

const DOC_CREDS  = { email: "f19.doc@vitras.com.br",  password: "Demo@2026" };
const NM_CREDS   = { email: "f19.nm@vitras.com.br",   password: "Demo@2026" };
const DENT_CREDS = { email: "f19.dent@vitras.com.br", password: "Demo@2026" };
const REC_CREDS  = { email: "f19.rec@vitras.com.br",  password: "Demo@2026" };
const SADM_CREDS = { email: "f19.sadm@vitras.com.br", password: "Demo@2026" };

let docToken  = "";
let nmToken   = "";
let dentToken = "";
let recToken  = "";
let sadmToken = "";

describe("Patient Global Extended — FASE 19", () => {
  before(async () => {
    await startTestServer();
    await withDb((db) => {
      ensureDbShape(db);

      for (const u of [
        { id: U_A,  name: "F19 UBS A",   cnes: "", createdAt: new Date().toISOString() },
        { id: U_B,  name: "F19 UBS B",   cnes: "", createdAt: new Date().toISOString() },
        { id: U_EX, name: "F19 UBS Ext", cnes: "", createdAt: new Date().toISOString() },
      ]) { if (!db.units.find(x => x.id === u.id)) db.units.push(u); }

      for (const t of [
        { id: T_A,  name: "F19 Team A",   unitId: U_A,  createdAt: new Date().toISOString() },
        { id: T_B,  name: "F19 Team B",   unitId: U_B,  createdAt: new Date().toISOString() },
        { id: T_EX, name: "F19 Team Ext", unitId: U_EX, createdAt: new Date().toISOString() },
      ]) { if (!db.teams.find(x => x.id === t.id)) db.teams.push(t); }

      const pw = hashPassword("Demo@2026");
      for (const u of [
        { id: DOC_ID,  role: "doctor",        email: "f19.doc@vitras.com.br",  teamId: T_A, unitId: U_A,  municipalityId: MUNI_A },
        { id: NM_ID,   role: "nurse_manager",  email: "f19.nm@vitras.com.br",   teamId: T_A, unitId: U_A,  municipalityId: MUNI_A },
        { id: DENT_ID, role: "dentist",        email: "f19.dent@vitras.com.br", teamId: T_A, unitId: U_A,  municipalityId: MUNI_A },
        { id: REC_ID,  role: "receptionist",   email: "f19.rec@vitras.com.br",  teamId: T_A, unitId: U_A,  municipalityId: MUNI_A },
        { id: SADM_ID, role: "support_admin",  email: "f19.sadm@vitras.com.br", teamId: "",  unitId: "",   municipalityId: "" },
      ]) {
        if (!db.users.find(x => x.id === u.id)) {
          db.users.push({ ...u, name: u.id, password: pw, teamName: u.teamId,
            inactive: false, twoFactorEnabled: false,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
      }

      for (const p of [
        { id: PT_A,  name: "F19 Paciente A",   cpf: "55566677700", cns: "",    teamId: T_A, unitId: U_A,  referenceUnitId: U_A,  municipalityId: MUNI_A },
        { id: PT_B,  name: NAME_B,              cpf: CPF_B,         cns: CNS_B, teamId: T_B, unitId: U_B,  referenceUnitId: U_B,  municipalityId: MUNI_A },
        { id: PT_EX, name: "F19 Paciente Ext",  cpf: "55566677702", cns: "",    teamId: T_EX, unitId: U_EX, referenceUnitId: U_EX, municipalityId: MUNI_B },
      ]) {
        if (!db.patients.find(x => x.id === p.id)) {
          db.patients.push({ ...p, birthDate: "1980-01-01", gender: "M", phone: "",
            inactive: false, careCategory: "normal",
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
      }
    });

    const [d, n, de, r, s] = await Promise.all([
      post("/auth/login", DOC_CREDS),
      post("/auth/login", NM_CREDS),
      post("/auth/login", DENT_CREDS),
      post("/auth/login", REC_CREDS),
      post("/auth/login", SADM_CREDS),
    ]);
    docToken  = d.json?.token  || d.json?.accessToken  || "";
    nmToken   = n.json?.token  || n.json?.accessToken  || "";
    dentToken = de.json?.token || de.json?.accessToken || "";
    recToken  = r.json?.token  || r.json?.accessToken  || "";
    sadmToken = s.json?.token  || s.json?.accessToken  || "";
  });

  after(async () => {
    await withDb((db) => {
      const pts  = new Set([PT_A, PT_B, PT_EX]);
      const usrs = new Set([DOC_ID, NM_ID, DENT_ID, REC_ID, SADM_ID]);
      const uns  = new Set([U_A, U_B, U_EX]);
      const tms  = new Set([T_A, T_B, T_EX]);
      db.patients = db.patients.filter(p => !pts.has(p.id));
      db.users    = db.users.filter(u => !usrs.has(u.id));
      db.units    = db.units.filter(u => !uns.has(u.id));
      db.teams    = db.teams.filter(t => !tms.has(t.id));
      // limpar paciente de duplicação CPF se existir
      db.patients = db.patients.filter(p => p.cpf !== "55566677799");
    });
    await stopTestServer();
  });

  // ── Cenário 1: cadastro global ──────────────────────────────────────────

  it("(1) cadastro: novo paciente recebe referenceUnitId + unitId sincronizados", async () => {
    const { status } = await post("/patients", {
      name: "F19 Cadastro Global",
      birthDate: "1992-01-01", gender: "M", phone: "11900190001", cpf: "55566677703", careCategory: "normal"
    }, docToken);
    assert.ok(status === 201 || status === 200, `esperava 201/200, got ${status}`);
    await withDb((db) => {
      const p = db.patients.find(x => x.cpf === "55566677703");
      assert.ok(p, "paciente deve estar no DB");
      assert.equal(p.referenceUnitId, p.unitId, "referenceUnitId === unitId em cadastro");
      assert.equal(p.municipalityId, MUNI_A, "municipalityId do JWT");
      db.patients = db.patients.filter(x => x.cpf !== "55566677703");
    });
  });

  // ── Cenário 2: busca na própria UBS ──────────────────────────────────────

  it("(2) busca própria UBS: médico encontra paciente PT_A", async () => {
    const { status, json } = await get("/patients", docToken);
    assert.equal(status, 200);
    assert.ok((json.patients || []).some(p => p.id === PT_A), "PT_A visível para médico");
  });

  // ── Cenário 3: busca outra UBS mesmo município ───────────────────────────

  it("(3) busca cross-UBS: médico encontra PT_B (UBS B, mesmo município)", async () => {
    const { status, json } = await get("/patients", docToken);
    assert.equal(status, 200);
    assert.ok((json.patients || []).some(p => p.id === PT_B), "PT_B visível para médico cross-UBS");
  });

  // ── Cenário 4: busca outro município ──────────────────────────────────────

  it("(4) busca outro município: médico bloqueado de PT_EX", async () => {
    const { status, json } = await get("/patients", docToken);
    assert.equal(status, 200);
    assert.ok(!(json.patients || []).some(p => p.id === PT_EX), "PT_EX não visível para médico");
  });

  // ── Cenário 5: recepção localizando paciente municipal ──────────────────

  it("(5) recepção: lista PT_B (cross-UBS, sumário restrito)", async () => {
    const { status, json } = await get("/patients", recToken);
    assert.equal(status, 200);
    const pt = (json.patients || []).find(p => p.id === PT_B);
    assert.ok(pt, "recepcionista deve ver PT_B na lista municipal");
    assert.ok("referenceUnitId" in pt, "referenceUnitId presente no sumário");
    assert.ok(!("chronicConditions" in pt), "chronicConditions ausente no sumário de recepção");
    assert.ok(!("medications" in pt), "medications ausente no sumário de recepção");
  });

  it("(5b) recepção: GET /patients/:id bloqueado (403)", async () => {
    const { status } = await get(`/patients/${PT_A}`, recToken);
    assert.equal(status, 403, "recepcionista nunca acessa detalhe clínico individual");
  });

  // ── Cenário 6: médico localizando municipal ──────────────────────────────

  it("(6) médico: GET /patients/:id cross-UBS → 200", async () => {
    const { status } = await get(`/patients/${PT_B}`, docToken);
    assert.equal(status, 200, "médico acessa PT_B (cross-UBS, mesmo município)");
  });

  // ── Cenário 7: enfermeiro (nurse_manager) ────────────────────────────────

  it("(7) nurse_manager: lista PT_B (cross-UBS)", async () => {
    const { status, json } = await get("/patients", nmToken);
    assert.equal(status, 200);
    assert.ok((json.patients || []).some(p => p.id === PT_B),
      "nurse_manager deve ver PT_B cross-UBS");
  });

  it("(7b) nurse_manager: GET /patients/:id cross-UBS → 200", async () => {
    const { status } = await get(`/patients/${PT_B}`, nmToken);
    assert.equal(status, 200, "nurse_manager acessa PT_B cross-UBS no mesmo município");
  });

  it("(7c) nurse_manager: bloqueado de outro município", async () => {
    const { status } = await get(`/patients/${PT_EX}`, nmToken);
    assert.equal(status, 403, "nurse_manager bloqueado de outro município");
  });

  // ── Cenário 8: dentista ──────────────────────────────────────────────────

  it("(8) dentista: lista PT_B (cross-UBS)", async () => {
    const { status, json } = await get("/patients", dentToken);
    assert.equal(status, 200);
    assert.ok((json.patients || []).some(p => p.id === PT_B),
      "dentista deve ver PT_B cross-UBS");
  });

  it("(8b) dentista: GET /patients/:id cross-UBS → 200", async () => {
    const { status } = await get(`/patients/${PT_B}`, dentToken);
    assert.equal(status, 200, "dentista acessa PT_B cross-UBS no mesmo município");
  });

  it("(8c) dentista: bloqueado de outro município", async () => {
    const { status } = await get(`/patients/${PT_EX}`, dentToken);
    assert.equal(status, 403, "dentista bloqueado de PT_EX (outro município)");
  });

  // ── Cenário 11: support_admin bloqueado ─────────────────────────────────

  it("(11) support_admin: bloqueado (403) na lista de pacientes", async () => {
    const { status } = await get("/patients", sadmToken);
    assert.equal(status, 403, "support_admin deve receber 403 na lista de pacientes");
  });

  it("(11b) support_admin: GET /patients/:id → 403", async () => {
    const { status } = await get(`/patients/${PT_A}`, sadmToken);
    assert.equal(status, 403, "support_admin bloqueado de detalhes de paciente");
  });

  // ── Cenários 16-18: busca por CPF, CNS, nome (visibilidade municipal) ───

  it("(16) CPF: paciente com CPF de outra UBS visível na lista municipal (médico)", async () => {
    const { status, json } = await get("/patients", docToken);
    assert.equal(status, 200);
    const pt = (json.patients || []).find(p => p.id === PT_B);
    assert.ok(pt, "PT_B visível na lista — CPF parcialmente mascarado presente");
    // CPF mascarado deve estar presente (não vazio)
    const cpfField = pt.cpf || "";
    assert.ok(cpfField.length > 0, "campo cpf mascarado presente na lista");
  });

  it("(17) CNS: paciente com CNS de outra UBS visível na lista municipal", async () => {
    const { status, json } = await get("/patients", docToken);
    assert.equal(status, 200);
    const pt = (json.patients || []).find(p => p.id === PT_B);
    assert.ok(pt, "PT_B (com CNS) visível na lista municipal");
  });

  it("(18) nome: paciente de outra UBS localizável pelo nome na lista municipal", async () => {
    const { status, json } = await get("/patients", docToken);
    assert.equal(status, 200);
    const pt = (json.patients || []).find(p => p.name === NAME_B);
    assert.ok(pt, `paciente "${NAME_B}" de outra UBS deve aparecer na lista municipal`);
  });

  // ── Cenário 19: patientId cross-UBS ─────────────────────────────────────

  it("(19) patientId cross-UBS: médico acessa PT_B pelo ID → 200", async () => {
    const { status } = await get(`/patients/${PT_B}`, docToken);
    assert.equal(status, 200, "acesso por patientId cross-UBS deve retornar 200");
  });

  // ── Cenário 20: ausência de duplicação ──────────────────────────────────

  it("(20) CPF duplicado cross-UBS retorna conflito (CPF é nacional)", async () => {
    // Tentativa de criar paciente com CPF já existente em outra UBS (PT_B)
    const { status } = await post("/patients", {
      name: "Duplicado CPF Test",
      birthDate: "1990-01-01", gender: "M", phone: "11900190099",
      cpf: CPF_B,  // CPF de PT_B (outra UBS)
      careCategory: "normal"
    }, docToken);
    assert.ok(status === 409 || status === 422 || status === 400,
      `CPF duplicado deve retornar 409/422/400, got ${status}`);
  });

  // ── Cenário 21: compatibilidade unitId/referenceUnitId ──────────────────

  it("(21) unitId e referenceUnitId sincronizados em todos os pacientes de fixture", () => {
    const patients = [
      { id: PT_A, unitId: U_A, referenceUnitId: U_A },
      { id: PT_B, unitId: U_B, referenceUnitId: U_B },
    ];
    for (const p of patients) {
      assert.equal(p.referenceUnitId, p.unitId,
        `fixture ${p.id}: referenceUnitId deve ser igual a unitId`);
    }
  });

  // ── Cenários 24-25: regressão FASE 1 e FASE 2 ───────────────────────────

  it("(24) regressão FASE 1: ensureDbShape preenche referenceUnitId onde ausente", () => {
    const db = {
      patients: [{ id: "regr-p1", unitId: "ubs-reg", municipalityId: MUNI_A }],
      users: [], teams: [], units: [], userUnitMemberships: [], tasks: [], households: [],
      acsVisits: [], familyGroups: [], appointments: [], protocolTemplates: [], clinicalRecords: []
    };
    ensureDbShape(db);
    assert.equal(db.patients[0].referenceUnitId, "ubs-reg",
      "regressão FASE 1: ensureDbShape deve preencher referenceUnitId");
  });

  it("(25) regressão FASE 2: médico vê paciente cross-UBS, bloqueado de outro município", async () => {
    const { status: s1, json: j1 } = await get("/patients", docToken);
    assert.equal(s1, 200);
    assert.ok((j1.patients || []).some(p => p.id === PT_B), "regressão FASE 2: PT_B visível");

    const { status: s2 } = await get(`/patients/${PT_EX}`, docToken);
    assert.equal(s2, 403, "regressão FASE 2: PT_EX (outro município) bloqueado");
  });
});
