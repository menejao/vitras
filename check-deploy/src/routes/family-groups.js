import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";
import { isManager, canonicalRole } from "../utils/helpers.js";

const router = express.Router();

function canManageGroups(user) {
  const role = canonicalRole(user?.role);
  return isManager(user) || role === "break_glass_admin" || role === "doctor";
}

function groupVisibleToUser(group, user) {
  const role = canonicalRole(user?.role);
  if (canManageGroups(user)) return group.teamId === user.teamId;
  if (role === "acs") return group.teamId === user.teamId && group.assignedAcsId === user.id;
  return group.teamId === user.teamId;
}

router.get("/family-groups", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const q = String(req.query.q || "").toLowerCase().trim();
  let groups = db.familyGroups.filter((g) => groupVisibleToUser(g, req.user));
  if (q) {
    groups = groups.filter((g) =>
      (g.address || "").toLowerCase().includes(q) ||
      (g.microArea || "").toLowerCase().includes(q)
    );
  }
  return res.json(groups);
});

router.patch("/family-groups/:id/members", async (req, res) => {
  if (!canManageGroups(req.user)) {
    return res.status(403).json({ error: "Sem permissão para editar grupos familiares" });
  }

  const { id } = req.params;
  const { memberPatientIds } = req.body;
  if (!Array.isArray(memberPatientIds)) {
    return res.status(400).json({ error: "memberPatientIds deve ser um array" });
  }

  const updated = await withDb((db) => {
    ensureDbShape(db);
    const idx = db.familyGroups.findIndex((g) => g.id === id && g.teamId === req.user.teamId);
    if (idx < 0) return null;
    db.familyGroups[idx] = {
      ...db.familyGroups[idx],
      memberPatientIds: memberPatientIds.map(String),
      updatedAt: new Date().toISOString(),
    };
    addAuditLog(db, req.user, "familyGroup.membersUpdated", "familyGroup", id, {
      memberPatientIds,
    });
    return db.familyGroups[idx];
  });

  if (!updated) return res.status(404).json({ error: "Grupo familiar não encontrado" });
  return res.json(updated);
});

router.patch("/family-groups/:id/transfer", async (req, res) => {
  if (!canManageGroups(req.user)) {
    return res.status(403).json({ error: "Sem permissão para transferir grupos familiares" });
  }

  const { id } = req.params;
  const { toAcsId, justification } = req.body;

  if (!toAcsId || !justification || String(justification).trim().length < 10) {
    return res.status(400).json({ error: "toAcsId e justification (mín. 10 caracteres) são obrigatórios" });
  }

  const db = await readDb();
  ensureDbShape(db);

  const group = db.familyGroups.find((g) => g.id === id && g.teamId === req.user.teamId);
  if (!group) return res.status(404).json({ error: "Grupo familiar não encontrado" });

  const toAcs = db.users.find((u) => u.id === String(toAcsId));
  if (!toAcs || canonicalRole(toAcs.role) !== "acs" || toAcs.teamId !== req.user.teamId) {
    return res.status(400).json({ error: "ACS destino não encontrado na equipe" });
  }

  const fromAcsId = group.assignedAcsId;
  const transferredAt = new Date().toISOString();

  const updated = await withDb((mutableDb) => {
    ensureDbShape(mutableDb);
    const idx = mutableDb.familyGroups.findIndex((g) => g.id === id);
    if (idx < 0) return null;
    const entry = {
      fromAcsId,
      toAcsId: String(toAcsId),
      justification: String(justification).trim(),
      transferredBy: req.user.id,
      transferredAt,
    };
    mutableDb.familyGroups[idx] = {
      ...mutableDb.familyGroups[idx],
      assignedAcsId: String(toAcsId),
      updatedAt: transferredAt,
      transferHistory: [...(mutableDb.familyGroups[idx].transferHistory || []), entry],
    };
    addAuditLog(mutableDb, req.user, "familyGroup.transferred", "familyGroup", id, {
      fromAcsId,
      toAcsId,
      justification,
      address: group.address,
    });
    mutableDb.notifications.push({
      id: uuidv4(),
      type: "info",
      title: "Grupo familiar transferido",
      detail: `Grupo ${group.address} foi transferido para sua responsabilidade. Motivo: ${String(justification).trim()}`,
      targetUserId: String(toAcsId),
      teamId: req.user.teamId,
      createdAt: transferredAt,
      read: false,
    });
    return mutableDb.familyGroups[idx];
  });

  if (!updated) return res.status(404).json({ error: "Grupo familiar não encontrado" });
  return res.json(updated);
});

export default router;
