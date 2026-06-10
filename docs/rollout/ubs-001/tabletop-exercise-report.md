# Tabletop Exercise Report — UBS #1

**Date:** 2026-05-25
**Conductor:** João Pedro
**Version:** v1.0-pilot-governed
**Format:** Structured narrative — each scenario is a timed simulation with decision points and operator actions.

> This document serves as both the exercise execution guide (run in sequence with the team) and the exercise record (fill scores at bottom after each scenario).

---

## Scenario A: Redis / Upstash Unavailable

**Context:** Upstash has a regional outage. All VITRAS rate-limited requests returning 503. UBS staff cannot use the system.

**System behavior (from `docs/operational-resilience.md`):**
- Circuit breaker opens after 5 consecutive failures in 60 seconds
- State transitions: CLOSED → OPEN → (30s) → HALF_OPEN → CLOSED (if recovered) or OPEN (if not)
- In OPEN state: ALL rate-limited requests return 503 (fail-closed by design)
- `/health` and `/readyz` continue returning 200 (not rate-limited)
- EB does NOT remove instance from rotation — it still appears "healthy"
- Recovery is automatic — no manual intervention required

### Timeline Simulation

| Time | Event | System State | Operator Action |
|------|-------|-------------|----------------|
| T+0 | First 503 reports from UBS staff | Circuit breaker opens → OPEN | — |
| T+0 | CloudWatch alarm `circuit_breaker_opened` fires | All user requests → 503 | Receive alarm notification |
| T+2min | Check `/health` | Returns 200 with `{ subsystems: { redis: "error" } }` | Run: `curl https://[url]/health \| jq .subsystems` |
| T+2min | Check `/readyz` | Returns 200 (postgres still ok) | Run: `curl https://[url]/readyz` |
| T+5min | Confirm: EB still routing (instance "healthy") | EB health: OK (readyz 200) | Check EB console health dashboard |
| T+10min | Identify circuit breaker state in logs | `circuit_breaker_opened` event visible | CW Insights: `filter event = "circuit_breaker_opened"` |
| T+10:30min | HALF_OPEN probe auto-triggered | One probe request sent to Upstash | Watch CW for `circuit_breaker_half_open` event |
| T+11min | If Upstash recovered: CLOSED | `circuit_breaker_closed` event, normal operation | Confirm in CW: `circuit_breaker_closed` present |
| T+11min | If Upstash still down: back to OPEN | `circuit_breaker_reopened` event | Cooldown restarts (30s) |
| T+15min (if no recovery) | Communicate to UBS coordinator | — | Use template below |
| T+30min (if still down) | Evaluate emergency options | — | See decision points below |
| T+60min (if still down) | Escalate to Upstash support | — | Contact via Upstash dashboard |

**CloudWatch Insights query for this scenario:**
```
fields @timestamp, event, subsystem
| filter event in ["circuit_breaker_opened", "circuit_breaker_closed", "circuit_breaker_half_open", "circuit_breaker_reopened"]
| sort @timestamp desc
| limit 20
```

**Communication template (T+15min if users already affected):**
> "Identificamos instabilidade no VITRAS causada por problema em serviço externo (controle de acesso). O sistema está sendo monitorado e deve se recuperar automaticamente. Estimativa: 30–60 minutos. Em caso de urgência clínica, documentar em papel e lançar no sistema quando estabilizar."

### Decision Points

**At T+15min: Inform UBS coordinator?**
- YES — users are already impacted. Use communication template above.
- Threshold: any outage affecting ALL users for > 15 minutes requires communication.

**At T+30min: Emergency disable rate limiting?**
- Only if Upstash is confirmed to NOT recover in the next 30 minutes (e.g., extended outage confirmed).
- Requires a code change + redeploy — HIGH RISK during incident.
- Decision: ONLY if clinical urgency AND Upstash SLA indicates no recovery within 1 hour.
- In practice: wait for Upstash auto-recovery (typical regional MTTR < 30 minutes).

**At T+60min: Escalate to Upstash support?**
- YES — open support ticket in Upstash dashboard.
- Have account email and REST URL ready for support identification.

### Key Learnings for This Scenario

