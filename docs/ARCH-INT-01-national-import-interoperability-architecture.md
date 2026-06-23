# ARCH-INT-01 — National Data Import and Interoperability Architecture

**Emitido em:** 2026-06-23  
**Status:** PASS  
**Depende de:** CTRL-01, MR-01, SCALE-01, TECH-SCALE-01  
**Pré-requisito para implementação:** REM-01 (shadow sync incremental) + REM-02 (bootstrap paginado)  
**Autoridade:** Este documento é a referência oficial para todas as futuras iniciativas de migração, interoperabilidade e importação de dados do VITRAS APS

---

## GOV-01

| # | Critério | Resultado |
|---|---|---|
| 1 | Existe modelo canônico nacional? | **SIM** |
| 2 | Existe definição formal de evento assistencial? | **SIM** |
| 3 | Existe definição formal de Source Profile? | **SIM** |
| 4 | Existe definição formal de Import Job? | **SIM** |
| 5 | Existe definição formal de Mapping Engine? | **SIM** |
| 6 | Existe definição formal de Validation Engine? | **SIM** |
| 7 | Existe definição formal de Population Selection Engine? | **SIM** |
| 8 | Existe definição formal de Staging? | **SIM** |
| 9 | Existe definição formal de Homologação de Importação? | **SIM** |
| 10 | Existe definição formal de Commit Controlado? | **SIM** |
| 11 | Existe definição formal de Audit Trail? | **SIM** |
| 12 | Existe dependência de fornecedor? | **NÃO** |
| 13 | Existe dependência de município? | **NÃO** |
| 14 | Existe dependência de UBS? | **NÃO** |
| 15 | A arquitetura permanece nacional? | **SIM** |

---

## FASE 1 — Arquitetura Conceitual

### Fluxo oficial de importação

```
┌───────────────────────────────────────────────────────────┐
│                      ORIGEM EXTERNA                        │
│  PEC · CSV · HL7 FHIR · API Municipal · Planilha · XML    │
└──────────────────────┬────────────────────────────────────┘
                       │  dados brutos (qualquer formato)
                       ▼
┌──────────────────────────────────────────────────────────┐
│                    RAW DATA LAYER                         │
│  Recepção imutável. Sem transformação. Sem validação.     │
│  Armazenado como recebido. Hash de integridade calculado. │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                   SOURCE PROFILING                        │
│  Identificação automática do sistema de origem.           │
│  Produz: Source Profile (versão, schema, quirks).         │
│  Falha de profiling = Import Job abortado (não rejeitado).│
└──────────────────────┬───────────────────────────────────┘
                       │  Source Profile identificado
                       ▼
┌──────────────────────────────────────────────────────────┐
│                   MAPPING ENGINE                          │
│  Tradução estrutural + semântica.                         │
│  De/para entre vocabulário externo → Canonical Model.     │
│  Certeza exigida: 100% por campo mapeado.                 │
│  Ambiguidade = campo rejeitado (não mapeado).             │
└──────────────────────┬───────────────────────────────────┘
                       │  payload no Canonical Model
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  VALIDATION ENGINE                        │
│  Validação contra regras nacionais do VITRAS.             │
│  Identidade · Completude · Integridade · LGPD.            │
│  Resultado: válido / inválido (com motivo).               │
└──────────────────────┬───────────────────────────────────┘
                       │  registros validados
                       ▼
┌──────────────────────────────────────────────────────────┐
│             POPULATION SELECTION ENGINE                   │
│  Filtro de elegibilidade: quem importar?                  │
│  Critérios nacionais + critérios locais da UBS.           │
│  Registros não elegíveis: descartados com log.            │
└──────────────────────┬───────────────────────────────────┘
                       │  população selecionada
                       ▼
┌──────────────────────────────────────────────────────────┐
│                     STAGING                               │
│  Espaço isolado de pré-produção.                          │
│  Dados visíveis apenas para homologadores.                │
│  Sem impacto em produção. Sem score. Sem indicadores.     │
└──────────────────────┬───────────────────────────────────┘
                       │  aprovação manual
                       ▼
┌──────────────────────────────────────────────────────────┐
│                   HOMOLOGAÇÃO                             │
│  Revisão humana obrigatória de amostra representativa.    │
│  GO = Commit autorizado. NO GO = staging descartado.      │
└──────────────────────┬───────────────────────────────────┘
                       │  GO
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  COMMIT CONTROLADO                        │
│  Inserção atômica e rastreável em produção.               │
│  Usa shadow sync incremental (REM-01 obrigatório).        │
│  Score recalculado após commit.                           │
│  Auditoria registrada. Irreversível por design.           │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                    PRODUÇÃO                               │
│  Dados integrados ao db canônico.                         │
│  Rastreáveis por sourceId + importJobId.                  │
│  Visíveis em dashboard, score, indicadores.               │
└──────────────────────────────────────────────────────────┘
```

### Princípios irrevogáveis

1. **Imutabilidade do raw:** dados brutos nunca são alterados após recepção.
2. **Certeza de 100% no mapeamento:** campo não mapeável com certeza é rejeitado, não estimado.
3. **Staging sempre antes do commit:** zero commits diretos em produção.
4. **Homologação humana obrigatória:** nenhum commit automático total — sempre há aprovação.
5. **Rastreabilidade integral:** todo registro importado carrega `sourceId` + `importJobId` + `sourceSystem` para sempre.
6. **LGPD por design:** dados de categoria especial são identificados antes do mapeamento e tratados conforme Art. 11.
7. **Independência de fornecedor:** o Canonical Model não depende de PEC, Espaço Municipal ou qualquer sistema específico.

