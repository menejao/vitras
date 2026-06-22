# Exames — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/ExamsPage.jsx`  
**Tab:** `exams_page`

---

## 1. Objetivo e contexto

Gestão de exames da UBS. Permite solicitar exames, registrar resultados de exames externos e visualizar histórico de exames por paciente.

**Usuários:** Médicos, enfermeiros, profissionais clínicos.

---

## 2. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/patients/:id/exams` | Listar exames do paciente |
| POST | `/patients/:id/exams` | Solicitar exame |
| POST | `/patients/:id/exams/external` | Registrar resultado externo |
| DELETE | `/patients/:id/exams/:examId` | Cancelar/excluir |

---

## 3. Elementos da página

### 3.1 Seleção de paciente

- Filtro/busca de paciente da lista

### 3.2 Lista de exames

- Exames solicitados com status: pendente / realizado / cancelado
- Exames externos com resultado em arquivo/texto
- Data solicitação, profissional, tipo do exame

### 3.3 Formulário de solicitação

- Tipo de exame (sangue, imagem, urina, etc.)
- Observações / indicação clínica
- Urgência

### 3.4 Registro de resultado externo

- Upload de resultado (texto)
- Data do exame externo

---

## 4. Regras de negócio

| Código | Gatilho | Ação |
|---|---|---|
| RN-EXM-01 | Solicitar exame | `PEDIDO_EXAME` auditado |
| RN-EXM-02 | Inserir externo | `EXAME_EXTERNO_INSERIDO` auditado |
| RN-EXM-03 | Excluir exame | `EXAME_EXCLUIDO` auditado |

---

## 5. Auditoria

| Ação | Evento |
|---|---|
| Solicitar exame | `PEDIDO_EXAME` |
| Inserir resultado externo | `EXAME_EXTERNO_INSERIDO` |
| Excluir exame | `EXAME_EXCLUIDO` |

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
