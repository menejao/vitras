# Resiliência Operacional — VITRAS

> **Revisão:** Sprint 4.1 — Maio 2026

---

## 1. Circuit Breaker Redis/Upstash

### Comportamento

O circuit breaker protege a aplicação de hammering num Redis indisponível:

```
CLOSED (normal) ─── 5 falhas em 60s ──→ OPEN (fail-closed)
                                              │
                                         após 30s
                                              │
                                         HALF-OPEN (probe)
                                         ┌────┴────┐
                                    sucesso      falha
                                       │            │
                                    CLOSED       OPEN (cooldown reinicia)
```

### Transições de Estado (State Machine Completa)

| Transição | Condição | Gatilho | Log Event |
|-----------|----------|---------|-----------|
| CLOSED → OPEN | 5 falhas em 60s | `_cbRecordFailure` | `circuit_breaker_opened` |
| OPEN → HALF_OPEN | após 30s cooldown | `_cbCheckHalfOpen` | `circuit_breaker_half_open` |
| HALF_OPEN → CLOSED | probe bem-sucedida | `_cbRecordSuccess` | `circuit_breaker_closed` |
| HALF_OPEN → OPEN | probe falhou | `_cbRecordFailure` (S5-01) | `circuit_breaker_reopened` |

### Estados

| Estado | Comportamento | Log Event |
|--------|---------------|-----------|
| `CLOSED` | Normal — chama Upstash em cada request | — |
| `OPEN` | Fail-closed — retorna 503 sem chamar Upstash | `circuit_breaker_opened` |
| `HALF_OPEN` | Permite uma probe request | `circuit_breaker_half_open` |

### Parâmetros

- **Threshold de abertura:** 5 falhas consecutivas em 60 segundos
- **Delay para HALF_OPEN:** 30 segundos
- **Comportamento em OPEN (produção):** 503 `Serviço temporariamente indisponível`
- **Comportamento em OPEN (dev/test):** passa request (fallback permissivo)

### Redis Outage — Comportamento Durante Blackout

Quando o Upstash/Redis está indisponível:

1. Circuit breaker abre após 5 falhas consecutivas em 60s → estado `OPEN`
2. Em estado `OPEN`: **TODAS** as requests rate-limited retornam 503 (fail-closed by design)
3. `/health` e `/readyz` **continuam funcionando** (não são rate-limited)
4. Instâncias EB permanecem "healthy" (`readyz` retorna 200) — EB não remove da rotação
5. Após 30s: transição para `HALF_OPEN` — uma probe é enviada ao Upstash
   - Probe bem-sucedida → `CLOSED` (operação normal retomada)
   - Probe falhou → `OPEN` novamente (cooldown completo de 30s reinicia)
6. **Recuperação: automática** quando o Upstash se recuperar — sem intervenção manual

**Nota importante:** O blackout de Redis é fail-closed intencional. Requests de usuários retornam 503 durante o outage — isso previne abuso durante falha de infraestrutura. NÃO é necessário intervir manualmente para um outage normal de Redis.

### Degraded Mode via Circuit Breaker

Quando o circuit breaker abre, o servidor NÃO crasha. O rate limiting fail-closed ainda se aplica — requests são bloqueadas com 503, não liberadas. O modo degradado (`setDegraded("redis_unavailable")`) pode ser acionado manualmente por operadores.

---

## 2. Retry/Backoff para Postgres

Já implementado em `src/db.js` — sem alterações neste sprint.

### Códigos Elegíveis para Retry

| Código | Descrição |
|--------|-----------|
| `40P01` | Deadlock detected |
| `40001` | Serialization failure |
| `55P03` | Lock not available |

### Parâmetros

- **Máximo de tentativas:** 3
- **Delay base:** 50ms + jitter aleatório de 0-100ms
- **Métrica emitida:** `deadlock_retry` com `attempt` e `code`

### Monitoramento

CloudWatch Insights:
```
filter event = "metric" and metric = "deadlock_retry"
| stats count(*) by bin(5m)
```

Alarme: > 5 deadlocks em 5 minutos → investigar contention no banco.

---

## 3. Comportamento de Restart Rolling no EB

### Processo Normal

