# e-SUS Data Model v1 — VITRAS

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Data | 2026-06-10 |
| Status | CONGELADO — aprovado QA (GO CONDICIONADO resolvido 2026-06-10) |
| Baseline | v1.0-pilot-governed (commit d20add9) |
| Autor | Tech Lead / Delivery Governor |
| Próxima revisão | Após Sprint 5A completa |

---

## 1. Objetivo

Este documento define o modelo canônico de dados e-SUS do VITRAS, versão 1. Serve como contrato único de referência para:

- Implementação das sprints de conformidade e-SUS (5A, 5B, 6+)
- Validação de schema Zod no backend
- Geração de migrations seguras e idempotentes
- Classificação LGPD de todos os campos
- Mapeamento para as fichas CDS v3.2 do e-SUS (Ficha de Cadastro Individual e Ficha de Visita Domiciliar)
- Revisão de permissões por role e por entidade

Qualquer desenvolvedor deve conseguir implementar as sprints e-SUS sem precisar redefinir campos, enums, permissões ou classificações LGPD a partir da leitura deste documento.

Escopo do piloto: **UBS-001 — Ribeirão Preto-SP** (município IBGE `3534401`). Modelo multi-municipality está planejado para Sprint 5B.

---

## 2. Convenções

### 2.1 Naming Convention

| Contexto | Convenção | Exemplo |
|---|---|---|
| Colunas DDL (shadow tables) | snake_case | `race_color`, `birth_date` |
| Campos JSONB / schemas Zod / API | camelCase | `racaCor`, `birthDate` |
| Frontend | camelCase | `racaCor`, `sexAtBirth` |
| Valores de enum | UPPER_SNAKE_CASE | `BRANCA`, `SEM_ESCOLARIDADE` |
| Datas | ISO 8601 string | `YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm:ssZ` |
| UUIDs | v4, gerados pelo backend | Nunca pelo cliente |
| Boolean fields | Sem prefixo obrigatório is/has | `inactive`, `incompleteProfile`, `coletaLixo`, `energiaEletrica` |
| Null/undefined | Campos opcionais são undefined/null | Não usar string vazia como substituto de null |

### 2.2 Regras de Sprint

- **Sprint 5A**: campos marcados como `Sprint 5A` são obrigatórios para fechamento da sprint. Entram se: campo é obrigatório para que a ficha não seja rejeitada no SISAB, e não requer tabela de referência com mais de 1.000 registros, integração externa, ou nova capability de RBAC.
- **Sprint 5B**: campos marcados `Sprint 5B` não entram em migrations de 5A. Data alvo: D+60 após piloto UBS-001.
- **Sprint 6+**: fora do escopo do piloto UBS-001. Inclui SIGTAP, Território GIS, RNDS, SISREG, PEC.

### 2.3 Critério de Shadow Column

Campos novos em Sprint 5A sem alta probabilidade de uso em query SQL direta vão para JSONB. Shadow columns são criadas apenas para campos com alta probabilidade de filtro ou busca:

- `racaCor` (filtro de indicadores SISAB)
- `situacaoRua` (boolean — busca ativa)
- `cnes` em app_units (lookup/validação)
- `cns` em app_users (autenticação complementar)

---

## 3. Domínio: Patient

Tabela base: JSONB na tabela principal de pacientes (`app_patients` ou equivalente). O `id` é UUID v4 gerado pelo backend.

### 3.1 Campos Existentes

| Campo | Tipo Zod | Tipo SQL (shadow) | Obrigatório | e-SUS CDS | LGPD | Sprint | Observação |
|---|---|---|---|---|---|---|---|
| `id` | `string` (UUID) | `uuid PRIMARY KEY` | Gerado | — | INTERNAL | Existente | Gerado pelo backend |
| `name` | `string, min(1), max(300)` | — | Sim | nomeCidadao | INTERNAL | Existente | |
| `motherName` | `string?, max(300)` | — | Não | nomeMae | INTERNAL | Existente | |
| `motherUnknown` | `boolean?` | — | Não | desconheceNomeMae | INTERNAL | 5A | Estava em silent data loss; passa a ser aceito |
| `guardianName` | `string?, max(300)` | — | Não | nomeResponsavel | INTERNAL | Existente | Declarado no schema; o modal nunca envia — BUG ATIVO no frontend |
| `phone` | `string, min(1), max(30)` | — | Sim (Create) | telefoneCelular | INTERNAL | Existente | |
| `phoneAlt` | `string?, max(30)` | — | Não | telefoneResidencial | INTERNAL | Existente | |
| `cpf` | `string?, max(20)` | — | Não | cpf | SENSITIVE | Existente | AES-256-GCM + HMAC implementado |
| `cns` | `string?, max(30)` | — | Não | cns | SENSITIVE | Existente | AES-256-GCM + HMAC implementado |
| `cnsCpf` | `string?, max(30)` | — | Não | — | SENSITIVE | Existente | Campo híbrido derivado; sem paralelo e-SUS — candidato a obsolescência (ver Seção 19) |
| `addressLegacy` | `string?, max(500)` | — | Não | — | INTERNAL | Existente | Renomeado de `address`; campo livre legado; manter; UI exibe quando endereço estruturado está vazio |
| `microArea` | `string?, max(100)` | `micro_area` (shadow) | Não | microArea | INTERNAL | Existente | |
| `assignedAcsId` | `string?, max(100)` | — | Não | — | INTERNAL | Existente | FK soft para `app_users.id` com `role = acs` |
| `teamId` | `string?, max(100)` | — | Não (derivado do user) | — | INTERNAL | Existente | **Instrução Sprint 5A:** remover do `PatientBaseShape` ou garantir que `PatientUpdateSchema` o exclua explicitamente. O `teamId` NÃO pode ser alterado pelo cliente via PATCH — é definido no cadastro inicial (derivado de `req.user.teamId`) e alterável apenas por admin/gestor via endpoint dedicado. Adicionar nota de restrição no UpdateSchema em vez de simplesmente herdar do BaseShape. |
| `unitId` | `string?` | — | Não (gerado) | — | INTERNAL | Existente | Derivado do user autenticado |
| `municipalityId` | `string?` | — | Não (gerado) | — | INTERNAL | Existente | Hardcoded `'3534401'` como fallback — ver Seção 19 |
| `careCategory` | `string?, max(100)` | — | Não | — | INTERNAL | Existente | |
| `chronicConditions` | `string[]?` | — | Não | — | SENSITIVE | Existente | |
| `maritalStatus` | `string?, max(50)` | — | Não | estadoCivil | INTERNAL | Existente | String livre sem enum — normalizar com enum `EstadoCivil` em 5A (Seção 15.24) |
| `incompleteProfile` | `boolean?` | — | Não | — | INTERNAL | Existente | |
| `inactive` | `boolean?` | — | Não | — | INTERNAL | Existente | |
| `inactivationReason` | `string?, max(1000)` | — | Não | — | INTERNAL | Existente | |
| `inactivatedBy` | `string?, max(200)` | — | Não | — | INTERNAL | Existente | |
| `inactivatedAt` | `string?, max(50)` | — | Não | — | INTERNAL | Existente | ISO 8601 |
| `sexAtBirth` | `z.enum(['M','F','I'])?` | — | Não | sexo | INTERNAL | 5A (refactor) | Hoje: string livre sem enum — BUG: frontend envia `sex` em vez de `sexAtBirth`; corrigir mapeamento em Sprint 5A; enum fixo M/F/I (Seção 15.19) |
| `genderIdentity` | `z.enum([...])?` | — | Não | identidadeGenero | SPECIAL_CATEGORY | 5A (reclassificar) | Já existe; reclassificar como SPECIAL_CATEGORY; enum `IdentidadeGenero` (Seção 15.7); mascarar em audit logs |
| `birthDate` | `string?, max(50)` | — | Não | dataNascimento | INTERNAL | Existente | ISO 8601 YYYY-MM-DD |
| `pregnancyStartDate` | `string?, max(50)` | — | Não | — | INTERNAL | Existente | |
| `expectedDeliveryDate` | `string?, max(50)` | — | Não | — | INTERNAL | Existente | |
| `gestationalAgeDumWeeks` | `union(string, number)?` | — | Não | — | INTERNAL | Existente | |
| `gestationalAgeDumDays` | `union(string, number)?` | — | Não | — | INTERNAL | Existente | |
| `gestationalAgeUsgWeeks` | `union(string, number)?` | — | Não | — | INTERNAL | Existente | |
| `gestationalAgeUsgDays` | `union(string, number)?` | — | Não | — | INTERNAL | Existente | |
| `usgDate1` | `string?` | — | Não | — | INTERNAL | Existente | |
| `usgDate2` | `string?` | — | Não | — | INTERNAL | Existente | |
| `usgDate3` | `string?` | — | Não | — | INTERNAL | Existente | |
| `prenatalStartDate` | `string?` | — | Não | — | INTERNAL | Existente | |
| `postpartumStartDate` | `string?` | — | Não | — | INTERNAL | Existente | |
| `comorbidities` | `string?, max(4000)` | — | Não | — | SENSITIVE | Existente | |
| `medications` | `string?, max(4000)` | — | Não | — | SENSITIVE | Existente | |
| `allergies` | `string?, max(4000)` | — | Não | — | SENSITIVE | Existente | |
| `createdAt` | `string` (ISO 8601) | `created_at` | Gerado | — | INTERNAL | Existente | Gerado pelo backend |
| `createdBy` | `string` (UUID) | — | Gerado | — | INTERNAL | Existente | |
| `updatedAt` | `string` (ISO 8601) | `updated_at` | Gerado | — | INTERNAL | Existente | |
| `updatedBy` | `string` (UUID) | — | Gerado | — | INTERNAL | Existente | |
| `privacy` | `object` | — | Gerado | — | INTERNAL | Existente | Objeto de anonimização gerado pelo backend |

