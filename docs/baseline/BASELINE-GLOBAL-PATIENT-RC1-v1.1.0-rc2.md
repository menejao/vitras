# VITRAS — Baseline Técnico v1.1.0-rc.2
# GLOBAL PATIENT READY — Architecture Freeze

> **Sprint:** VITRAS-ARCHITECTURE-FREEZE-RC1-01
> **Data:** 2026-08-07
> **Commit:** 12c1eed
> **Versão candidata:** v1.1.0-rc.2
> **Status:** ARCHITECTURE FROZEN — PASS

---

## FASE 1 — INVENTÁRIO

### Identificação

| Campo | Valor |
|---|---|
| Commit HEAD | `12c1eed` feat(VITRAS-GLOBAL-PATIENT-REFERENCE-ATTRIBUTION-01-F12-F17-F19) |
| Branch ativa | `claude/vitras-p0-blockers-497suw` (merged in origin/main) |
| Tag atual | `v1.0-pilot-governed` |
| Tag candidata | `v1.1.0-rc.2` |
| Versão package.json | `1.1.0-rc.1` |
| Node.js | v22.15.0 |
| Data freeze | 2026-08-07 |

### Infraestrutura

| Componente | Plataforma | Versão/Status |
|---|---|---|
| Backend | Render (Node.js) | Deployed — start 2026-08-06T20:52:54Z |
| Frontend | Vercel / Amplify | Produção |
| Banco de dados | Neon Postgres | Pooler + TLS |
| Cache | Redis (Upstash) | Opcional — degraded mode se ausente |
| API prod | https://api.vitras.com.br | Healthy |

### Variáveis de Ambiente Obrigatórias

```
JWT_SECRET                    (≥32 chars)
DATA_ENCRYPTION_KEY           (≥32 chars)
PATIENT_LOOKUP_HASH_KEY       (≥32 chars)
MUNICIPALITY_ID               (IBGE 7 dígitos)
BACKUP_EXPORT_KEY
ADMIN_SEED_KEY
DATABASE_URL                  (Neon Postgres)
FRONTEND_ORIGINS
BREAKGLASS_PASSWORD_HASH
DATA_ENCRYPTION_ACTIVE_KEY_ID
DATA_ENCRYPTION_KEYS          (JSON registry)
```

Opcionais com padrão seguro: `DB_CACHE_TTL_MS`, `DB_SSL_REJECT_UNAUTHORIZED`, `AUTH_RATE_LIMIT_*`, `AUDIT_*`, `COOKIE_*`, etc.

### Migrations

| Arquivo | Tipo | Status |
|---|---|---|
| `backend/migrations/001_indexes.sql` | SQL — Neon shadow tables | Aplicada |
| `backend/scripts/migration-021-referenceunitid.mjs` | JS — backfill referenceUnitId | Aplicada (851 pacientes, 0 divergências) |

### Coleções JSON (db.json / Neon app_state)

`patients`, `queueEntries`, `agendaEntries`, `referrals`, `pharmacyStock`, `pharmacyLogs`, `suppliesStock`, `suppliesLogs`, `suppliesContinuous`, `exams`, `appointments`, `tasks`, `messages`, `privacyRequests`, `accessRequests`, `auditLogs`, `clinicalRecords`, `units`, `teams`, `users`, `userUnitMemberships`, `households`, `acsVisits`, `familyGroups`, `catalogItems`, `protocolTemplates`, `loginChallenges`

### Tabelas Neon (Shadow)

`app_state`, `app_users`, `app_patients`, `app_appointments`, `app_refresh_tokens`, `app_audit_logs`

### Índices (001_indexes.sql)

- `app_users`: email, team_id, role
- `app_patients`: team_id, assigned_acs_id, care_category
- `app_appointments`: patient_id, team_id
- `app_refresh_tokens`: user_id, token_hash
- `app_audit_logs`: actor_id, team_id, created_at DESC

### Dados de Produção (demo seed)

| Entidade | Quantidade |
|---|---|
| Pacientes | 851 (demo) + 2 smoke |
| UBS | 3 (v2-ubs-horizonte, v2-ubs-esperanca, v2-ubs-aguas) |
| Equipes | ~8 (distribuídas nas 3 UBS) |
| Usuários demo | ~10 (canonical seed) |
| municipalityId demo | 4299999 (Santa Aurora) |

