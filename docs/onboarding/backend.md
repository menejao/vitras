// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Onboarding backend

## Estrutura

- `src/server.js`: sobe servidor e controla lifecycle
- `src/app.js`: registra middlewares e rotas
- `src/routes/`: endpoints HTTP
- `src/middlewares/`: autenticação, segurança, rate limit, logging e erro
- `src/services/`: tokens, TOTP, startup, auditoria e seed
- `src/utils/`: helpers de domínio, protocolo, pacientes, métricas e cookies
- `src/db.js`: acesso a dados

## Fluxo do backend

1. `server.js` valida ambiente e inicia listener.
2. `app.js` aplica segurança, logging e rate limit.
3. rotas públicas entram antes de `requireAuth`.
4. rotas privadas passam por autenticação e CSRF quando necessário.
5. persistência passa por `db.js` e `withDb`.

## Como rodar

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Convenções

- não colocar regra clínica em middleware genérico;
- não expandir `db.js` com regra de negócio nova se puder ficar em service/domain;
- manter responses JSON simples e estáveis;
- reutilizar capabilities e helpers existentes.

## Onde adicionar funcionalidade

- endpoint novo: `src/routes/`
- regra de domínio reaproveitável: `src/services/` ou `src/utils/domain.js`
- middleware transversal: `src/middlewares/`
- config nova: `src/config.js` e `.env.example`

## Como testar

```bash
cd backend
npm test
```

## Como debugar

- usar `X-Request-Id` e `X-Correlation-Id`
- consultar `/health` e `/readyz`
- revisar logs por rota, status e request id
