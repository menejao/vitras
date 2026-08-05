# Procedimento Técnico de Resposta a Incidentes LGPD — VITRAS

**Versão:** 1.0  
**Gerado em:** 2026-08-05  
**Sprint:** VITRAS-LGPD-BASELINE-01  
**Status:** ATIVO

---

## Escopo

Este procedimento cobre incidentes técnicos que possam envolver tratamento indevido de dados pessoais ou dados pessoais sensíveis no sistema VITRAS, conforme exigências da LGPD (Lei 13.709/2018) e da ANPD.

---

## Cenários Cobertos

| # | Cenário | Criticidade |
|---|---------|-------------|
| INC-01 | Vazamento de dados de pacientes | CRÍTICO |
| INC-02 | Acesso indevido por usuário autenticado | CRÍTICO |
| INC-03 | Exportação incorreta ou cross-UBS | CRÍTICO |
| INC-04 | Quebra de isolamento entre UBS (multi-tenant) | CRÍTICO |
| INC-05 | Perda ou corrupção de backup | ALTO |
| INC-06 | Break glass sem justificativa ou abusivo | ALTO |
| INC-07 | Falha na cadeia de auditoria (hash inválido) | ALTO |

---

## INC-01 — Vazamento de Dados de Pacientes

### Detecção
- Alerta: aumento anormal de `GET /patients` ou `GET /export/cds/*` por um único usuário
- Log: `http.request.completed` com `status:200` para endpoints clínicos em horários atípicos
- Audit log: ação `cds.export.*` com volume elevado

### Contenção imediata (< 1h)
1. Revogar token do usuário suspeito via `/platform/users/:id` (support_admin)
2. Ativar `READ_ONLY_MODE=true` no Render se necessário (bloqueia escrita, mantém leitura)
3. Identificar `requestId` e `userId` nos logs de `http.request.completed`

### Investigação
```bash
# Filtrar logs Render por userId e endpoint
# Render Logs → buscar: userId:"<id>" path:"/export"

# Verificar audit trail via API
GET /audit-logs?userId=<id>&action=cds.export&limit=500
```

### Recuperação
1. Verificar integridade da trilha de auditoria: `GET /admin/audit/integrity` (requer capability)
2. Notificar gestor da UBS afetada via `activeUnitId` registrado nos logs
3. Se exposição confirmada: notificar ANPD em até 72h (Art. 48 LGPD)

---

## INC-02 — Acesso Indevido por Usuário Autenticado

### Detecção
- Log `security.auth.token_invalid` ou `security.authz.support_admin_clinical_blocked`
- Padrão de acesso a patientIds fora da equipe do usuário
- Audit log: `BREAK_GLASS_PATIENT_SCOPE_BYPASS` inesperado

### Contenção imediata
1. Desativar usuário suspeito: `PATCH /platform/users/:id` com `{ inactive: true }`
2. Revogar todos refresh tokens do usuário (desativação já revoga via platform.js)

### Investigação
```
GET /audit-logs?userId=<id>&limit=500
# Verificar actions: patient.read, exam.created, referral.created para cada patientId
# Confirmar teamId do paciente vs teamId do ator
```

### Recuperação
1. Verificar se dados foram exportados (ação `cds.export.*`)
2. Documentar escopo de dados acessados
3. Notificar DPO / gestor

---

## INC-03 — Exportação Incorreta ou Cross-UBS

### Detecção
- Audit log: `cds.export.*` com `activeUnitId` diferente do `patient.unitId`
- Smoke test: `/export/cds/individual/:id` de outra UBS retorna dados (deveria retornar 404)

### Contenção imediata
1. Verificar se `resolveActiveUnit(req)` está funcionando corretamente
2. Se bug encontrado: ativar `READ_ONLY_MODE=true` temporariamente
3. Corrigir e fazer redeploy

### Investigação
```bash
# Verificar audit logs de exports
GET /audit-logs?action=cds.export&limit=500
# Para cada export, confirmar activeUnitId == patient.unitId
```

### Verificação de integridade pós-incidente
- Confirmar todos os exports têm `activeUnitId` registrado
- Confirmar nenhum export retornou paciente de outra UBS

