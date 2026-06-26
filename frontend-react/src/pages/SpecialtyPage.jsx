import { useState, useMemo } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Avatar from "../components/ui/Avatar";
import { createRecord, createAppointment, getPatientHistory } from "../api";
import { matchesPatientSearch } from "../utils/clinical";
import { fmtDate, initials } from "../utils/formatting";

const PAGE_SIZE = 20;

// specialty field renderer
function SpecialtyField({ field, value, onChange }) {
  if (field.type === "textarea") {
    return (
      <div className="field" style={{ gridColumn: field.span === 2 ? "span 2" : undefined }}>
        <label className="field__label">{field.label}</label>
        <textarea
          className="input" rows={3}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ""}
          style={{ resize: "vertical", minHeight: "4.5rem" }}
        />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <Select label={field.label} value={value || ""} onChange={e => onChange(e.target.value)}>
        <option value="">Não informado</option>
        {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    );
  }
  return (
    <Input
      label={field.label}
      type={field.inputType || "text"}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder || ""}
    />
  );
}

function SpecialtyWorkspacePanel({ patient, config, user, token, onClose }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10) });
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function upd(key) { return v => setForm(s => ({ ...s, [key]: v })); }

  async function loadHistory() {
    if (history !== null) return;
    try {
      const h = await getPatientHistory(token, patient.id);
      setHistory(Array.isArray(h) ? h.filter(r => r.metadata?.consultKind === config.consultKind || (r.title || "").toLowerCase().includes(config.historyKeyword || config.label.toLowerCase())) : []);
    } catch { setHistory([]); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date) { setError("Data obrigatória."); return; }
    setBusy(true); setError("");
    try {
      const specialtyDetails = config.fields
        .filter(f => form[f.key])
        .map(f => `${f.label}: ${form[f.key]}`)
        .join("\n");
      const details = [
        form.conduct ? `Conduta: ${form.conduct}` : "",
        form.evolution ? `Evolução: ${form.evolution}` : "",
        specialtyDetails,
        form.nextStep ? `Próximo passo: ${form.nextStep}` : "",
        form.notes ? `Obs: ${form.notes}` : "",
      ].filter(Boolean).join("\n");

      const now = new Date();
      const basePayload = {
        date: form.date,
        time: now.toTimeString().slice(0, 5),
        type: "consultation",
        title: config.recordTitle,
        details,
        professionalName: user?.name || "",
        professionalCouncil: "",
        immutable: true,
        metadata: { consultKind: config.consultKind },
      };
      await createRecord(token, patient.id, basePayload);
      await createAppointment(token, patient.id, {
        date: form.date, demandType: form.demandType || "scheduled",
        summary: config.recordTitle,
        conduct: form.conduct || "", nextStep: form.nextStep || "",
        doctorName: user?.name || "", specialty: config.consultKind,
        consultKind: config.consultKind,
      }).catch(() => {});
      setSuccess(true);
      setForm({ date: new Date().toISOString().slice(0, 10) });
      setHistory(null);
    } catch (e) {
      setError(e.message || "Erro ao registrar atendimento");
    } finally {
      setBusy(false);
    }
  }

  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate + "T12:00:00").getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div className="specialty-panel">
      <div className="specialty-panel__header">
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
          <div className="specialty-panel__avatar">{initials(patient.name)}</div>
          <div>
            <div className="specialty-panel__name">{patient.name}</div>
            <div className="specialty-panel__meta">
              {age !== null ? `${age} anos` : ""}
              {patient.cpf ? ` · CPF ***` : ""}
            </div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </Button>
      </div>

      <div className="specialty-panel__body">
        {success && (
          <div className="specialty-panel__success">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Atendimento registrado com sucesso.
            <Button type="button" variant="ghost" size="sm" onClick={() => setSuccess(false)} style={{ marginLeft: "auto", padding: "2px 6px" }}>+ Novo</Button>
          </div>
        )}
        {!success && (
          <form className="specialty-panel__form field-grid" onSubmit={handleSubmit}>
            <div className="specialty-panel__section-title" style={{ gridColumn: "span 2" }}>
              Registro — {config.label}
            </div>

            <Input label="Data" type="date" value={form.date || ""} max={new Date().toISOString().slice(0, 10)} onChange={e => upd("date")(e.target.value)} />
            <Select label="Tipo de demanda" value={form.demandType || "scheduled"} onChange={e => upd("demandType")(e.target.value)}>
              <option value="scheduled">Programada</option>
              <option value="spontaneous">Espontânea</option>
            </Select>

            {config.fields.map(field => (
              <SpecialtyField key={field.key} field={field} value={form[field.key]} onChange={upd(field.key)} />
            ))}

            <div className="field field--span-2">
              <label className="field__label">Conduta / resultado</label>
              <textarea className="input" rows={2} value={form.conduct || ""} onChange={e => upd("conduct")(e.target.value)} placeholder="Conduta realizada..." style={{ resize: "vertical" }} />
            </div>
            <div className="field field--span-2">
              <label className="field__label">Próximo passo / retorno</label>
              <textarea className="input" rows={2} value={form.nextStep || ""} onChange={e => upd("nextStep")(e.target.value)} placeholder="Próximo passo..." style={{ resize: "vertical" }} />
            </div>

            {error && <div className="error field--span-2" style={{ padding: ".5rem .75rem", borderRadius: "var(--r-md)" }}>{error}</div>}

            <Button type="submit" variant="primary" disabled={busy} style={{ gridColumn: "span 2" }}>
              {busy ? "Registrando..." : "Registrar atendimento"}
            </Button>
          </form>
        )}

        <div className="specialty-panel__history-section">
          <button
            type="button"
            className="specialty-panel__history-toggle"
            onClick={loadHistory}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1v7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/></svg>
            Histórico de {config.label}
          </button>
          {history !== null && (
            history.length === 0 ? (
              <p style={{ fontSize: ".8rem", color: "var(--text-3)", padding: ".5rem 0" }}>Nenhum registro anterior.</p>
            ) : history.slice(0, 10).map(h => (
              <div key={h.id} className="specialty-panel__hist-item">
                <span className="specialty-panel__hist-date">{fmtDate(h.date)}</span>
                <span className="specialty-panel__hist-title">{h.title}</span>
                {h.metadata?.professionalName && <span className="specialty-panel__hist-prof">{h.metadata.professionalName}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function SpecialtyPage({ config, patients, user, token }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const filtered = useMemo(() => {
    const base = !query.trim() ? patients : patients.filter(p => matchesPatientSearch(p, query));
    return [...base].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }, [patients, query]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="vaccines-page">
      <PageHeader
        eyebrow={config.description}
        title={config.label}
        subtitle={`${filtered.length} paciente${filtered.length !== 1 ? "s" : ""} cadastrado${filtered.length !== 1 ? "s" : ""}`}
      />

      <div className="vaccines-layout">
        {/* ── Patient list panel — idêntico ao Vacinas ── */}
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
                          <span className="vacc-pat__age">
                            {am < 24 ? `${am}m` : `${Math.floor(am / 12)}a`}
                          </span>
                        )}
                        {p.chronicConditions?.length > 0 && (
                          <span className="vacc-pat__age">{p.chronicConditions.slice(0, 2).join(", ")}</span>
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

        {/* ── Workspace area ── */}
        <div className="vacc-main">
          {selectedPatient ? (
            <div className="card card--noPad overflow-hidden" style={{ height: "100%" }}>
              <SpecialtyWorkspacePanel
                patient={selectedPatient}
                config={config}
                user={user}
                token={token}
                onClose={() => setSelectedPatient(null)}
              />
            </div>
          ) : (
            <div className="vacc-empty">
              <div className="vacc-empty__icon" style={{ opacity: .25 }}>
                {config.icon}
              </div>
              <p className="vacc-empty__label">Selecione um paciente para iniciar o atendimento de {config.label}.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
