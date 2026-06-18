import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, patch } from "./helpers.js";
import { UnitPatchSchema } from "../src/schemas.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { seedDemoTeamRosa } from "../src/services/seed-demo.js";

async function withEnv(name, value, fn) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

async function readDefaultUnit() {
  return withDb((db) => {
    ensureDbShape(db);
    return db.units.find((unit) => unit.id === "unit-default") || null;
  });
}

describe("F4-04/F4-06 unit.cnes", () => {
  let token = null;

  before(async () => {
    await startTestServer();
    const login = await post("/auth/login", {
      email: "ana@clinica.local",
      password: "123456"
    });
    token = login.json?.token || login.json?.accessToken || null;
    assert.ok(token, `Falha no login de teste: ${JSON.stringify(login.json)}`);
  });

  after(stopTestServer);

  it("Smoke 1 — schema aceita cnes com 7 dígitos", () => {
    const result = UnitPatchSchema.safeParse({ cnes: "1234567" });
    assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  });

  it("Smoke 2 — schema rejeita cnes inválido", () => {
    const result = UnitPatchSchema.safeParse({ cnes: "123" });
    assert.equal(result.success, false);
  });

  it("schema aceita cnes null e ausência", () => {
    const withNull = UnitPatchSchema.safeParse({ cnes: null });
    const omitted = UnitPatchSchema.safeParse({});
    assert.equal(withNull.success, true, JSON.stringify(withNull.error?.issues));
    assert.equal(omitted.success, true, JSON.stringify(omitted.error?.issues));
  });

  it("Smoke 3 — PATCH /units/:id persiste cnes e permite limpar com null", async () => {
    const setResponse = await patch("/units/unit-default", { cnes: "1234567" }, token);
    assert.equal(setResponse.status, 200, JSON.stringify(setResponse.json));
    assert.equal(setResponse.json?.cnes, "1234567");

    const updatedUnit = await readDefaultUnit();
    assert.equal(updatedUnit?.cnes, "1234567");

    const clearResponse = await patch("/units/unit-default", { cnes: null }, token);
    assert.equal(clearResponse.status, 200, JSON.stringify(clearResponse.json));
    assert.equal(clearResponse.json?.cnes ?? null, null);

    const clearedUnit = await readDefaultUnit();
    assert.equal(clearedUnit?.cnes ?? null, null);
  });

  it("PATCH /units/:id rejeita cnes inválido com 400", async () => {
    const response = await patch("/units/unit-default", { cnes: "123" }, token);
    assert.equal(response.status, 400, JSON.stringify(response.json));
    assert.ok(
      Array.isArray(response.json?.details) && response.json.details.some((detail) => detail.includes("cnes")),
      JSON.stringify(response.json)
    );
  });

  it("Smoke 4 — seed funciona sem CNES real", async () => {
    await withDb((db) => {
      db.units = [];
    });

    const result = await withEnv("SEED_DEMO_DATA", "true", async () => withEnv("DEFAULT_UNIT_CNES", undefined, () => seedDemoTeamRosa()));
    assert.equal(result?.skipped, undefined);

    const unit = await readDefaultUnit();
    assert.equal(unit?.cnes ?? null, null);
  });

  it("Smoke 5 — seed funciona com DEFAULT_UNIT_CNES configurado", async () => {
    await withDb((db) => {
      db.units = [];
    });

    const result = await withEnv("SEED_DEMO_DATA", "true", async () => withEnv("DEFAULT_UNIT_CNES", "1234567", () => seedDemoTeamRosa()));
    assert.equal(result?.skipped, undefined);

    const unit = await readDefaultUnit();
    assert.equal(unit?.cnes, "1234567");
  });

  it("seed ignora placeholder não numérico", async () => {
    await withDb((db) => {
      db.units = [];
    });

    await withEnv("SEED_DEMO_DATA", "true", async () => withEnv("DEFAULT_UNIT_CNES", "CNES_PLACEHOLDER", () => seedDemoTeamRosa()));
    const unit = await readDefaultUnit();
    assert.equal(unit?.cnes ?? null, null);
  });
});
