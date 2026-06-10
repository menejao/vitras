# VITRAS Operational Routines

> **Version:** v1.0-pilot-governed
> **Date:** 2026-05-25
> **Applies to:** D+1 through D+14 post go-live for each UBS, then weekly cadence

---

## Daily Checklist (First 14 Days After Each UBS Go-Live)

### Morning (09:00 local time)

- [ ] Check `GET /health` endpoint — confirm `postgres: ok`, `redis: ok`, `startup.phase: ready`
- [ ] Review CloudWatch alarms dashboard — any triggered overnight?
- [ ] Check EB instance health in AWS Console — all instances showing "OK"?
- [ ] Review auth failure count: `GET /admin/governance/reports/auth-failures?since=yesterday` (security_auditor role)
- [ ] Confirm no 5xx spike in last 12 hours (CloudWatch metric filter or Insights query)
- [ ] Verify `GET /readyz` returns 200

### End of Day (17:00 or end of clinical hours)

- [ ] Total active patients served today (estimate from `GET /admin/governance/reports/activity`)
- [ ] Any incidents reported by UBS staff? If yes: log in incident tracker
- [ ] Audit log growth normal — not spiking unexpectedly vs yesterday
- [ ] Backup still configured (AWS Console spot check: RDS > Maintenance & backups > Automated backups)
- [ ] Circuit breaker state: check CloudWatch for any `circuit_breaker_opened` events today

---

## Weekly Operational Report (Every Friday)

Compile the following and share with Technical Lead and UBS Coordinator:

### System Health
- System uptime this week (from CloudWatch EB health metrics)
- Total 5xx errors this week (target: 0 in first 4 weeks)
- Average response time p95 for key endpoints

### Clinical Activity
- Number of active patients (total, new this week)
- Number of clinical records created this week
- Number of appointments created this week

### Security and Rate Limiting
- Number of auth failures this week (target: low, investigate if >50/day)
- Number of cross-team access events (expected: some for clinical staff, should be zero for ACS to other teams)
- Number of rate limit hits this week (establish baseline in week 1–2)

### Resilience
- Circuit breaker trips this week (target: zero)
- Deadlock retries this week (target: <10; investigate if spiking)
- Any degraded mode events (target: zero)

### Incidents
- List of any P0–P3 incidents this week and status
- Any open incident reports awaiting root cause

### Action Items for Next Week
- Open items from previous week
- New action items identified

---

## Post-Deploy Verification Procedure

After each backend deploy (EB deployment):

1. **Wait for EB health:** EB environment returns to "Ok" status (usually 2–5 minutes)
2. **Verify readiness:** `GET /readyz` returns 200 within 5 minutes of deploy
3. **Verify migrations:** Check `schema_migrations` table — all rows 001–008 present
4. **Check startup logs:** CloudWatch for any `startup.failed` or `migrations.failed_fatal` events
5. **Check health subsystems:** `GET /health` — postgres and redis should be `ok`
6. **Smoke test:** Create a test patient, verify it appears in list, delete it
7. **Log deployment:** Record deploy timestamp, version, deployer in operational log

If step 3 or 4 fails: initiate rollback per incident-response.md P0 procedure.

---

## Migration Inconsistency Check

After each deploy, verify schema is complete:

```sql
-- Run in RDS via psql or AWS Query Editor
SELECT migration_id FROM schema_migrations ORDER BY migration_id;
-- Expected: 001, 002, 003, 004, 005, 006, 007, 008
```

If any migration is missing: do not allow clinical use. Investigate and apply missing migration or roll back.

---

## Metrics Baseline Establishment (Week 1)

During the first week of UBS #1 operation, record these baseline values in the operational log. They will be used to tune CloudWatch alarm thresholds for the specific usage patterns of this UBS.

| Metric | What to record | How to query |
|--------|----------------|--------------|
| Request latency p95 | Per-endpoint avg `duration_ms` | CloudWatch Insights 1.1 |
| DB write latency p95 | `db_write_duration_ms` pct(95) | CloudWatch Insights 1.11 |
| Auth failure rate | Daily count | `auth_failure` metric |
| Rate limit hit rate | Daily count by prefix | `rate_limit_hit` metric |
| Active users | Concurrent sessions | Estimate from request volume |

After week 1, adjust alarm thresholds:
- 5xx spike: > 10 in 5 minutes (adjust if baseline is lower)
- Auth failures: > 20 in 5 minutes (adjust based on observed login patterns)
- Rate limit hits: > 100 in 5 minutes (adjust based on normal usage)

---

## Backup Verification Schedule

| Frequency | Action |
|-----------|--------|
| Daily (D+1 to D+14) | Spot check AWS Console — automated backups listed |
| Weekly | Verify backup window does not conflict with peak hours |
| Monthly | Run DR drill: restore from backup to test environment and verify data integrity |

See `docs/operations/RUNBOOK_BACKUP_RESTORE.md` for restore procedure.

---

## Audit Log Review Schedule

| Frequency | Action | Who |
|-----------|--------|-----|
| Daily (D+1 to D+14) | Review auth failures count | Technical Lead or Security Auditor |
| Weekly | Full governance report review | Security Auditor |
| Monthly | Audit chain integrity check | Technical Lead |

Audit chain integrity check command (break_glass_admin):
```
GET /admin/audit/integrity
```

Expected response: `{ "status": "ok", "broken": 0, "orphaned": 0 }`

If broken > 0 or orphaned > 0: treat as P0, begin forensic investigation immediately.
