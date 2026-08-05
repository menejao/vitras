# VITRAS — Checklist de Prontidão para Piloto

**Sprint:** VITRAS-PILOT-READINESS-01  
**Data:** 2026-08-05  
**Classificação:** CONDITIONAL PILOT READY

---

## Pré-requisitos

- [ ] Instrumento jurídico assinado (Lei 14.133/2021 ou termo de cooperação)
- [ ] DPO designado pela Prefeitura (LGPD Art. 41)
- [ ] RIPD elaborado e assinado (LGPD Art. 38)
- [ ] Política de privacidade publicada na recepção (LGPD Art. 9)
- [ ] DPA com Render + Neon + Vercel confirmados (LGPD Art. 37-39)
- [ ] Conta Render, Neon, Vercel com acesso confirmado
- [ ] MUNICIPALITY_ID (código IBGE 7 dígitos) identificado

---

## Infra

- [ ] Neon: projeto criado, PITR ativado, connection string anotada
- [ ] Render: serviço `vitras-backend` implantado com todas as variáveis do `render.yaml`
- [ ] Vercel: `vitras-frontend` implantado com `VITE_API_URL` apontando para Render
- [ ] `FRONTEND_ORIGINS` no Render aponta para URL exata do Vercel
- [ ] `RUN_MIGRATIONS=true` no primeiro deploy, depois mudar para `false`

---

## Bootstrap

- [ ] `GET /health` retorna 200 com `status: "healthy"`
- [ ] `GET /readyz` retorna `{ ok: true, ready: true }`
- [ ] `bootstrap-first-admin.mjs` executado com `DATABASE_URL` do Neon
- [ ] Senha do `break_glass_admin` registrada e comunicada ao responsável técnico
- [ ] `break_glass_admin` consegue fazer login e trocar senha obrigatória
- [ ] `POST /platform/units` cria UBS com CNES válido (7 dígitos)
- [ ] `POST /platform/units/:id/initial-manager` cria gestor com senha temporária
- [ ] Gestor consegue fazer login e trocar senha obrigatória
- [ ] `POST /platform/units/:id/teams` cria equipe
- [ ] Gestor vê apenas pacientes da sua UBS (lista vazia = correto)

---

## Configuração da UBS

- [ ] UBS tem: nome, CNES, endereço completo, telefone, município, uf
- [ ] Gestor associado à UBS com `role: gestor`
- [ ] Pelo menos 1 equipe criada e associada à UBS
- [ ] `GET /platform/units` lista a UBS criada
- [ ] Audit log registra criação da UBS (`unit_bootstrap` ou `PLATFORM_UNIT_CREATED`)

---

## Profissionais

- [ ] Gestor criado via `POST /platform/units/:id/initial-manager`
- [ ] Médico/Enfermeiro: auto-registro via `POST /auth/register` (roles válidos em prod) ou criação pela plataforma
- [ ] ACS: cadastrado e associado à equipe
- [ ] Recepção: cadastrada via auto-registro (`receptionist` é role pública)
- [ ] Cada profissional consegue fazer login
- [ ] Cada profissional vê apenas recursos da sua UBS/equipe

---

## Operação Clínica (validar no frontend)

- [ ] Recepção consegue buscar e cadastrar paciente
- [ ] Agendamento: criar, visualizar, cancelar
- [ ] Consulta: registrar atendimento
- [ ] Exame: solicitar, consultar, cancelar
- [ ] Exportação CDS: `GET /export/cds/individual/:id` retorna dados

---

## Multi-UBS

- [ ] Segunda UBS criada com `POST /platform/units`
- [ ] Usuário de UBS-A não vê pacientes de UBS-B
- [ ] `GET /patients` da UBS-A retorna apenas pacientes da UBS-A
- [ ] Troca de UBS via `POST /auth/unit-switch` funciona

---

## Segurança

- [ ] `GET /patients` sem token retorna 401
- [ ] `support_admin` bloqueado de rotas clínicas (retorna 403)
- [ ] Break glass: ativação requer reason, TTL 15min, audit completo
- [ ] `GET /health` não expõe CPF/CNS/JWT_SECRET/DATA_ENCRYPTION_KEY

---

## Observabilidade

- [ ] Todo request tem `X-Request-Id` e `X-Correlation-Id` no response
- [ ] Logs Render mostram `http.request.completed` com userId, role, activeUnitId
- [ ] `/health` tem `version` e `uptimeSeconds`
- [ ] `/readyz` tem `subsystems.database`

---

## LGPD

- [ ] CPF/CNS armazenados criptografados (prefixo `enc1:` no banco)
- [ ] Campos sensíveis não aparecem em logs (testar com `LOG_FORMAT=json`)
- [ ] Audit chain íntegra: `GET /admin/audit/integrity`
- [ ] Procedimento de incidente documentado: `docs/lgpd/procedimento-incidente-lgpd.md`

---

## Smoke Final

```bash
# 1. Health
curl https://<render-url>/health

# 2. Readiness
curl https://<render-url>/readyz

# 3. Login gestor
curl -X POST https://<render-url>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<gestor>","password":"<senha>"}'

# 4. Isolamento (lista deve ser vazia ou só da UBS)
curl https://<render-url>/patients \
  -H "Authorization: Bearer <token>"

# 5. Paciente sem token
curl https://<render-url>/patients
# Esperado: 401
```

---

## Rollback

Ver: `docs/rollout/ubs-001/rollback-plan.md`

**Critério de rollback imediato:**
- `/readyz` não retorna 200 em 15 min após deploy
- Cross-tenant data leak detectado
- CPF/CNS exposto em resposta API

---

## Contatos de Emergência

| Papel | Contato |
|-------|---------|
| Tech Lead VITRAS | João Pedro — joaoomenegucci@gmail.com |
| DPO Municipal | [a definir pela Prefeitura] |
| Suporte Render | dashboard.render.com |
| Suporte Neon | console.neon.tech |
| ANPD (incidente LGPD) | https://www.gov.br/anpd — prazo: 72h |

---

## Evidências Obrigatórias Antes do Go-Live

| # | Evidência | Responsável |
|---|-----------|-------------|
| 1 | `GET /readyz` retorna 200 | Tech Lead |
| 2 | Login do gestor funciona | Tech Lead |
| 3 | Audit log registra criação da UBS | Tech Lead |
| 4 | Isolamento multi-UBS confirmado | Tech Lead |
| 5 | Instrumento jurídico assinado | Jurídico |
| 6 | DPO designado | Prefeitura |
| 7 | RIPD assinado | DPO |

Todos os 7 itens devem estar registrados antes do primeiro paciente real.
