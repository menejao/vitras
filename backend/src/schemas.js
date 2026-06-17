import { z } from "zod";

const shortString = (max) => z.string().trim().max(max);
const optionalShortString = (max) => shortString(max).optional();
const optionalDateString = () => z.string().trim().max(50).optional();
const optionalNumberLike = () => z.union([z.string(), z.number()]).nullable().optional();

// F2-02/F2-03: enum fields with empty/null → undefined (not stored) preprocessing
const optionalEnumField = (...values) => z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.enum(values).optional()
);

// F2-01: racaCor enum; also maps "nao_informado" → undefined (stored as NULL / empty)
const racaCorField = () => z.preprocess(
  (v) => (v === "" || v === null || v === undefined || v === "nao_informado" ? undefined : v),
  z.enum(["BRANCA", "PRETA", "PARDA", "AMARELA", "INDIGENA"]).optional()
);

// F2-06: CEP canonical — strip non-digits, validate exactly 8 digits (or absent)
const normalizedCepField = () => z.preprocess(
  (v) => {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v === "string") return v.trim().replace(/\D/g, "");
    return String(v);
  },
  z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos").optional()
);

const optionalCnesField = () => z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v === "string") {
      const trimmed = v.trim();
      return trimmed === "" ? undefined : trimmed;
    }
    return String(v);
  },
  z.union([
    z.string().regex(/^\d{7}$/, "cnes deve ter exatamente 7 dÃ­gitos"),
    z.null()
  ]).optional()
);

const LoginSchema = z.object({
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(1024)
});

const RegisterSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(1024),
  role: z.string().min(1).max(50),
  teamId: z.string().max(100).optional(),
  unitId: z.string().max(100).optional(),
  councilNumber: z.string().max(30).optional(),
  councilUf: z.string().max(2).optional(),
  // F4-01: CNS profissional — 15 dígitos numéricos, sem AES (identificador público)
  cnsProfissional: z.string().regex(/^\d{15}$/, "cnsProfissional deve ter exatamente 15 dígitos").optional(),
  // F4-02: CBO — Classificação Brasileira de Ocupações
  cboCodigo: optionalShortString(10),
  cboDescricao: optionalShortString(200)
});