### 3.2 Campos Novos Sprint 5A — Patient

| Campo | Tipo Zod | Tipo SQL (shadow) | Obrigatório | e-SUS CDS | LGPD | Sprint | Observação |
|---|---|---|---|---|---|---|---|
| `racaCor` | `z.enum(['BRANCA','PRETA','PARDA','AMARELA','INDIGENA'])?` | `race_color varchar(20)` | Não (recomendado) | racaCor | SPECIAL_CATEGORY | 5A | Obrigatório pelo SISAB; Portaria MS 1.654/2011; shadow column para filtros de indicadores; mascarar em listagens GET /patients para gestor |
| `etnia` | `string?, max(100)` | — | Condicional | etnia | SPECIAL_CATEGORY | 5A | Obrigatório somente quando `racaCor = INDIGENA`; validação condicional no schema Zod |
| `nacionalidade` | `z.enum(['BRASILEIRA','NATURALIZADA','ESTRANGEIRA'])?` | — | Não | nacionalidade | INTERNAL | 5A | Enum Seção 15.20 |
| `municipioNascimentoIbge` | `string?, max(7), regex(/^\d{7}$/)` | — | Não | municipioNascimento | INTERNAL | 5A | Código IBGE 7 dígitos |
| `paisNascimentoCnes` | `string?, max(6)` | — | Não | paisNascimento | INTERNAL | 5A | Código CNES de país |
| `escolaridade` | `z.enum([...])?` | — | Não | escolaridade | INTERNAL | 5A | Enum `Escolaridade` (Seção 15.2) |
| `situacaoMercadoTrabalho` | `z.enum([...])?` | — | Não | situacaoMercadoTrabalho | INTERNAL | 5A | Enum `SituacaoMercadoTrabalho` (Seção 15.3) |
| `rendaFamiliar` | `z.enum([...])?` | — | Não | rendaFamiliar | SENSITIVE | 5A | Enum `RendaFamiliar` (Seção 15.21) |
| `responsavelFamiliar` | `boolean?` | — | Não | responsavelFamiliar | INTERNAL | 5A | Se true, este paciente é o responsável pelo grupo familiar |
| `cnsResponsavel` | `string?, max(30)` | — | Não | cnsResponsavel | SENSITIVE | 5A | CNS do responsável familiar; AES-256-GCM + HMAC obrigatório — BLOQUEADOR LGPD (ver Seção 16) |

### 3.3 Campos de Silent Data Loss — Aceitos pelo Schema em Sprint 5A (JSONB only)

Estes campos eram enviados pelo frontend (`usePatientModal.js`) mas descartados pelo backend por ausência no schema. Em Sprint 5A, passam a ser aceitos no JSONB. Nenhum recebe shadow column neste momento.

| Campo | Tipo Zod | Obrigatório | e-SUS CDS | LGPD | Sprint | Observação |
|---|---|---|---|---|---|---|
| `familyCode` | `string?, max(50)` | Não | codigoFamiliar | INTERNAL | 5A | Código da família no e-SUS |
| `homeVisitFreq` | `string?, max(50)` | Não | — | INTERNAL | 5A | Frequência de visita domiciliar preferida |
| `occupation` | `string?, max(200)` | Não | ocupacao | INTERNAL | 5A | Ocupação/profissão |
| `familySituation` | `string?, max(200)` | Não | situacaoFamiliar | INTERNAL | 5A | |
| `familySupport` | `string?, max(500)` | Não | — | INTERNAL | 5A | |
| `socialVulnerability` | `string?, max(500)` | Não | — | SENSITIVE | 5A | |
| `socialBenefit` | `string?, max(500)` | Não | beneficiosSociais | SENSITIVE | 5A | Registrado como string livre em 5A; enum em 5B |
| `substanceDependency` | `string?, max(500)` | Não | — | SENSITIVE | 5A | |
| `domesticViolence` | `string?, max(500)` | Não | — | SENSITIVE | 5A | Dado altamente sensível; acesso restrito a role clínico |

### 3.4 Bug Ativo: `sex` vs. `sexAtBirth`

(Ver Seção 3.5 e 3.6 para bugs análogos com `raceColor`/`racaCor` e `educationLevel`/`escolaridade`)

O frontend (`usePatientModal.js`, linha 132) envia o campo com chave `sex`. O schema e o backend esperam `sexAtBirth`. O dado é descartado silenciosamente.

Correção obrigatória em Sprint 5A:
1. Backend: aceitar `sex` como alias de `sexAtBirth` no schema (`.transform()` no Zod) ou corrigir o frontend.
2. Recomendado: corrigir o frontend para enviar `sexAtBirth`; remover alias após deploy.
3. Ao mesmo tempo, converter de string livre para enum fixo `['M', 'F', 'I']`.

### 3.5 Bug Ativo: `raceColor` (frontend) vs. `racaCor` (canônico)

O frontend (`usePatientModal.js`, linha 31) inicializa o campo como `raceColor` e o payload (linha 132) o envia como `raceColor: form.raceColor` (camelCase inglês). O schema backend canonical é `racaCor` (camelCase português, alinhado ao e-SUS CDS). O dado é descartado silenciosamente — se Sprint 5A adicionar `racaCor` ao schema sem alias, o frontend continuará enviando `raceColor` e nada será persistido.

Correção obrigatória em Sprint 5A:
1. No `PatientBaseShape`, adicionar alias via `.transform()` no Zod: se o payload contém `raceColor`, mapear para `racaCor` internamente.
2. Recomendado: corrigir o frontend para enviar `racaCor`; remover alias após deploy.
3. Sequência segura: backend com alias → deploy backend → atualizar frontend → validar → remover alias.

### 3.6 Bug Ativo: `educationLevel` (frontend) vs. `escolaridade` (canônico)

O frontend (`usePatientModal.js`, linha 53) inicializa `educationLevel` e o payload (linha 143) envia `educationLevel: form.educationLevel`. O campo canônico e-SUS é `escolaridade` com enum `Escolaridade` (Seção 15.2). Sem alias, adicionar `escolaridade` ao schema não persiste o dado enviado pelo frontend.

Correção obrigatória em Sprint 5A (mesmo mecanismo de `sex`/`sexAtBirth`):
1. No `PatientBaseShape`, adicionar alias via `.transform()`: se payload contém `educationLevel` string, mapear para `escolaridade` internamente.
2. Aplicar validação enum na saída do `.transform()`.
3. Corrigir o frontend para enviar `escolaridade` com enum canônico; remover alias após validação.

---

## 4. Domínio: Address (Endereço Estruturado)

Endereço estruturado é adicionado como campos do Patient em Sprint 5A. Não é uma tabela separada. A entidade Household (Seção 5) é distinta e separada.

`addressLegacy` (antigo campo `address`) é mantido. A UI exibe `addressLegacy` quando os campos estruturados estiverem vazios. Os campos estruturados não substituem o legado — são adicionados progressivamente.

### 4.1 Campos Sprint 5A — Endereço Estruturado no Patient

