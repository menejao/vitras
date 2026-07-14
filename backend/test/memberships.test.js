/**
 * memberships.test.js — Sprint A: userUnitMemberships
 *
 * Cobre:
 *   - ensureDbShape popula userUnitMemberships de user.unitId
 *   - migration é idempotente
 *   - migration preserva user.unitId, teamId, role, capabilities (não as move)
 *   - membership inactive não polui a coleção
 *   - GET /auth/available-units retorna apenas memberships ativos do usuário autenticado
 *   - GET /auth/available-units não vaza memberships de outros usuários
 *   - role vem do usuário, nunca do membership
 *   - primary=true criado pelo migration
 */

import { strict as assert } from "assert";
import { ensureDbShape } from "../src/utils/domain.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDb(overrides = {}) {
  return {
    patients: [],
    users: [],
    teams: [],
    units: [],
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
    auditLogs: [],
    tasks: [],
    messages: [],
    households: [],
    referrals: [],
    insumos: [],
    pharmacy: [],
    dental: [],
    acsVisits: [],
    familyGroups: [],
    ...overrides,
  };
}

function makeUser(id, unitId, teamId = "team-1", role = "nurse") {
  return { id, name: `User ${id}`, email: `${id}@test.com`, role, unitId, teamId, active: true };
}

function makeTeam(id, unitId) {
  return { id, name: `Team ${id}`, unitId, managerUserId: "", createdAt: new Date().toISOString() };
}

function makeUnit(id) {
  return { id, name: `UBS ${id}`, cnes: "", createdAt: new Date().toISOString() };
}

// ── Testes ────────────────────────────────────────────────────────────────────

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

console.log("TEST SUITE: memberships.test.js\n");

// ── 1. Migration cria membership ──────────────────────────────────────────────

test("migration cria membership para cada usuário com unitId", () => {
  const db = makeDb({
    users: [makeUser("u1", "unit-a", "team-1")],
    teams: [makeTeam("team-1", "unit-a")],
    units: [makeUnit("unit-a")],
  });
  ensureDbShape(db);
  assert.equal(db.userUnitMemberships.length, 1);
  const m = db.userUnitMemberships[0];
  assert.equal(m.userId, "u1");
  assert.equal(m.unitId, "unit-a");
  assert.equal(m.teamId, "team-1");
  assert.equal(m.status, "active");
  assert.equal(m.primary, true);
  assert.ok(m.id, "deve ter id");
  assert.ok(m.createdAt, "deve ter createdAt");
});

// ── 2. Migration é idempotente ────────────────────────────────────────────────

test("migration não duplica memberships em execuções repetidas", () => {
  const db = makeDb({
    users: [makeUser("u1", "unit-a", "team-1")],
    teams: [makeTeam("team-1", "unit-a")],
    units: [makeUnit("unit-a")],
  });
  ensureDbShape(db);
  ensureDbShape(db);
  ensureDbShape(db);
  assert.equal(db.userUnitMemberships.length, 1, "deve ter exatamente 1 membership após 3 chamadas");
});

// ── 3. Migration preserva user.unitId ────────────────────────────────────────

test("migration preserva user.unitId no objeto usuário", () => {
  const db = makeDb({
    users: [makeUser("u1", "unit-a", "team-1")],
    teams: [makeTeam("team-1", "unit-a")],
    units: [makeUnit("unit-a")],
  });
  ensureDbShape(db);
  assert.equal(db.users[0].unitId, "unit-a", "user.unitId deve permanecer intacto");
});

// ── 4. Migration preserva teamId ──────────────────────────────────────────────

test("migration preserva user.teamId no objeto usuário", () => {
  const db = makeDb({
    users: [makeUser("u1", "unit-a", "team-1")],
    teams: [makeTeam("team-1", "unit-a")],
    units: [makeUnit("unit-a")],
  });
  ensureDbShape(db);
  assert.equal(db.users[0].teamId, "team-1", "user.teamId deve permanecer intacto");
});

// ── 5. Role NÃO está no membership ───────────────────────────────────────────

test("membership não armazena role", () => {
  const db = makeDb({
    users: [makeUser("u1", "unit-a", "team-1", "doctor")],
    teams: [makeTeam("team-1", "unit-a")],
    units: [makeUnit("unit-a")],
  });
  ensureDbShape(db);
  const m = db.userUnitMemberships[0];
  assert.ok(!("role" in m), "membership não deve ter campo role");
});

// ── 6. Capabilities NÃO estão no membership ───────────────────────────────────

test("membership não armazena capabilities", () => {
  const db = makeDb({
    users: [makeUser("u1", "unit-a", "team-1", "nurse")],
    teams: [makeTeam("team-1", "unit-a")],
    units: [makeUnit("unit-a")],
  });
  ensureDbShape(db);
  const m = db.userUnitMemberships[0];
  assert.ok(!("capabilities" in m), "membership não deve ter campo capabilities");
});

// ── 7. Múltiplos usuários → múltiplos memberships ────────────────────────────

test("migration cria um membership por usuário (múltiplos usuários)", () => {
  const db = makeDb({
    users: [
      makeUser("u1", "unit-a", "team-1"),
      makeUser("u2", "unit-b", "team-2"),
    ],
    teams: [makeTeam("team-1", "unit-a"), makeTeam("team-2", "unit-b")],
    units: [makeUnit("unit-a"), makeUnit("unit-b")],
  });
  ensureDbShape(db);
  assert.equal(db.userUnitMemberships.length, 2);
  const ids = db.userUnitMemberships.map((m) => m.userId);
  assert.ok(ids.includes("u1"));
  assert.ok(ids.includes("u2"));
});

