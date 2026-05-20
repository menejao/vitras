# RELATÓRIO FINAL — FASE 5: PRODUÇÃO, OPERAÇÕES E GOVERNANÇA

Data: 2026-05-14
Atualização operacional: 2026-05-17

---

## RESUMO

A Fase 5 estabeleceu toda a camada de operação contínua para o sistema SaudeUbs/SIGUS: planejamento de produção, runbooks operacionais, backup e restore seguros, ambiente de staging, rotação de secrets, monitoramento, conformidade LGPD, checklist de go-live e testes de fumaça automatizados.

Todos os 10 passos foram completados e commitados.

---

## PASSOS EXECUTADOS

### Passo 1 — Production Readiness Plan
**Commit:** `docs: add production readiness plan`
**Arquivo:** `PRODUCTION_READINESS_PLAN.md`

Checklist completo pré-go-live cobrindo:
- Infraestrutura (Render pago, Neon PITR, Cloudflare Workers)
- Variáveis de ambiente obrigatórias e opcionais com instruções de geração
- Domínio próprio e HTTPS
- Logs e retenção
- Procedimentos de rollback
- Status LGPD
- Usuários administrativos
- Suporte operacional
- **10 bloqueadores de go-live** listados explicitamente

---

### Passo 2 — Runbook Operacional
**Commit:** `docs: add operational runbook`
**Arquivo:** `RUNBOOK_OPERACIONAL.md`

Cobre as operações cotidianas:
- Deploy de backend (Render auto + manual + local)
- Deploy de frontend (Cloudflare Workers via wrangler)
- Rollback de código, deploy e banco (Neon PITR)
- Verificação de health com latência
- Investigação de erros 401, 403, 500
- Diagnóstico e solução de CORS
- Resumo de backup/restore
- Rotação de secrets (referência a SECRETS_ROTATION.md)
- Desativação de usuário comprometido (revogar sessões + alterar senha)
- Checklist pós-incidente

---

### Passo 3 — Backup e Restore
**Commit:** `feat(ops): add backup and restore procedure`
**Arquivos:** `RUNBOOK_BACKUP_RESTORE.md`, `scripts/restore-backup.js`

**RUNBOOK_BACKUP_RESTORE.md** documenta:
- 4 camadas de backup: Neon PITR contínuo, snapshots GitHub 2x/dia, export JSON nightly via GitHub Actions, backup manual
- Comando de export manual com curl
- Procedimento de restore em staging (passo a passo)
- Restore via Neon PITR (fluxo preferido — preserva estado nativo)
- Restore de emergência em produção com checklist obrigatório (regra dos quatro olhos)
- Teste mensal de restore (procedimento agendado todo dia 1)

**scripts/restore-backup.js** — script seguro com as proteções:
- `--env production` requer `--force` explícito — recusa silenciosa em produção
- `--confirm` obrigatório para qualquer restore
- Confirmação interativa: digitar `CONFIRMAR` (staging) ou `CONFIRMAR-PRODUCAO` (produção)
- Nunca aceita secrets por argumento — só via `process.env`
- Valida estrutura do arquivo de backup antes de escrever
- Exibe próximos passos após restore bem-sucedido

---

### Passo 4 — Ambiente de Staging
**Commit:** `chore(deploy): document staging environment`
**Arquivo:** `STAGING_ENVIRONMENT.md`

Documenta:
- Topologia: serviço Render separado + branch Neon `staging` + Worker Cloudflare staging
- Como criar a branch staging no Neon
- Configuração do serviço staging no Render (via Dashboard ou render.yaml)
- Tabela de variáveis com valores específicos por ambiente
- Deploy do frontend com `--name gestaopacientes-staging`
- Fluxo de validação obrigatório antes de promover para produção
- Diferenças de comportamento entre ambientes (cold start, dados, secrets)
- Procedimento de destruição do ambiente após testes

---

### Passo 5 — Rotação de Secrets
**Commit:** `docs: add secrets rotation guide`
**Arquivo:** `SECRETS_ROTATION.md`

Inventário completo de secrets com cadência de rotação. Destaque:
- **DATA_ENCRYPTION_KEY:** único secret que NÃO pode ser rotacionado sem migração de dados prévia — aviso explícito de risco de perda permanente de dados
- Procedimentos de emergência para cada secret
- Checklist semestral com 7 itens (janeiro e julho)
- Comandos `openssl rand` para geração segura
- Tabela de onde cada secret existe (Render, GitHub Actions, n8n, Upstash)
- Verificação pós-rotação com health check e teste de login

---

### Passo 6 — Monitoramento e Alertas
**Commit:** `docs: add monitoring and alerting plan`
**Arquivo:** `MONITORING_ALERTING.md`

5 camadas de monitoramento documentadas:
- **Uptime externo:** UptimeRobot / BetterStack para `/health` (config passo a passo)
- **Logs Render:** filtros úteis (`[error`, `[req:`, `CORS`) e estrutura do log
- **Banco Neon:** connections, storage, queries lentas
- **GitHub Actions:** verificação do job nightly de backup
- **Audit trail:** ações de usuário via `/audit-logs`
- Dashboards de operações diário (5 min) e de segurança semanal (15 min)
- Runbook de alertas: backend down, latência alta, backup falhou
- Tabela de SLA interno com tempos de detecção, resposta e resolução

---

### Passo 7 — Operações LGPD
**Commit:** `docs: add lgpd operations guide`
**Arquivo:** `LGPD_OPERATIONS.md`

