import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { matchesPatientSearch, isChildCategory, ageInMonths } from "../utils/clinical";
import { initials, formatCpf, formatCns, formatPhone, formatCep } from "../utils/formatting";
import { createPatient } from "../api";
import { useQueue } from "../hooks/useQueue";
import { inferQueuePriorityFromPatient, QUEUE_PRIORITY_LABELS, formatQueueClock, formatQueueWait } from "../utils/queue";
import PageHeader from "../components/layout/PageHeader";
import PageShell from "../components/layout/PageShell";
import PageToolbar from "../components/layout/PageToolbar";
import KpiGrid from "../components/layout/KpiGrid";
import MainContent from "../components/layout/MainContent";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import KPI from "../components/ui/KPI";

const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconWarning = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
    <path d="M8 1.5a5 5 0 00-5 5v3l-1.5 2h13L13 9.5v-3a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

function QueuePage({ patients, users, user, token, onNewPatient }) {
  const {
    entries: queue,
    loading,
    error: queueError,
    setError: setQueueError,
    createEntry,
    patchEntry,
    removeEntry,
    clearDone,
    waiting,
    attending
  } = useQueue(token, { onError: () => {} });

  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState("select");
  const [demandType, setDemandType] = useState("scheduled");
  const [destination, setDestination] = useState("doctor");
  const [priority, setPriority] = useState("normal");
  const [reason, setReason] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const patWrapRef = useRef(null);

  const emptyNew = () => ({
    name: "", cpf: "", cns: "", birthDate: "", sex: "", maritalStatus: "", motherName: "",
    phone: "", phoneAlt: "", zipCode: "", address: "", number: "", complement: "",
    neighborhood: "", city: "", state: "", careCategory: "general", assignedAcsId: "",
    pregnancyStartDate: "", expectedDeliveryDate: "",
    gestationalAgeDumWeeks: "", gestationalAgeDumDays: "",
    gestationalAgeUsgWeeks: "", gestationalAgeUsgDays: "",
    usgDate1: "", usgDate2: "", usgDate3: "",
    allergies: "", comorbidities: "", medications: "",
    microarea: "", familyCode: "", homeVisitFreq: "",
    housingType: "", waterSupply: "", sewage: "", garbage: "", electricity: "",
  });
  const [newPat, setNewPat] = useState(emptyNew());
  const [savingNew, setSavingNew] = useState(false);
  const [newPatErr, setNewPatErr] = useState("");

  const searchResults = useMemo(() => {
    const q = searchQ.trim();
    if (q.length < 2) return [];
    const inQueue = queue.filter((entry) => entry.status !== "done").map((entry) => entry.patientId);
    return patients.filter((patient) => !inQueue.includes(patient.id) && matchesPatientSearch(patient, q)).slice(0, 8);
  }, [searchQ, patients, queue]);

  function selectPatient(patient) {
    setSelectedPatient(patient);
    setSearchQ(patient.name);
    setPriority(inferQueuePriorityFromPatient(patient));
  }

  function resetForm() {
    setStep("select");
    setSearchQ("");
    setSelectedPatient(null);
    setDemandType("scheduled");
    setDestination("doctor");
    setPriority("normal");
    setReason("");
    setNewPat(emptyNew());
    setNewPatErr("");
    setQueueError("");
  }

  async function addToQueue() {
    if (!selectedPatient) return;
    try {
      await createEntry({
        patientId: selectedPatient.id,
        priority,
        reason,
        demandType,
        destination: demandType === "spontaneous" ? destination : undefined
      });
      resetForm();
      setShowForm(false);
    } catch (err) {
      setQueueError(err.message || "Erro ao colocar paciente na fila.");
    }
  }

  async function saveNewPatient(e) {
    e.preventDefault();
    if (!newPat.name.trim()) { setNewPatErr("Nome é obrigatório."); return; }
    setSavingNew(true); setNewPatErr("");
    try {
      const territorial = [
        newPat.microarea ? `Microárea: ${newPat.microarea}` : "",
        newPat.familyCode ? `Cód.família: ${newPat.familyCode}` : "",
        newPat.homeVisitFreq ? `Freq.visita: ${newPat.homeVisitFreq}` : "",
        newPat.housingType ? `Moradia: ${newPat.housingType}` : "",
        newPat.waterSupply ? `Ãgua: ${newPat.waterSupply}` : "",
        newPat.sewage ? `Esgoto: ${newPat.sewage}` : "",
        newPat.garbage ? `Lixo: ${newPat.garbage}` : "",
        newPat.electricity ? `Energia: ${newPat.electricity}` : "",
      ].filter(Boolean).join(" | ");
      const payload = {
        name: newPat.name.trim(), motherName: newPat.motherName.trim(),
        cpf: newPat.cpf.trim(), cns: newPat.cns.trim(), birthDate: newPat.birthDate,
        phone: newPat.phone.trim(), phoneAlt: newPat.phoneAlt.trim(),
        sex: newPat.sex, maritalStatus: newPat.maritalStatus,
        careCategory: newPat.careCategory || "general", assignedAcsId: "",
        zipCode: newPat.zipCode.trim(), address: newPat.address.trim(),
        number: newPat.number.trim(), complement: newPat.complement.trim(),
        neighborhood: newPat.neighborhood.trim(), city: newPat.city.trim(),
        state: newPat.state.trim().toUpperCase(),
        allergies: newPat.allergies.trim(), comorbidities: newPat.comorbidities.trim(),
        medications: newPat.medications.trim() + (territorial ? (" | [Territorial] " + territorial) : ""),
        pregnancyStartDate: newPat.pregnancyStartDate || "",
        expectedDeliveryDate: newPat.expectedDeliveryDate || "",
        gestationalAgeDumWeeks: newPat.gestationalAgeDumWeeks === "" ? null : Number(newPat.gestationalAgeDumWeeks),
        gestationalAgeDumDays: newPat.gestationalAgeDumDays === "" ? null : Number(newPat.gestationalAgeDumDays),
        gestationalAgeUsgWeeks: newPat.gestationalAgeUsgWeeks === "" ? null : Number(newPat.gestationalAgeUsgWeeks),
        gestationalAgeUsgDays: newPat.gestationalAgeUsgDays === "" ? null : Number(newPat.gestationalAgeUsgDays),
        usgDate1: newPat.usgDate1 || "", usgDate2: newPat.usgDate2 || "", usgDate3: newPat.usgDate3 || "",
      };
      const created = await createPatient(token, payload);
      if (onNewPatient && created?.id) onNewPatient(created);
      setSelectedPatient(created);
      setSearchQ(created.name || newPat.name.trim());
      setPriority(inferQueuePriorityFromPatient(created));
      setStep("select");
    } catch (err) {
      setNewPatErr(err.message || "Erro ao cadastrar paciente.");
    } finally {
      setSavingNew(false);
    }
  }

  async function updateStatus(id, status) {
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
      setQueueError(err.message || "Erro ao remover paciente da fila.");
    }
  }

  async function clearCompleted() {
    try {
      await clearDone();
    } catch (err) {
      setQueueError(err.message || "Erro ao limpar concluídos.");
    }
  }

  const dropRect = (step === "select" && searchQ.length >= 2 && !selectedPatient)
    ? patWrapRef.current?.getBoundingClientRect() ?? null
    : null;

  return (
    <PageShell className="queue-page">
      <PageHeader
        eyebrow="Recepção"
        title="Fila de Atendimento"
        subtitle="Triagem, prioridade e fluxo de pacientes no dia."
        actions={(
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <IconPlus /> Dar entrada
          </Button>
        )}
      />

      <KpiGrid className="queue-kpis">
        <KPI label="Aguardando" value={waiting} helper="na fila" className="card kpi--info" />
        <KPI label="Em atendimento" value={attending} helper="consultas ativas" className="card kpi--warning" />
        <KPI label="Total hoje" value={queue.length} helper="entradas" className="card" />
      </KpiGrid>

      <PageToolbar>
        {queue.some((entry) => entry.status === "done") ? (
          <Button variant="ghost" size="sm" className="queue-kpis__clear-btn" onClick={clearCompleted}>
            Limpar concluídos
          </Button>
        ) : null}
      </PageToolbar>

      <MainContent>
        {queueError ? <div className="error error-banner">{queueError}</div> : null}

      <div className="queue-list">
        {loading && !queue.length ? (
          <EmptyState
            title="Carregando fila"
            description="Buscando entradas ativas do servidor."
          />
        ) : !queue.length ? (
          <EmptyState
            title="Nenhum paciente na fila"
            description="Clique em «Dar entrada» para registrar a chegada de um paciente."
          />
        ) : (
          queue.map((entry, index) => {
            const isDone = entry.status === "done";
            const priorityClass = `queue-entry--${entry.priority || "normal"}`;
            return (
              <div key={entry.id} className={`queue-entry ${isDone ? "queue-entry--done" : priorityClass}`}>
                <div className="queue-entry__rank">{index + 1}</div>
                <div className="queue-entry__copy">
                  <div className="queue-entry__name">{entry.patientName}</div>
                  <div className="queue-entry__meta">
                    Entrada: {formatQueueClock(entry.arrivedAt)} · Aguardando: {formatQueueWait(entry.arrivedAt)}{entry.reason ? ` · ${entry.reason}` : ""}
                  </div>
                  <div className="queue-entry__badges">
                    <span className={`queue-badge ${isDone ? "" : priorityClass}`}>{QUEUE_PRIORITY_LABELS[entry.priority]}</span>
                    {entry.demandType === "spontaneous" && (
                      <span className="queue-badge queue-badge--spontaneous">
                        Espontâneo → {entry.destination === "nurse" ? "Enfermagem" : "Médico(a)"}
                      </span>
                    )}
                    {entry.demandType === "scheduled" && (
                      <span className="queue-badge queue-badge--scheduled">Agendado</span>
                    )}
                  </div>
                </div>
                {!isDone && (
                  <div className="queue-entry__actions">
                    {entry.status === "waiting" && (
                      <span className="queue-badge queue-badge--waiting">Aguardando triagem</span>
                    )}
                    {entry.status === "triage" && (
                      <span className="queue-badge queue-badge--triage">Em triagem</span>
                    )}
                    {entry.status === "ready" && (
                      <Button size="sm" onClick={() => updateStatus(entry.id, "attending")}>Chamar</Button>
                    )}
                    {entry.status === "attending" && (
                      <Button size="sm" variant="primary" onClick={() => updateStatus(entry.id, "done")}>Concluir</Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      className="agenda-appt__remove-btn"
                      onClick={() => removeFromQueue(entry.id)}
                      title="Remover da fila"
                    >
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </MainContent>

      {showForm && (
        <Modal
          title="Dar entrada na fila"
          onClose={() => { setShowForm(false); resetForm(); }}
        >
          {step === "select" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
              <div className="field">
                <label className="field__label">Paciente *</label>
                <div className="agenda-pat-wrap" ref={patWrapRef}>
                  <Input
                    inputClassName={selectedPatient ? "input--success" : ""}
                    value={searchQ}
                    onChange={(e) => {
                      setSearchQ(e.target.value);
                      if (selectedPatient && e.target.value !== selectedPatient.name) {
                        setSelectedPatient(null);
                      }
                    }}
                    placeholder="Nome, CPF ou telefone..."
                    autoFocus
                  />
                </div>
              </div>

              {dropRect && createPortal(
                <div
                  className="agenda-pat-dropdown"
                  style={{
                    position: "fixed",
                    top: dropRect.bottom + 3,
                    left: dropRect.left,
                    right: "auto",
                    width: dropRect.width,
                    zIndex: 9999,
                  }}
                >
                  {searchResults.length === 0 ? (
                    <div className="agenda-pat-empty">Nenhum paciente encontrado.</div>
                  ) : (
                    searchResults.map((patient) => {
                      const am = ageInMonths(patient.birthDate);
                      return (
                        <Button key={patient.id} variant="ghost" className="agenda-pat-opt" onClick={() => selectPatient(patient)}>
                          <div className="agenda-pat-opt__avatar">{initials(patient.name)}</div>
                          <div>
                            <div className="agenda-pat-opt__name">{patient.name}</div>
                            <div className="agenda-pat-opt__meta">
                              {patient.careCategory || "general"}{am !== null ? ` · ${am < 24 ? `${am}m` : `${Math.floor(am / 12)}a`}` : ""}{patient.phone ? ` · ${patient.phone}` : ""}
                            </div>
                          </div>
                        </Button>
                      );
                    })
                  )}
                  <Button
                    variant="ghost"
                    className="agenda-pat-new"
                    onClick={() => {
                      setNewPat((state) => ({ ...state, name: searchQ.trim() }));
                      setStep("new-patient");
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

              {selectedPatient && (
                <div className="queue-selected-pat">
                  <div className="queue-selected-pat__avatar">{initials(selectedPatient.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="queue-selected-pat__name">{selectedPatient.name}</div>
                  </div>
                  <Button variant="ghost" size="sm" iconOnly onClick={() => { setSelectedPatient(null); setSearchQ(""); }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </Button>
                </div>
              )}

              {selectedPatient && (
                <>
                  <div className="field">
                    <label className="field__label">Tipo de demanda *</label>
                    <div className="queue-toggle">
                      {[["scheduled", "Agendado", "Consulta marcada"], ["spontaneous", "Espontâneo", "Sem agendamento"]].map(([value, label, description]) => (
                        <Button key={value} variant="ghost" className={`queue-toggle-btn${demandType === value ? " is-active" : ""}`} onClick={() => setDemandType(value)}>
                          <div className="queue-toggle-btn__label">{label}</div>
                          <div className="queue-toggle-btn__desc">{description}</div>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {demandType === "spontaneous" && (
                    <div className="field">
                      <label className="field__label">Encaminhar para *</label>
                      <div className="queue-toggle">
                        {[["doctor", "Médico(a)"], ["nurse", "Enfermagem"]].map(([value, label]) => (
                          <Button key={value} variant="ghost" className={`queue-toggle-btn${destination === value ? " is-active" : ""}`} onClick={() => setDestination(value)}>
                            <div className="queue-toggle-btn__label">{label}</div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Select label="Prioridade" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    {Object.entries(QUEUE_PRIORITY_LABELS).map(([key, value]) => (
                      <option key={key} value={key}>{value}</option>
                    ))}
                  </Select>

                  <Input
                    label="Motivo / queixa principal"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Dor, retorno, renovação de receita..."
                  />

                  <div className={`queue-demand-notice queue-demand-notice--${demandType}`}>
                    <IconWarning />
                    <span>
                      <strong>Aviso:</strong>{" "}
                      {demandType === "scheduled"
                        ? `Profissional será notificado que ${selectedPatient.name} chegou.`
                        : `${destination === "doctor" ? "Médico(a)" : "Enfermagem"} receberá aviso de paciente espontâneo.`}
                    </span>
                  </div>

                  {queueError ? <p className="field__error">{queueError}</p> : null}

                  <div className="queue-form-footer">
                    <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
                    <Button variant="primary" onClick={addToQueue}>Confirmar entrada</Button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === "new-patient" && (
            <form onSubmit={saveNewPatient} style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
              <div className="queue-form-section">
                <p className="queue-form-section__title">Identificação</p>
                <div className="field-grid field-grid--no-pad">
                  <Input className="field--span-2" label="Nome completo *" value={newPat.name} onChange={(e) => setNewPat((state) => ({ ...state, name: e.target.value }))} placeholder="Nome do paciente" autoFocus />
                  {isChildCategory(newPat.careCategory) && (
                    <Input className="field--span-2" label="Nome do responsável" value={newPat.motherName} onChange={(e) => setNewPat((state) => ({ ...state, motherName: e.target.value }))} />
                  )}
                  <Input label="Data de nascimento" type="date" value={newPat.birthDate} onChange={(e) => setNewPat((state) => ({ ...state, birthDate: e.target.value }))} />
                  <Select label="Sexo" value={newPat.sex} onChange={(e) => setNewPat((state) => ({ ...state, sex: e.target.value }))}>
                    <option value="">Não informado</option>
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                  </Select>
                  {!isChildCategory(newPat.careCategory) && (
                    <Select label="Estado civil" value={newPat.maritalStatus} onChange={(e) => setNewPat((state) => ({ ...state, maritalStatus: e.target.value }))}>
                      <option value="">Não informado</option>
                      <option value="solteiro">Solteiro(a)</option>
                      <option value="casado">Casado(a)</option>
                      <option value="uniao_estavel">União estável</option>
                      <option value="divorciado">Divorciado(a)</option>
                      <option value="viuvo">Viúvo(a)</option>
                    </Select>
                  )}
                  <Input label="CPF" value={newPat.cpf} onChange={(e) => setNewPat((state) => ({ ...state, cpf: formatCpf(e.target.value) }))} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} />
                  <Input label="CNS" value={newPat.cns} onChange={(e) => setNewPat((state) => ({ ...state, cns: formatCns(e.target.value) }))} placeholder="000 0000 0000 0000" inputMode="numeric" />
                  <Input label="Telefone" value={newPat.phone} onChange={(e) => setNewPat((state) => ({ ...state, phone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" inputMode="numeric" maxLength={15} />
                  <Input label="Telefone 2" value={newPat.phoneAlt} onChange={(e) => setNewPat((state) => ({ ...state, phoneAlt: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" inputMode="numeric" maxLength={15} />
                  <Select label="Categoria" value={newPat.careCategory} onChange={(e) => setNewPat((state) => ({ ...state, careCategory: e.target.value }))}>
                    <option value="general">Geral</option>
                    <option value="pregnant">Gestante</option>
                    <option value="child_followup">Puericultura</option>
                    <option value="elderly">Pessoa Idosa</option>
                    <option value="puerperal">Puérpera</option>
                  </Select>
                </div>
              </div>

              <div className="queue-form-section">
                <p className="queue-form-section__title">Endereço</p>
                <div className="field-grid field-grid--no-pad">
                  <Input label="CEP" value={newPat.zipCode} onChange={(e) => setNewPat((state) => ({ ...state, zipCode: formatCep(e.target.value) }))} placeholder="00000-000" inputMode="numeric" maxLength={9} />
                  <Input label="UF" value={newPat.state} onChange={(e) => setNewPat((state) => ({ ...state, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="SP" maxLength={2} />
                  <Input className="field--span-2" label="Rua" value={newPat.address} onChange={(e) => setNewPat((state) => ({ ...state, address: e.target.value }))} />
                  <Input label="Número" value={newPat.number} onChange={(e) => setNewPat((state) => ({ ...state, number: e.target.value }))} />
                  <Input label="Complemento" value={newPat.complement} onChange={(e) => setNewPat((state) => ({ ...state, complement: e.target.value }))} />
                  <Input label="Bairro" value={newPat.neighborhood} onChange={(e) => setNewPat((state) => ({ ...state, neighborhood: e.target.value }))} />
                  <Input label="Cidade" value={newPat.city} onChange={(e) => setNewPat((state) => ({ ...state, city: e.target.value }))} />
                </div>
              </div>

              {String(newPat.careCategory || "").toLowerCase() === "pregnant" && (
                <div className="queue-form-section">
                  <p className="queue-form-section__title queue-form-section__title--accent">Dados gestacionais</p>
                  <div className="field-grid field-grid--no-pad">
                    <Input label="DUM" type="date" value={newPat.pregnancyStartDate} onChange={(e) => setNewPat((state) => ({ ...state, pregnancyStartDate: e.target.value }))} />
                    <Input label="DPP" type="date" value={newPat.expectedDeliveryDate} onChange={(e) => setNewPat((state) => ({ ...state, expectedDeliveryDate: e.target.value }))} />
                    <Input label="IG DUM (sem)" type="number" min="0" max="45" value={newPat.gestationalAgeDumWeeks} onChange={(e) => setNewPat((state) => ({ ...state, gestationalAgeDumWeeks: e.target.value }))} />
                    <Input label="IG DUM (dias)" type="number" min="0" max="6" value={newPat.gestationalAgeDumDays} onChange={(e) => setNewPat((state) => ({ ...state, gestationalAgeDumDays: e.target.value }))} />
                  </div>
                </div>
              )}

              <div className="queue-form-section">
                <p className="queue-form-section__title">Informações clínicas</p>
                <div className="field-grid field-grid--no-pad">
                  <Input className="field--span-2" label="Alergias" value={newPat.allergies} onChange={(e) => setNewPat((state) => ({ ...state, allergies: e.target.value }))} placeholder="Medicamentos, alimentos..." />
                  <Input className="field--span-2" label="Comorbidades" value={newPat.comorbidities} onChange={(e) => setNewPat((state) => ({ ...state, comorbidities: e.target.value }))} placeholder="Hipertensão, diabetes..." />
                  <Input className="field--span-2" label="Medicamentos em uso" value={newPat.medications} onChange={(e) => setNewPat((state) => ({ ...state, medications: e.target.value }))} placeholder="Nome, dose, frequência..." />
                </div>
              </div>

              {newPatErr ? <p className="field__error">{newPatErr}</p> : null}

              <div className="queue-form-footer">
                <Button variant="secondary" type="button" onClick={() => setStep("select")}>← Voltar</Button>
                <Button variant="primary" type="submit" disabled={savingNew}>{savingNew ? "Cadastrando..." : "Cadastrar e continuar →"}</Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </PageShell>
  );
}

export default QueuePage;

