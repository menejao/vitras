// C04A/C04B/C04C: CDS struct serializers for LEDI APS 7.4.0
// Field IDs match LEDI v7.4.0 spec (integracao.esusaps.bridge.ufsc.tech/v740/)
// Official Thrift IDL: github.com/laboratoriobridge/esusaps-integracao
import {
  BinaryWriter, T,
  writeStruct, writeI32Field, writeI64Field,
  writeStringField, writeBoolField, writeI64ListField, writeStructListField
} from "./thrift-protocol.js";
import {
  RACA_COR_MAP, SEXO_MAP, ESCOLARIDADE_MAP, DEFICIENCIA_MAP,
  NACIONALIDADE_DEFAULT, SITUACAO_MORADIA_MAP, TIPO_IMOVEL_MAP,
  TIPO_ENDERECO_MAP, LOCALIZACAO_MAP, ABASTECIMENTO_AGUA_MAP,
  TRATAMENTO_AGUA_MAP, ESGOTAMENTO_MAP, DESTINO_LIXO_MAP,
  MATERIAL_PAREDES_MAP, MOTIVO_SAIDA_MAP, mapEnum, mapEnumList,
  TURNO_MAP, TURNO_DEFAULT, LOCAL_ATENDIMENTO_MAP, LOCAL_ATENDIMENTO_DEFAULT,
  resolveTipoAtendimento, mapCiap2ToLedi
} from "./enum-maps.js";

// ──────────────────────────────────────────────
// UnicaLotacaoHeaderTransport
// fields: 1=profissionalCNS, 2=cboCodigo_2002, 3=cnes, 4=ine,
//         5=dataAtendimento (i64 epoch ms), 6=codigoIbgeMunicipio
// ──────────────────────────────────────────────
function writeUnicaLotacaoHeader(w, header) {
  writeStringField(w, 1, header.profissionalCNS);
  writeStringField(w, 2, header.cboCodigo_2002);
  writeStringField(w, 3, header.cnes);
  if (header.ine) writeStringField(w, 4, header.ine);
  writeI64Field(w, 5, BigInt(header.dataAtendimento));
  writeStringField(w, 6, header.codigoIbgeMunicipio);
  w.writeFieldStop();
}

// ──────────────────────────────────────────────
// IdentificacaoUsuarioCidadao
// ──────────────────────────────────────────────
function writeIdentificacaoUsuario(w, p) {
  if (p.nomeSocial)  writeStringField(w, 1, p.nomeSocial);
  // field 2: codigoIbgeMunicipioNascimento — omit (not stored)
  writeI64Field(w, 3, BigInt(new Date(p.birthDate || p.dataNascimento || "1900-01-01").getTime()));
  // field 4: desconheceNomeMae — omit (not stored)
  if (p.email)       writeStringField(w, 5, p.email);
  writeI64Field(w, 6, NACIONALIDADE_DEFAULT);
  writeStringField(w, 7, p.name || p.nomeCidadao || "");
  if (p.motherName)  writeStringField(w, 8, p.motherName);
  if (p.cns)         writeStringField(w, 9, p.cns);
  if (p.cnsResponsavel) writeStringField(w, 10, p.cnsResponsavel);
  if (p.phone)       writeStringField(w, 11, p.phone);
  if (p.nis)         writeStringField(w, 12, p.nis);
  // field 13: paisNascimento — omit (default Brasileiro, field is conditional on nationality)
  const racaCor = mapEnum(RACA_COR_MAP, p.racaCor || p.raceColor);
  writeI64Field(w, 14, racaCor ?? 99n);  // 99n = sem informação
  const sexo = mapEnum(SEXO_MAP, p.sex || p.sexAtBirth);
  if (sexo != null) writeI64Field(w, 15, sexo);
  // field 16: statusEhResponsavel — omit (not tracked)
  const etnia = mapEnum(RACA_COR_MAP, null);  // only when racaCor=5 (Indígena)
  if ((p.racaCor === "INDIGENA" || p.raceColor === "INDIGENA") && p.etnia) {
    // etnia is a separate enum — use Long directly if we have a numeric code
    const etniaLong = typeof p.etnia === "number" ? BigInt(p.etnia) : null;
    if (etniaLong != null) writeI64Field(w, 17, etniaLong);
  }
  // fields 18,19: nomePaiCidadao, desconheceNomePai — omit
  // fields 20-22: naturalization/entry — omit (default Brasileiro)
  if (p.microArea)   writeStringField(w, 23, String(p.microArea).substring(0, 2));
  // field 24: stForaArea — omit (default false)
  if (p.cpf)         writeStringField(w, 25, p.cpf);
  // field 26: cpfResponsavelFamiliar — omit
  w.writeFieldStop();
}

