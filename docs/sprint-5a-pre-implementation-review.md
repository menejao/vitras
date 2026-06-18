# Sprint 5A Pre-Implementation Review

| Campo | Valor |
|---|---|
| Versão | 1.1 |
| Data | 2026-06-11 |
| Nota de versao | v1.1 — 2026-06-11 — Incorporacao de nao-conformidades NC-L1, NC-L2, NC-L3, NC-L4, NC-IE identificadas em auditoria QA Senior. |
| Status | REVISAO PRE-IMPLEMENTACAO — aguarda respostas D-PRE |
| Baseline | v1.0-pilot-governed (commit d20add9) |
| Branch alvo | feat/sprint-5a-esus-fields (a partir de main) |
| Auditor Delivery | Delivery Governor |
| Auditor QA | QA Senior |
| Aprovacao final | Tech Lead |

---

## 1. Resumo Executivo

Esta revisao consolida os resultados de duas auditorias independentes conduzidas em 2026-06-11 sobre o planejamento da Sprint 5A Foundation do VITRAS, antes de qualquer escrita de codigo.

**Contexto:** A Sprint 5A resolve um silent data loss critico ativo (26 campos descartados silenciosamente pelo `.strict()` do schema desde antes do go-live), implementa conformidade minima e-SUS APS para o piloto UBS-001, e introduz breaking changes em RBAC para o role ACS. Estas mudancas afetam diretamente dados cadastrais de saude publica sob LGPD Art. 11 (dados sensiveis).

**Achados das auditorias:**

- Duas inconsistencias criticas entre `sprint-5a-foundation-plan.md` e `sprint-5a-implementation-plan.md v1.1` foram identificadas (migration 012 e campo `situacaoDeRua`). O documento autoritativo para implementacao e o implementation plan v1.1.
- A infraestrutura de testes do backend usa banco JSON em memoria e nao toca PostgreSQL real. Treze gaps de cobertura foram classificados como CRITICAL, cinco como HIGH.
- Cinco bloqueadores QA impedem garantias de qualidade minimas para fases criticas.
- Sete condicionantes NO-GO foram formalizados.

**Parecer:** GO CONDICIONADO. A sprint pode ser iniciada com as restricoes e pre-condicoes documentadas na Secao 12.

---

## 2. Escopo Auditado

| Documento | Versao | Autoridade |
|---|---|---|
| `docs/sprint-5a-foundation-plan.md` | 2026-06-10 | Referencia historica — SUPERADO em pontos de conflito |
| `docs/sprint-5a-implementation-plan.md` | 1.1 — 2026-06-10 | AUTORITATIVO |
| `docs/esus-data-model-v1.md` | 1.0 — 2026-06-10 | CONGELADO |
| `docs/esus-conformity-gap-analysis.md` | — | Referencia |
| `backend/src/schemas.js` | baseline d20add9 | Estado atual |
| `backend/src/utils/patients.js` | baseline d20add9 | Estado atual |
| `backend/src/utils/helpers.js` | baseline d20add9 | Estado atual |
| `backend/src/routes/patients.js` | baseline d20add9 | Estado atual |
| `backend/test/helpers.js` | baseline d20add9 | Estado atual (infraestrutura de testes) |
| `frontend-react/src/hooks/usePatientModal.js` | baseline d20add9 | Estado atual |

**Fases cobertas:** Fase 0 (pre-codigo) a Fase 8 (KI-02 Juridico), incluindo 4 migrations DDL (012–015), 8 fases de deploy, RBAC ACS e mascaramento LGPD.

**Fora de escopo desta revisao:** Sprint 5B e posteriores; CID-10; paginacao server-side; entidade Family; `situacaoDeRua`; `orientacaoSexual`.

---

## 3. Dependencias Entre Fases

A tabela abaixo representa as dependencias de entrada e saida de cada fase. Qualquer falha de smoke propaga bloqueio para todas as fases subsequentes (condicao NG-06).

| Fase | Entrada Obrigatoria | Saida (Smoke PASS) | Bloqueia |
|---|---|---|---|
| Fase 0 — Pre-codigo | Branch main commit d20add9 | D-PRE-01 a D-PRE-09 iniciados | Todas as fases |
| Fase 1 — Silent Data Loss + Aliases | D-PRE-09 (branch criada a partir de main) | Smoke Deploy 1: 6 itens PASS; `.strict()` ativo confirmado | Fase 2 |
| Fase 2 — Campos e-SUS Patient | Smoke 1 PASS; queries de levantamento executadas; script de normalizacao rodado em staging | Smoke Deploy 2: 5 itens PASS; `cnsResponsavel` com AES-256-GCM | Fase 3 |
| Fase 3 — Migrations DDL | Smoke 1 PASS; snapshot RDS confirmado; queries de duplicados = 0; D-PRE-06 respondida | Colunas presentes via information_schema; COUNT pre = pos; idempotencia | Fase 4 |
| Fase 4 — Professional + Team + Unit | Migrations 013 e 014 PASS; D-PRE-01 e D-PRE-02 respondidas | Smoke Deploy 3: PATCH /me, /units/:id, /teams/:id PASS | Fase 5 |
| Fase 5 — Entidade Household | Smoke 3 PASS; snapshot RDS antes de migration 015 | Smoke Deploy 4: app_households criada; GET /patients/:id sem campos Household; audit logs household.created | Fase 6 |
| Fase 6 — RBAC ACS | D-PRE-03 = 0; D-PRE-04 concluida; todas fases anteriores PASS; janela manutencao agendada | Smoke Deploy 5 PASS; ACS ve apenas seus pacientes; audit log patient.acs_access_denied emitido | Fase 7 |
| Fase 7 — Auditoria + LGPD | Todos deploys anteriores PASS; AES para cnsResponsavel implementado (gate bloqueador) | Smoke Deploy 6 PASS; CPF/CNS como hash; SPECIAL_CATEGORY como [REDACTED] | Merge producao |
| Fase 8 — KI-02 Juridico (paralelo) | Dia 1 da sprint | RIPD assinado bilateralmente | Merge producao |

