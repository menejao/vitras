import { calcAge, gestationalAgeInfo } from "../../utils/clinical";
import { fmtDate, maskCpf } from "../../utils/formatting";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

export function PatientCardModal({ patient, users, templates, history, onClose }) {
  const acsName = users.find((u) => u.id === patient.assignedAcsId)?.name || "Não atribuído";
  const gestational = gestationalAgeInfo(patient);
  const vaccines = (history || []).filter((item) => String(item.type || "").toLowerCase() === "vaccine");
  const allergies = String(patient.allergies || "").trim();
  const catName = templates.find((t) => t.category === patient.careCategory)?.label || patient.careCategory || "Geral";
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const age = calcAge(patient.birthDate);
  const address = [patient.address, patient.number, patient.neighborhood, patient.city, patient.state].filter(Boolean).join(", ");

  const phone = [patient.phone, patient.phoneAlt].filter(Boolean).join(" / ");

  return (
    <Modal
      title="Cartão do Paciente"
      onClose={onClose}
      className="modal--wide"
      actions={(
        <>
          <Button variant="secondary" onClick={() => window.print()}>Imprimir</Button>
          <Button onClick={onClose}>Fechar</Button>
        </>
      )}
    >
      <div id="print-doc" className="patient-card-doc">
        <div className="patient-card-doc__header">
          <div className="patient-card-doc__header-brand">
            <span className="patient-card-doc__brand-name">Vitras · Saúde Pública</span>
            <span className="patient-card-doc__brand-sub">Unidade Básica de Saúde</span>
          </div>
          <div className="patient-card-doc__header-title">CARTÃO DO PACIENTE</div>
        </div>

        <div className="patient-card-doc__identity">
          <div className="patient-card-doc__name">{patient.name}</div>
          <div className="patient-card-doc__id-row">
            {patient.birthDate && <span><strong>DN:</strong> {fmtDate(patient.birthDate)}{age ? ` · ${age}` : ""}</span>}
            {patient.sex && <span><strong>Sexo:</strong> {patient.sex}</span>}
            {patient.cpf && <span><strong>CPF:</strong> {maskCpf(patient.cpf)}</span>}
            {patient.cns && <span><strong>CNS:</strong> {patient.cns}</span>}
          </div>
          <div className="patient-card-doc__prog-row">
            <span><strong>Programa:</strong> {catName}</span>
            <span><strong>ACS:</strong> {acsName}</span>
            {gestational && String(patient.careCategory || "").toLowerCase() === "pregnant" && (
              <span><strong>IG:</strong> {gestational.weeks}s{gestational.days}d</span>
            )}
          </div>
        </div>

        <div className="patient-card-doc__grid">
          <div className="patient-card-doc__section">
            <div className="patient-card-doc__section-title">Contato</div>
            {phone && <div className="patient-card-doc__line">{phone}</div>}
            {address && <div className="patient-card-doc__line">{address}</div>}
          </div>

          <div className="patient-card-doc__section">
            <div className="patient-card-doc__section-title">Clínico</div>
            {allergies
              ? <div className="patient-card-doc__line patient-card-doc__line--alert"><strong>Alergias:</strong> {allergies}</div>
              : <div className="patient-card-doc__line patient-card-doc__line--muted">Sem alergias registradas</div>
            }
          </div>
        </div>

        {vaccines.length > 0 && (
          <div className="patient-card-doc__section">
            <div className="patient-card-doc__section-title">Vacinas</div>
            <div className="patient-card-doc__vacc-row">
              {vaccines.slice(0, 10).map((v, i) => (
                <span key={`${v.id || v.title}-${i}`} className="patient-card-doc__vacc-pill">
                  {v.title}{v.date ? ` (${fmtDate(v.date)})` : ""}
                </span>
              ))}
              {vaccines.length > 10 && <span className="patient-card-doc__vacc-more">+{vaccines.length - 10}</span>}
            </div>
          </div>
        )}

        <div className="patient-card-doc__footer">
          <span>Unidade Básica de Saúde</span>
          <span>Emitido em {today}</span>
        </div>
      </div>
    </Modal>
  );
}
