# Sprint 5A Implementation Plan — VITRAS

| Campo | Valor |
|---|---|
| Versão | 1.1 |
| Data | 2026-06-10 |
| Status | APROVADO — GO (QA GO CONDICIONADO resolvido — 7 correções aplicadas) |
| Baseline | v1.0-pilot-governed (commit d20add9) |
| Branch alvo | feat/sprint-5a-esus-fields (a partir de main) |
| Dependências | esus-data-model-v1.md, sprint-5a-foundation-plan.md, esus-conformity-gap-analysis.md |

---

## 1. Objetivo

Implementar a conformidade mínima e-SUS APS no VITRAS para o piloto UBS-001 (Ribeirão Preto-SP), resolvendo:

1. **Silent data loss crítico ativo** — 26 campos enviados pelo frontend descartados silenciosamente pelo `.strict()` do schema desde antes do go-live.
2. **Bugs de alias** — campos enviados com nome errado (`sex`, `raceColor`, `educationLevel`, `address`, `zipCode`, `number` etc.) nunca persistidos.
3. **Campos e-SUS obrigatórios ausentes** no Patient, Professional, Team e Unit para conformidade com Ficha de Cadastro Individual CDS v3.2.
4. **Entidade Household** — nova tabela para Cadastro Domiciliar e Territorial CDS.
5. **RBAC ACS** — restrição de acesso por `assignedAcsId` (breaking change, executar por último).
6. **Auditoria e mascaramento LGPD** — campos SPECIAL_CATEGORY (`racaCor`, `etnia`, `genderIdentity`) com `[REDACTED-SPECIAL-CATEGORY]` em audit logs; `cnsResponsavel` com AES-256-GCM + HMAC.
7. **KI-02 Jurídico** — parecer DPO sobre retenção e anonimização como gate de NO-GO para merge em produção.

Escopo geográfico do piloto: município IBGE `3534401` (Ribeirão Preto-SP). Multi-município é Sprint 5B.

---

## 2. Escopo

### 2.1 Itens Incluídos (por fase)

**Fase 1 — Silent Data Loss + Bugs de Alias**
- Expansão de `PatientBaseShape` e `PatientUpdateSchema` com 26 campos ausentes
- Fix `sex` → `sexAtBirth` no frontend (`usePatientModal.js:132`)
- Alias `.transform()` para `raceColor` → `racaCor`, `educationLevel` → `escolaridade`, `address` → `addressLegacy`, campos de endereço (`zipCode` → `cep`, `number` → `numero`, etc.)
- Fix leitura em `buildPatientFormState` (carregamento do paciente para edição)
- Manutenção do `.strict()` — nenhum campo interno exposto

**Fase 2 — Campos e-SUS Patient**
- Novos campos JSONB no Patient: `racaCor` (+ shadow column `race_color`), `etnia`, `nacionalidade`, `municipioNascimentoIbge`, `paisNascimentoCnes`, `escolaridade` (enum), `situacaoMercadoTrabalho`, `rendaFamiliar`, `responsavelFamiliar`, `cnsResponsavel` (AES-256-GCM + HMAC)
- Endereço estruturado: `logradouro`, `numero`, `complemento`, `bairro`, `cep`, `municipioIbge`, `uf`, `tipoLogradouroCnes`
- Enums estritos: `sexAtBirth` → `z.enum(['M','F','I'])`, `maritalStatus` → enum `EstadoCivil`, `genderIdentity` → enum `IdentidadeGenero` (reclassificar SPECIAL_CATEGORY)
- Script de normalização de dados legados de `maritalStatus` (string livre → enum)
- Deprecação inline de `cnsCpf` com comentário `@deprecated`
- `anonymizePatientBundle` atualizado para incluir campos novos SPECIAL_CATEGORY

**Fase 3 — Migrations DDL (Janela de Manutenção)**
- Migration 013: `app_units` — `ADD COLUMN cnes VARCHAR(7)` + unique partial index
- Migration 014: `app_users` — `ADD COLUMN cns VARCHAR(20)` + unique partial index
- Migration 012 (opcional): `app_patients` — `ADD COLUMN race_color VARCHAR(20)` (shadow column)

**Fase 4 — Professional + Team + Unit**
- Schema `app_users`: campos `cnsProfissional`, `cboCodigo`, `cboDescricao`; handler `PATCH /me` e `POST /users`
- Schema `app_units`: campo `cnes` (após migration 013), `tipoUnidade` (enum)
- Schema Team: campos `ine` (10 dígitos), `tipoEquipe` (enum)
- `buildUserAuditSnapshot` atualizado com `cns`/`cnsProfissional`

**Fase 5 — Entidade Household**
- Nova tabela `app_households` via migration
- Schema Zod `HouseholdSchema` com todos os campos da Seção 5 do `esus-data-model-v1.md`
- Extração interna no `PATCH /patients/:id`: backend extrai campos Household do payload, cria/atualiza registro Household vinculado, remove do objeto Patient antes da persistência
- Mapeamento de alias frontend → canônico: `housingType` → `tipoImovel`, `waterSupply` → `abastecimentoAgua`, `sewage` → `esgotamento`, `garbage` → `coletaLixo`/`destinacaoLixo`, `electricity` → `energiaEletrica`

**Fase 6 — RBAC ACS (Breaking Change — Janela de Manutenção)**
- `getAllowedPatients`: branch dedicado para ACS filtrando por `assignedAcsId === user.id` (além de `teamId`)
- `canAccessPatient` modo `write`: verificar `assignedAcsId === user.id` para role `acs`
- Capability `tasks.write` adicionada ao array do role `acs` em `helpers.js`
- Novos eventos de auditoria: `patient.acs_access_denied`, `task.created` para ACS

**Fase 7 — Auditoria + Mascaramento LGPD**
- `buildPatientAuditSnapshot`: adicionar `cpf` (hash SHA-256), `cns` (hash SHA-256), `phone` (mascarado), `sexAtBirth`, `genderIdentity` como `[REDACTED-SPECIAL-CATEGORY]`
- Middleware de auditoria: campos `racaCor`, `etnia`, `genderIdentity` aparecem como `[REDACTED-SPECIAL-CATEGORY]` em `snapshot_before` e `snapshot_after`
- `cnsResponsavel` com AES-256-GCM + HMAC antes do merge (BLOQUEADOR LGPD)

**Fase 8 — KI-02 Jurídico (Paralelo)**
- Escalate ao DPO — dia 1 da sprint
- Decisão formal sobre retenção, anonimização e distinção prontuário clínico vs. dados cadastrais
- RIPD assinado bilateralmente antes do merge para produção

### 2.2 Itens Explicitamente Excluídos

| Item | Motivo | Sprint Alvo |
|---|---|---|
| CID-10 como campo de paciente (tabela de referência) | Sem tabela de referência = dado inválido no SISAB; requer carga de ~15.000 registros | Sprint 5B |
| Filtros server-side em `GET /patients` | Fora de fronteira — requer paginação para ser seguro | Sprint 5B |
| Paginação em `GET /patients` | Fora de fronteira definida pelo Governor | Sprint 5B |
| Componentes DS Accordion/RadioGroup | Não priorizados para piloto | Sprint 5B |
| `situacaoRua` | SPECIAL_CATEGORY; RIPD não atualizado para este campo. **Nota (sobrescreve foundation plan):** `sprint-5a-foundation-plan.md` Seção 2.3 e Critério de Done listavam `situacaoDeRua` como obrigatório Sprint 5A. Esta exclusão sobrescreve o foundation plan — o campo foi reclassificado como SPECIAL_CATEGORY após emissão do foundation plan, conforme `esus-data-model-v1.md` Seção 16. Não implementar em Sprint 5A sem confirmação formal do Tech Lead e atualização do RIPD. | Sprint 5B |
| `deficiencia` (array enum) | SPECIAL_CATEGORY; requer decisão de produto e RIPD | Sprint 5B |
| `orientacaoSexual` | SPECIAL_CATEGORY; aguarda decisão formal jurídico/DPO | Sprint 5B+ |
| `nis` | Requer decisão jurídica sobre armazenamento e formato | Sprint 5B |
| `insegurancaAlimentar` | Requer decisão de produto sobre fluxo de coleta | Sprint 5B |
| `beneficiosSociais` (enum fechado) | Requer tabela de referência; entra em 5A como string livre | Sprint 5B |
| Entidade `Family` separada | Requer definição de produto sobre relacionamento N:N | Sprint 5B |
| Tabela municípios IBGE (~5.570 registros) | Volume; piloto é single-municipality | Sprint 5B |
| Validação dígito verificador CNS | Aceitável em 5A aceitar 15 dígitos sem verificação | Sprint 5B |
| CIAP-2 | Sem tabela de referência local | Sprint 5B+ |
| SIGTAP (procedimentos) | Integração com tabela nacional de procedimentos | Sprint 6+ |
| FK DDL | Decisão arquitetural vigente — soft references | Não planejado |
| `nomeSocial` | Campo distinto de `genderIdentity`; sem decisão de produto | Sprint 5B+ |
| `cid10` em `AppointmentCreateSchema` e `RecordCreateSchema` | **Nota (sobrescreve foundation plan):** `sprint-5a-foundation-plan.md` Seção 7 e Critério de Done exigiam `cid10` em schemas de atendimento. Esta exclusão segue `esus-data-model-v1.md` Seção 18 (Decisão 3) — sem tabela CID-10 local (~15.000 registros), o campo seria aceito pelo schema mas semanticamente inválido no SISAB. A demanda do foundation plan foi revisada. | Sprint 5B |
| Endpoint dedicado `POST /households` | Extração interna em 5A; endpoint dedicado em 5B | Sprint 5B |
| Endpoint dedicado `PATCH /households/:id` | Idem | Sprint 5B |

---

## 3. Ordem de Implementação

### Fase 0 — Pré-código (Dia 1, paralelo ao desenvolvimento)

| ID | Ação | Quem | Bloqueia | Prazo |
|---|---|---|---|---|
| D-PRE-09 | Criar branch `feat/sprint-5a-esus-fields` a partir de `main` (commit d20add9) — **não** a partir de `chore/rotate-data-encryption-key` | Tech Lead | Todos os PRs | Dia 1, antes do primeiro commit |
| D-PRE-01 | Obter CNES oficial da UBS-001 (7 dígitos) em `cnes.datasus.gov.br` | Equipe de implantação | Fase 4 (unit.cnes) | Dia 1 |
| D-PRE-02 | Obter INE da equipe ESF (10 dígitos) | Equipe de implantação | Fase 4 (team.ine) | Dia 1 |
| D-PRE-03 | Executar query de auditoria `assignedAcsId` em staging (ver Seção 8.1) | Tech Lead | Fase 6 (RBAC ACS) | Dia 1 |
| D-PRE-04 | Reunião com gestores UBS-001 sobre restrição ACS — comunicar que ACS passará a ver apenas pacientes atribuídos a ele | Tech Lead + Gestor | Fase 6 | D+1 a D+3 |
| D-PRE-05 | Escalar KI-02 ao DPO — iniciar processo formal de decisão sobre retenção e anonimização | Tech Lead | Fase 8 / merge produção | Dia 1 |
| D-PRE-06 | Decisão sobre AES-256-GCM para `cnsProfissional` — validar com jurídico se criptografia é obrigatória ou recomendada | Tech Lead + Jurídico | Migration 014 / Fase 3 | D+1 a D+5 |
| D-PRE-07 | Validação de enums com equipe clínica UBS-001 — confirmar valores de `racaCor`, `escolaridade`, `situacaoMercadoTrabalho`, `tipoEquipe`, `tipoImovel` | Tech Lead + Clínico | Fase 2 (enum estrito) | D+3 a D+5 |
| D-PRE-08 | RIPD assinado bilateralmente (Vitras + Prefeitura/SMS) | DPO | Merge para produção | Antes do deploy final |

