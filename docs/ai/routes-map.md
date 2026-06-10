# VITRAS — Mapa Completo de Rotas da API

**Versão:** v1.0-pilot-governed
**Atualizado:** 2026-05-26
**Base:** `backend/src/routes/` + `backend/src/app.js`

---

## Convenções

- **Auth** = `requireAuth` middleware (JWT obrigatório via cookie ou header)
- **CSRF** = `requireCsrfForCookieAuth` (obrigatório para requisições autenticadas via cookie)
- **Rate Limit**:
  - `global` = 600 req/60s por IP
  - `auth` = 20 req/10min por IP
  - `sensitiveData` = 30 req/60s por usuário
  - `export` = 10 req/60s por usuário
- Rotas acima da linha `app.use(requireAuth)` em `app.js` são **publicamente acessíveis** (sem auth obrigatório pelo middleware global, mas algumas têm proteções próprias)
- Rotas abaixo da linha `app.use(requireAuth)` exigem auth globalmente

---

## Ordem de montagem em app.js (KI-01 relevante)

```
healthRouter           → sem auth global
authRouter             → sem auth global
labPublicRouter        → sem auth global (usa x-api-key própria)
usersRouter            → sem auth global (KI-01: rotas internas têm requireAuth inline)
─────────────── app.use(requireAuth) + requireCsrfForCookieAuth ───────────────
adminRouter
meRouter
seedAdminRouter
patientsRouter
queueRouter
agendaRouter
referralsRouter
pharmacyRouter
suppliesRouter
examsRouter
medicalRecordsRouter
labNotificationsRouter
tasksRouter
familyGroupsRouter
protocolsRouter
auditLogsRouter
privacyRouter
aiRouter
```

---

## Health & Observabilidade

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/health` | Não | — | Status do sistema; 503 durante startup/shutdown; 200 com `status: "degraded"` em modo degradado |
| GET | `/readyz` | Não | — | Readiness gate do EB; 200 apenas quando `ready=true` E postgres acessível |
| GET | `/metrics/internal` | Não (health.js) | — | Métricas internas de runtime (requests, errors, latência) |
| POST | `/csp-report` | Não | — | Endpoint receptor de violações CSP do browser |

---

## Autenticação (`/auth`)

Todas as rotas usam `authRateLimit` (20/10min).

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| POST | `/auth/access-requests` | Não | — | Criar solicitação de acesso pré-cadastro (usuários ainda não existentes no sistema) |
| POST | `/auth/register` | Não | — | Auto-cadastro público; roles permitidas: `nurse_manager`, `doctor`, `gestor`; valida CRM/CRO externamente |
| POST | `/auth/register/request-code` | Não | — | Retorna 410 (fluxo desativado) |
| POST | `/auth/register/confirm` | Não | — | Retorna 410 (fluxo desativado) |
| POST | `/auth/login` | Não | — | Login; retorna tokens + cookies; se 2FA ativo, retorna `challengeId` sem tokens |
| POST | `/auth/login/verify` | Não | — | Verificação de código TOTP após desafio 2FA; retorna sessão completa |
| POST | `/auth/refresh` | Não | — | Renova access token a partir de refresh token (cookie ou body) |
| POST | `/auth/logout` | Sim | todos | Revoga refresh token e limpa cookies de sessão |
| GET | `/auth/access-requests` | Sim | cap: `access_requests.read` | Lista todas as solicitações de acesso |
| POST | `/auth/access-requests/:id/approve` | Sim | cap: `access_requests.read` | Aprovar solicitação de acesso |
| POST | `/auth/access-requests/:id/reject` | Sim | cap: `access_requests.read` | Rejeitar solicitação com motivo |

---

## Perfil do Usuário Autenticado (`/me`)

Todas as rotas exigem `requireAuth`.

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/me` | Sim | todos | Dados do usuário autenticado com contexto de sessão (impersonation, break-glass) |
| GET | `/me/access-context` | Sim | todos | Contexto de acesso completo da sessão atual |
| GET | `/me/2fa/status` | Sim | todos | Status do 2FA (habilitado, setup pendente) |
| POST | `/me/2fa/setup` | Sim | todos | Inicia configuração TOTP; retorna segredo e URL otpauth |
| POST | `/me/2fa/enable` | Sim | todos | Confirma e ativa 2FA com código TOTP de verificação |
| POST | `/me/2fa/disable` | Sim | todos | Desativa 2FA com código TOTP de confirmação |
| POST | `/me/presence` | Sim | todos | Heartbeat de presença; atualiza `lastSeenAt` |
| PATCH | `/me` | Sim | todos | Atualiza nome, email, senha e dados do conselho; email/senha exigem `currentPassword` |
| POST | `/me/verify-password` | Sim | todos | Verifica senha atual sem alterar nada |
| POST | `/me/impersonation/start` | Sim | cap: `session.impersonate` | Inicia impersonation de outro usuário; bloqueado para roles privilegiadas |
| POST | `/me/impersonation/stop` | Sim | todos (em impersonation) | Encerra impersonation e retorna à sessão própria |
| POST | `/me/break-glass/activate` | Sim | cap: `session.break_glass.activate` | Ativa break-glass (TTL: 15min); eleva capabilities da sessão |
| POST | `/me/break-glass/deactivate` | Sim | todos (com break-glass ativo) | Desativa break-glass e remove capabilities elevadas |

