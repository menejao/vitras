# VITRAS APS — Catálogo de Páginas

**Versão:** 1.0  
**Atualizado:** 2026-06-22

---

## Páginas documentadas

| # | Página | Arquivo doc | Módulo | Perfis | Status |
|---|---|---|---|---|---|
| 1 | Login / Autenticação | [pages/login.md](pages/login.md) | Auth | Todos | ✅ Documentado |
| 2 | Troca Obrigatória de Senha | [pages/change-password-required.md](pages/change-password-required.md) | IAM | Todos | ✅ Documentado |
| 3 | Console Nacional | [pages/console-nacional.md](pages/console-nacional.md) | Platform | `support_admin` | ✅ Documentado |
| 4 | Detalhe da UBS | [pages/detalhe-ubs.md](pages/detalhe-ubs.md) | Platform | `support_admin` | ✅ Documentado |
| 5 | Checklist de Homologação | [pages/checklist-homologacao.md](pages/checklist-homologacao.md) | Platform | `support_admin` | ✅ Documentado |
| 6 | Dashboard | [pages/dashboard.md](pages/dashboard.md) | Core | Clínicos | ✅ Documentado |
| 7 | Lista de Pacientes | [pages/lista-pacientes.md](pages/lista-pacientes.md) | Clínico | Clínicos | ✅ Documentado |
| 8 | Workspace ACS | [pages/acs-workspace.md](pages/acs-workspace.md) | ACS | `acs` | ✅ Documentado |
| 9 | Prontuário / Registros | [pages/prontuario.md](pages/prontuario.md) | Clínico | Clínicos | ✅ Documentado |
| 10 | Painel Gestor | [pages/gestor.md](pages/gestor.md) | Gestão | `gestor`, `coordinator` | ✅ Documentado |
| 11 | Equipe | [pages/equipe.md](pages/equipe.md) | Gestão | Todos | ✅ Documentado |
| 12 | Agenda | [pages/agenda.md](pages/agenda.md) | Agenda | Clínicos | ✅ Documentado |
| 13 | Fila de Atendimento | [pages/fila.md](pages/fila.md) | Reception | Recepção, Clínicos | ✅ Documentado |
| 14 | Triagem | [pages/triagem.md](pages/triagem.md) | Clínico | Enfermagem | ✅ Documentado |
| 15 | Encaminhamentos | [pages/encaminhamentos.md](pages/encaminhamentos.md) | Clínico | Clínicos | ✅ Documentado |
| 16 | Exames | [pages/exames.md](pages/exames.md) | Clínico | Clínicos | ✅ Documentado |
| 17 | Vacinas | [pages/vacinas.md](pages/vacinas.md) | Clínico | Clínicos | ✅ Documentado |
| 18 | Farmácia | [pages/farmacia.md](pages/farmacia.md) | Farmácia | Farmacêuticos, Clínicos | ✅ Documentado |
| 19 | Suprimentos / Insumos | [pages/insumos.md](pages/insumos.md) | Farmácia | Clínicos | ✅ Documentado |
| 20 | Relatórios | [pages/relatorios.md](pages/relatorios.md) | Gestão | Gestão, Clínicos | ✅ Documentado |
| 21 | Diagnóstico do Sistema | [pages/diagnostico.md](pages/diagnostico.md) | Técnico | Admin | ✅ Documentado |
| 22 | Solicitações de Acesso | [pages/solicitacoes-acesso.md](pages/solicitacoes-acesso.md) | IAM | Admin, Gestor | ✅ Documentado |
| 23 | Auditoria | [pages/auditoria.md](pages/auditoria.md) | Segurança | Admin | ✅ Documentado |
| 24 | Protocolos | [pages/protocolos.md](pages/protocolos.md) | Gestão | Admin | ✅ Documentado |
| 25 | IA — Análise | [pages/ia.md](pages/ia.md) | IA | Gestão, Admin | ✅ Documentado |
| 26 | App Recepção | [pages/app-recepcao.md](pages/app-recepcao.md) | Reception | `receptionist` | ✅ Documentado |
| 27 | Ativar Conta (deprecated) | [pages/ativar-conta.md](pages/ativar-conta.md) | IAM | Público | ✅ Documentado |

### Modais globais documentados

| # | Modal | Arquivo doc | Acionador | Status |
|---|---|---|---|---|
| M1 | Modal de Paciente | [pages/modal-paciente.md](pages/modal-paciente.md) | Criar/editar/visualizar paciente | ✅ Documentado |
| M2 | Modal de Usuário | [pages/modal-usuario.md](pages/modal-usuario.md) | Criar/editar usuário | ✅ Documentado |
| M3 | Modal de Perfil | [pages/modal-perfil.md](pages/modal-perfil.md) | "Meu perfil" na Topbar | ✅ Documentado |
| M4 | Modal de Acesso Seguro | [pages/modal-acesso-seguro.md](pages/modal-acesso-seguro.md) | Impersonação / Break Glass | ✅ Documentado |
| M5 | Modal de Template | [pages/modal-template.md](pages/modal-template.md) | Criar/editar protocolo | ✅ Documentado |
| M6 | Modal de Sessão Expirada | [pages/modal-sessao-expirada.md](pages/modal-sessao-expirada.md) | Idle timeout | ✅ Documentado |

---

## Cobertura

| Métrica | Valor |
|---|---|
| Superfícies funcionais identificadas | 48 |
| Páginas principais documentadas | 27 |
| Modais documentados | 6 |
| **Total documentado** | **33** |
| Cobertura de páginas principais | **100%** |
| Subviews (aninhadas em páginas) | Documentadas dentro dos docs das páginas pai |

---

## Critério de atualização

Toda nova página ou modal adicionado ao produto deve ser registrado neste catálogo antes de ser considerado entregue.
