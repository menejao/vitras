# VITRAS — Instruções para Claude

## REGRA 1: GOV-01 é obrigatório antes de qualquer nova funcionalidade

Antes de implementar qualquer feature nova, sprint ou épica:

1. Ler `docs/governanca/06-gov-01-product-scope-governance.md`
2. Verificar se existe parecer GOV-01 com resultado GO ou GO WITH LIMITS
3. Se não existir: **não implementar**. Emitir o parecer primeiro.

Funcionalidades sem GOV-01 aprovado são rejeitadas independente do conteúdo técnico.

---

## REGRA 2: Não criar código sem problema operacional claro

Antes de escrever qualquer linha:

- Qual usuário real usa isso?
- Em que momento do dia usa?
- Como faz hoje sem o VITRAS?

Se não souber responder: **não implementar**.

---

## REGRA 3: Reusar antes de criar

Ordem de decisão técnica:

1. Reusar entidade/serviço existente
2. Adaptar com parâmetro ou filtro
3. Criar nova entidade (somente com justificativa forte)

Nova tabela ou coleção no DB: exige justificativa explícita no PR.

---

## REGRA 4: Não alterar CDS Export nem protocolo e-SUS

`backend/src/routes/cds-export.js` e o protocolo `.esus` são intocáveis sem aprovação explícita.

Qualquer alteração nesse caminho exige revisão de LGPD e auditoria.

---

## REGRA 5: Não quebrar RBAC, LGPD nem cadeia de auditoria

Toda nova rota deve:

- Respeitar `requireAuth` (já global em `app.js` linha 60)
- Usar `hasCapability` ou verificação explícita de role
- Não expor dados de pacientes a roles sem permissão
- Não registrar dados clínicos em logs de auditoria operacional

---

## REGRA 6: Mobile first para fluxos ACS

Qualquer UI que o ACS usa deve funcionar em 360–412px sem scroll horizontal.

Validar sempre: 360px, 390px, 412px.

---

## REGRA 7: Testes antes de PR

Toda nova funcionalidade backend deve ter testes de integração em `backend/test/`.

Toda nova lógica de negócio deve ter testes unitários.

Regressão APS-01C a APS-01F deve passar antes de qualquer commit.

---

## Status atual (junho 2026)

Sprints entregues:

- APS-01A a APS-01F: PASS
- PRR-01A (CDS Export): PASS
- SEC-01, AUD-01, SEC-API-01A–D: PASS
- ARCH-01, TECH-DEBT-01: PASS
- IAM-01 (A–E): PASS
- CONSOLE-01: PASS
- IMPLANT-01/01A: PASS
- HOMOLOG-01: PASS
- INTEGRATION-GOV-01A: PASS
- ARCH-DOC-03: PASS
- DOC-GOV-01 (Baseline v1.0): PASS
- BUG-CLINIC-01: DONE
- GOV-01: ATIVO
- CTRL-01: ATIVO

Próxima frente: Piloto Real UBS #1 — pré-requisitos pendentes (PEC real, treinamento, LGPD, smoke dados reais).

APS-02A: NO GO — aguarda piloto real + GOV-01 completo.

Ver: `docs/CTRL-01-product-control-map.md` (ponto único de verdade)

---

## Arquitetura resumida

- Backend: Node.js + Express, JSON file DB (`data/db.json`)
- Frontend: React + Vite
- Auth: JWT (token) + cookie (CSRF)
- DB collections relevantes: `patients`, `familyGroups`, `acsVisits`, `tasks`, `households`, `acsVisits`
- Score: `evaluateGroup()` em `backend/src/services/active-search.js`
- Produção: `getAcsMetrics()` etc em `backend/src/services/production-metrics.js`
- Docs de governança: `docs/governanca/`
- Roadmap: `docs/roadmap/README.md`
