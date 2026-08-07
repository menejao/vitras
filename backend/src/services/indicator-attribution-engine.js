/**
 * IndicatorAttributionEngine — VITRAS-INDICATORS-AND-OPERATIONAL-PRODUCTION-01
 *
 * Single source of truth for territorial and operational attribution.
 * No dashboard, endpoint, or report may implement attribution rules directly.
 *
 * Territorial attribution answers: "Quem é territorialmente responsável?"
 *   → referenceUnitIdAtEvent (primary)
 *   → referenceTeamIdAtEvent
 *   → referenceAcsIdAtEvent
 *
 * Operational attribution answers: "Onde e por quem foi realizado?"
 *   → executingUnitId (primary)
 *   → executingTeamId
 *   → executingProfessionalId
 *
 * Rules:
 *   - Never use executingUnitId to decide territorial attribution.
 *   - Never use referenceUnitIdAtEvent to decide operational attribution.
 *   - Never recalculate historical events from current patient reference.
 *   - Never invent attribution for ambiguous legacy events.
 */

export const ATTRIBUTION_SOURCE = {
  CANONICAL:            "canonical",            // canonical fields present
  LEGACY_INFERRED_SAFE: "legacy_inferred_safe", // no canonical field, unitId unambiguous
  LEGACY_AMBIGUOUS:     "legacy_ambiguous",     // cannot determine reliably — not counted
};

export const EVENT_TYPE = {
  ACS_VISIT:        "acsVisit",
  AGENDA:           "agendaEntry",
  EXAM:             "exam",
  EXAM_REQUEST:     "examRequest",
  REFERRAL:         "referral",
  DENTAL_ENCOUNTER: "dentalEncounter",
  ODONTO_PROCEDURE: "odontoProcedure",
  RECEITA:          "receita",
  DISPENSACAO:      "dispensacao",
};

// ── Date resolution ───────────────────────────────────────────────────────────

function getEventDate(ev) {
  return ev?.occurredAt || ev?.date || ev?.requestedAt || ev?.dispensedAt || ev?.createdAt || null;
}

function inPeriod(dateStr, from, to) {
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  return d >= from && d <= to;
}

// ── Core attribution resolvers ────────────────────────────────────────────────

/**
 * Resolve territorial attribution for a single event.
 * Returns the unit/team/acs responsible for this event's indicator.
 * Precedence: referenceUnitIdAtEvent > unitId (legacy) > ambiguous.
 */
export function resolveTerritory(event) {
  const refUnit = String(event?.referenceUnitIdAtEvent || "").trim();
  const refTeam = String(event?.referenceTeamIdAtEvent || "").trim();
  const refAcs  = String(event?.referenceAcsIdAtEvent  || "").trim();

  if (refUnit) {
    return {
      unitId: refUnit,
      teamId: refTeam || null,
      acsId:  refAcs  || null,
      source: ATTRIBUTION_SOURCE.CANONICAL,
    };
  }

  // Legacy: use event-level unitId (stored before canonical fields existed)
  const legacyUnit = String(event?.unitId || "").trim();
  const legacyTeam = String(event?.teamId || "").trim();

  if (legacyUnit) {
    return {
      unitId: legacyUnit,
      teamId: legacyTeam || null,
      acsId:  null,
      source: ATTRIBUTION_SOURCE.LEGACY_INFERRED_SAFE,
    };
  }

  return {
    unitId: null,
    teamId: null,
    acsId:  null,
    source: ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS,
  };
}

/**
 * Resolve operational attribution for a single event.
 * Returns the unit/team/professional that executed this event.
 * Precedence: executingUnitId > unitId (legacy) > ambiguous.
 */
export function resolveOperation(event) {
  const execUnit = String(event?.executingUnitId || "").trim();
  const execTeam = String(event?.executingTeamId || "").trim();
  const execProf = String(event?.executingProfessionalId || "").trim();

  if (execUnit) {
    return {
      unitId:         execUnit,
      teamId:         execTeam || null,
      professionalId: execProf || null,
      source: ATTRIBUTION_SOURCE.CANONICAL,
    };
  }

  // Legacy: use event-level unitId as executor approximation
  const legacyUnit = String(event?.unitId || "").trim();
  const legacyTeam = String(event?.teamId || "").trim();

  if (legacyUnit) {
    return {
      unitId:         legacyUnit,
      teamId:         legacyTeam || null,
      professionalId: null,
      source: ATTRIBUTION_SOURCE.LEGACY_INFERRED_SAFE,
    };
  }

  return {
    unitId:         null,
    teamId:         null,
    professionalId: null,
    source: ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS,
  };
}

// ── Collection builder ────────────────────────────────────────────────────────

/**
 * Collect all tagged events from db filtered by period.
 * Each event gets _eventType and _eventDate injected.
 */
