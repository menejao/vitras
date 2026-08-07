/**
 * ERP-06 — Platform Observability and Diagnostics tests
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const SADMIN_VID = "700000040";
const SADMIN_ID  = "erp06-sadmin";

let token = "";
let server;
let alertId = "";

describe("ERP-06 — Platform Observability and Diagnostics", () => {
  before(async () => {
    server = await startTestServer();

    await withDb((db) => {
      ensureDbShape(db);
      if (!Array.isArray(db.platformAlerts))  db.platformAlerts = [];
      if (!Array.isArray(db.diagnosticRuns))  db.diagnosticRuns = [];
      if (!Array.isArray(db.deployments))     db.deployments = [];
      if (!Array.isArray(db.licenses))        db.licenses = [];
      if (!Array.isArray(db.incidents))       db.incidents = [];

      db.users = db.users.filter(u => u.id !== SADMIN_ID);
      db.users.push({
        id: SADMIN_ID, vitrasId: SADMIN_VID,
        email: "sadmin.erp06@test.local", name: "Support Admin ERP-06",
        role: "support_admin", password: hashPassword("Erp06@Test"),
        forcePasswordChange: false, inactive: false,
        unitId: null, teamId: null, municipalityId: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });

    const { json } = await post("/auth/login", { identifier: SADMIN_VID, password: "Erp06@Test" });
    token = json?.token || json?.accessToken || "";
    assert.ok(token, "support_admin token missing");
  });

  after(async () => {
    await withDb((db) => { db.users = db.users.filter(u => u.id !== SADMIN_ID); });
    await stopTestServer(server);
  });

  // ── Health ────────────────────────────────────────────────────────────────

  it("T1 — GET /platform/health — returns structure", async () => {
    const { status, json } = await get("/platform/health", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(json.overall, "overall present");
    assert.ok(json.components, "components present");
    assert.ok(json.components.api, "api component");
    assert.ok(json.components.database, "database component");
    assert.ok(json.components.auth, "auth component");
    assert.ok(json.summary, "summary present");
    assert.equal(typeof json.summary.totalDeployments, "number");
    assert.ok(json.checkedAt);
    assert.ok(["HEALTHY","WARNING","CRITICAL","OFFLINE","UNKNOWN"].includes(json.overall));
  });

  it("T2 — GET /platform/health — no clinical data in response", async () => {
    const { json } = await get("/platform/health", token);
    const str = JSON.stringify(json);
    assert.ok(!str.includes("patient"), "no patient data");
    assert.ok(!str.includes("prontuario"), "no prontuario");
    assert.ok(!str.includes("atendimento"), "no atendimento");
  });

  it("T3 — health degrades to CRITICAL when critical incident exists", async () => {
    // Inject critical incident
    await withDb((db) => {
      if (!Array.isArray(db.incidents)) db.incidents = [];
      db.incidents.push({
        id: "test-crit-inc", incidentCode: "INC-2026-9999",
        title: "Critical test", category: "API", severity: "CRITICAL",
        status: "IN_PROGRESS", priority: 1,
        timeline: [], audit: [], assignmentHistory: [], tags: [],
        sla: {}, attachmentsMetadata: [],
        reportedBy: { id: SADMIN_ID, name: "Test" }, assignedTo: null,
        municipalityId: null, unitId: null, deploymentId: null,
        licenseId: null, breakGlassSessionId: null,
        firstResponseAt: null, resolvedAt: null, closedAt: null,
        rootCause: "", resolution: "", description: "",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });
    const { json } = await get("/platform/health", token);
    assert.equal(json.overall, "CRITICAL");
    // Cleanup
    await withDb((db) => { db.incidents = db.incidents.filter(i => i.id !== "test-crit-inc"); });
  });

  // ── Diagnostics ───────────────────────────────────────────────────────────

  it("T4 — GET /platform/diagnostics — returns list", async () => {
    const { status, json } = await get("/platform/diagnostics", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(Array.isArray(json.diagnostics));
    assert.equal(typeof json.total, "number");
    assert.ok(json.ranAt);
  });

  it("T5 — DIAG-002 fires when expired license exists", async () => {
    await withDb((db) => {
      if (!Array.isArray(db.licenses)) db.licenses = [];
      db.licenses.push({
        id: "test-exp-lic", licenseCode: "LIC-2026-9999",
        municipalityId: "TEST-MUN", plan: "STARTER", status: "EXPIRED",
        limits: {}, features: [], history: [],
        contractNumber: "", contractStart: null, contractEnd: "2025-01-01",
        renewalDate: null, notes: "", createdBy: { id: SADMIN_ID, name: "T" },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });
    const { json } = await get("/platform/diagnostics", token);
    const diag002 = json.diagnostics.find(d => d.code === "DIAG-002");
    assert.ok(diag002, "DIAG-002 fired for expired license");
    assert.equal(diag002.severity, "HIGH");
    // Cleanup
    await withDb((db) => { db.licenses = db.licenses.filter(l => l.id !== "test-exp-lic"); });
  });

  it("T6 — POST /platform/diagnostics/run — manual run with audit", async () => {
    const { status, json } = await post("/platform/diagnostics/run", {}, token);
    assert.equal(status, 201, JSON.stringify(json));
    assert.ok(json.id);
    assert.ok(json.executedBy?.id);
    assert.equal(typeof json.durationMs, "number");
    assert.equal(typeof json.totalChecks, "number");
    assert.ok(Array.isArray(json.results));
    assert.ok(json.startedAt);
    assert.ok(json.finishedAt);
  });

  // ── Alerts ────────────────────────────────────────────────────────────────

  it("T7 — GET /platform/alerts — empty list", async () => {
    const { status, json } = await get("/platform/alerts", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.alerts));
    assert.equal(typeof json.total, "number");
  });

  it("T8 — POST /platform/alerts — create manual alert", async () => {
    const { status, json } = await post("/platform/alerts", {
      code: "TEST-001",
      title: "Alerta de teste ERP-06",
      description: "Criado por teste automatizado",
      severity: "HIGH",
      category: "API",
      affectedComponent: "Platform API",
      recommendation: "Verificar logs",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    alertId = json.id;
    assert.ok(alertId);
    assert.match(json.alertCode, /^ALT-\d{4}-\d{4}$/);
    assert.equal(json.status, "OPEN");
    assert.equal(json.severity, "HIGH");
    assert.equal(json.category, "API");
  });

  it("T9 — POST /platform/alerts — missing title → 400", async () => {
    const { status } = await post("/platform/alerts", { category: "API" }, token);
    assert.equal(status, 400);
  });

  it("T10 — POST /platform/alerts — invalid category → 400", async () => {
    const { status } = await post("/platform/alerts", { title: "x", category: "GALACTIC" }, token);
    assert.equal(status, 400);
  });

  it("T11 — GET /platform/alerts — lists created alert", async () => {
    const { json } = await get("/platform/alerts", token);
    assert.ok(json.alerts.some(a => a.id === alertId));
  });

  it("T12 — POST /platform/alerts/:id/ack — acknowledge alert", async () => {
    const { status, json } = await post(`/platform/alerts/${alertId}/ack`, {}, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "ACKNOWLEDGED");
    assert.ok(json.acknowledgedAt);
    assert.ok(json.acknowledgedBy?.id);
  });

  it("T13 — POST /platform/alerts/:id/ack — already acknowledged → 422", async () => {
    const { status } = await post(`/platform/alerts/${alertId}/ack`, {}, token);
    assert.equal(status, 422);
  });

  it("T14 — POST /platform/alerts/:id/resolve", async () => {
    const { status, json } = await post(`/platform/alerts/${alertId}/resolve`, {}, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "RESOLVED");
    assert.ok(json.resolvedAt);
  });

  it("T15 — GET /platform/alerts?status=RESOLVED — filter", async () => {
    const { status, json } = await get("/platform/alerts?status=RESOLVED", token);
    assert.equal(status, 200);
    assert.ok(json.alerts.every(a => a.status === "RESOLVED"));
  });

  it("T16 — alert auditTrail has created + acknowledged + resolved", async () => {
    const { json: list } = await get("/platform/alerts?status=RESOLVED", token);
    const alert = list.alerts.find(a => a.id === alertId);
    assert.ok(alert);
    const actions = alert.auditTrail.map(e => e.action);
    assert.ok(actions.includes("created"));
    assert.ok(actions.includes("acknowledged"));
    assert.ok(actions.includes("resolved"));
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────

  it("T17 — GET /platform/dashboard — full structure", async () => {
    const { status, json } = await get("/platform/dashboard", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(json.health);
    assert.ok(json.deployments);
    assert.ok(json.licenses);
    assert.ok(json.units);
    assert.ok(json.incidents);
    assert.ok(json.alerts);
    assert.ok(json.municipalities);
    assert.ok(json.diagnostics);
    assert.equal(typeof json.deployments.total, "number");
    assert.equal(typeof json.incidents.critical, "number");
    assert.ok(json.generatedAt);
  });

  it("T18 — dashboard no clinical data", async () => {
    const { json } = await get("/platform/dashboard", token);
    const str = JSON.stringify(json);
    assert.ok(!str.includes("patientId"), "no patientId");
    assert.ok(!str.includes("prontuario"), "no prontuario");
  });

  // ── Municipality Health ────────────────────────────────────────────────────

  it("T19 — GET /platform/municipalities/:id/health — any id returns structure", async () => {
    const { status, json } = await get("/platform/municipalities/4220000/health", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.municipalityId, "4220000");
    assert.ok(json.overallHealth);
    assert.ok(json.deployment);
    assert.ok(json.license);
    assert.ok(json.incidents);
    assert.ok(json.units);
    assert.ok(json.checkedAt);
  });

  // ── Unit Health ────────────────────────────────────────────────────────────

  it("T20 — GET /platform/units/:id/health — unit not found → 404", async () => {
    const { status } = await get("/platform/units/nonexistent-unit/health", token);
    assert.equal(status, 404);
  });

  it("T21 — GET /platform/units/:id/health — existing unit returns structure", async () => {
    // Inject a test unit
    let unitId = "";
    await withDb((db) => {
      if (!Array.isArray(db.units)) db.units = [];
      unitId = "test-unit-obs-001";
      db.units.push({
        id: unitId, name: "UBS Teste Obs", cnes: "9999999",
        municipalityId: "4220000", status: "active",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });

    const { status, json } = await get(`/platform/units/${unitId}/health`, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.unitId, unitId);
    assert.ok(json.overallHealth);
    assert.ok(json.deployment);
    assert.ok(json.incidents);
    assert.ok(json.services);
    assert.ok(json.checkedAt);
    assert.equal(json.services.portal, "HEALTHY");

    // Cleanup
    await withDb((db) => { db.units = db.units.filter(u => u.id !== unitId); });
  });

  // ── RBAC ──────────────────────────────────────────────────────────────────

  it("T22 — GET /platform/health without token → 401", async () => {
    const { status } = await get("/platform/health", "");
    assert.equal(status, 401);
  });

  it("T23 — GET /platform/diagnostics without token → 401", async () => {
    const { status } = await get("/platform/diagnostics", "");
    assert.equal(status, 401);
  });

  it("T24 — GET /platform/dashboard without token → 401", async () => {
    const { status } = await get("/platform/dashboard", "");
    assert.equal(status, 401);
  });

  it("T25 — GET /platform/alerts without token → 401", async () => {
    const { status } = await get("/platform/alerts", "");
    assert.equal(status, 401);
  });

  // ── Alert pagination ───────────────────────────────────────────────────────

  it("T26 — GET /platform/alerts?page=1&limit=1 — pagination", async () => {
    const { status, json } = await get("/platform/alerts?page=1&limit=1", token);
    assert.equal(status, 200);
    assert.ok(json.alerts.length <= 1);
    assert.equal(typeof json.pages, "number");
  });

  // ── Service unit tests ─────────────────────────────────────────────────────

  it("T27 — worstStatus: CRITICAL wins over HEALTHY and WARNING", async () => {
    const { worstStatus, HEALTH_STATUS } = await import("../src/services/platform-health.js");
    assert.equal(worstStatus("HEALTHY", "WARNING", "CRITICAL"), "CRITICAL");
    assert.equal(worstStatus("HEALTHY", "WARNING"), "WARNING");
    assert.equal(worstStatus("HEALTHY"), "HEALTHY");
    assert.equal(worstStatus("OFFLINE", "CRITICAL"), "CRITICAL");
  });

  it("T28 — computePlatformHealth returns valid structure for empty DB", async () => {
    const { computePlatformHealth } = await import("../src/services/platform-health.js");
    const emptyDb = { deployments: [], licenses: [], incidents: [], units: [], platformAlerts: [] };
    const h = computePlatformHealth(emptyDb);
    assert.equal(h.overall, "HEALTHY");
    assert.ok(h.components.api);
    assert.ok(h.components.database);
  });

  it("T29 — runDiagnostics returns DIAG-004 for open critical incident", async () => {
    const { runDiagnostics } = await import("../src/services/platform-health.js");
    const db = {
      deployments: [], licenses: [], units: [], platformAlerts: [],
      incidents: [{
        id: "x", incidentCode: "INC-2026-0001", severity: "CRITICAL",
        status: "IN_PROGRESS", sla: {}, municipalityId: null,
      }],
    };
    const results = runDiagnostics(db);
    assert.ok(results.some(d => d.code === "DIAG-004"), "DIAG-004 fires for open critical");
  });

  it("T30 — runDiagnostics returns empty array for clean state", async () => {
    const { runDiagnostics } = await import("../src/services/platform-health.js");
    const db = { deployments: [], licenses: [], incidents: [], units: [], platformAlerts: [] };
    const results = runDiagnostics(db);
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });
});
