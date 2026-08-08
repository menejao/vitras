# ExamRequest

## Objetivo
Documentar solicitação de exame separada dos resultados.

## Descrição
Domínio complementar usado em rotas e indicadores, com atribuição assistencial.

## Campos
`id`, `patientId`, `teamId`, `unitId`, `executingUnitId`, `referenceUnitIdAtEvent`, `createdAt`, `status`.

## Regras
- participa da engine de atribuição quando presente no banco
