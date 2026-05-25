# DR Drill Real Report — v1.0-pilot-governed

**Date:** 2026-05-25
**Conductor:** João Pedro
**Status:** TEMPLATE — To be executed against real staging
**Version:** v1.0-pilot-governed
**RDS Target:** vitras-staging (PITR drill against staging, not production)

> [SIMULATED] sections contain pre-computed expected values and narrative.
> [REQUIRES LIVE EXECUTION] sections must be filled by the operator during the actual drill.

---

## Section 1: Pre-Drill Checklist

Complete ALL items before initiating restore. Do not begin Section 2 until every item is checked.

| # | Item | Required Value / Format | Actual Value | Checked? |
|---|------|------------------------|--------------|---------|
| 1 | RDS instance identifier | `vitras-staging` (or actual name) | [fill] | [ ] |
| 2 | RDS automated backups status | Enabled | [fill: Enabled / Disabled] | [ ] |
| 3 | RDS backup retention days | ≥ 7 days | [fill: X days] | [ ] |
| 4 | Last automated backup timestamp | ≤ 24 hours ago | [fill: YYYY-MM-DDTHH:MM:SSZ] | [ ] |
| 5 | Last automated backup status | Completed | [fill: Completed / Failed] | [ ] |
| 6 | EB environment name | [staging env name] | [fill] | [ ] |
| 7 | EB environment URL | `https://[env].elasticbeanstalk.com` | [fill] | [ ] |
| 8 | EB current health | OK / Green | [fill] | [ ] |
| 9 | Node.js version on staging | ≥ 18.x | [fill: v18.X.X] | [ ] |
| 10 | NODE_ENV present | = "production" (format check only) | [fill: present / missing] | [ ] |
| 11 | DATABASE_URL present | starts with "postgres://" | [fill: present / missing] | [ ] |
| 12 | DATA_ENCRYPTION_KEY present | length ≥ 32 (format check only) | [fill: present / missing] | [ ] |
| 13 | PATIENT_LOOKUP_HASH_KEY present | length ≥ 32, different from DATA_ENCRYPTION_KEY | [fill: present / missing] | [ ] |
| 14 | JWT_SECRET present | length ≥ 32 (format check only) | [fill: present / missing] | [ ] |
| 15 | UPSTASH_REDIS_REST_URL present | starts with "https://" | [fill: present / missing] | [ ] |
| 16 | UPSTASH_REDIS_REST_TOKEN present | non-empty | [fill: present / missing] | [ ] |
| 17 | FRONTEND_ORIGINS present | includes staging/prod domain | [fill: present / missing] | [ ] |
| 18 | AUDIT_PRUNE_ENABLED present | = "false" | [fill: present / missing] | [ ] |
| 19 | AWS CLI configured with correct profile | `aws sts get-caller-identity` returns expected account | [fill] | [ ] |
| 20 | EB CLI configured: `eb status` returns correct env | App name + Env name visible | [fill] | [ ] |
| 21 | CloudWatch log group receiving logs | Test query returns server_started events | [fill] | [ ] |
| 22 | Drill incident channel opened | Slack/Teams/WhatsApp channel ready | [fill] | [ ] |

**Pre-Drill Baseline Capture (record BEFORE initiating restore):**

```sql
-- [REQUIRES LIVE EXECUTION] Run against current staging DB before restore
SELECT COUNT(*) FROM app_patients;
-- Record result: _____

SELECT COUNT(*) FROM schema_migrations;
-- Record result: _____ (expected: 8)

SELECT id, executed_at FROM schema_migrations ORDER BY executed_at;
-- Record all 8 rows
```

| Baseline Metric | Expected | Actual (fill before drill) |
|----------------|----------|---------------------------|
| app_patients count | [any stable value] | [fill] |
| schema_migrations count | 8 | [fill] |
| schema_migrations IDs | 001 through 008 | [fill] |

> **CRITICAL:** Record these baseline values BEFORE initiating restore. If you forget, the RPO/RTO validation in Section 3 cannot be completed accurately.

---

## Section 2: Drill Execution Log

> [REQUIRES LIVE EXECUTION] — Fill each row during execution. Do not pre-fill.

**Drill Session Metadata:**

| Field | Value |
|-------|-------|
| Drill Start Time (T-start) | [fill: HH:MM UTC] |
| Operator | João Pedro |
| AWS Account | [fill: account ID last 4 digits only] |
| Restore Target Identifier | `vitras-restore-drill-2026-05-25` |

---

