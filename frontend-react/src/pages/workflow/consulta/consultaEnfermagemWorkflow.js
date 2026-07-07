export const EMPTY_CONSULTA_ENFERMAGEM = {
  atendimento: {
    dataAtendimento: "",
    horaAtendimento: "",
    carater: "",
    linhaCuidado: "",
    localAtendimento: "ubs",
    tipoAtendimento: "",
  },
  motivoConsulta: {
    texto: "",
  },
  dum: {
    data: "",
    gestante: "",
  },
  antropometria: {
    peso: "",
    altura: "",
    imc: "",
  },
  sinaisVitais: {
    afericaoPA: "",
    pas: "",
    pad: "",
    frequenciaRespiratoria: "",
    frequenciaCardiaca: "",
    temperatura: "",
    saturacaoO2: "",
    dor: "",
    glicemiaCapilar: "",
    momentoGlicemia: "",
  },
  vacinacao: {
    emDia: "",
  },
  exames: {
    hemoglobina_glicada: "",
    colesterol_total: "",
    creatinina: "",
    eas_equ: "",
    eletrocardiograma: "",
    eletroforese: "",
    espirometria: "",
    escarro: "",
    glicemia: "",
    hdl: "",
    hemograma: "",
    ldl: "",
    retinografia: "",
    oftalmologista: "",
    sifilis_vdrl: "",
    sorologia_dengue: "",
    sorologia_hiv: "",
    tia: "",
    teste_orelhinha: "",
    teste_gravidez: "",
    teste_pezinho: "",
    usg_obstetrica: "",
    urocultura: "",
    resultado: "",
  },
  avaliacao: {
    problemasCondicoes: [],
  },
  avaliacaoClinica: {
    notificacaoAcidenteTrabalho: "",
    avaliacao: "",
    exameFisico: "",
    ficouObservacao: "",
    emultiPolo: "",
  },
  conduta: {
    orientacoes: [],
    dataRetorno: "",
    encaminhamentos: [],
    procedimentos: { itens: [] },
  },
};

export function buildConsultaEnfermagemRecord(formData, patient, users) {
  const {
    atendimento = {},
    motivoConsulta = {},
    dum = {},
    antropometria = {},
    sinaisVitais = {},
    vacinacao = {},
    exames = {},
    avaliacao = {},
    avaliacaoClinica = {},
    conduta = {},
  } = formData;

  const examesSolicitados = Object.entries(exames)
    .filter(([k, v]) => k !== "resultado" && v)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");

  const detailParts = [
    motivoConsulta.texto ? `Motivo: ${motivoConsulta.texto.slice(0, 60)}` : "",
    (avaliacao.problemasCondicoes || []).length ? `Condições: ${avaliacao.problemasCondicoes.join(", ")}` : "",
    (conduta.orientacoes || []).length ? `Conduta: ${conduta.orientacoes.join(", ")}` : "",
  ].filter(Boolean).join(" · ");

  return {
    type: "nursing",
    title: "Consulta de Enfermagem (Geral)",
    date: atendimento.dataAtendimento || new Date().toISOString().slice(0, 10),
    details: detailParts || "Consulta de enfermagem",
    metadata: {
      subtype: "consulta_enfermagem",
      workflow: "consulta_enfermagem_v1",
      localAtendimento: atendimento.localAtendimento,
      tipoAtendimento: atendimento.tipoAtendimento,
      carater: atendimento.carater,
      linhaCuidado: atendimento.linhaCuidado,
      problemasCondicoes: avaliacao.problemasCondicoes,
      condutaOrientacoes: conduta.orientacoes,
      procedureCodes: ((conduta.procedimentos || {}).itens || []).map(p => p.code),
      examesSolicitados,
      antropometria,
      sinaisVitais,
      atendimento,
      motivoConsulta,
      dum,
      vacinacao,
      exames,
      avaliacao,
      avaliacaoClinica,
      conduta,
    },
  };
}
