# VITRAS — Contexto Institucional do Sistema

> **Versão:** v1.0-pilot-governed
> **Branch:** release/pilot-baseline
> **Gerado em:** 2026-05-26
> **Fonte de verdade:** código-fonte inspecionado diretamente

---

## 1. Visão Geral do VITRAS

### O que é

VITRAS é uma plataforma digital de gestão clínica e administrativa para Unidades Básicas de Saúde (UBS) públicas do Brasil. É desenvolvida como solução GovTech para o contexto de saúde primária da Estratégia Saúde da Família (ESF).

### Problema resolvido

As UBS tradicionalmente operam com papel, planilhas e sistemas legados desconectados. O VITRAS endereça:

- **Fragmentação do cuidado:** prontuário eletrônico centralizado com histórico longitudinal de visitas, consultas, prescrições, exames e encaminhamentos.
- **Rastreabilidade de protocolos:** alertas automáticos quando pacientes em categorias de risco (gestantes, crianças, crônicos, idosos) estão atrasados em visitas, consultas ou vacinas exigidas pelos protocolos do Ministério da Saúde.
- **Coordenação de fila e agenda:** gestão de fila por prioridade (urgente, idoso, gestante, criança, normal) e agendamento de consultas com estados rastreáveis.
- **Farmácia básica:** controle de estoque de medicamentos essenciais com dispensação auditada.
- **Gestão de insumos:** controle de materiais de uso contínuo e individual (fraldas, curativos, sondas etc.).
- **Compliance regulatório:** trilha de auditoria imutável (hash chain SHA-256), conformidade LGPD e CFM 1821/2007.
- **Rastreabilidade multi-instância:** arquitetura preparada para expansão a múltiplas UBS com isolamento de dados por unidade/equipe.

### Público-alvo

| Perfil | Função na UBS |
|--------|--------------|
| Enfermeira gestora de equipe (nurse_manager) | Gerencia a equipe, cadastra pacientes, cria registros clínicos, protocolos |
| Médico/a (doctor) | Atendimento clínico, prescrições, atestados, encaminhamentos |
| Dentista (dentist) | Atendimento odontológico, registros clínicos odontológicos |
| ACS — Agente Comunitário de Saúde (acs) | Visitas domiciliares, cadastro de pacientes da microárea |
| Técnico de enfermagem (nursing_tech) | Triagem, fila, exames, insumos |
| Recepcionista (receptionist) | Chegada de pacientes, fila, agenda |
| Farmacêutico (pharmacist) | Estoque e dispensação de medicamentos |
| Técnico de farmácia (pharmacy_tech) | Estoque e dispensação de medicamentos |
| Gestor da unidade (gestor) | Governança, relatórios, auditoria da UBS completa |
| Auditor de segurança (security_auditor) | Revisão de logs de auditoria, relatórios de acesso cruzado |
| Administrador break glass (break_glass_admin) | Acesso de emergência completo, bootstrap de unidades |

### Escopo atual

Piloto controlado em 1–2 UBS. Status atual: **GO CONDICIONADO** para UBS #1 — baseline técnico aprovado, 10 pré-condições operacionais/infraestrutura pendentes de execução.

---

## 2. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENTE (Navegador)                                                │
│  React + Vite SPA — serviço estático                                │
│  Autenticação: cookie HttpOnly (vitras_access + vitras_refresh)     │
│  CSRF token: vitras_csrf (cookie não-HttpOnly) enviado em header    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────────────────┐
│  AWS ELASTIC BEANSTALK                                              │
│  Node.js 18+ / Express — backend API                                │
│  Porta: 3001 (configurável via PORT)                                │
│                                                                     │
│  Middlewares (em ordem):                                            │
│   Helmet → CORS → Security headers → JSON parser                   │
│   → Request logging → Request metrics → Global rate limit           │
│   → [rotas públicas: /health, /auth, /lab (público)]               │
│   → requireAuth → requireCsrfForCookieAuth → Cache-Control          │
│   → [rotas protegidas: admin, patients, queue, agenda, ...]        │
│   → globalErrorHandler                                              │
└──────┬──────────────────────────────────────────────┬──────────────┘
       │                                              │
