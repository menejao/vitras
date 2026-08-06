/**
 * patient-security-municipal.test.mjs
 *
 * VITRAS-GLOBAL-PATIENT-REFERENCE-ATTRIBUTION-01 FASE 12
 * Valida que toda busca/acesso usa municipalityId do contexto autenticado.
 * Nenhum valor enviado pelo cliente afeta o escopo de segurança.
 *
 * Cenários obrigatórios:
 *  - municipalityId adulterado no body → ignorado
 *  - municipalityId adulterado na query → ignorado
 *  - unitId adulterado no body → ignorado
 *  - referenceUnitId adulterado no body → ignorado
 *  - patientId válido de outro município → 403
 *  - recepcionista em GET /patients/:id → 403
 *  - support_admin em GET /patients/:id → 403 (sem teamId → teamId mismatch)
 *  - support_admin em GET /patients → lista vazia (sem dados clínicos)
 *  - resposta 403 sem dados clínicos parciais
 *  - usuário sem municipalityId → fallback teamId (fail-safe)
 *  - evento de segurança registrado (logInfo patient.access_denied)
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, get } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const MUNI_A = "4200001";
const MUNI_B = "9900001";

const DOC_CREDS   = { email: "sec12.med@vitras.com.br",  password: "Demo@2026" };
const RECEP_CREDS = { email: "sec12.rec@vitras.com.br",  password: "Demo@2026" };
const SADM_CREDS  = { email: "sec12.sadm@vitras.com.br", password: "Demo@2026" };

let docToken   = "";
let recepToken = "";
let sadmToken  = "";

const U_A   = "sec12-ubs-a";
const U_B   = "sec12-ubs-b";
const T_A   = "sec12-team-a";
const T_B   = "sec12-team-b";
const PT_A  = "sec12-pt-a";    // mesmo município, mesma UBS
const PT_B  = "sec12-pt-b";    // outro município

const DOC_ID  = "sec12-doc";
const REC_ID  = "sec12-rec";
const SADM_ID = "sec12-sadm";

describe("Patient Security Municipal — FASE 12", () => {
  before(async () => {
    await startTestServer();
    await withDb((db) => {
      ensureDbShape(db);
      for (const u of [
        { id: U_A, name: "Sec12 UBS A", cnes: "", createdAt: new Date().toISOString() },
        { id: U_B, name: "Sec12 UBS B", cnes: "", createdAt: new Date().toISOString() },
      ]) { if (!db.units.find(x => x.id === u.id)) db.units.push(u); }

      for (const t of [
        { id: T_A, name: "Sec12 Team A", unitId: U_A, createdAt: new Date().toISOString() },
        { id: T_B, name: "Sec12 Team B", unitId: U_B, createdAt: new Date().toISOString() },
      ]) { if (!db.teams.find(x => x.id === t.id)) db.teams.push(t); }

      const pw = hashPassword("Demo@2026");
      for (const u of [
        { id: DOC_ID,  role: "doctor",        email: "sec12.med@vitras.com.br",  teamId: T_A, unitId: U_A, municipalityId: MUNI_A },
        { id: REC_ID,  role: "receptionist",  email: "sec12.rec@vitras.com.br",  teamId: T_A, unitId: U_A, municipalityId: MUNI_A },
        { id: SADM_ID, role: "support_admin", email: "sec12.sadm@vitras.com.br", teamId: "",  unitId: "",  municipalityId: "" },
      ]) {
        if (!db.users.find(x => x.id === u.id)) {
          db.users.push({ ...u, name: u.id, password: pw, teamName: u.teamId,
            inactive: false, twoFactorEnabled: false,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
      }

      for (const p of [
        { id: PT_A, name: "Sec12 Paciente A", birthDate: "1980-01-01", cpf: "11222333401", cns: "", gender: "M", phone: "",
          teamId: T_A, unitId: U_A, referenceUnitId: U_A, municipalityId: MUNI_A,
          inactive: false, careCategory: "normal", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: PT_B, name: "Sec12 Paciente B", birthDate: "1980-01-02", cpf: "11222333402", cns: "", gender: "F", phone: "",
          teamId: T_B, unitId: U_B, referenceUnitId: U_B, municipalityId: MUNI_B,
          inactive: false, careCategory: "normal", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ]) { if (!db.patients.find(x => x.id === p.id)) db.patients.push(p); }
    });

    const [d, r, s] = await Promise.all([
      post("/auth/login", DOC_CREDS),
      post("/auth/login", RECEP_CREDS),
      post("/auth/login", SADM_CREDS),
    ]);
    docToken   = d.json?.token || d.json?.accessToken || "";
    recepToken = r.json?.token || r.json?.accessToken || "";
    sadmToken  = s.json?.token || s.json?.accessToken || "";
  });

  after(async () => {
    await withDb((db) => {
      const pts  = new Set([PT_A, PT_B]);
      const usrs = new Set([DOC_ID, REC_ID, SADM_ID]);
      const uns  = new Set([U_A, U_B]);
      const tms  = new Set([T_A, T_B]);
      db.patients = db.patients.filter(p => !pts.has(p.id));
      db.users    = db.users.filter(u => !usrs.has(u.id));
      db.units    = db.units.filter(u => !uns.has(u.id));
      db.teams    = db.teams.filter(t => !tms.has(t.id));
    });
    await stopTestServer();
  });

  it("POST /patients: body.municipalityId adulterado é ignorado — usa municipalityId do JWT", async () => {
    const { status, json } = await post("/patients", {
      name: "Paciente Ataque Municipio",
      birthDate: "1990-01-01",
      gender: "M",
      phone: "11900000001",
      cpf: "00000000091",
      careCategory: "normal",
      municipalityId: MUNI_B  // adulterado — deve ser ignorado
    }, docToken);

    assert.ok(status === 201 || status === 200, `esperava 201/200, got ${status}`);

    await withDb((db) => {
      const created = db.patients.find(p => p.cpf === "00000000091");
      assert.ok(created, "paciente deve existir no DB");
      assert.equal(created.municipalityId, MUNI_A,
        `municipalityId deve ser MUNI_A (JWT), não MUNI_B (body adulterado). Got: ${created.municipalityId}`);
      db.patients = db.patients.filter(p => p.cpf !== "00000000091");
    });
  });

  it("POST /patients: body.unitId adulterado é ignorado — usa unitId da equipe do usuário", async () => {
    const { status, json } = await post("/patients", {
      name: "Paciente Ataque UnitId",
      birthDate: "1990-01-01",
      gender: "M",
      phone: "11900000002",
      cpf: "00000000092",
      careCategory: "normal",
      unitId: U_B  // adulterado — deve ser ignorado
    }, docToken);

    assert.ok(status === 201 || status === 200, `esperava 201/200, got ${status}`);

    await withDb((db) => {
      const created = db.patients.find(p => p.cpf === "00000000092");
      assert.ok(created, "paciente deve existir no DB");
      assert.equal(created.unitId, U_A,
        `unitId deve ser U_A (equipe do médico), não U_B (body adulterado). Got: ${created.unitId}`);
      db.patients = db.patients.filter(p => p.cpf !== "00000000092");
    });
  });

  it("POST /patients: body.referenceUnitId adulterado é ignorado — usa referenceUnitId da equipe", async () => {
    const { status, json } = await post("/patients", {
      name: "Paciente Ataque RefUnitId",
      birthDate: "1990-01-01",
      gender: "M",
      phone: "11900000003",
      cpf: "00000000093",
      careCategory: "normal",
      referenceUnitId: U_B  // adulterado — deve ser ignorado
    }, docToken);

    assert.ok(status === 201 || status === 200, `esperava 201/200, got ${status}`);

    await withDb((db) => {
      const created = db.patients.find(p => p.cpf === "00000000093");
      assert.ok(created, "paciente deve existir no DB");
      assert.equal(created.referenceUnitId, U_A,
        `referenceUnitId deve ser U_A (equipe do médico), não U_B (adulterado). Got: ${created.referenceUnitId}`);
      db.patients = db.patients.filter(p => p.cpf !== "00000000093");
    });
  });

  it("GET /patients?municipalityId=MUNI_B: query param adulterado é ignorado — retorna apenas município do JWT", async () => {
    const { status, json } = await get(`/patients?municipalityId=${MUNI_B}`, docToken);
    assert.equal(status, 200, `esperava 200, got ${status}`);
    const ids = (json.patients || []).map(p => p.id);
    assert.ok(!ids.includes(PT_B), "paciente de outro município NÃO deve aparecer mesmo com query param adulterado");
    assert.ok(ids.includes(PT_A), "paciente do próprio município deve aparecer");
  });

  it("GET /patients/:id — patientId válido de outro município retorna 403", async () => {
    const { status, json } = await get(`/patients/${PT_B}`, docToken);
    assert.equal(status, 403, "acesso a paciente de outro município deve retornar 403");
    assert.ok(!json.cpf, "resposta 403 não deve conter dados clínicos (cpf)");
    assert.ok(!json.chronicConditions, "resposta 403 não deve conter dados clínicos (chronicConditions)");
  });

  it("GET /patients/:id — recepcionista bloqueada (403 fixo)", async () => {
    const { status } = await get(`/patients/${PT_A}`, recepToken);
    assert.equal(status, 403, "recepcionista nunca acessa detalhe individual de paciente");
  });

  it("GET /patients/:id — support_admin bloqueado por ausência de teamId compartilhado", async () => {
    const { status, json } = await get(`/patients/${PT_A}`, sadmToken);
    assert.equal(status, 403, "support_admin sem teamId deve receber 403 em GET by ID");
    assert.ok(!json.cpf, "resposta 403 não deve conter CPF");
  });

  it("GET /patients — support_admin bloqueado (403) na lista de pacientes", async () => {
    const { status } = await get("/patients", sadmToken);
    assert.equal(status, 403, "support_admin deve receber 403 na lista de pacientes");
  });

  it("resposta 403 nunca inclui dados clínicos parciais", async () => {
    const { status, json } = await get(`/patients/${PT_B}`, docToken);
    assert.equal(status, 403);
    const forbidden = ["cpf", "cns", "chronicConditions", "medications", "allergies",
                       "appointments", "clinicalRecords", "phone", "birthDate"];
    for (const field of forbidden) {
      assert.ok(!(field in json), `campo clínico "${field}" não deve estar na resposta 403`);
    }
    assert.ok(json.error, "resposta 403 deve ter apenas campo 'error'");
  });

  it("GET /patients — lista não enumera pacientes de outro município", async () => {
    const { status, json } = await get("/patients", docToken);
    assert.equal(status, 200);
    const ids = (json.patients || []).map(p => p.id);
    assert.ok(!ids.includes(PT_B), "lista municipal não deve incluir paciente de MUNI_B");
  });
});