// ──────────────────────────────────────────────
// InformacoesSocioDemograficas (optional struct)
// ──────────────────────────────────────────────
function writeInfoSocioDemografica(w, p) {
  const defList = mapEnumList(DEFICIENCIA_MAP, p.deficiencia);
  if (defList.length > 0) {
    writeI64ListField(w, 1, defList);
  }
  const escolaridade = mapEnum(ESCOLARIDADE_MAP, p.escolaridade);
  if (escolaridade != null) writeI64Field(w, 2, escolaridade);
  // field 8: statusDesejaInformarOrientacaoSexual → NOT PLANNED (CLAUDE.md)
  // field 14: statusTemAlgumaDeficiencia
  if (defList.length > 0) writeBoolField(w, 14, true);
  // field 15,16: identidadeGenero — only if genderIdentity AND consent flag
  // Per LGPD: consent flag not tracked → omit genderIdentity from export
  w.writeFieldStop();
}

// ──────────────────────────────────────────────
// CondicoesDeSaude (optional struct)
// Maps patient.condicoesSaude[] → boolean indicators
// ──────────────────────────────────────────────
function writeCondicoesDeSaude(w, p) {
  const cond = new Set((Array.isArray(p.condicoesSaude) ? p.condicoesSaude : [])
    .map(c => String(c).toUpperCase()));

  if (p.hivGestante) writeBoolField(w, 15, true);  // gestante (approximate)
  if (cond.has("DIABETES") || cond.has("DIABETE") || cond.has("DIABÉTICO"))
    writeBoolField(w, 17, true);
  if (cond.has("HIPERTENSÃO") || cond.has("HIPERTENSAO") || cond.has("HAS"))
    writeBoolField(w, 20, true);
  if (cond.has("TUBERCULOSE"))
    writeBoolField(w, 23, true);
  if (cond.has("HANSENIASE") || cond.has("HANSENÍASE"))
    writeBoolField(w, 19, true);
  if (cond.has("TABAGISMO") || cond.has("FUMANTE"))
    writeBoolField(w, 13, true);
  if (cond.has("ALCOOL") || cond.has("ÁLCOOL") || cond.has("ALCOOLISMO"))
    writeBoolField(w, 11, true);
  w.writeFieldStop();
}

// ──────────────────────────────────────────────
// EmSituacaoDeRua (optional struct)
// ──────────────────────────────────────────────
function writeEmSituacaoDeRua(w, p) {
  writeBoolField(w, 9, Boolean(p.situacaoRua));
  w.writeFieldStop();
}

// ──────────────────────────────────────────────
// SaidaCidadaoCadastro (optional — only for inactive patients)
// ──────────────────────────────────────────────
function writeSaidaCidadao(w, patient) {
  const motivo = mapEnum(MOTIVO_SAIDA_MAP, patient.inactivationReason);
  if (motivo == null) { w.writeFieldStop(); return; }
  writeI64Field(w, 1, motivo);
  if (patient.inactivationDate && motivo === 135n) {
    writeI64Field(w, 2, BigInt(new Date(patient.inactivationDate).getTime()));
  }
  w.writeFieldStop();
}

