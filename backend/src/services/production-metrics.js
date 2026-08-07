/**
 * ProductionMetricsService — APS-01F
 *
 * All metrics derived from existing data sources.
 * No manual input. No duplicate score logic.
 * Uses evaluateGroup from active-search for score/classification.
 */

import { evaluateGroup, CLASSIFICATION } from "./active-search.js";
import {
  collectAllEvents,
  countTerritorialForUnit,
  countTerritorialForTeam,
  countTerritorialForAcs,
  countOperationalForUnit,
  countOperationalForTeam,
  countOperationalForProfessional,
  territorialBreakdownByType,
  operationalBreakdownByType,
} from "./indicator-attribution-engine.js";

// ── Period helpers ────────────────────────────────────────────────────────────

export function periodBounds(preset, customFrom, customTo) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  switch (preset) {
    case "hoje":
      return { from: todayStr, to: todayStr };
    case "semana":
      return { from: daysAgo(7), to: todayStr };
    case "mes":
      return { from: daysAgo(30), to: todayStr };
    case "trimestre":
      return { from: daysAgo(90), to: todayStr };
    case "custom":
      return { from: customFrom || daysAgo(30), to: customTo || todayStr };
    default:
      return { from: daysAgo(30), to: todayStr };
  }
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function inPeriod(dateStr, from, to) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

// ── Index builders ────────────────────────────────────────────────────────────

export function buildProductionIndices(db) {
  const patientById = Object.fromEntries(db.patients.map(p => [p.id, p]));
  const userById    = Object.fromEntries(db.users.map(u => [u.id, u]));

  // Group each patient belongs to
  const groupByPatient = {};
  for (const g of db.familyGroups || []) {
    for (const pid of g.memberPatientIds || []) groupByPatient[pid] = g;
  }

  return { patientById, userById, groupByPatient };
}

// ── ACS metrics ───────────────────────────────────────────────────────────────

export function getAcsMetrics(db, acsId, period) {
  const { from, to } = typeof period === "string"
    ? periodBounds(period)
    : period;

  const visits = (db.acsVisits || []).filter(v => v.acsId === acsId);
  const periodVisits = visits.filter(v => inPeriod(v.date, from, to));

  const visitTotal    = periodVisits.length;
  const visitRealizada = periodVisits.filter(v => v.desfecho === "realizada").length;
  const visitRecusada  = periodVisits.filter(v => v.desfecho === "recusada").length;
  const visitAusente   = periodVisits.filter(v => v.desfecho === "ausente").length;

  // Unique groups visited (realizada) in period
  const groupsVisitedIds = new Set(
    periodVisits.filter(v => v.desfecho === "realizada" && v.householdId || v.patientId)
      .map(v => {
        const g = (db.familyGroups || []).find(fg =>
          (fg.memberPatientIds || []).includes(v.patientId)
        );
        return g?.id;
      })
      .filter(Boolean)
  );

  // My groups
  const myGroups = (db.familyGroups || []).filter(g => g.assignedAcsId === acsId);

  // Tasks for my patients
  const myPatientIds = new Set(
    db.patients.filter(p => p.assignedAcsId === acsId).map(p => p.id)
  );
  const myTasks = (db.tasks || []).filter(t => myPatientIds.has(t.patientId));
  const tasksDone = myTasks.filter(t =>
    t.status === "done" && inPeriod(t.updatedAt || t.createdAt, from, to)
  ).length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const tasksOverdue = myTasks.filter(t =>
    t.status !== "done" && t.dueDate && t.dueDate < todayStr
  ).length;

  // Registrations updated in period
  const registrationsUpdated = db.patients.filter(p =>
    p.assignedAcsId === acsId && inPeriod(p.updatedAt || p.createdAt, from, to)
  ).length;

  // New groups in period
  const newGroups = myGroups.filter(g => inPeriod(g.createdAt, from, to)).length;

  // Transfers received/sent
  const transfersReceived = myGroups.reduce((acc, g) => {
    return acc + (g.transferHistory || []).filter(t =>
      t.toAcsId === acsId && inPeriod(t.transferredAt, from, to)
    ).length;
  }, 0);

  const transfersSent = myGroups.reduce((acc, g) => {
    return acc + (g.transferHistory || []).filter(t =>
      t.fromAcsId === acsId && inPeriod(t.transferredAt, from, to)
    ).length;
  }, 0);

  // Score distribution using evaluateGroup
  const indices = buildProductionIndices(db);
  const visitsByGroup = buildVisitsByGroup(db);
  const tasksByGroup  = buildTasksByGroup(db);

  let scoreSum = 0, critical = 0, attention = 0, healthy = 0;
  for (const g of myGroups) {
    const members = (g.memberPatientIds || []).map(id => indices.patientById[id]).filter(Boolean);
    const gVisits = visitsByGroup[g.id] || [];
    const gTasks  = tasksByGroup[g.id]  || [];
    const ev      = evaluateGroup(g, members, gVisits, gTasks);
    scoreSum += ev.score;
    if (ev.classification === CLASSIFICATION.CRITICAL)  critical++;
    else if (ev.classification === CLASSIFICATION.ATTENTION) attention++;
    else healthy++;
  }

  const totalGroups = myGroups.length;
  const avgScore = totalGroups > 0 ? Math.round(scoreSum / totalGroups) : 0;

  return {
    period: { from, to },
    acsId,
    visits: {
      total: visitTotal,
      realizada: visitRealizada,
      recusada: visitRecusada,
      ausente: visitAusente,
      groupsVisited: groupsVisitedIds.size,
    },
    tasks: {
      done:    tasksDone,
      overdue: tasksOverdue,
    },
    registrationsUpdated,
    newGroups,
    transfers: {
      received: transfersReceived,
      sent:     transfersSent,
    },
    groups: {
      total:    totalGroups,
      critical,
      attention,
      healthy,
      avgScore,
    },
  };
}

