# VITRAS — Mapa de Páginas Frontend

**Versão:** v1.0-pilot-governed
**Atualizado:** 2026-05-26
**Stack:** React 18 + Vite + `.jsx` (sem TypeScript)
**Estrutura:** SPA com roteamento por tab state em `App.jsx`. Uma única rota `/` com navegação interna por tabs. Exceções: `/activate` e `/primeiro-acesso` (primeiro acesso via token).

---

## Arquitetura de Roteamento

O sistema não usa React Router. Navegação é controlada por `useState("tab")` em `App.jsx`.

### Fluxo de renderização:
1. Se path `/activate` ou `/primeiro-acesso` → renderiza `<ActivateAccountPage />`
2. Se não autenticado → renderiza `<AuthScreen />`
3. Se `role === "receptionist"` (sem privilégios admin) → renderiza `<ReceptionistApp />`
4. Caso contrário → renderiza `<AppShell>` com `<Sidebar>` + `<Topbar>` + `<TabContent>`

### Tabs disponíveis (mapeadas em `<TabContent>`):
`dashboard`, `patients`, `gestor`, `agenda`, `queue`, `referrals`, `pharmacy`, `supplies`, `tasks`, `records`, `reports`, `diagnostics`, `audit`, `ai`, `equipe`

---

## Páginas / Telas

### AuthScreen
**Arquivo:** `frontend-react/src/pages/AuthScreen.jsx`
**Tab/Rota:** Renderizada quando não autenticado (sem tab)
**Roles:** Todos (pré-autenticação)
**Descrição:** Tela de login unificada. Suporta fluxo de 2FA (exibe campo de código TOTP após primeiro fator). Formulário de login com email + senha. Após login bem-sucedido, redireciona baseado na role (`gestor` vai direto para tab `gestor`).
**API calls:**
- `POST /auth/login` — login padrão
- `POST /auth/login/verify` — verificação de código TOTP 2FA
**Funcionalidades:** Login, desafio 2FA, exibição de erros de credencial

---

### ActivateAccountPage
**Arquivo:** `frontend-react/src/pages/ActivateAccountPage.jsx`
**Tab/Rota:** `/activate`, `/primeiro-acesso`
**Roles:** Todos (sem auth — primeiro acesso via token na URL)
**Descrição:** Tela de ativação de conta para novos usuários convidados. Permite definir senha no primeiro acesso.
**API calls:** Depende de token de ativação na URL
**Funcionalidades:** Definição de senha, ativação de conta

---

### Dashboard
**Arquivo:** `frontend-react/src/pages/Dashboard.jsx`
**Tab:** `dashboard`
**Roles:** Todos os usuários autenticados (cap: `dashboard.read`)
**Descrição:** Visão operacional da unidade. Painel principal com KPIs e alertas proativos.
**API calls:** Dados carregados pelo `useBootstrap` no bootstrap inicial
**Funcionalidades:**
- KPIs: total de pacientes, pacientes com ACS atribuído, contagem de ACS e médicos
- Status de protocolos: críticos, atenção, OK (baseado em `protocolByPatient`)
- Alertas proativos (`buildProactiveAlerts`): pacientes com risco, estoque de farmácia baixo
- Métricas de demanda mensal (programada vs. espontânea — meta 50%-70% programada)
- Lista de pacientes críticos (últimos 6)
- Botão de navegação para tab `gestor`

---

### GestorPage
**Arquivo:** `frontend-react/src/pages/GestorPage.jsx`
**Tab:** `gestor`
**Roles:** `gestor` (vai diretamente após login), nurse_manager, break_glass_admin com acesso total
**Descrição:** Painel de gestão gerencial da UBS. Visão estratégica com gráficos e métricas.
**API calls:** Dados via bootstrap (`patients`, `users`, `templates`, `agenda`, `referrals`, `pharmacyStock`)
**Funcionalidades:**
- Gauges SVG de cobertura por protocolo
- Barras de progresso por categoria de cuidado
- Distribuição de pacientes por ACS
- Filtro de busca global de usuários por nome e role
- Overview de encaminhamentos por especialidade e status
- Log de movimentações de farmácia
- Indicadores de qualidade de dados por equipe
- Status de agenda e agendamentos pendentes

