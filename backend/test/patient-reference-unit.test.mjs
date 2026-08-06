/**
 * patient-reference-unit.test.mjs
 *
 * VITRAS-GLOBAL-PATIENT-REFERENCE-ATTRIBUTION-01 FASE 1
 * Testa o modelo de referenceUnitId no paciente:
 *   - ensureDbShape auto-preenche referenceUnitId onde ausente (unit test)
 *   - ensureDbShape NÃO sobrescreve referenceUnitId já preenchido
 *   - ensureDbShape emite warn em divergência (não corrompe dados)
 *   - novo paciente via POST recebe referenceUnitId == unitId
 *   - unitId permanece presente (backward compat cds-export)
 *   - buildReceptionistPatientSummary expõe referenceUnitId
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, get } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";
import { buildReceptionistPatientSummary } from "../src/utils/patients.js";

const NURSE_CREDS = { email: "patricia.enf@vitras.com.br", password: "Demo@2026" };
let nurseToken = "";

describe("Patient referenceUnitId — FASE 1", () => {
  before(async () => {
    await startTestServer();
    // Inject nurse user with known team/unit
    await withDb((db) => {
      ensureDbShape(db);
      if (!db.units.find(u => u.id === "unit-default")) {
        db.units.push({ id: "unit-default", name: "Unidade Padrão", cnes: "", createdAt: new Date().toISOString() });
      }
      if (!db.teams.find(t => t.id === "team-rosa")) {
        db.teams.push({ id: "team-rosa", name: "Equipe Rosa", managerUserId: "seed-user-enf", unitId: "unit-default", createdAt: new Date().toISOString() });
      }
      if (!db.users.find(u => u.id === "seed-user-enf")) {
        db.users.push({
          id: "seed-user-enf", name: "Enf. Patrícia Lima", role: "nurse_manager",
          email: "patricia.enf@vitras.com.br", password: hashPassword("Demo@2026"),
          teamId: "team-rosa", teamName: "Equipe Rosa", unitId: "unit-default",
          councilType: "COREN", councilNumber: "12345", councilUf: "SP",
          inactive: false, twoFactorEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
      }
    });
    const { json } = await post("/auth/login", NURSE_CREDS);
    nurseToken = json.token || json.accessToken || "";
  });
  after(stopTestServer);

  // ── Unit tests de domain.js ──────────────────────────────────────────────────

  it("ensureDbShape: preenche referenceUnitId onde ausente (auto-heal)", () => {
    const db = {
      patients: [
        { id: "p1", unitId: "ubs-a", municipalityId: "4299999" },
        { id: "p2", unitId: "ubs-b", municipalityId: "4299999", referenceUnitId: "ubs-b" }
      ],
      users: [], teams: [], units: [], userUnitMemberships: [], tasks: [], households: [],
      acsVisits: [], familyGroups: [], appointments: [], protocolTemplates: [], clinicalRecords: []
    };
    ensureDbShape(db);
    assert.equal(db.patients[0].referenceUnitId, "ubs-a",
      "paciente sem referenceUnitId deve receber unitId como referenceUnitId");
    assert.equal(db.patients[1].referenceUnitId, "ubs-b",
      "paciente já com referenceUnitId correto não deve ser alterado");
  });

  it("ensureDbShape: NÃO sobrescreve referenceUnitId já preenchido e igual a unitId", () => {
    const db = {
      patients: [{ id: "p3", unitId: "ubs-c", referenceUnitId: "ubs-c", municipalityId: "4299999" }],
      users: [], teams: [], units: [], userUnitMemberships: [], tasks: [], households: [],
      acsVisits: [], familyGroups: [], appointments: [], protocolTemplates: [], clinicalRecords: []
    };
    ensureDbShape(db);
    assert.equal(db.patients[0].referenceUnitId, "ubs-c",
      "referenceUnitId já correto não deve ser alterado");
    assert.equal(db.patients[0].unitId, "ubs-c", "unitId não deve ser alterado");
  });

  it("ensureDbShape: emite warn em divergência mas não corrompe dados", () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    const db = {
      patients: [{ id: "p4", unitId: "ubs-x", referenceUnitId: "ubs-y-diferente", municipalityId: "4299999" }],
      users: [], teams: [], units: [], userUnitMemberships: [], tasks: [], households: [],
      acsVisits: [], familyGroups: [], appointments: [], protocolTemplates: [], clinicalRecords: []
    };
    ensureDbShape(db);
    console.warn = origWarn;
    // patient must NOT be silently mutated on divergence
    assert.equal(db.patients[0].unitId, "ubs-x", "unitId não deve ser alterado em divergência");
    assert.equal(db.patients[0].referenceUnitId, "ubs-y-diferente",
      "referenceUnitId com divergência não deve ser silenciosamente sobrescrito");
    assert.ok(warnings.some(w => w.includes("divergence") || w.includes("divergência")),
      "deve emitir warn ao detectar divergência");
  });

  // ── Unit test de utils/patients.js ──────────────────────────────────────────

  it("buildReceptionistPatientSummary: expõe referenceUnitId", () => {
    const patient = { id: "p5", name: "Ana", birthDate: "1990-01-01", cpf: "", cns: "", unitId: "ubs-a", referenceUnitId: "ubs-a", teamId: "t1", inactive: false };
    const summary = buildReceptionistPatientSummary(patient);
    assert.equal(summary.referenceUnitId, "ubs-a", "summary deve incluir referenceUnitId");
    assert.equal(summary.unitId, "ubs-a", "summary deve preservar unitId para backward compat");
  });

  it("buildReceptionistPatientSummary: usa unitId como fallback quando referenceUnitId ausente", () => {
    const patient = { id: "p6", name: "Beto", birthDate: "1980-05-20", cpf: "", cns: "", unitId: "ubs-b", teamId: "t1", inactive: false };
    const summary = buildReceptionistPatientSummary(patient);
    assert.equal(summary.referenceUnitId, "ubs-b", "fallback para unitId quando referenceUnitId ausente");
  });

  // ── Integration test via HTTP ────────────────────────────────────────────────

  it("POST /patients: novo paciente tem referenceUnitId == unitId (integração)", async () => {
    const { status, json } = await post("/patients", {
      name: "Paciente Ref Unit Test",
      birthDate: "1992-03-10",
      gender: "M",
      phone: "11999000001",
      cpf: "98765432100",
      careCategory: "normal"
    }, nurseToken);

    assert.ok(status === 201 || status === 200,
      `esperava 201/200, got ${status}: ${JSON.stringify(json)}`);

    // Verify in DB that both fields are set and equal
    await withDb((db) => {
      const created = db.patients.find(p => p.name === "Paciente Ref Unit Test");
      assert.ok(created, "paciente deve estar no DB");
      assert.ok(created.unitId, "unitId deve estar preenchido (backward compat)");
      assert.ok(created.referenceUnitId, "referenceUnitId deve estar preenchido");
      assert.equal(created.referenceUnitId, created.unitId,
        `referenceUnitId (${created.referenceUnitId}) deve ser igual a unitId (${created.unitId})`);
      // Cleanup
      db.patients = db.patients.filter(p => p.name !== "Paciente Ref Unit Test");
    });
  });
});
