# VITRAS APS — Registro de Regras de Negócio

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Formato:** RN-[DOMÍNIO]-[NÚMERO] | Descrição | Origem | Impacto

---

## Domínio: RBAC (Controle de Acesso Baseado em Perfil)

| Código | Descrição | Origem | Impacto |
|---|---|---|---|
| RN-RBAC-01 | Toda rota exige `requireAuth` — sem exceção. Aplicado globalmente em `app.js`. | `backend/src/app.js:60` | Todas as rotas |
| RN-RBAC-02 | Capabilities são verificadas via `hasCapability(req.user, capability)` — nunca via comparação direta de role. | `helpers.js:ROLE_CAPABILITIES` | Todas as rotas protegidas |
| RN-RBAC-03 | `support_admin` é bloqueado de todas as rotas clínicas via `blockSupportAdminFromClinical` middleware. Pode acessar apenas `/platform/*` e `/auth/*`. | `app.js:blockSupportAdminFromClinical` | Isolamento de tenant |
| RN-RBAC-04 | `gestor` não pode acessar `/platform/*`. Essas rotas exigem `requireSupportAdmin`. | `platform.js:router.use(requireSupportAdmin)` | Console Nacional |
| RN-RBAC-05 | `receptionist` não recebe detalhe individual do paciente — retorna sumário restrito. | `patients.js:D-12` | Privacy |
| RN-RBAC-06 | Dados de pacientes não são expostos a roles sem `patients.read.*` capability. | `helpers.js:ROLE_CAPABILITIES` | LGPD |
| RN-RBAC-07 | `break_glass_admin` acessa dados clínicos em emergência — registra trilha de auditoria completa. | `helpers.js:break_glass_admin` | Auditoria |

### Matriz de perfis e capabilities principais

| Perfil | Acesso pacientes | CDS export | Console Nacional | Gestão usuários |
|---|---|---|---|---|
| `acs` | Escoped (sua microárea) | Não | Não | Não |
| `nurse_manager` | Todos | Não | Não | Scoped (sua equipe) |
| `doctor` | Todos | Não | Não | Não |
| `dentist` | Todos | Não | Não | Não |
| `gestor` | Todos | **Sim** | **Não** | Todos (sua UBS) |
| `support_admin` | **Não** | Não | **Sim** | Não (apenas /platform) |
| `break_glass_admin` | Todos (emergência) | **Sim** | Não | Todos |

---

## Domínio: IAM (Identity and Access Management)

| Código | Descrição | Origem | Impacto |
|---|---|---|---|
| RN-IAM-01 | Toda senha armazenada usa `hashPassword()` (bcrypt). Nunca armazenar plaintext. | `crypto.js` | Segurança |
| RN-IAM-02 | `forcePasswordChange: true` em toda senha temporária ou criada por suporte. | `platform.js:initial-manager` | Primeiro acesso |
| RN-IAM-03 | `forcePasswordChange` é verificado no login — redireciona para `ChangePasswordRequiredPage` antes de qualquer acesso. | `App.jsx:routing gate` | UX |
| RN-IAM-04 | Senha temporária retornada apenas uma vez na resposta do endpoint. Nunca persistida em plaintext, nunca em log de auditoria. | `platform.js` | LGPD / Segurança |
| RN-IAM-05 | Cookie-session sentinel `"__cookie_session__"` nunca enviado como Bearer token. `api()` faz verificação antes de adicionar header `Authorization`. | `api.js:COOKIE_SESSION_SENTINEL` | Auth |
| RN-IAM-06 | CSRF obrigatório para mutações em cookie-session mode (`X-CSRF-Token` header). Middleware global em `app.js`. | `app.js:requireCsrfForCookieAuth` | Segurança |
| RN-IAM-07 | `support_admin` não tem `unitId` — não está vinculado a nenhuma UBS específica. | `platform.js` | Multi-tenant |
| RN-IAM-08 | Gestor criado pelo `support_admin` recebe `role: "gestor"`, nunca `support_admin`. | `platform.js:initial-manager` | Isolamento |

---

## Domínio: Team Scope

| Código | Descrição | Origem | Impacto |
|---|---|---|---|
| RN-TS-01 | ACS acessa apenas pacientes de sua microárea (`patients.read.scoped`). | `helpers.js:acs` | Privacy |
| RN-TS-02 | Paciente pertence a uma UBS via `unitId`. | `patients.js` | Multi-tenant |
| RN-TS-03 | ACS pertence a uma equipe (`teamId`) que pertence a uma UBS (`unitId`). | `users` model | Hierarquia |
| RN-TS-04 | `getAllowedPatients()` filtra por team scope antes de retornar dados. | `patients.js` | Privacy |

---

## Domínio: Implantação de UBS

