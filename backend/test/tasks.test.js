import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";

describe("Tasks — SEC-API-01D", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const nurseEmail = `tasks-sec01d-nurse-${stamp}@integration.test`;
  const acsEmail   = `tasks-sec01d-acs-${stamp}@integration.test`;
  const acs2Email  = `tasks-sec01d-acs2-${stamp}@integration.test`;
  const password   = "TasksSec01d@12345!";

  let nurseToken = null;
  let acsToken   = null;
  let acs2Token  = null;
  let taskId     = null;
  let patientId  = null;
  let acsId      = null;
  let acsId2     = null;
  let teamId     = null;

  before(async () => {
    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200, "teams/public must work");
    const team = teamsRes.json[0];
    assert.ok(team?.id, "team must exist");
    teamId = team.id;

    // Register nurse_manager
    const nurseReg = await post("/auth/register", {
      name: "Enfermeira Tasks SEC01D",
      email: nurseEmail,
      password,
      role: "nurse_manager",
      teamId,
      councilNumber: `${stamp}`.slice(-6),
      councilUf: "SP"
    });
    assert.equal(nurseReg.status, 201, `nurse register: ${JSON.stringify(nurseReg.json)}`);
    nurseToken = nurseReg.json?.token;
    teamId = nurseReg.json?.user?.teamId || teamId;

    // Create ACS #1 via nurse_manager
    const acs1Create = await post("/users", {
      name: "ACS Tarefas SEC01D Um",
      email: acsEmail,
      password,
      role: "acs",
      teamId,
    }, nurseToken);
    assert.equal(acs1Create.status, 201, `acs1 create: ${JSON.stringify(acs1Create.json)}`);
    acsId = acs1Create.json?.id;
    assert.ok(acsId, "acsId must be set");

    const acs1Login = await post("/auth/login", { email: acsEmail, password });
    assert.equal(acs1Login.status, 200, `acs1 login: ${JSON.stringify(acs1Login.json)}`);
    acsToken = acs1Login.json?.token;

    // Create ACS #2 (same team, task NOT assigned to them)
    const acs2Create = await post("/users", {
      name: "ACS Tarefas SEC01D Dois",
      email: acs2Email,
      password,
      role: "acs",
      teamId,
    }, nurseToken);
    assert.equal(acs2Create.status, 201, `acs2 create: ${JSON.stringify(acs2Create.json)}`);
    acsId2 = acs2Create.json?.id;

    const acs2Login = await post("/auth/login", { email: acs2Email, password });
    assert.equal(acs2Login.status, 200, `acs2 login: ${JSON.stringify(acs2Login.json)}`);
    acs2Token = acs2Login.json?.token;

    // Create a patient
    const patCreate = await post("/patients", {
      name: "Paciente Tarefas SEC01D",
      birthDate: "1990-01-15",
      sex: "F",
      phone: "11999990001",
      cpf: `${stamp}`.slice(-11).padStart(11, "0"),
      teamId,
      assignedAcsId: acsId,
    }, nurseToken);
    assert.equal(patCreate.status, 201, `patient create: ${JSON.stringify(patCreate.json)}`);
    patientId = patCreate.json?.id;
    assert.ok(patientId, "patientId must be set");

    // Create task assigned to ACS #1
    const taskCreate = await post("/tasks", {
      patientId,
      assigneeId: acsId,
      title: "Visitar paciente SEC01D",
      dueDate: "2026-12-31"
    }, nurseToken);
    assert.equal(taskCreate.status, 201, `task create: ${JSON.stringify(taskCreate.json)}`);
    taskId = taskCreate.json?.id;
    assert.ok(taskId, "taskId must be set");
  });

  // ── GET /tasks/:id ──────────────────────────────────────────────────────────

  it("GET /tasks/:id — nurse_manager returns 200 with task data", async () => {
    const res = await get(`/tasks/${taskId}`, nurseToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.equal(res.json.id, taskId);
    assert.equal(res.json.patientId, patientId);
    assert.equal(res.json.assigneeId, acsId);
  });

  it("GET /tasks/:id — assigned ACS returns 200", async () => {
    const res = await get(`/tasks/${taskId}`, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.equal(res.json.id, taskId);
  });

  it("GET /tasks/:id — non-assigned ACS returns 404 (task not theirs)", async () => {
    const res = await get(`/tasks/${taskId}`, acs2Token);
    assert.equal(res.status, 404, JSON.stringify(res.json));
  });

  it("GET /tasks/:id — unknown id returns 404", async () => {
    const res = await get("/tasks/nonexistent-task-id-xyz", nurseToken);
    assert.equal(res.status, 404, JSON.stringify(res.json));
  });

  it("GET /tasks/:id — unauthenticated returns 401", async () => {
    const res = await get(`/tasks/${taskId}`);
    assert.equal(res.status, 401);
  });

  // ── GET /tasks?assigneeId filter ────────────────────────────────────────────

  it("GET /tasks?assigneeId — returns only tasks for that ACS", async () => {
    const res = await get(`/tasks?assigneeId=${acsId}`, nurseToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json), "must be array");
    assert.ok(res.json.length >= 1, "must have at least 1 task");
    assert.ok(res.json.every(t => t.assigneeId === acsId), "all tasks must belong to acsId");
    assert.ok(res.json.some(t => t.id === taskId), "must include created task");
  });

  it("GET /tasks?assigneeId — ACS can query own tasks", async () => {
    const res = await get(`/tasks?assigneeId=${acsId}`, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json));
    assert.ok(res.json.some(t => t.id === taskId));
  });
});
