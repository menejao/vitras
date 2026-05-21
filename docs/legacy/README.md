// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Arquivos legados arquivados

Este diretório guarda arquivos de deploy e infraestrutura que já fizeram parte de fluxos anteriores do projeto, mas não representam mais padrão oficial atual.

## Arquivos arquivados

- `render.yaml`
- `wrangler.toml`
- `worker.js`
- `backend.apprunner.yaml`

## Por que foram arquivados

- documentação oficial atual usa AWS Amplify, Elastic Beanstalk, Aurora/RDS e Cloudflare;
- esses arquivos representavam fluxos antigos ou alternativos de publicação;
- mantê-los na raiz confundia onboarding, operação e padronização de deploy.

## Quando eram usados

- `render.yaml`: deploy antigo de backend fora do padrão oficial atual;
- `wrangler.toml` e `worker.js`: deploy antigo do frontend na borda Cloudflare;
- `backend.apprunner.yaml`: fluxo antigo de backend via AWS App Runner.

## Ainda possuem utilidade?

Sim, apenas como referência histórica, comparação de configuração ou apoio em auditorias técnicas. Não devem ser tratados como fonte oficial de deploy atual sem decisão explícita da equipe.

## Atenção adicional

Outros documentos históricos do repositório ainda podem citar Render, App Runner, Neon, Cloudflare Pages ou Wrangler. Esses conteúdos devem ser revisados de forma incremental, sem apagar evidências úteis de decisões passadas.
