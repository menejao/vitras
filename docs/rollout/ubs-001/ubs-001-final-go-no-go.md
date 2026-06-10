# UBS #1 Final GO/NO-GO Decision

**Date:** 2026-05-25
**Version:** v1.0-pilot-governed (tag: 81a704d, branch: release/pilot-baseline)
**Decision Authority:** João Pedro (Tech Lead)
**Supersedes:** `ubs-001-go-no-go-decision.md`

---

## Technical Baseline Assessment (Code-Verified)

All items below were verified by direct code inspection on 2026-05-25. No live infrastructure required for these assessments.

| System | Status | Verified Via |
|--------|--------|-------------|
| Startup safety (migrations before listen) | PASS | `server.js`: `runMigrations()` called before `app.listen()` — migrations complete or fatal before any traffic |
| /readyz readiness gate | PASS | `health.js`: returns 503 during all non-ready phases; 200 only when `readiness.ready=true` AND postgres reachable |
| Multi-tenant isolation (gestor/ACS) | PASS | `patients.js` + `helpers.js`: `canAccessPatient()` enforces `patient.teamId === user.teamId` for all roles |
| CPF/CNS masking in API responses | PASS | `maskSensitivePatientFields` applied on all patient endpoints — CPF returned as `***.***.***-**` |
| HMAC hash uniqueness enforcement | PASS | Migration 006 (`006_patient_hash_columns`) adds unique index on `cpf_hash` + `cns_hash` |
| Audit chain integrity | PASS | `verifyAuditLogChain` endpoint exposed; `_lastAuditChainStatus` updated in `health.js` after integrity call |
| Rate limit fail-closed | PASS | `rate-limits.js`: Upstash unavailable in production → 503 (not pass-through) |
| Circuit breaker HALF_OPEN fixed (Sprint 4.1) | PASS | `rate-limits.js`: HALF_OPEN probe failure immediately reopens to OPEN state (`_cbState = "OPEN"`) |
| Pre-flight anonymization audit (Sprint 4.1) | PASS | `privacy.js`: audit entry written before anonymization executes |
| Bootstrap atomicity (Sprint 4.1) | PASS | `admin.js`: unit bootstrap wrapped in transaction — partial state not possible |
| `validateProductionConfig` | PASS | `startup.js`: called at top of `startServer()` before any DB connections |
| `checkCriticalMigrations` | PASS | `server.js`: fatal guard verifies migration `006_patient_hash_columns` applied before accepting traffic |
| Schema `.strict()` mass-assignment prevention | PASS | `schemas.js`: `.strict()` on all Zod input schemas — unknown fields rejected at validation |
| Clinical snapshots on prescriptions | PASS | `patients.js`: medication/dosage snapshot captured at prescription time — not resolved lazily |
| Degraded mode clearable (Sprint 4.1) | PASS | `runtime-state.js` `clearDegraded()` + `admin.js` `/admin/system/clear-degraded` endpoint |

**Migration count (code-verified):** 8 migrations registered in `backend/src/migrations/index.js` (001–008).

**Critical migration guard:** `checkCriticalMigrations()` verifies `006_patient_hash_columns` is applied before `app.listen()`. Boot aborts with `startup.failed` log event if missing.

**Startup phase sequence (code-verified):** `booting → migrating → warming → ready`
- `/readyz` returns 503 at all phases except `ready`
- `/health` returns 503 at non-ready phases; 200 (with `status: "degraded"`) in degraded mode

---

## Known Issues — Accepted for Pilot

| Issue | Severity | Accepted? | Mitigation | Sprint Target |
|-------|----------|-----------|-----------|--------------|
| KI-01: `usersRouter` registered before `requireAuth` in route order | MEDIUM | ACCEPTED | All individual routes verified to have inline auth middleware; no public route gap found | Sprint 5A refactor |
| KI-02: LGPD/CFM anonymization legal compliance unverified | HIGH | ACCEPTED with constraint | Anonymization endpoint LOCKED — no use until Sprint 5A legal review completes. Escalation path documented in `tabletop-final-report.md` Scenario E. | Sprint 5A legal review |
| KI-03: `rejectUnauthorized: false` on RDS TLS | MEDIUM | ACCEPTED | VPC isolation: EB and RDS in same VPC — no public network path. Constraint: VPC security groups must be verified pre-go-live (T-7 checklist). | Sprint 5B |
| KI-04: File-mode limitations (JSON storage) | N/A | N/A | Production uses PostgreSQL exclusively. File mode is dev-only. | Not applicable |
| KI-05: Multi-probe HALF_OPEN circuit breaker | LOW | ACCEPTED | Cosmetic only — auto-recovery path still correct. Single probe Sprint 4.1 fix confirmed in code. | Sprint 5B |
| KI-06: `crypto.randomUUID` no Node.js <15 fallback | LOW | ACCEPTED | Node.js ≥18 is a deployment requirement. EB Node version verified in T-7 checklist. | Sprint 5B |
| KI-07: Pre-existing test failures | LOW | ACCEPTED | Test infrastructure failures only — no production code path affected. Manual review confirmed. | Sprint 5A cleanup |

---

## Operational Pre-Conditions Status