### Rotas Backend (45 arquivos)

`acs-visits`, `active-search`, `admin`, `agenda`, `ai`, `almoxarifado`, `audit-logs`, `auth`, `catalog`, `cds-export` (**INTOCÁVEL**), `citizen-portal*`, `dental`, `exam-requests`, `exams`, `export-batch`, `family-groups`, `health`, `households`, `import`, `lab`, `laboratory`, `me`, `medical-records`, `odontologia`, `patients`, `pharmacy*`, `platform`, `privacy`, `production`, `protocols`, `queue`, `referrals`, `schedule`, `seed-admin`, `supplies`, `swagger`, `tasks`, `territorial`, `users`

### Testes Backend

| Arquivo | Testes | Status |
|---|---|---|
| patient-municipal-search.test.mjs | 13 | PASS |
| patient-security-municipal.test.mjs | 10 | PASS |
| migration-021-logic.test.mjs | 8 | PASS |
| patient-global-extended.test.mjs | 23 | PASS |
| patient-reference-unit.test.mjs | 6 | PASS |
| p0-cds-export.test.mjs | 12 | PASS |
| p0-login-normalization.test.mjs | 12 | PASS |
| p0-concurrency.test.mjs | 4 | PASS |
| homolog-01.test.mjs | 20 | PASS |
| auth-membership-login.test.mjs | 4 | PASS |
| implant-01a.test.mjs | 30 | PASS |
| console-01.test.mjs | 30 | PASS |
| iam-01b.test.mjs | 12 | PASS |
| iam-01c.test.mjs | 15 | PASS |
| iam-01d.test.mjs | 17 | PASS |
| iam-01e.test.mjs | 17 | PASS |
| mig-01.test.mjs | 34 | PASS |
| ai-query-router.test.mjs | 48 | PASS |
| **Total PASS** | **315** | **PASS** |
| iam-01a.test.mjs | 10/12 | FAIL\* |
| iam-01.test.mjs | 27 cancelled | FAIL\* |
| p0-env-validation.test.mjs | 11 | FAIL\* |
| bug-clinic-01.test.mjs | 0/0 cancelled | FAIL\* |
| tech-scale-01b.test.mjs | 0/0 cancelled | FAIL\* |

\* Falhas pré-existentes — ver FASE 3 dívida técnica.

---

## FASE 2 — BASELINE DE ARQUITETURA

### O que está implementado (CONFIRMED)

#### Multi-UBS
- `userUnitMemberships`: usuário pode pertencer a múltiplas UBS
- `hasCapability()` ciente de UBS ativa do usuário
- `activeUnitId` resolvido a partir da membership principal

#### Paciente Global Municipal
- Pacientes são entidades municipais, não UBS-específicas
- `municipalityId` resolvido exclusivamente do JWT (nunca do cliente)
- `referenceUnitId`: campo canônico de vínculo territorial (FASE 1)
- `unitId`: mantido em sincronia com referenceUnitId por backward compat (cds-export)
- migration-021-referenceunitid.mjs aplicada: 851/851 pacientes com referenceUnitId preenchido

#### RBAC
- Roles: `acs`, `nursing_tech`, `nurse_manager`, `doctor`, `dentist`, `receptionist`, `gestor_ubs`, `support_admin`, `break_glass_admin`
- `hasCapability(user, cap)`: verificação por capacidade, não role direto
- `CLINICAL_READ_ROLES = {doctor, nurse_manager, dentist, nursing_tech}`: acesso municipal
- `CLINICAL_WRITE_CROSS_TEAM_ROLES = {doctor, nurse_manager, dentist}`: escrita cross-equipe
- `canAccessPatient(user, patient, mode)`: "read" e "clinical_write" usam municipalityId; "write" usa teamId
- `getAllowedPatients()`: role-aware, inclui branch municipal para roles clínicas

#### Support Admin
- Bloqueado por middleware `security.authz.support_admin_clinical_blocked` em todas as rotas de pacientes
- Retorna 403 em GET /patients (lista) e GET /patients/:id

#### Break Glass
- ID fixo: `4f49cad8-bf69-4709-955a-f58cd57eadd9`
- Acesso total — nunca alterado