**Dependencias criticas nao sequenciais:**

- F6-01 e F6-02 devem ser deployed juntas (M-08 e M-09): nunca uma sem a outra.
- `cnsResponsavel` com AES-256-GCM + HMAC (F2-05) e gate de entrada obrigatorio para Fase 2 e para o merge para producao (condicao NG-02) — o campo nao pode ser deployado em nenhum ambiente sem criptografia implementada.
- D-PRE-06 (decisao AES para `cnsProfissional`) deve chegar antes do merge da migration 014.

---

## 4. Riscos de Banco de Dados

### migrations

Quatro migrations DDL estao planejadas para Sprint 5A. Nenhum arquivo de migration existe no baseline d20add9.

| Migration | Arquivo | DDL | Obrigatoria | Risco |
|---|---|---|---|---|
| 012 | `012_app_patients_esus_fields.js` | `ADD COLUMN IF NOT EXISTS race_color VARCHAR(20)` | Nao (JSONB cobre; shadow column para filtros futuros) | Baixo; adiavel para Sprint 5B |
| 013 | `013_app_units_add_cnes.js` | `ADD COLUMN IF NOT EXISTS cnes VARCHAR(7)` + unique partial index | Sim | Indice unico pode falhar se houver CNES duplicados — executar query de pre-condicao |
| 014 | `014_app_users_add_cns.js` | `ADD COLUMN IF NOT EXISTS cns VARCHAR(20)` + unique partial index | Sim | D-PRE-06 (decisao AES para `cnsProfissional`) deve ser respondida antes do merge |
| 015 | `015_create_app_households.js` | `CREATE TABLE IF NOT EXISTS app_households (...)` | Sim (Fase 5) | Tabela nova — sem impacto em dados existentes; rollback = DROP TABLE |

**INCONSISTENCIA CRITICA INC-01:** A migration 012 e descrita de formas divergentes nos documentos de planejamento:

- `sprint-5a-foundation-plan.md` Secao 8.1: dois campos — `race_color VARCHAR(80)` e `situation_de_rua BOOLEAN`.
- `sprint-5a-implementation-plan.md` v1.1 Secao 4: um campo — `race_color VARCHAR(20)`.

O implementation plan v1.1 e o documento autoritativo. Usar exclusivamente `ADD COLUMN IF NOT EXISTS race_color VARCHAR(20)`. Nao criar `situation_de_rua` — campo excluido do escopo Sprint 5A.

**INCONSISTENCIA CRITICA INC-02:** `situacaoDeRua` estava listado como obrigatorio no foundation plan. O implementation plan v1.1 o exclui explicitamente por ser SPECIAL_CATEGORY sem RIPD atualizado. Nao implementar em Sprint 5A.

**Queries de pre-condicao obrigatorias antes das migrations 013 e 014:**

```sql
-- Pre-condicao migration 013
SELECT cnes, COUNT(*) FROM app_units
  WHERE cnes IS NOT NULL AND cnes != ''
  GROUP BY cnes HAVING COUNT(*) > 1;
-- Resultado esperado: 0 linhas

-- Pre-condicao migration 014
SELECT cns, COUNT(*) FROM app_users
  WHERE cns IS NOT NULL AND cns != ''
  GROUP BY cns HAVING COUNT(*) > 1;
-- Resultado esperado: 0 linhas
```

### compatibilidade

| Mudanca | Impacto em Dados Existentes | Acao Necessaria |
|---|---|---|
| `sexAtBirth` enum `z.enum(['M','F','I'])` (F2-02) | Valores legados fora do enum (`masculino`, `feminino`, string livre) falham no PUT | Executar query de levantamento; script de normalizacao antes do Deploy 2 |
| `maritalStatus` enum `EstadoCivil` (F2-03) | Valores string livre existentes falham na validacao pos-deploy | Script de normalizacao obrigatorio; produzir script reverso antes de aplicar em producao |
| `racaCor` enum estrito UPPER_SNAKE_CASE (F2-01) | Alias F1-05 pode ter armazenado valores em minuscula entre Deploy 1 e Deploy 2 | Executar query de levantamento de `racaCor`; normalizar para UPPER_SNAKE_CASE; mapear `nao_informado` para NULL |
| `genderIdentity` enum `IdentidadeGenero` (F2-04) | Valores nao mapeados para o enum falham | Executar query de levantamento de `genderIdentity` antes de ativar enum estrito |
| Aliases `.transform()` (F1-05 a F1-08) | Nenhum — adicao; valores legados no banco sao lidos pelo alias | Timing: frontend so troca para nome canonico apos alias estabilizado em producao |

**INCONSISTENCIA ALTA INC-05:** O foundation plan lista `nao_informado` como valor valido do enum `racaCor`. O `esus-data-model-v1.md` Secao 15.1 nao tem esse valor. O script de normalizacao deve mapear `nao_informado` para `NULL`.

### rollback

