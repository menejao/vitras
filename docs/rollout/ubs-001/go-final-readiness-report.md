# GO FINAL — Relatório de Prontidão UBS #1

**Data:** 2026-05-26  
**Autor:** João Pedro (Tech Lead)  
**Ambiente verificado:** vitras-drill-sa-3 (sa-east-1)  
**Branch:** release/pilot-baseline  
**Commits verificados:** c605119 (SSL fix) + 8ab586e (runbooks) → HEAD atual  
**Supersede parcial:** `ubs-001-final-go-no-go.md` (atualiza estado vivo; mantém como referência de código)

---

## Resumo Executivo

**DECISÃO RECOMENDADA: GO CONDICIONADO**

Baseline técnico supera o avaliado em 2026-05-25. Recovery drill completo confirmou o ambiente vivo: migrations 8/8, breakglass operacional, restart validado, smoke tests limpos. Restam **2 bloqueadores técnicos** (EB health check + RDS backup retention), **4 bloqueadores operacionais humanos** (contatos, aceite, tabletop, drill formal) e **3 pendências não bloqueantes** aceitas para piloto.

---

## Seção 1 — Estado Técnico Verificado em Ambiente Vivo

Validado em vitras-drill-sa-3 em 2026-05-26. Não inferido de código — confirmado por API calls e consultas AWS.

| Item | Estado | Evidência |
|------|--------|-----------|
| EB Color | **Green** | `aws eb describe-environment-health` → `Status: Ok, Color: Green` |
| `/readyz` | **200 ok=true** | `curl /readyz` → `{"ok":true,"readiness":{"ready":true,"phase":"ready"}}` |
| `/health` | **ok, postgres=ok, migrations=ok** | `{"status":"ok","subsystems":{"postgres":"ok","migrations":"ok"}}` |
| Migrations aplicadas | **8/8** | `/health subsystems.migrations=ok`; runner idempotente confirmado |
| cpf_hash preenchido | **40/40 pacientes** | `syncShadowTables()` backfill confirmado via `withDb()` com DATA_ENCRYPTION_KEY |
| Boot time | **172ms** | `startedAt` → `bootCompletedAt` no `/health runtime` |
| Restart | **16s** | EB restart-app-server → /readyz 200 em 30s |
| Login breakglass | **role=break_glass_admin** | `breakglass@vitras.com.br` → JWT válido + role correto |
| `GET /patients` | **200, 40 pacientes** | Autenticado com token breakglass |
| `GET /agenda` | **200, 28 items** | Autenticado |
| `GET /queue` | **200, 2 items** | Autenticado |
| `GET /audit-logs` | **200, 2714 eventos** | Autenticado |
| `GET /patients` sem token | **401** | Rate limit + auth corretos |
| NODE_ENV | **production** | EB env vars confirmados via AWS CLI |
| RDS SG → EB SG | **Autorizado** | `sgr-02c0620271ed4e5e7` adicionado durante recovery |
| RDS encryption at rest | **Enabled** | `StorageEncrypted: True` |
| Versão Node.js | **22** | EB platform |

### Env vars configurados em vitras-drill-sa-3

| Variável | Status |
|----------|--------|
| `NODE_ENV=production` | ✅ |
| `DATABASE_URL` | ✅ (aponta para vitras-drill-restore) |
| `JWT_SECRET` | ✅ |
| `DATA_ENCRYPTION_KEY` | ✅ (chave original, validada) |
| `PATIENT_LOOKUP_HASH_KEY` | ✅ |
| `BACKUP_EXPORT_KEY` | ✅ |
| `ADMIN_SEED_KEY` | ✅ |
| `CORS_ALLOW_ALL=true` | ⚠️ Temporário — ver Seção 4 |
| `COOKIE_SECURE=false` | ⚠️ Temporário — ver Seção 4 |
| `UPSTASH_REDIS_REST_URL/TOKEN` | ❌ Ausente — ver Seção 4 |
| `LOG_FORMAT` | ➖ Não setado — default `json` em prod (OK) |
| `APP_VERSION` | ➖ Não setado — `unknown` em logs (não bloqueante) |

---

## Seção 2 — Bloqueadores Técnicos (requerem ação antes do GO)

### BT-01: EB Health Check = TCP:80 em vez de HTTP:/readyz

**Estado atual:** `Target: TCP:80` — o ELB verifica apenas se a porta responde.  
**Impacto:** Uma instância com app em crash loop mas porta aberta (Node.js travado antes de responder) seria considerada saudável pelo ELB e continuaria recebendo tráfego.  
**Fix obrigatório:**

