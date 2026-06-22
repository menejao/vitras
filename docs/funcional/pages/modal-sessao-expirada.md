# Modal de Sessão Expirada — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/components/feedback/SessionTimeoutModal.jsx`  
**Acionado por:** `useIdleTimeout` → `showWarning === true`

---

## 1. Objetivo e contexto

Modal de aviso de sessão prestes a expirar por inatividade. Aparece automaticamente quando o usuário fica inativo por período pré-configurado (padrão: 5 minutos). Permite estender a sessão ou encerrar com logout.

**Usuários:** Todos os perfis autenticados.

**Configuração:** `VITE_IDLE_LOGOUT_ENABLED !== "false"` — pode ser desabilitado via variável de ambiente.

---

## 2. Elementos do modal

- Título: "Sua sessão está prestes a expirar"
- Contador regressivo em segundos (`remaining`)
- Botão: "Continuar conectado" → `onStay()`
- Botão: "Sair agora" → `onLogout()`

---

## 3. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-SES-01 | Inativo por 5 min | `idleLogoutEnabled === true` | `showWarning = true` — modal exibido |
| RN-SES-02 | `remaining === 0` | Sem ação do usuário | Logout automático |
| RN-SES-03 | Clicar "Continuar" | Sempre | `stayActive()` — timer reiniciado, modal fechado |
| RN-SES-04 | `VITE_IDLE_LOGOUT_ENABLED === "false"` | — | Idle timeout desabilitado |

---

## 4. Auditoria

| Ação | Evento |
|---|---|
| Logout por inatividade | `auth.logout` |

---

## 5. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