---

## INC-04 — Quebra de Isolamento Multi-UBS

### Detecção
- Um usuário vê pacientes de outra UBS na lista `GET /patients`
- `canAccessTeamScope` ou `resolveActiveUnit` retornando valor incorreto

### Contenção imediata
1. Ativar `READ_ONLY_MODE=true`
2. Identificar `unitId` e `teamId` no JWT do usuário afetado (decode do token)
3. Confirmar `req.user.unitId` via logs de `http.request.completed`

### Investigação
- Verificar se `resolveActiveUnit(req)` usa `req.user?.unitId` e nunca aceita `req.body.unitId`
- Verificar `canAccessTeamScope(user, teamId)` — deve usar `user.teamId` do JWT

### Recuperação
1. Corrigir código se bug encontrado
2. Revogar sessões ativas: revogar refresh tokens por `unitId` via console

---

## INC-05 — Perda ou Corrupção de Backup

### Detecção
- `GET /readyz` retorna `postgres_unreachable`
- Neon dashboard: réplica indisponível ou PITR falhou

### Contenção imediata
1. Verificar status Neon em `status.neon.tech`
2. Ativar `READ_ONLY_MODE=true` para evitar writes durante instabilidade

### Recuperação (via Neon dashboard)
1. Acessar Neon → Branch → Restore to point in time
2. Verificar integridade da tabela `app_state` após restore
3. Verificar integridade da tabela `audit_logs` após restore
4. Executar `GET /admin/audit/integrity` para verificar hash chain

---

## INC-06 — Break Glass Abusivo

### Detecção
- Audit log: `auth.break_glass_activated` com reason vazio ou genérico
- Break glass ativado em horário atípico
- Múltiplas ativações pelo mesmo usuário

### Contenção
1. Revogar sessão do usuário: `PATCH /platform/users/:id` → `{ inactive: true }`
2. Registrar incidente com `userId`, `reason`, `activatedAt`, `expiresAt` da trilha de audit

### Investigação
```
GET /audit-logs?action=auth.break_glass_activated&limit=100
# Para cada entrada: verificar reason, requestId, ip, userAgent
```

---

## INC-07 — Falha na Cadeia de Auditoria

### Detecção
- `GET /admin/audit/integrity` retorna `status: "broken"` ou `status: "orphaned"`
- Hash de alguma entrada não bate com recálculo

### Contenção
- **NÃO modificar** os logs de auditoria
- Isolar snapshot para análise forense

### Investigação
1. Verificar `auditLogChainAnchors` — se há registro de eviction legítima que explica o gap
2. Comparar `hashVersion` das entradas: v2 (atual) vs legado
3. Verificar se hash divergência é `legacy_incompatible` (JSONB reorder, não tamper)

### Classificação
| Status | Significado |
|--------|-------------|
| `legacy_incompatible` | Não é evidência de tamper; serialização não reproduzível |
| `orphaned` | Gap sem anchor — investigar possível deleção |
| `broken` | Hash inválido — evidência de modificação indevida |

---

## Matriz de Escalação

| Criticidade | Tempo de Contenção | Notificação |
|-------------|-------------------|-------------|
| CRÍTICO | < 1h | DPO + Gestor UBS + suporte VITRAS |
| ALTO | < 4h | Gestor UBS + suporte VITRAS |
| MÉDIO | < 24h | Suporte VITRAS |

---

## Ferramentas de Investigação

```bash
# Audit logs por userId
GET /audit-logs?userId=<id>&limit=500

# Audit logs por ação
GET /audit-logs?action=cds.export&limit=500

# Verificar integridade da cadeia
GET /admin/audit/integrity    # requer capability: audit.read

# Health / readiness
GET /health
GET /readyz

# Métricas de erros (dev apenas)
GET /metrics/internal
```

---

## Contato

- **Suporte técnico VITRAS:** contato@vitras.com.br  
- **DPO municipal:** a ser definido por cada prefeitura  
- **ANPD:** https://www.gov.br/anpd  
- **Prazo de notificação ANPD:** 72 horas após confirmação de incidente com risco (Art. 48 LGPD)
