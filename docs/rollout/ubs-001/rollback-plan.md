# Plano de Rollback — UBS #1

## Quando fazer rollback

### Rollback imediato (sem discussão)

- /readyz não retorna 200 em 15 minutos após deploy
- Cross-tenant data leak detectado
- CPF/CNS exposto em resposta API
- Audit chain integrity failure
- Perda de dados confirmada

### Rollback após avaliação (Tech Lead decide)

- 5xx rate >10% por >10 minutos
- Login completamente impossível para qualquer usuário
- Degraded mode causado por problema de banco

### Não fazer rollback (trabalhar no hotfix)

- Erro em funcionalidade não-crítica específica
- Problema de UX/UI sem impacto clínico
- Alarme de monitoramento sem impacto de usuário confirmado

## Procedimento de rollback Render

### Opção 1: Rollback pelo Render Dashboard (preferido)

1. Render Dashboard → `vitras-backend` → Deploys
2. Localizar último deploy estável (verde)
3. Clicar em "Rollback to this deploy"
4. Aguardar deploy completar (~2-3 min)
5. Confirmar `GET /readyz` retorna 200

### Opção 2: Redeploy de commit anterior

```bash
# Identificar SHA do último deploy estável no Render Deploys
git push origin <sha-estavel>:main --force-with-lease
# Render auto-deploya quando render.yaml aponta para main
```

### Opção 3: Restore from backup (se dados corrompidos)

Ver docs/runbooks/backup-restore-runbook.md (ou docs/operations/RUNBOOK_BACKUP_RESTORE.md)

## Rollback de dados (pior caso)

Se dados foram inseridos após deploy problemático e rollback de aplicação não é suficiente:

1. Tech Lead documenta escopo dos dados afetados
2. Decisão: perder dados recentes vs operar com sistema problemático
3. Se restore: executar backup-restore-runbook.md com backup de antes do deploy
4. Notificar UBS coordinator sobre dados perdidos
5. Oferecer re-entrada manual dos registros afetados

## Comunicação de rollback

**Para UBS coordinator:**

> "Identificamos um problema técnico que requer retorno à versão anterior. O processo levará aproximadamente [15-30 min]. Os dados inseridos após [hora do deploy] podem precisar ser re-registrados. Entraremos em contato assim que o sistema estiver estável."

## Pós-rollback

1. Escrever incident report (P0 ou P1) — ver docs/operations/incident-response.md
2. Root cause analysis
3. Fix em dev branch
4. QA re-audit
5. Reagendar nova janela de deploy
6. Condição: não tentar novo deploy antes de compreender a causa raiz
