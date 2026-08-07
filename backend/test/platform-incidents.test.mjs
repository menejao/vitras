/**
 * ERP-05 — Support Operations and Incident Management tests
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const SADMIN_VID = "700000030";
const SADMIN_ID  = "erp05-sadmin";

let token = "";
let server;
let incidentId = "";
let incidentCode = "";

describe("ERP-05 — Support Operations and Incident Management", () => {
  before(async () => {
    server = await startTestServer();

    await withDb((db) => {
      ensureDbShape(db);
      if (!Array.isArray(db.incidents)) db.incidents = [];

      db.users = db.users.filter(u => u.id !== SADMIN_ID);
      db.users.push({
        id: SADMIN_ID, vitrasId: SADMIN_VID,
        email: "sadmin.erp05@test.local", name: "Support Admin ERP-05",
        role: "support_admin", password: hashPassword("Erp05@Test"),
        forcePasswordChange: false, inactive: false,
        unitId: null, teamId: null, municipalityId: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });

    const { json } = await post("/auth/login", { identifier: SADMIN_VID, password: "Erp05@Test" });
    token = json?.token || json?.accessToken || "";
    assert.ok(token, "support_admin token missing");
  });

  after(async () => {
    await withDb((db) => { db.users = db.users.filter(u => u.id !== SADMIN_ID); });
    await stopTestServer(server);
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────

  it("T1 — GET /platform/incidents — empty list", async () => {
    const { status, json } = await get("/platform/incidents", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.incidents));
    assert.equal(typeof json.total, "number");
    assert.equal(typeof json.pages, "number");
  });

  it("T2 — POST /platform/incidents — creates NEW incident", async () => {
    const { status, json } = await post("/platform/incidents", {
      title: "Falha de autenticação na UBS 01",
      description: "Usuários não conseguem logar após migração",
      category: "AUTH",
      severity: "HIGH",
      municipalityId: "4220000",
      tags: ["auth", "migration"],
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    incidentId   = json.id;
    incidentCode = json.incidentCode;
    assert.ok(incidentId);
    assert.match(incidentCode, /^INC-\d{4}-\d{4}$/);
    assert.equal(json.status, "NEW");
    assert.equal(json.severity, "HIGH");
    assert.equal(json.category, "AUTH");
    assert.equal(json.priority, 2);
    assert.ok(Array.isArray(json.timeline) && json.timeline.length >= 1);
    assert.ok(json.sla?.firstResponseDeadline);
    assert.ok(json.sla?.resolutionDeadline);
    assert.ok(json.slaStatus !== undefined);
  });

  it("T3 — POST — missing title → 400", async () => {
    const { status } = await post("/platform/incidents", { category: "AUTH", severity: "HIGH" }, token);
    assert.equal(status, 400);
  });

  it("T4 — POST — missing category → 400", async () => {
    const { status } = await post("/platform/incidents", { title: "x", severity: "HIGH" }, token);
    assert.equal(status, 400);
  });

  it("T5 — POST — invalid category → 400", async () => {
    const { status } = await post("/platform/incidents", { title: "x", category: "GALACTIC", severity: "HIGH" }, token);
    assert.equal(status, 400);
  });

  it("T6 — POST — invalid severity → 400", async () => {
    const { status } = await post("/platform/incidents", { title: "x", category: "AUTH", severity: "ULTRA" }, token);
    assert.equal(status, 400);
  });

  it("T7 — GET /platform/incidents/:id — found", async () => {
    const { status, json } = await get(`/platform/incidents/${incidentId}`, token);
    assert.equal(status, 200);
    assert.equal(json.id, incidentId);
    assert.ok(json.slaStatus !== undefined);
  });

  it("T8 — GET /platform/incidents/:id — not found → 404", async () => {
    const { status } = await get("/platform/incidents/ghost", token);
    assert.equal(status, 404);
  });

  it("T9 — PATCH /platform/incidents/:id — update description and tags", async () => {
    const { status, json } = await patch(`/platform/incidents/${incidentId}`, {
      description: "Atualizado: erro no JWT middleware",
      tags: ["auth", "jwt", "migration"],
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.description, "Atualizado: erro no JWT middleware");
    assert.deepEqual(json.tags, ["auth", "jwt", "migration"]);
  });

  it("T10 — GET /platform/incident-categories", async () => {
    const { status, json } = await get("/platform/incident-categories", token);
    assert.equal(status, 200);
    assert.ok(json.categories.includes("AUTH"));
    assert.ok(json.categories.includes("SECURITY"));
    assert.ok(json.severities.includes("CRITICAL"));
  });

  // ── incidentCode increments ────────────────────────────────────────────────

  it("T11 — incidentCode increments per incident", async () => {
    const { json } = await post("/platform/incidents", {
      title: "Segundo incidente", category: "API", severity: "LOW",
    }, token);
    const seq1 = parseInt(incidentCode.split("-")[2], 10);
    const seq2 = parseInt(json.incidentCode.split("-")[2], 10);
    assert.ok(seq2 > seq1, `${seq2} > ${seq1}`);
  });

  // ── Status machine ─────────────────────────────────────────────────────────

  it("T12 — NEW → TRIAGED", async () => {
    const { status, json } = await patch(`/platform/incidents/${incidentId}/status`, { toStatus: "TRIAGED" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "TRIAGED");
  });

  it("T13 — TRIAGED → IN_PROGRESS", async () => {
    const { status, json } = await patch(`/platform/incidents/${incidentId}/status`, { toStatus: "IN_PROGRESS" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "IN_PROGRESS");
  });

  it("T14 — invalid transition IN_PROGRESS → NEW → 422", async () => {
    const { status } = await patch(`/platform/incidents/${incidentId}/status`, { toStatus: "NEW" }, token);
    assert.equal(status, 422);
  });

  it("T15 — IN_PROGRESS → WAITING", async () => {
    const { status, json } = await patch(`/platform/incidents/${incidentId}/status`, { toStatus: "WAITING", reason: "Aguardando infra" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "WAITING");
  });

  it("T16 — WAITING → RESOLVED with rootCause and resolution", async () => {
    const { status, json } = await patch(`/platform/incidents/${incidentId}/status`, {
      toStatus: "RESOLVED",
      rootCause: "JWT secret rotacionado sem atualizar .env",
      resolution: "Secret restaurado e deploy realizado",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "RESOLVED");
    assert.ok(json.resolvedAt);
    assert.equal(json.rootCause, "JWT secret rotacionado sem atualizar .env");
  });

  it("T17 — RESOLVED → CLOSED via /close shortcut", async () => {
    const { status, json } = await post(`/platform/incidents/${incidentId}/close`, { reason: "Confirmado estável" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "CLOSED");
    assert.ok(json.closedAt);
  });

  it("T18 — CLOSED → REOPENED via /reopen", async () => {
    const { status, json } = await post(`/platform/incidents/${incidentId}/reopen`, { reason: "Problema voltou" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "REOPENED");
    assert.equal(json.resolvedAt, null);
    assert.equal(json.closedAt, null);
  });

  it("T19 — missing toStatus → 400", async () => {
    const { status } = await patch(`/platform/incidents/${incidentId}/status`, {}, token);
    assert.equal(status, 400);
  });

  it("T20 — CANCELLED is terminal (cannot re-transition)", async () => {
    // Create fresh incident and cancel it
    const { json: inc } = await post("/platform/incidents", { title: "Cancelar", category: "OTHER", severity: "LOW" }, token);
    await patch(`/platform/incidents/${inc.id}/status`, { toStatus: "CANCELLED" }, token);
    const { status } = await patch(`/platform/incidents/${inc.id}/status`, { toStatus: "TRIAGED" }, token);
    assert.equal(status, 422);
  });

  // ── Severity change ────────────────────────────────────────────────────────

  it("T21 — change severity HIGH → CRITICAL updates priority", async () => {
    const { status, json } = await patch(`/platform/incidents/${incidentId}/severity`, { toSeverity: "CRITICAL", reason: "Impacto confirmado" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.severity, "CRITICAL");
    assert.equal(json.priority, 1);
    assert.ok(json.timeline.some(e => e.event === "SEVERITY_CHANGED"));
  });

  it("T22 — invalid severity → 400", async () => {
    const { status } = await patch(`/platform/incidents/${incidentId}/severity`, { toSeverity: "UNKNOWN" }, token);
    assert.equal(status, 400);
  });

  it("T23 — missing toSeverity → 400", async () => {
    const { status } = await patch(`/platform/incidents/${incidentId}/severity`, {}, token);
    assert.equal(status, 400);
  });

  // ── Assignment ─────────────────────────────────────────────────────────────

  it("T24 — assign incident", async () => {
    const { status, json } = await patch(`/platform/incidents/${incidentId}/assign`, {
      assigneeId: "eng-001", assigneeName: "Engenheiro Teste", reason: "Especialista em auth",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.assignedTo?.id, "eng-001");
    assert.ok(json.firstResponseAt, "firstResponseAt set on first assignment");
    assert.equal(json.assignmentHistory.length, 1);
    assert.ok(json.timeline.some(e => e.event === "ASSIGNED"));
  });

  it("T25 — reassign (history appended)", async () => {
    const { status, json } = await patch(`/platform/incidents/${incidentId}/assign`, {
      assigneeId: "eng-002", assigneeName: "Engenheiro 2", reason: "Escalonamento",
    }, token);
    assert.equal(status, 200);
    assert.equal(json.assignedTo?.id, "eng-002");
    assert.equal(json.assignmentHistory.length, 2);
  });

  it("T26 — unassign (assigneeId null)", async () => {
    const { status, json } = await patch(`/platform/incidents/${incidentId}/assign`, {}, token);
    assert.equal(status, 200);
    assert.equal(json.assignedTo, null);
    assert.equal(json.assignmentHistory.length, 3);
  });

  // ── Comments ───────────────────────────────────────────────────────────────

  it("T27 — add internal comment", async () => {
    const { status, json } = await post(`/platform/incidents/${incidentId}/comment`, { text: "Verificado com a equipe de infra." }, token);
    assert.equal(status, 200, JSON.stringify(json));
    const comment = json.timeline.find(e => e.event === "COMMENT");
    assert.ok(comment, "COMMENT entry in timeline");
    assert.equal(comment.meta?.text, "Verificado com a equipe de infra.");
  });

  it("T28 — empty comment text → 400", async () => {
    const { status } = await post(`/platform/incidents/${incidentId}/comment`, { text: "" }, token);
    assert.ok(status === 400 || status === 422);
  });

  // ── Timeline ───────────────────────────────────────────────────────────────

  it("T29 — timeline has CREATED, STATUS_CHANGED, ASSIGNED, COMMENT entries", async () => {
    const { json } = await get(`/platform/incidents/${incidentId}`, token);
    const events = json.timeline.map(e => e.event);
    assert.ok(events.includes("CREATED"));
    assert.ok(events.includes("STATUS_CHANGED"));
    assert.ok(events.includes("ASSIGNED"));
    assert.ok(events.includes("COMMENT"));
    assert.ok(events.includes("SEVERITY_CHANGED"));
    assert.ok(events.includes("REOPENED") || events.includes("STATUS_CHANGED"));
  });

  // ── Audit ──────────────────────────────────────────────────────────────────

  it("T30 — audit array has entries", async () => {
    const { json } = await get(`/platform/incidents/${incidentId}`, token);
    assert.ok(Array.isArray(json.audit) && json.audit.length >= 1);
    assert.ok(json.audit[0].by?.id);
    assert.ok(json.audit[0].at);
    assert.ok(json.audit[0].action);
  });

  // ── SLA ────────────────────────────────────────────────────────────────────

  it("T31 — SLA deadlines present and parseable", async () => {
    const { json } = await get(`/platform/incidents/${incidentId}`, token);
    assert.ok(json.sla.firstResponseDeadline);
    assert.ok(json.sla.resolutionDeadline);
    assert.ok(!isNaN(new Date(json.sla.firstResponseDeadline).getTime()));
    assert.ok(json.slaStatus !== undefined);
  });

  it("T32 — CRITICAL SLA tighter than LOW", async () => {
    const { createIncident, DEFAULT_SLA } = await import("../src/services/incident.js");
    const op = { id: "x", name: "x", role: "support_admin" };
    const critical = createIncident({ title: "c", category: "AUTH", severity: "CRITICAL", operator: op });
    const low      = createIncident({ title: "l", category: "AUTH", severity: "LOW",      operator: op, existingIncidents: [critical] });
    const crd = new Date(critical.sla.firstResponseDeadline) - new Date(critical.createdAt);
    const lrd = new Date(low.sla.firstResponseDeadline)      - new Date(low.createdAt);
    assert.ok(crd < lrd, "CRITICAL firstResponse tighter than LOW");
  });

  // ── Search / filters ───────────────────────────────────────────────────────

  it("T33 — GET /platform/incidents?severity=CRITICAL — filter works", async () => {
    const { status, json } = await get("/platform/incidents?severity=CRITICAL", token);
    assert.equal(status, 200);
    assert.ok(json.incidents.every(i => i.severity === "CRITICAL"));
  });

  it("T34 — GET /platform/incidents?category=AUTH — filter works", async () => {
    const { status, json } = await get("/platform/incidents?category=AUTH", token);
    assert.equal(status, 200);
    assert.ok(json.incidents.every(i => i.category === "AUTH"));
  });

  it("T35 — GET /platform/incidents?search=JWT — text search", async () => {
    const { status, json } = await get("/platform/incidents?search=JWT", token);
    assert.equal(status, 200);
    assert.ok(json.incidents.length >= 1, "JWT in description found");
  });

  it("T36 — GET /platform/incidents?municipalityId=4220000 — filter", async () => {
    const { status, json } = await get("/platform/incidents?municipalityId=4220000", token);
    assert.equal(status, 200);
    assert.ok(json.incidents.every(i => i.municipalityId === "4220000"));
  });

  it("T37 — GET /platform/incidents?status=REOPENED — filter", async () => {
    const { status, json } = await get("/platform/incidents?status=REOPENED", token);
    assert.equal(status, 200);
    assert.ok(json.incidents.every(i => i.status === "REOPENED"));
  });

  it("T38 — pagination: page/limit", async () => {
    const { status, json } = await get("/platform/incidents?page=1&limit=1", token);
    assert.equal(status, 200);
    assert.ok(json.incidents.length <= 1);
    assert.equal(typeof json.pages, "number");
  });

  // ── Linkage ────────────────────────────────────────────────────────────────

  it("T39 — incident can link to deploymentId and licenseId", async () => {
    const { status, json } = await post("/platform/incidents", {
      title: "Incidente de deployment",
      category: "DEPLOYMENT",
      severity: "HIGH",
      municipalityId: "4220000",
      deploymentId: "dep-uuid-001",
      licenseId:    "lic-uuid-001",
      breakGlassSessionId: "bgs-001",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    assert.equal(json.deploymentId, "dep-uuid-001");
    assert.equal(json.licenseId, "lic-uuid-001");
    assert.equal(json.breakGlassSessionId, "bgs-001");
  });

  // ── Dashboard ──────────────────────────────────────────────────────────────

  it("T40 — GET /platform/incidents-dashboard", async () => {
    const { status, json } = await get("/platform/incidents-dashboard", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(typeof json.summary.total, "number");
    assert.equal(typeof json.summary.critical, "number");
    assert.equal(typeof json.summary.inProgress, "number");
    assert.equal(typeof json.summary.resolvedToday, "number");
    assert.ok(json.byCategory !== undefined);
    assert.ok(json.bySeverity !== undefined);
    assert.equal(typeof json.affectedMunicipalities, "number");
    assert.equal(typeof json.affectedDeployments, "number");
  });

  // ── RBAC ──────────────────────────────────────────────────────────────────

  it("T41 — GET /platform/incidents without token → 401", async () => {
    const { status } = await get("/platform/incidents", "");
    assert.equal(status, 401);
  });

  it("T42 — POST /platform/incidents without token → 401", async () => {
    const { status } = await post("/platform/incidents", { title: "x", category: "AUTH", severity: "LOW" }, "");
    assert.equal(status, 401);
  });

  // ── No clinical linkage ────────────────────────────────────────────────────

  it("T43 — incident entity has no clinical fields", async () => {
    const { json } = await get(`/platform/incidents/${incidentId}`, token);
    assert.equal(json.patientId, undefined, "no patientId");
    assert.equal(json.prontuarioId, undefined, "no prontuarioId");
    assert.equal(json.clinicalEventId, undefined, "no clinicalEventId");
    assert.equal(json.attendanceId, undefined, "no attendanceId");
  });
});
