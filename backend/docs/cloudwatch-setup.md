# CloudWatch Setup — VITRAS Minimum Observability

## Log Group

EB automatically streams stdout/stderr to CloudWatch Logs when log streaming is enabled
in the EB environment configuration (Configuration → Software → CloudWatch log streaming).
Set `LOG_FORMAT=json` in EB environment variables so logs are emitted as structured JSON.

Expected log group path:
```
/aws/elasticbeanstalk/<env-name>/var/log/web.stdout.log
```

> **Note:** The EB engine log (`eb-engine.log`) is a platform-level log, not the
> application stdout. Application logs go to `web.stdout.log`. Alarm filters must
> target the correct log group.

## Enabling Log Streaming to CloudWatch

### Option A — EB Console (recommended)
In the EB environment: **Configuration → Software → CloudWatch log streaming** → Enable.
Select log types: `web.stdout.log`. Set retention as needed (default 7 days; set to 365
for LGPD compliance).

### Option B — `.ebextensions` (Amazon Linux 1 / legacy platforms only)

Create `.ebextensions/cloudwatch.config` in the project root:

```yaml
packages:
  yum:
    awslogs: []

files:
  "/etc/awslogs/awscli.conf":
    mode: "000600"
    owner: root
    group: root
    content: |
      [plugins]
      cwlogs = cwlogs
      [default]
      region = `{"Ref":"AWS::Region"}`

  "/etc/awslogs/config/vitras.conf":
    mode: "000600"
    owner: root
    group: root
    content: |
      [vitras-app]
      log_group_name = /aws/elasticbeanstalk/`{"Ref":"AWSEBEnvironmentName"}`/var/log/web.stdout.log
      log_stream_name = {instance_id}
      file = /var/log/web.stdout.log
      datetime_format = %Y-%m-%dT%H:%M:%S

commands:
  01_create_log_dir:
    command: "mkdir -p /var/log && touch /var/log/web.stdout.log"
  02_start_awslogs:
    command: "service awslogs start || true"
```

> **Amazon Linux 2 / AL2023:** The `awslogs` package is not available. Use the
> **CloudWatch Agent** instead, or enable log streaming via the EB console (Option A).

## Critical Events (search in CloudWatch Logs Insights)

```
fields @timestamp, event, level, message
| filter event in ["uncaught_exception", "unhandled_rejection", "rate_limit_store_unavailable", "boot_config_error"]
| sort @timestamp desc
```

## Recommended Alarms (CloudWatch Console)

Target log group: `/aws/elasticbeanstalk/<env-name>/var/log/web.stdout.log`

### 1. Application errors
- Type: CloudWatch Logs Metric Filter
- Log group: `/aws/elasticbeanstalk/<env-name>/var/log/web.stdout.log`
- Filter pattern: `{ $.level = "error" }`
- Alarm: count > 5 in 1 minute → SNS notification
- Note: This covers all `logError(...)` calls, including 5xx responses and internal
  errors. For narrower HTTP-error-only alerting, use:
  `{ $.level = "error" && $.event = "request_error" }` (if request error logging is
  enabled via `REQUEST_LOG_ENABLED=true`).

### 2. App crash / restart
- Type: CloudWatch Logs Metric Filter
- Log group: `/aws/elasticbeanstalk/<env-name>/var/log/web.stdout.log`
- Filter pattern: `{ $.event = "uncaught_exception" || $.event = "unhandled_rejection" }`
- Alarm: count > 0 in 1 minute

### 3. Redis/rate-limit unavailable
- Type: CloudWatch Logs Metric Filter
- Log group: `/aws/elasticbeanstalk/<env-name>/var/log/web.stdout.log`
- Filter pattern: `{ $.event = "rate_limit_store_unavailable" }`
- Alarm: count > 10 in 5 minutes

### 4. Migration failure (production fatal)
- Type: CloudWatch Logs Metric Filter
- Log group: `/aws/elasticbeanstalk/<env-name>/var/log/web.stdout.log`
- Filter pattern: `{ $.event = "startup.migrations.failed_fatal" }`
- Alarm: count > 0 in 1 minute → high-priority SNS (pager)

## Minimum EB Environment Variables for Production

| Variable | Required | Description |
|---|---|---|
| `LOG_FORMAT` | Yes | Set to `json` for CloudWatch parsing |
| `JWT_SECRET` | Yes | Minimum 64 chars random |
| `DATA_ENCRYPTION_KEY` | Yes | 64-char hex |
| `PATIENT_LOOKUP_HASH_KEY` | Yes | HMAC key for CPF/CNS uniqueness index (defaults to DATA_ENCRYPTION_KEY if unset) |
| `DATABASE_URL` | Yes | RDS connection string |
| `UPSTASH_REDIS_REST_URL` | Recommended | Rate limiting (fail-closed in prod) |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Rate limiting |
| `RUN_MIGRATIONS` | Recommended | Set to `true` on deploy to auto-apply migrations |
| `AUDIT_PRUNE_ENABLED` | No | Default false — leave unset |
| `APP_VERSION` | Recommended | Release tag for traceability |
| `AUDIT_LOG_MAX_ENTRIES` | No | Default 10000 |
