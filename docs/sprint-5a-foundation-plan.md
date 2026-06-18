# Sprint 5A Foundation Plan

| Campo | Valor |
|---|---|
| Data | 2026-06-10 |
| Status | PLANEJAMENTO — aprovado para execucao |
| Baseline | v1.0-pilot-governed (commit d20add9) |
| Proxima branch | `feat/sprint-5a-esus-fields` (a partir de `main`) |
| Autor | Tech Lead |

---

## 1. Silent Data Loss

### 1.1 Campos afetados

`PatientUpdateSchema.strict()` em `backend/src/schemas.js:103` rejeita qualquer chave nao declarada no schema. O modal de pacientes (`frontend-react/src/hooks/usePatientModal.js:118-148`) envia os seguintes campos que nao existem em `PatientUpdateSchema`:

| Campo enviado pelo frontend | Linha no modal | Situacao |
|---|---|---|
| `motherUnknown` | 121 | ausente de PatientBaseShape e PatientUpdateSchema |
| `birthCity` | 124 | ausente de PatientBaseShape e PatientUpdateSchema |
| `birthState` | 124 | ausente de PatientBaseShape e PatientUpdateSchema |
| `zipCode` | 129 | ausente de PatientBaseShape e PatientUpdateSchema |
| `number` | 129 | ausente de PatientBaseShape e PatientUpdateSchema |
| `complement` | 130 | ausente de PatientBaseShape e PatientUpdateSchema |
| `neighborhood` | 130 | ausente de PatientBaseShape e PatientUpdateSchema |
| `city` | 131 | ausente de PatientBaseShape e PatientUpdateSchema |
| `state` | 131 | ausente de PatientBaseShape e PatientUpdateSchema |
| `sex` | 132 | BUG — schema usa `sexAtBirth` (ver 1.4) |
| `raceColor` | 132 | ausente de PatientBaseShape e PatientUpdateSchema |
| `familyCode` | 134 | ausente de PatientBaseShape e PatientUpdateSchema |
| `homeVisitFreq` | 135 | ausente de PatientBaseShape e PatientUpdateSchema |
| `housingType` | 135 | ausente de PatientBaseShape e PatientUpdateSchema |
| `waterSupply` | 136 | ausente de PatientBaseShape e PatientUpdateSchema |
| `sewage` | 136 | ausente de PatientBaseShape e PatientUpdateSchema |
| `garbage` | 137 | ausente de PatientBaseShape e PatientUpdateSchema |
| `electricity` | 137 | ausente de PatientBaseShape e PatientUpdateSchema |
| `educationLevel` | 144 | ausente de PatientBaseShape e PatientUpdateSchema |
| `occupation` | 144 | ausente de PatientBaseShape e PatientUpdateSchema |
| `familySituation` | 145 | ausente de PatientBaseShape e PatientUpdateSchema |
| `familySupport` | 145 | ausente de PatientBaseShape e PatientUpdateSchema |
| `socialVulnerability` | 146 | ausente de PatientBaseShape e PatientUpdateSchema |
| `socialBenefit` | 146 | ausente de PatientBaseShape e PatientUpdateSchema |
| `substanceDependency` | 147 | ausente de PatientBaseShape e PatientUpdateSchema |
| `domesticViolence` | 147 | ausente de PatientBaseShape e PatientUpdateSchema |

Total: 26 campos descartados silenciosamente a cada POST/PATCH de paciente.

### 1.2 Impacto

Todos os dados demograficos e-SUS, condicoes de moradia e vulnerabilidade social preenchidos no modal nunca chegam ao banco. O usuario nao recebe erro — a operacao retorna 200 ou 201. Os dados sao irrecuperapeis para registros ja criados (nao ha log dos valores descartados). Campos como `raceColor` (raca/cor), `educationLevel` (escolaridade) e `housingType` (tipo de moradia) sao obrigatorios na Ficha de Cadastro Individual do e-SUS.

### 1.3 Correcao recomendada

**Estrategia: expandir `PatientBaseShape` e `PatientUpdateSchema` com todos os campos legitimos. Manter `.strict()`.**

Nao remover o `.strict()` — a diretiva D-02 (`schemas.js:65`) protege contra mass-assignment de campos internos e deve ser preservada. A correcao correta e declarar explicitamente cada campo legítimo no schema.

Campos a adicionar em `PatientBaseShape` (`schemas.js:24-62`) e espelhar em `PatientUpdateSchema` (`schemas.js:66-103`):

```
motherUnknown:       z.boolean().optional()
birthCity:           optionalShortString(200)
birthState:          optionalShortString(2)
zipCode:             optionalShortString(10)
number:              optionalShortString(20)
complement:          optionalShortString(100)
neighborhood:        optionalShortString(200)
city:                optionalShortString(200)
state:               optionalShortString(2)
raceColor:           optionalShortString(80)
familyCode:          optionalShortString(80)
homeVisitFreq:       optionalShortString(50)
housingType:         optionalShortString(80)
waterSupply:         optionalShortString(80)
sewage:              optionalShortString(80)
garbage:             optionalShortString(80)
electricity:         optionalShortString(80)
educationLevel:      optionalShortString(80)
occupation:          optionalShortString(200)
familySituation:     optionalShortString(200)
familySupport:       optionalShortString(200)
socialVulnerability: optionalShortString(200)
socialBenefit:       optionalShortString(200)
substanceDependency: optionalShortString(200)
domesticViolence:    optionalShortString(200)
```

