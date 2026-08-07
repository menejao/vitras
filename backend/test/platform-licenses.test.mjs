/**
 * ERP-04 — Licensing and Customer Lifecycle tests
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const SADMIN_VID = "700000020";
const SADMIN_ID  = "erp04-sadmin";
const MUNI_ID    = "4220000"; // test ibge_code — no FK check in JSON mode

let token = "";
let server;
let licenseId = "";
let licenseCode = "";
let customerId = "";

describe("ERP-04 — Licensing and Customer Lifecycle", () => {
  before(async () => {
    server = await startTestServer();

    await withDb((db) => {
      ensureDbShape(db);
      if (!Array.isArray(db.licenses))          db.licenses = [];
      if (!Array.isArray(db.municipalCustomers)) db.municipalCustomers = [];

      // Remove stale test user if present
      db.users = db.users.filter(u => u.id !== SADMIN_ID);

      db.users.push({
        id: SADMIN_ID, vitrasId: SADMIN_VID,
        email: "sadmin.erp04@test.local", name: "Support Admin ERP-04",
        role: "support_admin", password: hashPassword("Erp04@Test"),
        forcePasswordChange: false, inactive: false,
        unitId: null, teamId: null, municipalityId: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });

    const { json } = await post("/auth/login", { identifier: SADMIN_VID, password: "Erp04@Test" });
    token = json?.token || json?.accessToken || "";
    assert.ok(token, "support_admin token missing");
  });

  after(async () => {
    // Cleanup test user
    await withDb((db) => {
      db.users = db.users.filter(u => u.id !== SADMIN_ID);
    });
    await stopTestServer(server);
  });

  // ── License CRUD ───────────────────────────────────────────────────────────

  it("T1 — GET /platform/licenses — empty list", async () => {
    const { status, json } = await get("/platform/licenses", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.licenses));
    assert.equal(typeof json.total, "number");
    assert.equal(typeof json.pages, "number");
  });

  it("T2 — POST /platform/licenses — STARTER plan", async () => {
    const { status, json } = await post("/platform/licenses", {
      municipalityId: MUNI_ID,
      plan: "STARTER",
      contractNumber: "CT-2026-001",
      contractStart: "2026-01-01",
      contractEnd: "2026-12-31",
      renewalDate: "2026-11-01",
      notes: "Licença de teste ERP-04",
    }, token);
    assert.equal(status, 201, JSON.stringify(json));
    licenseId = json.id;
    licenseCode = json.licenseCode;
    assert.ok(licenseId, "id presente");
    assert.match(licenseCode, /^LIC-\d{4}-\d{4}$/);
    assert.equal(json.status, "DRAFT");
    assert.equal(json.plan, "STARTER");
    assert.equal(json.limits.maxUnits, 1);
    assert.equal(json.limits.maxUsers, 20);
    assert.ok(Array.isArray(json.history) && json.history.length === 1, "history[0] criado");
  });

  it("T3 — POST /platform/licenses — invalid plan → 400", async () => {
    const { status } = await post("/platform/licenses", { municipalityId: MUNI_ID, plan: "GALACTIC" }, token);
    assert.equal(status, 400);
  });

  it("T4 — POST /platform/licenses — missing municipalityId → 400", async () => {
    const { status } = await post("/platform/licenses", { plan: "STARTER" }, token);
    assert.equal(status, 400);
  });

  it("T5 — GET /platform/licenses/:id — found", async () => {
    const { status, json } = await get(`/platform/licenses/${licenseId}`, token);
    assert.equal(status, 200);
    assert.equal(json.id, licenseId);
    assert.equal(typeof json.currentUnits, "number");
    assert.equal(typeof json.currentUsers, "number");
  });

  it("T6 — GET /platform/licenses/:id — not found → 404", async () => {
    const { status } = await get("/platform/licenses/doesnotexist", token);
    assert.equal(status, 404);
  });

  it("T7 — PATCH /platform/licenses/:id — update notes and limits", async () => {
    const { status, json } = await patch(`/platform/licenses/${licenseId}`, {
      notes: "Atualizado", limits: { maxUnits: 2 }, reason: "Ampliação de contrato",
    }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.notes, "Atualizado");
    assert.equal(json.limits.maxUnits, 2);
    assert.equal(json.history.length, 2, "history entry adicionado");
  });

  it("T8 — GET /platform/plan-templates", async () => {
    const { status, json } = await get("/platform/plan-templates", token);
    assert.equal(status, 200);
    assert.ok(json.templates.STARTER);
    assert.ok(json.templates.ENTERPRISE);
    assert.ok(json.templates.CUSTOM);
  });

  // ── License status machine ─────────────────────────────────────────────────

  it("T9 — DRAFT → ACTIVE", async () => {
    const { status, json } = await post(`/platform/licenses/${licenseId}/status`, { toStatus: "ACTIVE", reason: "Contrato vigente" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "ACTIVE");
  });

  it("T10 — ACTIVE → SUSPENDED", async () => {
    const { status, json } = await post(`/platform/licenses/${licenseId}/status`, { toStatus: "SUSPENDED" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "SUSPENDED");
  });

  it("T11 — SUSPENDED → ACTIVE (reactivate)", async () => {
    const { status, json } = await post(`/platform/licenses/${licenseId}/status`, { toStatus: "ACTIVE" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "ACTIVE");
  });

  it("T12 — invalid transition ACTIVE → DRAFT → 422", async () => {
    const { status } = await post(`/platform/licenses/${licenseId}/status`, { toStatus: "DRAFT" }, token);
    assert.equal(status, 422);
  });

  it("T13 — missing toStatus → 400", async () => {
    const { status } = await post(`/platform/licenses/${licenseId}/status`, {}, token);
    assert.equal(status, 400);
  });

  it("T14 — ACTIVE → EXPIRED → ACTIVE via renew (auto-reactivate)", async () => {
    const r1 = await post(`/platform/licenses/${licenseId}/status`, { toStatus: "EXPIRED" }, token);
    assert.equal(r1.status, 200, JSON.stringify(r1.json));

    const r2 = await post(`/platform/licenses/${licenseId}/renew`, {
      newContractEnd: "2027-12-31", newRenewalDate: "2027-11-01", reason: "Renovação anual",
    }, token);
    assert.equal(r2.status, 200, JSON.stringify(r2.json));
    assert.equal(r2.json.status, "ACTIVE");
    assert.equal(r2.json.contractEnd, "2027-12-31");
  });

  it("T15 — renew missing newContractEnd → 400", async () => {
    const { status } = await post(`/platform/licenses/${licenseId}/renew`, { reason: "Sem data" }, token);
    assert.equal(status, 400);
  });

  it("T16 — ACTIVE → TERMINATED (terminal)", async () => {
    const { status, json } = await post(`/platform/licenses/${licenseId}/status`, { toStatus: "TERMINATED" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "TERMINATED");
  });

  it("T17 — TERMINATED → ACTIVE → 422 (terminal block)", async () => {
    const { status } = await post(`/platform/licenses/${licenseId}/status`, { toStatus: "ACTIVE" }, token);
    assert.equal(status, 422);
  });

  // ── License filter / pagination ────────────────────────────────────────────

  it("T18 — GET /platform/licenses?municipalityId=X — filter works", async () => {
    const { status, json } = await get(`/platform/licenses?municipalityId=${MUNI_ID}`, token);
    assert.equal(status, 200);
    assert.ok(json.licenses.every(l => l.municipalityId === MUNI_ID));
  });

  it("T19 — GET /platform/licenses?status=TERMINATED — filter works", async () => {
    const { status, json } = await get("/platform/licenses?status=TERMINATED", token);
    assert.equal(status, 200);
    assert.ok(json.licenses.every(l => l.status === "TERMINATED"));
  });

  it("T20 — versioned history — license has ≥3 history entries", async () => {
    const { json } = await get(`/platform/licenses/${licenseId}`, token);
    assert.ok(json.history.length >= 3, `history.length=${json.history.length}`);
    assert.equal(typeof json.history[0].version, "number");
    assert.ok(json.history[0].at, "history[0].at presente");
  });

  // ── Customer lifecycle ─────────────────────────────────────────────────────

  it("T21 — GET /platform/customers — returns list", async () => {
    const { status, json } = await get("/platform/customers", token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.customers));
  });

  it("T22 — POST /platform/customers — creates LEAD", async () => {
    const { status, json } = await post("/platform/customers", { municipalityId: MUNI_ID }, token);
    assert.equal(status, 201, JSON.stringify(json));
    customerId = json.id;
    assert.ok(customerId);
    assert.equal(json.customerStatus, "LEAD");
    assert.equal(json.municipalityId, MUNI_ID);
    assert.ok(Array.isArray(json.statusHistory) && json.statusHistory.length === 1);
  });

  it("T23 — POST /platform/customers — duplicate municipality → 409", async () => {
    const { status } = await post("/platform/customers", { municipalityId: MUNI_ID }, token);
    assert.equal(status, 409);
  });

  it("T24 — GET /platform/customers/:id — found", async () => {
    const { status, json } = await get(`/platform/customers/${customerId}`, token);
    assert.equal(status, 200);
    assert.equal(json.id, customerId);
  });

  it("T25 — GET /platform/customers/:id — not found → 404", async () => {
    const { status } = await get("/platform/customers/ghost", token);
    assert.equal(status, 404);
  });

  it("T26 — LEAD → CONTRACT_PENDING", async () => {
    const { status, json } = await post(`/platform/customers/${customerId}/status`, { toStatus: "CONTRACT_PENDING" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.customerStatus, "CONTRACT_PENDING");
    assert.equal(json.statusHistory.length, 2);
  });

  it("T27 — full flow: CONTRACT_PENDING → IMPLEMENTATION → TRAINING → READY_FOR_GO_LIVE → ACTIVE", async () => {
    for (const toStatus of ["IMPLEMENTATION", "TRAINING", "READY_FOR_GO_LIVE", "ACTIVE"]) {
      const { status, json } = await post(`/platform/customers/${customerId}/status`, { toStatus }, token);
      assert.equal(status, 200, `step ${toStatus}: ${JSON.stringify(json)}`);
      assert.equal(json.customerStatus, toStatus);
    }
  });

  it("T28 — invalid transition ACTIVE → LEAD → 422", async () => {
    const { status } = await post(`/platform/customers/${customerId}/status`, { toStatus: "LEAD" }, token);
    assert.equal(status, 422);
  });

  it("T29 — ACTIVE → TERMINATED", async () => {
    const { status, json } = await post(`/platform/customers/${customerId}/status`, { toStatus: "TERMINATED" }, token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.customerStatus, "TERMINATED");
  });

  it("T30 — TERMINATED → ACTIVE → 422 (terminal block)", async () => {
    const { status } = await post(`/platform/customers/${customerId}/status`, { toStatus: "ACTIVE" }, token);
    assert.equal(status, 422);
  });

  it("T31 — GET /platform/customers?customerStatus=TERMINATED", async () => {
    const { status, json } = await get("/platform/customers?customerStatus=TERMINATED", token);
    assert.equal(status, 200);
    assert.ok(json.customers.every(c => c.customerStatus === "TERMINATED"));
  });

  // ── Unit limit enforcement (unit tests via service import) ─────────────────

  it("T32 — no active license → no limit block", async () => {
    const { checkUnitLimit } = await import("../src/services/license.js");
    const result = checkUnitLimit({ license: null, currentUnitCount: 99 });
    assert.equal(result.ok, true);
  });

  it("T33 — active license at limit → blocked", async () => {
    const { checkUnitLimit, LICENSE_STATUS } = await import("../src/services/license.js");
    const license = { status: LICENSE_STATUS.ACTIVE, plan: "STARTER", limits: { maxUnits: 1 } };
    assert.equal(checkUnitLimit({ license, currentUnitCount: 1 }).ok, false);
  });

  it("T34 — active license below limit → ok", async () => {
    const { checkUnitLimit, LICENSE_STATUS } = await import("../src/services/license.js");
    const license = { status: LICENSE_STATUS.ACTIVE, plan: "ENTERPRISE", limits: { maxUnits: 20 } };
    assert.equal(checkUnitLimit({ license, currentUnitCount: 5 }).ok, true);
  });

  it("T35 — SUSPENDED license → no limit block", async () => {
    const { checkUnitLimit, LICENSE_STATUS } = await import("../src/services/license.js");
    const license = { status: LICENSE_STATUS.SUSPENDED, plan: "STARTER", limits: { maxUnits: 1 } };
    assert.equal(checkUnitLimit({ license, currentUnitCount: 99 }).ok, true);
  });

  it("T36 — null maxUnits (unlimited) → ok", async () => {
    const { checkUnitLimit, LICENSE_STATUS } = await import("../src/services/license.js");
    const license = { status: LICENSE_STATUS.ACTIVE, plan: "CUSTOM", limits: {} };
    assert.equal(checkUnitLimit({ license, currentUnitCount: 9999 }).ok, true);
  });

  // ── Dashboard ──────────────────────────────────────────────────────────────

  it("T37 — GET /platform/licenses-dashboard — cards present", async () => {
    const { status, json } = await get("/platform/licenses-dashboard", token);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(typeof json.licenses.total, "number");
    assert.equal(typeof json.licenses.active, "number");
    assert.equal(typeof json.licenses.expired, "number");
    assert.equal(typeof json.licenses.terminated, "number");
    assert.equal(typeof json.licenses.expiringIn30Days, "number");
    assert.equal(typeof json.customers.total, "number");
    assert.equal(typeof json.customers.active, "number");
    assert.equal(typeof json.customers.terminated, "number");
  });

  // ── RBAC ──────────────────────────────────────────────────────────────────

  it("T38 — GET /platform/licenses without token → 401", async () => {
    const { status } = await get("/platform/licenses", "");
    assert.equal(status, 401);
  });

  it("T39 — POST /platform/licenses without token → 401", async () => {
    const { status } = await post("/platform/licenses", { plan: "STARTER" }, "");
    assert.equal(status, 401);
  });
});
