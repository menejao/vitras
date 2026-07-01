import { useEffect, useState } from "react";
import { useNavigate }        from "react-router-dom";
import {
  getMeusAgendamentos,
  cancelarAgendamento,
} from "../services/appointmentJourneyService.js";

// ── Icons ──────────────────────────────────────────────────────────────────────
const IcoCalendar = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoBuilding = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoClock    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcoClipboard= () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>;
const IcoX        = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoPlus     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDateParts(iso) {
  try {
    const d = new Date(iso + "T12:00:00");
    return {
      dia:  String(d.getDate()).padStart(2, "0"),
      mes:  d.toLocaleString("pt-BR", { month: "short" }).replace(".", ""),
      dow:  d.toLocaleString("pt-BR", { weekday: "short" }).replace(".", ""),
    };
  } catch { return { dia: "—", mes: "", dow: "" }; }
}

function agruparPorMes(lista) {
  const grupos = {};
  lista.forEach(item => {
    const key = item.data ? item.data.slice(0, 7) : "sem-data";
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(item);
  });
  return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
}

function labelMes(key) {
  if (key === "sem-data") return "Sem data";
  try {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("pt-BR", { month: "long", year: "numeric" });
  } catch { return key; }
}

function isProximo(iso) {
  if (!iso) return false;
  return new Date(iso + "T23:59:59") >= new Date();
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }) {
  const map = {
    agendado:  { label: "Agendado",  bg: "var(--success-soft)", color: "var(--success)" },
    concluido: { label: "Concluído", bg: "var(--surface-3)",    color: "var(--text-muted)" },
    cancelado: { label: "Cancelado", bg: "var(--danger-soft)",  color: "var(--danger)" },
  };
  const s = map[status] || { label: status, bg: "var(--border)", color: "var(--text-muted)" };
  return (
    <span style={{
      fontSize: "var(--t-xs)", fontWeight: 700, padding: "2px 8px",
      borderRadius: 99, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

// ── Hero próxima consulta ─────────────────────────────────────────────────────

function ProximaConsultaHero({ item, onCancelar }) {
  const nav = useNavigate();
  const { dia, mes, dow } = parseDateParts(item.data);
  const [cancelando, setCancelando] = useState(false);

  async function handleCancelar() {
    if (!window.confirm("Cancelar este agendamento?")) return;
    setCancelando(true);
    try { await onCancelar(item.id); } finally { setCancelando(false); }
  }

  return (
    <div className="portal-hero portal-hero--consulta" style={{ marginBottom: "var(--s-5)" }}>
      <div className="portal-hero__eyebrow">Próxima Consulta</div>
      <div className="portal-hero__title">{item.tipo || "Consulta Médica"}</div>
      <div className="portal-hero__meta">
        <div className="portal-hero__meta-item">
          <span className="portal-hero__meta-label">Data</span>
          <span className="portal-hero__meta-value">{dow}, {dia} de {mes}</span>
        </div>
        {item.hora && (
          <div className="portal-hero__meta-item">
            <span className="portal-hero__meta-label">Horário</span>
            <span className="portal-hero__meta-value">{item.hora}</span>
          </div>
        )}
        {item.local && (
          <div className="portal-hero__meta-item">
            <span className="portal-hero__meta-label">Local</span>
            <span className="portal-hero__meta-value">{item.local}</span>
          </div>
        )}
      </div>
      <div className="portal-hero__actions">
        <button className="portal-hero__btn portal-hero__btn--primary" onClick={() => nav("/agendamentos/novo")}>
          Remarcar
        </button>
        <button
          className="portal-hero__btn portal-hero__btn--ghost"
          onClick={handleCancelar}
          disabled={cancelando}
        >
          {cancelando ? "Cancelando..." : "Cancelar consulta"}
        </button>
      </div>
    </div>
  );
}

// ── Timeline item ─────────────────────────────────────────────────────────────

function TimelineItem({ item, onCancelar, isLast }) {
  const { dia, mes, dow } = parseDateParts(item.data);
  const [cancelando, setCancelando] = useState(false);
  const future = isProximo(item.data);

  async function handleCancelar() {
    if (!window.confirm("Cancelar este agendamento?")) return;
    setCancelando(true);
    try { await onCancelar(item.id); } finally { setCancelando(false); }
  }

  return (
    <div className={"portal-timeline-item" + (isLast ? " portal-timeline-item--last" : "")}>
      <div className="portal-timeline-item__date">
        <div className="portal-timeline-item__day">{dia}</div>
        <div className="portal-timeline-item__month">{mes}</div>
      </div>
      <div className="portal-timeline-item__body">
        <div className="portal-timeline-item__type">
          {item.tipo || "Consulta"}
          {future && item.status === "agendado" && (
            <span style={{ marginLeft: 8 }}><StatusChip status="agendado" /></span>
          )}
          {item.status === "concluido" && (
            <span style={{ marginLeft: 8 }}><StatusChip status="concluido" /></span>
          )}
          {item.status === "cancelado" && (
            <span style={{ marginLeft: 8 }}><StatusChip status="cancelado" /></span>
          )}
        </div>
        <div className="portal-timeline-item__meta">
          {item.hora && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <IcoClock /> {item.hora}
            </span>
          )}
          {item.local && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <IcoBuilding /> {item.local}
            </span>
          )}
          {item.profissional && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {item.profissional}
            </span>
          )}
        </div>
        {future && item.status === "agendado" && (
          <button
            style={{
              marginTop: "var(--s-2)",
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--danger)", fontSize: "var(--t-xs)", fontWeight: 600,
              padding: "2px 0",
            }}
            onClick={handleCancelar}
            disabled={cancelando}
          >
            <IcoX /> {cancelando ? "Cancelando..." : "Cancelar"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div>
      <div className="portal-skeleton" style={{ height: 180, borderRadius: 20, marginBottom: "var(--s-5)" }} />
      <div className="portal-skeleton" style={{ height: 18, width: 120, marginBottom: "var(--s-4)" }} />
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: "flex", gap: "var(--s-4)", marginBottom: "var(--s-4)" }}>
          <div className="portal-skeleton" style={{ width: 44, height: 56, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="portal-skeleton" style={{ height: 18, width: "55%", marginBottom: 8 }} />
            <div className="portal-skeleton" style={{ height: 14, width: "35%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AgendamentosPage() {
  const nav = useNavigate();
  const [lista,   setLista]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);

  useEffect(() => {
    getMeusAgendamentos()
      .then(r => { if (r.ok) setLista(r.agendamentos || []); else setErro(r.erro); })
      .catch(() => setErro("Erro ao carregar agendamentos."))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancelar(id) {
    const r = await cancelarAgendamento(id);
    if (r.ok) setLista(prev => prev.map(a => a.id === id ? { ...a, status: "cancelado" } : a));
  }

  // Próxima consulta futura agendada
  const futuros = lista
    .filter(a => a.status === "agendado" && isProximo(a.data))
    .sort((a, b) => a.data?.localeCompare(b.data));
  const proxima = futuros[0] || null;

  // Todos exceto o hero (para a timeline)
  const resto = proxima ? lista.filter(a => a.id !== proxima.id) : lista;

  // Agrupar por mês
  const grupos = agruparPorMes(
    [...resto].sort((a, b) => (b.data || "").localeCompare(a.data || ""))
  );

  if (loading) {
    return (
      <div>
        <div className="portal-page-header">
          <div className="portal-page-header__title">Consultas</div>
        </div>
        <Skeleton />
      </div>
    );
  }

  if (erro) {
    return (
      <div>
        <div className="portal-page-header">
          <div className="portal-page-header__title">Consultas</div>
        </div>
        <div className="portal-dash-card" style={{ textAlign: "center", padding: "var(--s-8)" }}>
          <p style={{ color: "var(--danger)", marginBottom: "var(--s-4)" }}>{erro}</p>
          <button
            onClick={() => { setErro(null); setLoading(true); getMeusAgendamentos().then(r => { if (r.ok) setLista(r.agendamentos || []); }).finally(() => setLoading(false)); }}
            style={{ padding: "var(--s-2) var(--s-4)", borderRadius: "var(--r-md)", background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--s-5)" }}>
        <div className="portal-page-header__title">Consultas</div>
        <button
          onClick={() => nav("/agendamentos/novo")}
          style={{
            display: "flex", alignItems: "center", gap: "var(--s-2)",
            padding: "var(--s-2) var(--s-4)", borderRadius: "var(--r-md)",
            background: "var(--accent)", color: "#fff",
            border: "none", cursor: "pointer",
            fontSize: "var(--t-sm)", fontWeight: 700,
          }}
        >
          <IcoPlus /> Agendar
        </button>
      </div>

      {/* Hero próxima consulta */}
      {proxima && <ProximaConsultaHero item={proxima} onCancelar={handleCancelar} />}

      {/* Vazio */}
      {lista.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--s-12) var(--s-4)", color: "var(--text-muted)" }}>
          <div style={{ marginBottom: "var(--s-4)", opacity: 0.4 }}><IcoClipboard /></div>
          <div style={{ fontWeight: 700, marginBottom: "var(--s-2)", color: "var(--text)" }}>Nenhum agendamento</div>
          <div style={{ fontSize: "var(--t-sm)", marginBottom: "var(--s-6)" }}>Você não tem consultas registradas.</div>
          <button
            onClick={() => nav("/agendamentos/novo")}
            style={{ padding: "var(--s-3) var(--s-6)", borderRadius: "var(--r-md)", background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "var(--t-sm)" }}
          >
            Agendar consulta
          </button>
        </div>
      )}

      {/* Timeline por mês */}
      {grupos.map(([key, items]) => (
        <div key={key} style={{ marginBottom: "var(--s-6)" }}>
          <div style={{
            fontSize: "var(--t-xs)", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: ".06em", color: "var(--text-muted)",
            marginBottom: "var(--s-3)",
          }}>
            {labelMes(key)}
          </div>
          <div className="portal-timeline">
            {items.map((item, idx) => (
              <TimelineItem
                key={item.id}
                item={item}
                onCancelar={handleCancelar}
                isLast={idx === items.length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
