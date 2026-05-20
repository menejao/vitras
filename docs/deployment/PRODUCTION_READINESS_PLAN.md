# PRODUCTION READINESS PLAN — SaudeUbs/SIGUS

Data de referência: 2026-05-14

---

## 1. INFRAESTRUTURA

### 1.1 Backend (Render.com)

| Item | Status | Obrigatório |
|------|--------|-------------|
| Plano **Starter** ou superior (sem cold start) | ⬜ Pendente | Sim |
| Health check path `/health` configurado | ✅ Configurado | Sim |
| Zero-downtime deploy habilitado | ⬜ Verificar | Sim |
| Auto-deploy do branch `main` | ✅ Configurado | Sim |
| NODE_VERSION = 22 | ✅ Configurado | Sim |
| Região mais próxima dos usuários (South America) | ⬜ Verificar | Recomendado |
| Alertas de falha de deploy por e-mail | ⬜ Configurar | Recomendado |

> **Plano Free no Render faz cold start após 15 min de inatividade. Para produção real, migrar para Starter (USD 7/mês).**

### 1.2 Banco de Dados (Neon PostgreSQL)

| Item | Status | Obrigatório |
|------|--------|-------------|
| Plano com **PITR (Point-in-Time Recovery)** ativo | ⬜ Verificar | Sim |
| Backup automático diário confirmado | ⬜ Verificar | Sim |
| Connection pooling via Neon Pooler habilitado | ✅ Em uso | Sim |
| `Pooling=false` e `SslMode=Require` na connection string | ✅ Configurado | Sim |
| Banco de staging separado do banco de produção | ⬜ Criar | Sim |
| Monitoramento de uso de conexões | ⬜ Configurar | Recomendado |
| Alerta de storage >80% | ⬜ Configurar | Recomendado |

### 1.3 Frontend (Cloudflare Workers)

| Item | Status | Obrigatório |
|------|--------|-------------|
| Domínio próprio configurado (não `*.workers.dev`) | ⬜ Configurar | Recomendado |
| HTTPS automático via Cloudflare | ✅ Ativo | Sim |
| Cache de assets estáticos configurado | ⬜ Verificar | Recomendado |
| `wrangler.toml` sem secrets hardcoded | ✅ OK | Sim |

---

## 2. VARIÁVEIS DE AMBIENTE OBRIGATÓRIAS

Todas devem estar configuradas no painel do Render **como Secrets (sync: false)**. Nunca no código ou em arquivos versionados.

| Variável | Descrição | Onde gerar |
|----------|-----------|------------|
| `JWT_SECRET` | Chave de assinatura JWT (≥64 chars aleatórios) | `openssl rand -hex 64` |
| `DATA_ENCRYPTION_KEY` | Chave AES-256-GCM para CPF/CNS (64 hex chars = 32 bytes) | `openssl rand -hex 32` |
| `DATABASE_URL` | Connection string Neon Pooler com SSL | Painel Neon → Connect |
| `BACKUP_EXPORT_KEY` | Chave de acesso ao endpoint de backup (≥32 chars) | `openssl rand -hex 32` |
| `ADMIN_SEED_KEY` | Chave obrigatória do endpoint administrativo de reset/populate | `openssl rand -hex 32` |
| `FRONTEND_ORIGINS` | URL(s) do frontend separadas por vírgula | Ex: `https://app.saudeubs.com.br` |

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `COUNCIL_VERIFY_URL` | Webhook n8n/Make para validação de conselho | Se `COUNCIL_VERIFY_MODE=required` |
| `COUNCIL_VERIFY_TOKEN` | Token Bearer para o webhook | Se URL configurada |
| `UPSTASH_REDIS_REST_URL` | Rate limiting distribuído | Recomendado |
| `UPSTASH_REDIS_REST_TOKEN` | Token Upstash | Recomendado |
| `TWOFA_ISSUER` | Nome exibido no app 2FA (ex: SaudeUBS) | Recomendado definir |
| `ACCESS_TOKEN_EXPIRES_IN` | TTL do JWT de acesso (ex: `15m`) | Recomendado |
| `REFRESH_TOKEN_EXPIRES_IN` | TTL do refresh token (ex: `30d`) | Recomendado |
| `REQUEST_LOG_ENABLED` | `true` para logs de requests | `true` em prod |

---

## 3. DOMÍNIO PRÓPRIO

