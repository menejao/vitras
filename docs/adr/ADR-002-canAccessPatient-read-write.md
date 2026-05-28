# ADR-002: Separacao Read/Write em canAccessPatient

## Status

Aceito — 2026-05-28

---

## Contexto

### Estado Atual de `canAccessPatient` (lido de `backend/src/utils/patients.js`)

```js
function canAccessPatient(user, patient) {
  if (!patient) return false;
  if (canonicalRole(user?.role) === "break_glass_admin") return true;
  return String(patient.teamId || "") === String(user?.teamId || "");
}
```

Caracteristicas do estado atual:
- Funcao binaria: sem parametro `mode`, sem distinção leitura vs. escrita
- Logica de acesso: unico criterio e `patient.teamId === user.teamId`
- `break_glass_admin` sempre `true`
- Sem verificacao de `municipalityId` (campo existe no paciente desde migration 010, mas nao e usado aqui)
- Sem verificacao de `unitId`
- Nao ha CLINICAL_ROLES definido nesta funcao — sem distinção de roles

### Campos Presentes no JWT / `req.user` (lido de `backend/src/middlewares/auth.js`)

O middleware `requireAuth` propaga o payload completo do JWT para `req.user`:
```
req.user.role           — string (canonicalizado por canonicalRole)
req.user.teamId         — string
req.user.unitId         — string (adicionado Fase 1, US-104)
req.user.municipalityId — string (adicionado Fase 1, US-104)
req.user.id             — string
```

### Campos Presentes no Paciente (lido de `POST /patients` em `backend/src/routes/patients.js`)

Desde migration 010 + Fase 1 (US-101/102), pacientes novos tem:
```
patient.teamId         — equipe de referencia (sempre presente, campo legado principal)
patient.unitId         — UBS de referencia (adicionado Fase 1)
patient.municipalityId — municipio (adicionado Fase 1, default "3534401")
```

Pacientes antigos (pre-Fase 1): podem ter `unitId` e `municipalityId` ausentes ou vazios.
O backfill foi feito via `syncShadowTables` na shadow table `app_patients`, mas o JSONB `app_state`
pode ter pacientes sem esses campos dependendo do momento do cadastro.

### Call Sites Atuais de `canAccessPatient` (lido de `backend/src/routes/patients.js`)

| Linha | Endpoint / Contexto | Uso atual |
|-------|---------------------|-----------|
| 67 | `hasSameTeamPatientAccess(user, patient)` — wrapper local de `canAccessPatient` | Usado em `/history`, `/protocol-summary`, `/messages GET` — chama `canAccessPatient(user, patient)` sem mode (semantica write atual) |
| ~50 | `getPatientOrError(user, patientId, db)` — gateway principal de leitura | Chama `canAccessPatient(user, patient)` sem mode para o path nao-gestor; para role `gestor` usa `buildGestorUnitTeamIds`. E o primeiro ponto de acesso para `/history`, `/protocol-summary`, `/messages`, `/records`, `/appointments` |
| 273 | `PUT /patients/:id` — guard de escrita | Controla edicao de cadastro |
| 443 | `DELETE /patients/:id` — guard de inativacao | Controla inativacao (soft-delete) |
| 486 | `GET /patients/:id/appointments` — guard secundario | Guard secundario apos `getPatientOrError` — dupla verificacao |
| 558 | `DELETE /patients/:id/appointments/:appointmentId` | Guard de exclusao de atendimento |
| 732 | `DELETE /patients/:id/records/:recordId` | Guard de inativacao de registro clinico |
| 780 | `PATCH /patients/:id/records/:recordId/inactivate` | Guard de inativacao de registro clinico |

Funcao com path proprio (nao usa `canAccessPatient` diretamente para o role `gestor`):
- `getAllowedPatients` — usa `buildGestorUnitTeamIds` para role `gestor`

Nota de fluxo: `getPatientOrError` e o gateway principal e ja nega acesso com 403 antes dos guards secundarios. Os guards `hasSameTeamPatientAccess` subsequentes sao uma segunda camada dentro do mesmo request. Na implementacao de US-204, tanto `getPatientOrError` quanto `hasSameTeamPatientAccess` precisarao ser atualizados para repassar `mode: "read"` — ver Call Sites a Atualizar abaixo e Risco R4.

---

## Motivacao

Sprint 5 US-204 exige que medicos e enfermeiras possam ler o prontuario completo de um paciente
independente de qual UBS ele foi atendido antes, garantindo continuidade do cuidado.

O mecanismo atual (`teamId` match) bloqueia essa leitura cross-UBS pois o medico da UBS-B nao tem
o mesmo `teamId` do paciente cadastrado na UBS-A.

