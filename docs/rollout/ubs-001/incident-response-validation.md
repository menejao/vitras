# Incident Response Validation — UBS #1

**Date:** 2026-05-25
**Conductor:** João Pedro
**Version:** v1.0-pilot-governed

> This document validates the incident response procedure (`docs/operations/incident-response.md`) through structured simulations. Two scenarios are run: one P0 (cross-tenant isolation failure) and one P1 (clinical record creation failing). Teams walk through the timeline and fill in the validation scores.

---

## SEV-1 Simulation (P0): Cross-Tenant Patient Data Visible

**Trigger:** ACS from Team A reports seeing a patient from Team B in their patient list — a patient they have no clinical relationship with, from a different team within the same UBS.

**Why this is P0:** This is a patient data isolation failure — the most critical category. Regardless of cause (bug, misconfiguration, race condition), confirmed cross-tenant access is an immediate rollback trigger per `docs/operations/incident-response.md`.

**LGPD implications:** If a patient record from Team B was confirmed visible to Team A's ACS, LGPD requires DPO notification. The DPO must assess whether ANPD notification is required within 72 hours of the breach.

---

### Timeline Simulation

| Time | Action | Actor | Expected Output | Validation Question |
|------|--------|-------|----------------|---------------------|
| T+0 | UBS coordinator receives report from ACS: "Estou vendo paciente de outra equipe" | UBS Coordinator | Report logged with: user ID, patient name seen, timestamp | Who receives the call? |
| T+0 | P0 declared immediately — no investigation required before declaration | Tech Lead | P0 channel opened, clock starts | Is Tech Lead contactable 24/7? |
| T+2min | Tech Lead isolates scope: which ACS user? which patient? which endpoint? | Tech Lead | ACS user ID, patient record ID, endpoint (e.g., GET /patients) | Can this be determined without production access? |
| T+3min | Check audit logs for cross-team access events | Tech Lead | `GET /audit-logs?userId=[acs-id]&event=patient.accessed` | Are audit logs queryable by user ID? |
| T+5min | Attempt reproduction in STAGING — NOT in production | Tech Lead | If reproducible: confirm the bug exists; if not: assess if it was a data error | Is staging environment available for immediate use? |
| T+10min | Check `getAllowedPatients` logic: is teamId filter applied? | Tech Lead | Code review of patient query — does it always filter by teamId? | Does Tech Lead have access to source code and logs simultaneously? |
| T+12min | DECISION POINT: confirmed isolation bug? | Tech Lead | YES → immediate rollback; NO → continue investigation | Who has authority to declare rollback? |
| T+15min | IF CONFIRMED: Notify DPO | Tech Lead | DPO notified: nature of exposure, affected users, scope, timestamp | Is DPO contact in `contatos.md`? |
| T+15min | IF CONFIRMED: EB rollback initiated | Tech Lead | `eb deploy --version v1.0-pilot-governed` or EB Console | Does Tech Lead have EB access ready? |
| T+20min | Rollback in progress — EB deploying previous version | EB | EB status: "Deploying" | Is rollback command tested (per DR drill)? |
| T+35min | Rollback complete — /readyz 200 | System | Previous version serving traffic | Verify: /readyz 200 on previous version |
| T+40min | Verify: cross-tenant access no longer reproducible in staging | Tech Lead | Staging test: ACS cannot see Team B patients | Was the bug in the deployed version? |
| T+60min | DPO receives formal incident report | Tech Lead | Report: timeline, affected users, patient records exposed, rollback action | Template: see `docs/operations/incident-response.md` |
| T+24h | Root cause analysis complete | Tech Lead | Written RCA: which code path failed, why teamId filter was bypassed | Post-mortem format: see incident-response.md |
| T+72h | Preventive fix implemented, QA, re-deploy scheduled | Tech Lead + QA | Fix in dev, tested, scheduled for re-deploy only after QA confirms | Does QA sign off before next deploy? |

---

### Validation Questions

