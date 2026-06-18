# Checklist LGPD GREEN — VITRAS APS

**Versão:** 1.0-draft  
**Data:** 2026-06-18  
**Classificação:** Interno — Operacional  
**Owner:** DPO  
**Status atual:** ⚠️ AMARELO

---

## Critério de VERDE

Todos os gates abaixo devem estar em status `PASS` com evidência documentada antes de declarar LGPD GREEN para o piloto.

---

| Gate | Descrição | Status | Evidência | Responsável |
|------|-----------|--------|-----------|-------------|
| **LGPD-01** | DPO formalmente designado | ❌ PENDENTE | Ato de designação assinado (03-dpo-designation-template.md preenchido + assinado) | CEO / Jurídico |
| **LGPD-02** | Política de Privacidade publicada em URL pública | ❌ PENDENTE | URL acessível + data de vigência declarada | DPO + Dev |
| **LGPD-03** | RIPD v1 aprovado pelo DPO e CEO | ❌ PENDENTE | 04-ripd-v1.md assinado | DPO + CEO |
| **LGPD-04** | Inventário de Tratamento (ROPA) aprovado | ❌ PENDENTE | 05-ropa-inventario-tratamento.md assinado | DPO |
| **LGPD-05** | DPA assinado com cada Controlador do piloto | ❌ PENDENTE | 06-dpa-template-controlador-operador.md assinado por ambas as partes | CEO / Jurídico |
| **LGPD-06** | Runbook de Incidentes testado (tabletop ou dry-run) | ❌ PENDENTE | Registro de teste em 07-incident-response-runbook.md (seção 12) | DPO + Tech Lead |
| **LGPD-07** | Processo de Direitos do Titular operacional com canal ativo | ❌ PENDENTE | E-mail DPO respondendo + SOP documentado (08-data-subject-rights-process.md) | DPO |
| **LGPD-08** | Política de Retenção aprovada | ❌ PENDENTE | 09-retention-and-deletion-policy.md assinada | DPO + Tech Lead |
| **LGPD-09** | Suboperadores declarados ou "nenhum declarado" | ❌ PENDENTE | 10-subprocessors-register.md com fornecedores confirmados ou declaração de ausência | DPO + Tech Lead |
| **LGPD-10** | Controles técnicos de segurança documentados e evidenciados | ✅ PASS | Audit chain SHA-256, AES-256-GCM em CPF/CNS/NIS, RBAC, JWT, redaction em logs — implementados e auditados | Tech Lead |
| **LGPD-11** | Auditabilidade — cadeia de auditoria imutável operacional | ✅ PASS | Audit chain com hashVersion v2, SHA-256 encadeado, export funcionando | Tech Lead |
| **LGPD-12** | Nome Social / Minimização de dano — controle operacional e testado | ✅ PASS | Nome civil oculto em todas as interfaces operacionais; nome social como identidade; regressão testada | Tech Lead |
| **LGPD-13** | CDS Export Governance — IDL conformante, auditado, capability gate ativo | ✅ PASS | A-04 PASS (76/76), capability `cds.export` restrito, log de exportação com fichaUuid/exportedBy, PEC ≥ 5.4.36 gate documentado | Tech Lead + DPO |

---

## Resumo de Status

| Status | Quantidade |
|--------|-----------|
| ✅ PASS | 4 |
| ❌ PENDENTE | 9 |
| ⚠️ PARCIAL | 0 |

**Bloqueadores para VERDE:**
1. **LGPD-01 (DPO)** — nenhum documento funciona sem DPO designado
2. **LGPD-05 (DPA)** — obrigatório antes de qualquer piloto com dados reais

**Não bloqueadores (documentais, completáveis em 1–2 semanas):**
- LGPD-02 a LGPD-04, LGPD-06 a LGPD-09

---

## Histórico de Atualizações

| Data | Versão | Evento | Autor |
|------|--------|--------|-------|
| 2026-06-18 | 1.0-draft | Criação inicial | DPO (TODO_USER) |
| TODO_USER | 1.1 | Preencher após designação do DPO | DPO |
| TODO_USER | 1.2 | Preencher após assinatura do DPA piloto | CEO + DPO |
| TODO_USER | 2.0 | Declaração LGPD GREEN (todos PASS) | DPO + CEO |

---

## Declaração LGPD GREEN

Quando todos os gates estiverem em PASS:

```
VITRAS APS — LGPD GREEN declarado em: ___/___/______

DPO: ___________________________
CEO: ___________________________
```

---

*VITRAS APS · Checklist LGPD GREEN v1.0-draft · 2026-06-18*
