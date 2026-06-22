# Fila de Atendimento — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/QueuePage.jsx`  
**Tab:** `queue`

---

## 1. Objetivo e contexto

Fila de atendimento da UBS. Exibe pacientes que chegaram à unidade aguardando atendimento, com prioridade calculada automaticamente baseada em condição clínica. Permite chamar o próximo, atualizar status e registrar chegada de novos pacientes.

**Usuários:** Recepcionistas (ReceptionistApp) e profissionais clínicos (tab `queue` no App Principal).

**Frequência de uso:** Contínua durante o horário de atendimento.

---

## 2. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/queue` | Listar fila atual |
| POST | `/queue` | Adicionar paciente à fila |
| PATCH | `/queue/:id` | Atualizar status (chamar, atender, concluir) |
| DELETE | `/queue/:id` | Remover da fila |

Hook: `useQueue(token)`

---

## 3. Elementos da página

### 3.1 Resumo da fila

- Total na fila
- Em atendimento
- Tempo médio de espera

### 3.2 Lista de pacientes na fila

Para cada entrada:
- Número de ordem
- Nome do paciente
- Prioridade (QUEUE_PRIORITY_LABELS)
- Tempo de espera (`formatQueueWait`)
- Status
- Botão "Chamar"

### 3.3 Prioridades (`QUEUE_PRIORITY_LABELS`)

Inferidas por `inferQueuePriorityFromPatient(patient)`:
- Urgente (vermelho)
- Prioritário (amarelo)
- Normal (azul)

### 3.4 Adicionar à fila

- Busca paciente por nome
- Select prioridade manual (override da automática)
- Botão "Adicionar à fila"

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-FIL-01 | Adicionar paciente | Sempre | Prioridade calculada por `inferQueuePriorityFromPatient` |
| RN-FIL-02 | Recepcionista chama | Botão "Chamar" | Status → "called" |
| RN-FIL-03 | Médico inicia | Receber paciente | Status → "in_progress" |
| RN-FIL-04 | Concluir atendimento | Sempre | Status → "done", removido da fila ativa |

---

## 5. Permissões

Acessível a todos os perfis. Recepcionista usa via ReceptionistApp.

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
