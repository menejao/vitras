# MR-01 — Migration Readiness Assessment

**Emitido em:** 2026-06-23  
**Fonte:** Auditoria direta do código, entidades, serviços e documentação existentes  
**Status:** PASS  
**Próxima revisão:** Antes da primeira iniciativa de migração real

---

## GOV-01

| # | Critério | Resultado | Observação |
|---|---|---|---|
| 1 | Existe modelo canônico de dados do VITRAS? | **PARCIAL** | Entidades documentadas em `docs/ai/entities-map.md`; sem formato de importação canônico |
| 2 | Existe definição formal de evento assistencial? | **PARCIAL** | Tipos de `ClinicalRecord` e `acsVisit` definidos; sem vocabulário nacional formal de importação |
| 3 | Existe definição formal de paciente ativo? | **SIM** | `patient.inactive = false` — soft-delete, preserva dados históricos |
| 4 | Existe definição formal de vínculo equipe/paciente? | **SIM** | `patient.teamId` — FK para equipe responsável |
| 5 | Existe estratégia para absorver dados externos? | **PARCIAL** | INTEGRATION-GOV-01A define o processo; capacidade técnica ausente |
| 6 | Existe estratégia para de/para estrutural? | **NÃO** | Sem Mapping Engine implementado |
| 7 | Existe estratégia para de/para semântico? | **NÃO** | Sem Canonical Import Model definido |
| 8 | Existe estratégia para seleção populacional? | **NÃO** | Sem Population Selection Engine |
| 9 | Existe estratégia para validação antes da produção? | **NÃO** | Sem staging de importação, sem dry-run |
| 10 | Existe estratégia para homologação de importação? | **PARCIAL** | INTEGRATION-GOV-01A define processo; sem implementação técnica |
| 11 | Existe estratégia para auditoria de migração? | **PARCIAL** | Audit trail existe mas não projetado para operações bulk |
| 12 | Produto preparado para 50.000 pacientes? | **NÃO** | JSONB em `app_state` único — risco de performance não validado nessa escala |
| 13 | Produto preparado para 300.000 eventos assistenciais? | **NÃO** | Eventos aninhados em `patient.clinicalRecords[]` — sem particionamento |
| 14 | Existe dependência de UBS específica? | **NÃO** | Modelo é multi-tenant por design |
| 15 | Existe dependência de município específico? | **NÃO** | Hardcodes removidos em ARCH-01 |

**MR-01 GOV-01:** NÃOs identificados são **lacunas arquiteturais esperadas** — não bloqueiam este parecer, pois MR-01 tem como objetivo precisamente documentá-las. O parecer é emitido para registrar o estado real do produto, não para exigir que todas as capacidades já existam.

---

## FASE 1 — Mapa Conceitual do Modelo Atual

### Armazenamento

| Camada | Tecnologia | Função |
|---|---|---|
| Fonte canônica | PostgreSQL JSONB (`app_state.data`) | Todas as escritas — transacionais com `FOR UPDATE` |
| Shadow relacional | `app_users`, `app_patients`, `app_appointments`, `app_audit_logs`, `app_refresh_tokens`, `app_role_permissions`, `app_units` | Projeções para queries SQL |
| File mode | `data/db.json` | Desenvolvimento local apenas |

### Entidades principais

| Entidade | Chave | Relacionamento | Tenant scope |
|---|---|---|---|
| `Patient` | UUID | `teamId` → Team | Equipe |
| `User` | UUID | `teamId` + `unitId` | Equipe + Unidade |
| `Unit` | string (max 50) | — | Nacional |
| Team (implícito) | UUID | `unitId` → Unit | Unidade |
| `ClinicalRecord` | UUID | aninhado em `patient.clinicalRecords[]` | Herda paciente |
| `acsVisit` | UUID | `patientId` + `acsId` | Equipe |
| `FamilyGroup` | UUID | `members[]` → Patient UUIDs | Equipe |
| `Appointment` | UUID | aninhado em `patient.appointments[]` | Herda paciente |
| `Exam` | UUID | `patientId`, `teamId` | Equipe |
| `Referral` | UUID | `patientId`, `teamId` | Equipe |
| `QueueEntry` | UUID | `patientId`, `teamId` | Equipe |
| `Task` | UUID | `patientId?`, `teamId` | Equipe |
| `ProtocolTemplate` | UUID | `teamId` | Equipe |
| `PharmacyItem` | UUID | `teamId` | Equipe |
| `SupplyItem` | UUID | `teamId` | Equipe |
| `AuditLog` | UUID | hash chain SHA-256 | Global |

### Lacunas do modelo para importação

