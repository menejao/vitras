import { useState } from "react";
import { Tabs, Tab } from "../components/ui/Tabs";
import AcolhimentoForm from "./AcolhimentoForm";
import PapanicolauForm from "./PapanicolauForm";
import MamografiaForm from "./MamografiaForm";
import PuerperioForm from "./PuerperioForm";
import ConsultaEnfermagemForm from "./ConsultaEnfermagemForm";
import PreNatalForm from "./PreNatalForm";

const NURSING_TABS = [
  { id: "acolhimento",  label: "Acolhimento" },
  { id: "papanicolau",  label: "Papanicolau" },
  { id: "mamografia",   label: "Resultado de Mamografia" },
  { id: "puerperio",    label: "Puerpério" },
  { id: "pre_natal",    label: "Pré-Natal" },
  { id: "puericultura", label: "Puericultura" },
  { id: "curativo",     label: "Curativo" },
  { id: "consulta",     label: "Consulta de Enfermagem" },
];

function PlaceholderTab({ label }) {
  return (
    <div className="empty" style={{ padding: "3rem 2rem" }}>
      <div className="empty__icon empty__icon--neutral">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      </div>
      <h3 className="empty__title">{label} em preparação</h3>
      <p className="empty__desc">Este módulo estará disponível em próxima sprint.</p>
    </div>
  );
}

export default function NursingWorkspace({ patient, user, token, users, onRecordSaved }) {
  const [activeTab, setActiveTab] = useState("acolhimento");

  const sharedProps = { patient, user, token, users, onRecordSaved };

  return (
    <div className="nursing-workspace">
      <div className="nursing-workspace__tabs">
        <Tabs>
          {NURSING_TABS.map(t => (
            <Tab key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)}>{t.label}</Tab>
          ))}
        </Tabs>
      </div>

      <div className="nursing-workspace__body">
        {activeTab === "acolhimento"  && <AcolhimentoForm  key="acol" {...sharedProps} />}
        {activeTab === "papanicolau"  && <PapanicolauForm  key="pap"  {...sharedProps} />}
        {activeTab === "mamografia"   && <MamografiaForm   key="mamo" {...sharedProps} />}
        {activeTab === "puerperio"    && <PuerperioForm    key="puer" {...sharedProps} />}
        {activeTab === "pre_natal"    && <PreNatalForm    key="pn"   {...sharedProps} />}
        {activeTab === "puericultura" && <PlaceholderTab label="Puericultura" />}
        {activeTab === "curativo"     && <PlaceholderTab label="Curativo" />}
        {activeTab === "consulta"     && <ConsultaEnfermagemForm key="cons" {...sharedProps} />}
      </div>
    </div>
  );
}
