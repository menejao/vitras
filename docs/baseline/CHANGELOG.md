# CHANGELOG — VITRAS APS

**Formato:** [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)  
**Versionamento:** Semântico — MAJOR.MINOR.PATCH  
**Produto:** VITRAS APS  
**Owner:** Tech Lead  
**Aprovador:** Delivery Governor

---

## Regras de Uso

- Toda entrada deve referenciar Sprint ID, commit ou PR
- Entradas em português institucional — sem abreviações informais
- Seis categorias obrigatórias:
  - **Added** — nova funcionalidade, endpoint, documento
  - **Changed** — mudança em funcionalidade existente
  - **Deprecated** — funcionalidade que será removida em versão futura
  - **Removed** — funcionalidade ou documento removido
  - **Fixed** — correção de bug ou falha
  - **Security** — correção de vulnerabilidade ou endurecimento de segurança

---

## [v1.0] — 2026-06-21

**Baseline Institucional v1.0 — VITRAS APS**

Esta versão representa o primeiro estado certificado do produto para implantação nacional em qualquer UBS do Brasil.

### Added

**Produto e Funcionalidade (APS-01A a APS-01F)**
- Cadastro Individual de paciente (FCI e-SUS): campos demográficos, raça/cor, deficiência, situação de rua, NIS, condições crônicas
- Cadastro Domiciliar e Territorial (FCD e-SUS): tipo de imóvel, saneamento básico, abastecimento de água, destino de lixo
- Visita Domiciliar ACS (FVD e-SUS): motivos, desfecho, busca ativa, acompanhamentos, controle ambiental — LEDI APS 7.4.0
- Grupo Familiar Workspace — vinculação de pacientes por grupo familiar
- Busca Ativa Inteligente — score 0–100 com 8 regras clínicas e 22 condições de busca ativa
- Produção Automática — 4 endpoints (`/production/acs`, `/nurse`, `/manager`, `/microareas`)
- Sistema de Tarefas ACS — criação, atribuição, atualização de status

**Exportação CDS / e-SUS (PRR-01A)**
- Exportação Ficha de Cadastro Individual (CI) — Thrift TBinaryProtocol LEDI APS 7.4.0
- Exportação Ficha de Cadastro Domiciliar e Territorial (CDT)
- Exportação Ficha de Visita Domiciliar (VD)
- Exportação Ficha de Atendimento Individual (AI)
- Arquivo `.esus` compatível com PEC ≥ 5.4.36

**Segurança e Autenticação (SEC-01, AUD-01)**
- JWT 15 minutos + refresh token 7 dias (httpOnly cookie)
- CSRF token obrigatório em todas as mutações
- 2FA TOTP (Google Authenticator / Authy) para perfis críticos
- RBAC com 12 roles e capabilities granulares
- Team scope — isolamento de dados entre equipes
- Break Glass — acesso de emergência auditado
- Audit log com hash chain SHA-256 imutável (AUD-01)
- Rate limiting por IP com circuit breaker (Upstash Redis + MemoryStore fallback)
- Advisory lock em migration runner — previne race em multi-instância

**LGPD e Privacidade**
- Anonimização de paciente (`anonymizePatientBundle`)
- Relatório de acesso do titular (`GET /privacy/patient-access-report/:id`)
- CPF, CNS, NIS criptografados em repouso (AES-256)
- cnsProfissional hasheado em logs de auditoria (nunca plaintext)
- Retenção configurável de audit logs (padrão: 730 dias)

**Infraestrutura e Deploy**
- Backend: Node.js + Express em AWS Elastic Beanstalk (sa-east-1)
- Frontend: React + Vite em AWS Amplify
- Banco de dados: JSON file DB + PostgreSQL shadow tables (Neon/Aurora)
- Migrations: runner com 26 migrations, idempotentes, com advisory lock
- Health endpoint `/readyz` — 503 durante startup, 200 quando pronto
- CloudWatch Logs estruturados em JSON

**API e Documentação**
- Swagger UI em `/api-docs` (público, antes de `requireAuth`)
- OpenAPI 3.0 em `docs/openapi.yaml` — fonte única de contrato de API
- `GET /tasks/:id` com RBAC e team scope (SEC-API-01D)

**Governança e Documentação**
- GOV-01 — gate obrigatório para toda nova funcionalidade (ativo desde 2026-06-18)
- Playbook de implantação multi-UBS — 8 documentos reutilizáveis (IMPLANT-01)
- Baseline Institucional v1.0 (DOC-GOV-01)
- DOCUMENTATION_VERSION.md — registro oficial de versão
- Política de versionamento, revisão e ownership documental

### Fixed

- **ARCH-01 / G-01:** `MUNICIPALITY_ID` env var não propagado para `cds-structs.js` — CDS export reportava IBGE `3534401` (São Paulo) para qualquer UBS. Corrigido: `CONFIG_MUNICIPALITY_ID` importado e usado como fallback em 4 funções (commits `2daef42`, `755aa37`)
- **ARCH-01:** Shadow sync de `app_units` usava `"3534401"` como fallback em `db.js:443`. Corrigido para `CONFIG_MUNICIPALITY_ID || ""`
- **ARCH-01:** Migration 010 backfillava `municipality_id = '3534401'` para registros vazios em novos deployments. Corrigido: backfill agora usa `''` (vazio)
- **ARCH-01:** `RECEPTION_USERS` e `PHARMA_USERS` em `constants.js` continham `ana@clinica.local` — hardcode de usuário demo. Removido
- **TECH-DEBT-01:** `rejectUnauthorized: false` em pool Postgres sem CA bundle desabilitava validação TLS. Corrigido para `rejectUnauthorized: true` (system trust store). Comentário estava incorreto ("validation still active" — o código dizia o oposto)
- **TECH-DEBT-01:** `AUTH_MAX_ATTEMPTS` default `20` em produção — permissivo para brute force. Adicionado warning em `validateProductionConfig` quando valor > 10

### Security

- TLS certificate validation reactivated (`rejectUnauthorized: true`) in Postgres pool — prevented MITM vector that existed despite comment claiming validation was active (TECH-DEBT-01, commit `a2ed47d`)
- Advisory lock `pg_advisory_lock(7261747261)` added to migration runner — prevents simultaneous migration execution on multi-instance deploys (TECH-DEBT-01)
- `AUTH_MAX_ATTEMPTS > 10` now emits `boot_config_warning` at startup in production — surfaces misconfiguration proactively (TECH-DEBT-01)
- Hardcoded pilot municipality IBGE code removed from 6 locations in product code (ARCH-01)

---

## Template para Versões Futuras

```markdown
## [vX.Y] — YYYY-MM-DD

**Sprint:** APS-XXA  
**GOV-01:** [link para parecer]

### Added
- 

### Changed
- 

### Deprecated
- 

### Removed
- 

### Fixed
- 

### Security
- 
```
