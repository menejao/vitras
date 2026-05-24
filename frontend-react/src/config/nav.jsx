import {
  isAdmin,
  isGestor,
  isReceptionist,
  isPharmacist,
  isNursingTech,
  canAccessChart,
  canAccessAI,
  hasCapability
} from "../utils/roles";

export const NAV_ICON = {
  dashboard: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg>,
  queue: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1 14c0-2.5 1.8-4 4-4s4 1.5 4 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M11 7h4M11 10h3M11 13h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  agenda: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M4.5 1.5v2M11.5 1.5v2M1.5 6.5h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M5 10h2M9 10h2M5 12.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  triage: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" stroke="currentColor" strokeWidth="1.4"/><path d="M8 3.5v2l1.2 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 14c0-2 2.24-3.5 5-3.5s5 1.5 5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  patients: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  protocols: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="currentColor" strokeWidth="1.4"/><path d="M10 2v3h3M6 7h4M6 10h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  referrals: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chart: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="currentColor" strokeWidth="1.4"/><path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="4.5" cy="7" r=".8" fill="currentColor"/><circle cx="4.5" cy="9.5" r=".8" fill="currentColor"/><circle cx="4.5" cy="12" r=".8" fill="currentColor"/></svg>,
  vaccines: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M10 2l4 4-1.5 1.5-1-1-5 5 1 1L6 14l-4-4 1.5-1.5 1 1 5-5-1-1L10 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M2 14l2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  pharmacy: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M5 3V2M11 3V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  insumos: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 4h10v9H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M6 4V2.5a2 2 0 014 0V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  acs: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1 13c0-2.761 2.239-5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M12 7v3M10.5 8.5l1.5 1.5 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  doctors: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M3 13c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M8 10v4M6 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  reports: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 2h10v12H3z" stroke="currentColor" strokeWidth="1.4"/><path d="M6 6h5M6 8.5h5M6 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5 5.5l.5.5 1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  gestor: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2.5 4.5h11v8h-11z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M2.5 7.5h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5 11h2M9 11h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M6 2.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  ai: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.5 3h3l-2.5 2 1 3L8 7.5 5 9l1-3L3.5 4h3L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M3 12h10M5 14h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  exams_page: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="currentColor" strokeWidth="1.4"/><path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="11.5" cy="11.5" r="2.8" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3"/><path d="M10.5 11.5h2M11.5 10.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  diagnostics: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 2h12v12H2z" stroke="currentColor" strokeWidth="1.4"/><path d="M4.5 11V8.5M8 11V5M11.5 11V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M4 4h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  acs_tasks: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  access_requests: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1 13c0-2.761 2.239-5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M10 8h5M12.5 5.5v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  audit_log: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
};

export function buildNavItems(user, canManageUser) {
  const admin = isAdmin(user);
  const role = String(user?.role || "");
  const items = [];
  const canReadDashboard = admin || hasCapability(user, "dashboard.read") || !isReceptionist(user);
  const canReadPatients = admin || hasCapability(user, "patients.read.all") || hasCapability(user, "patients.read.scoped");
  const canReadReports = admin || hasCapability(user, "reports.read");
  const canReadDiagnostics = admin || hasCapability(user, "diagnostics.read");
  const canReadAccessRequests = admin || hasCapability(user, "access_requests.read") || isGestor(user);
  const canReadAuditLog = admin || hasCapability(user, "audit.read");
  const canReadPharmacy = admin || hasCapability(user, "pharmacy.read") || hasCapability(user, "pharmacy.write");
  const canReadSupplies = admin || hasCapability(user, "supplies.read") || hasCapability(user, "supplies.write");

  if (isGestor(user) && !admin) {
    items.push({ id: "gestor", label: "Gestão à Vista", section: "" });
    items.push({ id: "reports", label: "Relatórios", section: "" });
    items.push({ id: "diagnostics", label: "Diagnósticos", section: "" });
    items.push({ id: "patients", label: "Pacientes", section: "Visualização" });
    items.push({ id: "ai", label: "IA Assistida", section: "" });
    return items;
  }

  if (isReceptionist(user) && !admin) return items;

  if ((!isPharmacist(user) || admin) && canReadDashboard) items.push({ id: "dashboard", label: "Painel", section: "" });

  if (admin) items.push({ id: "queue", label: "Fila / Recepção", section: "Atendimento" });
  if (admin) items.push({ id: "agenda", label: "Agenda", section: "" });
  if (isNursingTech(user) || admin) items.push({ id: "triage", label: "Monitoramento", section: "" });

  if ((!isPharmacist(user) || admin) && canReadPatients) items.push({ id: "patients", label: "Pacientes", section: "Clínico" });
  if (!isPharmacist(user) || admin) items.push({ id: "exams_page", label: "Exames", section: "" });
  if ((canManageUser || admin) && !isNursingTech(user)) items.push({ id: "protocols", label: "Protocolos", section: "" });
  if (canAccessChart(user) || admin) items.push({ id: "chart", label: "Prontuário", section: "" });
  if (!isPharmacist(user) || admin) items.push({ id: "referrals", label: "Encaminhamentos", section: "" });
  if (role === "acs" || admin) items.push({ id: "acs_tasks", label: "ACS", section: "" });

  if (!isPharmacist(user) || admin) items.push({ id: "vaccines", label: "Vacinas", section: "Preventivo" });
  if (canReadPharmacy) items.push({ id: "pharmacy", label: "Farmácia", section: "" });
  if (canReadSupplies) {
    items.push({ id: "insumos", label: "Insumos", section: "" });
  }

  if ((canManageUser || admin) && !isNursingTech(user)) {
    items.push({ id: "acs", label: "ACS", section: "Equipe" });
    items.push({ id: "doctors", label: "Médicos", section: "" });
  }

  if (canManageUser || admin) items.push({ id: "gestor", label: "Gestão à Vista", section: "Gestão" });
  if (canReadReports) items.push({ id: "reports", label: "Relatórios", section: "" });
  if (canReadAccessRequests) items.push({ id: "access_requests", label: "Solicitações de Acesso", section: "" });
  if (canManageUser || admin || isGestor(user) || canReadDiagnostics) items.push({ id: "diagnostics", label: "Diagnósticos", section: "" });
  if (canReadAuditLog) items.push({ id: "audit_log", label: "Auditoria", section: "" });
  if (canAccessAI(user) || admin) items.push({ id: "ai", label: "IA Assistida", section: "" });

  return items;
}
