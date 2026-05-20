import assert from "node:assert/strict";
import { patientSummary, protocolHighlights, teamReport, chatAnswer } from "./ai.js";

function makeContext(overrides = {}) {
  return {
    patient: {
      id: "p1",
      name: "Paciente Teste",
      careCategory: "pregnant",
      microArea: "01",
      comorbidities: "hipertensão",
      medications: "ácido fólico",
      allergies: "nenhuma"
    },
    protocolSummary: {
      categoryLabel: "Gestante",
      completed: { visits: 1, consultations: 2, vaccines: 0 },
      targets: { visits: 3, consultations: 7, vaccines: 4 },
      pending: { visits: 2, consultations: 5, vaccines: 4 }
    },
    tasks: [],
    history: [
      { type: "consultation", title: "Consulta enfermagem", date: new Date().toISOString(), details: "" }
    ],
    ...overrides
  };
}

function run(name, fn) {
  try {
    fn();
    console.log(`OK: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

run("patientSummary gera headline e recomendações", () => {
  const summary = patientSummary(makeContext());
  assert.match(summary.headline, /Paciente Teste/);
  assert.ok(Array.isArray(summary.recomendacoes));
});

run("protocolHighlights informa pendências", () => {
  const highlights = protocolHighlights(makeContext());
  assert.match(highlights.destaque, /Falta concluir/i);
});

run("teamReport agrega totais", () => {
  const report = teamReport([makeContext(), makeContext({ patient: { ...makeContext().patient, id: "p2", name: "Outro" } })]);
  assert.equal(report.totals.patients, 2);
});

run("chatAnswer retorna resposta para pendências", () => {
  const response = chatAnswer("quem está com protocolo atrasado?", [makeContext()]);
  assert.match(String(response.answer || ""), /Pend[eê]ncias encontradas|N[aã]o h[aá] pend[eê]ncias/i);
});
