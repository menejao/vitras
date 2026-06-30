/**
 * agendamentosService.js — Agendamentos do cidadão
 * Preparado para integrar com GET /portal/agendamentos.
 */

const MOCK_AGENDAMENTOS = [
  {
    id:          "ag1",
    tipo:        "Consulta Médica",
    profissional: "Dra. Ana Lima",
    data:        "2026-07-08",
    hora:        "09:30",
    local:       "UBS Centro — Sala 3",
    status:      "confirmado",
  },
  {
    id:          "ag2",
    tipo:        "Consulta de Enfermagem",
    profissional: "Enf. Marcos Souza",
    data:        "2026-07-15",
    hora:        "14:00",
    local:       "UBS Centro — Sala 1",
    status:      "agendado",
  },
];

export async function getAgendamentos() {
  await delay(500);
  return MOCK_AGENDAMENTOS;
}

const MESES_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
export function parseDateParts(isoDate) {
  const [, m, d] = isoDate.split("-");
  return { dia: d, mes: MESES_PT[parseInt(m, 10) - 1] };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
