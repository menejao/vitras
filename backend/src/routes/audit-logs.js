import express from "express";
import { AUDIT_LOG_DEFAULT_LIMIT, AUDIT_LOG_MAX_LIMIT, AUDIT_LOG_RETENTION_DAYS, AUDIT_PRUNE_ENABLED } from "../config.js";
import { readDb, withDb, listAuditLogsSnapshot } from "../db.js";
import { requireManager, requireManagerOrDoctor } from "../middlewares/auth.js";
import { canonicalRole } from "../utils/helpers.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";

const PRUNE_ALLOWED_ROLES = new Set(["gestor", "security_auditor", "break_glass_admin"]);
const AUDIT_GLOBAL_ROLES = new Set(["gestor", "security_auditor", "break_glass_admin"]);

function requirePruneRole(req, res, next) {
  const role = canonicalRole(req.user?.role);
  if (!PRUNE_ALLOWED_ROLES.has(role)) {
    withDb((db) => {
      ensureDbShape(db);
      addAuditLog(db, req.user, "audit.prune_attempt_blocked", "audit_log", req.user?.teamId || "global", {
        outcome: "denied",
        userRole: role
      });
    }).catch(() => {});
    return res.status(403).json({ error: "Sem permissão para purgar logs de auditoria" });
  }
  return next();
}

const router = express.Router();

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function matchesPatientScope(log, patientId) {
  if (!patientId) return true;
  if (log.entity === "patient" && log.entityId === patientId) return true;
  if (log.details && log.details.patientId === patientId) return true;
  if (log.after && log.after.patientId === patientId) return true;
  if (log.before && log.before.patientId === patientId) return true;
  return false;
}

function matchesAuditFilters(log, filters) {
  if (!matchesPatientScope(log, filters.patientId)) return false;
  if (filters.category && String(log.category || "") !== filters.category) return false;
  if (filters.severity && String(log.severity || "") !== filters.severity) return false;
  if (filters.action && String(log.action || "") !== filters.action) return false;
  if (filters.entity && String(log.entity || "") !== filters.entity) return false;
  if (filters.outcome && String(log.outcome || "") !== filters.outcome) return false;
  if (filters.teamId && String(log.teamId || "") !== filters.teamId) return false;
  if (filters.from && String(log.createdAt || "") < filters.from) return false;
  if (filters.to && String(log.createdAt || "") > filters.to) return false;
  if (filters.cursor && String(log.createdAt || "") >= filters.cursor) return false;
  return true;
}

router.get("/audit-logs", requireManagerOrDoctor, async (req, res) => {
  const userRole = canonicalRole(req.user?.role);
  const canReadAllAuditTeams = AUDIT_GLOBAL_ROLES.has(userRole);
  const userTeamId = String(req.user?.teamId || "").trim();
  const requestedTeamId = req.query.teamId ? String(req.query.teamId).trim() : "";

  if (!canReadAllAuditTeams && requestedTeamId && requestedTeamId !== userTeamId) {
    await withDb((auditDb) => {
      ensureDbShape(auditDb);
      addAuditLog(auditDb, req.user, "audit.cross_tenant_blocked", "audit_log", req.user?.teamId || "global", {
        outcome: "denied",
        requestedTeamId,
        userRole
      });
    });
    return res.status(403).json({ error: "Sem permissão para ler audit logs de outro team" });
  }

  const effectiveTeamId = canReadAllAuditTeams ? requestedTeamId : userTeamId;

  const filters = {
    patientId: req.query.patientId ? String(req.query.patientId) : "",
    category: req.query.category ? String(req.query.category).trim().toLowerCase() : "",
    severity: req.query.severity ? String(req.query.severity).trim().toLowerCase() : "",
    action: req.query.action ? String(req.query.action).trim() : "",
    entity: req.query.entity ? String(req.query.entity).trim() : "",
    outcome: req.query.outcome ? String(req.query.outcome).trim().toLowerCase() : "",
    teamId: effectiveTeamId,
    from: req.query.from ? String(req.query.from).trim() : "",
    to: req.query.to ? String(req.query.to).trim() : "",
    cursor: req.query.cursor ? String(req.query.cursor).trim() : ""
  };
  const limit = Math.min(parsePositiveInteger(req.query.limit, AUDIT_LOG_DEFAULT_LIMIT), AUDIT_LOG_MAX_LIMIT);
  const db = await readDb();
  ensureDbShape(db);
  const logs = await listAuditLogsSnapshot(filters);

  const items = logs.slice(0, limit);
  const nextCursor = items.length === limit ? String(items[items.length - 1]?.createdAt || "") : "";

  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, req.user, "audit.read", "audit_log", filters.patientId || req.user.teamId || "scoped", {
      outcome: "success",
      patientId: filters.patientId,
      filters: {
        category: filters.category,
        severity: filters.severity,
        action: filters.action,
        entity: filters.entity,
        outcome: filters.outcome,
        teamId: filters.teamId,
        from: filters.from,
        to: filters.to
      },
      returnedCount: items.length,
      limit
    });
  });

  return res.json({
    totalMatched: logs.length,
    limit,
    nextCursor,
    items
  });
});

