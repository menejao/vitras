import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "../api";
import PageHeader from "../components/layout/PageHeader";
import KPI from "../components/ui/KPI";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import { parseLocalDate } from "../utils/dates";
import { fmtDate, initials, maskCpf, formatPhone } from "../utils/formatting";
import { matchesPatientSearch, ageInMonths } from "../utils/clinical";

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

// ── FamilyGroupWorkspace ────────────────────────────────────────────────────

const SEVERITY_CLS = { danger: "fg-ws-pend--danger", warn: "fg-ws-pend--warn", info: "fg-ws-pend--info" };

const TIMELINE_ICON = {
  group_created:   "🏠",
  member_joined:   "➕",
  member_left:     "➖",
  group_transferred: "🔄",
  visit:           "👣",
  task_done:       "✅",
};

function HousingRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="fg-ws-housing-row">
      <span className="fg-ws-housing-row__label">{label}</span>
      <span className="fg-ws-housing-row__val">{String(value)}</span>
    </div>
  );
}

function FamilyGroupWorkspace({ groupId, token, onBack, onNavigatePatient, onStartVisit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openBlock, setOpenBlock] = useState({ summary: true, members: true, visits: false, tasks: false, housing: false, pendencies: true, timeline: false });

  useEffect(() => {
    if (!groupId || !token) return;
    setLoading(true);
    setError("");
    fetch(`${API_URL}/family-groups/${groupId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d?.error || "Erro")))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(typeof e === "string" ? e : "Erro ao carregar grupo."); setLoading(false); });
  }, [groupId, token]);

  function toggle(block) {
    setOpenBlock(s => ({ ...s, [block]: !s[block] }));
  }

  if (loading) return <div className="acs-loading">Carregando workspace do grupo...</div>;
  if (error)   return <div className="acs-vis-error">{error}</div>;
  if (!data)   return null;

  const { group, acsName, members, visits, tasks, household, pendencies, timeline } = data;
  const activeMembers = members.filter(m => !m.inactive);
  const pendingTasks  = tasks.filter(t => t.status !== "done");
  const doneTasks     = tasks.filter(t => t.status === "done");

  return (
    <div className="fg-ws">
      {/* Header */}
      <div className="fg-ws__header">
        <button type="button" className="acs-vis-back-btn" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Grupos familiares
        </button>
        <div className="fg-ws__title-row">
          <span className="fg-ws__addr">
            <IconHome /> {group.address}
          </span>
          {group.microArea && <span className="acs-fg-card__micro">{group.microArea}</span>}
        </div>
        {pendencies.length > 0 && (
          <div className="fg-ws__pend-bar">
            {pendencies.filter(p => p.severity === "danger").length > 0 && (
              <span className="fg-ws-pend-chip fg-ws-pend-chip--danger">
                {pendencies.filter(p => p.severity === "danger").length} critica{pendencies.filter(p => p.severity === "danger").length > 1 ? "s" : ""}
              </span>
            )}
            {pendencies.filter(p => p.severity === "warn").length > 0 && (
              <span className="fg-ws-pend-chip fg-ws-pend-chip--warn">
                {pendencies.filter(p => p.severity === "warn").length} atenção
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          className="acs-vis-new-btn fg-ws__new-visit-btn"
          onClick={() => onStartVisit && onStartVisit(activeMembers[0] || null)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Nova Visita
        </button>
      </div>

      {/* Block 1 — Summary */}
      <FgBlock label="Resumo" open={openBlock.summary} onToggle={() => toggle("summary")}>
        <div className="fg-ws-summary">
          <div className="fg-ws-summary__row"><span>ACS responsável</span><strong>{acsName || "—"}</strong></div>
          <div className="fg-ws-summary__row"><span>Moradores ativos</span><strong>{activeMembers.length}</strong></div>
          <div className="fg-ws-summary__row"><span>Microárea</span><strong>{group.microArea || "—"}</strong></div>
          <div className="fg-ws-summary__row"><span>Criado em</span><strong>{fmtDate(group.createdAt?.slice(0, 10))}</strong></div>
          <div className="fg-ws-summary__row"><span>Atualizado em</span><strong>{fmtDate(group.updatedAt?.slice(0, 10))}</strong></div>
        </div>
      </FgBlock>

      {/* Block 2 — Residents */}
      <FgBlock label={`Moradores (${activeMembers.length})`} open={openBlock.members} onToggle={() => toggle("members")} badge={activeMembers.length}>
        {activeMembers.length === 0
          ? <p className="fg-ws-empty-msg">Nenhum morador ativo vinculado.</p>
          : (
            <div className="fg-ws-members">
              {activeMembers.map(m => (
                <div key={m.id} className="fg-ws-member">
                  <div className="fg-ws-member__name-row">
                    <button type="button" className="fg-ws-member__name-btn" onClick={() => onNavigatePatient && onNavigatePatient(m.id)}>
                      {m.socialName || m.name}
                    </button>
                    {m.ageYears != null && <span className="fg-ws-member__meta">{m.ageYears} anos</span>}
                    {m.sex && <span className="fg-ws-member__meta">{m.sex === "M" ? "Masc." : m.sex === "F" ? "Fem." : m.sex}</span>}
                  </div>
                  <div className="fg-ws-member__detail-row">
                    {m.cns ? <span className="fg-ws-member__cns">CNS {m.cns}</span> : <span className="fg-ws-member__cns fg-ws-member__cns--missing">Sem CNS</span>}
                    {m.phone && <span className="fg-ws-member__meta">{m.phone}</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </FgBlock>

      {/* Block 3 — Visits */}
      <FgBlock label={`Visitas (${visits.length})`} open={openBlock.visits} onToggle={() => toggle("visits")} badge={visits.length}>
        {visits.length === 0
          ? <p className="fg-ws-empty-msg">Nenhuma visita registrada para este grupo.</p>
          : (
            <div className="fg-ws-visits">
              {visits.slice(0, 10).map(v => (
                <div key={v.id} className="fg-ws-visit-row">
                  <span className={`acs-vis-desfecho ${DESFECHO_CLS[v.desfecho] || ""}`}>
                    {DESFECHO_LABEL[v.desfecho] || v.desfecho}
                  </span>
                  <span className="fg-ws-visit-row__date">{fmtDate(v.date)}</span>
                  <span className="fg-ws-visit-row__patient">{v.patientName || "—"}</span>
                  {v.turno && <span className="fg-ws-visit-row__turno">{v.turno === "manha" ? "Manhã" : v.turno === "tarde" ? "Tarde" : "Noite"}</span>}
                </div>
              ))}
              {visits.length > 10 && <p className="fg-ws-more">+ {visits.length - 10} anteriores</p>}
            </div>
          )
        }
      </FgBlock>

      {/* Block 4 — Tasks */}
      <FgBlock label={`Tarefas (${pendingTasks.length} pendentes)`} open={openBlock.tasks} onToggle={() => toggle("tasks")} badge={pendingTasks.length}>
        {tasks.length === 0
          ? <p className="fg-ws-empty-msg">Nenhuma tarefa para moradores deste grupo.</p>
          : (
            <div className="fg-ws-tasks">
              {pendingTasks.length > 0 && (
                <>
                  <p className="fg-ws-tasks__section-label">Pendentes</p>
                  {pendingTasks.map(t => (
                    <div key={t.id} className="fg-ws-task-row">
                      <span className="fg-ws-task-row__title">{t.title}</span>
                      {t.dueDate && <span className="fg-ws-task-row__due">{fmtDate(t.dueDate)}</span>}
                    </div>
                  ))}
                </>
              )}
              {doneTasks.length > 0 && (
                <>
                  <p className="fg-ws-tasks__section-label">Concluídas ({doneTasks.length})</p>
                  {doneTasks.slice(0, 5).map(t => (
                    <div key={t.id} className="fg-ws-task-row fg-ws-task-row--done">
                      <span className="fg-ws-task-row__title">{t.title}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )
        }
      </FgBlock>

      {/* Block 5 — Housing conditions */}
      <FgBlock label="Condições de Moradia" open={openBlock.housing} onToggle={() => toggle("housing")}>
        {!household
          ? <p className="fg-ws-empty-msg">Cadastro domiciliar não disponível.</p>
          : (
            <div className="fg-ws-housing">
              <HousingRow label="Tipo de imóvel"      value={household.tipoImovel || household.housingType} />
              <HousingRow label="Situação de posse"   value={household.situacaoMoradiaPosseTerra} />
              <HousingRow label="Nº de cômodos"       value={household.numComodos} />
              <HousingRow label="Nº de moradores"     value={household.numMoradores} />
              <HousingRow label="Abastecimento água"  value={household.abastecimentoAgua} />
              <HousingRow label="Tratamento água"     value={household.tratamentoAgua} />
              <HousingRow label="Esgotamento"         value={household.esgotamento} />
              <HousingRow label="Destino do lixo"     value={household.destinacaoLixo} />
              <HousingRow label="Energia elétrica"    value={household.energiaEletrica != null ? (household.energiaEletrica ? "Sim" : "Não") : null} />
              <HousingRow label="Localização"         value={household.localizacao} />
            </div>
          )
        }
      </FgBlock>

      {/* Block 6 — Pendencies */}
      <FgBlock label={`Pendências${pendencies.length > 0 ? ` (${pendencies.length})` : ""}`} open={openBlock.pendencies} onToggle={() => toggle("pendencies")} badge={pendencies.filter(p => p.severity === "danger").length || undefined}>
        {pendencies.length === 0
          ? <p className="fg-ws-empty-msg fg-ws-empty-msg--ok">Nenhuma pendência identificada.</p>
          : (
            <div className="fg-ws-pendings">
              {pendencies.map((p, i) => (
                <div key={i} className={`fg-ws-pend ${SEVERITY_CLS[p.severity] || ""}`}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 3v5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                  {p.label}
                </div>
              ))}
            </div>
          )
        }
      </FgBlock>

      {/* Block 7 — Timeline */}
      <FgBlock label="Histórico" open={openBlock.timeline} onToggle={() => toggle("timeline")}>
        {timeline.length === 0
          ? <p className="fg-ws-empty-msg">Sem eventos registrados.</p>
          : (
            <div className="fg-ws-timeline">
              {timeline.map((ev, i) => (
                <div key={i} className="fg-ws-tl-event">
                  <span className="fg-ws-tl-event__icon" aria-hidden="true">{TIMELINE_ICON[ev.type] || "•"}</span>
                  <div className="fg-ws-tl-event__body">
                    <span className="fg-ws-tl-event__label">{ev.label}</span>
                    <span className="fg-ws-tl-event__date">{fmtDate(ev.at?.slice(0, 10))}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </FgBlock>
    </div>
  );
}

function FgBlock({ label, open, onToggle, badge, children }) {
  return (
    <div className={`fg-ws-block${open ? " is-open" : ""}`}>
      <button type="button" className="fg-ws-block__toggle" onClick={onToggle} aria-expanded={open}>
        <span className="fg-ws-block__title">{label}</span>
        {badge > 0 && <span className="acs-vis-block__badge">{badge}</span>}
        <svg className="acs-vis-block__chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && <div className="fg-ws-block__body">{children}</div>}
    </div>
  );
}

// ── FamilyGroupsSection ─────────────────────────────────────────────────────

function FamilyGroupsSection({ token, user, patients, onNavigatePatient, onStartVisitForGroup }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeGroupId, setActiveGroupId] = useState(() => {
    const pending = sessionStorage.getItem("vitras_openGroupId");
    if (pending) { sessionStorage.removeItem("vitras_openGroupId"); return pending; }
    return null;
  });

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/family-groups`, { headers: { Authorization: `Bearer ${token}` } })
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
        return p && (
          p.name.toLowerCase().includes(q) ||
          (p.socialName || "").toLowerCase().includes(q) ||
          (p.cns || "").replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
          (p.cpf || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
        );
      });
    });
  }, [groups, q, patientMap]);

  if (loading) return <div className="acs-loading">Carregando grupos familiares...</div>;

  // Workspace view
  if (activeGroupId) {
    return (
      <FamilyGroupWorkspace
        groupId={activeGroupId}
        token={token}
        onBack={() => setActiveGroupId(null)}
        onNavigatePatient={onNavigatePatient}
        onStartVisit={onStartVisitForGroup}
      />
    );
  }

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
          placeholder="Buscar por endereço, nome, CNS ou CPF..."
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
                  <button
                    key={fg.id}
                    type="button"
                    className="acs-fg-card acs-fg-card--clickable"
                    onClick={() => setActiveGroupId(fg.id)}
                  >
                    <div className="acs-fg-card__head">
                      <div className="acs-fg-card__addr">
                        <IconHome />
                        {fg.address}
                      </div>
                      <div className="acs-fg-card__meta-row">
                        {fg.microArea && <span className="acs-fg-card__micro">{fg.microArea}</span>}
                        <span className="acs-fg-card__count">{members.length} morador{members.length !== 1 ? "es" : ""}</span>
                      </div>
                    </div>
                    <div className="acs-fg-card__members">
                      {members.length > 0
                        ? members.slice(0, 4).map(m => (
                            <span key={m.id} className="acs-fg-card__member-chip">{m.socialName || m.name}</span>
                          ))
                        : <span className="acs-fg-card__no-members">Nenhum membro ativo.</span>
                      }
                      {members.length > 4 && <span className="acs-fg-card__member-chip acs-fg-card__member-chip--more">+{members.length - 4}</span>}
                    </div>
                    {fg.transferHistory && fg.transferHistory.length > 0 && (
                      <div className="acs-fg-card__history">
                        Última transferência: {fmtDate(fg.transferHistory[fg.transferHistory.length - 1].transferredAt?.split("T")[0])}
                      </div>
                    )}
                    <span className="acs-fg-card__arrow" aria-hidden="true">›</span>
                  </button>
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

// ── Visitas constants ──────────────────────────────────────────────────────

const TURNO_OPTIONS = [
  { value: "manha",  label: "Manhã"   },
  { value: "tarde",  label: "Tarde"   },
  { value: "noite",  label: "Noite"   },
];

const DESFECHO_OPTIONS = [
  { value: "realizada",  label: "Visita realizada"  },
  { value: "recusada",   label: "Visita recusada"   },
  { value: "ausente",    label: "Morador ausente"   },
];

const MOTIVO_OPTIONS = [
  { key: "cadastro_atualizacao",      label: "Cadastramento / atualização cadastral"  },
  { key: "visita_periodica",          label: "Visita periódica"                       },
  { key: "busca_ativa",               label: "Busca ativa"                            },
  { key: "acompanhamento",            label: "Acompanhamento"                         },
  { key: "controle_ambiental",        label: "Controle ambiental / vetorial"          },
  { key: "convite_atividade",         label: "Convite para atividade coletiva"        },
  { key: "esus_rotina",               label: "e-SUS / rotina APS"                    },
];

const BUSCA_ATIVA_OPTIONS = [
  { key: "ba_consulta",         label: "Consulta"                          },
  { key: "ba_exame",            label: "Exame"                             },
  { key: "ba_vacina",           label: "Vacina"                            },
  { key: "ba_bolsa_familia",    label: "Condicionalidades do Bolsa Família"},
  { key: "ba_gestante",         label: "Gestante"                          },
  { key: "ba_puerpera",         label: "Puérpera"                          },
  { key: "ba_recem_nascido",    label: "Recém-nascido"                     },
  { key: "ba_crianca",          label: "Criança"                           },
  { key: "ba_tuberculose",      label: "Pessoa com tuberculose"            },
  { key: "ba_hanseniase",       label: "Pessoa com hanseníase"             },
  { key: "ba_hipertensao",      label: "Pessoa com hipertensão"            },
  { key: "ba_diabetes",         label: "Pessoa com diabetes"               },
  { key: "ba_asma",             label: "Pessoa com asma"                   },
  { key: "ba_dpoc",             label: "Pessoa com DPOC/enfisema"          },
  { key: "ba_cancer",           label: "Pessoa com câncer"                 },
  { key: "ba_cardiovascular",   label: "Pessoa com doença cardiovascular"  },
  { key: "ba_renal",            label: "Pessoa com doença renal"           },
  { key: "ba_sofrimento_mental",label: "Pessoa com sofrimento mental"      },
  { key: "ba_acamada",          label: "Pessoa acamada"                    },
  { key: "ba_domiciliada",      label: "Pessoa domiciliada"                },
  { key: "ba_alcool",           label: "Uso de álcool"                     },
  { key: "ba_outras_drogas",    label: "Uso de outras drogas"              },
];