| Item | Status |
|------|--------|
| Domínio registrado (ex: `saudeubs.com.br`) | ⬜ |
| DNS apontando para Cloudflare (frontend) | ⬜ |
| Subdomínio API configurado (ex: `api.saudeubs.com.br`) | ⬜ |
| Certificado HTTPS válido (automático via Cloudflare/Render) | ⬜ |
| `FRONTEND_ORIGINS` atualizado com domínio final | ⬜ |
| HSTS habilitado (via Helmet — já configurado) | ✅ |

---

## 4. HTTPS E SEGURANÇA DE TRANSPORTE

- Render fornece TLS automático no domínio `*.onrender.com` e em domínios próprios adicionados.
- Cloudflare Workers usa HTTPS por padrão.
- `app.set("trust proxy", 1)` já configurado no backend para headers corretos atrás de proxy.
- Helmet.js v8 com CSP, HSTS e demais headers já aplicados.

---

## 5. LOGS

| Item | Ação |
|------|------|
| Logs de request (`[req:ID] METHOD /path STATUS Nms`) | ✅ Ativo via `REQUEST_LOG_ENABLED=true` |
| Logs de erro com requestId | ✅ Ativo |
| Logs de audit (auditLogs no banco) | ✅ Ativo |
| Retenção de logs no Render | ⬜ Configurar (Render retém 7 dias no plano Starter) |
| Exportação de logs para storage externo | ⬜ Avaliar (Logtail, Papertrail, etc.) |
| Logs não expõem dados sensíveis (CPF, senha, token) | ✅ Verificado |

---

## 6. ROLLBACK

| Procedimento | Como |
|--------------|------|
| Rollback de deploy no Render | Dashboard → Deploy History → Redeploy versão anterior |
| Rollback de banco (PITR) | Neon Dashboard → Branch → Restore to point in time |
| Rollback de código | `git revert` + push para `main` (trigger auto-deploy) |
| Branch de snapshot disponível | ✅ GitHub Actions cria `snapshot/auto-*` 2x/dia |

---

## 7. LGPD

| Item | Status |
|------|--------|
| Anonimização de pacientes implementada | ✅ |
| Solicitações de privacidade (acesso/correção/exclusão) | ✅ |
| Trilha de auditoria para todas as ações | ✅ |
| Retenção automática por inatividade | ✅ |
| Dados sensíveis criptografados em repouso (CPF, CNS) | ✅ |
| Política de privacidade publicada | ⬜ |
| DPO designado | ⬜ |
| RIPD (Relatório de Impacto) elaborado | ⬜ |
| Termo de consentimento dos usuários | ⬜ |

---

## 8. USUÁRIOS ADMINISTRADORES

| Item | Ação |
|------|------|
| Criar conta gestor real (não demo) no primeiro acesso | Via `POST /auth/register` com role `gestor` |
| Remover/desabilitar conta demo após go-live | Alterar senha e desativar manualmente |
| Ativar 2FA para todas as contas administrativas | Via `/me/2fa/setup` → `/me/2fa/enable` |
| Documentar quem tem acesso e com qual role | Manter lista interna |
| `ADMIN_SEED_KEY` presente no Render e nunca versionado | ✅ Obrigatório |

---

## 9. SUPORTE OPERACIONAL

| Item | Responsável |
|------|-------------|
| Monitoramento de uptime (ex: UptimeRobot, BetterStack) | ⬜ Configurar |
| Canal de alertas (e-mail, Slack, WhatsApp) | ⬜ Definir |
| SLA de resposta a incidentes | ⬜ Definir |
| Procedimento de incidente de segurança (vide RUNBOOK) | ⬜ Treinar equipe |
| Backup testado mensalmente | ⬜ Agendar |
| Rotação de secrets semestral | ⬜ Agendar |

---

## 10. RESUMO — BLOQUEADORES GO-LIVE

Os itens a seguir **bloqueiam** o go-live e devem ser resolvidos antes:

1. **Plano Render pago** — eliminar cold start
2. **Neon PITR ativo** — garantir recuperação de dados
3. **Todas as variáveis obrigatórias configuradas** no Render (JWT_SECRET, DATA_ENCRYPTION_KEY, DATABASE_URL, FRONTEND_ORIGINS)
4. **Banco de staging separado** — não testar em produção
5. **Domínio próprio** (recomendado antes do go-live público)
6. **2FA ativo** para administradores
7. **Smoke tests passando** em staging antes de cada deploy