Armazenamento automatico no payload JSONB de `app_patients` pela logica de patch existente. Nenhuma migration de coluna shadow e necessaria para estes campos em Sprint 5A.

### 1.4 Bug sexAtBirth vs sex

**Causa raiz:** `frontend-react/src/hooks/usePatientModal.js:132` envia `sex: form.sex.trim()`. O schema declara `sexAtBirth` (`PatientBaseShape` em `schemas.js:45`; `PatientUpdateSchema` em `schemas.js:86`). O `.strict()` descarta `sex` — `sexAtBirth` nunca e persistido via modal.

**Correcao (Opcao A — recomendada):** Corrigir o frontend.
- Em `usePatientModal.js:132`, substituir `sex: form.sex.trim()` por `sexAtBirth: form.sex.trim()`.
- Revisar `buildPatientFormState` no mesmo arquivo (linhas ~30-60) para ler `p?.sexAtBirth` ao carregar paciente para edicao, e nao `p?.sex`.

**Correcao alternativa (Opcao B):** Adicionar `sex` como alias no `PatientBaseShape` com `.transform()` mapeando para `sexAtBirth`. Nao recomendada — aumenta complexidade do schema.

A Opcao A e o patch minimo. Nao ha dados `sexAtBirth` salvos em registros existentes (o bug impede qualquer gravacao), portanto nao ha colisao de dados.

---

## 2. Schema e-SUS — Campos do Paciente

### 2.1 Campos existentes e corretos

Presentes e funcionais em `PatientBaseShape` (`schemas.js:24-62`) e `PatientUpdateSchema` (`schemas.js:66-103`):

`name` (l.25), `motherName` (l.26), `guardianName` (l.27), `phone` (l.28), `phoneAlt` (l.29), `cpf` (l.30), `cns` (l.31), `cnsCpf` (l.32), `address` (l.33), `microArea` (l.34), `assignedAcsId` (l.35), `teamId` (l.36, apenas create), `careCategory` (l.37), `chronicConditions` (l.38), `maritalStatus` (l.39), `incompleteProfile` (l.40), `inactive` (l.41), `inactivationReason` (l.42), `inactivatedBy` (l.43), `inactivatedAt` (l.44), `sexAtBirth` (l.45), `genderIdentity` (l.46), `birthDate` (l.47), `pregnancyStartDate` (l.48), `expectedDeliveryDate` (l.49), campos gestacionais (l.50-56), `usgDate1-3` (l.54-56), `prenatalStartDate` (l.57), `postpartumStartDate` (l.58), `comorbidities` (l.59), `medications` (l.60), `allergies` (l.61).

### 2.2 Campos existentes com problema

| Campo | Arquivo:linha | Problema | Acao Sprint 5A |
|---|---|---|---|
| `sexAtBirth` | `schemas.js:45` e `schemas.js:86` | Modal envia `sex` — campo nunca recebe valor | Corrigir frontend (`usePatientModal.js:132`) |
| `genderIdentity` | `schemas.js:46` e `schemas.js:87` | No schema, ausente do modal — nunca enviado | Adicionar ao modal em Sprint 5A ou 5B |
| `prenatalStartDate` | `schemas.js:57` e `schemas.js:98` | No schema, ausente do modal | Adicionar ao modal em Sprint 5B |
| `postpartumStartDate` | `schemas.js:58` e `schemas.js:99` | No schema, ausente do modal | Adicionar ao modal em Sprint 5B |

### 2.3 Campos a adicionar em Sprint 5A

Todos sao adicionados a `PatientBaseShape` (`schemas.js:24`) e ao `PatientUpdateSchema` (`schemas.js:66`). Armazenamento via payload JSONB existente.

| Campo | Tipo Zod | Enum values (string livre em 5A, enum estrito em 5B) | Nullable | Obrigatorio e-SUS? |
|---|---|---|---|---|
| `raceColor` | `optionalShortString(80)` | branca, preta, parda, amarela, indigena, nao_informado | sim | sim (Ficha Cadastro Individual) |
| `educationLevel` | `optionalShortString(80)` | sem_escolaridade, fundamental_incompleto, fundamental_completo, medio_incompleto, medio_completo, superior_incompleto, superior_completo, nao_informado | sim | sim |
| `situacaoDeRua` | `z.boolean().optional()` | true / false | sim | sim (Ficha Populacao de Rua) — **ATENCAO: campo ausente do payload do modal; adicionar em `usePatientModal.js` alem do schema** |
| `birthCity` | `optionalShortString(200)` | — | sim | sim (demografico) |
| `birthState` | `optionalShortString(2)` | UF 2 letras | sim | sim (demografico) |
| `zipCode` | `optionalShortString(10)` | — | sim | nao (endereco estruturado) |
| `number` | `optionalShortString(20)` | — | sim | nao |
| `complement` | `optionalShortString(100)` | — | sim | nao |
| `neighborhood` | `optionalShortString(200)` | — | sim | nao |
| `city` | `optionalShortString(200)` | — | sim | nao |
| `state` | `optionalShortString(2)` | UF 2 letras | sim | nao |
| `familyCode` | `optionalShortString(80)` | — | sim | sim (prontuario familiar) |
| `homeVisitFreq` | `optionalShortString(50)` | semanal, quinzenal, mensal, bimestral, trimestral | sim | nao |
| `housingType` | `optionalShortString(80)` | — | sim | sim (condicoes moradia) |
| `waterSupply` | `optionalShortString(80)` | — | sim | sim (saneamento) |
| `sewage` | `optionalShortString(80)` | — | sim | sim (saneamento) |
| `garbage` | `optionalShortString(80)` | — | sim | sim (saneamento) |
| `electricity` | `optionalShortString(80)` | — | sim | nao |
| `occupation` | `optionalShortString(200)` | — | sim | sim (psicossocial) |
| `familySituation` | `optionalShortString(200)` | — | sim | sim (psicossocial) |
| `familySupport` | `optionalShortString(200)` | — | sim | nao |
| `socialVulnerability` | `optionalShortString(200)` | — | sim | nao |
| `socialBenefit` | `optionalShortString(200)` | — | sim | nao |
| `substanceDependency` | `optionalShortString(200)` | — | sim | nao |
| `domesticViolence` | `optionalShortString(200)` | — | sim | nao |
| `motherUnknown` | `z.boolean().optional()` | — | sim | nao (helper UI) |

