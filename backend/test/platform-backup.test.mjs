/**
 * ERP-08 — Backup, Restore and Business Continuity tests
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const SADMIN_VID = "700000060";
const SADMIN_ID  = "erp08-sadmin";

let token       = "";
let server;
let policyId    = "";
let executionId = "";
let testId      = "";

describe("ERP-08 — Backup, Restore and Business Continuity", () => {
  before(async () => {
    server = await startTestServer();

    await withDb((db) => {
      ensureDbShape(db);
      if (!Array.isArray(db.backupPolicies))   db.backupPolicies   = [];
      if (!Array.isArray(db.backupExecutions)) db.backupExecutions = [];
      if (!Array.isArray(db.restoreTests))     db.restoreTests     = [];

      db.users = db.users.filter(u => u.id !== SADMIN_ID);
      db.users.push({
        id: SADMIN_ID, vitrasId: SADMIN_VID,
        email: "sadmin.erp08@test.local", name: "Support Admin ERP-08",
        role: "support_admin", password: hashPassword("Erp08@Test"),
        forcePasswordChange: false, inactive: false,
        unitId: null, teamId: null, municipalityId: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });

    const { json } = await post("/auth/login", { identifier: SADMIN_VID, password: "Erp08@Test" });
    token = json?.token || json?.accessToken || "";
    assert.ok(token, "support_admin token missing");
  });

  after(async () => {
    await withDb((db) => { db.users = db.users.filter(u => u.id !== SADMIN_ID); });
    await stopTestServer(server);
  });

  // ── Backup Policies ────────────────────────────────────────────────────────

  it("T1 — GET /platform/backup-policies — empty list", async () => {
    const { status, json } = await get("/platform/backup-policies", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(Array.isArray(json.policies));
    assert.equal(typeof json.total, "number");
  });

  it("T2 — POST /platform/backup-policies — create DATABASE DAILY policy", async () => {
    const { status, json } = await post("/platform/backup-policies", {
      name: "Backup BD Produção",
      scope: "DATABASE",
      backupType: "FULL",
      frequency: "DAILY",
      retentionDays: 30,
      rpoTargetMinutes: 1440,
      rtoTargetMinutes: 240,
      description: "Backup diário completo do banco",
      environment: "PRODUCTION",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    policyId = json.id;
    assert.ok(policyId);
    assert.match(json.policyCode, /^BKP-\d{4}-\d{4}$/);
    assert.equal(json.scope, "DATABASE");
    assert.equal(json.backupType, "FULL");
    assert.equal(json.frequency, "DAILY");
    assert.equal(json.retentionDays, 30);
    assert.equal(json.enabled, true);
    assert.equal(json.version, 1);
    assert.ok(json.createdBy?.id);
    assert.ok(json.audit?.length >= 1);
  });

  it("T3 — POST /platform/backup-policies — missing name → 400", async () => {
    const { status } = await post("/platform/backup-policies", {
      scope: "DATABASE", backupType: "FULL", frequency: "DAILY", retentionDays: 7,
    }, token);
    assert.equal(status, 400);
  });

  it("T4 — POST /platform/backup-policies — invalid scope → 400", async () => {
    const { status } = await post("/platform/backup-policies", {
      name: "Bad scope", scope: "GALACTIC", backupType: "FULL", frequency: "DAILY", retentionDays: 7,
    }, token);
    assert.equal(status, 400);
  });

  it("T5 — POST /platform/backup-policies — retentionDays 0 → 400", async () => {
    const { status } = await post("/platform/backup-policies", {
      name: "Bad retention", scope: "DATABASE", backupType: "FULL", frequency: "DAILY", retentionDays: 0,
    }, token);
    assert.equal(status, 400);
  });

  it("T6 — GET /platform/backup-policies/:id — returns policy with recentExecutions", async () => {
    const { status, json } = await get(`/platform/backup-policies/${policyId}`, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.id, policyId);
    assert.ok(Array.isArray(json.recentExecutions));
  });

  it("T7 — GET /platform/backup-policies/:id — not found → 404", async () => {
    const { status } = await get("/platform/backup-policies/nonexistent", token);
    assert.equal(status, 404);
  });

  it("T8 — PATCH /platform/backup-policies/:id — update retentionDays and description", async () => {
    const { status, json } = await patch(`/platform/backup-policies/${policyId}`, {
      retentionDays: 60,
      description: "Atualizado pelo teste",
      reason: "Mudança de política operacional",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.retentionDays, 60);
    assert.equal(json.version, 2, "version bumped");
    assert.ok(json.history?.length >= 1, "version history recorded");
    assert.ok(json.audit.some(a => a.action === "policy.updated"));
  });

  it("T9 — PATCH /platform/backup-policies/:id — disable policy", async () => {
    const { status, json } = await patch(`/platform/backup-policies/${policyId}`, {
      enabled: false, reason: "Temporariamente desabilitada",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.enabled, false);
  });

  it("T10 — PATCH /platform/backup-policies/:id — re-enable", async () => {
    const { status, json } = await patch(`/platform/backup-policies/${policyId}`, { enabled: true }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.enabled, true);
  });

  it("T11 — GET /platform/backup-policies?enabled=true — filter", async () => {
    const { status, json } = await get("/platform/backup-policies?enabled=true", token);
    assert.equal(status, 200);
    assert.ok(json.policies.every(p => p.enabled === true));
    assert.ok(json.policies.some(p => p.id === policyId));
  });

  // ── Backup Executions ──────────────────────────────────────────────────────

  it("T12 — GET /platform/backups — empty list", async () => {
    const { status, json } = await get("/platform/backups", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.executions));
  });

  it("T13 — POST /platform/backups — register SUCCESS execution", async () => {
    const started  = new Date(Date.now() - 600_000).toISOString();
    const finished = new Date().toISOString();
    const { status, json } = await post("/platform/backups", {
      policyId,
      startedAt:       started,
      finishedAt:      finished,
      status:          "SUCCESS",
      backupProvider:  "Neon DB",
      backupReference: "backup-neon-2026-08-07-001",
      sizeBytes:       104857600,
      checksum:        "sha256:abc123",
      verified:        true,
      environment:     "PRODUCTION",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    executionId = json.id;
    assert.ok(executionId);
    assert.match(json.executionCode, /^EXC-\d{4}-\d{4}$/);
    assert.equal(json.status, "SUCCESS");
    assert.equal(json.verified, true);
    assert.ok(json.durationSeconds > 0, "duration computed");
    assert.ok(json.recordedBy?.id);
  });

  it("T14 — POST /platform/backups — invalid status → 400", async () => {
    const { status } = await post("/platform/backups", {
      policyId, startedAt: new Date().toISOString(), status: "GALACTIC",
    }, token);
    assert.equal(status, 400);
  });

  it("T15 — POST /platform/backups — missing policyId → 400", async () => {
    const { status } = await post("/platform/backups", {
      startedAt: new Date().toISOString(), status: "SUCCESS",
    }, token);
    assert.equal(status, 400);
  });

  it("T16 — POST /platform/backups — nonexistent policyId → 404", async () => {
    const { status } = await post("/platform/backups", {
      policyId: "nonexistent-policy",
      startedAt: new Date().toISOString(), status: "SUCCESS",
    }, token);
    assert.equal(status, 404);
  });

  it("T17 — GET /platform/backups — lists execution", async () => {
    const { json } = await get("/platform/backups", token);
    assert.ok(json.executions.some(e => e.id === executionId));
  });

  it("T18 — GET /platform/backups?status=SUCCESS — filter", async () => {
    const { json } = await get("/platform/backups?status=SUCCESS", token);
    assert.ok(json.executions.every(e => e.status === "SUCCESS"));
  });

  it("T19 — GET /platform/backups — pagination", async () => {
    const { status, json } = await get("/platform/backups?page=1&limit=5", token);
    assert.equal(status, 200);
    assert.ok(json.executions.length <= 5);
    assert.equal(typeof json.pages, "number");
  });

  // ── Restore Tests ──────────────────────────────────────────────────────────

  it("T20 — GET /platform/restore-tests — empty list", async () => {
    const { status, json } = await get("/platform/restore-tests", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.restoreTests));
  });

  it("T21 — POST /platform/restore-tests — register SUCCESS test", async () => {
    const started  = new Date(Date.now() - 3_600_000).toISOString();
    const finished = new Date().toISOString();
    const { status, json } = await post("/platform/restore-tests", {
      backupExecutionId:  executionId,
      environment:        "STAGING",
      startedAt:          started,
      finishedAt:         finished,
      status:             "SUCCESS",
      verifiedBy:         "João Tech Lead",
      rpoAchievedMinutes: 120,
      rtoAchievedMinutes: 45,
      notes:              "Restore validado em ambiente de staging.",
      evidence:           [{ type: "screenshot", url: "https://internal.example.com/evidence/001" }],
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    testId = json.id;
    assert.ok(testId);
    assert.match(json.restoreCode, /^RST-\d{4}-\d{4}$/);
    assert.equal(json.status, "SUCCESS");
    assert.equal(json.environment, "STAGING");
    assert.ok(json.durationSeconds > 0);
    assert.equal(json.rpoAchievedMinutes, 120);
    assert.equal(json.rtoAchievedMinutes, 45);
    assert.ok(json.evidence?.length >= 1);
    assert.ok(json.recordedBy?.id);
    assert.ok(json.audit?.length >= 1);
  });

  it("T22 — POST /platform/restore-tests — missing backupExecutionId → 400", async () => {
    const { status } = await post("/platform/restore-tests", {
      environment: "STAGING", status: "PLANNED",
    }, token);
    assert.equal(status, 400);
  });

  it("T23 — POST /platform/restore-tests — nonexistent executionId → 404", async () => {
    const { status } = await post("/platform/restore-tests", {
      backupExecutionId: "nonexistent-exec",
      environment: "STAGING", startedAt: new Date().toISOString(), status: "PLANNED",
    }, token);
    assert.equal(status, 404);
  });

  it("T24 — PATCH /platform/restore-tests/:id — add evidence and notes", async () => {
    const { status, json } = await patch(`/platform/restore-tests/${testId}`, {
      notes:       "Evidência adicional registrada pós-revisão.",
      addEvidence: [{ type: "log", description: "Log de restore completo", url: "https://internal.example.com/log/002" }],
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(json.evidence.length >= 2, "evidence additive");
    assert.ok(json.audit.some(a => a.action === "restore.updated"));
  });

  it("T25 — GET /platform/restore-tests — filter by status=SUCCESS", async () => {
    const { json } = await get("/platform/restore-tests?status=SUCCESS", token);
    assert.ok(json.restoreTests.every(t => t.status === "SUCCESS"));
    assert.ok(json.restoreTests.some(t => t.id === testId));
  });

  it("T26 — GET /platform/restore-tests?environment=STAGING — filter", async () => {
    const { json } = await get("/platform/restore-tests?environment=STAGING", token);
    assert.ok(json.restoreTests.every(t => t.environment === "STAGING"));
  });

  // ── Business Continuity ────────────────────────────────────────────────────

  it("T27 — GET /platform/business-continuity — complete structure", async () => {
    const { status, json } = await get("/platform/business-continuity", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(json.riskLevel, "riskLevel present");
    assert.ok(["LOW","MEDIUM","HIGH","CRITICAL"].includes(json.riskLevel));
    assert.equal(typeof json.rpoTargetMinutes, "number");
    assert.equal(typeof json.rtoTargetMinutes, "number");
    assert.ok(["OK","BREACHED","UNKNOWN"].includes(json.rpoStatus));
    assert.ok(json.lastBackup?.executionCode);
    assert.ok(json.lastRestoreTest?.restoreCode);
    assert.ok(json.policies);
    assert.ok(json.executions);
    assert.ok(json.restoreTests);
    assert.ok(json.checkedAt);
    assert.ok(Array.isArray(json.alerts));
  });

  it("T28 — business-continuity — no clinical data", async () => {
    const { json } = await get("/platform/business-continuity", token);
    const str = JSON.stringify(json);
    assert.ok(!str.includes("patientId"),    "no patientId");
    assert.ok(!str.includes("prontuario"),   "no prontuario");
    assert.ok(!str.includes("atendimento"),  "no atendimento");
  });

  it("T29 — BKP-004 alert fires when policy disabled", async () => {
    // Disable the policy temporarily
    await patch(`/platform/backup-policies/${policyId}`, { enabled: false }, token);
    const { json } = await get("/platform/business-continuity", token);
    assert.ok(json.alerts.some(a => a.code === "BKP-004"), "BKP-004 fires for disabled policy");
    // Re-enable
    await patch(`/platform/backup-policies/${policyId}`, { enabled: true }, token);
  });

  it("T30 — BKP-001 fires when backup overdue (service unit test)", async () => {
    const { runBackupDiagnostics } = await import("../src/services/backup.js");
    // Policy with RPO 60 min, last backup 3 hours ago
    const oldStart = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const db = {
      backupPolicies: [{ id: "p1", policyCode: "BKP-2026-0001", enabled: true, rpoTargetMinutes: 60, rtoTargetMinutes: 120, retentionDays: 30 }],
      backupExecutions: [{ id: "e1", executionCode: "EXC-2026-0001", policyId: "p1", status: "SUCCESS", startedAt: oldStart, environment: "PRODUCTION" }],
      restoreTests: [{ id: "rt1", restoreCode: "RST-2026-0001", status: "SUCCESS", startedAt: new Date(Date.now() - 15 * 86_400_000).toISOString() }],
    };
    const alerts = runBackupDiagnostics(db);
    assert.ok(alerts.some(a => a.code === "BKP-001"), "BKP-001 fires for overdue backup");
  });

  it("T31 — BKP-002 fires when restore test overdue (service unit test)", async () => {
    const { runBackupDiagnostics } = await import("../src/services/backup.js");
    const recentBackup = new Date(Date.now() - 3_600_000).toISOString();
    const oldRestore   = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const db = {
      backupPolicies: [{ id: "p1", enabled: true, rpoTargetMinutes: 1440, rtoTargetMinutes: 240, retentionDays: 30 }],
      backupExecutions: [{ id: "e1", policyId: "p1", status: "SUCCESS", startedAt: recentBackup, environment: "PRODUCTION" }],
      restoreTests: [{ id: "rt1", status: "SUCCESS", startedAt: oldRestore }],
    };
    const alerts = runBackupDiagnostics(db);
    assert.ok(alerts.some(a => a.code === "BKP-002"), "BKP-002 fires when restore > 30 days");
  });

  it("T32 — computeBusinessContinuity — LOW risk on healthy state", async () => {
    const { computeBusinessContinuity } = await import("../src/services/backup.js");
    const recentBackup  = new Date(Date.now() - 3_600_000).toISOString();
    const recentRestore = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const db = {
      backupPolicies: [{ id: "p1", enabled: true, rpoTargetMinutes: 1440, rtoTargetMinutes: 240, retentionDays: 30 }],
      backupExecutions: [{ id: "e1", policyId: "p1", status: "SUCCESS", startedAt: recentBackup }],
      restoreTests: [{ id: "rt1", status: "SUCCESS", startedAt: recentRestore }],
    };
    const bcp = computeBusinessContinuity(db);
    assert.equal(bcp.riskLevel, "LOW");
    assert.equal(bcp.rpoStatus, "OK");
    assert.equal(bcp.backupOverdue, false);
  });

  // ── Dashboard ──────────────────────────────────────────────────────────────

  it("T33 — GET /platform/backup-dashboard — complete structure", async () => {
    const { status, json } = await get("/platform/backup-dashboard", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(json.riskLevel);
    assert.ok(json.rpoStatus);
    assert.ok(json.policies);
    assert.equal(typeof json.policies.total, "number");
    assert.ok(json.executions);
    assert.ok(json.restoreTests);
    assert.ok(Array.isArray(json.recentExecutions));
    assert.ok(Array.isArray(json.recentTests));
    assert.ok(Array.isArray(json.alerts));
    assert.ok(Array.isArray(json.executions.byEnvironment));
    assert.ok(json.generatedAt);
  });

  it("T34 — dashboard no clinical data", async () => {
    const { json } = await get("/platform/backup-dashboard", token);
    const str = JSON.stringify(json);
    assert.ok(!str.includes("patientId"),   "no patientId");
    assert.ok(!str.includes("prontuario"),  "no prontuario");
  });

  // ── Execution code increment ───────────────────────────────────────────────

  it("T35 — execution codes increment sequentially", async () => {
    const started = new Date(Date.now() - 300_000).toISOString();
    const { json } = await post("/platform/backups", {
      policyId, startedAt: started, status: "SUCCESS", environment: "PRODUCTION",
    }, token);
    assert.match(json.executionCode, /^EXC-\d{4}-\d{4}$/);
    const seq1 = parseInt(json.executionCode.split("-")[2], 10);
    assert.ok(seq1 >= 2, "second execution code >= 2");
  });

  // ── RBAC ──────────────────────────────────────────────────────────────────

  it("T36 — GET /platform/backup-policies without token → 401", async () => {
    const { status } = await get("/platform/backup-policies", "");
    assert.equal(status, 401);
  });

  it("T37 — GET /platform/backups without token → 401", async () => {
    const { status } = await get("/platform/backups", "");
    assert.equal(status, 401);
  });

  it("T38 — GET /platform/restore-tests without token → 401", async () => {
    const { status } = await get("/platform/restore-tests", "");
    assert.equal(status, 401);
  });

  it("T39 — GET /platform/business-continuity without token → 401", async () => {
    const { status } = await get("/platform/business-continuity", "");
    assert.equal(status, 401);
  });

  it("T40 — GET /platform/backup-dashboard without token → 401", async () => {
    const { status } = await get("/platform/backup-dashboard", "");
    assert.equal(status, 401);
  });

  // ── Audit chain ────────────────────────────────────────────────────────────

  it("T41 — policy audit chain contains created + 4 updated entries", async () => {
    const { json } = await get(`/platform/backup-policies/${policyId}`, token);
    const actions = json.audit.map(a => a.action);
    assert.ok(actions.includes("policy.created"));
    assert.ok(actions.filter(a => a === "policy.updated").length >= 2, "at least 2 updates recorded");
  });

  it("T42 — restore test audit chain contains created + updated", async () => {
    const { json } = await get("/platform/restore-tests", token);
    const rt = json.restoreTests.find(t => t.id === testId);
    assert.ok(rt);
    assert.ok(rt.audit.some(a => a.action === "restore.created"));
    assert.ok(rt.audit.some(a => a.action === "restore.updated"));
  });

  // ── No clinical data in any entity ────────────────────────────────────────

  it("T43 — backup execution has no clinical fields", async () => {
    const { json } = await get("/platform/backups", token);
    const exec = json.executions.find(e => e.id === executionId);
    assert.ok(exec);
    assert.equal(exec.patientId,        undefined);
    assert.equal(exec.prontuarioId,     undefined);
    assert.equal(exec.clinicalEventId,  undefined);
    assert.equal(exec.attendanceId,     undefined);
  });

  it("T44 — restore test has no clinical fields", async () => {
    const { json } = await get("/platform/restore-tests", token);
    const rt = json.restoreTests.find(t => t.id === testId);
    assert.ok(rt);
    assert.equal(rt.patientId,       undefined);
    assert.equal(rt.prontuarioId,    undefined);
    assert.equal(rt.clinicalEventId, undefined);
  });

  // ── Service unit tests ─────────────────────────────────────────────────────

  it("T45 — generatePolicyCode increments by year", async () => {
    const { generatePolicyCode } = await import("../src/services/backup.js");
    const year = new Date().getFullYear();
    assert.equal(generatePolicyCode([]),                                    `BKP-${year}-0001`);
    assert.equal(generatePolicyCode([{ policyCode: `BKP-${year}-0003` }]), `BKP-${year}-0004`);
  });
});
