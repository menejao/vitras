# VITRAS-CLINICAL-EVENT-ATTRIBUTION-01
# FASE 0 — Relatório de Auditoria de Eventos Clínicos

> **Sprint:** VITRAS-CLINICAL-EVENT-ATTRIBUTION-01
> **Fase:** 0 — Auditoria Read-Only
> **Data:** 2026-08-07
> **Baseline:** commit 764c19f / tag v1.1.0-rc.2
> **Status:** RELATÓRIO TÉCNICO — aguarda aprovação para implementação

---

## 1. SUMÁRIO EXECUTIVO

O VITRAS possui **14 tipos de eventos clínicos** distribuídos em **12 rotas backend**.

Estado atual do modelo de atribuição:

| Campo | Onde existe | Onde falta |
|---|---|---|
| `executingUnitId` | clinicalRecords ✓, agendaEntries ✓, queueEntries ✓, exams ✓, examRequests ✓, referrals ✓ | acsVisits ✗, odontoProcedures ✗, dentalEncounters ✗, prescricoes ✗, dispensacoes ✗, tasks ✗ |
| `executingTeamId` | clinicalRecords ✓, agendaEntries ✓, queueEntries ✓ | exams ✗, examRequests ✗, referrals ✗, todas as demais ✗ |
| `executingProfessionalId` | clinicalRecords ✓ | todas as demais ✗ |
| `patientReferenceUnitId` | clinicalRecords ✓ | todas as demais ✗ |
| `patientReferenceTeamId` | clinicalRecords ✓ | todas as demais ✗ |
| `municipalityId` | clinicalRecords ✓ | todas as demais ✗ |
| `occurredAt` | — | todos (usam `createdAt` como proxy) |

**`resolveActiveUnit(req)`** = `req.user?.unitId` — fonte única, servidor, nunca cliente. Correto.

---

## 2. INVENTÁRIO DETALHADO POR EVENTO

### 2.1 Registro Clínico (consulta, enfermagem, odontologia, exame solicitado, encaminhamento, prescrição, visita, vacina, procedimento, nota, evolution, atestado)

**Arquivo:** `backend/src/routes/patients.js`
**Rota:** `POST /patients/:id/records`
**Coleção:** `db.clinicalRecords`
**Tipos cobertos:** `consultation`, `vaccine`, `procedure`, `note`, `prescription`, `exam_request`, `referral`, `nursing`, `evolution`, `attendance_attest`, `medical_attest`, `visit`

**Campos atuais (COMPLETO — sprint RC1 já implementou):**

```
id, patientId, type, title, details, date
executingProfessionalId  ← req.user.id
executingTeamId          ← req.user.teamId
executingUnitId          ← resolveActiveUnit(req)
patientReferenceTeamId   ← patient.teamId
patientReferenceUnitId   ← patient.referenceUnitId || patient.unitId
municipalityId           ← patient.municipalityId
isCrossTeam
createdBy, createdAt
```

**Classificação:** ✅ COMPLETO — modelo de atribuição já implementado.

**Nota sobre `visit` (sub-tipo ACS):** `POST /patients/:id/records` com `type=visit` também persiste `executingUnitId`, `patientReferenceUnitId`, etc. — CORRETO.

---

### 2.2 Agenda / Agendamento

**Arquivo:** `backend/src/routes/agenda.js`
**Rota:** `POST /agenda`
**Coleção:** `db.agendaEntries`

**Campos atuais:**

```
id, patientId, patientName
teamId          ← patient.teamId   [REFERÊNCIA — equipe territorial do paciente]
doctorId, doctorName, date, time, type, appointmentType, ...
executingTeamId ← req.user.teamId  [EXECUÇÃO ✓ — já implementado]
executingUnitId ← resolveActiveUnit(req)  [EXECUÇÃO ✓ — já implementado]
createdBy, createdAt
```

**Campos ausentes:**
- `referenceUnitIdAtEvent` — UBS de referência do paciente no momento do agendamento
- `referenceTeamIdAtEvent` — equipe de referência no momento do agendamento
- `executingProfessionalId`
- `municipalityId`

**Classificação:** ⚠️ PARCIAL — `executingTeamId` e `executingUnitId` presentes; referência territorial ausente.

**Ambiguidade de `teamId`:** `teamId` = `patient.teamId` = equipe de referência territorial. Semântica correta mas não documentada formalmente.

