import SpecialtyPage from "./SpecialtyPage";

const ICON = <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" opacity=".25"/><path d="M10 16c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M13 16h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;

const CONFIG = {
  label: "Terapia Ocupacional",
  description: "Atendimento em terapia ocupacional",
  consultKind: "terapia_ocupacional",
  recordTitle: "Atendimento de terapia ocupacional",
  historyKeyword: "terapia",
  icon: ICON,
  fields: [
    { key: "nivel_funcionalidade", label: "Nível de funcionalidade", type: "select", options: [
      { value: "independente", label: "Independente" },
      { value: "assistencia_minima", label: "Assistência mínima" },
      { value: "assistencia_moderada", label: "Assistência moderada" },
      { value: "assistencia_maxima", label: "Assistência máxima" },
      { value: "dependente", label: "Dependente total" },
    ]},
    { key: "autonomia", label: "Autonomia e independência", type: "textarea", placeholder: "Capacidade de decisão e autocuidado..." },
    { key: "avd", label: "Atividades de vida diária (AVD)", type: "textarea", span: 2, placeholder: "Banho, alimentação, vestuário, locomoção..." },
    { key: "barreiras", label: "Barreiras identificadas", type: "textarea", span: 2, placeholder: "Ambientais, funcionais, sociais..." },
    { key: "evolucao", label: "Evolução", type: "textarea", span: 2, placeholder: "Progresso desde último atendimento..." },
    { key: "plano_terapeutico", label: "Plano terapêutico", type: "textarea", span: 2, placeholder: "Objetivos e estratégias de intervenção..." },
  ],
};

export default function TerapiaOcupacionalPage({ patients, user, token }) {
  return <SpecialtyPage config={CONFIG} patients={patients} user={user} token={token} />;
}
