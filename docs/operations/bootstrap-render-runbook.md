# Runbook: Bootstrap Fresh — Render + Neon + Vercel

**Versão:** 1.0  
**Data:** 2026-08-05  
**Sprint:** VITRAS-PILOT-READINESS-01  
**Objetivo:** Implantar VITRAS do zero em um novo município — sem conhecimento implícito dos desenvolvedores.

---

## Pré-requisitos

| Item | Descrição |
|------|-----------|
| Conta Render | Acesso ao dashboard `dashboard.render.com` |
| Conta Neon | Banco Postgres em `console.neon.tech` |
| Conta Vercel | Frontend em `vercel.com` |
| Repositório | Acesso ao repositório VITRAS (GitHub) |
| `DATABASE_URL` | Connection string Neon (formato: `postgres://user:pass@host/db?sslmode=require`) |
| `JWT_SECRET` | String aleatória ≥ 64 chars: `openssl rand -hex 64` |
| `DATA_ENCRYPTION_KEY` | String aleatória ≥ 32 chars: `openssl rand -hex 32` |
| `PATIENT_LOOKUP_HASH_KEY` | String aleatória ≥ 32 chars, **diferente** do anterior |
| `BACKUP_EXPORT_KEY` | String aleatória para proteger export: `openssl rand -hex 32` |
| `MUNICIPALITY_ID` | Código IBGE do município (7 dígitos) |
| `FRONTEND_ORIGINS` | URL Vercel do frontend (ex: `https://vitras-xyz.vercel.app`) |

---

## Passo 1 — Configurar Neon

1. Criar projeto Neon: `console.neon.tech` → New Project
2. Anotar connection string: `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`
3. Ativar PITR (Point-in-Time Recovery): Project Settings → Enable PITR
4. Confirmar SSL obrigatório (padrão Neon)

---

## Passo 2 — Deploy Backend no Render

1. Render Dashboard → New → Web Service
2. Conectar repositório GitHub → selecionar branch `main`
3. **Root Directory:** `backend`
4. **Build Command:** `npm install --production=false`
5. **Start Command:** `npm start`
6. **Health Check Path:** `/health`
7. **Node Version:** 22.15.0 (definir em Environment → Node Version ou via `.node-version`)
8. Definir variáveis de ambiente no dashboard:

```
NODE_ENV=production
DATABASE_URL=<connection-string-neon>
JWT_SECRET=<gerado>
DATA_ENCRYPTION_KEY=<gerado-32-chars>
PATIENT_LOOKUP_HASH_KEY=<gerado-diferente-32-chars>
BACKUP_EXPORT_KEY=<gerado>
CORS_ALLOW_ALL=false
FRONTEND_ORIGINS=<url-vercel>
COOKIE_SAME_SITE=none
COOKIE_SECURE=true
RUN_MIGRATIONS=true
ENABLE_ADMIN_SEED=false
SEED_DEMO_DATA=false
READ_ONLY_MODE=false
LOG_FORMAT=json
REQUEST_LOG_ENABLED=true
GLOBAL_RATE_LIMIT_MAX=600
AUTH_MAX_ATTEMPTS=20
MUNICIPALITY_ID=<codigo-ibge-7-digitos>
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
APP_VERSION=v1.0-pilot-governed
AUDIT_LOG_RETENTION_DAYS=730
ENABLE_BACKUP_EXPORT=true
COUNCIL_VERIFY_MODE=off
```

> **COUNCIL_VERIFY_MODE=off** para primeiro deploy. Ajustar para `optional` ou `required` após configurar provedor de validação de conselho.

9. Salvar → Deploy → aguardar deploy completar (~3-5 min)

---

## Passo 3 — Verificar Migrations

Após o primeiro deploy, confirmar migrations aplicadas:

```bash
GET https://<render-url>/readyz
# Esperado: { "ok": true, "ready": true, "status": "healthy" }
```

```bash
GET https://<render-url>/health
# Verificar: version, uptimeSeconds, subsystems.database
```

Se migrations falharem: Render Logs → buscar `migration` para identificar erro.

Após migrations aplicadas com sucesso, definir `RUN_MIGRATIONS=false` no dashboard Render para evitar lock em restarts futuros.

---

## Passo 4 — Deploy Frontend no Vercel

1. Vercel Dashboard → New Project → importar repositório
2. **Root Directory:** `frontend-react` (ou conforme estrutura do repo)
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. Variáveis de ambiente Vercel:
   ```
   VITE_API_URL=https://<render-url>
   ```
6. Deploy → anotar URL gerada (ex: `https://vitras-xyz.vercel.app`)
7. Voltar ao Render e atualizar `FRONTEND_ORIGINS` com essa URL exata
8. Trigger redeploy no Render (ou aguardar próximo deploy automático)

---

