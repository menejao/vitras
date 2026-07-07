import AcolhimentoAtendimentoStep from "./AcolhimentoAtendimentoStep";
import AvaliacaoStep from "./AvaliacaoStep";
import MedicoesStep from "./MedicoesStep";
import ClassificacaoCondutaStep from "./ClassificacaoCondutaStep";
import DiagnosticosStep from "../steps/DiagnosticosStep";
import ProcedimentosStep from "../steps/ProcedimentosStep";
import DocumentosStep from "../steps/DocumentosStep";
import AcolhimentoFinalizacaoStep from "./AcolhimentoFinalizacaoStep";

export const ACOLHIMENTO_STEPS = [
  { id: "atendimento",         label: "Atendimento",      component: AcolhimentoAtendimentoStep },
  { id: "avaliacao",           label: "Avaliação",        component: AvaliacaoStep },
  { id: "medicoes",            label: "Medições",         component: MedicoesStep },
  { id: "classificacaoConduta",label: "Classificação",    component: ClassificacaoCondutaStep },
  { id: "diagnosticos",        label: "Diagnóstico",      component: DiagnosticosStep },
  { id: "procedimentos",       label: "Procedimentos",    component: ProcedimentosStep },
  { id: "documentos",          label: "Documentos",       component: DocumentosStep },
  { id: "finalizacao",         label: "Finalização",      component: AcolhimentoFinalizacaoStep },
];

export const EMPTY_ACOLHIMENTO = {
  atendimento: {
    dataAtendimento: "",
    horaAtendimento: "",
    carater: "demanda_espontanea",
    linhaCuidado: "",
    localAtendimento: "ubs",
    tipoAtendimento: "demanda_espontanea_escuta_orientacao",
    profissionalId: "",
  },
  avaliacao: {
    motivoConsulta: "",
    problemasCondicoes: [],
  },
  medicoes: {
    peso: "",
    altura: "",
    imc: "",
    afericaoPA: "",
    pressaoArterial: "",
    frequenciaCardiaca: "",
    frequenciaRespiratoria: "",
    temperatura: "",
    saturacaoO2: "",
    glicemiaCapilar: "",
    momentoGlicemia: "",
  },
  classificacaoConduta: {
    classificacaoRisco: "",
    condutaDesfecho: [],
    observacoes: "",
  },
  diagnosticos: {
    itens: [],
    principalCode: "",
    linhaCuidado: "",
  },
  procedimentos: {
    itens: [],
    dataColeta: "",
    responsavelId: "",
    siscan: false,
  },
  documentos: {
    arquivos: [],
    observacoes: "",
  },
};

export function buildAcolhimentoRecord(formData, patient, users) {
  const {
    atendimento = {}, avaliacao = {}, medicoes = {},
    classificacaoConduta = {}, diagnosticos = {},
    procedimentos = {}, documentos = {},
  } = formData;

  const prof = users?.find(u => u.id === atendimento.profissionalId);
  const profName = prof ? (prof.name || prof.username) : "";

  const detailParts = [
    avaliacao.motivoConsulta ? `Motivo: ${avaliacao.motivoConsulta}` : "Demanda espontânea",
    classificacaoConduta.classificacaoRisco ? `Risco: ${classificacaoConduta.classificacaoRisco}` : "",
    (avaliacao.problemasCondicoes || []).length ? `Condições: ${avaliacao.problemasCondicoes.join(", ")}` : "",
    (classificacaoConduta.condutaDesfecho || []).length ? `Conduta: ${classificacaoConduta.condutaDesfecho.join(", ")}` : "",
  ].filter(Boolean).join(" · ");

  return {
    type: "nursing",
    title: "Acolhimento — Demanda Espontânea (Escuta Inicial / Orientação)",
    date: atendimento.dataAtendimento || new Date().toISOString().slice(0, 10),
    details: detailParts,
    metadata: {
      subtype: "acolhimento",
      workflow: "acolhimento_v1",
      tipoAtendimento: "demanda_espontanea_escuta_orientacao",
      carater: "demanda_espontanea",
      localAtendimento: atendimento.localAtendimento,
      professionalId: atendimento.profissionalId,
      professionalName: profName,
      classificacaoRisco: classificacaoConduta.classificacaoRisco,
      condutaDesfecho: classificacaoConduta.condutaDesfecho,
      problemasCondicoes: avaliacao.problemasCondicoes,
      procedureCodes: (procedimentos.itens || []).map(p => p.code),
      antropometria: {
        peso: medicoes.peso,
        altura: medicoes.altura,
        imc: medicoes.imc,
      },
      sinaisVitais: {
        pressaoArterial: medicoes.pressaoArterial,
        frequenciaCardiaca: medicoes.frequenciaCardiaca,
        frequenciaRespiratoria: medicoes.frequenciaRespiratoria,
        temperatura: medicoes.temperatura,
        saturacaoO2: medicoes.saturacaoO2,
      },
      glicemia: {
        valor: medicoes.glicemiaCapilar,
        momento: medicoes.momentoGlicemia,
      },
      atendimento,
      avaliacao,
      medicoes,
      classificacaoConduta,
      diagnosticos,
      procedimentos,
      documentos,
    },
  };
}
