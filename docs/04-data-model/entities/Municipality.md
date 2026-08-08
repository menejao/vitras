# Municipality

## Objetivo
Documentar entidade relacional de município usada por console nacional e escopo de implantação.

## Descrição
Catálogo relacional de municípios com base IBGE.

## Campos
| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | UUID | sim | PK interna |
| `ibge_code` | string | sim | único |
| `name` | string | sim | nome oficial |
| `uf` | string | sim | UF |
| `region` | string | não | região |
| `is_capital` | boolean | não | capital |
| `active` | boolean | sim | ativo |

## Índices e constraints
- PK em `id`
- unique em `ibge_code`
- índices por `uf`, `active` e FTS por nome

## Relacionamentos
- 1:N com `Unit`

## Regras
- Só existe em PostgreSQL
- Suporte atual pesquisa por UUID ou código IBGE

## Exemplo
```json
{ "id": "uuid", "ibgeCode": "3550308", "name": "Sao Paulo", "uf": "SP" }
```
