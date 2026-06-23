# UI-HOMO-01 — Import Homologation Center

**Emitido em:** 2026-06-23  
**Status:** PASS  
**Depende de:** UI-STG-01 (PASS)  
**Encerra:** camada operacional da arquitetura ARCH-INT-01  
**Autoriza conceitualmente:** MIG-01 (bloqueado até TECH-SCALE-01A)  
**Escopo:** Processo formal de decisão GO/NO GO entre Staging e Produção

---

## GOV-01

| # | Critério | Resultado |
|---|---|---|
| 1 | Tela de decisão GO/NO GO | **SIM** |
| 2 | Resumo executivo para decisão | **SIM** |
| 3 | Comparação de impacto esperado | **SIM** |
| 4 | Exibição de riscos | **SIM** |
| 5 | Workflow de aprovação | **SIM** |
| 6 | Workflow de rejeição | **SIM** |
| 7 | Justificativa obrigatória | **SIM** |
| 8 | Trilha de auditoria | **SIM** |
| 9 | Segregação RBAC | **SIM** |
| 10 | Bloqueio de commit sem homologação | **SIM** |

---

## Princípios de design

| Princípio | Descrição |
|---|---|
| **Decisão única e irreversível** | GO e NO GO são mutuamente exclusivos. Nenhuma reversão após GO. NO GO permite nova tentativa com novo Import Job. |
| **Responsabilidade nominal** | Toda decisão registra nome, role, timestamp e justificativa. Sem decisão anônima. |
| **Bloqueio sistêmico antes da decisão** | Sistema verifica pré-condições antes de exibir os botões GO/NO GO. Não existe GO possível com blocking rules ativas. |
| **Commit Gate estrito** | Commit em produção somente depois de GO registrado e assinado. Nenhum caminho alternativo. |
| **Separação de poderes** | Quem cria Import Job não aprova homologação. Quem aprova não pode ser o mesmo que executou o staging. |

---

## FASE 1 — Painel executivo

### Rota

```
/homologation/:importJobId
```

### Acesso

Somente `support_admin` e `break_glass_admin`.

Rota não existe para outros roles — retorna 403.

### Cabeçalho da decisão

```
┌───────────────────────────────────────────────────────────────────────┐
│  HOMOLOGAÇÃO DE IMPORTAÇÃO                                            │
│                                                                       │
│  Job:           abc12345-...                                          │
│  UBS:           UBS Jardim das Flores — CNES 1234567                  │
│  Source Profile: sp-pec-aps-v01 (CERTIFIED)                          │
│  Mapping:        MAP-PEC-01-v1                                        │
│  PEC Versão:     5.3                                                  │
│  Status:         homologating                  [badge roxo]          │
│  Criado por:     João Silva (support_admin)                           │
│  Criado em:      23/06/2026 10:02                                     │
│  Staged em:      23/06/2026 10:04                                     │
│  Expira em:      23/07/2026 (7 dias restantes)                       │
│                                                                       │
│  [Ver Staging]                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

### Estados de tela

| Status do Job | Comportamento |
|---|---|
| `staging` | redireciona para `/staging/:id/ready` — ainda não homologando |
| `homologating` | tela principal de decisão |
| `committed` | banner verde "GO — Commit realizado em DD/MM/YYYY por [nome]"; somente leitura |
| `discarded` | banner vermelho "NO GO — Descartado em DD/MM/YYYY por [nome] — [justificativa]"; somente leitura |
| outros | redireciona para `/staging/:id` |

---

## FASE 2 — Impact Preview

### Posição: seção principal abaixo do cabeçalho

```
┌─────────────────────────────────────────────────────────────────────────┐
│  IMPACTO ESPERADO SE GO                                                 │
├──────────────────┬──────────────────┬──────────────────┬────────────────┤
│  Pacientes novos │ Pacientes update  │ Grupos familiares│  Inativações   │
│      1.240       │      2.580        │      890         │      48        │
├──────────────────┴──────────────────┴──────────────────┴────────────────┤
│  Equipes impactadas: 4   Profissionais referenciados: 18                │
│  Eventos assistenciais staged: 9.210                                    │
│  Consultas: 1.820  Visitas: 920  Vacinas: 430  Outros: 6.040           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Definições

