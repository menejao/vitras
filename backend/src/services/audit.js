import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { canonicalRole } from "../utils/helpers.js";
import { ensureArray } from "../utils/domain.js";
import { logWarn } from "../utils/logger.js";

// MEM-01: Cap for the in-memory auditLogs array (file-mode / memory cache only).
// Oldest entries are evicted when the cap is exceeded.
const MAX_AUDIT_LOGS = Number(process.env.AUDIT_LOG_MAX_ENTRIES) || 10000;

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

  // MEM-01: Evict oldest entries when the in-memory cap is exceeded.
  // This applies only to the in-memory array (file-mode / cache); Postgres
  // writes are unaffected.
  if (db.auditLogs.length > MAX_AUDIT_LOGS) {
    const excess = db.auditLogs.length - MAX_AUDIT_LOGS;

    // Capture anchor data BEFORE splice so forensic tools can verify the eviction
    // was legitimate (not tampered deletion). Stored in a separate array to avoid
    // recursive push → truncation → anchor → push loop.
    const evictedEntries = db.auditLogs.slice(0, excess);
    const oldestEvictedHash = evictedEntries[0]?.hash || null;
    const newestEvictedHash = evictedEntries[evictedEntries.length - 1]?.hash || null;
    const remainingFirstEntry = db.auditLogs[excess]; // will be index 0 after splice
    const remainingFirstHash = remainingFirstEntry?.hash || null;
    const remainingFirstPrevHash = remainingFirstEntry?.prevHash || null;

    db.auditLogs.splice(0, excess);

    // MEM-01: Store anchor in db.auditLogChainAnchors (separate from auditLogs to
    // avoid recursion). In Postgres mode, withDb serializes `db` into app_state JSONB
    // so anchors are persisted there — no explicit DB writes needed.
    if (!Array.isArray(db.auditLogChainAnchors)) db.auditLogChainAnchors = [];
    db.auditLogChainAnchors.push({
      event: "audit_log_eviction_anchor",
      truncatedAt: new Date().toISOString(),
      evictedCount: excess,
      oldestEvictedHash,
      newestEvictedHash,
      remainingFirstHash,
      remainingFirstPrevHash
    });

    logWarn("audit_log_truncated", {
      event: "audit_log_truncated",
      removed: excess,
      retained: MAX_AUDIT_LOGS,
      oldestEvictedHash,
      newestEvictedHash,
      remainingFirstPrevHash
    });
  }
}

export { hashAuditPayload, getLastAuditHash, addAuditLog, classifyAuditAction };
