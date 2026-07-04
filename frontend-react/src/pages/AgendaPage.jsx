import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { createPatient, darEntradaAgenda, getAvailability } from "../api";
import { matchesPatientSearch, emptyPatientForm, isProfileIncomplete, ageInMonths } from "../utils/clinical";
import { inferQueuePriorityFromPatient } from "../utils/queue";
import { isUnavailableDay, unavailableReason } from "../utils/dates";
import { formatCpf, formatPhone, initials, maskCpf } from "../utils/formatting";
import { hasCapability } from "../utils/roles";
import { SPECIALTY_MAP, specialtyLabel, normalizeToSpecialtyKey } from "../utils/specialty";
import { AGENDA_HOURS, AGENDA_STATUS_LABELS, AGENDA_PROCEDURE_SUBTYPES, describeAgendaType } from "../utils/agenda";
import { getUbsExams, getUbsExamById } from "../data/ubsExamCatalog";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/layout/PageHeader";

const UBS_EXAMS = getUbsExams();

const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconPencil = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M13 4l-1 9a1 1 0 01-1 1H5a1 1 0 01-1-1L3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconCheck = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
    <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconWarning = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M8 7v3M8 12v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

const IconLock = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconFlask = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M6 2v5L2 13h12L10 7V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 2h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

function emptyForm() {
  return {
    patientId: "", doctorId: "", specialty: "", date: "", time: "",
    type: "consultation", notes: "", status: "scheduled",
    appointmentType: "clinical", examTypeId: "", examName: "",
  };
}