| Campo | Cálculo |
|---|---|
| **Pacientes novos** | `outcome=ACCEPTED` onde CPF/CNS não existe em produção |
| **Pacientes update** | `outcome=MERGE_CANDIDATE` aceitos para atualização |
| **Grupos familiares** | FamilyGroups afetados (direto ou via merge) |
| **Inativações** | pacientes com `statusEhSaidaCadastro=true` ou `statusEhFaleceu=true` que serão marcados `inactive=true` |
| **Equipes impactadas** | UUIDs de teamId distintos no staging |
| **Profissionais referenciados** | UUIDs de `createdBy` distintos nos eventos staged |

### Alerta de inativação em massa

Se inativações > 10% do total staged:

```
⚠️ ALERTA: Esta importação inativará 480 pacientes (12,5% do staging).
Revise os registros de saída de cadastro antes de prosseguir.
```

---

## FASE 3 — Indicator Impact Panel

### Impacto nos componentes do score (`evaluateGroup()`)

| Componente Score | Peso | Variação esperada | Direção |
|---|---|---|---|
| `recentVisit` | 25 pts | +920 grupos com visita < 90 dias | ↑ melhora |
| `updatedRegistration` | 25 pts | +3.820 cadastros com `updatedAt` < 12 meses | ↑ melhora |
| `allCns` | 15 pts | +1.240 pacientes novos com CNS | ↑ melhora |
| `completeAddress` | 15 pts | +2.100 pacientes com endereço completo | ↑ melhora |
| `noOverdueTasks` | 20 pts | sem impacto direto | → neutro |

### Distribuição de score estimada pós-import

```
Score ≥ 80 (alto):    +340 grupos  (estimativa pós-merge)
Score 50–79 (médio):  +120 grupos
Score < 50 (crítico): −210 grupos  (removidos da lista crítica)
```

> **Nota:** estimativa calculada sobre dados staged. Score real recalculado pelo `evaluateGroup()` no momento do commit atômico.

### Indicadores de produção afetados

| Indicador | Variação esperada |
|---|---|
| Total de visitas ACS | +920 registros históricos |
| Cobertura de cadastro | +1.240 novos + 2.580 atualizados |
| Grupos críticos (score < 50) | −210 (estimado) |
| Produção histórica importada | marcada com `importJobId` para separação de relatórios |

### Aviso de distorção histórica

```
ℹ️ Eventos anteriores a 12 meses: 6.800 (73,9% do total de eventos)
   Esses eventos são históricos e não afetam o score atual.
   Métricas de produção retroativas serão impactadas.
   Recomendado: filtrar relatórios por importJobId para separar
   produção real de produção importada.
```

---

## FASE 4 — Risk Assessment Panel

### Classificação de risco por severidade

| Severidade | Cor | Significado |
|---|---|---|
| CRÍTICO | vermelho | Bloqueia GO automaticamente se presente |
| ALTO | laranja | Requer justificativa explícita no campo de decisão |
| MÉDIO | amarelo | Listado para conhecimento; não bloqueia |
| BAIXO | cinza | Informativo |

### Catálogo de riscos verificados automaticamente

| Código | Severidade | Condição de ativação | Mensagem exibida |
|---|---|---|---|
| R-01 | CRÍTICO | `stats.rejected > 0` | `N registros rejeitados não processados. Resolva antes de prosseguir.` |
| R-02 | CRÍTICO | `sourceProfile.status !== 'CERTIFIED'` | `Source Profile não certificado. Homologação bloqueada.` |
| R-03 | CRÍTICO | `mappingRuleVersion !== 'MAP-PEC-01-v1'` | `Mapping Rule desconhecido ou desatualizado.` |
| R-04 | CRÍTICO | `integrity.hashValid === false` | `Hash de integridade inválido. Arquivo pode estar corrompido.` |
| R-05 | CRÍTICO | `daysInStaging >= 30` | `Staging expirado. Import Job deve ser recriado.` |
| R-06 | ALTO | `stats.mergeConflicts > stats.staged * 0.20` | `Mais de 20% dos registros são merge candidates. Alta sobreposição com produção.` |
| R-07 | ALTO | `stats.inactivations > stats.staged * 0.10` | `Mais de 10% dos pacientes serão inativados.` |
| R-08 | ALTO | `stats.warnings > stats.staged * 0.15` | `Mais de 15% dos registros têm alertas não resolvidos.` |
| R-09 | MÉDIO | `stats.eventsWithoutPatient > 0` | `N eventos sem paciente resolvido — serão descartados no commit.` |
| R-10 | MÉDIO | `stats.historicalEvents > stats.events * 0.50` | `Maioria dos eventos é histórica (> 12 meses). Pode distorcer relatórios.` |
| R-11 | BAIXO | `stats.fallbackProfessional > 0` | `N eventos com profissional fallback. Revisar vínculo de produção.` |
| R-12 | BAIXO | `stats.newPatients > 500` | `Mais de 500 pacientes novos. Score familiar será recalculado em batch.` |

