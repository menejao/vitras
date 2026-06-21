# DOCUMENTATION_VERSION

**Produto:** VITRAS APS  
**Documento:** Registro Oficial de Versão  
**Classe:** NORMATIVO  
**Owner:** Delivery Governor  
**Revisão:** Por versão

---

## Versão Atual

| Campo | Valor |
|-------|-------|
| **Versão institucional** | **v1.0** |
| **Data de emissão** | 2026-06-21 |
| **Status** | VIGENTE |
| **Commit de referência** | `18fe424` |
| **Branch** | `main` |
| **Aprovador** | Delivery Governor |

---

## Componentes da Versão v1.0

| Componente | Versão | Status |
|------------|--------|--------|
| Produto (institutional) | v1.0 | VIGENTE |
| Backend (Node.js) | Commit `18fe424` | VIGENTE |
| Frontend (React/Vite) | Commit `18fe424` | VIGENTE |
| Protocolo e-SUS / LEDI | 7.4.0 | VIGENTE |
| OpenAPI | 1.0 | VIGENTE |
| Playbook de implantação | 1.0 | VIGENTE |
| Baseline institucional (DOC-GOV-01) | 1.0 | VIGENTE |

---

## Auditorias Certificadas na v1.0

| Auditoria | Resultado | Data | Referência |
|-----------|-----------|------|-----------|
| PRODUCT-READINESS-01 | **GO** | 2026-06-21 | `cds-structs.js` G-01 fixed |
| TECH-DEBT-01 | **PASS** | 2026-06-21 | Commits `a2ed47d` |
| ARCH-01 — Depilotization | **PASS** | 2026-06-21 | Commit `755aa37` |
| IMPLANT-01 — Playbook | **PASS** | 2026-06-21 | Commit `18fe424` |
| DOC-GOV-01 — Baseline | **EMITIDA** | 2026-06-21 | Este documento |

---

## Sprints Entregues na v1.0

| Sprint | Título | Status |
|--------|--------|--------|
| APS-01A | ACS Workspace — estrutura base | PASS |
| APS-01B | Tarefas e Agenda ACS | PASS |
| APS-01C | Visitas ACS com persistência real | PASS |
| APS-01D | Grupo Familiar Workspace | PASS |
| APS-01E | Busca Ativa Inteligente (score 0–100) | PASS |
| APS-01F | Produção ACS Automática (4 APIs) | PASS |
| PRR-01A | CDS Export — 4 fichas LEDI APS 7.4.0 | PASS |
| SEC-API-01D | Data Minimization + GetById | PASS |
| AUD-01 | Audit hash chain + LGPD | PASS |
| GOV-01 | Product Scope Governance Gate | ATIVO |

---

## Implantações Ativas

| UBS ID | Município | Estado | Go-Live | Status |
|--------|-----------|--------|---------|--------|
| *(nenhuma implantação ativa em produção real em 2026-06-21)* | | | | |

> Esta tabela é atualizada a cada go-live de UBS em produção real.

---

## Próxima Versão Planejada

| Versão | Conteúdo previsto | Pré-requisito |
|--------|------------------|---------------|
| v1.1 | APS-02A — Territorialização Inteligente | GOV-01 com GO (atualmente NO GO — 3 bloqueadores) |
| v2.0 | Integração RNDS; app nativo mobile | Piloto real ≥ 30 dias + GOV-01 |

---

## Como Atualizar Este Documento

Este documento é atualizado **somente** nas seguintes situações:

1. Nova versão MINOR ou MAJOR do produto é lançada
2. Nova UBS entra em operação real
3. Uma UBS existente encerra operação
4. Uma auditoria formal muda de status

**Processo:** abrir PR com label `version-update` → aprovação do Delivery Governor → merge.

---

## Histórico de Versões

| Versão | Data | Mudança |
|--------|------|---------|
| 1.0 | 2026-06-21 | Criação — Baseline Institucional v1.0 emitida |
