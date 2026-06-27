import { useState, useMemo } from "react";

import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import { Tabs, Tab } from "../components/ui/Tabs";
import { ageInMonths, protocolChip } from "../utils/clinical";
import { roleLabel } from "../utils/roles";
import EsusMirror from "./EsusMirror";

// ── helpers ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, tone = "" }) {
  return (
    <div className={["kpi card card--compact", tone && `kpi--${tone}`].filter(Boolean).join(" ")}>
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value ?? "—"}</strong>
      {sub ? <span className="kpi__helper">{sub}</span> : null}
    </div>
  );
}

function SectionLabel({ children }) {
  return <p className="reports-section-label">{children}</p>;
}

function StatList({ rows }) {
  return (
    <div className="card card--noPad card--operational">
      <div className="card__body">
        {rows.map(([label, value, accent]) => (
          <div key={label} className="stat-row">
            <span className="stat-row__label">{label}</span>
            <strong className={`stat-row__value${accent ? " stat-row__value--accent" : ""}`}>{value ?? "—"}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarRow({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="reports-bar-row">
      <div className="reports-bar-row__header">
        <strong>{label}</strong>
        <span>{count} ({pct}%)</span>
      </div>
      <div className="dashboard__meter">
        <span className="dashboard__meter-fill dashboard__meter-fill--neutral" style={{ "--dashboard-meter": `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyState({ text = "Nenhum dado disponível para o período." }) {
  return <p className="muted small" style={{ padding: "var(--s-4) 0" }}>{text}</p>;
}

// ── main ─────────────────────────────────────────────────────────────────────

function ReportsPage({
  patients = [],
  users = [],
  templates = [],
  protocolByPatient = {},
  agenda = [],
  referrals = [],
  pharmacyStock = [],
  pharmacyLog = [],
  suppliesStock = [],
  suppliesLog = [],
}) {
  const [period, setPeriod] = useState("month");
  const [tab, setTab]       = useState("overview");

  const now = new Date();

  function inPeriod(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (period === "month")   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === "quarter") { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear(); }
    return d.getFullYear() === now.getFullYear();
  }

  const periodLabel = { month: "Mês atual", quarter: "Trimestre atual", year: "Ano atual" }[period];

  // ── patient metrics ──────────────────────────────────────────────────────
  const totalPatients = patients.length;
  const patientsActive   = patients.filter(p => !p.inactive).length;
  const patientsInactive = patients.filter(p => p.inactive).length;
  const semAcs   = patients.filter(p => !p.assignedAcsId).length;
  const gestantes = patients.filter(p => String(p.careCategory || "").toLowerCase() === "pregnant").length;
  const criancas  = patients.filter(p => { const am = ageInMonths(p.birthDate); return am !== null && am < 120; }).length;
  const idosos    = patients.filter(p => { const am = ageInMonths(p.birthDate); return am !== null && am >= 720; }).length;
  const cronicos  = patients.filter(p => Array.isArray(p.chronicConditions) && p.chronicConditions.length > 0).length;

  const semCpf    = patients.filter(p => !p.cpf && !p.document).length;
  const semCns    = patients.filter(p => !p.cns).length;
  const semEnder  = patients.filter(p => !p.address && !p.street).length;
  const semNasc   = patients.filter(p => !p.birthDate).length;

  const catBreak = useMemo(() => {
    const m = {};
    patients.forEach(p => { const c = p.careCategory || "general"; m[c] = (m[c] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [patients]);

  const ageBreak = useMemo(() => {
    const b = { "< 5 anos": 0, "5-17 anos": 0, "18-59 anos": 0, "60+ anos": 0 };
    patients.forEach(p => {
      const am = ageInMonths(p.birthDate);
      if (am === null) return;
      if (am < 60) b["< 5 anos"]++;
      else if (am < 216) b["5-17 anos"]++;
      else if (am < 720) b["18-59 anos"]++;
      else b["60+ anos"]++;
    });
    return Object.entries(b);
  }, [patients]);

  // ── production metrics ───────────────────────────────────────────────────
  const agendaPeriod  = agenda.filter(a => inPeriod(a.date));
  const consultDone   = agendaPeriod.filter(a => a.status === "done").length;
  const consultAbsent = agendaPeriod.filter(a => a.status === "absent").length;
  const consultTotal  = agendaPeriod.length;
  const taxaComp      = consultTotal > 0 ? Math.round(consultDone / consultTotal * 100) : null;

  const byProf = useMemo(() => {
    const m = {};
    agendaPeriod.filter(a => a.status === "done").forEach(a => {
      const id = a.professionalId || a.userId || "";
      if (!id) return;
      if (!m[id]) {
        const u = users.find(u => u.id === id);
        m[id] = { name: u?.name || id, count: 0 };
      }
      m[id].count++;
    });
    return Object.values(m).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [agendaPeriod, users]);

  // ── referrals ────────────────────────────────────────────────────────────
  const refPeriod     = referrals.filter(r => inPeriod(r.createdAt));
  const refPendentes  = refPeriod.filter(r => r.status === "pending").length;
  const refConcluidos = refPeriod.filter(r => r.status === "done").length;
  const specBreak     = useMemo(() => {
    const m = {};
    refPeriod.forEach(r => { m[r.specialty] = (m[r.specialty] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [refPeriod]);

  // ── protocols ────────────────────────────────────────────────────────────
  const protCritical = patients.filter(p => protocolChip(protocolByPatient[p.id]).tone === "danger").length;
  const protAtencao  = patients.filter(p => protocolChip(protocolByPatient[p.id]).tone === "warn").length;
  const protOk       = patients.filter(p => protocolChip(protocolByPatient[p.id]).tone === "ok").length;
  const cobertProt   = totalPatients > 0 ? Math.round(protOk / totalPatients * 100) : 0;

  // ── equipe ───────────────────────────────────────────────────────────────
  const acsCount    = users.filter(u => u.role === "acs").length;
  const docCount    = users.filter(u => ["doctor", "nurse_manager"].includes(u.role)).length;
  const dentCount   = users.filter(u => u.role === "dentist").length;
  const techCount   = users.filter(u => ["nursing_tech", "pharmacy_tech"].includes(u.role)).length;
  const usersActive = users.filter(u => !u.inactive).length;
  const usersInact  = users.filter(u => u.inactive).length;

  const byTeam = useMemo(() => {
    const m = {};
    users.filter(u => !u.inactive).forEach(u => {
      const t = u.teamName || "Sem equipe";
      m[t] = (m[t] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [users]);

  // ── acs metrics ──────────────────────────────────────────────────────────
  const acsList = users.filter(u => u.role === "acs");
  const semMicroarea = patients.filter(p => !p.microarea && !p.areaCode).length;

  // ── pharmacy ─────────────────────────────────────────────────────────────
  const dispensasPeriod  = pharmacyLog.filter(l => l.type === "dispensa" && inPeriod(l.ts));
  const entradasPeriod   = pharmacyLog.filter(l => l.type === "entrada" && inPeriod(l.ts));
  const lowStock         = (pharmacyStock || []).filter(s => Number(s.qty || 0) <= Number(s.minQty || 0)).length;
  const zeroStock        = (pharmacyStock || []).filter(s => Number(s.qty || 0) === 0).length;

  const topMeds = useMemo(() => {
    const m = {};
    dispensasPeriod.forEach(d => { m[d.itemName] = (m[d.itemName] || 0) + Number(d.qty || 1); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [dispensasPeriod]);

  // ── insumos ──────────────────────────────────────────────────────────────
  const suppliesDispPeriod  = (suppliesLog || []).filter(l => l.type === "dispensa" && inPeriod(l.ts));
  const suppliesEntPeriod   = (suppliesLog || []).filter(l => l.type === "entrada" && inPeriod(l.ts));
  const suppliesLow         = (suppliesStock || []).filter(s => Number(s.qty || 0) <= Number(s.maxQty || 0) * 0.2 && Number(s.maxQty || 0) > 0).length;

  const TABS = [
    ["overview",      "Visão Geral"],
    ["patients",      "Pacientes"],
    ["production",    "Produção"],
    ["equipe",        "Equipe"],
    ["acs",           "ACS e Território"],
    ["protocols",     "Protocolos"],
    ["referrals",     "Encaminhamentos"],
    ["pharmacy",      "Farmácia"],
    ["insumos",       "Insumos"],
    ["esus",          "e-SUS / RNDS"],
    ["auditoria",     "Auditoria"],
  ];

  return (
    <div className="reports-page">
      <PageHeader
        eyebrow="RELATÓRIOS"
        title="Central de Relatórios"
        subtitle="Inteligência executiva e operacional para gestão da UBS."
        variant="workspace"
        actions={(
          <div className="reports-hero-actions">
            <div className="btn-group">
              {[["month", "Mês"], ["quarter", "Trimestre"], ["year", "Ano"]].map(([k, l]) => (
                <Button key={k} variant="ghost" size="sm" className={period === k ? "is-active" : ""} onClick={() => setPeriod(k)}>{l}</Button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>Imprimir</Button>
          </div>
        )}
      />

      <Tabs>
        {TABS.map(([id, label]) => (
          <Tab key={id} active={tab === id} onClick={() => setTab(id)}>{label}</Tab>
        ))}
      </Tabs>

      <div className="reports-content">

        {/* ── VISÃO GERAL ─────────────────────────────────────────────── */}
        {tab === "overview" && (
          <>
            <SectionLabel>Período: {periodLabel}</SectionLabel>
            <div className="reports-stats">
              <StatBox label="Pacientes cadastrados" value={totalPatients} sub={`Ativos: ${patientsActive} · Inativos: ${patientsInactive}`} />
              <StatBox label="Protocolos críticos"   value={protCritical}  tone="danger"  sub={`Atenção: ${protAtencao} · Em dia: ${protOk}`} />
              <StatBox label="Consultas realizadas"  value={consultDone}   tone="success" sub={`Faltas: ${consultAbsent}${taxaComp != null ? ` · Taxa: ${taxaComp}%` : ""}`} />
              <StatBox label="Encaminhamentos"       value={refPeriod.length} tone="info"  sub={`Pendentes: ${refPendentes} · Concluídos: ${refConcluidos}`} />
              <StatBox label="Dispensações"          value={dispensasPeriod.length} tone="warning" sub="Medicamentos entregues" />
              <StatBox label="Estoque crítico"       value={lowStock}       tone={lowStock > 0 ? "danger" : "success"} sub={`${zeroStock} item(s) zerado(s)`} />
            </div>
            <div className="dashboard__grid">
              <StatList rows={[
                ["ACS", acsCount],
                ["Médicos / Enfermeiros", docCount],
                ["Profissionais ativos", usersActive],
                ["Total equipe", users.length],
              ]} />
              {specBreak.length > 0 && (
                <div className="card card--noPad card--operational">
                  <div className="card__header"><span className="card__title">Top especialidades encaminhadas</span></div>
                  <div className="card__body">
                    {specBreak.map(([s, c]) => (
                      <div key={s} className="stat-row">
                        <span className="stat-row__label">{s || "Não informada"}</span>
                        <strong className="stat-row__value stat-row__value--accent">{c}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── PACIENTES ──────────────────────────────────────────────────── */}
        {tab === "patients" && (
          <>
            <SectionLabel>Cadastros e perfil dos pacientes</SectionLabel>
            <div className="reports-stats">
              <StatBox label="Total cadastrados"   value={totalPatients} />
              <StatBox label="Ativos"              value={patientsActive} tone="success" />
              <StatBox label="Sem ACS vinculado"   value={semAcs}   tone={semAcs > 0 ? "warning" : "success"} sub={`${totalPatients > 0 ? Math.round(semAcs/totalPatients*100) : 0}% do total`} />
              <StatBox label="Gestantes"           value={gestantes} tone="info" />
              <StatBox label="Crianças (< 10 anos)" value={criancas}  tone="info" />
              <StatBox label="Idosos (60+)"         value={idosos}   tone="info" />
              <StatBox label="Crônicos"             value={cronicos}  tone="warning" sub="Com condições crônicas" />
            </div>

            <SectionLabel>Distribuição por faixa etária</SectionLabel>
            <div className="card card--noPad card--operational">
              <div className="card__body">
                {ageBreak.map(([label, count]) => (
                  <BarRow key={label} label={label} count={count} total={totalPatients} />
                ))}
              </div>
            </div>

            <SectionLabel>Distribuição por categoria de cuidado</SectionLabel>
            <div className="card card--noPad card--operational">
              <div className="card__body">
                {catBreak.length === 0 ? <EmptyState /> : catBreak.map(([cat, count]) => (
                  <BarRow key={cat} label={templates.find(t => t.category === cat)?.label || cat} count={count} total={totalPatients} />
                ))}
              </div>
            </div>

            <SectionLabel>Completude dos cadastros</SectionLabel>
            <div className="reports-stats">
              <StatBox label="Sem CPF/Documento" value={semCpf}   tone={semCpf > 0 ? "warning" : "success"} />
              <StatBox label="Sem CNS"           value={semCns}   tone={semCns > 0 ? "warning" : "success"} />
              <StatBox label="Sem endereço"      value={semEnder} tone={semEnder > 0 ? "warning" : "success"} />
              <StatBox label="Sem data nasc."    value={semNasc}  tone={semNasc > 0 ? "warning" : "success"} />
            </div>
          </>
        )}

        {/* ── PRODUÇÃO ────────────────────────────────────────────────────── */}
        {tab === "production" && (
          <>
            <SectionLabel>Produção · {periodLabel}</SectionLabel>
            <div className="reports-stats">
              <StatBox label="Consultas agendadas"   value={consultTotal} />
              <StatBox label="Consultas realizadas"  value={consultDone}   tone="success" />
              <StatBox label="Faltas"                value={consultAbsent} tone="warning" />
              <StatBox label="Taxa de comparecimento" value={taxaComp != null ? `${taxaComp}%` : "—"} tone="info" />
              <StatBox label="Encaminhamentos"       value={refPeriod.length} />
              <StatBox label="Encam. concluídos"     value={refConcluidos} tone="success" />
            </div>

            {byProf.length > 0 && (
              <>
                <SectionLabel>Produção por profissional (consultas realizadas)</SectionLabel>
                <div className="card card--noPad card--operational">
                  <div className="card__body">
                    {byProf.map(({ name, count }) => (
                      <div key={name} className="stat-row">
                        <span className="stat-row__label">{name}</span>
                        <strong className="stat-row__value stat-row__value--accent">{count}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {byProf.length === 0 && <EmptyState text="Nenhuma consulta registrada no período." />}
          </>
        )}

        {/* ── EQUIPE ──────────────────────────────────────────────────────── */}
        {tab === "equipe" && (
          <>
            <SectionLabel>Composição e atividade da equipe</SectionLabel>
            <div className="reports-stats">
              <StatBox label="Profissionais ativos"   value={usersActive}   tone="success" />
              <StatBox label="Profissionais inativos" value={usersInact}    tone={usersInact > 0 ? "warning" : "success"} />
              <StatBox label="ACS"                    value={acsCount} />
              <StatBox label="Médicos / Enfermeiros"  value={docCount} />
              <StatBox label="Dentistas"              value={dentCount} />
              <StatBox label="Técnicos"               value={techCount} />
            </div>

            <SectionLabel>Distribuição por cargo</SectionLabel>
            <div className="card card--noPad card--operational">
              <div className="card__body">
                {Object.entries(
                  users.filter(u => !u.inactive).reduce((m, u) => {
                    const l = roleLabel(u.role);
                    m[l] = (m[l] || 0) + 1;
                    return m;
                  }, {})
                ).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                  <BarRow key={role} label={role} count={count} total={usersActive} />
                ))}
              </div>
            </div>

            {byTeam.length > 0 && (
              <>
                <SectionLabel>Distribuição por equipe</SectionLabel>
                <StatList rows={byTeam.map(([t, c]) => [t, c])} />
              </>
            )}
          </>
        )}

        {/* ── ACS E TERRITÓRIO ────────────────────────────────────────────── */}
        {tab === "acs" && (
          <>
            <SectionLabel>Cobertura territorial dos ACS</SectionLabel>
            <div className="reports-stats">
              <StatBox label="ACS na unidade"        value={acsCount} />
              <StatBox label="Pacientes com ACS"     value={totalPatients - semAcs} tone="success" />
              <StatBox label="Pacientes sem ACS"     value={semAcs} tone={semAcs > 0 ? "warning" : "success"} />
              <StatBox label="Cobertura ACS"         value={totalPatients > 0 ? `${Math.round((totalPatients - semAcs) / totalPatients * 100)}%` : "—"} tone="info" />
              <StatBox label="Sem microárea"         value={semMicroarea} tone={semMicroarea > 0 ? "warning" : "success"} sub="Pacientes sem microárea definida" />
            </div>

            <SectionLabel>Distribuição de pacientes por ACS</SectionLabel>
            {acsList.length === 0 ? <EmptyState text="Nenhum ACS cadastrado." /> : (
              <div className="card card--noPad card--operational">
                <div className="card__body">
                  {acsList.map(a => {
                    const count = patients.filter(p => p.assignedAcsId === a.id).length;
                    return (
                      <BarRow key={a.id} label={a.name} count={count} total={totalPatients} />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── PROTOCOLOS ──────────────────────────────────────────────────── */}
        {tab === "protocols" && (
          <>
            <SectionLabel>Situação protocolar dos pacientes</SectionLabel>
            <div className="reports-stats">
              <StatBox label="Cobertura protocolar"  value={`${cobertProt}%`} tone={cobertProt >= 80 ? "success" : cobertProt >= 50 ? "warning" : "danger"} sub={`${protOk} de ${totalPatients} em dia`} />
              <StatBox label="Em dia"                value={protOk}       tone="success" />
              <StatBox label="Em atenção"            value={protAtencao}  tone="warning" />
              <StatBox label="Críticos"              value={protCritical} tone="danger"  sub="Precisam de atenção imediata" />
            </div>

            <SectionLabel>Situação por categoria de cuidado</SectionLabel>
            <div className="card card--noPad card--operational">
              <div className="card__body">
                {catBreak.map(([cat]) => {
                  const catPatients = patients.filter(p => (p.careCategory || "general") === cat);
                  const catCrit = catPatients.filter(p => protocolChip(protocolByPatient[p.id]).tone === "danger").length;
                  const catOk   = catPatients.filter(p => protocolChip(protocolByPatient[p.id]).tone === "ok").length;
                  const label   = templates.find(t => t.category === cat)?.label || cat;
                  return (
                    <div key={cat} className="stat-row">
                      <span className="stat-row__label">{label} ({catPatients.length})</span>
                      <span>
                        <span style={{ color: "var(--success)", marginRight: "var(--s-2)" }}>✓ {catOk}</span>
                        <span style={{ color: "var(--danger)" }}>! {catCrit}</span>
                      </span>
                    </div>
                  );
                })}
                {catBreak.length === 0 && <EmptyState />}
              </div>
            </div>
          </>
        )}

        {/* ── ENCAMINHAMENTOS ─────────────────────────────────────────────── */}
        {tab === "referrals" && (
          <>
            <SectionLabel>Encaminhamentos · {periodLabel}</SectionLabel>
            <div className="reports-stats">
              <StatBox label="Total emitidos"      value={refPeriod.length} />
              <StatBox label="Pendentes"           value={refPendentes}  tone="warning" />
              <StatBox label="Concluídos"          value={refConcluidos} tone="success" />
              <StatBox label="Taxa de conclusão"   value={refPeriod.length > 0 ? `${Math.round(refConcluidos/refPeriod.length*100)}%` : "—"} tone="info" />
            </div>

            {specBreak.length > 0 && (
              <>
                <SectionLabel>Por especialidade</SectionLabel>
                <div className="card card--noPad card--operational">
                  <div className="card__body">
                    {specBreak.map(([s, c]) => (
                      <BarRow key={s} label={s || "Não informada"} count={c} total={refPeriod.length} />
                    ))}
                  </div>
                </div>
              </>
            )}
            {refPeriod.length === 0 && <EmptyState text="Nenhum encaminhamento no período." />}
          </>
        )}

        {/* ── FARMÁCIA ────────────────────────────────────────────────────── */}
        {tab === "pharmacy" && (
          <>
            <SectionLabel>Farmácia · {periodLabel}</SectionLabel>
            <div className="reports-stats">
              <StatBox label="Dispensações"        value={dispensasPeriod.length}  tone="info" />
              <StatBox label="Entradas de estoque" value={entradasPeriod.length} />
              <StatBox label="Itens em estoque"    value={(pharmacyStock || []).length} />
              <StatBox label="Estoque zerado"      value={zeroStock}  tone="danger" />
              <StatBox label="Estoque baixo"       value={lowStock}   tone={lowStock > 0 ? "warning" : "success"} sub="Abaixo do mínimo" />
            </div>

            {topMeds.length > 0 && (
              <>
                <SectionLabel>Medicamentos mais dispensados</SectionLabel>
                <div className="card card--noPad card--operational">
                  <div className="card__body">
                    {topMeds.map(([name, qty]) => (
                      <div key={name} className="stat-row">
                        <span className="stat-row__label">{name}</span>
                        <strong className="stat-row__value stat-row__value--accent">{qty}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <SectionLabel>Itens com estoque crítico</SectionLabel>
            {zeroStock === 0 && lowStock === 0 ? (
              <p className="muted small" style={{ color: "var(--success)" }}>✓ Todos os itens com estoque adequado.</p>
            ) : (
              <div className="card card--noPad card--operational">
                <div className="card__body">
                  {(pharmacyStock || []).filter(s => Number(s.qty || 0) <= Number(s.minQty || 0)).map(s => (
                    <div key={s.id} className="stat-row">
                      <span className="stat-row__label">{s.name}</span>
                      <strong className="stat-row__value" style={{ color: Number(s.qty || 0) === 0 ? "var(--danger)" : "var(--warning)" }}>
                        {Number(s.qty || 0) === 0 ? "Zerado" : `${s.qty} un`}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── INSUMOS ─────────────────────────────────────────────────────── */}
        {tab === "insumos" && (
          <>
            <SectionLabel>Insumos · {periodLabel}</SectionLabel>
            <div className="reports-stats">
              <StatBox label="Dispensações"      value={suppliesDispPeriod.length} tone="info" />
              <StatBox label="Entradas"          value={suppliesEntPeriod.length} />
              <StatBox label="Itens cadastrados" value={(suppliesStock || []).length} />
              <StatBox label="Estoque crítico"   value={suppliesLow} tone={suppliesLow > 0 ? "warning" : "success"} sub="Abaixo de 20% do máximo" />
            </div>

            {(suppliesStock || []).length > 0 && (
              <>
                <SectionLabel>Situação do estoque de insumos</SectionLabel>
                <div className="card card--noPad card--operational">
                  <div className="card__body">
                    {(suppliesStock || []).map(s => (
                      <div key={s.id} className="stat-row">
                        <span className="stat-row__label">{s.name} <span className="muted">({s.category})</span></span>
                        <strong className="stat-row__value" style={{
                          color: Number(s.qty || 0) === 0 ? "var(--danger)"
                            : Number(s.maxQty || 0) > 0 && Number(s.qty || 0) <= Number(s.maxQty || 0) * 0.2 ? "var(--warning)"
                            : "var(--success)"
                        }}>
                          {s.qty ?? 0} {s.unit}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {(suppliesStock || []).length === 0 && <EmptyState text="Nenhum insumo cadastrado." />}
          </>
        )}

        {/* ── e-SUS / RNDS ─────────────────────────────────────────────────── */}
        {tab === "esus" && (
          <EsusMirror patients={patients} users={users} agenda={agenda} referrals={referrals} pharmacyLog={pharmacyLog} period={period} periodLabel={periodLabel} />
        )}

        {/* ── AUDITORIA ────────────────────────────────────────────────────── */}
        {tab === "auditoria" && (
          <>
            <SectionLabel>Auditoria operacional</SectionLabel>
            <div className="card card--noPad card--operational" style={{ marginBottom: "var(--s-4)" }}>
              <div className="card__body">
                <div className="stat-row">
                  <span className="stat-row__label">Acessos Break Glass registrados</span>
                  <strong className="stat-row__value stat-row__value--accent">ver aba Auditoria</strong>
                </div>
                <div className="stat-row">
                  <span className="stat-row__label">Ações administrativas</span>
                  <strong className="stat-row__value stat-row__value--accent">ver aba Auditoria</strong>
                </div>
                <div className="stat-row">
                  <span className="stat-row__label">Exportações CDS realizadas</span>
                  <strong className="stat-row__value stat-row__value--accent">ver aba Auditoria</strong>
                </div>
              </div>
            </div>
            <div className="esus-notice" style={{ marginTop: 0 }}>
              <strong>Informação:</strong> O histórico completo de auditoria, incluindo acessos Break Glass, alterações administrativas, exportações CDS e eventos críticos, está disponível na página dedicada <strong>Auditoria</strong> no menu lateral, com filtros por período, usuário e tipo de evento.
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default ReportsPage;
