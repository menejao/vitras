# Final Go-Live Checklist — UBS #1 v1.0-pilot-governed

**Version:** v1.0-pilot-governed (tag: 81a704d, branch: release/pilot-baseline)
**Operator:** João Pedro
**Created:** 2026-05-25

> This is the SINGLE authoritative checklist for go-live day and the week before.
> Consolidated from: `checklist-pre-rollout.md`, `pre-deploy-validation.md`, `production-deploy-report.md`.
> All PENDING items from `ubs-001-final-go-no-go.md` are incorporated here.

---

## T-7 Days (1 Week Before Go-Live)

### Infrastructure — AWS (requires live access)

- [ ] **DR drill executed and PASSED** — `dr-drill-final-report.md` signed with RTO ≤ 240 min
  - Responsible: João Pedro
  - Estimated effort: 2–4 hours against vitras-staging
  - Blocking: YES — go-live cannot proceed without PASSED drill

- [ ] **Staging smoke test executed** — `staging-smoke-final-report.md` signed with zero critical failures
  - Responsible: João Pedro
  - Estimated effort: 1–2 hours (same day as DR drill recommended)
  - Blocking: YES

- [ ] **EB health check URL = /readyz** (verify in EB Console → Configuration → Load Balancer)
  - EB Console → Environment → Configuration → Load Balancer → Health Check Path: `/readyz`
  - NOT `/health` — `/readyz` is the strict liveness gate
  - Estimated effort: 15 minutes
  - Blocking: YES

- [ ] **All 8 CloudWatch alarms configured and active** (per `docs/cloudwatch-dashboard.md`)
  - [ ] `startup.failed`
  - [ ] `migrations.failed_fatal`
  - [ ] `5xx-spike` (>10 errors in 5 minutes)
  - [ ] `auth_failure-spike` (>20 failures in 5 minutes)
  - [ ] `circuit_breaker_opened`
  - [ ] `degraded_mode`
  - [ ] `deadlock_retry-spike`
  - [ ] `backup.health_warning`
  - Estimated effort: 2–4 hours
  - Blocking: YES

- [ ] **CloudWatch log group receiving logs** — test query returns results:
  ```
  fields @message | filter event = "server_started" | sort @timestamp desc | limit 5
  ```
  - Log group path: `/aws/elasticbeanstalk/vitras-prod/var/log/nodejs/nodejs.log`
  - Blocking: YES (alarm notification only works if logs flow)

- [ ] **RDS backup retention ≥ 7 days** — verify in AWS Console → RDS → Maintenance & Backups
  - Automated backups: Enabled
  - Retention: ≥ 7 days
  - Last backup: ≤ 24 hours old
  - Blocking: YES

- [ ] **VPC security groups restrict RDS to EB only** — verify no public RDS access
  - AWS Console → RDS → Security Groups → confirm EB security group ID is only inbound rule
  - Blocking: YES (KI-03 mitigation depends on VPC isolation)

### Accounts — Bootstrap (requires live EB + Postgres)

- [ ] **break_glass_admin created** via `provision-remote-enterprise-user.mjs`
  ```bash
  PROVISION_USER_ROLE=break_glass_admin \
  ALLOW_ENTERPRISE_REMOTE_PROVISIONING=true \
  DATABASE_URL=[staging-db-url] \
  node backend/scripts/provision-remote-enterprise-user.mjs
  ```
  - Full procedure: `docs/runbooks/production-bootstrap.md`
  - Confirm: audit log event `user.enterprise_provisioned` with `role: "break_glass_admin"`
  - Credentials stored in secure vault
  - Blocking: YES

- [ ] **security_auditor created** (optional but strongly recommended)
  - Same script with `PROVISION_USER_ROLE=security_auditor`
  - Blocking: STRONGLY RECOMMENDED — required for audit export and integrity checks

### Environment Variables (EB Configuration)

All variables verified via `eb printenv` or AWS Console → Configuration → Software.
**Do NOT log actual values — check presence and format only.**

- [ ] `NODE_ENV` = "production"
- [ ] `LOG_FORMAT` = "json" (required for CloudWatch structured logging)
- [ ] `APP_VERSION` = "v1.0-pilot-governed"
- [ ] `DATABASE_URL` starts with "postgres://"
- [ ] `DATA_ENCRYPTION_KEY` length ≥ 32 chars; `echo -n $KEY | wc -c`
- [ ] `PATIENT_LOOKUP_HASH_KEY` length ≥ 32 chars AND differs from DATA_ENCRYPTION_KEY
- [ ] `JWT_SECRET` length ≥ 32 chars
- [ ] `UPSTASH_REDIS_REST_URL` starts with "https://"
- [ ] `UPSTASH_REDIS_REST_TOKEN` non-empty
- [ ] `FRONTEND_ORIGINS` includes production frontend domain
- [ ] `AUDIT_PRUNE_ENABLED` = "false"
- [ ] `RUN_MIGRATIONS` = "true" (first deploy only; set to "false" for subsequent deploys)