| Fase | Rollback Disponivel | Gap Critico |
|---|---|---|
| Fase 1 (schemas) | Reverter PR — sem impacto em banco | Nenhum |
| Fase 2 (enums estritos) | Script de re-normalizacao reversa (enum → string livre) **NAO EXISTE** | Gap critico: se rollback necessario apos script em producao, dados normalizados ficam incompativeis com schema revertido |
| Fase 3 (migrations 012–014) | `DROP COLUMN IF EXISTS`; idempotente | Requer snapshot RDS pre-execucao; sem snapshot = rollback impossivel |
| Fase 5 (migration 015) | `DROP TABLE IF EXISTS app_households` | Tabela nova — rollback limpo se sem dados; com dados = perda |
| Fase 6 (RBAC ACS) | Reverter PR; restaurar `canAccessPatient` e `getAllowedPatients` | Se ja houver pacientes sem `assignedAcsId` apos a fase, desabilitar a restricao nao restaura visibilidade imediatamente |

**Acao obrigatoria antes do Deploy 2 em producao:** Produzir script reverso de normalizacao de `maritalStatus` (enum → string livre equivalente) e de `racaCor` e `sexAtBirth`. Documentar e testar em staging.

### dupla persistencia racaCor + race_color

A migration 012 adiciona a shadow column `race_color` para suportar filtros SQL futuros (ex.: indicadores SISAB por raca/cor). O campo canonico continua sendo `racaCor` no JSONB. A coerencia entre as duas representacoes nao e garantida automaticamente: qualquer PATCH que atualize `racaCor` no JSONB deve tambem atualizar `race_color` na coluna DDL, e o script de normalizacao de dados legados deve igualmente atualizar a shadow column.

| Item | Impacto | Teste Obrigatorio | Severidade |
|---|---|---|---|
| Shadow column `race_color` vazia apos PATCH com `racaCor` | Filtros SISAB retornam zero para indicadores de raca/cor; relatorios ministeriais zerados; rejeicao de fichas CDS no SISAB | `SELECT race_color FROM app_patients WHERE id = ':id'` imediatamente apos `PATCH /patients/:id` com `racaCor: "BRANCA"` — resultado deve ser `'BRANCA'` | ALTO |
| Silent divergence entre `payload->>'racaCor'` e `race_color` | Dado de saude publica inconsistente internamente; GET retorna valor diferente do usado em filtros SQL; nao detectavel por operadores | Teste de consistencia dupla: verificar JSONB E coluna SQL no mesmo ciclo apos PATCH | ALTO |
| Script de normalizacao nao atualiza `race_color` | Registros pre-Sprint 5A ficam com `race_color = NULL` mesmo quando `payload->>'racaCor'` esta preenchido | Script deve incluir `UPDATE app_patients SET race_color = payload->>'racaCor'` com verificacao: `SELECT COUNT(*) FROM app_patients WHERE payload->>'racaCor' IS NOT NULL AND race_color IS NULL` → resultado esperado: 0 | ALTO |

---

## 5. Riscos de Backend

### schemas

| Risco | ID | Severidade | Mitigacao |
|---|---|---|---|
| `.strict()` removido acidentalmente de `PatientUpdateSchema` | R-07 | HIGH | Revisar diff linha a linha antes do merge; teste automatizado que confirma rejeicao de campo interno (`unitId` → 400) |
| Campo interno adicionado acidentalmente ao `PatientBaseShape` ou `PatientUpdateSchema` | R-07 | HIGH | Code review obrigatorio; nenhum dos campos `id`, `teamId`, `hash`, `updatedAt`, `createdAt`, `createdBy`, `unitId`, `municipalityId` pode estar no schema de entrada |
| Enum `maritalStatus` estrito sem script de rollback reverso | R-01 | CRITICAL | Produzir e testar script reverso antes do Deploy 2; nao aplicar enum em producao sem script reverso validado em staging |
| `cnsResponsavel` implementado sem AES-256-GCM + HMAC | R-02 | CRITICAL (BLOQUEADOR LGPD) | Gate de NO-GO NG-02: campo nao entra em nenhum deploy sem criptografia |
| Alias `raceColor` → `racaCor` com case divergente (F1-05) | R-09 | HIGH | Teste de alias: enviar `raceColor: "BRANCA"`, verificar que GET retorna `racaCor: "BRANCA"` |
| `cid10` implementado sem tabela de referencia local | INC-03 | ALTA | Nao implementar em Sprint 5A — excluido pelo implementation plan v1.1 |

**INCONSISTENCIA ALTA INC-04:** O foundation plan usa `cns` como nome de campo de API para o profissional; o implementation plan v1.1 adota `cnsProfissional` (nome canonico conforme `esus-data-model-v1.md` Secao 8.2). A coluna DDL em `app_users` permanece `cns` (migration 014). O campo JSONB/API e `cnsProfissional`. Nao misturar.

### aliases

Os aliases `.transform()` introduzem um gap temporal de dados: entre o Deploy 1 (alias ativo) e o Deploy 2 (enum estrito ativo), o banco pode conter valores no formato enviado pelo frontend (ex.: `raceColor` em minuscula, antes da normalizacao para UPPER_SNAKE_CASE do enum). Este gap deve ser fechado com as queries de levantamento da Secao 8.1 do implementation plan antes de qualquer enum estrito ser ativado.

Cada alias possui um criterio formal de remocao segura. A remocao prematura de qualquer alias antes do frontend correspondente estar deployado em producao causa silent data loss ou bloqueio operacional sem erro visivel ao usuario.

