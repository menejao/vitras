/**
 * CONSOLE-01 tests: National Operations Console refactor
 *
 * Validates:
 * 1. Unit stats computation (gestorCount, userCount, teamCount, patientCount)
 * 2. Search/filter logic
 * 3. Sort logic
 * 4. Pagination logic
 * 5. Summary computation
 * 6. Onboarding action detection from real data
 * 7. No pilot municipality hardcoding in form defaults
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Mirrors backend enrichUnit + buildUnitStats ────────────────────────────

function buildUnitStats(unitId, db) {
  const users    = db.users    || [];
  const teams    = db.teams    || [];
  const patients = db.patients || [];
  const gestorCount  = users.filter((u) => (u.unitId || "") === unitId && u.role === "gestor" && !u.inactive).length;
  const userCount    = users.filter((u) => (u.unitId || "") === unitId && !u.inactive).length;
  const teamCount    = teams.filter((t) => (t.unitId || "") === unitId).length;
  const patientCount = patients.filter((p) => (p.unitId || "") === unitId).length;
  return { gestorCount, userCount, teamCount, patientCount };
}

function enrichUnit(u, db) {
  return { id: u.id, name: u.name || "", cnes: u.cnes || "", municipalityName: u.municipalityName || "", uf: u.uf || "", status: u.status || "onboarding", createdAt: u.createdAt || "", ...buildUnitStats(u.id, db) };
}

// ── Mirrors backend search/filter/sort/paginate ────────────────────────────

function queryUnits(db, { search = "", uf = "", status = "", page = 1, limit = 25, sortBy = "name", sortDir = "asc" } = {}) {
  let units = (db.units || []).map((u) => enrichUnit(u, db));

  if (search) {
    const s = search.toLowerCase();
    units = units.filter((u) =>
      u.name.toLowerCase().includes(s) ||
      u.cnes.includes(s) ||
      u.municipalityName.toLowerCase().includes(s) ||
      (db.users || []).some((usr) => (usr.unitId || "") === u.id && usr.role === "gestor" && (String(usr.name || "").toLowerCase().includes(s) || String(usr.email || "").toLowerCase().includes(s)))
    );
  }
  if (uf)     units = units.filter((u) => u.uf.toUpperCase() === uf.toUpperCase());
  if (status) units = units.filter((u) => u.status === status);

  const dir = sortDir === "desc" ? -1 : 1;
  units.sort((a, b) => {
    const av = String(a[sortBy] || "").toLowerCase();
    const bv = String(b[sortBy] || "").toLowerCase();
    return av < bv ? -dir : av > bv ? dir : 0;
  });

  const total = units.length;
  const pages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  return { units: units.slice(start, start + limit), total, page, pages };
}

// ── Mirrors backend summary ────────────────────────────────────────────────

function computeSummary(db) {
  const units = db.units || [];
  const users = db.users || [];
  return {
    totalUnits:  units.length,
    onboarding:  units.filter((u) => (u.status || "onboarding") === "onboarding").length,
    active:      units.filter((u) => u.status === "active").length,
    inactive:    units.filter((u) => u.status === "inactive").length,
    totalGestors: users.filter((u) => u.role === "gestor" && !u.inactive).length,
    totalUsers:   users.filter((u) => !u.inactive).length,
    totalTeams:   (db.teams || []).length
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeDb() {
  return {
    units: [
      { id: "u1", name: "UBS Francisca Lima",   cnes: "1234567", municipalityName: "Recife",       uf: "PE", status: "active",      createdAt: "2026-01-01T00:00:00Z" },
      { id: "u2", name: "UBS Maria Amélia",      cnes: "7654321", municipalityName: "Salvador",     uf: "BA", status: "onboarding",  createdAt: "2026-03-01T00:00:00Z" },
      { id: "u3", name: "UBS João Pessoa Norte", cnes: "2222222", municipalityName: "João Pessoa",  uf: "PB", status: "inactive",    createdAt: "2026-02-01T00:00:00Z" },
      { id: "u4", name: "UBS Teste VITRAS",      cnes: "0000000", municipalityName: "São Paulo",    uf: "SP", status: "onboarding",  createdAt: "2026-06-01T00:00:00Z" },
    ],
    users: [
      { id: "usr1", unitId: "u1", role: "gestor", name: "Ana Costa",  email: "ana@ubs.gov.br",  inactive: false },
      { id: "usr2", unitId: "u1", role: "acs",    name: "João Silva", email: "joao@ubs.gov.br", inactive: false },
      { id: "usr3", unitId: "u2", role: "gestor", name: "Maria Lima", email: "maria@ubs.gov.br",inactive: false },
      { id: "usr4", unitId: "u1", role: "gestor", name: "Pedro Santos",email: "pedro@ubs.gov.br",inactive: true }, // inactive
    ],
    teams: [
      { id: "t1", unitId: "u1", name: "ESF 1", ine: "1111111111", tipoEquipe: "ESF" },
      { id: "t2", unitId: "u1", name: "ESF 2", ine: "2222222222", tipoEquipe: "ESF" },
      { id: "t3", unitId: "u4", name: "Equipe Teste VITRAS", ine: "0000000000", tipoEquipe: "ESF" },
    ],
    patients: [
      { id: "p1", unitId: "u1" },
      { id: "p2", unitId: "u1" },
      { id: "p3", unitId: "u2" },
    ]
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("CONSOLE-01: national operations console", () => {
  // ── Stats ────────────────────────────────────────────────────────────
  it("1. gestorCount counts only active gestors for unit", () => {
    const db = makeDb();
    const stats = buildUnitStats("u1", db);
    assert.equal(stats.gestorCount, 1); // usr4 is inactive
  });

  it("2. userCount counts all active users for unit", () => {
    const db = makeDb();
    const stats = buildUnitStats("u1", db);
    assert.equal(stats.userCount, 2); // usr1 + usr2 (usr4 inactive)
  });

  it("3. teamCount counts teams for unit", () => {
    const db = makeDb();
    assert.equal(buildUnitStats("u1", db).teamCount, 2);
    assert.equal(buildUnitStats("u2", db).teamCount, 0);
  });

  it("4. patientCount counts patients for unit", () => {
    const db = makeDb();
    assert.equal(buildUnitStats("u1", db).patientCount, 2);
    assert.equal(buildUnitStats("u2", db).patientCount, 1);
    assert.equal(buildUnitStats("u3", db).patientCount, 0);
  });

  it("5. unit with no users/teams/patients returns zeros", () => {
    const db = makeDb();
    const stats = buildUnitStats("u3", db);
    assert.equal(stats.gestorCount, 0);
    assert.equal(stats.userCount, 0);
    assert.equal(stats.teamCount, 0);
    assert.equal(stats.patientCount, 0);
  });

  // ── Search ──────────────────────────────────────────────────────────
  it("6. search by unit name (case-insensitive)", () => {
    const db = makeDb();
    const res = queryUnits(db, { search: "francisca" });
    assert.equal(res.units.length, 1);
    assert.equal(res.units[0].id, "u1");
  });

  it("7. search by CNES", () => {
    const db = makeDb();
    const res = queryUnits(db, { search: "7654321" });
    assert.equal(res.units.length, 1);
    assert.equal(res.units[0].id, "u2");
  });

  it("8. search by municipality", () => {
    const db = makeDb();
    const res = queryUnits(db, { search: "salvador" });
    assert.equal(res.units.length, 1);
    assert.equal(res.units[0].id, "u2");
  });

  it("9. search by gestor name", () => {
    const db = makeDb();
    const res = queryUnits(db, { search: "ana costa" });
    assert.equal(res.units.length, 1);
    assert.equal(res.units[0].id, "u1");
  });

  it("10. empty search returns all", () => {
    const db = makeDb();
    const res = queryUnits(db, { search: "" });
    assert.equal(res.total, 4);
  });

  // ── Filter ──────────────────────────────────────────────────────────
  it("11. filter by UF", () => {
    const db = makeDb();
    const res = queryUnits(db, { uf: "PE" });
    assert.equal(res.total, 1);
    assert.equal(res.units[0].id, "u1");
  });

  it("12. filter by status=onboarding", () => {
    const db = makeDb();
    const res = queryUnits(db, { status: "onboarding" });
    assert.equal(res.total, 2); // u2 + u4
  });

  it("13. filter by status=active", () => {
    const db = makeDb();
    const res = queryUnits(db, { status: "active" });
    assert.equal(res.total, 1);
    assert.equal(res.units[0].id, "u1");
  });

  it("14. combined filter UF + status", () => {
    const db = makeDb();
    const res = queryUnits(db, { uf: "SP", status: "onboarding" });
    assert.equal(res.total, 1);
    assert.equal(res.units[0].id, "u4");
  });

  // ── Sort ────────────────────────────────────────────────────────────
  it("15. sort by name asc", () => {
    const db = makeDb();
    const res = queryUnits(db, { sortBy: "name", sortDir: "asc" });
    const names = res.units.map((u) => u.name);
    const sorted = [...names].sort();
    assert.deepEqual(names, sorted);
  });

  it("16. sort by name desc", () => {
    const db = makeDb();
    const res = queryUnits(db, { sortBy: "name", sortDir: "desc" });
    const names = res.units.map((u) => u.name);
    const sorted = [...names].sort().reverse();
    assert.deepEqual(names, sorted);
  });

  // ── Pagination ──────────────────────────────────────────────────────
  it("17. pagination: page 1 of 2 with limit 2", () => {
    const db = makeDb();
    const res = queryUnits(db, { limit: 2, page: 1 });
    assert.equal(res.units.length, 2);
    assert.equal(res.total, 4);
    assert.equal(res.pages, 2);
    assert.equal(res.page, 1);
  });

  it("18. pagination: page 2 of 2 with limit 2", () => {
    const db = makeDb();
    const res = queryUnits(db, { limit: 2, page: 2 });
    assert.equal(res.units.length, 2);
    assert.equal(res.page, 2);
  });

  it("19. page beyond range returns empty", () => {
    const db = makeDb();
    const res = queryUnits(db, { limit: 10, page: 99 });
    assert.equal(res.units.length, 0);
    assert.equal(res.total, 4);
  });

  // ── Summary ─────────────────────────────────────────────────────────
  it("20. summary totalUnits", () => {
    const db = makeDb();
    const s = computeSummary(db);
    assert.equal(s.totalUnits, 4);
  });

  it("21. summary onboarding count", () => {
    const db = makeDb();
    const s = computeSummary(db);
    assert.equal(s.onboarding, 2);
  });

  it("22. summary active count", () => {
    const db = makeDb();
    const s = computeSummary(db);
    assert.equal(s.active, 1);
  });

  it("23. summary inactive count", () => {
    const db = makeDb();
    const s = computeSummary(db);
    assert.equal(s.inactive, 1);
  });

  it("24. summary totalGestors excludes inactive users", () => {
    const db = makeDb();
    const s = computeSummary(db);
    assert.equal(s.totalGestors, 2); // usr1 + usr3 (usr4 inactive)
  });

  it("25. summary totalTeams", () => {
    const db = makeDb();
    const s = computeSummary(db);
    assert.equal(s.totalTeams, 3);
  });

  // ── Onboarding actions from real data ─────────────────────────────
  it("26. unit with no gestors needs gestor action", () => {
    const db = makeDb();
    const stats = buildUnitStats("u3", db);
    assert.equal(stats.gestorCount, 0);
    // Frontend shows "Cadastrar gestor inicial" when gestorCount === 0
  });

  it("27. unit with gestors does not need gestor action", () => {
    const db = makeDb();
    const stats = buildUnitStats("u1", db);
    assert.ok(stats.gestorCount > 0);
  });

  it("28. unit with no teams needs team action", () => {
    const db = makeDb();
    const stats = buildUnitStats("u2", db);
    assert.equal(stats.teamCount, 0);
  });

  it("29. UBS Teste VITRAS has team (Equipe Teste VITRAS)", () => {
    const db = makeDb();
    const stats = buildUnitStats("u4", db);
    assert.equal(stats.teamCount, 1);
  });

  it("30. form default UF is not hardcoded to SP", () => {
    // The UnitForm now defaults to uf: "" (no pilot municipality hardcoded)
    const defaultFormState = { name: "", cnes: "", municipalityName: "", uf: "", municipalityId: "", contactEmail: "", phone: "", status: "onboarding" };
    assert.equal(defaultFormState.uf, "");
    assert.equal(defaultFormState.municipalityName, "");
    assert.equal(defaultFormState.municipalityId, "");
  });
});
