# INFRASTRUCTURE

## Objetivo
Documentar infraestrutura atual de deploy, dados, observabilidade e recuperação operacional do VITRAS.

## Escopo
Render, Neon, Vercel, variáveis, backup, restore, health, escalabilidade, logs, monitoramento, DR, rollback e ambientes.

## Pré-requisitos
- `README.md`
- `render.yaml`
- `backend/Dockerfile`
- `frontend-react/vercel.json`
- `frontend-portal/vercel.json`

## Descrição
Infraestrutura atual é composta por backend Node.js em Render, banco PostgreSQL Neon e frontends Vercel. Há legado AWS no repositório, mas não é base operacional principal declarada no README atual.

## Ambientes
### Produção
- Backend: Render Web Service
- Banco: Neon PostgreSQL
- Frontend clínico: Vercel
- Portal cidadão: Vercel

### Homologação
- Existe material de homologação e rollout em `docs/homologacao/` e `docs/rollout/`
- Estrutura pode reaproveitar mesmo desenho lógico de produção com parâmetros distintos

### Desenvolvimento
- Backend local em `backend`
- Frontend clínico local em `frontend-react`
- Portal cidadão local em `frontend-portal`
- Banco opcional em arquivo local ou PostgreSQL

## Deploy
### Backend
- `rootDir: backend`
- `buildCommand: npm install --production=false`
- `startCommand: npm start`
- `healthCheckPath: /health`
- Evidência: `render.yaml`

### Frontends
- `frontend-react` e `frontend-portal` como projetos Vercel separados
- Build SPA por Vite

## Banco
- Driver principal: PostgreSQL quando `DATABASE_URL` existe
- Modo local: arquivo JSON
- TLS configurável por bundle CA e `DB_SSL_REJECT_UNAUTHORIZED`

## Variáveis de ambiente críticas
| Variável | Uso |
|---|---|
| `DATABASE_URL` | conexão banco |
| `JWT_SECRET` | assinatura JWT |
| `DATA_ENCRYPTION_KEY` | criptografia em repouso |
| `PATIENT_LOOKUP_HASH_KEY` | HMAC de lookup |
| `BACKUP_EXPORT_KEY` | export de backup |
| `ADMIN_SEED_KEY` | seed administrativo |
| `FRONTEND_ORIGINS` | CORS |
| `COOKIE_SAME_SITE` / `COOKIE_SECURE` | cookie auth |
| `RUN_MIGRATIONS` | execução de migrations |
| `DB_CACHE_TTL_MS` | cache de leitura |

## Backup
### IMPLEMENTADO
- Export via rota administrativa protegida
- Leitura direta do snapshot com `readDbForBackup()`

### PARCIAL
- Política operacional depende de disciplina de ambiente, chaves e rotina externa

## Restore
- Script utilitário existente: `scripts/restore-backup.js`
- Há rotinas e documentação complementar em `docs/rollout/` e `docs/disaster-recovery.md`

## Observabilidade
- `/health`
- `/readyz`
- `/metrics/internal`
- request logging
- métricas de runtime e DB
- documentação adicional em `docs/cloudwatch-dashboard.md`

## Health e readiness
- `health`: estado geral
- `readyz`: prontidão e conectividade operacional
- startup/shutdown/degraded mode tratados pelo backend

## Escalabilidade
### IMPLEMENTADO
- Pool PostgreSQL
- cache TTL de leitura
- shadow tables para reduzir custo de filtros
- retries em erros transientes de banco

### PARCIAL
- Persistência principal ainda centralizada em `app_state`
- Modo arquivo não é horizontalmente escalável

## Logs e monitoramento
- `LOG_FORMAT=json` recomendado em produção
- `REQUEST_LOG_ENABLED=true`
- Material de CloudWatch e auditoria preservado em docs

## Disaster Recovery
- Material dedicado em `docs/disaster-recovery.md`
- backup exportável
- rollback por reimplantação e restauração de dados

## Rollback
- Frontend: rollback por deployment Vercel
- Backend: rollback por deployment Render
- Dados: restore de backup exportado ou procedimento Neon

## Limitações conhecidas
- Plano free do Render pode hibernar
- Neon free pode escalar para zero
- Cold start impacta SLA operacional se não houver keep-alive externo

## Boas práticas
- Nunca reutilizar mesma chave para criptografia e hash
- Usar `RUN_MIGRATIONS=true` só em janela controlada
- Verificar `/readyz` após deploy e antes de liberar operação

## Referências internas
- `README.md`
- `render.yaml`
- `docs/disaster-recovery.md`
- `docs/deployment/GO_LIVE_CHECKLIST.md`

## Arquivos relacionados
- `docs/07-operations/OPERATIONS.md`
- `docs/03-security/SECURITY.md`