| # | Question | Expected Answer | Actual Answer (fill) | Validated? |
|---|----------|----------------|---------------------|-----------|
| 1 | Does the team know who the DPO is? | YES — named in contatos.md | [fill] | [ ] |
| 2 | Is DPO contact in `contatos.md`? | YES | [fill] | [ ] |
| 3 | Can Tech Lead reproduce the issue in staging in < 15 minutes? | YES — audit logs + staging env available | [fill] | [ ] |
| 4 | Does the rollback complete in < 20 minutes from decision? | YES — per DR drill target | [fill] | [ ] |
| 5 | Is the ANPD 72-hour notification requirement documented? | YES — DPO is responsible for ANPD assessment | [fill] | [ ] |
| 6 | Is there a designated backup for Tech Lead (can also execute rollback)? | SHOULD BE YES | [fill] | [ ] |
| 7 | Are audit logs sufficient to determine scope of exposure? | YES — audit logs record every patient access | [fill] | [ ] |

---

### P0 Response Time Targets

| Metric | Target | Actual (fill after drill) | Pass? |
|--------|--------|--------------------------|-------|
| P0 declaration | Immediate on confirmed report | [fill] | [ ] |
| DPO notification (if confirmed) | ≤ 30 minutes | [fill] | [ ] |
| Rollback initiation | ≤ 15 minutes from confirmation | [fill] | [ ] |
| Rollback completion | ≤ 35 minutes from P0 declaration | [fill] | [ ] |
| Incident report to DPO | ≤ 60 minutes | [fill] | [ ] |
| RCA complete | ≤ 24 hours | [fill] | [ ] |
| Preventive fix + QA | ≤ 72 hours | [fill] | [ ] |

---

### P0 Simulation Verdict

```
SEV-1 Simulation PASSED / FAILED / NOT EXECUTED

Key finding: [fill]

Blocking issues (if any): [fill or "None"]

Signed: _________________________ Date: _______
```

---

## SEV-2 Simulation (P1): Clinical Records Creation Failing for All Doctors

**Trigger:** Two or more doctors report they cannot save clinical records. HTTP 500 error displayed when submitting consultation notes. Other system functions (login, patient lookup) continue working.

**Why this is P1:** Clinical record creation is a core clinical function. While emergency paper documentation is possible (clinical continuity maintained), this significantly disrupts the UBS workflow and cannot be deferred more than 1 hour.

**Clinical safety note:** Paper documentation as a temporary fallback is acceptable for < 2 hours. The UBS clinical protocol should include a procedure for paper-based documentation during system unavailability.

---

### Timeline Simulation

| Time | Action | Actor | Expected Output | Validation Question |
|------|--------|-------|----------------|---------------------|
| T+0 | Two doctors report 500 error on POST /patients/:id/records | Doctors → UBS Coordinator | Report: which endpoint, error message seen, which patients affected | Is there a defined reporting chain? |
| T+2min | UBS coordinator contacts Tech Lead | UBS Coordinator | Tech Lead receives alert with: endpoint, error message, timestamp | Is Tech Lead contact available 24/7? |
| T+5min | Confirm via CloudWatch: 5xx spike on POST endpoint | Tech Lead | CW Insights: `path like /records/ and status_code >= 500 count > 0` | Can Tech Lead access CW from mobile? |
| T+5min | Read error stack trace in logs | Tech Lead | Specific error identified (e.g., DB constraint, null reference, FK violation) | Are logs structured enough to identify root cause quickly? |
| T+8min | Confirm: other functions working (login, GET /patients) | Tech Lead | /readyz 200, login works, GET /patients works | Is the failure isolated? |
| T+8min | Confirm: clinical staff can document on paper temporarily | UBS Coordinator | Paper fallback confirmed — clinical continuity maintained | Is paper protocol established? |
| T+10min | Determine: deploy-correlated? (check deploy time vs first error) | Tech Lead | If deploy happened in last 30 min: rollback evaluation; if no recent deploy: hotfix path | Is EB deploy history visible? |
| T+15min | COMMUNICATION sent to UBS coordinator | Tech Lead | Template below | Was communication within 15 min of detection? |
| T+20min | If deploy-correlated: rollback initiated | Tech Lead | `eb deploy --version v1.0-pilot-governed` | Is rollback decision within 20 min? |
| T+30min | If NOT deploy-correlated: root cause identified and hotfix path confirmed | Tech Lead | Code path identified from stack trace | Can hotfix be deployed within 2 hours? |
| T+30min | Resolution OR escalation path confirmed | Tech Lead | Either: rollback complete, OR: hotfix ETA confirmed, OR: P0 escalation | Is 30-min decision window achievable? |
| T+60min | P1 target: system restored OR clear escalation path | Tech Lead | /readyz 200, POST /records working | Is 1-hour target met? |

