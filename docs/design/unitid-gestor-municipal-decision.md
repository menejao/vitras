# Decisão: unitId do Gestor Municipal no JWT

**Status:** DECISAO REGISTRADA — 2026-05-28
**Questao de origem:** PRD `tasks/prd-multi-ubs-architecture.md` — Questoes Abertas #1
**Decisao:** Opcao A — sentinel string `unitId: "municipal"`

---

## Contexto: Estado Atual do Codigo

### JWT Shape Atual (`backend/src/config.js` + `backend/src/middlewares/auth.js`)

O JWT e construido a partir do payload do token e propagado integralmente para `req.user`.
Os campos observados no middleware de autenticacao (`requireAuth`):

```
req.user = {
  ...payload,        // todos os campos do JWT incluindo unitId, municipalityId, teamId, role
  role: canonicalRole(payload.role),
  requestId,
  authTransport,
  requestMeta: { requestId, ip, userAgent, method, path, authTransport }
}
```

O JWT shape atual contem: `id`, `role`, `teamId`, `unitId`, `municipalityId`, `name`, `email`, entre outros.
Nao existe array `unitIds` no shape atual. O campo `unitId` e sempre uma string (ou ausente/vazio).

### Como `unitId` e Consumido Hoje

**`buildGestorUnitTeamIds` em `backend/src/utils/patients.js` (linha 259–265):**

```js
function buildGestorUnitTeamIds(db, user) {
  const userUnitId = String(user?.unitId || "").trim();
  if (!userUnitId) return null; // null = gestor without unitId = no access
  return new Set(
    (db.teams || []).filter((t) => String(t.unitId || "").trim() === userUnitId).map((t) => t.id)
  );
}
```

- A funcao recebe `user.unitId` como string
- Se `unitId` for vazio/ausente, retorna `null` (fail-safe: sem acesso)
- O resultado e usado em `getAllowedPatients` e `getPatientOrError` para o role `gestor`

**`getPatientOrError` (linha 297–315):**

```js
if (canonicalRole(user?.role) === "gestor") {
  const unitTeamIds = buildGestorUnitTeamIds(db, user);
  if (!unitTeamIds) return { error: { status: 403, message: "Gestor sem unidade definida" } };
  if (!unitTeamIds.has(String(patient.teamId || "").trim())) {
    return { error: { status: 403, message: "Sem permissão para este paciente" } };
  }
  return { patient };
}
```

O role `gestor` hoje nao usa `canAccessPatient` diretamente — tem caminho proprio via `buildGestorUnitTeamIds`.
O role `gestor_municipal` (se existir) nao tem tratamento explicito no codigo atual — cairia no path de `canAccessPatient` que faz match de `teamId`, provavelmente retornando `false` para qualquer paciente.

**`canAccessPatient` (linha 253–257):**

```js
function canAccessPatient(user, patient) {
  if (!patient) return false;
  if (canonicalRole(user?.role) === "break_glass_admin") return true;
  return String(patient.teamId || "") === String(user?.teamId || "");
}
```

Funcao binaria, sem mode, sem municipalityId, sem unitId — so teamId match ou break_glass.

---

## Analise das Opcoes

### Opcao A — Sentinel String `unitId: "municipal"`

**Mecanismo:**
- JWT do gestor municipal carrega `unitId: "municipal"` (ou outro sentinel fixo como `"*"` ou `"__municipal__"`)
- `buildGestorUnitTeamIds` precisa de um branch especial:
  ```js
  if (userUnitId === "municipal") return new Set((db.teams || []).map(t => t.id)); // todas as equipes
  ```
- Ou alternativamente: novo role `gestor_municipal` tem seu proprio path em `getPatientOrError` similar ao `gestor`

**Impacto no codigo atual:**
- `buildGestorUnitTeamIds`: adicionar 1 branch `if (userUnitId === "municipal")`
- `getAllowedPatients`: o branch do `gestor` ja usa `buildGestorUnitTeamIds` — funciona automaticamente se a funcao retornar todos os teamIds
- `getPatientOrError`: idem
- `canAccessPatient`: nao precisa mudar para esta opcao
- Guards de `unitId` no resto do sistema: nao quebram — `unitId` continua sendo string
- JWT shape: inalterado — `unitId` continua sendo string, apenas com um valor semantico especial

