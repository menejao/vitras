/**
 * break-glass-session.test.mjs
 *
 * VITRAS-ACCESS-SCOPE-BREAKGLASS-AND-MUNICIPAL-HIERARCHY-01 — Part F
 *
 * Tests for BreakGlassSession nominal activation model.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, req } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const UNIT_ID  = "unit-bgs-001";
const TEAM_ID  = "team-bgs-001";
const MUNI_ID  = "muni-bgs-test";
const DOC_ID   = "doc-bgs-001";
const ACS_ID   = "acs-bgs-001";
const PAT_A_ID = "pat-bgs-001";
const PAT_B_ID = "pat-bgs-002";
const DOC_PASS = "DoctorBG@2026";
const ACS_PASS = "AcsBG@2026";

let doctorToken = "";
let acsToken    = "";

const post = (path, body, token, extra = {}) => req("POST", path, body, token, extra);
const get  = (path, token, extra = {}) => req("GET", path, null, token, extra);

async function seedActors() {
  await withDb((db) => {
    ensureDbShape(db);

    if (!db.units.find(u => u.id === UNIT_ID)) {
      db.units.push({
        id: UNIT_ID, name: "UBS BG Test", cnes: "8888888",
        street: "Rua BG", streetNumber: "1", neighborhood: "BG",
        municipalityId: MUNI_ID, createdAt: new Date().toISOString()
      });
    }
    if (!db.teams.find(t => t.id === TEAM_ID)) {
      db.teams.push({ id: TEAM_ID, name: "Equipe BG", unitId: UNIT_ID, createdAt: new Date().toISOString() });
    }
    if (!db.users.find(u => u.id === DOC_ID)) {
      db.users.push({
        id: DOC_ID, vitrasId: "200000001", name: "Dr BG", role: "doctor",
        email: "docbg@test.com", password: hashPassword(DOC_PASS),
        teamId: TEAM_ID, unitId: UNIT_ID, municipalityId: MUNI_ID,
        forcePasswordChange: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
    if (!db.users.find(u => u.id === ACS_ID)) {
      db.users.push({
        id: ACS_ID, vitrasId: "200000002", name: "ACS BG", role: "acs",
        email: "acsbg@test.com", password: hashPassword(ACS_PASS),
        teamId: TEAM_ID, unitId: UNIT_ID, municipalityId: MUNI_ID,
        forcePasswordChange: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
    if (!db.patients.find(p => p.id === PAT_A_ID)) {
      db.patients.push({
        id: PAT_A_ID, name: "Paciente BG A", teamId: TEAM_ID, unitId: UNIT_ID,
        referenceUnitId: UNIT_ID, municipalityId: MUNI_ID,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
    if (!db.patients.find(p => p.id === PAT_B_ID)) {
      db.patients.push({
        id: PAT_B_ID, name: "Paciente BG B", teamId: "team-other", unitId: "unit-other",
        referenceUnitId: "unit-other", municipalityId: MUNI_ID,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
  });
}

async function loginAs(vitrasId, password) {
  const { status, json } = await post("/auth/login", { identifier: vitrasId, password });
  assert.equal(status, 200, `Login falhou para ${vitrasId}: ${JSON.stringify(json)}`);
  return json?.token || json?.accessToken || "";
}

before(async () => {
  await startTestServer();
  await seedActors();
  doctorToken = await loginAs("200000001", DOC_PASS);
  acsToken    = await loginAs("200000002", ACS_PASS);
});

after(stopTestServer);

describe("BreakGlassSession — ativação", () => {
  it("médico pode ativar com senha correta", async () => {
    const { status, json } = await post("/break-glass/activate", { patientId: PAT_A_ID, password: DOC_PASS }, doctorToken);
    assert.equal(status, 201, JSON.stringify(json));
    assert.ok(json.sessionId, "deve retornar sessionId");
    assert.ok(json.expiresAt, "deve retornar expiresAt");
    assert.equal(json.patientId, PAT_A_ID);

    const expiresAt = Date.parse(json.expiresAt);
    const now = Date.now();
    assert.ok(expiresAt > now + 29 * 60 * 1000, "deve expirar em ~30min");
    assert.ok(expiresAt < now + 31 * 60 * 1000, "não deve ultrapassar 30min");
  });

  it("senha errada retorna 401", async () => {
    const { status, json } = await post("/break-glass/activate", { patientId: PAT_A_ID, password: "SenhaErrada@99" }, doctorToken);
    assert.equal(status, 401, JSON.stringify(json));
    assert.ok(json.error);
  });

  it("ACS não tem capability — retorna 403", async () => {
    const { status } = await post("/break-glass/activate", { patientId: PAT_A_ID, password: ACS_PASS }, acsToken);
    assert.equal(status, 403);
  });

  it("paciente inexistente retorna 404", async () => {
    const { status } = await post("/break-glass/activate", { patientId: "pat-nao-existe", password: DOC_PASS }, doctorToken);
    assert.equal(status, 404);
  });

  it("patientId ausente retorna 400", async () => {
    const { status } = await post("/break-glass/activate", { password: DOC_PASS }, doctorToken);
    assert.equal(status, 400);
  });
});

describe("BreakGlassSession — status e desativação", () => {
  it("GET /break-glass/status retorna sessão ativa após ativação", async () => {
    await post("/break-glass/activate", { patientId: PAT_A_ID, password: DOC_PASS }, doctorToken);
    const { status, json } = await get("/break-glass/status", doctorToken);
    assert.equal(status, 200);
    assert.equal(json.active, true);
    assert.ok(json.sessionId);
    assert.equal(json.patientId, PAT_A_ID);
  });

  it("POST /break-glass/deactivate encerra sessão", async () => {
    await post("/break-glass/activate", { patientId: PAT_A_ID, password: DOC_PASS }, doctorToken);
    const { status: s1, json: j1 } = await post("/break-glass/deactivate", {}, doctorToken);
    assert.equal(s1, 200, JSON.stringify(j1));
    assert.ok(j1.ok);

    const { json: statusJson } = await get("/break-glass/status", doctorToken);
    assert.equal(statusJson.active, false);
  });
});

describe("BreakGlassSession — canAccessPatient logic unit tests", () => {
  it("bgs ativa com patientId correto: acesso permitido mesmo cross-muni", async () => {
    const { canAccessPatient } = await import("../src/utils/patients.js");
    const user = {
      role: "doctor",
      teamId: "team-x",
      municipalityId: "muni-x",
      activeBreakGlassSession: {
        active: true,
        patientId: "pat-target",
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      }
    };
    const patient = { id: "pat-target", teamId: "team-other", municipalityId: "muni-other" };
    assert.ok(canAccessPatient(user, patient, "write"), "bgs deve permitir acesso cross-muni para paciente correto");
  });

  it("bgs ativa mas patientId diferente: não aplica break glass", async () => {
    const { canAccessPatient } = await import("../src/utils/patients.js");
    const user = {
      role: "doctor",
      teamId: "team-x",
      municipalityId: "muni-x",
      activeBreakGlassSession: {
        active: true,
        patientId: "pat-target",
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      }
    };
    const patient = { id: "pat-diferente", teamId: "team-other", municipalityId: "muni-diferente" };
    assert.ok(!canAccessPatient(user, patient, "write"), "bgs não deve aplicar para paciente diferente");
  });

  it("bgs expirada é ignorada", async () => {
    const { canAccessPatient } = await import("../src/utils/patients.js");
    const user = {
      role: "doctor",
      teamId: "team-x",
      municipalityId: "muni-x",
      activeBreakGlassSession: {
        active: true,
        patientId: "pat-target",
        expiresAt: new Date(Date.now() - 1000).toISOString()
      }
    };
    const patient = { id: "pat-target", teamId: "team-other", municipalityId: "muni-other" };
    assert.ok(!canAccessPatient(user, patient, "write"), "bgs expirada não deve conceder acesso");
  });

  it("ausência de bgs não afeta fluxo normal de acesso", async () => {
    const { canAccessPatient } = await import("../src/utils/patients.js");
    const user = { role: "doctor", teamId: "team-x", municipalityId: "muni-x" };
    const patient = { id: "pat-y", teamId: "team-x", municipalityId: "muni-x" };
    assert.ok(canAccessPatient(user, patient, "read"), "acesso normal ainda funciona sem bgs");
  });
});
