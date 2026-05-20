import { useEffect, useMemo, useState } from "react";

import { fetchAuditLogs } from "../api";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import { ageInMonths, protocolChip } from "../utils/clinical";
import { isAdmin, roleLabel } from "../utils/roles";

const C_ACCENT  = "var(--accent)";
const C_DANGER  = "var(--danger)";
const C_WARNING = "var(--warning)";
const C_SUCCESS = "var(--success)";
const C_INFO    = "var(--info)";
const C_MUTED   = "var(--text-muted)";

function Bar({ value, max, color = C_ACCENT }) {
  const pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0;
  return (
    <div className="gestor-bar-track">
      <div className="gestor-bar-fill" style={{ width: pct + "%", background: color }} />
    </div>
  );
}

function GaugePie({ value, max, color = C_ACCENT, label, size = 80 }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = 30, circ = 2 * Math.PI * r;
  const dash = circ * pct, gap = circ - dash;
  return (
    <div className="gestor-gauge">
      <svg width={size} height={size} viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray .5s ease" }} />
        <text x="36" y="40" textAnchor="middle"
          style={{ fontSize: 13, fontWeight: 800, fill: color, fontFamily: "var(--font-mono)" }}>
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <div className="gestor-gauge__label">{label}</div>
    </div>
  );
}