| Campo | Tipo Zod | Tipo SQL (shadow) | Obrigatório | e-SUS CDS | LGPD | Sprint | Observação |
|---|---|---|---|---|---|---|---|
| `logradouro` | `string?, max(250)` | — | Não | logradouro | INTERNAL | 5A | Nome da rua/avenida |
| `numero` | `string?, max(30)` | — | Não | numero | INTERNAL | 5A | Número do imóvel; string por aceitar 'S/N' |
| `complemento` | `string?, max(100)` | — | Não | complemento | INTERNAL | 5A | |
| `bairro` | `string?, max(100)` | — | Não | bairro | INTERNAL | 5A | |
| `cep` | `string?, max(8), regex(/^\d{8}$/)` | — | Não | cep | INTERNAL | 5A | Apenas dígitos, sem hífen |
| `municipioIbge` | `string?, max(7), regex(/^\d{7}$/)` | — | Não | municipioIbge | INTERNAL | 5A | Código IBGE 7 dígitos |
| `uf` | `string?, max(2)` | — | Não | uf | INTERNAL | 5A | Sigla UF em maiúsculas |
| `tipoLogradouroCnes` | `string?, max(10)` | — | Não | tipoLogradouro | INTERNAL | 5A | Enum `TipoLogradouroCnes` (Seção 15.18) |

Os campos `zipCode`, `number`, `complement`, `neighborhood`, `city`, `state` enviados pelo frontend são mapeados para os campos canônicos acima via transform no schema Zod ou renomeação no frontend em Sprint 5A.

---

## 5. Domínio: Household (Cadastro Domiciliar)

Household é uma entidade **separada** do Patient e do Address estruturado. Representa o domicílio, não o endereço postal do paciente. A ficha correspondente no e-SUS é a **Ficha de Cadastro Domiciliar e Territorial CDS**.

Armazenamento: tabela dedicada (a ser criada em migration Sprint 5A) ou JSONB separado. FK: `patientId` (responsável familiar do domicílio), `teamId`.

Um domicílio pode ter múltiplos moradores. O `patientId` referencia o responsável familiar (`responsavelFamiliar = true`).

### 5.1 Campos Sprint 5A — Household

| Campo | Tipo Zod | Tipo SQL | Obrigatório | e-SUS CDS | LGPD | Sprint | Observação |
|---|---|---|---|---|---|---|---|
| `id` | `string` (UUID) | `uuid PRIMARY KEY` | Gerado | — | INTERNAL | 5A | |
| `patientId` | `string` (UUID) | `varchar FK soft` | Sim | — | INTERNAL | 5A | Responsável familiar do domicílio |
| `teamId` | `string` (UUID) | `varchar FK soft` | Sim | — | INTERNAL | 5A | Equipe responsável pelo território |
| `tipoImovel` | `z.enum([...])` | `varchar(30)` | Sim | tipoImovel | INTERNAL | 5A | Enum `TipoImovel` (Seção 15.12) |
| `numMoradores` | `number, int, min(0)?` | — | Não | numeroMoradores | INTERNAL | 5A | |
| `numComodos` | `number, int, min(0)?` | — | Não | numeroComodos | INTERNAL | 5A | |
| `materialPredominanteParedes` | `z.enum([...])?` | — | Não | materialPredominanteParedes | SENSITIVE | 5A | Enum `MaterialParedes` (Seção 15.13); dado que, em conjunto com outros do Household, compõe perfil socioeconômico sensível |
| `abastecimentoAgua` | `z.enum([...])?` | — | Não | abastecimentoAgua | INTERNAL | 5A | Enum `AbastecimentoAgua` (Seção 15.14) |
| `tratamentoAgua` | `z.enum([...])?` | — | Não | tratamentoAgua | INTERNAL | 5A | Enum `TratamentoAgua` (Seção 15.15) |
| `esgotamento` | `z.enum([...])?` | — | Não | esgotamento | INTERNAL | 5A | Enum `Esgotamento` (Seção 15.16) |
| `coletaLixo` | `boolean?` | — | Não | coletaLixo | INTERNAL | 5A | |
| `destinacaoLixo` | `z.enum([...])?` | — | Não | destinacaoLixo | INTERNAL | 5A | Enum `DestinoLixo` (Seção 15.17); aplicável quando `coletaLixo = false` |
| `energiaEletrica` | `boolean?` | — | Não | energiaEletrica | INTERNAL | 5A | |
| `localizacao` | `z.enum(['URBANA','RURAL'])?` | — | Não | localizacao | INTERNAL | 5A | Enum `Localizacao` (Seção 15.25) |
| `createdAt` | `string` (ISO 8601) | `created_at` | Gerado | — | INTERNAL | 5A | |
| `updatedAt` | `string` (ISO 8601) | `updated_at` | Gerado | — | INTERNAL | 5A | |

> LGPD: o conjunto de campos do Household (materialParedes + esgotamento + rendaFamiliar) compõe um perfil socioeconômico classificado como SENSITIVE. Campos individualmente são INTERNAL, mas tratados como conjunto SENSITIVE.

---

## 6. Domínio: Family (Grupo Familiar)

**Sprint 5B** — não há tabela Family em Sprint 5A.

Em Sprint 5A, o vínculo familiar é representado apenas pelos seguintes campos no Patient:

- `responsavelFamiliar` (boolean) — indica se o paciente é responsável do grupo familiar
- `cnsResponsavel` (string) — CNS do responsável familiar, quando o paciente não é o responsável
- `familyCode` (string) — código do grupo familiar no e-SUS (JSONB)

Em Sprint 5B, será criada a entidade `Family` (grupo familiar) com:
- `id` (UUID)
- `familyCode` (string, único por equipe)
- `responsavelPatientId` (UUID, FK soft para Patient)
- `teamId` (UUID, FK soft para Team)
- Relação 1:N com Patient

---

## 7. Domínio: ACS (Agente Comunitário de Saúde)

O ACS não tem tabela própria. É um usuário (`app_users`) com `role = 'acs'`.

### 7.1 Campos relevantes em app_users para o ACS

| Campo | Descrição |
|---|---|
| `id` | UUID do usuário ACS |
| `name` | Nome completo |
| `teamId` | Equipe de saúde à qual pertence |
| `microArea` | Microárea de atuação (se implementado como campo em app_users) |

### 7.2 Campos relevantes no Patient para ACS

| Campo | Descrição |
|---|---|
| `assignedAcsId` | FK soft para `app_users.id` do ACS responsável pelo paciente |
| `microArea` | Microárea do paciente (shadow column `micro_area`) |

### 7.3 Restrição de Acesso

ACS enxerga **apenas** pacientes com `assignedAcsId = seu próprio id`. Esta restrição é aplicada em `getAllowedPatients` no backend. Risco documentado: exclusão de um usuário ACS deixa `assignedAcsId` inválido nos pacientes — mitigar em Sprint 5A com verificação na query de `getAllowedPatients` (plano existente).

---

## 8. Domínio: Professional (Profissional de Saúde)

Tabela: `app_users`. Profissionais de saúde são usuários com roles clínicos (`medico`, `enfermeiro`, `tecnico_enfermagem`, `farmaceutico`, etc.).

### 8.1 Campos Existentes em app_users

| Campo | Tipo | Obrigatório | LGPD | Observação |
|---|---|---|---|---|
| `id` | UUID | Gerado | INTERNAL | |
| `name` | string | Sim | INTERNAL | |
| `email` | string | Sim | INTERNAL | |
| `role` | string (enum) | Sim | INTERNAL | Roles definidos no sistema de permissões |
| `teamId` | string? | Não | INTERNAL | |
| `unitId` | string? | Não | INTERNAL | |
| `councilNumber` | string? | Não | INTERNAL | Número do conselho profissional (CRM, COREN) |
| `councilUf` | string? | Não | INTERNAL | UF do conselho |
| `councilType` | string? | Gerado | INTERNAL | Derivado de `role`: CRM para médico, COREN para enfermeiro |
| `councilVerification` | object? | Não | INTERNAL | Resultado de verificação do conselho |
| `twoFactorEnabled` | boolean | Gerado (false) | INTERNAL | |
| `createdAt` | string (ISO 8601) | Gerado | INTERNAL | |

### 8.2 Campos Novos Sprint 5A em app_users

| Campo | Tipo Zod | Tipo SQL (shadow) | Obrigatório | e-SUS CDS | LGPD | Sprint | Observação |
|---|---|---|---|---|---|---|---|
| `cnsProfissional` | `string?, max(15), regex(/^\d{15}$/)` | `cns varchar(20)` | Não | cnsProfissional | SENSITIVE | 5A | Migration 014; recomendado AES-256-GCM — validar com jurídico antes do merge |
| `cboCodigo` | `string?, max(6), regex(/^\d{6}$/)` | — (JSONB) | Não | cboCodigo | PUBLIC | 5A | Código CBO (Classificação Brasileira de Ocupações) |
| `cboDescricao` | `string?, max(100)` | — (JSONB) | Não | cboDescricao | PUBLIC | 5A | Descrição derivada de `cboCodigo`; pode ser resolvida via lookup local |

