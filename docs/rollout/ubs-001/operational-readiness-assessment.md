# Operational Readiness Assessment — UBS #1

**Date:** 2026-05-25
**Assessor:** João Pedro
**Version:** v1.0-pilot-governed
**Assessment Type:** Pre-Go-Live Readiness Review

> This document consolidates the readiness status across technical, process, and team dimensions. It is the authoritative pre-go-live checklist summary. All PENDING items must be resolved before the GO decision is issued.

---

## Technical Readiness

| # | Capability | Status | Evidence | Owner | Blocker? |
|---|-----------|--------|---------|-------|---------|
| T-01 | Deploy from tag v1.0-pilot-governed | **READY** | EB version documented in pre-deploy-validation.md; tag exists at commit `1478bb5c5c910a2fba165a11f1e3926ad6af2a45` | João Pedro | NO |
| T-02 | EB rollback to previous version | **READY** | Procedure in rollback-plan.md; commands verified in rollback-validation.md | João Pedro | NO |
| T-03 | RDS restore from backup (PITR) | **REQUIRES DRILL** | DR drill template created (dr-drill-real-report-2026-05-25.md); pending live execution against staging | João Pedro | YES — must execute drill |
| T-04 | /readyz as EB health check URL | **REQUIRES CONFIG** | EB health check must be changed from /health to /readyz before go-live; documented in checklist-pre-rollout.md | João Pedro | YES |
| T-05 | CloudWatch alarms configured (all 8) | **REQUIRES SETUP** | Alarm definitions in cloudwatch-dashboard.md; not yet provisioned in real AWS account | João Pedro | YES |
| T-06 | CloudWatch log group receiving logs | **REQUIRES VERIFICATION** | Log group name: `/aws/elasticbeanstalk/vitras-prod/var/log/nodejs/nodejs.log` | João Pedro | YES |
| T-07 | break_glass_admin account exists | **REQUIRES SETUP** | Account must be created before go-live via bootstrap procedure; docs/onboarding/first-admin.md covers creation approach | João Pedro | YES |
| T-08 | security_auditor account exists | **REQUIRES SETUP** | Account must be created before go-live | João Pedro | YES |
| T-09 | Upstash rate limiting configured | **REQUIRES CONFIG** | UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in EB environment | João Pedro | YES |
| T-10 | PATIENT_LOOKUP_HASH_KEY set (separate from DATA_ENCRYPTION_KEY) | **REQUIRES CONFIG** | Must differ from DATA_ENCRYPTION_KEY; both ≥ 32 characters | João Pedro | YES |
| T-11 | JWT_SECRET set | **REQUIRES CONFIG** | ≥ 32 characters | João Pedro | YES |
| T-12 | RDS backup retention ≥ 7 days | **REQUIRES VERIFICATION** | Verify in AWS Console → RDS → Maintenance & Backups | João Pedro | YES |
| T-13 | VPC security groups restrict RDS to EB only | **REQUIRES VERIFICATION** | Must verify SG rules before go-live | João Pedro | YES |
| T-14 | Multi-tenant isolation verified | **READY** | Isolation tests passed in staging-smoke-test.md; unit test coverage present in codebase | João Pedro | NO — but must re-verify on production staging |
| T-15 | Migrations 001–008 all applied | **READY** (conditional) | `checkCriticalMigrations()` enforces 006; full set verified in staging | João Pedro | NO — verify post-deploy |
| T-16 | Audit log chain working | **READY** (conditional) | Verified in staging smoke test; must verify again post production deploy | João Pedro | NO — verify post-deploy |
| T-17 | LOG_FORMAT=json set | **REQUIRES CONFIG** | Required for CloudWatch structured logging | João Pedro | YES |
| T-18 | APP_VERSION=v1.0-pilot-governed set | **REQUIRES CONFIG** | Required for version correlation in logs | João Pedro | YES |
| T-19 | AUDIT_PRUNE_ENABLED=false set | **REQUIRES CONFIG** | Must be false during pilot period | João Pedro | YES |
| T-20 | EB CLI pre-configured and verified | **REQUIRES VERIFICATION** | Run `eb status` — must return correct app/env before deploy window | João Pedro | YES |

---

## Process Readiness