---

### Fase 1 — Silent Data Loss + Aliases (Deploy 1 — isolado, crítico ativo)

**Prioridade CRÍTICA — este é o primeiro PR. Deploy isolado assim que os itens F1-01 a F1-04 estiverem prontos. Não aguardar as fases seguintes.**

| ID | Mudança | Arquivo | Linha (aprox.) | Risco | Teste de Validação |
|---|---|---|---|---|---|
| F1-01 | Adicionar 26 campos ausentes ao `PatientBaseShape` — `motherUnknown`, `birthCity`, `birthState`, `zipCode`, `number`, `complement`, `neighborhood`, `city`, `state`, `familyCode`, `homeVisitFreq`, `housingType`, `waterSupply`, `sewage`, `garbage`, `electricity`, `educationLevel`, `occupation`, `familySituation`, `familySupport`, `socialVulnerability`, `socialBenefit`, `substanceDependency`, `domesticViolence`, mais campos alias de endereço canônico | `backend/src/schemas.js` | 24–62 | M-01: se `.strict()` for removido acidentalmente = mass-assignment de campos internos. Manter `.strict()`. | POST /patients com todos 26 campos; GET /patients/:id retorna todos os campos persistidos |
| F1-02 | Espelhar os 26 campos no `PatientUpdateSchema` — sem adicionar campos internos (`id`, `teamId`, `hash`, `updatedAt`, `createdAt`, `createdBy`, `unitId`, `municipalityId`) | `backend/src/schemas.js` | 66–103 | Mesma severidade de F1-01; revisar diff linha a linha antes do merge | PATCH /patients/:id com campos novos; verificar que campos internos recusam com 400 |
| F1-03 | Corrigir frontend: `usePatientModal.js:132` — substituir `sex: form.sex.trim()` por `sexAtBirth: form.sex.trim()` | `frontend-react/src/hooks/usePatientModal.js` | 132 | M-01: campo `sex` descartado pelo `.strict()`; após fix, `sexAtBirth` será persistido | Criar paciente com sexo no modal; GET retorna `sexAtBirth` preenchido |
| F1-04 | Corrigir leitura em `buildPatientFormState`: ler `p?.sexAtBirth` ao abrir paciente para edição, não `p?.sex` | `frontend-react/src/hooks/usePatientModal.js` | ~30–60 | Regressão na abertura do modal de edição | Abrir modal de paciente existente com `sexAtBirth` preenchido; campo exibe valor correto |
| F1-05 | Adicionar alias `.transform()` para `raceColor` → `racaCor` no `PatientBaseShape` | `backend/src/schemas.js` | ~30–62 | M-01: sem alias, frontend continua enviando `raceColor` e `racaCor` nunca persiste | Enviar `raceColor: "BRANCA"` no payload; GET retorna `racaCor: "BRANCA"` |
| F1-06 | Adicionar alias `.transform()` para `educationLevel` → `escolaridade` no `PatientBaseShape` | `backend/src/schemas.js` | ~30–62 | M-01: mesmo padrão de F1-05 | Enviar `educationLevel: "MEDIO_COMPLETO"`; GET retorna `escolaridade: "MEDIO_COMPLETO"` |
| F1-07 | Adicionar alias `.transform()` para `address` → `addressLegacy` no `PatientBaseShape` (Decisão 1 do esus-data-model-v1.md) | `backend/src/schemas.js` | ~30–62 | M-01: frontend envia `address`; sem alias, `addressLegacy` nunca recebe valor | Enviar `address: "Rua X, 10"` via modal; GET retorna `addressLegacy: "Rua X, 10"` |
| F1-08 | Adicionar aliases de endereço: `zipCode` → `cep`, `number` → `numero`, `complement` → `complemento`, `neighborhood` → `bairro`, `city` → `municipioIbge`, `state` → `uf` | `backend/src/schemas.js` | ~30–62 | M-01: dados de endereço estruturado descartados | Enviar payload com nomes legados; GET retorna campos canônicos preenchidos |

**Smoke test mínimo de Deploy 1:**
- POST /patients com todos os 26 campos → GET retorna todos os campos
- PATCH /patients/:id com campos novos → GET confirma persistência
- Campo interno `unitId` enviado no PATCH body → retorna 400 (`.strict()` ativo)
- `sexAtBirth` salvo corretamente via modal após fix F1-03

---

### Fase 2 — Campos e-SUS Patient (Deploy 2)

**Pré-condição: Smoke de Deploy 1 PASS.**

Antes de F2-02 e F2-03 (enum `sexAtBirth` e `maritalStatus`), executar queries SQL de pré-condição da Seção 8.1.

| ID | Mudança | Arquivo | Linha (aprox.) | Risco | Teste de Validação |
|---|---|---|---|---|---|
| F2-01 | Adicionar campos novos ao `PatientBaseShape`: `racaCor` (enum estrito UPPER_SNAKE_CASE + shadow column), `etnia` (condicional `racaCor=INDIGENA`), `nacionalidade`, `municipioNascimentoIbge`, `paisNascimentoCnes`, `situacaoMercadoTrabalho`, `rendaFamiliar`, `responsavelFamiliar` | `backend/src/schemas.js` | 24–62 | M-03: campos SPECIAL_CATEGORY ausentes de `anonymizePatientBundle` = violação LGPD. **Pré-condição obrigatória:** executar query de levantamento `racaCor` (Seção 8.1) antes de ativar enum estrito — o alias F1-05 pode ter armazenado valores em minúscula entre Deploy 1 e 2. Se houver valores minúsculos, normalizar com UPDATE antes do deploy. `nao_informado` (presente no `sprint-5a-foundation-plan.md` Seção 2.3) não existe no enum canônico (esus-data-model-v1.md Seção 15.1) — mapear para `NULL` no script de normalização. | POST /patients com campos; GET retorna campos; `anonymizePatientBundle` mascara `racaCor` e `etnia` |
| F2-02 | Converter `sexAtBirth` de string livre para `z.enum(['M','F','I'])` no `PatientBaseShape` e `PatientUpdateSchema` | `backend/src/schemas.js` | 45, 86 | M-02 (BLOQUEADOR): dados legados com valor fora do enum falham no PUT — executar query de levantamento antes (Seção 8.1) | PUT /patients/:id com paciente legado com `sexAtBirth` fora do enum → verificar comportamento; script de normalização executado em staging antes |
| F2-03 | Normalizar `maritalStatus` de string livre para enum `EstadoCivil` (`SOLTEIRO`, `CASADO`, `DIVORCIADO`, `VIUVO`, `UNIAO_ESTAVEL`, `SEPARADO`, `NAO_INFORMADO`) | `backend/src/schemas.js` | 39, ~80 | M-12 (CRÍTICO): mesmo padrão de M-02; script de normalização de dados legados obrigatório antes do deploy | Script de normalização rodado em staging; todos os valores legados convertidos; PUT com paciente existente retorna 200 |
| F2-04 | Normalizar `genderIdentity` para enum `IdentidadeGenero` e reclassificar como SPECIAL_CATEGORY | `backend/src/schemas.js` | 46, 87 | Dado existente pode ter valores não mapeados para o enum | Query de levantamento dos valores distintos de `genderIdentity` em staging; verificar conversão |
| F2-05 | Adicionar `cnsResponsavel` ao `PatientBaseShape` com AES-256-GCM + HMAC (BLOQUEADOR LGPD — ver Seção 16 do esus-data-model-v1.md) | `backend/src/schemas.js` + `backend/src/routes/patients.js` | 24–62, ~100–200 | BLOQUEADOR: campo SENSITIVE sem criptografia = violação LGPD | `cnsResponsavel` salvo criptografado; GET retorna valor decriptado apenas para roles autorizados; audit log não expõe valor em claro |
| F2-06 | Adicionar endereço estruturado canônico ao schema: `logradouro`, `numero`, `complemento`, `bairro`, `cep` (regex `/^\d{8}$/`), `municipioIbge`, `uf`, `tipoLogradouroCnes` | `backend/src/schemas.js` | 24–62 | Regressão se regex de `cep` rejeitar formatos com hífen enviados por versões antigas do frontend | Enviar `cep: "14020000"` (sem hífen) → aceito; `cep: "14020-000"` → verificar comportamento e garantir alias se necessário |
| F2-07 | Adicionar comentário `@deprecated` em `cnsCpf` no `PatientBaseShape` e warning em `patients.js` no bloco de derivação de `cnsCpf` | `backend/src/schemas.js` + `backend/src/routes/patients.js` | 32, ~150 | Nenhum — mudança não funcional | Build compila sem erro; warning aparece no log em desenvolvimento |
| F2-08 | Atualizar `anonymizePatientBundle` para incluir campos novos SPECIAL_CATEGORY: `racaCor`, `etnia`, `genderIdentity` | `backend/src/routes/patients.js` (ou módulo de privacidade) | ~34–48 ou módulo privacy | M-03 (CRÍTICO): violação LGPD se campos não incluídos | Chamar endpoint de anonimização; verificar que `racaCor`, `etnia` e `genderIdentity` aparecem como `[REDACTED-SPECIAL-CATEGORY]` na resposta |

**Smoke test mínimo de Deploy 2:**
- POST /patients com `racaCor: "INDIGENA"`, `etnia: "Guarani"` → GET retorna ambos
- POST /patients com `racaCor: "BRANCA"`, `etnia: "Italiano"` → `etnia` ignorada (condicional)
- PATCH /patients/:id com `sexAtBirth: "X"` → 400
- PATCH /patients/:id com `sexAtBirth: "M"` → 200
- `anonymizePatientBundle` mascara `racaCor`, `etnia`, `genderIdentity`
- `cnsResponsavel` salvo criptografado; verificar que valor em claro não aparece no audit log

---

### Fase 3 — Migrations DDL (Janela de Manutenção)

**Executar em staging com validação antes de qualquer execução em produção. Tirar snapshot RDS antes da execução em produção.**

