/**
 * ubsService.js — UBS de referência do cidadão
 * Preparado para integrar com GET /portal/ubs (future API).
 */

const MOCK_UBS = {
  nome:       "UBS Dr. José Carlos — Centro",
  cnes:       "2394812",
  endereco:   "Rua das Flores, 123",
  bairro:     "Centro",
  municipio:  "Recife",
  uf:         "PE",
  cep:        "50000-000",
  telefone:   "(81) 3000-1234",
  horario:    "Seg–Sex: 07h–17h",
  equipe:     "ESF Girassol",
  acs:        "Claudinha Santos",
  lat:        -8.0476,
  lng:        -34.8770,
};

export async function getMinhaUbs() {
  await delay(500);
  return MOCK_UBS;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