Nota: usar `optionalShortString` (string livre) em 5A para nao quebrar retrocompatibilidade com valores possivelmente ja digitados. Enums estritos em Sprint 5B apos levantamento dos vocabularios controlados do municipio.

### 2.4 Campos postergados (Sprint 5B/6)

| Campo | Motivo |
|---|---|
| `sexualOrientation` | Dado senssivel LGPD art. 11 — requer politica propria |
| `nis` | Integracao CadUnico fora de escopo Sprint 5A |
| `disability` | Enum depende de levantamento com equipe de saude |
| `traditionalPeople` | Dado etnica/culturalmente senssivel — requer orientacao juridica |
| `foodInsecurity` | Sem campo na tela atual |
| `nationality` | Nao priorizado para piloto |
| `genderIdentity` (modal) | Ja existe no schema — adicionar ao modal em Sprint 5B |
| `cnsProfissional` | Campo do usuario, nao do paciente — ver Secao 5 |
| `cid10` | Campo do atendimento/registro, nao do cadastro — ver Secao 7 |

---

## 3. Permissoes ACS

### 3.1 Estado atual

**`canAccessPatient`** — `backend/src/utils/patients.js:256-279`

Para `mode="write"` (default), linha 278:
```javascript
return String(patient.teamId || "") === String(user?.teamId || "");
```
Nao ha verificacao de `assignedAcsId`. ACS com `mode="write"` tem acesso identico a qualquer outra role — ve e pode gravar em qualquer paciente da equipe.

**`getAllowedPatients`** — `backend/src/utils/patients.js:309-315`

Chama `canAccessPatient(user, p)` sem `mode` explicito (usa default `"write"`, linha 311). Para ACS, devolve todos os pacientes da equipe. O gestor tem branch dedicado (linhas 296-307) com escopo por `unitId`; o ACS nao tem branch equivalente.

**`tasks.write`** — `backend/src/utils/helpers.js:104-112`

Array de capabilities do role `acs` (linhas 104-111): `dashboard.read`, `patients.read.scoped`, `records.read`, `records.write`, `referrals.read`, `referrals.write`, `tasks.read`. A capability `tasks.write` esta **ausente** na linha 111.

### 3.2 Estado desejado

- `getAllowedPatients` para ACS: retornar apenas pacientes onde `p.assignedAcsId === user.id` (e `p.teamId === user.teamId`).
- `canAccessPatient` para ACS com `mode="write"`: exigir `p.assignedAcsId === user.id` alem do teamId match.
- ACS nao pertence a `CLINICAL_READ_ROLES` (`patients.js:254`) — o branch `mode="read"` ja retorna `false` para ACS, portanto nao requer mudanca.
- `tasks.write` no array de capabilities do role `acs`.

### 3.3 Correcao minima

**Arquivo:** `backend/src/utils/patients.js`

**Mudanca 1 — `getAllowedPatients` (inserir antes da linha 309):**

```javascript
// Inserir antes do return generico na linha 309:
if (canonicalRole(user?.role) === "acs") {
  return db.patients.filter((p) => {
    if (!includeInactive && p.inactive) return false;
    if (String(p.teamId || "") !== String(user?.teamId || "")) return false;
    if (String(p.assignedAcsId || "") !== String(user?.id || "")) return false;
    if (microArea && p.microArea !== microArea) return false;
    if (careCategory && p.careCategory !== careCategory) return false;
    return true;
  });
}
```

**Mudanca 2 — `canAccessPatient` (substituir linha 278):**

```javascript
// Substituir linha 278:
// return String(patient.teamId || "") === String(user?.teamId || "");
// Por:
const teamMatch = String(patient.teamId || "") === String(user?.teamId || "");
if (!teamMatch) return false;
if (canonicalRole(user?.role) === "acs") {
  return String(patient.assignedAcsId || "") === String(user?.id || "");
}
return true;
```

**Atencao:** Esta e uma breaking change de permissao. Validar em staging que todos os pacientes do piloto possuem `assignedAcsId` preenchido antes de aplicar. Ver Secao 13 para pre-requisito de dados.

### 3.4 tasks.write

