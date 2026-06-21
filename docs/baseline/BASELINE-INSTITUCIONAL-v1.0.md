# BASELINE INSTITUCIONAL VITRAS APS
## Versão 1.0

**Produto:** VITRAS APS — Plataforma Nacional de Atenção Primária à Saúde  
**Data de emissão:** 2026-06-21  
**Status:** VIGENTE  
**Aprovador:** Delivery Governor  
**Documento:** DOC-GOV-01

---

## SUMÁRIO

1. [Declaração Institucional](#1-declaração-institucional)
2. [Estrutura Documental Oficial](#2-estrutura-documental-oficial)
3. [Política de Versionamento Documental](#3-política-de-versionamento-documental)
4. [Classificação Documental](#4-classificação-documental)
5. [Matriz de Ownership](#5-matriz-de-ownership)
6. [Política de Revisão](#6-política-de-revisão)
7. [Matriz de Rastreabilidade](#7-matriz-de-rastreabilidade)
8. [Governança de Implantações](#8-governança-de-implantações)
9. [Parecer Final](#9-parecer-final)

---

## 1. Declaração Institucional

### 1.1 Identidade do Produto

O **VITRAS APS** é uma plataforma nacional de gestão de Atenção Primária à Saúde (APS), desenvolvida para operar em Unidades Básicas de Saúde (UBS) de qualquer município do Brasil.

O produto é:

- **Nacional** — opera em qualquer município, sem dependência de localidade
- **Configurável** — toda implantação ocorre por configuração de dados, nunca por alteração de código
- **Interoperável** — compatível com e-SUS APS via protocolo LEDI APS 7.4.0
- **Multi-UBS / Multi-equipe** — suporta múltiplas unidades e equipes de saúde isoladas
- **Aderente à legislação** — LGPD, PNAB 2017, CFM 1821/2007, RNDS/MS

### 1.2 Separação Produto / Implantação

| Categoria | Definição | Onde vive |
|-----------|-----------|-----------|
| **Produto** | Regras nacionais, código, arquitetura, protocolos | `docs/` (exceto `rollout/`) |
| **Implantação** | Dados locais de uma UBS específica | `docs/rollout/[ubs-id]/` |

Nenhum dado de CNES, IBGE, INE, município ou UBS específica pertence ao domínio do produto.

### 1.3 Status Certificado em 2026-06-21

| Auditoria | Resultado | Data |
|-----------|-----------|------|
| PRODUCT-READINESS-01 | **GO** | 2026-06-21 |
| TECH-DEBT-01 | **PASS** | 2026-06-21 |
| ARCH-01 — Depilotization | **PASS** | 2026-06-21 |
| IMPLANT-01 — Playbook | **PASS** | 2026-06-21 |

### 1.4 Aderência Regulatória

| Framework | Norma | Cobertura |
|-----------|-------|-----------|
| Ministério da Saúde | PNAB 2017 | Protocolos por categoria de cuidado |
| e-SUS APS | LEDI APS 7.4.0 | 4 fichas CDS, 54 códigos LEDI validados |
| LGPD | Lei 13.709/2018 | Art. 6, 7, 9, 11, 18, 41 — base legal, minimização, auditoria, direitos |
| CFM | Resolução 1821/2007 | Retenção de prontuário eletrônico — 20 anos |
| ANPD | Regulamento de incidentes | Notificação em 72h documentada |

---

## 2. Estrutura Documental Oficial

### 2.1 Árvore de Documentação

```
docs/
├── baseline/                    # NORMATIVO — Baseline institucional e governança central
│   ├── BASELINE-INSTITUCIONAL-v1.0.md
│   ├── DOCUMENTATION_VERSION.md
│   ├── CHANGELOG.md
│   └── pre-sprint5-snapshot-registry.md
│
├── governanca/                  # NORMATIVO — Gates, políticas e limites do produto
│   ├── 01-politica-lgpd-minima.md
│   ├── 02-rotina-semanal-0800.md
│   ├── 03-resposta-incidente-0800.md
│   ├── 04-checklist-go-live-ubs.md
│   ├── 05-rotina-mensal-auditoria.md
│   └── 06-gov-01-product-scope-governance.md
│
├── implantacao/                 # OPERACIONAL — Playbook reutilizável para qualquer UBS
│   ├── README.md
│   ├── 01-requisitos-minimos-ubs.md
│   ├── 02-configuracao-tecnica.md
│   ├── 03-roteiro-homologacao-funcional.md
│   ├── 04-homologacao-esus-cds.md
│   ├── 05-lgpd-seguranca.md
│   ├── 06-plano-treinamento.md
│   ├── 07-checklist-go-live.md
│   └── 08-pos-go-live.md
│
├── rollout/                     # IMPLANTAÇÃO — Registros por UBS (nunca tocam produto)
│   └── [ubs-id]/                # Um diretório por implantação
│       ├── requisitos-preenchidos.md
│       ├── configuracao-aplicada.md
│       ├── homologacao-funcional.md
│       ├── homologacao-cds.md
│       ├── lgpd.md
│       ├── treinamento.md
│       ├── go-live.md
│       └── pos-live.md
│
├── arquitetura/                 # TÉCNICO — Decisões e estrutura do sistema
│   ├── overview.md
│   ├── domain-map.md
│   └── (ADRs migrados para docs/adr/)
│
├── adr/                         # TÉCNICO — Architecture Decision Records
│   └── ADR-*.md
│
├── seguranca/                   # REGULATÓRIO — Auditorias e planos de segurança
│   ├── AUDITORIA_PRODUCAO_SEGURANCA.md
│   ├── PHASE1_SECURITY_REPORT.md
│   ├── PHASE3_SECURITY_ADVANCED_REPORT.md
│   ├── SECRETS_ROTATION.md
│   └── KEY_ROTATION_PLAN.md
│
├── lgpd/                        # REGULATÓRIO — Conformidade e operação LGPD
│   ├── LGPD_COMPLIANCE_CHECKLIST.md
│   └── LGPD_OPERATIONS.md
│
├── roadmap/                     # NORMATIVO — Evolução do produto (GOV-01 gate)
│   └── README.md
│
├── openapi.yaml                 # TÉCNICO — Contrato de API (fonte única)
│
├── runbooks/                    # OPERACIONAL — Procedimentos de operação
│   ├── backup-restore-runbook.md
│   ├── eb-deploy-reproducibility.md
│   ├── eb-secrets-audit.md
│   ├── incidents.md
│   ├── key-rotation.md
│   └── observability.md
│
├── operations/                  # OPERACIONAL — Rotinas e relatórios operacionais
│   ├── RUNBOOK_OPERACIONAL.md
│   ├── MONITORING_ALERTING.md
│   ├── STAGING_ENVIRONMENT.md
│   └── rollout-plan.md
│
├── onboarding/                  # TREINAMENTO — Onboarding técnico de novos membros
│   ├── backend.md
│   ├── frontend.md
│   └── first-admin.md
│
├── releases/                    # HISTÓRICO — Changelog e release notes
│   ├── CHANGELOG.md
│   └── v1.0-pilot-governed-release-notes.md
│
├── deployment/                  # TÉCNICO — Infra, AWS, CI/CD
│   ├── GO_LIVE_CHECKLIST.md
│   ├── PAID_INFRA_CHECKLIST.md
│   └── aws-cloudflare.md
│
├── ai/                          # TÉCNICO — Mapas para assistentes de IA (interno)
│   ├── entities-map.md
│   ├── frontend-pages-map.md
│   ├── rbac-matrix.md
│   ├── routes-map.md
│   └── system-context.md
│
├── reports/                     # HISTÓRICO — Relatórios de fases e auditorias
│   └── PHASE*.md
│
└── disaster-recovery.md         # OPERACIONAL — Plano de DR
```

### 2.2 Finalidade por Área

| Área | Classificação | Finalidade | Público |
|------|--------------|------------|---------|
| `baseline/` | NORMATIVO | Fonte única da verdade institucional; governança e versionamento | Delivery Governor, auditores |
| `governanca/` | NORMATIVO | Gates obrigatórios, políticas permanentes, limites de escopo | Todos |
| `implantacao/` | OPERACIONAL | Playbook reutilizável para qualquer UBS; nunca contém dados locais | Tech Lead, APS Specialist |
| `rollout/` | IMPLANTAÇÃO | Registro por UBS: evidências, checklists assinados, histórico | Delivery Governor, UBS |
| `arquitetura/` | TÉCNICO | Visão técnica do sistema; decisões arquiteturais registradas | Tech Lead, Dev |
| `adr/` | TÉCNICO | Decisões arquiteturais com contexto e consequências | Tech Lead |
| `seguranca/` | REGULATÓRIO | Auditorias de segurança, planos de rotação de chaves | Security Lead, auditores |
| `lgpd/` | REGULATÓRIO | Conformidade LGPD, operações de privacidade | DPO, Security Lead |
| `roadmap/` | NORMATIVO | Evolução controlada pelo GOV-01; sem features sem parecer | Delivery Governor, BA |
| `openapi.yaml` | TÉCNICO | Contrato único de API; fonte de verdade para integrações | Dev, QA |
| `runbooks/` | OPERACIONAL | Procedimentos operacionais de emergência e rotina | Tech Lead, DevOps |
| `operations/` | OPERACIONAL | Rotinas e relatórios de operação contínua | DevOps, Delivery |
| `onboarding/` | TREINAMENTO | Integração de novos membros técnicos | Novos devs |
| `releases/` | HISTÓRICO | Registro de versões; rastreabilidade de mudanças | Todos |
| `deployment/` | TÉCNICO | Infraestrutura, AWS, processo de deploy | DevOps, Tech Lead |
| `ai/` | TÉCNICO | Contexto para ferramentas de assistência (interno) | Dev |
| `reports/` | HISTÓRICO | Relatórios de auditorias e fases concluídas | Delivery Governor |

---

## 3. Política de Versionamento Documental

### 3.1 Formato

```
v[MAJOR].[MINOR].[PATCH]

Exemplo: v1.2.3
```

### 3.2 Critérios de Mudança

| Tipo | Quando usar | Exemplo |
|------|-------------|---------|
| **MAJOR** (v**2**.0.0) | Mudança de arquitetura que quebra compatibilidade; mudança regulatória fundamental; redesenho de processo | Mudança do protocolo LEDI para versão incompatível; adoção de banco relacional diferente; nova base legal LGPD |
| **MINOR** (v1.**2**.0) | Nova funcionalidade ou sprint entregue; novo módulo adicionado; novo documento normativo criado | Entrega de APS-02A; novo runbook; novo módulo de territorialização |
| **PATCH** (v1.1.**3**) | Correção de bug documentado; atualização de texto sem mudança de regra; atualização de link ou referência | Fix de hardcode IBGE; correção de erro em checklist; atualização de URL |

### 3.3 Versionamento de Documentos Individuais

Cada documento normativo e regulatório deve conter no cabeçalho:

```markdown
**Versão:** 1.2  
**Data:** 2026-06-21  
**Status:** VIGENTE | RASCUNHO | OBSOLETO  
**Substitui:** v1.1 (2026-03-15)
```

### 3.4 Regras de Versionamento

1. **Nunca deletar** versões anteriores — mover para `docs/historico/[arquivo]-v[versão].md`
2. **Toda mudança MAJOR** requer aprovação do Delivery Governor com parecer escrito
3. **Toda mudança MINOR** requer revisão do owner do documento e do Tech Lead
4. **Toda mudança PATCH** pode ser feita pelo owner com revisão em PR
5. **Versão do produto** é a versão do `DOCUMENTATION_VERSION.md`, não do código

### 3.5 Baseline vs. Versão de Código

| Conceito | Controlado por | Formato |
|----------|---------------|---------|
| Versão do produto (institutional) | `DOCUMENTATION_VERSION.md` | `v1.0`, `v1.1` |
| Versão do código (software) | `package.json` + git tags | semver: `1.0.0` |
| Versão da API | `openapi.yaml` | `1.0` |
| Versão dos docs | Cabeçalho de cada arquivo | `1.0`, `1.1` |

---

## 4. Classificação Documental

### 4.1 Taxonomia Oficial

| Classe | Código | Definição | Aprovador | Periodicidade de revisão |
|--------|--------|-----------|-----------|--------------------------|
| **NORMATIVO** | N | Define regras obrigatórias, gates e políticas permanentes do produto | Delivery Governor | Anual ou quando a regra muda |
| **OPERACIONAL** | O | Descreve como executar processos recorrentes | Tech Lead + Delivery Governor | Semestral |
| **TÉCNICO** | T | Documenta decisões técnicas, arquitetura e contratos de API | Tech Lead | Por sprint relevante |
| **TREINAMENTO** | TR | Material para capacitação de usuários e equipe técnica | Training Lead | Anual ou quando fluxo muda |
| **REGULATÓRIO** | R | Conformidade com legislação (LGPD, CFM, MS) | Security/LGPD Lead | Anual ou quando lei muda |
| **HISTÓRICO** | H | Registro imutável de decisões, auditorias e versões passadas | Qualquer owner | Nunca revisado — apenas arquivado |
| **IMPLANTAÇÃO** | I | Registro de uma implantação específica (pertence a `rollout/[ubs-id]/`) | Delivery Governor | Por evento de implantação |

### 4.2 Exemplos por Classe

| Documento | Classe |
|-----------|--------|
| `06-gov-01-product-scope-governance.md` | N |
| `BASELINE-INSTITUCIONAL-v1.0.md` | N |
| `01-politica-lgpd-minima.md` | N |
| `implantacao/02-configuracao-tecnica.md` | O |
| `runbooks/backup-restore-runbook.md` | O |
| `openapi.yaml` | T |
| `arquitetura/overview.md` | T |
| `adr/ADR-002-canAccessPatient.md` | T |
| `implantacao/06-plano-treinamento.md` | TR |
| `onboarding/backend.md` | TR |
| `lgpd/LGPD_COMPLIANCE_CHECKLIST.md` | R |
| `seguranca/PHASE3_SECURITY_ADVANCED_REPORT.md` | H |
| `reports/PHASE5_PRODUCTION_OPERATIONS_REPORT.md` | H |
| `rollout/ubs-001/go-live.md` | I |

### 4.3 Regras por Classe

**NORMATIVO:**
- Exige aprovação do Delivery Governor para qualquer mudança
- Versionamento obrigatório no cabeçalho
- Não pode ser deletado — apenas substituído e arquivado

**OPERACIONAL:**
- Exige teste de aderência antes de publicar (o processo descrito funciona?)
- Deve conter exemplos reais de preenchimento
- Revisão semestral mínima

**TÉCNICO:**
- Deve referenciar commits ou PRs de implementação
- Decisões arquiteturais devem usar formato ADR
- Não substituir código por documentação — ambos coexistem

**REGULATÓRIO:**
- Deve citar artigo de lei explicitamente
- Deve ter parecer do responsável legal ou DPO quando aplicável
- Mudança requer evidência de nova norma legal

**HISTÓRICO:**
- Imutável após publicação
- Nunca editar; arquivar nova versão ao lado da original

---

## 5. Matriz de Ownership

### 5.1 Ownership por Documento

| Documento | Classe | Owner | Aprovador | Revisão |
|-----------|--------|-------|-----------|---------|
| `BASELINE-INSTITUCIONAL-v1.0.md` | N | Delivery Governor | Delivery Governor | Anual |
| `DOCUMENTATION_VERSION.md` | N | Delivery Governor | Delivery Governor | Por versão |
| `CHANGELOG.md` | H | Tech Lead | Delivery Governor | Por release |
| `06-gov-01-product-scope-governance.md` | N | Delivery Governor | Delivery Governor | Anual |
| `01-politica-lgpd-minima.md` | N | Security/LGPD Lead | DPO + Delivery Governor | Anual |
| `02-rotina-semanal-0800.md` | O | Delivery Governor | Delivery Governor | Semestral |
| `03-resposta-incidente-0800.md` | O | Security/LGPD Lead | Delivery Governor | Semestral |
| `04-checklist-go-live-ubs.md` | O | Tech Lead | Delivery Governor | Por implantação major |
| `05-rotina-mensal-auditoria.md` | O | Security/LGPD Lead | Delivery Governor | Semestral |
| `implantacao/README.md` | O | Delivery Governor | Delivery Governor | Por versão major |
| `implantacao/01-requisitos-minimos-ubs.md` | O | Business Analyst | Delivery Governor | Semestral |
| `implantacao/02-configuracao-tecnica.md` | O | Tech Lead | Tech Lead | Por sprint relevante |
| `implantacao/03-roteiro-homologacao-funcional.md` | O | QA Senior | Delivery Governor | Semestral |
| `implantacao/04-homologacao-esus-cds.md` | O | APS Specialist | Delivery Governor | Por versão LEDI |
| `implantacao/05-lgpd-seguranca.md` | R | Security/LGPD Lead | DPO | Anual |
| `implantacao/06-plano-treinamento.md` | TR | Training Lead | Delivery Governor | Anual |
| `implantacao/07-checklist-go-live.md` | O | Delivery Governor | Delivery Governor | Por implantação |
| `implantacao/08-pos-go-live.md` | O | Delivery Governor | Delivery Governor | Semestral |
| `openapi.yaml` | T | Tech Lead | Tech Lead | Por sprint API |
| `arquitetura/overview.md` | T | Tech Lead | Tech Lead | Por mudança arquitetural |
| `adr/*.md` | T | Tech Lead | Tech Lead | Imutável após decisão |
| `roadmap/README.md` | N | Delivery Governor | Delivery Governor | Por GOV-01 |
| `seguranca/SECRETS_ROTATION.md` | R | Security/LGPD Lead | Delivery Governor | Por rotação |
| `lgpd/LGPD_COMPLIANCE_CHECKLIST.md` | R | Security/LGPD Lead | DPO | Anual |
| `runbooks/*.md` | O | Tech Lead | Tech Lead | Semestral |
| `onboarding/*.md` | TR | Tech Lead | Tech Lead | Semestral |
| `rollout/[ubs-id]/*.md` | I | Delivery Governor (implantação) | Delivery Governor | Por evento |

### 5.2 Papéis e Responsabilidades

| Papel | Responsabilidade |
|-------|-----------------|
| **Delivery Governor** | Autoriza mudanças NORMATIVAS; emite decisões GO/NO GO; aprova baseline |
| **Tech Lead** | Owner de documentos TÉCNICOS; responsável por aderência técnica |
| **Business Analyst** | Owner dos requisitos de implantação; ponte com SMS/UBS |
| **APS Specialist** | Owner do conteúdo clínico e CDS; valida aderência à PNAB |
| **QA Senior** | Owner dos roteiros de homologação; garante testabilidade |
| **Security/LGPD Lead** | Owner dos documentos REGULATÓRIOS; valida LGPD e segurança |
| **Training Lead** | Owner do material de treinamento; conduz capacitações |
| **DevOps Lead** | Owner de runbooks operacionais e deployment |

---

## 6. Política de Revisão

### 6.1 Revisão por Classe

| Classe | Periodicidade | Gatilho adicional |
|--------|--------------|-------------------|
| NORMATIVO | **Anual** (Janeiro) | Mudança de lei, norma MS, ou decisão do Delivery Governor |
| OPERACIONAL | **Semestral** (Janeiro e Julho) | Nova implantação major; mudança de processo identificada em campo |
| TÉCNICO | **Por sprint relevante** | Mudança de API, arquitetura, ou protocolo externo |
| TREINAMENTO | **Anual** (Março) | Feedback de treinamento identificando lacunas; mudança de fluxo |
| REGULATÓRIO | **Anual** (Janeiro) | Publicação de nova lei, regulamento ANPD, resolução CFM ou MS |
| HISTÓRICO | **Nunca** — imutável | Não se aplica |
| IMPLANTAÇÃO | **Por evento** | Cada nova UBS gera seus próprios documentos; não revisam os globais |

### 6.2 Processo de Revisão

```
1. Owner identifica necessidade de revisão (gatilho ou calendário)
2. Owner cria branch de revisão: docs/review/[nome-doc]-v[nova-versão]
3. Owner atualiza documento com nova versão no cabeçalho
4. Owner abre PR com label "doc-review"
5. Aprovador revisa e aprova ou solicita mudanças
6. PR mergeado → versão anterior movida para docs/historico/
7. CHANGELOG.md atualizado com mudança
8. DOCUMENTATION_VERSION.md atualizado se mudança for MINOR ou MAJOR
```

### 6.3 Critério de Obsolescência

Um documento é declarado **OBSOLETO** quando:

- É substituído por nova versão
- A funcionalidade que documenta é removida do produto
- Uma mudança regulatória invalida seu conteúdo

Documentos OBSOLETOS:
- Recebem `**Status:** OBSOLETO` no cabeçalho
- São movidos para `docs/historico/`
- São referenciados pelo documento substituto com link

---

## 7. Matriz de Rastreabilidade

### 7.1 Padrão de Rastreabilidade

Toda funcionalidade do produto deve ser rastreável da origem à operação:

```
Requisito regulatório / problema operacional
        ↓
GOV-01 (parecer de aprovação)
        ↓
Sprint / Épica (ID: APS-XX)
        ↓
Código (branch → commit → PR)
        ↓
Teste de integração (backend/test/[módulo].test.js)
        ↓
Homologação funcional (HF-XX em docs/rollout/[ubs-id]/)
        ↓
Deploy (versão EB + tag git)
        ↓
Operação (audit log de produção)
```

### 7.2 Rastreabilidade das Funcionalidades v1.0

| Funcionalidade | Requisito | GOV-01 | Sprint | Teste | Deploy |
|---------------|-----------|--------|--------|-------|--------|
| Cadastro Individual | PNAB / FCI e-SUS | Baseline APS-01 | APS-01A | `cadastro-individual.test.js` | v1.0 |
| Cadastro Domiciliar | PNAB / FCD e-SUS | Baseline APS-01 | APS-01A | `cadastro-domiciliar.test.js` | v1.0 |
| Visita ACS | PNAB / FVD e-SUS | Baseline APS-01 | APS-01C | `acs-visits.test.js` | v1.0 |
| Busca Ativa | PNAB Art. 38 | Baseline APS-01 | APS-01E | `active-search.test.js` | v1.0 |
| Produção ACS | e-SUS / indicadores MS | Baseline APS-01 | APS-01F | `production-metrics.test.js` | v1.0 |
| CDS Export — CI | LEDI APS 7.4.0 | Baseline APS-01 | PRR-01A | `cadastro-individual.test.js` | v1.0 |
| CDS Export — CDT | LEDI APS 7.4.0 | Baseline APS-01 | PRR-01A | `cadastro-domiciliar.test.js` | v1.0 |
| CDS Export — VD | LEDI APS 7.4.0 | Baseline APS-01 | PRR-01A | `acs-visits.test.js` | v1.0 |
| RBAC multi-role | LGPD Art. 46 | Baseline APS-01 | APS-01A | `auth.test.js` | v1.0 |
| Team Scope | LGPD Art. 6, 49 | Baseline APS-01 | APS-01A | `patients.test.js` | v1.0 |
| Auditoria hash chain | LGPD Art. 37 | Baseline APS-01 | AUD-01 | `encryption.test.js` | v1.0 |
| 2FA TOTP | Segurança operacional | Baseline APS-01 | SEC-01 | `twofa.test.js` | v1.0 |
| LGPD — Anonimização | LGPD Art. 18, IV | Baseline APS-01 | F7-02 | `patients.test.js` | v1.0 |
| Break Glass | LGPD Art. 46 | Baseline APS-01 | SEC-01 | `auth.test.js` | v1.0 |
| Família (Workspace) | PNAB / cadastro territorial | Baseline APS-01 | APS-01D | `family-groups-workspace.test.js` | v1.0 |

### 7.3 Rastreabilidade de Decisões Arquiteturais

| Decisão | Documento | Commit de referência |
|---------|-----------|---------------------|
| JSON file DB como persistência primária | `arquitetura/overview.md` | baseline |
| PostgreSQL como shadow table / auditoria | `adr/` | APS-01 |
| JWT 15min + refresh 7d | `arquitetura/overview.md` | SEC-01 |
| LEDI APS 7.4.0 Thrift TBinaryProtocol | `implantacao/04-homologacao-esus-cds.md` | PRR-01A |
| MUNICIPALITY_ID via env var (não hardcode) | `docs/baseline/BASELINE-INSTITUCIONAL-v1.0.md` | ARCH-01 `755aa37` |
| rejectUnauthorized=true em TLS Postgres | `docs/baseline/BASELINE-INSTITUCIONAL-v1.0.md` | TECH-DEBT-01 `a2ed47d` |
| Advisory lock em migration runner | `backend/src/migrations/runner.js` | TECH-DEBT-01 `a2ed47d` |

### 7.4 Identificadores de Rastreabilidade

| Prefixo | Tipo | Exemplo |
|---------|------|---------|
| `APS-` | Sprint de produto | APS-01A, APS-01F, APS-02A |
| `GOV-` | Parecer de governança | GOV-01 |
| `SEC-` | Sprint de segurança | SEC-01, SEC-API-01D |
| `PRR-` | Sprint de prontidão | PRR-01A |
| `AUD-` | Sprint de auditoria | AUD-01 |
| `TECH-DEBT-` | Sprint de débito técnico | TECH-DEBT-01 |
| `ARCH-` | Auditoria arquitetural | ARCH-01 |
| `IMPLANT-` | Sprint de implantação | IMPLANT-01 |
| `DOC-GOV-` | Documento de governança | DOC-GOV-01 |
| `HF-` | Teste de homologação funcional | HF-01 a HF-09 |
| `EC-` | Teste de homologação CDS | EC-01 a EC-05 |
| `GL-` | Item de checklist go-live | GL-A a GL-G |

---

## 8. Governança de Implantações

### 8.1 Princípio

Cada implantação em uma UBS produz documentos locais em `docs/rollout/[ubs-id]/`.  
Esses documentos **nunca** modificam o playbook global de `docs/implantacao/`.  
O playbook global é o produto. Os registros em `rollout/` são a implantação.

### 8.2 Criação de Registro de Implantação

Ao iniciar uma nova implantação:

```bash
# 1. Definir o ubs-id (único, descritivo, sem dados sensíveis)
# Formato: [tipo]-[localidade]-[sequencial]
# Exemplos: ubs-centro-fortaleza-01, ubs-alto-ribeirao-01, ubs-jardim-manaus-03

# 2. Criar diretório
mkdir docs/rollout/[ubs-id]/

# 3. Copiar templates do playbook
cp docs/implantacao/01-requisitos-minimos-ubs.md docs/rollout/[ubs-id]/requisitos.md
cp docs/implantacao/03-roteiro-homologacao-funcional.md docs/rollout/[ubs-id]/homologacao-funcional.md
cp docs/implantacao/04-homologacao-esus-cds.md docs/rollout/[ubs-id]/homologacao-cds.md
cp docs/implantacao/05-lgpd-seguranca.md docs/rollout/[ubs-id]/lgpd.md
cp docs/implantacao/06-plano-treinamento.md docs/rollout/[ubs-id]/treinamento.md
cp docs/implantacao/07-checklist-go-live.md docs/rollout/[ubs-id]/go-live.md
cp docs/implantacao/08-pos-go-live.md docs/rollout/[ubs-id]/pos-live.md

# 4. Preencher dados reais nos documentos copiados (CNES, INE, profissionais, etc.)
# 5. Nunca editar docs/implantacao/ com dados locais
```

### 8.3 Estrutura de Registros por UBS

```
docs/rollout/[ubs-id]/
├── requisitos.md          → Cópia de 01 preenchida com dados reais
├── configuracao.md        → Registro das env vars aplicadas (sem secrets)
├── homologacao-funcional.md → Roteiro HF-01 a HF-09 executado e assinado
├── homologacao-cds.md     → Roteiro EC-01 a EC-05 executado e assinado
├── lgpd.md                → Checklist LGPD preenchido e assinado pelo DPO
├── treinamento.md         → Listas de presença + checklists de aprovação
├── go-live.md             → Checklist GL-A a GL-G + decisão assinada
└── pos-live.md            → Relatórios D+1, D+7, D+30
```

### 8.4 O que Fica Global vs. Local

| Item | Global (`docs/implantacao/`) | Local (`docs/rollout/[ubs-id]/`) |
|------|------------------------------|----------------------------------|
| Playbook de implantação | ✅ | — |
| Dados do município (IBGE, nome) | — | ✅ |
| Dados da UBS (CNES, nome, endereço) | — | ✅ |
| Lista de profissionais | — | ✅ |
| Relatórios de homologação assinados | — | ✅ |
| Checklist go-live assinado | — | ✅ |
| Relatórios pós go-live | — | ✅ |
| Contratos (DPA) | — | ✅ (referência) |
| Decisão GO/NO GO | — | ✅ |

### 8.5 Atualização do Registro de Implantações Ativas

O arquivo `docs/baseline/DOCUMENTATION_VERSION.md` mantém a lista de UBS em operação.

### 8.6 Regras de Nomenclatura de UBS-ID

| Regra | Correto | Incorreto |
|-------|---------|-----------|
| Minúsculas, sem acentos | `ubs-centro-fortaleza-01` | `UBS-Centro-Fortaleza-01` |
| Sem CNES, sem CPF, sem dados sensíveis | `ubs-norte-01` | `ubs-1234567-joao` |
| Sequencial por localidade | `ubs-jardim-01`, `ubs-jardim-02` | `ubs-a`, `ubs-v2` |
| Sem nome de profissional | `ubs-bairro-central-01` | `ubs-dr-fulano` |

---

## 9. Parecer Final

### 9.1 Avaliação da Baseline Institucional

| Critério | Resultado | Evidência |
|----------|-----------|-----------|
| O VITRAS APS possui baseline institucional completa? | **SIM** | Este documento (`DOC-GOV-01`) + 9 documentos de implantação + governança |
| Existe estrutura para crescimento nacional? | **SIM** | `docs/rollout/[ubs-id]/` escalável para N implantações; playbook único reutilizável |
| Existe processo de governança documental? | **SIM** | Matriz de ownership + política de revisão + versionamento semântico |
| Existe processo de rastreabilidade? | **SIM** | Identificadores de rastreabilidade + matriz completa v1.0 |
| Existe processo de implantação reutilizável? | **SIM** | `docs/implantacao/` — 8 documentos + README aplicáveis a qualquer UBS |

### 9.2 Versão Institucional Oficial

**VITRAS APS v1.0**

Esta versão representa o produto em seu primeiro estado certificado para implantação nacional.

| Componente | Versão | Status |
|------------|--------|--------|
| Produto (institutional) | **v1.0** | VIGENTE |
| Código backend | Commit `18fe424` | VIGENTE |
| Protocolo e-SUS | LEDI APS 7.4.0 | VIGENTE |
| API (OpenAPI) | 1.0 | VIGENTE |
| Playbook de implantação | 1.0 | VIGENTE |

### 9.3 Parecer de Completude

O VITRAS APS v1.0, na data de emissão deste documento, satisfaz integralmente os seguintes critérios:

**Funcionalidade:**
- Cadastro Individual, Domiciliar e Territorial — conforme PNAB e FCI/FCD e-SUS
- Visita ACS — conforme FVD e-SUS e LEDI APS 7.4.0
- Busca Ativa — score 0-100, 8 regras, 22 condições de busca ativa
- Produção automática ACS/Enfermeiro/Gestor — 4 endpoints
- Exportação CDS — 4 fichas, Thrift TBinaryProtocol, 54 códigos LEDI validados

**Segurança:**
- JWT 15min + refresh 7d + CSRF
- RBAC com 12 roles e capabilities granulares
- Team scope — isolamento multi-equipe
- 2FA TOTP para perfis críticos
- Audit log com hash chain SHA-256 imutável
- Break Glass auditado

**Conformidade:**
- LGPD Art. 6, 7, 9, 11, 18, 41 — base legal, minimização, auditoria, direitos
- CFM 1821/2007 — retenção 20 anos
- PNAB 2017 — protocolos por categoria
- e-SUS APS LEDI 7.4.0 — interoperabilidade

**Arquitetura:**
- Nenhum hardcode de município, CNES, INE ou UBS específica
- Toda implantação por configuração (env vars + API admin)
- Multi-UBS, multi-equipe, nacional

**Governança:**
- GOV-01 ativo — gate obrigatório para toda nova funcionalidade
- Baseline institucional documentada e versionada
- Playbook de implantação reutilizável
- Processo de revisão documental definido

### 9.4 Decisão

```
VITRAS APS v1.0
BASELINE INSTITUCIONAL — EMITIDA

Status: VIGENTE
Data: 2026-06-21
Versão: v1.0

O produto está apto para:
  - Implantação em qualquer UBS do Brasil
  - Auditorias externas (TCU, CGU, SMS)
  - Apresentação ao Ministério da Saúde
  - Homologação com e-SUS APS
  - Operação clínica real com dados de pacientes

Assinatura: Delivery Governor
Data: 2026-06-21
```

---

## Histórico de Versões deste Documento

| Versão | Data | Responsável | Mudança |
|--------|------|-------------|---------|
| 1.0 | 2026-06-21 | Delivery Governor | Emissão inicial — Baseline Institucional v1.0 |
