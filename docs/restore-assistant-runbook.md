# VITRAS — Restore Assistant Runbook

**Versão:** v1.0  
**Data:** 2026-06-10  
**Classificação:** OPERATIONAL RUNBOOK  
**Ambiente:** staging / produção — RDS sa-east-1

> **Para uso por IA assistindo operador humano.**  
> Este documento define como interpretar pedidos em linguagem natural e traduzi-los em comandos AWS seguros para restauração de backup do VITRAS.

---

## 1. Objetivo

Permitir que um operador descreva em linguagem simples o que precisa restaurar e que a IA:

1. Interprete o pedido sem ambiguidade.
2. Identifique o snapshot correto.
3. Confirme com o operador antes de qualquer ação destrutiva ou de produção.
4. Execute apenas o mínimo necessário.
5. Nunca sobrescreva o banco atual sem confirmação explícita.

---

## 2. Escopo

Este runbook cobre:

- Listagem de snapshots disponíveis (read-only, sem confirmação)
- Restauração de snapshot em **nova instância RDS** (não sobrescreve o banco atual)
- Validação da instância restaurada
- Failover controlado (troca `DATABASE_URL` no EB) — **exige confirmação explícita**
- Rollback ao banco original — **exige confirmação explícita**
- Teardown de instância temporária — **exige confirmação explícita**

**Fora de escopo:**

- Modificação de dados clínicos
- Alteração de schema ou migrações
- Criação de usuários ou credenciais
- Qualquer ação que não seja restore ou validação de restore

---

## 3. Recursos AWS Envolvidos

| Recurso | Identificador | Observação |
|---------|---------------|------------|
| RDS principal (staging) | `vitras-drill-restore` | Banco ativo — NUNCA modificar diretamente |
| EB environment | `vitras-drill-sa-3` | App server — `DATABASE_URL` aponta para o RDS acima |
| Lambda automação | `vitras-rds-snapshot` | Cria snapshots 2x/dia |
| EventBridge 00h | `vitras-rds-snapshot-00h` | `cron(0 0 * * ? *)` UTC |
| EventBridge 12h | `vitras-rds-snapshot-12h` | `cron(0 12 * * ? *)` UTC |
| Prefixo snapshots auto | `vitras-auto-YYYYMMDD-HHMM` | ex: `vitras-auto-20260610-0000` |
| Prefixo snapshots manuais | `vitras-` (sem `auto`) | ex: `vitras-before-secret-rotation-2026-06-01` |
| Retenção automática | 7 dias | Lambda apaga `vitras-auto-*` > 7 dias |
| Região | `sa-east-1` | Todos os recursos |

**Horários dos snapshots automáticos (UTC):**

| Snapshot | Horário UTC | Horário BRT (UTC-3) |
|----------|------------|---------------------|
| `vitras-auto-YYYYMMDD-0000` | 00:00 | 21:00 dia anterior |
| `vitras-auto-YYYYMMDD-1200` | 12:00 | 09:00 |

---

## 4. Comandos Permitidos Sem Confirmação

Ações read-only. A IA pode sugerir e executar sem confirmação explícita.

### 4.1 Listar Snapshots Disponíveis

```powershell
# Todos os snapshots vitras (automáticos + manuais)
aws rds describe-db-snapshots `
  --db-instance-identifier vitras-drill-restore `
  --snapshot-type manual `
  --region sa-east-1 `
  --query "DBSnapshots[*].{Id:DBSnapshotIdentifier,Status:Status,Created:SnapshotCreateTime,SizeGB:AllocatedStorage}" `
  --output table
```

```powershell
# Somente snapshots automáticos vitras-auto-*
aws rds describe-db-snapshots `
  --db-instance-identifier vitras-drill-restore `
  --snapshot-type manual `
  --region sa-east-1 `
  --query "DBSnapshots[?starts_with(DBSnapshotIdentifier,'vitras-auto')].{Id:DBSnapshotIdentifier,Status:Status,Created:SnapshotCreateTime}" `
  --output table
```

### 4.2 Verificar Instâncias RDS Existentes

```powershell
aws rds describe-db-instances `
  --region sa-east-1 `
  --query "DBInstances[*].{Id:DBInstanceIdentifier,Status:DBInstanceStatus,Engine:Engine,Endpoint:Endpoint.Address}" `
  --output table
```

### 4.3 Verificar Status de Restore em Andamento

```powershell
aws rds describe-db-instances `
  --db-instance-identifier vitras-restore-[SUFIXO] `
  --region sa-east-1 `
  --query "DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Available:ReadReplicaDBInstanceIdentifiers}" `
  --output table
