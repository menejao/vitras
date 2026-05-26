# DR Drill — Plano de Execução (2–4h)

**Ambiente alvo:** vitras-staging (NÃO vitras-drill-sa-3 — não degradar prod)  
**Executor:** João Pedro (Tech Lead)  
**Pré-requisito:** vitras-staging com DATABASE_URL apontando para banco de staging  
**Duração estimada:** 2–4h (snapshot 30min + PITR 1–2h + validação 30min)  
**Registro:** Preencher `dr-drill-final-report.md` durante execução  
**Critério de PASS:** RTO ≤ 240 min | RPO ≤ 24h | /readyz 200 na instância restaurada

> **Nota:** Se vitras-staging não existir, criar ambiente temporário com as mesmas env vars de vitras-drill-sa-3 (exceto DATABASE_URL → banco de staging). Não apontar drill para o banco de produção.

---

## Pré-drill checklist (15 min)

```bash
# Confirmar ambiente de staging está disponível e saudável
aws elasticbeanstalk describe-environment-health \
  --environment-name vitras-staging \
  --attribute-names Health \
  --query "{Color:Color,Status:HealthStatus}" \
  --output table

# Identificar DB instance de staging
aws rds describe-db-instances \
  --query "DBInstances[*].{ID:DBInstanceIdentifier,Status:DBInstanceStatus}" \
  --output table
```

- [ ] Staging EB existe e está Green
- [ ] DB instance de staging identificada: _______________________
- [ ] Horário de início registrado: _____ : _____ UTC
- [ ] Backup anterior à drill existe (não criar dados novos antes de anotar baseline)

---

## Passo 1 — Baseline pré-restore (15 min)

> ⚠️ **CRÍTICO:** Registrar ANTES de qualquer ação. Depois da restore não haverá comparação.

```bash
# Contagem de pacientes no banco de staging (via psql ou node script)
# Se não tiver psql local, usar script Node com DATABASE_URL do staging:
node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.STAGING_DATABASE_URL, ssl: { rejectUnauthorized: false } });
p.query('SELECT COUNT(*) FROM app_patients').then(r => { console.log('patients:', r.rows[0].count); p.end(); });
"

# Contagem de migrations
node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.STAGING_DATABASE_URL, ssl: { rejectUnauthorized: false } });
p.query('SELECT COUNT(*), MAX(applied_at) FROM schema_migrations').then(r => { console.log('migrations:', r.rows[0]); p.end(); });
"

# /readyz baseline
curl -s http://[staging-url]/readyz
```

Registrar:
- Pacientes no banco (staging): _______________
- Migrations aplicadas: _______________
- Último applied_at: _______________
- /readyz: _______________
- Hora do baseline: _____ : _____ UTC

---

## Passo 2 — Snapshot manual (10 min)

```bash
SNAP_ID="drill-$(date +%Y%m%d%H%M)"

aws rds create-db-snapshot \
  --db-instance-identifier [staging-db-id] \
  --db-snapshot-identifier "$SNAP_ID"

echo "Snapshot ID: $SNAP_ID"

# Aguardar disponível
aws rds describe-db-snapshots \
  --db-snapshot-identifier "$SNAP_ID" \
  --query "DBSnapshots[0].{Status:Status,AllocatedStorage:AllocatedStorage}" \
  --output table
```

- Snapshot ID: _______________________________
- Snapshot status: ___________________________
- Hora criação: _____ : _____ UTC

---

## Passo 3 — Simular falha (5 min)

Para drill de restore, simulamos que o banco de staging "falhou". Não apagar dados reais — apenas anotar que o drill começa aqui.

```bash
# Declarar início do "incidente"
echo "DRILL INICIADO: $(date -u)" | tee -a drill-log.txt
echo "RTO clock starts: $(date -u +%H:%M:%S)"
```

- **RTO clock start:** _____ : _____ UTC

---

## Passo 4 — Restore do snapshot (20–60 min dependendo do tamanho)

```bash
RESTORED_ID="drill-restored-$(date +%Y%m%d)"

aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier "$RESTORED_ID" \
  --db-snapshot-identifier "$SNAP_ID" \
  --db-instance-class db.t3.micro \
  --no-multi-az \
  --publicly-accessible false

echo "Aguardando restore..."

# Poll até 'available' (pode levar 10-40 min)
for i in $(seq 1 24); do
  STATUS=$(aws rds describe-db-instances \
    --db-instance-identifier "$RESTORED_ID" \
    --query "DBInstances[0].DBInstanceStatus" --output text 2>/dev/null)
  echo "[$(date -u +%H:%M:%S)] Status: $STATUS"
  [ "$STATUS" = "available" ] && break
  sleep 300  # 5 min entre polls
done
```

- Restore iniciado: _____ : _____ UTC
- Restore concluído: _____ : _____ UTC
- Duração restore: _____ min

---

## Passo 5 — Obter endpoint da instância restaurada (5 min)

```bash
aws rds describe-db-instances \
  --db-instance-identifier "$RESTORED_ID" \
  --query "DBInstances[0].Endpoint.{Host:Address,Port:Port}" \
  --output table
```

