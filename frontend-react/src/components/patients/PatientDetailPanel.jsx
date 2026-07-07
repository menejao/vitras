import { useEffect, useRef, useState } from "react";
import { createRecord, createTask, getHouseholds, createHousehold, patchHousehold, createExamRequest } from "../../api";
import { printExamRequest, printAttendanceAttest, printMedicalAttest } from "../../utils/printDoc";
import PrescriptionModal from "../prescription/PrescriptionModal";
import { parseLocalDate } from "../../utils/dates";
import { googleCalendarUrl } from "../../utils/dates";
import { initials } from "../../utils/formatting";
import { calcAge, catLabel, gestationalAgeInfo, isProfileIncomplete, suggestNextVisitDate } from "../../utils/clinical";
import { isAcs } from "../../utils/roles";
import { VACCINE_OPTIONS } from "../../config/constants";
import { inferVaccineDoseTitle } from "../../pages/VaccinesPage";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Checkbox from "../ui/Checkbox";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import DocumentModal from "../DocumentModal";
import { PatientCardModal } from "./PatientCardModal";

function fmtDate(value) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-";
}

function getCouncilLabel(user) {
  if (!user?.councilNumber) return "";
  const council = user.role === "doctor"
    ? "CRM"
    : user.role === "dentist"
    ? "CRO"
    : ["pharmacist", "pharmacy_tech"].includes(String(user.role || ""))
    ? "CFF"
    : "COREN";
  return `${council} ${user.councilNumber}/${user.councilUf || ""}`;
}

