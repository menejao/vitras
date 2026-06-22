# Vacinas — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/VaccinesPage.jsx`  
**Tab:** `vaccines`

---

## 1. Objetivo e contexto

Gestão do calendário vacinal dos pacientes. Permite registrar vacinas administradas, visualizar esquema vacinal por paciente e emitir relatórios de cobertura vacinal.

**Usuários:** Enfermeiros, técnicos de enfermagem, médicos.

---

## 2. Dependências técnicas

| Dado | Fonte |
|---|---|
| `patients` | bootstrap |
| `templates` | bootstrap (calendário vacinal) |
| `token` | autenticação |
| Registros de vacinas | `recordVaccines` (via PatientActivity) |

---

## 3. Elementos da página

### 3.1 Seleção de paciente

- Filtro por faixa etária, categoria
- Lista de pacientes com vacinação pendente

### 3.2 Calendário vacinal

- Lista de vacinas do esquema por faixa etária
- Status por dose: aplicada / pendente / atrasada / contraindicada
- Data de aplicação
- Lote / fabricante (quando aplicável)

### 3.3 Registro de vacina

- Select vacina do calendário
- Data de aplicação (default: hoje)
- Lote
- Via / localização de aplicação
- Profissional que aplicou

### 3.4 Cobertura vacinal (relatório)

- Percentual de cobertura por vacina
- Pacientes com esquema incompleto

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-VAC-01 | Vacina atrasada | Data prevista < hoje | Badge vermelho |
| RN-VAC-02 | Registrar vacina | `canManageUser === false` | Bloqueado |
| RN-VAC-03 | Gestante | category = gestante | Destaca vacinas obrigatórias na gravidez |

---

## 5. Auditoria

| Ação | Evento |
|---|---|
| Registrar vacina | `ATENDIMENTO_REGISTRADO` (tipo=vacinação) |

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
