// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Deploy oficial: AWS Amplify + Elastic Beanstalk + Aurora/RDS + Cloudflare

Este documento define fluxo oficial atual do Vitras. Arquivos e provedores antigos foram mantidos apenas como histórico em `docs/legacy/`.

## Visão geral

- Frontend: AWS Amplify
- Backend: AWS Elastic Beanstalk
- Banco: AWS Aurora PostgreSQL ou Amazon RDS for PostgreSQL
- Rede: Cloudflare para DNS, CDN, WAF e controle de borda

Fluxo:

1. `git push` em branch controlada.
2. Amplify executa build do frontend em `frontend-react/`.
3. Elastic Beanstalk publica backend de `backend/`.
4. Backend conecta em Aurora/RDS via `DATABASE_URL`.
5. Cloudflare expõe domínio, cache estático e camada WAF.

## Pré-requisitos

- conta AWS com acesso a Amplify, Elastic Beanstalk, IAM, S3, CloudWatch e Aurora/RDS;
- conta Cloudflare com zona do domínio;
- variáveis de ambiente definidas por ambiente;
- endpoints `/health` e `/readyz` respondendo sem autenticação.

## Frontend: AWS Amplify

Arquivo já presente:

- [amplify.yml](/C:/dev/vitras/amplify.yml)

Configuração esperada:

- App root: `frontend-react`
- Build command: `npm ci && npm run build`
- Output: `dist`
- Variável obrigatória: `VITE_API_URL`

Fluxo de deploy:

1. Conectar repositório no AWS Amplify.
2. Apontar branch desejada, preferencialmente `dev` para homologação e `main` para produção.
3. Confirmar uso de `amplify.yml`.
4. Configurar variáveis de ambiente no console do Amplify.
5. Validar build e publicação.

## Backend: AWS Elastic Beanstalk

Arquivo obrigatório para processo web:

- [backend/Procfile](/C:/dev/vitras/backend/Procfile)

Conteúdo:

```text
web: npm start
```

Fluxo de deploy:

1. Criar aplicação Elastic Beanstalk para plataforma Node.js 20+.
2. Configurar diretório de aplicação para `backend/`.
3. Instalar dependências com `npm install` ou `npm ci` durante pipeline.
4. Publicar pacote da aplicação.
5. Validar healthcheck em `/readyz`.

Healthcheck recomendado:

- path: `/readyz`
- método: `GET`
- timeout curto
- sem autenticação

Nota: `/readyz` retorna 503 durante boot, migrations e warming, e 200 apenas quando o processo
está pronto E o PostgreSQL está acessível. Não usar `/health` como HealthCheckPath do EB —
`/health` retorna 200 mesmo quando o banco falha após o boot, o que impede o EB de detectar
a instância degradada.

## Banco: Aurora/RDS

Padrão:

- engine PostgreSQL;
- acesso restrito por security groups;
- SSL habilitado;
- credenciais fora do código;
- backup automático e política de retenção ativos.

`DATABASE_URL` deve apontar para endpoint oficial do cluster/instância, com parâmetros compatíveis de SSL.

## Cloudflare

Uso esperado:

- DNS autoritativo;
- proxy do domínio público;
- WAF;
- cache estático para frontend;
- rate limiting e regras gerenciadas, quando aprovado pela operação.

Cloudflare não é origem principal de deploy do frontend neste padrão. Papel é borda e proteção.

## Variáveis obrigatórias

### Backend

- `NODE_ENV=production`
- `JWT_SECRET=<gerar-valor-forte>`
- `JWT_EXPIRES_IN=12h`
- `DATA_ENCRYPTION_KEY=<gerar-valor-forte>`
- `DATABASE_URL=<endpoint-aurora-ou-rds>`
- `FRONTEND_ORIGINS=<origens-permitidas>`
- `BACKUP_EXPORT_KEY=<gerar-valor-forte>`
- `ADMIN_SEED_KEY=<gerar-valor-forte>`
- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=none` quando frontend e backend estiverem em domínios cruzados

### Backend recomendadas

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `COUNCIL_VERIFY_MODE`
- `COUNCIL_VERIFY_PROVIDER`
- `COUNCIL_VERIFY_URL`
- `COUNCIL_VERIFY_TOKEN`

### Frontend

- `VITE_API_URL=<url-publica-backend>`

## Comandos essenciais

Build local do frontend:

```bash
cd frontend-react
npm ci
npm run build
```

Teste do backend:

```bash
cd backend
npm install
npm test
```

Healthcheck:

```bash
curl https://api.seu-dominio/readyz
```

## Rollback básico

Frontend:

1. selecionar build anterior no Amplify;
2. republicar versão estável;
3. validar carregamento do app e chamadas à API.

Backend:

1. selecionar versão anterior no Elastic Beanstalk;
2. reimplantar ambiente estável;
3. validar `/readyz`, autenticação e fluxo crítico.

Banco:

1. preferir snapshot/restore controlado em Aurora/RDS;
2. executar rollback de dados só com janela aprovada;
3. validar consistência clínica antes de reabrir operação.

## Troubleshooting inicial

| Sintoma | Verificação inicial | Ação |
|---|---|---|
| Frontend não publica | log do Amplify | validar `amplify.yml`, `npm ci`, `npm run build` |
| API fora do ar | health do Elastic Beanstalk | validar variáveis, porta, logs e status do ambiente |
| `/readyz` retorna 503 | app não pronto ou postgres inacessível | revisar `DATABASE_URL`, SSL, SG, credenciais e logs de boot |
| `/health` com erro | conectividade com banco (modo degradado) | revisar `DATABASE_URL`, SSL, SG e credenciais |
| CORS no browser | `FRONTEND_ORIGINS` | alinhar origem real sem barra final |
| Login falha após deploy | segredos divergentes | revisar `JWT_SECRET`, cookies e domínio |
| Lentidão | CloudWatch + banco | checar CPU, memória, pool e queries lentas |

## Observabilidade mínima

- frontend: logs de build no Amplify;
- backend: logs e health no Elastic Beanstalk/CloudWatch;
- banco: métricas e eventos em Aurora/RDS;
- borda: eventos, WAF e DNS no Cloudflare.

Runbook complementar: [docs/runbooks/observability.md](/C:/dev/vitras/docs/runbooks/observability.md)
