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

// tipoEndereco (CadastroDomiciliar, field 20, i64)
export const TIPO_ENDERECO_MAP = {
  LOGRADOURO: 1n,
  SEM_ENDERECO: 2n,
};

// motivoSaidaCidadao (SaidaCidadaoCadastro, optional, i64)
// 135 = Óbito; others mapped from patient.inactivationReason
export const MOTIVO_SAIDA_MAP = {
  OBITO: 135n,
  MUDANCA: 601n,
  EXCLUSAO: 602n,
};

// ──────────────────────────────────────────────────────────────────────────────
// C04C-G3: tipoAtendimento (AtendimentoIndividualTransport, required, i64)
// Source: LEDI APS 7.4.0 — tabela tipoDeAtendimentoCds
// VITRAS record.type + queueEntry.demandType → LEDI Long
// ──────────────────────────────────────────────────────────────────────────────
export const TIPO_ATENDIMENTO_MAP = {
  // record.type → base type (may be refined by demandType)
  consultation_scheduled: 1n,    // consulta agendada
  consultation_spontaneous: 2n,  // consulta não agendada / demanda espontânea
  consultation_urgent: 3n,       // atendimento de urgência
  nursing_scheduled: 1n,
  nursing_spontaneous: 2n,
  nursing_urgent: 3n,
  procedure: 4n,                 // escuta inicial / orientação
  // visit type = Visita Domiciliar ACS — NOT exported as AtendimentoIndividual (CLAUDE.md)
  // note, evolution, prescription, referral, exam_request, vaccine, attendance_attest, medical_attest
  // = sem equivalente direto em AtendimentoIndividual; excluídos da exportação
};

// turno (AtendimentoIndividualTransport, required, i64)
export const TURNO_MAP = {
  MANHA: 1n,
  TARDE: 2n,
  NOITE: 3n,
};

// localDeAtendimento (AtendimentoIndividualTransport, required, i64)
export const LOCAL_ATENDIMENTO_MAP = {
  UBS: 1n,
  DOMICILIO: 4n,
  ESCOLA: 5n,
  OUTRO: 6n,
};

// turno default quando não informado (TARDE = horário comercial padrão)
export const TURNO_DEFAULT = 2n;

// localDeAtendimento default quando não informado
export const LOCAL_ATENDIMENTO_DEFAULT = 1n; // UBS

/**
 * Resolve tipoAtendimento LEDI Long from VITRAS record fields.
 * @param {string} recordType — record.type
 * @param {string|null} demandType — queueEntry.demandType ("scheduled"|"spontaneous") or null
 * @param {string|null} priority — queueEntry.priority ("urgent"|...) or null
 * @returns {BigInt} LEDI tipoAtendimento i64 value
 */
export function resolveTipoAtendimento(recordType, demandType, priority) {
  if (priority === "urgent") return 3n;
  if (recordType === "procedure") return 4n;

  const baseType = String(recordType || "").toLowerCase();
  const demand = String(demandType || "scheduled").toLowerCase();

  if (baseType === "consultation" || baseType === "nursing") {
    return demand === "spontaneous" ? 2n : 1n;
  }
  // Default: consulta agendada
  return 1n;
}

// ──────────────────────────────────────────────────────────────────────────────
// C04C-G4: CIAP-2 → LEDI string
// Source: laboratoriobridge/esusaps-integracao (official e-SUS APS integration repo)
//         thrift/layout-ras/thrift/ficha_atendimento_individual.thrift
//         ProblemaCondicaoAvaliacaoAIThrift.ciaps = optional list<string>
//         common.thrift ProblemaCondicaoThrift.ciap = optional string
// CIAP-2 codes are transmitted as text strings in LEDI APS — NOT as i64 integers.
// Format: 1 uppercase letter + 2 digits (e.g. "A01", "R05", "K86")
// ──────────────────────────────────────────────────────────────────────────────
const CIAP2_FORMAT = /^[A-Z]\d{2}$/;

/**
 * Normalize a CIAP-2 code for LEDI APS transport (string field).
 * Returns uppercase code if valid CIAP-2 format, null otherwise — never throws.
 * @param {string|null|undefined} code
 * @returns {string|null}
 */
export function mapCiap2ToLedi(code) {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase();
  return CIAP2_FORMAT.test(normalized) ? normalized : null;
}

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