| ID | Arquivo | DDL | Pré-condição | Rollback | Validação |
|---|---|---|---|---|---|
| F3-01 (Mig 013) | `backend/src/migrations/013_app_units_add_cnes.js` | `ALTER TABLE app_units ADD COLUMN IF NOT EXISTS cnes VARCHAR(7); CREATE UNIQUE INDEX IF NOT EXISTS idx_app_units_cnes ON app_units(cnes) WHERE cnes IS NOT NULL AND cnes <> ''` | `SELECT cnes, COUNT(*) FROM app_units GROUP BY cnes HAVING COUNT(*) > 1` → resultado deve ser vazio (sem duplicados); snapshot RDS prévio | `ALTER TABLE app_units DROP COLUMN IF EXISTS cnes; DROP INDEX IF EXISTS idx_app_units_cnes;` | `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='app_units' AND column_name='cnes'`; re-executar migration (idempotente) |
| F3-02 (Mig 014) | `backend/src/migrations/014_app_users_add_cns.js` | `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS cns VARCHAR(20); CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_cns ON app_users(cns) WHERE cns IS NOT NULL AND cns <> ''` | `SELECT cns, COUNT(*) FROM app_users GROUP BY cns HAVING COUNT(*) > 1` → vazio; D-PRE-06 respondida (decisão AES) | `ALTER TABLE app_users DROP COLUMN IF EXISTS cns; DROP INDEX IF EXISTS idx_app_users_cns;` | `SELECT column_name FROM information_schema.columns WHERE table_name='app_users' AND column_name='cns'`; re-executar (idempotente) |
| F3-03 (Mig 012) | `backend/src/migrations/012_app_patients_esus_fields.js` | `ALTER TABLE app_patients ADD COLUMN IF NOT EXISTS race_color VARCHAR(20)` | Nenhuma dependência crítica — pode ser adiada para Sprint 5B; recomenda-se aplicar junto a 013 e 014 para aproveitar a janela | `ALTER TABLE app_patients DROP COLUMN IF EXISTS race_color;` | `SELECT column_name FROM information_schema.columns WHERE table_name='app_patients' AND column_name='race_color'` |

**Ordem de execução:** 013 → 014 → 012. As migrations 013 e 014 não têm dependência mútua e podem ser executadas em qualquer ordem ou em paralelo.

**Notas de idempotência:** Todas as migrations usam `ADD COLUMN IF NOT EXISTS` e `CREATE ... IF NOT EXISTS`. Re-execução em ambiente já migrado deve retornar sucesso sem alterar dados.

---

### Fase 4 — Professional + Team + Unit (Deploy 3)

**Pré-condição: Migrations 013 e 014 aplicadas em staging e produção. D-PRE-01 e D-PRE-02 respondidas.**

| ID | Mudança | Arquivo | Linha (aprox.) | Risco | Teste de Validação |
|---|---|---|---|---|---|
| F4-01 | Adicionar `cnsProfissional` (regex `/^\d{15}$/`) ao `RegisterSchema` e `MePatchSchema`; handler `PATCH /me` persiste o campo; handler `POST /users` inclui o campo | `backend/src/schemas.js` + `backend/src/routes/me.js` + `backend/src/routes/users.js` | schemas.js:13–22, 273–280; me.js:~handler | Se D-PRE-06 definir AES obrigatório, implementar antes do merge (BLOQUEADOR) | PATCH /me com `cnsProfissional: "700000000000000"` → 200; GET /me retorna campo |
| F4-02 | Adicionar `cboCodigo` e `cboDescricao` (JSONB) ao `RegisterSchema` e `MePatchSchema`; handler `PATCH /me` persiste os campos | `backend/src/schemas.js` + `backend/src/routes/me.js` | schemas.js:13–22, 273–280 | Baixo — campos PUBLIC sem criptografia | PATCH /me com `cboCodigo: "225125"` → 200; GET /me retorna campo |
| F4-03 | `buildUserAuditSnapshot` (`users.js:19–33`) — adicionar `cns`/`cnsProfissional` após `councilUf` | `backend/src/routes/users.js` | 19–33 | Campo SENSITIVE não deve aparecer em claro no audit log | Alterar usuário; verificar audit log: `cnsProfissional` como hash ou `[REDACTED]` |
| F4-04 | Schema de unidade: expor campo `cnes` em `GET /units/:id` e aceitar em `PATCH /units/:id`; adicionar `tipoUnidade` (enum `TipoUnidade`) | `backend/src/routes/units.js` + `backend/src/schemas.js` | schemas unidades | Sem impacto em dados existentes — coluna nova, nullable | GET /units/:id retorna `cnes: null` para unidade sem CNES; PATCH /units/:id com `cnes: "1234567"` persiste |
| F4-05 | Schema de team: adicionar `ine` (regex `/^\d{10}$/`) e `tipoEquipe` (enum `TipoEquipe`) | `backend/src/routes/teams.js` + `backend/src/schemas.js` | schemas teams | `ine` é obrigatório no e-SUS — aguardar D-PRE-02 antes de torná-lo obrigatório na validation | PATCH /teams/:id com `ine: "0123456789"` → 200; GET retorna `ine` |
| F4-06 | Inserir CNES real da UBS-001 via script de seed após D-PRE-01 respondida | Script SQL ou seed | N/A | Dado de produção — usar staging primeiro | SELECT `cnes` FROM `app_units` WHERE id = 'ubs-001-id' retorna o CNES oficial |

---

### Fase 5 — Entidade Household (Deploy 4)

**Pré-condição: Smoke de Deploy 3 PASS. Fase 4 estável em staging.**

| ID | Mudança | Arquivo | Linha (aprox.) | Risco | Teste de Validação |
|---|---|---|---|---|---|
| F5-01 | Migration: criar tabela `app_households` com campos da Seção 5 do esus-data-model-v1.md (`id`, `patientId`, `teamId`, `tipoImovel`, `numMoradores`, `numComodos`, `materialPredominanteParedes`, `abastecimentoAgua`, `tratamentoAgua`, `esgotamento`, `coletaLixo`, `destinacaoLixo`, `energiaEletrica`, `localizacao`, `createdAt`, `updatedAt`) | `backend/src/migrations/015_create_app_households.js` | N/A | Migration nova — sem impacto em dados existentes | `SELECT * FROM app_households LIMIT 1` retorna 0 rows; re-executar migration = sucesso; rollback = `DROP TABLE IF EXISTS app_households` |
| F5-02 | Schema Zod `HouseholdSchema` com todos os campos e enums da Seção 5 | `backend/src/schemas.js` | Novo schema (~linha 250+) | Nenhum — schema novo | Schema valida payload correto; rejeita `tipoImovel` fora do enum com 400 |
| F5-03 | Extração interna no handler `PATCH /patients/:id`: extrair campos Household (`housingType`, `waterSupply`, `sewage`, `garbage`, `electricity`) do payload, mapear para canônico, criar/atualizar registro em `app_households` com `patientId` e `teamId` derivados do paciente, remover campos Household do objeto Patient antes da persistência | `backend/src/routes/patients.js` | ~100–300 (handler PATCH) | Crítico: se extração falhar, dados do domicílio se perdem; se remoção dos campos do Patient falhar, dados ficam redundantes | PATCH /patients/:id com `housingType: "DOMICILIO"` → registro `app_households` criado; GET /patients/:id não retorna campos Household no corpo do paciente; SELECT * FROM app_households WHERE patient_id = ':id' retorna registro |
| F5-04 | Audit log para Household: emitir eventos `household.created` e `household.updated` no mesmo handler | `backend/src/routes/patients.js` | ~100–300 | Ausência de audit log = violação de requisito de auditoria | Após PATCH com campos Household, SELECT de `app_audit_logs` WHERE entity_type = 'household' retorna evento |
| F5-05 | Permissão de Household: ACS e enfermeiro podem criar/atualizar; gestor e admin podem ler; nenhum role pode excluir fisicamente | `backend/src/routes/patients.js` + `backend/src/utils/helpers.js` | handler PATCH + capabilities | M-03: campos Household marcados SENSITIVE — verificar que gestor não recebe campos sensíveis via GET /patients | GET /patients/:id com role gestor não expõe `materialPredominanteParedes` em claro |

---

### Fase 6 — RBAC ACS (Deploy 5 — Breaking Change — Janela de Manutenção)

**GATE OBRIGATÓRIO ANTES DE INICIAR: D-PRE-03 (query `assignedAcsId`) executada e resultado = 0 pacientes sem ACS. D-PRE-04 (alinhamento gestores) concluída. Se houver pacientes sem `assignedAcsId`, definir política de acesso para esses pacientes antes de ativar a restrição.**

| ID | Mudança | Arquivo | Linha (aprox.) | Risco | Teste de Validação |
|---|---|---|---|---|---|
| F6-01 | `getAllowedPatients`: inserir branch dedicado para ACS antes do return genérico (linha ~309), filtrando por `p.assignedAcsId === user.id` além de `p.teamId === user.teamId` | `backend/src/utils/patients.js` | 309–315 | M-09 (CRÍTICO): ACS perde acesso a todos os pacientes sem `assignedAcsId` preenchido — nunca deploy sem D-PRE-03 = 0 | ACS logado → GET /patients retorna apenas pacientes com `assignedAcsId = acs.id`; pacientes sem assignedAcsId não aparecem |
| F6-02 | `canAccessPatient` modo `write`: substituir linha 278 pelo check `teamMatch && (role !== 'acs' || assignedAcsId === user.id)` | `backend/src/utils/patients.js` | 278 | M-08 (CRÍTICO): dependência temporal com F6-01 — nunca um sem o outro | ACS faz PATCH /patients/:id de paciente não designado → 403; ACS faz PATCH de paciente designado → 200 |
| F6-03 | Adicionar `"tasks.write"` ao array de capabilities do role `acs` | `backend/src/utils/helpers.js` | 111 | Baixo — adição de capability; risco de abuso de permissão menor que benefício operacional | ACS POST /tasks → 200; role sem `tasks.write` → 403 |
| F6-04 | Emitir evento de auditoria `patient.acs_access_denied` quando ACS tenta acessar paciente com `assignedAcsId` mismatch | `backend/src/routes/patients.js` ou `backend/src/utils/patients.js` | ~`getPatientOrError` | Ausência = sem rastreabilidade de tentativas de acesso indevido | ACS tenta GET /patients/:id de paciente não designado → 403 + audit log com action `patient.read_blocked` |
| F6-05 | Emitir evento `task.created` para ACS ao criar tarefa | `backend/src/routes/tasks.js` | handler POST | Audit log incompleto sem o evento | ACS cria tarefa → SELECT app_audit_logs WHERE entity_type = 'task' AND action = 'CREATE' retorna evento |

---

### Fase 7 — Auditoria + Mascaramento LGPD (Deploy 6)

**Pré-condição: Todos os deploys anteriores estáveis em staging. `cnsResponsavel` com AES-256-GCM implementado (BLOQUEADOR para este deploy).**

