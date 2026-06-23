# SCALE-01 — National Scale and Capacity Readiness Assessment

**Emitido em:** 2026-06-23  
**Fonte:** Auditoria direta de `backend/src/db.js`, `backend/src/services/audit.js`, `backend/src/routes/admin.js`, `backend/src/utils/patients.js`, `backend/src/app.js`, `backend/src/config.js`  
**Status:** PASS  
**Próxima revisão:** Antes de qualquer UBS com > 5.000 pacientes ou antes de MIG-01

---

## GOV-01

| # | Critério | Resultado |
|---|---|---|
| 1 | Existe capacidade estimada por tenant? | **SIM** |
| 2 | Existe capacidade estimada por UBS? | **SIM** |
| 3 | Existe capacidade estimada por equipe? | **SIM** |
| 4 | Existe capacidade estimada para pacientes? | **SIM** |
| 5 | Existe capacidade estimada para eventos assistenciais? | **SIM** |
| 6 | Existe gargalo conhecido de banco de dados? | **SIM** |
| 7 | Existe gargalo conhecido de backend? | **SIM** |
| 8 | Existe gargalo conhecido de frontend? | **SIM** |
| 9 | Existe gargalo conhecido de infraestrutura? | **SIM** |
| 10 | Existe plano de evolução de escala? | **SIM** |

---

## FASE 1 — Modelo de Crescimento

### Unidade de escala nacional

| Entidade | Tamanho típico ESF |
|---|---|
| Equipe ESF | 4.000 pacientes / 1.000 famílias / 1 ACS por 750 famílias |
| UBS | 2–8 equipes = 8.000–32.000 pacientes |
| Município pequeno | 1–3 UBS = 8K–96K pacientes |
| Município médio | 5–20 UBS = 40K–640K pacientes |
| Município grande | 50–200 UBS = 400K–6.4M pacientes |

### Modelo de crescimento do VITRAS

O VITRAS opera como **multi-tenant por unidade (UBS)**. Cada UBS é um `unit`. Cada equipe é um `team` dentro de uma unit. Dados de pacientes são segregados por `teamId`.

**Volume por cenário:**

| Cenário | UBS | Equipes | Pacientes | Eventos assistenciais |
|---|---|---|---|---|
| Piloto controlado | 1 | 1–2 | 3.000–8.000 | 30K–80K |
| Município pequeno | 3–5 | 6–20 | 20K–80K | 200K–800K |
| Município médio | 10–20 | 40–80 | 100K–320K | 1M–3.2M |
| Município grande | 50–200 | 200–800 | 400K–3.2M | 4M–32M |

---

## FASE 2 — Avaliação de Banco de Dados

### Arquitetura atual

**Fonte canônica:** único registro JSONB na tabela `app_state` (PostgreSQL):

```sql
SELECT data FROM app_state WHERE id = 1 FOR UPDATE;  -- toda escrita
SELECT data FROM app_state WHERE id = 1;              -- toda leitura
```

**Shadow tables** (projeções — não-canônicas):
- `app_users`, `app_patients`, `app_appointments`, `app_audit_logs`, `app_refresh_tokens`, `app_units`, `app_households`

### Caminho crítico de escrita (`withDb`)

```
BEGIN
  SELECT data FROM app_state WHERE id = 1 FOR UPDATE  -- lock global
  deserialize JSONB → JS object                        -- O(N bytes)
  decrypt sensitive fields                             -- O(N patients)
  mutator(db)                                          -- operação
  serialize JS → JSONB                                 -- O(N bytes)
  encrypt sensitive fields                             -- O(N patients)
  UPDATE app_state SET data = $1                       -- full replace
  syncShadowTables()                                   -- DELETE + INSERT por tabela
COMMIT
```

**Problema central:** o lock `FOR UPDATE` serializa **todas** as escritas globalmente. Não existe concorrência de escrita. Toda mutação espera a anterior completar.

### Estimativas de tamanho JSONB

| Cenário | Pacientes | Tamanho estimado JSONB |
|---|---|---|
| Piloto | 3.000 | ~6 MB |
| 1 UBS grande | 30.000 | ~60 MB |
| Município pequeno | 80.000 | ~160 MB |
| Município médio | 320.000 | ~640 MB |
| Município grande | 3.200.000 | ~6,4 GB |

