// AI-COPILOT-TOOLS-AND-PLANNER-01 — tests for tools layer, planner, and chatAnswer
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chatAnswer } from "../src/ai.js";
import { planAndExecute } from "../src/ai-planner.js";
import {
  toolCountPatients,
  toolCountByCategory,
  toolCountHypertensive,
  toolCountDiabetic,
  toolCountFamilies,
  toolCountVisits,
  toolCountVisitsTotal,
  toolGetPatientsWithoutVisit,
  toolGetIncompletePatients,
  toolCountOpenTasks,
  toolGetExportHistory,
  toolGetLastExport,
} from "../src/ai-tools.js";

// ── fixtures ───────────────────────────────────────────────────────────────────

const PATIENTS = [
  { id: "p1", name: "Joana Silva",    careCategory: "general",  inactive: false, phone: "99999", address: "Rua A", cpf: "123", assignedAcsId: "acs1" },
  { id: "p2", name: "Maria Gesta",    careCategory: "pregnant", inactive: false, phone: "99998", address: "Rua B", cns: "123456789012345", assignedAcsId: "acs1" },
  { id: "p3", name: "Benedita Velha", careCategory: "elderly",  inactive: false, phone: "99997", address: "Rua C", cns: "234567890123456", assignedAcsId: "acs1" },
  { id: "p4", name: "Carlos H",       careCategory: "chronic",  inactive: false, comorbidities: "Hipertensão arterial sistêmica", phone: "99996", address: "Rua D", assignedAcsId: "acs1" },
  { id: "p5", name: "Dilma D",        careCategory: "general",  inactive: false, comorbidities: "Diabetes mellitus tipo 2", phone: "99995", address: "Rua E", assignedAcsId: "acs1" },
  { id: "p6", name: "Sem Telefone",   careCategory: "general",  inactive: false, phone: "",      address: "Rua F", assignedAcsId: "acs1" },
];

const FAMILIES = [{ id: "f1" }, { id: "f2" }, { id: "f3" }];

const now = new Date();
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const yesterday = new Date(Date.now() - 86400000);
const longAgo = new Date(Date.now() - 40 * 86400000);

const ACS_VISITS = [
  { id: "v1", patientId: "p1", dataVisita: yesterday.toISOString() },
  { id: "v2", patientId: "p2", dataVisita: now.toISOString() },
  { id: "v3", patientId: "p3", dataVisita: longAgo.toISOString() }, // >30 days ago
];

const TASKS = [
  { id: "t1", status: "open", dueDate: lastMonth.toISOString() }, // overdue
  { id: "t2", status: "open", dueDate: new Date(Date.now() + 86400000 * 10).toISOString() }, // future
  { id: "t3", status: "done" },
];

// Oldest first (same order as db.exportHistory.push()) — tools reverse to get newest first
const EXPORT_HISTORY = [
  { id: "e2", competencia: "05/2026", ts: "2026-05-28T10:00:00Z", patientsExported: 6, patientsSkipped: 0, status: "success", exportedBy: { name: "Dr. Silva" } },
  { id: "e1", competencia: "06/2026", ts: "2026-06-29T10:00:00Z", patientsExported: 5, patientsSkipped: 1, status: "partial",  exportedBy: { name: "Dr. Silva" } },
];

const DB = {
  patients: PATIENTS,
  familyGroups: FAMILIES,
  acsVisits: ACS_VISITS,
  tasks: TASKS,
  exportHistory: EXPORT_HISTORY,
};

const EMPTY_DB = { patients: [], familyGroups: [], acsVisits: [], tasks: [], exportHistory: [] };

// ── TOOLS LAYER — unit tests ──────────────────────────────────────────────────

describe("tools — toolCountPatients", () => {
  it("conta apenas pacientes ativos", () => {
    const db = { patients: [...PATIENTS, { id: "p9", name: "Inativo", inactive: true }] };
    const r = toolCountPatients(db);
    assert.equal(r.count, PATIENTS.length);
    assert.ok(r.source);
    assert.ok(r.criteria);
  });
});

