# Auditoria de Expansão Multi-UBS Municipal — VITRAS

**Emitido por:** vitras-delivery-governor  
**Data:** 2026-06-10  
**Tipo:** READ-ONLY — nenhum arquivo foi alterado  
**Baseline auditada:** v1.0-pilot-governed (d20add9)  
**Classificação da mudança:** POST-GO EXPANSION (Sprint 5)  
**Decisão:** ADIAR PARA POST-GO

---

## Governor Output

```
FOCO ATUAL:
Auditar viabilidade de expansão multi-UBS municipal sem quebrar
baseline v1.0-pilot-governed.

STATUS: ADIAR PARA POST-GO

BLOQUEADOR ATUAL:
Nenhum bloqueador técnico para o piloto UBS #1 (single-UBS é seguro).
Expansão multi-UBS requer Sprint completo — proibido antes de D+14
por governance-post-go-rule.md.

NÃO FAZER AGORA:
municipalityId endpoint changes. unitId enforcement em rotas não-cobertas.
frontend UBS selector. executing_unit_id on create. multi-UBS smoke.
Nova sprint técnica. Qualquer alteração de arquitetura.

DEPOIS (Sprint 5 — após D+14 UBS #1):
Implementar cobertura completa de isolamento multi-UBS em todas as rotas.
Emitir cross_team_patient_access em canAccessPatient. Selecionar UBS
no frontend. Testes de integração multi-UBS.

PRÓXIMA AÇÃO ÚNICA:
onboarding-ubs-master-checklist.md → Gate 0 (UBS real).
Abrir Sprint 5 somente após d14-report.md assinado.

CRITÉRIO DE FECHAMENTO (Sprint 5 GO):
Smoke multi-UBS PASS + isolamento cross-município PASS + audit events
cross-UBS registrados + frontend UBS selector funcional.

RECOMENDAÇÃO:
Fundação está pronta. Schema, canAccessPatient com lógica municipal e
unit bootstrap já existem. Piloto UBS #1 é seguro no estado atual.
Expansão é Sprint 5 — não abrir antes de D+14.
```

---

## Seção 1 — Estado Atual do Modelo de Dados

### Schema (migrations 004, 009, 010, 011) — PRONTO

| Tabela | Colunas multi-tenant presentes | Status |
|--------|-------------------------------|--------|
| `app_patients` | `team_id`, `unit_id`, `municipality_id` | ✅ Colunas existem |
| `app_users` | `team_id`, `unit_id`, `municipality_id` | ✅ Colunas existem |
| `app_units` | `id`, `name`, `municipality_id` | ✅ Tabela existe |
| `app_appointments` | `executing_team_id`, `executing_unit_id` | ✅ Colunas existem (migration 011) |
| `app_audit_logs` | `team_id`, `municipality_id` | ✅ Colunas existem |

**Nenhuma migration nova necessária para suportar multi-UBS.**

### Gap de dados: executing_unit_id não setado no create

- Migration 011 backfillou `executing_unit_id` a partir de `patient.unit_id` para registros existentes
- `src/routes/agenda.js` e rotas de agendamento NÃO setam `executing_unit_id` ao criar novos appointments
- Impacto: indicadores por UBS executora ficam vazios para novos agendamentos
- Severidade: **MÉDIA** — não bloqueia piloto UBS #1, bloqueia relatórios multi-UBS

---

## Seção 2 — Modelo de Acesso Atual

### canAccessPatient — `src/utils/patients.js:256-279`

```
write mode (default):  teamId match obrigatório — SEM cross-UBS
read  mode:            clinical roles → municipality match → cross-UBS PERMITIDO
                       non-clinical → teamId match obrigatório
break_glass_admin:     acesso irrestrito em qualquer modo
gestor:                unit-scoped via buildGestorUnitTeamIds (teams da unit do gestor)
```

| Cenário | Comportamento atual | Cobertura multi-UBS |
|---------|--------------------|--------------------|
| Profissional clínico lê paciente de outra UBS, mesmo município | ✅ PERMITIDO | OK para Sprint 5 |
| Profissional clínico escreve paciente de outra UBS | ❌ BLOQUEADO (teamId required) | OK — write restrito |
| Profissional clínico acessa paciente de outro município | ❌ BLOQUEADO | OK — cross-município bloqueado |
| Gestor vê pacientes de sua unit | ✅ PERMITIDO (unit-scoped) | OK para Sprint 5 |
| ACS lê paciente de outro team/UBS | ❌ BLOQUEADO (non-clinical) | OK |

**canAccessPatient está correto para o modelo de negócio declarado.**

### Cobertura de isolamento por rota