const PatientBaseShape = {
  name: z.string().trim().min(1).max(300),
  motherName: optionalShortString(300),
  // F1-01: motherUnknown was in silent data loss — frontend sends it, schema now accepts it
  motherUnknown: z.boolean().optional(),
  guardianName: optionalShortString(300),
  phone: z.string().trim().min(1).max(30),
  phoneAlt: optionalShortString(30),
  cpf: optionalShortString(20),
  cns: optionalShortString(30),
  // Grupo F — NIS (Número de Identificação Social); dado pessoal comum, 11 dígitos; string vazia → undefined
  nis: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.string().trim().regex(/^\d{11}$/, "NIS deve ter exatamente 11 dígitos").optional()
  ),
  // F2-07: @deprecated Sprint 5A — remove Sprint 5B; kept for read/write compatibility
  cnsCpf: optionalShortString(30),
  // F1-07: address accepted for legacy free-text field (maps to addressLegacy in handler)
  address: optionalShortString(500),
  // F1-07: addressLegacy accepted directly if sent by future frontend versions
  addressLegacy: optionalShortString(500),
  microArea: optionalShortString(100),
  assignedAcsId: optionalShortString(100),
  teamId: optionalShortString(100),
  careCategory: optionalShortString(100),
  chronicConditions: z.array(z.string().trim().max(100)).max(20).optional(),
  // F2-03: maritalStatus enum (canonical e-SUS values)
  maritalStatus: optionalEnumField("SOLTEIRO", "CASADO", "DIVORCIADO", "VIUVO", "UNIAO_ESTAVEL", "SEPARADO", "NAO_INFORMADO"),
  incompleteProfile: z.boolean().optional(),
  inactive: z.boolean().optional(),
  inactivationReason: optionalShortString(1000),
  inactivatedBy: optionalShortString(200),
  inactivatedAt: optionalDateString(),
  // F2-02: sexAtBirth enum (M/F/I); empty string → undefined (not stored)
  sexAtBirth: optionalEnumField("M", "F", "I"),
  // F2-04: genderIdentity enum — SPECIAL_CATEGORY (LGPD Art. 11, CFM Res. 2.265/2019); empty/null → undefined
  genderIdentity: optionalEnumField("HOMEM_CISSGENERO", "MULHER_CISSGENERO", "HOMEM_TRANSGENERO", "MULHER_TRANSGENERO", "NAO_BINARIO", "OUTRO", "NAO_INFORMADO"),
  // Grupo A — e-SUS CDS v3.2 campos Sprint 5B
  // nomeSocial: nome preferido (string livre); SENSITIVE; distinto de genderIdentity (Decisão 5 data model)
  nomeSocial: optionalShortString(150),
  // situacaoRua: SPECIAL_CATEGORY (LGPD Art. 11); shadow column app_patients.situacao_rua (migration 025)
  situacaoRua: z.boolean().optional(),
  // deficiencia: SPECIAL_CATEGORY (LGPD Art. 11); array enum e-SUS CDS v3.2
  deficiencia: z.array(z.enum(["AUDITIVA", "VISUAL", "INTELECTUAL_COGNITIVA", "FISICA", "MULTIPLA", "NAO_INFORMADO"])).max(6).optional(),
  // insegurancaAlimentar: SENSITIVE; boolean autorreferido
  insegurancaAlimentar: z.boolean().optional(),
  // cuidadoResidencial: SENSITIVE; enum e-SUS CDS v3.2
  cuidadoResidencial: optionalEnumField("NAO_RECEBE", "DOMICILIAR_UBS", "DOMICILIAR_ESPECIALIZADO"),
  // beneficiosSociais: SENSITIVE; array enum e-SUS CDS v3.2; campo paralelo a socialBenefit (string livre @deprecated)
  beneficiosSociais: z.array(z.enum(["BOLSA_FAMILIA", "BPC", "APOSENTADORIA", "RENDA_MENSAL_VITALICIA", "SEGURO_DESEMPREGO", "OUTROS"])).max(6).optional(),
  // condicoesSaude: SENSITIVE; array enum e-SUS CDS v3.2; paralelo a chronicConditions (string[] livre)
  condicoesSaude: z.array(z.enum([
    "HIPERTENSAO", "DIABETES", "AVC", "INFARTO", "DOENCA_CARDIACA", "DOENCA_RESPIRATORIA",
    "HANSENIASE", "TUBERCULOSE", "CANCER", "DOENCA_RENAL", "GESTANTE", "PUERICULTURA",
    "TABAGISMO", "ALCOOL_DROGAS", "DST", "VULNERABILIDADE_SOCIAL", "OUTRO"
  ])).max(17).optional(),
  // C14: hivGestante — SPECIAL_CATEGORY LGPD Art. 11 (dado de saúde); Previne Brasil indicador estruturado
  hivGestante: z.boolean().optional(),
  // C14: sifilis — SPECIAL_CATEGORY LGPD Art. 11 (dado de saúde); substitui detecção por regex em chronicConditions
  sifilis: z.boolean().optional(),
  birthDate: optionalDateString(),
  // F1-01: birthCity and birthState were in silent data loss
  birthCity: optionalShortString(100),
  birthState: optionalShortString(2),
  pregnancyStartDate: optionalDateString(),
  expectedDeliveryDate: optionalDateString(),
  gestationalAgeDumWeeks: optionalNumberLike(),
  gestationalAgeDumDays: optionalNumberLike(),
  gestationalAgeUsgWeeks: optionalNumberLike(),
  gestationalAgeUsgDays: optionalNumberLike(),
  usgDate1: optionalDateString(),
  usgDate2: optionalDateString(),
  usgDate3: optionalDateString(),
  prenatalStartDate: optionalDateString(),
  postpartumStartDate: optionalDateString(),
  comorbidities: optionalShortString(4000),
  medications: optionalShortString(4000),
  allergies: optionalShortString(4000),
  // F1-01 + F1-08: address fields from frontend (aliases to canonical e-SUS names)
  // zipCode -> cep, number -> numero, complement -> complemento, neighborhood -> bairro,
  // city -> municipioIbge (accepted as string; IBGE code validation is Sprint 5B),
  // state -> uf
  // F2-06: CEP normalization applied to both alias and canonical field
  zipCode: normalizedCepField(),
  number: optionalShortString(30),
  complement: optionalShortString(100),
  neighborhood: optionalShortString(100),
  city: optionalShortString(100),
  state: optionalShortString(2),
  // F1-08: canonical e-SUS address fields (structured address Sprint 5A)
  logradouro: optionalShortString(250),
  numero: optionalShortString(30),
  complemento: optionalShortString(100),
  bairro: optionalShortString(100),
  // F2-06: CEP canonical — 8 digits, no hyphen
  cep: normalizedCepField(),
  municipioIbge: optionalShortString(7),
  uf: optionalShortString(2),
  tipoLogradouroCnes: optionalShortString(10),
  // F1-01: familyCode was in silent data loss
  familyCode: optionalShortString(30),
  // F1-01: homeVisitFreq was in silent data loss
  homeVisitFreq: optionalShortString(50),
  // F1-01: housingType/waterSupply/sewage/garbage/electricity — Household fields kept in Patient
  // payload for Sprint 5A; backend extraction to app_households is Sprint 5 (Phase 5)
  housingType: optionalShortString(100),
  waterSupply: optionalShortString(100),
  sewage: optionalShortString(100),
  garbage: optionalShortString(100),
  electricity: optionalShortString(100),
  // F1-06: educationLevel is the frontend alias for canonical escolaridade
  educationLevel: optionalShortString(100),
  // C15: escolaridade — CDS enum Seção 15.2 (Sprint 6A)
  escolaridade: optionalEnumField("SEM_ESCOLARIDADE", "FUNDAMENTAL_INCOMPLETO", "FUNDAMENTAL_COMPLETO", "MEDIO_INCOMPLETO", "MEDIO_COMPLETO", "SUPERIOR_INCOMPLETO", "SUPERIOR_COMPLETO", "ESPECIALIZACAO", "MESTRADO", "DOUTORADO", "NAO_INFORMADO"),
  // F1-01: occupation, familySituation, familySupport were in silent data loss
  occupation: optionalShortString(200),
  familySituation: optionalShortString(200),
  familySupport: optionalShortString(500),
  // F1-01: social vulnerability fields were in silent data loss
  socialVulnerability: optionalShortString(500),
  socialBenefit: optionalShortString(500),
  substanceDependency: optionalShortString(500),
  domesticViolence: optionalShortString(500),
  // F1-05 / F2-01: raceColor is the frontend alias for racaCor; both validated against same enum
  raceColor: racaCorField(),
  // F2-01: racaCor canonical e-SUS enum (BRANCA/PRETA/PARDA/AMARELA/INDIGENA); nao_informado → NULL
  racaCor: racaCorField(),
  // F2-01: new e-SUS demographic fields
  etnia: optionalShortString(100),
  // C17: nacionalidade — CDS enum Seção 15.20 (Sprint 6A)
  nacionalidade: optionalEnumField("BRASILEIRA", "NATURALIZADA", "ESTRANGEIRA"),
  municipioNascimentoIbge: optionalShortString(7),
  // C16: situacaoMercadoTrabalho — CDS enum Seção 15.3 (Sprint 6A)
  situacaoMercadoTrabalho: optionalEnumField("EMPREGADO_COM_CARTEIRA", "EMPREGADO_SEM_CARTEIRA", "AUTONOMO", "APOSENTADO_PENSIONISTA", "DESEMPREGADO", "NAO_TRABALHA", "NAO_SE_APLICA", "OUTRO"),
  // C17: rendaFamiliar — CDS enum Seção 15.21 (Sprint 6A)
  rendaFamiliar: optionalEnumField("ATE_0_5_SM", "ENTRE_0_5_E_1_SM", "ENTRE_1_E_2_SM", "ENTRE_2_E_3_SM", "ENTRE_3_E_4_SM", "ACIMA_4_SM", "SEM_RENDA"),
  responsavelFamiliar: optionalShortString(300),
  // F2-05: cnsResponsavel — CNS do responsável familiar; AES-256-GCM via SENSITIVE_PATIENT_FIELDS (db.js)
  cnsResponsavel: optionalShortString(30),
  // F1-01: responsible object (contact info only; CNS do responsável is top-level cnsResponsavel above)
  responsible: z.object({
    name: optionalShortString(300),
    cpf: optionalShortString(20),
    phone: optionalShortString(30),
    relationship: optionalShortString(100)
  }).optional()
};

