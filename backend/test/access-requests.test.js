import test from "node:test";
import assert from "node:assert/strict";
import { post, get, startTestServer, stopTestServer } from "./helpers.js";

test("access requests flow persists submission and approval decision", async () => {
  await startTestServer();

  const created = await post("/auth/access-requests", {
    name: "Profissional Solicitação",
    email: `solicitacao-${Date.now()}@ubs.local`,
    jobTitle: "doctor"
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.status, "pending");

  const login = await post("/auth/login", { email: "ana@clinica.local", password: "123456" });
  const token = login.json.token || login.json.accessToken;

  const deniedList = await get("/auth/access-requests", token);
  assert.equal(deniedList.status, 403);

  const gestorRegister = await post("/auth/register", {
    name: "Gestor Solicitações",
    email: `gestor-access-${Date.now()}@ubs.local`,
    password: "TestPass@12345!",
    role: "gestor",
    councilNumber: "874231",
    councilUf: "SP"
  });
  assert.equal(gestorRegister.status, 201);
  const gestorToken = gestorRegister.json.token || gestorRegister.json.accessToken;

  const listed = await get("/auth/access-requests", gestorToken);
  assert.equal(listed.status, 200);
  assert.ok(Array.isArray(listed.json.requests));
  assert.equal(listed.json.requests[0].status, "pending");

  const approved = await post(`/auth/access-requests/${created.json.id}/approve`, {}, gestorToken);
  assert.equal(approved.status, 200);
  assert.equal(approved.json.status, "approved");
});

test.after(async () => {
  await stopTestServer();
});
