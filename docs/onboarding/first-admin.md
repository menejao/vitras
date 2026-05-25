# Provisionamento do Primeiro Administrador

## Princípio

O primeiro gestor/administrador de um tenant **não é criado pela tela pública de login**.

A tela pública aceita apenas:
- Entrar (login com credenciais existentes)
- Solicitar acesso (cria solicitação pendente, não cria usuário ativo)
- Recuperar senha (redefinição via token de e-mail)

## Por que esta política existe

Permitir criação pública de conta de administrador é um vetor crítico de segurança:
- Qualquer pessoa poderia criar um tenant com permissões máximas
- Impossível auditar a origem das contas administrativas
- Viola o princípio de menor privilégio na inicialização

## Como criar o primeiro admin de um tenant

### Opção 1 — Superadmin VALENS (recomendado)

> **Nota:** Apenas para plataforma multi-tenant centralizada VALENS. Para implantações standalone, use Opção 2.

O superadmin da plataforma cria o primeiro usuário admin via painel interno:

```
POST /admin/tenants/{tenantId}/users
{
  "name": "João Silva",
  "email": "joao@secretaria.gov.br",
  "role": "gestor",
  "tenantId": "municipio-xyz"
}
```

### Opção 2 — Script de provisionamento enterprise (para UBS standalone)

Para implantações VITRAS standalone (sem superadmin VALENS), use o script existente:

```bash
# Criar primeiro break_glass_admin em produção/staging
ALLOW_ENTERPRISE_REMOTE_PROVISIONING=true \
PROVISION_USER_EMAIL="admin@ubs.gov.br" \
PROVISION_USER_PASSWORD="[senha-forte-gerada]" \
PROVISION_USER_NAME="Administrador UBS" \
PROVISION_USER_ROLE="break_glass_admin" \
PROVISION_REASON="Bootstrap UBS #1 — primeiro admin" \
node backend/scripts/provision-remote-enterprise-user.mjs
```

**Requisitos:**
- `DATABASE_URL` configurado no ambiente (aponta para banco correto)
- `DATA_ENCRYPTION_KEY` configurado (mesma chave do ambiente alvo)
- `PATIENT_LOOKUP_HASH_KEY` configurado
- Senha deve ter ≥ 12 caracteres, gerada aleatoriamente
- Executar APENAS no servidor com acesso ao banco de dados alvo
- Gera audit log `user.enterprise_provisioned` automaticamente

**Após criar o break_glass_admin:**
1. Login via `POST /auth/login` → obter JWT token
2. Executar bootstrap da UBS: `POST /admin/units/bootstrap` com token

Ver: `docs/runbooks/production-bootstrap.md`

## Fluxo após o primeiro admin

Uma vez que o primeiro admin está ativo:

1. Ele acessa a plataforma normalmente via tela de login
2. Vai ao painel **Solicitações de Acesso** (`/access_requests`)
3. Analisa solicitações enviadas pela tela pública
4. Aprova ou recusa cada solicitação
5. Ao aprovar: usuário recebe credenciais por e-mail, já associado ao tenant correto

## Auditoria

Todas as ações de aprovação/recusa são registradas no log de auditoria com:
- ID da solicitação
- Admin responsável pela ação
- Timestamp
- Tenant associado

## Referência técnica

- Endpoint de solicitações: `POST /auth/access-requests`
- Listagem admin: `GET /auth/access-requests` (token de admin obrigatório)
- Aprovação: `POST /auth/access-requests/{id}/approve`
- Recusa: `POST /auth/access-requests/{id}/reject`
