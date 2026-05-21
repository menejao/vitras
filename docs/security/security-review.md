// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Security Review do backend

## Resumo executivo

Backend já possui base boa de segurança: JWT com `issuer/audience`, cookies configuráveis, CORS explícito, Helmet, rate limiting, criptografia de campos sensíveis e 2FA. Risco principal hoje não é ausência total de controles. Risco principal é maturidade operacional incompleta, mistura entre código de produção e conveniências de desenvolvimento, e logging ainda pouco governado.

## Riscos atuais

| Prioridade | Risco | Impacto | Mitigação recomendada | Pode esperar? |
|---|---|---|---|---|
| Alta | `db.js` usa `ssl: { rejectUnauthorized: false }` | reduz garantia TLS com banco | migrar para CA confiável e `ssl: true` ou `rejectUnauthorized: true` em ambiente oficial | Não |
| Alta | rotinas dev específicas de João rodam no startup | risco de acoplamento pessoal e alteração indevida de dados | isolar por flag explícita de desenvolvimento e depois remover | Não |
| Alta | logs de erro ainda podem carregar detalhes excessivos fora de produção e sem política clara de redaction | vazamento operacional de PII e contexto sensível | padronizar redaction de email, token, cookie, CPF/CNS e payloads críticos | Não |
| Alta | fallback permissivo de defaults em config para dev | risco de subir ambiente mal configurado sem perceber | manter fallback só em dev/test, falhar cedo em produção e staging críticos | Não |
| Média | endpoint `/metrics/internal` sem proteção dedicada | exposição de metadados operacionais | restringir por autenticação admin ou desabilitar em produção | Sim, curto prazo |
| Média | CORS com opção `CORS_ALLOW_ALL` | abertura indevida se usado incorretamente | documentar uso só emergencial e alertar via log na inicialização | Sim, curto prazo |
| Média | rotas grandes concentram autenticação, sessão e auditoria | manutenção difícil, maior chance de falha de segurança futura | dividir incrementalmente `auth`, `patients`, `me`, `supplies` | Sim |
| Média | refresh tokens ficam em estrutura principal de estado | custo de manutenção e auditoria | evoluir para tabela/serviço dedicado de sessão ao redor do modelo atual | Sim |
| Baixa | resposta de erro é genérica, mas sem classificação consistente | operação mais lenta | padronizar catálogo de erros operacionais | Sim |

## Controles já existentes

- autenticação por bearer token e cookie httpOnly;
- validação de JWT com `issuer`, `audience` e algoritmo fixo;
- proteção CSRF para fluxo com cookie;
- headers via Helmet e middleware próprio;
- rate limit global e por autenticação;
- criptografia de campos sensíveis em repouso;
- retenção e trilha básica de auditoria.

## Medidas imediatas

1. Remover dependência operacional de código pessoal no startup.
2. Fechar validação forte de ambiente em produção e homologação.
3. Endurecer conexão TLS com banco oficial.
4. Reduzir logs sensíveis e formalizar política de redaction.
5. Proteger ou desligar métricas internas em produção pública.

## Medidas futuras

1. Separar módulo de sessão/autenticação.
2. Revisar permissão por capability em todas as rotas críticas.
3. Adicionar rotação e inventário de segredos com evidência operacional.
4. Criar testes negativos de segurança para CORS, cookies, CSRF e rate limiting.
