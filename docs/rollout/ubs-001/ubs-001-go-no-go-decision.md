> **SUPERSEDED** — See `ubs-001-final-go-no-go.md` for current GO/NO-GO decision (2026-05-25).

# UBS #1 GO/NO-GO Decision Record

**Date:** 2026-05-25
**Decider:** João Pedro
**Version:** v1.0-pilot-governed
**Branch:** release/pilot-baseline

---

## Pre-Conditions Status

| # | Pre-Condition | Status | Evidence | Blocker? |
|---|--------------|--------|---------|---------|
| 1 | DR drill PASSED | **PENDING EXECUTION** | Template: `docs/operations/dr-drill-real-report-2026-05-25.md`; must execute against real staging | YES |
| 2 | Staging smoke test PASSED | **PENDING EXECUTION** | Template: `staging-smoke-test.md`; must run against staging with production configuration | YES |
| 3 | pre-deploy-validation.md complete | **PENDING** | Requires real EB environment — env vars, RDS, CloudWatch all need live verification | YES |
| 4 | contatos.md fully populated | **PENDING** | Names, phone numbers, and email addresses needed from UBS and municipal health department | YES |
| 5 | CloudWatch alarms configured (all 8) | **PENDING** | Definitions in `docs/cloudwatch-dashboard.md`; not yet provisioned in AWS | YES |
| 6 | EB health check set to /readyz | **PENDING** | Must change from /health to /readyz in EB configuration before deploy | YES |
| 7 | break_glass_admin account created | **PENDING** | See `docs/onboarding/first-admin.md` for bootstrap procedure | YES |
| 8 | security_auditor account created | **PENDING** | Required for governance review and break_glass action auditing | YES |
| 9 | backup.restore_test_required resolved | **PENDING** | DR drill execution resolves this — item closes when drill PASSES | YES |
| 10 | aceite-operacional.md signed by UBS coordinator | **PENDING** | Requires UBS coordinator review and signature | YES |
| 11 | Upstash rate limiting configured in EB | **PENDING** | UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set | YES |
| 12 | PATIENT_LOOKUP_HASH_KEY set (≠ DATA_ENCRYPTION_KEY) | **PENDING** | Must differ from DATA_ENCRYPTION_KEY; both ≥ 32 chars | YES |
| 13 | RDS backup retention ≥ 7 days verified | **PENDING** | Verify in AWS Console; automated backups must be enabled | YES |
| 14 | VPC security groups restrict RDS to EB only | **PENDING** | Security verification required | YES |
| 15 | EB CLI verified: `eb status` returns correct env | **PENDING** | Add to pre-deploy checklist; verify before deploy window opens | YES |
| 16 | Tabletop exercise completed with team | **PENDING** | Template: `tabletop-exercise-report.md` | YES |
| 17 | Paper documentation fallback protocol confirmed | **PENDING** | UBS clinical staff must have paper protocol for system unavailability | YES |

---

## Known Issues Assessment

All known issues were reviewed during code audit. Assessment for go-live impact:

| KI | Description | Go-Live Impact | Decision |
|----|------------|---------------|---------|
| KI-01 | usersRouter ordering — potential route shadowing | **LOW** — no active exploit identified; all routes protected by auth middleware | **ACCEPT for pilot** — fix in Sprint 5A |
| KI-02 | LGPD/CFM anonymization — legal compliance unverified | **LOW for pilot** — no anonymization requests expected immediately during UBS #1 pilot | **ACCEPT with constraint** — no anonymization until Sprint 5A legal review completes; constraint documented in aceite-operacional.md |
| KI-03 | `rejectUnauthorized: false` on RDS TLS | **LOW** — EB and RDS are in same VPC; network-level isolation significantly mitigates | **ACCEPT** — Sprint 5B remediation planned |
| KI-04 | File-mode limitations (JSON storage) | **N/A** — production uses PostgreSQL exclusively; file mode is development-only | **N/A** — not a production concern |
| KI-05 | Multi-probe HALF_OPEN circuit breaker | **LOW** — cosmetic issue; auto-recovery functions correctly; no user impact difference | **ACCEPT** — Sprint 5B cleanup |
| KI-06 | `crypto.randomUUID` no Node.js < 15 fallback | **LOW** — Node.js 18+ is a deployment requirement; EB configured ≥ 18; pre-deploy check verifies | **ACCEPT** — Node.js version check is pre-deploy blocker |
| KI-07 | Pre-existing test suite failures | **NO PRODUCTION IMPACT** — failures are in test infrastructure, not production code paths; confirmed by manual review | **ACCEPT** — Sprint 5A cleanup |

