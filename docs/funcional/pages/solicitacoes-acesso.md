# Solicitações de Acesso — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/AccessRequestsPage.jsx`  
**Tab:** `access_requests`

---

## 1. Objetivo e contexto

Gestão de solicitações de acesso ao sistema enviadas via aba "Solicitar acesso" da tela de Login. Permite que admins e gestores aprovem ou rejeitem as solicitações, controlando quem pode acessar a UBS.

**Usuários:** `gestor`, admins, perfis com `access_requests.read`.

**Frequência de uso:** Sob demanda — quando há novas solicitações.

---

## 2. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/access-requests` | Listar solicitações |
| POST | `/access-requests/:id/approve` | Aprovar |
| POST | `/access-requests/:id/reject` | Rejeitar |

---

## 3. Elementos da página

### 3.1 Lista de solicitações

Para cada solicitação:
- Nome do solicitante
- E-mail
- Cargo solicitado (`jobTitle`)
- Data de solicitação
- Status badge: Pendente (amarelo) / Aprovado (verde) / Recusado (vermelho)
- Botões: "Aprovar" / "Recusar" (somente se `status === "pending"`)

### 3.2 Estados especiais

- **Loading:** spinner durante carregamento
- **Vazio:** EmptyState — "Nenhuma solicitação pendente"
- **Erro:** Alert vermelho com mensagem

---

## 4. Dicionário de campos

| Campo | Tipo | Origem |
|---|---|---|
| Nome | string | solicitação |
| E-mail | email | solicitação |
| Cargo | string | `jobTitle` da solicitação |
| Status | enum | `pending` / `approved` / `rejected` |
| Data | ISO date | `createdAt` da solicitação |

---

## 5. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-ARQ-01 | Aprovar | `status === "pending"` | `POST /access-requests/:id/approve` |
| RN-ARQ-02 | Rejeitar | `status === "pending"` | `POST /access-requests/:id/reject` |
| RN-ARQ-03 | Botões Aprovar/Rejeitar | `status !== "pending"` | Não exibidos |
| RN-ARQ-04 | Busy durante ação | Por solicitação individual | `actionBusy === "${id}_approve"` |

---

## 6. Permissões

| Ação | Requer |
|---|---|
| Ver lista | `isAdmin`, `isGestor`, ou `access_requests.read` |
| Aprovar/Rejeitar | Mesmo acima |

---

## 7. Auditoria

| Ação | Evento |
|---|---|
| Aprovação | (registrado na API) |
| Rejeição | (registrado na API) |

---

## 8. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
