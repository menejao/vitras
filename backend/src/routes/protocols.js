import express from "express";
import { readDb, withDb } from "../db.js";
import { requireManagerOrDoctor } from "../middlewares/auth.js";
import {
  ensureDbShape, getProtocolTemplateMap, sanitizeProtocolTemplatePayload,
  snapshotProtocolTemplateVersion
} from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

function buildProtocolTemplateAuditSnapshot(template) {
  if (!template) return null;
  return {
    category: String(template.category || ""),
    teamId: String(template.teamId || ""),
    label: String(template.label || ""),
    deleted: Boolean(template.deleted),
    targets: template.targets || {},
    deadlines: template.deadlines || {},
    vaccines: Array.isArray(template.vaccines) ? [...template.vaccines] : []
  };
}

async function logProtocolRead(req, action, entityId, details = {}) {
  await withDb((db) => {
    ensureDbShape(db);
    addAuditLog(db, req.user, action, "protocol_template", entityId, {
      outcome: "success",
      teamId: req.user.teamId || "",
      ...details
    });
  });
}

router.get("/protocol/templates", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const items = Object.values(getProtocolTemplateMap(db, req.user.teamId));
  await logProtocolRead(req, "protocol_template.list_read", req.user.teamId || "team", {
    returnedCount: items.length
  });
  res.json(items);
});

router.get("/protocol/templates/:category/usage", requireManagerOrDoctor, async (req, res) => {
  const category = String(req.params.category || "").trim();
  const db = await readDb();
  ensureDbShape(db);
  const teamDeleted = db.protocolTemplates.some((t) => t.category === category && t.teamId === req.user.teamId && t.deleted);
  const template = getProtocolTemplateMap(db, req.user.teamId)[category];
  if (!template) return res.status(404).json({ error: "Categoria de protocolo não encontrada" });

  const patientCount = db.patients.filter(
    (p) => p.teamId === req.user.teamId && p.careCategory === category
  ).length;

  const recordsCount = db.clinicalRecords.filter((r) => {
    if (String(r.protocolTag || "") !== category) return false;
    const patient = db.patients.find((p) => p.id === r.patientId);
    return patient?.teamId === req.user.teamId;
  }).length;
  await logProtocolRead(req, "protocol_template.usage_read", category, {
    patientCount,
    recordsCount,
    teamDeleted
  });

  return res.json({
    category,
    patientCount,
    recordsCount,
    canDelete: !teamDeleted && category !== "general" && patientCount === 0 && recordsCount === 0
  });
});

router.get("/protocol/templates/:category/history", requireManagerOrDoctor, async (req, res) => {
  const category = String(req.params.category || "").trim();
  const db = await readDb();
  ensureDbShape(db);
  const items = db.protocolTemplateVersions
    .filter((entry) => String(entry.category || "") === category)
    .filter((entry) => !entry.teamId || entry.teamId === req.user.teamId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 25);
  await logProtocolRead(req, "protocol_template.history_read", category, {
    returnedCount: items.length
  });
  return res.json({ items });
});

router.post("/protocol/templates", requireManagerOrDoctor, async (req, res) => {
  const payloadCheck = sanitizeProtocolTemplatePayload(req.body || {});
  if (!payloadCheck.ok) return res.status(400).json({ error: payloadCheck.error });

  const result = await withDb((db) => {
    ensureDbShape(db);
    const exists = db.protocolTemplates.some((t) => t.category === payloadCheck.template.category && t.teamId === req.user.teamId && !t.deleted);
    if (exists) return { error: "Categoria já existe" };
    const deletedIndex = db.protocolTemplates.findIndex((t) => t.category === payloadCheck.template.category && t.teamId === req.user.teamId && t.deleted);
    if (deletedIndex >= 0) db.protocolTemplates.splice(deletedIndex, 1);
    const created = {
      ...payloadCheck.template,
      teamId: req.user.teamId
    };
    db.protocolTemplates.push(created);
    snapshotProtocolTemplateVersion(db, req.user, "created", created);
    addAuditLog(db, req.user, "protocol_template.created", "protocol_template", created.category, {
      label: created.label,
      after: buildProtocolTemplateAuditSnapshot(created)
    });
    return created;
  });

  if (result.error) return res.status(409).json({ error: result.error });
  return res.status(201).json(result);
});

