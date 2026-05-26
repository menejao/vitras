# Deploy Reproducibility Runbook — Elastic Beanstalk (vitras-drill-sa-3)

Data: 2026-05-26  
Branch: `release/pilot-baseline`  
Ambiente: vitras-drill-sa-3 (sa-east-1, Amazon Linux 2023)

---

## Pré-requisitos

```bash
# AWS CLI configurado com permissões: elasticbeanstalk:*, ec2:Describe*, rds:Describe*, logs:*
aws sts get-caller-identity

# EB CLI (opcional mas recomendado para deploy de zip)
# eb --version

# Node.js 22 + npm (para scripts locais)
node --version   # deve ser v22.x
```

---

## 1. Deploy padrão (atualizar app existente)

```bash
# 1. Gerar zip do artefato
cd /caminho/para/vitras
zip -r vitras-$(git rev-parse --short HEAD).zip . \
  --exclude "*.git*" "node_modules/*" "*.env*"

# 2. Upload para S3 do EB
BUCKET=$(aws elasticbeanstalk describe-storage-location --query "S3Bucket" --output text)
KEY="vitras/$(git rev-parse --short HEAD).zip"
aws s3 cp vitras-$(git rev-parse --short HEAD).zip "s3://$BUCKET/$KEY"

# 3. Criar nova versão de aplicação
aws elasticbeanstalk create-application-version \
  --application-name vitras \
  --version-label "$(git rev-parse --short HEAD)" \
  --source-bundle S3Bucket="$BUCKET",S3Key="$KEY"

# 4. Deploy
aws elasticbeanstalk update-environment \
  --environment-name vitras-drill-sa-3 \
  --version-label "$(git rev-parse --short HEAD)"

# 5. Aguardar verde
aws elasticbeanstalk describe-environment-health \
  --environment-name vitras-drill-sa-3 \
  --attribute-names All \
  --query "{Status:HealthStatus,Color:Color}" \
  --output table
```

---

## 2. Configurar env vars (sem redeploy de código)

```bash
aws elasticbeanstalk update-environment \
  --environment-name vitras-drill-sa-3 \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=NODE_ENV,Value=production \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=JWT_SECRET,Value="[valor]" \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=DATA_ENCRYPTION_KEY,Value="[valor]"
# ... adicione mais conforme necessário

# EB reinicia automaticamente após update de env vars (~60-90s)
```

Ver lista completa de vars em `docs/runbooks/eb-secrets-audit.md`.

---

## 3. Migrations

**Regra: nunca deixar `RUN_MIGRATIONS=true` permanente.**

```bash
# Passo 1: Snapshot RDS antes de qualquer migration
aws rds create-db-snapshot \
  --db-instance-identifier vitras-drill-sa \
  --db-snapshot-identifier "pre-migration-$(date +%Y%m%d%H%M)"

# Aguardar snapshot
aws rds describe-db-snapshots \
  --db-snapshot-identifier "pre-migration-$(date +%Y%m%d%H%M)" \
  --query "DBSnapshots[0].Status" --output text
# deve retornar: available

# Passo 2: Setar RUN_MIGRATIONS=true temporariamente
aws elasticbeanstalk update-environment \
  --environment-name vitras-drill-sa-3 \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=RUN_MIGRATIONS,Value=true

# Aguardar restart + checar migrations em /health
curl -s http://[EB_URL]/health | node -e \
  "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).subsystems?.migrations))"

# Passo 3: REMOVER RUN_MIGRATIONS (obrigatório após aplicação)
aws elasticbeanstalk update-environment \
  --environment-name vitras-drill-sa-3 \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=RUN_MIGRATIONS,Value=false
# OU usar remove-option-settings:
aws elasticbeanstalk update-environment \
  --environment-name vitras-drill-sa-3 \
  --remove-option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=RUN_MIGRATIONS
```

---

## 4. Rollback

### 4a. Rollback de código (versão anterior)

```bash
# Listar versões disponíveis
aws elasticbeanstalk describe-application-versions \
  --application-name vitras \
  --query "ApplicationVersions[*].{Label:VersionLabel,Date:DateCreated}" \
  --output table

# Fazer rollback para versão anterior
aws elasticbeanstalk update-environment \
  --environment-name vitras-drill-sa-3 \
  --version-label "[version-label-anterior]"
```

### 4b. Rollback de banco (restaurar snapshot)

**Ação destrutiva — confirmar com time antes de executar.**