### Layout do painel de risco

```
┌─────────────────────────────────────────────────────────────────────┐
│  AVALIAÇÃO DE RISCO                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  🔴 CRÍTICOS: 0     🟠 ALTOS: 1     🟡 MÉDIOS: 2     ⚪ BAIXOS: 1  │
├─────────────────────────────────────────────────────────────────────┤
│  🟠 R-08 — 18,3% dos registros têm alertas (acima de 15%)          │
│     → Requer justificativa explícita                               │
│                                                                     │
│  🟡 R-10 — 73,9% dos eventos são históricos (> 12 meses)           │
│     → Pode distorcer relatórios de produção                        │
│                                                                     │
│  🟡 R-09 — 3 eventos sem paciente resolvido                         │
│     → Serão descartados no commit                                  │
│                                                                     │
│  ⚪ R-11 — 7 eventos com profissional fallback                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## FASE 5 — Workflow GO / NO GO

### Regra de exibição dos botões

**Botões GO e NO GO só ficam habilitados se:**

1. Nenhum risco CRÍTICO ativo (R-01 a R-05)
2. Checklist de staging completo (C-01 a C-06 + M-01 a M-04 do UI-STG-01)
3. Campo de justificativa preenchido (mínimo 100 chars)
4. Operador é `support_admin` ou `break_glass_admin`
5. Operador não é o mesmo que executou o staging (`createdBy !== homologatorId`)

### Botão GO

```
[✅ APROVAR IMPORTAÇÃO — GO]
cor: verde escuro
tamanho: grande
posição: direita
```

Ao clicar → modal de confirmação GO (ver §5.1).

### Botão NO GO

```
[❌ REJEITAR IMPORTAÇÃO — NO GO]
cor: vermelho
tamanho: médio
posição: esquerda
```

Ao clicar → modal de confirmação NO GO (ver §5.2).

### 5.1 — Modal de confirmação GO

```
┌────────────────────────────────────────────────────────────────────┐
│  ✅ CONFIRMAR GO — APROVAR IMPORTAÇÃO                              │
│                                                                    │
│  Esta ação autoriza o commit dos seguintes dados em produção:     │
│                                                                    │
│  • 1.240 pacientes novos                                          │
│  • 2.580 pacientes atualizados                                    │
│  • 48 pacientes inativados                                        │
│  • 9.210 eventos assistenciais                                    │
│                                                                    │
│  ⚠️ Esta ação é IRREVERSÍVEL após confirmação.                    │
│  O commit será executado de forma atômica.                        │
│  Não é possível desfazer após produção.                           │
│                                                                    │
│  Responsável: [nome do operador]                                  │
│  Timestamp:   23/06/2026 14:35:22                                 │
│                                                                    │
│  [Cancelar]                   [CONFIRMAR GO — SOU RESPONSÁVEL]    │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 — Modal de confirmação NO GO

```
┌────────────────────────────────────────────────────────────────────┐
│  ❌ CONFIRMAR NO GO — REJEITAR IMPORTAÇÃO                          │
│                                                                    │
│  Esta ação descartará permanentemente este Import Job.            │
│  Os dados em staging serão apagados.                              │
│  Um novo Import Job pode ser criado para nova tentativa.          │
│                                                                    │
│  Responsável: [nome do operador]                                  │
│  Timestamp:   23/06/2026 14:35:22                                 │
│                                                                    │
│  [Cancelar]                         [CONFIRMAR NO GO]             │
└────────────────────────────────────────────────────────────────────┘
```

### Sequência após GO confirmado

```
1. HomologationRecord criado (status=approved, timestamp, userId, justificativa)
2. Import Job transita: homologating → committed (via commit atômico — REM-01 obrigatório)
3. 9 etapas de commit atômico (ARCH-INT-01 §10)
4. Banner verde exibido: "Importação aprovada e commitada em produção"
5. Audit trail registrado no AUD-01 hash chain
```

### Sequência após NO GO confirmado

```
1. HomologationRecord criado (status=rejected, timestamp, userId, justificativa)
2. Import Job transita: homologating → discarded
3. app_import_staging: registros marcados discarded_at
4. Banner vermelho exibido: "Importação rejeitada. Dados de staging removidos."
5. Novo Import Job pode ser criado para nova tentativa
```

