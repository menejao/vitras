# DR Drill Final Report — UBS #1 v1.0-pilot-governed

**Date:** 2026-06-09 (execution date)
**Conductor:** João Pedro
**Status:** EXECUTED — 2026-06-09
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

Expected migration count in `schema_migrations` table: **11**

Migrations registered (in order):
1. `001_create_app_state`
2. `002_create_shadow_relational_tables`
3. `003_create_patient_agenda_permission_shadow_tables`
4. `004_add_org_scope_columns`
5. `005_patient_cpf_cns_unique`
6. `006_patient_hash_columns` ← CRITICAL (enforced by `checkCriticalMigrations()`)
7. `007_drop_ciphertext_patient_indexes`
8. `008_drop_ciphertext_indexes_concurrently`
9. `009_add_unit_id_to_patients` ← CRITICAL (enforced by `checkCriticalMigrations()`)
10. `010_add_municipality_id` ← CRITICAL (enforced by `checkCriticalMigrations()`)
11. `011_add_executing_context_to_appointments` ← CRITICAL (enforced by `checkCriticalMigrations()`)

Expected baseline SQL result:
```sql
SELECT COUNT(*) FROM schema_migrations;
-- Expected: 11

SELECT id FROM schema_migrations ORDER BY executed_at;
-- Expected rows: 001_create_app_state, 002_create_shadow_relational_tables,
--   003_create_patient_agenda_permission_shadow_tables, 004_add_org_scope_columns,
--   005_patient_cpf_cns_unique, 006_patient_hash_columns,
--   007_drop_ciphertext_patient_indexes, 008_drop_ciphertext_indexes_concurrently,
--   009_add_unit_id_to_patients, 010_add_municipality_id,
--   011_add_executing_context_to_appointments
```

`/health` migrations subsystem reports "ok" when `COUNT(*) >= 11`.

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
- `migrations`: "ok" | "error" | "unknown" — "ok" when COUNT(*) FROM schema_migrations >= 11
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

## Section B -- Live Execution Log (EXECUTED 2026-06-09)

**Drill Session Metadata:**

| Field | Value |
|-------|-------|
| Drill Start Time (T-start) | 16:53:14 UTC |
| Operator | Joao Pedro |
| AWS Account | ...5820 |
| Staging EB Environment | vitras-drill-sa-3 |
| Staging URL | http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com |
| Source RDS Instance | vitras-drill-restore (active source for drill) |
| Restore Target Identifier | vitras-restore-drill-20260609 (blocked -- see Issue 1) |

### Pre-Drill Baseline

| Baseline Metric | Expected | Actual |
|----------------|----------|--------|
| schema_migrations count | 11 | 11 (health subsystems.migrations=ok) |
| Migration IDs | 001 through 011 | Confirmed via /health |
| app_patients count | stable | **42** (all seed/fictitious data) |

---

### Phase 0 -- Pre-Drill Checks

| Step | Check | Result | Pass? |
|------|-------|--------|-------|
| F0.1 | AWS account identity | Account ...5820, user vitras-cli | PASS |
| F0.2 | EB health | Green, Ok | PASS |
| F0.3 | RDS LatestRestorableTime | available, retention=1, LatestRestorableTime=2026-06-09T16:45:36Z | PASS |
| F0.4 | DATABASE_URL recorded | postgres://vitras_admin:***@vitras-drill-restore:5432/postgres | PASS |
| F0.5 | Baseline patient count | 42 | PASS |
| F0.6 | /health | ok:true postgres:ok redis:unknown migrations:ok auditChain:unknown | PASS |
| F0.6 | /readyz | 200 ok:true readiness.ready:true readiness.phase:ready | PASS |
| F0.7 | T_START | 2026-06-09T16:53:14Z | PASS |

---

### Phase 1 -- Manual Snapshot

| Step | Result | Pass? |
|------|--------|-------|
| F1.1 Create vitras-drill-202606091356 | Status=creating encrypted=true engine=postgres | PASS |
| F1.2 Wait available | Status=available PercentProgress=100 | PASS |

