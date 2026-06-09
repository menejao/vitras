# UBS #1 GO-LIVE Status Dashboard

**Last updated:** 2026-05-25
**Version:** v1.0-pilot-governed
**Branch:** release/pilot-baseline
**Latest commit:** `7cc7a32 docs(rollout): final DR drill report, smoke test guide, tabletop, go-live checklist, final GO/NO-GO`

---

## TECHNICAL BASELINE: COMPLETE

All 15 technical properties verified via code audit on 2026-05-25. No blocking code issues remain.
Sprints 0–4.1: 100% complete and QA-validated.

Code-verified properties:

| Property | Status | Source |
|----------|--------|--------|
| Startup safety (migrations before listen) | PASS | `server.js`: `runMigrations()` before `app.listen()` |
| /readyz strict liveness gate | PASS | `health.js`: 503 at all non-ready phases; 200 only at `ready` + postgres ok |
| Multi-tenant isolation | PASS | `patients.js`: `canAccessPatient()` enforces `teamId === user.teamId` |
| CPF/CNS masking on all API responses | PASS | `maskSensitivePatientFields` applied on all patient endpoints |
| HMAC hash uniqueness enforcement | PASS | Migration 006: unique index on `cpf_hash` + `cns_hash` |
| Audit chain integrity | PASS | `verifyAuditLogChain` endpoint exposed; `_lastAuditChainStatus` updated |
| Rate limit fail-closed | PASS | `rate-limits.js`: Upstash unavailable in production → 503 |
| Circuit breaker HALF_OPEN fix (Sprint 4.1) | PASS | `rate-limits.js`: probe failure immediately reopens to OPEN |
| Pre-flight anonymization audit (Sprint 4.1) | PASS | `privacy.js`: audit entry before anonymization executes |
| Bootstrap atomicity (Sprint 4.1) | PASS | `admin.js`: unit bootstrap in transaction |
| `validateProductionConfig` | PASS | `startup.js`: called before any DB connections |
| `checkCriticalMigrations` | PASS | `server.js`: fatal guard for migration 006 before accepting traffic |
| Schema `.strict()` mass-assignment prevention | PASS | `schemas.js`: unknown fields rejected at validation |
| Clinical snapshots on prescriptions | PASS | `patients.js`: medication snapshot captured at prescription time |
| Degraded mode clearable (Sprint 4.1) | PASS | `runtime-state.js` + `/admin/system/clear-degraded` endpoint |

**Migration count (code-verified):** 8 migrations registered in `backend/src/migrations/index.js` (001–008).

---

## OPERATIONAL READINESS

### Phase 0 — Pre-requisites

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 0.1 | break_glass_admin created | PENDING | João Pedro | Via `provision-remote-enterprise-user.mjs`; requires live EB + DB |
| 0.2 | security_auditor created | PENDING | João Pedro | Strongly recommended; required for audit export |
| 0.3 | EB health check = /readyz | PENDING | João Pedro | AWS Console: EB → Configuration → Load Balancer → /readyz |
| 0.4 | All EB env vars validated | PENDING | João Pedro | See `checklist-pre-rollout.md`; 12 vars required |
| 0.5 | CloudWatch alarms (8) configured | PENDING | João Pedro | See `cloudwatch-alarm-setup.md`; ~3–5h |
| 0.6 | CloudWatch log group receiving logs | PENDING | João Pedro | Log group: `/aws/elasticbeanstalk/vitras-prod/var/log/nodejs/nodejs.log` |
| 0.7 | DR drill EXECUTED + PASSED | DONE 2026-06-09 | João Pedro | PITR real executado (vitras-pitr-202606092005). RTO=100min RPO=5min. Ambos PASS. |
| 0.8 | Staging smoke test EXECUTED + PASSED (44 tests) | PENDING | João Pedro | Any Category 4 failure = NO-GO hard block |
| 0.9 | contatos.md fully populated | PENDING | João Pedro + UBS | All [fill] placeholders replaced; DPO + Medical Director + TI Prefeitura |
| 0.10 | Tabletop conducted with team | PENDING | João Pedro + team | 2h session; score ≥ 3/5 |
| 0.11 | RDS backup retention ≥ 7 days verified | PENDING | João Pedro | AWS Console → RDS → Maintenance & Backups |
| 0.12 | VPC security groups verify RDS = EB only | PENDING | João Pedro | KI-03 mitigation depends on VPC isolation |
| 0.13 | aceite-operacional.md signed by UBS coordinator | PENDING | UBS Coordinator | Requires coordination with UBS |
| 0.14 | Paper documentation fallback confirmed with UBS | PENDING | UBS Coordinator | Critical for Scenario A (Redis outage) |
| 0.15 | EB CLI pre-configured and `eb status` verified | PENDING | João Pedro | Gap 2 from lessons-learned; run before any deploy window |

