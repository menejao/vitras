import { roleLabel } from "../utils/roles";
import Button from "./ui/Button";
import Modal from "./ui/Modal";
import { BrandMark } from "./brand/BrandMark";

const IconPrint = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="5" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4 5V3h8v2M4 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

function DocHeader({ title }) {
  return (
    <div className="doc-header">
      <div className="doc-header__logo">
        <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BrandMark variant="mono-white" size={20} />
        </div>
        <div>
          <div className="doc-header__org">Unidade Básica de Saúde</div>
          <div className="doc-header__city">Sistema de Saúde Municipal</div>
        </div>
      </div>
      <div className="doc-header__title">{title}</div>
    </div>
  );
}

function DocField({ label, value, wide }) {
  return (
    <div className={`doc-field${wide ? " doc-field--wide" : ""}`}>
      <span className="doc-field__label">{label}</span>
      <span className="doc-field__value">{value || "—"}</span>
    </div>
  );
}

function DocSignature({ user }) {
  const council = user?.councilNumber
    ? `${user.councilType || "CRM"} ${user.councilNumber}${user.councilUf ? "/" + user.councilUf : ""}`
    : null;
  return (
    <div className="doc-signature">
      <div className="doc-signature__line" />
      <div className="doc-signature__name">{user?.name || "Profissional de Saúde"}</div>
      {council && <div className="doc-signature__council">{council}</div>}
      <div className="doc-signature__role">{roleLabel(user?.role) || "Profissional"}</div>
    </div>
  );
}

function AtestadoDoc({ patient, user }) {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const cpfLine = patient?.cpf ? `, CPF ${patient.cpf}` : "";
  const cnsLine = patient?.cns ? `, CNS ${patient.cns}` : "";

  return (
    <div className="doc-body" id="print-doc">
      <DocHeader title="ATESTADO MÉDICO" />

      <div className="doc-section">
        <p className="doc-text">
          Atesto, para os devidos fins, que o(a) paciente{" "}
          <strong>{patient?.name || "—"}</strong>
          {cpfLine}{cnsLine}, encontra-se sob meus cuidados médicos,
          necessitando de{" "}
          <span className="doc-fill">________ (________) dia(s)</span>{" "}
          de repouso, a partir de <strong>{today}</strong>.
        </p>

        <p className="doc-text doc-text--muted">
          CID: <span className="doc-fill">________________</span>
          {"  "}|{"  "}
          Diagnóstico: <span className="doc-fill">_________________________________</span>
        </p>

        <p className="doc-text">Por ser verdade, firmo o presente atestado.</p>
      </div>

      <div className="doc-footer">
        <div className="doc-footer__place">
          Local/Data: <span className="doc-fill">_________________, {today}</span>
        </div>
        <DocSignature user={user} />
      </div>
    </div>
  );
}

function DeclaracaoDoc({ patient, user }) {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const cpfLine = patient?.cpf ? `, CPF ${patient.cpf}` : "";
  const cnsLine = patient?.cns ? `, CNS ${patient.cns}` : "";

  return (
    <div className="doc-body" id="print-doc">
      <DocHeader title="DECLARAÇÃO DE COMPARECIMENTO" />

      <div className="doc-section">
        <p className="doc-text">
          Declaramos que o(a) Sr.(a){" "}
          <strong>{patient?.name || "—"}</strong>
          {cpfLine}{cnsLine}, compareceu a esta Unidade Básica de Saúde no dia{" "}
          <strong>{today}</strong>, no horário das{" "}
          <span className="doc-fill">____h____min</span> às{" "}
          <span className="doc-fill">____h____min</span>,
          para fins de atendimento de saúde.
        </p>

        <div className="doc-grid">
          <DocField label="Motivo do atendimento" value="" wide />
          <DocField label="Setor / Especialidade" value="" />
          <DocField label="Número de atendimento" value="" />
        </div>

        <p className="doc-text">Por ser verdade, firmo a presente declaração.</p>
      </div>

      <div className="doc-footer">
        <div className="doc-footer__place">
          Local/Data: <span className="doc-fill">_________________, {today}</span>
        </div>
        <DocSignature user={user} />
      </div>
    </div>
  );
}

function DocumentModal({ patient, user, type, onClose }) {
  const isAtestado = type === "atestado";
  const title = isAtestado ? "Atestado Médico" : "Declaração de Comparecimento";

  return (
    <Modal
      title={title}
      onClose={onClose}
      className="modal--wide"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <IconPrint /> Imprimir
          </Button>
          <Button onClick={() => window.print()}>
            <IconDownload /> Salvar PDF
          </Button>
        </>
      }
    >
      {isAtestado
        ? <AtestadoDoc patient={patient} user={user} />
        : <DeclaracaoDoc patient={patient} user={user} />
      }
    </Modal>
  );
}

export default DocumentModal;