Endpoint restaurado: ___________________________:5432

---

## Passo 6 — Validar dados no banco restaurado (10 min)

```bash
# Construir DATABASE_URL para instância restaurada
RESTORED_URL="postgresql://[user]:[pass]@[endpoint]:5432/[dbname]"

# Contar pacientes
node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: '$RESTORED_URL', ssl: { rejectUnauthorized: false } });
p.query('SELECT COUNT(*) FROM app_patients').then(r => { console.log('patients restored:', r.rows[0].count); p.end(); });
"

# Contar migrations
node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: '$RESTORED_URL', ssl: { rejectUnauthorized: false } });
p.query('SELECT COUNT(*) FROM schema_migrations').then(r => { console.log('migrations restored:', r.rows[0].count); p.end(); });
"
```

| Métrica | Baseline | Restaurado | Match? |
|---------|----------|-----------|--------|
| Pacientes | ________ | _________ | [ ] |
| Migrations | ________ | _________ | [ ] |

**Critério:** contagens devem ser iguais. Diferença de 0 pacientes esperada (snapshot imediato).

---

## Passo 7 — Apontar staging EB para banco restaurado (5 min)

```bash
aws elasticbeanstalk update-environment \
  --environment-name vitras-staging \
  --option-settings \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=DATABASE_URL,Value=$RESTORED_URL"

echo "EB update triggered. Waiting for Green..."
```

- EB update iniciado: _____ : _____ UTC

---

## Passo 8 — Validar /readyz na staging com banco restaurado (10 min)

```bash
STAGING_URL="http://[staging-eb-cname]"

# Poll /readyz até 200
for i in $(seq 1 6); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$STAGING_URL/readyz")
  BODY=$(curl -s --max-time 10 "$STAGING_URL/readyz")
  echo "[$(date -u +%H:%M:%S)] /readyz: HTTP $STATUS | $BODY"
  [ "$STATUS" = "200" ] && break
  sleep 30
done

# /health
curl -s "$STAGING_URL/health" | node -e \
  "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const b=JSON.parse(d);console.log('postgres='+b.subsystems?.postgres+' migrations='+b.subsystems?.migrations);})"

# Login
curl -s -X POST "$STAGING_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"breakglass@vitras.com.br","password":"[breakglass-pass]"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const b=JSON.parse(d);console.log('role='+b.user?.role+' token='+(b.token?'present':'MISSING'));})"
```

- /readyz 200: _____ : _____ UTC (**RTO clock stop**)
- /health postgres: _______________
- /health migrations: _______________
- Login breakglass: _______________

---

## Passo 9 — Calcular RTO e RPO (5 min)

```
RTO = (hora /readyz 200) - (hora RTO clock start)
    = _____ : _____ - _____ : _____
    = _____ minutos

RPO = (hora snapshot criado) - (hora do "incidente")
    = _____ minutos (deve ser ≈ 0 para snapshot imediato)
    = Para produção real: tempo desde o último backup automático (≤ 24h)
```

| Métrica | Alvo | Real | PASS? |
|---------|------|------|-------|
| RTO | ≤ 240 min | _____ min | [ ] |
| RPO | ≤ 24h | _____ min | [ ] |

---

## Passo 10 — Cleanup (10 min)

```bash
# Restaurar DATABASE_URL original do staging
aws elasticbeanstalk update-environment \
  --environment-name vitras-staging \
  --option-settings \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=DATABASE_URL,Value=[original-staging-url]"

# Deletar instância restaurada (após confirmação)
aws rds delete-db-instance \
  --db-instance-identifier "$RESTORED_ID" \
  --skip-final-snapshot
```

- DATABASE_URL restaurado: _____ : _____ UTC
- Instância drill deletada: _____ : _____ UTC

---

## Resultado do drill

| Critério | Alvo | Resultado | PASS? |
|----------|------|-----------|-------|
| RTO | ≤ 240 min | _____ min | [ ] |
| RPO | ≤ 24h | _____ min | [ ] |
| /readyz 200 pós-restore | obrigatório | [ ] Sim / [ ] Não | [ ] |
| Login breakglass pós-restore | obrigatório | [ ] Sim / [ ] Não | [ ] |
| Contagem pacientes match | obrigatório | [ ] Sim / [ ] Não | [ ] |
| Migrations count match | obrigatório | [ ] Sim / [ ] Não | [ ] |

**VEREDICTO:** [ ] PASS — todos os critérios atendidos  
**VEREDICTO:** [ ] FAIL — critério(s) não atendido(s): _______________________

---

## Sign-off

Drill executado em: _____ / _____ / _______  
Horário início: _____ : _____ UTC  
Horário fim: _____ : _____ UTC  
Duração total: _____ min  

Gaps identificados durante drill:
1. ___________________________________________
2. ___________________________________________

**Tech Lead:** João Pedro — Assinatura: ___________________  
**Data:** _____ / _____ / _______

> Registrar resultado também em `dr-drill-final-report.md` Seção B e C.
