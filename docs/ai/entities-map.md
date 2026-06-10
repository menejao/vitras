# VITRAS — Mapa de Entidades

**Versão:** v1.0-pilot-governed
**Atualizado:** 2026-05-26
**Fonte:** `backend/src/db.js`, `backend/src/migrations/`, `backend/src/routes/`, `backend/src/utils/helpers.js`

---

## Arquitetura de Armazenamento

### Modo PostgreSQL (produção)
Todos os dados residem em um único registro JSONB na tabela `app_state` (`data` column). Tabelas shadow relacionais são mantidas para queries SQL:
- `app_users` — projeção de usuários
- `app_patients` — projeção de pacientes
- `app_appointments` — projeção de agendamentos
- `app_audit_logs` — projeção de logs de auditoria
- `app_refresh_tokens` — tokens de refresh ativos
- `app_role_permissions` — permissões por role
- `app_units` — unidades (UBS)

Todas as escritas usam `BEGIN; SELECT app_state FOR UPDATE; UPDATE app_state SET data = ...; COMMIT;` — segurança multi-instância.

### Modo File (desenvolvimento)
Dados em `data/db.json`. Mutex por fila de Promises — não escalável horizontalmente.

---

## Entidades Principais

### User (Usuário)

**Tabela shadow:** `app_users`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `name` | string | Nome completo |
| `email` | string | Email (lowercase, único no sistema) |
| `password` | string | bcrypt hash (prefixo `$2b$`) |
| `role` | string | Role canônica (ver RBAC matrix) |
| `teamId` | UUID | Equipe do usuário (vazio para gestor sem equipe) |
| `unitId` | UUID | Unidade (UBS) do usuário |
| `councilType` | string | Tipo de conselho: `CRM`, `CRO`, `COREN`, etc. |
| `councilNumber` | string | Número do conselho profissional |
| `councilUf` | string | UF do conselho |
| `councilVerification` | object | `{checked, provider, status, verifiedAt}` |
| `twoFactorEnabled` | boolean | 2FA TOTP ativo |
| `twoFactorSecret` | string | Segredo TOTP — criptografado com AES-256-GCM em repouso |
| `twoFactorPendingSecret` | string | Segredo pendente de confirmação durante setup |
| `twoFactorPendingCreatedAt` | ISO string | Timestamp do início do setup 2FA |
| `createdAt` | ISO string | Data de criação |
| `updatedAt` | ISO string | Última modificação |
| `lastLoginAt` | ISO string | Último login bem-sucedido |
| `lastSeenAt` | ISO string | Última atividade detectada |
| `lastSeenIp` | string | IP da última atividade |

**Regras de negócio:**
- Email único globalmente (case-insensitive)
- Conselho profissional único por tipo+número+UF
- Roles `nurse_manager`, `doctor`, `gestor` podem fazer auto-cadastro público (`PUBLIC_SELF_REGISTER_ROLES`)
- `nurse_manager` só pode criar usuários com role `acs` ou `doctor`
- Usuário com vínculos ativos (pacientes, agendamentos) não pode ser excluído
- Email/senha só podem ser alterados com `currentPassword` confirmado

**Eventos de auditoria:** `auth.register`, `auth.login`, `auth.logout`, `auth.login_failed`, `auth.2fa_enabled`, `auth.2fa_disabled`, `user.created_by_manager`, `user.updated_by_manager`, `user.deleted_by_manager`, `user.profile_updated`

---

### Patient (Paciente)

**Tabela shadow:** `app_patients`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `teamId` | UUID | Equipe responsável pelo paciente |
| `name` | string | Nome completo |
| `cpf` | string | CPF — **criptografado** (AES-256-GCM, prefixo `enc1:`) |
| `cns` | string | Cartão Nacional de Saúde — **criptografado** |
| `cnsCpf` | string | Campo auxiliar CNS/CPF — **criptografado** |
| `cpf_hash` | string | HMAC-SHA256 do CPF para busca (PATIENT_LOOKUP_HASH_KEY) |
| `cns_hash` | string | HMAC-SHA256 do CNS para busca |
| `birthDate` | string | Data de nascimento (YYYY-MM-DD) |
| `gender` | string | Sexo biológico |
| `phone` | string | Telefone |
| `address` | object | Endereço completo (logradouro, numero, bairro, cidade, uf, cep) |
| `microArea` | string | Microárea do ACS responsável |
| `assignedAcsId` | UUID | ACS responsável pelo paciente |
| `careCategory` | string | Categoria de cuidado (protocolo) |
| `chronicConditions` | string[] | Condições crônicas: `hypertension`, `diabetes`, `both`, etc. |
| `incompleteProfile` | boolean | Indica cadastro incompleto |
| `inactive` | boolean | Paciente inativo (soft-delete) |
| `inactivationReason` | string | Motivo da inativação |
| `motherName` | string | Nome da mãe — **criptografado** em anonimização |
| `createdAt` | ISO string | Data de criação |
| `updatedAt` | ISO string | Última modificação |