describe("tools — toolCountByCategory", () => {
  it("conta gestantes corretamente", () => {
    const r = toolCountByCategory(DB, "pregnant");
    assert.equal(r.count, 1);
    assert.ok(r.items.some(i => i.name === "Maria Gesta"));
  });
  it("conta idosos corretamente", () => {
    const r = toolCountByCategory(DB, "elderly");
    assert.equal(r.count, 1);
    assert.ok(r.items[0].name === "Benedita Velha");
  });
  it("retorna 0 para categoria sem pacientes", () => {
    const r = toolCountByCategory(DB, "puerperal");
    assert.equal(r.count, 0);
    assert.deepEqual(r.items, []);
  });
});

describe("tools — toolCountHypertensive / toolCountDiabetic", () => {
  it("conta hipertensos por comorbidades", () => {
    const r = toolCountHypertensive(DB);
    assert.equal(r.count, 1);
    assert.ok(r.items[0].name === "Carlos H");
    assert.ok(r.limitations); // must inform limitation
  });
  it("conta diabéticos por comorbidades", () => {
    const r = toolCountDiabetic(DB);
    assert.equal(r.count, 1);
    assert.ok(r.items[0].name === "Dilma D");
  });
});

describe("tools — toolCountFamilies", () => {
  it("conta grupos familiares", () => {
    const r = toolCountFamilies(DB);
    assert.equal(r.count, 3);
  });
});

describe("tools — toolCountVisits", () => {
  it("conta visitas do mês atual", () => {
    const r = toolCountVisits(DB);
    assert.ok(r.count >= 0);
    assert.ok(r.total === ACS_VISITS.length);
    assert.ok(r.period);
  });
  it("conta visitas de mês específico", () => {
    const r = toolCountVisits(DB, { month: "2026-06" });
    assert.ok(typeof r.count === "number");
  });
});

describe("tools — toolGetPatientsWithoutVisit", () => {
  it("identifica pacientes sem visita há mais de 30 dias", () => {
    const r = toolGetPatientsWithoutVisit(DB, 30);
    // p3 last visited longAgo (40 days), p4 p5 p6 never
    assert.ok(r.count >= 3);
    assert.ok(r.items.some(i => i.name === "Benedita Velha" || i.lastVisit === "nunca"));
    assert.equal(r.days, 30);
  });
});

describe("tools — toolGetIncompletePatients", () => {
  it("detecta cadastro sem telefone", () => {
    const r = toolGetIncompletePatients(DB);
    assert.ok(r.count >= 1);
    const semTel = r.items.find(i => i.name === "Sem Telefone");
    assert.ok(semTel);
    assert.ok(semTel.missing.includes("telefone"));
  });
});

describe("tools — toolCountOpenTasks", () => {
  it("conta tarefas abertas e vencidas", () => {
    const r = toolCountOpenTasks(DB);
    assert.equal(r.count, 2); // t1 + t2
    assert.equal(r.overdueCount, 1); // t1 overdue
  });
});

describe("tools — toolGetExportHistory / toolGetLastExport", () => {
  it("retorna histórico de exportações", () => {
    const r = toolGetExportHistory(DB, 5);
    assert.equal(r.count, 2);
    assert.equal(r.recent.length, 2);
    assert.ok(r.recent[0].competencia);
  });
  it("retorna última exportação", () => {
    const r = toolGetLastExport(DB);
    assert.equal(r.count, 2);
    assert.equal(r.last.competencia, "06/2026");
    assert.equal(r.last.status, "partial");
  });
  it("retorna null quando sem histórico", () => {
    const r = toolGetLastExport(EMPTY_DB);
    assert.equal(r.count, 0);
    assert.equal(r.last, null);
  });
});

// ── PLANNER — single-intent queries ──────────────────────────────────────────