---

### PatientsPage
**Arquivo:** `frontend-react/src/pages/PatientsPage.jsx`
**Tab:** `patients`
**Roles:** Todos com `patients.read.*`
**Descrição:** Módulo central de gestão de pacientes. Lista + painel de detalhe do paciente selecionado.
**API calls:**
- `GET /patients` — lista com filtros
- `GET /patients/:id/appointments`, `/records`, `/history`, `/messages`, `/exams`, `/protocol-summary`
- `POST /patients`, `PUT /patients/:id`, `DELETE /patients/:id`
- `POST /patients/:id/records`, `DELETE /patients/:id/records/:id`, `PATCH /patients/:id/records/:id/inactivate`
- `POST /patients/:id/appointments`, `DELETE /patients/:id/appointments/:id`
- `POST /patients/:id/messages`
**Funcionalidades:**
- Busca textual normalizada por nome
- Filtros: categoria de cuidado, ACS, condição crônica (hipertensão/diabetes/ambas)
- `PatientsTable`: lista tabelar com chips de protocolo e alerta
- `PatientDetailPanel`: painel lateral com abas (protocolo, histórico, exames, mensagens, tarefas)
- Criação/edição de paciente em modal
- Registro clínico: formulário inline por tipo (`visit`, `evolution`, `prescription`, `nursing_note`, `vaccine`, `exam_request`, etc.)
- Soft-delete de registros e agendamentos
- Alertas especiais `sortedSpecialAlerts` para Equipe Rosa (paciente gestante, etc.)
- Histórico completo do paciente (`/history`)

---

### PatientsTab
**Arquivo:** `frontend-react/src/pages/PatientsTab.jsx`
**Tab:** `patients` (componente wrapper ou tab alternativa)
**Roles:** Semelhante a PatientsPage
**Descrição:** Wrapper/tab container para a visão de pacientes. Pode ser o componente de tab que renderiza PatientsPage.
**Funcionalidades:** Delegação para PatientsPage com props de contexto

---

### AcsTasksPage
**Arquivo:** `frontend-react/src/pages/AcsTasksPage.jsx`
**Tab:** `tasks`
**Roles:** `acs` (cap: `tasks.read`), nurse_manager, doctor
**Descrição:** Lista de tarefas clínicas da equipe. Foco em tarefas do ACS mas visível para outros roles.
**API calls:**
- `GET /tasks`
- `PATCH /tasks/:id`
**Funcionalidades:**
- Lista de tarefas com status, prioridade e prazo
- Filtro por status e responsável
- Atualização de status inline

---

### AgendaPage
**Arquivo:** `frontend-react/src/pages/AgendaPage.jsx`
**Tab:** `agenda`
**Roles:** Roles com `agenda.read` (nurse_manager, doctor, gestor, nursing_tech, receptionist, break_glass_admin)
**Descrição:** Agenda da equipe com visualização semanal e gestão de compromissos.
**API calls:**
- `GET /agenda`
- `POST /agenda`
- `PATCH /agenda/:id`
- `DELETE /agenda/:id`
**Funcionalidades:**
- Visualização por hora/dia
- Criação de agendamento com tipo, paciente vinculado e data/hora
- Marcação de dias indisponíveis (`isUnavailableDay`)
- Integração com data de gestação (`gestationalAgeInfo`) para pacientes grávidas

---

