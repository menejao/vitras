import { useEffect, useMemo, useState } from "react";
import { fetchAuditLogs, exportAuditLogs, pruneAuditLogs } from "../api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import PageHeader from "../components/layout/PageHeader";
import Select from "../components/ui/Select";
import { readSession } from "../utils/storage";
import { canManage, isAdmin } from "../utils/roles";

const ACTION_LABELS = {
  "auth.login": { label: "Login", tone: "success" },
  "auth.login_failed": { label: "Tentativa falha", tone: "danger" },
  "auth.refresh": { label: "Refresh de sessÃ£o", tone: "info" },
  "auth.logout": { label: "Logout", tone: "neutral" },
  "auth.2fa_status_read": { label: "Leitura status 2FA", tone: "info" },
  "audit.read": { label: "Leitura de auditoria", tone: "info" },
  "audit.export": { label: "ExportaÃ§Ã£o de auditoria", tone: "warning" },
  "audit.retention_prune": { label: "Expurgo por retenÃ§Ã£o", tone: "danger" },
  "me.read": { label: "Leitura do perfil", tone: "info" },
  "me.access_context_read": { label: "Leitura do contexto", tone: "info" },
  "user.list_read": { label: "Leitura de usuÃ¡rios", tone: "info" },
  "user.activity_log_read": { label: "Leitura de atividade", tone: "info" },
  "user.usage_read": { label: "Leitura de uso", tone: "info" },
  LOGIN: { label: "Login", tone: "success" },
  LOGIN_FAILED: { label: "Tentativa falha", tone: "danger" },
  LOGOUT: { label: "Logout", tone: "neutral" },
  USUARIO_CADASTRADO: { label: "UsuÃ¡rio cadastrado", tone: "info" },
  USUARIO_EDITADO: { label: "UsuÃ¡rio editado", tone: "warning" },
  USUARIO_EXCLUIDO: { label: "UsuÃ¡rio excluÃ­do", tone: "danger" },
  PACIENTE_CADASTRADO: { label: "Paciente cadastrado", tone: "accent" },
  PACIENTE_EDITADO: { label: "Paciente editado", tone: "accent" },
  PACIENTE_EXCLUIDO: { label: "Paciente excluÃ­do", tone: "danger" },
  ATENDIMENTO_REGISTRADO: { label: "Atendimento", tone: "info" },
  TAREFA_CRIADA: { label: "Tarefa criada", tone: "warning" },
  MENSAGEM_ENVIADA: { label: "Mensagem", tone: "info" },
  REGISTRO_INATIVADO: { label: "Registro inativado", tone: "warning" },
  ATENDIMENTO_EXCLUIDO: { label: "Atendimento excluÃ­do", tone: "danger" },
  ACESSO_PRONTUARIO: { label: "Acesso prontuÃ¡rio", tone: "info" },
  LANCAMENTO_REGISTRO: { label: "LanÃ§amento prontuÃ¡rio", tone: "info" },
  INATIVACAO_REGISTRO: { label: "InativaÃ§Ã£o prontuÃ¡rio", tone: "warning" },
  PEDIDO_EXAME: { label: "Pedido de exame", tone: "accent" },
  PRESCRICAO_EMITIDA: { label: "PrescriÃ§Ã£o emitida", tone: "success" },
  ENCAMINHAMENTO_INTERNO: { label: "Encaminhamento", tone: "info" },
  EXAME_POSTO_REGISTRADO: { label: "Exame (posto)", tone: "accent" },
  EXAME_EXTERNO_INSERIDO: { label: "Exame externo", tone: "info" },
  RESET_SENHA_SOLICITADO: { label: "Reset de senha", tone: "warning" },
  DISPENSACAO_FARMACIA: { label: "DispensaÃ§Ã£o", tone: "accent" },
  ESTOQUE_AJUSTADO: { label: "Ajuste de estoque", tone: "warning" },
  MEDICAMENTO_CADASTRADO: { label: "Medicamento cadastrado", tone: "success" },
  MEDICAMENTO_EDITADO: { label: "Medicamento editado", tone: "warning" },
  EXAME_EXCLUIDO: { label: "Exame excluÃ­do", tone: "danger" }
};

