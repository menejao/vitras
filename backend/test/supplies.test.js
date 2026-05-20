import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { get, post, startTestServer, stopTestServer } from "./helpers.js";

describe("Supplies multiuser flow", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const nurseEmail = `supplies-nurse-${stamp}@integration.test`;
  const techEmail = `supplies-tech-${stamp}@integration.test`;
  const password = "SuppliesPass@67890!";

  let nurseToken = null;
  let techToken = null;
  let teamId = null;
  let patientId = null;

  before(async () => {
    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200);
    const fallbackTeam = teamsRes.json[0];
    assert.ok(fallbackTeam?.id);
    teamId = fallbackTeam.id;

    const { withDb } = await import("../src/db.js");
    const { hashPassword } = await import("../src/services/crypto.js");
    const { ensureDbShape } = await import("../src/utils/domain.js");

    const nurseId = randomUUID();
    const techId = randomUUID();
    patientId = randomUUID();

    await withDb((db) => {
      ensureDbShape(db);
      db.users.push(
        {
          id: nurseId,
          name: "Enfermeira Integracao Insumos",
          email: nurseEmail,
          password: hashPassword(password),
          role: "nurse_manager",
          teamId,
          councilType: "COREN",
          councilNumber: `${stamp}`.slice(-6),
          councilUf: "SP",
          twoFactorEnabled: false,
          twoFactorSecret: "",
          twoFactorPendingSecret: "",
          twoFactorPendingCreatedAt: "",
          createdAt: new Date().toISOString(),
        },
        {
          id: techId,
          name: "Tecnica Integracao Insumos",
          email: techEmail,
          password: hashPassword(password),
          role: "nursing_tech",
          teamId,
          twoFactorEnabled: false,
          twoFactorSecret: "",
          twoFactorPendingSecret: "",
          twoFactorPendingCreatedAt: "",
          createdAt: new Date().toISOString(),
        }
      );
      db.patients.push({
        id: patientId,
        name: "Paciente Insumos Integracao",
        teamId,
        phone: "(11)90000-0099",
        careCategory: "general",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    const nurseLogin = await post("/auth/login", { email: nurseEmail, password });
    assert.equal(nurseLogin.status, 200, JSON.stringify(nurseLogin.json));
    nurseToken = nurseLogin.json?.token || null;

    const techLogin = await post("/auth/login", { email: techEmail, password });
    assert.equal(techLogin.status, 200, JSON.stringify(techLogin.json));
    techToken = techLogin.json?.token || null;
    assert.ok(nurseToken);
    assert.ok(techToken);
  });

  it("shares stock, dispense and continuous tracking across sessions", async () => {
    const initialRead = await get("/supplies/stock", techToken);
    assert.equal(initialRead.status, 200);
    assert.ok(initialRead.json.length > 0);
    const stockItemId = initialRead.json[0].id;

    const adjustRes = await post(`/supplies/stock/${stockItemId}/adjust`, {
      qty: 40,
    }, nurseToken);
    assert.equal(adjustRes.status, 200, JSON.stringify(adjustRes.json));
    assert.equal(adjustRes.json.qty, 40);

    const confirmRead = await get("/supplies/stock", techToken);
    assert.equal(confirmRead.status, 200);
    const sharedStock = confirmRead.json.find((item) => item.id === stockItemId);
    assert.ok(sharedStock);
    assert.equal(sharedStock.qty, 40);

    const dispenseRes = await post("/supplies/dispense", {
      patientId,
      continuo: true,
      obs: "Retirada mensal de teste",
      items: [{ id: stockItemId, qty: 5 }],
    }, techToken);
    assert.equal(dispenseRes.status, 201, JSON.stringify(dispenseRes.json));

    const logsRead = await get("/supplies/logs", nurseToken);
    assert.equal(logsRead.status, 200);
    assert.ok(logsRead.json.some((entry) => entry.patientId === patientId && entry.type === "dispensa"));

    const continuousRead = await get("/supplies/continuous", nurseToken);
    assert.equal(continuousRead.status, 200);
    const current = continuousRead.json.find((entry) => entry.patientId === patientId && entry.ativo);
    assert.ok(current);

    const closeRes = await post(`/supplies/continuous/${current.id}/close`, { reason: "Alta clínica do acompanhamento" }, nurseToken);
    assert.equal(closeRes.status, 200, JSON.stringify(closeRes.json));
    assert.equal(closeRes.json.ativo, false);

    const relogin = await post("/auth/login", { email: techEmail, password });
    assert.equal(relogin.status, 200, JSON.stringify(relogin.json));
    const reloginToken = relogin.json?.token || null;
    assert.ok(reloginToken);

    const finalRead = await get("/supplies/stock", reloginToken);
    assert.equal(finalRead.status, 200);
    const finalStock = finalRead.json.find((item) => item.id === stockItemId);
    assert.ok(finalStock);
    assert.equal(finalStock.qty, 35);
  });
});
