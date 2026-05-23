import { useState, useEffect } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import KPI from "../components/ui/KPI";
import Select from "../components/ui/Select";
import { parseLocalDate } from "../utils/dates";
import { fmtDate } from "../utils/formatting";

const TASK_TYPES = {
  home_visit:      { label: "Visita Domiciliar",     color: "blue"   },
  active_search:   { label: "Busca Ativa",            color: "amber"  },
  return_visit:    { label: "Retorno",                color: "violet" },
  vaccination:     { label: "Vacinação",              color: "green"  },
  pregnant_follow: { label: "Acomp. Gestante",        color: "pink"   },
  chronic_follow:  { label: "Hipert./Diabéticos",     color: "orange" },
  child_follow:    { label: "Acomp. Infantil",        color: "teal"   },
  other:           { label: "Outro",                  color: "slate"  },
};

const PRIORITY_CONFIG = {
  urgent: { label: "Urgente",  cls: "acs-priority--urgent" },
  normal: { label: "Normal",   cls: "acs-priority--normal" },
  fit_in: { label: "Encaixe",  cls: "acs-priority--fit-in" },
};

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

function AcsTasksPage({ patients, users, user, token, onNavigatePatient }) {
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]         = useState("pending");
  const [typeFilter, setTypeFilter]   = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [patientSearch, setPatientSearch]   = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

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

  const myTasks = allTasks.filter(t => !t.assigneeId || t.assigneeId === user?.id);

  const filtered = myTasks.filter(t => {
    const statusOk   = filter === "all" || (filter === "pending" ? t.status !== "done" : t.status === "done");
    const typeOk     = typeFilter === "all" || t.type === typeFilter;
    const priorityOk = priorityFilter === "all" || t.priority === priorityFilter;
    const patOk      = !patientSearch.trim() || String(t.patientName || "").toLowerCase().includes(patientSearch.trim().toLowerCase());
    const fromOk     = !dateFrom || (t.dueDate && t.dueDate >= dateFrom);
    const toOk       = !dateTo   || (t.dueDate && t.dueDate <= dateTo);
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

  const typeOptions     = [["all", "Todos os tipos"],     ...Object.entries(TASK_TYPES).map(([k, v]) => [k, v.label])];
  const priorityOptions = [["all", "Todas as prioridades"], ...Object.entries(PRIORITY_CONFIG).map(([k, v]) => [k, v.label])];

  return (
    <div className="acs-page">
      <PageHeader
        eyebrow="Vitras · ACS"
        title="Tarefas"
        subtitle="Atividades e visitas atribuídas aos pacientes da sua microárea."
      />

      <div className="acs-kpis">
        <KPI label="Pendentes"  value={pendingCount} className="card" />
        <KPI label="Urgentes"   value={urgentCount}  className={`card${urgentCount > 0  ? " kpi--danger"  : ""}`} />
        <KPI label="Em atraso"  value={overdueCount} className={`card${overdueCount > 0 ? " kpi--warning" : ""}`} />
        <KPI label="Concluídas" value={doneCount}    className="card kpi--success" />
      </div>

      <div className="acs-toolbar">
        <input
          className="acs-search-input"
          type="text"
          value={patientSearch}
          onChange={e => setPatientSearch(e.target.value)}
          placeholder="Buscar paciente..."
          aria-label="Buscar paciente"
        />
        <div className="acs-filters">
          {[["pending", "Pendentes"], ["done", "Concluídas"], ["all", "Todas"]].map(([val, lbl]) => (
            <Button key={val} type="button" variant={filter === val ? "primary" : "secondary"} size="sm" className={`acs-filter-btn${filter === val ? " is-active" : ""}`} onClick={() => setFilter(val)}>
              {lbl}
            </Button>
          ))}
        </div>
        <Select
          className="acs-type-filter"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          aria-label="Filtrar por tipo"
        >
          {typeOptions.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
        </Select>
        <Select
          className="acs-type-filter"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          aria-label="Filtrar por prioridade"
        >
          {priorityOptions.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
        </Select>
        <input className="acs-date-filter" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} aria-label="Data a partir de" title="Data a partir de" />
        <input className="acs-date-filter" type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   aria-label="Data até"         title="Data até" />
      </div>

      {loading ? (
        <div className="acs-loading">Carregando tarefas...</div>
      ) : !sorted.length ? (
        <div className="acs-empty">
          <div className="acs-empty__icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <path d="M6 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="acs-empty__title">Nenhuma tarefa encontrada.</div>
          <div className="acs-empty__sub">Ajuste os filtros ou selecione outro período para visualizar as atividades.</div>
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="acs-task__pat-btn"
                        onClick={() => onNavigatePatient && onNavigatePatient(t.patientId)}
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        {t.patientName}
                      </Button>
                      {t.dueDate && <span className="acs-task__due">Prazo: {fmtDate(t.dueDate)}</span>}
                    </div>
                  </div>
                  <div className="acs-task__controls">
                    <Select
                      className="acs-task__status"
                      value={t.status || "pending"}
                      onChange={e => changeStatus(t, e.target.value)}
                      aria-label="Status da tarefa"
                    >
                      <option value="pending">Pendente</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="done">Concluída</option>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AcsTasksPage;