function GestorPage({
  patients,
  users,
  templates,
  protocolByPatient,
  agenda = [],
  referrals = [],
  pharmacyStock = [],
  pharmacyLog = [],
  token = "",
  user = null,
}) {
  const now = new Date();
  const ONLINE_WINDOW_MS = 2 * 60 * 1000;
  const [globalUserSearch, setGlobalUserSearch] = useState("");
  const [globalUserRoleFilter, setGlobalUserRoleFilter] = useState("all");
  const [globalUserStatusFilter, setGlobalUserStatusFilter] = useState("all");
  const [globalUserTeamFilter, setGlobalUserTeamFilter] = useState("all");
  const [auditRecent, setAuditRecent] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditError, setAuditError] = useState("");
  const canReadAudit = Boolean(isAdmin(user) || user?.capabilities?.includes("audit.read"));

  const [period, setPeriod] = useState("month");
  function inPeriod(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (period === "month")   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === "quarter") { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear(); }
    return d.getFullYear() === now.getFullYear();
  }
  const periodLabel = { month: "Mês atual", quarter: "Trimestre atual", year: "Ano atual" }[period];

  const totalPacientes = patients.length;
  const comAcs  = patients.filter(p => p.assignedAcsId).length;
  const semAcs  = totalPacientes - comAcs;
  const gestantes = patients.filter(p => String(p.careCategory || "").toLowerCase() === "pregnant").length;
  const criancas  = patients.filter(p => { const am = ageInMonths(p.birthDate); return am !== null && am < 120; }).length;
  const cronicos  = patients.filter(p => Array.isArray(p.chronicConditions) && p.chronicConditions.length > 0).length;
  const idosos    = patients.filter(p => { const am = ageInMonths(p.birthDate); return am !== null && am >= 720; }).length;

  const criticos  = patients.filter(p => protocolChip(protocolByPatient[p.id]).tone === "danger").length;
  const atencao   = patients.filter(p => protocolChip(protocolByPatient[p.id]).tone === "warn").length;
  const emDia     = patients.filter(p => protocolChip(protocolByPatient[p.id]).tone === "ok").length;
  const cobertura = totalPacientes > 0 ? Math.round(emDia / totalPacientes * 100) : 0;

  const agendaPeriod  = agenda.filter(a => inPeriod(a.date));
  const consultDone   = agendaPeriod.filter(a => a.status === "done").length;
  const consultAbsent = agendaPeriod.filter(a => a.status === "absent").length;
  const consultTotal  = agendaPeriod.length;
  const taxaComp      = consultTotal > 0 ? Math.round(consultDone / consultTotal * 100) : null;

  const refPeriod     = referrals.filter(r => inPeriod(r.createdAt));
  const refPendentes  = refPeriod.filter(r => r.status === "pending").length;
  const refConcluidos = refPeriod.filter(r => r.status === "done").length;

  const dispensas   = pharmacyLog.filter(l => l.type === "dispensa" && inPeriod(l.ts)).length;
  const lowStock    = (pharmacyStock || []).filter(s => Number(s.qty || 0) <= Number(s.minQty || 0)).length;
  const estoqueCrit = (pharmacyStock || []).filter(s => Number(s.qty || 0) === 0).length;

  const acsCount  = users.filter(u => u.role === "acs").length;
  const docCount  = users.filter(u => ["doctor", "nurse_manager"].includes(u.role)).length;
  const dentCount = users.filter(u => u.role === "dentist").length;
  const techCount = users.filter(u => ["nursing_tech", "pharmacy_tech"].includes(u.role)).length;

  const acsPerf = users.filter(u => u.role === "acs").map(u => {
    const mine = patients.filter(p => p.assignedAcsId === u.id);
    const crit = mine.filter(p => protocolChip(protocolByPatient[p.id]).tone === "danger").length;
    const ok   = mine.filter(p => protocolChip(protocolByPatient[p.id]).tone === "ok").length;
    return { name: u.name, total: mine.length, criticos: crit, emDia: ok };
  }).sort((a, b) => b.criticos - a.criticos);

  const catBreak = {};
  patients.forEach(p => { const c = p.careCategory || "general"; catBreak[c] = (catBreak[c] || 0) + 1; });
  const catEntries = Object.entries(catBreak).sort((a, b) => b[1] - a[1]);

  const userPresence = [...users].map(u => {
    const lastSeenAt = String(u?.lastSeenAt || u?.lastLoginAt || "");
    const lastSeenTs = Date.parse(lastSeenAt);
    const online = Number.isFinite(lastSeenTs) ? (Date.now() - lastSeenTs <= ONLINE_WINDOW_MS) : false;
    return { ...u, online, lastSeenAt };
  }).sort((a, b) => Number(b.online) - Number(a.online) || String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));

  const userRoleOptions = [...new Set(userPresence.map(u => String(u.role || "")).filter(Boolean))];
  const userTeamOptions = [...new Set(userPresence.map(u => String(u.teamName || "")).filter(Boolean))];

  const filteredUsersGlobal = userPresence.filter(u => {
    const q = String(globalUserSearch || "").trim().toLowerCase();
    const matchesText = !q || String(u.name || "").toLowerCase().includes(q) || String(u.email || "").toLowerCase().includes(q);
    const matchesRole = globalUserRoleFilter === "all" || String(u.role || "") === globalUserRoleFilter;
    const matchesStatus = globalUserStatusFilter === "all"
      || (globalUserStatusFilter === "online" && u.online)
      || (globalUserStatusFilter === "offline" && !u.online);
    const matchesTeam = globalUserTeamFilter === "all" || String(u.teamName || "") === globalUserTeamFilter;
    return matchesText && matchesRole && matchesStatus && matchesTeam;
  });

  useEffect(() => {
    let active = true;
    if (!token || !canReadAudit) {
      setAuditRecent([]);
      setAuditTotal(0);
      setAuditError("");
      return undefined;
    }

    fetchAuditLogs(token, { limit: 8 })
      .then((payload) => {
        if (!active) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setAuditRecent(items);
        setAuditTotal(Number(payload?.totalMatched || items.length));
        setAuditError("");
      })
      .catch((err) => {
        if (!active) return;
        setAuditRecent([]);
        setAuditTotal(0);
        setAuditError(String(err?.message || "Falha ao carregar auditoria"));
      });

    return () => { active = false; };
  }, [token, canReadAudit]);

  const auditSummaryText = useMemo(() => {
    if (!canReadAudit) return "Sem permissão para leitura de auditoria";
    if (auditError) return auditError;
    return `${auditTotal} registros totais`;
  }, [auditError, auditTotal, canReadAudit]);

  return (
    <div className="gestor-page">

      <PageHeader
        eyebrow="Painel de Gestão"
        title="Indicadores à Vista"
        subtitle="Visão executiva da UBS, atualizada em tempo real com os dados da equipe."
        actions={
          <div className="actions">
            {[["month", "Mês"], ["quarter", "Trimestre"], ["year", "Ano"]].map(([k, l]) => (
              <Button key={k} size="sm" variant={period === k ? "primary" : "ghost"} onClick={() => setPeriod(k)}
                className={`btn btn--sm${period === k ? " btn--primary" : " btn--ghost"}`}>
                {l}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => window.print()} className="btn btn--ghost btn--sm">Exportar</Button>
          </div>
        }
      />

      {/* Logins cadastrados */}
      <div className="card card--noPad">
        <div className="card__header">
          <span className="card__title">Logins cadastrados (todas as funções)</span>
          <span className="muted small">
            {filteredUsersGlobal.filter(u => u.online).length} online · {filteredUsersGlobal.length} visíveis
          </span>
        </div>
        <div className="card__body">
          <div className="gestor-filter-row">
            <Input
              value={globalUserSearch}
              onChange={e => setGlobalUserSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
            />
            <Select value={globalUserRoleFilter} onChange={e => setGlobalUserRoleFilter(e.target.value)}>
                <option value="all">Todas as funções</option>
                {userRoleOptions.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </Select>
            <Select value={globalUserStatusFilter} onChange={e => setGlobalUserStatusFilter(e.target.value)}>
                <option value="all">Todos status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
            </Select>
            <Select value={globalUserTeamFilter} onChange={e => setGlobalUserTeamFilter(e.target.value)}>
                <option value="all">Todas equipes</option>
                {userTeamOptions.map(team => <option key={team} value={team}>{team}</option>)}
            </Select>
          </div>
        </div>
        <div className="gestor-user-list">
          {!filteredUsersGlobal.length ? (
            <p className="muted small">Nenhum login cadastrado.</p>
          ) : (
            filteredUsersGlobal.map(u => (
              <div key={u.id} className="gestor-user-row">
                <div>
                  <div className="gestor-user-row__name">{u.name}</div>
                  <div className="gestor-user-row__meta">{u.email} · {roleLabel(u.role)} · {u.teamName || "Sem equipe"}</div>
                </div>
                <span className={`badge ${u.online ? "badge--success" : ""}`}>
                  <span className="dot" />
                  {u.online ? "Online" : "Offline"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* KPI executivo */}
      <div className="gestor-kpi-grid">
        <div className="kpi card">
          <span className="kpi__label">Pacientes cadastrados</span>
          <strong className="kpi__value">{totalPacientes}</strong>
          <span className="kpi__helper">Com ACS: {comAcs} · Sem ACS: {semAcs}</span>
        </div>
        <div className={`kpi card${criticos > 0 ? " kpi--danger" : " kpi--success"}`}>
          <span className="kpi__label">Protocolos críticos</span>
          <strong className="kpi__value">{criticos}</strong>
          <span className="kpi__helper">Atenção: {atencao} · Em dia: {emDia}</span>
        </div>
        <div className={`kpi card${cobertura >= 80 ? " kpi--success" : cobertura >= 50 ? " kpi--warning" : " kpi--danger"}`}>
          <span className="kpi__label">Cobertura protocolar</span>
          <strong className="kpi__value">{cobertura}%</strong>
          <span className="kpi__helper">{emDia} de {totalPacientes} em dia</span>
        </div>
        <div className="kpi card kpi--info">
          <span className="kpi__label">Consultas realizadas</span>
          <strong className="kpi__value">{consultDone}</strong>
          <span className="kpi__helper">Faltas: {consultAbsent} · Taxa: {taxaComp != null ? taxaComp + "%" : "—"}</span>
        </div>
        <div className="kpi card">
          <span className="kpi__label">Encaminhamentos</span>
          <strong className="kpi__value">{refPeriod.length}</strong>
          <span className="kpi__helper">Pendentes: {refPendentes} · Concluídos: {refConcluidos}</span>
        </div>
        <div className={`kpi card${lowStock > 0 ? " kpi--danger" : " kpi--success"}`}>
          <span className="kpi__label">Estoque crítico</span>
          <strong className="kpi__value">{lowStock}</strong>
          <span className="kpi__helper">{estoqueCrit} item(s) zerado(s)</span>
        </div>
      </div>

      {/* Desempenho Protocolar */}
      <div className="card card--noPad">
        <div className="card__header"><span className="card__title">Desempenho Protocolar</span></div>
        <div className="card__body gestor-gauge-row">
          <GaugePie value={emDia} max={totalPacientes} color={C_SUCCESS} label="Em dia" />
          <GaugePie value={atencao} max={totalPacientes} color={C_WARNING} label="Atenção" />
          <GaugePie value={criticos} max={totalPacientes} color={C_DANGER} label="Crítico" />
          {taxaComp != null && <GaugePie value={consultDone} max={consultTotal} color={C_INFO} label="Comparecimento" />}
          <div className="gestor-bar-list">
            {[
              { label: "Gestantes",              count: gestantes, color: C_DANGER  },
              { label: "Crianças (puericultura)", count: criancas,  color: C_ACCENT  },
              { label: "Crônicos",               count: cronicos,  color: C_WARNING },
              { label: "Idosos",                 count: idosos,    color: C_MUTED   },
            ].map(({ label, count, color }) => (
              <div key={label} className="gestor-bar-item">
                <div className="gestor-bar-item__header">
                  <span className="gestor-bar-item__label">{label}</span>
                  <span style={{ font: "700 var(--t-xs) var(--font-mono)", color }}>{count}</span>
                </div>
                <Bar value={count} max={totalPacientes} color={color} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Equipe e ACS */}
      <div className="gestor-two-col">
        <div className="card card--noPad">
          <div className="card__header">
            <span className="card__title">Composição da equipe</span>
            <span className="muted small">{users.length} membros</span>
          </div>
          <div className="card__body">
            {[
              { label: "ACS",                   count: acsCount,  color: C_WARNING },
              { label: "Médicos / Enfermeiros",  count: docCount,  color: C_INFO    },
              { label: "Dentistas",              count: dentCount, color: C_MUTED   },
              { label: "Técnicos",               count: techCount, color: C_ACCENT  },
            ].map(({ label, count, color }) => (
              <div key={label} className="gestor-team-row">
                <div className="gestor-team-row__info">
                  <div className="gestor-team-row__header">
                    <span className="gestor-team-row__label">{label}</span>
                    <span style={{ font: "700 var(--t-sm) var(--font-mono)", color }}>{count}</span>
                  </div>
                  <Bar value={count} max={users.length} color={color} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card--noPad">
          <div className="card__header"><span className="card__title">Performance por ACS</span></div>
          <div className="card__body">
            {!acsPerf.length ? (
              <p className="muted small">Nenhum ACS cadastrado.</p>
            ) : (
              <div className="gestor-audit-list">
                {acsPerf.map(a => (
                  <div key={a.name} className="gestor-acs-row">
                    <div className="gestor-acs-row__header">
                      <span className="gestor-acs-row__name">{a.name}</span>
                      <div className="gestor-acs-row__badges">
                        <span className={`badge ${a.criticos > 0 ? "badge--danger" : "badge--success"}`}>
                          {a.criticos} crítico{a.criticos !== 1 ? "s" : ""}
                        </span>
                        <span className="badge">{a.total} pac.</span>
                      </div>
                    </div>
                    <div className="gestor-acs-row__bar-row">
                      <Bar value={a.emDia} max={a.total} color={C_SUCCESS} />
                      <span className="gestor-acs-row__pct">
                        {a.total > 0 ? Math.round(a.emDia / a.total * 100) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Produção */}
      <div className="gestor-section">
        <h3 className="gestor-section__title">Produção — {periodLabel}</h3>
        <div className="gestor-section__line" />
      </div>
      <div className="gestor-kpi-grid">
        <div className="kpi card kpi--info">
          <span className="kpi__label">Consultas agendadas</span>
          <strong className="kpi__value">{consultTotal}</strong>
        </div>
        <div className="kpi card kpi--success">
          <span className="kpi__label">Consultas realizadas</span>
          <strong className="kpi__value">{consultDone}</strong>
        </div>
        <div className={`kpi card${consultAbsent > 0 ? " kpi--warning" : ""}`}>
          <span className="kpi__label">Faltas / ausências</span>
          <strong className="kpi__value">{consultAbsent}</strong>
        </div>
        <div className={`kpi card${taxaComp != null ? (taxaComp >= 80 ? " kpi--success" : taxaComp >= 60 ? " kpi--warning" : " kpi--danger") : ""}`}>
          <span className="kpi__label">Taxa de comparecimento</span>
          <strong className="kpi__value">{taxaComp != null ? taxaComp + "%" : "—"}</strong>
        </div>
        <div className="kpi card">
          <span className="kpi__label">Encaminhamentos emitidos</span>
          <strong className="kpi__value">{refPeriod.length}</strong>
        </div>
        <div className="kpi card">
          <span className="kpi__label">Dispensações farmácia</span>
          <strong className="kpi__value">{dispensas}</strong>
        </div>
      </div>

      {/* Farmácia + Encaminhamentos */}
      <div className="gestor-two-col">
        <div className="card card--noPad">
          <div className="card__header"><span className="card__title">Estoque — Situação Atual</span></div>
          <div className="card__body">
            {!pharmacyStock?.length ? (
              <p className="muted small">Sem itens cadastrados.</p>
            ) : (
              <>
                <div className="gestor-stock-mini">
                  {[
                    { label: "Total de itens", v: pharmacyStock.length,  color: C_ACCENT  },
                    { label: "Estoque baixo",  v: lowStock,      color: C_WARNING },
                    { label: "Zerados",        v: estoqueCrit,   color: C_DANGER  },
                  ].map(({ label, v, color }) => (
                    <div key={label} className="gestor-stock-mini-item">
                      <div className="gestor-stock-mini-item__value" style={{ color }}>{v}</div>
                      <div className="gestor-stock-mini-item__label">{label}</div>
                    </div>
                  ))}
                </div>
                {pharmacyStock.filter(s => Number(s.qty || 0) <= Number(s.minQty || 0)).slice(0, 5).map(s => {
                  const isZero = Number(s.qty || 0) === 0;
                  return (
                    <div key={s.id || s.name} className="gestor-stock-row">
                      <span className="gestor-stock-row__name">{s.name}</span>
                      <span className={`gestor-stock-row__qty gestor-stock-row__qty--${isZero ? "zero" : "low"}`}>
                        {s.qty || 0} un.
                      </span>
                    </div>
                  );
                })}
                {lowStock > 5 && (
                  <p className="muted small" style={{ marginTop: "var(--s-2)" }}>
                    +{lowStock - 5} itens abaixo do mínimo
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card card--noPad">
          <div className="card__header">
            <span className="card__title">Encaminhamentos por Especialidade</span>
            <span className="muted small">{refPeriod.length} total</span>
          </div>
          <div className="card__body">
            {!refPeriod.length ? (
              <p className="muted small">Nenhum encaminhamento no período.</p>
            ) : (() => {
              const specMap = {};
              refPeriod.forEach(r => { specMap[r.specialty || "Outros"] = (specMap[r.specialty || "Outros"] || 0) + 1; });
              return Object.entries(specMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, c]) => (
                <div key={s} className="gestor-spec-row">
                  <span className="gestor-spec-row__label">{s}</span>
                  <Bar value={c} max={refPeriod.length} color={C_MUTED} />
                  <span className="gestor-spec-row__count">{c}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Distribuição de Pacientes */}
      <div className="card card--noPad">
        <div className="card__header"><span className="card__title">Distribuição de Pacientes por Categoria</span></div>
        <div className="card__body">
          <div className="gestor-cat-grid">
            {catEntries.map(([cat, count]) => {
              const label = templates.find(t => t.category === cat)?.label || cat;
              const pct = totalPacientes > 0 ? Math.round(count / totalPacientes * 100) : 0;
              const catCrit = patients.filter(p => p.careCategory === cat && protocolChip(protocolByPatient[p.id]).tone === "danger").length;
              return (
                <div key={cat} className="gestor-cat-item">
                  <div className="gestor-cat-item__header">
                    <span className="gestor-cat-item__label">{label}</span>
                    <span className="gestor-cat-item__count">{count}</span>
                  </div>
                  <Bar value={count} max={totalPacientes} color={C_ACCENT} />
                  <div className="gestor-cat-item__footer">
                    <span>{pct}% do total</span>
                    {catCrit > 0 && <span className="gestor-cat-item__crit">{catCrit} crítico{catCrit !== 1 ? "s" : ""}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Trilha de Auditoria */}
      <div className="card card--noPad">
        <div className="card__header">
          <span className="card__title">Trilha de Auditoria — Ações Recentes</span>
          <span className="muted small">{auditSummaryText}</span>
        </div>
        <div className="card__body">
          {!canReadAudit ? (
            <p className="muted small">Perfil atual não pode consultar trilha de auditoria.</p>
          ) : auditError ? (
            <p className="muted small">{auditError}</p>
          ) : !auditRecent.length ? (
            <p className="muted small">Nenhuma ação registrada ainda.</p>
          ) : (
            <div className="gestor-audit-list">
              {auditRecent.map((a, i) => (
                <div key={i} className="gestor-audit-row">
                  <span className="gestor-audit-row__dot" />
                  <div className="gestor-audit-row__body">
                    <span className="gestor-audit-row__action">{a.action || "Ação"}</span>
                    {(a.actor || a.user) && (
                      <span className="muted"> por {(a.actor?.name || a.user?.name || a.user?.email || "usuário")}</span>
                    )}
                  </div>
                  <span className="gestor-audit-row__ts">
                    {a.createdAt || a.ts
                      ? new Date(a.createdAt || a.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default GestorPage;
