# Rollback Validation — UBS #1

**Date:** 2026-05-25
**Conductor:** João Pedro
**Version:** v1.0-pilot-governed

> This document validates the rollback procedure via tabletop execution. The scenario: a deploy at T+0 fails, and at T+45min the decision to rollback is made. Walk through each step, confirm timing, and fill in the validation scores.

---

## Rollback Scenario Premises

**Scenario:** Deploy of a new version initiated at T+0. At T+45min, `/readyz` still returns 503. Root cause not yet identified. Tech Lead declares rollback to `v1.0-pilot-governed`.

**Data loss assessment for this specific scenario:**
- The failed deploy replaced the running version but the new version never started accepting traffic.
- `/readyz` was returning 503 continuously from T+0 to T+45min.
- No user requests were served by the new version.
- **Result: ZERO data loss** — no writes were possible while the app was down.
- Record in rollback log: "No data loss — app was not serving requests during failed deploy window (T+0 to T+45min)."

---

## Step-by-Step Rollback Execution

| Time | Step | Action | Command / Location | Expected Result | Actual Result (fill) | Pass? |
|------|------|--------|-------------------|----------------|---------------------|-------|
| T+45min | **Decision declared** | Tech Lead declares rollback | Verbal declaration + log entry | Decision documented with timestamp | [fill] | [ ] |
| T+46min | **Notify UBS coordinator** | Communication sent | Phone / WhatsApp — template below | Coordinator notified before any action | [fill] | [ ] |
| T+47min | **EB rollback initiated** | Deploy previous version | Option A or B below | EB shows "Deploying" status | [fill] | [ ] |
| T+47–50min | **EB deploying previous version** | Wait for deployment | `eb status` every 30s | Status: "Updating" → "Deploying" | [fill] | [ ] |
| T+55min | **/readyz first probe** | Check readiness | `curl https://[url]/readyz` | 503 (still warming) or 200 (ready) | [fill: code] | [ ] |
| T+57min | **/readyz 200 confirmed** | Instance ready | `curl https://[url]/readyz` | `{ ok: true, readiness: { ready: true, phase: "ready" } }` | [fill] | [ ] |
| T+58min | **Smoke test: login** | POST /auth/login | Test gestor credentials | `{ ok: true, token: "[present]" }` | [fill] | [ ] |
| T+59min | **Smoke test: patient read** | GET /patients | Bearer token from login | `{ ok: true, patients: [...] }` | [fill] | [ ] |
| T+60min | **Smoke test: audit log** | GET /audit-logs | Bearer token (gestor or security_auditor) | `{ ok: true, logs: [...] }` | [fill] | [ ] |
| T+62min | **GO declaration** | Previous version confirmed stable | Verbal declaration | System operational on v1.0-pilot-governed | [fill] | [ ] |
| T+63min | **Notify UBS coordinator: restored** | Communication sent | Phone / WhatsApp — template below | Coordinator confirms users can access system | [fill] | [ ] |
| T+65min | **D+0 go-live report updated** | Log rollback event | `d0-go-live-report.md` | Rollback event documented | [fill] | [ ] |

**Total time from decision to restored: ~20 minutes (T+45 to T+65)**

---

## Rollback Commands

### Option A — EB Console (Preferred, no CLI required)

```
1. AWS Console → Elastic Beanstalk
2. Navigate to: [application name] → [environment name]
3. Click "Application Versions" (left sidebar)
4. Find version label: v1.0-pilot-governed
5. Select it → click "Deploy"
6. Select target environment → click "Deploy"
7. Monitor: EB console → Health dashboard
```

### Option B — EB CLI

```bash
# Verify current environment before rollback
eb status
# Expected: Environment: [env-name], Status: Ready (or Severe/Degraded)

# List available versions
eb appversion
# Confirm v1.0-pilot-governed appears in the list

# Deploy previous version
eb deploy --version v1.0-pilot-governed
# Monitor output for deployment progress
```

### Option C — AWS CLI (if EB CLI not configured)

```bash
# List application versions
aws elasticbeanstalk describe-application-versions \
  --application-name vitras \
  --query 'ApplicationVersions[*].{Label:VersionLabel,Status:Status}'

# Deploy specific version to environment
aws elasticbeanstalk update-environment \
  --environment-name [env-name] \
  --version-label v1.0-pilot-governed
```

---

## Communication Templates