| Alias | Dependencia | Criterio de Remocao Segura | Risco se Removido Prematuramente |
|---|---|---|---|
| `raceColor` → `racaCor` (F1-05) | `usePatientModal.js` envia `raceColor`; correcao listada como acao pos-alias na Fase 2 | (1) `usePatientModal.js` deployado em producao enviando `racaCor`; (2) smoke: PATCH sem alias retorna 200 e GET retorna `racaCor` preenchido; (3) zero registros com `racaCor IS NULL` para pacientes editados apos deploy do frontend | Retorno ao silent data loss de `racaCor`: `.strict()` rejeita ou ignora `raceColor`; nenhum erro visivel ao usuario |
| `educationLevel` → `escolaridade` (F1-06) | Frontend envia `educationLevel`; correcao listada como acao pos-alias na Fase 2 | (1) Frontend deployado enviando `escolaridade`; (2) smoke: PATCH sem alias retorna 200 e GET retorna `escolaridade` preenchido | Silent data loss de `escolaridade`: dado de escolaridade para indicadores SISAB deixa de ser coletado sem erro visivel |
| `address` → `addressLegacy` (F1-07) | Frontend envia `address`; data model Decisao 1 documenta explicitamente o risco | (1) Frontend deployado enviando `addressLegacy`; (2) smoke: PATCH com `addressLegacy` retorna 200; (3) verificar que nenhuma outra integracao ou script envia `address` | BLOQUEADOR operacional: `.strict()` rejeita `address` com 400 em todos os PATCH de pacientes com endereco; edicao de pacientes existentes fica impossivel |
| `zipCode`/`number`/`complement`/`neighborhood`/`city`/`state` → canonicos (F1-08) | Frontend envia nomes legados | (1) Frontend atualizado enviando `cep`, `numero`, `complemento`, `bairro`, `municipioIbge`, `uf`; (2) deploy confirmado em producao; (3) smoke com cada campo canonico sem alias | Silent data loss de endereco estruturado: campos descartados sem erro |
| `housingType`/`waterSupply`/`sewage`/`garbage`/`electricity` → Household (F5-03) | Frontend continua enviando nomes legados em Sprint 5A; endpoint dedicado planejado para Sprint 5B | (1) Frontend atualizado para usar endpoint de Household; (2) endpoint deployed e validado em Sprint 5B; (3) extracao interna removida apenas apos confirmacao de zero chamadas com campos Household no payload de paciente | Dados de domicilio param de ser persistidos silenciosamente; `app_households` nao recebe novos registros; ausente em exportacoes SISAB |

**R-L3 — Remocao prematura de alias `address` → `addressLegacy`** | CRITICAL | Alias removido antes do frontend ser atualizado causa HTTP 400 em todos os PATCH de pacientes com endereco preenchido; bloqueio operacional na UBS. Criterio de remocao segura: ver tabela de aliases acima.

**R-L4 — Falha parcial Patient/Household com retorno HTTP 200 ao frontend** | CRITICAL

Cenario: Handler `PATCH /patients/:id` tem transacao DB implementada (NG-05 satisfeito), mas a transacao esta implementada incorretamente. Sub-cenarios: (1) auto-commit fora do bloco de transacao — UPDATE do Patient committed antes do BEGIN; (2) catch da excecao do INSERT de Household sem propagacao do erro e sem rollback; (3) constraint violation no INSERT de Household apos commit do Patient; (4) timeout de conexao apos UPDATE do Patient.

Resultado: Patient com campos Household removidos do JSONB + `app_households` vazio + HTTP 200 retornado ao frontend. Dado de domicilio perdido silenciosamente, sem recovery automatico.

Diferenca de NG-05: NG-05 previne deploy de handler sem transacao. R-L4 detecta implementacao incorreta da transacao que passou no code review.

Teste de falha injetada obrigatorio (distinto do teste do NG-05): Injetar falha especificamente no INSERT de `app_households` (forcar constraint violation inserindo previamente registro com mesmo `patientId`). Executar PATCH. Resultado esperado: HTTP 500 ou 422, Patient nao alterado, `app_households` vazio. Resultado que detecta o bug: HTTP 200, Patient com campos Household removidos, `app_households` vazio.

Severidade: CRITICAL — dado de saude publica perdido silenciosamente; impacto direto em exportacao SISAB e conformidade e-SUS do piloto UBS-001.

### RBAC

A Fase 6 e breaking change para o role ACS. Os riscos sao os mais altos da sprint em termos de impacto operacional.

| Risco | ID | Severidade | Mitigacao |
|---|---|---|---|
| ACS perde acesso a todos os pacientes se `assignedAcsId` em branco | R-04 | CRITICAL | Gate NG-03: D-PRE-03 deve retornar `sem_acs = 0` antes de iniciar Fase 6 |
| F6-01 deployed sem F6-02 (ou vice-versa) | R-05 | CRITICAL | M-08 e M-09 sao atomicos: nunca um sem o outro no mesmo deploy |
| getAllowedPatients sem canAccessPatient complementar | R-05 | CRITICAL | Ambas as funcoes devem ser alteradas no mesmo PR |
| D-PRE-04 nao concluida (gestores nao alinhados) | R-12 | HIGH | Gate NG-03 inclui D-PRE-04 concluida por escrito |
| `domesticViolence` exposto sem controle de acesso entre F1 e F7 | R-11 | HIGH | Campo entra como string livre em F1; mascaramento LGPD so em F7 — janela de exposicao de dado sensivel |

### APIs

| Endpoint | Fase | Breaking? | Validacao Obrigatoria |
|---|---|---|---|
| `POST /api/patients` | F1, F2 | Nao (adicao) | 26 campos aceitos; campos internos rejeitados com 400 |
| `PATCH /api/patients/:id` | F1, F2, F5 | F2 (enums estritos para dados legados) | Enum fora da lista → 400; campos Household extraidos; transacao atomica |
| `GET /api/patients` | F2, F7 | Nao para clientes existentes | `racaCor`/`etnia`/`genderIdentity` ausentes para role gestor |
| `GET /api/patients` (ACS) | F6 | Sim | ACS ve apenas pacientes com `assignedAcsId = user.id` |
| `PATCH /api/patients/:id` (ACS) | F6 | Sim | ACS PATCH em paciente nao designado → 403 |
| `PATCH /api/users/me` | F4 | Nao | `cnsProfissional`, `cboCodigo`, `cboDescricao` persistidos |
| `POST /api/privacy-requests` | F8 | Sim (bloqueio intencional) | `type: "deletion"` → 503 ate KI-02 resolvido |

