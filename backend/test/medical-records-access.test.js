import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";

describe("Medical records access verification", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const nurseEmail = `chart-nurse-${stamp}@integration.test`;
  const receptionistEmail = `chart-reception-${stamp}@integration.test`;
  const password = "ChartPass@67890!";

  let nurseToken = null;
  let receptionistToken = null;
  let teamId = null;
  let patientId = null;
  let withDbFn = null;
  let ensureDbShapeFn = null;
  let hashPasswordFn = null;

  before(async () => {
    const dbModule = await import("../src/db.js");
    const domainModule = await import("../src/utils/domain.js");
    const cryptoModule = await import("../src/services/crypto.js");
    withDbFn = dbModule.withDb;
    ensureDbShapeFn = domainModule.ensureDbShape;
    hashPasswordFn = cryptoModule.hashPassword;

    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200);
    const fallbackTeam = teamsRes.json[0];
    assert.ok(fallbackTeam?.id);

    const nurseRegister = await post("/auth/register", {
      name: "Enfermeira Chart Teste",
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

    await withDbFn((db) => {
      ensureDbShapeFn(db);
      db.users.push({
        id: `reception-${stamp}`,
        name: "Recepcao Chart Teste",
        email: receptionistEmail,
        password: hashPasswordFn(password),
        role: "receptionist",
        teamId,
        teamName: "Equipe teste",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    const receptionistLogin = await post("/auth/login", {
      email: receptionistEmail,
      password
    });
    assert.equal(receptionistLogin.status, 200, JSON.stringify(receptionistLogin.json));
    receptionistToken = receptionistLogin.json?.token || null;

    const patientCreate = await post("/patients", {
      name: "Paciente Chart Integracao",
      teamId,
      phone: "(11)90000-0088",
      careCategory: "general"
    }, nurseToken);
    assert.equal(patientCreate.status, 201, JSON.stringify(patientCreate.json));
    patientId = patientCreate.json?.id || null;
    assert.ok(patientId);
  });

  it("authorizes chart access with correct password", async () => {
    const verifyRes = await post("/medical-records/access/verify", {
      patientId,
      password
    }, nurseToken);

    assert.equal(verifyRes.status, 200, JSON.stringify(verifyRes.json));
    assert.equal(verifyRes.json?.ok, true);
  });

  it("rejects wrong password with 422", async () => {
    const verifyRes = await post("/medical-records/access/verify", {
      patientId,
      password: "senha-errada"
    }, nurseToken);

    assert.equal(verifyRes.status, 422, JSON.stringify(verifyRes.json));
  });

  it("rejects unauthorized profile with 403", async () => {
    const verifyRes = await post("/medical-records/access/verify", {
      patientId,
      password
    }, receptionistToken);

    assert.equal(verifyRes.status, 403, JSON.stringify(verifyRes.json));
  });
});
