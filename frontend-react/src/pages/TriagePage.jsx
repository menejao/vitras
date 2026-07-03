import { useMemo, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import PageShell from "../components/layout/PageShell";
import KpiGrid from "../components/layout/KpiGrid";
import MainContent from "../components/layout/MainContent";
import Button from "../components/ui/Button";
import Avatar from "../components/ui/Avatar";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import KPI from "../components/ui/KPI";
import { useQueue } from "../hooks/useQueue";
import { formatQueueClock, formatQueueWait } from "../utils/queue";

function shortName(name) { return name ? name.trim().split(" ")[0] : name; }

function bmiClass(bmi) {
  if (bmi < 18.5) return "low";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "over";
  return "obese";
}

function bmiLabel(bmi) {
  if (bmi < 18.5) return "Abaixo do peso";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidade";
}

function painClass(value) {
  if (value <= 3) return "is-selected-low";
  if (value <= 6) return "is-selected-mid";
  return "is-selected-high";
}

function TriagePage({ patients, users, user, token }) {
  const {
    entries: queue,
    error,
    setError,
    patchEntry,
    pendingTriage,
    ready
  } = useQueue(token, { onError: () => {} });
  const [selected, setSelected] = useState(null);
  const [vitals, setVitals] = useState({ bp: "", bpD: "", weight: "", height: "", temp: "", spo2: "", hr: "", glucose: "", pain: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function startTriage(entry) {
    try {
      const updated = await patchEntry(entry.id, {
        status: "triage",
        triageStart: new Date().toISOString()
      });
      setSelected(updated);
      setVitals(updated?.vitals || { bp: "", bpD: "", weight: "", height: "", temp: "", spo2: "", hr: "", glucose: "", pain: "", notes: "" });
    } catch (err) {
      setError(err.message || "Erro ao iniciar triagem.");
    }
  }

  function closeModal() {
    setSelected(null);
  }

  async function cancelTriage() {
    if (!selected) return;
    try {
      await patchEntry(selected.id, {
        status: "aguardando_triagem",
        triageStart: "",
      });
      setSelected(null);
    } catch (err) {
      setError(err.message || "Erro ao cancelar triagem.");
    }
  }

  async function finishTriage(e) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await patchEntry(selected.id, {
        status: "liberado",
        triageDone: new Date().toISOString(),
        vitals: {
          ...vitals,
          by: user?.name || "Téc. Enf.",
          at: new Date().toISOString(),
          patientId: selected.patientId
        }
      });
      setSelected(null);
    } catch (err) {
      setError(err.message || "Erro ao concluir triagem.");
    } finally {
      setSaving(false);
    }
  }

  const onlineTechs = users.filter((entry) => entry.role === "nursing_tech" && entry.online);
  const bmiRaw = vitals.weight && vitals.height
    ? parseFloat(vitals.weight) / Math.pow(parseFloat(vitals.height) / 100, 2)
    : null;
  const bmiValue = bmiRaw !== null && !Number.isNaN(bmiRaw) ? parseFloat(bmiRaw.toFixed(1)) : null;
  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selected?.patientId) || null,
    [patients, selected]
  );

  return (
    <PageShell className="triage-page">
      <PageHeader
        eyebrow="Téc. de Enfermagem"
        title="Monitoramento e Triagem"
        subtitle="Aferição de sinais vitais antes do atendimento."
      >
        <div className="triage-online-status">
          <span className="triage-online-status__label">Técnicos online</span>
          <span className="triage-online-status__sep" aria-hidden="true">·</span>
          {onlineTechs.length === 0
            ? <span className="triage-online-status__val">Nenhum</span>
            : onlineTechs.map((entry) => (
                <span key={entry.id} className="triage-online__badge">
                  <span className="triage-online__dot" />
                  {shortName(entry.name)}
                </span>
              ))
          }
        </div>
      </PageHeader>

      <KpiGrid>
        <KPI label="Aguardando triagem" value={pendingTriage.length} helper="fila ativa" className="card" />
        <KPI label="Prontos" value={ready.length} helper="liberados para consulta" className="card" />
        <KPI label="Em triagem" value={queue.filter((entry) => entry.status === "triage").length} helper="atendimentos em curso" className="card" />
      </KpiGrid>

      <MainContent className={[
        "triage-body",
        selected ? "triage-body--split" : "",
        !selected && !pendingTriage.length && !ready.length ? "triage-body--empty" : "",
      ].filter(Boolean).join(" ")}>
        {error ? <div className="error error-banner">{error}</div> : null}
        <div className="triage-queue">
          <div className="triage-queue__label">Aguardando triagem ({pendingTriage.length})</div>

          {pendingTriage.length === 0 ? (
            <div className="triage-queue__empty">
              <div className="triage-queue__empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <div className="triage-queue__empty-title">Fila vazia</div>
              <div className="triage-queue__empty-desc">Nenhum paciente aguardando triagem no momento.</div>
            </div>
          ) : pendingTriage.map((entry) => {
            const isMe = entry.status === "triage" && entry.triageBy === user?.id;
            const isBusy = entry.status === "triage" && entry.triageBy !== user?.id;
            const techName = isBusy ? users.find((item) => item.id === entry.triageBy)?.name : null;
            return (
              <div
                key={entry.id}
                className={`triage-entry${isMe ? " triage-entry--me" : isBusy ? " triage-entry--busy" : ""}${isBusy ? " triage-entry--no-cursor" : ""}`}
                onClick={() => {
                  if (isBusy) return;
                  if (isMe) {
                    setSelected(entry);
                    setVitals(entry.vitals || { bp: "", bpD: "", weight: "", height: "", temp: "", spo2: "", hr: "", glucose: "", pain: "", notes: "" });
                  } else {
                    startTriage(entry);
                  }
                }}
              >
                <div className="triage-entry__name">{entry.patientName}</div>
                <div className="triage-entry__sub">Chegou {formatQueueClock(entry.arrivedAt)} · há {formatQueueWait(entry.arrivedAt)}</div>
                {isMe && <div className="triage-entry__status">→ Em triagem por você</div>}
                {isBusy && <div className="triage-entry__status">Em triagem: {shortName(techName || "outro técnico")}</div>}
                {!isMe && !isBusy && <div className="triage-entry__cta">Clique para iniciar →</div>}
              </div>
            );
          })}

          {ready.length > 0 && (
            <div className="triage-ready">
              <div className="triage-ready__label">Prontos ({ready.length})</div>
              {ready.map((entry) => (
                <div key={entry.id} className="triage-ready__entry">
                  <div>
                    <div className="triage-ready__name">{entry.patientName}</div>
                    <div className="triage-ready__time">Concluído · {formatQueueClock(entry.triageDone)}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="triage-form-panel">
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="triage-pat-header">
                <div className="triage-pat-info">
                  <Avatar name={selected.patientName} />
                  <div>
                    <div className="triage-pat-name">{selected.patientName}</div>
                    <div className="triage-pat-sub">
                      Triagem iniciada às {formatQueueClock(selected.triageStart || new Date().toISOString())}
                      {selectedPatient?.birthDate ? ` · Nasc. ${selectedPatient.birthDate}` : ""}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" iconOnly type="button" onClick={closeModal}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </Button>
              </div>

              <form className="triage-form" onSubmit={finishTriage}>
                <div>
                  <div className="triage-form__section-title">Pressão Arterial e FC</div>
                  <div className="triage-form__grid-4">
                    <div className="triage-form__field">
                      <span className="field__label">PA (mmHg)</span>
                      <div className="triage-form__bp-row">
                        <Input value={vitals.bp} onChange={(e) => setVitals((state) => ({ ...state, bp: e.target.value }))} placeholder="120" inputMode="numeric" />
                        <span className="triage-form__bp-sep">/</span>
                        <Input value={vitals.bpD} onChange={(e) => setVitals((state) => ({ ...state, bpD: e.target.value }))} placeholder="80" inputMode="numeric" />
                      </div>
                    </div>
                    <Input className="triage-form__field" label="FC (bpm)" value={vitals.hr} onChange={(e) => setVitals((state) => ({ ...state, hr: e.target.value }))} placeholder="72" inputMode="numeric" />
                    <Input className="triage-form__field" label="SpO₂ (%)" value={vitals.spo2} onChange={(e) => setVitals((state) => ({ ...state, spo2: e.target.value }))} placeholder="98" inputMode="numeric" />
                    <Input className="triage-form__field" label="Temp (°C)" value={vitals.temp} onChange={(e) => setVitals((state) => ({ ...state, temp: e.target.value }))} placeholder="36.5" inputMode="decimal" />
                  </div>
                </div>

                <div>
                  <div className="triage-form__section-title">Antropometria</div>
                  <div className="triage-form__grid-3">
                    <Input className="triage-form__field" label="Peso (kg)" value={vitals.weight} onChange={(e) => setVitals((state) => ({ ...state, weight: e.target.value }))} placeholder="70.0" inputMode="decimal" />
                    <Input className="triage-form__field" label="Altura (cm)" value={vitals.height} onChange={(e) => setVitals((state) => ({ ...state, height: e.target.value }))} placeholder="170" inputMode="numeric" />
                    <Input className="triage-form__field" label="Glicemia (mg/dL)" value={vitals.glucose} onChange={(e) => setVitals((state) => ({ ...state, glucose: e.target.value }))} placeholder="100" inputMode="numeric" />
                  </div>
                  {bmiValue !== null && (
                    <div className={`triage-bmi triage-bmi--${bmiClass(bmiValue)}`}>
                      IMC: {bmiValue} — {bmiLabel(bmiValue)}
                    </div>
                  )}
                </div>

                <div>
                  <div className="triage-form__section-title">Dor (0–10)</div>
                  <div className="triage-pain">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                      <Button
                        key={value}
                        variant="ghost"
                        onClick={() => setVitals((state) => ({ ...state, pain: String(value) }))}
                        className={`triage-pain__btn${vitals.pain === String(value) ? ` ${painClass(value)}` : ""}`}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>

                <Textarea
                  className="triage-form__field"
                  label="Observações"
                  value={vitals.notes}
                  onChange={(e) => setVitals((state) => ({ ...state, notes: e.target.value }))}
                  placeholder="Queixas, histórico relevante..."
                  rows={3}
                />

                <div className="triage-form__footer">
                  <Button type="button" variant="secondary" onClick={cancelTriage} className="triage-form__btn-cancel">Cancelar</Button>
                  <Button type="submit" variant="primary" disabled={saving} className="triage-form__btn-finish">
                    {saving ? "Finalizando..." : "Finalizar triagem"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </MainContent>
    </PageShell>
  );
}

export default TriagePage;

