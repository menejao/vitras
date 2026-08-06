# VITRAS — Checklist Pós-Demo

> Executar imediatamente após cada apresentação.
> Objetivo: garantir que nenhuma sessão ativa, export ou dado sensível permaneça exposto.

---

## SESSÕES E ACESSO

| # | Item | Ação | Status |
|---|------|------|--------|
| 1 | Logout de todas as contas abertas | Clicar em Sair em cada aba | |
| 2 | Fechar abas do browser da apresentação | Fechar ou limpar histórico | |
| 3 | Revogar tokens de refresh ativos (se necessário) | Via Console ou seed de reset | |
| 4 | Confirmar que nenhuma aba permanece autenticada | Recarregar / testar sessão expirada | |

---

## DADOS E PRIVACIDADE

| # | Item | Ação | Status |
|---|------|------|--------|
| 5 | Nenhum export ou download gerado durante a demo | Verificar pasta de downloads | |
| 6 | Nenhum screenshot contém ID de paciente real | Revisar screenshots tirados | |
| 7 | Nenhuma credencial foi capturada em screenshot | Revisar capturas de tela | |
| 8 | Logs de apresentação não contêm dados clínicos | Confirmar que `/audit` não exibe PII | |

---

## AMBIENTE

| # | Item | Ação | Esperado | Status |
|---|------|------|----------|--------|
| 9 | Health ainda passa | `GET /health` | `ok: true` | |
| 10 | Readyz ainda passa | `GET /readyz` | `ready: true` | |
| 11 | Break Glass íntegro | Verificar que ID não foi alterado | ID preservado | |
| 12 | Support Admin íntegro | `app_users WHERE role='support_admin'` | 1 registro, inactive=false | |
| 13 | Nenhuma variável destrutiva ativa no Render | Verificar dashboard | `DEMO_RESET_ALLOWED` ausente ou false | |

---

## RESTAURAÇÃO (se necessário)

| # | Cenário | Ação |
|---|---------|------|
| 14 | Demo alterou dados (check-in, agenda, etc.) | Executar seed idempotente |
| 15 | Demo gerou audit logs excessivos | Não remover — fazem parte do ambiente demo |
| 16 | Senha de usuário demo foi alterada | Re-executar `seed-demo-parte3.mjs` |
| 17 | Dados misturados entre UBS | Reset completo + reseed |

```bash
# Restauração idempotente — preferencial
DEMO_SEED_ALLOWED=true node --env-file=.env scripts/seed-demo-santa-aurora-v2.mjs
DEMO_SEED_ALLOWED=true node --env-file=.env scripts/seed-demo-parte3.mjs
```

---

## INCIDENTES

| # | Item | Status |
|---|------|--------|
| 18 | Registrar qualquer falha técnica observada durante a demo | |
| 19 | Registrar perguntas da TI sem resposta imediata | |
| 20 | Registrar funcionalidade ausente solicitada | |
| 21 | Rotacionar senha demo se houve exposição de credencial | |
| 22 | Confirmar que dados sintéticos não foram confundidos com reais | |

---

## PRÓXIMOS PASSOS

- Incidentes registrados → criar issue no repositório
- Funcionalidades solicitadas → avaliar GOV-01 antes de qualquer sprint
- Próxima apresentação → re-executar checklist pré-demo
- Piloto real → aguardar gates jurídicos C-1/C-2/C-3

---

_Versão: v1.1.0-rc.1 | Atualizado: 2026-08-05_