---

## 9. Domínio: Team (Equipe de Saúde)

Atualmente: JSONB in-memory sem tabela SQL dedicada. Em Sprint 5A, campos INE e tipoEquipe devem ser persistidos para conformidade e-SUS.

### 9.1 Campos Sprint 5A — Team

| Campo | Tipo Zod | Tipo SQL | Obrigatório | e-SUS CDS | LGPD | Sprint | Observação |
|---|---|---|---|---|---|---|---|
| `id` | `string` (UUID) | `uuid PRIMARY KEY` | Gerado | — | INTERNAL | 5A | |
| `name` | `string, max(200)` | `varchar(200)` | Sim | nomeEquipe | INTERNAL | 5A | |
| `teamId` | `string, max(100)` | `varchar(100)` | Sim | — | INTERNAL | 5A | Identificador legado (pode ser alias de `id`) |
| `unitId` | `string` (UUID) | `varchar FK soft` | Sim | — | INTERNAL | 5A | Unidade à qual a equipe pertence |
| `ine` | `string, max(10), regex(/^\d{10}$/)` | `ine varchar(10)` | Sim | ine | PUBLIC | 5A | Identificador Nacional de Equipes; obrigatório e-SUS; 10 dígitos |
| `tipoEquipe` | `z.enum([...])` | `varchar(10)` | Sim | tipoEquipe | PUBLIC | 5A | Enum `TipoEquipe` (Seção 15.22) |
| `areaAtuacao` | `string?, max(200)` | — | Não | area | INTERNAL | 5A | Descrição da área de atuação territorial |

---

## 10. Domínio: Unit (Unidade de Saúde)

Tabela: `app_units`.

### 10.1 Campos Existentes e Novos Sprint 5A

| Campo | Tipo Zod | Tipo SQL | Obrigatório | e-SUS CDS | LGPD | Sprint | Observação |
|---|---|---|---|---|---|---|---|
| `id` | `string` (UUID) | `uuid PRIMARY KEY` | Gerado | — | INTERNAL | Existente | |
| `name` | `string` | `varchar(200)` | Sim | nomeUnidade | INTERNAL | Existente | |
| `municipalityId` | `string?` | `varchar(10)` | Não | — | INTERNAL | Existente | Hardcoded `'3534401'` como fallback |
| `cnes` | `string?, max(7), regex(/^\d{7}$/)` | `cnes varchar(7)` | Não (recomendado) | cnes | PUBLIC | 5A | Migration 013; UNIQUE partial index (WHERE cnes IS NOT NULL AND cnes != ''); obrigatório para exportação SISAB |
| `tipoUnidade` | `z.enum([...])` | — (JSONB) | Não | tipoUnidade | PUBLIC | 5A | Enum `TipoUnidade` (Seção 15.23) |

---

## 11. Domínio: Municipality (Município)

**Sprint 5B** — sem tabela de municípios em Sprint 5A.

`municipalityId` `'3534401'` (Ribeirão Preto-SP) é o único valor suportado no piloto UBS-001. Este valor está hardcoded em:
- Migration 010
- `patients.js` linha 156 (fallback)

`municipioIbge` em campos de Patient/Address é `string(7)` no formato IBGE (ex.: `3534401`). Não referencia tabela em Sprint 5A — validado apenas via regex.

Em Sprint 5B, será criada a tabela `municipalities` com os ~5.570 municípios brasileiros (IBGE), e `municipalityId` / `municipioIbge` passarão a ter FK verificada.

---

## 12. Domínio: Visit (Visita Domiciliar ACS)

Armazenado como `app_clinical_records` com `type = 'visit'`. O prontuário (clinical record) **nunca pode ter exclusão física** — regra arquitetural do sistema. Retenção mínima: 20 anos (CFM Res. 1.821/2007).

### 12.1 Campos Sprint 5A — Ficha de Visita Domiciliar

| Campo | Tipo Zod | Tipo SQL | Obrigatório | e-SUS CDS | LGPD | Sprint | Observação |
|---|---|---|---|---|---|---|---|
| `id` | `string` (UUID) | `uuid PRIMARY KEY` | Gerado | — | INTERNAL | 5A | |
| `patientId` | `string` (UUID) | `varchar FK soft` | Sim | — | INTERNAL | 5A | |
| `acsId` | `string` (UUID) | `varchar FK soft` | Sim | cnsProfissional | INTERNAL | 5A | ACS que realizou a visita |
| `teamId` | `string` (UUID) | `varchar FK soft` | Sim | — | INTERNAL | 5A | |
| `type` | `literal('visit')` | `varchar(30)` | Sim | — | INTERNAL | 5A | Discriminador do tipo de registro clínico |
| `dataVisita` | `string, regex(YYYY-MM-DD)` | — | Sim | dataVisita | INTERNAL | 5A | Data da visita; ISO 8601 |
| `turno` | `z.enum(['MANHA','TARDE','NOITE'])` | — | Sim | turno | INTERNAL | 5A | Enum `TurnoVisita` (Seção 15.10) |
| `tipoVisita` | `z.enum([...])` | — | Sim | tipoVisita | INTERNAL | 5A | Enum `TipoVisita` (Seção 15.11) |
| `motivosVisita` | `z.array(z.enum([...]))` | — | Sim | motivoVisita | SENSITIVE | 5A | Array de enum `MotivoVisita` (Seção 15.8); dado de saúde |
| `desfecho` | `z.enum(['VISITA_REALIZADA','AUSENTE','RECUSOU'])` | — | Sim | desfecho | SENSITIVE | 5A | Enum `DesfechoVisita` (Seção 15.9) |
| `microArea` | `string?, max(100)` | — | Não | microArea | INTERNAL | 5A | |
| `peso` | `number?, min(0), max(700)` | — | Não | peso | SENSITIVE | 5A | kg; dado clínico |
| `altura` | `number?, min(0), max(300)` | — | Não | altura | SENSITIVE | 5A | cm; dado clínico |
| `createdAt` | `string` (ISO 8601) | `created_at` | Gerado | — | INTERNAL | 5A | |
| `createdBy` | `string` (UUID) | — | Gerado | — | INTERNAL | 5A | |

---

## 13. Domínio: Individual Registration (Ficha Cadastro Individual e-SUS)

Mapeamento entre os campos da **Ficha de Cadastro Individual CDS v3.2** e os campos do VITRAS.