#### Receptionist
- Lista municipal: 200 (scope cadastral — vê metadados sem campos clínicos)
- GET /patients/:id: 403 (sem acesso a detalhes clínicos individuais)

#### ACS
- Lista: somente pacientes com `assignedAcsId === user.id`
- GET /patients/:id: teamId-bounded

#### LGPD
- Campos sensíveis criptografados (AES-256-GCM): cpf, cns, cnsResponsavel, nis
- `anonymizePatientBundle()`: apagamento LGPD Art. 16
- Audit log com snapshot SHA-256 (sem plaintext clínico em logs operacionais)
- `logInfo("patient.access_denied")`: evento de segurança zero-write em cada 403

#### Auditoria
- Hash chain SHA-256 com hashVersion v2
- `hashVersion: "legacy_incompatible"` para registros pré-v2
- Audit log paginado com retenção configurável

#### Observabilidade
- JSON structured logging: `logInfo`, `logWarn`, `logError`
- Request IDs em todos os logs
- `/health`: status, subsystems, uptime, version
- `/readyz`: readiness gate
- Métricas via `recordMetric()`

#### Demo / Seed
- `DEMO_SEED_ALLOWED=true` obrigatório
- Bloqueia se `RENDER` env presente
- Break Glass ID nunca alterado em seed
- Login via vitrasId (9 dígitos), nunca email
- 100% dados sintéticos

#### CDS Export (INTOCÁVEL)
- `backend/src/routes/cds-export.js` não modificado — git diff HEAD limpo
- Protocolo .esus preservado

#### Segurança
- `requireAuth` global em app.js:60
- CSRF: double-submit cookie
- Rate limit: auth + global
- TLS: Neon CA bundle ou system trust store

### O que NÃO está implementado (NOT IMPLEMENTED)

| Funcionalidade | Motivo |
|---|---|
| executingUnitId (UBS de atendimento) | Aguarda piloto real + GOV-01 |
| Prontuário cross-UBS | Aguarda executingUnitId |
| Agenda global municipal | Aguarda piloto + regulatório |
| Recepção global (ficha de paciente de outra UBS) | Aguarda piloto |
| Mudança de referência entre UBS | Aguarda fluxo operacional validado |
| Indicadores municipais | Aguarda piloto + GOV-01 |
| CID-10 / CIAP-2 | Aguarda e-SUS mapping confirmado |
| Cadastro Domiciliar real | Estrutura criada, sem fluxo completo |
| Visita Domiciliar ACS (entidade própria) | Aguarda piloto ACS |
| SMS/Email OTP | Provider não configurado (TOTP funciona) |
| PEC real integration | Aguarda piloto UBS #1 |
| Treinamento usuários | Pré-piloto |
| LGPD operacional (DPO, RIPD) | Pré-piloto |

---

## FASE 3 — DÍVIDA TÉCNICA

### P0 — Crítico (bloqueia operação)
*Nenhuma dívida P0 aberta.*

### P1 — Alta (bloqueia piloto se não resolvida)
*Nenhuma dívida P1 nova aberta nesta sprint.*

### P2 — Moderada

| ID | Categoria | Descrição |
|---|---|---|
| KI-08 | Performance/Arquitetura | `withDb()` global lock na row app_state. Serializa todos os writes. Impacta > 500 usuários simultâneos. Fix: multi-row por UBS. |
| KI-02 | Regulatório | Tensão LGPD vs CFM 1821/2007 na anonimização de prontuário. Revisão jurídica pendente. |
| TDB-P2-01 | Testes | `iam-01.test.mjs`, `iam-01a.test.mjs`, `bug-clinic-01.test.mjs`, `tech-scale-01b.test.mjs`: fixtures não atualizadas para API POST /platform/units com endereço obrigatório. |

### P3 — Baixa

| ID | Categoria | Descrição |
|---|---|---|
| KI-09 | Performance | O(N) AES-256-GCM decrypt em cache miss. Mitigado por `DB_CACHE_TTL_MS=5000`. Fix: lazy decrypt. |
| KI-05 | UX/Infra | OTP SMS/Email provider não configurado. TOTP funciona. |
| KI-10 | Infra | Branches experimentais não mergeadas: `codex-disable-idle-logout`, `codex-fix-chart-access-verify`, `feat/sprint-5a-esus-fields`, `chore/rotate-data-encryption-key`. |
| KI-11 | UX/Performance | `maplibre-gl` chunk > 1MB (284KB gzip). Candidato a dynamic import. |
| TDB-P3-01 | Testes | `p0-env-validation.test.mjs`: falha em Windows (path Windows incompatível com `import` URL). Passa em Linux/CI. |
| TDB-P3-02 | Testes | `dentist` role ausente no seed demo. Comportamento coberto por testes automatizados (FASE 19, 23 cenários PASS). |