| # | Pre-Condition | Status | Blocking? |
|---|--------------|--------|-----------|
| 1 | DR drill executed and PASSED (RTO ≤ 240 min, RPO ≤ 24h) | PENDING LIVE EXECUTION | YES |
| 2 | Staging smoke test PASSED (zero critical failures) | PENDING LIVE EXECUTION | YES |
| 3 | Tabletop exercise conducted with team (score ≥ 3/5) | PENDING | YES |
| 4 | `contatos.md` fully populated (all placeholders replaced) | PENDING | YES |
| 5 | All 8 CloudWatch alarms configured and active | PENDING | YES |
| 6 | EB health check URL = /readyz (not /health) | PENDING | YES |
| 7 | break_glass_admin account created and credentials in secure vault | PENDING | YES |
| 8 | `aceite-operacional.md` signed by UBS coordinator | PENDING | YES |
| 9 | RDS backup retention ≥ 7 days confirmed | PENDING | YES |
| 10 | `pre-deploy-validation.md` completed and signed | PENDING | YES |

Additional pre-conditions from `ubs-001-go-no-go-decision.md` (items 11–17):
| # | Pre-Condition | Status |
|---|--------------|--------|
| 11 | Upstash rate limiting configured in EB | PENDING |
| 12 | PATIENT_LOOKUP_HASH_KEY set (≠ DATA_ENCRYPTION_KEY, ≥ 32 chars) | PENDING |
| 13 | VPC security groups restrict RDS to EB only | PENDING |
| 14 | EB CLI verified: `eb status` returns correct env | PENDING |
| 15 | Paper documentation fallback protocol confirmed with UBS | PENDING |
| 16 | Security_auditor account created | PENDING |
| 17 | AWS account emergency access escalation documented (Gap 1 from lessons-learned-drill.md) | PENDING |

---

## Conditional Decision Rules

| Condition | Decision |
|-----------|---------|
| All 10 primary pre-conditions resolved | → GO (unconditional) |
| DR drill fails: RTO > 240 minutes | → NO-GO until mitigation documented and re-drill passes |
| Smoke test: any multi-tenant isolation failure (Category 4) | → NO-GO HARD BLOCK — security review before any deploy; DPO notification |
| Smoke test: any CPF/CNS value exposed unmasked | → NO-GO HARD BLOCK — privacy breach investigation |
| break_glass_admin login fails at T-0 | → NO-GO — bootstrap must work before user data can be managed |
| CloudWatch alarms not receiving logs by T-0 | → GO CONDICIONADO — deploy with manual monitoring commitment D+0 to D+7 |
| `contatos.md` unpopulated on deploy day | → NO-GO for full go-live; tech-only smoke test only |

---

## Final Verdict

**CURRENT STATUS: GO CONDICIONADO**

**Rationale:**

Technical baseline is sound. 15 critical security and reliability properties were verified via code audit across Sprints 0–4.1. The codebase is production-ready in terms of:
- Startup safety (no race condition between migrations and traffic)
- Multi-tenant data isolation enforced at route + service layer
- Privacy controls (CPF/CNS masking on all API responses)
- Audit trail integrity (HMAC chain, security_auditor review path)
- Rate limit infrastructure with fail-closed circuit breaker
- Degraded mode management (clearable, does not cause false EB unhealthy)
- Critical migration guard (prevents boot on missing schema)

All 7 known issues are accepted with explicit mitigation. No blocking code or architecture issue remains.

The single previously-blocking gap (break_glass_admin bootstrap script) is CLOSED — `backend/scripts/provision-remote-enterprise-user.mjs` confirmed.

**This GO CONDICIONADO becomes unconditional GO when all 10 primary pre-conditions are resolved.**

---

## Rollout Recommendation

Execute in this order:

1. **This week:** Schedule DR drill against real staging environment
   - Same session: execute staging smoke test immediately after DR drill
   - Estimated: half-day of focused work

2. **This week:** Conduct tabletop exercise with UBS coordinator and TI Prefeitura representative
   - Use `tabletop-final-report.md` as the guide
   - Estimated: 2 hours

3. **Resolve all PENDING items** in `final-go-live-checklist.md` T-7 section
   - Estimated total effort: 12–18 hours (excluding coordination wait time)

4. **Populate `contatos.md`** — requires UBS coordinator, Medical Director, TI Prefeitura, DPO contacts
   - Must be completed before any drill or deploy

5. **Set go-live window** for a Tuesday or Wednesday, 18:00–22:00 local time
   - Avoids clinical peak hours
   - 4 hours of runway before midnight
   - Tech Lead available and uninterrupted

6. **Execute `final-go-live-checklist.md`** T-3 → T-1 → T-0 sections in order

---

## Sign-Off

```
Status:             GO CONDICIONADO
Technical verdict:  PASS (15/15 code-verified properties)
Outstanding items:  10 primary pre-conditions (all infrastructure/operational — no code changes)

Signed: João Pedro — 2026-05-25

BECOMES GO WHEN: All 10 primary pre-conditions resolved
                 + DR drill PASSED
                 + Staging smoke test PASSED
```

---

*Document version: v1.0-final — Created 2026-05-25*
*Supersedes: `ubs-001-go-no-go-decision.md`*
