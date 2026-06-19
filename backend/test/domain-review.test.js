import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, patch, get } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";
import { syncPatientFamilyGroup } from "../src/utils/family-groups.js";

describe("Revisão de Domínio — APS-01J-E", () => {
  before(startTestServer);
  after(stopTestServer);

  let acsToken = null;

  before(async () => {
    await withDb((db) => {
      ensureDbShape(db);

      if (!db.teams.some((t) => t.id === "team-dr")) {
        db.teams.unshift({
          id: "team-dr",
          name: "Equipe DR",
          managerUserId: "u1",
          unitId: "unit-default",
          createdAt: new Date().toISOString(),
        });
      }

      if (!db.users.some((u) => u.id === "dr-acs-user")) {
        db.users.push({
          id: "dr-acs-user",
          name: "ACS DR",
          role: "acs",
          email: "acs.dr@vitras.test",
          password: hashPassword("Test@DR2026!"),
          teamId: "team-dr",
          unitId: "unit-default",
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const acsLogin = await post("/auth/login", { email: "acs.dr@vitras.test", password: "Test@DR2026!" });
    acsToken = acsLogin.json?.token || acsLogin.json?.accessToken || null;
    assert.ok(acsToken, "ACS login failed");
  });

  // --- Cenário 1: Paciente sozinho -----------------------------------------------
  it("Cenário 1: paciente sozinho tem Domicílio, não exige Grupo Familiar", async () => {
    const P_ID = "dr-solo-patient";

    await withDb((db) => {
      ensureDbShape(db);
      if (!db.patients.some((p) => p.id === P_ID)) {
        db.patients.push({
          id: P_ID, teamId: "team-dr", assignedAcsId: "dr-acs-user",
          name: "Paciente Solo DR", cpf: "33344455566", phone: "(11)11111-3333",
          logradouro: "Rua Solo", numero: "1", bairro: "Centro", cep: "01001000",
          inactive: false, incompleteProfile: false, careCategory: "general",
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
      }
    });

    // Create household
    const { status: s1, json: hh } = await post("/households", {
      patientId: P_ID,
      logradouro: "Rua Solo",
      numero: "1",
      bairro: "Centro",
      cep: "01001000",
      tipoImovel: "DOMICILIO",
      tipoDomicilio: "CASA",
    }, acsToken);

    assert.equal(s1, 201, `Expected 201: ${JSON.stringify(hh)}`);
    assert.ok(hh.id, "household id missing");

    // Patient must have householdId set
    await withDb((db) => {
      const p = db.patients.find((x) => x.id === P_ID);
      assert.ok(p, "patient not found");
      assert.equal(p.householdId, hh.id, "patient.householdId not linked");

      // CD must not depend on GF — patient can have no family group
      const groups = db.familyGroups.filter(
        (g) => g.teamId === "team-dr" && Array.isArray(g.memberPatientIds) && g.memberPatientIds.includes(P_ID)
      );
      // If a group exists it must be derived from household, not required
      if (groups.length > 0) {
        assert.equal(groups[0].householdId, hh.id, "group not linked to household");
      }
    });
  });

  // --- Cenário 2: Dois pacientes no mesmo endereço --------------------------------
  it("Cenário 2: dois pacientes no mesmo endereço compartilham Domicílio e formam Grupo Familiar", async () => {
    const P_A = "dr-shared-patient-a";
    const P_B = "dr-shared-patient-b";
    const ADDR = { logradouro: "Rua Compartilhada", numero: "42", bairro: "Bairro X", cep: "04040000" };

    await withDb((db) => {
      ensureDbShape(db);
      for (const [id, cpf, name] of [[P_A, "44455566677", "Paciente A DR"], [P_B, "55566677788", "Paciente B DR"]]) {
        if (!db.patients.some((p) => p.id === id)) {
          db.patients.push({
            id, teamId: "team-dr", assignedAcsId: "dr-acs-user",
            name, cpf, phone: "(11)22222-0000",
            ...ADDR,
            inactive: false, incompleteProfile: false, careCategory: "general",
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          });
        }
      }
    });

    // Patient A creates household
    const { status: s1, json: hhA } = await post("/households", {
      patientId: P_A, ...ADDR, tipoImovel: "DOMICILIO",
    }, acsToken);
    assert.equal(s1, 201, `Patient A household: ${JSON.stringify(hhA)}`);

    // Patient B creates household at same address → should reuse hhA
    const { status: s2, json: hhB } = await post("/households", {
      patientId: P_B, ...ADDR, tipoImovel: "DOMICILIO",
    }, acsToken);
    // Both 200 and 201 are acceptable (reused existing)
    assert.ok([200, 201].includes(s2), `Patient B household: ${JSON.stringify(hhB)}`);
    assert.equal(hhB.id, hhA.id, "Patients at same address must share the same household");

    // Both patients have same householdId
    await withDb((db) => {
      const pA = db.patients.find((p) => p.id === P_A);
      const pB = db.patients.find((p) => p.id === P_B);
      assert.equal(pA.householdId, hhA.id, "Patient A householdId wrong");
      assert.equal(pB.householdId, hhA.id, "Patient B householdId wrong");

      // Sync family groups for both
      const actor = { id: "system" };
      syncPatientFamilyGroup(db, pA, actor, "test cenário 2");
      syncPatientFamilyGroup(db, pB, actor, "test cenário 2");

      // Both in same group derived from household
      const groups = db.familyGroups.filter(
        (g) => g.teamId === "team-dr" && g.householdId === hhA.id
      );
      assert.ok(groups.length > 0, "Family group not formed for shared household");
      const group = groups[0];
      assert.ok(group.memberPatientIds.includes(P_A), "Patient A not in family group");
      assert.ok(group.memberPatientIds.includes(P_B), "Patient B not in family group");
    });
  });

  // --- Cenário 3: Mudança de endereço -------------------------------------------
  it("Cenário 3: mudança de endereço → novo household, householdId atualizado, histórico preservado", async () => {
    const P_ID = "dr-mover-patient";

    await withDb((db) => {
      ensureDbShape(db);
      if (!db.patients.some((p) => p.id === P_ID)) {
        db.patients.push({
          id: P_ID, teamId: "team-dr", assignedAcsId: "dr-acs-user",
          name: "Paciente Mover DR", cpf: "66677788899", phone: "(11)33333-0000",
          logradouro: "Rua Antiga", numero: "10", bairro: "Bairro Velho", cep: "05050000",
          inactive: false, incompleteProfile: false, careCategory: "general",
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
      }
    });

    // Create household at old address
    const { json: hhOld } = await post("/households", {
      patientId: P_ID,
      logradouro: "Rua Antiga", numero: "10", bairro: "Bairro Velho", cep: "05050000",
      tipoImovel: "DOMICILIO",
    }, acsToken);
    const oldHhId = hhOld.id;

    // Create household at new address
    const { status: s2, json: hhNew } = await post("/households", {
      patientId: P_ID,
      logradouro: "Rua Nova", numero: "200", bairro: "Bairro Novo", cep: "06060000",
      tipoImovel: "DOMICILIO", tipoDomicilio: "APARTAMENTO",
    }, acsToken);
    assert.equal(s2, 201, `New household: ${JSON.stringify(hhNew)}`);
    assert.notEqual(hhNew.id, oldHhId, "Should be a different household (different address)");

    // Patient now linked to new household
    await withDb((db) => {
      const p = db.patients.find((x) => x.id === P_ID);
      assert.equal(p.householdId, hhNew.id, "householdId should point to new household");

      // Old household must still exist (history preserved)
      const oldHh = db.households.find((h) => h.id === oldHhId);
      assert.ok(oldHh, "Old household must be preserved (not deleted)");

      // Audit trail: household.created x2
      const audits = (db.auditLogs || []).filter(
        (l) => l.action === "household.created" && l.details?.patientId === P_ID
      );
      assert.ok(audits.length >= 2, `Expected 2 household.created audits, got ${audits.length}`);
    });
  });

  // --- Cenário 4: Histórico preservado (audit chain) ----------------------------
  it("Cenário 4: trilha de auditoria preservada após mudança de domicílio e grupo familiar", async () => {
    const P_ID = "dr-audit-patient";

    await withDb((db) => {
      ensureDbShape(db);
      if (!db.patients.some((p) => p.id === P_ID)) {
        db.patients.push({
          id: P_ID, teamId: "team-dr", assignedAcsId: "dr-acs-user",
          name: "Paciente Auditoria DR", cpf: "77788899900", phone: "(11)44444-0000",
          logradouro: "Av Auditoria", numero: "99", bairro: "Auditoria", cep: "07070000",
          inactive: false, incompleteProfile: false, careCategory: "general",
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
      }
    });

    const { json: hh1 } = await post("/households", {
      patientId: P_ID,
      logradouro: "Av Auditoria", numero: "99", bairro: "Auditoria", cep: "07070000",
      tipoImovel: "DOMICILIO",
    }, acsToken);

    await patch(`/households/${hh1.id}`, { numMoradores: 3 }, acsToken);

    await withDb((db) => {
      const p = db.patients.find((x) => x.id === P_ID);
      const actor = { id: "dr-acs-user" };
      syncPatientFamilyGroup(db, p, actor, "test cenário 4");

      // Audit: household.created
      const created = (db.auditLogs || []).filter(
        (l) => l.action === "household.created" && l.details?.patientId === P_ID
      );
      assert.ok(created.length > 0, "household.created audit missing");

      // Audit: household.updated
      const updated = (db.auditLogs || []).filter(
        (l) => l.action === "household.updated" && l.entityId === hh1.id
      );
      assert.ok(updated.length > 0, "household.updated audit missing");
      const latestUpdate = updated[updated.length - 1];
      assert.ok(latestUpdate.before !== undefined, "before snapshot missing");
      assert.ok(latestUpdate.after !== undefined, "after snapshot missing");

      // Audit: familyGroup.created
      const fgCreated = (db.auditLogs || []).filter(
        (l) => l.action === "familyGroup.created" && l.details?.patientId === P_ID
      );
      assert.ok(fgCreated.length > 0, "familyGroup.created audit missing");

      // Family group linked to household
      const groups = db.familyGroups.filter(
        (g) => g.teamId === "team-dr" && g.householdId === hh1.id
      );
      assert.ok(groups.length > 0, "Family group not linked to household");
      assert.ok(groups[0].memberPatientIds.includes(P_ID), "Patient not in family group");
    });
  });
});
