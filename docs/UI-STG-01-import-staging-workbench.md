# UI-STG-01 — Import Staging Workbench

**Emitido em:** 2026-06-23  
**Status:** PASS  
**Depende de:** ARCH-INT-01 (PASS), SP-PEC-01 (PASS), MAP-PEC-01 (PASS)  
**Autoriza:** UI-HOMO-01  
**Escopo:** Experiência operacional de inspeção de dados entre Mapping Engine e Homologação  
**Implementação real:** Bloqueada até REM-01 + REM-02 (TECH-SCALE-01A)

---

## GOV-01

| # | Critério | Resultado |
|---|---|---|
| 1 | Visão geral do Import Job | **SIM** |
| 2 | Visualização de erros | **SIM** |
| 3 | Visualização de alertas | **SIM** |
| 4 | Visualização de pacientes elegíveis | **SIM** |
| 5 | Visualização de pacientes excluídos | **SIM** |
| 6 | Visualização de eventos assistenciais | **SIM** |
| 7 | Rastreabilidade de origem | **SIM** |
| 8 | Trilha de auditoria | **SIM** |
| 9 | Bloqueio de edição dos dados staged | **SIM** |
| 10 | Interface pronta para homologação | **SIM** |

---

## Princípios de design

| Princípio | Descrição |
|---|---|
| **Somente leitura** | Nenhum campo do staging é editável. Dados staged são imutáveis por definição. |
| **Rastreabilidade total** | Cada registro exibe origem, regra de mapeamento e resultado de validação. |
| **Decisão fundamentada** | Operador deve poder inspecionar qualquer registro antes de avançar para homologação. |
| **Bloqueio visual de commit** | Botão de commit não existe nesta tela. Avanço para homologação depende de checklist. |
| **Mobile-last** | Interface de staging é desktop-first. ACS não acessa staging. |
| **Roles restritos** | Apenas `support_admin`, `break_glass_admin`, `gestor` autorizado. |

---

## FASE 1 — Visão geral do Import Job

### Rota

```
/staging/:importJobId
```

### Componentes obrigatórios

| Componente | Conteúdo | Obs |
|---|---|---|
| **Cabeçalho do Job** | `importJobId` (UUID curto), `sourceProfile` (`sp-pec-aps-v01`), `status` (badge colorido), `createdAt` (DD/MM/YYYY HH:mm), `createdBy` (nome do operador), `pecVersion` | fixo no topo |
| **Badge de status** | cor por estado: `received`=cinza, `mapping`=azul, `validating`=laranja, `selecting`=azul, `staging`=amarelo, `homologating`=roxo, `committed`=verde, `discarded`=vermelho, `failed`=vermelho | |
| **Tempo decorrido** | `Iniciado há X horas/minutos` | calculado em tempo real |
| **Alerta de expiração** | se staging > 25 dias → banner amarelo "Expira em X dias" | ARCH-INT-01 §9 define 30 dias |

### Estados de tela por status do Job

| Status | O que mostrar |
|---|---|
| `received`, `profiling`, `mapping`, `validating`, `selecting` | Spinner com etapa atual + progresso estimado |
| `staging` | Resumo parcial disponível (pode carregar parcialmente) |
| `homologating` | Tela completa; botão "Ver Checklist de Homologação" visível |
| `committed` | Banner verde "IMPORTADO EM PRODUÇÃO em DD/MM/YYYY por [nome]" + dados read-only |
| `discarded` | Banner vermelho "DESCARTADO em DD/MM/YYYY — motivo: [justificativa]" |
| `failed` | Banner vermelho + log de erro técnico (colapsável) |

---

## FASE 2 — Resumo executivo

### Posição: card horizontal abaixo do cabeçalho

```
┌─────────────────────────────────────────────────────────────────────┐
│  Recebidos      Mapeados      Validados      Selecionados   Staged  │
│   4.231          4.180          3.947           3.820        3.820  │
│                                                                     │
│  Rejeitados      Excluídos     Alertas        Erros bloq.          │
│     51              127           89               0                │
└─────────────────────────────────────────────────────────────────────┘
```

### Definição de cada contador

| Campo | Definição |
|---|---|
| **Recebidos** | `stats.totalRaw` — todos os registros no arquivo bruto |
| **Mapeados** | registros que passaram pelo Mapping Engine sem rejeição total |
| **Validados** | registros que passaram em todas as regras do Validation Engine |
| **Selecionados** | registros aceitos pelo Population Selection Engine (E-01 a E-05) |
| **Staged** | registros na tabela `app_import_staging` |
| **Rejeitados** | registros bloqueados no mapping ou validation |
| **Excluídos** | registros rejeitados pelo Population Selection (elegíveis mas fora de escopo) |
| **Alertas** | registros com `outcome=WARNING` no staging |
| **Erros bloqueantes** | `outcome=REJECTED` — deve ser zero para prosseguir |

