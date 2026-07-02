import { useState, useMemo } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Avatar from "../components/ui/Avatar";
import { createRecord, getPatientHistory } from "../api";
import { matchesPatientSearch } from "../utils/clinical";
import { fmtDate, initials } from "../utils/formatting";
import { hasCapability } from "../utils/roles";

const PAGE_SIZE = 20;

const WORKSPACE_TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "odontograma", label: "Odontograma" },
  { id: "procedimentos", label: "Procedimentos" },
  { id: "evolucao", label: "Evolução" },
  { id: "plano", label: "Plano de Tratamento" },
  { id: "historico", label: "Histórico" },
];

const DENTAL_ICON = (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5.5c-1.5-2-4-2.5-5.5-1C4.5 6 4 8 5 10.5c.7 1.8 1.5 5.5 2.5 7 .5 1 1.5 1 2 0 .3-.6.5-1.5.5-3 0-1.5 1-2 2-2s2 .5 2 2c0 1.5.2 2.4.5 3 .5 1 1.5 1 2 0 1-1.5 1.8-5.2 2.5-7 1-2.5.5-4.5-1.5-6-1.5-1.5-4-1-5.5 1z"/>
  </svg>
);

function WorkspaceResumo({ patient, history }) {
  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate + "T12:00:00").getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  const dentalHistory = Array.isArray(history)
    ? history.filter(r => r.metadata?.consultKind === "odontologia")
    : null;
  const lastVisit = dentalHistory?.[0];

  return (
    <div className="specialty-panel__form" style={{ display: "block" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)", marginBottom: "var(--s-4)" }}>
        <div className="card" style={{ padding: "var(--s-3)" }}>
          <div style={{ fontSize: ".7rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "var(--s-1)" }}>Idade</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{age !== null ? `${age} anos` : "—"}</div>
        </div>
        <div className="card" style={{ padding: "var(--s-3)" }}>
          <div style={{ fontSize: ".7rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "var(--s-1)" }}>Última consulta odonto</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{lastVisit ? fmtDate(lastVisit.date) : "—"}</div>
        </div>
        <div className="card" style={{ padding: "var(--s-3)", gridColumn: "span 2" }}>
          <div style={{ fontSize: ".7rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "var(--s-1)" }}>Total de atendimentos odontológicos</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{dentalHistory !== null ? dentalHistory.length : "—"}</div>
        </div>
      </div>
      {patient.chronicConditions?.length > 0 && (
        <div>
          <div style={{ fontSize: ".7rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "var(--s-1)" }}>Condições crônicas</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>
            {patient.chronicConditions.map(c => (
              <span key={c} style={{ fontSize: ".75rem", padding: "2px 8px", borderRadius: "var(--r-full)", background: "var(--teal-1)", color: "var(--teal-7)", fontWeight: 600 }}>{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceOdontograma() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--s-8) var(--s-4)", textAlign: "center", gap: "var(--s-3)" }}>
      <div style={{ opacity: 0.18, color: "var(--navy)" }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5.5c-1.5-2-4-2.5-5.5-1C4.5 6 4 8 5 10.5c.7 1.8 1.5 5.5 2.5 7 .5 1 1.5 1 2 0 .3-.6.5-1.5.5-3 0-1.5 1-2 2-2s2 .5 2 2c0 1.5.2 2.4.5 3 .5 1 1.5 1 2 0 1-1.5 1.8-5.2 2.5-7 1-2.5.5-4.5-1.5-6-1.5-1.5-4-1-5.5 1z"/>
        </svg>
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)", marginBottom: ".3rem" }}>Odontograma — Sprint Futuro</div>
        <div style={{ fontSize: ".85rem", color: "var(--text-3)", maxWidth: 340 }}>
          Odontograma interativo planejado para sprint <strong>DENTAL-ODONTOGRAM-FOUNDATION-01</strong>. Mapeamento visual de 32 dentes com status por face, histórico de restaurações e extrações.
        </div>
      </div>
    </div>
  );
}

function WorkspaceProcedimentos({ patient, user, token, onSaved }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), dente: "", procedimento: "", material: "", observacoes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function upd(k) { return v => setForm(s => ({ ...s, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.procedimento) { setError("Procedimento obrigatório."); return; }
    setBusy(true); setError("");
    try {
      const details = [
        form.dente ? `Dente/região: ${form.dente}` : "",
        `Procedimento: ${form.procedimento}`,
        form.material ? `Material: ${form.material}` : "",
        form.observacoes ? `Obs: ${form.observacoes}` : "",
      ].filter(Boolean).join("\n");
      await createRecord(token, patient.id, {
        date: form.date,
        time: new Date().toTimeString().slice(0, 5),
        type: "consultation",
        title: `Procedimento odontológico${form.dente ? ` — Dente ${form.dente}` : ""}`,
        details,
        professionalName: user?.name || "",
        professionalCouncil: "",
        immutable: true,
        metadata: { consultKind: "odontologia", subtype: "procedimento", dente: form.dente || null },
      });
      setSuccess(true);
      setForm({ date: new Date().toISOString().slice(0, 10), dente: "", procedimento: "", material: "", observacoes: "" });
      onSaved?.();
    } catch (err) {
      setError(err.message || "Erro ao registrar procedimento.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div style={{ padding: "var(--s-4)" }}>
        <div className="specialty-panel__success">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Procedimento registrado.
          <Button type="button" variant="ghost" size="sm" onClick={() => setSuccess(false)} style={{ marginLeft: "auto" }}>+ Novo</Button>
        </div>
      </div>
    );
  }

  return (
    <form className="specialty-panel__form field-grid" style={{ padding: "var(--s-4)" }} onSubmit={handleSubmit}>
      <Input label="Data" type="date" value={form.date} max={new Date().toISOString().slice(0, 10)} onChange={e => upd("date")(e.target.value)} />
      <Input label="Dente / região" value={form.dente} onChange={e => upd("dente")(e.target.value)} placeholder="ex: 16, 21-22, mandíbula..." />
      <div className="field" style={{ gridColumn: "span 2" }}>
        <label className="field__label">Procedimento *</label>
        <textarea className="input" rows={2} value={form.procedimento} onChange={e => upd("procedimento")(e.target.value)} placeholder="Descrição do procedimento realizado..." style={{ resize: "vertical" }} required />
      </div>
      <Input label="Material utilizado" value={form.material} onChange={e => upd("material")(e.target.value)} placeholder="Resina, amálgama, ionômero..." />
      <div className="field">
        <label className="field__label">Observações</label>
        <textarea className="input" rows={2} value={form.observacoes} onChange={e => upd("observacoes")(e.target.value)} placeholder="Notas adicionais..." style={{ resize: "vertical" }} />
      </div>
      {error && <div className="error" style={{ gridColumn: "span 2", padding: ".5rem .75rem", borderRadius: "var(--r-md)" }}>{error}</div>}
      <div style={{ gridColumn: "span 2" }}>
        <Button type="submit" variant="primary" loading={busy}>Registrar procedimento</Button>
      </div>
    </form>
  );
}

function WorkspaceEvolucao({ patient, user, token, onSaved }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), evolucao: "", conduta: "", proximo: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function upd(k) { return v => setForm(s => ({ ...s, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.evolucao) { setError("Evolução obrigatória."); return; }
    setBusy(true); setError("");
    try {
      const details = [
        `Evolução: ${form.evolucao}`,
        form.conduta ? `Conduta: ${form.conduta}` : "",
        form.proximo ? `Próximo passo: ${form.proximo}` : "",
      ].filter(Boolean).join("\n");
      await createRecord(token, patient.id, {
        date: form.date,
        time: new Date().toTimeString().slice(0, 5),
        type: "consultation",
        title: "Evolução odontológica",
        details,
        professionalName: user?.name || "",
        professionalCouncil: "",
        immutable: true,
        metadata: { consultKind: "odontologia", subtype: "evolucao" },
      });
      setSuccess(true);
      setForm({ date: new Date().toISOString().slice(0, 10), evolucao: "", conduta: "", proximo: "" });
      onSaved?.();
    } catch (err) {
      setError(err.message || "Erro ao registrar evolução.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div style={{ padding: "var(--s-4)" }}>
        <div className="specialty-panel__success">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Evolução registrada.
          <Button type="button" variant="ghost" size="sm" onClick={() => setSuccess(false)} style={{ marginLeft: "auto" }}>+ Nova</Button>
        </div>
      </div>
    );
  }

  return (
    <form className="specialty-panel__form field-grid" style={{ padding: "var(--s-4)" }} onSubmit={handleSubmit}>
      <Input label="Data" type="date" value={form.date} max={new Date().toISOString().slice(0, 10)} onChange={e => upd("date")(e.target.value)} />
      <div style={{ display: "flex", alignItems: "flex-end" }} />
      <div className="field" style={{ gridColumn: "span 2" }}>
        <label className="field__label">Evolução *</label>
        <textarea className="input" rows={3} value={form.evolucao} onChange={e => upd("evolucao")(e.target.value)} placeholder="Evolução clínica do paciente..." style={{ resize: "vertical" }} required />
      </div>
      <div className="field" style={{ gridColumn: "span 2" }}>
        <label className="field__label">Conduta</label>
        <textarea className="input" rows={2} value={form.conduta} onChange={e => upd("conduta")(e.target.value)} placeholder="Conduta adotada..." style={{ resize: "vertical" }} />
      </div>
      <div className="field" style={{ gridColumn: "span 2" }}>
        <label className="field__label">Próximo passo / retorno</label>
        <textarea className="input" rows={2} value={form.proximo} onChange={e => upd("proximo")(e.target.value)} placeholder="Agendamento, retorno, encaminhamento..." style={{ resize: "vertical" }} />
      </div>
      {error && <div className="error" style={{ gridColumn: "span 2", padding: ".5rem .75rem", borderRadius: "var(--r-md)" }}>{error}</div>}
      <div style={{ gridColumn: "span 2" }}>
        <Button type="submit" variant="primary" loading={busy}>Registrar evolução</Button>
      </div>
    </form>
  );
}

function WorkspacePlano({ patient, user, token, onSaved }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), objetivo: "", etapas: "", prioridade: "media", previsao: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function upd(k) { return v => setForm(s => ({ ...s, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.objetivo) { setError("Objetivo obrigatório."); return; }
    setBusy(true); setError("");
    try {
      const details = [
        `Objetivo: ${form.objetivo}`,
        form.etapas ? `Etapas: ${form.etapas}` : "",
        `Prioridade: ${form.prioridade}`,
        form.previsao ? `Previsão de conclusão: ${form.previsao}` : "",
      ].filter(Boolean).join("\n");
      await createRecord(token, patient.id, {
        date: form.date,
        time: new Date().toTimeString().slice(0, 5),
        type: "consultation",
        title: "Plano de tratamento odontológico",
        details,
        professionalName: user?.name || "",
        professionalCouncil: "",
        immutable: true,
        metadata: { consultKind: "odontologia", subtype: "plano_tratamento" },
      });
      setSuccess(true);
      setForm({ date: new Date().toISOString().slice(0, 10), objetivo: "", etapas: "", prioridade: "media", previsao: "" });
      onSaved?.();
    } catch (err) {
      setError(err.message || "Erro ao registrar plano.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div style={{ padding: "var(--s-4)" }}>
        <div className="specialty-panel__success">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Plano registrado.
          <Button type="button" variant="ghost" size="sm" onClick={() => setSuccess(false)} style={{ marginLeft: "auto" }}>+ Novo</Button>
        </div>
      </div>
    );
  }

  return (
    <form className="specialty-panel__form field-grid" style={{ padding: "var(--s-4)" }} onSubmit={handleSubmit}>
      <Input label="Data" type="date" value={form.date} max={new Date().toISOString().slice(0, 10)} onChange={e => upd("date")(e.target.value)} />
      <Select label="Prioridade" value={form.prioridade} onChange={e => upd("prioridade")(e.target.value)}>
        <option value="alta">Alta</option>
        <option value="media">Média</option>
        <option value="baixa">Baixa</option>
      </Select>
      <div className="field" style={{ gridColumn: "span 2" }}>
        <label className="field__label">Objetivo do tratamento *</label>
        <textarea className="input" rows={2} value={form.objetivo} onChange={e => upd("objetivo")(e.target.value)} placeholder="Objetivo geral do plano de tratamento..." style={{ resize: "vertical" }} required />
      </div>
      <div className="field" style={{ gridColumn: "span 2" }}>
        <label className="field__label">Etapas planejadas</label>
        <textarea className="input" rows={3} value={form.etapas} onChange={e => upd("etapas")(e.target.value)} placeholder="1. Profilaxia e raspagem&#10;2. Restaurações&#10;3. ..." style={{ resize: "vertical" }} />
      </div>
      <Input label="Previsão de conclusão" type="date" value={form.previsao} onChange={e => upd("previsao")(e.target.value)} />
      {error && <div className="error" style={{ gridColumn: "span 2", padding: ".5rem .75rem", borderRadius: "var(--r-md)" }}>{error}</div>}
      <div style={{ gridColumn: "span 2" }}>
        <Button type="submit" variant="primary" loading={busy}>Salvar plano</Button>
      </div>
    </form>
  );
}

function WorkspaceHistorico({ history }) {
  if (history === null) {
    return (
      <div style={{ padding: "var(--s-4)", color: "var(--text-3)", fontSize: ".85rem" }}>Carregando histórico...</div>
    );
  }
  const dentalHistory = history.filter(r => r.metadata?.consultKind === "odontologia");
  if (dentalHistory.length === 0) {
    return (
      <div className="empty" style={{ padding: "var(--s-6)" }}>
        <div className="empty__icon" style={{ opacity: 0.2 }}>
          <svg width="32" height="32" viewBox="0 0 16 16" fill="none"><path d="M3 2h10v12H3z" stroke="currentColor" strokeWidth="1.4"/><path d="M6 6h5M6 8.5h5M6 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </div>
        <div className="empty__title">Sem histórico odontológico</div>
        <div className="empty__desc">Registros de procedimentos, evoluções e planos aparecerão aqui.</div>
      </div>
    );
  }
  return (
    <div style={{ padding: "var(--s-3)" }}>
      {dentalHistory.map(h => (
        <div key={h.id} className="specialty-panel__hist-item">
          <span className="specialty-panel__hist-date">{fmtDate(h.date)}</span>
          <span className="specialty-panel__hist-title">{h.title}</span>
          {h.metadata?.subtype && (
            <span style={{ fontSize: ".7rem", padding: "1px 7px", borderRadius: "var(--r-full)", background: "var(--teal-1)", color: "var(--teal-7)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
              {h.metadata.subtype === "procedimento" ? "Proc" : h.metadata.subtype === "evolucao" ? "Evol" : h.metadata.subtype === "plano_tratamento" ? "Plano" : h.metadata.subtype}
            </span>
          )}
          {h.professionalName && <span className="specialty-panel__hist-prof">{h.professionalName}</span>}
        </div>
      ))}
    </div>
  );
}

function DentalWorkspacePanel({ patient, user, token, onClose }) {
  const [activeTab, setActiveTab] = useState("resumo");
  const [history, setHistory] = useState(null);
  const canWrite = hasCapability(user, "dental.write") || hasCapability(user, "dental.admin");

  useMemo(() => {
    if (history !== null) return;
    getPatientHistory(token, patient.id)
      .then(h => setHistory(Array.isArray(h) ? h : []))
      .catch(() => setHistory([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id, token]);

  function onSaved() { setHistory(null); }

  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate + "T12:00:00").getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div className="specialty-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="specialty-panel__header">
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
          <div className="specialty-panel__avatar">{initials(patient.name)}</div>
          <div>
            <div className="specialty-panel__name">{patient.name}</div>
            <div className="specialty-panel__meta">
              {age !== null ? `${age} anos` : ""}
              {patient.cpf ? " · CPF ***" : ""}
            </div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </Button>
      </div>

      {/* workspace tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 var(--s-3)", gap: ".25rem", flexShrink: 0, overflowX: "auto" }}>
        {WORKSPACE_TABS.map(t => {
          const blocked = !canWrite && ["procedimentos", "evolucao", "plano"].includes(t.id);
          if (blocked) return null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "var(--s-2) var(--s-2)",
                fontSize: ".78rem", fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? "var(--teal-6)" : "var(--text-2)",
                borderBottom: activeTab === t.id ? "2px solid var(--teal-6)" : "2px solid transparent",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "resumo" && <WorkspaceResumo patient={patient} history={history} />}
        {activeTab === "odontograma" && <WorkspaceOdontograma />}
        {activeTab === "procedimentos" && canWrite && <WorkspaceProcedimentos patient={patient} user={user} token={token} onSaved={onSaved} />}
        {activeTab === "evolucao" && canWrite && <WorkspaceEvolucao patient={patient} user={user} token={token} onSaved={onSaved} />}
        {activeTab === "plano" && canWrite && <WorkspacePlano patient={patient} user={user} token={token} onSaved={onSaved} />}
        {activeTab === "historico" && <WorkspaceHistorico history={history} />}
      </div>
    </div>
  );
}

export default function OdontologiaPage({ patients, user, token }) {
  const canRead = hasCapability(user, "dental.read") || hasCapability(user, "dental.write") || hasCapability(user, "dental.admin");

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const filtered = useMemo(() => {
    const base = !query.trim() ? patients : patients.filter(p => matchesPatientSearch(p, query));
    return [...base].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }, [patients, query]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (!canRead) {
    return (
      <div style={{ padding: "3rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ opacity: 0.2, marginBottom: "1rem" }}>{DENTAL_ICON}</div>
        <p style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text)", marginBottom: ".5rem" }}>Acesso restrito</p>
        <p style={{ fontSize: ".9rem" }}>Apenas dentistas e perfis autorizados podem acessar o módulo odontológico.</p>
      </div>
    );
  }

  return (
    <div className="vaccines-page">
      <PageHeader
        eyebrow="ATENDIMENTO ODONTOLÓGICO"
        title="Odontologia"
        subtitle={`${filtered.length} paciente${filtered.length !== 1 ? "s" : ""} cadastrado${filtered.length !== 1 ? "s" : ""}`}
      />

      <div className="vaccines-layout">
        <div className="vacc-panel">
          <div className="card card--noPad overflow-hidden">
            <div className="vacc-panel__search">
              <Input
                value={query}
                onChange={e => { setQuery(e.target.value); setPage(0); }}
                placeholder="Buscar paciente..."
              />
            </div>
            <div className="vacc-panel__list">
              {paged.length === 0 ? (
                <p className="vacc-panel__empty">Nenhum paciente encontrado.</p>
              ) : paged.map(p => {
                const am = p.birthDate
                  ? Math.round((Date.now() - new Date(p.birthDate + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24 * 30.44))
                  : null;
                const isActive = selectedPatient?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`vacc-pat${isActive ? " is-active" : ""}`}
                    onClick={() => setSelectedPatient(isActive ? null : p)}
                  >
                    <Avatar name={p.name} size="sm" />
                    <div className="vacc-pat__copy">
                      <div className="vacc-pat__name">{p.name}</div>
                      <div className="vacc-pat__meta">
                        {am !== null && (
                          <span className="vacc-pat__age">{am < 24 ? `${am}m` : `${Math.floor(am / 12)}a`}</span>
                        )}
                      </div>
                    </div>
                    <svg className="vacc-pat__chevron" width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: ".5rem", padding: "var(--s-2) var(--s-3)", borderTop: "1px solid var(--border)" }}>
                <Button type="button" variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</Button>
                <span style={{ fontSize: ".75rem", color: "var(--text-dim)" }}>{page + 1} / {totalPages}</span>
                <Button type="button" variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</Button>
              </div>
            )}
          </div>
        </div>

        <div className="vacc-main">
          {selectedPatient ? (
            <div className="card card--noPad overflow-hidden" style={{ height: "100%" }}>
              <DentalWorkspacePanel
                patient={selectedPatient}
                user={user}
                token={token}
                onClose={() => setSelectedPatient(null)}
              />
            </div>
          ) : (
            <div className="vacc-empty">
              <div className="vacc-empty__icon" style={{ opacity: .2 }}>
                {DENTAL_ICON}
              </div>
              <p className="vacc-empty__label">Selecione um paciente para iniciar o atendimento odontológico.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
