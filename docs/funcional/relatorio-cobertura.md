# VITRAS APS — Relatório de Cobertura Funcional

**Versão:** 1.0  
**Gerado em:** 2026-06-22  
**Sprint:** ARCH-DOC-03

---

## Inventário completo

### Rotas URL (pathname-based)

| Rota | Documentada |
|---|---|
| `/activate` | ✅ |
| `/primeiro-acesso` | ✅ |
| `/privacidade` | ✅ (redirect — sem doc específica) |
| `/` (unauthenticated) | ✅ login.md |
| `/` (forcePasswordChange) | ✅ change-password-required.md |
| `/platform` (support_admin) | ✅ console-nacional.md |
| `/` (receptionist) | ✅ app-recepcao.md |
| `/` (demais perfis) | ✅ dashboard.md + todas as tabs |

**Rotas URL identificadas: 8 | Documentadas: 8 | Cobertura: 100%**

---

### Tabs do App Principal (TabContent)

| Tab | Documentada |
|---|---|
| `dashboard` | ✅ dashboard.md |
| `patients` | ✅ lista-pacientes.md |
| `chart` | ✅ prontuario.md |
| `queue` | ✅ fila.md |
| `triage` | ✅ triagem.md |
| `agenda` | ✅ agenda.md |
| `referrals` | ✅ encaminhamentos.md |
| `acs_tasks` | ✅ acs-workspace.md |
| `exams_page` | ✅ exames.md |
| `gestor` | ✅ gestor.md |
| `access_requests` | ✅ solicitacoes-acesso.md |
| `audit_log` | ✅ auditoria.md |
| `reports` | ✅ relatorios.md |
| `diagnostics` | ✅ diagnostico.md |
| `protocols` | ✅ protocolos.md |
| `equipe` | ✅ equipe.md |
| `vaccines` | ✅ vacinas.md |
| `pharmacy` | ✅ farmacia.md |
| `insumos` | ✅ insumos.md |
| `ai` | ✅ ia.md |

**Tabs identificadas: 20 | Documentadas: 20 | Cobertura: 100%**

---

### Platform Console subviews

| Subview | Documentada |
|---|---|
| Lista de UBS | ✅ console-nacional.md |
| UnitForm (criar UBS) | ✅ detalhe-ubs.md |
| UnitDetail | ✅ detalhe-ubs.md |
| new-manager | ✅ detalhe-ubs.md |
| new-team | ✅ detalhe-ubs.md |
| Checklist homologação | ✅ checklist-homologacao.md |

**Subviews Platform: 6 | Documentadas: 6 | Cobertura: 100%**

---

### Modais Globais

| Modal | Documentado |
|---|---|
| PatientModal | ✅ modal-paciente.md |
| UserModal | ✅ modal-usuario.md |
| TemplateModal | ✅ modal-template.md |
| ProfileModal | ✅ modal-perfil.md |
| SecureAccessModal | ✅ modal-acesso-seguro.md |
| SessionTimeoutModal | ✅ modal-sessao-expirada.md |
| DeleteUserModal | ✅ documentado em modal-usuario.md |
| DeleteTemplateModal | ✅ documentado em modal-template.md |
| ReceptionLoginModal | ✅ documentado em app-recepcao.md |

**Modais identificados: 9 | Documentados: 9 | Cobertura: 100%**

---

### App Recepção (ReceptionistApp)

| Elemento | Documentado |
|---|---|
| App Recepção (container) | ✅ app-recepcao.md |
| Tab Fila | ✅ app-recepcao.md + fila.md |
| Tab Agenda | ✅ app-recepcao.md + agenda.md |

**Cobertura: 100%**

---

## Sumário quantitativo

| Tipo | Identificadas | Documentadas | Cobertura |
|---|---|---|---|
| Rotas URL | 8 | 8 | **100%** |
| Tabs App Principal | 20 | 20 | **100%** |
| Subviews Platform | 6 | 6 | **100%** |
| Modais globais | 9 | 9 | **100%** |
| Outros (ReceptionistApp) | 3 | 3 | **100%** |
| **Total** | **46** | **46** | **100%** |

---

## Documentos de navegação e catálogos

| Documento | Status |
|---|---|
| `catalogo-rotas.md` | ✅ Criado |
| `catalogo-paginas.md` | ✅ Criado |
| `mapa-navegacao.md` | ✅ Criado |
| `relatorio-cobertura.md` | ✅ Este arquivo |

---

## Lacunas conhecidas

| Lacuna | Tipo | Ação necessária |
|---|---|---|
| `docs/produto/03-dicionario-dados.md` — campos de `acsVisits`, `households`, `familyGroups` | Docs pendentes ARCH-DOC-01 | Backlog — aguarda APS-02A |
| CDS field-by-field mapping | Docs pendentes | Aguarda revisão LGPD |
| `evaluateGroup()` score documentation | Docs pendentes | Backlog |
| Tab `esusMirror` (EsusMirror.jsx) | Inventariado | Doc não criado — tab não listado em TabContent ativo |

---

## Próximos passos do backlog documental

1. Documentar `EsusMirror` (verificar se está ativo em algum perfil)
2. Completar campos de `acsVisits` e `households` no dicionário de dados
3. Documentar `ChartPage.jsx` e `PatientsTab.jsx` (verificar uso atual)
