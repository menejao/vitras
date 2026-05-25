# Lessons Learned — DR Drill + Tabletop Exercise

**Date:** 2026-05-25
**Author:** João Pedro
**Source:** Document preparation phase — gaps identified while creating DR drill template, tabletop scenarios, incident response validation, and rollback validation.

> These are lessons learned during the PREPARATION of the DR drill and tabletop documents. A second lessons-learned document should be created AFTER the actual live drill execution to capture runtime findings.

---

## Documentation Gaps Found During Tabletop Preparation

### Gap 1: No AWS Account Emergency Access Escalation

The runbooks assume the Tech Lead has direct AWS Console and CLI access to RDS and EB. If the Tech Lead's AWS account access is unavailable (IAM key rotation, MFA device loss, account lock, or access revocation), there is no documented escalation path for database-level or EB-level operations.

**Example scenario:** Tech Lead's MFA device fails on deploy day. Cannot log into AWS Console. Cannot execute rollback via Console or CLI.

**Action:** Document AWS account ownership, who holds IAM user admin rights, and the emergency access request procedure in `contatos.md`. Identify a backup operator with AWS access. Store IAM credentials and MFA recovery codes in the secure vault alongside break_glass_admin credentials.

**Priority:** HIGH — this is a single point of failure for all infrastructure operations.

---

### Gap 2: EB CLI Setup Not Verified Before Deploy Window

The rollback procedure (`rollback-plan.md`, `rollback-validation.md`) requires `eb deploy --version v1.0-pilot-governed`. There is no existing step that verifies the EB CLI is configured with the correct profile, application name, and environment name before the deploy window opens.

**Example scenario:** During a P0 at 21:00, Tech Lead runs `eb deploy --version v1.0-pilot-governed` and receives "Application not found" because EB CLI is pointing to the wrong environment or AWS profile.

**Action:** Added to `checklist-pre-rollout.md` (see Operational Updates section below): `eb status` must be run and the output verified against expected app/env names before any deploy window opens. This is now also in `pre-deploy-validation.md`.

**Priority:** HIGH — 5 minutes of friction during a P0 at 21:00 is 5 minutes of user downtime that was preventable.

---

### Gap 3: No Read-Only Fallback During Redis Outage

During Scenario A (Redis/Upstash unavailable), ALL user requests return 503 (fail-closed behavior). This means doctors cannot even VIEW existing patient records — not just create new ones.

**Clinical impact:** A doctor seeing a patient and needing to review their history cannot access the system at all during an Upstash outage, even though Postgres (and therefore all data) is fully available.

**Current design rationale:** Fail-closed is the correct security default during rate limit infrastructure failure — it prevents abuse when rate limiting is non-functional.

**Action:** Document as Sprint 5B feature request: a configurable read-only fallback mode that allows GET requests to pass through even when the circuit breaker is OPEN. Implementation would require separate rate limit configurations for read vs write operations, or a bypass allowlist for read-only endpoints.

**This is a feature request, not a bug.** The current behavior is correct per design. The gap is that users are not pre-informed about this behavior.

**Immediate action:** Add to pre-go-live UBS orientation: explain that system unavailability during a Redis outage is expected and temporary (usually < 30 min), and that paper documentation is the fallback.

**Priority:** MEDIUM — operational workaround (paper documentation) exists; feature request for Sprint 5B.

---

### Gap 4: Anonymization Procedure Not Practiced or Legally Validated

None of the tabletop scenarios covered the LGPD anonymization flow. The anonymization endpoint exists in the codebase (KI-02) but its legal compliance with LGPD/CFM requirements has not been formally reviewed.

**Risk:** If an anonymization request arrives during the pilot (e.g., a patient invokes their LGPD right to erasure), the operator has no validated procedure and the endpoint has not been legally cleared.

**Action:** 
1. Add to `aceite-operacional.md`: "No anonymization or deletion requests to be processed until KI-02 legal review completes in Sprint 5A."
2. Document the escalation path if an anonymization request arrives: → Tech Lead → DPO → Legal review → Sprint 5A backlog.
3. A controlled anonymization test should be included in Sprint 5A QA before the procedure is available to operators.

