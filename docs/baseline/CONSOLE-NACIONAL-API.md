# Console Nacional — API Reference v1.0

**Base path:** `/api/platform`  
**Auth:** `Authorization: Bearer <token>` (support_admin)  
**Freeze:** 2026-08-08 — nenhum endpoint pode ser adicionado sem novo GOV-01.

---

## ERP-02 — Municípios

| Método | Path | Capability |
|--------|------|-----------|
| GET | /platform/municipalities | platform.unit.read |
| GET | /platform/municipalities/:id | platform.unit.read |
| GET | /platform/municipalities/:id/health | platform.unit.read |
| GET | /platform/summary | platform.unit.read |

---

## ERP-03 — Deployments

| Método | Path | Capability |
|--------|------|-----------|
| GET | /platform/deployments | platform.unit.read |
| GET | /platform/deployments/:id | platform.unit.read |
| GET | /platform/deployments-dashboard | platform.unit.read |
| POST | /platform/deployments | platform.unit.create |
| PATCH | /platform/deployments/:id | platform.unit.update |
| PATCH | /platform/deployments/:id/checklist/:itemId | platform.unit.update |
| POST | /platform/deployments/:id/advance | platform.unit.update |
| POST | /platform/deployments/:id/pause | platform.unit.update |
| POST | /platform/deployments/:id/resume | platform.unit.update |
| POST | /platform/deployments/:id/cancel | platform.unit.update |
| POST | /platform/deployments/:id/suspend | platform.unit.update |
| POST | /platform/deployments/:id/assign | platform.unit.update |

---

## ERP-04 — Licenciamento

| Método | Path | Capability |
|--------|------|-----------|
| GET | /platform/licenses | platform.unit.read |
| GET | /platform/licenses/:id | platform.unit.read |
| GET | /platform/licenses-dashboard | platform.unit.read |
| GET | /platform/plan-templates | platform.unit.read |
| GET | /platform/customers | platform.unit.read |
| GET | /platform/customers/:id | platform.unit.read |
| POST | /platform/licenses | platform.unit.create |
| PATCH | /platform/licenses/:id | platform.unit.update |
| POST | /platform/licenses/:id/renew | platform.unit.update |
| POST | /platform/licenses/:id/status | platform.unit.update |
| POST | /platform/customers | platform.unit.create |
| POST | /platform/customers/:id/status | platform.unit.update |

---

## ERP-05 — Incidentes

| Método | Path | Capability |
|--------|------|-----------|
| GET | /platform/incidents | platform.unit.read |
| GET | /platform/incidents/:id | platform.unit.read |
| GET | /platform/incidents-dashboard | platform.unit.read |
| GET | /platform/incident-categories | platform.unit.read |
| POST | /platform/incidents | platform.unit.create |
| PATCH | /platform/incidents/:id | platform.unit.update |
| PATCH | /platform/incidents/:id/status | platform.unit.update |
| PATCH | /platform/incidents/:id/severity | platform.unit.update |
| PATCH | /platform/incidents/:id/assign | platform.unit.update |
| POST | /platform/incidents/:id/comment | platform.unit.update |
| POST | /platform/incidents/:id/close | platform.unit.update |
| POST | /platform/incidents/:id/reopen | platform.unit.update |

---

## ERP-06 — Observabilidade

| Método | Path | Capability |
|--------|------|-----------|
| GET | /platform/health | platform.health.read |
| GET | /platform/alerts | platform.unit.read |
| POST | /platform/alerts | platform.unit.create |
| POST | /platform/alerts/:id/ack | platform.unit.update |
| POST | /platform/alerts/:id/resolve | platform.unit.update |
| GET | /platform/diagnostics | platform.unit.read |
| POST | /platform/diagnostics/run | platform.unit.update |
| GET | /platform/dashboard | platform.unit.read |
| GET | /platform/units/:id/health | platform.unit.read |

---

## ERP-07 — Releases

| Método | Path | Capability |
|--------|------|-----------|
| GET | /platform/releases | platform.unit.read |
| GET | /platform/releases/:id | platform.unit.read |
| GET | /platform/releases-dashboard | platform.unit.read |
| GET | /platform/changelog | platform.unit.read |
| GET | /platform/rollouts | platform.unit.read |
| GET | /platform/migrations | platform.unit.read |
| GET | /platform/maintenance | platform.unit.read |
| POST | /platform/releases | platform.unit.create |
| PATCH | /platform/releases/:id | platform.unit.update |
| PATCH | /platform/releases/:id/status | platform.unit.update |
| POST | /platform/rollouts | platform.unit.create |
| PATCH | /platform/rollouts/:id/status | platform.unit.update |
| POST | /platform/migrations | platform.unit.create |
| POST | /platform/maintenance | platform.unit.create |
| PATCH | /platform/maintenance/:id | platform.unit.update |

---

## ERP-08 — Backup & Continuidade

| Método | Path | Capability |
|--------|------|-----------|
| GET | /platform/backup-policies | platform.unit.read |
| GET | /platform/backup-policies/:id | platform.unit.read |
| GET | /platform/backup-dashboard | platform.unit.read |
| GET | /platform/backups | platform.unit.read |
| GET | /platform/restore-tests | platform.unit.read |
| GET | /platform/business-continuity | platform.unit.read |
| POST | /platform/backup-policies | platform.unit.create |
| PATCH | /platform/backup-policies/:id | platform.unit.update |
| POST | /platform/backups | platform.unit.create |
| POST | /platform/restore-tests | platform.unit.create |
| PATCH | /platform/restore-tests/:id | platform.unit.update |

---

## ERP-09 — Governança & Compliance

| Método | Path | Capability |
|--------|------|-----------|
| GET | /platform/baselines | platform.unit.read |
| GET | /platform/baselines/:id | platform.unit.read |
| GET | /platform/adrs | platform.unit.read |
| GET | /platform/adrs/:id | platform.unit.read |
| GET | /platform/policies | platform.unit.read |
| GET | /platform/policies/:id | platform.unit.read |
| GET | /platform/exceptions | platform.unit.read |
| GET | /platform/compliance | platform.unit.read |
| GET | /platform/governance-dashboard | platform.unit.read |
| POST | /platform/baselines | platform.unit.create |
| PATCH | /platform/baselines/:id/status | platform.unit.update |
| POST | /platform/adrs | platform.unit.create |
| PATCH | /platform/adrs/:id/status | platform.unit.update |
| POST | /platform/policies | platform.unit.create |
| PATCH | /platform/policies/:id | platform.unit.update |
| PATCH | /platform/policies/:id/activate | platform.unit.update |
| POST | /platform/exceptions | platform.unit.create |
| PATCH | /platform/exceptions/:id/status | platform.unit.update |

---

## ERP-10 — CMDB

| Método | Path | Capability |
|--------|------|-----------|
| GET | /platform/cmdb/items | platform.unit.read |
| GET | /platform/cmdb/items/:id | platform.unit.read |
| GET | /platform/cmdb/relationships | platform.unit.read |
| GET | /platform/cmdb/impact/:id | platform.unit.read |
| GET | /platform/cmdb/search | platform.unit.read |
| GET | /platform/cmdb/dashboard | platform.unit.read |
| POST | /platform/cmdb/items | platform.unit.create |
| PATCH | /platform/cmdb/items/:id | platform.unit.update |
| POST | /platform/cmdb/relationships | platform.unit.create |
| DELETE | /platform/cmdb/relationships/:id | platform.unit.update |

---

**Total endpoints congelados:** 121  
**Todos protegidos por RBAC:** ✅
