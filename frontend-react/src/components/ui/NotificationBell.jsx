import { useState, useEffect, useMemo, useRef } from "react";
import { readLS, writeLS } from "../../utils/storage";
import { buildProactiveAlerts } from "../../utils/clinical";
import Button from "./Button";

function NotificationBell({ user, patients, protocolByPatient, pharmacyStock, agenda, labNotifications, onNavigate }) {
  const userId = user?.id || "anon";
  const NOTIF_SEEN_KEY = `vitras_notif_seen_${userId}_v1`;
  const NOTIF_CLEARED_AT_KEY = `vitras_notif_cleared_at_${userId}_v1`;

  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState(() => new Set(readLS(NOTIF_SEEN_KEY, [])));
  const [clearedAt, setClearedAt] = useState(() => String(readLS(NOTIF_CLEARED_AT_KEY, "")));
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allAlerts = useMemo(() => {
    const base = buildProactiveAlerts(patients, protocolByPatient, pharmacyStock, agenda);
    const labAlerts = (labNotifications || []).map((n) => ({
      id: `lab-${n.id}`,
      type: n.type || "info",
      title: n.title,
      detail: n.detail,
      patientId: n.patientId,
      createdAt: n.createdAt,
    }));
    return [...labAlerts, ...base].slice(0, 30);
  }, [patients, protocolByPatient, pharmacyStock, agenda, labNotifications]);

  useEffect(() => {
    if (!allAlerts.length) return;
    const activeIds = new Set(allAlerts.map(a => a.id));
    setSeenIds(prev => {
      const pruned = new Set([...prev].filter(id => activeIds.has(id)));
      if (pruned.size !== prev.size) {
        writeLS(NOTIF_SEEN_KEY, [...pruned]);
        return pruned;
      }
      return prev;
    });
  }, [allAlerts]);

  const unseenAlerts = useMemo(() => {
    const watermark = Date.parse(clearedAt || "");
    return allAlerts.filter((a) => {
      if (seenIds.has(a.id)) return false;
      if (!Number.isFinite(watermark)) return true;
      const createdAt = Date.parse(String(a.createdAt || ""));
      if (!Number.isFinite(createdAt)) return true;
      return createdAt > watermark;
    });
  }, [allAlerts, seenIds, clearedAt]);

  function markSeen(id, e) {
    e.stopPropagation();
    setSeenIds(prev => {
      const next = new Set(prev);
      next.add(id);
      writeLS(NOTIF_SEEN_KEY, [...next]);
      return next;
    });
  }

  function clearAllSeen() {
    const allIds = new Set(allAlerts.map(a => a.id));
    setSeenIds(allIds);
    writeLS(NOTIF_SEEN_KEY, [...allIds]);
    const nowIso = new Date().toISOString();
    setClearedAt(nowIso);
    writeLS(NOTIF_CLEARED_AT_KEY, nowIso);
  }

  const unseenCount = unseenAlerts.length;
  const hasDanger = unseenAlerts.some(a => a.type === "danger");

  return (
    <div ref={ref} className="notif-bell">
      <Button className="notif-bell__btn" variant="ghost" onClick={() => setOpen(v => !v)}>
        <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
          <path d="M10 2a6 6 0 00-6 6v3.5L2.5 14h15L16 11.5V8a6 6 0 00-6-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M8 14.5a2 2 0 004 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {unseenCount > 0 && (
          <span className={`notif-bell__badge notif-bell__badge--${hasDanger ? "danger" : "warn"}`}>
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </Button>
      {open && (
        <div className="notif-bell__panel">
          <div className="notif-bell__panel-head">
            <span className="notif-bell__panel-title">Alertas do sistema</span>
            <div className="notif-bell__panel-meta">
              {unseenCount > 0 && (
                <span className="notif-bell__unseen-count">{unseenCount} não visto{unseenCount !== 1 ? "s" : ""}</span>
              )}
              {unseenCount > 1 && (
                <Button className="notif-bell__clear-btn" variant="ghost" onClick={clearAllSeen} title="Marcar todos como vistos">
                  Limpar todos
                </Button>
              )}
            </div>
          </div>
          {!unseenCount && (
            <p className="notif-bell__panel-empty">
              {allAlerts.length > 0 ? "Todos os alertas foram vistos" : "Nenhum alerta no momento"}
            </p>
          )}
          {unseenAlerts.map(a => {
            const typeClass = a.type === "danger"
              ? "notif-bell__item--danger"
              : a.type === "warn"
              ? "notif-bell__item--warn"
              : "notif-bell__item--info";
            return (
              <div key={a.id} className={`notif-bell__item ${typeClass}${a.patientId ? " notif-bell__item--nav" : ""}`}>
                <span
                  className="notif-bell__item-body"
                  onClick={() => { if (a.patientId && onNavigate) { onNavigate(a.patientId); setOpen(false); } }}>
                  <span className="notif-bell__item-icon">
                    {a.type === "danger"
                      ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      : a.type === "warn"
                      ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2L14.5 13.5H1.5L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M8 7v2.5M8 11.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7.5v4M8 5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    }
                  </span>
                  <div className="notif-bell__item-copy">
                    <div className="notif-bell__item-title">{a.title}</div>
                    <div className="notif-bell__item-detail">{a.detail}</div>
                  </div>
                </span>
                <Button
                  className="notif-bell__item-dismiss"
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={e => markSeen(a.id, e)}
                  title="Marcar como visto">
                  <svg viewBox="0 0 12 12" fill="none" width="9" height="9">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
