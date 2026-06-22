# Modal de Paciente — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/components/modals/PatientModal.jsx`  
**Acionado por:** `AppModals` → `showModal`

---

## 1. Objetivo e contexto

Modal central de gestão do cadastro de pacientes. Suporta três modos: criar novo paciente, editar paciente existente, e visualizar somente leitura. Contém todos os campos do cadastro individual do cidadão.

**Modos:** `create` / `edit` / `view` (readOnly)

---

## 2. Acionadores

| Ação | Modo | Local |
|---|---|---|
| Botão "+ Novo Paciente" | `create` | PatientsPage, Dashboard, AgendaPage, QueuePage |
| Ícone editar paciente | `edit` | PatientsPage |
| Ícone visualizar paciente | `view` | PatientsPage |

---

## 3. Seções do formulário

### 3.1 Identificação

- Nome completo *
- Data de nascimento *
- Sexo *
- Nome da mãe

### 3.2 Documentos

- CPF (formatado: 000.000.000-00)
- CNS (Cartão Nacional de Saúde)
- RG / Identidade

### 3.3 Contato

- Telefone (formatado)
- E-mail

### 3.4 Endereço

- CEP → lookup automático → preenche logradouro, bairro, cidade, UF
- Número / complemento

### 3.5 Dados APS

- Categoria (Geral / Gestante / Hipertenso / Diabético / Idoso / Infantil / etc.)
- ACS responsável (select de ACS da equipe)
- Microárea

### 3.6 Campos LGPD Art. 11 (dados sensíveis — Categoria Especial)

> Exibidos somente para perfis com acesso. Não aparecem em logs.

- Identidade de gênero (`genderIdentity`)
- Raça/Cor (`racaCor`)
- Etnia (`etnia`)
- Situação de rua (`situacaoRua`) — boolean
- Deficiência (`deficiencia`)

---

## 4. Dicionário de campos

| Campo | Nome técnico | Tipo | Obrig | Máscara | LGPD |
|---|---|---|---|---|---|
| Nome | `name` | text | S | — | PD |
| Data de nascimento | `dob` | date | S | — | PD |
| Sexo | `sex` | select | S | — | PD |
| Nome da mãe | `motherName` | text | N | — | PD |
| CPF | `cpf` | text | N | 000.000.000-00 | PD |
| CNS | `cns` | text | N | 000 0000 0000 0000 | PD |
| Telefone | `phone` | text | N | (00) 00000-0000 | PD |
| E-mail | `email` | email | N | — | PD |
| CEP | `cep` | text | N | 00000-000 | — |
| Logradouro | `address` | text | N | — | — |
| Categoria | `category` | select | N | — | — |
| ACS | `assignedAcsId` | select | N | — | — |
| Identidade de gênero | `genderIdentity` | select | N | — | SC (Art. 11) |
| Raça/Cor | `racaCor` | select | N | — | SC (Art. 11) |
| Situação de rua | `situacaoRua` | boolean | N | — | SC (Art. 11) |

---

## 5. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-MPT-01 | Preencher CEP | 8 dígitos válidos | `lookupCepAndFillAddress()` preenche automaticamente |
| RN-MPT-02 | Modo `view` | `readOnly === true` | Todos os campos desabilitados |
| RN-MPT-03 | Salvar | Nome ou data nascimento vazio | Erro de validação |
| RN-MPT-04 | Categoria infantil | `isChildCategory(category)` | Campos pediátricos exibidos |

---

## 6. Auditoria

| Ação | Evento |
|---|---|
| Criar paciente | `PACIENTE_CADASTRADO` |
| Editar paciente | `PACIENTE_EDITADO` |

---

## 7. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
