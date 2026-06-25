import { useState } from "react";

// Tradução de chaves de metadata do backend para português
const META_KEY_LABELS = {
  demandType:       "Tipo de demanda",
  turno:            "Turno",
  tipoVisita:       "Tipo de visita",
  motivosVisita:    "Motivos da visita",
  desfecho:         "Desfecho",
  peso:             "Peso (kg)",
  altura:           "Altura (cm)",
  specialty:        "Especialidade",
  consultKind:      "Tipo de consulta",
  cidPrincipal:     "CID-10 principal",
  cidSecundarios:   "CID-10 secundários",
  ciapPrincipal:    "CIAP-2 principal",
  conduct:          "Conduta",
  nextStep:         "Próximo passo",
  origin:           "Origem",
  priority:         "Prioridade",
};

// Tradução de valores enum do backend para português
const META_VALUE_LABELS = {
  // demandType
  scheduled:        "Programada",
  spontaneous:      "Espontânea",
  retroativo:       "Retroativo",
  // turno
  manha:            "Manhã",
  tarde:            "Tarde",
  noite:            "Noite",
  // tipoVisita
  periodica:        "Periódica",
  busca_ativa:      "Busca ativa",
  acompanhamento:   "Acompanhamento",
  // desfecho / outcomes
  visita_realizada: "Visita realizada",
  ausente:          "Ausente",
  recusou:          "Recusou atendimento",
  // consultKind
  individual:       "Individual",
  coletiva:         "Coletiva",
  domiciliar:       "Domiciliar",
  // priority
  low:              "Baixa",
  medium:           "Média",
  high:             "Alta",
  urgent:           "Urgente",
};

function translateMetaKey(k) {
  return META_KEY_LABELS[k] || k;
}

function translateMetaValue(v) {
  if (Array.isArray(v)) return v.map(item => META_VALUE_LABELS[String(item)] || String(item)).join(", ");
  const str = String(v);
  return META_VALUE_LABELS[str] || str;
}

const TYPE_LABELS = {
  appointment:       "Atendimento",
  consultation:      "Consulta",
  visit:             "Visita",
  vaccine:           "Vacinação",
  procedure:         "Procedimento",
  note:              "Anotação",
  prescription:      "Prescrição",
  exam_request:      "Exame",
  referral:          "Encaminhamento",
  nursing:           "Enfermagem",
  evolution:         "Evolução",
  attendance_attest: "Atestado",
  medical_attest:    "Atestado Médico",
};

export default function RecordCard({ record, fmtDate, onInactivate, canInactivate }) {
  const [expanded, setExpanded] = useState(false);

  const isInactive      = record.status === "inactive" || record.status === "cancelled";
  const isActive        = !record.status || record.status === "active";
  const isInactivatable = canInactivate && record.source === "clinicalRecord" && isActive;
  const typeLabel       = TYPE_LABELS[record.type] || record.type || "Registro";

  const dateDisplay = record.date
    ? fmtDate(record.date)
    : record.createdAt
      ? fmtDate(record.createdAt.split("T")[0])
      : "—";

  return (
    <div className={`chr-card${isInactive ? " chr-card--inactive" : ""}`}>
      <div className={`chr-strip chr-strip--${record.type}`} />
      <div className="chr-card__body">

        <div className="chr-card__head">
          <span className="chr-card__date">{dateDisplay}</span>

          <div className="chr-card__center">
            <div className="chr-card__top-row">
              <span className={`chr-type-badge chr-type-badge--${record.type}`}>{typeLabel}</span>
              <span className="chr-card__title">{record.title || "Registro clínico"}</span>
              {isInactive && (
                <span className={`chr-status-badge chr-status-badge--${record.status}`}>
                  {record.status === "cancelled" ? "Cancelado" : "Inativo"}
                </span>
              )}
            </div>
            {!expanded && record.professionalName && (
              <div className="chr-card__author">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                {record.professionalName}
              </div>
            )}
            {!expanded && record.details && (
              <p className="chr-card__summary">{record.details}</p>
            )}
          </div>

          <div className="chr-card__actions">
            <button
              type="button"
              className="chr-toggle-btn"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
            >
              {expanded ? "Fechar" : "Ver detalhes"}
              <svg
                className={`chr-chevron${expanded ? " chr-chevron--up" : ""}`}
                width="10" height="6" viewBox="0 0 10 6" fill="none"
                aria-hidden="true"
              >
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isInactivatable && (
              <button
                type="button"
                className="chr-inactivate-btn"
                onClick={() => onInactivate(record)}
                title="Inativar registro clínico"
              >
                Inativar
              </button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="chr-detail">
            {record.professionalName && (
              <div className="chr-detail-section">
                <span className="chr-detail-label">Profissional responsável</span>
                <p className="chr-detail-text">{record.professionalName}</p>
              </div>
            )}

            {record.details ? (
              <div className="chr-detail-section">
                <span className="chr-detail-label">Relato / Observação clínica</span>
                <p className="chr-detail-text">{record.details}</p>
              </div>
            ) : null}

            {record.metadata && Object.keys(record.metadata).filter((k) => record.metadata[k]).length > 0 ? (
              <div className="chr-detail-section">
                <span className="chr-detail-label">Informações adicionais</span>
                <dl className="chr-detail-meta">
                  {Object.entries(record.metadata).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="chr-detail-meta__row">
                      <dt>{translateMetaKey(k)}</dt>
                      <dd>{translateMetaValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            {record.attachments && record.attachments.length > 0 ? (
              <div className="chr-detail-section">
                <span className="chr-detail-label">Anexos</span>
                <ul className="chr-attachments">
                  {record.attachments.map((a) => (
                    <li key={a.id || a.name}>{a.name || "Anexo"}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="chr-no-attachments">Sem anexos neste registro.</p>
            )}

            {isInactive && record.statusReason && (
              <div className="chr-detail-section chr-detail-section--warning">
                <span className="chr-detail-label">Justificativa de inativação</span>
                <p className="chr-detail-text">{record.statusReason}</p>
                {record.statusChangedAt && (
                  <p className="chr-detail-audit-meta">
                    {record.status === "cancelled" ? "Cancelado" : "Inativado"} em{" "}
                    {new Date(record.statusChangedAt).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            )}

            <div className="chr-detail-audit-row">
              {record.createdAt && (
                <span>
                  Criado em {new Date(record.createdAt).toLocaleDateString("pt-BR")}
                </span>
              )}
              {record.protocolTag && <span>Protocolo: {record.protocolTag}</span>}
              <span>{record.source === "clinicalRecord" ? "Registro clínico" : "Atendimento"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
