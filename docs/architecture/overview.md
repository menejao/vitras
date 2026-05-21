// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Arquitetura oficial do Vitras

## Objetivo arquitetural

Manter sistema clínico monolítico web com separação clara entre frontend, backend, documentação operacional e histórico legado, sem migração de stack e sem quebra de comportamento em produção.

## Componentes principais

- `frontend-react/`: SPA React/Vite
- `backend/`: API Node.js/Express
- `docs/`: documentação técnica e operacional
- `scripts/`: scripts utilitários e de operação

## Arquitetura de runtime

```text
Usuário
  -> Cloudflare
  -> AWS Amplify
  -> Frontend React/Vite
  -> Elastic Beanstalk
  -> Backend Express
  -> Aurora/RDS PostgreSQL
```

## Princípios de manutenção

- preservar monólito atual;
- manter regras de negócio no backend e hooks/services, não em componentes visuais;
- preservar Design System no frontend;
- reduzir acoplamento entre deploy atual e artefatos antigos;
- tratar documentação como parte da operação.

## Organização esperada

- páginas e componentes seguem separação por responsabilidade;
- utilitários e serviços concentram lógica reaproveitável;
- documentação oficial fica em `docs/architecture`, `docs/deployment`, `docs/runbooks`, `docs/security` e `docs/onboarding`;
- material antigo ou fora do padrão oficial fica em `docs/legacy`.

## Decisões desta padronização

- AWS Amplify substitui fluxo antigo de frontend edge-first;
- Elastic Beanstalk substitui fluxo antigo de backend fora do padrão oficial;
- Aurora/RDS substitui documentação antiga centrada em Neon;
- Cloudflare permanece como camada de borda, não como origem principal de build/deploy.