### Indicador de prontidão

```
✅ 0 erros bloqueantes — Pronto para Homologação
⚠️ 51 erros bloqueantes — Revisar antes de prosseguir
```

---

## FASE 3 — Visão de pacientes

### Rota

```
/staging/:importJobId/patients
```

### Abas

| Aba | Conteúdo | Filtro padrão |
|---|---|---|
| **Elegíveis** | pacientes selecionados para commit | `outcome = ACCEPTED` |
| **Candidatos a Merge** | pacientes que já existem em produção com dado sobreposto | `outcome = MERGE_CANDIDATE` |
| **Excluídos** | rejeitados pelo Population Selection | `outcome = EXCLUDED` |
| **Rejeitados** | bloqueados pelo Mapping ou Validation Engine | `outcome = REJECTED` |

### Tabela de pacientes (por aba)

| Coluna | Conteúdo |
|---|---|
| Nome | `patient.name` (mascarado se preview) |
| CNS | últimos 4 dígitos: `**** **** *** 1234` |
| CPF | `***.xxx.xxx-**` |
| Equipe | nome da equipe VITRAS mapeada |
| Motivo (excluídos) | regra E-01 a E-05 que excluiu o paciente |
| Motivo (rejeitados) | rule validation que rejeitou |
| Origem | `coUnicoFicha` do PEC |
| Ação | botão "Inspecionar" → detalhe do registro |

### Tela de detalhe do paciente (modal ou drawer)

Seções:
1. **Dados canônicos** — campos do Canonical Model mapeados com valor
2. **Gaps** — campos com `action=DISCARDED` ou `action=REJECTED`; mostrar `reason`
3. **Campos LGPD Art.11** — exibir com badge `[LGPD]`; valor visível apenas para `break_glass_admin`
4. **Auditoria de mapeamento** — tabela `sourcePath → canonicalField → rule → action`
5. **Se MERGE_CANDIDATE** — comparativo lado a lado: "Em produção" vs "No staging"

### Merge candidate — layout lado a lado

```
┌───────────────────────────┬───────────────────────────┐
│       Em Produção         │       No Staging (PEC)    │
├───────────────────────────┼───────────────────────────┤
│ Nome: João Silva          │ Nome: João da Silva       │
│ Telefone: —               │ Telefone: (11) 91234-5678 │
│ updatedAt: 2024-03-01     │ updatedAt: 2025-11-15 ✅  │
│ careCategory: chronic     │ careCategory: pregnant ⚠️ │
└───────────────────────────┴───────────────────────────┘
Regra aplicada: dado PEC mais recente → atualizar campos não clínicos
```

---

## FASE 4 — Visão de eventos assistenciais

### Rota

```
/staging/:importJobId/events
```

### Resumo por tipo (cards)

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│Consultas │  Visitas │ Vacinas  │Procedim. │  Exames  │Encaminh. │
│  1.820   │   920    │   430    │   310    │   220    │   120    │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

### Filtros disponíveis

| Filtro | Opções |
|---|---|
| Tipo de evento | consultation, visit, vaccine, procedure, exam_request, referral, prescription, evolution |
| Status | ACCEPTED, WARNING, REJECTED |
| Profissional | dropdown de profissionais no Import Job |
| Período | data mínima e máxima do PEC |
| Paciente | busca por CNS parcial (últimos 4 dígitos) |

### Tabela de eventos

| Coluna | Conteúdo |
|---|---|
| Tipo | badge colorido por tipo |
| Data | `clinicalRecord.date` |
| Paciente | nome mascarado |
| Profissional | nome |
| Status | ACCEPTED / WARNING / REJECTED |
| CID | se presente |
| Origem | `sourceId` (coUnicoFicha) |
| Ação | "Inspecionar" |

### Detalhe do evento (modal)

1. **Tipo e data**
2. **Campos mapeados** — tabela `campo canônico → valor`
3. **Sub-eventos** — se atendimento individual gerou prescription/exam_request/referral, listar
4. **Auditoria** — `sourcePath → rule → action → certainty`
5. **Gaps** — campos descartados com `reason`

---

## FASE 5 — Painel de validação

### Rota

```
/staging/:importJobId/validation
```

