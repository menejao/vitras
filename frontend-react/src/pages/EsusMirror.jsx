import { useState, useMemo, useCallback, useEffect } from "react";
import { ageInMonths } from "../utils/clinical";
import Button from "../components/ui/Button";

const LAYOUT_VERSION = "3.2.3";
const LAYOUT_VIGENCIA = "jan/2024";

// ── client-side CNS/CPF validators (mirrors backend cds-validators.js) ──────

function isValidCns(cns) {
  if (!cns) return false;
  const digits = String(cns).replace(/\D/g, "");
  if (digits.length !== 15 || !/^[1289]/.test(digits)) return false;
  let total = 0;
  for (let i = 0; i < 15; i++) total += parseInt(digits[i], 10) * (15 - i);
  return total % 11 === 0;
}

function isValidCpf(cpf) {
  if (!cpf) return false;
  const digits = String(cpf).replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11); if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(digits[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11); if (d2 >= 10) d2 = 0;
  return d2 === parseInt(digits[10], 10);
}

function resolveSex(p) { return p?.sexAtBirth || p?.sex || p?.gender || null; }

// ── client-side pre-validation (mirrors backend, runs offline) ──────────────

function validatePatientLocal(p) {
  const blockers = [];
  const warnings = [];
  if (!p.name || !String(p.name).trim())                    blockers.push({ field: "Nome",              msg: "Nome obrigatório no e-SUS" });
  if (!p.birthDate)                                         blockers.push({ field: "Data de nascimento", msg: "Data de nascimento obrigatória" });
  if (!resolveSex(p))                                       blockers.push({ field: "Sexo",              msg: "Sexo biológico obrigatório (campo sexAtBirth)" });
  if (p.cns  && !isValidCns(p.cns))                        blockers.push({ field: "CNS",               msg: "CNS inválido — deve ter 15 dígitos (algoritmo oficial)" });
  if (p.cpf  && !isValidCpf(p.cpf))                        blockers.push({ field: "CPF",               msg: "CPF inválido — dígito verificador incorreto" });
  if (!p.cns && !p.cpf && !p.document)                     warnings.push({ field: "Identificação",     msg: "CNS ou CPF recomendados para evitar rejeição" });
  if (!p.address && !p.street && !p.microarea && !p.microArea) warnings.push({ field: "Endereço/Microárea", msg: "Endereço ou microárea ausente" });
  return { blockers, warnings };
}

function validateUserLocal(u) {
  const issues = [];
  if (!u.cnsProfissional && !u.cns) issues.push({ field: "CNS Profissional", msg: "CNS do profissional ausente" });
  if (!u.cboCodigo)                 issues.push({ field: "CBO",              msg: "Código CBO ausente" });
  return issues;
}

// ── api helpers ─────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}, token) {
  const { body, ...rest } = opts;
  const res = await fetch(path, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(rest.headers || {}) },
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

