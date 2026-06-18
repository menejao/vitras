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
// Field IDs per LEDI 7.4.0:
//   1=condicoesDeSaude, 2=emSituacaoDeRua, 3=fichaAtualizada
//   4=identificacaoUsuarioCidadao, 5=informacoesSocioDemograficas
//   6=statusTermoRecusa, 7=tpCdsOrigem, 8=uuid, 9=uuidFichaOriginadora
//   10=saidaCidadaoCadastro, 11=headerTransport
// ──────────────────────────────────────────────
export function buildCadastroIndividual({ patient, professional, unit, team, fichaUuid, originUuid, isUpdate = false }) {
  const w = new BinaryWriter();

  // 1: condicoesDeSaude (conditional — include if patient has conditions or hivGestante)
  const hasCondicoes = (Array.isArray(patient.condicoesSaude) && patient.condicoesSaude.length > 0) || patient.hivGestante;
  if (hasCondicoes) {
    writeStruct(w, 1, (inner) => writeCondicoesDeSaude(inner, patient));
  }

  // 2: emSituacaoDeRua (optional)
  if (patient.situacaoRua) {
    writeStruct(w, 2, (inner) => writeEmSituacaoDeRua(inner, patient));
  }

  // 3: fichaAtualizada (required, boolean)
  writeBoolField(w, 3, isUpdate);

  // 4: identificacaoUsuarioCidadao (required unless recusa)
  writeStruct(w, 4, (inner) => writeIdentificacaoUsuario(inner, patient));

  // 5: informacoesSocioDemograficas (optional)
  const hasInfoSocio = patient.escolaridade || (Array.isArray(patient.deficiencia) && patient.deficiencia.length > 0);
  if (hasInfoSocio) {
    writeStruct(w, 5, (inner) => writeInfoSocioDemografica(inner, patient));
  }

  // 7: tpCdsOrigem = 3 (sistema terceiro)
  writeI32Field(w, 7, 3);

  // 8: uuid (patient's own UUID — used for upsert)
  writeStringField(w, 8, patient.id);

  // 9: uuidFichaOriginadora (required — UUID that identifies this export batch entry)
  writeStringField(w, 9, originUuid);

  // 10: saidaCidadaoCadastro (optional — only for inactive/deceased)
  if (patient.inactive) {
    writeStruct(w, 10, (inner) => writeSaidaCidadao(inner, patient));
  }

  // 11: headerTransport (required)
  const dataAtendimento = Date.now();
  const ibgeMunicipio = String(unit?.municipalityId || team?.municipalityId || "3534401").replace(/\D/g, "").substring(0, 7);
  writeStruct(w, 11, (inner) => writeUnicaLotacaoHeader(inner, {
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
// C04B: CondicaoMoradiaTransport (nested in CadastroDomiciliarTransport field 4)
// Field IDs per LEDI 7.4.0:
//   1=abastecimentoDeAgua, 3=aguaConsumoDomicilio, 4=destinoLixo,
//   5=energiaEletricaNoDomicilio, 6=formaEscoamentoBanheiro,
//   7=localizacao, 8=materialPredominanteParedesExtDomicilio,
//   9=numeroDeComodos, 11=situacaoMoradiaPosseTerra
// ──────────────────────────────────────────────
function writeCondicaoMoradia(w, h) {
  const abastecimento = mapEnum(ABASTECIMENTO_AGUA_MAP, h.abastecimentoAgua);
  if (abastecimento != null) writeI64Field(w, 1, abastecimento);

  const tratamento = mapEnum(TRATAMENTO_AGUA_MAP, h.tratamentoAgua);
  if (tratamento != null) writeI64Field(w, 3, tratamento);

  const lixo = mapEnum(DESTINO_LIXO_MAP, h.destinacaoLixo);
  if (lixo != null) writeI64Field(w, 4, lixo);

  if (h.energiaEletrica != null) writeBoolField(w, 5, Boolean(h.energiaEletrica));

  const esgotamento = mapEnum(ESGOTAMENTO_MAP, h.esgotamento);
  if (esgotamento != null) writeI64Field(w, 6, esgotamento);

  const localizacao = mapEnum(LOCALIZACAO_MAP, h.localizacao);
  writeI64Field(w, 7, localizacao ?? 1n); // default URBANA

  const material = mapEnum(MATERIAL_PAREDES_MAP, h.materialPredominanteParedes);
  if (material != null) writeI64Field(w, 8, material);

  if (h.numComodos != null && h.numComodos >= 0) writeI32Field(w, 9, Number(h.numComodos));

  const situacao = mapEnum(SITUACAO_MORADIA_MAP, h.situacaoMoradiaPosseTerra);
  if (situacao != null) writeI64Field(w, 11, situacao);

  w.writeFieldStop();
}

// ──────────────────────────────────────────────
// C04B: CadastroDomiciliarTransport (root ficha)
// Field IDs per LEDI 7.4.0:
//   1=animaisNoDomicilio, 2=bairro, 3=complemento,
//   4=condicoesDeMoradia, 5=fichaAtualizada, 6=municipio,
//   7=nomeLogradouro, 8=numero, 9=numeroMoradores,
//   10=stMunicipioPcadastro, 11=tpCdsOrigem, 12=telefoneContato,
//   13=tipoDeImovel, 14=tipoEndereco, 15=uuid,
//   16=uuidFichaOriginadora, 17=headerTransport
// ──────────────────────────────────────────────
export function buildCadastroDomiciliar({ household, patient, professional, unit, team, fichaUuid, originUuid, isUpdate = false }) {
  const w = new BinaryWriter();

  // 4: condicoesDeMoradia (optional struct — include if any condition field present)
  const hasCondicoes = household.localizacao || household.abastecimentoAgua ||
    household.tratamentoAgua || household.esgotamento || household.destinacaoLixo ||
    household.energiaEletrica != null || household.materialPredominanteParedes ||
    household.numComodos != null || household.situacaoMoradiaPosseTerra;
  if (hasCondicoes) {
    writeStruct(w, 4, (inner) => writeCondicaoMoradia(inner, household));
  }

  // 5: fichaAtualizada (required, bool)
  writeBoolField(w, 5, isUpdate);

  // 9: numeroMoradores (optional, i32)
  if (household.numMoradores != null && household.numMoradores >= 0) {
    writeI32Field(w, 9, Number(household.numMoradores));
  }

  // 11: tpCdsOrigem = 3 (sistema terceiro — required)
  writeI32Field(w, 11, 3);

  // 13: tipoDeImovel (required, i64)
  const tipoImovel = mapEnum(TIPO_IMOVEL_MAP, household.tipoImovel || household.housingType);
  writeI64Field(w, 13, tipoImovel ?? 1n); // default DOMICILIO

  // 14: tipoEndereco (required LEDI 7.4.0, i32 — 1=LOGRADOURO, 2=SEM_ENDERECO)
  const tipoEndereco = TIPO_ENDERECO_MAP[String(household.tipoEndereco || "LOGRADOURO").toUpperCase()] ?? 1;
  writeI32Field(w, 14, tipoEndereco);

  // 15: uuid (household's own UUID — used for upsert in PEC)
  writeStringField(w, 15, household.id);

  // 16: uuidFichaOriginadora (required — identifies this export batch entry)
  writeStringField(w, 16, originUuid);

  // 17: headerTransport (required)
  const dataAtendimento = Date.now();
  const ibgeMunicipio = String(unit?.municipalityId || team?.municipalityId || "3534401").replace(/\D/g, "").substring(0, 7);
  writeStruct(w, 17, (inner) => writeUnicaLotacaoHeader(inner, {
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
