# Go-Live Coordinator Guide — UBS #1 v1.0-pilot-governed

**Authority:** This is the single authoritative execution guide for the human operator on go-live day.
**Version:** v1.0-pilot-governed (tag: 81a704d, branch: release/pilot-baseline)
**Operator:** João Pedro
**Created:** 2026-05-25
**Synthesized from:** `final-go-live-checklist.md`, `ubs-001-final-go-no-go.md`, `dr-drill-final-report.md`, `staging-smoke-final-report.md`, `tabletop-final-report.md`, `operational-readiness-assessment.md`, `rollback-plan.md`, `checklist-pre-rollout.md`, `production-bootstrap.md`

> Code-verified facts are labeled **[CODE-VERIFIED]**. Items requiring live infrastructure are labeled **[REQUIRES LIVE EXECUTION]**.

---

## PHASE 0 — PREREQUISITES
> Complete all of Phase 0 before scheduling a go-live window. These cannot be done on deploy day.

---

### 0.1 — Create break_glass_admin [REQUIRES LIVE EXECUTION]

The application cannot be bootstrapped without this account. It must exist before T-0.

```bash
# Run on EB instance via `eb ssh`, or in a CI runner with DATABASE_URL set to production DB.
# The app must already be deployed (i.e. /readyz returns 200) before running this.
cd /var/app/current

ALLOW_ENTERPRISE_REMOTE_PROVISIONING=true \
PROVISION_USER_EMAIL="admin@sua-secretaria.gov.br" \
PROVISION_USER_PASSWORD="$(openssl rand -base64 24)" \
PROVISION_USER_NAME="Administrador VITRAS" \
PROVISION_USER_ROLE="break_glass_admin" \
PROVISION_REASON="Bootstrap UBS-001 — primeiro admin producao" \
node backend/scripts/provision-remote-enterprise-user.mjs
```

**Expected response:**
```json
{ "ok": true, "mode": "created", "email": "admin@...", "role": "break_glass_admin" }
```

**Immediately after:** Store the generated password in the organization's secure vault (AWS Secrets Manager, 1Password, Bitwarden, or equivalent). Record the email in `contatos.md`.

**Audit verification:**
```bash
TOKEN=$(curl -s -X POST https://[PROD_URL]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sua-secretaria.gov.br","password":"[generated-password]"}' \
  | jq -r '.access_token')

curl -s -H "Authorization: Bearer $TOKEN" https://[PROD_URL]/audit-logs \
  | jq '[.[] | select(.event == "user.enterprise_provisioned")] | .[0]'
# Expected: audit entry with role: "break_glass_admin"
```

---

### 0.2 — Create security_auditor [REQUIRES LIVE EXECUTION] (Strongly Recommended)

Required for audit log export and integrity checks. The security_auditor must review any break_glass action within 24 hours of use.

```bash
cd /var/app/current

ALLOW_ENTERPRISE_REMOTE_PROVISIONING=true \
PROVISION_USER_EMAIL="auditor@sua-secretaria.gov.br" \
PROVISION_USER_PASSWORD="$(openssl rand -base64 24)" \
PROVISION_USER_NAME="Auditor de Segurança" \
PROVISION_USER_ROLE="security_auditor" \
PROVISION_REASON="Bootstrap UBS-001 — auditor de segurança" \
node backend/scripts/provision-remote-enterprise-user.mjs
```

**Expected response:**
```json
{ "ok": true, "mode": "created", "email": "auditor@...", "role": "security_auditor" }
```

Store credentials separately from break_glass_admin. Record in `contatos.md`.

---

### 0.3 — Verify EB Health Check Path is /readyz [REQUIRES LIVE EXECUTION]

**[CODE-VERIFIED]** The `/readyz` endpoint returns 503 during phases `booting`, `migrating`, `warming` and 200 only at phase `ready`. The `/health` endpoint returns 200 even during degraded mode — it must NOT be the EB health check.

**Via AWS Console:**
1. AWS Console → Elastic Beanstalk → [application] → [environment]
2. Configuration → Load balancer → Processes → default
3. Health check path: `/readyz`
4. Matcher HTTP code: `200`
5. Healthy threshold: 3
6. Interval: 30s

