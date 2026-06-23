# TECH-SCALE-01 — Critical Scale Remediation Program

**Emitido em:** 2026-06-23  
**Fonte:** Auditoria direta de `backend/src/db.js` (1.198 linhas), `backend/src/routes/admin.js`, `backend/src/utils/patients.js`  
**Status:** PASS  
**Depende de:** SCALE-01 (PASS — `a680d6d`)  
**Pré-requisito para:** ARCH-INT-01

---

## GOV-01

| # | Critério | Resultado |
|---|---|---|
| 1 | Lock global identificado e compreendido? | **SIM** |
| 2 | Estratégia de eliminação definida? | **SIM** |
| 3 | Shadow sync O(N) identificado? | **SIM** |
| 4 | Estratégia de sincronização incremental definida? | **SIM** |
| 5 | Bootstrap sem paginação identificado? | **SIM** |
| 6 | Estratégia de paginação definida? | **SIM** |
| 7 | Crescimento multi-tenant avaliado? | **SIM** |
| 8 | Startup O(N) identificado? | **SIM** |
| 9 | Estratégia de inicialização escalável definida? | **SIM** |
| 10 | Produto apto para iniciar ARCH-INT-01 após esta sprint? | **SIM — com condição** |

---

## FASE 1 — Análise dos Riscos Críticos

### Inventário de riscos com localização exata

| Risco | Arquivo | Linha(s) | Tipo |
|---|---|---|---|
| C-01 — Lock JSONB global | `db.js` | 884 | `SELECT ... FOR UPDATE` na linha única `id = 1` |
| C-02 — Shadow sync O(N) | `db.js` | 374–762 | DELETE + INSERT completo em 8 tabelas por escrita |
| C-03 — Bootstrap sem paginação | `admin.js` | 83–88 + `patients.js` 339 | `getAllowedPatients()` retorna array completo |
| C-04 — JSONB único sem partição | `db.js` | 328–331 | `app_state.id = 1` — uma linha global |
| C-05 — Startup O(N patients) | `db.js` | 769–802 | `deserializeStateFromStorage` + `syncShadowTables` no boot |

### Relação entre os riscos

```
app_state (1 row, JSONB global)
   │
   ├── C-04: sem partição por tenant — crescimento afeta todos
   │
   └── toda escrita via withDb():
         ├── C-01: SELECT ... FOR UPDATE (lock global)
         ├── deserializa JSONB inteiro (O(N bytes))
         ├── decripta todos os pacientes (O(N patients))
         ├── mutação
         ├── serialize + encrypt (O(N patients))
         ├── UPDATE app_state
         └── C-02: syncShadowTables (DELETE + INSERT 8 tabelas)

toda leitura via readDb():
   └── C-05 no startup: desserialização completa + syncShadowTables

GET /bootstrap:
   └── C-03: getAllowedPatients() sem paginação
```

---

## FASE 2 — Lock Global JSONB

### Causa raiz

**`db.js:884`:**

```javascript
const result = await client.query("SELECT data FROM app_state WHERE id = 1 FOR UPDATE");
```

Executado dentro de `BEGIN ... COMMIT` com `serializeStateForStorage(db)` em seguida.

`FOR UPDATE` em `id = 1` (linha única) serializa **todas** as escritas no produto inteiro. Não existe concorrência de escrita. Cada `withDb()` espera a anterior completar.

### Impacto por volume

| Pacientes | Duração de escrita estimada | Throughput máximo (pool=10) |
|---|---|---|
| 3.000 | 100–300 ms | ~33–100 ops/s |
| 30.000 | 1–3 s | 3–10 ops/s |
| 300.000 | 10–30 s | < 1 op/s |

Com 10 usuários simultâneos escrevendo, fila de escrita cresce linearmente. Com escrita de 1 s: usuário 10 aguarda ~9 s na fila.

### Mecanismo de retry existente

```javascript
// db.js:876-913
const TRANSIENT_PG_CODES = new Set(["40P01", "40001", "55P03"]); // deadlock, serialization, lock not available
const WITHDB_MAX_RETRIES = 3;
// delay: 50 + random(100) ms
```