const ACOMPANHAMENTO_OPTIONS = [
  { key: "ac_gestante",                label: "Gestante"                              },
  { key: "ac_puerpera",                label: "Puérpera"                              },
  { key: "ac_recem_nascido",           label: "Recém-nascido"                         },
  { key: "ac_crianca",                 label: "Criança"                               },
  { key: "ac_desnutrida",              label: "Pessoa com desnutrição"                },
  { key: "ac_reabilitacao",            label: "Pessoa em reabilitação ou deficiência" },
  { key: "ac_hipertensao",             label: "Pessoa com hipertensão"                },
  { key: "ac_diabetes",                label: "Pessoa com diabetes"                   },
  { key: "ac_asma",                    label: "Pessoa com asma"                       },
  { key: "ac_dpoc",                    label: "Pessoa com DPOC/enfisema"              },
  { key: "ac_cancer",                  label: "Pessoa com câncer"                     },
  { key: "ac_outras_doencas_cronicas", label: "Outras doenças crônicas"               },
  { key: "ac_hanseniase",              label: "Pessoa com hanseníase"                 },
  { key: "ac_tuberculose",             label: "Pessoa com tuberculose"                },
  { key: "ac_sintomaticos_resp",       label: "Sintomáticos respiratórios"            },
  { key: "ac_tabagista",               label: "Tabagista"                             },
  { key: "ac_acamada",                 label: "Pessoa acamada"                        },
  { key: "ac_vulnerabilidade_social",  label: "Vulnerabilidade social"                },
  { key: "ac_sofrimento_mental",       label: "Saúde mental"                          },
  { key: "ac_alcool",                  label: "Usuário de álcool"                     },
  { key: "ac_outras_drogas",           label: "Usuário de outras drogas"              },
  { key: "ac_pessoa_idosa",            label: "Pessoa idosa"                          },
];

const CONTROLE_AMBIENTAL_OPTIONS = [
  { key: "ca_acao_educativa",  label: "Ação educativa"    },
  { key: "ca_imovel_foco",     label: "Imóvel com foco"   },
  { key: "ca_acao_mecanica",   label: "Ação mecânica"     },
  { key: "ca_trat_focal",      label: "Tratamento focal"  },
];

// ── APS-01J: visit form enums ──────────────────────────────────────────────

const TIPO_IMOVEL_OPTIONS = [
  { value: "DOMICILIO",          label: "Domicílio"         },
  { value: "COMERCIO",           label: "Comércio"          },
  { value: "TERRENO_BALDIO",     label: "Terreno baldio"    },
  { value: "PONTO_ESTRATEGICO",  label: "Ponto estratégico" },
  { value: "OUTRO",              label: "Outro"             },
];

const RACA_COR_OPTIONS = [
  { value: "BRANCA",         label: "Branca"         },
  { value: "PRETA",          label: "Preta"          },
  { value: "PARDA",          label: "Parda"          },
  { value: "AMARELA",        label: "Amarela"        },
  { value: "INDIGENA",       label: "Indígena"       },
  { value: "SEM_INFORMACAO", label: "Sem informação" },
];

const ABAST_AGUA_OPTIONS = [
  { value: "REDE_PUBLICA",     label: "Rede pública"        },
  { value: "POCO_CISTERNA",    label: "Poço / cisterna"     },
  { value: "CARRO_PIPA",       label: "Carro pipa"          },
  { value: "AGUA_CHUVA",       label: "Água de chuva"       },
  { value: "RIO_LAGO_IGARAPE", label: "Rio / lago / igarapé"},
  { value: "OUTRO",            label: "Outro"               },
];

const TRATAMENTO_AGUA_OPTIONS = [
  { value: "FILTRACAO",      label: "Filtração"      },
  { value: "FERVURA",        label: "Fervura"        },
  { value: "CLORACAO",       label: "Cloração"       },
  { value: "MINERAL",        label: "Água mineral"   },
  { value: "SEM_TRATAMENTO", label: "Sem tratamento" },
];

const ESGOTAMENTO_OPTIONS = [
  { value: "REDE_COLETORA",    label: "Rede coletora"          },
  { value: "FOSSA_SEPTICA",    label: "Fossa séptica"          },
  { value: "FOSSA_RUDIMENTAR", label: "Fossa rudimentar"       },
  { value: "DIRETO_RIO",       label: "Direto para rio / lago" },
  { value: "CEU_ABERTO",       label: "Céu aberto"             },
  { value: "OUTRO",            label: "Outro"                  },
];

const DESTINO_LIXO_OPTIONS = [
  { value: "COLETA_PUBLICA", label: "Coleta pública"        },
  { value: "QUEIMADO",       label: "Queimado / enterrado"  },
  { value: "JOGADO_TERRENO", label: "Jogado em terreno"     },
  { value: "OUTRO",          label: "Outro"                 },
];

const SITUACAO_MORADIA_OPTIONS = [
  { value: "PROPRIO",      label: "Próprio"         },
  { value: "FINANCIADO",   label: "Financiado"      },
  { value: "ALUGADO",      label: "Alugado"         },
  { value: "CEDIDO",       label: "Cedido"          },
  { value: "OCUPACAO",     label: "Ocupação"        },
  { value: "SITUACAO_RUA", label: "Situação de rua" },
  { value: "OUTRO",        label: "Outro"           },
];

const VISIT_TABS = [
  { id: 1,  short: "Visita",    full: "Dados da Visita"      },
  { id: 2,  short: "Paciente",  full: "Paciente"             },
  { id: 3,  short: "Desfecho",  full: "Desfecho"             },
  { id: 4,  short: "Motivo",    full: "Motivo da Visita"     },
  { id: 5,  short: "Busca",     full: "Busca Ativa"          },
  { id: 6,  short: "Acomp.",    full: "Acompanhamento"       },
  { id: 7,  short: "Controle",  full: "Controle Ambiental"   },
  { id: 8,  short: "Sinais",    full: "Sinais Vitais"        },
  { id: 9,  short: "Família",   full: "Grupo Familiar"       },
  { id: 10, short: "Revisão",   full: "Revisão e Salvar"     },
];

function emptyVisitForm(today, patient) {
  return {
    date:               today,
    turno:              "manha",
    microarea:          patient?.microarea || patient?.microArea || "",
    foraArea:           false,
    tipoImovel:         "DOMICILIO",
    visitaCompartilhada: false,
    desfecho:           "realizada",
    motivos:            {},
    buscaAtiva:         {},
    acompanhamentos:    {},
    controleAmbiental:  {},
    peso:               "",
    altura:             "",
    temperatura:        "",
    paSistolica:        "",
    paDiastolica:       "",
    glicemia:           "",
    momentoGlicemia:    "jejum",
    observacoes:        "",
  };
}

// ── PatientSelector ────────────────────────────────────────────────────────

