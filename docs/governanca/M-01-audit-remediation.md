# M-01 — Audit Remediation: Import Pipeline Persistence

**Status:** OPEN — análise completa; implementação pendente  
**Data:** 2026-06-23  
**Origem:** AUDIT-01 achado HIGH  
**Escopo:** Análise e design de remediação apenas — sem alteração de código  
**Restrições:** Não altera arquitetura aprovada (MIG-01, ARCH-INT-01, Canonical Model, Source Profiles, Mapping, Validation, Selection, UI-STG-01, UI-HOMO-01)

---

## GOV-02 — Parecer

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | O problema M-01 é real? | **SIM** |
| 2 | Existe evidência objetiva? | **SIM** |
| 3 | O problema bloqueia migração real? | **SIM** |
| 4 | O problema bloqueia operação clínica? | **NÃO** |
| 5 | O problema bloqueia piloto? | **NÃO** |
| 6 | O problema afeta auditoria? | **SIM** (jobs em trânsito) |
| 7 | O problema afeta recuperação após falha? | **SIM** |
| 8 | O problema afeta integridade dos dados? | **SIM** (em trânsito) / **NÃO** (pós-commit) |
| 9 | O problema pode ser corrigido sem alterar arquitetura aprovada? | **SIM** |
| 10 | M-01 é realmente o único bloqueador HIGH restante? | **SIM** |

---

## FASE 1 — Auditoria de Estado

### Inventário de estado em memória

Toda a persistência do pipeline de importação vive em três `Map()` declarados no topo de `backend/src/services/import-pipeline.js` linhas 18–20:

```javascript
const importJobsStore = new Map();
const importStagingStore = new Map(); // jobId → { patients, events }
const importRawStore = new Map();     // jobId → raw payload
```

**`importJobsStore`** — estrutura por job:

```
id, unitId, teamId, sourceProfileId, sourceSystem, status,
lgpdConsentRecordId, createdBy, createdAt, updatedAt,
localFilters, stats, errors, homologationResult,
homologatedBy, homologatedAt, commitAt, auditHash
```

**`importStagingStore`** — estrutura por job:

```
{
  patients: [ { importJobId, entityType, canonicalData, sourceId,
                validationStatus, mergeCandidate, mergeTargetId,
                incompleteProfile, createdAt } ],
  events:   [ { importJobId, entityType, canonicalData, sourceId,
                patientSourceId, validationStatus, mergeCandidate, createdAt } ]
}
```

**`importRawStore`** — estrutura por job:

```
{ payload: <objeto PEC completo>, hash: <SHA-256 hex>, receivedAt: <ISO8601> }
```

### O que precisa sobreviver a restart

| Store | Sobrevive restart? | Impacto se perdido |
|-------|-------------------|-------------------|
| `importJobsStore` — jobs terminais (`committed`, `discarded`, `failed`) | **NÃO** | Histórico de importações perdido; audit trail destruída |
| `importJobsStore` — jobs em trânsito (`received` → `staging`) | **NÃO** | Jobs ficam em limbo; staging não pode ser commitado |
| `importStagingStore` — jobs em `homologating` com GO | **NÃO** | Commit impossível: staging não existe mais |
| `importStagingStore` — jobs em `staging`/`selecting` | **NÃO** | Job em estado inconsistente; reprocessamento necessário |
| `importRawStore` — hash de integridade | **NÃO** | Sem prova de integridade do payload original |
| `importRawStore` — payload completo | **NÃO** | Não pode reprocessar sem re-upload |

### Análise por fase do ciclo de vida

| Status do job no restart | Staging em memória | Dado em produção | Consequência |
|--------------------------|-------------------|-----------------|-------------|
| `received` / `mapping` / `validating` / `selecting` / `profiling` | ausente (normal) | NENHUM | Limpo: job pode ser discartado e recriado |
| `staging` | presente em memória → perdido | NENHUM | Job em limbo com status `staging` mas sem staging |
| `homologating` (GO dado) | presente → perdido | NENHUM | Commit impossível; GO perdido; staging perdido |
| `homologating` (sem GO) | presente → perdido | NENHUM | Reprocessamento necessário |
| `committed` | ausente (limpo após commit) | **GRAVADO** | Dados seguros; mas job metadata perdida |
| `discarded` | ausente (limpo após NO_GO) | NENHUM | Job limpo; mas metadata perdida |
| `failed` | ausente | NENHUM | Job limpo; mas metadata e histórico perdidos |

