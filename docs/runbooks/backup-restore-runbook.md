# Runbook: Backup e Restore — VITRAS

> **Tipo:** Runbook Operacional
> **Revisão:** Sprint 4 — Maio 2026
> **Audience:** Engenheiro On-call, DevOps

---

## Checklist Pré-Restore

Antes de iniciar qualquer restore, confirme TODOS os itens:

- [ ] Incidente documentado com ID e timestamp de início
- [ ] Aprovação do Gestor Técnico / Tech Lead obtida
- [ ] Snapshot/ponto de restore identificado e verificado
- [ ] Janela de manutenção comunicada aos usuários (se aplicável)
- [ ] Ambiente de destino identificado (staging ou prod)
- [ ] Credenciais AWS com permissões de RDS disponíveis
- [ ] Channel de comunicação de incidente aberto (Slack/Teams/WhatsApp)
- [ ] Backup manual criado do estado atual (se DB ainda acessível):
  ```bash
  aws rds create-db-snapshot \
    --db-instance-identifier vitras-prod \
    --db-snapshot-identifier vitras-prod-emergency-$(date +%Y%m%d-%H%M)
  ```

---

## 1. Restore Point-In-Time (PITR) — RDS PostgreSQL

### 1.1 Identificar o Ponto de Restore

```bash
# Verificar o range de restore disponível
aws rds describe-db-instances \
  --db-instance-identifier vitras-prod \
  --query 'DBInstances[0].LatestRestorableTime'

# Verificar earliest restore point
aws rds describe-db-instances \
  --db-instance-identifier vitras-prod \
  --query 'DBInstances[0].EarliestRestorableTime'
```

### 1.2 Criar Instância Restaurada

```bash
# PITR para timestamp específico (ISO 8601)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vitras-prod \
  --target-db-instance-identifier vitras-prod-restored-$(date +%Y%m%d) \
  --restore-time "2026-05-25T10:00:00Z" \
  --db-instance-class db.t3.medium \
  --vpc-security-group-ids sg-0bb5e7e5b8f9133bb \
  --db-subnet-group-name default-vpc-0793a0713e76b3d72 \
  --no-publicly-accessible

# Aguardar a instância ficar disponível (pode levar 15-60 minutos)
aws rds wait db-instance-available \
  --db-instance-identifier vitras-prod-restored-$(date +%Y%m%d)
```

### 1.3 Obter Endpoint da Instância Restaurada

```bash
aws rds describe-db-instances \
  --db-instance-identifier vitras-prod-restored-$(date +%Y%m%d) \
  --query 'DBInstances[0].Endpoint.Address'
```

### 1.4 Restore de Snapshot Manual (alternativa ao PITR)

```bash
# Listar snapshots disponíveis
aws rds describe-db-snapshots \
  --db-instance-identifier vitras-prod \
  --query 'DBSnapshots[*].{ID:DBSnapshotIdentifier,Time:SnapshotCreateTime,Status:Status}' \
  --output table

# Restaurar a partir de snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier vitras-prod-from-snapshot \
  --db-snapshot-identifier vitras-prod-pre-deploy-20260525 \
  --db-instance-class db.t3.medium \
  --no-publicly-accessible
```

---

## 2. Validação Pós-Restore

### 2.1 Executar Migrations

Após apontar `DATABASE_URL` para a instância restaurada:

```bash
# No EB — via deploy com variável de ambiente
RUN_MIGRATIONS=true eb deploy --staged

# Ou localmente (com VPN/bastion):
DATABASE_URL=postgres://user:pass@restored-endpoint:5432/vitras \
RUN_MIGRATIONS=true \
NODE_ENV=production \
node -e "import('./src/migrations/runner.js').then(m => m.runMigrations())"
```

**Verificar resultado esperado:**
- Log `migrations.completed` sem erros
- Todas as migrations de 001 a 011 presentes em `schema_migrations`

