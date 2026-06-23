/**
 * Population Selection Engine — ARCH-INT-01 FASE 8
 *
 * Applies eligibility criteria E-01 to E-05 to determine which validated
 * patients actually enter staging. Also evaluates local UBS filters.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_YEAR = MS_PER_DAY * 365.25;

// ── Helpers ───────────────────────────────────────────────────────────────

function daysSince(dateStr, reference) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return (reference - d.getTime()) / MS_PER_DAY;
}

// ── E-01: Activity within last 24 months ─────────────────────────────────

function hasRecentActivity(patient, patientEventsMap, referenceDate) {
  const refMs = referenceDate.getTime();

  // Check registration/update date (either on wrapper or canonical)
  const regDate = patient.createdAt || patient.updatedAt ||
    patient.canonical?.createdAt || patient.canonical?.updatedAt;
  const regDays = daysSince(regDate, refMs);
  if (regDays <= 730) return true; // registered/updated in last 24 months

  // Use pre-built index: O(1) lookup per patient
  const patientEvents = patientEventsMap.get(patient.sourceId) || [];

  for (const ev of patientEvents) {
    const evDays = daysSince(ev.canonical?.date, refMs);
    if (evDays <= 730) return true; // any event in last 24 months
  }

  // No events or no recent ones → consider inactive for selection
  return false;
}

// ── Apply selection criteria ──────────────────────────────────────────────

export function applySelection(validationResult, existingProductionMap, localFilters, referenceDate) {
  const ref = referenceDate || new Date();
  const { patients, events } = validationResult;
  const { valid: validPatients } = patients;
  const { valid: validEvents } = events;

  // Pre-build event index by patientSourceId to avoid O(N²) in hasRecentActivity
  const eventsByPatient = new Map();
  for (const e of validEvents) {
    const pid = e.patientSourceId;
    if (!eventsByPatient.has(pid)) eventsByPatient.set(pid, []);
    eventsByPatient.get(pid).push(e);
  }

  const selected = [];
  const rejected = [];

  const localMicroArea = localFilters?.microArea || null;
  const localCareCategory = localFilters?.careCategory || null;
  const localTeamId = localFilters?.teamId || null;
  const localDateFrom = localFilters?.dateFrom ? new Date(localFilters.dateFrom) : null;
  const localMaxPatients = localFilters?.maxPatients ? Number(localFilters.maxPatients) : null;

  for (const p of validPatients) {
    const canon = p.canonical;
    const reasons = [];

    // E-01: Recent activity (24 months)
    if (!hasRecentActivity(p, eventsByPatient, ref)) {
      reasons.push({ criterion: "E-01", message: "Sem atividade assistencial nos últimos 24 meses" });
    }

    // E-02: Territorial bond — municipalityId check handled upstream (V-TER-01/02)
    // Here we enforce local filters

    // E-03: Minimum identity (name + birthDate)
    if (!canon.name || !canon.birthDate) {
      reasons.push({ criterion: "E-03", message: "Identidade mínima ausente (nome + data de nascimento)" });
    }

    // E-04: Deduplication / merge candidate (already flagged by validation)
    // merge candidates are included in staging for review

    // E-05: Inactive patients pass with inactive=true flag
    // (included but marked)

    // Local filters
    if (localMicroArea && canon.microArea && canon.microArea !== localMicroArea) {
      reasons.push({ criterion: "LOCAL-MICROAREA", message: `Microárea ${canon.microArea} fora do filtro ${localMicroArea}` });
    }

    if (localCareCategory && canon.careCategory !== localCareCategory) {
      reasons.push({ criterion: "LOCAL-CARE-CATEGORY", message: `careCategory ${canon.careCategory} fora do filtro ${localCareCategory}` });
    }

    if (localMaxPatients && selected.length >= localMaxPatients) {
      reasons.push({ criterion: "LOCAL-MAX-PATIENTS", message: `Limite local de ${localMaxPatients} pacientes atingido` });
    }

    if (reasons.length === 0) {
      selected.push(p);
    } else {
      rejected.push({ ...p, rejectionReasons: reasons });
    }
  }

  // Filter events for selected patients only
  const selectedPatientSourceIds = new Set(selected.map((p) => p.sourceId));
  const selectedEvents = validEvents.filter(
    (e) => e.patientSourceId && selectedPatientSourceIds.has(e.patientSourceId)
  );

  // Apply dateFrom filter on events
  const filteredEvents = localDateFrom
    ? selectedEvents.filter((e) => {
        const d = new Date(e.canonical?.date);
        return !isNaN(d.getTime()) && d >= localDateFrom;
      })
    : selectedEvents;

  const inactiveIncluded = selected.filter((p) => p.canonical.inactive).length;
  const mergeCandidate = selected.filter((p) => p.mergeCandidate).length;

  return {
    selected,
    rejected,
    events: filteredEvents,
    stats: {
      totalCandidates: validPatients.length,
      selected: selected.length,
      rejected: rejected.length,
      mergeCandidate,
      inactiveIncluded,
      eventsSelected: filteredEvents.length,
    },
  };
}