router.get("/audit-logs/export", requireManagerOrDoctor, async (req, res) => {
  const exportUserRole = canonicalRole(req.user?.role);
  const canExportAllTeams = AUDIT_GLOBAL_ROLES.has(exportUserRole);
  const exportUserTeamId = String(req.user?.teamId || "").trim();
  const exportRequestedTeamId = req.query.teamId ? String(req.query.teamId).trim() : "";

  if (!canExportAllTeams && exportRequestedTeamId && exportRequestedTeamId !== exportUserTeamId) {
    await withDb((auditDb) => {
      ensureDbShape(auditDb);
      addAuditLog(auditDb, req.user, "audit.cross_tenant_blocked", "audit_log", req.user?.teamId || "global", {
        outcome: "denied",
        requestedTeamId: exportRequestedTeamId,
        userRole: exportUserRole,
        resource: "export"
      });
    });
    return res.status(403).json({ error: "Sem permissão para exportar audit logs de outro team" });
  }

  const exportEffectiveTeamId = canExportAllTeams ? exportRequestedTeamId : exportUserTeamId;
  const format = String(req.query.format || "json").trim().toLowerCase();
  const filters = {
    patientId: req.query.patientId ? String(req.query.patientId) : "",
    category: req.query.category ? String(req.query.category).trim().toLowerCase() : "",
    severity: req.query.severity ? String(req.query.severity).trim().toLowerCase() : "",
    action: req.query.action ? String(req.query.action).trim() : "",
    entity: req.query.entity ? String(req.query.entity).trim() : "",
    outcome: req.query.outcome ? String(req.query.outcome).trim().toLowerCase() : "",
    teamId: exportEffectiveTeamId,
    from: req.query.from ? String(req.query.from).trim() : "",
    to: req.query.to ? String(req.query.to).trim() : "",
    cursor: ""
  };
  const db = await readDb();
  ensureDbShape(db);
  const logs = await listAuditLogsSnapshot(filters);

  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, req.user, "audit.export", "audit_log", filters.patientId || req.user.teamId || "scoped", {
      outcome: "success",
      patientId: filters.patientId,
      format,
      returnedCount: logs.length
    });
  });

  if (format === "csv") {
    const header = "id,createdAt,action,category,severity,entity,entityId,teamId,teamName,userId,userName,userRole,outcome,requestId,ip,userAgent,prevHash,hash";
    const lines = logs.map((item) => ([
      item.id,
      item.createdAt,
      item.action,
      item.category || "",
      item.severity || "",
      item.entity,
      item.entityId,
      item.teamId || "",
      item.teamName || "",
      item.userId,
      item.userName,
      item.userRole,
      item.outcome || "",
      item.requestId || "",
      item.ip || "",
      item.userAgent || "",
      item.prevHash || "",
      item.hash || ""
    ].map((value) => `"${String(value || "").replace(/"/g, "\"\"")}"`).join(",")));
    const csv = [header, ...lines].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  }

  return res.json({
    generatedAt: new Date().toISOString(),
    total: logs.length,
    items: logs
  });
});

