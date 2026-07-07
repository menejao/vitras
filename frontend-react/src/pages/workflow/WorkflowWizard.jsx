import { useState } from "react";
import Button from "../../components/ui/Button";

export default function WorkflowWizard({
  steps, formData, onChange, onSubmit,
  busy, error, saved, onDismissSaved,
  patient, user, token, users,
}) {
  const [current, setCurrent] = useState(0);

  function updateStep(stepId, data) {
    onChange({ ...formData, [stepId]: data });
  }

  function goTo(i) {
    if (i >= 0 && i < steps.length) setCurrent(i);
  }

  const step = steps[current];
  const StepComponent = step.component;
  const isLast = current === steps.length - 1;

  return (
    <div className="wf-wizard">
      {/* Step nav */}
      <div className="wf-steps">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`wf-step${i === current ? " is-active" : ""}${i < current ? " is-done" : ""}`}
            onClick={() => setCurrent(i)}
          >
            <span className="wf-step__num">
              {i < current ? (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : i + 1}
            </span>
            <span className="wf-step__label">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Step body */}
      <div className="wf-body card" style={{ padding: "var(--s-5)" }}>
        <div className="wf-body__header">
          <div className="wf-body__step-label muted small">Etapa {current + 1} de {steps.length}</div>
          <div className="wf-body__step-title">{step.label}</div>
        </div>

        {saved && (
          <div className="alert alert--success" style={{ marginBottom: "var(--s-4)" }}>
            Atendimento salvo com sucesso. Disponível no Histórico e Prontuário do paciente.
            <button type="button" className="alert__close" onClick={onDismissSaved} style={{ marginLeft: "var(--s-3)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
          </div>
        )}
        {error && (
          <div className="alert alert--danger" style={{ marginBottom: "var(--s-4)" }}>{error}</div>
        )}

        <StepComponent
          data={formData[step.id] || {}}
          onChange={(data) => updateStep(step.id, data)}
          formData={formData}
          patient={patient}
          user={user}
          token={token}
          users={users}
          onSubmit={onSubmit}
          busy={busy}
        />
      </div>

      {/* Footer nav */}
      <div className="wf-footer">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          disabled={current === 0}
          onClick={() => goTo(current - 1)}
        >
          ← Anterior
        </Button>
        <div style={{ flex: 1 }} />
        {!isLast && (
          <Button variant="primary" size="sm" type="button" onClick={() => goTo(current + 1)}>
            Próximo →
          </Button>
        )}
        {isLast && (
          <Button variant="primary" size="sm" type="button" onClick={onSubmit} loading={busy} disabled={busy}>
            Confirmar e Salvar
          </Button>
        )}
      </div>
    </div>
  );
}
