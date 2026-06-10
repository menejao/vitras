# VITRAS v1.0-pilot-governed — Known Issues

## KI-01 — usersRouter Mounted Before Global requireAuth
**Severity:** MEDIUM (defense-in-depth gap, no active exploit)
**Status:** Tracked — Sprint 5 fix scheduled
**Description:** In app.js, `usersRouter` is registered before the global `requireAuth` middleware. All current routes in users.js have inline `requireAuth` protection, so no route is currently unprotected. However, any future developer adding a route to users.js without remembering to add inline `requireAuth` would create a publicly accessible route.
**Mitigation:** All current routes verified to have inline auth. Code review gate for any changes to users.js.
**Fix target:** Sprint 5A

---

## KI-02 — LGPD vs CFM 1821/2007 Anonymization Tension
**Severity:** HIGH (regulatory risk in regulated production)
**Status:** Documented — legal review required before regulated production
**Description:** `anonymizePatientBundle()` physically deletes `clinicalRecords` array when anonymizing a patient. This satisfies LGPD erasure requirements (Art. 16) but may conflict with CFM 1821/2007 requirement to retain clinical records for 20 years. The pre-flight audit `anonymization_warning_acknowledged` documents the operator's intent. A legal determination is required for regulated production use.
**Current mitigation:** Clinical snapshots on prescription/medical_attest/referral records persist independently. Pre-flight audit creates forensic record of anonymization decision.
**Fix target:** Sprint 5A — selective anonymization preserving clinical content while removing PII
**See:** docs/lgpd-cfm-considerations.md

---

## KI-03 — rejectUnauthorized: false on RDS Connection
**Severity:** MEDIUM (documented residual risk)
**Status:** Intentional — AWS RDS certificates require specific handling
**Description:** `db.js` sets `ssl: { rejectUnauthorized: false }` for RDS connections. This means the RDS certificate is not validated, creating theoretical MITM risk.
**Mitigation:** AWS VPC + security groups isolate the connection path. Upgrading requires bundling RDS CA bundle.
**Fix target:** Sprint 5B — bundle AWS RDS CA bundle for certificate validation
**See:** docs/security/security-operations.md

---

## KI-04 — File-mode Limitations (Pilot/Single-Instance Only)
**Severity:** MEDIUM (architectural scope limitation)
**Status:** By design for development/single-instance deployments
**Description:** File-mode (non-Postgres) stores all data in a single JSON file with file-lock mutex serialization. This cannot scale beyond a single process. In production (Elastic Beanstalk), always use Postgres mode with DATABASE_URL set.
**Impact in file-mode:**
- No horizontal scaling
- Bulk operation atomicity not guaranteed on crash
- No connection pooling
- `getAuditReport` reads entire in-memory array (O(n) scaling)
**Mitigation:** All production deployments use Postgres mode. File-mode is only used in development and test.

---

## KI-05 — Multi-Probe HALF_OPEN Circuit Breaker
**Severity:** LOW (cosmetic)
**Status:** Tracked — Sprint 5 optimization
**Description:** When the Redis circuit breaker transitions from OPEN to HALF_OPEN, multiple concurrent requests can simultaneously act as probes rather than a single controlled probe. Functionally correct but slightly more aggressive than intended.
**Mitigation:** No user-visible impact. State machine transitions are eventually consistent.
**Fix target:** Sprint 5B

---

## KI-06 — crypto.randomUUID() Without Fallback
**Severity:** LOW (near-zero risk on AWS EB Node.js >= 18)
**Status:** Tracked
**Description:** `privacy.js` uses `crypto.randomUUID()` for anonymization `correlationId` generation. Requires Node.js >= 15.13.0. No fallback to `uuidv4()` (which is already imported in the file).
**Mitigation:** All EB environments should be on Node.js 18+ as of 2025. Verify with `node --version` in EB environment.
**Fix target:** Sprint 5A (trivial — swap to uuidv4)

---

## KI-07 — pharmacy.test.js, access-requests.test.js, twofa.test.js Pre-existing Failures
**Severity:** LOW (test infrastructure gaps, not production issues)
**Status:** Pre-existing before Sprint 0
**Description:** Three test suites have pre-existing failures not caused by Sprint hardening:
- pharmacy.test.js: expects 403 but gets 201 (permissions model mismatch in test)
- access-requests.test.js: expects 201 but gets 400 (fixture mismatch)
- twofa.test.js: 2 subtests failing (2FA flow test mismatch)
**Impact:** No production impact. Test suite not fully representative.
**Fix target:** Sprint 5A
