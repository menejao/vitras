# ROTAÇÃO DE SECRETS — SaudeUbs/SIGUS

Data de referência: 2026-05-14

---

## 1. INVENTÁRIO DE SECRETS

| Secret | Onde fica | Rotação recomendada | Impacto se comprometido |
|--------|-----------|--------------------|-----------------------|
| `JWT_SECRET` | Render env var | Semestral / imediato se comprometido | Todos os tokens ativos invalidados |
| `DATA_ENCRYPTION_KEY` | Render env var | Nunca sem migração planejada | Dados criptografados (CPF, CNS) inacessíveis sem chave antiga |
| `DATABASE_URL` (senha Neon) | Render env var | Semestral / imediato se comprometido | Acesso ao banco de dados |
| `BACKUP_EXPORT_KEY` | Render env var | Semestral | Acesso ao endpoint de export de backup |
| `COUNCIL_VERIFY_TOKEN` | Render env var | Semestral | Acesso ao webhook de verificação de conselho |
| `UPSTASH_REDIS_REST_TOKEN` | Render env var | Semestral | Rate limiting bypassável |

> `DATA_ENCRYPTION_KEY` é o único secret que **NÃO pode ser trocado simplesmente** — requer migração de dados antes.

---

## 2. ROTAÇÃO DE EMERGÊNCIA

### 2.1 JWT_SECRET comprometido

**Impacto:** Todos os tokens JWT emitidos ficam inválidos imediatamente. Usuários precisam fazer login novamente.

```
1. Gerar novo secret:
   openssl rand -hex 64

2. Atualizar no Render:
   Dashboard → saude-backend → Environment → JWT_SECRET → Edit

3. Render reinicia automaticamente

4. Comunicar usuários: "Sessão encerrada por medida de segurança, faça login novamente"

5. Registrar: quem, quando, motivo
```

### 2.2 DATABASE_URL / senha do banco comprometida

**Impacto:** Acesso não autorizado ao banco de dados até a senha ser trocada.

```
1. Neon Dashboard → Projeto → Settings → Roles
2. Alterar senha do role de conexão
3. Copiar nova connection string (pooler)
4. Atualizar DATABASE_URL no Render
5. Render reinicia automaticamente
6. Verificar health: curl https://api.saudeubs.com.br/health
7. Acionar DPO se houver suspeita de acesso indevido aos dados
```

### 2.3 BACKUP_EXPORT_KEY comprometida

**Impacto:** Backup exportável por qualquer pessoa com a chave. Dados cifrados mas chave de criptografia é necessária para leitura real.

```
1. Gerar nova chave: openssl rand -hex 32
2. Atualizar no Render
3. Atualizar em TODOS os lugares que usam a chave (GitHub Actions secret BACKUP_EXPORT_KEY)
4. GitHub → Repositório → Settings → Secrets → Actions → BACKUP_EXPORT_KEY → Update
```

### 2.4 DATA_ENCRYPTION_KEY comprometida ⚠️ CRÍTICO

**Esta é a situação mais grave.** Os dados de CPF e CNS de todos os pacientes podem estar expostos.

**NÃO altere a chave sem um plano de migração.** Se a chave for trocada sem migrar os dados:
- Todos os dados criptografados ficam **permanentemente ilegíveis**
- Não há como recuperar sem a chave original

**Procedimento:**

```
IMEDIATO (dentro de 1h):
1. Acionar DPO e responsável de segurança
2. Documentar o incidente: quando detectado, como, potencial exposição
3. NÃO alterar DATA_ENCRYPTION_KEY ainda
4. Avaliar se o banco foi de fato acessado (logs Neon + audit_logs)

CURTO PRAZO (24-72h):
5. Avaliar necessidade de notificação à ANPD (violação de dados pessoais)
6. Planejar migração: exportar todos os dados com chave antiga → re-encriptar com nova chave
7. Executar migração em staging primeiro
8. Executar em produção com janela de manutenção

NUNCA:
- Rotacionar DATA_ENCRYPTION_KEY sem migrar os dados primeiro
- Commitar qualquer valor de DATA_ENCRYPTION_KEY no git
```

---

## 3. ROTINA SEMESTRAL (checklist)

Agendar para: janeiro e julho de cada ano.

### Checklist

```
[ ] 1. JWT_SECRET
    - Gerar: openssl rand -hex 64
    - Atualizar no Render
    - Confirmar que Render reiniciou (health check verde)
    - Nota: usuários fazem login novamente após reinício

[ ] 2. DATABASE_URL (senha do banco)
    - Neon → Roles → alterar senha
    - Copiar nova connection string
    - Atualizar no Render
    - Verificar health

[ ] 3. BACKUP_EXPORT_KEY
    - Gerar: openssl rand -hex 32
    - Atualizar no Render
    - Atualizar no GitHub Actions secret
    - Testar backup manual: curl -H "x-backup-key: NOVA_KEY" .../admin/backup/export

[ ] 4. COUNCIL_VERIFY_TOKEN (se em uso)
    - Gerar novo token no n8n/Make
    - Atualizar no Render

[ ] 5. UPSTASH_REDIS_REST_TOKEN (se em uso)
    - Upstash Dashboard → Regenerar token
    - Atualizar no Render

[ ] 6. Verificar se algum secret está hardcoded no código
    git grep -r "JWT_SECRET\|DATA_ENCRYPTION_KEY\|DATABASE_URL" -- '*.js' '*.ts' '*.json'
    (nenhum resultado esperado além de referências a process.env)

[ ] 7. Documentar rotação: data, quem executou, quais secrets foram rotacionados
```

---

## 4. GERAR SECRETS SEGUROS

```bash
# JWT_SECRET (≥64 chars)
openssl rand -hex 64

# DATA_ENCRYPTION_KEY (32 bytes = 64 hex chars para AES-256)
openssl rand -hex 32

# BACKUP_EXPORT_KEY (≥32 chars)
openssl rand -hex 32

# COUNCIL_VERIFY_TOKEN
openssl rand -hex 32
```

> Nunca usar senhas memoráveis, datas, nomes ou palavras para secrets de sistema.

---

## 5. ONDE ATUALIZAR CADA SECRET

| Secret | Render | GitHub Actions | n8n/Make | Upstash |
|--------|--------|----------------|----------|---------|
| `JWT_SECRET` | ✅ | — | — | — |
| `DATA_ENCRYPTION_KEY` | ✅ | — | — | — |
| `DATABASE_URL` | ✅ | — | — | — |
| `BACKUP_EXPORT_KEY` | ✅ | ✅ (`BACKUP_EXPORT_KEY`) | — | — |
| `COUNCIL_VERIFY_TOKEN` | ✅ | — | ✅ | — |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | — | — | ✅ |

---

## 6. VERIFICAÇÃO PÓS-ROTAÇÃO

Após qualquer rotação de secret:

```bash
# 1. Health check básico
curl -s https://api.saudeubs.com.br/health | jq

# 2. Login de teste (deve funcionar com conta conhecida)
curl -s -X POST https://api.saudeubs.com.br/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gestor@test.com","password":"..."}' | jq '.token // .error'

# 3. Verificar logs no Render por erros de crypto ou JWT
# Render Dashboard → saude-backend → Logs → filtrar por [error]
```

---

## 7. REGISTRO DE ROTAÇÕES

Manter log interno (fora do git) com:

| Data | Secret rotacionado | Motivo | Responsável |
|------|--------------------|--------|-------------|
| YYYY-MM-DD | JWT_SECRET | Rotina semestral | Nome |
| YYYY-MM-DD | ... | ... | ... |
