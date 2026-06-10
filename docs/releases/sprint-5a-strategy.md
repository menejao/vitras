# Sprint 5A Strategy — Selective Anonymization & Compliance

## Status: PLANNING (not yet started)
## Priority: HIGH — Required before regulated production
## Branch target: dev

---

## 1. Primary Goal: Selective Anonymization (KI-02 Resolution)

### Problem

`anonymizePatientBundle()` currently deletes the `clinicalRecords` array entirely when anonymizing a patient. This satisfies LGPD Art. 16 erasure requirements but may conflict with CFM 1821/2007, which mandates 20-year retention of clinical records.

The current implementation:
- Removes patient PII fields (name, motherName, CPF, CNS, phone, address) — correct
- Deletes `clinicalRecords` array entirely — potentially non-compliant with CFM 1821/2007
- Deletes `appointments` array — may have retention requirements
- Creates `anonymization_warning_acknowledged` pre-flight audit — correct, preserved

### Target State

Patient anonymization after Sprint 5A should:
1. Remove all PII fields from the patient record (name, motherName, CPF, CNS, phone, address, email, and any other identifiable fields)
2. PRESERVE clinical records with PII scrubbed from their content
3. Replace `patientId` references in clinical records with an anonymized patient marker
4. Maintain audit trail documenting what was anonymized and when
5. NOT delete clinical content (diagnoses, prescriptions, procedures, observations)

### Proposed `anonymizePatientBundle` v2 Behavior

| Data type | Current behavior | Target behavior |
|-----------|-----------------|-----------------|
| Patient PII fields | Anonymized | Anonymized (no change) |
| `clinicalRecords` array | Deleted | Kept, PII scrubbed from content |
| `appointments` array | Deleted | Kept with PII scrubbed, or kept for clinical audit |
| `messages` | (varies) | Delete (no clinical retention requirement) |
| `tasks` (clinical) | (varies) | Keep structure, scrub PII in content |
| `tasks` (administrative) | (varies) | Delete |
| `referrals` | (varies) | Keep (clinical content), scrub PII |
| Pre-flight audit record | Created | No change (preserved) |

### New Functions Required

```javascript
// Scrub PII from patient record fields, preserve clinical structure
function anonymizePatientPii(patient) { ... }

// Replace patient identifiers in clinical record content, preserve clinical data
function scrubClinicalRecordPii(record, anonymizedName) { ... }

// v2 orchestrator
function anonymizePatientBundle(patient, auditEntry) {
  // 1. Create pre-flight audit (existing)
  // 2. anonymizePatientPii(patient)
  // 3. patient.clinicalRecords.map(r => scrubClinicalRecordPii(r, patient.anonymizedName))
  // 4. Scrub PII from appointments, tasks, referrals per table above
  // 5. Delete messages
  // 6. Write updated patient bundle
}
```

### Legal Prerequisite

Before implementation, the following legal steps are required:

1. Obtain written legal opinion from a healthcare law specialist on the interaction between LGPD Art. 16 (erasure right) and CFM 1821/2007 (20-year record retention) in the context of public UBS operation
2. Document the legal determination in `docs/lgpd-cfm-considerations.md`
3. Obtain acceptance from UBS medical director for the chosen approach
4. Document the decision in `docs/releases/known-issues.md` as KI-02 resolved

### Implementation Approach

- New function `anonymizePatientPii(patient)` — scrubs fields, keeps clinical structure
- New function `scrubClinicalRecordPii(record, anonymizedName)` — replaces PII in record content fields
- Modify `anonymizePatientBundle` to call both
- New migration (009) if Postgres schema changes are needed (e.g., new `anonymized_clinical_record` type)
- Full regression test suite covering anonymization behavior
- Test that `GET /patients/:id` returns anonymized record with clinical history intact
- Test that audit chain remains valid after anonymization

---

## 2. Secondary Goals (Sprint 5A)

### KI-06: crypto.randomUUID Fallback (trivial fix)
**File:** `backend/src/services/privacy.js`
**Change:** Replace `crypto.randomUUID()` with `uuidv4()` (already imported in the file)
**Effort:** 2 lines, 30 minutes
**Risk:** Zero

### KI-07: Fix Pre-existing Test Failures

**pharmacy.test.js:**
- Expects 403 but gets 201 — permissions model mismatch in test fixture
- Investigation needed: does the test reflect intended behavior or is the implementation wrong?
- Effort: 2–4 hours investigation + fix

**access-requests.test.js:**
- Expects 201 but gets 400 — fixture mismatch with current schema
- Likely fixture needs updating to match current required fields
- Effort: 1–2 hours

**twofa.test.js:**
- 2 subtests failing — 2FA flow test mismatch
- Investigate whether 2FA flow changed in hardening sprints
- Effort: 2–4 hours

### KI-01: usersRouter Registration Order
**File:** `backend/src/server.js` (or app.js)
**Change:** Move `app.use(usersRouter)` to after `app.use(requireAuth)` global middleware
**Pattern:** Mirror S10-03 fix that was applied to `adminRouter` in Sprint 4.1
**Effort:** 1 line change + regression test
**Risk:** Low — verify no users.js route relies on being before requireAuth

---

## 3. Sprint 5B Backlog

Items deferred from Sprint 5A due to higher complexity:

| Item | Description | Complexity |
|------|-------------|-----------|
| KI-03 | `rejectUnauthorized: false` — bundle AWS RDS CA for certificate validation | Medium |
| Postgres audit path | `getAuditReport` is file-mode only; needs SQL implementation | Medium |
| Unit deactivation | `unit.status` field for logical UBS deactivation without data deletion | Low-Medium |
| KI-05 | Multi-probe HALF_OPEN circuit breaker — single controlled probe | Low |
| Audit chain health | Wire `/health` `auditChain` status to real integrity endpoint result | Low |

---

## 4. Timeline Estimate

### Sprint 5A (2–3 weeks)

| Week | Focus |
|------|-------|
| Week 1 | Legal review kickoff; KI-06 fix (30min); KI-07 test fixes; KI-01 usersRouter fix |
| Week 2 | Selective anonymization design review with legal feedback; define scrubbing rules per record type |
| Week 3 | Selective anonymization implementation + regression test suite + QA validation |

### Sprint 5B (2–3 weeks, after 5A)

| Week | Focus |
|------|-------|
| Week 1 | RDS CA bundle implementation and testing |
| Week 2 | Postgres `getAuditReport` SQL path + unit deactivation field |
| Week 3 | Circuit breaker single-probe fix + audit chain health wiring + integration tests |

---

## 5. Definition of Done for Sprint 5A

- [ ] Legal determination on LGPD/CFM tension documented and accepted
- [ ] `anonymizePatientBundle` v2 implemented with selective PII scrubbing
- [ ] Clinical records preserved post-anonymization (verified by test)
- [ ] KI-02 status updated to "Resolved" in known-issues.md
- [ ] KI-06 fixed (randomUUID fallback)
- [ ] KI-01 fixed (usersRouter ordering)
- [ ] pharmacy.test.js, access-requests.test.js, twofa.test.js all passing
- [ ] Full regression suite green
- [ ] QA sign-off on anonymization behavior
- [ ] Release notes for v1.0.1-pilot-governed or v1.1-pilot-governed
