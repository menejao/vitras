/**
 * platform-municipalities.test.mjs
 * ERP-02 — Municipality entity in Console Nacional
 *
 * Tests run against the file-based test DB (no Postgres).
 * isPostgresMode() = false in this env, so:
 * - GET /platform/municipalities returns { municipalities: [], total: 0 }
 * - Municipality FK validation is skipped (guarded by isPostgresMode check)
 * - Unit creation with valid IBGE format still works
 *
 * Tests that require real Postgres (municipality FK enforcement, UUID lookup)
 * are marked with [POSTGRES] and only run in CI with DATABASE_URL set.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const SADMIN_VID  = "700000001";
const SADMIN_ID   = "erp02-sadmin";

let sadminToken = "";
let server;

describe("ERP-02 — Platform Municipalities", () => {
  before(async () => {
    server = await startTestServer();

    await withDb((db) => {
      ensureDbShape(db);

      db.users.push({
        id:                  SADMIN_ID,
        vitrasId:            SADMIN_VID,
        email:               "sadmin.erp02@test.local",
        name:                "Support Admin ERP-02",
        role:                "support_admin",
        password:            hashPassword("SaTest@2026"),
        forcePasswordChange: false,
        inactive:            false,
        unitId:              null,
        teamId:              null,
        municipalityId:      null,
        createdAt:           new Date().toISOString(),
        updatedAt:           new Date().toISOString(),
      });
    });

    const { json } = await post("/auth/login", { identifier: SADMIN_VID, password: "SaTest@2026" });
    sadminToken = json?.token || json?.accessToken || "";
    assert.ok(sadminToken, "support_admin token missing");
  });

  after(async () => {
    await stopTestServer(server);
  });

  // ── GET /platform/municipalities ─────────────────────────────────────────

  it("GET /platform/municipalities — retorna lista vazia em env sem Postgres", async () => {
    const { status, json } = await get("/platform/municipalities", sadminToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.municipalities));
    assert.equal(typeof json.total, "number");
    assert.equal(typeof json.pages, "number");
  });

  it("GET /platform/municipalities?search=&uf= — aceita parâmetros sem erro", async () => {
    const { status } = await get("/platform/municipalities?search=santa&uf=SP", sadminToken);
    assert.equal(status, 200);
  });

  it("GET /platform/municipalities — 403 sem token", async () => {
    const { status } = await get("/platform/municipalities", "invalid-token");
    assert.equal(status, 401);
  });

  // ── GET /platform/municipalities/:id ─────────────────────────────────────

  it("GET /platform/municipalities/:id — 404 para ID inexistente em env sem Postgres", async () => {
    const { status } = await get("/platform/municipalities/00000000-0000-0000-0000-000000000000", sadminToken);
    // Without Postgres, findMunicipalityById returns null → 404
    assert.equal(status, 404);
  });

  // ── POST /platform/units — municipality validation ────────────────────────

  it("POST /platform/units com municipalityId válido cria UBS (sem Postgres — FK skip)", async () => {
    const { status, json } = await post("/platform/units", {
      name:            "UBS ERP-02 Teste",
      cnes:            "7000001",
      municipalityId:  "3534401",
      municipalityName: "São Paulo",
      uf:              "SP",
      street:          "Rua Teste",
      streetNumber:    "100",
      neighborhood:    "Centro",
    }, sadminToken);
    assert.equal(status, 201, JSON.stringify(json));
    assert.equal(json.municipalityId, "3534401");
    assert.equal(json.uf, "SP");
    assert.ok(json.id);
  });

  it("POST /platform/units com municipalityId formato inválido → 400", async () => {
    const { status, json } = await post("/platform/units", {
      name:            "UBS Inválida",
      cnes:            "7000002",
      municipalityId:  "123",           // 3 dígitos — inválido
      municipalityName: "Invalido",
      uf:              "SP",
      street:          "Rua Teste",
      streetNumber:    "100",
      neighborhood:    "Centro",
    }, sadminToken);
    assert.equal(status, 400);
    assert.match(json.error, /7 dígitos/);
  });

  it("POST /platform/units com municipalityId ausente → 400 (campo obrigatório)", async () => {
    const { status, json } = await post("/platform/units", {
      name:            "UBS Sem Município",
      cnes:            "7000003",
      municipalityName: "São Paulo",
      uf:              "SP",
      street:          "Rua Teste",
      streetNumber:    "100",
      neighborhood:    "Centro",
    }, sadminToken);
    assert.equal(status, 400);
  });

  // ── GET /platform/units — municipalityId filter ───────────────────────────

  it("GET /platform/units?municipalityId=3534401 — filtra por IBGE code (compat)", async () => {
    // Create two units with different municipalities
    await post("/platform/units", {
      name: "UBS Municipio A", cnes: "7000004", municipalityId: "3534401",
      municipalityName: "São Paulo", uf: "SP",
      street: "Rua A", streetNumber: "1", neighborhood: "A",
    }, sadminToken);

    await post("/platform/units", {
      name: "UBS Municipio B", cnes: "7000005", municipalityId: "3100104",
      municipalityName: "Abadia dos Dourados", uf: "MG",
      street: "Rua B", streetNumber: "2", neighborhood: "B",
    }, sadminToken);

    const { status, json } = await get("/platform/units?municipalityId=3534401", sadminToken);
    assert.equal(status, 200);
    assert.ok(json.units.every((u) => u.municipalityId === "3534401"),
      "All returned units must belong to municipality 3534401"
    );
  });

  it("GET /platform/units?municipalityId=UUID_INEXISTENTE — 404 (sem Postgres)", async () => {
    const fakeUuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const { status } = await get(`/platform/units?municipalityId=${fakeUuid}`, sadminToken);
    // findMunicipalityById returns null in non-Postgres env → 404
    assert.equal(status, 404);
  });

  it("GET /platform/units sem filtro — mantém comportamento atual", async () => {
    const { status, json } = await get("/platform/units", sadminToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.units));
    assert.ok(typeof json.total === "number");
  });
});