1. EB drena conexões da instância a ser reiniciada
2. `/health` retorna 503 durante shutdown (`shuttingDown = true`)
3. EB aguarda drain period (default: 20s) antes de terminar instância
4. Nova instância inicia, passa por fases: `booting → migrating → warming → ready`
5. `/readyz` retorna 200 somente quando ready
6. EB inclui instância na rotação

### Configuração Recomendada EB

```json
{
  "aws:elasticbeanstalk:application": {
    "Application Healthcheck URL": "/readyz"
  },
  "aws:elasticbeanstalk:environment:process:default": {
    "HealthCheckPath": "/readyz",
    "MatcherHTTPCode": "200"
  }
}
```

### Proteção contra Deploy com Schema Desatualizado

`checkCriticalMigrations()` bloqueia boot se migration `006_patient_hash_columns` não estiver aplicada em produção. Deploy é abortado antes de aceitar tráfego.

---

## 4. Degraded Mode

### Triggers

| Trigger | Ação | Comportamento |
|---------|------|---------------|
| Migration falhou (non-prod) | `setDegraded("migrations_failed")` | Continua servindo; retorna status degraded em /health |
| Circuit breaker aberto | Configurável | Fail-closed em rate limits |
| Erro não-fatal de startup | `setDegraded(reason)` | Mantém instância na rotação |

### Endpoints em Modo Degradado

- `/health` retorna 200 com `status: "degraded"` e `degradedReason`
- `/readyz` pode retornar 200 (se postgres ok) ou 503 (se postgres falhou)
- API endpoints continuam funcionando se Postgres estiver acessível

### SOP — Recuperação do Modo Degradado (S2-01)

**Detecção:** `/health` retorna `{ status: "degraded", degradedReason: "..." }`

**Opção 1 — Limpar via endpoint (preferida quando o problema raiz foi resolvido):**

```
POST /admin/system/clear-degraded
Authorization: Bearer <token>   # break_glass_admin ou security_auditor
```

Resposta esperada:
```json
{ "ok": true, "message": "Degraded mode cleared — system returned to ready state" }
```

A operação emite um audit log `degraded.cleared` e log estruturado `system.degraded_cleared`.

**Opção 2 — Restart da instância EB** (se clear-degraded não for apropriado ou se o subsistema ainda está falhando):
- Via console AWS EB ou `eb restart`
- `_startupPhase` é reiniciado a cada boot

### Tabela de Estados da Instância

| Estado | `/health` | `/readyz` | Requests de usuário | EB routing |
|--------|-----------|-----------|---------------------|------------|
| `booting` / `migrating` | 503 | 503 | bloqueado pelo EB | NÃO |
| `warming` | 503 | 503 | bloqueado pelo EB | NÃO |
| `ready` | 200 ok | 200 ok | normal | SIM |
| `degraded` | 200 degraded | 200 ok | normal | SIM |
| `shutting_down` | 503 | 503 | draining | DRAINING |
| Redis `OPEN` | 200/degraded | 200 ok | 503 (rate limited) | SIM |

---

## 5. Proteção contra Log Storm

### Comportamento

- Aplica-se apenas ao nível INFO
- Se mesmo `event+message` logado > 10 vezes em 1 segundo: suprime subsequentes
- Emite evento `log_storm_suppressed` com contagem (apenas uma vez por janela)
- Erros (`level = "error"`) e warns sempre passam

### Caso de Uso

Proteção contra loops de logging durante condições de erro temporárias (ex: health check loop, retry storm).

### Log Event

```json
{
  "event": "log_storm_suppressed",
  "suppressed_event": "db_deadlock_retry",
  "count": 25,
  "window_ms": 1000
}
```

---

## 6. Prevenção de Crash Loop

1. **Processo de produção:** `validateProductionConfig()` falha rápido antes de aceitar tráfego
2. **Migrations fatais:** apenas em produção; non-prod usa degraded mode
3. **uncaughtException/unhandledRejection:** capturados em `server.js`, graceful shutdown
4. **EB health check:** instância removida da rotação durante restart
5. **Circuit breaker:** evita cascata de falhas de Redis para o app

---

## 7. Referências

- `src/db.js` — `_withDbPostgresAttempt`, `TRANSIENT_PG_CODES`
- `src/middlewares/rate-limits.js` — circuit breaker implementation
- `src/utils/logger.js` — log storm protection
- `src/services/runtime-state.js` — `setDegraded`, `isDegraded`
- `docs/cloudwatch-dashboard.md` — alarmes e queries
