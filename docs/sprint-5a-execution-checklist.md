# Sprint 5A Execution Checklist

**Versao:** v1.2
**Data:** 2026-06-11
**Revisao:** v1.2 — 2026-06-11 — Baseline atualizado para 79d3c15 (main apos 4 commits pos-d20add9: fixes UI/brand/auth); branch criada a partir do main atual.
**Baseline:** v1.0-pilot-governed (commit d20add9) | Branch criada a partir de: 79d3c15 (main 2026-06-11)
**Branch:** feat/sprint-5a-esus-fields
**Documentos de referencia:**
- docs/sprint-5a-implementation-plan.md (v1.1 — documento autoritativo)
- docs/sprint-5a-pre-implementation-review.md (v1.1 — gate formal aprovado)
- docs/esus-data-model-v1.md (v1.0 — modelo canonico congelado)

**PRECEDENCIA:** O implementation plan v1.1 e o documento autoritativo. Em qualquer conflito com o foundation plan, o implementation plan prevalece.

**SEQUENCIA INEGOCIAVEL:** Deploy 1 → 2 → 3 → 4 → 5 → 6. Smoke com falha propaga bloqueio para todos os subsequentes (NG-06).

**DOIS GATES ABSOLUTOS (independentes de sequencia):**
- NG-01: Branch a partir de main 79d3c15 — verificar ANTES do primeiro commit (branch criada em 2026-06-11, HEAD confirmado: 79d3c15)
- NG-02: cnsResponsavel com AES-256-GCM + HMAC — nenhum deploy em nenhum ambiente sem criptografia implementada

**CAMPOS EXCLUIDOS DO ESCOPO SPRINT 5A:** situacaoRua, deficiencia, orientacaoSexual, nis, insegurancaAlimentar, beneficiosSociais (enum), entidade Family, tabela municipios IBGE, validacao digito verificador CNS, cid10, nomeSocial, endpoints dedicados POST/PATCH /households.

---

## Deploy 1 — Silent Data Loss

### Pre-condicoes

- [ ] NG-01: Branch `feat/sprint-5a-esus-fields` criada a partir de `main` commit d20add9 — verificar: `git log --oneline -1` deve retornar d20add9 antes do primeiro commit
- [ ] D-PRE-09 concluido: branch criada (evidencia: output do git log registrado)
- [ ] D-PRE-01, D-PRE-02, D-PRE-05 iniciados em paralelo (nao bloqueiam este deploy)
- [ ] D-PRE-03 executada em staging (resultado documentado)

### Implementacao

- [ ] F1-01: Adicionar 26 campos ao `PatientBaseShape` em `backend/src/schemas.js` (raceColor→racaCor alias, educationLevel→escolaridade alias, address→addressLegacy alias, campos novos)
- [ ] F1-02: Verificar que `PatientUpdateSchema` NAO inclui `teamId`, `unitId`, `hash`, `createdAt`, `updatedAt`, `createdBy`, `municipalityId` — revisar diff linha a linha
- [ ] F1-03: Corrigir `sexAtBirth` em `frontend-react/src/hooks/usePatientModal.js` linha ~132 (mapear `sex` → `sexAtBirth`)
- [ ] F1-04: Corrigir `buildPatientFormState` em `usePatientModal.js` (~linhas 30–60) para carregar `sexAtBirth`
- [ ] F1-05: Alias `raceColor` → `racaCor` via `.transform()` em `PatientBaseShape`
- [ ] F1-06: Alias `educationLevel` → `escolaridade` via `.transform()`
- [ ] F1-07: Alias `address` → `addressLegacy` via `.transform()`
- [ ] F1-08: Aliases campos endereco legado → canonicos via `.transform()`
- [ ] `.strict()` mantido ativo em `PatientUpdateSchema` — verificar que nao foi removido no diff

### Smoke