function ageStr(birthDate) {
  if (!birthDate) return "";
  const b = new Date(birthDate + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return `${age}a`;
}

function PatientSelector({ patients, onSelect, onCancel }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return patients.filter(p => {
      const name   = (p.name          || "").toLowerCase();
      const social = (p.socialName    || "").toLowerCase();
      const cpf    = (p.cpf           || "").replace(/\D/g, "");
      const cns    = (p.cns           || "").replace(/\D/g, "");
      const addr   = (p.address       || "").toLowerCase();
      const term_d = term.replace(/\D/g, "");
      return name.includes(term) || social.includes(term) ||
             (term_d && (cpf.includes(term_d) || cns.includes(term_d))) ||
             addr.includes(term);
    }).slice(0, 30);
  }, [patients, q]);

  return (
    <div className="acs-vis-selector">
      <div className="acs-vis-selector__header">
        <button type="button" className="acs-vis-back-btn" onClick={onCancel}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Voltar
        </button>
        <h3 className="acs-vis-selector__title">Selecionar Paciente</h3>
      </div>

      <div className="acs-vis-search-wrap">
        <span className="acs-search-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </span>
        <input
          ref={inputRef}
          className="acs-search-input"
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Nome, nome social, CPF, CNS, endereço..."
          aria-label="Buscar paciente"
        />
      </div>

      {q.trim() === "" ? (
        <p className="acs-vis-selector__empty">Digite nome, CPF ou CNS para buscar.</p>
      ) : results.length === 0 ? (
        <p className="acs-vis-selector__empty">Nenhum paciente encontrado.</p>
      ) : (
        <div className="acs-vis-selector__list">
          {results.map(p => {
            const displayName = p.socialName || p.name || "";
            const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
            const doc = p.cpf ? `CPF ${p.cpf}` : p.cns ? `CNS ${p.cns}` : "";
            return (
              <button
                key={p.id}
                type="button"
                className="acs-vis-pat-row"
                onClick={() => onSelect(p)}
              >
                <span className="acs-vis-pat-row__avatar" aria-hidden="true">{initials}</span>
                <span className="acs-vis-pat-row__info">
                  <span className="acs-vis-pat-row__name">
                    {p.socialName ? (
                      <><strong>{p.socialName}</strong><span className="acs-vis-pat-row__civil"> ({p.name})</span></>
                    ) : <strong>{p.name}</strong>}
                  </span>
                  <span className="acs-vis-pat-row__meta">
                    {ageStr(p.birthDate) && <span>{ageStr(p.birthDate)}</span>}
                    {p.phone && <span>{p.phone}</span>}
                    {doc && <span>{doc}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CheckGroup ─────────────────────────────────────────────────────────────

function CheckGroup({ options, values, onChange, columns = 2 }) {
  return (
    <div className="acs-vis-checkgroup" style={{ "--cg-cols": columns }}>
      {options.map(({ key, label }) => (
        <label key={key} className="acs-vis-check-label">
          <input
            type="checkbox"
            checked={!!values[key]}
            onChange={e => onChange(key, e.target.checked)}
            className="acs-vis-checkbox"
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

// ── Accordion block ─────────────────────────────────────────────────────────

function AccordionBlock({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`acs-vis-block${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="acs-vis-block__toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="acs-vis-block__title">{title}</span>
        {badge > 0 && <span className="acs-vis-block__badge">{badge}</span>}
        <svg className="acs-vis-block__chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && <div className="acs-vis-block__body">{children}</div>}
    </div>
  );
}

// ── VisitForm ──────────────────────────────────────────────────────────────

function VisitForm({ patient, taskOrigin, userId, token, onSave, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(() => emptyVisitForm(today, patient));
  const [activeTab, setActiveTab] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [familyGroup, setFamilyGroup] = useState(null);

  useEffect(() => {
    if (!token || !patient?.id) return;
    fetch(`${API_URL}/family-groups?patientId=${patient.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const groups = Array.isArray(data) ? data : [];
        const match = groups.find(g => (g.memberPatientIds || []).includes(patient.id));
        setFamilyGroup(match || null);
      })
      .catch(() => {});
  }, [token, patient?.id]);

  const upd = useCallback((field, val) =>
    setForm(s => ({ ...s, [field]: val })), []);

  const toggleMap = useCallback((mapField, key, checked) =>
    setForm(s => ({ ...s, [mapField]: { ...s[mapField], [key]: checked } })), []);

  const countChecked = obj => Object.values(obj).filter(Boolean).length;

  async function handleSubmit() {
    if (!form.date)     { setError("Informe a data da visita (Aba 1)."); setActiveTab(1); return; }
    if (!form.desfecho) { setError("Selecione o desfecho (Aba 3)."); setActiveTab(3); return; }
    setError("");
    setSaving(true);

    const body = {
      patientId:         patient.id,
      taskId:            taskOrigin?.id || null,
      date:              form.date,
      turno:             form.turno || null,
      microarea:         form.microarea || null,
      foraArea:          form.foraArea === true,
      tipoImovel:        form.tipoImovel || null,
      visitaCompartilhada: form.visitaCompartilhada === true,
      desfecho:          form.desfecho,
      motivos:           Object.keys(form.motivos).filter(k => form.motivos[k]),
      buscaAtiva:        Object.keys(form.buscaAtiva).filter(k => form.buscaAtiva[k]),
      acompanhamentos:   Object.keys(form.acompanhamentos).filter(k => form.acompanhamentos[k]),
      controleAmbiental: Object.keys(form.controleAmbiental).filter(k => form.controleAmbiental[k]),
      peso:              form.peso ? Number(form.peso) : null,
      altura:            form.altura ? Number(form.altura) : null,
      temperatura:       form.temperatura ? Number(form.temperatura) : null,
      paSistolica:       form.paSistolica ? Number(form.paSistolica) : null,
      paDiastolica:      form.paDiastolica ? Number(form.paDiastolica) : null,
      glicemia:          form.glicemia ? Number(form.glicemia) : null,
      momentoGlicemia:   form.glicemia ? (form.momentoGlicemia || "aleatorio") : null,
      observacoes:       form.observacoes || null,
    };

    try {
      const res = await fetch(`${API_URL}/acs-visits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `Erro ao salvar visita (${res.status}).`);
        return;
      }
      const visit = await res.json();
      onSave(visit);
    } catch {
      setError("Erro de conexão. Verifique a rede e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const tabRef = useRef(null);
  useEffect(() => {
    if (!tabRef.current) return;
    const active = tabRef.current.querySelector(".acs-vis-tab.is-active");
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeTab]);

  function renderTabContent() {
    switch (activeTab) {
      case 1:
        return (
          <div className="acs-vis-tab-body">
            <div className="acs-vis-fields">
              <div className="acs-vis-field">
                <label className="acs-vis-label" htmlFor="vis-date">Data</label>
                <input id="vis-date" className="acs-vis-input" type="date" value={form.date}
                  max={today} onChange={e => upd("date", e.target.value)} required />
              </div>
              <div className="acs-vis-field">
                <label className="acs-vis-label" htmlFor="vis-turno">Turno</label>
                <select id="vis-turno" className="acs-vis-select" value={form.turno} onChange={e => upd("turno", e.target.value)}>
                  {TURNO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="acs-vis-field">
                <label className="acs-vis-label" htmlFor="vis-microarea">Microárea</label>
                <input id="vis-microarea" className="acs-vis-input" type="text" maxLength={50}
                  value={form.microarea} onChange={e => upd("microarea", e.target.value)} placeholder="Ex: 01" />
              </div>
              <div className="acs-vis-field">
                <label className="acs-vis-label" htmlFor="vis-tipoimovel">Tipo de imóvel</label>
                <select id="vis-tipoimovel" className="acs-vis-select" value={form.tipoImovel} onChange={e => upd("tipoImovel", e.target.value)}>
                  <option value="">Não informado</option>
                  {TIPO_IMOVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="acs-vis-check-label">
                <input type="checkbox" className="acs-vis-checkbox" checked={form.foraArea}
                  onChange={e => upd("foraArea", e.target.checked)} />
                <span>Fora da área de cobertura</span>
              </label>
              <label className="acs-vis-check-label">
                <input type="checkbox" className="acs-vis-checkbox" checked={form.visitaCompartilhada}
                  onChange={e => upd("visitaCompartilhada", e.target.checked)} />
                <span>Visita compartilhada com outro profissional</span>
              </label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="acs-vis-tab-body">
            <div className="acs-vis-pat-info">
              {[
                ["Nome", patient.name],
                ["Nome social", patient.socialName],
                ["Nascimento", patient.birthDate ? `${patient.birthDate} (${ageStr(patient.birthDate)})` : null],
                ["Sexo", patient.sex === "male" || patient.sex === "masculino" ? "Masculino" : patient.sex === "female" || patient.sex === "feminino" ? "Feminino" : patient.sex],
                ["CPF", patient.cpf],
                ["CNS", patient.cns],
                ["Prontuário", patient.prontuarioFamiliar],
                ["Endereço", patient.address ? `${patient.address}${patient.addressNumber ? `, ${patient.addressNumber}` : ""}` : null],
                ["Microárea", patient.microarea || patient.microArea],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="acs-vis-pat-info-row">
                  <span className="acs-vis-pat-info-row__label">{label}</span>
                  <span className="acs-vis-pat-info-row__value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="acs-vis-tab-body">
            <div className="acs-vis-desfecho-group">
              {DESFECHO_OPTIONS.map(o => (
                <label key={o.value} className={`acs-vis-desfecho-opt${form.desfecho === o.value ? " is-selected" : ""}`}>
                  <input type="radio" name="desfecho" value={o.value}
                    checked={form.desfecho === o.value} onChange={() => upd("desfecho", o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="acs-vis-tab-body">
            <CheckGroup options={MOTIVO_OPTIONS} values={form.motivos}
              onChange={(k, v) => toggleMap("motivos", k, v)} columns={1} />
          </div>
        );

      case 5:
        return (
          <div className="acs-vis-tab-body">
            <CheckGroup options={BUSCA_ATIVA_OPTIONS} values={form.buscaAtiva}
              onChange={(k, v) => toggleMap("buscaAtiva", k, v)} />
          </div>
        );

      case 6:
        return (
          <div className="acs-vis-tab-body">
            <CheckGroup options={ACOMPANHAMENTO_OPTIONS} values={form.acompanhamentos}
              onChange={(k, v) => toggleMap("acompanhamentos", k, v)} />
          </div>
        );

      case 7:
        return (
          <div className="acs-vis-tab-body">
            <CheckGroup options={CONTROLE_AMBIENTAL_OPTIONS} values={form.controleAmbiental}
              onChange={(k, v) => toggleMap("controleAmbiental", k, v)} columns={2} />
          </div>
        );

      case 8:
        return (
          <div className="acs-vis-tab-body">
            <div className="acs-vis-fields">
              <div className="acs-vis-field">
                <label className="acs-vis-label" htmlFor="vis-peso">Peso (kg)</label>
                <input id="vis-peso" className="acs-vis-input" type="number" min="1" max="300" step="0.1"
                  value={form.peso} onChange={e => upd("peso", e.target.value)} placeholder="Ex: 65.5" />
              </div>
              <div className="acs-vis-field">
                <label className="acs-vis-label" htmlFor="vis-altura">Altura (cm)</label>
                <input id="vis-altura" className="acs-vis-input" type="number" min="30" max="250" step="0.5"
                  value={form.altura} onChange={e => upd("altura", e.target.value)} placeholder="Ex: 170" />
              </div>
              <div className="acs-vis-field">
                <label className="acs-vis-label" htmlFor="vis-temp">Temperatura (°C)</label>
                <input id="vis-temp" className="acs-vis-input" type="number" min="30" max="45" step="0.1"
                  value={form.temperatura} onChange={e => upd("temperatura", e.target.value)} placeholder="Ex: 36.5" />
              </div>
              <div className="acs-vis-field">
                <label className="acs-vis-label" htmlFor="vis-pas">PA Sistólica (mmHg)</label>
                <input id="vis-pas" className="acs-vis-input" type="number" min="50" max="300" step="1"
                  value={form.paSistolica} onChange={e => upd("paSistolica", e.target.value)} placeholder="Ex: 120" />
              </div>
              <div className="acs-vis-field">
                <label className="acs-vis-label" htmlFor="vis-pad">PA Diastólica (mmHg)</label>
                <input id="vis-pad" className="acs-vis-input" type="number" min="20" max="200" step="1"
                  value={form.paDiastolica} onChange={e => upd("paDiastolica", e.target.value)} placeholder="Ex: 80" />
              </div>
              <div className="acs-vis-field">
                <label className="acs-vis-label" htmlFor="vis-glic">Glicemia capilar (mg/dL)</label>
                <input id="vis-glic" className="acs-vis-input" type="number" min="10" max="600" step="1"
                  value={form.glicemia} onChange={e => upd("glicemia", e.target.value)} placeholder="Ex: 95" />
              </div>
              {form.glicemia && (
                <div className="acs-vis-field">
                  <label className="acs-vis-label" htmlFor="vis-momento">Momento da coleta</label>
                  <select id="vis-momento" className="acs-vis-select" value={form.momentoGlicemia} onChange={e => upd("momentoGlicemia", e.target.value)}>
                    <option value="jejum">Em jejum</option>
                    <option value="pos_prandial_1h">Pós-prandial 1h</option>
                    <option value="pos_prandial_2h">Pós-prandial 2h</option>
                    <option value="aleatorio">Aleatório</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="acs-vis-label">Observações</label>
              <textarea className="acs-vis-textarea" rows={3} value={form.observacoes}
                onChange={e => upd("observacoes", e.target.value)}
                placeholder="Anotações livres sobre a visita..." aria-label="Observações" />
            </div>
          </div>
        );

      case 9:
        return (
          <div className="acs-vis-tab-body acs-vis-fg-mini">
            {familyGroup ? (
              <>
                <p><strong>{familyGroup.address || "Endereço não informado"}</strong>
                  {familyGroup.microArea ? ` — Microárea ${familyGroup.microArea}` : ""}</p>
                <div className="acs-vis-fg-mini__members">
                  {(familyGroup.memberPatientIds || []).map(id => (
                    <span key={id} className="acs-vis-fg-mini__chip">{id}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="acs-vis-fg-mini__empty">Nenhum grupo familiar encontrado para este paciente.</p>
            )}
          </div>
        );

      case 10:
        return (
          <div className="acs-vis-tab-body">
            <div className="acs-vis-review">
              <div className="acs-vis-review-group">
                <div className="acs-vis-review-group__title">Dados da visita</div>
                <div className="acs-vis-review-row"><span className="acs-vis-review-row__label">Data</span><span className="acs-vis-review-row__value">{form.date}</span></div>
                <div className="acs-vis-review-row"><span className="acs-vis-review-row__label">Turno</span><span className="acs-vis-review-row__value">{TURNO_OPTIONS.find(o => o.value === form.turno)?.label || form.turno}</span></div>
                {form.microarea && <div className="acs-vis-review-row"><span className="acs-vis-review-row__label">Microárea</span><span className="acs-vis-review-row__value">{form.microarea}</span></div>}
                <div className="acs-vis-review-row"><span className="acs-vis-review-row__label">Desfecho</span><span className="acs-vis-review-row__value">{DESFECHO_OPTIONS.find(o => o.value === form.desfecho)?.label || form.desfecho}</span></div>
              </div>
              {countChecked(form.motivos) > 0 && (
                <div className="acs-vis-review-group">
                  <div className="acs-vis-review-group__title">Motivos ({countChecked(form.motivos)})</div>
                  {MOTIVO_OPTIONS.filter(o => form.motivos[o.key]).map(o => (
                    <div key={o.key} className="acs-vis-review-row"><span className="acs-vis-review-row__value">• {o.label}</span></div>
                  ))}
                </div>
              )}
              {countChecked(form.buscaAtiva) > 0 && (
                <div className="acs-vis-review-group">
                  <div className="acs-vis-review-group__title">Busca ativa ({countChecked(form.buscaAtiva)})</div>
                  {BUSCA_ATIVA_OPTIONS.filter(o => form.buscaAtiva[o.key]).map(o => (
                    <div key={o.key} className="acs-vis-review-row"><span className="acs-vis-review-row__value">• {o.label}</span></div>
                  ))}
                </div>
              )}
              {countChecked(form.acompanhamentos) > 0 && (
                <div className="acs-vis-review-group">
                  <div className="acs-vis-review-group__title">Acompanhamento ({countChecked(form.acompanhamentos)})</div>
                  {ACOMPANHAMENTO_OPTIONS.filter(o => form.acompanhamentos[o.key]).map(o => (
                    <div key={o.key} className="acs-vis-review-row"><span className="acs-vis-review-row__value">• {o.label}</span></div>
                  ))}
                </div>
              )}
              {(form.peso || form.altura || form.temperatura || form.paSistolica || form.glicemia) && (
                <div className="acs-vis-review-group">
                  <div className="acs-vis-review-group__title">Sinais vitais</div>
                  {form.peso && <div className="acs-vis-review-row"><span className="acs-vis-review-row__label">Peso</span><span className="acs-vis-review-row__value">{form.peso} kg</span></div>}
                  {form.altura && <div className="acs-vis-review-row"><span className="acs-vis-review-row__label">Altura</span><span className="acs-vis-review-row__value">{form.altura} cm</span></div>}
                  {form.temperatura && <div className="acs-vis-review-row"><span className="acs-vis-review-row__label">Temperatura</span><span className="acs-vis-review-row__value">{form.temperatura} °C</span></div>}
                  {form.paSistolica && <div className="acs-vis-review-row"><span className="acs-vis-review-row__label">PA</span><span className="acs-vis-review-row__value">{form.paSistolica}/{form.paDiastolica} mmHg</span></div>}
                  {form.glicemia && <div className="acs-vis-review-row"><span className="acs-vis-review-row__label">Glicemia</span><span className="acs-vis-review-row__value">{form.glicemia} mg/dL</span></div>}
                </div>
              )}
            </div>

            {error && <div className="acs-vis-error" role="alert" style={{ marginTop: 10 }}>{error}</div>}

            <div className="acs-vis-form__actions" style={{ marginTop: 14 }}>
              <button type="button" className="acs-vis-btn-cancel" onClick={onCancel}>Cancelar</button>
              <button type="button" className="acs-vis-btn-save" disabled={saving} onClick={handleSubmit}>
                {saving ? "Salvando..." : "Salvar Visita"}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="acs-vis-form">
      <div className="acs-vis-form__header">
        <button type="button" className="acs-vis-back-btn" onClick={onCancel}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Voltar
        </button>
        <div className="acs-vis-form__patient-chip">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span>{patient.socialName || patient.name}</span>
          {ageStr(patient.birthDate) && <span className="acs-vis-form__patient-age">{ageStr(patient.birthDate)}</span>}
        </div>
      </div>

      {taskOrigin && (
        <div className="acs-vis-task-origin">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M6 4H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Tarefa: <strong>{taskOrigin.title}</strong>
        </div>
      )}

      <div ref={tabRef} className="acs-vis-tabbar" role="tablist">
        {VISIT_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`acs-vis-tab${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="acs-vis-tab__num">{tab.id}</span>
            {tab.short}
          </button>
        ))}
      </div>

      <div className="acs-vis-tab-title">{VISIT_TABS.find(t => t.id === activeTab)?.full}</div>

      {renderTabContent()}

      {activeTab < 12 && (
        <div className="acs-vis-tab-nav">
          {activeTab > 1 ? (
            <button type="button" className="acs-vis-tab-nav__prev" onClick={() => setActiveTab(t => t - 1)}>
              ← Anterior
            </button>
          ) : <span />}
          <button type="button" className="acs-vis-tab-nav__next" onClick={() => setActiveTab(t => t + 1)}>
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}

// ── VisitasTab ─────────────────────────────────────────────────────────────

const DESFECHO_LABEL = { realizada: "Realizada", recusada: "Recusada", ausente: "Ausente" };
const DESFECHO_CLS   = { realizada: "acs-vis-desfecho--ok", recusada: "acs-vis-desfecho--warn", ausente: "acs-vis-desfecho--dim" };

function VisitasTab({ patients, user, token, preSelectPatient, clearPreSelect }) {
  // view: "list" | "patient-select" | "form"
  const [view, setView] = useState(preSelectPatient ? "form" : "list");
  const [selectedPatient, setSelectedPatient] = useState(preSelectPatient || null);
  const [taskOrigin, setTaskOrigin] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(true);

  useEffect(() => {
    if (!token) { setLoadingVisits(false); return; }
    fetch(`${API_URL}/acs-visits`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setVisits(Array.isArray(data) ? data : []); setLoadingVisits(false); })
      .catch(() => setLoadingVisits(false));
  }, [token]);

  const myPatients = useMemo(() =>
    patients.filter(p => !p.inactive),
    [patients]
  );

  function handleSelectPatient(p) {
    setSelectedPatient(p);
    setView("form");
  }

  function handleSave(visit) {
    setVisits(prev => [visit, ...prev]);
    setView("list");
    setSelectedPatient(null);
    setTaskOrigin(null);
    clearPreSelect?.();
  }

  function handleCancel() {
    if (view === "form") { setView(selectedPatient && !preSelectPatient ? "patient-select" : "list"); setSelectedPatient(null); }
    else { setView("list"); }
    clearPreSelect?.();
  }

  function startNewVisit() {
    setSelectedPatient(null);
    setTaskOrigin(null);
    setView("patient-select");
  }

  if (view === "patient-select") {
    return (
      <PatientSelector
        patients={myPatients}
        onSelect={handleSelectPatient}
        onCancel={() => setView("list")}
      />
    );
  }

  if (view === "form" && selectedPatient) {
    return (
      <VisitForm
        patient={selectedPatient}
        taskOrigin={taskOrigin}
        userId={user?.id}
        token={token}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  // List view
  return (
    <div className="acs-vis-list-view">
      <div className="acs-vis-list-header">
        <div>
          <span className="acs-vis-list-count">
            {loadingVisits ? "Carregando…" : `${visits.length} visita${visits.length !== 1 ? "s" : ""} registrada${visits.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <button type="button" className="acs-vis-new-btn" onClick={startNewVisit}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Nova Visita
        </button>
      </div>

      {visits.length === 0 ? (
        <div className="acs-empty">
          <div className="acs-empty__icon" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          </div>
          <p className="acs-empty__title">Nenhuma visita registrada.</p>
          <p className="acs-empty__sub">Clique em "Nova Visita" para registrar uma visita domiciliar.</p>
        </div>
      ) : (
        <div className="acs-vis-cards">
          {visits.map(v => (
            <div key={v.id} className="acs-vis-card">
              <div className="acs-vis-card__head">
                <span className={`acs-vis-desfecho ${DESFECHO_CLS[v.desfecho] || ""}`}>
                  {DESFECHO_LABEL[v.desfecho] || v.desfecho}
                </span>
                <span className="acs-vis-card__date">{fmtDate(v.date)}</span>
                {v.turno && <span className="acs-vis-card__turno">
                  {v.turno === "manha" ? "Manhã" : v.turno === "tarde" ? "Tarde" : "Noite"}
                </span>}
              </div>
              <div className="acs-vis-card__patient">{v.patientName}</div>
              {v.motivos?.length > 0 && (
                <div className="acs-vis-card__motivos">
                  {v.motivos.map(k => {
                    const o = MOTIVO_OPTIONS.find(m => m.key === k);
                    return o ? <span key={k} className="acs-vis-card__motivo-tag">{o.label}</span> : null;
                  })}
                </div>
              )}
              {v.observacoes && <p className="acs-vis-card__obs">{v.observacoes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CadastroDomiciliarSection — APS-01J-D ─────────────────────────────────────

// ── APS-01M: Cadastro Domiciliar e Territorial — constantes e-SUS completas ────

const CD_TIPO_IMOVEL_OPTIONS = [
  ["", "— selecionar —"],
  ["DOMICILIO",             "Domicílio"],
  ["COMERCIO",              "Comércio"],
  ["TERRENO_BALDIO",        "Terreno baldio"],
  ["PONTO_ESTRATEGICO",     "Ponto estratégico"],
  ["ESCOLA",                "Escola"],
  ["CRECHE",                "Creche"],
  ["ABRIGO",                "Abrigo"],
  ["INST_LONGA_PERMANENCIA","Inst. longa permanência"],
  ["UNIDADE_PRISIONAL",     "Unidade prisional"],
  ["DELEGACIA",             "Delegacia"],
  ["OUTRO",                 "Outro"],
];

const CD_TIPO_DOMICILIO_OPTIONS = [
  ["", "— selecionar —"],
  ["CASA",        "Casa"],
  ["APARTAMENTO", "Apartamento"],
  ["COMODO",      "Cômodo"],
  ["MALOCA",      "Maloca"],
  ["IMPROVISADO", "Improvisado"],
  ["OUTRO",       "Outro"],
];

const CD_LOCALIZACAO_OPTIONS = [
  ["", "— selecionar —"],
  ["URBANA",     "Urbana"],
  ["RURAL",      "Rural"],
  ["PERIURBANA", "Periurbana"],
];

const CD_ABASTECIMENTO_OPTIONS = [
  ["", "— selecionar —"],
  ["REDE_ENCANADA_SISTEMA_PUBLICO",    "Rede encanada até o domicílio — sistema público"],
  ["REDE_ENCANADA_SESAI",              "Rede encanada até o domicílio — SESAI"],
  ["PONTO_ABASTECIMENTO_COLETIVO",     "Ponto de abastecimento coletivo / chafariz"],
  ["POCO_NASCENTE_DOMICILIO",          "Poço / nascente no domicílio"],
  ["CISTERNA_AGUA_CHUVA",              "Cisterna / água de chuva"],
  ["CARRO_PIPA",                       "Carro pipa"],
  ["CAPTACAO_DIRETA_RIO",              "Captação direta de água do rio"],
  ["CAPTACAO_POCO_COLETIVO",           "Captação direta de poço coletivo"],
  ["OUTRO",                            "Outro"],
];

const CD_TRATAMENTO_AGUA_OPTIONS = [
  ["", "— selecionar —"],
  ["FILTRADA_FILTRO_BARRO", "Filtrada com filtro de barro"],
  ["FILTRACAO",             "Filtrada por outro tipo de filtro"],
  ["CLORACAO",              "Clorada"],
  ["CLORADA_HIPOCLORITO",   "Clorada intradomiciliar com hipoclorito de sódio"],
  ["FERVURA",               "Fervida"],
  ["SEM_TRATAMENTO",        "Sem tratamento"],
  ["MINERAL",               "Mineral"],
  ["OUTRO",                 "Outro"],
];

const CD_ESGOTAMENTO_OPTIONS = [
  ["", "— selecionar —"],
  ["REDE_COLETORA",        "Rede coletora de esgoto ou pluvial"],
  ["FOSSA_SEPTICA",        "Fossa séptica"],
  ["FOSSA_RUDIMENTAR",     "Fossa rudimentar"],
  ["DIRETO_RIO_LAGO_MAR",  "Direto para um rio, lago ou mar"],
  ["CEU_ABERTO",           "Céu aberto"],
  ["OUTRA_FORMA",          "Outra forma"],
];

const CD_DESTINO_LIXO_OPTIONS = [
  ["", "— selecionar —"],
  ["COLETADO",       "Coletado"],
  ["CEU_ABERTO",     "Céu aberto"],
  ["QUEIMADO",       "Queimado"],
  ["ENTERRADO",      "Enterrado"],
  ["OUTRO",          "Outro"],
];

const CD_SITUACAO_MORADIA_OPTIONS = [
  ["", "— selecionar —"],
  ["PROPRIO",      "Próprio"],
  ["FINANCIADO",   "Financiado"],
  ["ALUGADO",      "Alugado"],
  ["ARRENDADO",    "Arrendado"],
  ["CEDIDO",       "Cedido"],
  ["OCUPACAO",     "Ocupação"],
  ["SITUACAO_RUA", "Situação de rua"],
  ["TEMPORARIA",   "Temporária"],
  ["OUTRO",        "Outro"],
];

const CD_TIPO_ENDERECO_OPTIONS = [
  ["", "— selecionar —"],
  ["LOGRADOURO",   "Logradouro"],
  ["SEM_ENDERECO", "Sem endereço"],
];

const CD_HOME_FREQ_OPTIONS = [
  ["", "— selecionar —"],
  ["SEMANAL",    "Semanal"],
  ["QUINZENAL",  "Quinzenal"],
  ["MENSAL",     "Mensal"],
  ["BIMESTRAL",  "Bimestral"],
  ["TRIMESTRAL", "Trimestral"],
  ["SEMESTRAL",  "Semestral"],
  ["ANUAL",      "Anual"],
];

const CD_ANIMAIS_OPTIONS = [
  { key: "gato",     label: "Gato" },
  { key: "cachorro", label: "Cachorro" },
  { key: "passaro",  label: "Pássaro" },
  { key: "outros",   label: "Outros" },
];

const CD_MATERIAL_PAREDES_OPTIONS = [
  ["", "— selecionar —"],
  ["ALVENARIA_COM_REVESTIMENTO",    "Alvenaria / Tijolo — com revestimento"],
  ["ALVENARIA_SEM_REVESTIMENTO",    "Alvenaria / Tijolo — sem revestimento"],
  ["TAIPA_COM_REVESTIMENTO",        "Taipa — com revestimento"],
  ["TAIPA_SEM_REVESTIMENTO",        "Taipa — sem revestimento"],
  ["MADEIRA_APARELHADA",            "Madeira aparelhada"],
  ["MATERIAL_APROVEITADO",          "Material aproveitado"],
  ["CAULES_PALMEIRA",               "Caules de palmeira"],
  ["SEM_PAREDE",                    "Sem parede"],
  ["PALHA",                         "Palha"],
  ["LONA",                          "Lona"],
  ["MISTO",                         "Misto / diferentes"],
  ["OUTRO",                         "Outro material"],
];

const CD_TIPO_ACESSO_OPTIONS = [
  ["", "— selecionar —"],
  ["PAVIMENTO",   "Pavimento"],
  ["CHAO_BATIDO", "Chão batido"],
  ["FLUVIAL",     "Fluvial"],
  ["OUTRO",       "Outro"],
];

const CD_ORIGEM_ENERGIA_OPTIONS = [
  ["", "— selecionar —"],
  ["CONCESSIONARIA",          "Concessionária"],
  ["GERADOR_COMUNITARIO",     "Gerador comunitário"],
  ["GERADOR_INDIVIDUAL",      "Gerador individual"],
  ["FOTOVOLTAICA_INDIVIDUAL",  "Fotovoltaica individual"],
  ["FOTOVOLTAICA_COMUNITARIA", "Fotovoltaica comunitária"],
];

const CD_CONDICAO_POSSE_TERRA_OPTIONS = [
  ["", "— selecionar —"],
  ["PROPRIETARIO",                "Proprietário"],
  ["PARCEIRO_MEEIRO",             "Parceiro(a) / Meeiro(a)"],
  ["ASSENTADO",                   "Assentado(a)"],
  ["POSSEIRO",                    "Posseiro"],
  ["TERRA_INDIGENA_DEMARCADA",    "Terra indígena demarcada"],
  ["ARRENDATARIO",                "Arrendatário(a)"],
  ["COMODATARIO",                 "Comodatário(a)"],
  ["BENEFICIARIO_BANCO_TERRA",    "Beneficiário(a) do Banco da Terra"],
  ["TERRA_INDIGENA_NAO_DEMARCADA","Terra indígena não demarcada"],
  ["NAO_SE_APLICA",               "Não se aplica"],
];

function emptyCdForm(h) {
  const hh = h || {};
  return {
    // identificação
    termoRecusa:               hh.termoRecusa      ?? false,
    dataCadastro:              hh.dataCadastro     || "",
    microarea:                 hh.microarea        || "",
    familyCode:                hh.familyCode       || "",
    // profissional (configuração de implantação)
    profResponsavelNome:       hh.profResponsavelNome || "",
    profResponsavelCns:        hh.profResponsavelCns  || "",
    profCbo:                   hh.profCbo             || "",
    codigoCnes:                hh.codigoCnes          || "",
    codigoIne:                 hh.codigoIne           || "",
    // endereço
    tipoEndereco:              hh.tipoEndereco     || "",
    pais:                      hh.pais             || "",
    uf:                        hh.uf               || "",
    municipioIbge:             hh.municipioIbge    || "",
    municipioNome:             hh.municipioNome    || "",
    cep:                       hh.cep              || "",
    tipoLogradouro:            hh.tipoLogradouro   || "",
    logradouro:                hh.logradouro       || "",
    numero:                    hh.numero           || "",
    semNumero:                 hh.semNumero        ?? false,
    complemento:               hh.complemento      || "",
    bairro:                    hh.bairro           || "",
    distritosanitario:         hh.distritosanitario || "",
    pontoReferencia:           hh.pontoReferencia  || "",
    observacoesEndereco:       hh.observacoesEndereco || "",
    // telefones
    telResidencialDDD:         hh.telResidencialDDD || "",
    telResidencial:            hh.telResidencial    || "",
    telContatoDDD:             hh.telContatoDDD     || "",
    telContato:                hh.telContato        || "",
    // imóvel
    tipoImovel:                hh.tipoImovel        || "",
    desativarCadastro:         hh.desativarCadastro ?? false,
    // condições de moradia
    tipoDomicilio:             hh.tipoDomicilio     || "",
    localizacao:               hh.localizacao       || "",
    situacaoMoradiaPosseTerra: hh.situacaoMoradiaPosseTerra || "",
    tipoAcesso:                hh.tipoAcesso        || "",
    numMoradores:              hh.numMoradores != null ? String(hh.numMoradores) : "",
    numComodos:                hh.numComodos   != null ? String(hh.numComodos)   : "",
    condicaoPosseUseTerra:     hh.condicaoPosseUseTerra || "",
    // energia elétrica
    energiaEletrica:           hh.energiaEletrica   ?? null,
    origemEnergiaEletrica:     hh.origemEnergiaEletrica || "",
    // material das paredes
    materialPredominanteParedes: hh.materialPredominanteParedes || "",
    // água e saneamento
    abastecimentoAgua:         hh.abastecimentoAgua   || "",
    tratamentoAgua:            hh.tratamentoAgua      || "",
    esgotamento:               hh.esgotamento         || "",
    destinacaoLixo:            hh.destinacaoLixo      || "",
    // animais
    animaisNoDomicilio:        hh.animaisNoDomicilio ?? false,
    tiposAnimais:              hh.tiposAnimais       || [],
    quantidadeAnimais:         hh.quantidadeAnimais != null ? String(hh.quantidadeAnimais) : "",
    // visita
    homeVisitFreq:             hh.homeVisitFreq     || "",
    foraArea:                  hh.foraArea          ?? false,
    // famílias
    familias:                  Array.isArray(hh.familias) ? hh.familias : [],
    // instituição de permanência
    instituicaoPermanencia:    hh.instituicaoPermanencia || "",
  };
}

function cdStatusInfo(households) {
  if (!households || households.length === 0) return { status: "none", label: "Sem domicílio cadastrado", action: "Cadastrar Domicílio e Territorial" };
  const hh = households[0];
  const keyFields = [hh.tipoImovel, hh.tipoDomicilio, hh.localizacao, hh.abastecimentoAgua, hh.esgotamento];
  const filled = keyFields.filter(Boolean).length;
  if (filled >= 4) return { status: "complete", label: "Cadastro Domiciliar e Territorial preenchido", action: null };
  if (filled >= 1) return { status: "incomplete", label: "Cadastro Domiciliar e Territorial incompleto", action: "Continuar preenchimento" };
  return { status: "none", label: "Cadastro Domiciliar e Territorial não preenchido", action: "Preencher Cadastro Domiciliar e Territorial" };
}

function CadastroDomiciliarSection({ token, user, patients }) {
  const [search, setSearch]           = useState("");
  const [dropFocused, setDropFocused] = useState(false);
  const searchRef                     = useRef(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [households, setHouseholds]   = useState([]);
  const [selectedHh, setSelectedHh]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [modalMode, setModalMode]     = useState("view");
  const [form, setForm]               = useState(emptyCdForm(null));
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [saveOk, setSaveOk]           = useState(false);

  const results = useMemo(() => {
    const q = search.trim();
    if (q.length < 2) return [];
    const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").trim();
    const nq = norm(q);
    const qd = q.replace(/\D/g,"");
    return patients.filter(p => {
      if (matchesPatientSearch(p, q)) return true;
      if (nq.length >= 3 && norm(p.logradouro||p.address||"").includes(nq)) return true;
      if (nq.length >= 3 && norm(p.bairro||p.neighborhood||"").includes(nq)) return true;
      const cep = (p.cep||"").replace(/\D/g,"");
      if (qd.length >= 5 && cep.includes(qd)) return true;
      return false;
    }).slice(0, 8);
  }, [search, patients]);

  const showDrop = dropFocused && search.trim().length >= 2 && !selectedPatient;
  const dropRect = showDrop ? searchRef.current?.getBoundingClientRect() : null;

  async function loadHouseholds(patient) {
    if (!patient) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/households?patientId=${patient.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ([]));
      setHouseholds(Array.isArray(body) ? body : []);
    } catch {
      setHouseholds([]);
    } finally {
      setLoading(false);
    }
  }

  function selectPatient(p) {
    setSelectedPatient(p);
    setSearch(p.name);
    setDropFocused(false);
    setSaveError(""); setSaveOk(false);
    loadHouseholds(p);
  }

  function clearSelection() {
    setSelectedPatient(null);
    setHouseholds([]);
    setSearch("");
    setShowModal(false);
    setSaveError(""); setSaveOk(false);
  }

  function openCreate() {
    setSelectedHh(null);
    setForm(emptyCdForm(null));
    setModalMode("create");
    setSaveError(""); setSaveOk(false);
    setShowModal(true);
  }

  function openView(hh) {
    setSelectedHh(hh);
    setModalMode("view");
    setSaveError(""); setSaveOk(false);
    setShowModal(true);
  }

  function openEdit(hh) {
    setSelectedHh(hh);
    setForm(emptyCdForm(hh));
    setModalMode("edit");
    setSaveError(""); setSaveOk(false);
    setShowModal(true);
  }

  function fld(key, value) { setForm(f => ({ ...f, [key]: value })); }

  function toggleAnimal(key) {
    setForm(f => {
      const cur = f.tiposAnimais || [];
      return { ...f, tiposAnimais: cur.includes(key) ? cur.filter(v => v !== key) : [...cur, key] };
    });
  }

  function buildPayload() {
    const p = { ...form };
    // numbers
    if (p.numMoradores !== "") p.numMoradores = parseInt(p.numMoradores, 10); else delete p.numMoradores;
    if (p.numComodos !== "")   p.numComodos   = parseInt(p.numComodos, 10);   else delete p.numComodos;
    if (p.quantidadeAnimais !== "") p.quantidadeAnimais = parseInt(p.quantidadeAnimais, 10); else delete p.quantidadeAnimais;
    // strip empty enum fields
    for (const key of [
      "tipoImovel","tipoDomicilio","localizacao","abastecimentoAgua","tratamentoAgua",
      "esgotamento","destinacaoLixo","homeVisitFreq","situacaoMoradiaPosseTerra",
      "tipoEndereco","condicaoPosseUseTerra","tipoAcesso","origemEnergiaEletrica",
      "materialPredominanteParedes","tipoLogradouro",
    ]) { if (!p[key]) delete p[key]; }
    // strip empty strings
    for (const key of [
      "microarea","familyCode","pais","uf","municipioIbge","municipioNome","cep",
      "logradouro","numero","complemento","bairro","distritosanitario","pontoReferencia",
      "observacoesEndereco","telResidencialDDD","telResidencial","telContatoDDD","telContato",
      "profResponsavelNome","profResponsavelCns","profCbo","codigoCnes","codigoIne",
      "dataCadastro","instituicaoPermanencia",
    ]) { if (!p[key]) delete p[key]; }
    if (p.energiaEletrica === null) delete p.energiaEletrica;
    // familias: remove rows with no data
    if (Array.isArray(p.familias)) {
      p.familias = p.familias.filter(f =>
        f.responsavelNome || f.responsavelCpfCns || f.prontuarioFamiliar || f.numMembros
      );
      if (p.familias.length === 0) delete p.familias;
    }
    return p;
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true); setSaveError(""); setSaveOk(false);
    try {
      const payload = { ...buildPayload(), patientId: selectedPatient.id };
      const res = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(body.error || `Erro ${res.status}`); return; }
      setHouseholds(prev => {
        const idx = prev.findIndex(h => h.id === body.id);
        return idx >= 0 ? prev.map(h => h.id === body.id ? body : h) : [...prev, body];
      });
      setSelectedHh(body);
      setModalMode("view");
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 4000);
    } catch { setSaveError("Erro de conexão"); }
    finally { setSaving(false); }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setSaving(true); setSaveError(""); setSaveOk(false);
    try {
      const payload = buildPayload();
      const res = await fetch(`/api/households/${selectedHh.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(body.error || `Erro ${res.status}`); return; }
      setHouseholds(prev => prev.map(h => h.id === body.id ? body : h));
      setSelectedHh(body);
      setModalMode("view");
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 4000);
    } catch { setSaveError("Erro de conexão"); }
    finally { setSaving(false); }
  }

  const handleSubmit = modalMode === "create" ? handleCreate : handleUpdate;
  const statusInfo = cdStatusInfo(households);

  return (
    <div className="ci-section">
      <div className="ci-section__header">
        <h2 className="ci-section__title">Cadastro Domiciliar e Territorial</h2>
        <p className="ci-section__sub">Busque um paciente para visualizar ou registrar o Cadastro Domiciliar e Territorial (e-SUS).</p>
      </div>

      {/* ── Search bar ── */}
      <div className="ci-search-wrap" ref={searchRef}>
        <div className="input">
          <span className="input__icon"><CiSearchIcon /></span>
          <input
            className="input__control"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (selectedPatient && e.target.value !== selectedPatient.name) setSelectedPatient(null);
            }}
            onFocus={() => setDropFocused(true)}
            onBlur={() => setTimeout(() => setDropFocused(false), 150)}
            placeholder="Buscar por nome, CPF, CNS, telefone, endereço ou CEP..."
            autoComplete="off"
            aria-label="Buscar paciente para Cadastro Domiciliar"
          />
          {selectedPatient && (
            <button type="button" className="ci-search-clear" onClick={clearSelection} aria-label="Limpar seleção de paciente">
              <CiClearIcon />
            </button>
          )}
        </div>
      </div>

      {/* ── Autocomplete dropdown (portal) ── */}
      {dropRect && createPortal(
        <div
          className="agenda-pat-dropdown"
          style={{ position: "fixed", top: dropRect.bottom + 4, left: dropRect.left, width: dropRect.width, zIndex: 9999 }}
        >
          {results.length === 0 ? (
            <div className="agenda-pat-empty">Nenhum paciente encontrado.</div>
          ) : results.map(p => {
            const am = ageInMonths(p.birthDate);
            const ageLabel = am !== null ? (am < 24 ? `${am}m` : `${Math.floor(am / 12)}a`) : "";
            const addr = [p.logradouro||p.address, p.bairro||p.neighborhood].filter(Boolean).join(", ");
            const meta = [
              ageLabel,
              p.phone,
              p.cpf ? `CPF ${maskCpf(p.cpf)}` : (p.cns ? `CNS ●●●…${String(p.cns).slice(-3)}` : null),
              addr || null,
            ].filter(Boolean).join(" · ");
            return (
              <button key={p.id} type="button" className="agenda-pat-opt" onClick={() => selectPatient(p)}>
                <span className="agenda-pat-opt__avatar">{initials(p.name)}</span>
                <span>
                  <div className="agenda-pat-opt__name">
                    {p.nomeSocial
                      ? <>{p.nomeSocial} <span className="agenda-pat-opt__civil">({p.name})</span></>
                      : p.name}
                  </div>
                  {meta && <div className="agenda-pat-opt__meta">{meta}</div>}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}

      {/* ── Empty state ── */}
      {!selectedPatient && (
        <div className="ci-empty">
          <EmptyState
            title="Selecione um paciente"
            description="Busque um paciente pelo nome, CPF, CNS, telefone, endereço ou CEP para visualizar ou registrar o Cadastro Domiciliar."
          />
        </div>
      )}

      {/* ── Patient card ── */}
      {selectedPatient && (() => {
        const am = ageInMonths(selectedPatient.birthDate);
        const ageLabel = am !== null ? (am < 24 ? `${am}m` : `${Math.floor(am / 12)}a`) : "";
        const addr = [selectedPatient.logradouro, selectedPatient.numero, selectedPatient.bairro]
          .filter(Boolean).join(", ") || selectedPatient.address || "";
        return (
          <div className="ci-patient-card">
            <div className="ci-patient-card__avatar" aria-hidden="true">
              {initials(selectedPatient.name)}
            </div>
            <div className="ci-patient-card__body">
              <div className="ci-patient-card__name">
                {selectedPatient.nomeSocial || selectedPatient.name}
              </div>
              {selectedPatient.nomeSocial && (
                <div className="ci-patient-card__civil">{selectedPatient.name}</div>
              )}
              <div className="ci-patient-card__meta">
                {ageLabel && <span>{ageLabel}</span>}
                {selectedPatient.phone && <span>{selectedPatient.phone}</span>}
                {selectedPatient.cpf && <span>CPF {maskCpf(selectedPatient.cpf)}</span>}
                {!selectedPatient.cpf && selectedPatient.cns && (
                  <span>CNS ●●●…{String(selectedPatient.cns).slice(-4)}</span>
                )}
              </div>
              {addr && <div className="ci-patient-card__addr">{addr}</div>}
              {!loading && (
                <span className={`ci-status ci-status--${statusInfo.status}`}>
                  {statusInfo.label}
                </span>
              )}
            </div>
            <div className="ci-patient-card__actions">
              {statusInfo.status === "none" ? (
                <Button size="sm" onClick={openCreate}>{statusInfo.action}</Button>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={() => openView(households[0])}>Ver domicílio</Button>
                  <Button size="sm" onClick={openCreate}>+ Novo</Button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Household list ── */}
      {selectedPatient && !loading && households.length > 0 && (
        <div className="cd-hh-list">
          {households.map(hh => {
            const hhAddr = [hh.logradouro, hh.numero, hh.bairro].filter(Boolean).join(", ");
            const hhLabel = [hh.tipoDomicilio||hh.tipoImovel, hh.localizacao].filter(Boolean).join(" · ") || "Domicílio";
            return (
              <button key={hh.id} type="button" className="cd-hh-card" onClick={() => openView(hh)}>
                <div className="cd-hh-card__label">{hhLabel}</div>
                {hhAddr && <div className="cd-hh-card__addr">{hhAddr}</div>}
                {hh.numMoradores != null && <div className="cd-hh-card__detail">{hh.numMoradores} morador(es)</div>}
              </button>
            );
          })}
        </div>
      )}

      {loading && <p className="cd-loading">Carregando…</p>}

      {/* ── Modal ── */}
      {showModal && selectedPatient && (
        <Modal
          title={modalMode === "create"
            ? "Cadastro Domiciliar e Territorial — Novo"
            : `Cadastro Domiciliar e Territorial — ${selectedPatient.nomeSocial || selectedPatient.name}`}
          className="modal--cd"
          onClose={() => { setShowModal(false); setSaveError(""); }}
          actions={
            modalMode === "view" ? (
              <>
                <Button variant="secondary" size="sm" onClick={openCreate}>+ Novo CDT</Button>
                <Button onClick={() => openEdit(selectedHh)}>Editar</Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    if (modalMode === "create") { setShowModal(false); }
                    else { setModalMode("view"); setForm(emptyCdForm(selectedHh)); setSaveError(""); }
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" form="cd-form" disabled={saving}>
                  {saving ? "Salvando…" : modalMode === "create" ? "Cadastrar Domicílio" : "Salvar"}
                </Button>
              </>
            )
          }
        >
          {saveOk    && <div className="alert alert--success" role="status">Cadastro Domiciliar e Territorial salvo com sucesso.</div>}
          {saveError && <div className="alert alert--danger"  role="alert">{saveError}</div>}

          {modalMode === "view" && selectedHh ? (
            <div className="ci-view cd-view">
              {selectedHh.termoRecusa && <div className="cd-view__recusa">⚠️ Usuário recusou o cadastro por meio do Termo de Recusa.</div>}
              <CdRow label="Data do cadastro"     value={selectedHh.dataCadastro} />
              <CdRow label="Microárea"            value={selectedHh.microarea} />
              <CdRow label="Código familiar"      value={selectedHh.familyCode} />
              <CdRow label="Tipo de imóvel"       value={selectedHh.tipoImovel} />
              <CdRow label="Tipo de domicílio"    value={selectedHh.tipoDomicilio} />
              <CdRow label="Localização"          value={selectedHh.localizacao} />
              <CdRow label="Endereço"             value={[selectedHh.logradouro, selectedHh.numero, selectedHh.complemento, selectedHh.bairro, selectedHh.municipioNome, selectedHh.uf].filter(Boolean).join(", ")} />
              <CdRow label="CEP"                  value={selectedHh.cep} />
              <CdRow label="Ponto de referência"  value={selectedHh.pontoReferencia} />
              <CdRow label="Tel. residencial"     value={selectedHh.telResidencialDDD ? `(${selectedHh.telResidencialDDD}) ${selectedHh.telResidencial}` : selectedHh.telResidencial} />
              <CdRow label="Tel. contato"         value={selectedHh.telContatoDDD ? `(${selectedHh.telContatoDDD}) ${selectedHh.telContato}` : selectedHh.telContato} />
              <CdRow label="Situação de moradia"  value={selectedHh.situacaoMoradiaPosseTerra} />
              <CdRow label="Cond. posse terra"    value={selectedHh.condicaoPosseUseTerra} />
              <CdRow label="Nº moradores"         value={selectedHh.numMoradores} />
              <CdRow label="Nº cômodos"           value={selectedHh.numComodos} />
              <CdRow label="Tipo de acesso"       value={selectedHh.tipoAcesso} />
              <CdRow label="Energia elétrica"     value={selectedHh.energiaEletrica == null ? "" : selectedHh.energiaEletrica ? "Sim" : "Não"} />
              <CdRow label="Origem energia"       value={selectedHh.origemEnergiaEletrica} />
              <CdRow label="Material paredes"     value={selectedHh.materialPredominanteParedes} />
              <CdRow label="Abastecimento água"   value={selectedHh.abastecimentoAgua} />
              <CdRow label="Água para consumo"    value={selectedHh.tratamentoAgua} />
              <CdRow label="Esgotamento"          value={selectedHh.esgotamento} />
              <CdRow label="Destino do lixo"      value={selectedHh.destinacaoLixo} />
              {selectedHh.animaisNoDomicilio && (
                <>
                  <CdRow label="Animais"    value={(selectedHh.tiposAnimais || []).join(", ")} />
                  <CdRow label="Qtd animais" value={selectedHh.quantidadeAnimais} />
                </>
              )}
              <CdRow label="Freq. visita"           value={selectedHh.homeVisitFreq} />
              <CdRow label="Fora da área"           value={selectedHh.foraArea ? "Sim" : "Não"} />
              {Array.isArray(selectedHh.familias) && selectedHh.familias.length > 0 && (
                <div className="cd-view__familias">
                  <p className="cd-view__group-title">Famílias</p>
                  {selectedHh.familias.map((f, i) => (
                    <div key={i} className="cd-view__familia">
                      <CdRow label="Responsável"  value={f.responsavelNome} />
                      <CdRow label="CPF/CNS"      value={f.responsavelCpfCns} />
                      <CdRow label="Prontuário"   value={f.prontuarioFamiliar} />
                      <CdRow label="Membros"      value={f.numMembros} />
                      <CdRow label="Renda"        value={f.rendaFamiliar} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form id="cd-form" className="cd-form-accordion" onSubmit={handleSubmit} noValidate>

              {/* ── Termo de recusa ── */}
              <details className="cd-acc" open>
                <summary className="cd-acc__header">Termo de recusa</summary>
                <div className="cd-acc__body">
                  <label className="ci-form__radio-label">
                    <input type="checkbox" className="acs-vis-checkbox"
                      checked={!!form.termoRecusa}
                      onChange={e => fld("termoRecusa", e.target.checked)} />
                    <span>Usuário recusou o cadastro por meio do Termo de Recusa do Cadastro da Atenção Básica</span>
                  </label>
                </div>
              </details>

              {/* ── Domicílio ── */}
              <details className="cd-acc" open>
                <summary className="cd-acc__header">Domicílio</summary>
                <div className="cd-acc__body field-grid field-grid--no-pad">
                  <Input label="Data do cadastro" type="date" value={form.dataCadastro} onChange={e => fld("dataCadastro", e.target.value)} />
                  <Input label="Microárea" value={form.microarea} onChange={e => fld("microarea", e.target.value)} maxLength={50} placeholder="ex: 001" />
                  <Select label="Tipo de imóvel" value={form.tipoImovel} onChange={e => fld("tipoImovel", e.target.value)}>
                    {CD_TIPO_IMOVEL_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Input label="Código familiar" value={form.familyCode} onChange={e => fld("familyCode", e.target.value)} maxLength={50} />
                  <label className="ci-form__radio-label field--span-2">
                    <input type="checkbox" className="acs-vis-checkbox"
                      checked={!!form.desativarCadastro}
                      onChange={e => fld("desativarCadastro", e.target.checked)} />
                    <span>Desativar cadastro domiciliar</span>
                  </label>
                  <label className="ci-form__radio-label field--span-2">
                    <input type="checkbox" className="acs-vis-checkbox"
                      checked={!!form.foraArea}
                      onChange={e => fld("foraArea", e.target.checked)} />
                    <span>Imóvel fora da área de abrangência</span>
                  </label>
                </div>
              </details>

              {/* ── Profissional responsável ── */}
              <details className="cd-acc">
                <summary className="cd-acc__header">Profissional responsável <span className="cd-acc__badge">Configuração de implantação</span></summary>
                <div className="cd-acc__body field-grid field-grid--no-pad">
                  <Input label="Nome do responsável" className="field--span-2" value={form.profResponsavelNome} onChange={e => fld("profResponsavelNome", e.target.value)} maxLength={300} />
                  <Input label="CNS do profissional" value={form.profResponsavelCns} onChange={e => fld("profResponsavelCns", e.target.value)} maxLength={20} placeholder="15 dígitos" />
                  <Input label="CBO" value={form.profCbo} onChange={e => fld("profCbo", e.target.value)} maxLength={10} placeholder="6 dígitos" />
                  <Input label="Código CNES" value={form.codigoCnes} onChange={e => fld("codigoCnes", e.target.value)} maxLength={7} placeholder="7 dígitos" />
                  <Input label="Código INE" value={form.codigoIne} onChange={e => fld("codigoIne", e.target.value)} maxLength={10} placeholder="10 dígitos" />
                </div>
              </details>

              {/* ── Endereço / Local de permanência ── */}
              <details className="cd-acc" open>
                <summary className="cd-acc__header">Endereço / Local de permanência</summary>
                <div className="cd-acc__body field-grid field-grid--no-pad">
                  <Select label="Tipo de endereço" value={form.tipoEndereco} onChange={e => fld("tipoEndereco", e.target.value)}>
                    {CD_TIPO_ENDERECO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Input label="País" value={form.pais} onChange={e => fld("pais", e.target.value)} maxLength={50} placeholder="Brasil" />
                  <Input label="Estado (UF)" value={form.uf} onChange={e => fld("uf", e.target.value.toUpperCase())} maxLength={2} placeholder="ex: SP" />
                  <Input label="Município" value={form.municipioNome} onChange={e => fld("municipioNome", e.target.value)} maxLength={100} />
                  <Input label="Código IBGE" value={form.municipioIbge} onChange={e => fld("municipioIbge", e.target.value)} maxLength={7} placeholder="7 dígitos" />
                  <Input label="CEP" value={form.cep} onChange={e => fld("cep", e.target.value)} maxLength={9} placeholder="00000-000" />
                  <Input label="Tipo de logradouro" value={form.tipoLogradouro} onChange={e => fld("tipoLogradouro", e.target.value)} maxLength={50} placeholder="ex: Rua, Avenida" />
                  <Input label="Logradouro" className="field--span-2" value={form.logradouro} onChange={e => fld("logradouro", e.target.value)} maxLength={250} />
                  <Input label="Número" value={form.numero} onChange={e => fld("numero", e.target.value)} maxLength={30} disabled={!!form.semNumero} />
                  <div className="cd-acc__inline-check">
                    <label className="ci-form__radio-label">
                      <input type="checkbox" className="acs-vis-checkbox"
                        checked={!!form.semNumero}
                        onChange={e => { fld("semNumero", e.target.checked); if (e.target.checked) fld("numero", ""); }} />
                      <span>Sem número</span>
                    </label>
                  </div>
                  <Input label="Complemento" value={form.complemento} onChange={e => fld("complemento", e.target.value)} maxLength={100} />
                  <Input label="Bairro" value={form.bairro} onChange={e => fld("bairro", e.target.value)} maxLength={100} />
                  <Input label="Distrito sanitário" value={form.distritosanitario} onChange={e => fld("distritosanitario", e.target.value)} maxLength={100} />
                  <Input label="Ponto de referência" className="field--span-2" value={form.pontoReferencia} onChange={e => fld("pontoReferencia", e.target.value)} maxLength={200} />
                  <Input label="Observações" className="field--span-2" value={form.observacoesEndereco} onChange={e => fld("observacoesEndereco", e.target.value)} maxLength={500} />
                </div>
              </details>

              {/* ── Telefones ── */}
              <details className="cd-acc">
                <summary className="cd-acc__header">Telefones para contato</summary>
                <div className="cd-acc__body field-grid field-grid--no-pad">
                  <p className="ci-form-section field--span-2">Telefone residencial</p>
                  <Input label="DDD" value={form.telResidencialDDD} onChange={e => fld("telResidencialDDD", e.target.value)} maxLength={3} placeholder="ex: 11" />
                  <Input label="Número" value={form.telResidencial} onChange={e => fld("telResidencial", e.target.value)} maxLength={15} placeholder="00000-0000" />
                  <p className="ci-form-section field--span-2">Telefone de contato</p>
                  <Input label="DDD" value={form.telContatoDDD} onChange={e => fld("telContatoDDD", e.target.value)} maxLength={3} placeholder="ex: 11" />
                  <Input label="Número" value={form.telContato} onChange={e => fld("telContato", e.target.value)} maxLength={15} placeholder="00000-0000" />
                </div>
              </details>

              {/* ── Condições de moradia ── */}
              <details className="cd-acc" open>
                <summary className="cd-acc__header">Condições de moradia</summary>
                <div className="cd-acc__body field-grid field-grid--no-pad">
                  <Select label="Situação de moradia / posse da terra" className="field--span-2" value={form.situacaoMoradiaPosseTerra} onChange={e => fld("situacaoMoradiaPosseTerra", e.target.value)}>
                    {CD_SITUACAO_MORADIA_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Select label="Localização" value={form.localizacao} onChange={e => fld("localizacao", e.target.value)}>
                    {CD_LOCALIZACAO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Select label="Tipo de domicílio" value={form.tipoDomicilio} onChange={e => fld("tipoDomicilio", e.target.value)}>
                    {CD_TIPO_DOMICILIO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Input label="Nº de moradores" type="number" min="0" value={form.numMoradores} onChange={e => fld("numMoradores", e.target.value)} />
                  <Input label="Nº de cômodos" type="number" min="0" value={form.numComodos} onChange={e => fld("numComodos", e.target.value)} />
                  <Select label="Tipo de acesso ao domicílio" value={form.tipoAcesso} onChange={e => fld("tipoAcesso", e.target.value)}>
                    {CD_TIPO_ACESSO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Select label="Material predominante das paredes externas" className="field--span-2" value={form.materialPredominanteParedes} onChange={e => fld("materialPredominanteParedes", e.target.value)}>
                    {CD_MATERIAL_PAREDES_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </div>
              </details>

              {/* ── Área de produção rural ── */}
              <details className="cd-acc">
                <summary className="cd-acc__header">Área de produção rural</summary>
                <div className="cd-acc__body field-grid field-grid--no-pad">
                  <Select label="Condição de posse e uso da terra" className="field--span-2" value={form.condicaoPosseUseTerra} onChange={e => fld("condicaoPosseUseTerra", e.target.value)}>
                    {CD_CONDICAO_POSSE_TERRA_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </div>
              </details>

              {/* ── Energia elétrica ── */}
              <details className="cd-acc" open>
                <summary className="cd-acc__header">Energia elétrica</summary>
                <div className="cd-acc__body field-grid field-grid--no-pad">
                  <fieldset className="ci-form__fieldset field--span-2">
                    <legend className="field__label">Disponibilidade de energia elétrica</legend>
                    <div className="ci-form__radios">
                      {[["sim", true], ["nao", false], ["ni", null]].map(([id, val]) => (
                        <label key={id} className="ci-form__radio-label">
                          <input type="radio" name="energiaEletrica" className="acs-vis-radio"
                            checked={form.energiaEletrica === val}
                            onChange={() => fld("energiaEletrica", val)} />
                          <span>{val === true ? "Sim" : val === false ? "Não" : "Não informado"}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {form.energiaEletrica === true && (
                    <Select label="Origem da energia elétrica" className="field--span-2" value={form.origemEnergiaEletrica} onChange={e => fld("origemEnergiaEletrica", e.target.value)}>
                      {CD_ORIGEM_ENERGIA_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  )}
                </div>
              </details>

              {/* ── Água e saneamento ── */}
              <details className="cd-acc" open>
                <summary className="cd-acc__header">Água e saneamento</summary>
                <div className="cd-acc__body field-grid field-grid--no-pad">
                  <Select label="Abastecimento de água" className="field--span-2" value={form.abastecimentoAgua} onChange={e => fld("abastecimentoAgua", e.target.value)}>
                    {CD_ABASTECIMENTO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Select label="Água para consumo no domicílio" className="field--span-2" value={form.tratamentoAgua} onChange={e => fld("tratamentoAgua", e.target.value)}>
                    {CD_TRATAMENTO_AGUA_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Select label="Forma de escoamento do banheiro ou sanitário" className="field--span-2" value={form.esgotamento} onChange={e => fld("esgotamento", e.target.value)}>
                    {CD_ESGOTAMENTO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Select label="Destino do lixo" value={form.destinacaoLixo} onChange={e => fld("destinacaoLixo", e.target.value)}>
                    {CD_DESTINO_LIXO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Select label="Frequência de visita domiciliar" value={form.homeVisitFreq} onChange={e => fld("homeVisitFreq", e.target.value)}>
                    {CD_HOME_FREQ_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </div>
              </details>

              {/* ── Animais ── */}
              <details className="cd-acc">
                <summary className="cd-acc__header">Animais no domicílio</summary>
                <div className="cd-acc__body field-grid field-grid--no-pad">
                  <fieldset className="ci-form__fieldset field--span-2">
                    <legend className="field__label">Tem animais no domicílio?</legend>
                    <div className="ci-form__radios">
                      {[["sim", true], ["nao", false]].map(([id, val]) => (
                        <label key={id} className="ci-form__radio-label">
                          <input type="radio" name="animaisNoDomicilio" className="acs-vis-radio"
                            checked={form.animaisNoDomicilio === val}
                            onChange={() => fld("animaisNoDomicilio", val)} />
                          <span>{val ? "Sim" : "Não"}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {form.animaisNoDomicilio === true && (
                    <>
                      <p className="ci-form-section field--span-2">Quais animais?</p>
                      <div className="ci-form__checks field--span-2">
                        {CD_ANIMAIS_OPTIONS.map(({ key, label }) => (
                          <label key={key} className="acs-vis-check-label">
                            <input type="checkbox" className="acs-vis-checkbox"
                              checked={(form.tiposAnimais || []).includes(key)}
                              onChange={() => toggleAnimal(key)} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      <Input label="Quantidade de animais" type="number" min="0" max="999"
                        value={form.quantidadeAnimais}
                        onChange={e => fld("quantidadeAnimais", e.target.value)} />
                    </>
                  )}
                </div>
              </details>

              {/* ── Famílias ── */}
              <details className="cd-acc">
                <summary className="cd-acc__header">Famílias</summary>
                <div className="cd-acc__body">
                  <p className="cd-acc__hint">Registre os grupos familiares que residem neste domicílio. Não é obrigatório para paciente que mora sozinho.</p>
                  {form.familias.map((f, i) => (
                    <div key={i} className="cd-familia-row field-grid field-grid--no-pad">
                      <p className="ci-form-section field--span-2">Família {i + 1}</p>
                      <Input label="Nome do responsável" className="field--span-2"
                        value={f.responsavelNome || ""} onChange={e => setForm(fm => { const fs = [...fm.familias]; fs[i] = { ...fs[i], responsavelNome: e.target.value }; return { ...fm, familias: fs }; })} maxLength={300} />
                      <Input label="CPF / CNS do responsável"
                        value={f.responsavelCpfCns || ""} onChange={e => setForm(fm => { const fs = [...fm.familias]; fs[i] = { ...fs[i], responsavelCpfCns: e.target.value }; return { ...fm, familias: fs }; })} maxLength={30} />
                      <Input label="Data de nascimento do responsável" type="date"
                        value={f.responsavelNascimento || ""} onChange={e => setForm(fm => { const fs = [...fm.familias]; fs[i] = { ...fs[i], responsavelNascimento: e.target.value }; return { ...fm, familias: fs }; })} />
                      <Input label="Nº prontuário familiar"
                        value={f.prontuarioFamiliar || ""} onChange={e => setForm(fm => { const fs = [...fm.familias]; fs[i] = { ...fs[i], prontuarioFamiliar: e.target.value }; return { ...fm, familias: fs }; })} maxLength={50} />
                      <Input label="Renda familiar"
                        value={f.rendaFamiliar || ""} onChange={e => setForm(fm => { const fs = [...fm.familias]; fs[i] = { ...fs[i], rendaFamiliar: e.target.value }; return { ...fm, familias: fs }; })} maxLength={30} placeholder="ex: 1 salário" />
                      <Input label="Nº de membros" type="number" min="1" max="99"
                        value={f.numMembros != null ? String(f.numMembros) : ""} onChange={e => setForm(fm => { const fs = [...fm.familias]; fs[i] = { ...fs[i], numMembros: e.target.value ? parseInt(e.target.value, 10) : null }; return { ...fm, familias: fs }; })} />
                      <Input label="Reside desde (mês)" type="number" min="1" max="12"
                        value={f.resideDesdeMes != null ? String(f.resideDesdeMes) : ""} onChange={e => setForm(fm => { const fs = [...fm.familias]; fs[i] = { ...fs[i], resideDesdeMes: e.target.value ? parseInt(e.target.value, 10) : null }; return { ...fm, familias: fs }; })} placeholder="1-12" />
                      <Input label="Reside desde (ano)" type="number" min="1900" max="2100"
                        value={f.resideDesdeAno != null ? String(f.resideDesdeAno) : ""} onChange={e => setForm(fm => { const fs = [...fm.familias]; fs[i] = { ...fs[i], resideDesdeAno: e.target.value ? parseInt(e.target.value, 10) : null }; return { ...fm, familias: fs }; })} placeholder="ex: 2020" />
                      <label className="ci-form__radio-label field--span-2">
                        <input type="checkbox" className="acs-vis-checkbox"
                          checked={!!f.mudouSe}
                          onChange={e => setForm(fm => { const fs = [...fm.familias]; fs[i] = { ...fs[i], mudouSe: e.target.checked }; return { ...fm, familias: fs }; })} />
                        <span>Mudou-se</span>
                      </label>
                      <div className="field--span-2">
                        <Button type="button" variant="secondary" size="sm"
                          onClick={() => setForm(fm => ({ ...fm, familias: fm.familias.filter((_, j) => j !== i) }))}>
                          Remover família {i + 1}
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: "0.75rem" }}>
                    <Button type="button" variant="secondary" size="sm"
                      onClick={() => setForm(fm => ({ ...fm, familias: [...fm.familias, {}] }))}>
                      + Inserir família
                    </Button>
                  </div>
                </div>
              </details>

              {/* ── Instituição de permanência ── */}
              <details className="cd-acc">
                <summary className="cd-acc__header">Instituição de permanência</summary>
                <div className="cd-acc__body field-grid field-grid--no-pad">
                  <Input label="Nome da instituição" className="field--span-2"
                    value={form.instituicaoPermanencia} onChange={e => fld("instituicaoPermanencia", e.target.value)} maxLength={500} />
                </div>
              </details>

            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

function CdRow({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="ci-view__row">
      <span className="ci-view__label">{label}</span>
      <span className="ci-view__value">{String(value)}</span>
    </div>
  );
}

// ── CadastroIndividualSection — APS-01J-C / APS-01K ─────────────────────────

const CI_ESCOLARIDADE_OPTIONS = [
  ["", "— selecionar —"],
  ["SEM_ESCOLARIDADE", "Sem escolaridade"],
  ["FUNDAMENTAL_INCOMPLETO", "Fundamental incompleto"],
  ["FUNDAMENTAL_COMPLETO", "Fundamental completo"],
  ["MEDIO_INCOMPLETO", "Médio incompleto"],
  ["MEDIO_COMPLETO", "Médio completo"],
  ["SUPERIOR_INCOMPLETO", "Superior incompleto"],
  ["SUPERIOR_COMPLETO", "Superior completo"],
  ["ESPECIALIZACAO", "Especialização"],
  ["MESTRADO", "Mestrado"],
  ["DOUTORADO", "Doutorado"],
  ["NAO_INFORMADO", "Não informado"],
];

const CI_SITUACAO_TRABALHO_OPTIONS = [
  ["", "— selecionar —"],
  ["EMPREGADO_COM_CARTEIRA", "Empregado com carteira"],
  ["EMPREGADO_SEM_CARTEIRA", "Empregado sem carteira"],
  ["AUTONOMO", "Autônomo"],
  ["APOSENTADO_PENSIONISTA", "Aposentado / pensionista"],
  ["DESEMPREGADO", "Desempregado"],
  ["NAO_TRABALHA", "Não trabalha"],
  ["NAO_SE_APLICA", "Não se aplica"],
  ["OUTRO", "Outro"],
];

const CI_NACIONALIDADE_OPTIONS = [
  ["", "— selecionar —"],
  ["BRASILEIRA", "Brasileira"],
  ["NATURALIZADA", "Naturalizada"],
  ["ESTRANGEIRA", "Estrangeira"],
];

const CI_RACA_COR_OPTIONS = [
  ["", "— selecionar —"],
  ["BRANCA", "Branca"],
  ["PRETA", "Preta"],
  ["PARDA", "Parda"],
  ["AMARELA", "Amarela"],
  ["INDIGENA", "Indígena"],
];

const CI_SEXO_OPTIONS = [
  ["", "— selecionar —"],
  ["M", "Masculino"],
  ["F", "Feminino"],
  ["I", "Indeterminado"],
];

const CI_DEFICIENCIA_OPTIONS = [
  { key: "AUDITIVA",               label: "Auditiva" },
  { key: "VISUAL",                 label: "Visual" },
  { key: "INTELECTUAL_COGNITIVA",  label: "Intelectual / cognitiva" },
  { key: "FISICA",                 label: "Física" },
  { key: "MULTIPLA",               label: "Múltipla" },
  { key: "NAO_INFORMADO",          label: "Não informado" },
];

const CI_CONDICOES_OPTIONS = [
  { key: "HIPERTENSAO",         label: "Hipertensão" },
  { key: "DIABETES",            label: "Diabetes" },
  { key: "AVC",                 label: "AVC/Derrame" },
  { key: "INFARTO",             label: "Infarto" },
  { key: "DOENCA_CARDIACA",     label: "Doença cardíaca" },
  { key: "DOENCA_RESPIRATORIA", label: "Doença respiratória" },
  { key: "HANSENIASE",          label: "Hanseníase" },
  { key: "TUBERCULOSE",         label: "Tuberculose" },
  { key: "CANCER",              label: "Câncer" },
  { key: "DOENCA_RENAL",        label: "Doença renal" },
  { key: "GESTANTE",            label: "Gestante" },
  { key: "PUERICULTURA",        label: "Puericultura" },
  { key: "TABAGISMO",           label: "Tabagismo" },
  { key: "ALCOOL_DROGAS",       label: "Álcool/drogas" },
  { key: "DST",                 label: "DST/IST" },
  { key: "VULNERABILIDADE_SOCIAL", label: "Vulnerabilidade social" },
  { key: "OUTRO",               label: "Outro" },
];

const CI_RELACAO_OPTIONS = [
  ["", "— selecionar —"],
  ["CONJUGE", "Cônjuge"],
  ["FILHO", "Filho(a)"],
  ["PAI", "Pai"],
  ["MAE", "Mãe"],
  ["IRMAO", "Irmão/Irmã"],
  ["AVO", "Avô/Avó"],
  ["NETO", "Neto(a)"],
  ["OUTRO", "Outro"],
];

function emptyCiForm(patient) {
  const p = patient || {};
  return {
    cns:                               p.cns || "",
    cpf:                               p.cpf || "",
    name:                              p.name || "",
    nomeSocial:                        p.nomeSocial || "",
    birthDate:                         p.birthDate || "",
    sexAtBirth:                        p.sexAtBirth || "",
    racaCor:                           p.racaCor || "",
    etnia:                             p.etnia || "",
    nacionalidade:                     p.nacionalidade || "",
    municipioNascimentoIbge:           p.municipioNascimentoIbge || "",
    phone:                             p.phone || "",
    email:                             p.email || "",
    escolaridade:                      p.escolaridade || "",
    occupation:                        p.occupation || "",
    situacaoMercadoTrabalho:           p.situacaoMercadoTrabalho || "",
    responsavelFamiliar:               p.responsavelFamiliar || "",
    cnsResponsavel:                    p.cnsResponsavel || "",
    relacaoResponsavel:                p.responsible?.relationship || "",
    deficiencia:                       p.deficiencia || [],
    condicoesSaude:                    p.condicoesSaude || [],
    situacaoRua:                       p.situacaoRua ?? null,
    triaAlimentosAcabaram:             p.triaAlimentosAcabaram ?? null,
    triaConsomiuApenasAlgunsDosAlimentos: p.triaConsomiuApenasAlgunsDosAlimentos ?? null,
  };
}

function ciStatusInfo(p) {
  if (!p) return { status: "none", label: "Cadastro Individual não preenchido", action: "Preencher Cadastro Individual" };
  const keyFields = [p.escolaridade, p.racaCor, p.situacaoMercadoTrabalho, p.sexAtBirth, p.birthDate, p.nacionalidade];
  const filled = keyFields.filter(Boolean).length;
  if (filled >= 4) return { status: "complete", label: "Cadastro Individual preenchido", action: null };
  if (filled >= 1) return { status: "incomplete", label: "Cadastro Individual incompleto", action: "Continuar preenchimento" };
  return { status: "none", label: "Cadastro Individual não preenchido", action: "Preencher Cadastro Individual" };
}

function CiSearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function CiClearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function CadastroIndividualSection({ token, user, patients }) {
  const [search, setSearch]           = useState("");
  const [dropFocused, setDropFocused] = useState(false);
  const searchRef                     = useRef(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [modalMode, setModalMode]     = useState("view");
  const [form, setForm]               = useState(emptyCiForm(null));
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [saveOk, setSaveOk]           = useState(false);

  const results = useMemo(() => {
    const q = search.trim();
    if (q.length < 2) return [];
    return patients.filter(p => matchesPatientSearch(p, q)).slice(0, 8);
  }, [search, patients]);

  const showDrop = dropFocused && search.trim().length >= 2 && !selectedPatient;
  const dropRect = showDrop ? searchRef.current?.getBoundingClientRect() : null;

  function selectPatient(p) {
    setSelectedPatient(p);
    setSearch(p.name);
    setDropFocused(false);
    setForm(emptyCiForm(p));
    setSaveError(""); setSaveOk(false);
  }

  function clearSelection() {
    setSelectedPatient(null);
    setSearch("");
    setShowModal(false);
    setSaveError(""); setSaveOk(false);
  }

  function openModal(mode) {
    setModalMode(mode);
    setForm(emptyCiForm(selectedPatient));
    setSaveError(""); setSaveOk(false);
    setShowModal(true);
  }

  function fld(key, value) { setForm(f => ({ ...f, [key]: value })); }

  function toggleArr(key, val) {
    setForm(f => {
      const cur = f[key] || [];
      return { ...f, [key]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaveError(""); setSaveOk(false);
    const payload = {
      ...(form.cns  ? { cns:  form.cns  } : {}),
      ...(form.cpf  ? { cpf:  form.cpf  } : {}),
      ...(form.name ? { name: form.name } : {}),
      ...(form.nomeSocial              ? { nomeSocial:              form.nomeSocial              } : {}),
      ...(form.birthDate               ? { birthDate:               form.birthDate               } : {}),
      ...(form.sexAtBirth              ? { sexAtBirth:              form.sexAtBirth              } : {}),
      ...(form.racaCor                 ? { racaCor:                 form.racaCor                 } : {}),
      ...(form.etnia                   ? { etnia:                   form.etnia                   } : {}),
      ...(form.nacionalidade           ? { nacionalidade:           form.nacionalidade           } : {}),
      ...(form.municipioNascimentoIbge ? { municipioNascimentoIbge: form.municipioNascimentoIbge } : {}),
      ...(form.phone                   ? { phone:                   form.phone                   } : {}),
      ...(form.email                   ? { email:                   form.email                   } : {}),
      ...(form.escolaridade            ? { escolaridade:            form.escolaridade            } : {}),
      ...(form.occupation              ? { occupation:              form.occupation              } : {}),
      ...(form.situacaoMercadoTrabalho ? { situacaoMercadoTrabalho: form.situacaoMercadoTrabalho } : {}),
      ...(form.responsavelFamiliar     ? { responsavelFamiliar:     form.responsavelFamiliar     } : {}),
      ...(form.cnsResponsavel          ? { cnsResponsavel:          form.cnsResponsavel          } : {}),
      ...(form.relacaoResponsavel      ? { responsible: { relationship: form.relacaoResponsavel } } : {}),
      deficiencia:    form.deficiencia    || [],
      condicoesSaude: form.condicoesSaude || [],
      ...(form.situacaoRua !== null                          ? { situacaoRua:                          form.situacaoRua                          } : {}),
      ...(form.triaAlimentosAcabaram !== null                ? { triaAlimentosAcabaram:                form.triaAlimentosAcabaram                } : {}),
      ...(form.triaConsomiuApenasAlgunsDosAlimentos !== null ? { triaConsomiuApenasAlgunsDosAlimentos: form.triaConsomiuApenasAlgunsDosAlimentos } : {}),
    };
    try {
      const res = await fetch(`/api/patients/${selectedPatient.id}/cadastro-individual`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, updatedAt: selectedPatient.updatedAt }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setSaveError("Este registro foi alterado por outro usuário. Atualize os dados antes de salvar novamente.");
        } else {
          setSaveError(body.error || `Erro ${res.status}`);
        }
      } else {
        setSelectedPatient(body);
        setForm(emptyCiForm(body));
        setModalMode("view");
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 4000);
      }
    } catch {
      setSaveError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  const statusInfo = ciStatusInfo(selectedPatient);

  return (
    <div className="ci-section">
      <div className="ci-section__header">
        <h2 className="ci-section__title">Cadastro Individual</h2>
        <p className="ci-section__sub">Busque um paciente para visualizar ou preencher o Cadastro Individual (e-SUS).</p>
      </div>

      {/* ── Search bar ── */}
      <div className="ci-search-wrap" ref={searchRef}>
        <div className="input">
          <span className="input__icon"><CiSearchIcon /></span>
          <input
            className="input__control"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (selectedPatient && e.target.value !== selectedPatient.name) setSelectedPatient(null);
            }}
            onFocus={() => setDropFocused(true)}
            onBlur={() => setTimeout(() => setDropFocused(false), 150)}
            placeholder="Buscar por nome, CPF, CNS ou telefone..."
            autoComplete="off"
            aria-label="Buscar paciente para Cadastro Individual"
          />
          {selectedPatient && (
            <button type="button" className="ci-search-clear" onClick={clearSelection} aria-label="Limpar seleção de paciente">
              <CiClearIcon />
            </button>
          )}
        </div>
      </div>

      {/* ── Autocomplete dropdown (portal) ── */}
      {dropRect && createPortal(
        <div
          className="agenda-pat-dropdown"
          style={{ position: "fixed", top: dropRect.bottom + 4, left: dropRect.left, width: dropRect.width, zIndex: 9999 }}
        >
          {results.length === 0 ? (
            <div className="agenda-pat-empty">Nenhum paciente encontrado.</div>
          ) : results.map(p => {
            const am = ageInMonths(p.birthDate);
            const ageLabel = am !== null ? (am < 24 ? `${am}m` : `${Math.floor(am / 12)}a`) : "";
            const meta = [
              ageLabel,
              p.phone,
              p.cpf ? `CPF ${maskCpf(p.cpf)}` : (p.cns ? `CNS ●●●…${String(p.cns).slice(-3)}` : null),
            ].filter(Boolean).join(" · ");
            return (
              <button key={p.id} type="button" className="agenda-pat-opt" onClick={() => selectPatient(p)}>
                <span className="agenda-pat-opt__avatar">{initials(p.name)}</span>
                <span>
                  <div className="agenda-pat-opt__name">
                    {p.nomeSocial
                      ? <>{p.nomeSocial} <span className="agenda-pat-opt__civil">({p.name})</span></>
                      : p.name}
                  </div>
                  {meta && <div className="agenda-pat-opt__meta">{meta}</div>}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}

      {/* ── Empty state ── */}
      {!selectedPatient && (
        <div className="ci-empty">
          <EmptyState
            title="Selecione um paciente"
            description="Busque um paciente pelo nome, CPF, CNS ou telefone para visualizar ou preencher o Cadastro Individual."
          />
        </div>
      )}

      {/* ── Patient card ── */}
      {selectedPatient && (() => {
        const am = ageInMonths(selectedPatient.birthDate);
        const ageLabel = am !== null ? (am < 24 ? `${am}m` : `${Math.floor(am / 12)}a`) : "";
        const addr = [selectedPatient.logradouro, selectedPatient.numero, selectedPatient.bairro]
          .filter(Boolean).join(", ") || selectedPatient.address || "";
        return (
          <div className="ci-patient-card">
            <div className="ci-patient-card__avatar" aria-hidden="true">
              {initials(selectedPatient.name)}
            </div>
            <div className="ci-patient-card__body">
              <div className="ci-patient-card__name">
                {selectedPatient.nomeSocial || selectedPatient.name}
              </div>
              {selectedPatient.nomeSocial && (
                <div className="ci-patient-card__civil">{selectedPatient.name}</div>
              )}
              <div className="ci-patient-card__meta">
                {ageLabel && <span>{ageLabel}</span>}
                {selectedPatient.phone && <span>{selectedPatient.phone}</span>}
                {selectedPatient.cpf && <span>CPF {maskCpf(selectedPatient.cpf)}</span>}
                {!selectedPatient.cpf && selectedPatient.cns && (
                  <span>CNS ●●●…{String(selectedPatient.cns).slice(-4)}</span>
                )}
              </div>
              {addr && <div className="ci-patient-card__addr">{addr}</div>}
              <span className={`ci-status ci-status--${statusInfo.status}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="ci-patient-card__actions">
              {statusInfo.status === "complete" ? (
                <>
                  <Button variant="secondary" size="sm" onClick={() => openModal("view")}>Visualizar</Button>
                  <Button size="sm" onClick={() => openModal("edit")}>Editar</Button>
                </>
              ) : (
                <Button size="sm" onClick={() => openModal("edit")}>{statusInfo.action}</Button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Modal ── */}
      {showModal && selectedPatient && (
        <Modal
          title={`Cadastro Individual — ${selectedPatient.nomeSocial || selectedPatient.name}`}
          className="modal--ci"
          onClose={() => { setShowModal(false); setSaveError(""); }}
          actions={
            modalMode === "edit" ? (
              <>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => { setModalMode("view"); setForm(emptyCiForm(selectedPatient)); setSaveError(""); }}
                >
                  Cancelar
                </Button>
                <Button type="submit" form="ci-form" disabled={saving}>
                  {saving ? "Salvando…" : "Salvar Cadastro Individual"}
                </Button>
              </>
            ) : (
              <Button onClick={() => openModal("edit")}>Editar</Button>
            )
          }
        >
          {saveOk    && <div className="alert alert--success" role="status">Cadastro Individual salvo com sucesso.</div>}
          {saveError && <div className="alert alert--danger"  role="alert">{saveError}</div>}

          {modalMode === "view" ? (
            <div className="ci-view">
              <CiRow label="Nome social"          value={selectedPatient.nomeSocial} />
              <CiRow label="Data de nascimento"   value={fmtDate(selectedPatient.birthDate)} />
              <CiRow label="Sexo"                 value={selectedPatient.sexAtBirth} />
              <CiRow label="Raça/Cor"             value={selectedPatient.racaCor} />
              <CiRow label="Etnia"                value={selectedPatient.etnia} />
              <CiRow label="Nacionalidade"        value={selectedPatient.nacionalidade} />
              <CiRow label="Município nasc."      value={selectedPatient.municipioNascimentoIbge} />
              <CiRow label="Telefone"             value={selectedPatient.phone} />
              <CiRow label="E-mail"               value={selectedPatient.email} />
              <CiRow label="Escolaridade"         value={selectedPatient.escolaridade} />
              <CiRow label="Ocupação"             value={selectedPatient.occupation} />
              <CiRow label="Situação trabalho"    value={selectedPatient.situacaoMercadoTrabalho} />
              <CiRow label="Responsável"          value={selectedPatient.responsavelFamiliar} />
              <CiRow label="Relação responsável"  value={selectedPatient.responsible?.relationship} />
              <CiRow label="Deficiências"         value={(selectedPatient.deficiencia || []).join(", ")} />
              <CiRow label="Condições de saúde"   value={(selectedPatient.condicoesSaude || []).join(", ")} />
              <CiRow label="Situação de rua"      value={selectedPatient.situacaoRua == null ? "" : selectedPatient.situacaoRua ? "Sim" : "Não"} />
              <div className="ci-view__group ci-view__group--tria">
                <span className="ci-view__group-title">TRIA — Insegurança Alimentar</span>
                <CiRow label="Alimentos acabaram antes de ter dinheiro para comprar mais?" value={boolStr(selectedPatient.triaAlimentosAcabaram)} />
                <CiRow label="Consumiu apenas alguns alimentos porque o dinheiro acabou?"  value={boolStr(selectedPatient.triaConsomiuApenasAlgunsDosAlimentos)} />
              </div>
            </div>
          ) : (
            <form id="ci-form" className="field-grid field-grid--no-pad" onSubmit={handleSave} noValidate>

              <p className="ci-form-section field--span-2">Identificação</p>
              <Input label="CNS" value={form.cns} onChange={e => fld("cns", e.target.value)} maxLength={30} placeholder="15 dígitos" />
              <Input label="CPF" value={form.cpf} onChange={e => fld("cpf", e.target.value)} maxLength={14} placeholder="000.000.000-00" />
              <Input label="Nome *" className="field--span-2" value={form.name} onChange={e => fld("name", e.target.value)} maxLength={300} />
              <Input label="Nome social" className="field--span-2" value={form.nomeSocial} onChange={e => fld("nomeSocial", e.target.value)} maxLength={150} placeholder="Nome preferido" />

              <p className="ci-form-section field--span-2">Dados demográficos</p>
              <Input label="Data de nascimento" type="date" value={form.birthDate} onChange={e => fld("birthDate", e.target.value)} />
              <Select label="Sexo" value={form.sexAtBirth} onChange={e => fld("sexAtBirth", e.target.value)}>
                {CI_SEXO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Select label="Raça/Cor" value={form.racaCor} onChange={e => fld("racaCor", e.target.value)}>
                {CI_RACA_COR_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Input label="Etnia" value={form.etnia} onChange={e => fld("etnia", e.target.value)} maxLength={100} />
              <Select label="Nacionalidade" value={form.nacionalidade} onChange={e => fld("nacionalidade", e.target.value)}>
                {CI_NACIONALIDADE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Input label="Município de nascimento (IBGE)" value={form.municipioNascimentoIbge} onChange={e => fld("municipioNascimentoIbge", e.target.value)} maxLength={7} placeholder="7 dígitos" />

              <p className="ci-form-section field--span-2">Contato</p>
              <Input label="Telefone" value={form.phone} onChange={e => fld("phone", e.target.value)} maxLength={30} placeholder="(00) 00000-0000" />
              <Input label="E-mail" type="email" value={form.email} onChange={e => fld("email", e.target.value)} maxLength={200} />

              <p className="ci-form-section field--span-2">Informações sociodemográficas</p>
              <Select label="Escolaridade" value={form.escolaridade} onChange={e => fld("escolaridade", e.target.value)}>
                {CI_ESCOLARIDADE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Input label="Ocupação" value={form.occupation} onChange={e => fld("occupation", e.target.value)} maxLength={200} />
              <Select label="Situação no mercado de trabalho" className="field--span-2" value={form.situacaoMercadoTrabalho} onChange={e => fld("situacaoMercadoTrabalho", e.target.value)}>
                {CI_SITUACAO_TRABALHO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>

              <p className="ci-form-section field--span-2">Responsável familiar</p>
              <Input label="Nome do responsável" className="field--span-2" value={form.responsavelFamiliar} onChange={e => fld("responsavelFamiliar", e.target.value)} maxLength={300} />
              <Input label="CNS do responsável" value={form.cnsResponsavel} onChange={e => fld("cnsResponsavel", e.target.value)} maxLength={30} />
              <Select label="Relação com responsável" value={form.relacaoResponsavel} onChange={e => fld("relacaoResponsavel", e.target.value)}>
                {CI_RELACAO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>

              <p className="ci-form-section field--span-2">Deficiências</p>
              <div className="ci-form__checks field--span-2">
                {CI_DEFICIENCIA_OPTIONS.map(({ key, label }) => (
                  <label key={key} className="acs-vis-check-label">
                    <input type="checkbox" className="acs-vis-checkbox"
                      checked={(form.deficiencia || []).includes(key)}
                      onChange={() => toggleArr("deficiencia", key)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <p className="ci-form-section field--span-2">Condições de saúde</p>
              <div className="ci-form__checks field--span-2">
                {CI_CONDICOES_OPTIONS.map(({ key, label }) => (
                  <label key={key} className="acs-vis-check-label">
                    <input type="checkbox" className="acs-vis-checkbox"
                      checked={(form.condicoesSaude || []).includes(key)}
                      onChange={() => toggleArr("condicoesSaude", key)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <p className="ci-form-section field--span-2">Situação de rua</p>
              <fieldset className="ci-form__fieldset field--span-2">
                <legend className="field__label">Em situação de rua?</legend>
                <div className="ci-form__radios">
                  {[["sim", true], ["nao", false], ["ni", null]].map(([id, val]) => (
                    <label key={id} className="ci-form__radio-label">
                      <input type="radio" name="situacaoRua" className="acs-vis-radio"
                        checked={form.situacaoRua === val}
                        onChange={() => fld("situacaoRua", val)} />
                      <span>{val === true ? "Sim" : val === false ? "Não" : "Não informado"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <p className="ci-form-section field--span-2">TRIA — Triagem de Insegurança Alimentar</p>
              <fieldset className="ci-form__fieldset field--span-2">
                <legend className="field__label">Nos últimos 3 meses, os alimentos acabaram antes de ter dinheiro para comprar mais?</legend>
                <div className="ci-form__radios">
                  {[["sim", true], ["nao", false], ["ni", null]].map(([id, val]) => (
                    <label key={id} className="ci-form__radio-label">
                      <input type="radio" name="triaAlimentosAcabaram" className="acs-vis-radio"
                        checked={form.triaAlimentosAcabaram === val}
                        onChange={() => fld("triaAlimentosAcabaram", val)} />
                      <span>{val === true ? "Sim" : val === false ? "Não" : "Não informado"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="ci-form__fieldset field--span-2">
                <legend className="field__label">Nos últimos 3 meses, precisou consumir apenas alguns alimentos porque o dinheiro acabou?</legend>
                <div className="ci-form__radios">
                  {[["sim", true], ["nao", false], ["ni", null]].map(([id, val]) => (
                    <label key={id} className="ci-form__radio-label">
                      <input type="radio" name="triaConsomiu" className="acs-vis-radio"
                        checked={form.triaConsomiuApenasAlgunsDosAlimentos === val}
                        onChange={() => fld("triaConsomiuApenasAlgunsDosAlimentos", val)} />
                      <span>{val === true ? "Sim" : val === false ? "Não" : "Não informado"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

function CiRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="ci-view__row">
      <span className="ci-view__label">{label}</span>
      <span className="ci-view__value">{value}</span>
    </div>
  );
}

function boolStr(v) {
  if (v === true)  return "Sim";
  if (v === false) return "Não";
  return "";
}

// ── ProductionSection — APS-01F ──────────────────────────────────────────────

const PROD_PERIODS = [
  ["hoje",      "Hoje"],
  ["semana",    "Semana"],
  ["mes",       "Mês"],
  ["trimestre", "Trimestre"],
];

function ProdKpi({ label, value, cls }) {
  return (
    <div className={`prod-kpi ${cls || ""}`}>
      <span className="prod-kpi__val">{value ?? "—"}</span>
      <span className="prod-kpi__lbl">{label}</span>
    </div>
  );
}

function ProductionSection({ token, user }) {
  const [period, setPeriod]   = useState("mes");
  const [data, setData]       = useState(null);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [prodRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/production/acs?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/active-search/stats`,             { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!prodRes.ok) {
        const body = await prodRes.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${prodRes.status} ao carregar produção`);
      }
      const [prod, st] = await Promise.all([prodRes.json(), statsRes.ok ? statsRes.json() : null]);
      setData(prod);
      setStats(st);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [period, token]);

  const v = data?.visits || {};
  const t = data?.tasks  || {};
  const g = data?.groups || {};

  return (
    <div className="prod-root">
      {/* Period filter */}
      <div className="prod-period-bar">
        {PROD_PERIODS.map(([key, lbl]) => (
          <button
            key={key}
            type="button"
            className={`prod-period-btn${period === key ? " is-active" : ""}`}
            onClick={() => setPeriod(key)}
          >
            {lbl}
          </button>
        ))}
      </div>

      {loading && <p className="prod-loading">Carregando...</p>}
      {error   && <p className="prod-error">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* Top KPI cards */}
          <div className="prod-kpi-grid">
            <ProdKpi label="Visitas realizadas"   value={v.realizada}     cls="prod-kpi--primary" />
            <ProdKpi label="Visitas total"        value={v.total}         cls="" />
            <ProdKpi label="Grupos visitados"     value={v.groupsVisited} cls="prod-kpi--teal" />
            <ProdKpi label="Tarefas concluídas"   value={t.done}          cls="prod-kpi--green" />
            <ProdKpi label="Tarefas em atraso"    value={t.overdue}       cls={t.overdue > 0 ? "prod-kpi--danger" : ""} />
            <ProdKpi label="Cadastros atualizados" value={data.registrationsUpdated} cls="" />
            <ProdKpi label="Novos grupos"         value={data.newGroups}  cls="" />
            <ProdKpi label="Transferências"       value={(data.transfers?.received || 0) + (data.transfers?.sent || 0)} cls="" />
          </div>

          {/* Visit breakdown */}
          <div className="prod-card">
            <h4 className="prod-card__title">Visitas — {PROD_PERIODS.find(p => p[0] === period)?.[1]}</h4>
            <div className="prod-visit-row">
              <span className="prod-visit-row__label">Realizadas</span>
              <span className="prod-visit-row__val prod-visit-row__val--green">{v.realizada ?? 0}</span>
            </div>
            <div className="prod-visit-row">
              <span className="prod-visit-row__label">Recusadas</span>
              <span className="prod-visit-row__val prod-visit-row__val--warn">{v.recusada ?? 0}</span>
            </div>
            <div className="prod-visit-row">
              <span className="prod-visit-row__label">Ausentes</span>
              <span className="prod-visit-row__val prod-visit-row__val--muted">{v.ausente ?? 0}</span>
            </div>
          </div>

          {/* Situação operacional */}
          <div className="prod-card">
            <h4 className="prod-card__title">Minha situação operacional</h4>
            <div className="prod-ops-row">
              <span className="prod-ops__label">Score médio dos grupos</span>
              <span className="prod-ops__val prod-score">{g.avgScore ?? "—"}/100</span>
            </div>
            <div className="prod-ops-scores">
              <div className="prod-ops-chip prod-ops-chip--critico">
                <span>{g.critical ?? 0}</span><span>Críticos</span>
              </div>
              <div className="prod-ops-chip prod-ops-chip--atencao">
                <span>{g.attention ?? 0}</span><span>Atenção</span>
              </div>
              <div className="prod-ops-chip prod-ops-chip--saudavel">
                <span>{g.healthy ?? 0}</span><span>Saudáveis</span>
              </div>
            </div>
            <div className="prod-ops-row">
              <span className="prod-ops__label">Total de grupos</span>
              <span className="prod-ops__val">{g.total ?? 0}</span>
            </div>
          </div>

          {/* Transfers */}
          {((data.transfers?.received || 0) + (data.transfers?.sent || 0)) > 0 && (
            <div className="prod-card">
              <h4 className="prod-card__title">Movimentação territorial</h4>
              <div className="prod-visit-row">
                <span className="prod-visit-row__label">Recebidas</span>
                <span className="prod-visit-row__val">{data.transfers?.received ?? 0}</span>
              </div>
              <div className="prod-visit-row">
                <span className="prod-visit-row__label">Enviadas</span>
                <span className="prod-visit-row__val">{data.transfers?.sent ?? 0}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── ActiveSearchSection — APS-01E ────────────────────────────────────────────

const AS_CLASS_LABEL = { critico: "Crítico", atencao: "Atenção", saudavel: "Saudável" };
const AS_CLASS_CLS   = { critico: "as-badge--critico", atencao: "as-badge--atencao", saudavel: "as-badge--saudavel" };

const AS_PRIORITY_LABEL = { high: "Alta", medium: "Média", low: "Baixa" };
const AS_PRIORITY_CLS   = { high: "as-pend--high", medium: "as-pend--medium", low: "as-pend--low" };

const PENDENCY_SECTION_LABELS = {
  critico:  "Críticos",
  atencao:  "Atenção",
  saudavel: "Saudáveis",
};

function AsGroupCard({ result, onOpenGroup, onStartVisit }) {
  return (
    <div className={`as-card as-card--${result.classification}`}>
      <div className="as-card__header">
        <div className="as-card__title-row">
          <span className={`as-badge ${AS_CLASS_CLS[result.classification]}`}>
            {AS_CLASS_LABEL[result.classification]}
          </span>
          <span className="as-card__score">{result.score}/100</span>
        </div>
        <p className="as-card__address">{result.address || "Endereço não informado"}</p>
        {result.acsName && <p className="as-card__acs">ACS: {result.acsName}</p>}
        {result.microArea && <p className="as-card__micro">Microárea: {result.microArea}</p>}
      </div>

      {result.pendencies.length > 0 && (
        <ul className="as-card__pends">
          {result.pendencies.map(p => (
            <li key={p.code} className={`as-pend ${AS_PRIORITY_CLS[p.priority]}`}>
              <span className="as-pend__rule">{p.rule}</span>
              <span className="as-pend__label">{p.label}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="as-card__actions">
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => onOpenGroup && onOpenGroup(result.groupId)}
        >
          Ver grupo
        </button>
        <button
          type="button"
          className="btn btn--sm btn--primary"
          onClick={() => onStartVisit && onStartVisit(result.groupId)}
        >
          Iniciar visita
        </button>
      </div>
    </div>
  );
}

function ActiveSearchSection({ token, user, onOpenGroup, onStartVisit }) {
  const [data, setData]           = useState(null);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Filters
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterMicro, setFilterMicro]     = useState("");
  const [filterPendency, setFilterPendency] = useState("");
  const [filterAcs, setFilterAcs]         = useState("");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filterStatus)   params.set("status",   filterStatus);
      if (filterMicro)    params.set("microarea", filterMicro);
      if (filterPendency) params.set("pendency",  filterPendency);
      if (filterAcs)      params.set("acsId",     filterAcs);

      const [listRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/active-search?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/active-search/stats`,     { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!listRes.ok) {
        const body = await listRes.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${listRes.status} ao carregar busca ativa`);
      }
      if (!statsRes.ok) {
        const body = await statsRes.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${statsRes.status} ao carregar estatísticas`);
      }
      const [list, st] = await Promise.all([listRes.json(), statsRes.json()]);
      setData(list);
      setStats(st);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [filterStatus, filterMicro, filterPendency, filterAcs, token]);

  const items = data?.items || [];
  const critical  = items.filter(r => r.classification === "critico");
  const attention = items.filter(r => r.classification === "atencao");
  const healthy   = items.filter(r => r.classification === "saudavel");

  const sections = [
    { key: "critico",  list: critical  },
    { key: "atencao",  list: attention },
    { key: "saudavel", list: healthy   },
  ];

  return (
    <div className="as-root">
      {/* Stats bar */}
      {stats && (
        <div className="as-stats">
          <div className="as-stats__item as-stats__item--critico">
            <span className="as-stats__val">{stats.critical}</span>
            <span className="as-stats__lbl">Críticos</span>
          </div>
          <div className="as-stats__item as-stats__item--atencao">
            <span className="as-stats__val">{stats.attention}</span>
            <span className="as-stats__lbl">Atenção</span>
          </div>
          <div className="as-stats__item as-stats__item--saudavel">
            <span className="as-stats__val">{stats.healthy}</span>
            <span className="as-stats__lbl">Saudáveis</span>
          </div>
          <div className="as-stats__item">
            <span className="as-stats__val">{stats.avgScore}</span>
            <span className="as-stats__lbl">Score médio</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="as-filters">
        <select
          className="as-filter-sel"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          aria-label="Filtrar por situação"
        >
          <option value="">Todas as situações</option>
          <option value="critico">Críticos</option>
          <option value="atencao">Atenção</option>
          <option value="saudavel">Saudáveis</option>
        </select>

        <select
          className="as-filter-sel"
          value={filterPendency}
          onChange={e => setFilterPendency(e.target.value)}
          aria-label="Filtrar por pendência"
        >
          <option value="">Todas as pendências</option>
          <option value="UPDATE_REGISTRATION_REQUIRED">Cadastro desatualizado</option>
          <option value="VISIT_RECOMMENDED">Visita recomendada</option>
          <option value="MISSING_CNS">Sem CNS</option>
          <option value="ADDRESS_VALIDATION_REQUIRED">Endereço incompleto</option>
          <option value="FAMILY_OUT_OF_FOLLOWUP">Fora de acompanhamento</option>
          <option value="OVERDUE_TASK">Tarefa em atraso</option>
          <option value="NEW_MEMBER_REVIEW">Novo morador</option>
          <option value="TERRITORIAL_REVIEW">Revisão territorial</option>
        </select>

        <input
          className="as-filter-input"
          type="text"
          placeholder="Microárea"
          value={filterMicro}
          onChange={e => setFilterMicro(e.target.value)}
          aria-label="Filtrar por microárea"
        />

        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={load}
          aria-label="Atualizar"
        >
          ↺ Atualizar
        </button>
      </div>

      {loading && <p className="as-loading">Carregando...</p>}
      {error   && <p className="as-error">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="as-empty">
          <p>Nenhum grupo familiar encontrado para os filtros selecionados.</p>
        </div>
      )}

      {!loading && !error && sections.map(({ key, list }) => (
        list.length === 0 ? null : (
          <section key={key} className={`as-section as-section--${key}`}>
            <h3 className="as-section__title">
              {PENDENCY_SECTION_LABELS[key]}
              <span className="as-section__count">{list.length}</span>
            </h3>
            <div className="as-cards">
              {list.map(r => (
                <AsGroupCard
                  key={r.groupId}
                  result={r}
                  onOpenGroup={onOpenGroup}
                  onStartVisit={onStartVisit}
                />
              ))}
            </div>
          </section>
        )
      ))}
    </div>
  );
}

// ── AcsTasksPage ────────────────────────────────────────────────────────────

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
  // visitas pre-select: task card can push a patient into the Visitas tab
  const [visitPreSelect, setVisitPreSelect] = useState(null);

  useEffect(() => {
    if (!token) return;
    const myPatients = patients.filter(p => p.assignedAcsId === user?.id);
    if (!myPatients.length) { setAllTasks([]); setLoading(false); return; }
    setLoading(true);
    Promise.all(myPatients.map(p =>
      fetch(`${API_URL}/patients/${p.id}/tasks`, { headers: { Authorization: `Bearer ${token}` } })
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
      await fetch(`${API_URL}/patients/${task.patientId}/tasks/${task.id}`, {
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
          {[["tasks", "Tarefas"], ["visitas", "Visitas"], ["groups", "Grupos Familiares"], ["ci", "Cadastro Individual"], ["cd", "Cadastro Domiciliar"], ["busca", "Busca Ativa"], ["producao", "Produção"]].map(([val, lbl]) => (
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
                          {(t.type === "home_visit" || t.type === "active_search") && !done && (() => {
                            const pat = patients.find(p => p.id === t.patientId);
                            return pat ? (
                              <button
                                type="button"
                                className="acs-task__visit-btn"
                                onClick={() => {
                                  setVisitPreSelect(pat);
                                  setActiveTab("visitas");
                                }}
                              >
                                Registrar Visita
                              </button>
                            ) : null;
                          })()}
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

        {activeTab === "visitas" && (
          <VisitasTab
            patients={patients}
            user={user}
            token={token}
            preSelectPatient={visitPreSelect}
            clearPreSelect={() => setVisitPreSelect(null)}
          />
        )}

        {activeTab === "groups" && (
          <FamilyGroupsSection
            token={token}
            user={user}
            patients={patients}
            onNavigatePatient={onNavigatePatient}
            onStartVisitForGroup={(patient) => {
              if (patient) setVisitPreSelect(patient);
              setActiveTab("visitas");
            }}
          />
        )}

        {activeTab === "cd" && (
          <CadastroDomiciliarSection
            token={token}
            user={user}
            patients={patients}
          />
        )}

        {activeTab === "ci" && (
          <CadastroIndividualSection
            token={token}
            user={user}
            patients={patients}
          />
        )}

        {activeTab === "producao" && (
          <ProductionSection
            token={token}
            user={user}
          />
        )}

        {activeTab === "busca" && (
          <ActiveSearchSection
            token={token}
            user={user}
            onOpenGroup={(groupId) => {
              // Switch to groups tab with workspace open
              setActiveTab("groups");
              // The FamilyGroupsSection handles activeGroupId internally;
              // we pass a signal via sessionStorage so it opens directly
              sessionStorage.setItem("vitras_openGroupId", groupId);
            }}
            onStartVisit={(groupId) => {
              setActiveTab("visitas");
            }}
          />
        )}
      </div>
    </div>
  );
}

export default AcsTasksPage;