### Layout

**Seção 1 — Resumo de regras**

| Regra | Descrição | Total avaliado | Passed | Failed |
|---|---|---|---|---|
| V-ID-01 | CPF ou CNS presente | 4.180 | 4.132 | 48 |
| V-ID-02 | Nome ≥ 2 chars | 4.180 | 4.178 | 2 |
| V-TER-03 | INE resolvido | 4.180 | 4.180 | 0 |
| V-TER-04 | CNES resolvido | 4.180 | 4.180 | 0 |
| ... | ... | ... | ... | ... |

**Seção 2 — Erros bloqueantes**

Lista de todos os registros com `outcome=REJECTED`:
- Identificador mascarado
- Regra que falhou
- Valor que causou a falha
- `coUnicoFicha` para rastreabilidade no PEC

**Seção 3 — Alertas (não bloqueantes)**

Lista de registros com `outcome=WARNING`:
- Mesmo formato dos erros
- Não impedem avanço para homologação
- Devem ser revisados pelo homologador

**Seção 4 — Resumo por grupo de validação**

| Grupo | Regras | Status |
|---|---|---|
| Identidade (V-ID) | V-ID-01 a V-ID-04 | ✅ 0 bloqueantes |
| Clínico (V-CLN) | V-CLN-01 a V-CLN-04 | ✅ 0 bloqueantes |
| Territorial (V-TER) | V-TER-01 a V-TER-04 | ✅ 0 bloqueantes |
| Volume (V-VOL) | V-VOL-01 a V-VOL-02 | ⚠️ 1 alerta |
| LGPD (V-LGPD) | V-LGPD-01 a V-LGPD-04 | ✅ 0 bloqueantes |

---

## FASE 6 — Auditoria do Import Job

### Rota

```
/staging/:importJobId/audit
```

### Seções

**Seção 1 — Cabeçalho de proveniência**

| Campo | Valor |
|---|---|
| importJobId | UUID completo |
| sourceSystem | `sp-pec-aps-v01` |
| mappingRuleVersion | `MAP-PEC-01-v1` |
| pecVersion | `5.3` |
| createdBy | nome + role do operador |
| createdAt | ISO 8601 |
| unitId | UUID da UBS |
| teamIds | lista de INEs processados |

**Seção 2 — Log de eventos do pipeline**

Linha do tempo do Import Job:

```
[2026-06-23 10:02:14] received         — arquivo LEDI recebido (4.231 registros)
[2026-06-23 10:02:15] profiling        — Source Profile sp-pec-aps-v01 aplicado
[2026-06-23 10:02:47] mapping          — MAP-PEC-01-v1 executado
[2026-06-23 10:03:21] validating       — 18 regras aplicadas; 51 rejeitados
[2026-06-23 10:03:45] selecting        — E-01 a E-05 aplicados; 127 excluídos
[2026-06-23 10:04:10] staging          — 3.820 registros em staging
```

**Seção 3 — Integridade**

| Verificação | Status |
|---|---|
| Hash do arquivo bruto | `SHA-256: abc123...` ✅ |
| Contagem de registros brutos | 4.231 ✅ |
| Contagem de staged | 3.820 ✅ |
| Versão do mapping utilizado | MAP-PEC-01-v1 ✅ |

**Seção 4 — Campos LGPD Art. 11**

Lista de campos redacted por tipo:

| Campo | Ocorrências redacted | Regra |
|---|---|---|
| `racaCor` | 3.820 | Art. 11 — não exposto em audit log |
| `situacaoRua` | 89 | Art. 11 |
| `hivGestante` | 12 | Art. 11 |
| ... | ... | ... |

> **Nota:** valores dos campos Art. 11 não aparecem aqui. Apenas contagem e marcador.

---

## FASE 7 — Permissões (RBAC)

### Matriz de acesso

