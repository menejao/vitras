// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Runbook de observabilidade e incidente

## Healthcheck esperado

Endpoint:

- `GET /health`

Resultado esperado:

- HTTP `200`
- payload simples indicando serviço ativo
- sem autenticação

## Logs importantes

- build e publicação do frontend no Amplify;
- eventos de deploy e aplicação no Elastic Beanstalk;
- logs da aplicação Node.js no CloudWatch;
- métricas e eventos do banco Aurora/RDS;
- eventos de WAF, DNS e borda no Cloudflare.

## Pontos críticos de falha

- `DATABASE_URL` inválida ou sem acesso de rede;
- `JWT_SECRET` divergente entre ambientes;
- `FRONTEND_ORIGINS` incompatível com domínio publicado;
- falta de memória ou crash do processo Node.js;
- falha de build no frontend por dependência ou variável ausente.

## Troubleshooting básico

1. Validar `GET /health`.
2. Checar último deploy no Amplify e no Elastic Beanstalk.
3. Revisar logs de aplicação no CloudWatch.
4. Confirmar conectividade com banco e credenciais.
5. Confirmar CORS e URL pública do frontend.
6. Validar Cloudflare DNS, proxy e regras WAF.

## Checklist de incidente

- incidente reproduzido e horário registrado;
- ambiente afetado identificado;
- deploy recente confirmado ou descartado;
- healthcheck validado;
- logs principais coletados;
- impacto em autenticação, agenda, pacientes e prontuário avaliado;
- rollback considerado quando necessário;
- comunicação operacional registrada;
- causa raiz e ação corretiva documentadas.