---

## Usuários e Equipes (`/users`, `/teams`)

**Atenção (KI-01):** `usersRouter` montado antes do `requireAuth` global. Todas as rotas abaixo têm `requireAuth` inline como defesa em profundidade.

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/teams/public` | Não | — | Lista pública de equipes (id + name) para formulário de registro |
| GET | `/users` | Sim | todos (cap: `users.read.all` → todos; senão → própria equipe) | Lista usuários; scope limitado ao teamId para roles sem `users.read.all` |
| GET | `/users/activity-log` | Sim | `break_glass_admin` (isAnaAdminUser) | Log de atividade de todos os usuários com status online |
| POST | `/users` | Sim | `requireManager` (nurse_manager) | Cria usuário (somente `acs` ou `doctor`) na equipe do solicitante |
| GET | `/users/:id/usage` | Sim | `requireManager` | Verifica vínculos do usuário antes de excluir |
| PUT | `/users/:id` | Sim | `requireManager` | Atualiza nome, email, senha, dados do conselho de ACS/Médico na própria equipe |
| DELETE | `/users/:id` | Sim | `requireManager` | Remove usuário se não tiver vínculos; requer `reason` (mín. 8 chars) |

---

## Pacientes (`/patients`)

Todas as rotas abaixo do `requireAuth` global. Pacientes retornam com CPF/CNS mascarados (`maskSensitivePatientFields`).

| Método | Caminho | Auth | Rate Limit | Roles | Descrição |
|--------|---------|------|-----------|-------|-----------|
| GET | `/patients` | Sim | sensitiveData | todos com `patients.read.*` | Lista pacientes; ACS vê somente própria microárea; gestor vê todos da unidade |
| GET | `/patients/protocol-summaries` | Sim | — | todos com `patients.read.*` | Resumos de protocolo para múltiplos pacientes por IDs (`?ids=`) |
| POST | `/patients` | Sim | — | `requireManagerOrDoctor` | Cria paciente; valida CPF/CNS únicos por HMAC hash |
| PUT | `/patients/:id` | Sim | — | todos autenticados com acesso ao paciente | Atualiza dados do paciente; ACS restrito a campos permitidos |
| DELETE | `/patients/:id` | Sim | — | `requireManagerOrDoctor` | Inativa paciente (soft-delete); requer `reason` |
| GET | `/patients/:id/appointments` | Sim | — | todos com acesso ao paciente | Lista agendamentos do paciente |
| POST | `/patients/:id/appointments` | Sim | — | todos com `appointments.write` | Cria agendamento |
| DELETE | `/patients/:id/appointments/:appointmentId` | Sim | — | nurse_manager, doctor | Cancela agendamento; requer `reason` |
| GET | `/records/prescriptions` | Sim | — | todos com `records.read` | Lista prescrições da equipe |
| POST | `/patients/:id/records` | Sim | — | roles clínicas (restrições por tipo) | Cria registro clínico; `prescription`/`medical_attest` só doctor/dentist; `visit` ACS permitido |
| DELETE | `/patients/:id/records/:recordId` | Sim | — | nurse_manager, doctor | Soft-delete de registro clínico; CFM proíbe exclusão real |
| PATCH | `/patients/:id/records/:recordId/inactivate` | Sim | — | nurse_manager, doctor | Inativa registro clínico |
| GET | `/patients/:id/history` | Sim | — | todos com acesso ao paciente | Histórico completo do paciente (registros + atendimentos + mensagens) |
| GET | `/patients/:id/protocol-summary` | Sim | — | todos com acesso ao paciente | Resumo de protocolo de saúde do paciente |
| GET | `/patients/:id/messages` | Sim | — | todos com `messages.read` | Lista mensagens internas da equipe sobre o paciente |
| POST | `/patients/:id/messages` | Sim | — | todos com `messages.write` | Cria mensagem interna |
| GET | `/metrics/demand/monthly` | Sim | — | todos autenticados | Métricas de demanda mensal da equipe |
| GET | `/metrics/data-quality` | Sim | — | todos autenticados | Métricas de qualidade de dados dos pacientes |

---

## Exames (`/patients/:id/exams`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/patients/:id/exams` | Sim | todos com `exams.read` | Lista exames do paciente |
| POST | `/patients/:id/exams` | Sim | todos com `exams.write` | Cria solicitação de exame |
| POST | `/patients/:id/exams/:examId/attachments` | Sim | todos com `exams.write` | Adiciona resultado como JSON (sem upload de arquivo binário) |
| DELETE | `/patients/:id/exams/:examId` | Sim | nurse_manager, doctor | Remove exame (soft-delete) |

