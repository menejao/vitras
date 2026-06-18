import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch, req } from "./helpers.js";

describe("Family Group Workspace — APS-01D", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const nurseEmail  = `fg-ws-nurse-${stamp}@integration.test`;
  const acsEmail    = `fg-ws-acs-${stamp}@integration.test`;
  const password    = "FgWsPass@12345!";

  let nurseToken = null;
  let acsToken   = null;
  let teamId     = null;
  let patient1Id = null;
  let patient2Id = null;
  let groupId    = null;

  before(async () => {
    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200);
    teamId = teamsRes.json[0]?.id;
    assert.ok(teamId);

    // Nurse
    const nurseReg = await post("/auth/register", {
      name: "Enfermeira FG Workspace",
      email: nurseEmail,
      password,
      role: "nurse_manager",
      teamId,
      councilNumber: `${stamp}`.slice(-6),
      councilUf: "SP"
    });
    assert.equal(nurseReg.status, 201, JSON.stringify(nurseReg.json));
    nurseToken = nurseReg.json?.token;
    teamId = nurseReg.json?.user?.teamId || teamId;

    // ACS
    const acsCreate = await post("/users", {
      name: "ACS FG Workspace",
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

    // Two patients at the SAME address → same family group
    const sharedAddress = "Rua das Flores, 123";
    const p1 = await post("/patients", {
      name: "Paciente FG Um",
      birthDate: "1970-01-15",
      sex: "F",
      phone: "11911111111",
      cpf: `${stamp}`.slice(-11).padStart(11, "0"),
      address: sharedAddress,
      teamId,
      assignedAcsId: acsId,
    }, nurseToken);
    assert.equal(p1.status, 201, JSON.stringify(p1.json));
    patient1Id = p1.json?.id;

    const p2 = await post("/patients", {
      name: "Paciente FG Dois",
      birthDate: "2000-06-10",
      sex: "M",
      phone: "11922222222",
      cpf: `${stamp + 1}`.slice(-11).padStart(11, "0"),
      address: sharedAddress,
      teamId,
      assignedAcsId: acsId,
    }, nurseToken);
    assert.equal(p2.status, 201, JSON.stringify(p2.json));
    patient2Id = p2.json?.id;
  });

  // ── GET /family-groups (list) ────────────────────────────────────────────

  it("GET /family-groups — ACS sees groups with shared address", async () => {
    const res = await get("/family-groups", acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json));

    const group = res.json.find(g =>
      g.memberPatientIds?.includes(patient1Id) && g.memberPatientIds?.includes(patient2Id)
    );
    assert.ok(group, "group with both patients should exist");
    groupId = group.id;
  });

  it("GET /family-groups — unauthenticated → 401", async () => {
    const res = await get("/family-groups");
    assert.equal(res.status, 401);
  });

  it("GET /family-groups?q=flores — search by address", async () => {
    const res = await get("/family-groups?q=flores", acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json));
    assert.ok(res.json.some(g => g.memberPatientIds?.includes(patient1Id)));
  });

  it("GET /family-groups?q=FG Um — search by patient name", async () => {
    const res = await get("/family-groups?q=FG+Um", acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json));
    assert.ok(res.json.some(g => g.memberPatientIds?.includes(patient1Id)));
  });

  // ── GET /family-groups/:id (workspace) ──────────────────────────────────

  it("GET /family-groups/:id — ACS gets enriched workspace", async () => {
    assert.ok(groupId, "groupId must be set from list test");
    const res = await get(`/family-groups/${groupId}`, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));

    const { group, members, visits, tasks, pendencies, timeline } = res.json;
    assert.ok(group?.id, "group.id present");
    assert.ok(Array.isArray(members), "members is array");
    assert.ok(Array.isArray(visits), "visits is array");
    assert.ok(Array.isArray(tasks), "tasks is array");
    assert.ok(Array.isArray(pendencies), "pendencies is array");
    assert.ok(Array.isArray(timeline), "timeline is array");

    assert.ok(members.some(m => m.id === patient1Id), "patient1 in members");
    assert.ok(members.some(m => m.id === patient2Id), "patient2 in members");
  });

  it("GET /family-groups/:id — nurse can access team groups", async () => {
    assert.ok(groupId, "groupId must be set");
    const res = await get(`/family-groups/${groupId}`, nurseToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
  });

  it("GET /family-groups/:id — not found → 404", async () => {
    const res = await get("/family-groups/nonexistent-group-xyz", acsToken);
    assert.equal(res.status, 404);
  });

  it("GET /family-groups/:id — unauthenticated → 401", async () => {
    assert.ok(groupId, "groupId must be set");
    const res = await get(`/family-groups/${groupId}`);
    assert.equal(res.status, 401);
  });

  it("GET /family-groups/:id — members have ageYears field", async () => {
    assert.ok(groupId, "groupId must be set");
    const res = await get(`/family-groups/${groupId}`, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    const withAge = res.json.members.filter(m => m.ageYears != null);
    assert.ok(withAge.length > 0, "at least one member has ageYears");
  });

  it("GET /family-groups/:id — pendencies include missing_cns (no CNS set)", async () => {
    assert.ok(groupId, "groupId must be set");
    const res = await get(`/family-groups/${groupId}`, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    // Patients created without CNS — should have missing_cns pendency
    assert.ok(
      res.json.pendencies.some(p => p.type === "missing_cns"),
      "missing_cns pendency expected"
    );
  });

  it("GET /family-groups/:id — no-recent-visit pendency present", async () => {
    assert.ok(groupId, "groupId must be set");
    const res = await get(`/family-groups/${groupId}`, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(
      res.json.pendencies.some(p => p.type === "no_recent_visit"),
      "no_recent_visit pendency expected"
    );
  });

  it("GET /family-groups/:id — timeline includes group_created", async () => {
    assert.ok(groupId, "groupId must be set");
    const res = await get(`/family-groups/${groupId}`, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(
      res.json.timeline.some(ev => ev.type === "group_created"),
      "group_created event expected in timeline"
    );
  });

  // ── Auto-grouping: new patient at same address joins group ───────────────

  it("New patient at same address auto-joins existing group", async () => {
    assert.ok(groupId, "groupId must be set");
    const stamp2 = Date.now() + 5000;
    const p3 = await post("/patients", {
      name: "Paciente FG Tres",
      birthDate: "1985-03-20",
      sex: "F",
      phone: "11933333333",
      cpf: `${stamp2}`.slice(-11).padStart(11, "0"),
      address: "Rua das Flores, 123",
      teamId,
    }, nurseToken);
    assert.equal(p3.status, 201, JSON.stringify(p3.json));
    const patient3Id = p3.json?.id;

    const groupsRes = await get("/family-groups", nurseToken);
    assert.equal(groupsRes.status, 200);
    const origGroup = groupsRes.json.find(g => g.id === groupId);
    assert.ok(origGroup, "original group still exists");
    assert.ok(origGroup.memberPatientIds?.includes(patient3Id), "patient3 auto-joined group");
  });
});
