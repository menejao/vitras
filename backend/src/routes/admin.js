import express from "express";
import { readDb, readDbForBackup, withDb, pool } from "../db.js";
import { BACKUP_EXPORT_KEY, ADMIN_SEED_KEY, ENABLE_ADMIN_SEED, ENABLE_BACKUP_EXPORT, IS_PROD } from "../config.js";
import { rebuildPatientHashes } from "../services/hashRebuild.js";
import {
  ensureDbShape, getProtocolTemplateMap, sanitizeUser, getTeamNameById, buildAccessContextUser,
  DEFAULT_CARE_PROTOCOLS, DEMO_POPULATE_SIZE_COMPLETE, DEMO_POPULATE_SIZE_INCOMPLETE
} from "../utils/domain.js";
import { canonicalRole, isManager, isDoctor, hasCapability } from "../utils/helpers.js";
import { buildMonthlyDemandMetric, buildDataQualityMetric } from "../utils/metrics.js";
import { getAllowedPatients, maskSensitivePatientFields } from "../utils/patients.js";
import {
  buildSeedPatient, buildSeedClinicalRecords, buildSeedAppointments,
  buildSeedMessages, buildSeedTasks, pickRandom
} from "../utils/seed.js";
import { addAuditLog } from "../services/audit.js";
import { getCouncilIntegrationConfig } from "../utils/council.js";
import { requireAuth } from "../middlewares/auth.js";
import { getMetrics } from "../middlewares/logging.js";


const router = express.Router();

function requireSensitiveAdmin(req, res, next) {
  if (!req.user || !hasCapability(req.user, "backup.export")) {
    return res.status(403).json({ error: "Acesso restrito a gestão autorizada" });
  }
  return next();
}

function buildAdminAuditActor(req) {
  return {
    ...(req.user || {}),
    id: String(req.user?.id || "system"),
    name: String(req.user?.name || "system"),
    role: canonicalRole(req.user?.role || "system"),
    teamId: String(req.user?.teamId || ""),
    requestMeta: {
      requestId: req.requestId || "",
      ip: String(req.ip || req.socket?.remoteAddress || ""),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 512),
      method: String(req.method || ""),
      path: String(req.originalUrl || req.path || ""),
      authTransport: String(req.user?.authTransport || "anonymous")
    }
  };
}

router.get("/admin/backup/export", requireAuth, requireSensitiveAdmin, async (req, res) => {
  if (!ENABLE_BACKUP_EXPORT) {
    return res.status(403).json({ error: "Exportação de backup desabilitada neste ambiente" });
  }
  const providedKey = String(req.headers["x-backup-key"] || "").trim();
  if (!BACKUP_EXPORT_KEY || providedKey !== BACKUP_EXPORT_KEY) {
    return res.status(403).json({ error: "Acesso negado para exportação de backup" });
  }

  const snapshot = await readDbForBackup();
  const generatedAt = new Date().toISOString();
  const fileName = `backup-vitras-${generatedAt.slice(0, 10)}.json`;
  await withDb((db) => {
    ensureDbShape(db);
    addAuditLog(db, buildAdminAuditActor(req), "backup.export", "backup", fileName, {
      outcome: "success",
      generatedAt,
      driver: process.env.DATABASE_URL ? "postgres" : "file"
    });
  });

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return res.json({
    generatedAt,
    driver: process.env.DATABASE_URL ? "postgres" : "file",
    encryptedSnapshot: snapshot
  });
});