---

## FASE 6 — Justificativa obrigatória

### Campo de justificativa

```
┌────────────────────────────────────────────────────────────────────┐
│  JUSTIFICATIVA DA DECISÃO (obrigatório)                           │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ [campo texto livre — min 100 chars, max 2000 chars]          │ │
│  │                                                              │ │
│  │ Ex: "Dados revisados. Amostra de 5% inspecionada manualmente.│ │
│  │ 18,3% de alertas referem-se a campos de endereço incompleto  │ │
│  │ na migração legada do PEC 4.x. Decisão: GO com ciência dos   │ │
│  │ alertas de endereço."                                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  [0 / 2000 chars] — mínimo 100 chars                              │
│                                                                    │
│  Riscos ALTOS presentes: justificativa deve endereçar cada um.   │
│  [R-08] Mencione os alertas revisados.                           │
└────────────────────────────────────────────────────────────────────┘
```

### Regras de validação da justificativa

| Regra | Condição | Mensagem |
|---|---|---|
| Obrigatória | sempre | `"Justificativa é obrigatória"` |
| Mínimo 100 chars | `text.length < 100` | `"Justificativa muito curta. Descreva a decisão."` |
| Máximo 2000 chars | `text.length > 2000` | `"Limite de 2000 caracteres"` |
| Menção a riscos ALTOS | se R-06/R-07/R-08 ativos e texto não menciona risco | aviso amarelo (não bloqueia) |

### Assinatura lógica

Ao confirmar GO ou NO GO, o sistema persiste:

```json
{
  "homologationId": "uuid",
  "importJobId": "uuid",
  "decision": "GO | NO_GO",
  "justificativa": "texto livre",
  "decidedBy": "userId",
  "decidedByName": "nome completo",
  "decidedByRole": "support_admin | break_glass_admin",
  "timestamp": "ISO 8601",
  "risks": ["R-08", "R-10", "R-09", "R-11"],
  "stagingChecklist": { "C-01": true, "C-02": true, "M-01": true, ... },
  "sourceProfile": "sp-pec-aps-v01",
  "mappingRuleVersion": "MAP-PEC-01-v1"
}
```

---

## FASE 7 — Homologation Audit Trail

### Rota

```
/homologation/:importJobId/audit
```

### Seções

**Seção 1 — Registro de decisão**

| Campo | Valor |
|---|---|
| Decisão | GO ✅ / NO GO ❌ |
| Decidido por | nome + role |
| Timestamp | ISO 8601 |
| Justificativa | texto completo |
| Riscos ativos no momento | lista de R-XX |
| Checklist de staging | todos os itens C e M |
| Source Profile | `sp-pec-aps-v01 (CERTIFIED)` |
| Mapping Rule | `MAP-PEC-01-v1` |

**Seção 2 — Cadeia de custódia**

```
[10:02] received     — João Silva (support_admin) criou Import Job
[10:04] staging      — pipeline concluiu staging; 3.820 registros
[11:30] homologating — Maria Santos (support_admin) iniciou homologação
           → Staging checklist completado (C-01 a C-06, M-01 a M-04)
[14:35] committed    — Carlos Rocha (break_glass_admin) aprovou GO
           → Justificativa: "..."
           → Commit atômico concluído: 3.820 staged → produção
```

**Seção 3 — Integridade pós-commit**

| Verificação | Resultado |
|---|---|
| Staged antes do commit | 3.820 |
| Commitados em produção | 3.820 |
| Hash pré-commit | `SHA-256: abc123...` |
| Hash pós-commit | `SHA-256: abc123...` ✅ |
| AUD-01 hash chain entry | `block_height: 4.821` ✅ |

**Seção 4 — LGPD**

| Item | Status |
|---|---|
| Campos Art. 11 redacted em audit log | ✅ |
| Campos Art. 11 presentes em produção (criptografados) | ✅ |
| Import Job audit retido por 5 anos | ✅ |
| Justificativa de homologação retida por 5 anos | ✅ |

### Integração com AUD-01

Toda decisão de homologação (GO ou NO GO) gera uma entrada no hash chain do AUD-01:

```json
{
  "eventType": "HOMOLOGATION_DECISION",
  "importJobId": "uuid",
  "decision": "GO",
  "decidedBy": "userId",
  "timestamp": "ISO 8601",
  "stagingCount": 3820,
  "justificativaHash": "SHA-256 da justificativa"
}
```