| Lacuna | Impacto |
|---|---|
| Sem `sourceId` / `externalId` em `Patient` | Impossível rastrear origem de registro importado; duplicatas não detectáveis por chave externa |
| Sem `sourceSystem` em entidades clínicas | Não é possível distinguir dado nativo de dado importado |
| `FamilyGroup.members[]` usa UUIDs internos | Importação de grupos requer UUIDs já criados — ordem de importação é dependente |
| `Appointment` e `ClinicalRecord` aninhados em `Patient` | Sem rota de importação bulk independente de paciente |
| Sem `importJobId` em nenhuma entidade | Impossível rastrear lote de importação para rollback |

---

## FASE 2 — Vocabulário Assistencial Nacional

### Eventos existentes no modelo VITRAS

#### ClinicalRecord (prontuário clínico)

| Tipo | Descrição | Quem cria | Equivalente e-SUS |
|---|---|---|---|
| `visit` | Consulta/visita clínica | ACS, nurse_manager, doctor | Atendimento Individual (AI) parcial |
| `prescription` | Prescrição médica | doctor, dentist | — |
| `medical_attest` | Atestado médico | doctor, dentist | — |
| `referral` | Encaminhamento clínico | qualquer prescriber | — |
| `evolution` | Evolução clínica | nurse_manager, doctor | — |
| `procedure` | Procedimento | clinical roles | — |
| `nursing_note` | Anotação de enfermagem | nurse_manager | — |
| `vaccine` | Vacinação | clinical roles | — |
| `exam_request` | Solicitação de exame | clinical roles | — |
| `other` | Outros | qualquer clinical | — |

#### acsVisit (visita domiciliar ACS)

| Campo | Valores | LEDI APS 7.4.0 |
|---|---|---|
| `desfecho` | `realizada`, `recusada`, `ausente` | Desfecho da Visita |
| `motivos[]` | array de códigos LEDI | Motivos da Visita |
| `acompanhamentos[]` | array de categorias | Acompanhamentos |

#### Appointment (agendamento)

| Campo | Valores |
|---|---|
| `status` | `scheduled`, `completed`, `cancelled` |
| `type` | tipo de atendimento (livre) |

### Lacunas de vocabulário para importação

| Lacuna | Criticalidade |
|---|---|
| Sem mapeamento formal: consulta médica → `ClinicalRecord.type` | CRÍTICA — PEC distingue por categoria de atendimento |
| Sem mapeamento: vacinação SIPNI → `vaccine` record | ALTA — campo-a-campo não definido |
| Sem mapeamento: procedimentos SIGTAP → `procedure` record | ALTA — codificação diferente |
| `type` de `Appointment` é string livre — sem enum nacional | MÉDIA — fontes externas podem usar qualquer valor |
| Visita domiciliar ACS (`acsVisit`) separada de `ClinicalRecord` | MÉDIA — sistemas externos podem não distinguir |
| Encaminhamento (`referral`) sem CID-10 / especialidade padronizada | MÉDIA — especialidades não têm enum fixo |

---

## FASE 3 — Estratégia de Identidade do Paciente

### Identificadores atuais

| Identificador | Armazenamento | Busca | Unicidade |
|---|---|---|---|
| CPF | AES-256-GCM (`enc1:` prefix) | HMAC-SHA256 (`cpf_hash`) | Índice único (Migration 006) |
| CNS | AES-256-GCM | HMAC-SHA256 (`cns_hash`) | Índice único (Migration 006) |
| UUID interno | plaintext | PK | Único global |

### Capacidade atual de deduplicação

| Cenário | Capacidade |
|---|---|
| Paciente com CPF já existente | DETECTA — hash único bloqueia inserção |
| Paciente com CNS já existente | DETECTA — hash único bloqueia inserção |
| Paciente sem CPF nem CNS | NÃO DETECTA — sem identificador alternativo |
| Paciente com CPF em formato diferente (com/sem máscara) | PARCIAL — depende de normalização antes do hash |
| Paciente com grafia diferente do nome | NÃO DETECTA — sem fuzzy match |
| Mesmo paciente em equipes diferentes | DETECTA por CPF/CNS hash (global) |

### Lacunas de identidade

| Lacuna | Criticalidade |
|---|---|
| Sem `externalId` para mapear ID do sistema fonte | CRÍTICA |
| Sem estratégia formal para pacientes sem CPF/CNS | CRÍTICA |
| Sem normalização garantida de CPF antes do hash (importação) | ALTA |
| Sem algoritmo de deduplicação fonética (Soundex, METAPHONE) | ALTA |
| Sem estratégia de merge de registros duplicados | ALTA |
| Sem campo `originSystem` para rastrear proveniência | MÉDIA |