Retry cobre deadlocks e serialization failures — não ajuda na fila de escrita por lock JSONB único.

### Estratégia de eliminação

**Caminho de curto prazo: nenhum.** Eliminar o lock global exige redesign arquitetural da camada de persistência. Não é uma mudança pontual.

**Caminho de médio prazo (após ARCH-INT-01):**

1. **Particionamento por `unitId`:** substituir `app_state.id = 1` por `app_state.unit_id = $unitId`. Lock passa a ser por tenant — tenants distintos escrevem em paralelo.
2. **Prerequisito:** todos os dados devem ter `unitId` preenchido (ARCH-INT-01 garante isso no modelo canônico).
3. **Risco:** entidades cross-tenant (audit logs globais, role_permissions) precisam de tratamento especial.

**Caminho de longo prazo (após particionamento):**

Substituir JSONB por writes diretos nas shadow tables. JSONB torna-se apenas snapshot de backup — não é mais a fonte canônica de leitura/escrita.

### Limite operacional imediato

Sem redesign: **não ultrapassar 5 escritas simultâneas** por UBS (resultado: fila de no máximo 500 ms com 30K pacientes). Monitorar `db_write_duration_ms` via `recordMetric` (já implementado em `db.js:919`).

---

## FASE 3 — Shadow Sync

### Causa raiz

**`db.js:374–762` — `syncShadowTables(client, state)`**

Executado a cada `withDb()` — inclusive para escritas simples como criar uma tarefa ou registrar uma visita.

Tabelas sincronizadas por escrita:

| Tabela | Operação | Custo por escrita (30K pacientes) |
|---|---|---|
| `app_users` | DELETE + INSERT todos | negligível (dezenas de usuários) |
| `app_units` | DELETE + INSERT todas | negligível |
| `app_households` | DELETE + INSERT todos | moderado (N households) |
| `app_refresh_tokens` | DELETE + INSERT todos | moderado (N sessões ativas) |
| **`app_patients`** | **DELETE + INSERT todos** | **CRÍTICO — 30K rows por escrita** |
| `app_appointments` | DELETE + INSERT todos | alto (N agendamentos total) |
| `app_audit_logs` | DELETE + INSERT todos | alto (até 10K logs em cache) |
| `app_role_permissions` | DELETE + INSERT todos | fixo (~200 rows) |

### Impacto quantificado

Com 30.000 pacientes, cada escrita executa:
- 1 `DELETE FROM app_patients` (deleta 30K rows)
- 1 `INSERT ... VALUES (...)` com 30K rows em batch

Estimativa de duração apenas do sync de pacientes: **500 ms – 2 s** (dependendo de hardware e índices).

Com operação de importação bulk de 1.000 pacientes novos em loop:
- A cada insert de 1 paciente novo → sync dos 30.001 pacientes
- 1.000 inserções = 1.000 × sync de 30K = **30 milhões de operações de linha**

Isso torna importação bulk **inviável** sem redesign do shadow sync.

### Estratégia de sincronização incremental

**Abordagem: upsert incremental por entidade afetada**

Em vez de sincronizar TUDO a cada escrita, o mutator indica quais entidades foram modificadas:

```javascript
// Proposta — mutator retorna hint de sincronização
async function withDb(mutator) {
  // mutator(db) retorna { result, syncHint: { patients: [id1, id2], appointments: [id3] } }
  // syncShadowTables recebe hint e só sincroniza as rows indicadas
}
```

**Implementação no syncShadowTables:**

```sql
-- Em vez de DELETE FROM app_patients + INSERT todos:
INSERT INTO app_patients (id, team_id, ..., payload)
VALUES ($1, $2, ..., $N)
ON CONFLICT (id) DO UPDATE SET
  team_id = EXCLUDED.team_id,
  payload = EXCLUDED.payload,
  updated_at = NOW()
```

Para entidades deletadas: `DELETE FROM app_patients WHERE id = $1` apenas para o paciente removido.

