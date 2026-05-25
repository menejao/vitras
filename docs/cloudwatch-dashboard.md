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
