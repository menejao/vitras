/**
 * BUG-CLINIC-01 regression tests
 *
 * Validates that:
 * 1. Local/clinical users can access clinical endpoints (/bootstrap, /patients, etc.)
 * 2. "Acesso restrito ao Console Nacional" does NOT propagate to clinical users
 * 3. support_admin is blocked from clinical endpoints
 * 4. support_admin can still access /platform/* endpoints
 * 5. break_glass_admin loads dashboard data correctly
 * 6. Team Scope is preserved for scoped users
 *
 * Root cause fixed: platform.js used router.use(requireAuth, requireSupportAdmin)
 * without a path prefix. Since platformRouter was mounted at "/" (all paths) BEFORE
 * the global requireAuth in app.js, EVERY request by non-support_admin users was
 * intercepted and returned 403 "Acesso restrito ao Console Nacional".
 * Fix: router.use("/platform", requireAuth, requireSupportAdmin)
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function injectUser(overrides) {
  const { withDb } = await import("../src/db.js");
  const { hashPassword } = await import("../src/services/crypto.js");
  const { v4: uuidv4 } = await import("uuid");
  const { ensureDbShape } = await import("../src/utils/domain.js");
  const id = uuidv4();
  await withDb((db) => {
    ensureDbShape(db);
    if (db.users.some((u) => u.email === overrides.email)) return;
    db.users.push({
      id,
      name: overrides.name || "Test User",
      role: overrides.role,
      email: overrides.email,
      password: hashPassword(overrides.password),
      teamId: overrides.teamId || "",
      unitId: overrides.unitId || "",
      municipalityId: "3550308",
      twoFactorEnabled: false,
      twoFactorSecret: "",
      twoFactorPendingSecret: "",
      twoFactorPendingCreatedAt: "",
      forcePasswordChange: false,
      passwordUpdatedAt: null,
      temporaryPasswordIssuedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });
  return id;
}

async function login(email, password) {
  const res = await post("/auth/login", { email, password });
  assert.equal(res.status, 200, `login ${email} failed: ${JSON.stringify(res.json)}`);
  return res.json.token || res.json.accessToken;
}

const SA_EMAIL    = `sa-clinic01-${Date.now()}@support.test`;
const SA_PW       = "Support@12345!";
const BG_EMAIL    = `bg-clinic01-${Date.now()}@ubs.test`;
const BG_PW       = "BreakGlass@12345!";
const NM_EMAIL    = `nm-clinic01-${Date.now()}@ubs.test`;
const NM_PW       = "Nurse@12345!";
const GESTOR_EMAIL = `gestor-clinic01-${Date.now()}@ubs.test`;
const GESTOR_PW   = "Gestor@12345!";

let saToken    = null;
let bgToken    = null;
let nmToken    = null;
let gestorToken = null;
let testTeamId  = null;
let testUnitId  = null;

describe("BUG-CLINIC-01: Platform access leak fix and dashboard scope", () => {
  before(async () => {
    await startTestServer();

    // Inject support_admin
    await injectUser({ name: "SA Clinic01", role: "support_admin", email: SA_EMAIL, password: SA_PW });
    saToken = await login(SA_EMAIL, SA_PW);

    // Create a unit via support_admin (municipalityId must be exactly 7 IBGE digits)
    const unitRes = await post("/platform/units", {
      name: "UBS Clinic01 Test",
      cnes: String(3000000 + Math.floor(Math.random() * 999999)),
      municipalityName: "Cidade Clinic01",
      uf: "SP",
      municipalityId: "3550308",
      status: "onboarding"
    }, saToken);
    assert.ok(unitRes.status === 201 || unitRes.status === 409, `unit: ${unitRes.status}`);
    testUnitId = unitRes.json.id || "unit-clinic01-fallback";

    // Create a team for that unit
    const teamRes = await post(`/platform/units/${testUnitId}/teams`, {
      name: `Equipe Rosa Clinic01 ${Date.now()}`,
      ine: String(Math.floor(Math.random() * 10000000)).padStart(7, "0"),
      tipoEquipe: "ESF"
    }, saToken);
    if (teamRes.status === 201) {
      testTeamId = teamRes.json?.id;
    }

    // Inject break_glass_admin with the team
    await injectUser({ name: "Break Glass Clinic01", role: "break_glass_admin", email: BG_EMAIL, password: BG_PW, teamId: testTeamId || "", unitId: testUnitId });
    bgToken = await login(BG_EMAIL, BG_PW);

    // Register nurse_manager
    const nmRes = await post("/auth/register", {
      name: "Enfermeira Clinic01", email: NM_EMAIL, password: NM_PW,
      role: "nurse_manager", teamId: testTeamId || "", councilNumber: "524700", councilUf: "SP"
    });
    assert.ok(nmRes.status === 201 || nmRes.status === 409, `nm register: ${nmRes.status}`);
    nmToken = await login(NM_EMAIL, NM_PW);

    // Register gestor
    const gRes = await post("/auth/register", {
      name: "Gestor Clinic01", email: GESTOR_EMAIL, password: GESTOR_PW,
      role: "gestor", unitId: testUnitId
    });
    assert.ok(gRes.status === 201 || gRes.status === 409, `gestor register: ${gRes.status}`);
    gestorToken = await login(GESTOR_EMAIL, GESTOR_PW);
  });

  after(stopTestServer);

  // ── Group 1: Clinical users access clinical endpoints ──────────────────────

  describe("Group 1: Clinical endpoints accessible by clinical users", () => {
    it("GET /bootstrap with break_glass_admin token returns 200, NOT 403", async () => {
      const { status, json } = await get("/bootstrap", bgToken);
      assert.equal(status, 200, `break_glass_admin /bootstrap: ${status} — ${JSON.stringify(json)}`);
    });

    it("GET /bootstrap response does NOT contain 'Acesso restrito ao Console Nacional'", async () => {
      const { status, json } = await get("/bootstrap", bgToken);
      assert.equal(status, 200);
      const serialized = JSON.stringify(json || {});
      assert.ok(
        !serialized.includes("Acesso restrito ao Console Nacional"),
        "Error message leaked into bootstrap response"
      );
    });

    it("GET /bootstrap with nurse_manager token returns 200", async () => {
      const { status, json } = await get("/bootstrap", nmToken);
      assert.equal(status, 200, `nurse_manager /bootstrap: ${status} — ${JSON.stringify(json)}`);
    });

    it("GET /bootstrap with gestor token returns 200", async () => {
      const { status, json } = await get("/bootstrap", gestorToken);
      assert.equal(status, 200, `gestor /bootstrap: ${status} — ${JSON.stringify(json)}`);
    });

    it("GET /patients with nurse_manager token returns 200", async () => {
      const { status, json } = await get("/patients", nmToken);
      assert.equal(status, 200, `nurse_manager /patients: ${status} — ${JSON.stringify(json)}`);
    });

    it("GET /queue with break_glass_admin token returns 200", async () => {
      const { status, json } = await get("/queue", bgToken);
      assert.equal(status, 200, `break_glass_admin /queue: ${status} — ${JSON.stringify(json)}`);
    });

    it("GET /users with nurse_manager token returns 200", async () => {
      const { status, json } = await get("/users", nmToken);
      assert.equal(status, 200, `nurse_manager /users: ${status} — ${JSON.stringify(json)}`);
    });
  });

  // ── Group 2: support_admin blocked from clinical endpoints ─────────────────

  describe("Group 2: support_admin blocked from clinical endpoints", () => {
    it("GET /bootstrap with support_admin token returns 403", async () => {
      const { status } = await get("/bootstrap", saToken);
      assert.equal(status, 403, `support_admin should be blocked from /bootstrap`);
    });

    it("GET /patients with support_admin token returns 403", async () => {
      const { status } = await get("/patients", saToken);
      assert.equal(status, 403);
    });

    it("GET /queue with support_admin token returns 403", async () => {
      const { status } = await get("/queue", saToken);
      assert.equal(status, 403);
    });
  });

  // ── Group 3: support_admin accesses platform endpoints ────────────────────

  describe("Group 3: support_admin can access /platform/* endpoints", () => {
    it("GET /platform/units with support_admin token returns 200", async () => {
      const { status, json } = await get("/platform/units", saToken);
      assert.equal(status, 200, `support_admin /platform/units: ${status} — ${JSON.stringify(json)}`);
      assert.ok(Array.isArray(json.units), "Expected paginated { units: [] } response");
    });

    it("GET /platform/summary with support_admin token returns 200", async () => {
      const { status, json } = await get("/platform/summary", saToken);
      assert.equal(status, 200, `support_admin /platform/summary: ${status} — ${JSON.stringify(json)}`);
    });
  });

  // ── Group 4: Clinical users blocked from platform endpoints ───────────────

  describe("Group 4: Clinical users blocked from /platform/* endpoints", () => {
    it("GET /platform/units with nurse_manager token returns 403", async () => {
      const { status } = await get("/platform/units", nmToken);
      assert.equal(status, 403);
    });

    it("GET /platform/units with break_glass_admin token returns 403", async () => {
      const { status } = await get("/platform/units", bgToken);
      assert.equal(status, 403);
    });

    it("GET /platform/units with gestor token returns 403", async () => {
      const { status } = await get("/platform/units", gestorToken);
      assert.equal(status, 403);
    });

    it("GET /platform/units without token returns 401", async () => {
      const { status } = await get("/platform/units");
      assert.equal(status, 401);
    });
  });

  // ── Group 5: break_glass_admin JWT has correct role and unitId ─────────────

  describe("Group 5: break_glass_admin JWT payload validation", () => {
    it("break_glass_admin JWT has role: break_glass_admin", async () => {
      const payload = decodeJwtPayload(bgToken);
      assert.equal(payload?.role, "break_glass_admin");
    });

    it("break_glass_admin JWT has unitId matching created unit", async () => {
      const payload = decodeJwtPayload(bgToken);
      assert.equal(String(payload?.unitId || ""), testUnitId, "unitId mismatch in JWT");
    });
  });

  // ── Group 6: Dashboard scope — bootstrap returns correct data ─────────────

  describe("Group 6: Dashboard data scope via /bootstrap", () => {
    it("GET /bootstrap for break_glass_admin returns patients array", async () => {
      const { status, json } = await get("/bootstrap", bgToken);
      assert.equal(status, 200);
      assert.ok(Array.isArray(json.patients), "Missing patients array in bootstrap response");
    });

    it("GET /bootstrap for break_glass_admin returns users array", async () => {
      const { status, json } = await get("/bootstrap", bgToken);
      assert.equal(status, 200);
      assert.ok(Array.isArray(json.users), "Missing users array in bootstrap response");
    });

    it("GET /bootstrap for nurse_manager returns team-scoped users only", async () => {
      const { status, json } = await get("/bootstrap", nmToken);
      assert.equal(status, 200);
      assert.ok(Array.isArray(json.users), "Missing users in bootstrap");
      const nmPayload = decodeJwtPayload(nmToken);
      const foreignUsers = json.users.filter(
        (u) => u.teamId && u.teamId !== nmPayload.teamId && !u.capabilities?.includes("users.read.all")
      );
      assert.equal(foreignUsers.length, 0, `Team scope violation: ${JSON.stringify(foreignUsers.map(u => ({ id: u.id, teamId: u.teamId })))}`);
    });
  });
});