### QueuePage
**Arquivo:** `frontend-react/src/pages/QueuePage.jsx`
**Tab:** `queue`
**Roles:** `nursing_tech`, `receptionist`, `break_glass_admin` (cap: `queue.read/write`)
**Descrição:** Gerenciamento da fila de atendimento do dia.
**API calls:**
- `GET /queue`
- `POST /queue`
- `PATCH /queue/:id`
- `DELETE /queue/:id`
- `POST /queue/clear-done`
**Funcionalidades:**
- Fila em tempo real com posição e tempo de espera (`formatQueueWait`)
- Inferência de prioridade baseada no perfil do paciente
- Mudança de status (waiting → in_progress → done)
- Limpeza de entradas concluídas

---

### ReferralsPage
**Arquivo:** `frontend-react/src/pages/ReferralsPage.jsx`
**Tab:** `referrals`
**Roles:** Roles com `referrals.read` (nurse_manager, doctor, dentist, gestor, acs, nursing_tech)
**Descrição:** Gestão de encaminhamentos a especialistas.
**API calls:**
- `GET /referrals`
- `POST /referrals`
- `PATCH /referrals/:id`
- `DELETE /referrals/:id`
**Funcionalidades:**
- Lista de encaminhamentos por status (pending, scheduled, completed, cancelled)
- Criação com especialidade, prioridade e justificativa
- Atualização de status do encaminhamento

---

### PharmacyPage
**Arquivo:** `frontend-react/src/pages/PharmacyPage.jsx`
**Tab:** `pharmacy`
**Roles:** Roles com `pharmacy.read` (pharmacist, pharmacy_tech, nurse_manager, doctor, gestor, break_glass_admin)
**Descrição:** Gestão do estoque de medicamentos e dispensação.
**API calls:**
- `GET /pharmacy/stock`
- `GET /pharmacy/logs`
- `POST /pharmacy/stock`
- `PATCH /pharmacy/stock/:id`
- `POST /pharmacy/stock/:id/adjust`
- `POST /pharmacy/dispense`
**Funcionalidades:**
- Estoque atual com alertas de quantidade mínima
- Formulário de cadastro de medicamento
- Ajuste de estoque (entrada/saída)
- Dispensação vinculada a paciente
- Log de movimentações

---

### InsumoPage (Suprimentos)
**Arquivo:** `frontend-react/src/pages/InsumoPage.jsx`
**Tab:** `supplies`
**Roles:** Roles com `supplies.read` (nurse_manager, pharmacist, pharmacy_tech, nursing_tech, gestor, break_glass_admin)
**Descrição:** Gestão de insumos e dispensação contínua.
**API calls:**
- `GET /supplies/stock`
- `GET /supplies/logs`
- `GET /supplies/continuous`
- `POST /supplies/stock/:id/adjust`
- `POST /supplies/dispense`
- `POST /supplies/continuous/:id/close`
**Funcionalidades:**
- Estoque de insumos com alertas
- Dispensação avulsa e contínua
- Encerramento de regime contínuo
- Log de movimentações

---

### RecordsPage
**Arquivo:** `frontend-react/src/pages/RecordsPage.jsx`
**Tab:** `records`
**Roles:** Roles com `records.read`
**Descrição:** Visualização centralizada de registros clínicos da equipe (lista de prescrições).
**API calls:**
- `GET /records/prescriptions`
**Funcionalidades:**
- Lista de prescrições recentes da equipe
- Filtros por tipo, data e prescritor

---

### ReportsPage
**Arquivo:** `frontend-react/src/pages/ReportsPage.jsx`
**Tab:** `reports`
**Roles:** Roles com `reports.read` (nurse_manager, doctor, dentist, gestor, nursing_tech, developer_readonly, support_operator, qa_operator, security_auditor, break_glass_admin)
**Descrição:** Relatórios gerenciais e indicadores da equipe.
**API calls:**
- `GET /metrics/demand/monthly`
- `GET /metrics/data-quality`
**Funcionalidades:**
- Gráficos de demanda mensal (programada vs. espontânea)
- Indicadores de qualidade de dados por categoria
- Métricas de cobertura por protocolo

