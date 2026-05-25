# Tabletop Exercise — Final Report — UBS #1

**Date:** [fill during execution — use 2026-05-25 or later]
**Conductor:** João Pedro
**Version:** v1.0-pilot-governed
**Source:** `docs/rollout/ubs-001/tabletop-exercise-report.md`
**Status:** PENDING — Conduct with team before go-live

> This document is both the execution guide (run in sequence with the team) and the final record (fill scores after each scenario). The source tabletop document contains full scenario detail; this report is the condensed execution record.

---

## Pre-Exercise Checklist

Before starting, confirm:
- [ ] All participants have read `docs/operations/incident-response.md`
- [ ] `contatos.md` is open and accessible
- [ ] CloudWatch Insights is accessible to at least one participant
- [ ] EB Console access confirmed for Tech Lead
- [ ] Scenarios A–F printed or on shared screen
- [ ] Scoring rubric reviewed: 1 = not confident, 3 = adequate, 5 = confident

---

## Scenario A — Redis / Upstash Unavailable

**Summary:** Upstash has a regional outage. All VITRAS rate-limited requests return 503. UBS staff cannot use the system. The circuit breaker opens automatically after 5 failures in 60 seconds. System self-heals when Upstash recovers.

**Key facts the team must know:**
- `/health` and `/readyz` continue returning 200 during Upstash outage — EB does NOT remove instance
- `/health` → `subsystems.redis = "error"` indicates circuit breaker OPEN
- ALL user requests return 503 when circuit breaker is OPEN (fail-closed by design)
- No manual intervention required — circuit breaker tries HALF_OPEN probe after 30 seconds
- Recovery is automatic; if Upstash recovers, system returns to CLOSED state without redeploy

**Decision points the team must be able to answer:**
1. At T+15min (users impacted): Do we communicate to UBS coordinator? → YES, always if >15min
2. At T+30min (still down): Do we disable rate limiting? → Only if confirmed >1h outage AND clinical urgency
3. At T+60min: Do we escalate to Upstash support? → YES

**Operator actions (in order):**

Step 1 — Confirm circuit breaker state via CloudWatch Insights:
```
fields @timestamp, @message
| filter event = "circuit_breaker_opened" OR event = "circuit_breaker_closed" OR event = "circuit_breaker_half_open" OR event = "circuit_breaker_reopened"
| sort @timestamp desc
| limit 20
```

Step 2 — Confirm /health shows redis error but postgres ok:
```bash
curl https://[url]/health | jq .subsystems
# Expected: { "postgres": "ok", "redis": "error", "migrations": "ok" }
```

Step 3 — Confirm /readyz still returns 200 (instance in EB rotation):
```bash
curl https://[url]/readyz
# Expected: 200 { "ok": true }
```

Step 4 — Communicate to UBS coordinator (if T+15min and still down):

PT-BR template:
> "Identificamos instabilidade no VITRAS causada por problema em serviço externo (controle de acesso). O sistema está sendo monitorado e deve se recuperar automaticamente. Estimativa: 30–60 minutos. Em caso de urgência clínica, documentar em papel e lançar no sistema quando estabilizar."

**Communication template reference:** `docs/rollout/ubs-001/plano-comunicacao.md` — incident templates section.

**Post-scenario discussion questions:**
- Does the team understand why EB shows "healthy" while users see 503?
- Is Upstash support contact populated in `contatos.md`?
- Is the paper documentation fallback communicated to UBS staff pre-go-live?

**Scenario A score:** Diagnosis [1–5] / Resolution [1–5] / Communication [1–5] / SOP [1–5] / Overall [avg]
Score recorded: [EXECUTE WITH TEAM]

---

## Scenario B — RDS High Latency (Not Down)

**Summary:** RDS responding in 3–8 seconds (normal: <100ms). Postgres is accessible — SELECT 1 passes, writes are very slow. `db_write_duration_ms` P95 spiking in CloudWatch. UBS reports: "appointments take >10 seconds to save."

**Key facts the team must know:**
- `/health` will show `postgres: "ok"` even during high latency (SELECT 1 still passes quickly)
- No circuit breaker activation — the circuit breaker only covers Upstash, not Postgres
- Data integrity is intact — writes succeed, just slowly
- withDb serializes writes — high concurrency worsens the backlog

**Decision matrix (team must know these thresholds):**

| Latency | Trajectory | Action |
|---------|-----------|--------|
| < 2s, falling | Recovering | Monitor only |
| 2–5s, stable | Plateaued | Communicate to UBS, check RDS CPU |
| > 5s, stable | Persistent | P1 escalation |
| > 5s + growing | Worsening | P1 + rollback evaluation |
| > 5s + 5xx increasing | Cascading | P0 + immediate rollback evaluation |

