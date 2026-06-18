/**
 * ActiveSearchEngine — APS-01E
 *
 * Pure deterministic service. No AI, no opaque heuristics.
 * All rules explicitly coded and auditable.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

export const PENDENCY_CODES = {
  UPDATE_REGISTRATION_REQUIRED: "UPDATE_REGISTRATION_REQUIRED", // R-01
  VISIT_RECOMMENDED:            "VISIT_RECOMMENDED",            // R-02
  MISSING_CNS:                  "MISSING_CNS",                  // R-03
  ADDRESS_VALIDATION_REQUIRED:  "ADDRESS_VALIDATION_REQUIRED",  // R-04
  FAMILY_OUT_OF_FOLLOWUP:       "FAMILY_OUT_OF_FOLLOWUP",       // R-05
  OVERDUE_TASK:                 "OVERDUE_TASK",                 // R-06
  NEW_MEMBER_REVIEW:            "NEW_MEMBER_REVIEW",            // R-07
  TERRITORIAL_REVIEW:           "TERRITORIAL_REVIEW",           // R-08
};

export const PRIORITY = { HIGH: "high", MEDIUM: "medium", LOW: "low" };

export const CLASSIFICATION = {
  HEALTHY:  "saudavel",   // 80-100
  ATTENTION: "atencao",   // 50-79
  CRITICAL:  "critico",   // 0-49
};

// Score weights (must total 100)
const SCORE_WEIGHTS = {
  RECENT_VISIT:           25, // last visit < 90 days with desfecho=realizada
  UPDATED_REGISTRATION:   25, // all active members updated < 12 months
  ALL_CNS:                15, // all active members have CNS
  COMPLETE_ADDRESS:       15, // group/members have valid address
  NO_OVERDUE_TASKS:       20, // no open tasks past dueDate
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(isoString) {
  if (!isoString) return Infinity;
  const diff = Date.now() - new Date(isoString).getTime();
  return diff / 86400000;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hasCompleteAddress(patient) {
  const addr = (patient.address || "").trim();
  return addr.length > 5;
}

// ── Rule evaluation ───────────────────────────────────────────────────────────

/**
 * Evaluate one family group.
 *
 * @param {object} group   - familyGroup record
 * @param {object[]} members - patient records (may include inactive)
 * @param {object[]} visits  - acsVisit records for this group
 * @param {object[]} tasks   - task records for this group
 * @returns {{ score, classification, pendencies, scoreBreakdown }}
 */
