import { useState } from "react";
import { Tabs, Tab } from "../components/ui/Tabs";
import WorkflowWizard from "./workflow/WorkflowWizard";
import { PAPANICOLAU_STEPS, EMPTY_PAPANICOLAU, buildPapanicolauRecord } from "./workflow/papanicolau/papanicolauWorkflow";
import { ACOLHIMENTO_STEPS, EMPTY_ACOLHIMENTO, buildAcolhimentoRecord } from "./workflow/acolhimento/acolhimentoWorkflow";
import { api } from "../api.js";

const NURSING_TABS = [
  { id: "acolhimento",  label: "Acolhimento" },
  { id: "papanicolau",  label: "Papanicolau" },
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

function makeEmptyPapanicolau(user) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  return {
    ...EMPTY_PAPANICOLAU,
    atendimento: { ...EMPTY_PAPANICOLAU.atendimento, dataAtendimento: today, horaAtendimento: now, profissionalId: user?.id || "" },
    procedimentos: { ...EMPTY_PAPANICOLAU.procedimentos, dataColeta: today, responsavelId: user?.id || "" },
  };
}

function makeEmptyAcolhimento(user) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  return {
    ...EMPTY_ACOLHIMENTO,
    atendimento: { ...EMPTY_ACOLHIMENTO.atendimento, dataAtendimento: today, horaAtendimento: now, profissionalId: user?.id || "" },
    procedimentos: { ...EMPTY_ACOLHIMENTO.procedimentos, dataColeta: today, responsavelId: user?.id || "" },
  };
}

function useWorkflowState(user, makeEmpty) {
  const [formData, setFormData] = useState(() => makeEmpty(user));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  return { formData, setFormData, busy, setBusy, err, setErr, saved, setSaved };
}

export default function NursingWorkspace({ patient, user, token, users, onRecordSaved }) {
  const [activeTab, setActiveTab] = useState("acolhimento");

  const pap = useWorkflowState(user, makeEmptyPapanicolau);
  const acol = useWorkflowState(user, makeEmptyAcolhimento);

  async function submitWorkflow(buildRecord, state, makeEmpty) {
    state.setBusy(true);
    state.setErr("");
    try {
      const record = buildRecord(state.formData, patient, users);
      await api(`/patients/${patient.id}/records`, {
        method: "POST",
        body: JSON.stringify(record),
      }, token);
      state.setSaved(true);
      onRecordSaved?.();
      state.setFormData(makeEmpty(user));
    } catch (e) {
      state.setErr(e?.message || "Erro ao salvar atendimento.");
    } finally {
      state.setBusy(false);
    }
  }

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
        {activeTab === "acolhimento" && (
          <WorkflowWizard
            steps={ACOLHIMENTO_STEPS}
            formData={acol.formData}
            onChange={acol.setFormData}
            onSubmit={() => submitWorkflow(buildAcolhimentoRecord, acol, makeEmptyAcolhimento)}
            busy={acol.busy}
            error={acol.err}
            saved={acol.saved}
            onDismissSaved={() => acol.setSaved(false)}
            patient={patient}
            user={user}
            token={token}
            users={users}
          />
        )}
        {activeTab === "papanicolau" && (
          <WorkflowWizard
            steps={PAPANICOLAU_STEPS}
            formData={pap.formData}
            onChange={pap.setFormData}
            onSubmit={() => submitWorkflow(buildPapanicolauRecord, pap, makeEmptyPapanicolau)}
            busy={pap.busy}
            error={pap.err}
            saved={pap.saved}
            onDismissSaved={() => pap.setSaved(false)}
            patient={patient}
            user={user}
            token={token}
            users={users}
          />
        )}
        {activeTab === "pre_natal"    && <PlaceholderTab label="Pré-Natal" />}
        {activeTab === "puericultura" && <PlaceholderTab label="Puericultura" />}
        {activeTab === "curativo"     && <PlaceholderTab label="Curativo" />}
        {activeTab === "consulta"     && <PlaceholderTab label="Consulta de Enfermagem" />}
      </div>
    </div>
  );
}