**Operator actions:**

Step 1 — Check write duration P95 in CloudWatch:
```
fields @timestamp, metric, value, driver
| filter event = "metric" and metric = "db_write_duration_ms"
| stats pct(value, 95) as p95_ms, avg(value) as avg_ms, count(*) as writes by driver, bin(5m)
| sort @timestamp desc
```

Step 2 — Check deadlock retries:
```
fields @timestamp, attempt, code
| filter event = "metric" and metric = "deadlock_retry"
| stats count(*) as retries by bin(5m)
| sort @timestamp desc
```

Step 3 — Check RDS Performance Insights (AWS Console → RDS → Performance Insights) for CPU, lock waits, full table scans.

PT-BR communication template (T+10min):
> "O VITRAS está operando com lentidão no momento. Salvar consultas e registros pode levar mais tempo que o normal. A equipe técnica está investigando. O sistema NÃO está fora do ar — apenas lento. Atualizações a cada 15 minutos."

**Post-scenario discussion questions:**
- Who has RDS Performance Insights access?
- Can RDS be scaled without downtime? Is Multi-AZ enabled?

**Scenario B score:** Diagnosis [1–5] / Resolution [1–5] / Communication [1–5] / SOP [1–5] / Overall [avg]
Score recorded: [EXECUTE WITH TEAM]

---

## Scenario C — Deploy Failed After Migration

**Summary:** Sprint 5 hotfix deploy (v1.1-hotfix) is attempted. Migration 009 runs but either errors mid-way or the app crashes after migration. `/readyz` returns 503. Previous version is not running. Zero user access.

**Critical distinction the team must understand:** Whether migration 009 COMMITTED or ROLLED BACK determines the recovery path.

**Key facts:**
- `checkCriticalMigrations()` prevents boot if migration 006 is missing — does NOT protect against future migration failures
- If migration committed + is backward-compatible with v1.0: code rollback is safe
- If migration committed + is NOT backward-compatible: code rollback alone will cause runtime errors in v1.0

**Operator actions:**

Step 1 — Confirm failure in CloudWatch:
```
fields @timestamp, event, phase
| filter event in ["migrations.failed_fatal", "startup.failed"]
| sort @timestamp desc
| limit 10
```

Step 2 — Communicate to UBS coordinator (T+6min):
> "Identificamos um problema técnico durante atualização do sistema. Iniciando restauração da versão anterior. Tempo estimado: 15–20 minutos. Os dados NÃO foram afetados."

Step 3 — Check migration commit status (before initiating code rollback):
```sql
-- Via bastion or admin DB endpoint
SELECT id, executed_at FROM schema_migrations ORDER BY executed_at;
-- Is 009 present? → determine decision tree path below
```

Step 4 — Decision tree (team must be able to walk through this):
```
Migration 009 in schema_migrations?
├── NO → Simple code rollback:
│       eb deploy --version v1.0-pilot-governed
│       Wait for /readyz 200
│       Run 3 smoke checks (login, patient read, audit log)
│
└── YES → Is 009 backward-compatible with v1.0?
    ├── YES (additive) → Code rollback safe — same as above
    └── NO (destructive) → Must ALSO restore DB from backup
            Follow: docs/operations/RUNBOOK_BACKUP_RESTORE.md
            ⚠ Data loss: records since pre-migration backup are lost
            ⚠ Notify UBS coordinator of data loss window
```

Restoration communication (T+22min — after rollback confirms /readyz 200):
> "Sistema VITRAS restaurado às [HH:MM]. Versão anterior reativada com sucesso. Todos os dados estão íntegros. Um novo deploy será agendado após investigação do problema."

**Post-scenario discussion questions:**
- Who besides Tech Lead can execute `eb deploy` in an emergency?
- Is there a policy that all pilot-period migrations must be additive only?

**Scenario C score:** Diagnosis [1–5] / Resolution [1–5] / Communication [1–5] / SOP [1–5] / Overall [avg]
Score recorded: [EXECUTE WITH TEAM]

---

## Scenario D — Critical User Cannot Access System

**Summary:** The gestor for UBS #1 cannot log in (forgot password, account deactivated, or locked after brute force). break_glass_admin action required.

**Key facts:**
- ALL break_glass_admin actions are audited — `actor = break_glass_admin` appears in audit log
- security_auditor MUST review the break_glass action within 24 hours (non-negotiable)
- break_glass_admin credentials must be in secure vault BEFORE go-live

**Case identification via audit log:**

| Event in audit log | Interpretation |
|-------------------|----------------|
| `auth.login_failed` (multiple) | Password incorrect → reset |
| `auth.account_locked` | Brute force triggered lock → unlock + reset |
| `user.deactivated` | Account deactivated → investigate who/why → reactivate |
| No events at all | Account may not exist → verify user creation |

