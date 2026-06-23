# CTRL-01 — VITRAS APS Product Control Map

**Emitido em:** 2026-06-23  
**Status:** VIGENTE  
**Atualização obrigatória:** A cada nova iniciativa concluída, rejeitada ou bloqueada  
**Autoridade:** Este documento é o ponto único de verdade do estado do produto

> Nenhuma nova iniciativa estratégica pode ser aberta sem passar pelo CTRL-01.  
> Nenhum item pode ser considerado concluído sem registro formal aqui.  
> Nenhum item NO GO retorna ao roadmap sem decisão explícita e nova entrada neste documento.

---

## GOV-01

| Critério | Resultado |
|---|---|
| Existe inventário oficial das iniciativas do produto? | **SIM** |
| Existe classificação de status para cada iniciativa? | **SIM** |
| Existe registro formal de itens PASS? | **SIM** |
| Existe registro formal de itens DONE? | **SIM** |
| Existe registro formal de itens NO GO? | **SIM** |
| Existe registro de dependências entre iniciativas? | **SIM** |
| Existe definição da próxima frente autorizada? | **SIM** |
| Existe definição explícita do que não deve ser iniciado? | **SIM** |
| Existe critério para abertura de novas iniciativas? | **SIM** |
| Existe visão consolidada do estado atual do produto? | **SIM** |

---

## Status Oficiais

| Status | Definição |
|---|---|
| **PASS** | Iniciativa concluída, testada e validada — integra o produto permanentemente |
| **DONE** | Incidente, bug ou correção encerrado formalmente |
| **ATIVO** | Processo contínuo ou gate permanente — não encerra |
| **IN PROGRESS** | Execução iniciada, não concluída |
| **PLANNED** | Autorizado mas não iniciado |
| **BLOCKED** | Impedido por pré-requisito não concluído |
| **NO GO** | Rejeitado — não retorna ao roadmap sem decisão formal |
| **REJECTED** | Artefato produzido mas não aprovado — não deve ser usado como referência |

---

## Inventário Completo

### Clínico ACS (APS-01)

| ID | Título | Status | Commit ref |
|---|---|---|---|
| APS-01A | ACS Workspace — estrutura base | **PASS** | histórico pre-sprint5 |
| APS-01B | Tarefas e Agenda ACS | **PASS** | histórico pre-sprint5 |
| APS-01C | Visitas ACS com persistência real | **PASS** | histórico pre-sprint5 |
| APS-01D | Grupo Familiar Workspace | **PASS** | histórico pre-sprint5 |
| APS-01E | Busca Ativa Inteligente (score 0–100, 8 regras) | **PASS** | histórico pre-sprint5 |
| APS-01F | Produção ACS Automática (4 APIs, dashboards) | **PASS** | histórico pre-sprint5 |

### Exportação CDS / e-SUS

| ID | Título | Status | Commit ref |
|---|---|---|---|
| PRR-01A | CDS Export — 4 fichas LEDI APS 7.4.0 (CI, CDT, VD, AI) | **PASS** | `25c0c60` |

### Segurança de API

| ID | Título | Status | Commit ref |
|---|---|---|---|
| SEC-API-01A | Token lifetime (15 min JWT + refresh dedup) | **PASS** | histórico |
| SEC-API-01B | CPF/CNS masking padronizado | **PASS** | histórico |
| SEC-API-01C | Optimistic locking via updatedAt | **PASS** | `96956d5` |
| SEC-API-01D | GET /tasks/:id com RBAC e team scope + N+1 fix | **PASS** | `c547e78` `e0709aa` |

### Segurança e Auditoria

| ID | Título | Status | Commit ref |
|---|---|---|---|
| SEC-01 | Auth: JWT 15min, refresh httpOnly, CSRF, 2FA, rate limit | **PASS** | histórico |
| AUD-01 | Audit hash chain SHA-256 — hashVersion v2 | **PASS** | histórico |

### Arquitetura e Dívida Técnica

| ID | Título | Status | Commit ref |
|---|---|---|---|
| ARCH-01 | Depilotization — remover IBGE `3534401` hardcoded em 6 locais | **PASS** | `755aa37` `2daef42` |
| TECH-DEBT-01 | TLS cert validation, advisory lock migrations, AUTH_MAX_ATTEMPTS | **PASS** | `a2ed47d` |

### IAM

| ID | Título | Status | Commit ref |
|---|---|---|---|
| IAM-01 | support_admin, forcePasswordChange, RBAC platform isolation | **PASS** | `63b8a3e` → `2a97d19` |
| IAM-01A | Bind legacy test data ao tenant oficial | **PASS** | `0bbcee5` |
| IAM-01B | Bootstrap CLI support_admin one-shot | **PASS** | `775a8f2` |
| IAM-01C | reset-support-admin-password Postgres-aware | **PASS** | `360f9bf` |
| IAM-01D | ChangePasswordRequiredPage — cookie-session sentinel | **PASS** | `1a0b5cc` |
| IAM-01E | PlatformConsolePage usa api() para sentinel; migration 029 seed unit | **PASS** | `e78a591` |

