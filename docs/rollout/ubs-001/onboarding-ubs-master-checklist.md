# Onboarding UBS — Master Checklist

**Versão:** v1.0  
**Criado em:** 2026-06-10  
**Plataforma:** VITRAS v1.0-pilot-governed  
**Autoridade:** Este documento é o checklist mestre de onboarding para cada nova UBS.  
**Uso:** Preencher para cada UBS antes do go-live. Arquivar junto com `contatos.md` e `aceite-operacional.md`.

> **Como usar:** Iniciar assim que uma UBS for selecionada. Cada gate deve ser fechado antes de avançar para o seguinte. Não pular gates.

---

## UBS Identificada

| Campo | Valor |
|-------|-------|
| Nome da UBS | [PREENCHER] |
| Município / Estado | [PREENCHER] |
| Endereço | [PREENCHER] |
| Número estimado de profissionais | [PREENCHER] |
| Número estimado de pacientes (carteira) | [PREENCHER] |
| Data prevista de go-live | [PREENCHER] |
| Instrumento jurídico (número do contrato ou termo) | [PREENCHER] |

---

## Gate 0 — UBS Selecionada + Instrumento Jurídico

> Sem instrumento jurídico assinado, nenhuma UBS pode entrar em operação com pacientes reais.

- [ ] **Termo de parceria / contrato assinado** entre Vitras e Prefeitura (Lei 14.133/2021 ou termo de cooperação técnica)
  - Responsável: João Pedro + Jurídico Prefeitura
  - Prazo: antes de T-30 (antes de qualquer ação de onboarding)
- [ ] **UBS e coordenador identificados** — nome, cargo, contato
- [ ] **Secretaria de Saúde ciente** da implantação e do cronograma

---

## Gate 1 — T-30 (Início do onboarding)

- [ ] **Data de go-live confirmada e no calendário** (preferencialmente terça ou quarta, 18h-22h)
- [ ] **Contatos iniciais preenchidos** — pelo menos Coordenador UBS + TI Prefeitura (contatos.md Seção B)
- [ ] **Kickoff com coordenador UBS realizado** — apresentar o sistema, fluxo de onboarding, expectativas

---

## Gate 2 — T-14

### Legal e Compliance (LGPD — obrigatórios antes do primeiro paciente real)

- [ ] **DPO designado pela Prefeitura** (LGPD Art. 41)
  - Documento de referência: `lgpd-dpo-ripd-guide.md` — Parte A
  - Evidência necessária: portaria ou contrato de designação
  - Bloqueador: SIM — sem DPO nenhum dado de paciente pode ser tratado
- [ ] **RIPD elaborado e assinado** pelo DPO e pelo controlador (LGPD Art. 38)
  - Documento de referência: `lgpd-dpo-ripd-guide.md` — Parte B (template preenchido)
  - Campos obrigatórios: Município, CNPJ Vitras, data, DPO, controlador
  - Bloqueador: SIM
- [ ] **Política de privacidade preenchida e publicada** (LGPD Art. 9)
  - Template: `politica-privacidade-template.md`
  - Publicação: impressa na recepção + página da Prefeitura ou sistema
  - Bloqueador: SIM — paciente deve ser informado antes do cadastro
- [ ] **DPAs confirmados com suboperadores** (LGPD Art. 37-39)
  - Checklist: `dpa-checklist.md`
  - Suboperadores: AWS (obrigatório), Upstash (se configurado), Neon/Render (confirmar se ativos)
  - Bloqueador: SIM para AWS (dado mais sensível); condicional para Upstash
- [ ] **contatos.md Seção C (DPO) preenchida** com dados do DPO designado

---

## Gate 3 — T-7

### Infraestrutura (João Pedro)

- [ ] **CloudWatch alarms (8) configurados** — `cloudwatch-alarm-setup.md`
  - startup.failed, migrations.failed_fatal, 5xx-spike, auth_failure-spike, circuit_breaker_opened, degraded_mode, deadlock_retry-spike, backup.health_warning
  - Esforço estimado: 3-5h
  - Bloqueador: SIM para prod; conditional GO com monitoring manual
- [ ] **CloudWatch log group recebendo logs** — query de verificação: `filter event = "server_started"`
- [ ] **RDS backup retention ≥ 7 dias** — verificar AWS Console → RDS → Maintenance & Backups
  - Nota B-07: Free Tier limita a 1 dia — upgrade AWS obrigatório antes de UBS #2
- [ ] **EB CLI pre-configurado** — `eb status` retorna Ready + Green
- [ ] **EB app version lista v1.0-pilot-governed** — `eb appversion`

### Contas e Accounts (João Pedro — ambiente de produção)

- [ ] **break_glass_admin criado** no ambiente de produção via `provision-remote-enterprise-user.mjs`
  - Procedimento: `docs/runbooks/production-bootstrap.md`
  - Credenciais em vault seguro
- [ ] **security_auditor criado** no ambiente de produção
- [ ] **Todos os env vars do EB validados** — checklist em `checklist-pre-rollout.md`

### Operacional (João Pedro + UBS Coordinator)

- [ ] **contatos.md COMPLETAMENTE preenchido** — zero campos `[fill]` ou `PENDENTE FORMAL`
  - Seção A: João Pedro + BGA + SA + Backup TL
  - Seção B: Coordinator, Médico CRM, TI Prefeitura, Enfermeiro, ACS
  - Seção C: DPO
  - Seção D: AWS Support plan + IAM admin
  - Seção F: grupo WhatsApp criado
  - Bloqueador: SIM — sem contatos não há escalação em P0