---

## FASE 2 — Canonical Model

### Definição

Canonical Model é a representação interna oficial do VITRAS APS para toda entidade que pode ser importada, criada ou exportada. Todo dado externo deve ser mapeado para este modelo antes de entrar em qualquer fase do pipeline.

### Domínio 1 — Paciente (Patient)

**Entidade central do sistema.** Toda importação começa e termina aqui.

| Campo canônico | Tipo | LGPD | Obrigatório | Fonte primária |
|---|---|---|---|---|
| `id` | UUID v4 | — | SIM (gerado) | VITRAS |
| `name` | string(200) | dado pessoal | SIM | externo |
| `birthDate` | YYYY-MM-DD | dado pessoal | SIM | externo |
| `motherName` | string(200) | dado pessoal | não | externo |
| `cpf` | string(11) | dado pessoal | condicional | externo |
| `cns` | string(15) | dado pessoal | condicional | externo |
| `phone` | string(20) | dado pessoal | não | externo |
| `address` | string(500) | dado pessoal | não | externo |
| `municipalityId` | IBGE 7 dígitos | — | SIM | externo/UBS |
| `teamId` | UUID VITRAS | — | SIM | UBS |
| `unitId` | UUID VITRAS | — | SIM | UBS |
| `assignedAcsId` | UUID VITRAS | — | não | UBS |
| `microArea` | string(100) | — | não | externo |
| `careCategory` | enum | — | SIM | derivado |
| `chronicConditions` | string[]≤20 | — | não | externo |
| `racaCor` | enum e-SUS | LGPD Art. 11 | não | externo |
| `genderIdentity` | enum e-SUS | LGPD Art. 11 | não | externo |
| `situacaoRua` | boolean | LGPD Art. 11 | não | externo |
| `deficiencia` | enum[] e-SUS | LGPD Art. 11 | não | externo |
| `hivGestante` | boolean | LGPD Art. 11 | não | externo |
| `sifilis` | boolean | LGPD Art. 11 | não | externo |
| `familyCode` | string(30) | — | não | externo |
| `sourceId` | string | — | SIM (importação) | gerado no pipeline |
| `importJobId` | UUID | — | SIM (importação) | Import Job |
| `sourceSystem` | string | — | SIM (importação) | Source Profile |
| `inactive` | boolean | — | não | externo/VITRAS |

**Regra de identidade:** CPF ou CNS obrigatório para deduplicação. Paciente sem CPF e sem CNS pode ser importado mas fica marcado como `incompleteProfile = true` e não participa da deduplicação automática.

**Enums canônicos de `careCategory`:**

| Valor | Descrição | Protocolo |
|---|---|---|
| `general` | Geral / Atenção Básica | PNAB-2017 |
| `pregnant` | Gestante | Rede Cegonha |
| `puerperal` | Puérpera | Rede Cegonha |
| `child_followup` | Puericultura | Calendário PNI |
| `chronic` | Condição Crônica | DCNT 2021-2030 |

**Enums canônicos de `racaCor`:** `BRANCA`, `PRETA`, `PARDA`, `AMARELA`, `INDIGENA`

**Enums canônicos de `genderIdentity`:** `HOMEM_CISSGENERO`, `MULHER_CISSGENERO`, `HOMEM_TRANSGENERO`, `MULHER_TRANSGENERO`, `NAO_BINARIO`, `OUTRO`, `NAO_INFORMADO`

**Enums canônicos de `deficiencia`:** `AUDITIVA`, `VISUAL`, `INTELECTUAL_COGNITIVA`, `FISICA`, `MULTIPLA`, `NAO_INFORMADO`

### Domínio 2 — Profissional (User)

| Campo canônico | Tipo | Obrigatório |
|---|---|---|
| `id` | UUID v4 | SIM (gerado) |
| `name` | string(200) | SIM |
| `email` | string(200) | SIM (único no tenant) |
| `role` | enum RBAC (14 roles) | SIM |
| `teamId` | UUID VITRAS | SIM |
| `unitId` | UUID VITRAS | SIM |
| `councilType` | `COREN` / `CRM` / `CFO` / etc. | não |
| `councilNumber` | string | não |
| `councilUf` | UF 2 letras | não |
| `municipalityId` | IBGE 7 dígitos | não |
| `inactive` | boolean | não |

**Regras de importação de profissionais:** email é identidade única. Profissional já existente com mesmo email: merge de dados, não duplicação. Role nunca rebaixado automaticamente — apenas elevado ou preservado.

### Domínio 3 — Equipe (Team)

| Campo canônico | Tipo | Obrigatório |
|---|---|---|
| `id` | UUID v4 | SIM (gerado) |
| `name` | string(200) | SIM |
| `unitId` | UUID VITRAS | SIM |
| `managerUserId` | UUID VITRAS | não |

**Regra:** equipes são criadas por console nacional antes da importação. Pacientes importados são vinculados a equipes existentes — importação não cria equipes automaticamente.

### Domínio 4 — Unidade (Unit)

| Campo canônico | Tipo | Obrigatório |
|---|---|---|
| `id` | UUID v4 | SIM (gerado) |
| `name` | string(200) | SIM |
| `municipalityId` | IBGE 7 dígitos | SIM |
| `cnes` | string(7 dígitos) | não |
| `inactive` | boolean | não |

