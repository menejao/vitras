# GOVERNANCE

## Objetivo
Documentar mecanismos atuais de governança técnica e de release do VITRAS.

## Escopo
ADR, baselines, freeze, versionamento, changelog, critérios de sprint e política de arquitetura.

## Pré-requisitos
- `docs/adr/*`
- `docs/baseline/*`
- `docs/releases/*`
- `agents/*`

## Descrição
Governança do VITRAS combina documentação arquitetural, baselines, artefatos de release e contrato de qualidade dos guardians do projeto.

## ADR
- Pasta oficial: `docs/adr/`
- Exemplo relevante: `ADR-002-canAccessPatient-read-write.md`
- Uso: registrar decisão quando impacto arquitetural não for trivial

## Baselines
- Pasta oficial: `docs/baseline/`
- Inclui baseline global patient, changelog e versionamento documental

## Freeze
### IMPLEMENTADO
- Há artefatos de release e readiness
- Há checklist de homologação/go-live e documentos de baseline

### PARCIAL
- Política formal única de freeze operacional ainda depende de composição de vários documentos

## Versionamento
- Backend e frontend marcam `1.1.0-rc.1` nos `package.json`
- Documentação complementar usa notas de release e baseline versionada

## Governança técnica
- `AGENTS.md` obriga leitura de guardians
- `agents/workflow.md` define fluxo mínimo
- `agents/checklist-final.md` define checklist obrigatório

## Changelog
- `docs/releases/CHANGELOG.md`
- `docs/baseline/CHANGELOG.md`

## Critérios para novas sprints
- Não violar DS, regras de negócio, arquitetura ou UX
- Documentar impacto de segurança e regressão
- Manter relatório final dos guardians
- Preferir mudança incremental com evidência de teste

## Política de arquitetura
- Backend como monólito modular
- Console nacional segregado do fluxo clínico
- `support_admin` sem acesso clínico direto
- Atribuição territorial e operacional centralizadas em engine
- Mudanças de acesso a paciente exigem ADR ou equivalente quando alteram escopo

## Boas práticas
- Toda evolução estrutural deve citar arquivo, rota, classe ou serviço
- Roadmap não pode ser descrito como funcionalidade entregue
- Baseline deve ser atualizada em marcos relevantes

## Referências internas
- `AGENTS.md`
- `agents/workflow.md`
- `docs/adr/ADR-002-canAccessPatient-read-write.md`
- `docs/baseline/BASELINE-GLOBAL-PATIENT-RC1-v1.1.0-rc2.md`
- `docs/releases/CHANGELOG.md`

## Arquivos relacionados
- `docs/02-architecture/ARCHITECTURE.md`
- `docs/07-operations/OPERATIONS.md`