| ID | Mudança | Arquivo | Linha (aprox.) | Risco | Teste de Validação |
|---|---|---|---|---|---|
| F7-01 | `buildPatientAuditSnapshot`: adicionar `cpf` como hash SHA-256 (não valor em claro), `cns` como hash SHA-256, `phone` mascarado (ocultar últimos 4 dígitos), `sexAtBirth` em claro, `genderIdentity` como `[REDACTED-SPECIAL-CATEGORY]` | `backend/src/routes/patients.js` | 34–48 | CPF/CNS em claro em audit log = violação LGPD grave | Alterar paciente → audit log: `cpf` aparece como hash, `phone` mascarado, `genderIdentity` como `[REDACTED-SPECIAL-CATEGORY]` |
| F7-02 | Middleware de auditoria: substituir `racaCor`, `etnia`, `genderIdentity` por `[REDACTED-SPECIAL-CATEGORY]` em `snapshot_before` e `snapshot_after` no momento da gravação. **Nota:** `genderIdentity` aparece em F7-01 E F7-02 — isso é intencional (defesa em profundidade): F7-01 mascara no ponto de construção do snapshot; F7-02 mascara no ponto de gravação. Duplicidade proposital, não regressão. | `backend/src/routes/patients.js` ou middleware de auditoria | Função que grava audit log | M-03 (CRÍTICO): campos SPECIAL_CATEGORY não podem aparecer em claro no audit log | Criar paciente com `racaCor: "PARDA"`, `genderIdentity: "HOMEM_TRANSGENERO"` → audit log: ambos como `[REDACTED-SPECIAL-CATEGORY]` |
| F7-03 | Mascaramento em listagem para gestor: `racaCor`, `etnia` e `genderIdentity` não aparecem em `GET /patients` para role `gestor` (apenas para roles clínicos e admin) | `backend/src/routes/patients.js` | Função de serialização de listagem | LGPD Art. 11: campos SPECIAL_CATEGORY sob sigilo profissional — gestor não é profissional de saúde com dever de sigilo clínico | GET /patients com role gestor → `racaCor` ausente ou `null`; GET com role enfermeiro → `racaCor` presente |
| F7-04 | `buildUserAuditSnapshot`: adicionar `cnsProfissional` como hash SHA-256 (nunca em claro no audit log) | `backend/src/routes/users.js` | 19–33 | Campo SENSITIVE — valor em claro no audit log = violação LGPD | Alterar usuário → audit log: `cnsProfissional` como hash |
| F7-05 | Verificar e atualizar `anonymizePatientBundle` para incluir `rendaFamiliar` (SENSITIVE), `cnsResponsavel` (SENSITIVE), campos de endereço (`logradouro`, `bairro`, `cep` — INTERNAL mas com impacto de privacidade por localização) | `backend/src/routes/patients.js` ou módulo privacy | Função de anonimização | Anonimização incompleta = dado persiste após solicitação LGPD Art. 18 | Solicitar anonimização → campos sensíveis ausentes ou mascarados; campos de identidade núcleo (`name`, `cpf`, `cns`) nulificados |

---

### Fase 8 — KI-02 Jurídico (Paralelo)

| ID | Ação | Quem | Resultado esperado |
|---|---|---|---|
| F8-01 | Escalar KI-02 ao DPO ou assessoria jurídica da SMS com prazo formal de resposta (prazo sugerido: 2026-06-30) | Tech Lead | E-mail ou documento formal registrando o escalonamento |
| F8-02 | DPO define: (a) prazo de retenção adotado e base legal; (b) marco inicial do prazo (último atendimento ou cadastro); (c) distinção prontuário clínico vs. dados cadastrais; (d) mecanismo de anonimização (hash + nulificação PII vs. exclusão lógica vs. retenção integral com acesso restrito) | DPO / Jurídico | Decisão formal documentada em `docs/lgpd/` com data, base legal e assinatura |
| F8-03 | Atualizar `PrivacyRequestCreateSchema` para bloquear processamento de requisições tipo `"deletion"` até KI-02 resolvido (retornar 503 com mensagem informativa) | Tech Lead | `POST /privacy-requests` com `type: "deletion"` retorna 503 com mensagem sobre revisão jurídica em andamento |
| F8-04 | Após decisão de F8-02, implementar mecanismo de anonimização conforme definido; não alterar módulo de privacidade antes | Tech Lead | Implementação alinhada à decisão jurídica formal |
| F8-05 | RIPD atualizado para incluir: `racaCor` sob Art. 11, II, f LGPD + Portaria MS 1.654/2011; `genderIdentity` sob CFM Res. 2.265/2019; `cnsResponsavel` com AES-256-GCM; entidade Household como conjunto SENSITIVE | DPO | RIPD assinado bilateralmente (Vitras + Prefeitura/SMS) antes do merge para produção |

---

## 4. Migrations Previstas

| # | ID | Arquivo | Tabela | DDL (resumo) | Sprint | Obrigatória? | Pré-condição | Rollback |
|---|---|---|---|---|---|---|---|---|
| 012 | `012_app_patients_esus_fields` | `backend/src/migrations/012_app_patients_esus_fields.js` | `app_patients` | `ADD COLUMN IF NOT EXISTS race_color VARCHAR(20)` | 5A (opcional) | Não — JSONB cobre; shadow column para filtros futuros | Nenhuma crítica | `DROP COLUMN IF EXISTS race_color` |

> **Nota (sobrescreve foundation plan):** `sprint-5a-foundation-plan.md` Seção 8.1 definia a migration 012 com duas colunas: `race_color VARCHAR(80)` E `situation_de_rua BOOLEAN`. Este implementation plan cria apenas `race_color VARCHAR(20)` — `situation_de_rua` foi removida porque `situacaoRua` foi excluído do escopo Sprint 5A (ver Seção 2.2). O tamanho `VARCHAR(20)` é o canônico conforme `esus-data-model-v1.md`. Se um desenvolvedor seguir a migration do foundation plan, irá criar uma coluna extra e com tamanho divergente — usar exclusivamente a definição acima.
| 013 | `013_app_units_add_cnes` | `backend/src/migrations/013_app_units_add_cnes.js` | `app_units` | `ADD COLUMN IF NOT EXISTS cnes VARCHAR(7)` + unique partial index | 5A | Sim | Sem CNES duplicados em staging; snapshot RDS | `DROP COLUMN IF EXISTS cnes; DROP INDEX IF EXISTS idx_app_units_cnes` |
| 014 | `014_app_users_add_cns` | `backend/src/migrations/014_app_users_add_cns.js` | `app_users` | `ADD COLUMN IF NOT EXISTS cns VARCHAR(20)` + unique partial index | 5A | Sim | D-PRE-06 respondida; sem CNS duplicados | `DROP COLUMN IF EXISTS cns; DROP INDEX IF EXISTS idx_app_users_cns` |
| 015 | `015_create_app_households` | `backend/src/migrations/015_create_app_households.js` | `app_households` | `CREATE TABLE IF NOT EXISTS app_households (id UUID PRIMARY KEY, patient_id VARCHAR, team_id VARCHAR, tipo_imovel VARCHAR(30), num_moradores INTEGER, num_comodos INTEGER, material_predominante_paredes VARCHAR(40), abastecimento_agua VARCHAR(30), tratamento_agua VARCHAR(30), esgotamento VARCHAR(30), coleta_lixo BOOLEAN, destinacao_lixo VARCHAR(30), energia_eletrica BOOLEAN, localizacao VARCHAR(10), created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)` | 5A | Sim (para Household) | Nenhuma — tabela nova | `DROP TABLE IF EXISTS app_households` |

---

## 5. Endpoints Impactados

| Método | Rota | Schema alterado | O que muda | Fase | Breaking? |
|---|---|---|---|---|---|
| `POST` | `/api/patients` | `PatientCreateSchema` via `PatientBaseShape` | +26 campos aceitos (F1); +campos e-SUS com enums (F2) | F1, F2 | Não (adição) |
| `PATCH` | `/api/patients/:id` | `PatientUpdateSchema` | +26 campos aceitos; aliases de endereço; enums estritos para `sexAtBirth` e `maritalStatus` (F2); extração interna Household (F5) | F1, F2, F5 | F2 (enums) para dados legados |
| `GET` | `/api/patients` | Response shape | Campos novos presentes se preenchidos; `racaCor`/`etnia`/`genderIdentity` mascarados para gestor (F7) | F2, F7 | Não para clientes; adição de campos |
| `GET` | `/api/patients/:id` | Response shape | Campos novos presentes; mascaramento LGPD (F7) | F2, F7 | Não |
| `POST` | `/api/auth/register` ou `/api/users` | `RegisterSchema` | +`cnsProfissional`, +`cboCodigo`, +`cboDescricao` | F4 | Não (adição) |
| `PATCH` | `/api/users/me` | `MePatchSchema` | +`cnsProfissional`, +`cboCodigo`, +`cboDescricao`; handler persiste campos | F4 | Não |
| `GET` | `/api/users/me` | Response | Retorna `cns`/`cnsProfissional` (mascarado se SENSITIVE) | F4 | Não |
| `PATCH` | `/api/units/:id` | Schema unidades | +`cnes` (após migration 013), +`tipoUnidade` | F4 | Não |
| `GET` | `/api/units/:id` | Response | Retorna `cnes` | F4 | Não |
| `PATCH` | `/api/teams/:id` | Schema teams | +`ine` (regex 10 dígitos), +`tipoEquipe` | F4 | Não |
| `GET` | `/api/patients` (ACS) | Filtro de resultado | ACS recebe apenas pacientes com `assignedAcsId = user.id` | F6 | Sim (breaking para ACS — janela de manutenção) |
| `PATCH` | `/api/patients/:id` (ACS) | Permissão | ACS recusado (403) para pacientes não designados | F6 | Sim (breaking para ACS — janela de manutenção) |
| `POST` | `/api/tasks` (ACS) | Capabilities | ACS passa a ter `tasks.write` | F6 | Não (adição de capability) |
| `POST` | `/api/privacy-requests` | `PrivacyRequestCreateSchema` | `type: "deletion"` retorna 503 até KI-02 resolvido | F8 | Sim (bloqueio intencional) |

---

## 6. Frontend Impactado

| Arquivo | Linha | Mudança | Fase | Risco |
|---|---|---|---|---|
| `frontend-react/src/hooks/usePatientModal.js` | 132 | `sex: form.sex.trim()` → `sexAtBirth: form.sex.trim()` | F1 | Regressão no envio de sexo se não sincronizado com backend |
| `frontend-react/src/hooks/usePatientModal.js` | ~30–60 (`buildPatientFormState`) | Ler `p?.sexAtBirth` em vez de `p?.sex` ao carregar paciente para edição | F1 | Modal abre com sexo em branco para pacientes existentes se não corrigido |
| `frontend-react/src/hooks/usePatientModal.js` | ~118–148 (payload) | Substituir `raceColor` por `racaCor`, `educationLevel` por `escolaridade` — após os aliases serem validados em produção | F2 (pós-alias) | Timing: frontend só muda após backend com alias estabilizado |
| `frontend-react/src/hooks/usePatientModal.js` | ~129–131 (payload endereço) | Substituir `zipCode` → `cep`, `number` → `numero`, `complement` → `complemento`, `neighborhood` → `bairro`, `state` → `uf` — após aliases serem validados | F2 (pós-alias) | Timing: aliases devem estar estáveis antes |
| `frontend-react/src/hooks/usePatientModal.js` | 130 (`address`) | Substituir `address` → `addressLegacy` — após alias validado em produção | F1 (pós-alias) | Timing: backend com alias primeiro |
| `frontend-react/src/hooks/usePatientModal.js` | ~135–137 (campos Household) | Campos `housingType`, `waterSupply`, `sewage`, `garbage`, `electricity` continuam sendo enviados — backend faz a extração interna (Decisão 11 do esus-data-model-v1.md); **não remover do frontend em Sprint 5A** | F5 | Remoção prematura = regressão em usuários que já preenchem esses campos |
| `frontend-react/src/hooks/usePatientModal.js` | ~init state | Adicionar campo `genderIdentity` ao estado inicial do modal e ao payload (campo existe no schema mas ausente do modal) | F2 | Campo nunca enviado sem esta mudança |
| `frontend-react/src/hooks/usePatientModal.js` | ~init state | Adicionar campos novos e-SUS ao estado inicial: `racaCor`, `escolaridade`, `situacaoMercadoTrabalho`, `rendaFamiliar`, `responsavelFamiliar`, `nacionalidade` | F2 | Dados não enviados se campo não incluído no payload |