**Via EB CLI:**
```bash
eb config | grep -A2 "HealthCheckPath"
# Expected: HealthCheckPath: /readyz
```

**Via AWS CLI:**
```bash
aws elasticbeanstalk describe-environment-health \
  --environment-name [your-env-name] \
  --attribute-names HealthStatus \
  --query 'HealthStatus'
```

---

### 0.4 — Validate All EB Environment Variables [REQUIRES LIVE EXECUTION]

**[CODE-VERIFIED]** `validateProductionConfig()` in `startup.js` runs at the top of `startServer()` before any DB connections. It will abort startup if required vars are missing.

```bash
# Print non-sensitive vars to confirm presence
eb printenv | grep -v "PASSWORD\|KEY\|SECRET\|TOKEN\|URL"

# Sensitive vars: verify PRESENCE only via AWS Console
# → EB → Configuration → Software → Environment properties
```

Verify each variable is set (do not log values):

| Variable | Requirement |
|----------|------------|
| `NODE_ENV` | Must be `"production"` |
| `LOG_FORMAT` | Must be `"json"` (required for CloudWatch structured log parsing) |
| `APP_VERSION` | Must be `"v1.0-pilot-governed"` |
| `DATABASE_URL` | Must start with `postgres://` |
| `DATA_ENCRYPTION_KEY` | Length ≥ 32 chars — verify: `echo -n "$KEY" \| wc -c` |
| `PATIENT_LOOKUP_HASH_KEY` | Length ≥ 32 chars AND must differ from `DATA_ENCRYPTION_KEY` |
| `JWT_SECRET` | Length ≥ 32 chars |
| `UPSTASH_REDIS_REST_URL` | Must start with `https://` |
| `UPSTASH_REDIS_REST_TOKEN` | Non-empty |
| `FRONTEND_ORIGINS` | Must include the production frontend domain |
| `AUDIT_PRUNE_ENABLED` | Must be `"false"` (string) — audits must NOT be pruned during pilot |
| `RUN_MIGRATIONS` | `"true"` for first deploy; `"false"` for subsequent deploys |

**Key uniqueness check:**
```bash
# Run these on the machine where you can access the values — do NOT log the outputs
echo -n "$DATA_ENCRYPTION_KEY" | sha256sum
echo -n "$PATIENT_LOOKUP_HASH_KEY" | sha256sum
# The two hashes must differ
```

---

### 0.5 — Configure CloudWatch Alarms (8 Required) [REQUIRES LIVE EXECUTION]

See `docs/rollout/ubs-001/cloudwatch-alarm-setup.md` for the complete step-by-step guide with exact AWS CLI commands.

**Summary of 8 required alarms:**

| # | Alarm Name | Filter Event/Metric | Threshold | Period |
|---|-----------|---------------------|-----------|--------|
| 1 | VITRAS-startup-failed | `$.event = "startup.failed"` | ≥ 1 | 60s |
| 2 | VITRAS-5xx-spike | `$.event = "request_completed" && $.status_code >= 500` | ≥ 10 | 300s |
| 3 | VITRAS-auth-failures | `$.metric = "auth_failure"` | ≥ 20 | 300s |
| 4 | VITRAS-circuit-breaker | `$.event = "circuit_breaker_opened"` | ≥ 1 | 60s |
| 5 | VITRAS-degraded-mode | `$.phase = "degraded"` | ≥ 1 | 60s |
| 6 | VITRAS-deadlock-retry | `$.metric = "deadlock_retry"` | ≥ 5 | 300s |
| 7 | VITRAS-backup-warning | `$.event = "backup.health_warning"` | ≥ 1 | 300s |
| 8 | VITRAS-migrations-failed | `$.event = "migrations.failed_fatal"` | ≥ 1 | 60s |

**Log group name:** `/aws/elasticbeanstalk/vitras-prod/var/log/nodejs/nodejs.log`

Verify alarms are receiving logs after setup:
```
-- CloudWatch Insights — verify log group is active
fields @timestamp, event
| filter event = "server_started"
| sort @timestamp desc
| limit 5
```

---

### 0.6 — Execute DR Drill [REQUIRES LIVE EXECUTION]

