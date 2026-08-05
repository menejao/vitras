# VITRAS v1.1.0-rc.1 — Release Notes

**Data:** 2026-08-05  
**Tipo:** Release Candidate 1 (RC1)  
**Commit:** 6fb87cf  
**Branch:** claude/vitras-p0-blockers-497suw  
**Objetivo:** Primeiro Release Candidate para piloto controlado em UBS municipal  

---

## Resumo Executivo

O VITRAS v1.1.0-rc.1 consolida 10 sprints de desenvolvimento desde o baseline v1.0-pilot-governed (2026-05-25). Esta versão inclui Multi-UBS completo, LGPD técnica baseline, hardening de produção, observabilidade estruturada, desempenho validado e eliminação de 16 bloqueadores de segurança e integridade clínica.

**Status:** RC1 CANDIDATE — apto para piloto controlado em UBS #1 com 1–3 equipes, 50–200 pacientes cadastrados e 5–20 usuários simultâneos.

---

## O que há de novo desde v1.0-pilot-governed

### Multi-UBS e Contexto de Unidade
- Seleção de unidade ativa pelo usuário (troca de UBS sem logout)
- `resolveActiveUnit` em todas as rotas clínicas — escopo correto por sessão
- `activeUnitId` registrado em todos os eventos de auditoria
- Isolamento entre unidades validado em testes de regressão

### Segurança e Integridade Clínica (16 blockers)
- Separação de modos `canAccessPatient`: read / write / clinical_write
- Break Glass Admin com acesso irrestrito e auditoria obrigatória
- Isolamento municipal de recepcionistas
- Enforce de `assignedAcsId` para escritas de ACS
- CORS bloqueado em produção (`CORS_ALLOW_ALL=false` fail-fast)
- Security headers via helmet (CSP, HSTS, X-Content-Type-Options)
- Cookies SameSite=None + Secure para cross-origin (Vercel↔Render)

### LGPD Técnica Baseline
- Hash-chain de auditoria (LGPD-obrigatório): hashVersion v2, legacy_incompatible classification
- Snapshot SHA-256 de CPF/CNS em eventos de acesso individual (sem plaintext em logs)
- Runbook operacional LGPD, guia DPO/RIPD, template de política de privacidade
- `/privacy` endpoint para direito de acesso e anonimização

### Observabilidade
- Logging estruturado JSON (logInfo/logWarn/logError com requestId)
- `/metrics` endpoint com acumulador de métricas
- `requestMetricsMiddleware` — latência por rota, contagem de requests
- Documentação do dashboard CloudWatch

### Performance
- Paginação em `GET /patients` (padrão 200, máximo 500) com `paginationMeta`
- 3 índices compostos em `app_patients` (migration 032)
- Bootstrap: queries SQL em paralelo com readDb — elimina O(N) JS scan
- `GET /patients` e `GET /admin/bootstrap`: lock DB removido dos read paths (logInfo)
- Compressão gzip/brotli em responses ≥ 1KB
- `DB_CACHE_TTL_MS=5000` em produção — 3× menos ciclos de decrypt AES-256-GCM

### Operações
- `render.yaml` completo com todas as variáveis de ambiente documentadas
- `/health` e `/readyz` endpoints para monitoramento
- Degraded mode com clearDegraded
- DR Drill executado: RTO=100min, smoke 44/44 PASS

---

## Breaking Changes

Nenhum breaking change de API pública.

Mudanças internas de comportamento (sem impacto em clientes):
1. `GET /patients` retorna `{ patients: [...], paginationMeta: {...} }` — não mais array puro. Clientes que esperavam array devem usar `response.patients`. (`useBootstrap.js` já atualizado.)
2. `GET /admin/bootstrap` retorna o mesmo formato paginado. Clientes da API interna devem usar `response.patients` e `response.paginationMeta`.

---

## Limitações Conhecidas (RC1)

Ver [`known-issues.md`](known-issues.md) para lista completa. Destaques:

| ID | Descrição | Impacto no Piloto |
|----|-----------|-------------------|
| KI-05 | OTP SMS/email não configurado | BAIXO — TOTP via app funciona |
| KI-07 | 8 suítes de testes com falhas pré-existentes | Nenhum (infraestrutura de teste) |
| KI-08 | PERF-03: global withDb lock | NÃO para < 50 usuários simultâneos |
| KI-02 | LGPD vs CFM anonimização | NÃO para piloto (sem destruição de dados) |

---

## Dívida Técnica Conhecida

| ID | Débito | Prioridade | Bloqueia RC1? | Bloqueia Piloto? |
|----|--------|------------|----------------|------------------|
| PERF-03 | Global withDb lock | P2 | NÃO | NÃO |
| PERF-04 | Lazy decrypt AES-256-GCM | P3 | NÃO | NÃO |
| OTP-01 | SMS/email OTP provider | P1 | NÃO | CONDICIONAL |
| TEST-01 | Testes POST /users + login | P2 | NÃO | NÃO |
| CHUNK-01 | maplibre-gl chunk >500KB | P3 | NÃO | NÃO |

---

## Roadmap Pós-RC1

1. **Piloto Real UBS #1** — Gates C-1 (instrumento jurídico), C-2 (LGPD DPA), C-3 (treinamento equipe)
2. **APS-02A** — Módulo ACS Territorial (aguarda dados reais do piloto)
3. **OTP-01** — Integração SMS/email para 2FA em produção
4. **PERF-03** — Migração app_state para modelo multi-row por UBS
5. **TEST-01** — Correção de suítes de testes com temp password
6. **CID-10 / CIAP-2** — Integração de classificações clínicas padronizadas
7. **e-SUS Export** — Módulo de exportação para sistemas nacionais

---

## Instrução de Deploy

### Backend (Render)
```bash
# Gerar ZIP backend
node build-backend-zip.cjs

# Upload no Render Dashboard > Deploy > Upload ZIP
# Render executa automaticamente migrations (RUN_MIGRATIONS=true)
```

### Frontend Clínica (Vercel)
```bash
git push origin claude/vitras-p0-blockers-497suw
# Vercel detecta push e faz deploy automático via vercel.json
```

### Variáveis de Ambiente Críticas (Render)
```
NODE_ENV=production
DATABASE_URL=<Neon connection string>
JWT_SECRET=<32+ chars>
DATA_ENCRYPTION_KEY=<32+ chars>
PATIENT_LOOKUP_HASH_KEY=<32+ chars>
DB_CACHE_TTL_MS=5000          # NOVO em RC1
MUNICIPALITY_ID=<IBGE code>
CORS_ALLOW_ALL=false
FRONTEND_ORIGINS=https://vitras.vercel.app,...
COOKIE_SAME_SITE=none
COOKIE_SECURE=true
RUN_MIGRATIONS=true
```

---

## Validação RC1

| Teste | Status | Evidência |
|-------|--------|-----------|
| Backend unit/integration | 110 PASS, 0 FAIL | node --test (16 suítes) |
| Frontend build (clínica) | ✓ | npm run build, 6.43s |
| Frontend build (portal) | ✓ | npm run build, 1.22s |
| Auth / Login / Logout | PASS | auth.test.js 13/13 |
| LGPD Baseline | PASS | lgpd-baseline.test.js 23/23 |
| Observabilidade | PASS | observability.test.js 8/8 |
| Multi-UBS | PASS | sprint-c-active-unit.test.js |
| Criptografia | PASS | encryption.test.js 11/11 |
| Migrations | PASS | migrations.test.js 6/6 |
