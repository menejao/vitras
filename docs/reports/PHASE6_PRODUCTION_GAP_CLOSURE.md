# Phase 6 — Production Gap Closure Report

**Date:** 2026-05-14  
**Scope:** Structural hardening for production readiness  
**Branch:** main  
**Commits:** `4e95402` → `5a6567b` (10 commits)

---

## What was done

### Passo 1 — Ops scripts self-contained (`fix(ops)`)
- Fixed `scripts/restore-backup.js`: wrong table name (`data` → `app_state`), wrong backup field (`driver` → `encryptedSnapshot`)
- Added `scripts/package.json` so restore script resolves `pg` without requiring `cd backend`

### Passo 2 — Migration system (`feat(db)`)
- `backend/src/migrations/runner.js`: Postgres-only, no-op in file mode, idempotent `schema_migrations` control table
- `backend/src/migrations/001_create_app_state.js`: ensures `app_state` table exists
- `backend/src/server.js`: `runMigrations()` runs on startup before password migration

### Passo 3 — JSONB normalization plan (`docs(db)`)
- `DB_NORMALIZATION_PLAN.md`: full 15-table relational schema, 4-phase migration (A=auxiliary tables, B=dual-write, C=read cutover, D=JSONB removal), volume estimates (1 250 patients, 9 425 clinical records)

### Passo 4 — Critical integration tests (`test`)
- 5 test files under `backend/test/`: `health`, `auth` (13 tests), `patients` (7 tests), `twofa` (4 tests), `backup` (3 tests)
- `backend/test/helpers.js`: isolated temp DB per test run via `TEST_DB_PATH`, `server.unref()` prevents event loop hang

### Passo 5 — CI/CD pipeline (`ci`)
- `.github/workflows/ci.yml`: 3 jobs — backend tests (Node 22, all env vars), frontend build (Vite), security check (grep for hardcoded secrets)

### Passo 6 — TypeScript foundation (`chore`)
- `backend/tsconfig.json`: `allowJs:true, checkJs:false, noEmit:true, NodeNext` — type-check without migration overhead
- `npm run type-check` added to `package.json`

### Passo 7 — Observability (`feat(observability)`)
- `backend/src/middlewares/logging.js`: in-process metrics counters (`requests`, `errors5xx`, `loginAttempts`, `loginFailures`, `startedAt`), `LOG_FORMAT=json` structured logging, `X-Request-Id` header, `durationMs` on every response
- `trackLoginAttempt()` wired into `/auth/login` (success and failure) and `/auth/login/verify`
- `GET /metrics/internal` endpoint (gestor/nurse_manager only) returns live counters + `uptimeSeconds`

### Passo 8 — Encryption key rotation (`feat(security)`)
- `scripts/rotate-encryption-key.js`: re-encrypts all AES-256-GCM sensitive fields with a new key, supports file + Postgres drivers, `--dry-run` flag, auto-backup before write
- `KEY_ROTATION_PLAN.md`: when to rotate, step-by-step runbooks, rotation log

### Passo 9 — Paid infra go-live checklist (`docs`)
- `PAID_INFRA_CHECKLIST.md`: Render Starter ($7), Neon Launch ($19), Upstash upgrade path, Cloudflare, DNS cutover, monitoring setup, smoke test sequence, total ~$26–31/month
- `render.yaml`: comment on free-tier cold-start limitation

### Passo 10 — LGPD organizational checklist (`docs(lgpd)`)
- `LGPD_COMPLIANCE_CHECKLIST.md`: 10 sections — DPO, ROPA/DPIA, privacy notice, data subject rights (Art. 18), third-party DPAs, technical/organizational security, incident response (72h ANPD notification), retention policy, training

---

## Production status

### Go / No-Go decision

| Area | Status | Notes |
|---|---|---|
| Core API functionality | ✅ Go | Auth, patients, records, 2FA, backup all working |
| Data encryption at rest | ✅ Go | AES-256-GCM on CPF/CNS/2FA secrets |
| Authentication security | ✅ Go | scrypt passwords, JWT rotation, rate limiting |
| Integration tests | ✅ Go | 27 tests passing in CI |
| CI pipeline | ✅ Go | Tests + build + secret scan on every push |
| Migration system | ✅ Go | Idempotent, Postgres-only |
| Key rotation tooling | ✅ Go | Script + runbook ready |
| Observability | ✅ Go | Request IDs, structured logs, in-process metrics |
| Free tier infrastructure | ⚠️ No-Go | 30s cold starts unacceptable for clinical use |
| Paid infrastructure | ⏳ Pending | Requires Render + Neon upgrade (~$26/mo) |
| LGPD — technical | ✅ Go | Encryption, audit log, privacy requests, data export |
| LGPD — organizational | ⏳ Pending | DPO appointment, ROPA, privacy notice, DPAs |
| JSONB normalization | ⏳ Deferred | Plan documented; migrate when scale requires |

### Verdict

**Technically ready for production.** Infrastructure upgrade (Passo 9) and LGPD organizational steps (Passo 10 checklist) must be completed before public launch.

---

## Residual risks

| Risk | Severity | Mitigation |
|---|---|---|
| JSONB single-row antipattern limits concurrent writes | Medium | `withDb()` serialized lock prevents corruption; migrate per `DB_NORMALIZATION_PLAN.md` when load grows |
| No `twoFactorSecret` rotation for users | Low | Rotation follows standard 2FA re-setup flow; no automated tooling needed |
| Neon free tier: no point-in-time restore | Medium | Application-level backup (`/admin/backup/export`) + `scripts/restore-backup.js` mitigate data loss risk until Neon Launch plan is activated |
| `ana@clinica.local` demo account in production | Medium | Remove or rotate password before exposing to external users; demo seeding disabled in prod via `IS_PROD` guard |
| Council verification `required` mode in production | Low | `COUNCIL_VERIFY_URL` must be set; `n8n` endpoint must be live before registration works |

---

## Next steps (post-launch)

1. Upgrade Render to Starter plan and Neon to Launch plan
2. Appoint DPO and publish privacy policy
3. Sign data processing agreements with Neon, Render, Upstash, council verification provider
4. Set up Logtail/Papertrail log drain with `LOG_FORMAT=json`
5. Create UptimeRobot monitor for `/health`
6. Remove or rotate demo account `ana@clinica.local` before external user onboarding
7. Schedule Phase 7: JSONB normalization (execute `DB_NORMALIZATION_PLAN.md` Phase A)
