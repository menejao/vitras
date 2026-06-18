import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";

// ── Unit tests for production-metrics service ─────────────────────────────────

import {
  periodBounds,
  getAcsMetrics,
  getNurseMetrics,
  getManagerMetrics,
  getMicroareaMetrics,
} from "../src/services/production-metrics.js";

const TODAY = new Date().toISOString().slice(0, 10);
const DAYS_AGO = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

describe("productionMetrics — unit tests", () => {

  it("periodBounds: hoje returns today", () => {
    const { from, to } = periodBounds("hoje");
    assert.equal(from, TODAY);
    assert.equal(to, TODAY);
  });

  it("periodBounds: semana returns 7 days ago", () => {
    const { from, to } = periodBounds("semana");
    assert.ok(from < TODAY);
    assert.equal(to, TODAY);
    const diff = Math.round((new Date(to) - new Date(from)) / 86400000);
    assert.equal(diff, 7);
  });

  it("periodBounds: mes returns 30 days ago", () => {
    const { from, to } = periodBounds("mes");
    const diff = Math.round((new Date(to) - new Date(from)) / 86400000);
    assert.equal(diff, 30);
  });

  it("periodBounds: trimestre returns 90 days ago", () => {
    const { from, to } = periodBounds("trimestre");
    const diff = Math.round((new Date(to) - new Date(from)) / 86400000);
    assert.equal(diff, 90);
  });

  it("periodBounds: custom with explicit dates", () => {
    const { from, to } = periodBounds("custom", "2026-01-01", "2026-03-31");
    assert.equal(from, "2026-01-01");
    assert.equal(to,   "2026-03-31");
  });

  // Minimal DB fixture
  const ACS_ID = "acs-001";
  const PAT_ID = "pat-001";
  const GROUP_ID = "grp-001";
  const TEAM_ID  = "team-001";

  const freshDb = () => ({
    users:   [{ id: ACS_ID, role: "acs", teamId: TEAM_ID, name: "ACS Test" }],
    patients:[{
      id: PAT_ID, assignedAcsId: ACS_ID, teamId: TEAM_ID,
      cns: "123456789012345", address: "Rua Teste, 99",
      updatedAt: DAYS_AGO(5), inactive: false,
    }],
    familyGroups: [{
      id: GROUP_ID, teamId: TEAM_ID, assignedAcsId: ACS_ID,
      address: "Rua Teste, 99", microArea: "MA-01",
      memberPatientIds: [PAT_ID],
      memberHistory: [], transferHistory: [],
      createdAt: DAYS_AGO(200),
    }],
    acsVisits: [],
    tasks: [],
    households: [],
  });

  it("getAcsMetrics: empty visits → all zeros", () => {
    const db = freshDb();
    const m = getAcsMetrics(db, ACS_ID, "mes");
    assert.equal(m.visits.total, 0);
    assert.equal(m.visits.realizada, 0);
    assert.equal(m.tasks.done, 0);
    assert.equal(m.groups.total, 1);
  });

  it("getAcsMetrics: counts realizada visits in period", () => {
    const db = freshDb();
    db.acsVisits = [
      { id: "v1", acsId: ACS_ID, patientId: PAT_ID, desfecho: "realizada", date: DAYS_AGO(5), createdAt: DAYS_AGO(5) },
      { id: "v2", acsId: ACS_ID, patientId: PAT_ID, desfecho: "recusada",  date: DAYS_AGO(3), createdAt: DAYS_AGO(3) },
      { id: "v3", acsId: ACS_ID, patientId: PAT_ID, desfecho: "ausente",   date: DAYS_AGO(1), createdAt: DAYS_AGO(1) },
    ];
    const m = getAcsMetrics(db, ACS_ID, "mes");
    assert.equal(m.visits.total, 3);
    assert.equal(m.visits.realizada, 1);
    assert.equal(m.visits.recusada,  1);
    assert.equal(m.visits.ausente,   1);
  });

  it("getAcsMetrics: visit outside period is not counted", () => {
    const db = freshDb();
    db.acsVisits = [
      { id: "v1", acsId: ACS_ID, patientId: PAT_ID, desfecho: "realizada", date: DAYS_AGO(45), createdAt: DAYS_AGO(45) },
    ];
    const m = getAcsMetrics(db, ACS_ID, "mes");
    assert.equal(m.visits.total, 0); // outside 30-day window
  });

  it("getAcsMetrics: tasks done in period counted", () => {
    const db = freshDb();
    db.tasks = [
      { id: "t1", patientId: PAT_ID, status: "done",    dueDate: null, updatedAt: DAYS_AGO(3), title: "A" },
      { id: "t2", patientId: PAT_ID, status: "pending", dueDate: DAYS_AGO(5), title: "B" }, // overdue
    ];
    const m = getAcsMetrics(db, ACS_ID, "mes");
    assert.equal(m.tasks.done, 1);
    assert.equal(m.tasks.overdue, 1);
  });

  it("getAcsMetrics: transfersReceived counted", () => {
    const db = freshDb();
    db.familyGroups[0].transferHistory = [
      { fromAcsId: "other-acs", toAcsId: ACS_ID, transferredAt: DAYS_AGO(5) },
    ];
    const m = getAcsMetrics(db, ACS_ID, "mes");
    assert.equal(m.transfers.received, 1);
    assert.equal(m.transfers.sent, 0);
  });

  it("getAcsMetrics: new groups in period", () => {
    const db = freshDb();
    db.familyGroups[0].createdAt = DAYS_AGO(5); // within month
    const m = getAcsMetrics(db, ACS_ID, "mes");
    assert.equal(m.newGroups, 1);
  });

  it("getAcsMetrics: groups score distribution", () => {
    const db = freshDb();
    // Patient has CNS and fresh address → partial score
    const m = getAcsMetrics(db, ACS_ID, "mes");
    assert.equal(m.groups.total, 1);
    assert.ok(typeof m.groups.avgScore === "number");
    assert.ok(m.groups.avgScore >= 0 && m.groups.avgScore <= 100);
  });

  it("getNurseMetrics: counts active/inactive ACS", () => {
    const db = freshDb();
    const ACS2 = "acs-002";
    db.users.push({ id: ACS2, role: "acs", teamId: TEAM_ID, name: "ACS Inactive" });
    // ACS1 has a visit, ACS2 has none
    db.acsVisits = [
      { id: "v1", acsId: ACS_ID, patientId: PAT_ID, desfecho: "realizada", date: DAYS_AGO(5), createdAt: DAYS_AGO(5) },
    ];
    const m = getNurseMetrics(db, TEAM_ID, "mes");
    assert.equal(m.perAcs.length, 2);
    assert.equal(m.acsActive, 1);
    assert.equal(m.acsInactive, 1);
  });

  it("getNurseMetrics: team group counts", () => {
    const db = freshDb();
    const m = getNurseMetrics(db, TEAM_ID, "mes");
    assert.equal(m.team.totalGroups, 1);
    assert.ok(typeof m.team.avgScore === "number");
  });

  it("getManagerMetrics: territory totals correct", () => {
    const db = freshDb();
    const m = getManagerMetrics(db, TEAM_ID, "mes");
    assert.equal(m.territory.totalGroups, 1);
    assert.equal(m.territory.totalMembers, 1);
    assert.ok(m.territory.avgScore >= 0 && m.territory.avgScore <= 100);
    assert.ok(typeof m.evolution === "object");
    assert.ok(["melhorando", "estavel", "piorando"].includes(m.evolution.trend));
  });

  it("getManagerMetrics: visitCoverage = 0 with no visits", () => {
    const db = freshDb();
    const m = getManagerMetrics(db, TEAM_ID, "mes");
    assert.equal(m.territory.visitCoverage, 0);
  });

  it("getManagerMetrics: visitCoverage = 100 when all groups visited", () => {
    const db = freshDb();
    db.acsVisits = [
      { id: "v1", acsId: ACS_ID, patientId: PAT_ID, desfecho: "realizada", date: DAYS_AGO(5), createdAt: DAYS_AGO(5) },
    ];
    const m = getManagerMetrics(db, TEAM_ID, "mes");
    assert.equal(m.territory.visitCoverage, 100);
  });

  it("getMicroareaMetrics: groups by microArea", () => {
    const db = freshDb();
    const m = getMicroareaMetrics(db, TEAM_ID, null);
    assert.ok(Array.isArray(m));
    assert.equal(m.length, 1);
    assert.equal(m[0].microArea, "MA-01");
    assert.equal(m[0].groups, 1);
    assert.equal(m[0].members, 1);
  });

  it("getMicroareaMetrics: acsId filter limits results", () => {
    const db = freshDb();
    const OTHER_ACS = "acs-999";
    const m = getMicroareaMetrics(db, TEAM_ID, OTHER_ACS);
    assert.equal(m.length, 0); // no groups for other ACS
  });
});

