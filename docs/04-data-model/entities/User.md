# User

## Objetivo
Documentar usuário interno.

## Descrição
Profissional, gestor ou operador técnico autenticado no sistema.

## Campos
`id`, `vitrasId`, `name`, `email`, `password`, `role`, `teamId`, `unitId`, `municipalityId`, `twoFactorEnabled`, `twoFactorSecret`, `lastLoginAt`, `lastSeenAt`, `createdAt`, `updatedAt`.

## Índices e constraints
- email único
- combinações de conselho validadas em runtime

## Relacionamentos
- N:1 com `Team`
- N:1 com `Unit`
- 1:N com `RefreshToken`
- 1:N com `AuditLog`

## Regras
- role define capabilities
- suporte clínico direto bloqueado para `support_admin`
- 2FA é opcional por usuário e suportado nativamente
