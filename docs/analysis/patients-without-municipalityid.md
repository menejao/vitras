# Análise: Pacientes Sem municipalityId

**Criado em:** 2026-05-28
**Responsável:** João Pedro + DBA
**Contexto:** Pré-requisito de validação antes de merge de US-204 para `release/pilot-baseline`
**Status:** PENDENTE — queries não executadas (staging congelado em d91c9cd)

---

## 1. Contexto do Risco

### Por que o campo importa

Desde a Fase 1 (migration 010, US-101/102), pacientes novos são cadastrados com `municipalityId` no JSONB `app_state.patients[]` e na shadow table `app_patients.municipality_id`. O campo é o boundary absoluto da lógica cross-UBS que será implementada em US-204.

### Onde o risco se manifesta

A função `canAccessPatient` em modo `read` (ADR-002) contém o seguinte fallback de segurança:

```js
// Fallback seguro: se paciente nao tem municipalityId, exige teamId match
if (!patientMunicipality) {
  return String(patient.teamId || "") === String(user?.teamId || "");
}
```

Isso significa: **pacientes sem `municipalityId` no JSONB são tratados como se pertencessem exclusivamente à equipe de origem**. Um médico de outra UBS do mesmo município que tente ler o prontuário desse paciente receberá 403 — mesmo que o comportamento esperado pós-US-204 seja permitir o acesso.

### Por que o JSONB pode ter registros sem o campo

O backfill da Fase 1 foi aplicado na shadow table `app_patients` via `syncShadowTables`, mas o JSONB `app_state` armazena snapshots históricos dos objetos de paciente. Dependendo do momento de cadastro versus aplicação da migration, os objetos no JSONB podem não ter sido regenerados com o campo. Pacientes cadastrados antes da migration 010 e cujo objeto JSONB não foi sobrescrito por uma escrita posterior são os candidatos principais.

---

## 2. Queries Propostas

Estas queries devem ser executadas no banco de staging (nunca em produção sem janela de manutenção aprovada) **antes do merge de US-204**.

### 2.1 Shadow table `app_patients`

```sql
-- Verificar pacientes sem municipality_id em app_patients (shadow table)
SELECT count(*) FROM app_patients WHERE municipality_id IS NULL OR municipality_id = '';
```

Resultado esperado (baseline saudável): `0`

Se `count > 0`: executar backfill complementar na shadow table antes de US-204.

### 2.2 JSONB `app_state`

```sql
-- Verificar pacientes sem municipality_id no JSONB app_state
SELECT count(*) FROM app_state
WHERE (jsonb -> 'patients') IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(jsonb -> 'patients') p
  WHERE p->>'municipalityId' IS NOT NULL AND p->>'municipalityId' != ''
);
```

**Atenção:** Esta query conta linhas de `app_state` onde o array `patients` existe mas NENHUM dos pacientes no array tem `municipalityId` preenchido. Deve ser complementada com uma versão que conta pacientes individuais:

```sql
-- Contar pacientes individuais sem municipalityId no JSONB
SELECT count(*) FROM (
  SELECT jsonb_array_elements(jsonb -> 'patients') AS p
  FROM app_state
  WHERE (jsonb -> 'patients') IS NOT NULL
) sub
WHERE sub.p->>'municipalityId' IS NULL OR sub.p->>'municipalityId' = '';
```

Resultado esperado (baseline saudável): `0`

Se `count > 0`: os pacientes identificados devem ser backfillados antes de ativar cross-UBS.

---

## 3. Impacto Operacional no Cross-UBS

### Cenário sem correção (count > 0 no JSONB)

Quando US-204 for deployed e `canAccessPatient` receber `mode: "read"`:

1. Médico da UBS-B tenta acessar prontuário de paciente cadastrado na UBS-A antes da Fase 1
2. `getPatientOrError` chama `canAccessPatient(user, patient, "read")`
3. `patient.municipalityId` está ausente no objeto JSONB
4. Fallback de segurança ativa: exige `teamId` match
5. `user.teamId` (UBS-B) !== `patient.teamId` (UBS-A)
6. Resultado: **403 Forbidden** — falha silenciosa para o usuário

O profissional de saúde não recebe mensagem explicativa sobre o motivo do bloqueio. Do ponto de vista clínico, o paciente "existe mas não pode ser acessado" — risco de continuidade do cuidado interrompida sem sinalização adequada.

