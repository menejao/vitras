import { useMemo, useState } from "react";
import { RECEPTION_USERS } from "../config/constants";
import { matchesPatientSearch, gestationalAgeInfo, ageInMonths } from "../utils/clinical";
import { isUnavailableDay, unavailableReason } from "../utils/dates";
import { fmtDate } from "../utils/formatting";
import { useQueue } from "../hooks/useQueue";
import { useAgenda } from "../hooks/useAgenda";
import { inferQueuePriorityFromPatient, QUEUE_PRIORITY_LABELS, formatQueueClock, formatQueueWait } from "../utils/queue";
import { AGENDA_HOURS, AGENDA_STATUS_LABELS, describeAgendaType } from "../utils/agenda";
import Alert from "../components/ui/Alert";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import Select from "../components/ui/Select";

const IconLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

function ReceptionLoginModal({ onLogin, onClose }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !pw.trim()) { setErr("Informe e-mail e senha."); return; }
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: pw }),
      });
      if (!res.ok) { setErr("E-mail ou senha incorretos."); return; }
      const data = await res.json();
      const meta = RECEPTION_USERS.find((entry) => entry.email.toLowerCase() === email.trim().toLowerCase());
      const nextUser = { ...(meta || {}), ...data.user, _token: data.token };
      onLogin(nextUser);
    } catch {
      setErr("Erro de conexão. Tente novamente.");
    }
  }

  return (
    <Modal
      title={(
        <div className="rcpt-login-header">
          <div className="rcpt-login-icon">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="white" strokeWidth="1.4"/>
              <path d="M4.5 1.5v2M11.5 1.5v2M1.5 6.5h13" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M5 10h2M9 10h2M5 12.5h2" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="rcpt-login-title">Acesso — Recepção</div>
            <div className="rcpt-login-sub">Entre com suas credenciais de recepção</div>
          </div>
        </div>
      )}
      onClose={onClose}
      actions={<Button form="rcpt-login-form" type="submit" variant="primary">Entrar na Recepção</Button>}
    >
      <form id="rcpt-login-form" onSubmit={submit} className="rcpt-modal-form">
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="recepcao@ubs.local" autoFocus />
        <Input label="Senha" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="········" />
        {err ? <Alert tone="danger">{err}</Alert> : null}
      </form>
    </Modal>
  );
}