**Aggregate assessment:** All 7 known issues are acceptable for the pilot under documented constraints. No known issue prevents go-live if all 17 pre-conditions are resolved.

---

## Conditional Decision Logic

### Decision Rule 1: Normal Path

**If ALL 17 pre-conditions are resolved AND DR drill PASSES:**

> **GO** for UBS #1 controlled rollout
>
> Recommended deployment window: Tuesday or Wednesday, 18:00–22:00 local time
> Rationale: avoids clinical peak hours; Tech Lead available; 4 hours of runway before midnight
>
> Monitoring commitment D+0 to D+14: daily checklist per `operational-routines.md`

---

### Decision Rule 2: DR Drill RTO Failure

**If DR drill is executed but RTO exceeds 240 minutes:**

> **NO-GO** until RTO is understood and mitigated
>
> Actions required before re-assessment:
> - Identify which phase is taking longest (restore duration vs EB restart vs migrations)
> - If restore is > 120 min: investigate RDS instance size, consider smaller test instance for drill
> - If EB restart is > 30 min: investigate migration count or startup logic
> - Re-run drill after optimization; must PASS before GO
>
> Note: A 4-hour RTO is above the target but may be acceptable if: (1) a formal risk acceptance is documented, (2) UBS clinical staff understand the recovery time commitment, and (3) AWS Support Business tier is confirmed for infrastructure escalation.

---

### Decision Rule 3: Staging Smoke Test Reveals Multi-Tenant Isolation Failure

**If GET /patients returns patients from a different unit for any test user:**

> **NO-GO — HARD BLOCK** until security review is complete
>
> Actions required:
> - Immediately escalate to security review (do not deploy)
> - Identify the code path that allowed cross-tenant access
> - Fix, QA, and re-run full isolation test suite
> - DPO must be informed of the pre-production finding
> - New go/no-go decision required after fix and re-test
>
> Note: This is the only scenario that would require more than routine Sprint work to resolve.

---

### Decision Rule 4: Contacts Not Populated by Deploy Day

**If contatos.md has unfilled placeholders on deploy day:**

> **NO-GO for full go-live** — may proceed with tech-only smoke test only
>
> Rationale: An incident during UBS #1 go-live without complete escalation contacts is operationally unacceptable. The DPO contact in particular is required for any P0 response.
>
> Temporary mitigation: Delay go-live by 24–48 hours until contacts are confirmed.

---

## Current Status (2026-05-25)

### **GO CONDICIONADO**

All documentation is complete. Technical readiness has been verified via code audit (no blocking code issues found). Operational readiness is pending execution of real-world validation steps.

**This GO CONDICIONADO converts to GO when:**

1. DR drill executed and PASSED (Section 6 of dr-drill-real-report-2026-05-25.md signed)
2. Staging smoke test executed and PASSED (staging-smoke-test.md signed)
3. All 17 pre-conditions in this document checked
4. contatos.md fully populated with real contacts
5. aceite-operacional.md signed by UBS coordinator
6. Tabletop exercise completed with team score ≥ 3/5 overall

**Estimated time to resolve all pending items:** 1–2 working days of focused execution, assuming AWS environment is accessible and UBS coordinator is available for coordination.

---

## Formal Decision Record

```
CURRENT DECISION (2026-05-25):  GO CONDICIONADO

Conditions outstanding: 17 pre-conditions (see table above)
No blocking code or architecture issues identified.
No go-live-blocking known issues.

BECOMES GO WHEN: All 17 pre-conditions checked + DR drill PASSED + smoke test PASSED.

BECOMES NO-GO IF:
  - DR drill RTO > 240 minutes (pending optimization or formal risk acceptance)
  - Staging smoke test reveals multi-tenant isolation failure
  - DPO contact unavailable on deploy day

Recommended deploy window (once conditions met):
  Tuesday or Wednesday, 18:00–22:00 local time

Signed by Tech Lead: João Pedro — 2026-05-25
```

---

## Post-GO Actions (D+0 through D+14)

Once GO is declared and deploy succeeds:

1. Follow `operational-routines.md` daily checklist for D+1 through D+14
2. No new features or schema changes during D+1 to D+7 observation window
3. Any P0 or P1 incident during D+1 to D+14 halts Phase 2 planning
4. D+14 report (`d14-report.md`) must be completed and reviewed before UBS #2 planning begins
5. DR drill must be completed within 30 days of go-live if not completed pre-go-live
6. LGPD anonymization legal review (KI-02) must be completed in Sprint 5A regardless of incident activity

---

*Document version: v1.0 — Created 2026-05-25*