Follow `docs/rollout/ubs-001/dr-drill-final-report.md` exactly. Execute against `vitras-staging`.

**Key steps (summary):**
1. Record baseline patient count and migration count BEFORE initiating restore
2. Initiate PITR restore: `aws rds restore-db-instance-to-point-in-time`
3. Wait for restore instance status = `"available"`
4. Point staging EB to restored instance: `eb setenv DATABASE_URL=[restored-endpoint]`
5. Restart EB: `eb restart vitras-staging`
6. Wait for `/readyz` to return 200 — record timestamp
7. Verify: 8 migrations in `schema_migrations`, login works, patient count matches baseline

**Pass criteria (code-verified):**

| Metric | Target |
|--------|--------|
| RTO (restore initiation → /readyz 200) | ≤ 240 minutes |
| RPO (data age at restore point) | ≤ 24 hours |
| /readyz format at 200 | `{"ok":true,"readiness":{"ready":true,"phase":"ready"}}` **[CODE-VERIFIED]** |
| Migration count | 8 rows in `schema_migrations` **[CODE-VERIFIED]** |

**Go-live is BLOCKED until this drill is executed and signed.**

---

### 0.7 — Execute Staging Smoke Test [REQUIRES LIVE EXECUTION]

Follow `docs/rollout/ubs-001/staging-smoke-final-report.md`. Execute all 44 tests.

**Critical category — any failure is an immediate NO-GO:**

| Category | Tests | Failure = NO-GO? |
|----------|-------|-----------------|
| Category 4 — Multi-tenant isolation | 4 tests | YES — any 403 not returned = security review required |
| CPF masking (Category 3) | 1 test | YES — any unmasked CPF = privacy breach |

**[CODE-VERIFIED]** Multi-tenant isolation: `canAccessPatient()` in `patients.js` enforces `patient.teamId === user.teamId` for all roles. The `/readyz` 200 response format is `{"ok":true,"timestamp":"...","readiness":{"ready":true,"phase":"ready"}}`.

**[CODE-VERIFIED]** The `/health` subsystems response at 200:
```json
{
  "ok": true,
  "status": "ok",
  "phase": "ready",
  "subsystems": {
    "postgres": "ok",
    "redis": "ok",
    "migrations": "ok",
    "auditChain": "unknown"
  }
}
```
Note: `auditChain` is `"unknown"` on startup — this is correct, not a bug. It becomes `"ok"` or `"error"` only after `/audit-logs/integrity` is called.

---

### 0.8 — Populate contatos.md [REQUIRES COORDINATION]

`docs/rollout/ubs-001/contatos.md` currently contains only placeholders. This is a blocking item per `ubs-001-final-go-no-go.md`.

Replace ALL `[fill]` placeholders with real data:

| Contact | Required Before | Why Critical |
|---------|----------------|-------------|
| João Pedro — Tech Lead | Phase 0 | Always |
| UBS Coordinator name + phone + email | Phase 0 | Aceite operacional signature; incident communications |
| Medical Director name + phone | Phase 0 | Required for data inconsistency decisions (KI-02/Scenario E) |
| TI Prefeitura name + phone | Phase 0 | Infrastructure escalation (Gap 1) |
| DPO (Data Protection Officer) name + phone | Phase 0 | Required for P0 data breach within 30 minutes (LGPD) |
| AWS Support plan/case URL | Phase 0 | Infrastructure escalation when RTO > 2h |
| break_glass_admin email | After Step 0.1 | Audit trail reference |
| security_auditor email | After Step 0.2 | Post break_glass review |
| Backup AWS operator | Phase 0 | Gap 1 from lessons-learned: if Tech Lead's AWS access fails |

**Also add to contatos.md:** The emergency procedure if Tech Lead's MFA device fails on deploy day (backup AWS IAM admin identity + contact procedure).

---

### 0.9 — Conduct Tabletop Exercise [REQUIRES COORDINATION]

Schedule a 2-hour session with: Tech Lead + UBS Coordinator + TI Prefeitura representative.
Use `docs/rollout/ubs-001/tabletop-final-report.md` as the script.

**6 scenarios to walk through:**