---

### DiagnosticsPage
**Arquivo:** `frontend-react/src/pages/DiagnosticsPage.jsx`
**Tab:** `diagnostics`
**Roles:** Roles com `diagnostics.read`
**Descrição:** Diagnósticos técnicos do sistema para suporte e desenvolvimento.
**API calls:**
- `GET /health`
- `GET /readyz`
- `GET /metrics/internal`
**Funcionalidades:**
- Status de saúde do sistema
- Métricas internas de performance
- Informações de conectividade com banco

---

### AuditLogPanel
**Arquivo:** `frontend-react/src/pages/AuditLogPanel.jsx`
**Tab:** `audit`
**Roles:** Roles com `audit.read` (nurse_manager, doctor, gestor, security_auditor, break_glass_admin)
**Descrição:** Visualização e exportação de logs de auditoria.
**API calls:**
- `GET /audit-logs`
- `GET /audit-logs/export` (com exportRateLimit)
- `POST /audit-logs/retention/prune`
**Funcionalidades:**
- Lista paginada de eventos de auditoria com labels de ação coloridos
- Filtro por ação, usuário e intervalo de data
- Exportação de logs como JSON
- Expurgo de logs por retenção (requer `AUDIT_PRUNE_ENABLED`)
- Mapeamento de ações para labels legíveis em português

---

### EquipePage
**Arquivo:** `frontend-react/src/pages/EquipePage.jsx`
**Tab:** `equipe`
**Roles:** Roles com gestão de usuários (nurse_manager, gestor, break_glass_admin)
**Descrição:** Gestão de usuários da equipe e templates de protocolo.
**API calls:**
- `GET /users`
- `POST /users`
- `PUT /users/:id`
- `DELETE /users/:id`
- `GET /users/:id/usage`
- `GET /protocol/templates`
- `POST /protocol/templates`
- `PUT /protocol/templates/:category`
- `DELETE /protocol/templates/:category`
**Funcionalidades:**
- Lista de usuários da equipe com status online
- Criação de usuário ACS/Médico (nurse_manager)
- Edição de dados incluindo conselho profissional
- Deleção com verificação de vínculos (`/usage`) e justificativa obrigatória
- Templates de protocolo de cuidado por categoria
- Histórico de versões de templates

---

### AiTab
**Arquivo:** `frontend-react/src/pages/AiTab.jsx`
**Tab:** `ai`
**Roles:** Roles com `ai.access` (nurse_manager, doctor, dentist, break_glass_admin)
**Descrição:** Interface de IA assistiva para análise clínica e suporte à decisão.
**API calls:**
- `GET /ai/status`
- `POST /ai/team/priorities`
- `POST /ai/team/data-quality`
- `POST /ai/team/report`
- `POST /ai/chat`
- `POST /ai/patients/:id/summary` (via PatientDetailPanel)
- `POST /ai/patients/:id/protocol-highlights`
- `POST /ai/patients/:id/evolution-draft`
**Funcionalidades:**
- Cards de ação: Prioridades do dia, Qualidade de dados, Relatório narrativo
- Chat livre com IA assistiva
- Análise de prioridades da equipe
- Detecção de inconsistências de dados
- Geração de relatório textual da equipe

---

### ExamsPage
**Arquivo:** `frontend-react/src/pages/ExamsPage.jsx`
**Tab:** (integrado ao PatientDetailPanel dentro de PatientsPage)
**Roles:** Roles com `exams.read/write`
**Descrição:** Gestão de exames do paciente. Renderizado dentro do painel de detalhe do paciente.
**API calls:**
- `GET /patients/:id/exams`
- `POST /patients/:id/exams`
- `POST /patients/:id/exams/:examId/attachments`
- `DELETE /patients/:id/exams/:examId`
**Funcionalidades:**
- Lista de exames por status (requested, collected, result_available)
- Criação de solicitação de exame
- Adição de resultado como anexo JSON
- Notificações de resultados do laboratório

