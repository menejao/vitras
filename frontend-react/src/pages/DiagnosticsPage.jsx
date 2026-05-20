import { useMemo } from "react";
import PageHeader from "../components/layout/PageHeader";
import Badge from "../components/ui/Badge";
import { roleLabel } from "../utils/roles";

function DiagnosticsPage({ apiHealth, token, user, patients, users, templates, lastLoadAt, demandMonthly }) {
  const sessionAgeMin = useMemo(() => {
    const issuedAt = Number(user?.iat || 0) * 1000;
    if (!issuedAt) return null;
    return Math.max(0, Math.round((Date.now() - issuedAt) / 60000));
  }, [user?.iat]);

  const updatedAt = apiHealth?.checkedAt
    ? new Date(apiHealth.checkedAt).toLocaleString("pt-BR")
    : "-";

  const healthTone = apiHealth?.status === "ok"
    ? "success"
    : apiHealth?.status === "degraded"
    ? "warning"
    : "danger";

  const latency = Number(apiHealth?.latencyMs || 0);
  const totalRecords = useMemo(() => {
    try {
      return (patients || []).reduce((sum, p) => sum + Number(p?.historyCount || 0), 0);
    } catch {
      return 0;
    }
  }, [patients]);

  return (
    <div className="diagnostics-page">
      <PageHeader
        eyebrow="Sistema"
        title="Diagnósticos"
        subtitle="Visão técnica consolidada de conectividade, sessão, carga operacional e consistência de dados."
        variant="workspace"
        actions={(
          <div className="reports-hero-actions">
            <Badge tone={healthTone}>{apiHealth?.label || "Verificando..."}</Badge>
            {latency > 0 && (
              <span className="diag-hero-latency">Latência: {latency} ms</span>
            )}
          </div>
        )}
      />

      <div className="dashboard__kpis">
        <div className={`kpi card card--compact kpi--${healthTone}`}>
          <span className="kpi__label">API</span>
          <strong className="kpi__value">{apiHealth?.label || "—"}</strong>
          <span className="kpi__helper">Verificado: {updatedAt}</span>
        </div>
        <div className="kpi card card--compact">
          <span className="kpi__label">Sessão</span>
          <strong className="kpi__value">{token ? "Ativa" : "—"}</strong>
          <span className="kpi__helper">{roleLabel(user?.role)} · {sessionAgeMin === null ? "—" : `${sessionAgeMin} min`}</span>
        </div>
        <div className="kpi card card--compact">
          <span className="kpi__label">Carga local</span>
          <strong className="kpi__value">{patients?.length || 0}</strong>
          <span className="kpi__helper">{users?.length || 0} usuários · {templates?.length || 0} protocolos · {totalRecords} registros</span>
        </div>
        <div className="kpi card card--compact">
          <span className="kpi__label">Última carga</span>
          <strong className="kpi__value">{lastLoadAt ? new Date(lastLoadAt).toLocaleTimeString("pt-BR") : "—"}</strong>
          <span className="kpi__helper">Demanda: {Number(demandMonthly?.totals?.total ?? 0)} · Agend. {Number(demandMonthly?.totals?.scheduled ?? 0)} · Esp. {Number(demandMonthly?.totals?.walkin ?? 0)}</span>
        </div>
      </div>

      <div className="card card--noPad card--operational">
        <div className="card__header"><span className="card__title">Detalhes da sessão</span></div>
        <div className="card__body">
          <div className="diag-detail-grid">
            {[
              ["Perfil", roleLabel(user?.role)],
              ["Usuário", user?.name || "—"],
              ["Tempo de sessão", sessionAgeMin === null ? "—" : `${sessionAgeMin} min`],
              ["API URL", apiHealth?.url || "—"],
              ["Latência", latency ? `${latency} ms` : "—"],
              ["Verificado em", updatedAt],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="diag-detail-item__label">{label}</p>
                <p className="diag-detail-item__value">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiagnosticsPage;