1. `/readyz` returning 200 does NOT mean users can access the system — if the circuit breaker is OPEN, all user requests return 503. This distinction matters for EB health vs user experience.
2. No manual action is required for a normal Upstash outage. The system will auto-recover.
3. UBS staff will see "503 Serviço temporariamente indisponível" — pre-emptive communication reduces panic calls.
4. The system does NOT crash, data is NOT at risk, audit logs continue recording events that don't require rate limiting.

### Post-Exercise Discussion Questions

- [ ] Does the UBS coordinator understand why 503 occurs during Redis outage (rate limit fail-closed)?
- [ ] Is the Upstash support contact documented in `contatos.md`?
- [ ] Is there an agreed SLA commitment on rate limit availability for this pilot?
- [ ] Is there a read-only mode option for future consideration (see lessons-learned-drill.md Gap 3)?

---

## Scenario B: RDS High Latency (Not Down)

**Context:** RDS responding in 3–8 seconds instead of normal < 100ms. Postgres queries timing out. `db_write_duration_ms` spikes visible in CloudWatch. UBS users report slowness: "appointments taking > 10 seconds to save."

**System behavior:** RDS is accessible (SELECT 1 passes), but write operations are slow. No circuit breaker activation. `deadlock_retry` metric may be spiking.

### Timeline Simulation

| Time | Event | System State | Operator Action |
|------|-------|-------------|----------------|
| T+0 | Users report slowness on saving appointments | App running, postgres reachable | Receive user complaint via coordinator |
| T+2min | Check `/health` | 200 `{ postgres: "ok" }` (SELECT 1 passes, even if slow) | `curl https://[url]/health \| jq .subsystems` |
| T+3min | Check CloudWatch write durations | `db_write_duration_ms` P95 > 5000ms | CW Insights query 1 (below) |
| T+3min | Check deadlock retries | `deadlock_retry` count elevated | CW Insights query 2 (below) |
| T+5min | Check RDS Performance Insights | CPU spike, lock contention, or full table scan visible | AWS Console → RDS → Performance Insights |
| T+8min | Assess: degraded UX but data integrity intact | No audit chain failure, no 5xx spike | Check CW for 5xx errors |
| T+10min | Communicate to UBS coordinator | — | Use template below |
| T+15min+ | Decision based on trajectory | See decision matrix below | Monitor every 5 minutes |

**CloudWatch Insights query 1 — write duration P95:**
```
fields @timestamp, metric, value, driver
| filter event = "metric" and metric = "db_write_duration_ms"
| stats pct(value, 95) as p95_ms, avg(value) as avg_ms, count(*) as writes by driver, bin(5m)
| sort @timestamp desc
```

**CloudWatch Insights query 2 — deadlock retries:**
```
fields @timestamp, attempt, code
| filter event = "metric" and metric = "deadlock_retry"
| stats count(*) as retries by bin(5m)
| sort @timestamp desc
```

**SQL query for active long-running queries (requires DB access via bastion):**
```sql
SELECT pid, query, state, query_start,
       EXTRACT(EPOCH FROM (now() - query_start)) AS duration_seconds
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start ASC;
```

**Communication template (T+10min):**
> "O VITRAS está operando com lentidão no momento. Salvar consultas e registros pode levar mais tempo que o normal. A equipe técnica está investigando. O sistema NÃO está fora do ar — apenas lento. Atualizações a cada 15 minutos."

### Decision Matrix

| Latency Level | Trajectory | Action |
|--------------|-----------|--------|
| < 2s and falling | Recovering | Monitor, no action needed |
| 2–5s stable | Plateaued | Communicate to UBS, monitor closely, check RDS CPU |
| > 5s stable | Persistent | P1 escalation, inform UBS, consider read-only mode |
| > 5s and growing | Worsening | P1 escalation, prepare rollback evaluation, check RDS IOPS limits |
| > 5s + 5xx errors increasing | Cascading | P0 escalation, rollback evaluation begins immediately |

### Likely Causes to Investigate