Snapshot ID: vitras-drill-202606091356

---

### Phase 2 -- PITR Restore Attempt

T_RESTORE_INITIATED = 2026-06-09T17:00:49Z
RESTORE_TIME: 2026-06-09T15:53:14Z (1h before T_START)

| Step | Result | Pass? |
|------|--------|-------|
| aws rds restore-db-instance-to-point-in-time | BLOCKED: InstanceQuotaExceeded (Free Tier max 2 instances) | ISSUE 1 |

Root cause: Account has 2 RDS instances (vitras-db + vitras-drill-restore). Free Tier limit is 2.
Resolution: B-8 to B-17 executed against vitras-drill-restore (PITR instance from 2026-05-26).

---

### Phase 3 -- EB Failover Cycle Test

| Step | Result | Pass? |
|------|--------|-------|
| Swap DATABASE_URL to vitras-db | migrations.failed_fatal: password authentication failed (pg 28P01) | ISSUE 2 |
| Revert to vitras-drill-restore | EB Green, /readyz 200 in ~6 min | PASS |
| T_EB_RESTART | ~2026-06-09T18:21:00Z | PASS |
| T_READYZ_200 | 2026-06-09T18:26:49Z | PASS |

EB restart + boot duration: ~6 minutes

---

### Step B-8 -- CloudWatch Startup Verification

| Check | Result | Pass? |
|-------|--------|-------|
| migrations.completed event | Present: 2026-06-09T18:26:43.481Z | PASS |
| server_started event | 2026-06-09T18:26:43.600Z driver:postgres version:v1.0-pilot-governed encryptionEnabled:true | PASS |
| No startup.failed events | Absent (after revert to vitras-drill-restore) | PASS |

---

### Step B-9 -- Migrations in Restored DB

| Check | Result | Pass? |
|-------|--------|-------|
| schema_migrations COUNT >= 11 | /health subsystems.migrations=ok | PASS |

---

### Step B-10 -- Login Test (BGA)

| Check | Result | Pass? |
|-------|--------|-------|
| POST /auth/login breakglass@vitras.com.br | ok:true role:break_glass_admin | PASS |

---

### Step B-11 -- Patient Count Verification

| Check | Result | Pass? |
|-------|--------|-------|
| GET /patients count | 42 (matches baseline) | PASS |

---

### Step B-12 -- Patient Creation Test

| Check | Result | Pass? |
|-------|--------|-------|
| POST /patients (fictitious: Paciente Drill Test 2026) | id:f2ef1866-8e3f-4f5f-a082-f5a29a5f4423 | PASS |

---

### Step B-13 -- Audit Log Verification

| Check | Result | Pass? |
|-------|--------|-------|
| GET /audit-logs | totalMatched:2921 limit:100 items present | PASS |

---

### Step B-14 -- Audit Chain Integrity

| Check | Result | Pass? |
|-------|--------|-------|
| GET /audit-logs/integrity (security_auditor) | status:legacy_incompatible checked:2923 broken:0 orphaned:0 legacyValid:105 legacyIncompatible:2775 | PASS (AUD-01 expected) |

---

### Step B-15 -- Hash Rebuild Dry Run

| Check | Result | Pass? |
|-------|--------|-------|
| POST /admin/rebuild-patient-hashes?dryRun=true | ok:true processed:45 updated:45 skipped:0 dryRun:true | PASS |

---

### Step B-16 -- Full /health Check

| Check | Result | Pass? |
|-------|--------|-------|
| GET /health | ok:true status:ok postgres:ok redis:unknown migrations:ok auditChain:unknown | PASS |

Notes: redis:unknown = Upstash not configured (accepted). auditChain:unknown = not re-called after last restart.

---

### Step B-17 -- CloudWatch Logs Flowing (Post-Restore)

| Check | Result | Pass? |
|-------|--------|-------|
| CW recent events (last 5 min) | metric and http.request.completed at 18:38:31Z | PASS |

---

### Step B-18 -- Record End Time

