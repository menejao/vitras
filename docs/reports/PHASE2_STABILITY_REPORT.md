# Phase 2 Stability Report — SaudeUbs/SIGUS

**Data de execução:** 2026-05-13  
**Branch:** main  
**Commits desta fase:** e43d485 → 02245b4

---

## Regras seguidas

- Sem alterações de UI/UX
- Sem refatoração de layout
- Sem alterações no banco JSONB
- Fase 3 não iniciada
- Commits pequenos e isolados
- Build validado a cada etapa

---

## Mudanças realizadas

### Passo 1 — Rate limit persistente
**Commit:** `e3c816e` · `fix(security): add persistent rate limiting`

Instalado `@upstash/ratelimit` + `@upstash/redis`. Substituída lógica de Map manual por `express-rate-limit` (MemoryStore) com fallback e, quando `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` estiverem definidos, usa Upstash Redis com sliding window — survives restarts.

Comportamento:
- **Sem Upstash configurado:** `express-rate-limit` com MemoryStore + aviso no log em produção
- **Com Upstash configurado:** sliding window persistente via REST (HTTP, não TCP); lazy init na primeira requisição
- **Upstash com erro:** fail-open (request passa), erro logado

Commits anteriores relacionados:
- `e43d485` — substituição do Map manual por `express-rate-limit`
- `4582a35` — `Cache-Control: no-store` em todas respostas da API

---

### Passo 2 — Error Boundary React
**Status: já implementado antes desta fase.**

`AppErrorBoundary` (classe React) existe em `App.jsx:10192` com `getDerivedStateFromError`, `componentDidCatch`, UI de fallback com botões "Recarregar" e "Limpar sessão e recarregar". Envolve `AppInner` no export padrão (`App.jsx:11764`).

---

### Passo 3 — Handler global de 401
**Status: já implementado antes desta fase.**

`handleApiError` em `App.jsx:10587`:
- Usa `e.status === 401` como verificação primária (propagado via `err.status` em `api.js:60`)
- Também aceita mensagens de erro contendo "token ausente", "token inválido", "expirad", "não autorizado"
- Limpa token, user e todos os estados de dados; remove sessionStorage
- **Sem risco de loop:** `handleLogin` tem seu próprio `catch` independente — um 401 de credenciais erradas no `/auth/login` não dispara `handleApiError`
- **Diferencia 401 de 403:** apenas 401 encerra a sessão; 403 (sem permissão) deixa o usuário logado

Commit relacionado:
- `2fe8f1a` — propagação de `err.status` em `api.js`

---

### Passo 4 — Headers de segurança
**Commit:** `7419386` · `fix(security): harden production headers`

Adicionado `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.

Headers já presentes (Fase 1 / Helmet 8 padrão):
- `Strict-Transport-Security` (HSTS) — Helmet 8 ativa por padrão
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Cache-Control: no-store` — todos endpoints exceto `/health`

Commit relacionado:
- `0a9fa54` — `/integrations/council/status` agora requer `requireAuth`

---

### Passo 5 — CSP report-only
**Commit:** `20f5bfa` · `feat(security): add csp report only mode`

Helmet configurado com `contentSecurityPolicy: { reportOnly: true, useDefaults: false }` e diretivas:
- `default-src 'none'` — API-only, nenhum recurso externo servido
- `frame-ancestors 'none'` — equivalente a `X-Frame-Options: DENY` (reforço duplo)
- `report-uri /csp-report` — aponta violações para o endpoint local

Endpoint `POST /csp-report` adicionado: aceita `application/csp-report` e `application/json`, loga violações com `console.warn("[csp-violation]", ...)`, retorna `204`. Público (sem auth) — browsers enviam automaticamente.

**Não quebra o frontend:** header é `Content-Security-Policy-Report-Only` (nunca bloqueia); backend é API-only (sem HTML/JS servido).

---

### Passo 6 — render.yaml
**Commit:** `02245b4` · `chore(deploy): document production render env vars`

Adicionados:

| Variável | Tipo | Valor padrão |
|----------|------|--------------|
| `AUTH_MAX_ATTEMPTS` | value | `20` |
| `AUTH_WINDOW_MS` | value | `600000` (10 min) |
| `GLOBAL_RATE_LIMIT_WINDOW_MS` | value | `60000` (1 min) |
| `GLOBAL_RATE_LIMIT_MAX` | value | `600` |
| `TWOFA_ISSUER` | value | `SaudeUBS` |
| `UPSTASH_REDIS_REST_URL` | sync: false | — |
| `UPSTASH_REDIS_REST_TOKEN` | sync: false | — |

---

## Env vars novas

| Variável | Obrigatório | Descrição |
|----------|------------|-----------|
| `UPSTASH_REDIS_REST_URL` | Não | URL REST do Upstash Redis (ativa rate limiting persistente) |
| `UPSTASH_REDIS_REST_TOKEN` | Não (par com URL) | Token de autenticação Upstash |
| `AUTH_MAX_ATTEMPTS` | Não | Máx. tentativas de login por janela (padrão: 20) |
| `AUTH_WINDOW_MS` | Não | Janela do rate limit de auth em ms (padrão: 600000) |
| `GLOBAL_RATE_LIMIT_WINDOW_MS` | Não | Janela global em ms (padrão: 60000) |
| `GLOBAL_RATE_LIMIT_MAX` | Não | Máx. requisições por janela global (padrão: 600) |
| `TWOFA_ISSUER` | Não | Nome exibido no app TOTP (padrão: SaudeUBS) |

---

## Como validar em produção

1. **Backend inicia sem erro:** log deve conter `[rate-limit] "global" usando MemoryStore` (ou "Upstash Redis" se configurado)
2. **`GET /health` → 200** com `Cache-Control` ausente (não tem `no-store`)
3. **Rotas protegidas sem token → 401** (não 500, não 403)
4. **`GET /health` (Render healthcheck)** — continua passando
5. **Headers em qualquer resposta autenticada:**
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Cache-Control: no-store`
   - `Permissions-Policy: camera=(), ...`
   - `Content-Security-Policy-Report-Only: default-src 'none'; ...`
6. **Upstash (se configurado):** log `[rate-limit] "auth" usando Upstash Redis` na primeira requisição a `/auth/login`
7. **Rate limit auth:** 20+ tentativas de login em 10 min → 429
8. **CSP violations:** `POST /csp-report` com `Content-Type: application/csp-report` → 204

---

## Riscos restantes

| Risco | Severidade | Fase |
|-------|-----------|------|
| Sem refresh tokens / sem revogação de JWT | Alto | Fase 3 |
| TOTP implementado sem biblioteca auditada | Médio | Fase 3 |
| Banco: JSONB único, sem índices, lock serializado | Crítico-arquitetural | Fase 4 |
| App.jsx ~11k linhas sem code splitting | Médio | Fase 4 |
| Rate limiting MemoryStore em produção (sem Upstash) | Alto | Dependente de config |
| `backend-dotnet` abandonado no repo | Baixo | Qualquer momento |

---

## Próximos passos — Fase 3

Prioridade recomendada:

1. **Refresh tokens** — JWT de curta duração (15 min) + refresh token opaco com revogação
2. **Revogação de sessão** — blacklist de JTI ou Redis TTL
3. **TOTP com biblioteca auditada** — substituir implementação manual por `otplib`
4. **Rate limit por usuário autenticado** — além do rate limit por IP
5. **Audit log em banco** — persistir eventos de segurança fora do JSONB principal

---

*Nenhuma alteração de UI/UX foi feita. Nenhuma refatoração de arquitetura iniciada. Fase 2 focada exclusivamente em estabilidade e headers de segurança.*
