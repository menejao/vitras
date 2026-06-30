/**
 * notificacoesService.js — Avisos e notificações do cidadão
 * Preparado para integrar com GET /portal/notificacoes.
 */

const MOCK_NOTIFICACOES = [
  {
    id:    "n1",
    tipo:  "consulta",
    titulo: "Consulta confirmada",
    texto: "Sua consulta médica está confirmada para 08/07 às 09h30 na UBS Centro.",
    data:  "2026-07-01",
    lida:  false,
  },
  {
    id:    "n2",
    tipo:  "vacina",
    titulo: "Vacina pendente",
    texto: "Sua vacina de Influenza 2026 ainda não foi aplicada. Procure sua UBS.",
    data:  "2026-06-28",
    lida:  false,
  },
  {
    id:    "n3",
    tipo:  "campanha",
    titulo: "Campanha de Vacinação",
    texto: "Vacinação contra influenza disponível até 31/07. Não perca!",
    data:  "2026-06-25",
    lida:  true,
  },
  {
    id:    "n4",
    tipo:  "exame",
    titulo: "Resultado disponível",
    texto: "O resultado do seu hemograma está disponível. Retire na UBS ou pergunte ao médico.",
    data:  "2026-06-20",
    lida:  true,
  },
];

export async function getNotificacoes() {
  await delay(400);
  return MOCK_NOTIFICACOES;
}

export function countUnread(lista) {
  return lista.filter(n => !n.lida).length;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
