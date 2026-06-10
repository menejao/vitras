# VITRAS — Matriz RBAC (Roles × Capabilities)

**Versão:** v1.0-pilot-governed
**Atualizado:** 2026-05-26
**Fonte:** `backend/src/utils/helpers.js` (ROLE_CAPABILITIES), `backend/src/routes/*.js`

---

## Símbolos

| Símbolo | Significado |
|---------|-------------|
| ✓ | Permitido (capability presente na role) |
| ✗ | Negado (capability ausente) |
| ⚠ | Permitido com restrição de escopo ou condição |
| ∅ | Não aplicável para esta role |

---

## Roles Disponíveis

| Role | Tipo | Descrição |
|------|------|-----------|
| `nurse_manager` | Clínica | Enfermeira chefe de equipe — principal usuária operacional da UBS |
| `doctor` | Clínica | Médico da equipe ESF |
| `dentist` | Clínica | Dentista da equipe |
| `gestor` | Administrativa | Gestor da UBS — visão gerencial, sem escrita clínica |
| `acs` | Clínica/Campo | Agente Comunitário de Saúde |
| `nursing_tech` | Clínica | Técnico de enfermagem |
| `pharmacist` | Clínica | Farmacêutico |
| `pharmacy_tech` | Clínica | Técnico de farmácia |
| `receptionist` | Operacional | Recepcionista |
| `developer_readonly` | Suporte | Desenvolvedor com acesso somente-leitura |
| `support_operator` | Suporte | Operador de suporte |
| `qa_operator` | Suporte | Operador de QA |
| `security_auditor` | Governança | Auditor de segurança — acesso a logs e integridade |
| `break_glass_admin` | Emergência | Administrador de emergência — acesso total temporário |

---

## Matriz de Capabilities

### Grupo: Dashboard e Visão Geral

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `dashboard.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

### Grupo: Pacientes

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `patients.read.all` | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `patients.read.scoped` | ∅ | ∅ | ∅ | ∅ | ✓ | ∅ | ∅ | ∅ | ✓ | ✓ | ✓ | ✓ | ✓ | ∅ |
| `patients.write` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

**Notas:**
- `patients.read.all` = vê todos os pacientes da equipe (roles com esta capability ignoram filtro de microárea)
- `patients.read.scoped` = somente pacientes da própria microárea/atribuição (ACS) ou escopo reduzido
- ACS: acesso apenas a pacientes com `assignedAcsId === user.id` ou mesma microárea
- `gestor`: lê todos os pacientes da unidade mas não escreve (sem `patients.write`)
- `break_glass_admin`: acesso total durante sessão com break-glass ativo (TTL 15min)

---

### Grupo: Registros Clínicos

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `records.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `records.write` | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

**Restrições por tipo de registro (além da capability):**
- `prescription` e `medical_attest`: somente `doctor` ou `dentist` (CLINICAL_PRESCRIBER_ROLES)
- `visit`: permitido para ACS
- Todos os deletes são soft-delete (status = inactive) — nunca exclusão física (CFM 1821/2007)

---

### Grupo: Exames

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `exams.read` | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `exams.write` | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

### Grupo: Agendamentos

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `appointments.write` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

### Grupo: Agenda

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `agenda.read` | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `agenda.write` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