| Rota | Usa canAccessPatient/getAllowedPatients | Status |
|------|----------------------------------------|--------|
| `patients.js` | ✅ Sim — múltiplos pontos | COBERTO |
| `tasks.js` | ✅ Sim | COBERTO |
| `exams.js` | ✅ Sim | COBERTO |
| `admin.js` | ✅ Sim (getAllowedPatients) | COBERTO |
| `privacy.js` | ✅ Sim | COBERTO |
| `ai.js` | ✅ Sim | COBERTO |
| `agenda.js` | ⚠️ Não importa isolamento | GAP — Sprint 5 |
| `lab.js` | ⚠️ Não importa isolamento | GAP — Sprint 5 |
| `medical-records.js` | ⚠️ Não importa isolamento | GAP — Sprint 5 |
| `pharmacy.js` | ⚠️ Não importa isolamento | GAP — Sprint 5 |
| `protocols.js` | ⚠️ Não importa isolamento | GAP — Sprint 5 |
| `queue.js` | ⚠️ Não importa isolamento | GAP — Sprint 5 |
| `referrals.js` | ⚠️ Não importa isolamento | GAP — Sprint 5 |
| `supplies.js` | ⚠️ Não importa isolamento | GAP — Sprint 5 |

> **Nota:** As rotas com GAP podem estar fazendo validação via auth middleware + patientId explícito do usuário logado. Auditoria aprofundada de cada rota é task Sprint 5. Para UBS #1 (single-unit), não há risco de cross-tenant pois todos os usuários pertencem ao mesmo município e unit.

---

## Seção 3 — Auditoria Cross-UBS

### Estado atual

- `app_audit_logs`: tem `municipality_id` ✅, NÃO tem `unit_id` na schema primária (apenas via `details.unitId`) ⚠️
- `addAuditLog()` (`src/services/audit.js:178`): NÃO extrai `user.unitId` para o log entry principal
- `cross_team_patient_access` action: **definida, endpoint de relatório existe, E UM evento é emitido** em `patients.js:704` (clinical_record.create quando actorTeamId ≠ patientTeamId)
- Evento cross-UBS **NÃO é emitido** em `canAccessPatient` para leituras clínicas cross-team
- Endpoint `GET /audit-logs/cross-team-access` (`audit-logs.js:368`): funcional mas depende do evento sendo emitido

### Gaps para Sprint 5

| Gap | Arquivo | Linha | Severidade |
|-----|---------|-------|------------|
| `addAuditLog` não captura `user.unitId` | `services/audit.js:183` | — | MÉDIA |
| `canAccessPatient` read cross-UBS não emite audit event | `utils/patients.js:274` | — | ALTA |
| `unit_id` ausente do schema principal de `app_audit_logs` | migration | — | BAIXA (LGPD detalhe) |

---

## Seção 4 — Indicadores por UBS/Equipe Responsável

### Modelo de atribuição

O modelo de negócio declarado:
> "Indicadores devem ser atribuídos à UBS responsável pelo paciente, não necessariamente à UBS do profissional que atendeu."

### Estado atual

- `patient.unit_id` + `patient.team_id` = UBS/equipe **responsável** pelo paciente ✅
- `appointment.executing_team_id` + `appointment.executing_unit_id` = quem **atendeu** ✅ (schema)
- Mas `executing_unit_id` não é setado no create de novos appointments ⚠️
- Dashboards/indicadores (se existirem) não verificados — necessário auditar em Sprint 5

### Para Sprint 5: campos necessários por indicador

| Indicador | Campo fonte | Status |
|-----------|------------|--------|
| Produção por UBS responsável | `patient.unit_id` | ✅ Coluna existe |
| Produção por equipe responsável | `patient.team_id` | ✅ Coluna existe |
| Atendimento por profissional externo | `executing_unit_id ≠ patient.unit_id` | ⚠️ executing_unit_id não setado no create |
| Atendimentos cross-UBS | audit log `cross_team_patient_access` | ⚠️ Evento parcialmente emitido |

---

## Seção 5 — Frontend

### Estado atual

| Componente | Status |
|-----------|--------|
| Seleção de UBS ativa | ❌ Não existe |
| Identificação da UBS do paciente | ❌ Não exibido |
| Aviso de acesso cross-UBS | ❌ Não existe |
| Filtros por UBS/equipe no dashboard | ❌ Não implementado |
| `municipalityId` em React state/context | ❓ Presente em auth token, não usado em UI |

**Frontend é a maior lacuna para multi-UBS.** Requer design + implementação completa.

---

## Seção 6 — Backend: Arquivos Impactados em Sprint 5

### Core (alta prioridade)

