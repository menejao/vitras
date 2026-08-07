/**
 * platform-deployments.test.mjs
 * ERP-03 — Deployment Lifecycle
 *
 * Covers: creation, state machine, invalid transitions, checklist,
 * timeline, audit, RBAC, pause/resume, cancel, hierarchy MUNICIPAL→UBS.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const SADMIN_VID = "700000010";
const SADMIN_ID  = "erp03-sadmin";
const MUN_ID     = "3534401"; // São Paulo IBGE code (exists as string, no FK needed in test env)

let token = "";
let server;

async function patchReq(path, body, tok) {
  // Use the helpers `patch` if available, else use post workaround
  return patch ? patch(path, body, tok) : post(path, body, tok);
}

describe("ERP-03 — Deployment Lifecycle", () => {
  before(async () => {
    server = await startTestServer();

    await withDb((db) => {
      ensureDbShape(db);
      if (!Array.isArray(db.deployments)) db.deployments = [];

      db.users.push({
        id: SADMIN_ID, vitrasId: SADMIN_VID,
        email: "sadmin.erp03@test.local", name: "Support Admin ERP-03",
        role: "support_admin", password: hashPassword("Erp03@Test"),
        forcePasswordChange: false, inactive: false,
        unitId: null, teamId: null, municipalityId: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });

    const { json } = await post("/auth/login", { identifier: SADMIN_VID, password: "Erp03@Test" });
    token = json?.token || json?.accessToken || "";
    assert.ok(token, "support_admin token missing");
  });

  after(async () => { await stopTestServer(server); });

  // ── Creation ──────────────────────────────────────────────────────────────

  it("POST /platform/deployments — cria deployment MUNICIPAL", async () => {
    const { status, json } = await post("/platform/deployments", {
      type: "MUNICIPAL", municipalityId: MUN_ID, plannedGoLive: "2026-12-01", notes: "Teste",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    assert.equal(json.type, "MUNICIPAL");
    assert.equal(json.status, "PLANNED");
    assert.ok(json.deploymentCode.startsWith("IMP-"));
    assert.ok(Array.isArray(json.checklist));
    assert.ok(json.checklist.length >= 7, "MUNICIPAL checklist deve ter >= 7 itens");
    assert.ok(Array.isArray(json.timeline));
    assert.equal(json.timeline[0].event, "CREATED");
    assert.ok(json.checklistSummary);
  });

  it("POST /platform/deployments — cria deployment UBS vinculado", async () => {
    // First create a municipal deployment
    const { json: mun } = await post("/platform/deployments", {
      type: "MUNICIPAL", municipalityId: MUN_ID,
    }, token);
    assert.equal(mun.type, "MUNICIPAL");

    const { status, json } = await post("/platform/deployments", {
      type: "UBS", municipalityId: MUN_ID, municipalityDeploymentId: mun.id, unitId: "unit-test-01",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    assert.equal(json.type, "UBS");
    assert.equal(json.municipalityDeploymentId, mun.id);
    assert.ok(json.checklist.length >= 10, "UBS checklist deve ter >= 10 itens");
  });

  it("POST /platform/deployments — UBS sem pai → 422", async () => {
    const { status } = await post("/platform/deployments", {
      type: "UBS", municipalityId: MUN_ID, municipalityDeploymentId: "nao-existe",
    }, token);
    assert.equal(status, 422);
  });

  it("POST /platform/deployments — type inválido → 400", async () => {
    const { status } = await post("/platform/deployments", {
      type: "CLINIC", municipalityId: MUN_ID,
    }, token);
    assert.equal(status, 400);
  });

  it("POST /platform/deployments — sem municipalityId → 400", async () => {
    const { status } = await post("/platform/deployments", { type: "MUNICIPAL" }, token);
    assert.equal(status, 400);
  });

  it("deploymentCode auto-incrementa", async () => {
    const { json: a } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const { json: b } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const numA = parseInt(a.deploymentCode.split("-")[2], 10);
    const numB = parseInt(b.deploymentCode.split("-")[2], 10);
    assert.ok(numB > numA, "deploymentCode deve incrementar");
  });

  // ── State machine ─────────────────────────────────────────────────────────

  it("advance PLANNED → CONFIGURING", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const { status, json } = await post(`/platform/deployments/${dep.id}/advance`, { toStatus: "CONFIGURING" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "CONFIGURING");
    assert.ok(json.startedAt, "startedAt deve ser preenchido ao entrar em CONFIGURING");
    const ev = json.timeline.find(e => e.event === "STATUS_CHANGED");
    assert.ok(ev, "timeline deve ter STATUS_CHANGED");
    assert.equal(ev.from, "PLANNED");
    assert.equal(ev.to, "CONFIGURING");
  });

  it("advance fluxo completo PLANNED → OPERATIONAL (sem checklist obrigatório bloqueado)", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);

    // Mark all required checklist items done
    for (const item of dep.checklist.filter(i => i.required)) {
      await patch(`/platform/deployments/${dep.id}/checklist/${item.id}`, { done: true }, token);
    }

    const steps = ["CONFIGURING","MIGRATING","VALIDATING","TRAINING","READY_FOR_GO_LIVE","GO_LIVE","OPERATIONAL"];
    for (const s of steps) {
      const { status, json } = await post(`/platform/deployments/${dep.id}/advance`, { toStatus: s }, token);
      assert.equal(status, 200, `${s}: ${JSON.stringify(json)}`);
      assert.equal(json.status, s, `Status deve ser ${s}`);
    }

    const { json: final } = await get(`/platform/deployments/${dep.id}`, token);
    assert.equal(final.status, "OPERATIONAL");
    assert.ok(final.actualGoLive, "actualGoLive deve ser preenchido");
    assert.ok(final.finishedAt, "finishedAt deve ser preenchido");
  });

  it("advance PLANNED → OPERATIONAL direto → 422 (transição inválida)", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const { status } = await post(`/platform/deployments/${dep.id}/advance`, { toStatus: "OPERATIONAL" }, token);
    assert.equal(status, 422);
  });

  it("advance PLANNED → GO_LIVE direto → 422", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const { status } = await post(`/platform/deployments/${dep.id}/advance`, { toStatus: "GO_LIVE" }, token);
    assert.equal(status, 422);
  });

  it("GO_LIVE bloqueado por checklist incompleto", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const steps = ["CONFIGURING","MIGRATING","VALIDATING","TRAINING","READY_FOR_GO_LIVE"];
    for (const s of steps) {
      await post(`/platform/deployments/${dep.id}/advance`, { toStatus: s }, token);
    }
    // Checklist NOT completed
    const { status, json } = await post(`/platform/deployments/${dep.id}/advance`, { toStatus: "GO_LIVE" }, token);
    assert.equal(status, 422, JSON.stringify(json));
    assert.match(json.error, /checklist/i);
  });

  it("GO_LIVE permitido após checklist completo", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    for (const item of dep.checklist.filter(i => i.required)) {
      await patch(`/platform/deployments/${dep.id}/checklist/${item.id}`, { done: true }, token);
    }
    const steps = ["CONFIGURING","MIGRATING","VALIDATING","TRAINING","READY_FOR_GO_LIVE"];
    for (const s of steps) {
      await post(`/platform/deployments/${dep.id}/advance`, { toStatus: s }, token);
    }
    const { status } = await post(`/platform/deployments/${dep.id}/advance`, { toStatus: "GO_LIVE" }, token);
    assert.equal(status, 200);
  });

  it("CANCELLED é terminal — advance bloqueado", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    await post(`/platform/deployments/${dep.id}/cancel`, { reason: "teste" }, token);
    const { status } = await post(`/platform/deployments/${dep.id}/advance`, { toStatus: "CONFIGURING" }, token);
    assert.equal(status, 422);
  });

  // ── Pause / Resume ────────────────────────────────────────────────────────

  it("pause CONFIGURING → PAUSED, resume → CONFIGURING", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    await post(`/platform/deployments/${dep.id}/advance`, { toStatus: "CONFIGURING" }, token);

    const { status: ps, json: paused } = await post(`/platform/deployments/${dep.id}/pause`, { reason: "bloqueio" }, token);
    assert.equal(ps, 200);
    assert.equal(paused.status, "PAUSED");
    assert.equal(paused.previousStatus, "CONFIGURING");

    const { status: rs, json: resumed } = await post(`/platform/deployments/${dep.id}/resume`, {}, token);
    assert.equal(rs, 200);
    assert.equal(resumed.status, "CONFIGURING");
    assert.equal(resumed.previousStatus, null);
  });

  it("pause PLANNED → 422 (PLANNED não é pausável)", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const { status } = await post(`/platform/deployments/${dep.id}/pause`, {}, token);
    assert.equal(status, 422);
  });

  it("resume quando não pausado → 422", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const { status } = await post(`/platform/deployments/${dep.id}/resume`, {}, token);
    assert.equal(status, 422);
  });

  // ── Cancel ────────────────────────────────────────────────────────────────

  it("cancel PLANNED → CANCELLED", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const { status, json } = await post(`/platform/deployments/${dep.id}/cancel`, { reason: "desistência" }, token);
    assert.equal(status, 200);
    assert.equal(json.status, "CANCELLED");
  });

  it("cancel OPERATIONAL → 422 (não cancela operacional)", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    for (const item of dep.checklist.filter(i => i.required)) {
      await patch(`/platform/deployments/${dep.id}/checklist/${item.id}`, { done: true }, token);
    }
    for (const s of ["CONFIGURING","MIGRATING","VALIDATING","TRAINING","READY_FOR_GO_LIVE","GO_LIVE","OPERATIONAL"]) {
      await post(`/platform/deployments/${dep.id}/advance`, { toStatus: s }, token);
    }
    const { status } = await post(`/platform/deployments/${dep.id}/cancel`, { reason: "x" }, token);
    assert.equal(status, 422);
  });

  // ── Checklist ─────────────────────────────────────────────────────────────

  it("checklist item marcado com doneBy e doneAt", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "UBS", municipalityId: MUN_ID,
      municipalityDeploymentId: (await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token)).json.id,
    }, token);
    const item = dep.checklist[0];
    const { status, json } = await patch(`/platform/deployments/${dep.id}/checklist/${item.id}`,
      { done: true, observation: "ok testado" }, token);
    assert.equal(status, 200);
    const updated = json.checklist.find(i => i.id === item.id);
    assert.equal(updated.done, true);
    assert.ok(updated.doneAt);
    assert.ok(updated.doneBy?.name);
    assert.equal(updated.observation, "ok testado");
  });

  it("checklist item desmarcado limpa doneBy/doneAt", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const item = dep.checklist[0];
    await patch(`/platform/deployments/${dep.id}/checklist/${item.id}`, { done: true }, token);
    const { json } = await patch(`/platform/deployments/${dep.id}/checklist/${item.id}`, { done: false }, token);
    const updated = json.checklist.find(i => i.id === item.id);
    assert.equal(updated.done, false);
    assert.equal(updated.doneBy, null);
    assert.equal(updated.doneAt, null);
  });

  it("checklistSummary reflete progresso correto", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const required = dep.checklist.filter(i => i.required);
    assert.equal(dep.checklistSummary.requiredDone, 0);
    assert.equal(dep.checklistSummary.readyForGoLive, false);

    // Mark all required
    let last;
    for (const item of required) {
      const { json } = await patch(`/platform/deployments/${dep.id}/checklist/${item.id}`, { done: true }, token);
      last = json;
    }
    assert.equal(last.checklistSummary.requiredDone, required.length);
    assert.equal(last.checklistSummary.readyForGoLive, true);
  });

  // ── GET list and detail ───────────────────────────────────────────────────

  it("GET /platform/deployments — lista paginada", async () => {
    const { status, json } = await get("/platform/deployments?limit=5", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.deployments));
    assert.ok(typeof json.total === "number");
    assert.ok(typeof json.pages === "number");
  });

  it("GET /platform/deployments?type=MUNICIPAL — filtra por tipo", async () => {
    const { json } = await get("/platform/deployments?type=MUNICIPAL", token);
    assert.ok(json.deployments.every(d => d.type === "MUNICIPAL"));
  });

  it("GET /platform/deployments/:id — detalhe com consolidação para MUNICIPAL", async () => {
    const { json: mun } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    await post("/platform/deployments", { type: "UBS", municipalityId: MUN_ID, municipalityDeploymentId: mun.id }, token);
    await post("/platform/deployments", { type: "UBS", municipalityId: MUN_ID, municipalityDeploymentId: mun.id }, token);

    const { status, json } = await get(`/platform/deployments/${mun.id}`, token);
    assert.equal(status, 200);
    assert.ok(json.consolidation, "MUNICIPAL deve ter consolidação");
    assert.ok(typeof json.consolidation.totalUbs === "number");
    assert.ok(json.consolidation.totalUbs >= 1, "deve ter pelo menos 1 UBS filha");
    assert.ok(typeof json.consolidation.progressPct === "number");
  });

  it("GET /platform/deployments/:id — 404 para id inexistente", async () => {
    const { status } = await get("/platform/deployments/00000000-0000-0000-0000-000000000000", token);
    assert.equal(status, 404);
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────

  it("GET /platform/deployments-dashboard — retorna cards de contagem", async () => {
    const { status, json } = await get("/platform/deployments-dashboard", token);
    assert.equal(status, 200);
    assert.ok(typeof json.planned === "number");
    assert.ok(typeof json.operational === "number");
    assert.ok(typeof json.total === "number");
  });

  // ── RBAC ─────────────────────────────────────────────────────────────────

  it("GET /platform/deployments — 401 sem token", async () => {
    const { status } = await get("/platform/deployments", "invalid-token");
    assert.equal(status, 401);
  });

  // ── Timeline ──────────────────────────────────────────────────────────────

  it("timeline registra todos os eventos", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    assert.ok(dep?.id, "deployment id deve existir");

    await post(`/platform/deployments/${dep.id}/advance`, { toStatus: "CONFIGURING", reason: "ok" }, token);
    await post(`/platform/deployments/${dep.id}/pause`, { reason: "bloqueio" }, token);
    await post(`/platform/deployments/${dep.id}/resume`, { reason: "retomada" }, token);

    const { status, json } = await get(`/platform/deployments/${dep.id}`, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(Array.isArray(json.timeline), "timeline deve ser array");
    const events = json.timeline.map(e => e.event);
    assert.ok(events.includes("CREATED"), "CREATED ausente");
    assert.ok(events.includes("STATUS_CHANGED"), "STATUS_CHANGED ausente");
    assert.ok(events.includes("PAUSED"), "PAUSED ausente");
    assert.ok(events.includes("RESUMED"), "RESUMED ausente");
  });

  // ── PATCH notes ───────────────────────────────────────────────────────────

  it("PATCH /platform/deployments/:id — atualiza notes", async () => {
    const { json: dep } = await post("/platform/deployments", { type: "MUNICIPAL", municipalityId: MUN_ID }, token);
    const { status, json } = await patch(`/platform/deployments/${dep.id}`, { notes: "nota atualizada" }, token);
    assert.equal(status, 200);
    assert.equal(json.notes, "nota atualizada");
  });
});
