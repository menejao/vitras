import { useEffect, useMemo, useState } from "react";
import { deleteRecord, getPatientHistory, verifyChartAccess } from "../api";

import PageHeader from "../components/layout/PageHeader";
import Alert from "../components/ui/Alert";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import RecordEmptyState from "../components/records/RecordEmptyState";
import RecordFilters from "../components/records/RecordFilters";
import RecordTimeline from "../components/records/RecordTimeline";
import { calcAge, catLabel, matchesPatientSearch } from "../utils/clinical";
import { canAccessChart, canWriteRecords } from "../utils/roles";

const TABS = [
  { id: "timeline", label: "Linha do tempo" },
  { id: "consultation", label: "Atendimentos", type: "consultation" },
  { id: "exam", label: "Exames", type: "exam" },
  { id: "vaccine", label: "Vacinas", type: "vaccine" },
  { id: "prescription", label: "Prescrições", type: "prescription" },
  { id: "referral", label: "Encaminhamentos", type: "referral" },
  { id: "document", label: "Documentos", type: "document" },
  { id: "message", label: "Mensagens", type: "message" },
];

export default function RecordsPage({
  patients,
  users,
  user,
  token,
  onNavigatePatient,
  selectedPatientId: controlledPatientId = "",
  onSelectPatientId,
  onApplySessionPayload: _unused,
}) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [pendingPatient, setPendingPatient] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const [chartUnlocked, setChartUnlocked] = useState(false);
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeTab, setActiveTab] = useState("timeline");

  const canAccess = canAccessChart(user);
  const canWrite = canWriteRecords(user);

  useEffect(() => {
    if (!controlledPatientId) return;
    if (selectedPatient?.id === controlledPatientId && chartUnlocked) return;
    const pat = patients.find((p) => p.id === controlledPatientId);
    if (!pat) return;
    setPendingPatient(pat);
    setQuery(pat.name);
    setPassword("");
    setAuthError("");
    setShowAuthModal(true);
  }, [controlledPatientId]);

  useEffect(() => {
    setChartUnlocked(false);
    setRecords([]);
    setError("");
    setActiveTab("timeline");
    setTypeFilter("");
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (!selectedPatient || !chartUnlocked || !token) {
      setRecords([]);
      return;
    }
    let active = true;
    setBusy(true);
    setError("");
    getPatientHistory(token, selectedPatient.id)
      .then((data) => { if (active) setRecords(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Erro ao carregar prontuário."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [selectedPatient?.id, chartUnlocked, token]);

  const filteredPatients = useMemo(() => {
    if (!query.trim()) return [];
    return patients.filter((p) => matchesPatientSearch(p, query)).slice(0, 10);
  }, [patients, query]);

  const visibleRecords = useMemo(() => {
    if (activeTab === "timeline") {
      return typeFilter ? records.filter((r) => r.type === typeFilter) : records;
    }
    const tab = TABS.find((t) => t.id === activeTab);
    return tab?.type ? records.filter((r) => r.type === tab.type) : records;
  }, [records, activeTab, typeFilter]);

  function handleSelectFromDropdown(patient) {
    setShowDropdown(false);
    setQuery(patient.name);
    setPendingPatient(patient);
    setPassword("");
    setAuthError("");
    setShowAuthModal(true);
    if (typeof onSelectPatientId === "function") onSelectPatientId(patient.id);
  }

  function handleCloseAuth() {
    setShowAuthModal(false);
    setPendingPatient(null);
    setPassword("");
    setAuthError("");
    if (!selectedPatient) {
      if (typeof onSelectPatientId === "function") onSelectPatientId("");
    }
  }

  async function handleAuth(event) {
    event.preventDefault();
    if (!password.trim()) {
      setAuthError("Informe sua senha de acesso ao sistema.");
      return;
    }
    if (!pendingPatient) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      await verifyChartAccess(token, pendingPatient.id, password);
      setSelectedPatient(pendingPatient);
      setChartUnlocked(true);
      setShowAuthModal(false);
      setPendingPatient(null);
      setPassword("");
    } catch (err) {
      setAuthError(err.message || "Senha incorreta. Acesso negado.");
    } finally {
      setAuthBusy(false);
    }
  }

  function handleCloseChart() {
    setSelectedPatient(null);
    setChartUnlocked(false);
    setQuery("");
    if (typeof onSelectPatientId === "function") onSelectPatientId("");
  }

  async function handleDelete(recordId) {
    if (!selectedPatient) return;
    setBusy(true);
    setError("");
    try {
      await deleteRecord(token, selectedPatient.id, recordId);
      const data = await getPatientHistory(token, selectedPatient.id);
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Erro ao excluir registro.");
    } finally {
      setBusy(false);
    }
  }

  if (!canAccess) {
    return (
      <div className="records-page">
        <PageHeader eyebrow="PRONTUÁRIO ELETRÔNICO" title="Prontuário" subtitle="Acesso restrito a perfis com autorização clínica." />
        <Alert tone="danger">O prontuário eletrônico é acessível apenas por perfis autorizados da equipe clínica.</Alert>
      </div>
    );
  }

  const age = selectedPatient?.birthDate ? calcAge(selectedPatient.birthDate) : null;
  const teamMember = users?.find((u) => u.id === selectedPatient?.assignedUserId);

  return (
    <div className="records-page">
      <PageHeader
        eyebrow="PRONTUÁRIO ELETRÔNICO"
        title="Prontuário"
        subtitle="Acesso protegido a informações clínicas e dados sensíveis dos pacientes."
        actions={selectedPatient && chartUnlocked && onNavigatePatient
          ? <Button variant="secondary" size="sm" onClick={() => onNavigatePatient(selectedPatient.id)}>Abrir ficha →</Button>
          : null}
      />

      {showAuthModal && pendingPatient && (
        <Modal title="Confirmação de identidade" onClose={handleCloseAuth}>
          <form className="records-auth-modal" onSubmit={handleAuth}>
            <div className="records-auth-modal__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1.2" fill="currentColor" />
              </svg>
            </div>
            <p className="records-auth-modal__desc">
              O acesso ao prontuário de <strong>{pendingPatient.name}</strong> é protegido por lei.
              Confirme sua identidade com a senha do sistema para liberar a visualização.
            </p>
            <Input
              type="password"
              placeholder="Sua senha de acesso"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setAuthError(""); }}
              autoComplete="current-password"
              disabled={authBusy}
              autoFocus
            />
            {authError ? <span className="field__error">{authError}</span> : null}
            <p className="records-auth-modal__lgpd">
              Esta ação é registrada no log de auditoria com data, hora e identidade do responsável, conforme a Lei 13.709/2018 (LGPD).
            </p>
            <div className="records-auth-modal__actions">
              <Button variant="secondary" type="button" size="sm" onClick={handleCloseAuth} disabled={authBusy}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" size="sm" disabled={authBusy || !password.trim()}>
                {authBusy ? "Verificando..." : "Liberar acesso"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <div className="records-search-bar">
        <div className="records-search-wrap">
          <span className="records-search-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </span>
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Pesquisar paciente por nome, CPF ou CNS..."
            disabled={chartUnlocked && Boolean(selectedPatient)}
          />
          {showDropdown && filteredPatients.length > 0 && (
            <div className="records-search-dropdown">
              {filteredPatients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="records-search-dropdown__item"
                  onMouseDown={() => handleSelectFromDropdown(p)}
                >
                  <Avatar name={p.name} size="sm" />
                  <div>
                    <div className="records-search-dropdown__name">{p.name}</div>
                    <div className="records-search-dropdown__meta">{catLabel([], p.careCategory)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selectedPatient || !chartUnlocked ? (
        <div className="records-security-empty">
          <div className="records-security-empty__icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1.2" fill="currentColor" />
            </svg>
          </div>
          <p className="records-security-empty__title">
            Pesquise e selecione um paciente para acessar o prontuário
          </p>
          <p className="records-security-empty__lgpd">
            O acesso requer confirmação de identidade. Todos os acessos são registrados conforme a LGPD (Lei 13.709/2018).
          </p>
        </div>
      ) : (
        <div className="records-content">
          <div className="records-patient-header">
            <Avatar name={selectedPatient.name} size="lg" />
            <div className="records-patient-info">
              <h2 className="records-patient-info__name">{selectedPatient.name}</h2>
              <div className="records-patient-info__meta">
                {[
                  age !== null ? `${age} anos` : null,
                  catLabel([], selectedPatient.careCategory) || null,
                  selectedPatient.cpf ? `CPF ${selectedPatient.cpf}` : null,
                  selectedPatient.cns ? `CNS ${selectedPatient.cns}` : null,
                  teamMember ? `Equipe: ${teamMember.name}` : null,
                ].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="records-patient-actions">
              <Button variant="secondary" size="sm" onClick={handleCloseChart}>Fechar</Button>
            </div>
          </div>

          <div className="records-tab-bar" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`records-tab-btn${activeTab === tab.id ? " is-active" : ""}`}
                onClick={() => { setActiveTab(tab.id); setTypeFilter(""); }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="records-tab-content">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {busy ? <Alert tone="info">Carregando registros clínicos...</Alert> : null}

            {activeTab === "timeline" && !busy && (
              <RecordFilters typeFilter={typeFilter} setTypeFilter={setTypeFilter} />
            )}

            {!busy && visibleRecords.length > 0 ? (
              <RecordTimeline
                records={visibleRecords}
                fmtDate={(value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-"}
                onDelete={handleDelete}
                canDelete={canWrite}
              />
            ) : (
              !busy && <RecordEmptyState hasPatient={true} />
            )}

            <p className="records-audit-notice">
              Acesso registrado no log de auditoria com sua identidade, conforme a Lei 13.709/2018 (LGPD).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