**Priority:** MEDIUM — low probability during pilot period; legal exposure if request arrives without a validated procedure.

---

### Gap 5: Patient Count Baseline Must Be Captured Before Restore

The DR drill requires comparing the post-restore patient count to the pre-restore baseline to validate data integrity. The baseline must be captured BEFORE initiating the PITR restore — if captured after, the comparison is meaningless.

**Example failure mode:** Operator initiates restore first, then tries to query the "old" database, but it's already been replaced or is being restored. No baseline available.

**Action:** Already addressed in `dr-drill-real-report-2026-05-25.md` — Step 1 (Pre-Restore Baseline) is explicitly placed BEFORE Step 2 (Initiate Restore). Bold callout in the document: "CRITICAL: Record these baseline values BEFORE initiating restore."

**Priority:** LOW (already mitigated in the document, no code change needed) — but emphasize in operator training.

---

### Gap 6: break_glass_admin Creation is a Chicken-and-Egg Problem (CONFIRMED)

`docs/onboarding/first-admin.md` documents how to create the first admin, mentioning a seed script `scripts/seed-tenant-admin.js`. **This script does not exist in the repository.** The scripts directory contains only: `populate-db-file.ps1`, `seed-massive-teams.ps1`, `restore-backup.js`, `rotate-encryption-key.js`, `smoke-production.js`, and a few dev-scenario scripts.

**Confirmed issue:** `POST /admin/units/bootstrap` (in `backend/src/routes/admin.js`) requires a `break_glass_admin` JWT token. There is no API endpoint to CREATE a `break_glass_admin` account via the API (this would be a circular dependency — you need break_glass to create break_glass). The only way to create the first `break_glass_admin` account is via direct database insertion before the server is started in production.

**The gap is real and is a pre-go-live blocker.** Without a documented first-admin bootstrap procedure, the Tech Lead cannot perform `POST /admin/units/bootstrap` to set up UBS #1.

**Required procedure (to be documented before go-live):**
1. Connect to production RDS via psql (requires direct DB access or bastion host)
2. Insert a `break_glass_admin` user record directly into the `users` table with a hashed password
3. Log this insertion in an out-of-band operational log (cannot use the audit log yet — system not started)
4. Start the server; use the direct-DB-created credentials to call `POST /admin/units/bootstrap`
5. After bootstrap: the audit chain begins from this point forward
6. Document the initial DB insertion as an audit event manually (record in operational log with timestamp, what was created, and why)

The `scripts/provision-dev-user.mjs` and `scripts/provision-remote-enterprise-user.mjs` scripts may offer a pattern for this — review them before drafting the production procedure.

**Action:**
1. Review `scripts/provision-remote-enterprise-user.mjs` to understand if it can create a `break_glass_admin` role.
2. Write `docs/onboarding/first-admin-production.md` with the exact production bootstrap procedure.
3. Test this procedure on staging before production go-live.

**Priority:** CRITICAL — this must be resolved before UBS #1 can be bootstrapped. Cannot create ANY users without a working break_glass_admin account.

---

### Gap 7: contatos.md Has Only Placeholders

`docs/rollout/ubs-001/contatos.md` exists but contains placeholder names. Multiple runbooks and tabletop scenarios reference it as the source of truth for escalation contacts (DPO, medical director, UBS coordinator, TI Prefeitura, AWS Support).

**Risk:** During a P0 incident at 21:00, operator opens `contatos.md` and finds `[Nome do DPO]` — no phone number to call.

**Action:** Populate `contatos.md` with real contact information before go-live. This is pre-condition #4 in `ubs-001-go-no-go-decision.md` and is a blocker.

**Priority:** HIGH — no operational workaround for missing contacts during an actual incident.

---

## Runbook Updates Required

