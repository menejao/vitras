# VITRAS v1.1.0-rc.1 — Known Issues

> **Atualizado:** 2026-08-05 | **Versão:** v1.1.0-rc.1

---

## KI-01 — usersRouter Mounted Before Global requireAuth
**Severity:** LOW (mitigado por S10-03)
**Status:** RESOLVED em Sprint 4.1 (S10-03 moveu adminRouter; usersRouter tem inline auth em todas as rotas)
**Residual:** Qualquer nova rota adicionada em users.js sem inline requireAuth ficaria exposta. Mitigado por code review gate.
**Blocks RC1:** NÃO
**Blocks Piloto:** NÃO

---

## KI-02 — LGPD vs CFM 1821/2007 Anonymization Tension
**Severity:** HIGH (risco regulatório em produção regulada)
**Status:** Documentado — revisão jurídica necessária antes de produção regulada
**Description:** `anonymizePatientBundle()` deleta fisicamente `clinicalRecords` ao anonimizar paciente. Satisfaz LGPD Art. 16 (apagamento) mas pode conflitar com CFM 1821/2007 (retenção 20 anos). Pre-flight audit `anonymization_warning_acknowledged` documenta intenção do operador.
**Mitigation:** Snapshots clínicos em prescription/medical_attest/referral persistem independentemente. Auditoria forense criada no momento da anonimização.
**Blocks RC1:** NÃO (anonimização é função administrativa, não fluxo clínico primário)
**Blocks Piloto:** NÃO (piloto controlado, não há destruição de dados em produção sem deliberação)
**Fix target:** Pós-piloto — selective anonymization preservando conteúdo clínico ao remover PII
**See:** docs/lgpd-cfm-considerations.md

---

## KI-03 — rejectUnauthorized: false no Connection SSL
**Severity:** LOW (Neon/Render — mitigado por TLS do provedor)
**Status:** Risco documentado — contexto mudou de RDS/VPC para Neon/Render
**Description:** `db.js` usa `ssl: { rejectUnauthorized: false }` para conexão com Neon Postgres. Em Neon, a conexão usa TLS verificado pelo provedor; a propriedade `rejectUnauthorized: false` é necessária para compatibilidade com o CA do Neon que não está no bundle padrão do Node.js.
**Mitigation:** Neon TLS + Render private networking. Não é RDS/VPC público.
**Blocks RC1:** NÃO
**Blocks Piloto:** NÃO

---

## KI-04 — File-mode Limitations (Dev/Test Only)
**Severity:** NOT APPLICABLE para produção
**Status:** By design — produção usa Postgres
**Description:** File-mode armazena tudo em JSON com file-lock mutex. Não escala além de um processo. Produção sempre usa DATABASE_URL (Neon Postgres).
**Blocks RC1:** NÃO

---

## KI-05 — OTP SMS/Email Provider Não Configurado
**Severity:** MEDIUM (impacta usuários com 2FA obrigatório via SMS/Email)
**Status:** Documentado — integração real com provider (Twilio/SES) não implementada
**Description:** `otpProvider.js` em produção (`NODE_ENV=production`) loga `console.warn` e retorna `{ sent: false }` sem entregar o OTP. Usuários que precisem de 2FA via SMS ou email não receberão o código.
**Mitigation atual:** Em dev/staging, o código é logado via `[OTP-DEV]`. Em produção, 2FA via TOTP (authenticator app) funciona normalmente — apenas SMS/email OTP não entrega.
**Blocks RC1:** NÃO (TOTP via app funciona; SMS OTP é feature secundária)
**Blocks Piloto:** DEPENDENTE — se o piloto exigir 2FA via SMS para todos os usuários, bloqueia. Se TOTP for suficiente, não bloqueia.
**Fix target:** Pré-produção plena — integrar Twilio/AWS SNS para SMS; AWS SES/SendGrid para email

---

## KI-06 — crypto.randomUUID() Sem Fallback
**Severity:** LOW (Node.js >= 22 — não há risco real)
**Status:** NOT APPLICABLE — ambiente usa Node.js 22.15.0
**Description:** `privacy.js` usa `crypto.randomUUID()`. Requer Node.js >= 15.13.0. Com Node.js 22.15.0 em produção, não há risco.
**Blocks RC1:** NÃO

---

## KI-12 — Test Fixtures Não Atualizadas para POST /platform/units com Endereço
**Severity:** LOW (infraestrutura de testes, sem impacto em produção)
**Status:** PRE-EXISTING — identificado em ARCHITECTURE-FREEZE-RC1-01 (2026-08-07)
**Description:** `iam-01.test.mjs`, `bug-clinic-01.test.mjs`, `tech-scale-01b.test.mjs` criam UBS via POST /platform/units sem campos de endereço (`street`, `streetNumber`, `neighborhood`). A rota passou a exigir esses campos em `bf53c72 fix(UBS-ADDRESS-REQUIRED)`. Os testes foram escritos antes dessa mudança.
**Symptom:** Suite inteira cancelada (27+ cancelled) porque o setup falha na criação da UBS de teste.
**Root cause:** Fixtures de teste desatualizadas — não é bug de produção.
**Blocks RC1:** NÃO
**Fix target:** Atualizar fixtures para incluir endereço completo

## KI-13 — iam-01a: support_admin e break_glass_admin classificados como "orphaned"
**Severity:** LOW (falso positivo no teste)
**Status:** PRE-EXISTING — confirmado em ARCHITECTURE-FREEZE-RC1-01 (2026-08-07)
**Description:** `iam-01a.test.mjs` verifica que nenhum usuário tem `unitId` nulo ou vazio. `support_admin` (unitId: "") e `break_glass_admin` (unitId: undefined) são intencionalmente sem UBS — isso é comportamento correto. O teste não exclui esses roles especiais.
**Root cause:** Teste não exclui roles que legitimamente não têm unitId.
**Blocks RC1:** NÃO
**Fix target:** Excluir support_admin e break_glass_admin da verificação

