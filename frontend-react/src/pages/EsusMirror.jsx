import { useState } from "react";
import { ageInMonths } from "../utils/clinical";
import Button from "../components/ui/Button";

function EsusMirror({ patients, users, agenda = [], referrals = [], pharmacyLog = [], period, periodLabel }) {
  const [copied, setCopied] = useState("");

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

  function copyToClipboard(text, key) {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(""), 1500); });
  }

  function CopyBtn({ value, k }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={`esus-copy-btn${copied === k ? " is-copied" : ""}`}
        onClick={() => copyToClipboard(String(value), k)}
      >
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
Competência: ${competencia}
Gerado em: ${new Date().toLocaleString("pt-BR")}

=== CADASTROS ===
Total de pacientes cadastrados: ${patients.length}
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

=== FARMÁCIA ===
Dispensações: ${dispensas}
`;

  return (
    <div>
      <div className="esus-header">
        <div>
          <p className="esus-header__title">Espelho de Produção — e-SUS APS / RNDS</p>
          <p className="esus-header__sub">Competência: <strong>{competencia}</strong> · {periodLabel} · Use os valores abaixo para lançar no sistema federal.</p>
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
              <Row label="Consultas médicas realizadas"    code="FAI-001" value={consultasDone}  k="fai001" hint="Tipo: Consulta · Status: Concluído" />
              <Row label="Retornos realizados"             code="FAI-002" value={retornosDone}   k="fai002" hint="Tipo: Retorno · Status: Concluído" />
              <Row label="Procedimentos"                   code="FAI-003" value={procedimentos}  k="fai003" hint="Tipo: Procedimento" />
              <Row label="Total de atendimentos (FAI)"     code="FAI-TOT" value={faiTotal}       k="faitot" />
              <Row label="Encaminhamentos emitidos"        code="ENC-001" value={encTotal}       k="enc001" hint="Referência p/ especialista" />
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
              <Row label="Médicos"                       code="EQ-001" value={doctors.length} k="eq001" />
              <Row label="Enfermeiros / Técnicos"        code="EQ-002" value={nurses.length}  k="eq002" />
              <Row label="Agentes Comunitários de Saúde" code="EQ-003" value={acs.length}     k="eq003" />
              <Row label="Total equipe"                  code="EQ-TOT" value={users.length}   k="eqtot" />
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
          <strong>Importante:</strong> Este espelho é gerado automaticamente a partir dos dados registrados no Vitras e serve como <strong>referência de apoio</strong> para o lançamento no e-SUS APS, RNDS e outros sistemas federais. Sempre confira os dados com a equipe antes do envio oficial.
        </div>
      </div>
    </div>
  );
}

export default EsusMirror;
