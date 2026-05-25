# Staging Smoke Test — Final Execution Guide — UBS #1

**Date:** [fill during execution]
**Operator:** [fill]
**Staging URL:** [fill — https://[env].elasticbeanstalk.com]
**Version:** v1.0-pilot-governed
**Code audit date:** 2026-05-25

> **How to use this document:**
> Each test shows: (1) exact curl command with placeholder URL and TOKEN, (2) expected response derived from code inspection, (3) Pass/Fail column pre-filled with [EXECUTE].
> Replace `[URL]` with the staging base URL. Replace `$TOKEN`, `$GESTOR_B_TOKEN`, `$ACS_TOKEN`, `$SECURITY_AUDITOR_TOKEN`, `$BREAK_GLASS_TOKEN` with real tokens obtained during execution.
> Do NOT pre-fill Actual Result or Pass? columns — fill during live execution only.

---

## Category 1: Infrastructure

### 1.1 — GET /readyz

**Code reference:** `backend/src/routes/health.js` — `/readyz` handler

```bash
curl -s https://[URL]/readyz | jq .
```

**Expected 200 response (exact shape from code):**
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

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| GET /readyz | 200, `ok: true`, `readiness.ready: true`, `readiness.phase: "ready"` | [fill] | [EXECUTE] |

---

### 1.2 — GET /health

**Code reference:** `backend/src/routes/health.js` — `/health` handler

```bash
curl -s https://[URL]/health | jq '{ok: .ok, status: .status, phase: .phase, subsystems: .subsystems}'
```

**Expected 200 response (exact shape from code — server fully ready):**
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

**Notes:**
- `auditChain` is "unknown" on startup until `/audit-logs/integrity` is called — this is correct, not a bug.
- `redis` may be "unknown" if Upstash env vars are not set on this staging instance.
- `redis` is "error" only if circuit breaker is OPEN (Upstash failing + 5 consecutive failures in 60s).

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| GET /health | 200, `ok: true`, `status: "ok"`, `postgres: "ok"`, `migrations: "ok"` | [fill: paste subsystems] | [EXECUTE] |

---

### 1.3 — Health Subsystem Breakdown

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| `/health` → `postgres` field | "ok" | [fill] | [EXECUTE] |
| `/health` → `migrations` field | "ok" | [fill] | [EXECUTE] |
| `/health` → `redis` field | "ok" or "unknown" (both acceptable; "error" = FAIL) | [fill] | [EXECUTE] |
| `/health` → `auditChain` field | "unknown" (before integrity call) or "ok" (after) | [fill] | [EXECUTE] |

---

### 1.4 — CloudWatch: server_started Log

```
-- CloudWatch Insights query --
fields @timestamp, event, port, driver, version, upstashConfigured, encryptionEnabled
| filter event = "server_started"
| sort @timestamp desc
| limit 1
```

**Expected fields (code-verified from `backend/src/server.js`):**

| Field | Expected Value |
|-------|---------------|
| `event` | "server_started" |
| `driver` | "postgres" |
| `version` | "v1.0-pilot-governed" |
| `upstashConfigured` | true (if Upstash configured) |
| `encryptionEnabled` | true |

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| CW: server_started event present | Recent event visible | [fill] | [EXECUTE] |
| CW: driver = "postgres" | "postgres" | [fill] | [EXECUTE] |
| CW: version = "v1.0-pilot-governed" | "v1.0-pilot-governed" | [fill] | [EXECUTE] |

---

## Category 2: Authentication

**Setup:** First obtain a valid gestor token via login. Store in `$TOKEN` for subsequent tests.

```bash
# Login — obtain token (do NOT log the token value in this document)
curl -s -X POST https://[URL]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"[gestor-email]","password":"[gestor-password]"}' \
  | jq '{ok: .ok, has_token: (.token != null)}'
```

| Test | Command | Expected | Actual Result | Pass? |
|------|---------|---------|---------------|-------|
| POST /auth/login — wrong password | `curl -X POST .../auth/login -d '{"email":"valid@email","password":"wrongpassword"}'` | 401 | [fill] | [EXECUTE] |
| POST /auth/login — missing fields | `curl -X POST .../auth/login -d '{}'` | 400 | [fill] | [EXECUTE] |
| POST /auth/login — valid gestor | See command above | 200 + `has_token: true` | [fill] | [EXECUTE] |
| GET /me — valid token | `curl -H "Authorization: Bearer $TOKEN" .../me` | 200 + user object | [fill] | [EXECUTE] |
| GET /me — no token | `curl .../me` | 401 | [fill] | [EXECUTE] |
| POST /auth/refresh — valid refresh token | `curl -X POST .../auth/refresh -H "Authorization: Bearer $REFRESH_TOKEN"` | 200 + new access_token | [fill] | [EXECUTE] |
| POST /auth/refresh — invalid token | `curl -X POST .../auth/refresh -H "Authorization: Bearer invalid"` | 401 or 403 | [fill] | [EXECUTE] |

---

## Category 3: Patient Management

```bash
# GET patients list
curl -s -H "Authorization: Bearer $TOKEN" https://[URL]/patients \
  | jq '{ok: .ok, count: (.patients | length)}'

# POST new patient
curl -s -X POST https://[URL]/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Paciente Smoke Test","cpf":"[test-valid-cpf]","birthDate":"1990-01-01"}' \
  | jq '{ok: .ok, id: .patient.id}'

# GET specific patient (use ID from POST response above)
curl -s -H "Authorization: Bearer $TOKEN" https://[URL]/patients/[patient-id] | jq '{ok: .ok}'

# Verify CPF masking
curl -s -H "Authorization: Bearer $TOKEN" https://[URL]/patients/[patient-id] \
  | jq '.patient.cpf'
# Expected: "***.***.***-**"
```

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| GET /patients (authenticated) | 200 + array | [fill] | [EXECUTE] |
| POST /patients (valid new patient) | 201 + `{ ok: true, id: "[uuid]" }` | [fill] | [EXECUTE] |
| POST /patients (duplicate CPF) | 409 | [fill: re-post same CPF] | [EXECUTE] |
| GET /patients/:id | 200 + patient object | [fill] | [EXECUTE] |
| CPF in GET /patients/:id response | `"***.***.***-**"` (masked) | [fill: paste `.patient.cpf` value] | [EXECUTE] |

---

## Category 4: Critical Multi-Tenant Isolation Tests

> These are security-critical. ANY failure here is an immediate NO-GO for production deployment.

**Setup required:**
- Team A: gestor A token (`$GESTOR_A_TOKEN`) + a patient created by team A (`$PATIENT_A_ID`)
- Team B: gestor B token (`$GESTOR_B_TOKEN`) + ACS token from team B (`$ACS_B_TOKEN`)

**Test 4.1 — Gestor A cannot access Team B patient:**

```bash
# Attempt: Gestor A reads a patient belonging to Team B
curl -s -H "Authorization: Bearer $GESTOR_A_TOKEN" \
  https://[URL]/patients/[TEAM_B_PATIENT_ID] \
  | jq '{status: .status, error: .error}'
```

**Expected:**
```json
{ "error": "Sem permissão para este paciente" }
```
HTTP status: 403

**Code reference:** `patients.js` → `getPatientOrError()` → `canAccessPatient()` → checks `patient.teamId === user.teamId` (via `canAccessScopedPatients`).

| Test | Command | Expected | Actual Result | Pass? |
|------|---------|---------|---------------|-------|
| Gestor A → GET Team B patient | See above | 403 `{ "error": "Sem permissão para este paciente" }` | [fill] | [EXECUTE] |

---

**Test 4.2 — ACS from Team B cannot access Team A patient:**

```bash
# Attempt: ACS from Team B reads a patient belonging to Team A
curl -s -H "Authorization: Bearer $ACS_B_TOKEN" \
  https://[URL]/patients/[TEAM_A_PATIENT_ID] \
  | jq '{error: .error}'
```

**Expected:**
```json
{ "error": "Sem permissão para este paciente" }
```
HTTP status: 403

**Code reference:** Same as 4.1 — `canAccessPatient` enforces `patient.teamId === user.teamId` for all roles including ACS.

| Test | Command | Expected | Actual Result | Pass? |
|------|---------|---------|---------------|-------|
| ACS Team B → GET Team A patient | See above | 403 `{ "error": "Sem permissão para este paciente" }` | [fill] | [EXECUTE] |

---

**Test 4.3 — Audit logs scoped to gestor's own unit:**

```bash
# Gestor A requests audit logs — should only see events from Team A's unit
curl -s -H "Authorization: Bearer $GESTOR_A_TOKEN" \
  https://[URL]/audit-logs \
  | jq '{ok: .ok, log_count: (.logs | length)}'

# Verify: none of the returned logs have unitId from Team B
# (manual inspection or filter — check a random sample)
```

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| GET /audit-logs (Gestor A) | Only events from Team A unit returned | [fill: inspect unitId values in response] | [EXECUTE] |
| GET /audit-logs (no auth) | 401 | [fill] | [EXECUTE] |

---

**Test 4.4 — Cross-team audit log access blocked:**

```bash
# Attempt: Gestor A requests audit logs for Team B (if query param is supported)
curl -s -H "Authorization: Bearer $GESTOR_A_TOKEN" \
  "https://[URL]/audit-logs?unitId=[TEAM_B_UNIT_ID]" \
  | jq '{error: .error}'
```

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| GET /audit-logs (wrong team, gestor) | 403 | [fill] | [EXECUTE] |

---

## Category 5: Clinical Records

```bash
# POST appointment
curl -s -X POST https://[URL]/patients/[PATIENT_ID]/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-06-01","type":"consulta"}' \
  | jq '{ok: .ok}'

# GET appointments
curl -s -H "Authorization: Bearer $TOKEN" \
  https://[URL]/patients/[PATIENT_ID]/appointments \
  | jq '{ok: .ok, count: (.appointments | length)}'
```

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| POST /patients/:id/appointments | 201 | [fill] | [EXECUTE] |
| GET /patients/:id/appointments | 200 + array | [fill] | [EXECUTE] |
| POST /patients/:id/records | 201 | [fill] | [EXECUTE] |
| GET /patients/:id/history | 200 + events array | [fill] | [EXECUTE] |
| POST prescription (doctor role token) | 201 | [fill — requires doctor token] | [EXECUTE] |
| POST prescription (non-doctor token) | 403 | [fill] | [EXECUTE] |

---

## Category 6: Agenda & Queue

| Test | Command | Expected | Actual Result | Pass? |
|------|---------|---------|---------------|-------|
| POST /agenda (receptionist token) | `curl -X POST .../agenda -H "Authorization: Bearer $RECEPTIONIST_TOKEN" ...` | 201 | [fill] | [EXECUTE] |
| GET /agenda | `curl -H "Authorization: Bearer $TOKEN" .../agenda` | 200 + array | [fill] | [EXECUTE] |
| POST /queue (receptionist) | `curl -X POST .../queue -H "Authorization: Bearer $RECEPTIONIST_TOKEN" ...` | 201 | [fill] | [EXECUTE] |
| GET /queue | `curl -H "Authorization: Bearer $TOKEN" .../queue` | 200 + array | [fill] | [EXECUTE] |

---

## Category 7: Audit & Governance

```bash
# Audit logs — gestor
curl -s -H "Authorization: Bearer $TOKEN" https://[URL]/audit-logs \
  | jq '{ok: .ok, count: (.logs | length)}'

# Audit export — security_auditor
curl -s -H "Authorization: Bearer $SECURITY_AUDITOR_TOKEN" https://[URL]/audit-logs/export \
  | jq '{ok: .ok}'

# Audit integrity — security_auditor
curl -s -H "Authorization: Bearer $SECURITY_AUDITOR_TOKEN" https://[URL]/audit-logs/integrity \
  | jq '{status: .status, checked: .checked}'
# Expected: { "status": "ok", "checked": [number > 0] }

# Cross-team access report
curl -s -H "Authorization: Bearer $SECURITY_AUDITOR_TOKEN" \
  https://[URL]/audit-logs/reports/cross-team-access \
  | jq '{ok: .ok}'
```

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| GET /audit-logs (gestor) | 200 + log entries | [fill] | [EXECUTE] |
| GET /audit-logs (no auth) | 401 | [fill] | [EXECUTE] |
| GET /audit-logs/export (security_auditor) | 200 | [fill] | [EXECUTE] |
| GET /audit-logs/integrity (security_auditor) | 200 `{ "status": "ok", "checked": [N] }` | [fill] | [EXECUTE] |
| GET /audit-logs/reports/cross-team-access | 200 | [fill] | [EXECUTE] |

---

## Category 8: Rate Limiting

**Code reference:** `backend/src/middlewares/rate-limits.js`

Rate limit configuration (from code):
- Auth limiter: `AUTH_MAX_ATTEMPTS` per `AUTH_WINDOW_MS` (env-configurable)
- Global limiter: `GLOBAL_RATE_LIMIT_MAX_REQUESTS` per `GLOBAL_RATE_LIMIT_WINDOW_MS` (env-configurable)
- Sensitive data: 30 requests per 60 seconds
- `/health` is excluded from global and sensitive rate limits (`skip` function in code)

**Test 8.1 — Auth rate limit (6 rapid failed logins):**

```bash
# Run 6 rapid failed login attempts
for i in {1..6}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://[URL]/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrongpassword"}')
  echo "Attempt $i: HTTP $CODE"
done
```

Expected: attempts 1–5 return 401, attempt 6 (or earlier if AUTH_MAX_ATTEMPTS=5) returns 429.

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| 6 rapid failed logins | 429 on or before 6th attempt | [fill: list HTTP codes per attempt] | [EXECUTE] |

**Test 8.2 — Sensitive data rate limit:**

```bash
# 35 rapid GET /patients requests (exceeds 30/min limit for sensitive data)
for i in {1..35}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" https://[URL]/patients)
  echo "Request $i: HTTP $CODE"
done
```

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| 35 rapid GET /patients | 429 on requests >30 in the window | [fill: note at which request 429 appears] | [EXECUTE] |

**Rate limit 429 response body (from code):**
```json
{ "error": "Muitas requisições para dados sensíveis. Aguarde 1 minuto." }
```

---

## Category 9: Operational / Degraded Mode

**Test 9.1 — clear-degraded (idempotency test — system is NOT degraded):**

**Code reference:** `backend/src/services/runtime-state.js` — `clearDegraded()` returns `false` when not degraded. Admin route returns 200 with message.

```bash
curl -s -X POST https://[URL]/admin/system/clear-degraded \
  -H "Authorization: Bearer $SECURITY_AUDITOR_TOKEN" \
  | jq .
```

Expected response when system is NOT in degraded mode:
```json
{ "ok": true, "message": "System was not in degraded mode" }
```

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| POST /admin/system/clear-degraded (not degraded) | 200 `{ "ok": true, "message": "System was not in degraded mode" }` | [fill] | [EXECUTE] |
| GET /health after clear-degraded | `status: "ok"` (unchanged) | [fill] | [EXECUTE] |

> Note: Triggering real degraded mode requires an infrastructure failure (e.g., Postgres down, migration failure in non-prod mode). This CANNOT be safely induced in staging. The idempotency test above confirms the clear-degraded endpoint works correctly without requiring a real degraded state.

---

## Category 10: Circuit Breaker State

**Code reference:** `backend/src/middlewares/rate-limits.js` — `getCircuitBreakerState()` returns "CLOSED" | "OPEN" | "HALF_OPEN"

**What CAN be tested without Redis outage:**

```bash
# Test 10.1: Check /health redis field (reflects circuit breaker state)
curl -s https://[URL]/health | jq '.subsystems.redis'
# Expected: "ok" (CLOSED state) or "unknown" (Upstash not configured)
# "error" = circuit breaker OPEN — investigate if seen

# Test 10.2: /health endpoint itself is not rate-limited (skip function in rate-limits.js)
for i in {1..50}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" https://[URL]/health)
  echo "Request $i: HTTP $CODE"
done
# Expected: ALL 50 requests return 200 (health is excluded from rate limits)
```

| Test | Expected | Actual Result | Pass? |
|------|---------|---------------|-------|
| /health → `subsystems.redis` | "ok" or "unknown" (never "error" in healthy state) | [fill] | [EXECUTE] |
| 50 rapid GET /health | All 200 (health exempt from rate limits) | [fill] | [EXECUTE] |

> Cannot trigger circuit breaker OPEN state without Upstash failure. Testing OPEN state requires either (a) disabling Upstash, or (b) configuring an invalid Upstash URL. If needed, test in a dedicated circuit breaker drill, not this smoke test. Document as [INFRASTRUCTURE ONLY — circuit breaker OPEN state not tested in standard smoke].

---

## Smoke Test Summary

| Category | # Tests | Passed | Failed | Blockers |
|----------|---------|--------|--------|---------|
| 1 — Infrastructure | 7 | [fill] | [fill] | [fill] |
| 2 — Authentication | 7 | [fill] | [fill] | [fill] |
| 3 — Patient Management | 5 | [fill] | [fill] | [fill] |
| 4 — Multi-Tenant Isolation | 4 | [fill] | [fill] | [fill] |
| 5 — Clinical Records | 6 | [fill] | [fill] | [fill] |
| 6 — Agenda & Queue | 4 | [fill] | [fill] | [fill] |
| 7 — Audit & Governance | 5 | [fill] | [fill] | [fill] |
| 8 — Rate Limiting | 2 | [fill] | [fill] | [fill] |
| 9 — Degraded Mode | 2 | [fill] | [fill] | [fill] |
| 10 — Circuit Breaker | 2 | [fill] | [fill] | [fill] |
| **TOTAL** | **44** | | | |

Blockers for deploy: YES / NO

If blockers exist, describe here (do NOT proceed to production until resolved):
```
[fill or "None — all tests passed"]
```

---

## Critical Failure Criteria (Immediate NO-GO)

Any of the following test failures is an immediate NO-GO for production deployment:

| Failure | Severity | Action |
|---------|----------|--------|
| Category 4 (multi-tenant isolation) — any 403 NOT returned for cross-team access | CRITICAL | Security review required before any deploy |
| CPF not masked in any GET response | CRITICAL | Privacy breach — do not deploy |
| Audit log NOT recording events | HIGH | Data integrity issue — investigate |
| /readyz not returning 200 after startup | HIGH | Cannot deploy — investigate |
| break_glass_admin login fails | HIGH | Bootstrap issue — investigate |

---

```
Smoke Test Status:       PENDING LIVE EXECUTION
All 44 tests require:    Staging environment with production-equivalent configuration
Blocking UBS #1 go-live: YES — until all tests executed and zero CRITICAL failures

Signed: _________________________ Date: ___________
```

---

*Document version: v1.0-final — Created 2026-05-25*
*Code audit sources: `backend/src/routes/health.js`, `backend/src/middlewares/rate-limits.js`, `backend/src/services/runtime-state.js`, `backend/src/server.js`*
