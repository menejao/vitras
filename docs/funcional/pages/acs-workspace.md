# Workspace ACS — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/AcsTasksPage.jsx`  
**Tab:** `acs_tasks`

---

## 1. Objetivo e contexto

Área de trabalho do Agente Comunitário de Saúde (ACS). Centraliza tarefas de visita domiciliar, busca ativa, acompanhamentos e demais atividades territoriais. Permite filtrar por período, tipo de tarefa e prioridade, visualizar detalhes do paciente e registrar execução das tarefas.

**Usuários:** `acs` (primário). Supervisores (gestor/enfermeiro) podem visualizar.

**Frequência de uso:** Diária — durante a jornada de campo.

**Regra LGPD:** Esta página acessa dados de pacientes — não registrar dados clínicos em logs operacionais.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Tab | `acs_tasks` |
| Mobile first | Sim — validar em 360px, 390px, 412px sem scroll horizontal |

---

## 3. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/tasks?assignee={userId}` | Carregar tarefas do ACS logado |
| PATCH | `/tasks/:id` | Atualizar status da tarefa |
| GET | `/patients` | Dados dos pacientes (bootstrap) |

---

## 4. Elementos da página

### 4.1 Header + KPIs

- KPIs: Total de tarefas / Hoje / Semana / Urgentes
- Filtro de período: Tudo / Hoje / Semana / Mês / Personalizado
- Filtro tipo: todos os `TASK_TYPES`
- Filtro prioridade: Urgente / Normal / Encaixe

### 4.2 Lista de tarefas

Cada tarefa exibe:
- Tipo (badge colorido)
- Nome do paciente
- Data
- Prioridade
- Status (pendente / concluído / cancelado)
- Botões de ação: marcar concluído, cancelar

### 4.3 Modal de detalhe da tarefa

Exibe ao clicar:
- Dados completos da tarefa
- Dados do paciente (nome, CPF mascarado, telefone, endereço)
- Histórico de visitas anteriores
- Botão "Ver paciente" → navega para tab=patients

---

## 5. Dicionário de campos

### Tipos de tarefa (`TASK_TYPES`)

| Valor | Label | Cor |
|---|---|---|
| `home_visit` | Visita Domiciliar | Azul |
| `active_search` | Busca Ativa | Âmbar |
| `return_visit` | Retorno | Violeta |
| `vaccination` | Vacinação | Verde |
| `pregnant_follow` | Acomp. Gestante | Rosa |
| `chronic_follow` | Hipert./Diabéticos | Laranja |
| `child_follow` | Acomp. Infantil | Teal |
| `other` | Outro | Slate |

### Prioridades (`PRIORITY_CONFIG`)

| Valor | Label |
|---|---|
| `urgent` | Urgente |
| `normal` | Normal |
| `fit_in` | Encaixe |

### Períodos (`PERIOD_PRESETS`)

| Valor | Label |
|---|---|
| `""` | Tudo |
| `today` | Hoje |
| `week` | Semana (seg-dom) |
| `month` | Mês atual |
| `custom` | Personalizado (date range inputs) |

---

## 6. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-ACS-01 | Carregar tarefas | Sempre | Filtra por `assignedTo === currentUser.id` |
| RN-ACS-02 | Filtro "Hoje" | Sempre | `from = to = hoje` |
| RN-ACS-03 | Filtro "Semana" | Sempre | Segunda a domingo da semana atual |
| RN-ACS-04 | Marcar concluído | task.status = "pending" | `PATCH /tasks/:id { status: "done" }` |
| RN-ACS-05 | CPF no detalhe | Sempre | Exibido mascarado: `maskCpf()` |
| RN-ACS-06 | Clicar "Ver paciente" | Sempre | Navega para tab=patients com ID selecionado |

---

## 7. Ações

| Ação | API | Resultado |
|---|---|---|
| Carregar tarefas | `GET /tasks` | Lista preenchida |
| Concluir tarefa | `PATCH /tasks/:id { status: "done" }` | Status atualizado na lista |
| Cancelar tarefa | `PATCH /tasks/:id { status: "cancelled" }` | Status atualizado |
| Ver paciente | — (local) | tab = patients + selectedPatientId |

---

## 8. Navegação

| Elemento | Destino |
|---|---|
| "Ver paciente" no modal | [Lista de Pacientes](lista-pacientes.md) com detalhe |

---

## 9. Permissões

Acessível a todos os perfis. ACS vê somente suas próprias tarefas. Gestor/supervisor pode ver tarefas de qualquer ACS (via filtro de ACS se implementado).

---

## 10. Auditoria

| Ação | Evento |
|---|---|
| Concluir tarefa | `TAREFA_CRIADA` (status change) |

---

## 11. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
