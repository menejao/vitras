/**
 * portalService.js — Dados do home do cidadão
 * Mocks prontos para substituição por chamadas reais à API.
 * UI nunca constrói dados — sempre vem daqui.
 */

const MOCK_HOME = {
  proximaConsulta: {
    tipo:       "Consulta Médica",
    profissional: "Dra. Ana Lima",
    data:       "2026-07-08",
    hora:       "09:30",
    local:      "UBS Centro",
  },
  vacinasPendentes: 1,
  receitasAtivas:   2,
  examesDisponiveis: 1,
  avisos: [
    {
      id: "av1",
      tipo: "campanha",
      titulo: "Campanha de Vacinação",
      texto: "Vacinação contra influenza disponível na sua UBS até 31/07.",
      data: "2026-06-28",
    },
  ],
};

export async function getHomeData() {
  await delay(400);
  return MOCK_HOME;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
