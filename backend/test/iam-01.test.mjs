/**
 * IAM-01 integration tests
 *
 * Groups:
 * 1. support_admin RBAC isolation
 * 2. Platform unit CRUD (support_admin)
 * 3. Initial manager provisioning
 * 4. forcePasswordChange gate
 * 5. Gestor local user creation
 * 6. Gestor password reset
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startTestServer, stopTestServer, get, post } from "./helpers.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Decode a JWT payload without verifying the signature */
function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Register and immediately log in, returning the access token. */
async function registerAndLogin(body) {
  const regRes = await post("/auth/register", body);
  assert.ok(
    regRes.status === 201 || regRes.status === 409,
    `register ${body.email}: expected 201/409, got ${regRes.status} — ${JSON.stringify(regRes.json)}`
  );
  const loginRes = await post("/auth/login", {
    email: body.email,
    password: body.password
  });
  assert.equal(loginRes.status, 200, `login ${body.email} failed: ${JSON.stringify(loginRes.json)}`);
  return loginRes.json.token || loginRes.json.accessToken;
}

/** Inject a user directly into the DB file (for support_admin that cannot self-register) */
async function injectSupportAdmin(email, password) {
  // Use the withDb helper from the app — import lazily after server started
  const { withDb } = await import("../src/db.js");
  const { hashPassword } = await import("../src/services/crypto.js");
  const { v4: uuidv4 } = await import("uuid");
  const { ensureDbShape } = await import("../src/utils/domain.js");

  const id = uuidv4();
  await withDb((db) => {
    ensureDbShape(db);
    // Skip if already exists (re-run safety)
    if (db.users.some((u) => u.email === email)) return;
    db.users.push({
      id,
      name: "Support Admin Test",
      role: "support_admin",
      email,
      password: hashPassword(password),
      teamId: "",
      unitId: "",
      municipalityId: "test-municipality-001",
      twoFactorEnabled: false,
      twoFactorSecret: "",
      twoFactorPendingSecret: "",
      twoFactorPendingCreatedAt: "",
      forcePasswordChange: false,
      passwordUpdatedAt: null,
      temporaryPasswordIssuedAt: null,
      createdBySupport: true,
      createdByUserId: "system",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });
  return id;
}

/** Login and return the access token. */
async function login(email, password) {
  const res = await post("/auth/login", { email, password });
  assert.equal(res.status, 200, `login ${email} failed: ${JSON.stringify(res.json)}`);
  return res.json.token || res.json.accessToken;
}

// ── Shared state ──────────────────────────────────────────────────────────────

const SA_EMAIL = `sa-iam01-${Date.now()}@support.test`;
const SA_PASSWORD = "Support@12345!";

const GESTOR_EMAIL = `gestor-iam01-${Date.now()}@ubs.test`;
const GESTOR_PASSWORD = "Gestor@12345!";
const TEST_UNIT_ID = "unit-default"; // pre-seeded by app startup

const NM_EMAIL = `nm-iam01-${Date.now()}@ubs.test`;
const NM_PASSWORD = "Nurse@12345!";

let saToken = null;
let gestorToken = null;
let nmToken = null;
let createdUnitId = null;
let createdUnitCnes = null;

// ── Test suite ─────────────────────────────────────────────────────────────────

describe("IAM-01: RBAC isolation, provisioning, password lifecycle, audit safety", () => {
  before(async () => {
    await startTestServer();

    // Inject support_admin (cannot self-register)
    await injectSupportAdmin(SA_EMAIL, SA_PASSWORD);
    saToken = await login(SA_EMAIL, SA_PASSWORD);

    // Gestor registers normally (role=gestor requires unitId + unit to exist)
    // We need a unit first. Create one via support_admin.
    const unitRes = await post("/platform/units", {
      name: "UBS Teste IAM",
      cnes: "1234567",
      municipalityName: "Cidade Teste",
      uf: "SP",
      municipalityId: "1234567",
      status: "onboarding"
    }, saToken);
    // If 409 (duplicate cnes from re-run) pick a different cnes
    if (unitRes.status === 409) {
      const unitRes2 = await post("/platform/units", {
        name: "UBS Teste IAM 2",
        cnes: "7654321",
        municipalityName: "Cidade Teste",
        uf: "SP",
        municipalityId: "1234567",
        status: "onboarding"
      }, saToken);
      assert.equal(unitRes2.status, 201, `unit creation fallback failed: ${JSON.stringify(unitRes2.json)}`);
      createdUnitId = unitRes2.json.id;
      createdUnitCnes = unitRes2.json.cnes;
    } else {
      assert.equal(unitRes.status, 201, `unit creation failed: ${JSON.stringify(unitRes.json)}`);
      createdUnitId = unitRes.json.id;
      createdUnitCnes = unitRes.json.cnes;
    }

    // Register gestor linked to the created unit
    const gestorRes = await post("/auth/register", {
      name: "Gestor IAM Test",
      email: GESTOR_EMAIL,
      password: GESTOR_PASSWORD,
      role: "gestor",
      unitId: createdUnitId
    });
    assert.ok(
      gestorRes.status === 201 || gestorRes.status === 409,
      `gestor register: ${gestorRes.status} — ${JSON.stringify(gestorRes.json)}`
    );
    gestorToken = await login(GESTOR_EMAIL, GESTOR_PASSWORD);

    // Register nurse_manager linked to the same unit via a team
    // First create a team for the unit
    let teamId = null;
    const teamRes = await post(`/platform/units/${createdUnitId}/teams`, {
      name: `Equipe Rosa IAM ${Date.now()}`,
      ine: String(Math.floor(Math.random() * 10000000)).padStart(7, "0"),
      tipoEquipe: "ESF"
    }, saToken);
    if (teamRes.status === 201) {
      teamId = teamRes.json?.id;
      assert.ok(teamId, `Team created but no id in response: ${JSON.stringify(teamRes.json)}`);
    } else if (teamRes.status !== 409) {
      throw new Error(`Team creation failed with ${teamRes.status}: ${JSON.stringify(teamRes.json)}`);
    }

    if (teamId) {
      const nmRes = await post("/auth/register", {
        name: "Enfermeira IAM Test",
        email: NM_EMAIL,
        password: NM_PASSWORD,
        role: "nurse_manager",
        teamId,
        councilNumber: "524697",
        councilUf: "SP"
      });
      assert.ok(
        nmRes.status === 201 || nmRes.status === 409,
        `nm register failed with ${nmRes.status}: ${JSON.stringify(nmRes.json)}`
      );
    }
    nmToken = await login(NM_EMAIL, NM_PASSWORD);
  });

  after(stopTestServer);

  // ── Group 1: support_admin RBAC isolation ──────────────────────────────────

  describe("Group 1: support_admin RBAC isolation", () => {
    it("POST /auth/login with support_admin creds succeeds and token has role: support_admin", async () => {
      const res = await post("/auth/login", { email: SA_EMAIL, password: SA_PASSWORD });
      assert.equal(res.status, 200, `Login failed: ${JSON.stringify(res.json)}`);
      const token = res.json.token || res.json.accessToken;
      assert.ok(token, "Missing token");
      const payload = decodeJwtPayload(token);
      assert.equal(payload?.role, "support_admin");
    });

    it("GET /patients with support_admin token returns 403", async () => {
      const { status } = await get("/patients", saToken);
      assert.equal(status, 403);
    });

    it("GET /acs-visits with support_admin token returns 403", async () => {
      const { status } = await get("/acs-visits", saToken);
      assert.equal(status, 403);
    });

    it("GET /platform/units with support_admin token returns 200", async () => {
      const { status, json } = await get("/platform/units", saToken);
      assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
      assert.ok(Array.isArray(json.units), "Expected paginated { units: [] } response");
    });

    it("GET /platform/units with gestor token returns 403", async () => {
      const { status } = await get("/platform/units", gestorToken);
      assert.equal(status, 403);
    });

    it("GET /platform/units without auth returns 401", async () => {
      const { status } = await get("/platform/units");
      assert.equal(status, 401);
    });
  });

  // ── Group 2: Platform unit CRUD (support_admin) ────────────────────────────

  describe("Group 2: Platform unit CRUD (support_admin)", () => {
    const newCnes = String(Math.floor(2000000 + Math.random() * 7000000));
    let group2UnitId = null;

    it("POST /platform/units with valid body returns 201 with id/cnes/status", async () => {
      const res = await post("/platform/units", {
        name: "UBS CRUD Test",
        cnes: newCnes,
        municipalityName: "Cidade CRUD",
        uf: "RJ",
        municipalityId: "3304557",
        status: "onboarding"
      }, saToken);
      assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.json)}`);
      assert.ok(res.json.id, "Missing id");
      assert.equal(res.json.cnes, newCnes);
      assert.ok(res.json.status, "Missing status");
      group2UnitId = res.json.id;
    });

    it("POST /platform/units with duplicate CNES returns 409", async () => {
      const res = await post("/platform/units", {
        name: "UBS Duplicada",
        cnes: newCnes,
        municipalityName: "Cidade X",
        uf: "RJ",
        municipalityId: "3304557"
      }, saToken);
      assert.equal(res.status, 409);
    });

    it("POST /platform/units with invalid CNES (not 7 digits) returns 400", async () => {
      const res = await post("/platform/units", {
        name: "UBS Invalida",
        cnes: "12345",
        municipalityName: "Cidade X",
        uf: "RJ",
        municipalityId: "3304557"
      }, saToken);
      assert.equal(res.status, 400);
    });

    it("GET /platform/units/:id returns 200 with unit data", async () => {
      if (!group2UnitId) return; // skip if create failed
      const res = await get(`/platform/units/${group2UnitId}`, saToken);
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
      assert.equal(res.json.id, group2UnitId);
      assert.equal(res.json.cnes, newCnes);
    });
  });

  // ── Group 3: Initial manager provisioning ─────────────────────────────────

  describe("Group 3: Initial manager provisioning", () => {
    let provisionedUserId = null;
    let returnedTempPassword = null;

    it("POST /platform/units/:id/initial-manager returns 201 with temporaryPassword", async () => {
      const email = `mgr-${Date.now()}@ubs.test`;
      const res = await post(`/platform/units/${createdUnitId}/initial-manager`, {
        name: "Gestor Provisionado",
        email
      }, saToken);
      assert.equal(res.status, 201, `Expected 201: ${JSON.stringify(res.json)}`);
      assert.ok(res.json.temporaryPassword, "Missing temporaryPassword");
      provisionedUserId = res.json.userId;
      returnedTempPassword = res.json.temporaryPassword;
    });

    it("temporaryPassword is at least 14 characters", async () => {
      if (!returnedTempPassword) return;
      assert.ok(
        returnedTempPassword.length >= 14,
        `temporaryPassword too short: ${returnedTempPassword.length} chars`
      );
    });

    it("created user in DB has forcePasswordChange: true", async () => {
      if (!provisionedUserId) return;
      const { readDb } = await import("../src/db.js");
      const db = await readDb();
      const user = (db.users || []).find((u) => u.id === provisionedUserId);
      assert.ok(user, "User not found in DB");
      assert.equal(user.forcePasswordChange, true);
    });

    it("audit log for PLATFORM_INITIAL_MANAGER_CREATED does NOT contain temporaryPassword", async () => {
      if (!provisionedUserId) return;
      const { readDb } = await import("../src/db.js");
      const db = await readDb();
      const entries = (db.auditLogs || []).filter(
        (e) => e.action === "PLATFORM_INITIAL_MANAGER_CREATED" && e.entityId === provisionedUserId
      );
      assert.ok(entries.length > 0, `Audit entry not found. Available entries: ${JSON.stringify((db.auditLogs || []).map(e => ({ action: e.action, entityId: e.entityId })).slice(-5))}`);
      for (const entry of entries) {
        const serialized = JSON.stringify(entry);
        assert.ok(
          !serialized.includes(returnedTempPassword || "NEVER_MATCH"),
          "Audit log contains temporaryPassword — LGPD violation"
        );
      }
    });
  });

  // ── Group 4: forcePasswordChange gate ─────────────────────────────────────

  describe("Group 4: forcePasswordChange gate", () => {
    let fpcEmail = null;
    let fpcTempPassword = null;
    let fpcToken = null;

    before(async () => {
      // Create a user with forcePasswordChange via gestor
      fpcEmail = `fpc-${Date.now()}@ubs.test`;
      const createRes = await post("/users", {
        name: "Forced Change User",
        email: fpcEmail,
        role: "acs"
      }, gestorToken);
      assert.equal(createRes.status, 201, `Create fpc user: ${JSON.stringify(createRes.json)}`);
      fpcTempPassword = createRes.json.temporaryPassword;
    });

    it("login with forcePasswordChange user succeeds and JWT payload has forcePasswordChange: true", async () => {
      const res = await post("/auth/login", { email: fpcEmail, password: fpcTempPassword });
      assert.equal(res.status, 200, `Login fpc user: ${JSON.stringify(res.json)}`);
      fpcToken = res.json.token || res.json.accessToken;
      const payload = decodeJwtPayload(fpcToken);
      assert.equal(payload?.forcePasswordChange, true);
    });

    it("POST /auth/change-password-required with wrong currentPassword returns 401", async () => {
      if (!fpcToken) return;
      const res = await post("/auth/change-password-required", {
        currentPassword: "WrongPassword!99",
        newPassword: "NewStrong@9999!"
      }, fpcToken);
      assert.equal(res.status, 401);
    });

    it("POST /auth/change-password-required with weak newPassword returns 400", async () => {
      if (!fpcToken) return;
      const res = await post("/auth/change-password-required", {
        currentPassword: fpcTempPassword,
        newPassword: "abc"
      }, fpcToken);
      assert.equal(res.status, 400);
    });

    it("POST /auth/change-password-required with correct credentials returns 200 and new token with forcePasswordChange: false", async () => {
      if (!fpcToken) return;
      const res = await post("/auth/change-password-required", {
        currentPassword: fpcTempPassword,
        newPassword: "StrongNewPass@2026!"
      }, fpcToken);
      assert.equal(res.status, 200, `change-password-required: ${JSON.stringify(res.json)}`);
      const newToken = res.json.token || res.json.accessToken;
      assert.ok(newToken, "Missing token in response");
      const payload = decodeJwtPayload(newToken);
      assert.equal(payload?.forcePasswordChange, false);
    });
  });

  // ── Group 5: Gestor local user creation ────────────────────────────────────

  describe("Group 5: Gestor local user creation", () => {
    it("POST /users as gestor with role: acs returns 201 with temporaryPassword", async () => {
      const res = await post("/users", {
        name: "ACS Novo",
        email: `acs-${Date.now()}@ubs.test`,
        role: "acs"
      }, gestorToken);
      assert.equal(res.status, 201, `Expected 201: ${JSON.stringify(res.json)}`);
      assert.ok(res.json.temporaryPassword, "Missing temporaryPassword");
    });

    it("POST /users as gestor with role: support_admin returns 400 (forbidden role)", async () => {
      const res = await post("/users", {
        name: "Bad Support",
        email: `bad-sa-${Date.now()}@ubs.test`,
        role: "support_admin"
      }, gestorToken);
      assert.equal(res.status, 400);
    });

    it("POST /users as gestor with role: nurse_manager returns 201", async () => {
      const res = await post("/users", {
        name: "Enfermeira Nova",
        email: `nm-new-${Date.now()}@ubs.test`,
        role: "nurse_manager",
        councilNumber: "524698",
        councilUf: "SP"
      }, gestorToken);
      assert.equal(res.status, 201, `Expected 201: ${JSON.stringify(res.json)}`);
    });

    it("POST /users as nurse_manager with role: acs returns 201", async () => {
      if (!nmToken) return;
      const res = await post("/users", {
        name: "ACS por Enfermeira",
        email: `acs-nm-${Date.now()}@ubs.test`,
        role: "acs"
      }, nmToken);
      assert.equal(res.status, 201, `Expected 201: ${JSON.stringify(res.json)}`);
    });

    it("POST /users as nurse_manager with role: nurse_manager returns 400 (not allowed)", async () => {
      if (!nmToken) return;
      const res = await post("/users", {
        name: "Outra Enfermeira",
        email: `nm2-${Date.now()}@ubs.test`,
        role: "nurse_manager"
      }, nmToken);
      assert.equal(res.status, 400);
    });
  });

  // ── Group 6: Gestor password reset ────────────────────────────────────────

  describe("Group 6: Gestor password reset", () => {
    let targetUserId = null;

    before(async () => {
      // Create a target user in same unit as gestor
      const createRes = await post("/users", {
        name: "Target Reset User",
        email: `reset-target-${Date.now()}@ubs.test`,
        role: "acs"
      }, gestorToken);
      assert.equal(createRes.status, 201, `Create reset target: ${JSON.stringify(createRes.json)}`);
      targetUserId = createRes.json.id;
    });

    it("POST /users/:id/reset-password as gestor on user in same unit returns 200 with temporaryPassword", async () => {
      if (!targetUserId) return;
      const res = await post(`/users/${targetUserId}/reset-password`, {}, gestorToken);
      assert.equal(res.status, 200, `Expected 200: ${JSON.stringify(res.json)}`);
      assert.ok(res.json.temporaryPassword, "Missing temporaryPassword");
    });

    it("POST /users/:id/reset-password as gestor on user in DIFFERENT unit returns 404", async () => {
      // Inject a user from a different unit directly
      const { withDb } = await import("../src/db.js");
      const { hashPassword } = await import("../src/services/crypto.js");
      const { v4: uuidv4 } = await import("uuid");
      const { ensureDbShape } = await import("../src/utils/domain.js");

      let foreignUserId = null;
      await withDb((db) => {
        ensureDbShape(db);
        const fu = {
          id: uuidv4(),
          name: "Foreign User",
          role: "acs",
          email: `foreign-${Date.now()}@other.test`,
          password: hashPassword("Foreign@12345!"),
          teamId: "",
          unitId: "unit-other-999",  // different unit
          municipalityId: "test-municipality-001",
          twoFactorEnabled: false,
          twoFactorSecret: "",
          twoFactorPendingSecret: "",
          twoFactorPendingCreatedAt: "",
          forcePasswordChange: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.users.push(fu);
        foreignUserId = fu.id;
      });

      const res = await post(`/users/${foreignUserId}/reset-password`, {}, gestorToken);
      assert.equal(res.status, 404);
    });

    it("POST /users/:id/reset-password on support_admin target returns 403", async () => {
      // Inject a support_admin target
      const { withDb } = await import("../src/db.js");
      const { hashPassword } = await import("../src/services/crypto.js");
      const { v4: uuidv4 } = await import("uuid");
      const { ensureDbShape } = await import("../src/utils/domain.js");

      const gestorPayload = decodeJwtPayload(gestorToken);
      const gestorUnitId = gestorPayload?.unitId || createdUnitId;

      let saTargetId = null;
      await withDb((db) => {
        ensureDbShape(db);
        const su = {
          id: uuidv4(),
          name: "SA Target",
          role: "support_admin",
          email: `sa-target-${Date.now()}@support.test`,
          password: hashPassword("SATarget@12345!"),
          teamId: "",
          unitId: gestorUnitId,  // same unit so gestor can "find" them
          municipalityId: "test-municipality-001",
          twoFactorEnabled: false,
          twoFactorSecret: "",
          twoFactorPendingSecret: "",
          twoFactorPendingCreatedAt: "",
          forcePasswordChange: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.users.push(su);
        saTargetId = su.id;
      });

      const res = await post(`/users/${saTargetId}/reset-password`, {}, gestorToken);
      assert.equal(res.status, 403);
    });

    it("audit log for USER_PASSWORD_RESET does NOT contain temporaryPassword", async () => {
      if (!targetUserId) return;
      // Do a fresh reset and capture the returned temp password
      const resetRes = await post(`/users/${targetUserId}/reset-password`, {}, gestorToken);
      assert.equal(resetRes.status, 200);
      const tempPw = resetRes.json.temporaryPassword;

      const { readDb } = await import("../src/db.js");
      const db = await readDb();
      const entries = (db.auditLogs || []).filter(
        (e) => e.action === "USER_PASSWORD_RESET" && e.entityId === targetUserId
      );
      assert.ok(entries.length > 0, "Audit entries for USER_PASSWORD_RESET not found");
      for (const entry of entries) {
        const serialized = JSON.stringify(entry);
        assert.ok(
          !serialized.includes(tempPw),
          "Audit log contains temporaryPassword — LGPD violation"
        );
      }
    });
  });
});
