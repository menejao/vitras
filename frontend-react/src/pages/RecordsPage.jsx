import { useEffect, useMemo, useState } from "react";
import { inactivateRecord, getPatientHistory, verifyChartAccess } from "../api";

import PageHeader from "../components/layout/PageHeader";
import Alert from "../components/ui/Alert";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import RecordCard from "../components/records/RecordCard";
import RecordEmptyState from "../components/records/RecordEmptyState";
import { calcAge, catLabel, matchesPatientSearch } from "../utils/clinical";
import { canAccessChart, canWriteRecords } from "../utils/roles";

const TYPE_FILTER_GROUPS = {
  atendimento:  ["appointment", "consultation"],
  visit:        ["visit"],
  exam_request: ["exam_request"],
  vaccine:      ["vaccine"],
  prescription: ["prescription"],
  referral:     ["referral"],
  procedimento: ["nursing", "procedure", "evolution"],
  note:         ["note"],
  atestado:     ["attendance_attest", "medical_attest"],
};

function fmtDate(value) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
}

function sexLabel(sex) {
  if (!sex) return null;
  const s = String(sex).toLowerCase();
  if (s === "m" || s === "male"   || s === "masculino") return "Masculino";
  if (s === "f" || s === "female" || s === "feminino")  return "Feminino";
  return null;
}

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

  const [unlockedPatientId, setUnlockedPatientId] = useState(null);
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [typeFilter, setTypeFilter] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [pendingInactivate, setPendingInactivate] = useState(null);
  const [inactivateReason, setInactivateReason] = useState("");
  const [inactivateBusy, setInactivateBusy] = useState(false);
  const [inactivateError, setInactivateError] = useState("");

  const canAccess     = canAccessChart(user);
  const canWrite      = canWriteRecords(user);
  const chartUnlocked = Boolean(selectedPatient) && unlockedPatientId === selectedPatient?.id;

  useEffect(() => {
    if (!controlledPatientId) return;
    if (selectedPatient?.id === controlledPatientId && unlockedPatientId === controlledPatientId) return;
    const pat = patients.find((p) => p.id === controlledPatientId);
    if (!pat) return;
    setPendingPatient(pat);
    setQuery(pat.name);
    setPassword("");
    setAuthError("");
    setShowAuthModal(true);
  }, [controlledPatientId]);

  useEffect(() => {
    setRecords([]);
    setError("");
    setTypeFilter("");
    setRecordSearch("");
    setDateFrom("");
    setDateTo("");
    setShowInactive(false);
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
    const activeTypes = typeFilter ? (TYPE_FILTER_GROUPS[typeFilter] || [typeFilter]) : [];
    const searchLower = recordSearch.trim().toLowerCase();
    return records.filter((r) => {
      if (!showInactive && r.status && r.status !== "active") return false;
      if (activeTypes.length && !activeTypes.includes(r.type)) return false;
      if (dateFrom && r.date && r.date < dateFrom) return false;
      if (dateTo && r.date && r.date > dateTo) return false;
      if (searchLower) {
        const hay = [r.title, r.details, r.professionalName, r.type]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      return true;
    });
  }, [records, typeFilter, showInactive, recordSearch, dateFrom, dateTo]);

  function handleSelectFromDropdown(patient) {
    setShowDropdown(false);
    setQuery(patient.name);
    setPendingPatient(patient);
    setPassword("");
    setAuthError("");
    setShowAuthModal(true);
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
      await verifyChartAccess(token, pendingPatient.id, password, pendingPatient);
      const p = pendingPatient;
      setSelectedPatient(p);
      setUnlockedPatientId(p.id);
      setShowAuthModal(false);
      setPendingPatient(null);
      setPassword("");
      if (typeof onSelectPatientId === "function") onSelectPatientId(p.id);
    } catch (err) {
      const status = err.status;
      const message = String(err.message || "");
      const isRouteMissing = message === "Erro na API";

      // Em dev, rota ainda não deployada no backend remoto → liberar diretamente.
      if (isRouteMissing && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          "[DEV] POST /medical-records/access/verify não encontrado no backend.\n" +
          "Acesso liberado sem validação remota (apenas em dev).\n" +
          "Para validação real: inicie backend local e exporte VITE_API_PROXY_TARGET=http://localhost:3002"
        );
        const p = pendingPatient;
        setSelectedPatient(p);
        setUnlockedPatientId(p.id);
        setShowAuthModal(false);
        setPendingPatient(null);
        setPassword("");
        if (typeof onSelectPatientId === "function") onSelectPatientId(p.id);
        return;
      }

      const msg =
        status === 401 ? "Sessão expirada. Faça login novamente." :
        status === 403 ? "Seu perfil não tem permissão para acessar prontuários." :
        status === 400 ? "Paciente inválido ou não selecionado." :
        status === 404 && !isRouteMissing ? message :
        status === 422 ? "Senha incorreta." :
        isRouteMissing || status >= 500 ? "Não foi possível validar sua identidade agora." :
        message || "Senha incorreta. Acesso negado.";
      setAuthError(msg);
    } finally {
      setAuthBusy(false);
    }
  }

  function handleCloseChart() {
    setSelectedPatient(null);
    setUnlockedPatientId(null);
    setQuery("");
    if (typeof onSelectPatientId === "function") onSelectPatientId("");
  }

  function handleInactivateRequest(record) {
    setPendingInactivate(record);
    setInactivateReason("");
    setInactivateError("");
  }

  function handleCloseInactivate() {
    setPendingInactivate(null);
    setInactivateReason("");
    setInactivateError("");
  }

  async function handleConfirmInactivate(event) {
    event.preventDefault();
    const reason = inactivateReason.trim();
    if (reason.length < 8) {
      setInactivateError("Justificativa obrigatória (mínimo 8 caracteres).");
      return;
    }
    setInactivateBusy(true);
    setInactivateError("");
    try {
      await inactivateRecord(token, selectedPatient.id, pendingInactivate.id, reason);
      const data = await getPatientHistory(token, selectedPatient.id);
      setRecords(Array.isArray(data) ? data : []);
      setPendingInactivate(null);
      setInactivateReason("");
    } catch (err) {
      setInactivateError(err.message || "Não foi possível inativar o registro.");
    } finally {
      setInactivateBusy(false);
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
  const hasAllergy = Boolean(selectedPatient?.allergies);
  const chronicList = Array.isArray(selectedPatient?.chronicConditions)
    ? selectedPatient.chronicConditions.filter(Boolean)
    : [];

  return (
    <div className="records-page">
      <PageHeader
        eyebrow="PRONTUÁRIO ELETRÔNICO"
        title="Prontuário"
        subtitle="Acesso protegido a informações clínicas e dados sensíveis dos pacientes."
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

      {pendingInactivate && (
        <Modal title="Inativar registro clínico" onClose={handleCloseInactivate}>
          <form className="chr-inactivate-modal" onSubmit={handleConfirmInactivate}>
            <p>
              O registro <strong>"{pendingInactivate.title}"</strong> será marcado como inativo.
              Ele não será excluído — permanece acessível com o filtro "Mostrar inativos".
            </p>
            <Input
              label="Justificativa obrigatória"
              type="text"
              value={inactivateReason}
              onChange={(e) => { setInactivateReason(e.target.value); setInactivateError(""); }}
              placeholder="Descreva o motivo (mínimo 8 caracteres)..."
              disabled={inactivateBusy}
              autoFocus
            />
            {inactivateError ? <span className="field__error">{inactivateError}</span> : null}
            <p className="records-auth-modal__lgpd">
              Esta ação é registrada no log de auditoria e não pode ser desfeita pelo sistema.
            </p>
            <div className="records-auth-modal__actions">
              <Button variant="secondary" type="button" size="sm" onClick={handleCloseInactivate} disabled={inactivateBusy}>
                Cancelar
              </Button>
              <Button variant="danger" type="submit" size="sm" disabled={inactivateBusy || inactivateReason.trim().length < 8}>
                {inactivateBusy ? "Salvando..." : "Confirmar inativação"}
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

          <div className="chr-patient-header">
            <Avatar name={selectedPatient.name} size="lg" />
            <div className="chr-patient-main">
              <div className="chr-patient-name-row">
                <span className="chr-patient-name">{selectedPatient.name}</span>
                <span className="chr-audited-badge">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M3.5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Acesso auditado
                </span>
              </div>
              <div className="chr-patient-meta">
                {[
                  age !== null ? `${age} anos` : null,
                  sexLabel(selectedPatient.sex),
                  catLabel([], selectedPatient.careCategory) || null,
                  selectedPatient.cpf ? `CPF ${selectedPatient.cpf}` : null,
                  selectedPatient.cns ? `CNS ${selectedPatient.cns}` : null,
                  teamMember ? `Equipe: ${teamMember.name}` : null,
                ].filter(Boolean).join(" · ")}
              </div>
              {(hasAllergy || chronicList.length > 0) && (
                <div className="chr-patient-alerts">
                  {hasAllergy && (
                    <span className="chr-clinical-alert chr-clinical-alert--warning">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 2L14 13H2L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                        <path d="M8 7v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      Alergia: {selectedPatient.allergies}
                    </span>
                  )}
                  {chronicList.map((c) => (
                    <span key={c} className="chr-clinical-alert chr-clinical-alert--info">{c}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="chr-patient-aside">
              <span className="chr-lgpd-notice">
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <rect x="1.5" y="5.5" width="9" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M3.5 5.5V3.5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                Dados sensíveis — LGPD
              </span>
              <div className="chr-patient-btns">
                {onNavigatePatient && (
                  <Button variant="secondary" size="sm" onClick={() => onNavigatePatient(selectedPatient.id)}>
                    Abrir ficha
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={handleCloseChart}>Trocar paciente</Button>
                <Button variant="ghost" size="sm" onClick={handleCloseChart}>Fechar</Button>
              </div>
            </div>
          </div>

          <div className="chr-filter-bar">
            <input
              className="chr-search-input"
              type="text"
              value={recordSearch}
              onChange={(e) => setRecordSearch(e.target.value)}
              placeholder="Buscar no prontuário..."
              aria-label="Buscar registros clínicos"
            />
            <select
              className="chr-filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filtrar por tipo de registro"
            >
              <option value="">Todos os tipos</option>
              <option value="atendimento">Atendimento / Consulta</option>
              <option value="visit">Visita domiciliar</option>
              <option value="exam_request">Exame</option>
              <option value="vaccine">Vacina</option>
              <option value="prescription">Prescrição</option>
              <option value="referral">Encaminhamento</option>
              <option value="procedimento">Procedimento / Evolução</option>
              <option value="note">Anotação</option>
              <option value="atestado">Atestado / Documento</option>
            </select>
            <input
              className="chr-date-input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Data inicial"
              title="Data inicial"
            />
            <input
              className="chr-date-input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Data final"
              title="Data final"
            />
            <label className="chr-inactive-toggle">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              <span>Mostrar inativos</span>
            </label>
          </div>

          {error ? <Alert tone="danger">{error}</Alert> : null}
          {busy ? <Alert tone="info">Carregando registros clínicos...</Alert> : null}

          {!busy && visibleRecords.length > 0 ? (
            <div className="chr-timeline">
              {visibleRecords.map((r) => (
                <RecordCard
                  key={r.id}
                  record={r}
                  fmtDate={fmtDate}
                  onInactivate={handleInactivateRequest}
                  canInactivate={canWrite}
                />
              ))}
            </div>
          ) : (
            !busy && <RecordEmptyState hasPatient />
          )}

          <p className="records-audit-notice">
            Acesso registrado no log de auditoria com sua identidade, conforme a Lei 13.709/2018 (LGPD).
          </p>
        </div>
      )}
    </div>
  );
}
