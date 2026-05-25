# DR Drill Final Report — UBS #1 v1.0-pilot-governed

**Date:** 2026-05-25
**Conductor:** João Pedro
**Status:** PENDING LIVE EXECUTION
**Version:** v1.0-pilot-governed (commit: 81a704d, branch: release/pilot-baseline)
**Source template:** `docs/operations/dr-drill-real-report-2026-05-25.md`

> **How to use this document:**
> Section A contains code-verified expected values — do NOT change these. They are derived from code inspection.
> Section B is the live execution log — fill during actual drill against staging.
> Section C calculates RTO/RPO from recorded timestamps.
> Section D is the sign-off gate.

---

## Section A — Code-Verified Expected Values (DONE via code audit)

These values were derived from code inspection and are the authoritative expected results for the drill. They do not require live infrastructure.

### A-1: Migration Count

**Source:** `backend/src/migrations/index.js` (read 2026-05-25)

Expected migration count in `schema_migrations` table: **8**

Migrations registered (in order):
1. `001_create_app_state`
2. `002_create_shadow_relational_tables`
3. `003_create_patient_agenda_permission_shadow_tables`
4. `004_add_org_scope_columns`
5. `005_patient_cpf_cns_unique`
6. `006_patient_hash_columns` ← CRITICAL (enforced by `checkCriticalMigrations()`)
7. `007_drop_ciphertext_patient_indexes`
8. `008_drop_ciphertext_indexes_concurrently`

Expected baseline SQL result:
```sql
SELECT COUNT(*) FROM schema_migrations;
-- Expected: 8

SELECT id FROM schema_migrations ORDER BY executed_at;
-- Expected rows: 001_create_app_state, 002_create_shadow_relational_tables,
--   003_create_patient_agenda_permission_shadow_tables, 004_add_org_scope_columns,
--   005_patient_cpf_cns_unique, 006_patient_hash_columns,
--   007_drop_ciphertext_patient_indexes, 008_drop_ciphertext_indexes_concurrently
```

`/health` migrations subsystem reports "ok" when `COUNT(*) >= 8`.

---

### A-2: /readyz Exact Response Format

**Source:** `backend/src/routes/health.js` — `router.get("/readyz", ...)` handler

**200 OK — server ready (phase = "ready"):**
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

**503 — not yet ready (during startup phases booting/migrating/warming):**
```json
{
  "ok": false,
  "reason": "not_ready",
  "timestamp": "2026-05-25T[HH:MM:SS].000Z"
}
```

**503 — shutting down:**
```json
{
  "ok": false,
  "reason": "shutting_down",
  "timestamp": "2026-05-25T[HH:MM:SS].000Z"
}
```

**503 — postgres unreachable (server ready but DB lost):**
```json
{
  "ok": false,
  "reason": "postgres_unreachable",
  "timestamp": "2026-05-25T[HH:MM:SS].000Z"
}
```

Note: `/readyz` is a strict liveness check. It checks `readiness.ready=true` AND `postgres reachable`. If postgres goes down after boot, `/readyz` will return 503 even though the server is running.

---

### A-3: server_started Log Format

**Source:** `backend/src/server.js` — `logInfo("server_started", ...)` call at line 267–278

```json
{
  "event": "server_started",
  "port": "[PORT value, e.g. 3000 or 8080]",
  "env": "[NODE_ENV value]",
  "driver": "postgres",
  "version": "[APP_VERSION value, expected: v1.0-pilot-governed]",
  "logFormat": "json",
  "upstashConfigured": true,
  "encryptionEnabled": true,
  "auditPruneEnabled": "false",
  "timestamp": "2026-05-25T[HH:MM:SS].000Z"
}
```

Notes on fields:
- `driver` = "postgres" when DATABASE_URL is set (which it is in production)
- `upstashConfigured` = true when both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set
- `encryptionEnabled` = true when DATA_ENCRYPTION_KEY is set
- `auditPruneEnabled` = "false" (string value of AUDIT_PRUNE_ENABLED env var; must be "false" in production)

CloudWatch Insights query to verify:
```
fields @timestamp, event, port, driver, version, upstashConfigured, encryptionEnabled
| filter event = "server_started"
| sort @timestamp desc
| limit 5
```

---

### A-4: Startup Phase Sequence

**Source:** `backend/src/services/runtime-state.js` and `backend/src/server.js`

Valid phase values: `"booting"` | `"migrating"` | `"warming"` | `"ready"` | `"degraded"` | `"shutting_down"`