```

### 4.4 Consultar Automação (EventBridge + Lambda)

```powershell
# Verificar rules ativas
aws events list-rules `
  --name-prefix vitras-rds-snapshot `
  --region sa-east-1 `
  --query "Rules[*].{Name:Name,State:State,Schedule:ScheduleExpression}" `
  --output table

# Verificar Lambda
aws lambda get-function `
  --function-name vitras-rds-snapshot `
  --region sa-east-1 `
  --query "Configuration.{State:State,LastModified:LastModified,Timeout:Timeout}" `
  --output table
```

### 4.5 Verificar /readyz de Instância Restaurada (sem afetar produção)

```powershell
# Apenas se instância restaurada já estiver no EB como DATABASE_URL temporário
# Substitua [URL-RESTAURADA] pelo endpoint da nova instância
curl https://[URL-RESTAURADA]/readyz
```

---

## 5. Ações que Exigem Confirmação Explícita

**REGRA ABSOLUTA:** A IA deve mostrar exatamente o que vai fazer e aguardar `SIM` do operador antes de executar qualquer uma das ações abaixo.

| Ação | Por que exige confirmação |
|------|--------------------------|
| Criar instância restaurada | Consome quota RDS e custa tempo |
| Trocar `DATABASE_URL` no EB | Afeta produção imediatamente |
| Reiniciar EB (`eb restart`) | Causa downtime de ~2 min |
| Deletar instância RDS | Ação irreversível |
| Apagar snapshot manual | Ação irreversível |
| Fazer rollback ao banco original | Afeta produção |
| Qualquer ação em produção real | Impacto a pacientes reais |

**Modelo de confirmação obrigatório:**

```
AÇÃO PROPOSTA: Restaurar snapshot vitras-auto-20260610-0000 em nova instância vitras-restore-20260610a.
IMPACTO: nova instância RDS criada (não afeta produção). Custo: ~$0 Free Tier se < 750h/mês.
BANCO ATUAL NÃO SERÁ ALTERADO.

Digite SIM para confirmar ou NÃO para cancelar:
```

---

## 6. Interpretação de Linguagem Natural

### Mapeamento de Pedidos

| Pedido do operador | Interpretação | Snapshot alvo |
|--------------------|---------------|---------------|
| "volta o backup de ontem 12h" | snapshot do dia anterior às 12:00 UTC | `vitras-auto-YYYYMMDD-1200` onde YYYYMMDD = data de ontem |
| "backup de hoje 00h" | snapshot de hoje às 00:00 UTC | `vitras-auto-YYYYMMDD-0000` onde YYYYMMDD = hoje |
| "backup mais recente" | snapshot `vitras-auto-*` mais recente disponível | último criado com status `available` |
| "backup de antes do deploy" | snapshot manual mais próximo antes do horário do deploy | consultar `vitras-*` por timestamp |
| "volta para antes do erro das 14h" | snapshot imediatamente anterior às 14:00 UTC do dia do erro | `vitras-auto-YYYYMMDD-1200` (12:00 é o ponto mais próximo antes das 14h) |
| "backup de anteontem" | dia atual - 2 | `vitras-auto-YYYYMMDD-1200` do dia dois dias atrás |
| "backup da sexta passada" | identificar data correta | `vitras-auto-YYYYMMDD-0000` ou `-1200` da sexta |

### Regra de Fuso Horário

> Todos os horários em pedidos do operador são tratados como **UTC** por padrão.  
> Se o operador disser "12h de Brasília", converter: BRT = UTC-3 → 12h BRT = 15h UTC.  
> Sempre confirmar o snapshot identificado antes de agir.

### Resolução de Ambiguidade

Se o pedido não identificar um snapshot único, a IA deve:

1. Listar os candidatos compatíveis.
2. Perguntar qual usar.
3. Somente após confirmação do operador, prosseguir.

**Exemplo de ambiguidade:**

```
Operador: "restaura o backup de ontem"
IA: Existem dois snapshots de ontem (YYYY-MM-DD):
  1. vitras-auto-20260609-0000 — criado 2026-06-09T00:00Z (21:00 BRT de 2026-06-08)
  2. vitras-auto-20260609-1200 — criado 2026-06-09T12:00Z (09:00 BRT de 2026-06-09)
