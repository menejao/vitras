import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import { loadDashboard, getProximaConsulta } from "../services/dashboardService.js";
import { isModuloAtivo }                     from "../services/configService.js";

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcoCalendar  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoHeart     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IcoBuilding  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoBell      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoUser      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoPill      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/><circle cx="17" cy="17" r="5"/><line x1="14" y1="17" x2="20" y2="17"/></svg>;
const IcoFlask     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v10l3 6H6l3-6V3z"/><line x1="9" y1="3" x2="9" y2="8"/><line x1="15" y1="3" x2="15" y2="8"/></svg>;
const IcoSyringe   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
const IcoAlertTri  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoPhone     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IcoUsers     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcoChevron   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IcoCheck     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

// ── Quick link icon map ────────────────────────────────────────────────────────

const QUICK_LINK_ICONS = {
  agendamentos:   <IcoCalendar />,
  "minha-saude":  <IcoHeart />,
  "minha-ubs":    <IcoBuilding />,
  notificacoes:   <IcoBell />,
  perfil:         <IcoUser />,
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ style }) {
  return <div className="portal-skeleton" style={style} />;
}

function CardSkeleton() {
  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <Sk style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
        <Sk style={{ flex: 1, height: 16 }} />
      </div>
      <div className="portal-dash-card__body">
        <Sk style={{ height: 13, marginBottom: 8 }} />
        <Sk style={{ height: 13, width: "70%" }} />
      </div>
    </div>
  );
}

// ── Generic card wrappers ─────────────────────────────────────────────────────

function CardError({ titulo, icon }) {
  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon">{icon}</div>
        <span className="portal-dash-card__title">{titulo}</span>
      </div>
      <div className="portal-card-state">
        <span className="portal-card-state__icon"><IcoAlertTri /></span>
        <span className="portal-card-state__text">Não foi possível carregar. Tente novamente mais tarde.</span>
      </div>
    </div>
  );
}

function CardEmpty({ titulo, icon, mensagem }) {
  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon">{icon}</div>
        <span className="portal-dash-card__title">{titulo}</span>
      </div>
      <div className="portal-card-state">
        <span className="portal-card-state__text">{mensagem}</span>
      </div>
    </div>
  );
}

// ── Card: Próxima Consulta ────────────────────────────────────────────────────
function CardProximaConsulta({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Próxima Consulta" icon={<IcoCalendar />} />;

  const consulta = getProximaConsulta(result.data);
  if (!consulta) return <CardEmpty titulo="Próxima Consulta" icon={<IcoCalendar />} mensagem="Nenhuma consulta agendada." />;

  let dia = "—", mesLabel = "";
  try {
    const d = new Date(consulta.data);
    if (!isNaN(d)) {
      dia = d.getDate();
      mesLabel = d.toLocaleString("pt-BR", { month: "short" });
    }
  } catch { /* ignore */ }

  return (
    <div className="portal-dash-card" style={{ cursor: "pointer" }} onClick={() => navigate("/agendamentos")}>
      <div style={{ display: "flex" }}>
        <div className="portal-appt-card__date-col">
          <div className="portal-appt-card__day">{dia}</div>
          <div className="portal-appt-card__month">{mesLabel}</div>
        </div>
        <div className="portal-appt-card__info">
          <div className="portal-appt-card__type">{consulta.tipo}</div>
          <div className="portal-appt-card__time">{consulta.hora}</div>
          <div className="portal-appt-card__prof">{consulta.profissional}</div>
          <div className="portal-appt-card__prof" style={{ marginTop: 2 }}>{consulta.local}</div>
        </div>
      </div>
      <div className="portal-dash-card__footer">
        <button className="btn btn--ghost btn--sm" onClick={e => { e.stopPropagation(); navigate("/agendamentos"); }}>
          Ver todos os agendamentos
        </button>
      </div>
    </div>
  );
}

// ── Card: Vacinação ───────────────────────────────────────────────────────────
function CardVacinacao({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Vacinação" icon={<IcoSyringe />} />;

  const { vacinas = [] } = result.data || {};
  const pendentes = vacinas.filter(v => v.status === "pendente");
  const aplicadas = vacinas.filter(v => v.status === "aplicada");

  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon"><IcoSyringe /></div>
        <span className="portal-dash-card__title">Vacinação</span>
        {pendentes.length > 0 && <span className="portal-dash-card__badge">{pendentes.length} pendente(s)</span>}
      </div>
      <div className="portal-dash-card__body">
        {vacinas.length === 0
          ? <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: 0 }}>Nenhuma vacina registrada.</p>
          : <>
              {pendentes.slice(0, 3).map((v, i) => (
                <div key={i} className="portal-mini-stat">
                  <div className="portal-mini-stat__dot portal-mini-stat__dot--amber" />
                  <span className="portal-mini-stat__label">{v.nome}</span>
                  <span className="portal-mini-stat__value">Pendente</span>
                </div>
              ))}
              {aplicadas.slice(0, 2).map((v, i) => (
                <div key={i} className="portal-mini-stat">
                  <div className="portal-mini-stat__dot portal-mini-stat__dot--green" />
                  <span className="portal-mini-stat__label">{v.nome}</span>
                  <span className="portal-mini-stat__value">{v.data}</span>
                </div>
              ))}
            </>
        }
      </div>
      <div className="portal-dash-card__footer">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/minha-saude")}>Ver calendário vacinal</button>
      </div>
    </div>
  );
}

