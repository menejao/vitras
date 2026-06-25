import SpecialtyPage from "./SpecialtyPage";

const ICON = <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" opacity=".25"/><path d="M12 22l4-10 4 10M13.5 19h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;

const CONFIG = {
  label: "Fisioterapia",
  description: "Atendimento fisioterapêutico",
  consultKind: "fisioterapia",
  recordTitle: "Atendimento fisioterapêutico",
  historyKeyword: "fisio",
  icon: ICON,
  fields: [
    { key: "dor_escala", label: "Dor (EVA 0-10)", type: "text", placeholder: "0 = sem dor, 10 = máxima" },
    { key: "forca_muscular", label: "Força muscular", type: "select", options: [
      { value: "grau_0", label: "Grau 0 — sem contração" },
      { value: "grau_1", label: "Grau 1 — contração visível" },
      { value: "grau_2", label: "Grau 2 — movimento sem gravidade" },
      { value: "grau_3", label: "Grau 3 — contra gravidade" },
      { value: "grau_4", label: "Grau 4 — resistência parcial" },
      { value: "grau_5", label: "Grau 5 — normal" },
    ]},
    { key: "mobilidade", label: "Mobilidade / ADM", type: "textarea", placeholder: "Amplitude de movimento avaliada..." },
    { key: "limitacao_funcional", label: "Limitação funcional", type: "textarea", span: 2, placeholder: "Atividades limitadas..." },
    { key: "exercicios", label: "Exercícios prescritos", type: "textarea", span: 2, placeholder: "Protocolo de exercícios..." },
    { key: "plano_terapeutico", label: "Plano terapêutico", type: "textarea", span: 2, placeholder: "Frequência, objetivos, evolução esperada..." },
  ],
};

export default function FisioterapiaPage({ patients, user, token }) {
  return <SpecialtyPage config={CONFIG} patients={patients} user={user} token={token} />;
}
