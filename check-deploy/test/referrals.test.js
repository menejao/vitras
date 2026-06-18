import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch, req } from "./helpers.js";

describe("Referrals multiuser flow", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const nurseEmail = `referrals-nurse-${stamp}@integration.test`;
  const doctorEmail = `referrals-doctor-${stamp}@integration.test`;
  const password = "ReferralsPass@67890!";

  let nurseToken = null;
  let doctorToken = null;
  let teamId = null;
  let patientId = null;
  let referralId = null;

  before(async () => {
    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200);
    const fallbackTeam = teamsRes.json[0];
    assert.ok(fallbackTeam?.id);

    const nurseRegister = await post("/auth/register", {
      name: "Enfermeira Referral Teste",
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

    const doctorRegister = await post("/auth/register", {
      name: "Médico Referral Teste",
      email: doctorEmail,
      password,
      role: "doctor",
      teamId,
      councilNumber: `${stamp + 1}`.slice(-6),
      councilUf: "SP"
    });
    assert.equal(doctorRegister.status, 201, JSON.stringify(doctorRegister.json));
    doctorToken = doctorRegister.json?.token || null;

    const patientCreate = await post("/patients", {
      name: "Paciente Referral Integração",
      teamId,
      phone: "(11)90000-0097",
      careCategory: "general"
    }, nurseToken);
    assert.equal(patientCreate.status, 201, JSON.stringify(patientCreate.json));
    patientId = patientCreate.json?.id || null;
    assert.ok(patientId);
  });

  it("allows one professional to create and another to read/update referrals", async () => {
    const createRes = await post("/referrals", {
      patientId,
      specialty: "Cardiologia",
      reason: "Dor torácica recorrente",
      priority: "priority",
      date: "2026-05-21",
      notes: "Paciente com histórico familiar.",
      status: "pending"
    }, nurseToken);
    assert.equal(createRes.status, 201, JSON.stringify(createRes.json));
    referralId = createRes.json?.id || null;
    assert.ok(referralId);

    const readRes = await get("/referrals", doctorToken);
    assert.equal(readRes.status, 200);
    assert.ok(readRes.json.some((entry) => entry.id === referralId));

    const updateRes = await patch(`/referrals/${referralId}`, { status: "scheduled" }, doctorToken);
    assert.equal(updateRes.status, 200, JSON.stringify(updateRes.json));

    const confirmRes = await get("/referrals", nurseToken);
    assert.equal(confirmRes.status, 200);
    const item = confirmRes.json.find((entry) => entry.id === referralId);
    assert.ok(item);
    assert.equal(item.status, "scheduled");
  });

  it("preserves referrals after relogin and allows delete", async () => {
    assert.ok(referralId);

    const relogin = await post("/auth/login", { email: nurseEmail, password });
    assert.equal(relogin.status, 200, JSON.stringify(relogin.json));
    const reloginToken = relogin.json?.token || null;
    assert.ok(reloginToken);

    const readAfterRelogin = await get("/referrals", reloginToken);
    assert.equal(readAfterRelogin.status, 200);
    assert.ok(readAfterRelogin.json.some((entry) => entry.id === referralId));

    const deleteRes = await req("DELETE", `/referrals/${referralId}`, null, reloginToken);
    assert.equal(deleteRes.status, 200, JSON.stringify(deleteRes.json));

    const finalRead = await get("/referrals", doctorToken);
    assert.equal(finalRead.status, 200);
    assert.ok(!finalRead.json.some((entry) => entry.id === referralId));
  });
});
