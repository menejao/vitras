// C04A: LEDI APS 7.4.0 — VITRAS enum string → LEDI Long integer codes
// Source: integracao.esusaps.bridge.ufsc.tech/v740/pdf.html
// All values typed as BigInt (I64 in TBinaryProtocol).

// racaCorCidadao (required, i64)
export const RACA_COR_MAP = {
  BRANCA: 1n,
  PRETA: 2n,
  PARDA: 3n,
  AMARELA: 4n,
  INDIGENA: 5n,
};

// sexoCidadao (required, i64) — LEDI is binary; VITRAS stores "M"/"F"
export const SEXO_MAP = {
  M: 0n, m: 0n, MASCULINO: 0n, masculino: 0n,
  F: 1n, f: 1n, FEMININO: 1n,  feminino: 1n,
};

// nacionalidadeCidadao (required, i64)
export const NACIONALIDADE_MAP = {
  BRASILEIRA: 1n, brasileiro: 1n,
  NATURALIZADO: 2n,
  ESTRANGEIRO: 3n,
};
export const NACIONALIDADE_DEFAULT = 1n; // Brasileira

// grauInstrucaoCidadao (optional, i64)
export const ESCOLARIDADE_MAP = {
  SEM_ESCOLARIDADE: 0n,
  FUNDAMENTAL_INCOMPLETO: 5n,  // 5a-8a série incompleto
  FUNDAMENTAL_COMPLETO: 6n,
  MEDIO_INCOMPLETO: 7n,
  MEDIO_COMPLETO: 8n,
  SUPERIOR_INCOMPLETO: 9n,
  SUPERIOR_COMPLETO: 10n,
  ESPECIALIZACAO: 11n,
  MESTRADO: 12n,
  DOUTORADO: 13n,
  // NAO_INFORMADO → omit field (null)
};

// deficienciasCidadao (optional, List<i64>)
export const DEFICIENCIA_MAP = {
  AUDITIVA: 1n,
  VISUAL: 2n,
  INTELECTUAL_COGNITIVA: 3n,
  FISICA: 4n,
  MULTIPLA: 5n,
  // NAO_INFORMADO → omit
};

// identidadeGeneroCidadao (optional, i64) — LEDI values per e-SUS CDS
// Only present when statusDesejaInformarIdentidadeGenero = true
export const IDENTIDADE_GENERO_MAP = {
  HOMEM_TRANS: 1n,
  MULHER_TRANS: 2n,
  TRAVESTI: 3n,
  NAO_BINARIO: 4n,
  NAO_DEFINIDO: null, // omit
};

// tipoDeImovel (required in CadastroDomiciliar, i64)
export const TIPO_IMOVEL_MAP = {
  DOMICILIO: 1n,
  COMERCIO: 2n,
  TERRENO_BALDIO: 3n,
  PONTO_ESTRATEGICO: 4n,
  ESCOLA: 5n,
  CRECHE: 6n,
  ABRIGO: 7n,
  INST_LONGA_PERMANENCIA: 8n,
  UNIDADE_PRISIONAL: 9n,
  DELEGACIA: 11n,
  OUTRO: 99n,
};

// localizacao (CondicaoMoradia, required, i64)
export const LOCALIZACAO_MAP = {
  URBANA: 1n,
  RURAL: 2n,
};

// abastecimentoAgua (CondicaoMoradia, optional, i64)
export const ABASTECIMENTO_AGUA_MAP = {
  REDE_ENCANADA: 1n,
  POCO_ARTESIANO: 2n,
  CISTERNAS: 3n,
  CARRO_PIPA: 4n,
  OUTROS: 5n,
};

// aguaConsumoDomicilio = tratamentoAgua (CondicaoMoradia, optional, i64)
export const TRATAMENTO_AGUA_MAP = {
  SEM_TRATAMENTO: 1n,
  FILTRACAO: 2n,
  FERVURA: 3n,
  CLORACAO: 4n,
  MINERAL: 5n,
  OUTRO: 6n,
};

// formaEscoamentoBanheiro = esgotamento (CondicaoMoradia, optional, i64)
export const ESGOTAMENTO_MAP = {
  REDE_COLETORA: 1n,
  FOSSA_SEPTICA: 2n,
  FOSSA_RUDIMENTAR: 3n,
  VALA_CEU_ABERTO: 4n,
  DIRETO_CORPO_AGUA: 5n,
  OUTRO: 6n,
};

// destinoLixo (CondicaoMoradia, optional, i64)
export const DESTINO_LIXO_MAP = {
  COLETA_PUBLICA: 1n,
  QUEIMADO: 2n,
  ENTERRADO: 3n,
  TERRENO_BALDIO: 4n,
  CORPO_AGUA: 5n,
  OUTROS: 6n,
};

// materialPredominanteParedesExtDomicilio (CondicaoMoradia, optional, i64)
export const MATERIAL_PAREDES_MAP = {
  ALVENARIA_COM_REVESTIMENTO: 1n,
  ALVENARIA_SEM_REVESTIMENTO: 2n,
  TAIPA_COM_REVESTIMENTO: 3n,
  TAIPA_SEM_REVESTIMENTO: 4n,
  MADEIRA_APARELHADA: 5n,
  MATERIAL_APROVEITADO: 6n,
  OUTRO: 7n,
};

// situacaoMoradiaPosseTerra (CondicaoMoradia, required, i64)
export const SITUACAO_MORADIA_MAP = {
  PROPRIO: 1n,
  FINANCIADO: 2n,
  ALUGADO: 3n,
  ARRENDADO: 4n,
  CEDIDO: 5n,
  OCUPACAO: 6n,
  SITUACAO_RUA: 7n,
  OUTRO: 8n,
};

// tipoEndereco (CadastroDomiciliar, required LEDI 7.4.0, i32)
export const TIPO_ENDERECO_MAP = {
  LOGRADOURO: 1,
  SEM_ENDERECO: 2,
};

// motivoSaidaCidadao (SaidaCidadaoCadastro, optional, i64)
// 135 = Óbito; others mapped from patient.inactivationReason
export const MOTIVO_SAIDA_MAP = {
  OBITO: 135n,
  MUDANCA: 601n,
  EXCLUSAO: 602n,
};

/** Safe lookup — returns null if key missing or empty string. */
export function mapEnum(map, value) {
  if (!value) return null;
  return map[String(value).trim().toUpperCase()] ?? null;
}

/** Lookup list of enum values, filtering nulls. */
export function mapEnumList(map, values) {
  if (!Array.isArray(values)) return [];
  return values.map(v => mapEnum(map, v)).filter(v => v !== null);
}
