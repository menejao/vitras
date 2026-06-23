# BUG-CLINIC-01 — Encerramento Oficial de Incidente

**Data de abertura:** 2026-06-23  
**Data de encerramento:** 2026-06-23  
**Classificação:** REGRESSÃO DE ROTEAMENTO  
**Severidade:** ALTA  
**Status final:** DONE

---

## GOV-01

| Critério | Resultado |
|---|---|
| Causa raiz identificada? | **SIM** |
| Correção aplicada? | **SIM** |
| RBAC preservado? | **SIM** |
| Team Scope preservado? | **SIM** |
| Segregação entre Console Nacional e módulos clínicos preservada? | **SIM** |
| Testes aprovados? | **SIM** |
| Deploy realizado? | **SIM** |

---

## FASE 1 — Causa Raiz

**Arquivo afetado:** `backend/src/routes/platform.js`

**Middleware afetado:** `requireSupportAdmin`

**Fluxo afetado:** Todas as requisições processadas pelo `platformRouter`, que estava montado em `"/"` (sem prefixo) em `app.js` **antes** do middleware global `requireAuth` (linha 65).

**Causa raiz:**

```js
// INCORRETO — sem prefixo de path
router.use(requireAuth, requireSupportAdmin);
```

`router.use()` sem path prefix intercepta **todos** os requests que entram no router. Como `app.use(platformRouter)` era montado antes de `app.use(requireAuth)` em `app.js`, qualquer request por usuário não-`support_admin` para endpoints fora de `authRouter`/`usersRouter` era interceptado e retornava 403 `"Acesso restrito ao Console Nacional"`.

**Impacto gerado:**

- `GET /bootstrap` → 403 para todos os usuários clínicos
- `GET /patients` → 403
- `GET /queue` → 403
- `useBootstrap.loadAll()` capturava o erro e propagava via `setError()` para o estado global
- Dashboard exibia `"Acesso restrito ao Console Nacional"` em banner de erro
- Indicadores da UBS apareciam zerados (patients, users, profissionais, equipe)

---

## FASE 2 — Correção Implementada

**Código anterior (BUG):**

```js
// backend/src/routes/platform.js
router.use(requireAuth, requireSupportAdmin);
```

**Código corrigido:**

```js
// backend/src/routes/platform.js
// All /platform routes require support_admin.
// The path prefix "/platform" is mandatory: without it, router.use() would intercept
// every request (including /bootstrap, /patients, etc.) because this router is mounted
// at "/" in app.js BEFORE the global requireAuth middleware.
router.use("/platform", requireAuth, requireSupportAdmin);
```

**Comportamento anterior:**

- `requireSupportAdmin` executava para **todos** os requests
- Usuários clínicos (`break_glass_admin`, `nurse_manager`, `gestor`, `acs`) recebiam 403 em `/bootstrap`, `/patients`, `/queue`
- Mensagem `"Acesso restrito ao Console Nacional"` vazava para contexto clínico

**Comportamento corrigido:**

- `requireSupportAdmin` executa **somente** para paths com prefixo `/platform`
- `GET /bootstrap`, `/patients`, `/queue` alcançam `requireAuth` global normalmente
- Dashboard carrega dados reais da UBS
- Mensagem de Console Nacional restrita ao contexto `/platform/*`

**Commit:** `fa1606c` — `fix(clinic): prevent platform access leak and restore dashboard scope`

---

## FASE 3 — Validação Funcional

| Endpoint | Usuário | Resultado esperado | Resultado obtido |
|---|---|---|---|
| `GET /bootstrap` | `break_glass_admin` | 200 | **200** |
| `GET /bootstrap` | `nurse_manager` | 200 | **200** |
| `GET /bootstrap` | `gestor` | 200 | **200** |
| `GET /patients` | `nurse_manager` | 200 | **200** |
| `GET /queue` | `break_glass_admin` | 200 | **200** |
| `GET /users` | `nurse_manager` | 200 | **200** |
| Dashboard KPIs | `break_glass_admin` | dados reais | **dados reais** |
| `/bootstrap` response | qualquer clínico | sem mensagem Console Nacional | **sem mensagem** |

