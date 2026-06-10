import { useMemo, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import PageShell from "../components/layout/PageShell";
import KpiGrid from "../components/layout/KpiGrid";
import MainContent from "../components/layout/MainContent";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Textarea from "../components/ui/Textarea";
import KPI from "../components/ui/KPI";

const SPECIALTIES = [
  "Cardiologia","Ortopedia","Neurologia","Psiquiatria","Ginecologia",
  "Urologia","Dermatologia","Oftalmologia","Otorrinolaringologia",
  "Endocrinologia","Nefrologia","Pneumologia","Reumatologia",
  "Gastroenterologia","Oncologia","Fisioterapia","Nutrição",
  "Psicologia","Serviço Social","Pronto-Socorro","Hospital","Outras",
];

const STATUS_MAP = {
  pending:   { label: "Aguardando",  cls: "referrals-status-sel--pending"   },
  regulated: { label: "Regulado",    cls: "referrals-status-sel--regulated"  },
  scheduled: { label: "Agendado",    cls: "referrals-status-sel--scheduled"  },
  done:      { label: "Realizado",   cls: "referrals-status-sel--done"       },
  cancelled: { label: "Cancelado",   cls: "referrals-status-sel--cancelled"  },
};

const PRIORITY_MAP = {
  urgent:   { label: "Urgente",      cls: "ref-priority-chip--urgent"   },
  priority: { label: "Prioritário",  cls: "ref-priority-chip--priority" },
  routine:  { label: "Rotina",       cls: "ref-priority-chip--routine"  },
};

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

const IconPlus  = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const IconPrint = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="5" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5V3h8v2M4 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
const IconEdit  = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>;
const IconTrash = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;

function StatusSelect({ status, onChange }) {
  const cfg = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <Select
      inputClassName={`referrals-status-sel ${cfg.cls}`}
      value={status || "pending"}
      onChange={(e) => onChange(e.target.value)}
    >
      {Object.entries(STATUS_MAP).map(([k, v]) => (
        <option key={k} value={k}>{v.label}</option>
      ))}
    </Select>
  );
}

function PriorityChip({ priority }) {
  const cfg = PRIORITY_MAP[priority] || PRIORITY_MAP.routine;
  return <span className={`ref-priority-chip ${cfg.cls}`}>{cfg.label}</span>;
}

function ReferralCard({ referral, onUpdate, onDelete, onPrint, onEdit }) {
  return (
    <div className={`ref-card${referral.priority === "urgent" ? " ref-card--urgent" : referral.priority === "priority" ? " ref-card--priority" : ""}`}>
      <div className="ref-card__patient">
        <div className="ref-card__patient-name">{referral.patientName}</div>
        {referral.doctorName && <div className="ref-card__patient-meta">{referral.doctorName}</div>}
      </div>
      <div className="ref-card__body">
        <div className="ref-card__specialty">{referral.specialty}</div>
        {referral.reason && (
          <div className="ref-card__reason">{referral.reason}</div>
        )}
      </div>
      <div className="ref-card__date">{fmtDate(referral.date)}</div>
      <PriorityChip priority={referral.priority} />
      <StatusSelect status={referral.status} onChange={(s) => onUpdate(referral.id, { status: s })} />
      <div className="referrals-action-row">
        <Button variant="ghost" size="sm" iconOnly onClick={() => onPrint(referral)} title="Ver guia"><IconPrint /></Button>
        <Button variant="ghost" size="sm" iconOnly onClick={() => onEdit(referral)} title="Editar"><IconEdit /></Button>
        <Button variant="ghost" size="sm" iconOnly onClick={() => onDelete(referral.id)} title="Excluir"><IconTrash /></Button>
      </div>
    </div>
  );
}