const CATEGORY_OPTIONS = [
  ["", "Todas categorias"],
  ["auth", "Auth"],
  ["read", "Leitura"],
  ["write", "Escrita"],
  ["export", "ExportaÃ§Ã£o"],
  ["privacy", "Privacidade"],
  ["audit", "Auditoria"],
  ["general", "Geral"]
];

const SEVERITY_OPTIONS = [
  ["", "Toda severidade"],
  ["info", "Info"],
  ["medium", "MÃ©dia"],
  ["high", "Alta"]
];

const OUTCOME_OPTIONS = [
  ["", "Todo resultado"],
  ["success", "Sucesso"],
  ["denied", "Negado"],
  ["error", "Erro"]
];

const ENTITY_OPTIONS = [
  ["", "Toda entidade"],
  ["auth", "Auth"],
  ["user", "UsuÃ¡rio"],
  ["patient", "Paciente"],
  ["audit_log", "Auditoria"],
  ["privacy_request", "SolicitaÃ§Ã£o LGPD"],
  ["task", "Tarefa"],
  ["protocol_template", "Protocolo"]
];

function getSessionToken() {
  const session = readSession();
  if (!session) return "";
  return session.mode === "cookie" ? "__cookie_session__" : String(session.token || "");
}

function formatActionMeta(action = "") {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return {
    label: String(action || "AÃ§Ã£o")
      .replaceAll(".", " Â· ")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase()),
    tone: "neutral"
  };
}

function buildDetails(entry) {
  const chunks = [];
  if (entry.entity) chunks.push(`Entidade: ${entry.entity}${entry.entityId ? ` (${entry.entityId})` : ""}`);
  if (entry.teamName || entry.teamId) chunks.push(`Equipe: ${entry.teamName || entry.teamId}`);
  if (entry.request?.method || entry.request?.path) chunks.push(`Rota: ${entry.request?.method || "GET"} ${entry.request?.path || ""}`.trim());
  if (entry.request?.ip) chunks.push(`IP: ${entry.request.ip}`);
  if (entry.outcome) chunks.push(`Resultado: ${entry.outcome}`);
  if (entry.details && Object.keys(entry.details).length) chunks.push(JSON.stringify(entry.details));
  return chunks.join(" Â· ");
}

function normalizeDisplayDate(entry) {
  if (entry.createdAt) return String(entry.createdAt).slice(0, 19).replace("T", " ");
  if (entry.tsDisplay) return entry.tsDisplay;
  if (entry.ts) return String(entry.ts).slice(0, 19).replace("T", " ");
  return "â€”";
}