async function downloadBatch(token, month, year) {
  const res = await fetch("/export/cds/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    credentials: "include",
    body: JSON.stringify({ month, year }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Erro ${res.status}`);
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const cd   = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="([^"]+)"/);
  a.href     = url;
  a.download = match ? match[1] : `lote-esus-${year}${String(month).padStart(2,"0")}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  return {
    exported: res.headers.get("X-Batch-Exported"),
    skipped:  res.headers.get("X-Batch-Skipped"),
    batchId:  res.headers.get("X-Batch-Id"),
  };
}

// ── sub-components ──────────────────────────────────────────────────────────

function PrevalCard({ icon, value, label, tone }) {
  return (
    <div className={`esus-preval-card${tone ? ` esus-preval-card--${tone}` : ""}`}>
      <span className="esus-preval-card__icon">{icon}</span>
      <span className="esus-preval-card__val">{value}</span>
      <span className="esus-preval-card__lbl">{label}</span>
    </div>
  );
}

function BlockerList({ blockers }) {
  if (!blockers || blockers.length === 0) return null;
  return (
    <div className="esus-blockers">
      {blockers.map((b, i) => (
        <div key={i} className="esus-blocker-row">
          <span className="esus-blocker-row__icon">❌</span>
          <span className="esus-blocker-row__msg">{b}</span>
        </div>
      ))}
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

function EsusMirror({ patients = [], users = [], agenda = [], referrals = [], pharmacyLog = [], period, periodLabel, token }) {
  const now = new Date();

  // Batch export state
  const [batchMonth, setBatchMonth]     = useState(now.getMonth() + 1);
  const [batchYear,  setBatchYear]      = useState(now.getFullYear());
  const [validation, setValidation]     = useState(null);
  const [validating, setValidating]     = useState(false);
  const [validErr,   setValidErr]       = useState("");
  const [generating, setGenerating]     = useState(false);
  const [genErr,     setGenErr]         = useState("");
  const [genSuccess, setGenSuccess]     = useState("");
  const [history,    setHistory]        = useState([]);
  const [histLoading, setHistLoading]   = useState(false);
  const [showQuality, setShowQuality]   = useState(false);
  const [copied,     setCopied]         = useState("");

  // Espelho state
  function inPeriod(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (period === "month")   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === "quarter") { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear(); }
    return d.getFullYear() === now.getFullYear();
  }

  const monthNum    = String(now.getMonth() + 1).padStart(2, "0");
  const competencia = `${monthNum}/${now.getFullYear()}`;

  const consultasDone = agenda.filter(a => inPeriod(a.date) && a.status === "done" && a.type === "consultation").length;
  const retornosDone  = agenda.filter(a => inPeriod(a.date) && a.status === "done" && a.type === "return").length;
  const procedimentos = agenda.filter(a => inPeriod(a.date) && a.status === "done" && a.type === "procedure").length;
  const doctors  = users.filter(u => u.role === "doctor");
  const nurses   = users.filter(u => ["nurse_manager", "nursing_tech"].includes(u.role));
  const acs      = users.filter(u => u.role === "acs");
  const faiTotal = consultasDone + retornosDone + procedimentos;
  const encTotal = referrals.filter(r => inPeriod(r.createdAt)).length;
  const dispensas = pharmacyLog.filter(l => l.type === "dispensa" && inPeriod(l.ts)).length;
  const gestantes = patients.filter(p => String(p.careCategory || "").toLowerCase() === "pregnant").length;
  const criancas  = patients.filter(p => { const am = ageInMonths(p.birthDate); return am !== null && am < 60; }).length;

  // Client-side quality metrics
  const patientIssues = useMemo(() => {
    return patients.map(p => {
      const { blockers, warnings } = validatePatientLocal(p);
      return { id: p.id, name: p.name || "(sem nome)", blockers, warnings };
    }).filter(p => p.blockers.length || p.warnings.length);
  }, [patients]);

  const profIssues = useMemo(() => {
    return users.filter(u => !u.inactive).map(u => {
      const issues = validateUserLocal(u);
      return { id: u.id, name: u.name || "(sem nome)", issues };
    }).filter(p => p.issues.length);
  }, [users]);

  const patientsApt  = patients.length - patientIssues.filter(p => p.blockers.length > 0).length;
  const patientsBl   = patientIssues.filter(p => p.blockers.length > 0).length;
  const patientsWarn = patientIssues.filter(p => p.blockers.length === 0 && p.warnings.length > 0).length;
  const profApt      = users.filter(u => !u.inactive).length - profIssues.length;
  const conformidade = patients.length > 0 ? Math.round(patientsApt / patients.length * 100) : 100;

  // Load history
  const loadHistory = useCallback(async () => {
    if (!token) return;
    setHistLoading(true);
    try {
      const data = await apiFetch("/export/cds/batch/history", {}, token);
      setHistory(data.history || []);
    } catch { /* silent */ }
    finally { setHistLoading(false); }
  }, [token]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Validate competência via API
  async function handleValidate() {
    setValidating(true); setValidErr(""); setValidation(null); setGenSuccess("");
    try {
      const data = await apiFetch(`/export/cds/batch/validate?month=${batchMonth}&year=${batchYear}`, {}, token);
      setValidation(data);
    } catch (e) {
      setValidErr(e.message);
    } finally { setValidating(false); }
  }

  // Generate batch
  async function handleGenerate() {
    if (!validation?.canExport) return;
    setGenerating(true); setGenErr(""); setGenSuccess("");
    try {
      const result = await downloadBatch(token, batchMonth, batchYear);
      const msg = result.skipped && result.skipped !== "0"
        ? `Lote gerado com sucesso: ${result.exported} fichas exportadas, ${result.skipped} excluídas por inconsistência. O lote está pronto para importação no PEC e-SUS APS.`
        : `Lote gerado com sucesso: ${result.exported} fichas de Cadastro Individual. O lote está pronto para importação no PEC e-SUS APS.`;
      setGenSuccess(msg);
      await loadHistory();
    } catch (e) {
      setGenErr(e.message);
    } finally { setGenerating(false); }
  }

  // Copy helpers
  function copyToClipboard(text, key) {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(""), 1500); });
  }
  function CopyBtn({ value, k }) {
    return (
      <Button variant="ghost" size="sm" className={`esus-copy-btn${copied === k ? " is-copied" : ""}`} onClick={() => copyToClipboard(String(value), k)}>
        {copied === k ? "Copiado" : "Copiar"}
      </Button>
    );
  }
  function Row({ label, value, code, hint, k }) {
    return (
      <tr>
        <td className="esus-table__td-label">{label}</td>
        {code && <td className="esus-table__td-code">{code}</td>}
        <td className="esus-table__td-value">{value}</td>
        <td className="esus-table__td-copy"><CopyBtn value={value} k={k || label} /></td>
        {hint && <td className="esus-table__td-hint">{hint}</td>}
      </tr>
    );
  }

  // Year options
  const yearOptions = [];
  for (let y = now.getFullYear(); y >= 2024; y--) yearOptions.push(y);

  const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  return (
    <div>

      {/* ════════════════════════════════════════════════════════════
          BLOCO 1 — PAINEL DE QUALIDADE DOS DADOS
      ════════════════════════════════════════════════════════════ */}
      <div className="esus-prevalidation">
        <div className="esus-prevalidation__header">
          <div>
            <span className="esus-prevalidation__title">Painel de Qualidade dos Dados</span>
            <span className="esus-prevalidation__sub">Verificação local dos cadastros — atualizada com os dados carregados</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowQuality(v => !v)}>
            {showQuality ? "Ocultar detalhes" : "Ver detalhes"}
          </Button>
        </div>
        <div className="esus-prevalidation__grid">
          <PrevalCard icon={patientsApt === patients.length ? "✔" : "⚠"} value={patientsApt} label="Pacientes aptos" tone={patientsApt === patients.length ? "ok" : "warn"} />
          <PrevalCard icon={patientsBl > 0 ? "❌" : "✔"} value={patientsBl} label="Com bloqueios" tone={patientsBl > 0 ? "error" : "ok"} />
          <PrevalCard icon={patientsWarn > 0 ? "⚠" : "✔"} value={patientsWarn} label="Com avisos" tone={patientsWarn > 0 ? "warn" : "ok"} />
          <PrevalCard icon={profIssues.length > 0 ? "⚠" : "✔"} value={profApt} label="Profissionais aptos" tone={profIssues.length > 0 ? "warn" : "ok"} />
          <PrevalCard icon={conformidade >= 90 ? "✔" : "⚠"} value={`${conformidade}%`} label="Conformidade" tone={conformidade >= 90 ? "ok" : conformidade >= 70 ? "warn" : "error"} />
        </div>

        {showQuality && (
          <div className="esus-quality-detail">
            <h4 className="esus-quality-detail__title">Pacientes com pendências ({patientIssues.length})</h4>
            {patientIssues.length === 0 ? (
              <p className="muted small" style={{ color: "var(--success)" }}>✔ Todos os pacientes estão aptos para exportação.</p>
            ) : (
              <div className="esus-issues-list">
                {patientIssues.slice(0, 30).map(p => (
                  <div key={p.id} className="esus-issue-row">
                    <span className="esus-issue-row__name">{p.name}</span>
                    <span className="esus-issue-row__issues">
                      {[...p.blockers, ...p.warnings].map((issue, i) => (
                        <span key={i} className={`esus-issue-tag${p.blockers.includes(issue) ? " esus-issue-tag--error" : " esus-issue-tag--warn"}`}>
                          {issue.field}: {issue.msg}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
                {patientIssues.length > 30 && <p className="muted small">... e mais {patientIssues.length - 30} com pendências.</p>}
              </div>
            )}

            <h4 className="esus-quality-detail__title" style={{ marginTop: "var(--s-4)" }}>Profissionais com pendências ({profIssues.length})</h4>
            {profIssues.length === 0 ? (
              <p className="muted small" style={{ color: "var(--success)" }}>✔ Todos os profissionais estão aptos.</p>
            ) : (
              <div className="esus-issues-list">
                {profIssues.map(u => (
                  <div key={u.id} className="esus-issue-row">
                    <span className="esus-issue-row__name">{u.name}</span>
                    <span className="esus-issue-row__issues">
                      {u.issues.map((iss, i) => (
                        <span key={i} className="esus-issue-tag esus-issue-tag--error">{iss.field}: {iss.msg}</span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          BLOCO 2 — EXPORTAÇÃO EM LOTE
      ════════════════════════════════════════════════════════════ */}
      <div className="esus-batch-section">
        <div className="esus-batch-section__header">
          <div>
            <span className="esus-batch-section__title">Exportação em Lote por Competência</span>
            <span className="esus-batch-section__sub">Selecione a competência, valide os dados e gere o lote para importação no e-SUS APS</span>
          </div>
        </div>

        <div className="esus-batch-section__body">
          {/* Period selector */}
          <div className="esus-batch-period">
            <label className="esus-batch-label">Competência</label>
            <div className="esus-batch-period__selects">
              <select className="input" value={batchMonth} onChange={e => { setBatchMonth(Number(e.target.value)); setValidation(null); }}>
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select className="input" value={batchYear} onChange={e => { setBatchYear(Number(e.target.value)); setValidation(null); }}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <Button variant="secondary" size="sm" disabled={validating} onClick={handleValidate}>
                {validating ? "Validando..." : "Validar"}
              </Button>
            </div>
            {validErr && <div className="esus-batch-err">{validErr}</div>}
          </div>

          {/* Validation result */}
          {validation && (
            <div className="esus-validation-result">
              {/* Unit / team status */}
              <div className="esus-val-infos">
                <div className={`esus-val-info${validation.unit.cnesValid ? " esus-val-info--ok" : " esus-val-info--error"}`}>
                  <span className="esus-val-info__icon">{validation.unit.cnesValid ? "✔" : "❌"}</span>
                  <span className="esus-val-info__text">
                    <strong>CNES:</strong> {validation.unit.cnes || "não informado"} ({validation.unit.name || "unidade desconhecida"})
                    {!validation.unit.cnesValid && <span className="esus-val-info__fix">Cadastre o CNES da unidade para exportar.</span>}
                  </span>
                </div>
                <div className={`esus-val-info${validation.team.ineValid ? " esus-val-info--ok" : " esus-val-info--error"}`}>
                  <span className="esus-val-info__icon">{validation.team.ineValid ? "✔" : "❌"}</span>
                  <span className="esus-val-info__text">
                    <strong>INE:</strong> {validation.team.ine || "não informado"} ({validation.team.name || "equipe desconhecida"})
                    {!validation.team.ineValid && <span className="esus-val-info__fix">Cadastre o INE da equipe para exportar.</span>}
                  </span>
                </div>
                <div className={`esus-val-info${validation.professional.cnsValid && validation.professional.cboValid ? " esus-val-info--ok" : " esus-val-info--warn"}`}>
                  <span className="esus-val-info__icon">{validation.professional.cnsValid && validation.professional.cboValid ? "✔" : "⚠"}</span>
                  <span className="esus-val-info__text">
                    <strong>Profissional exportador:</strong> {validation.professional.name}
                    {!validation.professional.cnsValid && <span className="esus-val-info__fix"> CNS ausente.</span>}
                    {!validation.professional.cboValid  && <span className="esus-val-info__fix"> CBO ausente.</span>}
                  </span>
                </div>
              </div>

              {/* Blockers */}
              {validation.blockers.length > 0 && (
                <>
                  <h4 className="esus-val-section-title">Bloqueadores — a exportação está impedida</h4>
                  <BlockerList blockers={validation.blockers} />
                </>
              )}

              {/* Summary grid */}
              <h4 className="esus-val-section-title">Resumo da competência {validation.competencia}</h4>
              <div className="esus-prevalidation__grid" style={{ borderRadius: "var(--r-sm)", overflow: "hidden" }}>
                <PrevalCard icon={validation.patients.apt > 0 ? "✔" : "⚠"} value={validation.patients.apt} label="Pacientes aptos" tone={validation.patients.blocked === 0 ? "ok" : "warn"} />
                <PrevalCard icon={validation.patients.blocked > 0 ? "❌" : "✔"} value={validation.patients.blocked} label="Bloqueados" tone={validation.patients.blocked > 0 ? "error" : "ok"} />
                <PrevalCard icon={validation.patients.warned > 0 ? "⚠" : "✔"} value={validation.patients.warned} label="Com avisos" tone={validation.patients.warned > 0 ? "warn" : "ok"} />
                <PrevalCard icon={validation.professionals.apt === validation.professionals.total ? "✔" : "⚠"} value={validation.professionals.apt} label={`de ${validation.professionals.total} prof. aptos`} tone={validation.professionals.issues.length > 0 ? "warn" : "ok"} />
                <PrevalCard icon={validation.conformidade >= 90 ? "✔" : "⚠"} value={`${validation.conformidade}%`} label="Conformidade" tone={validation.conformidade >= 90 ? "ok" : validation.conformidade >= 70 ? "warn" : "error"} />
              </div>

              {/* Skipped details */}
              {validation.patients.issues.length > 0 && (
                <div className="esus-quality-detail" style={{ marginTop: "var(--s-3)" }}>
                  <h4 className="esus-quality-detail__title">
                    Registros excluídos da exportação ({validation.patients.blocked}) e com avisos ({validation.patients.warned})
                  </h4>
                  <div className="esus-issues-list">
                    {validation.patients.issues.slice(0, 20).map(p => (
                      <div key={p.id} className="esus-issue-row">
                        <span className="esus-issue-row__name">{p.name}</span>
                        <span className="esus-issue-row__issues">
                          {[...(p.blockers||[]), ...(p.warnings||[])].map((iss, i) => (
                            <span key={i} className={`esus-issue-tag${(p.blockers||[]).includes(iss) ? " esus-issue-tag--error" : " esus-issue-tag--warn"}`}>
                              {iss.field}: {iss.msg}
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                    {validation.patients.issues.length > 20 && <p className="muted small">... e mais {validation.patients.issues.length - 20} com pendências.</p>}
                  </div>
                </div>
              )}

              {/* Generate button */}
              {validation.canExport && (
                <div className="esus-batch-generate">
                  {genSuccess && <div className="esus-batch-success">{genSuccess}</div>}
                  {genErr     && <div className="esus-batch-err">{genErr}</div>}
                  {validation.patients.skipped > 0 && (
                    <div className="esus-batch-warn">
                      ⚠ {validation.patients.blocked} paciente(s) serão excluídos do lote por inconsistências. O gestor receberá a lista dos excluídos no cabeçalho do arquivo.
                    </div>
                  )}
                  <Button variant="primary" size="sm" disabled={generating} onClick={handleGenerate}>
                    {generating ? "Gerando lote..." : `Gerar Lote — ${String(batchMonth).padStart(2,"0")}/${batchYear}`}
                  </Button>
                  <span className="muted small" style={{ marginTop: "var(--s-1)", display: "block" }}>
                    Layout v{LAYOUT_VERSION} · {validation.patients.apt} fichas de Cadastro Individual
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transparency notice */}
        <div className="esus-notice" style={{ margin: "var(--s-3) var(--s-4)" }}>
          <strong>Como importar:</strong> Após o download, acesse o PEC e-SUS APS da unidade, vá em <em>Transmissão de dados → Importar</em> e selecione o arquivo ZIP gerado. O VITRAS gera o lote — a importação e transmissão ocorrem no PEC.
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          BLOCO 3 — HISTÓRICO DE EXPORTAÇÕES
      ════════════════════════════════════════════════════════════ */}
      <div className="esus-history-section">
        <div className="esus-history-section__header">
          <span className="esus-history-section__title">Histórico de Exportações</span>
          <Button variant="ghost" size="sm" disabled={histLoading} onClick={loadHistory}>
            {histLoading ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>

        {history.length === 0 ? (
          <p className="muted small" style={{ padding: "var(--s-3) var(--s-4)" }}>Nenhuma exportação realizada ainda.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="equipe-table" style={{ fontSize: "var(--t-xs)" }}>
              <thead>
                <tr>
                  <th>Competência</th>
                  <th>Data / Hora</th>
                  <th>Responsável</th>
                  <th>CNES</th>
                  <th>INE</th>
                  <th>Exportados</th>
                  <th>Excluídos</th>
                  <th>Layout</th>
                  <th>Status</th>
                  <th>ID do Lote</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td><strong>{h.competencia}</strong></td>
                    <td className="muted">{new Date(h.ts).toLocaleString("pt-BR")}</td>
                    <td>{h.exportedBy?.name || "—"}</td>
                    <td className="equipe-table__id">{h.cnes || "—"}</td>
                    <td className="equipe-table__id">{h.ine  || "—"}</td>
                    <td style={{ color: "var(--success)", fontWeight: 600 }}>{h.patientsExported}</td>
                    <td style={{ color: h.patientsSkipped > 0 ? "var(--warning)" : "var(--text-dim)" }}>{h.patientsSkipped}</td>
                    <td className="equipe-table__id">v{h.layoutVersion}</td>
                    <td>
                      <span className={`badge${h.status === "success" ? " badge--success" : h.status === "partial" ? "" : " badge--muted"}`}>
                        {h.status === "success" ? "Completo" : h.status === "partial" ? "Parcial" : h.status}
                      </span>
                    </td>
                    <td className="equipe-table__id">{String(h.id).slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          BLOCO 4 — ESPELHO DE PRODUÇÃO (referência para lançamento manual)
      ════════════════════════════════════════════════════════════ */}
      <div className="esus-header" style={{ marginTop: "var(--s-6)" }}>
        <div>
          <p className="esus-header__title">Espelho de Produção — e-SUS APS / RNDS</p>
          <p className="esus-header__sub">Competência: <strong>{competencia}</strong> · {periodLabel} · Layout <strong>v{LAYOUT_VERSION}</strong> ({LAYOUT_VIGENCIA})</p>
        </div>
        <div className="esus-header__actions">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>Imprimir</Button>
        </div>
      </div>

      <div className="esus-sections">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="esus-section-header esus-section-header--fci">
            <span className="esus-section-header__title">Ficha de Cadastro Individual (FCI)</span>
            <span className="esus-section-header__sub">Módulo CDS / e-SUS APS</span>
          </div>
          <table className="esus-table"><tbody>
            <Row label="Total de indivíduos cadastrados" code="FCI-001" value={patients.length}  k="fci001" hint="Campo: Fichas de cadastro" />
            <Row label="Aptos para exportação"           code="FCI-APT" value={patientsApt}      k="fciApt" hint={`${conformidade}% de conformidade`} />
            <Row label="Gestantes em acompanhamento"     code="FCI-002" value={gestantes}         k="fci002" hint="Condição: Gestante" />
            <Row label="Crianças < 5 anos"               code="FCI-003" value={criancas}          k="fci003" hint="Faixa etária 0–59 meses" />
            <Row label="Total ACS cadastradores"         code="FCI-004" value={acs.length}        k="fci004" />
          </tbody></table>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="esus-section-header esus-section-header--fai">
            <span className="esus-section-header__title">Ficha de Atendimento Individual (FAI)</span>
            <span className="esus-section-header__sub">Módulo CDS / e-SUS APS</span>
          </div>
          <table className="esus-table"><tbody>
            <Row label="Consultas médicas realizadas" code="FAI-001" value={consultasDone} k="fai001" hint="Tipo: Consulta · Status: Concluído" />
            <Row label="Retornos realizados"          code="FAI-002" value={retornosDone}  k="fai002" hint="Tipo: Retorno · Status: Concluído" />
            <Row label="Procedimentos"                code="FAI-003" value={procedimentos} k="fai003" hint="Tipo: Procedimento" />
            <Row label="Total de atendimentos (FAI)"  code="FAI-TOT" value={faiTotal}      k="faitot" />
            <Row label="Encaminhamentos emitidos"     code="ENC-001" value={encTotal}      k="enc001" hint="Referência p/ especialista" />
          </tbody></table>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="esus-section-header esus-section-header--equipe">
            <span className="esus-section-header__title">Composição da Equipe</span>
            <span className="esus-section-header__sub">CNES / e-Gestor AB</span>
          </div>
          <table className="esus-table"><tbody>
            <Row label="Médicos"                       code="EQ-001" value={doctors.length}  k="eq001" />
            <Row label="Enfermeiros / Técnicos"        code="EQ-002" value={nurses.length}   k="eq002" />
            <Row label="Agentes Comunitários de Saúde" code="EQ-003" value={acs.length}      k="eq003" />
            <Row label="Total equipe"                  code="EQ-TOT" value={users.length}    k="eqtot" />
            <Row label="Profissionais aptos (CNS+CBO)" code="EQ-APT" value={profApt}         k="eqapt" hint={profIssues.length > 0 ? `${profIssues.length} com pendência` : "Todos aptos"} />
          </tbody></table>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="esus-section-header esus-section-header--farm">
            <span className="esus-section-header__title">Dispensação de Medicamentos</span>
            <span className="esus-section-header__sub">RNDS / HÓRUS</span>
          </div>
          <table className="esus-table"><tbody>
            <Row label="Total de dispensações" code="FARM-01" value={dispensas} k="farm01" hint="Registro HÓRUS / RNDS" />
          </tbody></table>
        </div>

        <div className="esus-notice">
          <strong>Referência:</strong> Este espelho é gerado automaticamente a partir dos dados do VITRAS APS e serve como apoio para conferência antes da importação no e-SUS APS. Use o botão "Gerar Lote" acima para produzir os arquivos prontos para importação.
        </div>
        <div className="esus-notice" style={{ marginTop: "var(--s-2)", background: "var(--surface-2)" }}>
          <strong>Layout v{LAYOUT_VERSION}</strong> · Vigência: {LAYOUT_VIGENCIA} · Compatível com e-SUS APS / LEDI APS 7.4.0
        </div>
      </div>
    </div>
  );
}

export default EsusMirror;
