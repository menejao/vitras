// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Modelo Canônico de Atribuição em Eventos Clínicos

**Sprint:** VITRAS-CLINICAL-EVENT-ATTRIBUTION-01  
**Status:** IMPLEMENTADO (FASES 2-9 concluídas, commit be3bfaa)  
**Aprovação GOV-01:** GO WITH LIMITS (2026-08-07)

---

## Problema central

Em um sistema multi-UBS com paciente global municipal, cada evento clínico
levanta duas perguntas independentes:

1. **Quem é responsável territorialmente pelo paciente?**  
   → campos `reference*` — congelados no momento do evento

2. **Onde o evento aconteceu?**  
   → campos `executing*` — resolvidos do contexto autenticado do servidor

Antes desta sprint, a maioria dos eventos respondia apenas uma das perguntas
(ou nenhuma), tornando auditoria e isolamento multi-UBS parcialmente cegos.

---

## Campos canônicos

### Execução (onde aconteceu)

| Campo | Fonte | Resolução |
|---|---|---|
| `executingUnitId` | JWT (`req.user.unitId`) | `resolveActiveUnit(req)` — sempre servidor |
| `executingTeamId` | JWT (`req.user.teamId`) | `String(req.user.teamId \|\| "")` |
| `executingProfessionalId` | JWT (`req.user.id`) | ID canônico do profissional executor |

### Referência no momento (quem era responsável)

| Campo | Fonte | Resolução |
|---|---|---|
| `referenceUnitIdAtEvent` | `patient.referenceUnitId \|\| patient.unitId` | UBS de referência territorial do paciente |
| `referenceTeamIdAtEvent` | `patient.teamId` | equipe de referência do paciente |
| `referenceAcsIdAtEvent` | `patient.assignedAcsId` | ACS responsável (somente acsVisits) |
| `municipalityId` | `patient.municipalityId` | município — nunca do cliente |

### Campo legado (preservado)

| Campo | Semântica histórica | Será removido? |
|---|---|---|
| `teamId` | referência ou execução (ambíguo) | NÃO — legado preservado indefinidamente |

---

## Estado por coleção (pós-implementação)

| Coleção | executingUnitId | executingTeamId | executingProfessionalId | referenceUnitIdAtEvent | referenceTeamIdAtEvent | municipalityId | Notas |
|---|---|---|---|---|---|---|---|
| `clinicalRecords` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | COMPLETO desde Sprint RC1 |
| `acsVisits` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | + referenceAcsIdAtEvent |
| `agendaEntries` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `exams` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `examRequests` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `referrals` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `dentalEncounters` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `odontoProcedures` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `prescricoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | origem: medicina e odontologia |
| `dispensacoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `tasks` | — | ✓ | — | — | — | ✓ | unitId (não executingUnitId) — gestão |
| `queueEntries` | ✓ | — | — | — | — | — | parcial — aguarda FASE futura |

---

## Regra de resolução (invariante obrigatório)

**`municipalityId`, `executingUnitId`, `executingTeamId`** são SEMPRE resolvidos
do JWT autenticado no servidor. Qualquer valor enviado pelo cliente no body ou
query é ignorado. Isso é garantido por `resolveActiveUnit(req)` e acesso
direto a `req.user.*`.

Código de referência:
```javascript
// utils/helpers.js
function resolveActiveUnit(req) {
  return String(req.user?.unitId || "");
}

// Em qualquer rota de criação
executingUnitId: resolveActiveUnit(req),          // server-side only
municipalityId: String(patient.municipalityId || ""), // from patient, not body
```

---

## cds-export.js — isolamento multi-UBS para acsVisits (RISCO-01)

**Antes:** verificação usava `visit.unitId` (campo nunca escrito em acsVisits) →
isolamento nunca ativava → qualquer UBS podia exportar visita de outra.

**Depois (commit be3bfaa, linha 347):**
```javascript
const visitUnitId = visit.executingUnitId || visit.unitId;
if (!visit || (!isBreakGlass && activeUnitId && visitUnitId && visitUnitId !== activeUnitId)) {
  return res.status(404).json({ error: "Visita não encontrada." });
}
```

- Registros novos: `executingUnitId` presente → isolamento ativado.
- Registros legados (sem `executingUnitId`, sem `unitId`): `visitUnitId = undefined`
  → condição falsy → isolamento não ativado → backward compat preservado.
- `break_glass_admin`: bypassa isolamento (`isBreakGlass = true`).

---

## Migration-022

`backend/scripts/migration-022-event-attribution.mjs`

Backfill idempotente dos campos de atribuição em todos os registros existentes.
Usa profissional (via `acsId`/`doctorId`/etc.) para resolver `executingUnitId`
e `executingTeamId`; usa `patient` para campos `reference*`.

```bash
# Dry run (padrão)
node --env-file=.env scripts/migration-022-event-attribution.mjs

# Aplicar
node --env-file=.env scripts/migration-022-event-attribution.mjs UP

# Rollback
node --env-file=.env scripts/migration-022-event-attribution.mjs DOWN
```

---

## Pendente

- `queueEntries`: `executingTeamId`, `executingProfessionalId`, `referenceAtEvent`, `municipalityId`
- `tasks`: `referenceUnitIdAtEvent`, `referenceTeamIdAtEvent` (tarefas são administrativas, não clínicas)
- Mecanismo de "snapshot congelado" quando `referenceUnitId` muda (paciente transferido)
- Dashboard de auditoria usando campos canônicos
