# Console Nacional — CMDB v1.0

**Módulo:** ERP-10  
**Service:** `backend/src/services/cmdb.js`  
**Freeze:** 2026-08-08

---

## Tipos de CI (CI_TYPE)

23 tipos disponíveis:

`PLATFORM`, `MUNICIPALITY`, `UNIT`, `TEAM`, `DEPLOYMENT`, `LICENSE`, `RELEASE`, `ROLL_OUT`,  
`BACKUP_POLICY`, `BACKUP_EXECUTION`, `RESTORE_TEST`, `INCIDENT`, `POLICY`, `BASELINE`, `ADR`,  
`MAINTENANCE_WINDOW`, `DATABASE`, `API`, `AUTH_SERVICE`, `STORAGE`, `SCHEDULER`, `INTEGRATION`, `CUSTOM`

---

## Criticidade (CRITICALITY)

`LOW` → `MEDIUM` → `HIGH` → `CRITICAL` → `MISSION_CRITICAL`

---

## Tipos de relacionamento (REL_TYPE)

| Tipo | Inverso |
|------|---------|
| DEPENDS_ON | DEPENDENCY_OF |
| USES | USED_BY |
| HOSTED_ON | HOSTS |
| OWNED_BY | OWNS |
| IMPLEMENTS | IMPLEMENTED_BY |
| GENERATED_BY | GENERATES |
| PROTECTED_BY | PROTECTS |
| SUPERSEDES | SUPERSEDED_BY |
| RELATED_TO | RELATED_TO |

---

## Status do CI

```
PLANNED → ACTIVE → MAINTENANCE → ACTIVE
                  → SUSPENDED  → ACTIVE
                  → RETIRED    → ARCHIVED
         → ARCHIVED (terminal)
PLANNED → ARCHIVED
SUSPENDED → ARCHIVED
```

---

## Impact Analysis Engine

- Algoritmo: BFS (Breadth-First Search)
- Entrada: `ciId` de um CI que falhou
- Saída: lista de CIs afetados, ordenados por criticidade (MISSION_CRITICAL primeiro) e profundidade
- Arestas percorridas: `DEPENDS_ON`, `USES`, `HOSTED_ON`, `IMPLEMENTS`, `PROTECTED_BY`
- Prevenção de ciclos: `visited Set` — nenhum CI visitado duas vezes
- `maxDepth` configurável (padrão 10, máximo 20 via query param)

---

## Restrições operacionais (GOV-01)

**NÃO IMPLEMENTADO e NÃO SERÁ IMPLEMENTADO:**
- Discovery automático
- SSH / execução remota
- Agentes de inventário
- Monitoramento de infraestrutura
- Alterações em infraestrutura via CMDB
- Dados clínicos
- Integrações externas automáticas

**CMDB é somente registro e análise — nenhuma ação executada.**

---

## Código de CI

Formato: `CI-YYYY-NNNN` (sequencial por ano)  
Formato rel: `REL-YYYY-NNNN` (sequencial por ano)

---

## Dashboard

Campos retornados por `GET /platform/cmdb/dashboard`:

```json
{
  "total": 0,
  "active": 0,
  "maintenance": 0,
  "retiredArchived": 0,
  "missionCritical": 0,
  "critical": 0,
  "totalRelationships": 0,
  "byType": {},
  "byCriticality": {},
  "topHubs": [],
  "generatedAt": "ISO8601"
}
```

`topHubs`: top 5 CIs por número de relacionamentos (hubs de dependência).
