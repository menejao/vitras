# Triagem — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/TriagePage.jsx`  
**Tab:** `triage`

---

## 1. Objetivo e contexto

Registro de triagem de pacientes na UBS. Permite ao enfermeiro ou técnico de enfermagem registrar sinais vitais, queixa principal e classificação de risco antes do atendimento médico. Integra com a fila de atendimento.

**Usuários:** `nurse_manager`, `nursing_tech`.

**Frequência de uso:** Por atendimento — antes do médico.

---

## 2. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/patients` | Lista de pacientes (bootstrap) |
| POST | `/patients/:id/triage` | Salvar triagem |

---

## 3. Elementos da página

### 3.1 Seleção de paciente

- Busca por nome
- Lista filtrada de pacientes da unidade

### 3.2 Formulário de triagem

- Pressão arterial (sistólica / diastólica)
- Frequência cardíaca (bpm)
- Temperatura (°C)
- Saturação de oxigênio (%)
- Peso (kg) e Altura (cm)
- Glicemia capilar (mg/dL) — opcional
- Queixa principal (textarea)
- Classificação de risco (não urgente / pouco urgente / urgente / muito urgente / emergência)
- Observações

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-TRI-01 | PA sistólica | ≥ 180 | Badge vermelho (HAS grave) |
| RN-TRI-02 | SpO2 | < 95% | Badge amarelo |
| RN-TRI-03 | SpO2 | < 90% | Badge vermelho |
| RN-TRI-04 | Salvar | Sem paciente selecionado | Bloqueado |

---

## 5. Permissões

| Ação | Requer |
|---|---|
| Ver | Qualquer perfil clínico |
| Salvar triagem | `nurse_manager`, `nursing_tech` |

---

## 6. Auditoria

| Ação | Evento |
|---|---|
| Salvar triagem | `ATENDIMENTO_REGISTRADO` (tipo=triagem) |

---

## 7. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
