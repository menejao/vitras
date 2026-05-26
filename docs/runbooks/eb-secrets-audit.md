# Secrets Audit — Elastic Beanstalk Production (vitras-drill-sa-3)

Data: 2026-05-26  
Ambiente: vitras-drill-sa-3 (sa-east-1)  
Estado verificado após recovery drill completo.

---

## 1. Variáveis OBRIGATÓRIAS em produção (NODE_ENV=production)

App lança exceção e não sobe sem estas.

| Variável | Geração | Rotação | Notas |
|----------|---------|---------|-------|
| `NODE_ENV` | Literal `production` | Nunca | Habilita todas as validações de prod |
| `DATABASE_URL` | Fornecida pelo time de infra (RDS) | Conforme política RDS | Formato: `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | `openssl rand -hex 64` | Semestral / emergência | Mín. 32 chars; invalidar troca todos os tokens ativos |
| `DATA_ENCRYPTION_KEY` | Gerada na criação do banco (AES-256) | **Nunca sem migração prévia** | Mín. 32 chars; perda = CPF/CNS inacessíveis |
| `PATIENT_LOOKUP_HASH_KEY` | `openssl rand -hex 32` | Nunca sem re-hash de todos os pacientes | Chave HMAC-SHA256 para cpf_hash/cns_hash; separada de DATA_ENCRYPTION_KEY |
| `BACKUP_EXPORT_KEY` | `openssl rand -hex 32` | Semestral | Protege endpoint `/admin/export` |
| `ADMIN_SEED_KEY` | `openssl rand -hex 32` | Semestral | Protege endpoint `/admin/run-demo-seed` |
| `FRONTEND_ORIGINS` **ou** `CORS_ALLOW_ALL=true` | URL(s) do frontend, vírgula-separadas | Conforme deploy | `CORS_ALLOW_ALL=true` apenas para HTTP/drill; **proibido em prod HTTPS** |

---

## 2. Variáveis CONDICIONALMENTE obrigatórias

| Variável | Quando obrigatória | Notas |
|----------|--------------------|-------|
| `COOKIE_SECURE` | Sempre em prod | `true` (HTTPS) ou `false` (HTTP-only, drill/internal). `false` proibido em prod pública HTTPS |
| `COOKIE_SAME_SITE=none` + `COOKIE_SECURE=true` | Cross-origin cookies | Se `SameSite=none`, `Secure` deve ser `true` ou app falha no boot |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Multi-instância / prod com SLA | Sem eles: rate limiting usa MemoryStore (não distribuído, falha-aberto entre instâncias) |

---

## 3. Variáveis OPCIONAIS com defaults seguros

| Variável | Default | Notas |
|----------|---------|-------|
| `PORT` | `3001` | EB injeta automaticamente |
| `JWT_EXPIRES_IN` | `12h` | Também controla `ACCESS_TOKEN_EXPIRES_IN` |
| `JWT_ISSUER` | `vitras-backend` | |
| `JWT_AUDIENCE` | `vitras-client` | |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` | |
| `BREAK_GLASS_TTL_MS` | `900000` (15 min) | TTL de sessão break-glass |
| `AUTH_WINDOW_MS` | `600000` (10 min) | Janela de rate limit de autenticação |
| `AUTH_MAX_ATTEMPTS` | `20` | Tentativas antes de 429 |
| `GLOBAL_RATE_LIMIT_WINDOW_MS` | `60000` (1 min) | |
| `GLOBAL_RATE_LIMIT_MAX` | `600` | Requests/min global |
| `USER_ONLINE_THRESHOLD_MS` | `120000` (2 min) | |
| `AUDIT_LOG_RETENTION_DAYS` | `730` (2 anos) | |
| `AUDIT_LOG_DEFAULT_LIMIT` | `100` | |
| `AUDIT_LOG_MAX_LIMIT` | `500` | |
| `LOG_FORMAT` | `json` em prod | Não alterar em prod — parsers de log esperam JSON |
| `REQUEST_LOG_ENABLED` | `true` | `false` reduz volume mas perde rastreabilidade |
| `TWOFA_ISSUER` | `Vitras` | Nome exibido no app autenticador |
| `TWOFA_CHALLENGE_TTL_MS` | `300000` (5 min) | |
| `TWOFA_MAX_ATTEMPTS` | `5` | |
| `ENABLE_BACKUP_EXPORT` | `true` | Setar `false` para desativar export sem remover key |
| `ENABLE_ADMIN_SEED` | `false` em prod | **NÃO setar `true` em produção real** |
| `AUDIT_PRUNE_ENABLED` | `false` | `true` em prod emite warning no boot |
| `APP_VERSION` | `unknown` | Injetar via CI: `APP_VERSION=$GIT_SHA` |
| `PUBLIC_SELF_REGISTER_ROLES` | `receptionist` em prod | Papéis permitidos no auto-cadastro |
| `COOKIE_ACCESS_NAME` | `vitras_access` | |
| `COOKIE_REFRESH_NAME` | `vitras_refresh` | |
| `COOKIE_CSRF_NAME` | `vitras_csrf` | |
| `COOKIE_DOMAIN` | `` (vazio) | Setar se cross-subdomain |