// ── Nurse/team metrics ────────────────────────────────────────────────────────

export function getNurseMetrics(db, teamId, period) {
  const { from, to } = typeof period === "string"
    ? periodBounds(period)
    : period;

  const acsUsers = db.users.filter(u =>
    (u.role === "acs" || u.role === "acs_supervisor") && u.teamId === teamId
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const indices     = buildProductionIndices(db);
  const visitsByGroup = buildVisitsByGroup(db);
  const tasksByGroup  = buildTasksByGroup(db);

  const perAcs = acsUsers.map(acs => {
    const metrics = getAcsMetrics(db, acs.id, { from, to });
    const hasActivity = metrics.visits.total > 0 || metrics.tasks.done > 0;
    return {
      acsId:    acs.id,
      acsName:  acs.name || "",
      ...metrics,
      inactive: !hasActivity,
    };
  });

  const teamGroups = (db.familyGroups || []).filter(g => g.teamId === teamId);
  let teamCritical = 0, teamAttention = 0, teamHealthy = 0, teamScoreSum = 0;
  let groupsWithoutVisit = 0;

  for (const g of teamGroups) {
    const members = (g.memberPatientIds || []).map(id => indices.patientById[id]).filter(Boolean);
    const gVisits = visitsByGroup[g.id] || [];
    const gTasks  = tasksByGroup[g.id]  || [];
    const ev      = evaluateGroup(g, members, gVisits, gTasks);
    teamScoreSum += ev.score;
    if (ev.classification === CLASSIFICATION.CRITICAL)  teamCritical++;
    else if (ev.classification === CLASSIFICATION.ATTENTION) teamAttention++;
    else teamHealthy++;

    const hasRecentVisit = gVisits.some(v => v.desfecho === "realizada" && inPeriod(v.date, from, to));
    if (!hasRecentVisit) groupsWithoutVisit++;
  }

  const teamPatientIds = new Set(db.patients.filter(p => p.teamId === teamId).map(p => p.id));
  const teamTasks = (db.tasks || []).filter(t => teamPatientIds.has(t.patientId));
  const pendingPendencies = teamTasks.filter(t => t.status !== "done" && t.dueDate && t.dueDate < todayStr).length;

  return {
    period: { from, to },
    teamId,
    acsActive:       perAcs.filter(a => !a.inactive).length,
    acsInactive:     perAcs.filter(a => a.inactive).length,
    perAcs,
    team: {
      totalGroups:   teamGroups.length,
      critical:      teamCritical,
      attention:     teamAttention,
      healthy:       teamHealthy,
      avgScore:      teamGroups.length > 0 ? Math.round(teamScoreSum / teamGroups.length) : 0,
      groupsWithoutVisit,
      pendingPendencies,
    },
  };
}

// ── Manager/territory metrics ─────────────────────────────────────────────────

export function getManagerMetrics(db, teamId, period) {
  const { from, to } = typeof period === "string"
    ? periodBounds(period)
    : period;

  const teamGroups   = (db.familyGroups || []).filter(g => g.teamId === teamId);
  const teamPatients = db.patients.filter(p => p.teamId === teamId && !p.inactive);
  const todayStr     = new Date().toISOString().slice(0, 10);

  const indices       = buildProductionIndices(db);
  const visitsByGroup = buildVisitsByGroup(db);
  const tasksByGroup  = buildTasksByGroup(db);

  let critical = 0, attention = 0, healthy = 0, scoreSum = 0;
  let groupsWithVisitInPeriod = 0;
  let pendenciesTotal = 0;

  for (const g of teamGroups) {
    const members = (g.memberPatientIds || []).map(id => indices.patientById[id]).filter(Boolean);
    const gVisits = visitsByGroup[g.id] || [];
    const gTasks  = tasksByGroup[g.id]  || [];
    const ev      = evaluateGroup(g, members, gVisits, gTasks);
    scoreSum += ev.score;
    pendenciesTotal += ev.pendencies.length;
    if (ev.classification === CLASSIFICATION.CRITICAL)  critical++;
    else if (ev.classification === CLASSIFICATION.ATTENTION) attention++;
    else healthy++;

    if (gVisits.some(v => v.desfecho === "realizada" && inPeriod(v.date, from, to))) {
      groupsWithVisitInPeriod++;
    }
  }

  const coveragePct = teamGroups.length > 0
    ? Math.round(groupsWithVisitInPeriod / teamGroups.length * 100)
    : 0;

  const registrationsUpdated = teamPatients.filter(p =>
    inPeriod(p.updatedAt || p.createdAt, from, to)
  ).length;

  // Temporal evolution: compare current 30d vs previous 30d
  const evolution = computeEvolution(db, teamId, teamGroups, visitsByGroup, tasksByGroup, indices);

  return {
    period: { from, to },
    teamId,
    territory: {
      totalGroups:    teamGroups.length,
      totalMembers:   teamPatients.length,
      critical,
      attention,
      healthy,
      avgScore:       teamGroups.length > 0 ? Math.round(scoreSum / teamGroups.length) : 0,
      visitCoverage:  coveragePct,
      registrationsUpdated,
      pendenciesOpen: pendenciesTotal,
    },
    evolution,
  };
}

// ── Microarea metrics ─────────────────────────────────────────────────────────

export function getMicroareaMetrics(db, teamId, acsIdFilter) {
  const teamGroups = (db.familyGroups || []).filter(g =>
    g.teamId === teamId && (!acsIdFilter || g.assignedAcsId === acsIdFilter)
  );

  const indices       = buildProductionIndices(db);
  const visitsByGroup = buildVisitsByGroup(db);
  const tasksByGroup  = buildTasksByGroup(db);

  // Group by microArea
  const byMicro = {};

  for (const g of teamGroups) {
    const micro = (g.microArea || "").trim() || "Sem microárea";
    if (!byMicro[micro]) {
      byMicro[micro] = {
        microArea: micro,
        groups: 0,
        members: 0,
        scoreSum: 0,
        critical: 0,
        attention: 0,
        healthy: 0,
        noVisit90: 0,
      };
    }

    const members = (g.memberPatientIds || []).map(id => indices.patientById[id]).filter(Boolean);
    const gVisits = visitsByGroup[g.id] || [];
    const gTasks  = tasksByGroup[g.id]  || [];
    const ev      = evaluateGroup(g, members, gVisits, gTasks);

    byMicro[micro].groups++;
    byMicro[micro].members += members.filter(m => !m.inactive).length;
    byMicro[micro].scoreSum += ev.score;
    if (ev.classification === CLASSIFICATION.CRITICAL)  byMicro[micro].critical++;
    else if (ev.classification === CLASSIFICATION.ATTENTION) byMicro[micro].attention++;
    else byMicro[micro].healthy++;

    const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const hasRecentVisit = gVisits.some(v => v.desfecho === "realizada" && v.date >= cutoff90);
    if (!hasRecentVisit) byMicro[micro].noVisit90++;
  }

  return Object.values(byMicro).map(m => ({
    microArea:  m.microArea,
    groups:     m.groups,
    members:    m.members,
    avgScore:   m.groups > 0 ? Math.round(m.scoreSum / m.groups) : 0,
    critical:   m.critical,
    attention:  m.attention,
    healthy:    m.healthy,
    noVisit90:  m.noVisit90,
  })).sort((a, b) => a.avgScore - b.avgScore); // worst first
}

// ── Temporal evolution ────────────────────────────────────────────────────────

function computeEvolution(db, teamId, teamGroups, visitsByGroup, tasksByGroup, indices) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const cur30From = daysAgo(30);
  const prev60From = daysAgo(60);

  let curScoreSum = 0, prevScoreSum = 0;
  let curCritical = 0, prevCritical = 0;
  let curVisitCoverage = 0, prevVisitCoverage = 0;
  let curPendencies = 0, prevPendencies = 0;

  // Current uses live evaluateGroup (score snapshot today)
  for (const g of teamGroups) {
    const members = (g.memberPatientIds || []).map(id => indices.patientById[id]).filter(Boolean);
    const gVisits = visitsByGroup[g.id] || [];
    const gTasks  = tasksByGroup[g.id]  || [];
    const ev = evaluateGroup(g, members, gVisits, gTasks);
    curScoreSum += ev.score;
    if (ev.classification === CLASSIFICATION.CRITICAL) curCritical++;
    curPendencies += ev.pendencies.length;
    if (gVisits.some(v => v.desfecho === "realizada" && inPeriod(v.date, cur30From, todayStr))) {
      curVisitCoverage++;
    }
    // Previous: approximate with visits/tasks from previous 30-60 day window
    if (gVisits.some(v => v.desfecho === "realizada" && inPeriod(v.date, prev60From, cur30From))) {
      prevVisitCoverage++;
    }
  }

  const n = teamGroups.length || 1;
  const curAvg   = Math.round(curScoreSum / n);
  const coverCur  = Math.round(curVisitCoverage  / n * 100);
  const coverPrev = Math.round(prevVisitCoverage / n * 100);

  // Trend: improving if avg score and visit coverage both up vs prior period
  const coverDelta = coverCur - coverPrev;
  let trend;
  if (coverDelta > 5)       trend = "melhorando";
  else if (coverDelta < -5) trend = "piorando";
  else                      trend = "estavel";

  return {
    trend,
    coverageCurrent:  coverCur,
    coveragePrevious: coverPrev,
    coverageDelta:    coverDelta,
    avgScore:         curAvg,
    criticalGroups:   curCritical,
    pendenciesOpen:   curPendencies,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildVisitsByGroup(db) {
  const map = {};
  for (const g of db.familyGroups || []) map[g.id] = [];
  const patientToGroup = {};
  for (const g of db.familyGroups || []) {
    for (const pid of g.memberPatientIds || []) patientToGroup[pid] = g.id;
  }
  for (const v of db.acsVisits || []) {
    const gid = patientToGroup[v.patientId];
    if (gid && map[gid]) map[gid].push(v);
  }
  return map;
}

function buildTasksByGroup(db) {
  const map = {};
  for (const g of db.familyGroups || []) map[g.id] = [];
  const patientToGroup = {};
  for (const g of db.familyGroups || []) {
    for (const pid of g.memberPatientIds || []) patientToGroup[pid] = g.id;
  }
  for (const t of db.tasks || []) {
    const gid = patientToGroup[t.patientId];
    if (gid && map[gid]) map[gid].push(t);
  }
  return map;
}

// ── Indicator Attribution Engine wrappers ─────────────────────────────────────
// All territorial/operational attribution uses the engine as single source of truth.
// Consumers call these functions — never implement attribution rules inline.

/**
 * Territorial indicators for a unit: events where the population of reference
 * belongs to this unit. Uses referenceUnitIdAtEvent (canonical) or unitId (legacy).
 *
 * Answers: "quais eventos refletem indicadores desta UBS?"
 */
export function getUnitTerritorialMetrics(db, unitId, period) {
  const { from, to } = typeof period === "string" ? periodBounds(period) : period;
  const events  = collectAllEvents(db, from, to);
  const counts  = countTerritorialForUnit(events, unitId);
  const byType  = territorialBreakdownByType(events, unitId);
  return {
    period:   { from, to },
    unitId,
    _kind:    "territorial",
    total:          counts.total,
    canonical:      counts.canonical,
    legacyInferred: counts.legacyInferred,
    ambiguous:      counts.ambiguous,
    byEventType:    byType,
  };
}

/**
 * Territorial indicators for a team: events attributed to this team territorially.
 * Uses referenceTeamIdAtEvent (canonical) or teamId (legacy).
 */
export function getTeamTerritorialMetrics(db, teamId, period) {
  const { from, to } = typeof period === "string" ? periodBounds(period) : period;
  const events = collectAllEvents(db, from, to);
  const counts = countTerritorialForTeam(events, teamId);
  return {
    period:   { from, to },
    teamId,
    _kind:    "territorial",
    total:          counts.total,
    canonical:      counts.canonical,
    legacyInferred: counts.legacyInferred,
    ambiguous:      counts.ambiguous,
  };
}

/**
 * Territorial indicators for an ACS: events attributed to this ACS territorially.
 * Uses referenceAcsIdAtEvent (canonical) — no legacy fallback for ACS attribution.
 */
export function getAcsTerritorialMetrics(db, acsId, period) {
  const { from, to } = typeof period === "string" ? periodBounds(period) : period;
  const events = collectAllEvents(db, from, to);
  const counts = countTerritorialForAcs(events, acsId);
  return {
    period:   { from, to },
    acsId,
    _kind:    "territorial",
    total:          counts.total,
    canonical:      counts.canonical,
    legacyInferred: counts.legacyInferred,
    ambiguous:      counts.ambiguous,
  };
}

/**
 * Operational production for a unit: events physically executed here.
 * Uses executingUnitId (canonical) or unitId (legacy).
 *
 * Answers: "quais eventos foram realizados nesta UBS?"
 */
export function getUnitOperationalMetrics(db, unitId, period) {
  const { from, to } = typeof period === "string" ? periodBounds(period) : period;
  const events  = collectAllEvents(db, from, to);
  const counts  = countOperationalForUnit(events, unitId);
  const byType  = operationalBreakdownByType(events, unitId);
  return {
    period:   { from, to },
    unitId,
    _kind:    "operational",
    total:          counts.total,
    canonical:      counts.canonical,
    legacyInferred: counts.legacyInferred,
    ambiguous:      counts.ambiguous,
    byEventType:    byType,
  };
}

/**
 * Operational production for a team: events executed by this team.
 */
export function getTeamOperationalMetrics(db, teamId, period) {
  const { from, to } = typeof period === "string" ? periodBounds(period) : period;
  const events = collectAllEvents(db, from, to);
  const counts = countOperationalForTeam(events, teamId);
  return {
    period:   { from, to },
    teamId,
    _kind:    "operational",
    total:          counts.total,
    canonical:      counts.canonical,
    legacyInferred: counts.legacyInferred,
    ambiguous:      counts.ambiguous,
  };
}

/**
 * Operational production for a professional: events executed by this individual.
 * Uses executingProfessionalId (canonical only — no legacy fallback for professionals).
 */
export function getProfessionalOperationalMetrics(db, professionalId, period) {
  const { from, to } = typeof period === "string" ? periodBounds(period) : period;
  const events = collectAllEvents(db, from, to);
  const counts = countOperationalForProfessional(events, professionalId);
  return {
    period:   { from, to },
    professionalId,
    _kind:    "operational",
    total:          counts.total,
    canonical:      counts.canonical,
    legacyInferred: counts.legacyInferred,
    ambiguous:      counts.ambiguous,
  };
}
