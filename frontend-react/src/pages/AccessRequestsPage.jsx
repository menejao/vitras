import { useEffect, useState } from "react";
import { listAccessRequests, approveAccessRequest, rejectAccessRequest } from "../api";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/layout/PageHeader";

const STATUS_LABEL = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado" };
const STATUS_TONE = { pending: "warning", approved: "success", rejected: "danger" };

function AccessRequestsPage({ token }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listAccessRequests(token);
      setRequests(Array.isArray(data) ? data : (Array.isArray(data?.requests) ? data.requests : []));
    } catch (e) {
      setError(e.message || "Erro ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id) {
    setActionBusy(`${id}_approve`);
    setError("");
    try {
      await approveAccessRequest(token, id);
      await load();
    } catch (e) {
      setError(e.message || "Erro ao aprovar solicitação.");
    } finally {
      setActionBusy("");
    }
  }

  async function handleReject(id) {
    setActionBusy(`${id}_reject`);
    setError("");
    try {
      await rejectAccessRequest(token, id);
      await load();
    } catch (e) {
      setError(e.message || "Erro ao recusar solicitação.");
    } finally {
      setActionBusy("");
    }
  }

  const pendingCount = requests.filter((item) => item.status === "pending").length;
  const approvedCount = requests.filter((item) => item.status === "approved").length;
  const rejectedCount = requests.filter((item) => item.status === "rejected").length;

  return (
    <div className="access-page">
      <PageHeader
        eyebrow="Administração"
        title="Solicitações de Acesso"
        subtitle="Fila administrativa para aprovação, rejeição e acompanhamento de credenciais da plataforma."
        actions={(
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            {loading ? "Carregando..." : "Atualizar"}
          </Button>
        )}
      />

      <section className="page-kpis">
        <div className="kpi card card--compact kpi--warning">
          <span className="kpi__label">Pendentes</span>
          <strong className="kpi__value">{pendingCount}</strong>
          <span className="kpi__helper">aguardando decisão</span>
        </div>
        <div className="kpi card card--compact kpi--success">
          <span className="kpi__label">Aprovadas</span>
          <strong className="kpi__value">{approvedCount}</strong>
          <span className="kpi__helper">credenciais liberadas</span>
        </div>
        <div className="kpi card card--compact kpi--danger">
          <span className="kpi__label">Recusadas</span>
          <strong className="kpi__value">{rejectedCount}</strong>
          <span className="kpi__helper">negadas</span>
        </div>
      </section>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {loading ? (
        <div className="card card--padded">
          <p className="muted">Carregando solicitações...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="card">
          <EmptyState message="Nenhuma solicitação de acesso pendente." />
        </div>
      ) : (
        <div className="card card--noPad">
          <table className="table">
            <thead>
              <tr>
                <th>Solicitante</th>
                <th>Cargo / Função</th>
                <th>Status</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td>
                    <strong>{req.name}</strong>
                    <br />
                    <span className="muted small">{req.email}</span>
                  </td>
                  <td>{req.jobTitle || "—"}</td>
                  <td>
                    <Badge tone={STATUS_TONE[req.status] || "neutral"}>
                      {STATUS_LABEL[req.status] || req.status}
                    </Badge>
                  </td>
                  <td className="muted small">
                    {req.createdAt ? new Date(req.createdAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td>
                    {req.status === "pending" ? (
                      <div className="access-req-actions">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={!!actionBusy}
                          onClick={() => handleApprove(req.id)}
                        >
                          {actionBusy === `${req.id}_approve` ? "..." : "Aprovar"}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={!!actionBusy}
                          onClick={() => handleReject(req.id)}
                        >
                          {actionBusy === `${req.id}_reject` ? "..." : "Recusar"}
                        </Button>
                      </div>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AccessRequestsPage;