- [ ] **Tabletop exercise executado** com equipe UBS — score ≥ 3/5
  - Guia: `tabletop-final-report.md` (6 cenários: Redis, RDS, deploy failed, user access, data inconsistency, 5xx spike)
  - Duração: 2 horas
  - Participantes: João Pedro + Coordinator + pelo menos um clínico
  - Bloqueador: SIM
- [ ] **Paper documentation protocol confirmado com UBS staff**
  - Equipe sabe o que fazer se sistema mostrar 503
  - Papel disponível fisicamente na UBS
- [ ] **Deployment window confirmado com UBS coordinator**
  - Janela recomendada: terça ou quarta, 18h-22h BRT
  - Atendimentos encerram antes da janela de deploy

---

## Gate 4 — T-3

- [ ] **Staging quick re-validation** — `/readyz` 200 + login + 1 patient creation
- [ ] **Comunicação T-3 enviada** ao Coordinator — template em `plano-comunicacao.md`
- [ ] **`eb appversion` confirma v1.0-pilot-governed disponível**
- [ ] **Último RDS backup < 24h** — verificar no console
- [ ] **Rollback syntax confirmado mentalmente:**
  ```bash
  eb deploy --version v1.0-pilot-governed
  # Não executar ainda — apenas confirmar sintaxe
  ```
- [ ] **Todos os participantes do go-live confirmados disponíveis** para D+0

---

## Gate 5 — T-1

- [ ] **pre-deploy-validation.md completo e assinado** — João Pedro
- [ ] **Comunicação T-1 enviada** ao Coordinator + TI Prefeitura — template em `plano-comunicacao.md`
- [ ] **Equipe briefada sobre papéis no dia do go-live:**
  - Tech Lead: deploy, monitoring, decisão de rollback
  - UBS Coordinator: comunicação com staff, gestão do fluxo clínico
  - TI Prefeitura: escalação de rede/dispositivo
- [ ] **Todos os contatos de `contatos.md` verificados e acessíveis**
- [ ] **Formulários de papel confirmados fisicamente na UBS**
- [ ] **`/readyz` staging confirmado 200** (último sanity check)

---

## Gate 6 — T-0 (Deploy Day)

> Detalhamento completo em `final-go-live-checklist.md` → seção T-0.

**Pré-deploy (T-0 minus 1h):**
- [ ] Backup RDS do dia disponível
- [ ] Todos disponíveis e acessíveis
- [ ] UBS atendimentos encerrados / clínica pausada para janela de deploy
- [ ] Canal de incidente aberto (grupo WhatsApp)
- [ ] `eb status` → Ready + Green

**Deploy:**
- [ ] Deploy executado — registrar hora UTC
- [ ] `/readyz` 200 confirmado — registrar hora UTC
- [ ] `server_started` no CloudWatch com `driver=postgres`, `version=v1.0-pilot-governed`
- [ ] Break glass login OK
- [ ] POST /admin/units/bootstrap executado — registrar unitId

**Gate GO/NO-GO (T+30min):**
- [ ] Zero 5xx em 30 minutos
- [ ] Audit log registrando eventos
- [ ] Alarms CloudWatch verdes
- [ ] GO declarado — registrar hora UTC
- [ ] UBS Coordinator notificado

---

## Gate 7 — D+0 to D+14 (Observação)

- [ ] **D+0 to T+4h:** primeiro paciente real registrado por staff UBS
- [ ] **D+1:** `d1-report.md` preenchido e revisado com coordinator
- [ ] **D+7:** `d7-report.md` preenchido
- [ ] **D+0 to D+7:** Tech Lead on-call (sem ausências sem backup)
- [ ] **D+14:** `d14-report.md` assinado por João Pedro + Coordinator UBS
  - Critérios: zero P0/P1 nos últimos 7 dias, rotina autônoma estabelecida

---

## Pós D+14 — Gate para UBS #2

> UBS #2 não recebe GO enquanto UBS #1 não fechar Gate 7.

- [ ] `d14-report.md` assinado ✅
- [ ] Zero P0/P1 ativos herdados de UBS #1
- [ ] Upgrade AWS RDS backup retention 7 dias confirmado (pré-requisito absoluto)
- [ ] Lições aprendidas documentadas para UBS #2

---

## Checklist de Documentos (verificação final antes de T-0)

| Documento | Local | Status |
|-----------|-------|--------|
| contatos.md | `docs/rollout/ubs-001/contatos.md` | [ ] COMPLETO |
| aceite-operacional.md | `docs/rollout/ubs-001/aceite-operacional.md` | [ ] ASSINADO |
| tabletop-final-report.md | `docs/rollout/ubs-001/tabletop-final-report.md` | [ ] SCORE ≥ 3/5 |
| RIPD assinado | `docs/rollout/ubs-001/lgpd-dpo-ripd-guide.md` | [ ] ASSINADO |
| Política de privacidade publicada | `docs/rollout/ubs-001/politica-privacidade-template.md` | [ ] PUBLICADA |
| DPAs suboperadores | `docs/rollout/ubs-001/dpa-checklist.md` | [ ] AWS OK |
| pre-deploy-validation.md | `docs/rollout/ubs-001/pre-deploy-validation.md` | [ ] ASSINADO |
| Instrumento jurídico Vitras-Prefeitura | [fora do repositório — vault] | [ ] ASSINADO |

---

*Documento versão v1.0 — criado 2026-06-10*  
*Template para cada UBS — NÃO preencher com dados de UBS reais neste arquivo template*