**Regra:** unidades existem antes da importação. Import Job especifica `unitId` de destino. Importação não cria unidades.

### Domínio 5 — Evento Assistencial (Clinical Event)

Ver Fase 3 para definição completa.

### Domínio 6 — Condição Clínica (Clinical Condition)

Condição clínica é derivada de campos do paciente + eventos assistenciais. Não é entidade própria — é interpretação.

| Campo fonte | Campo canônico derivado | Lógica |
|---|---|---|
| `careCategory` | condição principal | direto |
| `chronicConditions[]` | condições crônicas | lista livre |
| `hivGestante` | condição especial HIV | LGPD Art. 11 |
| `sifilis` | condição especial sífilis | LGPD Art. 11 |
| `cidPrincipal` | CID-10 primário | do registro clínico |
| `cidSecundarios[]` | CIDs secundários | do registro clínico |
| `ciapPrincipal` | CIAP-2 primário | do registro clínico |

### Domínio 7 — Indicador (Indicator)

Indicadores não são importados — são calculados. O engine `evaluateGroup()` recalcula automaticamente após cada commit.

**5 componentes do score (0–100):**

| Componente | Peso | Critério |
|---|---|---|
| `recentVisit` | 25 | Visita ACS com `desfecho=VISITA_REALIZADA` nos últimos 90 dias |
| `updatedRegistration` | 25 | Todos os membros ativos atualizados há < 12 meses |
| `allCns` | 15 | Todos os membros ativos têm CNS preenchido |
| `completeAddress` | 15 | Endereço válido no grupo/membros |
| `noOverdueTasks` | 20 | Sem tarefas em atraso |

**Classificação:**

| Score | Classificação |
|---|---|
| ≥ 80 | HEALTHY |
| 50–79 | ATTENTION |
| < 50 | CRITICAL |

**Implicação para importação:** visitas importadas com `desfecho=VISITA_REALIZADA` e `dataVisita` dentro dos últimos 90 dias afetam o score diretamente. Isso é esperado e correto — reflete situação real da família. Histórico mais antigo (> 90 dias) não afeta score mas é preservado.

### Domínio 8 — Território (Territory)

| Entidade | Campo canônico | Origem |
|---|---|---|
| Município | `municipalityId` (IBGE 7 dígitos) | externo |
| Microárea | `microArea` (string livre) | externo |
| Domicílio | `Household` (entidade própria) | externo/VITRAS |
| Grupo familiar | `FamilyGroup` (entidade própria) | VITRAS |

**Household canônico:**

| Campo | Tipo | Enum fonte |
|---|---|---|
| `id` | UUID | gerado |
| `patientId` | UUID | vinculado |
| `teamId` | UUID | vinculado |
| `familyCode` | string(30) | externo |
| `housingType` | enum | `DOMICILIO` / `COMERCIO` / `TERRENO_BALDIO` / etc. |
| `waterSupply` | enum | e-SUS CDS |
| `sewage` | enum | e-SUS CDS |
| `garbage` | enum | e-SUS CDS |
| `electricity` | enum | e-SUS CDS |
| `homeVisitFreq` | enum | e-SUS CDS |

---

## FASE 3 — Clinical Event Model

### Definição

Evento assistencial é qualquer interação clínica, administrativa ou territorial registrada no VITRAS APS com data, tipo e paciente vinculado.

### Tipos oficiais de evento

| Tipo canônico | Categoria | Origem CDS | RBAC |
|---|---|---|---|
| `consultation` | Atendimento clínico | AtendimentoIndividual | doctor, nurse_manager, dentist |
| `return` | Retorno | AtendimentoIndividual | doctor, nurse_manager |
| `procedure` | Procedimento | AtendimentoIndividual | todos clínicos |
| `note` | Anotação clínica | livre | todos clínicos |
| `prescription` | Prescrição | livre | doctor, nurse_manager |
| `exam_request` | Solicitação de exame | livre | doctor, nurse_manager |
| `referral` | Encaminhamento | livre | todos clínicos |
| `nursing` | Procedimento enfermagem | livre | nurse_manager |
| `evolution` | Evolução clínica | livre | todos clínicos |
| `attendance_attest` | Atestado de comparecimento | livre | todos clínicos |
| `medical_attest` | Atestado médico | livre | doctor |
| `visit` | Visita domiciliar ACS | FichaVisitaDomiciliar | acs |
| `vaccine` | Vacinação | FichaVacinacao (futuro) | todos clínicos |

### Campos obrigatórios por tipo

**Todos os tipos:**

| Campo | Tipo | Obrigatório |
|---|---|---|
| `id` | UUID v4 | SIM (gerado) |
| `patientId` | UUID VITRAS | SIM |
| `teamId` | UUID VITRAS | SIM |
| `type` | enum acima | SIM |
| `date` | YYYY-MM-DD | SIM |
| `createdBy` | UUID VITRAS | SIM |
| `createdAt` | ISO 8601 | SIM (gerado) |
| `importJobId` | UUID | SIM (importação) |
| `sourceSystem` | string | SIM (importação) |
| `sourceId` | string | SIM (importação) |

**Tipo `visit` — campos adicionais obrigatórios:**

