import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHomeData } from "../services/portalService.js";

const MESES_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function fmtData(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d} de ${MESES_PT[parseInt(m,10)-1]}`;
}

export default function HomePage({ cidadao }) {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    getHomeData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const primeiroNome = (cidadao?.nome || "").split(" ")[0];

  if (loading) {
    return (
      <div>
        <div className="portal-greeting">
          <div className="portal-greeting__label">Olá,</div>
          <div className="skeleton" style={{ height: 36, width: 180, borderRadius: 8, marginTop: 4 }} />
        </div>
        <div className="skeleton" style={{ height: 130, borderRadius: 16, marginBottom: 20 }} />
        <div className="portal-quick-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  const { proximaConsulta, vacinasPendentes, receitasAtivas, examesDisponiveis, avisos } = data || {};

  return (
    <div>
      {/* Saudação */}
      <div className="portal-greeting">
        <div className="portal-greeting__label">Olá,</div>
        <div className="portal-greeting__name">{primeiroNome} 👋</div>
      </div>

      {/* Próxima consulta hero */}
      <div className="portal-next-appt" onClick={() => nav("/agendamentos")} role="button" tabIndex={0} style={{ cursor: "pointer" }}>
        <div className="portal-next-appt__label">Próxima consulta</div>
        {proximaConsulta ? (
          <>
            <div className="portal-next-appt__title">{proximaConsulta.tipo}</div>
            <div className="portal-next-appt__sub">
              {proximaConsulta.profissional} · {fmtData(proximaConsulta.data)} às {proximaConsulta.hora}
            </div>
          </>
        ) : (
          <div className="portal-next-appt__empty">Nenhuma consulta agendada.</div>
        )}
        <button className="btn btn--secondary btn--sm" style={{ color: "white", borderColor: "rgba(255,255,255,.3)", background: "rgba(255,255,255,.12)" }}>
          Ver agendamentos →
        </button>
      </div>

      {/* Quick cards */}
      <div className="portal-section">
        <div className="portal-section__title">Acesso rápido</div>
        <div className="portal-quick-grid">
          <div
            className="portal-quick-card portal-quick-card--teal"
            onClick={() => nav("/agendamentos")}
            role="button" tabIndex={0}
          >
            <div className="portal-quick-card__icon">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div className="portal-quick-card__label">Agendamentos</div>
            <div className="portal-quick-card__value">Ver consultas</div>
          </div>

          <div
            className={"portal-quick-card " + (vacinasPendentes > 0 ? "portal-quick-card--amber" : "portal-quick-card--green")}
            onClick={() => nav("/minha-saude")}
            role="button" tabIndex={0}
          >
            <div className="portal-quick-card__icon">
              <svg viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
            </div>
            <div className="portal-quick-card__label">Vacinas</div>
            <div className="portal-quick-card__value">
              {vacinasPendentes > 0 ? `${vacinasPendentes} pendente${vacinasPendentes > 1 ? "s" : ""}` : "Em dia"}
            </div>
          </div>

          <div
            className="portal-quick-card portal-quick-card--blue"
            onClick={() => nav("/minha-saude")}
            role="button" tabIndex={0}
          >
            <div className="portal-quick-card__icon">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div className="portal-quick-card__label">Receitas</div>
            <div className="portal-quick-card__value">
              {receitasAtivas > 0 ? `${receitasAtivas} ativa${receitasAtivas > 1 ? "s" : ""}` : "Nenhuma"}
            </div>
          </div>

          <div
            className="portal-quick-card portal-quick-card--slate"
            onClick={() => nav("/minha-ubs")}
            role="button" tabIndex={0}
          >
            <div className="portal-quick-card__icon">
              <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div className="portal-quick-card__label">Minha UBS</div>
            <div className="portal-quick-card__value">Ver informações</div>
          </div>

          <div
            className={"portal-quick-card " + (examesDisponiveis > 0 ? "portal-quick-card--teal" : "portal-quick-card--slate")}
            onClick={() => nav("/minha-saude")}
            role="button" tabIndex={0}
          >
            <div className="portal-quick-card__icon">
              <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div className="portal-quick-card__label">Exames</div>
            <div className="portal-quick-card__value">
              {examesDisponiveis > 0 ? `${examesDisponiveis} disponível` : "Nenhum"}
            </div>
          </div>

          <div
            className="portal-quick-card portal-quick-card--red"
            onClick={() => nav("/notificacoes")}
            role="button" tabIndex={0}
          >
            <div className="portal-quick-card__icon">
              <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div className="portal-quick-card__label">Avisos</div>
            <div className="portal-quick-card__value">{avisos?.length > 0 ? `${avisos.length} novo${avisos.length > 1 ? "s" : ""}` : "Nenhum"}</div>
          </div>
        </div>
      </div>

      {/* Avisos da UBS */}
      {avisos?.length > 0 && (
        <div className="portal-section">
          <div className="portal-section__title">Avisos da UBS</div>
          <div className="portal-list">
            {avisos.map(av => (
              <div key={av.id} className="portal-info-banner">
                <strong>{av.titulo}</strong><br />
                {av.texto}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