**Vantagens:**
- Zero alteracao de shape de JWT — nenhum caller, nenhum middleware, nenhum guard quebra
- Rollback e trivial: mudar o JWT emitido para o usuario e a unica mudanca necessaria
- Compatibilidade total com dados existentes — nenhum campo de `req.user` muda de tipo
- `buildGestorUnitTeamIds` ja e o ponto certo de extensao — 1 linha de codigo
- Nao requer mudanca em `canAccessPatient` (que e o guard mais critico e auditado do sistema)
- Smoke tests existentes: zero impacto — nenhum cenario de teste usa `unitId: "municipal"` hoje

**Desvantagens:**
- String magica: um desenvolvedor que nao conhece a convencao pode nao entender que `"municipal"` tem semantica especial
- Acoplamento implicito: a logica de "o que e municipal" esta distribuida entre o valor do JWT e o branch do guard
- Sem validacao de tipo: um typo (`"muncipal"`) faria o gestor cair no path sem acesso, silenciosamente

**Mitigacao do risco de string magica:**
- Definir a constante em `config.js` ou em `helpers.js`: `const UNIT_SENTINEL_MUNICIPAL = "municipal"`
- Documentar no codigo (comentario) o que o sentinel significa
- Adicionar teste negativo: `unitId: "municip"` (typo) deve retornar sem acesso

---

### Opcao B — Array `unitIds: ["unit-001", "unit-002"]`

**Mecanismo:**
- JWT do gestor municipal carrega `unitIds: ["unit-001", "unit-002", ...]` (array de todas as UBS do municipio)
- Guards verificam: `user.unitIds?.includes(patient.primaryUnitId)`
- `unitId` singular continua existindo para usuarios comuns ou fica vazio para gestores

**Impacto no codigo atual:**
- `buildGestorUnitTeamIds`: reescrever para iterar sobre array em vez de string
- `getAllowedPatients`: branch do `gestor` precisa mudar para usar `unitIds`
- `getPatientOrError`: idem
- Todos os guards que leem `user.unitId` no sistema inteiro precisam ser auditados — qualquer acesso a `req.user.unitId` em contexto de gestor municipal retornaria `undefined` ou string vazia, quebrando silenciosamente o acesso
- `syncShadowTables`, `db.js`, `tokens.js`: precisam gerar o array no momento da emissao do token — requer query ao banco para buscar todas as UBS do municipio no momento do login
- JWT shape: quebra — o campo `unitId` muda de semantica (ou e substituido, ou coexiste com `unitIds`)
- Tamanho do JWT: aumenta proporcionalmente ao numero de UBS (36 UBS = 36 strings no token)

**Vantagens:**
- Explicito: ao ler o JWT ve-se exatamente quais UBS o usuario pode acessar
- Extensivel: se um gestor tiver acesso a um subconjunto de UBS (ex: gestor regional), o array representa isso nativamente

**Desvantagens:**
- Quebra JWT shape atual: todos os sistemas que dependem de `user.unitId` como string precisam ser atualizados
- Risco de regressao alto: qualquer codigo que faz `String(user.unitId || "")` recebe `""` para gestores municipais, silenciando o acesso
- Requer busca no banco no momento de emissao do token (para construir o array de UBS) — acrescenta latencia no login e acoplamento com o estado do banco
- Com 36 UBS, o payload do JWT cresce; com municipios maiores cresce mais
- Rollback mais complexo: requer reverter tanto o JWT shape quanto todos os callers

---

## Decisao Recomendada: Opcao A — Sentinel String

**Justificativa tecnica:**

O codigo atual tem um unico ponto de extensao natural para gestores: `buildGestorUnitTeamIds`. Esta funcao ja isola toda a logica de resolucao de `unitId` → `Set<teamId>`. Adicionar o branch `if (userUnitId === "municipal") return todas as equipes` e a mudanca minima correta.

