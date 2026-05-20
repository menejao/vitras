import { useState } from "react";

import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import { Tabs, Tab } from "../components/ui/Tabs";
import { ageInMonths, protocolChip } from "../utils/clinical";
import AuditLogPanel from "./AuditLogPanel";
import EsusMirror from "./EsusMirror";

function StatBox({ label, value, sub, tone = "" }) {
  return (
    <div className={["kpi card card--compact", tone && `kpi--${tone}`].filter(Boolean).join(" ")}>
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      {sub ? <span className="kpi__helper">{sub}</span> : null}
    </div>
  );
}

function ReportsPage({ patients, users, templates, protocolByPatient, agenda = [], referrals = [], pharmacyStock = [], pharmacyLog = [] }) {
  const [period, setPeriod] = useState("month");
  const [tab, setTab] = useState("overview");

  const now = new Date();
  function inPeriod(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === "quarter") {
      const q = Math.floor(now.getMonth() / 3);
      return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear();
    }
    return d.getFullYear() === now.getFullYear();
  }

  const totalPatients = patients.length;
  const gestantes = patients.filter((p) => String(p.careCategory || "").toLowerCase() === "pregnant").length;
  const criancas = patients.filter((p) => {
    const am = ageInMonths(p.birthDate);
    return am !== null && am < 120;
  }).length;
  const protCritical = patients.filter((p) => protocolChip(protocolByPatient[p.id]).tone === "danger").length;
  const agendaPeriod = agenda.filter((a) => inPeriod(a.date));
  const consultDone = agendaPeriod.filter((a) => a.status === "done").length;
  const consultAbsent = agendaPeriod.filter((a) => a.status === "absent").length;
  const referralsPeriod = referrals.filter((r) => inPeriod(r.createdAt));
  const dispensasPeriod = pharmacyLog.filter((l) => l.type === "dispensa" && inPeriod(l.ts));
  const lowStock = (pharmacyStock || []).filter((s) => s.qty <= s.minQty).length;
  const acsCount = users.filter((u) => u.role === "acs").length;
  const docCount = users.filter((u) => ["doctor", "nurse_manager"].includes(u.role)).length;

  const catBreak = {};
  patients.forEach((p) => {
    const c = p.careCategory || "general";
    catBreak[c] = (catBreak[c] || 0) + 1;
  });

  const specBreak = {};
  referralsPeriod.forEach((r) => {
    specBreak[r.specialty] = (specBreak[r.specialty] || 0) + 1;
  });
  const topSpecs = Object.entries(specBreak).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const periodLabel = { month: "Mês atual", quarter: "Trimestre atual", year: "Ano atual" }[period];

  return (
    <div className="reports-page">
      <PageHeader
        eyebrow="Vitras"
        title="Relatórios"
        subtitle="Indicadores operacionais e de saúde para leitura executiva, prestação de contas e monitoramento assistencial."
        variant="workspace"
        actions={(
          <div className="reports-hero-actions">
            <div className="btn-group">
              {[["month", "Mês"], ["quarter", "Trimestre"], ["year", "Ano"]].map(([k, l]) => (
                <Button key={k} variant="ghost" size="sm" className={period === k ? "is-active" : ""} onClick={() => setPeriod(k)}>
                  {l}
                </Button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              Exportar
            </Button>
          </div>
        )}
      />

      <Tabs>
        <Tab active={tab === "overview"} onClick={() => setTab("overview")}>Visão Geral</Tab>
        <Tab active={tab === "patients"} onClick={() => setTab("patients")}>Pacientes</Tab>
        <Tab active={tab === "production"} onClick={() => setTab("production")}>Produção</Tab>
        <Tab active={tab === "pharmacy"} onClick={() => setTab("pharmacy")}>Farmácia</Tab>
        <Tab active={tab === "esus"} onClick={() => setTab("esus")}>e-SUS / RNDS</Tab>
        <Tab active={tab === "audit"} onClick={() => setTab("audit")}>Trilha de Auditoria</Tab>
      </Tabs>

      <div className="reports-content">
        {tab === "overview" && (
          <>
            <p className="reports-section-label">Período: {periodLabel}</p>
            <div className="reports-stats">
              <StatBox label="Total de pacientes" value={totalPatients} sub={`Gestantes: ${gestantes} · Crianças: ${criancas}`} />
              <StatBox label="Protocolos críticos" value={protCritical} tone="danger" sub="Precisam de atenção" />
              <StatBox label="Consultas realizadas" value={consultDone} tone="success" sub={`Faltas: ${consultAbsent}`} />
              <StatBox label="Encaminhamentos" value={referralsPeriod.length} tone="info" sub={`Pendentes: ${referralsPeriod.filter((r) => r.status === "pending").length}`} />
              <StatBox label="Dispensações" value={dispensasPeriod.length} tone="warning" sub="Medicamentos entregues" />
              <StatBox label="Estoque crítico" value={lowStock} tone={lowStock > 0 ? "danger" : "success"} sub="Abaixo do mínimo" />
            </div>
            <div className="dashboard__grid">
              <div className="card card--noPad card--operational">
                <div className="card__header"><span className="card__title">Equipe</span></div>
                <div className="card__body">
                  {[["ACS", acsCount], ["Médicos/Enf.", docCount], ["Total", users.length]].map(([l, v]) => (
                    <div key={l} className="stat-row">
                      <span className="stat-row__label">{l}</span>
                      <strong className="stat-row__value">{v}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card card--noPad card--operational">
                <div className="card__header"><span className="card__title">Top especialidades encaminhadas</span></div>
                <div className="card__body">
                  {!topSpecs.length ? (
                    <p className="muted">Nenhum encaminhamento no período.</p>
                  ) : topSpecs.map(([s, c]) => (
                    <div key={s} className="stat-row">
                      <span className="stat-row__label">{s}</span>
                      <strong className="stat-row__value stat-row__value--accent">{c}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "patients" && (
          <>
            <p className="reports-section-label">Distribuição por categoria de cuidado</p>
            <div className="card card--noPad card--operational">
              <div className="card__body">
                {Object.entries(catBreak).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                  const pct = Math.round((count / totalPatients) * 100);
                  return (
                    <div key={cat} className="reports-bar-row">
                      <div className="reports-bar-row__header">
                        <strong>{templates.find((t) => t.category === cat)?.label || cat}</strong>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="dashboard__meter">
                        <span className="dashboard__meter-fill dashboard__meter-fill--neutral" style={{ "--dashboard-meter": `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {tab === "production" && (
          <>
            <p className="reports-section-label">Produção · {periodLabel}</p>
            <div className="reports-stats">
              <StatBox label="Consultas agendadas" value={agendaPeriod.length} />
              <StatBox label="Consultas realizadas" value={consultDone} tone="success" />
              <StatBox label="Faltas" value={consultAbsent} tone="warning" />
              <StatBox label="Taxa de comparecimento" value={agendaPeriod.length > 0 ? `${Math.round((consultDone / agendaPeriod.length) * 100)}%` : "—"} tone="info" />
              <StatBox label="Encaminhamentos emitidos" value={referralsPeriod.length} />
              <StatBox label="Encaminhamentos concluídos" value={referralsPeriod.filter((r) => r.status === "done").length} tone="success" />
            </div>
          </>
        )}

        {tab === "pharmacy" && (
          <>
            <p className="reports-section-label">Farmácia · {periodLabel}</p>
            <div className="reports-stats">
              <StatBox label="Dispensações" value={dispensasPeriod.length} tone="warning" />
              <StatBox label="Itens em estoque" value={(pharmacyStock || []).length} />
              <StatBox label="Estoque zerado" value={(pharmacyStock || []).filter((s) => s.qty === 0).length} tone="danger" />
              <StatBox label="Estoque baixo" value={lowStock} tone={lowStock > 0 ? "warning" : "success"} />
            </div>
            {dispensasPeriod.length > 0 && (
              <div className="card card--noPad card--operational">
                <div className="card__header"><span className="card__title">Medicamentos mais dispensados</span></div>
                <div className="card__body">
                  {Object.entries(
                    dispensasPeriod.reduce((a, d) => {
                      a[d.itemName] = (a[d.itemName] || 0) + Number(d.qty || 1);
                      return a;
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, qty]) => (
                    <div key={name} className="stat-row">
                      <span className="stat-row__label">{name}</span>
                      <strong className="stat-row__value stat-row__value--accent">{qty}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "esus" && (
            <EsusMirror patients={patients} users={users} agenda={agenda} referrals={referrals} pharmacyLog={pharmacyLog} period={period} periodLabel={periodLabel} />
        )}

        {tab === "audit" && (
          <AuditLogPanel embedded />
        )}
      </div>
    </div>
  );
}

export default ReportsPage;
