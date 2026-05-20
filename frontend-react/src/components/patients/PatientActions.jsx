import { useState } from "react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Textarea from "../ui/Textarea";

const IconView = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M1 8s2.667-5 7-5 7 5 7 5-2.667 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const IconDeactivate = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export default function PatientActions({ patient, onEdit, onView, onDelete }) {
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [justification, setJustification] = useState("");
  const [err, setErr] = useState("");

  function handleConfirm() {
    if (!justification.trim()) {
      setErr("Justificativa e obrigatoria para registrar a desativacao.");
      return;
    }
    onDelete?.({ ...patient, _deactivate: true, _justification: justification.trim() });
    handleClose();
  }

  function handleClose() {
    setShowDeactivate(false);
    setJustification("");
    setErr("");
  }

  function trigger(action, payload = patient) {
    const result = action?.(payload);
    if (typeof result === "function") result();
  }

  return (
    <>
      <div className="patient-actions">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          title="Visualizar"
          aria-label="Visualizar paciente"
          onClick={() => trigger(onView)}
        >
          <IconView />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          title="Editar"
          aria-label="Editar paciente"
          onClick={() => trigger(onEdit)}
        >
          <IconEdit />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          className="patient-actions__deactivate"
          title="Desativar"
          aria-label="Desativar paciente"
          onClick={() => setShowDeactivate(true)}
        >
          <IconDeactivate />
        </Button>
      </div>

      {showDeactivate ? (
        <Modal title="Desativar paciente" onClose={handleClose}>
          <div className="patient-deactivate">
            <div className="patient-deactivate__notice">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="patient-deactivate__icon" aria-hidden="true">
                <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M8 7v3M8 12v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span>
                <strong>{patient.name}</strong> saira da operacao ativa. O historico permanece preservado para auditoria e rastreabilidade.
              </span>
            </div>

            <Textarea
              className="patient-deactivate__textarea"
              label="Justificativa obrigatoria *"
              placeholder="Ex.: transferencia, obito, solicitacao do paciente..."
              value={justification}
              onChange={(event) => {
                setJustification(event.target.value);
                setErr("");
              }}
              rows={3}
              error={err}
            />

            <p className="patient-deactivate__foot">
              Esta acao sera registrada no log de auditoria com data, hora, justificativa e responsavel.
            </p>

            <div className="patient-deactivate__actions">
              <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
              <Button variant="danger" onClick={handleConfirm}>Confirmar desativacao</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
