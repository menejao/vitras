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

function ageYears(birthDate) {
  if (!birthDate) return null;
  const born = new Date(birthDate + "T00:00:00");
  if (isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age--;
  return age;
}

function pendencies(group, members, visits, tasks) {
  const result = [];
  const today = new Date().toISOString().slice(0, 10);

  // Members with no CNS
  const noCns = members.filter(m => !m.cns?.trim());
  if (noCns.length) {
    result.push({
      type: "missing_cns",
      label: `${noCns.length} morador${noCns.length > 1 ? "es" : ""} sem CNS`,
      severity: "warn",
      patients: noCns.map(m => m.id),
    });
  }

  // Members with incomplete address
  const noAddr = members.filter(m => !m.address?.trim());
  if (noAddr.length) {
    result.push({
      type: "missing_address",
      label: `${noAddr.length} morador${noAddr.length > 1 ? "es" : ""} sem endereço completo`,
      severity: "warn",
      patients: noAddr.map(m => m.id),
    });
  }

  // Overdue pending tasks
  const overdueTasks = tasks.filter(t => t.status !== "done" && t.dueDate && t.dueDate < today);
  if (overdueTasks.length) {
    result.push({
      type: "overdue_tasks",
      label: `${overdueTasks.length} tarefa${overdueTasks.length > 1 ? "s" : ""} em atraso`,
      severity: "danger",
    });
  }

  // No visit in last 90 days
  const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const recentVisit = visits.find(v => v.date >= cutoff90 && v.desfecho === "realizada");
  if (!recentVisit && members.length > 0) {
    result.push({
      type: "no_recent_visit",
      label: "Sem visita realizada nos últimos 90 dias",
      severity: "warn",
    });
  }

  return result;
}

function buildTimeline(group, visits, tasks) {
  const events = [];

  if (group.createdAt) {
    events.push({ at: group.createdAt, type: "group_created", label: "Grupo familiar criado" });
  }

  for (const entry of group.memberHistory || []) {
    events.push({
      at: entry.at,
      type: entry.action === "join" ? "member_joined" : "member_left",
      label: entry.action === "join" ? "Morador vinculado ao grupo" : "Morador saiu do grupo",
      patientId: entry.patientId,
    });
  }

  for (const tr of group.transferHistory || []) {
    events.push({
      at: tr.transferredAt,
      type: "group_transferred",
      label: "Grupo transferido para outro ACS",
    });
  }

  for (const v of visits) {
    events.push({
      at: v.createdAt || v.date,
      type: "visit",
      label: `Visita ACS — ${v.desfecho === "realizada" ? "Realizada" : v.desfecho === "recusada" ? "Recusada" : "Ausente"}`,
      visitId: v.id,
      patientId: v.patientId,
    });
  }

  for (const t of tasks) {
    if (t.status === "done" && t.updatedAt) {
      events.push({
        at: t.updatedAt,
        type: "task_done",
        label: `Tarefa concluída: ${t.title}`,
        taskId: t.id,
        patientId: t.patientId,
      });
    }
  }

  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
}

router.get("/family-groups", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const q = String(req.query.q || "").toLowerCase().trim();
  let groups = db.familyGroups.filter((g) => groupVisibleToUser(g, req.user));

  if (q) {
    const patientIndex = {};
    for (const p of db.patients) {
      patientIndex[p.id] = p;
    }
    groups = groups.filter((g) => {
      if ((g.address || "").toLowerCase().includes(q)) return true;
      if ((g.microArea || "").toLowerCase().includes(q)) return true;
      return (g.memberPatientIds || []).some(id => {
        const p = patientIndex[id];
        if (!p) return false;
        if ((p.name || "").toLowerCase().includes(q)) return true;
        if ((p.socialName || "").toLowerCase().includes(q)) return true;
        if ((p.cns || "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))) return true;
        if ((p.cpf || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))) return true;
        return false;
      });
    });
  }

  return res.json(groups);
});

// GET /family-groups/:id — enriched workspace data
router.get("/family-groups/:id", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);

  const group = db.familyGroups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: "Grupo familiar não encontrado" });

  if (!groupVisibleToUser(group, req.user)) {
    return res.status(403).json({ error: "Sem permissão para visualizar este grupo" });
  }

  const memberIds = new Set(group.memberPatientIds || []);
  const members = db.patients
    .filter(p => memberIds.has(p.id))
    .map(p => ({
      id: p.id,
      name: p.name,
      socialName: p.socialName || null,
      birthDate: p.birthDate || null,
      ageYears: ageYears(p.birthDate),
      sex: p.sex || null,
      cns: p.cns || null,
      cpf: p.cpf || null,
      phone: p.phone || null,
      address: p.address || null,
      addressNumber: p.addressNumber || null,
      complement: p.complement || null,
      microArea: p.microArea || null,
      assignedAcsId: p.assignedAcsId || null,
      inactive: !!p.inactive,
    }));

  // Visits for any member patient (by patientId or householdId)
  const householdsForGroup = db.households
    ? db.households.filter(h => memberIds.has(h.patientId))
    : [];
  const householdIds = new Set(householdsForGroup.map(h => h.id));
  const mostRecentHousehold = householdsForGroup
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    [0] || null;

  const visits = (db.acsVisits || [])
    .filter(v => memberIds.has(v.patientId) || (v.householdId && householdIds.has(v.householdId)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 50);

  const tasks = (db.tasks || [])
    .filter(t => memberIds.has(t.patientId))
    .sort((a, b) => (b.dueDate || b.createdAt || "").localeCompare(a.dueDate || a.createdAt || ""));

  const assignedAcs = group.assignedAcsId
    ? db.users.find(u => u.id === group.assignedAcsId)
    : null;

  return res.json({
    group,
    acsName: assignedAcs ? (assignedAcs.name || "") : null,
    members,
    visits,
    tasks,
    household: mostRecentHousehold,
    pendencies: pendencies(group, members.filter(m => !m.inactive), visits, tasks),
    timeline: buildTimeline(group, visits, tasks),
  });
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