1. **Concurrent `withDb` write queue:** Only one write lock at a time — heavy concurrent usage backs up.
2. **RDS CPU spike:** Verify in RDS CloudWatch metrics (not just CW Insights).
3. **IOPS throttling:** Small RDS instance classes have limited burst IOPS — check `ReadIOPS` / `WriteIOPS`.
4. **Network latency between EB and RDS:** Check EB instance AZ vs RDS AZ — cross-AZ latency adds ~1ms.
5. **Full table scan:** Migration that added index may not have covered all query patterns.

### Post-Exercise Discussion Questions

- [ ] Who has access to RDS Performance Insights for this environment?
- [ ] Is there an agreed RDS instance type for go-live? Can it be scaled without downtime?
- [ ] Is Multi-AZ enabled? (Required for failover; also co-locates EB + RDS AZ for lowest latency)

---

## Scenario C: Deploy Failed After Migration

**Context:** New deploy attempted (hypothetical Sprint 5 hotfix, version `v1.1-hotfix`). Migration 009 runs but contains an error. Application fails to start. `/readyz` returns 503. Previous version is no longer running. Users have zero access.

**Critical distinction:** Whether migration 009 COMMITTED or ROLLED BACK determines the recovery path.

### Timeline Simulation

| Time | Event | System State | Operator Action |
|------|-------|-------------|----------------|
| T+0 | Deploy v1.1-hotfix initiated | EB deploying new version | Monitor EB health |
| T+2min | EB health check fails — /readyz 503 for > 2 min | New version not starting | Check EB console — deployment stuck |
| T+3min | CloudWatch: `migrations.failed_fatal` event appears | App crashed on startup | CW Insights: query below |
| T+3min | Confirm: previous version no longer serving | Deployment replaced previous running version | EB console — no healthy instances |
| T+5min | Decision: rollback to v1.0-pilot-governed | — | Tech Lead declares rollback |
| T+6min | Notify UBS coordinator | — | Use template below |
| T+7min | Check: did migration 009 commit? | — | Query schema_migrations (see below) |
| T+7min | Based on migration status: follow decision tree | — | See decision tree below |
| T+10min | EB rollback initiated | EB deploying v1.0-pilot-governed | `eb deploy --version v1.0-pilot-governed` |
| T+15min | /readyz 200 (previous version running) | App healthy | Confirm in EB console |
| T+17min | Smoke test: login, patient access, audit logs | App functional | Run 3 smoke checks |
| T+20min | GO declaration — previous version stable | — | Confirm with UBS coordinator |
| T+22min | Notify UBS: sistema restaurado | — | Use resolution template |

**CW Insights query — migration failure:**
```
fields @timestamp, event, phase
| filter event in ["migrations.failed_fatal", "startup.failed"]
| sort @timestamp desc
| limit 10
```

**Communication template (T+6min — deploy failed):**
> "Identificamos um problema técnico durante atualização do sistema. Iniciando restauração da versão anterior. Tempo estimado: 15–20 minutos. Os dados NÃO foram afetados."

**Communication template (T+22min — restored):**
> "Sistema VITRAS restaurado às [HH:MM]. Versão anterior reativada com sucesso. Todos os dados estão íntegros. Um novo deploy será agendado após investigação do problema."

### Critical: Migration Commit Status Check

Before initiating EB code rollback, determine if migration 009 committed to the database:

```sql
-- [REQUIRES DB ACCESS via bastion or admin endpoint]
SELECT id, executed_at FROM schema_migrations ORDER BY executed_at;
-- If 009 is present: migration committed even though app failed to start
-- If 009 is absent: migration either rolled back or never ran
```

### Decision Tree

```
Migration 009 present in schema_migrations?
│
├── NO (absent — migration rolled back or never executed)
│   └── Simple code rollback to v1.0-pilot-governed
│       EB deploys previous version → DONE
│       Expected: no data loss, no DB inconsistency
│
└── YES (committed — migration ran even though app crashed)
    │
    └── Is 009 backward-compatible with v1.0 code?
        │
        ├── YES (additive only: new column, new table, new index)
        │   └── Code rollback to v1.0-pilot-governed is safe
        │       v1.0 code ignores the new column/table → DONE
        │       Note: verify v1.0 doesn't SELECT * on tables with new NOT NULL columns
        │
        └── NO (destructive: column removed, renamed, type changed, constraint added)
            └── Code rollback alone will cause runtime errors in v1.0
                Must ALSO restore DB from backup to pre-migration state
                Follow: docs/runbooks/backup-restore-runbook.md
                ⚠ Data loss: any records created since pre-migration backup are lost
                ⚠ Notify UBS coordinator of data loss window
```