// C13: CPF ou CNS obrigatório em criação (Portaria 940/2011 — identificação do cidadão no SUS)
const PatientCreateSchema = z.object(PatientBaseShape).superRefine((data, ctx) => {
  const hasCpf = typeof data.cpf === "string" && data.cpf.trim().length > 0;
  const hasCns = typeof data.cns === "string" && data.cns.trim().length > 0;
  if (!hasCpf && !hasCns) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "CPF ou CNS é obrigatório para cadastrar um paciente",
      path: ["cpf"],
    });
  }
});
// D-02: .strict() rejects unknown keys to prevent mass-assignment of internal fields.
// IMPORTANT: fields teamId, unitId, hash, createdAt, updatedAt, createdBy, municipalityId
// are intentionally EXCLUDED — they are internal and must never be set by the client via PATCH.
const PatientUpdateSchema = z.object({
  name: optionalShortString(300),
  motherName: optionalShortString(300),
  // F1-01: motherUnknown added — was being silently discarded
  motherUnknown: z.boolean().optional(),
  guardianName: optionalShortString(300),
  phone: optionalShortString(30),
  phoneAlt: optionalShortString(30),
  cpf: optionalShortString(20),
  cns: optionalShortString(30),
  // Grupo F — NIS (Número de Identificação Social); dado pessoal comum, 11 dígitos; string vazia → undefined
  nis: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.string().trim().regex(/^\d{11}$/, "NIS deve ter exatamente 11 dígitos").optional()
  ),
  // F2-07: @deprecated Sprint 5A — remove Sprint 5B; kept for read/write compatibility
  cnsCpf: optionalShortString(30),
  // F1-07: address (legacy free-text) and addressLegacy both accepted
  address: optionalShortString(500),
  addressLegacy: optionalShortString(500),
  microArea: optionalShortString(100),
  assignedAcsId: optionalShortString(100),
  careCategory: optionalShortString(100),
  chronicConditions: z.array(z.string().trim().max(100)).max(20).optional(),
  // F2-03: maritalStatus enum
  maritalStatus: optionalEnumField("SOLTEIRO", "CASADO", "DIVORCIADO", "VIUVO", "UNIAO_ESTAVEL", "SEPARADO", "NAO_INFORMADO"),
  incompleteProfile: z.boolean().optional(),
  inactive: z.boolean().optional(),
  inactivationReason: optionalShortString(1000),
  inactivatedBy: optionalShortString(200),
  inactivatedAt: optionalDateString(),
  // F2-02: sexAtBirth enum
  sexAtBirth: optionalEnumField("M", "F", "I"),
  // F2-04: genderIdentity enum — SPECIAL_CATEGORY (LGPD Art. 11, CFM Res. 2.265/2019)
  genderIdentity: optionalEnumField("HOMEM_CISSGENERO", "MULHER_CISSGENERO", "HOMEM_TRANSGENERO", "MULHER_TRANSGENERO", "NAO_BINARIO", "OUTRO", "NAO_INFORMADO"),
  // Grupo A — e-SUS CDS v3.2 campos Sprint 5B
  nomeSocial: optionalShortString(150),
  situacaoRua: z.boolean().optional(),
  deficiencia: z.array(z.enum(["AUDITIVA", "VISUAL", "INTELECTUAL_COGNITIVA", "FISICA", "MULTIPLA", "NAO_INFORMADO"])).max(6).optional(),
  insegurancaAlimentar: z.boolean().optional(),
  cuidadoResidencial: optionalEnumField("NAO_RECEBE", "DOMICILIAR_UBS", "DOMICILIAR_ESPECIALIZADO"),
  beneficiosSociais: z.array(z.enum(["BOLSA_FAMILIA", "BPC", "APOSENTADORIA", "RENDA_MENSAL_VITALICIA", "SEGURO_DESEMPREGO", "OUTROS"])).max(6).optional(),
  condicoesSaude: z.array(z.enum([
    "HIPERTENSAO", "DIABETES", "AVC", "INFARTO", "DOENCA_CARDIACA", "DOENCA_RESPIRATORIA",
    "HANSENIASE", "TUBERCULOSE", "CANCER", "DOENCA_RENAL", "GESTANTE", "PUERICULTURA",
    "TABAGISMO", "ALCOOL_DROGAS", "DST", "VULNERABILIDADE_SOCIAL", "OUTRO"
  ])).max(17).optional(),
  // C14: hivGestante — SPECIAL_CATEGORY LGPD Art. 11 (dado de saúde); Previne Brasil indicador estruturado
  hivGestante: z.boolean().optional(),
  // C14: sifilis — SPECIAL_CATEGORY LGPD Art. 11 (dado de saúde); substitui detecção por regex em chronicConditions
  sifilis: z.boolean().optional(),
  birthDate: optionalDateString(),
  // F1-01: birthCity and birthState added
  birthCity: optionalShortString(100),
  birthState: optionalShortString(2),
  pregnancyStartDate: optionalDateString(),
  expectedDeliveryDate: optionalDateString(),
  gestationalAgeDumWeeks: optionalNumberLike(),
  gestationalAgeDumDays: optionalNumberLike(),
  gestationalAgeUsgWeeks: optionalNumberLike(),
  gestationalAgeUsgDays: optionalNumberLike(),
  usgDate1: optionalDateString(),
  usgDate2: optionalDateString(),
  usgDate3: optionalDateString(),
  prenatalStartDate: optionalDateString(),
  postpartumStartDate: optionalDateString(),
  comorbidities: optionalShortString(4000),
  medications: optionalShortString(4000),
  allergies: optionalShortString(4000),
  // F1-08 / F2-06: CEP normalization on both alias and canonical field
  zipCode: normalizedCepField(),
  number: optionalShortString(30),
  complement: optionalShortString(100),
  neighborhood: optionalShortString(100),
  city: optionalShortString(100),
  state: optionalShortString(2),
  logradouro: optionalShortString(250),
  numero: optionalShortString(30),
  complemento: optionalShortString(100),
  bairro: optionalShortString(100),
  // F2-06: CEP canonical — 8 digits
  cep: normalizedCepField(),
  municipioIbge: optionalShortString(7),
  uf: optionalShortString(2),
  tipoLogradouroCnes: optionalShortString(10),
  // F1-01: fields that were in silent data loss
  familyCode: optionalShortString(30),
  homeVisitFreq: optionalShortString(50),
  housingType: optionalShortString(100),
  waterSupply: optionalShortString(100),
  sewage: optionalShortString(100),
  garbage: optionalShortString(100),
  electricity: optionalShortString(100),
  // F2-01: racaCor enum (alias and canonical both validated)
  raceColor: racaCorField(),
  racaCor: racaCorField(),
  // F2-01: new e-SUS demographic fields
  etnia: optionalShortString(100),
  // C17: nacionalidade — CDS enum Seção 15.20 (Sprint 6A)
  nacionalidade: optionalEnumField("BRASILEIRA", "NATURALIZADA", "ESTRANGEIRA"),
  municipioNascimentoIbge: optionalShortString(7),
  // C16: situacaoMercadoTrabalho — CDS enum Seção 15.3 (Sprint 6A)
  situacaoMercadoTrabalho: optionalEnumField("EMPREGADO_COM_CARTEIRA", "EMPREGADO_SEM_CARTEIRA", "AUTONOMO", "APOSENTADO_PENSIONISTA", "DESEMPREGADO", "NAO_TRABALHA", "NAO_SE_APLICA", "OUTRO"),
  // C17: rendaFamiliar — CDS enum Seção 15.21 (Sprint 6A)
  rendaFamiliar: optionalEnumField("ATE_0_5_SM", "ENTRE_0_5_E_1_SM", "ENTRE_1_E_2_SM", "ENTRE_2_E_3_SM", "ENTRE_3_E_4_SM", "ACIMA_4_SM", "SEM_RENDA"),
  responsavelFamiliar: optionalShortString(300),
  // F1-06: alias fields
  educationLevel: optionalShortString(100),
  // C15: escolaridade — CDS enum Seção 15.2 (Sprint 6A)
  escolaridade: optionalEnumField("SEM_ESCOLARIDADE", "FUNDAMENTAL_INCOMPLETO", "FUNDAMENTAL_COMPLETO", "MEDIO_INCOMPLETO", "MEDIO_COMPLETO", "SUPERIOR_INCOMPLETO", "SUPERIOR_COMPLETO", "ESPECIALIZACAO", "MESTRADO", "DOUTORADO", "NAO_INFORMADO"),
  occupation: optionalShortString(200),
  familySituation: optionalShortString(200),
  familySupport: optionalShortString(500),
  socialVulnerability: optionalShortString(500),
  socialBenefit: optionalShortString(500),
  substanceDependency: optionalShortString(500),
  domesticViolence: optionalShortString(500),
  // F2-05: cnsResponsavel — AES-256-GCM via SENSITIVE_PATIENT_FIELDS (db.js)
  cnsResponsavel: optionalShortString(30),
  // F1-01: responsible object (contact info only)
  responsible: z.object({
    name: optionalShortString(300),
    cpf: optionalShortString(20),
    phone: optionalShortString(30),
    relationship: optionalShortString(100)
  }).optional()
}).strict();

const TaskCreateSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  assigneeId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(500),
  notes: optionalShortString(4000),
  status: z.enum(["pending", "in_progress", "done"]).optional(),
  dueDate: optionalDateString()
});

const TaskPatchSchema = z.object({
  status: z.enum(["pending", "in_progress", "done"]).optional(),
  notes: optionalShortString(4000)
});

// D-02: .strict() rejects unknown keys to prevent mass-assignment on appointments
const AppointmentCreateSchema = z.object({
  date: z.string().trim().min(1).max(50),
  summary: z.string().trim().min(1).max(10000),
  demandType: optionalShortString(40),
  conduct: optionalShortString(4000),
  nextStep: optionalShortString(4000)
}).strict();

const AgendaCreateSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  date: z.string().trim().min(1).max(50),
  time: z.string().trim().min(1).max(20),
  doctorId: optionalShortString(100),
  type: z.enum(["consultation", "return", "procedure", "other"]).optional(),
  notes: optionalShortString(4000),
  status: z.enum(["scheduled", "arrived", "attending", "done", "absent"]).optional()
});

const AgendaPatchSchema = z.object({
  date: z.string().trim().min(1).max(50).optional(),
  time: z.string().trim().min(1).max(20).optional(),
  doctorId: optionalShortString(100),
  type: z.enum(["consultation", "return", "procedure", "other"]).optional(),
  notes: optionalShortString(4000),
  status: z.enum(["scheduled", "arrived", "attending", "done", "absent"]).optional()
});