---

## FASE 4 — Indicadores e Impacto de Dados Importados

### Indicadores atuais

#### Score de Busca Ativa (APS-01E)

| Componente | Peso | Dado necessário |
|---|---|---|
| Visita recente (acsVisit `realizada` < 90 dias) | 25 | `acsVisit.date` + `acsVisit.desfecho` |
| Cadastro atualizado (todos < 12 meses) | 25 | `patient.updatedAt` |
| Todos com CNS | 15 | `patient.cns` (descriptografado != null) |
| Endereço completo | 15 | `patient.address` (len > 5) |
| Sem tarefas atrasadas | 20 | `task.dueDate` + `task.status` |

**Impacto de importação:** dados históricos importados **impactam imediatamente** o score. Uma visita `realizada` importada com data recente altera classificação do grupo familiar. Risco de indicadores artificialmente positivos após importação.

#### Produção ACS (APS-01F)

| Indicador | Dado fonte |
|---|---|
| Total de visitas no período | `acsVisit.date` + `acsVisit.acsId` |
| Visitas realizadas/recusadas/ausentes | `acsVisit.desfecho` |
| Grupos familiares visitados | `acsVisit.patientId` → `familyGroup` |
| Microáreas cobertas | `patient.microArea` |

**Impacto de importação:** produção histórica de ACS seria atribuída ao ACS do VITRAS pelo `acsId`. Sem um ACS existente com o UUID correto, a produção histórica não pode ser atribuída.

#### Produção Enfermeiro/Gestor

| Indicador | Dado fonte |
|---|---|
| Atendimentos no período | `ClinicalRecord.type=visit` + `createdAt` |
| Agendamentos | `Appointment.status=completed` |

**Impacto de importação:** registros importados sem `createdBy` válido quebram atribuição de produção.

### Lacunas de indicadores

| Lacuna | Criticalidade |
|---|---|
| Score recalculado imediatamente após importação — sem período de graça | ALTA |
| `acsId` em `acsVisit` exige UUID de ACS existente — dados históricos perdem atribuição | ALTA |
| `createdBy` em `ClinicalRecord` exige UUID de usuário existente | ALTA |
| Sem mecanismo de reconstrução de score apenas para dados pós-importação | MÉDIA |
| Produção histórica não distinguível de produção atual | MÉDIA |

---

## FASE 5 — Diagnóstico de Prontidão para Migração

### Cenário: município entrega pacientes + consultas + visitas + exames

| Pergunta | Capacidade atual | Gap |
|---|---|---|
| Onde armazenar pacientes? | `POST /patients` funciona | Sem bulk import — 1 request por paciente |
| Como interpretar campos? | Manualmente por operador | Sem Mapping Engine |
| Como relacionar paciente → grupo familiar? | Criar FamilyGroup após pacientes | Ordem de importação obrigatória |
| Como relacionar paciente → equipe? | `teamId` obrigatório em cada paciente | Time deve existir antes da importação |
| Como validar CPF/CNS? | Hash unique index detecta duplicata | Sem validação de formato na importação bulk |
| Como homologar antes da produção? | Sem staging de importação | INTEGRATION-GOV-01A define processo; sem implementação |
| Como fazer rollback? | Sem mecanismo | Não implementado |
| Como auditar a importação? | Audit trail existe | Não projetado para operações bulk |
| Quantidade máxima de pacientes testada? | Não documentada | Risco de performance em JSONB com 50K+ |

---

## FASE 6 — Lacunas Arquiteturais

### CRÍTICAS — bloqueiam qualquer migração real

| # | Lacuna | Descrição |
|---|---|---|
| C-01 | Sem Bulk Import API | Sem endpoint para importação em lote; único caminho é criação individual via UI/API |
| C-02 | Sem `externalId` / `sourceId` em Patient | Impossível rastrear origem; impossível detectar duplicatas por ID externo |
| C-03 | Sem staging de importação | Impossível validar dados antes de impactar produção |
| C-04 | Sem dry-run | Impossível simular importação e gerar relatório sem gravar dados |
| C-05 | Escala JSONB não validada | `app_state` JSONB único com 50K pacientes + 300K eventos: performance não testada nem garantida |
| C-06 | `acsId` / `createdBy` exigem UUIDs existentes | Dados históricos de sistemas sem usuários VITRAS não têm atribuição possível |

### ALTAS — necessárias antes da primeira migração

