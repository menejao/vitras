# 02 — Configuração Técnica

**Versão:** 1.0 | **Produto:** VITRAS APS | **Aplicação:** qualquer UBS do Brasil

---

## Princípio

Toda configuração local é feita via variáveis de ambiente e via API de administração.  
Nenhuma alteração de código é necessária para implantar em qualquer município do Brasil.

---

## Passo 1 — Variáveis de Ambiente (Elastic Beanstalk)

Acessar: EB Console → `vitras` → Environments → `[nome-do-ambiente]` → Configuration → Software → Environment properties.

### Variáveis obrigatórias em produção

| Variável | Obrigatória | Exemplo | Observação |
|----------|-------------|---------|-----------|
| `NODE_ENV` | **SIM** | `production` | Ativa validações e proteções de produção |
| `JWT_SECRET` | **SIM** | `Jv8!kP2#mQ9@rT5...` | Mínimo 32 caracteres, aleatório, nunca reutilizar |
| `DATA_ENCRYPTION_KEY` | **SIM** | `aK3!mN7@pQ1#sR8...` | Mínimo 32 caracteres, usado para criptografar CPF/CNS |
| `PATIENT_LOOKUP_HASH_KEY` | **SIM** | `bL4@nO8#qR2$tS9...` | Chave separada de `DATA_ENCRYPTION_KEY` — HMAC para unicidade CPF/CNS |
| `DATABASE_URL` | **SIM** | `postgresql://user:pass@host:5432/db` | URL do banco Postgres/Neon |
| `FRONTEND_ORIGINS` | **SIM** | `https://ubs-nomeubs.amplifyapp.com` | URL do frontend, sem barra final |
| `BACKUP_EXPORT_KEY` | **SIM** | `cM5#oP9@rS3%uT0...` | Chave para export de backup |
| `ADMIN_SEED_KEY` | **SIM** | `dN6$pQ0!sT4&vU1...` | Chave de acesso ao seed admin |
| `MUNICIPALITY_ID` | **SIM** | `2304400` | Código IBGE 7 dígitos do município — ex: Fortaleza/CE |
| `AUTH_MAX_ATTEMPTS` | **SIM** | `10` | Máximo de tentativas de login (padrão dev=20; produção=10) |
| `AUDIT_PRUNE_ENABLED` | SIM | `true` | Habilitar prune de audit logs antigos |
| `COOKIE_SECURE` | SIM | `true` | Automático em produção — confirmar |
| `AUDIT_LOG_RETENTION_DAYS` | Opcional | `730` | Retenção de audit logs em dias (padrão: 730) |
| `UPSTASH_REDIS_REST_URL` | Recomendado | `https://...upstash.io` | Rate limiting distribuído (sem isso: MemoryStore local) |
| `UPSTASH_REDIS_REST_TOKEN` | Recomendado | `AX...` | Token Upstash |
| `LOG_FORMAT` | Opcional | `json` | Automático em produção |
| `APP_VERSION` | Opcional | `1.0.0` | Identificação da versão no health endpoint |

### Como gerar chaves seguras (exemplo)

```bash
# No terminal Linux/Mac:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Ou usar password manager (Bitwarden, 1Password) com 44+ caracteres aleatórios
```

**Regra de ouro:** `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `PATIENT_LOOKUP_HASH_KEY` e `BACKUP_EXPORT_KEY` devem ser **diferentes entre si**. Nunca reutilizar.

---

## Passo 2 — Bootstrap da Unidade (API)

### 2.1 Criar o Gestor

```bash
curl -X POST https://[backend-url]/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gestor@ubs-nomeubs.gov.br",
    "password": "SenhaForte@2026!",
    "name": "Dr. Nome Completo do Gestor",
    "role": "gestor",
    "councilType": "CRM",
    "councilNumber": "123456",
    "councilUf": "CE",
    "unitId": "ubs-nomeubs-01"
  }'