---

### 2.3 Fila / Recepção (dar entrada)

**Arquivo:** `backend/src/routes/queue.js` + `agenda.js` (dar-entrada)
**Rota:** `POST /queue` | `POST /agenda/:id/dar-entrada`
**Coleção:** `db.queueEntries`

**Campos atuais:**

```
id, patientId, patientName
teamId          ← patient.teamId   [REFERÊNCIA]
priority, reason, demandType, destination, specialty, ...
executingTeamId ← req.user.teamId  [EXECUÇÃO ✓]
executingUnitId ← resolveActiveUnit(req)  [EXECUÇÃO ✓]
arrivedAt, createdAt
```

**Campos ausentes:**
- `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent`
- `executingProfessionalId`
- `municipalityId`

**Classificação:** ⚠️ PARCIAL — execução presente, referência ausente.

---

### 2.4 Exame (resultado anexado)

**Arquivo:** `backend/src/routes/exams.js`
**Rota:** `POST /patients/:id/exams`
**Coleção:** `db.exams`

**Campos atuais:**

```
id, patientId
teamId          ← patient.teamId   [REFERÊNCIA — correto]
executingUnitId ← resolveActiveUnit(req)  [EXECUÇÃO ✓ — já implementado]
title, date, details, source, attachments, createdBy, createdAt
```

**Campos ausentes:**
- `executingTeamId`
- `executingProfessionalId`
- `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent`
- `municipalityId`

**Classificação:** ⚠️ PARCIAL — `executingUnitId` presente, restante ausente.

---

### 2.5 Solicitação de Exame (exam-request)

**Arquivo:** `backend/src/routes/exam-requests.js`
**Rota:** `POST /exam-requests`
**Coleção:** `db.examRequests`

**Campos atuais:**

```
id, patientId, patientName, clinicalRecordId
teamId          ← patient.teamId   [REFERÊNCIA]
requestedById, requestedByName, requestedByCouncil
origin, priority, clinicalJustification, executionType, status
executingUnitId ← resolveActiveUnit(req)  [EXECUÇÃO ✓]
requestedAt, createdAt
```

**Campos ausentes:**
- `executingTeamId`
- `executingProfessionalId` (tem `requestedById` mas não mapeado como campo de execução)
- `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent`
- `municipalityId`

**Classificação:** ⚠️ PARCIAL

---

### 2.6 Encaminhamento (referral)

**Arquivo:** `backend/src/routes/referrals.js`
**Rota:** `POST /referrals`
**Coleção:** `db.referrals`

**Campos atuais:**

```
id, patientId, patientName
teamId          ← patient.teamId   [REFERÊNCIA]
specialty, reason, priority, date, notes, status, contrarreferencia
executingUnitId ← resolveActiveUnit(req)  [EXECUÇÃO ✓]
doctorId ← req.user.id  [PROFISSIONAL — não nomeado como executingProfessionalId]
doctorName, events[], createdBy, createdAt
```

**Campos ausentes:**
- `executingTeamId`
- `executingProfessionalId` (tem `doctorId` — semântica parcialmente equivalente)
- `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent`
- `municipalityId`

**Classificação:** ⚠️ PARCIAL

---

### 2.7 Prescrição / Receita

**Arquivo:** `backend/src/routes/pharmacy-receitas.js`
**Rota:** `POST /pharmacy/receitas`
**Coleção:** `db.prescricoes`

**Campos atuais:**

```
id, patientId, patientName
teamId          ← user.teamId      [⚠️ EXECUÇÃO — não referência do paciente!]
prescriberId, prescritorNome, prescritorRegistro
dtReceita, validade, validUntil, itens, obs, origem, status
criadaEm, criadaPor
```

**Campos ausentes:**
- `executingUnitId` ✗
- `executingTeamId` (tem `teamId` mas com semântica de execução — não explícito)
- `executingProfessionalId` (tem `prescriberId`)
- `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent`
- `municipalityId`
- `patientId` → `patientReferenceUnitId`

**Classificação:** 🔴 LEGADO — `teamId` = equipe do prescritor (execução), mas campo não nomeado corretamente. Sem `executingUnitId`.

---

### 2.8 Dispensação

