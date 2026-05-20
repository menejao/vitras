import { gestationalAgeInfo, calcAge } from "../../utils/clinical";
import { fmtDate } from "../../utils/formatting";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

export function PatientCardModal({ patient, users, templates, history, onClose }) {
  const acsName = users.find((u) => u.id === patient.assignedAcsId)?.name || "Nao atribuido";
  const gestational = gestationalAgeInfo(patient);
  const vaccines = (history || []).filter((item) => String(item.type || "").toLowerCase() === "vaccine");
  const meds = String(patient.medications || "").trim();
  const allergies = String(patient.allergies || "").trim();
  const comorbid = String(patient.comorbidities || "").trim();
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const catName = templates.find((template) => template.category === patient.careCategory)?.label || patient.careCategory || "Geral";

  return (
    <Modal
      title="Cartao do Paciente"
      onClose={onClose}
      className="modal--wide"
      actions={(
        <>
          <Button variant="secondary" onClick={() => window.print()}>Imprimir</Button>
          <Button onClick={onClose}>Fechar</Button>
        </>
      )}
    >
      <div className="pharma-pat-card">
        <div className="pharma-pat-card__header">
          <Avatar name={patient.name} size="lg" />
          <div style={{ flex: 1 }}>
            <div className="pharma-pat-card__name">{patient.name}</div>
            <div className="pharma-pat-card__meta-row">
              {patient.birthDate && <span>Nasc.: {fmtDate(patient.birthDate)}{calcAge(patient.birthDate) ? ` · ${calcAge(patient.birthDate)}` : ""}</span>}
              {patient.cpf && <span>CPF: {patient.cpf}</span>}
              {patient.cns && <span>CNS: {patient.cns}</span>}
              {patient.sex && <span>Sexo: {patient.sex}</span>}
            </div>
          </div>
          <div className="pharma-pat-card__aside">
            <div className="pharma-pat-card__aside-cat">{catName}</div>
            <div>ACS: {acsName}</div>
            {gestational && String(patient.careCategory || "").toLowerCase() === "pregnant" ? (
              <div className="pharma-pat-card__aside-ig">IG: {gestational.weeks}s{gestational.days}d ({gestational.source})</div>
            ) : null}
          </div>
        </div>

        <div className="pharma-pat-card__grid">
          <div>
            <div className="pharma-pat-card__section-title">Contato</div>
            <div className="pharma-pat-card__section-body">
              {patient.phone && <span>{patient.phone}</span>}
              {patient.phoneAlt && <span>{patient.phoneAlt}</span>}
              {(patient.address || patient.city) && (
                <span>{[patient.address, patient.number, patient.neighborhood, patient.city, patient.state].filter(Boolean).join(", ")}</span>
              )}
            </div>
          </div>
          <div>
            <div className="pharma-pat-card__section-title">Dados clinicos</div>
            <div className="pharma-pat-card__section-body">
              {allergies ? <span className="pharma-pat-card__allergy">Alergias: {allergies}</span> : <span className="pharma-pat-card__no-data">Sem alergias registradas</span>}
              {comorbid && <span>{comorbid}</span>}
            </div>
          </div>
        </div>

        {meds ? (
          <div className="pharma-pat-card__meds">
            <div className="pharma-pat-card__meds-title">Medicamentos em uso</div>
            <div className="pharma-pat-card__meds-body">{meds}</div>
          </div>
        ) : null}

        {vaccines.length > 0 ? (
          <div className="pharma-pat-card__vaccines">
            <div className="pharma-pat-card__vacc-title">Vacinas registradas</div>
            <div className="pharma-pat-card__vacc-list">
              {vaccines.slice(0, 12).map((item, index) => (
                <span key={`${item.id || item.title}-${index}`} className="pharma-pat-card__vacc-pill">
                  {item.title}{item.date ? ` (${fmtDate(item.date)})` : ""}
                </span>
              ))}
              {vaccines.length > 12 ? <span className="pharma-pat-card__vacc-more">+{vaccines.length - 12} mais</span> : null}
            </div>
          </div>
        ) : null}

        {String(patient.careCategory || "").toLowerCase() === "pregnant" ? (
          <div className="pharma-pat-card__pregnancy">
            <div className="pharma-pat-card__pregnancy-title">Gestacao</div>
            <div className="pharma-pat-card__pregnancy-data">
              {patient.pregnancyStartDate && <span>DUM: {fmtDate(patient.pregnancyStartDate)}</span>}
              {patient.expectedDeliveryDate && <span>DPP: {fmtDate(patient.expectedDeliveryDate)}</span>}
              {gestational && <strong>IG estimada: {gestational.weeks}s {gestational.days}d</strong>}
            </div>
          </div>
        ) : null}

        <div className="pharma-pat-card__footer">
          <span>Unidade Basica de Saude</span>
          <span>Emitido em {today}</span>
        </div>
      </div>
    </Modal>
  );
}
