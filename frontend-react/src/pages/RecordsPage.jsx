import { useEffect, useMemo, useState } from "react";
import { deleteRecord, getPatientHistory, login, verifyLogin2fa } from "../api";

import PageHeader from "../components/layout/PageHeader";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import RecordEmptyState from "../components/records/RecordEmptyState";
import RecordFilters from "../components/records/RecordFilters";
import RecordHeader from "../components/records/RecordHeader";
import RecordTimeline from "../components/records/RecordTimeline";
import { canAccessChart, canWriteRecords } from "../utils/roles";

export default function RecordsPage({
  patients,
  users,
  user,
  token,
  onNavigatePatient,
  selectedPatientId: controlledPatientId = "",
  onSelectPatientId,
  onApplySessionPayload,
}) {
  const [query, setQuery] = useState("");
  const [localSelectedPatientId, setLocalSelectedPatientId] = useState(controlledPatientId || "");
  const [records, setRecords] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [chartLocked, setChartLocked] = useState(true);
  const [lockPassword, setLockPassword] = useState("");
  const [lockCode, setLockCode] = useState("");
  const [lockError, setLockError] = useState("");
  const [lockBusy, setLockBusy] = useState(false);
  const [lockChallenge, setLockChallenge] = useState(null);

  const canAccess = canAccessChart(user);
  const canWrite = canWriteRecords(user);

  useEffect(() => {
    if (controlledPatientId && controlledPatientId !== localSelectedPatientId) {
      setLocalSelectedPatientId(controlledPatientId);
    }
  }, [controlledPatientId, localSelectedPatientId]);

  useEffect(() => {
    setChartLocked(true);
    setLockPassword("");
    setLockCode("");
    setLockChallenge(null);
    setLockError("");
  }, [localSelectedPatientId]);

  function handleSelectPatient(patientId) {
    setLocalSelectedPatientId(patientId);
    if (typeof onSelectPatientId === "function") onSelectPatientId(patientId);
  }

  async function handleUnlock(event) {
    event.preventDefault();
    if (!lockPassword.trim()) {
      setLockError("Informe sua senha para liberar o acesso.");
      return;
    }
    setLockBusy(true);
    setLockError("");
    try {
      const payload = await login(user?.email, lockPassword);
      if (payload?.twoFactorRequired) {
        setLockChallenge(payload);
        return;
      }
      onApplySessionPayload?.(payload);
      setChartLocked(false);
      setLockPassword("");
    } catch {
      setLockError("Senha incorreta. Acesso negado.");
    } finally {
      setLockBusy(false);
    }
  }

  async function handleVerifyUnlock(event) {
    event.preventDefault();
    if (!lockChallenge?.challengeId || lockCode.length !== 6) {
      setLockError("Informe o código 2FA de 6 dígitos.");
      return;
    }
    setLockBusy(true);
    setLockError("");
    try {
      const payload = await verifyLogin2fa(lockChallenge.challengeId, lockCode);
      onApplySessionPayload?.(payload);
      setChartLocked(false);
      setLockPassword("");
      setLockCode("");
      setLockChallenge(null);
    } catch {
      setLockError("Código 2FA inválido. Acesso negado.");
    } finally {
      setLockBusy(false);
    }
  }

  const filteredPatients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((patient) => `${patient.name || ""} ${patient.cpf || ""} ${patient.cns || ""}`.toLowerCase().includes(term));
  }, [patients, query]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === localSelectedPatientId) || null,
    [patients, localSelectedPatientId],
  );

  const visibleRecords = useMemo(
    () => records.filter((record) => !typeFilter || record.type === typeFilter),
    [records, typeFilter],
  );

  useEffect(() => {
    if (!localSelectedPatientId || !token || chartLocked) {
      setRecords([]);
      return;
    }

    let active = true;
    setBusy(true);
    setError("");
    getPatientHistory(token, localSelectedPatientId)
      .then((data) => { if (active) setRecords(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Erro ao carregar prontuário."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [localSelectedPatientId, token, chartLocked]);

  async function handleDelete(recordId) {
    if (!localSelectedPatientId) return;
    setBusy(true);
    setError("");
    try {
      await deleteRecord(token, localSelectedPatientId, recordId);
      const data = await getPatientHistory(token, localSelectedPatientId);
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
        <PageHeader eyebrow="Vitras" title="Prontuário" subtitle="Acesso restrito a perfis com autorização clínica." />
        <Alert tone="danger">O prontuário eletrônico é acessível apenas por perfis autorizados da equipe clínica.</Alert>
      </div>
    );
  }

  return (
    <div className="records-page">
      <PageHeader
        eyebrow="Vitras"
        title="Prontuário"
        subtitle="Workspace clínico com timeline, filtros estruturados e acesso protegido por reautenticação."
        actions={selectedPatient ? <Button variant="secondary" onClick={() => onNavigatePatient(selectedPatient.id)}>Abrir paciente</Button> : null}
      />

      <section className="page-kpis">
        <div className="kpi card card--compact kpi--info">
          <span className="kpi__label">Pacientes</span>
          <strong className="kpi__value">{patients.length}</strong>
          <span className="kpi__helper">{filteredPatients.length} visíveis</span>
        </div>
        <div className={`kpi card card--compact${selectedPatient ? " kpi--warning" : ""}`}>
          <span className="kpi__label">Selecionado</span>
          <strong className="kpi__value">{selectedPatient ? "1" : "0"}</strong>
          <span className="kpi__helper">{selectedPatient?.name || "nenhum"}</span>
        </div>
        <div className="kpi card card--compact kpi--success">
          <span className="kpi__label">Registros</span>
          <strong className="kpi__value">{visibleRecords.length}</strong>
          <span className="kpi__helper">{typeFilter || "todos os tipos"}</span>
        </div>
      </section>

      <RecordHeader
        query={query}
        setQuery={setQuery}
        patientOptions={filteredPatients}
        selectedPatientId={localSelectedPatientId}
        onSelectPatient={handleSelectPatient}
      />

      {selectedPatient && chartLocked ? (
        <Card className="card--operational">
          <div className="records-security-gate">
            <div className="records-security-gate__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1.2" fill="currentColor" />
              </svg>
            </div>
            <div className="records-security-gate__content">
              <p className="records-security-gate__title">Confirmação de identidade obrigatória</p>
              <p className="records-security-gate__desc">
                O acesso ao prontuário de <strong>{selectedPatient.name}</strong> exige reautenticação por exigência da LGPD e das diretrizes de segurança clínica.
                {lockChallenge ? " Informe agora o código 2FA para concluir a liberação." : " Informe sua senha de acesso ao sistema para iniciar a liberação."}
              </p>
              <form className="records-security-gate__form" onSubmit={lockChallenge ? handleVerifyUnlock : handleUnlock}>
                <Input
                  className="records-security-gate__input"
                  type={lockChallenge ? "text" : "password"}
                  placeholder={lockChallenge ? "Código 2FA" : "Senha de acesso"}
                  value={lockChallenge ? lockCode : lockPassword}
                  onChange={(e) => {
                    if (lockChallenge) {
                      setLockCode(e.target.value.replace(/\D+/g, "").slice(0, 6));
                    } else {
                      setLockPassword(e.target.value);
                    }
                    setLockError("");
                  }}
                  autoComplete={lockChallenge ? "one-time-code" : "current-password"}
                  disabled={lockBusy}
                />
                {lockError ? <span className="field__error">{lockError}</span> : null}
                <Button variant="primary" type="submit" disabled={lockBusy || (lockChallenge ? lockCode.length !== 6 : !lockPassword.trim())}>
                  {lockBusy ? "Verificando..." : (lockChallenge ? "Validar 2FA" : "Liberar acesso")}
                </Button>
              </form>
              <p className="records-security-gate__lgpd">
                Esta ação é registrada no log de auditoria com data, hora e identidade do responsável, conforme a Lei 13.709/2018 (LGPD).
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <RecordFilters typeFilter={typeFilter} setTypeFilter={setTypeFilter} />

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Card className="card--noPad card--operational">
            <div className="card__header">
              <div>
                <div className="card__title">Linha do tempo clínica</div>
                <div className="card__subtitle">
                  {selectedPatient ? `${visibleRecords.length} registro(s) filtrados para ${selectedPatient.name}` : "Selecione um paciente para iniciar a leitura"}
                </div>
              </div>
            </div>
            <div className="card__body">
              {busy && selectedPatient ? <Alert tone="info">Carregando registros clínicos...</Alert> : null}
              {visibleRecords.length ? (
                <RecordTimeline records={visibleRecords} fmtDate={(value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-"} onDelete={handleDelete} canDelete={canWrite} />
              ) : (
                <RecordEmptyState hasPatient={Boolean(selectedPatient)} />
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