---

### ChartPage (Histórico Gráfico)
**Arquivo:** `frontend-react/src/pages/ChartPage.jsx`
**Tab:** `chart` (sub-tab dentro de PatientsPage, aba `history`)
**Roles:** Roles com `records.read` e acesso ao paciente
**Descrição:** Visualização gráfica do histórico clínico do paciente (evolução temporal).
**API calls:**
- `GET /patients/:id/history`
**Funcionalidades:**
- Timeline de registros clínicos
- Gráficos de evolução de condições crônicas
- Histórico de atendimentos e procedimentos

---

### AccessRequestsPage
**Arquivo:** `frontend-react/src/pages/AccessRequestsPage.jsx`
**Tab:** (integrado em alguma tab admin/gestor)
**Roles:** Roles com `access_requests.read` (gestor, break_glass_admin)
**Descrição:** Gerenciamento de solicitações de acesso de novos usuários.
**API calls:**
- `GET /auth/access-requests`
- `POST /auth/access-requests/:id/approve`
- `POST /auth/access-requests/:id/reject`
**Funcionalidades:**
- Lista de solicitações pendentes/decididas
- Aprovação/rejeição com motivo

---

### ReceptionistApp
**Arquivo:** `frontend-react/src/pages/ReceptionistApp.jsx`
**Tab/Rota:** App completo dedicado (substitui AppShell para role `receptionist`)
**Roles:** `receptionist` exclusivamente
**Descrição:** Aplicação simplificada de recepção. Interface focada em fila de atendimento e agenda. UI independente do shell principal.
**API calls:**
- `POST /auth/login` (login próprio via modal dentro do app)
- `GET /queue`, `POST /queue`, `PATCH /queue/:id`, `POST /queue/clear-done`
- `GET /agenda`
**Funcionalidades:**
- Modal de login interno (sem depender do AuthScreen principal)
- Fila de atendimento em tempo real com relógio e tempo de espera
- Agenda simplificada com horários
- Busca de pacientes por nome
- Inferência automática de prioridade por perfil do paciente
- Interface otimizada para tela de recepção (sem sidebar clínica)

---

### EsusMirror
**Arquivo:** `frontend-react/src/pages/EsusMirror.jsx`
**Tab:** (integrado em alguma tab clínica)
**Roles:** Roles clínicas
**Descrição:** Espelho/referência de dados no padrão e-SUS (sistema federal de saúde). Usado para conferência de dados e integração com RNDS.
**API calls:** Leitura local de dados do paciente
**Funcionalidades:** Visualização de dados no formato e-SUS para exportação/conferência

---

### VaccinesPage
**Arquivo:** `frontend-react/src/pages/VaccinesPage.jsx`
**Tab:** (integrado ao PatientDetailPanel ou tab separada)
**Roles:** Roles com `records.write`
**Descrição:** Gerenciamento do cartão de vacinação do paciente.
**API calls:**
- `POST /patients/:id/records` (type: `vaccine`)
**Funcionalidades:**
- Calendário vacinal
- Registro de vacinas aplicadas
- Alertas de vacinas em atraso

---

### TriagePage
**Arquivo:** `frontend-react/src/pages/TriagePage.jsx`
**Tab:** (integrado ao fluxo de atendimento)
**Roles:** `nursing_tech`, nurse_manager
**Descrição:** Triagem de pacientes na chegada — registro de sinais vitais e classificação de risco.
**API calls:**
- `POST /patients/:id/records` (type: `nursing_note` ou `visit`)
**Funcionalidades:**
- Formulário de sinais vitais (PA, FC, temperatura, glicemia)
- Classificação de risco (Manchester ou similar)
- Vinculação ao paciente na fila

---

## Modais Globais (AppModals)

Renderizados por `<AppModals>` em `App.jsx`. Controlados por estado local.

