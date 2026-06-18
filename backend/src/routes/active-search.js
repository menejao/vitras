/**
 * Active Search routes — APS-01E
 *
 * GET /active-search          — filtered list of evaluated family groups
 * GET /active-search/group/:groupId — single group evaluation
 * GET /active-search/stats    — aggregate stats for team/acs
 */

import express from "express";
import { readDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";
import { buildGroupResult, evaluateGroup, CLASSIFICATION } from "../services/active-search.js";
import { isAcs, canonicalRole } from "../utils/helpers.js";

const router = express.Router();

// ── Scope helper ──────────────────────────────────────────────────────────────

function visibleGroups(db, user) {
  const role = canonicalRole(user?.role);
  if (role === "break_glass_admin") return db.familyGroups;
  if (isAcs(user)) {
    return db.familyGroups.filter(g => g.teamId === user.teamId && g.assignedAcsId === user.id);
  }
  return db.familyGroups.filter(g => g.teamId === user.teamId);
}

// ── Build index helpers ───────────────────────────────────────────────────────

function buildIndices(db) {
  const patientById  = Object.fromEntries(db.patients.map(p => [p.id, p]));
  const usersById    = Object.fromEntries(db.users.map(u => [u.id, u]));

  // visits by patientId set (or householdId)
  const visitsByGroup = {};  // groupId → visits[]
  const tasksByGroup  = {};  // groupId → tasks[]

  for (const g of db.familyGroups) {
    visitsByGroup[g.id] = [];
    tasksByGroup[g.id]  = [];
  }

  // Index patients to their group
  const groupByPatient = {};
  for (const g of db.familyGroups) {
    for (const pid of g.memberPatientIds || []) {
      groupByPatient[pid] = g.id;
    }
  }

  for (const v of db.acsVisits || []) {
    const gid = groupByPatient[v.patientId];
    if (gid && visitsByGroup[gid]) visitsByGroup[gid].push(v);
  }

  for (const t of db.tasks || []) {
    const gid = groupByPatient[t.patientId];
    if (gid && tasksByGroup[gid]) tasksByGroup[gid].push(t);
  }

  return { patientById, usersById, visitsByGroup, tasksByGroup, groupByPatient };
}

// ── GET /active-search ────────────────────────────────────────────────────────

router.get("/active-search", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);

  const {
    acsId, microarea, status, scoreMin, scoreMax, pendency, page, limit: limitQ,
  } = req.query;

  const groups  = visibleGroups(db, req.user);
  const indices = buildIndices(db);

  let results = groups.map(g => {
    const memberIds = new Set(g.memberPatientIds || []);
    const members   = [...memberIds].map(id => indices.patientById[id]).filter(Boolean);
    const visits    = indices.visitsByGroup[g.id] || [];
    const tasks     = indices.tasksByGroup[g.id]  || [];
    return buildGroupResult(g, members, visits, tasks, indices.usersById);
  });

  // ── Filters ────────────────────────────────────────────────────────────────
  if (acsId)     results = results.filter(r => r.assignedAcsId === acsId);
  if (microarea) results = results.filter(r => (r.microArea || "").toLowerCase() === microarea.toLowerCase());
  if (status)    results = results.filter(r => r.classification === status);
  if (scoreMin !== undefined) results = results.filter(r => r.score >= Number(scoreMin));
  if (scoreMax !== undefined) results = results.filter(r => r.score <= Number(scoreMax));
  if (pendency)  results = results.filter(r => r.pendencies.some(p => p.code === pendency));

  // ── Sort: most critical first (score asc), then by pendency count ──────────
  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.pendencies.length - a.pendencies.length;
  });

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageNum  = Math.max(1, parseInt(page || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(limitQ || "50", 10)));
  const total    = results.length;
  const items    = results.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  return res.json({
    items,
    total,
    page:  pageNum,
    limit: pageSize,
    pages: Math.ceil(total / pageSize),
  });
});

// ── GET /active-search/stats ──────────────────────────────────────────────────

router.get("/active-search/stats", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);

  const groups  = visibleGroups(db, req.user);
  const indices = buildIndices(db);

  let critical  = 0;
  let attention = 0;
  let healthy   = 0;
  let totalScore = 0;
  const pendencyCount = {};

  for (const g of groups) {
    const memberIds = new Set(g.memberPatientIds || []);
    const members   = [...memberIds].map(id => indices.patientById[id]).filter(Boolean);
    const visits    = indices.visitsByGroup[g.id] || [];
    const tasks     = indices.tasksByGroup[g.id]  || [];
    const ev        = evaluateGroup(g, members, visits, tasks);

    if (ev.classification === CLASSIFICATION.CRITICAL)  critical++;
    else if (ev.classification === CLASSIFICATION.ATTENTION) attention++;
    else healthy++;

    totalScore += ev.score;
    for (const p of ev.pendencies) {
      pendencyCount[p.code] = (pendencyCount[p.code] || 0) + 1;
    }
  }

  const total = groups.length;
  return res.json({
    total,
    critical,
    attention,
    healthy,
    avgScore: total > 0 ? Math.round(totalScore / total) : 0,
    pendencyBreakdown: pendencyCount,
  });
});

// ── GET /active-search/group/:groupId ─────────────────────────────────────────

router.get("/active-search/group/:groupId", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);

  const group = db.familyGroups.find(g => g.id === req.params.groupId);
  if (!group) return res.status(404).json({ error: "Grupo familiar não encontrado" });

  // Scope check
  const role = canonicalRole(req.user?.role);
  const isBga = role === "break_glass_admin";
  const visible = isBga
    ? true
    : isAcs(req.user)
      ? group.teamId === req.user.teamId && group.assignedAcsId === req.user.id
      : group.teamId === req.user.teamId;

  if (!visible) return res.status(403).json({ error: "Sem permissão para visualizar este grupo" });

  const indices   = buildIndices(db);
  const memberIds = new Set(group.memberPatientIds || []);
  const members   = [...memberIds].map(id => indices.patientById[id]).filter(Boolean);
  const visits    = indices.visitsByGroup[group.id] || [];
  const tasks     = indices.tasksByGroup[group.id]  || [];
  const result    = buildGroupResult(group, members, visits, tasks, indices.usersById);

  // Audit event (passive read — track recalculation)
  // No audit for simple reads; only log when score is persisted (future)

  return res.json(result);
});

export default router;
