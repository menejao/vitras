import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { canonicalRole } from "../utils/helpers.js";
import { ensureArray } from "../utils/domain.js";

function hashAuditPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function getLastAuditHash(db) {
  const list = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  if (!list.length) return "";
  const last = list[list.length - 1];
  return String(last?.hash || "");
}

function sanitizeAuditDetails(details = {}) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  const next = { ...details };
  delete next.before;
  delete next.after;
  delete next.outcome;
  return next;
}

function classifyAuditAction(action = "") {
  const normalized = String(action || "").trim().toLowerCase();
  if (!normalized) return { category: "general", severity: "info" };
  if (normalized.startsWith("privacy.")) return { category: "privacy", severity: "high" };
  if (normalized.startsWith("auth.")) {
    return {
      category: "auth",
      severity: normalized.includes("failed") || normalized.includes("denied") ? "medium" : "info"
    };
  }
  if (normalized.startsWith("audit.")) {
    return {
      category: normalized.includes("export") ? "export" : "audit",
      severity: normalized.includes("export") ? "high" : "medium"
    };
  }
  if (normalized.endsWith(".read")) return { category: "read", severity: "info" };
  if (normalized.includes("export")) return { category: "export", severity: "high" };
  if (
    normalized.includes(".created")
    || normalized.includes(".updated")
    || normalized.includes(".deleted")
    || normalized.includes(".executed")
    || normalized.includes(".enabled")
    || normalized.includes(".disabled")
  ) {
    return { category: "write", severity: "medium" };
  }
  return { category: "general", severity: "info" };
}

function addAuditLog(db, user, action, entity, entityId, details = {}) {
  ensureArray(db, "auditLogs");
  const nowIso = new Date().toISOString();
  const prevHash = getLastAuditHash(db);
  const requestMeta = user?.requestMeta && typeof user.requestMeta === "object" ? user.requestMeta : {};
  const teamId = String(user?.teamId || details?.teamId || "").trim();
  const teamName = String(user?.teamName || details?.teamName || "").trim();
  const classification = classifyAuditAction(action);
  const logEntry = {
    id: uuidv4(),
    action,
    entity,
    entityId,
    category: classification.category,
    severity: classification.severity,
    teamId,
    teamName,
    userId: user.id,
    userName: user.name,
    userRole: canonicalRole(user.role),
    actor: {
      id: String(user?.id || ""),
      name: String(user?.name || ""),
      role: canonicalRole(user?.role),
      teamId,
      teamName,
      impersonation: user?.impersonation?.active ? {
        active: true,
        targetUserId: String(user.impersonation.targetUserId || ""),
        targetUserName: String(user.impersonation.targetUserName || ""),
        targetUserRole: String(user.impersonation.targetUserRole || ""),
        targetTeamId: String(user.impersonation.targetTeamId || ""),
        targetTeamName: String(user.impersonation.targetTeamName || "")
      } : null,
      breakGlass: user?.breakGlass?.active ? {
        active: true,
        reason: String(user.breakGlass.reason || ""),
        expiresAt: String(user.breakGlass.expiresAt || "")
      } : null
    },
    request: {
      id: String(requestMeta.requestId || user?.requestId || ""),
      ip: String(requestMeta.ip || ""),
      userAgent: String(requestMeta.userAgent || ""),
      method: String(requestMeta.method || ""),
      path: String(requestMeta.path || ""),
      authTransport: String(requestMeta.authTransport || user?.authTransport || "")
    },
    outcome: String(details?.outcome || "success"),
    before: details?.before ?? null,
    after: details?.after ?? null,
    details: sanitizeAuditDetails(details),
    requestId: user?.requestId || "",
    ip: String(requestMeta.ip || ""),
    userAgent: String(requestMeta.userAgent || ""),
    createdAt: nowIso
  };
  const hash = hashAuditPayload({ ...logEntry, prevHash });
  db.auditLogs.push({ ...logEntry, prevHash, hash });
}

export { hashAuditPayload, getLastAuditHash, addAuditLog, classifyAuditAction };
