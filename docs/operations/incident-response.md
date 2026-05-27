# VITRAS Incident Response Procedures

> **Version:** v1.0-pilot-governed
> **Date:** 2026-05-25
> **Applicable from:** UBS Pilot #1 go-live

---

## Incident Classification

| Level | Name | Description | Response Time | Examples |
|-------|------|-------------|---------------|---------|
| P0 | Critical | System down or data breach | 15 minutes | Cross-tenant data leak, audit chain broken, system-wide 5xx, database unreachable |
| P1 | High | Significant degradation | 1 hour | Rate limit causing partial unavailability, single team cannot log in, clinical record creation failing |
| P2 | Medium | Degraded functionality | 4 hours | Specific feature broken for non-critical flow, CloudWatch alarm but no user impact |
| P3 | Low | Minor issue | 24 hours | UI inconsistency, slow query, non-critical alarm |

---

## Escalation Path

```
UBS Staff
    |
    v
UBS Coordinator  ──────────────────────────────────────────────────────────────┐
    |                                                                          |
    v                                                                          |
Technical Lead  ─────────────────────────┬─────────────────────────────────── |
    |                                    |                                     |
    v                                    v                                     v
Break Glass Admin              AWS Support                               Legal / DPO
(if auth/access needed)        (if infrastructure)                  (if data breach)
```

---

## Incident Response Procedures

### P0 — Critical (15-minute response)

1. Technical Lead declares P0 and notifies UBS Coordinator immediately
2. Capture and document: timestamp, symptoms, affected users/teams, last known good state
3. Check `GET /health` and `GET /readyz` immediately
4. Check CloudWatch alarms dashboard for correlated signals
5. Check recent EB deployments — if P0 is correlated with a recent deploy, initiate rollback evaluation
6. **If data breach suspected:** immediately isolate (stop EB instances via AWS Console), notify DPO within 30 minutes
7. **Decision point:** Rollback vs Hotfix
   - Rollback if: confirmed cross-tenant exposure, audit chain integrity failure, data corruption
   - Hotfix if: root cause identified, patch is minimal, rollback would cause greater disruption
8. If rollback: follow `docs/runbooks/backup-restore-runbook.md`
9. After resolution: write incident report within 24 hours
10. Root cause analysis within 72 hours

### P1 — High (1-hour response)

1. Technical Lead assesses within 1 hour
2. Document in operational log: timestamp, symptoms, affected scope
3. Attempt hotfix; if root cause not identified within 2 hours → escalate to P0
4. Notify UBS Coordinator of status and estimated resolution
5. Post-incident report within 48 hours

### P2 — Medium (4-hour response)

1. Technical Lead investigates within 4 hours
2. Document in operational log
3. If resolution requires more than 1 business day → escalate to P1
4. No immediate user notification required unless user-facing

### P3 — Low (24-hour response)

1. Log in operational tracking
2. Schedule for next available maintenance window or Sprint 5 backlog
3. No immediate response required

---

## Rollback Criteria

The following conditions trigger **immediate rollback** without discussion:

- Any confirmed cross-tenant data exposure (patient from UBS A visible to user of UBS B)
- Audit chain integrity failure detected (hash chain broken or orphaned entries)
- CPF or CNS identifier exposed in any API response body
- Database corruption detected (inconsistent foreign keys, missing required rows)
- More than 30% of requests returning 5xx for more than 10 minutes

Additional rollback evaluation triggers (Technical Lead decides):
- EB health checks failing for more than 5 minutes
- More than 3 P0/P1 incidents in first week of operation
- Redis circuit breaker open for more than 1 hour with no recovery path

---

## Communication Templates (Portuguese)

### UBS Coordinator Notification (initial)

> "Identificamos um problema tecnico no VITRAS. Estamos investigando e voce sera atualizado a cada [30min / 1h]. Impacto atual: [descricao do impacto]. Previsao de resolucao: [estimativa ou 'em andamento']."

### UBS Coordinator Update (during incident)

> "Atualizacao [HH:MM]: O problema [descricao] esta [em investigacao / sendo corrigido / resolvido]. [Proximo passo ou estimativa]."

### UBS Coordinator Resolution

> "O problema tecnico no VITRAS foi resolvido as [HH:MM]. Sistema operacional. Nenhum dado de paciente foi comprometido. Relatorio completo sera disponibilizado em [prazo]."

### Prefeitura / Secretaria de Saude Escalation (P0 only)

> "Incidente P0 no sistema VITRAS em [nome da UBS] em [data/hora]. Acao de resposta em andamento desde [HH:MM]. Nenhum dado de paciente foi comprometido / [especificar se houve exposicao de dados]. Relatorio completo sera entregue em 24 horas."

### Data Breach Notification (DPO — if applicable)

> "ATENCAO: Possivel incidente de seguranca de dados no VITRAS [UBS]. Timestamp: [X]. Natureza: [descricao]. Sistema isolado as [HH:MM]. Aguardando investigacao forense. Notificacao a ANPD pode ser necessaria — pendente confirmacao."

---

## Post-Incident Requirements

| Incident Level | Incident Report | Root Cause Analysis | Runbook Update |
|---------------|-----------------|--------------------|-----------------| 
| P0 | Within 24h | Within 72h | Required if applicable |
| P1 | Within 48h | Within 5 days | Required if applicable |
| P2 | Within 1 week | Optional | If recurring |
| P3 | Optional | No | No |

### Incident Report Minimum Content

1. Timeline (when detected, when resolved, key decision points)
2. Root cause (what failed and why)
3. Impact (users affected, duration, data risk)
4. Actions taken
5. Preventive actions (what change prevents recurrence)
6. Runbook updates required

---

## Quick Reference: Diagnosis Commands

```bash
# Check system health
GET /health
GET /readyz

# Check recent audit failures (security_auditor role)
GET /admin/governance/reports/auth-failures?since=<timestamp>
GET /admin/governance/reports/audit

# Clear degraded mode (after root cause resolved)
POST /admin/system/clear-degraded  # break_glass_admin or security_auditor

# CloudWatch: recent 5xx errors
fields @message | filter status_code >= 500 | sort @timestamp desc | limit 20

# CloudWatch: startup events
fields @timestamp, event, phase | filter event in ["server_started", "startup.failed", "migrations.failed_fatal"] | sort @timestamp desc | limit 10
```

See `docs/cloudwatch-dashboard.md` for full alarm runbook reference.
