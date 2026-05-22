// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Mapa de domínio do backend

## Núcleo de aplicação

- [backend/src/app.js](/C:/dev/vitras/backend/src/app.js:1): composição de middlewares e rotas
- [backend/src/server.js](/C:/dev/vitras/backend/src/server.js:1): bootstrap, startup tasks e lifecycle
- [backend/src/config.js](/C:/dev/vitras/backend/src/config.js:1): configuração e validação de ambiente
- [backend/src/db.js](/C:/dev/vitras/backend/src/db.js:1): persistência híbrida arquivo/PostgreSQL, criptografia de campos e shadow tables

## Módulos de domínio

| Domínio | Rotas principais | Dependências mais fortes | Observação |
|---|---|---|---|
| Auth | `routes/auth.js`, `middlewares/auth.js` | `services/tokens.js`, `services/totp.js`, `utils/session-cookies.js`, `db.js` | módulo grande, mistura login, refresh, cookie e 2FA |
| Patients | `routes/patients.js` | `utils/patients.js`, `utils/protocol-eval.js`, `utils/domain.js`, `db.js` | maior rota funcional; candidata forte a divisão |
| Agenda | `routes/agenda.js` | `utils/domain.js`, `db.js` | acoplada a pacientes e filas |
| Referrals | `routes/referrals.js` | `utils/domain.js`, `db.js` | escopo médio |
| Pharmacy | `routes/pharmacy.js` | `utils/domain.js`, `db.js` | boa candidata a service dedicado |
| Exams | `routes/exams.js` | `utils/domain.js`, `db.js` | escopo médio |
| Queue | `routes/queue.js` | `utils/domain.js`, `db.js` | cruza com recepção e agenda |
| Supplies | `routes/supplies.js` | `utils/domain.js`, `db.js` | rota grande; mistura estoque e movimentação |
| Backup/Admin | `routes/admin.js`, `routes/seed-admin.js` | `db.js`, `services/seed-demo.js` | contém operações sensíveis e seeds |
| Audit | `routes/audit-logs.js`, `services/audit.js` | `db.js` | base útil, mas ainda próxima do estado global |

## Acoplamentos relevantes

- `db.js` concentra persistência, seed default, criptografia, health e sync relacional
- `utils/domain.js` virou utilitário central de múltiplos domínios
- `utils/protocol-eval.js` e `services/seed-demo.js` são arquivos muito grandes e elevam custo cognitivo

## Reorganização incremental sugerida

1. Extrair adapters de storage de `db.js` sem trocar contrato público.
2. Separar `routes/auth.js` em login, refresh, logout e 2FA.
3. Separar `routes/patients.js` em cadastro, timeline e protocolo.
4. Criar `services` por domínio antes de mover validações de rota.