router.get("/bootstrap", requireAuth, async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);

  const canReadAllUsers = hasCapability(req.user, "users.read.all");
  const patients = getAllowedPatients(db, req.user, {});
  const users = db.users
    .filter((u) => canReadAllUsers || u.teamId === req.user.teamId)
    .map((u) => sanitizeUser(u, db));
  const protocolTemplates = Object.values(getProtocolTemplateMap(db, req.user.teamId));
  const teamPatientIds = new Set(patients.map((p) => p.id));
  const tasks = db.tasks.filter((t) => teamPatientIds.has(t.patientId));
  const demandMonthly = (isManager(req.user) || isDoctor(req.user))
    ? buildMonthlyDemandMetric(db, req.user.teamId)
    : null;
  const dataQuality = (isManager(req.user) || isDoctor(req.user))
    ? buildDataQualityMetric(db, req.user.teamId)
    : null;
  await withDb((auditDb) => {
    ensureDbShape(auditDb);
    addAuditLog(auditDb, buildAdminAuditActor(req), "admin.bootstrap_read", "bootstrap", req.user.id, {
      outcome: "success",
      teamId: req.user.teamId || "",
      patientCount: patients.length,
      userCount: users.length,
      taskCount: tasks.length
    });
  });

  return res.json({
    serverTime: new Date().toISOString(),
    user: buildAccessContextUser(
      db.users.find((u) => u.id === req.user.id) || req.user,
      db,
      {
        scopeTeamId: req.user.teamId,
        impersonation: req.user.impersonation?.active ? req.user.impersonation : null,
        breakGlass: req.user.breakGlass?.active ? req.user.breakGlass : null
      }
    ),
    patients: patients.map(maskSensitivePatientFields),
    users,
    tasks,
    protocolTemplates,
    demandMonthly,
    dataQuality
  });
});

router.get("/integrations/council/status", requireAuth, async (req, res) => {
  const config = getCouncilIntegrationConfig();
  await withDb((db) => {
    ensureDbShape(db);
    addAuditLog(db, buildAdminAuditActor(req), "admin.council_status_read", "integration", "council", {
      outcome: "success",
      mode: config.mode,
      provider: config.provider,
      configured: Boolean(config.url)
    });
  });
  return res.json({
    mode: config.mode,
    provider: config.provider,
    configured: Boolean(config.url),
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    requireEvidence: config.requireEvidence
  });
});

router.post("/admin/patients/reset-populate", requireAuth, async (req, res) => {
  if (!ENABLE_ADMIN_SEED) {
    return res.status(403).json({ error: "Rotina administrativa desabilitada neste ambiente" });
  }
  if (!hasCapability(req.user, "admin.seed")) {
    return res.status(403).json({ error: "Sessão atual não pode executar esta rotina administrativa" });
  }

  const sentKey = String(req.headers["x-admin-seed-key"] || "").trim();
  if (ADMIN_SEED_KEY && sentKey !== ADMIN_SEED_KEY) {
    return res.status(401).json({ error: "Chave administrativa inválida para população da base" });
  }

  const counts = {
    complete: DEMO_POPULATE_SIZE_COMPLETE,
    incomplete: DEMO_POPULATE_SIZE_INCOMPLETE
  };

  const result = await withDb((db) => {
    ensureDbShape(db);

    const users = Array.isArray(db.users) ? db.users : [];
    const teams = Array.isArray(db.teams) ? db.teams : [];
    const teamIds = teams.map((t) => String(t.id || "").trim()).filter(Boolean);
    const acsUsers = users.filter((u) => canonicalRole(u?.role) === "acs");
    const staffUsers = users.filter((u) => ["nurse_manager", "doctor", "gestor"].includes(canonicalRole(u?.role)));
    const acsIds = acsUsers.map((u) => u.id);

    const templateMapByTeam = new Map();
    const getTemplateMap = (teamId) => {
      const key = String(teamId || "");
      if (!templateMapByTeam.has(key)) {
        templateMapByTeam.set(key, getProtocolTemplateMap(db, teamId));
      }
      return templateMapByTeam.get(key);
    };

    db.patients = [];
    db.appointments = [];
    db.tasks = [];
    db.messages = [];
    db.clinicalRecords = [];
    db.privacyRequests = [];

    const allPatients = [];
    const total = counts.complete + counts.incomplete;
    for (let i = 0; i < total; i += 1) {
      allPatients.push(buildSeedPatient({
        index: i,
        teamIds: teamIds.length ? teamIds : [req.user.teamId],
        acsIds,
        incomplete: i >= counts.complete
      }));
    }

    allPatients.forEach((patient, index) => {
      patient.cnsCpf = patient.cpf || patient.cns || "";
      db.patients.push(patient);

      const bucket = index < 20 ? "ok" : (index < 45 ? "progress" : "critical");
      const protocolMap = getTemplateMap(patient.teamId || req.user.teamId);
      const template = protocolMap[patient.careCategory] || DEFAULT_CARE_PROTOCOLS[patient.careCategory] || DEFAULT_CARE_PROTOCOLS.general;

      const records = buildSeedClinicalRecords(patient, template, bucket, staffUsers);
      db.clinicalRecords.push(...records);
      db.appointments.push(...buildSeedAppointments(patient, pickRandom(staffUsers)?.id || req.user.id));
      db.messages.push(...buildSeedMessages(patient, staffUsers));
      db.tasks.push(...buildSeedTasks(patient, acsIds, pickRandom(staffUsers)?.id || req.user.id));
    });

    const removedCount = allPatients.length;
    addAuditLog(db, req.user, "admin.patients.reset_populate", "patient", "bulk", {
      totalPatients: db.patients.length,
      completePatients: counts.complete,
      incompletePatients: counts.incomplete,
      clinicalRecords: db.clinicalRecords.length,
      appointments: db.appointments.length,
      tasks: db.tasks.length,
      messages: db.messages.length,
      note: `Substituição completa de base clínica anterior por ${removedCount} pacientes demo`
    });

    return {
      totalPatients: db.patients.length,
      completePatients: counts.complete,
      incompletePatients: counts.incomplete,
      clinicalRecords: db.clinicalRecords.length,
      appointments: db.appointments.length,
      tasks: db.tasks.length,
      messages: db.messages.length
    };
  });

  return res.json({ ok: true, ...result });
});