**Conclusão FASE 1:** Três categorias de impacto:
1. **Crítico** — jobs `homologating` com GO: commit se torna impossível após restart
2. **Alto** — jobs terminais (`committed`, `discarded`, `failed`): histórico e audit trail destruídos
3. **Médio** — jobs em trânsito (`staging`, `selecting`, etc.): requerem reprocessamento

---

## FASE 2 — Auditoria de Persistência

### Evidência objetiva — `ensurePostgresState`

`backend/src/db.js:326-343`:

```javascript
async function ensurePostgresState(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // ... apenas INSERT inicial
}
```

Nenhuma das tabelas de importação existe. A função só cria `app_state`.

### Evidência objetiva — comentário incorreto no pipeline

`import-pipeline.js:7-8`:

```javascript
// In-memory mode (file driver / test): staging stored in importJobsStore
// PostgreSQL mode: staging stored in app_import_staging table
```

Esse comentário afirma que existe modo Postgres. Não existe. Toda lógica usa os Maps independentemente do driver configurado. O comentário documenta uma intenção nunca implementada.

### Ciclo de vida das estruturas em memória

**Criação:**
- `createImportJob` → `importJobsStore.set(id, job)` — linha 83
- `runProfiling` → `importRawStore.set(jobId, {...})` — linha 113
- `stageRecords` → `importStagingStore.set(jobId, staged)` — linha 249

**Leitura:**
- `getImportJob` → `importJobsStore.get(id)` — linha 88
- `listImportJobs` → `Array.from(importJobsStore.values())` — linha 92
- `getStagedRecords` → `importStagingStore.get(jobId)` — linha 263
- `executeCommit` → `importJobsStore.get(jobId)` + `importStagingStore.get(jobId)` — linhas 310, 322

**Deleção:**
- `submitHomologation` NO_GO → `importStagingStore.delete(jobId)` — linha 287
- `executeCommit` → `importStagingStore.delete(jobId)` — linha 416

**Sem mecanismo de sincronização com disco ou Postgres em nenhum ponto.**

### Volume estimado (50K pacientes)

| Dado | Estimativa | Armazenamento adequado |
|------|-----------|----------------------|
| Job metadata | ~2KB/job | `app_import_jobs` (trivial) |
| Raw hash | 32 bytes (SHA-256 hex = 64 chars) | `app_import_raw` (trivial) |
| Raw payload (pacientes) | 25–50MB por job de 50K pacientes | **Não armazenar em DB** |
| Staged patients | ~1KB/paciente × 50K = ~50MB por job | `app_import_staging` (viável como JSONB) |
| Staged events | ~500B/evento × 50K = ~25MB por job | `app_import_staging` (viável) |

**Decisão de design para raw payload:** Não persistir payload completo. Motivos:
1. LGPD minimização: PII bruta não deve persistir além do necessário
2. Tamanho: 25–50MB por job × múltiplos jobs = armazenamento impraticável
3. Necessidade: payload só é usado para calcular hash (feito na ingestão); reprocessamento requer re-upload pelo operador de qualquer forma
4. Alternativa: persistir apenas `rawHash` + `receivedAt` em `app_import_raw`

---

## FASE 3 — Modelo de Dados

### Tabelas a criar em `ensurePostgresState`

#### `app_import_jobs`

Persiste todo o metadata do ciclo de vida do import job.

```sql
CREATE TABLE IF NOT EXISTS app_import_jobs (
  id                      TEXT         PRIMARY KEY,
  unit_id                 TEXT         NOT NULL,
  team_id                 TEXT         NOT NULL,
  source_profile_id       TEXT         NOT NULL,
  source_system           TEXT         NOT NULL,
  status                  TEXT         NOT NULL DEFAULT 'received',
  lgpd_consent_record_id  TEXT,
  created_by              TEXT,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  local_filters           JSONB        NOT NULL DEFAULT '{}',
  stats                   JSONB        NOT NULL DEFAULT '{}',
  errors                  JSONB        NOT NULL DEFAULT '[]',
  homologation_result     TEXT,
  homologated_by          TEXT,
  homologated_at          TIMESTAMPTZ,
  commit_at               TIMESTAMPTZ,
  audit_hash              TEXT
);
```

