# Escopos Funcionais — VITRAS

Repositório central de escopos funcionais de telas e fluxos do VITRAS.

Objetivo:
- padronizar documentação funcional
- facilitar alinhamento entre produto, UX, desenvolvimento, QA e operação UBS
- manter rastreabilidade entre tela, regra, API, permissão e auditoria

## Como usar

1. Criar novo escopo a partir do template em [escopo-funcional-tela-template-vitras.md](C:/dev/vitras/docs/templates/escopo-funcional-tela-template-vitras.md)
2. Salvar documento final nesta pasta
3. Atualizar índice abaixo
4. Validar conteúdo contra código, RBAC, LGPD, auditoria e contexto UBS

## Índice de escopos

| Tela / Fluxo | Módulo | Status | Arquivo |
|---|---|---|---|
| Fila / Recepção | Recepção / Triagem / Agenda do dia | Aprovado para refinamento | [fila-recepcao.md](C:/dev/vitras/docs/escopos/fila-recepcao.md) |
| Painel | Dashboard / Visão Operacional | Aprovado para refinamento | [painel.md](C:/dev/vitras/docs/escopos/painel.md) |

## Fontes de verdade obrigatórias

- [system-context.md](C:/dev/vitras/docs/ai/system-context.md)
- [rbac-matrix.md](C:/dev/vitras/docs/ai/rbac-matrix.md)
- [frontend-pages-map.md](C:/dev/vitras/docs/ai/frontend-pages-map.md)
- [LGPD_OPERATIONS.md](C:/dev/vitras/docs/lgpd/LGPD_OPERATIONS.md)

## Convenções

- Nomear arquivos com slug funcional em minúsculas e hífen
- Manter seções numeradas no padrão enterprise do projeto
- Referenciar capabilities reais do código
- Separar regra de negócio, comportamento de erro e critério BDD
- Incluir riscos, auditoria, métricas e dependências técnicas
