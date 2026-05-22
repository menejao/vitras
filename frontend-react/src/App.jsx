// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import { useEffect, useMemo, useRef, useState } from "react";
import { readUiState, writeLS } from "./utils/storage";
import { UI_STATE_KEY } from "./config/constants";
import { useTheme } from "./hooks/useTheme";
import { isReceptionist, isAdmin, canWriteRecords } from "./utils/roles";
import AppShell from "./components/layout/AppShell";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import { TabContent } from "./components/TabContent";
import { useAgenda } from "./hooks/useAgenda";
import { usePharmacy } from "./hooks/usePharmacy";
import { useReferrals } from "./hooks/useReferrals";
import { useSupplies } from "./hooks/useSupplies";
import { useApiHealth } from "./hooks/useApiHealth";
import { useAuth } from "./hooks/useAuth";
import { useBootstrap } from "./hooks/useBootstrap";
import { usePatientModal } from "./hooks/usePatientModal";
import { useUserTemplateHandlers } from "./hooks/useUserTemplateHandlers";
import { useSecureAccess } from "./hooks/useSecureAccess";
import { useProfile } from "./hooks/useProfile";
import { usePatientActivity } from "./hooks/usePatientActivity";
import { useAiHandlers } from "./hooks/useAiHandlers";
import { usePatientAlerts } from "./hooks/usePatientAlerts";
import { useIdleTimeout } from "./hooks/useIdleTimeout";
import ReceptionistApp from "./pages/ReceptionistApp";
import AuthScreen from "./pages/AuthScreen";
import ActivateAccountPage from "./pages/ActivateAccountPage";
import AppErrorBoundary from "./components/feedback/AppErrorBoundary";
import OfflineBanner from "./components/feedback/OfflineBanner";
import ComplianceBadge from "./components/feedback/ComplianceBadge";
import SessionTimeoutModal from "./components/feedback/SessionTimeoutModal";
import { AppModals } from "./components/AppModals";
import registerServiceWorker from "./services/registerServiceWorker";

