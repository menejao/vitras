# Operações de Segurança — VITRAS

> **Revisão:** Sprint 4 — Maio 2026

---

## 1. Rotação de Chaves

### 1.1 Visão Geral

Referencie `docs/runbooks/key-rotation.md` para o procedimento completo. Este documento adiciona contexto de PATIENT_LOOKUP_HASH_KEY.

### 1.2 Chaves Gerenciadas

| Chave | Propósito | Rotação Recomendada |
|-------|-----------|---------------------|
| `JWT_SECRET` | Assina tokens JWT de acesso e refresh | Anual ou após comprometimento |
| `DATA_ENCRYPTION_KEY` | AES-256-GCM para CPF/CNS em repouso | Anual ou após comprometimento |
| `PATIENT_LOOKUP_HASH_KEY` | HMAC-SHA256 para índices únicos cpf_hash/cns_hash | Anual — **requer rebuild de hashes** |
| `BACKUP_EXPORT_KEY` | Autentica exportação de backup | Anual |
| `ADMIN_SEED_KEY` | Autentica seed de dados demo | Anual |

### 1.3 Rotação de PATIENT_LOOKUP_HASH_KEY

Esta chave é **independente** de `DATA_ENCRYPTION_KEY`. Rotação requer:

1. Criar nova chave (mínimo 32 caracteres, alta entropia)
2. Atualizar `PATIENT_LOOKUP_HASH_KEY` no EB Environment
3. Deploy com `RUN_MIGRATIONS=false` (não há migration para rotação de chave)
4. Executar `POST /admin/rebuild-patient-hashes` com header `x-backup-key`
5. Verificar que índices únicos ainda funcionam (tentar cadastrar CPF duplicado)
6. Ver `docs/runbooks/key-rotation.md` para procedimento completo

**Risco se não rebuilt:** Índices únicos cpf_hash/cns_hash ficam inválidos — duplicatas CPF podem ser inseridas.

---

## 2. Processo Break-Glass

### 2.1 Quem Pode Invocar

- Role `break_glass_admin` (geralmente Tech Lead ou responsável de plantão)
- Requer justificativa documentada

### 2.2 Auditoria Obrigatória

Todo uso de break-glass gera audit log automaticamente:
- `auth.break_glass_activated` — ativação
- Todas as ações subsequentes durante a sessão incluem `breakGlass.active = true`
- Sessão expira em `BREAK_GLASS_TTL_MS` (padrão: 15 minutos)

### 2.3 Revisão Pós-Uso

Após cada uso de break-glass:
- [ ] Revisar audit logs do período: `GET /audit-logs?action=break_glass`
- [ ] Documentar justificativa e ações tomadas
- [ ] Confirmar que sessão expirou
- [ ] Se dados clínicos acessados: notificar DPO se paciente não deu consentimento

### 2.4 Relatório de Controle

`security_auditor` deve revisar mensalmente:
```
GET /audit-logs/reports/cross-team-access
Authorization: Bearer $SECURITY_AUDITOR_TOKEN
```

---

## 3. Política de Segredos

### 3.1 Onde Armazenar

| Tipo de Segredo | Onde | Rotação |
|-----------------|------|---------|
| JWT_SECRET, DATA_ENCRYPTION_KEY | EB Environment Variables (criptografado) | Anual |
| DATABASE_URL | EB Environment Variables | Por mudança de credencial |
| Segredos de produção críticos | AWS Secrets Manager (recomendado futuro) | Por políticas IAM |
| Segredos de CI/CD | GitHub Secrets / AWS CodePipeline | Anual |

### 3.2 O Que NÃO Fazer

- Nunca commitar segredos em `.env` ou código
- Nunca logar chaves ou tokens (o logger tem `SENSITIVE_KEY_PATTERN` que redaciona automaticamente)
- Nunca usar chaves de dev em produção

### 3.3 Audit de Segredos

O `validateProductionConfig()` bloqueia boot se segredos obrigatórios estão ausentes. Executado a cada inicialização.

---

## 4. Configuração de Proxy Confiável

### 4.1 Configuração Atual

```javascript
app.set("trust proxy", 1); // Confia no primeiro proxy (EB/ALB)
```

### 4.2 Risco de IP Spoofing

Com `trust proxy = 1`, o IP do cliente é extraído de `X-Forwarded-For`. Se a aplicação ficar exposta diretamente sem proxy, um cliente malicioso pode forjar o IP.