---

## 7. Backend Impactado

| Arquivo | Função/Trecho | Mudança | Fase | Risco |
|---|---|---|---|---|
| `backend/src/schemas.js` | `PatientBaseShape` (linhas 24–62) | +26 campos novos; aliases `.transform()`; enums estritos (`sexAtBirth`, `maritalStatus`, `genderIdentity`, `racaCor`) | F1, F2 | M-01, M-02, M-12: enums estritos quebram dados legados — executar queries de levantamento antes |
| `backend/src/schemas.js` | `PatientUpdateSchema` (linhas 66–103) | Espelhar campos de `PatientBaseShape`; sem campos internos; `.strict()` mantido | F1, F2 | M-01: qualquer campo interno adicionado acidentalmente = mass-assignment |
| `backend/src/schemas.js` | `RegisterSchema` (linhas 13–22) | +`cnsProfissional`, +`cboCodigo`, +`cboDescricao` | F4 | Baixo. **Nota de nomenclatura:** `sprint-5a-foundation-plan.md` Seção 5.2 usa `cns` para este campo — este implementation plan adota o nome canônico `cnsProfissional` conforme `esus-data-model-v1.md` Seção 8.2. O foundation plan está desatualizado neste ponto. A coluna SQL permanece `cns` (migration 014); o campo JSONB/API é `cnsProfissional`. |
| `backend/src/schemas.js` | `MePatchSchema` (linhas 273–280) | +`cnsProfissional`, +`cboCodigo`, +`cboDescricao` | F4 | Idem `RegisterSchema` — nome canônico é `cnsProfissional`, não `cns`. Ver nota acima. |
| `backend/src/schemas.js` | Novo `HouseholdSchema` | Schema Zod completo para entidade Household | F5 | Enum `tipoImovel` obrigatório — validar valores antes de tornar obrigatório |
| `backend/src/routes/patients.js` | `buildPatientAuditSnapshot` (linhas 34–48) | +`cpf` (hash SHA-256), +`cns` (hash SHA-256), +`phone` (mascarado), +`sexAtBirth`, `genderIdentity` como `[REDACTED-SPECIAL-CATEGORY]` | F7 | CPF/CNS em claro = violação LGPD grave |
| `backend/src/routes/patients.js` | Handler `PATCH /patients/:id` | Extração interna de campos Household; criação/atualização de registro `app_households`; remoção dos campos do objeto Patient | F5 | Se extração falhar atomicamente com o PATCH do Patient, dados ficam inconsistentes — usar transação DB |
| `backend/src/routes/patients.js` | `anonymizePatientBundle` | +`racaCor`, +`etnia`, +`genderIdentity`, +`rendaFamiliar`, +`cnsResponsavel` | F2, F7 | M-03: campos ausentes = violação LGPD |
| `backend/src/routes/patients.js` | Serialização de listagem GET /patients | Mascarar `racaCor`, `etnia`, `genderIdentity` para role `gestor` | F7 | LGPD Art. 11 |
| `backend/src/routes/users.js` | `buildUserAuditSnapshot` (linhas 19–33) | +`cns`/`cnsProfissional` (hash SHA-256) | F4, F7 | Campo SENSITIVE em claro no audit log |
| `backend/src/routes/me.js` | Handler PATCH /me | Processar e persistir `cnsProfissional`, `cboCodigo`, `cboDescricao` | F4 | Baixo |
| `backend/src/utils/patients.js` | `getAllowedPatients` (linhas 309–315) | Branch dedicado para ACS: filtrar por `assignedAcsId === user.id` | F6 | M-09 (CRÍTICO): nunca antes de D-PRE-03 = 0 |
| `backend/src/utils/patients.js` | `canAccessPatient` (linha 278) | Verificar `assignedAcsId === user.id` para role `acs` no modo `write` | F6 | M-08 (CRÍTICO): dependência com F6-01 |
| `backend/src/utils/helpers.js` | Array capabilities `acs` (linha 111) | Adicionar `"tasks.write"` | F6 | Baixo |
| `backend/src/migrations/` | Novos arquivos | Migrations 012, 013, 014, 015 | F3, F5 | Migrations irreversíveis em produção sem snapshot RDS prévio |

---

## 8. Testes Obrigatórios

### 8.1 Queries SQL de Pré-condição (executar antes de cada fase)

```sql
-- ================================================================
-- ANTES DA FASE 1: verificar campos enviados pelo frontend
-- Verificar se há registros com sexAtBirth já preenchido (deve ser 0 antes do fix)
SELECT COUNT(*) FROM app_patients WHERE payload->>'sexAtBirth' IS NOT NULL AND payload->>'sexAtBirth' != '';

-- ================================================================
-- ANTES DA FASE 2 (M-02): levantamento de valores de sexAtBirth em staging
-- Resultado deve conter apenas valores null/vazio OU M/F/I após fix F1-03
SELECT DISTINCT payload->>'sexAtBirth' AS val, COUNT(*)
  FROM app_patients
  WHERE payload->>'sexAtBirth' IS NOT NULL AND payload->>'sexAtBirth' != ''
  GROUP BY val ORDER BY 2 DESC;

-- ANTES DA FASE 2 (M-12): levantamento de valores de maritalStatus
-- Identificar todos os valores string livre existentes para script de normalização
SELECT DISTINCT payload->>'maritalStatus' AS val, COUNT(*)
  FROM app_patients
  WHERE payload->>'maritalStatus' IS NOT NULL AND payload->>'maritalStatus' != ''
  GROUP BY val ORDER BY 2 DESC;

-- ANTES DA FASE 2 (M-02 racaCor case): levantamento de valores de racaCor
-- IMPORTANTE: o alias F1-05 armazena exatamente o valor enviado pelo frontend (pode ser minúscula).
-- O enum estrito de F2-01 usa UPPER_SNAKE_CASE (BRANCA/PRETA/PARDA/AMARELA/INDIGENA).
-- Se houver valores em minúscula (inseridos entre Deploy 1 e Deploy 2), normalizar antes de ativar enum estrito.
-- 'nao_informado' não existe no enum canônico (esus-data-model-v1.md Seção 15.1) — mapear para NULL antes do enum.
SELECT DISTINCT payload->>'racaCor' AS val, COUNT(*)
  FROM app_patients
  WHERE payload->>'racaCor' IS NOT NULL AND payload->>'racaCor' != ''
  GROUP BY val ORDER BY 2 DESC;

-- ANTES DA FASE 2 (genderIdentity): levantamento de valores existentes
SELECT DISTINCT payload->>'genderIdentity' AS val, COUNT(*)
  FROM app_patients
  WHERE payload->>'genderIdentity' IS NOT NULL AND payload->>'genderIdentity' != ''
  GROUP BY val ORDER BY 2 DESC;

-- ================================================================
-- ANTES DA FASE 3 (Migration 013): verificar CNES duplicados em app_units
SELECT cnes, COUNT(*) FROM app_units
  WHERE cnes IS NOT NULL AND cnes != ''
  GROUP BY cnes HAVING COUNT(*) > 1;
-- Resultado esperado: 0 linhas

-- ANTES DA FASE 3 (Migration 014): verificar CNS duplicados em app_users
SELECT cns, COUNT(*) FROM app_users
  WHERE cns IS NOT NULL AND cns != ''
  GROUP BY cns HAVING COUNT(*) > 1;
-- Resultado esperado: 0 linhas

-- Confirmar contagem de dados antes de qualquer migration (baseline)
SELECT COUNT(*) FROM app_patients;
SELECT COUNT(*) FROM app_units;
SELECT COUNT(*) FROM app_users;

-- ================================================================
-- ANTES DA FASE 6 (M-08/M-09): levantamento assignedAcsId
-- GATE: se sem_acs > 0, NÃO iniciar Fase 6 sem política de acesso definida
SELECT
  CASE WHEN payload->>'assignedAcsId' IS NULL OR payload->>'assignedAcsId' = ''
    THEN 'sem_acs'
    ELSE 'com_acs'
  END AS estado,
  COUNT(*)
  FROM app_patients
  WHERE (payload->>'inactive')::boolean IS NOT TRUE
  GROUP BY estado;

-- Identificar ACS sem nenhum paciente designado (ficarão sem acesso após Fase 6)
SELECT u.id, u.name FROM app_users u
  WHERE u.role = 'acs'
  AND NOT EXISTS (
    SELECT 1 FROM app_patients ap
    WHERE ap.payload->>'assignedAcsId' = u.id::text
    AND (ap.payload->>'inactive')::boolean IS NOT TRUE
  );
-- Resultado esperado: 0 linhas — todo ACS deve ter ao menos 1 paciente

-- Confirmar que assignedAcsId referencia usuários existentes com role acs
SELECT DISTINCT payload->>'assignedAcsId' AS acs_id FROM app_patients
  WHERE payload->>'assignedAcsId' IS NOT NULL
  AND payload->>'assignedAcsId' != ''
  AND NOT EXISTS (
    SELECT 1 FROM app_users u
    WHERE u.id::text = app_patients.payload->>'assignedAcsId'
    AND u.role = 'acs'
  );
-- Resultado esperado: 0 linhas (sem referências quebradas)
```

---

### 8.2 Testes Unitários e de Integração Obrigatórios

