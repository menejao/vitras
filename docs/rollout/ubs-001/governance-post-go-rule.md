# Regra de Governança Pós-GO — Plataforma VITRAS

**Emitido por:** vitras-delivery-governor  
**Data:** 2026-06-10  
**Status:** ATIVO — vigente a partir desta data  
**Autoridade:** Este documento é a lei do projeto até a conclusão do onboarding da primeira UBS real.

---

## Seção 1 — Estado Oficial

| Campo | Valor |
|-------|-------|
| Plataforma VITRAS | **GO** |
| Baseline oficial | **v1.0-pilot-governed** |
| Commit | **d20add9** |
| Tag | **v1.0-pilot-governed** (anotada, pushada) |
| DR Drill | **PASS** — RTO=100min 35seg, RPO=5min 12seg (2026-06-09) |
| Smoke Test | **44/44 PASS** (2026-06-10) |
| Framework LGPD | **GO** |
| Framework Jurídico | **GO** |
| Framework Onboarding | **GO** |
| Implantação UBS | **AGUARDANDO UBS REAL** |
| Evidência | `final-readiness-report.md` — 2026-06-10 |

**O estado acima está congelado. Nenhuma mudança altera este estado sem processo formal (Seção 5).**

---

## Seção 2 — Regra de Congelamento

**Toda mudança após este ponto exige classificação obrigatória antes de ser executada.**

As classes permitidas são:

| Classe | Descrição |
|--------|-----------|
| `CRITICAL-FIX` | Correção de falha de segurança crítica ou indisponibilidade total |
| `UBS-ONBOARDING` | Ajuste diretamente exigido por UBS real durante seu onboarding |
| `LEGAL-ADJUSTMENT` | Adequação jurídica ao instrumento com a Prefeitura ou à LGPD |
| `POST-GO` | Melhorias, features ou arquitetura para depois do piloto UBS #1 |

**Mudança sem classificação = rejeitada pelo governor.**

Mudanças classificadas como `POST-GO` são registradas em backlog e NÃO executadas antes de D+14 da primeira UBS.

---

## Seção 3 — Mudanças Permitidas Antes da Primeira UBS

Somente as mudanças abaixo são autorizadas a partir desta data:

1. **Correções críticas de segurança** — vulnerabilidade com vetor ativo ou risco de exposição de dados de pacientes
2. **Correções críticas de indisponibilidade** — falha que tornaria o sistema inacessível para UBS em operação
3. **Ajustes exigidos por UBS real** — configurações, env vars, ou comportamentos que a UBS real exige para operar
4. **Substituição de placeholders** — `[..._PENDENTE]` → dados reais de Vitras ou da Prefeitura contratante
5. **Adequações jurídicas** — ajustes no `instrumento-juridico-template.md` ou demais templates LGPD exigidos pelo jurídico da Prefeitura
6. **Ajustes de onboarding** — correções em documentação, checklists, ou procedimentos operacionais **sem alterar arquitetura**

---

## Seção 4 — Mudanças Proibidas Antes da Primeira UBS

As seguintes mudanças são **bloqueadas** enquanto a primeira UBS não completar D+14:

| Proibição | Motivo |
|-----------|--------|
| Refactors amplos | Risco de regressão em baseline auditada |
| Novas features | Fora de escopo do piloto UBS #1 |
| Multi-UBS | Gate posterior — exige D+14 PASS + RDS upgrade |
| Multi-município | Sprint 5+ |
| `municipalityId` | Sprint 5+ |
| `unitId` | Sprint 5+ |
| Cross-UBS | Sprint 5+ |
| Alteração de arquitetura | Qualquer mudança estrutural = POST-GO |
| Nova sprint técnica | Nenhuma sprint técnica abre antes de D+14 |
| Backlog futuro | Registrar; não executar |
| Mudança de baseline sem nova auditoria | Tag nova exige smoke PASS + governor PASS + QA PASS |