#### `app_import_raw`

Persiste hash de integridade do payload original. Sem payload (LGPD minimização).

```sql
CREATE TABLE IF NOT EXISTS app_import_raw (
  job_id       TEXT         PRIMARY KEY
                            REFERENCES app_import_jobs(id) ON DELETE CASCADE,
  raw_hash     TEXT         NOT NULL,
  received_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

#### `app_import_staging`

Persiste registros em staging aguardando homologação e commit.

```sql
CREATE TABLE IF NOT EXISTS app_import_staging (
  id                  BIGSERIAL    PRIMARY KEY,
  job_id              TEXT         NOT NULL
                                   REFERENCES app_import_jobs(id) ON DELETE CASCADE,
  entity_type         TEXT         NOT NULL,   -- 'patient' | 'clinical_event'
  source_id           TEXT         NOT NULL,
  patient_source_id   TEXT,                    -- apenas para eventos
  canonical_data      JSONB        NOT NULL,
  validation_status   TEXT         NOT NULL,
  merge_candidate     BOOLEAN      NOT NULL DEFAULT FALSE,
  merge_target_id     TEXT,
  incomplete_profile  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_staging_job_id
  ON app_import_staging(job_id);

CREATE INDEX IF NOT EXISTS idx_import_staging_job_entity
  ON app_import_staging(job_id, entity_type);
```

### Compatibilidade com estrutura existente

A estrutura dos objetos nos Maps mapeia diretamente para as colunas:

| Campo JS (Map) | Coluna SQL | Transformação |
|---------------|-----------|--------------|
| `id` | `id` | direto |
| `unitId` | `unit_id` | snake_case |
| `canonicalData` | `canonical_data` | JSONB via `JSON.stringify` |
| `stats` | `stats` | JSONB |
| `errors` | `errors` | JSONB |
| `localFilters` | `local_filters` | JSONB |
| `homologatedAt` | `homologated_at` | ISO string → TIMESTAMPTZ |

Sem necessidade de alterar estrutura de dados do pipeline existente.

---

## FASE 4 — Recovery

### Protocolo de recovery ao iniciar em Postgres mode

Na inicialização do backend (`ensurePostgresState`), após criar as tabelas:

```sql
-- Marcar como failed todos os jobs em estado não-terminal que perderam staging
UPDATE app_import_jobs
SET
  status     = 'failed',
  updated_at = NOW(),
  errors     = errors || '[{"stage":"recovery","reason":"server restart — re-submit required"}]'::jsonb
WHERE
  status NOT IN ('committed', 'discarded', 'failed');
```

**Justificativa:** Jobs em estados não-terminais ao reiniciar não têm staging em memória (perdido). Marcá-los como `failed` com razão clara é mais seguro que deixá-los em limbo. O operador vê o estado, sabe que precisa re-submeter o payload.

### Tabela de recovery por estado

| Estado pré-restart | Ação no recovery | Dado em produção |
|-------------------|-----------------|-----------------|
| `received` | → `failed` (reason: restart) | nenhum — seguro |
| `profiling` | → `failed` (reason: restart) | nenhum — seguro |
| `mapping` | → `failed` (reason: restart) | nenhum — seguro |
| `validating` | → `failed` (reason: restart) | nenhum — seguro |
| `selecting` | → `failed` (reason: restart) | nenhum — seguro |
| `staging` | → `failed` (reason: restart) | nenhum — seguro |
| `homologating` | → `failed` (reason: restart) | nenhum — seguro |
| `committed` | intocado | **gravado e seguro** |
| `discarded` | intocado | nenhum — correto |
| `failed` | intocado | nenhum — correto |

### Casos de recovery pós-implementação

**Caso 1 — Job committed pré-restart:**
- `status = committed` persiste em `app_import_jobs`
- `auditHash`, `commitAt`, `homologatedBy` preservados
- Dados de produção em `db.patients`/`db.acsVisits` intactos
- **Resultado: 100% recuperado**

**Caso 2 — Job em homologating com GO pré-restart:**
- Pré-M-01 fix: commit impossível (staging perdido)
- Pós-M-01 fix: staging lido de `app_import_staging`; commit continua após restart
- **Resultado: 100% recuperado**

**Caso 3 — Job em validating pré-restart:**
- Staging ainda não existe (etapa anterior)
- Recovery marca como `failed`
- Operador re-submete payload
- **Resultado: reprocessamento necessário (aceitável)**

**Caso 4 — Raw hash:**
- `app_import_raw.raw_hash` persiste
- Reprocessamento pode verificar: novo hash == hash original?
- **Resultado: integridade verificável**

---

## FASE 5 — Audit Trail

### O que compõe o audit trail de um import

| Item | Armazenado onde | Status pós-fix |
|------|----------------|----------------|
| `auditHash` SHA-256 do commit | `app_import_jobs.audit_hash` | **Persiste** |
| `commitAt` timestamp | `app_import_jobs.commit_at` | **Persiste** |
| `homologatedBy` userId | `app_import_jobs.homologated_by` | **Persiste** |
| `homologatedAt` timestamp | `app_import_jobs.homologated_at` | **Persiste** |
| `createdBy` userId | `app_import_jobs.created_by` | **Persiste** |
| `rawHash` integridade do payload | `app_import_raw.raw_hash` | **Persiste** |
| `stats` (total, mapped, committed) | `app_import_jobs.stats` | **Persiste** |
| Erros de pipeline | `app_import_jobs.errors` | **Persiste** |
| Staging pre-commit | `app_import_staging` | Limpo após commit (correto) |

### Idempotência pós-fix

`executeCommit` já tem guarda de idempotência:

```javascript
if (job.status === "committed") {
  return { ok: true, idempotent: true };
}
```

Pós-fix, `job` é lido de Postgres — guarda funciona após restart.

### Compatibilidade com MIG-01

Todos os 34 testes de MIG-01 rodam em file driver (Maps). O fix adiciona Postgres como segundo driver. File driver permanece inalterado para testes. **Nenhum teste existente quebra.**

---

## FASE 6 — Testabilidade

### Testes necessários para encerrar M-01

#### 6.1 — Testes unitários (driver Postgres)

**T-M01-01:** `createImportJob` persiste em `app_import_jobs`
```
arrange: banco limpo
act: createImportJob(...)
assert: SELECT id FROM app_import_jobs WHERE id = jobId → encontrado
```

**T-M01-02:** `getImportJob` lê de Postgres após restart simulado
```
arrange: INSERT em app_import_jobs diretamente (bypass Map)
act: getImportJob(id)
assert: retorna objeto com todos os campos
```

**T-M01-03:** `listImportJobs` retorna todos os jobs do DB
```
arrange: 3 jobs no DB com status diferentes
act: listImportJobs()
assert: retorna array com 3 elementos, ordenado por createdAt desc
```

**T-M01-04:** `stageRecords` persiste em `app_import_staging`
```
arrange: job criado
act: stageRecords(jobId, selectionResult com 5 patients + 5 events)
assert: SELECT COUNT(*) FROM app_import_staging WHERE job_id = jobId = 10
```

**T-M01-05:** `getStagedRecords` lê de Postgres após Maps limpos
```
arrange: INSERT direto em app_import_staging
act: getStagedRecords(jobId)
assert: retorna { patients: [...], events: [...] }
```

**T-M01-06:** `submitHomologation` NO_GO limpa staging de Postgres
```
arrange: job em homologating com staging em DB
act: submitHomologation(jobId, "NO_GO", "justificativa de 10+ chars", userId)
assert: SELECT COUNT(*) FROM app_import_staging WHERE job_id = jobId = 0
```

**T-M01-07:** `executeCommit` lê staging de Postgres, não de Map
```
arrange: job em homologating GO, staging em DB, Maps limpos (simula restart)
act: executeCommit(jobId, withDb, addAuditLog, buildAuditActor)
assert: ok = true, auditHash presente, app_import_jobs.status = 'committed'
```

**T-M01-08:** `rawHash` persiste em `app_import_raw`
```
arrange: job criado
act: runProfiling(jobId, rawPayload)
assert: SELECT raw_hash FROM app_import_raw WHERE job_id = jobId = SHA-256(rawPayload)
```

#### 6.2 — Testes de recovery

**T-M01-09:** Recovery marca jobs não-terminais como `failed`
```
arrange: 3 jobs em estados { mapping, homologating, selecting }
act: triggerRecovery() (equivalente à execução de ensurePostgresState)
assert: todos com status = 'failed', errors contém 'server restart'
```

**T-M01-10:** Recovery não toca jobs terminais
```
arrange: 2 jobs em { committed, discarded }
act: triggerRecovery()
assert: status inalterado para ambos
```

#### 6.3 — Testes de integração (E2E com Postgres)

**T-M01-11:** Pipeline completo recebido → committed persiste em Postgres
```
act: runFullPipeline → submitHomologation GO → executeCommit
assert: app_import_jobs.status = 'committed' + app_import_staging limpo
```

**T-M01-12:** Pipeline completo sobrevive a restart simulado
```
act: runFullPipeline (job em homologating)
act: limpar Maps (simula restart)
act: getImportJob → getStagedRecords → executeCommit
assert: commit bem-sucedido lendo de Postgres
```

**T-M01-13:** Regressão MIG-01 — todos os 34 testes continuam passando
```
act: npm test (test/mig-01.test.mjs) com DRIVER=file
assert: 34/34 PASS
```

**T-M01-14:** Regressão APS-01 — A–F continuam passando
```
act: npm test (test/*.test.mjs exceto mig-01)
assert: todos PASS
```

#### 6.4 — Testes de idempotência pós-restart

**T-M01-15:** Commit idempotente funciona após restart
```
arrange: job committed em Postgres, Maps limpos
act: executeCommit(jobId, ...) novamente
assert: { ok: true, idempotent: true }
```

---

## FASE 7 — Classificação dos Sub-Itens

| Sub-item | Descrição | Severidade | Evidência |
|----------|-----------|-----------|-----------|
| M-01-A | `app_import_jobs` ausente de `ensurePostgresState` | **HIGH** | `db.js:326-343` — nenhum `CREATE TABLE app_import_jobs` |
| M-01-B | `app_import_staging` ausente | **HIGH** | `db.js:326-343` — nenhum `CREATE TABLE app_import_staging`; commit impossível após restart |
| M-01-C | `app_import_raw` ausente | **MEDIUM** | `db.js:326-343` — hash de integridade perdido; payload corretamente não armazenado |
| M-01-D | Sem recovery de jobs em trânsito | **MEDIUM** | Nenhuma lógica de boot que detecte e limpe jobs em limbo |
| M-01-E | Comentário incorreto sobre Postgres mode | **LOW** | `import-pipeline.js:7-8` — documenta comportamento que não existe |
| M-01-F | Sem abstração de driver (MA-01 de AUDIT-01) | **MEDIUM** | Toda lógica acoplada a Maps; troca de driver requer reescrita |

**CRITICAL:** 0  
**HIGH:** 2 (M-01-A, M-01-B)  
**MEDIUM:** 3 (M-01-C, M-01-D, M-01-F)  
**LOW:** 1 (M-01-E)

---

## FASE 8 — Critério de Aceite

M-01 pode ser declarado **RESOLVED** quando todos os seguintes itens forem verificáveis por evidência:

| # | Critério | Como verificar |
|---|----------|---------------|
| CA-01 | `ensurePostgresState` cria `app_import_jobs` com todos os campos | `\d app_import_jobs` no Postgres de staging |
| CA-02 | `ensurePostgresState` cria `app_import_staging` com índices | `\d app_import_staging` + `\di` |
| CA-03 | `ensurePostgresState` cria `app_import_raw` | `\d app_import_raw` |
| CA-04 | `createImportJob` escreve em DB (Postgres mode) | T-M01-01 PASS |
| CA-05 | `getImportJob` lê de DB após Maps limpos | T-M01-02 PASS |
| CA-06 | `listImportJobs` lê de DB | T-M01-03 PASS |
| CA-07 | `stageRecords` escreve em `app_import_staging` | T-M01-04 PASS |
| CA-08 | `getStagedRecords` lê de `app_import_staging` | T-M01-05 PASS |
| CA-09 | `submitHomologation` NO_GO deleta de `app_import_staging` | T-M01-06 PASS |
| CA-10 | `executeCommit` lê staging de DB após restart simulado | T-M01-07 PASS |
| CA-11 | `runProfiling` persiste hash em `app_import_raw` | T-M01-08 PASS |
| CA-12 | Recovery marca não-terminais como `failed` | T-M01-09 PASS |
| CA-13 | Recovery preserva terminais | T-M01-10 PASS |
| CA-14 | Pipeline E2E persiste em Postgres | T-M01-11 PASS |
| CA-15 | Pipeline sobrevive restart simulado | T-M01-12 PASS |
| CA-16 | Commit idempotente funciona pós-restart | T-M01-15 PASS |
| CA-17 | MIG-01: 34/34 testes passando (file driver) | T-M01-13 PASS |
| CA-18 | APS-01A–F: todos passando | T-M01-14 PASS |

**Todos os 18 critérios devem ser PASS para declarar M-01 RESOLVED.**

---

## FASE 9 — Decisão Executiva

**M-01 está: OPEN**

**Justificativa:**

1. Problema confirmado com evidência objetiva (`db.js:326`, `import-pipeline.js:18-20`)
2. Impacto real em produção: restart destrói audit trail de importações e torna commit impossível após restart
3. Fix é definido, mínimo e não altera arquitetura aprovada: 3 tabelas SQL + 6 funções adaptadas para leitura/escrita em Postgres quando `DRIVER=postgres`
4. 18 critérios de aceite verificáveis estabelecidos
5. 15 testes definidos cobrindo unit, integration, recovery, idempotência e regressão
6. Nenhuma funcionalidade nova, nenhum novo Source Profile, nenhuma alteração em Canonical Model

**O fix não abre novas iniciativas. Resolve exatamente o que foi encontrado.**

### Design de implementação (sem código — referência para sprint futura)

A implementação mínima segue o padrão já existente em `db.js`:

1. **`ensurePostgresState`** — adicionar 3 `CREATE TABLE IF NOT EXISTS` + índices + query de recovery (UPDATE non-terminal → failed)
2. **`import-pipeline.js`** — adicionar `getDriver()` check (igual ao padrão de `withDb`):
   - `DRIVER=file` (ou test): continua usando Maps (sem mudança)
   - `DRIVER=postgres`: delega a funções que fazem INSERT/SELECT/UPDATE em Postgres
3. Funções a criar (Postgres path): `pgCreateJob`, `pgGetJob`, `pgListJobs`, `pgUpdateJob`, `pgSaveStaging`, `pgGetStaging`, `pgClearStaging`, `pgSaveRawHash`
4. File driver path (Maps): inalterado — todos os testes MIG-01 continuam passando sem alteração

**Estimativa de implementação:** ~150 linhas em `import-pipeline.js` + ~60 linhas em `db.js` (ensurePostgresState + recovery query).

---

## RESULTADO OBRIGATÓRIO

| # | Item | Resultado |
|---|------|-----------|
| 1 | M-01 confirmado? | **SIM** |
| 2 | Bloqueia migração real? | **SIM** |
| 3 | Bloqueia piloto (file driver)? | **NÃO** |
| 4 | Bloqueia operação clínica? | **NÃO** |
| 5 | Recovery após restart está garantido? | **NÃO** — depende da implementação |
| 6 | Audit trail permanece íntegro? | **NÃO** — para jobs não-committed; **SIM** para committed (dados em produção) |
| 7 | Persistência está completa? | **NÃO** — depende da implementação |
| 8 | Existem novos bloqueadores HIGH? | **NÃO** |
| 9 | M-01 pode ser encerrado? | **SIM** — 18 critérios definidos, fix mínimo possível |
| 10 | Classificação final | **OPEN** |
| 11 | Status | **PASS** — análise completa; implementação é próximo passo |

---

## Próximo Passo

Sprint de implementação de M-01:

1. Implementar tabelas em `ensurePostgresState` (M-01-A, M-01-B, M-01-C)
2. Implementar driver switch em `import-pipeline.js` (M-01-F)
3. Implementar recovery protocol em boot (M-01-D)
4. Executar todos os 15 testes (T-M01-01 a T-M01-15)
5. Verificar 18 critérios de aceite
6. Declarar M-01 RESOLVED em CTRL-01 quando CA-01 a CA-18 = PASS
