import { useState, useMemo } from "react";
import { ageInMonths } from "../utils/clinical";
import Button from "../components/ui/Button";

const LAYOUT_VERSION = "3.2.3";
const LAYOUT_VIGENCIA = "jan/2024";

// ── pre-validation ──────────────────────────────────────────────────────────

function validatePatient(p) {
  const issues = [];
  if (!p.name || !String(p.name).trim())         issues.push({ field: "Nome", msg: "Nome obrigatório" });
  if (!p.birthDate)                               issues.push({ field: "Data de nascimento", msg: "Data de nascimento obrigatória" });
  if (!p.gender && !p.sex)                        issues.push({ field: "Sexo", msg: "Sexo biológico obrigatório no e-SUS" });
  if (!p.cns && !p.cpf && !p.document)           issues.push({ field: "Identificação", msg: "CNS ou CPF recomendado" });
  if (!p.address && !p.street && !p.microarea)    issues.push({ field: "Endereço/Microárea", msg: "Endereço ou microárea ausente" });
  return issues;
}

function validateUser(u) {
  const issues = [];
  if (!u.cnsProfissional && !u.cns)               issues.push({ field: "CNS Profissional", msg: "CNS do profissional ausente" });
  if (!u.cboCodigo)                               issues.push({ field: "CBO", msg: "Código CBO ausente" });
  return issues;
}

// ── component ──────────────────────────────────────────────────────────────

