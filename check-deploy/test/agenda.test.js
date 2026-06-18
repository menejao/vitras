import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch, req } from "./helpers.js";

describe("Agenda multiuser flow", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const nurseEmail = `agenda-nurse-${stamp}@integration.test`;
  const recOneEmail = `agenda-rec-1-${stamp}@integration.test`;
  const recTwoEmail = `agenda-rec-2-${stamp}@integration.test`;
  const password = "AgendaPass@67890!";

  let nurseToken = null;
  let recOneToken = null;
  let recTwoToken = null;
  let teamId = null;
  let patientId = null;
  let agendaId = null;

  before(async () => {
    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200);
    const fallbackTeam = teamsRes.json[0];
    assert.ok(fallbackTeam?.id);

    const nurseRegister = await post("/auth/register", {
      name: "Enfermeira Agenda Teste",
      email: nurseEmail,
      password,
      role: "nurse_manager",
      teamId: fallbackTeam.id,
      councilNumber: `${stamp}`.slice(-6),
      councilUf: "SP"
    });
    assert.equal(nurseRegister.status, 201, JSON.stringify(nurseRegister.json));
    nurseToken = nurseRegister.json?.token || null;
    teamId = nurseRegister.json?.user?.teamId || fallbackTeam.id;

    const recOneRegister = await post("/auth/register", {
      name: "Recepção Agenda Um",
      email: recOneEmail,
      password,
      role: "receptionist",
      teamId
    });
    assert.equal(recOneRegister.status, 201, JSON.stringify(recOneRegister.json));
    recOneToken = recOneRegister.json?.token || null;

    const recTwoRegister = await post("/auth/register", {
      name: "Recepção Agenda Dois",
      email: recTwoEmail,
      password,
      role: "receptionist",
      teamId
    });
    assert.equal(recTwoRegister.status, 201, JSON.stringify(recTwoRegister.json));
    recTwoToken = recTwoRegister.json?.token || null;

    const patientCreate = await post("/patients", {
      name: "Paciente Agenda Integração",
      teamId,
      phone: "(11)90000-0098",
      careCategory: "general"
    }, nurseToken);
    assert.equal(patientCreate.status, 201, JSON.stringify(patientCreate.json));
    patientId = patientCreate.json?.id || null;
    assert.ok(patientId);
  });

  it("allows one receptionist to create and another to read/update agenda", async () => {
    const createRes = await post("/agenda", {
      patientId,
      date: "2026-05-20",
      time: "09:00",
      type: "consultation",
      status: "scheduled",
      notes: "Teste multiusuário"
    }, recOneToken);
    assert.equal(createRes.status, 201, JSON.stringify(createRes.json));
    agendaId = createRes.json?.id || null;
    assert.ok(agendaId);

    const readRes = await get("/agenda", recTwoToken);
    assert.equal(readRes.status, 200);
    assert.ok(readRes.json.some((entry) => entry.id === agendaId));

    const updateRes = await patch(`/agenda/${agendaId}`, { status: "arrived" }, recTwoToken);
    assert.equal(updateRes.status, 200, JSON.stringify(updateRes.json));

    const confirmRes = await get("/agenda", recOneToken);
    assert.equal(confirmRes.status, 200);
    const item = confirmRes.json.find((entry) => entry.id === agendaId);
    assert.ok(item);
    assert.equal(item.status, "arrived");
  });

  it("preserves agenda after relogin and allows delete", async () => {
    assert.ok(agendaId);

    const relogin = await post("/auth/login", { email: recOneEmail, password });
    assert.equal(relogin.status, 200, JSON.stringify(relogin.json));
    const reloginToken = relogin.json?.token || null;
    assert.ok(reloginToken);

    const readAfterRelogin = await get("/agenda", reloginToken);
    assert.equal(readAfterRelogin.status, 200);
    assert.ok(readAfterRelogin.json.some((entry) => entry.id === agendaId));

    const deleteRes = await req("DELETE", `/agenda/${agendaId}`, null, reloginToken);
    assert.equal(deleteRes.status, 200, JSON.stringify(deleteRes.json));

    const finalRead = await get("/agenda", recTwoToken);
    assert.equal(finalRead.status, 200);
    assert.ok(!finalRead.json.some((entry) => entry.id === agendaId));
  });
});
