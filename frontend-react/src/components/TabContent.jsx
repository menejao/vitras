import { lazy, Suspense } from "react";
import Button from "./ui/Button";
import ProtocolsTab from "./ProtocolsTab";
import { isAdmin, isGestor } from "../utils/roles";

const EquipePage = lazy(() => import("../pages/EquipePage"));

const AuditLogPanel      = lazy(() => import("../pages/AuditLogPanel"));
const AcsTasksPage       = lazy(() => import("../pages/AcsTasksPage"));
const ReferralsPage      = lazy(() => import("../pages/ReferralsPage"));
const ReportsPage        = lazy(() => import("../pages/ReportsPage"));
const GestorPage         = lazy(() => import("../pages/GestorPage"));
const AiTab              = lazy(() => import("../pages/AiTab"));
const DiagnosticsPage    = lazy(() => import("../pages/DiagnosticsPage"));
const Dashboard          = lazy(() => import("../pages/Dashboard"));
const TriagePage         = lazy(() => import("../pages/TriagePage"));
const QueuePage          = lazy(() => import("../pages/QueuePage"));
const RecordsPage        = lazy(() => import("../pages/RecordsPage"));
const InsumoPage         = lazy(() => import("../pages/InsumoPage"));
const PharmacyPage       = lazy(() => import("../pages/PharmacyPage"));
const VaccinesPage       = lazy(() => import("../pages/VaccinesPage"));
const ExamsPage          = lazy(() => import("../pages/ExamsPage"));
const AgendaPage         = lazy(() => import("../pages/AgendaPage"));
const PatientsPage       = lazy(() => import("../pages/PatientsPage"));
const NutricaoPage       = lazy(() => import("../pages/NutricaoPage"));
const PsicologiaPage     = lazy(() => import("../pages/PsicologiaPage"));
const FisioterapiaPage   = lazy(() => import("../pages/FisioterapiaPage"));
const ServicoSocialPage  = lazy(() => import("../pages/ServicoSocialPage"));
const TerapiaOcupacionalPage = lazy(() => import("../pages/TerapiaOcupacionalPage"));
const FonoaudiologiaPage = lazy(() => import("../pages/FonoaudiologiaPage"));

