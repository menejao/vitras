/**
 * perfilService.js — Dados de perfil do cidadão
 * Preparado para integrar com GET /portal/perfil.
 * Não expõe dados sensíveis além dos básicos de identificação.
 */

const MOCK_PERFIL = {
  nome:       "Maria Silva",
  cpf:        "***.***.***-12",
  cns:        "*** **** **** 3456",
  dataNasc:   "1985-04-22",
  telefone:   "(81) 99999-0001",
  email:      "maria.silva@email.com",
  sexo:       "Feminino",
  municipio:  "Recife",
  uf:         "PE",
  dependentes: [],
  preferencias: {
    smsAtivo:       true,
    whatsappAtivo:  false,
    emailAtivo:     true,
  },
};

export async function getPerfil() {
  await delay(400);
  return MOCK_PERFIL;
}

export function getInitials(nome) {
  if (!nome) return "?";
  return nome.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
