# PRD: Municipal Multi-UBS Architecture — VITRAS (Osasco 36 UBS)

**Status:** Draft v1.0  
**Data:** 2026-05-27  
**Escopo:** Roadmap completo Fase 0–3, prioridade Fase 2  
**Implementação:** Mix AI (draft/patch) + revisão humana obrigatória  
**Município piloto:** Osasco — IBGE `3534401`

---

## 1. Introdução / Visão Geral

O VITRAS nasceu como sistema isolado por equipe (`teamId` como boundary absoluto). Para atender a operação municipal pública de Osasco, ele precisa evoluir para uma plataforma multi-UBS segura, onde:

- o **município é o tenant absoluto** (boundary de isolamento de dados);
- a **UBS é a unidade operacional** (segregação de dashboards, filas, agenda, farmácia);
- a **equipe é o microcontexto clínico** dentro da UBS;
- o **paciente tem identidade municipal única** (não duplicado entre UBS);
- o **prontuário é longitudinal** (histórico clínico segue o paciente em qualquer UBS do município);
- os **indicadores e-SUS** separam equipe de referência da equipe executora.

O piloto ocorre em 1 UBS. Sucesso permite expansão para 36 UBS em Osasco.

---

## 2. Objetivos

- Eliminar vazamento de dados entre municípios (boundary `municipalityId` absoluto)
- Habilitar atendimento cross-UBS com registro correto de `executingUnitId`/`executingTeamId`
- Garantir prontuário clínico longitudinal municipal (mesmo paciente, qualquer UBS do município)
- Segregar operação por UBS: dashboards, filas, agenda, farmácia
- Produzir indicadores e-SUS corretos com separação referência/executor
- Suportar expansão para 36 UBS × 5 equipes × 500 pacientes/equipe
- Manter P95 de escrita < 200ms sob carga total
- Zero duplicação de paciente municipal
- Auditabilidade completa de acessos cross-UBS
- Rollback seguro em qualquer fase

---

## 3. User Stories

### Fase 0: Baseline Congelada (Piloto 1 UBS)

#### US-000: Freeze da baseline do piloto
**Descrição:** Como operador de deploy, quero garantir que a baseline do piloto está congelada e documentada antes de qualquer mudança estrutural, para poder fazer rollback se necessário.

**Critérios de Aceite:**
- [ ] Branch `release/pilot-baseline` criada e protegida
- [ ] Migrations 001–011 aplicadas e idempotentes no ambiente de piloto
- [ ] `ENABLE_DEFAULT_USERS=false` e `SEED_DEMO_DATA=false` em produção
- [ ] Smoke test `/readyz` retorna 200 no ambiente de piloto
- [ ] Backup RDS verificado antes de qualquer deploy da Fase 1+
- [ ] ADR-001 documentado: decisão de congelar baseline

---

### Fase 1: Infraestrutura Municipal Estrutural (CONCLUÍDA)

> Fase 1 já implementada em `release/pilot-baseline` (commits `03d4821`, `8ad93c0`). User stories abaixo documentam o que foi feito para rastreabilidade.

#### US-101: `unit_id` em pacientes (migration 009) ✓
**Descrição:** Como sistema, preciso que cada paciente tenha `unit_id` na shadow table para filtros por UBS sem varrer o JSONB.

**Status:** IMPLEMENTADO — migration 009, `app_patients.unit_id`, backfill via `app_state.teams[].unitId`.

#### US-102: `municipality_id` em todas as tabelas de shadow (migration 010) ✓
**Descrição:** Como sistema, preciso que `municipality_id` exista em `app_units`, `app_patients`, `app_users`, `app_audit_logs` para suportar isolamento municipal em queries SQL.

**Status:** IMPLEMENTADO — migration 010, backfill com `'3534401'` (Osasco).

#### US-103: `executing_team_id` / `executing_unit_id` em atendimentos (migration 011) ✓
**Descrição:** Como gerador de indicadores e-SUS, preciso registrar qual equipe e UBS executaram o atendimento, separado da equipe de referência do paciente.

