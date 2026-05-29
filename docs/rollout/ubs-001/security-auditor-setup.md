# security_auditor — Criação de Conta — UBS #1

**Data de criação:** 2026-05-29
**Autor:** Tech Lead Vitras
**Versão:** v1.0
**Criticidade:** PRÉ-T-0 — antes do go-live
**Referência:** `docs/rollout/ubs-001/go-final-readiness-report.md` — PNB-05
**Script:** `backend/scripts/provision-remote-enterprise-user.mjs`

---

## Por que este procedimento existe

O `security_auditor` é a conta responsável por:
- Revisar todas as ações do `break_glass_admin` dentro de 24h após o uso
- Exportar audit logs via `GET /audit-logs/export`
- Verificar integridade da cadeia de audit via `GET /audit-logs/integrity`
- Acessar relatório de cross-team access via `GET /audit-logs/reports/cross-team-access`

Sem essa conta, os acessos do break_glass ficam sem revisor independente — risco LGPD.

---

## Pré-requisitos

- [ ] Acesso à instância de staging (`vitras-drill-sa-3`)
- [ ] `DATABASE_URL` do ambiente staging disponível (em EB Console → Environment Properties)
- [ ] `DATA_ENCRYPTION_KEY` do staging disponível
- [ ] Senha para a conta security_auditor gerada e salva no vault **antes** de executar
- [ ] Node.js ≥ 18 instalado localmente

---

## Dados da conta a criar

| Campo | Valor |
|-------|-------|
| Email | `security.auditor@vitras.com.br` |
| Role | `security_auditor` |
| Name | `Auditor de Segurança Vitras` |
| TeamId | (deixar vazio — role global) |

> A conta security_auditor **não precisa de teamId** — acessa audit logs de todas as equipes da unidade.

---

## Passo 1 — Preparar ambiente

```powershell
# Navegar para o diretório do backend
cd C:\dev\vitras\backend

# Verificar que o script existe
Test-Path scripts\provision-remote-enterprise-user.mjs
# Esperado: True
```

---

## Passo 2 — Definir variáveis de ambiente (sem expor no histórico)

```powershell
# Variáveis obrigatórias — substituir pelos valores reais do EB Console
$env:DATABASE_URL = "<DATABASE_URL do staging — EB Console>"
$env:DATA_ENCRYPTION_KEY = "<DATA_ENCRYPTION_KEY do staging — EB Console>"
$env:PATIENT_LOOKUP_HASH_KEY = "<PATIENT_LOOKUP_HASH_KEY do staging>"
$env:NODE_ENV = "production"

# Variáveis do provisionamento — NÃO commitar a senha
$env:ALLOW_ENTERPRISE_REMOTE_PROVISIONING = "true"
$env:PROVISION_USER_EMAIL = "security.auditor@vitras.com.br"
$env:PROVISION_USER_NAME = "Auditor de Segurança Vitras"
$env:PROVISION_USER_ROLE = "security_auditor"
$env:PROVISION_USER_TEAM_ID = ""  # security_auditor não precisa de teamId
$env:PROVISION_REASON = "Criação de conta security_auditor pré-go-live UBS #1 - 2026-05-29"

# Senha — definir sem aparecer em log
$env:PROVISION_USER_PASSWORD = "<senha_forte_do_vault>"
```

---

## Passo 3 — Executar o script

```powershell
node scripts\provision-remote-enterprise-user.mjs
```

**Saída esperada:**
```json
{
  "ok": true,
  "mode": "created",
  "email": "security.auditor@vitras.com.br",
  "role": "security_auditor",
  "teamId": ""
}
```

Se `mode: "updated"`: conta já existia e foi atualizada (senha trocada).
Se `mode: "created"`: nova conta criada com sucesso.

Se erro `"ALLOW_ENTERPRISE_REMOTE_PROVISIONING"`: variável não foi setada.
Se erro `"DATABASE_URL"`: banco não acessível — verificar string de conexão.

---

## Passo 4 — Verificar criação via API