**Communication template (T+15min — to UBS coordinator):**
> "O registro de consultas está apresentando instabilidade técnica. Os profissionais podem documentar em papel temporariamente e lançar no sistema quando normalizar. Estamos investigando — estimativa de resolução: [X minutos / em andamento]. Demais funções do sistema (login, consulta de pacientes) operam normalmente. Próxima atualização em 15 minutos."

**Communication template (resolution):**
> "O problema no registro de consultas foi resolvido às [HH:MM]. O sistema está funcionando normalmente. Os registros em papel podem ser lançados agora."

---

### Validation Scores

| Metric | Target | Actual (fill after simulation) | Pass? |
|--------|--------|-------------------------------|-------|
| First response time (Tech Lead receives report) | < 10 minutes | [fill] minutes | [ ] |
| Diagnosis time (root cause identified) | < 20 minutes | [fill] minutes | [ ] |
| Communication to UBS coordinator | < 15 minutes after detection | [fill] minutes | [ ] |
| Resolution or rollback decision confirmed | < 60 minutes | [fill] minutes | [ ] |
| Clinical continuity maintained via paper | Confirmed | [fill: YES / NO] | [ ] |

---

### P1 Response Checklist

Run this checklist during the simulation:

- [ ] Error endpoint identified from CloudWatch within 5 minutes
- [ ] Stack trace readable and informative (not just "Internal server error")
- [ ] Paper documentation fallback confirmed with UBS coordinator
- [ ] Communication sent to UBS coordinator within 15 minutes
- [ ] Deploy correlation check performed (EB deploy history reviewed)
- [ ] Root cause identified within 20 minutes
- [ ] Decision made: rollback vs hotfix vs P0 escalation
- [ ] Resolution confirmed and communicated to UBS coordinator

---

### P1 Simulation Verdict

```
SEV-2 Simulation PASSED / FAILED / NOT EXECUTED

Key finding: [fill]

Blocking issues (if any): [fill or "None"]

Was communication within target time? YES / NO
Was diagnosis within target time? YES / NO
Was resolution decision within target time? YES / NO

Signed: _________________________ Date: _______
```

---

## Overall Incident Response Validation Score

| Dimension | P0 Simulation | P1 Simulation | Notes |
|-----------|--------------|--------------|-------|
| Escalation path clarity | [1–5] | [1–5] | [fill] |
| Contact availability | [1–5] | [1–5] | [fill] |
| Tooling readiness (CW, EB CLI, audit logs) | [1–5] | [1–5] | [fill] |
| Communication template quality | [1–5] | [1–5] | [fill] |
| Decision authority clarity | [1–5] | [1–5] | [fill] |
| Clinical continuity fallback | N/A | [1–5] | [fill] |
| **OVERALL** | | | |

---

## Pre-Go-Live Requirements from This Validation

| Requirement | Status | Owner |
|------------|--------|-------|
| DPO contact in contatos.md | [ ] PENDING | João Pedro + UBS |
| break_glass_admin account created | [ ] PENDING | João Pedro |
| security_auditor account created | [ ] PENDING | João Pedro |
| Paper documentation protocol established with UBS | [ ] PENDING | UBS Coordinator |
| EB CLI + console access verified | [ ] PENDING | João Pedro |
| CloudWatch access confirmed on mobile | [ ] PENDING | João Pedro |

---

*Document version: v1.0 — Created 2026-05-25*
