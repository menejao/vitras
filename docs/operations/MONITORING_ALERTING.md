# MONITORAMENTO E ALERTAS — SaudeUbs/SIGUS

Data de referência: 2026-05-14

---

## 1. CAMADAS DE MONITORAMENTO

| Camada | Ferramenta | O que monitora |
|--------|-----------|----------------|
| Uptime externo | UptimeRobot / BetterStack | `/health` a cada 1-5 min, alerta por e-mail/SMS/WhatsApp |
| Logs de aplicação | Render Logs | Erros, latência, requisições |
| Logs de banco | Neon Dashboard | Queries lentas, conexões, storage |
| Audit trail | Banco (auditLogs) | Ações de usuários — acesso interno via `/audit-logs` |
| Backup | GitHub Actions | Status do job nightly de backup |

---

## 2. UPTIME MONITORING (externo)

### Configurar UptimeRobot (gratuito, suficiente para início)

1. Criar conta em uptimerobot.com
2. **New Monitor**:
   - Type: HTTP(s)
   - URL: `https://api.saudeubs.com.br/health`
   - Interval: 5 minutos
   - Alert contacts: e-mail + WhatsApp (via integração ou webhook)
3. Resposta esperada: HTTP 200, body contém `"ok":true`
4. Criar também monitor para frontend: `https://app.saudeubs.com.br`

### Configurar BetterStack (alternativa, mais recursos)

1. betterstack.com → Uptime → New Monitor
2. URL: `https://api.saudeubs.com.br/health`
3. Interval: 1 minuto (plano gratuito suporta)
4. On-call schedule: definir responsável de plantão

### O que alertar

| Condição | Alerta | Canal |
|----------|--------|-------|
| HTTP ≠ 200 por > 2 min | CRÍTICO | E-mail + SMS |
| Latência > 5s | AVISO | E-mail |
| SSL expirando em < 14 dias | AVISO | E-mail |
| Frontend inacessível | CRÍTICO | E-mail |

---

## 3. LOGS NO RENDER

### Acessar
Render Dashboard → saude-backend → **Logs**

### Filtros úteis

```
[error         → erros de aplicação (inclui requestId para correlação)
[req:          → log de cada requisição HTTP
CORS           → problemas de origem
TOKEN          → problemas de autenticação
DB             → erros de banco
startup        → problemas de inicialização
```

### Estrutura do log de requisição
```
[req:UUID] POST /auth/login 200 42ms
[req:UUID] GET /patients 401 5ms
[error:UUID] AuthError: Token expirado
```

### Retenção
- Render Free/Starter: 7 dias
- Para retenção maior: exportar para Logtail, Papertrail ou Datadog

### Exportar logs para storage externo (opcional)

Render Dashboard → saude-backend → Log Streams → Add Log Stream:
- Logtail (betterstack.com/logs): nível gratuito suficiente para início
- Configura via endpoint HTTP

---

## 4. MONITORAMENTO DO BANCO (NEON)

### Neon Dashboard → Projeto → Monitoring

Verificar regularmente:
- **Connections:** número de conexões ativas (plano Launch: limite ~100)
- **Storage:** não ultrapassar 80% da cota do plano
- **Compute time:** horas de compute utilizadas no mês

### Alertas recomendados

Neon não tem alertas nativos — usar via script ou UptimeRobot:

```bash
# Script manual de verificação de storage (executar mensalmente)
# Neon Dashboard → Project → Storage
# Se > 80% da cota: fazer limpeza ou upgrade de plano
```

### Queries lentas

Neon Dashboard → Monitoring → **Slow Queries**:
- Verificar se há queries sem índice
- Verificar se connection pool está funcionando

---

## 5. MONITORAMENTO DE BACKUP

### GitHub Actions — backup nightly

O job `backup-nightly` executa todo dia às 02:30 BRT. Para verificar:

1. GitHub → Repositório → Actions → Workflow `backup-nightly`
2. Último run deve ser verde (✓)
3. Artifact `backup-saudeubs-YYYY-MM-DD.json` deve estar disponível

### Alertar em falha

GitHub Actions → Configurações do workflow:
```yaml
# .github/workflows/backup-nightly.yml
# Adicionar notificação por e-mail em falha:
on:
  workflow_run:
    workflows: ["Backup Nightly"]
    types: [completed]
# (ver exemplo completo na seção 6)
```

Ou simplesmente verificar manualmente toda semana (Monday check).

---

## 6. DASHBOARDS RECOMENDADOS

### Dashboard mínimo de operações (verificação diária — < 5 min)

```
☐ UptimeRobot: backend e frontend green?
☐ Render: último deploy bem-sucedido?
☐ GitHub Actions: backup nightly do dia anterior green?
☐ Neon: storage < 80%?
```

### Dashboard de segurança (verificação semanal — < 15 min)

```
☐ Render Logs: algum [error] incomum?
☐ Audit logs: alguma ação suspeita? (via GET /audit-logs como gestor)
☐ Logins falhos repetidos do mesmo IP?
☐ Usuários com sessão ativa suspeita?
```

---

## 7. RUNBOOK DE ALERTAS

### Alerta: backend down (HTTP ≠ 200)

```
1. Verificar Render Dashboard → Deploys → algum deploy falhando?
2. Verificar Render Logs por erros de startup
3. Se cold start (Free plan): esperar até 30s e tentar novamente
4. Se não recuperar em 5 min: fazer redeploy manual
5. Se persiste: verificar DATABASE_URL e DATA_ENCRYPTION_KEY no Render
```

### Alerta: latência alta (> 5s)

```
1. Plano Free → cold start esperado após 15 min inativo
   Solução: migrar para plano Starter
2. Plano pago → verificar Neon connections e queries lentas
3. Verificar se UPSTASH_REDIS_REST_URL está configurado (rate limiting)
```

### Alerta: backup nightly falhou

```
1. GitHub Actions → Workflow run com falha → ver logs
2. Causas comuns:
   - BACKUP_EXPORT_KEY expirada ou incorreta no GitHub Secret
   - Backend offline no horário do job
   - Render cold start (> 30s timeout no curl)
3. Executar backup manual se necessário:
   curl -H "x-backup-key: $BACKUP_EXPORT_KEY" .../admin/backup/export -o backup-manual.json
```

---

## 8. SLA INTERNO SUGERIDO

| Tipo de incidente | Tempo de detecção | Tempo de resposta | Tempo de resolução |
|-------------------|-------------------|-------------------|-------------------|
| Backend completamente down | < 10 min (uptime monitor) | < 30 min | < 2h |
| Falha de autenticação em massa | < 1h (logs) | < 1h | < 4h |
| Dados inacessíveis (500 em leitura) | < 15 min | < 30 min | < 4h |
| Backup nightly falhou | < 24h (verificação manual) | < 24h | < 48h |
| Possível violação de dados | Imediato | < 1h | < 72h (notif. ANPD) |
