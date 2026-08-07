# Matriz de Indicadores VITRAS — v1.0

**Sprint:** VITRAS-INDICATORS-AND-OPERATIONAL-PRODUCTION-01  
**Status:** FASE 1 — Formalização dos indicadores existentes  
**Baseline:** RC3 congelado + ACCESS MODEL READY

---

## Princípio central

O VITRAS responde duas perguntas diferentes:

**Pergunta 1 — Responsabilidade territorial:**  
> Quem é territorialmente responsável por este paciente?  
→ `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent`, `referenceAcsIdAtEvent`

**Pergunta 2 — Produção operacional:**  
> Onde e por quem o atendimento foi realizado?  
→ `executingUnitId`, `executingTeamId`, `executingProfessionalId`

Esses conceitos nunca podem ser misturados. Toda atribuição passa pelo **IndicatorAttributionEngine** (`src/services/indicator-attribution-engine.js`).

---

## Classificação dos indicadores existentes

### I-01 — Visitas ACS: total/realizada/recusada/ausente

| Campo | Valor |
|-------|-------|
| Domínio | Territorial (ACS) |
| Evento fonte | `acsVisits` |
| Numerador | Contagem por `desfecho` no período |
| Filtro atual | `v.acsId === acsId` (executor) |
| Referência territorial | `referenceAcsIdAtEvent` (canonical) / `acsId` (legado) |
| Periodicidade | Configurável (hoje / semana / mês / trimestre / custom) |
| Arquivo | `src/services/production-metrics.js → getAcsMetrics()` |
| Endpoint | `GET /production/acs` |
| Classificação | **TERRITORIAL** (correto — ACS é executor territorial esperado) |
| Risco | Baixo. Cross-ACS visita não diferencia executor vs. territorial. |

---

### I-02 — Grupos visitados (cobertura)

| Campo | Valor |
|-------|-------|
| Domínio | Territorial (ACS) |
| Evento fonte | `familyGroups` por `assignedAcsId` |
| Numerador | Grupos com visita `realizada` no período |
| Filtro | `group.assignedAcsId === acsId` |
| Periodicidade | Configurável |
| Arquivo | `src/services/production-metrics.js → getAcsMetrics()` |
| Endpoint | `GET /production/acs` |
| Classificação | **TERRITORIAL** (correto) |
| Risco | Baixo. |

---

### I-03 — Score familiar (evaluateGroup)

| Campo | Valor |
|-------|-------|
| Domínio | Territorial (equipe) |
| Evento fonte | `familyGroups`, `acsVisits`, `tasks` |
| Cálculo | `evaluateGroup()` → 5 dimensões (visita, cadastro, CNS, endereço, tarefas) |
| Filtro | `group.teamId === teamId` (atual) |
| Periodicidade | Snapshot atual |
| Arquivo | `src/services/active-search.js → evaluateGroup()` |
| Endpoint | `GET /production/manager`, `GET /production/nurse` |
| Classificação | **TERRITORIAL** (AMBÍGUO: usa `group.teamId` atual — se grupo for transferido, histórico muda) |
| Risco | Médio. Transferências de grupo alteram retrosativamente o score da equipe anterior. Aceitável no piloto (transferências raras). |

---

### I-04 — Grupos críticos / atenção / saudável

| Campo | Valor |
|-------|-------|
| Domínio | Territorial (equipe) |
| Evento fonte | Derivado de I-03 |
| Filtro | `group.teamId === teamId` |
| Classificação | **TERRITORIAL** (idem I-03, mesmos riscos) |
| Endpoint | `GET /production/manager`, `GET /production/nurse` |
| Risco | Médio (idem I-03). |

---

### I-05 — Tasks done / overdue

| Campo | Valor |
|-------|-------|
| Domínio | Territorial (ACS) |
| Evento fonte | `tasks` via `patient.assignedAcsId` |
| Filtro | `task.patientId` → `patient.assignedAcsId === acsId` (atual) |
| Classificação | **TERRITORIAL** (LEGADO: usa referência atual do paciente, não referência na data da tarefa) |
| Risco | Baixo para piloto. Tarefas não têm `referenceAcsIdAtEvent`. |

---

### I-06 — Cadastros atualizados

| Campo | Valor |
|-------|-------|
| Domínio | Territorial (ACS) |
| Evento fonte | `patients` por `assignedAcsId` + `updatedAt` |
| Filtro | `p.assignedAcsId === acsId && inPeriod(p.updatedAt)` |
| Classificação | **TERRITORIAL** (LEGADO: usa referência atual) |
| Risco | Baixo. |

---

### I-07 — Atividade por ACS (perAcs)

| Campo | Valor |
|-------|-------|
| Domínio | Operacional (enfermeira vê produção de cada ACS) |
| Evento fonte | Via `getAcsMetrics` por ACS da equipe |
| Filtro | ACS com `teamId === teamId` |
| Classificação | **OPERACIONAL** (correto) |
| Endpoint | `GET /production/nurse` |
| Risco | Baixo. |

---

### I-08 — Cobertura de visita da equipe (%)

