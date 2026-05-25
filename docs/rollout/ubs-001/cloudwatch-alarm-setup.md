# CloudWatch Alarm Setup — UBS #1 v1.0-pilot-governed

**Version:** v1.0-pilot-governed
**Created:** 2026-05-25
**Operator:** João Pedro
**Source:** `docs/cloudwatch-dashboard.md` (read 2026-05-25)

> This document provides exact AWS CLI commands to configure all 8 required CloudWatch alarms for the UBS #1 deployment. All filter patterns are derived from code-verified log event names in `backend/src/server.js`, `backend/src/middlewares/rate-limits.js`, and `backend/src/services/startup.js`.
>
> Complete Steps 1–4 in order. Step 5 is optional but recommended.

---

## Prerequisites

Before running any commands:

```bash
# Confirm AWS CLI is authenticated and targeting the correct account
aws sts get-caller-identity | jq '{Account, Arn}'

# Set variables for reuse throughout this guide
LOG_GROUP="/aws/elasticbeanstalk/vitras-prod/var/log/nodejs/nodejs.log"
NAMESPACE="VITRAS/Operations"
REGION="sa-east-1"  # replace if using a different region

# Verify log group exists and is receiving logs
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/elasticbeanstalk/vitras-prod" \
  --query 'logGroups[*].{Name:logGroupName,StoredBytes:storedBytes}'

# Confirm recent logs are flowing (run this after the app has been deployed at least once)
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $(date -d '10 minutes ago' +%s000 2>/dev/null || python3 -c "import time; print(int((time.time()-600)*1000))") \
  --filter-pattern '{ $.event = "server_started" }' \
  --query 'events[0].message' 2>/dev/null | head -1
```

**If the log group does not exist:** The app has not been deployed yet, or the log group name differs. Check EB Console → Logs for the actual log group name. Update `LOG_GROUP` accordingly.

---

## Step 1: Create SNS Topic for Notifications

Create this first — the alarm ARN is needed in Step 2.

```bash
# Create SNS topic
SNS_ARN=$(aws sns create-topic \
  --name VITRAS-Alerts \
  --query 'TopicArn' \
  --output text)
echo "SNS Topic ARN: $SNS_ARN"
# Save this value — you will need it in Step 2

# Subscribe Tech Lead email
aws sns subscribe \
  --topic-arn "$SNS_ARN" \
  --protocol email \
  --notification-endpoint "joaoomenegucci@gmail.com"
# Check email inbox and confirm the subscription

# Subscribe additional on-call contacts (add one command per contact)
# aws sns subscribe --topic-arn "$SNS_ARN" --protocol email --notification-endpoint "[oncall@example.com]"
```

Confirm the subscription by clicking the link in the email before proceeding.

---

## Step 2: Create Log Metric Filters

Each filter extracts a count from structured JSON logs and publishes it as a CloudWatch metric.

**Replace `$LOG_GROUP` with the actual log group path if not using the shell variable.**

