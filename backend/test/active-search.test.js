import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch, req } from "./helpers.js";

// ── Unit tests for evaluateGroup ──────────────────────────────────────────────

import { evaluateGroup, PENDENCY_CODES, CLASSIFICATION } from "../src/services/active-search.js";

const TODAY = new Date().toISOString().slice(0, 10);
const DAYS_AGO = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

describe("evaluateGroup — unit tests", () => {

  const baseGroup = {
    id: "g1",
    address: "Rua das Flores, 123",
    createdAt: DAYS_AGO(200),
    memberPatientIds: ["p1"],
    memberHistory: [],
    transferHistory: [],
  };

  const freshMember = {
    id: "p1",
    name: "Paciente Um",
    cns: "123456789012345",
    address: "Rua das Flores, 123",
    updatedAt: DAYS_AGO(10),
    inactive: false,
  };

  const recentVisit = { id: "v1", patientId: "p1", desfecho: "realizada", date: DAYS_AGO(5), createdAt: DAYS_AGO(5) };
  const noTasks = [];

  it("perfect group scores 100", () => {
    const ev = evaluateGroup(baseGroup, [freshMember], [recentVisit], noTasks);
    assert.equal(ev.score, 100);
    assert.equal(ev.classification, CLASSIFICATION.HEALTHY);
    assert.equal(ev.pendencies.length, 0);
  });

  it("classification: score >= 80 = saudavel", () => {
    const ev = evaluateGroup(baseGroup, [freshMember], [recentVisit], noTasks);
    assert.equal(ev.classification, CLASSIFICATION.HEALTHY);
  });

  it("classification: score 50-79 = atencao", () => {
    // no recent visit (-25) = 75 → atencao
    const ev = evaluateGroup(baseGroup, [freshMember], [], noTasks);
    assert.ok(ev.score >= 50 && ev.score < 80);
    assert.equal(ev.classification, CLASSIFICATION.ATTENTION);
  });

  it("classification: score < 50 = critico", () => {
    // no visit (-25), stale member (-25), no CNS (-15) = 35
    const staleMemberNoCns = {
      ...freshMember,
      cns: "",
      updatedAt: DAYS_AGO(400),
    };
    const ev = evaluateGroup(baseGroup, [staleMemberNoCns], [], noTasks);
    assert.ok(ev.score < 50);
    assert.equal(ev.classification, CLASSIFICATION.CRITICAL);
  });

  // ── R-01 ────────────────────────────────────────────────────────────────────

  it("R-01: stale registration (> 12 months) → UPDATE_REGISTRATION_REQUIRED", () => {
    const staleMember = { ...freshMember, updatedAt: DAYS_AGO(400) };
    const ev = evaluateGroup(baseGroup, [staleMember], [recentVisit], noTasks);
    assert.ok(ev.pendencies.some(p => p.code === PENDENCY_CODES.UPDATE_REGISTRATION_REQUIRED));
  });

  it("R-01: fresh registration → no UPDATE_REGISTRATION_REQUIRED", () => {
    const ev = evaluateGroup(baseGroup, [freshMember], [recentVisit], noTasks);
    assert.ok(!ev.pendencies.some(p => p.code === PENDENCY_CODES.UPDATE_REGISTRATION_REQUIRED));
  });

  it("R-01: score -25 when registration stale", () => {
    const staleMember = { ...freshMember, updatedAt: DAYS_AGO(400) };
    const ev = evaluateGroup(baseGroup, [staleMember], [recentVisit], noTasks);
    assert.equal(ev.scoreBreakdown.updatedRegistration, 0);
  });

  // ── R-02 ────────────────────────────────────────────────────────────────────

  it("R-02: no visit in > 90 days → VISIT_RECOMMENDED", () => {
    const oldVisit = { ...recentVisit, date: DAYS_AGO(100) };
    const ev = evaluateGroup(baseGroup, [freshMember], [oldVisit], noTasks);
    assert.ok(ev.pendencies.some(p => p.code === PENDENCY_CODES.VISIT_RECOMMENDED));
  });

  it("R-02: visit within 90 days → no VISIT_RECOMMENDED", () => {
    const ev = evaluateGroup(baseGroup, [freshMember], [recentVisit], noTasks);
    assert.ok(!ev.pendencies.some(p => p.code === PENDENCY_CODES.VISIT_RECOMMENDED));
  });

  it("R-02: recusada visit doesn't count as recent", () => {
    const refused = { ...recentVisit, desfecho: "recusada" };
    const ev = evaluateGroup(baseGroup, [freshMember], [refused], noTasks);
    assert.ok(ev.pendencies.some(p => p.code === PENDENCY_CODES.VISIT_RECOMMENDED));
    assert.equal(ev.scoreBreakdown.recentVisit, 0);
  });

  // ── R-03 ────────────────────────────────────────────────────────────────────

  it("R-03: member without CNS → MISSING_CNS (low priority)", () => {
    const noCns = { ...freshMember, cns: "" };
    const ev = evaluateGroup(baseGroup, [noCns], [recentVisit], noTasks);
    const p = ev.pendencies.find(p => p.code === PENDENCY_CODES.MISSING_CNS);
    assert.ok(p);
    assert.equal(p.priority, "low");
  });

  it("R-03: score -15 when CNS missing", () => {
    const noCns = { ...freshMember, cns: "" };
    const ev = evaluateGroup(baseGroup, [noCns], [recentVisit], noTasks);
    assert.equal(ev.scoreBreakdown.allCns, 0);
  });

  // ── R-04 ────────────────────────────────────────────────────────────────────

  it("R-04: short address → ADDRESS_VALIDATION_REQUIRED (high)", () => {
    const noAddr = { ...freshMember, address: "X" };
    const ev = evaluateGroup(baseGroup, [noAddr], [recentVisit], noTasks);
    const p = ev.pendencies.find(p => p.code === PENDENCY_CODES.ADDRESS_VALIDATION_REQUIRED);
    assert.ok(p);
    assert.equal(p.priority, "high");
  });

  it("R-04: score -15 when address incomplete", () => {
    const noAddr = { ...freshMember, address: "" };
    const ev = evaluateGroup(baseGroup, [noAddr], [recentVisit], noTasks);
    assert.equal(ev.scoreBreakdown.completeAddress, 0);
  });

  // ── R-05 ────────────────────────────────────────────────────────────────────

  it("R-05: no visit in 180 days → FAMILY_OUT_OF_FOLLOWUP (high)", () => {
    const oldVisit = { ...recentVisit, date: DAYS_AGO(200) };
    const ev = evaluateGroup(baseGroup, [freshMember], [oldVisit], noTasks);
    const p = ev.pendencies.find(p => p.code === PENDENCY_CODES.FAMILY_OUT_OF_FOLLOWUP);
    assert.ok(p);
    assert.equal(p.priority, "high");
  });

  it("R-05: visit 90 days ago still generates VISIT_RECOMMENDED but not FAMILY_OUT_OF_FOLLOWUP", () => {
    const visit95 = { ...recentVisit, date: DAYS_AGO(95) };
    const ev = evaluateGroup(baseGroup, [freshMember], [visit95], noTasks);
    assert.ok(ev.pendencies.some(p => p.code === PENDENCY_CODES.VISIT_RECOMMENDED));
    assert.ok(!ev.pendencies.some(p => p.code === PENDENCY_CODES.FAMILY_OUT_OF_FOLLOWUP));
  });

  // ── R-06 ────────────────────────────────────────────────────────────────────

  it("R-06: overdue task → OVERDUE_TASK (high)", () => {
    const overdueTask = { id: "t1", patientId: "p1", status: "pending", dueDate: DAYS_AGO(5), title: "Consulta" };
    const ev = evaluateGroup(baseGroup, [freshMember], [recentVisit], [overdueTask]);
    const p = ev.pendencies.find(p => p.code === PENDENCY_CODES.OVERDUE_TASK);
    assert.ok(p);
    assert.equal(p.priority, "high");
  });

  it("R-06: done task doesn't trigger OVERDUE_TASK", () => {
    const doneTask = { id: "t1", patientId: "p1", status: "done", dueDate: DAYS_AGO(5), title: "Consulta" };
    const ev = evaluateGroup(baseGroup, [freshMember], [recentVisit], [doneTask]);
    assert.ok(!ev.pendencies.some(p => p.code === PENDENCY_CODES.OVERDUE_TASK));
  });

  it("R-06: score -20 when overdue task exists", () => {
    const overdueTask = { id: "t1", patientId: "p1", status: "pending", dueDate: DAYS_AGO(1), title: "Consulta" };
    const ev = evaluateGroup(baseGroup, [freshMember], [recentVisit], [overdueTask]);
    assert.equal(ev.scoreBreakdown.noOverdueTasks, 0);
  });

  // ── R-07 ────────────────────────────────────────────────────────────────────

  it("R-07: new member within 30 days → NEW_MEMBER_REVIEW (medium)", () => {
    const groupWithHistory = {
      ...baseGroup,
      memberHistory: [{ action: "join", patientId: "p2", at: DAYS_AGO(15) }],
    };
    const ev = evaluateGroup(groupWithHistory, [freshMember], [recentVisit], noTasks);
    const p = ev.pendencies.find(p => p.code === PENDENCY_CODES.NEW_MEMBER_REVIEW);
    assert.ok(p);
    assert.equal(p.priority, "medium");
  });

  it("R-07: member joined > 30 days ago → no NEW_MEMBER_REVIEW", () => {
    const groupWithHistory = {
      ...baseGroup,
      memberHistory: [{ action: "join", patientId: "p2", at: DAYS_AGO(35) }],
    };
    const ev = evaluateGroup(groupWithHistory, [freshMember], [recentVisit], noTasks);
    assert.ok(!ev.pendencies.some(p => p.code === PENDENCY_CODES.NEW_MEMBER_REVIEW));
  });

  // ── R-08 ────────────────────────────────────────────────────────────────────

  it("R-08: recent transfer (<= 30 days) → TERRITORIAL_REVIEW (high)", () => {
    const groupWithTransfer = {
      ...baseGroup,
      transferHistory: [{ fromAcsId: "a1", toAcsId: "a2", transferredAt: DAYS_AGO(10) }],
    };
    const ev = evaluateGroup(groupWithTransfer, [freshMember], [recentVisit], noTasks);
    const p = ev.pendencies.find(p => p.code === PENDENCY_CODES.TERRITORIAL_REVIEW);
    assert.ok(p);
    assert.equal(p.priority, "high");
  });

  it("R-08: old transfer (> 30 days) → no TERRITORIAL_REVIEW", () => {
    const groupWithTransfer = {
      ...baseGroup,
      transferHistory: [{ fromAcsId: "a1", toAcsId: "a2", transferredAt: DAYS_AGO(45) }],
    };
    const ev = evaluateGroup(groupWithTransfer, [freshMember], [recentVisit], noTasks);
    assert.ok(!ev.pendencies.some(p => p.code === PENDENCY_CODES.TERRITORIAL_REVIEW));
  });

  // ── scoreBreakdown ───────────────────────────────────────────────────────────

  it("scoreBreakdown sums to score", () => {
    const ev = evaluateGroup(baseGroup, [freshMember], [recentVisit], noTasks);
    const sum = Object.values(ev.scoreBreakdown).reduce((a, b) => a + b, 0);
    assert.equal(sum, ev.score);
  });

  it("empty group (no members) — registration/cns/address not penalized, scores 75", () => {
    const emptyGroup = { ...baseGroup, memberPatientIds: [], memberHistory: [], transferHistory: [] };
    const ev = evaluateGroup(emptyGroup, [], [], noTasks);
    // recentVisit=0 (no visits), updatedReg=25, allCns=15, completeAddr=15, noOverdue=20 = 75
    assert.equal(ev.score, 75);
    assert.equal(ev.scoreBreakdown.updatedRegistration, 25);
    assert.equal(ev.scoreBreakdown.allCns, 15);
  });
});

