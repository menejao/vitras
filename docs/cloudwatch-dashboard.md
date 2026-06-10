# CloudWatch Dashboard — VITRAS

> **Revisão:** Sprint 4 — Maio 2026
> **Log Group:** `/aws/elasticbeanstalk/vitras-prod/var/log/nodejs/nodejs.log`

---

## 1. CloudWatch Insights Queries

Todas as queries abaixo usam o log group da aplicação. Substituir `<LOG_GROUP>` pelo valor real.

### 1.1 Requests por status e rota (últimas 1h)

```
fields @timestamp, metric, path, status_code, duration_ms
| filter event = "metric" and metric = "request_completed"
| stats count(*) as requests, avg(duration_ms) as avg_ms, max(duration_ms) as max_ms by path, status_code
| sort requests desc
| limit 50
```

### 1.2 Erros 5xx

```
fields @timestamp, path, status_code, method
| filter event = "metric" and metric = "request_completed" and status_code >= 500
| stats count(*) as error_count by path, status_code
| sort error_count desc
```

### 1.3 Falhas de autenticação

```
fields @timestamp, reason
| filter event = "metric" and metric = "auth_failure"
| stats count(*) as failures by bin(5m)
| sort @timestamp desc
```

### 1.4 Deadlock retries

```
fields @timestamp, attempt, code
| filter event = "metric" and metric = "deadlock_retry"
| stats count(*) as retries by bin(5m)
| sort @timestamp desc
```

### 1.5 Rate limit hits por prefixo

```
fields @timestamp, prefix
| filter event = "metric" and metric = "rate_limit_hit"
| stats count(*) as hits by prefix, bin(5m)
| sort hits desc
```

### 1.6 Circuit breaker events

```
fields @timestamp, event, subsystem
| filter event in ["circuit_breaker_opened", "circuit_breaker_closed", "circuit_breaker_half_open"]
| sort @timestamp desc
| limit 100
```

### 1.7 Startup events

```
fields @timestamp, event, phase, port, driver
| filter event in ["server_started", "startup.failed", "startup.warming", "migrations.completed", "migrations.failed_fatal"]
| sort @timestamp desc
| limit 20
```

### 1.8 Backup health warnings

```
fields @timestamp, event, message, value
| filter event = "backup.health_warning"
| sort @timestamp desc
```

### 1.9 Audit chain integrity failures

```
fields @timestamp, metric, status, broken, orphaned
| filter event = "metric" and metric = "audit_chain_failure"
| sort @timestamp desc
```

### 1.10 Degraded mode events

```
fields @timestamp, event, reason
| filter event in ["startup.degraded"] or level = "warn" and message like /degraded/
| sort @timestamp desc
```

### 1.11 Duração de writes no banco (p95)

```
fields @timestamp, metric, value, driver
| filter event = "metric" and metric = "db_write_duration_ms"
| stats pct(value, 95) as p95_ms, avg(value) as avg_ms, count(*) as writes by driver, bin(5m)
| sort @timestamp desc
```

### 1.12 Log storm suppression

```
fields @timestamp, event, suppressed_event, count
| filter event = "log_storm_suppressed"
| sort @timestamp desc
```

---

## 2. Widgets Recomendados para o Dashboard

### Painel Principal

| Widget | Tipo | Query |
|--------|------|-------|
| Requests/min | Line chart | `request_completed` grouped by `bin(1m)` |
| Latência p95 | Line chart | `db_write_duration_ms` pct(95) |
| Erros 5xx | Number | `status_code >= 500` count last 5min |
| Auth failures | Number | `auth_failure` count last 5min |
| Rate limit hits | Number | `rate_limit_hit` count last 5min |
| Startup phase | Text | Latest `server_started` event |

### Painel de Segurança

| Widget | Tipo | |
|--------|------|-|
| Circuit breaker state | Log table | Circuit breaker events |
| Auth failure timeline | Bar chart | auth_failure por 5min |
| Rate limit abuse | Bar chart | rate_limit_hit por prefix |
| Audit chain status | Log table | audit_chain_failure events |

---

## 3. Alarmes Mínimos Recomendados

### 3.1 Erros 5xx — alerta crítico

- **Métrica:** CloudWatch Logs Insights → Metric Filter em `status_code >= 500`
- **Threshold:** > 10 ocorrências em 5 minutos
- **Ação:** SNS → On-call PagerDuty/WhatsApp

```json
{
  "AlarmName": "vitras-5xx-spike",
  "Threshold": 10,
  "Period": 300,
  "EvaluationPeriods": 1,
  "ComparisonOperator": "GreaterThanThreshold"
}
```

### 3.2 Startup fatal

- **Métrica:** Metric filter em `event = "startup.failed"`
- **Threshold:** >= 1 em 1 minuto
- **Ação:** SNS crítico + página engenheiro

### 3.3 Migration failure fatal

- **Métrica:** Metric filter em `event = "migrations.failed_fatal"`
- **Threshold:** >= 1 em 1 minuto
- **Ação:** SNS crítico

### 3.4 Redis indisponível

- **Métrica:** Metric filter em `event = "circuit_breaker_opened"`
- **Threshold:** >= 1 em 5 minutos
- **Ação:** SNS alerta + investigação

### 3.5 Modo degradado

- **Métrica:** Metric filter em `event = "startup.degraded"` ou nível warn com `degraded`
- **Threshold:** >= 1 em 1 minuto
- **Ação:** SNS alerta

### 3.6 Spike de falhas de autenticação

