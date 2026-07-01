import { useEffect, useState } from "react";
import { getNotificacoes } from "../services/notificacoesService.js";

// ── Type config ───────────────────────────────────────────────────────────────
const TIPO_MAP = {
  consulta:    { label: "Consulta",     chipCls: "chip--teal"  },
  vacina:      { label: "Vacina",       chipCls: "chip--amber" },
  exame:       { label: "Exame",        chipCls: "chip--green" },
  campanha:    { label: "Campanha",     chipCls: "chip--slate" },
  medicamento: { label: "Medicamento",  chipCls: "chip--blue"  },
};

const FILTERS = [
  { id: "todos",       label: "Todos"       },
  { id: "nao-lidas",   label: "Não lidas"   },
  { id: "consulta",    label: "Consultas"   },
  { id: "vacina",      label: "Vacinas"     },
  { id: "exame",       label: "Exames"      },
  { id: "campanha",    label: "Campanhas"   },
  { id: "medicamento", label: "Medicamentos"},
];

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcoBell = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;

// ── Notification card ─────────────────────────────────────────────────────────
function NotifCard({ notif }) {
  const tipo = TIPO_MAP[notif.tipo] || { label: notif.tipo, chipCls: "chip--slate" };
  return (
    <div className={"portal-notif-card" + (!notif.lida ? " portal-notif-card--unread" : "")}>
      <div className={"portal-notif-card__dot" + (notif.lida ? " portal-notif-card__dot--read" : "")} />
      <div className="portal-notif-card__body">
        <div className="portal-notif-card__header">
          <div className="portal-notif-card__title">{notif.titulo}</div>
          <span className={"chip " + tipo.chipCls}>{tipo.label}</span>
        </div>
        <div className="portal-notif-card__text">{notif.texto}</div>
        <div className="portal-notif-card__time">{notif.data}</div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NotificacoesPage() {
  const [lista,    setLista]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState("todos");

  useEffect(() => {
    getNotificacoes()
      .then(setLista)
      .finally(() => setLoading(false));
  }, []);

  function countFor(f) {
    if (f === "todos")     return lista.length;
    if (f === "nao-lidas") return lista.filter(n => !n.lida).length;
    return lista.filter(n => n.tipo === f).length;
  }

  const filtrada = (() => {
    if (filtro === "todos")     return lista;
    if (filtro === "nao-lidas") return lista.filter(n => !n.lida);
    return lista.filter(n => n.tipo === filtro);
  })();

  const naoLidas = lista.filter(n => !n.lida).length;

  return (
    <div>
      {/* Page header */}
      <div className="portal-page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
          <div className="portal-page-header__title">Avisos</div>
          {!loading && naoLidas > 0 && (
            <span style={{
              background: "var(--accent)", color: "#fff",
              fontSize: "var(--t-xs)", fontWeight: 700,
              padding: "2px 8px", borderRadius: 99,
            }}>
              {naoLidas} novo{naoLidas > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="portal-page-header__sub">Comunicados e notificações da sua UBS</div>
      </div>

      {/* Desktop layout: filters sidebar + card grid */}
      <div className="portal-notif-layout">

        {/* Sidebar filters (desktop) */}
        <div className="portal-notif-filters">
          <div className="portal-notif-filters__title">Filtrar</div>
          {FILTERS.map(f => {
            const count = countFor(f.id);
            if (f.id !== "todos" && f.id !== "nao-lidas" && count === 0) return null;
            return (
              <button
                key={f.id}
                className={"portal-notif-filter-btn" + (filtro === f.id ? " portal-notif-filter-btn--active" : "")}
                onClick={() => setFiltro(f.id)}
              >
                {f.label}
                {count > 0 && (
                  <span className="portal-notif-filter-count">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div>
          {/* Mobile filter pills */}
          <div className="portal-notif-filter-bar">
            {FILTERS.map(f => {
              const count = countFor(f.id);
              if (f.id !== "todos" && f.id !== "nao-lidas" && count === 0) return null;
              return (
                <button
                  key={f.id}
                  className={"portal-notif-filter-pill" + (filtro === f.id ? " portal-notif-filter-pill--active" : "")}
                  onClick={() => setFiltro(f.id)}
                >
                  {f.label}
                  {count > 0 && <span style={{ marginLeft: 4, opacity: .7 }}>{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Loading */}
          {loading && (
            <div className="portal-notif-card-grid">
              {[1,2,3,4].map(i => (
                <div key={i} className="portal-skeleton" style={{ height: 96, borderRadius: 16 }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && lista.length === 0 && (
            <div className="portal-empty">
              <div className="portal-empty__icon"><IcoBell /></div>
              <div className="portal-empty__title">Sem avisos</div>
              <div className="portal-empty__text">Quando sua UBS enviar comunicados, eles aparecerão aqui.</div>
            </div>
          )}

          {/* No results for filter */}
          {!loading && lista.length > 0 && filtrada.length === 0 && (
            <div style={{
              textAlign: "center", padding: "var(--s-10) var(--s-4)",
              color: "var(--text-muted)", fontSize: "var(--t-sm)",
            }}>
              Nenhum aviso para este filtro.
            </div>
          )}

          {/* Card grid */}
          {!loading && filtrada.length > 0 && (
            <div className="portal-notif-card-grid">
              {filtrada.map(n => <NotifCard key={n.id} notif={n} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