| Runbook | Update Needed | Priority | Status |
|---------|--------------|----------|--------|
| `docs/runbooks/backup-restore-runbook.md` | Add pre-restore baseline capture step (patient count + schema_migrations) BEFORE initiating restore | HIGH | Addressed in dr-drill-real-report-2026-05-25.md; runbook itself should be updated |
| `docs/rollout/ubs-001/contatos.md` | Populate with real contact information for all roles | HIGH | PENDING (requires UBS input) |
| `docs/rollout/ubs-001/checklist-pre-rollout.md` | Add EB CLI verification step (`eb status` before deploy) | HIGH | Updated in this batch |
| `docs/rollout/ubs-001/pre-deploy-validation.md` | Add EB CLI verification section | MEDIUM | Updated in this batch |
| `docs/operations/incident-response.md` | Add AWS account emergency access procedure (Gap 1) | MEDIUM | PENDING |
| `docs/rollout/ubs-001/aceite-operacional.md` | Add LGPD anonymization hold clause (KI-02 constraint) | MEDIUM | PENDING |
| `docs/onboarding/first-admin.md` | Clarify break_glass_admin bootstrap procedure for single-tenant pilot | HIGH | PENDING (verify seed script) |

---

## Technical Observations

### Observation 1: Circuit Breaker Surprise Factor

The circuit breaker fail-closed behavior (Scenario A) is likely the first real operational incident VITRAS will experience. Upstash has regional outages; the Brazilian `sa-east-1` Upstash region may be affected by AWS infrastructure events.

When it happens, UBS staff will see all requests fail with 503 — with no indication that the system is healthy and the failure is external. The `/health` endpoint shows `redis: "error"` but staff have no way to check that.

**Recommendation:** Before go-live, communicate to UBS staff: "If the system shows a general error and you receive 'serviço temporariamente indisponível', the issue is likely temporary (< 30 minutes) and related to external rate limiting infrastructure. Clinical sessions can continue on paper."

This pre-empts panic calls and escalations for what is a self-healing failure mode.

### Observation 2: /health vs /readyz Operational Distinction

The distinction between `/health` (informational, always responds if server is alive) and `/readyz` (strict liveness — 200 only when fully ready and postgres ok) is operationally important and NOT intuitive.

Specifically: `/readyz` returning 200 does NOT mean users can access the system if the circuit breaker is OPEN. EB sees the instance as "healthy" while users see 503.

This distinction should be covered in operator training before go-live: "The EB health dashboard showing 'green' does not mean users are unaffected — it only means the instance is alive."

### Observation 3: Migration 009+ Safety

Tabletop Scenario C (Deploy Failed After Migration) revealed that the most complex recovery scenario involves a migration that committed successfully but whose code changes are incompatible with the previous application version.

The current codebase protects against migration 006 being missing (`checkCriticalMigrations()`), but does not prevent future migrations from introducing breaking schema changes.

**Policy recommendation for Sprint 5+:** All new migrations during the pilot period should be additive only (add column, add index, add table). Breaking changes (drop column, rename, change type, add NOT NULL without default) require a multi-phase deploy strategy. This should be documented as a Sprint 5 development guideline.

### Observation 4: Startup Phase Sequence is Well-Documented

The `/health` and `/readyz` endpoint implementations are well-aligned with the documented resilience model:
- Phases: `booting → migrating → warming → ready`
- `/readyz` 503 during all non-ready phases
- `/health` 503 during non-ready phases, 200 (degraded) in degraded mode
- Circuit breaker state correctly reflected in `/health` subsystems
- `auditChain: "unknown"` on startup (populated only after first `/audit-logs/integrity` call) — this is correct and expected behavior, not a bug

No code changes are required based on the tabletop preparation.

---

## Second Lessons Learned (Post-Drill)

> This section is a PLACEHOLDER. Fill after the live DR drill execution.

After executing the actual DR drill against real staging infrastructure:
1. Record actual RTO vs target (< 240 min)
2. Record actual RPO vs target (< 24 hours)
3. Document any unexpected issues during execution
4. Update runbooks where the template differed from reality
5. Create `lessons-learned-drill-v2.md` if findings are substantial

---

*Document version: v1.0 — Created 2026-05-25*
*Status: Initial draft based on document preparation findings. Pending update after live drill execution.*