| # | Lacuna | Descrição |
|---|---|---|
| A-01 | Sem Canonical Import Model | Sem formato neutro de source para VITRAS (JSON/CSV de importação) |
| A-02 | Sem Mapping Engine | Sem mecanismo de transformação campo a campo parametrizável |
| A-03 | Sem Validation Engine | Sem validação programática de CPF, CNS, datas, enums na importação |
| A-04 | Sem estratégia para pacientes sem CPF/CNS | Populações vulneráveis (situação de rua, indígenas) sem identificador padrão |
| A-05 | Sem `importJobId` nas entidades | Impossível rastrear qual registro veio de qual lote de importação |
| A-06 | Sem normalização garantida de encoding | UTF-8 assumido mas não imposto em importação |
| A-07 | Score impacta imediatamente após importação | Sem período de graça ou separação de scores históricos/operacionais |

### MÉDIAS — necessárias antes da primeira integração contínua

| # | Lacuna | Descrição |
|---|---|---|
| M-01 | Sem Population Selection Engine | Sem mecanismo para selecionar subpopulação para importação parcial |
| M-02 | Sem Source Profile Registry | Sem cadastro formal de sistemas-fonte e suas características |
| M-03 | Vocabulário assistencial sem enum fixo em alguns campos | `Appointment.type` livre — fontes externas podem usar qualquer valor |
| M-04 | Sem deduplicação fonética | Nome sozinho não é suficiente para dedup; sem Soundex/Jaro-Winkler |
| M-05 | Sem estratégia de merge de pacientes duplicados | Se duplicata detectada pós-importação, sem fluxo de resolução |
| M-06 | Produção histórica não distinguível de produção atual | Sem flag `isHistorical` nos eventos |

### BAIXAS — desejáveis mas não bloqueantes

| # | Lacuna | Descrição |
|---|---|---|
| B-01 | Audit trail não projetado para operações bulk | Cada registro individual cria 1 audit entry — 300K eventos = 300K audit logs |
| B-02 | Sem rollback de importação parcial | Importação com falha parcial deixa dados inconsistentes |
| B-03 | Sem UI de status de importação | Sem acompanhamento de progresso de jobs longos |
| B-04 | Sem relatório de divergência pós-importação | Sem comparação origem vs. VITRAS após importação |

---

## FASE 7 — Dependências Futuras

### Iniciativas necessárias (em ordem de dependência)

```
ARCH-INT-01 — Canonical Import Model
  Definir formato neutro JSON para importação de cada entidade.
  Fonte: qualquer sistema → Canonical → VITRAS.
  Prerequisito para: MAP-01, VAL-01, MIG-01
  
  └─→ MAP-01 — Mapping Engine
        Transformar campos de sistemas-fonte para o Canonical Model.
        Parametrizável por sistema-fonte.
        Prerequisito para: MIG-01, qualquer conector
  
  └─→ VAL-01 — Validation Engine
        Validar Canonical Model antes da ingestão.
        CPF/CNS, datas, enums, unicidade, referências.
        Prerequisito para: MIG-01, STG-01
  
  └─→ STG-01 — Import Staging
        Ambiente isolado de validação pré-produção.
        Dry-run obrigatório. Relatório antes de qualquer commit.
        Prerequisito para: MIG-01
  
        └─→ MIG-01 — Bulk Import API
              Endpoint seguro para importação em lote com:
              - importJobId rastreável
              - dry-run mode
              - validação via VAL-01
              - audit trail de migração
              - rollback por importJobId
              Prerequisito para: qualquer migração real
  
              └─→ MIG-02 — Source Profile Registry
                    Cadastro formal de cada sistema-fonte.
                    Dicionário de dados, mapeamento aprovado, responsável.
                    Prerequisito para: cada conector específico
  
                    └─→ [Conectores específicos: PEC, municipal, CSV, API]
```

### Iniciativa paralela

```
SCALE-01 — Storage Scalability Assessment
  Validar limite de pacientes + eventos em JSONB app_state.
  Se JSONB insuficiente: avaliar particionamento por tenant,
  migração para tabelas relacionais por entidade.
  Prerequisito para: qualquer UBS com > 5.000 pacientes.
```

---

## FASE 8 — Priorização

### Obrigatório antes de UBS sem histórico

**Estado atual: PRONTO.**

Entrada manual via UI funciona. Não requer nenhuma das iniciativas acima.

Limitação: performance com > 5.000 pacientes não validada (ver SCALE-01).

### Obrigatório antes da primeira migração