**T+46min — Rollback initiated (before actions):**
> "Identificamos um problema técnico que requer retorno à versão anterior do sistema. O processo levará aproximadamente 15–20 minutos. Os dados inseridos nas últimas [X horas] durante o período de instabilidade [não foram afetados / podem precisar ser revistos — especificar]. Entraremos em contato assim que o sistema estiver restaurado."

**T+63min — Rollback complete:**
> "Sistema VITRAS restaurado com sucesso às [HH:MM]. Versão anterior reativada. Todos os dados estão íntegros — não houve perda de dados neste incidente. Um novo deploy será agendado após investigação completa."

---

## Rollback Validation Questions

Answer each question as part of the tabletop exercise:

| # | Question | Expected Answer | Actual Answer (fill) | Validated? |
|---|----------|----------------|---------------------|-----------|
| 1 | Who has EB Console access? | Tech Lead + designated backup only | [fill: names] | [ ] |
| 2 | Who has EB CLI configured with correct profile? | At minimum: Tech Lead | [fill: names] | [ ] |
| 3 | `eb status` returns correct environment name? | YES — pre-verified | [fill: run and record output] | [ ] |
| 4 | `eb appversion` lists v1.0-pilot-governed? | YES | [fill: run and record output] | [ ] |
| 5 | Is there a "go-live backup" snapshot taken immediately before deploy? | YES — part of pre-deploy checklist | [fill: snapshot ID] | [ ] |
| 6 | Is the rollback decision authority clear? | YES — Tech Lead declares; no committee needed for P0/P1 | [fill] | [ ] |
| 7 | Is the time from decision to first `/readyz` 200 < 20 min? | YES — target per this runbook | [fill: actual time] | [ ] |
| 8 | Does the UBS coordinator know to expect ~20 min downtime? | YES — communicated at T+46min | [fill] | [ ] |
| 9 | Is the v1.0-pilot-governed version confirmed in EB application versions? | Must be YES before go-live | [fill] | [ ] |

---

## Data Loss Assessment Matrix

Use this matrix to determine whether the rollback scenario results in data loss:

| Scenario | Was app serving traffic? | Was data written? | Data Loss? | Action |
|----------|------------------------|------------------|-----------|--------|
| New deploy failed — /readyz 503 entire time | NO | NO | ZERO | No user notification needed for data loss |
| New deploy partially started — some requests served | YES (partial) | POSSIBLY | Investigate | Identify data written T+0 to T+decision; notify UBS of window |
| Rollback decision after app was running normally | YES | YES | YES (since backup) | Notify UBS of exact window; offer re-entry support |
| Rollback after cross-tenant bug | YES | POSSIBLY | Investigate | Forensic review before notifying scope |

**For this specific scenario (T+0 to T+45min of 503):**
- App was NOT serving user requests during the failure window.
- Data loss: ZERO.
- No user data notification required.

---

## Post-Rollback Checklist

Complete after rollback is confirmed successful:

- [ ] Incident report written (P0 or P1 level — see incident-response.md)
- [ ] Root cause investigation started: what caused the deploy failure?
- [ ] Fix confirmed in dev branch before scheduling new deploy
- [ ] QA re-audit of the fix
- [ ] New deploy window NOT scheduled until root cause understood
- [ ] UBS coordinator confirmed system is operational
- [ ] D+0 go-live report (or operational log) updated with rollback event
- [ ] Data loss assessment documented (see matrix above)
- [ ] If KI or tech debt surfaced: add to technical debt log

---

## Rollback Validation Score

| Dimension | Score (1–5) | Notes |
|-----------|------------|-------|
| Command clarity | [1–5] | Are EB Console / CLI steps unambiguous? |
| Access readiness | [1–5] | Does at least one person have verified EB access right now? |
| Communication template quality | [1–5] | Are templates appropriate for UBS audience? |
| Data loss assessment confidence | [1–5] | Can we definitively say there is/is not data loss? |
| Total time confidence | [1–5] | Confident rollback completes in < 20 minutes? |
| **OVERALL** | [avg] | |

---

## Rollback Validation Sign-Off

```
Rollback Validation: PASSED / FAILED / NOT EXECUTED

Key finding: [fill]

Blocking issues (if any): [fill or "None — proceed to go-live"]

EB CLI/Console verified: YES / NO
v1.0-pilot-governed confirmed in EB: YES / NO
Time target (< 20 min) achievable: YES / NO

Signed: _________________________ Date: _______
```

---

*Document version: v1.0 — Created 2026-05-25*