// ── HTTP integration tests ────────────────────────────────────────────────────

describe("Production API — APS-01F", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const nurseEmail = `prod-nurse-${stamp}@integration.test`;
  const acsEmail   = `prod-acs-${stamp}@integration.test`;
  const password   = "ProdPass@12345!";

  let nurseToken = null;
  let acsToken   = null;
  let teamId     = null;
  let acsId      = null;

  before(async () => {
    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200);
    teamId = teamsRes.json[0]?.id;
    assert.ok(teamId);

    const nurseReg = await post("/auth/register", {
      name: "Enfermeira Produção",
      email: nurseEmail,
      password,
      role: "nurse_manager",
      teamId,
      councilNumber: `${stamp}`.slice(-6),
      councilUf: "SP"
    });
    assert.equal(nurseReg.status, 201, JSON.stringify(nurseReg.json));
    nurseToken = nurseReg.json?.token;

    const acsCreate = await post("/users", {
      name: "ACS Produção",
      email: acsEmail,
      password,
      role: "acs",
      teamId,
    }, nurseToken);
    assert.equal(acsCreate.status, 201, JSON.stringify(acsCreate.json));
    acsId = acsCreate.json?.id;

    const acsLogin = await post("/auth/login", { email: acsEmail, password });
    assert.equal(acsLogin.status, 200, JSON.stringify(acsLogin.json));
    acsToken = acsLogin.json?.token;

    // Create a patient to generate data
    await post("/patients", {
      name: "Paciente Prod",
      birthDate: "1990-03-15",
      sex: "F",
      phone: "11988888888",
      cpf: `${stamp}`.slice(-11).padStart(11, "0"),
      address: `Rua Produção ${stamp}, 1`,
      teamId,
      assignedAcsId: acsId,
    }, nurseToken);
  });

  // ── /production/acs ──────────────────────────────────────────────────────────

  it("GET /production/acs — 401 without token", async () => {
    const res = await get("/production/acs");
    assert.equal(res.status, 401);
  });

  it("GET /production/acs — ACS gets own metrics", async () => {
    const res = await get("/production/acs?period=mes", acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    const m = res.json;
    assert.equal(m.acsId, acsId);
    assert.ok(m.visits);
    assert.ok(m.tasks);
    assert.ok(m.groups);
    assert.ok(m.period?.from);
  });

  it("GET /production/acs?period=hoje — period filter works", async () => {
    const res = await get("/production/acs?period=hoje", acsToken);
    assert.equal(res.status, 200);
    assert.equal(res.json.period.from, new Date().toISOString().slice(0, 10));
  });

  it("GET /production/acs?period=semana — week period", async () => {
    const res = await get("/production/acs?period=semana", acsToken);
    assert.equal(res.status, 200);
    const diff = Math.round(
      (new Date(res.json.period.to) - new Date(res.json.period.from)) / 86400000
    );
    assert.equal(diff, 7);
  });

  it("GET /production/acs?period=trimestre — quarter period", async () => {
    const res = await get("/production/acs?period=trimestre", acsToken);
    assert.equal(res.status, 200);
    const diff = Math.round(
      (new Date(res.json.period.to) - new Date(res.json.period.from)) / 86400000
    );
    assert.equal(diff, 90);
  });

  it("GET /production/acs — nurse can query ACS by id", async () => {
    const res = await get(`/production/acs?acsId=${acsId}`, nurseToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.equal(res.json.acsId, acsId);
  });

  it("GET /production/acs — nurse without acsId → 400", async () => {
    const res = await get("/production/acs", nurseToken);
    assert.equal(res.status, 400);
  });

  it("GET /production/acs — metrics improve after recording visit", async () => {
    // Get groups for ACS
    const groupsRes = await get("/family-groups", acsToken);
    const myGroup = groupsRes.json.find(g => g.assignedAcsId === acsId);
    if (!myGroup) return; // skip if no group yet

    const patientId = myGroup.memberPatientIds?.[0];
    if (!patientId) return;

    const before = await get("/production/acs?period=mes", acsToken);
    const visitsBefore = before.json.visits.realizada;

    await post("/acs-visits", {
      patientId,
      date: new Date().toISOString().slice(0, 10),
      turno: "manha",
      desfecho: "realizada",
    }, acsToken);

    const after = await get("/production/acs?period=mes", acsToken);
    assert.ok(after.json.visits.realizada >= visitsBefore + 1, "realizada count should increase");
  });

  // ── /production/nurse ────────────────────────────────────────────────────────

  it("GET /production/nurse — 401 without token", async () => {
    const res = await get("/production/nurse");
    assert.equal(res.status, 401);
  });

  it("GET /production/nurse — ACS → 403", async () => {
    const res = await get("/production/nurse", acsToken);
    assert.equal(res.status, 403);
  });

  it("GET /production/nurse — nurse gets team metrics", async () => {
    const res = await get("/production/nurse?period=mes", nurseToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    const m = res.json;
    assert.ok(typeof m.acsActive === "number");
    assert.ok(typeof m.acsInactive === "number");
    assert.ok(Array.isArray(m.perAcs));
    assert.ok(m.team?.totalGroups !== undefined);
  });

  it("GET /production/nurse — perAcs has expected fields", async () => {
    const res = await get("/production/nurse?period=mes", nurseToken);
    assert.equal(res.status, 200);
    const acs = res.json.perAcs.find(a => a.acsId === acsId);
    assert.ok(acs, "our ACS should appear in perAcs");
    assert.ok(typeof acs.visits?.total === "number");
    assert.ok(typeof acs.tasks?.done === "number");
    assert.ok(typeof acs.groups?.avgScore === "number");
  });

  // ── /production/manager ──────────────────────────────────────────────────────

  it("GET /production/manager — 401 without token", async () => {
    const res = await get("/production/manager");
    assert.equal(res.status, 401);
  });

  it("GET /production/manager — ACS → 403", async () => {
    const res = await get("/production/manager", acsToken);
    assert.equal(res.status, 403);
  });

  it("GET /production/manager — nurse gets territory metrics", async () => {
    const res = await get("/production/manager?period=mes", nurseToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    const m = res.json;
    assert.ok(typeof m.territory?.totalGroups === "number");
    assert.ok(typeof m.territory?.visitCoverage === "number");
    assert.ok(typeof m.territory?.avgScore === "number");
    assert.ok(m.evolution?.trend);
    assert.ok(["melhorando", "estavel", "piorando"].includes(m.evolution.trend));
  });

  // ── /production/microareas ───────────────────────────────────────────────────

  it("GET /production/microareas — 401 without token", async () => {
    const res = await get("/production/microareas");
    assert.equal(res.status, 401);
  });

  it("GET /production/microareas — ACS gets own microareas", async () => {
    const res = await get("/production/microareas", acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json));
    // Each item has expected shape
    if (res.json.length > 0) {
      const m = res.json[0];
      assert.ok(m.microArea !== undefined);
      assert.ok(typeof m.groups === "number");
      assert.ok(typeof m.members === "number");
      assert.ok(typeof m.avgScore === "number");
      assert.ok(typeof m.critical === "number");
      assert.ok(typeof m.noVisit90 === "number");
    }
  });

  it("GET /production/microareas — nurse can filter by acsId", async () => {
    const res = await get(`/production/microareas?acsId=${acsId}`, nurseToken);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json));
  });
});