| Prioridade | Iniciativa | Motivo |
|---|---|---|
| 1 | SCALE-01 | Validar se JSONB aguenta o volume antes de qualquer migração |
| 2 | Adicionar `externalId` + `sourceSystem` em `Patient` | Habilita deduplicação por ID externo |
| 3 | ARCH-INT-01 (Canonical Model) | Base de todo o resto |
| 4 | VAL-01 (Validation Engine) | Sem validação, importação é incontrolável |
| 5 | STG-01 (Staging) | INTEGRATION-GOV-01A exige dry-run em staging |
| 6 | MIG-01 (Bulk Import API) | Sem API bulk, migração = entrada manual |

### Obrigatório antes da primeira integração contínua

| Prioridade | Iniciativa | Motivo |
|---|---|---|
| 1 | Todas as anteriores | Prerequisito |
| 2 | MAP-01 (Mapping Engine) | Cada sistema-fonte tem campos diferentes |
| 3 | MIG-02 (Source Profile Registry) | Sem registro formal, integração é ad hoc |
| 4 | Population Selection Engine | Integração parcial requer seleção de subpopulação |

### Pode esperar

- Conectores específicos (PEC, municipal, CSV, API)
- UI de status de importação
- Deduplicação fonética
- Merge de duplicatas
- Relatório de divergência pós-importação

---

## FASE 9 — Decisão Executiva

| Cenário | Posicionamento |
|---|---|
| **UBS nova sem histórico** | **PRONTO** — entrada manual via UI funcional; team scope e RBAC operacionais |
| **UBS existente com histórico** | **NÃO PRONTO** — requer SCALE-01 + ARCH-INT-01 + VAL-01 + STG-01 + MIG-01 no mínimo |
| **Migração parcial** | **NÃO PRONTO** — sem Population Selection Engine, sem staging, sem bulk import |
| **Migração completa** | **NÃO PRONTO** — idem + risco de escala JSONB não validado |
| **Integração contínua** | **NÃO PRONTO** — requer toda a stack + MAP-01 + MIG-02 + conectores |

**O produto está pronto para receber o primeiro paciente por entrada manual.**

**O produto não está pronto para receber o primeiro paciente por importação.**

---

## RESULTADO OBRIGATÓRIO

| Item | Resultado |
|---|---|
| Modelo atual compreendido? | **SIM** |
| Eventos assistenciais definidos? | **SIM** (com lacunas de mapeamento externo documentadas) |
| Estratégia de identidade definida? | **SIM** (com lacunas críticas documentadas: sem externalId, sem fallback sem CPF/CNS) |
| Indicadores compreendidos? | **SIM** (com impacto de importação documentado) |
| Capacidade de migração avaliada? | **SIM** |
| Lacunas identificadas? | **SIM** (6 críticas, 7 altas, 6 médias, 4 baixas) |
| Dependências identificadas? | **SIM** (7 iniciativas futuras, com ordem de dependência) |
| Priorização definida? | **SIM** |
| Produto pronto para UBS sem histórico? | **SIM** |
| Produto pronto para UBS com histórico? | **NÃO** |
| Próxima iniciativa definida? | **SIM** — SCALE-01 → ARCH-INT-01 → VAL-01 → STG-01 → MIG-01 |
| **Status MR-01** | **PASS** |

---

## Atualização CTRL-01

MR-01 gerou as seguintes iniciativas futuras para registro no CTRL-01:

| ID | Título | Status inicial | Prerequisito |
|---|---|---|---|
| SCALE-01 | Storage Scalability Assessment | PLANNED | Antes de qualquer UBS com > 5K pacientes |
| ARCH-INT-01 | Canonical Import Model | PLANNED | Após SCALE-01 |
| VAL-01 | Validation Engine | PLANNED | Após ARCH-INT-01 |
| STG-01 | Import Staging | PLANNED | Após VAL-01 |
| MIG-01 | Bulk Import API | PLANNED | Após STG-01 |
| MAP-01 | Mapping Engine | PLANNED | Após ARCH-INT-01 |
| MIG-02 | Source Profile Registry | PLANNED | Após MIG-01 |

**Nenhuma dessas iniciativas pode ser aberta antes de:**

1. Piloto Real UBS #1 completo (pré-requisito CTRL-01)
2. MR-01 atualizado com decisão formal de abertura
3. GOV-01 aplicado com resultado GO ou GO WITH LIMITS

---

## Lição Consolidada

O VITRAS não importa dados. O VITRAS homologa integrações.

O produto sabe exatamente o que fazer quando o primeiro paciente chega pela UI.

O produto ainda não sabe o que fazer quando 50.000 pacientes chegam de um sistema externo.

MR-01 documenta a distância entre esses dois estados.

O caminho está mapeado. A execução depende do piloto real.
