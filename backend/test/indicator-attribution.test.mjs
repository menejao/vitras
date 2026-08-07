/**
 * indicator-attribution.test.mjs
 *
 * VITRAS-INDICATORS-AND-OPERATIONAL-PRODUCTION-01
 *
 * Tests for IndicatorAttributionEngine and the new production endpoints:
 *   Unit tests (pure):
 *     - resolveTerritory: canonical, legacy_inferred_safe, legacy_ambiguous
 *     - resolveOperation: canonical, legacy_inferred_safe, legacy_ambiguous
 *     - countTerritorialForUnit / countOperationalForUnit
 *     - Same-UBS: ref == exec — both counts correct, no double-count rule mismatch
 *     - Cross-UBS: ref ≠ exec — territorial to ref-UBS, operational to exec-UBS
 *     - Legacy ambiguous: not counted in totals
 *   Integration (server):
 *     - GET /production/territorial returns count scoped to active unit
 *     - GET /production/operational returns count scoped to active unit
 *     - Cross-UBS event: territorial ≠ operational
 *     - ACS/receptionist blocked (403)
 *     - Support_admin blocked (403)
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  resolveTerritory,
  resolveOperation,
  countTerritorialForUnit,
  countOperationalForUnit,
  collectAllEvents,
  ATTRIBUTION_SOURCE,
  EVENT_TYPE,
} from "../src/services/indicator-attribution-engine.js";
import { startTestServer, stopTestServer, req } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIT_REF  = "iac-unit-ref";   // UBS de referência territorial
const UNIT_EXEC = "iac-unit-exec";  // UBS executora (cross-UBS)
const TEAM_REF  = "iac-team-ref";
const TEAM_EXEC = "iac-team-exec";
const MUNI_ID   = "iac-muni-001";

const GESTOR_REF_VID  = "600000001";
const GESTOR_EXEC_VID = "600000002";
const DOCTOR_VID      = "600000003";
const ACS_VID         = "600000004";
const SADM_VID        = "600000005";

const GESTOR_REF_ID  = "iac-gestor-ref";
const GESTOR_EXEC_ID = "iac-gestor-exec";
const DOCTOR_ID      = "iac-doctor";
const ACS_ID         = "iac-acs";
const SADM_ID        = "iac-sadm";

const TODAY = new Date().toISOString().slice(0, 10);

let gestorRefToken  = "";
let gestorExecToken = "";
let doctorToken     = "";
let acsToken        = "";
let sadmToken       = "";

const post = (path, body, token) => req("POST", path, body, token);
const get  = (path, token)       => req("GET",  path, null, token);

// ── Pure unit tests ───────────────────────────────────────────────────────────

describe("IndicatorAttributionEngine — unit tests", () => {

  it("resolveTerritory: canonical fields → CANONICAL source", () => {
    const ev = {
      referenceUnitIdAtEvent: "unit-a",
      referenceTeamIdAtEvent: "team-a",
      referenceAcsIdAtEvent:  "acs-1",
    };
    const t = resolveTerritory(ev);
    assert.equal(t.unitId, "unit-a");
    assert.equal(t.teamId, "team-a");
    assert.equal(t.acsId,  "acs-1");
    assert.equal(t.source, ATTRIBUTION_SOURCE.CANONICAL);
  });

  it("resolveTerritory: no canonical, has unitId → LEGACY_INFERRED_SAFE", () => {
    const ev = { unitId: "unit-legacy", teamId: "team-legacy" };
    const t = resolveTerritory(ev);
    assert.equal(t.unitId, "unit-legacy");
    assert.equal(t.teamId, "team-legacy");
    assert.equal(t.acsId,  null);
    assert.equal(t.source, ATTRIBUTION_SOURCE.LEGACY_INFERRED_SAFE);
  });

  it("resolveTerritory: no fields → LEGACY_AMBIGUOUS", () => {
    const ev = { id: "ev-no-unit" };
    const t = resolveTerritory(ev);
    assert.equal(t.unitId, null);
    assert.equal(t.source, ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS);
  });

  it("resolveOperation: canonical fields → CANONICAL source", () => {
    const ev = {
      executingUnitId:         "unit-exec",
      executingTeamId:         "team-exec",
      executingProfessionalId: "prof-1",
    };
    const o = resolveOperation(ev);
    assert.equal(o.unitId,         "unit-exec");
    assert.equal(o.teamId,         "team-exec");
    assert.equal(o.professionalId, "prof-1");
    assert.equal(o.source, ATTRIBUTION_SOURCE.CANONICAL);
  });

  it("resolveOperation: no canonical, has unitId → LEGACY_INFERRED_SAFE", () => {
    const ev = { unitId: "unit-leg", teamId: "team-leg" };
    const o = resolveOperation(ev);
    assert.equal(o.unitId, "unit-leg");
    assert.equal(o.source, ATTRIBUTION_SOURCE.LEGACY_INFERRED_SAFE);
  });

  it("resolveOperation: no fields → LEGACY_AMBIGUOUS", () => {
    const ev = { id: "ev-empty" };
    const o = resolveOperation(ev);
    assert.equal(o.unitId, null);
    assert.equal(o.source, ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS);
  });

  it("same-UBS: ref == exec → event counted in both territorial and operational for same unit", () => {
    const ev = {
      referenceUnitIdAtEvent: "unit-same",
      executingUnitId:        "unit-same",
      createdAt: TODAY,
      _eventType: EVENT_TYPE.AGENDA,
      _eventDate: TODAY,
    };
    const terr = countTerritorialForUnit([ev], "unit-same");
    const oper  = countOperationalForUnit([ev],  "unit-same");
    assert.equal(terr.total, 1, "territorial +1 for same-UBS");
    assert.equal(oper.total,  1, "operational +1 for same-UBS");
    assert.equal(terr.canonical, 1);
    assert.equal(oper.canonical,  1);
  });

  it("cross-UBS: ref ≠ exec → territorial to ref, operational to exec", () => {
    const ev = {
      referenceUnitIdAtEvent: "unit-ref",
      executingUnitId:        "unit-exec",
      createdAt: TODAY,
      _eventType: EVENT_TYPE.AGENDA,
      _eventDate: TODAY,
    };
    // Territorial: only unit-ref gets +1
    const terrRef  = countTerritorialForUnit([ev], "unit-ref");
    const terrExec = countTerritorialForUnit([ev], "unit-exec");
    assert.equal(terrRef.total,  1, "territorial +1 for ref unit");
    assert.equal(terrExec.total, 0, "territorial 0 for exec unit");

    // Operational: only unit-exec gets +1
    const operRef  = countOperationalForUnit([ev], "unit-ref");
    const operExec = countOperationalForUnit([ev], "unit-exec");
    assert.equal(operRef.total,  0, "operational 0 for ref unit");
    assert.equal(operExec.total, 1, "operational +1 for exec unit");
  });

  it("LEGACY_AMBIGUOUS events not counted in totals", () => {
    const ev = { id: "ev-ambiguous", createdAt: TODAY, _eventDate: TODAY };
    const terr = countTerritorialForUnit([ev], "any-unit");
    assert.equal(terr.total,    0, "ambiguous not in total");
    assert.equal(terr.ambiguous, 1, "ambiguous counted separately");
  });

  it("mixed batch: canonical + legacy + ambiguous counted correctly", () => {
    const events = [
      // canonical, ref=unit-a
      { referenceUnitIdAtEvent: "unit-a", executingUnitId: "unit-b", _eventDate: TODAY },
      // legacy safe, unit=unit-a
      { unitId: "unit-a", _eventDate: TODAY },
      // ambiguous
      { id: "ev-amb", _eventDate: TODAY },
      // canonical, ref=unit-b (different unit)
      { referenceUnitIdAtEvent: "unit-b", executingUnitId: "unit-a", _eventDate: TODAY },
    ];
    const terr = countTerritorialForUnit(events, "unit-a");
    assert.equal(terr.total,         2, "canonical + legacy = 2");
    assert.equal(terr.canonical,     1);
    assert.equal(terr.legacyInferred, 1);
    assert.equal(terr.ambiguous,     1, "ambiguous tracked but not in total");
  });
});

// ── Integration tests ─────────────────────────────────────────────────────────

describe("IndicatorAttributionEngine — integration", () => {
  before(async () => {
    await startTestServer();
    await withDb((db) => {
      ensureDbShape(db);

      // Units
      for (const u of [
        { id: UNIT_REF,  name: "IAC UBS Ref",  cnes: "", municipalityId: MUNI_ID, createdAt: new Date().toISOString() },
        { id: UNIT_EXEC, name: "IAC UBS Exec", cnes: "", municipalityId: MUNI_ID, createdAt: new Date().toISOString() },
      ]) { if (!db.units.find(x => x.id === u.id)) db.units.push(u); }

      // Teams
      for (const t of [
        { id: TEAM_REF,  name: "IAC Team Ref",  unitId: UNIT_REF,  createdAt: new Date().toISOString() },
        { id: TEAM_EXEC, name: "IAC Team Exec", unitId: UNIT_EXEC, createdAt: new Date().toISOString() },
      ]) { if (!db.teams.find(x => x.id === t.id)) db.teams.push(t); }

      // Users
      const pw = hashPassword("IacTest@2026");
      for (const u of [
        { id: GESTOR_REF_ID,  vitrasId: GESTOR_REF_VID,  role: "gestor",        email: "iac.gestor.ref@test.local",  teamId: TEAM_REF,  unitId: UNIT_REF,  municipalityId: MUNI_ID },
        { id: GESTOR_EXEC_ID, vitrasId: GESTOR_EXEC_VID, role: "gestor",        email: "iac.gestor.exec@test.local", teamId: TEAM_EXEC, unitId: UNIT_EXEC, municipalityId: MUNI_ID },
        { id: DOCTOR_ID,      vitrasId: DOCTOR_VID,      role: "doctor",        email: "iac.doctor@test.local",       teamId: TEAM_REF,  unitId: UNIT_REF,  municipalityId: MUNI_ID },
        { id: ACS_ID,         vitrasId: ACS_VID,         role: "acs",           email: "iac.acs@test.local",          teamId: TEAM_REF,  unitId: UNIT_REF,  municipalityId: MUNI_ID },
        { id: SADM_ID,        vitrasId: SADM_VID,        role: "support_admin", email: "iac.sadm@test.local",         teamId: "",        unitId: "",        municipalityId: "" },
      ]) {
        if (!db.users.find(x => x.id === u.id)) {
          db.users.push({ ...u, name: u.id, password: pw, teamName: "", inactive: false,
            twoFactorEnabled: false, forcePasswordChange: false,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
      }

      // Events for current month (will be picked up by period=mes)
      const todayStr = TODAY;

      // Event A: same-UBS (ref=UNIT_REF, exec=UNIT_REF) — agenda entry
      if (!db.agendaEntries.find(x => x.id === "iac-ev-same")) {
        db.agendaEntries.push({
          id: "iac-ev-same",
          patientId: "iac-pt-1",
          date: todayStr,
          referenceUnitIdAtEvent: UNIT_REF,
          referenceTeamIdAtEvent: TEAM_REF,
          executingUnitId:        UNIT_REF,
          executingTeamId:        TEAM_REF,
          executingProfessionalId: DOCTOR_ID,
          municipalityId: MUNI_ID,
          createdAt: new Date().toISOString(),
        });
      }

      // Event B: cross-UBS (ref=UNIT_REF, exec=UNIT_EXEC) — acsVisit
      if (!db.acsVisits.find(x => x.id === "iac-ev-cross")) {
        db.acsVisits.push({
          id: "iac-ev-cross",
          patientId: "iac-pt-1",
          acsId: ACS_ID,
          date: todayStr,
          desfecho: "realizada",
          referenceUnitIdAtEvent: UNIT_REF,
          referenceTeamIdAtEvent: TEAM_REF,
          referenceAcsIdAtEvent:  ACS_ID,
          executingUnitId:        UNIT_EXEC,
          executingTeamId:        TEAM_EXEC,
          executingProfessionalId: ACS_ID,
          municipalityId: MUNI_ID,
          createdAt: new Date().toISOString(),
        });
      }

      // Event C: legacy (no canonical fields, unitId=UNIT_EXEC) — exam
      if (!db.exams.find(x => x.id === "iac-ev-legacy")) {
        db.exams.push({
          id: "iac-ev-legacy",
          patientId: "iac-pt-1",
          date: todayStr,
          unitId:  UNIT_EXEC,
          teamId:  TEAM_EXEC,
          createdAt: new Date().toISOString(),
        });
      }

      // Event D: ambiguous (no unit fields at all)
      if (!db.referrals.find(x => x.id === "iac-ev-ambiguous")) {
        db.referrals.push({
          id: "iac-ev-ambiguous",
          patientId: "iac-pt-1",
          createdAt: new Date().toISOString(),
        });
      }
    });

    const [gr, ge, d, a, s] = await Promise.all([
      post("/auth/login", { identifier: GESTOR_REF_VID,  password: "IacTest@2026" }),
      post("/auth/login", { identifier: GESTOR_EXEC_VID, password: "IacTest@2026" }),
      post("/auth/login", { identifier: DOCTOR_VID,      password: "IacTest@2026" }),
      post("/auth/login", { identifier: ACS_VID,         password: "IacTest@2026" }),
      post("/auth/login", { identifier: SADM_VID,        password: "IacTest@2026" }),
    ]);
    gestorRefToken  = gr.json?.token || gr.json?.accessToken || "";
    gestorExecToken = ge.json?.token || ge.json?.accessToken || "";
    doctorToken     = d.json?.token  || d.json?.accessToken  || "";
    acsToken        = a.json?.token  || a.json?.accessToken  || "";
    sadmToken       = s.json?.token  || s.json?.accessToken  || "";
  });

  after(async () => {
    await withDb((db) => {
      const units = new Set([UNIT_REF, UNIT_EXEC]);
      const teams = new Set([TEAM_REF, TEAM_EXEC]);
      const users = new Set([GESTOR_REF_ID, GESTOR_EXEC_ID, DOCTOR_ID, ACS_ID, SADM_ID]);
      const evs   = new Set(["iac-ev-same", "iac-ev-cross", "iac-ev-legacy", "iac-ev-ambiguous"]);
      db.units        = db.units.filter(x => !units.has(x.id));
      db.teams        = db.teams.filter(x => !teams.has(x.id));
      db.users        = db.users.filter(x => !users.has(x.id));
      db.agendaEntries = db.agendaEntries.filter(x => !evs.has(x.id));
      db.acsVisits    = db.acsVisits.filter(x => !evs.has(x.id));
      db.exams        = db.exams.filter(x => !evs.has(x.id));
      db.referrals    = db.referrals.filter(x => !evs.has(x.id));
    });
    await stopTestServer();
  });

  // ── /production/territorial ─────────────────────────────────────────────────

  it("GET /production/territorial: gestor-ref vê indicadores territoriais da sua UBS", async () => {
    const { status, json } = await get("/production/territorial?period=mes", gestorRefToken);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json._kind, "territorial");
    assert.equal(json.unitId, UNIT_REF);
    // Event A (same-UBS, canonical) + Event B (cross-UBS, ref=UNIT_REF, canonical)
    assert.ok(json.total >= 2, `esperava >= 2 eventos territoriais para UNIT_REF, got ${json.total}`);
  });

  it("GET /production/territorial: UNIT_REF não recebe evento operacional de UNIT_EXEC", async () => {
    const { status, json } = await get("/production/territorial?period=mes", gestorRefToken);
    assert.equal(status, 200);
    // Event B is territorial to UNIT_REF — operational to UNIT_EXEC
    // Event C (legacy, unitId=UNIT_EXEC) should NOT appear in UNIT_REF territorial
    // Event A (same-UBS) appears in both — that's correct
    const byType = json.byEventType || {};
    // exam (event C) should not be in UNIT_REF territorial
    assert.equal(byType[EVENT_TYPE.EXAM] || 0, 0, "exam com unitId=UNIT_EXEC não deve aparecer em UNIT_REF territorial");
  });

  it("GET /production/operational: gestor-ref vê produção operacional da sua UBS", async () => {
    const { status, json } = await get("/production/operational?period=mes", gestorRefToken);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json._kind, "operational");
    assert.equal(json.unitId, UNIT_REF);
    // Only Event A (same-UBS, executingUnitId=UNIT_REF) → 1
    // Event B (cross-UBS, executingUnitId=UNIT_EXEC) → 0 for UNIT_REF operational
    assert.ok(json.total >= 1, `esperava >= 1 evento operacional para UNIT_REF, got ${json.total}`);
  });

  it("cross-UBS: event B conta territorial em UNIT_REF, operacional em UNIT_EXEC", async () => {
    const [terrRef, operExec] = await Promise.all([
      get("/production/territorial?period=mes", gestorRefToken),
      get("/production/operational?period=mes", gestorExecToken),
    ]);
    // Event B: territorial → UNIT_REF, operational → UNIT_EXEC
    // UNIT_REF territorial must include acsVisit
    assert.ok((terrRef.json.byEventType?.[EVENT_TYPE.ACS_VISIT] || 0) >= 1,
      "acsVisit deve aparecer em territorial de UNIT_REF");
    // UNIT_EXEC operational must include acsVisit (event B executingUnitId=UNIT_EXEC)
    assert.ok((operExec.json.byEventType?.[EVENT_TYPE.ACS_VISIT] || 0) >= 1,
      "acsVisit deve aparecer em operational de UNIT_EXEC");
  });

  it("GET /production/territorial: gestor-exec NÃO vê UNIT_REF territorial (escopo correto)", async () => {
    const { status, json } = await get("/production/territorial?period=mes", gestorExecToken);
    assert.equal(status, 200);
    assert.equal(json.unitId, UNIT_EXEC, "gestor-exec deve ver apenas UNIT_EXEC");
    // Event A and B are territorial to UNIT_REF, not UNIT_EXEC — so UNIT_EXEC territorial should be 0
    assert.equal(json.byEventType?.[EVENT_TYPE.AGENDA]    || 0, 0, "agenda (ref=UNIT_REF) não conta para UNIT_EXEC territorial");
    assert.equal(json.byEventType?.[EVENT_TYPE.ACS_VISIT] || 0, 0, "acsVisit (ref=UNIT_REF) não conta para UNIT_EXEC territorial");
  });

  it("GET /production/territorial: doctor pode consultar (role permitido)", async () => {
    const { status } = await get("/production/territorial?period=mes", doctorToken);
    assert.equal(status, 200);
  });

  it("GET /production/territorial: ACS bloqueado → 403", async () => {
    const { status } = await get("/production/territorial?period=mes", acsToken);
    assert.equal(status, 403);
  });

  it("GET /production/operational: support_admin bloqueado → 403", async () => {
    const { status } = await get("/production/operational?period=mes", sadmToken);
    assert.equal(status, 403);
  });

  it("legacy event classificado em legacyInferred (não ambiguous)", async () => {
    // Event C: unitId=UNIT_EXEC, sem canonical — LEGACY_INFERRED_SAFE
    const { status, json } = await get("/production/operational?period=mes", gestorExecToken);
    assert.equal(status, 200);
    assert.ok(json.legacyInferred >= 1, `esperava >= 1 legacy inferred em UNIT_EXEC, got ${json.legacyInferred}`);
  });

  it("ambiguous event não conta no total (nem territorial nem operacional)", async () => {
    // Event D: sem unitId — LEGACY_AMBIGUOUS — só contado em json.ambiguous
    const [t, o] = await Promise.all([
      get("/production/territorial?period=mes", gestorRefToken),
      get("/production/operational?period=mes", gestorRefToken),
    ]);
    assert.ok(t.json.ambiguous >= 1, "ambiguous deve ser >= 1 em territorial");
    assert.ok(o.json.ambiguous >= 1, "ambiguous deve ser >= 1 em operational");
  });

  it("período custom: sem eventos fora do intervalo → total = 0", async () => {
    // Usando período do passado distante
    const { status, json } = await get("/production/territorial?period=custom&from=2020-01-01&to=2020-01-31", gestorRefToken);
    assert.equal(status, 200);
    assert.equal(json.total, 0, "sem eventos no período passado");
  });
});