**Arquivo:** `backend/src/routes/pharmacy-receitas.js`
**Rota:** `POST /pharmacy/dispensacoes`
**Coleção:** `db.dispensacoes`

**Campos atuais:**

```
id, receitaId, patientId
dispensadoPor ← user.id
dispensadoPorNome ← user.name
teamId ← user.teamId || receita.teamId  [⚠️ EXECUÇÃO — semântica não explícita]
itens, obs, realizadaEm
```

**Campos ausentes:**
- `executingUnitId` ✗
- `executingTeamId` (tem `teamId` — semântica indefinida)
- `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent`, `municipalityId`

**Classificação:** 🔴 LEGADO

---

### 2.9 Visita ACS (acsVisit)

**Arquivo:** `backend/src/routes/acs-visits.js`
**Rota:** `POST /acs-visits`
**Coleção:** `db.acsVisits`

**Campos atuais:**

```
id, patientId, patientName, householdId, taskId
acsId ← req.user.id
acsName ← req.user.name
teamId ← patient.teamId || req.user.teamId   [⚠️ AMBÍGUO — referência ou execução?]
date, turno, microarea, foraArea, tipoImovel, visitaCompartilhada
desfecho, motivos, buscaAtiva, acompanhamentos, controleAmbiental
peso, altura, temperatura, paSistolica, paDiastolica, glicemia
observacoes, cadastroIndividual, cadastroDomiciliar
createdAt, updatedAt
```

**Campos ausentes:**
- `executingUnitId` ✗
- `executingTeamId` (tem `teamId` — ambíguo)
- `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent`, `municipalityId`

**Nota crítica:** `cds-export.js` usa `visit.unitId` para isolamento — mas `unitId` NÃO existe no schema atual de `acsVisit`! A verificação `visit.unitId && visit.unitId !== activeUnitId` sempre passa (visit.unitId = undefined → falsy → skip). Em single-UBS isso é inócuo. Em multi-UBS isso é um gap de isolamento.

**Nota sobre `foraArea`:** Já existe campo booleano indicando visita fora da área. Pode ser usado como proxy de "execução ≠ referência".

**Classificação:** 🔴 AMBÍGUO/LEGADO — campo `teamId` ambíguo, sem `executingUnitId`, sem `municipalityId`.

---

### 2.10 Procedimento Odontológico

**Arquivo:** `backend/src/routes/odontologia.js`
**Rota:** `POST /odontologia/procedures`
**Coleção:** `db.odontoProcedures`

**Campos atuais:**

```
id, patientId
teamId ← user.teamId || null    [EXECUÇÃO — equipe do dentista]
toothFdi, face, type, status, date, notes
professionalId ← user.id
professionalName ← user.name
createdAt, createdBy
```

**Campos ausentes:**
- `executingUnitId` ✗
- `executingTeamId` (tem `teamId` como proxy)
- `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent`, `municipalityId`

**Classificação:** 🟡 AMBÍGUO — `teamId` = equipe do executor, semântica parcialmente correta. Sem UBS.

---

### 2.11 Consulta Odontológica (encontro)

**Arquivo:** `backend/src/routes/odontologia.js`
**Rota:** `POST /odontologia/encounters`
**Coleção:** `db.dentalEncounters`

**Campos atuais:**

```
id, patientId
teamId ← user.teamId || null   [EXECUÇÃO]
professionalId ← user.id
professionalName ← user.name
date, startedAt, ...
```

**Campos ausentes:**
- `executingUnitId` ✗, `referenceUnitIdAtEvent` ✗, `municipalityId` ✗

**Classificação:** 🟡 AMBÍGUO

---

### 2.12 Exame via Integração Lab

**Arquivo:** `backend/src/routes/lab.js`
**Rota:** `POST /lab/results` (integração externa)
**Coleção:** `db.exams`

**Campos atuais:**

```
id, patientId
teamId ← patient.teamId   [REFERÊNCIA — correto]
title, date, status, resultDate, lab, source="posto", externalId, details, attachments
createdBy="lab-integration"
```

**Campos ausentes:**
- `executingUnitId` ✗ (evento externo — sem UBS executora real no VITRAS)
- `executingProfessionalId` ✗

**Classificação:** 🟢 LEGADO INTENCIONAL — evento externo ao VITRAS; UBS executora é o laboratório externo, não capturável via JWT.

---

### 2.13 Tarefa Clínica (task)

