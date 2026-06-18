# LGPD Readiness Assessment — VITRAS APS

**Versão:** 1.0-draft  
**Data:** 2026-06-18  
**Classificação:** Interno — Confidencial  
**Responsável:** TODO_USER: nome do DPO/Compliance Officer

---

## 1. Escopo

VITRAS APS — plataforma GovTech para Atenção Primária à Saúde (APS).  
Dados tratados em nome de Municípios/Secretarias de Saúde/UBS (Controladores).  
VITRAS atua como **Operador** na quase totalidade dos tratamentos.

---

## 2. Status Atual: AMARELO

```
VERMELHO → AMARELO → [ VERDE ]
```

Controles técnicos estão maduros. Lacunas são documentais e processuais.

---

## 3. Controles Técnicos Existentes

| Controle | Mecanismo | Status |
|---------|-----------|--------|
| Autenticação | JWT com expiração | IMPLEMENTADO |
| Autorização | RBAC por perfil (acs, nurse_manager, doctor, gestor, break_glass_admin) | IMPLEMENTADO |
| Capability gate CDS | `cds.export` restrito a gestor + break_glass_admin | IMPLEMENTADO |
| Criptografia em trânsito | HTTPS/TLS em todas as rotas | IMPLEMENTADO |
| Criptografia em repouso | AES-256-GCM nos campos sensíveis (CPF, CNS, cnsResponsavel, NIS) | IMPLEMENTADO |
| Audit chain | SHA-256 encadeado (hashVersion v2), imutável, com hash anterior | IMPLEMENTADO |
| Redaction de dados sensíveis | `SPECIAL_CATEGORY_FIELDS` redactados em audit details | IMPLEMENTADO |
| Nome social como identidade operacional | Nome civil oculto em superfícies operacionais | IMPLEMENTADO |
| Break-glass | Acesso emergencial com log forçado, restrito a break_glass_admin | IMPLEMENTADO |
| Read-only outage mode | Modo de emergência sem escrita | IMPLEMENTADO |
| Logs de exportação CDS | `cds.export.*` auditados com fichaUuid, exportedBy, recordDate | IMPLEMENTADO |
| Minimização de dados no audit | CID/CIAP/HIV/sífilis não expostos em `details.before/after` | IMPLEMENTADO |
| Isolamento multi-tenant | Workspace paciente isolado por unidade | IMPLEMENTADO |

---

## 4. Lacunas Identificadas

| ID | Lacuna | Criticidade | Ação requerida |
|----|--------|-------------|----------------|
| G-01 | DPO não formalmente designado | ALTA | Ato de designação + registro |
| G-02 | Política de privacidade não publicada | ALTA | Publicar URL pública |
| G-03 | RIPD não elaborado | ALTA | Elaborar e aprovar v1 |
| G-04 | Inventário de tratamento (ROPA) ausente | ALTA | Elaborar e manter |
| G-05 | DPA (Data Processing Agreement) com municípios ausente | ALTA | Template + assinatura antes do piloto |
| G-06 | Runbook de incidente não formalizado | MÉDIA | Elaborar e testar |
| G-07 | Processo de direitos do titular não documentado | MÉDIA | Elaborar |
| G-08 | Política de retenção e descarte ausente | MÉDIA | Elaborar |
| G-09 | Registro de suboperadores ausente | MÉDIA | Confirmar e listar |
| G-10 | Razão social, CNPJ, endereço não confirmados para documentos públicos | OPERACIONAL | TODO_USER |

---

## 5. Plano de Fechamento

| Gate | Prazo sugerido | Responsável |
|------|---------------|-------------|
| G-01 DPO designado | Antes do piloto (semana 0) | CEO / Jurídico |
| G-05 DPA assinado com município piloto | Antes do piloto (semana 0) | CEO / Jurídico |
| G-02 Política publicada | Semana 1 do piloto | DPO + Marketing |
| G-03 RIPD aprovado internamente | Semana 1 do piloto | DPO |
| G-04 Inventário aprovado | Semana 1 do piloto | DPO |
| G-06 Runbook testado | Semana 2 do piloto | Tech Lead + DPO |
| G-07 Processo direitos documentado | Semana 2 do piloto | DPO |
| G-08 Política retenção publicada | Semana 2 do piloto | DPO |
| G-09 Suboperadores confirmados | Semana 1 do piloto | Tech Lead + DPO |

---

## 6. Matriz de Status

| Domínio | Vermelho | Amarelo | Verde |
|---------|----------|---------|-------|
| Segurança técnica | — | — | ✅ |
| Minimização de dados | — | — | ✅ |
| Criptografia | — | — | ✅ |
| Auditabilidade | — | — | ✅ |
| Nome social / não-discriminação | — | — | ✅ |
| DPO designado | — | ⚠️ pendente | — |
| Política de privacidade | — | ⚠️ draft | — |
| RIPD | — | ⚠️ draft | — |
| Inventário (ROPA) | — | ⚠️ draft | — |
| DPA com controlador | ❌ ausente | — | — |
| Runbook incidentes | — | ⚠️ draft | — |
| Direitos do titular | — | ⚠️ draft | — |
| Retenção e descarte | — | ⚠️ draft | — |
| Suboperadores | — | ⚠️ pendente | — |

---

## 7. Critérios Objetivos para Declarar LGPD GREEN

Para declarar status VERDE, todos os itens abaixo devem estar cumpridos e evidenciados:

| # | Critério | Evidência aceita |
|---|---------|-----------------|
| 1 | DPO designado | Ato de designação assinado + e-mail funcional respondendo |
| 2 | Política de privacidade publicada | URL pública acessível + data de vigência |
| 3 | RIPD v1 aprovado | Documento assinado pelo DPO e CEO |
| 4 | Inventário de tratamento aprovado | Documento assinado pelo DPO |
| 5 | DPA assinado com cada município piloto | Contrato assinado por ambas as partes |
| 6 | Runbook de incidente testado | Registro de dry-run ou teste tabletop |
| 7 | Processo de direitos do titular operacional | SOP documentado + canal de recebimento ativo |
| 8 | Política de retenção aprovada | Documento assinado + configuração técnica alinhada |
| 9 | Suboperadores declarados ou "nenhum declarado" | Registro atualizado assinado pelo DPO |
| 10 | Evidência técnica de controles | Relatório de revisão ou checklist 11-lgpd-green-checklist.md PASS |

---

## 8. Declaração de Status

**Status atual:** AMARELO  
**Bloqueador para VERDE:** G-01 (DPO), G-05 (DPA município piloto)  
**LGPD GREEN possível:** Sim — bloqueadores são documentais, não técnicos  
**Estimativa para VERDE:** 2–3 semanas após decisão de pilotar

---

*VITRAS APS · LGPD Readiness v1.0-draft · 2026-06-18*