**Status:** IMPLEMENTADO — migration 011, `app_appointments.executing_team_id`, `executing_unit_id`.

#### US-104: JWT carrega `unitId` e `municipalityId` ✓
**Descrição:** Como middleware de autorização, preciso que o token JWT contenha `unitId` e `municipalityId` do usuário para tomar decisões de acesso sem roundtrip ao banco.

**Status:** IMPLEMENTADO — `tokens.js`, `domain.js`.

#### US-105: `syncShadowTables` propaga novos campos ✓
**Descrição:** Como processo de sync, preciso que `municipality_id` seja gravado em `app_units` e que `upsertBreakGlassUser` propague `unitId`/`municipalityId`.

**Status:** IMPLEMENTADO — `db.js` (cascade fallback), `seed-demo.js` (ambos caminhos).

---

### Fase 2: Prontuário Longitudinal e Operação Cross-UBS (PRIORIDADE)

#### US-201: Leitura longitudinal do prontuário clínico
**Descrição:** Como médico ou enfermeira, quero acessar o prontuário completo de um paciente independente de qual UBS ele foi atendido antes, para garantir continuidade do cuidado.

**Critérios de Aceite:**
- [ ] `canAccessPatient` para leitura: aceita match de `municipalityId` (não apenas `teamId`)
- [ ] Escrita/edição de prontuário: continua exigindo `teamId` da equipe responsável ou `executingTeamId` no atendimento atual
- [ ] Médico, enfermeira, dentista, técnico, break_glass_admin podem ler prontuário cross-UBS no mesmo município
- [ ] ACS pode ver dados básicos do paciente (nome, contato, microárea) mas não prontuário completo cross-UBS
- [ ] Recepcionista pode confirmar existência do paciente e dados de contato, sem acesso clínico
- [ ] Cada acesso cross-UBS (leitura de paciente fora da `primaryUnitId`) gera entrada em `app_audit_logs` com `action: "cross_ubs_read"`, `severity: "info"`, `details.patientUnitId`, `details.accessorUnitId`
- [ ] Sem regressão nos testes de isolamento `teamId` para escrita
- [ ] ADR-002 documentado: decisão de separar acesso de leitura vs. escrita

#### US-202: Busca municipal de paciente por CPF/CNS
**Descrição:** Como recepcionista ou clínico, quero buscar um paciente pelo CPF ou CNS e encontrá-lo mesmo que ele seja de outra UBS do mesmo município, para evitar recadastro duplicado.

**Critérios de Aceite:**
- [ ] Endpoint `GET /api/patients/municipal-search?cpf=:hash` (ou `cns=:hash`) adicionado
- [ ] Retorna paciente se `cpf_hash` ou `cns_hash` match dentro do mesmo `municipality_id` do usuário autenticado
- [ ] Cross-município: retorna 404 (nunca vaza paciente de outro município)
- [ ] Resultado inclui `primaryUnitId`, `primaryTeamId`, `name`, `birthDate`, `id` — sem CPF/CNS em plaintext na resposta
- [ ] Role guard: médico, enfermeira, dentista, técnico, recepcionista, break_glass_admin podem usar o endpoint; ACS retorna 403
- [ ] Cada busca auditada: `action: "municipal_patient_search"`, `outcome: "found"` ou `"not_found"`, `severity: "info"`
- [ ] Rate limit específico para o endpoint (max 30 buscas/minuto por usuário)
- [ ] Typecheck e lint passam

#### US-203: Transferência auditada de paciente entre equipes/UBS
**Descrição:** Como gestor ou enfermeira-chefe, quero transferir a responsabilidade de um paciente para outra equipe ou UBS dentro do município, com trilha de auditoria completa.