**Arquivo:** `backend/src/routes/tasks.js`
**Rota:** `POST /tasks`
**Coleção:** `db.tasks`

**Campos atuais:**

```
id, patientId, assigneeId, title, notes, status, dueDate
createdBy ← req.user.id
createdAt, updatedAt
```

**Campos ausentes:** `teamId`, `unitId`, `executingUnitId`, TUDO ausente.

**Classificação:** 🔴 INCOMPLETO — tarefa é organizacional, não evento clínico direto. Mas tem `patientId` e `assigneeId`. Para produção de tarefas ACS, equipe é necessária.

---

### 2.14 Configuração de Agenda (schedule)

**Arquivo:** `backend/src/routes/schedule.js`
**Rota:** `POST /schedule/configurations`
**Coleção:** `db.professionalSchedules`

**Campos atuais:**

```
unitId ← resolveActiveUnit(req)   [EXECUÇÃO — UBS onde o profissional atende]
professionalId
...
```

**Classificação:** ✅ CORRETO — schedule é por UBS executora, não por referência. Sem ambiguidade.

---

## 3. MATRIZ DE CLASSIFICAÇÃO

| Evento | Coleção | executingUnitId | executingTeamId | executingProfId | referenceAtEvent | Classificação |
|---|---|:---:|:---:|:---:|:---:|---|
| Registro clínico (todos os tipos) | clinicalRecords | ✅ | ✅ | ✅ | ✅ | **COMPLETO** |
| Visita ACS (via /records) | clinicalRecords | ✅ | ✅ | ✅ | ✅ | **COMPLETO** |
| Agenda | agendaEntries | ✅ | ✅ | ✗ | ✗ | **PARCIAL** |
| Fila / Dar-entrada | queueEntries | ✅ | ✅ | ✗ | ✗ | **PARCIAL** |
| Exame resultado | exams | ✅ | ✗ | ✗ | ✗ | **PARCIAL** |
| Solicitação de exame | examRequests | ✅ | ✗ | ✗ | ✗ | **PARCIAL** |
| Encaminhamento | referrals | ✅ | ✗ | ✗ | ✗ | **PARCIAL** |
| Visita ACS (via /acs-visits) | acsVisits | ✗ | ✗ | ✗ | ✗ | **AMBÍGUO** |
| Procedimento odontológico | odontoProcedures | ✗ | ✗ | ✗ | ✗ | **AMBÍGUO** |
| Consulta odontológica | dentalEncounters | ✗ | ✗ | ✗ | ✗ | **AMBÍGUO** |
| Prescrição | prescricoes | ✗ | ✗ | ✗ | ✗ | **LEGADO** |
| Dispensação | dispensacoes | ✗ | ✗ | ✗ | ✗ | **LEGADO** |
| Exame (integração lab) | exams | ✗ | ✗ | ✗ | ✗ | **LEGADO INTENCIONAL** |
| Tarefa clínica | tasks | ✗ | ✗ | ✗ | ✗ | **INCOMPLETO** |
| Configuração agenda | professionalSchedules | ✅ | — | — | — | **CORRETO** |

---

## 4. ANÁLISE DE AMBIGUIDADE DE unitId / teamId

### 4.1 `teamId` nos eventos — semântica atual

| Evento | `teamId` = ? | Correto? |
|---|---|:---:|
| clinicalRecords.patientReferenceTeamId | equipe de referência do paciente | ✅ |
| agendaEntries.teamId | patient.teamId = referência | ✅ (não documentado) |
| queueEntries.teamId | patient.teamId = referência | ✅ (não documentado) |
| exams.teamId | patient.teamId = referência | ✅ |
| examRequests.teamId | patient.teamId = referência | ✅ |
| referrals.teamId | patient.teamId = referência | ✅ |
| acsVisits.teamId | patient.teamId OR req.user.teamId | ⚠️ AMBÍGUO |
| odontoProcedures.teamId | user.teamId = execução | ⚠️ MISTO |
| dentalEncounters.teamId | user.teamId = execução | ⚠️ MISTO |
| prescricoes.teamId | user.teamId = execução | ⚠️ MISTO |
| dispensacoes.teamId | user.teamId OR receita.teamId | ⚠️ MISTO |
| tasks.teamId | ausente | ✗ |

### 4.2 `resolveActiveUnit(req)` = `req.user?.unitId`