| Campo | Tipo | Valores |
|---|---|---|
| `dataVisita` | YYYY-MM-DD | data da visita |
| `turno` | enum | `MANHA`, `TARDE`, `NOITE` |
| `tipoVisita` | enum | `VISITA_PERIODICA`, `BUSCA_ATIVA`, `INVESTIGACAO_SURTO`, `EDUCACAO_SAUDE`, `ATENDIMENTO_URGENCIA`, `VISITA_POS_INTERNACAO`, `ACOMPANHAMENTO_CONDICIONALIDADES`, `OUTRO` |
| `motivosVisita` | enum[]≥1 | 21 valores e-SUS |
| `desfecho` | enum | `VISITA_REALIZADA`, `AUSENTE`, `RECUSOU` |

**Tipo `consultation` / `return` — campos adicionais:**

| Campo | Tipo | Obrigatório |
|---|---|---|
| `turno` | enum | não |
| `localDeAtendimento` | enum | não |
| `cidPrincipal` | CID-10 | não |
| `cidSecundarios[]` | CID-10[] | não |
| `ciapPrincipal` | CIAP-2 | não |
| `demandType` | `scheduled` / `spontaneous` | não |

### Regras de importação de eventos

1. **`createdBy` obrigatório:** evento importado deve ter profissional de origem mapeado para um usuário VITRAS existente na UBS. Evento sem profissional identificável = rejeitado.
2. **`date` no passado:** eventos importados têm `date` no passado. Isso é correto e esperado.
3. **Deduplicação:** evento com mesmo `sourceId` + `importJobId` não é reimportado. Idempotência por `sourceId`.
4. **Score impact:** visitas com `desfecho=VISITA_REALIZADA` e `dataVisita` dentro de 90 dias antes do commit afetam score imediatamente.
5. **LGPD:** `cidPrincipal`, `cidSecundarios`, `ciapPrincipal` são campos de categoria especial — redacted em audit logs (implementado em `audit.js: SPECIAL_CATEGORY_FIELDS`).

---

## FASE 4 — Source Profile

### Definição

Source Profile é o documento técnico que descreve um sistema de origem específico: sua estrutura de dados, versão, vocabulário, capacidades e limitações conhecidas. É a base sobre a qual o Mapping Engine opera.

### Estrutura canônica do Source Profile

```json
{
  "id": "uuid-v4",
  "name": "Nome do sistema",
  "type": "pec | api_municipal | csv | hl7_fhir | esus_csv | planilha | outro",
  "version": "string semver ou data",
  "encoding": "UTF-8 | ISO-8859-1 | outro",
  "format": "json | csv | xml | hl7 | fhir_json | outro",
  "locale": "pt-BR",
  "fields": {
    "patient_name": { "path": "$.paciente.nome", "type": "string", "nullable": false },
    "patient_cpf":  { "path": "$.paciente.cpf",  "type": "string", "nullable": true },
    ...
  },
  "quirks": [
    "CPF pode conter pontuação — normalizar antes de hash",
    "Data no formato DD/MM/AAAA — converter para YYYY-MM-DD",
    "Campo 'raca' usa valores legados: 01=Branca, 02=Preta — mapear para enum e-SUS"
  ],
  "capabilities": {
    "hasCpf": true,
    "hasCns": false,
    "hasClinicalRecords": true,
    "hasVisits": false,
    "hasMicroArea": true
  },
  "certifiedBy": "uuid-do-support-admin",
  "certifiedAt": "2026-06-23T00:00:00Z",
  "status": "certified | draft | deprecated"
}
```

### Ciclo de vida do Source Profile

```
DRAFT → revisão técnica → CERTIFIED → em uso em Import Jobs
     ↓ problema encontrado ↓
  DEPRECATED → novo Source Profile criado
```

### Regras de certificação

1. Source Profile só pode ser certificado por `support_admin`.
2. Source Profile `DRAFT` pode ser usado em Import Jobs de staging — nunca em commit de produção.
3. Source Profile `DEPRECATED` bloqueia novos Import Jobs — Import Jobs existentes concluem, novos são rejeitados.
4. Mudança de versão do sistema de origem exige novo Source Profile (versão incrementada) ou atualização com recertificação.

### Profiles de origem conhecidos (referência)

| Sistema | Tipo | Capabilities esperadas |
|---|---|---|
| e-SUS PEC (CSV Export) | `pec` | hasCpf=true, hasCns=true, hasClinicalRecords=true, hasVisits=true |
| e-SUS PEC (API v3) | `api_municipal` | hasCpf=true, hasCns=true |
| Planilha municipal genérica | `planilha` | hasCpf=true, hasCns=false, hasClinicalRecords=false |
| HL7 FHIR R4 | `hl7_fhir` | hasCpf=true, hasCns=true, hasClinicalRecords=true |
| CSV simples de cadastro | `csv` | hasCpf=condicional, hasCns=false |

**Nenhum desses profiles está implementado.** Esta lista é referência arquitetural — implementação ocorre em sprints derivadas.

---

## FASE 5 — Import Job

### Definição

Import Job é a unidade atômica de importação. Encapsula uma operação completa de importação: da recepção dos dados brutos ao commit em produção (ou descarte em staging).

### Estrutura canônica do Import Job

