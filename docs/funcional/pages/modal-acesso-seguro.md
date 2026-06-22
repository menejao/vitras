# Modal de Acesso Seguro — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/components/modals/SecureAccessModal.jsx`  
**Acionado por:** Topbar → "Acesso Seguro" ou "Break Glass"

---

## 1. Objetivo e contexto

Dois modos de acesso elevado para suporte técnico:

1. **Impersonação (`impersonate`):** `support_operator` assume sessão de outro usuário para diagnosticar problemas reportados.
2. **Break Glass (`break-glass`):** `break_glass_admin` ativa acesso de emergência com auditoria reforçada.

Ambos os modos são totalmente auditados — toda ação feita em sessão impersonada é registrada com o userId real e o userId alvo.

**Usuários:** `support_operator` (impersonação), `break_glass_admin` (break-glass).

---

## 2. Dependências técnicas

Hook: `useSecureAccess({ token, user, applySessionFromPayload, loadAll, setError })`

| Método | Endpoint | Finalidade |
|---|---|---|
| POST | `/auth/impersonate` | Iniciar impersonação |
| POST | `/auth/break-glass` | Ativar break-glass |
| POST | `/auth/stop-impersonation` | Encerrar impersonação |
| POST | `/auth/stop-break-glass` | Encerrar break-glass |

---

## 3. Elementos do modal

### Modo impersonação

- Select: usuário alvo (lista de `allUsers`)
- Campo: justificativa
- Botão: "Iniciar impersonação"
- Aviso: "Toda ação será auditada como [nome real] impersonando [usuário alvo]"

### Modo break-glass

- Campo: justificativa de emergência
- Botão: "Ativar acesso de emergência"
- Aviso vermelho com confirmação de audit

### Indicador na Topbar (durante sessão)

- Badge amarelo: "Impersonando [nome]"
- Botão: "Encerrar impersonação"

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-SAS-01 | Iniciar impersonação | Justificativa vazia | Bloqueado |
| RN-SAS-02 | Iniciar impersonação | Sucesso | `applySessionFromPayload(data)` → sessão trocada |
| RN-SAS-03 | Encerrar | Botão na Topbar | `POST /auth/stop-impersonation` → sessão restaurada |
| RN-SAS-04 | Break-glass | Sucesso | Acesso elevado temporário + audit reforçado |
| RN-SAS-05 | Todos os modos | Sempre | Logs de auditoria com userId real + userId alvo |

---

## 5. Auditoria

**Crítico:** Toda ação durante impersonação gera log duplo: ação executada + contexto de impersonação.

| Ação | Evento |
|---|---|
| Iniciar impersonação | `SECURE_ACCESS_IMPERSONATE_START` |
| Encerrar impersonação | `SECURE_ACCESS_IMPERSONATE_STOP` |
| Ativar break-glass | `SECURE_ACCESS_BREAK_GLASS_START` |

---

## 6. Permissões

| Modo | Requer |
|---|---|
| Impersonação | `support_operator` |
| Break-glass | `break_glass_admin` |

---

## 7. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