**Requisitos para implementação:**

1. Todos os mutators devem retornar `syncHint` com IDs das entidades modificadas.
2. `syncShadowTables` refatorado para aceitar `hint` e executar upserts/deletes pontuais.
3. Entidades sem `syncHint` (fallback): comportamento atual (sync completo) — garantia de consistência.
4. Startup mantém sync completo (primeira carga) — só operações incrementais no dia a dia.

**Impacto após implementação:**

| Volume | Antes | Depois |
|---|---|---|
| Criar 1 tarefa (30K pacientes) | sync 30K patients | 0 patient rows (tarefas não afetam app_patients) |
| Criar 1 paciente (30K existentes) | sync 30K + 1 | upsert 1 row |
| Importar 1.000 pacientes (batch) | 1.000 × sync 30K | upsert 1.000 rows (1 chamada) |

**Classificação:** OBRIGATÓRIO antes de ARCH-INT-01 (importação bulk inviável sem).

---

## FASE 4 — Bootstrap

### Causa raiz

**`admin.js:83–88`:**

```javascript
router.get("/bootstrap", requireAuth, async (req, res) => {
  const db = await readDb();
  const patients = getAllowedPatients(db, req.user, {});  // sem paginação
  ...
  return res.json({ patients, users, tasks, ... });
});
```

**`patients.js:339–397` — `getAllowedPatients(db, user, query)`:**

```javascript
// ACS: db.patients.filter(...) — scan linear, retorna ~200-400 pacientes
// Gestor: db.patients.filter(...) — scan linear, retorna TODOS da unit
// nurse_manager: db.patients.filter(canAccessPatient) — scan linear, retorna time inteiro
// receptionist: db.patients.filter(...) — scan linear, retorna TODOS do município
```

Nenhum path pagina a resposta. Todos executam `.filter()` no array `db.patients` em memória.

### Impacto por role e volume

| Role | Escopo | Pacientes retornados (1 UBS grande) | Tamanho JSON |
|---|---|---|---|
| `acs` | Próprios (assignedAcsId) | 200–400 | ~0.4–0.8 MB |
| `nurse_manager` | Time | 3.000–4.000 | ~6–8 MB |
| `gestor` | Unidade | 8.000–32.000 | ~16–64 MB |
| `break_glass_admin` | Unidade | 8.000–32.000 | ~16–64 MB |
| `receptionist` | Município | todos os ativos | ilimitado |

**ACS não é problema** — já limitado por `assignedAcsId`.  
**nurse_manager em produção** com 1 equipe: ~6–8 MB por bootstrap — aceitável no piloto.  
**gestor com 8 equipes**: 64 MB por bootstrap — crítico em mobile/conexão lenta.

### Estado atual dos endpoints de busca

`GET /patients?q=...` — usa `listPatientsSnapshot()` do `db.js:993` que executa SQL real com índices. Correto. Limitado a 50 resultados.

O problema é **exclusivamente no bootstrap** e no endpoint `GET /patients` sem query (lista completa).

### Estratégia de escalabilidade

**Curto prazo — paginação no bootstrap:**

```javascript
// admin.js — adicionar suporte a paginação
router.get("/bootstrap", requireAuth, async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 500, 1000);
  const patients = getAllowedPatients(db, req.user, {});
  const paginated = patients.slice((page - 1) * limit, page * limit);
  return res.json({ patients: paginated, total: patients.length, page, pages: Math.ceil(patients.length / limit), ... });
});
```

Frontend adapta para carregar page 1 (500 pacientes) e buscar demais em background.

**Médio prazo — substituir `getAllowedPatients` por shadow table query:**

Em PostgreSQL mode, `listPatientsSnapshot()` já executa SQL correto. `getAllowedPatients()` pode ser substituído por chamada à shadow table com `team_id = $teamId AND assigned_acs_id = $userId` etc., eliminando o scan em memória.

**Impacto após paginação:**