- [ ] POST /patients com os 26 campos → GET retorna todos os campos persistidos
- [ ] PATCH /patients/:id com `unitId` no body → 400 (`.strict()` ativo, mass-assignment bloqueado)
- [ ] `sexAtBirth: "M"` salvo via modal → GET retorna `sexAtBirth: "M"` (nao nulo)
- [ ] `raceColor: "BRANCA"` no payload → GET retorna `racaCor: "BRANCA"` (alias ativo)
- [ ] Abrir modal de edicao de paciente existente com `sexAtBirth` preenchido → campo exibe valor correto (nao vazio)
- [ ] PATCH com `address: "Rua X"` → GET retorna `addressLegacy: "Rua X"` (alias ativo)

### Criterio de Aprovacao

Todos os 6 smoke items PASS, exit 0, Failed: 0. Deploy em staging PASS antes de producao.

### Criterio de Rollback

Reverter commits F1-01 a F1-08 em `schemas.js` e `usePatientModal.js`; rebuild e redeploy. Campos persistidos continuam no JSONB mas sao ignorados pelo schema revertido. Dados anteriores ao Deploy 1 nao sao afetados. Verificar que `.strict()` ainda retorna 400 para `unitId` apos reverter.

> **AVISO — Janela de risco R-11:** O campo `domesticViolence` entra como string livre neste deploy (F1-01). O mascaramento por role so sera implementado no Deploy 6 (F7-03). Entre Deploy 1 e Deploy 6, o campo ficara persistido sem controle de acesso por role. Este risco e documentado e aceito intencionalmente como parte da sequencia de fases. Registrar em evidencias que a equipe esta ciente desta janela.

---

## Deploy 2 — Campos e-SUS Patient

### Pre-condicoes

- [ ] Smoke Deploy 1: exit 0, 6/6 PASS (NG-06)
- [ ] Query de levantamento `sexAtBirth` executada em staging — valores distintos documentados (evidencia registrada)
- [ ] Query de levantamento `maritalStatus` executada em staging — valores distintos documentados
- [ ] Query de levantamento `genderIdentity` executada em staging — valores distintos documentados
- [ ] Query de levantamento `racaCor` executada em staging — nenhum valor `nao_informado` sem mapeamento; nenhum valor em minuscula sem normalizacao
- [ ] **ANTES DE QUALQUER NORMALIZACAO:** Script de re-normalizacao reversa (enum → string livre para maritalStatus, racaCor, sexAtBirth, genderIdentity) escrito, testado com dados sinteticos representativos em staging e disponivel — verificar existencia em staging antes de executar scripts de normalizacao direta (C-01)
- [ ] Script de normalizacao `maritalStatus` escrito e testado com dados sinteticos representativos (BLOQUEADOR QA-1)
- [ ] Script de normalizacao `genderIdentity` escrito e testado
- [ ] Script de normalizacao `racaCor` escrito, inclui `UPDATE app_patients SET race_color = payload->>'racaCor'`, testado
- [ ] Script de normalizacao `sexAtBirth` escrito e testado
- [ ] **Script de re-normalizacao reversa** (enum → string livre) escrito, testado e disponivel antes de executar normalizacoes em producao (C-01)
- [ ] Scripts de normalizacao executados em staging com resultado registrado (COUNT pre = pos)
> **SEQUENCIA OBRIGATORIA:** Scripts de normalizacao devem ser validados em staging E ter resultado documentado ANTES de executar em producao. Nunca executar em producao sem staging validado.
- [ ] Scripts de normalizacao executados em producao com resultado registrado (COUNT pre = pos) — apenas apos staging validado
- [ ] D-PRE-07 concluida: enums validados com equipe clinica UBS-001
- [ ] `cnsResponsavel` com AES-256-GCM + HMAC implementado e testado com banco real — valor armazenado nao e plaintext (NG-02)

### Implementacao