```bash
# Filter 1: startup_failed
# Triggered by logError("startup.failed", ...) in server.js (startServer catch block)
# [CODE-VERIFIED] event name: "startup.failed"
aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP" \
  --filter-name "VITRAS-startup-failed" \
  --filter-pattern '{ $.event = "startup.failed" }' \
  --metric-transformations \
    metricName=StartupFailed,metricNamespace=VITRAS/Operations,metricValue=1,defaultValue=0

# Filter 2: 5xx errors
# Triggered by request_completed metric events with status_code >= 500
# [CODE-VERIFIED] event name: "request_completed" from logging middleware
aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP" \
  --filter-name "VITRAS-5xx-errors" \
  --filter-pattern '{ $.event = "request_completed" && $.status_code >= 500 }' \
  --metric-transformations \
    metricName=Http5xxErrors,metricNamespace=VITRAS/Operations,metricValue=1,defaultValue=0

# Filter 3: Auth failures
# Triggered by logWarn("rate_limit_exceeded", ...) or auth failure metric events
# [CODE-VERIFIED] metric name: "auth_failure" from metrics service
aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP" \
  --filter-name "VITRAS-auth-failures" \
  --filter-pattern '{ $.metric = "auth_failure" }' \
  --metric-transformations \
    metricName=AuthFailures,metricNamespace=VITRAS/Operations,metricValue=1,defaultValue=0

# Filter 4: Circuit breaker opened
# [CODE-VERIFIED] event name: "circuit_breaker_opened" from rate-limits.js _cbRecordFailure()
aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP" \
  --filter-name "VITRAS-circuit-breaker" \
  --filter-pattern '{ $.event = "circuit_breaker_opened" }' \
  --metric-transformations \
    metricName=CircuitBreakerOpened,metricNamespace=VITRAS/Operations,metricValue=1,defaultValue=0

# Filter 5: Degraded mode
# [CODE-VERIFIED] phase = "degraded" set by setStartupPhase("degraded") in runtime-state.js
# Also catches startup.degraded event from server.js non-prod migration failure path
aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP" \
  --filter-name "VITRAS-degraded-mode" \
  --filter-pattern '{ $.phase = "degraded" }' \
  --metric-transformations \
    metricName=DegradedModeEntries,metricNamespace=VITRAS/Operations,metricValue=1,defaultValue=0

# Filter 6: Deadlock retries
# [CODE-VERIFIED] metric name: "deadlock_retry" from db.js _withDbPostgresAttempt
aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP" \
  --filter-name "VITRAS-deadlock-retry" \
  --filter-pattern '{ $.metric = "deadlock_retry" }' \
  --metric-transformations \
    metricName=DeadlockRetries,metricNamespace=VITRAS/Operations,metricValue=1,defaultValue=0

# Filter 7: Backup health warning
# [CODE-VERIFIED] event name: "backup.health_warning" from startup.js checkRdsBackupHealth()
aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP" \
  --filter-name "VITRAS-backup-warning" \
  --filter-pattern '{ $.event = "backup.health_warning" }' \
  --metric-transformations \
    metricName=BackupHealthWarning,metricNamespace=VITRAS/Operations,metricValue=1,defaultValue=0

# Filter 8: Migrations failed (fatal)
# [CODE-VERIFIED] event name: "migrations.failed_fatal" from server.js migration catch block
aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP" \
  --filter-name "VITRAS-migrations-failed" \
  --filter-pattern '{ $.event = "migrations.failed_fatal" }' \
  --metric-transformations \
    metricName=MigrationsFailed,metricNamespace=VITRAS/Operations,metricValue=1,defaultValue=0
```

**Verify filters were created:**
```bash
aws logs describe-metric-filters \
  --log-group-name "$LOG_GROUP" \
  --query 'metricFilters[*].{Name:filterName,Pattern:filterPattern}' \
  --output table
# Should show 8 rows
```

---

## Step 3: Create CloudWatch Alarms

Replace `[SNS_ARN]` with the ARN from Step 1.
Replace `[REGION]` and `[ACCOUNT_ID]` as appropriate.