> Estimativa base: ~2 KB por paciente (payload + campos criptografados + eventos aninhados não incluídos).  
> Com eventos clínicos aninhados (`clinicalRecords[]`, `appointments[]`) o fator pode ser 3–10× maior.

### Shadow sync — bottleneck crítico

A cada escrita, `syncShadowTables()` executa:

```sql
DELETE FROM app_patients;
INSERT INTO app_patients (...) VALUES (...), (...), ...;  -- todos os pacientes
DELETE FROM app_users;
INSERT INTO app_users ...;
-- idem para app_appointments, app_audit_logs, etc.
```

Com 30.000 pacientes: cada escrita (criar 1 registro clínico, por exemplo) executa `DELETE + 30.000 INSERTs` em `app_patients`.

**Latência estimada de escrita:**

| Pacientes | Latência de escrita atual |
|---|---|
| 3.000 | ~100–300 ms |
| 30.000 | ~1–3 s |
| 300.000 | ~10–30 s |
| 3.000.000 | TIMEOUT (> 30 s) |

### Startup e cache

Na inicialização e a cada cache miss (TTL = 1,5s):

```
SELECT data FROM app_state WHERE id = 1  -- carrega JSONB inteiro
deserializeStateFromStorage()             -- decripta todos os campos sensíveis
syncShadowTables()                        -- na init
```

Com 30K pacientes: deserialização em memória pode levar 5–15 segundos no boot. Com 300K pacientes: risco real de timeout do health check.

### Pool de conexões

```javascript
new Pool({ max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 })
```

Com escrita levando 1–3 s (30K pacientes) e pool de 10 conexões: throughput máximo de escrita = **3–10 ops/segundo**. Em operação normal (3K pacientes), escrita em 100–300 ms: throughput = **33–100 ops/segundo** — adequado para piloto.

### Índices existentes relevantes

| Tabela | Índice | Uso |
|---|---|---|
| `app_patients` | `cpf_hash` (unique) | Busca/dedup por CPF |
| `app_patients` | `cns_hash` (unique) | Busca/dedup por CNS |
| `app_users` | `email` (unique) | Login |
| `app_audit_logs` | `created_at` | Queries temporais |

**Sem índices em** `teamId`, `unitId`, `assignedAcsId` nas shadow tables — queries de escopo filtram em memória.

---

## FASE 3 — Avaliação de Backend

### GET /bootstrap — gargalo de volume de resposta

```javascript
const patients = getAllowedPatients(db, req.user, {});  // ALL scoped patients — sem paginação
const tasks = db.tasks.filter(t => teamPatientIds.has(t.patientId));  // ALL tasks
return res.json({ patients, users, tasks, protocolTemplates, ... });
```

**Bootstrap retorna TODOS os pacientes do escopo do usuário sem paginação.**

| Equipe | Pacientes retornados | Tamanho estimado da resposta |
|---|---|---|
| 1 equipe (típico) | 4.000 | ~8 MB JSON |
| break_glass_admin (UBS completa, 8 equipes) | 32.000 | ~64 MB JSON |

Com 32.000 pacientes em bootstrap: resposta de 64 MB, memória do servidor pressurizada, client-side parsing lento.

### getAllowedPatients() — scan linear

```javascript
return db.patients.filter(p => !p.inactive && canAccessPatient(user, p) && ...);
```

Operação O(N) em memória. Com 30K pacientes: ~30K comparações por request de `/patients`. Sem uso de shadow table `app_patients` para filtros.

**Search com shadow table** (existe para busca por nome/CPF/CNS): usa SQL `SELECT ... WHERE UPPER(name) LIKE $1` — correto. Mas o endpoint principal `GET /patients` usa `getAllowedPatients()` em memória.

### Throughput global

```
GLOBAL_RATE_LIMIT_MAX_REQUESTS = 600 req/min (default) por IP
AUTH_MAX_ATTEMPTS = 20 por 10 min (deve ser ≤ 10 em produção)
sensitiveDataRateLimit = 30 req/min
```

600 req/min = 10 req/s por IP — adequado para piloto com 10–50 usuários simultâneos.

