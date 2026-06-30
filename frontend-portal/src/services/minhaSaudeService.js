/**
 * minhaSaudeService.js — Dados de saúde resumidos do cidadão
 * Não expõe prontuário completo. Apenas resumos liberados pelo Clínico.
 * Preparado para integrar com GET /portal/minha-saude.
 */

const MOCK_SAUDE = {
  vacinas: [
    { nome: "Influenza 2026",      data: null,       status: "pendente" },
    { nome: "COVID-19 — dose 4",   data: "2025-10-12", status: "aplicada" },
    { nome: "dT (dupla adulto)",   data: "2023-03-01", status: "aplicada" },
  ],
  receitas: [
    { medicamento: "Losartana 50mg",   posologia: "1×/dia",   validade: "2026-08-01" },
    { medicamento: "Metformina 850mg", posologia: "2×/dia",   validade: "2026-08-01" },
  ],
  medicamentos: [
    { nome: "Losartana 50mg",   retirada: "Disponível na UBS" },
    { nome: "Metformina 850mg", retirada: "Disponível na UBS" },
  ],
  exames: [
    { tipo: "Hemograma completo", solicitado: "2026-06-10", resultado: "Disponível" },
  ],
  alergias: [
    "Dipirona",
  ],
};

export async function getMinhaSaude() {
  await delay(600);
  return MOCK_SAUDE;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
