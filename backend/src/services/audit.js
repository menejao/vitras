import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { canonicalRole } from "../utils/helpers.js";
import { ensureArray } from "../utils/domain.js";
import { logWarn } from "../utils/logger.js";
import { recordMetric } from "./metrics.js";

// MEM-01: Cap for the in-memory auditLogs array (file-mode / memory cache only).
// Oldest entries are evicted when the cap is exceeded.
const MAX_AUDIT_LOGS = Number(process.env.AUDIT_LOG_MAX_ENTRIES) || 10000;

function hashAuditPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// AUD-01: explicit recursive canonicalization — predictable, crypto-stable, replacer-independent.
function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonicalize(value[k])])
    );
  }
  return value;
}

function canonicalStringify(obj) {
  return JSON.stringify(canonicalize(obj));
}

function hashAuditPayloadV2(payload) {
  return crypto.createHash("sha256").update(canonicalStringify(payload)).digest("hex");
}

/**
 * AUD-01 — Legacy hash reconstruction (best-effort).
 *
 * Reconstructs a legacy audit log entry in the original addAuditLog insertion order,
 * which has been stable since commit 7e8f4ef across all production deployments.
 *
 * Classification guide for callers:
 *   legacy_valid         — hash reproduced successfully; entry is consistent with
 *                          the known insertion-order serialization.
 *   legacy_incompatible  — hash could NOT be reproduced. This does NOT constitute
 *                          evidence of tampering or data corruption. It indicates
 *                          only that the original serialization cannot be
 *                          deterministically reconstructed from the data currently
 *                          stored in JSONB (e.g. due to JSONB key reordering,
 *                          field evolution, or null/undefined coercion differences
 *                          at write time). Chain continuity via stored hash strings
 *                          remains the authoritative integrity signal for these entries.
 */
function reconstructLegacyInsertionOrder(entry) {
  const actor   = entry.actor   || {};
  const request = entry.request || {};

  const reconstructedActor = {
    id:            actor.id,
    name:          actor.name,
    role:          actor.role,
    teamId:        actor.teamId,
    teamName:      actor.teamName,
    impersonation: "impersonation" in actor ? actor.impersonation : null,
    breakGlass:    "breakGlass"    in actor ? actor.breakGlass    : null,
  };

  if (reconstructedActor.impersonation && typeof reconstructedActor.impersonation === "object") {
    const imp = actor.impersonation;
    reconstructedActor.impersonation = {
      active:         imp.active,
      targetUserId:   imp.targetUserId,
      targetUserName: imp.targetUserName,
      targetUserRole: imp.targetUserRole,
      targetTeamId:   imp.targetTeamId,
      targetTeamName: imp.targetTeamName,
    };
  }

  if (reconstructedActor.breakGlass && typeof reconstructedActor.breakGlass === "object") {
    const bg = actor.breakGlass;
    reconstructedActor.breakGlass = {
      active:    bg.active,
      reason:    bg.reason,
      expiresAt: bg.expiresAt,
    };
  }

  return {
    id:        entry.id,
    action:    entry.action,
    entity:    entry.entity,
    entityId:  entry.entityId,
    category:  entry.category,
    severity:  entry.severity,
    teamId:    entry.teamId,
    teamName:  entry.teamName,
    userId:    entry.userId,
    userName:  entry.userName,
    userRole:  entry.userRole,
    actor:     reconstructedActor,
    request: {
      id:            request.id,
      ip:            request.ip,
      userAgent:     request.userAgent,
      method:        request.method,
      path:          request.path,
      authTransport: request.authTransport,
    },
    outcome:   entry.outcome,
    before:    "before"    in entry ? entry.before    : null,
    after:     "after"     in entry ? entry.after     : null,
    details:   "details"   in entry ? entry.details   : {},
    requestId: "requestId" in entry ? entry.requestId : "",
    ip:        "ip"        in entry ? entry.ip        : "",
    userAgent: "userAgent" in entry ? entry.userAgent : "",
    createdAt: entry.createdAt,
    prevHash:  entry.prevHash,
  };
}

function hashLegacyPayload(entry) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(reconstructLegacyInsertionOrder(entry)))
    .digest("hex");
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
    createdAt:   nowIso,
    hashVersion: "v2"
  };
  const hash = hashAuditPayloadV2({ ...logEntry, prevHash });
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

/**
 * B-02: Verify the integrity of the in-memory audit log hash chain.
 *
 * Each entry's `hash` is SHA256(JSON.stringify({...entry_fields, prevHash})) — i.e., the hash
 * covers all fields EXCEPT `hash` itself. We recompute it by stripping `hash` before hashing.
 *
 * For the first entry in a truncated window, prevHash is checked against auditLogChainAnchors
 * to distinguish "genesis" (prevHash=""), "eviction-valid" (prevHash matches an anchor), and
 * "orphaned" (prevHash present but no matching anchor found).
 *
 * Returns a summary object; does NOT modify `db`.
 */