- **Métrica:** `metric = "auth_failure"` count
- **Threshold:** > 20 em 5 minutos
- **Ação:** SNS alerta + bloqueio IP manual se necessário

### 3.7 Spike de deadlocks

- **Métrica:** `metric = "deadlock_retry"` count
- **Threshold:** > 5 em 5 minutos
- **Ação:** SNS alerta + investigação de contention no banco

### 3.8 Rate limit abuse

- **Métrica:** `metric = "rate_limit_hit"` count
- **Threshold:** > 100 em 5 minutos
- **Ação:** SNS alerta

### 3.9 Backup health warning

- **Métrica:** Metric filter em `event = "backup.health_warning"`
- **Threshold:** >= 1 em 24 horas
- **Ação:** SNS warning para equipe de infraestrutura

### 3.10 Audit chain failure

- **Métrica:** `metric = "audit_chain_failure"` count
- **Threshold:** >= 1 em 1 hora
- **Ação:** SNS crítico + investigação forense imediata

---

## 4. Configuração de Metric Filters (CloudFormation / Console)

Para cada alarme que não usa Log Insights diretamente, criar um Metric Filter no Log Group:

```bash
# Exemplo: criar metric filter para startup.failed
aws logs put-metric-filter \
  --log-group-name "/aws/elasticbeanstalk/vitras-prod/var/log/nodejs/nodejs.log" \
  --filter-name "vitras-startup-failed" \
  --filter-pattern '{ $.event = "startup.failed" }' \
  --metric-transformations \
    metricName=StartupFailed,metricNamespace=Vitras,metricValue=1
```

---

## 5. Referências

- `docs/disaster-recovery.md` — RTO/RPO e drill schedule
- `docs/operational-resilience.md` — circuit breaker, degraded mode
- `docs/runbooks/observability.md` — configuração existente

---

## Alarm Runbook Reference

For each alarm, list: what it means, immediate action, escalation path.

### startup.failed / migrations.failed_fatal
**What:** EB instance failed to start or migrations did not complete.
**Immediate action:**
1. Check EB instance logs (/var/log/web.stdout.log or EB console)
2. Look for `logLevel: "error"` entries with `event: "migrations.failed_fatal"`
3. Verify `schema_migrations` table in RDS has 008 rows
4. If migration missing: run migration manually or re-deploy
5. If DB unreachable: check RDS status, security groups, VPC
**Escalation:** Technical Lead immediately — treat as P0

### 5xx Spike (>10 in 5min)
**What:** Application errors affecting users.
**Immediate action:**
1. Check `GET /health` — is it degraded?
2. Check CloudWatch Insights: `fields @message | filter status_code >= 500 | sort @timestamp desc | limit 20`
3. Identify which endpoint is failing
4. Check for recent deploy — rollback if correlated
**Escalation:** P1 if <30% of requests affected; P0 if >30%

### auth_failure Spike (>20 in 5min)
**What:** Possible brute-force attempt or misconfigured client.
**Immediate action:**
1. Check `GET /admin/governance/reports/auth-failures` (security_auditor)
2. Identify source pattern (masked identifiers in logs)
3. If brute-force: review Upstash rate limit logs for block confirmations
4. If rate limit not blocking: verify Upstash config and circuit breaker state
**Escalation:** Security auditor + Technical Lead

### circuit_breaker_opened / redis_unavailable
**What:** Upstash/Redis unavailable. Rate limiting in fail-closed mode — all requests return 503.
**Immediate action:**
1. Check Upstash dashboard for outage
2. If Upstash outage: wait for recovery (circuit breaker auto-recovers in HALF_OPEN after cooldown)
3. Monitor `GET /health` for redis subsystem status
4. If extended outage (>1 hour): consider disabling Upstash rate limit temporarily (requires code change + deploy)
**User impact:** ALL user requests return 503 (except /health, /readyz) while circuit is OPEN
**Escalation:** P0 if user impact >15 minutes

### degraded_mode
**What:** System entered degraded mode due to non-fatal error.
**Immediate action:**
1. Check `GET /health` — look at `degradedReason` field
2. Identify root cause from CloudWatch logs
3. If root cause resolved: `POST /admin/system/clear-degraded` (break_glass_admin or security_auditor)
4. If root cause unresolved: restart EB instance
**Note:** Degraded mode does not mean outage. System continues to serve requests.
**Escalation:** P2 unless degraded reason is database-related (P1)

### deadlock_retry Spike (>5 in 5min)
**What:** Postgres deadlocks accumulating. Normal under heavy concurrent writes, but spikes indicate contention.
**Immediate action:**
1. Check current concurrent users / request rate
2. Look for long-running transactions in RDS Performance Insights
3. If RDS CPU >80%: consider scaling instance type
4. If concentrated in specific operation: investigate `withDb` mutation size and locking order
**Escalation:** P2 unless deadlocks are causing visible failures (P1)

### backup.health_warning
**What:** RDS automated backups appear disabled.
**Immediate action:**
1. Log into AWS Console > RDS > Your instance > Maintenance & backups
2. Enable automated backups (minimum 7-day retention)
3. Verify backup window does not conflict with peak usage hours
4. Confirm at least one recent backup exists in the backup list
**Escalation:** Ops team within 24h — data loss risk until resolved

### audit_chain_failure
**What:** Audit chain integrity check detected broken or orphaned entries.
**Immediate action:**
1. This is a potential data integrity or tampering event
2. Treat as P0 immediately
3. Do not clear or modify audit logs
4. Technical Lead begins forensic investigation
5. Notify DPO if tampering is suspected
**Escalation:** P0 — forensic investigation required before any other action
