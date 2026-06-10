# AMBIENTE DE STAGING — SaudeUbs/SIGUS

Data de referência: 2026-05-14

---

## 1. TOPOLOGIA

| Componente | Produção | Staging |
|------------|----------|---------|
| Backend | Render `saude-backend` | Render `saude-backend-staging` |
| Banco | Neon branch `main` | Neon branch `staging` (separada) |
| Frontend | Cloudflare Worker `gestaopacientes` | Cloudflare Worker `gestaopacientes-staging` |
| DNS | `api.saudeubs.com.br` | `api-staging.saudeubs.com.br` (ou onrender.com) |

> **Regra fundamental:** bancos de produção e staging são completamente separados. Nunca reutilizar DATABASE_URL de produção em staging.

---

## 2. CRIAR BANCO DE STAGING NO NEON

1. Neon Dashboard → Projeto → Branches → **"Create branch"**
2. Nome: `staging`
3. Branch from: `main` (cópia inicial dos dados de produção — opcional)
4. Anotar a connection string do pooler da branch staging
5. Nunca conectar a branch `main` a serviços de staging

---

## 3. CRIAR SERVIÇO STAGING NO RENDER

### Opção A — Via Dashboard
1. Render Dashboard → **"New Web Service"**
2. Conectar ao mesmo repositório GitHub
3. Branch: `main` (ou branch de feature)
4. Nome: `saude-backend-staging`
5. Root directory: `backend`
6. Build command: `npm install`
7. Start command: `npm start`
8. Plano: Free (staging pode ter cold start)
9. Configurar variáveis de ambiente (seção 4)

### Opção B — Adicionar ao render.yaml

```yaml
# render.yaml — adicionar ao bloco services:
  - type: web
    name: saude-backend-staging
    env: node
    plan: free
    rootDir: backend
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_VERSION
        value: 22
      - key: NODE_ENV
        value: staging
      - key: JWT_SECRET
        sync: false
      - key: DATABASE_URL
        sync: false           # deve apontar para Neon branch staging
      - key: DATA_ENCRYPTION_KEY
        sync: false
      - key: FRONTEND_ORIGINS
        sync: false
      - key: BACKUP_EXPORT_KEY
        sync: false
      - key: TWOFA_ISSUER
        value: SaudeUBS-Staging
```

> **Não commitar secrets.** Todos os campos `sync: false` devem ser configurados manualmente no painel.

---

## 4. VARIÁVEIS DE AMBIENTE DO STAGING

| Variável | Valor em staging |
|----------|-----------------|
| `NODE_ENV` | `staging` |
| `DATABASE_URL` | Connection string da branch Neon `staging` |
| `DATA_ENCRYPTION_KEY` | **Chave separada de produção** (dados de staging não devem ser decriptáveis com chave de prod) |
| `JWT_SECRET` | Segredo separado de produção |
| `FRONTEND_ORIGINS` | URL do worker de staging |
| `BACKUP_EXPORT_KEY` | Chave separada |
| `TWOFA_ISSUER` | `SaudeUBS-Staging` |

> Usar chaves diferentes em staging isola completamente os dois ambientes: um token de staging não funciona em produção.

### Implicação de IS_PROD=false em staging

`backend/src/config.js` define `IS_PROD = NODE_ENV === "production"`. Com `NODE_ENV=staging`, `IS_PROD` é `false` **intencionalmente**: staging não é produção e não deve ter o mesmo gate de proteção hard-fail.

Consequência direta: o **boot-guard de migrations** (`server.js` — bloco que chama `runMigrations()` e aborta com `process.exit(1)` se a migração falhar em modo prod) **não executa em staging**. As migrations ainda rodam normalmente via `RUN_MIGRATIONS=true`; o que não acontece é o abort-on-failure forçado do boot-guard.

Para verificar o estado real das migrations em staging, executar manualmente antes de cada ciclo de smoke:

```bash
DATABASE_URL=<staging-url> node backend/src/migrations/check-status.js
# Exit 0 = todas aplicadas; Exit 1 = pendentes ou DB inacessível
```

Esse comportamento é **aceitável para o piloto** e está documentado como KI-08 no backlog do Sprint 5, que introduzirá um gate equivalente para ambientes staging (provavelmente via variável `REQUIRE_MIGRATION_GUARD=true` independente de NODE_ENV).

---

## 5. DEPLOY DO FRONTEND EM STAGING

```bash
cd frontend-react
npm install
npm run build

# Deploy para worker de staging
npx wrangler deploy --name gestaopacientes-staging
```

O `wrangler.toml` base aponta para o worker de produção. Para staging, passar `--name` no CLI.

Verificar após deploy:
```bash
npx wrangler deployments list --name gestaopacientes-staging
```

---

## 6. FLUXO DE VALIDAÇÃO EM STAGING

Antes de qualquer deploy em produção, executar este fluxo:

```
1. Fazer push para main (ou branch de feature)
2. Aguardar deploy automático do Render staging
3. Verificar health: curl https://saude-backend-staging.onrender.com/health
4. Executar smoke tests:
   node scripts/smoke-production.js --base https://saude-backend-staging.onrender.com
5. Testar funcionalidades alteradas manualmente
6. Se OK: promover para produção (push para main / redeploy prod)
```

---

## 7. PROMOVER STAGING PARA PRODUÇÃO

### Código
Push para `main` já dispara auto-deploy de produção no Render.

### Dados (restore de staging para produção)
Não fazer restore de dados de staging em produção diretamente.
Para restaurar dados em produção, usar o procedimento de Neon PITR documentado em `RUNBOOK_BACKUP_RESTORE.md`.

---

## 8. DIFERENÇAS ENTRE AMBIENTES

| Comportamento | Produção | Staging |
|---------------|----------|---------|
| Cold start | Não (plano pago) | Sim (plano free) |
| Dados reais | Sim | Não (dados de teste) |
| 2FA obrigatório para admin | Sim | Recomendado testar |
| Rotação de secrets | Semestral | Não necessário |
| Alertas de uptime | Configurar | Não necessário |
| Logs de auditoria | Retidos | Efêmeros |

---

## 9. DESTRUIR AMBIENTE DE STAGING

Após testes concluídos (ex: restore mensal conforme `RUNBOOK_BACKUP_RESTORE.md` seção 6):

1. Render Dashboard → `saude-backend-staging` → Settings → Delete Service
2. Neon Dashboard → Branches → `staging` → Delete branch
3. Cloudflare Dashboard → Workers → `gestaopacientes-staging` → Delete

> Destruir branch de staging após cada teste de restore isola dados de teste e evita acúmulo de custo.
