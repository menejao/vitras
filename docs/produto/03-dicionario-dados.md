# VITRAS APS — Dicionário Nacional de Dados

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Canonical source:** `app_state` JSONB (Postgres) / `data/db.json` (dev/file mode)

Legenda de colunas:
- **Tipo:** String / Number / Boolean / ISO8601 / UUID / Enum / Array / Object / null
- **Obrig:** S = obrigatório, N = opcional
- **LGPD:** PD = dado pessoal comum, SC = dado sensível Art. 11, CIF = cifrado em repouso, — = não-pessoal
- **CDS:** S = exportado para e-SUS CDS, N = não exportado

---

## Entidade: Unit (UBS)

**Coleção:** `db.units` / shadow table `app_units`  
**Descrição:** Unidade Básica de Saúde. Unidade de isolamento do multi-tenant.

| Campo | Tipo | Obrig | LGPD | CDS | Descrição / Validação |
|---|---|---|---|---|---|
| `id` | UUID | S | — | N | Identificador único gerado pelo sistema |
| `name` | String | S | — | N | Nome oficial da UBS |
| `cnes` | String | S | — | S | Código CNES — exatamente 7 dígitos numéricos |
| `municipalityName` | String | S | — | N | Nome do município por extenso |
| `municipalityId` | String | N | — | N | Código IBGE do município — 7 dígitos |
| `uf` | String | S | — | N | Sigla do estado — 2 letras maiúsculas |
| `address` | String | N | — | N | Endereço completo da UBS |
| `contactEmail` | String | N | — | N | E-mail institucional — validado como RFC 5322 |
| `phone` | String | N | — | N | Telefone de contato |
| `status` | Enum | S | — | N | `draft` / `onboarding` / `homologation` / `active` / `suspended` |
| `createdBy` | UUID | S | — | N | ID do `support_admin` que criou |
| `createdAt` | ISO8601 | S | — | N | Data de criação — UTC |
| `updatedAt` | ISO8601 | S | — | N | Data da última alteração — UTC |
| `activatedAt` | ISO8601 | N | — | N | Data da primeira ativação para `active` — UTC |
| `suspendedAt` | ISO8601 | N | — | N | Data da última suspensão — UTC |
| `homologationChecklist` | Object | N | — | N | Mapa de itens do checklist de homologação (8 booleanos) |
| `homologationApprovedBy` | UUID | N | — | N | ID do `support_admin` que aprovou a homologação |
| `homologationApprovedAt` | ISO8601 | N | — | N | Data da aprovação técnica de homologação |

**Transições de status:**
```
draft → onboarding (automática ao criar gestor)
onboarding → homologation (manual — 5 critérios)
homologation → active (manual — checklist + aprovação)
active → suspended (manual)
suspended → active (manual)
onboarding → draft (back-step)
homologation → onboarding (back-step)
```

---

## Entidade: Team (Equipe de Saúde)

**Coleção:** `db.teams` / shadow table `app_teams`  
**Descrição:** Equipe de Saúde da Família (ESF) ou equipe especializada vinculada a uma UBS.

| Campo | Tipo | Obrig | LGPD | CDS | Descrição / Validação |
|---|---|---|---|---|---|
| `id` | UUID | S | — | N | Identificador único |
| `name` | String | S | — | N | Nome da equipe |
| `ine` | String | N | — | S | Identificador Nacional de Equipes — 10 dígitos |
| `tipoEquipe` | Enum | N | — | S | `ESF` / `NASF` / `eSB` / etc. |
| `unitId` | UUID | S | — | N | Referência à UBS (`units.id`) |
| `managerUserId` | UUID | N | — | N | Gestor responsável pela equipe |
| `createdBy` | UUID | N | — | N | ID de quem criou |
| `createdAt` | ISO8601 | S | — | N | Data de criação |
| `updatedAt` | ISO8601 | S | — | N | Data da última alteração |

---

## Entidade: User (Usuário)

**Coleção:** `db.users` / shadow table `app_users`  
**Descrição:** Profissional de saúde ou operador do sistema com acesso ao VITRAS.