```bash
aws elasticbeanstalk update-environment \
  --environment-name vitras-drill-sa-3 \
  --option-settings \
    Namespace=aws:elb:healthcheck,OptionName=Target,Value=HTTP:80/readyz \
    Namespace=aws:elb:healthcheck,OptionName=Interval,Value=30 \
    Namespace=aws:elb:healthcheck,OptionName=HealthyThreshold,Value=2 \
    Namespace=aws:elb:healthcheck,OptionName=UnhealthyThreshold,Value=3 \
    Namespace=aws:elb:healthcheck,OptionName=Timeout,Value=10
```

**Verificar após:** AWS Console → EB → Configuration → Load Balancing → Health Check Path = `/readyz`.  
**Bloqueante:** SIM — `ubs-001-final-go-no-go.md` item 6.

---

### BT-02: RDS Backup Retention = 1 dia (mínimo requerido: 7)

**Estado atual:** `BackupRetentionPeriod: 1` na instância `vitras-drill-restore`.  
**Impacto:** RPO efetivo = 24h, mas janela de PITR = apenas 1 dia. Erro nos dados descoberto após D+1 = sem restore possível.  
**Fix obrigatório:**

```bash
aws rds modify-db-instance \
  --db-instance-identifier vitras-drill-restore \
  --backup-retention-period 7 \
  --apply-immediately
```

**Verificar após:** `aws rds describe-db-instances --db-instance-identifier vitras-drill-restore --query "DBInstances[0].BackupRetentionPeriod"`  
**Bloqueante:** SIM — `ubs-001-final-go-no-go.md` item 9; `final-go-live-checklist.md` T-7.

---

## Seção 3 — Bloqueadores Operacionais (requerem ação humana)

Estes itens não dependem de código ou infra — dependem de coordenação humana. Nenhum pode ser resolvido automaticamente.

### BO-01: `contatos.md` com placeholders não preenchidos

**Estado:** Todos os campos `[nome]`, `[contato]`, `[e-mail/telefone]` da UBS e do time AWS estão em branco.  
**Requerido:** Nome real, telefone celular com DDD, e-mail de cada: Coordenador UBS, Médico responsável, Enfermeiro chefe, ACS de referência, Responsável TI prefeitura, DPO.  
**Por quê bloqueia:** Sem contatos, incidente P0 às 21h = coordenação por memória = falha humana.  
**Responsável:** João Pedro (time Vitras) + Coordenador UBS.

---

### BO-02: `aceite-operacional.md` não assinado

**Estado:** Documento existe, critérios de aceite definidos, campos de assinatura em branco.  
**Requerido:**
- UBS Coordinator: nome, assinatura, data
- Médico responsável: nome, CRM, assinatura, data
- Tech Lead (João Pedro): assinatura, data

**Por quê bloqueia:** Sem aceite formal, deploy coloca responsabilidade civil ambígua. CFM exige responsabilidade médica documentada para prontuário eletrônico.  
**Responsável:** UBS Coordinator + Médico responsável (assinaturas deles não podem ser geradas por sistema).

---

### BO-03: Tabletop exercise não executado com equipe

**Estado:** Template criado e validado (`tabletop-exercise-report.md`, `tabletop-final-report.md`). Sessão com equipe não ocorreu.  
**Requerido:** Sessão de ~2h com: João Pedro + Coordenador UBS + representante TI Prefeitura. Score mínimo 3/5.  
**Por quê bloqueia:** Equipe da UBS não sabe o que fazer em incidente. Gap 3 (Redis outage → papel) e Gap 4 (LGPD erasure request) não foram praticados.  
**Responsável:** João Pedro (agenda + facilitação).

---

### BO-04: DR drill formal não executado contra staging

**Estado:** Templates completos, procedimento documentado. Drill real contra vitras-staging com PITR não foi executado.  
**Requerido:** Drill completo: snapshot → PITR → restore → validação contagem de pacientes → RTO ≤ 240 min confirmado.  
**Por quê bloqueia:** RPO/RTO são suposição, não medido. Discovery de erros de restore só ocorre em drill.  
**Responsável:** João Pedro. Estimativa: 2–4h em vitras-staging.

---

## Seção 4 — Pendências Não Bloqueantes (aceitas para piloto)

Estes itens são gaps reais mas não impedem o GO para piloto de instância única.

### PNB-01: `CORS_ALLOW_ALL=true` em vez de `FRONTEND_ORIGINS`

**Risco:** Aceita requisições de qualquer origem — excessivamente permissivo.  
**Mitigação:** Endpoint HTTP-only (EB sem HTTPS). Piloto interno na UBS, sem exposição pública.  
**Ação:** Substituir por `FRONTEND_ORIGINS=https://[domínio]` quando domínio HTTPS definido.  
**Target:** Antes de UBS #2 ou HTTPS ativo.

