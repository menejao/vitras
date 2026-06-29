// AI-QUERY-ROUTER-AND-SYSTEM-HELP-01 — unit tests for chatAnswer intent routing
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chatAnswer } from "../src/ai.js";

// ── minimal test fixtures ──────────────────────────────────────────────────────

function makeContext(overrides = {}) {
  return {
    patient: {
      id: "p1",
      name: "Joana Silva",
      careCategory: "general",
      comorbidities: "",
      medications: "",
      allergies: "",
      microArea: "01",
      assignedAcsId: "acs1",
      phone: "999999999",
      address: "Rua A, 1",
      cpf: null,
      cns: null,
      ...overrides.patient,
    },
    protocolSummary: {
      categoryLabel: "Geral",
      pending: { visits: 0, consultations: 0, vaccines: 0 },
      completed: { visits: 1, consultations: 1, vaccines: 1 },
      targets: { visits: 2, consultations: 2, vaccines: 2 },
      ...overrides.protocolSummary,
    },
    history: overrides.history || [],
    tasks: overrides.tasks || [],
    appointments: overrides.appointments || [],
  };
}

const gestante = makeContext({ patient: { id: "p2", name: "Maria Gesta", careCategory: "pregnant" } });
const geral = makeContext({ patient: { id: "p1", name: "Joana Silva", careCategory: "general" } });
const idosa = makeContext({ patient: { id: "p3", name: "Benedita Velha", careCategory: "elderly" } });
const hiperten = makeContext({ patient: { id: "p4", name: "Carlos Hiperten", careCategory: "chronic", comorbidities: "Hipertensão arterial" } });

const emptyDb = { familyGroups: [], acsVisits: [], patients: [] };
const db = {
  familyGroups: [{ id: "f1" }, { id: "f2" }],
  acsVisits: [{ id: "v1" }, { id: "v2" }, { id: "v3" }],
  patients: [],
};

// ── OPERATIONAL_DATA_QUERY — gestante/grávida ──────────────────────────────────

describe("chatAnswer — gestante/grávida intent", () => {
  it("responde quantas gestantes com palavra 'grávidas'", () => {
    const r = chatAnswer("Quantas grávidas eu tenho cadastradas?", [gestante, geral], db);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /1 gestante/);
    assert.ok(r.references.includes("Maria Gesta"));
  });

  it("responde quantas gestantes com palavra 'gestante'", () => {
    const r = chatAnswer("Quantas gestantes tenho?", [gestante, geral], db);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /1 gestante/);
  });

  it("zero gestantes retorna mensagem correta", () => {
    const r = chatAnswer("Quantas grávidas?", [geral], db);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /Não há gestantes/);
    assert.deepEqual(r.references, []);
  });
});

// ── OPERATIONAL_DATA_QUERY — outras categorias ────────────────────────────────

describe("chatAnswer — outras categorias operacionais", () => {
  it("conta idosos", () => {
    const r = chatAnswer("Quantos idosos tenho cadastrados?", [idosa, geral], db);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /1 paciente/);
  });

  it("conta hipertensos", () => {
    const r = chatAnswer("Quantos hipertensos tenho?", [hiperten, geral], db);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /1 paciente/);
  });

  it("retorna total de famílias do db", () => {
    const r = chatAnswer("Quantas famílias tenho cadastradas?", [geral], db);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /2/);
  });

  it("retorna total de visitas ACS do db", () => {
    const r = chatAnswer("Total de visitas ACS registradas?", [geral], db);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /3/);
  });
});

// ── SYSTEM_HELP_QUERY ─────────────────────────────────────────────────────────

describe("chatAnswer — ajuda com sistema", () => {
  it("responde como exportar e-SUS", () => {
    const r = chatAnswer("Como exportar o e-SUS APS?", [], db);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
    assert.match(r.answer, /Relatórios/);
    assert.match(r.answer, /Transmissão/);
  });

  it("responde como cadastrar paciente", () => {
    const r = chatAnswer("Como cadastrar um paciente?", [], db);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
    assert.match(r.answer, /Pacientes/);
    assert.match(r.answer, /Novo Paciente/);
  });

  it("responde como registrar visita ACS", () => {
    const r = chatAnswer("Como registrar uma visita domiciliar ACS?", [], db);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
    assert.match(r.answer, /visita/i);
  });

  it("fallback de ajuda lista tópicos disponíveis", () => {
    const r = chatAnswer("Como fazer algo desconhecido no sistema?", [], db);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
    assert.match(r.answer, /Tópicos disponíveis/);
  });
});

// ── OUT_OF_SCOPE ──────────────────────────────────────────────────────────────

describe("chatAnswer — fora de escopo clínico", () => {
  it("recusa pergunta sobre antibiótico", () => {
    const r = chatAnswer("Qual antibiótico usar para infecção urinária?", [geral], db);
    assert.equal(r.intent, "OUT_OF_SCOPE");
    assert.match(r.answer, /Não posso indicar/);
  });

  it("recusa pergunta sobre posologia", () => {
    const r = chatAnswer("Qual posologia para amoxicilina?", [geral], db);
    assert.equal(r.intent, "OUT_OF_SCOPE");
  });
});

// ── UNKNOWN fallback — nunca retorna "Sugestão de foco do dia" ────────────────

describe("chatAnswer — fallback seguro", () => {
  it("pergunta desconhecida retorna UNKNOWN, não foco do dia", () => {
    const r = chatAnswer("Qual o sentido da vida?", [geral], db);
    assert.equal(r.intent, "UNKNOWN");
    assert.ok(!r.answer.includes("Sugestão de foco do dia"), "fallback must not mention foco do dia");
  });

  it("pergunta vazia retorna EMPTY", () => {
    const r = chatAnswer("", [geral], db);
    assert.equal(r.intent, "EMPTY");
  });
});

// ── CLINICAL_OR_MANAGERIAL_ANALYSIS — regressão das análises existentes ────────

describe("chatAnswer — análises gerenciais existentes", () => {
  const pendContext = makeContext({
    patient: { id: "p5", name: "Ana Pend" },
    protocolSummary: { pending: { visits: 2, consultations: 1, vaccines: 0 }, completed: {}, targets: {}, categoryLabel: "Geral" },
  });

  it("lista pacientes com pendências", () => {
    const r = chatAnswer("Quais pacientes estão com protocolo atrasado?", [pendContext, geral], db);
    assert.match(r.answer, /Pendências/i);
    assert.ok(r.references.includes("Ana Pend"));
  });
});