O PRD (secao 6, `canAccessPatient` alvo) define:
- `mode: "read"`: match de `municipalityId` + role clinico
- `mode: "write"`: match de `teamId` (comportamento atual preservado)
- `break_glass_admin`: sempre `true` em ambos os modos

A separacao de modo e necessaria para nao abrir escrita cross-UBS ao mesmo tempo que se abre leitura.
Escrita cross-UBS (ex: criar atendimento para paciente de outra equipe) deve continuar exigindo `teamId` match.

---

## Decisao

### Nova Assinatura

```js
function canAccessPatient(user, patient, mode = "write")
```

O parametro `mode` e opcional com default `"write"`. Isso garante que todos os call sites existentes
que nao passam `mode` continuam funcionando com o comportamento atual (nenhuma regressao possivel por
omissao de argumento).

### Logica de Acesso por Modo

**Nota de implementacao:** `if (!patient) return false;` DEVE ser a PRIMEIRA linha da funcao,
antes de qualquer branch de mode. Isso garante que nem o path write nem o path read nunca
acessam propriedades de `patient` quando ele e `null` ou `undefined`.

#### Modo WRITE (default — comportamento atual preservado integralmente)

```js
if (mode === "write") {
  if (canonicalRole(user?.role) === "break_glass_admin") return true;
  return String(patient.teamId || "") === String(user?.teamId || "");
}
```

Sem alteracao de logica. Todo call site que nao passa `mode` recebe este comportamento.

#### Modo READ

```js
if (mode === "read") {
  if (canonicalRole(user?.role) === "break_glass_admin") return true;

  // Boundary absoluto: municipio
  const patientMunicipality = String(patient.municipalityId || "").trim();
  const userMunicipality = String(user?.municipalityId || "").trim();

  // Fallback seguro: se paciente nao tem municipalityId, exige teamId match (comportamento legado)
  if (!patientMunicipality) {
    return String(patient.teamId || "") === String(user?.teamId || "");
  }

  if (patientMunicipality !== userMunicipality) return false; // cross-municipio: sempre false

  // Roles com acesso de leitura clinica cross-UBS dentro do municipio
  const CLINICAL_READ_ROLES = new Set([
    "doctor", "nurse_manager", "dentist", "nursing_tech"
  ]);
  return CLINICAL_READ_ROLES.has(canonicalRole(user?.role));
}
```

**Roles que PODEM ler cross-UBS (mesmo municipio):**
- `doctor`
- `nurse_manager`
- `dentist`
- `nursing_tech`
- `break_glass_admin` (via branch proprio, acima)

**Roles que NAO podem ler cross-UBS:**
- `acs` — ACS pode localizar paciente por nome/microarea mas nao prontuario clinico de outra equipe (PRD FR-4)
- `receptionist` — pode confirmar identidade mas sem acesso clinico cross-UBS (PRD FR-5)
- `pharmacist` — acesso restrito ao contexto de farmacia da propria UBS (PRD FR-16)
- `gestor` — tem seu proprio path via `buildGestorUnitTeamIds` (nao usa `canAccessPatient`)
- Qualquer role nao listado em `CLINICAL_READ_ROLES` cai no `return false`

**Fallback de seguranca — paciente sem `municipalityId`:**
Se `patient.municipalityId` estiver ausente ou vazio (paciente pre-Fase 1 sem backfill no JSONB),
o modo read cai para `teamId` match. Isso e intencional e seguro: prefere negar do que abrir acesso
a um paciente cujo municipio nao pode ser verificado.

### Call Sites a Atualizar

Com base na leitura completa de `backend/src/routes/patients.js`:

| Call Site | Linha Aprox. | Modo Correto | Justificativa |
|-----------|--------------|-------------|---------------|
| `PUT /patients/:id` — guard de edicao de cadastro | 273 | `"write"` (default) | Edicao de cadastro e operacao de escrita — equipe de referencia apenas |
| `DELETE /patients/:id` — guard de inativacao | 443 | `"write"` (default) | Inativacao e operacao de escrita irreversivel |
| `GET /patients/:id/appointments` — guard secundario | 486 | `"read"` | Leitura de atendimentos para continuidade de cuidado |
| `DELETE /patients/:id/appointments/:appointmentId` | 558 | `"write"` (default) | Exclusao e operacao de escrita |
| `DELETE /patients/:id/records/:recordId` | 732 | `"write"` (default) | Inativacao de registro clinico e escrita |
| `PATCH /patients/:id/records/:recordId/inactivate` | 780 | `"write"` (default) | Inativacao e escrita |
| `hasSameTeamPatientAccess` (wrapper para `/history`, `/protocol-summary`, `/messages GET`) | 67 | Mudar para `"read"` | Leitura de historico clinico e prontuario — caso de uso central do cross-UBS |