| Scenario | Focus | Key Decision Points |
|----------|-------|---------------------|
| A — Redis outage | Circuit breaker OPEN; all requests 503 | When to communicate; paper fallback protocol |
| B — RDS high latency | Postgres accessible but slow | Latency thresholds; Performance Insights access |
| C — Deploy failed after migration | Code rollback vs data rollback | Is migration 009 backward-compatible? |
| D — Critical user locked out | break_glass_admin procedure | Audit trail; security_auditor 24h review |
| E — Data inconsistency | Hash rebuild dry run; LGPD escalation | KI-02 constraint: NO anonymization until Sprint 5A |
| F — 5xx spike | Endpoint identification; error rate thresholds | P0 criteria (>30%); rollback decision authority |

**Pass threshold:** Overall average ≥ 3/5 across all scenarios.

**Open gaps requiring pre-go-live action:**
- Gap 1: Backup AWS operator identified and documented (contatos.md)
- Gap 3: UBS staff briefed on paper fallback during Redis outage (all requests 503)
- Gap 7: contatos.md fully populated (see Step 0.8)

---

## PHASE 1 — T-3 DAYS

---

### 1.1 — Sign pre-deploy-validation.md

Complete all sections of `docs/rollout/ubs-001/pre-deploy-validation.md`. Every checkbox must be checked. Tech Lead signs.

Include in sign-off:
- EB CLI verified: `eb status` returns correct app/environment name
- `eb appversion` lists `v1.0-pilot-governed`
- RDS last backup < 24h old
- All team members confirmed available for T-0

---

### 1.2 — Final Staging Re-Validation (5 critical tests)

Run these 5 tests against staging as a final sanity check:

```bash
# Test 1: /readyz
# Expected: {"ok":true,"readiness":{"ready":true,"phase":"ready"}}
curl -s https://[STAGING_URL]/readyz | jq .

# Test 2: /health subsystems
# Expected: {"postgres":"ok","redis":"ok","migrations":"ok","auditChain":"unknown"}
curl -s https://[STAGING_URL]/health | jq '.subsystems'

# Test 3: Login
TOKEN=$(curl -s -X POST https://[STAGING_URL]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"[test-gestor-email]","password":"[test-gestor-password]"}' \
  | jq -r '.access_token')
echo "Token obtained: ${TOKEN:0:20}..."

# Test 4: Patient list (basic auth + data access)
curl -s https://[STAGING_URL]/patients \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

# Test 5: Audit log
curl -s https://[STAGING_URL]/audit-logs \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].event'
```

All 5 must pass. Any failure on Test 1 (readyz) or Test 3 (login) = investigate before proceeding.

---

### 1.3 — Communication to UBS Coordinator

Send T-3 day notification using template from `docs/rollout/ubs-001/plano-comunicacao.md` (T-1d section).

Confirm in this notification:
- Deploy window date and time (Tuesday or Wednesday, 18:00–22:00 local time recommended)
- Expected downtime duration (30–60 minutes for deploy + smoke tests)
- Paper documentation protocol: if system shows errors during the window, document on paper and enter data after system stabilizes

---

## PHASE 2 — T-0 (DEPLOY DAY)

> All times relative to /readyz 200 confirmation unless otherwise noted.

---

### 2.1 — Pre-Deploy Gate (T-0 minus 1 hour)

```bash
# Confirm EB version label is available
eb appversion | grep v1.0-pilot-governed
# Must show v1.0-pilot-governed in the list

# Confirm EB environment is healthy
eb status
# Expected: Status: Ready, Health: Green

# Record baseline: current migration count (expected: 8)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM schema_migrations;"

# Create manual RDS snapshot immediately before deploy (data safety net)
aws rds create-db-snapshot \
  --db-instance-identifier vitras-prod \
  --db-snapshot-identifier vitras-prod-pre-deploy-$(date +%Y%m%d-%H%M)
# Record snapshot identifier: ___________

# Confirm all team members are online and reachable
# Open incident communication channel (WhatsApp group or email thread)
```

**Do NOT proceed if:**
- `eb status` does not show Ready + Green
- RDS snapshot creation fails
- Any team member is unreachable

---

### 2.2 — Deploy