// ── HTTP integration tests ────────────────────────────────────────────────────

describe("Active Search API — APS-01E", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const nurseEmail = `as-nurse-${stamp}@integration.test`;
  const acsEmail   = `as-acs-${stamp}@integration.test`;
  const password   = "AsPass@12345!";

  let nurseToken = null;
  let acsToken   = null;
  let teamId     = null;
  let groupId    = null;

  before(async () => {
    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200);
    teamId = teamsRes.json[0]?.id;
    assert.ok(teamId);

    const nurseReg = await post("/auth/register", {
      name: "Enfermeira AS",
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
      name: "ACS Busca Ativa",
      email: acsEmail,
      password,
      role: "acs",
      teamId,
    }, nurseToken);
    assert.equal(acsCreate.status, 201, JSON.stringify(acsCreate.json));
    const acsId = acsCreate.json?.id;

    const acsLogin = await post("/auth/login", { email: acsEmail, password });
    assert.equal(acsLogin.status, 200, JSON.stringify(acsLogin.json));
    acsToken = acsLogin.json?.token;

    // Create two patients at same address → family group forms
    const addr = `Rua Busca Ativa ${stamp}, 99`;
    for (const [name, cpf] of [
      ["Paciente AS Um",  `${stamp}`.slice(-11).padStart(11, "0")],
      ["Paciente AS Dois", `${stamp + 1}`.slice(-11).padStart(11, "0")],
    ]) {
      const r = await post("/patients", {
        name,
        birthDate: "1980-05-10",
        sex: "M",
        phone: "11900000000",
        cpf,
        address: addr,
        teamId,
        assignedAcsId: acsId,
      }, nurseToken);
      assert.equal(r.status, 201, JSON.stringify(r.json));
    }

    // Find the group
    const groupsRes = await get("/family-groups", acsToken);
    assert.equal(groupsRes.status, 200);
    const found = groupsRes.json.find(g => (g.address || "").includes(`${stamp}`));
    groupId = found?.id;
    assert.ok(groupId, "family group should be created automatically");
  });

  it("GET /active-search — 401 without token", async () => {
    const res = await get("/active-search");
    assert.equal(res.status, 401);
  });

  it("GET /active-search — ACS gets list", async () => {
    const res = await get("/active-search", acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json.items));
    assert.ok(typeof res.json.total === "number");
  });

  it("GET /active-search — nurse gets list", async () => {
    const res = await get("/active-search", nurseToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json.items));
  });

  it("GET /active-search — result has score, classification, pendencies", async () => {
    const res = await get("/active-search", acsToken);
    assert.equal(res.status, 200);
    const item = res.json.items.find(i => i.groupId === groupId);
    assert.ok(item, "our test group should appear");
    assert.ok(typeof item.score === "number");
    assert.ok(["saudavel", "atencao", "critico"].includes(item.classification));
    assert.ok(Array.isArray(item.pendencies));
  });

  it("GET /active-search — new patients without CNS trigger MISSING_CNS", async () => {
    const res = await get("/active-search", acsToken);
    const item = res.json.items.find(i => i.groupId === groupId);
    assert.ok(item);
    assert.ok(item.pendencies.some(p => p.code === "MISSING_CNS"), "MISSING_CNS expected");
  });

  it("GET /active-search — no recent visit → VISIT_RECOMMENDED", async () => {
    const res = await get("/active-search", acsToken);
    const item = res.json.items.find(i => i.groupId === groupId);
    assert.ok(item);
    assert.ok(
      item.pendencies.some(p => p.code === "VISIT_RECOMMENDED" || p.code === "FAMILY_OUT_OF_FOLLOWUP"),
      "visit pendency expected"
    );
  });

  it("GET /active-search?status=critico — filters by classification", async () => {
    const res = await get("/active-search?status=critico", acsToken);
    assert.equal(res.status, 200);
    assert.ok(res.json.items.every(i => i.classification === "critico"));
  });

  it("GET /active-search?status=saudavel — filters by classification", async () => {
    const res = await get("/active-search?status=saudavel", acsToken);
    assert.equal(res.status, 200);
    assert.ok(res.json.items.every(i => i.classification === "saudavel"));
  });

  it("GET /active-search?pendency=MISSING_CNS — filters by pendency code", async () => {
    const res = await get("/active-search?pendency=MISSING_CNS", acsToken);
    assert.equal(res.status, 200);
    assert.ok(res.json.items.every(i => i.pendencies.some(p => p.code === "MISSING_CNS")));
  });

  it("GET /active-search?scoreMax=50 — filters by score max", async () => {
    const res = await get("/active-search?scoreMax=50", acsToken);
    assert.equal(res.status, 200);
    assert.ok(res.json.items.every(i => i.score <= 50));
  });

  it("GET /active-search — sorted by score asc (critical first)", async () => {
    const res = await get("/active-search", acsToken);
    assert.equal(res.status, 200);
    const scores = res.json.items.map(i => i.score);
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i] >= scores[i - 1], `score at ${i} should be >= ${i - 1}`);
    }
  });

  it("GET /active-search/stats — 401 without token", async () => {
    const res = await get("/active-search/stats");
    assert.equal(res.status, 401);
  });

  it("GET /active-search/stats — returns aggregate", async () => {
    const res = await get("/active-search/stats", acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    const { total, critical, attention, healthy, avgScore, pendencyBreakdown } = res.json;
    assert.ok(typeof total === "number");
    assert.ok(typeof critical === "number");
    assert.ok(typeof attention === "number");
    assert.ok(typeof healthy === "number");
    assert.ok(typeof avgScore === "number");
    assert.ok(critical + attention + healthy === total);
    assert.ok(typeof pendencyBreakdown === "object");
  });

  it("GET /active-search/group/:id — 401 without token", async () => {
    const res = await get(`/active-search/group/${groupId}`);
    assert.equal(res.status, 401);
  });

  it("GET /active-search/group/:id — returns group evaluation", async () => {
    assert.ok(groupId);
    const res = await get(`/active-search/group/${groupId}`, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.equal(res.json.groupId, groupId);
    assert.ok(typeof res.json.score === "number");
    assert.ok(res.json.scoreBreakdown);
  });

  it("GET /active-search/group/nonexistent → 404", async () => {
    const res = await get("/active-search/group/nonexistent-xyz", acsToken);
    assert.equal(res.status, 404);
  });

  it("Score improves after recording a visit", async () => {
    // Get initial score
    const before = await get(`/active-search/group/${groupId}`, acsToken);
    const scoreBefore = before.json.score;

    // Create a visit for one of the group members
    const pRes = await get("/active-search", acsToken);
    const item = pRes.json.items.find(i => i.groupId === groupId);
    // Get a member patientId via family-groups
    const fgRes = await get(`/family-groups/${groupId}`, acsToken);
    const patientId = fgRes.json.members?.[0]?.id;
    assert.ok(patientId, "need a patient id");

    const visitRes = await post("/acs-visits", {
      patientId,
      date: TODAY,
      turno: "manha",
      desfecho: "realizada",
    }, acsToken);
    assert.equal(visitRes.status, 201, JSON.stringify(visitRes.json));

    // Score should improve (VISIT_RECOMMENDED pendency resolved)
    const after = await get(`/active-search/group/${groupId}`, acsToken);
    assert.ok(after.json.score >= scoreBefore, "score should not decrease after visit");
    assert.ok(
      !after.json.pendencies.some(p => p.code === "VISIT_RECOMMENDED"),
      "VISIT_RECOMMENDED should be gone"
    );
  });
});