### Grupo: Encaminhamentos

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `referrals.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `referrals.write` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

### Grupo: Fila de Atendimento

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `queue.read` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `queue.write` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

### Grupo: Tarefas e Mensagens

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `tasks.read` | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `tasks.write` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `messages.read` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `messages.write` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

### Grupo: Farmácia e Insumos

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `pharmacy.read` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `pharmacy.write` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `supplies.read` | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `supplies.write` | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

### Grupo: Protocolos e Relatórios

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `protocols.manage` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `reports.read` | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `diagnostics.read` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

### Grupo: Gestão de Usuários

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `users.read.scoped` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `users.read.all` | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `users.manage.scoped` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `users.manage.all` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `users.activity_log.read` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `team.manage` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

**Notas:**
- `users.read.scoped`: lê usuários da própria equipe
- `users.read.all`: lê usuários de todas as equipes da unidade
- `users.manage.scoped`: cria/edita/deleta ACS e Médico na própria equipe (nurse_manager)
- `users.manage.all`: gestão total — break_glass_admin em modo elevado
- Regra de gestão por nurse_manager: só pode gerenciar roles `acs` e `doctor`

---

### Grupo: Auditoria e Privacidade

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `audit.read` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `privacy.manage` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `access_requests.read` | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

**Notas:**
- `audit.read`: acesso ao log de auditoria da equipe via `/audit-logs`
- Relatórios avançados (`/audit-logs/reports/*`) e verificação de integridade: apenas `security_auditor` e `break_glass_admin` (verificado diretamente no código, não por capability)
- `privacy.manage`: gestão de solicitações LGPD e anonimização (endpoint de execução bloqueado operacionalmente — KI-02)

---

### Grupo: Admin e Infraestrutura

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `backup.export` | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `admin.seed` | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `metrics.internal.read` | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

---

### Grupo: IA

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `ai.access` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

### Grupo: Sessão e Acesso Elevado

| Capability | nurse_mgr | doctor | dentist | gestor | acs | nursing_tech | pharmacist | pharmacy_tech | receptionist | dev_ro | support | qa | sec_audit | break_glass |
|------------|-----------|--------|---------|--------|-----|-------------|-----------|--------------|-------------|--------|---------|----|-----------| ------------|
| `session.impersonate` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `session.break_glass.activate` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

**Notas:**
- `session.impersonate`: permite assumir contexto de outro usuário para suporte/debug
- Impersonation bloqueada para roles: `break_glass_admin`, `gestor`, `nurse_manager`, `security_auditor`
- `session.break_glass.activate`: apenas `break_glass_admin` — eleva capabilities por 15 minutos
- Break-glass eleva capabilities com: `patients.read.all`, `patients.write`, `records.*`, `tasks.*`, `messages.*`, `protocols.manage`, `reports.read`, `diagnostics.read`, `users.read.all`, `users.manage.all`, `audit.read`, `privacy.manage`, `team.manage`, `ai.access`

---

## Regras de Auto-Cadastro

Apenas três roles podem fazer auto-registro público via `/auth/register`:

| Role | Conselho obrigatório | Validação externa |
|------|---------------------|-------------------|
| `nurse_manager` | COREN | Sim |
| `doctor` | CRM | Sim |
| `gestor` | N/A | Não |

---

## Controles por Roles no Código (além de capabilities)

### `requireManager` (nurses.js)
Função `requireManager` em `middlewares/auth.js` — verifica `role === "nurse_manager"`. Usada para:
- Criar, editar, excluir usuários ACS/Médico na própria equipe
- Ver usage de usuário antes de excluir

### `requireManagerOrDoctor` (patients.js)
Função composta — verifica `isManager(user) || isDoctor(user)`. Usada para:
- Criar e inativar pacientes
- Cancelar agendamentos
- Criar tarefas
- Deletar registros (soft-delete)

### `requireRoles(["break_glass_admin"])` (admin.js)
Bootstrap de unidade — exclusivo para `break_glass_admin`.

### `requireRoles(["break_glass_admin", "security_auditor"])` (admin.js)
Limpar modo degradado.

### `isAnaAdminUser` (users.js)
Verificação especial para `/users/activity-log` — somente `break_glass_admin`.

---

## Isolamento Multi-Tenant

| Regra | Implementação |
|-------|---------------|
| ACS vê somente pacientes da própria equipe/microárea | `getAllowedPatients()` com `canAccessAllPatients()` retornando false para ACS |
| Gestor vê todos pacientes da unidade | `patients.read.all` + escopo por `unitId` |
| Nurse_manager gerencia somente usuários da própria equipe | `teamId === req.user.teamId` no filtro de `PUT/DELETE /users/:id` |
| Acesso cross-team a paciente | Permitido com elevação (break-glass ou manager/doctor) mas registra `cross_team_patient_access` no audit |
| Dados de farmácia/insumos | Filtrados por `teamId` da equipe autenticada |

---

## Limitações por Role (Negações Explícitas)

| Role | Não pode |
|------|---------|
| `gestor` | Criar/editar registros clínicos; escrever em agenda; usar IA; criar tarefas |
| `acs` | Criar prescrições ou atestados; acessar farmácia; ver mensagens internas; gerenciar usuários |
| `dentist` | Acessar farmácia; ver tarefas/mensagens; usar agenda; gerir usuários |
| `nursing_tech` | Criar registros clínicos; acessar farmácia; gerenciar usuários |
| `pharmacist` / `pharmacy_tech` | Acessar pacientes ou registros clínicos; qualquer operação clínica |
| `receptionist` | Qualquer operação clínica; farmácia; gerenciamento de usuários |
| `developer_readonly` / `support_operator` / `qa_operator` | Qualquer escrita; sem acesso a dados clínicos em produção |
| `security_auditor` | Escrita de qualquer tipo exceto limpar modo degradado; não pode acessar dados de pacientes sem impersonation |