**Mitigação:** Em produção, o EB usa um ALB ou nginx que reescreve `X-Forwarded-For`. Verificar que `app.set("trust proxy", 1)` é correto para a topologia atual.

**Configuração alternativa mais segura:**
```javascript
// Se o IP do ALB for fixo, use:
app.set("trust proxy", "loopback, 10.0.0.0/8"); // Apenas IPs da VPC
```

---

## 5. Headers de Segurança (Helmet)

### 5.1 Headers Ativos

| Header | Valor | Fonte |
|--------|-------|-------|
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'; report-uri /csp-report` | helmet + `setupHelmet()` |
| `X-Content-Type-Options` | `nosniff` | `securityHeadersMiddleware` |
| `X-Frame-Options` | `DENY` | `securityHeadersMiddleware` |
| `Referrer-Policy` | `no-referrer` | `securityHeadersMiddleware` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | `securityHeadersMiddleware` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` (prod) | `securityHeadersMiddleware` |
| `X-Powered-By` | Removido | `app.disable("x-powered-by")` |

### 5.2 Violações CSP

Reportadas automaticamente em `POST /csp-report` → log `security.csp_violation`.

---

## 6. CORS

### 6.1 Política Atual

- `FRONTEND_ORIGINS` define origens permitidas (env var, vírgula-separado)
- Se não configurado em produção → boot falha com erro
- `CORS_ALLOW_ALL=true` disponível para desenvolvimento/staging (NÃO usar em prod)
- Cookies `credentials: true` habilitado — exige origem explícita

### 6.2 Gap Identificado

A CSP atual (`default-src 'none'`) bloqueia recursos do frontend se houver inline scripts/styles. Verificar com equipe frontend antes de produção regulada.

---

## 7. Hardening do Elastic Beanstalk

### 7.1 Checklist de Hardening

- [ ] **IMDSv2 obrigatório:** EC2 → Instance Metadata → `HttpTokens: required`
- [ ] **VPC privada:** Instâncias EB em subnet privada; apenas ALB público
- [ ] **Security Groups:**
  - ALB: porta 443 aberta para 0.0.0.0/0
  - EB instances: apenas ALB SG autorizado na porta 3001/8080
  - RDS: apenas EB instances SG autorizado na porta 5432
- [ ] **SSL termination no ALB:** certificado ACM; redirecionar HTTP → HTTPS
- [ ] **IAM Least Privilege:** Role da instância EB com apenas permissões necessárias (CloudWatch Logs, Secrets Manager se usado)
- [ ] **EB Managed Updates:** habilitar para atualizações automáticas de plataforma
- [ ] **Logging:** EB environment logs → CloudWatch Logs habilitado

### 7.2 Verificação de IMDSv2

```bash
# Verificar configuração da instância
aws ec2 describe-instances \
  --filters "Name=tag:elasticbeanstalk:environment-name,Values=vitras-prod" \
  --query 'Reservations[*].Instances[*].MetadataOptions'
```

---

## 8. Resposta a Incidentes — Outline

### 8.1 Detecção

- CloudWatch Alarmes (ver `docs/cloudwatch-dashboard.md`)
- Log `event = "startup.failed"` ou `migrations.failed_fatal`
- Usuário reporta erro 5xx ou timeout

### 8.2 Contenção

1. Verificar `/health` e `/readyz` — identificar subsystem com problema
2. Se breach: colocar instância em modo manutenção
3. Revogar tokens suspeitos via rotação de `JWT_SECRET` (ver key-rotation.md)
4. Bloquear IP suspeito no ALB se necessário

### 8.3 Investigação

1. `GET /audit-logs` — filtrar por período do incidente
2. `GET /audit-logs/reports/auth-failures?since=ISO`
3. `GET /audit-logs/integrity` — verificar chain
4. CloudWatch Insights — buscar padrões

### 8.4 Remediação

1. Aplicar fix ou rollback
2. Rotacionar chaves comprometidas
3. Rebuild de hashes se PATIENT_LOOKUP_HASH_KEY foi comprometida

### 8.5 Documentação

1. Post-mortem em 72 horas
2. Se dados de saúde afetados: notificar ANPD em até 72 horas (LGPD Art. 48)
3. Atualizar runbooks com lições aprendidas

---

## 9. Referências

- `docs/runbooks/key-rotation.md` — Rotação de chaves HMAC/encryption
- `docs/disaster-recovery.md` — RTO/RPO e recovery
- `docs/lgpd-cfm-considerations.md` — Obrigações LGPD/CFM
- `docs/cloudwatch-dashboard.md` — Alarmes e queries
