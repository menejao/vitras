# ERD

## Objetivo
Fornecer diagrama textual consolidado do modelo relacional e lógico atual do VITRAS.

## Escopo
Entidades centrais clínicas, territoriais, segurança e platform.

## Pré-requisitos
- `backend/src/db.js`
- `backend/src/migrations/*`

## Descrição
ERD abaixo combina entidades materializadas em SQL com agregados persistidos em JSONB, para leitura arquitetural completa.

```mermaid
erDiagram
  MUNICIPALITY {
    uuid id
    string ibge_code
    string name
    string uf
    string region
    boolean active
  }
  UNIT {
    string id
    string cnes
    string municipalityId
    string name
    string status
  }
  TEAM {
    uuid id
    string unitId
    string name
    string managerUserId
  }
  USER {
    uuid id
    string vitrasId
    string role
    string teamId
    string unitId
    string municipalityId
  }
  PATIENT {
    uuid id
    string teamId
    string unitId
    string municipalityId
    string assignedAcsId
    boolean inactive
  }
  CLINICAL_RECORD {
    uuid id
    uuid patientId
    string type
    string status
    uuid createdBy
  }
  APPOINTMENT {
    uuid id
    uuid patientId
    string teamId
    string status
  }
  EXAM {
    uuid id
    uuid patientId
    string teamId
    string status
  }
  REFERRAL {
    uuid id
    uuid patientId
    string teamId
    string status
  }
  TASK {
    uuid id
    uuid patientId
    string teamId
    uuid assignedTo
    string status
  }
  HOUSEHOLD {
    uuid id
    uuid patientId
    string teamId
    string microarea
  }
  ACS_VISIT {
    uuid id
    uuid patientId
    uuid householdId
    uuid acsId
  }
  FAMILY_GROUP {
    uuid id
    string teamId
    uuid acsId
  }
  AUDIT_LOG {
    uuid id
    uuid userId
    string action
    string entityType
    string entityId
  }
  BREAK_GLASS_SESSION {
    uuid id
    uuid activatedBy
    uuid patientId
    string unitId
    string municipalityId
  }
  REFRESH_TOKEN {
    uuid id
    uuid userId
    uuid sessionId
  }
  ACCESS_REQUEST {
    uuid id
    string email
    string status
  }
  PRIVACY_REQUEST {
    uuid id
    uuid patientId
    string status
    string type
  }

  MUNICIPALITY ||--o{ UNIT : contains
  UNIT ||--o{ TEAM : contains
  UNIT ||--o{ USER : allocates
  UNIT ||--o{ PATIENT : serves
  TEAM ||--o{ USER : groups
  TEAM ||--o{ PATIENT : references
  USER ||--o{ TASK : assigned
  USER ||--o{ AUDIT_LOG : performs
  USER ||--o{ REFRESH_TOKEN : owns
  PATIENT ||--o{ CLINICAL_RECORD : has
  PATIENT ||--o{ APPOINTMENT : has
  PATIENT ||--o{ EXAM : has
  PATIENT ||--o{ REFERRAL : has
  PATIENT ||--o{ TASK : has
  PATIENT ||--o{ PRIVACY_REQUEST : targets
  PATIENT ||--o{ BREAK_GLASS_SESSION : justifies
  HOUSEHOLD ||--o{ ACS_VISIT : receives
```

## Status
- ERD lógico completo: IMPLEMENTADO neste documento
- ERD físico 100% relacional: PARCIAL, porque fonte principal segue híbrida JSONB + projeções

## Referências internas
- `backend/src/db.js`
- `docs/ai/entities-map.md`

## Arquivos relacionados
- `docs/04-data-model/DATA-MODEL.md`