### 2.2 Verificar Índices Hash (Migration 006)

```sql
-- Conectar ao banco restaurado
\c vitras

-- Verificar existência dos índices únicos
SELECT indexname, tablename FROM pg_indexes
WHERE indexname IN ('patients_cpf_hash_unique_partial', 'patients_cns_hash_unique_partial');

-- Verificar que colunas existem
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patients' AND column_name IN ('cpf_hash', 'cns_hash');

-- Verificar schema_migrations
SELECT id, applied_at FROM schema_migrations ORDER BY applied_at;
```

### 2.3 Testar /readyz

```bash
# Após iniciar o servidor apontando para o banco restaurado:
curl -f https://vitras-restored.elasticbeanstalk.com/readyz

# Resposta esperada: HTTP 200
# { "ok": true, ... }
```

### 2.4 Testar /health Subsystems

```bash
curl https://vitras-restored.elasticbeanstalk.com/health | jq '.subsystems'

# Resposta esperada:
# {
#   "postgres": "ok",
#   "redis": "ok" | "unknown",
#   "migrations": "ok",
#   "auditChain": "ok"
# }
```

### 2.5 Teste de Login

```bash
# Testar autenticação básica
curl -X POST https://vitras-restored.elasticbeanstalk.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gestor@ubs.local","password":"..."}' \
  | jq '.ok'
```

### 2.6 Verificar Integridade da Chain de Audit

```bash
curl -H "Authorization: Bearer $SECURITY_AUDITOR_TOKEN" \
  https://vitras-restored.elasticbeanstalk.com/audit-logs/integrity \
  | jq '{status: .status, checked: .checked}'
```

---

## 3. Cutover para Instância Restaurada

Após validação bem-sucedida:

1. Colocar instância atual em modo manutenção (retornar 503 via EB health)
2. Atualizar `DATABASE_URL` no EB Environment → Configuration → Software
3. Reiniciar ambiente EB: `eb restart vitras-prod`
4. Aguardar health check passar (≤ 5 minutos)
5. Validar `/readyz` retorna 200
6. Comunicar fim da janela de manutenção

---

## 4. Rollback se Restore Falhar

Se o restore não for bem-sucedido:

1. **NÃO** deletar a instância original — ela ainda está disponível
2. Reverter `DATABASE_URL` para a instância original no EB
3. Reiniciar EB: `eb restart vitras-prod`
4. Verificar `/readyz` na instância original
5. Documentar falha com timestamp e erro específico
6. Escalar para AWS Support se necessário (RDS restore timeout)

**Instância original:**
- Identificar via Console RDS → Instances (instância sem sufixo `-restored`)
- Endpoint disponível em: RDS → vitras-prod → Connectivity & security

---

## 5. Escalação de Contatos

| Nível | Contato | Trigger |
|-------|---------|---------|
| 1 — Engenheiro On-call | De plantão (rotativo) | Qualquer incidente de restore |
| 2 — Tech Lead | João / responsável técnico | RTO > 2 horas |
| 3 — AWS Support | Case via Console | Falha em operação RDS; RTO > 3 horas |
| 4 — Gestor Clínico | Responsável UBS | Perda de dados clinicamente relevante |

**AWS Support:**
- Console: https://console.aws.amazon.com/support
- Para RDS: selecionar "Database" → "Amazon RDS" → "Instance issues"
- Nível de suporte mínimo recomendado: Business (SLA 1h para produção)

---

## 6. Após o Incidente

- [ ] Registro de incidente atualizado com: início, fim, causa-raiz, perda de dados (RPO real)
- [ ] Instância restaurada deletada (após validação de que prod está saudável)
- [ ] Snapshots de emergência etiquetados e retidos por 90 dias
- [ ] Post-mortem agendado em 72 horas
- [ ] `backup.restore_test_required.last_tested` atualizado no log de startup
- [ ] Drill checklist em `disaster-recovery.md` revisado se necessário