**Critérios de Aceite:**
- [ ] Endpoint `POST /api/patients/:id/transfer` com body `{ targetTeamId, targetUnitId, reason }`
- [ ] Apenas `nurse_manager` da equipe atual e `break_glass_admin` podem executar transferência
- [ ] Transferência atualiza `primaryTeamId`, `primaryUnitId` no paciente (JSONB + shadow table)
- [ ] Campos imutáveis após transferência: `id`, `municipalityId`, `cpf`, `cns`, histórico clínico
- [ ] Entrada de auditoria: `action: "patient_transfer"`, `severity: "high"`, `before: { teamId, unitId }`, `after: { teamId, unitId }`, `details.reason`
- [ ] Não é possível transferir para equipe de outro município (validação backend)
- [ ] Histórico de transferências acessível via audit log do paciente
- [ ] Typecheck e lint passam

#### US-204: `canAccessPatient` com semântica municipal completa
**Descrição:** Como função de controle de acesso, preciso implementar a nova regra: leitura clínica = mesmo município; escrita operacional = mesma equipe ou equipe executora atual.

**Critérios de Aceite:**
- [ ] `canAccessPatient(user, patient, mode)` aceita `mode: "read" | "write"`
- [ ] `mode: "read"`: retorna `true` se `user.municipalityId === patient.municipalityId` E role clínico (médico, enfermeira, dentista, técnico, break_glass_admin)
- [ ] `mode: "write"`: retorna `true` se `user.teamId === patient.primaryTeamId` OU `user.teamId === currentAppointment.executingTeamId`; break_glass_admin sempre true
- [ ] Roles não-clínicos (ACS, recepcionista) continuam com acesso restrito (apenas dados básicos em read)
- [ ] Todos os endpoints em `patients.js` passam `mode` correto
- [ ] Testes unitários para todos os casos: read-same-team, read-cross-UBS, read-cross-municipality (403), write-same-team, write-cross-team (403), break_glass override
- [ ] Typecheck passa

#### US-205: Farmácia segregada por `unitId`
**Descrição:** Como farmacêutico, quero que o estoque e os logs de farmácia sejam segregados por UBS (`unitId`), não por equipe, pois a farmácia é um recurso da UBS.

**Critérios de Aceite:**
- [ ] `pharmacyStock` e `pharmacyLogs` incluem `unitId` nos novos registros
- [ ] Endpoints de farmácia filtram por `user.unitId` (não `user.teamId`)
- [ ] Dados históricos sem `unitId` recebem `unitId` da equipe do criador via backfill best-effort
- [ ] Gestor municipal (role `gestor`) pode ver estoque consolidado de todas as UBS do município
- [ ] Typecheck e lint passam

#### US-206: Dashboards, fila e agenda segregados por `unitId`
**Descrição:** Como enfermeira ou recepcionista, quero que minha visão de fila, agenda e dashboard mostre apenas os dados da minha UBS, mesmo que eu possa ler prontuários de pacientes de outras UBS.

**Critérios de Aceite:**
- [ ] `queueEntries` filtrados por `executingUnitId === user.unitId` (não `teamId`)
- [ ] `agendaEntries` filtrados por `executingUnitId === user.unitId`
- [ ] Dashboard clínico: indicadores calculados usando `executingUnitId` para separar responsabilidade
- [ ] Gestor municipal pode ver dashboards agregados por UBS
- [ ] Sem regressão em funcionalidades de fila/agenda existentes
- [ ] Typecheck e lint passam

#### US-207: Indicadores e-SUS com separação referência/executor
**Descrição:** Como gerador de relatório e-SUS, quero que os indicadores calculados por paciente distingam a equipe de referência (cadastro/responsabilidade) da equipe executora (quem realizou o atendimento), para repasse financeiro correto.

**Critérios de Aceite:**
- [ ] `appointments.executingTeamId` e `executingUnitId` já persistidos (Fase 1 ✓)
- [ ] Relatório de produtividade agrega por `executingTeamId` (quem atendeu)
- [ ] Relatório de cadastro/vínculo agrega por `patient.primaryTeamId` (equipe de referência)
- [ ] Endpoint `/api/reports/esus-productivity` retorna dados segregados por executor
- [ ] Endpoint `/api/reports/esus-enrollment` retorna dados segregados por referência
- [ ] Acesso restrito a `nurse_manager`, `gestor`, `break_glass_admin`
- [ ] Documentação do schema de saída de cada endpoint
- [ ] Typecheck e lint passam