### Concorrência de escrita

Com 1 equipe e 5–10 usuários simultâneos: raro ter > 2–3 escritas concorrentes. Lock JSONB aguarda ~100–300 ms por escrita — aceitável.

Com 10 UBS e 100+ usuários simultâneos: filas de escrita de 5–10 ops → latência percebida de 1–5 s antes de retornar resposta. Usuário percebe lentidão.

### Audit log

In-memory cap: **10.000 entradas** (`MAX_AUDIT_LOGS`). Em PostgreSQL mode, audit logs ficam em `app_audit_logs` shadow table — sem cap no banco.

Problema: a cada escrita, `syncShadowTables()` faz `DELETE + INSERT` de audit logs também — com 10K logs no JSONB, o sync copia 10K registros por escrita.

---

## FASE 4 — Avaliação de Frontend

### Bootstrap como única fonte de dados

O frontend recebe toda sua carga de dados via `GET /bootstrap` na inicialização. **Não existe lazy loading nem paginação no bootstrap**.

Com 4.000 pacientes: React renderiza lista com 4K itens — adequado com virtualização.  
Com 32.000 pacientes: 64MB de dados carregados no browser — risco de freeze em mobile/hardware fraco.

### Paginação em endpoints de busca

`GET /patients` → `getAllowedPatients()` sem paginação, mas retorno pode ser filtrado.  
Busca por nome/CPF (`GET /patients?q=...`) → SQL com `LIMIT 50` — correto.

### Impacto em field devices (ACS mobile)

ACS opera em celular 360–412px, conexão instável (3G/4G).

Bootstrap de 8MB (4K pacientes) em 3G (~1 Mbps): ~64 segundos de carregamento.  
Bootstrap de 64MB (32K pacientes): 512 segundos — inviável.

**Regra derivada:** bootstrap de ACS deve ser restrito apenas aos pacientes atribuídos ao ACS (`assignedAcsId`). Verificar se `getAllowedPatients()` aplica esse filtro para role `acs` — confirmar: SIM (filtro por `assignedAcsId === user.id`). ACS com 200–300 pacientes: bootstrap de ~0.5MB. Adequado.

### Dashboard KPIs

Calculados no servidor em `/bootstrap`. Não executam queries pesadas repetidamente — cálculos em memória sobre dados já carregados. Adequado para piloto.

---

## FASE 5 — Cenários Nacionais Projetados

### Cenário A: 1 UBS, 2 equipes, 8.000 pacientes

| Dimensão | Valor | Status |
|---|---|---|
| JSONB size | ~16 MB | ✅ SAFE |
| Latência de escrita | ~100–400 ms | ✅ SAFE |
| Bootstrap (nurse_manager) | ~8 MB, 4.000 pacientes | ⚠️ ACEITÁVEL |
| Bootstrap (break_glass) | ~16 MB, 8.000 pacientes | ⚠️ ACEITÁVEL |
| Shadow sync por escrita | ~8K DELETEs + INSERTs | ✅ SAFE |
| Startup deserialization | < 1 s | ✅ SAFE |
| Throughput | 30–100 ops/s | ✅ SAFE |

**Veredicto: SEGURO para piloto.**

---

### Cenário B: 10 UBS, 40 equipes, 80.000 pacientes

| Dimensão | Valor | Status |
|---|---|---|
| JSONB size | ~160 MB | ⚠️ RISKY |
| Latência de escrita | ~2–6 s | ⚠️ RISKY |
| Bootstrap (nurse_manager) | ~8 MB (team-scoped, OK) | ✅ SAFE |
| Bootstrap (break_glass) | ~16 MB (unit-scoped) | ⚠️ ACEITÁVEL |
| Shadow sync por escrita | ~80K DELETEs + INSERTs | ❌ CRITICAL |
| Startup deserialization | 5–15 s | ⚠️ RISKY |
| Throughput | 5–10 ops/s (degradado) | ⚠️ RISKY |
| Concurrent users | 100+ → filas de escrita | ❌ DEGRADADO |

**Veredicto: RISKY. Piloto condicionado a equipes pequenas. Não escala para operação nacional.**

---

### Cenário C: 100 UBS, 400 equipes, 800.000 pacientes

