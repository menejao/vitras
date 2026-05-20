import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";
import { addAuditLog } from "../src/services/audit.js";
import { canonicalRole } from "../src/utils/helpers.js";

const guard = String(process.env.ALLOW_ENTERPRISE_REMOTE_PROVISIONING || "").trim().toLowerCase();
if (guard !== "true") {
  throw new Error("Defina ALLOW_ENTERPRISE_REMOTE_PROVISIONING=true para executar este script.");
}

const email = String(process.env.PROVISION_USER_EMAIL || "").trim().toLowerCase();
const password = String(process.env.PROVISION_USER_PASSWORD || "").trim();
const name = String(process.env.PROVISION_USER_NAME || "").trim();
const role = canonicalRole(process.env.PROVISION_USER_ROLE || "support_operator");
const teamId = String(process.env.PROVISION_USER_TEAM_ID || "").trim();
const reason = String(process.env.PROVISION_REASON || "").trim();

if (!email || !password || !name || !reason) {
  throw new Error("PROVISION_USER_EMAIL, PROVISION_USER_PASSWORD, PROVISION_USER_NAME e PROVISION_REASON são obrigatórios.");
}

const allowedRoles = new Set([
  "developer_readonly",
  "support_operator",
  "qa_operator",
  "security_auditor",
  "break_glass_admin"
]);

if (!allowedRoles.has(role)) {
  throw new Error(`Role não permitida para provisionamento enterprise: ${role}`);
}

if (role !== "break_glass_admin" && !teamId) {
  throw new Error("PROVISION_USER_TEAM_ID obrigatório para roles enterprise não-globais.");
}

const now = new Date().toISOString();

const result = await withDb((db) => {
  ensureDbShape(db);
  const index = db.users.findIndex((user) => String(user.email || "").trim().toLowerCase() === email);
  const existing = index >= 0 ? db.users[index] : null;

  const next = {
    ...(existing || {}),
    id: existing?.id || `enterprise-${Date.now()}`,
    name,
    role,
    email,
    password: hashPassword(password),
    teamId: role === "break_glass_admin" ? String(teamId || existing?.teamId || "") : teamId,
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: Boolean(existing?.twoFactorEnabled || false),
    twoFactorSecret: existing?.twoFactorSecret || "",
    twoFactorPendingSecret: existing?.twoFactorPendingSecret || "",
    twoFactorPendingCreatedAt: existing?.twoFactorPendingCreatedAt || "",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastLoginAt: existing?.lastLoginAt || "",
    lastSeenAt: existing?.lastSeenAt || "",
    lastSeenIp: existing?.lastSeenIp || ""
  };

  if (index >= 0) db.users[index] = next;
  else db.users.push(next);

  addAuditLog(
    db,
    { id: "enterprise-provision", name: "Provisionamento Enterprise", role: "break_glass_admin", requestId: "remote-enterprise-provision" },
    "user.enterprise_provisioned",
    "user",
    next.id,
    {
      email: next.email,
      role: next.role,
      teamId: next.teamId,
      mode: index >= 0 ? "updated" : "created",
      reason
    }
  );

  return {
    mode: index >= 0 ? "updated" : "created",
    email: next.email,
    role: next.role,
    teamId: next.teamId
  };
});

console.log(JSON.stringify({ ok: true, ...result }, null, 2));
