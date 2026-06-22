# Modal de Usuário — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/components/modals/UserModal.jsx`  
**Acionado por:** `AppModals` → `showUserModal`

---

## 1. Objetivo e contexto

Modal de criação e edição de usuários da UBS. Gerenciado pelo gestor local. Diferente do fluxo de support_admin (que cria usuários via `/platform/units/:id/initial-manager`), este modal é para criação de usuários clínicos pela gestão local.

---

## 2. Acionadores

| Ação | Local |
|---|---|
| Criar usuário | GestorPage, EquipePage |
| Editar usuário | GestorPage, EquipePage |

---

## 3. Campos do formulário

| Campo | Nome técnico | Tipo | Obrig | LGPD |
|---|---|---|---|---|
| Nome completo | `name` | text | S | PD |
| E-mail | `email` | email | S | PD |
| Cargo/Perfil | `role` | select | S | — |
| CPF | `cpf` | text (onlyDigits) | N | PD |
| Telefone | `phone` | text | N | PD |
| Número do conselho | `councilNumber` | text | N | — |
| Tipo do conselho | `councilType` | text | N | — |
| UF do conselho | `councilUf` | select | N | — |
| CBO | `cbo` | text | N | — |

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-MUS-01 | Criar usuário | E-mail duplicado | API retorna erro |
| RN-MUS-02 | Criar usuário | Role = gestor | Visível somente para admins |
| RN-MUS-03 | CPF | Input | `onlyDigits()` — remove não-numéricos |
| RN-MUS-04 | Salvar | Nome ou e-mail vazio | Bloqueado |

---

## 5. Auditoria

| Ação | Evento |
|---|---|
| Criar usuário | `USUARIO_CADASTRADO` |
| Editar usuário | `USUARIO_EDITADO` |

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