| Dimensão | Valor | Status |
|---|---|---|
| JSONB size | ~1,6 GB | ❌ FAILS |
| Latência de escrita | > 30 s (timeout) | ❌ FAILS |
| Startup | Timeout do health check (/readyz) | ❌ FAILS |
| Shadow sync | > 800K ops por escrita | ❌ IMPOSSIBLE |
| Pool (10 conn) | Saturação total | ❌ FAILS |

**Veredicto: INVIÁVEL sem redesign arquitetural.**

---

### Cenário D: 1.000 UBS, 4.000 equipes, 8.000.000 pacientes

**Não requer análise detalhada.** Cenário C já demonstra impossibilidade. 1.000 UBS exige arquitetura fundamentalmente diferente (sharding, particionamento por tenant, queries SQL nas shadow tables).

---

## FASE 6 — Riscos de Escala Classificados

### CRÍTICOS — bloqueiam operação com > 10 UBS

| # | Risco | Causa | Impacto |
|---|---|---|---|
| C-01 | Lock JSONB global serializa todas as escritas | `SELECT FOR UPDATE` na linha única `app_state.id=1` | Latência degrada linearmente com usuários simultâneos |
| C-02 | Shadow sync O(N) por escrita | `DELETE + INSERT` completo a cada mutação | Com 80K pacientes: cada escrita leva 2–6 s |
| C-03 | Bootstrap sem paginação server-side | `getAllowedPatients()` retorna lista completa | Com 8K pacientes por UBS: resposta de 16 MB; mobile inviável |
| C-04 | JSONB único não particiona por tenant | Todos os tenants no mesmo documento | Crescimento linear — sem isolamento de performance |
| C-05 | Startup carrega JSONB inteiro | `deserializeStateFromStorage()` na init | Com 160MB+: risco de timeout health check no boot |

### ALTOS — degradam performance com 3–10 UBS

| # | Risco | Causa | Impacto |
|---|---|---|---|
| A-01 | `getAllowedPatients()` scan em memória | Filtragem em JS, não SQL | O(N) por request; com 80K pacientes: 80K comparações por req |
| A-02 | Single EB instance sem auto-scaling | Não configurado no deploy atual | CPU spike em escrita pesada derruba todo o tenant |
| A-03 | Pool de 10 conexões | `max: 10` no Pool | Limite de 10 escritas simultâneas; escrita 2–6 s = 2–5 ops/s |
| A-04 | Audit log sync na shadow table | Incluído no `syncShadowTables()` | 10K audit entries sincronizadas a cada escrita |
| A-05 | Encrypt/decrypt O(N patients) por operação | `transformSensitiveState()` no serialize/deserialize | Com 80K pacientes: cada leitura decripta 80K campos |

### MÉDIOS — perceptíveis com > 1 UBS, gerenciáveis

| # | Risco | Causa | Impacto |
|---|---|---|---|
| M-01 | Sem cache de leitura por tenant | Cache TTL 1,5s único global | Leituras concorrentes de tenants diferentes invalidam cache mutuamente |
| M-02 | Rate limit 600 req/min por IP | Shared IP em escritório/UBS | Múltiplos usuários no mesmo IP compartilham o limite |
| M-03 | `clinicalRecords[]` aninhados no patient JSONB | Sem tabela separada para registros clínicos | Cada patient cresce indefinidamente com histórico clínico |
| M-04 | Sem CDN caching para API | Express sem cache layer | Cada request atinge o EB; sem offload para dados estáticos |
| M-05 | `app_appointments` sincronizada a cada write | Incluído no shadow sync | Shadow sync mais lento com muitos agendamentos |

### BAIXOS — monitoráveis, não bloqueantes no piloto

| # | Risco | Causa | Impacto |
|---|---|---|---|
| B-01 | Sem read replica | Aurora/RDS single instance no piloto | Read queries não separadas de writes |
| B-02 | Global rate limit pode afetar UBS inteira | Por IP, não por usuário | UBS com NAT único: 600 req/min para todos os usuários |
| B-03 | Backoff em deadlock (50–150ms) | `TRANSIENT_PG_CODES` retry | Deadlocks raros com 1 instância; mais frequentes com escala |
| B-04 | Sem compression em respostas JSON | `express.json` sem gzip default | Respostas grandes (bootstrap 16MB+) sem compressão |

