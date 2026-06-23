# AUDIT-01 — Full Product Readiness Audit

**Status:** PASS — CONDITIONAL READY  
**Data:** 2026-06-23  
**Escopo:** Produto, arquitetura, segurança, LGPD, frontend, backend, console, migração, escalabilidade, governança, manutenção  
**Restrições:** Esta sprint não cria funcionalidades. Não altera código. Não altera CDS. Não utiliza UBS real como critério.

---

## GOV-01 — Parecer Obrigatório

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | Lacuna crítica aberta? | **NÃO** |
| 2 | Lacuna alta aberta? | **SIM** |
| 3 | Risco de segurança relevante? | **SIM** |
| 4 | Risco LGPD relevante? | **NÃO** |
| 5 | Risco operacional relevante? | **SIM** |
| 6 | Risco de escalabilidade relevante? | **SIM** |
| 7 | Risco de manutenção relevante? | **SIM** |
| 8 | Risco de migração relevante? | **SIM** |
| 9 | Risco de governança relevante? | **NÃO** |
| 10 | Produto pronto para implantação? | **SIM COM CONDIÇÕES** |

---

## FASE 1 — Auditoria de Produto

### Funcionalidades implementadas e validadas

| Domínio | Sprint | Status |
|---------|--------|--------|
| Cadastro de pacientes (ACS) | APS-01A–F | PASS |
| Grupos familiares | APS-01A–F | PASS |
| Visitas domiciliares (ACS) | APS-01A–F | PASS |
| Busca ativa + score | APS-01A–F | PASS |
| Fila e agenda clínica | APS-01B | PASS |
| Prontuário / encaminhamentos / exames | APS-01C | PASS |
| Métricas de produção | APS-01D | PASS |
| CDS Export (e-SUS) | PRR-01A | PASS |
| IAM multi-tenant (support_admin, break_glass) | IAM-01A–E | PASS |
| Console Nacional | CONSOLE-01 | PASS |
| Auditoria + cadeia de hash | AUD-01 | PASS |
| Segurança (SEC-01, SEC-API-01A–D) | SEC-01 | PASS |
| Migração simulada 50K | MIG-01 | PASS |

### Lacunas de produto identificadas

**P-01 — MEDIUM:** Bootstrap pagination sem "load more" no frontend.

- **Evidência:** `frontend-react/src/pages/PatientsPage.jsx:217` exibe contagem `"N de {total}"` quando `hasNextPage=true`, mas não implementa botão ou scroll infinito para carregar páginas subsequentes. `useBootstrap.js:52` carrega apenas página 1 (500 registros).
- **Impacto:** Unidades com >500 pacientes ativos mostram lista incompleta. Busca ativa e score rodam sobre subconjunto. Usuário vê "217 de 1.247" sem meio de acessar os demais.
- **Criticidade:** Não afeta piloto (primeira UBS esperada: <500 pacientes). Bloqueia implantação geral se UBS exceder 500 registros.
- **Classificação:** MEDIUM

**P-02 — LOW:** Fluxo de visita domiciliar implementado via `acsVisits`, mas territorialização completa (Cadastro Domiciliar distinto, Visita Domiciliar como entidade própria no modelo CDS) aguarda pós-piloto.

- **Evidência:** `docs/project-acs-territorial-roadmap.md` — roadmap pós-Sprint 6 documenta que Cadastro Domiciliar e Visita Domiciliar como entidades independentes ficam após piloto real.
- **Impacto:** Conformidade com RNDS/CDS completa, não crítica para piloto.
- **Classificação:** LOW

**P-03 — LOW:** APS-02A (funcionalidades clínicas avançadas) formalmente NO GO — aguarda piloto + GOV-01 completo. Documentado em CLAUDE.md. Nenhuma lacuna de processo.

---

## FASE 2 — Auditoria de Frontend

### Navegação e fluxos

- Login → dashboard: funcional
- Seleção de paciente → prontuário → encaminhamento: funcional
- CDS Export: rota protegida, funcional
- Console Nacional (support_admin): isolado, funcional
- Força troca de senha (`forcePasswordChange`): implementado, testado

### UX e estados vazios

- Paciente sem histórico: estado vazio presente
- Fila vazia: estado vazio presente
- Busca sem resultado: estado vazio presente

### Lacunas de frontend identificadas

**F-01 — MEDIUM (mesmo que P-01):** Sem "load more" para pacientes. Ver P-01.

