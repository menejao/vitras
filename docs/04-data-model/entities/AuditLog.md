# AuditLog

## Objetivo
Documentar trilha de auditoria.

## Descrição
Evento auditável encadeado por hash.

## Campos
`id`, `userId`, `userRole`, `teamId`, `municipalityId`, `action`, `entityType`, `entityId`, `details`, `ip`, `requestId`, `hash`, `prevHash`, `createdAt`.

## Regras
- retenção configurável
- integridade verificável
