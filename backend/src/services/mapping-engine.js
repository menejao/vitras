/**
 * Mapping Engine — MAP-PEC-01-v1
 *
 * Applies sp-pec-aps-v01 source profile rules to transform PEC APS raw data
 * into VITRAS Canonical Model records. Implements the 100%-certainty rule:
 * ambiguous or unrecognized values are rejected, never estimated.
 */

// ── Enum translation tables (MAP-PEC-01 §5) ────────────────────────────────

const RACA_COR_MAP = {
  "01": "BRANCA",
  "02": "PRETA",
  "03": "PARDA",
  "04": "AMARELA",
  "05": "INDIGENA",
};

const GENDER_IDENTITY_MAP = {
  "0": "NAO_INFORMADO",
  "1": "HOMEM_CISSGENERO",
  "2": "MULHER_CISSGENERO",
  "3": "HOMEM_TRANSGENERO",
  "4": "MULHER_TRANSGENERO",
  "5": "NAO_BINARIO",
  "6": "OUTRO",
};

const DESFECHO_MAP = {
  "1": "VISITA_REALIZADA",
  "2": "AUSENTE",
  "3": "RECUSOU",
};

const TURNO_MAP = {
  "1": "MANHA",
  "2": "TARDE",
  "3": "NOITE",
};

const TIPO_VISITA_MAP = {
  "1": "VISITA_PERIODICA",
  "2": "BUSCA_ATIVA",
  "3": "INVESTIGACAO_SURTO",
  "4": "EDUCACAO_SAUDE",
  "5": "ATENDIMENTO_URGENCIA",
  "6": "VISITA_POS_INTERNACAO",
  "7": "ACOMPANHAMENTO_CONDICIONALIDADES",
  "8": "OUTRO",
};

const MOTIVO_VISITA_MAP = {
  "1":  "CADASTRAMENTO_ATUALIZACAO",
  "2":  "CONSULTA_SEGUIMENTO",
  "3":  "BUSCA_ATIVA_VISITA_PERIODICA",
  "4":  "ACOMPANHAMENTO_GESTANTE",
  "5":  "ACOMPANHAMENTO_PUERPERA",
  "6":  "ACOMPANHAMENTO_CRESCIMENTO_DESENVOLVIMENTO",
  "7":  "ACOMPANHAMENTO_DOENCA_CRONICA",
  "8":  "ACOMPANHAMENTO_SAUDE_MENTAL",
  "9":  "EDUCACAO_SAUDE_GRUPO",
  "10": "CONTROLE_AMBIENTAL_VETORIAL",
  "11": "CONVITE_ATIVIDADE_COLETIVA",
  "12": "ORIENTACAO_PREVENCAO",
  "13": "VERIFICACAO_SITUACAO_RISCO",
  "14": "OUTROS",
};

const DEFICIENCIA_MAP = {
  "1": "AUDITIVA",
  "2": "VISUAL",
  "3": "INTELECTUAL_COGNITIVA",
  "4": "FISICA",
  "5": "MULTIPLA",
};

const CARE_CATEGORY_VALUES = new Set(["general", "pregnant", "puerperal", "child_followup", "chronic"]);

// ── Normalizers ────────────────────────────────────────────────────────────

function normalizeCpf(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

function normalizeCns(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\s/g, "");
  return digits.length === 15 ? digits : null;
}

function normalizeDatePtBr(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return iso;
}

function normalizePhone(raw) {
  if (!raw) return null;
  return String(raw).replace(/\D/g, "").slice(0, 20) || null;
}

function deriveCareCategory(raw) {
  if (!raw) return "general";
  if (raw.gestante === true || raw.gestante === "true" || raw.gestante === "1") return "pregnant";
  if (raw.puerpera === true || raw.puerpera === "true" || raw.puerpera === "1") return "puerperal";
  const birthDate = normalizeDatePtBr(raw.dataNascimento) || raw.dataNascimento;
  if (birthDate) {
    const age = (Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age <= 2) return "child_followup";
  }
  const hasChronicFlag = raw.doencaCronica === true || raw.doencaCronica === "true" || raw.doencaCronica === "1";
  const hasChronicConds = Array.isArray(raw.condicoesCronicas) && raw.condicoesCronicas.length > 0;
  if (hasChronicFlag || hasChronicConds) return "chronic";
  return "general";
}

