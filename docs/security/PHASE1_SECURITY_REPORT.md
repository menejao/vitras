# Phase 1 Security Report — SaudeUbs/SIGUS

**Data de execução:** 2026-05-13  
**Branch:** main  
**Commits nesta fase:** e5766cc → bd3b063  

---

## O que foi corrigido

### Passo 1 — Sessão frontend
**Status: Já estava correto.**  
O código em `AppInner` já usa `readSession()` via `useMemo` para ler o token do `sessionStorage` na inicialização. `const session = null` mencionado na auditoria não existia na versão atual do código. Sessão persiste corretamente em page refresh dentro da mesma aba.

---

### Passo 2 — Rotas protegidas com requireAuth
**Commit:** `e5766cc` · `fix(security): protect authenticated routes with requireAuth`

**Problema:** 40+ rotas acessavam `req.user` sem o middleware `requireAuth`. Resultados variados:
- Rotas `/me/*`: crash 500 (TypeError: `req.user.id` of undefined)
- Rotas `/patients`, `/tasks`, `/ai/*`: retornavam array vazio ou dados incorretos
- Rotas com `requireManager` mas sem `requireAuth`: retornavam 403 em vez de 401

**Correção:** `requireAuth` adicionado como middleware em todas as rotas autenticadas:

| Grupo | Rotas |
|-------|-------|
| `/me/*` | GET /me, GET /me/2fa/status, POST /me/2fa/setup, POST /me/2fa/enable, POST /me/2fa/disable, POST /me/presence, PATCH /me |
| `/users*` | GET /users, GET /users/activity-log, POST /users, GET /users/:id/usage, PUT /users/:id, DELETE /users/:id |
| `/patients*` | GET, POST, PUT, DELETE /patients, GET /patients/protocol-summaries, todas sub-rotas de appointments, records, history, protocol-summary, messages |
| `/tasks*` | GET /tasks, POST /tasks, PATCH /tasks/:id |
| `/metrics*` | GET /metrics/demand/monthly, GET /metrics/data-quality |
| `/audit-logs*` | GET /audit-logs, GET /audit-logs/export |
| `/privacy*` | GET/POST /privacy/requests, PATCH /privacy/requests/:id, POST /privacy/requests/:id/execute, POST /privacy/retention/anonymize |
| `/protocol/templates*` | GET/POST/PUT/DELETE /protocol/templates/:category/* |
| `/ai/*` | POST /ai/patients/:id/* (6 rotas), POST /ai/team/* (3 rotas), POST /ai/chat |

Rotas intencionalmente sem auth: `/health`, `/teams/public`, `/auth/*`, `/bootstrap`, `/integrations/council/status`, `/admin/backup/export` (usa `BACKUP_EXPORT_KEY`).

---

### Passo 3 — Credenciais demo desabilitadas em produção
**Commit:** `40731f6` · `fix(security): disable demo credentials in production`

**Problema:** `ensureDemoManagerIfNeeded` criava automaticamente `ana@clinica.local` / `123456` em qualquer ambiente, inclusive produção, em toda tentativa de login com essas credenciais.

**Correção:** Adicionado guard `if (IS_PROD) return null;` no início da função. Em produção (`NODE_ENV=production`), a função retorna imediatamente sem criar nem reparar o usuário demo. Funcionalidade preservada em desenvolvimento.

---

### Passo 4 — SSL Neon corrigido
**Commit:** `3879201` · `fix(db): secure neon ssl configuration`

**Problema:** `ssl: { rejectUnauthorized: false }` desabilitava verificação do certificado TLS, tornando a conexão vulnerável a MITM.

**Correção:** Alterado para `ssl: true`. Neon possui certificado válido — strict verification funciona sem problema.

---

### Passo 5 — Backup export por header apenas
**Commit:** `6ef25c1` · `fix(security): secure backup export authentication`

**Problema:** A chave de backup era aceita via `?key=...` na query string, expondo-a em access logs, histórico do browser e headers Referer.

**Correção:** Removido `req.query.key` do fallback. Apenas `x-backup-key` header é aceito.

---

### Passo 6 — Validação de env vars críticas
**Commit:** `bd3b063` · `fix(config): validate critical production env vars`

**Problema:** `DATA_ENCRYPTION_KEY`, `FRONTEND_ORIGINS`, `JWT_EXPIRES_IN` e `BACKUP_EXPORT_KEY` não tinham validação na inicialização e não estavam declarados no `render.yaml`.

**Correção em server.js:**
- `DATA_ENCRYPTION_KEY`: **fail-fast** se ausente em produção (dados sensíveis ficam em plaintext sem ela — violação LGPD)
- `BACKUP_EXPORT_KEY`: aviso (`console.warn`) se ausente
- `JWT_EXPIRES_IN`: aviso se usando o default de 12h

**Correção em render.yaml:** adicionados os slots `NODE_ENV`, `JWT_EXPIRES_IN`, `DATA_ENCRYPTION_KEY`, `FRONTEND_ORIGINS`, `BACKUP_EXPORT_KEY`.

---

## Riscos eliminados

| Risco | Severidade anterior | Status |
|-------|-------------------|--------|
| Rotas `/me/*` crasham com 500 sem token | Crítico | Eliminado |
| Dados de pacientes acessíveis sem auth | Crítico | Eliminado |
| Demo credentials `ana@clinica.local`/`123456` em produção | Crítico | Eliminado |
| Chave de backup exposta via query string em logs | Alto | Eliminado |
| SSL sem verificação de certificado (Neon) | Alto | Eliminado |
| `DATA_ENCRYPTION_KEY` ausente sem falha explícita | Alto | Eliminado (fail-fast) |
| `FRONTEND_ORIGINS` ausente sem falha explícita | Alto | Já existia; `render.yaml` corrigido |
| Rotas com `requireManager` retornando 403 em vez de 401 | Médio | Eliminado |

---

## Riscos restantes (não tratados na Fase 1)

| Risco | Severidade | Fase |
|-------|-----------|------|
| Rate limiting em memória (zerado no restart) | Alto | Fase 2 |
| Sem refresh tokens / sem revogação de JWT | Alto | Fase 3 |
| `contentSecurityPolicy: false` no Helmet | Alto | Fase 2 |
| `const session = null` era pré-existente (já resolvido antes) | — | — |
| `/integrations/council/status` público (expõe config) | Médio | Fase 2 |
| App.jsx ~11k linhas sem code splitting | Médio | Fase 4 |
| Banco: JSONB único, sem índices, lock serializado | Crítico-arquitetural | Fase 4 |
| TOTP implementado sem biblioteca auditada | Médio | Fase 3 |
| Sem error boundary no React | Médio | Fase 2 |
| Sem HSTS / `Cache-Control: no-store` | Médio | Fase 2 |
| backend-dotnet abandonado no repo | Baixo | Qualquer momento |

---

## Próximos passos (Fase 2)

Prioridade recomendada para a próxima iteração:

1. **Rate limiting persistente** — `express-rate-limit` + Upstash Redis (free tier)
2. **Error boundary React** — `<ErrorBoundary>` no topo do tree, evita crash total da UI
3. **401 handler no frontend** — interceptor em `api.js` para redirecionar ao login
4. **CSP report-only** — ativar Content Security Policy em modo `report-only` inicialmente
5. **HSTS + `Cache-Control: no-store`** — headers em endpoints de dados clínicos
6. **Upgrade Render** — plano Starter elimina cold starts de 50-60s
7. **Proteger `/integrations/council/status`** — adicionar `requireAuth`

---

*Nenhuma alteração de UI/UX foi feita. Nenhuma refatoração de arquitetura iniciada. Fase 1 focada exclusivamente em segurança crítica.*