Qual devo usar? Digite 1 ou 2:
```

---

## 7. Fluxo Seguro de Restore

### Passo a passo obrigatório

```
1. INTERPRETAR pedido do operador
   └── identificar data/hora alvo
   └── converter fuso se necessário
   └── resolver ambiguidade se houver

2. LISTAR snapshots compatíveis (read-only — sem confirmação)
   └── aws rds describe-db-snapshots ...

3. CONFIRMAR snapshot com operador
   └── mostrar: ID, data de criação, tamanho
   └── aguardar confirmação

4. [CONFIRMAÇÃO] RESTAURAR em NOVA instância
   └── nome sugerido: vitras-restore-YYYYMMDD-SUFIXO
   └── NUNCA usar vitras-drill-restore ou vitras-prod como destino
   └── aguardar status = available

5. VALIDAR nova instância
   └── /readyz → 200
   └── /health → postgres: ok
   └── login de teste (opcional)
   └── integridade audit (opcional)

6. [OPCIONAL — CONFIRMAÇÃO] FAILOVER CONTROLADO
   └── trocar DATABASE_URL no EB para nova instância
   └── reiniciar EB
   └── validar /readyz no EB

7. [OPCIONAL — CONFIRMAÇÃO] ROLLBACK
   └── reverter DATABASE_URL para instância original
   └── reiniciar EB
   └── validar /readyz

8. [OPCIONAL — CONFIRMAÇÃO] TEARDOWN
   └── deletar instância temporária
   └── confirmar que produção está estável antes
```

---

## 8. Comandos PowerShell

### 8.1 Listar Snapshots `vitras-auto-*`

```powershell
aws rds describe-db-snapshots `
  --db-instance-identifier vitras-drill-restore `
  --snapshot-type manual `
  --region sa-east-1 `
  --query "reverse(sort_by(DBSnapshots[?starts_with(DBSnapshotIdentifier,'vitras-auto')],&SnapshotCreateTime))[*].{Id:DBSnapshotIdentifier,Status:Status,Created:SnapshotCreateTime,SizeGB:AllocatedStorage}" `
  --output table
```

### 8.2 Restaurar Snapshot em Nova Instância

```powershell
# Substitua SNAPSHOT_ID e NOVO_ID pelos valores corretos
$SNAPSHOT_ID = "vitras-auto-20260610-0000"
$NOVO_ID     = "vitras-restore-20260610a"

aws rds restore-db-instance-from-db-snapshot `
  --db-instance-identifier $NOVO_ID `
  --db-snapshot-identifier $SNAPSHOT_ID `
  --db-instance-class db.t3.micro `
  --no-multi-az `
  --no-publicly-accessible `
  --region sa-east-1
```

> **ATENÇÃO:** A nova instância herda o VPC e o SG do snapshot. Verificar que o SG permite acesso do EB após o restore.

### 8.3 Acompanhar Status do Restore

```powershell
# Polling até available (executar a cada 30-60s)
$NOVO_ID = "vitras-restore-20260610a"

aws rds describe-db-instances `
  --db-instance-identifier $NOVO_ID `
  --region sa-east-1 `
  --query "DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port}" `
  --output table
```

### 8.4 Obter Endpoint da Instância Restaurada

```powershell
$NOVO_ID = "vitras-restore-20260610a"

aws rds describe-db-instances `
  --db-instance-identifier $NOVO_ID `
  --region sa-east-1 `
  --query "DBInstances[0].Endpoint.{Address:Address,Port:Port}" `
  --output table
```

### 8.5 Validar /readyz (contra instância restaurada via porta direta — não EB)

```powershell
# Somente se servidor apontado para instância restaurada localmente
# Substituir [ENDPOINT] pelo endereço obtido no passo anterior
curl https://api.vitras.com.br/readyz
# OU contra staging diretamente:
curl http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/readyz
```

### 8.6 Trocar `DATABASE_URL` no EB (CONFIRMAÇÃO OBRIGATÓRIA)

```powershell
# Obter variáveis atuais primeiro (read-only)
aws elasticbeanstalk describe-configuration-settings `
  --application-name vitras `
  --environment-name vitras-drill-sa-3 `
  --region sa-east-1 `
  --query "ConfigurationSettings[0].OptionSettings[?OptionName=='DATABASE_URL']" `
  --output table

# ⚠️ AÇÃO DESTRUTIVA — EXIGE CONFIRMAÇÃO EXPLÍCITA
# Somente após SIM do operador:
$NOVA_URL = "postgres://[USER]:[PASS]@[ENDPOINT]:5432/[DB]"

