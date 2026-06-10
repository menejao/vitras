# Disaster Recovery Plan — VITRAS

> **Revisão:** Sprint 4 — Maio 2026
> **Escopo:** Produção primária em AWS Elastic Beanstalk + RDS PostgreSQL

---

## Resumo Executivo

Este documento define os objetivos de recuperação, procedimentos e responsabilidades para o sistema VITRAS em cenários de desastre. Na escala atual (piloto UBS), os objetivos são conservadores; caminhos para melhoria são documentados na seção de evolução.

---

## 1. Objetivos de Recuperação (RTO / RPO)

| Parâmetro | Alvo Atual (Piloto) | Caminho para Melhoria |
|-----------|--------------------|-----------------------|
| **RTO** (Recovery Time Objective) | **4 horas** — tempo máximo para restaurar serviço | **1 hora** com Read Replica pré-provisionada e failover automatizado (RDS Multi-AZ) |
| **RPO** (Recovery Point Objective) | **24 horas** — perda máxima de dados aceitável (backup diário) | **1 hora** com Point-In-Time Recovery (PITR) habilitado no RDS |

**Nota:** Para regulamentação CFM 1821/2007 (retenção 20 anos), o RPO de 24 horas é aceitável em fase piloto. Em produção regulada, recomenda-se PITR habilitado.

---

## 2. Backup RDS

### 2.1 Configuração Mínima
- **Retenção mínima:** 7 dias de backups automatizados
- **Retenção recomendada:** 30 dias (cobre auditoria mensal)
- **Janela de backup:** Configurar fora do horário de pico (ex.: 02:00–04:00 BRT)
- **Snapshots manuais:** Antes de cada deploy de migrations críticas

### 2.2 Criptografia
- **Em repouso:** AES-256 (padrão RDS — habilitado automaticamente quando `StorageEncrypted=true`)
- **Em trânsito:** TLS 1.2+ obrigatório (já configurado via `ssl: { rejectUnauthorized: false }` no pool — ver nota de risco residual em `db.js`)

### 2.3 Verificação de Saúde do Backup

**Via Console AWS:**
1. RDS → Instances → vitras-prod → "Maintenance & backups"
2. Verificar "Latest restore time" — deve ser < 1 hora atrás
3. Verificar "Automated backups" = Enabled

**Via AWS CLI:**
```bash
# Verificar status de backups automatizados
aws rds describe-db-instances \
  --db-instance-identifier vitras-prod \
  --query 'DBInstances[0].{BackupRetentionPeriod:BackupRetentionPeriod,LatestRestorableTime:LatestRestorableTime,BackupTarget:BackupTarget}'

# Listar snapshots manuais
aws rds describe-db-snapshots \
  --db-instance-identifier vitras-prod \
  --snapshot-type manual \
  --query 'DBSnapshots[*].{ID:DBSnapshotIdentifier,CreatedTime:SnapshotCreateTime,Status:Status}'

# Verificar se backups automáticos existem
aws rds describe-db-snapshots \
  --db-instance-identifier vitras-prod \
  --snapshot-type automated \
  --query 'DBSnapshots[0].{ID:DBSnapshotIdentifier,CreatedTime:SnapshotCreateTime}'
```

**Startup Health Check (automático):**
O servidor emite `backup.health_warning` no log de boot se `rds.automated_backups_enabled = off`. Monitorar em CloudWatch Logs.

---

## 3. Backup Modo Arquivo (File-Mode)

**Risco Atual:** O modo arquivo usa JSON local no filesystem do EB. Este arquivo **não é persistido entre deploys/restarts** sem configuração adicional.

**Medidas Necessárias:**
1. **S3 Sync periódico:** Script cron que sincroniza `/data/db.json` para um bucket S3 privado com versionamento habilitado
2. **EB Volume EFS:** Montar EFS para persistência entre deploys (recomendado se file-mode continuar em uso)
3. **Frequência mínima:** A cada 4 horas em ambientes de staging; a cada 1 hora se usado como fallback de produção

**Comando de sync manual:**
```bash
aws s3 cp /var/app/current/data/db.json s3://vitras-backup-bucket/file-mode/db-$(date +%Y%m%dT%H%M%S).json
```

> **ALERTA:** Modo arquivo não deve ser usado em produção regulada (validado por `validateProductionConfig()` que bloqueia boot sem `DATABASE_URL`).

---

## 4. Estratégia de Snapshots EB

- **Antes de deploy:** Criar snapshot manual do RDS via Console ou CLI
- **Após deploy bem-sucedido:** Etiquetar snapshot com versão do deploy
- **Retenção de snapshots manuais:** 90 dias mínimo para sprints de hardening; 1 ano para releases
- **EB Application Versions:** Manter últimas 5 versões no EB para rollback rápido

```bash
# Snapshot manual antes de deploy
aws rds create-db-snapshot \
  --db-instance-identifier vitras-prod \
  --db-snapshot-identifier vitras-prod-pre-deploy-$(date +%Y%m%d)
```

---

## 5. Checklist de Drill de Recuperação

Executar **trimestralmente** em ambiente de staging:

- [ ] Verificar que backups automatizados estão ativos (CLI/Console)
- [ ] Executar PITR em ambiente de staging (ver `backup-restore-runbook.md`)
- [ ] Validar que migrations rodam sem erros no banco restaurado
- [ ] Verificar índices únicos cpf_hash/cns_hash (`006_patient_hash_columns`)
- [ ] Testar `/readyz` retorna 200 após restore
- [ ] Testar login de usuário demo após restore
- [ ] Verificar integridade da chain de audit via `GET /audit-logs/integrity`
- [ ] Medir tempo total do drill — comparar com RTO alvo (4 horas)
- [ ] Atualizar `backup.restore_test_required.last_tested` no log de startup
- [ ] Documentar resultado em `docs/operations/recovery-drill-log.md`

---

## 6. Responsabilidades Operacionais

| Responsabilidade | Responsável | Frequência |
|------------------|-------------|------------|
| Verificar status de backup RDS | Gestor Técnico / DevOps | Semanal |
| Executar drill de recuperação | Engenheiro de Infraestrutura | Trimestral |
| Revisar este documento | Tech Lead | Semestral |
| Criar snapshot antes de deploy | Engenheiro de Deploy | Por deploy |
| Monitorar alertas CloudWatch (`backup.health_warning`) | On-call | Contínuo |
| Revisar retenção de snapshots | Gestor Técnico | Mensal |

---

## 7. Caminhos de Evolução (Sprint 5+)

1. **RDS Multi-AZ** → failover automático, RTO ~5min
2. **PITR habilitado** → RPO ~5min
3. **Read Replica** → failover manual em < 1 hora (RTO 1 hora)
4. **S3 Cross-Region Replication** para backups RDS → proteção contra falha de AZ
5. **Teste automatizado de restore** via pipeline CI
6. **Runbook automatizado** com AWS Systems Manager

---

## 8. Referências

- `docs/runbooks/backup-restore-runbook.md` — Procedimento passo-a-passo de restore
- `docs/runbooks/key-rotation.md` — Rotação de chaves HMAC/encryption
- `docs/security/security-operations.md` — Operações de segurança
- [AWS RDS Backup and Restore](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html)
