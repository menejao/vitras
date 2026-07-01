import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import { loadDashboard, getProximaConsulta } from "../services/dashboardService.js";

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcoCalendar = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoHeart    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IcoBuilding = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoBell     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoUser     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoPill     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/><circle cx="17" cy="17" r="5"/><line x1="14" y1="17" x2="20" y2="17"/></svg>;
const IcoFlask    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v10l3 6H6l3-6V3z"/></svg>;
const IcoSyringe  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
const IcoCheck    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoChevron  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IcoPhone    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IcoUsers    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;

// Pendência icons (20px)
const PENDENCIA_ICONS = {
  "consulta-urgente": <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  "exame-resultado":  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v10l3 6H6l3-6V3z"/></svg>,
  "vacina-pendente":  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  "receita-ativa":    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/><circle cx="17" cy="17" r="5"/><line x1="14" y1="17" x2="20" y2="17"/></svg>,
  "notif-nao-lida":   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
};

const PENDENCIA_META = {
  "consulta-urgente": { title: "Consulta Urgente",     cta: "Ver consultas"  },
  "exame-resultado":  { title: "Resultado de Exame",   cta: "Ver resultado"  },
  "vacina-pendente":  { title: "Vacina Pendente",      cta: "Agendar vacina" },
  "receita-ativa":    { title: "Receita para Renovar", cta: "Ver receitas"   },
  "notif-nao-lida":   { title: "Aviso não lido",       cta: "Ver avisos"     },
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

function parseDateParts(iso) {
  try {
    const d = new Date(iso + "T12:00:00");
    return { dia: d.getDate(), mes: d.toLocaleString("pt-BR", { month: "short" }).replace(".", "") };
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
        <button className="portal-hero__btn portal-hero__btn--primary" onClick={() => nav("/agendamentos")}>Ver detalhes</button>
        <button className="portal-hero__btn portal-hero__btn--ghost" onClick={() => nav("/agendamentos/novo")}>Remarcar</button>
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
      <div className="portal-hero__sub">Vacina recomendada para o seu perfil de saúde.</div>
      <div className="portal-hero__actions">
        <button className="portal-hero__btn portal-hero__btn--primary" onClick={() => nav("/agendamentos/novo")}>Agendar vacinação</button>
        <button className="portal-hero__btn portal-hero__btn--ghost" onClick={() => nav("/minha-saude")}>Ver calendário</button>
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
      <div className="portal-hero__sub">Seu resultado está disponível. Consulte sua equipe de saúde.</div>
      <div className="portal-hero__actions">
        <button className="portal-hero__btn portal-hero__btn--primary" onClick={() => nav("/minha-saude")}>Ver resultado</button>
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
      <div className="portal-hero__sub">Nenhuma pendência no momento. Continue cuidando da sua saúde.</div>
      <div className="portal-hero__actions">
        <button className="portal-hero__btn portal-hero__btn--primary" onClick={() => nav("/agendamentos/novo")}>Agendar consulta</button>
        <button className="portal-hero__btn portal-hero__btn--ghost" onClick={() => nav("/minha-saude")}>Minha saúde</button>
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

// ── 2. Pendências — Alert Cards (máx 4) ──────────────────────────────────────

function PendenciasAlertCards({ pendencias }) {
  const nav = useNavigate();

  if (!pendencias) {
    return (
      <div className="portal-section" style={{ marginBottom: "var(--s-5)" }}>
        <Sk style={{ height: 76, borderRadius: 12, marginBottom: 8 }} />
        <Sk style={{ height: 76, borderRadius: 12 }} />
      </div>
    );
  }

  if (pendencias.length === 0) {
    return (
      <div className="portal-section" style={{ marginBottom: "var(--s-5)" }}>
        <div className="portal-alert-card portal-alert-card--ok">
          <div className="portal-alert-card__icon portal-alert-card__icon--ok"><IcoCheck /></div>
          <div className="portal-alert-card__body">
            <div className="portal-alert-card__title">Tudo em dia</div>
            <div className="portal-alert-card__desc">Nenhuma pendência no momento.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-section" style={{ marginBottom: "var(--s-5)" }}>
      <div className="portal-section__title">Pendências</div>
      <div className="portal-alert-cards">
        {pendencias.slice(0, 4).map(p => {
          const meta = PENDENCIA_META[p.id] || { title: p.id, cta: "Ver" };
          return (
            <div key={p.id} className={`portal-alert-card portal-alert-card--${p.prioridade || "media"}`}>
              <div className={`portal-alert-card__icon portal-alert-card__icon--${p.prioridade || "media"}`}>
                {PENDENCIA_ICONS[p.id] || <IcoBell />}
              </div>
              <div className="portal-alert-card__body">
                <div className="portal-alert-card__title">{meta.title}</div>
                <div className="portal-alert-card__desc">{p.descricao}</div>
              </div>
              <button className="portal-alert-card__action" onClick={() => nav(p.rota)}>
                {meta.cta}
                <IcoChevron />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 3. Resumo da Saúde — contextual (sem duplicar pendências) ─────────────────

function ResumoSaude({ loading, saude, pendencias }) {
  const nav = useNavigate();

  if (loading) {
    return (
      <div className="portal-section" style={{ marginBottom: "var(--s-5)" }}>
        <div className="portal-section__title">Resumo da Saúde</div>
        <div className="portal-resumo-saude">
          {[1, 2, 3].map(i => <Sk key={i} style={{ height: 112, borderRadius: 14 }} />)}
        </div>
      </div>
    );
  }

  const data = saude?.data || {};
  const vacinas      = data.vacinas      || [];
  const exames       = data.exames       || [];
  const receitas     = data.receitas     || [];
  const medicamentos = data.medicamentos || [];

  const vacinasPend = vacinas.filter(v => v.status === "pendente").length;
  const examesDisp  = exames.filter(e => e.resultado);
  const totalMeds   = receitas.length + medicamentos.length;
  const pendIds     = new Set((pendencias || []).map(p => p.id));

  const cards = [
    !pendIds.has("vacina-pendente") && {
      key: "vacinas",
      icon: <IcoSyringe />,
      iconCls: "portal-resumo-card__icon--teal",
      title: "Vacinas",
      main: vacinasPend > 0
        ? `${vacinasPend} pendente${vacinasPend > 1 ? "s" : ""}`
        : "Calendário em dia",
      secondary: `${vacinas.length} vacina${vacinas.length !== 1 ? "s" : ""} registrada${vacinas.length !== 1 ? "s" : ""}`,
      cta: "Ver calendário",
      rota: "/minha-saude",
      alert: vacinasPend > 0,
    },
    !pendIds.has("exame-resultado") && {
      key: "exames",
      icon: <IcoFlask />,
      iconCls: "portal-resumo-card__icon--blue",
      title: "Exames",
      main: examesDisp.length > 0
        ? `${examesDisp.length} resultado${examesDisp.length > 1 ? "s" : ""} disponível${examesDisp.length > 1 ? "s" : ""}`
        : "Sem resultados novos",
      secondary: `${exames.length} exame${exames.length !== 1 ? "s" : ""} no histórico`,
      cta: "Ver exames",
      rota: "/minha-saude",
      alert: examesDisp.length > 0,
    },
    {
      key: "medicamentos",
      icon: <IcoPill />,
      iconCls: "portal-resumo-card__icon--green",
      title: "Medicamentos",
      main: totalMeds > 0
        ? `${receitas.length} receita${receitas.length !== 1 ? "s" : ""} ativa${receitas.length !== 1 ? "s" : ""}`
        : "Nenhum medicamento",
      secondary: totalMeds > 0
        ? `${medicamentos.length} medicamento${medicamentos.length !== 1 ? "s" : ""} cadastrado${medicamentos.length !== 1 ? "s" : ""}`
        : "Sem registro no momento",
      cta: "Ver receitas",
      rota: "/minha-saude",
      alert: false,
    },
  ].filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <div className="portal-section" style={{ marginBottom: "var(--s-5)" }}>
      <div className="portal-section__title">Resumo da Saúde</div>
      <div className="portal-resumo-saude">
        {cards.map(c => (
          <div key={c.key} className="portal-resumo-card">
            <div className={`portal-resumo-card__icon ${c.iconCls}`}>{c.icon}</div>
            <div className="portal-resumo-card__content">
              <div className="portal-resumo-card__title">{c.title}</div>
              <div className={`portal-resumo-card__main${c.alert ? " portal-resumo-card__main--alert" : ""}`}>
                {c.main}
              </div>
              <div className="portal-resumo-card__secondary">{c.secondary}</div>
            </div>
            <button className="portal-resumo-card__cta" onClick={() => nav(c.rota)}>
              {c.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 4. Ações Rápidas — navegação pura, sem números ────────────────────────────

const ACOES = [
  { id: "agendar",      label: "Agendar consulta",     rota: "/agendamentos/novo", icon: <IcoCalendar />, cls: "portal-acao__icon--accent"  },
  { id: "saude",        label: "Minha Saúde",           rota: "/minha-saude",       icon: <IcoHeart />,    cls: "portal-acao__icon--danger"  },
  { id: "ubs",          label: "Minha UBS",             rota: "/minha-ubs",         icon: <IcoBuilding />, cls: "portal-acao__icon--navy"    },
  { id: "vacinas",      label: "Carteira de Vacinação", rota: "/minha-saude",       icon: <IcoSyringe />,  cls: "portal-acao__icon--teal"    },
  { id: "medicamentos", label: "Medicamentos",          rota: "/minha-saude",       icon: <IcoPill />,     cls: "portal-acao__icon--green"   },
  { id: "notificacoes", label: "Notificações",          rota: "/notificacoes",      icon: <IcoBell />,     cls: "portal-acao__icon--warning" },
  { id: "cadastro",     label: "Meu Cadastro",          rota: "/perfil",            icon: <IcoUser />,     cls: "portal-acao__icon--slate"   },
];

function AcoesRapidas() {
  const nav = useNavigate();
  return (
    <div className="portal-section" style={{ marginBottom: "var(--s-5)" }}>
      <div className="portal-section__title">Acesso rápido</div>
      <div className="portal-acoes-rapidas">
        {ACOES.map(a => (
          <button key={a.id} className="portal-acao" onClick={() => nav(a.rota)}>
            <div className={`portal-acao__icon ${a.cls}`}>{a.icon}</div>
            <span className="portal-acao__label">{a.label}</span>
            <div className="portal-acao__arrow"><IcoChevron /></div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 5. Avisos Recentes — máx 3 ───────────────────────────────────────────────

const TIPO_CHIP = {
  consulta:    "chip chip--teal",
  vacina:      "chip chip--amber",
  exame:       "chip chip--green",
  campanha:    "chip chip--slate",
  medicamento: "chip chip--blue",
};

function AvisosRecentes({ result }) {
  const nav = useNavigate();
  if (!result?.ok) return null;
  const avisos = (result.data || []).slice(0, 3);
  if (avisos.length === 0) return null;

  return (
    <div className="portal-section" style={{ marginBottom: "var(--s-5)" }}>
      <div className="portal-section__header">
        <div className="portal-section__title">Avisos Recentes</div>
        <button className="portal-section__link" onClick={() => nav("/notificacoes")}>Ver todos</button>
      </div>
      <div className="portal-avisos-recentes">
        {avisos.map(a => (
          <div key={a.id} className={`portal-aviso-item${!a.lida ? " portal-aviso-item--unread" : ""}`}>
            <div className={`portal-aviso-item__dot${a.lida ? " portal-aviso-item__dot--read" : ""}`} />
            <div className="portal-aviso-item__body">
              <div className="portal-aviso-item__header">
                <div className="portal-aviso-item__title">{a.titulo}</div>
                {a.tipo && <span className={TIPO_CHIP[a.tipo] || "chip chip--slate"}>{a.tipo}</span>}
              </div>
              {a.data && <div className="portal-aviso-item__date">{a.data}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── UBS widget (aside) ────────────────────────────────────────────────────────

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
        <button className="btn btn--ghost btn--sm btn--full" onClick={() => nav("/minha-ubs")}>Ver detalhes da UBS</button>
      </div>
    </div>
  );
}

function AvisosWidget({ result }) {
  const nav = useNavigate();
  if (!result?.ok) return null;
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
          <div className={`portal-notif-widget__dot${n.lida ? " portal-notif-widget__dot--read" : ""}`} />
          <div className="portal-notif-widget__text">
            <div className="portal-notif-widget__item-title">{n.titulo}</div>
            <div className="portal-notif-widget__item-sub">{n.data || ""}</div>
          </div>
        </div>
      ))}
      <div className="portal-notif-widget__footer">
        <button className="btn btn--ghost btn--sm btn--full" onClick={() => nav("/notificacoes")}>Ver todos os avisos</button>
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

      {/* Layout: main (1fr) + aside (320px desktop) */}
      <div className="portal-home-layout">
        <div className="portal-home-layout__main">

          {/* 1. Hero */}
          <HeroCard loading={loading} modulos={modulos} />

          {/* 2. Pendências — Alert Cards */}
          <PendenciasAlertCards pendencias={pendencias} />

          {/* 3. Resumo da Saúde — contextual, sem duplicar pendências */}
          <ResumoSaude loading={loading} saude={modulos?.saude} pendencias={pendencias} />

          {/* 4. Ações Rápidas — navegação pura */}
          <AcoesRapidas />

          {/* 5. Avisos Recentes — máx 3 */}
          {!loading && <AvisosRecentes result={modulos?.notificacoes} />}

          {/* 6. Conteúdo complementar — inline mobile only */}
          <div className="portal-aside-mobile">
            <UBSWidget result={loading ? null : modulos?.ubs} />
            <AvisosWidget result={loading ? null : modulos?.notificacoes} />
          </div>
        </div>

        {/* Aside — desktop only */}
        <div className="portal-home-layout__aside">
          <UBSWidget result={loading ? null : modulos?.ubs} />
          <AvisosWidget result={loading ? null : modulos?.notificacoes} />
        </div>
      </div>
    </div>
  );
}