### Key Learnings for This Scenario

1. The deploy failure itself causes zero data loss (app was returning 503, no writes were possible).
2. The risk is in the migration — a partial or committed but incompatible migration is the hard case.
3. `checkCriticalMigrations()` in the codebase prevents boot if migration 006 is missing, but does not protect against new migrations that fail mid-way.
4. Always test migrations in staging against a copy of production schema before deploying.
5. Additive migrations (add column, add table) are always safer than destructive ones (drop, rename, change type).

### Post-Exercise Discussion Questions

- [ ] Is there a staging database that closely mirrors production for migration testing?
- [ ] Is there a written policy that all migrations must be additive during the pilot period?
- [ ] Who besides the Tech Lead can execute `eb deploy` in an emergency?

---

## Scenario D: Critical User Cannot Access System

**Context A:** The gestor for UBS #1 forgot their password AND cannot use normal recovery (e.g., no access to registered email).
**Context B:** The gestor account was accidentally deactivated by an admin action.
**Context C:** 2FA device lost (if 2FA is enabled in future versions).

### Timeline Simulation

| Time | Event | System State | Operator Action |
|------|-------|-------------|----------------|
| T+0 | Gestor reports: cannot login ("Invalid credentials" or "Account inactive") | App running normally | Receive report via phone/coordinator |
| T+2min | Tech Lead checks audit logs for this user | — | `GET /audit-logs?event=auth.*&userId=[id]` |
| T+3min | Determine: last successful login, any failed attempts, account status | — | Identify root cause from audit logs |
| T+5min | Case A (password forgotten): reset via break_glass_admin | — | `PATCH /admin/users/[id]/reset-password` (break_glass_admin token) |
| T+5min | Case B (deactivated): reactivate via break_glass_admin | — | `PATCH /admin/users/[id]/activate` (break_glass_admin token) |
| T+8min | Audit log records: `password_reset` or `account_reactivated` with actor = `break_glass_admin` | — | Confirm event in audit log |
| T+10min | Gestor logs in with new credentials | App functional for user | Verify login succeeds |
| T+12min | Notify security_auditor of break_glass action | — | Send notification to security_auditor |
| T+24h | security_auditor reviews break_glass action | — | security_auditor reviews audit logs for break_glass session |
| T+24h | Post-incident: review why break_glass was needed | — | Improve self-service password recovery if applicable |

**Key Principle:** ALL break_glass_admin actions MUST be audited and reviewed by security_auditor within 24 hours. This is non-negotiable — break_glass is a privileged operation and all uses must be inspected.

### Case Identification via Audit Logs

```bash
# Check recent auth events for a specific user
GET /admin/governance/reports/auth-failures?since=[timestamp]

# Check account status and recent audit entries
GET /audit-logs?userId=[userId]&since=[ISO-timestamp]
```

| Event in audit log | Interpretation |
|-------------------|----------------|
| `auth.login_failed` (multiple) | Password incorrect — reset needed |
| `auth.account_locked` | Brute force triggered lock — unlock + reset |
| `user.deactivated` | Account was deactivated — investigate who/why |
| No events at all | Account may not exist — verify user creation |

### Post-Exercise Discussion Questions

- [ ] Does the break_glass_admin account exist and are its credentials in a secure vault?
- [ ] Is there a documented self-service password recovery flow for gestores that would prevent break_glass use for simple forgotten passwords?
- [ ] Does the security_auditor account exist and is the security_auditor aware of their review obligation?
- [ ] Are there other accounts (besides gestor) that might need break_glass recovery?

---

## Scenario E: Inconsistent Data Post-Migration

**Context:** After a deploy, operators notice incorrect data — either duplicate CPF errors on patient creation, or patients showing incorrect `teamId` assignments.

### Timeline Simulation (CPF Duplicate Error)

