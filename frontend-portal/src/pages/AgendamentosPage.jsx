import { useEffect, useState } from "react";
import { useNavigate }        from "react-router-dom";
import {
  getMeusAgendamentos,
  cancelarAgendamento,
  formatarData,
  formatarDataCurta,
} from "../services/appointmentJourneyService.js";

// ── Icons ──────────────────────────────────────────────────────────────────────
const IcoStethoscope = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>;
const IcoCalendar    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoBuilding    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoClipboard   = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>;

// ── Chip de status ─────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const map = {
    agendado:  { label: "Agendado",  bg: "var(--success-soft, #f0fdf4)", color: "var(--success, #16a34a)" },
    concluido: { label: "Concluído", bg: "var(--surface-2)",             color: "var(--text-muted)"       },
    cancelado: { label: "Cancelado", bg: "var(--red-50)",                color: "var(--red-600)"          },
  };
  const s = map[status] || { label: status, bg: "var(--border)", color: "var(--text-muted)" };
  return (
    <span style={{
      fontSize: "var(--t-xs)", fontWeight: 600, padding: "2px 8px",
      borderRadius: 99, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

// ── Card de agendamento ────────────────────────────────────────────────────────
function AppointmentCard({ item, onCancelar }) {
  const [expandido, setExpandido] = useState(false);
  const isProximo = item.status === "agendado";

  return (
    <div className="portal-dash-card" style={{ marginBottom: "var(--s-3)" }}>
      <button
        onClick={() => setExpandido(e => !e)}
        style={{
          display: "flex", alignItems: "flex-start", gap: "var(--s-3)",
          width: "100%", textAlign: "left", background: "none", border: "none",
          cursor: "pointer", padding: "var(--s-4)",
        }}
      >
        <div style={{ width: 24, flexShrink: 0, color: "var(--accent)" }}><IcoStethoscope /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--s-2)", marginBottom: 4 }}>
            <div style={{ fontSize: "var(--t-md)", fontWeight: 600, color: "var(--text)" }}>
              {item.serviceName || "Consulta"}
            </div>
            <StatusChip status={item.status} />
          </div>
          <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
            {item.unitName}
          </div>
          <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 2 }}>
            {formatarDataCurta(item.date)} às {item.hora}
          </div>
        </div>
        <span style={{ color: "var(--text-dim)", fontSize: 16, flexShrink: 0, marginTop: 4 }}>
          {expandido ? "▲" : "▼"}
        </span>
      </button>

      {expandido && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "var(--s-4)" }}>
          {/* Protocolo */}
          {item.protocolo && (
            <div style={{ marginBottom: "var(--s-3)" }}>
              <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Protocolo</div>
              <div style={{ fontFamily: "monospace", fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--accent)", letterSpacing: "0.05em" }}>{item.protocolo}</div>
            </div>
          )}

          {/* Detalhes */}
          <div className="portal-ubs-info-row" style={{ borderTop: "none", paddingTop: 0 }}>
            <div className="portal-ubs-info-row__icon"><IcoCalendar /></div>
            <div>
              <div className="portal-ubs-info-row__label">Data e horário</div>
              <div className="portal-ubs-info-row__value">{formatarData(item.date)} às {item.hora}</div>
            </div>
          </div>
          <div className="portal-ubs-info-row" style={{ borderTop: "none" }}>
            <div className="portal-ubs-info-row__icon"><IcoBuilding /></div>
            <div>
              <div className="portal-ubs-info-row__label">Unidade</div>
              <div className="portal-ubs-info-row__value">{item.unitName}</div>
            </div>
          </div>

          {/* Motivo cancelamento */}
          {item.status === "cancelado" && item.motivoCancelamento && (
            <div style={{ marginTop: "var(--s-3)", padding: "var(--s-3)", background: "var(--red-50)", borderRadius: "var(--r-md)", fontSize: "var(--t-sm)", color: "var(--red-600)" }}>
              Motivo: {item.motivoCancelamento}
            </div>
          )}

          {/* Botão cancelar */}
          {isProximo && (
            <button
              className="btn btn--danger-ghost btn--full"
              style={{ marginTop: "var(--s-4)" }}
              onClick={() => onCancelar(item)}
            >
              Cancelar Agendamento
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal de cancelamento ──────────────────────────────────────────────────────
function ModalCancelar({ item, onClose, onConfirm, loading }) {
  const [motivo, setMotivo] = useState("");
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 1000, padding: "0 0 var(--s-safe-bottom, 0)",
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: "var(--bg)", borderRadius: "var(--r-xl) var(--r-xl) 0 0",
        padding: "var(--s-5)", boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
      }}>
        <h3 style={{ fontSize: "var(--t-lg)", fontWeight: 700, color: "var(--text)", margin: "0 0 var(--s-2)" }}>
          Cancelar agendamento?
        </h3>
        <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: "0 0 var(--s-4)" }}>
          {item.serviceName} — {formatarDataCurta(item.date)} às {item.hora}
        </p>
        <div className="portal-info-banner" style={{ marginBottom: "var(--s-4)", fontSize: "var(--t-sm)" }}>
          A vaga será devolvida ao sistema e poderá ser usada por outro cidadão.
        </div>
        <label style={{ display: "block", fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)", marginBottom: "var(--s-2)" }}>
          Motivo (opcional)
        </label>
        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ex: não poderei comparecer, melhora no quadro..."
          rows={3}
          style={{
            width: "100%", padding: "var(--s-3)", borderRadius: "var(--r-md)",
            border: "1.5px solid var(--border)", background: "var(--surface)",
            color: "var(--text)", fontSize: "var(--t-sm)", resize: "none",
            fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: "var(--s-2)", marginTop: "var(--s-4)" }}>
          <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onClose} disabled={loading}>
            Voltar
          </button>
          <button
            className={"btn btn--danger" + (loading ? " btn--loading" : "")}
            style={{ flex: 1 }}
            disabled={loading}
            onClick={() => onConfirm(motivo)}
          >
            {loading ? "" : "Confirmar Cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ mensagem, onAgendar }) {
  return (
    <div className="portal-empty">
      <div className="portal-empty__icon"><IcoClipboard /></div>
      <div className="portal-empty__title">Nenhum agendamento encontrado</div>
      <div className="portal-empty__text">{mensagem}</div>
      {onAgendar && (
        <button className="btn btn--primary" style={{ marginTop: "var(--s-2)" }} onClick={onAgendar}>Agendar Atendimento</button>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AgendamentosPage() {
  const navigate = useNavigate();

  const [dados,    setDados]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [erro,     setErro]     = useState("");
  const [aba,      setAba]      = useState("proximos");
  const [cancelar, setCancelar] = useState(null);
  const [cancLoading, setCancLoading] = useState(false);
  const [cancErro, setCancErro] = useState("");

  async function carregar() {
    setLoading(true); setErro("");
    try {
      const data = await getMeusAgendamentos();
      setDados(data);
    } catch (e) {
      setErro(e.message || "Erro ao carregar agendamentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleConfirmarCancelamento(motivo) {
    setCancLoading(true); setCancErro("");
    try {
      await cancelarAgendamento(cancelar.id, motivo);
      setCancelar(null);
      await carregar();
    } catch (e) {
      setCancErro(e.message || "Erro ao cancelar.");
    } finally {
      setCancLoading(false);
    }
  }

  const abas = [
    { id: "proximos",  label: "Próximos",  count: dados?.proximos?.length  },
    { id: "concluidos",label: "Histórico", count: dados?.concluidos?.length },
    { id: "cancelados",label: "Cancelados",count: dados?.cancelados?.length },
  ];

  const itens = dados?.[aba] || [];

  return (
    <>
      {cancelar && (
        <ModalCancelar
          item={cancelar}
          loading={cancLoading}
          onClose={() => { setCancelar(null); setCancErro(""); }}
          onConfirm={handleConfirmarCancelamento}
        />
      )}
      {cancErro && !cancelar && (
        <div className="alert alert--error" role="alert" style={{ margin: "0 var(--s-4) var(--s-3)" }}>{cancErro}</div>
      )}

      <div className="portal-content">
        {/* Header */}
        <div className="portal-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="portal-page-header__title">Meus Agendamentos</div>
          <button
            className="btn btn--primary"
            style={{ fontSize: "var(--t-sm)", padding: "var(--s-2) var(--s-4)" }}
            onClick={() => navigate("/agendamentos/novo")}
          >
            + Agendar
          </button>
        </div>

        {erro && <div className="alert alert--error" role="alert" style={{ marginBottom: "var(--s-4)" }}>{erro}</div>}

        {/* Abas */}
        <div style={{ display: "flex", gap: "var(--s-1)", marginBottom: "var(--s-5)", borderBottom: "1.5px solid var(--border)" }}>
          {abas.map(a => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "var(--s-3) var(--s-3)",
                fontSize: "var(--t-sm)", fontWeight: 600,
                color: aba === a.id ? "var(--accent)" : "var(--text-muted)",
                borderBottom: `2px solid ${aba === a.id ? "var(--accent)" : "transparent"}`,
                marginBottom: "-1.5px", transition: "all var(--d-fast)",
                whiteSpace: "nowrap",
              }}
            >
              {a.label}
              {a.count > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: "var(--t-xs)",
                  background: aba === a.id ? "var(--accent-soft)" : "var(--border)",
                  color: aba === a.id ? "var(--accent)" : "var(--text-muted)",
                  padding: "1px 7px", borderRadius: 99,
                }}>
                  {a.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="portal-skeleton" style={{ height: 92, borderRadius: 12 }} />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <EmptyState
            mensagem={
              aba === "proximos"   ? "Nenhum agendamento próximo. Que tal marcar uma consulta?" :
              aba === "concluidos" ? "Nenhum atendimento concluído registrado." :
                                    "Nenhum agendamento cancelado."
            }
            onAgendar={aba === "proximos" ? () => navigate("/agendamentos/novo") : null}
          />
        ) : (
          <div>
            {itens.map(item => (
              <AppointmentCard
                key={item.id}
                item={item}
                onCancelar={item => { setCancErro(""); setCancelar(item); }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