// ── Map single patient ─────────────────────────────────────────────────────

export function mapPatient(raw, importJobId, sourceSystem, targetTeamId, targetUnitId, targetMunicipalityId) {
  const errors = [];

  const name = raw.nome ? String(raw.nome).trim() : null;
  if (!name) errors.push({ field: "name", value: raw.nome, reason: "campo obrigatório ausente" });

  const birthDateRaw = normalizeDatePtBr(raw.dataNascimento);
  if (!birthDateRaw && raw.dataNascimento) {
    errors.push({ field: "birthDate", value: raw.dataNascimento, reason: "formato inválido — esperado DD/MM/AAAA" });
  }
  if (!birthDateRaw && !raw.dataNascimento) {
    errors.push({ field: "birthDate", value: null, reason: "campo obrigatório ausente" });
  }

  const cpf = normalizeCpf(raw.cpf);
  if (raw.cpf && !cpf) {
    errors.push({ field: "cpf", value: raw.cpf, reason: "CPF inválido — esperado 11 dígitos" });
  }

  const cns = normalizeCns(raw.cns);
  if (raw.cns && !cns) {
    errors.push({ field: "cns", value: raw.cns, reason: "CNS inválido — esperado 15 dígitos" });
  }

  let racaCor = null;
  if (raw.racaCor !== undefined && raw.racaCor !== null && raw.racaCor !== "") {
    racaCor = RACA_COR_MAP[String(raw.racaCor)];
    if (!racaCor) {
      errors.push({ field: "racaCor", value: raw.racaCor, reason: "valor não mapeável na tabela sp-pec-aps-v01" });
    }
  }

  let genderIdentity = null;
  if (raw.identidadeGenero !== undefined && raw.identidadeGenero !== null && raw.identidadeGenero !== "") {
    genderIdentity = GENDER_IDENTITY_MAP[String(raw.identidadeGenero)];
    if (!genderIdentity) {
      errors.push({ field: "genderIdentity", value: raw.identidadeGenero, reason: "valor não mapeável" });
    }
  }

  const deficiencia = [];
  if (Array.isArray(raw.deficiencia)) {
    for (const d of raw.deficiencia) {
      const mapped = DEFICIENCIA_MAP[String(d)];
      if (mapped) {
        deficiencia.push(mapped);
      } else {
        errors.push({ field: "deficiencia", value: d, reason: "código não mapeável" });
      }
    }
  }

  const careCategory = deriveCareCategory(raw);
  const municipalityId = String(raw.ibgeMunicipio || raw.municipalityId || targetMunicipalityId || "").trim();

  if (errors.length > 0) {
    return { ok: false, sourceId: String(raw.id || ""), errors };
  }

  return {
    ok: true,
    sourceId: String(raw.id || ""),
    canonical: {
      name,
      birthDate: birthDateRaw,
      motherName: raw.nomeMae ? String(raw.nomeMae).trim() : null,
      cpf: cpf || null,
      cns: cns || null,
      phone: normalizePhone(raw.telefone),
      address: raw.endereco ? String(raw.endereco).trim() : null,
      municipalityId,
      teamId: targetTeamId,
      unitId: targetUnitId,
      assignedAcsId: raw.acsId || null,
      microArea: raw.microarea || raw.microArea || null,
      careCategory,
      chronicConditions: Array.isArray(raw.condicoesCronicas) ? raw.condicoesCronicas : [],
      racaCor: racaCor || null,
      genderIdentity: genderIdentity || null,
      situacaoRua: raw.situacaoRua === true || raw.situacaoRua === "true" || raw.situacaoRua === "1",
      deficiencia,
      hivGestante: raw.hivGestante === true || raw.hivGestante === "true" || raw.hivGestante === "1",
      sifilis: raw.sifilis === true || raw.sifilis === "true" || raw.sifilis === "1",
      familyCode: raw.codigoFamilia || null,
      inactive: raw.inactive === true || raw.inactive === "true" || raw.inactive === "1",
      sourceId: String(raw.id || ""),
      importJobId,
      sourceSystem,
    },
  };
}

