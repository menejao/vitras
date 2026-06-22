# VITRAS APS — Mapa de Navegação

**Versão:** 1.0  
**Atualizado:** 2026-06-22

---

## Fluxo de Entrada (Auth)

```
[Acessar URL]
    │
    ├─ pathname = /activate ou /primeiro-acesso
    │       └─► ActivateAccountPage (DEPRECATED — redireciona para Login)
    │
    ├─ pathname = /privacidade
    │       └─► Redirect externo: vitras.com.br/privacidade
    │
    ├─ Sem sessão (token/user ausente)
    │       └─► AuthScreen (Login)
    │               ├─► Aba "Entrar" → login
    │               ├─► Aba "Redefinir senha" → reset password flow
    │               └─► Aba "Solicitar acesso" → access request
    │
    ├─ Sessão + forcePasswordChange: true
    │       └─► ChangePasswordRequiredPage
    │               ├─► Sucesso → App (perfil do usuário)
    │               └─► "Sair" → AuthScreen
    │
    ├─ Sessão + role = support_admin
    │       └─► PlatformConsolePage
    │
    ├─ Sessão + role = receptionist
    │       └─► ReceptionistApp
    │
    └─ Sessão + demais perfis
            └─► App Principal (TabContent)
```

---

## Fluxo Platform (support_admin)

```
PlatformConsolePage
    │
    ├─ NationalSummary (cards de resumo)
    │
    ├─ Clicar "+ Nova UBS"
    │       └─► UnitForm (subview)
    │               ├─► Sucesso → Lista de UBS (recarregada)
    │               └─► "← Voltar" → Lista de UBS
    │
    └─ Clicar linha de UBS
            └─► UnitDetail (subview)
                    │
                    ├─ "Fazer agora" (sem gestor)
                    │       └─► subview new-manager
                    │               ├─► Sucesso → UnitDetail (recarregado)
                    │               └─► "← Voltar" → UnitDetail
                    │
                    ├─ "Fazer agora" (sem equipe)
                    │       └─► subview new-team
                    │               ├─► Sucesso → UnitDetail (recarregado)
                    │               └─► "← Voltar" → UnitDetail
                    │
                    ├─ Status = homologation → seção Checklist
                    │       ├─► Marcar/desmarcar itens → PATCH API
                    │       └─► "Ativar UBS" (todos OK) → UBS ativa
                    │
                    └─► "← Voltar" → Lista de UBS
```

---

## Fluxo App Principal (Tabs)

```
App Principal
    │
    ├─── tab = dashboard ──► Dashboard
    │           ├─► Botão "Abrir gestão à vista" → tab = gestor
    │           ├─► Botão "Ir para pacientes" → tab = patients
    │           └─► Clicar paciente em alerta → tab = patients + selectedPatientId
    │
    ├─── tab = patients ──► PatientsPage
    │           ├─► Clicar paciente → PatientDetailPanel (painel lateral/baixo)
    │           ├─► Botão "Novo Paciente" → PatientModal (criar)
    │           ├─► Ícone editar → PatientModal (editar)
    │           └─► Ícone visualizar → PatientModal (visualizar)
    │
    ├─── tab = chart ──► RecordsPage (Prontuário)
    │           └─► Requer selectedPatientId
    │
    ├─── tab = queue ──► QueuePage
    │
    ├─── tab = triage ──► TriagePage
    │
    ├─── tab = agenda ──► AgendaPage
    │           └─► Requer capabilities: agenda.read ou agenda.write
    │
    ├─── tab = referrals ──► ReferralsPage
    │           └─► Requer capabilities: referrals.read ou referrals.write
    │
    ├─── tab = acs_tasks ──► AcsTasksPage
    │           └─► Clicar paciente → tab = patients + selectedPatientId
    │
    ├─── tab = exams_page ──► ExamsPage
    │
    ├─── tab = gestor ──► GestorPage
    │           └─► Acesso automático no login para role = gestor
    │
    ├─── tab = access_requests ──► AccessRequestsPage
    │           └─► Requer: admin, gestor ou access_requests.read
    │
    ├─── tab = audit_log ──► AuditLogPanel
    │           └─► Requer: audit.read ou isAdmin
    │
    ├─── tab = reports ──► ReportsPage
    │
    ├─── tab = diagnostics ──► DiagnosticsPage
    │
    ├─── tab = protocols ──► ProtocolsTab
    │           └─► Requer: canManageUser
    │
    ├─── tab = equipe ──► EquipePage
    │
    ├─── tab = vaccines ──► VaccinesPage
    │
    ├─── tab = pharmacy ──► PharmacyPage
    │           └─► Requer: pharmacy.read ou pharmacy.write
    │
    ├─── tab = insumos ──► InsumoPage
    │           └─► Requer: supplies.read ou supplies.write
    │
    └─── tab = ai ──► AiTab
```

---

## Fluxo App Recepção (ReceptionistApp)

```
ReceptionistApp
    │
    ├─── tab = queue ──► Fila de Atendimento
    │           ├─► Selecionar paciente → painel lateral
    │           └─► Adicionar à fila
    │
    └─── tab = agenda ──► Agenda da Recepção
                ├─► Selecionar data
                ├─► Novo agendamento → AgendaForm
                └─► Editar agendamento → AgendaForm
```

---

## Fluxo de Modais Globais

```
Topbar
    ├─► "Meu perfil" → ProfileModal
    │           └─► Salvar → fecha modal
    │
    ├─► "Acesso Seguro" → SecureAccessModal (impersonação)
    │           ├─► Confirmar → sessão troca para usuário alvo
    │           └─► Cancelar → fecha modal
    │
    └─► "Break Glass" → SecureAccessModal (break-glass)
                ├─► Confirmar → sessão com acesso elevado
                └─► Cancelar → fecha modal

GestorPage / EquipePage
    └─► Abrir usuário → UserModal
                └─► Salvar → lista atualizada

ProtocolsTab
    └─► Abrir template → TemplateModal
                └─► Salvar → lista atualizada

[Idle 5min]
    └─► SessionTimeoutModal
                ├─► "Continuar" → sessão mantida
                └─► "Sair" → logout
```

---

## Tabela de parâmetros de navegação

| Origem | Destino | Parâmetro | Tipo | Obrigatório |
|---|---|---|---|---|
| Dashboard | tab=patients | `selectedPatientId` | string (ID) | Não |
| AcsTasksPage | tab=patients | `selectedPatientId` | string (ID) | Não |
| Topbar search | tab=patients | `selectedPatientId` | string (ID) | Não |
| PlatformConsolePage (lista) | UnitDetail | `unitId` | string (ID) | Sim |
| UnitDetail | subview new-manager | — | — | — |
| UnitDetail | subview new-team | — | — | — |
| Login | App | JWT token + user | objeto | Sim |

---

## Dependências de pré-condição

| Página | Pré-condição obrigatória |
|---|---|
| RecordsPage (chart) | `selectedPatientId` preenchido |
| AgendaPage | capability `agenda.read` ou `agenda.write` + `teamId` |
| ReferralsPage | capability `referrals.read` ou `referrals.write` + `teamId` |
| PharmacyPage | capability `pharmacy.read` ou `pharmacy.write` + `teamId` |
| InsumoPage | capability `supplies.read` ou `supplies.write` + `teamId` |
| AuditLogPanel | capability `audit.read` ou isAdmin |
| AccessRequestsPage | isAdmin, isGestor, ou capability `access_requests.read` |
| ProtocolsTab | `canManageUser` |
| UnitDetail → checklist | UBS em status `homologation` |
| UnitDetail → "Ativar UBS" | `checklist.ok === true` |