router.get("/metrics/internal", requireAuth, async (req, res) => {
  if (!hasCapability(req.user, "metrics.internal.read")) {
    return res.status(403).json({ error: "Acesso restrito a gestores" });
  }
  await withDb((db) => {
    ensureDbShape(db);
    addAuditLog(db, buildAdminAuditActor(req), "admin.metrics_read", "metrics", req.user.teamId || "global", {
      outcome: "success",
      teamId: req.user.teamId || ""
    });
  });
  return res.json(getMetrics());
});

// F-07: POST /admin/rebuild-patient-hashes
// Rebuilds cpf_hash/cns_hash for all active patients using the current PATIENT_LOOKUP_HASH_KEY.
// Required after key rotation to restore uniqueness enforcement integrity.
// Protected by: requireAuth + backup.export capability + x-backup-key header (same as backup export).
// IS_PROD guard: only runs in production where Postgres hashes are used; dev/file-mode is a no-op.
router.post("/admin/rebuild-patient-hashes", requireAuth, requireSensitiveAdmin, async (req, res) => {
  // Double-check key header using same pattern as /admin/backup/export
  const providedKey = String(req.headers["x-backup-key"] || "").trim();
  if (!BACKUP_EXPORT_KEY || providedKey !== BACKUP_EXPORT_KEY) {
    return res.status(403).json({ error: "Acesso negado — chave administrativa inválida" });
  }

  // Only meaningful in Postgres mode; in file mode hashes are recomputed on every syncShadowTables
  if (!pool) {
    return res.status(400).json({
      error: "Rebuild de hashes não aplicável em modo arquivo — hashes são recalculados automaticamente"
    });
  }

  const dryRun = String(req.query.dryRun || req.body?.dryRun || "false").toLowerCase() === "true";

  try {
    const db = await readDb();
    const result = await rebuildPatientHashes(pool, db, { dryRun });

    await withDb((auditDb) => {
      ensureDbShape(auditDb);
      addAuditLog(auditDb, buildAdminAuditActor(req), "admin.hash_rebuild", "system", "patient_hashes", {
        outcome: "success",
        ...result
      });
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err.code === "REBUILD_IN_PROGRESS") {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

export default router;