```json
{
  "id": "uuid-v4",
  "unitId": "uuid-vitras",
  "teamId": "uuid-vitras",
  "sourceProfileId": "uuid-source-profile",
  "sourceSystem": "nome-do-sistema-origem",
  "status": "received | profiling | mapping | validating | selecting | staging | homologating | committed | discarded | failed",
  "createdBy": "uuid-support-admin",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601",
  "stats": {
    "totalRaw": 0,
    "profiled": 0,
    "mapped": 0,
    "validated": 0,
    "rejected": 0,
    "selected": 0,
    "staged": 0,
    "committed": 0
  },
  "errors": [
    { "stage": "mapping", "field": "racaCor", "value": "03", "reason": "valor não mapeável" }
  ],
  "homologationResult": null,
  "homologatedBy": null,
  "homologatedAt": null,
  "commitAt": null,
  "auditHash": "sha256 do payload final comprometido"
}
```

### Ciclo de vida de status

```
received
  ↓ source profiling automático
profiling
  ↓ profile identificado
mapping
  ↓ mapping aplicado
validating
  ↓ validation engine
selecting
  ↓ population selection
staging
  ↓ revisão humana
homologating
  ↓ GO           ↓ NO GO
committed      discarded
  
failed ← qualquer fase pode transitar aqui
```

**Regras de transição:**

- `received → failed`: profiling não identificou sistema de origem
- `mapping → failed`: < 50% dos campos obrigatórios mapeados (threshold configurável por Source Profile)
- `staging → discarded`: homologador rejeita explicitamente
- `committed`: irreversível — dados em produção
- `failed` / `discarded`: dados de staging são deletados; raw data é preservado para auditoria

### Rastreabilidade por Import Job

Todo dado comprometido via Import Job carrega permanentemente:
- `importJobId`: referência ao Import Job
- `sourceId`: ID do registro no sistema de origem
- `sourceSystem`: nome do sistema de origem (redundante para legibilidade)

Permite responder: "Qual é a origem deste paciente?" em qualquer momento futuro.

---

## FASE 6 — Mapping Engine

### Definição

Mapping Engine transforma dados do vocabulário do sistema de origem para o Canonical Model do VITRAS. Opera sobre o Source Profile para saber como interpretar cada campo.

### Dois tipos de mapeamento

**Tipo 1 — Mapeamento Estrutural**

Tradução de paths: onde fica o dado no sistema de origem.

```
Origem: $.paciente.dataNascimento → Canonical: patient.birthDate
Origem: $.nome_completo          → Canonical: patient.name
Origem: $.CPF                    → Canonical: patient.cpf (normalizar: remover pontuação)
Origem: $.nroCNS                 → Canonical: patient.cns
```

**Tipo 2 — Mapeamento Semântico**

Tradução de vocabulários: o que o valor significa.

```
Origem: raca=01 → Canonical: racaCor="BRANCA"
Origem: raca=02 → Canonical: racaCor="PRETA"
Origem: raca=03 → Canonical: racaCor="PARDA"
Origem: sexo=M  → Canonical: sexAtBirth="MASCULINO"
Origem: sexo=F  → Canonical: sexAtBirth="FEMININO"
```

### Regra de certeza de 100%

**Campo mapeável apenas quando há correspondência unívoca e sem ambiguidade.**

| Situação | Ação |
|---|---|
| Mapeamento direto e único | Aplicado |
| Mapeamento com heurística ou estimativa | **REJEITADO** — campo não mapeado |
| Valor desconhecido no enum de origem | **REJEITADO** — campo não mapeado |
| Valor nulo/vazio | Preservado como nulo — não rejeitado |
| Campo inexistente no Source Profile | Ignorado — não mapeado |

**Exemplos de rejeições obrigatórias:**

- `raca=09` (valor não reconhecido) → `racaCor` não mapeado (campo opcional, sem racaCor)
- `tipo_atendimento=X` sem correspondência → `type` não mapeado → evento rejeitado (campo obrigatório)
- `data_nascimento=32/13/1985` → `birthDate` não mapeado → paciente rejeitado

### Normalização obrigatória antes do mapeamento

| Campo | Normalização |
|---|---|
| CPF | Remover `.` e `-`. Validar 11 dígitos. |
| CNS | Remover espaços. Validar 15 dígitos. |
| Data | Converter DD/MM/AAAA → YYYY-MM-DD |
| Nome | Trim. Capitalização mantida. |
| Email | Lowercase. Trim. |
| Telefone | Manter apenas dígitos. |
| Enums | Uppercase. Trim. |
| CID-10 | Uppercase. Remover espaços. Formato `[A-Z]\d{2,4}(\.\d{1,4})?` |
| CIAP-2 | Uppercase. Formato `[A-Z]\d{2}` |

### Bloqueio de ambiguidade

Se um Source Profile declara dois campos como possíveis origens do mesmo campo canônico, o Mapping Engine exige escolha explícita na configuração do profile. Ambiguidade não resolvida = Import Job falha na fase de `mapping`.

---

## FASE 7 — Validation Engine

### Regras de validação obrigatórias

**Grupo 1 — Identidade**

| Regra | Descrição | Resultado se falha |
|---|---|---|
| V-ID-01 | CPF ou CNS presente | `incompleteProfile = true` — não rejeita |
| V-ID-02 | CPF com 11 dígitos e dígito verificador válido | Rejeita paciente |
| V-ID-03 | CNS com 15 dígitos | Rejeita paciente |
| V-ID-04 | Nome com ao menos 2 caracteres | Rejeita paciente |
| V-ID-05 | birthDate válida (não futura, ≥ 1900) | Rejeita paciente |
| V-ID-06 | CPF duplicado no mesmo Import Job | Rejeita duplicata — mantém primeiro |
| V-ID-07 | CPF ou CNS já existente em produção | Paciente marcado para merge — não duplica |