Observacao sobre `getPatientOrError`: esta funcao e o gateway principal de acesso. Na implementacao
de Sprint 5, ela tambem precisara aceitar `mode` e repassar para `canAccessPatient` no path nao-gestor.
Atualmente `getPatientOrError` chama `canAccessPatient(user, patient)` sem mode, o que e correto
enquanto nao houver cross-UBS. Na implementacao de US-204, `getPatientOrError` deve receber `mode`
e passar adiante.

---

## Rollback

O rollback e composto por exatamente 2 commits:

**Commit 1 — reverter `backend/src/utils/patients.js`:**
- Remover o parametro `mode` de `canAccessPatient`
- Remover a logica de `CLINICAL_READ_ROLES` e verificacao de `municipalityId` no modo read
- Restaurar a funcao para sua forma atual (teamId match + break_glass)

**Commit 2 — reverter `backend/src/routes/patients.js`:**
- Remover o argumento `"read"` dos call sites que foram atualizados
- Restaurar `hasSameTeamPatientAccess` para chamar `canAccessPatient(user, patient)` sem mode

Nao ha mudanca de schema, nao ha migration envolvida. Rollback e instantaneo.

---

## Impacto no Smoke

### Testes Existentes (22/22 PASS — nao impactados)

Todos os 22 testes existentes usam cenarios intra-equipe (`teamId` match). Como o default de `mode`
e `"write"` e o comportamento de write permanece identico ao atual, nenhum teste existente muda de resultado.

### Novos Casos a Adicionar (minimo obrigatorio — 7 casos)

1. **read-same-team:** medico com mesmo `teamId` do paciente, `mode: "read"` → `true`
2. **read-cross-UBS-clinical:** medico com `municipalityId` igual ao paciente mas `teamId` diferente, `mode: "read"` → `true`
3. **read-cross-UBS-non-clinical:** ACS com `municipalityId` igual ao paciente mas `teamId` diferente, `mode: "read"` → `false`
4. **read-cross-municipality:** medico com `municipalityId` diferente do paciente, `mode: "read"` → `false`
5. **read-no-municipalityId-fallback:** paciente sem `municipalityId`, `mode: "read"`, mesmo `teamId` → `true` (fallback legado)
6. **read-no-municipalityId-fallback-cross:** paciente sem `municipalityId`, `mode: "read"`, `teamId` diferente → `false` (fallback seguro)
7. **write-cross-UBS-blocked:** medico com `municipalityId` igual ao paciente mas `teamId` diferente, `mode: "write"` (default) → `false` (regressao nao aberta)

Caso bonus (break_glass):
8. **break_glass-read:** `break_glass_admin` com qualquer municipio, `mode: "read"` → `true`
9. **break_glass-write:** `break_glass_admin` com qualquer municipio, `mode: "write"` → `true`

Caso negativo smoke cross-UBS (Cat.4):
10. **write-isolation-cross-team-smoke:** usuario smoke (team-A) tentando GET no patient de team-B via HTTP deve retornar 403.
    Requer env var `SMOKE_CROSS_TEAM_PATIENT_ID`. Se ausente, o caso e marcado como skipped (nao falha o smoke).
    Objetivo: garantir que a introducao de `mode: "read"` nao abriu regressao no path de escrita/acesso padrao.

---

## Riscos Conhecidos

**R1 — `municipalityId` ausente em pacientes pre-Fase 1 no JSONB:**
Migration 010 fez backfill na shadow table `app_patients`, mas o JSONB `app_state.patients[]`
pode ter registros sem `municipalityId` dependendo do momento do cadastro vs. aplicacao da migration.
O fallback de seguranca (teamId match quando `municipalityId` vazio) mitiga: nao abre acesso indevido,
mas pode bloquear leitura cross-UBS para pacientes antigos ate que o JSONB seja atualizado.
Verificar completude do backfill no JSONB antes de habilitar cross-UBS em producao.

**R2 — Race condition em `buildGestorUnitTeamIds`:**
`buildGestorUnitTeamIds` le `db.teams` no momento da requisicao. Se uma equipe for criada/removida
durante a sessao do gestor, o `Set` resultante pode estar desatualizado. Isso nao e um risco novo
introduzido por esta ADR, mas deve ser monitorado em producao.

**R3 — Dupla verificacao em `/patients/:id/appointments` GET:**
Este endpoint chama `getPatientOrError` (que ja verifica acesso) e depois `canAccessPatient` novamente.
Quando `mode: "read"` for adicionado ao segundo guard, `getPatientOrError` ainda usa o modo padrao
(`"write"`) a menos que seja atualizado tambem. O comportamento resultante seria: `getPatientOrError`
nega o acesso antes mesmo do segundo guard ser consultado. Resolver: atualizar `getPatientOrError`
para aceitar e repassar `mode` na mesma iteracao de Sprint 5 US-204.