aws elasticbeanstalk update-environment `
  --environment-name vitras-drill-sa-3 `
  --option-settings "Namespace=aws:elasticbeanstalk:application:environment,OptionName=DATABASE_URL,Value=$NOVA_URL" `
  --region sa-east-1
```

> **NUNCA logar `$NOVA_URL` em canais públicos. Usar vault para credenciais.**

### 8.7 Reiniciar EB (CONFIRMAÇÃO OBRIGATÓRIA)

```powershell
# ⚠️ Causa downtime de ~2 min — EXIGE CONFIRMAÇÃO EXPLÍCITA
aws elasticbeanstalk restart-app-server `
  --environment-name vitras-drill-sa-3 `
  --region sa-east-1
```

### 8.8 Deletar Instância Temporária (CONFIRMAÇÃO OBRIGATÓRIA)

```powershell
# ⚠️ AÇÃO IRREVERSÍVEL — EXIGE CONFIRMAÇÃO EXPLÍCITA
$NOVO_ID = "vitras-restore-20260610a"

aws rds delete-db-instance `
  --db-instance-identifier $NOVO_ID `
  --skip-final-snapshot `
  --region sa-east-1
```

---

## 9. Exemplos Prontos

### Exemplo 1 — "volta o backup de ontem 12h"

```
Operador: "volta o backup de ontem 12h"

IA:
Interpretação: snapshot de 2026-06-09 às 12:00 UTC.
Snapshot identificado: vitras-auto-20260609-1200
  Criado em: 2026-06-09T12:00:03Z
  Status: available
  Tamanho: 20 GB

AÇÃO PROPOSTA: Restaurar vitras-auto-20260609-1200 em nova instância vitras-restore-20260609b.
O banco atual (vitras-drill-restore) NÃO será alterado.

Confirmar? (SIM / NÃO):
```

Após SIM:

```powershell
aws rds restore-db-instance-from-db-snapshot `
  --db-instance-identifier vitras-restore-20260609b `
  --db-snapshot-identifier vitras-auto-20260609-1200 `
  --db-instance-class db.t3.micro `
  --no-multi-az `
  --no-publicly-accessible `
  --region sa-east-1
```

```powershell
# Polling status até available:
aws rds describe-db-instances `
  --db-instance-identifier vitras-restore-20260609b `
  --region sa-east-1 `
  --query "DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address}" `
  --output table
```

---

### Exemplo 2 — "restaura o backup mais recente"

```
Operador: "restaura o backup mais recente"

IA: Identificando snapshot mais recente...
```

```powershell
aws rds describe-db-snapshots `
  --db-instance-identifier vitras-drill-restore `
  --snapshot-type manual `
  --region sa-east-1 `
  --query "reverse(sort_by(DBSnapshots[?starts_with(DBSnapshotIdentifier,'vitras-auto')],&SnapshotCreateTime))[0].{Id:DBSnapshotIdentifier,Status:Status,Created:SnapshotCreateTime}" `
  --output table
```

```
Resultado:
  Id:      vitras-auto-20260610-1200
  Status:  available
  Created: 2026-06-10T12:00:04Z

AÇÃO PROPOSTA: Restaurar vitras-auto-20260610-1200 em nova instância vitras-restore-20260610a.
Banco atual NÃO alterado.

Confirmar? (SIM / NÃO):
```

---

### Exemplo 3 — "volta para antes do erro das 14h"

```
Operador: "volta para antes do erro das 14h"

IA: Interpretação: ponto de restore anterior às 14:00 UTC de hoje (2026-06-10).
Snapshots disponíveis antes das 14:00 UTC de hoje:
  1. vitras-auto-20260610-1200 — 12:00 UTC (2h antes do erro)
  2. vitras-auto-20260610-0000 — 00:00 UTC (14h antes do erro)

Para o ponto mais próximo anterior ao erro, recomendo opção 1.
Confirmar uso de vitras-auto-20260610-1200? (SIM / NÃO):
```

---

## 10. Critérios de Sucesso

| Critério | Verificação |
|----------|-------------|
| Instância restaurada `available` | `aws rds describe-db-instances` → `Status=available` |
| `/readyz` retorna 200 | `curl .../readyz` → `{"ok":true}` |
| Login funcional | `POST /auth/login` com credencial válida → `200 ok` |
| Audit integrity OK | `GET /audit-logs/integrity` → `status: ok` ou `legacy_incompatible` aceito |
| Banco atual não alterado | `aws rds describe-db-instances --db vitras-drill-restore` → status inalterado |
| Staging/produção não alterado | `DATABASE_URL` do EB inalterado (exceto se failover confirmado) |

