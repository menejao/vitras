import { useEffect, useState } from "react";
import { getAgendamentos, parseDateParts } from "../services/agendamentosService.js";

const STATUS_LABEL = { confirmado: "Confirmado", agendado: "Agendado", cancelado: "Cancelado" };
const STATUS_CHIP  = { confirmado: "chip--green", agendado: "chip--teal", cancelado: "chip--red" };

export default function AgendamentosPage() {
  const [lista,   setLista]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgendamentos()
      .then(setLista)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="portal-page-header">
        <div className="portal-page-header__title">Consultas</div>
        <div className="portal-page-header__sub">Seus agendamentos na UBS</div>
      </div>

      <div className="portal-info-banner" style={{ marginBottom: "var(--s-5)" }}>
        As vagas disponíveis dependem de liberação pela equipe da UBS. Para solicitar uma consulta, procure sua UBS ou aguarde contato do seu ACS.
      </div>

      {loading && (
        <div className="portal-list">
          {[1,2].map(i => (
            <div key={i} className="skeleton" style={{ height: 88, borderRadius: 16 }} />
          ))}
        </div>
      )}

      {!loading && lista.length === 0 && (
        <div className="portal-empty">
          <div className="portal-empty__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="portal-empty__title">Sem consultas agendadas</div>
          <div className="portal-empty__text">Quando a equipe da UBS agendar uma consulta para você, ela aparecerá aqui.</div>
        </div>
      )}

      {!loading && lista.length > 0 && (
        <div className="portal-list">
          {lista.map(ag => {
            const { dia, mes } = parseDateParts(ag.data);
            return (
              <div key={ag.id} className="portal-appt-card card">
                <div className="portal-appt-card__body">
                  <div className="portal-appt-card__date-col">
                    <div className="portal-appt-card__day">{dia}</div>
                    <div className="portal-appt-card__month">{mes}</div>
                  </div>
                  <div className="portal-appt-card__info">
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap", marginBottom: "var(--s-1)" }}>
                      <span className="portal-appt-card__type">{ag.tipo}</span>
                      <span className={"chip " + (STATUS_CHIP[ag.status] || "chip--slate")}>{STATUS_LABEL[ag.status] || ag.status}</span>
                    </div>
                    <div className="portal-appt-card__time">{ag.hora} · {ag.local}</div>
                    <div className="portal-appt-card__prof">{ag.profissional}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