**Operator actions:**

Step 1 — Check recent auth events:
```bash
GET /admin/governance/reports/auth-failures?since=[timestamp]
# OR
GET /audit-logs?userId=[userId]&since=[ISO-timestamp]
```

Step 2 — Case A (password): reset via break_glass_admin:
```bash
PATCH /admin/users/[id]/reset-password
Authorization: Bearer $BREAK_GLASS_TOKEN
```

Step 3 — Case B (deactivated): reactivate via break_glass_admin:
```bash
PATCH /admin/users/[id]/activate
Authorization: Bearer $BREAK_GLASS_TOKEN
```

Step 4 — Verify audit log records break_glass action:
```bash
GET /audit-logs?event=password_reset&since=[timestamp]
# Confirm: actor = break_glass_admin
```

Step 5 — Notify security_auditor immediately after break_glass use.

**Post-scenario discussion questions:**
- Are break_glass credentials in secure vault? Who has access?
- Does the security_auditor know they must review break_glass actions within 24h?

**Scenario D score:** Diagnosis [1–5] / Resolution [1–5] / Communication [1–5] / SOP [1–5] / Overall [avg]
Score recorded: [EXECUTE WITH TEAM]

---

## Scenario E — Data Inconsistency Post-Migration

**Summary:** After deploy, UBS staff report "Paciente já cadastrado" on new patient entries, or patients showing incorrect teamId assignments.

**Key facts:**
- Do NOT delete duplicate records unilaterally — escalate to Medical Director
- Do NOT use anonymization endpoint until KI-02 legal review completes (Sprint 5A)
- `PATIENT_LOOKUP_HASH_KEY` must NEVER be rotated without a corresponding hash rebuild
- `dryRun=true` on hash rebuild is safe — does NOT modify data

**CPF duplicate / hash issue diagnosis:**

Step 1 — Dry run hash rebuild:
```bash
curl -X POST "https://[url]/admin/rebuild-patient-hashes?dryRun=true" \
  -H "Authorization: Bearer $BREAK_GLASS_TOKEN" \
  | jq '{ok: .ok, issues: (.issues | length), sample_issues: .issues[:3]}'
```

Expected if no hash issues: `{ "ok": true, "issues": 0 }`
Expected if hash issues: `{ "ok": true, "issues": [N > 0], "sample_issues": [...] }`

Step 2 — If real duplicate record (same CPF, different data): escalate to Medical Director. Do NOT merge or delete unilaterally.

Step 3 — LGPD escalation path: Medical Director + DPO sign-off required for any merge or anonymization. Anonymization endpoint CANNOT be used until Sprint 5A legal review (per KI-02 constraint).

Broader inconsistency (multiple teamId errors):
1. Halt new patient registrations — communicate to UBS coordinator
2. Run dry run hash rebuild (Step 1)
3. Tech Lead assesses rollback: severity × affected records × recoverability
4. If rollback decided: `docs/operations/RUNBOOK_BACKUP_RESTORE.md`

**Post-scenario discussion questions:**
- Is PATIENT_LOOKUP_HASH_KEY documented as "never rotate without hash rebuild plan"?
- Is the Medical Director available for record-level clinical decisions?
- Is the DPO contact in `contatos.md`?

**Scenario E score:** Diagnosis [1–5] / Resolution [1–5] / Communication [1–5] / SOP [1–5] / Overall [avg]
Score recorded: [EXECUTE WITH TEAM]

---

## Scenario F — 5xx Spike

**Summary:** CloudWatch alarm `vitras-5xx-spike` fires. More than 10 errors in 5 minutes. Some users affected — scope depends on which endpoint is failing.

**Key facts:**
- First action is ALWAYS diagnosis (which endpoint?) before communication or escalation
- Error rate thresholds: <5% = P2 (monitor), 5–30% = P1 (targeted fix), >30% = P0 (rollback evaluation)
- Any cross-tenant data visible = P0 regardless of rate

**Operator actions:**

Step 1 — Identify failing endpoints:
```
fields @timestamp, @message, status_code, method, path
| filter event = "request_completed" AND status_code >= 500
| sort @timestamp desc
| limit 20
```

Step 2 — Get error rate:
```
fields @timestamp, status_code
| filter event = "metric" and metric = "request_completed"
| stats count(*) as total,
        sum(case when status_code >= 500 then 1 else 0 end) as errors
by bin(5m)
| eval error_pct = errors * 100 / total
| sort @timestamp desc
```

Step 3 — Read stack traces / error details for specific endpoint:
```
fields @timestamp, @message, level
| filter level = "error" and @timestamp > ago(30m)
| sort @timestamp desc
| limit 20
```