Expected startup sequence for a clean boot with `RUN_MIGRATIONS=true`:
1. `"booting"` — module load, before `startServer()` runs
2. `"migrating"` — `setStartupPhase("migrating")` called before `runMigrations()`
3. (no explicit phase change after migrations complete — goes straight to `app.listen`)
4. `"warming"` — `setStartupPhase("warming")` called after `app.listen()` succeeds and `server_started` is logged
5. `"ready"` — `setStartupPhase("ready")` called after `markBootCompleted()` + `setReadiness(true)`

At phase `"ready"`: `/readyz` returns 200. At all earlier phases: `/readyz` returns 503.

CloudWatch Insights query to confirm startup sequence:
```
fields @timestamp, event, phase
| filter event in ["server_started", "startup.warming", "migrations.completed", "migrations.failed_fatal", "startup.failed"]
| sort @timestamp asc
| limit 10
```

---

### A-5: /health Full Response Structure

**Source:** `backend/src/routes/health.js` — `router.get("/health", ...)` handler

**200 — healthy (all subsystems ok):**
```json
{
  "ok": true,
  "status": "ok",
  "phase": "ready",
  "ready": true,
  "degraded": false,
  "subsystems": {
    "postgres": "ok",
    "redis": "ok",
    "migrations": "ok",
    "auditChain": "unknown"
  },
  "timestamp": "2026-05-25T[HH:MM:SS].000Z",
  "runtime": {
    "startedAt": "2026-05-25T[HH:MM:SS].000Z",
    "bootCompletedAt": "2026-05-25T[HH:MM:SS].000Z",
    "shuttingDown": false,
    "ready": true
  }
}
```

**Subsystem value semantics:**
- `postgres`: "ok" | "error" | "unknown" — "unknown" when not in postgres mode
- `redis`: "ok" | "error" | "unknown" — "unknown" when Upstash env vars not set; "error" when circuit breaker is OPEN
- `migrations`: "ok" | "error" | "unknown" — "ok" when COUNT(*) FROM schema_migrations >= 8
- `auditChain`: "unknown" on startup; updated to "ok"/"error" only after `/audit-logs/integrity` is called

**200 — degraded (postgres ok, redis failing, or migrations_failed on non-fatal path):**
```json
{
  "ok": true,
  "status": "degraded",
  "phase": "degraded",
  "ready": true,
  "degraded": true,
  "degradedReason": "[reason string, e.g. 'migrations_failed']",
  "subsystems": { "postgres": "ok", "redis": "error", "migrations": "ok", "auditChain": "unknown" },
  "timestamp": "..."
}
```

Note: `/health` returns 200 even in degraded mode — instance stays in EB rotation. `/readyz` is the strict liveness gate.

---

## Section B — Live Execution Log (REQUIRES LIVE EXECUTION)

> [REQUIRES LIVE EXECUTION] — Execute against vitras-staging EB environment.
> Do NOT pre-fill "Actual Result" or "Pass?" columns. Fill only during actual drill execution.

**Drill Session Metadata:**