| Modal | Trigger | Componente | Descrição |
|-------|---------|-----------|-----------|
| PatientModal | `openEditPatient()`, `openViewPatient()` | `PatientFormModal` | Criação/edição de paciente com lookup de CEP |
| UserModal | `openEditUser()` | `UserFormModal` | Criação/edição de usuário (nurse_manager) |
| TemplateModal | `openEditTemplate()` | `TemplateFormModal` | Criação/edição de template de protocolo |
| ProfileModal | `openProfile()` | `ProfileModal` | Edição do perfil próprio (nome, email, senha, conselho, 2FA) |
| SecureAccessModal | `openSecureAccess()` | `SecureAccessModal` | Impersonation e break-glass activation |
| DeleteUserConfirm | `confirmUserDelete()` | Modal de confirmação | Confirmação de exclusão com justificativa |
| DeleteTemplateConfirm | `confirmTemplateDelete()` | Modal de confirmação | Confirmação de exclusão de template |
| SessionTimeoutModal | idle timeout | `SessionTimeoutModal` | Aviso de expiração de sessão por inatividade |

---

## Componentes de Feedback Globais

| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `AppErrorBoundary` | `components/feedback/AppErrorBoundary.jsx` | Captura erros React e exibe fallback |
| `OfflineBanner` | `components/feedback/OfflineBanner.jsx` | Banner de aviso quando sem conexão |
| `ComplianceBadge` | `components/feedback/ComplianceBadge.jsx` | Badge LGPD/conformidade visível na interface |
| `SessionTimeoutModal` | `components/feedback/SessionTimeoutModal.jsx` | Modal de aviso de timeout por inatividade |

---

## Hooks Principais

| Hook | Arquivo | Dados que carrega / ações que expõe |
|------|---------|-------------------------------------|
| `useAuth` | `hooks/useAuth.js` | token, user, login, logout, refresh, persistCookieSession |
| `useBootstrap` | `hooks/useBootstrap.js` | patients, users, templates, protocolByPatient, allUsers, publicTeams, demandMonthly, appointments, tasks, messages, history |
| `usePatientModal` | `hooks/usePatientModal.js` | CRUD de paciente, lookup de CEP, form state |
| `usePatientActivity` | `hooks/usePatientActivity.js` | CRUD de records, appointments, tasks, messages |
| `useUserTemplateHandlers` | `hooks/useUserTemplateHandlers.js` | CRUD de usuários e templates |
| `useAgenda` | `hooks/useAgenda.js` | entries da agenda, CRUD |
| `usePharmacy` | `hooks/usePharmacy.js` | stock, log de farmácia, CRUD |
| `useReferrals` | `hooks/useReferrals.js` | entries de encaminhamentos, CRUD |
| `useSupplies` | `hooks/useSupplies.js` | stock, log, continuous de insumos |
| `useQueue` | `hooks/useQueue.js` | fila de atendimento |
| `useSecureAccess` | `hooks/useSecureAccess.js` | impersonation start/stop, break-glass activate/deactivate |
| `useProfile` | `hooks/useProfile.js` | edição do perfil próprio |
| `useAiHandlers` | `hooks/useAiHandlers.js` | todas as chamadas de IA |
| `useApiHealth` | `hooks/useApiHealth.js` | status de saúde da API (`/health`) |
| `usePatientAlerts` | `hooks/usePatientAlerts.js` | alertas especiais para Equipe Rosa |
| `useIdleTimeout` | `hooks/useIdleTimeout.js` | logout automático por inatividade (VITE_IDLE_LOGOUT_ENABLED) |

---

## Variáveis de Ambiente Frontend (Vite)

| Variável | Descrição |
|----------|-----------|
| `VITE_IDLE_LOGOUT_ENABLED` | `"false"` desabilita logout por inatividade (padrão: habilitado) |
| `VITE_API_BASE_URL` | URL base da API (para proxy Vite em dev ou override em produção) |
