# Agenda — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/AgendaPage.jsx`  
**Tab:** `agenda`

---

## 1. Objetivo e contexto

Gestão de agendamentos da UBS. Permite visualizar agenda por médico/profissional e dia, criar novos agendamentos, editar e cancelar. Integra com a fila de atendimento (QueuePage) e com o prontuário do paciente.

**Usuários:** Recepcionistas, médicos, enfermeiros. Requer `teamId` + capability `agenda.read` ou `agenda.write`.

**Frequência de uso:** Diária — durante a recepção e planejamento de atendimentos.

---

## 2. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/agenda` | Carregar entradas de agenda |
| POST | `/agenda` | Criar agendamento |
| PATCH | `/agenda/:id` | Editar agendamento |
| DELETE | `/agenda/:id` | Cancelar agendamento |

---

## 3. Elementos da página

### 3.1 Seletor de data

- Input date — selecionar dia da agenda

### 3.2 Seletor de profissional

- Select de médico/profissional da equipe

### 3.3 Grade de horários

- Horários disponíveis (AGENDA_HOURS)
- Slot ocupado: mostra paciente, tipo, status
- Slot livre: botão "Agendar"
- Dias indisponíveis bloqueados com mensagem `unavailableReason`

### 3.4 Formulário de agendamento (AgendaForm)

- Select: Paciente
- Select: Médico
- Input: Data + Hora
- Select: Tipo (`consultation`, `return`, `exam`, `procedure`)
- Textarea: Observações
- Select: Status (`scheduled`, `confirmed`, `cancelled`, `done`)
- Botão salvar

---

## 4. Dicionário de campos

| Campo | Nome técnico | Tipo | Obrig |
|---|---|---|---|
| Paciente | `patientId` | select | S |
| Médico | `doctorId` | select | S |
| Data | `date` | date | S |
| Hora | `time` | time | S |
| Tipo | `type` | select | S |
| Observações | `notes` | textarea | N |
| Status | `status` | select | S (padrão: `scheduled`) |

### Status labels (`AGENDA_STATUS_LABELS`)

| Valor | Label |
|---|---|
| `scheduled` | Agendado |
| `confirmed` | Confirmado |
| `cancelled` | Cancelado |
| `done` | Realizado |

---

## 5. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-AGD-01 | Acessar tab | Sem `teamId` ou sem capability | Tab bloqueado / não exibido |
| RN-AGD-02 | Dia indisponível | `isUnavailableDay(date)` | Slots bloqueados com aviso |
| RN-AGD-03 | Criar agendamento | `agenda.write` ausente | Formulário desabilitado |
| RN-AGD-04 | Novo paciente via agenda | Botão "Novo paciente" | PatientModal + `onPatientCreated(loadAll)` |

---

## 6. Permissões

| Ação | Requer |
|---|---|
| Ver agenda | `agenda.read` + `teamId` |
| Criar/editar/cancelar | `agenda.write` + `teamId` |

---

## 7. Auditoria

| Ação | Evento |
|---|---|
| Criar agendamento | Registrado na API |
| Cancelar | Registrado na API |

---

## 8. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
