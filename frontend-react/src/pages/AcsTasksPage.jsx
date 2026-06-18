import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
    fetch(`/family-groups/${groupId}`, { headers: { Authorization: `Bearer ${token}` } })
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
  { key: "ac_gestante",          label: "Gestante"                          },
  { key: "ac_puerpera",          label: "Puérpera"                          },
  { key: "ac_recem_nascido",     label: "Recém-nascido"                     },
  { key: "ac_crianca",           label: "Criança"                           },
  { key: "ac_desnutrida",        label: "Pessoa desnutrida"                 },
  { key: "ac_reabilitacao",      label: "Pessoa em reabilitação / deficiência" },
  { key: "ac_hipertensao",       label: "Pessoa com hipertensão"            },
  { key: "ac_diabetes",          label: "Pessoa com diabetes"               },
  { key: "ac_asma",              label: "Pessoa com asma"                   },
  { key: "ac_dpoc",              label: "Pessoa com DPOC/enfisema"          },
  { key: "ac_cancer",            label: "Pessoa com câncer"                 },
  { key: "ac_cardiovascular",    label: "Pessoa com doença cardiovascular"  },
  { key: "ac_renal",             label: "Pessoa com doença renal"           },
  { key: "ac_hanseniase",        label: "Pessoa com hanseníase"             },
  { key: "ac_tuberculose",       label: "Pessoa com tuberculose"            },
  { key: "ac_sofrimento_mental", label: "Pessoa com sofrimento mental"      },
  { key: "ac_acamada",           label: "Pessoa acamada"                    },
  { key: "ac_domiciliada",       label: "Pessoa domiciliada"                },
  { key: "ac_tabagista",         label: "Tabagista"                         },
  { key: "ac_alcool",                    label: "Usuário de álcool"                    },
  { key: "ac_outras_drogas",            label: "Usuário de outras drogas"             },
  { key: "ac_pessoa_idosa",             label: "Pessoa idosa"                         },
  { key: "ac_sintomaticos_resp",        label: "Sintomáticos respiratórios"           },
  { key: "ac_outras_doencas_cronicas",  label: "Outras doenças crônicas"             },
  { key: "ac_vulnerabilidade_social",   label: "Condições de vulnerabilidade social"  },
];

const CONTROLE_AMBIENTAL_OPTIONS = [
  { key: "ca_acao_educativa",  label: "Ação educativa"    },
  { key: "ca_imovel_foco",     label: "Imóvel com foco"   },
  { key: "ca_acao_mecanica",   label: "Ação mecânica"     },
  { key: "ca_trat_focal",      label: "Tratamento focal"  },
];

