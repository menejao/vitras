# VITRAS APS — Catálogo de Rotas

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Fonte:** `frontend-react/src/App.jsx` + `frontend-react/src/components/TabContent.jsx`

---

## Tipo 1 — Rotas URL (pathname-based)

O VITRAS APS usa roteamento por `window.location.pathname` em `App.jsx`, não React Router.

| Rota | Página | Módulo | Autenticação | Perfis permitidos | Componente |
|---|---|---|---|---|---|
| `/activate` | Ativar Conta | IAM | Não | Público | `ActivateAccountPage` |
| `/primeiro-acesso` | Ativar Conta | IAM | Não | Público | `ActivateAccountPage` |
| `/privacidade` | Privacidade | Legal | Não | Público | Redirect → vitras.com.br/privacidade |
| `/` (sem auth) | Login | Auth | Não | Público | `AuthScreen` |
| `/` (forcePasswordChange) | Troca Obrigatória | IAM | Sim | Todos | `ChangePasswordRequiredPage` |
| `/platform` | Console Nacional | Platform | Sim | `support_admin` | `PlatformConsolePage` |
| `/` (receptionist) | App Recepção | Reception | Sim | `receptionist` | `ReceptionistApp` |
| `/` (demais perfis) | App Principal | Core | Sim | Todos exceto acima | `App` + `TabContent` |

---

## Tipo 2 — Rotas por Tab (estado interno)

Dentro do App Principal, a navegação é por tab (estado `tab` em `App.jsx`). Não muda URL.

| Tab ID | Página | Módulo | Capabilities necessárias | Componente |
|---|---|---|---|---|
| `dashboard` | Dashboard | Core | nenhuma específica | `Dashboard` |
| `patients` | Lista de Pacientes | Clínico | nenhuma específica | `PatientsPage` |
| `chart` | Prontuário / Registros | Clínico | nenhuma específica | `RecordsPage` |
| `queue` | Fila de Atendimento | Reception | nenhuma específica | `QueuePage` |
| `triage` | Triagem | Clínico | nenhuma específica | `TriagePage` |
| `agenda` | Agenda | Agenda | `agenda.read` ou `agenda.write` | `AgendaPage` |
| `referrals` | Encaminhamentos | Clínico | `referrals.read` ou `referrals.write` | `ReferralsPage` |
| `acs_tasks` | Workspace ACS | ACS | nenhuma específica | `AcsTasksPage` |
| `exams_page` | Exames | Clínico | nenhuma específica | `ExamsPage` |
| `gestor` | Painel Gestor | Gestão | nenhuma específica | `GestorPage` |
| `access_requests` | Solicitações de Acesso | IAM | `access_requests.read` ou admin/gestor | `AccessRequestsPage` |
| `audit_log` | Auditoria | Segurança | `audit.read` ou admin | `AuditLogPanel` |
| `reports` | Relatórios | Gestão | nenhuma específica | `ReportsPage` |
| `diagnostics` | Diagnóstico do Sistema | Técnico | nenhuma específica | `DiagnosticsPage` |
| `protocols` | Protocolos | Gestão | `canManageUser` | `ProtocolsTab` |
| `equipe` | Equipe | Gestão | nenhuma específica | `EquipePage` |
| `vaccines` | Vacinas | Clínico | nenhuma específica | `VaccinesPage` |
| `pharmacy` | Farmácia | Farmácia | `pharmacy.read` ou `pharmacy.write` | `PharmacyPage` |
| `insumos` | Suprimentos / Insumos | Farmácia | `supplies.read` ou `supplies.write` | `InsumoPage` |
| `ai` | IA — Análise | IA | nenhuma específica | `AiTab` |

---

## Tipo 3 — Subviews (estado interno aninhado)

Dentro de páginas específicas, há subviews navegadas por estado local (não tab).

### PlatformConsolePage

| View | Nome | Acionador |
|---|---|---|
| `list` (padrão) | Lista de UBS | Padrão ao abrir `/platform` |
| `new-unit` | Formulário Nova UBS | Botão "+ Nova UBS" |
| `detail` | Detalhe da UBS | Clicar linha na lista |
| `new-team` | Formulário Nova Equipe | "Fazer agora" / "+ Cadastrar equipe" dentro do detalhe |
| `new-manager` | Formulário Novo Gestor | "Fazer agora" dentro do detalhe |

### PatientsPage

| View | Nome | Acionador |
|---|---|---|
| Lista | Lista de Pacientes | Padrão |
| Detalhe | Painel de Detalhe do Paciente | Clicar paciente na lista |

### ReceptionistApp

| Tab | Nome |
|---|---|
| `queue` | Fila de Atendimento |
| `agenda` | Agenda |

---

## Tipo 4 — Modais globais

Modais gerenciados por `AppModals` em `App.jsx`.

| Modal | Acionador | Página(s) que abre |
|---|---|---|
| PatientModal (criar) | Botão "Novo Paciente" | Dashboard, PatientsPage, AgendaPage, QueuePage |
| PatientModal (editar) | `openEditPatient(patient)` | PatientsPage |
| PatientModal (visualizar) | `openViewPatient(patient)` | PatientsPage, outros |
| UserModal | `openEditUser(user)` | GestorPage, EquipePage |
| TemplateModal | `openEditTemplate(template)` | ProtocolsTab |
| ProfileModal | "Meu perfil" na Topbar | Global |
| SecureAccessModal (impersonação) | "Acesso Seguro" na Topbar | Global |
| SecureAccessModal (break-glass) | "Break Glass" na Topbar | Global |
| SessionTimeoutModal | Idle timeout (5 min padrão) | Global |
| DeleteUserModal | Excluir usuário | GestorPage |
| DeleteTemplateModal | Excluir template | ProtocolsTab |

---

## Resumo quantitativo

| Tipo | Quantidade |
|---|---|
| Rotas URL | 8 |
| Tabs (App Principal) | 20 |
| Tabs (ReceptionistApp) | 2 |
| Subviews (Platform) | 5 |
| Subviews (Patients) | 2 |
| Modais globais | 11 |
| **Total de superfícies funcionais** | **48** |