Implementação atual: **correto** — nunca aceita valor do cliente.

Mas: `req.user.unitId` é a UBS principal do usuário, não necessariamente a UBS ativa na sessão multi-UBS. Em modelo multi-UBS futuro, pode ser necessário `activeUnitId` da sessão em vez de `unitId` fixo do perfil.

---

## 5. IMPACTO NOS INDICADORES DE PRODUÇÃO

`production-metrics.js` atualmente calcula:

- **ACS metrics:** filtra `db.acsVisits` por `acsId` — correto.
- **Nurse metrics:** usa `acsVisits` por `teamId` (via familyGroups) — usa referência, não execução. Correto para indicadores de cobertura territorial.
- **Manager metrics:** usa `patients.teamId`, `familyGroups.teamId` — referência territorial. Correto para gestão de território.

**Gap crítico:** Nenhum indicador usa `executingUnitId` ainda. Quando existirem indicadores de produção operacional (consultas realizadas por UBS), precisarão de `executingUnitId` em todos os eventos. Atualmente `clinicalRecords` já tem — mas agenda, fila, exames não têm `executingTeamId` completo.

---

## 6. RISCOS

### RISCO-01 — acsVisits sem executingUnitId (ALTO para multi-UBS)

`cds-export.js` verifica `visit.unitId && visit.unitId !== activeUnitId`. Como `acsVisit` não tem `unitId`, a verificação nunca bloqueia. Em single-UBS: inócuo. Em multi-UBS: gap de isolamento no CDS export — ACS poderia exportar visitas de outra UBS via CDS.

**Mitigação para FASE 5:** adicionar `executingUnitId` ao acsVisit e atualizar `cds-export.js` — MAS cds-export é INTOCÁVEL sem aprovação explícita. Este risco deve ser tratado com revisão específica.

### RISCO-02 — Migração de eventos legados (MÉDIO)

Prescrições, dispensações, odontoProcedures e dentalEncounters sem `executingUnitId`. Não é possível reconstruir retroativamente o valor correto — evento já ocorreu. Migration deve classificar como `executingUnitId: null` com flag `attribution: "legacy"`.

### RISCO-03 — acsVisits.teamId ambíguo (MÉDIO)

`teamId = patient.teamId || req.user.teamId`. Quando paciente não tem teamId, usa equipe do ACS (execução). Quando tem teamId, usa referência do paciente. Inconsistente.

### RISCO-04 — resolveActiveUnit em multi-UBS (BAIXO agora, ALTO futuro)

`resolveActiveUnit = req.user.unitId` = UBS do perfil. Em modelo multi-UBS com troca de UBS ativa durante sessão, precisará de `activeUnitId` de sessão. Não bloqueia RC1, mas bloqueará executingUnitId correto em sessões cross-UBS.

### RISCO-05 — Dupla via de visita ACS (MÉDIO)

Visita pode ser registrada via `POST /patients/:id/records` (tipo=visit, com atribuição completa) OU via `POST /acs-visits` (sem atribuição). Existe duplicidade de paths que pode gerar confusão.

---

## 7. DEPENDÊNCIAS E COMPATIBILIDADE

### cds-export.js (INTOCÁVEL — REGRA 4)

- Usa `patient.unitId` para isolamento de pacientes → `unitId` nunca pode ser removido.
- Usa `visit.unitId` para isolamento de visitas → gap atual (campo inexistente em acsVisit).
- Resolve UBS pelo `professional.unitId` — via perfil do usuário, não via evento.

**Conclusão:** Adicionar `executingUnitId` aos eventos é seguro — não quebra cds-export.js. Remover `unitId` dos pacientes ou `teamId` dos eventos quebraria.

### Produção operacional (`production-metrics.js`)

Não usa `executingUnitId` ainda. Adicionar o campo nos eventos não quebra nada — apenas habilita cálculos futuros.

### Testes existentes

Todos os testes usam `clinicalRecords` (completo). Eventos PARCIAL/AMBÍGUO/LEGADO não têm testes de atribuição — risco de regressão baixo na adição de campos opcionais.

---

## 8. PLANO DE IMPLEMENTAÇÃO (FASE POR FASE)

### FASE 1 — Modelo canônico (docs only)

Documentar formalmente os campos do modelo canônico no glossário. Sem código.