// ──────────────────────────────────────────────
// CadastroIndividualTransport (root ficha)
// Field IDs per LEDI APS 7.4.x Thrift IDL (github.com/laboratoriobridge/esusaps-integracao):
//   1=condicoesDeSaude(struct), 3=emSituacaoDeRua(struct),
//   4=fichaAtualizada(bool), 5=identificacaoUsuarioCidadao(struct),
//   6=informacoesSocioDemograficas(struct), 7=statusTermoRecusa(bool) [omitted],
//   8=tpCdsOrigem(i32), 9=uuid(string,required), 10=uuidFichaOriginadora(string),
//   12=saidaCidadaoCadastro(struct), 13=headerTransport(struct)
// Note: IDL has gaps — no fields 2, 11.
// ──────────────────────────────────────────────
export function buildCadastroIndividual({ patient, professional, unit, team, fichaUuid, originUuid, isUpdate = false }) {
  const w = new BinaryWriter();

  // 1: condicoesDeSaude (conditional — include if patient has conditions or hivGestante)
  const hasCondicoes = (Array.isArray(patient.condicoesSaude) && patient.condicoesSaude.length > 0) || patient.hivGestante;
  if (hasCondicoes) {
    writeStruct(w, 1, (inner) => writeCondicoesDeSaude(inner, patient));
  }

  // 3: emSituacaoDeRua (optional)
  if (patient.situacaoRua) {
    writeStruct(w, 3, (inner) => writeEmSituacaoDeRua(inner, patient));
  }

  // 4: fichaAtualizada (required, bool)
  writeBoolField(w, 4, isUpdate);

  // 5: identificacaoUsuarioCidadao (required unless recusa)
  writeStruct(w, 5, (inner) => writeIdentificacaoUsuario(inner, patient));

  // 6: informacoesSocioDemograficas (optional)
  const hasInfoSocio = patient.escolaridade || (Array.isArray(patient.deficiencia) && patient.deficiencia.length > 0);
  if (hasInfoSocio) {
    writeStruct(w, 6, (inner) => writeInfoSocioDemografica(inner, patient));
  }

  // 8: tpCdsOrigem = 3 (sistema terceiro)
  writeI32Field(w, 8, 3);

  // 9: uuid (ficha UUID — required)
  writeStringField(w, 9, fichaUuid);

  // 10: uuidFichaOriginadora
  writeStringField(w, 10, originUuid);

  // 12: saidaCidadaoCadastro (optional — only for inactive/deceased)
  if (patient.inactive) {
    writeStruct(w, 12, (inner) => writeSaidaCidadao(inner, patient));
  }

  // 13: headerTransport (required)
  const dataAtendimento = Date.now();
  const ibgeMunicipio = String(unit?.municipalityId || team?.municipalityId || "3534401").replace(/\D/g, "").substring(0, 7);
  writeStruct(w, 13, (inner) => writeUnicaLotacaoHeader(inner, {
    profissionalCNS: professional.cnsProfissional || professional.cns || "",
    cboCodigo_2002: professional.cboCodigo || "",
    cnes: unit?.cnes || "",
    ine: team?.ine || undefined,
    dataAtendimento,
    codigoIbgeMunicipio: ibgeMunicipio,
  }));

  w.writeFieldStop(); // root struct STOP

  return { buffer: w.toBuffer(), uuid: fichaUuid };
}

