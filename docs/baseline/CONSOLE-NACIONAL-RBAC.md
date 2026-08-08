# Console Nacional — RBAC v1.0

**Freeze:** 2026-08-08

---

## Role autorizado

Apenas `support_admin` acessa endpoints `/platform/*` do Console Nacional.

Nenhum role clínico (`doctor`, `nurse`, `acs`, `gestor`, `recepcao`) tem acesso.

---

## Capabilities do support_admin

```
platform.unit.create       — criar UBS, municípios, deployments, releases, CIs, etc.
platform.unit.read         — ler qualquer entidade do Console
platform.unit.update       — atualizar/avançar estado de qualquer entidade
platform.unit.deactivate   — desativar UBS (não usado diretamente nos ERP 7-10)
platform.team.create       — criar equipes
platform.initial_manager.create  — criar gestor inicial
platform.password.reset    — reset de senha
platform.audit.read        — ler log de auditoria operacional
platform.health.read       — ler health check (/platform/health)
platform.citizen_portal.read    — portal do cidadão (leitura)
platform.citizen_portal.update  — portal do cidadão (escrita)
```

---

## Mapeamento capability → operações ERP

| Capability | Operações |
|-----------|-----------|
| platform.unit.read | GET em todos os módulos ERP |
| platform.unit.create | POST em todos os módulos ERP |
| platform.unit.update | PATCH/PUT/DELETE em todos os módulos ERP |
| platform.health.read | GET /platform/health |
| platform.audit.read | GET /platform/units/:id/audit-log |

---

## Garantias imutáveis

1. `requireAuth` é middleware global em `app.js:60` — todas as rotas autenticadas.
2. `hasCapability(req.user, "platform.unit.read")` em cada handler — sem bypass.
3. 401 retornado para token ausente/inválido.
4. 403 retornado para role sem a capability.
5. Nenhum endpoint `/platform/*` exposto sem RBAC check interno.
6. RBAC clínico (`patients.read.scoped`, `audit.read`, etc.) não é modificado por nenhum sprint ERP.