// ── Card: Medicamentos ────────────────────────────────────────────────────────
function CardMedicamentos({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Medicamentos" icon={<IcoPill />} />;

  const { medicamentos = [], receitas = [] } = result.data || {};

  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon"><IcoPill /></div>
        <span className="portal-dash-card__title">Medicamentos</span>
        {receitas.length > 0 && <span className="portal-dash-card__badge">{receitas.length} receita(s)</span>}
      </div>
      <div className="portal-dash-card__body">
        {medicamentos.length === 0
          ? <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: 0 }}>Nenhum medicamento ativo.</p>
          : medicamentos.slice(0, 4).map((m, i) => (
              <div key={i} className="portal-mini-stat">
                <div className="portal-mini-stat__dot portal-mini-stat__dot--green" />
                <span className="portal-mini-stat__label">{m.nome}</span>
                <span className="portal-mini-stat__value" style={{ fontSize: "var(--t-xs)" }}>{m.retirada || "—"}</span>
              </div>
            ))
        }
      </div>
      <div className="portal-dash-card__footer">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/minha-saude")}>Ver receitas</button>
      </div>
    </div>
  );
}

// ── Card: Exames ──────────────────────────────────────────────────────────────
function CardExames({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Exames" icon={<IcoFlask />} />;

  const { exames = [] } = result.data || {};
  const comResultado = exames.filter(e => e.resultado);
  const pendentes    = exames.filter(e => !e.resultado);

  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon"><IcoFlask /></div>
        <span className="portal-dash-card__title">Exames</span>
        {comResultado.length > 0 && <span className="portal-dash-card__badge">{comResultado.length} disponível(is)</span>}
      </div>
      <div className="portal-dash-card__body">
        {exames.length === 0
          ? <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: 0 }}>Nenhum exame registrado.</p>
          : <>
              {comResultado.slice(0, 3).map((e, i) => (
                <div key={i} className="portal-mini-stat">
                  <div className="portal-mini-stat__dot portal-mini-stat__dot--green" />
                  <span className="portal-mini-stat__label">{e.tipo}</span>
                  <span className="portal-mini-stat__value">Disponível</span>
                </div>
              ))}
              {pendentes.slice(0, 2).map((e, i) => (
                <div key={i} className="portal-mini-stat">
                  <div className="portal-mini-stat__dot portal-mini-stat__dot--muted" />
                  <span className="portal-mini-stat__label">{e.tipo}</span>
                  <span className="portal-mini-stat__value">Pendente</span>
                </div>
              ))}
            </>
        }
      </div>
      <div className="portal-dash-card__footer">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/minha-saude")}>Ver resultados</button>
      </div>
    </div>
  );
}