// D-02: .strict() rejects unknown keys to prevent mass-assignment on referrals
const ReferralCreateSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  specialty: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(4000),
  priority: z.enum(["urgent", "priority", "routine"]).optional(),
  date: z.string().trim().min(1).max(50),
  notes: optionalShortString(4000),
  status: z.enum(["pending", "regulated", "scheduled", "done", "cancelled"]).optional()
}).strict();

const ReferralPatchSchema = z.object({
  specialty: z.string().trim().min(1).max(120).optional(),
  reason: z.string().trim().min(1).max(4000).optional(),
  priority: z.enum(["urgent", "priority", "routine"]).optional(),
  date: z.string().trim().min(1).max(50).optional(),
  notes: optionalShortString(4000),
  status: z.enum(["pending", "regulated", "scheduled", "done", "cancelled"]).optional()
});

const PharmacyStockCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(60),
  qty: z.number().min(0).max(100000),
  minQty: z.number().min(0).max(100000),
  location: z.string().trim().min(1).max(200)
});

const PharmacyStockUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  unit: z.string().trim().min(1).max(60).optional(),
  qty: z.number().min(0).max(100000).optional(),
  minQty: z.number().min(0).max(100000).optional(),
  location: z.string().trim().min(1).max(200).optional()
});

const PharmacyAdjustSchema = z.object({
  delta: z.number().int().min(-100000).max(100000),
  reason: z.string().trim().min(3).max(1000)
});

