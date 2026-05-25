# VITRAS Controlled Multi-UBS Rollout Plan

> **Version:** v1.0-pilot-governed
> **Date:** 2026-05-25
> **Principle:** Stability > features. No UBS #2 until UBS #1 is confirmed stable.

---

## Phase 1: UBS Pilot #1 (Week 1–4)

### Pre-deployment Checklist

Infrastructure:
- [ ] AWS RDS automated backups enabled (7-day minimum retention)
- [ ] CloudWatch alarms configured per `docs/cloudwatch-dashboard.md`
- [ ] EB environment health checks configured (HTTP /readyz, 200 = healthy)
- [ ] VPC security groups restrict RDS to EB instances only

Environment Variables:
- [ ] `PATIENT_LOOKUP_HASH_KEY` set in EB environment (>= 32 chars, separate from DATA_ENCRYPTION_KEY)
- [ ] `DATA_ENCRYPTION_KEY` set (>= 32 chars)
- [ ] `JWT_SECRET` set (>= 32 chars)
- [ ] `FRONTEND_ORIGINS` set to production domain
- [ ] `DATABASE_URL` set and points to correct RDS instance
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set (rate limiting)
- [ ] `NODE_ENV=production` set

Post-deploy Verification:
- [ ] Migration 001–008 verified in `schema_migrations` table post-deploy
- [ ] `GET /readyz` returns 200 after first deploy
- [ ] `GET /health` shows `postgres: ok`, `redis: ok` (or `unknown` if Upstash not configured)
- [ ] No `startup.failed` or `migrations.failed_fatal` in CloudWatch logs

Unit Bootstrap:
- [ ] `POST /admin/units/bootstrap` executed for UBS #1 (break_glass_admin)
- [ ] Gestor account created with correct `unitId`
- [ ] Team(s) created with correct `unitId`
- [ ] Break glass admin credentials stored in secure vault (not shared)

Isolation Tests:
- [ ] Isolation test: gestor cannot see patients from other units
- [ ] Auth test: ACS cannot access cross-team patients
- [ ] Role test: gestor cannot access admin endpoints
- [ ] Clinical staff can create patient, appointment, clinical record successfully

Acceptance:
- [ ] Acceptance sign-off: UBS coordinator
- [ ] Acceptance sign-off: technical lead

---

### Go-live Criteria (all must be true before clinical use begins)

- `GET /readyz` returns 200 consistently for 30 minutes post-deploy
- `GET /health` shows `postgres: ok`, `redis: ok` (or acceptable degraded state documented)
- No 5xx errors in first 30 minutes of non-clinical test traffic
- Audit logs recording correctly (verified via `GET /audit-logs` — break_glass_admin or security_auditor)
- End-to-end test: at least 1 patient created, 1 appointment created, 1 clinical record created successfully
- Backup retention verified in AWS Console (RDS > Maintenance & backups)
- All pre-deployment checklist items checked

---

### Observation Period: 2 weeks minimum before UBS #2

- Daily operational checklist followed (see `docs/operations/operational-routines.md`)
- CloudWatch alarm review daily
- Any incident documented in operational log
- Any P0 or P1 incident halts Phase 2 until fully resolved and lessons learned documented

---

### Rollback Criteria (UBS #1)

Immediate rollback if any of the following:
- More than 3 critical incidents in first week
- Data integrity issue (audit chain broken, hash uniqueness failure)
- Any confirmed cross-tenant data leak detected
- EB health checks failing >5 minutes
- CPF/CNS exposed in any API response

---

### Rollback Procedure

1. Technical Lead declares rollback decision
2. Notify UBS coordinator: "Sistema em manutenção emergencial. Previsão: [X horas]."
3. Restore RDS from last verified backup (see `docs/runbooks/backup-restore-runbook.md` → RUNBOOK_BACKUP_RESTORE.md)
4. Point EB environment to previous application version
5. Verify `GET /readyz` returns 200 on restored version
6. Confirm with UBS coordinator when system is available
7. File incident report within 24 hours

---

## Phase 2: UBS Pilot #2 (Week 5–8, conditional)

### Go Criteria (from Phase 1 — all required)

- [ ] Zero critical incidents in weeks 3–4 of Phase 1
- [ ] All CloudWatch alarms green at end of Phase 1 observation
- [ ] DR drill completed for Phase 1 deployment (backup restore tested)
- [ ] Lessons learned from Phase 1 documented and any action items closed
- [ ] Legal confirmation that LGPD anonymization procedure is acceptable for this UBS, or legal hold documented

### Deployment Process

Same pre-deployment checklist as Phase 1 for the new UBS unit. Run unit bootstrap separately for UBS #2 — it creates a new isolated `unitId`. UBS #1 data is not affected.

### Observation Period: 4 weeks before general availability consideration

After 4 weeks with both UBS #1 and #2 stable, a formal go/no-go for general availability can be evaluated.

---

## SISS Integration Technical Freeze

**SISS (Sistema de Informacao de Saude) integration:**

- During pilot period: no integration with external SISS systems without explicit approval from technical lead
- Reason: data isolation boundary must be maintained for pilot validation; any external integration could introduce cross-system data flows before they are audited
- Any planned SISS connection must be reviewed by technical lead and documented before implementation
- This freeze applies for the duration of Phases 1 and 2

---

## Minimum Team for Rollout

| Role | Responsibility | Required? |
|------|---------------|----------|
| Technical Lead | Deploy, incident response, hotfixes | YES |
| UBS Coordinator | Clinical acceptance, user training | YES |
| Break Glass Admin | Unit bootstrap, emergency operations | YES |
| Security Auditor | Governance reports, audit review | RECOMMENDED |
| Clinical Champion | Protocol setup, training | YES |

The break_glass_admin role credentials must be stored in a secure vault accessible only to the Technical Lead and a designated backup. They must not be shared with clinical staff.