| Campo | Valor |
|-------|-------|
| Domínio | Territorial (equipe) |
| Evento fonte | `familyGroups` e `acsVisits` |
| Numerador | Grupos com visita `realizada` no período |
| Denominador | Total de grupos da equipe |
| Filtro | `g.teamId === teamId` (atual) |
| Classificação | **TERRITORIAL** (LEGADO: teamId atual) |
| Endpoint | `GET /production/manager` |
| Risco | Médio (idem I-03). |

---

### I-09 — Evolução temporal (trend)

| Campo | Valor |
|-------|-------|
| Domínio | Territorial (equipe) |
| Cálculo | Compara cobertura últimos 30d vs. 30d-60d |
| Classificação | **TERRITORIAL** (derivado de I-08) |
| Risco | Médio. |

---

### I-10 — Distribuição por microárea

| Campo | Valor |
|-------|-------|
| Domínio | Territorial (equipe) |
| Evento fonte | `familyGroups` por `microArea` |
| Filtro | `g.teamId === teamId` |
| Classificação | **TERRITORIAL** |
| Endpoint | `GET /production/microareas` |
| Risco | Baixo. |

---

### I-11 — Indicadores territoriais por UBS (ENGINE) ⭐ NOVO

| Campo | Valor |
|-------|-------|
| Domínio | Territorial (UBS) |
| Evento fonte | Todos: `acsVisits`, `agendaEntries`, `exams`, `examRequests`, `referrals`, `dentalEncounters`, `odontoProcedures`, `prescricoes`, `dispensacoes` |
| Atribuição | `referenceUnitIdAtEvent` (CANONICAL) → `unitId` (LEGACY_INFERRED_SAFE) → ignorado (LEGACY_AMBIGUOUS) |
| Filtro | `referenceUnitIdAtEvent === activeUnitId` |
| Periodicidade | Configurável |
| Arquivo | `src/services/indicator-attribution-engine.js` + `getUnitTerritorialMetrics()` |
| Endpoint | `GET /production/territorial` |
| Segurança | Gestor: scoped a `resolveActiveUnit(req)`. ACS/recep: 403. SupportAdmin: 403. |
| Classificação | **TERRITORIAL** (CANONICAL — motor único) |
| Risco | Baixo. Novo endpoint, não altera existentes. |

---

### I-12 — Produção operacional por UBS (ENGINE) ⭐ NOVO

| Campo | Valor |
|-------|-------|
| Domínio | Operacional (UBS) |
| Evento fonte | Mesmas coleções de I-11 |
| Atribuição | `executingUnitId` (CANONICAL) → `unitId` (LEGACY_INFERRED_SAFE) → ignorado (LEGACY_AMBIGUOUS) |
| Filtro | `executingUnitId === activeUnitId` |
| Periodicidade | Configurável |
| Arquivo | `src/services/indicator-attribution-engine.js` + `getUnitOperationalMetrics()` |
| Endpoint | `GET /production/operational` |
| Segurança | Idem I-11 |
| Classificação | **OPERACIONAL** (CANONICAL — motor único) |
| Risco | Baixo. |

---

## Gaps identificados (SHOULD HAVE / pós-piloto)

| # | Gap | Coleção | Ação futura |
|---|-----|---------|-------------|
| G-01 | Consultas médicas não aparecem em I-01 a I-10 | `agendaEntries` | Expor via I-11/I-12 |
| G-02 | Exames não aparecem | `exams`, `examRequests` | Idem |
| G-03 | Referrals não aparecem | `referrals` | Idem |
| G-04 | Atendimentos odonto não aparecem | `dentalEncounters`, `odontoProcedures` | Idem |
| G-05 | Dispensações não aparecem | `dispensacoes` | Idem |
| G-06 | Prescrições não aparecem | `prescricoes` | Idem |
| G-07 | Produção por profissional individual | — | GOV-01 separado |
| G-08 | Indicadores clínicos (pré-natal %, HAS, DM) | — | GOV-01 separado + definição clínica |

---

## Legados ambíguos

Eventos sem `referenceUnitIdAtEvent` e sem `unitId`:
- Classificação: `LEGACY_AMBIGUOUS`
- Não contados em `total`
- Contados em `ambiguous` (visibilidade, não precisão falsa)
- Não recalculados retroativamente

---

## Motor de atribuição

**Arquivo:** `src/services/indicator-attribution-engine.js`

Funções públicas:
- `resolveTerritory(event)` → `{ unitId, teamId, acsId, source }`
- `resolveOperation(event)` → `{ unitId, teamId, professionalId, source }`
- `collectAllEvents(db, from, to)` → eventos tagueados de todas as coleções
- `countTerritorialForUnit(events, unitId)` → `{ total, canonical, legacyInferred, ambiguous }`
- `countTerritorialForTeam(events, teamId)` → idem
- `countTerritorialForAcs(events, acsId)` → idem
- `countOperationalForUnit(events, unitId)` → idem
- `countOperationalForTeam(events, teamId)` → idem
- `countOperationalForProfessional(events, professionalId)` → idem
- `territorialBreakdownByType(events, unitId)` → `{ acsVisit: N, agendaEntry: N, ... }`
- `operationalBreakdownByType(events, unitId)` → idem

**Regra:** Nenhum consumidor implementa lógica de atribuição. Todos chamam o engine.

---

_Documento gerado em: 2026-08-07 | Próxima revisão: pré-GA_
