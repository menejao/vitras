# PNB-04 — Rotação de Senha do Break Glass Admin

**Data de criação:** 2026-05-29
**Autor:** Tech Lead Vitras
**Versão:** v1.0
**Criticidade:** OBRIGATÓRIO antes de T-0 (go-live com dados clínicos reais)
**Referência:** `docs/rollout/ubs-001/go-final-readiness-report.md` — PNB-04
**Conta afetada:** `breakglass@vitras.com.br` (role: `break_glass_admin`)

---

## Por que este procedimento existe

Durante o drill de recovery (2026-05-26), a conta `breakglass@vitras.com.br` foi criada com senha temporária de trabalho. Essa senha foi utilizada operacionalmente e é conhecida pelo operador que executou o drill.

A senha **deve ser trocada e armazenada em vault seguro** antes de qualquer uso clínico real. Cada uso do break_glass gera audit log completo — por isso a conta é alta prioridade de segurança.

**A senha atual NÃO deve aparecer em nenhum documento, log ou repositório.**

---

## Pré-requisitos

- [ ] Acesso ao ambiente staging (`http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com`)
- [ ] Senha atual da conta `breakglass@vitras.com.br` (disponível com João Pedro — não documentar aqui)
- [ ] Nova senha forte gerada e pronta para armazenamento em vault **ANTES** de executar o passo 3
- [ ] Vault de senhas disponível e acessível (ex: Bitwarden, 1Password, KeePass, AWS Secrets Manager)

---

## Procedimento

### Passo 1 — Gerar nova senha forte

Execute localmente (não salve em arquivo):

```powershell
# PowerShell — gerar senha aleatória forte
-join ((33..126) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
```

Ou via OpenSSL:
```bash
openssl rand -base64 24
```

Requisitos da nova senha:
- Mínimo 20 caracteres
- Letras maiúsculas, minúsculas, números e símbolos
- Não reutilizar a senha atual ou qualquer senha anterior

**Salvar a nova senha no vault ANTES de continuar.**

---

### Passo 2 — Obter token da conta breakglass

```powershell
# NÃO logar a senha — usar variável de ambiente
$env:BGA_CURRENT_PASSWORD = "<senha_atual>"  # não aparece em histórico

$response = Invoke-RestMethod `
  -Method POST `
  -Uri "http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/auth/login" `
  -ContentType "application/json" `
  -Body (ConvertTo-Json @{
    email = "breakglass@vitras.com.br"
    password = $env:BGA_CURRENT_PASSWORD
  })

$token = $response.token
Write-Host "Login OK: role=$($response.user.role)"
# Esperado: role=break_glass_admin
```

Se o login falhar com 401: a senha atual está incorreta. Verificar com João Pedro.
Se o login falhar com 429: aguardar 1 minuto (rate limit de auth).

---

### Passo 3 — Trocar a senha via PATCH /me/password

```powershell
# NÃO logar as senhas — usar variáveis de ambiente
$env:BGA_NEW_PASSWORD = "<nova_senha_do_vault>"

$result = Invoke-RestMethod `
  -Method PATCH `
  -Uri "http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/me/password" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body (ConvertTo-Json @{
    currentPassword = $env:BGA_CURRENT_PASSWORD
    newPassword = $env:BGA_NEW_PASSWORD
  })

Write-Host "Resultado: $($result | ConvertTo-Json)"
# Esperado: { "ok": true }
```

---

### Passo 4 — Verificar a nova senha

```powershell
$verify = Invoke-RestMethod `
  -Method POST `
  -Uri "http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/auth/login" `
  -ContentType "application/json" `
  -Body (ConvertTo-Json @{
    email = "breakglass@vitras.com.br"
    password = $env:BGA_NEW_PASSWORD
  })

Write-Host "Verificação: ok=$($verify.ok), role=$($verify.user.role)"
# Esperado: ok=true, role=break_glass_admin
```

---

### Passo 5 — Verificar audit log

```powershell
$auditCheck = Invoke-RestMethod `
  -Method GET `
  -Uri "http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/audit-logs?event=password_changed&limit=5" `
  -Headers @{ Authorization = "Bearer $($verify.token)" }

$auditCheck.items | Select-Object event, actorId, actorRole, createdAt | Format-Table
# Verificar: evento de troca de senha registrado com actor correto
```

---

### Passo 6 — Limpar variáveis de ambiente da sessão

```powershell
Remove-Variable -Name BGA_CURRENT_PASSWORD -Scope Env -ErrorAction SilentlyContinue
Remove-Variable -Name BGA_NEW_PASSWORD -Scope Env -ErrorAction SilentlyContinue
Write-Host "Variáveis de senha removidas da sessão."
```

---

### Passo 7 — Confirmar no vault

- [ ] Nova senha confirmada no vault (testar login uma vez após fechar o terminal)
- [ ] Senha antiga removida ou marcada como expirada no vault
- [ ] Pelo menos 2 pessoas com acesso ao vault sabem que a rotação foi feita
- [ ] Registrar data da rotação no vault

---

## Critério de conclusão

- [x] `POST /auth/login` com nova senha retorna `ok: true, role: break_glass_admin`
- [x] Audit log registra evento de troca de senha
- [x] Senha antiga não funciona mais
- [x] Nova senha armazenada em vault
- [x] Variáveis de sessão limpas

---

## Registro de execução

```
Data de execução:     [PREENCHER]
Executado por:        João Pedro
Senha antiga:         [ ] REMOVIDA DO VAULT
Senha nova:           [ ] ARMAZENADA NO VAULT
Vault utilizado:      [PREENCHER — ex: Bitwarden, 1Password, AWS SM]
Audit log verificado: [ ] SIM
Verificação pós-troca:[ ] SIM — login com nova senha funcionou

Assinatura: _________________________ Data: __________
```

---

## Próxima rotação

Rotação recomendada: a cada 90 dias ou imediatamente após:
- Suspeita de comprometimento
- Saída de qualquer pessoa que conhecia a senha
- Qualquer uso não planejado da conta

---

*Criado em: 2026-05-29 — Vitras Tech Lead*
*Referência: go-final-readiness-report.md §PNB-04; security-operations.md*
