# VITRAS Changelog — Sprint 0 → Sprint 4.1

## v1.0-pilot-governed (2026-05-25)

### Sprint 4.1 — Operational Hotfixes (Baseline Freeze)
- fix(resilience): S5-01 circuit breaker HALF_OPEN stuck — reopen on probe failure
- fix(compliance): S8-02 anonymization pre-flight audit in separate transaction
- fix(multi-ubs): S7-01 bootstrap abort on gestor-not-found during mutation
- feat(operations): S2-01 clearDegraded function and admin endpoint
- fix(governance): S4-03 sort getAuditReport by createdAt DESC before limit
- fix(security): S10-03 move adminRouter after global requireAuth middleware
- docs(operations): Redis blackout behavior, degraded mode SOP, recovery procedures

### Sprint 4 — Enterprise Operations & Multi-UBS Scalability
- docs(dr): backup/disaster-recovery runbooks and RDS backup startup check
- feat(health): /readyz endpoint, degraded mode, warming phase, subsystem checks
- feat(observability): structured metrics events, CloudWatch dashboard docs
- feat(governance): operational reports endpoints, governance docs
- feat(resilience): Redis circuit breaker, log storm protection, resilience docs
- docs(security): security operations runbook, trusted proxy, EB hardening
- feat(multi-ubs): unit bootstrap endpoint, onboarding SOP
- docs(compliance): LGPD/CFM considerations, anonymization pre-flight audit

### Sprint 3.1 — Pre-Operation Hotfixes
- fix(operations): health readiness gate, hash rebuild SOP, strict schemas, concurrent drop

### Sprint 3 — Post-Pilot Hardening
- feat(hardening): migrations pre-listen, key separation, chain verify, snapshots, schema validation

### Sprint 2.1 — NO-GO Fix (CPF/CNS Hash Index)
- fix(pilot-hardening): CPF/CNS HMAC hash index, PUT 409, CloudWatch docs, migration guard

### Sprint 2 — Observability & Database Uniqueness
- fix(pilot-hardening): observability, JSON logs, CPF/CNS DB unique, rate limit keys

### Sprint 1 — File-mode Filter Parity & Race Conditions
- fix(pilot-hardening): B-01 file-mode filter parity, A-02 CPF race, D-04 rate limits

### Sprint 0 — Pilot Readiness
- fix(pilot-readiness): B-03 safe prune, test fixtures, boot validation

### Reliability Baseline
- fix(reliability): LOG-01 handlers pre-startup, MEM-01 hash chain anchor on eviction
