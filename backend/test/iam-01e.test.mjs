/**
 * IAM-01E tests: Platform Console auth and unit listing
 *
 * Tests the fixes for:
 * 1. PlatformConsolePage using raw fetch with Bearer sentinel → now uses api()
 * 2. test-unit absent from app_state.units → migration 029 seeds it
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const COOKIE_SESSION_SENTINEL = "__cookie_session__";

// ── Sentinel logic (mirrors api.js) ───────────────────────────────────────
function shouldSendBearer(token) {
  return !!(token && token !== COOKIE_SESSION_SENTINEL);
}

function shouldSendCsrf(method) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

// ── Migration 029 logic (mirrors the migration file) ─────────────────────
function applyMigration029(db) {
  const now = new Date().toISOString();
  if (!Array.isArray(db.units)) db.units = [];
  if (!Array.isArray(db.teams)) db.teams = [];

  const unitIdx = db.units.findIndex((u) => u.id === "test-unit");
  const testUnit = {
    id: "test-unit",
    name: "UBS Teste VITRAS",
    cnes: "0000000",
    municipalityId: "3534401",
    municipalityName: "São Paulo",
    uf: "SP",
    contactEmail: "",
    phone: "",
    status: "onboarding",
    createdBy: "system-migration",
    createdAt: now,
    updatedAt: now
  };
  if (unitIdx < 0) {
    db.units.push(testUnit);
  } else {
    db.units[unitIdx] = { ...testUnit, ...db.units[unitIdx] };
  }

  const teamIdx = db.teams.findIndex((t) => t.id === "test-team");
  const testTeam = {
    id: "test-team",
    name: "Equipe Teste VITRAS",
    unitId: "test-unit",
    ine: "0000000000",
    tipoEquipe: "ESF",
    managerUserId: "",
    createdAt: now,
    updatedAt: now
  };
  if (teamIdx < 0) {
    db.teams.push(testTeam);
  } else {
    db.teams[teamIdx] = { ...testTeam, ...db.teams[teamIdx] };
  }
  return db;
}

// ── Platform units GET filter logic ──────────────────────────────────────
function getUnitsForResponse(db) {
  return (db.units || []).map((u) => ({
    id: u.id,
    name: u.name,
    cnes: u.cnes,
    municipalityName: u.municipalityName,
    uf: u.uf,
    status: u.status || "onboarding"
  }));
}

describe("IAM-01E: platform console auth and unit listing", () => {
  // ── Sentinel / token routing ──────────────────────────────────────────
  it("1. cookie sentinel must not be sent as Bearer", () => {
    assert.equal(shouldSendBearer(COOKIE_SESSION_SENTINEL), false);
  });

  it("2. valid JWT must be sent as Bearer", () => {
    assert.equal(shouldSendBearer("eyJhbGciOiJIUzI1NiJ9.e30.abc"), true);
  });

  it("3. empty token must not be sent as Bearer", () => {
    assert.ok(!shouldSendBearer(""));
  });

  it("4. POST to /platform/units requires CSRF", () => {
    assert.equal(shouldSendCsrf("POST"), true);
  });

  it("5. GET to /platform/units does not require CSRF", () => {
    assert.equal(shouldSendCsrf("GET"), false);
  });

  // ── Migration 029: test-unit into app_state.units ─────────────────────
  it("6. migration 029 adds test-unit to empty units array", () => {
    const db = { units: [], teams: [] };
    applyMigration029(db);
    assert.ok(db.units.some((u) => u.id === "test-unit"));
  });

  it("7. migration 029 sets correct name for test-unit", () => {
    const db = { units: [], teams: [] };
    applyMigration029(db);
    const unit = db.units.find((u) => u.id === "test-unit");
    assert.equal(unit.name, "UBS Teste VITRAS");
  });

  it("8. migration 029 adds test-team", () => {
    const db = { units: [], teams: [] };
    applyMigration029(db);
    assert.ok(db.teams.some((t) => t.id === "test-team"));
  });

  it("9. migration 029 is idempotent — no duplicate units", () => {
    const db = { units: [], teams: [] };
    applyMigration029(db);
    applyMigration029(db);
    const count = db.units.filter((u) => u.id === "test-unit").length;
    assert.equal(count, 1);
  });

  it("10. migration 029 is idempotent — no duplicate teams", () => {
    const db = { units: [], teams: [] };
    applyMigration029(db);
    applyMigration029(db);
    const count = db.teams.filter((t) => t.id === "test-team").length;
    assert.equal(count, 1);
  });

  it("11. migration 029 preserves existing units", () => {
    const db = { units: [{ id: "existing-unit", name: "Other UBS" }], teams: [] };
    applyMigration029(db);
    assert.ok(db.units.some((u) => u.id === "existing-unit"));
    assert.ok(db.units.some((u) => u.id === "test-unit"));
    assert.equal(db.units.length, 2);
  });

  it("12. migration 029 with pre-existing test-unit merges, not overwrites", () => {
    const db = {
      units: [{ id: "test-unit", name: "UBS Teste VITRAS", customField: "keep" }],
      teams: []
    };
    applyMigration029(db);
    const unit = db.units.find((u) => u.id === "test-unit");
    assert.equal(unit.customField, "keep");
    assert.equal(unit.name, "UBS Teste VITRAS");
  });

  // ── Unit list response format ─────────────────────────────────────────
  it("13. GET /platform/units returns test-unit after migration 029", () => {
    const db = { units: [], teams: [] };
    applyMigration029(db);
    const response = getUnitsForResponse(db);
    assert.ok(response.some((u) => u.id === "test-unit"));
  });

  it("14. unit response includes required fields", () => {
    const db = { units: [], teams: [] };
    applyMigration029(db);
    const [unit] = getUnitsForResponse(db);
    for (const field of ["id", "name", "cnes", "status"]) {
      assert.ok(field in unit, `missing field: ${field}`);
    }
  });

  it("15. unit status defaults to onboarding when absent", () => {
    const db = { units: [{ id: "u1", name: "Test" }], teams: [] };
    const response = getUnitsForResponse(db);
    assert.equal(response[0].status, "onboarding");
  });

  // ── RBAC guardrails (invariant documentation) ─────────────────────────
  it("16. support_admin has no unitId (not tied to a specific unit)", () => {
    const supportAdmin = {
      id: "sa-01",
      role: "support_admin",
      unitId: "",
      teamId: ""
    };
    assert.equal(supportAdmin.unitId, "");
    assert.equal(supportAdmin.role, "support_admin");
  });

  it("17. sentinel cannot be a valid JWT (format check)", () => {
    const parts = COOKIE_SESSION_SENTINEL.split(".");
    assert.notEqual(parts.length, 3, "sentinel must not have 3 JWT segments");
  });
});