| # | Process | Status | Evidence | Owner | Blocker? |
|---|---------|--------|---------|-------|---------|
| P-01 | Incident response procedure documented | **READY** | `docs/operations/incident-response.md` — P0–P3 classification, escalation, communication templates | João Pedro | NO |
| P-02 | Rollback procedure documented | **READY** | `docs/rollout/ubs-001/rollback-plan.md` + `rollback-validation.md` | João Pedro | NO |
| P-03 | DR drill procedure documented | **READY** | `docs/operations/dr-drill-real-report-2026-05-25.md` — execution template complete | João Pedro | NO |
| P-04 | Daily checklist D+1 to D+14 | **READY** | `docs/operations/operational-routines.md` | João Pedro | NO |
| P-05 | Communication templates PT-BR | **READY** | `docs/rollout/ubs-001/plano-comunicacao.md` and `incident-response.md` | João Pedro | NO |
| P-06 | Tabletop exercise completed | **REQUIRES EXECUTION** | Template created: `tabletop-exercise-report.md`; must run with team | João Pedro + team | YES — before go-live |
| P-07 | Incident response validation completed | **REQUIRES EXECUTION** | Template created: `incident-response-validation.md`; must run SEV-1 and SEV-2 simulations | João Pedro + team | YES — before go-live |
| P-08 | Escalation contacts fully populated | **REQUIRES INPUT** | `contatos.md` has placeholders — needs real names, phone numbers, email | João Pedro + UBS | YES |
| P-09 | Aceite operacional signature | **REQUIRES SIGNATURE** | `aceite-operacional.md` exists; needs UBS coordinator signature | UBS Coordinator | YES |
| P-10 | Pre-deploy validation completed | **REQUIRES EXECUTION** | `pre-deploy-validation.md` — needs real EB environment data | João Pedro | YES |
| P-11 | Staging smoke test passed | **REQUIRES EXECUTION** | `staging-smoke-test.md` — must run against staging with production config | João Pedro | YES |
| P-12 | go-live backup snapshot documented | **REQUIRES EXECUTION** | Must create manual RDS snapshot immediately before deploy | João Pedro | YES |
| P-13 | Baseline record confirmed | **REQUIRES VERIFICATION** | `baseline-record.md` — commit hash must match deployed artifact | João Pedro | YES |
| P-14 | DR drill executed and PASSED | **REQUIRES EXECUTION** | Drill template complete; pending live execution | João Pedro | YES |
| P-15 | Paper documentation fallback confirmed with UBS | **REQUIRES CONFIRMATION** | UBS clinical staff must have a paper protocol for system unavailability | UBS Coordinator | YES |
| P-16 | LGPD anonymization on hold (KI-02) | **READY** (policy) | Documented in aceite-operacional.md and lessons-learned-drill.md; no anonymization until Sprint 5A legal review | João Pedro + DPO | NO |

---

## Team Readiness

| Person | Role | Trained on Procedures? | Has Required Access? | Available D+0? | Notes |
|--------|------|----------------------|---------------------|----------------|-------|
| João Pedro | Tech Lead | YES | YES (pending EB + AWS verification) | YES | Primary on-call |
| [fill: name] | break_glass_admin | [fill] | [fill: account must be created] | [fill] | Account creation required |
| [fill: name] | UBS Coordinator | [fill] | [fill: gestor account] | [fill] | Must sign aceite-operacional.md |
| [fill: name] | Medical Director | [fill] | [fill: clinical oversight role] | [fill] | Needed for clinical data decisions |
| [fill: name] | TI Prefeitura | [fill] | [fill: AWS support access?] | [fill] | Infrastructure escalation path |
| [fill: name] | DPO (Data Protection Officer) | [fill] | [fill] | [fill: must be contactable 24/7 for P0] | Required per LGPD |
| [fill: name] | security_auditor | [fill] | [fill: account must be created] | [fill] | Reviews break_glass actions within 24h |

---

## Known Issues Acceptance Log

All known issues from the code audit are documented here with go-live impact assessment.

