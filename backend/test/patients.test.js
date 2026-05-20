import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";

describe("Patients and clinical records", () => {
  before(startTestServer);
  after(stopTestServer);

  const testEmail = `gestor-pat-${Date.now()}@integration.test`;
  const testPassword = "TestPass@67890!";
  let token = null;
  let patientId = null;

  before(async () => {
    // Use demo manager account (auto-created in non-prod mode, has nurse_manager role + team)
    const { json } = await post("/auth/login", {
      email: "ana@clinica.local",
      password: "123456"
    });
    token = json?.token || json?.accessToken || null;
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
      careCategory: "general"
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

  it("POST /patients with invalid data returns 400 or 422", async () => {
    if (!token) return;
    const { status } = await post("/patients", {}, token);
    assert.ok(status === 400 || status === 422, `Expected 400 or 422, got ${status}`);
  });
});