## KI-14 — p0-env-validation: Incompatibilidade de Path Windows com import URL
**Severity:** LOW (ambiente de desenvolvimento, não CI/produção)
**Status:** PRE-EXISTING — confirmado em ARCHITECTURE-FREEZE-RC1-01 (2026-08-07)
**Description:** `p0-env-validation.test.mjs` usa `spawnSync` passando o path absoluto do `config.js` via `--eval "import \"<path>\""`. Em Windows, o path `C:\dev\vitras\...` é inválido como URL de ES module. Em Linux/CI (Render), o path `/app/src/config.js` é válido.
**Root cause:** Incompatibilidade do test runner com Windows — não é bug de produção.
**Blocks RC1:** NÃO (CI/Render roda Linux)
**Fix target:** Usar `pathToFileURL()` ao construir o import statement

---

## KI-07 — Pre-existing Test Suite Failures
**Severity:** LOW (infraestrutura de testes, sem impacto em produção)
**Status:** PRE-EXISTING — confirmado que não foram causados por sprints RC1
**Description:** Suítes de teste com falhas pré-existentes antes das sprints RC1:
- `acs-visits.test.js` (18 cancelled): POST /users gera temp password; login com password original falha
- `tasks.test.js` (7 cancelled): mesmo motivo — POST /users temp password
- `active-search.test.js` (17 cancelled): mesmo motivo
- `production-metrics.test.js` (18 cancelled): mesmo motivo
- `family-groups-workspace.test.js` (13 cancelled): mesmo motivo
- `exams.test.js` (1 fail): seed user `ana@clinica.local` não criado no DB de teste
- `cadastro-individual.test.js` (1 fail): token ausente em subtest de gestor
- `cadastro-domiciliar.test.js` (1 fail): similar
- `access-requests.test.js` (1 fail): assert expects 403 — fluxo de permissões test-only

**Root cause unificado:** `POST /users` gera temp password (comportamento correto de segurança), mas testes assumem que o password original é válido para login imediato. Não é um bug de produção.

**Suítes PASS (sem regressão):**
auth(13), patients(9), health(3), encryption(11), lgpd-baseline(23), observability(8), sprint-c-active-unit(1), migrations(6), agenda(2), queue(3), referrals(2), twofa(5), schema-validation(16), backup(3), schedule(1), domain-review(4) — **total: 110 PASS, 0 FAIL**

**Blocks RC1:** NÃO
**Fix target:** Pós-RC1 — atualizar testes para usar fluxo de reset de senha após criação

---

## KI-08 — PERF-03: withDb Global Lock (Débito Técnico P2)
**Severity:** P2 para escala municipal (>500 usuários simultâneos)
**Status:** DOCUMENTADO — débito técnico planejado
**Description:** `withDb()` usa `SELECT ... FOR UPDATE` na única row `app_state WHERE id=1`. Todos os writes do sistema serializam através desta row. Para piloto controlado (<50 usuários), impacto é negligenciável. Para escala municipal (500+ usuários), cria contenção.
**Mitigation:** PERF-02 já removeu aquisições de lock desnecessárias nos read paths. PERF-05 eliminou O(N) scan do bootstrap.
**Blocks RC1:** NÃO (piloto controlado, < 50 usuários)
**Blocks Piloto:** NÃO
**Fix target:** Pós-piloto — migração app_state para modelo multi-row por UBS

---

## KI-09 — PERF-04: O(N) AES-256-GCM Decrypt em Cache Miss (Débito Técnico P3)
**Severity:** P3 (mitigado por DB_CACHE_TTL_MS=5000)
**Status:** PARCIALMENTE MITIGADO
**Description:** Cache miss do readDb() dispara decrypt AES-256-GCM de todos os campos sensíveis de todos os pacientes. Com TTL de 5000ms em produção, ocorre no máximo uma vez a cada 5 segundos.
**Mitigation:** `DB_CACHE_TTL_MS=5000` em render.yaml. Para piloto com < 200 pacientes, decrypt é < 10ms.
**Blocks RC1:** NÃO
**Fix target:** Pós-PERF-03 — lazy decrypt por demanda

---

## KI-10 — Branches Experimentais Não Mergeadas
**Severity:** LOW (sem impacto em produção)
**Status:** Documentado
**Description:** Branches locais e remotas não mergeadas: `codex-disable-idle-logout`, `codex-fix-chart-access-verify`, `feat/sprint-5a-esus-fields`, `chore/rotate-data-encryption-key`, `dev`. Nenhuma pertence ao RC1.
**Blocks RC1:** NÃO
**Action:** Limpeza pós-RC1 — avaliar merge ou archive de cada branch

---

## KI-11 — Chunk Size Warning (maplibre-gl > 500KB)
**Severity:** LOW (aviso de build, não erro)
**Status:** Documentado
**Description:** `maplibre-gl-B6Q-kWaA.js` é 1.05MB (284KB gzip). Vite emite aviso de chunk size. Performance de carregamento inicial impactada em conexões lentas.
**Mitigation:** Compressão gzip em CDN reduz para 284KB. Carregamento lazy do mapa via dynamic import seria a solução ideal.
**Blocks RC1:** NÃO
**Fix target:** Pós-piloto — dynamic import() para a página de mapa territorial
