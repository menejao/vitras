# GO-LIVE CHECKLIST — SaudeUbs/SIGUS

Data de referência: 2026-05-14

Executar este checklist **na ordem** antes de liberar acesso público ao sistema.
Marcar cada item com data e responsável ao concluir.

---

## FASE 1 — INFRAESTRUTURA (D-7)

### Backend (Render)
- [ ] Migrar para plano **Starter** (USD 7/mês) — elimina cold start
- [ ] Verificar região do serviço (South America se disponível)
- [ ] Health check path `/health` confirmado no Render
- [ ] Zero-downtime deploy habilitado
- [ ] Alertas de falha de deploy configurados (e-mail no Render)

### Banco de Dados (Neon)
- [ ] Confirmar plano com **PITR ativo** (Launch ou Scale)
- [ ] Branch `main` com backup contínuo ativo
- [ ] Branch `staging` **separada** criada (ver `STAGING_ENVIRONMENT.md`)
- [ ] Connection pooler ativo e `DATABASE_URL` usando string do pooler

### Frontend (Cloudflare Workers)
- [ ] Domínio próprio configurado (não `*.workers.dev`) — **ou** aceitar workers.dev temporariamente
- [ ] `wrangler.toml` sem secrets
- [ ] Build testado localmente (`npm run build` sem erros)

---

## FASE 2 — VARIÁVEIS DE AMBIENTE (D-5)

Todas as variáveis a seguir devem estar configuradas no Render como Secrets (`sync: false`).

### Obrigatórias
- [ ] `JWT_SECRET` — `openssl rand -hex 64`
- [ ] `DATA_ENCRYPTION_KEY` — `openssl rand -hex 32`
- [ ] `DATABASE_URL` — connection string Neon Pooler com `Pooling=false;SslMode=Require`
- [ ] `BACKUP_EXPORT_KEY` — `openssl rand -hex 32`
- [ ] `ADMIN_SEED_KEY` — `openssl rand -hex 32`
- [ ] `FRONTEND_ORIGINS` — URL exata do frontend (sem trailing slash)

### Recomendadas
- [ ] `TWOFA_ISSUER` — nome da UBS (ex: `SaudeUBS`)
- [ ] `REQUEST_LOG_ENABLED=true`
- [ ] `ACCESS_TOKEN_EXPIRES_IN=15m`
- [ ] `REFRESH_TOKEN_EXPIRES_IN=30d`
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (rate limiting distribuído)

### Verificação
```bash
# Confirmar que health responde (e não há erro de startup por variável faltando)
curl -s https://api.saudeubs.com.br/health | jq
# Esperado: {"ok":true,"timestamp":"..."}
```

---

## FASE 3 — SEGURANÇA (D-3)

### Autenticação
- [ ] 2FA ativado para **todas** as contas de gestor e médico
  ```
  1. Login como gestor
  2. GET /me/2fa/status — confirmar que não está habilitado
  3. POST /me/2fa/setup — obter QR code
  4. Escanear no Google Authenticator / Authy
  5. POST /me/2fa/enable com código TOTP
  ```
- [ ] Contas de demonstração desativadas ou com senhas alteradas para senhas fortes únicas
- [ ] Conta de admin real criada (não a conta demo)

### Segurança de transporte
- [ ] HTTPS ativo (automático no Render + Cloudflare)
- [ ] Testar CORS: origem do frontend retorna `Access-Control-Allow-Origin` correto
  ```bash
  curl -X OPTIONS https://api.saudeubs.com.br/auth/login \
    -H "Origin: https://app.saudeubs.com.br" \
    -H "Access-Control-Request-Method: POST" -v 2>&1 | grep -i access-control
  ```
- [ ] Verificar headers de segurança (Helmet):
  ```bash
  curl -I https://api.saudeubs.com.br/health | grep -i "strict-transport\|x-frame\|content-security"
  ```

### Verificação de secrets no código
```bash
git grep -r "JWT_SECRET\|DATA_ENCRYPTION_KEY\|DATABASE_URL\|BACKUP_EXPORT_KEY\|ADMIN_SEED_KEY" \
  -- '*.js' '*.ts' '*.json' '*.yaml' '*.toml' '*.env'
# Zero resultados esperados (exceto referências a process.env)
```

---

