# Resposta a Incidente (0800)

## 1) Identificacao
Sinais:
- acesso indevido suspeito;
- alteracao de dados sem justificativa;
- vazamento de credencial;
- indisponibilidade prolongada.

## 2) Contencao imediata (ate 30 min)
1. Trocar `JWT_SECRET` se houver suspeita de comprometimento.
2. Forcar troca de senha das contas afetadas.
3. Revogar/desativar usuarios suspeitos.
4. Validar variaveis de ambiente criticas.

## 3) Preservacao de evidencia
1. Exportar auditoria JSON/CSV.
2. Salvar print de telas e timestamp.
3. Registrar usuarios, IP, horario e acao observada.

## 4) Analise
1. Identificar origem (erro humano, credencial, bug).
2. Definir impacto: quais dados e quantos titulares.
3. Definir acao corretiva e preventiva.

## 5) Comunicacao interna
1. Enfermeira responsavel informa equipe.
2. Registrar ata simples do ocorrido.

## 6) Recuperacao
1. Corrigir configuracao/codigo.
2. Testar ambiente.
3. Reabrir acesso com monitoramento reforcado por 7 dias.
