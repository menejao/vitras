# Politica LGPD Minima (Operacao UBS)

## 1) Objetivo
Garantir uso seguro e legal de dados pessoais e dados pessoais sensiveis de pacientes.

## 2) Escopo
Aplica-se a todos os usuarios da plataforma: enfermeira, medica e ACS.

## 3) Base legal (referencia interna)
- Atencao a saude (execucao de politicas publicas e tutela da saude).
- Cumprimento de obrigacao legal/regulatoria.

## 4) Principios obrigatorios
- Minimizacao: coletar somente dados necessarios.
- Finalidade: usar dados apenas para cuidado em saude.
- Necessidade: evitar campos sem utilidade clinica.
- Seguranca: proteger acesso e armazenamento.
- Prestacao de contas: manter trilha de auditoria.

## 5) Dados tratados
- Identificacao: nome, data nascimento, CPF, CNS, telefones, endereco.
- Clinicos: historico, protocolos, vacinas, consultas, procedimentos.
- Operacionais: logs de auditoria, usuario autor da acao.

## 6) Controle de acesso
- Cada profissional com conta propria (proibido compartilhamento).
- ACS: visualiza pacientes permitidos e registra visita.
- Medica: atende, registra clinico, sem gerenciar contas da equipe.
- Enfermeira: gestao da equipe e operacao assistencial.

## 7) Seguranca tecnica minima
- Senha com hash seguro.
- 2FA por TOTP para perfis clinicos.
- Criptografia em repouso para campos sensiveis.
- JWT com segredo forte.
- CORS restrito por origem.
- Auditoria de acoes criticas.

## 8) Direitos do titular
- Acesso: exportar dados do paciente quando solicitado.
- Correcao: corrigir cadastro e registrar justificativa.
- Eliminacao/anonimizacao: executar conforme politica e obrigacoes legais.

## 9) Retencao e descarte
- Aplicar janela de retencao definida pela unidade.
- Anonimizar registros fora da janela quando permitido.
- Registrar toda execucao no log de auditoria.

## 10) Incidentes
- Seguir playbook em `docs/governanca/03-resposta-incidente-0800.md`.

## 11) Responsabilidades
- Enfermeira responsavel: governanca, revisao de acessos, aprovacao de solicitacoes.
- Equipe assistencial: uso adequado e registro correto.
- Admin tecnico: backup, monitoramento e seguranca da aplicacao.