function emptyVisitForm(today, patient) {
  return {
    date:               today,
    turno:              "manha",
    microarea:          patient?.microarea || patient?.microArea || "",
    foraArea:           false,
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
    if (!term) return patients.slice(0, 20);
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

      {results.length === 0 ? (
        <p className="acs-vis-selector__empty">Nenhum paciente encontrado.</p>
      ) : (
        <div className="acs-vis-selector__list">
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              className="acs-vis-pat-row"
              onClick={() => onSelect(p)}
            >
              <div className="acs-vis-pat-row__name">
                {p.socialName ? (
                  <><strong>{p.socialName}</strong><span className="acs-vis-pat-row__civil"> ({p.name})</span></>
                ) : <strong>{p.name}</strong>}
              </div>
              <div className="acs-vis-pat-row__meta">
                {ageStr(p.birthDate) && <span>{ageStr(p.birthDate)}</span>}
                {p.sex === "male" || p.sex === "masculino" ? <span>M</span>
                  : p.sex === "female" || p.sex === "feminino" ? <span>F</span> : null}
                {p.microarea && <span>Microárea {p.microarea}</span>}
              </div>
              {p.address && (
                <div className="acs-vis-pat-row__addr">{p.address}{p.addressNumber ? `, ${p.addressNumber}` : ""}</div>
              )}
            </button>
          ))}
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const upd = useCallback((field, val) =>
    setForm(s => ({ ...s, [field]: val })), []);

  const toggleMap = useCallback((mapField, key, checked) =>
    setForm(s => ({ ...s, [mapField]: { ...s[mapField], [key]: checked } })), []);

  const countChecked = obj => Object.values(obj).filter(Boolean).length;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date)     { setError("Informe a data da visita."); return; }
    if (!form.desfecho) { setError("Selecione o desfecho."); return; }
    setError("");
    setSaving(true);

    const body = {
      patientId:         patient.id,
      taskId:            taskOrigin?.id || null,
      date:              form.date,
      turno:             form.turno || null,
      microarea:         form.microarea || null,
      foraArea:          form.foraArea === true,
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
      const res = await fetch("/acs-visits", {
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

  return (
    <form className="acs-vis-form" onSubmit={handleSubmit} noValidate>
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
          {patient.address && <span className="acs-vis-form__patient-addr">{patient.address}{patient.addressNumber ? `, ${patient.addressNumber}` : ""}</span>}
        </div>
      </div>

      {taskOrigin && (
        <div className="acs-vis-task-origin">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M6 4H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Originada de tarefa: <strong>{taskOrigin.title}</strong>
        </div>
      )}

      {error && <div className="acs-vis-error" role="alert">{error}</div>}

      {/* Bloco 1 — Dados da visita */}
      <AccordionBlock title="Dados da visita" defaultOpen>
        <div className="acs-vis-fields">
          <div className="acs-vis-field">
            <label className="acs-vis-label" htmlFor="vis-date">Data</label>
            <input
              id="vis-date"
              className="acs-vis-input"
              type="date"
              value={form.date}
              max={today}
              onChange={e => upd("date", e.target.value)}
              required
            />
          </div>
          <div className="acs-vis-field">
            <label className="acs-vis-label" htmlFor="vis-turno">Turno</label>
            <select id="vis-turno" className="acs-vis-select" value={form.turno} onChange={e => upd("turno", e.target.value)}>
              {TURNO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="acs-vis-field">
            <label className="acs-vis-label" htmlFor="vis-microarea">Microárea</label>
            <input
              id="vis-microarea"
              className="acs-vis-input"
              type="text"
              maxLength={50}
              value={form.microarea}
              onChange={e => upd("microarea", e.target.value)}
              placeholder="Ex: 01"
            />
          </div>
        </div>
        <label className="acs-vis-check-label" style={{ marginTop: "8px" }}>
          <input
            type="checkbox"
            className="acs-vis-checkbox"
            checked={form.foraArea}
            onChange={e => upd("foraArea", e.target.checked)}
          />
          <span>Fora da área de cobertura</span>
        </label>
      </AccordionBlock>

      {/* Bloco 2 — Motivo da visita */}
      <AccordionBlock title="Motivo da visita" badge={countChecked(form.motivos)} defaultOpen>
        <CheckGroup
          options={MOTIVO_OPTIONS}
          values={form.motivos}
          onChange={(k, v) => toggleMap("motivos", k, v)}
          columns={1}
        />
      </AccordionBlock>

      {/* Bloco 3 — Busca ativa */}
      <AccordionBlock title="Busca ativa" badge={countChecked(form.buscaAtiva)}>
        <CheckGroup
          options={BUSCA_ATIVA_OPTIONS}
          values={form.buscaAtiva}
          onChange={(k, v) => toggleMap("buscaAtiva", k, v)}
        />
      </AccordionBlock>

      {/* Bloco 4 — Acompanhamento */}
      <AccordionBlock title="Acompanhamento" badge={countChecked(form.acompanhamentos)}>
        <CheckGroup
          options={ACOMPANHAMENTO_OPTIONS}
          values={form.acompanhamentos}
          onChange={(k, v) => toggleMap("acompanhamentos", k, v)}
        />
      </AccordionBlock>

      {/* Bloco 5 — Controle ambiental e vetorial */}
      <AccordionBlock title="Controle ambiental e vetorial" badge={countChecked(form.controleAmbiental)}>
        <CheckGroup
          options={CONTROLE_AMBIENTAL_OPTIONS}
          values={form.controleAmbiental}
          onChange={(k, v) => toggleMap("controleAmbiental", k, v)}
          columns={2}
        />
      </AccordionBlock>

      {/* Bloco 6 — Antropometria */}
      <AccordionBlock title="Antropometria e sinais vitais">
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
        </div>
      </AccordionBlock>

      {/* Bloco 6b — Glicemia */}
      <AccordionBlock title="Glicemia">
        <div className="acs-vis-fields">
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
      </AccordionBlock>

      {/* Bloco 7 — Desfecho */}
      <AccordionBlock title="Desfecho" defaultOpen>
        <div className="acs-vis-desfecho-group">
          {DESFECHO_OPTIONS.map(o => (
            <label key={o.value} className={`acs-vis-desfecho-opt${form.desfecho === o.value ? " is-selected" : ""}`}>
              <input
                type="radio"
                name="desfecho"
                value={o.value}
                checked={form.desfecho === o.value}
                onChange={() => upd("desfecho", o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </AccordionBlock>

      {/* Bloco 8 — Observações */}
      <AccordionBlock title="Observações">
        <textarea
          className="acs-vis-textarea"
          rows={4}
          value={form.observacoes}
          onChange={e => upd("observacoes", e.target.value)}
          placeholder="Anotações livres sobre a visita..."
          aria-label="Observações"
        />
      </AccordionBlock>

      <div className="acs-vis-form__actions">
        <button type="button" className="acs-vis-btn-cancel" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="acs-vis-btn-save" disabled={saving}>
          {saving ? "Salvando..." : "Salvar Visita"}
        </button>
      </div>
    </form>
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
    fetch("/acs-visits", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setVisits(Array.isArray(data) ? data : []); setLoadingVisits(false); })
      .catch(() => setLoadingVisits(false));
  }, [token]);

  const myPatients = useMemo(() =>
    patients.filter(p => p.assignedAcsId === user?.id && !p.inactive),
    [patients, user?.id]
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
    setLoading(true);
    setError(null);
    try {
      const [prodRes, statsRes] = await Promise.all([
        fetch(`/production/acs?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/active-search/stats`,             { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!prodRes.ok) throw new Error("Erro ao carregar produção");
      const [prod, st] = await Promise.all([prodRes.json(), statsRes.ok ? statsRes.json() : null]);
      setData(prod);
      setStats(st);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period, token]);

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
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filterStatus)  params.set("status",   filterStatus);
      if (filterMicro)   params.set("microarea", filterMicro);
      if (filterPendency) params.set("pendency", filterPendency);
      if (filterAcs)     params.set("acsId",    filterAcs);

      const [listRes, statsRes] = await Promise.all([
        fetch(`/active-search?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/active-search/stats",     { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!listRes.ok || !statsRes.ok) throw new Error("Erro ao carregar busca ativa");
      const [list, st] = await Promise.all([listRes.json(), statsRes.json()]);
      setData(list);
      setStats(st);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterStatus, filterMicro, filterPendency, filterAcs]);

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
          {[["tasks", "Tarefas"], ["visitas", "Visitas"], ["groups", "Grupos Familiares"], ["busca", "Busca Ativa"], ["producao", "Produção"]].map(([val, lbl]) => (
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
