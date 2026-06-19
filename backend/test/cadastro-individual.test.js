import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, patch, get } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

describe("Cadastro Individual — APS-01J-C", () => {
  before(startTestServer);
  after(stopTestServer);

  let acsToken = null;
  let managerToken = null;
  let patientId = null;
  const CI_PATIENT_ID = "ci-test-patient-01";

  before(async () => {
    // Seed team, ACS user and test patient.
    // "team-ana" must be seeded FIRST so ensureDemoManagerIfNeeded picks it when ana logs in.
    await withDb((db) => {
      ensureDbShape(db);

      if (!db.teams.some((t) => t.id === "team-ana")) {
        db.teams.unshift({
          id: "team-ana",
          name: "Equipe Ana",
          managerUserId: "u1",
          unitId: "unit-default",
          createdAt: new Date().toISOString(),
        });
      }

      if (!db.users.some((u) => u.id === "ci-acs-user")) {
        db.users.push({
          id: "ci-acs-user",
          name: "ACS Teste CI",
          role: "acs",
          email: "acs.ci@vitras.test",
          password: hashPassword("Test@CI2026!"),
          teamId: "team-ana",
          unitId: "unit-default",
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (!db.patients.some((p) => p.id === CI_PATIENT_ID)) {
        db.patients.push({
          id: CI_PATIENT_ID,
          teamId: "team-ana",
          assignedAcsId: "ci-acs-user",
          name: "Paciente CI Teste",
          cpf: "11122233344",
          phone: "(11)99999-1111",
          inactive: false,
          incompleteProfile: true,
          careCategory: "general",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    // Login ACS
    const acsLogin = await post("/auth/login", {
      email: "acs.ci@vitras.test",
      password: "Test@CI2026!",
    });
    acsToken = acsLogin.json?.token || acsLogin.json?.accessToken || null;

    // Login manager — uses ensureDemoManagerIfNeeded which picks db.teams[0] = "team-ana"
    const mgrLogin = await post("/auth/login", {
      email: "ana@clinica.local",
      password: "123456",
    });
    managerToken = mgrLogin.json?.token || mgrLogin.json?.accessToken || null;

    patientId = CI_PATIENT_ID;
  });

  it("ACS pode atualizar campos do Cadastro Individual", async () => {
    const { status, json } = await patch(
      `/patients/${patientId}/cadastro-individual`,
      {
        nomeSocial: "Maria CI",
        escolaridade: "MEDIO_COMPLETO",
        situacaoMercadoTrabalho: "DESEMPREGADO",
        situacaoRua: false,
        deficiencia: ["VISUAL"],
        condicoesSaude: ["HIPERTENSAO"],
        triaAlimentosAcabaram: true,
        triaConsomiuApenasAlgunsDosAlimentos: false,
      },
      acsToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
    assert.equal(json.nomeSocial, "Maria CI");
    assert.equal(json.escolaridade, "MEDIO_COMPLETO");
    assert.equal(json.situacaoMercadoTrabalho, "DESEMPREGADO");
    assert.deepEqual(json.deficiencia, ["VISUAL"]);
    assert.deepEqual(json.condicoesSaude, ["HIPERTENSAO"]);
    assert.equal(json.triaAlimentosAcabaram, true);
    assert.equal(json.triaConsomiuApenasAlgunsDosAlimentos, false);
  });

  it("ACS pode atualizar relação com responsável familiar", async () => {
    const { status, json } = await patch(
      `/patients/${patientId}/cadastro-individual`,
      {
        responsavelFamiliar: "João da Silva",
        responsible: { relationship: "PAI" },
      },
      acsToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
    assert.equal(json.responsavelFamiliar, "João da Silva");
    assert.equal(json.responsible?.relationship, "PAI");
  });

  it("Gestor pode atualizar campos do Cadastro Individual", async () => {
    const { status, json } = await patch(
      `/patients/${patientId}/cadastro-individual`,
      {
        nacionalidade: "BRASILEIRA",
        racaCor: "PARDA",
        etnia: "",
      },
      managerToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
    assert.equal(json.nacionalidade, "BRASILEIRA");
    assert.equal(json.racaCor, "PARDA");
  });

  it("Persistência: dados salvos sobrevivem segunda leitura", async () => {
    const { status } = await patch(
      `/patients/${patientId}/cadastro-individual`,
      { nomeSocial: "Persistência OK", triaAlimentosAcabaram: true },
      acsToken
    );
    assert.equal(status, 200);

    // Verify via DB read (no GET /patients/:id route)
    await withDb((db) => {
      const p = db.patients.find((x) => x.id === patientId);
      assert.ok(p, "Paciente não encontrado no DB após PATCH");
      assert.equal(p.nomeSocial, "Persistência OK");
      assert.equal(p.triaAlimentosAcabaram, true);
    });
  });

  it("Auditoria: evento patient.cadastro_individual.updated gerado", async () => {
    await patch(
      `/patients/${patientId}/cadastro-individual`,
      { situacaoRua: true },
      acsToken
    );

    // Check audit log via DB directly
    await withDb((db) => {
      const allActions = (db.auditLogs || []).map((l) => l.action);
      const logs = (db.auditLogs || []).filter(
        (l) => l.action === "patient.cadastro_individual.updated" && l.entityId === patientId
      );
      assert.ok(logs.length > 0, `Audit log not found. Total logs: ${allActions.length}. Actions: ${allActions.slice(-5).join(", ")}`);
      const latest = logs[logs.length - 1];
      assert.ok(Array.isArray(latest.details?.changedFields), "changedFields missing from audit");
      assert.ok(latest.before !== undefined, "before snapshot missing");
      assert.ok(latest.after !== undefined, "after snapshot missing");
    });
  });

  it("Rejeita campos inválidos (strict schema)", async () => {
    const { status } = await patch(
      `/patients/${patientId}/cadastro-individual`,
      { teamId: "malicious-team-inject", escolaridade: "SUPERIOR_COMPLETO" },
      acsToken
    );
    assert.equal(status, 400, "Should reject unknown field teamId");
  });

  it("Rejeita enum inválido em escolaridade", async () => {
    const { status } = await patch(
      `/patients/${patientId}/cadastro-individual`,
      { escolaridade: "INVALIDO_NAO_EXISTE" },
      acsToken
    );
    assert.equal(status, 400);
  });

  it("Rejeita acesso sem autenticação", async () => {
    const { status } = await patch(
      `/patients/${patientId}/cadastro-individual`,
      { nomeSocial: "Sem token" },
      null
    );
    assert.ok([401, 403].includes(status), `Expected 401 or 403, got ${status}`);
  });

  it("Retorna 404 para paciente inexistente", async () => {
    const { status } = await patch(
      "/patients/paciente-que-nao-existe/cadastro-individual",
      { nomeSocial: "Ghost" },
      acsToken
    );
    assert.equal(status, 404);
  });
});