| Field | Value |
|-------|-------|
| Drill Start Time (T-start) | [fill: HH:MM UTC] |
| Operator | João Pedro |
| AWS Account | [fill: last 4 digits only] |
| Staging EB Environment | [fill: environment name] |
| Staging URL | [fill: https://[env].elasticbeanstalk.com] |
| Restore Target Identifier | `vitras-restore-drill-2026-05-25` |

### Pre-Drill Baseline

Complete ALL baseline checks BEFORE initiating restore. If you skip this, Section C (RTO/RPO) cannot be completed.

```sql
-- [EXECUTE] Run against staging DB BEFORE restore
SELECT COUNT(*) FROM app_patients;
-- Record: _____

SELECT COUNT(*) FROM schema_migrations;
-- Record: _____ (expected: 8)

SELECT id, executed_at FROM schema_migrations ORDER BY executed_at;
-- Record all rows
```

| Baseline Metric | Expected | Actual (fill before drill) |
|----------------|----------|---------------------------|
| `schema_migrations` count | 8 | [fill] |
| Migration IDs | 001 through 008 | [fill] |
| `app_patients` count | [any stable value] | [fill: record exact count] |

---

### Step B-1 — Pre-Drill Checks

| # | Check | Command | Expected Result | Actual Result | Pass? |
|---|-------|---------|----------------|---------------|-------|
| 1 | EB health | `eb status` | Status: Ready, Health: Green | [fill] | [EXECUTE] |
| 2 | /readyz before drill | `curl https://[url]/readyz` | 200 `{ "ok": true, "readiness": { "ready": true, "phase": "ready" } }` | [fill] | [EXECUTE] |
| 3 | /health before drill | `curl https://[url]/health \| jq .subsystems` | `{ "postgres": "ok", "migrations": "ok" }` | [fill] | [EXECUTE] |
| 4 | CloudWatch logs flowing | CW Insights: `filter event = "server_started" \| sort @timestamp desc \| limit 1` | Recent server_started visible | [fill] | [EXECUTE] |
| 5 | Baseline SQL (above) | psql / bastion | 8 rows in schema_migrations | [fill] | [EXECUTE] |

---

### Step B-2 — Initiate PITR Restore

Use restore-time = 1 hour before T-start.

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vitras-staging \
  --target-db-instance-identifier vitras-restore-drill-2026-05-25 \
  --restore-time "2026-05-25T[T-start minus 1h]:00:00Z" \
  --db-instance-class db.t3.micro \
  --vpc-security-group-ids sg-XXXXXXXX \
  --db-subnet-group-name vitras-subnet-group \
  --no-publicly-accessible
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] **T+0** | PITR restore command issued | CLI returns success / request accepted | [fill] | [EXECUTE] | Record exact time as T_restore_initiated |
| [fill] **T+0** | Record T_restore_initiated | Console shows "restoring" status | [fill] | [EXECUTE] | Critical for RTO calculation |

---

### Step B-3 — Monitor Restore Progress

```bash
# Poll every 2 minutes:
aws rds describe-db-instances \
  --db-instance-identifier vitras-restore-drill-2026-05-25 \
  --query 'DBInstances[0].DBInstanceStatus'
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] T+2min | Poll status | "restoring" | [fill] | [EXECUTE] |
| [fill] T+5min | Poll status | "restoring" or "available" | [fill] | [EXECUTE] |
| [fill] T+10min | Poll status | "restoring" or "available" | [fill] | [EXECUTE] |
| [fill] **T+Xmin** | Restore complete | "available" | [fill] | [EXECUTE] |

Actual restore duration: _____ minutes

---

### Step B-4 — Get Restored Endpoint

```bash
aws rds describe-db-instances \
  --db-instance-identifier vitras-restore-drill-2026-05-25 \
  --query 'DBInstances[0].Endpoint.Address'
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | Get endpoint | Hostname ending in `.rds.amazonaws.com` | [fill: record endpoint] | [EXECUTE] |

---

### Step B-5 — Point Staging EB to Restored Instance

```bash
# Option A: EB CLI
eb setenv DATABASE_URL="postgres://[user]:[pass]@[restored-endpoint]:5432/vitras"

# Option B: EB Console → Configuration → Software → Environment Properties
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | DATABASE_URL updated to restored instance | EB shows environment update in progress | [fill] | [EXECUTE] |

---

### Step B-6 — EB Restart

```bash
eb restart vitras-staging
# OR: EB Console → Actions → Restart App Servers
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | EB restart initiated | EB shows "Updating" | [fill] | [EXECUTE] |

---

### Step B-7 — /readyz Probes During Startup

Poll every 30 seconds. Expected sequence: 503 → 503 → ... → 200.

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://[staging-url]/readyz
# Then: curl -s https://[staging-url]/readyz | jq .
```

Expected 503 (startup in progress) — matches code-verified format from Section A-2:
```json
{ "ok": false, "reason": "not_ready", "timestamp": "..." }
```

Expected 200 (ready) — matches code-verified format from Section A-2:
```json
{ "ok": true, "timestamp": "...", "readiness": { "ready": true, "phase": "ready" } }
```

| Time | Action | Expected Result | Actual Result | Pass? | Notes |
|------|--------|----------------|---------------|-------|-------|
| [fill] | First /readyz probe | 503 `{ "ok": false, "reason": "not_ready" }` | [fill: HTTP code + body] | [EXECUTE] | |
| [fill] | Second probe | 503 or 200 | [fill] | [EXECUTE] | |
| [fill] **T_readyz_200** | First 200 | 200 `{ "ok": true, "readiness": { "ready": true, "phase": "ready" } }` | [fill] | [EXECUTE] | Record exact time — used for RTO |

---

### Step B-8 — CloudWatch Startup Verification

```
fields @timestamp, event, phase, port, driver, version
| filter event in ["server_started", "startup.failed", "startup.warming", "migrations.completed", "migrations.failed_fatal"]
| sort @timestamp asc
| limit 10
```

Expected events in log (matches code-verified sequence from Section A-4):
1. `migrations.completed`
2. `server_started` (with `driver: "postgres"`, `version: "v1.0-pilot-governed"`)
3. `startup.warming`

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | CW Insights startup events | server_started present; no startup.failed | [fill: events seen] | [EXECUTE] |
| [fill] | CW: server_started fields | `driver: "postgres"`, `version: "v1.0-pilot-governed"` | [fill: paste key fields] | [EXECUTE] |

---

### Step B-9 — Migrations in Restored DB

```sql
-- [EXECUTE via bastion or admin endpoint]
SELECT COUNT(*) AS cnt FROM schema_migrations;
-- Expected: 8