### Console Nacional

| ID | Título | Status | Commit ref |
|---|---|---|---|
| CONSOLE-01 | Console Nacional — listagem UBS, criação, equipe, gestor inicial | **PASS** | `1d071fb` |

### Implantação

| ID | Título | Status | Commit ref |
|---|---|---|---|
| IMPLANT-01 | Playbook de implantação multi-UBS (8 documentos) | **PASS** | `18fe424` |
| IMPLANT-01A | Workflow nacional de provisionamento de tenant | **PASS** | `7e5063a` |

### Homologação

| ID | Título | Status | Commit ref |
|---|---|---|---|
| HOMOLOG-01 | Critérios nacionais de homologação UBS | **PASS** | `139e707` |

### Governança de Integração

| ID | Título | Status | Commit ref |
|---|---|---|---|
| INTEGRATION-GOV-01A | Governança nacional de ingestão de dados | **PASS** | `89f2cd2` |

### Documentação Funcional

| ID | Título | Status | Commit ref |
|---|---|---|---|
| ARCH-DOC-03 | Inventário funcional completo — 46 superfícies | **PASS** | `6d2f01a` |
| ARCH-DOC-01 | Registro de regras de negócio e dicionário nacional de dados | **REJECTED** | `06d4e7d` |
| ARCH-DOC-02 | Documentação funcional por página (escopo, campos, regras) | **REJECTED** | `befc715` |

> **ARCH-DOC-01 e ARCH-DOC-02:** artefatos produzidos não atingiram o padrão funcional exigido. Não devem ser usados como referência oficial. Substituídos conceitualmente pelo padrão estabelecido em ARCH-DOC-03.

### Governança do Produto

| ID | Título | Status |
|---|---|---|
| GOV-01 | Product Scope Governance Gate | **ATIVO** |
| DOC-GOV-01 | Baseline Institucional v1.0 | **PASS** |
| CTRL-01 | Product Control Map | **ATIVO** |
| MR-01 | Migration Readiness Assessment | **PASS** |
| SCALE-01 | National Scale and Capacity Readiness Assessment | **PASS** |
| TECH-SCALE-01 | Critical Scale Remediation Program | **PASS** |

### Incidentes e Bugs

| ID | Título | Status | Commit ref |
|---|---|---|---|
| BUG-CLINIC-01 | Platform access leak — dashboard zerado para usuários clínicos | **DONE** | `fa1606c` |

### Avaliações e Arquitetura

| ID | Título | Status | Commit ref |
|---|---|---|---|
| MR-01 | Migration Readiness Assessment | **PASS** | `docs/MR-01-migration-readiness-assessment.md` |

### Iniciativas Futuras (PLANNED — bloqueadas até piloto real)

| ID | Título | Status | Prerequisito |
|---|---|---|---|
| TECH-SCALE-01A | Shadow sync incremental (REM-01) | **PLANNED** | Imediata — pré ARCH-INT-01 |
| TECH-SCALE-01B | Bootstrap paginado + startup + pool + monitoring (REM-02–06) | **PLANNED** | Após TECH-SCALE-01A |
| ARCH-INT-01 | National Import and Interoperability Architecture | **PASS** | Modelo: PASS; API de ingestão: bloqueada até TECH-SCALE-01A |
| SP-PEC-01 | PEC APS Certified Source Profile | **PASS** | — |
| TECH-SCALE-01C | getAllowedPatients via shadow table SQL (REM-03) | **PLANNED** | Após piloto real |
| VAL-01 | Validation Engine | **PLANNED** | Após ARCH-INT-01 |
| STG-01 | Import Staging | **PLANNED** | Após VAL-01 |
| MIG-01 | Bulk Import API | **PLANNED** | Após STG-01 |
| MAP-01 | Mapping Engine | **PLANNED** | Após ARCH-INT-01 |
| MAP-PEC-01 | PEC APS Mapping Engine | **PASS** | 13 fases; UI-STG-01 e UI-HOMO-01 autorizados; commit bloqueado até TECH-SCALE-01A |
| UI-STG-01 | Import Staging Workbench | **PASS** | 9 fases; RBAC definido; UI-HOMO-01 autorizado; implementação bloqueada até TECH-SCALE-01A |
| UI-HOMO-01 | Import Homologation Center | **PASS** | GO/NO GO, four-eyes, Commit Gate, Risk Assessment; MIG-01 preparado conceitualmente |
| MIG-02 | Source Profile Registry | **PLANNED** | Após MIG-01 |
| ARCH-STORAGE-01 | Partição app_state por unitId + read replica | **PLANNED** | Após > 3 UBS em operação |
| ARCH-STORAGE-02 | Shadow tables como fonte autoritativa | **PLANNED** | Após ARCH-STORAGE-01 |