**F-02 — LOW:** UI de staging (`UI-STG-01`) e homologação (`UI-HOMO-01`) implementadas como especificações de design; integração com endpoints reais do `import.js` não foi smoke-testada em browser com dados reais.

- **Evidência:** Docs `UI-STG-01` e `UI-HOMO-01` existem; endpoints `/import/*` existem; teste de integração browser não foi executado nesta auditoria.
- **Impacto:** Risco de integração descoberto apenas no primeiro uso real.
- **Classificação:** LOW

**F-03 — LOW:** Mobile first (360–412px) — não testado nesta auditoria. REGRA 6 do CLAUDE.md exige validação em 360px, 390px, 412px antes de fluxos ACS.

- **Evidência:** Nenhuma evidência de teste de viewport nesta auditoria.
- **Classificação:** LOW — pré-requisito de treinamento, não de função.

---

## FASE 3 — Auditoria de Backend

### Rotas e RBAC

- Global `requireAuth` em `app.js:67` protege todas as rotas montadas a partir da linha 68+
- `blockSupportAdminFromClinical` em `app.js:69` bloqueia support_admin de rotas clínicas
- `usersRouter` montado antes de `requireAuth` (linha 60): `GET /teams/public` é intencionalmente público (sem dados clínicos), todas as demais rotas têm `requireAuth` inline

### Lacunas de backend identificadas

**B-01 — HIGH:** Import routes bypass CSRF middleware.

- **Evidência:** `app.js:68` monta `importRouter` antes de `requireCsrfForCookieAuth` em `app.js:70`. Todos os 8 endpoints de importação (incluindo `POST /import/jobs/:id/commit` que escreve dados de produção) não recebem proteção CSRF.
- **Impacto:** Se support_admin usar autenticação por cookie em browser e visitar página maliciosa, um CSRF pode acionar commit de importação não autorizado.
- **Mitigação parcial:** `requireImportAccess` restringe acesso a `support_admin` e `break_glass_admin`. Esses usuários normalmente usam Bearer token (não cookie), reduzindo a superfície.
- **Classificação:** MEDIUM (não HIGH porque o vetor requer cookie auth de role privilegiada)

**B-02 — LOW:** `GET /teams/public` retorna nomes e IDs de todas as equipes sem autenticação.

- **Evidência:** `routes/users.js:101` — sem `requireAuth`, retorna `{ id, name }` de todas as equipes.
- **Impacto:** Vaza estrutura organizacional (equipes existentes) para atacante não autenticado. Sem dados clínicos.
- **Justificativa de existência:** Dropdown de login provavelmente consome este endpoint.
- **Classificação:** LOW

**B-03 — LOW:** Rate limiting de login não verificado explicitamente como separado do globalRateLimit.

- **Evidência:** `app.js:54` aplica `globalRateLimit` globalmente. Endpoint de login (`POST /auth/login`) não tem rate limit específico por IP/email visível nesta auditoria.
- **Impacto:** Brute force de senha possível se globalRateLimit for permissivo o suficiente.
- **Classificação:** LOW — a ser verificado antes do piloto real.

---

## FASE 4 — Auditoria de Segurança

### Autenticação

- JWT HS256 com `issuer` + `audience` verificados: correto
- Tokens em cookie + Bearer suportados: correto
- `forcePasswordChange` implementado: correto
- Refresh token: não implementado — sessão expira com JWT. Aceitável para piloto.

### Autorização

- `hasCapability` centralizado em `helpers.js`: correto
- `blockSupportAdminFromClinical` bloqueia corretamente: confirmado em `auth.js:75`
- `requireSupportAdmin` verifica `canonicalRole`: correto
- RBAC em todos os endpoints críticos: confirmado

### Lacunas de segurança identificadas

**S-01 — MEDIUM (mesmo que B-01):** CSRF não aplicado em import routes. Ver B-01.

**S-02 — LOW:** `GET /teams/public` sem auth. Ver B-02.

**S-03 — LOW:** Rate limit de login não especificamente auditado. Ver B-03.

**S-04 — LOW:** `seed-admin` router (`routes/seed-admin.js`) presente em produção. Se não bloqueado por variável de ambiente, pode representar superfície de ataque.

- **Evidência:** `app.js:80` monta `seedAdminRouter` sem verificação de `NODE_ENV`.
- **Classificação:** LOW — requer verificação antes do piloto.

---

## FASE 5 — Auditoria LGPD

### Implementado e confirmado