| Campo CDS v3.2 | Campo VITRAS | Status | Sprint |
|---|---|---|---|
| cnsCidadao | `cns` | Implementado (AES-256-GCM + HMAC) | Existente |
| nomeCidadao | `name` | Implementado | Existente |
| nomeMae | `motherName` | Implementado | Existente |
| desconheceNomeMae | `motherUnknown` | Silent data loss — corrigir | 5A |
| dataNascimento | `birthDate` | Implementado | Existente |
| sexo | `sexAtBirth` (enum M/F/I) | BUG: frontend envia `sex`; sem enum | 5A |
| racaCor | `racaCor` | Ausente no backend | 5A |
| etnia | `etnia` | Ausente | 5A |
| nacionalidade | `nacionalidade` | Ausente | 5A |
| municipioNascimento | `municipioNascimentoIbge` | Ausente | 5A |
| paisNascimento | `paisNascimentoCnes` | Ausente | 5A |
| escolaridade | `escolaridade` | Silent data loss (educationLevel) — renomear e adicionar enum | 5A |
| situacaoMercadoTrabalho | `situacaoMercadoTrabalho` | Ausente | 5A |
| rendaFamiliar | `rendaFamiliar` | Silent data loss | 5A |
| responsavelFamiliar | `responsavelFamiliar` | Silent data loss | 5A |
| cnsResponsavel | `cnsResponsavel` | Ausente | 5A |
| estadoCivil | `maritalStatus` (→ enum) | Implementado como string livre; normalizar | 5A |
| identidadeGenero | `genderIdentity` (→ enum) | Implementado; reclassificar SPECIAL_CATEGORY; enum padronizado | 5A |
| telefoneCelular | `phone` | Implementado | Existente |
| telefoneResidencial | `phoneAlt` | Implementado | Existente |
| logradouro | `logradouro` | Silent data loss — corrigir | 5A |
| numero | `numero` | Silent data loss (`number`) — renomear | 5A |
| complemento | `complemento` | Silent data loss (`complement`) — renomear | 5A |
| bairro | `bairro` | Silent data loss (`neighborhood`) — renomear | 5A |
| cep | `cep` | Silent data loss (`zipCode`) — renomear | 5A |
| municipioIbge | `municipioIbge` | Silent data loss (`city`) — renomear/converter | 5A |
| uf | `uf` | Silent data loss (`state`) — renomear | 5A |
| tipoLogradouro | `tipoLogradouroCnes` | Ausente | 5A |
| microArea | `microArea` | Implementado | Existente |
| codigoFamiliar | `familyCode` | Silent data loss — corrigir | 5A |
| tipoImovel | `Household.tipoImovel` | Ausente — entidade Household separada | 5A |
| numeroMoradores | `Household.numMoradores` | Ausente | 5A |
| materialPredominanteParedes | `Household.materialPredominanteParedes` | Ausente | 5A |
| abastecimentoAgua | `Household.abastecimentoAgua` | Ausente (silent data loss: `waterSupply`) | 5A |
| esgotamento | `Household.esgotamento` | Ausente (silent data loss: `sewage`) | 5A |
| destinacaoLixo | `Household.destinacaoLixo` | Ausente (silent data loss: `garbage`) | 5A |
| energiaEletrica | `Household.energiaEletrica` | Ausente (silent data loss: `electricity`) | 5A |
| localizacao | `Household.localizacao` | Ausente | 5A |
| beneficiosSociais | `socialBenefit` | Silent data loss — 5A como string; enum 5B | 5A |
| situacaoRua | — | Ausente | 5B |
| deficiencia | — | Ausente | 5B |
| orientacaoSexual | — | Ausente | 5B+ |
| insegurancaAlimentar | — | Ausente | 5B |
| nis | — | Adiado — ver Seção 18 | 5B |
| cidPrincipal | — | Fora do escopo 5A (sem tabela CID-10) | 5B |
| ciap2 | — | Fora do escopo 5A | 5B |
| cnsCidadaoResponsavel | `cnsResponsavel` | Mapeado — AES pendente | 5A |
| nomeSocial | — | **Ausente** — campo distinto de `genderIdentity` (ver Decisão 5); string livre com nome social preferido; sem sprint definida — ver Seção 18 | 5B+ |

---

## 14. Audit Events

Tabela existente: `app_audit_logs`.

### 14.1 Estrutura da Tabela

| Campo | Tipo SQL | Descrição |
|---|---|---|
| `id` | UUID PK | |
| `actor_id` | varchar | UUID do usuário que executou a ação |
| `actor_role` | varchar | Role do ator no momento da ação |
| `entity_type` | varchar | Entidade afetada (ex.: `patient`, `household`, `visit`) |
| `entity_id` | varchar | ID da entidade afetada |
| `action` | varchar | Ação executada (ex.: `CREATE`, `UPDATE`, `INACTIVATE`) |
| `snapshot_before` | JSONB | Estado anterior da entidade |
| `snapshot_after` | JSONB | Estado posterior da entidade |
| `hash` | varchar | Hash da cadeia de auditoria (v2) |
| `ip_address` | varchar | IP do ator |
| `created_at` | timestamptz | Data/hora da ação |
| `municipality_id` | varchar | Município do registro (multi-tenant) |

### 14.2 Regras LGPD para Audit Logs

**Campos SPECIAL_CATEGORY** devem aparecer como `[REDACTED-SPECIAL-CATEGORY]` em `snapshot_before` e `snapshot_after`. Campos afetados:

- `genderIdentity`
- `racaCor`
- `etnia`
- `situacaoRua` (Sprint 5B)
- `deficiencia` (Sprint 5B)
- `orientacaoSexual` (Sprint 5B+)

Esta redação deve ser aplicada no momento da gravação do audit log no backend, nunca retroativamente.

### 14.3 Retenção

- Audit logs de saúde: mínimo **5 anos** (recomendação para dados de saúde pública)
- `ip_address`: Marco Civil da Internet Art. 15 exige 6 meses; para saúde, recomendado manter 5 anos alinhado ao restante do log
- Registros clínicos (`app_clinical_records`): **20 anos** (CFM Res. 1.821/2007) — exclusão física proibida

---

## 15. Enumerações (valores canônicos e-SUS v3.2)

Todos os valores são UPPER_SNAKE_CASE. Enums são fixos — não aceitar valores fora da lista sem atualizar este documento e a migration correspondente.

### 15.1 RacaCor (Sprint 5A — obrigatório CDS)

Fonte: Portaria MS 1.654/2011, IBGE.

```
BRANCA | PRETA | PARDA | AMARELA | INDIGENA
```

### 15.2 Escolaridade (Sprint 5A — obrigatório CDS)

```
SEM_ESCOLARIDADE | FUNDAMENTAL_INCOMPLETO | FUNDAMENTAL_COMPLETO |
MEDIO_INCOMPLETO | MEDIO_COMPLETO | SUPERIOR_INCOMPLETO | SUPERIOR_COMPLETO |
ESPECIALIZACAO | MESTRADO | DOUTORADO | NAO_INFORMADO
```

### 15.3 SituacaoMercadoTrabalho (Sprint 5A — obrigatório CDS)

```
EMPREGADO_COM_CARTEIRA | EMPREGADO_SEM_CARTEIRA | AUTONOMO |
APOSENTADO_PENSIONISTA | DESEMPREGADO | NAO_TRABALHA | NAO_SE_APLICA | OUTRO
```

### 15.4 Deficiencia (Sprint 5B — SPECIAL_CATEGORY)

Enum fechado — não usar array livre.

```
SEM_DEFICIENCIA | DEFICIENCIA_AUDITIVA | DEFICIENCIA_VISUAL |
DEFICIENCIA_INTELECTUAL_COGNITIVA | DEFICIENCIA_FISICA |
DEFICIENCIA_PSICOSSOCIAL_MENTAL | OUTRA_DEFICIENCIA
```

### 15.5 InsegurancaAlimentar (Sprint 5B — SENSITIVE)

```
NAO | SIM_LEVE | SIM_MODERADA | SIM_GRAVE
```

### 15.6 OrientacaoSexual (Sprint 5B+ — SPECIAL_CATEGORY — AGUARDA DECISÃO JURÍDICA)

Não implementar antes de decisão formal do jurídico/DPO.

```
HETEROSSEXUAL | HOMOSSEXUAL | BISSEXUAL | ASSEXUAL | NAO_INFORMADO | OUTRO
```

### 15.7 IdentidadeGenero (Sprint 5A — SPECIAL_CATEGORY — campo `genderIdentity` já existe)

Alinhado ao e-SUS CDS v3.2. Distinção de `nomeSocial` — ver Seção 19, Decisão 5.

```
HOMEM_CISSGENERO | MULHER_CISSGENERO | HOMEM_TRANSGENERO | MULHER_TRANSGENERO |
NAO_BINARIO | OUTRO | NAO_INFORMADO
```

### 15.8 MotivoVisita (Sprint 5A — obrigatório na Ficha de Visita Domiciliar CDS)

```
CADASTRAMENTO_ATUALIZACAO | VISITA_PERIODICA | ACOMPANHAMENTO_RN |
ACOMPANHAMENTO_GESTANTE | ACOMPANHAMENTO_PUERPERA | ACOMPANHAMENTO_CRIANCA |
ACOMPANHAMENTO_ADULTO | ACOMPANHAMENTO_IDOSO | ACOMPANHAMENTO_PUERICULTURA |
BUSCA_FALTOSO | BUSCA_INTERNACAO | BUSCA_AVC | BUSCA_INFARTO | BUSCA_TB |
BUSCA_HANSENIASE | BUSCA_CANCER | EDUCACAO_SAUDE | CONVITE_ATIVIDADE |
INVESTIGACAO_SURTO | CONDICIONALIDADES | OUTRO
```

### 15.9 DesfechoVisita (Sprint 5A — obrigatório CDS)

```
VISITA_REALIZADA | AUSENTE | RECUSOU
```

### 15.10 TurnoVisita (Sprint 5A)

```
MANHA | TARDE | NOITE
```

### 15.11 TipoVisita (Sprint 5A)

```
VISITA_PERIODICA | VISITA_POS_INTERNACAO | ACOMPANHAMENTO_CONDICIONALIDADES |
BUSCA_ATIVA | INVESTIGACAO_SURTO | EDUCACAO_SAUDE | ATENDIMENTO_URGENCIA | OUTRO
```