| Campo | Tipo | Obrig | LGPD | CDS | Descrição / Validação |
|---|---|---|---|---|---|
| `id` | UUID | S | — | N | Identificador único |
| `name` | String | S | PD | N | Nome completo |
| `email` | String | S | PD | N | E-mail — único no sistema — RFC 5322 |
| `role` | Enum | S | — | N | `acs` / `nurse_manager` / `doctor` / `dentist` / `gestor` / `nursing_tech` / `pharmacist` / `pharmacy_tech` / `receptionist` / `support_admin` / `break_glass_admin` / `developer_readonly` / `support_operator` / `qa_operator` / `security_auditor` |
| `password` | String | S | CIF | N | Hash bcrypt — nunca plaintext |
| `unitId` | UUID | N | — | N | UBS do usuário. Vazio para `support_admin`. |
| `teamId` | UUID | N | — | N | Equipe do usuário (relevante para ACS) |
| `municipalityId` | String | N | — | N | Código IBGE — herdado da UBS no cadastro |
| `cpf` | String | N | PD/CIF | N | CPF sem máscara — 11 dígitos |
| `cns` | String | N | PD/CIF | N | Cartão Nacional de Saúde — 15 dígitos |
| `cbo` | String | N | — | S | Código Brasileiro de Ocupações |
| `phone` | String | N | PD | N | Telefone de contato |
| `forcePasswordChange` | Boolean | S | — | N | `true` = trocar senha no próximo acesso |
| `passwordUpdatedAt` | ISO8601 | N | — | N | Data da última troca de senha |
| `temporaryPasswordIssuedAt` | ISO8601 | N | — | N | Data de emissão da senha temporária |
| `createdBySupport` | Boolean | N | — | N | `true` se criado pelo `support_admin` |
| `createdByUserId` | UUID | N | — | N | ID de quem criou |
| `lastPasswordResetAt` | ISO8601 | N | — | N | Data do último reset de senha |
| `passwordResetBy` | UUID | N | — | N | ID de quem fez o último reset |
| `twoFactorEnabled` | Boolean | S | — | N | 2FA ativo |
| `twoFactorSecret` | String | N | CIF | N | Secret TOTP — cifrado |
| `inactive` | Boolean | N | — | N | `true` = usuário desativado |
| `createdAt` | ISO8601 | S | — | N | Data de criação |
| `updatedAt` | ISO8601 | S | — | N | Data da última alteração |

---

## Entidade: Patient (Paciente / Cidadão)

**Coleção:** `db.patients`  
**Descrição:** Cidadão cadastrado na APS. Entidade central do produto clínico.

### Campos de identificação

| Campo | Tipo | Obrig | LGPD | CDS | Descrição / Validação |
|---|---|---|---|---|---|
| `id` | UUID | S | — | N | Identificador único |
| `name` | String | S | PD | S | Nome completo — obrigatório |
| `nomeSocial` | String | N | PD | S | Nome social |
| `motherName` | String | N | PD | S | Nome da mãe |
| `motherUnknown` | Boolean | N | — | S | Mãe desconhecida |
| `guardianName` | String | N | PD | S | Nome do responsável |
| `cpf` | String | N | PD/CIF | S | CPF — 11 dígitos sem máscara |
| `cns` | String | N | PD/CIF | S | CNS — 15 dígitos |
| `cnsResponsavel` | String | N | PD/CIF | S | CNS do responsável — restrito por role |
| `nis` | String | N | PD/CIF | N | NIS/PIS — cifrado — não exposto ao receptionist/gestor |
| `birthDate` | ISO8601 | N | PD | S | Data de nascimento — YYYY-MM-DD |
| `sexAtBirth` | Enum | N | PD | S | `M` / `F` / `I` (indeterminado) |
| `genderIdentity` | Enum | N | SC | S | Identidade de gênero — LGPD Art. 11 |
| `racaCor` | Enum | N | SC | S | Raça/cor — LGPD Art. 11. Valores e-SUS: Branca / Preta / Amarela / Parda / Indígena / Sem informação |
| `etnia` | String | N | SC | S | Etnia (para indígenas) |
| `phone` | String | S | PD | S | Telefone — obrigatório |
| `phoneAlt` | String | N | PD | S | Telefone alternativo |

### Campos de endereço

