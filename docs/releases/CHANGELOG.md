# VITRAS Changelog

## v1.1.0-rc.3 (2026-08-07) — CLINICAL EVENT ATTRIBUTION COMPLETE

**Commit:** be3bfaa | **Tag:** pendente

### VITRAS-CLINICAL-EVENT-ATTRIBUTION-01 — Atribuição Canônica em Eventos Clínicos

**FASES 2+3 — Eventos PARTIAL (referências + executor):**
- feat: `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent`, `municipalityId` em `agendaEntries`, `exams`, `examRequests`, `referrals`
- feat: `executingTeamId`, `executingProfessionalId` (canonical) em todos os eventos PARTIAL
- invariante: todos os campos resolvidos de JWT + patient no servidor; body do cliente ignorado

**FASE 4 — acsVisits + cds-export.js (RISCO-01):**
- feat: atribuição canônica completa em `acsVisit`: executingUnitId, executingTeamId, executingProfessionalId, referenceUnitIdAtEvent, referenceTeamIdAtEvent, referenceAcsIdAtEvent, municipalityId
- fix(cds-export.js): isolamento multi-UBS usa `visit.executingUnitId || visit.unitId` — campo canônico com fallback legado para registros históricos
- invariante: `teamId` legado preservado em todos os eventos (não removido)

**FASE 5 — Odontologia:**
- feat: atribuição completa em `dentalEncounters` (com patient lookup) e `odontoProcedures`

**FASE 6 — Farmácia:**
- feat: atribuição completa em `prescricoes` e `dispensacoes` (dispensacao com patient lookup via receita.patientId)

**FASE 7 — Tasks:**
- feat: `teamId`, `unitId` (do criador via JWT), `municipalityId` em `tasks`

**FASE 8 — Migration-022:**
- feat: `migration-022-event-attribution.mjs` — UP/DOWN/DRY_RUN com backfill idempotente em 10 coleções

**FASE 9 — Testes:**
- test: `clinical-event-attribution.test.mjs` — 15 testes PASS
  - acsVisit attribution (5), exam (2), referral (1), cds-export isolation unit tests (4), migration-022 logic (3)

---

## v1.1.0-rc.2 (2026-08-07) — GLOBAL PATIENT READY — Candidate Freeze

**Commit:** 12c1eed | **Tag:** v1.1.0-rc.2 (candidata de engenharia)

### VITRAS-GLOBAL-PATIENT-REFERENCE-ATTRIBUTION-01 — Paciente Global Municipal

**FASE 1 — referenceUnitId como campo canônico:**
- feat: campo `referenceUnitId` em todos os pacientes; sincronizado com `unitId`
- feat: `migration-021-referenceunitid.mjs` — backfill 851 pacientes, 0 divergências
- feat: `ensureDbShape` auto-heals referenceUnitId em startup e restore
- test: `patient-reference-unit.test.mjs` (6 testes PASS)

**FASE 2 — Busca municipal cross-UBS para roles clínicas:**
- feat: `CLINICAL_READ_ROLES` branch em `getAllowedPatients()` — lista municipal por municipalityId
- feat: `GET /patients` skip teamId-bounded snapshot para roles clínicas
- feat: `GET /patients/:id` — branch role-based com `canAccessPatient("read")`
- feat: `logInfo("patient.access_denied")` — evento de segurança zero-write em cada 403
- test: `patient-municipal-search.test.mjs` (13 testes PASS)

**FASE 12 — Segurança municipal:**
- feat: municipalityId de POST body/query adulterado → ignorado (usa JWT)
- feat: unitId e referenceUnitId de POST body adulterados → ignorados (usa equipe do usuário)
- feat: GET by ID cross-município → 403 sem campos clínicos
- test: `patient-security-municipal.test.mjs` (10 testes PASS)

**FASE 17 — Invariantes de migration:**
- test: `migration-021-logic.test.mjs` (8 testes PASS — UP, idempotência, DOWN, divergência, novo cadastro)
- confirm: `cds-export.js` intocado (git diff HEAD limpo)

**FASE 19 — Cenários estendidos:**
- test: `patient-global-extended.test.mjs` (23 testes PASS — all role combinations, CPF/CNS visibility, cross-UBS)