---

## Agenda (`/agenda`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/agenda` | Sim | cap: `agenda.read` | Lista entradas da agenda da equipe |
| POST | `/agenda` | Sim | cap: `agenda.write` | Cria entrada na agenda |
| PATCH | `/agenda/:id` | Sim | cap: `agenda.write` | Atualiza entrada da agenda |
| DELETE | `/agenda/:id` | Sim | cap: `agenda.write` | Remove entrada da agenda |

---

## Fila de Atendimento (`/queue`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/queue` | Sim | cap: `queue.read` | Lista fila de atendimento da equipe |
| POST | `/queue` | Sim | cap: `queue.write` | Adiciona paciente à fila |
| PATCH | `/queue/:id` | Sim | cap: `queue.write` | Atualiza status/posição na fila |
| DELETE | `/queue/:id` | Sim | cap: `queue.write` | Remove entrada da fila |
| POST | `/queue/clear-done` | Sim | cap: `queue.write` | Limpa todas as entradas com status `done` |

---

## Encaminhamentos (`/referrals`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/referrals` | Sim | cap: `referrals.read` | Lista encaminhamentos da equipe |
| POST | `/referrals` | Sim | cap: `referrals.write` | Cria encaminhamento |
| PATCH | `/referrals/:id` | Sim | cap: `referrals.write` | Atualiza status/dados do encaminhamento |
| DELETE | `/referrals/:id` | Sim | cap: `referrals.write` | Remove encaminhamento |

---

## Farmácia (`/pharmacy`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/pharmacy/stock` | Sim | cap: `pharmacy.read` | Lista estoque de medicamentos |
| GET | `/pharmacy/logs` | Sim | cap: `pharmacy.read` | Log de movimentações de farmácia |
| POST | `/pharmacy/stock` | Sim | cap: `pharmacy.write` | Cadastra item no estoque |
| PATCH | `/pharmacy/stock/:id` | Sim | cap: `pharmacy.write` | Atualiza dados do item |
| POST | `/pharmacy/stock/:id/adjust` | Sim | cap: `pharmacy.write` | Ajuste de estoque (entrada/saída manual) |
| POST | `/pharmacy/dispense` | Sim | cap: `pharmacy.write` | Registra dispensação de medicamento para paciente |

---