**Campos derivados (não armazenados):**
- `clinicalRecords[]` — array de registros clínicos aninhados
- `appointments[]` — agendamentos
- `messages[]` — mensagens internas
- `tasks[]` — tarefas vinculadas

**Regras de negócio:**
- CPF e CNS únicos por hash (índice único em `cpf_hash` e `cns_hash` — Migration 006)
- ACS só acessa pacientes da própria microárea/equipe (`patients.read.scoped`)
- Inativação é soft-delete — dados preservados (CFM 1821/2007)
- CPF retornado na API sempre mascarado: `***.***.***-**`
- Cross-team access gera evento `cross_team_patient_access` no audit log

**Eventos de auditoria:** `patient.list_read`, `patient.read`, `patient.created`, `patient.updated`, `patient.inactivated`, `cross_team_patient_access`

---

### ClinicalRecord (Registro Clínico)

Armazenado como array aninhado em `patient.clinicalRecords[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `patientId` | UUID | Referência ao paciente |
| `teamId` | UUID | Equipe do criador |
| `type` | string | Tipo do registro (ver abaixo) |
| `title` | string | Título descritivo |
| `content` | string | Conteúdo clínico livre |
| `createdBy` | UUID | ID do usuário criador |
| `createdByName` | string | Nome do criador (snapshot) |
| `createdByRole` | string | Role do criador (snapshot) |
| `createdAt` | ISO string | Timestamp de criação |
| `updatedAt` | ISO string | Última atualização |
| `status` | string | `active`, `inactive`, `cancelled` |
| `inactivationReason` | string | Motivo (quando inativo) |
| `snapshot` | object | Snapshot clínico capturado na criação (apenas tipos com snapshot) |

**Tipos de registro:**
- `visit` — consulta/visita; ACS pode criar
- `prescription` — prescrição médica; apenas `doctor` ou `dentist`
- `medical_attest` — atestado médico; apenas `doctor` ou `dentist`
- `referral` — encaminhamento clínico; qualquer prescriber
- `evolution` — evolução clínica
- `procedure` — procedimento
- `nursing_note` — anotação de enfermagem
- `vaccine` — registro de vacinação
- `exam_request` — solicitação de exame
- `other` — outros

**Snapshot (tipos `prescription`, `medical_attest`, `referral`):**
Contexto capturado no momento da criação — nunca resolvido lazily:
```json
{
  "patientName": "...",
  "patientBirthDate": "...",
  "patientCareCategory": "...",
  "actorName": "...",
  "actorRole": "...",
  "actorCouncilType": "...",
  "actorCouncilNumber": "...",
  "capturedAt": "..."
}
```

**Regras de negócio:**
- Nunca exclusão física (CFM 1821/2007) — somente `status=inactive`
- DELETE via API marca como inativo, não remove do array
- ACS só pode criar tipo `visit`
- Prescrição/atestado requer role prescritora

**Eventos de auditoria:** `record.created`, `record.deleted` (soft), `record.inactivated`

---

### Appointment (Agendamento)

Armazenado como `patient.appointments[]` e em tabela shadow `app_appointments`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `patientId` | UUID | Paciente |
| `teamId` | UUID | Equipe |
| `date` | string | Data (YYYY-MM-DD) |
| `time` | string | Horário (HH:MM) |
| `type` | string | Tipo de atendimento |
| `status` | string | `scheduled`, `completed`, `cancelled` |
| `reason` | string | Motivo/queixa principal |
| `createdBy` | UUID | Usuário criador |
| `createdAt` | ISO string | Criação |
| `updatedAt` | ISO string | Atualização |

**Eventos de auditoria:** `appointment.created`, `appointment.cancelled`

---

### Exam (Exame)

Armazenado em `db.exams[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `patientId` | UUID | Paciente |
| `teamId` | UUID | Equipe |
| `title` | string | Nome do exame |
| `date` | string | Data de solicitação |
| `status` | string | `requested`, `collected`, `result_available`, `cancelled` |
| `resultDate` | string | Data do resultado |
| `lab` | string | Laboratório |
| `source` | string | `posto` (interno) ou `externo` (lab integration) |
| `externalId` | string | Idempotency key da integração laboratorial |
| `details` | string | Detalhes/resultado |
| `attachments` | object[] | Resultados como JSON estruturado |
| `createdAt` | ISO string | Criação |
| `createdBy` | UUID/string | Usuário ou `"lab-integration"` |

**Eventos de auditoria:** `exam.created`, `exam.deleted`, `lab_integration.result_created`, `lab_integration.result_updated`

---

### AgendaEntry (Agenda)

Armazenado em `db.agenda[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `teamId` | UUID | Equipe |
| `title` | string | Título do evento |
| `date` | string | Data |
| `time` | string | Horário |
| `type` | string | Tipo de evento |
| `patientId` | UUID | Paciente vinculado (opcional) |
| `createdBy` | UUID | Criador |
| `createdAt` | ISO string | Criação |

---

### Referral (Encaminhamento)

Armazenado em `db.referrals[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `patientId` | UUID | Paciente |
| `teamId` | UUID | Equipe |
| `specialty` | string | Especialidade de destino |
| `reason` | string | Motivo clínico |
| `status` | string | `pending`, `scheduled`, `completed`, `cancelled` |
| `priority` | string | `routine`, `urgent`, `emergency` |
| `createdBy` | UUID | Criador |
| `createdAt` | ISO string | Criação |

---

### QueueEntry (Fila de Atendimento)

Armazenado em `db.queue[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `teamId` | UUID | Equipe |
| `patientId` | UUID | Paciente |
| `type` | string | Tipo de demanda |
| `status` | string | `waiting`, `in_progress`, `done` |
| `priority` | string | Prioridade |
| `position` | number | Posição na fila |
| `createdAt` | ISO string | Entrada na fila |

---

### PharmacyItem (Estoque de Farmácia)

Armazenado em `db.pharmacyStock[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `teamId` | UUID | Equipe |
| `name` | string | Nome do medicamento |
| `quantity` | number | Quantidade em estoque |
| `unit` | string | Unidade (comprimido, frasco, etc.) |
| `minQuantity` | number | Quantidade mínima para alerta |
| `category` | string | Categoria terapêutica |
| `createdAt` | ISO string | Cadastro |

**Log:** `db.pharmacyLogs[]` registra toda movimentação (ajuste, dispensação).

---

### SupplyItem (Insumo)

Armazenado em `db.suppliesStock[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `teamId` | UUID | Equipe |
| `name` | string | Nome do insumo |
| `quantity` | number | Quantidade em estoque |
| `unit` | string | Unidade |
| `continuous` | boolean | Insumo de uso contínuo |
| `createdAt` | ISO string | Cadastro |

**Dispensação contínua:** `db.suppliesContinuous[]` rastreia pacientes em regime contínuo de insumo.

---

### Task (Tarefa Clínica)

Armazenado em `db.tasks[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `teamId` | UUID | Equipe |
| `patientId` | UUID | Paciente vinculado (opcional) |
| `title` | string | Título da tarefa |
| `description` | string | Descrição |
| `assignedTo` | UUID | Usuário responsável |
| `status` | string | `open`, `in_progress`, `done`, `cancelled` |
| `priority` | string | `low`, `medium`, `high` |
| `dueDate` | string | Prazo |
| `createdBy` | UUID | Criador |
| `createdAt` | ISO string | Criação |

---

### Message (Mensagem Interna)

Armazenado como `patient.messages[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `patientId` | UUID | Paciente |
| `teamId` | UUID | Equipe |
| `text` | string | Conteúdo da mensagem |
| `authorId` | UUID | Autor |
| `authorName` | string | Nome do autor (snapshot) |
| `createdAt` | ISO string | Criação |

---

### FamilyGroup (Grupo Familiar)

Armazenado em `db.familyGroups[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `teamId` | UUID | Equipe |
| `acsId` | UUID | ACS responsável |
| `members` | UUID[] | IDs dos pacientes membros |
| `address` | object | Endereço do domicílio |
| `createdAt` | ISO string | Criação |

---

### RefreshToken

Armazenado em `db.refreshTokens[]`. Tabela shadow `app_refresh_tokens`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `tokenHash` | string | SHA-256 do token raw |
| `userId` | UUID | Usuário proprietário |
| `sessionId` | UUID | ID da sessão lógica |
| `ip` | string | IP de criação |
| `expiresAt` | ISO string | Expiração (padrão: 7d) |
| `revokedAt` | ISO string | Revogação (nulo se ativo) |
| `sessionContext` | object | Contexto: `{scopeTeamId, impersonation, breakGlass}` |
| `createdAt` | ISO string | Criação |

**Regras:**
- Token rotacionado a cada refresh (token anterior revogado)
- Rota de logout revoga explicitamente
- Mudança de email/senha revoga todos os tokens da sessão (exceto atual)

---

### AuditLog (Log de Auditoria)

Armazenado em `db.auditLogs[]`. Tabela shadow `app_audit_logs`. Máximo 10.000 entradas em memória; eviction âncora hash preservada.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `userId` | UUID | Ator (quem executou) |
| `userName` | string | Nome do ator (snapshot) |
| `userRole` | string | Role do ator (snapshot) |
| `teamId` | UUID | Equipe do ator |
| `action` | string | Ação (ver categorias abaixo) |
| `entityType` | string | Tipo da entidade afetada |
| `entityId` | string | ID da entidade |
| `details` | object | Detalhes específicos da ação |
| `ip` | string | IP da requisição |
| `userAgent` | string | User-agent (truncado a 512 chars) |
| `requestId` | UUID | ID único da requisição |
| `hash` | string | SHA-256(entry + prevHash) — cadeia HMAC |
| `prevHash` | string | Hash do log anterior na cadeia |
| `createdAt` | ISO string | Timestamp |

**Categorias de ação (classifyAuditAction):**
- `auth.*` — autenticação e sessão
- `patient.*` — operações com pacientes
- `record.*` — registros clínicos
- `user.*` — gestão de usuários
- `access_request.*` — solicitações de acesso
- `audit.*` — operações no próprio audit
- `privacy.*` / `anonymization.*` — LGPD
- `backup.*` — exportação
- `unit_bootstrap` — criação de unidade
- `degraded.*` — operações de modo degradado
- `lab_integration.*` — integração laboratorial
- `cross_team_patient_access` — acesso cross-team

**Integridade:**
- Cadeia verificável via `GET /audit-logs/integrity` (security_auditor)
- Estados: `ok`, `broken`, `orphaned`, `truncated-valid`
- Eviction preserva âncoras hash em `db.auditLogChainAnchors[]`
- Retenção padrão: 730 dias (`AUDIT_LOG_RETENTION_DAYS`)

---

### AccessRequest (Solicitação de Acesso)

Armazenado em `db.accessRequests[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `name` | string | Nome do solicitante |
| `email` | string | Email |
| `jobTitle` | string | Role solicitada |
| `status` | string | `pending`, `approved`, `rejected` |
| `createdAt` | ISO string | Criação |
| `createdByIp` | string | IP do solicitante |
| `decidedAt` | ISO string | Data da decisão |
| `decidedBy` | UUID | Usuário que decidiu |
| `rejectionReason` | string | Motivo da rejeição |

---

### PrivacyRequest (Solicitação LGPD)

Armazenado em `db.privacyRequests[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `patientId` | UUID | Paciente titular dos dados |
| `teamId` | UUID | Equipe responsável |
| `type` | string | `erasure` (LGPD Art. 18 IV) ou `access` |
| `status` | string | `pending`, `in_progress`, `completed`, `rejected` |
| `requestedBy` | UUID | Usuário que criou a solicitação |
| `executedBy` | UUID | Usuário que executou |
| `reason` | string | Justificativa |
| `createdAt` | ISO string | Criação |
| `executedAt` | ISO string | Execução |

**Regras:**
- Execução (anonimização) cria audit `anonymization_warning_acknowledged` antes de qualquer mutação
- `anonymizePatientBundle()` atualmente deleta `clinicalRecords` — KI-02 pendente de resolução em Sprint 5A

---

### ProtocolTemplate (Template de Protocolo)

Armazenado em `db.protocolTemplates[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `teamId` | UUID | Equipe proprietária |
| `category` | string | Categoria de cuidado mapeada |
| `label` | string | Rótulo exibido |
| `content` | object | Conteúdo estruturado do protocolo |
| `version` | number | Versão (incrementada a cada PUT) |
| `createdBy` | UUID | Criador |
| `createdAt` | ISO string | Criação |
| `updatedAt` | ISO string | Atualização |

---

### Unit (Unidade/UBS)

Armazenado em `db.units[]`. Tabela shadow `app_units`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador único (max 50 chars) |
| `name` | string | Nome da unidade (max 200 chars) |
| `createdAt` | ISO string | Criação via bootstrap |

**Regras:**
- Criada apenas via `POST /admin/units/bootstrap` (break_glass_admin)
- Operação atômica — se gestor desaparecer entre validação e mutação, toda operação é revertida (S7-01)

---

### Team (Equipe ESF)

Armazenado em `db.teams[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `name` | string | Nome da equipe |
| `unitId` | UUID | Unidade (UBS) à qual pertence |
| `managerUserId` | UUID | Enfermeira/gestor responsável |
| `createdAt` | ISO string | Criação |
| `updatedAt` | ISO string | Atualização |

---

### LoginChallenge (Desafio 2FA)

Armazenado em `db.loginChallenges[]`. Transiente — não persiste entre reinicializações em modo file.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `userId` | UUID | Usuário do desafio |
| `createdAt` | ISO string | Criação |
| `expiresAt` | ISO string | Expiração (TTL configurável, padrão: 5min) |
| `attempts` | number | Tentativas incorretas (máx: TWOFA_MAX_ATTEMPTS) |
| `consumed` | boolean | Se já foi utilizado ou expirado |

---

### Notification (Notificação)

Armazenado em `db.notifications[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `type` | string | `info`, `warning`, `error` |
| `title` | string | Título |
| `detail` | string | Detalhes |
| `patientId` | UUID | Paciente relacionado |
| `teamId` | UUID | Equipe destinatária |
| `examId` | UUID | Exame relacionado (para resultados de lab) |
| `targetUserId` | UUID | Usuário específico destinatário (opcional) |
| `read` | boolean | Se foi lida |
| `createdAt` | ISO string | Criação |

---

### LabIntegration (Registro de Integração Laboratorial)

Armazenado em `db.labIntegrations[]`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `requestId` | string | ID da requisição externa |
| `idempotencyKey` | string | Chave de idempotência para deduplicação |
| `examId` | UUID | Exame criado/atualizado |
| `patientId` | UUID | Paciente |
| `teamId` | UUID | Equipe |
| `examTitle` | string | Título do exame |
| `status` | string | `result_received` |
| `lab` | string | Laboratório de origem |
| `createdAt` | ISO string | Recebimento |

---

## Migrations PostgreSQL

| # | Nome | O que cria/modifica |
|---|------|---------------------|
| 001 | `001_app_state` | Tabela `app_state` com coluna `data JSONB` |
| 002 | `002_users_projection` | Tabela shadow `app_users` + índices |
| 003 | `003_patients_projection` | Tabela shadow `app_patients` + índices |
| 004 | `004_appointments_projection` | Tabela shadow `app_appointments` |
| 005 | `005_audit_logs_projection` | Tabela shadow `app_audit_logs` |
| 006 | `006_patient_hash_columns` | Índice único em `cpf_hash` e `cns_hash` — **migration crítica** |
| 007 | `007_refresh_tokens_projection` | Tabela shadow `app_refresh_tokens` |
| 008 | `008_drop_ciphertext_indexes` | Remove índices em colunas criptografadas (CONCURRENTLY) |

**Guarda crítica:** Boot aborta se migration 006 não estiver aplicada (`checkCriticalMigrations()`).

---

## Criptografia em Repouso

**Campos criptografados com AES-256-GCM:**
- `user.twoFactorSecret`
- `patient.cpf`
- `patient.cns`
- `patient.cnsCpf`
- `patient.motherName` (durante anonimização)

**Formato:** `enc1:<iv_hex>:<ciphertext_hex>:<tag_hex>`

**Hashes de busca (HMAC-SHA256):**
- `patient.cpf_hash` — usando `PATIENT_LOOKUP_HASH_KEY`
- `patient.cns_hash` — usando `PATIENT_LOOKUP_HASH_KEY`

**Nota de segurança:** `PATIENT_LOOKUP_HASH_KEY` deve ser diferente de `DATA_ENCRYPTION_KEY` em produção.