#### US-208: Auditoria completa de acessos cross-UBS
**Descrição:** Como auditor de segurança, quero que todos os acessos a dados de pacientes fora da UBS primária sejam registrados com contexto suficiente para investigação de incidentes.

**Critérios de Aceite:**
- [ ] Todo acesso a paciente com `patient.primaryUnitId !== user.unitId` gera log de auditoria
- [ ] Log contém: `action`, `userId`, `userUnitId`, `patientId`, `patientPrimaryUnitId`, `municipalityId`, `outcome`, `timestamp`
- [ ] `app_audit_logs.municipality_id` preenchido em 100% dos novos registros
- [ ] Endpoint `/api/admin/audit-logs` suporta filtro `crossUbsOnly=true`
- [ ] Retenção de logs: mínimo 5 anos (sem delete automático)
- [ ] Typecheck e lint passam

---

### Fase 3: Escalabilidade 36 UBS (FUTURO)

#### US-301: Shadow tables para `queueEntries`
**Descrição:** Como banco de dados, preciso de shadow table relacional para `queueEntries` para eliminar varredura de JSONB em queries de fila com 36 UBS ativas.

**Critérios de Aceite:**
- [ ] Migration `012_create_app_queue_entries`: `id, unit_id, team_id, patient_id, status, created_at, payload`
- [ ] `syncShadowTables` popula `app_queue_entries` com cascade fallback
- [ ] Endpoints de fila usam shadow table quando em modo Postgres
- [ ] Backfill de dados históricos
- [ ] ADR-003 documentado: decisão de shadow table vs. JSONB para fila

#### US-302: Shadow tables para `agendaEntries`
**Descrição:** Como banco de dados, preciso de shadow table relacional para `agendaEntries`.

**Critérios de Aceite:**
- [ ] Migration `013_create_app_agenda_entries`: `id, unit_id, team_id, patient_id, scheduled_date, status, created_at, payload`
- [ ] `syncShadowTables` popula `app_agenda_entries` com cascade fallback
- [ ] Endpoints de agenda usam shadow table quando em modo Postgres
- [ ] Backfill de dados históricos

#### US-303: Avaliação e plano de aposentadoria do `app_state` JSONB monolítico
**Descrição:** Como arquiteto, quero avaliar se o `app_state` JSONB pode ser removido como source-of-truth quando todas as entidades tiverem shadow tables, para eliminar o lock serial que bloqueia writes paralelos.

**Critérios de Aceite:**
- [ ] Relatório de cobertura: quais entidades têm shadow tables completas vs. JSONB-only
- [ ] Prova de conceito: write direto em shadow tables (sem passar por `app_state`) para 1 entidade (appointments)
- [ ] Benchmark: comparar latência write com JSONB vs. relacional direto
- [ ] ADR-004 documentado: decisão go/no-go de remover `app_state`
- [ ] Se go: migration plan com janela de manutenção e rollback
- [ ] Se no-go: justificativa e plano de mitigação do lock

#### US-304: Teste de carga 36 UBS
**Descrição:** Como operador, quero validar que o sistema suporta carga total antes de expandir para 36 UBS.

**Critérios de Aceite:**
- [ ] Script de carga simula 36 UBS × 5 equipes × 500 pacientes = 90.000 pacientes
- [ ] Cenário: 180 usuários simultâneos (5/UBS) fazendo reads/writes mistos
- [ ] P95 escrita < 200ms medido via CloudWatch
- [ ] P95 leitura < 100ms
- [ ] Zero deadlocks durante 30 minutos de carga
- [ ] Zero vazamento cross-município detectado nos logs
- [ ] Relatório de carga publicado antes de qualquer deploy para UBS 2+

---

## 4. Requisitos Funcionais

