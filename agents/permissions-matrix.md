# Matriz de permissões VALENS

Documento de apoio para Business Rules Guardian.

Objetivo:

- consolidar perfis visíveis no projeto;
- resumir acessos esperados;
- reduzir risco de regressão funcional;
- apoiar revisão de telas, rotas e ações críticas.

## Perfis identificados

- `gestor`
- `nurse_manager`
- `doctor`
- `dentist`
- `nursing_tech`
- `pharmacist`
- `pharmacy_tech`
- `acs`
- `receptionist`

## Regras gerais

- toda permissão deve ser validada no backend;
- frontend só espelha capability/regra já existente;
- acesso entre equipes deve permanecer isolado;
- ação destrutiva exige confirmação visual e validação server-side;
- qualquer divergência entre tela e API deve ser registrada no relatório final.

## Matriz resumida

| Domínio / ação | gestor | nurse_manager | doctor | dentist | nursing_tech | pharmacist | pharmacy_tech | acs | receptionist |
|---|---|---|---|---|---|---|---|---|---|
| Login / sessão | sim | sim | sim | sim | sim | sim | sim | sim | sim |
| Solicitações de acesso | aprova/analisa | consulta conforme fluxo | não padrão | não padrão | não padrão | não padrão | não padrão | não padrão | solicita |
| Dashboard institucional | sim | sim | sim | conforme fluxo | conforme fluxo | conforme fluxo | conforme fluxo | restrito | restrito |
| Pacientes listar | equipe/tenant | equipe | equipe | equipe clínica | equipe clínica | se fluxo exigir | se fluxo exigir | atribuídos / equipe conforme regra | equipe operacional |
| Paciente criar/editar | conforme fluxo admin | sim | restrito conforme regra | restrito conforme regra | restrito | não padrão | não padrão | não | cadastro operacional conforme fluxo |
| Paciente excluir | conforme regra admin | sim com validação | não padrão | não padrão | não | não | não | não | não |
| Prontuário visualizar | não padrão | sim | sim | sim | não padrão salvo regra local | não | não | não padrão salvo visita | não |
| Prontuário criar registro | não padrão | sim | sim | sim | conforme regra | não | não | visita/observação conforme regra | não |
| Prontuário excluir registro | não padrão | sim | sim conforme regra | sim conforme regra | restrito | não | não | não | não |
| Agenda | visão executiva | sim | sim | conforme fluxo | conforme fluxo | não | não | não padrão | sim |
| Exames | visão executiva | sim | sim | sim | conforme fluxo | não | não | não | não |
| Encaminhamentos | visão executiva | sim | sim | sim | consulta | não | não | não | consulta operacional |
| Vacinas | visão executiva | sim | sim | não padrão | sim | não | não | consulta territorial | não |
| Farmácia / estoque | visão executiva | consulta | consulta | não | não | sim | sim | não | não |
| Insumos | visão executiva | sim | consulta | consulta | consulta | sim conforme fluxo | sim conforme fluxo | não | não |
| Gestão à vista | sim | sim | consulta | consulta | restrito | restrito | restrito | não | não |
| Relatórios | sim | sim | sim conforme escopo | consulta | consulta | consulta | consulta | restrito | restrito |
| Auditoria | sim | sim conforme escopo | consulta conforme escopo | consulta conforme escopo | não padrão | não padrão | não padrão | não | não |
| Usuários criar/editar | sim | fluxo restrito | não padrão | não | não | não | não | não | não |

## Observações operacionais

- `gestor` deve operar como perfil administrativo e institucional, não clínico.
- `nurse_manager` é perfil com maior interseção operacional/clínica.
- `doctor` e `dentist` exigem cuidado especial em prontuário, exames, encaminhamentos.
- `pharmacist` e `pharmacy_tech` devem ficar isolados de fluxos clínicos não relacionados à dispensação/estoque.
- `acs` precisa manter escopo territorial e de tarefas próprio.
- `receptionist` deve manter foco em fila, cadastro operacional, agenda e apoio administrativo.

## Uso obrigatório

Antes de alterar:

1. localizar perfil afetado;
2. validar rota/tela/ação;
3. conferir se comportamento está alinhado com backend;
4. registrar exceção ou dúvida no relatório final.