## Insumos/Suprimentos (`/supplies`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/supplies/stock` | Sim | cap: `supplies.read` | Lista estoque de insumos |
| GET | `/supplies/logs` | Sim | cap: `supplies.read` | Log de movimentações de insumos |
| GET | `/supplies/continuous` | Sim | cap: `supplies.read` | Lista dispensações contínuas ativas |
| POST | `/supplies/stock/:id/adjust` | Sim | cap: `supplies.write` | Ajuste de estoque de insumo |
| POST | `/supplies/dispense` | Sim | cap: `supplies.write` | Registra dispensação de insumo |
| POST | `/supplies/continuous/:id/close` | Sim | cap: `supplies.write` | Encerra dispensação contínua |

---

## Tarefas Clínicas (`/tasks`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/tasks` | Sim | cap: `tasks.read` | Lista tarefas da equipe |
| POST | `/tasks` | Sim | `requireManagerOrDoctor` | Cria tarefa clínica |
| PATCH | `/tasks/:id` | Sim | cap: `tasks.write` | Atualiza status/dados da tarefa |

---

## Grupos Familiares (`/family-groups`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/family-groups` | Sim | todos autenticados | Lista grupos familiares da equipe |
| PATCH | `/family-groups/:id/members` | Sim | todos com acesso | Adiciona/remove membros do grupo familiar |
| PATCH | `/family-groups/:id/transfer` | Sim | nurse_manager, doctor | Transfere grupo familiar para outro ACS |

---

## Protocolos de Cuidado (`/protocol`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/protocol/templates` | Sim | todos autenticados | Lista templates de protocolo da equipe |
| GET | `/protocol/templates/:category/usage` | Sim | `requireManagerOrDoctor` | Estatísticas de uso do template por categoria |
| GET | `/protocol/templates/:category/history` | Sim | `requireManagerOrDoctor` | Histórico de versões do template |
| POST | `/protocol/templates` | Sim | `requireManagerOrDoctor` | Cria novo template de protocolo |
| PUT | `/protocol/templates/:category` | Sim | `requireManagerOrDoctor` | Atualiza template por categoria |
| DELETE | `/protocol/templates/:category` | Sim | `requireManagerOrDoctor` | Remove template de protocolo |

---

## Prontuários / Acesso a Registros (`/medical-records`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| POST | `/medical-records/access/verify` | Sim | todos autenticados | Verifica acesso a prontuário antes de exibir dados sensíveis |

---

## Integração Laboratorial (`/integrations/lab`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| POST | `/integrations/lab/results` | Não (x-api-key) | — | Recebe resultado de exame do sistema laboratorial externo; autenticado por `LAB_INTEGRATION_API_KEY`; suporte a idempotency-key |
| GET | `/notifications` | Sim | todos autenticados | Lista notificações do usuário (resultados de exames, alertas) |

---

## Logs de Auditoria (`/audit-logs`)

| Método | Caminho | Auth | Rate Limit | Roles | Descrição |
|--------|---------|------|-----------|-------|-----------|
| GET | `/audit-logs` | Sim | — | `requireManagerOrDoctor` | Lista logs de auditoria da equipe com paginação |
| GET | `/audit-logs/export` | Sim | export | `requireManagerOrDoctor` | Exporta logs de auditoria como JSON |
| POST | `/audit-logs/retention/prune` | Sim | — | roles de prune (requer `AUDIT_PRUNE_ENABLED=true`) | Remove logs antigos (mín. 30 dias); salva export forense antes |
| GET | `/audit-logs/integrity` | Sim | — | `security_auditor`, `break_glass_admin` | Verifica integridade da cadeia HMAC dos logs |
| GET | `/audit-logs/reports/cross-team-access` | Sim | export | `security_auditor`, `break_glass_admin` | Relatório de acessos cross-team com identificadores mascarados |
| GET | `/audit-logs/reports/auth-failures` | Sim | export | `security_auditor`, `break_glass_admin` | Relatório de falhas de autenticação; query params: `since`, `until`, `limit` |
| GET | `/audit-logs/reports/rate-limit-abuse` | Sim | export | `security_auditor`, `break_glass_admin` | Relatório de abuso de rate limiting agrupado por prefixo |

---

