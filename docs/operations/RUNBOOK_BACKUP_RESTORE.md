# RUNBOOK: BACKUP E RESTORE — SaudeUbs/SIGUS

Data de referência: 2026-05-14

---

## 1. ESTRATÉGIA DE BACKUP

### Camadas de proteção

| Camada | Mecanismo | Frequência | Retenção |
|--------|-----------|------------|----------|
| **PITR Neon** | Point-in-Time Recovery nativo | Contínuo | 7 dias (plano Launch) / 30 dias (Scale) |
| **Snapshot GitHub** | Branch `snapshot/auto-*` | 2x/dia (00h e 12h BRT) | Últimos 30 snapshots |
| **Backup JSON** | `GET /admin/backup/export` via GitHub Actions | 1x/dia (02h30 BRT) | 30 dias (artifact do Actions) |
| **Backup manual** | Comando `curl` manual | Sob demanda | Responsabilidade do operador |

### Onde ficam os dados
- **Banco primário:** Neon PostgreSQL — estado principal em `app_state.data JSONB` com shadow tables relacionais para usuários, sessões, auditoria, pacientes, agenda e permissões
- **Dados criptografados:** CPF, CNS, `twoFactorSecret`, `twoFactorPendingSecret` são cifrados em AES-256-GCM antes de persistir
- **Chave de criptografia:** `DATA_ENCRYPTION_KEY` — **nunca no backup em texto claro**

---

## 2. EXPORTAR BACKUP MANUALMENTE

```bash
# Definir variáveis (nunca hardcodar em scripts versionados)
API_URL="https://api.seudominio.com.br"
BACKUP_KEY="$BACKUP_EXPORT_KEY"  # da variável de ambiente

# Exportar
curl -s -H "x-backup-key: ${BACKUP_KEY}" \
  "${API_URL}/admin/backup/export" \
  -o "backup-saudeubs-$(date +%Y-%m-%d-%H%M).json"

# Validar
cat "backup-saudeubs-*.json" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('generatedAt:', d.generatedAt);
  console.log('driver:', d.driver);
  console.log('OK — arquivo válido');
"
```

> O backup retorna o snapshot JSONB criptografado. Para restaurar, é necessário o `DATA_ENCRYPTION_KEY` correto do ambiente de origem.

---

## 3. RESTAURAR BACKUP EM STAGING

### Pré-requisitos
- `STAGING_DATABASE_URL` configurado (banco Neon separado de produção)
- `DATA_ENCRYPTION_KEY` do ambiente de origem disponível
- Node.js 22+ instalado localmente
- Arquivo de backup JSON disponível

### Script de restore

```bash
# scripts/restore-backup.js — veja o arquivo em scripts/
node scripts/restore-backup.js \
  --file backup-saudeubs-2026-05-14.json \
  --env staging \
  --confirm
```

> O script pede confirmação interativa antes de sobrescrever dados. **Nunca aceita `--env production` sem flag `--force`.**

### Procedimento passo a passo

1. **Escolher ponto de restore:**
   ```bash
   ls -la backups/  # backups locais
   # ou verificar GitHub Actions artifacts
   ```

2. **Testar em staging primeiro:**
   ```bash
   DATABASE_URL="$STAGING_DATABASE_URL" \
   DATA_ENCRYPTION_KEY="$DATA_ENCRYPTION_KEY" \
   node scripts/restore-backup.js --file backup.json --env staging --confirm
   ```

3. **Verificar integridade pós-restore:**
   ```bash
   # Subir backend apontando para staging
   DATABASE_URL="$STAGING_DATABASE_URL" npm start &

   # Testar health
   curl http://localhost:3001/health

   # Testar login com conta conhecida
   curl -X POST http://localhost:3001/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"gestor@staging.test","password":"..."}'
   ```

4. **Se staging OK → aplicar em produção:**
   - Via Neon PITR (preferível para reverter a ponto anterior)
   - Ou via restore JSON (substitui estado completo do banco)

---

## 4. RESTORE VIA NEON PITR (preferido)

O PITR é mais seguro pois preserva o estado nativo do banco, incluindo chaves de criptografia compatíveis.

### Procedimento
1. Neon Dashboard → Projeto → Branches → `main`
2. Clique em **"Restore"** (ou "Reset to point in time")
3. Selecionar data/hora do ponto desejado
4. Neon cria nova branch com dados restaurados (ex: `restore-2026-05-14`)
5. Testar aplicação apontando `DATABASE_URL` para a branch de restore
6. Se OK: **promover a branch de restore para `main`** ou atualizar `DATABASE_URL`

> Neon retém 7 dias de PITR no plano Launch, 30 dias no Scale. Para produção crítica, recomenda-se plano Scale.

---

## 5. RESTORE DIRETO EM PRODUÇÃO (emergência)

> Só fazer se staging não for possível e houver perda de dados confirmada.

Checklist obrigatório antes de restaurar em produção:
- [ ] Identificar exatamente o ponto de restore desejado (timestamp)
- [ ] Confirmar que nenhum dado pós-restore será perdido de forma irreversível
- [ ] Avisar usuários ativos sobre janela de manutenção
- [ ] Fazer backup do estado atual ANTES de restaurar
- [ ] Dois responsáveis presentes (quatro olhos)
- [ ] Documentar: quem, quando, por quê, qual ponto de restore

```bash
# EMERGÊNCIA: exportar estado atual antes de restaurar
curl -H "x-backup-key: ${BACKUP_EXPORT_KEY}" \
  "https://api.seudominio.com.br/admin/backup/export" \
  -o "pre-restore-$(date +%Y%m%d-%H%M).json"
```

---

## 6. TESTE MENSAL DE RESTORE

Agendar todo dia 1 do mês:

```
TODO MENSAL (dia 1):
1. Baixar backup mais recente do GitHub Actions
2. Restaurar em banco de staging (Neon branch separada)
3. Iniciar backend com DATABASE_URL do staging
4. Executar smoke tests: node scripts/smoke-production.js --base http://localhost:3001
5. Verificar: login, paciente, registro clínico, audit log
6. Documentar resultado: data, backup usado, resultado, quem executou
7. Destruir branch de staging do restore
```

Registrar resultado em planilha ou doc interno de auditoria operacional.

---

## 7. NEON — BACKUP AUTOMÁTICO

Neon faz backup contínuo via WAL (Write-Ahead Logging). Para verificar:

1. Neon Dashboard → Projeto → Backups
2. Confirmar que PITR está ativo para a branch `main`
3. Verificar data do último backup automático

Alertas recomendados (configurar em Neon ou monitor externo):
- Storage > 80% da cota do plano
- Falha no backup (verificar via Neon status page)