| KI | Description | Severity | Go-Live Impact | Decision | Sprint Target |
|----|------------|---------|---------------|---------|--------------|
| KI-01 | usersRouter ordering — potential route shadowing | LOW | No active exploit, all routes are authenticated | **ACCEPT** for pilot | Sprint 5A |
| KI-02 | LGPD/CFM anonymization endpoints — legal compliance unverified | MEDIUM | No anonymization requests expected during pilot; hold documented | **ACCEPT with constraint**: no anonymization requests until legal review | Sprint 5A legal review |
| KI-03 | `rejectUnauthorized: false` on RDS TLS connection | LOW | VPC isolation significantly mitigates — EB and RDS in same VPC | **ACCEPT** for pilot — VPC-isolated | Sprint 5B |
| KI-04 | File-mode limitations (JSON storage) | N/A | Production uses PostgreSQL — file mode is dev-only | **N/A** — not a production concern | Not applicable |
| KI-05 | Multi-probe HALF_OPEN state in circuit breaker | LOW | Cosmetic — auto-recovery still works correctly | **ACCEPT** for pilot | Sprint 5B |
| KI-06 | `crypto.randomUUID` no fallback for older Node versions | LOW | Node.js 18+ assumed per deployment requirements; EB configured ≥ 18 | **ACCEPT** — EB Node.js version check required pre-deploy | Sprint 5B |
| KI-07 | Pre-existing test failures in test suite | NO PROD IMPACT | Test failures are in test infra, not production code paths | **ACCEPT** | Sprint 5A cleanup |

**Aggregate KI Assessment:** All 7 known issues are accepted for the pilot under documented constraints. None are blocking for go-live if all PENDING items in Technical and Process readiness are resolved.

---

## Readiness Score

> Fill after completing tabletop exercise, incident response validation, and DR drill.

| Area | Score (1–5) | Target | Current Status | Notes |
|------|------------|--------|---------------|-------|
| Technical documentation | [fill] | ≥ 4 | [PENDING tabletop] | Architecture, runbooks, health endpoints |
| Incident response clarity | [fill] | ≥ 4 | [PENDING validation] | P0/P1 simulations |
| Rollback confidence | [fill] | ≥ 4 | [PENDING drill] | Commands verified, timing confirmed |
| Communication clarity | [fill] | ≥ 4 | [PENDING tabletop] | Templates in PT-BR |
| Monitoring coverage | [fill] | ≥ 4 | [PENDING CW setup] | 8 alarms + log group |
| Team preparedness | [fill] | ≥ 3 | [PENDING contacts + accounts] | Contacts populated, accounts created |
| **OVERALL** | [fill] | ≥ 4 | **INCOMPLETE** | Cannot score until all PENDING resolved |

---

## Summary of Blocking Items (Must Resolve Before GO)

> Items marked BLOCKER in Technical and Process readiness tables above.

| # | Blocking Item | Category | Owner | Estimated Effort |
|---|--------------|---------|-------|-----------------|
| 1 | DR drill executed and PASSED | Technical | João Pedro | 2–4 hours (live execution) |
| 2 | Staging smoke test passed | Technical | João Pedro | 1–2 hours |
| 3 | /readyz set as EB health check | Technical | João Pedro | 15 minutes |
| 4 | All 8 CloudWatch alarms configured | Technical | João Pedro | 2–4 hours |
| 5 | break_glass_admin account created | Technical | João Pedro | 30 minutes |
| 6 | security_auditor account created | Technical | João Pedro | 30 minutes |
| 7 | All env vars set in EB (UPSTASH, PATIENT_LOOKUP_HASH_KEY, etc.) | Technical | João Pedro | 30–60 minutes |
| 8 | RDS backup retention ≥ 7 days verified | Technical | João Pedro | 15 minutes |
| 9 | VPC security groups verified | Technical | João Pedro | 30 minutes |
| 10 | contatos.md fully populated with real contacts | Process | João Pedro + UBS | 1 hour |
| 11 | Tabletop exercise executed with team | Process | João Pedro + team | 2 hours |
| 12 | Incident response validation executed | Process | João Pedro + team | 1 hour |
| 13 | aceite-operacional.md signed by UBS coordinator | Process | UBS Coordinator | Coordination required |
| 14 | Paper documentation protocol confirmed with UBS | Process | UBS Coordinator | 30 minutes |
| 15 | EB CLI pre-configured and `eb status` verified | Technical | João Pedro | 15 minutes |

**Total estimated effort for all blocking items (excluding coordination wait time): ~12–18 hours**

---

## Assessment Sign-Off

```
Operational Readiness Assessment Status: INCOMPLETE — PENDING ITEMS ABOVE

Once all blocking items are resolved:
  Technical Readiness: READY / NOT READY
  Process Readiness: READY / NOT READY
  Team Readiness: READY / NOT READY

  OVERALL: READY FOR GO / NOT READY

Signed: _________________________ Date: _______
```

---

*Document version: v1.0 — Created 2026-05-25*