```bash
# Deploy with versioned label
eb deploy --label v1.0-pilot-governed-$(date +%Y%m%d%H%M)

# OR if already on release/pilot-baseline and EB CLI is configured:
eb deploy --version v1.0-pilot-governed

# Monitor EB health during deploy
eb health --refresh
```

Record deploy start time: _______________ UTC

**[CODE-VERIFIED]** During startup, `/readyz` will return 503 with body `{"ok":false,"reason":"not_ready","timestamp":"..."}`. This is correct behavior — the server is in phase `booting → migrating → warming`.

---

### 2.3 — Post-Deploy Validation Sequence

#### T+5 min — Wait for /readyz 200

```bash
# Poll until ready (max 15 minutes — if not ready by T+15min, evaluate rollback)
while ! curl -sf https://[PROD_URL]/readyz > /dev/null; do
  echo "$(date): waiting for /readyz 200..."
  sleep 15
done
echo "$(date): /readyz returned 200 — server is ready"
```

Record /readyz 200 time: _______________ UTC

**If /readyz is not 200 by T+15min:** Follow rollback trigger criteria in §2.5.

#### T+10 min — Verify server_started in CloudWatch

```
-- CloudWatch Insights query --
fields @timestamp, event, port, driver, version, upstashConfigured, encryptionEnabled
| filter event = "server_started"
| sort @timestamp desc
| limit 1
```

**[CODE-VERIFIED]** Expected `server_started` log fields (from `server.js` line 267):
```json
{
  "event": "server_started",
  "port": "[PORT]",
  "env": "production",
  "driver": "postgres",
  "version": "v1.0-pilot-governed",
  "logFormat": "json",
  "upstashConfigured": true,
  "encryptionEnabled": true,
  "auditPruneEnabled": "false"
}
```

Verify: `driver` = "postgres", `version` = "v1.0-pilot-governed", `upstashConfigured` = true, `encryptionEnabled` = true, `auditPruneEnabled` = "false".

#### T+10 min — Verify full /health

```bash
curl -s https://[PROD_URL]/health | jq '{status, phase, subsystems}'
```

**[CODE-VERIFIED]** Expected:
```json
{
  "status": "ok",
  "phase": "ready",
  "subsystems": {
    "postgres": "ok",
    "redis": "ok",
    "migrations": "ok",
    "auditChain": "unknown"
  }
}
```

#### T+12 min — Verify migration count

```bash
psql $DATABASE_URL -c "SELECT id FROM schema_migrations ORDER BY executed_at;"
```

**[CODE-VERIFIED]** Expected: 8 rows with IDs `001_create_app_state` through `008_drop_ciphertext_indexes_concurrently`. If any row is missing, especially `006_patient_hash_columns`, this is a P0 — the server would have aborted boot (`checkCriticalMigrations()` is fatal in production).

#### T+15 min — Login as break_glass_admin

```bash
BGA_TOKEN=$(curl -s -X POST https://[PROD_URL]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"[bga-email]","password":"[bga-password-from-vault]"}' \
  | jq -r '.access_token')
echo "BGA token: ${BGA_TOKEN:0:20}..."
# Token must be non-empty — if jq returns null, login failed
```

If login fails: do NOT proceed. Investigate and rollback if not resolved in 15 minutes.

#### T+20 min — Bootstrap UBS unit

```bash
curl -s -X POST https://[PROD_URL]/admin/units/bootstrap \
  -H "Authorization: Bearer $BGA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "unitId": "ubs-001",
    "unitName": "[Full UBS Name]",
    "gestorUserId": "[gestor-user-id-created-in-pre-bootstrap]"
  }' | jq .
```

Expected: `{"ok":true,"unitId":"ubs-001","gestorUserId":"..."}`

Record unitId: _______________ (will be needed for D+0 reports)

#### T+25 min — Smoke test (patient + audit)

