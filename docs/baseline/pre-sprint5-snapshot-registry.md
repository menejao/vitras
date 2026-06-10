# Registro de Snapshot RDS — Pré-Sprint 5

**Identificador:** `vitras-staging-pre-sprint5-YYYYMMDD`
**Status:** PENDENTE — João deve preencher após criar o snapshot no AWS Console

---

## Por Que Este Registro Existe

Toda migration de Sprint 5 (Fase 2) que alterar schema precisa de um ponto de retorno seguro no RDS.
Este arquivo é a evidência formal de que o snapshot foi criado antes de qualquer `withDb()` de Sprint 5
aterrissar em produção/staging. Sem o snapshot confirmado, o deploy de Sprint 5 não tem autorização (NO-GO).

---

## Instruções: Como Criar o Snapshot Manual no AWS Console

1. Acessar **AWS Console** → **RDS** → **Databases**
2. Selecionar a instância de banco do ambiente correto (staging ou produção — confirmar com o nome exato da instância Vitras)
3. Clicar em **Actions** → **Take snapshot**
4. No campo **Snapshot name**, usar exatamente:
   ```
   vitras-staging-pre-sprint5-YYYYMMDD
   ```
   Substituindo `YYYYMMDD` pela data atual no formato `20260528` (exemplo para 28 mai 2026)
5. Clicar em **Take snapshot**
6. Aguardar o status mudar de `creating` para `available` (geralmente 2–10 minutos dependendo do tamanho do banco)
7. Abrir o snapshot criado → copiar o **ARN completo** (formato: `arn:aws:rds:REGION:ACCOUNT:snapshot:vitras-staging-pre-sprint5-YYYYMMDD`)
8. Preencher o campo **ARN** no template abaixo

---

## Verificação via AWS CLI (Opcional)

Para confirmar que o snapshot existe e está disponível antes de preencher o registro:

```bash
aws rds describe-db-snapshots \
  --snapshot-type manual \
  --query "DBSnapshots[?contains(DBSnapshotIdentifier, 'pre-sprint5')].[DBSnapshotIdentifier,Status,SnapshotCreateTime,AllocatedStorage]" \
  --output table
```

O status deve ser `available` antes de autorizar qualquer migration de Sprint 5.

---

## Template de Registro

Preencher os campos abaixo após criar o snapshot:

```
snapshot-id:   vitras-staging-pre-sprint5-YYYYMMDD
snapshot-arn:  [ PREENCHER — ARN completo copiado do console AWS ]
environment:   [ staging | production ]
rds-instance:  [ nome da instância RDS — ex: vitras-rds-staging ]
region:        [ ex: us-east-1 ]
created-at:    [ YYYY-MM-DDTHH:MM:SSZ — timestamp exato do console ]
size-gb:       [ tamanho alocado em GB ]
retention:     [ número de dias de retenção configurado — padrão manual = indefinido até deletar ]
status:        available
verified-by:   [ nome de quem verificou — ex: joaoomenegucci@gmail.com ]
verified-at:   [ YYYY-MM-DDTHH:MM:SSZ ]
notes:         Snapshot pré-Sprint 5 Vitras. Migrations 001-011 aplicadas. Smoke 22/22 PASS no commit d91c9cd.
```

---

## Critério de Aceite para QA

Este arquivo deve estar preenchido com um ARN real e status `available` antes de qualquer PR de Sprint 5
ser merged para `release/pilot-baseline`. A QA deve verificar:

- [ ] Campo `snapshot-arn` preenchido com ARN real (não placeholder)
- [ ] Campo `status` = `available`
- [ ] Campo `verified-by` preenchido com nome/email real
- [ ] Campo `verified-at` preenchido com timestamp real
- [ ] Snapshot confirmado no console AWS ou via CLI antes da verificação

---

## Referência de Rollback

Se qualquer migration de Sprint 5 causar corrupção de dados:

1. No AWS Console → RDS → Snapshots
2. Selecionar este snapshot → Actions → **Restore snapshot**
3. Confirmar o identificador: `vitras-staging-pre-sprint5-YYYYMMDD`
4. Restaurar para nova instância ou substituir a existente conforme o runbook em `docs/disaster-recovery.md`

---

**Arquivo criado em:** 2026-05-28
**Criado por:** Tech Lead AI — pré-execução Sprint 5

---

snapshot-arn: arn:aws:rds:sa-east-1:494003775820:snapshot:vitras-staging-pre-sprint5-20260528
environment: staging
rds-instance: vitras-staging-pre-sprint5-20260528
region: sa-east-1
created-at: <timestamp do console>
size-gb: 20 GiB
verified-by: joaoomenegucci@gmail.com
verified-at: 2026-05-28T18:44:34.1039330-03:00
status: available



