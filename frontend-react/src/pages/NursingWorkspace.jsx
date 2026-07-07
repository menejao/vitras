import { useState } from "react";
import { Tabs, Tab } from "../components/ui/Tabs";
import PapanicolauForm from "./PapanicolauForm";

const NURSING_TABS = [
  { id: "papanicolau", label: "Papanicolau" },
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
  const [activeTab, setActiveTab] = useState("papanicolau");

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
        {activeTab === "papanicolau" && (
          <div className="card" style={{ padding: "var(--s-5)" }}>
            <div style={{ marginBottom: "var(--s-4)" }}>
              <div style={{ fontWeight: 700, fontSize: "var(--t-md)", color: "var(--navy)", marginBottom: 4 }}>
                Coleta de Citopatológico de Colo do Útero
              </div>
              <div className="muted small">
                Paciente: <strong>{patient.name}</strong>
              </div>
            </div>
            <PapanicolauForm
              patient={patient}
              user={user}
              token={token}
              users={users}
              onSuccess={onRecordSaved}
            />
          </div>
        )}

        {activeTab === "pre_natal"    && <PlaceholderTab label="Pré-Natal" />}
        {activeTab === "puericultura" && <PlaceholderTab label="Puericultura" />}
        {activeTab === "curativo"     && <PlaceholderTab label="Curativo" />}
        {activeTab === "consulta"     && <PlaceholderTab label="Consulta de Enfermagem" />}
      </div>
    </div>
  );
}