// ── Map single visit event ─────────────────────────────────────────────────

export function mapVisitEvent(raw, patientSourceId, importJobId, sourceSystem, createdByUserId, teamId) {
  const errors = [];

  const dateRaw = normalizeDatePtBr(raw.dataVisita);
  if (!dateRaw) {
    errors.push({ field: "date", value: raw.dataVisita, reason: "data inválida ou ausente" });
  }

  const turno = TURNO_MAP[String(raw.turno || "")];
  if (!turno && raw.turno) {
    errors.push({ field: "turno", value: raw.turno, reason: "valor não mapeável" });
  }

  const tipoVisita = TIPO_VISITA_MAP[String(raw.tipoVisita || "")];
  if (!tipoVisita) {
    errors.push({ field: "tipoVisita", value: raw.tipoVisita, reason: "campo obrigatório ausente ou não mapeável" });
  }

  const desfecho = DESFECHO_MAP[String(raw.desfecho || "")];
  if (!desfecho) {
    errors.push({ field: "desfecho", value: raw.desfecho, reason: "campo obrigatório ausente ou não mapeável" });
  }

  const motivosRaw = Array.isArray(raw.motivosVisita) ? raw.motivosVisita : [];
  const motivosVisita = [];
  for (const m of motivosRaw) {
    const mapped = MOTIVO_VISITA_MAP[String(m)];
    if (mapped) {
      motivosVisita.push(mapped);
    } else {
      errors.push({ field: "motivosVisita", value: m, reason: "código não mapeável" });
    }
  }
  if (motivosVisita.length === 0 && motivosRaw.length === 0) {
    errors.push({ field: "motivosVisita", value: null, reason: "ao menos 1 motivo obrigatório" });
  }

  if (errors.length > 0) {
    return { ok: false, sourceId: String(raw.id || ""), patientSourceId, errors };
  }

  return {
    ok: true,
    sourceId: String(raw.id || ""),
    patientSourceId,
    canonical: {
      type: "visit",
      patientSourceId,  // included so validateEvent can check referential integrity
      date: dateRaw,
      teamId,
      createdBy: createdByUserId,
      importJobId,
      sourceSystem,
      sourceId: String(raw.id || ""),
      dataVisita: dateRaw,
      turno: turno || null,
      tipoVisita,
      motivosVisita,
      desfecho,
    },
  };
}

// ── Map full PEC APS payload ───────────────────────────────────────────────

export function applyMapping(rawPayload, context) {
  const {
    importJobId,
    sourceSystem = "pec-aps-v4.2",
    targetTeamId,
    targetUnitId,
    targetMunicipalityId,
    defaultAcsUserId,
  } = context;

  const patients = Array.isArray(rawPayload.pacientes) ? rawPayload.pacientes : [];
  const mappedPatients = [];
  const rejectedPatients = [];

  for (const raw of patients) {
    const result = mapPatient(raw, importJobId, sourceSystem, targetTeamId, targetUnitId, targetMunicipalityId);
    if (result.ok) {
      mappedPatients.push(result);
    } else {
      rejectedPatients.push(result);
    }
  }

  const mappedEvents = [];
  const rejectedEvents = [];

  // Build a lookup Map to avoid O(N²) scan for visits
  const rawById = new Map(patients.map((p) => [String(p.id), p]));

  for (const patResult of mappedPatients) {
    const rawPat = rawById.get(patResult.sourceId);
    const visitas = Array.isArray(rawPat?.visitas) ? rawPat.visitas : [];
    for (const vis of visitas) {
      const evResult = mapVisitEvent(vis, patResult.sourceId, importJobId, sourceSystem, defaultAcsUserId || "system", targetTeamId);
      if (evResult.ok) {
        mappedEvents.push(evResult);
      } else {
        rejectedEvents.push(evResult);
      }
    }
  }

  return {
    patients: { mapped: mappedPatients, rejected: rejectedPatients },
    events: { mapped: mappedEvents, rejected: rejectedEvents },
    stats: {
      totalRaw: patients.length,
      patientsMapped: mappedPatients.length,
      patientsRejected: rejectedPatients.length,
      eventsMapped: mappedEvents.length,
      eventsRejected: rejectedEvents.length,
    },
  };
}
