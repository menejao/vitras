# Encaminhamentos — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/ReferralsPage.jsx`  
**Tab:** `referrals`

---

## 1. Objetivo e contexto

Gestão de encaminhamentos internos e externos da UBS. Permite criar encaminhamentos a especialistas, centros de referência ou outros serviços de saúde. Acompanha status do encaminhamento (pendente, agendado, realizado, cancelado).

**Usuários:** Médicos, enfermeiros. Requer `teamId` + `referrals.read` ou `referrals.write`.

---

## 2. Dependências técnicas

Hook: `useReferrals(token, { enabled })` com operações CRUD via API.

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/referrals` | Listar encaminhamentos |
| POST | `/referrals` | Criar encaminhamento |
| PATCH | `/referrals/:id` | Atualizar status |
| DELETE | `/referrals/:id` | Cancelar |

---

## 3. Elementos da página

### 3.1 Filtros

- Busca por paciente / especialidade
- Filtro por status
- Filtro por período

### 3.2 Lista de encaminhamentos

Para cada encaminhamento:
- Paciente
- Especialidade / destino
- Data de criação
- Data prevista
- Status badge
- Profissional que criou

### 3.3 Formulário de encaminhamento

- Select paciente
- Especialidade (texto livre ou select)
- Tipo (interno / externo / SADT)
- Motivo (textarea)
- Urgência
- Data prevista
- Observações

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-ENC-01 | Acessar tab | Sem `teamId` ou sem capability | Tab não exibido / bloqueado |
| RN-ENC-02 | Criar encaminhamento | `referrals.write` ausente | Formulário desabilitado |

---

## 5. Permissões

| Ação | Requer |
|---|---|
| Ver | `referrals.read` + `teamId` |
| Criar/editar/cancelar | `referrals.write` + `teamId` |

---

## 6. Auditoria

| Ação | Evento |
|---|---|
| Criar encaminhamento | `ENCAMINHAMENTO_INTERNO` |

---

## 7. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