### Quais roles são afetados

Somente os roles em `CLINICAL_READ_ROLES` sofrem impacto: `doctor`, `nurse_manager`, `dentist`, `nursing_tech`. Roles que já eram bloqueados cross-UBS (`acs`, `receptionist`, `pharmacist`) não sofrem mudança de comportamento.

### Estimativa de exposição

No ambiente de piloto (UBS-001), todos os pacientes cadastrados após a aplicação de migration 010 têm `municipalityId`. Pacientes cadastrados antes — se houver — são o universo de risco. A query de verificação quantifica exatamente esse universo.

---

## 4. Estratégia Caso count > 0

### Opção A — Backfill complementar antes de US-204 em staging

Executar um script de backfill que:
1. Lê todos os objetos de paciente no JSONB `app_state` onde `municipalityId` está ausente
2. Consulta o `teamId` do paciente na shadow table `app_patients` para mapear ao `municipality_id` correto
3. Atualiza o JSONB com o campo preenchido (operação de escrita controlada, reversível via snapshot)

Pré-requisito: snapshot RDS registrado em `docs/baseline/pre-sprint5-snapshot-registry.md` deve estar `available` antes de executar o backfill.

Vantagem: cross-UBS funciona para 100% dos pacientes desde o primeiro dia de US-204.
Risco: operação de escrita em JSONB exige validação cuidadosa de ponteiros e não pode ser feita em produção sem janela de manutenção.

### Opção B — Aceitar como known limitation documentada para piloto

Documentar que pacientes sem `municipalityId` no JSONB continuam com comportamento legado (teamId match) mesmo após US-204. Registrar como known limitation com critério de aceite: count de pacientes afetados deve ser zero em produção antes de habilitar cross-UBS para usuários reais.

Vantagem: zero risco de regressão no deploy de US-204; nenhuma operação de escrita adicional necessária.
Risco: se count > 0 em produção, médicos de UBS-B receberão 403 inesperado para esses pacientes específicos — sem aviso claro.

### Recomendação

**Opção B para o piloto, com gate formal antes de go-live com pacientes reais.**

Justificativa: o piloto UBS-001 é um ambiente controlado com volume reduzido de pacientes. A probabilidade de count > 0 é baixa dado que o backfill da shadow table foi aplicado. Se as queries confirmarem count = 0, nenhuma ação adicional é necessária. Se count > 0 em staging, executar Opção A em staging antes do merge de US-204; se count > 0 em produção, incluir janela de backfill como pré-condição do gate 3 (live com pacientes reais), não como bloqueador de US-204 em staging.

Este critério é consistente com o gate definido em `docs/baseline/pre-sprint5-snapshot-registry.md`: nenhum PR de Sprint 5 mergea para `release/pilot-baseline` sem snapshot disponível.

---

## 5. Quando Executar a Query

As queries desta análise devem ser executadas:

1. **Antes do merge de US-204 para `release/pilot-baseline`** — confirmação de que o ambiente de staging está limpo
2. **Antes de gate 3 (go-live com pacientes reais)** — confirmação de que produção está limpa
3. **Após qualquer backfill ou migration que altere dados de paciente** — verificação de integridade

As queries são read-only e podem ser executadas em produção durante horário comercial normal, desde que o ambiente não esteja em janela de freeze.

**O ambiente está atualmente congelado em `d91c9cd` (tag `v1.0-pilot-governed`). As queries só devem ser executadas quando Sprint 5 for autorizada a iniciar.**

---

## 6. Responsável

- **Execução das queries:** João Pedro + DBA
- **Decisão sobre backfill:** Tech Lead + João Pedro
- **Registro dos resultados:** Atualizar esta análise com os counts reais após execução
- **Gate formal:** incluir resultado nesta análise como evidência antes do merge de US-204

---

## Referências

- `docs/adr/ADR-002-canAccessPatient-read-write.md` — decisão de arquitetura que define o fallback de segurança
- `docs/baseline/pre-sprint5-snapshot-registry.md` — registro do snapshot RDS pré-Sprint 5
- `docs/rollout/ubs-001/rollback-plan.md` — plano de rollback caso backfill cause regressão
- ADR-002 Risco R1 — documenta este mesmo cenário na perspectiva da implementação
