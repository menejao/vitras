import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

describe("Patients and clinical records", () => {
  before(startTestServer);
  after(stopTestServer);

  const testEmail = `gestor-pat-${Date.now()}@integration.test`;
  const testPassword = "TestPass@67890!";
  let token = null;
  let patientId = null;
  let foreignToken = null;
  const sameTeamPatientId = "test-patient-team-ana";
  const foreignPatientId = "test-patient-team-rosa";

  before(async () => {
    // Use demo manager account (auto-created in non-prod mode, has nurse_manager role + team)
    const { json } = await post("/auth/login", {
      email: "ana@clinica.local",
      password: "123456"
    });
    token = json?.token || json?.accessToken || null;

    await withDb((db) => {
      ensureDbShape(db);
      if (!db.teams.some((team) => team.id === "team-rosa")) {
        db.teams.push({
          id: "team-rosa",
          name: "Equipe Rosa",
          managerUserId: "seed-user-enf",
          unitId: "unit-default",
          createdAt: new Date().toISOString()
        });
      }
      if (!db.users.some((user) => user.id === "seed-user-enf")) {
        db.users.push({
          id: "seed-user-enf",
          name: "Enf. Patrícia Lima",
          role: "nurse_manager",
          email: "patricia.enf@vitras.com.br",
          password: hashPassword("Demo@2026"),
          teamId: "team-rosa",
          teamName: "Equipe Rosa",
          unitId: "unit-default",
          councilType: "COREN",
          councilNumber: "12345",
          councilUf: "SP",
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      if (!db.patients.some((patient) => patient.id === sameTeamPatientId)) {
        db.patients.push({
          id: sameTeamPatientId,
          teamId: "team-ana",
          assignedAcsId: "u2",
          careCategory: "general",
          inactive: false,
          incompleteProfile: false,
          name: "Paciente Time Ana",
          phone: "(11)90000-1000",
          microArea: "MA-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      if (!db.patients.some((patient) => patient.id === foreignPatientId)) {
        db.patients.push({
          id: foreignPatientId,
          teamId: "team-rosa",
          assignedAcsId: "",
          careCategory: "general",
          inactive: false,
          incompleteProfile: false,
          name: "Paciente Time Rosa",
          phone: "(11)90000-2000",
          microArea: "MA-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      db.clinicalRecords = Array.isArray(db.clinicalRecords) ? db.clinicalRecords : [];
      if (!db.clinicalRecords.some((record) => record.id === "record-team-rosa-1")) {
        db.clinicalRecords.push({
          id: "record-team-rosa-1",
          patientId: foreignPatientId,
          type: "note",
          title: "Registro time rosa",
          details: "Nao deve vazar para outro time",
          date: "2026-05-14",
          createdBy: "seed-user-enf",
          createdAt: new Date().toISOString()
        });
      }
      if (!db.clinicalRecords.some((record) => record.id === "record-team-ana-1")) {
        db.clinicalRecords.push({
          id: "record-team-ana-1",
          patientId: sameTeamPatientId,
          type: "note",
          title: "Registro time ana",
          details: "Leitura permitida no proprio time",
          date: "2026-05-14",
          createdBy: "u1",
          createdAt: new Date().toISOString()
        });
      }
    });

    const loginForeign = await post("/auth/login", {
      email: "patricia.enf@vitras.com.br",
      password: "Demo@2026"
    });
    foreignToken = loginForeign.json?.token || loginForeign.json?.accessToken || null;
  });

  it("GET /patients returns array (may be empty for new team)", async () => {
    if (!token) return;
    const { status, json } = await get("/patients", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json));
  });

  it("POST /patients creates a patient", async () => {
    if (!token) return;
    const { status, json } = await post("/patients", {
      name: "Teste Integração",
      phone: "(11)90000-0001",
      careCategory: "general",
      cns: "123456789012345"
    }, token);
    assert.ok(
      status === 201 || status === 200,
      `Expected 201, got ${status}: ${JSON.stringify(json)}`
    );
    assert.ok(json.id, "Missing patient id");
    patientId = json.id;
  });

  it("GET /patients/:id/appointments returns array", async () => {
    if (!token || !patientId) return;
    const { status, json } = await get(`/patients/${patientId}/appointments`, token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json));
  });

  it("POST /patients/:id/appointments creates appointment", async () => {
    if (!token || !patientId) return;
    const { status, json } = await post(`/patients/${patientId}/appointments`, {
      date: "2026-05-14",
      summary: "Consulta de teste integração",
      demandType: "spontaneous_demand"
    }, token);
    assert.ok(
      status === 201 || status === 200,
      `Expected 201, got ${status}: ${JSON.stringify(json)}`
    );
    assert.ok(json.id);
  });

  it("POST /patients/:id/records creates a clinical record", async () => {
    if (!token || !patientId) return;
    const { status, json } = await post(`/patients/${patientId}/records`, {
      type: "note",
      title: "Registro de teste",
      details: "Detalhes do registro de integração",
      date: "2026-05-14"
    }, token);
    assert.ok(
      status === 201 || status === 200,
      `Expected 201, got ${status}: ${JSON.stringify(json)}`
    );
    assert.ok(json.id);
  });

  it("GET /patients/:id/history returns event list", async () => {
    if (!token || !patientId) return;
    const { status, json } = await get(`/patients/${patientId}/history`, token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json));
    // Should have at least the appointment and record we created
    assert.ok(json.length >= 1, "Expected at least 1 history event");
  });

  it("GET /patients/:id/history blocks cross-team access", async () => {
    if (!token) return;
    const { status } = await get(`/patients/${foreignPatientId}/history`, token);
    assert.ok(status === 403 || status === 404, `Expected 403 or 404, got ${status}`);
  });

  it("GET /patients/:id/history allows same-team access", async () => {
    if (!foreignToken) return;
    const { status, json } = await get(`/patients/${foreignPatientId}/history`, foreignToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json), "Expected history array");
    assert.ok(json.length >= 1, "Expected at least 1 same-team history event");
  });

  it("POST /patients with invalid data returns 400 or 422", async () => {
    if (!token) return;
    const { status } = await post("/patients", {}, token);
    assert.ok(status === 400 || status === 422, `Expected 400 or 422, got ${status}`);
  });
});