---

### PNB-02: `COOKIE_SECURE=false`

**Risco:** Cookies não marcados como Secure — transmissíveis por HTTP.  
**Mitigação:** Endpoint já é HTTP (EB sem SSL termination). Em HTTP-only, `Secure=true` impediria os cookies de funcionar. Estado atual é correto para o deployment.  
**Ação:** Setar `COOKIE_SECURE=true` quando HTTPS for ativado (CloudFront ou ACM no EB).  
**Target:** Antes de qualquer exposição pública.

---

### PNB-03: Upstash Redis não configurado

**Risco:** Rate limiting usa MemoryStore em vez de store distribuído. Sem Upstash, circuito não é compartilhado entre instâncias.  
**Mitigação:** Piloto UBS #1 = instância única. MemoryStore funciona corretamente para single-instance. Fail-closed para Upstash ausente NÃO se aplica — Upstash ausente usa MemoryStore (não 503). 503 ocorre apenas quando Upstash configurado mas falha.  
**Ação:** Provisionar Upstash antes de escalar para múltiplas instâncias ou UBS #2.  
**Target:** Sprint 5B.

---

### PNB-04: Senha do breakglass não trocada

**Risco:** Senha temporária `MFR1_xC0URjnCdFqLaI!2Bg` gerada durante recovery conhecida pelo operador que executou o drill.  
**Mitigação:** Conta `break_glass_admin` não tem acesso clínico direto — aciona auditoria completa em cada uso. Senha não commitada, não exposta em logs.  
**Ação obrigatória:** Trocar senha antes de qualquer uso clínico real. Procedimento:
```bash
# Via API autenticada (requer token break_glass_admin atual)
curl -X PATCH https://[url]/me/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"MFR1_xC0URjnCdFqLaI!2Bg","newPassword":"[nova-senha-forte]"}'
# Armazenar nova senha em vault antes de executar
```
**Target:** Antes de T-0.

---

### PNB-05: `security_auditor` não criado

**Risco:** Sem conta de auditoria, ações do breakglass não têm revisor independente dentro de 24h.  
**Mitigação:** Audit log registra tudo. João Pedro pode revisar manualmente.  
**Ação:** Criar via `provision-remote-enterprise-user.mjs` com `PROVISION_USER_ROLE=security_auditor`.  
**Target:** T-3.

---

### PNB-06: RDS sem Multi-AZ

**Risco:** Failover automático de banco não disponível. Falha de hardware na AZ = downtime manual.  
**Mitigação:** Piloto interno com tolerância a janela de manutenção. PITR disponível para restore.  
**Ação:** Avaliar Multi-AZ para fase de produção plena (custo 2x na instância RDS).  
**Target:** Antes de UBS #3+.

---

### PNB-07: CloudWatch alarms não configurados

**Estado:** Nenhum dos 8 alarms provisionados (`startup.failed`, `5xx-spike`, etc.).  
**Risco:** Degradação silenciosa — sistema pode acumular erros sem alertar operador.  
**Mitigação:** João Pedro disponível on-call D+0 a D+7. Monitoramento manual aceitável para piloto de 7 dias.  
**Ação:** Provisionar conforme `cloudwatch-alarm-setup.md` antes de T-0 ou imediatamente após GO.  
**Target:** T-7 (idealmente) ou D+1 (limite aceitável).

---

## Seção 5 — Riscos Aceitos para Piloto

| Risco | Severidade | Aceite | Condição de escalada |
|-------|-----------|--------|---------------------|
| Multi-tenant isolation — não re-testado em prod após recovery | ALTO | Aceito — 15 propriedades verificadas em código; smoke tests confirmam 200 em /patients | Qualquer cross-team data exposure → P0 imediato, rollback |
| Redis ausente → rate limit não distribuído | MÉDIO | Aceito — instância única | Escalar para multi-instância antes de UBS #2 |
| RDS sem Multi-AZ | MÉDIO | Aceito — piloto interno | Failover manual aceito; window de manutenção tolerável |
| CORS_ALLOW_ALL | MÉDIO | Aceito — HTTP interno, sem exposição pública | Substituir antes de HTTPS |
| Sem CloudWatch alarms | MÉDIO | Aceito com mitigação (on-call manual D+0–D+7) | Provisionar ≤ D+1 |
| KI-02 anonymization (LGPD/CFM) | ALTO | Aceito com lock — endpoint não disponível para operadores | Sprint 5A legal review obrigatório |
| KI-01 usersRouter antes de requireAuth | MÉDIO | Aceito — routes individuais têm auth inline; nenhum gap encontrado | Sprint 5A refactor |
| KI-03 rejectUnauthorized=false | MÉDIO | Aceito — VPC isolation confirmado (SG rule ativa) | Sprint 5B |