### Operational Readiness

- [ ] **Deployment window confirmed with UBS coordinator**
  - Recommended: Tuesday or Wednesday, 18:00–22:00 local time
  - Coordinator notified and clinic flow adjusted

- [ ] **`contatos.md` fully populated** — all [fill] placeholders replaced with real names and phone numbers
  - Required contacts: DPO, Medical Director, UBS Coordinator, TI Prefeitura, AWS Support, Tech Lead backup
  - Gap 7 from lessons-learned-drill.md — MUST resolve before go-live
  - Blocking: YES

- [ ] **Tabletop exercise conducted with team** — `tabletop-final-report.md` signed, overall score ≥ 3/5

- [ ] **Paper documentation protocol confirmed with UBS**
  - UBS clinical staff briefed: if system shows 503, document on paper and enter later
  - Specifically mention Redis outage behavior (Gap 3 from lessons-learned-drill.md)

---

## T-3 Days

- [ ] **Staging quick re-validation** (10 minutes)
  ```bash
  curl https://[staging-url]/readyz | jq .    # expect 200 ok: true
  # + login test + 1 patient creation
  ```

- [ ] **Communication sent to UBS coordinator** — use template from `plano-comunicacao.md` (T-7 section)

- [ ] **EB CLI verified** — run and confirm output:
  ```bash
  eb status
  # Expected: Application=[name], Environment=[name], Status=Ready, Health=Green
  ```

- [ ] **`eb appversion` confirms v1.0-pilot-governed is available:**
  ```bash
  eb appversion
  # Must list v1.0-pilot-governed
  ```

- [ ] **Final RDS backup freshness check** — last backup < 24h old

- [ ] **Rollback syntax confirmed** (dry run mentally):
  ```bash
  eb deploy --version v1.0-pilot-governed
  # Do NOT run yet — confirm syntax only
  ```

---

## T-1 Day

- [ ] **Team briefed on go-live roles and responsibilities**
  - Tech Lead: deploy execution, monitoring, rollback decision
  - UBS Coordinator: user communication, clinic flow management
  - TI Prefeitura: infrastructure escalation (if needed)

- [ ] **Communication sent to UBS** — use template from `plano-comunicacao.md` (T-1d section)

- [ ] **TI Prefeitura notified** — confirm they are available D+0

- [ ] **Staging /readyz confirmed 200** (last sanity check)

- [ ] **Emergency contacts verified available D+0**
  - All contacts from `contatos.md` are reachable

- [ ] **Paper forms confirmed at UBS** — contingency if system down >1h

- [ ] **`pre-deploy-validation.md` completed and signed** by Tech Lead

---

## T-0 — Deploy Day

### Before Deploy Window Opens (T-0 minus 1h)

- [ ] **Confirm RDS backup from today available** (automated backup within last 24h)
- [ ] **Confirm all team members available** and reachable
- [ ] **Confirm UBS atendimentos closed** / clinic paused for deploy window
- [ ] **Open incident channel** (WhatsApp group or email thread — all on-call contacts added)
- [ ] **EB CLI verified one more time:** `eb status` → Ready + Green
- [ ] **Record baseline time:** _____ UTC

### Deploy Execution (T-0)

- [ ] `git log --oneline -1` on deploy machine confirms correct commit hash
- [ ] **Deploy initiated** — record exact time: ___________ UTC
  ```bash
  eb deploy --version v1.0-pilot-governed
  # OR: eb deploy (if on release/pilot-baseline branch)
  ```

- [ ] **Monitor /readyz during startup** (expect 503 while migrating/warming):
  ```bash
  watch -n 15 "curl -s -o /dev/null -w '%{http_code}\n' https://[url]/readyz"
  # Expected sequence: 503 → 503 → ... → 200
  ```

- [ ] **/readyz 503 confirmed** during startup (EB not routing early — correct behavior)

- [ ] **/readyz 200 confirmed** — record time: ___________ UTC
  - This is the moment the server is ready to serve traffic

- [ ] **`server_started` log in CloudWatch** — run query:
  ```
  fields @timestamp, event, port, driver, version
  | filter event = "server_started"
  | sort @timestamp desc
  | limit 1
  ```
  - Confirm: `driver: "postgres"`, `version: "v1.0-pilot-governed"`

