# Exam

## Objetivo
Documentar exame.

## Descrição
Solicitação ou resultado laboratorial vinculado ao paciente.

## Campos
`id`, `patientId`, `teamId`, `title`, `date`, `status`, `resultDate`, `lab`, `source`, `externalId`, `details`, `attachments`, `createdAt`, `createdBy`.

## Regras
- integração lab suporta idempotência
- attachments atuais são JSON, não binário
