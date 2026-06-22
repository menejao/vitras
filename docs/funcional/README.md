# VITRAS APS — Documentação Funcional por Página

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Gate obrigatório:** GOV-01 antes de qualquer alteração de produto

---

## Estrutura

```
docs/funcional/
├── README.md                        (este arquivo — índice e governança)
├── templates/
│   └── escopo-funcional-pagina.md  (template obrigatório para novas páginas)
└── pages/
    ├── login.md
    ├── change-password-required.md
    ├── console-nacional.md
    ├── detalhe-ubs.md
    └── checklist-homologacao.md
```

---

## Índice de páginas

| Página | Arquivo | Perfis | Status |
|---|---|---|---|
| Login / Autenticação | [pages/login.md](pages/login.md) | Todos | Documentado |
| Troca Obrigatória de Senha | [pages/change-password-required.md](pages/change-password-required.md) | Todos | Documentado |
| Console Nacional | [pages/console-nacional.md](pages/console-nacional.md) | `support_admin` | Documentado |
| Detalhe da UBS | [pages/detalhe-ubs.md](pages/detalhe-ubs.md) | `support_admin` | Documentado |
| Checklist de Homologação | [pages/checklist-homologacao.md](pages/checklist-homologacao.md) | `support_admin` | Documentado |

### Backlog de documentação (páginas não documentadas)

| Página | Arquivo | Prioridade |
|---|---|---|
| Dashboard | pages/dashboard.md | Alta |
| Lista de Pacientes | pages/lista-pacientes.md | Alta |
| Detalhe do Paciente | pages/detalhe-paciente.md | Alta |
| ACS Workspace (Tarefas) | pages/acs-workspace.md | Alta |
| Grupos Familiares | pages/grupos-familiares.md | Alta |
| Visitas Domiciliares | pages/visitas-domiciliares.md | Alta |
| Gestor — Painel | pages/gestor-painel.md | Média |
| Equipes | pages/equipes.md | Média |
| Agenda | pages/agenda.md | Média |
| Prontuário | pages/prontuario.md | Média |
| Farmácia | pages/farmacia.md | Baixa |
| Relatórios | pages/relatorios.md | Baixa |

---

## Regra obrigatória de atualização em PR

**Nenhum PR pode ser considerado concluído sem atualizar a documentação funcional correspondente quando houver alteração em:**

- Qualquer campo de formulário (inclusão, remoção, renomeação, validação)
- Qualquer botão ou ação do usuário
- Qualquer modal ou drawer
- Qualquer filtro, ordenação ou paginação
- Qualquer tabela ou lista
- Qualquer regra de negócio implementada ou alterada
- Qualquer permissão de acesso
- Qualquer fluxo de navegação
- Qualquer mensagem de erro ou validação
- Qualquer comportamento de loading ou estado vazio

**Responsável:** autor do PR.

**Verificação:** checklist de revisão de PR inclui item de documentação funcional.

---

## Como criar documentação para nova página

1. Copiar `templates/escopo-funcional-pagina.md`
2. Salvar em `pages/[nome-da-pagina].md`
3. Preencher todas as seções obrigatórias
4. Adicionar entrada no índice acima
5. Atualizar `docs/roadmap/README.md` se for nova funcionalidade