### 15.12 TipoImovel (Sprint 5A — Household)

```
DOMICILIO | COMERCIO | TERRENO_BALDIO | PONTO_ESTRATEGICO | ESCOLA | CRECHE |
ABRIGO | INST_LONGA_PERMANENCIA | UNIDADE_PRISIONAL | DELEGACIA | OUTRO
```

### 15.13 MaterialParedes (Sprint 5A — Household)

```
ALVENARIA_COM_REVESTIMENTO | ALVENARIA_SEM_REVESTIMENTO |
TAIPA_COM_REVESTIMENTO | TAIPA_SEM_REVESTIMENTO |
MADEIRA_APARELHADA | MATERIAL_APROVEITADO | OUTRO
```

### 15.14 AbastecimentoAgua (Sprint 5A — Household)

```
REDE_ENCANADA | POCO_ARTESIANO | CISTERNAS | CARRO_PIPA | OUTROS
```

### 15.15 TratamentoAgua (Sprint 5A — Household)

```
SEM_TRATAMENTO | FILTRACAO | FERVURA | CLORACAO | MINERAL | OUTRO
```

### 15.16 Esgotamento (Sprint 5A — Household)

```
REDE_COLETORA | FOSSA_SEPTICA | FOSSA_RUDIMENTAR | VALA_CEU_ABERTO |
DIRETO_CORPO_AGUA | OUTRO
```

### 15.17 DestinoLixo (Sprint 5A — Household)

```
COLETA_PUBLICA | QUEIMADO | ENTERRADO | TERRENO_BALDIO | CORPO_AGUA | OUTROS
```

### 15.18 TipoLogradouroCnes (Sprint 5A — Address)

Baseado na tabela de tipos de logradouro CNES. Principais valores:

```
RUA | AV | AL | PRC | TRV | ROD | EST | VIA | BC | CAM | QD | LG | CJ |
CON | POV | FAZ | SIT | PC | FZD | OUTRO
```

### 15.19 Sexo (Sprint 5A — refactor de `sexAtBirth` para enum)

```
M | F | I
```

`I` = indeterminado. Compatível com e-SUS CDS v3.2.

### 15.20 Nacionalidade (Sprint 5A)

```
BRASILEIRA | NATURALIZADA | ESTRANGEIRA
```

### 15.21 RendaFamiliar (Sprint 5A)

Baseado em salários mínimos (SM).

```
ATE_0_5_SM | ENTRE_0_5_E_1_SM | ENTRE_1_E_2_SM | ENTRE_2_E_3_SM |
ENTRE_3_E_4_SM | ACIMA_4_SM | SEM_RENDA
```

### 15.22 TipoEquipe (Sprint 5A)

```
ESF | NASF | CEO | EMAP | EMAD | EAPS | OUTROS
```

### 15.23 TipoUnidade (Sprint 5A)

```
UBS | CAPS | UPA | HOSPITAL | CEO | OUTRO
```

### 15.24 EstadoCivil (normalizar em Sprint 5A)

```
SOLTEIRO | CASADO | DIVORCIADO | VIUVO | UNIAO_ESTAVEL | SEPARADO | NAO_INFORMADO
```

Substituir o campo `maritalStatus` de string livre para este enum. Dados legados com string livre devem ser migrados via script de normalização antes do fechamento da Sprint 5A.

### 15.25 Localizacao (Sprint 5A — Household)

```
URBANA | RURAL
```

---

## 16. Matriz LGPD

| Campo | Classificação | Quem pode ver | Quem pode editar | Salvaguarda técnica |
|---|---|---|---|---|
| `name` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin, gestor | Nenhuma adicional |
| `birthDate` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `phone`, `phoneAlt` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `motherName` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `address` (legacy) | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `logradouro`, `bairro`, `cep` etc. | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `maritalStatus` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `escolaridade` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `situacaoMercadoTrabalho` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `nacionalidade` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `municipioNascimentoIbge`, `paisNascimentoCnes` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `responsavelFamiliar`, `familyCode` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin | Nenhuma adicional |
| `assignedAcsId`, `microArea`, `teamId` | INTERNAL | ACS (próprios pacientes), gestor, admin | Admin, gestor | Nenhuma adicional |
| `careCategory`, `incompleteProfile`, `inactive` | INTERNAL | Todos os roles com acesso ao paciente | Enfermeiro, médico, admin, gestor | Nenhuma adicional |
| `cpf` | SENSITIVE | Roles clínicos + admin + security_auditor | Admin | AES-256-GCM + HMAC (implementado) |
| `cns` | SENSITIVE | Roles clínicos + admin + security_auditor | Admin | AES-256-GCM + HMAC (implementado) |
| `cnsCpf` | SENSITIVE | Roles clínicos + admin | Admin | AES-256-GCM + HMAC (implementado); candidato a obsolescência |
| `cnsResponsavel` | SENSITIVE | Roles clínicos + admin | Enfermeiro, médico, admin | AES-256-GCM + HMAC — **BLOQUEADOR: ainda não implementado** |
| `rendaFamiliar` | SENSITIVE | Roles clínicos + admin | Enfermeiro, médico, admin | Nenhuma técnica adicional (sensível por conteúdo) |
| `chronicConditions`, `comorbidities` | SENSITIVE | Roles clínicos + admin | Roles clínicos | Nenhuma adicional |
| `medications`, `allergies` | SENSITIVE | Roles clínicos + admin | Roles clínicos | Nenhuma adicional |
| `socialVulnerability`, `substanceDependency`, `domesticViolence` | SENSITIVE | Roles clínicos + admin | Roles clínicos | Acesso restrito; auditável |
| `socialBenefit` | SENSITIVE | Roles clínicos + admin, gestor | Enfermeiro, médico, admin | Nenhuma adicional |
| `motivosVisita`, `desfecho` (Visit) | SENSITIVE | Roles clínicos + ACS + admin | ACS, enfermeiro | Nenhuma adicional |
| `peso`, `altura` (Visit) | SENSITIVE | Roles clínicos + ACS + admin | ACS, enfermeiro | Nenhuma adicional |
| `Household` (conjunto) | SENSITIVE | Roles clínicos + ACS + admin | ACS, enfermeiro, admin | Nenhuma adicional; tratado como conjunto sensível |
| `racaCor` | SPECIAL_CATEGORY | Roles clínicos + admin (NOT gestor em listagem) | Enfermeiro, médico, admin | Shadow column; mascarar em GET /patients para gestor; [REDACTED-SPECIAL-CATEGORY] em audit log |
| `etnia` | SPECIAL_CATEGORY | Roles clínicos + admin (NOT gestor em listagem) | Enfermeiro, médico, admin | Somente quando racaCor = INDIGENA; mascarar em listagem gestor; [REDACTED] em audit log |
| `genderIdentity` | SPECIAL_CATEGORY | Roles clínicos + admin (NOT gestor em listagem) | Enfermeiro, médico, admin | Mascarar em GET /patients para gestor; [REDACTED-SPECIAL-CATEGORY] em audit log |
| `situacaoRua` | SPECIAL_CATEGORY (Sprint 5B) | Roles clínicos + admin | Roles clínicos | Mascarar em listagem; [REDACTED] em audit log |
| `deficiencia` | SPECIAL_CATEGORY (Sprint 5B) | Roles clínicos + admin | Roles clínicos | Enum fechado; mascarar em listagem gestor; [REDACTED] em audit log |
| `orientacaoSexual` | SPECIAL_CATEGORY (Sprint 5B+) | Roles clínicos + admin | Roles clínicos | Aguarda decisão jurídica; não implementar antes |
| `cnsProfissional` (users) | SENSITIVE | Admin + security_auditor | Admin | AES-256-GCM recomendado — validar com jurídico |
| `cboCodigo`, `cboDescricao` (users) | PUBLIC | Todos | Admin | Nenhuma |
| `cnes` (units) | PUBLIC | Todos | Admin | Nenhuma |
| `ine` (teams) | PUBLIC | Todos | Admin | Nenhuma |
| `snapshot_before/after` (audit logs) | SENSITIVE + SPECIAL_CATEGORY | security_auditor + admin | Nunca editável | Campos SPECIAL_CATEGORY substituídos por [REDACTED-SPECIAL-CATEGORY] |

Fundamento legal para SPECIAL_CATEGORY: Art. 11, II, f LGPD — proteção da saúde, por profissional de saúde, sujeito a sigilo. Portaria MS 1.654/2011 (`racaCor` obrigatório e-SUS). CFM Res. 2.265/2019 (`genderIdentity`).