registerServiceWorker();
function AppInner() {
  const uiState = useMemo(()=>{
    try { return readUiState(); } catch { return {}; }
  },[]);

  const sessionExpiredRef = useRef(null);
  const {
    token, user, setUser,
    busy, setBusy, error, setError,
    loginChallenge, cancelTwoFactor,
    handleLogin, handleVerifyLoginTwoFactor,
    handleApiError, applySessionFromPayload, refreshUserFromBoot,
    persistCookieSession,
    logout,
  } = useAuth({
    onSessionExpired: () => { sessionExpiredRef.current?.(); },
    onLoginSuccess: (nextUser) => {
      if (String(nextUser?.role || "") === "gestor") setTab("gestor");
    },
  });
  const apiHealth = useApiHealth();
  const { theme, toggleTheme } = useTheme();
  const [tab,  setTab]  = useState(()=>{ const t=uiState?.tab; if(t) return t; return "dashboard"; });
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientTab, setPatientTab] = useState(uiState?.patientTab==="history"?"chart":(uiState?.patientTab||"protocol"));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => Boolean(uiState?.sidebarCollapsed));

  useEffect(() => { writeLS(UI_STATE_KEY, { tab, patientTab, sidebarCollapsed }); }, [tab, patientTab, sidebarCollapsed]);
  const {
    patients, setPatients,
    users, templates, protocolByPatient, allUsers, publicTeams,
    demandMonthly, setDemandMonthly,
    lastLoadAt,
    appointments, tasks, messages, history, patientProtocolSummary,
    patientDataLoading,
    loadAll, loadSelectedPatientData,
    reset: resetBootstrap,
  } = useBootstrap(token, { handleApiError, setBusy, setError, refreshUserFromBoot, currentUserId: user?.id });
  sessionExpiredRef.current = () => { resetBootstrap(); setSelectedPatientId(""); };
  const [query,          setQuery]          = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [acsFilter,      setAcsFilter]      = useState("");
  const [conditionFilter, setConditionFilter] = useState(""); // "" | "hypertension" | "diabetes" | "both"
  const {
    editingPatient, showModal, setShowModal, patientModalMode, form, setForm,
    openEditPatient, openViewPatient, lookupCepAndFillAddress, submitPatient, removePatient,
  } = usePatientModal({ token, user, handleApiError, setBusy, setError, loadAll, selectedPatientId, setSelectedPatientId });
  const {
    recordForm, setRecordForm, recordVaccines, setRecordVaccines,
    appointmentForm, setAppointmentForm, taskForm, setTaskForm,
    messageText, setMessageText,
    submitRecord, submitAppointment, submitTask, submitMessage,
    handleDeleteRecord, handleDeleteAppointment, handleStatusChange,
  } = usePatientActivity({ token, user, selectedPatientId, patients, users, setDemandMonthly, handleApiError, setError, loadAll, loadSelectedPatientData });
  const {
    editingUser, showUserModal, setShowUserModal, userForm, setUserForm,
    editingTemplate, showTemplateModal, setShowTemplateModal, templateForm, setTemplateForm,
    pendingUserDelete, setPendingUserDelete,
    pendingTemplateDelete, setPendingTemplateDelete,
    deleteReason, setDeleteReason,
    canManageUser,
    openEditUser, submitUser, removeUser,
    openEditTemplate, submitTemplate, removeTemplate,
    confirmUserDelete, confirmTemplateDelete,
  } = useUserTemplateHandlers({ token, user, handleApiError, setBusy, setError, loadAll });
  const { aiView, aiData, aiQuestion, setAiQuestion, loadAiPriorities, loadAiQuality, loadAiReport, submitAiQuestion } = useAiHandlers({ token, handleApiError, setBusy, setError });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const {
    showProfileModal, setShowProfileModal, profileForm, setProfileForm, profileBusy, profileError,
    openProfile, submitProfile,
  } = useProfile({ token, user, setUser, persistCookieSession });
  const {
    secureAccessMode, setSecureAccessMode, secureAccessBusy, secureAccessError, setSecureAccessError,
    openSecureAccess, submitSecureAccess, stopSecureImpersonation, stopBreakGlass,
  } = useSecureAccess({ token, user, applySessionFromPayload, loadAll, setError });
  const canUseAgenda = Boolean(
    token &&
    user?.teamId &&
    (user?.capabilities?.includes("agenda.read") || user?.capabilities?.includes("agenda.write"))
  );
  const { entries: agendaEntries = [] } = useAgenda(token, { enabled: canUseAgenda });
  const canUseReferrals = Boolean(
    token &&
    user?.teamId &&
    (user?.capabilities?.includes("referrals.read") || user?.capabilities?.includes("referrals.write"))
  );
  const {
    entries: referralEntries = [],
    loading: referralsLoading,
    error: referralsError,
    createEntry: createReferralEntry,
    patchEntry: patchReferralEntry,
    removeEntry: removeReferralEntry,
  } = useReferrals(token, { enabled: canUseReferrals });
  const canUsePharmacy = Boolean(
    token &&
    user?.teamId &&
    (user?.capabilities?.includes("pharmacy.read") || user?.capabilities?.includes("pharmacy.write"))
  );
  const {
    stock: pharmacyStock = [],
    log: pharmacyLog = [],
    loading: pharmacyLoading,
    error: pharmacyError,
    createItem: createPharmacyItem,
    updateItem: updatePharmacyItem,
    adjustItem: adjustPharmacyItem,
    dispenseItem: dispensePharmacyItem,
  } = usePharmacy(token, { enabled: canUsePharmacy });
  const canUseSupplies = Boolean(
    token &&
    user?.teamId &&
    (user?.capabilities?.includes("supplies.read") || user?.capabilities?.includes("supplies.write"))
  );
  const {
    stock: suppliesStock = [],
    log: suppliesLog = [],
    continuous: suppliesContinuous = [],
    loading: suppliesLoading,
    error: suppliesError,
    adjustStock: adjustSuppliesStock,
    dispense: dispenseSupplies,
    closeContinuous: closeSuppliesContinuous,
  } = useSupplies(token, { enabled: canUseSupplies });

  const selectedPatient = patients.find(p=>p.id===selectedPatientId)||null;
  const isEquipeRosaUser = String(user?.teamId||user?.teamName||"").toLowerCase().includes("rosa");
  const canReadAuditLog = isAdmin(user) || user?.capabilities?.includes("audit.read");

  // Carrega dados do paciente selecionado sempre que a seleção muda
  useEffect(() => {
    if (selectedPatientId && token && !String(token).startsWith("local_")) {
      loadSelectedPatientData(selectedPatientId);
    }
  }, [selectedPatientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { rosaAdjustedSummary, sortedSpecialAlerts } = usePatientAlerts({ selectedPatient, patientProtocolSummary, history, isEquipeRosaUser });

  const isAuthenticated = !!(token && user && typeof user === "object");
  const { showWarning: sessionShowWarning, remaining: sessionRemaining, stayActive, doLogout: forceLogout } = useIdleTimeout({
    onLogout: logout,
    enabled: isAuthenticated,
  });

  /* â"€â"€ Auth guard â€" login único, roteamento por perfil â"€â"€ */
  /* rota /activate — primeiro acesso via token (sem auth) */
  const _path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (_path === "/activate" || _path === "/primeiro-acesso") {
    return <ActivateAccountPage />;
  }

  if (!token || !user || typeof user !== 'object') {
    return (
      <AuthScreen
        onLogin={handleLogin}
        onVerifyTwoFactor={handleVerifyLoginTwoFactor}
        loginChallenge={loginChallenge}
        onCancelTwoFactor={cancelTwoFactor}
        error={error}
        busy={busy}
      />
    );
  }

  // Recepcionista → app dedicado de recepção
  if (isReceptionist(user) && !isAdmin(user)) {
    return (
      <div style={{position:"fixed",inset:0}}>
        <ReceptionistApp
          recUser={user}
          patients={patients}
          users={users}
          templates={templates}
          token={token}
          onLogout={logout}/>
      </div>
    );
  }

  const catOpts=templates.map(t=>({value:t.category,label:t.label}));
  // Todos os perfis com acesso ao módulo visualizam todos os pacientes.


  return (
    <main className="app">
      <OfflineBanner/>
      <ComplianceBadge/>
      <AppShell
        mobileNavOpen={mobileNavOpen}
        onCloseMobileNav={()=>setMobileNavOpen(false)}
        topbar={<Topbar
          user={user} selectedPatient={selectedPatient} templates={templates}
          mobileOpen={mobileNavOpen} setMobileOpen={setMobileNavOpen}
          onLogout={logout} onOpenProfile={openProfile}
          onOpenSecureAccess={openSecureAccess}
          onStopImpersonation={stopSecureImpersonation}
          onActivateBreakGlass={()=>openSecureAccess("break-glass")}
          onDeactivateBreakGlass={stopBreakGlass}
          patients={patients} protocolByPatient={protocolByPatient}
          pharmacyStock={pharmacyStock}
          agenda={agendaEntries}
          apiHealth={apiHealth}
          onNavigatePatient={(id)=>{ setTab("patients"); setSelectedPatientId(id); }}
          theme={theme} onToggleTheme={toggleTheme}
        />}
        sidebar={<Sidebar
          tab={tab} setTab={setTab}
          mobileOpen={mobileNavOpen} setMobileOpen={setMobileNavOpen}
          query={query} setQuery={setQuery}
          user={user} canManageUser={canManageUser}
          onClearPatient={()=>setSelectedPatientId("")}
          collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(v => !v)}
        />}
      >
        <TabContent
          tab={tab} error={error} setError={setError} busy={busy}
          user={user} token={token}
          patients={patients} setPatients={setPatients} users={users} allUsers={allUsers} templates={templates} protocolByPatient={protocolByPatient}
          publicTeams={publicTeams} demandMonthly={demandMonthly} lastLoadAt={lastLoadAt} apiHealth={apiHealth}
          appointments={appointments} tasks={tasks} messages={messages} history={history}
          patientDataLoading={patientDataLoading}
          selectedPatientId={selectedPatientId} setSelectedPatientId={setSelectedPatientId} selectedPatient={selectedPatient}
          patientTab={patientTab} setPatientTab={setPatientTab}
          query={query} setQuery={setQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
          acsFilter={acsFilter} setAcsFilter={setAcsFilter} conditionFilter={conditionFilter} setConditionFilter={setConditionFilter}
          rosaAdjustedSummary={rosaAdjustedSummary} sortedSpecialAlerts={sortedSpecialAlerts}
          canReadAuditLog={canReadAuditLog} canManageUser={canManageUser} canWriteRecords={canWriteRecords(user)}
          setTab={setTab} loadAll={loadAll} applySessionFromPayload={applySessionFromPayload}
          agendaEntries={agendaEntries} referralEntries={referralEntries} referralsLoading={referralsLoading} referralsError={referralsError}
          createReferralEntry={createReferralEntry} patchReferralEntry={patchReferralEntry} removeReferralEntry={removeReferralEntry}
          pharmacyStock={pharmacyStock} pharmacyLog={pharmacyLog} pharmacyLoading={pharmacyLoading} pharmacyError={pharmacyError} canUsePharmacy={canUsePharmacy}
          createPharmacyItem={createPharmacyItem} updatePharmacyItem={updatePharmacyItem} adjustPharmacyItem={adjustPharmacyItem} dispensePharmacyItem={dispensePharmacyItem}
          suppliesStock={suppliesStock} suppliesLog={suppliesLog} suppliesContinuous={suppliesContinuous} suppliesLoading={suppliesLoading} suppliesError={suppliesError} canUseSupplies={canUseSupplies}
          adjustSuppliesStock={adjustSuppliesStock} dispenseSupplies={dispenseSupplies} closeSuppliesContinuous={closeSuppliesContinuous}
          aiView={aiView} aiData={aiData} aiQuestion={aiQuestion} setAiQuestion={setAiQuestion}
          loadAiPriorities={loadAiPriorities} loadAiQuality={loadAiQuality} loadAiReport={loadAiReport} submitAiQuestion={submitAiQuestion}
          openEditPatient={openEditPatient} removePatient={removePatient} openViewPatient={openViewPatient}
          openEditTemplate={openEditTemplate} removeTemplate={removeTemplate}
          openEditUser={openEditUser} removeUser={removeUser}
          recordForm={recordForm} setRecordForm={setRecordForm} recordVaccines={recordVaccines} setRecordVaccines={setRecordVaccines}
          appointmentForm={appointmentForm} setAppointmentForm={setAppointmentForm} taskForm={taskForm} setTaskForm={setTaskForm}
          messageText={messageText} setMessageText={setMessageText}
          submitRecord={submitRecord} submitAppointment={submitAppointment} submitTask={submitTask} submitMessage={submitMessage}
          handleDeleteRecord={handleDeleteRecord} handleDeleteAppointment={handleDeleteAppointment} handleStatusChange={handleStatusChange}
        />
      </AppShell>

      <AppModals
        showModal={showModal} setShowModal={setShowModal} editingPatient={editingPatient} form={form} setForm={setForm}
        users={users} catOpts={catOpts} lookupCepAndFillAddress={lookupCepAndFillAddress} patientModalMode={patientModalMode}
        submitPatient={submitPatient} error={error} busy={busy}
        showUserModal={showUserModal} setShowUserModal={setShowUserModal} editingUser={editingUser} userForm={userForm} setUserForm={setUserForm} submitUser={submitUser}
        showTemplateModal={showTemplateModal} setShowTemplateModal={setShowTemplateModal} editingTemplate={editingTemplate} templateForm={templateForm} setTemplateForm={setTemplateForm} submitTemplate={submitTemplate}
        showProfileModal={showProfileModal} setShowProfileModal={setShowProfileModal} profileForm={profileForm} setProfileForm={setProfileForm}
        profileError={profileError} profileBusy={profileBusy} submitProfile={submitProfile} user={user}
        secureAccessMode={secureAccessMode} setSecureAccessMode={setSecureAccessMode} secureAccessBusy={secureAccessBusy}
        secureAccessError={secureAccessError} setSecureAccessError={setSecureAccessError}
        submitSecureAccess={submitSecureAccess} allUsers={allUsers}
        pendingUserDelete={pendingUserDelete} setPendingUserDelete={setPendingUserDelete}
        pendingTemplateDelete={pendingTemplateDelete} setPendingTemplateDelete={setPendingTemplateDelete}
        deleteReason={deleteReason} setDeleteReason={setDeleteReason}
        confirmUserDelete={confirmUserDelete} confirmTemplateDelete={confirmTemplateDelete}
      />

      {sessionShowWarning && (
        <SessionTimeoutModal
          remaining={sessionRemaining}
          onStay={stayActive}
          onLogout={forceLogout}
        />
      )}
    </main>
  );
}

/* â"€â"€ App exportado â€" envolve tudo no ErrorBoundary â"€â"€ */
export function App() {
  return (
    <AppErrorBoundary>
      <AppInner />
    </AppErrorBoundary>
  );
}