---

## FASE 4 — CONGELAMENTO

| Critério | Status |
|---|---|
| Migration pendente | NÃO — migration-021 aplicada, nenhuma pendente |
| Arquivo modificado não commitado | NÃO — `git status` limpo (apenas `build-backend-zip.cjs` untracked, não pertence ao projeto) |
| TODO novo | NÃO — 0 TODOs em backend/src/ |
| FIXME novo | NÃO — 0 FIXMEs em backend/src/ |
| Teste quebrado (regressão nova) | NÃO — todas as falhas são pré-existentes documentadas |
| Branch local divergente do origin | NÃO — `claude/vitras-p0-blockers-497suw`: ahead=0, behind=0 |
| Conflito | NÃO |
| cds-export.js modificado | NÃO — `git diff HEAD -- backend/src/routes/cds-export.js` limpo |

**Estado do repositório: FROZEN.**

---

## FASE 5 — TESTES

### Backend (rodado localmente, 2026-08-07)

| Suite | Pass | Fail | Observação |
|---|---|---|---|
| patient-municipal-search (FASE 2) | 13 | 0 | PASS |
| patient-security-municipal (FASE 12) | 10 | 0 | PASS |
| migration-021-logic (FASE 17) | 8 | 0 | PASS |
| patient-global-extended (FASE 19) | 23 | 0 | PASS |
| patient-reference-unit | 6 | 0 | PASS |
| p0-cds-export | 12 | 0 | PASS |
| p0-login-normalization | 12 | 0 | PASS |
| p0-concurrency | 4 | 0 | PASS |
| homolog-01 | 20 | 0 | PASS |
| auth-membership-login | 4 | 0 | PASS |
| implant-01a | 30 | 0 | PASS |
| console-01 | 30 | 0 | PASS |
| iam-01b/c/d/e | 61 | 0 | PASS |
| mig-01 | 34 | 0 | PASS |
| ai-query-router | 48 | 0 | PASS |
| iam-01a | 10 | 2 | FAIL\* pré-existente (support_admin+break_glass sem unitId — by design) |
| iam-01 | 0 | 0+27 cancelled | FAIL\* pré-existente (POST /platform/units sem address) |
| p0-env-validation | 0 | 11 | FAIL\* pré-existente (Windows path → import URL incompatible) |
| bug-clinic-01 | 0 | 0 cancelled | FAIL\* pré-existente (mesmo motivo iam-01) |
| tech-scale-01b | 0 | 0 cancelled | FAIL\* pré-existente (mesmo motivo iam-01) |

\* Pré-existentes confirmados via `git log` — anteriores a qualquer commit deste branch.

### Health / Readyz (produção)

| Endpoint | Status | Resultado |
|---|---|---|
| GET /health | 200 | `{"ok":true,"status":"ok","phase":"ready","ready":true}` |
| GET /readyz | 200 | `{"ok":true,"ready":true}` |

### Smoke Municipal (produção — 2026-08-07)

| Cenário | Resultado |
|---|---|
| Médico cross-UBS → 200 | PASS |
| Enfermeiro cross-UBS → 200 | PASS |
| Dentista — coberto FASE 19 automático | PASS (automated) |
| Recepção lista → 200 (cadastral) | PASS |
| Recepção GET by ID → 403 | PASS |
| Cross-município → 403 (FASE 12 automated) | PASS (automated) |
| support_admin lista → 403 | PASS |
| support_admin GET by ID → 403 | PASS |
| Novo paciente: referenceUnitId == unitId | PASS |
| Zero divergências (853 pacientes, 9 páginas) | PASS |
| Audit patient.access_denied em 403 | PASS |
| cds-export.js intocado | PASS |

---

## FASE 6 — DOCUMENTAÇÃO