### Step 1 — Pre-Restore Baseline

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | Run baseline queries (see Section 1) | Patient count and migration list recorded | [fill] | [ ] | Record in Section 1 table above |

---

### Step 2 — Initiate PITR Restore

> [REQUIRES LIVE EXECUTION]

Use the following command, substituting the `--restore-time` with a time approximately 1 hour before drill start (to test a recent but not current point):

```bash
# Determine the restore-time: use a timestamp from 1 hour ago in ISO 8601 format
# Example: if drill starts at 14:00 UTC, restore to 13:00 UTC

aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vitras-staging \
  --target-db-instance-identifier vitras-restore-drill-2026-05-25 \
  --restore-time "2026-05-25T[HH-1]:00:00Z" \
  --db-instance-class db.t3.micro \
  --vpc-security-group-ids sg-XXXXXXXX \
  --db-subnet-group-name vitras-subnet-group \
  --no-publicly-accessible
```

> Replace `sg-XXXXXXXX` with the actual VPC security group ID for your staging environment.
> Replace `vitras-subnet-group` with your actual subnet group name.

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] **T+0** | PITR restore command issued | CLI returns restore job ARN or request ID | [fill] | [ ] | Record exact command used |
| [fill] **T+0** | Restore initiated — record timestamp | Console shows "restoring" status | [fill] | [ ] | This is T_restore_initiated for RTO |

---

### Step 3 — Monitor Restore Progress

> Expected duration: 5–20 minutes for a small DB (< 5 GB). May be up to 60 minutes for larger instances.

```bash
# Poll restore status (run every 2 minutes):
aws rds describe-db-instances \
  --db-instance-identifier vitras-restore-drill-2026-05-25 \
  --query 'DBInstances[0].DBInstanceStatus'
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] T+2min | Poll restore status | "restoring" | [fill] | [ ] | |
| [fill] T+5min | Poll restore status | "restoring" or "available" | [fill] | [ ] | |
| [fill] T+10min | Poll restore status | "restoring" or "available" | [fill] | [ ] | |
| [fill] **T+Xmin** | Restore complete | "available" | [fill] | [ ] | Record actual T_restore_complete |

**Actual restore duration:** _____ minutes (T+0 to T+Xmin)

---

### Step 4 — Get Restored Instance Endpoint

```bash
aws rds describe-db-instances \
  --db-instance-identifier vitras-restore-drill-2026-05-25 \
  --query 'DBInstances[0].Endpoint.Address'
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | Get restored endpoint | Hostname ending in .rds.amazonaws.com | [fill: record endpoint] | [ ] | Needed for EB config update |

---

### Step 5 — Point Staging EB to Restored Instance

Update DATABASE_URL in EB environment to point to the restored instance:

```bash
# Option A: EB CLI
eb setenv DATABASE_URL="postgres://[user]:[pass]@[restored-endpoint]:5432/vitras"

# Option B: AWS Console
# EB Console → Environment → Configuration → Software → Environment Properties
# Update DATABASE_URL value
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | DATABASE_URL updated to restored instance | EB shows environment update in progress | [fill] | [ ] | Do not restart yet |

---

### Step 6 — EB Restart

```bash
eb restart vitras-staging
# OR: EB Console → Actions → Restart App Servers
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | EB restart initiated | EB shows "Updating" status | [fill] | [ ] | Record timestamp for RTO calc |

---

### Step 7 — First /readyz Probe

> [SIMULATED Expected Behavior]
> - During restart and migration phase: /readyz returns 503 (phases: booting → migrating → warming)
> - After migrations complete and phase = "ready": /readyz returns 200
> - Expected time from EB restart to first 200: 2–5 minutes (includes migration execution time)

```bash
# Poll /readyz every 30 seconds:
watch -n 30 "curl -s -o /dev/null -w '%{http_code}' https://[staging-url]/readyz"
# OR:
curl -s https://[staging-url]/readyz | jq .
```

Expected 200 response format:
```json
{
  "ok": true,
  "timestamp": "2026-05-25T[HH:MM:SS].000Z",
  "readiness": {
    "ready": true,
    "phase": "ready"
  }
}
```

