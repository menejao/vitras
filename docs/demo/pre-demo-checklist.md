# VITRAS — Checklist Pré-Demo

> Executar antes de cada apresentação institucional.
> Classificar cada item: PASS / FAIL / N/A
> Não iniciar a apresentação com qualquer item FAIL não mitigado.

---

## AMBIENTE

| # | Item | Comando / URL | Esperado | Status |
|---|------|---------------|----------|--------|
| 1 | Backend online | `GET https://vitras-backend.onrender.com/health` | HTTP 200, `ok: true` | |
| 2 | Frontend online | Abrir URL demo no browser | Tela de login carrega | |
| 3 | Neon online | Verificado via `/health` (campo `postgres: ok`) | ok | |
| 4 | Health 200 | `GET /health` | `{"ok":true,"status":"ok"}` | |
| 5 | Readyz 200 | `GET /readyz` | `{"ready":true}` | |
| 6 | Versão correta | `GET /health` campo `version` | `1.1.0-rc.1` ou superior | |
| 7 | Seed correto | Verificar app_users count ≥ 57 no DB | ≥ 57 usuários demo | |
| 8 | Sem variável destrutiva | `DEMO_RESET_ALLOWED` não está em `true` no Render | variável ausente ou `false` | |
| 9 | DB_CACHE_TTL_MS | Verificar no Render dashboard | `5000` | |
| 10 | Migrations aplicadas | `GET /readyz` campo `migrations` | `ok` | |

---

## CONTAS

> Senha de todas as contas demo: **`Demo@2026!`** (manter fora da tela)
> Login: usar vitrasId numérico de 9 dígitos — nunca e-mail.

| # | vitrasId | Role | Nome | UBS | Status |
|---|----------|------|------|-----|--------|
| 11 | `100000001` | gestor | Dra. Clara Mendes | H + E + A | |
| 12 | `110000001` | gestor | Priscila Rocha | H + E + A | |
| 13 | `110000002` | receptionist | Eliane Costa | Horizonte | |
| 14 | `110000003` | doctor | Dr. Márcio Alves | H + E | |
| 15 | `110000004` | nurse_manager | Enf. Sílvia Nascimento | H + A | |
| 16 | `110000006` | acs | ACS Antônia Ferreira | Horizonte MA-01 | |
| 17 | `120000001` | gestor | Cássia Teixeira | Esperança | |
| 18 | `120000002` | receptionist | Paulo Sérgio | Esperança | |
| 19 | `120000003` | doctor | Dr. Leonardo Farias | Esperança | |
| 20 | `120000004` | nurse_manager | Enf. Natália Campos | Esperança | |
| 21 | `130000001` | gestor | André Borges | Águas | |
| 22 | `130000002` | receptionist | Estela Matos | Águas | |
| 23 | `130000003` | doctor | Dra. Simone Freitas | Águas | |
| 24 | `110000050` | doctor | Dra. Carla Pinto | Horizonte (única) | |
| 25 | `190000001` | support_admin | Suporte Vitras | Console Nacional | |
| 26 | Break Glass | break_glass_admin | (ID interno preservado) | Qualquer | |

---

## DADOS

| # | Item | Verificação | Esperado | Status |
|---|------|-------------|----------|--------|
| 27 | Paciente principal (Horizonte) | Buscar "Mariana Silva" em Horizonte | Mariana Silva Rocha aparece | |
| 28 | Paciente homônimo (Esperança) | Buscar "Mariana Silva" em Esperança | Mariana Silva Pereira — pessoa diferente | |
| 29 | Agenda Horizonte | Login 110000003, ver agenda | Consultas futuras listadas | |
| 30 | Fila hoje | Login 110000002, ver recepção | Entradas na fila | |
| 31 | Exame existente | Abrir paciente crônico em Horizonte | Exame listado | |
| 32 | Encaminhamento existente | Abrir paciente em Horizonte | Encaminhamento listado | |
| 33 | Memberships multi-UBS | Login 110000003 | `requiresUnitSelection: true`, 2 UBS | |
| 34 | Três UBS visíveis | Login 100000001 | 3 UBS no seletor | |

---

## APRESENTAÇÃO

| # | Item | Status |
|---|------|--------|
| 35 | Slides disponíveis (PDF e online) | |
| 36 | Roteiro impresso ou acessível offline | |
| 37 | Credenciais em papel separado — FORA da tela | |
| 38 | Browser limpo (sem histórico visível, sem abas sensíveis) | |
| 39 | Notificações do SO desligadas | |
| 40 | Zoom correto (browser 100% ou ajustado ao projetor) | |
| 41 | Todos os dados são sintéticos (nenhum paciente real) | |
| 42 | Plano B acessível (PDF, vídeo, slides offline) | |
| 43 | MFA do Break Glass disponível, se for demonstrado | |

---

## VALIDAÇÃO RBAC MÍNIMA (executar antes da demo)

| # | Role | Ação | Esperado | Status |
|---|------|------|----------|--------|
| 44 | gestor | Tentar abrir prontuário clínico | 403 | |
| 45 | receptionist | Tentar abrir prontuário clínico | 403 | |
| 46 | doctor | Abrir prontuário de paciente | Sucesso | |
| 47 | support_admin | Tentar acessar `/patients` | 403 | |
| 48 | multi-UBS (110000003) | Trocar UBS | Seletor aparece, dados mudam | |

---

## RESTAURAÇÃO RÁPIDA

Caso seja necessário restaurar entre apresentações:

```bash
# Backend — apenas limpeza de sessões (login fresh)
POST /auth/logout (revogar sessão aberta)

# Restauração completa (se dados foram alterados durante a demo):
DEMO_SEED_ALLOWED=true node --env-file=.env scripts/seed-demo-santa-aurora-v2.mjs
DEMO_SEED_ALLOWED=true node --env-file=.env scripts/seed-demo-parte3.mjs
```

Tempo estimado: **< 15 segundos** (idempotente).

---

_Versão: v1.1.0-rc.1 | Atualizado: 2026-08-05_
