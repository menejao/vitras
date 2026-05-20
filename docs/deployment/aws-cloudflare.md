# Deploy: AWS App Runner (backend) + Cloudflare Pages (frontend)

Guia passo a passo para deploy em produção.

> **Pré-requisito:** conta AWS com permissões para App Runner, ECR e IAM.  
> **Pré-requisito:** conta Cloudflare com Pages ativo e domínio configurado.

---

## Visão geral da arquitetura

```
Usuário
  │
  ▼
Cloudflare Pages (frontend SPA)
  │  VITE_API_URL
  ▼
AWS App Runner (backend API)
  │  DATABASE_URL
  ▼
Neon PostgreSQL
```

- **Frontend**: Cloudflare Pages entrega os arquivos estáticos do build Vite
- **Backend**: AWS App Runner gerencia escalonamento automático e zero cold-start
- **Banco**: Neon PostgreSQL com connection pooler

---

## 1. Backend — AWS App Runner

### 1.1 Preparar repositório

O arquivo de configuração já está em `backend/apprunner.yaml`. Verifique:

```yaml
version: 1.0
runtime: nodejs20
build:
  commands:
    build:
      - npm ci --omit=dev
run:
  command: node src/server.js
  network:
    port: 8080
    env: PORT
  env:
    - name: NODE_ENV
      value: production
```

### 1.2 Criar serviço no App Runner

1. Acesse **AWS Console → App Runner → Create service**
2. **Source**: GitHub (conecte sua conta)
   - Repositório: `vitras`
   - Branch: `main`
   - Deployment trigger: Automatic
3. **Build settings**: detecta automaticamente via `apprunner.yaml`
4. **Service settings**:
   - Nome: `vitras-backend`
   - CPU: 0.5 vCPU (ajustar conforme carga)
   - Memória: 1 GB
   - Porta: 8080
5. **Health check**:
   - Protocol: HTTP
   - Path: `/health`
   - Interval: 10s
   - Timeout: 5s
   - Healthy threshold: 1
   - Unhealthy threshold: 3

### 1.3 Variáveis de ambiente

Configure no console App Runner → seu serviço → **Configuration → Environment variables**.

**Obrigatórias:**

```bash
NODE_ENV=production
JWT_SECRET=<openssl rand -hex 64>
DATA_ENCRYPTION_KEY=<openssl rand -hex 32>
DATABASE_URL=<connection string Neon com pooler>
FRONTEND_ORIGINS=https://seu-frontend.pages.dev,https://app.vitras.com.br
BACKUP_EXPORT_KEY=<openssl rand -hex 32>
ADMIN_SEED_KEY=<openssl rand -hex 32>
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
```

**Recomendadas:**

```bash
TWOFA_ISSUER=Vitras
ENABLE_BACKUP_EXPORT=true
ENABLE_ADMIN_SEED=false
UPSTASH_REDIS_REST_URL=<URL do Upstash>
UPSTASH_REDIS_REST_TOKEN=<token do Upstash>
COUNCIL_VERIFY_MODE=required
COUNCIL_VERIFY_PROVIDER=n8n
COUNCIL_VERIFY_URL=<URL do webhook>
COUNCIL_VERIFY_TOKEN=<token>
```

> Nunca commitar valores reais. Use o console AWS ou AWS Secrets Manager.

### 1.4 Variáveis de chave — como gerar

```bash
# JWT_SECRET
openssl rand -hex 64

# DATA_ENCRYPTION_KEY
openssl rand -hex 32

# BACKUP_EXPORT_KEY
openssl rand -hex 32

# ADMIN_SEED_KEY
openssl rand -hex 32
```

### 1.5 Banco de dados (Neon)