## FASE 4 — BACKUP E MONITORAMENTO (D-2)

### Backup
- [ ] GitHub Actions workflow `backup-nightly` configurado e testado
- [ ] `BACKUP_EXPORT_KEY` configurado nos GitHub Secrets
- [ ] Testar backup manual:
  ```bash
  curl -H "x-backup-key: $BACKUP_EXPORT_KEY" \
    https://api.saudeubs.com.br/admin/backup/export \
    -o backup-golive-$(date +%Y%m%d).json
  cat backup-golive-*.json | jq '.generatedAt, .driver | keys'
  ```
- [ ] Restore testado em staging (ver `RUNBOOK_BACKUP_RESTORE.md` seção 3)

### Monitoramento
- [ ] UptimeRobot / BetterStack configurado para `/health` (intervalo ≤ 5 min)
- [ ] Canal de alertas definido (e-mail obrigatório, WhatsApp/Slack opcional)
- [ ] Neon storage verificado (< 50% da cota)

---

## FASE 5 — TESTES (D-1)

### Smoke tests em staging
```bash
node scripts/smoke-production.js --base https://saude-backend-staging.onrender.com
# Todos os testes devem passar (exit 0)
```

### Testes manuais obrigatórios
- [ ] Login com conta gestor + 2FA
- [ ] Criar paciente → visualizar → editar
- [ ] Criar agendamento → criar registro clínico
- [ ] Verificar que usuário ACS não vê pacientes de outra equipe
- [ ] Verificar que médico pode criar registro clínico
- [ ] Acessar `/audit-logs` e confirmar que o envelope paginado retorna `items` com ações registradas
- [ ] Testar `GET /admin/backup/export` com chave válida e inválida (deve retornar 403)

### Testes de regressão
- [ ] Frontend carrega sem erros no console
- [ ] Login funciona no frontend (não apenas via curl)
- [ ] Navegação entre páginas funciona
- [ ] Formulários de criação/edição funcionam

---

## FASE 6 — LGPD (D-1)

- [ ] Política de Privacidade publicada e acessível aos usuários
- [ ] DPO designado com canal de contato disponível
- [ ] Termo de consentimento dos usuários finais assinado
- [ ] Equipe treinada sobre solicitações LGPD (ver `LGPD_OPERATIONS.md`)

---

## FASE 7 — DIA D (go-live)

### Manhã (antes de abrir acesso)
- [ ] Backup do estado inicial: `curl -H "x-backup-key: $BACKUP_EXPORT_KEY" .../admin/backup/export -o backup-d0.json`
- [ ] Health check verde
- [ ] Smoke tests passando em produção
- [ ] Equipe de suporte ciente e disponível

### Abertura
- [ ] Liberar acesso aos usuários finais
- [ ] Monitorar logs no Render nos primeiros 30 min (Render → Logs)
- [ ] Monitorar UptimeRobot por alertas

### Fim do dia
- [ ] Verificar audit logs: ações do dia fazem sentido?
- [ ] Verificar que backup do dia foi gerado (GitHub Actions)
- [ ] Documentar qualquer incidente ou comportamento inesperado

---

## FASE 8 — PÓS GO-LIVE (D+7)

- [ ] Backup testado em staging (restore completo + smoke tests)
- [ ] Nenhum alerta crítico de uptime nos primeiros 7 dias
- [ ] Solicitações LGPD recebidas? Processadas dentro do prazo?
- [ ] Rotação de secrets agendada (próxima: 6 meses)
- [ ] Teste mensal de restore agendado (ver `RUNBOOK_BACKUP_RESTORE.md` seção 6)

---

## REFERÊNCIAS

| Doc | Conteúdo |
|-----|----------|
| `PRODUCTION_READINESS_PLAN.md` | Checklist detalhado de infraestrutura |
| `RUNBOOK_OPERACIONAL.md` | Deploy, rollback, investigação de erros |
| `RUNBOOK_BACKUP_RESTORE.md` | Backup e restore detalhado |
| `STAGING_ENVIRONMENT.md` | Como provisionar e usar staging |
| `SECRETS_ROTATION.md` | Geração e rotação de secrets |
| `MONITORING_ALERTING.md` | Uptime, logs, alertas |
| `LGPD_OPERATIONS.md` | Solicitações de privacidade, incidentes |