```powershell
# Login para obter token admin
$loginResponse = Invoke-RestMethod `
  -Method POST `
  -Uri "http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/auth/login" `
  -ContentType "application/json" `
  -Body (ConvertTo-Json @{
    email = "breakglass@vitras.com.br"
    password = "<senha_breakglass_do_vault>"
  })

$bgaToken = $loginResponse.token

# Verificar se security_auditor aparece na lista de usuários
$users = Invoke-RestMethod `
  -Method GET `
  -Uri "http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/users" `
  -Headers @{ Authorization = "Bearer $bgaToken" }

$auditor = $users | Where-Object { $_.email -eq "security.auditor@vitras.com.br" }
Write-Host "Auditor encontrado: role=$($auditor.role)"
# Esperado: role=security_auditor
```

---

## Passo 5 — Testar login da conta security_auditor

```powershell
$auditorLogin = Invoke-RestMethod `
  -Method POST `
  -Uri "http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/auth/login" `
  -ContentType "application/json" `
  -Body (ConvertTo-Json @{
    email = "security.auditor@vitras.com.br"
    password = $env:PROVISION_USER_PASSWORD
  })

$auditorToken = $auditorLogin.token
Write-Host "Login OK: role=$($auditorLogin.user.role)"
# Esperado: role=security_auditor
```

---

## Passo 6 — Verificar acesso a audit logs

```powershell
# security_auditor deve conseguir exportar audit logs
$auditExport = Invoke-RestMethod `
  -Method GET `
  -Uri "http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/audit-logs/export?limit=5" `
  -Headers @{ Authorization = "Bearer $auditorToken" }

Write-Host "Audit export OK: count=$($auditExport.items.Count)"
# Esperado: 200, array com itens

# Verificar integridade
$integrity = Invoke-RestMethod `
  -Method GET `
  -Uri "http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/audit-logs/integrity" `
  -Headers @{ Authorization = "Bearer $auditorToken" }

Write-Host "Integrity: status=$($integrity.status), checked=$($integrity.checked)"
# Esperado: status=ok
```

---

## Passo 7 — Limpar variáveis de ambiente

```powershell
Remove-Variable -Name ALLOW_ENTERPRISE_REMOTE_PROVISIONING -Scope Env -ErrorAction SilentlyContinue
Remove-Variable -Name PROVISION_USER_PASSWORD -Scope Env -ErrorAction SilentlyContinue
Remove-Variable -Name PROVISION_USER_EMAIL -Scope Env -ErrorAction SilentlyContinue
Remove-Variable -Name PROVISION_USER_ROLE -Scope Env -ErrorAction SilentlyContinue
Remove-Variable -Name PROVISION_REASON -Scope Env -ErrorAction SilentlyContinue
Write-Host "Variáveis de provisionamento removidas da sessão."
```

---

## Preencher em `contatos.md` após criação

Após criar a conta, preencher a Seção A de `contatos.md`:

```
| Security Auditor | [Nome da pessoa responsável por revisar break_glass] | [celular] | security.auditor@vitras.com.br | On-call (review D+1 após uso breakglass) |
```

---

## Critério de conclusão

- [x] Script retorna `"ok": true, "role": "security_auditor"`
- [x] Login com nova conta retorna `role=security_auditor`
- [x] `GET /audit-logs/export` retorna 200 com itens
- [x] `GET /audit-logs/integrity` retorna `status: ok`
- [x] Senha armazenada no vault
- [x] contatos.md atualizado com nome da pessoa designada
- [x] Variáveis de sessão limpas

---

## Registro de execução

```
Data de execução:       [PREENCHER]
Executado por:          João Pedro
Email criado:           security.auditor@vitras.com.br
Vault utilizado:        [PREENCHER]
Revisão audit logs:     [ ] CONFIRMADO
Login verificado:       [ ] CONFIRMADO
contatos.md atualizado: [ ] CONFIRMADO

Assinatura: _________________________ Data: __________
```

---

## Responsabilidades da conta após criação

| Situação | Ação do security_auditor |
|----------|--------------------------|
| Uso do break_glass_admin | Revisar audit logs em < 24h; registrar revisão |
| Suspeita de acesso indevido | Exportar logs + notificar DPO |
| Solicitação ANPD | Exportar cadeia de audit + verificar integridade |
| Saída do titular da conta | Trocar senha imediatamente via PNB-04-equivalente |

---

*Criado em: 2026-05-29 — Vitras Tech Lead*
*Referência: go-final-readiness-report.md §PNB-05; provision-remote-enterprise-user.mjs*