### VITRAS-ARCHITECTURE-FREEZE-RC1-01 — Congelamento

- docs: baseline técnico completo em `docs/baseline/BASELINE-GLOBAL-PATIENT-RC1-v1.1.0-rc2.md`
- docs: inventário FASE 1-8, dívida técnica classificada, handoff
- smoke: 11 cenários municipais PASS em produção (api.vitras.com.br)

---

## v1.1.0-rc.1 (2026-08-05) — RC1 CANDIDATE

**Commit:** 6fb87cf | **Branch:** claude/vitras-p0-blockers-497suw

### VITRAS-PERFORMANCE-HOTPATH-02 — Hot Path Elimination
- perf(PERF-02): remove withDb audit lock from GET /patients and GET /admin/bootstrap read paths
- perf(PERF-05): bootstrap SQL shadow table queries replace O(N) getAllowedPatients JS scan; parallel Promise.all with readDb
- perf(PERF-04): DB_CACHE_TTL_MS configurable via env (default 1500ms; production 5000ms)
- perf(PERF-06): gzip/brotli compression middleware (threshold 1KB, excludes already-compressed types)
- docs(PERF-03): global withDb lock documented as known technical debt; requires schema redesign

### VITRAS-PERFORMANCE-SCALE-01 — Scale Baseline Audit
- perf(PERF-01): pagination on GET /patients (default 200, max 500); paginationMeta in response
- perf(indexes): migration 032 adds composite indexes on app_patients (unit+active, unit+team, unit+acs)
- tools: load test tooling (autocannon), synthetic data generator (configurable COUNT/CONCURRENCY)
- docs: 80-question performance verdict — MUNICIPAL SCALE CONDITIONALLY READY

### VITRAS-PILOT-READINESS-01 — Pilot Infrastructure Validation
- ops: 15-phase pilot simulation; DR drill, smoke 44/44 PASS, staging validation
- docs: pilot checklist, rollback validation, staging environment setup

### VITRAS-LGPD-BASELINE-01 — LGPD Technical Baseline
- compliance: hash-chain audit log LGPD-compliant; hashVersion v2 + legacy_incompatible classification
- compliance: patient data access audit with SHA-256 snapshot (not plaintext)
- docs: LGPD operations runbook, DPO/RIPD guide, privacy policy template

### VITRAS-OBSERVABILITY-01 — Observability Layer
- ops: structured JSON logging (logInfo/logWarn/logError), request IDs
- ops: /metrics endpoint, requestMetricsMiddleware, metrics accumulator
- ops: CloudWatch dashboard configuration documented

### VITRAS-HARD-PROD-01 — Production Hardening
- security: CORS origin validation (CORS_ALLOW_ALL blocked in production)
- security: security headers via helmet (CSP, HSTS, referrer policy)
- ops: Node.js version pinned to 22.15.0 in render.yaml
- security: cookie SameSite/Secure production enforcement

### VITRAS-CLINICAL-INTEGRITY-PATCH-01 — 16 Security/Integrity Blockers
- security: canAccessPatient read/write/clinical_write mode separation (ADR-002)
- security: break_glass_admin unrestricted access with mandatory audit
- security: receptionist municipal scope isolation
- security: ACS assignment enforcement (assignedAcsId match required for writes)
- integrity: 16 data integrity and authorization fixes

### VITRAS-MULTI-UNIT-USER-CONTEXT-CONSOLIDATION-01 — Multi-UBS Context
- feat: all clinical routes migrate to resolveActiveUnit for unit context
- feat: activeUnitId in audit logs
- security: unit isolation enforced via resolveActiveUnit in all routes

### VITRAS-MULTI-UNIT-USER-CONTEXT-SELECTION-SPRINT-C-01 — Active Unit Selection
- feat: active unit context, resolveActiveUnit helper, multi-UBS token scope

### VITRAS-FIRST-CONTACT-P0-01 — 4 Critical P0 Blockers
- fix: 4 blocking production issues resolved before first deployment

---

## v1.0-pilot-governed (2026-05-25)

### Sprint 0 → Sprint 4.1 — Changelog

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