**Grupo 2 — Território**

| Regra | Descrição | Resultado se falha |
|---|---|---|
| V-TER-01 | `municipalityId` com 7 dígitos IBGE | Rejeita paciente |
| V-TER-02 | `municipalityId` compatível com UBS de destino | Rejeita paciente |
| V-TER-03 | `teamId` de destino existe na UBS | Rejeita paciente |
| V-TER-04 | `unitId` de destino existe | Rejeita import job |

**Grupo 3 — Integridade referencial**

| Regra | Descrição | Resultado se falha |
|---|---|---|
| V-REF-01 | `patientId` de evento existe no mesmo Import Job ou em produção | Rejeita evento |
| V-REF-02 | `createdBy` de evento existe como usuário na UBS | Rejeita evento |
| V-REF-03 | `cidPrincipal` existe na tabela CID-10 | Rejeita campo (evento mantido sem CID) |
| V-REF-04 | `ciapPrincipal` existe na tabela CIAP-2 | Rejeita campo (evento mantido sem CIAP) |

**Grupo 4 — Completude mínima**

| Regra | Descrição | Resultado se falha |
|---|---|---|
| V-COMP-01 | Evento `type=visit` tem `desfecho` | Rejeita evento |
| V-COMP-02 | Evento `type=visit` tem `motivosVisita[]` com ao menos 1 item | Rejeita evento |
| V-COMP-03 | Evento `type=visit` tem `tipoVisita` | Rejeita evento |
| V-COMP-04 | `careCategory` é um dos 5 valores canônicos | Rejeita — usa `general` como fallback |

**Grupo 5 — LGPD**

| Regra | Descrição | Ação |
|---|---|---|
| V-LGPD-01 | Campos Art. 11 identificados antes do audit log | Redacted em `[REDACTED-SPECIAL-CATEGORY]` nos logs |
| V-LGPD-02 | CPF e CNS nunca aparecem em logs de importação | Masked ou omitidos no log |
| V-LGPD-03 | Consentimento da UBS para importação registrado | Import Job só inicia com consentimento explícito |

### Threshold de rejeição

| Métrica | Threshold default | Ação se excedido |
|---|---|---|
| Registros rejeitados por V-ID | > 30% | Import Job pausado — revisão manual |
| Eventos sem paciente (V-REF-01) | > 50% | Import Job falha |
| Pacientes sem CPF nem CNS (V-ID-01) | > 80% | Import Job pausado — fonte suspeita |

Thresholds são configuráveis por Source Profile — cada sistema de origem pode ter tolerâncias diferentes.

---

## FASE 8 — Population Selection Engine

### Definição

Population Selection Engine decide quais pacientes de um Import Job efetivamente entram em staging. Filtra por elegibilidade clínica, territorial e operacional.

### Critérios nacionais de elegibilidade

**Critério E-01 — Atividade territorial (obrigatório)**

Paciente deve ter ao menos um dos seguintes:
- Evento assistencial nos últimos **24 meses** (data do Import Job como referência)
- Visita ACS nos últimos **12 meses**
- Data de cadastro nos últimos **12 meses**

Racional: paciente sem atividade recente provavelmente mudou de área ou faleceu. Importar sem evidência de atividade gera ruído nos indicadores.

**Critério E-02 — Vínculo territorial confirmado (obrigatório)**

Paciente deve ter `municipalityId` compatível com a UBS de destino. Importar paciente de outro município para uma UBS diferente é erro de origem — rejeita.

**Critério E-03 — Identidade mínima (obrigatório)**

Paciente deve ter ao menos `name` + `birthDate` preenchidos. Sem esses campos: rejeita.

**Critério E-04 — Deduplicação ativa**

Paciente com CPF ou CNS já existente em produção: não cria novo registro. Avalia merge:
- Se dados de origem são mais recentes: merge candidato (requer confirmação na homologação)
- Se dados de produção são mais recentes: mantém produção, descarta importado com log

**Critério E-05 — Inatividade explícita**

Paciente marcado como `inactive = true` no sistema de origem: importado com `inactive = true`. Não aparece no dashboard, não afeta score, mas é preservado para histórico.

### Critérios locais (configuráveis pela UBS)

A UBS pode configurar critérios adicionais no Import Job:

| Critério local | Exemplo | Efeito |
|---|---|---|
| `microArea` filter | Importar apenas microárea "A" | Filtra por microArea |
| `careCategory` filter | Importar apenas gestantes | Filtra por careCategory |
| `teamId` filter | Importar apenas para equipe X | Vincula pacientes à equipe específica |
| `dateFrom` filter | Apenas atividade a partir de 2024 | Filtra eventos por data |
| `maxPatients` | Limitar a 500 pacientes por batch | Controle de volume |

### Resultado do Selection Engine

```json
{
  "total_candidates": 1000,
  "selected": 847,
  "rejected_no_activity": 89,
  "rejected_wrong_municipality": 12,
  "rejected_no_identity": 8,
  "merged_candidates": 44,
  "inactive_included": 23
}
```

---

## FASE 9 — Staging e Homologação

### Staging — ambiente de pré-produção

**Definição:** espaço isolado onde dados importados ficam visíveis apenas para o homologador antes de qualquer commit em produção.

