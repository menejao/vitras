# Console Nacional — Modelo de Dados v1.0

**Freeze:** 2026-08-08  
**Storage:** JSON file DB (`data/db.json`) — coleções separadas por módulo.

---

## Coleções ERP (db.json)

| Coleção | Módulo | Inicializada por |
|---------|--------|-----------------|
| `municipalities` | ERP-02 | ensureMunicipalities |
| `deployments` | ERP-03 | ensureDeployments |
| `licenses` | ERP-04 | ensureLicenses |
| `customers` | ERP-04 | ensureLicenses |
| `incidents` | ERP-05 | ensureIncidents |
| `platformAlerts` | ERP-06 | ensureAlerts |
| `platformDiagnostics` | ERP-06 | ensureAlerts |
| `releases` | ERP-07 | ensureReleases |
| `rollouts` | ERP-07 | ensureReleases |
| `migrationLogs` | ERP-07 | ensureReleases |
| `maintenanceWindows` | ERP-07 | ensureReleases |
| `backupPolicies` | ERP-08 | ensureBackup |
| `backupExecutions` | ERP-08 | ensureBackup |
| `restoreTests` | ERP-08 | ensureBackup |
| `govBaselines` | ERP-09 | ensureGov |
| `govAdrs` | ERP-09 | ensureGov |
| `govPolicies` | ERP-09 | ensureGov |
| `govExceptions` | ERP-09 | ensureGov |
| `cmdbItems` | ERP-10 | ensureCmdb |
| `cmdbRelationships` | ERP-10 | ensureCmdb |

---

## Invariantes de dados

- Nenhuma coleção ERP referencia `patients`, `acsVisits`, `familyGroups`, `households`.
- Todas as coleções têm `createdAt` / `updatedAt` em ISO 8601.
- Todas as entidades com estado têm `audit[]` append-only.
- Entidades com lifecycle têm `timeline[]` append-only.
- Codes gerados sequencialmente: CI-YYYY-NNNN, REL-YYYY-NNNN, BKP-YYYY-NNNN, EXC-YYYY-NNNN, RST-YYYY-NNNN, BAS-YYYY-NNNN, ADR-YYYY-NNNN, POL-YYYY-NNNN.

---

## Campos ausentes (garantia de não-exposição clínica)

Os seguintes campos NÃO existem em nenhuma entidade ERP:

`patientId`, `cpf`, `cns`, `prontuario`, `cid10`, `ciap2`, `medicamento`,  
`prescricao`, `atendimento`, `acsVisitId`, `familyGroupId`, `householdId`.

---

## Máquinas de estado

### Release
`DRAFT → REVIEW → APPROVED → ACTIVE → STABLE → DEPRECATED`

### Rollout
`PENDING → IN_PROGRESS → COMPLETED | ROLLED_BACK | PAUSED`

### BackupPolicy
`enabled: true/false` (toggle via updateBackupPolicy)

### BackupExecution
`SCHEDULED → RUNNING → COMPLETED | FAILED | SKIPPED | CANCELLED`

### RestoreTest
`PLANNED → IN_PROGRESS → COMPLETED | FAILED | CANCELLED`

### Baseline
`DRAFT → REVIEW → APPROVED → SUPERSEDED`

### ADR
`PROPOSED → ACCEPTED | REJECTED → SUPERSEDED`

### Policy
`DRAFT → ACTIVE | EXPIRING | EXPIRED | ARCHIVED` (status computado)

### Exception
`PENDING → APPROVED | REJECTED → REVOKED | EXPIRED` (terminal: REVOKED, EXPIRED, REJECTED)

### CI (CMDB)
`PLANNED → ACTIVE → MAINTENANCE | SUSPENDED → RETIRED → ARCHIVED`

### Deployment
`PLANNED → IN_PROGRESS → PAUSED | SUSPENDED → COMPLETED | CANCELLED`

### Incident
`OPEN → IN_PROGRESS → RESOLVED → CLOSED | REOPENED`

### License
Estado: `ACTIVE | SUSPENDED | CANCELLED | EXPIRED | TRIAL`