| Arquivo | Mudança necessária |
|---------|-------------------|
| `src/utils/patients.js:274` | Emitir `cross_team_patient_access` em canAccessPatient read cross-UBS |
| `src/services/audit.js:183` | Extrair `user.unitId` para o log entry |
| `src/routes/agenda.js` | Verificar cobertura de isolamento; adicionar se ausente |
| `src/routes/lab.js` | Idem |
| `src/routes/medical-records.js` | Idem |
| `src/routes/pharmacy.js` | Idem |
| `src/routes/protocols.js` | Idem |
| `src/routes/queue.js` | Idem |
| `src/routes/referrals.js` | Idem |
| `src/routes/supplies.js` | Idem |

### Appointments (média prioridade)

| Arquivo | Mudança necessária |
|---------|-------------------|
| `src/routes/agenda.js` (create) | Setar `executing_unit_id = req.user.unitId` e `executing_team_id = req.user.teamId` ao criar appointment |

### Admin/bootstrap (baixa prioridade)

| Arquivo | Mudança necessária |
|---------|-------------------|
| `src/routes/admin.js` | Validar municipalityId no bootstrap de units |
| `scripts/seed-dev-scenario.mjs` | Adicionar unit e municipality bootstrap ao dev seed |

---

## Seção 7 — Migração e Bootstrap

### Não precisa de nova migration

- Schema completo já existe (migrations 004, 009, 010, 011)
- Todos os pacientes/usuários existentes têm `municipality_id = '3534401'` (padrão migration 010)
- `app_units` e o bootstrap endpoint já existem

### Precisa para Sprint 5

1. **Dev seed**: adicionar bootstrap de unit e municipality no `seed-dev-scenario.mjs`
2. **Bootstrap municipal**: validar que `POST /admin/units/bootstrap` seta `municipalityId` corretamente a partir do user token
3. **unit-default para dados existentes**: lógica de migração de `team-rosa`/`team-azul` para `unit_id` quando múltiplas UBS existirem

---

## Seção 8 — Testes Necessários (Sprint 5)

| Teste | Tipo | Arquivo alvo | Status atual |
|-------|------|-------------|-------------|
| canAccessPatient cross-UBS read PASS | Unit | `utils/patients.test.js` | ✅ Existe (linha 42-60) |
| canAccessPatient cross-município BLOCK | Unit | `utils/patients.test.js` | ✅ Existe (linha 56-60) |
| Gestor unit-scoped isolation | Unit | `utils/patients.test.js` | ✅ Existe |
| Multi-UBS smoke end-to-end | Integration | Novo arquivo | ❌ Não existe |
| Audit cross-UBS event emitido | Integration | Novo arquivo | ❌ Não existe |
| executing_unit_id setado no create | Integration | `agenda.test.js` | ❌ Não existe |
| Isolamento cross-município em todas as rotas | Integration | Novo arquivo | ❌ Não existe |
| Indicadores por UBS responsável vs executora | Integration | Novo arquivo | ❌ Não existe |

---

## Seção 9 — Riscos

| Risco | Probabilidade | Impacto | Mitigação atual |
|-------|--------------|---------|----------------|
| Rotas não-cobertas (agenda, lab, etc.) permitem cross-UBS sem validação | Média | Alto | UBS #1 = single-unit, não há cross-UBS real; mitigado para piloto |
| executing_unit_id vazio em novos appointments | Alta | Médio | Apenas indicadores cross-UBS afetados; não impacta operação |
| cross_team_patient_access não emitido em reads | Média | Médio | Endpoint exists mas sem dados; LGPD auditoria incompleta |
| Frontend sem UBS selector | Certa | Alto | UBS #1 = single-unit; usuário não precisa selecionar |
| Seed dev sem unit/municipality | Certa | Baixo | Dev apenas; prod usa bootstrap endpoint |

**Nenhum risco bloqueia o piloto UBS #1.** Todos são Sprint 5.

---

## Seção 10 — Modelo Alvo Recomendado (Sprint 5)

```
Municipality (tenant raiz)
  └── Unit (UBS) — FK: municipality_id
       └── Team (equipe ESF) — FK: unit_id
            └── Patient (carteira) — FK: team_id + unit_id + municipality_id
                 └── ClinicalRecord, Appointment, etc.

User — FK: team_id + unit_id + municipality_id

Access rules:
  write:  teamId match (sem exceção)
  read:   clinical roles → municipality match → cross-UBS OK
          non-clinical → teamId match
  gestor: unit-scoped (vê todas as equipes da sua unit)
  auditor: municipality-scoped (exporta audit logs do município)

Audit:
  Toda ação que envolva patientTeamId ≠ actorTeamId → cross_team_patient_access event
  Log entry com unitId do ator + unitId do paciente

Indicadores:
  Produção: agrupado por patient.unit_id (responsável)
  Atendimento externo: appointments onde executing_unit_id ≠ patient.unit_id
```

