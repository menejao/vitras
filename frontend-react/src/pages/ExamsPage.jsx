import { useState, useRef, useEffect, useCallback } from "react";
import { listExams, createExam, uploadExamAttachment, deleteExam, listExamRequests, updateExamRequestStatus } from "../api";
import { catLabel, matchesPatientSearch } from "../utils/clinical";
import { fmtDate } from "../utils/formatting";
import PageHeader from "../components/layout/PageHeader";
import Alert from "../components/ui/Alert";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import Select from "../components/ui/Select";
import Textarea from "../components/ui/Textarea";

const EXAM_TYPES = ["Hemograma completo", "Glicemia em jejum", "HbA1c", "Colesterol total e frações", "Triglicerídeos", "Creatinina", "Ureia", "TGO/TGP", "TSH/T4 livre", "Urina rotina (EAS)", "Urocultura", "Raio-X tórax", "Ultrassonografia abdominal", "Ultrassonografia obstétrica", "ECG", "Espirometria", "Mamografia", "Papanicolau", "PSA", "Ferritina/Ferro sérico", "Vitamina D", "Coagulograma", "Outros"];

const STATUS_LABELS = {
  pendente: "Pendente",
  agendado: "Agendado",
  em_execucao: "Em execução",
  coletado: "Coletado",
  aguardando_resultado: "Aguardando resultado",
  resultado_disponivel: "Resultado disponível",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const PRIORITY_LABELS = { urgente: "Urgente", prioritario: "Prioritário", rotina: "Rotina" };
const ORIGIN_LABELS = { medicina: "Medicina", enfermagem: "Enfermagem", odontologia: "Odontologia" };

function isImg(type) {
  return String(type || "").startsWith("image/");
}

function canManageExams(user) {
  return ["doctor", "dentist", "nurse_manager", "nursing_tech", "break_glass_admin"].includes(String(user?.role || ""));
}

function canExecuteExams(user) {
  return ["nursing_tech", "nurse_manager", "break_glass_admin"].includes(String(user?.role || ""));
}

async function fileToPayload(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return {
    name: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    dataBase64: btoa(binary)
  };
}

function isExternalExam(exam) {
  return exam.source === "externo" || String(exam.details || "").includes("[EXAME EXTERNO");
}

function ExamCard({ exam, canManage, onDelete, onPreview }) {
  const isExternal = isExternalExam(exam);
  const details = exam.details?.replace(/^\[EXAME.*?\]\n?/, "") || "";
  const hasResult = exam.status === "result_available";
  const isPendingResult = !isExternal && exam.status && exam.status !== "result_available";

  return (
    <div className={`exams-card${isExternal ? " exams-card--externo" : ""}${hasResult ? " exams-card--result" : ""}`}>
      <div className="exams-card__head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="exams-card__title">{exam.title}</div>
          <div className="exams-card__date">
            {fmtDate(exam.date)}
            {exam.lab ? <span className="exams-card__lab-name"> · {exam.lab}</span> : null}
          </div>
        </div>
        <div className="exams-card__actions">
          {hasResult && (
            <span className="exams-card__status-chip exams-card__status-chip--done">Resultado</span>
          )}
          {isPendingResult && (
            <span className="exams-card__status-chip exams-card__status-chip--pending">Enviado</span>
          )}
          {Array.isArray(exam.attachments) && exam.attachments.length > 0 && (
            <span className="exams-card__badge">
              {exam.attachments.length} anexo{exam.attachments.length > 1 ? "s" : ""}
            </span>
          )}
          {canManage && (
            <Button className="icon-btn" title="Excluir" onClick={() => onDelete(exam)} type="button" variant="ghost" size="sm">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l.5 9h7L12 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
          )}
        </div>
      </div>
      {hasResult && exam.resultDate && exam.resultDate !== exam.date && (
        <div className="exams-card__result-date">Resultado recebido em {fmtDate(exam.resultDate)}</div>
      )}
      {details && <pre className="exams-card__details">{details}</pre>}
      {Array.isArray(exam.attachments) && exam.attachments.length > 0 && (
        <div className="exams-card__attachments">
          {exam.attachments.map((att) => (
            <Button key={att.id || att.name} type="button" className="exams-card__att-btn" onClick={() => onPreview(att)} variant="ghost" size="sm">
              {isImg(att.contentType)
                ? <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="5.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1.5 11l3.5-3 3 3 2-2 3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.3"/></svg>}
              {att.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ExamExecutionModal ───────────────────────────────────────────────────────

const NEXT_STATUSES = {
  pendente: ["agendado", "em_execucao", "cancelado"],
  agendado: ["em_execucao", "cancelado"],
  em_execucao: ["coletado", "aguardando_resultado", "cancelado"],
  coletado: ["aguardando_resultado", "resultado_disponivel", "concluido", "cancelado"],
  aguardando_resultado: ["resultado_disponivel", "concluido", "cancelado"],
  resultado_disponivel: ["concluido"],
  concluido: [],
  cancelado: [],
};

function ExamExecutionModal({ request, token, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);
  const nextOptions = NEXT_STATUSES[request.status] || [];
  const [status, setStatus] = useState(nextOptions[0] || "");
  const [resultNotes, setResultNotes] = useState(request.resultNotes || "");
  const [scheduledDate, setScheduledDate] = useState(request.scheduledDate || "");
  const [scheduledTime, setScheduledTime] = useState(request.scheduledTime || "");
  const [notes, setNotes] = useState(request.notes || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const needsResult = ["resultado_disponivel", "concluido"].includes(status);
  const needsSchedule = status === "agendado";

  async function submit(e) {
    e.preventDefault();
    if (!status) { setErr("Selecione o novo status."); return; }
    setBusy(true); setErr("");
    try {
      await updateExamRequestStatus(token, request.id, {
        status,
        resultNotes: resultNotes || undefined,
        resultDate: needsResult ? today : undefined,
        scheduledDate: scheduledDate || undefined,
        scheduledTime: scheduledTime || undefined,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (error) {
      setErr(error?.message || "Erro ao atualizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Executar / atualizar pedido"
      onClose={onClose}
      actions={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" form="exec-form" variant="primary" size="sm" disabled={busy || !status}>
            {busy ? "Salvando..." : "Confirmar"}
          </Button>
        </>
      }
    >
      <div className="exam-exec-modal">
        <div className="exam-exec-modal__info">
          <strong>{request.patientName}</strong>
          <span className="exam-exec-modal__meta">Solicitado por {request.requestedByName} em {fmtDate(String(request.requestedAt || "").slice(0, 10))}</span>
          <div className="exam-exec-modal__exams">
            {(request.exams || []).map((ex, i) => (
              <span key={i} className={`exam-exec-modal__exam-tag${ex.urgency === "urgente" ? " exam-exec-modal__exam-tag--urgent" : ""}`}>
                {ex.name}{ex.urgency === "urgente" ? " ⚡" : ex.urgency === "prioritario" ? " ↑" : ""}
              </span>
            ))}
          </div>
          {request.clinicalJustification && (
            <div className="exam-exec-modal__justif">Justificativa: {request.clinicalJustification}</div>
          )}
        </div>

        <form id="exec-form" onSubmit={submit} className="exam-exec-modal__form">
          <div className="field">
            <span className="field__label">Novo status *</span>
            {nextOptions.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Pedido em estado final — sem transições disponíveis.</p>
            ) : (
              <Select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">Selecione...</option>
                {nextOptions.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
              </Select>
            )}
          </div>

          {needsSchedule && (
            <div className="exam-exec-modal__row">
              <Input label="Data agendada" type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
              <Input label="Horário" type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
            </div>
          )}

          {needsResult && (
            <Textarea
              label="Resultado / laudo *"
              value={resultNotes}
              onChange={e => setResultNotes(e.target.value)}
              placeholder="Descreva o resultado ou laudo obtido..."
              rows={4}
            />
          )}

          <Input
            label="Observações"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Obs. operacional..."
          />

          {err && <Alert tone="danger">{err}</Alert>}
        </form>
      </div>
    </Modal>
  );
}

// ─── RequestCard ──────────────────────────────────────────────────────────────

function priorityClass(p) {
  if (p === "urgente") return "req-card__priority--urgent";
  if (p === "prioritario") return "req-card__priority--priority";
  return "req-card__priority--routine";
}

function statusClass(s) {
  if (s === "concluido") return "req-card__status--done";
  if (s === "cancelado") return "req-card__status--cancelled";
  if (["resultado_disponivel", "aguardando_resultado", "coletado"].includes(s)) return "req-card__status--progress";
  return "req-card__status--pending";
}

function RequestCard({ req, canExecute, onExecute }) {
  return (
    <div className="req-card">
      <div className="req-card__head">
        <div className="req-card__patient">{req.patientName || req.patientId}</div>
        <div className="req-card__chips">
          <span className={`req-card__priority ${priorityClass(req.priority)}`}>{PRIORITY_LABELS[req.priority] || req.priority}</span>
          <span className={`req-card__status ${statusClass(req.status)}`}>{STATUS_LABELS[req.status] || req.status}</span>
          {req.origin && req.origin !== "medicina" && (
            <span className="req-card__origin">{ORIGIN_LABELS[req.origin] || req.origin}</span>
          )}
        </div>
      </div>
      <div className="req-card__exams">
        {(req.exams || []).map((ex, i) => (
          <span key={i} className="req-card__exam-tag">{ex.name}{ex.urgency === "urgente" ? " ⚡" : ""}</span>
        ))}
      </div>
      <div className="req-card__meta">
        Solicitado por {req.requestedByName} · {fmtDate(String(req.requestedAt || "").slice(0, 10))}
        {req.scheduledDate && ` · Agendado: ${fmtDate(req.scheduledDate)}`}
        {req.executedByName && ` · Executado por ${req.executedByName}`}
      </div>
      {req.clinicalJustification && (
        <div className="req-card__justif">{req.clinicalJustification}</div>
      )}
      {req.resultNotes && (
        <div className="req-card__result">{req.resultNotes}</div>
      )}
      {canExecute && !["concluido", "cancelado"].includes(req.status) && (
        <div className="req-card__actions">
          <Button type="button" variant="secondary" size="sm" onClick={() => onExecute(req)}>
            Atualizar
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── ExamsPage ────────────────────────────────────────────────────────────────

function ExamsPage({ patients, user, token, onNavigatePatient }) {
  const [tab, setTab] = useState("exames");

  // ── Exames tab state ──
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addMode, setAddMode] = useState(null);
  const [form, setForm] = useState({ type: "Hemograma completo", name: "", date: "", result: "", notes: "" });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const fileRef = useRef(null);

  // ── Pedidos tab state ──
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [execTarget, setExecTarget] = useState(null);

  const canManage = canManageExams(user);
  const canExec = canExecuteExams(user);

  const filteredPats = patients
    .filter((patient) => matchesPatientSearch(patient, search))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"))
    .slice(0, 60);
  const selectedPatient = patients.find((patient) => patient.id === selectedId) || null;

  // Load exam requests
  const loadRequests = useCallback(async () => {
    setReqLoading(true);
    setReqError("");
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      if (filterOrigin) params.origin = filterOrigin;
      if (filterDate) params.date = filterDate;
      const res = await listExamRequests(token, params);
      setRequests(res?.data || []);
    } catch (e) {
      setReqError(e.message || "Erro ao carregar pedidos.");
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  }, [token, filterStatus, filterPriority, filterOrigin, filterDate]);

  useEffect(() => {
    if (tab === "pedidos") {
      loadRequests();
    }
  }, [tab, loadRequests]);

  async function loadExams(patientId) {
    if (!patientId) {
      setExams([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setExams(await listExams(token, patientId));
    } catch (err) {
      setError(err.message || "Erro ao carregar exames.");
      setExams([]);
    } finally {
      setLoading(false);
    }
  }

  function selectPatient(patient) {
    if (selectedId === patient.id) {
      setSelectedId(null);
      setExams([]);
      setAddMode(null);
      return;
    }
    setSelectedId(patient.id);
    setAddMode(null);
    setDeleteTarget(null);
    void loadExams(patient.id);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const title = form.type === "Outros" ? form.name.trim() : form.type;
    if (!title || !form.date) {
      setError("Preencha tipo e data.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const tag = addMode === "externo" ? "[EXAME EXTERNO — trazido pelo paciente]" : "[EXAME REALIZADO NO POSTO]";
      const notes = [
        tag,
        form.result.trim() ? `Resultado: ${form.result.trim()}` : "",
        form.notes.trim() ? `Obs: ${form.notes.trim()}` : ""
      ].filter(Boolean).join("\n");

      const created = await createExam(token, selectedId, {
        title,
        date: form.date,
        notes,
        source: addMode === "externo" ? "externo" : "posto"
      });

      for (const file of files) {
        const payload = await fileToPayload(file);
        await uploadExamAttachment(token, selectedId, created.id, payload);
      }

      setForm({ type: "Hemograma completo", name: "", date: "", result: "", notes: "" });
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      setAddMode(null);
      await loadExams(selectedId);
    } catch (err) {
      setError(err.message || "Erro ao salvar exame.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteExam() {
    if (!deleteTarget) return;
    if (deleteReason.trim().length < 5) return;

    setDeleteBusy(true);
    try {
      await deleteExam(token, selectedId, deleteTarget.id, deleteReason.trim());
      setDeleteTarget(null);
      setDeleteReason("");
      await loadExams(selectedId);
    } catch (err) {
      setError(err.message || "Erro ao excluir exame.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function fmtSize(bytes) {
    return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
  }

  const posto = exams.filter((exam) => !isExternalExam(exam));
  const externo = exams.filter((exam) => isExternalExam(exam));

  return (
    <div className="exams-page">
      <PageHeader eyebrow="Laboratório" title="Exames" subtitle="Pedidos de exame e resultados." />

      <div className="exams-tabs">
        <button
          className={`exams-tab-btn${tab === "exames" ? " is-active" : ""}`}
          onClick={() => setTab("exames")}
          type="button"
        >
          Resultados
        </button>
        <button
          className={`exams-tab-btn${tab === "pedidos" ? " is-active" : ""}`}
          onClick={() => setTab("pedidos")}
          type="button"
        >
          Pedidos
        </button>
      </div>

      {tab === "exames" && (
        <div className="exams-body">
          <div className="exams-sidebar">
            <div className="exams-sidebar__search">
              <span className="exams-sidebar__search-icon">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3"/><path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </span>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar paciente..." />
            </div>
            <div className="exams-pat-list">
              {filteredPats.length === 0 && <p className="exams-pat-empty">Nenhum paciente encontrado.</p>}
              {filteredPats.map((patient) => (
                <Button key={patient.id} className={`exams-pat-item${selectedId === patient.id ? " is-active" : ""}`} onClick={() => selectPatient(patient)} type="button" variant="ghost" size="sm">
                  <Avatar name={patient.name} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="exams-pat-item__name">{patient.name}</div>
                    <div className="exams-pat-item__sub">{catLabel([], patient.careCategory)}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="exams-panel">
            {!selectedPatient ? (
              <div className="exams-panel-empty">
                <svg width="48" height="48" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.25 }}>
                  <path d="M3 2h7l3 3v9H3V2z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="8" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M10 11.5l1.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                </svg>
                <span>Selecione um paciente para ver os exames</span>
              </div>
            ) : (
              <>
                <div className="exams-pat-header">
                  <div>
                    <h2>{selectedPatient.name}</h2>
                    <div className="exams-pat-header__sub">{catLabel([], selectedPatient.careCategory)}</div>
                  </div>
                  {onNavigatePatient && (
                    <Button variant="secondary" size="sm" onClick={() => onNavigatePatient(selectedPatient.id)}>
                      Ver ficha →
                    </Button>
                  )}
                </div>

                {canManage && (
                  <div className="exams-add-bar">
                    <Button type="button" className={`exams-add-btn exams-add-btn--posto${addMode === "posto" ? " is-active" : ""}`} onClick={() => setAddMode(addMode === "posto" ? null : "posto")} variant={addMode === "posto" ? "primary" : "secondary"} size="sm">
                      + Exame do posto
                    </Button>
                    <Button type="button" className={`exams-add-btn exams-add-btn--externo${addMode === "externo" ? " is-active" : ""}`} onClick={() => setAddMode(addMode === "externo" ? null : "externo")} variant={addMode === "externo" ? "primary" : "secondary"} size="sm">
                      + Exame externo
                    </Button>
                  </div>
                )}

                {addMode && (
                  <div className={`exams-add-form exams-add-form--${addMode}`}>
                    <div className="exams-add-form__title">
                      {addMode === "externo" ? "Exame externo — trazido pelo paciente" : "Exame realizado na unidade"}
                    </div>
                    <form onSubmit={handleSubmit} className="exams-add-form__fields">
                      <div className="exams-add-form__grid">
                        <div className="exams-add-form__field">
                          <span className="field__label">Tipo de exame</span>
                          <Select value={form.type} onChange={(event) => setForm((state) => ({ ...state, type: event.target.value }))}>
                            {EXAM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                          </Select>
                        </div>
                        <Input label="Data *" type="date" value={form.date} onChange={(event) => setForm((state) => ({ ...state, date: event.target.value }))} />
                      </div>

                      {form.type === "Outros" && (
                        <Input label="Nome do exame" value={form.name} onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))} placeholder="Informe o nome do exame" />
                      )}

                      <Textarea label="Resultado / laudo" value={form.result} onChange={(event) => setForm((state) => ({ ...state, result: event.target.value }))} placeholder="Descreva o resultado ou laudo..." rows={3} />
                      <Input label="Observações" value={form.notes} onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))} placeholder="Conduta, comparação com exame anterior..." />
                      <Input
                        label="Anexar arquivo (imagem ou PDF, máx 15MB)"
                        type="file"
                        ref={fileRef}
                        accept="image/*,application/pdf"
                        multiple
                        onChange={(event) => {
                          const nextFiles = Array.from(event.target.files || []);
                          if (nextFiles.some((file) => file.size > 15 * 1024 * 1024)) {
                            setError("Arquivo muito grande. O limite é 15MB por arquivo.");
                            return;
                          }
                          setError("");
                          setFiles(nextFiles);
                        }}
                      />
                      {files.length > 0 && (
                        <div className="exams-add-form__tags">
                          {files.map((file) => <span key={`${file.name}-${file.size}`} className="exams-add-form__tag">{file.name} · {fmtSize(file.size)}</span>)}
                        </div>
                      )}
                      {error && <Alert tone="danger">{error}</Alert>}
                      <div className="exams-add-form__actions">
                        <Button type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setAddMode(null)}>Cancelar</Button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="exams-section exams-section--posto">
                  <div className="exams-section-label">
                    <span className="exams-section-label__dot" />
                    Realizados na unidade ({posto.length})
                  </div>
                  {loading
                    ? <p className="exams-section-empty">Carregando...</p>
                    : !posto.length
                      ? <p className="exams-section-empty">Nenhum exame registrado.</p>
                      : posto.map((exam) => <ExamCard key={exam.id} exam={exam} canManage={canManage} onDelete={setDeleteTarget} onPreview={setPreview} />)}
                </div>

                <div className="exams-section exams-section--externo">
                  <div className="exams-section-label">
                    <span className="exams-section-label__dot" />
                    Trazidos pelo paciente ({externo.length})
                  </div>
                  {!externo.length
                    ? <p className="exams-section-empty">Nenhum exame externo registrado.</p>
                    : externo.map((exam) => <ExamCard key={exam.id} exam={exam} canManage={canManage} onDelete={setDeleteTarget} onPreview={setPreview} />)}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "pedidos" && (
        <div className="req-queue">
          <div className="req-queue__filters">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="">Todas as prioridades</option>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}>
              <option value="">Todas as origens</option>
              {Object.entries(ORIGIN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} placeholder="Data" />
            <Button type="button" variant="secondary" size="sm" onClick={loadRequests}>Atualizar</Button>
          </div>

          {reqError && <Alert tone="danger">{reqError}</Alert>}

          {reqLoading ? (
            <p className="exams-section-empty">Carregando pedidos...</p>
          ) : requests.length === 0 ? (
            <p className="exams-section-empty">Nenhum pedido encontrado.</p>
          ) : (
            <div className="req-queue__list">
              {requests.map(req => (
                <RequestCard key={req.id} req={req} canExecute={canExec} onExecute={setExecTarget} />
              ))}
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <Modal
          title="Excluir exame"
          onClose={() => {
            if (deleteBusy) return;
            setDeleteTarget(null);
            setDeleteReason("");
          }}
          actions={
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => {
                if (deleteBusy) return;
                setDeleteTarget(null);
                setDeleteReason("");
              }}>
                Cancelar
              </Button>
              <Button type="button" variant="danger" size="sm" disabled={deleteBusy || deleteReason.trim().length < 5} onClick={confirmDeleteExam}>
                {deleteBusy ? "Excluindo..." : "Excluir exame"}
              </Button>
            </>
          }
        >
          <p className="exams-section-empty" style={{ marginTop: 0 }}>
            Informe o motivo da exclusão para manter a rastreabilidade clínica.
          </p>
          <Textarea label="Justificativa obrigatória" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Ex.: anexo duplicado, lançamento incorreto, exame registrado em paciente errado." rows={4} />
        </Modal>
      )}

      {preview && (
        <Modal
          title={preview.name}
          onClose={() => setPreview(null)}
          actions={(
            <a
              href={preview.url}
              download={preview.name}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-1)", font: "400 var(--t-sm) var(--font-sans)", padding: "var(--s-1) var(--s-3)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", color: "var(--text-muted)", textDecoration: "none" }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 3v8M5 8l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              Baixar
            </a>
          )}
        >
          <div className="exams-preview">
            {isImg(preview.contentType)
              ? <img className="exams-preview__img" src={preview.url} alt={preview.name} />
              : <iframe className="exams-preview__frame" src={preview.url} title={preview.name} />}
          </div>
        </Modal>
      )}

      {execTarget && (
        <ExamExecutionModal
          request={execTarget}
          token={token}
          onClose={() => setExecTarget(null)}
          onSuccess={() => {
            setExecTarget(null);
            loadRequests();
          }}
        />
      )}
    </div>
  );
}

export default ExamsPage;
