/**
 * ERP-07 — Release Management and Change Control tests
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const SADMIN_VID = "700000050";
const SADMIN_ID  = "erp07-sadmin";

let token = "";
let server;
let releaseId  = "";
let releaseId2 = "";
let rolloutId  = "";
let mwId       = "";

describe("ERP-07 — Release Management and Change Control", () => {
  before(async () => {
    server = await startTestServer();

    await withDb((db) => {
      ensureDbShape(db);
      if (!Array.isArray(db.releases))           db.releases = [];
      if (!Array.isArray(db.releaseRollouts))    db.releaseRollouts = [];
      if (!Array.isArray(db.migrationLog))       db.migrationLog = [];
      if (!Array.isArray(db.maintenanceWindows)) db.maintenanceWindows = [];

      db.users = db.users.filter(u => u.id !== SADMIN_ID);
      db.users.push({
        id: SADMIN_ID, vitrasId: SADMIN_VID,
        email: "sadmin.erp07@test.local", name: "Support Admin ERP-07",
        role: "support_admin", password: hashPassword("Erp07@Test"),
        forcePasswordChange: false, inactive: false,
        unitId: null, teamId: null, municipalityId: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });

    const { json } = await post("/auth/login", { identifier: SADMIN_VID, password: "Erp07@Test" });
    token = json?.token || json?.accessToken || "";
    assert.ok(token, "support_admin token missing");
  });

  after(async () => {
    await withDb((db) => { db.users = db.users.filter(u => u.id !== SADMIN_ID); });
    await stopTestServer(server);
  });

  // ── Release CRUD ──────────────────────────────────────────────────────────

  it("T1 — GET /platform/releases — empty list", async () => {
    const { status, json } = await get("/platform/releases", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(Array.isArray(json.releases));
    assert.equal(typeof json.total, "number");
    assert.equal(typeof json.pages, "number");
  });

  it("T2 — POST /platform/releases — create MINOR release", async () => {
    const { status, json } = await post("/platform/releases", {
      version: "1.2.0",
      releaseType: "MINOR",
      title: "Release de teste ERP-07",
      description: "Criado por teste automatizado",
      plannedReleaseDate: "2026-09-01",
      changelog: [
        { category: "FEATURE", description: "Nova funcionalidade X", frontend: true, riskLevel: "LOW" },
        { category: "FIX",     description: "Correção de bug Y",     backend: true,  riskLevel: "LOW" },
      ],
      affectedModules: ["portal", "acs"],
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    releaseId = json.id;
    assert.ok(releaseId);
    assert.match(json.releaseCode, /^REL-\d{4}-\d{4}$/);
    assert.equal(json.version, "1.2.0");
    assert.equal(json.releaseType, "MINOR");
    assert.equal(json.status, "DRAFT");
    assert.equal(json.changelog.length, 2);
    assert.ok(json.createdBy?.id);
    assert.ok(json.timeline?.length >= 1);
    assert.ok(json.audit?.length >= 1);
  });

  it("T3 — POST /platform/releases — duplicate version → 409", async () => {
    const { status } = await post("/platform/releases", {
      version: "1.2.0", releaseType: "PATCH", title: "Dup version",
    }, token);
    assert.equal(status, 409);
  });

  it("T4 — POST /platform/releases — missing version → 400", async () => {
    const { status } = await post("/platform/releases", {
      releaseType: "PATCH", title: "No version",
    }, token);
    assert.equal(status, 400);
  });

  it("T5 — POST /platform/releases — invalid releaseType → 400", async () => {
    const { status } = await post("/platform/releases", {
      version: "2.0.0-test", releaseType: "GALACTIC", title: "Bad type",
    }, token);
    assert.equal(status, 400);
  });

  it("T6 — GET /platform/releases/:id — returns enriched release", async () => {
    const { status, json } = await get(`/platform/releases/${releaseId}`, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.id, releaseId);
    assert.ok(json.rolloutSummary, "rolloutSummary present");
    assert.equal(typeof json.rolloutSummary.total, "number");
    assert.equal(typeof json.rolloutSummary.completed, "number");
  });

  it("T7 — GET /platform/releases/:id — not found → 404", async () => {
    const { status } = await get("/platform/releases/nonexistent-id", token);
    assert.equal(status, 404);
  });

  it("T8 — PATCH /platform/releases/:id — edit title and add changelog", async () => {
    const { status, json } = await patch(`/platform/releases/${releaseId}`, {
      title: "Release 1.2.0 — Atualizado",
      addChangelog: [{ category: "DOCS", description: "Documentação atualizada", documentation: true, riskLevel: "LOW" }],
      reason: "Ajuste pós-revisão",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.title, "Release 1.2.0 — Atualizado");
    assert.equal(json.changelog.length, 3, "changelog additive");
    assert.ok(json.audit.some(a => a.action === "release.updated"));
  });

  // ── Release status machine ─────────────────────────────────────────────────

  it("T9 — PATCH /platform/releases/:id/status — DRAFT→APPROVED", async () => {
    const { status, json } = await patch(`/platform/releases/${releaseId}/status`, {
      toStatus: "APPROVED", reason: "Aprovado em reunião",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "APPROVED");
    assert.ok(json.approvedBy?.id);
    assert.ok(json.timeline.some(e => e.event === "STATUS_CHANGED" && e.to === "APPROVED"));
  });

  it("T10 — PATCH status — invalid transition APPROVED→STABLE → 422", async () => {
    const { status } = await patch(`/platform/releases/${releaseId}/status`, { toStatus: "STABLE" }, token);
    assert.equal(status, 422);
  });

  it("T11 — PATCH status — APPROVED→ACTIVE sets releaseDate", async () => {
    const { status, json } = await patch(`/platform/releases/${releaseId}/status`, {
      toStatus: "ACTIVE",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "ACTIVE");
    assert.ok(json.releaseDate);
  });

  it("T12 — PATCH status — ACTIVE→STABLE", async () => {
    const { status, json } = await patch(`/platform/releases/${releaseId}/status`, {
      toStatus: "STABLE",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "STABLE");
  });

  it("T13 — PATCH status — terminal state STABLE→ROLLED_BACK → 422", async () => {
    const { status } = await patch(`/platform/releases/${releaseId}/status`, { toStatus: "ROLLED_BACK" }, token);
    assert.equal(status, 422);
  });

  // ── GET /platform/releases filter ─────────────────────────────────────────

  it("T14 — GET /platform/releases?status=STABLE — filter works", async () => {
    const { status, json } = await get("/platform/releases?status=STABLE", token);
    assert.equal(status, 200);
    assert.ok(json.releases.every(r => r.status === "STABLE"));
    assert.ok(json.releases.some(r => r.id === releaseId));
  });

  it("T15 — GET /platform/releases?releaseType=PATCH — type filter", async () => {
    // Create a second release of type PATCH to test filter
    const { json: r } = await post("/platform/releases", {
      version: "1.2.1", releaseType: "PATCH", title: "Hotfix test",
    }, token);
    releaseId2 = r.id;

    const { status, json } = await get("/platform/releases?releaseType=PATCH", token);
    assert.equal(status, 200);
    assert.ok(json.releases.every(r2 => r2.releaseType === "PATCH"));
  });

  // ── Changelog ─────────────────────────────────────────────────────────────

  it("T16 — GET /platform/changelog — aggregated items from all releases", async () => {
    const { status, json } = await get("/platform/changelog", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(Array.isArray(json.changelog));
    assert.equal(typeof json.total, "number");
    assert.ok(json.changelog.every(c => c.releaseId && c.releaseCode));
  });

  it("T17 — GET /platform/changelog?releaseId=X — filter by release", async () => {
    const { status, json } = await get(`/platform/changelog?releaseId=${releaseId}`, token);
    assert.equal(status, 200);
    assert.ok(json.changelog.every(c => c.releaseId === releaseId));
    assert.equal(json.changelog.length, 3, "3 changelog items in release 1.2.0");
  });

  // ── Rollouts ───────────────────────────────────────────────────────────────

  it("T18 — POST /platform/rollouts — create MUNICIPALITY rollout", async () => {
    const { status, json } = await post("/platform/rollouts", {
      releaseId,
      targetType: "MUNICIPALITY",
      municipalityId: "4220000",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    rolloutId = json.id;
    assert.ok(rolloutId);
    assert.equal(json.status, "PLANNED");
    assert.equal(json.targetType, "MUNICIPALITY");
    assert.equal(json.municipalityId, "4220000");
    assert.ok(json.history?.length >= 1);
  });

  it("T19 — POST /platform/rollouts — UNIT targetType requires unitId", async () => {
    const { status } = await post("/platform/rollouts", {
      releaseId,
      targetType: "UNIT",
      municipalityId: "4220000",
      // no unitId
    }, token);
    assert.equal(status, 400);
  });

  it("T20 — POST /platform/rollouts — release not APPROVED/ACTIVE → 422", async () => {
    // releaseId2 is DRAFT
    const { status } = await post("/platform/rollouts", {
      releaseId: releaseId2,
      targetType: "MUNICIPALITY",
      municipalityId: "4220000",
    }, token);
    assert.equal(status, 422);
  });

  it("T21 — PATCH /platform/rollouts/:id/status — PLANNED→IN_PROGRESS", async () => {
    const { status, json } = await patch(`/platform/rollouts/${rolloutId}/status`, {
      toStatus: "IN_PROGRESS",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "IN_PROGRESS");
    assert.ok(json.startedAt);
  });

  it("T22 — PATCH rollout status — IN_PROGRESS→COMPLETED sets installedVersion", async () => {
    const { status, json } = await patch(`/platform/rollouts/${rolloutId}/status`, {
      toStatus: "COMPLETED", notes: "Implantação concluída com sucesso",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "COMPLETED");
    assert.ok(json.completedAt);
    assert.ok(json.installedVersion, "installedVersion set on COMPLETED");
  });

  it("T23 — PATCH rollout status — invalid transition COMPLETED→IN_PROGRESS → 422", async () => {
    const { status } = await patch(`/platform/rollouts/${rolloutId}/status`, { toStatus: "IN_PROGRESS" }, token);
    assert.equal(status, 422);
  });

  it("T24 — GET /platform/rollouts — filter by municipalityId", async () => {
    const { status, json } = await get("/platform/rollouts?municipalityId=4220000", token);
    assert.equal(status, 200);
    assert.ok(json.rollouts.every(ro => ro.municipalityId === "4220000"));
    assert.ok(json.rollouts.some(ro => ro.id === rolloutId));
  });

  it("T25 — GET /platform/rollouts?releaseId=X — filter by release", async () => {
    const { status, json } = await get(`/platform/rollouts?releaseId=${releaseId}`, token);
    assert.equal(status, 200);
    assert.ok(json.rollouts.every(ro => ro.releaseId === releaseId));
  });

  // ── Migrations ─────────────────────────────────────────────────────────────

  it("T26 — POST /platform/migrations — register migration", async () => {
    const { status, json } = await post("/platform/migrations", {
      migrationCode: "M-2026-042",
      releaseId,
      description: "Adiciona índice na tabela de pacientes",
      status: "APPLIED",
      executedAt: new Date().toISOString(),
      executionTimeMs: 1200,
      rollbackAvailable: true,
      result: "success",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    assert.ok(json.id);
    assert.equal(json.migrationCode, "M-2026-042");
    assert.equal(json.status, "APPLIED");
    assert.ok(json.recordedBy?.id);
  });

  it("T27 — POST /platform/migrations — duplicate migrationCode → 409", async () => {
    const { status } = await post("/platform/migrations", {
      migrationCode: "M-2026-042",
      status: "PENDING",
    }, token);
    assert.equal(status, 409);
  });

  it("T28 — POST /platform/migrations — missing migrationCode → 400", async () => {
    const { status } = await post("/platform/migrations", { status: "PENDING" }, token);
    assert.equal(status, 400);
  });

  it("T29 — GET /platform/migrations — list and filter", async () => {
    const { status, json } = await get("/platform/migrations?status=APPLIED", token);
    assert.equal(status, 200);
    assert.ok(json.migrations.every(m => m.status === "APPLIED"));
    assert.ok(json.migrations.some(m => m.migrationCode === "M-2026-042"));
  });

  // ── Maintenance Windows ────────────────────────────────────────────────────

  it("T30 — POST /platform/maintenance — create window", async () => {
    const start = new Date(Date.now() + 86400000).toISOString();
    const end   = new Date(Date.now() + 90000000).toISOString();
    const { status, json } = await post("/platform/maintenance", {
      title: "Janela de manutenção ERP-07",
      description: "Manutenção programada",
      startAt: start,
      endAt: end,
      reason: "Deploy 1.2.0",
      municipalityScope: ["4220000"],
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    mwId = json.id;
    assert.ok(mwId);
    assert.equal(json.status, "PLANNED");
    assert.equal(json.title, "Janela de manutenção ERP-07");
    assert.ok(json.audit?.length >= 1);
  });

  it("T31 — POST /platform/maintenance — endAt before startAt → 400", async () => {
    const start = new Date(Date.now() + 90000000).toISOString();
    const end   = new Date(Date.now() + 86400000).toISOString();
    const { status } = await post("/platform/maintenance", {
      title: "Bad window", startAt: start, endAt: end,
    }, token);
    assert.equal(status, 400);
  });

  it("T32 — POST /platform/maintenance — overlap detected → 409", async () => {
    // Try to create overlapping window
    const start = new Date(Date.now() + 86400000 + 1000).toISOString();
    const end   = new Date(Date.now() + 90000000 + 1000).toISOString();
    const { status } = await post("/platform/maintenance", {
      title: "Overlapping window", startAt: start, endAt: end,
    }, token);
    assert.equal(status, 409);
  });

  it("T33 — PATCH /platform/maintenance/:id — update status", async () => {
    const { status, json } = await patch(`/platform/maintenance/${mwId}`, {
      status: "ACTIVE",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "ACTIVE");
    assert.ok(json.audit.some(a => a.action === "maintenance.updated"));
  });

  it("T34 — GET /platform/maintenance — list", async () => {
    const { status, json } = await get("/platform/maintenance", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.maintenanceWindows));
    assert.ok(json.maintenanceWindows.some(w => w.id === mwId));
  });

  it("T35 — GET /platform/maintenance?status=ACTIVE — filter", async () => {
    const { status, json } = await get("/platform/maintenance?status=ACTIVE", token);
    assert.equal(status, 200);
    assert.ok(json.maintenanceWindows.every(w => w.status === "ACTIVE"));
  });

  // ── Dashboard ──────────────────────────────────────────────────────────────

  it("T36 — GET /platform/releases-dashboard — complete structure", async () => {
    const { status, json } = await get("/platform/releases-dashboard", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(json.releases, "releases stats present");
    assert.equal(typeof json.releases.total, "number");
    assert.equal(typeof json.releases.stable, "number");
    assert.ok(json.rollouts, "rollouts stats present");
    assert.equal(typeof json.rollouts.completed, "number");
    assert.ok(json.migrations, "migrations stats present");
    assert.ok(json.maintenanceWindows, "maintenance windows present");
    assert.ok(Array.isArray(json.maintenanceWindows.upcoming));
  });

  it("T37 — dashboard — currentVersion matches STABLE release", async () => {
    const { json } = await get("/platform/releases-dashboard", token);
    assert.equal(json.currentVersion, "1.2.0");
    assert.ok(json.lastRelease?.id === releaseId);
  });

  // ── RBAC ──────────────────────────────────────────────────────────────────

  it("T38 — GET /platform/releases without token → 401", async () => {
    const { status } = await get("/platform/releases", "");
    assert.equal(status, 401);
  });

  it("T39 — POST /platform/releases without token → 401", async () => {
    const { status } = await post("/platform/releases", { version: "9.9.9", releaseType: "PATCH", title: "T" }, "");
    assert.equal(status, 401);
  });

  // ── No clinical data ───────────────────────────────────────────────────────

  it("T40 — releases contain no clinical data", async () => {
    const { json } = await get(`/platform/releases/${releaseId}`, token);
    const str = JSON.stringify(json);
    assert.ok(!str.includes("patientId"),    "no patientId");
    assert.ok(!str.includes("prontuario"),   "no prontuario");
    assert.ok(!str.includes("atendimento"),  "no atendimento");
    assert.ok(!str.includes("clinicalEvent"), "no clinicalEvent");
  });

  it("T41 — rollouts contain no clinical data", async () => {
    const { json } = await get("/platform/rollouts", token);
    const str = JSON.stringify(json);
    assert.ok(!str.includes("patientId"),   "no patientId");
    assert.ok(!str.includes("prontuario"),  "no prontuario");
  });

  // ── Release code increment ─────────────────────────────────────────────────

  it("T42 — releaseCode increments per year", async () => {
    const { json: r1 } = await get(`/platform/releases/${releaseId}`, token);
    const { json: r2 } = await get(`/platform/releases/${releaseId2}`, token);
    const seq1 = parseInt(r1.releaseCode.split("-")[2], 10);
    const seq2 = parseInt(r2.releaseCode.split("-")[2], 10);
    assert.ok(seq2 > seq1, "second release has higher sequence");
  });

  // ── Service unit tests ─────────────────────────────────────────────────────

  it("T43 — assertReleaseTransition: terminal states block all transitions", async () => {
    const { assertReleaseTransition } = await import("../src/services/release.js");
    assert.throws(() => assertReleaseTransition("DEPRECATED", "DRAFT"),   { statusCode: 422 });
    assert.throws(() => assertReleaseTransition("ROLLED_BACK", "ACTIVE"), { statusCode: 422 });
  });

  it("T44 — createRollout: missing municipalityId throws 400", async () => {
    const { createRollout } = await import("../src/services/release.js");
    assert.throws(
      () => createRollout({ releaseId: "x", releaseVersion: "1.0.0", targetType: "MUNICIPALITY", operator: { id: "a", name: "b" } }),
      { statusCode: 400 }
    );
  });

  it("T45 — createMaintenanceWindow: overlap detection works in service", async () => {
    const { createMaintenanceWindow } = await import("../src/services/release.js");
    const existing = [{
      id: "mw1", title: "Existing", status: "PLANNED",
      startAt: "2026-10-01T00:00:00Z", endAt: "2026-10-01T04:00:00Z",
    }];
    assert.throws(
      () => createMaintenanceWindow({
        title: "Overlap", startAt: "2026-10-01T02:00:00Z", endAt: "2026-10-01T06:00:00Z",
        operator: { id: "a", name: "b" }, existingWindows: existing,
      }),
      { statusCode: 409 }
    );
  });
});