---

## Seção 11 — Plano por Fases

### Fase 0 — Agora (pré-D+14)
**NENHUMA ação técnica.** Piloto UBS #1 com single-unit é seguro.

### Fase 1 — Sprint 5A (pós-D+14 UBS #1, semana 1-2)
Prioridade: segurança e auditoria

1. Emitir `cross_team_patient_access` em `canAccessPatient` modo read cross-team
2. Capturar `user.unitId` em `addAuditLog`
3. Auditar e cobrir rotas: `agenda.js`, `lab.js`, `medical-records.js`, `pharmacy.js`, `protocols.js`, `queue.js`, `referrals.js`, `supplies.js`
4. Setar `executing_unit_id` e `executing_team_id` em create de appointments
5. Smoke multi-UBS inicial

### Fase 2 — Sprint 5B (semana 3-4)
Prioridade: frontend + indicadores

1. Frontend: UBS selector, identificação UBS do paciente, aviso cross-UBS
2. Dashboard indicadores por UBS responsável vs executora
3. Dev seed: bootstrap unit + municipality
4. Testes de integração: isolamento cross-município em todas as rotas

### Fase 3 — Sprint 5C (semana 5+)
Prioridade: onboarding multi-UBS

1. Bootstrap municipal (múltiplas units por municipality)
2. Gestão de usuários cross-unit
3. `d14-report.md` UBS #2 planning

---

## Seção 12 — Patch Mínimo Permitido

**Antes de D+14 UBS #1:** NENHUM patch autorizado para multi-UBS.

**Primeiro patch autorizado após D+14 (como CRITICAL-FIX se gap de segurança ativo):**
```javascript
// src/utils/patients.js:274 — adicionar event quando cross-UBS read ocorre
// (1 linha, sem alterar lógica de acesso)
if (user?.unitId && patient.unitId && user.unitId !== patient.unitId) {
  // caller emite audit; sem db aqui — passar como flag no retorno
}
```
> Nota: essa mudança requer acesso ao db em canAccessPatient, o que é architectural. Confirmar Sprint 5A.

---

## Seção 13 — Critérios de GO / NO-GO (Sprint 5)

### GO para deploy multi-UBS

- [ ] Smoke multi-UBS PASS (paciente UBS-A acessível por clínico UBS-B, mesmo município)
- [ ] Smoke cross-município BLOCK (403 para todos os roles)
- [ ] `cross_team_patient_access` event emitido e visível em `/audit-logs/cross-team-access`
- [ ] `executing_unit_id` setado em 100% dos novos appointments (verificar no DB)
- [ ] Todas as 8 rotas com GAP auditadas e cobertas (ou explicitamente dispensadas com justificativa)
- [ ] Frontend UBS selector funcional para gestor e admin
- [ ] Indicadores por UBS responsável corretos (test data: paciente UBS-A atendido por clínico UBS-B → produção contabilizada para UBS-A)
- [ ] `d14-report.md` UBS #1 assinado

### NO-GO para deploy multi-UBS

- Isolamento cross-município com falha (qualquer 200 onde 403 esperado)
- `cross_team_patient_access` event não emitido
- Rotas com GAP não auditadas
- Smoke multi-UBS com qualquer Failed > 0
- Frontend UBS selector ausente (gestor não consegue identificar sua unit)

---

## Seção 14 — Decisão Final

```
CLASSIFICAÇÃO:    POST-GO EXPANSION

DECISÃO:          ADIAR PARA POST-GO (Sprint 5, pós-D+14 UBS #1)

JUSTIFICATIVA:
  1. Schema completo já presente — nenhuma migration bloqueante
  2. canAccessPatient com lógica municipal CORRETA — piloto single-UBS seguro
  3. Piloto UBS #1 = single-unit: nenhum risco cross-UBS real
  4. Expansão = Sprint completo (frontend + backend + testes)
  5. governance-post-go-rule.md: Sprint técnica proibida antes de D+14
  6. Nenhuma UBS real selecionada ainda

O QUE NÃO FAZER:
  municipalityId. unitId enforcement em rotas. Frontend UBS selector.
  executing_unit_id no create. Multi-UBS smoke. Qualquer mudança de arquitetura.
  Nova sprint técnica. Qualquer alteração de arquivos de código.

PRÓXIMO PASSO:
  onboarding-ubs-master-checklist.md → Gate 0
  Sprint 5 abre somente após d14-report.md assinado
```

---

*Auditoria READ-ONLY — nenhum arquivo alterado*  
*Próxima revisão: antes de iniciar Sprint 5A (pós-D+14 UBS #1)*  
*Referência: governance-post-go-rule.md | final-readiness-report.md*
