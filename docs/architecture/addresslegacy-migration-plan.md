# addressLegacy Migration Plan

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Data | 2026-06-13 |
| Status | PLANEJADO — não executar antes de Sprint 5B closure |
| Responsável | Tech Lead |

---

## Situação atual

O campo `address` (string livre, max 500) foi renomeado para `addressLegacy` no schema Sprint 5A.

Ambos os nomes são aceitos via alias em `PatientBaseShape`:
- `address` → aceito como alias, mapeado internamente para `addressLegacy`
- `addressLegacy` → campo canônico atual

Pacientes existentes têm dados apenas em `addressLegacy`. Os campos estruturados (`logradouro`, `bairro`, `cep`, `numero`, `complemento`, `uf`, `municipioIbge`) foram adicionados em Sprint 5A e são preenchidos progressivamente.

## Critério para descontinuação

`addressLegacy` pode ser descontinuado quando:

1. `SELECT COUNT(*) FROM app_patients WHERE payload->>'addressLegacy' IS NOT NULL AND payload->>'logradouro' IS NULL` → 0
2. Todos os pacientes ativos têm `logradouro` preenchido (migração de dados concluída)
3. Frontend não envia mais `address` nem `addressLegacy` (usa apenas campos estruturados)

## Plano de execução (Sprint 5B ou posterior)

### Passo 1 — Auditoria (pré-execução)

```sql
-- Quantos pacientes têm apenas addressLegacy (sem campos estruturados)
SELECT COUNT(*) FROM app_patients
WHERE payload->>'addressLegacy' IS NOT NULL
  AND payload->>'logradouro' IS NULL;

-- Distribuição de preenchimento
SELECT
  (payload->>'addressLegacy' IS NOT NULL) AS has_legacy,
  (payload->>'logradouro' IS NOT NULL) AS has_structured,
  COUNT(*)
FROM app_patients
GROUP BY 1, 2;
```

### Passo 2 — Migração de dados (withDb)

Migração deve usar `withDb()` ou atualizar `app_state` diretamente, nunca apenas `app_patients` shadow table.

Script: `backend/scripts/migrate-addresslegacy.mjs` (a criar)

Lógica:
- Para cada paciente com `addressLegacy` e sem `logradouro`:
  - Parsear `addressLegacy` (string livre) para extrair componentes possíveis
  - Salvar `logradouro = addressLegacy` como fallback (preservar dado)
  - Manter `addressLegacy` até confirmação manual do gestor

### Passo 3 — Deprecação do alias no schema

Remover `address` e `addressLegacy` de `PatientBaseShape` e `PatientUpdateSchema` em `schemas.js`.

Verificar que frontend não envia mais esses campos (`.strict()` rejeitará se enviado).

### Passo 4 — Smoke de validação

```bash
# Verificar que PATCH com address retorna 400 (campo desconhecido rejeitado por .strict())
curl -X PATCH /patients/:id -d '{"address":"Rua X"}' → esperado: 400
# Verificar que dados estruturados estão presentes
GET /patients/:id → logradouro preenchido para todos os pacientes ativos
```

## Risco

| Risco | Mitigação |
|---|---|
| Dados perdidos se alias removido antes de migração | Executar auditoria (Passo 1) primeiro — COUNT deve ser 0 |
| Dados de endereço ambíguos (string livre não parseável) | Salvar como `logradouro` verbatim — preserva dado, sem perda |
| Regressão frontend enviando `address` | Smoke PATCH com `address` → 400 confirma rejeição |

## Decisão de sprint

Sem data de execução definida. A ser agendado após:
- Confirmação com gestores UBS de que todos os pacientes têm endereço estruturado
- Aprovação do Tech Lead e QA Senior
- Execução em staging com COUNT pré=pós confirmado