function EsusMirror({ patients = [], users = [], agenda = [], referrals = [], pharmacyLog = [], period, periodLabel }) {
  const [copied, setCopied]         = useState("");
  const [showQuality, setShowQuality] = useState(false);

  const now = new Date();
  function inPeriod(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (period === "month")   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === "quarter") { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear(); }
    return d.getFullYear() === now.getFullYear();
  }

  const monthNum    = String(now.getMonth() + 1).padStart(2, "0");
  const yearNum     = now.getFullYear();
  const competencia = `${monthNum}/${yearNum}`;

  const consultasDone = agenda.filter(a => inPeriod(a.date) && a.status === "done" && a.type === "consultation").length;
  const retornosDone  = agenda.filter(a => inPeriod(a.date) && a.status === "done" && a.type === "return").length;
  const procedimentos = agenda.filter(a => inPeriod(a.date) && a.status === "done" && a.type === "procedure").length;

  const doctors = users.filter(u => ["doctor"].includes(u.role));
  const nurses  = users.filter(u => ["nurse_manager", "nursing_tech"].includes(u.role));
  const acs     = users.filter(u => u.role === "acs");

  const faiTotal  = consultasDone + retornosDone + procedimentos;
  const encTotal  = referrals.filter(r => inPeriod(r.createdAt)).length;
  const dispensas = pharmacyLog.filter(l => l.type === "dispensa" && inPeriod(l.ts)).length;
  const gestantes = patients.filter(p => String(p.careCategory || "").toLowerCase() === "pregnant").length;
  const criancas  = patients.filter(p => { const am = ageInMonths(p.birthDate); return am !== null && am < 60; }).length;

  // ── quality analysis ─────────────────────────────────────────────────────
  const patientIssues = useMemo(() => {
    const result = [];
    for (const p of patients) {
      const issues = validatePatient(p);
      if (issues.length) result.push({ id: p.id, name: p.name || "(sem nome)", issues });
    }
    return result;
  }, [patients]);

  const profIssues = useMemo(() => {
    const result = [];
    for (const u of users.filter(u => !u.inactive)) {
      const issues = validateUser(u);
      if (issues.length) result.push({ id: u.id, name: u.name || "(sem nome)", issues });
    }
    return result;
  }, [users]);

  const patientsApt     = patients.length - patientIssues.length;
  const patientsPend    = patientIssues.filter(p => p.issues.some(i => !i.msg.includes("recomendado"))).length;
  const patientsWarn    = patientIssues.filter(p => p.issues.every(i => i.msg.includes("recomendado"))).length;
  const profApt         = users.filter(u => !u.inactive).length - profIssues.length;
  const conformidade    = patients.length > 0 ? Math.round(patientsApt / patients.length * 100) : 100;

  // ── copy helpers ─────────────────────────────────────────────────────────
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

  const fullReport = `ESPELHO e-SUS/RNDS — ${periodLabel.toUpperCase()}
Layout: v${LAYOUT_VERSION} (vigência: ${LAYOUT_VIGENCIA})
Competência: ${competencia}
Gerado em: ${new Date().toLocaleString("pt-BR")}

=== CADASTROS ===
Total de pacientes cadastrados: ${patients.length}
  - Aptos para exportação: ${patientsApt}
  - Com pendências: ${patientsPend}
  - Com avisos: ${patientsWarn}
Gestantes acompanhadas: ${gestantes}
Crianças < 5 anos: ${criancas}

=== PRODUÇÃO AMBULATORIAL ===
Consultas médicas realizadas: ${consultasDone}
Retornos realizados: ${retornosDone}
Procedimentos: ${procedimentos}
Total FAI: ${faiTotal}
Encaminhamentos emitidos: ${encTotal}

=== EQUIPE ===
Médicos: ${doctors.length}
Enfermeiros/Téc.: ${nurses.length}
ACS: ${acs.length}
  - Profissionais aptos: ${profApt}
  - Com pendências: ${profIssues.length}

=== FARMÁCIA ===
Dispensações: ${dispensas}

=== QUALIDADE DOS DADOS ===
Índice de conformidade: ${conformidade}%
`;

  return (
    <div>
      {/* ── pré-validação ── */}
      <div className="esus-prevalidation">
        <div className="esus-prevalidation__header">
          <div>
            <span className="esus-prevalidation__title">Pré-validação para Exportação</span>
            <span className="esus-prevalidation__sub">Verificação dos dados antes da geração do arquivo e-SUS</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowQuality(v => !v)}>
            {showQuality ? "Ocultar detalhes" : "Ver detalhes"}
          </Button>
        </div>
        <div className="esus-prevalidation__grid">
          <div className={`esus-preval-card esus-preval-card--${patientsApt === patients.length ? "ok" : "warn"}`}>
            <span className="esus-preval-card__icon">{patientsApt === patients.length ? "✔" : "⚠"}</span>
            <span className="esus-preval-card__val">{patientsApt}</span>
            <span className="esus-preval-card__lbl">Pacientes aptos</span>
          </div>
          <div className={`esus-preval-card${patientsPend > 0 ? " esus-preval-card--error" : " esus-preval-card--ok"}`}>
            <span className="esus-preval-card__icon">{patientsPend > 0 ? "❌" : "✔"}</span>
            <span className="esus-preval-card__val">{patientsPend}</span>
            <span className="esus-preval-card__lbl">Com bloqueios</span>
          </div>
          <div className={`esus-preval-card${patientsWarn > 0 ? " esus-preval-card--warn" : " esus-preval-card--ok"}`}>
            <span className="esus-preval-card__icon">{patientsWarn > 0 ? "⚠" : "✔"}</span>
            <span className="esus-preval-card__val">{patientsWarn}</span>
            <span className="esus-preval-card__lbl">Com avisos</span>
          </div>
          <div className={`esus-preval-card${profIssues.length > 0 ? " esus-preval-card--warn" : " esus-preval-card--ok"}`}>
            <span className="esus-preval-card__icon">{profIssues.length > 0 ? "⚠" : "✔"}</span>
            <span className="esus-preval-card__val">{profApt}</span>
            <span className="esus-preval-card__lbl">Profissionais aptos</span>
          </div>
          <div className={`esus-preval-card esus-preval-card--${conformidade >= 90 ? "ok" : conformidade >= 70 ? "warn" : "error"}`}>
            <span className="esus-preval-card__icon">{conformidade >= 90 ? "✔" : "⚠"}</span>
            <span className="esus-preval-card__val">{conformidade}%</span>
            <span className="esus-preval-card__lbl">Conformidade</span>
          </div>
        </div>

        {showQuality && (
          <div className="esus-quality-detail">
            <h4 className="esus-quality-detail__title">Pacientes com pendências ({patientIssues.length})</h4>
            {patientIssues.length === 0 ? (
              <p className="muted small" style={{ color: "var(--success)" }}>✔ Todos os pacientes estão aptos para exportação.</p>
            ) : (
              <div className="esus-issues-list">
                {patientIssues.slice(0, 20).map(p => (
                  <div key={p.id} className="esus-issue-row">
                    <span className="esus-issue-row__name">{p.name}</span>
                    <span className="esus-issue-row__issues">
                      {p.issues.map((issue, i) => (
                        <span key={i} className={`esus-issue-tag${issue.msg.includes("recomendado") ? " esus-issue-tag--warn" : " esus-issue-tag--error"}`}>
                          {issue.field}: {issue.msg}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
                {patientIssues.length > 20 && (
                  <p className="muted small">... e mais {patientIssues.length - 20} pacientes com pendências. Corrija os cadastros antes de exportar.</p>
                )}
              </div>
            )}

            <h4 className="esus-quality-detail__title" style={{ marginTop: "var(--s-4)" }}>Profissionais com pendências ({profIssues.length})</h4>
            {profIssues.length === 0 ? (
              <p className="muted small" style={{ color: "var(--success)" }}>✔ Todos os profissionais estão aptos para exportação.</p>
            ) : (
              <div className="esus-issues-list">
                {profIssues.map(u => (
                  <div key={u.id} className="esus-issue-row">
                    <span className="esus-issue-row__name">{u.name}</span>
                    <span className="esus-issue-row__issues">
                      {u.issues.map((issue, i) => (
                        <span key={i} className="esus-issue-tag esus-issue-tag--error">
                          {issue.field}: {issue.msg}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── header ── */}
      <div className="esus-header">
        <div>
          <p className="esus-header__title">Espelho de Produção — e-SUS APS / RNDS</p>
          <p className="esus-header__sub">
            Competência: <strong>{competencia}</strong> · {periodLabel} · Layout <strong>v{LAYOUT_VERSION}</strong> (vigência {LAYOUT_VIGENCIA})
          </p>
        </div>
        <div className="esus-header__actions">
          <Button variant="secondary" size="sm" onClick={() => copyToClipboard(fullReport, "full")}>
            {copied === "full" ? "Copiado" : "Copiar relatório completo"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>Imprimir</Button>
        </div>
      </div>

      <div className="esus-sections">

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="esus-section-header esus-section-header--fci">
            <span className="esus-section-header__title">Ficha de Cadastro Individual (FCI)</span>
            <span className="esus-section-header__sub">Módulo CDS / e-SUS APS</span>
          </div>
          <table className="esus-table">
            <tbody>
              <Row label="Total de indivíduos cadastrados" code="FCI-001" value={patients.length} k="fci001" hint="Campo: Fichas de cadastro" />
              <Row label="Aptos para exportação"           code="FCI-APT" value={patientsApt}     k="fciApt" hint={`${conformidade}% de conformidade`} />
              <Row label="Gestantes em acompanhamento"     code="FCI-002" value={gestantes}        k="fci002" hint="Condição: Gestante" />
              <Row label="Crianças < 5 anos"               code="FCI-003" value={criancas}         k="fci003" hint="Faixa etária 0–59 meses" />
              <Row label="Total ACS cadastradores"         code="FCI-004" value={acs.length}       k="fci004" />
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="esus-section-header esus-section-header--fai">
            <span className="esus-section-header__title">Ficha de Atendimento Individual (FAI)</span>
            <span className="esus-section-header__sub">Módulo CDS / e-SUS APS</span>
          </div>
          <table className="esus-table">
            <tbody>
              <Row label="Consultas médicas realizadas" code="FAI-001" value={consultasDone} k="fai001" hint="Tipo: Consulta · Status: Concluído" />
              <Row label="Retornos realizados"          code="FAI-002" value={retornosDone}  k="fai002" hint="Tipo: Retorno · Status: Concluído" />
              <Row label="Procedimentos"                code="FAI-003" value={procedimentos} k="fai003" hint="Tipo: Procedimento" />
              <Row label="Total de atendimentos (FAI)"  code="FAI-TOT" value={faiTotal}      k="faitot" />
              <Row label="Encaminhamentos emitidos"     code="ENC-001" value={encTotal}      k="enc001" hint="Referência p/ especialista" />
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="esus-section-header esus-section-header--equipe">
            <span className="esus-section-header__title">Composição da Equipe</span>
            <span className="esus-section-header__sub">CNES / e-Gestor AB</span>
          </div>
          <table className="esus-table">
            <tbody>
              <Row label="Médicos"                       code="EQ-001" value={doctors.length}  k="eq001" />
              <Row label="Enfermeiros / Técnicos"        code="EQ-002" value={nurses.length}   k="eq002" />
              <Row label="Agentes Comunitários de Saúde" code="EQ-003" value={acs.length}      k="eq003" />
              <Row label="Total equipe"                  code="EQ-TOT" value={users.length}    k="eqtot" />
              <Row label="Profissionais aptos (CNS+CBO)" code="EQ-APT" value={profApt}         k="eqapt" hint={profIssues.length > 0 ? `${profIssues.length} com pendência` : "Todos aptos"} />
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="esus-section-header esus-section-header--farm">
            <span className="esus-section-header__title">Dispensação de Medicamentos</span>
            <span className="esus-section-header__sub">RNDS / HÓRUS</span>
          </div>
          <table className="esus-table">
            <tbody>
              <Row label="Total de dispensações" code="FARM-01" value={dispensas} k="farm01" hint="Registro HÓRUS / RNDS" />
            </tbody>
          </table>
        </div>

        <div className="esus-notice">
          <strong>Transparência:</strong> Os dados acima são gerados automaticamente a partir dos registros cadastrados no VITRAS APS e servem como <strong>referência de apoio</strong> para lançamento no e-SUS APS, RNDS e outros sistemas federais. O envio automático ao e-SUS dependerá da integração disponível no ambiente. Sempre confirme os dados com a equipe antes do envio oficial.
        </div>
        <div className="esus-notice" style={{ marginTop: "var(--s-2)", background: "var(--surface-2)" }}>
          <strong>Layout v{LAYOUT_VERSION}</strong> · Vigência: {LAYOUT_VIGENCIA} · Gerado em {new Date().toLocaleDateString("pt-BR")}. Este espelho é compatível com o layout e-SUS APS suportado pelo VITRAS APS. Versões anteriores do layout permanecem compatíveis com exportações via CDS individual.
        </div>
      </div>
    </div>
  );
}

export default EsusMirror;