┌──────▼───────────┐                    ┌─────────────▼──────────────┐
│  AWS RDS          │                    │  Upstash Redis (REST API)  │
│  PostgreSQL       │                    │  Rate limiting distribuído │
│  (postgres mode)  │                    │  Circuit breaker embutido  │
│                   │                    │  Fail-closed em produção   │
│  app_state (JSONB)│                    └────────────────────────────┘
│  Shadow tables:   │
│  app_users        │
│  app_patients     │
│  app_appointments │
│  app_audit_logs   │
│  app_refresh_tokens│
│  app_role_permissions│
│  app_units        │
│  schema_migrations│
└───────────────────┘
```

### Modo arquivo (desenvolvimento)

Em desenvolvimento (`DATABASE_URL` não definida), toda a persistência é feita em `data/db.json` com mutex de cadeia de Promises para serializar escritas concorrentes. **Proibido em produção.**

### Multi-instance safety

Em modo Postgres, todas as escritas usam `SELECT FOR UPDATE` na tabela `app_state` dentro de transação explícita (`BEGIN/COMMIT/ROLLBACK`). Retry automático (até 3 tentativas) para erros transientes: deadlock (40P01), serialization failure (40001), lock not available (55P03).

### Startup safety

Sequência obrigatória antes de aceitar tráfego:
1. `validateProductionConfig()` — aborta se variáveis críticas ausentes
2. `runMigrations()` (se `RUN_MIGRATIONS=true`) — executa antes de `app.listen()`
3. `checkCriticalMigrations()` — verifica migration `006_patient_hash_columns` aplicada; aborta o boot se ausente em produção+postgres
4. `app.listen()` — só após migrações
5. `checkRdsBackupHealth()` — advisory, nunca fatal
6. `setReadiness(true)` + `setStartupPhase("ready")` — libera `/readyz`

### Cache de leitura Postgres

Leituras do `app_state` têm TTL de cache de **1500ms** em memória para reduzir carga no RDS. Invalidado a cada escrita `withDb()`.

---

## 3. Stack Tecnológica

| Componente | Tecnologia | Versão/Config | Responsabilidade |
|------------|-----------|---------------|-----------------|
| Frontend | React + Vite | JSX (não TypeScript) | SPA — UI clínica e administrativa |
| Backend | Node.js + Express | 18+ | API REST, lógica de negócio |
| Banco de dados (prod) | PostgreSQL via AWS RDS | Pool: max 10 conn | Persistência relacional |
| Banco de dados (dev) | JSON file (`data/db.json`) | Mutex via Promise chain | Persistência local de desenvolvimento |
| Autenticação | JWT (HS256) | Access: configável (padrão 12h), Refresh: 7d | Sessões stateless + refresh token rotation |
| Cookies de sessão | HttpOnly + Secure + SameSite | vitras_access, vitras_refresh, vitras_csrf | Transporte seguro de tokens |
| Rate limiting | Upstash Redis (REST) | @upstash/ratelimit sliding window | Rate limit distribuído multi-instância |
| Circuit breaker | In-process state machine | 5 falhas/60s → OPEN → 30s → HALF_OPEN | Proteção Redis indisponível |
| Criptografia em repouso | AES-256-GCM | Prefixo `enc1:` | CPF, CNS, cnsCpf, segredos 2FA |
| Hash de busca | HMAC-SHA256 | PATIENT_LOOKUP_HASH_KEY separado | Índice único CPF/CNS sem expor plaintext |
| Hash de auditoria | SHA-256 | Cadeia de hashes ligada (prevHash) | Integridade da trilha de auditoria |
| 2FA | TOTP (RFC 6238) | TTL desafio: 5min, máx 5 tentativas | Autenticação multifator opcional |
| Senhas | scrypt | Formato `s1$salt$key` | Hash de senhas |
| Deploy | AWS Elastic Beanstalk | /readyz como health check EB | Deploy managed, rollback por versão |
| Logs | JSON estruturado (prod) / texto (dev) | event + level + timestamp + requestId | Ingestão CloudWatch Logs Insights |
| Métricas | recordMetric() → log estruturado | CloudWatch Insights queries | Métricas operacionais |
| Segurança HTTP | Helmet + CORS + HSTS | CSP: default-src 'none' | Headers de segurança |
| Validação de entrada | Zod (`.strict()`) | Todos os schemas de entrada | Prevenção mass assignment |
| Migrações | Runner próprio (schema_migrations) | 8 migrações (001–008) | Evolução de schema Postgres |

---

## 4. Estrutura do Projeto

```
vitras/
├── backend/
│   ├── src/
│   │   ├── server.js          — Entry point: startup, migrations, graceful shutdown
│   │   ├── app.js             — Express app: middlewares e montagem de routers
│   │   ├── config.js          — Variáveis de ambiente, validações de produção
│   │   ├── db.js              — Abstração DB: file-mode e postgres, criptografia, shadow tables
│   │   ├── schemas.js         — Schemas Zod de validação de entrada (strict)
│   │   ├── middlewares/
│   │   │   ├── auth.js        — requireAuth, requireManager, requireRoles, requireCapabilities
│   │   │   ├── rate-limits.js — Global, auth, sensitiveData, export rate limits + circuit breaker
│   │   │   ├── security.js    — Helmet, CORS, HSTS, security headers
│   │   │   ├── logging.js     — Request logging estruturado, trackLoginAttempt
│   │   │   ├── metrics.js     — requestMetricsMiddleware, getMetrics
│   │   │   ├── errors.js      — globalErrorHandler
│   │   │   └── csrf.js        — requireCsrfForCookieAuth
│   │   ├── routes/
│   │   │   ├── health.js      — /health, /readyz, /metrics/internal, /csp-report
│   │   │   ├── auth.js        — /auth/login, /register, /refresh, /logout, /access-requests
│   │   │   ├── me.js          — /me, /me/patch, /me/2fa/*, /me/impersonate/*, /me/break-glass/*
│   │   │   ├── users.js       — /users CRUD, /teams/public, /users/activity-log
│   │   │   ├── patients.js    — /patients CRUD, /records, /appointments, /messages, /metrics
│   │   │   ├── queue.js       — /queue CRUD
│   │   │   ├── agenda.js      — /agenda CRUD
│   │   │   ├── referrals.js   — /referrals CRUD
│   │   │   ├── pharmacy.js    — /pharmacy/stock, /pharmacy/dispense, /pharmacy/adjust
│   │   │   ├── supplies.js    — /supplies/stock, /supplies/continuous
│   │   │   ├── exams.js       — /exams CRUD
│   │   │   ├── medical-records.js — /medical-records
│   │   │   ├── tasks.js       — /tasks CRUD
│   │   │   ├── family-groups.js — /family-groups
│   │   │   ├── protocols.js   — /protocols (templates de protocolo)
│   │   │   ├── lab.js         — /lab (público) + /lab/notifications
│   │   │   ├── audit-logs.js  — /audit-logs, /audit-logs/export, /integrity, /reports/*
│   │   │   ├── privacy.js     — /privacy/requests LGPD
│   │   │   ├── admin.js       — /admin/backup, /bootstrap, /admin/units/bootstrap, /admin/system/*
│   │   │   ├── seed-admin.js  — Seed de desenvolvimento
│   │   │   └── ai.js          — Endpoints de IA
│   │   ├── services/
│   │   │   ├── audit.js       — addAuditLog, verifyAuditLogChain, getAuditReport
│   │   │   ├── crypto.js      — hashPassword, verifyPassword, hashToken
│   │   │   ├── tokens.js      — createToken, createRefreshToken
│   │   │   ├── totp.js        — TOTP 2FA (gerar, verificar)
│   │   │   ├── metrics.js     — recordMetric
│   │   │   ├── hashRebuild.js — rebuildPatientHashes
│   │   │   ├── runtime-state.js — fases de startup, degraded mode
│   │   │   └── startup.js     — validateProductionConfig, migrateLegacyPasswords, checkRdsBackupHealth
│   │   ├── migrations/
│   │   │   ├── index.js       — Lista ordenada das 8 migrações
│   │   │   ├── runner.js      — Executor idempotente (schema_migrations table)
│   │   │   ├── 001_create_app_state.js
│   │   │   ├── 002_create_shadow_relational_tables.js
│   │   │   ├── 003_create_patient_agenda_permission_shadow_tables.js
│   │   │   ├── 004_add_org_scope_columns.js
│   │   │   ├── 005_patient_cpf_cns_unique.js
│   │   │   ├── 006_patient_hash_columns.js  ← CRITICAL (guard de boot)
│   │   │   ├── 007_drop_ciphertext_patient_indexes.js
│   │   │   └── 008_drop_ciphertext_indexes_concurrently.js
│   │   └── utils/
│   │       ├── helpers.js     — RBAC, roles, capabilities, validadores, utilitários
│   │       ├── domain.js      — ensureDbShape, protocolos, sanitizeUser, buildAccessContextUser
│   │       ├── patients.js    — getAllowedPatients, canAccessPatient, maskSensitivePatientFields, anonymizePatientBundle
│   │       ├── seed.js        — Gerador de dados demo
│   │       ├── council.js     — Validação de CRM/COREN
│   │       ├── session-cookies.js — Cookies de sessão
│   │       ├── metrics.js     — buildMonthlyDemandMetric, buildDataQualityMetric
│   │       └── logger.js      — logInfo, logWarn, logError (JSON estruturado)
│   ├── data/
│   │   └── db.json            — Banco de dados file-mode (dev apenas)
│   └── package.json
├── frontend-react/
│   └── src/
│       ├── App.jsx            — Orchestrador principal, roteamento por tab
│       ├── main.jsx           — Entry point React
│       ├── api.js             — Funções de chamada à API backend
│       ├── pages/             — Páginas completas por módulo/perfil
│       ├── components/        — Componentes reutilizáveis (layout, modais, feedback)
│       ├── hooks/             — Custom hooks (useAuth, useBootstrap, usePatientModal, etc.)
│       ├── services/          — Service worker, utilitários de serviço
│       ├── utils/             — Funções de utilitário (roles, storage, formatação)
│       └── config/            — Constantes e configurações do frontend
└── docs/
    ├── ai/                    — Documentação institucional gerada
    ├── rollout/               — Go/No-go, lições aprendidas
    ├── releases/              — Changelog, known issues, estratégias de sprint
    ├── operations/            — Planos de rollout, resposta a incidentes
    ├── security/              — Operações de segurança
    └── *.md                   — LGPD/CFM, DR, resiliência, multi-UBS, CloudWatch
```

---

## 5. Perfis de Usuário (RBAC)

O RBAC é baseado em **capabilities** (capacidades granulares), não apenas em roles. Cada role tem um conjunto fixo de capabilities definido em `utils/helpers.js` (`ROLE_CAPABILITIES`).

### nurse_manager (Enfermeira Gestora)

**Capabilities:** dashboard.read, patients.read.all, patients.write, agenda.read/write, referrals.read/write, records.read/write, exams.read/write, appointments.write, tasks.read/write, messages.read/write, protocols.manage, reports.read, diagnostics.read, pharmacy.read, supplies.read/write, users.read.scoped, users.manage.scoped, audit.read, privacy.manage, team.manage, backup.export, admin.seed, metrics.internal.read, ai.access

**Escopo de acesso a pacientes:** `patients.read.all` — todos os pacientes da equipe e acesso cross-team (com auditoria)

**Limitações:** Só pode cadastrar/editar ACS e Médico(a) na sua equipe. Não pode gerenciar outras equipes ou unidades.

**Risco de abuso:** Acesso amplo ao prontuário; pode executar backup/export; pode gerenciar usuários da equipe.

---

### doctor (Médico/a)

**Capabilities:** dashboard.read, patients.read.all, patients.write, agenda.read/write, referrals.read/write, records.read/write, exams.read/write, appointments.write, tasks.read/write, messages.read/write, protocols.manage, reports.read, diagnostics.read, pharmacy.read, supplies.read, users.read.scoped, audit.read, ai.access

**Escopo:** `patients.read.all` — acesso a todos os pacientes, cross-team com auditoria

**Limitações:** Não tem `supplies.write`, `privacy.manage`, `backup.export`, `team.manage`. Edição de paciente restrita a campos clínicos (phone, address, comorbidades, gestação).

**Risco de abuso:** Único role (junto com dentist) que pode criar prescrições e atestados médicos.

---

### dentist (Dentista)

**Capabilities:** dashboard.read, patients.read.all, records.read/write, exams.read/write, referrals.read/write, reports.read, diagnostics.read, users.read.scoped, ai.access

**Escopo:** `patients.read.all` — leitura ampla, mas sem agenda e sem queue

**Limitações:** Sem agenda.write, sem appointments.write independente, sem pharmacy, sem supplies.

---

### gestor (Gestor da Unidade)

**Capabilities:** dashboard.read, patients.read.all, agenda.read, referrals.read/write, records.read, exams.read, reports.read, diagnostics.read, pharmacy.read, supplies.read, users.read.all, audit.read, access_requests.read, backup.export, admin.seed, metrics.internal.read

**Escopo:** `patients.read.all` mas isolado à sua unidade (`unitId`). `users.read.all` para ver todos os usuários da unidade. Audit logs sem restrição de equipe dentro da unidade.

**Limitações:** Sem `records.write`, `patients.write`, `agenda.write`. É um perfil de governança e supervisão, não clínico.

**Risco de abuso:** Acesso a `backup.export` e visão completa da unidade.

---

### acs (Agente Comunitário de Saúde)

**Capabilities:** dashboard.read, patients.read.scoped, records.read, records.write, referrals.read/write, tasks.read

**Escopo:** `patients.read.scoped` — **somente pacientes da própria equipe** (teamId correspondente). Nunca cross-team.

**Limitações explícitas (hard-coded no código):**
- Só pode criar registros clínicos do tipo `visit` (visita domiciliar)
- Só pode inativar visitas criadas por si mesmo
- Não pode enviar mensagens no módulo de mensagens
- `canAccessAllPatients()` retorna `false` para ACS incondicionalmente

**Risco de abuso:** Mínimo — escopo muito restrito.

---

### nursing_tech (Técnico de Enfermagem)

**Capabilities:** dashboard.read, queue.read/write, agenda.read, referrals.read/write, patients.read.all, records.read, exams.read/write, reports.read, supplies.read/write

**Escopo:** `patients.read.all` — acesso de leitura a todos os pacientes

**Limitações:** Sem records.write, sem pharmacy.

---

### pharmacist / pharmacy_tech (Farmacêutico / Técnico de Farmácia)

**Capabilities:** dashboard.read, pharmacy.read/write, supplies.read/write

**Escopo:** Restrito às operações de farmácia e insumos. Sem acesso a prontuário ou pacientes.

---

### receptionist (Recepcionista)

**Capabilities:** dashboard.read, patients.read.scoped, queue.read/write, agenda.read/write

**Escopo:** `patients.read.scoped` — somente pacientes da equipe. Gerencia chegada, fila e agendamento.

**Limitações:** Sem acesso a prontuário, registros clínicos, exames, prescrições.

---

### security_auditor

**Capabilities:** dashboard.read, patients.read.scoped, records.read, reports.read, diagnostics.read, users.read.all, audit.read, users.activity_log.read, metrics.internal.read, session.impersonate

**Escopo:** Leitura de auditoria global. Pode verificar integridade da cadeia de audit. Pode acessar relatórios operacionais (cross-team access, auth failures, rate limit abuse). Pode limpar degraded mode.

---

### developer_readonly / support_operator / qa_operator

**Capabilities:** dashboard.read, patients.read.scoped, records.read, reports.read, diagnostics.read, users.read.all, session.impersonate

**Escopo:** Perfis de suporte com acesso de leitura limitado. Não devem existir em UBS de produção — apenas ambientes de desenvolvimento/homologação.

---

### break_glass_admin

**Capabilities:** Todas as capabilities de produção, incluindo `session.break_glass.activate`, `users.manage.all`, `audit.read`, `privacy.manage`, `team.manage`, `backup.export`, `admin.seed`, e impersonation.

**Escopo:** Sem restrição de equipe ou unidade. Acesso de emergência completo.

**Restrições operacionais:** Toda ação gera evento de auditoria. Sessão break glass tem TTL configurável (padrão 15 minutos via `BREAK_GLASS_TTL_MS`). Deve existir exatamente um por implantação, com credenciais em cofre seguro.

---

## 6. Estrutura Multi-Tenant

### Hierarquia

```
organization (implícita — toda a instalação)
  └── unit (UBS) — identificada por unitId
        └── team (equipe de saúde) — identificada por teamId, tem managerUserId
              └── user (profissional) — tem teamId + unitId
              └── patient (paciente) — tem teamId + assignedAcsId + microArea
```

### Como o isolamento é aplicado

**ACS:**
- `canAccessAllPatients(acs_user)` retorna `false` incondicionalmente (`utils/helpers.js`)
- Só enxerga pacientes com `patient.teamId === user.teamId`
- Tentativa de acesso a paciente de outra equipe → 403 ou registro não retornado

**Receptionist:**
- `patients.read.scoped` — mesma restrição de equipe

**Nurse_manager / Doctor / Nursing_tech:**
- `patients.read.all` permite acesso cross-team
- Qualquer acesso a paciente de outra equipe gera evento `cross_team_patient_access` no audit log
- `restrictSummaryAlertsForForeignTeam()` mascara alertas de protocolo para pacientes de outras equipes

**Gestor:**
- `canAccessUnit(user, unitId)` verifica `user.unitId === unitId`
- Vê todos os pacientes das equipes vinculadas à sua unidade
- `users.read.all` — todos os usuários, mas filtrado por unitId implicitamente nas listagens

**Break glass admin:**
- Sem restrição de unit ou team
- Toda ação auditada

### Bootstrap de nova UBS

1. Criar conta de gestor (via `POST /auth/register` com role `gestor`)
2. Executar `POST /admin/units/bootstrap` (requer break_glass_admin) com `{ unitId, unitName, gestorUserId }`
3. A operação é atômica — cria a unidade e vincula o gestor em uma transação; aborta se o gestor desaparecer entre validação e mutação

---

## 7. Módulos do Sistema

### 7.1 Autenticação (`/auth`)

**Objetivo:** Gestão de sessões JWT com cookies HttpOnly, 2FA TOTP, solicitações de acesso.

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | /auth/login | Não | Login com email/senha; retorna 2FA challenge se habilitado |
| POST | /auth/login/verify | Não | Verifica código TOTP do challenge de login |
| POST | /auth/refresh | Não | Rotação de refresh token; emite novos access + refresh |
| POST | /auth/logout | Sim | Revoga refresh token, limpa cookies |
| POST | /auth/register | Não | Auto-cadastro de roles permitidas (PUBLIC_SELF_REGISTER_ROLES) |
| POST | /auth/access-requests | Não | Solicitação de acesso para perfis não auto-cadastráveis |
| GET | /auth/access-requests | Sim (access_requests.read) | Lista solicitações de acesso |
| POST | /auth/access-requests/:id/approve | Sim | Aprova solicitação |
| POST | /auth/access-requests/:id/reject | Sim | Rejeita solicitação |

**Regras críticas:**
- Tokens emitidos via cookies HttpOnly (vitras_access, vitras_refresh) e também retornados no body para clientes que usam Bearer
- Refresh token armazenado como hash HMAC-SHA256; nunca em plaintext
- Em produção, self-register é limitado a `receptionist` por padrão (`PUBLIC_SELF_REGISTER_ROLES`)
- Login com 2FA habilitado: fluxo em dois passos com challenge de 5 minutos e máximo 5 tentativas
- Falha de login → evento `auth.login_failed` no audit com email mascarado
- Senha deve ter mínimo 8 caracteres, 1 maiúscula, 1 número, 1 especial

---

### 7.2 Perfil do Usuário (`/me`)

**Objetivo:** Dados e ações do usuário autenticado, 2FA, impersonação, break glass.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /me | Dados do usuário atual com contexto de sessão |
| GET | /me/access-context | Contexto de acesso (impersonação, break glass ativo) |
| PATCH | /me | Atualiza nome, email, senha, dados de conselho |
| GET | /me/2fa/status | Status do 2FA |
| POST | /me/2fa/setup | Inicia configuração de 2FA TOTP |
| POST | /me/2fa/confirm | Confirma e ativa 2FA |
| DELETE | /me/2fa | Desabilita 2FA |
| POST | /me/impersonate/start | Inicia impersonação de outro usuário (session.impersonate) |
| POST | /me/impersonate/stop | Para impersonação |
| POST | /me/break-glass/activate | Ativa sessão break glass (session.break_glass.activate) |
| POST | /me/break-glass/deactivate | Desativa sessão break glass |

---

### 7.3 Usuários (`/users`)

**Objetivo:** Gestão de usuários da equipe pela enfermeira gestora.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /teams/public | Lista equipes (público — necessário para auto-cadastro) |
| GET | /users | Lista usuários da equipe (ou todos para users.read.all) |
| GET | /users/activity-log | Painel de usuários online (users.activity_log.read) |
| POST | /users | Cria ACS ou Médico na equipe (requireManager) |
| GET | /users/:id/usage | Verifica vínculos do usuário antes de excluir |
| PUT | /users/:id | Atualiza ACS/Médico da equipe |
| DELETE | /users/:id | Exclui ACS/Médico (somente se sem vínculos) |

**Regras:** Nurse_manager só pode criar/editar/excluir ACS ou Médico da sua equipe. Exclusão bloqueada se usuário tem vínculos ativos (pacientes, registros).

---

### 7.4 Pacientes (`/patients`)

**Objetivo:** Cadastro e prontuário eletrônico de pacientes.

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /patients | Sim | Lista pacientes com filtros (microArea, acsId, careCategory) |
| GET | /patients/protocol-summaries | Sim | Resumos de protocolo em lote |
| POST | /patients | Sim (requireManagerOrDoctor) | Cadastra novo paciente |
| PUT | /patients/:id | Sim | Atualiza dados do paciente |
| DELETE | /patients/:id | Sim (requireManagerOrDoctor) | Inativa paciente (soft delete obrigatório) |
| GET | /patients/:id/appointments | Sim | Lista atendimentos |
| POST | /patients/:id/appointments | Sim | Registra atendimento |
| DELETE | /patients/:id/appointments/:appointmentId | Sim | Inativa atendimento |
| POST | /patients/:id/records | Sim | Cria registro clínico |
| DELETE | /patients/:id/records/:recordId | Sim | Inativa registro clínico (soft) |
| PATCH | /patients/:id/records/:recordId/inactivate | Sim | Inativa/cancela registro com justificativa |
| GET | /patients/:id/history | Sim | Histórico clínico completo |
| GET | /patients/:id/protocol-summary | Sim | Resumo de protocolo individual |
| GET | /patients/:id/messages | Sim | Mensagens do paciente |
| POST | /patients/:id/messages | Sim | Envia mensagem |
| GET | /records/prescriptions | Sim | Lista prescrições de pacientes permitidos |
| GET | /metrics/demand/monthly | Sim | Métrica mensal de demanda |
| GET | /metrics/data-quality | Sim | Qualidade de dados |

**Regras críticas:**
- CPF/CNS duplicado em paciente ativo → 409 (verificado por HMAC hash index)
- Inativação de paciente exige justificativa obrigatória
- Deletion física de registros clínicos é **proibida** — apenas soft-inactivation
- ACS só pode criar registros tipo `visit`
- Prescrições e atestados médicos: exclusivo doctor/dentist
- CPF/CNS mascarados em todas as respostas (`maskSensitivePatientFields`)
- Acesso cross-team gera evento `cross_team_patient_access` no audit
- Snapshot clínico capturado no momento da criação para prescription/medical_attest/referral

---

### 7.5 Fila (`/queue`)

**Objetivo:** Gestão da fila de atendimento presencial com prioridades.

Endpoints: GET /queue, POST /queue, PATCH /queue/:id, DELETE /queue/:id

**Prioridades de fila:** urgent (0) > elderly (1) > pregnant (2) > child (3) > normal (4)

**Estados:** waiting → triage → ready → attending → done

---

### 7.6 Agenda (`/agenda`)

**Objetivo:** Agendamento de consultas, retornos e procedimentos.

Endpoints: GET /agenda, POST /agenda, PATCH /agenda/:id, DELETE /agenda/:id

**Tipos:** consultation, return, procedure, other

**Estados:** scheduled → arrived → attending → done | absent

---

### 7.7 Encaminhamentos (`/referrals`)

**Objetivo:** Solicitações de encaminhamento a especialidades.

Endpoints: GET /referrals, POST /referrals, PATCH /referrals/:id, DELETE /referrals/:id

**Prioridades:** urgent, priority, routine

**Estados:** pending → regulated → scheduled → done | cancelled

---

### 7.8 Farmácia (`/pharmacy`)

**Objetivo:** Controle de estoque de medicamentos e dispensação.

Endpoints: GET /pharmacy/stock, POST /pharmacy/stock, PUT /pharmacy/stock/:id, POST /pharmacy/dispense, POST /pharmacy/adjust, GET /pharmacy/logs

**Estoque padrão:** 15 medicamentos essenciais da Farmácia Básica (paracetamol, dipirona, amoxicilina, enalapril, metformina, insulina NPH, sulfato ferroso, ácido fólico, etc.)

---

### 7.9 Insumos (`/supplies`)

**Objetivo:** Controle de materiais de uso individual contínuo (fraldas, curativos, sondas, etc.)

Endpoints: GET /supplies/stock, POST /supplies/stock, PATCH /supplies/stock/:id, GET /supplies/continuous, POST /supplies/continuous, PATCH /supplies/continuous/:id

---

### 7.10 Exames (`/exams`)

**Objetivo:** Solicitação e controle de exames laboratoriais e de imagem.

Endpoints: GET /exams, POST /exams, PATCH /exams/:id, DELETE /exams/:id

---

### 7.11 Prontuário (`/medical-records`)

Endpoints complementares ao módulo de registros clínicos do `/patients`.

---

### 7.12 Tarefas (`/tasks`)

**Objetivo:** Tarefas atribuídas a profissionais (visitas agendadas, follow-ups, etc.)

Endpoints: GET /tasks, POST /tasks, PATCH /tasks/:id, DELETE /tasks/:id

---

### 7.13 Grupos Familiares (`/family-groups`)

**Objetivo:** Agrupamento de pacientes por unidade familiar para rastreamento de visitas domiciliares pelo ACS.

---

### 7.14 Protocolos (`/protocols`)

**Objetivo:** Templates de protocolo de cuidado por categoria (gestante, crônico, puericultura, idoso, geral, puérpera) com metas de visitas, consultas e vacinas baseadas em normativas do Ministério da Saúde.

Categorias suportadas: general (PNAB-2017), pregnant (Rede Cegonha), puerperal (Rede Cegonha), child_followup (Calendário PNI), chronic (DCNT 2021-2030), elderly.

---

### 7.15 Audit Logs (`/audit-logs`)

**Objetivo:** Trilha de auditoria com integridade de hash chain, exportação e relatórios operacionais.

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /audit-logs | Sim (requireManagerOrDoctor) | Lista com filtros e cursor paginado |
| GET | /audit-logs/export | Sim (requireManagerOrDoctor) | Exporta JSON ou CSV |
| POST | /audit-logs/retention/prune | Sim (gestor/security_auditor/break_glass_admin) | Prune de logs antigos (AUDIT_PRUNE_ENABLED=true) |
| GET | /audit-logs/integrity | Sim (security_auditor/break_glass_admin) | Verifica integridade da hash chain |
| GET | /audit-logs/reports/cross-team-access | Sim (security_auditor/break_glass_admin) | Relatório de acessos cross-team |
| GET | /audit-logs/reports/auth-failures | Sim (security_auditor/break_glass_admin) | Relatório de falhas de autenticação |
| GET | /audit-logs/reports/rate-limit-abuse | Sim (security_auditor/break_glass_admin) | Relatório de abuso de rate limit |

---

### 7.16 Privacidade LGPD (`/privacy`)

**Objetivo:** Gestão de requisições LGPD (acesso, correção, exclusão/anonimização).

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /privacy/requests | Sim (requireManager) | Lista solicitações LGPD da equipe |
| POST | /privacy/requests | Sim (requireManager) | Cria solicitação (access/correction/deletion) |
| PATCH | /privacy/requests/:id | Sim (requireManager) | Atualiza status da solicitação |
| POST | /privacy/requests/:id/execute | Sim (requireManager) | Executa a solicitação |
| POST | /privacy/retention/anonymize | Sim (requireManager) | Anonimização em lote por período de inatividade |

**Atenção KI-02:** Execução de `deletion` atualmente exclui `clinicalRecords` — conflito com CFM 1821/2007. Endpoint `deletion` está bloqueado operacionalmente até revisão jurídica (Sprint 5A).

---

### 7.17 Admin (`/admin`)

**Objetivo:** Operações administrativas de infraestrutura e governança.

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /admin/backup/export | Sim (backup.export + x-backup-key) | Exporta snapshot completo do banco |
| GET | /bootstrap | Sim | Bootstrap de dados iniciais para a sessão |
| GET | /integrations/council/status | Sim | Status da integração com CRM/COREN |
| POST | /admin/patients/reset-populate | Sim (admin.seed + x-admin-seed-key) | Popula base com dados demo (dev/staging) |
| GET | /metrics/internal | Sim (metrics.internal.read) | Métricas internas do servidor |
| POST | /admin/rebuild-patient-hashes | Sim (backup.export + x-backup-key) | Reconstrói hashes HMAC de CPF/CNS |
| POST | /admin/units/bootstrap | Sim (break_glass_admin) | Bootstrap de nova UBS |
| POST | /admin/system/clear-degraded | Sim (break_glass_admin/security_auditor) | Limpa modo degradado |

---

### 7.18 Health (`/health`, `/readyz`)

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /health | Não | Status do sistema com subsistemas (postgres, redis, migrations, auditChain) |
| GET | /readyz | Não | Gate estrito para EB: 200 apenas quando ready+postgres OK |
| GET | /metrics/internal | Não (dev) | Métricas internas (apenas não-prod) |
| POST | /csp-report | Não | Receptor de violações CSP |

**EB health check deve apontar para `/readyz`, não `/health`.** `/health` retorna 200 mesmo em modo degradado; `/readyz` retorna 503 até startup completo.

---

## 8. Fluxos Operacionais UBS

### 8.1 Recepção — Chegada de Paciente

1. Paciente chega na UBS
2. Recepcionista busca paciente no sistema (GET /patients com query)
3. Se não encontrado: ACS ou Enfermeira cadastra (POST /patients)
4. Recepcionista adiciona à fila (POST /queue) com demandType (scheduled/spontaneous) e priority
5. Status da fila atualizado conforme progressão: waiting → triage → ready → attending → done

### 8.2 Atendimento Clínico

1. Médico/Enfermeira seleciona paciente da fila/agenda
2. Consulta histórico clínico (GET /patients/:id/history)
3. Verifica resumo de protocolo (GET /patients/:id/protocol-summary) — alertas de atraso em visitas/vacinas/consultas
4. Registra atendimento (POST /patients/:id/appointments)
5. Cria registros clínicos (POST /patients/:id/records) — tipos: consultation, prescription, medical_attest, referral, procedure, note, exam_request, nursing, evolution, vaccine, attendance_attest
6. Se encaminhamento necessário: POST /referrals
7. Se prescrição: POST /patients/:id/records com type=prescription (captura clinicalSnapshot automático)

### 8.3 ACS — Visita Domiciliar

1. ACS acessa lista de pacientes da sua equipe/microárea (GET /patients?microArea=X)
2. Verifica tarefas pendentes (GET /tasks)
3. Registra visita (POST /patients/:id/records com type=visit)
4. Pode criar encaminhamento se observar necessidade
5. Atualiza grupos familiares automaticamente via syncPatientFamilyGroup

### 8.4 Farmácia

1. Farmacêutico verifica estoque (GET /pharmacy/stock)
2. Prescrição gerada pelo médico aparece em /records/prescriptions
3. Dispensação registrada (POST /pharmacy/dispense) — debita estoque e cria log
4. Ajustes de estoque (entrada/saída manual) via POST /pharmacy/adjust

### 8.5 Gestão/Governança

1. Gestor acessa dashboard com visão da unidade completa
2. Revisa audit logs (/audit-logs) para monitoramento de acesso
3. Relatórios operacionais: cross-team access, falhas de auth, abuso de rate limit
4. Exporta audit logs (/audit-logs/export) para CSV ou JSON
5. Acesso a métricas de demanda mensal e qualidade de dados

### 8.6 Incidente — Sistema em Falha Durante Atendimento

1. Verificar /health e /readyz — identificar subsistema falhando
2. Se `/readyz` retorna 503 mas `/health` retorna 200 (degraded): executar POST /admin/system/clear-degraded
3. Se postgres inacessível: fallback para protocolo em papel (definido no aceite operacional)
4. Ativar break_glass_admin se acesso de emergência necessário (gera auditoria completa)
5. Consultar docs/operations/incident-response.md para classificação P0/P1/P2/P3

---

## 9. Entidades Principais

### Patient (Paciente)

**Storage:** app_state.patients[] / shadow table app_patients

**Campos principais:**
- id (UUID), teamId, name, motherName, cpf\*, cns\*, cnsCpf\*
- birthDate, sexAtBirth, genderIdentity, maritalStatus
- address, phone, phoneAlt, microArea, assignedAcsId
- careCategory (general/pregnant/puerperal/child_followup/chronic/elderly)
- chronicConditions[], incompleteProfile, inactive, inactivationReason, inactivatedAt
- Campos de gestação: pregnancyStartDate, expectedDeliveryDate, gestationalAgeXxWeeks/Days, usgDate1-3
- comorbidities, medications, allergies
- createdAt, createdBy, updatedAt, updatedBy

\* CPF, CNS, cnsCpf criptografados com AES-256-GCM em repouso; mascarados nas respostas API; HMAC-hash nos campos cpf_hash/cns_hash para indexação única

**Relacionamentos:** pertence a team, tem appointments[], clinicalRecords[], tasks[], referrals[], queueEntries[], agendaEntries[], familyGroup

**Regras:** CPF/CNS únicos entre pacientes ativos; inativação é soft-delete com justificativa obrigatória; deleção física proibida

**Auditoria:** patient.created, patient.updated, patient.inactivated, patient.list_read, patient.history_read, cross_team_patient_access

---

### User (Usuário)

**Storage:** app_state.users[] / shadow table app_users

**Campos principais:** id, name, role, email, password (s1$salt$hash), teamId, unitId, councilType, councilNumber, councilUf, twoFactorEnabled, twoFactorSecret\*, twoFactorPendingSecret\*, lastLoginAt, lastSeenAt, inactive

\* twoFactorSecret e twoFactorPendingSecret criptografados com AES-256-GCM

**Auditoria:** auth.login, auth.login_failed, auth.logout, auth.register, user.created_by_manager, user.updated_by_manager, user.deleted_by_manager

---

### ClinicalRecord (Registro Clínico)

**Storage:** app_state.clinicalRecords[]

**Tipos:** visit, consultation, vaccine, procedure, note, prescription, exam_request, referral, nursing, evolution, attendance_attest, medical_attest

**Campos:** id, patientId, type, title, details, date, protocolTag, metadata{specialty, rapidTestTrimester...}, clinicalSnapshot (prescription/medical_attest/referral), status, statusReason, createdBy, createdAt

**Regras:** Deleção física proibida (CFM 1821/2007); apenas inativação (status=inactive/cancelled). Prescrições/atestados: exclusivo doctor/dentist. ACS: apenas type=visit. Clinical snapshot capturado automaticamente em prescription/medical_attest/referral.

---

### Appointment (Atendimento)

**Storage:** app_state.appointments[] / shadow table app_appointments

**Campos:** id, patientId, date, summary, demandType (scheduled/spontaneous), conduct, nextStep, createdBy, createdAt

---

### AuditLog

**Storage:** app_state.auditLogs[] / shadow table app_audit_logs

**Campos:** id, action, entity, entityId, category, severity, teamId, teamName, userId, userName, userRole, actor{id, name, role, impersonation, breakGlass}, request{id, ip, userAgent, method, path, authTransport}, outcome, before, after, details, prevHash, hash, createdAt

**Cadeia de integridade:** hash = SHA256(JSON.stringify({...entry_without_hash, prevHash})). Verificável via GET /audit-logs/integrity. Evicções geram anchor em auditLogChainAnchors[].

**Retenção padrão:** 2 anos (AUDIT_LOG_RETENTION_DAYS = 730). Prune exige AUDIT_PRUNE_ENABLED=true.

---

### RefreshToken

**Storage:** app_state.refreshTokens[] / shadow table app_refresh_tokens

**Campos:** id, userId, tokenHash (HMAC-SHA256), sessionId, sessionContext{impersonation, breakGlass}, ip, expiresAt, revokedAt, createdAt

---

### PrivacyRequest (Solicitação LGPD)

**Storage:** app_state.privacyRequests[]

**Tipos:** access (relatório de acesso), correction (correção de dados), deletion (anonimização)

**Estados:** pending → in_review → approved/rejected → completed

**Campos:** id, teamId, patientId, type, status, notes, correctionData, createdBy, decidedAt, decidedBy, completedAt, result

---

### Unit (Unidade de Saúde/UBS)

**Storage:** app_state.units[] / shadow table app_units

**Campos:** id, name, inactive, createdAt

---

### Team (Equipe de Saúde)

**Storage:** app_state.teams[]

**Campos:** id, name, managerUserId, unitId, createdAt

---

### QueueEntry

**Storage:** app_state.queueEntries[]

**Campos:** id, patientId, patientName, teamId, priority (urgent/elderly/pregnant/child/normal), demandType, destination, status (waiting/triage/ready/attending/done/removed/cleared), arrivedAt

---

### AgendaEntry

**Storage:** app_state.agendaEntries[]

**Campos:** id, patientId, patientName, teamId, doctorId, doctorName, date, time, type (consultation/return/procedure/other), status (scheduled/arrived/attending/done/absent), notes

---

### Referral (Encaminhamento)

**Storage:** app_state.referrals[]

**Campos:** id, patientId, patientName, teamId, specialty, priority (urgent/priority/routine), status (pending/regulated/scheduled/done/cancelled), date, reason, notes, doctorId, doctorName

---

## 10. Segurança

### JWT

- **Access token:** expiração configurável via `ACCESS_TOKEN_EXPIRES_IN` (padrão: `JWT_EXPIRES_IN` = 12h); algoritmo HS256
- **Refresh token:** 7 dias (`REFRESH_TOKEN_EXPIRES_IN`); rotação a cada uso (token anterior revogado imediatamente)
- **Cookies:** vitras_access (HttpOnly, Secure em prod, SameSite=lax), vitras_refresh (HttpOnly), vitras_csrf (não-HttpOnly — lido pelo cliente e enviado em header)
- **CSRF:** `requireCsrfForCookieAuth` — quando auth via cookie, verifica header `x-csrf-token` contra cookie `vitras_csrf`
- **Issuer/Audience:** `vitras-backend` / `vitras-client` (verificados em jwt.verify)

### RBAC e Capabilities

Implementado em `utils/helpers.js`. Hierarquia: role → capabilities[] → hasCapability(user, cap) nas rotas. Break glass eleva capabilities com BREAK_GLASS_CAPABILITIES[] durante sessão ativa.

### Rate Limiting

| Limiter | Prefixo | Limite | Janela |
|---------|---------|--------|--------|
| Global | global | 600 req | 60s |
| Auth | auth | 20 tentativas | 10min |
| Dados sensíveis | sensitive | 30 req | 60s |
| Exportação | export | 10 req | 60s |

Todos usam Upstash Redis sliding window em produção. Em desenvolvimento: express-rate-limit MemoryStore. Redis indisponível em produção → **fail-closed** (503, não pass-through).

### Circuit Breaker Redis

- Threshold: 5 falhas consecutivas em janela de 60s → **OPEN**
- OPEN: todas as requisições retornam 503 imediatamente (sem chamar Upstash)
- Após 30s: transição automática para **HALF_OPEN**
- HALF_OPEN: próxima requisição testa Redis; sucesso → CLOSED; falha → OPEN novamente
- Métricas: `circuit_breaker_opened/closed/half_open/reopened` emitidas via recordMetric

### Criptografia em Repouso

- **AES-256-GCM:** CPF, CNS, cnsCpf, twoFactorSecret, twoFactorPendingSecret
- **Formato:** `enc1:<iv_b64>:<encrypted_b64>:<tag_b64>`
- **Chave:** SHA256(DATA_ENCRYPTION_KEY) → 32 bytes
- **HMAC-SHA256 para busca:** cpf_hash/cns_hash calculados com PATIENT_LOOKUP_HASH_KEY (chave separada de DATA_ENCRYPTION_KEY em produção — obrigatório)

### Headers de Segurança

- Helmet com CSP: `default-src 'none'; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (prod)
- `Cache-Control: no-store` em todas as respostas autenticadas

### Fail-Closed Philosophy

- Redis down em produção → 503 (não ignora o rate limit)
- `canAccessAllPatients(acs_user)` retorna false incondicionalmente para ACS
- `canAccessTeam(user, teamId)` falha se `user.teamId` vazio
- `checkCriticalMigrations()` aborta o boot se migration crítica ausente

---

## 11. Auditoria e Compliance

### Formato do Audit Log

Cada entrada contém: id, action, entity, entityId, category (auth/read/write/privacy/export/general), severity (info/medium/high), actor completo (com impersonation e breakGlass se ativos), request (IP, UA, método, path, authTransport), outcome, before/after snapshots, prevHash, hash, createdAt.

### Cadeia de Integridade

- **Algoritmo:** SHA-256 do objeto JSON sem o campo `hash`, incluindo `prevHash`
- **Verificação:** GET /audit-logs/integrity retorna status valid/broken/orphaned com firstBrokenId
- **Evicção com anchor:** quando o array ultrapassa MAX_AUDIT_LOGS (padrão 10.000), entradas antigas são removidas e um anchor é salvo em `auditLogChainAnchors[]` com os hashes de fronteira para permitir verificação forense das evicções

### Clinical Snapshots

Registros de tipo `prescription`, `medical_attest` e `referral` incluem `clinicalSnapshot` com:
- Nome e CPF mascarado do paciente no momento da criação
- Data de nascimento
- teamId
- Nome, role e teamId do autor

Esses snapshots persistem mesmo após anonimização do paciente (até o momento — KI-02).

### LGPD

- **Direito de acesso:** GET /privacy/requests execute (type=access) gera relatório de dados
- **Direito de correção:** execute (type=correction) aplica correctionData ao paciente
- **Direito de erasure:** execute (type=deletion) executa `anonymizePatientBundle()` — **ATENÇÃO: atualmente exclui clinicalRecords (KI-02)**
- **Pre-flight audit:** antes de qualquer anonimização, evento `anonymization_warning_acknowledged` é persistido em transação separada
- **CPF mascarado em todas as respostas API:** retornado como `***.***.***-**`

### Relatórios de Governança

Disponíveis para security_auditor e break_glass_admin:
- `/audit-logs/reports/cross-team-access` — acessos de profissionais a pacientes de outras equipes
- `/audit-logs/reports/auth-failures` — falhas de autenticação com email mascarado
- `/audit-logs/reports/rate-limit-abuse` — eventos de rate limit agrupados por prefixo

---

## 12. Observabilidade

### Logs Estruturados

Formato JSON em produção (`LOG_FORMAT=json`), texto em desenvolvimento. Campos: level, event, timestamp, requestId, correlationId + campos específicos do evento.

Eventos chave: `server_started`, `db_pool_created`, `migration_applied_ok`, `rate_limit_exceeded`, `circuit_breaker_opened/closed`, `auth.login_failed`, `audit_chain_failure`, `fatal_shutdown_initiated`.

### Métricas

`recordMetric(name, value, dimensions)` emite evento `vitras.metric` como log estruturado para ingestão pelo CloudWatch Logs Insights:
- `db_write_duration_ms` — latência de escrita no banco
- `rate_limit_hit` — contador de hits por prefixo
- `circuit_breaker_opened/closed/half_open` — eventos do circuit breaker
- `deadlock_retry` — retries por deadlock Postgres
- `auth_failure` — falhas de autenticação

### /health e /readyz

- **GET /health:** retorna 503 durante startup; 200 (ok=true, status=ok) quando pronto; 200 (status=degraded) em modo degradado. Inclui subsistemas: postgres, redis, migrations, auditChain.
- **GET /readyz:** gate estrito — 503 até ready=true AND postgres acessível. Usado como health check do EB.

### Fases de Startup

`booting` → `migrating` → `warming` → `ready` | `degraded` | `shutting_down`

O modo `degraded` mantém a instância em rotação no EB (não causa unhealthy) mas indica degradação de subsistema. Clearável via POST /admin/system/clear-degraded.

---

## 13. Operação e Rollout

### Baseline de Piloto

- Versão: `v1.0-pilot-governed`
- Tag: `81a704d`, branch: `release/pilot-baseline`
- 8 migrações Postgres aplicadas (001–008)
- 15 propriedades técnicas verificadas por inspeção de código (Sprint 0–4.1)

### Rollout UBS #1

Pré-condições bloqueantes pendentes (todas infraestrutura/operacionais, nenhum código):
1. DR drill executado e aprovado (RTO ≤ 240min, RPO ≤ 24h)
2. Smoke test staging aprovado (zero falhas críticas)
3. Tabletop exercise com equipe da UBS (pontuação ≥ 3/5)
4. contatos.md preenchido com todos os responsáveis
5. 8 alarmes CloudWatch configurados e ativos
6. EB health check URL = /readyz
7. break_glass_admin criado e credenciais em cofre seguro
8. aceite-operacional.md assinado pelo coordenador da UBS
9. RDS backup retention ≥ 7 dias confirmado
10. pre-deploy-validation.md completado e assinado

### Classificação de Incidentes

| Nível | Nome | Tempo de Resposta | Exemplos |
|-------|------|-------------------|---------|
| P0 | Critical | 15 minutos | Vazamento cross-tenant, audit chain quebrada, 5xx generalizado, banco inacessível |
| P1 | High | 1 hora | Rate limit causando indisponibilidade parcial, equipe sem login |
| P2 | Medium | 4 horas | Feature específica quebrada, alarme CloudWatch sem impacto de usuário |
| P3 | Low | 24 horas | Inconsistência de UI, query lenta, alarme não crítico |

### Rollback

Condições para rollback imediato (sem discussão):
- Exposição cross-tenant confirmada
- Quebra de integridade da cadeia de auditoria
- Corrupção de dados
- P0 sem causa raiz identificada em 30 minutos

Procedimento: EB version rollback via console AWS ou CLI. RDS: restore de snapshot (RPO ≤ 24h).

---

## 14. Regras de Negócio Críticas

1. **ACS não pode acessar pacientes fora da própria equipe** — `canAccessAllPatients(acs_user)` retorna `false` incondicionalmente; `patients.read.scoped` restringe ao teamId
2. **Profissionais clínicos podem acessar pacientes cross-team mas geram audit event** — `cross_team_patient_access` logado para cada criação de registro clínico em paciente de outra equipe
3. **Gestor vê apenas pacientes das equipes da sua unidade** — filtrado por `user.unitId === unit.id`
4. **CPF e CNS devem ser únicos por paciente ativo** — HMAC hash index (migration 006); violação → 409
5. **Migrações executam antes de `app.listen()`** — RUN_MIGRATIONS=true + checkCriticalMigrations() garantem que 006 está aplicada antes de aceitar tráfego
6. **Deleção física de registros clínicos é PROIBIDA (CFM 1821/2007)** — apenas soft-inactivation com statusReason obrigatório
7. **Anonimização LGPD vs CFM: conflito ativo** — `anonymizePatientBundle()` atualmente exclui clinicalRecords (KI-02); endpoint bloqueado operacionalmente até Sprint 5A
8. **Prescrições e atestados médicos exigem role doctor ou dentist** — hard-coded em `DOCTOR_ONLY_TYPES` e `CLINICAL_PRESCRIBER_ROLES` em patients.js
9. **ACS só pode criar registro tipo `visit`** — verificado explicitamente antes de criar qualquer registro clínico
10. **Rate limits fail-closed em produção** — Redis indisponível → 503, nunca pass-through
11. **break_glass_admin sempre gera auditoria** — toda ação registrada com actor.breakGlass no log
12. **Inativação de paciente exige justificativa** — campo `reason` obrigatório (CriticalActionReasonSchema)
13. **PATIENT_LOOKUP_HASH_KEY deve ser diferente de DATA_ENCRYPTION_KEY em produção** — verificado em validateProductionConfig()
14. **Boot aborta se migration crítica 006 ausente** — checkCriticalMigrations() antes de app.listen()
15. **Senha forte obrigatória** — mínimo 8 chars, 1 maiúscula, 1 número, 1 especial (isStrongPassword)

---

## 15. Riscos Conhecidos

### KI-01 — usersRouter Montado Antes do Global requireAuth

**Severidade:** MEDIUM (gap de defesa em profundidade, sem exploit ativo)

**Descrição:** Em `app.js`, `usersRouter` é registrado antes do middleware global `requireAuth`. Todas as rotas atuais em `users.js` têm proteção inline, mas qualquer rota futura adicionada sem `requireAuth` inline ficaria publicamente acessível.

**Mitigação:** Todas as rotas verificadas. Code review obrigatório para mudanças em `users.js`.

**Sprint alvo:** Sprint 5A (mover `usersRouter` para após `requireAuth` global)

---

### KI-02 — Tensão LGPD vs CFM 1821/2007 na Anonimização

**Severidade:** HIGH (risco regulatório em produção regulada)

**Descrição:** `anonymizePatientBundle()` exclui fisicamente `clinicalRecords`. Satisfaz LGPD Art. 16 (erasure) mas conflita com CFM 1821/2007 (retenção por 20 anos). Endpoint de deleção bloqueado operacionalmente.

**Mitigação atual:** Clinical snapshots em prescrições/encaminhamentos persistem no audit log. Pre-flight audit `anonymization_warning_acknowledged` documenta a decisão.

**Sprint alvo:** Sprint 5A — anonimização seletiva preservando conteúdo clínico com PII removido

---

### KI-03 — rejectUnauthorized: false na Conexão RDS

**Severidade:** MEDIUM (risco residual documentado)

**Descrição:** `db.js` usa `ssl: { rejectUnauthorized: false }` para conexão RDS. Certificado RDS não é validado — risco teórico de MITM.

**Mitigação:** VPC AWS + security groups isolam o caminho de conexão.

**Sprint alvo:** Sprint 5B — bundle do CA bundle AWS RDS

---

### KI-04 — Limitações do Modo Arquivo (JSON)

**Severidade:** MEDIUM (escopo arquitetural)

**Descrição:** File-mode não escala além de um processo. Sem scaling horizontal, sem atomicidade garantida em crash, sem connection pooling.

**Mitigação:** Produção sempre usa modo Postgres. File-mode é dev-only.

---

### KI-05 — Multi-probe no Circuit Breaker HALF_OPEN

**Severidade:** LOW (cosmético)

**Descrição:** Múltiplas requisições concorrentes podem agir como probes em HALF_OPEN ao invés de uma probe controlada.

**Mitigação:** Sem impacto para o usuário. Recuperação automática está correta.

**Sprint alvo:** Sprint 5B

---

### KI-06 — crypto.randomUUID() sem Fallback

**Severidade:** LOW (risco próximo de zero em Node.js 18+)

**Descrição:** `privacy.js` usa `crypto.randomUUID()` sem fallback para `uuidv4()`. Requer Node.js ≥ 15.13.0.

**Mitigação:** EB obriga Node.js 18+.

**Sprint alvo:** Sprint 5A (trivial — substituir por uuidv4)

---

### KI-07 — Falhas Pré-existentes em Testes

**Severidade:** LOW (gaps de infraestrutura de teste, sem impacto em produção)

**Descrição:** pharmacy.test.js, access-requests.test.js, twofa.test.js com falhas pré-existentes não relacionadas a código de produção.

**Sprint alvo:** Sprint 5A

---

## 16. Glossário UBS/GovTech

| Termo | Definição |
|-------|-----------|
| **UBS** | Unidade Básica de Saúde — unidade de atenção primária à saúde do SUS |
| **ACS** | Agente Comunitário de Saúde — profissional que realiza visitas domiciliares em microáreas geográficas |
| **ESF** | Estratégia Saúde da Família — modelo de organização da atenção primária em equipes multiprofissionais |
| **NASF** | Núcleo Ampliado de Saúde da Família — equipe de apoio às equipes ESF com especialistas |
| **Prontuário** | Conjunto de documentos que registram a história clínica de um paciente |
| **CID** | Classificação Internacional de Doenças — código para diagnósticos |
| **SOAP** | Subjetivo / Objetivo / Avaliação / Plano — estrutura de registro de consulta médica |
| **Microárea** | Subdivisão geográfica da área de cobertura de um ACS dentro da ESF |
| **Equipe de saúde** | Grupo de profissionais (médico, enfermeiro, ACS, técnico) responsável por uma área territorial |
| **Gestor** | Profissional responsável pela coordenação e gestão administrativa de uma UBS |
| **Farmácia básica** | Conjunto de medicamentos essenciais disponibilizados gratuitamente pelo SUS nas UBS |
| **Encaminhamento** | Documento que encaminha o paciente da atenção primária para atenção especializada |
| **SISS** | Sistema de Informação em Saúde para a Atenção Básica — sistema governamental de registro |
| **LGPD** | Lei Geral de Proteção de Dados (Lei 13.709/2018) — regulamentação de dados pessoais no Brasil |
| **CFM** | Conselho Federal de Medicina — órgão que regula o exercício médico no Brasil |
| **CNS** | Cartão Nacional de Saúde — identificação do cidadão no SUS |
| **CPF** | Cadastro de Pessoa Física — documento de identificação fiscal brasileiro |
| **CRM** | Conselho Regional de Medicina — registro obrigatório para exercício médico |
| **COREN** | Conselho Regional de Enfermagem — registro obrigatório para exercício de enfermagem |
| **Break glass** | Acesso de emergência com permissões elevadas, auditado integralmente, para situações onde o fluxo normal falha ou há urgência crítica |
| **Circuit breaker** | Padrão de tolerância a falhas: monitora falhas em chamadas externas (Redis) e abre o circuito para evitar cascata de erros, retornando 503 até recuperação |
| **Degraded mode** | Estado do servidor onde um subsistema está degradado mas a instância permanece em rotação no EB (readiness=true, status=degraded). Clearável via endpoint administrativo |
| **Hash chain** | Cadeia de hashes SHA-256 onde cada entrada inclui o hash da entrada anterior, tornando qualquer adulteração detectável retroativamente |
| **Clinical snapshot** | Captura imutável do contexto clínico (paciente, prescritor) no momento da criação de prescrição/atestado/encaminhamento |
| **Soft delete** | Inativação lógica de um registro (inactive=true, status=inactive) sem exclusão física do banco de dados |
| **HMAC** | Hash-based Message Authentication Code — algoritmo de hash com chave secreta usado para criar o índice determinístico de CPF/CNS sem expor os valores em plaintext |
| **Shadow tables** | Tabelas Postgres relacionais que espelham o conteúdo do JSONB app_state para permitir queries SQL eficientes sem deserializar o JSONB |
| **GO CONDICIONADO** | Status de aprovação parcial — baseline técnico aprovado, pendências operacionais/infraestrutura a resolver antes do go-live |
| **Puericultura** | Acompanhamento do desenvolvimento de crianças (child_followup) — protocolo com vacinas e consultas frequentes |
| **Puérpera** | Mulher no período pós-parto (puerperal) — protocolo de acompanhamento pós-parto |

---

## 17. Estado Atual

| Aspecto | Valor |
|---------|-------|
| Versão | v1.0-pilot-governed |
| Branch | release/pilot-baseline |
| Tag | 81a704d |
| Sprint ativa | Sprint 5A (planejada, não iniciada) |
| Status UBS #1 | GO CONDICIONADO — 10 pré-condições operacionais pendentes |
| Migrações aplicadas | 8 (001–008) |
| Migration crítica | 006_patient_hash_columns (guard de boot ativo) |
| Known issues ativos | KI-01 a KI-07 |
| Sprint 5A foco | Anonimização seletiva (KI-02), KI-06, KI-07, KI-01 (usersRouter) |
| Sprint 5B foco | RDS CA bundle (KI-03), Postgres audit path, KI-05 |
| Baseline técnico | 15/15 propriedades verificadas por inspeção de código |

**Bloqueio operacional ativo:** Endpoint `POST /privacy/requests/:id/execute` com type=deletion bloqueado até revisão jurídica LGPD/CFM (KI-02).
