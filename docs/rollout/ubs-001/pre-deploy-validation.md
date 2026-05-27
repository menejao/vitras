# Pre-Deploy Validation Report — UBS #1

**Date:** [to fill]
**Operator:** João Pedro
**Version:** v1.0-pilot-governed
**Environment:** Production EB

## Git Validation

- [ ] Branch: release/pilot-baseline
- [ ] Deployment artifact built from tag v1.0-pilot-governed (commit `1478bb5c5c910a2fba165a11f1e3926ad6af2a45`)
- [ ] Tag verified: `git tag -l v1.0-pilot-governed`
- [ ] Tag commit verified: `git rev-parse v1.0-pilot-governed` — must equal `1478bb5c5c910a2fba165a11f1e3926ad6af2a45`

## Environment Variables Validation

Use `eb printenv` or AWS Console → Configuration → Software.
**Do NOT log actual values — check presence and format only.**

| Variable | Present? | Format check | Notes |
|----------|---------|-------------|-------|
| NODE_ENV | | = "production" | |
| LOG_FORMAT | | = "json" | |
| APP_VERSION | | = "v1.0-pilot-governed" | |
| DATABASE_URL | | starts with "postgres://" | |
| DATA_ENCRYPTION_KEY | | length ≥ 32 | `echo -n $KEY \| wc -c` |
| PATIENT_LOOKUP_HASH_KEY | | length ≥ 32, different from DATA_ENCRYPTION_KEY | |
| JWT_SECRET | | length ≥ 32 | |
| UPSTASH_REDIS_REST_URL | | starts with "https://" | |
| UPSTASH_REDIS_REST_TOKEN | | non-empty | |
| FRONTEND_ORIGINS | | includes prod domain | |
| AUDIT_PRUNE_ENABLED | | = "false" | |

## RDS Validation

- [ ] RDS instance status: Available
- [ ] Automated backups: Enabled
- [ ] Backup retention: ≥ 7 days
- [ ] Last backup age: ≤ 24 hours
- [ ] Multi-AZ: [enabled/disabled — note if disabled]
- [ ] Storage auto-scaling: Enabled

## EB Validation

- [ ] Health check URL: /readyz
- [ ] Health check interval: 30s
- [ ] Node.js version: ≥ 18
- [ ] Instance type: [note for future scaling reference]
- [ ] Min instances: [note]

## CloudWatch Validation

- [ ] Log group receiving: /var/log/web.stdout.log
- [ ] Test query returns results:
  ```
  fields @message | filter event = "server_started" | sort @timestamp desc | limit 5
  ```
- [ ] All 8 alarms active (per docs/cloudwatch-dashboard.md):
  - [ ] startup.failed
  - [ ] migrations.failed_fatal
  - [ ] 5xx spike
  - [ ] auth_failure spike
  - [ ] circuit_breaker_opened
  - [ ] degraded_mode
  - [ ] deadlock_retry spike
  - [ ] backup.health_warning

## Staging Final Validation

- [ ] Staging smoke test executed today (or within this week)
- [ ] No blockers recorded in staging-smoke-test.md
- [ ] Migrations verified on staging: `SELECT COUNT(*) FROM schema_migrations` = 11

## DR Drill

- [ ] dr-drill-report-[date].md exists and shows PASSED
- [ ] Drill date ≤ 14 days before this deploy

## EB CLI Verification

Run these commands before opening the deploy window. Record outputs.

- [ ] `eb status` returns correct app name and environment:
  ```
  Application Name: [expected app name]
  Environment Name: [expected env name]
  Environment ID:   [id]
  Platform:         Node.js [version]
  Tier:             WebServer-Standard-1.0
  CNAME:            [url].elasticbeanstalk.com
  Updated:          [date]
  Status:           Ready
  Health:           Green
  ```
  Actual output: [fill — paste status line or "App=[name], Env=[name], Status=Ready"]

- [ ] `eb use [env-name]` correct environment selected (if multiple envs exist):
  ```bash
  eb use [env-name]
  ```
  Confirmed: [YES / N/A — only one environment]

- [ ] Rollback version confirmed: `eb appversion` lists v1.0-pilot-governed:
  ```bash
  eb appversion
  ```
  Output includes v1.0-pilot-governed: [YES / NO]

- [ ] AWS profile confirmed correct: `aws sts get-caller-identity`:
  ```bash
  aws sts get-caller-identity --query 'Account'
  ```
  Account ID matches expected: [YES / NO — record last 4 digits only: XXXX]

## Sign-off

All validations passed: YES / NO
EB CLI verified (see EB CLI Verification section): YES / NO
Signed by Tech Lead: _________________________ Date: _______
Approved for deploy: YES / NO
