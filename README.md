// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Vitras

Sistema clínico para APS/ESF com frontend React + Vite, backend Node.js + Express e operação orientada a estabilidade, segurança e sustentabilidade de longo prazo.

## Visão geral

O Vitras apoia fluxos clínicos e operacionais de atenção primária, incluindo pacientes, agenda, fila/recepção, prontuário, exames, encaminhamentos, vacinas, farmácia, insumos, auditoria e controle de acesso.

---

## Arquitetura atual

| Serviço        | Plataforma                    | Plano  |
|----------------|-------------------------------|--------|
| Frontend       | Vercel                        | Free   |
| Portal Cidadão | Vercel (projeto separado)     | Free   |
| Backend API    | Render (Web Service)          | Free   |
| Banco de dados | Neon (PostgreSQL serverless)  | Free   |
| DNS / edge     | Cloudflare (opcional)         | Free   |

Fluxo macro:

```
Usuário → Vercel (frontend-react) → Render (backend) → Neon (PostgreSQL)
```

---

## Stack

| Camada    | Stack                                                    |
|-----------|----------------------------------------------------------|
| Frontend  | React 18, Vite 5                                         |
| Backend   | Node.js 22, Express 4, ESM                               |
| Banco     | PostgreSQL (Neon serverless) / JSON local (dev)          |
| Segurança | JWT, TOTP, Helmet, CORS, rate limit, AES-256-GCM         |
| Deploy    | Vercel (frontend) + Render (backend) + Neon (DB)         |

---

## Como rodar localmente

Pré-requisitos: Node.js 22+, npm 10+

```bash
# Backend
cd backend
cp .env.example .env   # editar DATABASE_URL, JWT_SECRET, etc.
npm install
npm run dev            # http://localhost:3001

# Frontend
cd frontend-react
cp .env.example .env.development.local
# Editar VITE_API_URL=http://localhost:3001
npm install
npm run dev            # http://localhost:5174
```

---

## Variáveis de ambiente

### Backend (Render)

| Variável                    | Obrigatória | Descrição                                                   |
|-----------------------------|-------------|-------------------------------------------------------------|
| `DATABASE_URL`              | ✅ Sim       | Connection string do Neon (inclui `?sslmode=require`)       |
| `JWT_SECRET`                | ✅ Sim       | Segredo para assinar JWT (mín. 32 chars)                    |
| `DATA_ENCRYPTION_KEY`       | ✅ Sim       | Chave de criptografia AES-256 de dados sensíveis (32+ chars)|
| `PATIENT_LOOKUP_HASH_KEY`   | ✅ Sim       | Chave HMAC para lookup de CPF/CNS (32+ chars)               |
| `BACKUP_EXPORT_KEY`         | ✅ Sim       | Senha para rota de export de backup                         |
| `ADMIN_SEED_KEY`            | ✅ Sim       | Chave para seed de admin inicial                            |
| `FRONTEND_ORIGINS`          | ✅ Sim       | Origins permitidas por CORS, separadas por vírgula          |
| `COOKIE_SAME_SITE`          | ✅ Sim       | Deve ser `none` (cross-origin Vercel → Render)              |
| `COOKIE_SECURE`             | ✅ Sim       | Deve ser `true`                                             |
| `NODE_ENV`                  | ✅ Sim       | `production`                                                |
| `RUN_MIGRATIONS`            | ⚠️ 1º deploy | `true` no primeiro deploy, depois remover                   |
| `MUNICIPALITY_ID`           | Recomendada | Código IBGE do município (ex.: `3550308`)                   |
| `ENABLE_ADMIN_SEED`         | Opcional    | `false` em produção                                         |
| `LOG_FORMAT`                | Opcional    | `json` (padrão em produção)                                 |

Exemplo `FRONTEND_ORIGINS`:
```
https://vitras.vercel.app,https://vitras-portal.vercel.app
```

### Frontend (Vercel)

| Variável               | Obrigatória | Descrição                             |
|------------------------|-------------|---------------------------------------|
| `VITE_API_URL`         | ✅ Sim       | URL do backend no Render              |
| `VITE_IDLE_LOGOUT_ENABLED` | Opcional | `true` em produção                   |

Exemplo:
```
VITE_API_URL=https://vitras-backend.onrender.com
```

---

## Deploy — Passo a passo

### 1. Neon (banco)