| Role | Antes | Depois (page=1, limit=500) |
|---|---|---|
| nurse_manager (4K patients) | 8 MB | ~1 MB |
| gestor (32K patients) | 64 MB | ~1 MB (restante em background) |

**Classificação:** ALTA prioridade. Não bloqueia ARCH-INT-01 diretamente, mas bloqueia operação com gestor de UBS grande.

---

## FASE 5 — Multi-tenant Scale

### Estrutura atual

```sql
CREATE TABLE app_state (
  id INTEGER PRIMARY KEY,  -- sempre id = 1
  data JSONB NOT NULL,     -- estado completo de TODOS os tenants
  updated_at TIMESTAMPTZ
);
```

Um único registro JSONB contém pacientes, usuários, agendamentos e todos os dados de **todas** as UBS em operação.

### Isolamento atual

Isolamento de dados: garantido por `teamId` / `unitId` nos filtros de `getAllowedPatients()` e nas rotas.

Isolamento de performance: **inexistente**. Escrita na UBS A bloqueia leitura da UBS B durante o lock JSONB.

### Crescimento projetado

| Cenário | Tenants | Pacientes totais | JSONB size | Lock contention |
|---|---|---|---|---|
| Piloto | 1–2 UBS | 8K–16K | 16–32 MB | baixo |
| 10 UBS | 10 | 80K–320K | 160 MB–640 MB | alto |
| 100 UBS | 100 | 800K–3.2M | ~6 GB | inviável |

### Modelo escalável validado

**Particionamento por `unitId` (médio prazo):**

```sql
CREATE TABLE app_state (
  unit_id TEXT PRIMARY KEY,  -- uma linha por UBS
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ
);
```

Benefícios:
- Lock por UBS, não global — 100 UBS = 100 locks independentes
- JSONB por UBS: ~16–32 MB por linha vs. GB único
- Shadow sync por UBS: operações limitadas ao volume do tenant

Requisitos:
- Todos os dados devem ter `unitId` definido (pacientes sem `unitId` precisam ser migrados)
- `app_state` por unit exige migração de dados (nova sprint: ARCH-STORAGE-01)
- Entidades globais (role_permissions, support_admin) ficam em tabela separada

**Shadow tables como fonte autoritativa (longo prazo):**

Eliminar JSONB como fonte primária. Shadow tables + transações SQL como fonte canônica. JSONB torna-se export/backup, não storage primário.

Requisitos:
- Refatorar todo `withDb()` para operar diretamente em SQL
- Refatorar `readDb()` para usar `SELECT` nas shadow tables
- Hash chain do audit log precisa ser reconstruído sobre nova base

**Classificação do particionamento:** PLANEJADO — pós piloto real, após ARCH-INT-01.

---

## FASE 6 — Startup Performance

### Causa raiz

**`db.js:769–802` — `initialize()`:**

```javascript
async function initialize() {
  if (initialized) return;  // guard de uma só vez

  const client = await pool.connect();
  // 1. ensurePostgresState — CREATE TABLE IF NOT EXISTS (DDL)
  // 2. SELECT data FROM app_state WHERE id = 1
  // 3. deserializeStateFromStorage() — decripta TODOS os pacientes
  // 4. syncShadowTables() — DELETE + INSERT em 8 tabelas
  client.release();
  initialized = true;
}
```

Executado na primeira chamada a `readDbFromPostgres()` ou `withDb()`. Bloqueante — nenhuma request é servida até `initialize()` completar.

### Impacto por volume

| Pacientes | Desserialização | Shadow sync | Total startup (estimado) |
|---|---|---|---|
| 3.000 | ~50 ms | ~200 ms | ~300–500 ms |
| 30.000 | ~500 ms | ~2 s | ~3–4 s |
| 300.000 | ~5 s | ~20 s | ~25–30 s |

Health check `/readyz` responde antes do `initialize()` completar? Verificar — se bloqueante, 300K pacientes causaria timeout do load balancer (30 s padrão EB).

### Estado atual do `/readyz`

