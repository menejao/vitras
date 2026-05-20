function roleValue(user) {
  return String(user?.role || "").toLowerCase();
}

export function roleLabel(role) {
  return {
    nurse_manager: "Enfermeira",
    doctor: "Médico(a)",
    acs: "ACS",
    pharmacist: "Farmacêutico(a)",
    pharmacy_tech: "Téc. de Farmácia",
    nursing_tech: "Téc. Enfermagem",
    receptionist: "Recepcionista",
    dentist: "Dentista",
    gestor: "Gestor(a)",
    developer_readonly: "Desenvolvedor(a) leitura",
    support_operator: "Operador(a) de suporte",
    qa_operator: "QA",
    security_auditor: "Auditor(a) de segurança",
    break_glass_admin: "Administrador break-glass"
  }[String(role || "").toLowerCase()] || role || "-";
}

export function hasCapability(user, capability) {
  const list = Array.isArray(user?.capabilities) ? user.capabilities : [];
  return list.includes(String(capability || "").trim());
}

export function hasAnyCapability(user, capabilities = []) {
  return capabilities.some((capability) => hasCapability(user, capability));
}

export function isReceptionist(user) {
  return roleValue(user) === "receptionist";
}

export function isPharmacist(user) {
  return ["pharmacist", "pharmacy_tech"].includes(roleValue(user));
}

export function isNursingTech(user) {
  return roleValue(user) === "nursing_tech";
}

export function isAdmin(user) {
  return roleValue(user) === "break_glass_admin" || hasCapability(user, "session.break_glass.activate");
}

export const isAdminUser = isAdmin;

export function isAcs(user) {
  return roleValue(user) === "acs";
}

export function canManage(user) {
  return isAdmin(user)
    || ["nurse_manager", "doctor", "dentist"].includes(roleValue(user))
    || hasAnyCapability(user, ["protocols.manage", "team.manage", "users.manage.all", "users.manage.scoped"]);
}

export function isManager(user) {
  return isAdmin(user) || roleValue(user) === "nurse_manager" || hasCapability(user, "team.manage");
}

export function isGestor(user) {
  return roleValue(user) === "gestor";
}

export function canWriteRecords(user) {
  return ["nurse_manager", "doctor", "dentist", "nursing_tech", "acs"].includes(roleValue(user))
    || hasCapability(user, "records.write");
}

export function canAccessAI(user) {
  return ["nurse_manager", "doctor", "dentist"].includes(roleValue(user))
    || hasCapability(user, "ai.access");
}

export function canAccessChart(user) {
  return ["nurse_manager", "doctor", "dentist"].includes(roleValue(user))
    || hasCapability(user, "records.read");
}

export function canImpersonate(user) {
  return hasCapability(user, "session.impersonate");
}

export function canActivateBreakGlass(user) {
  return hasCapability(user, "session.break_glass.activate");
}

export function isImpersonating(user) {
  return Boolean(user?.impersonation?.active);
}

export function isBreakGlassActive(user) {
  if (!user?.breakGlass?.active) return false;
  const expiresAt = String(user?.breakGlass?.expiresAt || "").trim();
  if (!expiresAt) return true;
  const expiresTs = Date.parse(expiresAt);
  return Number.isFinite(expiresTs) ? expiresTs > Date.now() : false;
}

export function isEnterpriseReadonly(user) {
  return ["developer_readonly", "support_operator", "qa_operator", "security_auditor"].includes(roleValue(user))
    && !isBreakGlassActive(user);
}