SELECT id, executed_at FROM schema_migrations ORDER BY executed_at;
-- Expected: 8 rows, IDs match Section A-1
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | SELECT COUNT from schema_migrations | 8 | [fill] | [EXECUTE] |
| [fill] | SELECT id list | 001 through 008 (see Section A-1) | [fill] | [EXECUTE] |

---

### Step B-10 — Login Test

```bash
curl -s -X POST https://[staging-url]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"[test-gestor-email]","password":"[test-gestor-password]"}' \
  | jq '{ok: .ok, token_present: (.token != null)}'
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | POST /auth/login | `{ "ok": true, "token_present": true }` | [fill] | [EXECUTE] |

---

### Step B-11 — Patient Count Verification

```bash
# Use token from step B-10
curl -s -H "Authorization: Bearer $TOKEN" https://[staging-url]/patients \
  | jq '{ok: .ok, count: (.patients | length)}'
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | GET /patients | Count matches pre-restore baseline (Section B baseline) | [fill: count] | [EXECUTE] |

---

### Step B-12 — Patient Creation Test

```bash
curl -s -X POST https://[staging-url]/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Paciente Drill Test","cpf":"[test-cpf]","birthDate":"1990-01-01"}' \
  | jq '{ok: .ok, id: .patient.id}'
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | POST /patients | `{ "ok": true, "id": "[uuid]" }` | [fill] | [EXECUTE] |

---

### Step B-13 — Audit Log Verification

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://[staging-url]/audit-logs \
  | jq '{ok: .ok, log_count: (.logs | length)}'
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | GET /audit-logs | `{ "ok": true, log_count: [>0] }` | [fill] | [EXECUTE] |

---

### Step B-14 — Audit Chain Integrity

```bash
curl -s -H "Authorization: Bearer $SECURITY_AUDITOR_TOKEN" \
  https://[staging-url]/audit-logs/integrity \
  | jq '{status: .status, checked: .checked}'
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | GET /audit-logs/integrity | `{ "status": "ok", "checked": [number > 0] }` | [fill] | [EXECUTE] |

---

### Step B-15 — Hash Rebuild Dry Run

```bash
curl -s -X POST "https://[staging-url]/admin/rebuild-patient-hashes?dryRun=true" \
  -H "Authorization: Bearer $BREAK_GLASS_ADMIN_TOKEN" \
  | jq '{ok: .ok, dryRun: .dryRun, issues: (.issues | length)}'
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | POST /admin/rebuild-patient-hashes?dryRun=true | `{ "ok": true, "dryRun": true, "issues": 0 }` | [fill] | [EXECUTE] |

---

### Step B-16 — Full /health Check

```bash
curl -s https://[staging-url]/health | jq '{ok: .ok, status: .status, subsystems: .subsystems}'
```

Expected (matches Section A-5 code-verified format):
```json
{
  "ok": true,
  "status": "ok",
  "subsystems": {
    "postgres": "ok",
    "redis": "ok",
    "migrations": "ok",
    "auditChain": "ok"
  }
}
```

Note: `auditChain` will be "ok" (not "unknown") after Step B-14 runs `/audit-logs/integrity`.
Note: `redis` may be "unknown" if Upstash is not configured on staging.

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | GET /health | ok: true, status: "ok", postgres: "ok", migrations: "ok" | [fill: paste subsystems] | [EXECUTE] |

---

### Step B-17 — CloudWatch Logs Flowing (Post-Restore)

```
fields @timestamp, event, @message
| filter event in ["server_started", "metric"]
| sort @timestamp desc
| limit 5
```

| Time | Action | Expected Result | Actual Result | Pass? |
|------|--------|----------------|---------------|-------|
| [fill] | CW Insights: confirm logs flowing | Recent events from last 5 minutes visible | [fill] | [EXECUTE] |

---

### Step B-18 — Record End Time

| Field | Value |
|-------|-------|
| Drill End Time (T-end) | [fill: HH:MM UTC] |
| Total drill duration | [fill: minutes] |
| All steps passed? | [fill: YES / NO — list failures if NO] |

---

### Tear-Down (After Section C validation passes)

```bash
# Delete drill restore instance
aws rds delete-db-instance \
  --db-instance-identifier vitras-restore-drill-2026-05-25 \
  --skip-final-snapshot

