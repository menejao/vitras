# Appointment

## Objetivo
Documentar agendamento.

## Descrição
Agendamento vinculado a paciente e equipe.

## Campos
`id`, `patientId`, `teamId`, `date`, `time`, `type`, `status`, `reason`, `createdBy`, `createdAt`, `updatedAt`.

## Relacionamentos
- N:1 com `Patient`
- N:1 com `Team`
