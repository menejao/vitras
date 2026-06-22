# Modal de Perfil — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/components/modals/ProfileModal.jsx`  
**Acionado por:** Topbar → "Meu perfil"

---

## 1. Objetivo e contexto

Permite ao usuário editar seus próprios dados de perfil: nome de exibição, telefone, e-mail, número de conselho profissional. Não permite alterar role ou unitId. Não é o fluxo de troca de senha (que é `/auth/change-password-required`).

**Usuários:** Todos os perfis autenticados.

---

## 2. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/me` | Carregar dados atuais |
| PATCH | `/me` | Salvar alterações de perfil |

Hook: `useProfile({ token, user, setUser, persistCookieSession })`

---

## 3. Campos do formulário

| Campo | Nome técnico | Editável | LGPD |
|---|---|---|---|
| Nome | `name` | Sim | PD |
| E-mail | `email` | Sim | PD |
| Telefone | `phone` | Sim | PD |
| Número conselho | `councilNumber` | Sim | — |
| Tipo conselho | `councilType` | Sim | — |
| UF conselho | `councilUf` | Sim | — |
| CBO | `cbo` | Sim | — |
| Role | — | Não (somente exibição) | — |
| UBS | — | Não | — |

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-MPF-01 | Salvar | Sempre | `PATCH /me` → atualiza cookie/token se necessário |
| RN-MPF-02 | Cookie session | Modo cookie ativo | `persistCookieSession()` após salvar |

---

## 5. Auditoria

| Ação | Evento |
|---|---|
| Editar perfil | `me.write` (implícito) |

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