**R4 — `hasSameTeamPatientAccess` e um alias de `canAccessPatient`:**
O wrapper `hasSameTeamPatientAccess(user, patient)` em `patients.js` (linha 67) e usado em 3 endpoints
de leitura. Ele nao passa `mode`, entao ao mudar a semantica de leitura, este wrapper deve ser atualizado
para passar `mode: "read"`. Se esquecido, esses endpoints continuarao com semantica de write mesmo
apos a implementacao.

**R5 — receptionist em `/patients/:id/appointments` GET:**
Com `mode: "read"`, recepcionistas (nao estao em `CLINICAL_READ_ROLES`) continuarao recebendo 403
cross-UBS. Isto e o comportamento correto (PRD FR-5), mas deve ser documentado explicitamente para
evitar que um desenvolvedor adicione `receptionist` a `CLINICAL_READ_ROLES` por engano.

---

## Anti-Escopo (O Que Esta ADR NAO Faz)

- Nao altera autenticacao — `requireAuth`, JWT shape, cookies
- Nao altera RBAC — capabilities, roles, `requireRoles`, `requireCapabilities`
- Nao redesenha `canAccessPatient` para multiplos tenants (multi-municipio nao e suportado)
- Nao implementa US-205 (farmacia) ou US-206 (fila/agenda)
- Nao altera schema ou migrations
- Nao altera o JWT — `municipalityId` ja esta no token desde Fase 1 (US-104)
- Nao define como `gestor_municipal` acessa pacientes — isso e escopo da decisao PRE-02 (docs/design/unitid-gestor-municipal-decision.md) e da implementacao de `buildGestorUnitTeamIds`
- Nao abre escrita cross-UBS — modo write permanece identico ao estado atual
- Nao remove o fallback de `teamId` para pacientes sem `municipalityId`

---

## Criterios de Aceite

Os 7 casos de teste unitario abaixo devem passar antes de considerar US-204 concluida:

```
[ ] Caso 1: canAccessPatient(doctor@UBS-A, patient@UBS-A, "read")  === true  (same team)
[ ] Caso 2: canAccessPatient(doctor@UBS-A, patient@UBS-B, "read")  === true  (cross-UBS, same municipality)
[ ] Caso 3: canAccessPatient(acs@UBS-A, patient@UBS-B, "read")     === false (ACS, cross-UBS blocked)
[ ] Caso 4: canAccessPatient(doctor@MUN-X, patient@MUN-Y, "read")  === false (cross-municipality blocked)
[ ] Caso 5: canAccessPatient(doctor@UBS-A, patient_no_mun, "read") === true  (fallback: same teamId)
[ ] Caso 6: canAccessPatient(doctor@UBS-A, patient_no_mun_cross, "read") === false (fallback: diff teamId)
[ ] Caso 7: canAccessPatient(doctor@UBS-A, patient@UBS-B, "write") === false (write cross-UBS still blocked)
```

Onde:
- `patient_no_mun` = paciente sem campo `municipalityId`, mesmo `teamId` que o usuario
- `patient_no_mun_cross` = paciente sem campo `municipalityId`, `teamId` diferente do usuario
- `doctor@UBS-A` = usuario com `role: "doctor"`, `teamId: "team-a"`, `municipalityId: "3534401"`
- `patient@UBS-B` = paciente com `teamId: "team-b"`, `municipalityId: "3534401"`
- `patient@MUN-Y` = paciente com `municipalityId: "9999999"` (diferente do usuario)

---

## Dependencias

- **PRE-02** (docs/design/unitid-gestor-municipal-decision.md) deve ser decidida antes de implementar
  o modo `read` para `gestor_municipal`, pois a interacao entre o sentinel `"municipal"` e a logica
  de read precisa ser definida explicitamente (gestor municipal provavelmente tem seu proprio path
  via `buildGestorUnitTeamIds` e nao usa `canAccessPatient` diretamente — confirmar na implementacao)

- **Migration 010** (municipality_id nas tabelas) — ja aplicada (Fase 1 concluida). O campo
  `municipalityId` existe no paciente e no JWT.

- **Smoke 22/22 PASS** no commit `d91c9cd` — baseline verificada. Os 22 testes devem continuar
  passando apos a implementacao de US-204.

---

**Arquivo criado em:** 2026-05-28
**Autoria:** Tech Lead AI — pre-requisito PRE-03 Sprint 5
