// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Vitras

Sistema clínico para APS/ESF com frontend React + Vite, backend Node.js + Express e operação orientada a estabilidade, segurança e sustentabilidade de longo prazo.

## Visão geral

O Vitras apoia fluxos clínicos e operacionais de atenção primária, incluindo pacientes, agenda, fila/recepção, prontuário, exames, encaminhamentos, vacinas, farmácia, insumos, auditoria e controle de acesso.

Premissas deste repositório:

- preservar comportamento já em uso operacional;
- documentar infraestrutura oficial atual;
- separar artefatos legados sem apagar histórico;
- evitar segredos em código e em versionamento;
- facilitar onboarding e manutenção por novos devs.

## Arquitetura oficial

- Frontend: AWS Amplify
- Backend: AWS Elastic Beanstalk
- Banco: AWS Aurora PostgreSQL ou Amazon RDS for PostgreSQL
- Rede, DNS, CDN e WAF: Cloudflare

Fluxo macro:

1. Usuário acessa domínio protegido por Cloudflare.
2. Cloudflare entrega frontend publicado no Amplify.
3. Frontend consome API publicada no Elastic Beanstalk.
4. Backend persiste dados em Aurora/RDS.

Detalhes: [docs/architecture/overview.md](/C:/dev/vitras/docs/architecture/overview.md)

## Stack utilizada

| Camada | Stack |
|---|---|
| Frontend | React 18, Vite 5 |
| Backend | Node.js 20+, Express 4, ESM |
| Banco em desenvolvimento | JSON local opcional ou PostgreSQL |
| Banco oficial | AWS Aurora/RDS PostgreSQL |
| Segurança | JWT, TOTP, Helmet, CORS, rate limit, criptografia AES-256-GCM |
| Deploy frontend | AWS Amplify |
| Deploy backend | AWS Elastic Beanstalk |
| Edge | Cloudflare |

## Como rodar localmente

Pré-requisitos:

- Node.js 20+
- npm 10+

Instalação rápida:

```bash
cd backend
npm install

cd ../frontend-react
npm install
```

Backend:

```bash
cd backend
cp .env.example .env
npm run dev
```

Frontend:

```bash
cd frontend-react
cp .env.example .env.development
npm run dev
```

Endereços padrão:

- API: `http://localhost:3001`
- Frontend: `http://localhost:5174`

## Variáveis de ambiente

Backend:

- usar [backend/.env.example](/C:/dev/vitras/backend/.env.example) como base;
- em produção, definir variáveis no Elastic Beanstalk e, quando aplicável, em AWS Secrets Manager ou SSM Parameter Store;
- não commitar `.env`.

Frontend:

- usar [frontend-react/.env.example](/C:/dev/vitras/frontend-react/.env.example);
- `VITE_API_URL` deve apontar para backend correto por ambiente.

## Como fazer deploy

Deploy padronizado:

- frontend via AWS Amplify;
- backend via AWS Elastic Beanstalk;
- banco em Aurora/RDS;
- proteção de borda e DNS via Cloudflare.

Guia oficial: [docs/deployment/aws-cloudflare.md](/C:/dev/vitras/docs/deployment/aws-cloudflare.md)

## Estrutura do projeto

```text
vitras/
├── backend/
├── frontend-react/
├── docs/
│   ├── architecture/
│   ├── deployment/
│   ├── security/
│   ├── runbooks/
│   ├── onboarding/
│   └── legacy/
├── scripts/
├── .github/
└── README.md
```

Observações:

- `docs/legacy/` guarda configs e artefatos de deploy antigos, sem uso oficial atual;
- `organization/` mantém material institucional e de operação não diretamente ligado ao código;
- `artifacts/` guarda evidências de validação já produzidas.

## Checklist básico de desenvolvimento

1. Ler `AGENTS.md` e arquivos obrigatórios em `agents/`.
2. Entender fluxo afetado antes de editar.
3. Fazer mudança pequena e segura.
4. Evitar alterar comportamento sem justificativa.
5. Validar build, lint e testes quando disponíveis.
6. Registrar riscos, pendências e impacto.

## Convenções do projeto

- preservar compatibilidade funcional;
- priorizar estabilidade e segurança sobre refactors amplos;
- separar documentação operacional de documentação histórica;
- manter nomes claros e consistentes em arquivos, funções e módulos;
- comentar apenas lógica que não seja óbvia;
- não hardcodar segredos, tokens ou senhas reais;
- reutilizar padrões existentes de arquitetura e Design System.

## Documentação relacionada

- Arquitetura: [docs/architecture/overview.md](/C:/dev/vitras/docs/architecture/overview.md)
- Deploy: [docs/deployment/aws-cloudflare.md](/C:/dev/vitras/docs/deployment/aws-cloudflare.md)
- Runbook de observabilidade: [docs/runbooks/observability.md](/C:/dev/vitras/docs/runbooks/observability.md)
- Onboarding inicial: [docs/onboarding/first-admin.md](/C:/dev/vitras/docs/onboarding/first-admin.md)
- Legado arquivado: [docs/legacy/README.md](/C:/dev/vitras/docs/legacy/README.md)
