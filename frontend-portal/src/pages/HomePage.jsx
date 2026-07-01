import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import { loadDashboard, getProximaConsulta } from "../services/dashboardService.js";
import { isModuloAtivo }                     from "../services/configService.js";

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcoCalendar = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoHeart    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IcoBuilding = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoBell     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoUser     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoPill     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/><circle cx="17" cy="17" r="5"/><line x1="14" y1="17" x2="20" y2="17"/></svg>;
const IcoFlask    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v10l3 6H6l3-6V3z"/></svg>;
const IcoSyringe  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
const IcoCheck    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoChevron  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IcoPhone    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IcoUsers    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcoGrid     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>;

// ── Pendência icon map ────────────────────────────────────────────────────────
const PENDENCIA_ICONS = {
  "consulta-urgente": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  "exame-resultado":  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v10l3 6H6l3-6V3z"/></svg>,
  "vacina-pendente":  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  "receita-ativa":    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/><circle cx="17" cy="17" r="5"/><line x1="14" y1="17" x2="20" y2="17"/></svg>,
  "notif-nao-lida":   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatDate() {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

function primeiroNome(nome) {
  return (nome || "").split(" ")[0] || "Cidadão";
}

function formatarData(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  } catch { return iso; }
}

function parseDateParts(iso) {
  try {
    const d = new Date(iso + "T12:00:00");
    return {
      dia: d.getDate(),
      mes: d.toLocaleString("pt-BR", { month: "short" }).replace(".", ""),
    };
  } catch { return { dia: "—", mes: "" }; }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ style }) {
  return <div className="portal-skeleton" style={style} />;
}

// ── Hero dinâmico ─────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div className="portal-hero portal-hero--skeleton" style={{ marginBottom: "var(--s-5)" }}>
      <Sk style={{ height: 12, width: 80, marginBottom: 12 }} />
      <Sk style={{ height: 28, width: "60%", marginBottom: 8 }} />
      <Sk style={{ height: 16, width: "45%", marginBottom: 24 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <Sk style={{ height: 36, width: 110, borderRadius: 8 }} />
        <Sk style={{ height: 36, width: 90, borderRadius: 8 }} />
      </div>
    </div>
  );
}

function HeroConsulta({ consulta }) {
  const nav = useNavigate();
  const { dia, mes } = parseDateParts(consulta.data);
  return (
    <div className="portal-hero portal-hero--consulta">
      <div className="portal-hero__eyebrow">Próxima Consulta</div>
      <div className="portal-hero__title">{consulta.tipo || "Consulta Médica"}</div>
      <div className="portal-hero__meta">
        <div className="portal-hero__meta-item">
          <span className="portal-hero__meta-label">Data</span>
          <span className="portal-hero__meta-value">{dia} de {mes}</span>
        </div>
        {consulta.hora && (
          <div className="portal-hero__meta-item">
            <span className="portal-hero__meta-label">Horário</span>
            <span className="portal-hero__meta-value">{consulta.hora}</span>
          </div>
        )}
        {consulta.local && (
          <div className="portal-hero__meta-item">
            <span className="portal-hero__meta-label">Local</span>
            <span className="portal-hero__meta-value">{consulta.local}</span>
          </div>
        )}
      </div>
      <div className="portal-hero__actions">
        <button className="portal-hero__btn portal-hero__btn--primary" onClick={() => nav("/agendamentos")}>
          Ver detalhes
        </button>
        <button className="portal-hero__btn portal-hero__btn--ghost" onClick={() => nav("/agendamentos/novo")}>
          Remarcar
        </button>
      </div>
    </div>
  );
}

function HeroVacina({ vacina }) {
  const nav = useNavigate();
  return (
    <div className="portal-hero portal-hero--vacina">
      <div className="portal-hero__eyebrow">Vacina Pendente</div>
      <div className="portal-hero__title">{vacina.nome}</div>
      <div className="portal-hero__sub">
        Vacina recomendada para o seu perfil de saúde.
      </div>
      <div className="portal-hero__actions">
        <button className="portal-hero__btn portal-hero__btn--primary" onClick={() => nav("/agendamentos/novo")}>
          Agendar vacinação
        </button>
        <button className="portal-hero__btn portal-hero__btn--ghost" onClick={() => nav("/minha-saude")}>
          Ver calendário
        </button>
      </div>
    </div>
  );
}