router.put("/protocol/templates/:category", requireManagerOrDoctor, async (req, res) => {
  const category = String(req.params.category || "").trim();
  const payloadCheck = sanitizeProtocolTemplatePayload(req.body || {}, category);
  if (!payloadCheck.ok) return res.status(400).json({ error: payloadCheck.error });

  const result = await withDb((db) => {
    ensureDbShape(db);
    const deletedIndex = db.protocolTemplates.findIndex((t) => t.category === category && t.teamId === req.user.teamId && t.deleted);
    if (deletedIndex >= 0) db.protocolTemplates.splice(deletedIndex, 1);
    const index = db.protocolTemplates.findIndex((t) => t.category === category && t.teamId === req.user.teamId && !t.deleted);
    if (index >= 0) {
      const current = db.protocolTemplates[index];
      const before = buildProtocolTemplateAuditSnapshot(current);
      snapshotProtocolTemplateVersion(db, req.user, "before_update", current);
      const next = {
        ...current,
        ...payloadCheck.template,
        category,
        teamId: req.user.teamId
      };
      db.protocolTemplates[index] = next;
      snapshotProtocolTemplateVersion(db, req.user, "updated", next);
      addAuditLog(db, req.user, "protocol_template.updated", "protocol_template", category, {
        changedFields: Object.keys(req.body || {}),
        before,
        after: buildProtocolTemplateAuditSnapshot(next)
      });
      return next;
    }

    const globalTemplate = db.protocolTemplates.find((t) => t.category === category && !t.teamId && !t.deleted);
    if (!globalTemplate) return null;

    const createdOverride = {
      ...globalTemplate,
      ...payloadCheck.template,
      category,
      teamId: req.user.teamId
    };
    db.protocolTemplates.push(createdOverride);
    snapshotProtocolTemplateVersion(db, req.user, "override_created", createdOverride);
    addAuditLog(db, req.user, "protocol_template.override_created", "protocol_template", category, {
      changedFields: Object.keys(req.body || {}),
      after: buildProtocolTemplateAuditSnapshot(createdOverride)
    });
    return createdOverride;
  });

  if (!result) return res.status(404).json({ error: "Categoria de protocolo não encontrada" });
  return res.json(result);
});

router.delete("/protocol/templates/:category", requireManagerOrDoctor, async (req, res) => {
  const category = String(req.params.category || "").trim();
  const reason = String(req.body?.reason || "").trim();
  if (category === "general") {
    return res.status(400).json({ error: "A categoria geral não pode ser excluída" });
  }
  if (reason.length < 8) {
    return res.status(400).json({ error: "Justificativa obrigatória para excluir protocolo" });
  }

  const result = await withDb((db) => {
    ensureDbShape(db);
    const teamIndex = db.protocolTemplates.findIndex((t) => t.category === category && t.teamId === req.user.teamId && !t.deleted);
    const globalTemplate = db.protocolTemplates.find((t) => t.category === category && !t.teamId && !t.deleted);
    if (teamIndex < 0 && !globalTemplate) return { error: { status: 404, message: "Categoria de protocolo não encontrada" } };

    const patientCount = db.patients.filter(
      (p) => p.teamId === req.user.teamId && p.careCategory === category
    ).length;

    const recordsCount = db.clinicalRecords.filter((r) => {
      if (String(r.protocolTag || "") !== category) return false;
      const patient = db.patients.find((p) => p.id === r.patientId);
      return patient?.teamId === req.user.teamId;
    }).length;

    if (patientCount > 0 || recordsCount > 0) {
      return {
        error: {
          status: 409,
          message: "Categoria em uso. Realoque pacientes/registros antes de excluir.",
          details: { patientCount, recordsCount }
        }
      };
    }

    if (teamIndex >= 0) {
      const before = buildProtocolTemplateAuditSnapshot(db.protocolTemplates[teamIndex]);
      snapshotProtocolTemplateVersion(db, req.user, "deleted", db.protocolTemplates[teamIndex]);
      db.protocolTemplates.splice(teamIndex, 1);
      addAuditLog(db, req.user, "protocol_template.deleted", "protocol_template", category, {
        mode: "team_override_removed",
        before,
        after: null,
        reason
      });
    } else {
      const existingTombstone = db.protocolTemplates.find((t) => t.category === category && t.teamId === req.user.teamId && t.deleted);
      if (!existingTombstone) {
        const tombstone = {
          category,
          label: String(globalTemplate?.label || category),
          teamId: req.user.teamId,
          deleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: req.user.id
        };
        db.protocolTemplates.push(tombstone);
        snapshotProtocolTemplateVersion(db, req.user, "team_tombstone_created", tombstone);
      }
      addAuditLog(db, req.user, "protocol_template.deleted", "protocol_template", category, {
        mode: "team_tombstone_on_global",
        after: {
          category,
          teamId: req.user.teamId,
          deleted: true
        },
        reason
      });
    }
    return { ok: true };
  });

  if (result.error) return res.status(result.error.status).json({ error: result.error.message, details: result.error.details || {} });
  return res.json({ ok: true });
});

export default router;