| Cenário | Endpoint | Esperado | Fase |
|---|---|---|---|
| POST /patients com todos os 26 campos antes ausentes | `POST /api/patients` | 201 + GET retorna todos os campos | F1 |
| PATCH /patients/:id com campo interno `unitId` no body | `PATCH /api/patients/:id` | 400 (`.strict()` rejeita) | F1 |
| PATCH /patients/:id com campo interno `municipalityId` no body | `PATCH /api/patients/:id` | 400 (`.strict()` rejeita) | F1 |
| Frontend envia `sexAtBirth` (após fix) | `PATCH /api/patients/:id` | 200 + GET retorna `sexAtBirth` preenchido | F1 |
| Frontend envia `raceColor: "BRANCA"` (com alias) | `PATCH /api/patients/:id` | 200 + GET retorna `racaCor: "BRANCA"` | F1 |
| POST /patients com `sexAtBirth: "M"` | `POST /api/patients` | 201 | F2 |
| POST /patients com `sexAtBirth: "X"` | `POST /api/patients` | 400 | F2 |
| PATCH /patients/:id com `maritalStatus` legado após normalização | `PATCH /api/patients/:id` | 200 + valor convertido para enum | F2 |
| POST /patients com `racaCor: "INDIGENA"` sem `etnia` | `POST /api/patients` | 201 (etnia opcional mas recomendada) | F2 |
| POST /patients com `racaCor: "BRANCA"` com `etnia: "Xpto"` | `POST /api/patients` | 201, `etnia` ignorada ou armazenada conforme decisão | F2 |
| `anonymizePatientBundle` com `racaCor: "PARDA"` | Função interna | `racaCor` aparece como `[REDACTED-SPECIAL-CATEGORY]` | F2 |
| Migration 013 executada duas vezes | SQL direto | Sucesso sem erro (idempotente) | F3 |
| Migration 014 executada duas vezes | SQL direto | Sucesso sem erro (idempotente) | F3 |
| PATCH /me com `cnsProfissional: "123456789012345"` | `PATCH /api/users/me` | 200 + GET /me retorna campo | F4 |
| PATCH /me com `cnsProfissional: "12345"` (menos de 15 dígitos) | `PATCH /api/users/me` | 400 | F4 |
| PATCH /patients/:id com campos Household | `PATCH /api/patients/:id` | 200 + SELECT app_households retorna registro criado/atualizado | F5 |
| PATCH /patients/:id com Household — verificar que campos não ficam no Patient | `GET /api/patients/:id` | Patient não contém `tipoImovel`, `esgotamento` etc. | F5 |
| GET /patients com ACS após Fase 6 | `GET /api/patients` | Apenas pacientes com `assignedAcsId = acs.id` | F6 |
| PATCH /patients/:id de paciente não designado pelo ACS | `PATCH /api/patients/:id` | 403 | F6 |
| ACS POST /tasks após Fase 6 | `POST /api/tasks` | 200 (capability `tasks.write` adicionada) | F6 |
| Alterar paciente com `racaCor` → verificar audit log | `PATCH /api/patients/:id` | `app_audit_logs.snapshot_after` não contém `racaCor` em claro | F7 |
| `buildPatientAuditSnapshot` com CPF preenchido | Função interna | `cpf` aparece como hash SHA-256, não valor em claro | F7 |
| GET /patients com role gestor → campos SPECIAL_CATEGORY | `GET /api/patients` | `racaCor`, `etnia`, `genderIdentity` ausentes ou mascarados | F7 |

---

### 8.3 Smoke Tests por Deploy

**Deploy 1 (Fase 1 — Silent Data Loss):**
- [ ] POST /patients com 26 campos antes descartados → GET retorna todos
- [ ] PATCH /patients/:id com campos novos → GET confirma persistência
- [ ] Campo interno `unitId` no PATCH body → 400
- [ ] `sexAtBirth: "M"` salvo corretamente via modal
- [ ] `raceColor: "BRANCA"` no payload → GET retorna `racaCor: "BRANCA"` (alias ativo)
- [ ] Modal de edição de paciente: abrir paciente existente, verificar que `sexAtBirth` é exibido corretamente

**Deploy 2 (Fase 2 — Campos e-SUS Patient):**
- [ ] `racaCor: "INDIGENA"` + `etnia: "Guarani"` → ambos persistidos
- [ ] `sexAtBirth: "X"` → 400; `sexAtBirth: "I"` → 200
- [ ] `maritalStatus` com valor legado (string livre) → retorna 400 (enum estrito); script de normalização rodado antes
- [ ] `anonymizePatientBundle` mascara `racaCor`, `etnia`, `genderIdentity`
- [ ] `cnsResponsavel` salvo criptografado; audit log não expõe valor em claro
- [ ] Nenhum dado de paciente existente corrompido (COUNT(*) pré = pós)

**Deploy 3 (Fase 3 — Migrations + Fase 4 — Professional/Team/Unit):**
- [ ] SELECT `cnes` FROM `app_units` → coluna existe, nullable
- [ ] SELECT `cns` FROM `app_users` → coluna existe, nullable
- [ ] COUNT(*) `app_units`, `app_users`, `app_patients` = valor baseline pré-migration
- [ ] PATCH /me com `cnsProfissional: "700000000000001"` → 200; GET /me retorna campo
- [ ] PATCH /units/:id com `cnes: "1234567"` → 200; GET retorna `cnes`
- [ ] PATCH /teams/:id com `ine: "0123456789"` → 200; GET retorna `ine`
- [ ] PATCH /me com `cnsProfissional: "12345"` (inválido) → 400

**Deploy 4 (Fase 5 — Household):**
- [ ] PATCH /patients/:id com `housingType: "DOMICILIO"` → SELECT `app_households` WHERE `patient_id` retorna registro
- [ ] GET /patients/:id não contém campos Household no body do Patient
- [ ] SELECT `app_audit_logs` WHERE `entity_type = 'household'` retorna evento após PATCH
- [ ] Rollback da migration 015 possível sem perda de dados de Patient

**Deploy 5 (Fase 6 — RBAC ACS):**
- [ ] GET /patients com ACS → lista contém apenas pacientes com `assignedAcsId = acs.id`
- [ ] PATCH /patients/:id de paciente não designado pelo ACS → 403 + audit log `patient.read_blocked`
- [ ] ACS POST /tasks → 200
- [ ] Enfermeiro não afetado: GET /patients com role enfermeiro → lista completa da equipe
- [ ] Gestor não afetado: GET /patients com role gestor → lista completa da unidade

**Deploy 6 (Fase 7 — Auditoria + LGPD):**
- [ ] Alterar paciente com `racaCor` → audit log: `racaCor` como `[REDACTED-SPECIAL-CATEGORY]`
- [ ] Alterar paciente com `cpf` → audit log: `cpf` como hash SHA-256 (não valor em claro)
- [ ] GET /patients com role gestor → `racaCor`, `etnia`, `genderIdentity` ausentes
- [ ] GET /patients com role enfermeiro → `racaCor` presente
- [ ] `anonymizePatientBundle` cobre todos os campos SENSITIVE e SPECIAL_CATEGORY

---

### 8.4 Cenários de Regressão Críticos

**CRC-01: Edição de paciente com dados legados (M-01 + M-02 + M-12)**

Contexto: paciente criado antes de Sprint 5A, com `sexAtBirth` como string livre e `maritalStatus` como string livre.

Passos:
1. Identificar em staging paciente com `sexAtBirth` fora de `['M','F','I']` e `maritalStatus` como string livre.
2. Tentar PATCH /patients/:id com dados válidos (nome, telefone) — sem alterar `sexAtBirth` ou `maritalStatus`.
3. Esperado: 200, nenhum dado corrompido.
4. Tentar PATCH /patients/:id incluindo `sexAtBirth: "Masculino"` (valor legado) — esperado: 400 (enum estrito).
5. Executar script de normalização de dados legados.
6. Repetir passo 4 com `sexAtBirth: "M"` — esperado: 200.

Critério de aprovação: edição de pacientes existentes não falha após normalização; sem perda de dados.

**CRC-02: ACS acessa pacientes após Fase 6 (M-08/M-09)**

Contexto: Fase 6 ativa; ACS com `assignedAcsId` configurado em alguns pacientes.

Passos:
1. ACS faz GET /patients — verifica que lista contém apenas seus pacientes designados.
2. ACS faz GET /patients/:id de paciente designado — esperado: 200.
3. ACS faz GET /patients/:id de paciente não designado (mesmo teamId) — esperado: 403.
4. ACS faz PATCH /patients/:id de paciente designado — esperado: 200.
5. ACS faz PATCH /patients/:id de paciente não designado — esperado: 403 + audit log.
6. Enfermeiro faz GET /patients — lista completa da equipe (não afetado pela Fase 6).

Critério de aprovação: ACS vê apenas seus pacientes; outros roles não afetados.

**CRC-03: Anonimização LGPD com campos novos (M-03)**

Contexto: paciente com `racaCor: "PARDA"`, `etnia: null`, `genderIdentity: "MULHER_TRANSGENERO"`, `rendaFamiliar: "ATE_0_5_SM"`, `cnsResponsavel: "<criptografado>"`.

Passos:
1. Solicitar anonimização via `anonymizePatientBundle`.
2. Verificar que `racaCor` aparece como `[REDACTED-SPECIAL-CATEGORY]`.
3. Verificar que `genderIdentity` aparece como `[REDACTED-SPECIAL-CATEGORY]`.
4. Verificar que `rendaFamiliar` é nulificado.
5. Verificar que `cnsResponsavel` é nulificado.
6. Verificar que `name`, `cpf`, `cns`, `phone` são nulificados.

Critério de aprovação: nenhum dado SENSITIVE ou SPECIAL_CATEGORY persiste após anonimização.

**CRC-04: Snapshot de auditoria antes/depois do PUT (M-11)**

Contexto: paciente com `racaCor: "PRETA"`, `cpf: "<criptografado>"`.

Passos:
1. PATCH /patients/:id alterando `name`.
2. SELECT `app_audit_logs` WHERE `entity_id = ':id'` ORDER BY `created_at` DESC LIMIT 1.
3. Verificar `snapshot_before`: `racaCor` = `[REDACTED-SPECIAL-CATEGORY]`; `cpf` = hash SHA-256.
4. Verificar `snapshot_after`: mesmo tratamento.
5. Verificar que `snapshot_before.name` = nome antigo; `snapshot_after.name` = nome novo.

Critério de aprovação: audit log não expõe dados sensíveis em claro; mudança de `name` auditável.

**CRC-05: `tasks.write` para ACS sem verificação de `assignedAcsId` no handler (M-10)**

Contexto: ACS com `tasks.write` ativo (após Fase 6); paciente não designado ao ACS.

Passos:
1. ACS faz POST /tasks com `patientId` de paciente não designado a ele.
2. Esperado: 403 (handler de tasks deve verificar `canAccessPatient` antes de criar tarefa).
3. ACS faz POST /tasks com `patientId` de paciente designado a ele.
4. Esperado: 201 + audit log `task.created`.

Critério de aprovação: `tasks.write` não contorna a restrição de acesso por `assignedAcsId`.

---

### 8.5 Testes LGPD/RBAC Obrigatórios

