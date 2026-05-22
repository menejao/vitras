// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Dívida técnica identificada

## Código temporário, pessoal ou sensível a revisão

- `backend/src/services/startup.js`: rotina `alignJoaoTeamOnStartup` com acoplamento pessoal explícito
- `backend/src/db.js`: compat mode TLS com `rejectUnauthorized=false`
- `backend/src/config.js`: fallback dev de `JWT_SECRET`
- `backend/src/services/seed-demo.js`: arquivo muito grande, mistura dados de seed e fluxo operacional
- `backend/src/routes/seed-admin.js`: endpoint sensível de seed, exige revisão contínua
- `backend/scripts/provision-remote-enterprise-user.mjs`: script poderoso de provisionamento remoto

## Arquivos grandes demais

- `backend/src/services/seed-demo.js`
- `backend/src/utils/protocol-eval.js`
- `backend/src/db.js`
- `backend/src/routes/patients.js`
- `backend/src/routes/me.js`
- `backend/src/routes/auth.js`

## Sinais de manutenção difícil

- `console.log` espalhado em startup, db, migrations e seeds
- utilitários centrais com responsabilidades amplas
- persistência, criptografia e sync relacional concentrados em `db.js`

## Ação recomendada

Não remover automaticamente. Tratar por lotes curtos, com cobertura de teste, começando por startup pessoal, logging e refactor estrutural de `db.js`.