---

## 6. Riscos de Frontend

### formularios

| Arquivo | Linha | Risco | Severidade |
|---|---|---|---|
| `usePatientModal.js` | 132 | `sex: form.sex.trim()` descartado pelo `.strict()` — `sexAtBirth` nunca persiste | CRITICAL (bug ativo) |
| `usePatientModal.js` | ~30–60 (`buildPatientFormState`) | Ler `p?.sex` em vez de `p?.sexAtBirth` — modal abre com sexo em branco | HIGH |
| `usePatientModal.js` | ~135–137 | Campos Household (`housingType`, `waterSupply` etc.) devem permanecer no frontend em Sprint 5A — backend faz a extracao interna; nao remover prematuramente | HIGH |
| `usePatientModal.js` | ~init state | `genderIdentity` ausente do estado inicial do modal — campo existe no schema mas nunca e enviado | HIGH |

**ZERO testes de frontend** existem no baseline d20add9. Nenhum arquivo `*.test.*` foi identificado em `frontend-react/src/`. Qualquer regressao de formulario e detectada apenas manualmente.

### componentes

Componentes DS Accordion e RadioGroup estao explicitamente fora do escopo Sprint 5A (postergados para Sprint 5B). Nenhuma alteracao de componentes de design system esta planejada para esta sprint.

### filtros

Filtros server-side em `GET /patients` estao explicitamente excluidos do escopo Sprint 5A — requerem paginacao para serem seguros. O frontend continua operando com a listagem atual. Nenhuma alteracao de filtros de UI esta planejada.

### paginacao

Paginacao em `GET /patients` esta explicitamente excluida do escopo Sprint 5A (postergada para Sprint 5B). Sem impacto nesta sprint.

---

## 7. Riscos LGPD

### dados sensiveis

Os seguintes campos introduzidos ou modificados na Sprint 5A sao classificados como SPECIAL_CATEGORY (Art. 11 LGPD) ou SENSITIVE:

| Campo | Classificacao | Fase | Requisito |
|---|---|---|---|
| `racaCor` | SPECIAL_CATEGORY | F2 | Mascaramento `[REDACTED-SPECIAL-CATEGORY]` em audit logs e GET para gestor |
| `etnia` | SPECIAL_CATEGORY | F2 | Idem |
| `genderIdentity` | SPECIAL_CATEGORY | F2, F7 | Idem |
| `cnsResponsavel` | SENSITIVE | F2 | AES-256-GCM + HMAC obrigatorio — BLOQUEADOR (NG-02) |
| `rendaFamiliar` | SENSITIVE | F2, F7 | Incluir em `anonymizePatientBundle` |
| `cnsProfissional` | SENSITIVE | F4 | Hash SHA-256 no audit log; decisao AES dependente de D-PRE-06 |
| `cpf` | SENSITIVE (ja existente) | F7 | Migrar de valor em claro para hash SHA-256 no `buildPatientAuditSnapshot` |
| `cns` | SENSITIVE (ja existente) | F7 | Idem |
| `phone` | SENSITIVE (ja existente) | F7 | Mascaramento (ocultar ultimos 4 digitos) no audit log |
| `situacaoDeRua` | SPECIAL_CATEGORY | EXCLUIDO Sprint 5A | Nao implementar sem RIPD atualizado |
| `materialPredominanteParedes` | SENSITIVE (campo individual + conjunto Household = perfil socioeconomico SENSITIVE) | Roles clinicos + ACS + admin | Tratar como SENSITIVE em `snapshot_before`/`snapshot_after` de Household | Gestor NAO tem acesso; ACS e enfermeiro podem criar/atualizar via Fase 5 |
| `socialVulnerability` | SENSITIVE | Roles clinicos + admin | Campo nao pode aparecer em claro em audit logs acessiveis por roles nao-clinicos | ACS NAO tem acesso (nao listado como role clinico para este campo); verificar que PATCH response filtra campo por role |
| `substanceDependency` | SENSITIVE | Roles clinicos + admin | Idem `socialVulnerability` | ACS NAO tem acesso; mesmo risco de exposicao via PATCH response |

**Campo `domesticViolence` (F1):** Entra como string livre em Sprint 5A sem mascaramento (mascaramento so em Fase 7). Existe uma janela entre Deploy 1 e Deploy 6 em que esse campo sensivel pode aparecer em logs sem protecao adequada. Risco R-11.

### controle de acesso

| Regra | Implementacao | Fase | Status |
|---|---|---|---|
| `racaCor`, `etnia`, `genderIdentity` ausentes no GET /patients para role gestor | Serializacao por role na listagem | F7 | Nao implementado no baseline |
| `cnsResponsavel` retornado decriptado apenas para roles clinicos | Logica de decriptacao condicional por role | F2 | Nao implementado no baseline — BLOQUEADOR |
| `rendaFamiliar` e campos de endereco sob controle `anonymizePatientBundle` | Funcao de anonimizacao | F7 | Parcialmente implementado — necessita expansao |
| ACS ve apenas pacientes com `assignedAcsId = user.id` | `getAllowedPatients` + `canAccessPatient` | F6 | Nao implementado no baseline — breaking change |

**Gap de acesso ACS:** Em Sprint 5A, o ACS passa a editar pacientes via `PATCH /patients/:id` (Fase 6). Se a serializacao do response nao filtrar por role, o ACS recebe `socialVulnerability` e `substanceDependency` na resposta do PATCH. O smoke do Deploy 5 deve incluir verificacao de que o ACS nao recebe esses campos na resposta.