1. Acesse [neon.tech](https://neon.tech) → criar conta → **New Project**
2. Selecionar região mais próxima (ex.: `aws-us-east-2`)
3. Copiar a **Connection string** (formato `postgres://...?sslmode=require`)
4. Rodar migração de dados (se houver dados existentes):
   ```bash
   SOURCE_URL="<url-rds-atual>" TARGET_URL="<url-neon>" bash scripts/neon-migrate.sh
   ```
   Se ambiente novo (sem dados), o backend cria o schema automaticamente no primeiro start com `RUN_MIGRATIONS=true`.

### 2. Render (backend)

1. Acesse [render.com](https://render.com) → **New Web Service**
2. Conectar repositório GitHub → selecionar `vitras`
3. Configurações:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install --production=false`
   - **Start Command:** `npm start`
   - **Node Version:** `22`
   - **Health Check Path:** `/health`
4. Adicionar todas as env vars da tabela acima
5. No primeiro deploy: `RUN_MIGRATIONS=true`
6. Aguardar build e verificar `/health` → `{"status":"ok"}`
7. Após validação: remover `RUN_MIGRATIONS` ou setar `false`

### 3. Vercel (frontend)

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importar repositório → selecionar `vitras`
3. Configurações do projeto principal (`frontend-react`):
   - **Root Directory:** `frontend-react`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Framework Preset:** Vite
4. Env vars:
   ```
   VITE_API_URL=https://vitras-backend.onrender.com
   VITE_IDLE_LOGOUT_ENABLED=true
   ```
5. Deploy → verificar login, rotas, refresh de página

Para o portal cidadão (`frontend-portal`): repetir com Root Directory `frontend-portal`.

---

## Observações importantes — CORS e cookies

Frontend e backend estão em domínios diferentes (Vercel ≠ Render).
Isso exige `SameSite=None; Secure` nos cookies de autenticação — já configurado via:

```
COOKIE_SAME_SITE=none
COOKIE_SECURE=true
```

O backend aceita CSRF via header `X-CSRF-Token` (já implementado no frontend).

---

## Limitações do plano gratuito

| Serviço | Limitação                                                     |
|---------|---------------------------------------------------------------|
| Render  | 512 MB RAM, 0.1 CPU, **spin down após 15 min de inatividade** |
| Neon    | 0.5 GB storage, **scale to zero após inatividade**            |
| Vercel  | 100 GB bandwidth/mês, builds ilimitados                       |

O Render Free **hiberna** o backend após inatividade. O primeiro request após hibernação leva 30–60 s (cold start). Para evitar, use um serviço de ping (ex.: UptimeRobot pinga `/health` a cada 10 min).

---

## Estrutura do projeto

```text
vitras/
├── backend/              ← API Node.js + Express
│   ├── src/
│   ├── certs/            ← cert RDS (legado, não usado no Neon)
│   ├── .platform/        ← hooks EB (legado, ignorado no Render)
│   ├── Procfile          ← web: npm start (compatível com Render)
│   └── .node-version     ← pina Node 22 para Render
├── frontend-react/       ← App clínico principal (React + Vite)
│   └── vercel.json       ← SPA rewrites + cache headers
├── frontend-portal/      ← Portal do cidadão (React + Vite)
│   └── vercel.json       ← SPA rewrites
├── render.yaml           ← Configuração do Render Web Service
├── scripts/
│   └── neon-migrate.sh   ← Export RDS → Import Neon
└── README.md
```

---

## Smoke tests

```bash
# Substituir pela URL real do Render
BASE_URL=https://vitras-backend.onrender.com npm run smoke
```

---

## Futuros deploys

- **Frontend**: push para `main` → Vercel detecta e faz deploy automático
- **Backend**: push para `main` → Render detecta e faz deploy automático
- **Migrations novas**: setar `RUN_MIGRATIONS=true` no Render antes do deploy → reverter após
- **Backup do banco**: usar `GET /admin/backup/export` com `BACKUP_EXPORT_KEY` ou pg_dump direto no Neon

---

## Histórico de infraestrutura

A infraestrutura anterior utilizava AWS (Amplify + Elastic Beanstalk + RDS).
Arquivos legados preservados mas não utilizados:

- `backend/.platform/` — hooks EB
- `backend/certs/rds-ca-bundle.pem` — CA bundle RDS
- `docs/deployment/aws-cloudflare.md` — guia deploy anterior

---

## Checklist básico de desenvolvimento

1. Ler `AGENTS.md` e arquivos obrigatórios em `agents/`.
2. Entender fluxo afetado antes de editar.
3. Fazer mudança pequena e segura.
4. Validar build, lint e testes quando disponíveis.
5. Não hardcodar segredos, tokens ou senhas reais.
6. Reutilizar padrões existentes de arquitetura e Design System.