Step 4 — Check startup event query to confirm server is running:
```
fields @timestamp, @message
| filter event = "server_started" OR event = "startup.migrations.failed_fatal"
| sort @timestamp desc
| limit 10
```

Communication template (localized failure):
> "O registro de consultas está apresentando instabilidade no momento. Os profissionais podem documentar em papel temporariamente. Estimativa de resolução: [tempo]. Demais funcionalidades do sistema operam normalmente."

Communication template (widespread failure):
> "O VITRAS está com instabilidade técnica. A equipe técnica está trabalhando na resolução. Estimativa de restauração: [tempo]. Documentar em papel e lançar no sistema quando normalizar."

**Post-scenario discussion questions:**
- Is on-call alarm notification configured? (Email? SNS? WhatsApp?)
- Who can declare rollback? Is this documented?

**Scenario F score:** Diagnosis [1–5] / Resolution [1–5] / Communication [1–5] / SOP [1–5] / Overall [avg]
Score recorded: [EXECUTE WITH TEAM]

---

## Tabletop Scores

| Scenario | Diagnosis | Resolution | Communication | SOP | Overall |
|----------|----------|-----------|--------------|-----|---------|
| A — Redis outage | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| B — RDS latency | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| C — Deploy failed | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| D — User no access | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| E — Data inconsistency | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| F — 5xx spike | [1–5] | [1–5] | [1–5] | [1–5] | [avg] |
| **OVERALL** | | | | | **[fill]** |

Pass threshold: overall average ≥ 3/5

---

## Documentation Gaps — Status from lessons-learned-drill.md

| # | Gap | Status |
|---|-----|--------|
| Gap 1 | No AWS account emergency access escalation — if Tech Lead's AWS access fails, no backup operator documented | OPEN — requires `contatos.md` population + backup AWS operator identification |
| Gap 2 | EB CLI setup not verified before deploy window | CLOSED — `eb status` added to `checklist-pre-rollout.md` and `pre-deploy-validation.md` |
| Gap 3 | No read-only fallback during Redis outage — all requests fail 503 even for GET operations | OPEN as feature request — Sprint 5B; mitigated by paper documentation protocol |
| Gap 4 | Anonymization procedure not practiced or legally validated | OPEN — KI-02 constraint active; no anonymization until Sprint 5A legal review |
| Gap 5 | Patient count baseline must be captured before restore | CLOSED — explicit step in `dr-drill-final-report.md` (Section B pre-drill baseline) |
| Gap 6 | break_glass_admin creation chicken-and-egg problem | CLOSED — `backend/scripts/provision-remote-enterprise-user.mjs` confirmed; `docs/runbooks/production-bootstrap.md` created |
| Gap 7 | `contatos.md` has only placeholders | OPEN — requires UBS coordinator + TI Prefeitura + DPO input before go-live |

Gaps requiring pre-go-live action: 1, 4, 7 (and 3 requires UBS staff orientation)

---

## Gap Actions Identified During Live Tabletop

> Fill during or immediately after the team exercise. Add rows as needed.

| # | Gap Identified | Severity | Action | Owner | Target |
|---|---------------|----------|--------|-------|--------|
| 1 | [fill] | [H/M/L] | [fill] | [fill] | [fill] |
| 2 | [fill] | [H/M/L] | [fill] | [fill] | [fill] |

---

## Tabletop Readiness Checklist

- [ ] Scenario A (Redis outage): reviewed with team
- [ ] Scenario B (RDS latency): reviewed with team
- [ ] Scenario C (Deploy failed): reviewed with team
- [ ] Scenario D (User locked out): reviewed with team
- [ ] Scenario E (Data inconsistency): reviewed with team
- [ ] Scenario F (5xx spike): reviewed with team
- [ ] Team conducted live walkthrough: [PENDING]
- [ ] Overall score ≥ 3/5: [PENDING]
- [ ] All gaps from lessons-learned-drill.md reviewed and assigned

---

## Exercise Sign-Off

```
Tabletop Exercise Status:    PENDING LIVE EXECUTION WITH TEAM
Blocking UBS #1 go-live:     YES — conduct before deploy window

Date conducted: ___________
Duration: _____ minutes

Overall readiness assessment: [READY / NEEDS WORK / NOT READY]

Key gap requiring action before go-live: [fill or "None identified"]

Signed by Tech Lead: _________________________ Date: ___________
```

---

*Document version: v1.0-final — Created 2026-05-25*
*Source: `docs/rollout/ubs-001/tabletop-exercise-report.md`*
*Gap status source: `docs/rollout/ubs-001/lessons-learned-drill.md`*