- [ ] F2-01: `racaCor` → `z.enum([...RacaCor])` com valores UPPER_SNAKE_CASE
- [ ] F2-02: `sexAtBirth` → `z.enum(['M','F','I'])`
- [ ] F2-03: `maritalStatus` → `z.enum([...EstadoCivil])`
- [ ] F2-04: `genderIdentity` → `z.enum([...IdentidadeGenero])` — SPECIAL_CATEGORY
- [ ] F2-05: `cnsResponsavel` com AES-256-GCM + HMAC no handler de persistencia — **BLOQUEADOR LGPD** (NG-02: nao pode ser deployado sem criptografia implementada)
- [ ] F2-06: Campos de endereco estruturado canonico com regex para `cep: /^\d{8}$/`
- [ ] F2-07: `cnsCpf` marcado como `@deprecated` no schema
- [ ] F2-08: `anonymizePatientBundle` cobre `racaCor`, `etnia`, `genderIdentity` como `[REDACTED-SPECIAL-CATEGORY]` e `rendaFamiliar` como nulo

### Smoke

- [ ] `racaCor: "INDIGENA"` + `etnia: "Guarani"` → ambos persistidos no GET
- [ ] `racaCor: "BRANCA"` + `etnia: "Guarani"` → `etnia` ignorada (condicional com INDIGENA)
- [ ] PATCH com `sexAtBirth: "X"` → 400; `sexAtBirth: "I"` → 200
- [ ] PATCH com `maritalStatus` valor legado (string livre, ex: "solteiro") → 400 (enum estrito ativo apos normalizacao)
- [ ] `anonymizePatientBundle` com `racaCor: "PARDA"` → retorna `[REDACTED-SPECIAL-CATEGORY]`
- [ ] `cnsResponsavel` salvo criptografado — SELECT no banco nao retorna valor em claro; audit log nao expoe valor em claro
- [ ] COUNT(*) app_patients pos-normalizacao = COUNT(*) pre-normalizacao
- [ ] **Smoke L2 dupla persistencia:** `SELECT payload->>'racaCor' FROM app_patients WHERE id = ':id'` e `SELECT race_color FROM app_patients WHERE id = ':id'` retornam o mesmo valor apos PATCH com `raceColor`
- [ ] `SELECT COUNT(*) FROM app_patients WHERE payload->>'racaCor' IS NOT NULL AND race_color IS NULL` → 0 (script de normalizacao atualizou shadow column)
- [ ] GET /patients/:id com role ACS → `cnsResponsavel` ausente da resposta (SENSITIVE — apenas roles clinicos tem acesso)
- [ ] GET /patients/:id com role gestor → `cnsResponsavel` ausente da resposta
- [ ] GET /patients/:id com role enfermeiro → `cnsResponsavel` presente (role clinico)

### Criterio de Aprovacao

Todos os smoke items PASS. Smoke L2 PASS (valores identicos nos dois destinos). COUNT pre = pos. cnsResponsavel criptografado confirmado.

### Criterio de Rollback

**CRITICO — ler antes de executar:**

1. Executar **script de re-normalizacao reversa** (enum → string livre) em producao ANTES de reverter o PR
2. Verificar que todos os valores foram reconvertidos corretamente (COUNT pre = pos)
3. Reverter commits F2-01 a F2-08 em `schemas.js` e `patients.js`
4. Rebuild e redeploy

**AVISO:** Reverter o PR sem executar o script reverso primeiro deixa dados normalizados (ex: `SOLTEIRO`) incompativeis com o schema revertido (que aceita string livre). Sem snapshot RDS, rollback completo e impossivel para dados inseridos entre Deploy 2 e o rollback.

---

## Deploy 3 — Migrations + Professional/Team/Unit

### Pre-condicoes

**JANELA DE MANUTENCAO OBRIGATORIA — agendar com 48h de antecedencia**