describe("planner — OPERATIONAL_DATA_QUERY simples", () => {
  it("gestante com palavra 'grávidas'", () => {
    const r = planAndExecute("Quantas grávidas eu tenho cadastradas?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /1 gestante/);
    assert.ok(r.references.includes("Maria Gesta"));
    assert.ok(r.toolsUsed.includes("count_pregnant"));
  });

  it("gestante com palavra 'gestante'", () => {
    const r = planAndExecute("Quantas gestantes tenho?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /1 gestante/);
  });

  it("zero gestantes", () => {
    const r = planAndExecute("Quantas grávidas?", EMPTY_DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /Não há gestantes/);
  });

  it("idosos", () => {
    const r = planAndExecute("Quantos idosos tenho cadastrados?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /1 paciente/);
    assert.ok(r.references.includes("Benedita Velha"));
  });

  it("hipertensos", () => {
    const r = planAndExecute("Quantos hipertensos existem?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /1 paciente/);
  });

  it("diabéticos", () => {
    const r = planAndExecute("Quantos diabéticos?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /1 paciente/);
  });

  it("famílias", () => {
    const r = planAndExecute("Quantas famílias tenho cadastradas?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /3/);
  });

  it("visitas ACS total", () => {
    const r = planAndExecute("Total de visitas ACS registradas?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /3/);
  });

  it("tarefas pendentes", () => {
    const r = planAndExecute("Quantas tarefas estão pendentes?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /2/);
  });

  it("histórico exportações", () => {
    const r = planAndExecute("Quantas exportações e-SUS foram realizadas?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /2/);
  });

  it("última exportação", () => {
    const r = planAndExecute("Qual foi a última exportação e-SUS?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /06\/2026/);
  });

  it("pacientes sem visita há 30 dias", () => {
    const r = planAndExecute("Quais pacientes estão sem visita há mais de 30 dias?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.ok(r.count >= 0 || r.answer.includes("paciente"));
  });

  it("cadastros incompletos", () => {
    const r = planAndExecute("Quais pacientes possuem cadastro incompleto?", DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.ok(r.references.includes("Sem Telefone") || r.answer.includes("Sem Telefone"));
  });
});

// ── PLANNER — composite multi-intent queries ──────────────────────────────────

describe("planner — COMPOSITE_OPERATIONAL (multi-intent)", () => {
  it("gestantes + hipertensos na mesma pergunta", () => {
    const r = planAndExecute("Quantas gestantes e quantos hipertensos existem?", DB);
    assert.equal(r.intent, "COMPOSITE_OPERATIONAL");
    assert.ok(r.plan.includes("count_pregnant"));
    assert.ok(r.plan.includes("count_hypertensive"));
    assert.ok(r.toolsUsed.length >= 2);
    assert.match(r.answer, /gestante/);
    assert.match(r.answer, /hiperten/);
  });

  it("resposta composta inclui Fonte e Critério", () => {
    const r = planAndExecute("Quantas gestantes e quantos diabéticos?", DB);
    assert.match(r.answer, /Fonte/);
    assert.match(r.answer, /Critério/);
  });
});

// ── PLANNER — explainability (FASE 6) ────────────────────────────────────────

describe("planner — respostas explicáveis", () => {
  it("resposta de gestantes inclui critério e fonte", () => {
    const r = planAndExecute("Quantas gestantes?", DB);
    assert.match(r.answer, /Fonte/);
    assert.match(r.answer, /Critério/);
    assert.ok(Array.isArray(r.sources));
    assert.ok(r.sources.includes("patients"));
  });

  it("resposta de hipertensos inclui nota de limitação", () => {
    const r = planAndExecute("Quantos hipertensos?", DB);
    assert.match(r.answer, /Nota/);
  });

  it("resposta de tarefas inclui período", () => {
    const r = planAndExecute("Quantas tarefas pendentes?", DB);
    assert.match(r.answer, /Período/);
  });
});

// ── PLANNER — SYSTEM_HELP_QUERY ───────────────────────────────────────────────

describe("planner — SYSTEM_HELP_QUERY (FASE 5)", () => {
  it("como exportar e-SUS", () => {
    const r = planAndExecute("Como exportar o e-SUS APS?", DB);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
    assert.match(r.answer, /Relatórios/);
    assert.match(r.answer, /Transmissão/);
  });

  it("como cadastrar paciente", () => {
    const r = planAndExecute("Como cadastrar um novo paciente?", DB);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
    assert.match(r.answer, /Novo Paciente/);
  });

  it("como registrar visita ACS", () => {
    const r = planAndExecute("Como registrar uma visita domiciliar ACS?", DB);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
    assert.match(r.answer, /visita/i);
  });

  it("como gerenciar usuários e permissões", () => {
    const r = planAndExecute("Como gerenciar usuários e permissões?", DB);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
    assert.match(r.answer, /Gestor|perfil/i);
  });

  it("como funciona a IA", () => {
    const r = planAndExecute("Como usar a análise por IA?", DB);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
  });

  it("fallback de ajuda lista tópicos", () => {
    const r = planAndExecute("Como fazer algo completamente desconhecido?", DB);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
    assert.match(r.answer, /Tópicos disponíveis/);
  });
});

// ── PLANNER — OUT_OF_SCOPE ────────────────────────────────────────────────────

describe("planner — OUT_OF_SCOPE (FASE 7 — segurança clínica)", () => {
  it("recusa pergunta sobre antibiótico", () => {
    const r = planAndExecute("Qual antibiótico usar para infecção urinária?", DB);
    assert.equal(r.intent, "OUT_OF_SCOPE");
    assert.match(r.answer, /Não posso indicar/);
  });

  it("recusa pergunta sobre posologia", () => {
    const r = planAndExecute("Qual posologia da amoxicilina?", DB);
    assert.equal(r.intent, "OUT_OF_SCOPE");
  });

  it("recusa esquema de tratamento", () => {
    const r = planAndExecute("Qual esquema de tratamento para tuberculose?", DB);
    assert.equal(r.intent, "OUT_OF_SCOPE");
  });
});

// ── PLANNER — UNKNOWN fallback ────────────────────────────────────────────────

describe("planner — UNKNOWN fallback seguro", () => {
  it("pergunta desconhecida não retorna 'Sugestão de foco do dia'", () => {
    const r = planAndExecute("Qual o sentido da vida?", DB);
    assert.equal(r.intent, "UNKNOWN");
    assert.ok(!r.answer.includes("Sugestão de foco do dia"));
    assert.match(r.answer, /Não encontrei/);
  });

  it("pergunta vazia retorna EMPTY", () => {
    const r = planAndExecute("", DB);
    assert.equal(r.intent, "EMPTY");
  });
});

// ── chatAnswer — regressão dos handlers de análise clínica/gerencial ──────────

describe("chatAnswer — análise gerencial via contexts", () => {
  function makeCtx(overrides = {}) {
    return {
      patient: { id: "px", name: "Paciente X", careCategory: "general", microArea: "01", assignedAcsId: "a1", phone: "9", address: "R1", ...overrides.patient },
      protocolSummary: { categoryLabel: "Geral", pending: { visits: 0, consultations: 0, vaccines: 0 }, completed: {}, targets: {}, ...overrides.protocolSummary },
      history: [],
      tasks: [],
      appointments: [],
    };
  }

  const highRiskCtx = makeCtx({
    patient: { id: "hr1", name: "Alto Risco Paciente" },
    protocolSummary: { pending: { visits: 5, consultations: 3, vaccines: 2 }, completed: {}, targets: {}, categoryLabel: "Gestante" },
  });

  it("identifica pacientes em alto risco", () => {
    const ctx = makeCtx({ patient: { id: "a1", name: "Ana Risco" }, protocolSummary: { pending: { visits: 10, consultations: 5, vaccines: 3 }, completed: {}, targets: {}, categoryLabel: "Geral" } });
    const r = chatAnswer("Quais pacientes estão em alto risco?", [ctx], DB);
    assert.equal(r.intent, "CLINICAL_OR_MANAGERIAL_ANALYSIS");
  });

  it("roteamento operacional via chatAnswer → planner (gestante)", () => {
    const r = chatAnswer("Quantas grávidas tenho?", [], DB);
    assert.equal(r.intent, "OPERATIONAL_DATA_QUERY");
    assert.match(r.answer, /1 gestante/);
  });

  it("roteamento de ajuda via chatAnswer → planner", () => {
    const r = chatAnswer("Como exportar o e-SUS APS?", [], DB);
    assert.equal(r.intent, "SYSTEM_HELP_QUERY");
  });

  it("out-of-scope via chatAnswer → planner", () => {
    const r = chatAnswer("Qual antibiótico usar?", [], DB);
    assert.equal(r.intent, "OUT_OF_SCOPE");
  });
});
