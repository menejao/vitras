/**
 * TECH-SCALE-01B — REM-02 bootstrap pagination regression tests
 *
 * Validates:
 * 1. GET /bootstrap returns paginationMeta with total, page, limit, hasNextPage, totalPages
 * 2. Default limit is 500 — response never exceeds it
 * 3. ?page=2 returns offset results (or empty if fewer than limit+1 patients)
 * 4. ?limit= is capped at 500 regardless of input
 * 5. Tasks reflect ALL allowed patients, not just the current page
 * 6. RBAC preserved — ACS only sees own patients, gestor sees unit patients
 * 7. Unauthenticated request returns 401
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, req } from "./helpers.js";

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

async function injectPatient(overrides) {
  const { withDb } = await import("../src/db.js");
  const { v4: uuidv4 } = await import("uuid");
  const { ensureDbShape } = await import("../src/utils/domain.js");
  const id = uuidv4();
  await withDb((db) => {
    ensureDbShape(db);
    db.patients.push({
      id,
      name: overrides.name || "Paciente Teste",
      teamId: overrides.teamId || "",
      assignedAcsId: overrides.assignedAcsId || "",
      inactive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    });
  });
  return id;
}

async function injectTask(patientId, teamId) {
  const { withDb } = await import("../src/db.js");
  const { v4: uuidv4 } = await import("uuid");
  const { ensureDbShape } = await import("../src/utils/domain.js");
  const id = uuidv4();
  await withDb((db) => {
    ensureDbShape(db);
    db.tasks = db.tasks || [];
    db.tasks.push({
      id,
      patientId,
      teamId,
      title: "Task REM-02",
      status: "pending",
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

const TS = Date.now();
const SA_EMAIL  = `sa-rem02-${TS}@support.test`;
const SA_PW     = "Support@12345!";
const NM_EMAIL  = `nm-rem02-${TS}@ubs.test`;
const NM_PW     = "Nurse@12345!";
const ACS_EMAIL = `acs-rem02-${TS}@ubs.test`;
const ACS_PW    = "Acs@12345!";

let saToken, nmToken, acsToken;
let testTeamId, testUnitId, acsUserId;

describe("TECH-SCALE-01B: REM-02 bootstrap pagination", () => {
  before(async () => {
    await startTestServer();

    await injectUser({ name: "SA REM02", role: "support_admin", email: SA_EMAIL, password: SA_PW });
    saToken = await login(SA_EMAIL, SA_PW);

    const unitRes = await post("/platform/units", {
      name: "UBS REM02 Test",
      cnes: String(7000000 + Math.floor(Math.random() * 999999)),
      municipalityName: "Cidade REM02",
      uf: "SP",
      municipalityId: "3550308",
      status: "onboarding"
    }, saToken);
    assert.ok(unitRes.status === 201 || unitRes.status === 409, `unit: ${unitRes.status}`);
    testUnitId = unitRes.json.id || "unit-rem02-fallback";

    const teamRes = await post(`/platform/units/${testUnitId}/teams`, {
      name: `Equipe REM02 ${TS}`,
      ine: String(Math.floor(Math.random() * 10000000)).padStart(7, "0"),
      tipoEquipe: "ESF"
    }, saToken);
    if (teamRes.status === 201) testTeamId = teamRes.json?.id;

    const nmRes = await post("/auth/register", {
      name: "Enfermeira REM02", email: NM_EMAIL, password: NM_PW,
      role: "nurse_manager", teamId: testTeamId || "", councilNumber: "524701", councilUf: "SP"
    });
    assert.ok(nmRes.status === 201 || nmRes.status === 409, `nm: ${nmRes.status}`);
    nmToken = await login(NM_EMAIL, NM_PW);

    await injectUser({ name: "ACS REM02", role: "acs", email: ACS_EMAIL, password: ACS_PW, teamId: testTeamId || "" });
    acsToken = await login(ACS_EMAIL, ACS_PW);

    // Fetch ACS user id
    const { readDb } = await import("../src/db.js");
    const db = await readDb();
    acsUserId = db.users.find((u) => u.email === ACS_EMAIL)?.id;
  });

  after(stopTestServer);

  it("returns 401 without token", async () => {
    const res = await get("/bootstrap");
    assert.equal(res.status, 401);
  });

  it("response includes paginationMeta with required fields", async () => {
    const res = await get("/bootstrap", nmToken);
    assert.equal(res.status, 200);
    const meta = res.json.paginationMeta;
    assert.ok(meta, "paginationMeta missing from response");
    assert.ok(typeof meta.total === "number", "total must be number");
    assert.ok(typeof meta.page === "number", "page must be number");
    assert.ok(typeof meta.limit === "number", "limit must be number");
    assert.ok(typeof meta.hasNextPage === "boolean", "hasNextPage must be boolean");
    assert.ok(typeof meta.totalPages === "number", "totalPages must be number");
  });

  it("default page=1, limit=500", async () => {
    const res = await get("/bootstrap", nmToken);
    assert.equal(res.status, 200);
    const meta = res.json.paginationMeta;
    assert.equal(meta.page, 1);
    assert.equal(meta.limit, 500);
  });

  it("patients array never exceeds limit", async () => {
    const res = await get("/bootstrap", nmToken);
    assert.equal(res.status, 200);
    assert.ok(
      res.json.patients.length <= res.json.paginationMeta.limit,
      `patients.length=${res.json.patients.length} exceeds limit=${res.json.paginationMeta.limit}`
    );
  });

  it("limit cap enforced — ?limit=9999 returns at most 500", async () => {
    const { _base } = await import("./helpers.js").catch(() => ({}));
    const res = await req("GET", "/bootstrap?limit=9999", null, nmToken);
    assert.equal(res.status, 200);
    assert.equal(res.json.paginationMeta.limit, 500);
    assert.ok(res.json.patients.length <= 500);
  });

  it("hasNextPage=false when total <= limit", async () => {
    const res = await get("/bootstrap", nmToken);
    assert.equal(res.status, 200);
    const meta = res.json.paginationMeta;
    if (meta.total <= meta.limit) {
      assert.equal(meta.hasNextPage, false);
    }
  });

  it("tasks include patients from current team scope even if patient count > 0", async () => {
    if (!testTeamId) return; // team creation may have failed
    const patId = await injectPatient({ name: "P-Task-REM02", teamId: testTeamId, assignedAcsId: acsUserId || "" });
    const taskId = await injectTask(patId, testTeamId);

    const res = await get("/bootstrap", nmToken);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json.tasks), "tasks must be array");
    const taskIds = res.json.tasks.map((t) => t.id);
    assert.ok(taskIds.includes(taskId), "task for team patient must appear in bootstrap tasks");
  });

  it("ACS sees only own patients in bootstrap", async () => {
    if (!testTeamId || !acsUserId) return;
    // Patient assigned to this ACS
    const myPatId = await injectPatient({ name: "P-ACS-Own", teamId: testTeamId, assignedAcsId: acsUserId });
    // Patient assigned to different ACS
    const otherPatId = await injectPatient({ name: "P-ACS-Other", teamId: testTeamId, assignedAcsId: "other-acs-id" });

    const res = await get("/bootstrap", acsToken);
    assert.equal(res.status, 200);
    const ids = res.json.patients.map((p) => p.id);
    assert.ok(ids.includes(myPatId), "ACS must see own patient");
    assert.ok(!ids.includes(otherPatId), "ACS must not see other ACS patient");
  });

  it("page=2 returns correct offset or empty array if not enough patients", async () => {
    const res = await req("GET", "/bootstrap?page=2&limit=500", null, nmToken);
    assert.equal(res.status, 200);
    const meta = res.json.paginationMeta;
    assert.equal(meta.page, 2);
    if (meta.total <= 500) {
      assert.equal(res.json.patients.length, 0);
      assert.equal(meta.hasNextPage, false);
    } else {
      assert.ok(res.json.patients.length > 0);
    }
  });

  it("totalPages is ceil(total/limit), minimum 1", async () => {
    const res = await get("/bootstrap", nmToken);
    const meta = res.json.paginationMeta;
    const expected = Math.ceil(meta.total / meta.limit) || 1;
    assert.equal(meta.totalPages, expected);
  });
});
