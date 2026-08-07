/**
 * clinical-event-attribution.test.mjs
 *
 * VITRAS-CLINICAL-EVENT-ATTRIBUTION-01 — FASE 9
 *
 * Tests: attribution fields on clinical events, cds-export isolation,
 * legacy record compatibility, migration-022 logic.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, get } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

// ── Canonical test actors ────────────────────────────────────────────────────

const UNIT_A_ID  = "unit-attr-a";
const UNIT_B_ID  = "unit-attr-b";
const TEAM_A_ID  = "team-attr-a";
const TEAM_B_ID  = "team-attr-b";
const MUNI_ID    = "muni-attr-test";
const ACS_ID     = "acs-attr-001";
const DOCTOR_ID  = "doc-attr-001";
const PATIENT_ID = "pat-attr-001";
const ACS_PATIENT_ID = "pat-attr-002";

let acsToken    = "";
let doctorToken = "";

async function seedActors() {
  await withDb((db) => {
    ensureDbShape(db);

    if (!db.units.find(u => u.id === UNIT_A_ID)) {
      db.units.push({
        id: UNIT_A_ID, name: "UBS Attr-A", cnes: "1111111",
        street: "Rua A", streetNumber: "1", neighborhood: "Bairro A",
        municipalityId: MUNI_ID, createdAt: new Date().toISOString()
      });
    }
    if (!db.units.find(u => u.id === UNIT_B_ID)) {
      db.units.push({
        id: UNIT_B_ID, name: "UBS Attr-B", cnes: "2222222",
        street: "Rua B", streetNumber: "2", neighborhood: "Bairro B",
        municipalityId: MUNI_ID, createdAt: new Date().toISOString()
      });
    }
    if (!db.teams.find(t => t.id === TEAM_A_ID)) {
      db.teams.push({
        id: TEAM_A_ID, name: "Equipe Attr-A", unitId: UNIT_A_ID,
        managerUserId: DOCTOR_ID, createdAt: new Date().toISOString()
      });
    }
    if (!db.teams.find(t => t.id === TEAM_B_ID)) {
      db.teams.push({
        id: TEAM_B_ID, name: "Equipe Attr-B", unitId: UNIT_B_ID,
        managerUserId: null, createdAt: new Date().toISOString()
      });
    }

    // ACS
    if (!db.users.find(u => u.id === ACS_ID)) {
      db.users.push({
        id: ACS_ID, name: "ACS Attr Test", role: "acs",
        email: "acs-attr@vitras.com.br",
        vitrasId: "100000001",
        password: hashPassword("AcsAttr@2026"),
        teamId: TEAM_A_ID, teamName: "Equipe Attr-A",
        unitId: UNIT_A_ID,
        inactive: false, twoFactorEnabled: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
    // Doctor
    if (!db.users.find(u => u.id === DOCTOR_ID)) {
      db.users.push({
        id: DOCTOR_ID, name: "Dr. Attr Test", role: "doctor",
        email: "doc-attr@vitras.com.br",
        vitrasId: "100000002",
        password: hashPassword("DocAttr@2026"),
        teamId: TEAM_A_ID, teamName: "Equipe Attr-A",
        unitId: UNIT_A_ID,
        councilType: "CRM", councilNumber: "99999", councilUf: "SP",
        inactive: false, twoFactorEnabled: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }

    // Patient with full attribution
    if (!db.patients.find(p => p.id === PATIENT_ID)) {
      db.patients.push({
        id: PATIENT_ID,
        name: "Paciente Attr Test",
        cpf: null, cns: null,
        teamId: TEAM_A_ID,
        unitId: UNIT_A_ID,
        referenceUnitId: UNIT_A_ID,
        municipalityId: MUNI_ID,
        assignedAcsId: ACS_ID,
        birthDate: "1990-01-01",
        gender: "feminino",
        createdAt: new Date().toISOString()
      });
    }

    // Second patient for ACS visit (assigned to ACS)
    if (!db.patients.find(p => p.id === ACS_PATIENT_ID)) {
      db.patients.push({
        id: ACS_PATIENT_ID,
        name: "Paciente ACS Attr",
        cpf: null, cns: null,
        teamId: TEAM_A_ID,
        unitId: UNIT_A_ID,
        referenceUnitId: UNIT_A_ID,
        municipalityId: MUNI_ID,
        assignedAcsId: ACS_ID,
        birthDate: "1985-06-15",
        gender: "masculino",
        createdAt: new Date().toISOString()
      });
    }
  });
}

describe("Clinical Event Attribution — FASE 9", () => {
  before(async () => {
    await startTestServer();
    await seedActors();

    const r1 = await post("/auth/login", { identifier: "100000001", password: "AcsAttr@2026" });
    acsToken = r1.json?.token || r1.json?.accessToken || "";

    const r2 = await post("/auth/login", { identifier: "100000002", password: "DocAttr@2026" });
    doctorToken = r2.json?.token || r2.json?.accessToken || "";
  });
  after(stopTestServer);

  // ── acsVisit attribution ─────────────────────────────────────────────────

  it("acsVisit: attribution fields present after creation", async () => {
    const { status, json } = await post("/acs-visits", {
      patientId: ACS_PATIENT_ID,
      date: "2026-08-07",
      desfecho: "realizada",
      motivos: ["acompanhamento"],
    }, acsToken);
    assert.equal(status, 201, `Expected 201 got ${status}: ${JSON.stringify(json)}`);
    const v = json.data || json.visit || json;
    assert.ok(v.executingUnitId,        "executingUnitId missing");
    assert.ok(v.executingTeamId,        "executingTeamId missing");
    assert.ok(v.executingProfessionalId, "executingProfessionalId missing");
    assert.ok(v.referenceUnitIdAtEvent, "referenceUnitIdAtEvent missing");
    assert.ok(v.referenceTeamIdAtEvent, "referenceTeamIdAtEvent missing");
    assert.ok(v.municipalityId,         "municipalityId missing");
  });

  it("acsVisit: executingUnitId matches ACS unit from JWT (not client)", async () => {
    const { status, json } = await post("/acs-visits", {
      patientId: ACS_PATIENT_ID,
      date: "2026-08-07",
      desfecho: "realizada",
      motivos: ["controle_saude"],
    }, acsToken);
    assert.equal(status, 201);
    const v = json.data || json.visit || json;
    assert.equal(v.executingUnitId, UNIT_A_ID, "executingUnitId must match ACS JWT unit");
  });

  it("acsVisit: referenceUnitIdAtEvent matches patient referenceUnitId", async () => {
    const { status, json } = await post("/acs-visits", {
      patientId: ACS_PATIENT_ID,
      date: "2026-08-07",
      desfecho: "realizada",
      motivos: ["acompanhamento"],
    }, acsToken);
    assert.equal(status, 201);
    const v = json.data || json.visit || json;
    assert.equal(v.referenceUnitIdAtEvent, UNIT_A_ID);
    assert.equal(v.referenceTeamIdAtEvent, TEAM_A_ID);
    assert.equal(v.municipalityId, MUNI_ID);
  });

  it("acsVisit: referenceAcsIdAtEvent matches patient assignedAcsId", async () => {
    const { status, json } = await post("/acs-visits", {
      patientId: ACS_PATIENT_ID,
      date: "2026-08-07",
      desfecho: "realizada",
      motivos: ["acompanhamento"],
    }, acsToken);
    assert.equal(status, 201);
    const v = json.data || json.visit || json;
    assert.equal(v.referenceAcsIdAtEvent, ACS_ID, "referenceAcsIdAtEvent must match patient.assignedAcsId");
  });

  it("acsVisit: teamId legacy field preserved", async () => {
    const { status, json } = await post("/acs-visits", {
      patientId: ACS_PATIENT_ID,
      date: "2026-08-07",
      desfecho: "realizada",
      motivos: ["acompanhamento"],
    }, acsToken);
    assert.equal(status, 201);
    const v = json.data || json.visit || json;
    assert.ok(v.teamId, "teamId legacy field must be preserved");
  });

  // ── exam attribution ─────────────────────────────────────────────────────

  it("exam: attribution fields present after creation", async () => {
    const { status, json } = await post(
      `/patients/${PATIENT_ID}/exams`,
      { title: "Hemograma", date: "2026-08-07", source: "posto" },
      doctorToken
    );
    assert.equal(status, 201, `Expected 201 got ${status}: ${JSON.stringify(json)}`);
    const e = json.data || json;
    assert.ok(e.executingUnitId,        "executingUnitId missing");
    assert.ok(e.executingTeamId,        "executingTeamId missing");
    assert.ok(e.executingProfessionalId, "executingProfessionalId missing");
    assert.ok(e.referenceUnitIdAtEvent, "referenceUnitIdAtEvent missing");
    assert.ok(e.referenceTeamIdAtEvent, "referenceTeamIdAtEvent missing");
    assert.ok(e.municipalityId,         "municipalityId missing");
  });

  it("exam: executingProfessionalId matches doctor JWT", async () => {
    const { status, json } = await post(
      `/patients/${PATIENT_ID}/exams`,
      { title: "Glicemia", date: "2026-08-07", source: "posto" },
      doctorToken
    );
    assert.equal(status, 201);
    const e = json.data || json;
    assert.equal(e.executingProfessionalId, DOCTOR_ID);
  });

  // ── referral attribution ─────────────────────────────────────────────────

  it("referral: attribution fields present after creation", async () => {
    const { status, json } = await post("/referrals", {
      patientId: PATIENT_ID,
      specialty: "cardiologia",
      reason: "Avaliação",
      priority: "routine",
      date: "2026-08-07",
      notes: "",
      status: "pending",
    }, doctorToken);
    assert.equal(status, 201, `Expected 201 got ${status}: ${JSON.stringify(json)}`);
    const r = json.entry || json.data || json;
    assert.ok(r.executingUnitId,        "executingUnitId missing");
    assert.ok(r.executingTeamId,        "executingTeamId missing");
    assert.ok(r.executingProfessionalId, "executingProfessionalId missing");
    assert.ok(r.referenceUnitIdAtEvent, "referenceUnitIdAtEvent missing");
    assert.ok(r.referenceTeamIdAtEvent, "referenceTeamIdAtEvent missing");
    assert.ok(r.municipalityId,         "municipalityId missing");
  });

  // ── cds-export isolation logic (unit tests — RISCO-01) ───────────────────

  it("cds-export isolation: legacy visit (no executingUnitId, no unitId) — isolation skipped", () => {
    const legacyVisit = { id: "v-legacy", patientId: "p1", acsId: "u1" };
    // Mirrors the check in cds-export.js line 347-348
    const activeUnitId = UNIT_A_ID;
    const isBreakGlass = false;
    const visitUnitId = legacyVisit.executingUnitId || legacyVisit.unitId;
    const isolated = !legacyVisit || (!isBreakGlass && activeUnitId && visitUnitId && visitUnitId !== activeUnitId);
    assert.ok(!isolated, "Legacy visit with no unit fields must not be isolated (got: " + isolated + ")");
  });

  it("cds-export isolation: new visit with executingUnitId from different unit — isolated", () => {
    const newVisit = { id: "v-new", patientId: "p1", acsId: "u1", executingUnitId: UNIT_B_ID };
    const activeUnitId = UNIT_A_ID; // ACS is in UNIT_A
    const isBreakGlass = false;
    const visitUnitId = newVisit.executingUnitId || newVisit.unitId;
    const isolated = !newVisit || (!isBreakGlass && activeUnitId && visitUnitId && visitUnitId !== activeUnitId);
    assert.equal(isolated, true, "Visit from different unit must be isolated");
  });

  it("cds-export isolation: break_glass bypasses executingUnitId isolation", () => {
    const newVisit = { id: "v-bg", patientId: "p1", acsId: "u1", executingUnitId: UNIT_B_ID };
    const activeUnitId = UNIT_A_ID;
    const isBreakGlass = true; // break_glass bypasses check
    const visitUnitId = newVisit.executingUnitId || newVisit.unitId;
    const isolated = !newVisit || (!isBreakGlass && activeUnitId && visitUnitId && visitUnitId !== activeUnitId);
    assert.equal(isolated, false, "break_glass must not be isolated");
  });

  it("cds-export isolation: visit executingUnitId matches activeUnitId — not isolated", () => {
    const newVisit = { id: "v-same", patientId: "p1", executingUnitId: UNIT_A_ID };
    const activeUnitId = UNIT_A_ID;
    const isBreakGlass = false;
    const visitUnitId = newVisit.executingUnitId || newVisit.unitId;
    const isolated = !newVisit || (!isBreakGlass && activeUnitId && visitUnitId && visitUnitId !== activeUnitId);
    assert.equal(isolated, false, "Visit from same unit must not be isolated");
  });

  // ── migration-022 logic (unit tests) ──────────────────────────────────────

  it("migration-022 logic: fills executingUnitId from professional.unitId", () => {
    const users = { "u1": { id: "u1", unitId: "ubs-x", teamId: "team-x" } };
    const patients = { "p1": { id: "p1", referenceUnitId: "ubs-x", teamId: "team-x", municipalityId: "muni-1" } };

    const visit = {
      id: "v1", patientId: "p1", acsId: "u1", teamId: "team-x",
      date: "2025-01-01", desfecho: "visita_realizada", motivos: [],
    };

    fillAttribution(visit, { patients, users }, { professionalId: "acsId", isAcsVisit: true });

    assert.equal(visit.executingUnitId, "ubs-x");
    assert.equal(visit.executingTeamId, "team-x");
    assert.equal(visit.executingProfessionalId, "u1");
    assert.equal(visit.referenceUnitIdAtEvent, "ubs-x");
    assert.equal(visit.referenceTeamIdAtEvent, "team-x");
    assert.equal(visit.municipalityId, "muni-1");
  });

  it("migration-022 logic: does NOT overwrite already-set fields", () => {
    const users = { "u1": { id: "u1", unitId: "ubs-new", teamId: "team-new" } };
    const patients = { "p1": { id: "p1", referenceUnitId: "ubs-new", teamId: "team-new", municipalityId: "muni-2" } };

    const visit = {
      id: "v2", patientId: "p1", acsId: "u1",
      executingUnitId: "ubs-original",  // already set
      executingTeamId: "team-original", // already set
      executingProfessionalId: "u-original", // already set
      referenceUnitIdAtEvent: "ubs-ref-original", // already set
      referenceTeamIdAtEvent: "team-ref-original", // already set
      municipalityId: "muni-original", // already set
    };

    const changed = fillAttribution(visit, { patients, users }, { professionalId: "acsId" });

    assert.equal(changed, 0, "Should not overwrite any already-set field");
    assert.equal(visit.executingUnitId, "ubs-original");
    assert.equal(visit.municipalityId, "muni-original");
  });

  it("migration-022 logic: referenceUnitId fallback to unitId when referenceUnitId absent", () => {
    const users = { "u1": { id: "u1", unitId: "ubs-x", teamId: "team-x" } };
    const patients = { "p1": { id: "p1", unitId: "ubs-fallback", teamId: "team-x", municipalityId: "muni-1" } };
    // patient has no referenceUnitId

    const visit = { id: "v3", patientId: "p1", acsId: "u1" };
    fillAttribution(visit, { patients, users }, { professionalId: "acsId" });

    assert.equal(visit.referenceUnitIdAtEvent, "ubs-fallback", "Must fall back to patient.unitId");
  });
});

// ── Inline helper (mirrors migration-022 logic) ───────────────────────────────
// Used in unit tests above so they don't need to import the migration script.

function isSet(v) { return v !== null && v !== undefined && v !== ""; }

function fillAttribution(record, { patients, users }, opts = {}) {
  const { professionalId, isAcsVisit = false } = opts;

  const patient = patients[record.patientId];
  const profId = record[professionalId] || record.createdBy;
  const prof = users[profId];

  let changed = 0;

  if (!isSet(record.executingUnitId) && prof?.unitId) {
    record.executingUnitId = String(prof.unitId); changed++;
  }
  if (!isSet(record.executingTeamId) && (prof?.teamId || record.teamId)) {
    record.executingTeamId = String(prof?.teamId || record.teamId || ""); changed++;
  }
  if (!isSet(record.executingProfessionalId) && profId) {
    record.executingProfessionalId = String(profId); changed++;
  }
  if (patient) {
    if (!isSet(record.referenceUnitIdAtEvent)) {
      record.referenceUnitIdAtEvent = String(patient.referenceUnitId || patient.unitId || ""); changed++;
    }
    if (!isSet(record.referenceTeamIdAtEvent)) {
      record.referenceTeamIdAtEvent = String(patient.teamId || ""); changed++;
    }
    if (!isSet(record.municipalityId)) {
      record.municipalityId = String(patient.municipalityId || ""); changed++;
    }
    if (isAcsVisit && !isSet(record.referenceAcsIdAtEvent)) {
      record.referenceAcsIdAtEvent = String(patient.assignedAcsId || ""); changed++;
    }
  }

  return changed;
}
