# Production Bootstrap Runbook — Primeira Instalação

## Quando usar
Deploy em produção/staging pela primeira vez. Banco vazio, nenhum usuário existe.

## Pré-requisitos
- EB environment rodando (app iniciado, /readyz retornando 200)
- DATABASE_URL, DATA_ENCRYPTION_KEY, PATIENT_LOOKUP_HASH_KEY configurados
- Acesso SSH ao servidor EB ou acesso ao EB CLI com `eb ssh`
- Senha forte gerada para o primeiro admin (use: `openssl rand -base64 24`)

## Passo 1: Gerar senha forte
```bash
openssl rand -base64 24
# Exemplo output: aBcDeFgHiJkLmNoPqRsTuVwX
# Salvar em gerenciador de senhas seguro antes de continuar
```

## Passo 2: Criar break_glass_admin
Execute no servidor EB (via `eb ssh` ou runner CI com acesso):

```bash
cd /var/app/current
ALLOW_ENTERPRISE_REMOTE_PROVISIONING=true \
PROVISION_USER_EMAIL="admin@sua-secretaria.gov.br" \
PROVISION_USER_PASSWORD="[senha-gerada-passo-1]" \
PROVISION_USER_NAME="Administrador VITRAS" \
PROVISION_USER_ROLE="break_glass_admin" \
PROVISION_REASON="Bootstrap producao — primeiro admin" \
node backend/scripts/provision-remote-enterprise-user.mjs
```

Resultado esperado:
```json
{ "ok": true, "mode": "created", "email": "admin@...", "role": "break_glass_admin" }
```

## Passo 3: Verificar criação no audit log
```bash
# Verificar via API que audit log foi criado
curl -s https://[seu-dominio]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sua-secretaria.gov.br","password":"[senha]"}' | jq .
# Deve retornar access_token
```

## Passo 4: Login e obter token
```bash
TOKEN=$(curl -s https://[seu-dominio]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sua-secretaria.gov.br","password":"[senha]"}' \
  | jq -r '.access_token')
echo "Token: ${TOKEN:0:30}..."
```

## Passo 5: Criar security_auditor (opcional mas recomendado)
```bash
ALLOW_ENTERPRISE_REMOTE_PROVISIONING=true \
PROVISION_USER_EMAIL="auditor@sua-secretaria.gov.br" \
PROVISION_USER_PASSWORD="[outra-senha-forte]" \
PROVISION_USER_NAME="Auditor de Segurança" \
PROVISION_USER_ROLE="security_auditor" \
PROVISION_REASON="Bootstrap producao — auditor" \
node backend/scripts/provision-remote-enterprise-user.mjs
```

## Passo 6: Bootstrap da UBS
```bash
curl -s https://[seu-dominio]/admin/units/bootstrap \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "unitId": "ubs-001",
    "unitName": "[Nome da UBS]",
    "gestorUserId": "[id-do-gestor-criado-anteriormente]"
  }' | jq .
```

**Nota:** O gestor precisa existir antes deste passo. Para criar o gestor, use o fluxo de registro público (`POST /auth/register`) com `role: "gestor"`, ou provisione via script com `PROVISION_USER_ROLE=gestor` (requer `PROVISION_USER_TEAM_ID`).

Resultado esperado: `{ "ok": true, "unitId": "ubs-001", "gestorUserId": "..." }`

## Passo 7: Verificar bootstrap
```bash
# Verificar que unit existe no audit log
curl -s https://[seu-dominio]/audit-logs \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.event == "unit_bootstrap")'
```

## Passo 8: Verificar isolamento
Login como gestor e verificar:
- GET /patients retorna apenas pacientes do team do gestor
- GET /users retorna apenas usuários da unidade do gestor

## Pós-bootstrap
- [ ] Trocar senha temporária do break_glass_admin
- [ ] Registrar credenciais em gerenciador de senhas da prefeitura
- [ ] Registrar data de bootstrap em baseline-record.md
- [ ] Adicionar break_glass_admin email em contatos.md
