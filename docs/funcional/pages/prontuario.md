# Prontuário / Registros — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/RecordsPage.jsx`  
**Tab:** `chart`

---

## 1. Objetivo e contexto

Prontuário eletrônico do paciente. Permite registrar atendimentos clínicos, prescrições, exames solicitados e anotações. Exige paciente selecionado (`selectedPatientId`). É o núcleo do registro clínico do VITRAS APS.

**Usuários:** Médicos, enfermeiros, profissionais clínicos com `canWriteRecords`.

**Frequência de uso:** Por atendimento.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Tab | `chart` |
| Pré-condição | `selectedPatientId` deve estar definido |

---

## 3. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/patients/:id/records` | Histórico de registros |
| POST | `/patients/:id/records` | Criar novo registro |
| DELETE | `/patients/:id/records/:recordId` | Inativar registro |
| POST | `/patients/:id/appointments` | Agendar retorno |

---

## 4. Elementos da página

### 4.1 Header do paciente

- Nome, idade, categoria, ACS responsável
- Alertas especiais (LGPD Art. 11: HIV, sífilis, situaçãoRua)

### 4.2 Formulário de registro

- Tipo de atendimento (consulta, retorno, urgência, procedimento)
- Queixa / Motivo
- Conduta / Prescrição (textarea)
- Vacinas administradas (checkbox list)
- CID-10 (quando implementado)
- Botão "Salvar registro"

### 4.3 Timeline de registros

- Registros anteriores em ordem cronológica reversa
- Cada registro: data, profissional, tipo, conteúdo
- Botão inativar registro (somente autor ou admin)

---

## 5. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-REC-01 | Acessar tab | `!selectedPatientId` | Exibe estado vazio / selecione paciente |
| RN-REC-02 | Salvar registro | `canWriteRecords === false` | Botão desabilitado |
| RN-REC-03 | Inativar registro | `user.id !== record.authorId && !isAdmin` | Botão oculto |
| RN-REC-04 | Dados LGPD Art. 11 | Sempre | Exibidos somente se perfil tem acesso |

---

## 6. Permissões

| Ação | Requer |
|---|---|
| Ver registros | Qualquer clínico |
| Criar registro | `canWriteRecords` |
| Inativar registro | Autor ou admin |

---

## 7. Auditoria

| Ação | Evento |
|---|---|
| Acessar prontuário | `ACESSO_PRONTUARIO` |
| Criar registro | `LANCAMENTO_REGISTRO` |
| Inativar registro | `INATIVACAO_REGISTRO` |

---

## 8. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
