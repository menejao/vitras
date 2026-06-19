import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, patch, get } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

describe("Cadastro Domiciliar — APS-01J-D", () => {
  before(startTestServer);
  after(stopTestServer);

  let acsToken = null;
  let managerToken = null;
  const PATIENT_ID = "cd-test-patient-01";
  let householdId = null;

  before(async () => {
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

      if (!db.users.some((u) => u.id === "cd-acs-user")) {
        db.users.push({
          id: "cd-acs-user",
          name: "ACS Teste CD",
          role: "acs",
          email: "acs.cd@vitras.test",
          password: hashPassword("Test@CD2026!"),
          teamId: "team-ana",
          unitId: "unit-default",
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (!db.patients.some((p) => p.id === PATIENT_ID)) {
        db.patients.push({
          id: PATIENT_ID,
          teamId: "team-ana",
          assignedAcsId: "cd-acs-user",
          name: "Paciente CD Teste",
          cpf: "22233344455",
          phone: "(11)99999-2222",
          inactive: false,
          incompleteProfile: false,
          careCategory: "general",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const acsLogin = await post("/auth/login", { email: "acs.cd@vitras.test", password: "Test@CD2026!" });
    acsToken = acsLogin.json?.token || acsLogin.json?.accessToken || null;

    const mgrLogin = await post("/auth/login", { email: "ana@clinica.local", password: "123456" });
    managerToken = mgrLogin.json?.token || mgrLogin.json?.accessToken || null;
  });

  it("ACS pode criar domicílio (POST /households)", async () => {
    const { status, json } = await post("/households", {
      patientId: PATIENT_ID,
      tipoImovel: "DOMICILIO",
      tipoDomicilio: "CASA",
      localizacao: "URBANA",
      familyCode: "FAM-001",
      numMoradores: 4,
      numComodos: 6,
      abastecimentoAgua: "REDE_ENCANADA",
      tratamentoAgua: "FILTRACAO",
      esgotamento: "REDE_COLETORA",
      destinacaoLixo: "COLETA_PUBLICA",
      energiaEletrica: true,
      homeVisitFreq: "MENSAL",
      situacaoMoradiaPosseTerra: "PROPRIO",
      tipoEndereco: "LOGRADOURO",
      foraArea: false,
      animaisNoDomicilio: true,
      tiposAnimais: ["cachorro", "gato"],
      quantidadeAnimais: 3,
    }, acsToken);

    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);
    assert.ok(json.id, "id missing");
    assert.equal(json.tipoImovel, "DOMICILIO");
    assert.equal(json.tipoDomicilio, "CASA");
    assert.equal(json.localizacao, "URBANA");
    assert.equal(json.familyCode, "FAM-001");
    assert.equal(json.numMoradores, 4);
    assert.equal(json.numComodos, 6);
    assert.equal(json.abastecimentoAgua, "REDE_ENCANADA");
    assert.equal(json.tratamentoAgua, "FILTRACAO");
    assert.equal(json.esgotamento, "REDE_COLETORA");
    assert.equal(json.destinacaoLixo, "COLETA_PUBLICA");
    assert.equal(json.energiaEletrica, true);
    assert.equal(json.animaisNoDomicilio, true);
    assert.deepEqual(json.tiposAnimais, ["cachorro", "gato"]);
    assert.equal(json.quantidadeAnimais, 3);

    householdId = json.id;
  });

  it("GET /households?patientId= lista domicílios do paciente", async () => {
    const { status, json } = await get(`/households?patientId=${PATIENT_ID}`, acsToken);
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
    assert.ok(Array.isArray(json), "response should be array");
    assert.ok(json.length > 0, "should have at least one household");
    assert.ok(json.some(h => h.id === householdId), "created household not found in list");
  });

  it("ACS pode editar domicílio (PATCH /households/:id)", async () => {
    const { status, json } = await patch(`/households/${householdId}`, {
      numMoradores: 5,
      destinacaoLixo: "QUEIMADO",
      foraArea: true,
    }, acsToken);

    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
    assert.equal(json.numMoradores, 5);
    assert.equal(json.destinacaoLixo, "QUEIMADO");
    assert.equal(json.foraArea, true);
  });

  it("Gestor pode editar domicílio", async () => {
    const { status, json } = await patch(`/households/${householdId}`, {
      situacaoMoradiaPosseTerra: "ALUGADO",
      homeVisitFreq: "QUINZENAL",
    }, managerToken);

    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
    assert.equal(json.situacaoMoradiaPosseTerra, "ALUGADO");
    assert.equal(json.homeVisitFreq, "QUINZENAL");
  });

  it("Persistência: campos salvos aparecem no GET", async () => {
    await patch(`/households/${householdId}`, { familyCode: "PERSIST-OK" }, acsToken);

    await withDb((db) => {
      const hh = db.households.find(h => h.id === householdId);
      assert.ok(hh, "household not found in DB");
      assert.equal(hh.familyCode, "PERSIST-OK");
    });
  });

  it("Auditoria: household.created e household.updated gerados", async () => {
    await withDb((db) => {
      const created = (db.auditLogs || []).filter(
        l => l.action === "household.created" && l.details?.patientId === PATIENT_ID
      );
      assert.ok(created.length > 0, "household.created audit missing");

      const updated = (db.auditLogs || []).filter(
        l => l.action === "household.updated" && l.entityId === householdId
      );
      assert.ok(updated.length > 0, "household.updated audit missing");

      const latest = updated[updated.length - 1];
      assert.ok(latest.before !== undefined, "before snapshot missing");
      assert.ok(latest.after  !== undefined, "after snapshot missing");
    });
  });

  it("Rejeita enum inválido em tipoImovel", async () => {
    const { status } = await post("/households", {
      patientId: PATIENT_ID,
      tipoImovel: "TIPO_INVALIDO",
    }, acsToken);
    assert.equal(status, 400);
  });

  it("Rejeita sem autenticação", async () => {
    const { status } = await post("/households", { patientId: PATIENT_ID }, null);
    assert.ok([401, 403].includes(status));
  });

  it("Retorna 400 sem patientId no POST", async () => {
    const { status } = await post("/households", { tipoImovel: "DOMICILIO" }, acsToken);
    assert.equal(status, 400);
  });

  it("Retorna 404 para paciente inexistente no GET", async () => {
    const { status } = await get("/households?patientId=nao-existe", acsToken);
    assert.equal(status, 404);
  });
});
