import SpecialtyPage from "./SpecialtyPage";

const ICON = <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" opacity=".25"/><path d="M16 10a6 6 0 110 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M13 16h6M16 13v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;

const CONFIG = {
  label: "Psicologia",
  description: "Atendimento psicológico",
  consultKind: "psicologia",
  recordTitle: "Atendimento de psicologia",
  historyKeyword: "psico",
  icon: ICON,
  fields: [
    { key: "modalidade", label: "Modalidade", type: "select", options: [
      { value: "individual", label: "Individual" },
      { value: "grupo", label: "Grupo" },
      { value: "familia", label: "Família" },
    ]},
    { key: "risco_psicossocial", label: "Risco psicossocial", type: "select", options: [
      { value: "baixo", label: "Baixo" },
      { value: "moderado", label: "Moderado" },
      { value: "alto", label: "Alto" },
      { value: "crise", label: "Crise" },
    ]},
    { key: "queixa_principal", label: "Queixa principal", type: "textarea", span: 2, placeholder: "Motivo do atendimento..." },
    { key: "evolucao", label: "Evolução clínica", type: "textarea", span: 2, placeholder: "Evolução desde último atendimento..." },
    { key: "plano_terapeutico", label: "Plano terapêutico", type: "textarea", span: 2, placeholder: "Objetivos e abordagem..." },
    { key: "encaminhamentos", label: "Encaminhamentos", type: "textarea", span: 2, placeholder: "Serviços ou recursos acionados..." },
  ],
};

export default function PsicologiaPage({ patients, user, token }) {
  return <SpecialtyPage config={CONFIG} patients={patients} user={user} token={token} />;
}