**Características obrigatórias do staging:**

| Propriedade | Regra |
|---|---|
| Isolamento | Dados de staging não aparecem em dashboard, busca, score nem indicadores de produção |
| Imutabilidade | Dados de staging não podem ser editados — apenas aprovados ou descartados |
| Visibilidade | Apenas `break_glass_admin` e `support_admin` com permissão explícita veem staging |
| Expiração | Import Job em staging por > 30 dias sem ação: alerta automático |
| Reversão | Descarte de staging é total — não existe descarte parcial por registro individual |

**Estrutura do ambiente de staging:**

```
app_import_staging (tabela separada, não parte do app_state JSONB)
├── import_job_id (FK para import_jobs)
├── entity_type  (patient | clinical_event | household)
├── canonical_data (JSONB — payload no Canonical Model)
├── source_id (ID no sistema de origem)
├── validation_status (valid | warning | rejected)
├── merge_candidate (boolean)
├── merge_target_id (UUID em produção, se merge candidate)
└── created_at
```

### Homologação — revisão humana obrigatória

**Definição:** processo formal de aprovação humana antes do commit em produção.

**Etapas obrigatórias:**

1. **Amostragem:** selecionar ao menos 5% dos registros em staging (mínimo 10, máximo 200) para revisão manual.
2. **Revisão:** homologador verifica se dados mapeados correspondem ao esperado para a UBS.
3. **Checklist de homologação:**
   - [ ] Nomes legíveis e sem corrupção de encoding
   - [ ] Datas dentro de range plausível
   - [ ] `careCategory` distribuída de forma plausível
   - [ ] Eventos clínicos com tipo correto
   - [ ] Dados LGPD (racaCor, genderIdentity) ausentes ou corretos
   - [ ] Sem pacientes duplicados visíveis na amostra
   - [ ] Merge candidates revisados (se existirem)
4. **Decisão:**
   - **GO:** commit autorizado para toda a população selecionada
   - **NO GO com motivo:** staging descartado, Import Job marcado como `discarded`
   - **GO PARCIAL:** não existe — commit é total ou não ocorre

**Quem pode homologar:**

| Role | Pode homologar? |
|---|---|
| `break_glass_admin` | SIM (UBS específica) |
| `support_admin` | SIM (qualquer UBS) |
| `gestor` | NÃO — conflito de interesse (gestor quer dados; homologador deve ser neutro) |

### Commit Controlado

**Definição:** inserção atômica dos dados de staging em produção após GO da homologação.

**Propriedades obrigatórias:**

| Propriedade | Implementação |
|---|---|
| Atomicidade | Transação PostgreSQL única — tudo ou nada |
| Rastreabilidade | Cada registro recebe `importJobId` + `sourceId` permanentemente |
| Idempotência | Commit com mesmo `importJobId` já processado = no-op (protege contra duplo clique) |
| Incrementalidade | Usa shadow sync incremental (REM-01) — não faz sync completo da base |
| Auditoria | `audit_log` registra cada entidade commitada (ação: `import.commit`) |
| Score | `evaluateGroup()` recalculado automaticamente para todos os grupos afetados |
| Irreversibilidade | Não existe rollback de commit — dados em produção são permanentes |

**Sequência de commit:**

```
1. BEGIN TRANSACTION
2. Para cada paciente: upsert (se merge candidate) ou INSERT
3. Para cada evento: INSERT (idempotente por sourceId + importJobId)
4. Para cada household: upsert por patientId
5. syncShadowTables (incremental — REM-01)
6. Para cada grupo familiar afetado: evaluateGroup() → atualizar score
7. INSERT em app_audit_logs: ação "import.committed", entidade "import_job"
8. UPDATE import_jobs SET status='committed', commit_at=NOW()
9. COMMIT
```

---

## FASE 10 — Auditoria e LGPD

### Rastreabilidade integral

Todo Import Job é auditado em três níveis:

**Nível 1 — Import Job level:**

```
import.job.created    → Import Job criado
import.profiling.done → Source Profile identificado
import.mapping.done   → Mapeamento concluído
import.validation.done → Validação concluída
import.selection.done → Seleção concluída
import.staged         → Dados em staging
import.homologation.go    → GO aprovado
import.homologation.no_go → NO GO registrado
import.committed      → Commit em produção
import.discarded      → Staging descartado
```

**Nível 2 — Record level:**

Cada registro commitado em produção gera `audit_log` com:
- `action`: `import.patient.committed` | `import.event.committed` | `import.household.committed`
- `entity`: tipo da entidade
- `entityId`: UUID gerado
- `details`: `{ importJobId, sourceId, sourceSystem, stage: "import" }`
- Hash chain preservado (AUD-01)

**Nível 3 — Raw data:**

Dados brutos são preservados no `app_import_raw` com hash de integridade (SHA-256 do payload original). Dados brutos nunca são alterados — apenas referenciados.

### LGPD — tratamento de dados de categoria especial

**Campos Art. 11 identificados:**

| Campo | Classificação LGPD |
|---|---|
| `genderIdentity` | Dado de saúde (Art. 11) |
| `racaCor` | Dado sensível (Art. 5 + 11) |
| `situacaoRua` | Dado sensível (Art. 5 + 11) |
| `deficiencia` | Dado de saúde (Art. 11) |
| `hivGestante` | Dado de saúde (Art. 11) |
| `sifilis` | Dado de saúde (Art. 11) |
| `cidPrincipal` | Dado de saúde (Art. 11) |
| `cidSecundarios` | Dado de saúde (Art. 11) |
| `ciapPrincipal` | Dado de saúde (Art. 11) |