### trilha de auditoria

| Gap | Risco | Fase | Severidade |
|---|---|---|---|
| `buildPatientAuditSnapshot` nao inclui `cpf`, `cns`, `phone`, `genderIdentity` no baseline | CPF e CNS aparecem em claro no audit log — violacao LGPD grave | F7 | CRITICAL |
| `racaCor`, `etnia`, `genderIdentity` nao mascarados em `snapshot_before`/`snapshot_after` | Campos SPECIAL_CATEGORY em claro no audit log | F7 | CRITICAL |
| `cnsProfissional` em claro no `buildUserAuditSnapshot` se D-PRE-06 nao implementar AES | Campo SENSITIVE em claro | F4, F7 | HIGH |
| Eventos `household.created` e `household.updated` ausentes do baseline | Nova entidade sem rastreabilidade de auditoria | F5 | HIGH |
| Evento `patient.acs_access_denied` ausente do baseline | Tentativas de acesso indevido sem rastreabilidade | F6 | HIGH |
| `anonymizePatientBundle` nao cobre `racaCor`, `etnia`, `genderIdentity`, `rendaFamiliar`, `cnsResponsavel` | LGPD Art. 18 operando com cobertura incompleta | F2, F7 | CRITICAL |

**BLOQUEADOR QA-3:** O conteudo atual dos audit log snapshots nao tem cobertura automatizada. CPF pode estar em claro hoje e nao e detectavel por testes existentes.

---

## 8. Riscos Multi-Tenant

O modelo multi-tenant do VITRAS e baseado em `unitId` e `teamId`. A Sprint 5A nao altera a arquitetura de isolamento de tenant, mas introduz novos campos e uma nova entidade (Household) que devem respeitar o isolamento existente.

| Risco | Severidade | Fase | Mitigacao |
|---|---|---|---|
| Campos novos e-SUS armazenados no JSONB do paciente sem verificacao de `teamId` | HIGH | F1, F2 | A logica de patch existente ja propaga `teamId`; verificar que handlers nao expoe payload sem filtro de team |
| Entidade `app_households` vinculada a `patientId` e `teamId` — se `teamId` for omitido na criacao, household fica sem tenant | HIGH | F5 | Handler de extracao interna (F5-03) deve derivar `teamId` do paciente, nao do payload da requisicao |
| RBAC ACS scope por `assignedAcsId` introduz sub-tenant dentro do team — pacientes de um mesmo team passam a ter visibilidade diferente entre ACS | CRITICAL | F6 | Gate D-PRE-03 obrigatorio; politica para pacientes `sem_acs` deve ser definida antes do deploy |
| Campos novos de paciente vistos por usuario de outro tenant apos campos e-SUS | HIGH | F1, F2 | Os testes existentes cobrem cross-team para pacientes, mas nao especificamente com os campos e-SUS novos — gap de cobertura identificado |
| GET /patients com role gestor — `racaCor`/`etnia`/`genderIdentity` mascarados, mas outros campos novos de outros tenants nao testados | HIGH | F7 | Cobertura de testes de mascaramento por role deve incluir contexto multi-tenant |

---

## 9. Riscos de Auditoria

| Risco | ID | Severidade | Descricao |
|---|---|---|---|
| CPF em claro no audit log | — | CRITICAL | `buildPatientAuditSnapshot` no baseline nao inclui `cpf` — campo aparece em claro em `snapshot_before`/`snapshot_after` de operacoes de paciente existentes; Fase 7 corrige mas o gap existe hoje |
| CNS em claro no audit log | — | CRITICAL | Idem para `cns` |
| Campos SPECIAL_CATEGORY sem redacao nos logs | — | CRITICAL | `racaCor`, `etnia`, `genderIdentity` ausentes da logica de mascaramento do audit log no baseline |
| `anonymizePatientBundle` sem cobertura automatizada | BLOQUEADOR QA-2 | CRITICAL | LGPD Art. 18 operando sem alarme automatizado |
| Hash chain AUD-01 sem teste de regressao durante Sprint 5A | — | HIGH | Fix AUD-01 (hashVersion v2) nao tem teste de regressao; operacoes de Sprint 5A podem introduzir regressao silenciosa |
| Audit log de Household ausente | — | HIGH | Nova entidade `app_households` precisa de eventos `household.created` e `household.updated` no mesmo handler da Fase 5 |
| `cnsProfissional` em claro no `buildUserAuditSnapshot` | — | HIGH | Dependente de decisao D-PRE-06; se AES obrigatorio, campo deve ser hash antes do merge |
| Conteudo de snapshots sem cobertura automatizada | BLOQUEADOR QA-3 | CRITICAL | Qualquer campo SENSITIVE que vaze para o audit log nao e detectavel pelos testes existentes |

---

## 10. Itens NO-GO

As condicoes abaixo impedem o inicio ou continuidade da Sprint 5A. Cada condicao deve ser verificada explicitamente antes da fase indicada.