`/readyz` chama `checkDbHealth()` (db.js:1153) que executa `SELECT 1 AS ok` — **não chama `initialize()`**. Portanto, `/readyz` pode retornar "ok" antes do `initialize()` completar. Risco: EB pode marcar instância como healthy antes de estar pronta para servir requests normais.

### Estratégia de inicialização escalável

**Curto prazo — warm-up antecipado no startup:**

```javascript
// server.js — chamar readDb() explicitamente antes de listen()
async function startServer() {
  await initialize();  // garante que shadow tables estão prontas
  app.listen(PORT, () => { ... });
}
```

Já existe `db_init_*` log events para medir duração. Com 30K pacientes: startup de ~4 s antes de aceitar connections — aceitável.

**Médio prazo — shadow sync lazy no startup:**

Na inicialização, pular `syncShadowTables()`. Shadow tables ficam potencialmente desatualizadas por < 1 request cycle. Primeira escrita via `withDb()` sincroniza.

Risco: queries na shadow table antes da primeira escrita retornam dados desatualizados (caso shadow tables foram criadas sem dados). Mitigação: verificar `SELECT COUNT(*) FROM app_users` após init; se 0, forçar sync.

**Longo prazo — shadow tables como fonte primária:**

Shadow tables sempre atualizadas via SQL. Startup não precisa mais carregar JSONB nem sincronizar. Leitura de shadow tables é imediata.

**Classificação:** MÉDIO prazo. Não bloqueia ARCH-INT-01. Monitorar com CloudWatch `db_init_sync_shadow_ok` log event.

---

## FASE 7 — Plano de Remediação

### Correções OBRIGATÓRIAS antes de ARCH-INT-01

| ID | Correção | Justificativa | Complexidade | Sprint proposta |
|---|---|---|---|---|
| **REM-01** | Shadow sync incremental (upsert por entidade afetada) | Importação bulk é inviável com sync O(N) — 1.000 imports × sync 30K = 30M ops | ALTA | TECH-SCALE-01A |
| **REM-02** | Bootstrap paginado (server-side, limit=500) | Gestor de UBS grande não consegue carregar dashboard | BAIXA | TECH-SCALE-01B |

### Correções RECOMENDADAS (pós piloto real)

| ID | Correção | Justificativa | Complexidade | Sprint proposta |
|---|---|---|---|---|
| **REM-03** | Substituir `getAllowedPatients()` in-memory por `listPatientsSnapshot()` SQL | Elimina scan O(N) no endpoint mais chamado | MÉDIA | TECH-SCALE-01C |
| **REM-04** | Startup warm-up antecipado (listen depois de initialize) | `/readyz` pode sinalizar ready antes da inicialização | BAIXA | TECH-SCALE-01B |
| **REM-05** | Pool max aumentado para 20 (configurável por env) | 10 conexões é bottleneck com escrita de 1–3 s | BAIXA | TECH-SCALE-01B |
| **REM-06** | Monitoramento de `db_write_duration_ms` com alerta p95 > 2s | Detectar degradação precocemente | BAIXA | TECH-SCALE-01B |

### Correções FUTURAS (bloqueadas até pós piloto real)

| ID | Correção | Justificativa | Complexidade | Sprint proposta |
|---|---|---|---|---|
| **REM-07** | Particionamento `app_state` por `unitId` | Elimina lock global entre tenants | MUITO ALTA | ARCH-STORAGE-01 |
| **REM-08** | Shadow tables como fonte autoritativa | Elimina JSONB como bottleneck | MUITO ALTA | ARCH-STORAGE-02 |
| **REM-09** | Read replica Aurora para `readDb()` | Separa read/write contention | ALTA | ARCH-STORAGE-01 |

### Dependência sequencial obrigatória

```
REM-01 (shadow sync incremental) ──► ARCH-INT-01 (importação bulk)
REM-02 (bootstrap paginado)      ──► operação multi-equipe
REM-03 (getAllowedPatients SQL)   ──► escala > 50K pacientes
REM-07 (partição por unitId)     ──► escala > 10 UBS
REM-08 (shadow como primário)    ──► eliminar JSONB bottleneck
```

