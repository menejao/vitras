import { useMemo, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import PageShell from "../components/layout/PageShell";
import PageToolbar from "../components/layout/PageToolbar";
import KpiGrid from "../components/layout/KpiGrid";
import MainContent from "../components/layout/MainContent";
import Button from "../components/ui/Button";
import { Tabs, Tab } from "../components/ui/Tabs";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Textarea from "../components/ui/Textarea";
import EmptyState from "../components/ui/EmptyState";
import KPI from "../components/ui/KPI";

const INTERNAL_DEPTS = [
  { value: "medico",       label: "Médico(a)"         },
  { value: "enfermagem",   label: "Enfermagem"         },
  { value: "psicologia",   label: "Psicologia"         },
  { value: "odontologia",  label: "Odontologia"        },
  { value: "assistencia",  label: "Assistência Social" },
  { value: "nutricao",     label: "Nutrição"           },
  { value: "fisioterapia", label: "Fisioterapia"       },
  { value: "farmacia",     label: "Farmácia"           },
];

const EXTERNAL_SPECIALTIES = [
  "Cardiologia","Ortopedia","Neurologia","Psiquiatria","Ginecologia",
  "Urologia","Dermatologia","Oftalmologia","Otorrinolaringologia",
  "Endocrinologia","Nefrologia","Pneumologia","Reumatologia",
  "Gastroenterologia","Oncologia","Fisioterapia","Nutrição",
  "Psicologia","Serviço Social","Pronto-Socorro","Hospital",
];

const INTERNAL_STATUS = {
  waiting:     { label: "Aguardando",     cls: "referrals-status-sel--pending"   },
  in_progress: { label: "Em atendimento", cls: "referrals-status-sel--scheduled" },
  done:        { label: "Finalizado",     cls: "referrals-status-sel--done"      },
  cancelled:   { label: "Cancelado",      cls: "referrals-status-sel--cancelled" },
};

const EXTERNAL_STATUS = {
  pending:   { label: "Aguardando", cls: "referrals-status-sel--pending"   },
  scheduled: { label: "Agendado",   cls: "referrals-status-sel--scheduled" },
  done:      { label: "Realizado",  cls: "referrals-status-sel--done"      },
  cancelled: { label: "Cancelado",  cls: "referrals-status-sel--cancelled" },
};

const PRIORITY_LABEL = { urgent: "Urgente", priority: "Prioritário", normal: "Normal", routine: "Rotina", fit_in: "Encaixe" };

function fmtDateLocal(d) {
  if (!d) return "—";
  try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

const IconPlus  = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const IconPrint = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="2" y="5" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5V3h8v2M4 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
const IconEdit  = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>;
const IconTrash = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;

function StatusSelect({ status, statusMap, onChange }) {
  const cfg = statusMap[status] || {};
  return (
    <Select
      inputClassName={`referrals-status-sel ${cfg.cls || ""}`}
      value={status}
      onChange={(e) => onChange(e.target.value)}
    >
      {Object.entries(statusMap).map(([k, v]) => (
        <option key={k} value={k}>{v.label}</option>
      ))}
    </Select>
  );
}

function PriorityBadge({ priority }) {
  const label = PRIORITY_LABEL[priority];
  if (!label) return null;
  const cls = priority === "urgent" ? "referrals-priority--urgent" : priority === "priority" ? "referrals-priority--priority" : "";
  return <span className={`referrals-priority ${cls}`}>{label}</span>;
}

function InternalReferralsView({ referrals, patients, users, onCreate, onUpdate, onDelete }) {
  const internal = referrals.filter(r => r.refType === "internal");

  const [filterDept, setFilterDept]     = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [search, setSearch]             = useState("");
  const [showForm, setShowForm]         = useState(false);
  const [editId, setEditId]             = useState(null);
  const [submitError, setSubmitError]   = useState("");
  const [form, setForm] = useState({
    patientId: "", refType: "internal", destinationDept: "medico",
    destinationUserId: "", reason: "", priority: "normal", notes: "", status: "waiting",
  });

  const clinicians = useMemo(
    () => users.filter(u => ["doctor","nurse","nurse_manager","psychologist","dentist"].includes(u.role)),
    [users],
  );

  const filtered = useMemo(() => internal.filter(r => {
    const deptOk   = filterDept === "all" || r.destinationDept === filterDept;
    const statusOk = filterStatus === "all"
      || (filterStatus === "active" ? r.status !== "done" && r.status !== "cancelled" : r.status === filterStatus);
    const searchOk = !search.trim()
      || (r.patientName || "").toLowerCase().includes(search.toLowerCase());
    return deptOk && statusOk && searchOk;
  }), [internal, filterDept, filterStatus, search]);

  const waiting = internal.filter(r => r.status === "waiting").length;
  const inProg  = internal.filter(r => r.status === "in_progress").length;
  const urgent  = internal.filter(r => r.status === "waiting" && r.priority === "urgent").length;

  function openNew() {
    setForm({ patientId: "", refType: "internal", destinationDept: "medico", destinationUserId: "", reason: "", priority: "normal", notes: "", status: "waiting" });
    setEditId(null);
    setSubmitError("");
    setShowForm(true);
  }

  function openEdit(ref) {
    setForm({ patientId: ref.patientId, refType: "internal", destinationDept: ref.destinationDept || "medico", destinationUserId: ref.destinationUserId || "", reason: ref.reason, priority: ref.priority || "normal", notes: ref.notes || "", status: ref.status });
    setEditId(ref.id);
    setSubmitError("");
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.patientId || !form.reason) { setSubmitError("Paciente e motivo são obrigatórios."); return; }
    try {
      setSubmitError("");
      if (editId) await onUpdate(editId, form);
      else        await onCreate(form);
      setShowForm(false);
    } catch (err) {
      setSubmitError(err?.message || "Erro ao salvar encaminhamento.");
    }
  }

  const deptLabel = (d) => INTERNAL_DEPTS.find(x => x.value === d)?.label || d;

  return (
    <>
      <KpiGrid>
        <KPI label="Na fila"        value={waiting} className={`card${waiting > 0 ? " kpi--warning" : ""}`} />
        <KPI label="Em atendimento" value={inProg}  className="card kpi--info" />
        <KPI label="Urgentes"       value={urgent}  className={`card${urgent > 0  ? " kpi--danger"  : ""}`} />
        <KPI label="Total"          value={internal.length} className="card" />
      </KpiGrid>

      <PageToolbar className="referrals-toolbar">
        <Tabs>
          {[["all","Todos"],["medico","Médico"],["enfermagem","Enfermagem"],["psicologia","Psicologia"],["odontologia","Odonto"],["assistencia","Assist. Social"]].map(([k, l]) => (
            <Tab key={k} active={filterDept === k} onClick={() => setFilterDept(k)}>{l}</Tab>
          ))}
        </Tabs>
        <div className="ref-toolbar-end">
          <Select
            inputClassName="ref-status-filter"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            aria-label="Filtrar por status"
          >
            <option value="active">Ativos</option>
            <option value="waiting">Aguardando</option>
            <option value="in_progress">Em atendimento</option>
            <option value="done">Finalizados</option>
            <option value="all">Todos</option>
          </Select>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar paciente..." className="referrals-toolbar__search" />
          <Button onClick={openNew}><IconPlus /> Encaminhar paciente</Button>
        </div>
      </PageToolbar>

      <MainContent className="referrals-list">
        {!filtered.length ? (
          <EmptyState title="Nenhum encaminhamento na fila" />
        ) : (
          <div className="ref-queue-list">
            {filtered.map(r => (
              <div key={r.id} className={`ref-queue-card${r.priority === "urgent" ? " ref-queue-card--urgent" : ""}`}>
                <div className="ref-queue-card__dept-badge">{deptLabel(r.destinationDept)}</div>
                <div className="ref-queue-card__body">
                  <div className="ref-queue-card__name">{r.patientName}</div>
                  <div className="ref-queue-card__reason">{r.reason}</div>
                  {r.notes && <div className="ref-queue-card__notes">{r.notes}</div>}
                  <div className="ref-queue-card__meta">
                    {r.doctorName && <span>Solicitante: {r.doctorName}</span>}
                    <span>·</span>
                    <span>{fmtDateLocal(r.date || r.createdAt)}</span>
                  </div>
                </div>
                <div className="ref-queue-card__actions">
                  <PriorityBadge priority={r.priority} />
                  <StatusSelect status={r.status || "waiting"} statusMap={INTERNAL_STATUS} onChange={s => onUpdate(r.id, { status: s })} />
                  <div className="referrals-action-row">
                    <Button variant="ghost" size="sm" iconOnly onClick={() => openEdit(r)} title="Editar"><IconEdit /></Button>
                    <Button variant="ghost" size="sm" iconOnly onClick={() => onDelete(r.id)} title="Remover"><IconTrash /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </MainContent>

      {showForm && (
        <Modal
          title={editId ? "Editar encaminhamento interno" : "Encaminhar paciente"}
          onClose={() => setShowForm(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" form="internal-ref-form">Encaminhar</Button>
            </>
          }
        >
          {submitError && <div className="error">{submitError}</div>}
          <form id="internal-ref-form" onSubmit={submit} className="field-grid field-grid--no-pad">
            <Select className="field--span-2" label="Paciente *" value={form.patientId} onChange={e => setForm(s => ({ ...s, patientId: e.target.value }))}>
              <option value="">Selecionar...</option>
              {[...patients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Select label="Destino (setor) *" value={form.destinationDept} onChange={e => setForm(s => ({ ...s, destinationDept: e.target.value }))}>
              {INTERNAL_DEPTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </Select>
            <Select label="Profissional (opcional)" value={form.destinationUserId} onChange={e => setForm(s => ({ ...s, destinationUserId: e.target.value }))}>
              <option value="">Qualquer profissional</option>
              {clinicians.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
            <Select label="Prioridade" value={form.priority} onChange={e => setForm(s => ({ ...s, priority: e.target.value }))}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgente</option>
              <option value="fit_in">Encaixe</option>
            </Select>
            <Select label="Status" value={form.status} onChange={e => setForm(s => ({ ...s, status: e.target.value }))}>
              {Object.entries(INTERNAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <Textarea className="field--span-2" label="Motivo / hipótese diagnóstica *" value={form.reason} onChange={e => setForm(s => ({ ...s, reason: e.target.value }))} rows={3} placeholder="Descreva o motivo do encaminhamento..." />
            <Input className="field--span-2" label="Observações" value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} placeholder="Informações para o profissional de destino..." />
          </form>
        </Modal>
      )}
    </>
  );
}

function ExternalReferralsView({ referrals, patients, onCreate, onUpdate, onDelete }) {
  const external = referrals.filter(r => !r.refType || r.refType === "external");

  const [showForm, setShowForm]         = useState(false);
  const [showDoc, setShowDoc]           = useState(null);
  const [editId, setEditId]             = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch]             = useState("");
  const [submitError, setSubmitError]   = useState("");
  const [form, setForm] = useState({
    patientId: "", refType: "external", specialty: "Cardiologia",
    reason: "", priority: "routine", date: "", notes: "", status: "pending",
  });

  const filtered = external.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (search.trim() && !(r.patientName || "").toLowerCase().includes(search.toLowerCase()) && !(r.specialty || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = useMemo(() => ({
    all:       external.length,
    pending:   external.filter(r => r.status === "pending").length,
    scheduled: external.filter(r => r.status === "scheduled").length,
    done:      external.filter(r => r.status === "done").length,
  }), [external]);

  function openNew() {
    setForm({ patientId: "", refType: "external", specialty: "Cardiologia", reason: "", priority: "routine", date: new Date().toISOString().slice(0, 10), notes: "", status: "pending" });
    setEditId(null);
    setSubmitError("");
    setShowForm(true);
  }

  function openEdit(ref) {
    setForm({ patientId: ref.patientId, refType: "external", specialty: ref.specialty, reason: ref.reason, priority: ref.priority, date: ref.date, notes: ref.notes || "", status: ref.status });
    setEditId(ref.id);
    setSubmitError("");
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.patientId || !form.reason) return;
    try {
      setSubmitError("");
      if (editId) await onUpdate(editId, form);
      else        await onCreate(form);
      setShowForm(false);
    } catch (err) {
      setSubmitError(err?.message || "Erro ao salvar encaminhamento.");
    }
  }

  return (
    <>
      <KpiGrid>
        <KPI label="Total"      value={counts.all}       helper="encaminhamentos" className="card" />
        <KPI label="Aguardando" value={counts.pending}   helper="em regulação"   className="card" />
        <KPI label="Agendado"   value={counts.scheduled} helper="com data"        className="card" />
        <KPI label="Realizado"  value={counts.done}      helper="finalizados"     className="card" />
      </KpiGrid>

      <PageToolbar className="referrals-toolbar">
        <Tabs>
          {[["all","Todos"],["pending","Aguardando"],["scheduled","Agendado"],["done","Realizado"]].map(([k, l]) => (
            <Tab key={k} active={filterStatus === k} onClick={() => setFilterStatus(k)}>
              {l} <span className="tab__count">{counts[k]}</span>
            </Tab>
          ))}
        </Tabs>
        <div className="ref-toolbar-end">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar paciente ou especialidade..." className="referrals-toolbar__search" />
          <Button onClick={openNew}><IconPlus /> Novo encaminhamento</Button>
        </div>
      </PageToolbar>

      <MainContent className="referrals-list">
        {!filtered.length ? (
          <EmptyState title="Nenhum encaminhamento encontrado" />
        ) : (
          <div className="card card--noPad overflow-hidden">
            <table className="patients-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Especialidade</th>
                  <th>Prioridade</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className="referrals-table__patient-name">{r.patientName}</div>
                      <div className="referrals-table__patient-meta">{r.doctorName}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.specialty}</td>
                    <td><PriorityBadge priority={r.priority} /></td>
                    <td className="muted small">{fmtDateLocal(r.date)}</td>
                    <td>
                      <StatusSelect status={r.status || "pending"} statusMap={EXTERNAL_STATUS} onChange={s => onUpdate(r.id, { status: s })} />
                    </td>
                    <td>
                      <div className="referrals-action-row">
                        <Button variant="ghost" size="sm" iconOnly onClick={() => setShowDoc(r)} title="Ver documento"><IconPrint /></Button>
                        <Button variant="ghost" size="sm" iconOnly onClick={() => openEdit(r)} title="Editar"><IconEdit /></Button>
                        <Button variant="ghost" size="sm" iconOnly onClick={() => onDelete(r.id)} title="Excluir"><IconTrash /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MainContent>

      {showForm && (
        <Modal
          title={editId ? "Editar encaminhamento" : "Novo encaminhamento externo"}
          onClose={() => setShowForm(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" form="external-ref-form">Salvar</Button>
            </>
          }
        >
          {submitError && <div className="error">{submitError}</div>}
          <form id="external-ref-form" onSubmit={submit} className="field-grid field-grid--no-pad">
            <Select className="field--span-2" label="Paciente *" value={form.patientId} onChange={e => setForm(s => ({ ...s, patientId: e.target.value }))}>
              <option value="">Selecionar...</option>
              {[...patients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Select label="Especialidade" value={form.specialty} onChange={e => setForm(s => ({ ...s, specialty: e.target.value }))}>
              {EXTERNAL_SPECIALTIES.map(sp => <option key={sp}>{sp}</option>)}
            </Select>
            <Select label="Prioridade" value={form.priority} onChange={e => setForm(s => ({ ...s, priority: e.target.value }))}>
              <option value="routine">Rotina</option>
              <option value="priority">Prioritário</option>
              <option value="urgent">Urgente</option>
            </Select>
            <Input label="Data" type="date" value={form.date} onChange={e => setForm(s => ({ ...s, date: e.target.value }))} />
            <Select label="Status" value={form.status} onChange={e => setForm(s => ({ ...s, status: e.target.value }))}>
              {Object.entries(EXTERNAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <Textarea className="field--span-2" label="Motivo / hipótese diagnóstica *" value={form.reason} onChange={e => setForm(s => ({ ...s, reason: e.target.value }))} rows={3} placeholder="Descreva o motivo do encaminhamento..." />
            <Input className="field--span-2" label="Observações adicionais" value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} placeholder="Informações relevantes para o especialista..." />
          </form>
        </Modal>
      )}

      {showDoc && (
        <Modal
          title="Guia de Encaminhamento"
          onClose={() => setShowDoc(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => window.print()}><IconPrint /> Imprimir</Button>
              <Button onClick={() => setShowDoc(null)}>Fechar</Button>
            </>
          }
        >
          <div className="referrals-doc">
            <div className="referrals-doc__title-block">
              <div className="referrals-doc__title">GUIA DE ENCAMINHAMENTO</div>
              <div className="referrals-doc__subtitle">Unidade Básica de Saúde</div>
            </div>
            <div className="referrals-doc__grid">
              <div><strong>Paciente:</strong> {showDoc.patientName}</div>
              <div><strong>Data:</strong> {fmtDateLocal(showDoc.date)}</div>
              <div><strong>Especialidade:</strong> {showDoc.specialty}</div>
              <div><strong>Prioridade:</strong> {PRIORITY_LABEL[showDoc.priority] || showDoc.priority}</div>
            </div>
            <div className="referrals-doc__field">
              <strong>Motivo:</strong><br />
              <span style={{ whiteSpace: "pre-wrap" }}>{showDoc.reason}</span>
            </div>
            {showDoc.notes && <div className="referrals-doc__field"><strong>Observações:</strong><br />{showDoc.notes}</div>}
            <div className="referrals-doc__footer">
              <span>Profissional: {showDoc.doctorName}</span>
              <span>Emitido em: {showDoc.createdAt ? new Date(showDoc.createdAt).toLocaleDateString("pt-BR") : "—"}</span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function ReferralsPage({
  patients,
  users = [],
  referrals = [],
  referralsLoading = false,
  referralsError = "",
  onCreateReferral,
  onUpdateReferral,
  onDeleteReferral,
}) {
  const [mode, setMode] = useState("internal");

  return (
    <PageShell className="referrals-page">
      <PageHeader
        eyebrow="Fluxo Clínico"
        title="Encaminhamentos"
        subtitle="Fila interna da unidade e encaminhamentos para especialistas externos."
      />

      {referralsError && !referralsLoading && (
        <div className="error" style={{ margin: "0 var(--s-6)" }}>{referralsError}</div>
      )}

      <div className="ref-mode-switcher">
        <Button
          variant="ghost"
          className={`ref-mode-btn${mode === "internal" ? " is-active" : ""}`}
          onClick={() => setMode("internal")}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L3 5v9h4v-4h2v4h4V5L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          Fila Interna
        </Button>
        <Button
          variant="ghost"
          className={`ref-mode-btn${mode === "external" ? " is-active" : ""}`}
          onClick={() => setMode("external")}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h12M9 4l5 4-5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Externos / Especialistas
        </Button>
      </div>

      {mode === "internal" && (
        <InternalReferralsView
          referrals={referrals}
          patients={patients}
          users={users}
          onCreate={onCreateReferral}
          onUpdate={onUpdateReferral}
          onDelete={onDeleteReferral}
        />
      )}

      {mode === "external" && (
        <ExternalReferralsView
          referrals={referrals}
          patients={patients}
          onCreate={onCreateReferral}
          onUpdate={onUpdateReferral}
          onDelete={onDeleteReferral}
        />
      )}
    </PageShell>
  );
}

export default ReferralsPage;
