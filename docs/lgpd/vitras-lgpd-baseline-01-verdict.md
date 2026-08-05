# VITRAS-LGPD-BASELINE-01 — Veredicto Final

**Sprint:** VITRAS-LGPD-BASELINE-01  
**Data:** 2026-08-05  
**Classificação:** LGPD TECHNICAL BASELINE COMPLETE  

---

## Veredicto por Domínio (17 itens)

| # | Domínio | Status | Evidência |
|---|---------|--------|-----------|
| 1 | Autenticação e controle de acesso | **PASS** | JWT HS256 com issuer/audience validados; `requireAuth` global em `app.js:60`; refresh token opaco armazenado hasheado |
| 2 | Isolamento multi-UBS (multi-tenant) | **PASS** | `resolveActiveUnit(req)` usa `req.user?.unitId` do JWT; nunca aceita `unitId` do body cliente; verificado em `helpers.js` e todas as rotas clínicas |
| 3 | Criptografia de dados sensíveis em repouso | **PASS** | AES-256-GCM para cpf, cns, cnsResponsavel, nis, twoFactorSecret; formato `enc1:{kid}:{iv}:{enc}:{tag}`; multi-key registry com `DATA_ENCRYPTION_ACTIVE_KEY_ID` |
| 4 | Hash de lookup (CPF/CNS) | **PASS** | HMAC-SHA256 com `PATIENT_LOOKUP_HASH_KEY` separado de `DATA_ENCRYPTION_KEY`; `computeLookupHash` strips non-digits antes do hash |
| 5 | Proteção de senhas | **PASS** | scrypt com formato `s1$<salt>$<key>`; nunca armazena em plaintext; verificado em `lgpd-baseline.test.js` |
| 6 | Redaction em logs | **PASS** | `SENSITIVE_KEY_PATTERN` redacta authorization, cookie, token, secret, password, cpf, cns, set-cookie; 5 testes automatizados PASS em `lgpd-baseline.test.js` |
| 7 | Dados de categorias especiais (LGPD Art. 11) | **PASS** | `SPECIAL_CATEGORY_FIELDS` (genderIdentity, racaCor, etnia, situacaoRua, deficiencia, hivGestante, sifilis, cidPrincipal, cidSecundarios, ciapPrincipal) redactados com `[REDACTED-SPECIAL-CATEGORY]` nos snapshots de auditoria |
| 8 | Cadeia de auditoria | **PASS** | Hash chain SHA256 com `prevHash`; `hashAuditPayloadV2` com canonical JSON (chaves ordenadas); `AUDIT_LOG_RETENTION_DAYS=730`; classificação `legacy_incompatible` vs `broken` vs `orphaned` |
| 9 | Exportação CDS e isolamento de UBS | **PASS** | `cds-export.js` usa `resolveActiveUnit(req)` exclusivamente; retorna 404 (não 403) para cross-UBS (não revela existência); capability `cds.export` obrigatória; arquivo PROTEGIDO — zero alterações |
| 10 | Isolamento de support_admin | **PASS** | `blockSupportAdminFromClinical` bloqueia rotas não-platform; log de segurança `security.authz.support_admin_clinical_blocked`; verificado em `auth.js` |
| 11 | Break glass | **PASS** | Capability `session.break_glass.activate` obrigatória; reason mandatory (BreakGlassSchema); TTL 15min; audit `auth.break_glass_activated` com actorUserId + reason; deactivate revoga refresh token |
| 12 | Backup e recuperação | **PASS** | `readDbForBackup()` retorna dados JSONB encriptados no modo postgres; modo arquivo também retorna dados encriptados (writeDbToFile sempre serializa com encryption); PITR via Neon disponível |
| 13 | Endpoints de privacidade (LGPD Art. 18) | **PASS** | `requireManager` gating em `/privacy/routes`; `buildPatientAccessReport` retorna apenas `report.summary` para o cliente; isolamento por `teamId` |
| 14 | Exposição de dados na API de saúde | **PASS** | `/health` e `/readyz` não expõem cpf, cns, password, JWT_SECRET, DATA_ENCRYPTION_KEY; verificado via teste automatizado |
| 15 | Logs estruturados com rastreabilidade | **PASS** | `requestId` (UUID) + `X-Request-Id` + `X-Correlation-Id` em toda requisição; `userId`, `role`, `activeUnitId` em todos os logs de `http.request.completed`; 8 testes PASS em `observability.test.js` |
| 16 | Métricas de segurança e monitoramento | **PASS** | `recordMetric` para auth.login, auth.logout, auth.ubs_switch, patient.created, appointment.created, exam.created, error.4xx, error.5xx; security events logados (token_missing, token_invalid, support_admin_blocked) |
| 17 | Procedimento de resposta a incidentes | **PASS** | `docs/lgpd/procedimento-incidente-lgpd.md` criado com 7 cenários (INC-01 a INC-07); contenção, investigação e recuperação para cada; matriz de escalação; prazo ANPD 72h (Art. 48) |

---

## Sumário por Domínio LGPD

| Domínio | Classificação |
|---------|---------------|
| Princípios de tratamento (Art. 6) | PASS |
| Dados pessoais sensíveis (Art. 11) | PASS |
| Segurança (Art. 46–49) | PASS |
| Direitos do titular (Art. 18) | PASS |
| Transferência e exportação | PASS |
| Retenção e eliminação | PASS — 730 dias auditoria; exames/pacientes: inativação lógica (não hard delete) |
| Rastreabilidade e auditoria | PASS |
| Acesso privilegiado | PASS |
| Isolamento de dados entre UBS | PASS |
| Criptografia em repouso | PASS |
| Criptografia em trânsito | PASS — TLS obrigatório no Render e Neon |
| Resposta a incidentes | PASS |

---

## Não Conformidades Identificadas e Disposição

Nenhuma não conformidade crítica identificada.

**Observações menores (não bloqueantes):**
- Migration `console.log` em `migrate.js` loga CONTAGEM de CPFs, não valores — aceitável
- `AUDIT_PRUNE_ENABLED` requer configuração explícita para ativação — correto por design
- `DATA_ENCRYPTION_KEYS` multi-key rotation disponível mas não documentado para operação — item para treinamento de piloto

---

## Testes Automatizados

| Suite | Testes | Status |
|-------|--------|--------|
| `lgpd-baseline.test.js` | 23/23 | PASS |
| `observability.test.js` | 8/8 | PASS |

---

## Critério de Conclusão

- Nenhuma exposição conhecida de dados pessoais ou sensíveis: **SIM**
- Logs adequadamente sanitizados: **SIM**
- Exportações auditadas e isoladas por UBS: **SIM**
- Break glass totalmente rastreável: **SIM**
- support_admin isolado: **SIM**
- Todas as não conformidades críticas corrigidas ou classificadas com plano: **SIM**
- Evidência objetiva para todos os critérios: **SIM** (testes automatizados + inspeção de código)

**RESULTADO: LGPD TECHNICAL BASELINE COMPLETE**