**Arquivo:** `backend/src/utils/helpers.js:111`

Adicionar `"tasks.write"` apos `"tasks.read"` no array `acs`:

```javascript
// helpers.js — array acs, apos linha 111 ("tasks.read"):
"tasks.write"
```

Array resultante (linhas 104-112):
```javascript
acs: [
  "dashboard.read",
  "patients.read.scoped",
  "records.read",
  "records.write",
  "referrals.read",
  "referrals.write",
  "tasks.read",
  "tasks.write"   // ADICIONAR
],
```

---

## 4. Auditoria

### 4.1 Campos a adicionar em buildPatientAuditSnapshot

**Arquivo:** `backend/src/routes/patients.js:34-48`

Captura atual: `id`, `teamId`, `name`, `assignedAcsId`, `careCategory`, `chronicConditions`, `incompleteProfile`, `inactive`, `inactivationReason`, `birthDate`, `updatedAt`.

Campos ausentes a adicionar:

| Campo | Como armazenar | Justificativa |
|---|---|---|
| `cpf` | hash SHA-256 (nao valor em claro) | Identificador primario — rastreabilidade de acesso LGPD |
| `cns` | hash SHA-256 (nao valor em claro) | Identificador SUS — obrigatorio em trilha e-SUS |
| `phone` | valor em claro (ultimo digito mascarado) | Dado de contato senssivel — exigido para log de acesso |
| `sexAtBirth` | valor em claro | Campo clinico — alteracao deve ser auditavel |
| `genderIdentity` | hash SHA-256 (mesmo tratamento de cpf/cns) ou valor em claro com justificativa explicita | Dado senssivel de identidade de genero — LGPD exige tratamento especial; se armazenado em claro no log, documentar base legal e necessidade |

### 4.2 Campos a adicionar em buildUserAuditSnapshot

**Arquivo:** `backend/src/routes/users.js:19-33`

Captura atual: `id`, `teamId`, `name`, `email`, `role`, `councilType`, `councilNumber`, `councilUf`, `twoFactorEnabled`, `updatedAt`.

Campo a adicionar apos `councilUf` (linha 29):
```javascript
cns: String(user.cns || ""),
```

### 4.3 Novos eventos ACS para Sprint 5A

Apos a correcao de permissao ACS (Secao 3), os seguintes eventos devem ser emitidos:

| Evento | Acao | Entidade | Quando emitir |
|---|---|---|---|
| `patient.acs_access_denied` | `patient.read_blocked` | `patient` | ACS tenta acessar paciente nao designado — emitir em `getPatientOrError` quando negacao for por `assignedAcsId` mismatch |
| `record.visit_created` | ja existe via guard | `patient` | ACS cria registro tipo `visit` (`patients.js:614-616`) — evento ja e registrado; confirmar payload inclui `assignedAcsId` |
| `task.created` | `task.created` | `task` | ACS cria tarefa — novo, apos adicionar `tasks.write` |

---

## 5. CNS do Profissional

### 5.1 Estado atual

`RegisterSchema` (`schemas.js:13-22`): possui `councilNumber` (l.20) e `councilUf` (l.21), sem campo `cns`.

`MePatchSchema` (`schemas.js:273-280`): possui `councilNumber` (l.278) e `councilUf` (l.279), sem campo `cns`.

`buildUserAuditSnapshot` (`users.js:19-33`): captura `councilNumber` (l.28) e `councilUf` (l.29), sem `cns`.

### 5.2 O que adicionar

**`RegisterSchema`** (`schemas.js:13-22`) — adicionar apos linha 21 (`councilUf`):
```javascript
cns: z.string().trim().max(15).regex(/^\d{15}$/).optional()
```

**`MePatchSchema`** (`schemas.js:273-280`) — adicionar apos linha 279 (`councilUf`):
```javascript
cns: z.string().trim().max(15).regex(/^\d{15}$/).optional()
```

**`buildUserAuditSnapshot`** (`users.js:19-33`) — adicionar apos linha 29 (`councilUf`):
```javascript
cns: String(user.cns || ""),
```

**Migration necessaria:** `014_app_users_add_cns` — ver Secao 8.

**Handler `PATCH /me`** (`src/routes/me.js`) — adicionar processamento de `cns` no bloco de update, apos processamento de `councilUf`:
```javascript
if (payload.cns !== undefined) {
  next.cns = String(payload.cns || "").trim();
}
```

**Handler `POST /users`** (registro) — ao montar objeto do novo usuario, incluir `cns: body.cns || ""`.

### 5.3 Regex de validacao

CNS valido: 15 digitos numericos. Cartoes iniciados em `7`, `8` ou `9` sao definitivos; iniciados em `1` ou `2` sao provisorios.

```
/^\d{15}$/
```

Validacao de digito verificador postergada para Sprint 5B. Em Sprint 5A aceitar qualquer string de 15 digitos para nao bloquear cadastro com possivel erro de digitacao.

---

## 6. CNES da Unidade

### 6.1 Estado atual

Tabela `app_units` nao possui coluna `cnes`. Nao ha campo `cnes` em nenhum schema de unidade. Sem CNES, e impossivel vincular producao a uma unidade no e-SUS/RNDS ou assinar o instrumento juridico do piloto com identificacao oficial da unidade.

### 6.2 Migration