router.post("/audit-logs/retention/prune", requirePruneRole, async (req, res) => {
  // Gate: disabled by default — must explicitly set AUDIT_PRUNE_ENABLED=true
  if (!AUDIT_PRUNE_ENABLED) {
    return res.status(403).json({ error: "Prune está desabilitado. Configure AUDIT_PRUNE_ENABLED=true para habilitar." });
  }

  const payload = req.body || {};
  const olderThanDays = parsePositiveInteger(payload.olderThanDays, AUDIT_LOG_RETENTION_DAYS);
  const dryRun = Boolean(payload.dryRun);

  if (olderThanDays < 30) {
    return res.status(400).json({ error: "olderThanDays deve ser número >= 30" });
  }

  const cutoffIso = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)).toISOString();

  let result;
  try {
    result = await withDb((db) => {
      ensureDbShape(db);
      const candidates = db.auditLogs.filter((item) => String(item.createdAt || "") < cutoffIso);
      const sample = candidates.slice(0, 20).map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        action: item.action,
        category: item.category || "",
        severity: item.severity || ""
      }));

      if (dryRun) {
        return {
          dryRun: true,
          cutoffIso,
          candidateCount: candidates.length,
          sample
        };
      }

      // Build forensic export payload
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.id,
        pruneReason: String(req.body?.reason || "").slice(0, 300),
        olderThanDays,
        cutoffDate: cutoffIso,
        totalCandidates: candidates.length,
        chainHash: candidates[candidates.length - 1]?.hash || null,
        oldestEntry: candidates[0]
          ? { id: candidates[0].id, createdAt: candidates[0].createdAt, hash: candidates[0].hash }
          : null,
        newestEntry: candidates[candidates.length - 1]
          ? {
              id: candidates[candidates.length - 1].id,
              createdAt: candidates[candidates.length - 1].createdAt,
              hash: candidates[candidates.length - 1].hash
            }
          : null,
        entries: candidates
      };

      // Store forensic export BEFORE deletion — abort if this fails
      if (!Array.isArray(db.auditPruneExports)) db.auditPruneExports = [];
      db.auditPruneExports.push({
        id: `prune-export-${Date.now()}`,
        ...exportPayload,
        entries: candidates
      });

      // Audit: export created (metadata only — no full entries to avoid recursion)
      addAuditLog(db, req.user, "audit.prune_export_created", "audit_log", req.user?.teamId || "global", {
        outcome: "success",
        olderThanDays,
        cutoffDate: cutoffIso,
        totalCandidates: candidates.length,
        chainHash: exportPayload.chainHash
      });

      // Audit: prune started
      addAuditLog(db, req.user, "audit.prune_started", "audit_log", req.user?.teamId || "global", {
        outcome: "pending",
        olderThanDays,
        cutoffIso,
        candidateCount: candidates.length
      });

      // Perform actual deletion
      db.auditLogs = db.auditLogs.filter((item) => String(item.createdAt || "") >= cutoffIso);

      // Audit: prune completed
      addAuditLog(db, req.user, "audit.prune_completed", "audit_log", req.user?.teamId || "global", {
        outcome: "success",
        olderThanDays,
        cutoffIso,
        prunedCount: candidates.length,
        remainingCount: db.auditLogs.length
      });

      return {
        dryRun: false,
        cutoffIso,
        prunedCount: candidates.length,
        remainingCount: db.auditLogs.length
      };
    });
  } catch (err) {
    return res.status(500).json({ error: "Export de segurança falhou — prune abortado." });
  }

  return res.json(result);
});

export default router;