### Phase 1 — T-3 Days

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 1.1 | pre-deploy-validation.md signed | PENDING | João Pedro | After all Phase 0 items resolved |
| 1.2 | Staging re-validation (5 tests) | PENDING | João Pedro | /readyz, /health, login, patients, audit-logs |
| 1.3 | UBS coordinator T-3 day notification | PENDING | João Pedro | Template in `plano-comunicacao.md` |
| 1.4 | Team briefed on deploy-day roles | PENDING | João Pedro | Tech Lead, UBS Coordinator, TI Prefeitura roles defined |

### Phase 2 — T-0 Deploy Day

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 2.1 | Pre-deploy gate passed (T-1h) | PENDING | João Pedro | eb status Green, RDS snapshot taken |
| 2.2 | Deploy executed | PENDING | João Pedro | `eb deploy --version v1.0-pilot-governed` |
| 2.3 | /readyz 200 confirmed (≤ T+15min) | PENDING | João Pedro | Record exact time |
| 2.4 | server_started log in CloudWatch verified | PENDING | João Pedro | driver=postgres, version=v1.0-pilot-governed |
| 2.5 | Migration count = 8 in schema_migrations | PENDING | João Pedro | SQL: `SELECT COUNT(*) FROM schema_migrations` |
| 2.6 | /health subsystems all ok | PENDING | João Pedro | postgres ok, redis ok, migrations ok |
| 2.7 | break_glass_admin login succeeded | PENDING | João Pedro | Token obtained; stored for bootstrap step |
| 2.8 | Unit bootstrap executed (POST /admin/units/bootstrap) | PENDING | João Pedro | Record unitId |
| 2.9 | Smoke test: patient created, audit log confirmed | PENDING | João Pedro | CPF masked; audit entries visible |
| 2.10 | T+30min GO/NO-GO gate | PENDING | João Pedro | Zero 5xx, zero alarms, all checks pass |
| 2.11 | GO declared | PENDING | João Pedro | Record GO time UTC |
| 2.12 | UBS coordinator GO notification | PENDING | João Pedro | Template in `plano-comunicacao.md` |

### Phase 3 — D+1 to D+14

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 3.1 | d0-go-live-report.md completed | PENDING | João Pedro | During T+1 to T+4h window |
| 3.2 | d1-report.md completed | PENDING | João Pedro | D+1 morning |
| 3.3 | First real patient registered (UBS staff) | PENDING | UBS | Confirm with coordinator |
| 3.4 | d7-report.md completed | PENDING | João Pedro | D+7 |
| 3.5 | d14-report.md completed | PENDING | João Pedro | D+14 — required before UBS #2 planning |

---

## KNOWN ISSUES — ALL ACCEPTED FOR PILOT

Per `ubs-001-final-go-no-go.md` — all 7 known issues accepted with explicit mitigations:

| KI | Severity | Accepted | Constraint |
|----|----------|---------|------------|
| KI-01: usersRouter ordering | MEDIUM | YES | All routes verified to have inline auth; Sprint 5A refactor |
| KI-02: LGPD anonymization legal compliance | HIGH | YES | Anonymization endpoint LOCKED — no use until Sprint 5A legal review |
| KI-03: `rejectUnauthorized: false` on RDS TLS | MEDIUM | YES | VPC isolation mitigates; VPC SGs must be verified (item 0.12) |
| KI-04: File-mode limitations | N/A | N/A | Production uses PostgreSQL exclusively |
| KI-05: Multi-probe HALF_OPEN circuit breaker | LOW | YES | Cosmetic; single probe fix confirmed in Sprint 4.1 |
| KI-06: `crypto.randomUUID` no fallback for Node <15 | LOW | YES | Node.js ≥18 required; verify in EB config |
| KI-07: Pre-existing test failures | LOW | YES | Test infra failures only; no production code path affected |

---

## BLOCKING CONDITIONS

