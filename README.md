# Vitras — Sistema de Gestão para Atenção Básica

Sistema de gestão clínica para equipes de saúde da família (ESF/APS), com foco em enfermagem, ACS e médicos.

> Branch de desenvolvimento: `dev`. Branch de produção: `main`.

---

## Funcionalidades

- Cadastro e gestão de pacientes por microárea e ACS
- Registro de atendimentos, visitas, consultas, vacinas e procedimentos
- Agenda e fila de atendimento
- Tarefas para ACS com acompanhamento
- Encaminhamentos (referrals)
- Farmácia e controle de insumos
- Exames laboratoriais
- Protocolos clínicos com metas x realizado
- IA assistida: priorização, resumo, alertas, chat, relatórios
- 2FA (TOTP) para todos os perfis
- Auditoria de ações críticas
- Conformidade LGPD: acesso, correção, eliminação e portabilidade de dados

---

## Tecnologias

| Camada | Stack |
|---|---|
| Backend | Node.js 20+ · Express 4 · ESM |
| Frontend | React 18 · Vite 5 |
| Banco de dados | PostgreSQL (Neon em produção) · JSON local em dev |
| Autenticação | JWT · TOTP (otplib) |
| Segurança | Helmet · CORS · rate-limit (Upstash Redis) · AES-256-GCM |
| Deploy backend | AWS App Runner (`backend/apprunner.yaml`) |
| Deploy frontend | Cloudflare Pages (`wrangler.toml`) |

---

## Desenvolvimento local

### Pré-requisitos

- Node.js 20+
- npm 10+

### Backend

```bash
cd backend
npm install
cp .env.example .env   # editar com valores locais
npm run dev
```

A API sobe em `http://localhost:3001`.

Para usar banco JSON local (sem PostgreSQL), **não defina** `DATABASE_URL` no `.env`.  
Para usar PostgreSQL, defina `DATABASE_URL` com connection string do Neon ou local.

### Frontend

```bash
cd frontend-react
npm install
cp .env.example .env.development   # ajustar VITE_API_URL se necessário
npm run dev
```

O frontend sobe em `http://localhost:5174`.

> O `VITE_API_URL` padrão é `http://localhost:3001`. Só altere se o backend rodar em outra porta.

### Usuário inicial

Após subir o backend, crie o primeiro administrador via script:

```bash
cd backend
npm run provision:dev-user
```

Ou use `npm run seed:dev-scenario` para um cenário de demo completo.

---

## Perfis de acesso

| Perfil | Descrição |
|---|---|
| `nurse_manager` | Enfermeiro(a) gestor(a) — acesso total à equipe |
| `doctor` | Médico(a) — atendimentos e prontuário |
| `acs` | Agente Comunitário de Saúde — visitas e tarefas |
| `receptionist` | Recepção — fila e agendamento |
| `gestor` | Gestor municipal — visão consolidada |
| `admin` | Administrador do sistema |

Regras completas: `agents/permissions-matrix.md`.

---

## Categorias clínicas

Cada paciente pode ser classificado por categoria de cuidado:

`general` · `pregnant` · `puerperal` · `pap_only` · `child_followup` · `chronic` · `elderly`

O sistema possui templates de protocolo por categoria com metas de visitas, consultas e vacinas.

---

## Autenticação

1. `POST /auth/login` — retorna token JWT (ou inicia desafio 2FA)
2. `POST /auth/login/verify` — verifica TOTP se 2FA ativo
3. Todas as rotas de dados exigem `Authorization: Bearer <token>`

O backend aceita também autenticação via cookie httpOnly (para SPA same-origin).

---

## Variáveis de ambiente

### Backend (`backend/.env.example`)

| Variável | Obrigatória em prod | Descrição |
|---|---|---|
| `JWT_SECRET` | Sim | Segredo JWT (mín. 32 chars) |
| `DATA_ENCRYPTION_KEY` | Sim | Chave AES-256-GCM (gerar com `openssl rand -hex 32`) |
| `DATABASE_URL` | Sim (prod) | PostgreSQL connection string |
| `FRONTEND_ORIGINS` | Sim | Lista CSV de origens CORS permitidas |
| `BACKUP_EXPORT_KEY` | Sim (prod) | Chave para endpoint de backup |
| `COUNCIL_VERIFY_MODE` | Recomendado | `off` · `optional` · `required` |
| `UPSTASH_REDIS_REST_URL` | Recomendado | Para rate limiting distribuído |

Ver `backend/.env.example` para lista completa.

