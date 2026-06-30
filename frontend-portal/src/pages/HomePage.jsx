import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import { loadDashboard, getProximaConsulta } from "../services/dashboardService.js";
import { isModuloAtivo }                     from "../services/configService.js";

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

function CardError({ titulo, icone }) {
  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon">{icone}</div>
        <span className="portal-dash-card__title">{titulo}</span>
      </div>
      <div className="portal-card-state">
        <span className="portal-card-state__icon">⚠️</span>
        <span className="portal-card-state__text">Não foi possível carregar. Tente novamente mais tarde.</span>
      </div>
    </div>
  );
}

function CardEmpty({ titulo, icone, mensagem }) {
  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon">{icone}</div>
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
  if (!result.ok) return <CardError titulo="Próxima Consulta" icone="📅" />;

  const consulta = getProximaConsulta(result.data);
  if (!consulta) return <CardEmpty titulo="Próxima Consulta" icone="📅" mensagem="Nenhuma consulta agendada." />;

  // Parse date parts from ISO or DD/MM
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
          Ver todos os agendamentos →
        </button>
      </div>
    </div>
  );
}

// ── Card: Vacinação ───────────────────────────────────────────────────────────
function CardVacinacao({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Vacinação" icone="💉" />;

  const { vacinas = [] } = result.data || {};
  const pendentes = vacinas.filter(v => v.status === "pendente");
  const aplicadas = vacinas.filter(v => v.status === "aplicada");

  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon">💉</div>
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
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/minha-saude")}>Ver calendário vacinal →</button>
      </div>
    </div>
  );
}

// ── Card: Medicamentos ────────────────────────────────────────────────────────
function CardMedicamentos({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Medicamentos" icone="💊" />;

  const { medicamentos = [], receitas = [] } = result.data || {};

  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon">💊</div>
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
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/minha-saude")}>Ver receitas →</button>
      </div>
    </div>
  );
}

// ── Card: Exames ──────────────────────────────────────────────────────────────
function CardExames({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Exames" icone="🔬" />;

  const { exames = [] } = result.data || {};
  const comResultado = exames.filter(e => e.resultado);
  const pendentes    = exames.filter(e => !e.resultado);

  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon">🔬</div>
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
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/minha-saude")}>Ver resultados →</button>
      </div>
    </div>
  );
}

// ── Card: Notificações ────────────────────────────────────────────────────────
function CardNotificacoes({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Avisos" icone="🔔" />;

  const notifs   = result.data || [];
  const naoLidas = notifs.filter(n => !n.lida);

  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon">🔔</div>
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
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/notificacoes")}>Ver todos os avisos →</button>
      </div>
    </div>
  );
}

// ── Card: Minha UBS ───────────────────────────────────────────────────────────
function CardMinhaUbs({ result }) {
  const navigate = useNavigate();
  if (!result) return <CardSkeleton />;
  if (!result.ok) return <CardError titulo="Minha UBS" icone="🏥" />;
  if (!result.data) return <CardEmpty titulo="Minha UBS" icone="🏥" mensagem="UBS não identificada." />;

  const u = result.data;
  return (
    <div className="portal-dash-card">
      <div className="portal-dash-card__header">
        <div className="portal-dash-card__icon">🏥</div>
        <span className="portal-dash-card__title">Minha UBS</span>
      </div>
      <div className="portal-dash-card__body" style={{ padding: 0 }}>
        {[
          u.nome     && { icone: "🏥", label: "Unidade", valor: u.nome     },
          u.equipe   && { icone: "👥", label: "Equipe",  valor: u.equipe   },
          u.acs      && { icone: "🧑‍⚕️", label: "ACS",     valor: u.acs      },
          u.telefone && { icone: "📞", label: "Telefone", valor: u.telefone },
        ].filter(Boolean).map((row, i, arr) => (
          <div key={i} className="portal-ubs-info-row" style={i === arr.length - 1 ? { borderBottom: "none" } : {}}>
            <div className="portal-ubs-info-row__icon">{row.icone}</div>
            <div>
              <div className="portal-ubs-info-row__label">{row.label}</div>
              <div className="portal-ubs-info-row__value">{row.valor}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="portal-dash-card__footer">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/minha-ubs")}>Ver detalhes →</button>
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
      <div className="portal-info-banner" style={{ marginBottom: "var(--s-5)" }}>
        ✅ Tudo em dia! Nenhuma pendência no momento.
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
          <span className="portal-pendencia-item__seta">›</span>
        </button>
      ))}
    </div>
  );
}

// ── Atalhos rápidos ───────────────────────────────────────────────────────────
const QUICK_ICONS = { agendamentos: "📅", "minha-saude": "❤️", "minha-ubs": "🏥", notificacoes: "🔔", perfil: "👤" };

function QuickLinks({ links }) {
  const navigate = useNavigate();
  return (
    <div className="portal-quick-grid">
      {links.map(l => (
        <button key={l.id} className="portal-quick-card" onClick={() => navigate(l.rota)}>
          <div className="portal-quick-card__icon" style={{ fontSize: 22 }}>{QUICK_ICONS[l.id] || "→"}</div>
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

  // Respeita configuração do município — defaulta true se config ausente (dev-friendly)
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

      {/* Próxima Consulta */}
      {show("agendamentos") && (
        <div className="portal-section">
          <div className="portal-section__title">Próxima Consulta</div>
          <CardProximaConsulta result={loading ? null : modulos?.agendamentos} />
        </div>
      )}

      {/* Minha UBS */}
      {show("minhaUbs") && (
        <div className="portal-section">
          <div className="portal-section__title">Minha UBS</div>
          <CardMinhaUbs result={loading ? null : modulos?.ubs} />
        </div>
      )}

      {/* Vacinação */}
      {show("vacinas") && (
        <div className="portal-section">
          <div className="portal-section__title">Vacinação</div>
          <CardVacinacao result={loading ? null : modulos?.saude} />
        </div>
      )}

      {/* Medicamentos */}
      {show("medicamentos") && (
        <div className="portal-section">
          <div className="portal-section__title">Medicamentos</div>
          <CardMedicamentos result={loading ? null : modulos?.saude} />
        </div>
      )}

      {/* Exames */}
      {show("exames") && (
        <div className="portal-section">
          <div className="portal-section__title">Exames</div>
          <CardExames result={loading ? null : modulos?.saude} />
        </div>
      )}

      {/* Avisos */}
      {show("notificacoes") && (
        <div className="portal-section">
          <div className="portal-section__title">Avisos</div>
          <CardNotificacoes result={loading ? null : modulos?.notificacoes} />
        </div>
      )}

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