| Cenário | Role | Input | Resultado esperado | Fase |
|---|---|---|---|---|
| GET /patients lista pacientes com `racaCor` | `gestor` | GET /patients | `racaCor` ausente ou `null` na resposta | F7 |
| GET /patients lista pacientes com `racaCor` | `enfermeiro` | GET /patients | `racaCor` presente na resposta | F7 |
| GET /patients lista pacientes com `genderIdentity` | `gestor` | GET /patients | `genderIdentity` ausente ou `null` | F7 |
| GET /patients lista pacientes com `genderIdentity` | `medico` | GET /patients | `genderIdentity` presente | F7 |
| Audit log após PATCH com `racaCor` | qualquer | PATCH /patients/:id | `snapshot_after.racaCor` = `[REDACTED-SPECIAL-CATEGORY]` | F7 |
| Audit log após PATCH com `cpf` | qualquer | PATCH /patients/:id | `snapshot_after.cpf` = hash SHA-256 | F7 |
| ACS acessa paciente não designado (modo read) | `acs` | GET /patients/:id | 403 + audit log | F6 |
| ACS acessa paciente não designado (modo write) | `acs` | PATCH /patients/:id | 403 | F6 |
| ACS cria tarefa para paciente não designado | `acs` | POST /tasks com patientId não designado | 403 | F6 |
| `cnsResponsavel` não aparece em claro no audit log | `enfermeiro` | PATCH /patients/:id com `cnsResponsavel` | Audit log: valor criptografado ou hash | F7 |
| GET /patients/:id com `cnsResponsavel` | `acs` | GET /patients/:id | `cnsResponsavel` ausente (ACS não tem acesso a SENSITIVE) | F7 |
| GET /patients/:id com `cnsResponsavel` | `medico` | GET /patients/:id | `cnsResponsavel` presente (decriptado) | F7 |
| anonymizePatientBundle inclui campos SPECIAL_CATEGORY novos | `admin` | Chamar anonimização | `racaCor`, `etnia`, `genderIdentity` como `[REDACTED-SPECIAL-CATEGORY]` | F2 |
| `domesticViolence` acessível apenas por roles clínicos | `acs` | GET /patients/:id | `domesticViolence` ausente | F1/F2 |
| `domesticViolence` acessível por roles clínicos | `medico` | GET /patients/:id | `domesticViolence` presente se preenchido | F1/F2 |

---

## 9. Rollback

**Regra geral: sempre tirar snapshot RDS antes de qualquer deploy em produção que inclua migration.**

| Fase | Como reverter | Impacto de dados |
|---|---|---|
| F1 (Silent Data Loss) | Reverter commit de `schemas.js` e `usePatientModal.js`; rebuild e redeploy | Campos que foram persistidos durante F1 continuam no JSONB mas serão descartados pelo schema revertido. Sem perda de dados existentes anteriores. |
| F2 (Campos e-SUS Patient) | Reverter commit de `schemas.js`; campos novos persistidos no JSONB ficam no banco mas não são aceitos/retornados pelo schema | Sem perda de dados existentes; campos novos ficam inacessíveis via API até próximo deploy |
| F2 (enum `maritalStatus`) | Reversão de enum sem rollback de script de normalização = dados normalizados ficam incompatíveis com versão anterior | Crítico: não reverter enum após script de normalização rodado em produção sem plano de re-normalização |
| F3 (Migrations 012, 013, 014) | Ver DDL de rollback na Seção 4; executar apenas com snapshot RDS prévio confirmado | Colunas novas sem dados críticos — rollback seguro em staging; em produção, apenas com coordenação |
| F5 (Household — migration 015) | `DROP TABLE IF EXISTS app_households;` + reverter código de extração do handler | Dados de Household no `app_households` são perdidos — reversão apenas se nenhum dado de produção foi gravado |
| F6 (RBAC ACS) | Reverter commits de `patients.js` e `helpers.js`; rebuild e redeploy | ACS volta a ver todos os pacientes da equipe — sem impacto em dados |
| F7 (Auditoria + LGPD) | Reverter commits de audit e serialização; rebuild e redeploy | Audit logs já gravados com `[REDACTED-SPECIAL-CATEGORY]` permanecem — sem impacto em dados de pacientes |
| F8 (KI-02) | Reverter bloqueio de `POST /privacy-requests type:deletion` | Sem impacto em dados |

---

## 10. Critérios de Aceite

Sprint 5A é considerada encerrada quando todos os itens abaixo forem atendidos:

1. `PatientBaseShape` (`schemas.js:24-62`) expandido com todos os campos Sprint 5A; `.strict()` mantido; nenhum campo interno exposto.
2. `PatientUpdateSchema` (`schemas.js:66-103`) espelha `PatientBaseShape`; `.strict()` mantido.
3. Bug `sex`/`sexAtBirth` corrigido: `usePatientModal.js:132` envia `sexAtBirth`; `buildPatientFormState` lê `p?.sexAtBirth`.
4. Aliases `.transform()` ativos para `raceColor`→`racaCor`, `educationLevel`→`escolaridade`, `address`→`addressLegacy`, campos de endereço legacy → canônicos.
5. Enums estritos aplicados: `sexAtBirth` → `['M','F','I']`, `maritalStatus` → `EstadoCivil`, `genderIdentity` → `IdentidadeGenero`.
6. Script de normalização de dados legados de `maritalStatus` e `genderIdentity` executado em staging e produção antes da ativação dos enums estritos.
7. `racaCor` persistido no JSONB E na shadow column `race_color` (migration 012 aplicada).
8. `cnsResponsavel` implementado com AES-256-GCM + HMAC antes do merge para produção.
9. Migration 013 criada, testada (idempotente), aplicada em staging e produção com rollback validado.
10. Migration 014 criada, testada (idempotente), aplicada em staging e produção com rollback validado.
11. Migration 015 criada, testada (idempotente), tabela `app_households` criada com rollback validado.
12. `cnsProfissional` (regex `/^\d{15}$/`) aceito em `RegisterSchema` e `MePatchSchema`; handler `PATCH /me` persiste.
13. `cboCodigo` e `cboDescricao` aceitos em schemas de usuário; handler `PATCH /me` persiste.
14. `cnes` exposto e aceito em schema de unidade; `tipoUnidade` (enum) implementado.
15. `ine` (regex `/^\d{10}$/`) e `tipoEquipe` (enum) aceitos em schema de equipe.
16. Entidade Household: extração interna no handler `PATCH /patients/:id` operacional; campos criados em `app_households`; campos removidos do objeto Patient antes da persistência.
17. Audit log de Household: eventos `household.created` e `household.updated` emitidos.
18. `getAllowedPatients`: ACS filtrado por `assignedAcsId === user.id` (Fase 6).
19. `canAccessPatient`: ACS em modo `write` requer `assignedAcsId === user.id` (Fase 6).
20. `tasks.write` adicionado ao array de capabilities do role `acs`.
21. Evento de auditoria `patient.acs_access_denied` emitido quando ACS tenta acesso negado.
22. `buildPatientAuditSnapshot`: `cpf` e `cns` como hash SHA-256; `phone` mascarado; `genderIdentity` como `[REDACTED-SPECIAL-CATEGORY]`.
23. Middleware de auditoria: `racaCor`, `etnia`, `genderIdentity` como `[REDACTED-SPECIAL-CATEGORY]` em `snapshot_before` e `snapshot_after`.
24. Mascaramento em GET /patients para role `gestor`: `racaCor`, `etnia`, `genderIdentity` ausentes.
25. `anonymizePatientBundle` cobre todos os campos SENSITIVE e SPECIAL_CATEGORY introduzidos em Sprint 5A.
26. CNES da UBS-001 preenchido no registro de unidade em staging e produção (D-PRE-01).
27. KI-02 escalado ao DPO com prazo formal de resposta registrado (F8-01).
28. RIPD assinado bilateralmente antes do merge para produção (D-PRE-08).
29. Todos os smoke tests por deploy aprovados.
30. Todos os cenários de regressão CRC-01 a CRC-05 aprovados.
31. Nenhum dado clínico existente alterado ou excluído pelas migrations (SELECT COUNT(*) pré = pós em todas as tabelas).
32. Branch `feat/sprint-5a-esus-fields` criada a partir de `main` (commit d20add9).
33. PR aprovado por pelo menos um revisor com foco em segurança de dados e multi-tenant.
34. Deploy em produção com smoke test pós-deploy confirmando sem regressão.

---

## 11. Critérios de NO-GO

Condições que impedem o início de cada fase ou o merge para produção:

| Condição | Bloqueia |
|---|---|
| Branch criada a partir de `chore/rotate-data-encryption-key` em vez de `main` (d20add9) | Início de qualquer fase |
| D-PRE-03 não executada OU resultado `sem_acs > 0` sem política definida | Início da Fase 6 |
| D-PRE-04 (alinhamento gestores) não concluída | Início da Fase 6 |
| Smoke de Deploy 1 (Fase 1) com qualquer falha | Início da Fase 2 |
| Query de levantamento `sexAtBirth`/`maritalStatus` não executada | Deploy 2 com enums estritos |
| Script de normalização de dados legados não executado em staging | Deploy 2 com enums estritos |
| Script de normalização de dados legados não executado em produção | Deploy 2 em produção |
| Snapshot RDS não tirado | Início de qualquer janela de manutenção com migration |
| `cnsResponsavel` sem AES-256-GCM + HMAC | Deploy 6 (Fase 7) / merge para produção |
| D-PRE-06 não respondida (decisão AES para `cnsProfissional`) | Migration 014 em produção |
| KI-02 não resolvido e RIPD não assinado | Merge para produção (qualquer fase) |
| `anonymizePatientBundle` não cobre campos SPECIAL_CATEGORY novos | Merge para produção |
| Testes CRC-01 a CRC-05 com qualquer falha | Merge para produção |
| Contagem COUNT(*) de tabelas clínicas diverge após migration | Rollback imediato; não avançar |
| Handler `PATCH /patients/:id` da Fase 5 sem transação DB envolvendo Patient + Household atomicamente | Início do Deploy 4 (Fase 5) |

---

## 12. Checklist de Execução

### Pré-código (Dia 1)
- [ ] D-PRE-09: Criar branch `feat/sprint-5a-esus-fields` a partir de `main` commit d20add9 — verificar com `git log --oneline -1` que o HEAD é d20add9
- [ ] D-PRE-01: Consultar `cnes.datasus.gov.br` e obter CNES oficial da UBS-001 (7 dígitos) — registrar em `docs/rollout/ubs-001/contatos.md`
- [ ] D-PRE-02: Obter INE da equipe ESF (10 dígitos) junto à SMS — registrar no mesmo documento
- [ ] D-PRE-03: Executar query de levantamento `assignedAcsId` em staging (Seção 8.1) — registrar resultado
- [ ] D-PRE-04: Agendar reunião com gestores UBS-001 sobre restrição ACS (D+1 a D+3)
- [ ] D-PRE-05: Enviar e-mail formal ao DPO escalando KI-02 com prazo sugerido 2026-06-30 — registrar em `docs/lgpd/`
- [ ] D-PRE-06: Consultar jurídico sobre obrigatoriedade de AES para `cnsProfissional` — registrar decisão
- [ ] D-PRE-07: Agendar validação de enums com equipe clínica UBS-001 para D+3 a D+5