| Código | Descrição | Origem | Impacto |
|---|---|---|---|
| RN-IMPL-01 | UBS recém-criada entra no estado `draft`. | `platform.js:POST /platform/units` | Lifecycle |
| RN-IMPL-02 | Criação de gestor inicial automaticamente transiciona `draft → onboarding`. | `platform.js:initial-manager` | Lifecycle |
| RN-IMPL-03 | Transição `onboarding → homologation` exige 5 critérios: gestor criado, gestor fez primeiro acesso, equipe cadastrada, usuário ativo, dados institucionais preenchidos. | `platform.js:checkOnboardingCriteria` | Homologação |
| RN-IMPL-04 | Transição `homologation → active` exige todos os critérios de onboarding + checklist de 8 itens + aprovação técnica registrada. | `platform.js:checkHomologationCriteria` | Ativação |
| RN-IMPL-05 | Nenhuma transição de estado é permitida fora da máquina de estados definida. | `platform.js:STATUS_TRANSITIONS` | Integridade |
| RN-IMPL-06 | `activatedAt` é registrado na primeira transição para `active`. | `platform.js:PATCH` | Auditoria |
| RN-IMPL-07 | `suspendedAt` é registrado em toda transição para `suspended`. | `platform.js:PATCH` | Auditoria |
| RN-IMPL-08 | Critérios de homologação são nacionais — iguais para toda UBS, independente de município. | `homolog-01.test.mjs` | Compliance |

---

## Domínio: CDS Export / e-SUS APS

| Código | Descrição | Origem | Impacto |
|---|---|---|---|
| RN-CDS-01 | `cds-export.js` e o protocolo `.esus` são intocáveis sem aprovação explícita + revisão LGPD. | `CLAUDE.md:REGRA 4` | Conformidade e-SUS |
| RN-CDS-02 | Apenas `gestor` e `break_glass_admin` têm capability `cds.export`. | `helpers.js` | RBAC |
| RN-CDS-03 | Exportação CDS inclui hash de integridade por lote. | `cds-export.js` | Auditoria |

---

## Domínio: LGPD

| Código | Descrição | Origem | Impacto |
|---|---|---|---|
| RN-LGPD-01 | Campos sensíveis de paciente (`cpf`, `cns`, `cnsResponsavel`, `nis`) são cifrados com AES-256-GCM em repouso. | `db.js:SENSITIVE_PATIENT_FIELDS` | Proteção de dados |
| RN-LGPD-02 | Campos especiais LGPD Art. 11 (`hivGestante`, `sifilis`, `genderIdentity`, `racaCor`, `etnia`, `situacaoRua`, `deficiencia`) recebem tratamento diferenciado. | `patients.js:Sprint 5B` | LGPD Art. 11 |
| RN-LGPD-03 | Dado clínico nunca aparece em log operacional. Apenas em trilha de auditoria cifrada. | `CLAUDE.md:REGRA 5` | LGPD |
| RN-LGPD-04 | `receptionist` não recebe NIS (`nis`) — dado pessoal sem relação com acesso clínico. | `patients.js:F1-removenis` | Privacy |
| RN-LGPD-05 | `cnsResponsavel` não é enviado a roles sem necessidade clínica. | `patients.js:F2-05` | Privacy |
| RN-LGPD-06 | `cpf` e `cns` retornados como SHA-256 nos logs de auditoria (não em plaintext). | `patients.js` | LGPD |

---

## Domínio: Auditoria

| Código | Descrição | Origem | Impacto |
|---|---|---|---|
| RN-AUD-01 | Toda ação relevante gera entrada em `auditLogs` via `addAuditLog()`. | `audit.js` | Rastreabilidade |
| RN-AUD-02 | Auditoria inclui: `action`, `entity`, `entityId`, `userId`, `userName`, `userRole`, `details`, `createdAt`. | `audit.js:schema` | Compliance |
| RN-AUD-03 | Cadeia de hash de auditoria (AUD-01): cada entrada referencia hash da anterior. | `audit.js` | Integridade |
| RN-AUD-04 | Hash version v2 para novas entradas; `legacy_incompatible` para entradas migradas. | `audit.js:hashVersion` | Compatibilidade |
| RN-AUD-05 | Senha temporária jamais aparece em `details` do log de auditoria. | `platform.js` | Segurança |

---

## Domínio: Integração de Dados Externos

| Código | Descrição | Origem | Impacto |
|---|---|---|---|
| RN-INT-01 | Nenhum dado externo entra em produção sem completar as 10 fases de INTEGRATION-GOV-01A. | `docs/governanca/07-integration-gov-01.md` | Conformidade |
| RN-INT-02 | Mapeamento automático de campos sem validação humana é proibido. | `07-integration-gov-01.md:Fase 3` | Integridade de dados |
| RN-INT-03 | Dry-run obrigatório antes de qualquer carga em produção. | `07-integration-gov-01.md:Fase 6` | Qualidade |
| RN-INT-04 | Toda integração bem-sucedida gera um Conector Homologado no catálogo nacional. | `07-integration-gov-01.md:Fase 10` | Reuso |

---

## Domínio: Mobile / UX

| Código | Descrição | Origem | Impacto |
|---|---|---|---|
| RN-MOB-01 | Toda UI usada pelo ACS deve funcionar em 360–412px sem scroll horizontal. | `CLAUDE.md:REGRA 6` | Acessibilidade campo |
| RN-MOB-02 | Validação de viewport obrigatória: 360px, 390px, 412px. | `CLAUDE.md:REGRA 6` | QA |