| Requisito | Status | Evidência |
|-----------|--------|-----------|
| Minimização de dados | PASS | Campos Art. 11 não expostos em logs |
| Dados especiais (Art. 11) | PASS | `hivGestante`, `sifilis`, `genderIdentity`, `racaCor`, `situacaoRua`, `deficiencia`, `cidPrincipal` protegidos |
| Direito à anonimização | PASS | `routes/privacy.js:253` + `utils/patients.js:182` |
| Cadeia de auditoria | PASS | AUD-01 PASS, hashVersion v2 |
| Rastreabilidade de acesso | PASS | `addAuditLog` em todas as leituras críticas |
| LGPD V-LGPD-01/03 no pipeline | PASS | MIG-01 validação engine |
| Consentimento no campo | PASS | `lgpdConsentRecordId` no modelo canônico |

### Lacunas LGPD identificadas

**L-01 — LOW:** `lgpdConsentRecordId` real exige fluxo de consentimento com RIPD registrado antes de migração real. Documentado em PILOT-REAL-01 FASE 4.

- **Classificação:** LOW — pré-requisito operacional, não técnico.

**Nenhuma lacuna LGPD técnica encontrada.**

---

## FASE 6 — Auditoria do Console Nacional

### Isolamento

- `requireSupportAdmin` em todas as rotas `/platform/*`: confirmado
- `blockSupportAdminFromClinical` bloqueia acesso de support_admin a `/patients`, `/agenda`, `/exams`, etc.: confirmado
- Console não exibe dados de pacientes reais: confirmado pela separação de rotas
- Criação de unidades, usuários, equipes: funcional e auditado

### Lacunas do Console

**C-01 — LOW:** `GET /platform/summary` retorna contagens agregadas (totalUnits, onboarding, active, totalGestors). Se uma capability incorreta conceder acesso a role não-support_admin, vazaria estrutura organizacional.

- **Evidência:** `routes/platform.js:125` verifica `platform.unit.read` capability. Apenas support_admin tem essa capability por design, mas a verificação é por capability, não por role hardcoded.
- **Classificação:** LOW — design defensível. Risco existe apenas se capability for concedida incorretamente.

**Nenhuma lacuna crítica no Console Nacional.**

---

## FASE 7 — Auditoria de Migração

### Pipeline MIG-01 (funcional)

- sp-pec-aps-v01: certificado
- MAP-PEC-01-v1: implementado
- 18 regras de validação: testadas
- E-01 a E-05: implementados
- Homologação GO/NO_GO: funcional
- Commit idempotente: funcional
- Escala 50K / 852ms: validada

### Lacunas de migração identificadas

**M-01 — HIGH:** Import pipeline usa apenas stores in-memory. Tabelas `app_import_jobs`, `app_import_staging`, `app_import_raw` **não existem** em `ensurePostgresState`.

- **Evidência:** `db.js:326` — `ensurePostgresState` cria apenas `app_state`. `import-pipeline.js:18-20` — três `Map()` hardcoded como store definitivo. Comentário na linha 7 da `import-pipeline.js` diz "Produção usa tabelas `app_import_*`" — isso é FALSO. Não existe implementação em Postgres.
- **Impacto:** Reinicialização do servidor (deploy, crash, scale-in) destrói todos os import jobs, staging e raw payloads. Operação de migração real em produção perde estado completamente. Auditoria de imports não persiste.
- **Mitigação atual:** Zero. Toda persistência de import é efêmera.
- **Classificação:** HIGH

**M-02 — MEDIUM:** PILOT-REAL-01 em FAIL. Nenhuma UBS definida, LGPD não validada, tabelas de referência não mapeadas. Documentado; não é lacuna técnica.

**M-03 — LOW:** Source Profile Registry (MIG-02) bloqueado até PILOT-REAL-01 PASS. Correto por design.

---

## FASE 8 — Auditoria de Escalabilidade

### Confirmações de escala

| Item | Status | Evidência |
|------|--------|-----------|
| Bootstrap pagination (REM-02) | PASS | BOOTSTRAP_PAGE_LIMIT=500, hasNextPage implementado |
| Shadow tables (REM-01) | PASS | app_patients, app_users queries em Postgres |
| O(N²) eliminado em MIG-01 | PASS | rawById Map + eventsByPatient Map |
| 50K pacientes pipeline em 852ms | PASS | mig-01.test.mjs |
| Score engine server-side | PASS | active-search.js via API |

### Lacunas de escalabilidade identificadas

**SC-01 — MEDIUM (mesmo que P-01):** Frontend carrega apenas 500 pacientes. Escala acima de 500 por unidade requer "load more" ou virtualização.

