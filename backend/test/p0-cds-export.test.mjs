/**
 * p0-cds-export.test.mjs — P0-2: CDS Export UBS Isolation (IDOR fix)
 *
 * Verifica que os endpoints de CDS Export retornam 404 quando o profissional
 * autenticado tenta exportar dados de uma UBS diferente da sua.
 *
 * Critérios de aceite:
 * - [P0-2-A] /export/cds/individual/:patientId → 404 para paciente de outra UBS
 * - [P0-2-B] /export/cds/domiciliar/:householdId → 404 para domicílio de outra UBS
 * - [P0-2-C] /export/cds/atendimento/:patientId/:recordId → 404 para paciente de outra UBS
 * - [P0-2-D] /export/cds/visita/:visitId → 404 para visita de outra UBS
 * - [P0-2-E] Acesso à própria UBS funciona (não retorna 404 por isolamento)
 * - [P0-2-F] Sem capability cds.export → 403
 * - [P0-2-G] resolveActiveUnit ignora unitId injetado via query string
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";

// ── Inject a user directly into the DB (bypass unit validation) ────────────────
async function injectUser(overrides) {
  const { withDb } = await import("../src/db.js");
  const { hashPassword } = await import("../src/services/crypto.js");
  const { v4: uuidv4 } = await import("uuid");
  const { ensureDbShape } = await import("../src/utils/domain.js");
  const id = uuidv4();
  await withDb((db) => {
    ensureDbShape(db);
    if (db.users.some((u) => u.email === overrides.email)) return;
    db.users.push({
      id,
      name: overrides.name || "Test User",
      role: overrides.role || "gestor",
      email: overrides.email,
      password: hashPassword(overrides.password),
      teamId: overrides.teamId || "",
      unitId: overrides.unitId || "",
      municipalityId: "3550308",
      twoFactorEnabled: false,
      twoFactorSecret: "",
      twoFactorPendingSecret: "",
      twoFactorPendingCreatedAt: "",
      forcePasswordChange: false,
      passwordUpdatedAt: null,
      temporaryPasswordIssuedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });
  return id;
}

// ── Inject a unit directly into the DB ─────────────────────────────────────────
async function injectUnit(unitId, name = "Unidade Teste") {
  const { withDb } = await import("../src/db.js");
  const { ensureDbShape } = await import("../src/utils/domain.js");
  await withDb((db) => {
    ensureDbShape(db);
    if (db.units.some((u) => u.id === unitId)) return;
    db.units.push({
      id: unitId,
      name,
      cnes: "1234567",
      municipalityId: "3550308",
      createdAt: new Date().toISOString()
    });
  });
}

async function loginUser(email, password) {
  const res = await post("/auth/login", { email, password });
  assert.equal(res.status, 200, `Login ${email} failed: ${JSON.stringify(res.json)}`);
  return res.json?.token || res.json?.accessToken;
}

const stamp = Date.now();

const UNIT_A_ID = `unit-a-p02-${stamp}`;
const UNIT_B_ID = `unit-b-p02-${stamp}`;

const GESTOR_A_EMAIL = `gestor.a.p02.${stamp}@vitras.test`;
const GESTOR_A_PW = "GestorA@P02!";

const GESTOR_B_EMAIL = `gestor.b.p02.${stamp}@vitras.test`;
const GESTOR_B_PW = "GestorB@P02!";

const NURSE_EMAIL = `nurse.p02.${stamp}@vitras.test`;
const NURSE_PW = "Nurse@P02!";

let tokenA = null;   // gestor UBS-A
let tokenB = null;   // gestor UBS-B (attacker)
let tokenNurse = null; // nurse — no cds.export

let patientAId = null;
let householdAId = null;
let visitAId = null;

describe("P0-2: CDS Export UBS Isolation", () => {
  before(startTestServer);
  after(stopTestServer);

  it("Setup: inject units and users with specific unitIds", async () => {
    // Ensure both units exist in the DB
    await injectUnit(UNIT_A_ID, "UBS A (P02 Teste)");
    await injectUnit(UNIT_B_ID, "UBS B (P02 Teste)");

    // Inject gestor-A with UNIT_A_ID
    await injectUser({
      name: "Gestor UBS-A P02",
      email: GESTOR_A_EMAIL,
      password: GESTOR_A_PW,
      role: "gestor",
      unitId: UNIT_A_ID
    });
    tokenA = await loginUser(GESTOR_A_EMAIL, GESTOR_A_PW);
    assert.ok(tokenA, "tokenA must be set");

    // Inject gestor-B with UNIT_B_ID (the attacker)
    await injectUser({
      name: "Gestor UBS-B P02 (attacker)",
      email: GESTOR_B_EMAIL,
      password: GESTOR_B_PW,
      role: "gestor",
      unitId: UNIT_B_ID
    });
    tokenB = await loginUser(GESTOR_B_EMAIL, GESTOR_B_PW);
    assert.ok(tokenB, "tokenB must be set");

    // Inject nurse (no cds.export) with UNIT_A_ID
    await injectUser({
      name: "Nurse P02",
      email: NURSE_EMAIL,
      password: NURSE_PW,
      role: "nurse_manager",
      unitId: UNIT_A_ID
    });
    tokenNurse = await loginUser(NURSE_EMAIL, NURSE_PW);
    assert.ok(tokenNurse, "tokenNurse must be set");
  });

  it("Setup: inject patient owned by UBS-A directly into DB", async () => {
    // Only nurse/doctor can create patients via API; we inject directly.
    // This also ensures patient.unitId = UNIT_A_ID is set precisely.
    const { withDb } = await import("../src/db.js");
    const { ensureDbShape } = await import("../src/utils/domain.js");
    const { v4: uuidv4 } = await import("uuid");
    patientAId = uuidv4();
    await withDb((db) => {
      ensureDbShape(db);
      if (db.patients.some(p => p.id === patientAId)) return;
      db.patients.push({
        id: patientAId,
        name: "Paciente UBS-A P02 Isolamento",
        unitId: UNIT_A_ID, // explicitly tagged to UBS-A
        cns: "147852036985420",
        cpf: "",
        phone: "(11)91234-5678",
        careCategory: "general",
        records: [],
        teamId: "",
        municipalityId: "3550308",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    assert.ok(patientAId, "patientAId must be set");
  });

  it("Setup: create household for patient-A", async () => {
    if (!patientAId) {
      console.warn("Skipping household setup: patientAId not available");
      return;
    }
    const res = await post("/households", {
      patientId: patientAId,
      logradouro: "Rua Teste P02 Isolamento",
      numero: "42",
      tipoImovel: 1,
      municipio: "3550308"
    }, tokenA);
    if (res.status === 201) {
      householdAId = res.json?.id;
    } else {
      const list = await get(`/households?patientId=${patientAId}`, tokenA);
      householdAId = list.json?.[0]?.id || null;
    }
  });

  it("Setup: inject ACS visit for patient-A with UNIT_A_ID", async () => {
    if (!patientAId) return;
    const { withDb } = await import("../src/db.js");
    const { ensureDbShape } = await import("../src/utils/domain.js");
    const { v4: uuidv4 } = await import("uuid");
    const visitId = uuidv4();
    await withDb((db) => {
      ensureDbShape(db);
      if (!Array.isArray(db.acsVisits)) db.acsVisits = [];
      db.acsVisits.push({
        id: visitId,
        patientId: patientAId,
        acsId: "acs-test-id-p02",
        date: "2026-07-15",
        desfecho: "visita_realizada",
        unitId: UNIT_A_ID,
        createdAt: new Date().toISOString()
      });
    });
    visitAId = visitId;
  });

  // ── [P0-2-A] Individual export: cross-UBS access denied ──────────────────
  it("[P0-2-A] GET /export/cds/individual — gestor de outra UBS recebe 404", async () => {
    if (!patientAId) {
      console.warn("Skipping: patientAId not set");
      return;
    }
    const res = await get(`/export/cds/individual/${patientAId}`, tokenB);
    assert.equal(
      res.status,
      404,
      `Expected 404 (IDOR blocked for cross-UBS access), got ${res.status}: ${res.json?.error || ""}`
    );
  });

  // ── [P0-2-A2] Individual export: same UBS access not blocked ─────────────
  it("[P0-2-A2] GET /export/cds/individual — gestor da mesma UBS não recebe 404", async () => {
    if (!patientAId) return;
    const res = await get(`/export/cds/individual/${patientAId}`, tokenA);
    assert.ok(
      res.status !== 404,
      `Same-UBS access should NOT return 404 (isolation false-positive), got ${res.status}`
    );
    assert.ok(
      res.status !== 403,
      `Gestor has cds.export — should not be 403, got ${res.status}`
    );
  });

  // ── [P0-2-B] Domiciliar export: cross-UBS access denied ──────────────────
  it("[P0-2-B] GET /export/cds/domiciliar — gestor de outra UBS recebe 404", async () => {
    if (!householdAId) {
      console.warn("Skipping: householdAId not set");
      return;
    }
    const res = await get(`/export/cds/domiciliar/${householdAId}`, tokenB);
    // The domiciliar check goes through patient.unitId; if patient has UNIT_A_ID and
    // gestor-B has UNIT_B_ID, it should 404
    assert.equal(
      res.status,
      404,
      `Expected 404 for cross-UBS household access, got ${res.status}: ${res.json?.error || ""}`
    );
  });

  // ── [P0-2-C] Atendimento export: cross-UBS patient blocked ───────────────
  it("[P0-2-C] GET /export/cds/atendimento — gestor de outra UBS recebe 404 no paciente", async () => {
    if (!patientAId) return;
    // Even with a fake recordId, patient lookup must fail first (returning 404)
    const res = await get(`/export/cds/atendimento/${patientAId}/some-record-id`, tokenB);
    assert.equal(
      res.status,
      404,
      `Expected 404 (patient UBS isolation), got ${res.status}: ${res.json?.error || ""}`
    );
  });

  // ── [P0-2-D] Visita export: cross-UBS access denied ──────────────────────
  it("[P0-2-D] GET /export/cds/visita — gestor de outra UBS recebe 404", async () => {
    if (!visitAId) {
      console.warn("Skipping: visitAId not set");
      return;
    }
    const res = await get(`/export/cds/visita/${visitAId}`, tokenB);
    assert.equal(
      res.status,
      404,
      `Expected 404 (visit UBS isolation), got ${res.status}: ${res.json?.error || ""}`
    );
  });

  // ── [P0-2-E] Non-existent ID returns 404 regardless (sanity) ─────────────
  it("[P0-2-E] GET /export/cds/individual com ID inexistente → 404", async () => {
    const res = await get("/export/cds/individual/nonexistent-patient-id-p02", tokenA);
    assert.equal(res.status, 404, `Nonexistent patient must return 404, got ${res.status}`);
  });

  // ── [P0-2-F] No cds.export capability → 403 ─────────────────────────────
  it("[P0-2-F] GET /export/cds/individual sem capability cds.export (nurse) → 403", async () => {
    if (!patientAId) return;
    const res = await get(`/export/cds/individual/${patientAId}`, tokenNurse);
    assert.equal(
      res.status,
      403,
      `nurse_manager has no cds.export — expected 403, got ${res.status}`
    );
  });

  // ── [P0-2-G] Query string unitId injection is ignored ────────────────────
  it("[P0-2-G] Tentativa de injetar unitId via query string é ignorada", async () => {
    if (!patientAId) return;
    // gestor-B (UNIT_B) tries to bypass by injecting UNIT_A in query
    const res = await get(
      `/export/cds/individual/${patientAId}?unitId=${UNIT_A_ID}`,
      tokenB
    );
    assert.equal(
      res.status,
      404,
      `Query-param unitId injection must be ignored, got ${res.status}: ${res.json?.error || ""}`
    );
  });
});