**Arquivo:** `backend/src/migrations/013_app_units_add_cnes.js`

```javascript
export const id = "013_app_units_add_cnes";

export async function up(client) {
  await client.query(`
    ALTER TABLE app_units ADD COLUMN IF NOT EXISTS cnes VARCHAR(7)
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_units_cnes
    ON app_units (cnes)
    WHERE cnes IS NOT NULL AND cnes <> ''
  `);
}
```

Coluna nullable (sem `NOT NULL`) porque unidades ja cadastradas nao possuem CNES registrado no sistema. Indice unico parcial (apenas onde nao nulo e nao vazio) permite multiplas unidades sem CNES cadastrado sem violar unicidade.

Rollback: `ALTER TABLE app_units DROP COLUMN IF EXISTS cnes; DROP INDEX IF EXISTS idx_app_units_cnes;` — seguro, coluna nova sem dados criticos.

Apos a migration, adicionar `cnes: z.string().trim().max(7).regex(/^\d{7}$/).optional()` ao schema de criacao/atualizacao de unidades e expor no `GET /api/units/:id`.

### 6.3 Acao nao-tecnica paralela

Antes do primeiro commit de Sprint 5A que toque em unidades:

1. Obter numero CNES oficial de cada UBS participante do piloto junto a Secretaria Municipal de Saude (consulta em `cnes.datasus.gov.br`).
2. Inserir CNES via seed/script no ambiente de staging para validacao.
3. O instrumento juridico do piloto contem placeholder `[CNES_PENDENTE]` — substituir pelo numero real apos confirmacao.

Responsavel: gestor do projeto / equipe de implantacao (nao e tarefa de desenvolvimento).

---

## 7. CID-10 nos Atendimentos

### 7.1 Estado atual

**`AppointmentCreateSchema`** (`schemas.js:120-126`): campos `date`, `summary`, `demandType`, `conduct`, `nextStep`. Sem `cid10`. `.strict()` em linha 126.

**`RecordCreateSchema`** (`schemas.js:238-245`): campos `type`, `date`, `title`, `details`, `protocolTag`, `metadata`. Sem `cid10` explicito. `.strict()` em linha 245.

O campo `metadata` em `RecordCreateSchema` e `z.record(z.any()).optional()` — `cid10` poderia ser enviado em `metadata.cid10`, mas sem validacao tipada, sem contrato e sem indexacao.

### 7.2 O que adicionar

**`AppointmentCreateSchema`** (`schemas.js:120-126`) — adicionar antes do `.strict()` na linha 126:
```javascript
cid10: z.string().trim().max(10).regex(/^[A-Z]\d{2}(\.\d{1,2})?$/).optional()
```

**`RecordCreateSchema`** (`schemas.js:238-245`) — adicionar antes do `.strict()` na linha 245:
```javascript
cid10: z.string().trim().max(10).regex(/^[A-Z]\d{2}(\.\d{1,2})?$/).optional()
```

Regex: `/^[A-Z]\d{2}(\.\d{1,2})?$/` — aceita `A00`, `J11.0`, `Z00.00`; rejeita strings sem formato CID-10.

### 7.3 Shadow column vs payload JSONB

**Decisao: payload JSONB primario em Sprint 5A. Shadow column postergada para Sprint 5B.**

Justificativa:
- O codigo de persistencia existente armazena automaticamente qualquer campo validado pelo schema no payload JSONB de `app_appointments` e `app_clinical_records`.
- Shadow column `cid10 VARCHAR(10)` so se justifica se houver `WHERE cid10 = ?` em query SQL direta (relatorios, indice). Em Sprint 5A nao ha endpoint de filtro por CID-10.
- Adicionar shadow column sem uso e migration desnecessaria; o dado ja estara no JSONB para backfill posterior.

Migration opcional Sprint 5B: `015_add_cid10_shadow_columns` — `ADD COLUMN IF NOT EXISTS cid10 VARCHAR(10)` em `app_appointments` e `app_clinical_records`, com backfill via `UPDATE ... SET cid10 = payload->>'cid10' WHERE payload->>'cid10' IS NOT NULL`.

### 7.4 Frontend

Dois pontos de exposicao:

1. **Formulario de atendimento** — campo texto `cid10` com mask de formato `[A-Z]\d{2}(\.\d{1,2})?`, opcional, apos o campo `conduct`.
2. **Formulario de registro clinico** para tipos `consultation`, `nursing`, `evolution` — campo opcional apos `details`.

O campo nao deve aparecer para ACS (ACS so cria `visit`, sem CID obrigatorio; guard em `patients.js:615`). Expor apenas para roles com `records.write` e tipo diferente de `visit`.

---

## 8. Migrations Previstas

### 8.1 Tabela

| # | Arquivo | Tabela | Operacao | Campos | Default / Constraint |
|---|---|---|---|---|---|
| 012 **(OPCIONAL)** | `012_app_patients_esus_fields.js` | `app_patients` | `ADD COLUMN IF NOT EXISTS` (multiplas) | `race_color VARCHAR(80)`, `situation_de_rua BOOLEAN` | `DEFAULT NULL`; `situation_de_rua DEFAULT FALSE` — pode ser postergada para Sprint 5B sem impacto funcional |
| 013 | `013_app_units_add_cnes.js` | `app_units` | `ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` | `cnes VARCHAR(7)` | `NULL`; indice unico parcial (onde nao nulo e nao vazio) |
| 014 | `014_app_users_add_cns.js` | `app_users` | `ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` | `cns VARCHAR(15)` | `DEFAULT NULL`; indice unico parcial (onde nao nulo e nao vazio) |