| Tela | `support_admin` | `break_glass_admin` | `gestor` (autorizado) | `auditor` | ACS / outros |
|---|---|---|---|---|---|
| `/staging/:id` (visão geral) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/staging/:id/patients` (tabela) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Detalhe do paciente — dados comuns | ✅ | ✅ | ✅ | ✅ | ❌ |
| Detalhe do paciente — campos LGPD Art.11 | ❌ | ✅ | ❌ | ❌ | ❌ |
| Merge candidate — comparativo | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/staging/:id/events` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/staging/:id/validation` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/staging/:id/audit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| Avançar para homologação | ✅ | ✅ | ❌ | ❌ | ❌ |
| Descartar Import Job | ✅ | ✅ | ❌ | ❌ | ❌ |

### Regras de acesso do gestor

`gestor` autorizado = gestor da UBS alvo do Import Job (`unitId` do Import Job === `user.unitId`).

Gestor de outra UBS não enxerga o Import Job.

### Rota protegida

```javascript
// Toda rota de staging:
requireAuth                          // global em app.js linha 60
hasCapability('view_staging')        // ou role explícita
importJobBelongsToUserUnit(req)      // gestor vê só sua UBS
```

---

## FASE 8 — Navegação e fluxo integrado

### Fluxo principal

```
Console Nacional / Painel UBS
        │
        ▼
  Lista de Import Jobs
  /staging
  [filtros: status, data, UBS]
        │
        ▼
  Visão geral do Import Job
  /staging/:importJobId
  [cabeçalho + resumo executivo]
        │
   ┌────┴────────────────────────────┐
   ▼              ▼                  ▼
Pacientes      Eventos           Auditoria
/patients      /events           /audit
   │
   ▼
Detalhe paciente
(modal)
        │
        ▼  [somente se 0 erros bloqueantes]
  Checklist de prontidão
  /staging/:importJobId/ready
        │
        ▼  [somente support_admin ou break_glass_admin]
  Iniciar Homologação →  UI-HOMO-01
```

### Lista de Import Jobs (`/staging`)

| Coluna | Conteúdo |
|---|---|
| ID | UUID curto (8 chars) |
| UBS | nome da unidade |
| Source Profile | `sp-pec-aps-v01` |
| Status | badge colorido |
| Registros staged | número |
| Criado em | DD/MM/YYYY |
| Criado por | nome |
| Ações | "Ver" · "Descartar" (se não committed) |

Filtros: status, UBS, período, operador.

Paginação: 20 por página.

---

## FASE 9 — Ready for Homologation

### Rota

```
/staging/:importJobId/ready
```

### Acesso

Somente `support_admin` e `break_glass_admin`.

Visível somente se `status = staging`.

### Checklist automático (verificado pelo sistema)

| # | Item | Como verifica | Status |
|---|---|---|---|
| C-01 | Zero erros bloqueantes | `stats.rejected === 0` | ✅ / ❌ |
| C-02 | Source Profile certificado | `sourceProfile.status === 'CERTIFIED'` | ✅ / ❌ |
| C-03 | Mapping Rule ativo | `mappingRuleVersion === 'MAP-PEC-01-v1'` | ✅ / ❌ |
| C-04 | Hash de integridade válido | `integrity.hashValid === true` | ✅ / ❌ |
| C-05 | Staging não expirado | `daysInStaging < 30` | ✅ / ❌ |
| C-06 | CNES e INE resolvidos | `stats.cnesResolved && stats.ineResolved` | ✅ / ❌ |

### Checklist manual (preenchido pelo operador)

| # | Item | Input |
|---|---|---|
| M-01 | Pacientes da amostra revisados | checkbox + assinatura digital (nome) |
| M-02 | Merge candidates avaliados | checkbox |
| M-03 | Alertas revisados e aceitos | checkbox + justificativa (campo texto) |
| M-04 | Responsável pela UBS notificado | checkbox |

### Botão de avanço

```
[Iniciar Homologação]
```

Habilitado somente se:
- C-01 a C-06: todos ✅
- M-01 a M-04: todos marcados
- Campo de justificativa preenchido (mínimo 50 chars)

Ao clicar: abre confirmação modal antes de transitar para `homologating`.

### Modal de confirmação

```
┌───────────────────────────────────────────────────────────┐
│  Iniciar Homologação                                       │
│                                                           │
│  Import Job: abc12345                                     │
│  Registros staged: 3.820                                  │
│  Operador: [nome]                                         │
│                                                           │
│  Esta ação inicia o processo de Homologação.              │
│  Nenhum dado será gravado em produção ainda.              │
│                                                           │
│  [Cancelar]                [Confirmar e Avançar]          │
└───────────────────────────────────────────────────────────┘
```

---

## Resultado obrigatório

| Item | Status |
|---|---|
| Dashboard de staging definido? | **SIM** |
| Visão de pacientes definida? | **SIM** |
| Visão de eventos definida? | **SIM** |
| Visão de validação definida? | **SIM** |
| Auditoria definida? | **SIM** |
| RBAC definido? | **SIM** |
| Critérios de homologação definidos? | **SIM** |
| UI-HOMO-01 autorizado? | **SIM** |
| **Status UI-STG-01** | **PASS** |
