# Console Nacional VITRAS — Baseline v1.0

**Data de congelamento:** 2026-08-08  
**Branch:** `claude/vitras-p0-blockers-497suw`  
**Commit HEAD:** `2f69a04`  
**Sprint de freeze:** FREEZE-01  

---

## Módulos congelados

| Módulo | Sprint | Testes | Status |
|--------|--------|--------|--------|
| Municípios | ERP-02 | platform-municipalities | PASS |
| Deployments | ERP-03 | platform-deployments | PASS |
| Licenciamento | ERP-04 | platform-licenses | PASS |
| Incidentes | ERP-05 | platform-incidents | PASS |
| Observabilidade | ERP-06 | platform-observability | PASS |
| Releases | ERP-07 | platform-releases (45) | PASS |
| Backup & Continuidade | ERP-08 | platform-backup (45) | PASS |
| Governança & Compliance | ERP-09 | platform-governance (55) | PASS |
| CMDB | ERP-10 | platform-cmdb (55) | PASS |

**Total testes ERP-07 a ERP-10:** 200/200 PASS  
**Total testes ERP-02 a ERP-06:** 151/151 PASS  
**Total acumulado:** 351/351 PASS  

---

## Auditoria de freeze (FREEZE-01)

| Verificação | Resultado |
|-------------|-----------|
| TODOs/FIXMEs em platform.js | ✅ Nenhum |
| TODOs em serviços ERP-07..10 | ✅ Nenhum |
| Rotas duplicadas (método+path) | ✅ Nenhum |
| Dados clínicos em serviços ERP | ✅ Nenhum |
| Capabilities órfãs | ✅ Nenhum |
| Acesso clínico pelo Console | ✅ Bloqueado |
| patientId / prontuário / cpf/cns em ERP | ✅ Ausentes |
| Circular deps CMDB (service-level) | ✅ BFS visit-set previne |
| Endpoints sem RBAC | ✅ 124 checks RBAC em 121 rotas |
| Build frontend | ✅ PASS (14.62s) |

---

## Invariantes de segurança (imutáveis)

1. `requireAuth` é global em `app.js` — toda rota autenticada por padrão.
2. Console Nacional exige `support_admin` com `platform.unit.*` capabilities.
3. Nenhum serviço ERP lê `patients`, `acsVisits`, `familyGroups`, `households`.
4. `cds-export.js` intocado.
5. RBAC clínico intocado.
6. Break Glass intocado.
7. Indicator Engine intocado.

---

## Próximos passos autorizados

- Integrações externas lendo endpoints `/platform/*` (somente leitura ou via token support_admin).
- Piloto real UBS #1 (gates jurídicos + treinamento + dados reais pendentes).
- APS-02A: NO GO até piloto real + GOV-01 completo.