const PharmacyDispenseSchema = z.object({
  itemId: z.string().trim().min(1).max(100),
  qty: z.number().int().min(1).max(100000),
  patientId: z.string().trim().min(1).max(100),
  prescriberId: z.string().trim().min(1).max(100),
  numReceita: z.string().trim().min(1).max(120),
  lote: optionalShortString(120),
  dtReceita: z.string().trim().min(1).max(50),
  notes: optionalShortString(2000)
});

const SuppliesAdjustSchema = z.object({
  qty: z.number().int().min(1).max(100000)
});

const SuppliesDispenseSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  items: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    qty: z.number().int().min(1).max(100000)
  })).min(1).max(60),
  continuo: z.boolean().optional(),
  obs: optionalShortString(2000)
});

const SuppliesCloseContinuousSchema = z.object({
  reason: z.string().trim().min(8).max(1000)
});

const CriticalActionReasonSchema = z.object({
  reason: z.string().trim().min(8).max(1000)
});

const ExamCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  date: z.string().trim().min(1).max(50),
  notes: optionalShortString(20000),
  source: z.enum(["posto", "externo"]).optional()
});

const ExamAttachmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().min(1).max(15 * 1024 * 1024),
  dataBase64: z.string().trim().min(1).max(25 * 1024 * 1024)
});

// D-02: .strict() rejects unknown keys to prevent mass-assignment on clinical records
const RecordCreateSchema = z.object({
  type: z.enum(["visit", "consultation", "vaccine", "procedure", "note", "prescription", "exam_request", "referral", "nursing", "evolution", "attendance_attest", "medical_attest"]),
  date: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(500),
  details: optionalShortString(20000),
  protocolTag: optionalShortString(100),
  metadata: z.record(z.any()).optional(),
  // D-08: obrigatório quando executingTeamId !== patientReferenceTeamId (validado no handler)
  crossTeamJustification: z.string().trim().min(20).max(500).optional(),
  // CID-10 — campos opcionais; validação de existência feita na rota (tabela cid10)
  cidPrincipal: z.string().trim().toUpperCase().regex(/^[A-Z]\d{2,4}(\.\d{1,4})?$/, "CID inválido").optional(),
  cidSecundarios: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]\d{2,4}(\.\d{1,4})?$/, "CID inválido")).max(10).optional(),
  // CIAP-2 — campo opcional; validação de existência feita na rota (tabela ciap2)
  ciapPrincipal: z.string().trim().toUpperCase().regex(/^[A-Z]\d{2}$/, "CIAP-2 inválido").optional()
}).strict();

// F5-03: dedicated schema for type=visit — CDS Ficha de Visita Domiciliar
const VisitCreateSchema = z.object({
  type: z.literal("visit"),
  dataVisita: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "dataVisita deve ser YYYY-MM-DD"),
  turno: z.enum(["MANHA", "TARDE", "NOITE"]),
  tipoVisita: z.enum([
    "VISITA_PERIODICA", "VISITA_POS_INTERNACAO", "ACOMPANHAMENTO_CONDICIONALIDADES",
    "BUSCA_ATIVA", "INVESTIGACAO_SURTO", "EDUCACAO_SAUDE", "ATENDIMENTO_URGENCIA", "OUTRO"
  ]),
  motivosVisita: z.array(z.enum([
    "CADASTRAMENTO_ATUALIZACAO", "VISITA_PERIODICA", "ACOMPANHAMENTO_RN",
    "ACOMPANHAMENTO_GESTANTE", "ACOMPANHAMENTO_PUERPERA", "ACOMPANHAMENTO_CRIANCA",
    "ACOMPANHAMENTO_ADULTO", "ACOMPANHAMENTO_IDOSO", "ACOMPANHAMENTO_PUERICULTURA",
    "BUSCA_FALTOSO", "BUSCA_INTERNACAO", "BUSCA_AVC", "BUSCA_INFARTO", "BUSCA_TB",
    "BUSCA_HANSENIASE", "BUSCA_CANCER", "EDUCACAO_SAUDE", "CONVITE_ATIVIDADE",
    "INVESTIGACAO_SURTO", "CONDICIONALIDADES", "OUTRO"
  ])).min(1),
  desfecho: z.enum(["VISITA_REALIZADA", "AUSENTE", "RECUSOU"]),
  peso: z.number().min(0).max(700).optional(),
  altura: z.number().min(0).max(300).optional()
}).strict();

// D-02: .strict() on queue schemas rejects unknown keys (prevents mass-assignment)
const QueueCreateSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  priority: z.enum(["urgent", "elderly", "pregnant", "child", "normal"]),
  reason: optionalShortString(1000),
  demandType: z.enum(["scheduled", "spontaneous"]).optional(),
  destination: z.enum(["doctor", "nurse"]).optional(),
  agendaRef: optionalShortString(100)
}).strict();

