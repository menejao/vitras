# Rotina Semanal (0800)

## Segunda-feira (20 min)
1. Verificar disponibilidade do backend (`/health`).
2. Conferir ultimos erros de deploy no Render.
3. Revisar tentativas de login falhas (se houver).

## Quarta-feira (20 min)
1. Revisar log de auditoria (acoes criticas, exclusoes, alteracoes de perfil).
2. Validar se contas ativas correspondem a equipe atual.
3. Checar usuarios sem 2FA ativo e cobrar ativacao.

## Sexta-feira (30 min)
1. Exportar auditoria:
   - `/audit-logs/export?format=json`
   - `/audit-logs/export?format=csv`
2. Exportar base clinica operacional (se aplicavel no seu fluxo interno).
3. Salvar backup em pasta segura com data.

## Regras fixas
- Sem conta compartilhada.
- Sem uso de senha fraca.
- Qualquer exclusao critica exige dupla checagem humana.
