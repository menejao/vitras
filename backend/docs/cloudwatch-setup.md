# CloudWatch Setup — VITRAS Minimum Observability

## Log Group

EB automatically streams stdout/stderr to CloudWatch Logs when configured.
Set `LOG_FORMAT=json` in EB environment variables.

Expected log group pattern: `/aws/elasticbeanstalk/<env-name>/var/log/eb-engine.log`
Or configure a custom log group via `.ebextensions/cloudwatch.config`.

## Critical Events (search in CloudWatch Logs Insights)

```
fields @timestamp, event, level, message
| filter event in ["uncaught_exception", "unhandled_rejection", "rate_limit_store_unavailable", "boot_config_error"]
| sort @timestamp desc
```

## Recommended Alarms (CloudWatch Console)

### 1. HTTP 5xx errors
- Type: CloudWatch Logs Metric Filter
- Filter pattern: `{ $.level = "error" }`
- Alarm: count > 5 in 1 minute → SNS notification

### 2. App crash / restart
- Type: CloudWatch Logs Metric Filter
- Filter pattern: `{ $.event = "uncaught_exception" || $.event = "unhandled_rejection" }`
- Alarm: count > 0 in 1 minute

### 3. Redis/rate-limit unavailable
- Type: CloudWatch Logs Metric Filter
- Filter pattern: `{ $.event = "rate_limit_store_unavailable" }`
- Alarm: count > 10 in 5 minutes

## Minimum EB Environment Variables for Production

| Variable | Required | Description |
|---|---|---|
| `LOG_FORMAT` | Yes | Set to `json` for CloudWatch parsing |
| `JWT_SECRET` | Yes | Minimum 64 chars random |
| `DATA_ENCRYPTION_KEY` | Yes | 64-char hex |
| `DATABASE_URL` | Yes | RDS connection string |
| `UPSTASH_REDIS_REST_URL` | Recommended | Rate limiting (fail-closed in prod) |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Rate limiting |
| `AUDIT_PRUNE_ENABLED` | No | Default false — leave unset |
| `APP_VERSION` | Recommended | Release tag for traceability |
| `AUDIT_LOG_MAX_ENTRIES` | No | Default 10000 |