### Controle de Acesso
- **FR-1:** `municipalityId` do usuário deve corresponder ao `municipalityId` do paciente para qualquer acesso (leitura ou escrita). Acesso cross-município retorna 403.
- **FR-2:** Leitura clínica cross-UBS (dentro do município) permitida para roles: `doctor`, `nurse_manager`, `dentist`, `nursing_tech`, `break_glass_admin`.
- **FR-3:** Escrita operacional (criar/editar atendimento, alterar prontuário) requer `user.teamId === patient.primaryTeamId` ou `user.teamId === executingTeamId` do atendimento atual.
- **FR-4:** ACS pode localizar paciente por nome/microárea no município, mas não acessar prontuário clínico de paciente de outra equipe.
- **FR-5:** Recepcionista pode buscar e confirmar identidade do paciente (nome, contato, UBS), sem acesso a dados clínicos.
- **FR-6:** `break_glass_admin` tem acesso total de leitura e escrita em todo o município, auditado por default.

### Identidade do Paciente
- **FR-7:** CPF e CNS são únicos por `municipalityId`. Sistema deve rejeitar cadastro de paciente com CPF/CNS já existente no mesmo município.
- **FR-8:** Paciente tem `primaryTeamId` e `primaryUnitId` que representam vínculo de referência atual.
- **FR-9:** `municipalityId` do paciente é imutável após cadastro.
- **FR-10:** `id` do paciente é imutável.

### Atendimento
- **FR-11:** Todo atendimento registra `executingTeamId` e `executingUnitId` (equipe/UBS que realizou o atendimento).
- **FR-12:** `executingTeamId` pode diferir de `patient.primaryTeamId` (atendimento cross-UBS).
- **FR-13:** Relatórios de produtividade e-SUS agregam por `executingTeamId`; relatórios de vínculo agregam por `primaryTeamId`.

### Segregação Operacional
- **FR-14:** Fila de atendimento filtrada por `executingUnitId` do usuário logado.
- **FR-15:** Agenda filtrada por `executingUnitId` do usuário logado.
- **FR-16:** Estoque de farmácia segregado por `unitId`.
- **FR-17:** Dashboards padrão mostram dados da UBS do usuário. Gestor municipal pode ver visão consolidada.

### Auditoria
- **FR-18:** Todo acesso cross-UBS (paciente fora da UBS primária do usuário) gera entrada em `app_audit_logs`.
- **FR-19:** `app_audit_logs.municipality_id` preenchido em 100% dos registros.
- **FR-20:** Logs de auditoria não podem ser deletados via API normal. Apenas operador com acesso direto ao banco pode fazê-lo, com aprovação dupla.

### Migrations
- **FR-21:** Todas as migrations são additive (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).
- **FR-22:** Nenhuma migration faz DROP COLUMN, DROP TABLE ou altera tipo de coluna existente.
- **FR-23:** Toda migration tem backfill seguro para dados existentes.
- **FR-24:** `syncShadowTables` usa cascade try/catch para backward compatibility com migrations não aplicadas.

---

## 5. Não-Goals (Fora de Escopo)

- **Multi-município:** Um deployment VITRAS serve exatamente 1 município. Suporte a múltiplos municípios num mesmo deploy não faz parte deste PRD.
- **SSO / federação de identidade** entre municípios.
- **Prontuário eletrônico completo (PEP):** VITRAS é sistema de gestão APS, não substitui PEP hospitalar ou RNDS.
- **Integração direta com RNDS / e-SUS Web:** exportação de dados pode ser implementada, mas integração bidirecional em tempo real está fora do escopo.
- **App mobile:** apenas web.
- **Notificações push** para profissionais.
- **Agendamento online pelo paciente** (self-scheduling).
- **Billing / faturamento:** VITRAS não processa pagamentos.
- **Multi-tenant (múltiplos municípios num banco):** cada município tem seu próprio deploy isolado.

---

## 6. Considerações Técnicas

### Modelo de Dados