- [ ] Smoke Deploy 1 PASS (NG-06)
- [ ] Query CNES duplicados: `SELECT cnes, COUNT(*) FROM app_units WHERE cnes IS NOT NULL AND cnes != '' GROUP BY cnes HAVING COUNT(*) > 1` → 0 linhas
- [ ] Query CNS duplicados: `SELECT cns, COUNT(*) FROM app_users WHERE cns IS NOT NULL AND cns != '' GROUP BY cns HAVING COUNT(*) > 1` → 0 linhas
- [ ] COUNT baseline registrado: `SELECT COUNT(*) FROM app_patients; SELECT COUNT(*) FROM app_units; SELECT COUNT(*) FROM app_users`
- [ ] D-PRE-06 respondida — decisao AES para `cnsProfissional` documentada em `docs/lgpd/`
- [ ] D-PRE-01 concluida (CNES UBS-001 disponivel)
- [ ] D-PRE-02 concluida (INE equipe ESF disponivel)
- [ ] Migrations 013 e 014 testadas em staging — idempotencia confirmada (executar 2x sem erro)
- [ ] Verificar numeracao das migrations: 012, 013, 014 nao conflitam com migrations ja aplicadas (M-05)
- [ ] **Snapshot RDS de producao confirmado** antes de iniciar janela de manutencao — ID do snapshot registrado
- [ ] Janela de manutencao agendada e comunicada

### Implementacao

> **ORDEM OBRIGATORIA:** Executar migrations na sequencia 013 → 014 → 012. A migration 012 e opcional nesta janela mas deve ser executada antes do Deploy 2 se nao foi aplicada aqui.

- [ ] F3-01: `backend/src/migrations/013_app_units_add_cnes.js` (Migration 013) — `ADD COLUMN IF NOT EXISTS cnes VARCHAR(7)` + indice unico parcial
- [ ] F3-02: `backend/src/migrations/014_app_users_add_cns.js` (Migration 014) — `ADD COLUMN IF NOT EXISTS cns VARCHAR(20)` + indice unico parcial + criptografia se D-PRE-06 exigir AES
- [ ] F3-03: `backend/src/migrations/012_app_patients_esus_fields.js` (Migration 012 — opcional, pode ser na mesma janela) — `ADD COLUMN IF NOT EXISTS race_color VARCHAR(20)` (APENAS este campo — nao adicionar `situation_de_rua`)
- [ ] F4-01: `cnsProfissional` em `RegisterSchema` e `MePatchSchema` com regex `/^\d{15}$/`
- [ ] F4-02: `cboCodigo` e `cboDescricao` em `RegisterSchema` e `MePatchSchema`
- [ ] F4-03: `buildUserAuditSnapshot` com `cnsProfissional` como hash SHA-256 (nunca em claro)
- [ ] F4-04: `cnes` e `tipoUnidade` em schema de units
- [ ] F4-05: `ine` (regex `/^\d{10}$/`) e `tipoEquipe` em schema de teams
- [ ] F4-06: Seed CNES real da UBS-001 (valor obtido em D-PRE-01)

### Smoke

- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name='app_units' AND column_name='cnes'` → 1 linha
- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name='app_users' AND column_name='cns'` → 1 linha
- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name='app_patients' AND column_name='race_color'` → 1 linha (se migration 012 aplicada)
- [ ] COUNT(*) app_patients, app_units, app_users pos-migration = baseline pre-migration
- [ ] PATCH /me com `cnsProfissional: "700000000000001"` → 200; GET /me retorna `cnsProfissional`
- [ ] PATCH /me com `cnsProfissional: "12345"` (invalido) → 400
- [ ] PATCH /units/:id com `cnes: "1234567"` → 200; GET retorna `cnes`
- [ ] PATCH /teams/:id com `ine: "0123456789"` → 200; GET retorna `ine`
- [ ] PATCH /teams/:id com `ine: "123456789"` (9 digitos) → 400

### Criterio de Aprovacao

Todas as colunas presentes via information_schema. Todas as verificacoes funcionais PASS. COUNT pre = pos.

### Criterio de Rollback

```sql
ALTER TABLE app_patients DROP COLUMN IF EXISTS race_color;
ALTER TABLE app_users DROP COLUMN IF EXISTS cns;
DROP INDEX IF EXISTS idx_app_users_cns;
ALTER TABLE app_units DROP COLUMN IF EXISTS cnes;
DROP INDEX IF EXISTS idx_app_units_cnes;
```

Reverter commits F3/F4; rebuild e redeploy. Colunas novas sao nullable e sem dados criticos existentes — rollback seguro. **Apenas com snapshot RDS previo confirmado em producao.**

---

## Deploy 4 — Household

### Pre-condicoes

- [ ] Smoke Deploy 3 PASS (NG-06)
- [ ] Handler PATCH /patients/:id com **transacao DB atomica** para Patient + Household implementada (NG-05)
- [ ] **Teste de falha injetada (R-L4) executado antes do deploy:** forcar constraint violation no INSERT de app_households → PATCH retorna HTTP 5xx, Patient NAO alterado, app_households vazio (distingue de NG-05)
- [ ] Migration 015 testada em staging — idempotencia confirmada
- [ ] `teamId` no handler derivado do paciente, NAO do payload da requisicao
- [ ] Snapshot RDS de staging antes da migration 015; snapshot RDS de producao antes de aplicar

### Implementacao

- [ ] F5-01: `backend/src/migrations/015_create_app_households.js` — `CREATE TABLE IF NOT EXISTS app_households (...)` com `patientId`, `teamId`, todos os campos de domicilio
- [ ] F5-02: `HouseholdSchema` em `backend/src/schemas.js` com `tipoImovel` como obrigatorio; decidir comportamento quando `housingType` ausente no payload
- [ ] F5-03: Extracao interna no handler PATCH /patients/:id — remover campos Household do payload antes de persistir Patient; criar registro em app_households na mesma transacao DB
- [ ] F5-04: Evento de auditoria `household.created` e `household.updated` emitidos apos operacoes de Household
- [ ] F5-05: Role gestor nao recebe `materialPredominanteParedes` e campos SENSITIVE do Household no GET /patients/:id

### Smoke

- [ ] PATCH /patients/:id com `housingType: "DOMICILIO"` → `SELECT * FROM app_households WHERE patient_id = ':id'` retorna 1 registro
- [ ] GET /patients/:id NAO retorna campos Household (`tipoImovel`, `esgotamento`, `housingType` etc.) no objeto Patient
- [ ] `SELECT * FROM app_audit_logs WHERE entity_type = 'household' ORDER BY created_at DESC LIMIT 1` retorna evento apos PATCH
- [ ] COUNT(*) app_patients pos-migration = pre-migration
- [ ] **Teste R-L4 pos-deploy:** forcar falha no INSERT de Household → HTTP 5xx retornado, Patient nao alterado
- [ ] Role gestor: GET /patients/:id nao expoe `materialPredominanteParedes` em claro
- [ ] Segundo PATCH /patients/:id no mesmo paciente com campos Household → atualiza registro existente em app_households (nao cria duplicata); `SELECT COUNT(*) FROM app_households WHERE patient_id = ':id'` → 1 (nao 2)
- [ ] Multi-tenant: `SELECT team_id FROM app_households WHERE patient_id = ':id'` = teamId do paciente (nao valor vindo do payload); Household nao visivel para usuario de team_id diferente

### Criterio de Aprovacao

Todos os smoke items PASS. Teste R-L4 PASS (falha retorna 5xx, nao 200). Household criado com teamId correto (isolamento tenant). Audit log emitido.

### Criterio de Rollback

```sql
DROP TABLE IF EXISTS app_households;
```

Reverter commits F5-01 a F5-05; rebuild e redeploy. **ATENCAO:** Dados de Household gravados em producao sao perdidos no rollback da migration. Executar rollback apenas se nenhum dado real foi gravado na tabela.

---

## Deploy 5 — RBAC ACS

### Pre-condicoes

**JANELA DE MANUTENCAO OBRIGATORIA — agendar com 48h de antecedencia; fora do horario de atendimento**

- [ ] Todos os smokes 1–4 PASS em staging E producao (NG-06)
- [ ] D-PRE-03 executada **em producao** (nao apenas staging) imediatamente antes de agendar janela — resultado `sem_acs = 0` documentado (NG-03)
- [ ] D-PRE-04 concluida — documento escrito com assinatura do gestor UBS-001 arquivado em `docs/rollout/ubs-001/`
- [ ] Query ACS sem paciente designado → 0 linhas em producao
- [ ] Query referencias quebradas a assignedAcsId → 0 linhas em producao
- [ ] CRC-02 aprovado em staging: ACS acessa apenas seus pacientes; roles enfermeiro/medico/gestor nao afetados
- [ ] CRC-05 aprovado em staging: tasks.write ACS nao contorna restricao assignedAcsId
- [ ] F6-01 e F6-02 no **mesmo PR** — nunca deployados separadamente (C-05, R-05)
- [ ] Janela de manutencao agendada e comunicada aos gestores clinicos (48h de antecedencia)

### Implementacao

- [ ] F6-01: `getAllowedPatients` em `backend/src/utils/patients.js` (~linha 309) — filtro por `assignedAcsId` para role ACS
- [ ] F6-02: `canAccessPatient` em `backend/src/utils/patients.js` (~linha 278) — verificacao assignedAcsId em write mode para ACS
- [ ] F6-03: `tasks.write` adicionado as capabilities do role ACS em `backend/src/utils/helpers.js` (~linha 111)
- [ ] F6-04: Evento de auditoria `patient.acs_access_denied` ou `patient.read_blocked` emitido quando ACS tenta acessar paciente nao designado
- [ ] F6-05: Evento de auditoria `task.created` emitido quando ACS cria task

### Smoke

- [ ] GET /patients com role ACS → lista contem **apenas** pacientes com `assignedAcsId = acs.id`
- [ ] PATCH /patients/:id de paciente nao designado ao ACS → 403
- [ ] `SELECT * FROM app_audit_logs WHERE action LIKE '%acs_access_denied%' ORDER BY created_at DESC LIMIT 1` retorna evento apos tentativa de acesso negado
- [ ] ACS POST /tasks → 200
- [ ] Enfermeiro GET /patients → lista completa da equipe (nao afetado)
- [ ] Gestor GET /patients → lista completa da unidade (nao afetado)
- [ ] **Smoke L1 (mascaramento):** response de PATCH /patients/:id por ACS NAO contem `socialVulnerability`, `substanceDependency`, `materialPredominanteParedes`
- [ ] ACS POST /tasks com patientId de paciente nao designado ao ACS → 403 (CRC-05 validado em producao)

### Criterio de Aprovacao

Todos os smoke items PASS. CRC-02 e CRC-05 documentados com evidencia. Mascaramento L1 PASS.

### Criterio de Rollback

Reverter commits F6-01 a F6-05 em `patients.js`, `helpers.js` e `tasks.js`; rebuild e redeploy. ACS volta a ver todos os pacientes da equipe. Sem impacto em dados. Verificar se atribuicoes de `assignedAcsId` existentes permanecem integras apos rollback.

---

## Deploy 6 — Auditoria + LGPD

### Pre-condicoes

- [ ] Todos os smokes 1–5 PASS em staging E producao (NG-06)
- [ ] `cnsResponsavel` com AES-256-GCM + HMAC confirmado (reconfirmar gate NG-02)
- [ ] CRC-03 aprovado em staging: anonimizacao cobre todos os campos SPECIAL_CATEGORY e SENSITIVE Sprint 5A
- [ ] CRC-04 aprovado em staging: audit log nao expoe CPF/CNS em claro
- [ ] Testes automatizados de `anonymizePatientBundle` cobrindo campos Sprint 5A PASS (BLOQUEADOR QA-2)
- [ ] Testes de conteudo de audit log snapshot PASS (BLOQUEADOR QA-3)
- [ ] Testes LGPD/RBAC Secao 8.5 do implementation plan todos PASS em staging

### Implementacao

- [ ] F7-01: `buildPatientAuditSnapshot` em `backend/src/routes/patients.js` — `cpf` e `cns` como hash SHA-256, `phone` mascarado, `genderIdentity` como `[REDACTED-SPECIAL-CATEGORY]`
- [ ] F7-02: Middleware de auditoria — `racaCor`, `etnia`, `genderIdentity` como `[REDACTED-SPECIAL-CATEGORY]` em `snapshot_before` e `snapshot_after`
- [ ] F7-03: Mascaramento em GET /patients para role gestor — `racaCor`, `etnia`, `genderIdentity` ausentes ou null
- [ ] F7-04: `buildUserAuditSnapshot` em `backend/src/routes/users.js` — `cnsProfissional` como hash SHA-256
- [ ] F7-05: `anonymizePatientBundle` — cobertura completa de campos SENSITIVE e SPECIAL_CATEGORY adicionados em Sprint 5A (`racaCor`, `etnia`, `genderIdentity`, `rendaFamiliar`, `cnsResponsavel`, `socialVulnerability`, `substanceDependency`)

### Smoke

- [ ] PATCH /patients/:id com `racaCor: "PARDA"` → `app_audit_logs.snapshot_after.racaCor` = `[REDACTED-SPECIAL-CATEGORY]`
- [ ] PATCH com `cpf` → audit log: `cpf` como hash SHA-256, nao valor em claro
- [ ] GET /patients com role gestor → `racaCor`, `etnia`, `genderIdentity` ausentes ou null
- [ ] GET /patients com role enfermeiro → `racaCor` presente (roles clinicos nao afetados)
- [ ] `anonymizePatientBundle` cobre: `racaCor`, `etnia`, `genderIdentity`, `rendaFamiliar`, `cnsResponsavel`, `socialVulnerability`, `substanceDependency`
- [ ] GET /patients/:id com role ACS → `domesticViolence` ausente da resposta (SENSITIVE, acesso restrito a roles clinicos)
- [ ] GET /patients/:id com role medico → `domesticViolence` presente
- [ ] Hash chain de auditoria intacta apos operacoes Sprint 5A: `SELECT COUNT(*) FROM app_audit_logs WHERE hash_version = 'v2' AND hash IS NOT NULL` → resultado consistente com baseline pre-sprint; nenhum novo registro com `classification = 'legacy_incompatible'` alem dos pre-existentes documentados (regressao AUD-01)

### Criterio de Aprovacao

Todos os smoke items PASS. CRC-03 e CRC-04 documentados com evidencia. BLOQUEADORES QA-2 e QA-3 satisfeitos.

**Gate de Merge Final para Producao (alem dos smoke items):**
- [ ] RIPD assinado bilateralmente Vitras + Prefeitura/SMS (NG-04)
- [ ] KI-02 resolvido com decisao formal documentada em `docs/lgpd/`
- [ ] Todos os CRC-01 a CRC-05 PASS com evidencia registrada
- [ ] PR aprovado por revisor com foco em seguranca de dados e multi-tenant
- [ ] COUNT(*) app_patients, app_units, app_users pre = pos em todas as tabelas

### Criterio de Rollback

Reverter commits F7-01 a F7-05 em `patients.js` e `users.js`; rebuild e redeploy. Audit logs ja gravados com `[REDACTED-SPECIAL-CATEGORY]` permanecem — sem impacto nos dados de pacientes. Rollback nao restaura exposicao anterior (mascaramento nos logs e permanente).

---

## Gates Juridicos

### KI-02

- [ ] E-mail formal de escalada enviado ao DPO no Dia 1 (F8-01) — evidencia: e-mail arquivado em `docs/lgpd/ki-02-escalate.md`
- [ ] Prazo formal de resposta: 2026-06-30
- [ ] Enquanto pendente: `POST /privacy-requests type: "deletion"` retorna 503 com mensagem informativa (F8-03)
- [ ] Decisao formal documentada assinada pelo DPO e arquivada em `docs/lgpd/ki-02-decision.md`
- [ ] **Gate de merge final para producao:** KI-02 resolvido (NG-04 parcial)

### RIPD

- [ ] RIPD atualizado para cobrir: `racaCor` (Art. 11 II f LGPD), `genderIdentity` (CFM 2.265/2019), `cnsResponsavel` com AES, Household como conjunto SENSITIVE, exclusao de `situacaoRua` do escopo
- [ ] RIPD assinado bilateralmente: Vitras + Prefeitura/SMS
- [ ] Documento fisico arquivado em `docs/lgpd/ripd-sprint-5a.md` (ou equivalente)
- [ ] **Gate de merge final para producao:** RIPD assinado (NG-04)

### AES cnsResponsavel

- [ ] Implementado com AES-256-GCM + HMAC antes de qualquer deploy do campo (NG-02 — gate de Fase 2 e merge para producao)
- [ ] Testado com banco real: valor armazenado nao e o plaintext do CNS do responsavel
- [ ] Audit log nao expoe valor em claro
- [ ] GET /patients/:id retorna valor decriptado apenas para roles clinicos (enfermeiro, medico, tecnico_enfermagem)
- [ ] ACS NAO recebe `cnsResponsavel` no response (role sem acesso a SENSITIVE)

### AES cnsProfissional

- [ ] D-PRE-06 respondida com decisao documentada em `docs/lgpd/d-pre-06-decision.md`
- [ ] Se AES obrigatorio: implementar antes do merge da migration 014 (Deploy 3)
- [ ] Se AES recomendado: `cnsProfissional` em claro no JSONB; hash SHA-256 no audit log obrigatorio de qualquer forma (F4-03, F7-04)
- [ ] `buildUserAuditSnapshot` usa hash SHA-256 para `cnsProfissional` independentemente da decisao sobre armazenamento

---

## Evidencias Obrigatorias

Registrar todas as evidencias abaixo em `docs/rollout/ubs-001/sprint-5a-evidence.md` ou equivalente.

**D-PRE-01 a D-PRE-09 (pre-sprint):**
- [ ] D-PRE-09: output de `git log --oneline -1` confirmando d20add9
- [ ] D-PRE-01: CNES oficial da UBS-001 (7 digitos) — fonte e data de obtencao
- [ ] D-PRE-02: INE equipe ESF (10 digitos) — fonte e data
- [ ] D-PRE-03: resultado das 3 queries de assignedAcsId (data + resultado)
- [ ] D-PRE-04: documento escrito de alinhamento com gestor UBS-001 (data + assinatura)
- [ ] D-PRE-05: e-mail de escalada KI-02 enviado (data + destinatario)
- [ ] D-PRE-06: decisao sobre AES cnsProfissional (data + responsavel + decisao)
- [ ] D-PRE-07: enums validados com equipe clinica (data + responsavel clinico + lista de valores confirmados)
- [ ] D-PRE-08: RIPD assinado bilateralmente (data + assinaturas)

**Por deploy:**

| Deploy | Evidencias Obrigatorias |
|---|---|
| Deploy 1 | Output do smoke (6/6 PASS); output do teste `.strict()` com `unitId`; confirmacao de `sexAtBirth` salvo corretamente |
| Deploy 2 | Output das 4 queries de levantamento com resultado documentado; output de execucao dos scripts de normalizacao (COUNT pre = pos); confirmacao de `cnsResponsavel` criptografado (SELECT mostrando valor nao plaintext); output do smoke L2 (duas queries SQL com valores identicos) |
| Deploy 3 | ID e timestamp do snapshot RDS de producao tirado antes da janela; output dos scripts de migration (exit 0); output das queries de verificacao de colunas via information_schema; COUNT pre = pos |
| Deploy 4 | Output do teste de falha injetada R-L4 (HTTP 5xx, Patient nao alterado, Household vazio); output do smoke Household criado; output do audit log `household.created` |
| Deploy 5 | D-PRE-04 assinado arquivado; D-PRE-03 executado em producao com resultado `sem_acs = 0`; CRC-02 aprovado (print ou log); CRC-05 aprovado; output do smoke L1 (mascaramento ACS) |
| Deploy 6 | CRC-03 aprovado (evidencia de anonimizacao); CRC-04 aprovado (audit log sem CPF em claro); BLOQUEADORES QA-2 e QA-3 satisfeitos (output dos testes automatizados); Resultado da query de hash chain AUD-01 — COUNT de legacy_incompatible deve ser igual ao baseline pre-sprint |
| Merge Final | RIPD assinado (arquivo); KI-02 decision documentada; todos os CRC-01 a CRC-05 com evidencia |