function HeroExame({ exame }) {
  const nav = useNavigate();
  return (
    <div className="portal-hero portal-hero--exame">
      <div className="portal-hero__eyebrow">Resultado Disponível</div>
      <div className="portal-hero__title">{exame.tipo}</div>
      <div className="portal-hero__sub">
        Seu resultado está disponível. Consulte sua equipe de saúde.
      </div>
      <div className="portal-hero__actions">
        <button className="portal-hero__btn portal-hero__btn--primary" onClick={() => nav("/minha-saude")}>
          Ver resultado
        </button>
      </div>
    </div>
  );
}

function HeroPositivo() {
  const nav = useNavigate();
  return (
    <div className="portal-hero portal-hero--positivo">
      <div className="portal-hero__eyebrow">Sua Saúde</div>
      <div className="portal-hero__title">Tudo em dia</div>
      <div className="portal-hero__sub">
        Nenhuma pendência no momento. Continue cuidando da sua saúde.
      </div>
      <div className="portal-hero__actions">
        <button className="portal-hero__btn portal-hero__btn--primary" onClick={() => nav("/agendamentos/novo")}>
          Agendar consulta
        </button>
        <button className="portal-hero__btn portal-hero__btn--ghost" onClick={() => nav("/minha-saude")}>
          Minha saúde
        </button>
      </div>
    </div>
  );
}

function HeroCard({ loading, modulos }) {
  if (loading) return <HeroSkeleton />;

  const consultas = modulos?.agendamentos?.data;
  if (Array.isArray(consultas)) {
    const proxima = getProximaConsulta(consultas);
    if (proxima) {
      const diffDays = Math.ceil((new Date(proxima.data) - new Date()) / 86_400_000);
      if (diffDays <= 30) return <HeroConsulta consulta={proxima} />;
    }
  }

  const saude = modulos?.saude?.data || {};

  const exame = (saude.exames || []).find(e => e.resultado);
  if (exame) return <HeroExame exame={exame} />;

  const vacina = (saude.vacinas || []).find(v => v.status === "pendente");
  if (vacina) return <HeroVacina vacina={vacina} />;

  return <HeroPositivo />;
}

// ── Pendências compactas ──────────────────────────────────────────────────────

function PendenciasStrip({ pendencias }) {
  const nav = useNavigate();
  if (!pendencias) {
    return (
      <div className="portal-pend-strip">
        <Sk style={{ height: 48, borderRadius: 10 }} />
      </div>
    );
  }
  if (pendencias.length === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--s-2)",
        padding: "var(--s-3) var(--s-4)", marginBottom: "var(--s-5)",
        background: "var(--success-soft)", borderRadius: "var(--r-lg)",
        color: "var(--success)", fontSize: "var(--t-sm)", fontWeight: 600,
      }}>
        <IcoCheck /> Tudo em dia. Nenhuma pendência no momento.
      </div>
    );
  }
  return (
    <div className="portal-pend-strip">
      {pendencias.map(p => (
        <button
          key={p.id}
          className={`portal-pend-item portal-pend-item--${p.prioridade}`}
          onClick={() => nav(p.rota)}
        >
          <div className="portal-pend-item__icon">
            {PENDENCIA_ICONS[p.id] || <IcoChevron />}
          </div>
          <span className="portal-pend-item__text">{p.descricao}</span>
          <div className="portal-pend-item__arrow"><IcoChevron /></div>
        </button>
      ))}
    </div>
  );
}

// ── Health metric strip ───────────────────────────────────────────────────────