```

> **Atenção:** `role=gestor` requer `unitId`. Definir um `unitId` único e descritivo (ex: `ubs-centro-fortaleza-01`).

### 2.2 Configurar a Unidade (CNES)

```bash
# Obter token break_glass_admin primeiro
# Depois:
curl -X POST https://[backend-url]/admin/units/bootstrap \
  -H "Authorization: Bearer $BREAK_GLASS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "unitId": "ubs-nomeubs-01",
    "unitName": "UBS Nome da UBS — Município/UF",
    "gestorUserId": "[UUID do gestor criado no passo 2.1]"
  }'
```

### 2.3 Configurar CNES e Município na Unidade

O CNES é configurado no perfil do usuário gestor e sincronizado via API. O `MUNICIPALITY_ID` (env var) já define o código IBGE para CDS Export.

Para associar CNES à unidade via admin:

```bash
curl -X PATCH https://[backend-url]/teams/[teamId] \
  -H "Authorization: Bearer $GESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cnes": "1234567",
    "ine": "0001234567",
    "tipoEquipe": "eSF"
  }'
```

---

## Passo 3 — Configurar Equipes (INE)

```bash
# Listar equipes existentes
curl https://[backend-url]/teams/public

# Atualizar INE e tipo da equipe
curl -X PATCH https://[backend-url]/teams/[teamId] \
  -H "Authorization: Bearer $GESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Equipe Azul — Microárea Central",
    "ine": "0001234567",
    "tipoEquipe": "eSF"
  }'
```

---

## Passo 4 — Criar Profissionais

### Criar ACS

```bash
curl -X POST https://[backend-url]/users \
  -H "Authorization: Bearer $GESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nome Completo ACS",
    "email": "acs.nome@ubs-nomeubs.gov.br",
    "password": "SenhaInicial@2026!",
    "role": "acs",
    "teamId": "[teamId da equipe]"
  }'
```

### Criar Enfermeiro

```bash
curl -X POST https://[backend-url]/users \
  -H "Authorization: Bearer $GESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Enf. Nome Completo",
    "email": "enf.nome@ubs-nomeubs.gov.br",
    "password": "SenhaInicial@2026!",
    "role": "nurse_manager",
    "teamId": "[teamId]",
    "councilType": "COREN",
    "councilNumber": "654321",
    "councilUf": "CE"
  }'
```

---

## Passo 5 — Configurar CNS e CBO por Profissional

Obrigatório para CDS Export gerar fichas válidas no e-SUS:

```bash
curl -X PUT https://[backend-url]/users/[userId] \
  -H "Authorization: Bearer $GESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cnsProfissional": "123456789012345",
    "cboCodigo": "516220"
  }'
```

**CBO por categoria:**

| Papel | CBO |
|-------|-----|
| ACS | `516220` |
| Enfermeiro | `223505` |
| Médico clínico | `225125` |
| Médico de família | `225142` |
| Técnico de enfermagem | `322230` |

---

## Passo 6 — Ativar 2FA para Perfis Críticos

Obrigatório para gestor, enfermeiro e médico antes do go-live:

1. Usuário faz login normalmente
2. Acessar configurações de conta → ativar autenticação em dois fatores
3. Escanear QR code com Google Authenticator / Authy
4. Confirmar código de 6 dígitos
5. Registrar códigos de recuperação em local seguro

---

## Passo 7 — Validar Configuração

```bash
# Health check — deve retornar 200 com ready:true
curl https://[backend-url]/readyz

# Verificar subsistemas
curl https://[backend-url]/health
# Verificar: postgres:"ok", migrations:"ok", redis:"ok" ou "unknown"
```

**Resultado esperado:**
```json
{
  "ok": true,
  "ready": true,
  "postgres": "ok",
  "migrations": "ok",
  "migrationCount": 24
}
```

---

## Referência de Roles e Capabilities

| Role | Pode fazer |
|------|-----------|
| `gestor` | Tudo clínico + CDS export + gestão da unidade |
| `nurse_manager` | Criar usuários, ver produção, atendimentos |
| `doctor` | Atendimentos, prescrições, prontuário |
| `acs` | Visitas domiciliares, cadastro individual, busca ativa |
| `receptionist` | Fila, agenda |
| `security_auditor` | Audit logs, exportação |
| `break_glass_admin` | Acesso de emergência — auditado |