---

## 4. Variáveis PROIBIDAS / de risco

| Variável | Risco |
|----------|-------|
| `CORS_ALLOW_ALL=true` em HTTPS público | Elimina proteção de origem; permitido apenas em HTTP interno/drill |
| `ENABLE_ADMIN_SEED=true` em prod real | Permite seed destrutivo com chave; manter `false` |
| `AUDIT_PRUNE_ENABLED=true` em prod | Apaga registros de auditoria; apenas com aprovação de compliance |
| `COOKIE_SECURE=false` em HTTPS | Cookies transmitidos em texto puro; proibido em prod pública |
| `RUN_MIGRATIONS=true` (permanente) | Deve ser removido após migrations aplicadas; não deixar permanente |

---

## 5. Variáveis que NÃO devem ser rotacionadas sem procedimento

| Variável | Motivo | Procedimento antes de rotacionar |
|----------|--------|----------------------------------|
| `DATA_ENCRYPTION_KEY` | Todos os CPF/CNS estão criptografados com esta chave | Executar migração de re-encriptação antes de trocar; ver `docs/security/KEY_ROTATION_PLAN.md` |
| `PATIENT_LOOKUP_HASH_KEY` | Todos os `cpf_hash`/`cns_hash` nas shadow tables usam esta chave HMAC | Recomputar todos os hashes antes de trocar; ver migration de backfill |
| `DATABASE_URL` (host/banco) | Mudança de host requer migração de dados e snapshot | Coordenar com time de infra + window de manutenção |

---

## 6. Estado atual do ambiente (vitras-drill-sa-3)

| Variável | Status |
|----------|--------|
| `NODE_ENV=production` | ✅ Configurado |
| `DATABASE_URL` | ✅ Configurado (RDS vitras-drill-sa) |
| `JWT_SECRET` | ✅ Configurado |
| `DATA_ENCRYPTION_KEY` | ✅ Configurado (chave original) |
| `PATIENT_LOOKUP_HASH_KEY` | ✅ Configurado |
| `BACKUP_EXPORT_KEY` | ✅ Configurado |
| `ADMIN_SEED_KEY` | ✅ Configurado |
| `CORS_ALLOW_ALL=true` | ⚠️ Temporário — substituir por `FRONTEND_ORIGINS` quando domínio definido |
| `COOKIE_SECURE=false` | ⚠️ Temporário — endpoint HTTP. Exige `true` quando HTTPS ativado |
| `UPSTASH_REDIS_REST_URL/TOKEN` | ❌ Não configurado — rate limiting em MemoryStore (instância única, adequado para piloto) |
| `ENABLE_ADMIN_SEED` | ✅ `false` (default prod) |
| `AUDIT_PRUNE_ENABLED` | ✅ `false` (default) |

---

## 7. Geração de chaves de referência

```bash
# JWT_SECRET (64 bytes hex = 128 chars)
openssl rand -hex 64

# DATA_ENCRYPTION_KEY (32+ chars)
openssl rand -base64 32

# PATIENT_LOOKUP_HASH_KEY (32 bytes hex)
openssl rand -hex 32

# BACKUP_EXPORT_KEY / ADMIN_SEED_KEY
openssl rand -hex 32
```

**NÃO use estes comandos para regenerar chaves de um ambiente já em produção com dados.  
Apenas para ambientes novos ou após processo formal de rotação.**
