import Chip from "../components/ui/Chip";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import KPI from "../components/ui/KPI";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import PageLayout from "../components/layout/PageLayout";
import PageHeader from "../components/layout/PageHeader";
import { buildProactiveAlerts, protocolChip, catLabel } from "../utils/clinical";
import { roleLabel } from "../utils/roles";

function Dashboard({ patients, users, allUsers, templates, protocolByPatient, demandMonthly, currentUser, onNavigate, agenda = [], pharmacyStock = [] }) {
  const assigned = patients.filter((p) => String(p.assignedAcsId || "").trim()).length;
  const unassigned = Math.max(patients.length - assigned, 0);
  const acsCount = users.filter((u) => u.role === "acs").length;
  const docCount = users.filter((u) => u.role === "doctor").length;
  const pc = Object.values(protocolByPatient || {}).reduce((a, s) => {
    const chip = protocolChip(s);
    if (chip.tone === "danger") a.critical += 1;
    else if (chip.tone === "warn") a.attention += 1;
    else if (chip.tone === "ok") a.ok += 1;
    return a;
  }, { critical: 0, attention: 0, ok: 0 });

  const critical = patients.filter((p) => protocolChip(protocolByPatient[p.id]).tone === "danger").slice(0, 6);
  const dmTotal = demandMonthly?.totals?.total ?? 0;
  const dmSched = demandMonthly?.totals?.scheduled ?? 0;
  const dmSpont = demandMonthly?.totals?.spontaneous ?? 0;
  const dmPct = dmTotal > 0 ? Math.round((dmSched / dmTotal) * 100) : null;
  const dmInRange = dmPct !== null && dmPct >= 50 && dmPct <= 70;
  const dmStatus = dmPct === null ? "Sem dados" : dmInRange ? "Na meta" : dmPct < 50 ? "Abaixo da meta" : "Acima da meta";
  const dmTone = dmPct === null ? "neutral" : dmInRange ? "success" : dmPct < 50 ? "warning" : "danger";

  const alerts = buildProactiveAlerts(
    patients,
    protocolByPatient,
    pharmacyStock,
    agenda,
  ).slice(0, 6);

  return (
    <PageLayout className="dashboard dashboard--vitras">
      <PageHeader
        eyebrow="Vitras"
        title="Visão operacional da unidade"
        subtitle="Plataforma integrada para gestão da saúde pública. Monitore pacientes, equipe, protocolos e alertas clínicos com densidade institucional."
        variant="workspace"
        actions={(
          <div className="dashboard__header-actions">
            <Button size="sm" onClick={() => onNavigate?.("gestor")}>Abrir gestão à vista</Button>
            <Button variant="secondary" size="sm" onClick={() => onNavigate?.("patients")}>Ir para pacientes</Button>
          </div>
        )}
      />

      <section className="dashboard__kpis">
        <KPI label="Pacientes ativos" value={patients.length} helper="Total cadastrado" className="card card--compact" />
        <KPI label="Com ACS definido" value={assigned} helper={`Sem ACS: ${unassigned}`} className="card card--compact" />
        <KPI
          label="Protocolos críticos"
          value={pc.critical}
          helper={`Atenção: ${pc.attention} · Em dia: ${pc.ok}`}
          className={`card card--compact ${pc.critical ? "kpi--danger" : pc.attention ? "kpi--warning" : "kpi--success"}`}
        />
        <KPI label="Profissionais" value={users.length} helper={`ACS: ${acsCount} · Médicos: ${docCount}`} className="card card--compact" />
      </section>

      {currentUser?.role === "nurse_manager" ? (
        <Card className={`dashboard__demand-card card--executive card--noPad ${dmTone !== "neutral" ? `kpi--${dmTone}` : ""}`}>
          <div className="card__header">
            <span className="card__title">Demanda programada</span>
            <Badge tone={dmTone}>{dmStatus}</Badge>
          </div>
          <div className="card__body">
            <div className="dashboard__demand-value-row">
              <strong className="dashboard__demand-value">{dmPct === null ? "—" : `${dmPct}%`}</strong>
            </div>
            {dmPct !== null ? (
              <div className="dashboard__meter" aria-hidden="true">
                <span className="dashboard__meter-target" />
                <span className={`dashboard__meter-fill dashboard__meter-fill--${dmTone}`} style={{ "--dashboard-meter": `${Math.min(dmPct, 100)}%` }} />
              </div>
            ) : null}
            <p className="dashboard__demand-foot">
              {dmPct === null ? "Nenhum atendimento registrado." : `${dmSched} programados · ${dmSpont} espontâneos · meta 50–70%`}
            </p>
          </div>
        </Card>
      ) : null}


      {alerts.length ? (
        <section className="dashboard__alerts">
          <div className="dashboard__section-head">
            <div>
              <h2>Alertas proativos</h2>
              <p>{alerts.length} aviso{alerts.length !== 1 ? "s" : ""} priorizado{alerts.length !== 1 ? "s" : ""} por contexto clínico e operacional.</p>
            </div>
          </div>
          <div className="dashboard__alerts-grid">
            {alerts.map((a) => (
              <Button
                key={a.id}
                variant="ghost"
                className={`dashboard__alert-card dashboard__alert-card--${a.type}`}
                onClick={() => a.patientId && onNavigate && onNavigate(a.patientId)}
                disabled={!a.patientId}
              >
                <span className="dashboard__alert-icon">
                  {a.type === "danger" ? (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  ) : a.type === "warn" ? (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 2L14.5 13.5H1.5L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M8 7v2.5M8 11.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7.5v4M8 5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  )}
                </span>
                <span className="dashboard__alert-copy">
                  <strong>{a.title}</strong>
                  <span>{a.detail}</span>
                </span>
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="dashboard__grid">
        <Card className="card--operational">
          <div className="card__header">
            <span className="card__title">Pacientes prioritários</span>
            <Chip tone="danger">{pc.critical} crítico{pc.critical !== 1 ? "s" : ""}</Chip>
          </div>
          <div className="card__body">
            {!critical.length ? (
              <p className="muted dashboard__empty-copy">Nenhum paciente com protocolo crítico.</p>
            ) : (
              <ul className="stack-list">
                {critical.map((p) => {
                  const chip = protocolChip(protocolByPatient[p.id]);
                  const acsName = users.find((u) => u.id === p.assignedAcsId)?.name || "Sem ACS";
                  return (
                    <li
                      key={p.id}
                      className="stack-list__patient-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate?.(p.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate?.(p.id); }}
                    >
                      <div>
                        <p><strong>{p.name}</strong></p>
                        <p className="muted small">{catLabel(templates, p.careCategory)} · {acsName}</p>
                      </div>
                      <Chip tone={chip.tone}>{chip.text}</Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card className="card--operational">
          <div className="card__header">
            <span className="card__title">Equipe ativa</span>
            <Chip tone="muted">{users.length} membros</Chip>
          </div>
          <div className="card__body">
            {!users.length ? (
              <p className="muted dashboard__empty-copy">Nenhum membro na equipe.</p>
            ) : (
              <ul className="stack-list">
                {users.slice(0, 6).map((u) => (
                  <li key={u.id}>
                    <div className="dashboard__team-user">
                      <Avatar name={u.name} size="sm" />
                      <div>
                        <p><strong>{u.name}</strong></p>
                        <p className="muted small">{roleLabel(u.role)}</p>
                      </div>
                    </div>
                    <Chip tone="muted">
                      {u.role === "acs" ? "ACS" : u.role === "doctor" ? "Médico" : u.role === "nursing_tech" ? "Téc. Enf." : u.role === "pharmacist" ? "Farmac." : "Enf."}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>
    </PageLayout>
  );
}

export default Dashboard;