export function collectAllEvents(db, from, to) {
  const tagged = [];

  function push(collection, type) {
    for (const ev of collection || []) {
      const d = getEventDate(ev);
      if (!inPeriod(d, from, to)) continue;
      tagged.push({ ...ev, _eventType: type, _eventDate: d });
    }
  }

  push(db.acsVisits,        EVENT_TYPE.ACS_VISIT);
  push(db.agendaEntries,    EVENT_TYPE.AGENDA);
  push(db.exams,            EVENT_TYPE.EXAM);
  push(db.examRequests,     EVENT_TYPE.EXAM_REQUEST);
  push(db.referrals,        EVENT_TYPE.REFERRAL);
  push(db.dentalEncounters, EVENT_TYPE.DENTAL_ENCOUNTER);
  push(db.odontoProcedures, EVENT_TYPE.ODONTO_PROCEDURE);
  push(db.prescricoes,      EVENT_TYPE.RECEITA);
  push(db.dispensacoes,     EVENT_TYPE.DISPENSACAO);

  return tagged;
}

// ── Aggregation functions ─────────────────────────────────────────────────────

/**
 * Count events whose territorial attribution matches unitId.
 * LEGACY_AMBIGUOUS events are counted separately (not added to total).
 */
export function countTerritorialForUnit(events, unitId) {
  let total = 0, canonical = 0, legacyInferred = 0, ambiguous = 0;
  for (const ev of events) {
    const t = resolveTerritory(ev);
    if (t.source === ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS) { ambiguous++; continue; }
    if (t.unitId === unitId) {
      total++;
      if (t.source === ATTRIBUTION_SOURCE.CANONICAL) canonical++;
      else legacyInferred++;
    }
  }
  return { total, canonical, legacyInferred, ambiguous };
}

/**
 * Count events whose territorial attribution matches teamId.
 */
export function countTerritorialForTeam(events, teamId) {
  let total = 0, canonical = 0, legacyInferred = 0, ambiguous = 0;
  for (const ev of events) {
    const t = resolveTerritory(ev);
    if (t.source === ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS) { ambiguous++; continue; }
    if (t.teamId === teamId) {
      total++;
      if (t.source === ATTRIBUTION_SOURCE.CANONICAL) canonical++;
      else legacyInferred++;
    }
  }
  return { total, canonical, legacyInferred, ambiguous };
}

/**
 * Count events whose territorial attribution matches acsId.
 */
export function countTerritorialForAcs(events, acsId) {
  let total = 0, canonical = 0, legacyInferred = 0, ambiguous = 0;
  for (const ev of events) {
    const t = resolveTerritory(ev);
    if (t.source === ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS) { ambiguous++; continue; }
    if (t.acsId === acsId) {
      total++;
      if (t.source === ATTRIBUTION_SOURCE.CANONICAL) canonical++;
      else legacyInferred++;
    }
  }
  return { total, canonical, legacyInferred, ambiguous };
}

/**
 * Count events whose operational attribution matches unitId.
 */
export function countOperationalForUnit(events, unitId) {
  let total = 0, canonical = 0, legacyInferred = 0, ambiguous = 0;
  for (const ev of events) {
    const o = resolveOperation(ev);
    if (o.source === ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS) { ambiguous++; continue; }
    if (o.unitId === unitId) {
      total++;
      if (o.source === ATTRIBUTION_SOURCE.CANONICAL) canonical++;
      else legacyInferred++;
    }
  }
  return { total, canonical, legacyInferred, ambiguous };
}

/**
 * Count events whose operational attribution matches teamId.
 */
export function countOperationalForTeam(events, teamId) {
  let total = 0, canonical = 0, legacyInferred = 0, ambiguous = 0;
  for (const ev of events) {
    const o = resolveOperation(ev);
    if (o.source === ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS) { ambiguous++; continue; }
    if (o.teamId === teamId) {
      total++;
      if (o.source === ATTRIBUTION_SOURCE.CANONICAL) canonical++;
      else legacyInferred++;
    }
  }
  return { total, canonical, legacyInferred, ambiguous };
}

/**
 * Count events whose operational attribution matches professionalId.
 */
export function countOperationalForProfessional(events, professionalId) {
  let total = 0, canonical = 0, legacyInferred = 0, ambiguous = 0;
  for (const ev of events) {
    const o = resolveOperation(ev);
    if (o.source === ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS) { ambiguous++; continue; }
    if (o.professionalId === professionalId) {
      total++;
      if (o.source === ATTRIBUTION_SOURCE.CANONICAL) canonical++;
      else legacyInferred++;
    }
  }
  return { total, canonical, legacyInferred, ambiguous };
}

// ── Breakdown by event type ───────────────────────────────────────────────────

/**
 * Return per-event-type count for territorial attribution to a unit.
 */
export function territorialBreakdownByType(events, unitId) {
  const byType = {};
  for (const ev of events) {
    const t = resolveTerritory(ev);
    if (t.source === ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS) continue;
    if (t.unitId !== unitId) continue;
    const type = ev._eventType || "unknown";
    byType[type] = (byType[type] || 0) + 1;
  }
  return byType;
}

/**
 * Return per-event-type count for operational attribution to a unit.
 */
export function operationalBreakdownByType(events, unitId) {
  const byType = {};
  for (const ev of events) {
    const o = resolveOperation(ev);
    if (o.source === ATTRIBUTION_SOURCE.LEGACY_AMBIGUOUS) continue;
    if (o.unitId !== unitId) continue;
    const type = ev._eventType || "unknown";
    byType[type] = (byType[type] || 0) + 1;
  }
  return byType;
}
