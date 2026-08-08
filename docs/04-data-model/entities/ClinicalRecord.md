# ClinicalRecord

## Objetivo
Documentar registro clínico.

## Descrição
Evento clínico persistido em histórico do paciente.

## Campos
`id`, `patientId`, `teamId`, `type`, `title`, `content`, `createdBy`, `createdByRole`, `status`, `snapshot`, `createdAt`, `updatedAt`.

## Relacionamentos
- N:1 com `Patient`
- N:1 com `User`

## Regras
- nunca exclusão física
- `prescription` e `medical_attest` restritos a prescritores
- `visit` pode ser criado por ACS
