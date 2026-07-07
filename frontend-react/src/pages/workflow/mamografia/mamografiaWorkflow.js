import MamografiaIdentStep from "./MamografiaIdentStep";
import ImagemStep from "./ImagemStep";
import MamasStep from "./MamasStep";
import ClassificacaoStep from "./ClassificacaoStep";
import MamografiaCondutaStep from "./MamografiaCondutaStep";
import DiagnosticosStep from "../steps/DiagnosticosStep";
import ProcedimentosStep from "../steps/ProcedimentosStep";
import DocumentosStep from "../steps/DocumentosStep";
import MamografiaFinalizacaoStep from "./MamografiaFinalizacaoStep";

export const MAMOGRAFIA_STEPS = [
  { id: "identificacao",  label: "Identificação",  component: MamografiaIdentStep },
  { id: "imagem",         label: "Imagem",          component: ImagemStep },
  { id: "mamas",          label: "Mamas",           component: MamasStep },
  { id: "classificacao",  label: "Classificação",   component: ClassificacaoStep },
  { id: "conduta",        label: "Conduta",         component: MamografiaCondutaStep },
  { id: "diagnosticos",   label: "Diagnóstico",     component: DiagnosticosStep },
  { id: "procedimentos",  label: "Procedimentos",   component: ProcedimentosStep },
  { id: "documentos",     label: "Documentos",      component: DocumentosStep },
  { id: "finalizacao",    label: "Finalização",     component: MamografiaFinalizacaoStep },
];

export const EMPTY_MAMOGRAFIA = {
  identificacao: {
    dataAtendimento: "",
    horaAtendimento: "",
    carater: "",
    linhaCuidado: "rastreamento_mama",
    localAtendimento: "ubs",
    tipoAtendimento: "",
    profissionalId: "",
    dataColeta: "",
  },
  imagem: {
    pele: "",
    tipoMama: "",
    noduloIdentificado: "",
    microcalcificacaoIdentificada: "",
    assimetriaFocalIdentificada: "",
    assimetriaDifusaIdentificada: "",
    linfonodosAxilares: "",
  },
  mamas: {
    mamaDireita: [],
    mamaEsquerda: [],
  },
  classificacao: {
    birads: "",
    ultrassonografia: "",
    problemasCondicoes: [],
  },
  conduta: {
    orientacao: "",
    desfecho: [],
    encaminhamentoInternoDestino: "",
    observacoes: "",
  },
  diagnosticos: { itens: [], principalCode: "", linhaCuidado: "" },
  procedimentos: { itens: [], dataColeta: "", responsavelId: "", siscan: false },
  documentos: { arquivos: [], observacoes: "" },
};

export function buildMamografiaRecord(formData, patient, users) {
  const { identificacao = {}, imagem = {}, mamas = {}, classificacao = {}, conduta = {}, diagnosticos = {}, procedimentos = {}, documentos = {} } = formData;

  const prof = users?.find(u => u.id === identificacao.profissionalId);
  const profName = prof ? (prof.name || prof.username) : "";

  const biradLbl = {
    "0": "BI-RADS 0 (Inconclusivo)", "1": "BI-RADS 1 (Sem achados)", "2": "BI-RADS 2 (Benignos)",
    "3": "BI-RADS 3 (Provavelmente benignos)", "4": "BI-RADS 4 (Suspeitos)", "5": "BI-RADS 5 (Altamente suspeitos)", "6": "BI-RADS 6 (Câncer comprovado)",
  };

  const detailParts = [
    classificacao.birads ? biradLbl[classificacao.birads] : "",
    imagem.noduloIdentificado === "sim" ? "Nódulo identificado" : "",
    imagem.microcalcificacaoIdentificada === "sim" ? "Microcalcificação identificada" : "",
    (conduta.desfecho || []).length ? `Conduta: ${conduta.desfecho.join(", ")}` : "",
  ].filter(Boolean).join(" · ");

  return {
    type: "nursing",
    title: "Resultado de Mamografia",
    date: identificacao.dataAtendimento || new Date().toISOString().slice(0, 10),
    details: detailParts || "Resultado de mamografia registrado",
    metadata: {
      subtype: "mamografia",
      workflow: "mamografia_v1",
      birads: classificacao.birads,
      tipoAtendimento: identificacao.tipoAtendimento,
      localAtendimento: identificacao.localAtendimento,
      professionalId: identificacao.profissionalId,
      professionalName: profName,
      procedureCodes: (procedimentos.itens || []).map(p => p.code),
      identificacao,
      imagem,
      mamas,
      classificacao,
      conduta,
      diagnosticos,
      procedimentos,
      documentos,
    },
  };
}
