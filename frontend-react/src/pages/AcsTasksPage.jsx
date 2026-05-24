import { useState, useEffect, useMemo } from "react";
import PageHeader from "../components/layout/PageHeader";
import KPI from "../components/ui/KPI";
import { parseLocalDate } from "../utils/dates";
import { fmtDate } from "../utils/formatting";

const TASK_TYPES = {
  home_visit:      { label: "Visita Domiciliar",  color: "blue"   },
  active_search:   { label: "Busca Ativa",         color: "amber"  },
  return_visit:    { label: "Retorno",             color: "violet" },
  vaccination:     { label: "Vacinação",           color: "green"  },
  pregnant_follow: { label: "Acomp. Gestante",     color: "pink"   },
  chronic_follow:  { label: "Hipert./Diabéticos",  color: "orange" },
  child_follow:    { label: "Acomp. Infantil",     color: "teal"   },
  other:           { label: "Outro",               color: "slate"  },
};

const PRIORITY_CONFIG = {
  urgent: { label: "Urgente",  cls: "acs-priority--urgent" },
  normal: { label: "Normal",   cls: "acs-priority--normal" },
  fit_in: { label: "Encaixe",  cls: "acs-priority--fit-in" },
};

const PERIOD_PRESETS = [
  ["",       "Tudo"],
  ["today",  "Hoje"],
  ["week",   "Semana"],
  ["month",  "Mês"],
  ["custom", "Personalizado"],
];

function dateRange(preset) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const fmt = (d) => d.toISOString().split("T")[0];
  if (preset === "today") {
    const d = fmt(now);
    return { from: d, to: d };
  }
  if (preset === "week") {
    const dow = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: fmt(start), to: fmt(end) };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmt(start), to: fmt(end) };
  }
  return { from: "", to: "" };
}