### Hard Blocks (NO-GO regardless of other status):

1. **DR drill not executed or FAILED** — cannot proceed without PASSED drill
2. **Staging smoke test not executed, or any Category 4 (multi-tenant) failure** — security review required before any production deploy
3. **break_glass_admin does not exist** — cannot bootstrap UBS unit or manage user access on deploy day
4. **EB health check is not /readyz** — EB may route traffic before server is ready
5. **contatos.md has placeholders** — operators have no escalation contacts during a P0 incident
6. **aceite-operacional.md not signed** — no formal operational acceptance from UBS coordinator

### Conditional GO (acceptable to proceed with compensating controls):

| Condition | Decision |
|-----------|---------|
| CloudWatch alarms not receiving logs by T-0 | GO CONDICIONADO — deploy with manual monitoring commitment D+0 to D+7 |
| Tabletop score < 3/5 in one scenario (not overall) | GO with documented gap and mitigation |
| security_auditor not created | GO — strongly not recommended, but not a hard blocker |

---

## FORMAL STATUS: GO CONDICIONADO

**Technical verdict:** PASS — 15/15 code-verified properties confirmed.

**Operational verdict:** GO CONDICIONADO — becomes unconditional GO when all 15 Phase 0 items are resolved.

**Blocking count:** 0 code blockers. 15 operational items pending. 6 are hard blocks.

**No new code changes required.** All remaining work is operational/infrastructure.

---

## ESTIMATED TIME TO COMPLETE ALL PENDING ITEMS

| Category | Items | Estimated Effort |
|----------|-------|-----------------|
| AWS infrastructure (alarms, log group, health check, VPC SGs) | 0.3, 0.5, 0.6, 0.12 | 4–6h |
| EB environment variables validation | 0.4 | 1h |
| Account provisioning (BGA + auditor) | 0.1, 0.2 | 1h |
| DR drill execution (against staging) | 0.7 | 3–4h |
| Staging smoke test (44 tests) | 0.8 | 2h |
| Documentation (contatos.md, tabletop, aceite, paper protocol) | 0.9, 0.10, 0.13, 0.14 | 3–4h (requires coordination with UBS) |
| RDS backup + EB CLI verification | 0.11, 0.15 | 1h |
| Phase 1 (T-3 days) | 1.1–1.4 | 2h |
| Deploy day (Phase 2) | 2.1–2.12 | 3–4h |
| **Total** | **All** | **~20–25h over ~1–2 weeks** |

**Coordination bottleneck:** Items 0.9 (contatos.md), 0.10 (tabletop), 0.13 (aceite), 0.14 (paper protocol) all require scheduling time with UBS coordinator and/or TI Prefeitura. This is the longest lead-time dependency.

---

## GO-LIVE WINDOW RECOMMENDATION

**Earliest realistic window:** 1–2 weeks from today (2026-05-25), subject to:
1. UBS coordinator availability for tabletop session (0.10) and aceite signature (0.13)
2. Access to real AWS staging for DR drill + smoke test (0.7, 0.8)
3. CloudWatch alarm setup (0.5, 0.6)

**Recommended deploy day/time:** Tuesday or Wednesday, 18:00–22:00 local (BRT). Rationale:
- Avoids clinical peak hours (08:00–17:00)
- 4-hour runway before midnight
- Full D+1 to D+14 observation on weekdays
- Tech Lead and UBS coordinator are available

**Scheduling constraint:** Do not schedule go-live until DR drill result is PASSED. The drill result determines whether there are any infrastructure surprises that need resolving first.

---

## OPEN GAPS FROM LESSONS LEARNED

| Gap | Status | Pre-Go-Live Action |
|-----|--------|-------------------|
| Gap 1: No AWS backup operator documented | OPEN | Add backup AWS IAM admin to `contatos.md`; store MFA recovery codes in vault |
| Gap 3: No read-only fallback during Redis outage | OPEN (Sprint 5B feature) | Brief UBS staff on paper fallback before go-live |
| Gap 4: Anonymization not legally validated | OPEN (Sprint 5A legal review) | KI-02 constraint enforced: no anonymization until legal review |
| Gap 7: contatos.md has placeholders | OPEN | Item 0.9 — requires UBS input |

---

*Document version: v1.0 — Created 2026-05-25*
*Status: Living document — update as each item is completed*
*Authority: This document supersedes individual checklist files for status tracking*