### Frontend (`frontend-react/.env.example`)

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL da API do backend |

---

## Segurança e LGPD

- Senhas com hash `scrypt`, migração automática de legados em texto puro
- JWT com `issuer` + `audience` + expiração configurável
- CSRF tokens para rotas com cookie auth
- Rate limiting por IP via Upstash Redis
- Dados sensíveis (CPF, CNS, segredo 2FA) criptografados em repouso com AES-256-GCM
- Auditoria de ações críticas com export JSON/CSV
- Rotas LGPD: solicitações de titular, anonimização, retenção

Documentação: `docs/lgpd/` · `docs/security/` · `docs/governanca/`

---

## Deploy

### Backend — AWS App Runner

Configuração: `backend/apprunner.yaml`

1. Criar serviço no AWS App Runner apontando para este repositório
2. Definir variáveis de ambiente no console AWS (ver lista acima)
3. Health check: `GET /health`

### Frontend — Cloudflare Pages

Configuração: `wrangler.toml`

```bash
# Build local
cd frontend-react
npm run build

# Deploy via CLI
cd ..
npm run deploy
```

Ou configure o Cloudflare Pages para build automático no push ao `main`.

Guia detalhado: `docs/deploy/aws-cloudflare.md`

---

## Backup automático

Workflow GitHub Actions em `.github/workflows/nightly-backup.yml`.

Segredos necessários no repositório GitHub:
- `BACKUP_EXPORT_URL` — URL pública do backend
- `BACKUP_EXPORT_KEY` — mesmo valor de `BACKUP_EXPORT_KEY` no backend

O backup diário fica como artifact no GitHub Actions por 30 dias.

---

## Testes

```bash
cd backend
npm test
```

---

## Integração externa de conselho profissional

O cadastro valida CRM/COREN via provedor externo configurável.

```env
COUNCIL_VERIFY_MODE=required
COUNCIL_VERIFY_PROVIDER=n8n
COUNCIL_VERIFY_URL=https://seu-provedor.com/api/verify-council
COUNCIL_VERIFY_TOKEN=...
```

Template importável n8n: `backend/integrations/n8n-workflow-template.json`  
Exemplo de payload: `backend/integrations/council-webhook-example.json`

---

## Documentação

| Documento | Descrição |
|---|---|
| `docs/deploy/aws-cloudflare.md` | Guia de deploy completo |
| `docs/onboarding/first-admin.md` | Primeiro acesso e configuração |
| `docs/governanca/` | Rotinas LGPD, incidentes, auditoria |
| `docs/security/` | Relatórios de auditoria de segurança |
| `docs/operations/` | Runbooks operacionais |
| `agents/permissions-matrix.md` | Matriz de permissões por perfil |

---

## Governança de desenvolvimento

Leitura obrigatória antes de qualquer alteração:

- `AGENTS.md`
- `agents/README.md`
- `agents/workflow.md`
- `agents/checklist-final.md`

Toda alteração deve: identificar áreas afetadas, aplicar guardians relevantes, respeitar Design System e regras de negócio, executar validações, entregar relatório final em pt-BR.

---

## Estrutura do repositório

```
vitras/
├── backend/              # API Node.js/Express
│   ├── src/
│   │   ├── routes/       # 18 rotas de domínio
│   │   ├── middlewares/  # auth, csrf, errors, logging, rate-limits, security
│   │   ├── services/     # audit, crypto, tokens, totp, startup, seed-demo
│   │   ├── utils/        # helpers de domínio e cálculo
│   │   └── migrations/   # migrações de banco (PostgreSQL)
│   ├── scripts/          # scripts de provisionamento e seed
│   ├── test/             # testes de integração
│   └── integrations/     # exemplos de webhook e workflow n8n
├── frontend-react/       # SPA React/Vite
│   ├── src/
│   │   ├── components/   # componentes UI e de feature
│   │   ├── pages/        # páginas por rota
│   │   ├── hooks/        # hooks customizados
│   │   ├── utils/        # utilitários de domínio
│   │   └── styles/       # design system em CSS (tokens → componentes → temas)
│   └── scripts/          # utilitários de build
├── docs/                 # documentação técnica e operacional
├── agents/               # guardiões de qualidade (AI + human)
├── organization/         # documentos organizacionais (não técnicos)
├── brand/                # assets de marca
├── scripts/              # scripts de operação (deploy, seed, rotação de chaves)
└── artifacts/            # capturas de validação (não alterar sem motivo)
```

---

Copyright (c) 2026 Vitras. Todos os direitos reservados.
