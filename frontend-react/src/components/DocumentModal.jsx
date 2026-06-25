import { useState } from "react";
import { roleLabel } from "../utils/roles";
import { maskCpf } from "../utils/formatting";
import Button from "./ui/Button";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import Textarea from "./ui/Textarea";

const IconPrint = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="5" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4 5V3h8v2M4 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

function getCouncilText(user) {
  if (!user?.councilNumber) return null;
  return `${user.councilType || "CRM"} ${user.councilNumber}${user.councilUf ? "/" + user.councilUf : ""}`;
}

function DocHeader({ title }) {
  return (
    <div className="doc-header">
      <div className="doc-header__logo">
        <div>
          <div className="doc-header__org">Unidade Básica de Saúde</div>
          <div className="doc-header__city">Sistema Municipal de Saúde</div>
        </div>
      </div>
      <div className="doc-header__title">{title}</div>
    </div>
  );
}

function DocSignature({ user }) {
  const council = getCouncilText(user);
  return (
    <div className="doc-signature">
      <div className="doc-signature__line" />
      <div className="doc-signature__name">{user?.name || "Profissional de Saúde"}</div>
      {council && <div className="doc-signature__council">{council}</div>}
      <div className="doc-signature__role">{roleLabel(user?.role) || "Profissional"}</div>
    </div>
  );
}

function DeclaracaoDoc({ patient, user }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const council = getCouncilText(user);
  const cpfMasked = patient?.cpf ? maskCpf(patient.cpf) : null;

  return (
    <div className="doc-body" id="print-doc">
      <DocHeader title="DECLARAÇÃO DE COMPARECIMENTO" />

      <div className="doc-section">
        <p className="doc-text">
          Declaramos que o(a) Sr.(a){" "}
          <strong>{patient?.name || "—"}</strong>
          {cpfMasked ? `, portador(a) do CPF ${cpfMasked}` : ""}
          {patient?.cns ? `, CNS ${patient.cns}` : ""}
          , compareceu a esta Unidade Básica de Saúde no dia{" "}
          <strong>{dateStr}</strong>, às <strong>{timeStr}h</strong>,
          para fins de atendimento de saúde no âmbito do Sistema Único de Saúde (SUS).
        </p>

        <p className="doc-text">
          Profissional responsável:{" "}
          <strong>{user?.name || "—"}</strong>
          {council ? ` · ${council}` : ""}
          {user?.role ? ` · ${roleLabel(user.role)}` : ""}
        </p>

        <p className="doc-text">Por ser verdade, firmo a presente declaração.</p>
      </div>

      <div className="doc-footer">
        <div className="doc-footer__place">
          Emitido em {dateStr}, às {timeStr}h
        </div>
        <DocSignature user={user} />
      </div>
    </div>
  );
}

function AtestadoDoc({ patient, user, days, cid, diagnostico }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const council = getCouncilText(user);
  const cpfMasked = patient?.cpf ? maskCpf(patient.cpf) : null;

  return (
    <div className="doc-body" id="print-doc">
      <DocHeader title="ATESTADO MÉDICO" />

      <div className="doc-section">
        <p className="doc-text">
          Atesto, para os devidos fins, que o(a) paciente{" "}
          <strong>{patient?.name || "—"}</strong>
          {cpfMasked ? `, CPF ${cpfMasked}` : ""}
          {patient?.cns ? `, CNS ${patient.cns}` : ""}
          , esteve sob atendimento nesta unidade de saúde e necessita de afastamento de suas atividades habituais por{" "}
          <strong>{days ? `${days} (${days === "1" ? "um" : days}) dia${days === "1" ? "" : "s"}` : "_____ dia(s)"}</strong>,
          a partir de <strong>{dateStr}</strong>.
        </p>

        {(cid || diagnostico) && (
          <p className="doc-text doc-text--muted">
            {cid && <><strong>CID-10:</strong> {cid}{diagnostico ? "  —  " : ""}</>}
            {diagnostico && <><strong>Diagnóstico:</strong> {diagnostico}</>}
          </p>
        )}

        <p className="doc-text">
          Profissional responsável:{" "}
          <strong>{user?.name || "—"}</strong>
          {council ? ` · ${council}` : ""}
          {user?.role ? ` · ${roleLabel(user.role)}` : ""}
        </p>

        <p className="doc-text">Por ser verdade, firmo o presente atestado.</p>
      </div>

      <div className="doc-footer">
        <div className="doc-footer__place">
          Emitido em {dateStr}, às {timeStr}h
        </div>
        <DocSignature user={user} />
      </div>
    </div>
  );
}

function DocumentModal({ patient, user, type, onClose }) {
  const isAtestado = type === "atestado";
  const title = isAtestado ? "Atestado Médico" : "Declaração de Comparecimento";

  const [days, setDays] = useState("");
  const [cid, setCid] = useState("");
  const [diagnostico, setDiagnostico] = useState("");

  return (
    <Modal
      title={title}
      onClose={onClose}
      className="modal--wide"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
          <Button onClick={() => window.print()}>
            <IconPrint /> Imprimir
          </Button>
        </>
      }
    >
      {isAtestado && (
        <div className="doc-form-inputs">
          <Input
            label="Dias de afastamento"
            type="number"
            min="1"
            max="365"
            value={days}
            onChange={e => setDays(e.target.value)}
            placeholder="Ex: 3"
          />
          <Input
            label="CID-10 (opcional)"
            value={cid}
            onChange={e => setCid(e.target.value.toUpperCase())}
            placeholder="Ex: J06.9"
          />
          <Textarea
            label="Diagnóstico (opcional)"
            rows={2}
            value={diagnostico}
            onChange={e => setDiagnostico(e.target.value)}
            placeholder="Infecção respiratória aguda…"
          />
        </div>
      )}
      {isAtestado
        ? <AtestadoDoc patient={patient} user={user} days={days} cid={cid} diagnostico={diagnostico} />
        : <DeclaracaoDoc patient={patient} user={user} />
      }
    </Modal>
  );
}

export default DocumentModal;
