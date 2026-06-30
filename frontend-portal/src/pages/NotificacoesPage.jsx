import { useEffect, useState } from "react";
import { getNotificacoes } from "../services/notificacoesService.js";

const TIPO_COLOR = {
  consulta:  "chip--teal",
  vacina:    "chip--amber",
  exame:     "chip--green",
  campanha:  "chip--slate",
  medicamento: "chip--blue",
};
const TIPO_LABEL = {
  consulta:  "Consulta",
  vacina:    "Vacina",
  exame:     "Exame",
  campanha:  "Campanha",
  medicamento: "Medicamento",
};

export default function NotificacoesPage() {
  const [lista,   setLista]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotificacoes()
      .then(setLista)
      .finally(() => setLoading(false));
  }, []);

  const naoLidas = lista.filter(n => !n.lida);
  const lidas    = lista.filter(n =>  n.lida);

  return (
    <div>
      <div className="portal-page-header">
        <div className="portal-page-header__title">Avisos</div>
        <div className="portal-page-header__sub">
          {loading ? "" : naoLidas.length > 0 ? `${naoLidas.length} não lido${naoLidas.length > 1 ? "s" : ""}` : "Tudo em dia"}
        </div>
      </div>

      {loading && (
        <div className="portal-list">
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {!loading && lista.length === 0 && (
        <div className="portal-empty">
          <div className="portal-empty__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div className="portal-empty__title">Sem avisos</div>
          <div className="portal-empty__text">Quando sua UBS enviar comunicados, eles aparecerão aqui.</div>
        </div>
      )}

      {!loading && naoLidas.length > 0 && (
        <div className="portal-section">
          <div className="portal-section__title">Novos</div>
          <div className="portal-list">
            {naoLidas.map(n => <NotifItem key={n.id} notif={n} />)}
          </div>
        </div>
      )}

      {!loading && lidas.length > 0 && (
        <div className="portal-section">
          <div className="portal-section__title">Anteriores</div>
          <div className="portal-list">
            {lidas.map(n => <NotifItem key={n.id} notif={n} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifItem({ notif }) {
  return (
    <div className={"portal-notif-item" + (!notif.lida ? " portal-notif-item--unread" : "")}>
      <div className={"portal-notif-item__dot" + (notif.lida ? " portal-notif-item__dot--empty" : "")} />
      <div className="portal-notif-item__body">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginBottom: "var(--s-1)" }}>
          <span className="portal-notif-item__title">{notif.titulo}</span>
          <span className={"chip " + (TIPO_COLOR[notif.tipo] || "chip--slate")}>
            {TIPO_LABEL[notif.tipo] || notif.tipo}
          </span>
        </div>
        <div className="portal-notif-item__text">{notif.texto}</div>
        <div className="portal-notif-item__time">{notif.data}</div>
      </div>
    </div>
  );
}