// ──────────────────────────────────────────────
// C04B: CondicaoMoradiaChildThrift (nested in CadastroDomiciliarTransport field 2)
// Field IDs per LEDI APS 7.4.x Thrift IDL (github.com/laboratoriobridge/esusaps-integracao):
//   1=abastecimentoDeAgua(i64), 2=aguaConsumoDomicilio(i64),
//   3=destinoLixo(i64), 4=formaEscoamentoBanheiro(i64),
//   5=localizacao(i64), 6=materialPredominanteParedesExtDomicilio(i64),
//   7=nuComodos(string), 8=nuMoradores(string),
//   9=situacaoMoradiaPosseTerra(i64), 10=stDisponibilidadeEnergiaEletrica(bool),
//   11=tipoAcessoDomicilio(i64) [omitted — not stored]
// ──────────────────────────────────────────────
function writeCondicaoMoradia(w, h) {
  const abastecimento = mapEnum(ABASTECIMENTO_AGUA_MAP, h.abastecimentoAgua);
  if (abastecimento != null) writeI64Field(w, 1, abastecimento);

  const tratamento = mapEnum(TRATAMENTO_AGUA_MAP, h.tratamentoAgua);
  if (tratamento != null) writeI64Field(w, 2, tratamento);

  const lixo = mapEnum(DESTINO_LIXO_MAP, h.destinacaoLixo);
  if (lixo != null) writeI64Field(w, 3, lixo);

  const esgotamento = mapEnum(ESGOTAMENTO_MAP, h.esgotamento);
  if (esgotamento != null) writeI64Field(w, 4, esgotamento);

  const localizacao = mapEnum(LOCALIZACAO_MAP, h.localizacao);
  writeI64Field(w, 5, localizacao ?? 1n); // default URBANA

  const material = mapEnum(MATERIAL_PAREDES_MAP, h.materialPredominanteParedes);
  if (material != null) writeI64Field(w, 6, material);

  if (h.numComodos != null && h.numComodos >= 0) writeStringField(w, 7, String(h.numComodos));

  if (h.numMoradores != null && h.numMoradores >= 0) writeStringField(w, 8, String(h.numMoradores));

  const situacao = mapEnum(SITUACAO_MORADIA_MAP, h.situacaoMoradiaPosseTerra);
  if (situacao != null) writeI64Field(w, 9, situacao);

  if (h.energiaEletrica != null) writeBoolField(w, 10, Boolean(h.energiaEletrica));

  w.writeFieldStop();
}

// ──────────────────────────────────────────────
// C04B: CadastroDomiciliarTransport (root ficha)
// Field IDs per LEDI APS 7.4.x Thrift IDL (github.com/laboratoriobridge/esusaps-integracao):
//   2=condicaoMoradia(struct), 6=fichaAtualizada(bool),
//   10=tpCdsOrigem(i32), 11=uuid(string,required), 12=uuidFichaOriginadora(string),
//   13=tipoDeImovel(i64), 15=headerTransport(struct), 20=tipoEndereco(i64)
// Note: IDL has gaps — address fields (bairro, logradouro, etc.) omitted (not stored).
//       numMoradores moved to CondicaoMoradia field 8 (string).
// ──────────────────────────────────────────────
export function buildCadastroDomiciliar({ household, patient, professional, unit, team, fichaUuid, originUuid, isUpdate = false }) {
  const w = new BinaryWriter();

  // 2: condicaoMoradia (optional struct — include if any condition field present)
  const hasCondicoes = household.localizacao || household.abastecimentoAgua ||
    household.tratamentoAgua || household.esgotamento || household.destinacaoLixo ||
    household.energiaEletrica != null || household.materialPredominanteParedes ||
    household.numComodos != null || household.numMoradores != null ||
    household.situacaoMoradiaPosseTerra;
  if (hasCondicoes) {
    writeStruct(w, 2, (inner) => writeCondicaoMoradia(inner, household));
  }

  // 6: fichaAtualizada (required, bool)
  writeBoolField(w, 6, isUpdate);

  // 10: tpCdsOrigem = 3 (sistema terceiro — required)
  writeI32Field(w, 10, 3);

  // 11: uuid (ficha UUID — required)
  writeStringField(w, 11, fichaUuid);

  // 12: uuidFichaOriginadora
  writeStringField(w, 12, originUuid);

  // 13: tipoDeImovel (required, i64)
  const tipoImovel = mapEnum(TIPO_IMOVEL_MAP, household.tipoImovel || household.housingType);
  writeI64Field(w, 13, tipoImovel ?? 1n); // default DOMICILIO

  // 15: headerTransport (required)
  const dataAtendimento = Date.now();
  const ibgeMunicipio = String(unit?.municipalityId || team?.municipalityId || "3534401").replace(/\D/g, "").substring(0, 7);
  writeStruct(w, 15, (inner) => writeUnicaLotacaoHeader(inner, {
    profissionalCNS: professional.cnsProfissional || professional.cns || "",
    cboCodigo_2002: professional.cboCodigo || "",
    cnes: unit?.cnes || "",
    ine: team?.ine || undefined,
    dataAtendimento,
    codigoIbgeMunicipio: ibgeMunicipio,
  }));

  // 20: tipoEndereco (i64 — 1=LOGRADOURO, 2=SEM_ENDERECO)
  const tipoEndereco = TIPO_ENDERECO_MAP[String(household.tipoEndereco || "LOGRADOURO").toUpperCase()] ?? 1n;
  writeI64Field(w, 20, tipoEndereco);

  w.writeFieldStop(); // root struct STOP

  return { buffer: w.toBuffer(), uuid: fichaUuid };
}