const DEFAULT_FORM = {
  patientId: "", specialty: "Cardiologia", reason: "", priority: "routine",
  date: new Date().toISOString().slice(0, 10), notes: "", status: "pending",
};

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
  const [showForm, setShowForm]       = useState(false);
  const [showDoc, setShowDoc]         = useState(null);
  const [editId, setEditId]           = useState(null);
  const [form, setForm]               = useState(DEFAULT_FORM);
  const [submitError, setSubmitError] = useState("");

  const [search, setSearch]                   = useState("");
  const [filterStatus, setFilterStatus]       = useState("all");
  const [filterPriority, setFilterPriority]   = useState("all");
  const [filterSpecialty, setFilterSpecialty] = useState("all");
  const [filterFrom, setFilterFrom]           = useState("");

  const counts = useMemo(() => ({
    pending:   referrals.filter((r) => r.status === "pending").length,
    regulated: referrals.filter((r) => r.status === "regulated").length,
    scheduled: referrals.filter((r) => r.status === "scheduled").length,
    done:      referrals.filter((r) => r.status === "done").length,
    urgent:    referrals.filter((r) => r.priority === "urgent" && r.status !== "done" && r.status !== "cancelled").length,
  }), [referrals]);

  const filtered = useMemo(() => referrals.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterPriority !== "all" && r.priority !== filterPriority) return false;
    if (filterSpecialty !== "all" && r.specialty !== filterSpecialty) return false;
    if (filterFrom && r.date && r.date < filterFrom) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (r.patientName || "").toLowerCase().includes(q)
          || (r.specialty   || "").toLowerCase().includes(q)
          || (r.doctorName  || "").toLowerCase().includes(q);
    }
    return true;
  }), [referrals, filterStatus, filterPriority, filterSpecialty, filterFrom, search]);

  function openNew() {
    setForm({ ...DEFAULT_FORM, date: new Date().toISOString().slice(0, 10) });
    setEditId(null);
    setSubmitError("");
    setShowForm(true);
  }

  function openEdit(ref) {
    setForm({
      patientId: ref.patientId,
      specialty: ref.specialty,
      reason: ref.reason,
      priority: ref.priority || "routine",
      date: ref.date,
      notes: ref.notes || "",
      status: ref.status || "pending",
    });
    setEditId(ref.id);
    setSubmitError("");
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.patientId || !form.reason.trim()) {
      setSubmitError("Paciente e motivo são obrigatórios.");
      return;
    }
    try {
      setSubmitError("");
      if (editId) await onUpdateReferral(editId, form);
      else        await onCreateReferral(form);
      setShowForm(false);
    } catch (err) {
      setSubmitError(err?.message || "Erro ao salvar encaminhamento.");
    }
  }

  const sortedPatients = useMemo(
    () => [...patients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [patients],
  );

  const uniqueSpecialties = useMemo(
    () => [...new Set(referrals.map((r) => r.specialty).filter(Boolean))].sort(),
    [referrals],
  );

  return (
    <PageShell className="referrals-page">
      <PageHeader
        eyebrow="REGULAÇÃO E REFERÊNCIA"
        title="Encaminhamentos"
        subtitle="Gestão de encaminhamentos externos, especialistas e acompanhamento regulatório dos pacientes."
        actions={<Button onClick={openNew}><IconPlus /> Novo encaminhamento</Button>}
      />

      <KpiGrid>
        <KPI label="Pendentes"   value={counts.pending}   helper="aguardando regulação" className={`card${counts.pending  > 0 ? " kpi--warning" : ""}`} />
        <KPI label="Regulados"   value={counts.regulated} helper="em regulação"          className="card kpi--info" />
        <KPI label="Agendados"   value={counts.scheduled} helper="com data marcada"      className="card" />
        <KPI label="Realizados"  value={counts.done}      helper="finalizados"           className="card" />
        <KPI label="Urgentes"    value={counts.urgent}    helper="ativos"                className={`card${counts.urgent  > 0 ? " kpi--danger" : ""}`} />
      </KpiGrid>

      {referralsError && !referralsLoading && (
        <div className="error" style={{ margin: "0 var(--s-6)" }}>{referralsError}</div>
      )}

      <div className="referrals-filter-bar">
        <div className="referrals-filter-bar__search">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente, especialidade ou profissional..."
          />
        </div>
        <Select
          inputClassName="ref-filter-select"
          value={filterSpecialty}
          onChange={(e) => setFilterSpecialty(e.target.value)}
          aria-label="Especialidade"
        >
          <option value="all">Todas especialidades</option>
          {uniqueSpecialties.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
        </Select>
        <Select
          inputClassName="ref-filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Status"
        >
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select
          inputClassName="ref-filter-select"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          aria-label="Prioridade"
        >
          <option value="all">Qualquer prioridade</option>
          {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Input
          type="date"
          inputClassName="ref-filter-date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          title="A partir de"
        />
      </div>

      <MainContent className="referrals-list">
        {referralsLoading ? (
          <div className="ref-empty">
            <span>Carregando encaminhamentos...</span>
          </div>
        ) : !filtered.length ? (
          <div className="ref-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ opacity: .22 }}>
              <path d="M9 12h6M9 16h4M6 20h12a2 2 0 0 0 2-2V8l-5-5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <p className="ref-empty__title">Nenhum encaminhamento encontrado.</p>
            <p className="ref-empty__sub">Os encaminhamentos externos e regulações dos pacientes aparecerão aqui.</p>
            <Button onClick={openNew} variant="secondary" size="sm"><IconPlus /> Novo encaminhamento</Button>
          </div>
        ) : (
          <div className="ref-list">
            {filtered.map((r) => (
              <ReferralCard
                key={r.id}
                referral={r}
                onUpdate={onUpdateReferral}
                onDelete={onDeleteReferral}
                onPrint={setShowDoc}
                onEdit={openEdit}
              />
            ))}
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
              <Button type="submit" form="referral-form">
                {editId ? "Salvar alterações" : "Criar encaminhamento"}
              </Button>
            </>
          }
        >
          {submitError && <div className="error">{submitError}</div>}
          <form id="referral-form" onSubmit={submit} className="field-grid field-grid--no-pad">
            <Select
              className="field--span-2"
              label="Paciente *"
              value={form.patientId}
              onChange={(e) => setForm((s) => ({ ...s, patientId: e.target.value }))}
            >
              <option value="">Selecionar paciente...</option>
              {sortedPatients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Select
              label="Especialidade / serviço de destino *"
              value={form.specialty}
              onChange={(e) => setForm((s) => ({ ...s, specialty: e.target.value }))}
            >
              {SPECIALTIES.map((sp) => <option key={sp}>{sp}</option>)}
            </Select>
            <Select
              label="Prioridade"
              value={form.priority}
              onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}
            >
              <option value="routine">Rotina</option>
              <option value="priority">Prioritário</option>
              <option value="urgent">Urgente</option>
            </Select>
            <Input
              label="Data da solicitação *"
              type="date"
              value={form.date}
              onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
            >
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <Textarea
              className="field--span-2"
              label="Motivo clínico / hipótese diagnóstica *"
              value={form.reason}
              onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))}
              rows={3}
              placeholder="Descreva o motivo do encaminhamento, hipótese diagnóstica e CID se disponível..."
            />
            <Input
              className="field--span-2"
              label="Unidade reguladora / observações"
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              placeholder="Unidade de destino, SISREG, observações para o especialista..."
            />
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
              <div><strong>Data:</strong> {fmtDate(showDoc.date)}</div>
              <div><strong>Especialidade:</strong> {showDoc.specialty}</div>
              <div><strong>Prioridade:</strong> {PRIORITY_MAP[showDoc.priority]?.label || showDoc.priority}</div>
              <div><strong>Status:</strong> {STATUS_MAP[showDoc.status]?.label || showDoc.status}</div>
              <div><strong>Profissional:</strong> {showDoc.doctorName || "—"}</div>
            </div>
            <div className="referrals-doc__field">
              <strong>Motivo / hipótese:</strong><br />
              <span style={{ whiteSpace: "pre-wrap" }}>{showDoc.reason}</span>
            </div>
            {showDoc.notes && (
              <div className="referrals-doc__field">
                <strong>Unidade / observações:</strong><br />{showDoc.notes}
              </div>
            )}
            <div className="referrals-doc__footer">
              <span>Emitido em: {showDoc.createdAt ? new Date(showDoc.createdAt).toLocaleDateString("pt-BR") : "—"}</span>
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

export default ReferralsPage;
