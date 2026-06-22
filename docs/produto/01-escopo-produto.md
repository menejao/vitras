# VITRAS APS — Escopo do Produto

**Versão:** 1.0  
**Atualizado:** 2026-06-22

---

## 1. Visão do produto

O VITRAS APS é um sistema nacional de informação para Atenção Primária à Saúde (APS), projetado para operar em múltiplos municípios com isolamento multi-tenant por UBS.

**Missão:** Apoiar o trabalho diário de ACS, enfermeiros e gestores na APS brasileira, com conformidade ao e-SUS APS e à LGPD.

**Modelo de distribuição:** SaaS nacional. Cada UBS opera em tenant isolado.

**Infraestrutura:** AWS Elastic Beanstalk (backend Node.js), AWS Amplify (frontend React), AWS RDS PostgreSQL (produção), AWS S3 (artefatos).

---

## 2. Módulos existentes e entregues

### APS-01A — ACS Workspace
**Status:** PASS  
**Entrega:** Estrutura base para ACS — cadastro de pacientes, domicílios, grupos familiares, tarefas.

### APS-01B — Tarefas e Agenda ACS
**Status:** PASS  
**Entrega:** Gestão de tarefas por ACS com prioridade e estado.

### APS-01C — Visitas ACS com persistência real
**Status:** PASS  
**Entrega:** Registro de visitas domiciliares ACS com persistência, validação e histórico.

### APS-01D — Grupo Familiar Workspace
**Status:** PASS  
**Entrega:** Cadastro domiciliar e vinculação de famílias. Entidades `households` e `familyGroups`.

### APS-01E — Busca Ativa Inteligente
**Status:** PASS  
**Entrega:** Score 0–100 por grupo familiar com 8 regras clínicas. `evaluateGroup()` em `active-search.js`.

### APS-01F — Produção ACS Automática
**Status:** PASS  
**Entrega:** 4 APIs de métricas de produção (ACS, enfermeiro, gestor, microárea). `getAcsMetrics()` em `production-metrics.js`.

### CDS Export — e-SUS APS
**Status:** OPERACIONAL  
**Entrega:** Exportação de fichas no protocolo `.esus`. `backend/src/routes/cds-export.js`.  
**Restrição:** Intocável sem aprovação explícita + revisão LGPD.

### IAM-01 — Identity and Access Management
**Status:** PASS  
**Entrega:** Gestão nacional de identidades. Suporte a dois modos de auth (JWT bearer, cookie-session). `forcePasswordChange` no primeiro acesso. Bloqueio de support_admin de rotas clínicas.

### IMPLANT-01A — Provisionamento Nacional de UBS
**Status:** PASS  
**Entrega:** Ciclo de vida de 5 estados (draft/onboarding/homologation/active/suspended). Console Nacional. Criação de gestor inicial com senha temporária.

### HOMOLOG-01 — Critérios Nacionais de Homologação
**Status:** PASS  
**Entrega:** Critérios programáticos obrigatórios para avanço de estado. Checklist de homologação. Aprovação técnica rastreável.

### INTEGRATION-GOV-01A — Governança de Ingestão de Dados
**Status:** ATIVO (somente documentação)  
**Entrega:** Processo nacional para integração de dados externos. Nenhum conector implementado.

---

## 3. Módulos aprovados (backlog priorizado)

Nenhum módulo no backlog com GO ativo no momento (2026-06-22).

Próximo candidato: **APS-02A — Territorialização Inteligente**  
**GOV-01:** Pendente. Não entra sem parecer completo.

---

## 4. Módulos bloqueados (WON'T DO NOW)

| Módulo | Motivo do bloqueio |
|---|---|
| Mapa territorial com polígonos | Exige geolocalização — NO GO antes de piloto estável |
| Integração RNDS | Fora do escopo do piloto |
| App nativo mobile | PWA já cobre campo |
| Relatórios PDF complexos | Sem demanda confirmada |
| Dashboards epidemiológicos avançados | Sem demanda confirmada |
| Gamificação / performance individual | Contrário à cultura APS |
| Módulo de medicamentos ACS | ACS não prescreve |
| Agenda clínica ACS | ACS não tem agenda clínica |
| APS-02A | GOV-01 pendente |

---

## 5. Dependências oficiais do produto

| Dependência | Papel | Versão |
|---|---|---|
| Node.js | Runtime backend | 22 LTS |
| Express | Framework HTTP | 4.x |
| React + Vite | Frontend SPA | 18.x / 5.x |
| PostgreSQL | Banco de dados produção | 15+ |
| AWS Elastic Beanstalk | Hospedagem backend | Node.js 22 / AL2023 |
| AWS Amplify | Hospedagem frontend | — |
| AWS RDS | Banco gerenciado | PostgreSQL 15 |
| JSON file DB | Banco desenvolvimento/staging | `data/db.json` |
| bcrypt | Hash de senhas | 5.x |
| jsonwebtoken | Tokens JWT | — |
| e-SUS APS | Protocolo de exportação | `.esus` / CDS |

---

## 6. Arquitetura técnica

```
[React SPA]  ←→  [Express API]  ←→  [PostgreSQL (prod) / JSON (dev)]
                       ↓
               [app_state JSONB]  ←→  [shadow tables SQL]
                       ↓
               [syncShadowTables()]  (rebuild on every withDb())
```

**Canonical source of truth:** `app_state` JSONB em Postgres. Shadow tables são derivadas — nunca escrever diretamente nelas.

**Dual DB mode:**
- `DATABASE_URL` presente → Postgres mode
- Ausente → JSON file mode (`data/db.json`)

**Auth modes:**
- Bearer JWT: `Authorization: Bearer <token>` 
- Cookie session: cookie `session_token` + header `X-CSRF-Token`. Token state = `"__cookie_session__"` (sentinel — nunca enviar como Bearer).
