# Staging Smoke Test — UBS #1

**Date:** [to fill]
**Operator:** [to fill]
**Staging URL:** [to fill]
**Version:** v1.0-pilot-governed

## Infrastructure

| Test | Expected | Actual | Pass? |
|------|---------|--------|-------|
| GET /readyz | 200 `{"ok":true}` | | |
| GET /health | 200, status:"ok" or "degraded" | | |
| /health postgres | "ok" | | |
| /health migrations | "ok" | | |
| /health redis | "ok" or "unknown" | | |
| Startup log server_started | present in CloudWatch | | |

## Authentication

| Test | Expected | Actual | Pass? |
|------|---------|--------|-------|
| POST /auth/login (wrong password) | 401 | | |
| POST /auth/login (missing fields) | 400 | | |
| POST /auth/login (valid gestor) | 200 + access_token | | |
| GET /me (valid token) | 200 + user | | |
| GET /me (no token) | 401 | | |
| POST /auth/refresh (valid refresh) | 200 + new access_token | | |
| POST /auth/refresh (invalid) | 401 or 403 | | |

## Patient Management

| Test | Expected | Actual | Pass? |
|------|---------|--------|-------|
| GET /patients (authenticated) | 200 + array | | |
| POST /patients (valid) | 201 + patient | | |
| POST /patients (duplicate CPF) | 409 | | |
| GET /patients/:id | 200 + patient | | |
| GET /patients/:id (wrong team, ACS) | 403 | | |
| CPF in response | masked `***.***.***-**` | | |

## Clinical Records

| Test | Expected | Actual | Pass? |
|------|---------|--------|-------|
| POST /patients/:id/appointments | 201 | | |
| GET /patients/:id/appointments | 200 + array | | |
| POST /patients/:id/records | 201 | | |
| GET /patients/:id/history | 200 + events | | |
| POST prescription record (doctor only) | 201 | | |
| POST prescription (non-doctor) | 403 | | |

## Agenda & Queue

| Test | Expected | Actual | Pass? |
|------|---------|--------|-------|
| POST /agenda (receptionist) | 201 | | |
| GET /agenda | 200 + array | | |
| POST /queue (receptionist) | 201 | | |
| GET /queue | 200 + array | | |

## Audit & Governance

| Test | Expected | Actual | Pass? |
|------|---------|--------|-------|
| GET /audit-logs (gestor) | 200 + entries | | |
| GET /audit-logs (no auth) | 401 | | |
| GET /audit-logs (wrong team, gestor) | 403 | | |
| GET /audit-logs/export (security_auditor) | 200 | | |
| GET /audit-logs/integrity (security_auditor) | 200 | | |
| GET /audit-logs/reports/cross-team-access | 200 | | |

## Rate Limiting

| Test | Expected | Actual | Pass? |
|------|---------|--------|-------|
| 6 failed logins rapid | 429 on 6th | | |
| GET /patients repeated (>30/min) | 429 | | |

## Operational

| Test | Expected | Actual | Pass? |
|------|---------|--------|-------|
| POST /admin/system/clear-degraded (not degraded) | 200 "was not in degraded mode" | | |
| GET /health after clear-degraded | status:"ok" | | |

## Multi-tenant Isolation (critical)

| Test | Expected | Actual | Pass? |
|------|---------|--------|-------|
| Gestor A cannot see Team B patients | 403 | | |
| ACS cannot access cross-team patient | 403 | | |
| Audit logs scoped to gestor's unit | only own unit events | | |

## Summary

Total tests: [count]
Passed: [count]
Failed: [count]
Blockers for deploy: YES / NO

If blockers: [describe — do not proceed to production until resolved]

Signed: _________________________ Date: _______