> Todas as iniciativas acima estão BLOQUEADAS até conclusão do Piloto Real UBS #1 e GOV-01 aprovado.

### Roadmap (não autorizado)

| ID | Título | Status | Motivo |
|---|---|---|---|
| APS-02A | Territorialização Inteligente | **NO GO** | GOV-01 pendente; requer piloto de 30 dias; perguntas de negócio sem resposta |

---

## Mapa de Dependências

```
APS-01A
  └─→ APS-01B
        └─→ APS-01C
              └─→ APS-01D
                    └─→ APS-01E
                          └─→ APS-01F
                                └─→ PRR-01A (CDS Export)

SEC-01
  └─→ AUD-01

SEC-API-01A → SEC-API-01B → SEC-API-01C → SEC-API-01D

ARCH-01 ──────────────────────────────────────────────┐
TECH-DEBT-01 ──────────────────────────────────────────┤
SEC-01 + AUD-01 ───────────────────────────────────────┤
                                                        ↓
IAM-01 (A→E)                                     Segurança Mínima ✓
  └─→ CONSOLE-01
        └─→ IMPLANT-01 + IMPLANT-01A
              └─→ HOMOLOG-01
                    └─→ [PILOTO REAL — pré-requisito não concluído]

INTEGRATION-GOV-01A ──────────→ [Integrações reais — bloqueado até piloto]

GOV-01 ────────────────────────→ [Qualquer nova iniciativa]
CTRL-01 ───────────────────────→ [Ponto único de verdade]
```

---

## Estado Atual do Produto (2026-06-23)

| Dimensão | Estado | Observação |
|---|---|---|
| Produto nacional? | **SIM** | Código agnóstico de município desde ARCH-01 |
| Multi-tenant? | **SIM** | Units + Teams + Team Scope isolado |
| RBAC concluído? | **SIM** | IAM-01 — 12 roles, capabilities granulares |
| Team Scope concluído? | **SIM** | APS-01A em diante |
| Console Nacional concluído? | **SIM** | CONSOLE-01 + IAM-01E |
| Implantação concluída? | **SIM** | IMPLANT-01/01A — playbook e workflow ativos |
| Homologação concluída? | **NÃO** | Critérios definidos (HOMOLOG-01); execução real com PEC pendente |
| Segurança mínima concluída? | **SIM** | SEC-01, AUD-01, SEC-API-01, IAM-01 |
| Integrações reais implementadas? | **NÃO** | CDS Export funcional; homologação com PEC real pendente |
| Arquitetura de integração implementada? | **SIM** | INTEGRATION-GOV-01A define o framework |

**Conclusão:** produto nacional pronto para piloto controlado. Bloqueio único: homologação com PEC em ambiente real e execução dos pré-requisitos operacionais listados no roadmap.

---

## Próxima Frente Autorizada

**PILOTO REAL — UBS #1**

Não é uma iniciativa nova. É a conclusão dos pré-requisitos já definidos.

Pré-requisitos pendentes (fonte: `docs/roadmap/README.md`):

- [ ] Completar homologação com PEC em ambiente real
- [ ] Realizar treinamento mínimo com ACS e enfermeiros
- [ ] Confirmar que CDS Export funciona com dados reais
- [ ] Validar LGPD (DPA assinado, privacidade operacional)
- [ ] Executar smoke completo em staging com dados reais (não seed)
- [ ] Documentar fluxo de suporte operacional para incidentes

Nenhuma iniciativa de funcionalidade nova pode ser aberta enquanto qualquer item acima estiver pendente.

---

## Itens Proibidos de Abertura

Os itens abaixo **não podem ser iniciados** enquanto o piloto real não estiver completo e nenhum deles pode ser aberto sem GOV-01 completo:

