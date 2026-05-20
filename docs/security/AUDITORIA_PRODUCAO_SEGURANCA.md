# Auditoria de Produção, Segurança e Arquitetura — SaudeUbs/SIGUS

**Data:** 2026-05-13  
**Escopo:** frontend-react, backend Node (server.js 5688 linhas), backend-dotnet, Render + Neon + Cloudflare Workers  
**Método:** leitura estática de código, inspeção de configuração, análise de histórico git  
**Não foram feitas:** alterações de código, commits, testes dinâmicos (pentest)

---

## 1. Diagnóstico Geral

### Veredito: **NÃO pronto para produção com dados reais de pacientes**

O sistema tem fundação sólida (scrypt, AES-256-GCM, audit log com hash SHA-256, anonimização LGPD), mas apresenta falhas arquiteturais que tornam o uso com dados clínicos reais inaceitável sem correção prévia. As ameaças não são teóricas — são vetores exploráveis com nível básico de conhecimento técnico.

| Nível | Quantidade | Exemplos |
|-------|-----------|---------|
| **Crítico** | 5 | Credenciais demo hardcoded; rotas sem `requireAuth`; JSONB único; rate limit em memória; token sem expiração gerenciada |
| **Alto** | 6 | CSP desativado; `ssl: rejectUnauthorized: false`; sem refresh token; 500 em rotas autenticadas sem token; ENCRYPT_KEY em `.env.production` em disco; backend-dotnet ativo no repo |
| **Médio** | 8 | Monólito App.jsx ~11k linhas; `const session = null`; sem error boundary; `FRONTEND_ORIGINS` ausente no render.yaml; logs sem redação de PII; TOTP caseiro; sem paginação em listagens; `isManager` retorna true para role `nurse` |
| **Baixo** | 5 | backend-dotnet abandonado; sem TypeScript; sem testes automatizados; `git-snapshot` sem verificação de integridade; ausência de `.nvmrc` |

---

## 2. Segurança

### 2.1 CORS

**Código (`server.js` linha 440-451):**
```js
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);   // ← requisições sem Origin passam sempre
    if (!FRONTEND_ORIGINS.length) {
      if (!IS_PROD || CORS_ALLOW_ALL) return callback(null, true);
      return callback(new Error("Origem não permitida por CORS"));
    }
    ...
  }
}));
```

- `!origin` → requests sem cabeçalho `Origin` (curl, Postman, server-to-server) sempre passam, independente do ambiente.  
- Se `FRONTEND_ORIGINS` não estiver configurado em produção (e **não está** no `render.yaml`), o bloco `!FRONTEND_ORIGINS.length` entra em ação. Em `IS_PROD=true` sem `CORS_ALLOW_ALL`, lança erro — mas isso quebra o app, não protege.  
- **Ação:** Configurar `FRONTEND_ORIGINS` no Render. Remover o caso `!origin → true` ou restringir a IPs conhecidos.

### 2.2 Headers HTTP / Helmet

