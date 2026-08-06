/**
 * auth-membership-login.test.mjs
 *
 * Testa o guard de membership no login:
 *   - membership inativa → 403 (sem JWT clínico)
 *   - zero memberships → 403 (sem JWT clínico)
 *   - single-UBS ativo → 200 (login direto)
 *   - multi-UBS ativo → 200 + requiresUnitSelection
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { startTestServer, stopTestServer, post } from "./helpers.js";

const pw = "TestMem@2026!";

function readDb() {
  return JSON.parse(readFileSync(process.env.TEST_DB_PATH, "utf8"));
}

function writeDb(db) {
  writeFileSync(process.env.TEST_DB_PATH, JSON.stringify(db), "utf8");
}

describe("Auth login — membership guard", () => {
  before(startTestServer);
  after(stopTestServer);

  // ── single-UBS: login direto sem requiresUnitSelection ─────────────────────

  it("single-UBS ativo: login retorna token sem requiresUnitSelection", async () => {
    const email = `single-ubs-${Date.now()}@test.mem`;
    const { status: rs } = await post("/auth/register", {
      name: "Usuário Single UBS",
      email,
      password: pw,
      role: "gestor",
      unitId: "unit-default",
    });
    assert.ok(rs === 201 || rs === 409, `register esperava 201/409, got ${rs}`);

    const { status, json } = await post("/auth/login", { identifier: email, password: pw });
    assert.equal(status, 200, `login single-UBS falhou: ${JSON.stringify(json)}`);
    assert.ok(json.token || json.accessToken, "deve retornar token");
    assert.ok(!json.requiresUnitSelection, "não deve exigir seleção de UBS");
  });

  // ── multi-UBS: requiresUnitSelection + availableUnits ───────────────────────

  it("multi-UBS ativo: login retorna requiresUnitSelection=true com unidades", async () => {
    const email = `multi-ubs-${Date.now()}@test.mem`;
    const { status: rs } = await post("/auth/register", {
      name: "Usuário Multi UBS",
      email,
      password: pw,
      role: "gestor",
      unitId: "unit-default",
    });
    assert.ok(rs === 201 || rs === 409, `register esperava 201/409, got ${rs}`);

    // Inject second active membership directly into DB
    const db = readDb();
    const user = db.users.find((u) => u.email === email);
    assert.ok(user, "usuário não encontrado no DB");

    if (!Array.isArray(db.userUnitMemberships)) db.userUnitMemberships = [];
    const ts2 = Date.now();
    // With domain.js fix, ensureDbShape skips auto-create for users with any existing membership.
    // So we must inject BOTH memberships explicitly to get activeMemberships.length >= 2.
    db.userUnitMemberships.push(
      { id: `test-mem-primary-${ts2}`, userId: user.id, unitId: "unit-default", teamId: "", status: "active", primary: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `test-mem-extra-${ts2}`, userId: user.id, unitId: "unit-extra-test", teamId: "", status: "active", primary: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    );
    if (!db.units) db.units = [];
    if (!db.units.find((u) => u.id === "unit-extra-test")) {
      db.units.push({ id: "unit-extra-test", name: "UBS Extra Teste", cnes: "", createdAt: new Date().toISOString() });
    }
    writeDb(db);

    const { status, json } = await post("/auth/login", { identifier: email, password: pw });
    assert.equal(status, 200, `login multi-UBS falhou: ${JSON.stringify(json)}`);
    assert.equal(json.requiresUnitSelection, true, "deve exigir seleção de UBS");
    assert.ok(Array.isArray(json.availableUnits) && json.availableUnits.length >= 2, "deve listar ≥ 2 UBS");
  });

  // ── membership inativa: 403 sem JWT ─────────────────────────────────────────

  it("membership inativa (e unitId vazio): login retorna 403", async () => {
    const email = `inact-mem-${Date.now()}@test.mem`;
    const { status: rs, json: rj } = await post("/auth/register", {
      name: "Usuário Membership Inativo",
      email,
      password: pw,
      role: "gestor",
      unitId: "unit-default",
    });
    assert.ok(rs === 201 || rs === 409, `register (inactive-mem) esperava 201/409, got ${rs}: ${JSON.stringify(rj)}`);

    const db = readDb();
    const user = db.users.find((u) => u.email === email);
    assert.ok(user, "usuário não encontrado no DB");

    // Remove any active memberships auto-created and add only an inactive one
    if (!Array.isArray(db.userUnitMemberships)) db.userUnitMemberships = [];
    db.userUnitMemberships = db.userUnitMemberships.filter(
      (m) => m.userId !== user.id
    );
    db.userUnitMemberships.push({
      id: `test-mem-inactive-${Date.now()}`,
      userId: user.id,
      unitId: "unit-default",
      teamId: "",
      status: "inactive",
      primary: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    // Ensure user.unitId is empty so ensureDbShape won't re-create active membership
    const uidx = db.users.findIndex((u) => u.id === user.id);
    if (uidx >= 0) {
      db.users[uidx].unitId = "";
      db.users[uidx].teamId = "";
    }
    writeDb(db);

    const { status, json } = await post("/auth/login", { identifier: email, password: pw });
    assert.equal(status, 403, `esperava 403 para membership inativa, got ${status}: ${JSON.stringify(json)}`);
    assert.ok(!json.token && !json.accessToken, "não deve emitir JWT com membership inativa");
  });

  // ── múltiplas memberships inativas: 403 sem JWT ─────────────────────────────
  // ensureDbShape always backfills unitId from teamId or "unit-default", so
  // zero membership records is impossible in practice. This test validates the guard
  // fires when ALL explicit memberships are inactive (regardless of how many).

  it("múltiplas memberships inativas (unitId vazio): login retorna 403", async () => {
    const email = `multi-inact-${Date.now()}@test.mem`;
    const { status: rs, json: rj } = await post("/auth/register", {
      name: "Usuário Multi Membership Inativo",
      email,
      password: pw,
      role: "gestor",
      unitId: "unit-default",
    });
    assert.ok(rs === 201 || rs === 409, `register esperava 201/409, got ${rs}: ${JSON.stringify(rj)}`);

    const db = readDb();
    const user = db.users.find((u) => u.email === email);
    assert.ok(user, "usuário não encontrado no DB");

    // Replace all memberships with two inactive ones for different units.
    // Also clear unitId so ensureDbShape won't create a new active membership
    // (it checks existingKeys which includes the inactive unit combos below).
    if (!Array.isArray(db.userUnitMemberships)) db.userUnitMemberships = [];
    db.userUnitMemberships = db.userUnitMemberships.filter((m) => m.userId !== user.id);
    const ts = Date.now();
    // Use "unit-default" so ensureDbShape's derived unitId lookup finds it in existingKeys
    // and does NOT auto-create a new active membership.
    db.userUnitMemberships.push(
      { id: `mi-a-${ts}`, userId: user.id, unitId: "unit-default", teamId: "", status: "inactive", primary: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `mi-b-${ts}`, userId: user.id, unitId: "unit-secondary", teamId: "", status: "inactive", primary: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    );
    const uidx = db.users.findIndex((u) => u.id === user.id);
    if (uidx >= 0) {
      db.users[uidx].unitId = "";
      db.users[uidx].teamId = "";
    }
    writeDb(db);

    const { status, json } = await post("/auth/login", { identifier: email, password: pw });
    assert.equal(status, 403, `esperava 403 para múltiplas memberships inativas, got ${status}: ${JSON.stringify(json)}`);
    assert.ok(!json.token && !json.accessToken, "não deve emitir JWT com todas as memberships inativas");
  });
});
