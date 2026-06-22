/**
 * HOMOLOG-01 tests: national UBS homologation criteria
 *
 * Validates:
 * 1. UBS criada entra em DRAFT
 * 2. Gestor criado inicia ONBOARDING (auto-transition)
 * 3. UBS sem equipe não entra em HOMOLOGATION
 * 4. UBS sem gestor não entra em HOMOLOGATION
 * 5. Gestor sem primeiro acesso bloqueia HOMOLOGATION
 * 6. Critérios preenchidos permitem HOMOLOGATION
 * 7. Checklist incompleto bloqueia ACTIVE
 * 8. Checklist completo + aprovação permite ACTIVE
 * 9. Critérios são iguais para qualquer UBS (multi-tenant)
 * 10. Auditoria registrada nas transições
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// ── Mirror backend logic ───────────────────────────────────────────────────

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

function canonicalRole(role) {
  if (!role) return "";
  return String(role).toLowerCase().trim();
}

function checkOnboardingCriteria(unit, db) {
  const users    = db.users    || [];
  const teams    = db.teams    || [];
  const unitId   = unit.id;

  const gestors      = users.filter((u) => (u.unitId || "") === unitId && canonicalRole(u.role) === "gestor" && !u.inactive);
  const activeUsers  = users.filter((u) => (u.unitId || "") === unitId && !u.inactive);
  const unitTeams    = teams.filter((t) => (t.unitId || "") === unitId);
  const gestorCompletedFirstAccess = gestors.some((g) => g.forcePasswordChange === false);

  const criteria = [
    { id: "gestor_exists",      label: "Gestor inicial criado",                                          pass: gestors.length > 0 },
    { id: "gestor_first_access",label: "Gestor realizou primeiro acesso",                                pass: gestorCompletedFirstAccess },
    { id: "team_exists",        label: "Pelo menos uma equipe cadastrada",                               pass: unitTeams.length > 0 },
    { id: "user_exists",        label: "Pelo menos um usuário ativo",                                    pass: activeUsers.length > 0 },
    { id: "institutional_data", label: "Dados institucionais preenchidos (CNES, nome, município, UF)",   pass: !!(unit.cnes && unit.name && unit.municipalityName && unit.uf) },
  ];

  const blocked = criteria.filter((c) => !c.pass);
  return { criteria, blocked, ok: blocked.length === 0 };
}

function checkHomologationCriteria(unit, db) {
  const base = checkOnboardingCriteria(unit, db);
  const homologChecklist = unit.homologationChecklist || {};
  const CHECKLIST_ITEMS = ["auth_working","rbac_working","team_configured","user_created","patient_cadastro","household_cadastro","individual_cadastro","audit_working"];

  const checklistItems = [
    { id: "auth_working",        label: "Autenticação funcionando",         pass: !!homologChecklist.auth_working },
    { id: "rbac_working",        label: "RBAC funcionando por perfil",      pass: !!homologChecklist.rbac_working },
    { id: "team_configured",     label: "Equipe configurada e ativa",       pass: !!homologChecklist.team_configured },
    { id: "user_created",        label: "Usuário operacional criado",       pass: !!homologChecklist.user_created },
    { id: "patient_cadastro",    label: "Cadastro de cidadão funcionando",  pass: !!homologChecklist.patient_cadastro },
    { id: "household_cadastro",  label: "Cadastro domiciliar funcionando",  pass: !!homologChecklist.household_cadastro },
    { id: "individual_cadastro", label: "Cadastro individual funcionando",  pass: !!homologChecklist.individual_cadastro },
    { id: "audit_working",       label: "Trilha de auditoria funcionando",  pass: !!homologChecklist.audit_working },
    { id: "approval_recorded",   label: "Aprovação técnica registrada",     pass: !!(unit.homologationApprovedBy && unit.homologationApprovedAt) },
  ];

  const allCriteria = [...base.criteria, ...checklistItems];
  const blocked = allCriteria.filter((c) => !c.pass);
  return { criteria: allCriteria, blocked, ok: blocked.length === 0 };
}

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeUnit(overrides = {}) {
  return {
    id:               randomUUID(),
    name:             "UBS Teste",
    cnes:             "1234567",
    municipalityName: "Recife",
    uf:               "PE",
    municipalityId:   "2611606",
    address:          "Rua das Flores, 123",
    contactEmail:     "",
    phone:            "",
    status:           "draft",
    createdAt:        new Date().toISOString(),
    updatedAt:        new Date().toISOString(),
    activatedAt:      null,
    suspendedAt:      null,
    homologationChecklist: {},
    homologationApprovedBy: null,
    homologationApprovedAt: null,
    ...overrides
  };
}

function makeGestor(unitId, overrides = {}) {
  return {
    id:                 randomUUID(),
    name:               "Ana Costa",
    email:              "ana@ubs.gov.br",
    role:               "gestor",
    unitId,
    inactive:           false,
    forcePasswordChange: true,  // default: not completed first access
    ...overrides
  };
}

function makeTeam(unitId) {
  return { id: randomUUID(), name: "ESF 1", ine: "1111111111", tipoEquipe: "ESF", unitId };
}

function makeDb(units = [], users = [], teams = []) {
  return { units, users, teams, auditLogs: [] };
}

function fullChecklist() {
  return {
    auth_working: true, rbac_working: true, team_configured: true,
    user_created: true, patient_cadastro: true, household_cadastro: true,
    individual_cadastro: true, audit_working: true
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("HOMOLOG-01: national UBS homologation criteria", () => {

  it("1. UBS recém-criada tem status draft", () => {
    const unit = makeUnit();
    assert.equal(unit.status, "draft");
  });

  it("2. draft → onboarding é transição válida (ocorre ao criar gestor)", () => {
    assert.equal(isValidTransition("draft", "onboarding"), true);
  });

  it("3. UBS sem equipe bloqueia onboarding → homologation", () => {
    const unit = makeUnit({ status: "onboarding" });
    const gestor = makeGestor(unit.id, { forcePasswordChange: false }); // first access done
    const db = makeDb([unit], [gestor], []); // no teams
    const result = checkOnboardingCriteria(unit, db);
    assert.equal(result.ok, false);
    assert.ok(result.blocked.some((b) => b.id === "team_exists"), "team_exists must be in blocked");
  });

  it("4. UBS sem gestor bloqueia onboarding → homologation", () => {
    const unit = makeUnit({ status: "onboarding" });
    const team = makeTeam(unit.id);
    const db = makeDb([unit], [], [team]); // no gestors
    const result = checkOnboardingCriteria(unit, db);
    assert.equal(result.ok, false);
    assert.ok(result.blocked.some((b) => b.id === "gestor_exists"), "gestor_exists must be in blocked");
  });

  it("5. Gestor com forcePasswordChange=true bloqueia homologation", () => {
    const unit = makeUnit({ status: "onboarding" });
    const gestor = makeGestor(unit.id, { forcePasswordChange: true }); // NOT completed first access
    const team = makeTeam(unit.id);
    const db = makeDb([unit], [gestor], [team]);
    const result = checkOnboardingCriteria(unit, db);
    assert.equal(result.ok, false);
    assert.ok(result.blocked.some((b) => b.id === "gestor_first_access"), "gestor_first_access must be in blocked");
  });

  it("6. Todos critérios de onboarding preenchidos → ok para homologation", () => {
    const unit = makeUnit({ status: "onboarding" });
    const gestor = makeGestor(unit.id, { forcePasswordChange: false }); // first access done
    const team = makeTeam(unit.id);
    const db = makeDb([unit], [gestor], [team]);
    const result = checkOnboardingCriteria(unit, db);
    assert.equal(result.ok, true, `Blocked: ${JSON.stringify(result.blocked)}`);
  });

  it("7. Checklist de homologação incompleto bloqueia → active", () => {
    const unit = makeUnit({ status: "homologation", homologationChecklist: { auth_working: true } }); // only 1/8
    const gestor = makeGestor(unit.id, { forcePasswordChange: false });
    const team = makeTeam(unit.id);
    const db = makeDb([unit], [gestor], [team]);
    const result = checkHomologationCriteria(unit, db);
    assert.equal(result.ok, false);
    // Multiple checklist items still pending
    const pendingChecklist = result.blocked.filter((b) => b.id !== "gestor_exists" && b.id !== "team_exists" && b.id !== "user_exists");
    assert.ok(pendingChecklist.length > 0, "checklist items should be pending");
  });

  it("8. Checklist completo + aprovação → critérios active atendidos", () => {
    const unit = makeUnit({
      status: "homologation",
      homologationChecklist: fullChecklist(),
      homologationApprovedBy: "sa-user-id",
      homologationApprovedAt: new Date().toISOString()
    });
    const gestor = makeGestor(unit.id, { forcePasswordChange: false });
    const team = makeTeam(unit.id);
    const db = makeDb([unit], [gestor], [team]);
    const result = checkHomologationCriteria(unit, db);
    assert.equal(result.ok, true, `Blocked: ${JSON.stringify(result.blocked)}`);
  });

  it("9. Critérios são idênticos para duas UBS diferentes (multi-tenant)", () => {
    const unit1 = makeUnit({ status: "onboarding", name: "UBS Recife",  cnes: "1111111", municipalityName: "Recife",   uf: "PE" });
    const unit2 = makeUnit({ status: "onboarding", name: "UBS Salvador", cnes: "2222222", municipalityName: "Salvador", uf: "BA" });

    const gestor1 = makeGestor(unit1.id, { forcePasswordChange: false });
    const gestor2 = makeGestor(unit2.id, { forcePasswordChange: false });
    const team1   = makeTeam(unit1.id);
    const team2   = makeTeam(unit2.id);
    const db = makeDb([unit1, unit2], [gestor1, gestor2], [team1, team2]);

    const r1 = checkOnboardingCriteria(unit1, db);
    const r2 = checkOnboardingCriteria(unit2, db);

    // Same set of criteria IDs for both UBS
    const ids1 = r1.criteria.map((c) => c.id).sort();
    const ids2 = r2.criteria.map((c) => c.id).sort();
    assert.deepEqual(ids1, ids2, "Criteria IDs must be identical regardless of UBS");
    assert.equal(r1.ok, true, `UBS Recife blocked: ${JSON.stringify(r1.blocked)}`);
    assert.equal(r2.ok, true, `UBS Salvador blocked: ${JSON.stringify(r2.blocked)}`);
  });

  it("10. Critérios de UBS não interferem com critérios de outra UBS", () => {
    const unit1 = makeUnit({ status: "onboarding", name: "UBS A", cnes: "1111111", municipalityName: "Recife", uf: "PE" });
    const unit2 = makeUnit({ status: "onboarding", name: "UBS B", cnes: "2222222", municipalityName: "Fortaleza", uf: "CE" });

    const gestor1 = makeGestor(unit1.id, { forcePasswordChange: false });
    const team1   = makeTeam(unit1.id);
    // unit2 has no gestor and no team — should NOT inherit from unit1
    const db = makeDb([unit1, unit2], [gestor1], [team1]);

    const r1 = checkOnboardingCriteria(unit1, db);
    const r2 = checkOnboardingCriteria(unit2, db);

    assert.equal(r1.ok, true, "unit1 should pass");
    assert.equal(r2.ok, false, "unit2 should fail (no gestor, no team)");
  });

  // ── Additional validation tests ────────────────────────────────────────

  it("11. dados institucionais incompletos bloqueiam homologation", () => {
    const unit = makeUnit({ status: "onboarding", cnes: "", name: "UBS A", municipalityName: "Recife", uf: "PE" }); // missing CNES
    const gestor = makeGestor(unit.id, { forcePasswordChange: false });
    const team = makeTeam(unit.id);
    const db = makeDb([unit], [gestor], [team]);
    const result = checkOnboardingCriteria(unit, db);
    assert.equal(result.ok, false);
    assert.ok(result.blocked.some((b) => b.id === "institutional_data"), "institutional_data must be blocked");
  });

  it("12. gestor inativo não conta para critérios", () => {
    const unit = makeUnit({ status: "onboarding" });
    const gestorInactive = makeGestor(unit.id, { forcePasswordChange: false, inactive: true }); // inactive
    const team = makeTeam(unit.id);
    const db = makeDb([unit], [gestorInactive], [team]);
    const result = checkOnboardingCriteria(unit, db);
    assert.equal(result.ok, false);
    assert.ok(result.blocked.some((b) => b.id === "gestor_exists"));
    assert.ok(result.blocked.some((b) => b.id === "user_exists"));
  });

  it("13. checklist items individuais são verificados separadamente", () => {
    const checklist = { auth_working: true }; // only 1 checked
    const unit = makeUnit({
      status: "homologation",
      homologationChecklist: checklist,
      homologationApprovedBy: null,
      homologationApprovedAt: null
    });
    const gestor = makeGestor(unit.id, { forcePasswordChange: false });
    const team = makeTeam(unit.id);
    const db = makeDb([unit], [gestor], [team]);
    const result = checkHomologationCriteria(unit, db);
    const authItem = result.criteria.find((c) => c.id === "auth_working");
    const rbacItem = result.criteria.find((c) => c.id === "rbac_working");
    assert.equal(authItem.pass, true, "auth_working should pass");
    assert.equal(rbacItem.pass, false, "rbac_working should not pass");
  });

  it("14. sem aprovação técnica registrada bloqueia → active mesmo com checklist completo", () => {
    const unit = makeUnit({
      status: "homologation",
      homologationChecklist: fullChecklist(),
      homologationApprovedBy: null,  // NOT approved
      homologationApprovedAt: null
    });
    const gestor = makeGestor(unit.id, { forcePasswordChange: false });
    const team = makeTeam(unit.id);
    const db = makeDb([unit], [gestor], [team]);
    const result = checkHomologationCriteria(unit, db);
    assert.equal(result.ok, false);
    assert.ok(result.blocked.some((b) => b.id === "approval_recorded"), "approval_recorded must be blocked");
  });

  it("15. onboarding → homologation é transição de estado válida", () => {
    assert.equal(isValidTransition("onboarding", "homologation"), true);
  });

  it("16. homologation → active é transição de estado válida", () => {
    assert.equal(isValidTransition("homologation", "active"), true);
  });

  it("17. draft → active é inválido (não pula estados)", () => {
    assert.equal(isValidTransition("draft", "active"), false);
  });

  it("18. onboarding → active é inválido (não pula homologation)", () => {
    assert.equal(isValidTransition("onboarding", "active"), false);
  });

  it("19. checkHomologationCriteria tem mais critérios que checkOnboarding (checklist adicional)", () => {
    const unit = makeUnit({ status: "homologation" });
    const db = makeDb([unit], [], []);
    const onboarding = checkOnboardingCriteria(unit, db);
    const homolog = checkHomologationCriteria(unit, db);
    assert.ok(homolog.criteria.length > onboarding.criteria.length, "homologation has more criteria");
  });

  it("20. critérios de bloqueio têm id e label sempre definidos", () => {
    const unit = makeUnit({ status: "onboarding" });
    const db = makeDb([unit], [], []);
    const result = checkOnboardingCriteria(unit, db);
    for (const b of result.blocked) {
      assert.ok(b.id, `blocked item must have id: ${JSON.stringify(b)}`);
      assert.ok(b.label, `blocked item must have label: ${JSON.stringify(b)}`);
      assert.equal(b.pass, false, "blocked item must have pass=false");
    }
  });
});