---

## FASE 7 — Roadmap de Escala

### O que precisa ser feito AGORA (antes de > 1 UBS com 5K+ pacientes)

**Nenhum bloqueio imediato para o piloto com 1 UBS e 8K pacientes.**

Os riscos C-01 a C-05 só se materializam com múltiplas UBS ou alto volume.

### O que é pré-requisito para MIG-01 (Bulk Import API)

Antes de importar dados em lote, os seguintes riscos devem ser resolvidos — importação bulk agrava todos eles:

| Requisito | Risco endereçado |
|---|---|
| Paginar `GET /bootstrap` (server-side) | C-03 — bootstrap sem paginação |
| Substituir shadow sync de patients por upserts incrementais | C-02 — shadow sync O(N) |
| Validar limite prático de JSONB (benchmark com dados reais) | C-04, C-05 |

### O que pode esperar (pós piloto real)

| Iniciativa | Quando |
|---|---|
| Particionamento por tenant (JSONB por unit) | Após 5+ UBS em operação |
| Substituir `getAllowedPatients()` por SQL na shadow table | Após 2+ UBS, quando degradação for perceptível |
| Auto-scaling EB | Após validar throughput com usuários reais |
| Read replica Aurora | Após identificar read/write ratio real |
| CDN caching de API | Após analisar padrão de acesso real |
| Pool dinâmico (max > 10) | Após medir contention real |

### Threshold de alerta operacional

| Métrica | Valor | Ação |
|---|---|---|
| Pacientes por deployment | > 5.000 | Monitorar latência de escrita — iniciar SCALE-01B |
| Pacientes por deployment | > 30.000 | BLOQUEIO — não escalar sem redesign de shadow sync |
| Latência de escrita (p95) | > 2 s | Investigar shadow sync e lock contention |
| Startup time (/readyz) | > 30 s | CRÍTICO — JSONB muito grande |
| Bootstrap response size | > 10 MB | Implementar paginação urgente |

---

## Decisão Executiva

| Pergunta | Resposta | Condição |
|---|---|---|
| Produto pronto para 1 UBS sem histórico? | **SIM** | Sem restrições |
| Produto pronto para 1 UBS com 8K pacientes? | **SIM** | Monitorar latência de escrita |
| Produto pronto para 5 UBS com 40K pacientes? | **CONDICIONADO** | Shadow sync já degrada; sem importação bulk |
| Produto pronto para 10 UBS com 80K pacientes? | **NÃO** | Shadow sync torna escritas lentas (2–6 s); JSONB 160MB risky |
| Produto pronto para 100 UBS? | **NÃO** | Arquitetura atual incompatível |
| Produto pronto para importação bulk (50K pacientes)? | **NÃO** | C-02 + C-05 tornam a operação inviável |

---

## RESULTADO OBRIGATÓRIO

| Item | Resultado |
|---|---|
| Escala atual compreendida? | **SIM** |
| Limites identificados? | **SIM** — limite prático: 5.000–8.000 pacientes por deployment sem degradação perceptível |
| Gargalos identificados? | **SIM** — 5 críticos, 5 altos, 5 médios, 4 baixos |
| Capacidade nacional estimada? | **SIM** — atual: 1–2 UBS seguro; 5–10 UBS risky; 10+ UBS inviável |
| Riscos classificados? | **SIM** |
| Roadmap de escala definido? | **SIM** |
| Próxima iniciativa após SCALE-01 definida? | **SIM** — ARCH-INT-01 (após piloto real) |
| **Status SCALE-01** | **PASS** |

---

## Implicação para MR-01 e CTRL-01

A lacuna C-05 do MR-01 ("produto não preparado para 50K pacientes") está agora quantificada:

- Limite prático atual: **5.000–8.000 pacientes por deployment** sem degradação perceptível
- Limite com monitoramento: **até 30.000 pacientes** antes de shadow sync se tornar bloqueante
- Para MIG-01 operar com segurança: shadow sync deve ser substituído por upserts incrementais antes de qualquer importação bulk

CTRL-01 deve ser atualizado: SCALE-01 PASS.
