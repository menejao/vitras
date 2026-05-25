# Pre-Rollout Checklist — UBS #1

**Target UBS:** [UBS Name — to be filled]
**Target Date:** [to be filled]
**Operator:** João Pedro
**Version:** v1.0-pilot-governed

## Infrastructure

- [ ] AWS RDS instance running and healthy
- [ ] RDS automated backups enabled (≥7 days retention)
- [ ] EB environment at Node.js ≥ 18
- [ ] EB instances: minimum 1, recommended 2 (for rolling deploy safety)
- [ ] EB health check URL: /readyz (not /health)
- [ ] EB health check interval: 30s, unhealthy threshold: 3
- [ ] EB CLI configured and verified: `eb status` returns correct app name and environment name
- [ ] EB app version list confirmed: `eb appversion` lists v1.0-pilot-governed
- [ ] break_glass_admin account created and credentials stored in secure vault
- [ ] security_auditor account created

## Environment Variables (EB Configuration)

- [ ] NODE_ENV=production
- [ ] LOG_FORMAT=json
- [ ] APP_VERSION=v1.0-pilot-governed
- [ ] DATABASE_URL=[RDS connection string]
- [ ] DATA_ENCRYPTION_KEY=[≥32 chars, generated, stored in AWS Parameter Store or Secrets Manager]
- [ ] PATIENT_LOOKUP_HASH_KEY=[≥32 chars, DIFFERENT from DATA_ENCRYPTION_KEY, stored separately]
- [ ] JWT_SECRET=[≥32 chars, generated]
- [ ] UPSTASH_REDIS_REST_URL=[Upstash endpoint]
- [ ] UPSTASH_REDIS_REST_TOKEN=[Upstash token]
- [ ] FRONTEND_ORIGINS=[production frontend domain]
- [ ] AUDIT_PRUNE_ENABLED=false
- [ ] RUN_MIGRATIONS=true (first deploy) / false (subsequent)

## Security

- [ ] No secrets in git history
- [ ] All secrets in EB environment variables (not in .env files)
- [ ] DATA_ENCRYPTION_KEY and PATIENT_LOOKUP_HASH_KEY are different values — verify:
  ```bash
  echo -n "key1" | sha256sum
  echo -n "key2" | sha256sum
  # outputs must differ
  ```
- [ ] JWT_SECRET length ≥ 32 characters — verify:
  ```bash
  echo -n "your_secret" | wc -c
  ```

## Monitoring

- [ ] CloudWatch log group receiving /var/log/web.stdout.log
- [ ] CloudWatch Insights working (run test query)
- [ ] CloudWatch alarms created per docs/cloudwatch-dashboard.md:
  - [ ] startup.failed
  - [ ] migrations.failed_fatal
  - [ ] 5xx spike (>10 in 5min)
  - [ ] auth_failure spike (>20 in 5min)
  - [ ] circuit_breaker_opened
  - [ ] degraded_mode
  - [ ] deadlock_retry spike
  - [ ] backup.health_warning
- [ ] Alarm notifications configured (email or SNS)

## Baseline Validation

- [ ] DR drill completed and PASSED (see dr-drill-report-[date].md)
- [ ] Staging smoke test completed (see staging-smoke-test.md)
- [ ] baseline-record.md confirmed correct commit hash for deployed artifact

## UBS Bootstrap

- [ ] break_glass_admin account created via `provision-remote-enterprise-user.mjs` (see docs/runbooks/production-bootstrap.md)
- [ ] Bootstrap script ran successfully — verified with audit log event `user.enterprise_provisioned`
- [ ] Unit created: POST /admin/units/bootstrap (break_glass_admin)
- [ ] Gestor user created with unitId matching bootstrap
- [ ] Team(s) created with correct unitId
- [ ] Initial clinical staff accounts created
- [ ] Initial ACS accounts created (if applicable)
- [ ] Protocol templates configured (if applicable)

## Acceptance Sign-off

- [ ] UBS coordinator reviewed and signed aceite-operacional.md
- [ ] Technical lead signed
- [ ] DR drill passed
- [ ] Staging smoke tests passed