// ──────────────────────────────────────────────
// C04C: VariasLotacoesHeaderThrift
// Source: github.com/laboratoriobridge/esusaps-integracao common.thrift
// fields: 6=lotacaoFormPrincipal(STRUCT), 8=dataAtendimento(i64), 9=codigoIbgeMunicipio(string)
// LotacaoHeaderThrift fields: 1=profissionalCNS, 2=cboCodigo_2002, 3=cnes, 4=ine
// ──────────────────────────────────────────────
function writeVariasLotacoesHeader(w, header) {
  writeStruct(w, 6, (inner) => {
    writeStringField(inner, 1, header.profissionalCNS);
    writeStringField(inner, 2, header.cboCodigo_2002);
    writeStringField(inner, 3, header.cnes);
    if (header.ine) writeStringField(inner, 4, header.ine);
    inner.writeFieldStop();
  });
  writeI64Field(w, 8, BigInt(header.dataAtendimento));
  writeStringField(w, 9, header.codigoIbgeMunicipio);
  w.writeFieldStop();
}

// ──────────────────────────────────────────────
// C04C: ProblemaCondicaoThrift
// Source: github.com/laboratoriobridge/esusaps-integracao common.thrift
// fields: 4=ciap(string), 5=cid10(string), 6=situacao(i64), 9=isAvaliado(bool)
// situacao: 1=ATIVO, 2=LATENTE, 4=RESOLVIDO
// Used as list element — writeItemFn for writeStructListField; writes fields + STOP.
// ──────────────────────────────────────────────
function writeProblemaCondicao(w, problema) {
  if (problema.ciap) writeStringField(w, 4, problema.ciap);
  if (problema.cid10) writeStringField(w, 5, problema.cid10);
  writeI64Field(w, 6, problema.situacao ?? 1n); // 1n = ATIVO
  writeBoolField(w, 9, problema.isAvaliado ?? true);
  w.writeFieldStop();
}

// Build ProblemaCondicaoThrift list from record's clinical codes.
function buildProblemasCondicoes(record) {
  const problemas = [];

  const ciap = mapCiap2ToLedi(record.ciapPrincipal);
  const cid = record.cidPrincipal ? String(record.cidPrincipal).trim().toUpperCase() : null;

  if (ciap || cid) {
    problemas.push({ ciap, cid10: cid, situacao: 1n, isAvaliado: true });
  }

  if (Array.isArray(record.cidSecundarios)) {
    for (const c of record.cidSecundarios) {
      const cid2 = c ? String(c).trim().toUpperCase() : null;
      if (cid2) problemas.push({ ciap: null, cid10: cid2, situacao: 1n, isAvaliado: true });
    }
  }

  return problemas;
}