```
municipalityId (imutável, boundary absoluto)
  → unitId (UBS)
    → teamId (equipe/microárea)
      → patient.primaryTeamId

Paciente:
  id (UUID, imutável)
  municipalityId (imutável)
  primaryUnitId  (mutável por transferência auditada)
  primaryTeamId  (mutável por transferência auditada)

Atendimento:
  executingTeamId (quem atendeu)
  executingUnitId (onde atendeu)
  patientId → patient.primaryTeamId (referência)
```

### Isolamento em `canAccessPatient`

```js
// Fase 2 target
function canAccessPatient(user, patient, mode = "write") {
  if (!patient) return false;
  if (canonicalRole(user?.role) === "break_glass_admin") return true;

  // boundary absoluto: município
  if (String(patient.municipalityId) !== String(user?.municipalityId)) return false;

  if (mode === "read") {
    return CLINICAL_ROLES.includes(canonicalRole(user?.role));
  }

  // write: requer equipe de referência ou equipe executora atual
  return String(patient.primaryTeamId) === String(user?.teamId);
}
```

### Dual-write Strategy (Fase 2 → Fase 3)

- `app_state` permanece source-of-truth em Fase 1–2
- Shadow tables recebem writes via `syncShadowTables` após cada `withDb()`
- Reads já usam shadow tables para queries indexadas (patients, users, appointments, audit_logs)
- Fase 3: avaliar se `queueEntries` e `agendaEntries` podem ser migrados para write-first nas shadow tables

### Lock Serial do `app_state`

O `withDb()` usa `SELECT ... FOR UPDATE` no row único de `app_state`, serializando todos os writes. Com 36 UBS × 5 equipes este será o gargalo principal. Mitigação progressiva:

1. **Fase 2:** Observabilidade — medir P95 de `withDb()` em carga de piloto
2. **Fase 3:** Se P95 > 150ms → implementar particionamento por `municipalityId` do `app_state` OU migrar entidades críticas para write direto em shadow tables

### Segurança

- `municipalityId` deriva do JWT do usuário (não do payload da requisição)
- Busca municipal por CPF/CNS usa `cpf_hash`/`cns_hash` (HMAC-SHA256) — CPF nunca trafega em plaintext em queries
- Cross-municipality check feito no backend antes de qualquer acesso a dados
- Rate limit específico em endpoints de busca municipal

### Rollback

Toda migration é additive — rollback = redeployar versão anterior sem necessidade de `down()`.  
Antes de cada migration batch de Fase 2+: snapshot RDS obrigatório.

---

## 7. Requisitos Não-Funcionais

| Requisito | Target | Medição |
|-----------|--------|---------|
| P95 escrita | < 200ms | CloudWatch `db_write_duration_ms` |
| P95 leitura | < 100ms | CloudWatch |
| Disponibilidade | > 99.5% | EB health check `/readyz` |
| Zero deadlock | 0 em 30min carga | CloudWatch `deadlock_retry` metric |
| Zero vazamento cross-município | 0 | Testes + audit log review |
| Duplicação de paciente municipal | 0 | Unique index `cpf_hash + municipality_id` |
| Retenção de audit log | ≥ 5 anos | RDS backup policy |
| Rollback time | < 15min | Runbook testado |
| Backup antes de schema change | Obrigatório | Checklist de deploy |

---

## 8. Fluxo de Implementação (Governança)

Cada US de Fase 2 segue o fluxo:

```
1. QA Senior AI  → auditoria READ-ONLY (pré-patch)
2. Tech Lead AI  → implementação do patch
3. Revisão Humana → obrigatória para:
   - mudanças em canAccessPatient
   - novas migrations
   - novos endpoints de autorização
   - mudanças em syncShadowTables
4. QA Senior AI  → reauditoria pós-patch
5. Deploy        → controlado e manual pelo operador humano
```

ADRs obrigatórios antes de implementar:
- **ADR-001:** Congelamento baseline piloto (Fase 0)
- **ADR-002:** Separação read/write em `canAccessPatient` (US-204)
- **ADR-003:** Shadow tables para fila/agenda (US-301, US-302)
- **ADR-004:** Go/no-go remoção `app_state` (US-303)

---

## 9. Métricas de Sucesso