### FASE 2 — Captura da referência nos eventos PARCIAL

**Alvos:** `agendaEntries`, `queueEntries`, `exams`, `examRequests`, `referrals`

Adicionar campos opcionais:
- `referenceUnitIdAtEvent` ← `patient.referenceUnitId || patient.unitId`
- `referenceTeamIdAtEvent` ← `patient.teamId`
- `municipalityId` ← `patient.municipalityId`

**Impacto:** baixo — campos adicionais, sem remoção. Sem alteração de cds-export.

### FASE 3 — Captura de execução completa nos eventos PARCIAL

**Alvos:** `agendaEntries`, `queueEntries`, `exams`, `examRequests`, `referrals`

Adicionar:
- `executingProfessionalId` ← `req.user.id`
- `executingTeamId` (onde ausente) ← `req.user.teamId`

### FASE 4 — Eventos AMBÍGUO: acsVisit

**Atenção:** `acsVisit` tem path duplicado com `clinicalRecord/visit`. Decisão necessária:
- Consolidar (remover acs-visits, usar só clinical-records/visit)?
- Manter dual path com atribuição correta em ambos?

**Recomendação:** manter dual path, adicionar `executingUnitId`, `executingTeamId`, `referenceUnitIdAtEvent`, `municipalityId` ao `acsVisit`. Tratar `cds-export` isolamento via `executingUnitId` em sprint separada com aprovação explícita.

### FASE 5 — Eventos AMBÍGUO: odontologia

Adicionar `executingUnitId` e `referenceAtEvent` a `odontoProcedures` e `dentalEncounters`.

### FASE 6 — Eventos LEGADO: prescrições e dispensações

Adicionar `executingUnitId` para novos registros. Migration: `null` com `attribution: "legacy"` para histórico.

### FASE 7 — Tasks

Adicionar `teamId` (criador) e `unitId` para contexto organizacional.

### FASE 8 — Migration

UP: backfill campos ausentes onde possível (exams: `executingUnitId` pode ser recuperado via `exam.teamId → team.unitId`).
DOWN: remover campos adicionados.
Registros impossíveis: `{ executingUnitId: null, attribution: "legacy" }`.
Dry-run obrigatório antes de produção.

---

## 9. ESTIMATIVA DE IMPACTO

| Fase | Arquivos modificados | Risco | Esforço |
|---|---|---|---|
| FASE 2 — referenceAtEvent nos PARCIAL | agenda.js, queue.js, exams.js, exam-requests.js, referrals.js | BAIXO | Pequeno |
| FASE 3 — executingProfId/Team nos PARCIAL | mesmos arquivos | BAIXO | Pequeno |
| FASE 4 — acsVisit atribuição | acs-visits.js | MÉDIO (gap cds-export) | Médio |
| FASE 5 — odontologia | odontologia.js | BAIXO | Pequeno |
| FASE 6 — prescrição/dispensação | pharmacy-receitas.js | BAIXO | Pequeno |
| FASE 7 — tasks | tasks.js | BAIXO | Pequeno |
| FASE 8 — migration | migration-022*.mjs | MÉDIO | Médio |
| FASE 9 — testes | *.test.mjs (novos) | — | Grande |

**Estimativa total:** 3–5 dias de implementação + testes.

**Bloqueador crítico:** RISCO-01 (acsVisit + cds-export) exige decisão antes da FASE 4 — ou cds-export é aprovado para pequena atualização, ou a FASE 4 implementa `executingUnitId` sem tocar cds-export (gap persiste em multi-UBS até próxima sprint autorizada).

---

## 10. RESULTADO DA FASE 0

| Item | Status | Evidência |
|---|---|---|
| Todos os eventos auditados? | **SIM** — 14 tipos mapeados | Seções 2.1–2.14 |
| Semântica de unitId/teamId por evento | **SIM** | Seção 4 |
| Pontos de ambiguidade identificados | **SIM** — 5 riscos | Seção 6 |
| Dependências mapeadas | **SIM** — cds-export, produção-metrics | Seção 7 |
| Plano fase a fase definido | **SIM** | Seção 8 |
| Impacto estimado | **SIM** | Seção 9 |
| Alteração de código? | **NÃO** — read-only | — |

**Classificação:** RELATÓRIO COMPLETO — aguarda aprovação para FASES 1-10.