function HealthStrip({ loading, saude }) {
  const nav = useNavigate();
  if (loading) {
    return (
      <div className="portal-health-strip" style={{ marginBottom: "var(--s-5)" }}>
        {[1, 2, 3].map(i => <Sk key={i} style={{ height: 80, borderRadius: 16 }} />)}
      </div>
    );
  }
  const data = saude?.data || {};
  const vacinas   = data.vacinas  || [];
  const exames    = data.exames   || [];
  const receitas  = data.receitas || [];

  const vacinasPend = vacinas.filter(v => v.status === "pendente").length;
  const examesDisp  = exames.filter(e => e.resultado).length;

  return (
    <div className="portal-health-strip" style={{ marginBottom: "var(--s-5)" }}>
      <button className="portal-metric-card portal-metric-card--teal" onClick={() => nav("/minha-saude")}>
        <div className="portal-metric-card__icon"><IcoSyringe /></div>
        <div className="portal-metric-card__value">{vacinas.length}</div>
        <div className="portal-metric-card__label">Vacinas</div>
        {vacinasPend > 0 && (
          <span className="portal-metric-card__badge" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
            {vacinasPend} pendente{vacinasPend > 1 ? "s" : ""}
          </span>
        )}
      </button>
      <button className="portal-metric-card portal-metric-card--blue" onClick={() => nav("/minha-saude")}>
        <div className="portal-metric-card__icon"><IcoFlask /></div>
        <div className="portal-metric-card__value">{exames.length}</div>
        <div className="portal-metric-card__label">Exames</div>
        {examesDisp > 0 && (
          <span className="portal-metric-card__badge" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            {examesDisp} disponível{examesDisp > 1 ? "s" : ""}
          </span>
        )}
      </button>
      <button className="portal-metric-card portal-metric-card--green" onClick={() => nav("/minha-saude")}>
        <div className="portal-metric-card__icon"><IcoPill /></div>
        <div className="portal-metric-card__value">{receitas.length}</div>
        <div className="portal-metric-card__label">Receitas</div>
      </button>
    </div>
  );
}

// ── Quick actions strip ───────────────────────────────────────────────────────

const QUICK_ICONS = {
  agendamentos: { icon: <IcoCalendar />, color: "var(--accent-soft)",   text: "var(--accent)"   },
  "minha-saude":{ icon: <IcoHeart />,   color: "var(--danger-soft)",    text: "var(--danger)"   },
  "minha-ubs":  { icon: <IcoBuilding />,color: "var(--surface-3)",      text: "var(--text-muted)"},
  notificacoes: { icon: <IcoBell />,    color: "var(--warning-soft)",   text: "var(--warning)"  },
  mais:         { icon: <IcoGrid />,    color: "var(--surface-3)",      text: "var(--text-muted)"},
  perfil:       { icon: <IcoUser />,    color: "var(--surface-3)",      text: "var(--text-muted)"},
};

