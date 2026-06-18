import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { get, patch, post, startTestServer, stopTestServer } from "./helpers.js";

describe("Pharmacy multiuser flow", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const managerEmail = `pharmacy-manager-${stamp}@integration.test`;
  const pharmacistEmail = `pharmacy-pharmacist-${stamp}@integration.test`;
  const readerEmail = `pharmacy-reader-${stamp}@integration.test`;
  const password = "PharmacyPass@67890!";

  let pharmacistToken = null;
  let readerToken = null;
  let teamId = null;
  let patientId = null;
  let stockItemId = null;
  let managerUserId = null;

  before(async () => {
    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200);
    const fallbackTeam = teamsRes.json[0];
    assert.ok(fallbackTeam?.id);
    teamId = fallbackTeam.id;

    const { withDb } = await import("../src/db.js");
    const { hashPassword } = await import("../src/services/crypto.js");
    const { ensureDbShape } = await import("../src/utils/domain.js");
    managerUserId = randomUUID();
    const pharmacistUserId = randomUUID();
    const readerUserId = randomUUID();
    patientId = randomUUID();

    await withDb((db) => {
      ensureDbShape(db);
      db.users.push(
        {
          id: managerUserId,
          name: "Enfermeira Integracao Farmacia",
          email: managerEmail,
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
          id: pharmacistUserId,
          name: "Farmaceutica Integracao",
          email: pharmacistEmail,
          password: hashPassword(password),
          role: "pharmacist",
          teamId,
          councilType: "CFF",
          councilNumber: `${stamp + 2}`.slice(-6),
          councilUf: "SP",
          twoFactorEnabled: false,
          twoFactorSecret: "",
          twoFactorPendingSecret: "",
          twoFactorPendingCreatedAt: "",
          createdAt: new Date().toISOString(),
        },
        {
          id: readerUserId,
          name: "Tecnico Farmacia Integracao",
          email: readerEmail,
          password: hashPassword(password),
          role: "pharmacy_tech",
          teamId,
          councilType: "CFF",
          councilNumber: `${stamp + 1}`.slice(-6),
          councilUf: "SP",
          twoFactorEnabled: false,
          twoFactorSecret: "",
          twoFactorPendingSecret: "",
          twoFactorPendingCreatedAt: "",
          createdAt: new Date().toISOString(),
        },
      );
      db.patients.push({
        id: patientId,
        name: "Paciente Farmacia Integracao",
        teamId,
        phone: "(11)90000-0042",
        careCategory: "general",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    const pharmacistLogin = await post("/auth/login", { email: pharmacistEmail, password });
    assert.equal(pharmacistLogin.status, 200, JSON.stringify(pharmacistLogin.json));
    pharmacistToken = pharmacistLogin.json?.token || null;
    assert.ok(pharmacistLogin.json?.user?.capabilities?.includes("pharmacy.write"), JSON.stringify(pharmacistLogin.json));

    const readerLogin = await post("/auth/login", { email: readerEmail, password });
    assert.equal(readerLogin.status, 200, JSON.stringify(readerLogin.json));
    readerToken = readerLogin.json?.token || null;
    assert.ok(pharmacistToken);
    assert.ok(readerToken);
  });

  it("shares stock between sessions and persists updates", async () => {
    const initialRead = await get("/pharmacy/stock", readerToken);
    assert.equal(initialRead.status, 200);
    assert.ok(Array.isArray(initialRead.json));
    assert.ok(initialRead.json.length > 0);

    const createRes = await post("/pharmacy/stock", {
      name: "Medicamento Integracao Farmacia",
      category: "Teste",
      unit: "comprimido",
      qty: 30,
      minQty: 5,
      location: "Prateleira T1",
    }, pharmacistToken);
    assert.equal(createRes.status, 201, JSON.stringify(createRes.json));
    stockItemId = createRes.json?.id || null;
    assert.ok(stockItemId);

    const readAfterCreate = await get("/pharmacy/stock", readerToken);
    assert.equal(readAfterCreate.status, 200);
    assert.ok(readAfterCreate.json.some((item) => item.id === stockItemId));

    const forbiddenWrite = await post("/pharmacy/stock", {
      name: "Nao Pode",
      category: "Teste",
      unit: "comprimido",
      qty: 1,
      minQty: 1,
      location: "Prateleira Z9",
    }, readerToken);
    assert.equal(forbiddenWrite.status, 403);

    const adjustRes = await post(`/pharmacy/stock/${stockItemId}/adjust`, {
      delta: -4,
      reason: "Ajuste de contagem",
    }, pharmacistToken);
    assert.equal(adjustRes.status, 200, JSON.stringify(adjustRes.json));
    assert.equal(adjustRes.json.qty, 26);

    const metadataRes = await patch(`/pharmacy/stock/${stockItemId}`, {
      minQty: 7,
      location: "Prateleira T2",
    }, pharmacistToken);
    assert.equal(metadataRes.status, 200, JSON.stringify(metadataRes.json));
    assert.equal(metadataRes.json.minQty, 7);

    const dispenseRes = await post("/pharmacy/dispense", {
      itemId: stockItemId,
      qty: 3,
      patientId,
      prescriberId: managerUserId,
      numReceita: "RX-12345",
      lote: "L-01",
      dtReceita: "2026-05-17",
      notes: "Dispensacao de teste",
    }, pharmacistToken);
    assert.equal(dispenseRes.status, 201, JSON.stringify(dispenseRes.json));
    assert.equal(dispenseRes.json?.stockItem?.qty, 23);

    const logsRead = await get("/pharmacy/logs", readerToken);
    assert.equal(logsRead.status, 200);
    assert.ok(logsRead.json.some((entry) => entry.type === "dispensa" && entry.itemId === stockItemId));

    const relogin = await post("/auth/login", { email: pharmacistEmail, password });
    assert.equal(relogin.status, 200, JSON.stringify(relogin.json));
    const reloginToken = relogin.json?.token || null;
    assert.ok(reloginToken);

    const readAfterRelogin = await get("/pharmacy/stock", reloginToken);
    assert.equal(readAfterRelogin.status, 200);
    const current = readAfterRelogin.json.find((item) => item.id === stockItemId);
    assert.ok(current);
    assert.equal(current.qty, 23);
  });
});
