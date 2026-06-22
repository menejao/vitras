# App Recepção — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/ReceptionistApp.jsx`  
**Rota:** App separado — renderizado para `isReceptionist(user) && !isAdmin(user)`

---

## 1. Objetivo e contexto

Aplicativo dedicado ao perfil de recepção da UBS. Interface simplificada com foco em fila de atendimento e agenda. Não acessa prontuário clínico. Possui login próprio para troca de recepcionista sem logout completo.

**Usuários:** `receptionist`.

**Frequência de uso:** Contínua durante horário de funcionamento.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Rota | `/` com role=receptionist |
| Posição fixada | `position: fixed; inset: 0` |
| Login alternativo | Sim — `ReceptionLoginModal` para troca de recepcionista |

---

## 3. Dependências técnicas

| Dado | Fonte |
|---|---|
| `patients` | bootstrap (App.jsx) |
| `users` | bootstrap |
| Fila | `useQueue(token)` |
| Agenda | `useAgenda(token)` |

---

## 4. Elementos da página

### 4.1 Header

- Logo BrandMark
- Nome da recepcionista logada
- Botão "Trocar recepcionista" → ReceptionLoginModal
- Botão "Sair"

### 4.2 Tabs internas

- **Fila** (padrão) — fila de atendimento
- **Agenda** — agenda do dia

### 4.3 Tab Fila

- Busca de paciente por nome
- Lista de pacientes na fila com prioridade e tempo de espera
- Botão "Chamar próximo"
- Seleção de paciente → painel lateral com dados básicos

### 4.4 Tab Agenda

- Seletor de data
- Lista de agendamentos do dia
- Botão "Novo agendamento" → AgendaForm (modal)
- Status de cada agendamento

### 4.5 ReceptionLoginModal

- Input e-mail + senha da recepcionista
- Login local sem logout global (token da nova recepcionista)

---

## 5. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-RCP-01 | Login | `isReceptionist(user) && !isAdmin` | Renderiza ReceptionistApp (não App Principal) |
| RN-RCP-02 | Trocar recepcionista | Modal | Novo token salvo, sessão trocada |
| RN-RCP-03 | Agenda | Dia indisponível | Slots bloqueados com `unavailableReason` |
| RN-RCP-04 | Acessar prontuário | Recepcionista | Não acessível — perfil não tem capability |

---

## 6. Permissões

| Ação | Requer |
|---|---|
| Ver fila | `receptionist` |
| Ver/criar agenda | `receptionist` (restrição no backend) |
| Acesso clínico | Bloqueado para `receptionist` |

---

## 7. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