export function TabContent({
  tab, error, setError, busy,
  user, token,
  patients, setPatients, patientsPaginationMeta, users, allUsers, templates, protocolByPatient,
  publicTeams, demandMonthly, teamDemand, unitName, lastLoadAt, apiHealth,
  appointments, tasks, messages, history,
  patientDataLoading,
  selectedPatientId, setSelectedPatientId, selectedPatient,
  patientTab, setPatientTab,
  query, setQuery, categoryFilter, setCategoryFilter,
  acsFilter, setAcsFilter, conditionFilter, setConditionFilter,
  rosaAdjustedSummary, sortedSpecialAlerts,
  enabledModules,
  canReadAuditLog, canManageUser, canWriteRecords,
  setTab, loadAll, applySessionFromPayload,
  agendaEntries, agendaLoading, agendaError, setAgendaError,
  createAgendaEntry, patchAgendaEntry, removeAgendaEntry,
  referralEntries, referralsLoading, referralsError,
  createReferralEntry, patchReferralEntry, removeReferralEntry,
  pharmacyStock, pharmacyLog, pharmacyLoading, pharmacyError, canUsePharmacy,
  createPharmacyItem, updatePharmacyItem, adjustPharmacyItem, dispensePharmacyItem,
  suppliesStock, suppliesLog, suppliesContinuous, suppliesLoading, suppliesError, canUseSupplies,
  createSuppliesStock, adjustSuppliesStock, dispenseSupplies, closeSuppliesContinuous,
  aiView, aiData, aiQuestion, setAiQuestion,
  loadAiPriorities, loadAiQuality, loadAiReport, submitAiQuestion,
  openEditPatient, removePatient, openViewPatient,
  openEditTemplate, removeTemplate,
  openEditUser, removeUser,
  openProfile,
  recordForm, setRecordForm, recordVaccines, setRecordVaccines,
  appointmentForm, setAppointmentForm, taskForm, setTaskForm,
  messageText, setMessageText,
  submitRecord, submitAppointment, submitTask, submitMessage,
  handleDeleteRecord, handleDeleteAppointment, handleStatusChange,
}) {
  const navigatePatient = (id) => { setTab("patients"); setSelectedPatientId(id); };
  const usersResolved = allUsers && allUsers.length ? allUsers : users;

  const SPECIALTY_LABELS = {
    nutricao: "Nutrição", psicologia: "Psicologia", fisioterapia: "Fisioterapia",
    servico_social: "Serviço Social", terapia_ocupacional: "Terapia Ocupacional", fonoaudiologia: "Fonoaudiologia"
  };
  const ALL_SPECIALTIES = Object.keys(SPECIALTY_LABELS);
  const isSpecialtyTab = ALL_SPECIALTIES.includes(tab);
  const specialtyBlocked = isSpecialtyTab && enabledModules !== null && !enabledModules?.includes(tab);

  return (
    <Suspense fallback={<div className="loading-spinner" aria-label="Carregando..." />}>
    <section className="main-area">
      {error && tab !== "ai" && (
        <div className="error error-banner">
          {error}
          <Button variant="ghost" size="sm" iconOnly className="icon-btn error-banner__close" onClick={() => setError("")}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </Button>
        </div>
      )}

      {tab === "dashboard" && <Dashboard patients={patients} users={users} allUsers={allUsers || []} templates={templates} protocolByPatient={protocolByPatient} demandMonthly={demandMonthly} teamDemand={teamDemand} unitName={unitName} currentUser={user} agenda={agendaEntries} pharmacyStock={pharmacyStock} onNavigate={navigatePatient} setTab={setTab}/>}

      {tab === "queue" && <QueuePage patients={patients} users={users} user={user} token={token} agenda={agendaEntries} onNewPatient={p => setPatients(prev => [...prev, p])}/>}
      {tab === "triage" && <TriagePage patients={patients} users={users} user={user} token={token}/>}
      {tab === "agenda" && <AgendaPage
        patients={patients} users={users} user={user} token={token} teams={publicTeams}
        onNewPatient={p => setPatients(prev => [...prev, p])} onPatientCreated={loadAll} onNavigatePatient={navigatePatient}
        agenda={agendaEntries} agendaLoading={agendaLoading} agendaError={agendaError} setAgendaError={setAgendaError}
        createEntry={createAgendaEntry} patchEntry={patchAgendaEntry} removeEntry={removeAgendaEntry}
      />}

      {tab === "referrals" && (
        <ReferralsPage
          patients={patients} users={users} user={user}
          referrals={referralEntries} referralsLoading={referralsLoading} referralsError={referralsError}
          onCreateReferral={createReferralEntry} onUpdateReferral={patchReferralEntry} onDeleteReferral={removeReferralEntry}
        />
      )}

      {tab === "acs_tasks" && <AcsTasksPage patients={patients} users={users} user={user} token={token} onNavigatePatient={navigatePatient}/>}
      {tab === "chart" && <RecordsPage patients={patients} users={users} user={user} token={token} onApplySessionPayload={applySessionFromPayload} selectedPatientId={selectedPatientId} onSelectPatientId={setSelectedPatientId} onNavigatePatient={navigatePatient}/>}
      {tab === "exams_page" && <ExamsPage patients={patients} users={users} user={user} token={token} onNavigatePatient={navigatePatient}/>}

      {tab === "gestor" && <GestorPage patients={patients} users={users} templates={templates} protocolByPatient={protocolByPatient} agenda={agendaEntries} referrals={referralEntries} pharmacyStock={pharmacyStock} pharmacyLog={pharmacyLog} token={token} user={user}/>}

      {tab === "audit_log" && canReadAuditLog && <AuditLogPanel />}
      {tab === "reports" && <ReportsPage patients={patients} users={allUsers && allUsers.length ? allUsers : users} templates={templates} protocolByPatient={protocolByPatient} agenda={agendaEntries} referrals={referralEntries} pharmacyStock={pharmacyStock} pharmacyLog={pharmacyLog} suppliesStock={suppliesStock} suppliesLog={suppliesLog}/>}

      {tab === "diagnostics" && (
        <DiagnosticsPage apiHealth={apiHealth} token={token} user={user} patients={patients} users={users} templates={templates} lastLoadAt={lastLoadAt} demandMonthly={demandMonthly}/>
      )}

      {tab === "patients" && (
        <PatientsPage
          patients={patients} patientsPaginationMeta={patientsPaginationMeta} users={usersResolved} templates={templates} protocolByPatient={protocolByPatient}
          query={query} setQuery={setQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
          acsFilter={acsFilter} setAcsFilter={setAcsFilter} conditionFilter={conditionFilter} setConditionFilter={setConditionFilter}
          selectedPatientId={selectedPatientId} setSelectedPatientId={setSelectedPatientId}
          canManageUser={canManageUser} canWriteRecords={canWriteRecords}
          onEdit={openEditPatient} onDelete={removePatient} onView={openViewPatient}
          patientTab={patientTab} setPatientTab={setPatientTab}
          appointments={appointments} tasks={tasks} messages={messages} history={history}
          patientDataLoading={patientDataLoading}
          patientProtocolSummary={rosaAdjustedSummary} sortedSpecialAlerts={sortedSpecialAlerts}
          recordForm={recordForm} setRecordForm={setRecordForm}
          recordVaccines={recordVaccines} setRecordVaccines={setRecordVaccines}
          appointmentForm={appointmentForm} setAppointmentForm={setAppointmentForm}
          taskForm={taskForm} setTaskForm={setTaskForm}
          messageText={messageText} setMessageText={setMessageText}
          onSubmitRecord={submitRecord} onSubmitAppointment={submitAppointment}
          onSubmitTask={submitTask} onSubmitMessage={submitMessage}
          onDeleteRecord={handleDeleteRecord} onDeleteAppointment={handleDeleteAppointment}
          onStatusChange={handleStatusChange}
          selectedPatient={selectedPatient} userObj={user} token={token}
        />
      )}

      {tab === "protocols" && canManageUser && (
        <ProtocolsTab templates={templates} canManageUser={canManageUser} onEdit={openEditTemplate} onDelete={removeTemplate}/>
      )}

      {tab === "equipe" && (
        <EquipePage users={allUsers && allUsers.length ? allUsers : users} user={user} onOpenProfile={openProfile} token={token} canManageUser={canManageUser} />
      )}

      {tab === "vaccines" && (
        <VaccinesPage patients={patients} users={users} templates={templates} token={token} canManageUser={canManageUser} user={user}/>
      )}

      {tab === "pharmacy" && (
        <PharmacyPage
          user={user} token={token} patients={patients} users={usersResolved} templates={templates} history={history}
          stock={pharmacyStock} log={pharmacyLog} loading={pharmacyLoading} error={pharmacyError}
          canRead={canUsePharmacy} canWrite={Boolean(user?.capabilities?.includes("pharmacy.write"))}
          onCreateStockItem={createPharmacyItem} onUpdateStockItem={updatePharmacyItem}
          onAdjustStockItem={adjustPharmacyItem} onDispense={dispensePharmacyItem}
        />
      )}

      {tab === "insumos" && (
        <InsumoPage
          patients={patients} user={user}
          stock={suppliesStock} log={suppliesLog} continuous={suppliesContinuous}
          loading={suppliesLoading} error={suppliesError}
          canRead={canUseSupplies} canWrite={Boolean(user?.capabilities?.includes("supplies.write"))}
          onCreateStock={createSuppliesStock} onAdjustStock={adjustSuppliesStock} onDispense={dispenseSupplies} onCloseContinuous={closeSuppliesContinuous}
        />
      )}

      {tab === "ai" && (
        <AiTab aiView={aiView} aiData={aiData} aiQuestion={aiQuestion} setAiQuestion={setAiQuestion}
          onPriorities={loadAiPriorities} onQuality={loadAiQuality} onReport={loadAiReport}
          onAsk={submitAiQuestion} busy={busy} error={error} setError={setError}/>
      )}

      {specialtyBlocked && (
        <div style={{ padding: "3rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🚫</div>
          <p style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text)", marginBottom: "0.5rem" }}>
            Esta especialidade não está habilitada para esta unidade.
          </p>
          <p style={{ fontSize: "0.9rem" }}>
            {SPECIALTY_LABELS[tab]} não foi ativada para esta UBS. Entre em contato com o Console Nacional.
          </p>
        </div>
      )}
      {!specialtyBlocked && tab === "nutricao" && <NutricaoPage patients={patients} user={user} token={token} />}
      {!specialtyBlocked && tab === "psicologia" && <PsicologiaPage patients={patients} user={user} token={token} />}
      {!specialtyBlocked && tab === "fisioterapia" && <FisioterapiaPage patients={patients} user={user} token={token} />}
      {!specialtyBlocked && tab === "servico_social" && <ServicoSocialPage patients={patients} user={user} token={token} />}
      {!specialtyBlocked && tab === "terapia_ocupacional" && <TerapiaOcupacionalPage patients={patients} user={user} token={token} />}
      {!specialtyBlocked && tab === "fonoaudiologia" && <FonoaudiologiaPage patients={patients} user={user} token={token} />}
    </section>
    </Suspense>
  );
}
