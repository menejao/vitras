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

### Opção 2 — Script de seed interno

```bash
# Executar no servidor com acesso ao banco
node scripts/seed-tenant-admin.js \
  --tenant municipio-xyz \
  --email joao@secretaria.gov.br \
  --name "João Silva"
```

O script gera uma senha temporária e envia por e-mail ao usuário.

### Opção 3 — Processo de onboarding do tenant

Durante a contratação do tenant, a equipe VALENS executa o script de provisionamento
que cria o admin inicial com uma senha de primeiro acesso que expira após 24h.

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