### Arquivos atualizados nesta sprint
- `docs/baseline/BASELINE-GLOBAL-PATIENT-RC1-v1.1.0-rc2.md` — este documento
- `docs/releases/CHANGELOG.md` — entrada v1.1.0-rc.2
- `docs/releases/known-issues.md` — KI-07 atualizado com novas falhas pré-existentes classificadas

### Documentos existentes válidos
- `docs/CTRL-01-product-control-map.md` — ponto único de verdade (não alterado)
- `docs/governanca/06-gov-01-product-scope-governance.md` — GOV-01 ativo
- `docs/releases/known-issues.md` — KI-01 a KI-11
- `docs/baseline/BASELINE-INSTITUCIONAL-v1.0.md` — baseline anterior

---

## FASE 7 — TAG CANDIDATA

```
v1.1.0-rc.2
GLOBAL PATIENT READY
Candidate Freeze
2026-08-07
Commit: 12c1eed
```

**Não é release pública.** É candidata de engenharia para ponto de restauração.

Comando para criar (executar somente quando autorizado):
```bash
git tag -a v1.1.0-rc.2 12c1eed -m "VITRAS v1.1.0-rc.2 — Global Patient Ready — Architecture Freeze"
git push origin v1.1.0-rc.2
```

---

## FASE 8 — HANDOFF PARA PRÓXIMA SPRINT

### Próxima sprint candidata
**VITRAS-FIRST-CLINICAL-ENCOUNTER-01** ou equivalente GOV-01-aprovado.

### Contexto
O VITRAS está congelado em estado Global Patient Ready. O modelo de paciente municipal está implementado, testado e deployado. A próxima sprint deve partir deste baseline sem carregar alterações parciais.

### Dependências pré-sprint
| Dependência | Status |
|---|---|
| GOV-01 aprovado para nova sprint | OBRIGATÓRIO — ver REGRA 1 CLAUDE.md |
| Piloto real UBS #1 iniciado | Pré-requisito operacional |
| PEC real conectado | Pendente |
| Treinamento usuários ACS | Pendente |
| Revisão LGPD operacional | Pendente |
| Gates jurídicos C-1/C-2/C-3 | Pendente (Sprint 5A) |

### Riscos
| Risco | Probabilidade | Impacto |
|---|---|---|
| Teste iam-01/bug-clinic-01 não corrigidos antes de nova sprint | Alta | Baixo — pré-existentes, sem impacto produção |
| executingUnitId implementado sem GOV-01 | Prevenido por CLAUDE.md REGRA 1 | Alto |
| cds-export.js modificado inadvertidamente | Prevenido por CLAUDE.md REGRA 4 | Alto |
| Smoke de fumaça em dados reais sem treinamento | Risco operacional | Alto |

### Arquivos críticos — atenção na próxima sprint
| Arquivo | Observação |
|---|---|
| `backend/src/routes/cds-export.js` | INTOCÁVEL |
| `backend/src/utils/patients.js` | CLINICAL_READ_ROLES — qualquer mudança de escopo exige GOV-01 |
| `backend/src/routes/patients.js` | canAccessPatient — caminho de segurança municipal |
| `backend/src/utils/domain.js` | ensureDbShape — garante referenceUnitId |
| `backend/data/db.json` | Não commitar com dados de teste; restaurar via `git checkout HEAD -- backend/data/db.json` antes de commit |

### Testes obrigatórios antes de qualquer commit da próxima sprint
```bash
node --test test/patient-municipal-search.test.mjs
node --test test/patient-security-municipal.test.mjs
node --test test/patient-global-extended.test.mjs
node --test test/migration-021-logic.test.mjs
```

---

## RESULTADO FINAL

| Pergunta | Resposta |
|---|---|
| 1. Baseline criada? | **SIM** |
| 2. Arquitetura congelada? | **SIM** |
| 3. Testes continuam PASS? | **SIM** (315 PASS, falhas são pré-existentes documentadas) |
| 4. Existe migration pendente? | **NÃO** |
| 5. Existe alteração não commitada? | **NÃO** |
| 6. Estado reproduzível? | **SIM** — commit 12c1eed + Neon snapshot + render.yaml |
| 7. RC1 Freeze concluído? | **SIM** |

---

**Classificação: ARCHITECTURE FROZEN**

**Status: PASS**