```bash
# Patient creation (using gestor token — not BGA)
GESTOR_TOKEN=$(curl -s -X POST https://[PROD_URL]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"[gestor-email]","password":"[gestor-password]"}' \
  | jq -r '.access_token')

curl -s -X POST https://[PROD_URL]/patients \
  -H "Authorization: Bearer $GESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste Go-Live","cpf":"[test-valid-cpf]","birthDate":"1990-01-01"}' \
  | jq '{ok: .ok, id: .patient.id}'
# Expected: {"ok":true,"id":"[uuid]"}

# Audit log check
curl -s https://[PROD_URL]/audit-logs \
  -H "Authorization: Bearer $GESTOR_TOKEN" \
  | jq '[.[]] | length'
# Expected: > 0 (audit events from bootstrap and patient creation are present)
```

#### T+30 min — GO/NO-GO Gate

Run this checklist exactly at 30 minutes after /readyz 200:

```bash
echo "=== T+30min GO/NO-GO Gate — $(date) ==="
echo ""
echo "1. /readyz: $(curl -sf https://[PROD_URL]/readyz > /dev/null && echo PASS || echo FAIL)"
echo "2. /health status: $(curl -s https://[PROD_URL]/health | jq -r '.status')"
echo "3. BGA login: $([ -n '$BGA_TOKEN' ] && echo PASS || echo FAIL)"
echo "4. Unit bootstrap: CHECK curl output from T+20min above"
echo ""
echo "5. CloudWatch: check for any alarms in ALARM state"
echo "   Run: aws cloudwatch describe-alarms --state-value ALARM --alarm-name-prefix VITRAS"
echo ""
echo "6. 5xx errors in last 30 minutes:"
```
```
fields @timestamp, status_code
| filter event = "request_completed" and status_code >= 500
| sort @timestamp desc
| limit 10
```
```bash
echo ""
echo "7. Circuit breaker or degraded events:"
```
```
fields @timestamp, event
| filter event in ["circuit_breaker_opened", "degraded_mode_set", "startup.failed"]
| sort @timestamp desc
| limit 5
```

**GO criteria (all must be true):**
- /readyz returns 200
- /health status = "ok" (not "degraded")
- break_glass_admin login succeeded
- Unit bootstrap completed
- No CloudWatch alarms in ALARM state
- Zero 5xx errors in first 30 minutes
- No circuit breaker or degraded events

---

### 2.4 — GO Declaration

When all T+30min checks pass:

1. Record GO time: _______________ UTC
2. Complete `docs/rollout/ubs-001/d0-go-live-report.md` (fill GO time and initial status)
3. Notify UBS coordinator via template in `docs/rollout/ubs-001/plano-comunicacao.md`
4. Stay available on-site or on video call for the next 4 hours (T+0 to T+4h)

---

### 2.5 — Rollback Trigger Criteria

**Immediate rollback — no discussion:**
- `/readyz` not 200 after 15 minutes from deploy start
- Cross-tenant data confirmed (any patient from Team A visible to user of Team B)
- CPF or CNS appearing unmasked in any API response
- Unit bootstrap fails and cannot be resolved by retry
- Audit chain integrity failure detected

**Rollback after Tech Lead assessment:**
- 5xx rate > 10% of requests for > 10 consecutive minutes
- break_glass_admin login fails and root cause not identified within 15 minutes
- CloudWatch showing `migrations.failed_fatal` event post-deploy

**Rollback command:**
```bash
# Option 1: EB Console (preferred — visual confirmation)
# AWS Console → EB → Application Versions → select previous version → Deploy

# Option 2: EB CLI
eb deploy --version [previous-version-label]

# Verify recovery
while ! curl -sf https://[PROD_URL]/readyz > /dev/null; do
  echo "$(date): waiting for rollback /readyz..."
  sleep 15
done
echo "$(date): Rollback complete — /readyz 200"
```

**Communication on rollback:**
> "Identificamos um problema técnico que requer retorno à versão anterior. O processo levará aproximadamente 15–30 minutos. Os dados inseridos após [hora do deploy] podem precisar ser re-registrados. Entraremos em contato assim que o sistema estiver estável."

---

## PHASE 3 — D+1 THROUGH D+14

---

### 3.1 — Assisted Go-Live (T+1h to T+4h)