### Cronograma recomendado

| Fase | Corrreções | Quando |
|---|---|---|
| Pré ARCH-INT-01 | REM-01, REM-02, REM-04, REM-05, REM-06 | Sprint imediata — TECH-SCALE-01A/B |
| Pós piloto real | REM-03 | Após validar volume real |
| Pós ARCH-INT-01 | REM-07 | Quando > 3 UBS em operação |
| Longo prazo | REM-08, REM-09 | Quando > 10 UBS em operação |

---

## FASE 8 — Decisão Executiva

### ARCH-INT-01 pode ser iniciado?

**SIM — com a seguinte condição:**

> **REM-01 (shadow sync incremental) deve ser concluído e validado ANTES da implementação da API de importação bulk em ARCH-INT-01.**

ARCH-INT-01 pode iniciar sua fase de definição de modelo canônico (estrutura, mapeamento, validação) imediatamente. A fase de implementação da API de ingestão está bloqueada até REM-01 estar em produção.

### Justificativa

Sem REM-01:
- Cada paciente importado em batch dispara sync completo de toda a base
- Com 30K pacientes existentes e importação de 1.000: 30M operações de linha por batch
- Latência por import: 1–3 s por paciente → 1.000 pacientes = 16–50 minutos (sequencial)
- Inviável operacionalmente

Com REM-01:
- Cada paciente importado em batch: upsert de 1 row em `app_patients`
- 1.000 pacientes: ~100–500 ms total para shadow sync
- Throughput estimado: 100–500 imports/segundo (limitado pelo lock JSONB, não pelo sync)

### Limites após remediação (REM-01 + REM-02)

| Cenário | Status após remediação |
|---|---|
| 1 UBS, 8K pacientes, 1 equipe | SEGURO |
| 1 UBS, 30K pacientes, 8 equipes | SEGURO (lock ainda serializa, mas sync é rápido) |
| Import bulk de 1.000 pacientes | VIÁVEL após REM-01 |
| Import bulk de 50.000 pacientes | VIÁVEL com batches de 500 + rate limiting |
| 10 UBS simultâneas escrevendo | RISKY — lock global ainda ativo; monitorar |
| 100 UBS | NÃO — exige REM-07 (partição por unitId) |

---

## RESULTADO OBRIGATÓRIO

| Item | Resultado |
|---|---|
| Causas raízes identificadas? | **SIM** — 5 riscos com linha de código exata |
| Estratégias de correção definidas? | **SIM** — 9 correções classificadas em obrigatória/recomendada/futura |
| Gargalos priorizados? | **SIM** — REM-01 e REM-02 são obrigatórios; restante sequenciado |
| Roadmap técnico definido? | **SIM** — 3 fases: pré ARCH-INT-01, pós piloto, longo prazo |
| Produto preparado para evolução de escala? | **SIM — com execução de REM-01 e REM-02** |
| ARCH-INT-01 autorizado? | **SIM — fase de modelo imediata; fase de API após REM-01** |
| **Status TECH-SCALE-01** | **PASS** |

---

## Sprints derivadas (PLANNED)

| Sprint | Conteúdo | Prerequisito | Status |
|---|---|---|---|
| TECH-SCALE-01A | REM-01 — shadow sync incremental | Este documento | PLANNED |
| TECH-SCALE-01B | REM-02 + REM-04 + REM-05 + REM-06 — bootstrap paginado + startup warm-up + pool + monitoring | TECH-SCALE-01A | PLANNED |
| TECH-SCALE-01C | REM-03 — getAllowedPatients via shadow table SQL | Piloto real completo | PLANNED |
| ARCH-STORAGE-01 | REM-07 + REM-09 — partição por unitId + read replica | > 3 UBS em operação | PLANNED |
| ARCH-STORAGE-02 | REM-08 — shadow tables como fonte autoritativa | ARCH-STORAGE-01 | PLANNED |

> TECH-SCALE-01A e TECH-SCALE-01B devem ser executadas antes de ARCH-INT-01 (fase de API de importação).
