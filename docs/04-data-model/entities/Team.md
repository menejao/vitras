# Team

## Objetivo
Documentar equipe assistencial.

## Descrição
Equipe vinculada a uma UBS, usada para escopo clínico, acesso e produção.

## Campos
`id`, `name`, `unitId`, `managerUserId`, `ine`, `tipoEquipe`, `createdAt`, `updatedAt`.

## Relacionamentos
- N:1 com `Unit`
- 1:N com `User`
- 1:N com `Patient`

## Regras
- Criada pelo console nacional ou seeds/documentos operacionais
- Escopo clínico padrão é por equipe