Justificativa não entra em texto claro no AUD-01 — somente hash. Texto completo fica no `HomologationRecord` (tabela `app_homologation_records` — nova, definida no ARCH-INT-01).

---

## FASE 8 — RBAC

### Matriz de acesso

| Ação | `support_admin` | `break_glass_admin` | `gestor` | `auditor` | ACS / outros |
|---|---|---|---|---|---|
| Ver `/homologation/:id` | ✅ | ✅ | ❌ | ✅ (read-only) | ❌ |
| Ver Impact Preview | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ver Risk Assessment | ✅ | ✅ | ❌ | ✅ | ❌ |
| Preencher justificativa | ✅ | ✅ | ❌ | ❌ | ❌ |
| Aprovar GO | ✅* | ✅ | ❌ | ❌ | ❌ |
| Rejeitar NO GO | ✅* | ✅ | ❌ | ❌ | ❌ |
| Ver audit trail completo | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ver campos LGPD Art.11 | ❌ | ✅ | ❌ | ❌ | ❌ |

> *`support_admin` que criou o Import Job NÃO pode homologá-lo. Requer operador diferente do `createdBy`.

### Regra de separação de poderes (four-eyes principle)

```
importJob.createdBy !== homologation.decidedBy
```

Se forem o mesmo usuário → botões GO/NO GO bloqueados com mensagem:

```
⚠️ Você criou este Import Job.
   Outro operador deve realizar a homologação.
```

### Gestor local

Gestor da UBS não acessa homologação diretamente.

Pode ser notificado (futuro, fora de escopo desta sprint) que GO foi aprovado para a sua UBS.

---

## FASE 9 — Blocking Rules Registry

### Regras que impedem completamente a homologação (sistema bloqueia UI)

| Código | Condição | Bloqueio | Resolução |
|---|---|---|---|
| B-01 | `status !== 'homologating'` | botões não renderizados | avanço via `/staging/:id/ready` |
| B-02 | `stats.rejected > 0` | GO/NO GO desabilitados | resolver erros e recriar Import Job |
| B-03 | `sourceProfile.status !== 'CERTIFIED'` | GO/NO GO desabilitados | certificar Source Profile |
| B-04 | `mappingRuleVersion` não reconhecido | GO/NO GO desabilitados | atualizar Mapping Rule |
| B-05 | `integrity.hashValid === false` | GO/NO GO desabilitados | corrupção de arquivo — recriar Job |
| B-06 | `daysInStaging >= 30` | GO/NO GO desabilitados | Import Job expirado — recriar |
| B-07 | `decidedBy === createdBy` | GO/NO GO desabilitados | four-eyes principle — outro operador |
| B-08 | `justificativa.length < 100` | GO/NO GO desabilitados | justificativa insuficiente |
| B-09 | staging checklist incompleto | GO/NO GO desabilitados | completar checklist em `/staging/:id/ready` |
| B-10 | operador sem role autorizado | tela não acessível (403) | — |

### Regras que alertam mas não bloqueiam (warnings)

| Código | Condição | Aviso |
|---|---|---|
| W-01 | riscos ALTO ativos sem menção na justificativa | aviso amarelo |
| W-02 | inativações > 10% | aviso laranja |
| W-03 | merge candidates > 20% | aviso laranja |
| W-04 | eventos históricos > 50% | aviso informativo |
| W-05 | profissional fallback presente | aviso informativo |

---

## FASE 10 — Commit Gate

### Regra formal

```
Commit em produção = PROIBIDO sem HomologationRecord com decision=GO
```

### Implementação

No commit atômico (ARCH-INT-01 §10, etapa 1):

```javascript
// Passo 0 — verificar gate de homologação (ANTES de qualquer write)
const homologation = await getHomologation(importJobId);

if (!homologation) {
  throw new Error('COMMIT_GATE: HomologationRecord ausente');
}
if (homologation.decision !== 'GO') {
  throw new Error('COMMIT_GATE: Decisão não é GO');
}
if (homologation.decidedBy === importJob.createdBy) {
  throw new Error('COMMIT_GATE: four-eyes principle violated');
}
if (homologation.sourceProfile !== 'sp-pec-aps-v01') {
  throw new Error('COMMIT_GATE: Source Profile não reconhecido');
}

// Somente após essas verificações → iniciar transação de commit
```

### Estados possíveis do Commit Gate

