import SpecialtyPage from "./SpecialtyPage";

const ICON = <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" opacity=".25"/><path d="M10 22c0-4 3-8 6-10M22 10c-2 3-6 6-6 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M16 10c0 2-1.5 4-3 6s3 4 3 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;

const CONFIG = {
  label: "Nutrição",
  description: "Atendimento nutricional",
  consultKind: "nutricao",
  recordTitle: "Atendimento nutricional",
  historyKeyword: "nutri",
  icon: ICON,
  fields: [
    { key: "peso", label: "Peso (kg)", type: "text", placeholder: "Ex.: 68.5" },
    { key: "altura", label: "Altura (cm)", type: "text", placeholder: "Ex.: 165" },
    { key: "imc", label: "IMC", type: "text", placeholder: "Calculado ou informado" },
    { key: "circunf_abdominal", label: "Circunferência abdominal (cm)", type: "text" },
    { key: "habitos_alimentares", label: "Hábitos alimentares", type: "textarea", span: 2, placeholder: "Descrever padrão alimentar..." },
    { key: "recordatorio", label: "Recordatório alimentar (24h)", type: "textarea", span: 2, placeholder: "Refeições do dia anterior..." },
    { key: "metas_nutricionais", label: "Metas nutricionais", type: "textarea", span: 2, placeholder: "Metas definidas para o paciente..." },
  ],
};

export default function NutricaoPage({ patients, user, token }) {
  return <SpecialtyPage config={CONFIG} patients={patients} user={user} token={token} />;
}