| Item | Motivo |
|---|---|
| APS-02A — Territorialização Inteligente | NO GO — GOV-01 pendente; requer piloto; perguntas de negócio abertas |
| Mapa territorial com polígonos de microárea | NO GO — sem valor operacional confirmado; sem piloto |
| Integração RNDS | NO GO — requer piloto estável; complexidade regulatória |
| App nativo mobile | NO GO — PWA já cobre campo; custo sem benefício confirmado |
| Relatórios PDF complexos | NO GO — sem demanda confirmada de campo |
| Dashboards epidemiológicos avançados | NO GO — sem dados reais; sem piloto |
| Integrações com sistemas externos (exceto e-SUS/CDS) | NO GO — definido em INTEGRATION-GOV-01A |
| Gamificação / indicadores de performance individual | NO GO — fora do escopo APS operacional |
| Módulo de gestão de medicamentos ACS | NO GO — ACS não prescreve |
| Agenda para ACS | NO GO — ACS não tem agenda clínica |
| Novos módulos clínicos | NO GO — aguarda observação de piloto real |
| Customizações municipais em código | NO GO — produto é configurável por dados, não por código |
| Population Selection Engine | NO GO — sem problema operacional definido |
| Mapping Engine | NO GO — sem problema operacional definido |
| Conectores específicos de sistemas externos | NO GO — aguarda INTEGRATION-GOV-01 completo |

---

## Critério de Abertura de Novas Iniciativas

Toda nova iniciativa deve responder **todas** as seguintes perguntas antes de ser registrada como PLANNED:

| # | Pergunta | Critério de bloqueio |
|---|---|---|
| 1 | Qual problema real da APS isso resolve? | Sem resposta concreta → NO GO |
| 2 | Qual usuário usa? Em que momento do dia? | Sem usuário identificado → NO GO |
| 3 | Como o usuário faz hoje sem o VITRAS? | Sem resposta → NO GO |
| 4 | Existe evidência de campo (relato, observação, dado)? | Sem evidência → NO GO |
| 5 | É necessário para o piloto ou pode esperar? | "Legal de ter" → NO GO |
| 6 | Qual pré-requisito CTRL-01 precisa estar PASS/DONE? | Pré-requisito aberto → BLOCKED |
| 7 | Existe algo reutilizável no produto atual? | Nova entidade sem justificativa → revisar |
| 8 | Qual risco técnico gera? | Risco LGPD/RBAC/CDS → revisão obrigatória |
| 9 | GOV-01 foi aplicado com resultado GO ou GO WITH LIMITS? | Sem GOV-01 → BLOCKED |

**Regra:** uma iniciativa que não obtiver SIM em todas as 9 perguntas não entra no CTRL-01 como PLANNED.

---

## Roadmap Executivo

### Fase 1 — Consolidação do Núcleo
**Status: CONCLUÍDA**

APS-01A–F, PRR-01A, SEC-01, AUD-01, ARCH-01, TECH-DEBT-01, IAM-01, CONSOLE-01

### Fase 2 — Operação Nacional
**Status: CONCLUÍDA (infraestrutura) / PENDENTE (execução real)**

IMPLANT-01/01A, HOMOLOG-01, INTEGRATION-GOV-01A — frameworks prontos; piloto real pendente

### Fase 3 — Documentação Funcional
**Status: PARCIALMENTE CONCLUÍDA**

ARCH-DOC-03 PASS. ARCH-DOC-01 e ARCH-DOC-02 REJECTED. Revisão possível após piloto com padrão comprovado.

### Fase 4 — Arquitetura Nacional de Integração
**Status: BLOQUEADA**

Depende de: Fase 2 concluída (piloto real). Framework INTEGRATION-GOV-01A existe; implementação depende de dados reais do piloto.

### Fase 5 — Integrações Reais
**Status: BLOQUEADA**

Depende de: Fase 4 concluída. Não autorizado antes de piloto estável.

### Fase 6 — Escala Nacional
**Status: BLOQUEADA**

Depende de: Fase 2 + Fase 5. Requer observação de 30 dias de operação real de pelo menos 1 UBS.

---

## Resultado CTRL-01

| Item | Resultado |
|---|---|
| Inventário do produto criado? | **SIM** |
| PASS catalogados? | **SIM** (22 iniciativas) |
| DONE catalogados? | **SIM** (1 incidente) |
| NO GO catalogados? | **SIM** (APS-02A + 13 itens proibidos) |
| Rejeições catalogadas? | **SIM** (ARCH-DOC-01, ARCH-DOC-02) |
| Dependências catalogadas? | **SIM** |
| Estado atual documentado? | **SIM** |
| Próxima frente definida? | **SIM** (Piloto Real — pré-requisitos pendentes) |
| Itens proibidos definidos? | **SIM** |
| Critério de abertura definido? | **SIM** (9 perguntas obrigatórias) |
| Roadmap definido? | **SIM** (6 macrofases) |
| **Status CTRL-01** | **PASS** |

---

## Lição Consolidada

O risco atual do VITRAS APS não é técnico.

O produto tem RBAC, Team Scope, Console Nacional, Implantação e Segurança mínima concluídos.

O risco é dispersão de escopo antes do piloto real.

Este documento é a barreira operacional contra isso.

Toda decisão futura parte do estado registrado aqui.
