import AtendimentoStep from "../steps/AtendimentoStep";
import FichaClinicaStep from "./FichaClinicaStep";
import DiagnosticosStep from "../steps/DiagnosticosStep";
import ProcedimentosStep from "../steps/ProcedimentosStep";
import CondutaStep from "../steps/CondutaStep";
import ResultadoStep from "./ResultadoStep";
import DocumentosStep from "../steps/DocumentosStep";
import FinalizacaoStep from "../steps/FinalizacaoStep";

export const PAPANICOLAU_STEPS = [
  { id: "atendimento",  label: "Atendimento",   component: AtendimentoStep },
  { id: "fichaClinica", label: "Ficha Clínica",  component: FichaClinicaStep },
  { id: "diagnosticos", label: "Diagnósticos",   component: DiagnosticosStep },
  { id: "procedimentos",label: "Procedimentos",  component: ProcedimentosStep },
  { id: "conduta",      label: "Conduta",        component: CondutaStep },
  { id: "resultado",    label: "Resultado",      component: ResultadoStep },
  { id: "documentos",   label: "Documentos",     component: DocumentosStep },
  { id: "finalizacao",  label: "Finalização",    component: FinalizacaoStep },
];

export const EMPTY_PAPANICOLAU = {
  atendimento: {
    dataAtendimento: "",
    horaAtendimento: "",
    carater: "eletivo",
    linhaCuidado: "saude_mulher",
    localAtendimento: "ubs",
    tipoAtendimento: "consulta_agendada",
    profissionalId: "",
  },
  fichaClinica: {
    motivoExame: "",
    fezePreventivo: "",
    ultimaColeta: "",
    usaDiu: "",
    estaGravida: "",
    usaAnticoncepcional: "",
    hormonioPosMenuopausa: "",
    realizouRadioterapia: "",
    sangramentoAposRelacao: "",
    sangramentoPosMenuopausa: "",
    dum: "",
    inspecaoColo: "",
    sinaisIst: "",
    siscan: false,
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
  conduta: {
    orientacoes: "",
    retorno: "",
    retornoDias: "",
    encaminhamentos: [],
    observacoes: "",
  },
  resultado: {
    dataColeta: "",
    numeroPedido: "",
    ra: "",
    tipoAmostra: "",
    adequabilidade: "",
    epitelios: [],
    diagnosticoDescritivo: "",
    microbiologia: [],
    observacoes: "",
  },
  documentos: {
    arquivos: [],
    observacoes: "",
  },
};

export function buildPapanicolauRecord(formData, patient, users) {
  const { atendimento = {}, fichaClinica = {}, diagnosticos = {}, procedimentos = {}, conduta = {}, resultado = {}, documentos = {} } = formData;

  const prof = users?.find(u => u.id === atendimento.profissionalId);
  const profName = prof ? (prof.name || prof.username) : "";

  const motivos = { rastreamento: "Rastreamento", repeticao: "Repetição (ASCUS/Baixo grau)", seguimento: "Seguimento (pós colposcopia/tratamento)" };

  const detailParts = [
    fichaClinica.motivoExame ? `Motivo: ${motivos[fichaClinica.motivoExame] || fichaClinica.motivoExame}` : "",
    fichaClinica.inspecaoColo ? `Inspeção colo: ${fichaClinica.inspecaoColo}` : "",
    (procedimentos.itens || []).length ? `Procedimentos: ${procedimentos.itens.map(p => p.name).join(", ")}` : "",
    (diagnosticos.itens || []).length ? `Diagnósticos: ${diagnosticos.itens.map(d => d.code).join(", ")}` : "",
    conduta.retorno ? `Conduta: ${conduta.retorno}` : "",
  ].filter(Boolean).join(" · ");

  return {
    type: "nursing",
    title: "Coleta de Citopatológico de Colo do Útero (Papanicolau)",
    date: atendimento.dataAtendimento || new Date().toISOString().slice(0, 10),
    details: detailParts || "Atendimento de enfermagem — Papanicolau",
    metadata: {
      subtype: "papanicolau",
      workflow: "papanicolau_v2",
      procedureCodes: (procedimentos.itens || []).map(p => p.code),
      professionalId: atendimento.profissionalId,
      professionalName: profName,
      siscan: fichaClinica.siscan || procedimentos.siscan,
      atendimento,
      fichaClinica,
      diagnosticos,
      procedimentos,
      conduta,
      resultado,
      documentos,
    },
  };
}
