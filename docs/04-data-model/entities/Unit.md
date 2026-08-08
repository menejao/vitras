# Unit

## Objetivo
Documentar UBS operacional.

## Descrição
Unidade básica de saúde com dados institucionais, configuração e regras operacionais.

## Campos
`id`, `name`, `cnes`, `municipalityId`, `municipalityName`, `uf`, `status`, `configuration`, `operationalRules`, `createdAt`, `updatedAt`.

## Índices e constraints
- Shadow table `app_units`
- índice por `municipality_id`

## Relacionamentos
- N:1 com `Municipality`
- 1:N com `Team`
- 1:N com `User`
- 1:N com `Patient`

## Regras
- Criada via rotas `/platform/units*`
- Ciclo de vida controlado por transições de status

## Exemplo
```json
{ "id": "unit-default", "name": "UBS Centro", "municipalityId": "3550308", "status": "active" }
```