function AgendaPage({
  patients, users, user, token,
  onNewPatient, onPatientCreated, onNavigatePatient, teams = [],
  agenda = [], agendaLoading = false, agendaError = "", setAgendaError = () => {},
  createEntry, patchEntry, removeEntry,
}) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [procedureSubtype, setProcedureSubtype] = useState("");
  const [checkingIn, setCheckingIn]     = useState({});
  const [editId, setEditId]             = useState(null);
  const [filterDoc, setFilterDoc]       = useState("");
  const [apptSearch, setApptSearch]     = useState("");
  const [patSearch, setPatSearch]       = useState("");
  const [patSelected, setPatSelected]   = useState(null);
  const [showNewPat, setShowNewPat]     = useState(false);
  const [newPatForm, setNewPatForm]     = useState({ name: "", cpf: "", phone: "", careCategory: "general", birthDate: "", teamId: String(user?.teamId || "") });
  const [newPatErr, setNewPatErr]       = useState("");
  const [availableSlots, setAvailableSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const patWrapRef = useRef(null);

  const isExamAppt = form.appointmentType === "exam";

  useEffect(() => {
    if (!showForm || !form.date) { setAvailableSlots(null); return; }
    if (isExamAppt) { setAvailableSlots(null); return; } // exam slots: use default hours for now
    let cancelled = false;
    setSlotsLoading(true);
    getAvailability(token, { date: form.date, specialtyKey: form.specialty, doctorId: form.doctorId })
      .then(res => { if (!cancelled) setAvailableSlots(res?.slots || []); })
      .catch(() => { if (!cancelled) setAvailableSlots(null); })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [showForm, form.date, form.specialty, form.doctorId, token, isExamAppt]);

  // When exam type changes, update examName
  useEffect(() => {
    if (!form.examTypeId) return;
    const catalog = getUbsExamById(form.examTypeId);
    if (catalog) setForm(s => ({ ...s, examName: catalog.name }));
  }, [form.examTypeId]);

  const patResults = useMemo(() => {
    const q = patSearch.trim();
    if (q.length < 2) return [];
    return patients.filter(p => matchesPatientSearch(p, q)).slice(0, 8);
  }, [patSearch, patients]);

  const doctors = users.filter(u => ["doctor", "nurse_manager", "nursing_tech"].includes(u.role));

  const todayStr = new Date().toISOString().slice(0, 10);

  function openNew(time = "", date = selectedDate) {
    setForm({ ...emptyForm(), date, time });
    setPatSearch(""); setPatSelected(null);
    setProcedureSubtype("");
    setEditId(null); setShowForm(true);
  }

  function openEdit(appt) {
    const pat = patients.find(p => p.id === appt.patientId) || null;
    setForm({
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      specialty: normalizeToSpecialtyKey(appt.specialty || ""),
      date: appt.date,
      time: appt.time,
      type: appt.type,
      notes: appt.notes || "",
      status: appt.status,
      appointmentType: appt.appointmentType || "clinical",
      examTypeId: appt.examTypeId || "",
      examName: appt.examName || "",
    });
    setPatSearch(pat?.name || ""); setPatSelected(pat);
    setProcedureSubtype("");
    setEditId(appt.id); setShowForm(true);
  }

  const canDarEntrada = hasCapability(user, "queue.write") || user?.role === "receptionist";

  async function checkIn(appt) {
    const patient = patients.find(p => p.id === appt.patientId);
    const priority = patient ? inferQueuePriorityFromPatient(patient) : "normal";
    const specialty = normalizeToSpecialtyKey(appt.specialty || "");
    setCheckingIn(prev => ({ ...prev, [appt.id]: true }));
    try {
      if (appt.appointmentType === "exam") {
        // Exam: dar entrada goes to exam queue, not clinical
        await darEntradaAgenda(token, appt.id, { priority });
      } else {
        await darEntradaAgenda(token, appt.id, { priority, specialty, needsTriage: true });
      }
      await patchEntry(appt.id, { status: "arrived" });
    } catch (err) {
      setAgendaError(err.message || "Erro ao dar entrada.");
    } finally {
      setCheckingIn(prev => ({ ...prev, [appt.id]: false }));
    }
  }

  async function createQuickPatient() {
    const payload = {
      ...emptyPatientForm(),
      name: newPatForm.name.trim(),
      cpf: newPatForm.cpf,
      phone: newPatForm.phone,
      birthDate: newPatForm.birthDate,
      careCategory: newPatForm.careCategory,
      teamId: String(newPatForm.teamId || user?.teamId || "").trim(),
      incompleteProfile: true,
      motherName: "", cns: "", phoneAlt: "", zipCode: "", address: "", number: "",
      complement: "", neighborhood: "", city: "", state: "", sex: "", maritalStatus: "",
      assignedAcsId: "", allergies: "", comorbidities: "", medications: "",
      pregnancyStartDate: "", expectedDeliveryDate: "",
    };
    const created = await createPatient(token, payload);
    if (onNewPatient) onNewPatient(created);
    if (onPatientCreated) onPatientCreated();
    return created;
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.patientId || !form.date || !form.time) {
      setAgendaError("Preencha todos os campos obrigatórios: Paciente, Data e Horário.");
      return;
    }
    if (!isExamAppt && !form.specialty) {
      setAgendaError("Preencha a Especialidade.");
      return;
    }
    if (isExamAppt && !form.examTypeId) {
      setAgendaError("Selecione o tipo de exame.");
      return;
    }

    let resolvedPatientId = form.patientId;

    if (patSelected && String(form.patientId).startsWith("local_") && !patients.find(p => p.id === form.patientId)) {
      const created = await createQuickPatient();
      resolvedPatientId = created?.id || form.patientId;
    }

    const payload = { ...form, patientId: resolvedPatientId };
    try {
      if (editId) await patchEntry(editId, payload);
      else await createEntry(payload);
      setAgendaError("");
      setShowForm(false);
    } catch (err) {
      setAgendaError(err.message || "Erro ao salvar agendamento.");
    }
  }

  async function remove(id) {
    try {
      await removeEntry(id);
      setAgendaError("");
    } catch (err) {
      setAgendaError(err.message || "Erro ao remover agendamento.");
    }
  }

  const dayAppts = agenda
    .filter(a => {
      if (a.date !== selectedDate) return false;
      if (filterDoc && a.doctorId !== filterDoc) return false;
      if (apptSearch.trim().length >= 2) {
        const q = apptSearch.trim().toLowerCase();
        const name = (a.patientName || "").toLowerCase();
        const patObj = patients.find(p => p.id === a.patientId);
        if (!name.includes(q) && !matchesPatientSearch(patObj, apptSearch.trim())) return false;
      }
      return true;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const selD = new Date(selectedDate + "T12:00:00");
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(selD);
    d.setDate(d.getDate() - d.getDay() + i);
    return d.toISOString().slice(0, 10);
  });
  const countByDay = {};
  weekDays.forEach(d => { countByDay[d] = agenda.filter(a => a.date === d).length; });

  const patDropRect = (showForm && patSearch.length >= 2 && !patSelected)
    ? patWrapRef.current?.getBoundingClientRect() ?? null
    : null;

  const monthLabel = new Date(selectedDate + "T12:00:00")
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, c => c.toUpperCase());

  return (
    <div className="agenda-page">
      <PageHeader
        eyebrow="Gestão de Horários"
        title="Agenda"
        subtitle="Agendamentos, confirmações e controle de presença."
        actions={
          <Button onClick={() => openNew()}>
            <IconPlus />
            Novo agendamento
          </Button>
        }
      />

      <div className="agenda-date-nav">
        <button type="button" className="agenda-date-nav__arrow" aria-label="Mês anterior"
          onClick={() => { const d = new Date(selectedDate + "T12:00:00"); d.setMonth(d.getMonth() - 1); setSelectedDate(d.toISOString().slice(0, 10)); }}>
          ‹
        </button>
        <div className="agenda-date-nav__month-wrap">
          <button type="button" className="agenda-month-label" onClick={() => document.getElementById("agenda-date-picker").showPicker?.()}>
            {monthLabel}
          </button>
          <input id="agenda-date-picker" type="date" value={selectedDate}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }} />
        </div>
        <button type="button" className="agenda-date-nav__arrow" aria-label="Próximo mês"
          onClick={() => { const d = new Date(selectedDate + "T12:00:00"); d.setMonth(d.getMonth() + 1); setSelectedDate(d.toISOString().slice(0, 10)); }}>
          ›
        </button>
        {selectedDate !== todayStr && (
          <button type="button" className="agenda-date-nav__today" onClick={() => setSelectedDate(todayStr)}>Hoje</button>
        )}
      </div>

      <div className="agenda-week-strip">
        {weekDays.map(d => {
          const dt = new Date(d + "T12:00:00");
          const isToday    = d === todayStr;
          const isSel      = d === selectedDate;
          const unavailable = isUnavailableDay(d);
          return (
            <Button
              key={d}
              variant="ghost"
              className={[
                "agenda-day-btn",
                isSel                    ? "is-sel"     : "",
                isToday && !isSel        ? "is-today"   : "",
                unavailable && !isSel   ? "is-unavail" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setSelectedDate(d)}
            >
              <span className="agenda-day-btn__weekday">
                {dt.toLocaleDateString("pt-BR", { weekday: "short" })}
              </span>
              <span className="agenda-day-btn__num">{dt.getDate()}</span>
              {unavailable && !isSel ? (
                <span className="agenda-day-btn__tag">fechado</span>
              ) : !unavailable && countByDay[d] > 0 ? (
                <span className="agenda-day-btn__tag">{countByDay[d]}×</span>
              ) : null}
            </Button>
          );
        })}
      </div>

      <div className="agenda-toolbar">
        <div className="agenda-toolbar__search-row">
          <Input
            value={apptSearch}
            onChange={e => setApptSearch(e.target.value)}
            placeholder="Buscar paciente por nome, CPF ou telefone..."
            style={{ flex: 1 }}
          />
          <span className="agenda-toolbar__count">
            {dayAppts.length} agendamento{dayAppts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="agenda-toolbar__filter-row">
          <Select value={filterDoc} onChange={e => setFilterDoc(e.target.value)}>
            <option value="">Todos os profissionais</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
      </div>

      <div className="agenda-timeline">
        {agendaError ? <div className="alert alert--danger">{agendaError}</div> : null}

        {isUnavailableDay(selectedDate) && (
          <div className="agenda-unavail-banner">
            <span className="agenda-unavail-banner__icon"><IconLock /></span>
            <div>
              <div className="agenda-unavail-banner__title">{unavailableReason(selectedDate)}</div>
              <div className="agenda-unavail-banner__desc">
                Agendamentos não são realizados nesta data. Caso haja um agendamento existente, foi criado manualmente.
              </div>
            </div>
          </div>
        )}

        {agendaLoading && !dayAppts.length && !isUnavailableDay(selectedDate) ? (
          <div className="card card--operational">
            <div className="card__body">
              <p className="muted">Carregando agenda...</p>
            </div>
          </div>
        ) : !dayAppts.length && !isUnavailableDay(selectedDate) ? (
          <div className="agenda-day-empty">
            <div className="agenda-day-empty__icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            </div>
            <h3 className="agenda-day-empty__title">Nenhum agendamento para este dia</h3>
            <p className="agenda-day-empty__desc">Os agendamentos criados aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          dayAppts.map(appt => {
            const patObj = patients.find(p => p.id === appt.patientId);
            const incomplete =
              appt.incompletePatient === true ||
              isProfileIncomplete(patObj) ||
              String(appt.patientId).startsWith("local_");
            const status = appt.status || "scheduled";
            const isExam = appt.appointmentType === "exam";

            return (
              <div
                key={appt.id}
                className={[
                  "agenda-appt",
                  `agenda-appt--${status}`,
                  isExam ? "agenda-appt--exam" : "",
                  incomplete ? "agenda-appt--incomplete" : "",
                ].filter(Boolean).join(" ")}
              >
                {incomplete && (
                  <div className="agenda-incomplete-warn">
                    <IconWarning />
                    <span>Cadastro incompleto — consulta bloqueada até completar o perfil.</span>
                    {onNavigatePatient && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="agenda-incomplete-warn__action"
                        onClick={() => onNavigatePatient(appt.patientId)}
                      >
                        Completar →
                      </Button>
                    )}
                  </div>
                )}

                <div className="agenda-appt__row">
                  <span className="agenda-appt__time">{appt.time}</span>

                  <div className="agenda-appt__copy">
                    <div className="agenda-appt__name">{appt.patientName}</div>
                    <div className="agenda-appt__meta">
                      {isExam ? (
                        <>
                          <span className="agenda-appt__type-badge agenda-appt__type-badge--exam">
                            <IconFlask /> Exame
                          </span>
                          {appt.examName && ` · ${appt.examName}`}
                          {appt.doctorName && ` · ${appt.doctorName}`}
                        </>
                      ) : (
                        <>
                          {describeAgendaType(appt.type)}
                          {appt.specialty && ` · ${appt.specialty}`}
                          {appt.doctorName && ` · ${appt.doctorName}`}
                          {appt.notes && ` · ${appt.notes}`}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="agenda-appt__actions">
                    {appt.date === todayStr && appt.status === "scheduled" && !incomplete && canDarEntrada && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="agenda-checkin-btn"
                        disabled={checkingIn[appt.id]}
                        onClick={() => checkIn(appt)}
                      >
                        {checkingIn[appt.id] ? "…" : "Dar entrada"}
                      </Button>
                    )}
                    {appt.status === "arrived" && (
                      <span className="queue-badge queue-badge--scheduled" style={{ fontSize: ".7rem" }}>
                        {isExam ? "Aguardando exame" : "Na fila"}
                      </span>
                    )}
                    {appt.status !== "arrived" && appt.status !== "scheduled" && (
                      <span className="queue-badge" style={{ fontSize: ".7rem", background: "var(--color-surface-2)", color: "var(--text-2)" }}>
                        {AGENDA_STATUS_LABELS[appt.status] || appt.status}
                      </span>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      className="agenda-appt__edit-btn"
                      onClick={() => openEdit(appt)}
                      aria-label="Editar agendamento"
                    >
                      <IconPencil />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      className="agenda-appt__remove-btn"
                      onClick={() => remove(appt.id)}
                      aria-label="Remover agendamento"
                    >
                      <IconTrash />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de agendamento */}
      {showForm && (
        <Modal
          title={editId ? "Editar agendamento" : "Novo agendamento"}
          className="modal--agenda"
          onClose={() => setShowForm(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" form="agenda-form">Salvar</Button>
            </>
          }
        >
          <form id="agenda-form" onSubmit={submit} className="field-grid field-grid--no-pad">

            {/* Tipo de agendamento */}
            <div className="field field--span-2">
              <span className="field__label">Tipo de agendamento</span>
              <div className="btn-group">
                <button
                  type="button"
                  className={`btn btn--sm${!isExamAppt ? " is-active" : ""}`}
                  onClick={() => setForm(s => ({ ...s, appointmentType: "clinical", examTypeId: "", examName: "" }))}
                >
                  Atendimento
                </button>
                <button
                  type="button"
                  className={`btn btn--sm${isExamAppt ? " is-active" : ""}`}
                  onClick={() => setForm(s => ({ ...s, appointmentType: "exam", specialty: "", type: "procedure" }))}
                >
                  Exame
                </button>
              </div>
            </div>

            {/* Busca de paciente */}
            <label className="field field--span-2">
              <span className="field__label">Paciente *</span>
              <div className="agenda-pat-wrap" ref={patWrapRef}>
                <div className="input">
                  <span className="input__icon"><IconSearch /></span>
                  <input
                    value={patSearch}
                    onChange={e => {
                      setPatSearch(e.target.value);
                      if (patSelected && e.target.value !== patSelected.name) {
                        setPatSelected(null);
                        setForm(s => ({ ...s, patientId: "" }));
                      }
                    }}
                    placeholder="Buscar por nome, CPF ou telefone..."
                    autoComplete="off"
                  />
                  {patSelected && (
                    <span className="agenda-pat-check"><IconCheck /></span>
                  )}
                </div>
              </div>
            </label>

            {patDropRect && createPortal(
              <div
                className="agenda-pat-dropdown"
                style={{
                  position: "fixed",
                  top: patDropRect.bottom + 3,
                  left: patDropRect.left,
                  right: "auto",
                  width: patDropRect.width,
                  zIndex: 9999,
                }}
              >
                {patResults.length === 0 ? (
                  <div className="agenda-pat-empty">Nenhum paciente encontrado.</div>
                ) : (
                  patResults.map(p => {
                    const am = ageInMonths(p.birthDate);
                    return (
                      <Button
                        key={p.id}
                        variant="ghost"
                        className="agenda-pat-opt"
                        onClick={() => { setPatSelected(p); setPatSearch(p.name); setForm(s => ({ ...s, patientId: p.id })); }}
                      >
                        <span className="agenda-pat-opt__avatar">{initials(p.name)}</span>
                        <span>
                          <div className="agenda-pat-opt__name">{p.name}</div>
                          <div className="agenda-pat-opt__meta">
                            {p.careCategory || "Geral"}
                            {am !== null ? ` · ${am < 24 ? am + "m" : Math.floor(am / 12) + "a"}` : ""}
                            {p.cpf ? ` · CPF ${maskCpf(p.cpf)}` : ""}
                          </div>
                        </span>
                      </Button>
                    );
                  })
                )}
                <Button
                  variant="ghost"
                  className="agenda-pat-new"
                  onClick={() => {
                    const n = patSearch;
                    setPatSearch("");
                    setNewPatForm({ name: n, cpf: "", phone: "", careCategory: "general", birthDate: "", teamId: String(user?.teamId || "") });
                    setNewPatErr("");
                    setShowNewPat(true);
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="6.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M1 14c0-3.3 2.5-5 5.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M12 10v4M10 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Cadastrar novo paciente
                </Button>
              </div>,
              document.body
            )}

            {/* Cadastro rápido */}
            {showNewPat && (
              <div className="field--span-2 agenda-quick-patient">
                <div className="agenda-quick-patient__header">
                  <span className="agenda-quick-patient__title">+ Cadastro rápido de paciente</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    className="icon-btn"
                    onClick={() => setShowNewPat(false)}
                    aria-label="Fechar cadastro rápido"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </Button>
                </div>

                <div className="agenda-quick-patient__grid">
                  <Input
                    label="Nome completo *"
                    className="field--span-2"
                    value={newPatForm.name}
                    onChange={e => setNewPatForm(s => ({ ...s, name: e.target.value }))}
                    placeholder="Nome do paciente"
                  />
                  <Input
                    label="CPF"
                    value={newPatForm.cpf}
                    onChange={e => setNewPatForm(s => ({ ...s, cpf: formatCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                  />
                  <Input
                    label="Telefone"
                    value={newPatForm.phone}
                    onChange={e => setNewPatForm(s => ({ ...s, phone: formatPhone(e.target.value) }))}
                    placeholder="(00) 00000-0000"
                  />
                  <Input
                    label="Nascimento"
                    type="date"
                    value={newPatForm.birthDate}
                    onChange={e => setNewPatForm(s => ({ ...s, birthDate: e.target.value }))}
                  />
                  <Select
                    label="Categoria"
                    value={newPatForm.careCategory}
                    onChange={e => setNewPatForm(s => ({ ...s, careCategory: e.target.value }))}
                  >
                    <option value="general">Geral</option>
                    <option value="pregnant">Gestante</option>
                    <option value="hypertension">Hipertensão</option>
                    <option value="diabetes">Diabetes</option>
                    <option value="elderly">Idoso</option>
                    <option value="child_followup">Puericultura</option>
                  </Select>
                  <Select
                    label="Equipe responsável"
                    className="field--span-2"
                    value={newPatForm.teamId}
                    onChange={e => setNewPatForm(s => ({ ...s, teamId: e.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {(teams || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </div>

                {newPatErr && <span className="field__error">{newPatErr}</span>}

                <div className="agenda-quick-patient__footer">
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!newPatForm.name.trim()) { setNewPatErr("Nome obrigatório."); return; }
                      if (!String(newPatForm.teamId || "").trim()) { setNewPatErr("Selecione a equipe responsável."); return; }
                      try {
                        const created = await createQuickPatient();
                        setPatSelected(created);
                        setPatSearch(created.name);
                        setForm(s => ({ ...s, patientId: created.id }));
                        setShowNewPat(false);
                        setNewPatErr("");
                      } catch (err) {
                        setNewPatErr(err.message || "Erro ao cadastrar paciente.");
                      }
                    }}
                  >
                    <IconCheck />
                    Usar este paciente
                  </Button>
                </div>
              </div>
            )}

            {/* Data */}
            <Input
              label="Data *"
              type="date"
              value={form.date}
              onChange={e => setForm(s => ({ ...s, date: e.target.value }))}
              hint={
                form.date && isUnavailableDay(form.date)
                  ? `${unavailableReason(form.date)} — confirme se necessário`
                  : undefined
              }
            />

            {/* Horário */}
            <Select
              label="Horário *"
              value={form.time}
              onChange={e => setForm(s => ({ ...s, time: e.target.value }))}
            >
              <option value="">Selecionar...</option>
              {(availableSlots ?? AGENDA_HOURS).map(h => <option key={h} value={h}>{h}</option>)}
            </Select>

            {/* EXAM FIELDS */}
            {isExamAppt && (
              <>
                <Select
                  label="Tipo de exame *"
                  className="field--span-2"
                  value={form.examTypeId}
                  onChange={e => setForm(s => ({ ...s, examTypeId: e.target.value }))}
                  error={!form.examTypeId && agendaError ? "Obrigatório" : ""}
                >
                  <option value="">Selecionar exame da UBS...</option>
                  {UBS_EXAMS.map(ex => (
                    <option key={ex.examTypeId} value={ex.examTypeId}>{ex.name}</option>
                  ))}
                </Select>

                {form.examTypeId && (() => {
                  const ex = getUbsExamById(form.examTypeId);
                  if (!ex) return null;
                  return (
                    <div className="field--span-2 agenda-exam-info">
                      <span className="agenda-exam-info__duration">Duração média: {ex.defaultDuration} min</span>
                      {ex.requiresPreparation && (
                        <span className="agenda-exam-info__prep">⚠ {ex.preparationInstructions}</span>
                      )}
                    </div>
                  );
                })()}

                {/* Profissional/equipe executante (opcional) */}
                <Select
                  label="Profissional executante (opcional)"
                  className="field--span-2"
                  value={form.doctorId}
                  onChange={e => setForm(s => ({ ...s, doctorId: e.target.value }))}
                >
                  <option value="">Equipe de enfermagem</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </>
            )}

            {/* CLINICAL FIELDS */}
            {!isExamAppt && (
              <>
                <Select
                  label="Especialidade / Atendimento *"
                  value={form.specialty}
                  onChange={e => setForm(s => ({ ...s, specialty: e.target.value }))}
                  error={!form.specialty && agendaError ? "Obrigatório" : ""}
                >
                  <option value="">Selecionar especialidade...</option>
                  {SPECIALTY_MAP.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </Select>

                <Select
                  label="Profissional"
                  value={form.doctorId}
                  onChange={e => setForm(s => ({ ...s, doctorId: e.target.value }))}
                >
                  <option value="">Sem preferência</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>

                <Select
                  label="Tipo"
                  value={form.type}
                  onChange={e => {
                    setForm(s => ({ ...s, type: e.target.value, notes: "" }));
                    setProcedureSubtype("");
                  }}
                >
                  <option value="consultation">Consulta</option>
                  <option value="return">Retorno</option>
                  <option value="procedure">Procedimento / Exame</option>
                  <option value="other">Outro</option>
                </Select>

                {form.type === "procedure" && (
                  <Select
                    label="Procedimento / Exame"
                    value={procedureSubtype}
                    onChange={e => {
                      const v = e.target.value;
                      setProcedureSubtype(v);
                      const lbl = AGENDA_PROCEDURE_SUBTYPES.find(s => s.value === v)?.label || "";
                      setForm(s => ({ ...s, notes: lbl }));
                    }}
                  >
                    <option value="">Selecionar...</option>
                    {AGENDA_PROCEDURE_SUBTYPES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </Select>
                )}
              </>
            )}

            {/* Observações */}
            <Input
              label="Observações"
              className="field--span-2"
              value={form.notes}
              onChange={e => setForm(s => ({ ...s, notes: e.target.value }))}
              placeholder={isExamAppt ? "Instruções especiais, observações..." : "Motivo, solicitações especiais..."}
            />

          </form>
        </Modal>
      )}
    </div>
  );
}

export default AgendaPage;
