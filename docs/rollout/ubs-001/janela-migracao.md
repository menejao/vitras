# Janela de Migração — UBS #1

## Janela recomendada

- **Período:** Terça ou quarta-feira (menor movimento)
- **Horário:** 18:00–22:00 (fora do horário de atendimento)
- **Duração máxima:** 4 horas (incluindo rollback se necessário)
- **Janela de decisão rollback:** Até 60 minutos após início do deploy

## Pré-requisitos no dia

- [ ] Backup automático confirmado nas últimas 24h
- [ ] DR drill aprovado (feito na semana anterior)
- [ ] Canal de suporte aberto com prefeitura/UBS
- [ ] Tech Lead disponível presencialmente ou via videoconferência
- [ ] Staging smoke test reexecutado no mesmo dia

## Cronograma sugerido

| Hora | Atividade |
|------|-----------|
| T-2h | Confirmar backup, validar staging final |
| T-1h | Notificar UBS, fechar atendimentos pendentes |
| T-0 | Início do deploy EB |
| T+10min | /readyz 200, validar server_started log |
| T+20min | Smoke test produção mínimo |
| T+30min | GO/NO-GO decision point |
| T+60min | Primeiro login clínico assistido |
| T+4h | Encerramento janela, relatório D+0 iniciado |

## Rollback window

Se a qualquer momento até T+60min o deploy apresentar problemas → execute rollback imediato (ver rollback-plan.md).

Após T+60min com dados reais inseridos: avalia se rollback é seguro (pode implicar perda de dados desde T+0). Tech Lead decide com UBS Coordinator.

## Comunicação

- **Dia anterior:** notificar coordenador UBS
- **Dia do deploy:** notificar TI prefeitura
- **Em caso de atraso:** notificar UBS coordinator a cada 30 minutos

Ver plano-comunicacao.md para mensagens modelo.