---

## FASE 4 — Validação de Segurança

| Verificação | Resultado |
|---|---|
| `gestor` não acessa `GET /platform/units` | **403** |
| `nurse_manager` não acessa `GET /platform/units` | **403** |
| `break_glass_admin` não acessa `GET /platform/units` | **403** |
| Sem token não acessa `GET /platform/units` | **401** |
| `support_admin` não acessa `GET /bootstrap` | **403** |
| `support_admin` não acessa `GET /patients` | **403** |
| `support_admin` não acessa `GET /queue` | **403** |
| `support_admin` acessa `GET /platform/units` | **200** |
| `support_admin` acessa `GET /platform/summary` | **200** |

Segregação entre Console Nacional e módulos clínicos **preservada**.

---

## FASE 5 — Validação de Testes

| Suíte | Resultado |
|---|---|
| `bug-clinic-01.test.mjs` (regressão específica do bug) | **21/21 PASS** |
| `bug-clinic-01` + `iam-01` combinados | **48/48 PASS** |
| Regressão geral (`auth`, `patients`, `queue`, `agenda`) | **27/27 PASS** |

**Arquivo de regressão criado:** `backend/test/bug-clinic-01.test.mjs`

Cobre permanentemente:

- Usuários clínicos acessam `/bootstrap`, `/patients`, `/queue` (não 403)
- Mensagem `"Acesso restrito ao Console Nacional"` não vaza para contexto clínico
- `support_admin` bloqueado de endpoints clínicos
- `support_admin` acessa `/platform/*` normalmente
- JWT de `break_glass_admin` contém `role` e `unitId` corretos
- `/bootstrap` retorna arrays `patients` e `users`
- Team Scope preservado para `nurse_manager`

**Correção colateral:** `backend/test/iam-01.test.mjs` — assertion incorreta em `GET /platform/units` (esperava array raw; endpoint retorna `{ units: [], total, pages }`).

---

## FASE 6 — Validação de Deploy

| Item | Valor |
|---|---|
| Ambiente | `vitras-drill-sa-3` |
| Estratégia | Green Deployment |
| Versão implantada | `clinic-01-20260623-1026` |
| Status EB | **Green / Ready** |
| `/readyz` | **ok** — `ready=True`, `phase=ready` |
| Timestamp `/readyz` | `2026-06-23T13:31:15.415Z` |

---

## Arquivos Alterados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `backend/src/routes/platform.js` | MODIFICADO | Correção do path prefix no middleware `requireSupportAdmin` |
| `backend/test/bug-clinic-01.test.mjs` | CRIADO | 21 testes de regressão do incidente |
| `backend/test/iam-01.test.mjs` | MODIFICADO | Correção de assertion pré-existente incorreta em `/platform/units` |

---

## Integração na Suíte de Regressão

A partir desta formalização, `bug-clinic-01.test.mjs` integra permanentemente a suíte de regressão de segurança, RBAC, Team Scope e segregação entre Console Nacional e módulos clínicos do VITRAS APS.

Deve ser executada obrigatoriamente antes de qualquer:

- Alteração em `backend/src/routes/platform.js`
- Alteração em `backend/src/app.js` (ordem de montagem de routers)
- Alteração em middlewares de autenticação/autorização
- Deploy de nova versão backend

---

## Lição Aprendida

`router.use(fn)` sem path prefix em Express intercepts **todos** os requests que passam pelo router — independente do path. Em routers montados em `"/"` **antes** de middlewares globais, isso cria vazamento de autorização para rotas não intencionadas.

**Regra derivada:** Todo middleware de autorização em router montado globalmente deve ter path prefix explícito que delimita seu escopo.
