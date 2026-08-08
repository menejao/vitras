# Patient

## Objetivo
Documentar paciente.

## Descrição
Entidade central clínica e territorial, com dados pessoais protegidos e escopo municipal/UBS/equipe.

## Campos
`id`, `teamId`, `unitId`, `municipalityId`, `name`, `cpf`, `cns`, `nis`, `birthDate`, `phone`, `address`, `microArea`, `assignedAcsId`, `careCategory`, `inactive`, `createdAt`, `updatedAt`.

## Índices e constraints
- `cpf_hash` único
- `cns_hash` único
- índices por `municipalityId`, `unitId`, `teamId`, `assignedAcsId`

## Relacionamentos
- N:1 com `Team`
- N:1 com `Unit`
- 1:N com registros, exames, tarefas, agendamentos e mensagens

## Regras
- CPF/CNS criptografados
- retorno mascarado na API
- cross-UBS é controlado