```bash
# Set SNS ARN (replace with actual value from Step 1)
SNS_ARN="arn:aws:sns:sa-east-1:[ACCOUNT_ID]:VITRAS-Alerts"

# Alarm 1: startup_failed
# Any single occurrence = critical (app failed to start)
aws cloudwatch put-metric-alarm \
  --alarm-name "VITRAS-startup-failed" \
  --alarm-description "App failed to start. Runbook: docs/cloudwatch-dashboard.md#startup-failed" \
  --metric-name StartupFailed \
  --namespace VITRAS/Operations \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN"

# Alarm 2: 5xx spike
# > 10 occurrences in 5 minutes (per cloudwatch-dashboard.md §3.1)
aws cloudwatch put-metric-alarm \
  --alarm-name "VITRAS-5xx-spike" \
  --alarm-description "5xx error spike. Runbook: docs/cloudwatch-dashboard.md#5xx-spike" \
  --metric-name Http5xxErrors \
  --namespace VITRAS/Operations \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN"

# Alarm 3: Auth failures spike
# > 20 occurrences in 5 minutes (per cloudwatch-dashboard.md §3.6)
aws cloudwatch put-metric-alarm \
  --alarm-name "VITRAS-auth-failures" \
  --alarm-description "Auth failure spike — possible brute force. Runbook: docs/cloudwatch-dashboard.md#auth_failure-spike" \
  --metric-name AuthFailures \
  --namespace VITRAS/Operations \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 20 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN"

# Alarm 4: Circuit breaker opened
# Any single occurrence (per cloudwatch-dashboard.md §3.4)
# Impact: ALL user requests return 503 while circuit is OPEN
aws cloudwatch put-metric-alarm \
  --alarm-name "VITRAS-circuit-breaker" \
  --alarm-description "Redis circuit breaker opened — all requests returning 503. Runbook: docs/cloudwatch-dashboard.md#circuit_breaker_opened" \
  --metric-name CircuitBreakerOpened \
  --namespace VITRAS/Operations \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN"

# Alarm 5: Degraded mode
# Any single occurrence (per cloudwatch-dashboard.md §3.5)
aws cloudwatch put-metric-alarm \
  --alarm-name "VITRAS-degraded-mode" \
  --alarm-description "System entered degraded mode. Runbook: docs/cloudwatch-dashboard.md#degraded_mode" \
  --metric-name DegradedModeEntries \
  --namespace VITRAS/Operations \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN"

# Alarm 6: Deadlock retry spike
# > 5 occurrences in 5 minutes (per cloudwatch-dashboard.md §3.7)
aws cloudwatch put-metric-alarm \
  --alarm-name "VITRAS-deadlock-retry" \
  --alarm-description "Postgres deadlock spike — investigate DB contention. Runbook: docs/cloudwatch-dashboard.md#deadlock_retry-spike" \
  --metric-name DeadlockRetries \
  --namespace VITRAS/Operations \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN"

# Alarm 7: Backup health warning
# Any single occurrence in a 5-minute window (per cloudwatch-dashboard.md §3.9)
aws cloudwatch put-metric-alarm \
  --alarm-name "VITRAS-backup-warning" \
  --alarm-description "RDS automated backup health warning. Runbook: docs/cloudwatch-dashboard.md#backup.health_warning" \
  --metric-name BackupHealthWarning \
  --namespace VITRAS/Operations \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN"

# Alarm 8: Migrations failed (fatal)
# Any single occurrence = critical (app will not start)
aws cloudwatch put-metric-alarm \
  --alarm-name "VITRAS-migrations-failed" \
  --alarm-description "Fatal migration failure — app will not start. Runbook: docs/cloudwatch-dashboard.md#startup-failed" \
  --metric-name MigrationsFailed \
  --namespace VITRAS/Operations \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN"
```

---

## Step 4: Verify Alarm Setup

```bash
# List all VITRAS alarms and their current state
aws cloudwatch describe-alarms \
  --alarm-name-prefix "VITRAS-" \
  --query 'MetricAlarms[*].{Name:AlarmName,State:StateValue,Metric:MetricName,Threshold:Threshold}' \
  --output table
```

**Expected output:** 8 alarms, all in state `INSUFFICIENT_DATA` (no data has flowed yet) or `OK` (data has flowed and no threshold breached). `ALARM` state at this point would indicate either a threshold issue or an actual problem.

```bash
# Verify filters are linked to correct log group
aws logs describe-metric-filters \
  --log-group-name "$LOG_GROUP" \
  --query 'metricFilters[*].{Filter:filterName,Namespace:metricTransformations[0].metricNamespace,Metric:metricTransformations[0].metricName}' \
  --output table
# Expected: 8 rows, all in namespace VITRAS/Operations
```

---

## Step 5: Test Alarm (Optional but Recommended)

This test temporarily lowers a threshold to confirm the alarm notification pipeline works end-to-end (filter → metric → alarm → SNS → email).

```bash
# Step 5a: Lower auth-failures threshold to 1 (temporarily)
aws cloudwatch put-metric-alarm \
  --alarm-name "VITRAS-auth-failures" \
  --alarm-description "TEMP TEST — restoring to 20 after test" \
  --metric-name AuthFailures \
  --namespace VITRAS/Operations \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN"

# Step 5b: Trigger 2 failed login attempts against staging (NOT production)
curl -s -X POST https://[STAGING_URL]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}' | jq .ok
curl -s -X POST https://[STAGING_URL]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}' | jq .ok

# Step 5c: Wait 1–2 minutes for CloudWatch to process the metric
# Check your email for the SNS notification

# Step 5d: Check alarm state (should be ALARM)
aws cloudwatch describe-alarms \
  --alarm-names "VITRAS-auth-failures" \
  --query 'MetricAlarms[0].StateValue'

# Step 5e: Restore threshold to production value (20)
aws cloudwatch put-metric-alarm \
  --alarm-name "VITRAS-auth-failures" \
  --alarm-description "Auth failure spike — possible brute force. Runbook: docs/cloudwatch-dashboard.md#auth_failure-spike" \
  --metric-name AuthFailures \
  --namespace VITRAS/Operations \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 20 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN"

# Step 5f: Verify threshold restored
aws cloudwatch describe-alarms \
  --alarm-names "VITRAS-auth-failures" \
  --query 'MetricAlarms[0].{State:StateValue,Threshold:Threshold}'
# Expected: Threshold: 20
```