function urgencyClass(dueDate, status, today) {
  if (status === "done") return "done";
  if (!dueDate) return "ok";
  const diff = Math.ceil((new Date(dueDate + "T00:00:00") - today) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "ok";
}

function urgencyLabel(dueDate, status, today) {
  if (status === "done" || !dueDate) return "";
  const diff = Math.ceil((new Date(dueDate + "T00:00:00") - today) / 86400000);
  if (diff < 0) return `Atrasada ${Math.abs(diff)}d`;
  if (diff === 0) return "Hoje";
  return `${diff}d`;
}

function TypeBadge({ type }) {
  const cfg = TASK_TYPES[type];
  if (!cfg) return null;
  return <span className={`acs-type-badge acs-type-badge--${cfg.color}`}>{cfg.label}</span>;
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  if (!cfg) return null;
  return <span className={`acs-priority ${cfg.cls}`}>{cfg.label}</span>;
}

const PatBtn = ({ patientId, name, onNavigate }) => (
  <button
    type="button"
    className="acs-task__pat-btn"
    onClick={() => onNavigate && onNavigate(patientId)}
  >
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
    {name}
  </button>
);

const IconHome = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.5C5.52 1.5 3.5 3.52 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.48-2.02-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

function FamilyGroupsSection({ token, user, patients, onNavigatePatient }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch("/family-groups", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setGroups(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const patientMap = useMemo(() => {
    const m = {};
    for (const p of patients) m[p.id] = p;
    return m;
  }, [patients]);

  const myPatients = useMemo(() =>
    patients.filter(p => p.assignedAcsId === user?.id && !p.inactive),
    [patients, user?.id]
  );

  const groupedIds = useMemo(() => {
    const s = new Set();
    for (const g of groups) (g.memberPatientIds || []).forEach(id => s.add(id));
    return s;
  }, [groups]);

  const ungrouped = useMemo(() =>
    myPatients.filter(p => !groupedIds.has(p.id) && p.address?.trim()),
    [myPatients, groupedIds]
  );

  const noAddress = useMemo(() =>
    myPatients.filter(p => !p.address?.trim()),
    [myPatients]
  );

  const q = search.toLowerCase().trim();
  const filteredGroups = useMemo(() => {
    if (!q) return groups;
    return groups.filter(g => {
      if ((g.address || "").toLowerCase().includes(q)) return true;
      if ((g.microArea || "").toLowerCase().includes(q)) return true;
      return (g.memberPatientIds || []).some(id => {
        const p = patientMap[id];
        return p && p.name.toLowerCase().includes(q);
      });
    });
  }, [groups, q, patientMap]);

  if (loading) return <div className="acs-loading">Carregando grupos familiares...</div>;

  const hasResults = filteredGroups.length > 0 || ungrouped.length > 0 || noAddress.length > 0;

  return (
    <div className="acs-fg-section">
      <div className="acs-fg-note" aria-live="polite">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Grupos criados automaticamente a partir do endereço cadastrado do paciente.
      </div>

      <div className="acs-fg-search-wrap">
        <span className="acs-search-icon" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>
        <input
          className="acs-search-input acs-fg-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por endereço ou paciente..."
          aria-label="Buscar grupo familiar"
        />
      </div>

      {!hasResults ? (
        <div className="acs-empty">
          <div className="acs-empty__icon" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3 20c0-3.314 2.686-6 6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="17" cy="9" r="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M11 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <p className="acs-empty__title">Nenhum grupo familiar encontrado.</p>
          <p className="acs-empty__sub">Grupos são criados automaticamente quando dois ou mais pacientes compartilham o mesmo endereço.</p>
        </div>
      ) : (
        <>
          {filteredGroups.length > 0 && (
            <div className="acs-fg-list">
              {filteredGroups.map(fg => {
                const members = (fg.memberPatientIds || []).map(id => patientMap[id]).filter(Boolean);
                return (
                  <div key={fg.id} className="acs-fg-card">
                    <div className="acs-fg-card__head">
                      <div className="acs-fg-card__addr">
                        <IconHome />
                        {fg.address}
                      </div>
                      {fg.microArea && <span className="acs-fg-card__micro">{fg.microArea}</span>}
                    </div>
                    <div className="acs-fg-card__members">
                      {members.length > 0
                        ? members.map(m => (
                            <PatBtn key={m.id} patientId={m.id} name={m.name} onNavigate={onNavigatePatient} />
                          ))
                        : <span className="acs-fg-card__no-members">Nenhum membro ativo.</span>
                      }
                    </div>
                    {fg.transferHistory && fg.transferHistory.length > 0 && (
                      <div className="acs-fg-card__history">
                        Última transferência: {fmtDate(fg.transferHistory[fg.transferHistory.length - 1].transferredAt?.split("T")[0])}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {ungrouped.length > 0 && !q && (
            <div className="acs-fg-ungrouped">
              <p className="acs-fg-ungrouped__title">Sem grupo familiar definido ({ungrouped.length})</p>
              <div className="acs-fg-ungrouped__list">
                {ungrouped.map(p => (
                  <div key={p.id} className="acs-fg-ungrouped__item">
                    <PatBtn patientId={p.id} name={p.name} onNavigate={onNavigatePatient} />
                    <span className="acs-fg-ungrouped__addr">{p.address}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {noAddress.length > 0 && !q && (
            <div className="acs-fg-ungrouped acs-fg-ungrouped--warn">
              <p className="acs-fg-ungrouped__title">Endereço incompleto — sem grupo ({noAddress.length})</p>
              <div className="acs-fg-ungrouped__list">
                {noAddress.map(p => (
                  <div key={p.id} className="acs-fg-ungrouped__item">
                    <PatBtn patientId={p.id} name={p.name} onNavigate={onNavigatePatient} />
                    <span className="acs-fg-ungrouped__addr acs-fg-ungrouped__addr--missing">Sem endereço cadastrado</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AcsTasksPage({ patients, users, user, token, onNavigatePatient }) {
  const [allTasks, setAllTasks]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState("tasks");
  const [filter, setFilter]           = useState("pending");
  const [typeFilter, setTypeFilter]   = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [patientSearch, setPatientSearch]   = useState("");
  const [periodPreset, setPeriodPreset]     = useState("");
  const [customFrom, setCustomFrom]         = useState("");
  const [customTo, setCustomTo]             = useState("");

  useEffect(() => {
    if (!token) return;
    const myPatients = patients.filter(p => p.assignedAcsId === user?.id);
    if (!myPatients.length) { setAllTasks([]); setLoading(false); return; }
    setLoading(true);
    Promise.all(myPatients.map(p =>
      fetch(`/patients/${p.id}/tasks`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(tasks => (Array.isArray(tasks) ? tasks : []).map(t => ({
          ...t,
          patientId: p.id,
          patientName: p.name,
          patientBirth: p.birthDate,
          patientCareCategory: p.careCategory,
        })))
        .catch(() => [])
    ))
      .then(results => { setAllTasks(results.flat()); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, patients, user?.id]);

  const { effectiveDateFrom, effectiveDateTo } = useMemo(() => {
    if (periodPreset === "custom") return { effectiveDateFrom: customFrom, effectiveDateTo: customTo };
    const r = dateRange(periodPreset);
    return { effectiveDateFrom: r.from, effectiveDateTo: r.to };
  }, [periodPreset, customFrom, customTo]);

  const myTasks = allTasks.filter(t => !t.assigneeId || t.assigneeId === user?.id);

  const filtered = myTasks.filter(t => {
    const statusOk   = filter === "all" || (filter === "pending" ? t.status !== "done" : t.status === "done");
    const typeOk     = typeFilter === "all" || t.type === typeFilter;
    const priorityOk = priorityFilter === "all" || t.priority === priorityFilter;
    const patOk      = !patientSearch.trim() || String(t.patientName || "").toLowerCase().includes(patientSearch.trim().toLowerCase());
    const fromOk     = !effectiveDateFrom || (t.dueDate && t.dueDate >= effectiveDateFrom);
    const toOk       = !effectiveDateTo   || (t.dueDate && t.dueDate <= effectiveDateTo);
    return statusOk && typeOk && priorityOk && patOk && fromOk && toOk;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const sorted = [...filtered].sort((a, b) =>
    String(a.patientName || "").localeCompare(String(b.patientName || ""), "pt-BR", { sensitivity: "base" })
  );

  const overdueCount = myTasks.filter(t => t.status !== "done" && t.dueDate && parseLocalDate(t.dueDate) < today).length;
  const pendingCount = myTasks.filter(t => t.status !== "done").length;
  const urgentCount  = myTasks.filter(t => t.status !== "done" && t.priority === "urgent").length;
  const doneCount    = myTasks.filter(t => t.status === "done").length;

  async function changeStatus(task, status) {
    try {
      await fetch(`/patients/${task.patientId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setAllTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
    } catch {}
  }

  return (
    <div className="acs-page">
      <PageHeader
        eyebrow="Vitras · ACS"
        title="ACS"
        subtitle="Acompanhamento territorial, grupos familiares, visitas e obrigações da microárea."
      />

      <div className="acs-kpis">
        <KPI label="Pendentes"  value={pendingCount} className="card" />
        <KPI label="Urgentes"   value={urgentCount}  className={`card${urgentCount > 0  ? " kpi--danger"  : ""}`} />
        <KPI label="Em atraso"  value={overdueCount} className={`card${overdueCount > 0 ? " kpi--warning" : ""}`} />
        <KPI label="Concluídas" value={doneCount}    className="card kpi--success" />
      </div>

      <div className="acs-body">

        <div className="acs-tabs" role="tablist" aria-label="Seções ACS">
          {[["tasks", "Tarefas"], ["groups", "Grupos Familiares"]].map(([val, lbl]) => (
            <button
              key={val}
              type="button"
              role="tab"
              aria-selected={activeTab === val}
              className={`acs-tab${activeTab === val ? " is-active" : ""}`}
              onClick={() => setActiveTab(val)}
            >
              {lbl}
            </button>
          ))}
        </div>

        {activeTab === "tasks" && (
          <>
            <div className="acs-toolbar-card">
              <div className="acs-toolbar__row">
                <div className="acs-search-wrap">
                  <span className="acs-search-icon" aria-hidden="true">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    className="acs-search-input"
                    type="text"
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    placeholder="Buscar paciente..."
                    aria-label="Buscar paciente"
                  />
                </div>
                <div className="acs-status-group" role="group" aria-label="Filtrar por status">
                  {[["pending","Pendentes"],["done","Concluídas"],["all","Todas"]].map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      className={`acs-status-btn${filter === val ? " is-active" : ""}`}
                      onClick={() => setFilter(val)}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="acs-toolbar__row acs-toolbar__row--sep">
                <select
                  className="acs-select"
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  aria-label="Filtrar por tipo"
                >
                  <option value="all">Todos os tipos</option>
                  {Object.entries(TASK_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <select
                  className="acs-select"
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                  aria-label="Filtrar por prioridade"
                >
                  <option value="all">Todas as prioridades</option>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <div className="acs-period-group" role="group" aria-label="Filtrar por período">
                  {PERIOD_PRESETS.map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      className={`acs-period-btn${periodPreset === val ? " is-active" : ""}`}
                      onClick={() => setPeriodPreset(val)}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                {periodPreset === "custom" && (
                  <div className="acs-date-range">
                    <input
                      className="acs-date-input"
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      aria-label="Data inicial"
                      title="Data inicial"
                    />
                    <span className="acs-date-range__sep" aria-hidden="true">–</span>
                    <input
                      className="acs-date-input"
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      aria-label="Data final"
                      title="Data final"
                    />
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="acs-loading">Carregando tarefas...</div>
            ) : !sorted.length ? (
              <div className="acs-empty">
                <div className="acs-empty__icon" aria-hidden="true">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M6 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="acs-empty__title">Nenhuma tarefa encontrada.</p>
                <p className="acs-empty__sub">Ajuste os filtros ou selecione outro período para visualizar as atividades.</p>
              </div>
            ) : (
              <div className="acs-task-list">
                {sorted.map(t => {
                  const uc   = urgencyClass(t.dueDate, t.status, today);
                  const ul   = urgencyLabel(t.dueDate, t.status, today);
                  const done = t.status === "done";
                  return (
                    <div key={t.id} className={`acs-task acs-task--${uc}`}>
                      <div className="acs-task__head">
                        <div className="acs-task__body">
                          <div className="acs-task__title-row">
                            {t.type && <TypeBadge type={t.type} />}
                            {t.priority && t.priority !== "normal" && <PriorityBadge priority={t.priority} />}
                            <span className="acs-task__title">{t.title}</span>
                            {ul && !done && <span className="acs-task__urgency">{ul}</span>}
                          </div>
                          {t.notes && <p className="acs-task__notes">{t.notes}</p>}
                          <div className="acs-task__meta">
                            <PatBtn patientId={t.patientId} name={t.patientName} onNavigate={onNavigatePatient} />
                            {t.dueDate && <span className="acs-task__due">Prazo: {fmtDate(t.dueDate)}</span>}
                          </div>
                        </div>
                        <div className="acs-task__controls">
                          <select
                            className="acs-task__status"
                            value={t.status || "pending"}
                            onChange={e => changeStatus(t, e.target.value)}
                            aria-label="Status da tarefa"
                          >
                            <option value="pending">Pendente</option>
                            <option value="in_progress">Em andamento</option>
                            <option value="done">Concluída</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "groups" && (
          <FamilyGroupsSection
            token={token}
            user={user}
            patients={patients}
            onNavigatePatient={onNavigatePatient}
          />
        )}
      </div>
    </div>
  );
}

export default AcsTasksPage;
