# DR Drill Report — 2026-05-25

**Version:** v1.0-pilot-governed
**Operator:** João Pedro
**Environment:** Staging (simulation)
**Status:** SIMULATED — to be executed against real staging before UBS #1 go-live

## Pre-Drill Checklist

| Check | Status | Notes |
|-------|--------|-------|
| RDS automated backup enabled | PENDING | Verify in AWS Console → RDS → Maintenance & backups |
| Latest automated backup available | PENDING | Check backup age ≤ 24h |
| Staging environment available | PENDING | Separate EB environment for restore test |
| Database credentials for staging available | PENDING | Separate from production |
| Technical lead present | PENDING | Required for drill |

## Drill Steps

### Step 1: Identify backup point

- Go to AWS Console → RDS → [production-instance] → Maintenance & backups
- Select most recent automated backup
- Record: backup timestamp, estimated data age

### Step 2: Initiate point-in-time restore

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier [prod-db-id] \
  --target-db-instance-identifier vitras-restore-drill-$(date +%Y%m%d) \
  --restore-time [backup-timestamp-ISO]
```

### Step 3: Wait for restore completion (~10–20 min)

```bash
aws rds describe-db-instances \
  --db-instance-identifier vitras-restore-drill-$(date +%Y%m%d) \
  --query 'DBInstances[0].DBInstanceStatus'
```

Wait until status: `"available"`

### Step 4: Update staging EB environment

- Set DATABASE_URL to point at restored instance
- Keep all other env vars identical to production
- Restart EB staging instances

### Step 5: Validate restored instance

| Validation | Command / Check | Expected | Actual | Pass? |
|-----------|----------------|----------|--------|-------|
| /readyz returns 200 | `curl https://[staging-url]/readyz` | `{"ok":true}` | PENDING | PENDING |
| /health postgres: ok | `curl https://[staging-url]/health` | `postgres: "ok"` | PENDING | PENDING |
| Migrations complete | `SELECT COUNT(*) FROM schema_migrations` | 8 rows | PENDING | PENDING |
| Login works | POST /auth/login with test credentials | 200 + token | PENDING | PENDING |
| Patients accessible | GET /patients with token | 200 + array | PENDING | PENDING |
| Audit logs intact | GET /audit-logs with admin token | 200 + entries | PENDING | PENDING |
| hash indexes present | `SELECT indexname FROM pg_indexes WHERE tablename='app_patients'` | cpf_hash, cns_hash indexes | PENDING | PENDING |
| server_started log | Check CloudWatch for event:"server_started" | present | PENDING | PENDING |

### Step 6: Tear down restored instance

```bash
aws rds delete-db-instance \
  --db-instance-identifier vitras-restore-drill-$(date +%Y%m%d) \
  --skip-final-snapshot
```

## Drill Results (to be filled after execution)

**Total drill duration:** [fill after]
**Restore time:** [fill after]
**All validations passed:** YES / NO
**Issues found:** [fill after]
**Corrective actions taken:** [fill after]

## Sign-off

Drill approved by: ___________________________
Date: ___________________________

## Decision

- [ ] DR drill PASSED — UBS #1 go-live authorized
- [ ] DR drill FAILED — UBS #1 go-live BLOCKED pending resolution