## Passo 5 — Criar Primeiro Administrador (break_glass_admin)

Com `DATABASE_URL` do Neon acessível localmente:

```bash
cd backend
DATABASE_URL="<connection-string-neon>" node scripts/bootstrap-first-admin.mjs
```

**Saída esperada:**
```
✓ Admin criado com sucesso!
  vitrasId : 123456789
  Senha    : TempPass@XXXX
  Role     : break_glass_admin
  ATENÇÃO  : troca de senha obrigatória no primeiro login
```

Guardar a senha temporária. Ela não pode ser recuperada após esta execução.

---

## Passo 6 — Primeiro Login + Troca de Senha

```bash
POST https://<render-url>/auth/login
Content-Type: application/json

{ "email": "admin@vitras.local", "password": "<TempPass@XXXX>" }
```

Sistema solicitará troca de senha obrigatória (`forcePasswordChange: true`). Trocar via:

```bash
POST https://<render-url>/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{ "currentPassword": "<TempPass@XXXX>", "newPassword": "<NovaSenhaForte@2026>" }
```

---

## Passo 7 — Criar Primeira UBS

```bash
POST https://<render-url>/platform/units
Authorization: Bearer <BREAK_GLASS_TOKEN>
Content-Type: application/json

{
  "name": "UBS [Nome] — [Município]",
  "cnes": "1234567",
  "municipalityName": "[Nome do Município]",
  "municipalityId": "[Código IBGE 7 dígitos]",
  "uf": "[UF]",
  "street": "[Logradouro]",
  "streetNumber": "[Número]",
  "neighborhood": "[Bairro]",
  "cep": "[CEP sem pontuação]",
  "phone": "[Telefone]",
  "contactEmail": "[Email de contato]"
}
```

**Resposta:** `{ "id": "<unitId>", ... }` — **anotar `unitId`**.

---

## Passo 8 — Criar Gestor da UBS

```bash
POST https://<render-url>/platform/units/<unitId>/initial-manager
Authorization: Bearer <BREAK_GLASS_TOKEN>
Content-Type: application/json

{
  "name": "[Nome do Gestor]",
  "email": "[email@prefeitura.gov.br]",
  "role": "gestor",
  "councilType": "[CRM/COREN/...]",
  "councilNumber": "[número]",
  "councilUf": "[UF]"
}
```

**Resposta:** `{ "userId": "...", "temporaryPassword": "..." }` — comunicar senha ao gestor imediatamente. **Ela não é recuperável.**

---

## Passo 9 — Criar Equipe

```bash
POST https://<render-url>/platform/units/<unitId>/teams
Authorization: Bearer <BREAK_GLASS_TOKEN>
Content-Type: application/json

{
  "name": "Equipe [Nome/Cor]",
  "areaCode": "001"
}
```

**Resposta:** `{ "id": "<teamId>", ... }` — **anotar `teamId`**.

---

## Passo 10 — Validação Final

```bash
# 1. Health
GET https://<render-url>/health
# Esperado: { ok: true, status: "healthy", version: "...", uptimeSeconds: N }

# 2. Readiness
GET https://<render-url>/readyz
# Esperado: { ok: true, ready: true }

# 3. Login como gestor
POST https://<render-url>/auth/login
{ "email": "<gestor>", "password": "<temp-após-troca>" }
# Esperado: { accessToken: "..." }

# 4. Isolamento: gestor vê apenas sua UBS
GET https://<render-url>/patients
Authorization: Bearer <GESTOR_TOKEN>
# Esperado: lista vazia (sem pacientes ainda) e sem erro
```

---

## Rollback

Ver: `docs/rollout/ubs-001/rollback-plan.md`

Resumo:
- **Render:** Dashboard → Deploys → selecionar versão anterior → Rollback
- **Neon:** Console → Branch → Restore to point in time
- **Critério de rollback imediato:** `/readyz` não retorna 200 em 15 min após deploy

---

## Tempo Estimado de Implantação

| Etapa | Tempo estimado |
|-------|---------------|
| Configurar Neon | 15 min |
| Deploy Render (primeira vez) | 20 min |
| Deploy Vercel | 15 min |
| Bootstrap admin | 5 min |
| Criar UBS + Gestor + Equipe | 10 min |
| Validação smoke | 10 min |
| **Total** | **~75 min** |

---

## Referências

- `docs/multi-ubs-onboarding.md` — SOP detalhado
- `docs/rollout/ubs-001/onboarding-ubs-master-checklist.md` — checklist completo
- `docs/rollout/ubs-001/rollback-plan.md` — plano de rollback
- `docs/lgpd/vitras-lgpd-baseline-01-verdict.md` — baseline LGPD
- `render.yaml` — configuração completa de variáveis de ambiente
- `backend/.env.example` — referência de variáveis para desenvolvimento local
