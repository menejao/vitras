# VITRAS APS — Documentação de Produto

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Gate obrigatório:** GOV-01 antes de qualquer alteração de produto

---

## Índice de documentos

| Documento | Conteúdo |
|---|---|
| [01-escopo-produto.md](01-escopo-produto.md) | Visão do produto, módulos existentes, módulos bloqueados, roadmap |
| [02-regras-negocio.md](02-regras-negocio.md) | Catálogo nacional de regras de negócio por domínio |
| [03-dicionario-dados.md](03-dicionario-dados.md) | Entidades, campos, tipos, validações, LGPD, CDS |

---

## Governança documental

**Regra obrigatória:** Nenhum PR é considerado concluído sem atualização documental quando houver:

- Novo campo em qualquer entidade
- Nova entidade no banco de dados
- Nova regra de negócio implementada
- Nova rota de API criada
- Alteração de comportamento de validação ou RBAC
- Alteração de mapeamento CDS/e-SUS

**Responsável pela atualização:** autor do PR.

**Verificação:** revisão de PR inclui checagem documental.

---

## Backlog documental

Lacunas identificadas na versão 1.0 (a preencher nas próximas sprints):

- [ ] Documentação completa dos campos de `acsVisits` (sprint APS-01C)
- [ ] Documentação completa dos campos de `households` (sprint APS-01D)
- [ ] Documentação completa dos campos de `familyGroups` (sprint APS-01D)
- [ ] Mapeamento CDS campo a campo (aguarda revisão LGPD)
- [ ] Documentação do fluxo de `score` em `evaluateGroup()`
- [ ] Documentação das métricas de produção por perfil (sprint APS-01F)