**Se alguém propuser uma dessas mudanças antes de D+14: governor emite NO-GO automático.**

---

## Seção 5 — Processo para Exceções

Toda mudança classificada como `CRITICAL-FIX` ou qualquer exceção ao Seção 4 deve seguir este fluxo:

```
1. Governor (vitras-delivery-governor)
   → Avaliar se mudança é CRITICAL-FIX ou pode aguardar POST-GO
   → Se CRITICAL-FIX: autorizar; se não: bloquear

2. QA Read-Only (vitras-qa-senior)
   → Auditar escopo exato do patch proposto
   → Confirmar que patch não abre nova frente

3. Tech Lead (vitras-tech-lead)
   → Executar SOMENTE se patch autorizado pelo governor
   → Patch mínimo — sem scope creep

4. QA Final (vitras-qa-senior)
   → Reauditoria pós-patch
   → Smoke se código afetado

5. Atualizar final-readiness-report.md
   → Se patch afetar readiness: atualizar evidência
   → Se nova tag necessária: nova auditoria completa
```

**Patch sem seguir este fluxo = não entra em produção.**

---

## Seção 6 — Track UBS

**Próxima fase oficial:** `onboarding-ubs-master-checklist.md` — Gate 0

Gate 0 exige:
- Seleção de UBS real (nome, município, CNES)
- Instrumento jurídico assinado Vitras ↔ Prefeitura
- Secretaria de Saúde ciente da implantação

Os itens abaixo **NÃO são bloqueadores da plataforma**. São eventos obrigatórios da implantação UBS real, gerenciados via `onboarding-ubs-master-checklist.md`:

| Item | Gate |
|------|------|
| `contatos.md` com dados reais | Gate 3 — T-7 |
| DPO real designado pela Prefeitura | Gate 2 — T-14 |
| CRM real dos profissionais | Gate 3 — T-7 |
| CNPJ real da Vitras | Gate 0 — pré-onboarding |
| Assinaturas reais no instrumento jurídico | Gate 0 — pré-onboarding |
| RIPD assinado pelo controlador | Gate 2 — T-14 |
| Política de privacidade publicada na UBS | Gate 2 — T-14 |
| AWS DPA aceito | Gate 2 — T-14 |

**Nenhum desses itens reabre a fase de readiness da plataforma.**

---

## Seção 7 — Veredicto

```
PLATAFORMA VITRAS:       GO CONGELADO

BASELINE:                v1.0-pilot-governed (d20add9)

PRÓXIMA FASE:            UBS ONBOARDING
                         → onboarding-ubs-master-checklist.md, Gate 0

SPRINT TÉCNICA:          NÃO AUTORIZADA antes de D+14 UBS #1

MUDANÇAS AUTORIZADAS:    CRITICAL-FIX | UBS-ONBOARDING | LEGAL-ADJUSTMENT somente

ROLLBACK:                eb deploy --version v1.0-pilot-governed
                         (sintaxe documentada em final-go-live-checklist.md)
```

---

## Referências

| Documento | Caminho |
|-----------|---------|
| Evidência de readiness | `docs/rollout/ubs-001/final-readiness-report.md` |
| Checklist de onboarding | `docs/rollout/ubs-001/onboarding-ubs-master-checklist.md` |
| Checklist go-live D-0 | `docs/rollout/ubs-001/final-go-live-checklist.md` |
| DR Drill PASS | `docs/rollout/ubs-001/dr-drill-final-report.md` |
| Smoke 44/44 PASS | `docs/rollout/ubs-001/staging-smoke-final-report.md` |
| Estado consolidado | `docs/rollout/ubs-001/go-live-status-consolidated.md` |

---

*Emitido pelo vitras-delivery-governor — 2026-06-10*  
*Vigente até: conclusão de D+14 UBS #1 + assinatura de `d14-report.md`*  
*Não revogar sem nova auditoria completa de plataforma*
