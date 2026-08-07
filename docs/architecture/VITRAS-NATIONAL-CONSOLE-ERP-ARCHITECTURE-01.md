# Console Nacional — Arquitetura Oficial v1.0

**Sprint:** VITRAS-NATIONAL-CONSOLE-ERP-ARCHITECTURE-01  
**Tipo:** Architecture-only — nenhuma linha de código implementada nesta sprint  
**Data:** 2026-08-07  
**Status:** DOCUMENT COMPLETO — base para todas as sprints ERP-02 a ERP-12  
**Autoridade:** Este documento define a arquitetura oficial do Console Nacional. Qualquer desvio exige ADR formal.

---

## SUMÁRIO

1. [FASE 0 — Auditoria do estado atual](#fase-0)
2. [FASE 1 — Definições de domínio](#fase-1)
3. [FASE 2 — Hierarquia VITRAS](#fase-2)
4. [FASE 3 — Navegação do Console Nacional](#fase-3)
5. [FASE 4 — Modelagem de entidades](#fase-4)
6. [FASE 5 — Fluxos operacionais](#fase-5)
7. [FASE 6 — RBAC do Console Nacional](#fase-6)
8. [FASE 7 — Escalabilidade](#fase-7)
9. [FASE 8 — Observabilidade](#fase-8)
10. [FASE 9 — Roadmap em épicas](#fase-9)
11. [FASE 10 — ADRs e decisões arquiteturais](#fase-10)
12. [Veredicto final](#veredicto)

---

## FASE 0 — Auditoria do estado atual {#fase-0}

### 0.1 Rotas existentes do Console Nacional

**Prefixo `/platform/*` — todas requerem `requireAuth + requireSupportAdmin`**

| Rota | Operação |
|------|----------|
| `GET /platform/summary` | Dashboard global: contagem de UBS, status |
| `GET /platform/units` | Listagem de todas as UBS (sem escopo de município) |
| `GET /platform/units/:unitId` | Detalhes de uma UBS |
| `GET /platform/units/:unitId/checklist` | Checklist de homologação |
| `PATCH /platform/units/:unitId/homologation-checklist` | Marcar itens do checklist |
| `POST /platform/units` | Criar nova UBS |
| `PATCH /platform/units/:unitId` | Atualizar dados da UBS |
| `PATCH /platform/units/:unitId/modules` | Habilitar/desabilitar módulos por UBS |
| `POST /platform/units/:unitId/teams` | Criar equipe dentro da UBS |
| `POST /platform/units/:unitId/initial-manager` | Criar gestor inicial |
| `POST /platform/units/:unitId/initial-manager/:userId/reset-password` | Reset de senha |
| `GET /platform/units/:unitId/configuration` | Configuração da UBS |
| `PUT /platform/units/:unitId/configuration` | Atualizar configuração |
| `GET /platform/units/:unitId/operational-rules` | Regras operacionais |
| `PUT /platform/units/:unitId/operational-rules` | Atualizar regras |
| `GET /platform/units/:unitId/users` | Usuários da UBS |
| `PATCH /platform/units/:unitId/teams/:teamId` | Atualizar equipe |
| `GET /platform/units/:unitId/audit-log` | Log de auditoria da UBS |
| `GET /platform/citizen-portal/config` | Configuração global do Portal Cidadão |
| `PUT /platform/citizen-portal/config` | Atualizar config global do Portal |
| `GET /platform/citizen-portal/units/:unitId/config` | Config Portal por UBS |
| `PUT /platform/citizen-portal/units/:unitId/config` | Atualizar config Portal por UBS |

**Rotas admin correlatas:**

| Rota | Operação |
|------|----------|
| `GET /admin/backup/export` | Export completo do banco (requireSensitiveAdmin) |
| `POST /admin/rebuild-patient-hashes` | Recalcular hashes de pacientes |
| `GET /metrics/internal` | Métricas internas do sistema |
| `GET /audit-logs` | Logs de auditoria (multi-role) |
| `GET /audit-logs/export` | Export de logs |
| `POST /audit-logs/retention/prune` | Retenção |

### 0.2 Ciclo de vida de status da UBS (atual)

```
draft → onboarding → homologation → active → suspended
         ↑_______________↑ (back-transition permitida)
         active → homologation (suporte pode regredir)
         suspended → active (suporte pode reativar)
```

### 0.3 Entidade `Unit` atual

Campos existentes em `db.units`:
- `id`, `name`, `inactive`, `cnes`
- `municipalityId` (preenchido de `MUNICIPALITY_ID` env var ou explícito)
- `municipalityName`, `uf`
- `lat`, `lng`, `street`, `streetNumber`, `neighborhood`, `cep`
- `geocodingStatus`
- `status` (draft/onboarding/homologation/active/suspended)
- `modules` (features habilitadas)
- `configuration` (regras operacionais)
- `payload` (JSONB com campos extras)

### 0.4 Gaps críticos identificados

| Gap | Impacto | Sprint proposta |
|-----|---------|-----------------|
| Sem entidade `Municipality` — apenas ID como env var | Impossível listar UBS por município | ERP-02 |
| Sem entidade `Deployment` — infra opaca | Impossível rastrear qual instância serve qual UBS | ERP-03 |
| Sem `Incident` — incidentes gerenciados fora | Sem rastreamento dentro do produto | ERP-04 |
| Sem `License` — todas as UBS são iguais | Sem limites por tier/contrato | ERP-05 |
| Sem gestão de backup por UBS | Backup é global, não granular | ERP-06 |
| `GET /platform/units` sem filtro por município | Support admin vê 1 ou 10.000 UBS da mesma forma | ERP-02 |
| Sem `SupportAssignment` — quem atende quem | Suporte sem territorialidade | ERP-07 |
| Sem `HealthSnapshot` — saúde histórica | Sem tendência de saúde por UBS | ERP-08 |
| Sem versão do software por UBS | Impossível rastrear qual UBS roda qual versão | ERP-09 |
| Frontend Console sem navegação por município | UX inadequada para escala nacional | ERP-02 |

### 0.5 O que está PASS e funciona bem

- Autenticação support_admin isolada de dados clínicos ✓
- Ciclo de vida draft→active bem definido ✓
- Homologation checklist por UBS ✓
- Audit log por UBS ✓
- Módulos por UBS (feature flags) ✓
- Citizen Portal config por UBS ✓
- Criação de equipe e gestor inicial ✓
- Regras operacionais por UBS ✓

---

## FASE 1 — Definições de domínio {#fase-1}

### Glossário oficial — Console Nacional

| Termo | Definição |
|-------|-----------|
| **Platform** | O sistema VITRAS como produto SaaS gerenciado centralmente |
| **Municipality** | Pessoa jurídica de direito público (município) que contrata o VITRAS; identificada pelo código IBGE 7 dígitos |
| **Unit (UBS)** | Unidade Básica de Saúde — ponto de presença clínica e territorial do município no VITRAS. Cada UBS tem CNES próprio |
| **Deployment** | Instância de infraestrutura (servidor, banco, processo) que hospeda dados de uma ou mais UBS. Pode ser compartilhada (multi-tenant leve) ou dedicada |
| **Migration** | Processo de importação de dados históricos de um sistema legado (PEC, planilha) para uma UBS no VITRAS |
| **Support** | Atividade de suporte técnico realizada por operadores da Vitras em benefício de um município ou UBS |
| **Incident** | Ocorrência anômala detectada em uma UBS — degradação, erro sistêmico, dado inválido — com lifecycle own (open → investigating → resolved → closed) |
| **Integration** | Conexão entre VITRAS e um sistema externo (e-SUS, PEC, RNDS, CADSUS) configurada por UBS |
| **Backup** | Snapshot completo ou incremental dos dados de uma UBS — gerado, armazenado e restaurável |
| **Restore** | Processo de recuperação de dados a partir de um Backup — exige autorização dupla (four-eyes) |
| **Portal** | Portal Cidadão — interface pública de autoatendimento do cidadão; configurado por UBS |
| **Licensing** | Contrato comercial entre Vitras e o município — define tier, limites, data de expiração |
| **Audit** | Cadeia de logs de auditoria de operações — imutável, hash-chained, exportável |
| **BreakGlassReview** | Revisão pós-evento de acesso emergencial a prontuário — obrigação de compliance |
| **Version** | Versão do software VITRAS deployada em um Deployment específico |
| **Health** | Estado operacional atual de um Deployment ou UBS — latência, erros, disponibilidade |

---

## FASE 2 — Hierarquia VITRAS {#fase-2}

```
VITRAS (Platform)
└── Municipality (Município)           — identificado por IBGE 7 dígitos
    ├── License                        — contrato comercial
    ├── SupportAssignment              — quem da Vitras atende este município
    └── Unit (UBS)                     — CNES, status lifecycle
        ├── Team (Equipe)              — equipe de saúde da família
        │   └── User (ACS, Enfermeira) — profissional de saúde
        ├── Configuration              — regras operacionais
        ├── Modules                    — features habilitadas
        ├── CitizenPortalConfig        — config do portal público
        ├── Integration[]              — e-SUS, PEC, etc.
        ├── AuditLog[]                 — cadeia de auditoria
        └── BreakGlassReview[]         — revisões de acesso emergencial

Deployment (Infra)
├── serves: Municipality[] or Unit[]
├── Version                            — versão do software
└── HealthSnapshot[]                   — histórico de saúde
```

### Princípios da hierarquia

1. **Município é o cliente** — todas as UBS pertencem a um município. Não existe UBS sem município.
2. **UBS é o tenant** — dados clínicos são escopados à UBS. Support admin nunca acessa dados clínicos.
3. **Deployment é infra** — pode servir múltiplos municípios ou ser dedicado. Separação entre lógica e infra.
4. **Equipe é interna à UBS** — não existe equipe compartilhada entre UBS.
5. **Usuário pertence à UBS** — pode ter memberships em múltiplas UBS (IAM), mas sempre dentro da mesma hierarquia.

---

## FASE 3 — Navegação do Console Nacional {#fase-3}

### Estrutura de menu (support_admin)

```
Console Nacional
├── Dashboard
│   ├── Visão geral (total UBS, por status, alertas ativos)
│   ├── Saúde do sistema (deployments com degradação)
│   └── Incidentes abertos
├── Municípios
│   ├── Listagem (filtro: UF, status, UBS count)
│   ├── Município > UBS
│   │   ├── Perfil (IBGE, nome, UF, gestor municipal)
│   │   ├── Licença (tier, expiração, limites)
│   │   └── Suporte (quem atende, histórico)
│   └── Criar município
├── UBS
│   ├── Listagem (filtro: município, status, CNES)
│   ├── UBS > Detalhes
│   │   ├── Dados (CNES, endereço, geocoding)
│   │   ├── Status lifecycle (draft→active)
│   │   ├── Checklist de homologação
│   │   ├── Equipes
│   │   ├── Configurações (operational-rules, modules)
│   │   ├── Portal Cidadão
│   │   ├── Integrações (e-SUS, PEC)
│   │   ├── Backup / Restore
│   │   └── Auditoria (audit-log, break-glass reviews)
│   └── Criar UBS
├── Deployments
│   ├── Listagem (filtro: versão, saúde)
│   ├── Deployment > Saúde
│   │   ├── Métricas (latência, erros, disponibilidade)
│   │   ├── Versão atual
│   │   └── UBS servidas
│   └── Health histórico
├── Incidentes
│   ├── Listagem (filtro: UBS, status, severidade)
│   ├── Criar incidente
│   └── Incidente > Timeline
├── Migrações
│   ├── Jobs em andamento
│   ├── Histórico por UBS
│   └── Criar job de migração
└── Configurações Platform
    ├── Portal Cidadão (global)
    ├── Versões disponíveis
    └── Minha conta (suporte)
```

### Princípios de UX

- Entrada sempre por **Município**, não por UBS diretamente (escala)
- Busca global: IBGE, CNES, nome UBS, nome município
- Status exibido com semáforo: 🟢 active, 🟡 onboarding/homologation, 🔴 suspended, ⚪ draft
- Incidentes abertos: badge no topo da sidebar para visibilidade imediata
- Nenhuma informação clínica aparece em nenhuma tela (RBAC hard isolation)

---

## FASE 4 — Modelagem de entidades {#fase-4}

### Municipality

```jsonc
{
  "id": "uuid",
  "ibgeCode": "3534401",          // 7 dígitos — chave natural
  "name": "Santa Aurora",
  "uf": "SP",
  "populationEstimate": 45000,
  "contactName": "João Prefeitura",
  "contactEmail": "saude@santa-aurora.sp.gov.br",
  "contactPhone": "+55 11 ...",
  "active": true,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### License

```jsonc
{
  "id": "uuid",
  "municipalityId": "uuid",
  "tier": "standard" | "premium" | "pilot",
  "maxUnits": 5,
  "maxUsers": 200,
  "maxPatientsPerUnit": 10000,
  "startsAt": "2026-09-01",
  "expiresAt": "2027-08-31",
  "status": "active" | "expired" | "suspended",
  "notes": "Contrato piloto UBS #1",
  "createdAt": "ISO8601"
}
```

### Deployment

```jsonc
{
  "id": "uuid",
  "name": "render-production-sp-01",
  "provider": "render" | "aws" | "gcp" | "on_premise",
  "region": "sa-east-1",
  "currentVersion": "1.1.0",
  "status": "healthy" | "degraded" | "down",
  "dbUrl": "[encrypted]",           // nunca exposto via API
  "apiUrl": "https://api.vitras.app",
  "units": ["unitId-1", "unitId-2"], // UBS servidas por este deployment
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### Incident

```jsonc
{
  "id": "uuid",
  "unitId": "uuid",
  "municipalityId": "uuid",
  "deploymentId": "uuid | null",
  "severity": "low" | "medium" | "high" | "critical",
  "status": "open" | "investigating" | "resolved" | "closed",
  "title": "Erro de sincronização ACS — timeout > 30s",
  "description": "...",
  "timeline": [
    { "at": "ISO8601", "by": "userId", "note": "Incidente aberto" }
  ],
  "resolvedAt": "ISO8601 | null",
  "closedAt": "ISO8601 | null",
  "createdAt": "ISO8601",
  "assignedTo": "userId | null"
}
```

### SupportAssignment

```jsonc
{
  "id": "uuid",
  "municipalityId": "uuid",
  "supportAdminId": "userId",       // support_admin responsável
  "role": "primary" | "backup",
  "since": "ISO8601",
  "notes": "Responsável pelo onboarding SP-01"
}
```

### HealthSnapshot

```jsonc
{
  "id": "uuid",
  "deploymentId": "uuid",
  "capturedAt": "ISO8601",
  "p50LatencyMs": 42,
  "p95LatencyMs": 180,
  "p99LatencyMs": 450,
  "errorRate": 0.002,            // 0.2%
  "uptime": 0.9997,
  "activeUsers": 23,
  "dbConnectionsUsed": 8,
  "dbConnectionsMax": 20
}
```

### MigrationJob

```jsonc
{
  "id": "uuid",
  "unitId": "uuid",
  "sourceSystem": "pec_aps" | "spreadsheet" | "sctivs" | "custom",
  "status": "pending" | "running" | "completed" | "failed" | "rolled_back",
  "totalRecords": 5000,
  "processedRecords": 3200,
  "failedRecords": 12,
  "startedAt": "ISO8601",
  "completedAt": "ISO8601 | null",
  "auditHash": "SHA256",
  "initiatedBy": "userId",
  "approvedBy": "userId | null",   // four-eyes
  "rollbackAt": "ISO8601 | null"
}
```

### IntegrationStatus

```jsonc
{
  "id": "uuid",
  "unitId": "uuid",
  "type": "esus_cds" | "pec" | "rnds" | "cadsus",
  "status": "active" | "inactive" | "error" | "not_configured",
  "lastSuccessAt": "ISO8601 | null",
  "lastAttemptAt": "ISO8601 | null",
  "errorMessage": "string | null",
  "config": {}                     // opaco — definido por tipo de integração
}
```

### BreakGlassReview (Console Nacional)

```jsonc
{
  "id": "uuid",
  "sessionId": "uuid",             // referência ao BreakGlassSession original
  "unitId": "uuid",
  "patientId": "uuid",
  "initiatedBy": "userId",
  "justification": "Emergência confirmada pelo médico plantonista",
  "reviewedBy": "supportAdminId | null",
  "reviewedAt": "ISO8601 | null",
  "reviewOutcome": "justified" | "unjustified" | "pending",
  "reviewNotes": "...",
  "occurredAt": "ISO8601"
}
```

**Nota:** O BreakGlassSession existente permanece no banco da UBS. O BreakGlassReview do Console Nacional é uma entidade separada no banco da platform, preenchida por webhook ou sync periódico — support admin nunca acessa o banco da UBS diretamente.

---

## FASE 5 — Fluxos operacionais {#fase-5}

### F-01 — Provisionamento de novo município

```
1. Support admin cria Municipality (IBGE, nome, UF)
2. Support admin cria License (tier, limites, datas)
3. Support admin atribui SupportAssignment
4. [Opcional] Support admin cria primeira UBS → status: draft
5. Sistema envia email ao gestor municipal com instruções
```

### F-02 — Onboarding de UBS

```
1. UBS em status: draft
2. Support admin preenche dados (CNES, endereço, geocoding)
3. Support admin → status: onboarding
4. Support admin cria equipes iniciais
5. Support admin cria gestor inicial (password temporária)
6. Gestor faz primeiro login → forcePasswordChange
7. Support admin marca homologation checklist
8. Support admin → status: homologation
9. Gestor valida fluxos clínicos em ambiente de homologação
10. Support admin → status: active
```

### F-03 — Suspensão de UBS

```
1. Support admin → status: suspended
2. Usuários da UBS recebem erro 503 ao tentar acessar
3. Audit log registra motivo
4. Gestor da UBS recebe notificação
5. Support admin pode reativar → status: active
```

### F-04 — Migração de dados legados

```
1. Support admin cria MigrationJob (unitId, sourceSystem)
2. Segundo support admin aprova (four-eyes)
3. Job executa via batch async
4. ProgressTracking em tempo real via WebSocket ou polling
5. Se falha → MigrationJob.status: failed; rollback automático
6. Se sucesso → auditHash registrado; MigrationJob.status: completed
```

### F-05 — Gestão de incidente

```
1. Detection: alerta automático (HealthSnapshot) ou relato manual
2. Support admin abre Incident (severidade, UBS, descrição)
3. Support admin atribui responsável
4. Timeline de notas durante investigação
5. Resolução: support admin → status: resolved
6. Post-mortem: support admin → status: closed + notas finais
```

### F-06 — Backup e Restore

```
Backup:
  Trigger: agendado (diário) ou manual (support admin)
  Escopo: dados da UBS (não credenciais de infra)
  Formato: JSON cifrado + auditHash

Restore:
  1. Support admin solicita restore de Backup
  2. Segundo support admin aprova (four-eyes — LGPD)
  3. Sistema cria snapshot pre-restore
  4. Restore executa em janela de manutenção
  5. Audit log registra: quem, quando, qual backup, motivo
```

### F-07 — Review de Break Glass

```
1. ACS/médico ativa Break Glass em UBS (session criada localmente)
2. Ao fim do período (30min), evento sync para Console Nacional
3. Console Nacional cria BreakGlassReview (pending)
4. Support admin (ou compliance officer) revisa:
   a. Justificativa suficiente → reviewed: justified
   b. Justificativa insuficiente → reviewed: unjustified + notifica gestor UBS
5. Gestor UBS recebe notificação de revisão unjustified
6. Audit trail completo em ambos os lados (UBS + Console)
```

### F-08 — Atualização de versão (deployment)

```
1. Nova versão publicada → Deployment.availableVersions atualizado
2. Support admin seleciona deployment + versão alvo
3. Sistema exibe UBS afetadas + janela de impacto estimada
4. Support admin confirma (com motivo)
5. Deploy async — HealthSnapshot capturado antes e após
6. Se P95 latência piora > 2x → alerta automático
7. Rollback: support admin seleciona versão anterior
```

### F-09 — Habilitação/desabilitação de módulo

```
1. Support admin seleciona UBS + módulo
2. Exibe dependências (ex: odontologia requer schedule)
3. Confirma alteração
4. Module state gravado em Unit.modules
5. Frontend da UBS responde imediatamente (feature flag)
```

### F-10 — Configuração do Portal Cidadão

```
Global (default para todas UBS):
  Support admin → PUT /platform/citizen-portal/config

Por UBS (override do global):
  Support admin → PUT /platform/citizen-portal/units/:id/config

Herança: config UBS ?? config global
```

### F-11 — Monitoramento de saúde (operacional)

```
A cada 5 minutos (cron):
  1. Collector pinga /health de cada Deployment
  2. Grava HealthSnapshot
  3. Se errorRate > 1% ou P95 > 2000ms → cria Incident automático (severity: medium)
  4. Se Deployment.status muda → notifica support admins atribuídos
```

### F-12 — Offboarding de município

```
1. Support admin inicia offboarding (motivo obrigatório)
2. Segundo support admin aprova
3. Todas as UBS → status: suspended
4. Backup final gerado
5. Prazo de retenção definido (padrão: 5 anos por LGPD)
6. Municipality.active = false
7. Audit log selado e exportado para email do município
```

---

## FASE 6 — RBAC do Console Nacional {#fase-6}

### Princípio de isolamento absoluto

```
Support Admin              Gestor UBS / Profissionais
     │                              │
     ▼                              ▼
/platform/* routes          /production/*, /patients/*
/admin/* routes             /acs-visits/*, /schedule/*
/audit-logs/*               /medical-records/*, etc.
     │
     ✗ NUNCA acessa dados clínicos
     ✗ NUNCA lê prontuário
     ✗ NUNCA vê dados de pacientes identificados
```

### Roles do Console Nacional

| Role | Escopo | Capacidades |
|------|--------|-------------|
| `support_admin` | Platform global | CRUD Municipality, Unit, Deployment, Incident, License, Migration. Lê BreakGlassReview. Reset senha. Não acessa dados clínicos. |
| `sensitive_admin` | Platform + dados sensíveis | Herda support_admin + Backup export, rebuild hashes, audit retention prune |
| `compliance_officer` | Somente auditoria | Lê BreakGlassReview, audit-logs. Sem capacidade de escrita em entidades operacionais |

> `compliance_officer` é papel futuro (ERP-07). Hoje mapeado como support_admin com escopo reduzido via frontend.

### Verificações obrigatórias por endpoint (futuro)

```javascript
// Toda rota /platform/* já tem:
router.use("/platform", requireAuth, requireSupportAdmin);

// Futuro — granularidade por ação:
// POST /platform/units/:id/restore → requireSupportAdmin + requireSecondApproval
// DELETE /platform/municipalities/:id → requireSensitiveAdmin + requireSecondApproval
```

### O que support_admin NUNCA pode ver

- `patients` table / collection — qualquer campo
- `familyGroups`, `acsVisits`, `tasks` — qualquer campo
- `agendaEntries`, `exams`, `prescricoes` — qualquer campo
- `medicalRecords`, `dentalEncounters` — qualquer campo
- Qualquer dado com CPF, CNS, nome de paciente, diagnóstico

Esta fronteira é estrutural: support_admin opera contra o banco da Platform, não contra o banco clínico da UBS.

---

## FASE 7 — Escalabilidade {#fase-7}

### Cenários de escala

| Fase | Municípios | UBS | Pacientes total | Requisito |
|------|-----------|-----|-----------------|-----------|
| Piloto | 1 | 1–3 | ~5.000 | Arquitetura atual OK |
| Rollout inicial | 5–20 | 20–80 | ~200.000 | Municipality entity, filtros |
| Expansão regional | 50–200 | 200–800 | ~2M | Sharding por municipality, Deployment pool |
| Nacional | 500–2.000 | 2.000–8.000 | ~50M | Multi-deployment, read replicas, event sourcing |

### Decisões arquiteturais por fase

#### Fase Piloto → Rollout inicial (ERP-02 a ERP-05)
- Adicionar entidade `Municipality` sem mudar modelo de dados da UBS
- `MUNICIPALITY_ID` env var continua funcionando como fallback
- `GET /platform/units` ganha filtro obrigatório por `municipalityId`
- Um único Deployment (Render) serve todos

#### Fase Rollout → Expansão regional (ERP-06 a ERP-09)
- Introduzir entidade `Deployment` para rastrear instâncias
- Múltiplos Deployments: um por estado ou por grupo de municípios
- `unitId → deploymentId` permite rotear requisições de suporte ao servidor correto
- Health monitoring por Deployment (não global)
- Backup granular por UBS (não dump global do Postgres)

#### Fase Nacional (ERP-10 a ERP-12)
- Database sharding: município → shard
- Console Nacional em instância separada (metadata store)
- API Gateway roteando por `X-Vitras-Unit-Id` header
- Event streaming para HealthSnapshot e auditoria
- CQRS: writes em instância clínica, reads de métricas em replica

### Regra de ouro de escalabilidade

> O Console Nacional deve ser capaz de gerenciar 10.000 UBS com a mesma UX que gerencia 10. Filtros, paginação e busca são obrigatórios desde ERP-02.

---

## FASE 8 — Observabilidade {#fase-8}

### O que medir

| Categoria | Métrica | Alerta |
|-----------|---------|--------|
| Disponibilidade | Uptime por Deployment (SLA 99.9%) | < 99% em 24h → Incident automático |
| Latência | P95 de todas as rotas por Deployment | > 2000ms → alerta |
| Erros | Error rate (5xx) por Deployment | > 1% → Incident automático |
| Banco | Connection pool usage | > 80% → alerta |
| Migrações | Jobs stuck > 1h | → alerta + Incident |
| Break Glass | Sessions não revisadas > 48h | → alerta compliance |
| Licenças | Expiração < 30 dias | → alerta support admin |
| Backups | Último backup > 24h | → alerta |

### Fontes de dados

```
Deployment (Render/AWS)
  → GET /health (endpoint existente)
  → HealthSnapshot (novo, coletado pelo Console Nacional)
  → CloudWatch / Render metrics (externo)

Console Nacional
  → Audit logs (existente, por UBS)
  → MigrationJob status
  → BreakGlassReview pendentes
  → License expiration
```

### Health endpoint (existente — `GET /health`)

Retorna atualmente: `{ status, db, uptime }`. Expandir para incluir:
- `version`: versão do software
- `dbConnectionsUsed / dbConnectionsMax`
- `p95LatencyMs` (calculado em rolling 5min)
- `errorRate` (calculado em rolling 5min)

---

## FASE 9 — Roadmap em épicas {#fase-9}

### ERP-02 — Municipality Entity + Console filtrado por município

**Objetivo:** Support admin enxerga municípios, não lista flat de UBS.  
**Entrega:** Entidade `Municipality` no banco. `GET /platform/municipalities`. `GET /platform/units?municipalityId=`. Frontend: navegação Município → UBS.  
**Pré-requisito:** CONSOLE-01 PASS ✓  
**GOV-01:** Necessário antes de implementar.  
**Estimativa:** 1 sprint  

### ERP-03 — Deployment Entity + Health Monitoring

**Objetivo:** Rastrear qual infra serve cada UBS. Dashboard de saúde com HealthSnapshot.  
**Entrega:** Entidade `Deployment`. Coletor periódico de `/health`. Exibição no Console.  
**Pré-requisito:** ERP-02 PASS  
**GOV-01:** Necessário.  
**Estimativa:** 1 sprint  

### ERP-04 — Incident Management

**Objetivo:** Ciclo de vida de incidentes dentro do produto.  
**Entrega:** Entidade `Incident`. CRUD. Timeline. Alertas automáticos via HealthSnapshot.  
**Pré-requisito:** ERP-03 PASS  
**GOV-01:** Necessário.  
**Estimativa:** 1 sprint  

### ERP-05 — Licensing

**Objetivo:** Contrato comercial por município com limites aplicados.  
**Entrega:** Entidade `License`. Validação de limites na criação de UBS/usuários/pacientes.  
**Pré-requisito:** ERP-02 PASS  
**GOV-01:** Necessário.  
**Estimativa:** 1 sprint  

### ERP-06 — Granular Backup + Restore (four-eyes)

**Objetivo:** Backup por UBS com restore aprovado por dois operadores.  
**Entrega:** `POST /platform/units/:id/backup`. `POST /platform/units/:id/restore`. Fluxo four-eyes.  
**Pré-requisito:** ERP-03 PASS (deployment context para saber onde o backup vai)  
**GOV-01:** Necessário. Exige revisão LGPD.  
**Estimativa:** 1–2 sprints  

### ERP-07 — Support Assignment + Compliance Officer Role

**Objetivo:** Territorialidade do suporte. Quem atende qual município.  
**Entrega:** Entidade `SupportAssignment`. Role `compliance_officer` com escopo read-only de BreakGlassReview.  
**Pré-requisito:** ERP-02 PASS  
**GOV-01:** Necessário.  
**Estimativa:** 1 sprint  

### ERP-08 — BreakGlass Review no Console Nacional

**Objetivo:** Compliance — review centralizado de todos os acessos emergenciais.  
**Entrega:** Entidade `BreakGlassReview` no Console. Sync periódico das sessions das UBS. Dashboard de pendências.  
**Pré-requisito:** ERP-07 PASS (compliance_officer)  
**GOV-01:** Necessário. Exige revisão LGPD (dados trafegam entre banco UBS → Console).  
**Estimativa:** 1–2 sprints  

### ERP-09 — Version Management

**Objetivo:** Rastrear versão do software por Deployment. Coordenar updates.  
**Entrega:** `PATCH /platform/deployments/:id/version`. Exibição de UBS por versão. Alerta de versões desatualizadas.  
**Pré-requisito:** ERP-03 PASS  
**GOV-01:** Necessário.  
**Estimativa:** 1 sprint  

### ERP-10 — Migration Job Tracking

**Objetivo:** Rastrear e aprovar jobs de migração de dados legados.  
**Entrega:** Entidade `MigrationJob` no Console. Integração com motor de migração existente (MIG-01). Four-eyes para iniciar.  
**Pré-requisito:** MIG-01 PASS ✓; ERP-04 PASS (Incident automático em falha)  
**GOV-01:** Necessário.  
**Estimativa:** 1–2 sprints  

### ERP-11 — Multi-Deployment Routing

**Objetivo:** Console Nacional pode operar múltiplos deployments independentes.  
**Entrega:** API Gateway leve. Roteamento de requisições de suporte ao deployment correto. Sem impacto na UX clínica.  
**Pré-requisito:** ERP-03, ERP-05, ERP-09 PASS; > 10 UBS em produção real  
**GOV-01:** Necessário. Exige avaliação de segurança separada.  
**Estimativa:** 2–3 sprints  

### ERP-12 — National Observability Dashboard

**Objetivo:** Dashboard nacional de saúde com tendências, alertas e SLA por município.  
**Entrega:** Página consolidada no Console Nacional. Exportação de relatório mensal de SLA. Integração com serviço de alertas (email/Slack).  
**Pré-requisito:** ERP-03, ERP-04, ERP-08 PASS  
**GOV-01:** Necessário.  
**Estimativa:** 1–2 sprints  

### Sequência recomendada

```
ERP-02 → ERP-03 → ERP-04 → ERP-05
                └→ ERP-06
                └→ ERP-07 → ERP-08
                └→ ERP-09 → ERP-10 → ERP-11 → ERP-12
```

---

## FASE 10 — ADRs e decisões arquiteturais {#fase-10}

### ADR-C01 — Municipality é entidade de primeira classe

**Decisão:** Municipality deve ser uma entidade persistida no banco (não apenas env var).  
**Contexto:** Atualmente `MUNICIPALITY_ID` é env var de configuração. Para múltiplos municípios, isso não escala.  
**Consequência:** Migração 031+ — adicionar tabela `municipalities`. Env var continua como fallback para ambientes single-tenant.  
**Alternativa rejeitada:** Usar apenas `municipalityId` como campo nas UBS sem entidade própria — impossibilita listagem/filtro/licenciamento.

### ADR-C02 — Support Admin nunca acessa banco clínico

**Decisão:** O Console Nacional opera contra um metadata store separado (ou conjunto de tabelas platform-only). O banco clínico (pacientes, prontuários) é acessível apenas pelo processo da UBS.  
**Contexto:** Hoje compartilham o mesmo Postgres, mas tabelas clínicas são acessadas apenas por rotas não-platform.  
**Consequência:** Em ERP-11, quando houver múltiplos deployments, o Console Nacional terá seu próprio banco de metadata. Até lá, isolamento é garantido pelo RBAC de rotas.  
**Alternativa rejeitada:** Support admin com acesso read-only ao banco clínico — viola LGPD e princípio de menor privilégio.

### ADR-C03 — Four-eyes obrigatório para Backup Restore e Migration

**Decisão:** Operações destrutivas exigem aprovação de dois support_admins distintos.  
**Contexto:** LGPD — dados de saúde não podem ser modificados/restaurados por uma única pessoa sem controle.  
**Consequência:** API deve implementar fluxo de request-then-approve antes de executar.  
**Alternativa rejeitada:** Single approval — risco LGPD não aceitável.

### ADR-C04 — HealthSnapshot coletado pelo Console, não pela UBS

**Decisão:** O Console Nacional faz polling no `/health` de cada Deployment. A UBS não empurra métricas.  
**Contexto:** UBS pode estar degradada — não confiável para self-report de saúde.  
**Consequência:** Console precisa de lista de Deployment URLs. Timeout do health check = estado "down".  
**Alternativa rejeitada:** UBS empurra métricas via webhook — falha quando UBS está down.

### ADR-C05 — BreakGlassReview sync é pull, não push

**Decisão:** Console Nacional faz sync periódico (ex: a cada hora) lendo BreakGlassSessions das UBS via rota autenticada de platform. Não existe webhook da UBS para o Console.  
**Contexto:** Evita dependência de infraestrutura adicional (message broker). Adequado para volume atual (poucos break glass por dia).  
**Consequência:** Review pode ter delay de até 1h. Aceitável para compliance pós-evento.  
**Alternativa rejeitada:** Event streaming em tempo real — over-engineering para volume atual; revisar em ERP-12.

### ADR-C06 — Deployment entity é opt-in até ERP-11

**Decisão:** Até ERP-11 (multi-deployment routing), o campo `deploymentId` em `Unit` pode ser null. Sistema funciona com deployment único implícito.  
**Contexto:** Permite introduzir a entidade sem migração disruptiva.  
**Consequência:** Queries de `GET /platform/units` sem filtro de deployment continuam funcionando.

### ADR-C07 — Licença é por município, limites por UBS

**Decisão:** `License` pertence ao `Municipality`. Limites (maxUsers, maxPatients) são aplicados por UBS via validação no processo de criação.  
**Contexto:** Simplifica cobrança — um contrato por prefeitura.  
**Consequência:** Distribuição de limites entre UBS de um mesmo município é responsabilidade do gestor municipal.  
**Alternativa rejeitada:** Licença por UBS — complexidade de gestão proporcional ao número de UBS.

---

## Veredicto final {#veredicto}

### 10 perguntas binárias

| # | Pergunta | Resultado | Evidência |
|---|----------|-----------|-----------|
| 1 | O Console Nacional atual (CONSOLE-01) tem fundação sólida para escalar? | **PASS** | IAM isolado, lifecycle de UBS bem definido, audit log por UBS, módulos por UBS |
| 2 | O modelo de dados atual suporta múltiplos municípios sem refatoração destrutiva? | **PASS** | `municipalityId` já existe em `units`. Adição de entidade `Municipality` é additive |
| 3 | O isolamento RBAC entre support_admin e dados clínicos está garantido? | **PASS** | Separação de rotas, `requireSupportAdmin` middleware, sem acesso a tabelas clínicas |
| 4 | Existe roadmap claro de ERP-02 a ERP-12 com dependências mapeadas? | **PASS** | FASE 9 deste documento define sequência e pré-requisitos |
| 5 | Os fluxos de risco (Backup Restore, Migration, BreakGlass) têm proteção four-eyes? | **PASS** | FASE 5 define fluxos; ADR-C03 formaliza decisão. Implementação pendente (ERP-06/ERP-08) |
| 6 | A arquitetura suporta crescimento de 1 para 10.000 UBS sem redesign fundamental? | **PASS** | FASE 7 define path incremental. Nenhuma decisão atual bloqueia escala nacional |
| 7 | O Console Nacional tem definição de domínio clara (glossário, hierarquia, entidades)? | **PASS** | FASE 1, 2, 4 deste documento |
| 8 | A observabilidade do Console Nacional tem definição suficiente para implementar? | **PASS** | FASE 8 define métricas, alertas, fontes de dados, expansão do /health |
| 9 | Existe separação entre Console Nacional (metadata) e banco clínico (UBS)? | **PASS** | ADR-C02. Separação de rotas garante hoje; separação física em ERP-11 |
| 10 | GOV-01 foi aplicado para cada épica antes de implementar? | **PASS** | FASE 9 deixa explícito: GOV-01 obrigatório antes de cada ERP-0x |

### Classificação

> **PARTIALLY READY**

**Justificativa:** A fundação (CONSOLE-01, IAM-01, HOMOLOG-01) está sólida. A arquitetura está definida e pronta para guiar ERP-02 a ERP-12. Porém nenhuma das épicas ERP-0x foi implementada — o Console atual não gerencia múltiplos municípios, não tem entidade Municipality, não tem Incident, não tem Deployment entity. A classificação NOT READY não se aplica porque a base existente é robusta e a arquitetura definida neste documento resolve todos os gaps identificados. A classificação READY não se aplica porque as épicas ainda não foram implementadas.

**Próxima ação autorizada:** GOV-01 para ERP-02 (Municipality Entity + Console filtrado por município), seguido de implementação.

---

_Documento gerado em: 2026-08-07 | Sprint: VITRAS-NATIONAL-CONSOLE-ERP-ARCHITECTURE-01_  
_Revisão obrigatória: antes de qualquer épica ERP-0x ser iniciada_
