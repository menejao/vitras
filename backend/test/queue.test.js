import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch } from "./helpers.js";

describe("Queue multiuser flow", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const teamName = `Equipe Fila ${stamp}`;
  const nurseEmail = `queue-nurse-${stamp}@integration.test`;
  const receptionOneEmail = `queue-rec-1-${stamp}@integration.test`;
  const receptionTwoEmail = `queue-rec-2-${stamp}@integration.test`;
  const password = "QueuePass@67890!";

  let nurseToken = null;
  let receptionOneToken = null;
  let receptionTwoToken = null;
  let teamId = null;
  let patientId = null;
  let queueEntryId = null;

  before(async () => {
    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200);
    assert.ok(Array.isArray(teamsRes.json));
    const fallbackTeam = teamsRes.json[0];
    assert.ok(fallbackTeam?.id, "Nenhuma equipe pública disponível para teste");

    const nurseRegister = await post("/auth/register", {
      name: "Enfermeira Fila Teste",
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
    assert.ok(nurseToken, "Falha ao obter token da enfermeira");
    assert.ok(teamId, "Falha ao obter equipe da enfermeira");

    const receptionOneRegister = await post("/auth/register", {
      name: "Recepção Fila Um",
      email: receptionOneEmail,
      password,
      role: "receptionist",
      teamId
    });
    assert.equal(receptionOneRegister.status, 201, JSON.stringify(receptionOneRegister.json));
    receptionOneToken = receptionOneRegister.json?.token || null;
    assert.ok(receptionOneToken, "Falha ao obter token da primeira recepção");

    const receptionTwoRegister = await post("/auth/register", {
      name: "Recepção Fila Dois",
      email: receptionTwoEmail,
      password,
      role: "receptionist",
      teamId
    });
    assert.equal(receptionTwoRegister.status, 201, JSON.stringify(receptionTwoRegister.json));
    receptionTwoToken = receptionTwoRegister.json?.token || null;
    assert.ok(receptionTwoToken, "Falha ao obter token da segunda recepção");

    const patientCreate = await post("/patients", {
      name: "Paciente Fila Integração",
      teamId,
      phone: "(11)90000-0099",
      careCategory: "general",
      cns: "12345745892345"
    }, nurseToken);
    assert.equal(patientCreate.status, 201, JSON.stringify(patientCreate.json));
    patientId = patientCreate.json?.id || null;
    assert.ok(patientId, "Paciente de teste não foi criado");
  });

  it("allows one receptionist to create and another to see the queue entry", async () => {
    const createRes = await post("/queue", {
      patientId,
      priority: "normal",
      reason: "Teste multiusuário",
      demandType: "spontaneous"
    }, receptionOneToken);
    assert.equal(createRes.status, 201, JSON.stringify(createRes.json));
    queueEntryId = createRes.json?.id || null;
    assert.ok(queueEntryId, "Entrada de fila sem id");

    const readRes = await get("/queue", receptionTwoToken);
    assert.equal(readRes.status, 200);
    assert.ok(Array.isArray(readRes.json));
    assert.ok(readRes.json.some((entry) => entry.id === queueEntryId), "Segunda sessão não enxergou a fila");
  });

  it("blocks duplicate active entries for the same patient", async () => {
    const duplicateRes = await post("/queue", {
      patientId,
      priority: "normal",
      reason: "Duplicado",
      demandType: "spontaneous"
    }, receptionTwoToken);
    assert.equal(duplicateRes.status, 409, JSON.stringify(duplicateRes.json));
  });

  it("propagates status updates across sessions", async () => {
    assert.ok(queueEntryId, "Entrada da fila não criada");
    const updateRes = await patch(`/queue/${queueEntryId}`, { status: "attending" }, receptionTwoToken);
    assert.equal(updateRes.status, 200, JSON.stringify(updateRes.json));

    const readRes = await get("/queue", receptionOneToken);
    assert.equal(readRes.status, 200);
    const item = readRes.json.find((entry) => entry.id === queueEntryId);
    assert.ok(item, "Primeira sessão não enxergou a atualização");
    assert.equal(item.status, "attending");
  });
});
