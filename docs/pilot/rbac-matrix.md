# RBAC Validation Matrix — VITRAS APS

**Versão:** 1.0  
**Data:** 2026-06-18  
**Fonte:** `frontend-react/src/utils/roles.js`, `backend/src/middlewares/auth.js`, `backend/src/routes/patients.js`, `backend/src/routes/audit-logs.js`

---

## Perfis do Piloto

| Perfil (role) | Descrição | App |
|---------------|-----------|-----|
| `doctor` | Médico(a) de Família | AppShell principal |
| `nurse_manager` | Enfermeiro(a) | AppShell principal |
| `nursing_tech` | Técnico(a) de Enfermagem | AppShell principal |
| `acs` | Agente Comunitário de Saúde | AppShell principal |
| `receptionist` | Recepção / Administrativo | ReceptionistApp (dedicado) |
| `gestor` | Gestor(a) | AppShell principal (tab gestor) |
| `security_auditor` | Auditor(a) de Segurança | AppShell + audit log |
| `break_glass_admin` | Admin emergencial | Acesso total |

---

## Matriz: Ação × Perfil

**Legenda:** ✅ Permitido · ❌ Negado · ⚠️ Permitido com restrições · — Não aplicável

### Pacientes

| Ação | doctor | nurse_mgr | nursing_tech | acs | receptionist | gestor | security_auditor |
|------|--------|-----------|-------------|-----|-------------|--------|-----------------|
| Listar pacientes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver dados completos do paciente | ✅ | ✅ | ✅ | ⚠️¹ | ⚠️² | ⚠️³ | ❌ |
| Criar paciente | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Editar paciente | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Excluir paciente | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver CNS responsável | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver campos LGPD Art. 11 (dados sensíveis) | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ (F7-03) | ❌ |
| Ver NIS | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

¹ ACS vê pacientes mas sem campos clínicos sensíveis completos  
² Receptionist acessa via ReceptionistApp — dados limitados a agendamento/cadastro básico  
³ Gestor: filtro F7-03 remove campos de categoria especial (LGPD Art. 11) da API response

### Registros Clínicos (Prontuário / Atendimentos)

| Ação | doctor | nurse_mgr | nursing_tech | acs | receptionist | gestor | security_auditor |
|------|--------|-----------|-------------|-----|-------------|--------|-----------------|
| Criar registro clínico (FAI) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver prontuário (ChartPage) | ✅ | ✅ | ❌⁴ | ❌ | ❌ | ❌ | ❌ |
| Editar registro | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Excluir registro | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Prescrição (ClinicalPrescriber) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

⁴ nursing_tech: canWriteRecords = true mas CHART_ROLES = {doctor, dentist, nurse_manager} — não acessa ChartPage. Inconsistência documentada.

### Agenda

| Ação | doctor | nurse_mgr | nursing_tech | acs | receptionist | gestor |
|------|--------|-----------|-------------|-----|-------------|--------|
| Ver agenda | cap: agenda.read | cap: agenda.read | cap: agenda.read | — | ✅ (ReceptionistApp) | — |
| Criar agendamento | cap: agenda.write | cap: agenda.write | cap: agenda.write | — | ✅ | — |

*Agenda é capability-based — não role-based diretamente*

### Farmácia

| Ação | doctor | nurse_mgr | pharmacist | pharmacy_tech | outros |
|------|--------|-----------|-----------|--------------|--------|
| Ver estoque | cap: pharmacy.read | cap: pharmacy.read | cap: pharmacy.read | cap: pharmacy.read | ❌ |
| Dispensar | cap: pharmacy.write | cap: pharmacy.write | cap: pharmacy.write | cap: pharmacy.write | ❌ |

### Referrals / Encaminhamentos

| Ação | Permissão |
|------|-----------|
| Ver | cap: referrals.read |
| Criar/editar | cap: referrals.write |

### Audit Log

| Ação | doctor | nurse_mgr | gestor | security_auditor | break_glass_admin | outros |
|------|--------|-----------|--------|-----------------|-------------------|--------|
| Ler audit logs | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Exportar audit logs | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Verificar integridade hash | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

### Gestão de Usuários

| Ação | nurse_mgr | doctor | gestor | break_glass_admin |
|------|-----------|--------|--------|-------------------|
| Ver usuários | ✅ (canManage) | ✅ (canManage) | — | ✅ |
| Criar usuário | ✅ | ✅ | — | ✅ |
| Editar usuário | ✅ | ✅ | — | ✅ |
| Excluir usuário | ✅ | ✅ | — | ✅ |
| Bootstrap unidade | ❌ | ❌ | ❌ | ✅ |

### CDS Export

| Ação | Permissão atual |
|------|----------------|
| Gerar .esus | Requer verificação — cds-export.js ausente do git HEAD |
| Download arquivo | Idem |

---

## Inconsistências Identificadas

| # | Inconsistência | Perfis afetados | Severidade | Recomendação |
|---|----------------|----------------|-----------|--------------|
| R-01 | nursing_tech: canWriteRecords=true mas não acessa ChartPage (CHART_ROLES não inclui nursing_tech) | nursing_tech | Baixo | Documentar limitação ou adicionar nursing_tech ao CHART_ROLES |
| R-02 | gestor: acessa tab "gestor" mas sem acesso a audit log próprio | gestor | Baixo | Avaliar se gestor precisa de audit view própria |
| R-03 | Agenda, farmácia, referrals: permissão 100% capability-based — nenhum role tem acesso por padrão | Todos | Médio | Garantir que capabilities são configuradas no onboarding do município |
| R-04 | CDS Export: roles autorizados não documentados formalmente (cds-export.js ausente do git) | nurse_manager? | Alto | Restaurar cds-export.js ao git, documentar RBAC |
| R-05 | security_auditor: pode ler audit mas não tem UI própria no app principal — acesso por qual tab? | security_auditor | Médio | Confirmar UX do perfil auditor |

---

## Capabilities por Perfil — Configuração Recomendada para Piloto

| Capability | doctor | nurse_mgr | nursing_tech | acs | receptionist | gestor |
|-----------|--------|-----------|-------------|-----|-------------|--------|
| agenda.read | ✅ | ✅ | ✅ | — | via app | — |
| agenda.write | ✅ | ✅ | ✅ | — | via app | — |
| referrals.read | ✅ | ✅ | ✅ | — | — | — |
| referrals.write | ✅ | ✅ | — | — | — | — |
| pharmacy.read | — | ✅ | — | — | — | — |
| pharmacy.write | — | ✅ | — | — | — | — |
| records.write | ✅ | ✅ | ✅ | ✅ | — | — |
| records.read | ✅ | ✅ | ✅ | — | — | — |
| audit.read | — | ✅ | — | — | — | ✅ |

---

*VITRAS APS — docs/pilot/rbac-matrix.md*
