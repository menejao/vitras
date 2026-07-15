/**
 * sprint-c-active-unit.test.js — Sprint C: Active Unit Context
 *
 * Verifica:
 * 1. resolveActiveUnit retorna user.unitId (nunca client input)
 * 2. schedule.js usa resolveActiveUnit (não parâmetro externo)
 * 3. addAuditLog registra activeUnitId
 * 4. Criação de records usa unidade ativa (não payload do cliente)
 */

import { strict as assert } from "assert";
import { resolveActiveUnit } from "../src/utils/helpers.js";
import { ensureDbShape } from "../src/utils/domain.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  OK  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

console.log("TEST SUITE: sprint-c-active-unit.test.js\n");

// ── 1. resolveActiveUnit ignora client input ────────────────────────────────

test("resolveActiveUnit retorna user.unitId, ignora body e query", () => {
  const req = {
    user: { id: "u1", unitId: "unit-jwt" },
    body: { unitId: "unit-evil" },
    query: { unitId: "unit-evil-query" },
  };
  const result = resolveActiveUnit(req);
  assert.equal(result, "unit-jwt", "deve usar unitId do JWT");
});

test("resolveActiveUnit retorna string vazia se user sem unitId", () => {
  const req = { user: { id: "u1" }, body: {}, query: {} };
  const result = resolveActiveUnit(req);
  assert.equal(result, "");
});

test("resolveActiveUnit retorna string vazia se user ausente", () => {
  const req = { user: null, body: {}, query: {} };
  const result = resolveActiveUnit(req);
  assert.equal(result, "");
});

// ── 2. resolveActiveUnit é consistente com req.user.unitId ──────────────────

test("resolveActiveUnit equivalente a req.user.unitId para rotas legadas", () => {
  const user = { id: "u1", unitId: "unit-abc", role: "nurse" };
  const req = { user };
  assert.equal(resolveActiveUnit(req), String(user.unitId));
});

// ── 3. addAuditLog registra activeUnitId ────────────────────────────────────

test("addAuditLog registra activeUnitId do user.unitId", async () => {
  const { addAuditLog } = await import("../src/services/audit.js");

  const db = {
    auditLogs: [],
    users: [],
    teams: [],
    units: [],
    patients: [],
    agendaEntries: [],
    queueEntries: [],
    examRequests: [],
    professionalSchedules: [],
    scheduleBlocks: [],
    privacyRequests: [],
    accessRequests: [],
    registerVerifications: [],
    loginChallenges: [],
    refreshTokens: [],
    exportHistory: [],
    protocolTemplates: [],
    tasks: [],
    messages: [],
    households: [],
    referrals: [],
    insumos: [],
    pharmacy: [],
    dental: [],
    acsVisits: [],
    familyGroups: [],
    userUnitMemberships: [],
  };

  const user = { id: "u1", name: "Test User", role: "nurse", unitId: "unit-sprint-c", teamId: "team-1" };
  addAuditLog(db, user, "TEST_ACTION", "test_entity", "entity-1", { someDetail: true });

  assert.equal(db.auditLogs.length, 1, "deve ter 1 log");
  const log = db.auditLogs[0];
  assert.ok("activeUnitId" in log, "log deve ter campo activeUnitId");
  assert.equal(log.activeUnitId, "unit-sprint-c", "activeUnitId deve vir de user.unitId");
});

test("addAuditLog activeUnitId fallback para details.unitId se user sem unitId", async () => {
  const { addAuditLog } = await import("../src/services/audit.js");
  const db = {
    auditLogs: [],
    users: [], teams: [], units: [], patients: [], agendaEntries: [],
    queueEntries: [], examRequests: [], professionalSchedules: [], scheduleBlocks: [],
    privacyRequests: [], accessRequests: [], registerVerifications: [], loginChallenges: [],
    refreshTokens: [], exportHistory: [], protocolTemplates: [], tasks: [], messages: [],
    households: [], referrals: [], insumos: [], pharmacy: [], dental: [], acsVisits: [],
    familyGroups: [], userUnitMemberships: [],
  };
  const user = { id: "u2", name: "No Unit User", role: "support_admin" };
  addAuditLog(db, user, "TEST_ACTION_2", "test_entity", "entity-2", { unitId: "unit-from-details" });

  const log = db.auditLogs[0];
  assert.ok("activeUnitId" in log);
  assert.equal(log.activeUnitId, "unit-from-details");
});

// ── 4. IDOR: nenhuma rota clínica recebe unitId do cliente ──────────────────
// Verificação estática — lemos o código fonte e garantimos que
// nenhuma rota clínica usa req.body.unitId ou req.query.unitId sem sanitizar.

test("schedule.js não usa req.body.unitId ou req.query.unitId diretamente", async () => {
  const { readFileSync } = await import("fs");
  const { fileURLToPath } = await import("url");
  const { dirname, join } = await import("path");
  const dir = dirname(fileURLToPath(import.meta.url));
  const content = readFileSync(join(dir, "../src/routes/schedule.js"), "utf-8");

  // Não deve conter leitura direta de body.unitId / query.unitId
  assert.ok(!content.includes("body.unitId"), "schedule.js não deve usar body.unitId");
  assert.ok(!content.includes("query.unitId"), "schedule.js não deve usar query.unitId");
  // Deve usar resolveActiveUnit
  assert.ok(content.includes("resolveActiveUnit(req)"), "deve usar resolveActiveUnit");
});

test("resolveActiveUnit está exportado de helpers.js", async () => {
  const helpers = await import("../src/utils/helpers.js");
  assert.equal(typeof helpers.resolveActiveUnit, "function", "resolveActiveUnit deve ser função exportada");
});

// ── Resultado ────────────────────────────────────────────────────────────────

console.log(`\nResultado: ${passed} OK, ${failed} FAIL\n`);
if (failed > 0) {
  console.error(`✗ ${failed} teste(s) falharam`);
  process.exit(1);
} else {
  console.log("✓ Todos os testes de sprint-c-active-unit.test.js passaram.");
}