# Revert staging EB DATABASE_URL to original
eb setenv DATABASE_URL="postgres://[user]:[pass]@[original-staging-endpoint]:5432/vitras"

# Restart staging EB
eb restart vitras-staging

# Verify recovery
curl https://[staging-url]/readyz | jq .
```

| Item | Completed? | Time |
|------|-----------|------|
| Drill instance deletion initiated | [EXECUTE] | [fill] |
| EB DATABASE_URL reverted to original | [EXECUTE] | [fill] |
| Staging EB restarted | [EXECUTE] | [fill] |
| /readyz 200 on original staging DB confirmed | [EXECUTE] | [fill] |
| Deletion confirmed in AWS Console | [EXECUTE] | [fill] |

---

## Section C — RTO/RPO Calculation (REQUIRES LIVE EXECUTION)

Fill from timestamps recorded in Section B.

### RTO (Recovery Time Objective)

**Definition:** Time from restore initiation to first /readyz 200 response.

```
RTO = T_readyz_200 - T_restore_initiated

T_restore_initiated:  [fill: HH:MM:SS UTC — from Step B-2]
T_readyz_200:         [fill: HH:MM:SS UTC — from Step B-7]
RTO (minutes):        [calculate]
```

RTO breakdown (fill all components):
- RDS restore duration (T+0 → restore "available"): [fill] minutes
- EB config update (DATABASE_URL + env update): [fill] minutes
- EB restart + migrations + warm-up: [fill] minutes
- **Total RTO:** [fill] minutes

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| RTO | ≤ 240 minutes | [fill] minutes | [EXECUTE] |

### RPO (Recovery Point Objective)

**Definition:** Age of restored data at drill time — how much data could have been lost in a real incident.

```
RPO = drill_start_time - last_automated_backup_timestamp

drill_start_time:               [fill: from Section B metadata]
last_automated_backup_timestamp: [fill: from pre-drill check]
RPO (hours):                    [calculate]
```

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| RPO | ≤ 24 hours | [fill] hours | [EXECUTE] |

### Verdict

```
RTO: [PASS / FAIL]  —  [X] minutes vs ≤ 240 minute target
RPO: [PASS / FAIL]  —  [X] hours vs ≤ 24 hour target

Overall DR Drill: [PASS / FAIL]
```

---

## Section D — Sign-Off Gate

```
DR Drill Status:              PENDING LIVE EXECUTION
Blocking UBS #1 go-live:      YES — until drill is executed and PASSES
Responsible:                  João Pedro
Execute against:              vitras-staging EB environment
Earliest drill window:        As soon as staging infrastructure is accessible

DR Drill Result:              PASSED / FAILED (fill after execution)

RTO Result: PASS / FAIL  ([X] minutes — target ≤ 240 min)
RPO Result: PASS / FAIL  ([X] hours   — target ≤ 24 hrs)

Issues found: [count] — all resolved: YES / NO

Signed by Tech Lead: _________________________ Date: ___________

Decision:
  [ ] GO for UBS #1 — DR drill passed, RTO/RPO within targets
  [ ] NO-GO pending: [describe blocking action]
```

---

## Issues Found During Drill

| # | Issue | Severity (P0–P3) | Resolution | Time to Resolve | SOP Updated? |
|---|-------|-----------------|------------|-----------------|-------------|
| 1 | [fill during execution] | | | | |

> If no issues: mark row 1 as "None — drill executed without issues."

---

*Document version: v1.0-final — Created 2026-05-25*
*Derived from: `docs/operations/dr-drill-real-report-2026-05-25.md`*
*Code audit sources: `backend/src/migrations/index.js`, `backend/src/routes/health.js`, `backend/src/server.js`, `backend/src/services/runtime-state.js`*
