import SpecialtyPage from "./SpecialtyPage";

const ICON = <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" opacity=".25"/><circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.3"/><circle cx="20" cy="13" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M8 23c0-2.2 1.8-4 4-4h8c2.2 0 4 1.8 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;

const CONFIG = {
  label: "Serviço Social",
  description: "Atendimento socioassistencial",
  consultKind: "servico_social",
  recordTitle: "Atendimento de serviço social",
  historyKeyword: "social",
  icon: ICON,
  fields: [
    { key: "demanda_social", label: "Demanda social", type: "textarea", span: 2, placeholder: "Motivo do encaminhamento / demanda apresentada..." },
    { key: "vulnerabilidades", label: "Vulnerabilidades identificadas", type: "textarea", span: 2, placeholder: "Situações de risco, vulnerabilidade social..." },
    { key: "beneficios", label: "Benefícios / programas sociais", type: "textarea", placeholder: "Bolsa Família, BPC, CRAS, CREAS..." },
    { key: "rede_apoio", label: "Rede de apoio", type: "textarea", placeholder: "Família, comunidade, serviços..." },
    { key: "encaminhamentos", label: "Encaminhamentos realizados", type: "textarea", span: 2, placeholder: "Serviços acionados ou encaminhados..." },
    { key: "parecer_social", label: "Parecer social", type: "textarea", span: 2, placeholder: "Análise e posicionamento técnico..." },
  ],
};

export default function ServicoSocialPage({ patients, user, token }) {
  return <SpecialtyPage config={CONFIG} patients={patients} user={user} token={token} />;
}