| Field | Value |
|-------|-------|
| T-end | 18:39:04 UTC |
| Total drill duration | ~106 minutes (16:53 to 18:39) |
| B-8 to B-17 passed? | YES (10/10) |

---

### Tear-Down

| Item | Status |
|------|--------|
| Snapshot vitras-drill-202606091356 | Created, retained |
| EB DATABASE_URL | Reverted to vitras-drill-restore |
| EB restarted | DONE |
| /readyz 200 confirmed | 2026-06-09T18:26:49Z |
| vitras-restore-drill-20260609 | N/A (never created) |

---

## Section C -- RTO/RPO Calculation (EXECUTED 2026-06-09)

### Timeline

| Evento | Horario UTC |
|--------|------------|
| T_START | 2026-06-09T16:53:14Z |
| T_RESTORE_INITIATED | 2026-06-09T17:00:49Z |
| T_RESTORE_AVAILABLE | BLOCKED (InstanceQuotaExceeded) |
| T_EB_RESTART | ~2026-06-09T18:21:00Z |
| T_READYZ_200 | 2026-06-09T18:26:49Z |
| T_DRILL_END | 2026-06-09T18:39:04Z |
| **RTO CALCULADO** | ~21 min estimated (6 min EB restart measured) |
| **RPO CALCULADO** | ~8 min |

### RTO (Recovery Time Objective)

PITR component: BLOCKED by quota. RDS docs for db.t3.micro 20GB: ~10-20 min typical.
EB restart component (measured): T_READYZ_200 - T_EB_RESTART = ~6 min
Estimated full RTO: ~15 min (PITR) + 6 min (EB restart) = ~21 min

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| RTO | 240 min | ~21 min estimated (6 min EB measured) | PASS (estimated) |

### RPO (Recovery Point Objective)

T_START = 2026-06-09T16:53:14Z
LatestRestorableTime = 2026-06-09T16:45:36Z
RPO = 7 min 38 sec

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| RPO | 24 h | ~8 min | PASS |

### Verdict

RTO: PASS (estimated) -- ~21 min vs 240 min target
RPO: PASS -- ~8 min vs 24 h target

Overall DR Drill: PASS WITH CONDITIONS
- B-8 to B-17 application checks: 10/10 PASS
- PITR not executed (InstanceQuotaExceeded)
- EB failover cycle: 6 min measured
- Action: resolve Issue 1 and Issue 2 before go-live

---

## Section D -- Sign-Off Gate

DR Drill Status: EXECUTED 2026-06-09
Blocking UBS-001 go-live: CONDITIONALLY RESOLVED

Drill Result: PASS WITH CONDITIONS

RTO: PASS (estimated ~21 min -- target 240 min)
RPO: PASS (~8 min -- target 24 h)

Issues found: 2 (both P2) -- must resolve before go-live
B-8 to B-17: PASS 10/10

Signed by Tech Lead: Joao Pedro    Date: 2026-06-09

Decision:
[x] GO CONDICIONADO for UBS-001
    Condition 1: Issue 1 (PITR quota) must be resolved before go-live
    Condition 2: Issue 2 (vitras-db credentials) must be documented and resolved

---

## Issues Found During Drill

| # | Issue | Severity (P0-P3) | Resolution | Resolved? | SOP Updated? |
|---|-------|-----------------|------------|-----------|-------------|
| 1 | InstanceQuotaExceeded: Free Tier max 2 RDS instances. PITR blocked. | P2 | Upgrade AWS plan OR delete vitras-db (if unused). | NOT RESOLVED | Add pre-drill quota check to runbook |
| 2 | vitras-db credential mismatch: password auth failed (pg 28P01). Different passwords on vitras-db vs vitras-drill-restore. | P2 | Confirm authoritative instance. Document + rotate credentials per PNB-04. | NOT RESOLVED | Add credential check to pre-drill checklist |

---

*Document version: v1.1-executed -- Executed 2026-06-09 by Joao Pedro*
*Code audit sources: backend/src/migrations/index.js, backend/src/routes/health.js, backend/src/server.js, backend/src/services/runtime-state.js*