A Opcao B requer alterar o shape do JWT, o que e uma mudanca transversal de alto risco em um sistema pre-piloto. O JWT e consumido por `requireAuth`, que propaga o payload integralmente para `req.user`. Qualquer campo que muda de tipo `string` para `string[]` pode quebrar silenciosamente dezenas de call sites.

O risco da string magica e real mas gerenciavel: uma constante exportada de `helpers.js` e um comentario no guard eliminam o acoplamento implicito sem mudar o shape do token.

---

## Impacto em Rollback

**Opcao A (escolhida):**
- Rollback = reeditar o JWT emitido para o usuario gestor municipal (mudar `unitId` de `"municipal"` para um `unitId` real ou vazio)
- Zero mudanca de schema, zero mudanca de guards para outros roles
- 1 commit em `patients.js` (reverter o branch em `buildGestorUnitTeamIds`)

**Opcao B (descartada):**
- Rollback requer reverter: JWT shape, todos os guards que leem `unitIds`, query de emissao de token, possivelmente `syncShadowTables`
- Risco de dados inconsistentes se tokens com `unitIds` ainda estiverem em circulacao durante o rollback

---

## Impacto no Smoke (22 testes existentes)

**Opcao A:** Zero impacto nos 22 testes existentes. O sentinel `"municipal"` e um valor novo — nenhum teste atual usa `unitId: "municipal"`. Os testes de `gestor` existentes continuam funcionando com `unitId` como string normal.

Casos novos a adicionar (Sprint 5):
- Gestor com `unitId: "municipal"` pode listar pacientes de qualquer equipe do municipio
- Gestor com `unitId: "municipal"` pode acessar paciente de qualquer equipe do municipio
- Gestor com `unitId: ""` (vazio) continua retornando 403 (fail-safe preservado)
- Gestor com `unitId: "municipal"` mas `municipalityId` diferente do paciente retorna 403 (boundary absoluto)

---

## Impacto em `canAccessPatient`

**Opcao A:** `canAccessPatient` nao precisa mudar para suportar o sentinel.

O role `gestor` (e `gestor_municipal` se criado) tem seu proprio path em `getPatientOrError` que usa `buildGestorUnitTeamIds`. Ele nunca chega no `canAccessPatient` atual. A Opcao A nao altera este comportamento.

Nota: quando a ADR-002 for implementada (Sprint 5 US-204), `canAccessPatient` ganhara o parametro `mode`. O sentinel `"municipal"` nao interfere nessa mudanca — o branch do gestor continuara sendo separado ou podera ser integrado ao novo `mode: "read"` com uma verificacao adicional de municipalityId.

---

## Anti-Escopo (O Que Esta Decisao NAO Faz)

- Nao cria o role `gestor_municipal` — a decisao e sobre o valor do campo `unitId` no JWT, independente do nome do role
- Nao altera `canAccessPatient` — mudanca reservada para ADR-002 / Sprint 5 US-204
- Nao altera nenhum guard de autenticacao ou autorizacao em outros modulos (farmacia, agenda, fila)
- Nao define quais permissoes de escrita o gestor municipal tem (escopo de US-204 / US-206)
- Nao define como o sistema emite o token com `unitId: "municipal"` — isso e escopo de `tokens.js` na implementacao de Sprint 5
- Nao altera o JWT shape para outros roles
- Nao altera migrations ou schema
- Nao implementa nenhuma US de Sprint 5

---

## Proximos Passos (Implementacao — Sprint 5)

1. Definir constante `UNIT_SENTINEL_MUNICIPAL = "municipal"` em `backend/src/utils/helpers.js`
2. Adicionar branch em `buildGestorUnitTeamIds`:
   ```js
   if (userUnitId === UNIT_SENTINEL_MUNICIPAL) {
     return new Set((db.teams || []).map(t => t.id)); // acesso a todas as equipes do municipio
   }
   ```
3. Atualizar `tokens.js` para emitir `unitId: "municipal"` para o role `gestor_municipal`
4. Adicionar testes unitarios para os 4 casos listados na secao de smoke
5. Revisao humana obrigatoria antes de merge (conforme fluxo de governanca do PRD secao 8)

---

**Arquivo criado em:** 2026-05-28
**Decisao por:** Tech Lead AI — pre-requisito PRE-02 Sprint 5