| ID | Condicao | Fase Bloqueada | Verificacao |
|---|---|---|---|
| NG-01 | Branch `feat/sprint-5a-esus-fields` criada a partir de `chore/rotate-data-encryption-key` em vez de `main` (commit d20add9) | TODAS | `git log --oneline -1 $(git merge-base HEAD main)` deve retornar d20add9 |
| NG-02 | `cnsResponsavel` implementado sem AES-256-GCM + HMAC | Fase 2 e merge para producao | Code review + teste de integracao com banco real |
| NG-03 | D-PRE-03 com `sem_acs > 0` sem politica de acesso definida para pacientes sem ACS | Fase 6 | Resultado da query deve ser `sem_acs = 0` OU politica documentada e aprovada pelo gestor |
| NG-04 | RIPD nao assinado bilateralmente (Vitras + Prefeitura/SMS) | Merge para producao | Documento fisico com assinatura; prazo sugerido 2026-06-30 |
| NG-05 | Handler `PATCH /patients/:id` (Fase 5) sem transacao DB atomica para Patient + Household | Deploy 4 | Teste de falha injetada: erro na criacao de Household deve fazer rollback do PATCH de Patient |
| NG-06 | Smoke de fase anterior com qualquer item em FAIL | Proxima fase | Todos os itens do smoke listados no implementation plan devem ser PASS |
| NG-07 | Script de normalizacao de dados legados nao executado e validado em staging antes de ativar enum estrito | Deploy 2 com enums estritos | Executar em staging; verificar COUNT pre = pos; verificar que nenhum valor fora do enum permanece |

---

## 11. Recomendacoes

### CRITICAL

| ID | Recomendacao | Fase | Responsavel |
|---|---|---|---|
| C-01 | Produzir e testar em staging o script de rollback reverso de normalizacao de `maritalStatus` (enum → string livre equivalente) antes de aplicar em producao. Mesmo script deve cobrir `racaCor` e `sexAtBirth`. | Antes do Deploy 2 em producao | Tech Lead |
| C-02 | Implementar `cnsResponsavel` com AES-256-GCM + HMAC antes de qualquer deploy da Fase 2 (condicao NG-02). Escrever teste de integracao com banco real verificando que o valor armazenado nao e o plaintext. | F2 | Tech Lead |
| C-03 | Implementar transacao DB atomica no handler `PATCH /patients/:id` para a operacao Patient + Household (condicao NG-05). Testar com falha injetada na criacao de Household. | F5 | Dev responsavel pela Fase 5 |
| C-04 | Nao iniciar Fase 6 antes de D-PRE-03 retornar `sem_acs = 0`. Se resultado > 0, definir politica por escrito com gestores antes de prosseguir. | F6 | Tech Lead |
| C-05 | F6-01 (`getAllowedPatients`) e F6-02 (`canAccessPatient`) devem ser deployados juntos no mesmo PR — nunca separados. | F6 | Dev responsavel pela Fase 6 |
| C-06 | Expandir `buildPatientAuditSnapshot` para incluir `cpf` e `cns` como hash SHA-256 e `phone` mascarado antes de qualquer operacao de audit log com os novos campos. Este gap existe no baseline hoje. | F7 | Tech Lead |
| C-07 | Escrever testes para `anonymizePatientBundle` cobrindo todos os campos SPECIAL_CATEGORY e SENSITIVE. LGPD Art. 18 nao pode operar sem cobertura automatizada. | F2, F7 | QA / Dev |
| C-08 | Escrever testes de conteudo de audit log snapshot para verificar que CPF, CNS e campos SPECIAL_CATEGORY nunca aparecem em claro. Gap existe no baseline hoje. | F7 | QA / Dev |
| C-09 | Escrever testes de schema para todos os 26 campos novos do `PatientBaseShape` e para o comportamento `.strict()` (rejeicao de campo interno com 400). A cobertura atual e de apenas 4 campos gestacionais. | F1 | QA / Dev |
| C-10 | Scripts de normalizacao de dados legados devem ser escritos, testados em dados sinteticos e validados em staging antes de qualquer execucao em producao. Estes scripts nao existem no baseline. | Antes do Deploy 2 | Tech Lead |
| L4 | Teste de falha injetada para transacao Patient/Household: Antes do Deploy 4, validar que falha no INSERT de `app_households` (constraint violation ou timeout) causa rollback completo do PATCH de Patient e retorna HTTP 5xx — nunca HTTP 200 com Patient alterado e Household nao criado. | F5, antes do Deploy 4 | QA / Dev |

### HIGH

| ID | Recomendacao | Fase | Responsavel |
|---|---|---|---|
| H-01 | Verificar que a branch `feat/sprint-5a-esus-fields` foi criada a partir de `main` (commit d20add9) e nao de `chore/rotate-data-encryption-key`. Verificar no primeiro dia antes de qualquer commit. | Fase 0 | Tech Lead |
| H-02 | D-PRE-06 (decisao AES para `cnsProfissional`) deve ser respondida antes do merge da migration 014. Se AES obrigatorio, implementar antes do merge. | F3, F4 | Tech Lead + Juridico |
| H-03 | D-PRE-04 (alinhamento com gestores UBS-001 sobre restricao ACS) deve ser concluida com documento escrito antes de agendar a janela de manutencao da Fase 6. | F6 | Tech Lead + Gestor |
| H-04 | Usar exclusivamente o implementation plan v1.1 como referencia para migration 012 (`race_color VARCHAR(20)` — um campo). Nao usar o foundation plan para esta migration. | F3 | Dev responsavel pelas migrations |
| H-05 | Validar alias `raceColor` → `racaCor` com teste explicito: enviar `raceColor: "BRANCA"`, verificar que GET retorna `racaCor: "BRANCA"`. Atentar para divergencia de case entre alias e enum canônico. | F1 | QA / Dev |
| H-06 | Campos `housingType`, `waterSupply`, `sewage`, `garbage`, `electricity` devem permanecer no payload do frontend em Sprint 5A. Backend faz a extracao interna. Nao remover do frontend prematuramente. | F5 | Dev Frontend |
| H-07 | `domesticViolence` entra como string livre em Fase 1 sem mascaramento. Documentar a janela de risco entre Deploy 1 e Deploy 6 e avaliar se o campo deve entrar somente junto com a Fase 7. | F1, F7 | Tech Lead |
| H-08 | Escrever testes de RBAC ACS por `assignedAcsId`: ACS nao pode ver nem alterar pacientes sem `assignedAcsId = user.id`. Cobertura atual nao inclui esse scope especifico. | F6 | QA / Dev |
| H-09 | Escrever testes de migrations DDL em banco PostgreSQL real (nao mock). A infraestrutura atual usa `db.json` em memoria — nenhum teste DDL toca banco real. | F3, F5 | QA / Dev |
| H-10 | Escrever teste de regressao para o fix AUD-01 (hashVersion v2 + legacy_incompatible) antes das operacoes Sprint 5A. Hash chain pode regredir silenciosamente. | F1 | QA / Dev |
| L1 | Mascaramento de `socialVulnerability` e `substanceDependency` na resposta de PATCH para ACS: Smoke de Deploy 5 deve verificar que o response do `PATCH /patients/:id` executado com role ACS nao contem `socialVulnerability`, `substanceDependency` nem `materialPredominanteParedes`. | F6, Deploy 5 | QA / Dev |
| L2 | Smoke de dupla persistencia racaCor + race_color: Incluir como item obrigatorio no smoke de Deploy 2 a verificacao sequencial: (1) `SELECT payload->>'racaCor' FROM app_patients WHERE id = ':id'` → valor esperado; (2) `SELECT race_color FROM app_patients WHERE id = ':id'` → mesmo valor. Script de normalizacao de dados legados deve incluir atualizacao da shadow column e ser validado com `COUNT(*) WHERE racaCor IS NOT NULL AND race_color IS NULL = 0`. | F2, Deploy 2 | QA / Dev |