---

## 11. Critérios de NO-GO

Parar e escalar se qualquer um dos itens abaixo ocorrer:

| Critério | Ação |
|----------|------|
| Snapshot identificado não existe | Listar todos os snapshots disponíveis; verificar data/hora; escolher alternativa |
| `restore-db-instance-from-db-snapshot` retorna erro | Registrar erro; verificar quota RDS Free Tier (max 2 instâncias) |
| Instância restaurada não fica `available` em 30 min | Verificar CloudWatch Events do RDS; escalar para AWS Support |
| Operador não confirma failover | Manter banco atual; instância restaurada permanece isolada para inspeção |
| `DATABASE_URL` da nova instância não verificada | NÃO atualizar EB sem endpoint confirmado |
| Credenciais RDS ausentes ou incorretas | NÃO prosseguir; obter credenciais do vault seguro |
| `/readyz` na instância restaurada retorna 500 ou timeout | NÃO promover para produção; diagnosticar erro antes |

---

## 12. Rollback

**Rollback só ocorre após confirmação explícita do operador.**

### Se failover já foi feito (DATABASE_URL trocado para instância restaurada):

```powershell
# 1. Obter URL original (do vault ou do histórico do EB)
$URL_ORIGINAL = "postgres://[USER]:[PASS]@vitras-drill-restore.[ENDPOINT]:5432/[DB]"

# 2. ⚠️ CONFIRMAÇÃO OBRIGATÓRIA antes de executar
aws elasticbeanstalk update-environment `
  --environment-name vitras-drill-sa-3 `
  --option-settings "Namespace=aws:elasticbeanstalk:application:environment,OptionName=DATABASE_URL,Value=$URL_ORIGINAL" `
  --region sa-east-1

# 3. ⚠️ CONFIRMAÇÃO OBRIGATÓRIA
aws elasticbeanstalk restart-app-server `
  --environment-name vitras-drill-sa-3 `
  --region sa-east-1

# 4. Validar
curl http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/readyz
```

### Teardown da instância temporária (após rollback confirmado):

```powershell
# ⚠️ CONFIRMAÇÃO OBRIGATÓRIA — AÇÃO IRREVERSÍVEL
aws rds delete-db-instance `
  --db-instance-identifier vitras-restore-[SUFIXO] `
  --skip-final-snapshot `
  --region sa-east-1
```

---

## 13. Nota de Segurança

| Regra | Detalhe |
|-------|---------|
| **Nunca expor `DATABASE_URL` em logs públicos** | Contém credenciais do banco. Usar variável de ambiente ou vault. |
| **Nunca colar senhas em chat** | Credenciais devem vir do vault seguro (AWS Secrets Manager, 1Password, etc.) |
| **Registrar toda operação** | Toda ação de restore deve ser documentada: operador, horário UTC, snapshot usado, motivo, resultado. |
| **Instâncias temporárias devem ser deletadas** | Após validação ou rollback, deletar instância temporária para evitar custo e confusão. |
| **SG da instância restaurada** | Verificar que o SG permite acesso do EB e bloqueia acesso público (0.0.0.0/0). |
| **Credenciais herdadas do snapshot** | A senha do RDS restaurado é a mesma do banco original. Se houve rotação de secrets após o snapshot, ajustar antes do failover. |
| **Não usar `break_glass_admin` para teste de restore** | Usar usuário de teste dedicado. |

---

## Apêndice — Snapshots Manuais Existentes (referência)

| ID | Data | Observação |
|----|------|-----------|
| `vitras-auto-20260610-1718` | 2026-06-10T17:18Z | Snapshot de validação da automação |
| `vitras-drill-202606091356` | 2026-06-09T13:56Z | DR drill 2026-06-09 |
| `vitras-before-secret-rotation-2026-06-01` | 2026-06-01T13:45Z | Pré-rotação de secrets |
| `vitras-staging-pre-sprint5-20260528` | 2026-05-28T21:33Z | Pré-Sprint 5 |
| `vitras-drill-restore-pre-migration-20260526` | 2026-05-26T20:02Z | Pré-migration |

---

*Runbook versão v1.0 — 2026-06-10*  
*Referência: `backup-restore-runbook.md`, `dr-drill-final-report.md`, `aceite-operacional.md`*  
*Requer revisão a cada mudança de infraestrutura relevante (novo RDS, rotação de secrets, mudança de EB)*
