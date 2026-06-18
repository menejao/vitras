# End-to-End APS Flows — VITRAS APS

**Versão:** 1.0  
**Data:** 2026-06-18  
**Objetivo:** documentar, validar e identificar gaps nos fluxos principais de APS.

---

## 1. Cadastro Individual (FCI)

### 1.1 Criação

**Perfis autorizados:** nurse_manager, doctor, dentist, nursing_tech, acs (canWriteRecords)  
**Rota backend:** `POST /patients`  
**RBAC:** requireAuth → canWriteRecords check inline em patients.js

| Passo | Ação | Resultado esperado | Evidência código |
|-------|------|--------------------|-----------------|
| 1 | Clicar "Novo Paciente" | Modal PatientModal abre | `usePatientModal.openEditPatient` |
| 2 | Preencher nome, data nascimento, sexo | Campos obrigatórios validados no frontend | `PatientModal.jsx` form validation |
| 3 | Preencher CNS e/ou CPF | Campo opcional, sem máscara obrigatória | `PatientModal.jsx` |
| 4 | Preencher endereço + CEP | CEP dispara lookup automático (lookupCepAndFillAddress) | `usePatientModal.lookupCepAndFillAddress` |
| 5 | Preencher nome social (se aplicável) | Campo nomeSocial disponível | `PatientModal.jsx` |
| 6 | Salvar | POST /patients → paciente aparece na lista | `submitPatient` |
| 7 | Audit log | Evento `patient.create` registrado | `patients.js` addAuditLog |

**Gaps identificados:**
- ⚠️ Validação de CNS (dígito verificador) não confirmada no frontend — pode aceitar CNS inválido
- ⚠️ Campo microárea: existência no form não verificada nesta auditoria

### 1.2 Edição

**Rota:** `PUT /patients/:id`  
**RBAC:** canWriteRecords + controle de acesso por equipe (F7-02)

| Passo | Resultado esperado |
|-------|--------------------|
| Abrir paciente existente | Modal abre com dados preenchidos |
| Editar campo | PUT enviado ao backend |
| Gestor tenta editar | 403 — Sem permissão para editar paciente (linha 539 patients.js) |
| Audit log | `patient.update` registrado |

### 1.3 Visualização

**RBAC por perfil:**
| Perfil | Vê paciente | Vê dados clínicos | Vê CNS responsável | Vê campos LGPD Art. 11 |
|--------|-------------|-------------------|--------------------|------------------------|
| doctor | ✅ | ✅ | ✅ | ✅ |
| nurse_manager | ✅ | ✅ | ✅ | ✅ |
| nursing_tech | ✅ | ✅ | ✅ | ✅ (parcial) |
| acs | ✅ | Limitado | ❌ | ❌ |
| receptionist | ✅ | ❌ (app próprio) | ❌ | ❌ |
| gestor | ✅ | ❌ (F7-03 filtro) | ❌ | ❌ |
| security_auditor | Somente audit | — | — | — |

### 1.4 Auditoria

- Acesso ao paciente registrado em `audit_logs`
- Tentativas negadas registradas com `patient.access_denied`
- Hash chain v2 protege integridade do log

### 1.5 Exportação (FCI)

- CDS Export gera FCI com campos do paciente mapeados conforme `cds-field-mapping.md`
- **Gap crítico:** ver M-05B-09 Truth Audit — cds-export.js ausente do git HEAD

---

## 2. Cadastro Domiciliar (FCD)

### 2.1 Criação

**Perfis autorizados:** canWriteRecords (nurse_manager, doctor, dentist, nursing_tech, acs)  
**Rota backend:** `PUT /patients/:id` com campos de household (F5-01)  
**Persistência:** `db.households` (shadow table separada de `db.patients`)

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | Cadastrar paciente com dados de domicílio | Campos de household extraídos do payload (F5-01) |
| 2 | Preencher tipo imóvel, posse, nº moradores | Persistidos em db.households |
| 3 | Associar membros da família | family_groups route vincula membros |
| 4 | Salvar | household criado ou atualizado (upsert) |

**Gaps identificados:**
- ⚠️ households.js deletado do git HEAD — rota `/households/*` não funciona localmente
- ⚠️ UI para FCD (household management) — status em produção requer verificação

### 2.2 Edição

Mesmas permissões de FCI. Household atualizado via PUT /patients/:id (campos household).

### 2.3 Visualização

Campos de domicílio visíveis no perfil do paciente para canWriteRecords.  
Gestor: F7-03 filtra dados — não recebe campos de household sensíveis.

### 2.4 Auditoria

Acesso registrado via audit_logs junto com dados do paciente.

### 2.5 Exportação (FCD)

- CDS Export inclui FCD com dados do domicílio
- **Gap crítico:** cds-export.js ausente do git HEAD (ver M-05B-09)

---

## 3. Atendimento Individual (FAI)

### 3.1 Criação

**Perfis autorizados:** canWriteRecords — com subchecagem: criação de atendimento clínico requer `records.write` capability ou roles específicos  
**Rota backend:** `POST /patients/:id/records` (patients.js linha ~820)  
**CRT-04:** guard capability `records.write` no path de criação de registros clínicos

| Passo | Ação | Resultado esperado |
|-------|------|--------------------|
| 1 | Selecionar paciente | Paciente carregado com histórico |
| 2 | Abrir aba Protocolo/Atendimento | Formulário de registro clínico |
| 3 | Preencher data, turno, tipo | Campos obrigatórios |
| 4 | Adicionar CID-10 / CIAP-2 | Campos opcionais de diagnóstico |
| 5 | Salvar | POST /patients/:id/records |
| 6 | Audit | `record.create` auditado |

**Gaps identificados:**
- ⚠️ CID-10/CIAP-2: campo presente na FAI mas interface para busca de código não confirmada como testada em produção
- ⚠️ ChartPage (prontuário) restrito a CHART_ROLES (doctor, dentist, nurse_manager) — nursing_tech não acessa

### 3.2 Edição

Rota: `PUT /patients/:id/records/:recordId`  
RBAC: mesmas roles que criação.

### 3.3 Visualização

- **ChartPage/prontuário:** apenas doctor, dentist, nurse_manager (CHART_ROLES em medical-records.js)
- **RecordsPage:** canWriteRecords (inclui nursing_tech e acs)
- ⚠️ Gap: nursing_tech pode criar registro mas não acessar prontuário completo — consistência?

### 3.4 Auditoria

- `record.create`, `record.update`, `record.delete` auditados
- `patient.access_denied` para tentativas não autorizadas

### 3.5 Exportação (FAI)

- CDS Export inclui FAI com atendimentos
- **Gap crítico:** cds-export.js ausente do git HEAD (ver M-05B-09)

---

## 4. Resumo de Gaps por Fluxo

| Fluxo | Gap | Severidade | Impacto Piloto |
|-------|-----|-----------|----------------|
| FCI | Validação CNS frontend | Médio | Dados inválidos podem chegar ao PEC |
| FCD | households.js deletado do git | Alto | Backend local não inicia |
| FAI | nursing_tech não acessa ChartPage | Baixo | Workaround: RecordsPage |
| FAI | CID/CIAP UI não validada em uso real | Médio | Exportação FAI pode ter campos vazios |
| Todos | cds-export.js deletado do git | Alto | CDS Export só disponível via deploy zip |

---

*VITRAS APS — docs/pilot/e2e-aps-flows.md*