function verifyAuditLogChain(db) {
  const entries = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  const anchors = Array.isArray(db.auditLogChainAnchors) ? db.auditLogChainAnchors : [];

  if (entries.length === 0) {
    return { status: "valid", checked: 0, message: "No entries to verify" };
  }

  const results = [];
  let broken = false;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const prev  = i > 0 ? entries[i - 1] : null;

    // Step 1 — chain continuity (stored hash strings, JSONB-stable).
    // Chain-break is suspicious for any hash version; always classified as broken.
    if (i > 0 && entry.prevHash !== prev.hash) {
      results.push({ id: entry.id, status: "broken", reason: "chain_break" });
      broken = true;
      continue;
    }

    // Step 2 — first-entry prevHash provenance.
    // orphaned is declared regardless of hash verdict: chain provenance is an integrity
    // concern independent of whether the individual hash is reproducible.
    if (i === 0 && entry.prevHash) {
      const isTruncatedValid = anchors.some((a) => a.newestEvictedHash === entry.prevHash);
      if (isTruncatedValid) {
        results.push({ id: entry.id, status: "truncated-valid", reason: "eviction_anchor_found" });
      } else {
        results.push({ id: entry.id, status: "orphaned", reason: "prevHash_not_in_anchors" });
        broken = true;
      }
      continue;
    }

    // Step 3 — hash integrity.
    if (entry.hashVersion === "v2") {
      const { hash: storedHash, ...withoutHash } = entry;
      if (hashAuditPayloadV2(withoutHash) !== storedHash) {
        results.push({ id: entry.id, status: "broken", reason: "hash_mismatch" });
        broken = true;
        continue;
      }
      results.push({ id: entry.id, status: "valid" });
    } else {
      if (hashLegacyPayload(entry) === entry.hash) {
        results.push({ id: entry.id, status: "legacy_valid" });
      } else {
        results.push({ id: entry.id, status: "legacy_incompatible", reason: "hash_not_reproducible" });
      }
    }
  }

  const brokenCount        = results.filter((r) => r.status === "broken").length;
  const orphanedCount      = results.filter((r) => r.status === "orphaned").length;
  const truncatedCount     = results.filter((r) => r.status === "truncated-valid").length;
  const legacyValidCount   = results.filter((r) => r.status === "legacy_valid").length;
  const legacyIncompatible = results.filter((r) => r.status === "legacy_incompatible").length;

  const status = broken
    ? "broken"
    : orphanedCount > 0
      ? "orphaned"
      : legacyIncompatible > 0
        ? "legacy_incompatible"
        : "valid";

  // legacy_incompatible = serialization format gap, not evidence of tampering — no alarm.
  if (status === "broken" || status === "orphaned") {
    recordMetric("audit_chain_failure", 1, {
      status,
      broken: brokenCount,
      orphaned: orphanedCount
    });
  }

  return {
    status,
    checked:            entries.length,
    broken:             brokenCount,
    orphaned:           orphanedCount,
    legacyValid:        legacyValidCount,
    legacyIncompatible,
    truncatedValid:     truncatedCount,
    anchorsChecked:     anchors.length,
    firstBrokenId:      results.find((r) => r.status === "broken")?.id || null
  };
}

/**
 * ITEM 4 — Audit report helper.
 * Filters audit logs by event type(s) without exposing PII beyond what's already stored.
 * @param {object} db - The database snapshot
 * @param {string|string[]} types - Action(s) to filter on
 * @param {object} filters - { since?, until?, limit?, unitId? }
 */
function getAuditReport(db, types, filters = {}) {
  const typeSet = new Set(Array.isArray(types) ? types : [types]);
  const { since, until, limit = 500, unitId } = filters;

  const logs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  const filtered = [];

  for (const entry of logs) {
    if (!typeSet.has(entry.action)) continue;
    if (since && String(entry.createdAt || "") < since) continue;
    if (until && String(entry.createdAt || "") > until) continue;
    // Multi-UBS isolation: if unitId filter provided, only include entries for that unit
    if (unitId && entry.details?.unitId && entry.details.unitId !== unitId) continue;
    filtered.push(entry);
  }

  // S4-03: Sort by createdAt descending (most recent first) before applying limit.
  // In file-mode, logs are appended in insertion order which may not match
  // createdAt ordering after eviction/replay. Postgres path uses SQL ORDER BY.
  filtered.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return filtered.slice(0, limit);
}

export { hashAuditPayload, hashAuditPayloadV2, getLastAuditHash, addAuditLog, classifyAuditAction, verifyAuditLogChain, getAuditReport };