### MEDIUM

| ID | Recomendacao |
|---|---|
| M-01 | Escalar KI-02 ao DPO no Dia 1 da sprint com prazo formal de resposta (sugerido 2026-06-30). Nao aguardar inicio de Fase 8 para escalar. |
| M-02 | Validar enums com equipe clinica UBS-001 (D-PRE-07): confirmar valores de `racaCor`, `escolaridade`, `situacaoMercadoTrabalho`, `tipoEquipe`, `tipoImovel` antes de torna-los estritos. |
| M-03 | Atualizar `PrivacyRequestCreateSchema` para retornar 503 com mensagem informativa para `type: "deletion"` enquanto KI-02 estiver pendente (F8-03). |
| M-04 | Agendar janela de manutencao para Fase 3 (migrations DDL) e Fase 6 (RBAC ACS breaking change) com antecedencia de pelo menos 48 horas. |
| M-05 | Confirmar numeracao de migrations no banco antes de criar os arquivos: verificar que as migrations 012–015 nao conflitam com migrations ja aplicadas em staging/producao. |

### LOW

| ID | Recomendacao |
|---|---|
| L-01 | Adicionar comentario `@deprecated` em `cnsCpf` no `PatientBaseShape` e warning no bloco de derivacao em `patients.js` (F2-07). Mudanca nao funcional, zero risco. |
| L-02 | Documentar formalmente a exclusao de `situacaoDeRua` do escopo Sprint 5A no backlog, referenciando a decisao do implementation plan v1.1 e o RIPD pendente. |
| L-03 | Adicionar `genderIdentity` ao estado inicial do modal de paciente em Sprint 5A (campo existe no schema mas nunca e enviado pelo frontend). |

---

## 12. Parecer Tecnico

**Veredicto: GO CONDICIONADO**

A Sprint 5A pode ser iniciada a partir do commit d20add9 (main) com as seguintes condicoes obrigatorias:

**Condicoes pre-codigo (Fase 0 — Dia 1):**
1. Branch criada exclusivamente a partir de `main` commit d20add9 — verificar antes do primeiro commit (NG-01).
2. D-PRE-09 executado e confirmado.
3. D-PRE-03 (query `assignedAcsId`) executada em staging e resultado registrado.
4. D-PRE-05 (escalacao KI-02 ao DPO) disparada no Dia 1.

**Condicoes antes do Deploy 2 (Fase 2):**
5. Scripts de normalizacao de dados legados escritos, testados em dados sinteticos e validados em staging (BLOQUEADOR QA-1).
6. Script de rollback reverso de `maritalStatus` e `racaCor` produzido e testado (C-01).
7. `cnsResponsavel` com AES-256-GCM + HMAC implementado (NG-02).

**Condicoes antes do Deploy 4 (Fase 5):**
8. Handler `PATCH /patients/:id` com transacao atomica para Patient + Household (NG-05).

**Condicoes antes do Deploy 5 (Fase 6):**
9. D-PRE-03 com `sem_acs = 0` confirmado (NG-03).
10. D-PRE-04 concluida com documento escrito (H-03).

**Condicoes antes do merge para producao:**
11. RIPD assinado bilateralmente (NG-04).
12. Todos os smoke tests de todos os deploys com PASS (NG-06).
13. Cobertura de testes de `anonymizePatientBundle` e conteudo de audit log snapshots (BLOQUEADOR QA-2 e QA-3).

**Documento autoritativo para implementacao:** `docs/sprint-5a-implementation-plan.md` versao 1.1. O `docs/sprint-5a-foundation-plan.md` e referencia historica e deve ser ignorado nos pontos de conflito com o implementation plan (migration 012, `situacaoDeRua`, `cns` vs `cnsProfissional`, `cid10`).

**Maior risco tecnico da sprint:** A infraestrutura de testes nao toca banco PostgreSQL real. Nenhum teste de migration DDL, JSONB, indice unico parcial ou AES-256-GCM real existe. As recomendacoes C-07, C-08, C-09 e H-09 devem ser tratadas como divida tecnica com data de vencimento dentro da propria Sprint 5A, nao como backlog.