### Fase 1 — Silent Data Loss (PR 1 — Deploy 1)
- [ ] F1-01: Adicionar 26 campos ao `PatientBaseShape` em `backend/src/schemas.js` (linhas 24–62)
- [ ] F1-02: Espelhar campos no `PatientUpdateSchema` (linhas 66–103) — verificar que nenhum campo interno foi incluído (`id`, `teamId`, `hash`, `updatedAt`, `createdAt`, `createdBy`, `unitId`, `municipalityId`)
- [ ] F1-03: Corrigir `usePatientModal.js:132` — `sex:` → `sexAtBirth:`
- [ ] F1-04: Corrigir `buildPatientFormState` — ler `p?.sexAtBirth` não `p?.sex`
- [ ] F1-05: Adicionar alias `.transform()` `raceColor` → `racaCor` no `PatientBaseShape`
- [ ] F1-06: Adicionar alias `.transform()` `educationLevel` → `escolaridade` no `PatientBaseShape`
- [ ] F1-07: Adicionar alias `.transform()` `address` → `addressLegacy` no `PatientBaseShape`
- [ ] F1-08: Adicionar aliases de endereço (`zipCode`→`cep`, `number`→`numero`, `complement`→`complemento`, `neighborhood`→`bairro`, `state`→`uf`) no `PatientBaseShape`
- [ ] Build do backend sem erros: `npm run build` ou equivalente
- [ ] Build do frontend sem erros
- [ ] Smoke test Deploy 1 (Seção 8.3) — todos os 6 itens PASS
- [ ] Deploy 1 em staging
- [ ] Smoke test pós-deploy em staging — PASS
- [ ] Deploy 1 em produção
- [ ] Smoke test pós-deploy em produção — PASS

### Fase 2 — Campos e-SUS Patient (PR 2 — Deploy 2)
- [ ] Executar queries de levantamento `sexAtBirth`, `maritalStatus`, `genderIdentity` em staging (Seção 8.1)
- [ ] Registrar todos os valores distintos de `maritalStatus` e criar script de normalização
- [ ] Registrar todos os valores distintos de `genderIdentity` e criar script de normalização
- [ ] Executar script de normalização de `maritalStatus` em staging — verificar resultado
- [ ] Executar script de normalização de `genderIdentity` em staging — verificar resultado
- [ ] F2-01: Adicionar `racaCor` (shadow), `etnia`, `nacionalidade`, `municipioNascimentoIbge`, `paisNascimentoCnes`, `situacaoMercadoTrabalho`, `rendaFamiliar`, `responsavelFamiliar` ao schema
- [ ] F2-02: Converter `sexAtBirth` para `z.enum(['M','F','I'])` no `PatientBaseShape` e `PatientUpdateSchema`
- [ ] F2-03: Normalizar `maritalStatus` para enum `EstadoCivil` no schema
- [ ] F2-04: Normalizar `genderIdentity` para enum `IdentidadeGenero`; reclassificar como SPECIAL_CATEGORY
- [ ] F2-05: Implementar `cnsResponsavel` com AES-256-GCM + HMAC — **não mergear sem este item**
- [ ] F2-06: Adicionar endereço estruturado canônico ao schema (`logradouro`, `numero`, `complemento`, `bairro`, `cep`, `municipioIbge`, `uf`, `tipoLogradouroCnes`)
- [ ] F2-07: Adicionar comentário `@deprecated` em `cnsCpf` e warning no handler de derivação
- [ ] F2-08: Atualizar `anonymizePatientBundle` para `racaCor`, `etnia`, `genderIdentity`
- [ ] D-PRE-07: Validação de enums concluída com equipe clínica — valores confirmados
- [ ] Build backend + frontend sem erros
- [ ] Smoke test Deploy 2 (Seção 8.3) — todos os itens PASS
- [ ] Executar script de normalização de `maritalStatus` em produção — verificar resultado
- [ ] Executar script de normalização de `genderIdentity` em produção — verificar resultado
- [ ] Deploy 2 em produção
- [ ] Smoke test pós-deploy em produção — PASS

### Fase 3 — Migrations DDL (Janela de Manutenção)
- [ ] Tirar snapshot RDS em staging antes de executar migrations
- [ ] Executar query de CNES duplicados (Seção 8.1) — resultado = 0 linhas
- [ ] Executar query de CNS duplicados (Seção 8.1) — resultado = 0 linhas
- [ ] Registrar COUNT(*) baseline: `app_patients`, `app_units`, `app_users`
- [ ] F3-01: Criar e executar migration 013 em staging — verificar idempotência (executar 2x)
- [ ] F3-02: Criar e executar migration 014 em staging — verificar idempotência (executar 2x)
- [ ] F3-03: Criar e executar migration 012 em staging — verificar idempotência (executar 2x)
- [ ] Verificar COUNT(*) pós-migration = baseline em todas as tabelas
- [ ] Tirar snapshot RDS em produção antes de aplicar
- [ ] Executar migrations 013 → 014 → 012 em produção durante janela de manutenção
- [ ] Verificar COUNT(*) pós-migration em produção = baseline
- [ ] Smoke test: SELECT column_name FROM information_schema.columns para cada coluna nova

### Fase 4 — Professional + Team + Unit (PR 3 — Deploy 3)
- [ ] D-PRE-01 respondida (CNES oficial disponível)
- [ ] D-PRE-02 respondida (INE disponível)
- [ ] D-PRE-06 respondida (decisão AES para `cnsProfissional`)
- [ ] F4-01: Adicionar `cnsProfissional` ao `RegisterSchema` e `MePatchSchema`; handler `PATCH /me` persiste; handler `POST /users` inclui
- [ ] F4-02: Adicionar `cboCodigo` e `cboDescricao` aos schemas de usuário e handler
- [ ] F4-03: Atualizar `buildUserAuditSnapshot` com `cnsProfissional` como hash SHA-256
- [ ] F4-04: Expor `cnes` e `tipoUnidade` em schema de unidade e handlers
- [ ] F4-05: Adicionar `ine` e `tipoEquipe` ao schema de equipe e handlers
- [ ] F4-06: Inserir CNES real da UBS-001 via script de seed em staging e produção
- [ ] Build sem erros
- [ ] Smoke test Deploy 3 (Seção 8.3) — todos os itens PASS
- [ ] Deploy 3 em produção
- [ ] Smoke test pós-deploy em produção — PASS

### Fase 5 — Entidade Household (PR 4 — Deploy 4)
- [ ] F5-01: Criar migration 015 `CREATE TABLE app_households`; testar idempotência em staging
- [ ] Tirar snapshot RDS em staging; executar migration 015 em staging
- [ ] F5-02: Criar `HouseholdSchema` com todos os campos e enums da Seção 5 do esus-data-model-v1.md
- [ ] F5-03: Implementar extração interna no handler `PATCH /patients/:id` usando transação DB
- [ ] F5-04: Emitir eventos `household.created` e `household.updated` no handler
- [ ] F5-05: Verificar permissões de Household por role; gestor não recebe campos SENSITIVE via GET /patients
- [ ] Build sem erros
- [ ] Smoke test Deploy 4 (Seção 8.3) — todos os itens PASS
- [ ] Tirar snapshot RDS em produção; executar migration 015 em produção
- [ ] Deploy 4 em produção
- [ ] Smoke test pós-deploy em produção — PASS

### Fase 6 — RBAC ACS (PR 5 — Deploy 5 — Janela de Manutenção)
- [ ] D-PRE-03 executada com resultado `sem_acs = 0`; registrar evidência
- [ ] D-PRE-04 concluída; gestores UBS-001 alinhados; registrar confirmação
- [ ] Executar todas as queries de pré-condição da Seção 8.1 (bloco ANTES DA FASE 6)
- [ ] F6-01: Implementar branch ACS em `getAllowedPatients` (`patients.js` ~linha 309)
- [ ] F6-02: Implementar verificação `assignedAcsId` em `canAccessPatient` (`patients.js` ~linha 278)
- [ ] F6-03: Adicionar `"tasks.write"` ao array `acs` em `helpers.js:111`
- [ ] F6-04: Emitir evento `patient.acs_access_denied` em `getPatientOrError`
- [ ] F6-05: Emitir evento `task.created` para ACS no handler de tasks
- [ ] Verificar que M-08 e M-09 implementados juntos (nunca um sem o outro)
- [ ] Build sem erros
- [ ] Smoke test Deploy 5 (Seção 8.3) — todos os itens PASS
- [ ] CRC-02 aprovado em staging
- [ ] CRC-05 aprovado em staging
- [ ] Deploy 5 em produção durante janela de manutenção
- [ ] Smoke test pós-deploy em produção — PASS
- [ ] Verificar que ACS em produção acessa apenas seus pacientes

### Fase 7 — Auditoria + Mascaramento LGPD (PR 6 — Deploy 6)
- [ ] F7-01: Atualizar `buildPatientAuditSnapshot` com hash SHA-256 para `cpf` e `cns`; mascaramento de `phone`; `[REDACTED-SPECIAL-CATEGORY]` para `genderIdentity`
- [ ] F7-02: Atualizar middleware de auditoria para `racaCor`, `etnia`, `genderIdentity`
- [ ] F7-03: Implementar mascaramento em GET /patients para role `gestor`
- [ ] F7-04: Atualizar `buildUserAuditSnapshot` para `cnsProfissional` como hash SHA-256
- [ ] F7-05: Verificar e atualizar `anonymizePatientBundle` para todos os campos SENSITIVE/SPECIAL_CATEGORY de Sprint 5A
- [ ] Build sem erros
- [ ] CRC-03 aprovado em staging
- [ ] CRC-04 aprovado em staging
- [ ] Smoke test Deploy 6 (Seção 8.3) — todos os itens PASS
- [ ] Testes LGPD/RBAC da Seção 8.5 — todos PASS
- [ ] Deploy 6 em produção
- [ ] Smoke test pós-deploy em produção — PASS

### Fase 8 — KI-02 Jurídico
- [ ] F8-01: E-mail formal ao DPO enviado no Dia 1 — registrar em `docs/lgpd/ki-02-escalate.md`
- [ ] F8-02: Decisão formal do DPO documentada em `docs/lgpd/` com data, base legal e assinatura
- [ ] F8-03: `PrivacyRequestCreateSchema` atualizado para bloquear `type: "deletion"` com 503 até KI-02 resolvido
- [ ] F8-04: Mecanismo de anonimização implementado conforme decisão de F8-02 (após decisão)
- [ ] F8-05: RIPD atualizado para incluir `racaCor`, `genderIdentity`, `cnsResponsavel`, Household; assinado bilateralmente

### Gate Final — Merge para Produção
- [ ] Todos os smoke tests de Deploy 1 a 6 PASS em produção
- [ ] CRC-01 a CRC-05 PASS em produção ou staging com dados representativos
- [ ] Todos os testes LGPD/RBAC da Seção 8.5 PASS
- [ ] `cnsResponsavel` com AES-256-GCM + HMAC confirmado
- [ ] `anonymizePatientBundle` cobre todos os campos Sprint 5A SENSITIVE e SPECIAL_CATEGORY
- [ ] RIPD assinado bilateralmente (D-PRE-08) — evidência arquivada
- [ ] KI-02 resolvido com decisão formal documentada
- [ ] Nenhum dado clínico existente alterado ou excluído (COUNT(*) pré = pós em todas as tabelas)
- [ ] PR aprovado por pelo menos um revisor com foco em segurança de dados e multi-tenant
- [ ] Instrumentos jurídicos com CNES preenchido (não mais `[CNES_PENDENTE]`)
