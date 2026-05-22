// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Runbook de incidentes

## Onde olhar primeiro

- AWS Elastic Beanstalk: status do ambiente, eventos e deploy recente
- CloudWatch: logs da aplicação Node.js
- `/health`: estado geral
- `/readyz`: prontidão operacional
- AWS Aurora/RDS: conectividade, CPU, storage, conexões e eventos
- Cloudflare: WAF, DNS, proxy e erros de borda

## Como investigar falhas

1. Confirmar sintoma e horário exato.
2. Validar `/health` e `/readyz`.
3. Correlacionar `X-Request-Id` ou `X-Correlation-Id` recebido pelo cliente.
4. Buscar logs por `requestId`, `correlationId`, rota e status.
5. Confirmar se houve deploy recente.
6. Verificar saúde do banco e conexões.
7. Se necessário, acionar rollback de app antes de agir sobre dados.

## Sintomas comuns

| Sintoma | Causa provável | Ação inicial |
|---|---|---|
| `/readyz` 503 | app em shutdown, banco indisponível ou startup incompleto | checar logs de startup e banco |
| login 401 geral | segredo JWT divergente, cookies inválidos ou relógio | revisar `JWT_SECRET`, domínio e expiração |
| erro 500 intermitente | pool, payload inválido, rota grande com estado inconsistente | rastrear `requestId` e última mudança |
| CORS no frontend | `FRONTEND_ORIGINS` errado | validar origem publicada sem barra final |
| lentidão global | gargalo no banco ou carga | checar CloudWatch, RDS e tamanho de payload |

## Recuperação básica

1. Se problema veio de deploy, voltar versão estável.
2. Se problema veio de banco, estabilizar conectividade antes de reabrir tráfego.
3. Se problema veio de configuração, corrigir env e reiniciar ambiente.
4. Se problema veio de dado inconsistente, isolar impacto e registrar evidência antes de corrigir.

## Evidências mínimas

- horário do incidente
- request id/correlation id
- rota afetada
- usuário ou perfil impactado
- ambiente
- versão/deploy ativo
- ação de mitigação aplicada