function ReceptionistApp({ recUser, patients, users, templates, token, onLogout }) {
  const [tab, setTab] = useState("queue");
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [agendaEditId, setAgendaEditId] = useState(null);
  const [agendaForm, setAgendaForm] = useState({ patientId: "", doctorId: "", date: "", time: "", type: "consultation", notes: "", status: "scheduled" });

  const [showQueueForm, setShowQueueForm] = useState(false);
  const [queueForm, setQueueForm] = useState({ patientId: "", priority: "normal", reason: "" });
  const {
    entries: queue,
    loading: queueLoading,
    error: queueError,
    setError: setQueueError,
    createEntry,
    patchEntry,
    removeEntry,
    clearDone,
    waiting,
    attending
  } = useQueue(token, { onError: () => {} });
  const {
    entries: agenda,
    loading: agendaLoading,
    error: agendaError,
    setError: setAgendaError,
    createEntry: createAgenda,
    patchEntry: patchAgenda,
    removeEntry: removeAgendaEntry
  } = useAgenda(token, { onError: () => {} });
  const doctors = users.filter((entry) => ["doctor", "nurse_manager", "nursing_tech"].includes(entry.role));
  const today = new Date().toISOString().slice(0, 10);

  const searchResults = useMemo(() => {
    if (!search.trim() || search.length < 2) return [];
    return patients.filter((patient) => matchesPatientSearch(patient, search)).slice(0, 8);
  }, [search, patients]);

  async function addToQueue(e) {
    e.preventDefault();
    if (!queueForm.patientId) return;
    const patient = patients.find((entry) => entry.id === queueForm.patientId);
    const nextPriority = queueForm.priority === "normal" ? inferQueuePriorityFromPatient(patient) : queueForm.priority;
    try {
      await createEntry({
        patientId: queueForm.patientId,
        priority: nextPriority,
        reason: queueForm.reason,
        demandType: "scheduled"
      });
      setQueueForm({ patientId: "", priority: "normal", reason: "" });
      setShowQueueForm(false);
      setQueueError("");
    } catch (err) {
      setQueueError(err.message || "Erro ao dar entrada na fila.");
    }
  }

  async function updateQueueStatus(id, status) {
    try {
      await patchEntry(id, { status });
    } catch (err) {
      setQueueError(err.message || "Erro ao atualizar fila.");
    }
  }

  async function removeFromQueue(id) {
    try {
      await removeEntry(id);
    } catch (err) {
      setQueueError(err.message || "Erro ao remover paciente.");
    }
  }

  async function clearCompleted() {
    try {
      await clearDone();
    } catch (err) {
      setQueueError(err.message || "Erro ao limpar fila.");
    }
  }

  const sortedQueue = queue;
  const alreadyInQueue = queue.filter((entry) => entry.status !== "done").map((entry) => entry.patientId);

  const selectedDateMid = new Date(`${selectedDate}T12:00:00`);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const next = new Date(selectedDateMid);
    next.setDate(next.getDate() - next.getDay() + index);
    return next.toISOString().slice(0, 10);
  });
  const countByDay = {};
  weekDays.forEach((value) => { countByDay[value] = agenda.filter((entry) => entry.date === value).length; });

  const dayAppts = agenda
    .filter((entry) => entry.date === selectedDate)
    .sort((left, right) => left.time.localeCompare(right.time));

  function openAgendaNew(time = "") {
    setAgendaForm({ patientId: "", doctorId: "", date: selectedDate, time, type: "consultation", notes: "", status: "scheduled" });
    setAgendaEditId(null);
    setShowAgendaForm(true);
  }

  function openAgendaEdit(appt) {
    setAgendaForm({ patientId: appt.patientId, doctorId: appt.doctorId, date: appt.date, time: appt.time, type: appt.type, notes: appt.notes || "", status: appt.status });
    setAgendaEditId(appt.id);
    setShowAgendaForm(true);
  }

  async function submitAgenda(e) {
    e.preventDefault();
    if (!agendaForm.patientId || !agendaForm.date || !agendaForm.time) return;
    try {
      if (agendaEditId) await patchAgenda(agendaEditId, agendaForm);
      else await createAgenda(agendaForm);
      setAgendaError("");
      setShowAgendaForm(false);
    } catch (err) {
      setAgendaError(err.message || "Erro ao salvar agendamento.");
    }
  }

  async function removeAgenda(id) {
    try {
      await removeAgendaEntry(id);
      setAgendaError("");
    } catch (err) {
      setAgendaError(err.message || "Erro ao remover agendamento.");
    }
  }

  async function updateAgendaStatus(id, status) {
    try {
      await patchAgenda(id, { status });
      setAgendaError("");
    } catch (err) {
      setAgendaError(err.message || "Erro ao atualizar agendamento.");
    }
  }

  const NAV_TABS = [
    { id: "queue", label: "Fila" },
    { id: "agenda", label: "Agenda" },
    { id: "search", label: "Pacientes" },
  ];

  return (
    <div className="rcpt-app">
      <header className="rcpt-topbar">
        <div className="rcpt-topbar__logo-wrap">
          <div className="rcpt-topbar__logo"><IconLogo /></div>
          <span className="rcpt-topbar__brand">Vitras</span>
          <span className="rcpt-topbar__badge">Recepção</span>
        </div>

        <nav className="rcpt-nav">
          {NAV_TABS.map((entry) => (
            <Button key={entry.id} variant="ghost" className={`rcpt-nav-btn${tab === entry.id ? " is-active" : ""}`} onClick={() => setTab(entry.id)}>
              {entry.label}
              {entry.id === "queue" && waiting > 0 ? <span className="rcpt-nav-badge">{waiting}</span> : null}
            </Button>
          ))}
        </nav>

        <div className="rcpt-topbar__actions">
          <Button className="rcpt-topbar__entry-btn" onClick={() => setShowQueueForm(true)}>
            + Dar entrada
          </Button>
          <Button variant="secondary" size="sm" onClick={() => openAgendaNew()}>
            + Agendar
          </Button>
          <div className="rcpt-topbar__user">
            <Avatar name={recUser.name} size="sm" />
            <div>
              <div className="rcpt-topbar__user-name">{recUser.name}</div>
              <div className="rcpt-topbar__user-role">Recepção</div>
            </div>
            <Button variant="ghost" size="sm" onClick={onLogout}>Sair</Button>
          </div>
        </div>
      </header>

      <div className="rcpt-main">
        {tab === "queue" && (
          <div className="rcpt-section">
            <div className="rcpt-kpis">
              <div className="rcpt-kpi rcpt-kpi--waiting">
                <div>
                  <div className="rcpt-kpi__value">{waiting}</div>
                  <div className="rcpt-kpi__label">Aguardando</div>
                </div>
              </div>
              <div className="rcpt-kpi rcpt-kpi--attending">
                <div>
                  <div className="rcpt-kpi__value">{attending}</div>
                  <div className="rcpt-kpi__label">Em atendimento</div>
                </div>
              </div>
              <div className="rcpt-kpi rcpt-kpi--total">
                <div>
                  <div className="rcpt-kpi__value">{sortedQueue.length}</div>
                  <div className="rcpt-kpi__label">Total hoje</div>
                </div>
              </div>
              {sortedQueue.some((entry) => entry.status === "done") ? (
                <Button variant="secondary" size="sm" onClick={clearCompleted} style={{ alignSelf: "center" }}>
                  Limpar concluídos
                </Button>
              ) : null}
            </div>

            {queueError ? <Alert tone="danger">{queueError}</Alert> : null}

            {queueLoading && !sortedQueue.length ? (
              <div className="rcpt-queue-empty">
                <div className="rcpt-queue-empty__title">Carregando fila...</div>
              </div>
            ) : !sortedQueue.length ? (
              <div className="rcpt-queue-empty">
                <div className="rcpt-queue-empty__icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                </div>
                <div className="rcpt-queue-empty__title">Nenhum paciente na fila</div>
                <Button variant="primary" onClick={() => setShowQueueForm(true)}>+ Dar entrada no primeiro paciente</Button>
              </div>
            ) : (
              <div className="rcpt-queue-list">
                {sortedQueue.map((entry, index) => {
                  const isDone = entry.status === "done";
                  const prio = isDone ? "done" : (entry.priority || "normal");
                  return (
                    <div key={entry.id} className={`rcpt-queue-item rcpt-queue-item--${prio}`}>
                      <div className="rcpt-queue-item__num">
                        <span className="rcpt-queue-item__num-text">{index + 1}</span>
                      </div>
                      <div className="rcpt-queue-item__body">
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
                          <span className="rcpt-queue-item__name">{entry.patientName}</span>
                          <span className="rcpt-queue-item__prio-tag">{QUEUE_PRIORITY_LABELS[entry.priority]}</span>
                          {entry.reason ? <span className="rcpt-queue-item__reason">· {entry.reason}</span> : null}
                        </div>
                        <div className="rcpt-queue-item__time">
                          Entrada: {formatQueueClock(entry.arrivedAt)} · Aguardando: {formatQueueWait(entry.arrivedAt)}
                        </div>
                      </div>
                      {!isDone ? (
                        <div className="rcpt-queue-item__actions">
                          {entry.status === "waiting" ? (
                            <Button variant="primary" size="sm" onClick={() => updateQueueStatus(entry.id, "attending")}>
                              Chamar
                            </Button>
                          ) : null}
                          {entry.status === "attending" ? (
                            <Button variant="primary" size="sm" onClick={() => updateQueueStatus(entry.id, "done")}>
                              Concluir
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="sm" className="rcpt-queue-item__remove-btn" onClick={() => removeFromQueue(entry.id)}>✕</Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "agenda" && (
          <div className="rcpt-section--wide">
            <div className="rcpt-week-strip">
              {weekDays.map((value) => {
                const day = new Date(`${value}T12:00:00`);
                const isToday = value === today;
                const isSelected = value === selectedDate;
                const unavailable = isUnavailableDay(value);
                return (
                  <Button
                    key={value}
                    variant="ghost"
                    className={`rcpt-week-day${isSelected ? " is-selected" : unavailable ? " is-unavailable" : isToday ? " is-today" : ""}`}
                    onClick={() => setSelectedDate(value)}
                  >
                    <div className="rcpt-week-day__dow">{day.toLocaleDateString("pt-BR", { weekday: "short" })}</div>
                    <div className="rcpt-week-day__num">{day.getDate()}</div>
                    {unavailable && !isSelected ? <div className="rcpt-week-day__closed">fechado</div> : null}
                    {!unavailable && countByDay[value] > 0 ? <div className="rcpt-week-day__count">{countByDay[value]} apts.</div> : null}
                  </Button>
                );
              })}
            </div>

            <div className="rcpt-day-header">
              <span className="rcpt-day-header__title">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                <span className="rcpt-day-header__count">{dayAppts.length} agendamento{dayAppts.length !== 1 ? "s" : ""}</span>
              </span>
              {!isUnavailableDay(selectedDate) ? (
                <Button variant="primary" size="sm" onClick={() => openAgendaNew()}>
                  + Novo agendamento
                </Button>
              ) : null}
            </div>

            {isUnavailableDay(selectedDate) ? (
              <div className="rcpt-unavail-notice">
                <strong>{unavailableReason(selectedDate)}</strong>
              </div>
            ) : null}

            {agendaError ? <Alert tone="danger">{agendaError}</Alert> : null}

            {agendaLoading && !dayAppts.length ? (
              <div className="rcpt-empty">
                <div className="rcpt-empty__title">Carregando agenda...</div>
              </div>
            ) : !dayAppts.length ? (
              <div className="rcpt-empty">
                <div className="rcpt-empty__icon">
                  {isUnavailableDay(selectedDate)
                    ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
                </div>
                <div className="rcpt-empty__title">{isUnavailableDay(selectedDate) ? "Unidade fechada neste dia" : "Nenhum agendamento neste dia"}</div>
                {!isUnavailableDay(selectedDate) ? (
                  <Button variant="primary" style={{ marginTop: "var(--s-4)" }} onClick={() => openAgendaNew()}>+ Agendar consulta</Button>
                ) : null}
              </div>
            ) : (
              <div className="rcpt-appt-list">
                {dayAppts.map((appt) => (
                  <div key={appt.id} className={`rcpt-appt rcpt-appt--${appt.status || "scheduled"}`}>
                    <div className="rcpt-appt__time">{appt.time}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="rcpt-appt__name">{appt.patientName}</div>
                      <div className="rcpt-appt__sub">
                        {describeAgendaType(appt.type)}
                        {appt.doctorName ? ` · ${appt.doctorName}` : ""}
                        {appt.notes ? ` · ${appt.notes}` : ""}
                      </div>
                    </div>
                    <div className="rcpt-appt__controls">
                      <Select className="rcpt-appt__status-select" value={appt.status} onChange={(e) => updateAgendaStatus(appt.id, e.target.value)}>
                        {Object.entries(AGENDA_STATUS_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                      </Select>
                      <Button variant="ghost" size="sm" className="icon-btn" title="Editar" onClick={() => openAgendaEdit(appt)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </Button>
                      <Button variant="ghost" size="sm" className="rcpt-appt__remove-btn" onClick={() => removeAgenda(appt.id)}>✕</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "search" && (
          <div className="rcpt-section--wide">
            <div className="rcpt-search-wrap">
              <span className="rcpt-search-icon">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </span>
              <Input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar paciente por nome, CPF ou CNS…"
                autoFocus
              />
            </div>

            {search.length >= 2 && !searchResults.length ? (
              <p style={{ textAlign: "center", color: "var(--text-dim)", padding: "var(--s-8)", font: "400 var(--t-sm) var(--font-sans)" }}>
                Nenhum paciente encontrado.
              </p>
            ) : null}

            {searchResults.length > 0 && !selectedPatient ? (
              <div className="rcpt-pat-results">
                {searchResults.map((patient) => {
                  const am = ageInMonths(patient.birthDate);
                  const g = gestationalAgeInfo(patient);
                  const catName = templates.find((template) => template.category === patient.careCategory)?.label || "Geral";
                  return (
                    <Button key={patient.id} variant="ghost" className="rcpt-pat-result" onClick={() => setSelectedPatient(patient)}>
                      <Avatar name={patient.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="rcpt-pat-result__name">{patient.name}</div>
                        <div className="rcpt-pat-result__meta">
                          {patient.cpf ? <span>CPF: {patient.cpf}</span> : null}
                          {patient.cns ? <span>CNS: {patient.cns}</span> : null}
                          {am !== null ? <span>{am < 24 ? `${am}m` : `${Math.floor(am / 12)}a`}</span> : null}
                          <span>{catName}</span>
                          {g && String(patient.careCategory || "").toLowerCase() === "pregnant" ? (
                            <span className="rcpt-pat-result__gest">IG {g.weeks}s{g.days}d</span>
                          ) : null}
                        </div>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: "var(--text-dim)", flexShrink: 0 }}>
                        <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Button>
                  );
                })}
              </div>
            ) : null}

            {selectedPatient ? (
              <div>
                <Button variant="ghost" className="rcpt-back-btn" onClick={() => setSelectedPatient(null)}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Voltar à busca
                </Button>
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div className="rcpt-pat-header">
                    <Avatar name={selectedPatient.name} />
                    <div className="rcpt-pat-header__info">
                      <div className="rcpt-pat-header__name">{selectedPatient.name}</div>
                      <div className="rcpt-pat-header__sub">
                        {selectedPatient.cpf ? <span>CPF: {selectedPatient.cpf}</span> : null}
                        {selectedPatient.cns ? <span>CNS: {selectedPatient.cns}</span> : null}
                        {selectedPatient.birthDate ? <span>Nasc.: {fmtDate(selectedPatient.birthDate)}</span> : null}
                      </div>
                    </div>
                    <div className="rcpt-pat-header__actions">
                      <Button variant="secondary" size="sm" onClick={() => { setQueueForm((state) => ({ ...state, patientId: selectedPatient.id, priority: inferQueuePriorityFromPatient(selectedPatient) })); setShowQueueForm(true); }}>
                        Dar entrada
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => { setAgendaForm((state) => ({ ...state, patientId: selectedPatient.id, date: selectedDate || today })); setShowAgendaForm(true); }}>
                        Agendar
                      </Button>
                    </div>
                  </div>

                  <div className="rcpt-pat-grid">
                    <div>
                      <div className="rcpt-pat-section-label">Contato</div>
                      <div className="rcpt-pat-info-list">
                        {selectedPatient.phone ? <span>{selectedPatient.phone}</span> : null}
                        {selectedPatient.phoneAlt ? <span>{selectedPatient.phoneAlt}</span> : null}
                        {selectedPatient.address ? <span>{[selectedPatient.address, selectedPatient.number, selectedPatient.neighborhood, selectedPatient.city].filter(Boolean).join(", ")}</span> : null}
                        {!selectedPatient.phone && !selectedPatient.address ? <span style={{ color: "var(--text-dim)" }}>Sem contato cadastrado</span> : null}
                      </div>
                    </div>
                    <div>
                      <div className="rcpt-pat-section-label">Alertas clínicos</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
                        {String(selectedPatient.allergies || "").trim() ? (
                          <span className="rcpt-allergy-badge">Alergias: {selectedPatient.allergies}</span>
                        ) : null}
                        {gestationalAgeInfo(selectedPatient) && String(selectedPatient.careCategory || "").toLowerCase() === "pregnant" ? (() => {
                          const g = gestationalAgeInfo(selectedPatient);
                          return <span className="rcpt-gest-badge">IG: {g.weeks}s {g.days}d</span>;
                        })() : null}
                        {!String(selectedPatient.allergies || "").trim() && !(gestationalAgeInfo(selectedPatient) && String(selectedPatient.careCategory || "").toLowerCase() === "pregnant") ? (
                          <span style={{ color: "var(--text-dim)" }}>Nenhum alerta</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const upcoming = agenda
                      .filter((entry) => entry.patientId === selectedPatient.id && entry.date >= today && entry.status !== "done" && entry.status !== "absent")
                      .sort((left, right) => (left.date + left.time).localeCompare(right.date + right.time))
                      .slice(0, 3);
                    if (!upcoming.length) return null;
                    return (
                      <div className="rcpt-upcoming-appts">
                        <div className="rcpt-pat-section-label">Próximos agendamentos</div>
                        {upcoming.map((entry) => (
                          <div key={entry.id} className={`rcpt-appt-mini rcpt-appt-mini--${entry.status || "scheduled"}`}>
                            <span className="rcpt-appt-mini__time">
                              {new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} {entry.time}
                            </span>
                            <span className="rcpt-appt-mini__label">
                              {describeAgendaType(entry.type)}
                              {entry.doctorName ? ` · ${entry.doctorName}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : null}

            {!search && !selectedPatient ? (
              <div className="rcpt-empty">
                <div className="rcpt-empty__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                </div>
                <div className="rcpt-empty__title">Digite para buscar um paciente</div>
                <div className="rcpt-empty__sub">Nome, CPF ou CNS</div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {showQueueForm ? (
        <Modal
          title="Dar entrada na fila"
          onClose={() => setShowQueueForm(false)}
          actions={(
            <>
              <Button type="button" variant="secondary" onClick={() => setShowQueueForm(false)}>Cancelar</Button>
              <Button form="rcpt-queue-form" type="submit" variant="primary">Confirmar entrada</Button>
            </>
          )}
        >
          <form id="rcpt-queue-form" onSubmit={addToQueue} className="rcpt-modal-form">
            <label className="rcpt-field">
              Paciente *
              <Select value={queueForm.patientId} onChange={(e) => setQueueForm((state) => ({ ...state, patientId: e.target.value }))}>
                <option value="">Selecionar paciente...</option>
                {[...patients].sort((left, right) => left.name.localeCompare(right.name, "pt-BR")).map((patient) => (
                  <option key={patient.id} value={patient.id} disabled={alreadyInQueue.includes(patient.id)}>
                    {patient.name}{alreadyInQueue.includes(patient.id) ? " (já na fila)" : ""}
                  </option>
                ))}
              </Select>
            </label>
            <label className="rcpt-field">
              Prioridade
              <Select value={queueForm.priority} onChange={(e) => setQueueForm((state) => ({ ...state, priority: e.target.value }))}>
                {Object.entries(QUEUE_PRIORITY_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
              </Select>
            </label>
            <label className="rcpt-field">
              Motivo / queixa
              <Input value={queueForm.reason} onChange={(e) => setQueueForm((state) => ({ ...state, reason: e.target.value }))} placeholder="Dor, retorno, renovação de receita..." />
            </label>
            {queueError ? <Alert tone="danger">{queueError}</Alert> : null}
          </form>
        </Modal>
      ) : null}

      {showAgendaForm ? (
        <Modal
          title={agendaEditId ? "Editar agendamento" : "Novo agendamento"}
          onClose={() => setShowAgendaForm(false)}
          actions={(
            <>
              <Button type="button" variant="secondary" onClick={() => setShowAgendaForm(false)}>Cancelar</Button>
              <Button form="rcpt-agenda-form" type="submit" variant="primary">Salvar agendamento</Button>
            </>
          )}
        >
          <form id="rcpt-agenda-form" onSubmit={submitAgenda} className="rcpt-modal-form">
            <div className="rcpt-modal-grid">
              <label className="rcpt-field rcpt-modal-grid--full">
                Paciente *
                <Select value={agendaForm.patientId} onChange={(e) => setAgendaForm((state) => ({ ...state, patientId: e.target.value }))}>
                  <option value="">Selecionar...</option>
                  {[...patients].sort((left, right) => left.name.localeCompare(right.name, "pt-BR")).map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}
                </Select>
              </label>
              <label className="rcpt-field">
                Data *
                <Input type="date" value={agendaForm.date} onChange={(e) => setAgendaForm((state) => ({ ...state, date: e.target.value }))} />
              </label>
              <label className="rcpt-field">
                Horário *
                <Select value={agendaForm.time} onChange={(e) => setAgendaForm((state) => ({ ...state, time: e.target.value }))}>
                  <option value="">Selecionar...</option>
                  {AGENDA_HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                </Select>
              </label>
              <label className="rcpt-field">
                Profissional
                <Select value={agendaForm.doctorId} onChange={(e) => setAgendaForm((state) => ({ ...state, doctorId: e.target.value }))}>
                  <option value="">Sem preferência</option>
                  {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
                </Select>
              </label>
              <label className="rcpt-field">
                Tipo
                <Select value={agendaForm.type} onChange={(e) => setAgendaForm((state) => ({ ...state, type: e.target.value }))}>
                  <option value="consultation">Consulta</option>
                  <option value="return">Retorno</option>
                  <option value="procedure">Procedimento</option>
                  <option value="other">Outro</option>
                </Select>
              </label>
              <label className="rcpt-field rcpt-modal-grid--full">
                Observações
                <Input value={agendaForm.notes} onChange={(e) => setAgendaForm((state) => ({ ...state, notes: e.target.value }))} placeholder="Motivo, solicitações especiais..." />
              </label>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

export { ReceptionistApp as default, ReceptionLoginModal };
