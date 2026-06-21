# 07 — Checklist de Go-Live

**Versão:** 1.0 | **Produto:** VITRAS APS | **Aplicação:** qualquer UBS do Brasil

---

## Princípio

Go-live é autorizado apenas quando todos os itens obrigatórios estão marcados.  
Nenhuma exceção por pressão de prazo.  
Delivery Governor emite a decisão formal.

---

## GL-A — Ambiente e Infraestrutura

| # | Item | Obrigatório | Verificação | Status |
|---|------|-------------|-------------|--------|
| A1 | Backend deployado e `/readyz` retornando 200 | **SIM** | `curl https://[backend]/readyz` | [ ] |
| A2 | Frontend publicado e acessível via URL de produção | **SIM** | Abrir URL no browser | [ ] |
| A3 | `NODE_ENV=production` ativo | **SIM** | `GET /health` | [ ] |
| A4 | `DATABASE_URL` apontando para banco de produção | **SIM** | `GET /readyz` → postgres: ok | [ ] |
| A5 | Migrations aplicadas: `migrationCount=24` | **SIM** | `GET /health` → migrationCount | [ ] |
| A6 | HTTPS ativo em frontend e backend | **SIM** | Browser → cadeado verde | [ ] |
| A7 | `FRONTEND_ORIGINS` configurado corretamente | **SIM** | Login funciona sem erro CORS | [ ] |

---

## GL-B — Configuração de Dados

| # | Item | Obrigatório | Verificação | Status |
|---|------|-------------|-------------|--------|
| B1 | `MUNICIPALITY_ID` = código IBGE 7 dígitos correto | **SIM** | Env EB | [ ] |
| B2 | CNES da unidade configurado | **SIM** | `GET /teams/public` → cnes | [ ] |
| B3 | INE de cada equipe configurado | **SIM** | `GET /teams/public` → ine | [ ] |
| B4 | Gestor criado com `unitId` correto | **SIM** | `GET /admin/bootstrap` | [ ] |
| B5 | Enfermeiros criados com `teamId` | **SIM** | `GET /users` | [ ] |
| B6 | ACS criados com `teamId` | **SIM** | `GET /users` | [ ] |
| B7 | `cnsProfissional` e `cboCodigo` configurados para gestor | **SIM** | `GET /users/[id]` | [ ] |
| B8 | `cnsProfissional` e `cboCodigo` configurados para todos os ACS | **SIM** | `GET /users/[id]` por ACS | [ ] |

---

## GL-C — Segurança

| # | Item | Obrigatório | Verificação | Status |
|---|------|-------------|-------------|--------|
| C1 | `JWT_SECRET` único, ≥ 32 chars | **SIM** | Env EB | [ ] |
| C2 | `DATA_ENCRYPTION_KEY` ≥ 32 chars | **SIM** | Env EB | [ ] |
| C3 | `PATIENT_LOOKUP_HASH_KEY` ≥ 32 chars, diferente de DATA_ENCRYPTION_KEY | **SIM** | Env EB | [ ] |
| C4 | `AUTH_MAX_ATTEMPTS=10` | **SIM** | Env EB | [ ] |
| C5 | `COOKIE_SECURE=true` | **SIM** | Env EB | [ ] |
| C6 | 2FA ativo para gestor | **SIM** | Login gestor → solicita TOTP | [ ] |
| C7 | 2FA ativo para todos os enfermeiros | **SIM** | Login enfermeiro → solicita TOTP | [ ] |
| C8 | Senhas iniciais trocadas por todos os usuários | **SIM** | Confirmar com cada usuário | [ ] |
| C9 | `break_glass_admin` não é conta de uso diário | **SIM** | Confirmar com equipe | [ ] |

---

## GL-D — Homologação

| # | Item | Obrigatório | Evidência | Status |
|---|------|-------------|-----------|--------|
| D1 | Homologação funcional (doc 03): PASS | **SIM** | Relatório assinado pelo QA Senior | [ ] |
| D2 | Homologação CDS (doc 04): PASS ou PASS COM WARNING | **SIM** | Relatório assinado pelo APS Specialist | [ ] |
| D3 | Warnings de CDS documentados e aceitos pelo gestor | Se PASS COM WARNING | Registro escrito | [ ] |

---

## GL-E — LGPD e Governança

| # | Item | Obrigatório | Evidência | Status |
|---|------|-------------|-----------|--------|
| E1 | DPO/Encarregado designado formalmente | **SIM** | Designação assinada | [ ] |
| E2 | DPA assinado (UBS/SMS ↔ VITRAS) | **SIM** | Contrato assinado | [ ] |
| E3 | Checklist LGPD (doc 05) completo | **SIM** | Relatório assinado pelo LGPD Lead | [ ] |
| E4 | Plano de resposta a incidente comunicado a todos | **SIM** | Confirmação de recebimento | [ ] |

---

## GL-F — Treinamento

| # | Item | Obrigatório | Evidência | Status |
|---|------|-------------|-----------|--------|
| F1 | Todos os ACS com checklist aprovado | **SIM** | Listas de presença + checklists | [ ] |
| F2 | Todos os enfermeiros com checklist aprovado | **SIM** | Listas de presença + checklists | [ ] |
| F3 | Gestor com checklist aprovado | **SIM** | Checklist gestor | [ ] |

---

## GL-G — Suporte e Contingência

| # | Item | Obrigatório | Status |
|---|------|-------------|--------|
| G1 | Contato técnico VITRAS disponível no D+0 | **SIM** | [ ] |
| G2 | Plano de rollback documentado | **SIM** | [ ] |
| G3 | Procedimento de rollback testado ou revisado | Recomendado | [ ] |
| G4 | Canal de comunicação de emergência ativo (WhatsApp ou similar) | **SIM** | [ ] |
| G5 | Backup do banco antes do go-live realizado | **SIM** | [ ] |

---

## Plano de Rollback (Resumo)

Em caso de problema crítico no D+0:

1. Ativar `READ_ONLY_MODE=true` via env EB → sistema aceita leituras, bloqueia escritas
2. Notificar equipe UBS: "Sistema em manutenção temporária"
3. Investigar causa no CloudWatch
4. Se necessário: reverter versão EB para versão anterior estável
5. Registrar incidente em audit log com `break_glass_admin`
6. Comunicar gestor e DPO

---

## Decisão de Go-Live

**Todos os itens GL-A a GL-G marcados?**

[ ] **SIM** — autorizar go-live

[ ] **NÃO** — itens pendentes: ______

---

**Decisão do Delivery Governor:**

| Status | Assinatura | Data |
|--------|-----------|------|
| [ ] **GO** | ______ | ______ |
| [ ] **GO COM RESTRIÇÕES** | ______ | ______ |
| [ ] **NO GO** | ______ | ______ |

**Restrições ou observações:**  
______

---

**GO COM RESTRIÇÕES** é aceitável apenas quando:
- As restrições não afetam segurança nem LGPD
- A correção tem prazo máximo de 7 dias
- O gestor da UBS está ciente e aceitou formalmente por escrito