| Campo | Tipo | Obrig | LGPD | CDS | Descrição |
|---|---|---|---|---|---|
| `address` | String | N | PD | N | Endereço livre (legado) |
| `logradouro` | String | N | PD | S | Tipo de logradouro (e-SUS) |
| `numero` | String | N | PD | S | Número |
| `complemento` | String | N | PD | S | Complemento |
| `bairro` | String | N | PD | S | Bairro |
| `cep` | String | N | PD | S | CEP — 8 dígitos |
| `municipioIbge` | String | N | — | S | Código IBGE do município — 7 dígitos |
| `uf` | String | N | — | S | Sigla do estado |
| `tipoLogradouroCnes` | String | N | — | S | Tipo de logradouro no padrão CNES |
| `birthCity` | String | N | PD | S | Município de nascimento |
| `birthState` | String | N | PD | S | Estado de nascimento |
| `municipioNascimentoIbge` | String | N | — | S | Código IBGE do município de nascimento |

### Campos socioeconômicos

| Campo | Tipo | Obrig | LGPD | CDS | Descrição |
|---|---|---|---|---|---|
| `escolaridade` | Enum | N | PD | S | Grau de instrução — valores e-SUS |
| `occupation` | String | N | PD | S | Ocupação |
| `situacaoMercadoTrabalho` | Enum | N | PD | S | Situação no mercado de trabalho |
| `rendaFamiliar` | Enum | N | PD | S | Renda familiar mensal |
| `responsavelFamiliar` | Boolean | N | — | S | É responsável familiar |
| `nacionalidade` | Enum | N | PD | S | Brasileira / Naturalizada / Estrangeira |
| `familySituation` | String | N | PD | N | Situação familiar |
| `familySupport` | String | N | PD | N | Suporte familiar |
| `socialVulnerability` | String | N | PD | N | Vulnerabilidade social |
| `socialBenefit` | String | N | PD | N | Benefício social |
| `substanceDependency` | String | N | SC | N | Dependência de substâncias |
| `domesticViolence` | String | N | SC | N | Histórico de violência doméstica |
| `situacaoRua` | Boolean | N | SC | S | Situação de rua — LGPD Art. 11 |

### Campos clínicos

| Campo | Tipo | Obrig | LGPD | CDS | Descrição |
|---|---|---|---|---|---|
| `careCategory` | Enum | N | — | N | Categoria de cuidado (protocolo interno) |
| `chronicConditions` | Array | N | SC | N | Condições crônicas |
| `comorbidities` | String | N | SC | N | Comorbidades livres |
| `medications` | String | N | SC | N | Medicamentos em uso |
| `allergies` | String | N | SC | N | Alergias |
| `deficiencia` | Array | N | SC | S | Deficiências — LGPD Art. 11 |
| `hivGestante` | Boolean | N | SC | N | HIV em gestante — LGPD Art. 11 |
| `sifilis` | Boolean | N | SC | N | Sífilis — LGPD Art. 11 |

### Campos de pré-natal

| Campo | Tipo | Obrig | LGPD | CDS | Descrição |
|---|---|---|---|---|---|
| `pregnancyStartDate` | ISO8601 | N | — | S | Data de início da gestação |
| `expectedDeliveryDate` | ISO8601 | N | — | S | Data prevista do parto |
| `gestationalAgeDumWeeks` | Number | N | — | S | Idade gestacional DUM (semanas) 0–45 |
| `gestationalAgeDumDays` | Number | N | — | S | Idade gestacional DUM (dias) 0–6 |
| `gestationalAgeUsgWeeks` | Number | N | — | S | Idade gestacional USG (semanas) 0–45 |
| `gestationalAgeUsgDays` | Number | N | — | S | Idade gestacional USG (dias) 0–6 |
| `usgDate1` | ISO8601 | N | — | S | Data do 1º USG |
| `usgDate2` | ISO8601 | N | — | S | Data do 2º USG |
| `usgDate3` | ISO8601 | N | — | S | Data do 3º USG |
| `prenatalStartDate` | ISO8601 | N | — | S | Data de início do pré-natal |
| `postpartumStartDate` | ISO8601 | N | — | S | Data de início do puerpério |

### Campos de TRIA (Triagem Alimentar)

| Campo | Tipo | Obrig | LGPD | CDS | Descrição |
|---|---|---|---|---|---|
| `triaAlimentosAcabaram` | Boolean/null | N | PD | N | TRIA: alimentos acabaram antes do mês |
| `triaTipoUnico` | Boolean/null | N | PD | N | TRIA: consumiu apenas um tipo de alimento |

### Campos de vínculo e controle