---

## 17. Mapeamento de Sprints

### Sprint 5A — Implementar agora (OBRIGATÓRIO)

| Campo | Entidade | Tipo de alteração |
|---|---|---|
| `racaCor` | Patient | Novo campo JSONB + shadow column `race_color` |
| `etnia` | Patient | Novo campo JSONB (condicional: racaCor=INDIGENA) |
| `nacionalidade` | Patient | Novo campo JSONB (enum) |
| `municipioNascimentoIbge` | Patient | Novo campo JSONB |
| `paisNascimentoCnes` | Patient | Novo campo JSONB |
| `escolaridade` | Patient | Novo campo JSONB (enum; resolve silent data loss `educationLevel`) |
| `situacaoMercadoTrabalho` | Patient | Novo campo JSONB (enum) |
| `rendaFamiliar` | Patient | Novo campo JSONB (enum) |
| `responsavelFamiliar` | Patient | Novo campo JSONB (boolean; resolve silent data loss) |
| `cnsResponsavel` | Patient | Novo campo JSONB + AES-256-GCM + HMAC (BLOQUEADOR LGPD) |
| `sexAtBirth` | Patient | Refactor para enum `['M','F','I']`; fix bug `sex` do frontend |
| `genderIdentity` | Patient | Reclassificar SPECIAL_CATEGORY; migrar para enum `IdentidadeGenero` |
| `maritalStatus` | Patient | Normalizar para enum `EstadoCivil` (script de migração de dados) |
| `addressLegacy` | Patient | Renomear campo `address` → `addressLegacy` no schema |
| `logradouro`, `numero`, `complemento`, `bairro`, `cep`, `municipioIbge`, `uf`, `tipoLogradouroCnes` | Patient (address estruturado) | Novos campos JSONB |
| `motherUnknown` | Patient | Resolver silent data loss |
| `familyCode` | Patient | Resolver silent data loss |
| `homeVisitFreq` | Patient | Resolver silent data loss |
| `occupation` | Patient | Resolver silent data loss |
| `familySituation`, `familySupport` | Patient | Resolver silent data loss |
| `socialVulnerability`, `socialBenefit` | Patient | Resolver silent data loss |
| `substanceDependency`, `domesticViolence` | Patient | Resolver silent data loss |
| Entidade Household completa | Household | Nova entidade (tabela + schema + endpoints) |
| `cnes` | Unit | Migration 013 — nova shadow column |
| `tipoUnidade` | Unit | Novo campo JSONB (enum) |
| `cnsProfissional` | Users | Migration 014 — nova shadow column |
| `cboCodigo`, `cboDescricao` | Users | Novos campos JSONB |
| `ine` | Team | Novo campo obrigatório |
| `tipoEquipe` | Team | Novo campo (enum) |
| Ficha de Visita Domiciliar | Visit (clinical_records) | Schema dedicado com todos os campos Sprint 5A |
| Mascaramento SPECIAL_CATEGORY em audit logs | app_audit_logs | Alteração no middleware de auditoria |
| RIPD atualizado | Compliance | Responsabilidade DPO Prefeitura antes do merge |

### Sprint 5B — Implementar após D+60 do piloto UBS-001

| Campo / Entidade | Motivo do adiamento |
|---|---|
| Entidade `Family` (grupo familiar separada) | Requer definição de produto sobre relacionamento N:N pacientes/famílias |
| Tabela `municipalities` (5.570 municípios) | Volume de dados e migração; piloto é single-municipality |
| `situacaoRua` | SPECIAL_CATEGORY; requer decisão de produto e RIPD atualizado |
| `deficiencia` (array enum) | SPECIAL_CATEGORY; requer decisão de produto |
| `insegurancaAlimentar` | SENSITIVE; requer decisão de produto |
| `beneficiosSociais` (enum fechado) | Requer tabela de referência e decisão de produto |
| `nis` | Requer validação de formato e decisão jurídica sobre armazenamento |
| `cidPrincipal`, `cidSecundarios` | Sem tabela CID-10 = dado inválido no SISAB (ver Seção 19, Decisão 3) |
| `ciap2` | Sem tabela de referência CIAP-2 |
| Tabela de municípios completa (IBGE) | >5.000 registros; Sprint 5B |

### Sprint 6+ — Fora do escopo do piloto

| Domínio | Observação |
|---|---|
| SIGTAP (procedimentos) | Integração com tabela nacional de procedimentos |
| Território GIS | Mapas e polígonos de microárea; requer infraestrutura adicional |
| RNDS (Rede Nacional de Dados em Saúde) | Integração federal; requer credenciamento |
| SISREG (regulação) | Integração com sistema de regulação municipal/estadual |
| PEC (Prontuário Eletrônico do Cidadão) | Interoperabilidade com PEC e-SUS |
| `orientacaoSexual` | Aguarda decisão jurídica/DPO |
| Multi-municipality completo | Suporte a múltiplos municípios em instância única |

---

## 18. Campos Explicitamente Adiados

| Campo | Motivo do adiamento | Sprint alvo |
|---|---|---|
| `cidPrincipal` | Sem tabela CID-10 local — enviar dado sem tabela de referência resulta em rejeição no SISAB | Sprint 5B |
| `cidSecundarios` | Idem `cidPrincipal` | Sprint 5B |
| `ciap2` | Sem tabela de referência CIAP-2 | Sprint 5B |
| `sigtap` | Requer integração com tabela SIGTAP (>10.000 registros) | Sprint 6+ |
| Tabela completa de municípios (IBGE) | Requer carga de >5.570 registros; piloto é single-municipality | Sprint 5B |
| `Family` (entidade separada) | Requer definição de produto sobre relacionamento N:N; complexidade de dados | Sprint 5B |
| Território GIS | Requer infraestrutura PostGIS + decisão de produto | Sprint 6+ |
| RNDS | Integração federal com credenciamento específico | Sprint 6+ |
| SISREG | Integração com sistema estadual/municipal de regulação | Sprint 6+ |
| `beneficiosSociais` (enum fechado) | Requer tabela de referência e curadoria de valores válidos | Sprint 5B |
| `condicoesSaude` (enum) | Requer alinhamento com CID-10/CIAP-2 antes de fechar enum | Sprint 5B |
| `situacaoRua` | SPECIAL_CATEGORY; RIPD não atualizado para este campo | Sprint 5B |
| `cuidadoResidencial` | Requer definição de produto | Sprint 5B |
| `deficiencia` (array) | SPECIAL_CATEGORY; requer decisão de produto e RIPD | Sprint 5B |
| `orientacaoSexual` | SPECIAL_CATEGORY; aguarda decisão formal do jurídico/DPO | Sprint 5B+ |
| `nis` | Requer decisão jurídica sobre armazenamento e validação de formato | Sprint 5B |
| `insegurancaAlimentar` | Requer decisão de produto sobre fluxo de coleta | Sprint 5B |
| `cnsProfissional` (AES) | Campo criado em 5A; criptografia pendente de validação jurídica | Sprint 5A (validar antes do merge) |

---

## 19. Decisões Arquiteturais

### Decisão 1: `address` legado mantido como `addressLegacy`

Campo `address` (string livre, max 500) é mantido e renomeado para `addressLegacy` no schema. Motivo: pacientes existentes têm dados apenas neste campo. Exclusão ou conversão forçada resultaria em perda de dados. A UI exibe `addressLegacy` quando os campos estruturados (`logradouro`, `bairro` etc.) estão vazios. Os campos estruturados são adicionados progressivamente. Não há data de descontinuação do legado — definir em Sprint 5B após migração dos dados existentes.

**Mecanismo de transição obrigatório em Sprint 5A (deploy sem regressão):**

O frontend hoje envia o campo com a chave `address` (linha 130 de `usePatientModal.js`). A renomeação do schema deve ser feita em duas etapas — nunca em um único deploy atômico:

1. **Etapa A (backend primeiro):** No `PatientBaseShape`, adicionar `addressLegacy: optionalShortString(500)` ao lado do `address` existente. No schema, adicionar alias via `.transform()`: se o payload contém `address` e não contém `addressLegacy`, mapear `address → addressLegacy` internamente. Isso mantém compatibilidade com o frontend atual.

2. **Etapa B (frontend depois, mesmo sprint ou sprint seguinte):** Atualizar `usePatientModal.js` para enviar `addressLegacy` em vez de `address`. Após validação em staging e produção, remover o alias `.transform()` do schema.