function AuditLogPanel({ embedded = false }) {
  const [session] = useState(() => readSession());
  const [token] = useState(() => getSessionToken());
  const currentUser = session?.user || null;
  const canRunRetention = isAdmin(currentUser) || canManage(currentUser);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [teamIdFilter, setTeamIdFilter] = useState("");
  const [patientIdFilter, setPatientIdFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState("");
  const [totalMatched, setTotalMatched] = useState(0);
  const [retentionDays, setRetentionDays] = useState("730");
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [retentionResult, setRetentionResult] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setRetentionResult(null);
      try {
        const payload = await fetchAuditLogs(token, {
          limit: 100,
          action: actionFilter,
          category: categoryFilter,
          severity: severityFilter,
          outcome: outcomeFilter,
          entity: entityFilter,
          teamId: teamIdFilter,
          patientId: patientIdFilter,
          from: fromFilter ? `${fromFilter}T00:00:00.000Z` : "",
          to: toFilter ? `${toFilter}T23:59:59.999Z` : ""
        });
        if (!active) return;
        const nextItems = Array.isArray(payload?.items) ? payload.items : [];
        setItems(nextItems);
        setNextCursor(String(payload?.nextCursor || ""));
        setTotalMatched(Number(payload?.totalMatched || nextItems.length));
      } catch (err) {
        if (!active) return;
        setItems([]);
        setNextCursor("");
        setTotalMatched(0);
        setError(String(err?.message || "Falha ao carregar auditoria remota"));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [token, actionFilter, categoryFilter, severityFilter, outcomeFilter, entityFilter, teamIdFilter, patientIdFilter, fromFilter, toFilter]);

  const filtered = useMemo(() => {
    return items.filter((entry) => {
      if (!search.trim()) return true;
      return JSON.stringify(entry).toLowerCase().includes(search.toLowerCase());
    });
  }, [items, search]);

  const actions = useMemo(() => [...new Set(items.map((entry) => entry.action).filter(Boolean))].sort(), [items]);

  const summary = useMemo(() => {
    return filtered.reduce((acc, entry) => {
      acc.total += 1;
      if (String(entry.severity || "") === "high") acc.highSeverity += 1;
      if (String(entry.outcome || "") === "denied") acc.denied += 1;
      if (String(entry.action || "").includes("login_failed")) acc.loginFailed += 1;
      if (String(entry.category || "") === "export") acc.exports += 1;
      return acc;
    }, {
      total: 0,
      highSeverity: 0,
      denied: 0,
      loginFailed: 0,
      exports: 0
    });
  }, [filtered]);

  async function handleExport(format = "csv") {
    const payload = await exportAuditLogs(token, {
      format,
      action: actionFilter,
      category: categoryFilter,
      severity: severityFilter,
      outcome: outcomeFilter,
      entity: entityFilter,
      teamId: teamIdFilter,
      patientId: patientIdFilter,
      from: fromFilter ? `${fromFilter}T00:00:00.000Z` : "",
      to: toFilter ? `${toFilter}T23:59:59.999Z` : ""
    });
    const url = URL.createObjectURL(payload.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoading(true);
    setError("");
    try {
      const payload = await fetchAuditLogs(token, {
        limit: 100,
        cursor: nextCursor,
        action: actionFilter,
        category: categoryFilter,
        severity: severityFilter,
        outcome: outcomeFilter,
        entity: entityFilter,
        teamId: teamIdFilter,
        patientId: patientIdFilter,
        from: fromFilter ? `${fromFilter}T00:00:00.000Z` : "",
        to: toFilter ? `${toFilter}T23:59:59.999Z` : ""
      });
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems((current) => [...current, ...nextItems]);
      setNextCursor(String(payload?.nextCursor || ""));
      setTotalMatched(Number(payload?.totalMatched || totalMatched));
    } catch (err) {
      setError(String(err?.message || "Falha ao carregar prÃ³xima pÃ¡gina"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRetentionPreview() {
    setRetentionBusy(true);
    setError("");
    try {
      const payload = await pruneAuditLogs(token, {
        olderThanDays: Number(retentionDays || 0),
        dryRun: true
      });
      setRetentionResult(payload);
    } catch (err) {
      setError(String(err?.message || "Falha ao simular retenÃ§Ã£o"));
    } finally {
      setRetentionBusy(false);
    }
  }

  async function handleRetentionPrune() {
    setRetentionBusy(true);
    setError("");
    try {
      const payload = await pruneAuditLogs(token, {
        olderThanDays: Number(retentionDays || 0),
        dryRun: false
      });
      setRetentionResult(payload);
      const refreshed = await fetchAuditLogs(token, {
        limit: 100,
        action: actionFilter,
        category: categoryFilter,
        severity: severityFilter,
        outcome: outcomeFilter,
        entity: entityFilter,
        teamId: teamIdFilter,
        patientId: patientIdFilter,
        from: fromFilter ? `${fromFilter}T00:00:00.000Z` : "",
        to: toFilter ? `${toFilter}T23:59:59.999Z` : ""
      });
      const nextItems = Array.isArray(refreshed?.items) ? refreshed.items : [];
      setItems(nextItems);
      setNextCursor(String(refreshed?.nextCursor || ""));
      setTotalMatched(Number(refreshed?.totalMatched || nextItems.length));
    } catch (err) {
      setError(String(err?.message || "Falha ao executar retenÃ§Ã£o"));
    } finally {
      setRetentionBusy(false);
    }
  }

  const exportBtn = (
    <Button variant="secondary" size="sm" onClick={() => handleExport("csv")}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 3v8M5 8l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
      Exportar CSV
    </Button>
  );

  return (
    <div className={embedded ? "audit-embedded" : "audit-page"}>
      {!embedded && (
        <PageHeader
          eyebrow="SeguranÃ§a e Conformidade"
          title="Trilha de Auditoria"
          subtitle={`${totalMatched} eventos encontrados â€” leitura institucional, exportÃ¡vel, com retenÃ§Ã£o controlada.`}
          actions={exportBtn}
        />
      )}
      {embedded && (
        <div className="audit-embedded-header">
          <span className="audit-embedded-title">Trilha de Auditoria Â· {totalMatched} eventos</span>
          {exportBtn}
        </div>
      )}

      {error && (
        <div className="audit-notice audit-notice--danger">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span>{error}.</span>
        </div>
      )}

      <div className="audit-notice">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        <span>Trilha <strong>somente leitura</strong>. Fonte atual: <strong>backend oficial</strong>. Eventos carregam categoria, severidade, responsÃ¡vel e contexto da requisiÃ§Ã£o.</span>
      </div>

      {canRunRetention && (
        <div className="card audit-retention-card">
          <div className="audit-retention-card__header">
            <div>
              <div className="audit-retention-card__title">RetenÃ§Ã£o de auditoria</div>
              <div className="audit-retention-card__sub">Execute primeiro em modo simulaÃ§Ã£o. Expurgo real sÃ³ depois da prÃ©via.</div>
            </div>
            <div className="audit-retention-card__actions">
              <Input
                className="audit-retention-card__input"
                value={retentionDays}
                onChange={(event) => setRetentionDays(event.target.value)}
                inputMode="numeric"
                placeholder="Dias"
              />
              <Button variant="secondary" size="sm" onClick={handleRetentionPreview} disabled={retentionBusy}>
                Simular retenÃ§Ã£o
              </Button>
              <Button variant="danger" size="sm" onClick={handleRetentionPrune} disabled={retentionBusy || !retentionResult?.candidateCount}>
                Executar expurgo
              </Button>
            </div>
          </div>

          {retentionResult && (
            <div className="audit-retention-card__result">
              {"candidateCount" in retentionResult && (
                <div className="audit-retention-card__stats">
                  <span><strong>Corte:</strong> {retentionResult.cutoffIso || "â€”"}</span>
                  <span><strong>Candidatos:</strong> {retentionResult.candidateCount ?? retentionResult.prunedCount ?? 0}</span>
                  {"remainingCount" in retentionResult && <span><strong>Restantes:</strong> {retentionResult.remainingCount}</span>}
                </div>
              )}
              {Array.isArray(retentionResult.sample) && retentionResult.sample.length > 0 && (
                <div className="audit-retention-card__sample">
                  {retentionResult.sample.map((item) => (
                    <span key={item.id} className="audit-badge audit-badge--neutral">
                      {item.action || item.id} Â· {String(item.createdAt || "").slice(0, 10)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="audit-toolbar">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por usuÃ¡rio, aÃ§Ã£o, detalhe..."
          style={{ flex: 1, minWidth: 220 }}
        />
        <Select style={{ minWidth: 180 }} value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="">Todas as aÃ§Ãµes</option>
            {actions.map((action) => <option key={action} value={action}>{formatActionMeta(action).label}</option>)}
        </Select>
        <Select style={{ minWidth: 160 }} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Select style={{ minWidth: 150 }} value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            {SEVERITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Select style={{ minWidth: 150 }} value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)}>
            {OUTCOME_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Select style={{ minWidth: 170 }} value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}>
            {ENTITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Input style={{ minWidth: 150 }} value={teamIdFilter} onChange={(event) => setTeamIdFilter(event.target.value)} placeholder="Equipe (teamId)" />
        <Input style={{ minWidth: 170 }} value={patientIdFilter} onChange={(event) => setPatientIdFilter(event.target.value)} placeholder="Paciente (patientId)" />
        <Input style={{ minWidth: 160 }} type="date" value={fromFilter} onChange={(event) => setFromFilter(event.target.value)} />
        <Input style={{ minWidth: 160 }} type="date" value={toFilter} onChange={(event) => setToFilter(event.target.value)} />
      </div>

      <div className="audit-summary-grid">
        <div className="audit-summary-card">
          <span className="audit-summary-card__label">Eventos visÃ­veis</span>
          <strong className="audit-summary-card__value">{summary.total}</strong>
        </div>
        <div className="audit-summary-card">
          <span className="audit-summary-card__label">Alta severidade</span>
          <strong className="audit-summary-card__value">{summary.highSeverity}</strong>
        </div>
        <div className="audit-summary-card">
          <span className="audit-summary-card__label">Acessos negados</span>
          <strong className="audit-summary-card__value">{summary.denied}</strong>
        </div>
        <div className="audit-summary-card">
          <span className="audit-summary-card__label">Falhas de login</span>
          <strong className="audit-summary-card__value">{summary.loginFailed}</strong>
        </div>
        <div className="audit-summary-card">
          <span className="audit-summary-card__label">ExportaÃ§Ãµes</span>
          <strong className="audit-summary-card__value">{summary.exports}</strong>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="audit-table">
          <thead>
            <tr>
              <th className="audit-table__th" style={{ width: 150 }}>Data / Hora</th>
              <th className="audit-table__th" style={{ width: 260 }}>AÃ§Ã£o</th>
              <th className="audit-table__th" style={{ width: 180 }}>UsuÃ¡rio</th>
              <th className="audit-table__th">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && !loading && (
              <tr>
                <td colSpan={4} className="audit-table__td" style={{ textAlign: "center", padding: "var(--s-8)" }}>
                  Nenhum evento encontrado.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={4} className="audit-table__td" style={{ textAlign: "center", padding: "var(--s-8)" }}>
                  Carregando trilha de auditoria...
                </td>
              </tr>
            )}
            {filtered.map((entry) => {
              const meta = formatActionMeta(entry.action);
              const details = buildDetails(entry);
              return (
                <tr key={entry.id}>
                  <td className="audit-table__td audit-table__td--mono">
                    {normalizeDisplayDate(entry)}
                  </td>
                  <td className="audit-table__td">
                    <div className="audit-badge-stack">
                      <span className={`audit-badge audit-badge--${meta.tone}`}>{meta.label}</span>
                      {entry.category && <span className="audit-badge audit-badge--neutral">{entry.category}</span>}
                      {entry.severity && (
                        <span className={`audit-badge audit-badge--${entry.severity === "high" ? "danger" : entry.severity === "medium" ? "warning" : "info"}`}>
                          {entry.severity}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="audit-table__td">
                    {(entry.actor || entry.user) ? (
                      <div>
                        <div className="audit-table__td--user-name">{entry.actor?.name || entry.user?.name || "â€”"}</div>
                        <div className="audit-table__td--user-sub">{entry.actor?.role || entry.user?.role || "â€”"} Â· {entry.teamName || entry.actor?.teamName || entry.teamId || "Sem equipe"}</div>
                      </div>
                    ) : <span style={{ color: "var(--text-dim)" }}>â€”</span>}
                  </td>
                  <td className="audit-table__td audit-table__td--details" title={details}>
                    {details || "â€”"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="audit-pagination">
        <span>Mostrando {filtered.length} de {totalMatched} eventos do backend oficial.</span>
        <div className="audit-pagination__btns">
          {nextCursor && (
            <Button variant="secondary" size="sm" onClick={handleLoadMore} disabled={loading}>Carregar mais</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuditLogPanel;