- [ ] **All CloudWatch alarms green** (no alarms firing)

- [ ] **Login test: break_glass_admin** — confirm login succeeds, token received

- [ ] **POST /admin/units/bootstrap** — create UBS #1 unit:
  ```bash
  curl -X POST https://[url]/admin/units/bootstrap \
    -H "Authorization: Bearer $BREAK_GLASS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"UBS #1 [name]","code":"UBS001"}' \
    | jq '{ok: .ok, unitId: .unit.id}'
  ```
  Record unitId: ___________

- [ ] **Gestor user created and login successful**

- [ ] **Minimal smoke test:** create 1 test patient, create 1 appointment, read audit log
  ```bash
  # Patient creation
  curl -X POST https://[url]/patients \
    -H "Authorization: Bearer $GESTOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Teste Go-Live","cpf":"[test-cpf]","birthDate":"1990-01-01"}' \
    | jq '{ok: .ok, id: .patient.id}'

  # Audit log
  curl -H "Authorization: Bearer $GESTOR_TOKEN" https://[url]/audit-logs \
    | jq '{ok: .ok, count: (.logs | length)}'
  ```

### GO/NO-GO Gate (T+30 minutes)

Complete this assessment at exactly 30 minutes after /readyz 200:

- [ ] **No 5xx errors in first 30 minutes** — verify:
  ```
  fields @timestamp, status_code
  | filter event = "metric" and metric = "request_completed" and status_code >= 500
  | sort @timestamp desc
  | limit 10
  ```

- [ ] **Audit log recording correctly** — new events visible from smoke test

- [ ] **All CloudWatch alarms still green** (no change from deploy)

- [ ] **No unexpected circuit breaker events** — verify:
  ```
  fields @timestamp, event
  | filter event in ["circuit_breaker_opened", "degraded_mode_set"]
  | sort @timestamp desc
  | limit 5
  ```

**If all above checks pass:**
- [ ] **GO declared** — record exact time: ___________ UTC
- [ ] **UBS coordinator notified of GO**

**If any check fails:**
- [ ] **Evaluate: is this a P0?** (data exposure, auth failure, multi-tenant isolation breach)
  - P0: Immediate rollback + DPO notification
  - P1-P2: Tech Lead assessment — may proceed with monitoring or rollback

---

## T+1h to T+4h — Assisted Go-Live

- [ ] **Tech Lead available on-site or video call** (uninterrupted availability)

- [ ] **First real patient registered** by UBS staff — confirm with coordinator

- [ ] **First real appointment created** — confirm with coordinator

- [ ] **ACS verified: cannot see cross-team patients** — run quick check:
  ```bash
  # ACS from team A attempts to access patient from team B
  curl -H "Authorization: Bearer $ACS_TOKEN" https://[url]/patients/[team-b-patient-id]
  # Expected: 403
  ```

- [ ] **Any issues arising:** follow `docs/operations/incident-response.md` procedure
  - P0 criteria: multi-tenant data visible, auth bypass, data loss
  - P1 criteria: widespread 5xx, user cannot log in, circuit breaker open >30min

- [ ] **`production-deploy-report.md` completed** (fill during this window)

---

## T+24h

- [ ] **`d0-go-live-report.md` completed** and reviewed with coordinator

- [ ] **CloudWatch overnight review:**
  - 5xx count (12h window): query below — record count
  - Auth failure count: record count
  ```
  fields @timestamp, status_code
  | filter event = "metric" and metric = "request_completed" and status_code >= 500
  | sort @timestamp desc
  | limit 50
  ```

- [ ] **Any incidents from D+0:** documented in `docs/operations/incident-response.md` log

- [ ] **`d1-report.md` prepared** for morning review

---

## Post-Go-Live Commitments (D+0 to D+14)

- No new features or schema changes during D+1 to D+7 observation window
- Daily checklist per `docs/operations/operational-routines.md`
- Any P0 or P1 during D+1 to D+14 halts Phase 2 planning
- D+14 report (`d14-report.md`) required before UBS #2 planning
- KI-02 (LGPD anonymization legal review) in Sprint 5A regardless of incident activity
- KI-01, KI-03 code fixes in Sprint 5A/5B

---

*Document version: v1.0-final — Created 2026-05-25*
*Consolidated from: `checklist-pre-rollout.md`, `pre-deploy-validation.md`, `production-deploy-report.md`, `ubs-001-go-no-go-decision.md`, `operational-readiness-assessment.md`*