1. Crie projeto em [neon.tech](https://neon.tech)
2. Copie a connection string do **pooler** (não a direta)
3. A string deve incluir `sslmode=require`
4. Teste a conexão: `GET /health` após deploy deve retornar `{"status":"ok"}`

### 1.6 Validar deploy

```bash
curl https://<sua-url-apprunner>.awsapprunner.com/health
# Esperado: {"status":"ok","db":"connected"}
```

---

## 2. Frontend — Cloudflare Pages

### 2.1 Configuração do projeto

O `wrangler.toml` na raiz do repositório configura o deploy:

```toml
name = "vitras"
main = "worker.js"
compatibility_date = "2026-03-25"

[assets]
directory = "./frontend-react/dist"
binding = "ASSETS"
```

### 2.2 Variáveis de ambiente do build

No painel Cloudflare Pages → seu projeto → **Settings → Environment variables**:

```
VITE_API_URL=https://<sua-url-apprunner>.awsapprunner.com
```

> Esta variável é embutida no build. Mude e faça redeploy se a URL do backend mudar.

### 2.3 Deploy via CLI (manual)

```bash
# 1. Build do frontend
cd frontend-react
npm ci
npm run build

# 2. Deploy via Wrangler (da raiz do projeto)
cd ..
npm run deploy
```

O comando `npm run deploy` na raiz executa `wrangler deploy`.

### 2.4 Deploy automático (CI/CD)

Configure no Cloudflare Pages → seu projeto → **Settings → Build & deployments**:

- Framework preset: Vite
- Build command: `cd frontend-react && npm ci && npm run build`
- Build output directory: `frontend-react/dist`
- Root directory: `/` (raiz do repositório)
- Branch de produção: `main`

### 2.5 Domínio customizado

Cloudflare Pages → seu projeto → **Custom domains**:

1. Adicione `app.vitras.com.br` (ou seu domínio)
2. Cloudflare configura o DNS automaticamente se o domínio estiver na conta
3. Aguarde propagação (geralmente < 5 min)

---

## 3. Configuração de CORS

O backend valida a origem de toda requisição com cookie auth. Configure `FRONTEND_ORIGINS` com **exatamente** a URL do frontend (sem trailing slash):

```
FRONTEND_ORIGINS=https://app.vitras.com.br
```

Múltiplas origens (preview + produção):

```
FRONTEND_ORIGINS=https://app.vitras.com.br,https://vitras.pages.dev
```

---

## 4. Validação pós-deploy

```bash
# Backend health
curl https://<apprunner-url>/health

# Frontend carrega
open https://app.vitras.com.br

# Teste de login
curl -X POST https://<apprunner-url>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@exemplo.com","password":"..."}'
```

Checklist completo: `docs/deployment/GO_LIVE_CHECKLIST.md`

---

## 5. Backup automático

Configure os segredos no GitHub (Settings → Secrets → Actions):

| Secret | Valor |
|---|---|
| `BACKUP_EXPORT_URL` | URL do App Runner |
| `BACKUP_EXPORT_KEY` | Mesmo valor da variável no App Runner |

O workflow `.github/workflows/nightly-backup.yml` executa diariamente e salva o backup como artifact por 30 dias.

---

## 6. Rotação de chaves

Ver `docs/security/KEY_ROTATION_PLAN.md` e `docs/security/SECRETS_ROTATION.md`.

Script auxiliar: `scripts/rotate-encryption-key.js`

---

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `/health` retorna 500 | `DATABASE_URL` inválida | Verificar string Neon + SSL |
| CORS error no browser | `FRONTEND_ORIGINS` incorreto | Conferir URL exata sem trailing slash |
| Login retorna 401 | `JWT_SECRET` diferente entre deploys | Garantir valor consistente |
| 2FA não funciona | `TWOFA_ISSUER` diferente do configurado | Não alterar após usuários terem configurado 2FA |
| Rate limit imediato | Upstash não configurado | Verificar `UPSTASH_REDIS_REST_URL` e token |

---

Copyright (c) 2026 Vitras. Todos os direitos reservados.
