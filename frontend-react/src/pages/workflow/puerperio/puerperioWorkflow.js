export const EMPTY_PUERPERIO = {
  atendimento: {
    dataAtendimento: "",
    horaAtendimento: "",
    localAtendimento: "ubs",
    tipoAtendimento: "consulta_puerperio",
  },
  desfechoGestacional: {
    tipo: "",
  },
  dadosAtendimento: {
    pressaoArterial: "",
    vacinacaoEmDia: "",
    realizouPreNatal: "",
    avaliacaoOdontologica: "",
    situacaoSocialRisco: "",
    estadoPsiquico: "",
    febrePosOperatorio: "",
    parceiroSexualFixo: "",
    parceiroPresenteConsulta: "",
    etilista: "",
    istTratada: "",
    imunoglobulinaAntiD: "",
  },
  exameFisico: {
    mamas: "",
    episiotomia: "",
    involucaoUterina: "",
    loquios: "",
    observacoes: "",
  },
  conduta: {
    planejamentoReprodutivo: "",
    orientacoes: [],
    desfecho: "",
    observacoes: "",
  },
  procedimentos: {
    itens: [],
  },
};

export function buildPuerperioRecord(formData, patient, users) {
  const {
    atendimento = {},
    desfechoGestacional = {},
    dadosAtendimento = {},
    exameFisico = {},
    conduta = {},
    procedimentos = {},
  } = formData;

  const detailParts = [
    desfechoGestacional.tipo ? `Desfecho: ${desfechoGestacional.tipo}` : "",
    conduta.desfecho ? `Conduta: ${conduta.desfecho}` : "",
    (conduta.orientacoes || []).length ? `Orientações: ${conduta.orientacoes.join(", ")}` : "",
  ].filter(Boolean).join(" · ");

  return {
    type: "nursing",
    title: "Puerpério — Consulta de Enfermagem",
    date: atendimento.dataAtendimento || new Date().toISOString().slice(0, 10),
    details: detailParts || "Consulta de puerpério",
    metadata: {
      subtype: "puerperio",
      workflow: "puerperio_v1",
      localAtendimento: atendimento.localAtendimento,
      tipoAtendimento: atendimento.tipoAtendimento,
      procedureCodes: (procedimentos.itens || []).map(p => p.code),
      atendimento,
      desfechoGestacional,
      dadosAtendimento,
      exameFisico,
      conduta,
      procedimentos,
    },
  };
}
