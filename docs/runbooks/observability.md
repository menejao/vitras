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

## Variáveis de ambiente — referência rápida

| Variável | Obrigatória em prod | Notas |
|---|---|---|
| `DATABASE_URL` | Sim | PostgreSQL via RDS |
| `JWT_SECRET` | Sim | Mínimo 32 caracteres |
| `DATA_ENCRYPTION_KEY` | Sim | Mínimo 32 caracteres; chave AES-256 para CPF/CNS |
| `PATIENT_LOOKUP_HASH_KEY` | Sim | **Chave separada** de `DATA_ENCRYPTION_KEY`; mínimo 32 caracteres; usada para HMAC-SHA256 dos campos CPF/CNS (unicidade no Postgres). Sem fallback silencioso em produção. |
| `BACKUP_EXPORT_KEY` | Sim | |
| `ADMIN_SEED_KEY` | Sim | |
| `UPSTASH_REDIS_REST_URL` | Recomendado | Rate limiting distribuído; MemoryStore local em ausência (fail-open em multi-instância) |
| `UPSTASH_REDIS_REST_TOKEN` | Recomendado | |
| `FRONTEND_ORIGINS` | Sim | CORS allowlist |

## WAF e proteção de borda

Para implantação multi-UBS em produção:

### Recomendado (pré-produção)
- AWS WAF com managed rule groups (Core Rule Set, Known Bad Inputs)
- Rate limiting no ALB: 2000 req/5min por IP
- Bloquear requisições sem `Origin` header correto (clientes somente-browser)

### Cadeia de proxy confiável
Defina `TRUSTED_PROXY_COUNT=1` (ou `2` se atrás de ALB + CloudFront) nas variáveis do EB.
O `express-rate-limit` usa `req.ip` que respeita `X-Forwarded-For` quando `app.set("trust proxy", N)` está configurado.
Verifique se `app.js` tem `app.set("trust proxy", ...)` configurado.

### Procedimento de rotação de PATIENT_LOOKUP_HASH_KEY
1. Gerar nova chave: `openssl rand -hex 32`
2. Definir `PATIENT_LOOKUP_HASH_KEY_NEW=<nova>` e `PATIENT_LOOKUP_HASH_KEY=<antiga>` temporariamente
3. Executar migration de re-hash (futura: `008_rehash_patient_lookup`)
4. Remover chave antiga após confirmar que todos os valores `cpf_hash`/`cns_hash` foram atualizados
5. Verificar unicidade dos hashes em `app_patients` antes de remover a chave antiga
