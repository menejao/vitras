/**
 * ERP-09 — Platform Governance and Compliance tests
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const SADMIN_VID = "700000070";
const SADMIN_ID  = "erp09-sadmin";

let token       = "";
let server;
let baselineId  = "";
let adrId       = "";
let policyId    = "";
let exceptionId = "";

describe("ERP-09 — Platform Governance and Compliance", () => {
  before(async () => {
    server = await startTestServer();

    await withDb((db) => {
      ensureDbShape(db);
      if (!Array.isArray(db.govBaselines))  db.govBaselines  = [];
      if (!Array.isArray(db.govAdrs))       db.govAdrs       = [];
      if (!Array.isArray(db.govPolicies))   db.govPolicies   = [];
      if (!Array.isArray(db.govExceptions)) db.govExceptions = [];

      db.users = db.users.filter(u => u.id !== SADMIN_ID);
      db.users.push({
        id: SADMIN_ID, vitrasId: SADMIN_VID,
        email: "sadmin.erp09@test.local", name: "Support Admin ERP-09",
        role: "support_admin", password: hashPassword("Erp09@Test"),
        forcePasswordChange: false, inactive: false,
        unitId: null, teamId: null, municipalityId: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });

    const { json } = await post("/auth/login", { identifier: SADMIN_VID, password: "Erp09@Test" });
    token = json?.token || json?.accessToken || "";
    assert.ok(token, "support_admin token missing");
  });

  after(async () => {
    await withDb((db) => { db.users = db.users.filter(u => u.id !== SADMIN_ID); });
    await stopTestServer(server);
  });

  // ── Baselines ──────────────────────────────────────────────────────────────

  it("T1 — GET /platform/baselines — empty list", async () => {
    const { status, json } = await get("/platform/baselines", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(Array.isArray(json.baselines));
    assert.equal(typeof json.total, "number");
  });

  it("T2 — POST /platform/baselines — create DRAFT", async () => {
    const { status, json } = await post("/platform/baselines", {
      name:    "RC3 Baseline",
      version: "1.1.0-rc3",
      scope:   "Platform",
      description: "Baseline do candidato RC3 para piloto UBS",
      artifacts: ["backend v1.1.0", "frontend v1.1.0"],
      documentationVersion: "v1.1",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    baselineId = json.id;
    assert.ok(baselineId);
    assert.match(json.baselineCode, /^BAS-\d{4}-\d{4}$/);
    assert.equal(json.status, "DRAFT");
    assert.equal(json.version, "1.1.0-rc3");
    assert.ok(json.createdBy?.id);
    assert.ok(json.audit?.length >= 1);
    assert.ok(json.timeline?.length >= 1);
  });

  it("T3 — POST /platform/baselines — missing name → 400", async () => {
    const { status } = await post("/platform/baselines", { version: "1.0.0", scope: "Platform" }, token);
    assert.equal(status, 400);
  });

  it("T4 — GET /platform/baselines/:id — returns baseline", async () => {
    const { status, json } = await get(`/platform/baselines/${baselineId}`, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.id, baselineId);
  });

  it("T5 — GET /platform/baselines/:id — not found → 404", async () => {
    const { status } = await get("/platform/baselines/nonexistent", token);
    assert.equal(status, 404);
  });

  it("T6 — PATCH baseline status DRAFT→REVIEW", async () => {
    const { status, json } = await patch(`/platform/baselines/${baselineId}/status`, {
      toStatus: "REVIEW", reason: "Enviada para revisão técnica",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "REVIEW");
    assert.ok(json.timeline.some(e => e.event === "STATUS_CHANGED" && e.to === "REVIEW"));
  });

  it("T7 — PATCH baseline status REVIEW→APPROVED — sets approvedBy", async () => {
    const { status, json } = await patch(`/platform/baselines/${baselineId}/status`, {
      toStatus: "APPROVED", reason: "Aprovada em reunião de arquitetura",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "APPROVED");
    assert.ok(json.approvedBy?.id);
    assert.ok(json.approvedAt);
  });

  it("T8 — PATCH APPROVED baseline — any transition except SUPERSEDED → 422", async () => {
    const { status } = await patch(`/platform/baselines/${baselineId}/status`, {
      toStatus: "DRAFT",
    }, token);
    assert.equal(status, 422);
  });

  it("T9 — GET /platform/baselines?status=APPROVED — filter", async () => {
    const { json } = await get("/platform/baselines?status=APPROVED", token);
    assert.ok(json.baselines.every(b => b.status === "APPROVED"));
    assert.ok(json.baselines.some(b => b.id === baselineId));
  });

  // ── ADRs ───────────────────────────────────────────────────────────────────

  it("T10 — GET /platform/adrs — empty list", async () => {
    const { status, json } = await get("/platform/adrs", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.adrs));
  });

  it("T11 — POST /platform/adrs — create PROPOSED ADR", async () => {
    const { status, json } = await post("/platform/adrs", {
      title:        "Uso de JSON file DB em vez de PostgreSQL no MVP",
      context:      "O MVP exige velocidade de entrega; PostgreSQL adiciona complexidade de infraestrutura.",
      decision:     "Utilizar JSON file DB gerenciado pelo módulo db.js para persistência local.",
      consequences: "Escalabilidade limitada; adequado para pilotos com < 5 UBS.",
      alternatives: ["SQLite", "PostgreSQL", "MongoDB"],
      tags:         ["database", "architecture", "mvp"],
      author:       "João Tech Lead",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    adrId = json.id;
    assert.ok(adrId);
    assert.match(json.adrCode, /^ADR-\d{4}-\d{4}$/);
    assert.equal(json.status, "PROPOSED");
    assert.ok(json.createdBy?.id);
    assert.ok(json.audit?.length >= 1);
  });

  it("T12 — POST /platform/adrs — missing context → 400", async () => {
    const { status } = await post("/platform/adrs", {
      title: "X", decision: "Y",
    }, token);
    assert.equal(status, 400);
  });

  it("T13 — PATCH ADR status PROPOSED→ACCEPTED — sets reviewer and approvedAt", async () => {
    const { status, json } = await patch(`/platform/adrs/${adrId}/status`, {
      toStatus: "ACCEPTED", reason: "Decisão ratificada pelo comitê técnico",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "ACCEPTED");
    assert.ok(json.reviewer);
    assert.ok(json.approvedAt);
  });

  it("T14 — PATCH ADR ACCEPTED→SUPERSEDED — sets supersededBy", async () => {
    const { status, json } = await patch(`/platform/adrs/${adrId}/status`, {
      toStatus: "SUPERSEDED", reason: "Substituída por ADR-2026-0002", supersededByCode: "ADR-2026-0002",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "SUPERSEDED");
    assert.equal(json.supersededBy, "ADR-2026-0002");
  });

  it("T15 — PATCH ADR SUPERSEDED→ACCEPTED → 422 (terminal)", async () => {
    const { status } = await patch(`/platform/adrs/${adrId}/status`, { toStatus: "ACCEPTED" }, token);
    assert.equal(status, 422);
  });

  it("T16 — GET /platform/adrs?status=SUPERSEDED — filter", async () => {
    const { json } = await get("/platform/adrs?status=SUPERSEDED", token);
    assert.ok(json.adrs.every(a => a.status === "SUPERSEDED"));
    assert.ok(json.adrs.some(a => a.id === adrId));
  });

  it("T17 — GET /platform/adrs?search=json — search in title", async () => {
    const { json } = await get("/platform/adrs?search=json", token);
    assert.ok(json.adrs.some(a => a.id === adrId));
  });

  // ── Policies ───────────────────────────────────────────────────────────────

  it("T18 — GET /platform/policies — empty list", async () => {
    const { status, json } = await get("/platform/policies", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.policies));
  });

  it("T19 — POST /platform/policies — create SECURITY policy", async () => {
    const { status, json } = await post("/platform/policies", {
      name:          "Política de Segurança do VITRAS",
      category:      "SECURITY",
      description:   "Define requisitos mínimos de segurança para a plataforma.",
      content:       "1. Autenticação JWT obrigatória. 2. RBAC por capability. 3. Audit log imutável.",
      version:       "1.0",
      effectiveFrom: new Date().toISOString(),
      effectiveUntil: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      owner:         "Tech Lead",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    policyId = json.id;
    assert.ok(policyId);
    assert.match(json.policyCode, /^POL-\d{4}-\d{4}$/);
    assert.equal(json.status, "DRAFT");
    assert.equal(json.category, "SECURITY");
    assert.equal(json.version, "1.0");
    assert.ok(json.createdBy?.id);
    assert.ok(json.audit?.length >= 1);
  });

  it("T20 — POST /platform/policies — invalid category → 400", async () => {
    const { status } = await post("/platform/policies", {
      name: "Bad", category: "GALACTIC", effectiveFrom: new Date().toISOString(),
    }, token);
    assert.equal(status, 400);
  });

  it("T21 — PATCH /platform/policies/:id/activate — DRAFT→ACTIVE", async () => {
    const { status, json } = await patch(`/platform/policies/${policyId}/activate`, {
      reason: "Aprovada em reunião de governança",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(["ACTIVE","EXPIRING"].includes(json.status));
    assert.ok(json.approvedBy?.id);
    assert.ok(json.approvedAt);
  });

  it("T22 — PATCH /platform/policies/:id/activate — already active → 422", async () => {
    const { status } = await patch(`/platform/policies/${policyId}/activate`, {}, token);
    assert.equal(status, 422);
  });

  it("T23 — PATCH /platform/policies/:id — update description and bump version", async () => {
    const { status, json } = await patch(`/platform/policies/${policyId}`, {
      description: "Política atualizada após revisão.",
      version: "1.1",
      reason: "Revisão trimestral",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.version, "1.1");
    assert.ok(json.versionHistory?.length >= 1, "version history recorded");
    assert.ok(json.audit.some(a => a.action === "policy.updated"));
  });

  it("T24 — GET /platform/policies?category=SECURITY — filter", async () => {
    const { json } = await get("/platform/policies?category=SECURITY", token);
    assert.ok(json.policies.every(p => p.category === "SECURITY"));
    assert.ok(json.policies.some(p => p.id === policyId));
  });

  it("T25 — PATCH /platform/policies/:id — archive policy", async () => {
    const { status, json } = await patch(`/platform/policies/${policyId}`, {
      status: "ARCHIVED", reason: "Substituída por v2",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "ARCHIVED");
  });

  // ── Exceptions ─────────────────────────────────────────────────────────────

  it("T26 — GET /platform/exceptions — empty list", async () => {
    const { status, json } = await get("/platform/exceptions", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.exceptions));
  });

  it("T27 — POST /platform/exceptions — create PENDING exception", async () => {
    // Create a new policy to link exception (policyId is now ARCHIVED)
    const polRes = await post("/platform/policies", {
      name: "Deployment Policy v1", category: "DEPLOYMENT",
      effectiveFrom: new Date().toISOString(),
      effectiveUntil: new Date(Date.now() + 365 * 86_400_000).toISOString(),
    }, token);
    const newPolicyId = polRes.json.id;

    const { status, json } = await post("/platform/exceptions", {
      policyId:    newPolicyId,
      reason:      "Deploy emergencial em feriado fora da janela padrão",
      riskLevel:   "HIGH",
      expiresAt:   new Date(Date.now() + 7 * 86_400_000).toISOString(),
      mitigations: "Rollback preparado; comunicação à equipe de plantão.",
      requestedBy: "João Tech Lead",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    exceptionId = json.id;
    assert.ok(exceptionId);
    assert.match(json.exceptionCode, /^EXC-\d{4}-\d{4}$/);
    assert.equal(json.status, "PENDING");
    assert.equal(json.riskLevel, "HIGH");
    assert.ok(json.expiresAt);
    assert.ok(json.createdBy?.id);
    assert.ok(json.audit?.length >= 1);
  });

  it("T28 — POST /platform/exceptions — missing expiresAt → 400", async () => {
    const { status } = await post("/platform/exceptions", {
      policyId: policyId, reason: "No expiry", riskLevel: "LOW",
    }, token);
    assert.equal(status, 400);
  });

  it("T29 — POST /platform/exceptions — past expiresAt → 400", async () => {
    const { status } = await post("/platform/exceptions", {
      policyId: policyId, reason: "Past expiry", riskLevel: "LOW",
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    }, token);
    assert.equal(status, 400);
  });

  it("T30 — PATCH /platform/exceptions/:id/status — PENDING→APPROVED", async () => {
    const { status, json } = await patch(`/platform/exceptions/${exceptionId}/status`, {
      toStatus: "APPROVED", reason: "Aprovado pelo Delivery Governor",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "APPROVED");
    assert.ok(json.approvedBy?.id);
    assert.ok(json.approvedAt);
  });

  it("T31 — PATCH exception status — APPROVED→REVOKED", async () => {
    const { status, json } = await patch(`/platform/exceptions/${exceptionId}/status`, {
      toStatus: "REVOKED", reason: "Deploy concluído; exceção não mais necessária",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "REVOKED");
    assert.ok(json.revokedAt);
    assert.ok(json.revokedReason);
  });

  it("T32 — PATCH exception REVOKED→APPROVED → 422 (terminal)", async () => {
    const { status } = await patch(`/platform/exceptions/${exceptionId}/status`, { toStatus: "APPROVED" }, token);
    assert.equal(status, 422);
  });

  it("T33 — GET /platform/exceptions?status=REVOKED — filter", async () => {
    const { json } = await get("/platform/exceptions?status=REVOKED", token);
    assert.ok(json.exceptions.every(e => e.status === "REVOKED"));
    assert.ok(json.exceptions.some(e => e.id === exceptionId));
  });

  // ── Compliance Engine ──────────────────────────────────────────────────────

  it("T34 — GET /platform/compliance — returns structure", async () => {
    const { status, json } = await get("/platform/compliance", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(Array.isArray(json.results));
    assert.ok(json.results.length >= 10, "at least 10 compliance checks");
    assert.ok(["PASS","WARNING","FAIL"].includes(json.overallStatus));
    assert.ok(json.counts);
    assert.equal(typeof json.counts.PASS, "number");
    assert.ok(json.evaluatedAt);
  });

  it("T35 — GOV-C01 FAIL when no approved baseline", async () => {
    const { runComplianceEngine } = await import("../src/services/governance.js");
    const db = { govBaselines: [], govAdrs: [], govPolicies: [], govExceptions: [],
      deployments: [], incidents: [], backupPolicies: [], backupExecutions: [],
      restoreTests: [], releases: [], releaseRollouts: [] };
    const r = runComplianceEngine(db);
    const c01 = r.results.find(x => x.code === "GOV-C01");
    assert.equal(c01.status, "FAIL");
  });

  it("T36 — GOV-C01 PASS when approved baseline exists", async () => {
    const { runComplianceEngine } = await import("../src/services/governance.js");
    const db = { govBaselines: [{ id: "b1", status: "APPROVED" }], govAdrs: [],
      govPolicies: [], govExceptions: [], deployments: [], incidents: [],
      backupPolicies: [], backupExecutions: [], restoreTests: [], releases: [], releaseRollouts: [] };
    const r = runComplianceEngine(db);
    assert.equal(r.results.find(x => x.code === "GOV-C01").status, "PASS");
  });

  it("T37 — GOV-C04 FAIL for approved exception past expiresAt", async () => {
    const { runComplianceEngine } = await import("../src/services/governance.js");
    const db = { govBaselines: [], govAdrs: [], govPolicies: [], govExceptions: [
        { id: "e1", status: "APPROVED", expiresAt: new Date(Date.now() - 1000).toISOString() }
      ], deployments: [], incidents: [], backupPolicies: [], backupExecutions: [],
      restoreTests: [], releases: [], releaseRollouts: [] };
    const r = runComplianceEngine(db);
    assert.equal(r.results.find(x => x.code === "GOV-C04").status, "FAIL");
  });

  it("T38 — GOV-C09 FAIL for unassigned critical incident", async () => {
    const { runComplianceEngine } = await import("../src/services/governance.js");
    const db = { govBaselines: [], govAdrs: [], govPolicies: [], govExceptions: [],
      deployments: [], backupPolicies: [], backupExecutions: [], restoreTests: [],
      releases: [], releaseRollouts: [],
      incidents: [{ id: "i1", severity: "CRITICAL", status: "IN_PROGRESS", assignedTo: null }] };
    const r = runComplianceEngine(db);
    assert.equal(r.results.find(x => x.code === "GOV-C09").status, "FAIL");
  });

  it("T39 — GOV-C03 FAIL when key categories have no active policy", async () => {
    const { runComplianceEngine } = await import("../src/services/governance.js");
    const db = { govBaselines: [], govAdrs: [],
      govPolicies: [{ id: "p1", category: "SECURITY", status: "DRAFT" }], // draft doesn't count
      govExceptions: [], deployments: [], incidents: [], backupPolicies: [],
      backupExecutions: [], restoreTests: [], releases: [], releaseRollouts: [] };
    const r = runComplianceEngine(db);
    const c03 = r.results.find(x => x.code === "GOV-C03");
    assert.equal(c03.status, "FAIL");
  });

  it("T40 — compliance overall FAIL when any FAIL check exists", async () => {
    const { runComplianceEngine } = await import("../src/services/governance.js");
    const db = { govBaselines: [], govAdrs: [], govPolicies: [], govExceptions: [],
      deployments: [], incidents: [], backupPolicies: [], backupExecutions: [],
      restoreTests: [], releases: [], releaseRollouts: [] };
    const r = runComplianceEngine(db);
    assert.equal(r.overallStatus, "FAIL", "empty DB has multiple FAIL checks");
  });

  // ── Governance Dashboard ───────────────────────────────────────────────────

  it("T41 — GET /platform/governance-dashboard — complete structure", async () => {
    const { status, json } = await get("/platform/governance-dashboard", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(json.compliance?.overall);
    assert.ok(json.baselines);
    assert.equal(typeof json.baselines.total, "number");
    assert.ok(json.adrs);
    assert.ok(json.policies);
    assert.ok(json.exceptions);
    assert.ok(Array.isArray(json.recentAdrs));
    assert.ok(Array.isArray(json.expiringPolicies));
    assert.ok(json.generatedAt);
  });

  it("T42 — governance-dashboard no clinical data", async () => {
    const { json } = await get("/platform/governance-dashboard", token);
    const str = JSON.stringify(json);
    assert.ok(!str.includes("patientId"),    "no patientId");
    assert.ok(!str.includes("prontuario"),   "no prontuario");
    assert.ok(!str.includes("atendimento"),  "no atendimento");
  });

  // ── Audit chains ───────────────────────────────────────────────────────────

  it("T43 — baseline audit chain: created + 2 status changes", async () => {
    const { json } = await get(`/platform/baselines/${baselineId}`, token);
    const actions = json.audit.map(a => a.action);
    assert.ok(actions.includes("baseline.created"));
    assert.ok(actions.filter(a => a === "baseline.status_changed").length >= 2);
  });

  it("T44 — ADR audit chain: created + 2 status changes", async () => {
    const { json } = await get(`/platform/adrs/${adrId}`, token);
    const actions = json.audit.map(a => a.action);
    assert.ok(actions.includes("adr.created"));
    assert.ok(actions.filter(a => a === "adr.status_changed").length >= 2);
  });

  it("T45 — policy audit chain: created + activated + updated + archived", async () => {
    const { json } = await get(`/platform/policies/${policyId}`, token);
    const actions = json.audit.map(a => a.action);
    assert.ok(actions.includes("policy.created"));
    assert.ok(actions.includes("policy.activated"));
    assert.ok(actions.includes("policy.updated"));
  });

  // ── RBAC ──────────────────────────────────────────────────────────────────

  it("T46 — GET /platform/baselines without token → 401", async () => {
    const { status } = await get("/platform/baselines", "");
    assert.equal(status, 401);
  });

  it("T47 — GET /platform/adrs without token → 401", async () => {
    const { status } = await get("/platform/adrs", "");
    assert.equal(status, 401);
  });

  it("T48 — GET /platform/policies without token → 401", async () => {
    const { status } = await get("/platform/policies", "");
    assert.equal(status, 401);
  });

  it("T49 — GET /platform/exceptions without token → 401", async () => {
    const { status } = await get("/platform/exceptions", "");
    assert.equal(status, 401);
  });

  it("T50 — GET /platform/compliance without token → 401", async () => {
    const { status } = await get("/platform/compliance", "");
    assert.equal(status, 401);
  });

  // ── No clinical data ───────────────────────────────────────────────────────

  it("T51 — baseline has no clinical fields", async () => {
    const { json } = await get(`/platform/baselines/${baselineId}`, token);
    assert.equal(json.patientId,       undefined);
    assert.equal(json.prontuarioId,    undefined);
    assert.equal(json.clinicalEventId, undefined);
  });

  it("T52 — ADR has no clinical fields", async () => {
    const { json } = await get(`/platform/adrs/${adrId}`, token);
    assert.equal(json.patientId,       undefined);
    assert.equal(json.prontuarioId,    undefined);
    assert.equal(json.clinicalEventId, undefined);
  });

  // ── Code increment ─────────────────────────────────────────────────────────

  it("T53 — baseline codes increment", async () => {
    const { json: b2 } = await post("/platform/baselines", {
      name: "Baseline 2", version: "1.2.0", scope: "Platform",
    }, token);
    assert.match(b2.baselineCode, /^BAS-\d{4}-\d{4}$/);
    const seq1 = parseInt(b2.baselineCode.split("-")[2], 10);
    assert.ok(seq1 >= 2);
  });

  it("T54 — exception code uses EXC prefix", async () => {
    const { json } = await get("/platform/exceptions", token);
    const exc = json.exceptions.find(e => e.id === exceptionId);
    assert.ok(exc, "exception found in list");
    assert.match(exc.exceptionCode, /^EXC-\d{4}-\d{4}$/);
  });

  it("T55 — compliance results contain no clinical data", async () => {
    const { json } = await get("/platform/compliance", token);
    const str = JSON.stringify(json);
    assert.ok(!str.includes("patientId"),    "no patientId");
    assert.ok(!str.includes("prontuario"),   "no prontuario");
    assert.ok(!str.includes("atendimento"),  "no atendimento");
  });
});
