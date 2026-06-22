# Lista de Pacientes — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/PatientsPage.jsx`  
**Tab:** `patients`

---

## 1. Objetivo e contexto

Central de gestão de pacientes da UBS. Permite busca, filtros por categoria/ACS/condição crônica, seleção de paciente para ver detalhe, criar e editar cadastros. Integra lista com painel de detalhe completo do paciente (prontuário, tarefas, agendamentos, mensagens).

**Usuários:** Todos os perfis clínicos.

**Frequência de uso:** Diária — em cada atendimento.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Tab | `patients` |
| Acessado via | Sidebar, Dashboard, AcsTasksPage, Topbar (busca global) |

---

## 3. Dependências técnicas

| Dado | Fonte |
|---|---|
| `patients` | Bootstrap (`GET /patients`) |
| `users` | Bootstrap (`GET /users`) |
| `templates` | Bootstrap (`GET /templates`) |
| `protocolByPatient` | Bootstrap |
| `appointments` | `loadSelectedPatientData` |
| `tasks` | `loadSelectedPatientData` |
| `messages` | `loadSelectedPatientData` |
| `history` | `loadSelectedPatientData` (registros clínicos) |

---

## 4. Elementos da página

### 4.1 Header

- Título "Pacientes" + contagem total
- Botão "+ Novo Paciente" → PatientModal (criar)

### 4.2 Barra de filtros

- Busca texto: nome, CPF, CNS, telefone (normalizado)
- Filtro categoria: Geral, Gestante, Hipertenso, Diabético, Idoso, Infantil, etc.
- Filtro ACS: lista de ACS da equipe
- Filtro condição: Hipertensão / Diabetes / Ambos
- Select page size: 10 / 25 / 50

### 4.3 Tabela de pacientes (`PatientsTable`)

Colunas visíveis (responsivo — colapsa em tela estreita):
- Nome + badge de protocolo (`protocolChip`)
- Idade
- Categoria
- ACS responsável
- Status do protocolo
- Ações: editar, visualizar, excluir

### 4.4 Painel de detalhe do paciente (`PatientDetailPanel`)

Exibido ao selecionar paciente. Tabs internas:

| Tab | Conteúdo |
|---|---|
| `protocol` | Resumo do protocolo, alertas especiais, botão de prontuário |
| `chart` | Registros clínicos (atendimentos, prescrições, exames) |
| `appointments` | Agendamentos do paciente |
| `tasks` | Tarefas do ACS relacionadas |
| `messages` | Mensagens internas sobre o paciente |

---

## 5. Dicionário de campos

### Filtros

| Campo | Nome técnico | Tipo | Comportamento |
|---|---|---|---|
| Busca | `query` | text | Normaliza e compara nome/CPF/CNS/tel |
| Categoria | `categoryFilter` | select | Filtra por `patient.category` normalizada |
| ACS | `acsFilter` | select | Filtra por `patient.assignedAcsId` |
| Condição | `conditionFilter` | select | `""`, `"hypertension"`, `"diabetes"`, `"both"` |
| Por página | `pageSize` | select | 10 / 25 / 50 |

### Paciente (dados exibidos na tabela)

| Campo | Nome técnico | LGPD |
|---|---|---|
| Nome | `name` | PD |
| Data de nascimento / Idade | `dob` → `calcAge()` | PD |
| Categoria | `category` | — |
| ACS | `assignedAcsId` → nome do ACS | — |
| Status protocolo | `protocolByPatient[id]` | — |

---

## 6. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-PAT-01 | Busca texto | Keystroke | `normalizeSearch()` — ignora acentos, case |
| RN-PAT-02 | Tela estreita < 1440px | `isNarrow === true` | Layout compacto de tabela |
| RN-PAT-03 | Clicar paciente | Sempre | `setSelectedPatientId(id)` → carrega dados do paciente |
| RN-PAT-04 | `canWriteRecords === false` | Sempre | Formulários de registro desabilitados |
| RN-PAT-05 | `canManageUser === false` | Sempre | Botões criar/editar/excluir ocultos |
| RN-PAT-06 | Categoria "pap_only" ou "somente_papanicolau" | Normalização | Mapeado para "general" |

---

## 7. Ações

| Ação | API | Resultado |
|---|---|---|
| Criar paciente | `POST /patients` (via PatientModal) | Lista recarregada |
| Editar paciente | `PATCH /patients/:id` (via PatientModal) | Lista recarregada |
| Visualizar paciente | Sem API (abre modal somente leitura) | PatientModal (readOnly) |
| Excluir paciente | `DELETE /patients/:id` | Lista recarregada |
| Selecionar paciente | Sem API | PatientDetailPanel carregado |

---

## 8. Navegação

| Elemento | Destino |
|---|---|
| "+ Novo Paciente" | [Modal de Paciente](modal-paciente.md) (criar) |
| Clicar linha paciente | PatientDetailPanel (lateral) |
| Ícone editar | [Modal de Paciente](modal-paciente.md) (editar) |
| Tab "chart" no detalhe | [Prontuário](prontuario.md) inline |

---

## 9. Permissões

| Ação | Requer |
|---|---|
| Ver lista | Qualquer perfil clínico |
| Criar/editar/excluir paciente | `canManageUser` |
| Criar registros clínicos | `canWriteRecords` |

---

## 10. Auditoria

| Ação | Evento |
|---|---|
| Criar paciente | `PACIENTE_CADASTRADO` |
| Editar paciente | `PACIENTE_EDITADO` |
| Excluir paciente | `PACIENTE_EXCLUIDO` |
| Acessar prontuário | `ACESSO_PRONTUARIO` |

---

## 11. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
