/**
 * ImportConsole — IMPORT-UI-01
 *
 * Exposes existing import pipeline capabilities via Console Nacional.
 * No new business logic — UI only over /import/* routes.
 * Access restricted to support_admin and break_glass_admin (enforced by backend).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../api";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Alert from "../ui/Alert";

// ── Constants ──────────────────────────────────────────────────────────────

const SOURCE_PROFILES = [
  { value: "sp-pec-aps-v01", label: "e-SUS PEC APS (v4.2)" },
];

const JOB_STATUS_LABELS = {
  received:     "Recebido",
  mapping:      "Mapeando",
  validating:   "Validando",
  selecting:    "Selecionando",
  staging:      "Em Staging",
  homologating: "Aguarda Homologação",
  committed:    "Commitado",
  failed:       "Falhou",
  discarded:    "Descartado",
};

const JOB_STATUS_COLORS = {
  received:     { bg: "#f3f4f6", color: "#374151" },
  mapping:      { bg: "#dbeafe", color: "#1d4ed8" },
  validating:   { bg: "#dbeafe", color: "#1d4ed8" },
  selecting:    { bg: "#dbeafe", color: "#1d4ed8" },
  staging:      { bg: "#fef3c7", color: "#92400e" },
  homologating: { bg: "#fef9c3", color: "#713f12" },
  committed:    { bg: "#d1fae5", color: "#065f46" },
  failed:       { bg: "#fee2e2", color: "#991b1b" },
  discarded:    { bg: "#f3f4f6", color: "#6b7280" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function apiFetch(path, token, options = {}) {
  const { body, ...rest } = options;
  return api(path, { ...rest, body, credentials: "include" }, token);
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch { return iso.slice(0, 16); }
}

function fmtDateShort(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }).format(new Date(iso));
  } catch { return iso.slice(0, 10); }
}

// ── UI Primitives ──────────────────────────────────────────────────────────

function JobStatusBadge({ status }) {
  const p = JOB_STATUS_COLORS[status] || JOB_STATUS_COLORS.received;
  return (
    <span style={{
      padding: "0.15rem 0.5rem", borderRadius: "999px",
      fontSize: "0.72rem", fontWeight: 700,
      background: p.bg, color: p.color, whiteSpace: "nowrap",
    }}>
      {JOB_STATUS_LABELS[status] || status}
    </span>
  );
}

function BackButton({ onClick, label = "← Voltar" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0",
        fontSize: "0.9rem", color: "var(--color-text-secondary,#6b7280)",
        display: "flex", alignItems: "center", gap: "0.3rem",
      }}
    >
      {label}
    </button>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
      <span style={{ color: "var(--color-text-secondary,#6b7280)", minWidth: 160, flexShrink: 0 }}>{label}:</span>
      <span style={mono ? { fontFamily: "monospace", fontSize: "0.82rem", wordBreak: "break-all" } : {}}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function StatBlock({ label, value, color }) {
  return (
    <div style={{ textAlign: "center", flex: "1 1 80px" }}>
      <div style={{ fontWeight: 800, fontSize: "1.5rem", color: color || "inherit", lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: "0.72rem", color: "var(--color-text-secondary,#6b7280)", marginTop: "0.2rem" }}>
        {label}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--color-border,#e5e7eb)", margin: "0.75rem 0" }} />;
}

// ── FASE 2: Import Job List ────────────────────────────────────────────────

function ImportJobList({ token, onSelect, onNew, refreshKey }) {
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch("/import/jobs", token)
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const thStyle = {
    padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.78rem", fontWeight: 700,
    color: "var(--color-text-secondary,#6b7280)", textTransform: "uppercase",
    letterSpacing: "0.04em", borderBottom: "1px solid var(--color-border,#e5e7eb)",
    whiteSpace: "nowrap", background: "var(--color-surface,#fff)",
  };
  const tdStyle = {
    padding: "0.6rem 0.75rem", fontSize: "0.875rem",
    borderBottom: "1px solid var(--color-border,#e5e7eb)", verticalAlign: "middle",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>Migrações</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={load}
            style={{ background: "none", border: "1px solid var(--color-border,#d1d5db)", borderRadius: "6px", padding: "0.35rem 0.7rem", cursor: "pointer", fontSize: "0.82rem" }}
          >
            ↻ Atualizar
          </button>
          <Button onClick={onNew}>+ Nova Migração</Button>
        </div>
      </div>

      {error && <Alert type="error" style={{ marginBottom: "0.75rem" }}>{error}</Alert>}

      <div style={{ overflowX: "auto", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={thStyle}>Origem</th>
              <th style={thStyle}>UBS</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Responsável</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Pacientes</th>
              <th style={thStyle}>Criado em</th>
              <th style={thStyle}>Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "var(--color-text-secondary,#6b7280)", padding: "2rem" }}>
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && jobs.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "var(--color-text-secondary,#6b7280)", padding: "2rem" }}>
                  Nenhuma migração iniciada. Clique em &quot;+ Nova Migração&quot; para começar.
                </td>
              </tr>
            )}
            {jobs.map((j) => (
              <tr
                key={j.id}
                onClick={() => onSelect(j.id)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg,#f9fafb)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
              >
                <td style={tdStyle}><strong style={{ fontWeight: 600 }}>{j.sourceSystem || j.sourceProfileId}</strong></td>
                <td style={{ ...tdStyle, fontSize: "0.82rem", fontFamily: "monospace" }}>{j.unitId}</td>
                <td style={tdStyle}><JobStatusBadge status={j.status} /></td>
                <td style={{ ...tdStyle, fontSize: "0.82rem", color: "var(--color-text-secondary,#6b7280)" }}>{j.createdBy || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {j.stats?.committed ?? j.stats?.staged ?? "—"}
                </td>
                <td style={{ ...tdStyle, fontSize: "0.8rem", color: "var(--color-text-secondary,#6b7280)" }}>{fmtDateShort(j.createdAt)}</td>
                <td style={{ ...tdStyle, fontSize: "0.8rem", color: "var(--color-text-secondary,#6b7280)" }}>{fmtDateShort(j.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── FASE 3: Nova Migração ──────────────────────────────────────────────────

function NewImportJobForm({ token, onDone, onBack }) {
  const [units, setUnits] = useState([]);
  const [form, setForm]   = useState({
    unitId: "", teamId: "", sourceProfileId: "sp-pec-aps-v01",
    lgpdConsentRecordId: "", notes: "",
  });
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/platform/units?limit=200", token)
      .then((res) => setUnits(res.units || []))
      .catch(() => {});
  }, [token]);

  function set(key) { return (e) => setForm((f) => ({ ...f, [key]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.unitId) { setError("UBS destino é obrigatória."); return; }
    if (!form.sourceProfileId) { setError("Sistema de origem é obrigatório."); return; }
    if (!form.lgpdConsentRecordId.trim()) { setError("ID do registro de consentimento LGPD é obrigatório."); return; }
    setBusy(true);
    try {
      const job = await apiFetch("/import/jobs", token, {
        method: "POST",
        body: JSON.stringify({
          unitId: form.unitId,
          teamId: form.teamId || undefined,
          sourceProfileId: form.sourceProfileId,
          lgpdConsentRecordId: form.lgpdConsentRecordId,
          localFilters: form.notes ? { notes: form.notes } : {},
        }),
      });
      onDone(job.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selectStyle = {
    width: "100%", padding: "0.45rem 0.6rem", borderRadius: "6px",
    fontSize: "0.875rem", border: "1px solid var(--color-border,#d1d5db)",
    background: "var(--color-surface,#fff)", boxSizing: "border-box",
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem", gap: "0.5rem" }}>
        <BackButton onClick={onBack} />
        <h2 style={{ fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>Nova Migração</h2>
      </div>

      {error && <Alert type="error" style={{ marginBottom: "1rem" }}>{error}</Alert>}

      <div style={{ marginBottom: "0.875rem" }}>
        <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>
          UBS Destino *
        </label>
        <select value={form.unitId} onChange={set("unitId")} style={selectStyle}>
          <option value="">Selecionar UBS...</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}{u.cnes ? ` (CNES ${u.cnes})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "0.875rem" }}>
        <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>
          Sistema de Origem *
        </label>
        <select value={form.sourceProfileId} onChange={set("sourceProfileId")} style={selectStyle}>
          {SOURCE_PROFILES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "0.875rem" }}>
        <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>
          ID do Registro de Consentimento LGPD *
        </label>
        <Input
          value={form.lgpdConsentRecordId}
          onChange={set("lgpdConsentRecordId")}
          placeholder="Ex: LGPD-2026-UBS-001"
          style={{ width: "100%", boxSizing: "border-box" }}
        />
        <small style={{ color: "var(--color-text-secondary,#6b7280)", fontSize: "0.75rem" }}>
          Identificador do documento de base legal LGPD que autoriza esta importação.
        </small>
      </div>

      <div style={{ marginBottom: "0.875rem" }}>
        <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>
          Team ID (opcional)
        </label>
        <Input
          value={form.teamId}
          onChange={set("teamId")}
          placeholder="ID da equipe (deixar em branco para importar para toda a UBS)"
          style={{ width: "100%", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>
          Observações
        </label>
        <textarea
          value={form.notes}
          onChange={set("notes")}
          placeholder="Contexto adicional sobre esta migração..."
          rows={3}
          style={{
            width: "100%", padding: "0.45rem 0.6rem", borderRadius: "6px",
            fontSize: "0.875rem", border: "1px solid var(--color-border,#d1d5db)",
            background: "var(--color-surface,#fff)", boxSizing: "border-box", resize: "vertical",
          }}
        />
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Criando Import Job..." : "Criar Import Job"}
      </Button>
    </form>
  );
}

// ── FASE 4-10: Import Job Detail ───────────────────────────────────────────

function ImportJobDetail({ token, jobId, onBack }) {
  const [job, setJob]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [subview, setSubview] = useState("overview");

  // Upload state (FASE 4)
  const [file, setFile]             = useState(null);
  const [fileError, setFileError]   = useState("");
  const [uploading, setUploading]   = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileRef = useRef(null);

  // Staging state (FASE 6)
  const [staging, setStaging]           = useState(null);
  const [stagingLoading, setStagingLoading] = useState(false);

  // Homologation state (FASE 7 + 8)
  const [decision, setDecision]           = useState("");
  const [justification, setJustification] = useState("");
  const [homoError, setHomoError]         = useState("");
  const [homoBusy, setHomoBusy]           = useState(false);

  // Commit state (FASE 9)
  const [commitBusy, setCommitBusy]     = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [commitError, setCommitError]   = useState("");

  const loadJob = useCallback(() => {
    setLoading(true);
    apiFetch(`/import/jobs/${jobId}`, token)
      .then(setJob)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId, token]);

  useEffect(() => { loadJob(); }, [loadJob]);

  async function loadStaging() {
    setStagingLoading(true);
    try {
      const data = await apiFetch(`/import/staging/${jobId}/stats`, token);
      setStaging(data);
    } catch (e) {
      setStaging({ error: e.message });
    } finally {
      setStagingLoading(false);
    }
  }

  useEffect(() => {
    if (subview === "staging" || subview === "homologation") loadStaging();
  }, [subview]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(e) {
    e.preventDefault();
    setFileError(""); setUploadResult(null);
    if (!file) { setFileError("Selecione um arquivo JSON."); return; }
    setUploading(true);
    try {
      const text = await file.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        setFileError("Arquivo inválido — deve ser JSON válido.");
        setUploading(false);
        return;
      }
      const result = await apiFetch(`/import/jobs/${jobId}/run`, token, {
        method: "POST",
        body: JSON.stringify({ payload }),
      });
      setUploadResult(result);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      loadJob();
    } catch (err) {
      setFileError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleHomologation(e) {
    e.preventDefault();
    setHomoError("");
    if (!decision) { setHomoError("Selecione GO ou NO_GO."); return; }
    if (justification.trim().length < 10) { setHomoError("Justificativa mínima de 10 caracteres."); return; }
    if (!window.confirm(`Confirmar decisão: ${decision}?\n\nJustificativa: ${justification}`)) return;
    setHomoBusy(true);
    try {
      await apiFetch(`/import/jobs/${jobId}/homologate`, token, {
        method: "POST",
        body: JSON.stringify({ decision, justification }),
      });
      setDecision(""); setJustification("");
      loadJob();
      setSubview("overview");
    } catch (err) {
      setHomoError(err.message);
    } finally {
      setHomoBusy(false);
    }
  }

  async function handleCommit() {
    setCommitError(""); setCommitResult(null);
    if (!window.confirm("Executar commit? Esta operação não pode ser desfeita após 48 horas.")) return;
    setCommitBusy(true);
    try {
      const result = await apiFetch(`/import/jobs/${jobId}/commit`, token, { method: "POST" });
      setCommitResult(result);
      loadJob();
    } catch (err) {
      setCommitError(err.message);
    } finally {
      setCommitBusy(false);
    }
  }

  if (loading) return <div style={{ color: "var(--color-text-secondary,#6b7280)", padding: "2rem 0" }}>Carregando Import Job...</div>;
  if (error)   return <Alert type="error">{error}</Alert>;
  if (!job)    return null;

  const stats = job.stats || {};
  const canRun        = ["received", "mapping"].includes(job.status);
  const canHomologate = job.status === "homologating";
  const canCommit     = job.status === "homologating" && job.homologationResult === "GO";
  const isTerminal    = ["committed", "discarded", "failed"].includes(job.status);

  const tabs = [
    { id: "overview",     label: "Visão Geral",  disabled: false },
    { id: "upload",       label: "Upload",        disabled: isTerminal || !canRun },
    { id: "staging",      label: "Staging",       disabled: !["staging", "homologating", "committed"].includes(job.status) },
    { id: "homologation", label: "Homologação",   disabled: !canHomologate, dot: canHomologate ? "#f59e0b" : null },
    { id: "commit",       label: "Commit",        disabled: !canCommit, dot: canCommit ? "#10b981" : null },
    { id: "audit",        label: "Auditoria",     disabled: false },
  ];

  const tabBtnStyle = (t) => ({
    padding: "0.45rem 0.9rem", background: "none", border: "none",
    cursor: t.disabled ? "default" : "pointer", fontSize: "0.85rem",
    fontWeight: subview === t.id ? 700 : 400,
    color: t.disabled ? "#d1d5db" : subview === t.id ? "var(--color-primary,#2563eb)" : "var(--color-text,#374151)",
    borderBottom: subview === t.id ? "2px solid var(--color-primary,#2563eb)" : "2px solid transparent",
    marginBottom: "-2px", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.3rem",
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
        <BackButton onClick={onBack} />
        <code style={{ fontWeight: 700, fontSize: "0.95rem" }}>{job.id.slice(0, 8)}…</code>
        <JobStatusBadge status={job.status} />
        <span style={{ color: "var(--color-text-secondary,#6b7280)", fontSize: "0.82rem" }}>
          {job.sourceSystem}
        </span>
        <button
          type="button"
          onClick={loadJob}
          style={{ background: "none", border: "1px solid var(--color-border,#d1d5db)", borderRadius: "4px", padding: "0.2rem 0.5rem", cursor: "pointer", fontSize: "0.78rem", marginLeft: "auto" }}
        >
          ↻
        </button>
      </div>

      {/* Sub-navigation */}
      <div style={{ display: "flex", gap: "0.1rem", borderBottom: "2px solid var(--color-border,#e5e7eb)", marginBottom: "1.25rem", overflowX: "auto" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={t.disabled}
            onClick={() => !t.disabled && setSubview(t.id)}
            style={tabBtnStyle(t)}
          >
            {t.label}
            {t.dot && (
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.dot, display: "inline-block" }} />
            )}
          </button>
        ))}
      </div>

      {/* ── VISÃO GERAL ── */}
      {subview === "overview" && (
        <div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
            <StatBlock label="Brutos"     value={stats.totalRaw} />
            <StatBlock label="Mapeados"   value={stats.mapped} />
            <StatBlock label="Validados"  value={stats.validated} />
            <StatBlock label="Selecionados" value={stats.selected} />
            <StatBlock label="Em staging" value={stats.staged} />
            <StatBlock label="Commitados" value={stats.committed} color="#10b981" />
            <StatBlock label="Rejeitados" value={stats.rejected}  color="#ef4444" />
          </div>

          <div style={{ background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary,#6b7280)", marginBottom: "0.75rem" }}>Dados do Import Job</div>
            <InfoRow label="ID completo"   value={job.id} mono />
            <InfoRow label="Origem"        value={job.sourceSystem || job.sourceProfileId} />
            <InfoRow label="Source Profile" value={job.sourceProfileId} mono />
            <InfoRow label="UBS"           value={job.unitId} mono />
            <InfoRow label="Equipe"        value={job.teamId} mono />
            <InfoRow label="Responsável"   value={job.createdBy} />
            <InfoRow label="LGPD Consent ID" value={job.lgpdConsentRecordId} mono />
            <InfoRow label="Criado em"     value={fmtDate(job.createdAt)} />
            <InfoRow label="Atualizado em" value={fmtDate(job.updatedAt)} />
          </div>

          {job.errors && job.errors.length > 0 && (
            <div style={{ background: "#fff8f8", border: "1px solid #fca5a5", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#991b1b", marginBottom: "0.5rem" }}>
                Erros registrados ({job.errors.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {job.errors.slice(0, 50).map((err, i) => (
                  <div key={i} style={{ fontSize: "0.78rem", fontFamily: "monospace", padding: "0.2rem 0", borderBottom: "1px solid #fee2e2" }}>
                    [{err.stage}]{err.sourceId ? ` ID ${err.sourceId}:` : ""}{err.field ? ` ${err.field}:` : ""} {err.reason || err.message || JSON.stringify(err)}
                  </div>
                ))}
                {job.errors.length > 50 && (
                  <div style={{ fontSize: "0.75rem", color: "#991b1b", marginTop: "0.3rem" }}>
                    + {job.errors.length - 50} erros adicionais
                  </div>
                )}
              </div>
            </div>
          )}

          {canRun && (
            <Alert type="info">Próxima ação: aba <strong>Upload</strong> — envie o arquivo de dados para iniciar o pipeline.</Alert>
          )}
          {canHomologate && !canCommit && (
            <Alert type="warning">Aguarda homologação. Revise o <strong>Staging</strong> e emita decisão na aba <strong>Homologação</strong>.</Alert>
          )}
          {canCommit && (
            <Alert type="success">Homologação GO aprovada. Acesse <strong>Commit</strong> para executar a carga em produção.</Alert>
          )}
          {job.status === "committed" && (
            <Alert type="success">Migração concluída. Dados em produção. Audit hash registrado.</Alert>
          )}
          {job.status === "failed" && (
            <Alert type="error">Pipeline falhou. Verifique os erros acima e crie uma nova migração corrigida.</Alert>
          )}
        </div>
      )}

      {/* ── UPLOAD — FASE 4 ── */}
      {subview === "upload" && (
        <form onSubmit={handleUpload}>
          <div style={{ background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.5rem" }}>Enviar Arquivo de Dados</div>
            <div style={{ fontSize: "0.82rem", color: "var(--color-text-secondary,#6b7280)", marginBottom: "1rem", lineHeight: 1.5 }}>
              Formato: <strong>JSON</strong>. Estrutura esperada:
              <code style={{ display: "block", fontFamily: "monospace", background: "#f3f4f6", padding: "0.5rem 0.75rem", borderRadius: "4px", marginTop: "0.4rem", fontSize: "0.78rem" }}>
                {`{ "pacientes": [...], "eventos": [...] }`}
              </code>
              Para CSV, XML ou outros formatos, converta para JSON antes do envio.
            </div>

            <div
              style={{ border: "2px dashed var(--color-border,#d1d5db)", borderRadius: "8px", padding: "1.75rem", textAlign: "center", marginBottom: "1rem", cursor: "pointer", transition: "border-color 0.15s" }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) { setFile(f); setFileError(""); setUploadResult(null); }
              }}
            >
              {file ? (
                <div>
                  <div style={{ fontWeight: 600 }}>{file.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary,#6b7280)", marginTop: "0.2rem" }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--color-text-secondary,#6b7280)" }}>
                  Clique para selecionar arquivo JSON
                  <br />
                  <small>ou arraste e solte aqui</small>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  setFile(e.target.files[0] || null);
                  setFileError(""); setUploadResult(null);
                }}
              />
            </div>

            {fileError && <Alert type="error" style={{ marginBottom: "0.75rem" }}>{fileError}</Alert>}

            {uploadResult && (
              <Alert type="success" style={{ marginBottom: "0.75rem" }}>
                Pipeline executado. Em staging: <strong>{uploadResult.staged?.patients?.length ?? "—"}</strong> pacientes, <strong>{uploadResult.staged?.events?.length ?? "—"}</strong> eventos.
                {uploadResult.validationResult?.shouldPause && (
                  <div style={{ marginTop: "0.3rem", color: "#92400e", fontWeight: 600 }}>
                    ⚠ Threshold de pausa atingido — revise os dados antes de homologar.
                  </div>
                )}
              </Alert>
            )}

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Button type="submit" disabled={uploading || !file}>
                {uploading ? "Enviando e processando..." : "Enviar e executar pipeline"}
              </Button>
              {file && (
                <button
                  type="button"
                  onClick={() => { setFile(null); setFileError(""); if (fileRef.current) fileRef.current.value = ""; }}
                  style={{ background: "none", border: "1px solid var(--color-border,#d1d5db)", borderRadius: "6px", padding: "0.35rem 0.7rem", cursor: "pointer", fontSize: "0.82rem" }}
                >
                  Remover arquivo
                </button>
              )}
            </div>
          </div>

          <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary,#6b7280)", background: "#f9fafb", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "6px", padding: "0.75rem" }}>
            <strong>LGPD:</strong> O payload bruto não é armazenado. Apenas o hash SHA-256 é persistido em <code style={{ fontFamily: "monospace" }}>app_import_raw</code> (minimização — Art. 6º, III LGPD).
          </div>
        </form>
      )}

      {/* ── STAGING — FASE 6 ── */}
      {subview === "staging" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
            <button
              type="button"
              onClick={loadStaging}
              style={{ background: "none", border: "1px solid var(--color-border,#d1d5db)", borderRadius: "4px", padding: "0.2rem 0.5rem", cursor: "pointer", fontSize: "0.78rem" }}
            >
              ↻ Atualizar
            </button>
          </div>

          {stagingLoading && (
            <div style={{ color: "var(--color-text-secondary,#6b7280)", fontSize: "0.875rem" }}>Carregando staging...</div>
          )}
          {staging?.error && <Alert type="error">{staging.error}</Alert>}

          {staging && !staging.error && (
            <>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
                <StatBlock label="Pacientes"          value={staging.staging?.totalPatients} />
                <StatBlock label="Eventos"            value={staging.staging?.totalEvents} />
                <StatBlock label="Merge candidatos"   value={staging.staging?.mergeCandidate}    color="#f59e0b" />
                <StatBlock label="Perfil incompleto"  value={staging.staging?.incompleteProfile} color="#f97316" />
                <StatBlock label="Válidos"            value={staging.staging?.byValidationStatus?.valid}     color="#10b981" />
                <StatBlock label="Com avisos"         value={staging.staging?.byValidationStatus?.warning}   color="#f59e0b" />
                <StatBlock label="Rejeitados"         value={staging.staging?.byValidationStatus?.rejected}  color="#ef4444" />
              </div>

              {(staging.staging?.mergeCandidate ?? 0) > 0 && (
                <Alert type="warning" style={{ marginBottom: "0.75rem" }}>
                  <strong>{staging.staging.mergeCandidate} merge candidatos</strong> — pacientes com CPF ou CNS já existentes em produção. O commit atualizará os registros existentes (não criará duplicatas).
                </Alert>
              )}
              {(staging.staging?.incompleteProfile ?? 0) > 0 && (
                <Alert type="warning" style={{ marginBottom: "0.75rem" }}>
                  <strong>{staging.staging.incompleteProfile} perfis incompletos</strong> — pacientes sem CPF nem CNS. Serão migrados com flag <code>incompleteProfile=true</code>.
                </Alert>
              )}

              {canHomologate && (
                <Alert type="info">
                  Revise os dados acima. Acesse a aba <strong>Homologação</strong> para emitir GO ou NO_GO.
                </Alert>
              )}
            </>
          )}
        </div>
      )}

      {/* ── HOMOLOGAÇÃO — FASE 7 + 8 ── */}
      {subview === "homologation" && (
        <form onSubmit={handleHomologation}>
          <div style={{ background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.75rem" }}>Decisão de Homologação</div>

            {staging && !staging.error && (
              <div style={{ background: "#f9fafb", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem", fontSize: "0.82rem" }}>
                <strong>Resumo do staging:</strong>{" "}
                {staging.staging?.totalPatients ?? 0} pacientes, {staging.staging?.totalEvents ?? 0} eventos.
                {(staging.staging?.mergeCandidate ?? 0) > 0 && (
                  <span style={{ color: "#f59e0b", marginLeft: "0.4rem" }}>
                    {staging.staging.mergeCandidate} merge candidatos.
                  </span>
                )}
                {(staging.staging?.incompleteProfile ?? 0) > 0 && (
                  <span style={{ color: "#f97316", marginLeft: "0.4rem" }}>
                    {staging.staging.incompleteProfile} perfis incompletos.
                  </span>
                )}
              </div>
            )}

            <div style={{ marginBottom: "0.875rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.5rem" }}>
                Decisão *
              </label>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {[
                  { val: "GO",    label: "GO — Aprovar migração", active: "#10b981", activeText: "#065f46" },
                  { val: "NO_GO", label: "NO_GO — Rejeitar",      active: "#ef4444", activeText: "#991b1b" },
                ].map(({ val, label, active, activeText }) => (
                  <label
                    key={val}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer",
                      padding: "0.6rem 1rem",
                      border: `2px solid ${decision === val ? active : "var(--color-border,#d1d5db)"}`,
                      borderRadius: "6px",
                      fontWeight: decision === val ? 700 : 400,
                      color: decision === val ? activeText : "inherit",
                    }}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value={val}
                      checked={decision === val}
                      onChange={(e) => setDecision(e.target.value)}
                      style={{ accentColor: active }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>
                Justificativa *
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Descreva o motivo da decisão (mínimo 10 caracteres)..."
                rows={4}
                style={{
                  width: "100%", padding: "0.45rem 0.6rem", borderRadius: "6px",
                  fontSize: "0.875rem", border: "1px solid var(--color-border,#d1d5db)",
                  background: "var(--color-surface,#fff)", boxSizing: "border-box", resize: "vertical",
                }}
              />
              <small style={{ color: "var(--color-text-secondary,#6b7280)", fontSize: "0.75rem" }}>
                Esta justificativa é registrada permanentemente no audit trail.
              </small>
            </div>

            {homoError && <Alert type="error" style={{ marginBottom: "0.75rem" }}>{homoError}</Alert>}

            <Button
              type="submit"
              disabled={homoBusy}
              style={decision === "GO" ? { background: "#10b981" } : decision === "NO_GO" ? { background: "#ef4444" } : {}}
            >
              {homoBusy
                ? "Registrando decisão..."
                : decision
                  ? `Confirmar ${decision}`
                  : "Selecionar decisão acima"}
            </Button>
          </div>

          <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary,#6b7280)", background: "#f9fafb", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "6px", padding: "0.75rem" }}>
            <strong>Four-Eyes:</strong> A decisão GO/NO_GO deve ser emitida pelo gestor responsável pela UBS destino, não pelo operador técnico que executou o pipeline. Ambos os userIds são registrados separadamente.
          </div>
        </form>
      )}

      {/* ── COMMIT — FASE 9 ── */}
      {subview === "commit" && (
        <div>
          <div style={{ background: "var(--color-surface,#fff)", border: "2px solid #10b981", borderRadius: "8px", padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#065f46", marginBottom: "0.75rem" }}>
              Commit Controlado — GO Aprovado
            </div>

            <InfoRow label="Homologado por" value={job.homologatedBy} />
            <InfoRow label="Homologado em"  value={fmtDate(job.homologatedAt)} />
            <InfoRow label="Decisão"        value="GO" />

            <div style={{ background: "#fff8f8", border: "1px solid #fca5a5", borderRadius: "6px", padding: "0.75rem", margin: "0.75rem 0", fontSize: "0.82rem" }}>
              <strong style={{ color: "#991b1b" }}>Atenção:</strong> O commit é irreversível após 48 horas. Verifique o Staging antes de prosseguir. Pacientes migrados receberão <code style={{ fontFamily: "monospace" }}>importJobId</code> para rastreabilidade.
            </div>

            {commitResult && (
              <Alert type="success" style={{ marginBottom: "0.75rem" }}>
                Commit concluído. <strong>{commitResult.committed}</strong> pacientes migrados para produção.
                <br />
                Audit Hash: <code style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{commitResult.auditHash}</code>
              </Alert>
            )}

            {commitError && <Alert type="error" style={{ marginBottom: "0.75rem" }}>{commitError}</Alert>}

            {job.status !== "committed" && (
              <Button onClick={handleCommit} disabled={commitBusy} style={{ background: "#10b981" }}>
                {commitBusy ? "Executando commit..." : "Executar Commit em Produção"}
              </Button>
            )}

            {job.status === "committed" && (
              <div style={{ fontWeight: 700, color: "#065f46", fontSize: "0.875rem" }}>
                ✓ Commit executado. Dados em produção. Rollback disponível em até 48 horas via import job ID.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AUDITORIA — FASE 10 ── */}
      {subview === "audit" && (
        <div style={{ background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "1.25rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary,#6b7280)", marginBottom: "0.75rem" }}>
            Trilha de Auditoria
          </div>
          <InfoRow label="Import Job ID"    value={job.id} mono />
          <InfoRow label="Source Profile"   value={job.sourceProfileId} mono />
          <InfoRow label="Sistema de Origem" value={job.sourceSystem} />
          <InfoRow label="UBS Destino"      value={job.unitId} mono />
          <InfoRow label="Equipe"           value={job.teamId} mono />
          <InfoRow label="Responsável"      value={job.createdBy} />
          <InfoRow label="LGPD Consent ID"  value={job.lgpdConsentRecordId} mono />
          <InfoRow label="Status"           value={<JobStatusBadge status={job.status} />} />
          <InfoRow label="Criado em"        value={fmtDate(job.createdAt)} />
          <InfoRow label="Atualizado em"    value={fmtDate(job.updatedAt)} />

          {job.homologationResult && (
            <>
              <Divider />
              <InfoRow label="Resultado homologação" value={job.homologationResult} />
              <InfoRow label="Homologado por"        value={job.homologatedBy} />
              <InfoRow label="Homologado em"         value={fmtDate(job.homologatedAt)} />
            </>
          )}

          {job.commitAt && (
            <>
              <Divider />
              <InfoRow label="Commit em"           value={fmtDate(job.commitAt)} />
              <InfoRow label="Audit Hash"          value={job.auditHash} mono />
              <InfoRow label="Pacientes commitados" value={job.stats?.committed} />
            </>
          )}

          {job.errors && job.errors.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <Divider />
              <div style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.4rem" }}>
                Erros registrados ({job.errors.length})
              </div>
              <div style={{ maxHeight: 160, overflowY: "auto", fontFamily: "monospace", fontSize: "0.75rem", background: "#f9fafb", padding: "0.5rem", borderRadius: "4px" }}>
                {job.errors.map((err, i) => (
                  <div key={i} style={{ borderBottom: "1px solid #f3f4f6", padding: "0.2rem 0" }}>
                    [{err.stage}] {JSON.stringify(err)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────

export default function ImportConsole({ token }) {
  const [view, setView]             = useState("list");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [listKey, setListKey]       = useState(0);

  function goToDetail(jobId) {
    setSelectedJobId(jobId);
    setView("job-detail");
  }

  function goToList() {
    setSelectedJobId(null);
    setView("list");
    setListKey((k) => k + 1);
  }

  function afterNew(jobId) {
    setSelectedJobId(jobId);
    setView("job-detail");
  }

  return (
    <div>
      {view === "list" && (
        <ImportJobList token={token} onSelect={goToDetail} onNew={() => setView("new")} refreshKey={listKey} />
      )}
      {view === "new" && (
        <NewImportJobForm token={token} onDone={afterNew} onBack={goToList} />
      )}
      {view === "job-detail" && selectedJobId && (
        <ImportJobDetail token={token} jobId={selectedJobId} onBack={goToList} />
      )}
    </div>
  );
}
