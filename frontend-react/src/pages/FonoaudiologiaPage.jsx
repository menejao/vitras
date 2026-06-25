import SpecialtyPage from "./SpecialtyPage";

const ICON = <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" opacity=".25"/><path d="M11 16s1-4 5-4 5 4 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M16 20v-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="16" cy="21.5" r="1.5" fill="currentColor" opacity=".5"/></svg>;

const CONFIG = {
  label: "Fonoaudiologia",
  description: "Atendimento fonoaudiológico",
  consultKind: "fonoaudiologia",
  recordTitle: "Atendimento fonoaudiológico",
  historyKeyword: "fono",
  icon: ICON,
  fields: [
    { key: "area_avaliada", label: "Área avaliada", type: "select", options: [
      { value: "linguagem", label: "Linguagem" },
      { value: "fala", label: "Fala e voz" },
      { value: "audicao", label: "Audição" },
      { value: "degluticao", label: "Deglutição" },
      { value: "comunicacao", label: "Comunicação alternativa" },
    ]},
    { key: "nivel_comunicacao", label: "Nível de comunicação", type: "select", options: [
      { value: "preservado", label: "Preservado" },
      { value: "comprometido_leve", label: "Comprometido — leve" },
      { value: "comprometido_moderado", label: "Comprometido — moderado" },
      { value: "comprometido_grave", label: "Comprometido — grave" },
    ]},
    { key: "avaliacao_clinica", label: "Avaliação clínica", type: "textarea", span: 2, placeholder: "Achados da avaliação fonoaudiológica..." },
    { key: "degluticao_obs", label: "Deglutição / alimentação", type: "textarea", span: 2, placeholder: "Consistências toleradas, riscos de aspiração..." },
    { key: "plano_terapeutico", label: "Plano terapêutico", type: "textarea", span: 2, placeholder: "Objetivos, frequência, abordagem..." },
  ],
};

export default function FonoaudiologiaPage({ patients, user, token }) {
  return <SpecialtyPage config={CONFIG} patients={patients} user={user} token={token} />;
}
