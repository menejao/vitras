# Pilot Readiness Score — VITRAS APS

**Versão:** 1.0  
**Data:** 2026-06-18  
**Baseado em:** código-fonte, git history, documentação existente, truth-audit.md

---

## Escala de Pontuação

| Faixa | Significado |
|-------|-------------|
| 9–10 | Pronto. Deploy imediato. |
| 7–8 | Pronto com mitigações documentadas. |
| 5–6 | Go com riscos. Gaps ativos que devem ser monitorados. |
| 3–4 | No-Go. Gaps críticos que precisam de resolução antes do piloto. |
| 0–2 | Não pronto. Trabalho fundamental pendente. |

---

## Avaliação por Categoria

### 1. Produto (7/10)

**O que funciona:**
- Fluxos clínicos principais (cadastro, atendimento, protocolo) implementados e testados
- RBAC implementado com middleware no backend — não é apenas frontend
- Recepção tem app própria (ReceptionistApp) — adequado ao perfil
- Gestor com filtro LGPD (F7-03) — dado sensível protegido
- Módulos complementares (farmácia, agenda, referrals, vacinas) presentes

**O que falta:**
- `cds-export.js` e `households.js` deletados do git — dessincronização git/produção
- Validação de CNS ausente no frontend
- CID/CIAP não validado em uso real
- nursing_tech: inconsistência entre escrita e leitura de prontuário

**Pontuação: 7/10**

---

### 2. Operação (6/10)

**O que funciona:**
- CloudWatch mencionado e configurado
- Health check `/health` implementado com degraded mode
- DR Drill documentado — RTO = 100 min (PASS)
- Rollback EB documentado no support-runbook

**O que falta:**
- Deploy desalinhado com git — impossível auditar o que está em produção
- Service worker não testado em condições reais de UBS
- Sem CI/CD formal — deploys manuais via zip
- Dual DB mode não documentado — risco de comportamento diferente entre envs

**Pontuação: 6/10**

---

### 3. LGPD (7/10)

**O que funciona:**
- Política de privacidade publicada em vitras.com.br/privacidade ✅
- DPO nomeado e e-mail público ✅
- Filtro F7-03 (gestor sem dados clínicos especiais) implementado ✅
- CNS responsável restrito a roles autorizados (F2-05) ✅
- Audit log com hash chain v2 (AUD-01) ✅
- LGPD governance em andamento

**O que falta:**
- DPA com município não assinado (processo em negociação)
- RIPD não finalizado
- CNPJ placeholder na política de privacidade
- Retenção de dados não formalizada
- Treinamento LGPD dos profissionais não realizado

**Pontuação: 7/10**

---

### 4. Treinamento (4/10)

**O que existe:**
- Fluxos documentados neste sprint (e2e-aps-flows.md)
- Demo dataset disponível (demo-dataset.md)

**O que falta:**
- Nenhum material de treinamento para usuários finais (guia, vídeo, manual)
- Treinamento presencial/remoto não realizado com nenhum profissional
- Perfis ACS e Recepção sem documentação de uso
- Sem módulo de onboarding no produto (tooltip, walkthrough)

**Esta é a categoria mais fraca. Risco alto de baixa adoção.**

**Pontuação: 4/10**

---

### 5. Suporte (6/10)

**O que existe:**
- Support runbook documentado (este sprint) ✅
- War room plan documentado (este sprint) ✅
- Canal de suporte definido (lgpd@vitras.com.br)
- SLA definido no runbook

**O que falta:**
- Canal de suporte não testado (nenhum ticket real processado)
- Não há separação entre suporte LGPD e suporte técnico
- Sem ferramenta de ticketing — tudo por e-mail
- SLA não comunicado formalmente ao município ainda

**Pontuação: 6/10**

---

### 6. Homologação PEC (6/10)

**O que existe:**
- Documentação completa M-05A: checklist, evidence template, field mapping, scripts de validação, risk register, go-no-go runbook ✅
- Test data package com 7 cenários ✅
- CDS Export testado em ambiente interno (A-04 PASS)

**O que falta:**
- Zero sessões de homologação real com município PEC >= 5.4.36
- cds-export.js ausente do git — impossível auditar código atual
- Nenhum município parceiro confirmado com PEC correto
- Scripts de validação não executados em condições reais

**Pontuação: 6/10**

---

### 7. Governança (7/10)

**O que existe:**
- ADRs documentados
- Sprint retrospectivas documentadas
- Risk registers atualizados
- Documentação M-05A e M-05B criada
- LGPD governance em andamento

**O que falta:**
- DPA não assinado
- RIPD incompleto
- Sem contrato formal de piloto com município
- Sem SLA formal acordado por escrito

**Pontuação: 7/10**

---

## Score Final

| Categoria | Peso | Score | Ponderado |
|-----------|------|-------|-----------|
| Produto | 25% | 7 | 1.75 |
| Operação | 20% | 6 | 1.20 |
| LGPD | 20% | 7 | 1.40 |
| Treinamento | 15% | 4 | 0.60 |
| Suporte | 5% | 6 | 0.30 |
| Homologação PEC | 10% | 6 | 0.60 |
| Governança | 5% | 7 | 0.35 |
| **TOTAL** | **100%** | | **6.2 / 10** |

---

## Veredicto

### ⚠️ GO WITH RISKS

**Score: 6.2/10**

O VITRAS APS tem os alicerces técnicos corretos para o piloto. RBAC implementado, auditoria funcional, fluxos clínicos presentes, LGPD com blocos fundamentais no lugar.

**Mas ainda não está pronto para um piloto não supervisionado.**

---

## Itens Bloqueantes Antes do Go-Live

Estes itens devem ser resolvidos **antes** de ativar o primeiro município:

| # | Item | Responsável | Prazo sugerido |
|---|------|-------------|---------------|
| B-01 | Restaurar cds-export.js + households.js ao git | Dev | 1 dia |
| B-02 | Criar material de treinamento mínimo por perfil | Produto | 3–5 dias |
| B-03 | Realizar treinamento com pelo menos 1 pessoa por perfil | Operações | Dia do go-live |
| B-04 | Confirmar capabilities no bootstrap de usuários | Dev + Produto | 1 dia |
| B-05 | Verificar e corrigir CNPJ na política de privacidade | Jurídico | 1 dia |
| B-06 | DPA assinado com município | Jurídico + Gestão | Antes do go-live |

---

## Itens Go With Risk (Não Bloqueantes)

| # | Item | Monitorar |
|---|------|-----------|
| G-01 | Deploy zip vs. git — dessincronização | Sim — resolver pós-piloto |
| G-02 | Validação CNS frontend | Orientar no treinamento |
| G-03 | nursing_tech vs. ChartPage | Documentar limitação |
| G-04 | Service worker em campo | Testar no Dia 0 |
| G-05 | Homologação PEC ainda não realizada | Gate obrigatório até Dia 10 |

---

## O Que Pode Elevar o Score

| Ação | Ganho estimado |
|------|---------------|
| Restaurar git (B-01) | +0.5 Produto, +0.5 Operação |
| Material de treinamento (B-02/B-03) | +2.0 Treinamento |
| DPA + RIPD (B-06) | +0.5 LGPD, +0.5 Governança |
| Homologação PEC real | +1.0 Homologação |
| CI/CD básico | +0.5 Operação |

**Score projetado após B-01 a B-06:** ~7.5/10 → **GO**

---

*VITRAS APS — docs/pilot/readiness-score.md*