**Regras de tratamento no pipeline de importação:**

1. **Identificação antes do raw storage:** campos Art. 11 são identificados por tipo (não por valor) e marcados no Import Job.
2. **Audit logs:** campos Art. 11 nunca aparecem em `before`/`after` de audit logs — substituídos por `[REDACTED-SPECIAL-CATEGORY]`.
3. **Mapeamento:** campos Art. 11 só são mapeados se o Source Profile declarar explicitamente que o campo existe e a UBS consentiu com o tratamento.
4. **Staging:** campos Art. 11 visíveis apenas para homologadores com permissão explícita.
5. **Criptografia em repouso:** CPF e CNS criptografados via AES-256-GCM (já implementado). Demais dados Art. 11 em produção: sem criptografia adicional por ora — decisão revisável.
6. **Consentimento:** Import Job requer campo `lgpdConsentRecordId` (referência a documento de consentimento da UBS) — não é validado tecnicamente no MVP, mas é exigido como campo obrigatório para auditoria.

### Resposta a requisições LGPD

Paciente com `privacy_request` de tipo `deletion` que foi importado: o registro importado deve seguir o mesmo fluxo de anonimização que qualquer outro paciente. `importJobId` e `sourceId` são preservados mesmo após anonimização — eles não são dados pessoais.

---

## FASE 11 — Dependências

### Bloqueadores obrigatórios antes da fase de API de ingestão

| Bloqueador | Descrição | Status | Sprint |
|---|---|---|---|
| **REM-01** | Shadow sync incremental — sem isso, importação bulk executa DELETE+INSERT de toda base por paciente | PLANNED | TECH-SCALE-01A |
| **REM-02** | Bootstrap paginado — sem isso, gestor não consegue carregar dashboard após importação grande | PLANNED | TECH-SCALE-01B |

**Consequência concreta de ignorar REM-01:**

Importar 500 pacientes em UBS com 10.000 existentes = 500 × DELETE+INSERT 10.000 = 5 milhões de operações de linha. Estimativa de duração: 30–90 minutos. Inaceitável.

**Consequência concreta de ignorar REM-02:**

Após importação de 2.000 pacientes em UBS com 8.000: gestor carrega bootstrap com 10.000 pacientes = ~20 MB JSON. Em mobile 3G: 160 segundos de carregamento. Inaceitável para campo.

### O que pode avançar agora (sem REM-01 e REM-02)

| Item | Status |
|---|---|
| Definição de Source Profile para PEC CSV | Pode avançar |
| Definição de mapeamento PEC → Canonical | Pode avançar |
| Design de UI de homologação | Pode avançar |
| Design de UI de Import Job | Pode avançar |
| Estrutura de banco `app_import_staging` | Pode avançar |
| Testes de mapeamento (sem commit real) | Pode avançar |
| **API de ingestão com commit real** | **BLOQUEADO — aguarda REM-01** |
| **Import Job com população > 100 pacientes** | **BLOQUEADO — aguarda REM-01** |

### Sequência oficial pós ARCH-INT-01

```
TECH-SCALE-01A (REM-01 — shadow sync incremental)
      ↓
TECH-SCALE-01B (REM-02 — bootstrap paginado)
      ↓
VAL-01 (Validation Engine — implementação)
      ↓
STG-01 (Import Staging — tabelas + UI)
      ↓
MAP-01 (Mapping Engine — implementação, começar com PEC CSV)
      ↓
MIG-01 (Bulk Import API — endpoints de ingestão)
      ↓
MIG-02 (Source Profile Registry — UI de gestão)
```

---

## RESULTADO OBRIGATÓRIO

| Item | Resultado |
|---|---|
| Arquitetura definida? | **SIM** |
| Modelo canônico definido? | **SIM** — 8 domínios, campos, enums e regras |
| Eventos assistenciais definidos? | **SIM** — 13 tipos, campos obrigatórios por tipo |
| Source Profile definido? | **SIM** — estrutura, ciclo de vida, certificação |
| Import Job definido? | **SIM** — estrutura, 10 estados, rastreabilidade |
| Mapping Engine definido? | **SIM** — mapeamento estrutural + semântico, regra 100% |
| Validation Engine definido? | **SIM** — 5 grupos, 18 regras, thresholds |
| Population Selection Engine definido? | **SIM** — 5 critérios nacionais + critérios locais |
| Staging definido? | **SIM** — isolamento, imutabilidade, expiração |
| Homologação definida? | **SIM** — checklist, roles, GO/NO GO |
| Auditoria definida? | **SIM** — 3 níveis, hash chain, LGPD Art. 11 |
| Dependências registradas? | **SIM** — REM-01 e REM-02 bloqueiam fase de API |
| **Status ARCH-INT-01** | **PASS** |

---

## Implicação para CTRL-01

ARCH-INT-01 é agora a referência oficial para:

- VAL-01 (Validation Engine)
- STG-01 (Import Staging)
- MAP-01 (Mapping Engine)
- MIG-01 (Bulk Import API)
- MIG-02 (Source Profile Registry)

Nenhuma dessas iniciativas pode ser implementada de forma incompatível com este documento. Divergências exigem atualização formal de ARCH-INT-01 com versão incrementada.