- Helmet ativado com `contentSecurityPolicy: false` (linha 437). Sem CSP, XSS via `innerHTML` (se houver), injeção de scripts em erros, ou manipulação de resposta JSON não são mitigados pelo browser.  
- `crossOriginResourcePolicy: same-site` correto.  
- Headers manuais adicionados: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` — bom.  
- Faltam: `Strict-Transport-Security` (HSTS), `Permissions-Policy`, `Cache-Control: no-store` em endpoints de dados clínicos.

### 2.3 JWT

- HS256 com `issuer` e `audience` corretos (linhas 1001-1018). Bom.  
- Expiração padrão `12h` via `JWT_EXPIRES_IN` (env var). **Se env var não definida no Render, padrão é indefinido** → tokens sem expiração.  
- `JWT_SECRET` tem fallback hardcoded `"dev-only-jwt-secret-change-me"` (linha 23), mas com guard de produção que lança exceção (linhas 45-50). Correto.  
- **Sem refresh token**: token de 12h sem renovação. Usuário precisa fazer login novo após expirar. Sem revogação — logout não invalida o token, ele continua válido até expirar. Sessão pode ser usada por terceiros que capturem o token.

### 2.4 Armazenamento de Token (Frontend)

- Token armazenado em `sessionStorage` (perdido ao fechar aba). Razoável para dados sensíveis.  
- **Bug crítico:** `const session = null` em `AppInner` (comentado/hardcoded) faz o token sumir no page refresh. Usuário é deslogado em qualquer refresh. Isso é provavelmente a causa do comportamento documentado "sessão perdida".

### 2.5 Hash de Senha

- `crypto.scryptSync` com salt de 16 bytes aleatórios, N=16384 (padrão), output 64 bytes (linha 539-542). **Bom.**  
- `timingSafeEqual` no compare (linha 557-558). **Bom.**  
- Migrações de senhas antigas em plaintext via `migrateLegacyPlaintextPasswords()` na inicialização. **Bom.**

### 2.6 Rate Limiting

- Rate limiting implementado via `Map` em memória (linhas 659-692). **Problema grave**: ao reiniciar/recloy o processo no Render, o mapa limpa e ataques de força bruta recomeçam do zero.  
- Parâmetros configuráveis via env (`AUTH_MAX_ATTEMPTS`, `AUTH_WINDOW_MS`, etc.), mas **não estão no `render.yaml`**.  
- `globalRateLimit` também em memória — mesma fragilidade.  
- **Ação:** Usar `express-rate-limit` com store Redis/Upstash, ou ao menos persistir contagem no DB.

### 2.7 Credenciais Demo Hardcoded

```js
// server.js linha ~910-983
const demoEmail = "ana@clinica.local";
const demoPassword = "123456";
```

`ensureDemoManagerIfNeeded` é chamado em **todo login que falha**. Se `ana@clinica.local` não existir no banco, ele **cria o usuário com senha `123456`**. Isso significa:
- Qualquer pessoa que conheça o email consegue acesso ao sistema como `nurse_manager`.
- A função cria/recria o usuário toda vez que o DB é resetado.
- **CRÍTICO para produção com dados reais.**

### 2.8 Rotas sem `requireAuth`

Várias rotas acessam `req.user` diretamente sem o middleware `requireAuth`. Análise de impacto:

| Rota | Sem token → comportamento |
|------|--------------------------|
| `GET /me` | **crash 500** (TypeError: `req.user.id` of undefined) |
| `GET /me/2fa/status` | **crash 500** |
| `POST /me/2fa/setup` | **crash 500** |
| `GET /patients` | retorna array vazio (sem erro, sem 401) |
| `GET /patients/protocol-summaries` | provavelmente crash ou retorno vazio |
| `POST /ai/team/priorities` | executa com `req.user = undefined` (dados vazios) |
| `POST /ai/team/data-quality` | idem |
| `POST /ai/chat` | idem |
| `POST /ai/patients/:id/*` | retorna 403 via `getPatientOrError` (não 401) |
| `POST /patients/:id/appointments` | retorna 403 (não 401) |
| `POST /patients/:id/records` | retorna 403 (não 401) |
| `PATCH /tasks/:id` | acessível (comportamento indefinido) |

Rotas que retornam 500 sem token são um vetor de DoS trivial (flood de `/me` sem token = 500 por requisição).  
Rotas que retornam 403 ao invés de 401 ocultam o motivo real da rejeição.

### 2.9 Backup Export

```js
app.get("/admin/backup/export", async (req, res) => {
  const providedKey = req.headers["x-backup-key"] || req.query.key;  // ← key via querystring
```

A chave de backup aceita via **query string** (`?key=...`). Query strings são logadas em access logs, histórió de browser, CDN logs, e Referrer headers. **A chave de backup pode vazar passivamente.**

### 2.10 Exposição de Configuração

```js
app.get("/integrations/council/status", (_req, res) => {
  return res.json({
    mode: config.mode,
    provider: config.provider,
    configured: Boolean(config.url),  // revela se integração existe
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    requireEvidence: config.requireEvidence
  });
});
```

Endpoint público (sem autenticação). Expõe detalhes internos de configuração que auxiliam reconhecimento.

### 2.11 Criptografia de Campos Sensíveis

- CPF, CNS, segredos 2FA criptografados com AES-256-GCM usando `DATA_ENCRYPTION_KEY` (db.js linhas 32-62). **Bom.**  
- `frontend-react/.env.production` contém `ENCRYPT_KEY=XwjkmRPv/...` — esta chave NÃO está no histórico git (protegida por `.gitignore`), mas existe em disco. Se o arquivo vazar (backup, S3, deploy acidental), a chave fica exposta. O arquivo deve ser gerenciado como segredo, não como arquivo de configuração.

---

## 3. Backend

### 3.1 Organização do `server.js`

- **5688 linhas em um único arquivo.** Inclui: configuração de app, middlewares, helpers de data, lógica de protocolo clínico, lógica de TOTP, lógica de conselhos, todas as rotas, seed de dados, lógica de anonimização LGPD.  
- Impossível fazer code review efetivo, dificulta manutenção, aumenta risco de regressões em alterações cirúrgicas.  
- **Ação:** Separar em módulos: `routes/`, `middlewares/`, `helpers/`, `services/`.

### 3.2 Middlewares

- Sem middleware global de autenticação opcional (soft auth). Cada rota gerencia `req.user` isoladamente, com resultados inconsistentes.  
- Sem middleware de validação de payload (Zod, Joi, express-validator). Validação manual espalhada por 70+ rotas.  
- Sem middleware de tratamento de erros assíncronos — erros em `async` handlers sem `try/catch` chegam como `UnhandledPromiseRejection`.

### 3.3 Validação de Payload

- Validação presente em auth/register e algumas rotas. Ausente ou inconsistente na maioria das rotas de mutação.  
- Sem limite de tamanho em campos de texto livre (notes, details, comorbidities, medications) além do `express.json({ limit: "1mb" })` global.

### 3.4 Respostas de Erro

- Inconsistência: algumas rotas retornam `{ error: "msg" }`, outras retornam HTTP 500 raw do catch global.  
- Rotas sem `requireAuth` retornam 403 em vez de 401 quando sem token — confunde clientes.  
- O catch global (linha 5661-5666) captura apenas erros CORS e tudo mais vira 500. Erros de banco (`PgError`, `TypeError`) chegam como 500 genérico sem logging adequado.

### 3.5 Conexão Neon / PostgreSQL

```js
// db.js linha 14-19
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
});
```

- `rejectUnauthorized: false` desabilita verificação do certificado TLS do servidor. Vulnerável a MITM entre app e banco. Para Neon, o certificado é válido — mudar para `ssl: { rejectUnauthorized: true }` ou `ssl: true`.
- `max: 5` pool size conservador. No Render free plan, com cold start + 5 conexões abertas, pode esgotar rapidamente sob carga ou múltiplos restarts.

### 3.6 Antipadrão de Banco: JSONB Único

```js
// db.js linhas 184-201: criação da tabela
CREATE TABLE IF NOT EXISTS app_state (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL
)
-- UMA linha contém TODA a aplicação
```

- Todo paciente, usuário, consulta, tarefa, mensagem, log de auditoria, registro clínico fica em **um único objeto JSON** serializado em um único JSONB.  
- `withDb` usa `FOR UPDATE` lock — **serializa todas as escritas**. Sob carga paralela (ex: múltiplos ACS registrando visitas simultaneamente), as requisições ficam em fila.  
- Sem índices possíveis em campos internos do JSONB.  
- Crescimento ilimitado: sem paginação, sem arquivamento, sem particionamento. Um time com 1000 pacientes e 5 anos de histórico pode ter um JSONB de 50MB+ sendo lido inteiro em cada request.  
- **Este antipadrão é o maior risco técnico do sistema.**

### 3.7 Usuários Demo / Seed

- `ensureDemoManagerIfNeeded` recria `ana@clinica.local` / `123456` em qualquer ambiente que não tenha o usuário.  
- `POST /admin/patients/reset-populate` limpa e recria toda a base clínica. Protegido por `ADMIN_SEED_KEY` (env), mas **se a key não estiver configurada, qualquer usuário autenticado com role gestor/enfermeira pode zerar o banco**.

### 3.8 Audit Log

- Implementado com hash SHA-256 encadeado. Bom design para detectar adulteração.  
- Armazenado dentro do mesmo JSONB — sujeito ao mesmo bloqueio e sem indexação.  
- Sem retenção configurável — log cresce indefinidamente no JSONB.

---

## 4. Frontend

### 4.1 Estrutura / App.jsx

- `App.jsx` tem aproximadamente **11.000 linhas**. Contém: roteamento, estado global, todas as páginas, todos os modais, toda a lógica de negócio do cliente.  
- Sem code splitting (`React.lazy`/`Suspense`). O bundle inteiro é carregado na primeira visita — tempo de carregamento inicial alto, especialmente em conexões lentas (UBS).  
- Sem `ErrorBoundary`. Qualquer erro de render em qualquer componente derruba a aplicação inteira.

### 4.2 Gestão de Sessão

```js
// App.jsx (AppInner) — BUG CONFIRMADO
const session = null;  // ← sempre null → token nunca é lido
```

- Token em `sessionStorage` mas `session` é sempre `null`. A variável `session` deveria ler `sessionStorage.getItem("token")` (ou similar) na inicialização. Como está hardcoded como `null`, o usuário é deslogado a cada page refresh.  
- Ao fazer logout, o token não é invalidado no servidor (sem revogação de JWT).

### 4.3 Tratamento de Erros

- `api.js` tem retry logic bem implementada (retryable statuses, jitter, exponential backoff). Bom.  
- Sem tratamento diferenciado de 401 (token expirado) vs 403 (sem permissão). Ambos caem na mesma mensagem genérica.  
- Sem interceptor global para redirecionar para login em 401.

### 4.4 Rotas Protegidas

- Proteção de rotas feita via condicional no render do `App.jsx`. Funciona, mas sem `react-router` protegendo rotas declarativamente.  
- Sem verificação de role no frontend para esconder navegação — depende apenas do backend para autorização.

### 4.5 Variáveis de Ambiente

- `VITE_API_URL` exposto no bundle (comportamento correto para Vite, não é secret).  
- `ENCRYPT_KEY` em `.env.production` (não commitado) — investigar se é usado no frontend ou é resquício de refactoring. Se for segredo real usado em runtime no frontend, é um problema grave (client-side secrets são sempre expostos).

### 4.6 Build de Produção

- Cloudflare Workers via `wrangler deploy`. Build Vite correto.  
- Sem análise de bundle size configurada.  
- Sem source maps em produção (bom para segurança).

---

## 5. Banco de Dados (Neon)

### 5.1 Estrutura

| Tabela | Conteúdo |
|--------|---------|
| `app_state` | **UMA linha** com toda a aplicação em JSONB |

Não existem tabelas separadas. Toda a estrutura relacional foi substituída por um único documento JSON.

### 5.2 Índices

Nenhum. Impossível criar índices em campos dentro do JSONB sem extraí-los como colunas.

### 5.3 Migrações

Sem sistema de migrações (Flyway, Liquibase, node-pg-migrate, Drizzle). A "migração" é `ensureDbShape` em runtime — adiciona campos defaults mas nunca remove ou transforma. Sem histórico de schema, sem rollback, sem versionamento.

### 5.4 Backup

- `GET /admin/backup/export` exporta snapshot criptografado. Funcional.  
- Backup manual/ad-hoc. Sem schedule automatizado, sem teste de restore.  
- Neon tem Point-in-Time Recovery (PITR) se o plano suportar — verificar se está ativo.

### 5.5 LGPD

- Anonimização implementada (`anonymizePatientBundle`): apaga nome, CPF, CNS, endereço, dados clínicos.  
- Soft delete não implementado (delete físico).  
- Privacy requests (titular de dados) implementadas com workflow de aprovação. Bom.  
- Sem TTL/retenção automática de dados antigos.

### 5.6 Dados Sensíveis

- CPF, CNS, segredos 2FA criptografados no banco com AES-256-GCM. **Bom.**  
- Senhas com scrypt. **Bom.**  
- Dados clínicos (consultas, prontuários) armazenados em plaintext no JSONB.

---

## 6. Deploy

### 6.1 Render (Backend)

- Plano **free**: cold start de 50-60s após 15min de inatividade. Para sistema clínico, inaceitável em produção real.  
- `healthCheckPath: /health` configurado. Bom.  
- `render.yaml` **não inclui** as seguintes env vars críticas:
  - `FRONTEND_ORIGINS` → CORS quebrado sem ela
  - `JWT_EXPIRES_IN` → tokens sem expiração
  - `AUTH_MAX_ATTEMPTS` / `AUTH_WINDOW_MS` → rate limit sem valor definido
  - `DATA_ENCRYPTION_KEY` → sem ela, criptografia de CPF/CNS não funciona
  - `BACKUP_EXPORT_KEY` → backup export retorna 403 sempre
  - `TWOFA_ISSUER` → TOTP quebrado
- Sem configuração de `NODE_ENV=production` explícita no `render.yaml`.

### 6.2 Cloudflare Workers (Frontend)

- Deploy via `wrangler deploy`. Funcional.  
- Assets cacheados na edge — bom para performance.  
- CORS do worker não está explicitamente configurado (depende do Vite build e do backend).

### 6.3 Pipeline de Build / Deploy

- Sem CI/CD configurado para testes antes do deploy.  
- `git-snapshot.yml` cria branches diários automaticamente — útil para rollback manual, mas não é um sistema de rollback automatizado.  
- Sem smoke tests pós-deploy.

### 6.4 Logs

- Logging via `console.log` em formato: `[req:ID] METHOD PATH STATUS DURATIONms user=ID ip=IP`.  
- Logs incluem `user=ID` e `ip=IP` — sem redação de dados pessoais.  
- Sem estrutura JSON para ingestão por ferramentas (Datadog, Papertrail, Grafana Loki).  
- Render captura stdout — logs visualizáveis no dashboard.

### 6.5 Variáveis de Ambiente

- `.env.example` no backend documenta todas as vars. Bom.  
- `frontend-react/.env.production` em disco com `ENCRYPT_KEY` — gerenciar como segredo.  
- `frontend-react/.env.example` correto (aponta para localhost).

---

## 7. Checklist de Produção

### OBRIGATÓRIO antes de produção com dados reais

- [ ] **Remover ou condicionar `ensureDemoManagerIfNeeded`** — em produção, nunca criar usuário com senha hardcoded
- [ ] **Adicionar `requireAuth` em rotas que acessam `req.user`** sem middleware (`/me`, `/me/2fa/*`, `/patients`, `/tasks`, `/ai/*`)
- [ ] **Configurar `FRONTEND_ORIGINS`** no Render (CORS inoperante sem ela)
- [ ] **Configurar `JWT_EXPIRES_IN`** no Render (tokens sem expiração)
- [ ] **Configurar `DATA_ENCRYPTION_KEY`** no Render (criptografia CPF/CNS inoperante)
- [ ] **Corrigir `const session = null`** → ler token do sessionStorage
- [ ] **Rate limit persistente** — substituir Map em memória por store que sobrevive restart
- [ ] **Mudar `ssl: { rejectUnauthorized: false }`** para `ssl: true` na conexão Neon
- [ ] **Remover backup key de query string** — aceitar apenas via header `x-backup-key`
- [ ] **Upgrade para plano pago no Render** — eliminar cold starts
- [ ] **Proteger `/integrations/council/status`** com autenticação ou remover

### RECOMENDADO antes de produção

- [ ] Ativar CSP no Helmet (modo report-only inicialmente)
- [ ] Adicionar `HSTS` header
- [ ] Adicionar `Cache-Control: no-store` em endpoints de dados clínicos
- [ ] `error boundary` no React para evitar crash total da UI
- [ ] Tratamento de 401 no frontend → redirect automático para login
- [ ] Remover `backend-dotnet` do repo ou mover para branch separada
- [ ] Configurar todas as env vars faltantes no `render.yaml`
- [ ] Adicionar `NODE_ENV=production` explícito no render.yaml
- [ ] Endpoint `/admin/patients/reset-populate` protegido com `ADMIN_SEED_KEY` obrigatório

### PODE AGUARDAR (próximas sprints)

- [ ] Refatorar `server.js` em módulos
- [ ] Refatorar `App.jsx` com code splitting
- [ ] Migrar banco de JSONB único para tabelas relacionais
- [ ] Sistema de migrações de banco
- [ ] Refresh tokens / renovação de sessão
- [ ] TypeScript (backend e frontend)
- [ ] Suite de testes automatizados
- [ ] Logging estruturado (JSON) com ingestão em ferramenta de observabilidade
- [ ] Paginação em listagens de pacientes/logs

---

## 8. Plano de Ação

### Fase 1 — Correções Críticas (antes de qualquer dado real)

**Estimativa: 1–2 dias de trabalho**

1. **`ensureDemoManagerIfNeeded`:** Envolver em `if (process.env.NODE_ENV !== "production")` ou remover completamente. Credencial demo só em ambiente de desenvolvimento.
2. **`requireAuth` faltante:** Adicionar middleware em todas as rotas que acessam `req.user`. Lista mínima: `/me`, `/me/2fa/*`, `/patients` (GET/POST/PUT/DELETE), `/tasks`, `/ai/*` (exceto `/ai/status`).
3. **`const session = null`:** Corrigir para ler de `sessionStorage` na inicialização do componente `AppInner`.
4. **Env vars obrigatórias no Render:** `FRONTEND_ORIGINS`, `JWT_EXPIRES_IN`, `DATA_ENCRYPTION_KEY`, `BACKUP_EXPORT_KEY`.
5. **Backup key via query string:** Remover suporte a `req.query.key` — apenas `x-backup-key` header.

### Fase 2 — Estabilidade (antes de usuários não-técnicos)

**Estimativa: 3–5 dias**

1. **Rate limiting persistente:** `express-rate-limit` + Upstash Redis (plano free suporta) ou armazenar contadores no banco.
2. **`ssl: rejectUnauthorized: false`:** Mudar para `ssl: true` na Pool do Neon.
3. **Error boundary:** Adicionar `<ErrorBoundary>` no topo do React tree.
4. **401 handler no frontend:** Interceptor em `api.js` para redirecionar login em 401.
5. **CSP em modo report-only:** `contentSecurityPolicy: { directives: { reportUri: '/csp-report' } }`.
6. **HSTS e `Cache-Control: no-store`** em rotas de dados.
7. **Upgrade Render:** Plano Starter ($7/mês) elimina cold starts.

### Fase 3 — Segurança Avançada (antes de escalar times)

**Estimativa: 1–2 semanas**

1. **Refresh tokens:** Implementar `POST /auth/refresh` com refresh token de longa duração (7–30 dias) e access token de curta duração (15–60 min).
2. **Revogação de JWT:** Lista de tokens revogados no banco (ou integração com Redis).
3. **CSP restritivo:** Ativar CSP em enforce mode com diretivas adequadas.
4. **TOTP com biblioteca auditada:** Substituir implementação caseira por `otplib` ou `speakeasy`.
5. **Auditoria de payloads:** Validação com Zod em todas as rotas.

### Fase 4 — Melhoria Estrutural (roadmap técnico)

**Estimativa: semanas a meses**

1. **Banco relacional normalizado:** Migrar de JSONB único para tabelas (`patients`, `appointments`, `users`, etc.). Usar Drizzle ORM ou node-pg-migrate.
2. **Refactor server.js:** Separar em `routes/auth.js`, `routes/patients.js`, `services/protocol.js`, etc.
3. **Refactor App.jsx:** Code splitting com `React.lazy`, separar em páginas/componentes independentes.
4. **TypeScript:** Adicionar incrementalmente, começando pelo backend.
5. **CI/CD:** GitHub Actions com lint + testes + deploy automático em PR aprovado.
6. **Testes:** Vitest + Supertest para rotas críticas (auth, patients CRUD, LGPD).

---

## Apêndice: Arquivos Auditados

| Arquivo | Linhas | Observação |
|---------|--------|-----------|
| `backend/src/server.js` | 5688 | Principal — rotas, middlewares, helpers |
| `backend/src/db.js` | ~300 | Abstração dual-driver (PostgreSQL/arquivo) |
| `backend/src/ai.js` | ~500 | Lógica de análise clínica local (sem LLM) |
| `backend/package.json` | — | Deps mínimas, sem bcrypt/zod/TypeScript |
| `backend/.env.example` | — | Documentação de vars (completo) |
| `render.yaml` | — | Deploy config (incompleto) |
| `frontend-react/src/api.js` | 225 | Camada HTTP com retry |
| `frontend-react/src/App.jsx` | ~11000 | Monólito (lido parcialmente) |
| `frontend-react/.env.production` | — | Contém ENCRYPT_KEY (não em git) |
| `frontend-react/.env.example` | — | Correto |
| `.github/workflows/git-snapshot.yml` | 48 | Snapshots automáticos |
| `backend-dotnet/` | — | Abandonado, remover |

---

*Relatório gerado por análise estática. Nenhum código foi alterado. Nenhum commit foi criado.*