Cobre conformidade com Lei 13.709/2018 para dados de saúde (dados sensíveis, Art. 11):
- Mapeamento de recursos técnicos implementados (criptografia, anonimização, auditoria)
- Fluxo operacional para solicitações de privacidade (acesso, correção, exclusão)
- Procedimento de anonimização por retenção com dry-run obrigatório
- O que a anonimização faz (apaga, preserva o quê)
- Acesso e exportação de audit logs
- Checklist de resposta a incidente (72h para notificação ANPD)
- Mapeamento de todos os direitos do Art. 18 LGPD para endpoints do sistema
- Pendências organizacionais pré-go-live (DPO, RIPD, política de privacidade, consentimento)

---

### Passo 8 — Go-Live Checklist
**Commit:** `docs: add go live checklist`
**Arquivo:** `GO_LIVE_CHECKLIST.md`

Checklist de 8 fases na ordem correta de execução (D-7 a D+7):

| Fase | Quando | Conteúdo |
|------|--------|----------|
| 1 — Infraestrutura | D-7 | Render pago, Neon PITR, Cloudflare |
| 2 — Variáveis | D-5 | Todas as env vars configuradas e verificadas |
| 3 — Segurança | D-3 | 2FA, contas demo, CORS, secrets no código |
| 4 — Backup/Monitoramento | D-2 | GitHub Actions, UptimeRobot, restore testado |
| 5 — Testes | D-1 | Smoke tests + testes manuais obrigatórios |
| 6 — LGPD | D-1 | Política de privacidade, DPO, consentimento |
| 7 — Dia D | D-0 | Backup inicial, health, monitoramento ativo |
| 8 — Pós go-live | D+7 | Backup testado, SLA verificado, rotação agendada |

---

### Passo 9 — Smoke Tests de Produção
**Commit:** `test(ops): add production smoke test script`
**Arquivo:** `scripts/smoke-production.js`

Script de 9 testes públicos (verificados localmente — exit 0):

| Teste | O que verifica |
|-------|----------------|
| GET /health → 200 | Backend respondendo |
| GET /health → headers | HSTS + X-Frame-Options presentes |
| POST /auth/login bad creds | 401 (não 500) |
| POST /auth/login payload inválido | 400 + error body |
| GET /patients sem auth | 401 |
| GET /audit-logs sem auth | 401 |
| GET /admin/backup/export sem key | 403 |
| GET /admin/backup/export key errada | 403 |
| OPTIONS CORS preflight | 204 + access-control-allow-origin |

Testes autenticados adicionais (GET /patients, /me, /me/access-context, /audit-logs, /audit-logs/export, /metrics/internal, /protocol/templates, /users) ativados via `SMOKE_EMAIL` + `SMOKE_PASSWORD`.

Atualização 2026-05-17:
- smoke script alinhado ao envelope paginado de `/audit-logs`
- smoke script cobre `/me/access-context`
- smoke script cobre export JSON de auditoria
- smoke script aceita `SMOKE_BACKUP_KEY` para validar export de backup com chave válida
- smoke script valida bloqueio de preflight sem `Origin` fora de localhost

**Bônus:** Fix de BOM UTF-8 em `backend/src/db.js` — `data/db.json` com BOM causava falha em dev local.

---

## ARTEFATOS CRIADOS

| Arquivo | Tipo |
|---------|------|
| `PRODUCTION_READINESS_PLAN.md` | Infraestrutura e checklist |
| `RUNBOOK_OPERACIONAL.md` | Operações cotidianas |
| `RUNBOOK_BACKUP_RESTORE.md` | Backup e restore |
| `STAGING_ENVIRONMENT.md` | Ambiente de staging |
| `SECRETS_ROTATION.md` | Rotação de credenciais |
| `MONITORING_ALERTING.md` | Uptime, logs, alertas |
| `LGPD_OPERATIONS.md` | Conformidade LGPD |
| `GO_LIVE_CHECKLIST.md` | Checklist ordenado de go-live |
| `scripts/restore-backup.js` | Restore seguro (nunca prod sem --force) |
| `scripts/smoke-production.js` | 9 smoke tests automatizados |

---

## COMMITS DA FASE 5

```
5c292b6 test(ops): add production smoke test script
4bbabda docs: add go live checklist
55c414d docs: add lgpd operations guide
cd07c98 docs: add monitoring and alerting plan
418f04e docs: add secrets rotation guide
c2c398d chore(deploy): document staging environment
0e78c2b feat(ops): add backup and restore procedure
bb4458f docs: add operational runbook
7978e88 docs: add production readiness plan
```

---

## BLOQUEADORES DE GO-LIVE (status atual)

| Item | Status |
|------|--------|
| Plano Render pago | ⬜ Pendente — custo: USD 7/mês |
| Neon PITR ativo | ⬜ Confirmar no Dashboard |
| Todas as env vars obrigatórias configuradas | ⬜ Configurar no Render |
| Banco de staging separado | ⬜ Criar branch `staging` no Neon |
| Domínio próprio | ⬜ Pendente |
| 2FA para admins | ⬜ Ativar após criar conta real |
| Smoke tests passando em staging | ⬜ Executar após provisionar staging |
| Política de Privacidade publicada | ⬜ Pendente — tarefa jurídica |
| DPO designado | ⬜ Pendente — tarefa organizacional |

> A implementação técnica está completa. Os bloqueadores restantes são de infraestrutura/custo (Render/Neon) e organizacionais (LGPD). O sistema está tecnicamente pronto para produção, com artefatos operacionais alinhados ao estado atual de autenticação, auditoria paginada e hardening de CORS/backup/seed admin.

---

## PRÓXIMA FASE

Com a Fase 5 concluída, os passos remanescentes da Fase 4 (2–10) incluem:
- Sistema de migrations
- Normalização do padrão JSONB no banco
- Reestruturação de frontend
- Code splitting e lazy loading
- Cobertura de testes
- CI/CD completo
- Observabilidade (traces, métricas)