---

## Seção 6 — Checklist de Fechamento para GO

### Bloqueadores técnicos (João Pedro — pode executar hoje)

- [ ] **BT-01:** EB health check → `HTTP:80/readyz` (comando na Seção 2)
- [ ] **BT-02:** RDS backup retention → 7 dias (comando na Seção 2)

### Bloqueadores operacionais humanos (requerem coordenação)

- [ ] **BO-01:** `contatos.md` preenchido — todos placeholders substituídos por dados reais
- [ ] **BO-02:** `aceite-operacional.md` assinado — UBS Coordinator + Médico responsável + Tech Lead
- [ ] **BO-03:** Tabletop executado — score ≥ 3/5 documentado em `tabletop-exercise-report.md`
- [ ] **BO-04:** DR drill executado contra staging — RTO ≤ 240 min, `dr-drill-final-report.md` assinado

### Antes de T-0 (não bloqueiam GO-CONDICIONADO mas devem anteceder deploy real)

- [ ] **PNB-04:** Senha breakglass trocada + armazenada em vault
- [ ] **PNB-05:** security_auditor criado
- [ ] **BT-01 verificado:** `eb status` + `/readyz` health check ativo antes da janela de deploy
- [ ] `pre-deploy-validation.md` completado e assinado
- [ ] CloudWatch alarms provisionados (ou comprometimento formal de D+1)
- [ ] `APP_VERSION=v1.0-pilot-governed` setado em EB env vars

---

## Seção 7 — Decisão

```
╔══════════════════════════════════════════════════════════════════╗
║  DECISÃO: GO CONDICIONADO                                        ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  BASELINE TÉCNICO: PASS                                          ║
║    • 15/15 propriedades de código verificadas (2026-05-25)       ║
║    • Ambiente vivo validado em recovery drill (2026-05-26)       ║
║    • 8/8 migrations, 40/40 cpf_hash, boot 172ms, restart 16s    ║
║    • Smoke tests limpos: patients, agenda, queue, audit-logs     ║
║                                                                  ║
║  BLOQUEADORES RESTANTES: 6                                       ║
║    • BT-01: EB health check (técnico, 15 min)                    ║
║    • BT-02: RDS backup retention (técnico, 5 min)                ║
║    • BO-01: contatos.md preenchido (humano)                      ║
║    • BO-02: aceite-operacional assinado (humano)                 ║
║    • BO-03: tabletop executado (humano, 2h)                      ║
║    • BO-04: DR drill formal (humano/técnico, 2–4h)               ║
║                                                                  ║
║  PENDÊNCIAS NÃO BLOQUEANTES: 7                                   ║
║    • Todos aceitos com mitigação documentada                     ║
║    • Nenhum representa risco de integridade de dados             ║
║                                                                  ║
║  TORNA-SE GO INCONDICIONAL QUANDO:                               ║
║    BT-01 + BT-02 + BO-01 + BO-02 + BO-03 + BO-04 resolvidos    ║
║                                                                  ║
║  HARD BLOCKS (qualquer um → NO-GO imediato):                     ║
║    • Multi-tenant isolation failure em smoke test prod           ║
║    • CPF/CNS exposto sem mascaramento em qualquer endpoint       ║
║    • breakglass login falha em T-0                               ║
║    • DR drill: RTO > 240 min sem mitigação documentada           ║
║                                                                  ║
║  Assinado: João Pedro — 2026-05-26                               ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Apêndice — Sequência Recomendada para GO

**Esta semana (podem ser paralelos):**

1. Executar BT-01 e BT-02 (30 min total — João Pedro)
2. Preencher `contatos.md` com dados reais (João Pedro + Coordenador UBS)
3. Agendar tabletop com Coordenador UBS e TI Prefeitura (2h)
4. Executar DR drill em vitras-staging (João Pedro, meio período)
5. Obter assinaturas de `aceite-operacional.md` (UBS Coordinator + Médico)

**T-3 dias:**

6. Trocar senha breakglass + armazenar em vault
7. Criar security_auditor
8. Completar `pre-deploy-validation.md`
9. Setar `APP_VERSION=v1.0-pilot-governed` no EB
10. Provisionar CloudWatch alarms (ou D+1 no máximo)

**T-0:**

11. `eb status` → Green confirmado
12. RDS snapshot manual antes do deploy
13. Deploy conforme `eb-deploy-reproducibility.md`
14. Smoke test T+30min conforme `final-go-live-checklist.md`
15. GO declarado → notificar Coordenador UBS

---

*Documento gerado em 2026-05-26. Deve ser revisado e confirmado pelo Tech Lead antes de T-7.*