export function evaluateGroup(group, members, visits, tasks) {
  const activeMembers = members.filter(m => !m.inactive);
  const todayStr = today();

  // ── Score components ──────────────────────────────────────────────────────

  // +25: recent visit (realizada within 90 days)
  const recentVisit = visits.find(
    v => v.desfecho === "realizada" && daysAgo(v.date) <= 90
  );
  const scoreRecentVisit = recentVisit ? SCORE_WEIGHTS.RECENT_VISIT : 0;

  // +25: all active members updated within 12 months
  let scoreUpdatedReg = 0;
  if (activeMembers.length === 0) {
    scoreUpdatedReg = SCORE_WEIGHTS.UPDATED_REGISTRATION; // no members = not penalized
  } else {
    const allUpdated = activeMembers.every(m => {
      const ts = m.updatedAt || m.createdAt;
      return ts && daysAgo(ts) <= 365;
    });
    scoreUpdatedReg = allUpdated ? SCORE_WEIGHTS.UPDATED_REGISTRATION : 0;
  }

  // +15: all active members have CNS
  const allHaveCns = activeMembers.length === 0 ||
    activeMembers.every(m => (m.cns || "").trim().length > 0);
  const scoreAllCns = allHaveCns ? SCORE_WEIGHTS.ALL_CNS : 0;

  // +15: complete address
  const addressComplete = activeMembers.length === 0
    ? hasCompleteAddress({ address: group.address || "" })
    : activeMembers.every(hasCompleteAddress);
  const scoreCompleteAddr = addressComplete ? SCORE_WEIGHTS.COMPLETE_ADDRESS : 0;

  // +20: no overdue open tasks
  const hasOverdue = tasks.some(t => t.status !== "done" && t.dueDate && t.dueDate < todayStr);
  const scoreNoOverdue = hasOverdue ? 0 : SCORE_WEIGHTS.NO_OVERDUE_TASKS;

  const score = scoreRecentVisit + scoreUpdatedReg + scoreAllCns + scoreCompleteAddr + scoreNoOverdue;

  const classification =
    score >= 80 ? CLASSIFICATION.HEALTHY :
    score >= 50 ? CLASSIFICATION.ATTENTION :
    CLASSIFICATION.CRITICAL;

  // ── Rules / pendencies ────────────────────────────────────────────────────

  const pendencies = [];

  // R-01: Cadastro desatualizado (> 12 months)
  const staleMembers = activeMembers.filter(m => {
    const ts = m.updatedAt || m.createdAt;
    return !ts || daysAgo(ts) > 365;
  });
  if (staleMembers.length > 0) {
    pendencies.push({
      code:     PENDENCY_CODES.UPDATE_REGISTRATION_REQUIRED,
      priority: PRIORITY.MEDIUM,
      label:    `${staleMembers.length} cadastro${staleMembers.length > 1 ? "s" : ""} desatualizado${staleMembers.length > 1 ? "s" : ""} (>12 meses)`,
      patients: staleMembers.map(m => m.id),
      rule:     "R-01",
    });
  }

  // R-02: Sem visita recente (> 90 days)
  if (!recentVisit && activeMembers.length > 0) {
    pendencies.push({
      code:     PENDENCY_CODES.VISIT_RECOMMENDED,
      priority: PRIORITY.MEDIUM,
      label:    "Visita recomendada (última > 90 dias)",
      rule:     "R-02",
    });
  }

  // R-03: Sem CNS
  const noCns = activeMembers.filter(m => !(m.cns || "").trim());
  if (noCns.length > 0) {
    pendencies.push({
      code:     PENDENCY_CODES.MISSING_CNS,
      priority: PRIORITY.LOW,
      label:    `${noCns.length} morador${noCns.length > 1 ? "es" : ""} sem CNS`,
      patients: noCns.map(m => m.id),
      rule:     "R-03",
    });
  }

  // R-04: Endereço incompleto
  const noAddress = activeMembers.filter(m => !hasCompleteAddress(m));
  if (noAddress.length > 0) {
    pendencies.push({
      code:     PENDENCY_CODES.ADDRESS_VALIDATION_REQUIRED,
      priority: PRIORITY.HIGH,
      label:    `${noAddress.length} morador${noAddress.length > 1 ? "es" : ""} com endereço incompleto`,
      patients: noAddress.map(m => m.id),
      rule:     "R-04",
    });
  }

  // R-05: Grupo familiar sem visita (> 180 days)
  const realizedVisits = visits.filter(v => v.desfecho === "realizada");
  const lastVisit = realizedVisits.reduce((best, v) => {
    if (!best || v.date > best) return v.date;
    return best;
  }, null);
  if (activeMembers.length > 0 && (!lastVisit || daysAgo(lastVisit) > 180)) {
    pendencies.push({
      code:     PENDENCY_CODES.FAMILY_OUT_OF_FOLLOWUP,
      priority: PRIORITY.HIGH,
      label:    "Grupo fora de acompanhamento (sem visita há mais de 180 dias)",
      rule:     "R-05",
    });
  }

  // R-06: Tarefa vencida
  const overdueTasks = tasks.filter(t => t.status !== "done" && t.dueDate && t.dueDate < todayStr);
  if (overdueTasks.length > 0) {
    pendencies.push({
      code:     PENDENCY_CODES.OVERDUE_TASK,
      priority: PRIORITY.HIGH,
      label:    `${overdueTasks.length} tarefa${overdueTasks.length > 1 ? "s" : ""} em atraso`,
      rule:     "R-06",
    });
  }

  // R-07: Novo morador (últimos 30 dias)
  const newMembers = (group.memberHistory || []).filter(
    e => e.action === "join" && daysAgo(e.at) <= 30
  );
  if (newMembers.length > 0) {
    pendencies.push({
      code:     PENDENCY_CODES.NEW_MEMBER_REVIEW,
      priority: PRIORITY.MEDIUM,
      label:    `${newMembers.length} novo${newMembers.length > 1 ? "s" : ""} morador${newMembers.length > 1 ? "es" : ""} (últimos 30 dias)`,
      rule:     "R-07",
    });
  }

  // R-08: Mudança territorial (últimos 30 dias)
  const recentTransfer = (group.transferHistory || []).find(t => daysAgo(t.transferredAt) <= 30);
  if (recentTransfer) {
    pendencies.push({
      code:     PENDENCY_CODES.TERRITORIAL_REVIEW,
      priority: PRIORITY.HIGH,
      label:    "Grupo transferido recentemente — revisão territorial necessária",
      rule:     "R-08",
    });
  }

  return {
    score,
    classification,
    pendencies,
    scoreBreakdown: {
      recentVisit:          scoreRecentVisit,
      updatedRegistration:  scoreUpdatedReg,
      allCns:               scoreAllCns,
      completeAddress:      scoreCompleteAddr,
      noOverdueTasks:       scoreNoOverdue,
    },
    lastVisit,
  };
}

/**
 * Build the full active-search result for a group.
 * Returns the group envelope with evaluation attached.
 */
export function buildGroupResult(group, members, visits, tasks, usersById) {
  const evaluation = evaluateGroup(group, members, visits, tasks);
  const acs = group.assignedAcsId ? usersById[group.assignedAcsId] : null;
  const activeMembers = members.filter(m => !m.inactive);

  return {
    groupId:        group.id,
    address:        group.address || "",
    microArea:      group.microArea || null,
    teamId:         group.teamId,
    assignedAcsId:  group.assignedAcsId || null,
    acsName:        acs ? (acs.name || "") : null,
    memberCount:    activeMembers.length,
    score:          evaluation.score,
    classification: evaluation.classification,
    pendencies:     evaluation.pendencies,
    scoreBreakdown: evaluation.scoreBreakdown,
    lastVisit:      evaluation.lastVisit,
    updatedAt:      group.updatedAt || group.createdAt || null,
  };
}