**SC-02 — LOW:** File driver (`db.json`) lê e escreve JSON completo por operação. Para piloto (<500 pacientes, <10 usuários simultâneos), aceitável. Para múltiplas UBS em produção simultânea, necessita Postgres (já planejado em ARCH-STORAGE-01).

**SC-03 — LOW:** Active search client-side filtra sobre `patients` em memória. Para unidade >500 pacientes, busca só opera sobre página carregada. Afeta qualidade clínica do resultado de busca ativa, não apenas UX.

---

## FASE 9 — Auditoria de Governança

### CTRL-01 — verificação de coerência

| Sprint | Status declarado | Evidência |
|--------|-----------------|-----------|
| APS-01A–F | PASS | Testes passando |
| PRR-01A | PASS | CDS Export funcional |
| SEC-01, AUD-01 | PASS | Hash chain + SEC headers |
| IAM-01A–E | PASS | multi-tenant + console |
| MIG-01 | PASS | 34/34 testes |
| PILOT-REAL-01 | FAIL | Esperado — 6/7 NÃO |
| MIG-02 | BLOQUEADO | Correto — aguarda PILOT-REAL-01 |
| APS-02A | NO GO | Correto — aguarda piloto |

### Coerência confirmada

- CTRL-01 é ponto único de verdade: **SIM**
- GOV-01 ativo: **SIM**
- Dependências documentadas: **SIM**
- Nenhuma sprint aberta em estado inconsistente: **SIM**

**Nenhuma lacuna de governança encontrada.**

---

## FASE 10 — Auditoria de Manutenibilidade

### Acoplamentos identificados

**MA-01 — MEDIUM (mesmo que M-01):** `import-pipeline.js` acopla stores em memória como única implementação. Nenhuma interface/abstração separa store de lógica de negócio. Qualquer migração para Postgres exige reescrita dos 4 stores + lógica de pipeline.

- **Evidência:** Funções como `createImportJob`, `getImportJob`, `updateImportJobStatus` todas operam diretamente sobre `importJobsStore` (Map). Não há repository pattern.
- **Impacto:** Quando import tables forem implementadas em Postgres, reescrita significativa necessária.
- **Classificação:** MEDIUM — risco de regressão na implementação futura.

**MA-02 — LOW:** `make-deploy-zip.mjs` usa `require("./backend/node_modules/archiver/index.js")` com caminho hardcoded.

- **Evidência:** linha 8 do `make-deploy-zip.mjs`.
- **Impacto:** Quebra se `archiver` for removido ou `node_modules` for reorganizado.
- **Classificação:** LOW

**MA-03 — LOW:** AUD-01 — secrets rotation pendente desde a correção do hash chain (hashVersion v2 / legacy_incompatible).

- **Evidência:** `memory/project-aud-01-fix.md` — "secrets rotation pending".
- **Impacto:** JWT_SECRET antigo ainda válido até rotation.
- **Classificação:** LOW — pré-requisito do piloto real.

---

## FASE 11 — Classificação dos Achados

| ID | Descrição | Severidade |
|----|-----------|-----------|
| M-01 | Import pipeline sem persistência Postgres — stores em memória apenas | **HIGH** |
| B-01 / S-01 | Import routes antes de CSRF middleware | **MEDIUM** |
| P-01 / F-01 / SC-01 | Sem "load more" para pacientes >500 | **MEDIUM** |
| MA-01 | Import pipeline sem abstração de store | **MEDIUM** |
| P-02 | Territorialização CDS incompleta (Cadastro Domiciliar distinto) | LOW |
| F-02 | UI import não smoke-testada em browser | LOW |
| F-03 | Mobile 360–412px não testado nesta auditoria | LOW |
| B-02 / S-02 | `/teams/public` sem auth | LOW |
| B-03 / S-03 | Rate limit de login não auditado especificamente | LOW |
| S-04 | `seed-admin` router sem guard de NODE_ENV | LOW |
| C-01 | `/platform/summary` por capability, não por role | LOW |
| SC-02 | File driver sem escala para multi-UBS | LOW |
| L-01 | lgpdConsentRecordId real requer RIPD | LOW |
| MA-02 | make-deploy-zip.mjs caminho hardcoded | LOW |
| MA-03 | Secrets rotation pendente (AUD-01) | LOW |

**CRITICAL:** 0  
**HIGH:** 1 (M-01)  
**MEDIUM:** 4 (B-01, P-01, MA-01, + 1 confirmação)  
**LOW:** 10  

---

## FASE 12 — NO-GO LIST