### Piloto (1 UBS)
- [ ] Nenhum paciente duplicado no período de piloto
- [ ] 100% dos atendimentos com `executingTeamId` e `executingUnitId` preenchidos
- [ ] Zero incidentes de acesso cross-município
- [ ] Rollback testado e documentado
- [ ] P95 escrita < 200ms em carga real

### Expansão Municipal (36 UBS)
- [ ] Sistema suporta 36 UBS × 5 equipes × 500 pacientes = 90.000 pacientes
- [ ] P95 escrita < 200ms com 180 usuários simultâneos
- [ ] Zero deadlocks em 30 minutos de carga
- [ ] Indicadores e-SUS auditados e aprovados pela Secretaria de Saúde
- [ ] Auditoria cross-UBS operacional e acessível ao DPO

---

## 10. Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Lock serial `app_state` com 36 UBS | Alto | Alto | Observabilidade Fase 2; shadow table write Fase 3 |
| Repasse financeiro e-SUS incorreto | Crítico | Médio | US-207: separar agregações referência/executor antes de go-live |
| Fragmentação de prontuário | Alto | Médio | US-201: longitudinal antes de habilitar cross-UBS |
| Incidente LGPD (vazamento cross-município) | Crítico | Baixo | FR-1: boundary municipalityId; FR-18: auditoria; testes obrigatórios |
| Duplicação de paciente | Alto | Médio | FR-7: unique index `cpf_hash + municipality_id` |
| Deadlock operacional write concorrente | Alto | Médio | `WITHDB_MAX_RETRIES=3`; observabilidade; Fase 3 particionamento |
| Indisponibilidade durante migration | Alto | Baixo | Migrations additive; sem downtime; rollback < 15min |
| Corrupção de dados clínicos | Crítico | Muito Baixo | Migrations never DROP; backup obrigatório; revisão humana |

---

## 11. Questões Abertas

1. **Gestão de `unitId` para usuários administrativos:** Usuários `gestor` e `security_auditor` têm escopo municipal (sem `unitId` fixo). Como representar isso no JWT sem quebrar as guards de `unitId`? Opções: `unitId: "municipal"` sentinela, ou array de `allowedUnitIds`.

2. **ACS e busca municipal:** ACS pode localizar paciente no município para visita domiciliar, mas não acessar prontuário. O limite exato de campos visíveis para ACS cross-UBS precisa ser validado com a coordenação da UBS piloto.

3. **Conflito de `primaryTeamId` após transferência:** Se paciente tem agendamento futuro na UBS de origem no momento da transferência, o que acontece? Cancelar? Manter? Notificar? (Impacto em US-203)

4. **`pharmacyStock` por `unitId` vs. por `teamId`:** Equipes dentro de uma mesma UBS compartilham o estoque da farmácia? Ou cada equipe tem seu sub-estoque? Requer decisão da coordenação antes de US-205.

5. **Remoção do `app_state` (Fase 3):** A decisão de go/no-go depende de benchmarks que só existirão após o piloto com carga real. ADR-004 deve ser escrito apenas após US-304.

---

## Apêndice: Estado Atual das Migrations

| Migration | Descrição | Status |
|-----------|-----------|--------|
| 001 | Schema inicial | ✓ Aplicada |
| 002 | refresh tokens | ✓ Aplicada |
| 003 | audit logs | ✓ Aplicada |
| 004 | app_units shadow | ✓ Aplicada |
| 005 | role permissions | ✓ Aplicada |
| 006 | cpf_hash / cns_hash | ✓ Aplicada |
| 007 | app_users.unit_id | ✓ Aplicada |
| 008 | council fields | ✓ Aplicada |
| 009 | app_patients.unit_id | ✓ Aplicada (Fase 1) |
| 010 | municipality_id (4 tabelas) | ✓ Aplicada (Fase 1) |
| 011 | executing_team_id/unit_id | ✓ Aplicada (Fase 1) |
| 012 | app_queue_entries shadow | Fase 3 |
| 013 | app_agenda_entries shadow | Fase 3 |
