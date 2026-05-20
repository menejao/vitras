# RUNBOOK OPERACIONAL — SaudeUbs/SIGUS

Data de referência: 2026-05-14

---

## 1. SUBIR O BACKEND

### Deploy automático (normal)
Push para `main` → Render auto-deploy. Acompanhar em: Render Dashboard → saude-backend → Deploys.

### Deploy manual forçado
```bash
# Via Render CLI (se configurado)
render deploy --service saude-backend

# Via Dashboard
# Render Dashboard → saude-backend → Manual Deploy → Deploy latest commit
```

### Verificar se está rodando
```bash
curl https://api.seudominio.com.br/health
# Esperado: {"ok":true,"timestamp":"..."}
```

### Build local para diagnóstico
```bash
cd backend
npm install
npm start
# Verificar: http://localhost:3001/health
```

---

## 2. PUBLICAR O FRONTEND (Cloudflare Workers)

### Deploy para produção
```bash
cd frontend-react
npm install
npm run build
npx wrangler deploy
```

### Deploy para staging (nome de worker diferente)
```bash
npx wrangler deploy --name gestaopacientes-staging
```

### Verificar versão publicada
```bash
npx wrangler deployments list
```

### Rollback de frontend
```bash
# Listar deployments
npx wrangler deployments list

# Reverter para deployment anterior
npx wrangler rollback [DEPLOYMENT_ID]
```

### Login seguro no Cloudflare Workers (`workers.dev`)
Backend remoto:
```env
FRONTEND_ORIGINS=https://gestaopacientes.meneguccijao.workers.dev
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
COOKIE_DOMAIN=
```

Frontend publicado:
```env
VITE_API_URL=https://saude-backend-gkj7.onrender.com
```

Provisionamento remoto seguro de usuário enterprise:
```bash
ALLOW_ENTERPRISE_REMOTE_PROVISIONING=true \
DATABASE_URL="$DATABASE_URL_REMOTA" \
DATA_ENCRYPTION_KEY="$DATA_ENCRYPTION_KEY_REMOTA" \
PROVISION_USER_EMAIL="joao.dev@valens.local" \
PROVISION_USER_PASSWORD="SENHA_FORTE_AQUI" \
PROVISION_USER_NAME="João Benedito (Dev)" \
PROVISION_USER_ROLE="break_glass_admin" \
PROVISION_REASON="Validação operacional do ambiente workers.dev" \
npm --prefix backend run provision:remote-enterprise-user
```

---

## 3. ROLLBACK

### Rollback de backend (Render)
1. Render Dashboard → saude-backend → Deploys
2. Localizar deploy anterior estável
3. Clicar **"Re-deploy"**
4. Aguardar health check verde

### Rollback via Git
```bash
# Reverter último commit
git revert HEAD --no-edit
git push origin main
# Render detecta push e faz auto-deploy

# Reverter para commit específico
git revert <commit-hash> --no-edit
git push origin main
```

### Rollback de banco (Neon PITR)
1. Neon Dashboard → Projeto → Branches → main
2. **"Restore"** → escolher ponto no tempo
3. Neon cria nova branch com dados restaurados
4. Testar dados na branch de restore
5. Promover para main (ou atualizar DATABASE_URL)

> **NUNCA fazer restore direto em produção sem testar em staging primeiro.**

---

## 4. VERIFICAR HEALTH

### Health básico
```bash
curl -s https://api.seudominio.com.br/health | jq
# {"ok":true,"timestamp":"2026-05-14T..."}
```

### Health com latência
```bash
curl -w "\nTempo total: %{time_total}s\n" -o /dev/null -s \
  https://api.seudominio.com.br/health
# Esperado: < 500ms (cold start pode ser >3s no plano Free)
```

### Verificar logs no Render
```
Render Dashboard → saude-backend → Logs
Filtrar por: [error], [req:], CORS
```

---

## 5. INVESTIGAR ERRO 401 / 403 / 500

### 401 Unauthorized
**Causas prováveis:**
- Token JWT expirado → cliente deve usar refresh token
- Token malformado ou assinado com JWT_SECRET diferente
- JWT_SECRET mudou após tokens existentes serem emitidos

**Diagnóstico:**
```bash
# Decodificar JWT (sem verificar assinatura)
echo "SEU_TOKEN" | cut -d. -f2 | base64 -d | jq
# Verificar: exp (timestamp de expiração), iss, aud

# Verificar variável no Render
# Render Dashboard → saude-backend → Environment → JWT_SECRET
# NÃO logar o valor — apenas confirmar que existe e não está vazia
```

**Solução:**
- Se token expirado: normal, cliente deve renovar
- Se JWT_SECRET foi alterado: todos os tokens existentes invalidados — usuários precisam fazer login novamente

---

### 403 Forbidden
**Causas prováveis:**
- Usuário sem a role necessária para a rota
- CORS bloqueando origem
- Paciente de equipe diferente

**Diagnóstico CORS:**
```bash
# Verificar se origem está em FRONTEND_ORIGINS
curl -H "Origin: https://app.seudominio.com.br" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://api.seudominio.com.br/health -v 2>&1 | grep -i "access-control"
```

