/**
 * IAM-01A: Test Tenant Reconciliation
 * Asserts db.json integrity after reconcile-test-tenant script has run.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = JSON.parse(readFileSync(resolve(__dirname, "../data/db.json"), "utf8"));

describe("IAM-01A: Test Tenant Reconciliation", () => {
  it("test-unit exists", () => {
    assert.ok(db.units.some(u => u.id === "test-unit"));
  });

  it("test-unit has required fields", () => {
    const u = db.units.find(u => u.id === "test-unit");
    assert.equal(u.cnes, "0000000");
    assert.equal(u.municipalityId, "3534401");
    assert.equal(u.uf, "SP");
    assert.equal(u.status, "test");
  });

  it("test-team exists", () => {
    assert.ok(db.teams.some(t => t.id === "test-team"));
  });

  it("test-team points to test-unit", () => {
    const t = db.teams.find(t => t.id === "test-team");
    assert.equal(t.unitId, "test-unit");
  });

  it("no team orphaned (unitId null or unit-default)", () => {
    const orphans = (db.teams || []).filter(t => !t.unitId || t.unitId === "unit-default");
    assert.equal(orphans.length, 0);
  });

  it("no user orphaned (unitId null or unit-default)", () => {
    const orphans = (db.users || []).filter(u => !u.unitId || u.unitId === "unit-default");
    assert.equal(orphans.length, 0);
  });

  it("no patient orphaned", () => {
    const orphans = (db.patients || []).filter(p => !p.unitId);
    assert.equal(orphans.length, 0);
  });

  it("no household orphaned", () => {
    const orphans = (db.households || []).filter(h => !h.unitId);
    assert.equal(orphans.length, 0);
  });

  it("no acsVisit orphaned", () => {
    const orphans = (db.acsVisits || []).filter(v => !v.unitId);
    assert.equal(orphans.length, 0);
  });

  it("no task orphaned", () => {
    const orphans = (db.tasks || []).filter(t => !t.unitId);
    assert.equal(orphans.length, 0);
  });

  it("script idempotent — test-unit appears exactly once", () => {
    const count = (db.units || []).filter(u => u.id === "test-unit").length;
    assert.equal(count, 1);
  });

  it("script idempotent — test-team appears exactly once", () => {
    const count = (db.teams || []).filter(t => t.id === "test-team").length;
    assert.equal(count, 1);
  });
});