3. **Nunca fazer:** remover `address` do schema antes de atualizar o frontend — isso causa HTTP 400 em todos os PATCH de paciente com endereço.

### Decisão 2: Household é entidade separada (não embutida no Patient)

O e-SUS trata Ficha de Cadastro Individual e Ficha de Cadastro Domiciliar como fichas distintas. Um domicílio pode ter múltiplos moradores. Embutir os campos do Household no Patient criaria redundância (todos os moradores do mesmo domicílio replicariam os mesmos dados) e impediria atualização centralizada do domicílio. A separação respeita o modelo e-SUS e facilita exportação das fichas corretas para o SISAB.

### Decisão 3: CID-10 não entra em Sprint 5A

O SISAB valida os códigos CID-10 contra a tabela oficial (~15.000 registros). Enviar um código CID-10 sem validação local resulta em rejeição da ficha. Criar a tabela CID-10 em Sprint 5A é fora do escopo de fronteira definida pelo Governor. A implementação correta exige: carga da tabela CID-10, endpoint de busca, validação no schema e UI de seleção. Planejado para Sprint 5B.

### Decisão 4: `cnsCpf` é candidato a obsolescência

`cnsCpf` é um campo híbrido do VITRAS sem paralelo no e-SUS. É derivado de `cpf` ou `cns` — o backend o gera automaticamente. Não é enviado pelo frontend nem pelo e-SUS. Seu único uso identificado é como campo de busca interno. Com a consolidação dos campos `cpf` e `cns` (ambos com AES-256-GCM + HMAC), o `cnsCpf` perde utilidade. Não será eliminado em Sprint 5A para evitar regressão em queries existentes.

**Instrução de deprecação para Sprint 5A (obrigatória para D-6):**

No arquivo `backend/src/schemas.js`, no `PatientBaseShape`, adicionar comentário inline:
```javascript
cnsCpf: optionalShortString(30), // @deprecated — campo derivado sem paralelo e-SUS; remover Sprint 5B após auditoria de uso
```

No `backend/src/routes/patients.js`, no bloco de criação/atualização de paciente, após a linha que deriva `cnsCpf`, adicionar log de warning:
```javascript
// @deprecated: cnsCpf será removido em Sprint 5B
if (process.env.NODE_ENV === 'development') {
  console.warn('[DEPRECATED] cnsCpf gerado — remover em Sprint 5B');
}
```

Remover em Sprint 5B após grep completo confirmando que nenhuma query SQL ou filter depende do campo `cnsCpf` diretamente.

### Decisão 5: `nomeSocial` vs. `genderIdentity`

São campos **distintos** com semânticas diferentes:

- `nomeSocial`: nome pelo qual o paciente prefere ser chamado (string livre). Campo do e-SUS CDS v3.2. Hoje **ausente** no VITRAS.
- `genderIdentity`: identidade de gênero (enum fechado). Já existe no VITRAS. Alinhado ao Art. 11 LGPD e CFM Res. 2.265/2019.

O VITRAS deve implementar `nomeSocial` quando houver decisão de produto sobre o fluxo de coleta e exibição. Em Sprint 5A, apenas `genderIdentity` é reclassificado e padronizado com enum. `nomeSocial` fica como campo adiado sem sprint alvo definido.

### Decisão 6: `racaCor` — tensão LGPD Art. 11 vs. Portaria MS 1.654/2011

`racaCor` é dado de origem racial, classificado como SPECIAL_CATEGORY pelo Art. 11 LGPD. Ao mesmo tempo, a Portaria MS 1.654/2011 torna o campo obrigatório para o SISAB. A harmonização é feita via Art. 11, II, f LGPD: tratamento de dados de SPECIAL_CATEGORY é permitido quando "indispensável para a proteção da saúde (...) por profissional de saúde, sujeito ao dever de sigilo". O VITRAS coleta `racaCor` sob este fundamento, aplicando field-level masking em listagens para gestores e [REDACTED-SPECIAL-CATEGORY] em audit logs. O RIPD deve registrar este fundamento explicitamente antes do merge de Sprint 5A.

### Decisão 7: Shadow columns vs. JSONB

Campos novos em Sprint 5A sem alta probabilidade de uso em query SQL direta (filtro, JOIN, índice) vão para JSONB. Shadow columns são criadas apenas para campos com uso confirmado em queries de filtragem ou busca:

- `racaCor` → shadow column `race_color` (filtros de indicadores SISAB)
- `situacaoRua` (Sprint 5B) → shadow column `situacao_rua` (busca ativa)
- `cnes` em `app_units` → shadow column (lookup/validação única)
- `cns` em `app_users` → shadow column (já existente)

Todos os outros campos novos (endereço estruturado, escolaridade, situacaoMercadoTrabalho, etc.) vão para JSONB sem shadow column em Sprint 5A.

### Decisão 8: Integridade referencial sem FK DDL

Soft references (sem FK DDL) são a decisão arquitetural vigente, compatível com o modelo JSONB + in-memory do sistema. Risco documentado: exclusão de um usuário ACS deixa `assignedAcsId` inválido nos pacientes vinculados. Mitigação planejada para Sprint 5A: adicionar verificação em `getAllowedPatients` para tratar `assignedAcsId` inválidos graciosamente (não expor pacientes com ACS deletado para outros ACS). Não será adicionada FK DDL em Sprint 5A — mudança de grande impacto sem ganho proporcional no piloto.

### Decisão 9: `municipalityId` hardcoded `'3534401'`

O valor hardcoded `'3534401'` (Ribeirão Preto-SP) é aceitável para o piloto single-municipality UBS-001. Está presente em dois lugares: migration 010 e `patients.js:156` (fallback). Não será alterado em Sprint 5A. Em Sprint 5B, com a tabela de municípios criada, o hardcode será substituído por configuração por instância (variável de ambiente `DEFAULT_MUNICIPALITY_ID`).

### Decisão 11: Household — contrato de endpoint e transição de payload

O frontend hoje envia campos de domicílio (housingType, waterSupply, sewage, garbage, electricity) **dentro do payload de PATCH /patients/:id**. O documento define Household como entidade separada (Seção 5). Essa tensão precisa de decisão explícita antes do Sprint 5A para evitar implementações incompatíveis.

**Decisão adotada: extração interna no backend durante Sprint 5A (estratégia de transição).**

1. **Sprint 5A — Extração interna:** O endpoint `PATCH /patients/:id` continua aceitando os campos de Household no body. O backend os extrai do payload, cria/atualiza o registro Household vinculado ao `patientId`, e os remove do objeto Patient antes da persistência. O frontend não precisa ser alterado.

2. **Sprint 5B — Endpoint dedicado:** Após estabilização do modelo Household, criar `POST /households` e `PATCH /households/:id`. Atualizar o frontend para chamar o endpoint dedicado. Remover a extração interna do `PATCH /patients/:id`.

**Mapeamento de campos frontend → Household canônico (alias de transição Sprint 5A):**

| Campo frontend (usePatientModal.js) | Campo Household canônico | Linha no modal |
|---|---|---|
| `housingType` | `tipoImovel` (enum TipoImovel) | 135 |
| `waterSupply` | `abastecimentoAgua` (enum AbastecimentoAgua) | 136 |
| `sewage` | `esgotamento` (enum Esgotamento) | 136 |
| `garbage` | `coletaLixo` (boolean) ou `destinacaoLixo` | 137 |
| `electricity` | `energiaEletrica` (boolean) | 137 |

**Campos de Household NOT no frontend atual:** `tipoImovel`, `materialPredominanteParedes`, `numMoradores`, `numComodos`, `tratamentoAgua`, `localizacao` — precisarão de UI própria em Sprint 5A (formulário de cadastro domiciliar separado ou aba dedicada no modal de paciente).

### Decisão 10: Enum `sexAtBirth` — refactor obrigatório em Sprint 5A

O campo `sexAtBirth` hoje aceita qualquer string (sem enum). O e-SUS CDS v3.2 exige os valores `M`, `F`, `I`. Além disso, o frontend envia `sex` (não `sexAtBirth`) — dado descartado silenciosamente. A correção em Sprint 5A é:

1. Converter `sexAtBirth` de string livre para `z.enum(['M', 'F', 'I'])` no schema Zod
2. Adicionar `.transform()` no schema para aceitar o alias `sex` durante a transição
3. Corrigir o frontend para enviar `sexAtBirth`
4. Após deploy e validação, remover o alias `sex` do schema

Esta mudança é breaking para qualquer cliente que envie valores fora de `M/F/I`. Avaliar dados existentes antes de aplicar validação estrita.