Nota sobre migration 012: os demais campos de moradia/psicossocial (housingType, waterSupply, etc.) sao armazenados no payload JSONB apos a correcao do schema (Secao 1.3) — sem shadow column em Sprint 5A. A migration 012 inclui apenas `race_color` e `situation_de_rua` por terem maior probabilidade de uso como filtro em relatorios futuros. Migration 012 e opcional em Sprint 5A; 013 e 014 sao obrigatorias (5A-OBR-05 e 5A-OBR-02).

### 8.2 Ordem de execucao

```
013 → 014 → 012 (se necessario)
```

013 e 014 nao tem dependencia mutua — podem ser aplicadas em paralelo ou qualquer ordem. 012 tem menor prioridade e pode ser postergada para Sprint 5B sem impacto funcional. Executar sempre em staging com validacao antes de producao.

### 8.3 Rollback

Todas as migrations usam `ADD COLUMN IF NOT EXISTS` e `CREATE ... IF NOT EXISTS`. Rollback de qualquer uma:

```sql
-- 013
ALTER TABLE app_units DROP COLUMN IF EXISTS cnes;
DROP INDEX IF EXISTS idx_app_units_cnes;

-- 014
ALTER TABLE app_users DROP COLUMN IF EXISTS cns;
DROP INDEX IF EXISTS idx_app_users_cns;

-- 012
ALTER TABLE app_patients DROP COLUMN IF EXISTS race_color;
ALTER TABLE app_patients DROP COLUMN IF EXISTS situation_de_rua;
```

As colunas sao novas e nao contem dados criticos no momento do deploy — rollback e seguro. Nao executar rollback em producao sem snapshot RDS previo.

### 8.4 Validacao em staging

Apos cada migration em staging:

```sql
-- Confirmar coluna criada (exemplo para 013):
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'app_units' AND column_name = 'cnes';

-- Confirmar indice criado:
SELECT indexname FROM pg_indexes
WHERE tablename = 'app_units' AND indexname = 'idx_app_units_cnes';

-- Confirmar dados existentes intactos:
SELECT COUNT(*) FROM app_units;

-- Confirmar idempotencia (re-executar migration — deve ter sucesso sem erro):
-- executar novamente o script da migration
```

---

## 9. Endpoints — Ajustes

### 9.1 Endpoints sem alteracao de rota (apenas schema)

| Metodo | Rota | Schema alterado | O que muda |
|---|---|---|---|
| `POST` | `/api/patients` | `PatientCreateSchema` via `PatientBaseShape` (`schemas.js:64`) | +26 campos novos aceitos |
| `PATCH` | `/api/patients/:id` | `PatientUpdateSchema` (`schemas.js:66-103`) | +26 campos novos aceitos; perda silenciosa corrigida |
| `POST` | `/api/patients/:id/appointments` | `AppointmentCreateSchema` (`schemas.js:120-126`) | +`cid10` opcional antes do `.strict()` |
| `POST` | `/api/patients/:id/records` | `RecordCreateSchema` (`schemas.js:238-245`) | +`cid10` opcional antes do `.strict()` |
| `POST` | `/api/auth/register` ou `/api/users` | `RegisterSchema` (`schemas.js:13-22`) | +`cns` opcional |
| `PATCH` | `/api/users/me` | `MePatchSchema` (`schemas.js:273-280`) | +`cns` opcional |

### 9.2 Endpoints com ajuste de response (novos campos no GET)

| Metodo | Rota | O que muda na response |
|---|---|---|
| `GET` | `/api/patients` e `/api/patients/:id` | Campos novos de moradia/psicossocial/e-SUS aparecem se preenchidos (ja estao no JSONB — sem alteracao de codigo de leitura necessaria) |
| `GET` | `/api/users/me` | Retorna campo `cns` do profissional |
| `GET` | `/api/units/:id` | Retorna campo `cnes` da unidade (apos migration 013) |

### 9.3 Nenhum endpoint novo em Sprint 5A

Todos os ajustes sao em schemas e responses de endpoints existentes. Nenhuma nova rota em Sprint 5A. Filtros server-side por `cid10`, `raceColor`, `educationLevel` e paginacao sao Sprint 5B.

---

## 10. Riscos