const QueuePatchSchema = z.object({
  status: z.enum(["waiting", "triage", "ready", "attending", "done"]).optional(),
  priority: z.enum(["urgent", "elderly", "pregnant", "child", "normal"]).optional(),
  reason: optionalShortString(1000),
  demandType: z.enum(["scheduled", "spontaneous"]).optional(),
  destination: z.enum(["doctor", "nurse"]).optional(),
  triageStart: optionalDateString(),
  triageDone: optionalDateString(),
  vitals: z.record(z.any()).optional()
}).strict();

const PrivacyRequestCreateSchema = z.object({
  patientId: z.string().min(1).max(100),
  type: z.enum(["access", "correction", "deletion"])
});

// F5-01: Household entity — Ficha de Cadastro Domiciliar (e-SUS CDS Sprint 5A)
// Separate entity from Patient; fields extracted from PATCH /patients payload for compat.
// F5-02: Household enums — Seção 15.12–15.17, 15.25 do esus-data-model-v1.md
const TIPO_IMOVEL_VALUES = ["DOMICILIO", "COMERCIO", "TERRENO_BALDIO", "PONTO_ESTRATEGICO", "ESCOLA", "CRECHE", "ABRIGO", "INST_LONGA_PERMANENCIA", "UNIDADE_PRISIONAL", "DELEGACIA", "OUTRO"];
const MATERIAL_PAREDES_VALUES = ["ALVENARIA_COM_REVESTIMENTO", "ALVENARIA_SEM_REVESTIMENTO", "TAIPA_COM_REVESTIMENTO", "TAIPA_SEM_REVESTIMENTO", "MADEIRA_APARELHADA", "MATERIAL_APROVEITADO", "OUTRO"];
const ABASTECIMENTO_AGUA_VALUES = ["REDE_ENCANADA", "POCO_ARTESIANO", "CISTERNAS", "CARRO_PIPA", "OUTROS"];
const TRATAMENTO_AGUA_VALUES = ["SEM_TRATAMENTO", "FILTRACAO", "FERVURA", "CLORACAO", "MINERAL", "OUTRO"];
const ESGOTAMENTO_VALUES = ["REDE_COLETORA", "FOSSA_SEPTICA", "FOSSA_RUDIMENTAR", "VALA_CEU_ABERTO", "DIRETO_CORPO_AGUA", "OUTRO"];
const DESTINO_LIXO_VALUES = ["COLETA_PUBLICA", "QUEIMADO", "ENTERRADO", "TERRENO_BALDIO", "CORPO_AGUA", "OUTROS"];
const LOCALIZACAO_VALUES = ["URBANA", "RURAL"];
// C04A: LEDI APS 7.4.0 — condicaoMoradia.situacaoMoradiaPosseTerra (obrigatório para exportação CDS)
const SITUACAO_MORADIA_VALUES = ["PROPRIO", "FINANCIADO", "ALUGADO", "ARRENDADO", "CEDIDO", "OCUPACAO", "SITUACAO_RUA", "OUTRO"];
// C04A: LEDI APS 7.4.0 — tipoEndereco (novo campo obrigatório v7.4.0: 1=logradouro, 2=sem endereço)
const TIPO_ENDERECO_VALUES = ["LOGRADOURO", "SEM_ENDERECO"];

const HouseholdCreateSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  familyCode: optionalShortString(50),
  homeVisitFreq: optionalShortString(50),
  // Frontend alias (housingType) and canonical (tipoImovel) — both accepted; canonical preferred
  housingType: z.enum(TIPO_IMOVEL_VALUES).optional(),
  tipoImovel: z.enum(TIPO_IMOVEL_VALUES).optional(),
  // Numeric counts
  numMoradores: z.number().int().min(0).optional(),
  numComodos: z.number().int().min(0).optional(),
  // Enum fields — canonical names; frontend alias kept for backward compat
  materialPredominanteParedes: z.enum(MATERIAL_PAREDES_VALUES).optional(),
  abastecimentoAgua: z.enum(ABASTECIMENTO_AGUA_VALUES).optional(),
  waterSupply: optionalShortString(100),
  tratamentoAgua: z.enum(TRATAMENTO_AGUA_VALUES).optional(),
  esgotamento: z.enum(ESGOTAMENTO_VALUES).optional(),
  sewage: optionalShortString(100),
  coletaLixo: z.boolean().optional(),
  destinacaoLixo: z.enum(DESTINO_LIXO_VALUES).optional(),
  garbage: optionalShortString(100),
  energiaEletrica: z.boolean().optional(),
  electricity: optionalShortString(100),
  localizacao: z.enum(LOCALIZACAO_VALUES).optional(),
  situacaoMoradiaPosseTerra: z.enum(SITUACAO_MORADIA_VALUES).optional(),
  tipoEndereco: z.enum(TIPO_ENDERECO_VALUES).optional()
});