**Solução CORS:**
- Adicionar origem em `FRONTEND_ORIGINS` no Render (separar por vírgula se múltiplas)
- Redeploy automático após salvar variável

**Diagnóstico de role:**
```bash
# Decodificar JWT
echo "TOKEN" | cut -d. -f2 | base64 -d | jq '.role'
# Verificar se role está correta para a operação
```

---

### 500 Internal Server Error
**Diagnóstico:**
1. Verificar logs no Render com filtro `[error:`
2. O log mostra: `[error:REQUEST_ID] ErrorName: mensagem`
3. Usar o `requestId` do header `X-Request-Id` da resposta para correlacionar

**Causas comuns:**
- `DATA_ENCRYPTION_KEY` ausente/inválida → falha ao ler dados criptografados
- `DATABASE_URL` inválida ou expirada → falha na conexão com Neon
- Erro de validação de schema não tratado

**Verificar conexão com banco:**
```bash
# No Render, verificar logs de startup:
# "API rodando em http://localhost:PORT" = startup OK
# Qualquer erro antes disso = problema de configuração
```

---

## 6. INVESTIGAR CORS

### Diagnóstico completo
```bash
FRONTEND_URL="https://app.seudominio.com.br"
API_URL="https://api.seudominio.com.br"

curl -s -X OPTIONS "$API_URL/auth/login" \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v 2>&1 | grep -i "access-control\|HTTP/"
```

### Esperado
```
< HTTP/2 204
< access-control-allow-origin: https://app.seudominio.com.br
< access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
< access-control-allow-headers: Content-Type,Authorization
```

### Solução
1. Render Dashboard → saude-backend → Environment → `FRONTEND_ORIGINS`
2. Atualizar com a URL correta (sem trailing slash)
3. Se múltiplas origens: separar por vírgula `https://app.saudeubs.com.br,https://staging.saudeubs.com.br`
4. Render reinicia o serviço automaticamente

---

## 7. RESTAURAR BACKUP

> Procedimento completo em `RUNBOOK_BACKUP_RESTORE.md`.

### Resumo rápido

**Exportar backup atual:**
```bash
curl -H "x-backup-key: $BACKUP_EXPORT_KEY" \
  https://api.seudominio.com.br/admin/backup/export \
  -o backup-$(date +%Y%m%d).json
```

**Validar arquivo de backup:**
```bash
cat backup-*.json | jq '.generatedAt, .driver'
```

**Restore em staging (nunca direto em prod):**
```bash
# Ver RUNBOOK_BACKUP_RESTORE.md para procedimento completo
NODE_ENV=staging DATABASE_URL="$STAGING_DATABASE_URL" \
  node scripts/restore-backup.js backup-20260514.json --confirm
```

---

## 8. ROTACIONAR SECRETS

> Procedimento completo em `SECRETS_ROTATION.md`.

### Urgência (comprometimento confirmado)
1. **JWT_SECRET comprometido:** Alterar imediatamente no Render → todos os tokens existentes invalidados → usuários fazem login novamente
2. **DATA_ENCRYPTION_KEY comprometido:** Situação crítica — contatar DPO, acionar plano de incidente, não alterar sem plano de migração de dados
3. **DATABASE_URL comprometido:** Rotacionar senha no Neon, atualizar no Render

### Rotina semestral
Ver `SECRETS_ROTATION.md` para checklist completo.

---

## 9. DESATIVAR USUÁRIO COMPROMETIDO

### Procedimento imediato

**1. Identificar o usuário:**
```bash
# Via shadow table relacional (Neon SQL Editor):
SELECT id, name, email, role, payload->>'lastLoginAt' AS "lastLoginAt"
FROM app_users
WHERE inactive = false
ORDER BY updated_at DESC;
-- Ou via GET /audit-logs com filtros action/entity/patientId/teamId
```

**2. Revogar todas as sessões:**
```bash
# Opção A: Como gestor/enfermeira, via API (se disponível endpoint admin futuro)
# Opção B: Diretamente na shadow table relacional:
# UPDATE app_refresh_tokens
# SET revoked_at = NOW()
# WHERE user_id = 'USER_ID' AND revoked_at IS NULL;
```

**3. Alterar senha do usuário:**
```bash
# Como gestor: PUT /users/:id com nova senha forte
curl -X PUT https://api.seudominio.com.br/users/USER_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"NovaSenhaForte@2026"}'
```

**4. Registrar incidente nos audit logs:**
- O sistema registra automaticamente via `addAuditLog`
- Documentar externamente: quem, quando, por quê, ações tomadas

**5. Se suspeita de violação de dados:**
- Acionar procedimento de incidente em `LGPD_OPERATIONS.md`
- Notificar ANPD em até 72h se confirmada violação

---

## 10. CHECKLIST PÓS-INCIDENTE

- [ ] Root cause identificado
- [ ] Vulnerabilidade corrigida
- [ ] Secrets potencialmente expostos rotacionados
- [ ] Usuários afetados notificados (se aplicável)
- [ ] Registro no log de auditoria
- [ ] Post-mortem documentado
- [ ] ANPD notificada (se violação de dados pessoais confirmada)
