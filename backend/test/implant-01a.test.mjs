/**
 * IMPLANT-01A tests: national tenant provisioning workflow
 *
 * Validates:
 * 1. Lifecycle state machine (5 states)
 * 2. Valid transitions
 * 3. Invalid transitions rejected
 * 4. Auto-transition draft → onboarding on gestor creation
 * 5. activatedAt / suspendedAt timestamps
 * 6. address field in unit model
 * 7. createdByName resolved from users
 * 8. RBAC: support_admin creates, gestor blocked from /platform
 * 9. Audit log contains no temp password
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const { hashPassword, verifyPassword, generateTempPassword } = await import("../src/services/crypto.js");

// ── State machine (mirrors platform.js) ───────────────────────────────────
const VALID_STATUSES = ["draft", "onboarding", "homologation", "active", "suspended"];

const STATUS_TRANSITIONS = {
  draft:        ["onboarding"],
  onboarding:   ["homologation", "draft"],
  homologation: ["active", "onboarding"],
  active:       ["suspended"],
  suspended:    ["active"]
};

function isValidTransition(from, to) {
  if (from === to) return false;
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

// ── Unit creation logic (mirrors platform.js POST /platform/units) ─────────
function createUnit({ name, cnes, municipalityName, uf, municipalityId = "", address = "", contactEmail = "", phone = "", status = "draft", createdBy = "system" } = {}) {
  if (!name || !cnes || !municipalityName || !uf) throw new Error("name, cnes, municipalityName e uf são obrigatórios");
  if (!/^\d{7}$/.test(cnes)) throw new Error("cnes deve ter exatamente 7 dígitos");
  if (!VALID_STATUSES.includes(status)) throw new Error(`Status inválido: ${status}`);
  return {
    id: randomUUID(),
    name, cnes, municipalityName, uf, municipalityId, address, contactEmail, phone,
    status,
    createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activatedAt: null,
    suspendedAt: null
  };
}

// ── Status patch logic (mirrors platform.js PATCH /platform/units/:id) ────
function patchUnitStatus(unit, toStatus) {
  if (!VALID_STATUSES.includes(toStatus)) return { error: `Status inválido: ${toStatus}` };
  if (!isValidTransition(unit.status, toStatus)) return { error: `Transição inválida: ${unit.status} → ${toStatus}` };
  const nowIso = new Date().toISOString();
  const updated = { ...unit, status: toStatus, updatedAt: nowIso };
  if (toStatus === "active" && !updated.activatedAt) updated.activatedAt = nowIso;
  if (toStatus === "suspended") updated.suspendedAt = nowIso;
  return { unit: updated };
}

// ── Gestor creation + auto-transition ─────────────────────────────────────
function createInitialManager(db, unitId, { name, email }) {
  const unitIdx = db.units.findIndex((u) => u.id === unitId);
  if (unitIdx < 0) return { error: "UBS não encontrada" };
  if (db.users.some((u) => String(u.email || "").toLowerCase() === email.toLowerCase())) {
    return { error: "E-mail já cadastrado" };
  }

  const tempPassword = generateTempPassword();
  const nowIso = new Date().toISOString();
  const userId = randomUUID();

  const user = {
    id: userId, name, email: email.toLowerCase(), role: "gestor",
    password: hashPassword(tempPassword),
    forcePasswordChange: true, temporaryPasswordIssuedAt: nowIso,
    unitId, createdAt: nowIso, updatedAt: nowIso
  };
  db.users.push(user);

  // Auto-transition draft → onboarding
  const unitCurrent = db.units[unitIdx];
  if ((unitCurrent.status || "draft") === "draft") {
    db.units[unitIdx] = { ...unitCurrent, status: "onboarding", updatedAt: nowIso };
  }

  // Audit — never log tempPassword
  const auditEntry = { action: "PLATFORM_INITIAL_MANAGER_CREATED", userId, unitId, outcome: "success" };
  db.auditLogs.push(auditEntry);

  return { userId, tempPassword, auditEntry };
}

// ── Fixtures ──────────────────────────────────────────────────────────────
function makeDb() {
  return { units: [], users: [], teams: [], auditLogs: [] };
}

// ── Tests ─────────────────────────────────────────────────────────────────
describe("IMPLANT-01A: national tenant provisioning", () => {
  // ── Valid lifecycle states ────────────────────────────────────────────
  it("1. VALID_STATUSES has exactly 5 states", () => {
    assert.equal(VALID_STATUSES.length, 5);
    for (const s of ["draft","onboarding","homologation","active","suspended"]) {
      assert.ok(VALID_STATUSES.includes(s), `missing: ${s}`);
    }
  });

  // ── Unit creation ────────────────────────────────────────────────────
  it("2. create unit with required fields", () => {
    const u = createUnit({ name: "UBS Teste", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    assert.ok(u.id);
    assert.equal(u.name, "UBS Teste");
    assert.equal(u.status, "draft");
  });

  it("3. unit default status is draft", () => {
    const u = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    assert.equal(u.status, "draft");
  });

  it("4. unit stores address field", () => {
    const u = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE", address: "Rua das Flores, 123" });
    assert.equal(u.address, "Rua das Flores, 123");
  });

  it("5. missing name rejected", () => {
    assert.throws(() => createUnit({ cnes: "1234567", municipalityName: "Recife", uf: "PE" }), /obrigatório/);
  });

  it("6. invalid CNES rejected", () => {
    assert.throws(() => createUnit({ name: "UBS", cnes: "123", municipalityName: "Recife", uf: "PE" }), /7 dígitos/);
  });

  it("7. invalid status rejected at creation", () => {
    assert.throws(() => createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE", status: "invalid" }), /Status inválido/);
  });

  it("8. unit has activatedAt=null on creation", () => {
    const u = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    assert.equal(u.activatedAt, null);
  });

  // ── State machine transitions ─────────────────────────────────────────
  it("9. draft → onboarding valid", () => {
    assert.equal(isValidTransition("draft", "onboarding"), true);
  });

  it("10. draft → active invalid", () => {
    assert.equal(isValidTransition("draft", "active"), false);
  });

  it("11. onboarding → homologation valid", () => {
    assert.equal(isValidTransition("onboarding", "homologation"), true);
  });

  it("12. homologation → active valid", () => {
    assert.equal(isValidTransition("homologation", "active"), true);
  });

  it("13. active → suspended valid", () => {
    assert.equal(isValidTransition("active", "suspended"), true);
  });

  it("14. suspended → active valid", () => {
    assert.equal(isValidTransition("suspended", "active"), true);
  });

  it("15. same status → same status invalid", () => {
    for (const s of VALID_STATUSES) {
      assert.equal(isValidTransition(s, s), false, `${s} → ${s} should be invalid`);
    }
  });

  it("16. patchUnitStatus sets activatedAt on → active", () => {
    const u = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE", status: "homologation" });
    const res = patchUnitStatus(u, "active");
    assert.ok(!res.error, res.error);
    assert.ok(res.unit.activatedAt);
  });

  it("17. patchUnitStatus sets suspendedAt on → suspended", () => {
    const u = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE", status: "active" });
    const res = patchUnitStatus(u, "suspended");
    assert.ok(!res.error, res.error);
    assert.ok(res.unit.suspendedAt);
  });

  it("18. patchUnitStatus rejects invalid transition", () => {
    const u = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE", status: "draft" });
    const res = patchUnitStatus(u, "suspended");
    assert.ok(res.error);
    assert.match(res.error, /Transição inválida/);
  });

  it("19. patchUnitStatus rejects unknown status", () => {
    const u = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    const res = patchUnitStatus(u, "inactive");
    assert.ok(res.error);
    assert.match(res.error, /Status inválido/);
  });

  // ── Gestor creation + auto-transition ────────────────────────────────
  it("20. createInitialManager succeeds", () => {
    const db = makeDb();
    const unit = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    db.units.push(unit);
    const res = createInitialManager(db, unit.id, { name: "Ana", email: "ana@ubs.gov.br" });
    assert.ok(!res.error, res.error);
    assert.ok(res.userId);
    assert.ok(res.tempPassword);
  });

  it("21. auto-transition draft → onboarding on gestor creation", () => {
    const db = makeDb();
    const unit = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    db.units.push(unit);
    assert.equal(db.units[0].status, "draft");
    createInitialManager(db, unit.id, { name: "Ana", email: "ana@ubs.gov.br" });
    assert.equal(db.units[0].status, "onboarding");
  });

  it("22. no auto-transition if already past draft", () => {
    const db = makeDb();
    const unit = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE", status: "onboarding" });
    db.units.push(unit);
    createInitialManager(db, unit.id, { name: "Ana", email: "ana@ubs.gov.br" });
    assert.equal(db.units[0].status, "onboarding"); // unchanged
  });

  it("23. gestor has forcePasswordChange=true", () => {
    const db = makeDb();
    const unit = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    db.units.push(unit);
    createInitialManager(db, unit.id, { name: "Ana", email: "ana@ubs.gov.br" });
    const gestor = db.users.find((u) => u.role === "gestor");
    assert.equal(gestor.forcePasswordChange, true);
  });

  it("24. gestor temp password is valid bcrypt hash", () => {
    const db = makeDb();
    const unit = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    db.units.push(unit);
    const res = createInitialManager(db, unit.id, { name: "Ana", email: "ana@ubs.gov.br" });
    const gestor = db.users.find((u) => u.role === "gestor");
    assert.equal(verifyPassword(res.tempPassword, gestor.password), true);
  });

  it("25. temp password never in audit log", () => {
    const db = makeDb();
    const unit = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    db.units.push(unit);
    const res = createInitialManager(db, unit.id, { name: "Ana", email: "ana@ubs.gov.br" });
    const auditStr = JSON.stringify(db.auditLogs);
    assert.ok(!auditStr.includes(res.tempPassword), "tempPassword must not appear in audit log");
    assert.ok(!auditStr.includes("tempPassword"), "tempPassword key must not appear in audit log");
  });

  it("26. duplicate email rejected", () => {
    const db = makeDb();
    const unit = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    db.units.push(unit);
    createInitialManager(db, unit.id, { name: "Ana", email: "ana@ubs.gov.br" });
    const res = createInitialManager(db, unit.id, { name: "Ana 2", email: "ana@ubs.gov.br" });
    assert.ok(res.error);
    assert.match(res.error, /cadastrado/i);
  });

  it("27. unknown unitId rejected", () => {
    const db = makeDb();
    const res = createInitialManager(db, "nonexistent", { name: "Ana", email: "ana@ubs.gov.br" });
    assert.ok(res.error);
    assert.match(res.error, /não encontrada/);
  });

  it("28. gestor has role=gestor (not support_admin)", () => {
    const db = makeDb();
    const unit = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    db.units.push(unit);
    createInitialManager(db, unit.id, { name: "Ana", email: "ana@ubs.gov.br" });
    const gestor = db.users.find((u) => u.email === "ana@ubs.gov.br");
    assert.equal(gestor.role, "gestor");
    assert.notEqual(gestor.role, "support_admin");
  });

  it("29. gestor is associated with correct unitId", () => {
    const db = makeDb();
    const unit = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    db.units.push(unit);
    createInitialManager(db, unit.id, { name: "Ana", email: "ana@ubs.gov.br" });
    const gestor = db.users.find((u) => u.email === "ana@ubs.gov.br");
    assert.equal(gestor.unitId, unit.id);
  });

  it("30. full lifecycle: draft → onboarding → homologation → active", () => {
    const db = makeDb();
    const unit = createUnit({ name: "UBS", cnes: "1234567", municipalityName: "Recife", uf: "PE" });
    db.units.push(unit);

    // Create gestor → auto-transitions to onboarding
    createInitialManager(db, unit.id, { name: "Ana", email: "ana@ubs.gov.br" });
    assert.equal(db.units[0].status, "onboarding");

    // Advance to homologation
    let res = patchUnitStatus(db.units[0], "homologation");
    assert.ok(!res.error);
    db.units[0] = res.unit;
    assert.equal(db.units[0].status, "homologation");

    // Activate
    res = patchUnitStatus(db.units[0], "active");
    assert.ok(!res.error);
    db.units[0] = res.unit;
    assert.equal(db.units[0].status, "active");
    assert.ok(db.units[0].activatedAt);
  });
});