// ──────────────────────────────────────────────
// C04C: FichaAtendimentoIndividualChildThrift
// Source: github.com/laboratoriobridge/esusaps-integracao ficha_atendimento_individual.thrift
// Minimum fields exported per LEDI 7.4.0:
//   2=cns, 3=dataNascimento, 4=localDeAtendimento, 5=sexo, 6=turno,
//   7=tipoAtendimento, 30=cpfCidadao, 40=problemasCondicoes
// ──────────────────────────────────────────────
function writeAtendimentoIndividualChild(w, { record, patient }) {
  if (patient.cns) writeStringField(w, 2, patient.cns);

  if (patient.birthDate || patient.dataNascimento) {
    writeI64Field(w, 3, BigInt(new Date(patient.birthDate || patient.dataNascimento).getTime()));
  }

  const localAtend = LOCAL_ATENDIMENTO_MAP[String(record.localDeAtendimento || "UBS").toUpperCase()] ?? LOCAL_ATENDIMENTO_DEFAULT;
  writeI64Field(w, 4, localAtend);

  const sexo = mapEnum(SEXO_MAP, patient.sex || patient.sexAtBirth);
  if (sexo != null) writeI64Field(w, 5, sexo);

  const turno = TURNO_MAP[String(record.turno || "TARDE").toUpperCase()] ?? TURNO_DEFAULT;
  writeI64Field(w, 6, turno);

  const tipoAtend = resolveTipoAtendimento(record.type, record.demandType, record.priority);
  writeI64Field(w, 7, tipoAtend);

  if (patient.cpf) writeStringField(w, 30, patient.cpf);

  const problemas = buildProblemasCondicoes(record);
  if (problemas.length > 0) {
    writeStructListField(w, 40, problemas, writeProblemaCondicao);
  }

  w.writeFieldStop();
}

// ──────────────────────────────────────────────
// C04C: FichaAtendimentoIndividualMasterThrift (root)
// Source: github.com/laboratoriobridge/esusaps-integracao ficha_atendimento_individual.thrift
// fields: 1=headerTransport(VariasLotacoesHeaderThrift), 2=atendimentosIndividuais(list<ChildThrift>),
//         3=uuidFicha(string, required), 4=tpCdsOrigem(i32)
// ──────────────────────────────────────────────
export function buildAtendimentoIndividual({ record, patient, professional, unit, team, fichaUuid }) {
  const w = new BinaryWriter();

  const recordDate = record.date ? new Date(record.date).getTime() : Date.now();
  const ibgeMunicipio = String(unit?.municipalityId || team?.municipalityId || "3534401").replace(/\D/g, "").substring(0, 7);

  // 1: headerTransport (VariasLotacoesHeaderThrift)
  writeStruct(w, 1, (inner) => writeVariasLotacoesHeader(inner, {
    profissionalCNS: professional.cnsProfissional || professional.cns || "",
    cboCodigo_2002: professional.cboCodigo || "",
    cnes: unit?.cnes || "",
    ine: team?.ine || undefined,
    dataAtendimento: recordDate,
    codigoIbgeMunicipio: ibgeMunicipio,
  }));

  // 2: atendimentosIndividuais (list<FichaAtendimentoIndividualChildThrift>)
  writeStructListField(w, 2, [{ record, patient, professional, unit, team }], writeAtendimentoIndividualChild);

  // 3: uuidFicha (required string)
  writeStringField(w, 3, fichaUuid);

  // 4: tpCdsOrigem = 3 (sistema terceiro)
  writeI32Field(w, 4, 3);

  w.writeFieldStop();

  return { buffer: w.toBuffer(), uuid: fichaUuid };
}
