/**
 * gestor-scope.test.mjs
 *
 * VITRAS-ACCESS-SCOPE-BREAKGLASS-AND-MUNICIPAL-HIERARCHY-01 — Parts A+B
 *
 * Verifies gestor is scoped to their own UBS when listing users.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, req } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const UNIT_A = "unit-scope-a";
const UNIT_B = "unit-scope-b";
const MUNI_ID = "muni-scope-test";
const GESTOR_ID = "gestor-scope-001";
const DOC_A_ID  = "doc-scope-ubs-a";
const DOC_B_ID  = "doc-scope-ubs-b";
const GESTOR_PASS = "Gestor@Scope2026";

let gestorToken = "";

const post = (path, body, token) => req("POST", path, body, token);
const get  = (path, token) => req("GET", path, null, token);

async function seedActors() {
  await withDb((db) => {
    ensureDbShape(db);

    for (const [id, name, cnes] of [
      [UNIT_A, "UBS Scope A", "9990001"],
      [UNIT_B, "UBS Scope B", "9990002"]
    ]) {
      if (!db.units.find(u => u.id === id)) {
        db.units.push({ id, name, cnes, street: "Rua", streetNumber: "1", neighborhood: "B", municipalityId: MUNI_ID, createdAt: new Date().toISOString() });
      }
    }

    const teamA = "team-scope-a";
    if (!db.teams.find(t => t.id === teamA)) {
      db.teams.push({ id: teamA, name: "Equipe Scope A", unitId: UNIT_A, createdAt: new Date().toISOString() });
    }

    const users = [
      { id: GESTOR_ID, vitrasId: "300000001", name: "Gestor UBS A", role: "gestor",    unitId: UNIT_A, teamId: "" },
      { id: DOC_A_ID,  vitrasId: "300000002", name: "Dr UBS A",     role: "doctor",    unitId: UNIT_A, teamId: teamA },
      { id: DOC_B_ID,  vitrasId: "300000003", name: "Dr UBS B",     role: "doctor",    unitId: UNIT_B, teamId: "team-scope-b" },
    ];

    for (const u of users) {
      if (!db.users.find(x => x.id === u.id)) {
        db.users.push({
          ...u,
          email: `${u.vitrasId}@test.com`,
          password: hashPassword(u.id === GESTOR_ID ? GESTOR_PASS : "Doc@2026"),
          municipalityId: MUNI_ID,
          forcePasswordChange: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
  });
}

describe("Gestor scope — listagem de usuários", () => {
  before(async () => {
    await startTestServer();
    await seedActors();
    const { status, json } = await post("/auth/login", { identifier: "300000001", password: GESTOR_PASS });
    assert.equal(status, 200, `Login gestor falhou: ${JSON.stringify(json)}`);
    gestorToken = json?.token || json?.accessToken || "";
  });

  after(stopTestServer);
  it("GET /users: gestor vê apenas usuários da própria UBS", async () => {
    const { status, json } = await get("/users", gestorToken);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(Array.isArray(json), "deve retornar array");

    const ids = json.map(u => u.id);
    assert.ok(ids.includes(DOC_A_ID), "deve incluir doutor da UBS A");
    assert.ok(!ids.includes(DOC_B_ID), "não deve incluir doutor da UBS B");
  });

  it("GET /users: gestor não vê usuários de outra UBS mesmo com users.read.all", async () => {
    const { status, json } = await get("/users", gestorToken);
    assert.equal(status, 200);
    const unitIds = new Set(json.map(u => u.unitId).filter(Boolean));
    assert.ok(!unitIds.has(UNIT_B), "nenhum usuário de UBS B deve aparecer");
  });
});
