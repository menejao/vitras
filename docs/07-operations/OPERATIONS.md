# OPERATIONS

## Objetivo
Descrever fluxos operacionais recorrentes para implantação, administração de UBS, backup, restore, atualização e suporte.

## Escopo
Procedimentos de operação técnica e funcional baseados nas capacidades atuais do sistema.

## Pré-requisitos
- `docs/implantacao/*`
- `docs/rollout/ubs-001/*`
- `backend/src/routes/platform.js`
- `backend/src/routes/auth.js`

## Descrição
Operação atual divide responsabilidades entre console nacional, operação local da UBS e sustentação técnica.

## Status
### IMPLEMENTADO
- Novo município via catálogo de municípios e gestão platform
- Nova UBS via console nacional
- Gestor inicial com senha temporária
- Equipes, configuração e regras operacionais por UBS
- Backup exportável
- Checklists de rollout e go-live

### PARCIAL
- Procedimentos automatizados fim a fim ainda dependem de execução operacional manual

## Fluxos
### Implantação
1. Validar requisitos técnicos e credenciais
2. Provisionar infraestrutura
3. Configurar variáveis e migrations
4. Criar município e UBS no console
5. Criar gestor inicial
6. Executar checklist de homologação e go-live

### Novo município
1. Confirmar município na tabela `municipalities`
2. Consultar `/platform/municipalities`
3. Associar UBS ao `municipalityId` correto
4. Registrar dados institucionais

### Nova UBS
1. Criar UBS em `/platform/units`
2. Criar equipe em `/platform/units/:unitId/teams`
3. Criar gestor inicial em `/platform/units/:unitId/initial-manager`
4. Validar checklist de onboarding/homologação

### Novo usuário
1. Gestor ou enfermeira responsável cria usuário conforme escopo
2. Validar role, equipe e unidade
3. Exigir primeiro acesso quando aplicável

### Backup
1. Confirmar janela operacional
2. Executar export protegido
3. Validar integridade do artefato
4. Armazenar em cofre/armazenamento seguro

### Restore
1. Identificar snapshot
2. Executar script de restore ou rotina equivalente
3. Validar `readyz`, autenticação e leitura básica
4. Registrar incidente e evidências

### Migração
1. Habilitar `RUN_MIGRATIONS`
2. Aplicar deploy
3. Confirmar migrations críticas
4. Desabilitar `RUN_MIGRATIONS`

### Atualização
1. Build
2. Testes
3. Deploy backend
4. Deploy frontend
5. Smoke operacional

### Incidentes
1. Classificar impacto
2. Coletar `/health`, logs e auditoria
3. Isolar se envolve segurança ou dado sensível
4. Restaurar serviço ou degradar com segurança

### Suporte
1. Operador `support_admin` atua em `/platform/*`
2. Se necessário, perfis técnicos usam impersonation
3. Nunca operar rotas clínicas com `support_admin`

## Checklist operacional
- Ambiente correto selecionado
- Variáveis críticas conferidas
- Banco acessível
- `/health` e `/readyz` verdes
- Gestor inicial testado
- Perfis principais validados
- Auditoria íntegra
- Plano de rollback pronto

## Boas práticas
- Registrar toda mudança de unidade/município em trilha de plataforma
- Não realizar reset de senha sem canal seguro de comunicação
- Usar materiais de rollout como evidência formal

## Referências internas
- `docs/implantacao/README.md`
- `docs/rollout/ubs-001/final-go-live-checklist.md`
- `backend/src/routes/platform.js`

## Arquivos relacionados
- `docs/06-infrastructure/INFRASTRUCTURE.md`
- `docs/08-governance/GOVERNANCE.md`