// ── Card: Notificações ────────────────────────────────────────────────────────
function CardNotificacoes({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Avisos" icon={<IcoBell />} />;

  const notifs   = result.data || [];
  const naoLidas = notifs.filter(n => !n.lida);

  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon"><IcoBell /></div>
        <span className="portal-dash-card__title">Avisos</span>
        {naoLidas.length > 0 && <span className="portal-dash-card__badge">{naoLidas.length} novo(s)</span>}
      </div>
      <div className="portal-dash-card__body">
        {notifs.length === 0
          ? <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: 0 }}>Nenhum aviso no momento.</p>
          : notifs.slice(0, 3).map(n => (
              <div key={n.id}
                className={`portal-notif-item${n.lida ? "" : " portal-notif-item--unread"}`}
                style={{ marginBottom: 8, padding: "10px 12px" }}
              >
                <div className="portal-notif-item__body">
                  <div className="portal-notif-item__title">{n.titulo}</div>
                  <div className="portal-notif-item__text">{n.texto}</div>
                </div>
              </div>
            ))
        }
      </div>
      <div className="portal-dash-card__footer">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/notificacoes")}>Ver todos os avisos</button>
      </div>
    </div>
  );
}

// ── Card: Minha UBS ───────────────────────────────────────────────────────────
function CardMinhaUbs({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Minha UBS" icon={<IcoBuilding />} />;
  if (!result.data) return <CardEmpty titulo="Minha UBS" icon={<IcoBuilding />} mensagem="UBS não identificada." />;

  const u = result.data;

  const rows = [
    u.nome     && { icon: <IcoBuilding />, label: "Unidade", valor: u.nome     },
    u.equipe   && { icon: <IcoUsers />,   label: "Equipe",  valor: u.equipe   },
    u.acs      && { icon: <IcoUser />,    label: "ACS",     valor: u.acs      },
    u.telefone && { icon: <IcoPhone />,   label: "Telefone", valor: u.telefone },
  ].filter(Boolean);

  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon"><IcoBuilding /></div>
        <span className="portal-dash-card__title">Minha UBS</span>
      </div>
      <div className="portal-dash-card__body" style={{ padding: 0 }}>
        {rows.map((row, i, arr) => (
          <div key={i} className="portal-ubs-info-row" style={i === arr.length - 1 ? { borderBottom: "none" } : {}}>
            <div className="portal-ubs-info-row__icon">{row.icon}</div>
            <div>
              <div className="portal-ubs-info-row__label">{row.label}</div>
              <div className="portal-ubs-info-row__value">{row.valor}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="portal-dash-card__footer">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/minha-ubs")}>Ver detalhes</button>
      </div>
    </div>
  );
}

// ── Pendências ────────────────────────────────────────────────────────────────
function Pendencias({ pendencias }) {
  const navigate = useNavigate();
  if (!pendencias) {
    return (
      <div className="portal-pendencias">
        <Sk style={{ height: 52, borderRadius: 10 }} />
        <Sk style={{ height: 52, borderRadius: 10 }} />
      </div>
    );
  }
  if (pendencias.length === 0) {
    return (
      <div className="portal-info-banner" style={{ marginBottom: "var(--s-5)", display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
        <span style={{ color: "var(--success)", flexShrink: 0 }}><IcoCheck /></span>
        Tudo em dia. Nenhuma pendência no momento.
      </div>
    );
  }
  return (
    <div className="portal-pendencias">
      {pendencias.map(p => (
        <button
          key={p.id}
          className={`portal-pendencia-item portal-pendencia-item--${p.prioridade}`}
          onClick={() => navigate(p.rota)}
        >
          <span className="portal-pendencia-item__icone">{p.icone}</span>
          <span className="portal-pendencia-item__descricao">{p.descricao}</span>
          <span className="portal-pendencia-item__seta"><IcoChevron /></span>
        </button>
      ))}
    </div>
  );
}

// ── Atalhos rápidos ───────────────────────────────────────────────────────────

function QuickLinks({ links }) {
  const navigate = useNavigate();
  return (
    <div className="portal-quick-grid">
      {links.map(l => (
        <button key={l.id} className="portal-quick-card" onClick={() => navigate(l.rota)}>
          <div className="portal-quick-card__icon">
            {QUICK_LINK_ICONS[l.id] || <IcoChevron />}
          </div>
          <div className="portal-quick-card__label">{l.label}</div>
        </button>
      ))}
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

  const config     = dashboard?.config  || null;
  const modulos    = dashboard?.modulos || null;
  const pendencias = loading ? null : (dashboard?.pendencias || []);
  const quickLinks = loading ? null : (dashboard?.quickLinks || []);

  const show = m => !config || isModuloAtivo(config, m);

  return (
    <div className="portal-content">

      {/* Saudação */}
      <div className="portal-greeting-block">
        <div className="portal-greeting-block__avatar">
          {primeiroNome(cidadao?.nome)[0]?.toUpperCase() || "C"}
        </div>
        <div className="portal-greeting-block__text">
          <div className="portal-greeting-block__saudacao">{saudacao()}</div>
          <div className="portal-greeting-block__nome">{primeiroNome(cidadao?.nome)}</div>
        </div>
        <div className="portal-greeting-block__data">{formatDate()}</div>
      </div>

      {/* Central de Pendências */}
      <div className="portal-section">
        <div className="portal-section__title">Pendências</div>
        <Pendencias pendencias={pendencias} />
      </div>

      {/* Cards em grid responsivo — 1 col mobile, 2 col desktop */}
      <div className="portal-home-grid">

        {/* Coluna A */}
        <div className="portal-home-grid__col">
          {show("agendamentos") && (
            <div className="portal-section">
              <div className="portal-section__title">Próxima Consulta</div>
              <CardProximaConsulta result={loading ? null : modulos?.agendamentos} />
            </div>
          )}
          {show("vacinas") && (
            <div className="portal-section">
              <div className="portal-section__title">Vacinação</div>
              <CardVacinacao result={loading ? null : modulos?.saude} />
            </div>
          )}
          {show("exames") && (
            <div className="portal-section">
              <div className="portal-section__title">Exames</div>
              <CardExames result={loading ? null : modulos?.saude} />
            </div>
          )}
        </div>

        {/* Coluna B */}
        <div className="portal-home-grid__col">
          {show("minhaUbs") && (
            <div className="portal-section">
              <div className="portal-section__title">Minha UBS</div>
              <CardMinhaUbs result={loading ? null : modulos?.ubs} />
            </div>
          )}
          {show("medicamentos") && (
            <div className="portal-section">
              <div className="portal-section__title">Medicamentos</div>
              <CardMedicamentos result={loading ? null : modulos?.saude} />
            </div>
          )}
          {show("notificacoes") && (
            <div className="portal-section">
              <div className="portal-section__title">Avisos</div>
              <CardNotificacoes result={loading ? null : modulos?.notificacoes} />
            </div>
          )}
        </div>

      </div>

      {/* Atalhos rápidos */}
      <div className="portal-section">
        <div className="portal-section__title">Acesso rápido</div>
        {loading ? (
          <div className="portal-quick-grid">
            {[1, 2, 3, 4].map(i => <Sk key={i} style={{ height: 100, borderRadius: 14 }} />)}
          </div>
        ) : (
          <QuickLinks links={quickLinks} />
        )}
      </div>

    </div>
  );
}