function formatExactAge(birthDate) {
  const birth = parseLocalDate(birthDate);
  if (!birth) return "";
  const now = new Date();
  let ay = now.getFullYear() - birth.getFullYear();
  let am = now.getMonth() - birth.getMonth();
  let ad = now.getDate() - birth.getDate();
  if (ad < 0) { am -= 1; ad += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (am < 0) { ay -= 1; am += 12; }
  return [ay > 0 ? `${ay}a` : null, am > 0 ? `${am}m` : null, ad > 0 ? `${ad}d` : null].filter(Boolean).join(" ") || "0d";
}

function ProgressBar({ label, done, goal }) {
  const pct = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  const color = pct >= 100 ? "var(--success)" : pct >= 60 ? "var(--warning)" : "var(--danger)";
  const chipCls = goal === 0 ? "proto-chip--na" : pct >= 100 ? "proto-chip--ok" : pct >= 60 ? "proto-chip--watch" : "proto-chip--critical";
  const chipLabel = goal === 0 ? "N/A" : pct >= 100 ? "Em dia" : pct >= 60 ? "Atenção" : "Crítico";
  return (
    <div className="protocol-progress">
      <div className="protocol-progress__head">
        <span className="protocol-progress__label">{label}</span>
        <div className="protocol-progress__meta">
          <span className="protocol-progress__count">{done}/{goal}</span>
          <span className={`proto-chip ${chipCls}`}>{chipLabel}</span>
        </div>
      </div>
      <div className="protocol-progress__track">
        <div className="protocol-progress__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ProtocolSkeleton() {
  return (
    <div className="skeleton-stack">
      <div className="skeleton-block" style={{ height: "2.8rem", borderRadius: "var(--r-md)" }} />
      <div className="skeleton-stack" style={{ gap: ".5rem" }}>
        <div className="skeleton-line" style={{ width: "40%", height: ".6rem" }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ marginBottom: ".6rem" }}>
            <div className="skeleton-row" style={{ marginBottom: ".35rem" }}>
              <div className="skeleton-line" style={{ flex: 1 }} />
              <div className="skeleton-line" style={{ width: "3.5rem" }} />
            </div>
            <div className="skeleton-block" style={{ height: "8px", borderRadius: "4px" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProtocolTab({ patient, alerts, protocolSummary, loading }) {
  if (loading) return <ProtocolSkeleton />;
  if (!protocolSummary) {
    return <Alert tone="info">Nenhum dado de protocolo disponivel para este paciente.</Alert>;
  }

  const cat = String(patient?.careCategory || "").toLowerCase();
  const lostIndicators = [];
  if (cat === "child_followup" && patient?.birthDate) {
    const birth = parseLocalDate(patient.birthDate);
    const now = new Date();
    const agedays = Math.floor((now - birth) / 86400000);
    const visits = Number(protocolSummary.completed?.visits ?? protocolSummary.visitsCompleted ?? 0);
    let ay = now.getFullYear() - birth.getFullYear();
    let am = now.getMonth() - birth.getMonth();
    let ad = now.getDate() - birth.getDate();
    if (ad < 0) { am--; ad += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (am < 0) { ay--; am += 12; }
    const idadeFmt = [ay > 0 ? `${ay}a` : null, am > 0 ? `${am}m` : null, ad > 0 ? `${ad}d` : null].filter(Boolean).join(" ") || "0d";
    const consultsDone = Number(protocolSummary.completed?.consultations ?? 0);
    const consultsTarget = Number(protocolSummary.targets?.consultations ?? 0);
    if (visits === 0 && agedays >= 31)
      lostIndicators.push({ msg: "1ª visita ACS — até o 1º mês de vida (prazo encerrado)", age: idadeFmt });
    if (agedays >= 181 && visits < 2)
      lostIndicators.push({ msg: "2ª visita ACS — do 2º ao 6º mês de vida (prazo encerrado)", age: idadeFmt });
    if (consultsTarget >= 1 && consultsDone === 0 && agedays >= 31)
      lostIndicators.push({ msg: "1ª consulta de puericultura — até o 1º mês de vida (prazo encerrado)", age: idadeFmt });
    if (consultsTarget >= 2 && consultsDone < 2 && agedays >= 181)
      lostIndicators.push({ msg: "2ª consulta de puericultura — do 2º ao 6º mês de vida (prazo encerrado)", age: idadeFmt });
  }

  const ALERT_ICON = {
    danger: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#dc2626"/><path d="M8 4.5v3.5M8 10.5h.01" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    warning: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M7.05 2.5c.42-.73 1.48-.73 1.9 0l5.3 9.17c.43.74-.1 1.66-.95 1.66H1.7c-.85 0-1.38-.92-.95-1.66L7.05 2.5z" fill="#f59e0b"/><path d="M8 6.5v3M8 11h.01" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/></svg>,
    info: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#0284c7"/><path d="M8 7v4M8 5.5h.01" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  };
  const ALERT_BADGE = { danger: "Crítico", warning: "Atenção", info: "Info" };

  return (
    <div className="pat-protocol">
      {lostIndicators.length > 0 && (
        <div className="pat-lost-block">
          <div className="pat-lost-block__head">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" fill="#7c3aed" fillOpacity=".15" stroke="#7c3aed" strokeWidth="1.2"/>
              <path d="M8 5v3.5M8 10.5h.01" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="pat-lost-block__label">
              Indicadores perdidos · Não recuperáveis · Idade: {lostIndicators[0].age}
            </span>
          </div>
          {lostIndicators.map((item) => (
            <div key={item.msg} className="pat-lost-item">
              <span className="pat-lost-item__dot" />
              <span>{item.msg}</span>
            </div>
          ))}
        </div>
      )}

      <div className="pat-protocol__bars">
        <span className="pat-section-label">Métricas de acompanhamento</span>
        <ProgressBar label="Visitas" done={protocolSummary.completed?.visits || 0} goal={protocolSummary.targets?.visits || 0} />
        <ProgressBar label="Consultas" done={protocolSummary.completed?.consultations || 0} goal={protocolSummary.targets?.consultations || 0} />
        <ProgressBar label="Vacinas" done={protocolSummary.completed?.vaccines || 0} goal={protocolSummary.targets?.vaccines || 0} />
      </div>

      {alerts?.length > 0 && (
        <div className="pat-alerts">
          <span className="pat-section-label">Alertas clínicos</span>
          {(() => {
            const critical = alerts.filter(a => a.severity === "high");
            const attention = alerts.filter(a => a.severity === "medium");
            const pending = alerts.filter(a => !a.severity || a.severity === "low");

            function renderAlert(alert, index) {
              const isRisk = alert.category === "risk";
              const sev = alert.severity === "high" ? "danger" : alert.severity === "medium" ? "warning" : "info";
              const badge = isRisk ? "Risco" : ALERT_BADGE[sev];
              return (
                <div key={alert.id || index} className={`pat-alert pat-alert--${sev}${isRisk ? " pat-alert--risk" : ""}`}>
                  <span className="pat-alert__icon-wrap">{ALERT_ICON[sev]}</span>
                  <div className="pat-alert__body">
                    <div className="pat-alert__title">{alert.title}</div>
                    {alert.detail ? <div className="pat-alert__detail">{alert.detail}</div> : null}
                  </div>
                  <span className="pat-alert__badge">{badge}</span>
                </div>
              );
            }

            return (
              <>
                {critical.length > 0 && (
                  <div className="pat-alert-group">
                    <span className="pat-alert-group__head pat-alert-group__head--danger">
                      Crítico · {critical.length}
                    </span>
                    {critical.map(renderAlert)}
                  </div>
                )}
                {attention.length > 0 && (
                  <div className="pat-alert-group">
                    <span className="pat-alert-group__head pat-alert-group__head--warning">
                      Atenção · {attention.length}
                    </span>
                    {attention.map(renderAlert)}
                  </div>
                )}
                {pending.length > 0 && (
                  <div className="pat-alert-group">
                    <span className="pat-alert-group__head pat-alert-group__head--info">
                      Pendente / A cumprir · {pending.length}
                    </span>
                    {pending.map(renderAlert)}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {alerts?.length === 0 && protocolSummary?.alertsRestricted && (
        <Alert tone="info">Alertas e avisos deste paciente ficam visiveis apenas para a equipe responsavel.</Alert>
      )}
    </div>
  );
}

// ── TYPE_LABELS e TYPE_COLORS do monolito original (58ae55c)
const HIST_TYPE_LABELS = {
  consultation: "Consulta", visit: "Visita domiciliar", vaccine: "Vacina",
  procedure: "Procedimento", note: "Observação clínica", task: "Tarefa interna",
  message: "Mensagem interna", exam: "Exame", exam_request: "Pedido de exame",
  prescription: "Prescrição", referral: "Encaminhamento",
  nursing: "Evolução de enfermagem", evolution: "Evolução clínica", home_visit: "Visita domiciliar",
  attendance_attest: "Declaração de comparecimento", medical_attest: "Atestado médico",
};
const HIST_TYPE_COLORS = {
  consultation:  ["#1d4ed8", "#eff6ff", "#bfdbfe"],
  visit:         ["#15803d", "#f0fdf4", "#bbf7d0"],
  home_visit:    ["#15803d", "#f0fdf4", "#bbf7d0"],
  vaccine:       ["#7c3aed", "#f5f3ff", "#ddd6fe"],
  procedure:     ["#c2410c", "#fff7ed", "#fed7aa"],
  note:          ["#475569", "var(--surface-2)", "var(--border)"],
  task:          ["#d97706", "#fffbeb", "#fde68a"],
  message:       ["#0891b2", "#ecfeff", "#a5f3fc"],
  exam:          ["#2FA9C2", "var(--surface-2)", "var(--border)"],
  exam_request:  ["#2FA9C2", "var(--surface-2)", "var(--border)"],
  prescription:  ["#15803d", "#f0fdf4", "#bbf7d0"],
  referral:      ["#6366f1", "#eff6ff", "#c7d2fe"],
  nursing:       ["#14B8A6", "#EDF9FC", "#C5F0F7"],
  evolution:     ["#0891b2", "#ecfeff", "#a5f3fc"],
};
const HIST_INTERNAL_TYPES = new Set(["task", "message"]);
const HIST_FILTER_TYPES = ["all","consultation","visit","vaccine","procedure","exam","exam_request","prescription","referral","note"];
const HIST_FILTER_LABELS = {
  all: "Todos", consultation: "Clínica", visit: "ACS", vaccine: "Vacinas",
  procedure: "Proc.", exam: "Exames", exam_request: "Pedidos", prescription: "Prescrição",
  referral: "Encam.", note: "Notas",
};

function HistoricoTab({ history, appointments, tasks, messages, canManageUser, onDeleteAppointment, loading }) {
  if (loading) {
    return (
      <div className="skeleton-stack">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton-row" style={{ alignItems: "flex-start", gap: ".8rem" }}>
            <div className="skeleton-block" style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0 }} />
            <div className="skeleton-stack" style={{ flex: 1, gap: ".4rem" }}>
              <div className="skeleton-line" style={{ width: "60%" }} />
              <div className="skeleton-line" style={{ width: "35%", height: ".6rem" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  const [filter, setFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(20);

  const allEvents = [
    ...(Array.isArray(history) ? history.map(h => ({
      id: h.id, source: "record", type: h.type || "note",
      date: h.date, time: h.metadata?.time || h.createdAt?.slice(11, 16) || "",
      title: h.title, details: h.details,
      professional: h.metadata?.professionalName || h.createdByName || h.professionalName || "",
      council: h.metadata?.professionalCouncil || h.professionalCouncil || "",
      internalOnly: h.internalOnly || HIST_INTERNAL_TYPES.has(h.type) || false,
      createdAt: h.createdAt,
    })) : []),
    ...(Array.isArray(appointments) ? appointments.map(a => ({
      id: a.id, source: "appointment", type: "consultation",
      date: a.date, time: "",
      title: a.summary || "Consulta",
      details: [
        a.demandType ? `Demanda: ${a.demandType === "scheduled" ? "Programada" : a.demandType === "spontaneous" ? "Espontânea" : "Retroativo"}` : "",
        a.conduct ? `Conduta: ${a.conduct}` : "",
        a.nextStep ? `Próximo: ${a.nextStep}` : "",
      ].filter(Boolean).join("\n"),
      professional: "", internalOnly: false, createdAt: a.createdAt,
      _apptObj: a,
    })) : []),
    ...(Array.isArray(tasks) ? tasks.map(t => ({
      id: t.id, source: "task", type: "task",
      date: t.dueDate || t.createdAt?.slice(0, 10) || "", time: "",
      title: t.title, details: t.notes || "",
      professional: "", status: t.status, internalOnly: true, createdAt: t.createdAt,
    })) : []),
    ...(Array.isArray(messages) ? messages.map(m => ({
      id: m.id, source: "message", type: "message",
      date: m.createdAt?.slice(0, 10) || "", time: m.createdAt?.slice(11, 16) || "",
      title: "Comunicação interna", details: m.text || m.body || "",
      professional: m.authorName || "", internalOnly: true, createdAt: m.createdAt,
    })) : []),
  ]
    .filter((e, _, arr) =>
      e.source !== "appointment" ||
      !arr.some(r => r.source === "record" && r.date === e.date && (r.title || "").toLowerCase().includes((e.title || "").toLowerCase().slice(0, 10)))
    )
    .filter(e => !e.internalOnly)
    .filter(e => filter === "all" || e.type === filter)
    .sort((a, b) => {
      const da = (a.date || "") + (a.time || "") + (a.createdAt || "");
      const db = (b.date || "") + (b.time || "") + (b.createdAt || "");
      return db.localeCompare(da);
    });

  const visibleEvents = allEvents.slice(0, visibleCount);
  const hasMore = allEvents.length > visibleCount;

  return (
    <>
      <div style={{ display: "flex", gap: ".25rem", flexWrap: "wrap", marginBottom: ".75rem" }}>
        {HIST_FILTER_TYPES.map(f => (
          <Button key={f} type="button" onClick={() => { setFilter(f); setVisibleCount(20); }} variant={filter === f ? "primary" : "secondary"} size="sm"
            style={{
              fontSize: ".69rem", padding: ".18rem .45rem", borderRadius: 999, cursor: "pointer",
              fontWeight: filter === f ? 700 : 400,
              background: filter === f ? "var(--teal-600)" : "var(--surface-2)",
              color: filter === f ? "#fff" : "var(--text-2)",
              border: `1px solid ${filter === f ? "var(--teal-500)" : "var(--border)"}`,
            }}>
            {HIST_FILTER_LABELS[f] || f}
          </Button>
        ))}
        <span style={{ fontSize: ".69rem", color: "var(--text-3)", alignSelf: "center", marginLeft: "auto" }}>
          {allEvents.length} registro{allEvents.length !== 1 ? "s" : ""}
        </span>
      </div>

      {!allEvents.length ? (
        <p style={{ fontSize: ".84rem", color: "var(--text-3)" }}>Nenhum registro encontrado.</p>
      ) : visibleEvents.map(ev => {
        const [color, bg, border] = HIST_TYPE_COLORS[ev.type] || ["var(--text-3)", "var(--surface-2)", "var(--border)"];
        const label = HIST_TYPE_LABELS[ev.type] || ev.type;
        const isInternal = ev.internalOnly;
        return (
          <div key={ev.id + ev.source} style={{ display: "flex", gap: ".75rem", marginBottom: ".65rem", opacity: isInternal ? .8 : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: ".35rem" }}>
              <div style={{ width: 10, height: 10, borderRadius: isInternal ? 2 : "50%", background: color, flexShrink: 0 }} />
              <div style={{ width: 1, flex: 1, background: "var(--border)", marginTop: ".25rem" }} />
            </div>
            <div style={{
              flex: 1, background: bg, border: `1px solid ${border}`,
              borderLeft: `3px solid ${color}`,
              borderRadius: "var(--r-md)", padding: ".6rem .85rem", marginBottom: ".1rem",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: ".5rem", marginBottom: ".2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: ".4rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: ".84rem", color: "var(--ink)" }}>{ev.title}</span>
                  <span style={{ fontSize: ".65rem", fontWeight: 700, padding: ".1rem .4rem", borderRadius: 999, background: color, color: "#fff", flexShrink: 0 }}>{label}</span>
                  {isInternal && <span style={{ fontSize: ".62rem", padding: ".08rem .35rem", borderRadius: 999, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", flexShrink: 0 }}>somente interno</span>}
                  {ev.status && <span style={{ fontSize: ".65rem", padding: ".1rem .4rem", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)" }}>{ev.status}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: ".35rem", flexShrink: 0 }}>
                  <span style={{ fontSize: ".7rem", color: "var(--text-3)", fontFamily: "IBM Plex Mono, monospace", whiteSpace: "nowrap" }}>
                    {fmtDate(ev.date)}{ev.time ? ` · ${ev.time}` : ""}
                  </span>
                  {canManageUser && ev.source === "appointment" && (
                    <Button
                      variant="ghost" size="sm" iconOnly
                      aria-label="Excluir consulta" title="Excluir"
                      onClick={() => onDeleteAppointment?.(ev.id)}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                        <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l.5 9h7L12 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
              {ev.professional && (
                <div style={{ fontSize: ".7rem", color: "var(--text-3)", marginBottom: ".2rem" }}>
                  {ev.professional}{ev.council ? ` · ${ev.council}` : ""}
                </div>
              )}
              {ev.details && (
                <pre style={{ margin: ".25rem 0 0", fontFamily: "inherit", fontSize: ".77rem", color: "var(--text-2)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{ev.details}</pre>
              )}
            </div>
          </div>
        );
      })}
      {hasMore && (
        <div style={{ textAlign: "center", marginTop: ".5rem" }}>
          <Button type="button" variant="secondary" size="sm" onClick={() => setVisibleCount(c => c + 20)}>
            Carregar mais ({allEvents.length - visibleCount} restantes)
          </Button>
        </div>
      )}
    </>
  );
}

function FollowupTab({ patient, users, recordForm, setRecordForm, recordVaccines, setRecordVaccines, onSubmitRecord, canWriteRecords, userObj }) {
  if (!canWriteRecords) {
    return <Alert tone="warning">Sem permissao para registrar atendimentos.</Alert>;
  }

  const acsMode = isAcs(userObj);

  return (
    <form className="field-grid" onSubmit={onSubmitRecord}>
      {acsMode ? (
        <div className="acs-visit-redirect-notice">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Para registrar visita domiciliar use <strong>ACS → Visitas</strong>.
        </div>
      ) : (
        <Select label="Tipo de atendimento" value={recordForm.type || "consultation"} onChange={e => {
          const t = e.target.value;
          const defaultTitle = t === "consultation"
            ? (userObj?.role === "doctor" ? "Consulta médica" : "Consulta de enfermagem")
            : "";
          setRecordForm(s => ({ ...s, type: t, title: defaultTitle, consultKind: "medica" }));
          setRecordVaccines([]);
        }}>
          <option value="consultation">Consulta</option>
          <option value="vaccine">Vacina</option>
          <option value="procedure">Procedimento</option>
          <option value="note">Observação / nota</option>
        </Select>
      )}

      <Input label="Data" type="date" value={recordForm.date || ""} max={new Date().toISOString().slice(0, 10)} onChange={e => setRecordForm(s => ({ ...s, date: e.target.value }))} />

      {!acsMode && recordForm.type === "consultation" && userObj?.role === "dentist" && (
        <div className="acs-visit-redirect-notice" style={{ gridColumn: "span 2" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5.5c-1.5-2-4-2.5-5.5-1C4.5 6 4 8 5 10.5c.7 1.8 1.5 5.5 2.5 7 .5 1 1.5 1 2 0 .3-.6.5-1.5.5-3 0-1.5 1-2 2-2s2 .5 2 2c0 1.5.2 2.4.5 3 .5 1 1.5 1 2 0 1-1.5 1.8-5.2 2.5-7 1-2.5.5-4.5-1.5-6-1.5-1.5-4-1-5.5 1z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Para registrar atendimento odontológico use <strong>Odontologia</strong> no menu lateral.
        </div>
      )}

      {!acsMode && recordForm.type === "consultation" && userObj?.role !== "dentist" && (
        <>
          <Select className="field--span-2" label="Área clínica" value={recordForm.consultKind || "medica"} onChange={e => {
            const k = e.target.value;
            const titleMap = {
              medica: "Consulta médica",
              enfermagem: "Consulta de enfermagem",
            };
            setRecordForm(s => ({ ...s, consultKind: k, title: titleMap[k] || "Consulta" }));
          }}>
            <option value="medica">Medicina</option>
            <option value="enfermagem">Enfermagem</option>
          </Select>
        </>
      )}

      {!acsMode && (recordForm.type === "procedure" || recordForm.type === "note") && (
        <Input className="field--span-2"
          label={recordForm.type === "procedure" ? "Procedimento realizado" : "Assunto da nota"}
          placeholder={recordForm.type === "procedure" ? "Ex: Curativo, aferição PA..." : "Ex: Orientação nutricional..."}
          value={recordForm.title || ""}
          onChange={e => setRecordForm(s => ({ ...s, title: e.target.value }))}
        />
      )}

      {!acsMode && recordForm.type === "vaccine" && (
        <div className="field field--span-2" style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
          <span style={{ fontSize: ".75rem", fontWeight: 600 }}>Vacinas aplicadas</span>
          {(() => {
            const birthDate = patient?.birthDate;
            const am = birthDate
              ? Math.floor((Date.now() - (parseLocalDate(birthDate) || new Date()).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
              : null;
            const isCrianca = am !== null && am < 120;
            return isCrianca && recordForm.date && recordVaccines.length > 0 ? (
              <div style={{ padding: ".4rem .6rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "var(--r-md)", fontSize: ".72rem", color: "#1d4ed8", display: "flex", flexDirection: "column", gap: ".2rem" }}>
                <strong>Doses que serão registradas:</strong>
                {recordVaccines.map(v => {
                  const resolved = inferVaccineDoseTitle(v, recordForm.date, patient.birthDate);
                  return <span key={v}>💉 {resolved !== v ? resolved : `${v} (dose não inferida — verifique a data)`}</span>;
                })}
              </div>
            ) : null;
          })()}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".3rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: ".65rem .75rem", maxHeight: 200, overflowY: "auto" }}>
            {VACCINE_OPTIONS.map(v => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: ".4rem", fontSize: ".8rem", cursor: "pointer", padding: ".25rem .35rem", borderRadius: "var(--r-sm)", background: recordVaccines.includes(v) ? "var(--teal-50)" : "transparent", border: recordVaccines.includes(v) ? "1px solid var(--teal-200)" : "1px solid transparent" }}>
                <Checkbox checked={recordVaccines.includes(v)}
                  onChange={e => setRecordVaccines(prev => e.target.checked ? [...prev, v] : prev.filter(x => x !== v))} />
                {v}
              </label>
            ))}
          </div>
        </div>
      )}

      {recordForm.type === "consultation" && (
        <Select className="field--span-2" label="Tipo de demanda" value={recordForm.demandType || "scheduled"} onChange={e => setRecordForm(s => ({ ...s, demandType: e.target.value }))}>
          <option value="scheduled">Programada</option>
          <option value="spontaneous">Espontânea</option>
          <option value="retroactive">Retroativo</option>
        </Select>
      )}

      {(recordForm.type === "consultation" || recordForm.type === "procedure") && (
        <Textarea className="field--span-2 patients-textarea" label="Conduta / resultado" rows={2} placeholder="O que foi feito, orientações dadas, conduta adotada..." value={recordForm.conduct || ""} onChange={e => setRecordForm(s => ({ ...s, conduct: e.target.value }))} />
      )}

      {recordForm.type === "consultation" && (
        <Input className="field--span-2" label="Próximo passo / retorno" placeholder="Ex: Retorno em 30 dias, aguardar resultado de exame..." value={recordForm.nextStep || ""} onChange={e => setRecordForm(s => ({ ...s, nextStep: e.target.value }))} />
      )}

      <Textarea className="field--span-2 patients-textarea" label="Observações adicionais" rows={2} placeholder="Informações complementares..." value={recordForm.details || ""} onChange={e => setRecordForm(s => ({ ...s, details: e.target.value }))} />

      <div className="field--span-2 patients-form-actions">
        <Button type="submit">Registrar atendimento</Button>
      </div>
    </form>
  );
}

const EXAM_TYPES = [
  "Hemograma completo", "Glicemia em jejum", "HbA1c", "Colesterol total e fracoes", "Triglicerideos",
  "Creatinina", "Ureia", "TGO/TGP", "TSH/T4 livre", "Urina rotina (EAS)", "Urocultura", "Raio-X torax",
  "Ultrassonografia abdominal", "Ultrassonografia obstetrica", "ECG", "Espirometria", "Mamografia",
  "Papanicolau", "PSA", "Ferritina/Ferro serico", "Vitamina D", "Coagulograma", "Outros"
];


const INTERNAL_ROLE_LABEL = {
  nurse_manager: "Enfermagem",
  doctor: "Médico(a)",
  dentist: "Dentista",
  nursing_tech: "Téc. Enfermagem",
  pharmacist: "Farmácia",
  pharmacy_tech: "Farmácia",
  acs: "Ag. de Saúde",
};
const INTERNAL_CLINICAL_ROLES = ["nurse_manager", "doctor", "dentist", "nursing_tech", "pharmacist", "pharmacy_tech"];
function getRoleColor(role) {
  const map = { nurse_manager: "#14B8A6", doctor: "#2563eb", dentist: "#7c3aed", nursing_tech: "#059669", pharmacist: "#d97706", pharmacy_tech: "#d97706" };
  return map[role] || "#64748b";
}

function ProfessionalCombobox({ targets, value, onChange }) {
  const [query, setQuery]   = useState("");
  const [open, setOpen]     = useState(false);
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const filtered = !query.trim()
    ? targets
    : targets.filter(t => {
        const q = query.toLowerCase();
        return (
          String(t.name || "").toLowerCase().includes(q) ||
          (INTERNAL_ROLE_LABEL[t.role] || t.role || "").toLowerCase().includes(q)
        );
      });

  const selected = targets.find(t => t.id === value);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div ref={wrapRef} className="pcb">
      <Button type="button" className={`pcb__trigger${open ? " pcb__trigger--open" : ""}`} onClick={toggle} variant="ghost" size="sm">
        {selected ? (
          <span className="pcb__selected">
            <span className="pcb__avatar" style={{ "--rc": getRoleColor(selected.role) }}>{initials(selected.name)}</span>
            <span className="pcb__selected-info">
              <span className="pcb__selected-name">{selected.name}</span>
              <span className="pcb__selected-role">{INTERNAL_ROLE_LABEL[selected.role] || selected.role}</span>
            </span>
          </span>
        ) : (
          <span className="pcb__placeholder">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Buscar profissional ou especialidade…
          </span>
        )}
        <svg className="pcb__chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Button>

      {open && (
        <div className="pcb__dropdown">
          <div className="pcb__search-wrap">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <Input
              ref={inputRef}
              className="pcb__search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Nome ou especialidade…"
              autoComplete="off"
            />
          </div>
          <div className="pcb__list">
            {!filtered.length ? (
              <div className="pcb__empty">Nenhum profissional encontrado</div>
            ) : filtered.map(t => (
              <Button key={t.id} type="button" variant="ghost" size="sm"
                className={`pcb__option${t.id === value ? " pcb__option--active" : ""}`}
                onClick={() => { onChange(t.id); setOpen(false); setQuery(""); }}>
                <span className="pcb__option-avatar" style={{ "--rc": getRoleColor(t.role) }}>{initials(t.name)}</span>
                <span className="pcb__option-body">
                  <span className="pcb__option-name">{t.name}</span>
                  <span className="pcb__option-role">{INTERNAL_ROLE_LABEL[t.role] || t.role}</span>
                </span>
                {t.id === value && (
                  <svg className="pcb__check" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const EXAM_URGENCY_OPTS = [
  { v: "routine", l: "Rotina" },
  { v: "priority", l: "Prioritário" },
  { v: "urgent", l: "Urgente" },
];

const REFERRAL_PRIORITY_OPTS = [
  { v: "routine", l: "Rotina" },
  { v: "priority", l: "Prioritário" },
  { v: "urgent", l: "Imediato" },
];

function ExamRequestModal({ patient, user, token, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [exams, setExams] = useState([{ type: "Hemograma completo", name: "", urgency: "routine", notes: "" }]);
  const [justification, setJustification] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);

  function addExam() { setExams(s => [...s, { type: "Hemograma completo", name: "", urgency: "routine", notes: "" }]); }
  function removeExam(i) { setExams(s => s.filter((_, idx) => idx !== i)); }
  function updateExam(i, k, v) { setExams(s => s.map((e, idx) => idx === i ? { ...e, [k]: v } : e)); }

  async function submit(e) {
    e.preventDefault();
    const valid = exams.filter(exam => exam.type && (exam.type !== "Outros" || exam.name.trim()));
    if (!valid.length) { setErr("Adicione ao menos um exame."); return; }
    setBusy(true); setErr("");
    try {
      const title = valid.map(exam => exam.type === "Outros" ? exam.name.trim() : exam.type).join(", ");
      const details = [
        `PEDIDO DE EXAME - emitido em ${new Date().toLocaleDateString("pt-BR")}`,
        `Profissional: ${user?.name || ""}${getCouncilLabel(user) ? ` (${getCouncilLabel(user)})` : ""}`,
        `Paciente: ${patient.name}`, "",
        ...valid.map((exam, idx) => `${idx + 1}. ${exam.type === "Outros" ? exam.name.trim() : exam.type}${exam.urgency === "urgent" ? " - URGENTE" : exam.urgency === "priority" ? " - PRIORITARIO" : ""}${exam.notes ? `\n   Observacao: ${exam.notes}` : ""}`),
        justification ? `\nJustificativa clinica: ${justification}` : "",
      ].filter(Boolean).join("\n");
      const record = await createRecord(token, patient.id, { type: "exam_request", date: today, title: `Pedido de exame: ${title}`, details });
      const originMap = { doctor: "medicina", nurse_manager: "enfermagem", dentist: "odontologia" };
      const origin = originMap[user?.role] || "medicina";
      await createExamRequest(token, {
        patientId: patient.id,
        patientName: patient.name,
        clinicalRecordId: record?.data?.id || null,
        requestedByCouncil: getCouncilLabel(user) || null,
        origin,
        exams: valid.map(exam => ({
          name: exam.type === "Outros" ? exam.name.trim() : exam.type,
          urgency: exam.urgency === "urgent" ? "urgente" : exam.urgency === "priority" ? "prioritario" : "rotina",
          notes: exam.notes || "",
        })),
        priority: valid.some(e => e.urgency === "urgent") ? "urgente" : valid.some(e => e.urgency === "priority") ? "prioritario" : "rotina",
        clinicalJustification: justification || "",
      });
      setSaved({ valid, justification });
    } catch (error) { setErr(error?.message || "Erro ao salvar."); } finally { setBusy(false); }
  }

  function handlePrint() {
    printExamRequest({
      patient,
      items: (saved?.valid || []).map(exam => ({
        name: exam.type === "Outros" ? exam.name.trim() : exam.type,
        detail: [exam.urgency === "urgent" ? "URGENTE" : exam.urgency === "priority" ? "PRIORITÁRIO" : "", exam.notes].filter(Boolean).join(" — ") || undefined,
      })),
      justification: saved?.justification,
      professional: user,
    });
  }

  if (saved) {
    return (
      <Modal title="Pedido de exame" onClose={() => onClose(true)} className="modal--lg"
        actions={<>
          <Button variant="secondary" type="button" onClick={() => onClose(true)}>Fechar</Button>
          <Button type="button" onClick={handlePrint}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}><rect x="3" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 9V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4" stroke="currentColor" strokeWidth="1.3"/><path d="M5 4V2h6v2" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="7" r=".75" fill="currentColor"/></svg>
            Imprimir pedido
          </Button>
        </>}>
        <div className="aclin-modal-stack">
          <Alert tone="success">Pedido de exame registrado com sucesso.</Alert>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>Clique em <strong>Imprimir pedido</strong> para gerar o documento imprimível.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Pedido de exame" onClose={() => onClose(false)} className="modal--lg"
      actions={<>
        <Button variant="secondary" type="button" onClick={() => onClose(false)}>Cancelar</Button>
        <Button type="button" onClick={submit} disabled={busy}>{busy ? "Registrando..." : "Emitir pedido"}</Button>
      </>}>
      <div className="aclin-modal-stack">
        {exams.map((exam, idx) => (
          <div key={`${exam.type}-${idx}`} className="aclin-exam-item">
            <div className="aclin-exam-item__header">
              <span className="aclin-exam-item__num">{idx + 1}</span>
              <Select className="aclin-exam-select" value={exam.type} onChange={e => updateExam(idx, "type", e.target.value)}>
                {EXAM_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
              </Select>
              {exams.length > 1 && (
                <Button type="button" className="aclin-remove-btn" onClick={() => removeExam(idx)} aria-label="Remover exame" variant="ghost" size="sm">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </Button>
              )}
            </div>
            {exam.type === "Outros" && (
              <Input label="Nome do exame" value={exam.name} onChange={e => updateExam(idx, "name", e.target.value)} />
            )}
            <div className="aclin-priority-row">
              <span className="aclin-field-label">Prioridade</span>
              <div className="aclin-pill-group">
                {EXAM_URGENCY_OPTS.map(opt => (
                  <Button key={opt.v} type="button" variant={exam.urgency === opt.v ? "primary" : "secondary"} size="sm"
                    className={`aclin-pill${exam.urgency === opt.v ? " aclin-pill--active" : ""}${opt.v === "urgent" ? " aclin-pill--danger" : ""}`}
                    onClick={() => updateExam(idx, "urgency", opt.v)}>
                    {opt.l}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea label="Observação" rows={2} value={exam.notes} onChange={e => updateExam(idx, "notes", e.target.value)} placeholder="Observação específica (opcional)" className="patients-textarea" />
          </div>
        ))}
        <Button type="button" className="aclin-add-btn" onClick={addExam} variant="secondary" size="sm">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Adicionar exame
        </Button>
        <div className="aclin-divider" />
        <Textarea label="Justificativa clínica" rows={3} value={justification} onChange={e => setJustification(e.target.value)} placeholder="Hipótese diagnóstica ou motivo do pedido…" className="patients-textarea" />
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

function InternalReferralModal({ patient, user, users, token, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const targets = (users || []).filter(u =>
    u.id !== user?.id &&
    INTERNAL_CLINICAL_ROLES.includes(String(u.role || ""))
  );
  const [targetId, setTargetId] = useState(targets[0]?.id || "");
  const [priority, setPriority] = useState("routine");
  const [reason, setReason] = useState("");
  const [obs, setObs] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!reason.trim()) { setErr("Informe o motivo do encaminhamento."); return; }
    const target = targets.find(u => u.id === targetId);
    if (!target) { setErr("Selecione o profissional destino."); return; }
    setBusy(true); setErr("");
    try {
      const priorityLabel = { urgent: "Imediato", priority: "Prioritário", routine: "Rotina" }[priority];
      const details = [
        `ENCAMINHAMENTO INTERNO — ${new Date().toLocaleDateString("pt-BR")}`,
        `De: ${user?.name || ""} (${INTERNAL_ROLE_LABEL[user?.role] || user?.role || ""})`,
        `Para: ${target.name} (${INTERNAL_ROLE_LABEL[target.role] || target.role || ""})`,
        `Prioridade: ${priorityLabel}`,
        "",
        "Motivo / hipótese diagnóstica:",
        reason.trim(),
        obs.trim() ? `\nObservações: ${obs.trim()}` : "",
      ].filter(Boolean).join("\n");
      await createRecord(token, patient.id, {
        type: "referral", date: today,
        title: `Encaminhamento → ${target.name}`,
        details,
      });
      await createTask(token, {
        patientId: patient.id,
        assigneeId: targetId,
        title: `Encaminhamento de ${user?.name || "profissional"}: ${patient.name}`,
        notes: reason.trim(),
        priority: priority === "urgent" ? "urgent" : "normal",
        type: "return_visit",
        dueDate: priority === "urgent" ? today : "",
        status: "pending",
      }).catch(() => {});
      onClose(true);
    } catch (error) { setErr(error?.message || "Erro ao salvar."); } finally { setBusy(false); }
  }

  return (
    <Modal title="Encaminhamento interno" onClose={() => onClose(false)} className="modal--lg"
      actions={targets.length ? <>
        <Button variant="secondary" type="button" onClick={() => onClose(false)}>Cancelar</Button>
        <Button type="button" onClick={submit} disabled={busy}>{busy ? "Encaminhando..." : "Encaminhar"}</Button>
      </> : null}>
      {!targets.length ? (
        <Alert tone="warning">Nenhum profissional clínico disponível na equipe para encaminhar.</Alert>
      ) : (
        <div className="aclin-modal-stack">
          <div className="aclin-section">
            <span className="aclin-section-label">Encaminhar para</span>
            <ProfessionalCombobox targets={targets} value={targetId} onChange={setTargetId} />
          </div>

          <div className="aclin-section">
            <span className="aclin-section-label">Prioridade</span>
            <div className="aclin-pill-group">
              {REFERRAL_PRIORITY_OPTS.map(opt => (
                <Button key={opt.v} type="button" variant={priority === opt.v ? "primary" : "secondary"} size="sm"
                  className={`aclin-pill${priority === opt.v ? " aclin-pill--active" : ""}${opt.v === "urgent" ? " aclin-pill--danger" : ""}`}
                  onClick={() => setPriority(opt.v)}>
                  {opt.l}
                </Button>
              ))}
            </div>
          </div>

          <div className="aclin-section">
            <Textarea label="Motivo / hipótese diagnóstica *" rows={4} value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Descreva o motivo do encaminhamento, sinais e sintomas relevantes…"
              className="patients-textarea" />
            <Textarea label="Observações adicionais" rows={2} value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Informações complementares para o profissional destino…"
              className="patients-textarea" />
          </div>

          {err && <Alert tone="danger">{err}</Alert>}
        </div>
      )}
    </Modal>
  );
}

function AttendanceAttestModal({ patient, user, token, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setBusy(true); setErr("");
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      await createRecord(token, patient.id, {
        type: "attendance_attest",
        date: today,
        title: `Declaração de comparecimento — ${now.toLocaleDateString("pt-BR")} às ${timeStr}h`,
        details: `Declaração de comparecimento emitida em ${now.toLocaleDateString("pt-BR")} às ${timeStr}h.\nProfissional: ${user?.name || ""}${getCouncilLabel(user) ? ` (${getCouncilLabel(user)})` : ""}`,
      });
      setSaved(true);
    } catch (error) { setErr(error?.message || "Erro ao salvar."); } finally { setBusy(false); }
  }

  function handlePrint() {
    printAttendanceAttest({ patient, professional: user });
  }

  if (saved) {
    return (
      <Modal title="Declaração de comparecimento" onClose={() => onClose(true)} className="modal--sm"
        actions={<>
          <Button variant="secondary" type="button" onClick={() => onClose(true)}>Fechar</Button>
          <Button type="button" onClick={handlePrint}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}><rect x="3" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 9V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4" stroke="currentColor" strokeWidth="1.3"/><path d="M5 4V2h6v2" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="7" r=".75" fill="currentColor"/></svg>
            Imprimir declaração
          </Button>
        </>}>
        <div className="aclin-modal-stack">
          <Alert tone="success">Declaração registrada com sucesso.</Alert>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>Clique em <strong>Imprimir declaração</strong> para gerar o documento imprimível.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Declaração de comparecimento" onClose={() => onClose(false)} className="modal--sm"
      actions={<>
        <Button variant="secondary" type="button" onClick={() => onClose(false)}>Cancelar</Button>
        <Button type="button" onClick={submit} disabled={busy}>{busy ? "Registrando..." : "Emitir declaração"}</Button>
      </>}>
      <div className="aclin-modal-stack">
        <div className="aclin-pw-confirm">
          <p className="aclin-pw-confirm__text" style={{ textAlign: "left" }}>
            Será emitida uma declaração de comparecimento para <strong>{patient?.name}</strong> com data e hora atuais, assinada por <strong>{user?.name}</strong>{getCouncilLabel(user) ? ` (${getCouncilLabel(user)})` : ""}.
          </p>
        </div>
        <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: "var(--r-md)", fontSize: "var(--t-sm)", color: "var(--text-muted)", lineHeight: 1.7 }}>
          "Atesto, para os devidos fins, que o(a) paciente acima identificado(a) compareceu nesta unidade de saúde na data de <strong>{new Date().toLocaleDateString("pt-BR")}</strong>, para atendimento/acompanhamento em serviço de saúde."
        </div>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

function MedicalAttestModal({ patient, user, token, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [days, setDays] = useState("");
  const [cid, setCid] = useState("");
  const [observations, setObservations] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit() {
    if (!days || isNaN(Number(days)) || Number(days) < 1) { setErr("Informe o número de dias de afastamento."); return; }
    setBusy(true); setErr("");
    try {
      const now = new Date();
      const details = [
        `ATESTADO MEDICO — emitido em ${now.toLocaleDateString("pt-BR")}`,
        `Profissional: ${user?.name || ""}${getCouncilLabel(user) ? ` (${getCouncilLabel(user)})` : ""}`,
        `Afastamento: ${days} dia(s) a partir de ${now.toLocaleDateString("pt-BR")}`,
        cid ? `CID-10: ${cid}` : "",
        observations ? `Observacoes: ${observations}` : "",
      ].filter(Boolean).join("\n");
      await createRecord(token, patient.id, {
        type: "medical_attest",
        date: today,
        title: `Atestado médico — ${days} dia(s)${cid ? ` (CID: ${cid})` : ""}`,
        details,
      });
      setSaved(true);
    } catch (error) { setErr(error?.message || "Erro ao salvar."); } finally { setBusy(false); }
  }

  function handlePrint() {
    printMedicalAttest({ patient, days, cid, observations, professional: user });
  }

  if (saved) {
    return (
      <Modal title="Atestado médico" onClose={() => onClose(true)} className="modal--sm"
        actions={<>
          <Button variant="secondary" type="button" onClick={() => onClose(true)}>Fechar</Button>
          <Button type="button" onClick={handlePrint}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}><rect x="3" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 9V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4" stroke="currentColor" strokeWidth="1.3"/><path d="M5 4V2h6v2" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="7" r=".75" fill="currentColor"/></svg>
            Imprimir atestado
          </Button>
        </>}>
        <div className="aclin-modal-stack">
          <Alert tone="success">Atestado registrado com sucesso.</Alert>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>Clique em <strong>Imprimir atestado</strong> para gerar o documento imprimível.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Atestado médico" onClose={() => onClose(false)} className="modal--sm"
      actions={<>
        <Button variant="secondary" type="button" onClick={() => onClose(false)}>Cancelar</Button>
        <Button type="button" onClick={submit} disabled={busy}>{busy ? "Registrando..." : "Emitir atestado"}</Button>
      </>}>
      <div className="aclin-modal-stack">
        <Input
          label="Dias de afastamento *"
          type="number"
          min="1"
          max="365"
          value={days}
          onChange={e => setDays(e.target.value)}
          placeholder="Ex: 3"
        />
        <Input
          label="CID-10 (opcional)"
          value={cid}
          onChange={e => setCid(e.target.value.toUpperCase())}
          placeholder="Ex: J06.9"
        />
        <Textarea
          label="Observações (opcional)"
          rows={3}
          value={observations}
          onChange={e => setObservations(e.target.value)}
          placeholder="Repouso, restrição de atividades físicas…"
          className="patients-textarea"
        />
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

function AcoesClinicasTab({ patient, user, users, token, canManageUser, canWriteRecords }) {
  const [modal, setModal] = useState(null);
  const [done, setDone] = useState([]);

  function handleClose(type, ok) {
    setModal(null);
    if (ok) setDone(s => [{ type, ts: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }, ...s]);
  }

  if (!canWriteRecords) {
    return <Alert tone="warning">Sem permissão para registrar ações assistenciais neste paciente.</Alert>;
  }

  const canPrescribe = canManageUser || ["doctor", "dentist", "nurse_manager"].includes(String(user?.role || ""));
  const canRefer = canWriteRecords;
  const canExam = canManageUser || canWriteRecords;

  const ACTIONS = [
    canExam ? {
      id: "exam", colorKey: "exam",
      title: "Pedido de exame",
      desc: "Solicite exames laboratoriais ou de imagem com prioridade e justificativa clínica.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3h6M9 3v10l-4 7h14l-4-7V3"/>
          <circle cx="12" cy="17.5" r=".75" fill="currentColor" stroke="none"/>
        </svg>
      ),
    } : null,
    canPrescribe ? {
      id: "prescription", colorKey: "prescription",
      title: "Prescrição de medicamentos",
      desc: "Emita prescrição com medicamentos, dosagem, frequência e via de administração.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="9" width="16" height="6" rx="3"/>
          <line x1="12" y1="9" x2="12" y2="15"/>
        </svg>
      ),
    } : null,
    canRefer ? {
      id: "referral", colorKey: "referral",
      title: "Encaminhamento interno",
      desc: "Encaminhe o paciente para outro profissional da unidade com rastreabilidade completa.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      ),
    } : null,
  ].filter(Boolean);

  const DONE_LABELS = {
    exam: "Pedido de exame emitido",
    prescription: "Prescrição emitida",
    referral: "Encaminhamento registrado",
    attendance_attest: "Declaração de comparecimento emitida",
    medical_attest: "Atestado médico emitido",
  };

  return (
    <div className="aclin-hub">
      <div className="aclin-launcher">
        {ACTIONS.map(action => (
          <Button key={action.id} type="button" variant="ghost" size="sm"
            className={`aclin-card aclin-card--${action.colorKey}`}
            onClick={() => setModal(action.id)}>
            <span className="aclin-card__icon">{action.icon}</span>
            <span className="aclin-card__body">
              <span className="aclin-card__title">{action.title}</span>
              <span className="aclin-card__desc">{action.desc}</span>
            </span>
            <span className="aclin-card__chevron" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 3.5l4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </Button>
        ))}
      </div>

      {done.length > 0 && (
        <div className="aclin-session-log">
          <span className="aclin-session-log__label">Registrado nesta sessão</span>
          <div className="aclin-session-log__items">
            {done.map((item, idx) => (
              <div key={`${item.type}-${idx}`} className="aclin-log-item">
                <span className="aclin-log-item__dot" aria-hidden="true">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className="aclin-log-item__title">{DONE_LABELS[item.type] || item.type}</span>
                <span className="aclin-log-item__time">{item.ts}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal === "exam" && <ExamRequestModal patient={patient} user={user} token={token} onClose={ok => handleClose("exam", ok)} />}
      {modal === "prescription" && <PrescriptionModal patient={patient} user={user} token={token} onClose={ok => handleClose("prescription", ok)} />}
      {modal === "referral" && <InternalReferralModal patient={patient} user={user} users={users} token={token} onClose={ok => handleClose("referral", ok)} />}
    </div>
  );
}

function TasksTab({ patient, users, templates, history, tasks, taskForm, setTaskForm, onSubmitTask, onStatusChange, canWriteRecords }) {
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try { await onSubmitTask?.(event); } finally { setBusy(false); }
  }

  const tmpl = (templates || []).find(t => t.category === patient?.careCategory);
  const suggestion = suggestNextVisitDate(history, tmpl);
  const acsUser = (users || []).find(u => u.id === patient?.assignedAcsId);
  const acsName = acsUser?.name || "ACS";

  return (
    <div className="patients-panel-stack">
      {suggestion && (
        <div style={{
          marginBottom: "1rem", padding: ".75rem .9rem",
          background: suggestion.overdue ? "var(--rose-50, #fff1f2)" : "var(--teal-50)",
          border: `1px solid ${suggestion.overdue ? "var(--rose-200, #fecdd3)" : "var(--teal-100)"}`,
          borderRadius: "var(--r-md)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: ".4rem", marginBottom: ".25rem" }}>
                <span style={{ fontWeight: 600, fontSize: ".82rem", color: suggestion.overdue ? "var(--danger)" : "var(--teal-700)" }}>
                  {suggestion.overdue ? "Visita atrasada" : "Próxima visita sugerida"}
                </span>
                <span style={{ fontSize: ".78rem", fontFamily: "IBM Plex Mono, monospace", color: suggestion.overdue ? "var(--danger)" : "var(--teal-600)", fontWeight: 700 }}>
                  {fmtDate(suggestion.date)}
                </span>
              </div>
              <p style={{ fontSize: ".75rem", color: suggestion.overdue ? "var(--danger)" : "var(--teal-600)", margin: 0 }}>
                {suggestion.reason}
              </p>
            </div>
            <div style={{ display: "flex", gap: ".4rem", flexShrink: 0, flexWrap: "wrap" }}>
              {canWriteRecords && (
                <Button variant="secondary" size="sm" type="button"
                  onClick={() => setTaskForm?.(s => ({
                    ...s,
                    title: `Visita ACS — ${patient?.name || ""}`,
                    dueDate: suggestion.date,
                    assigneeId: patient?.assignedAcsId || "",
                    notes: suggestion.reason,
                  }))}>
                  Criar tarefa
                </Button>
              )}
              {suggestion.date && patient && (
                <Button
                  as="a"
                  variant="secondary"
                  size="sm"
                  href={googleCalendarUrl({
                    title: `Visita ACS — ${patient.name}`,
                    date: suggestion.date,
                    description: `${suggestion.reason}\nPaciente: ${patient.name}\nACS: ${acsName}`,
                    location: [patient.address, patient.number, patient.neighborhood, patient.city].filter(Boolean).join(", "),
                  })}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Calendar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {canWriteRecords && (
        <form onSubmit={handleSubmit} className="field-grid">
          <Input className="field field--span-2" label="Nova tarefa" value={taskForm?.title ?? ""} onChange={e => setTaskForm?.(s => ({ ...s, title: e.target.value }))} placeholder="Ex.: retorno, busca ativa, atualizacao cadastral..." />
          <Input className="field" label="Prazo" type="date" value={taskForm?.dueDate ?? ""} onChange={e => setTaskForm?.(s => ({ ...s, dueDate: e.target.value }))} />
          <Select className="field" label="Responsavel" value={taskForm?.assigneeId ?? ""} onChange={e => setTaskForm?.(s => ({ ...s, assigneeId: e.target.value }))}>
            <option value="">Sem responsavel</option>
            {(users || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Textarea className="field field--span-2 patients-textarea" label="Observacoes" rows={2} value={taskForm?.notes ?? ""} onChange={e => setTaskForm?.(s => ({ ...s, notes: e.target.value }))} placeholder="Contexto operacional para equipe." />
          <div className="field--span-2 patients-form-actions">
            <Button type="submit" disabled={busy}>{busy ? "Criando..." : "Criar tarefa"}</Button>
          </div>
        </form>
      )}

      {!tasks?.length ? (
        <Alert tone="info">Sem tarefas para este paciente.</Alert>
      ) : (
        <div className="pat-list">
          {tasks.map(task => (
            <div key={task.id} className="pat-list-item">
              <div className="pat-list-item__main">
                <div className="pat-list-item__title">{task.title}</div>
                <div className="pat-list-item__meta">
                  {task.dueDate ? `Prazo: ${fmtDate(task.dueDate)}` : "Sem prazo"}
                  {task.assigneeId ? ` - ${(users || []).find(item => item.id === task.assigneeId)?.name || ""}` : ""}
                </div>
                {task.notes ? <div className="pat-list-item__detail">{task.notes}</div> : null}
              </div>
              <Select className="patients-task-status" value={task.status || "pending"} onChange={e => onStatusChange?.(task.id, e.target.value)}>
                <option value="pending">Pendente</option>
                <option value="in_progress">Em andamento</option>
                <option value="done">Concluida</option>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessagesTab({ messages, messageText, setMessageText, onSubmitMessage, canReply }) {
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try { await onSubmitMessage?.(event); } finally { setBusy(false); }
  }

  return (
    <div className="patients-panel-stack">
      {canReply ? (
        <form onSubmit={handleSubmit} className="field-grid">
          <Textarea className="field field--span-2 patients-textarea" label="Mensagem interna" rows={3} value={messageText ?? ""} onChange={e => setMessageText?.(e.target.value)} placeholder="Registrar orientacao ou recado interno da equipe." />
          <div className="field--span-2 patients-form-actions">
            <Button type="submit" disabled={busy || !String(messageText || "").trim()}>
              {busy ? "Enviando..." : "Registrar mensagem"}
            </Button>
          </div>
        </form>
      ) : (
        <Alert tone="warning">Sem permissao para enviar mensagens neste paciente.</Alert>
      )}

      {!messages?.length ? (
        <Alert tone="info">Sem mensagens internas associadas a este paciente.</Alert>
      ) : (
        <div className="pat-list">
          {messages.map(message => (
            <div key={message.id} className="pat-list-item">
              <div className="pat-list-item__main">
                <div className="pat-list-item__title">{message.authorName || "Equipe clinica"}</div>
                <div className="pat-list-item__meta">{new Date(message.createdAt).toLocaleString("pt-BR")}</div>
                <div className="pat-list-item__detail">{message.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Household tab ─────────────────────────────────────────────────────────────
const TIPO_IMOVEL_LABELS = {
  DOMICILIO: "Domicílio", COMERCIO: "Comércio", TERRENO_BALDIO: "Terreno baldio",
  PONTO_ESTRATEGICO: "Ponto estratégico", ESCOLA: "Escola", CRECHE: "Creche",
  ABRIGO: "Abrigo", INST_LONGA_PERMANENCIA: "Inst. longa permanência",
  UNIDADE_PRISIONAL: "Unidade prisional", DELEGACIA: "Delegacia", OUTRO: "Outro"
};
const ABAST_AGUA_LABELS = {
  REDE_ENCANADA: "Rede encanada", POCO_ARTESIANO: "Poço artesiano",
  CISTERNAS: "Cisternas", CARRO_PIPA: "Carro-pipa", OUTROS: "Outros"
};
const TRATAMENTO_LABELS = {
  SEM_TRATAMENTO: "Sem tratamento", FILTRACAO: "Filtração", FERVURA: "Fervura",
  CLORACAO: "Cloração", MINERAL: "Mineral", OUTRO: "Outro"
};
const ESGOTAMENTO_LABELS = {
  REDE_COLETORA: "Rede coletora", FOSSA_SEPTICA: "Fossa séptica",
  FOSSA_RUDIMENTAR: "Fossa rudimentar", VALA_CEU_ABERTO: "Vala a céu aberto",
  DIRETO_CORPO_AGUA: "Direto corpo d'água", OUTRO: "Outro"
};
const DESTINO_LIXO_LABELS = {
  COLETA_PUBLICA: "Coleta pública", QUEIMADO: "Queimado", ENTERRADO: "Enterrado",
  TERRENO_BALDIO: "Terreno baldio", CORPO_AGUA: "Corpo d'água", OUTROS: "Outros"
};
const SITUACAO_MORADIA_LABELS = {
  PROPRIO: "Próprio", FINANCIADO: "Financiado", ALUGADO: "Alugado",
  ARRENDADO: "Arrendado", CEDIDO: "Cedido", OCUPACAO: "Ocupação",
  SITUACAO_RUA: "Situação de rua", OUTRO: "Outro"
};
const TIPO_ENDERECO_LABELS = {
  LOGRADOURO: "Logradouro (endereço fixo)", SEM_ENDERECO: "Sem endereço fixo"
};

function emptyHouseholdForm() {
  return {
    tipoImovel: "", tipoDomicilio: "", numMoradores: "", numComodos: "", localizacao: "",
    abastecimentoAgua: "", tratamentoAgua: "", esgotamento: "",
    destinacaoLixo: "", energiaEletrica: "", familyCode: "", homeVisitFreq: "",
    situacaoMoradiaPosseTerra: "", tipoEndereco: "",
    foraArea: false,
    animaisNoDomicilio: false, tiposAnimais: [], quantidadeAnimais: ""
  };
}

function HouseholdTab({ patient, token }) {
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState(null);

  useEffect(() => {
    if (!patient?.id || !token) { setLoading(false); return; }
    setLoading(true);
    getHouseholds(patient.id, token)
      .then(data => {
        const hh = Array.isArray(data) ? data[0] : null;
        setHousehold(hh || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [patient?.id, token]);

  if (loading) {
    return <div className="skeleton-stack"><div className="skeleton-block" style={{ height: "8rem", borderRadius: "var(--r-md)" }} /></div>;
  }

  if (!household) {
    return (
      <div className="household-empty">
        <p className="household-empty__text">Nenhum cadastro domiciliar vinculado a este paciente.</p>
        <p className="household-empty__hint">O cadastro domiciliar é preenchido pelo ACS na área de Visitas Domiciliares.</p>
      </div>
    );
  }

  const hh = household;
  function lbl(map, val) { return (val && map[val]) ? map[val] : (val || "Não informado"); }

  return (
    <div className="household-view">
      <div className="field-grid">
        <Input label="Tipo de imóvel" value={lbl(TIPO_IMOVEL_LABELS, hh.tipoImovel || hh.housingType)} disabled />
        <Input label="Tipo de domicílio" value={hh.tipoDomicilio ? ({ CASA:"Casa",APARTAMENTO:"Apartamento",COMODO:"Cômodo",MALOCA:"Maloca",IMPROVISADO:"Improvisado",OUTRO:"Outro" }[hh.tipoDomicilio] || hh.tipoDomicilio) : "Não informado"} disabled />
        <Input label="Localização" value={hh.localizacao === "URBANA" ? "Urbana" : hh.localizacao === "RURAL" ? "Rural" : "Não informado"} disabled />
        <Input label="Código familiar" value={hh.familyCode || "Não informado"} disabled />
        <Input label="Nº de moradores" value={hh.numMoradores !== undefined && hh.numMoradores !== null ? String(hh.numMoradores) : "Não informado"} disabled />
        <Input label="Nº de cômodos" value={hh.numComodos !== undefined && hh.numComodos !== null ? String(hh.numComodos) : "Não informado"} disabled />
        <Input label="Abastecimento de água" value={lbl(ABAST_AGUA_LABELS, hh.abastecimentoAgua)} disabled />
        <Input label="Tratamento da água" value={lbl(TRATAMENTO_LABELS, hh.tratamentoAgua)} disabled />
        <Input label="Esgotamento sanitário" value={lbl(ESGOTAMENTO_LABELS, hh.esgotamento)} disabled />
        <Input label="Destino do lixo" value={lbl(DESTINO_LIXO_LABELS, hh.destinacaoLixo)} disabled />
        <Input label="Energia elétrica" value={hh.energiaEletrica === true ? "Sim" : hh.energiaEletrica === false ? "Não" : "Não informado"} disabled />
        <Input label="Freq. visita domiciliar" value={hh.homeVisitFreq || "Não informado"} disabled />
        <Input label="Situação de moradia / posse" value={lbl(SITUACAO_MORADIA_LABELS, hh.situacaoMoradiaPosseTerra)} disabled />
        <Input label="Tipo de endereço" value={lbl(TIPO_ENDERECO_LABELS, hh.tipoEndereco)} disabled />
        {hh.foraArea && <Input label="Cobertura" value="Fora da área" disabled />}
        {hh.animaisNoDomicilio && (
          <Input label="Animais no domicílio"
            value={[...(hh.tiposAnimais || []).map(a => ({cachorro:"Cachorro",gato:"Gato",passaro:"Pássaro",outros:"Outros"})[a] || a), hh.quantidadeAnimais != null ? `qtd: ${hh.quantidadeAnimais}` : ""].filter(Boolean).join(", ") || "Sim"}
            disabled />
        )}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// Tab IDs válidos — igual ao monolito 58ae55c
const DETAIL_TABS = [
  { id: "protocol",     label: "Protocolo" },
  { id: "appointments", label: "Histórico" },
  { id: "tasks",        label: "Tarefas" },
  { id: "exams",        label: "Ações clínicas" },
  { id: "messages",     label: "Mensagens" },
  { id: "household",    label: "Domicílio" },
];
const VALID_TAB_IDS = new Set(DETAIL_TABS.map(t => t.id));

export default function PatientDetailPanel({
  patient,
  users,
  templates,
  patientTab,
  setPatientTab,
  appointments,
  tasks,
  messages,
  history,
  sortedSpecialAlerts,
  patientDataLoading,
  patientProtocolSummary,
  recordForm,
  setRecordForm,
  recordVaccines,
  setRecordVaccines,
  onSubmitRecord,
  appointmentForm,
  setAppointmentForm,
  onSubmitAppointment,
  taskForm,
  setTaskForm,
  onSubmitTask,
  messageText,
  setMessageText,
  onSubmitMessage,
  onDeleteAppointment,
  onDeleteRecord,
  onStatusChange,
  canManageUser,
  canWriteRecords,
  userObj,
  token,
  onClose,
}) {
  const [docType, setDocType] = useState(null);
  const [showPatientCard, setShowPatientCard] = useState(false);

  // Fallback: se tab salva não existe mais (ex: "assistencial", "history"), volta para protocol
  const activeTab = VALID_TAB_IDS.has(patientTab) ? patientTab : "protocol";

  const g = gestationalAgeInfo(patient);
  const acsName = (users || []).find(item => item.id === patient.assignedAcsId)?.name || "Nao atribuido";
  const age = calcAge(patient.birthDate);

  return (
    <>
      <div className="panel-patient-header">
        <div className="panel-patient-avatar">{initials(patient.nomeSocial || patient.name)}</div>
        <div className="panel-patient-info">
          <div className="panel-patient-name">
            <span className="panel-patient-name__text">{patient.nomeSocial || patient.name}</span>
            {age ? <span className="panel-patient-age">{age}</span> : null}
            {isProfileIncomplete(patient) ? (
              <span className="panel-patient-incomplete">Incompleto</span>
            ) : null}
          </div>
          <div className="panel-patient-meta">
            <span>{catLabel(templates, patient.careCategory)}</span>
            <span>·</span>
            <span>ACS: {acsName}</span>
          </div>
        </div>
        <div className="panel-patient-doc-actions">
          <button type="button" className="panel-doc-icon-btn" title="Cartão SUS" aria-label="Cartão SUS" onClick={() => setShowPatientCard(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </button>
          <button type="button" className="panel-doc-icon-btn" title="Declaração de comparecimento" aria-label="Declaração de comparecimento" onClick={() => setDocType("comparecimento")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>
            </svg>
          </button>
          {canManageUser ? (
            <button type="button" className="panel-doc-icon-btn" title="Atestado médico" aria-label="Atestado médico" onClick={() => setDocType("atestado")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
              </svg>
            </button>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" iconOnly title="Fechar painel" aria-label="Fechar painel" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Button>
      </div>

      {isProfileIncomplete(patient) ? (
        <div className="panel-banner panel-banner--warn">
          Este paciente foi cadastrado rapidamente. <strong>Complete o perfil</strong> para liberar atendimentos.
        </div>
      ) : null}

      {g && String(patient.careCategory || "").toLowerCase() === "pregnant" ? (
        <div className="panel-banner panel-banner--info">
          IG estimada: <strong>{g.weeks}s {g.days}d</strong> (ref: {g.source})
        </div>
      ) : null}

      <div className="tabs small-tabs">
        {DETAIL_TABS.map(tab => (
          <button key={tab.id} type="button"
            className={`tab${activeTab === tab.id ? " is-active" : ""}`}
            aria-selected={activeTab === tab.id}
            onClick={() => setPatientTab?.(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="panel-block">
        {activeTab === "protocol" && (
          <ProtocolTab patient={patient} alerts={sortedSpecialAlerts} protocolSummary={patientProtocolSummary} loading={patientDataLoading} />
        )}

        {activeTab === "appointments" && (
          <HistoricoTab
            history={history}
            appointments={appointments}
            tasks={tasks}
            messages={messages}
            canManageUser={canManageUser}
            onDeleteAppointment={onDeleteAppointment}
            loading={patientDataLoading}
          />
        )}

        {activeTab === "tasks" && (
          <TasksTab
            patient={patient}
            users={users}
            templates={templates}
            history={history}
            tasks={tasks}
            taskForm={taskForm}
            setTaskForm={setTaskForm}
            onSubmitTask={onSubmitTask}
            onStatusChange={onStatusChange}
            canWriteRecords={canWriteRecords}
          />
        )}

        {activeTab === "exams" && (
          <AcoesClinicasTab
            patient={patient}
            user={userObj}
            users={users}
            token={token}
            canManageUser={canManageUser}
            canWriteRecords={canWriteRecords}
          />
        )}

        {activeTab === "messages" && (
          <MessagesTab
            messages={messages}
            messageText={messageText}
            setMessageText={setMessageText}
            onSubmitMessage={onSubmitMessage}
            canReply={!isAcs(userObj)}
          />
        )}

        {activeTab === "household" && (
          <HouseholdTab
            patient={patient}
            token={token}
          />
        )}
      </div>

      {docType ? (
        <DocumentModal patient={patient} user={userObj} type={docType} onClose={() => setDocType(null)} />
      ) : null}
      {showPatientCard ? (
        <PatientCardModal patient={patient} users={users || []} templates={templates || []} history={history} onClose={() => setShowPatientCard(false)} />
      ) : null}
    </>
  );
}