Expected 503 response format (during startup):
```json
{
  "ok": false,
  "reason": "not_ready",
  "timestamp": "2026-05-25T[HH:MM:SS].000Z"
}
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] T+Xmin | First /readyz probe | 503 (still starting) | [fill: HTTP code + body] | [ ] | |
| [fill] T+Xmin | Repeat /readyz probe | 503 or 200 | [fill: HTTP code + body] | [ ] | |
| [fill] **T+Xmin** | /readyz first 200 | 200 `{ ok: true, readiness: { ready: true, phase: "ready" } }` | [fill] | [ ] | Record T_readyz_200 for RTO |

---

### Step 8 — Verify Startup in CloudWatch

> CloudWatch Insights query to confirm startup events:

```
fields @timestamp, event, phase, port, driver
| filter event in ["server_started", "startup.failed", "startup.warming", "migrations.completed", "migrations.failed_fatal"]
| sort @timestamp desc
| limit 10
```

Expected events (in order):
1. `migrations.completed` — all 8 migrations applied
2. `startup.warming` — phase transition
3. `server_started` — port listening, ready

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | CW Insights: startup events | server_started present, no startup.failed | [fill: event names seen] | [ ] | |
| [fill] | CW Insights: migration completion | migrations.completed event present | [fill] | [ ] | |

---

### Step 9 — Verify Migrations in Database

```sql
-- [REQUIRES LIVE EXECUTION] Connect to restored DB (via bastion or temporary access)
SELECT id, executed_at FROM schema_migrations ORDER BY executed_at;
```

> [SIMULATED] Expected result: 8 rows with IDs matching 001 through 008

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | SELECT from schema_migrations | 8 rows: 001, 002, 003, 004, 005, 006, 007, 008 | [fill: row count + IDs] | [ ] | Compare to baseline |

---

### Step 10 — Login Test

```bash
curl -X POST https://[staging-url]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"[test-gestor-email]","password":"[test-gestor-password]"}' \
  | jq '{ok: .ok, token_present: (.token != null)}'
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | POST /auth/login (test gestor) | `{ ok: true, token_present: true }` | [fill] | [ ] | Do NOT log the token value |

---

### Step 11 — Patient Count Verification

```bash
# Use token from step 10
curl -H "Authorization: Bearer $TOKEN" \
  https://[staging-url]/patients \
  | jq '{ok: .ok, count: (.patients | length)}'
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | GET /patients | Count matches pre-restore baseline | [fill: count] | [ ] | Compare to Section 1 baseline |

---

### Step 12 — Patient Creation Test

```bash
curl -X POST https://[staging-url]/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Paciente Drill Test","cpf":"[test-cpf]","birthDate":"1990-01-01"}' \
  | jq '{ok: .ok, id: .patient.id}'
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | POST /patients (test patient) | `{ ok: true, id: "[uuid]" }` | [fill] | [ ] | Record created patient ID for cleanup |

---

### Step 13 — Audit Log Verification

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://[staging-url]/audit-logs \
  | jq '{ok: .ok, log_count: (.logs | length)}'
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | GET /audit-logs | ok: true, logs present | [fill] | [ ] | |

---

### Step 14 — Audit Chain Integrity

```bash
# Requires security_auditor token
curl -H "Authorization: Bearer $SECURITY_AUDITOR_TOKEN" \
  https://[staging-url]/audit-logs/integrity \
  | jq '{status: .status, checked: .checked}'
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | GET /audit-logs/integrity | `{ status: "ok", checked: [number] }` | [fill] | [ ] | |

---

### Step 15 — Hash Rebuild Dry Run

```bash
# Requires break_glass_admin token
curl -X POST https://[staging-url]/admin/rebuild-patient-hashes?dryRun=true \
  -H "Authorization: Bearer $BREAK_GLASS_ADMIN_TOKEN" \
  | jq '{ok: .ok, dryRun: .dryRun, issues: (.issues | length)}'
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | POST /admin/rebuild-patient-hashes?dryRun=true | `{ ok: true, dryRun: true, issues: 0 }` | [fill] | [ ] | |

---

### Step 16 — Full Health Check

```bash
curl https://[staging-url]/health | jq '{ok: .ok, status: .status, subsystems: .subsystems}'
```

> [SIMULATED] Expected response when healthy:
> ```json
> {
>   "ok": true,
>   "status": "ok",
>   "subsystems": {
>     "postgres": "ok",
>     "redis": "ok",
>     "migrations": "ok",
>     "auditChain": "unknown"
>   }
> }
> ```
> Note: `auditChain` may be "unknown" until `/audit-logs/integrity` is called for the first time after boot.
> Note: `redis` may be "unknown" if Upstash env vars are not configured on staging.

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | GET /health | ok: true, status: ok, postgres: ok | [fill: paste subsystems object] | [ ] | |

---

### Step 17 — CloudWatch Logs Flowing