| Estado | Condição | Commit |
|---|---|---|
| `GATE_OPEN` | HomologationRecord existe, `decision=GO`, four-eyes OK | **PERMITIDO** |
| `GATE_CLOSED_NO_HOMOLOGATION` | HomologationRecord ausente | **PROIBIDO** |
| `GATE_CLOSED_NO_GO` | `decision=NO_GO` | **PROIBIDO** |
| `GATE_CLOSED_FOUR_EYES` | `decidedBy === createdBy` | **PROIBIDO** |
| `GATE_CLOSED_INVALID_PROFILE` | Source Profile não reconhecido | **PROIBIDO** |

### Visibilidade do gate na UI

```
┌─────────────────────────────────────────────────────────┐
│  STATUS DO COMMIT GATE                                  │
│                                                         │
│  🔒 GATE_CLOSED_NO_HOMOLOGATION                        │
│  Aguardando decisão GO/NO GO.                          │
│                                                         │
│  (após GO aprovado)                                     │
│                                                         │
│  🔓 GATE_OPEN                                           │
│  Homologação aprovada por Carlos Rocha em 14:35:22.    │
│  Commit em produção autorizado.                        │
│  [Executar Commit]  ← somente support_admin/bga        │
└─────────────────────────────────────────────────────────┘
```

O botão "Executar Commit" só aparece após GO. Clicar inicia as 9 etapas do commit atômico (ARCH-INT-01 §10).

---

## FASE 11 — Decisão executiva

### O VITRAS possui processo completo de aprovação antes da produção?

**SIM.**

A cadeia completa está definida:

```
Arquivo LEDI (PEC APS)
        │
        ▼ Source Profile sp-pec-aps-v01
   Profiling
        │
        ▼ MAP-PEC-01-v1
   Mapping Engine
        │
        ▼ 18 regras em 5 grupos
   Validation Engine
        │
        ▼ E-01 a E-05
   Population Selection
        │
        ▼ tabela app_import_staging
   Staging
        │
        ▼ UI-STG-01 (inspeção operacional)
   Staging Workbench
        │
        ▼ UI-HOMO-01 (decisão formal)
   Homologation Center
        │
        ▼ HomologationRecord(decision=GO) + four-eyes
   Commit Gate
        │
        ▼ 9 etapas atômicas + REM-01
   Produção
        │
        ▼ AUD-01 hash chain
   Auditoria permanente
```

### Prontidão conceitual para MIG-01

| Requisito MIG-01 | Status |
|---|---|
| Canonical Model definido | ✅ ARCH-INT-01 |
| Source Profile PEC certificado | ✅ SP-PEC-01 |
| Mapping Engine formalizado | ✅ MAP-PEC-01 |
| Staging Workbench definido | ✅ UI-STG-01 |
| Homologation Center definido | ✅ UI-HOMO-01 |
| REM-01 (incremental shadow sync) | ❌ TECH-SCALE-01A — bloqueador |
| REM-02 (bootstrap paginado) | ❌ TECH-SCALE-01B — bloqueador |
| API de upload de arquivo LEDI | ❌ MIG-01 — a implementar |
| Tabela `app_import_staging` | ❌ MIG-01 — a implementar |
| Tabela `app_homologation_records` | ❌ MIG-01 — a implementar |

**MIG-01 está conceitualmente preparado. Implementação bloqueada até TECH-SCALE-01A.**

---

## Resultado obrigatório

| Item | Status |
|---|---|
| Painel executivo definido? | **SIM** |
| Impact Preview definido? | **SIM** |
| Indicator Impact definido? | **SIM** |
| Risk Assessment definido? | **SIM** |
| Workflow GO/NO GO definido? | **SIM** |
| Auditoria definida? | **SIM** |
| RBAC definido? | **SIM** |
| Blocking Rules definidas? | **SIM** |
| Commit Gate definido? | **SIM** |
| MIG-01 preparado conceitualmente? | **SIM** |
| **Status UI-HOMO-01** | **PASS** |

---

## Encerramento da camada operacional ARCH-INT-01

A conclusão de UI-HOMO-01 fecha a definição da experiência operacional completa da arquitetura nacional de importação:

| Sprint | Escopo | Status |
|---|---|---|
| ARCH-INT-01 | Arquitetura e pipeline | PASS |
| SP-PEC-01 | Source Profile PEC APS | PASS |
| MAP-PEC-01 | Mapping Engine | PASS |
| UI-STG-01 | Staging Workbench | PASS |
| UI-HOMO-01 | Homologation Center | PASS |

**Próxima frente obrigatória antes de qualquer implementação:** TECH-SCALE-01A (REM-01 — shadow sync incremental).