| Time | Event | System State | Operator Action |
|------|-------|-------------|----------------|
| T+0 | UBS staff reports: "Paciente já cadastrado" on new patient entry | App running normally | Receive report |
| T+2min | Check: does patient actually exist? | — | `GET /patients?search=[cpf-fragment]` |
| T+5min | If duplicate exists: investigate creation timeline | — | `GET /audit-logs?event=patient.created&patientId=[id]` |
| T+10min | Determine: real duplicate, or CPF hash index issue? | — | Check audit trail for both records |
| T+15min | If suspected hash issue: dry run hash rebuild | — | `POST /admin/rebuild-patient-hashes?dryRun=true` |
| T+20min | If real duplicate: LGPD/clinical decision required | — | Escalate to Medical Director |

### Timeline Simulation (Broader Inconsistency)

| Time | Event | System State | Operator Action |
|------|-------|-------------|----------------|
| T+0 | Multiple staff report incorrect teamId on patient records | App running normally | Receive reports — assess scope |
| T+5min | Determine scope: how many records affected? | — | `GET /patients` — check teamId values |
| T+10min | Halt new patient registrations (communicate) | — | Notify UBS coordinator |
| T+15min | Run hash rebuild dry run | — | `POST /admin/rebuild-patient-hashes?dryRun=true` |
| T+20min | Assess rollback need: severity × affected records × recoverability | — | Tech Lead decision |
| T+30min | If rollback decided: follow backup-restore-runbook.md | — | Restore from pre-deploy backup |
| T+45min | If rollback: notify UBS of records lost since backup | — | Identify data entry window lost |

### CPF Hash Issue Diagnosis

```bash
# Step 1: Dry run hash rebuild
curl -X POST https://[url]/admin/rebuild-patient-hashes?dryRun=true \
  -H "Authorization: Bearer $BREAK_GLASS_ADMIN_TOKEN" \
  | jq '{ok: .ok, issues: (.issues | length), sample_issues: .issues[:3]}'

# Step 2: If issues found — assess whether a real rebuild is safe
# A rebuild rehashes all CPF/CNS values — safe if PATIENT_LOOKUP_HASH_KEY is unchanged
# DANGEROUS if PATIENT_LOOKUP_HASH_KEY was rotated — would invalidate all hash lookups
```

### LGPD Escalation (Real Duplicate Records)

If a genuine duplicate patient record exists (same CPF, different data):
1. Do NOT delete either record unilaterally — clinical data may be in both.
2. Escalate to Medical Director for record review.
3. Escalate to DPO if the duplicate exposed data from one clinical encounter to unauthorized viewer.
4. Document in operational incident log.
5. Any merge or anonymization decision requires both Medical Director and DPO sign-off.

**Note (KI-02):** The LGPD anonymization endpoint exists but must not be used until legal review in Sprint 5A is complete. For the pilot, if an anonymization request arrives, document it and escalate — do NOT use the anonymization endpoint without legal confirmation.

### Post-Exercise Discussion Questions

- [ ] Is `PATIENT_LOOKUP_HASH_KEY` documented as "never rotate without a hash rebuild plan"?
- [ ] Is the Medical Director aware they may be called for data inconsistency decisions?
- [ ] Is the DPO contact available in `contatos.md`?

---

## Scenario F: 5xx Spike

**Context:** CloudWatch alarm `vitras-5xx-spike` fires. More than 10 errors in the last 5 minutes. Users may or may not be aware — depends on which endpoint is failing.

### Timeline Simulation

| Time | Event | System State | Operator Action |
|------|-------|-------------|----------------|
| T+0 | Alarm fires: 5xx spike | App running, some requests failing | Receive alarm notification |
| T+1min | Open CloudWatch Insights | — | Run query 1 (below) |
| T+2min | Identify which endpoint is failing | — | From query results: which `path` has 5xx |
| T+3min | Read stack trace / error message | — | Run query 2 (below) for specific endpoint |
| T+5min | Determine: deploy-correlated? | — | Check: was there a deploy in last 30 minutes? |
| T+5min | Determine: user impact scope | — | What % of requests are 5xx? |
| T+8min | If localized (one endpoint): communicate specific limitation | — | Template below |
| T+15min | If widespread: P1 escalation, rollback evaluation | — | Assess decision matrix |