```bash
# 1. Listar snapshots disponíveis
aws rds describe-db-snapshots \
  --db-instance-identifier vitras-drill-sa \
  --query "DBSnapshots[*].{Id:DBSnapshotIdentifier,Time:SnapshotCreateTime,Status:Status}" \
  --output table

# 2. Restaurar snapshot para nova instância (NÃO sobrescreve instância atual diretamente)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier vitras-drill-sa-restored \
  --db-snapshot-identifier "[snapshot-id]"

# 3. Verificar dados restaurados antes de apontar DATABASE_URL para nova instância
# 4. Só então atualizar DATABASE_URL no EB para nova instância
```

---

## 5. Smoke tests pós-deploy

```bash
EB_URL="http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com"

# /readyz (deve retornar 200 e ok=true)
curl -sf "$EB_URL/readyz" | grep '"ok":true' && echo "readyz OK" || echo "readyz FAIL"

# /health (postgres e migrations devem ser ok)
curl -s "$EB_URL/health"

# Login breakglass
TOKEN=$(curl -s -X POST "$EB_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"breakglass@vitras.com.br","password":"[senha-breakglass]"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).token||'FAIL'))")
echo "Token: ${TOKEN:0:20}..."

# Acesso autenticado
curl -s -o /dev/null -w "HTTP %{http_code}" -H "Authorization: Bearer $TOKEN" "$EB_URL/patients"
curl -s -o /dev/null -w "HTTP %{http_code}" -H "Authorization: Bearer $TOKEN" "$EB_URL/agenda"
curl -s -o /dev/null -w "HTTP %{http_code}" -H "Authorization: Bearer $TOKEN" "$EB_URL/audit-logs"

# Sem token (deve ser 401)
curl -s -o /dev/null -w "HTTP %{http_code}" "$EB_URL/patients"
```

---

## 6. Diagnóstico de problemas comuns

| Sintoma | Causa provável | Diagnóstico |
|---------|---------------|-------------|
| App loop de crash | DB inacessível (SG, timeout) ou env var obrigatória ausente | Checar EB logs + SG do RDS |
| 502 Bad Gateway | App não subiu na porta certa | `eb logs` → checar `PORT` |
| Migration `rejectUnauthorized` error | runner.js com SSL incorreto | Verificar `backend/src/migrations/runner.js` — deve ser `rejectUnauthorized: false` |
| `/readyz` 503 | `ready` nunca setado — `initialize()` falhou | Checar se DATABASE_URL e DATA_ENCRYPTION_KEY estão corretos |
| Login retorna 500 | DATA_ENCRYPTION_KEY ausente ou incorreta | Testar descriptografia local com sample `enc1:...` do banco |
| Migration 008 falha | `DROP INDEX CONCURRENTLY` dentro de transação | Inserir manualmente em `schema_migrations` após confirmar índices já inexistentes |
| `/readyz` ok mas `/patients` 500 | PATIENT_LOOKUP_HASH_KEY ausente | Verificar env var + backfill de cpf_hash |

### Checar EB logs via CLI

```bash
aws elasticbeanstalk request-environment-info \
  --environment-name vitras-drill-sa-3 \
  --info-type tail

sleep 15

aws elasticbeanstalk retrieve-environment-info \
  --environment-name vitras-drill-sa-3 \
  --info-type tail \
  --query "EnvironmentInfo[0].Message" --output text
```

---

## 7. Restart de aplicação (sem redeploy)

```bash
aws elasticbeanstalk restart-app-server --environment-name vitras-drill-sa-3
# Boot esperado: ~16s | /readyz disponível em ~30-60s após restart
```

---

## 8. Checklist de deploy completo

- [ ] Snapshot RDS criado antes do deploy
- [ ] Branch `release/pilot-baseline` atualizada e testes locais passando
- [ ] Env vars auditadas conforme `eb-secrets-audit.md`
- [ ] `RUN_MIGRATIONS=true` temporário se houver migrations novas
- [ ] Deploy executado, EB color = Green
- [ ] `RUN_MIGRATIONS` removido após migrations aplicadas
- [ ] `/readyz` retorna 200 + `ok=true`
- [ ] `/health` mostra `postgres=ok`, `migrations=ok`
- [ ] Login breakglass funciona
- [ ] `/patients`, `/agenda`, `/audit-logs` retornam 200 autenticados
- [ ] Requisição sem token retorna 401
- [ ] Restart de app server + re-validação de `/readyz` executado