| Campo | Tipo | Obrig | LGPD | CDS | Descrição |
|---|---|---|---|---|---|
| `unitId` | UUID | N | — | N | UBS de cadastro |
| `microArea` | String | N | — | N | Microárea ACS |
| `assignedAcsId` | UUID | N | — | N | ACS responsável |
| `maritalStatus` | Enum | N | PD | S | Estado civil — valores e-SUS |
| `incompleteProfile` | Boolean | N | — | N | Perfil incompleto pendente de complementação |
| `inactive` | Boolean | N | — | N | Paciente inativo |
| `inactivationReason` | String | N | — | N | Motivo da inativação |
| `inactivatedBy` | UUID | N | — | N | Quem inativou |
| `inactivatedAt` | ISO8601 | N | — | N | Data de inativação |
| `responsible` | Object | N | PD | S | Responsável legal (name, cpf, phone, relationship) |
| `createdAt` | ISO8601 | S | — | N | Data de criação |
| `createdBy` | UUID | S | — | N | ID do usuário que cadastrou |

---

## Entidade: Household (Domicílio)

**Coleção:** `db.households`  
**Descrição:** Domicílio cadastrado pelo ACS. Vinculado a um ou mais pacientes.

> Documentação completa em backlog — sprint APS-01D. Campos principais: `id`, `address`, `unitId`, `microArea`, `acsId`, `createdAt`.

---

## Entidade: FamilyGroup (Grupo Familiar)

**Coleção:** `db.familyGroups`  
**Descrição:** Agregação de pacientes em um grupo familiar. Base para score de busca ativa.

> Documentação completa em backlog — sprint APS-01D/APS-01E. Campos principais: `id`, `householdId`, `members[]`, `score`, `unitId`, `microArea`.

---

## Entidade: AcsVisit (Visita Domiciliar ACS)

**Coleção:** `db.acsVisits`  
**Descrição:** Registro de visita domiciliar realizada pelo ACS.

> Documentação completa em backlog — sprint APS-01C. Campos principais: `id`, `acsId`, `householdId`, `patientId`, `visitDate`, `motivo`, `desfecho`, `unitId`.

---

## Entidade: AuditLog

**Coleção:** `db.auditLogs`  
**Descrição:** Trilha imutável de auditoria. Hash chain (AUD-01).

| Campo | Tipo | Obrig | LGPD | CDS | Descrição |
|---|---|---|---|---|---|
| `id` | UUID | S | — | N | Identificador único |
| `action` | String | S | — | N | Ação realizada — formato `DOMAIN_ENTITY_ACTION` |
| `entity` | String | S | — | N | Tipo da entidade afetada |
| `entityId` | UUID | N | — | N | ID da entidade afetada |
| `category` | String | N | — | N | Categoria da ação |
| `severity` | Enum | N | — | N | `info` / `warn` / `error` / `critical` |
| `userId` | UUID | S | — | N | ID de quem executou |
| `userName` | String | S | PD | N | Nome de quem executou — para rastreabilidade |
| `userRole` | String | S | — | N | Perfil de quem executou |
| `teamId` | UUID | N | — | N | Equipe de quem executou |
| `unitId` | UUID | N | — | N | UBS de contexto |
| `details` | Object | N | — | N | Dados da ação — **nunca** incluir senha, dado clínico ou PII não necessário |
| `hash` | String | N | — | N | Hash da entrada atual (AUD-01 chain) |
| `prevHash` | String | N | — | N | Hash da entrada anterior (AUD-01 chain) |
| `hashVersion` | String | N | — | N | `v2` (atual) / `legacy_incompatible` (migrado) |
| `createdAt` | ISO8601 | S | — | N | Data e hora da ação — UTC |

---

## 6. Relacionamentos

```
Unit (UBS)
├── Teams [1:N] — cada team tem unitId
│   └── Users [1:N] — cada user tem teamId + unitId
│       └── Patients [1:N] — cada patient tem unitId
│           ├── FamilyGroups [1:N] — via members[]
│           │   └── Households [1:1] — via householdId
│           └── AcsVisits [1:N] — via patientId
└── Users (gestores) [1:N] — users com role=gestor e unitId
```

**Regras de integridade referencial:**
- Paciente sem `unitId` é inacessível por ACS (não aparece em filtro de escopo)
- ACS sem `teamId` não acessa pacientes (`patients.read.scoped` filtra por team)
- `support_admin` sem `unitId` acessa apenas `/platform/*`
- Gestor com `unitId` não acessa `/platform/*`