```
fields @timestamp, event, @message
| filter event in ["server_started", "metric"]
| sort @timestamp desc
| limit 5
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | CW Insights: confirm logs flowing | Recent events visible from last 5 minutes | [fill] | [ ] | |

---

### Step 18 — Record End Time

| Field | Value |
|-------|-------|
| Drill End Time (T-end) | [fill: HH:MM UTC] |
| Total drill duration | [fill: minutes] |
| All steps passed? | [fill: YES / NO — if NO, list failures] |

---

## Section 3: RTO/RPO Calculation

> [REQUIRES LIVE EXECUTION] — Fill from timestamps recorded in Section 2.

### RTO (Recovery Time Objective)

**Definition:** Time from restore initiation to first /readyz 200.

```
RTO = T_readyz_200 - T_restore_initiated

T_restore_initiated: [fill: HH:MM:SS UTC — from Step 2]
T_readyz_200:        [fill: HH:MM:SS UTC — from Step 7]
RTO (minutes):       [calculate]
```

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| RTO | ≤ 240 minutes | [fill] minutes | [fill: PASS / FAIL] |

> Breakdown for RTO analysis (fill all):
> - Restore duration (T+0 to restore available): [fill] minutes
> - EB config update + restart: [fill] minutes
> - Migrations + warm-up: [fill] minutes
> - **Total RTO:** [fill] minutes

### RPO (Recovery Point Objective)

**Definition:** Age of the data at the restore point (how much data could have been lost in a real incident).

```
RPO = drill_start_time - last_automated_backup_timestamp

drill_start_time:              [fill: from Section 2 drill start]
last_automated_backup_timestamp: [fill: from Section 1 row 4]
RPO (hours):                   [calculate]
```

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| RPO | ≤ 24 hours | [fill] hours | [fill: PASS / FAIL] |

### Verdict

```
RTO: [PASS / FAIL]  —  [X] minutes vs ≤ 240 minute target
RPO: [PASS / FAIL]  —  [X] hours vs ≤ 24 hour target

Overall DR Drill: [PASS / FAIL]
```

---

## Section 4: Issues Found During Drill

> Record any problems encountered during execution, regardless of severity.

| # | Issue | Severity (P0–P3) | Resolution | Time to Resolve | SOP Updated? |
|---|-------|-----------------|------------|-----------------|-------------|
| 1 | [fill] | [fill] | [fill] | [fill] | [fill: YES / NO / N/A] |
| 2 | [fill] | [fill] | [fill] | [fill] | [fill] |
| 3 | [fill] | [fill] | [fill] | [fill] | [fill] |

> If no issues: mark row 1 as "None — drill executed without issues."

---

## Section 5: Tear-Down

> [REQUIRES LIVE EXECUTION] — Complete after Section 3 validation passes and data verified.

**Delete the drill restore instance:**

```bash
aws rds delete-db-instance \
  --db-instance-identifier vitras-restore-drill-2026-05-25 \
  --skip-final-snapshot
```

**Revert EB staging DATABASE_URL:**

```bash
# Revert DATABASE_URL to original staging RDS instance
eb setenv DATABASE_URL="postgres://[user]:[pass]@[original-staging-endpoint]:5432/vitras"
```

**Restart staging EB (to reconnect to original DB):**

```bash
eb restart vitras-staging
```

**Verify staging recovery:**

```bash
curl https://[staging-url]/readyz | jq .
# Expected: { "ok": true, ... }
```

| Item | Completed? | Time | Notes |
|------|-----------|------|-------|
| Drill instance deletion initiated | [ ] | [fill] | |
| EB DATABASE_URL reverted to original | [ ] | [fill] | |
| Staging EB restarted | [ ] | [fill] | |
| /readyz 200 on original staging DB | [ ] | [fill] | |
| Deletion confirmed in AWS Console | [ ] | [fill] | |

---

## Section 6: Sign-Off

```
DR Drill Result: PASSED / FAILED

RTO Result:  PASS / FAIL  ([X] minutes — target ≤ 240 min)
RPO Result:  PASS / FAIL  ([X] hours   — target ≤ 24 hrs)

Issues found: [count] — all resolved: YES / NO

Signed by Tech Lead: _________________________ Date: 2026-05-25

Decision:
  [ ] GO for UBS #1 — DR drill passed, RTO/RPO within targets
  [ ] NO-GO pending: [describe blocking action]
      Example: "NO-GO — RTO was 280 minutes; must optimize restore procedure before go-live"
```

---

*Document version: v1.0 — Created 2026-05-25*
*Template status: READY FOR EXECUTION against real staging infrastructure*
