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

Ver [catálogo completo](catalogo-paginas.md) — 27 páginas + 6 modais documentados (ARCH-DOC-03, 100% de cobertura).

**Catálogos e mapas:**
- [Catálogo de Rotas](catalogo-rotas.md) — 48 superfícies funcionais mapeadas
- [Catálogo de Páginas](catalogo-paginas.md) — 33 documentos de página/modal
- [Mapa de Navegação](mapa-navegacao.md) — fluxos de entrada, tabs, modais
- [Relatório de Cobertura](relatorio-cobertura.md) — 100% cobertura ARCH-DOC-03

**Páginas documentadas:**
- [Login](pages/login.md) | [Troca de Senha](pages/change-password-required.md) | [Console Nacional](pages/console-nacional.md) | [Detalhe UBS](pages/detalhe-ubs.md) | [Checklist Homologação](pages/checklist-homologacao.md)
- [Dashboard](pages/dashboard.md) | [Lista de Pacientes](pages/lista-pacientes.md) | [Workspace ACS](pages/acs-workspace.md) | [Prontuário](pages/prontuario.md) | [Painel Gestor](pages/gestor.md)
- [Equipe](pages/equipe.md) | [Agenda](pages/agenda.md) | [Fila](pages/fila.md) | [Triagem](pages/triagem.md) | [Encaminhamentos](pages/encaminhamentos.md)
- [Exames](pages/exames.md) | [Vacinas](pages/vacinas.md) | [Farmácia](pages/farmacia.md) | [Insumos](pages/insumos.md) | [Relatórios](pages/relatorios.md)
- [Protocolos](pages/protocolos.md) | [Diagnóstico](pages/diagnostico.md) | [Solicitações Acesso](pages/solicitacoes-acesso.md) | [Auditoria](pages/auditoria.md) | [IA](pages/ia.md)
- [App Recepção](pages/app-recepcao.md) | [Ativar Conta (deprecated)](pages/ativar-conta.md)
- Modais: [Paciente](pages/modal-paciente.md) | [Usuário](pages/modal-usuario.md) | [Perfil](pages/modal-perfil.md) | [Acesso Seguro](pages/modal-acesso-seguro.md) | [Template](pages/modal-template.md) | [Sessão Expirada](pages/modal-sessao-expirada.md)

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