function QuickActions({ loading, quickLinks }) {
  const nav = useNavigate();
  if (loading) {
    return (
      <div className="portal-quick-strip" style={{ marginBottom: "var(--s-5)" }}>
        {[1,2,3,4,5].map(i => <Sk key={i} style={{ width: 72, height: 88, borderRadius: 14, flexShrink: 0 }} />)}
      </div>
    );
  }
  return (
    <div className="portal-quick-strip" style={{ marginBottom: "var(--s-5)" }}>
      {(quickLinks || []).map(l => {
        const meta = QUICK_ICONS[l.id] || { icon: <IcoChevron />, color: "var(--surface-3)", text: "var(--text-muted)" };
        return (
          <button key={l.id} className="portal-quick-action" onClick={() => nav(l.rota)}>
            <div className="portal-quick-action__icon" style={{ background: meta.color, color: meta.text }}>
              {meta.icon}
            </div>
            <span className="portal-quick-action__label">{l.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── UBS widget (aside column) ─────────────────────────────────────────────────

function UBSWidget({ result }) {
  const nav = useNavigate();
  if (!result) {
    return (
      <div className="portal-ubs-widget" style={{ marginBottom: "var(--s-4)" }}>
        <div className="portal-ubs-widget__header"><Sk style={{ height: 18, width: 140 }} /></div>
        <div style={{ padding: "var(--s-4) var(--s-5)" }}>
          <Sk style={{ height: 14, marginBottom: 8 }} />
          <Sk style={{ height: 14, width: "70%" }} />
        </div>
      </div>
    );
  }
  if (!result.ok || !result.data) return null;
  const u = result.data;

  const rows = [
    u.nome     && { icon: <IcoBuilding />, label: "Unidade",  value: u.nome     },
    u.equipe   && { icon: <IcoUsers />,   label: "Equipe",   value: u.equipe   },
    u.telefone && { icon: <IcoPhone />,   label: "Telefone", value: u.telefone },
  ].filter(Boolean);

  return (
    <div className="portal-ubs-widget">
      <div className="portal-ubs-widget__header">
        <div style={{ width: 24, color: "rgba(255,255,255,.6)", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <span className="portal-ubs-widget__title">Minha UBS</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="portal-ubs-widget__row">
          <div className="portal-ubs-widget__row-icon">{r.icon}</div>
          <div className="portal-ubs-widget__row-text">
            <div className="portal-ubs-widget__row-label">{r.label}</div>
            <div className="portal-ubs-widget__row-value">{r.value}</div>
          </div>
        </div>
      ))}
      <div className="portal-ubs-widget__footer">
        <button className="btn btn--ghost btn--sm btn--full" onClick={() => nav("/minha-ubs")}>
          Ver detalhes da UBS
        </button>
      </div>
    </div>
  );
}

// ── Avisos widget (aside column) ──────────────────────────────────────────────

function AvisosWidget({ result }) {
  const nav = useNavigate();
  if (!result) return null;
  if (!result.ok) return null;

  const notifs = (result.data || []).slice(0, 4);
  if (notifs.length === 0) return null;

  return (
    <div className="portal-notif-widget">
      <div className="portal-notif-widget__header">
        <span className="portal-notif-widget__title">Avisos recentes</span>
        <button
          style={{ fontSize: "var(--t-xs)", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
          onClick={() => nav("/notificacoes")}
        >
          Ver todos
        </button>
      </div>
      {notifs.map(n => (
        <div key={n.id} className="portal-notif-widget__item">
          <div className={"portal-notif-widget__dot" + (n.lida ? " portal-notif-widget__dot--read" : "")} />
          <div className="portal-notif-widget__text">
            <div className="portal-notif-widget__item-title">{n.titulo}</div>
            <div className="portal-notif-widget__item-sub">{n.data || ""}</div>
          </div>
        </div>
      ))}
      <div className="portal-notif-widget__footer">
        <button className="btn btn--ghost btn--sm btn--full" onClick={() => nav("/notificacoes")}>
          Ver todos os avisos
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function HomePage({ cidadao }) {
  const [loading,   setLoading]   = useState(true);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    setLoading(true);
    loadDashboard(cidadao).then(d => { setDashboard(d); setLoading(false); });
  }, [cidadao?.unitId]); // eslint-disable-line

  const modulos    = dashboard?.modulos || null;
  const pendencias = loading ? null : (dashboard?.pendencias || []);
  const quickLinks = loading ? null : (dashboard?.quickLinks || []);

  return (
    <div>
      {/* Saudação */}
      <div className="portal-greeting-compact">
        <div className="portal-greeting-compact__avatar">
          {primeiroNome(cidadao?.nome)[0]?.toUpperCase() || "C"}
        </div>
        <div>
          <div className="portal-greeting-compact__hi">{saudacao()}, {primeiroNome(cidadao?.nome)}</div>
          <div className="portal-greeting-compact__date">{formatDate()}</div>
        </div>
      </div>

      {/* Grid assimétrico: main (1fr) + aside (320px desktop) */}
      <div className="portal-home-layout">

        {/* Coluna principal */}
        <div className="portal-home-layout__main">

          {/* Hero dinâmico */}
          <HeroCard loading={loading} modulos={modulos} />

          {/* Pendências */}
          <PendenciasStrip pendencias={pendencias} />

          {/* Health strip metrics */}
          <HealthStrip loading={loading} saude={modulos?.saude} />

          {/* Ações rápidas */}
          <div className="portal-section">
            <div className="portal-section__title">Acesso rápido</div>
            <QuickActions loading={loading} quickLinks={quickLinks} />
          </div>

          {/* UBS e Avisos aparecem inline no mobile (aside só no desktop) */}
          <div className="portal-aside-mobile">
            <UBSWidget result={loading ? null : modulos?.ubs} />
            <AvisosWidget result={loading ? null : modulos?.notificacoes} />
          </div>
        </div>

        {/* Coluna lateral — desktop only */}
        <div className="portal-home-layout__aside">
          <UBSWidget result={loading ? null : modulos?.ubs} />
          <AvisosWidget result={loading ? null : modulos?.notificacoes} />
        </div>

      </div>
    </div>
  );
}