- Tech Lead remains available (on-site or uninterrupted video call)
- Observe first real patient registration by UBS staff (confirm with coordinator)
- Observe first real appointment creation
- Verify ACS isolation (one quick check):
  ```bash
  # ACS from Team A attempts to access a patient from Team B
  curl -s -H "Authorization: Bearer $ACS_TOKEN" \
    https://[PROD_URL]/patients/[team-b-patient-uuid]
  # Expected: 403 {"error":"Sem permissão para este paciente"}
  ```

### 3.2 — D+1 Report

Complete `docs/rollout/ubs-001/d1-report.md`.

CloudWatch overnight review (12h window):
```
fields @timestamp, status_code
| filter event = "request_completed" and status_code >= 500
| sort @timestamp desc
| limit 50
```
Record 5xx count: _____ (baseline for comparison over D+7 window)

### 3.3 — Observation Window Constraints (D+1 to D+14)

- No new features or schema changes during observation window
- Daily checklist per `docs/operations/operational-routines.md`
- Any P0 or P1 incident halts Phase 2 (UBS #2) planning
- D+7 report (`d7-report.md`) required
- D+14 report (`d14-report.md`) required before UBS #2 planning
- KI-02 legal review (LGPD anonymization) MUST begin in Sprint 5A regardless of incident activity
- KI-01, KI-03 code fixes in Sprint 5A/5B

---

## APPENDIX A — Key /readyz and /health Response Shapes [CODE-VERIFIED]

Source: `backend/src/routes/health.js` (read 2026-05-25)

### /readyz — 200 (ready):
```json
{ "ok": true, "timestamp": "...", "readiness": { "ready": true, "phase": "ready" } }
```

### /readyz — 503 (not ready during startup):
```json
{ "ok": false, "reason": "not_ready", "timestamp": "..." }
```

### /readyz — 503 (postgres unreachable after boot):
```json
{ "ok": false, "reason": "postgres_unreachable", "timestamp": "..." }
```

### /health — 200 (healthy, all subsystems ok):
```json
{
  "ok": true, "status": "ok", "phase": "ready", "ready": true, "degraded": false,
  "subsystems": { "postgres": "ok", "redis": "ok", "migrations": "ok", "auditChain": "unknown" },
  "runtime": { "startedAt": "...", "bootCompletedAt": "...", "shuttingDown": false, "ready": true }
}
```

### /health — 200 (degraded mode — instance stays in EB rotation):
```json
{
  "ok": true, "status": "degraded", "phase": "degraded", "ready": true, "degraded": true,
  "degradedReason": "[reason]",
  "subsystems": { "postgres": "ok", "redis": "error", "migrations": "ok", "auditChain": "unknown" }
}
```

**Operational note:** `/health` returning 200 while `status: "degraded"` means the EB instance is in rotation but the system has a subsystem problem. `/readyz` returning 200 means postgres is reachable — it does NOT mean users can access the system if the circuit breaker is OPEN (all rate-limited requests return 503 in that state).

---

## APPENDIX B — Startup Phase Sequence [CODE-VERIFIED]

Source: `backend/src/server.js` + `backend/src/services/runtime-state.js` (read 2026-05-25)

```
booting → migrating → [migrations complete] → app.listen() → server_started log
                                                            → warming → ready
```

Phase where `/readyz` becomes 200: only at `"ready"`.
`setStartupPhase("ready")` is called after `markBootCompleted()` + `setReadiness(true)`.

---

## APPENDIX C — Circuit Breaker Behavior [CODE-VERIFIED]

Source: `backend/src/middlewares/rate-limits.js` (read 2026-05-25)

- CLOSED → OPEN: 5 consecutive Upstash failures in 60 seconds
- OPEN → HALF_OPEN: after 30 seconds cooldown
- HALF_OPEN → CLOSED: probe succeeds
- HALF_OPEN → OPEN: probe fails (immediately reopens — Sprint 4.1 fix confirmed)

In production with circuit OPEN: ALL rate-limited requests return 503. `/health` and `/readyz` continue returning 200. EB instance remains in rotation. Recovery is automatic — no manual intervention needed for a standard Redis outage.

---

*Document version: v1.0 — Created 2026-05-25*
*Operator: João Pedro — vitras-tech-lead*
*Status: AUTHORITATIVE — supersedes individual phase documents for execution sequencing*