---

## Alarm Summary Table

| # | Alarm Name | Metric | Threshold | Period | Severity | Runbook Action |
|---|-----------|--------|-----------|--------|---------|---------------|
| 1 | VITRAS-startup-failed | StartupFailed | ≥ 1 | 60s | P0 | Check EB instance logs; verify migration 006 applied; escalate Tech Lead immediately |
| 2 | VITRAS-5xx-spike | Http5xxErrors | > 10 | 300s | P1/P0 | Check /health; identify failing endpoint via CloudWatch Insights; evaluate rollback |
| 3 | VITRAS-auth-failures | AuthFailures | > 20 | 300s | P1 | Check auth failure report; verify Upstash rate limit is blocking; check brute force pattern |
| 4 | VITRAS-circuit-breaker | CircuitBreakerOpened | ≥ 1 | 60s | P0 | Check Upstash dashboard; confirm /health redis=error; communicate to UBS; auto-recovers |
| 5 | VITRAS-degraded-mode | DegradedModeEntries | ≥ 1 | 60s | P2/P1 | Check /health degradedReason; resolve root cause; POST /admin/system/clear-degraded |
| 6 | VITRAS-deadlock-retry | DeadlockRetries | > 5 | 300s | P2 | Check RDS Performance Insights; look for lock contention; consider scale-up |
| 7 | VITRAS-backup-warning | BackupHealthWarning | ≥ 1 | 300s | P2 | Verify RDS backup retention in AWS Console; enable automated backups if disabled |
| 8 | VITRAS-migrations-failed | MigrationsFailed | ≥ 1 | 60s | P0 | App will not start; check migration logs; verify schema_migrations table; re-deploy with correct state |

---

## CloudWatch Insights Queries for Alarm Investigation

These queries are used when an alarm fires and you need to diagnose the root cause.

```
-- Query for startup_failed / migrations_failed
fields @timestamp, event, phase, error
| filter event in ["startup.failed", "migrations.failed_fatal", "boot_migrations_required"]
| sort @timestamp desc
| limit 20

-- Query for 5xx spike
fields @timestamp, path, status_code, method
| filter event = "request_completed" and status_code >= 500
| stats count(*) as errors by path, status_code
| sort errors desc

-- Query for auth failures
fields @timestamp, reason
| filter metric = "auth_failure"
| stats count(*) as failures by bin(5m)
| sort @timestamp desc

-- Query for circuit breaker events
fields @timestamp, event, subsystem
| filter event in ["circuit_breaker_opened", "circuit_breaker_closed", "circuit_breaker_half_open", "circuit_breaker_reopened"]
| sort @timestamp desc
| limit 50

-- Query for degraded mode
fields @timestamp, event, reason
| filter event in ["startup.degraded"] or phase = "degraded"
| sort @timestamp desc
| limit 20

-- Query for deadlock retries
fields @timestamp, attempt, code
| filter metric = "deadlock_retry"
| stats count(*) as retries by bin(5m)
| sort @timestamp desc

-- Query for backup health warnings
fields @timestamp, event, message, value
| filter event = "backup.health_warning"
| sort @timestamp desc
```

---

## Completion Checklist

- [ ] SNS topic `VITRAS-Alerts` created
- [ ] Tech Lead email subscribed and confirmed
- [ ] All additional on-call contacts subscribed and confirmed
- [ ] 8 metric filters created in log group `$LOG_GROUP`
- [ ] 8 CloudWatch alarms created in namespace `VITRAS/Operations`
- [ ] `aws cloudwatch describe-alarms --alarm-name-prefix "VITRAS-"` shows 8 alarms
- [ ] All alarms show `INSUFFICIENT_DATA` or `OK` (not `ALARM`)
- [ ] (Optional) Test notification via Step 5 — email received and threshold restored
- [ ] Alarm setup recorded in `final-go-live-checklist.md` item "All 8 CloudWatch alarms configured and active"

---

*Document version: v1.0 — Created 2026-05-25*
*Code audit sources: `backend/src/server.js`, `backend/src/middlewares/rate-limits.js`, `backend/src/services/startup.js`*
*Reference: `docs/cloudwatch-dashboard.md`*