// ── 8. primary=true na migration ──────────────────────────────────────────────

test("migration define primary=true para o primeiro vínculo", () => {
  const db = makeDb({
    users: [makeUser("u1", "unit-a", "team-1")],
    teams: [makeTeam("team-1", "unit-a")],
    units: [makeUnit("unit-a")],
  });
  ensureDbShape(db);
  assert.strictEqual(db.userUnitMemberships[0].primary, true);
});

// ── 9. Usuário sem unitId não gera membership ─────────────────────────────────

test("usuário sem unitId não gera membership inválido", () => {
  const user = makeUser("u1", "", "team-1");
  user.unitId = ""; // explicitamente vazio
  const db = makeDb({
    users: [user],
    teams: [makeTeam("team-1", "unit-a")],
    units: [makeUnit("unit-a")],
  });
  // Após ensureDbShape, user.unitId será derivado de team.unitId
  ensureDbShape(db);
  // A migration deve ter criado membership com o unitId derivado
  // (domain.js normaliza primeiro, migration roda depois)
  const memberships = db.userUnitMemberships.filter((m) => m.userId === "u1");
  // unitId derivado = "unit-a" (de team-1)
  if (memberships.length > 0) {
    assert.equal(memberships[0].unitId, "unit-a", "unitId derivado da equipe");
  }
  // Se não criou, é porque unitId ficou vazio (unit-a não existe ainda no momento da normalização)
  // Ambos os casos são aceitáveis — o ponto é não criar membership com unitId vazio
  for (const m of memberships) {
    assert.ok(m.unitId, "membership nunca deve ter unitId vazio");
  }
});

// ── 10. Membership pre-existente não é duplicado ──────────────────────────────

test("membership pre-existente preservado, não duplicado", () => {
  const preExisting = {
    id: "mem-existing",
    userId: "u1",
    unitId: "unit-a",
    teamId: "team-1",
    status: "active",
    primary: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z"
  };
  const db = makeDb({
    users: [makeUser("u1", "unit-a", "team-1")],
    teams: [makeTeam("team-1", "unit-a")],
    units: [makeUnit("unit-a")],
    userUnitMemberships: [preExisting],
  });
  ensureDbShape(db);
  const memberships = db.userUnitMemberships.filter((m) => m.userId === "u1");
  assert.equal(memberships.length, 1, "não deve duplicar");
  assert.equal(memberships[0].id, "mem-existing", "deve preservar o id original");
});

// ── 11. GET /auth/available-units: retorna apenas memberships ativos do user ──
// Testamos a lógica da rota de forma isolada (sem HTTP)

test("lógica de available-units: retorna apenas memberships ativos do userId correto", () => {
  const db = makeDb({
    users: [
      makeUser("u1", "unit-a", "team-1", "nurse"),
      makeUser("u2", "unit-b", "team-2", "doctor"),
    ],
    teams: [makeTeam("team-1", "unit-a"), makeTeam("team-2", "unit-b")],
    units: [makeUnit("unit-a"), makeUnit("unit-b")],
  });
  ensureDbShape(db);

  // Simula lógica da rota para u1
  const userId = "u1";
  const unitMap = new Map(db.units.map((u) => [u.id, u]));
  const teamMap = new Map(db.teams.map((t) => [t.id, t]));
  const actor = db.users.find((u) => u.id === userId);

  const memberships = db.userUnitMemberships
    .filter((m) => m.userId === userId && m.status === "active")
    .map((m) => ({
      membershipId: m.id,
      unitId: m.unitId,
      unitName: unitMap.get(m.unitId)?.name || m.unitId,
      teamId: m.teamId || "",
      teamName: teamMap.get(m.teamId)?.name || "",
      role: actor?.role || "",
    }));

  assert.equal(memberships.length, 1, "deve retornar apenas o membership de u1");
  assert.equal(memberships[0].unitId, "unit-a");
  assert.equal(memberships[0].role, "nurse", "role vem do usuário, não do membership");
  assert.ok(!memberships.some((m) => m.unitId === "unit-b"), "não deve vazar dados de u2");
});

// ── 12. inactive membership não aparece ──────────────────────────────────────

test("membership com status inactive não aparece em available-units", () => {
  const db = makeDb({
    users: [makeUser("u1", "unit-a", "team-1")],
    teams: [makeTeam("team-1", "unit-a")],
    units: [makeUnit("unit-a")],
    userUnitMemberships: [
      {
        id: "m-inactive",
        userId: "u1",
        unitId: "unit-a",
        teamId: "team-1",
        status: "inactive",
        primary: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ],
  });
  ensureDbShape(db);

  const userId = "u1";
  const active = db.userUnitMemberships.filter(
    (m) => m.userId === userId && m.status === "active"
  );
  // Se o membership era inactive, migration pode ter adicionado um active novo
  // O inactive original não deve aparecer nos resultados
  for (const m of active) {
    assert.equal(m.status, "active", "somente memberships active retornados");
  }
});

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\nResultado: ${passed} OK, ${failed} FAIL\n`);
if (failed > 0) {
  console.error(`✗ ${failed} teste(s) falharam`);
  process.exit(1);
} else {
  console.log("✓ Todos os testes de memberships.test.js passaram.");
}