const HouseholdUpdateSchema = z.object({
  familyCode: optionalShortString(50),
  homeVisitFreq: optionalShortString(50),
  housingType: z.enum(TIPO_IMOVEL_VALUES).optional(),
  tipoImovel: z.enum(TIPO_IMOVEL_VALUES).optional(),
  numMoradores: z.number().int().min(0).optional(),
  numComodos: z.number().int().min(0).optional(),
  materialPredominanteParedes: z.enum(MATERIAL_PAREDES_VALUES).optional(),
  abastecimentoAgua: z.enum(ABASTECIMENTO_AGUA_VALUES).optional(),
  waterSupply: optionalShortString(100),
  tratamentoAgua: z.enum(TRATAMENTO_AGUA_VALUES).optional(),
  esgotamento: z.enum(ESGOTAMENTO_VALUES).optional(),
  sewage: optionalShortString(100),
  coletaLixo: z.boolean().optional(),
  destinacaoLixo: z.enum(DESTINO_LIXO_VALUES).optional(),
  garbage: optionalShortString(100),
  energiaEletrica: z.boolean().optional(),
  electricity: optionalShortString(100),
  localizacao: z.enum(LOCALIZACAO_VALUES).optional(),
  situacaoMoradiaPosseTerra: z.enum(SITUACAO_MORADIA_VALUES).optional(),
  tipoEndereco: z.enum(TIPO_ENDERECO_VALUES).optional()
}).strict();

// F4-04 / F4-06: Unit fields — CNES from deployment env (DEFAULT_UNIT_CNES), never hardcoded
// cnes synced to app_units.cnes shadow column (migration 013) via syncShadowTables
const UnitPatchSchema = z.object({
  name: optionalShortString(200),
  cnes: optionalCnesField(),
  // F4-04: tipoUnidade — enum canônico e-SUS CDS v3.2 (Seção 15.23 data model)
  tipoUnidade: z.enum(["UBS", "CAPS", "UPA", "HOSPITAL", "CEO", "OUTRO"]).optional(),
  // KI-06: logical deactivation — no physical deletion; inativo hides unit from new assignments
  status: z.enum(["ativo", "inativo"]).optional()
});

const TeamPatchSchema = z.object({
  // INE — Identificador Nacional de Equipes, exatamente 10 dígitos
  ine: z.string().regex(/^\d{10}$/, "ine deve ter exatamente 10 dígitos").optional(),
  // tipoEquipe — enum canônico e-SUS CDS v3.2 (Seção 15.22 data model)
  // F5-04: EAP→EAPS, OUTRA→OUTROS — valores legados normalizados via normalize-tipoequipe.mjs
  tipoEquipe: z.enum(["ESF", "NASF", "CEO", "EMAP", "EMAD", "EAPS", "OUTROS"]).optional()
});

const MePatchSchema = z.object({
  name: optionalShortString(200),
  email: optionalShortString(255),
  password: z.string().max(1024).optional(),
  currentPassword: z.string().max(1024).optional(),
  councilNumber: optionalShortString(30),
  councilUf: optionalShortString(2),
  // F4-01: CNS profissional — 15 dígitos numéricos, sem AES (identificador público)
  cnsProfissional: z.string().regex(/^\d{15}$/, "cnsProfissional deve ter exatamente 15 dígitos").optional(),
  // F4-02: CBO — Classificação Brasileira de Ocupações
  cboCodigo: optionalShortString(10),
  cboDescricao: optionalShortString(200)
});

const ImpersonationStartSchema = z.object({
  targetUserId: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(8).max(500)
});

const BreakGlassSchema = z.object({
  reason: z.string().trim().min(8).max(500)
});

const AccessRequestCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().min(1).max(255),
  jobTitle: z.string().trim().min(1).max(100)
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({
        error: "Dados inválidos",
        details: result.error.issues.map((i) => {
          const path = i.path.length ? i.path.join(".") : "body";
          return `${path}: ${i.message}`;
        })
      });
    }
    req.body = result.data;
    next();
  };
}

export {
  LoginSchema,
  RegisterSchema,
  PatientCreateSchema,
  PatientUpdateSchema,
  TaskCreateSchema,
  TaskPatchSchema,
  AppointmentCreateSchema,
  AgendaCreateSchema,
  AgendaPatchSchema,
  ReferralCreateSchema,
  ReferralPatchSchema,
  PharmacyStockCreateSchema,
  PharmacyStockUpdateSchema,
  PharmacyAdjustSchema,
  PharmacyDispenseSchema,
  SuppliesAdjustSchema,
  SuppliesDispenseSchema,
  SuppliesCloseContinuousSchema,
  CriticalActionReasonSchema,
  ExamCreateSchema,
  ExamAttachmentCreateSchema,
  RecordCreateSchema,
  VisitCreateSchema,
  QueueCreateSchema,
  QueuePatchSchema,
  PrivacyRequestCreateSchema,
  HouseholdCreateSchema,
  HouseholdUpdateSchema,
  UnitPatchSchema,
  TeamPatchSchema,
  MePatchSchema,
  ImpersonationStartSchema,
  BreakGlassSchema,
  AccessRequestCreateSchema,
  validate
};