## Privacidade e LGPD (`/privacy`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/privacy/requests` | Sim | `requireManager` | Lista solicitações LGPD (erasure/access) |
| POST | `/privacy/requests` | Sim | `requireManager` | Cria solicitação LGPD para paciente |
| PATCH | `/privacy/requests/:id` | Sim | `requireManager` | Atualiza status de solicitação LGPD |
| POST | `/privacy/requests/:id/execute` | Sim | `requireManager` | Executa anonimização do paciente (endpoint operacionalmente bloqueado por KI-02) |
| POST | `/privacy/retention/anonymize` | Sim | `requireManager` | Anonimização em lote por período de inatividade |

---

## IA Assistiva (`/ai`)

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/ai/status` | Sim | todos autenticados | Status da integração com provedor de IA |
| POST | `/ai/patients/:id/summary` | Sim | cap: `ai.access` | Resumo clínico do paciente gerado por IA |
| POST | `/ai/patients/:id/protocol-highlights` | Sim | cap: `ai.access` | Destaques de protocolo do paciente via IA |
| POST | `/ai/patients/:id/evolution-draft` | Sim | cap: `ai.access` | Rascunho de evolução clínica gerado por IA |
| POST | `/ai/patients/:id/acs-message` | Sim | cap: `ai.access` | Mensagem para ACS gerada por IA |
| POST | `/ai/patients/:id/suggest-category` | Sim | cap: `ai.access` | Sugestão de categoria de cuidado via IA |
| POST | `/ai/patients/:id/transcribe` | Sim | cap: `ai.access` | Transcrição de nota de voz via IA |
| POST | `/ai/team/priorities` | Sim | cap: `ai.access` | Prioridades da equipe por IA |
| POST | `/ai/team/data-quality` | Sim | cap: `ai.access` | Análise de qualidade de dados da equipe via IA |
| POST | `/ai/team/report` | Sim | cap: `ai.access` | Relatório narrativo da equipe via IA |
| POST | `/ai/chat` | Sim | cap: `ai.access` | Chat livre com IA assistiva |

---

## Admin / Administração (`/admin`)

Todas as rotas exigem `requireAuth` inline (montadas após auth global — S10-03).

| Método | Caminho | Auth | Roles | Descrição |
|--------|---------|------|-------|-----------|
| GET | `/admin/backup/export` | Sim | cap: `backup.export` + header `x-backup-key` | Exporta snapshot completo criptografado do banco; `ENABLE_BACKUP_EXPORT=true` obrigatório |
| GET | `/bootstrap` | Sim | todos autenticados | Dados de bootstrap: usuários, equipes, unidades, permissões |
| GET | `/integrations/council/status` | Sim | todos autenticados | Status da integração com conselho profissional |
| POST | `/admin/patients/reset-populate` | Sim | gestor, break_glass_admin | Repopula dados de demonstração (requer `ENABLE_ADMIN_SEED`) |
| GET | `/metrics/internal` | Sim | cap: `metrics.internal.read` | Métricas detalhadas internas (também exposto em health.js sem auth) |
| POST | `/admin/rebuild-patient-hashes` | Sim | cap: `backup.export` + header `x-backup-key` | Reconstrói hashes HMAC de CPF/CNS de todos os pacientes |
| POST | `/admin/units/bootstrap` | Sim | `break_glass_admin` only | Cria unidade (UBS) e associa gestor; operação atômica |
| POST | `/admin/system/clear-degraded` | Sim | `break_glass_admin`, `security_auditor` | Limpa modo degradado e retorna sistema ao estado `ready` |
| POST | `/admin/run-demo-seed` | Sim | gestor, break_glass_admin | Executa seed de dados de demonstração (requer `x-admin-seed-key` e `ENABLE_ADMIN_SEED`) |

---

## Notas de Segurança

1. **CPF/CNS nunca expostos em claro**: `maskSensitivePatientFields` aplicado em todos os retornos de paciente
2. **Audit log**: toda operação clínica e de segurança gera entrada no log de auditoria com hash HMAC encadeado
3. **Rate limits fail-closed**: Upstash indisponível em produção → 503 (não pass-through)
4. **Cross-tenant**: `canAccessPatient()` aplica `patient.teamId === user.teamId` para ACS; gestores têm acesso à unidade
5. **Registros clínicos soft-delete only**: conforme CFM 1821/2007 — nunca exclusão física
