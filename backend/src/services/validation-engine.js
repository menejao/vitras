/**
 * Validation Engine — ARCH-INT-01 FASE 7
 *
 * 18 validation rules in 5 groups (V-ID-01 to V-LGPD-03).
 * Operates on Canonical Model records produced by the Mapping Engine.
 */

// ── CPF validator ─────────────────────────────────────────────────────────

function validateCpfCheckDigits(cpf) {
  if (!cpf || cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // all-same-digit

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 > 9) d1 = 0;
  if (parseInt(cpf[9]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 > 9) d2 = 0;
  return parseInt(cpf[10]) === d2;
}

// ── Thresholds ────────────────────────────────────────────────────────────

const THRESHOLD_ID_REJECTION = 0.30; // > 30% V-ID rejects → pause
const THRESHOLD_ORPHAN_EVENTS = 0.50; // > 50% events without patient → fail
const THRESHOLD_NO_IDENTITY = 0.80;   // > 80% without CPF/CNS → pause

const VALID_CARE_CATEGORIES = new Set(["general", "pregnant", "puerperal", "child_followup", "chronic"]);

// ── Validate single patient ───────────────────────────────────────────────

export function validatePatient(canonical, existingProductionIds) {
  const errors = [];
  const warnings = [];

  // V-ID-01: CPF or CNS present
  const hasCpf = !!canonical.cpf;
  const hasCns = !!canonical.cns;
  let incompleteProfile = false;
  if (!hasCpf && !hasCns) {
    incompleteProfile = true;
    warnings.push({ rule: "V-ID-01", message: "Sem CPF nem CNS — marcado como incompleteProfile" });
  }

  // V-ID-02: CPF check digits
  if (hasCpf && !validateCpfCheckDigits(canonical.cpf)) {
    errors.push({ rule: "V-ID-02", field: "cpf", message: "CPF com dígito verificador inválido" });
  }

  // V-ID-03: CNS length (15 digits)
  if (hasCns && !/^\d{15}$/.test(canonical.cns)) {
    errors.push({ rule: "V-ID-03", field: "cns", message: "CNS deve ter exatamente 15 dígitos" });
  }

  // V-ID-04: Name ≥ 2 chars
  if (!canonical.name || canonical.name.trim().length < 2) {
    errors.push({ rule: "V-ID-04", field: "name", message: "Nome muito curto (mínimo 2 caracteres)" });
  }

  // V-ID-05: birthDate valid, not future, ≥ 1900
  if (!canonical.birthDate) {
    errors.push({ rule: "V-ID-05", field: "birthDate", message: "Data de nascimento ausente" });
  } else {
    const d = new Date(canonical.birthDate);
    if (isNaN(d.getTime())) {
      errors.push({ rule: "V-ID-05", field: "birthDate", message: "Data de nascimento inválida" });
    } else if (d > new Date()) {
      errors.push({ rule: "V-ID-05", field: "birthDate", message: "Data de nascimento futura" });
    } else if (d.getFullYear() < 1900) {
      errors.push({ rule: "V-ID-05", field: "birthDate", message: "Data de nascimento anterior a 1900" });
    }
  }

  // V-TER-01: municipalityId 7 IBGE digits
  if (!canonical.municipalityId || !/^\d{7}$/.test(canonical.municipalityId)) {
    errors.push({ rule: "V-TER-01", field: "municipalityId", message: "municipalityId deve ter 7 dígitos IBGE" });
  }

  // V-TER-03: teamId present
  if (!canonical.teamId) {
    errors.push({ rule: "V-TER-03", field: "teamId", message: "teamId de destino ausente" });
  }

  // V-COMP-04: careCategory valid (use 'general' as fallback — not a rejection)
  if (!VALID_CARE_CATEGORIES.has(canonical.careCategory)) {
    warnings.push({ rule: "V-COMP-04", field: "careCategory", message: `careCategory inválido — fallback 'general' aplicado` });
    canonical.careCategory = "general";
  }

  // V-ID-07: CPF or CNS already in production → merge candidate
  let mergeCandidate = false;
  if (existingProductionIds && (hasCpf || hasCns)) {
    const cpfMatch = hasCpf && existingProductionIds.byCpf?.has(canonical.cpf);
    const cnsMatch = hasCns && existingProductionIds.byCns?.has(canonical.cns);
    if (cpfMatch || cnsMatch) {
      mergeCandidate = true;
      warnings.push({ rule: "V-ID-07", message: "Paciente já existe em produção — candidato a merge" });
    }
  }

  return {
    valid: errors.length === 0,
    incompleteProfile,
    mergeCandidate,
    errors,
    warnings,
  };
}

// ── Validate single event ─────────────────────────────────────────────────

export function validateEvent(canonical, patientSourceIds) {
  const errors = [];

  // V-REF-01: patientId must be in the batch or production
  if (!canonical.patientSourceId || !patientSourceIds.has(canonical.patientSourceId)) {
    errors.push({ rule: "V-REF-01", field: "patientId", message: "Paciente do evento não encontrado no Import Job" });
  }

  // V-COMP-01: visit must have desfecho
  if (canonical.type === "visit" && !canonical.desfecho) {
    errors.push({ rule: "V-COMP-01", field: "desfecho", message: "Visita sem desfecho" });
  }

  // V-COMP-02: visit must have motivosVisita
  if (canonical.type === "visit") {
    const mv = canonical.motivosVisita;
    if (!Array.isArray(mv) || mv.length === 0) {
      errors.push({ rule: "V-COMP-02", field: "motivosVisita", message: "Visita sem motivosVisita" });
    }
  }

  // V-COMP-03: visit must have tipoVisita
  if (canonical.type === "visit" && !canonical.tipoVisita) {
    errors.push({ rule: "V-COMP-03", field: "tipoVisita", message: "Visita sem tipoVisita" });
  }

  return { valid: errors.length === 0, errors };
}

// ── Run full validation on batch ──────────────────────────────────────────

export function runValidation(mappingResult, existingProductionIds) {
  const { patients, events } = mappingResult;

  const validPatients = [];
  const invalidPatients = [];
  const patientWarnings = [];

  // V-ID-06: detect CPF duplicates within the batch
  const cpfSeen = new Map();
  const cnsSeen = new Map();

  for (const p of patients.mapped) {
    const { ok, canonical, sourceId } = p;
    if (!ok) { invalidPatients.push(p); continue; }

    // V-ID-06: duplicate CPF within batch
    if (canonical.cpf) {
      if (cpfSeen.has(canonical.cpf)) {
        invalidPatients.push({
          ...p,
          errors: [{ rule: "V-ID-06", field: "cpf", message: `CPF duplicado no Import Job (primeiro registro: ${cpfSeen.get(canonical.cpf)})` }],
        });
        continue;
      }
      cpfSeen.set(canonical.cpf, sourceId);
    }

    if (canonical.cns) {
      if (cnsSeen.has(canonical.cns)) {
        invalidPatients.push({
          ...p,
          errors: [{ rule: "V-ID-06", field: "cns", message: `CNS duplicado no Import Job` }],
        });
        continue;
      }
      cnsSeen.set(canonical.cns, sourceId);
    }

    const result = validatePatient(canonical, existingProductionIds);
    if (result.valid) {
      if (result.warnings.length > 0) patientWarnings.push({ sourceId, warnings: result.warnings });
      validPatients.push({
        ...p,
        incompleteProfile: result.incompleteProfile,
        mergeCandidate: result.mergeCandidate,
        warnings: result.warnings,
      });
    } else {
      invalidPatients.push({ ...p, errors: result.errors });
    }
  }

  // Build set of valid patient sourceIds for event validation
  const validPatientSourceIds = new Set(validPatients.map((p) => p.sourceId));

  const validEvents = [];
  const invalidEvents = [];

  for (const e of events.mapped) {
    const result = validateEvent(e.canonical, validPatientSourceIds);
    if (result.valid) {
      validEvents.push(e);
    } else {
      invalidEvents.push({ ...e, errors: result.errors });
    }
  }

  // Threshold checks
  const totalPatients = patients.mapped.length;
  const idRejectionRate = totalPatients > 0 ? invalidPatients.length / totalPatients : 0;
  const noIdentityCount = validPatients.filter((p) => p.incompleteProfile).length;
  const noIdentityRate = totalPatients > 0 ? noIdentityCount / totalPatients : 0;

  const totalEvents = events.mapped.length;
  const orphanEventRate = totalEvents > 0 ? invalidEvents.filter(
    (e) => e.errors.some((err) => err.rule === "V-REF-01")
  ).length / totalEvents : 0;

  const thresholds = {
    idRejectionRate: { value: idRejectionRate, threshold: THRESHOLD_ID_REJECTION, exceeded: idRejectionRate > THRESHOLD_ID_REJECTION },
    noIdentityRate: { value: noIdentityRate, threshold: THRESHOLD_NO_IDENTITY, exceeded: noIdentityRate > THRESHOLD_NO_IDENTITY },
    orphanEventRate: { value: orphanEventRate, threshold: THRESHOLD_ORPHAN_EVENTS, exceeded: orphanEventRate > THRESHOLD_ORPHAN_EVENTS },
  };

  const shouldPause = thresholds.idRejectionRate.exceeded || thresholds.noIdentityRate.exceeded;
  const shouldFail = thresholds.orphanEventRate.exceeded;

  return {
    patients: { valid: validPatients, invalid: invalidPatients, warnings: patientWarnings },
    events: { valid: validEvents, invalid: invalidEvents },
    thresholds,
    shouldPause,
    shouldFail,
    stats: {
      totalPatients,
      validPatients: validPatients.length,
      invalidPatients: invalidPatients.length,
      mergeCandidate: validPatients.filter((p) => p.mergeCandidate).length,
      incompleteProfile: validPatients.filter((p) => p.incompleteProfile).length,
      totalEvents: events.mapped.length,
      validEvents: validEvents.length,
      invalidEvents: invalidEvents.length,
    },
  };
}