| Risco | Severidade | Mitigacao |
|---|---|---|
| Adicionar campo interno (id, teamId, hash, updatedAt) acidentalmente ao PatientUpdateSchema ao expandir com os 26 campos novos | Alta | Revisar diff de schemas.js linha a linha antes do merge; verificar que nenhum campo da lista de campos internos foi incluido |
| Correcao de `canAccessPatient` para ACS torna pacientes inacessiveis se `assignedAcsId` estiver em branco | Alta | Executar query de verificacao em staging antes do deploy (ver Secao 13); resolver atribuicao de pacientes sem ACS designado |
| Silent data loss continua em producao ate 5A-OBR-03 ser deployado (dados sendo perdidos agora) | Critica | Priorizar 5A-OBR-03 como primeiro item da sprint; nao esperar outros itens para fazer o deploy |
| Migration 013 com UNIQUE INDEX falha se houver unidades com CNES duplicado nos dados de seed | Media | Executar `SELECT cnes, COUNT(*) FROM app_units GROUP BY cnes HAVING COUNT(*) > 1` antes de aplicar migration |
| Campo `cns` sem validacao de digito verificador aceita CNS invalido em producao | Baixa | Aceitar para Sprint 5A; adicionar algoritmo PIS-like em Sprint 5B via funcao em `helpers.js` |
| Dados de `raceColor`/`educationLevel` perdidos antes de Sprint 5A nao sao recuperaveis | Alta | Comunicar a gestao; re-coleta necessaria nos proximos atendimentos apos o deploy |
| CID-10 sem tabela de lookup local permite digitacao de codigo estruturalmente valido mas semanticamente inexistente | Baixa | Regex garante formato minimo; validacao semantica via tabela local postergada para Sprint 5B |
| `buildPatientAuditSnapshot` com CPF/CNS em claro em logs de auditoria | Media | Armazenar hash SHA-256 dos identificadores, nao valor em claro, antes de adicionar ao snapshot |

---

## 11. KI-02 — Revisao Juridica de Anonimizacao

### 11.1 Estado atual do constraint

KI-02 esta em aberto como bloqueador juridico registrado na sessao de go-live 2026-06-09/10. O constraint tecnico vigente e: prontuario nunca tem exclusao fisica (regra de negocio implementada em codigo). A tensao e entre LGPD Art. 18 (direito do titular a exclusao) e a legislacao sanitaria (Resolucao CFM 1.638/2002 — retencao minima de 20 anos para prontuario). O valor de 20 anos esta atualmente hardcoded no modulo de privacidade.

`PrivacyRequestCreateSchema` (`schemas.js:268-271`) aceita tipos `"access"`, `"correction"`, `"deletion"` — o processamento de `"deletion"` nao tem implementacao segura ate KI-02 ser resolvido.

### 11.2 Decisao necessaria

O DPO ou assessoria juridica deve definir formalmente:

1. Prazo de retencao adotado (5, 10 ou 20 anos) e base legal aplicavel ao municipio.
2. Se o prazo conta a partir do ultimo atendimento ou da data de cadastro.
3. Distincao entre tipos de dado: prontuario clinico (Resolucao CFM) vs dados cadastrais demograficos (LGPD).
4. Mecanismo de anonimizacao: hash + nulificacao de campos PII vs exclusao logica vs retencao integral com acesso restrito.

Enquanto a decisao nao for tomada, nao alterar o codigo do modulo de privacidade.

### 11.3 Responsavel

- Responsavel pela decisao: DPO do projeto ou assessoria juridica da SMS.
- Responsavel tecnico: aguardar decisao antes de qualquer alteracao no modulo de privacidade ou no processamento de solicitacoes tipo `"deletion"`.
- Prazo sugerido para parecer juridico: 2026-06-30 (antes do go-live em producao com dados reais).
- Registro: documentar decisao em `docs/lgpd/` com data, base legal e nome do responsavel.

---

## 12. Ordem de Implementacao

Sequencia segura para Sprint 5A, da menor para maior interdependencia:

**1. 5A-OBR-03 — Expansao de PatientBaseShape e PatientUpdateSchema + fix sex/sexAtBirth**
`schemas.js:24-103` (backend) + `usePatientModal.js:132` (frontend).
Justificativa: risco CRITICO ativo (dados sendo perdidos agora). Schema-only, sem migration, sem impacto de permissao. Deploy isolado e rapido. Nao esperar outros itens.

**2. 5A-OBR-01 — CID-10 em AppointmentCreateSchema e RecordCreateSchema**
`schemas.js:120-126` e `schemas.js:238-245`.
Justificativa: schema-only, sem migration, sem impacto de permissao. Pode ir no mesmo PR que o item 1 se o revisor concordar; em PR separado se houver preferencia por isolamento.

**3. 5A-OBR-05 — Migration 013 (cnes em app_units)**
`migrations/013_app_units_add_cnes.js`.
Justificativa: requer janela de manutencao e aprovacao de infra. Executar em staging antes. Independente dos itens anteriores de codigo.

**4. 5A-OBR-02 — CNS em RegisterSchema, MePatchSchema e buildUserAuditSnapshot**
`schemas.js:13-22`, `schemas.js:273-280`, `users.js:19-33`.
Justificativa: depende da migration 014 (pode ser feita em paralelo com 013). Schema + handler change. Sem breaking change de permissao.

**5. 5A-OBR-04 — Fix canAccessPatient ACS (assignedAcsId check) + tasks.write**
`patients.js:256-279`, `patients.js:309-315`, `helpers.js:111`.
Justificativa: breaking change de permissao. Executar por ultimo, com pre-validacao de dados (ver Secao 13, item 2) e comunicacao previa aos gestores da UBS-001. Janela de manutencao recomendada.

**6. 5A-OBR-06 — KI-02 Revisao juridica**
Acao nao-tecnica. Iniciar escalate ao DPO no primeiro dia da sprint para maximizar tempo de resposta juridica. Nao e bloqueante para os itens 1-5, mas e bloqueante para go-live em producao com dados reais.

---

## 13. Dependencias Pre-Codigo

Acoes nao-tecnicas que devem estar em andamento antes ou em paralelo com o primeiro commit de Sprint 5A:

1. **CNES oficiais das unidades do piloto**: obter junto a SMS os numeros CNES de cada UBS participante (bloqueador para preencher o campo apos migration 013). Consulta: `cnes.datasus.gov.br`. Responsavel: equipe de implantacao.

2. **Auditoria de assignedAcsId nos pacientes de staging**: executar antes de implementar o item 5 da ordem de execucao:
   ```sql
   SELECT COUNT(*) FROM app_patients
   WHERE assigned_acs_id IS NULL OR assigned_acs_id = '';
   ```
   Se o resultado for > 0, resolver a atribuicao ou definir politica de acesso para pacientes sem ACS designado antes de ativar a restricao.

3. **Alinhamento com gestores da UBS-001 sobre restricao ACS**: comunicar que apos 5A-OBR-04, o ACS so vera pacientes atribuidos a ele. Confirmar que o mapeamento de microareas e ACS esta correto nos dados de staging.

4. **Escalate KI-02**: comunicar ao DPO ou assessoria juridica que o parecer sobre anonimizacao e bloqueante para o fechamento de conformidade LGPD do piloto. Prazo sugerido: 2026-06-30.

5. **Validacao de enum de racaCor com equipe clinica**: confirmar se os valores (`branca`, `preta`, `parda`, `amarela`, `indigena`, `nao_informado`) sao compativeis com a ficha e-SUS em uso pelo municipio antes de codificar enum estrito em Sprint 5B.

6. **Branch strategy**: criar `feat/sprint-5a-esus-fields` a partir de `main` (commit d20add9). Nao criar a partir de `chore/rotate-data-encryption-key` (branch corrente no momento do planejamento — contem rotacao de chave em andamento).

---

## 14. Criterio de Done (Sprint 5A)

- [ ] `PatientBaseShape` (`schemas.js:24-62`) expandido com os 26 campos listados na Secao 1.3
- [ ] `PatientUpdateSchema` (`schemas.js:66-103`) expandido com os mesmos 26 campos; `.strict()` mantido; nenhum campo interno adicionado
- [ ] Bug `sex`/`sexAtBirth` corrigido: `usePatientModal.js:132` envia `sexAtBirth`; `buildPatientFormState` le `p?.sexAtBirth`
- [ ] `AppointmentCreateSchema` (`schemas.js:120-126`) aceita campo `cid10` opcional; `.strict()` mantido
- [ ] `RecordCreateSchema` (`schemas.js:238-245`) aceita campo `cid10` opcional; `.strict()` mantido
- [ ] `RegisterSchema` (`schemas.js:13-22`) aceita campo `cns` com regex `/^\d{15}$/`
- [ ] `MePatchSchema` (`schemas.js:273-280`) aceita campo `cns` com regex `/^\d{15}$/`
- [ ] Handler `PATCH /me` persiste campo `cns`
- [ ] `buildUserAuditSnapshot` (`users.js:19-33`) inclui campo `cns`
- [ ] Migration 013 (`013_app_units_add_cnes.js`) criada, testada em staging (idempotente), aplicada em producao
- [ ] Migration 014 (`014_app_users_add_cns.js`) criada, testada em staging (idempotente), aplicada em producao
- [ ] `getAllowedPatients` (`patients.js:309-315`) com branch dedicado para ACS filtrando por `assignedAcsId === user.id`
- [ ] `canAccessPatient` (`patients.js:277-278`) verifica `assignedAcsId === user.id` para role `acs` em `mode="write"`
- [ ] `tasks.write` adicionado ao array de capabilities do role `acs` (`helpers.js:111`)
- [ ] `buildPatientAuditSnapshot` (`patients.js:34-48`) expandido com `cpf` (hash), `cns` (hash), `phone`, `sexAtBirth`
- [ ] `situacaoDeRua` adicionado ao payload de `usePatientModal.js` (campo precisa ser enviado pelo frontend, nao apenas aceito pelo schema — incluir junto aos demais campos sociais, linhas 144-147)
- [ ] Fixtures de testes automatizados atualizados para incluir `assignedAcsId` valido antes de aplicar 5A-OBR-04 (sem fixtures atualizados, testes de integracao passarao em falso para o filtro ACS)
- [ ] Smoke test em staging: criar paciente com todos os 26 campos novos via modal; verificar que nenhum e descartado (`GET /patients/:id` retorna os campos)
- [ ] Smoke test em staging: criar paciente com `sexAtBirth` via modal; verificar persistencia
- [ ] Smoke test em staging: ACS logado nao ve paciente com `assignedAcsId` diferente de seu `id` (espera lista vazia ou 403)
- [ ] Smoke test em staging: criar atendimento com `cid10` valido (ex: `J11.0`) e invalido (ex: `xyz`) — valido aceito, invalido retorna 400
- [ ] CNES da UBS-001 preenchido no registro de unidade em staging e producao
- [ ] KI-02 escalado ao DPO (nao necessariamente resolvido, mas com prazo formal registrado)
- [ ] PR aprovado por pelo menos um revisor com foco em seguranca de dados e multi-tenant
- [ ] Deploy em producao com smoke test pos-deploy confirmando os 6 itens obrigatorios sem regressao
- [ ] Nenhum dado clinico existente alterado ou excluido pelas migrations (verificar via `SELECT COUNT(*)` pre e pos migration)
