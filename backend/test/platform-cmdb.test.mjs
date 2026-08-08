/**
 * ERP-10 — CMDB Tests
 * SADMIN_VID = "700000080"
 * No clinical data. Registers, audits, Impact Analysis.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const SADMIN_VID = "700000080";
const SADMIN_ID  = "erp10-sadmin";

let token = "";
let server;
let ciId1 = "", ciId2 = "", ciId3 = "", relId = "";

const del = (path, tok) => fetch(
  (server?.address ? `http://127.0.0.1:${server.address().port}` : "http://127.0.0.1:3001") + path,
  { method: "DELETE", headers: { Authorization: `Bearer ${tok || token}` } }
).then(r => ({ status: r.status, json: r.json() }));

describe("ERP-10 — CMDB", () => {
  before(async () => {
    server = await startTestServer();

    await withDb((db) => {
      ensureDbShape(db);
      if (!Array.isArray(db.cmdbItems))         db.cmdbItems         = [];
      if (!Array.isArray(db.cmdbRelationships)) db.cmdbRelationships = [];

      db.users = db.users.filter(u => u.id !== SADMIN_ID);
      db.users.push({
        id: SADMIN_ID, vitrasId: SADMIN_VID,
        email: "sadmin.erp10@test.local", name: "Support Admin ERP-10",
        role: "support_admin", password: hashPassword("Erp10@Test"),
        forcePasswordChange: false, inactive: false,
        unitId: null, teamId: null, municipalityId: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });

    const { json } = await post("/auth/login", { identifier: SADMIN_VID, password: "Erp10@Test" });
    token = json?.token || json?.accessToken || "";
    assert.ok(token, "support_admin token missing");
  });

  after(async () => {
    await withDb((db) => { db.users = db.users.filter(u => u.id !== SADMIN_ID); });
    await stopTestServer(server);
  });

  // ── CI CRUD ────────────────────────────────────────────────────────────────

  it("T1 — GET /platform/cmdb/items — empty", async () => {
    const { status, json } = await get("/platform/cmdb/items", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(Array.isArray(json.items));
    assert.equal(typeof json.total, "number");
  });

  it("T2 — POST /platform/cmdb/items — creates CI", async () => {
    const { status, json } = await post("/platform/cmdb/items", {
      name: "VITRAS API Gateway",
      type: "API",
      criticality: "MISSION_CRITICAL",
      environment: "PRODUCTION",
      description: "Main API entry point",
      tags: ["api", "gateway"],
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    assert.ok(json.id);
    assert.ok(json.ciCode.startsWith("CI-"));
    assert.equal(json.name, "VITRAS API Gateway");
    assert.equal(json.type, "API");
    assert.equal(json.criticality, "MISSION_CRITICAL");
    assert.equal(json.status, "ACTIVE");
    assert.ok(Array.isArray(json.timeline));
    assert.ok(Array.isArray(json.audit));
    ciId1 = json.id;
  });

  it("T3 — POST /platform/cmdb/items — second CI", async () => {
    const { status, json } = await post("/platform/cmdb/items", {
      name: "Neon PostgreSQL Database",
      type: "DATABASE",
      criticality: "CRITICAL",
      environment: "PRODUCTION",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    ciId2 = json.id;
    assert.ok(json.ciCode.startsWith("CI-"));
  });

  it("T4 — POST /platform/cmdb/items — third CI", async () => {
    const { status, json } = await post("/platform/cmdb/items", {
      name: "Auth Service",
      type: "AUTH_SERVICE",
      criticality: "HIGH",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    ciId3 = json.id;
  });

  it("T5 — GET /platform/cmdb/items/:id — returns CI", async () => {
    const { status, json } = await get(`/platform/cmdb/items/${ciId1}`, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.id, ciId1);
    assert.ok(Array.isArray(json.relationships));
  });

  it("T6 — GET /platform/cmdb/items/:id — 404 on unknown", async () => {
    const { status } = await get("/platform/cmdb/items/ci-does-not-exist", token);
    assert.equal(status, 404);
  });

  it("T7 — POST missing name — 400", async () => {
    const { status } = await post("/platform/cmdb/items", { type: "API", criticality: "LOW" }, token);
    assert.equal(status, 400);
  });

  it("T8 — POST invalid type — 400", async () => {
    const { status } = await post("/platform/cmdb/items", { name: "X", type: "INVALID_TYPE", criticality: "LOW" }, token);
    assert.equal(status, 400);
  });

  it("T9 — PATCH updates CI fields", async () => {
    const { status, json } = await patch(`/platform/cmdb/items/${ciId1}`, {
      description: "Updated description",
      tags: ["api", "gateway", "production"],
      reason: "Adding production tag",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.description, "Updated description");
    assert.ok(json.tags.includes("production"));
    assert.ok(json.audit.length >= 2);
  });

  it("T10 — PATCH status change ACTIVE→MAINTENANCE", async () => {
    const { status, json } = await patch(`/platform/cmdb/items/${ciId1}`, {
      toStatus: "MAINTENANCE",
      reason: "Scheduled maintenance",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "MAINTENANCE");
    assert.ok(json.timeline.some(e => e.event === "STATUS_CHANGED"));
  });

  it("T11 — PATCH invalid transition — 422", async () => {
    const { status } = await patch(`/platform/cmdb/items/${ciId1}`, { toStatus: "PLANNED" }, token);
    assert.equal(status, 422);
  });

  it("T12 — PATCH 404 on unknown CI", async () => {
    const { status } = await patch("/platform/cmdb/items/no-such-ci", { description: "x" }, token);
    assert.equal(status, 404);
  });

  // ── Filters ────────────────────────────────────────────────────────────────

  it("T13 — GET ?type=API — only API type", async () => {
    const { status, json } = await get("/platform/cmdb/items?type=API", token);
    assert.equal(status, 200);
    assert.ok(json.items.every(i => i.type === "API"));
    assert.ok(json.items.length >= 1);
  });

  it("T14 — GET ?criticality=CRITICAL", async () => {
    const { status, json } = await get("/platform/cmdb/items?criticality=CRITICAL", token);
    assert.equal(status, 200);
    assert.ok(json.items.every(i => i.criticality === "CRITICAL"));
  });

  it("T15 — GET ?status=MAINTENANCE", async () => {
    const { status, json } = await get("/platform/cmdb/items?status=MAINTENANCE", token);
    assert.equal(status, 200);
    assert.ok(json.items.every(i => i.status === "MAINTENANCE"));
  });

  it("T16 — GET ?search=gateway — finds by name", async () => {
    const { status, json } = await get("/platform/cmdb/items?search=gateway", token);
    assert.equal(status, 200);
    assert.ok(json.items.some(i => i.id === ciId1));
  });

  // ── Relationships ──────────────────────────────────────────────────────────

  it("T17 — GET /platform/cmdb/relationships — empty", async () => {
    const { status, json } = await get("/platform/cmdb/relationships", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.relationships));
  });

  it("T18 — POST /platform/cmdb/relationships — DEPENDS_ON", async () => {
    const { status, json } = await post("/platform/cmdb/relationships", {
      sourceId: ciId1,
      targetId: ciId2,
      relType: "DEPENDS_ON",
      description: "API requires database",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    assert.ok(json.id);
    assert.ok(json.relCode.startsWith("REL-"));
    assert.equal(json.sourceId, ciId1);
    assert.equal(json.targetId, ciId2);
    assert.equal(json.relType, "DEPENDS_ON");
    assert.ok(json.inverseType);
    relId = json.id;
  });

  it("T19 — POST second relationship — USES", async () => {
    const { status, json } = await post("/platform/cmdb/relationships", {
      sourceId: ciId1,
      targetId: ciId3,
      relType: "USES",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    assert.equal(json.relType, "USES");
  });

  it("T20 — GET ?sourceId filters", async () => {
    const { status, json } = await get(`/platform/cmdb/relationships?sourceId=${ciId1}`, token);
    assert.equal(status, 200);
    assert.ok(json.relationships.every(r => r.sourceId === ciId1));
    assert.ok(json.total >= 2);
  });

  it("T21 — POST duplicate relationship — 409", async () => {
    const { status } = await post("/platform/cmdb/relationships", {
      sourceId: ciId1, targetId: ciId2, relType: "DEPENDS_ON",
    }, token);
    assert.equal(status, 409);
  });

  it("T22 — POST self-relationship — 400", async () => {
    const { status } = await post("/platform/cmdb/relationships", {
      sourceId: ciId1, targetId: ciId1, relType: "DEPENDS_ON",
    }, token);
    assert.equal(status, 400);
  });

  it("T23 — POST missing sourceId — 400", async () => {
    const { status } = await post("/platform/cmdb/relationships", { targetId: ciId2, relType: "DEPENDS_ON" }, token);
    assert.equal(status, 400);
  });

  it("T24 — POST invalid relType — 400", async () => {
    const { status } = await post("/platform/cmdb/relationships", { sourceId: ciId1, targetId: ciId2, relType: "INVALID" }, token);
    assert.equal(status, 400);
  });

  it("T25 — GET /platform/cmdb/items/:id — shows rels", async () => {
    const { json } = await get(`/platform/cmdb/items/${ciId2}`, token);
    assert.ok(json.relationships.some(r => r.sourceId === ciId1 || r.targetId === ciId1));
  });

  // ── Impact Analysis ────────────────────────────────────────────────────────

  it("T26 — GET /platform/cmdb/impact/:id — returns analysis", async () => {
    const { status, json } = await get(`/platform/cmdb/impact/${ciId2}`, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.ciId, ciId2);
    assert.ok(typeof json.totalAffected === "number");
    assert.ok(Array.isArray(json.affected));
    assert.ok(typeof json.maxDepth === "number");
    assert.ok(json.analyzedAt);
    assert.ok(json.affected.some(a => a.ci.id === ciId1));
  });

  it("T27 — Impact root CI not in affected", async () => {
    const { json } = await get(`/platform/cmdb/impact/${ciId2}`, token);
    assert.ok(!json.affected.some(a => a.ci.id === ciId2));
  });

  it("T28 — Impact on leaf CI — empty affected", async () => {
    const { status, json } = await get(`/platform/cmdb/impact/${ciId1}`, token);
    assert.equal(status, 200);
    assert.equal(json.totalAffected, 0);
  });

  it("T29 — GET /platform/cmdb/impact — 404 unknown CI", async () => {
    const { status } = await get("/platform/cmdb/impact/no-ci", token);
    assert.equal(status, 404);
  });

  // ── Search ─────────────────────────────────────────────────────────────────

  it("T30 — GET /platform/cmdb/search?q=neon — finds CI", async () => {
    const { status, json } = await get("/platform/cmdb/search?q=neon", token);
    assert.equal(status, 200);
    assert.ok(json.results.some(i => i.id === ciId2));
  });

  it("T31 — GET /platform/cmdb/search without q — 400", async () => {
    const { status } = await get("/platform/cmdb/search", token);
    assert.equal(status, 400);
  });

  it("T32 — GET search with criticality filter", async () => {
    const { status, json } = await get("/platform/cmdb/search?q=auth&criticality=HIGH", token);
    assert.equal(status, 200);
    assert.ok(json.results.every(i => i.criticality === "HIGH"));
  });

  // ── Dashboard ──────────────────────────────────────────────────────────────

  it("T33 — GET /platform/cmdb/dashboard — structure", async () => {
    const { status, json } = await get("/platform/cmdb/dashboard", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(typeof json.total, "number");
    assert.equal(typeof json.active, "number");
    assert.equal(typeof json.maintenance, "number");
    assert.equal(typeof json.retiredArchived, "number");
    assert.equal(typeof json.missionCritical, "number");
    assert.equal(typeof json.critical, "number");
    assert.equal(typeof json.totalRelationships, "number");
    assert.equal(typeof json.byType, "object");
    assert.equal(typeof json.byCriticality, "object");
    assert.ok(Array.isArray(json.topHubs));
    assert.ok(json.generatedAt);
  });

  it("T34 — Dashboard counts are accurate", async () => {
    const { json } = await get("/platform/cmdb/dashboard", token);
    assert.equal(json.total, 3);
    assert.ok(json.missionCritical >= 1);
    assert.ok(json.totalRelationships >= 2);
  });

  it("T35 — Dashboard byType has API key", async () => {
    const { json } = await get("/platform/cmdb/dashboard", token);
    assert.ok(json.byType["API"] >= 1);
  });

  // ── Delete relationship ────────────────────────────────────────────────────

  it("T36 — DELETE /platform/cmdb/relationships/:id — removes", async () => {
    // Use req helper pattern via direct fetch to the test server
    const { json: j, status } = await get(`/platform/cmdb/relationships`, token);
    // find a rel to delete
    const toDelete = j.relationships.find(r => r.id === relId);
    assert.ok(toDelete, "relationship to delete not found");

    // Use patch trick: actual DELETE via helpers.js req function
    const { req } = await import("./helpers.js");
    const { status: ds, json: dj } = await req("DELETE", `/platform/cmdb/relationships/${relId}`, null, token);
    assert.equal(ds, 200, JSON.stringify(dj));
    assert.equal(dj.deleted, relId);
  });

  it("T37 — DELETE 404 on unknown rel", async () => {
    const { req } = await import("./helpers.js");
    const { status } = await req("DELETE", "/platform/cmdb/relationships/no-such-rel", null, token);
    assert.equal(status, 404);
  });

  it("T38 — After deletion, total rels decrements", async () => {
    const { json } = await get("/platform/cmdb/relationships", token);
    assert.equal(json.total, 1);
  });

  // ── RBAC ──────────────────────────────────────────────────────────────────

  it("T39 — GET items 401 without token", async () => {
    const { status } = await get("/platform/cmdb/items", "");
    assert.equal(status, 401);
  });

  it("T40 — POST items 401 without token", async () => {
    const { status } = await post("/platform/cmdb/items", { name: "X", type: "API", criticality: "LOW" }, "");
    assert.equal(status, 401);
  });

  it("T41 — Impact 401 without token", async () => {
    const { status } = await get(`/platform/cmdb/impact/${ciId1}`, "");
    assert.equal(status, 401);
  });

  it("T42 — Search 401 without token", async () => {
    const { status } = await get("/platform/cmdb/search?q=api", "");
    assert.equal(status, 401);
  });

  // ── No clinical data ───────────────────────────────────────────────────────

  it("T43 — CI has no clinical fields", async () => {
    const { json } = await get(`/platform/cmdb/items/${ciId1}`, token);
    assert.equal(json.patients, undefined);
    assert.equal(json.acsVisits, undefined);
    assert.equal(json.cpf, undefined);
    assert.equal(json.cns, undefined);
  });

  it("T44 — Dashboard has no clinical fields", async () => {
    const { json } = await get("/platform/cmdb/dashboard", token);
    assert.equal(json.patients, undefined);
    assert.equal(json.acsVisits, undefined);
  });

  it("T45 — Impact result has no clinical fields", async () => {
    const { json } = await get(`/platform/cmdb/impact/${ciId2}`, token);
    assert.equal(json.patients, undefined);
    for (const a of json.affected) {
      assert.equal(a.ci.cpf, undefined);
      assert.equal(a.ci.cns, undefined);
    }
  });

  // ── Audit chain ────────────────────────────────────────────────────────────

  it("T46 — Audit chain grows on update", async () => {
    const { json: before } = await get(`/platform/cmdb/items/${ciId1}`, token);
    const auditLen = before.audit.length;
    await patch(`/platform/cmdb/items/${ciId1}`, { description: "Audit check" }, token);
    const { json: after } = await get(`/platform/cmdb/items/${ciId1}`, token);
    assert.ok(after.audit.length > auditLen);
  });

  it("T47 — Timeline grows on status change", async () => {
    const { json: before } = await get(`/platform/cmdb/items/${ciId3}`, token);
    const timelineLen = before.timeline.length;
    await patch(`/platform/cmdb/items/${ciId3}`, { toStatus: "SUSPENDED", reason: "Test suspend" }, token);
    const { json: after } = await get(`/platform/cmdb/items/${ciId3}`, token);
    assert.ok(after.timeline.length > timelineLen);
    assert.ok(after.timeline.some(e => e.event === "STATUS_CHANGED" && e.to === "SUSPENDED"));
  });

  // ── Code increment ─────────────────────────────────────────────────────────

  it("T48 — CI codes increment sequentially", async () => {
    const { json } = await get("/platform/cmdb/items?limit=100", token);
    const codes = json.items.map(i => i.ciCode).filter(c => c && c.startsWith("CI-"));
    const nums  = codes.map(c => parseInt(c.split("-")[2], 10)).sort((a, b) => a - b);
    for (let i = 1; i < nums.length; i++) assert.ok(nums[i] > nums[i - 1]);
  });

  it("T49 — Relationship codes start with REL-", async () => {
    const { json } = await get("/platform/cmdb/relationships", token);
    assert.ok(json.relationships.every(r => r.relCode.startsWith("REL-")));
  });

  // ── Status lifecycle ───────────────────────────────────────────────────────

  it("T50 — ACTIVE→RETIRED→ARCHIVED lifecycle", async () => {
    const { json: ci } = await post("/platform/cmdb/items", { name: "Lifecycle CI", type: "CUSTOM", criticality: "LOW" }, token);
    assert.equal(ci.status, "ACTIVE");
    const { status: s2 } = await patch(`/platform/cmdb/items/${ci.id}`, { toStatus: "RETIRED", reason: "Decommission" }, token);
    assert.equal(s2, 200);
    const { status: s3 } = await patch(`/platform/cmdb/items/${ci.id}`, { toStatus: "ARCHIVED", reason: "Archive" }, token);
    assert.equal(s3, 200);
    const { status: s4 } = await patch(`/platform/cmdb/items/${ci.id}`, { toStatus: "ACTIVE" }, token);
    assert.equal(s4, 422);
  });

  // ── Service unit tests ─────────────────────────────────────────────────────

  it("T51 — assertCiTransition throws on invalid", async () => {
    const { assertCiTransition } = await import("../src/services/cmdb.js");
    assert.throws(() => assertCiTransition("ARCHIVED", "ACTIVE"), /422|inválid/i);
  });

  it("T52 — generateCiCode increments", async () => {
    const { generateCiCode } = await import("../src/services/cmdb.js");
    const yr    = new Date().getFullYear();
    const items = [{ ciCode: `CI-${yr}-0001` }];
    const code  = generateCiCode(items);
    assert.ok(code.endsWith("0002"));
  });

  it("T53 — createCi throws on missing name", async () => {
    const { createCi } = await import("../src/services/cmdb.js");
    assert.throws(
      () => createCi({ type: "API", criticality: "LOW", operator: { id: "x", name: "x", role: "support_admin" }, existingItems: [] }),
      /name|obrigatório/i
    );
  });

  it("T54 — analyzeImpact BFS transitive", async () => {
    const { analyzeImpact } = await import("../src/services/cmdb.js");
    const items = [
      { id: "ci-a", name: "A", type: "API",      criticality: "LOW",    ciCode: "CI-2026-0001" },
      { id: "ci-b", name: "B", type: "DATABASE", criticality: "MEDIUM", ciCode: "CI-2026-0002" },
      { id: "ci-c", name: "C", type: "STORAGE",  criticality: "HIGH",   ciCode: "CI-2026-0003" },
    ];
    const rels = [
      { id: "r1", sourceId: "ci-a", targetId: "ci-b", relType: "DEPENDS_ON" },
      { id: "r2", sourceId: "ci-b", targetId: "ci-c", relType: "DEPENDS_ON" },
    ];
    const result = analyzeImpact("ci-c", items, rels, 10);
    assert.equal(result.totalAffected, 2);
    assert.ok(result.affected.some(a => a.ci.id === "ci-b"));
    assert.ok(result.affected.some(a => a.ci.id === "ci-a"));
  });

  it("T55 — computeCmdbDashboard counts", async () => {
    const { computeCmdbDashboard } = await import("../src/services/cmdb.js");
    const items = [
      { id: "x1", type: "API",      criticality: "CRITICAL",         status: "ACTIVE"  },
      { id: "x2", type: "DATABASE", criticality: "MISSION_CRITICAL", status: "ACTIVE"  },
      { id: "x3", type: "API",      criticality: "LOW",              status: "RETIRED" },
    ];
    const rels = [{ id: "r1", sourceId: "x1", targetId: "x2" }];
    const dash = computeCmdbDashboard(items, rels);
    assert.equal(dash.total, 3);
    assert.equal(dash.active, 2);
    assert.equal(dash.retiredArchived, 1);
    assert.equal(dash.missionCritical, 1);
    assert.equal(dash.critical, 1);
    assert.equal(dash.totalRelationships, 1);
    assert.equal(dash.byType["API"], 2);
    assert.equal(dash.byType["DATABASE"], 1);
  });
});