**Existe algum item que impediria implantação do VITRAS hoje?**

**SIM — com escopo limitado:**

### NO-GO para migração real em Postgres mode

**M-01 — HIGH:** Import pipeline usa stores in-memory exclusivamente. Restart de servidor destrói todos os import jobs. Deploy de migração real em produção com Postgres como driver deixaria todos os registros de importação sem persistência, impossibilitando auditoria e rastreabilidade pós-commit.

- **Bloqueador para:** Operação de migração real (MIG-01 commit em produção com driver Postgres)
- **Não bloqueador para:** Piloto com file driver, uso clínico diário, CDS Export

### NÃO-NO-GO para operação clínica diária

Os seguintes itens NÃO bloqueiam implantação do piloto com file driver:

- CSRF gap (B-01): import operations restritas a support_admin, mitigado por Bearer auth
- Bootstrap pagination (P-01): piloto esperado <500 pacientes
- `/teams/public` (B-02): sem dados clínicos
- Rate limit (B-03): mitigado pelo globalRateLimit existente

---

## FASE 13 — Decisão Executiva

### O VITRAS APS está: **CONDITIONAL READY**

**Justificativa:**

O produto está funcional, seguro, auditado e governado para operação clínica diária em UBS de piloto com file driver (ou Postgres sem operações de migração). Todos os fluxos clínicos (cadastro, visita, prontuário, encaminhamento, CDS export) estão implementados, testados e com regressão passando.

**Condição 1 (HIGH — bloqueia migração real):**
Implementar persistência Postgres para import pipeline (`app_import_jobs`, `app_import_staging`, `app_import_raw` em `ensurePostgresState`). Sem isso, qualquer operação de migração real em Postgres perde estado no primeiro restart.

**Condição 2 (MEDIUM — recomendada antes de disponibilidade geral):**
Aplicar `requireCsrfForCookieAuth` a import routes. Mover `importRouter` para depois do CSRF middleware em `app.js`, ou aplicar o middleware inline.

**Condição 3 (MEDIUM — requerida antes de UBS com >500 pacientes):**
Implementar "load more" ou paginação no frontend para `PatientsPage`. Qualquer UBS com cadastro acima de 500 pacientes terá lista incompleta.

**O produto pode ser implantado hoje para piloto com:**
- File driver (db.json)
- Unidade com <500 pacientes ativos
- Sem operações de migração real via Postgres

---

## RESULTADO OBRIGATÓRIO

| # | Item | Resultado |
|---|------|-----------|
| 1 | Lacunas críticas encontradas? | **NÃO** |
| 2 | Lacunas altas encontradas? | **SIM** — M-01: import sem persistência Postgres |
| 3 | Riscos de segurança encontrados? | **SIM** — B-01: CSRF bypass em import routes |
| 4 | Riscos LGPD encontrados? | **NÃO** |
| 5 | Riscos operacionais encontrados? | **SIM** — P-01: frontend trunca >500 pacientes |
| 6 | Riscos de escalabilidade encontrados? | **SIM** — SC-01: bootstrap sem load more |
| 7 | Riscos de migração encontrados? | **SIM** — M-01: stores em memória |
| 8 | Riscos de governança encontrados? | **NÃO** |
| 9 | Existe algum NO-GO? | **SIM** — M-01 bloqueia migração real em Postgres |
| 10 | Produto pronto para implantação? | **SIM COM CONDIÇÕES** |
| 11 | Classificação final | **CONDITIONAL READY** |
| 12 | Status | **PASS** |

---

## Rastreabilidade

| Referência | Relação |
|-----------|---------|
| `backend/src/app.js:67-70` | Ordem global middlewares — CSRF gap confirmado |
| `backend/src/services/import-pipeline.js:18-20` | Stores in-memory — M-01 confirmado |
| `backend/src/db.js:326` | ensurePostgresState — ausência import tables confirmada |
| `frontend-react/src/pages/PatientsPage.jsx:217` | Sem load more — P-01 confirmado |
| `frontend-react/src/hooks/useBootstrap.js:52` | Carrega apenas page 1 — P-01 confirmado |
| `backend/src/routes/users.js:101` | /teams/public sem auth — B-02 confirmado |
| `docs/CTRL-01-product-control-map.md` | Roadmap coerente — governance OK |
| `docs/governanca/PILOT-REAL-01-readiness-gate.md` | FAIL documentado — correto |
| `backend/docs/MIG-01-first-end-to-end-simulated-migration.md` | PASS, mas nota incorreta sobre app_import_* tables |