**CloudWatch Insights query 1 — identify failing endpoints:**
```
fields @timestamp, path, status_code, method
| filter event = "metric" and metric = "request_completed" and status_code >= 500
| stats count(*) as error_count by path, status_code
| sort error_count desc
```

**CloudWatch Insights query 2 — read error messages for specific endpoint:**
```
fields @timestamp, @message, path, status_code
| filter event = "metric" and metric = "request_completed" and status_code >= 500 and path like /[path]/
| sort @timestamp desc
| limit 20
```

**CloudWatch Insights query 3 — check for stack traces:**
```
fields @timestamp, @message, level
| filter level = "error" and @timestamp > ago(30m)
| sort @timestamp desc
| limit 20
```

**Communication template (localized failure):**
> "O registro de consultas está apresentando instabilidade no momento. Os profissionais podem documentar em papel temporariamente. Estimativa de resolução: [tempo]. Demais funcionalidades do sistema operam normalmente."

**Communication template (widespread failure):**
> "O VITRAS está com instabilidade técnica. A equipe técnica está trabalhando na resolução. Estimativa de restauração: [tempo]. Documentar em papel e lançar no sistema quando normalizar."

### Decision Matrix

| Scope of 5xx | Threshold | Classification | Action |
|-------------|-----------|---------------|--------|
| < 5% of requests | < 5% | P2 | Monitor, investigate, no rollback |
| 5–30% of requests | 5–30% | P1 | Targeted fix or rollback evaluation |
| > 30% of requests | > 30% | P0 | Immediate rollback evaluation |
| Any cross-tenant data visible | Any | P0 | Immediate rollback, DPO notification |

**Checking request error rate:**
```
fields @timestamp, status_code
| filter event = "metric" and metric = "request_completed"
| stats count(*) as total,
        sum(case when status_code >= 500 then 1 else 0 end) as errors
by bin(5m)
| eval error_pct = errors * 100 / total
| sort @timestamp desc
```

### Post-Exercise Discussion Questions

- [ ] Is there an on-call notification channel configured for alarm delivery? (Email? WhatsApp? SNS?)
- [ ] How quickly can the Tech Lead access CloudWatch from a mobile device?
- [ ] Is the decision authority clear — who can declare rollback?

---

## Tabletop Exercise Scores

> Complete AFTER running all scenarios with the team. Rate each dimension 1–5:
> 1 = Very unclear/not confident | 3 = Adequate | 5 = Clear and confident

| Scenario | Diagnosis Clarity | Resolution Confidence | Communication Clarity | SOP Completeness | Team Score |
|----------|-----------------|---------------------|---------------------|-----------------|-----------|
| A — Redis outage | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| B — RDS latency | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| C — Deploy failed | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| D — User no access | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| E — Data inconsistency | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| F — 5xx spike | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| **OVERALL** | | | | | [fill] |

---

## Gap Actions Identified During Tabletop

> Fill during or immediately after the exercise. Add rows as needed.

| # | Gap Identified | Severity | Action | Owner | Target |
|---|---------------|----------|--------|-------|--------|
| 1 | [fill] | [H/M/L] | [fill] | [fill] | [fill] |
| 2 | [fill] | [H/M/L] | [fill] | [fill] | [fill] |
| 3 | [fill] | [H/M/L] | [fill] | [fill] | [fill] |

> Pre-identified gaps from document preparation phase are documented in `lessons-learned-drill.md`.

---

## Exercise Sign-Off

```
Tabletop Exercise Completed: YES / NO

Scenarios completed:
  [ ] A — Redis outage
  [ ] B — RDS latency
  [ ] C — Deploy failed
  [ ] D — User no access
  [ ] E — Data inconsistency
  [ ] F — 5xx spike

Overall readiness assessment: [READY / NEEDS WORK / NOT READY]

Key gap requiring action before go-live: [fill or "None identified"]

Signed by Tech Lead: _________________________ Date: _______
```

---

*Document version: v1.0 — Created 2026-05-25*
