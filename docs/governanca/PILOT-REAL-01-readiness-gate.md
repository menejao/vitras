# PILOT-REAL-01 — First Real UBS Migration Readiness Gate

**Status:** FAIL — pré-requisitos não técnicos pendentes  
**Data de emissão:** 2026-06-23  
**Pré-condição técnica:** MIG-01 PASS (pipeline validado, 34/34 testes, 50K pacientes em 852ms)  
**Objetivo:** Confirmar que todos os pré-requisitos não técnicos estão atendidos antes da primeira migração real  
**Escopo:** Avaliação de prontidão apenas — nenhuma migração executada, nenhuma funcionalidade criada

---

## GOV-01 — Parecer Obrigatório

### Business Analyst

1. **Qual problema real da APS essa migração resolve?**  
   Continuidade do cuidado: pacientes já cadastrados no PEC existirão no VITRAS sem re-cadastro manual. Elimina duplicação de dados e erro humano na transferência.

2. **Quem usa?** Gestor UBS / suporte técnico (executa). ACS, enfermeiro, médico (beneficiados — não precisam re-cadastrar).

3. **Em que momento?** Migração pontual antes do go-live da UBS. Não é fluxo diário.

4. **Como é feito hoje sem o VITRAS?** Não é feito — VITRAS ainda não tem pacientes reais migrados do PEC. O piloto real é o primeiro.

**Parecer BA:** GO WITH CONDITIONS — migração resolve problema real, mas requer validação de todos os pré-requisitos abaixo.

### Product Designer

Migração não tem UI para usuário final (é operação de suporte/admin). UI de staging e homologação (UI-STG-01, UI-HOMO-01) implementadas e aprovadas. Sem gap de UX.

**Parecer PD:** GO

### Tech Lead

Pipeline MIG-01 aprovado. Todas as 7 fases funcionais. Escala 50K validada. Sem dívida técnica conhecida que bloqueie migração real. O único bloqueador técnico pendente: dados reais nunca foram processados — primeira execução real precisa de smoke test em staging antes de commit em produção.

**Parecer TL:** GO WITH CONDITIONS — exige smoke test com dados reais em ambiente staging antes de commit em produção.

### QA Senior

Regressão APS-01A a APS-01F deve ser re-executada após commit da migração real, para confirmar que dados migrados não quebram fluxos clínicos existentes.

**Parecer QA:** GO WITH CONDITIONS — regressão obrigatória pós-commit.

### Delivery Governor

MIG-02 permanece bloqueado até PILOT-REAL-01 PASS. Nenhuma nova iniciativa de importação abre antes de validação operacional com dados reais.

**Parecer DG:** GO WITH CONDITIONS — emissão de PASS somente quando todos os 10 itens do GOV-01 abaixo forem SIM.

---

## GOV-01 — Respostas (2026-06-23)

| # | Pergunta | Resposta | Bloqueador |
|---|----------|----------|------------|
| 1 | UBS piloto definida? | **NÃO** | Nenhuma UBS foi formalmente selecionada e documentada |
| 2 | Responsável formal definido? | **NÃO** | Nenhum gestor ou responsável técnico nomeado |
| 3 | Base PEC disponível? | **NÃO** | Nenhum acesso ao banco PEC de UBS real confirmado |
| 4 | Exportação autorizada? | **NÃO** | Nenhuma autorização formal de exportação do PEC existente |
| 5 | CNES → unitId disponível? | **NÃO** | Mapeamento CNES real → unitId não existe ainda |
| 6 | INE → teamId disponível? | **NÃO** | Mapeamento INE real → teamId não existe ainda |
| 7 | CNS profissional → userId disponível? | **NÃO** | Usuários reais não foram cadastrados no VITRAS |
| 8 | LGPD validada? | **NÃO** | Consentimento formal e DPA com a UBS não formalizados |
| 9 | Plano de rollback definido? | **NÃO** | Procedimento formal não documentado (ver FASE 6 abaixo) |
| 10 | Migração real autorizada? | **NÃO** | Dependente de todos os itens acima |

**Resultado GOV-01: 0/10 SIM → Migração real NÃO autorizada**

---

## FASE 1 — UBS Piloto

### Critérios de elegibilidade

A UBS piloto deve atender:

| Critério | Requisito |
|----------|-----------|
| PEC instalado e operacional | PEC APS versão 4.2+ (sp-pec-aps-v01 compatível) |
| Volume de pacientes | 200–2.000 cadastros ativos (batch inicial gerenciável) |
| Gestor disponível | Dedicação mínima de 4h para treinamento + homologação |
| Conectividade | Acesso à internet para staging |
| Suporte técnico | Contato técnico na Secretaria de Saúde |

### Template de identificação (preencher quando UBS selecionada)

```
UBS: _______________________________________________
CNES: _____________________________________________
Município (IBGE 7 dígitos): _______________________
Gestor: ___________________________________________
Cargo: ____________________________________________
E-mail: ___________________________________________
Telefone: _________________________________________
Responsável técnico Secretaria: ___________________
Data de aceite: ___________________________________
```

### Pré-requisito para fechar FASE 1

- [ ] Template preenchido e assinado pelo gestor
- [ ] CNES confirmado no CNES.datasus.gov.br
- [ ] INE(s) da(s) equipe(s) piloto confirmados

---

## FASE 2 — Dados de Origem

### Validação PEC

| Item | Requisito | Como verificar |
|------|-----------|---------------|
| Versão PEC | ≥ 4.2 | Menu Sobre no PEC da UBS |
| Volume de cadastros | Informado pelo gestor | Relatório de cadastros individuais no PEC |
| Formato de exportação | JSON (sp-pec-aps-v01) | Execução de exportação de teste em ambiente controlado |
| Acesso técnico | API ou dump autorizado | Acordo formal com gestor TI da Secretaria |

### Template de validação de dados (preencher)

```
Versão PEC instalada: ___________________________
Data da verificação: _____________________________
Total de cadastros individuais ativos: ___________
Total de visitas domiciliares (últimos 24 meses): _
Formato disponível: JSON / CSV / Outro: __________
Pessoa técnica responsável pela extração: ________
```

### Pré-requisito para fechar FASE 2

- [ ] Versão PEC ≥ 4.2 confirmada
- [ ] Volume documentado
- [ ] Amostra de dados anônimos testada contra `applyMapping()` (dry-run local sem commit)
- [ ] Taxa de rejeição de mapeamento < 20% na amostra

---

## FASE 3 — Tabelas de Referência

### CNES → unitId

```
CNES: ________________________
Nome UBS: ____________________
unitId no VITRAS: ____________  (criado pelo support_admin antes da migração)
Confirmado em: _______________
```

### INE → teamId

| INE | Nome da equipe | teamId VITRAS | ACS responsável |
|-----|---------------|--------------|-----------------|
| ___ | _______________ | ____________ | ______________ |
| ___ | _______________ | ____________ | ______________ |

### CNS Profissional → userId VITRAS

| CNS | Nome | Cargo | userId VITRAS | Criado em |
|-----|------|-------|--------------|-----------|
| ___ | ____ | _____ | ____________ | _________ |
| ___ | ____ | _____ | ____________ | _________ |

### Pré-requisito para fechar FASE 3

- [ ] Todos os unitIds criados no VITRAS via Console Nacional
- [ ] Todos os teamIds criados e associados à unidade
- [ ] Todos os userIds criados (perfil + senha inicial comunicada)
- [ ] Tabela CNS→userId completa e revisada pelo gestor

---

## FASE 4 — LGPD

### Base legal aplicável

A migração de dados do PEC para o VITRAS se enquadra em:

- **LGPD Art. 7º, II** — execução de contrato ou de procedimentos preliminares
- **LGPD Art. 7º, VI** — exercício regular de direitos em processo
- **LGPD Art. 11, II, b** — tratamento compartilhado de dados necessários à execução de política pública

### Documentos obrigatórios antes da migração

| Documento | Responsável | Status |
|-----------|------------|--------|
| Termo de Responsabilidade de Dados — UBS | Gestor UBS | PENDENTE |
| Autorização formal de exportação PEC | Secretaria Municipal de Saúde | PENDENTE |
| DPA (Data Processing Agreement) se aplicável | Jurídico/TI da Secretaria | PENDENTE |
| Registro no RIPD (Relatório de Impacto à Proteção de Dados) | Encarregado LGPD | PENDENTE |

### Campos Art. 11 — tratamento especial

Os seguintes campos requerem controle reforçado (já implementado no VITRAS):

- `genderIdentity`, `racaCor`, `situacaoRua`, `deficiencia`
- `hivGestante`, `sifilis`, `cidPrincipal`, `cidSecundarios`, `ciapPrincipal`

Esses campos **não aparecem em logs de auditoria operacional** (implementado em MIG-01).

### Pré-requisito para fechar FASE 4

- [ ] Termo de Responsabilidade assinado pelo gestor UBS
- [ ] Autorização formal da Secretaria documentada
- [ ] Registro RIPD atualizado (ou parecer de isenção)
- [ ] Encarregado LGPD notificado

---

## FASE 5 — Treinamento

### Gestor (obrigatório antes de homologação)

| Módulo | Conteúdo | Duração estimada |
|--------|----------|-----------------|
| Homologação | UI-HOMO-01: revisar staging, GO/NO_GO | 1h |
| Staging | UI-STG-01: entender registros pendentes | 30min |
| LGPD | Tratamento de dados especiais, direitos do titular | 30min |
| Rollback | Quando e como acionar procedimento de rollback | 30min |

**Total:** ~2,5h com gestor real.

### Equipe ACS/Enfermeiro (obrigatório pós-migração)

| Módulo | Conteúdo | Duração |
|--------|----------|---------|
| Validação de cadastros migrados | Verificar se dados estão corretos | 1h |
| Fluxo de correção | Como corrigir registro migrado com erro | 30min |

### Homologador (suporte técnico)

| Módulo | Conteúdo |
|--------|----------|
| Pipeline import | Como usar `/import/jobs/:id/run`, `/homologate`, `/commit` |
| Critérios GO/NO_GO | Taxa de rejeição aceitável, thresholds |
| Auditoria | Verificar auditHash e trilha pós-commit |

### Pré-requisito para fechar FASE 5

- [ ] Gestor treinado em UI-HOMO-01 e UI-STG-01
- [ ] Gestor assinou confirmação de treinamento
- [ ] Homologador técnico confirmado e capacitado
- [ ] Sessão de Q&A realizada

---

## FASE 6 — Plano de Rollback

### Definição formal

O rollback de uma migração real é a remoção dos registros importados sem afetar dados pré-existentes.

### Quando acionar rollback

| Condição | Threshold | Ação |
|----------|-----------|------|
| Taxa de rejeição no staging | > 30% | STOP — não avançar para homologação |
| Erros detectados pós-commit | > 5% dos registros | Acionar rollback imediato |
| Falha de regressão APS-01 | Qualquer FAIL | Acionar rollback imediato |
| Solicitação do gestor | Qualquer motivo em até 48h pós-commit | Acionar rollback |

### Procedimento de rollback

**Pré-requisito:** Todos os pacientes migrados têm `importJobId` registrado (implementado em MIG-01).

**Passos:**

1. **STOP imediato** — Notificar gestor e suporte técnico
2. **Identificar registros afetados**:
   ```
   Filtrar em db.patients: WHERE importJobId = '<jobId-da-migração>'
   Filtrar em db.acsVisits: WHERE importJobId = '<jobId-da-migração>'
   ```
3. **Remover via Console Nacional** (support_admin):
   - Deletar todos os `acsVisits` com `importJobId` da migração
   - Deletar todos os `patients` com `importJobId` da migração E sem histórico clínico pré-existente
   - Para `patients` com `mergeCandidate=true`: restaurar versão anterior dos campos via backup
4. **Verificar integridade**:
   - Re-executar regressão APS-01A a APS-01F
   - Confirmar que grupos familiares pré-existentes intactos
   - Confirmar auditoria exportável
5. **Registrar no log de auditoria** com ação `"import.rollback.executed"`
6. **Notificar gestor** com relatório do rollback

### Responsáveis

| Papel | Responsabilidade |
|-------|-----------------|
| Support Admin (VITRAS) | Executa remoção dos registros |
| Gestor UBS | Valida que dados estão corretos pós-rollback |
| Tech Lead | Aprova rollback antes da execução |
| Encarregado LGPD | Notificado do incidente |

### Janela de rollback garantida

**48 horas** após o commit da migração. Após 48h com dados validados pelo gestor, o commit é considerado definitivo.

### Pré-requisito para fechar FASE 6

- [ ] Plano de rollback revisado e aceito pelo gestor UBS
- [ ] Support admin identificado e apto a executar
- [ ] Tech lead designado para aprovação
- [ ] Contato de emergência documentado (telefone + e-mail do support admin)

---

## FASE 7 — Decisão Executiva

### Checklist final antes de autorizar migração real

| # | Item | Status atual |
|---|------|-------------|
| 1 | UBS piloto definida e documentada | ❌ PENDENTE |
| 2 | Gestor e responsável técnico nomeados | ❌ PENDENTE |
| 3 | PEC versão ≥ 4.2 confirmada | ❌ PENDENTE |
| 4 | Volume e formato de dados confirmados | ❌ PENDENTE |
| 5 | Amostra dry-run com taxa rejeição < 20% | ❌ PENDENTE |
| 6 | CNES → unitId mapeado | ❌ PENDENTE |
| 7 | INE → teamId mapeado | ❌ PENDENTE |
| 8 | CNS profissionais → userId mapeado | ❌ PENDENTE |
| 9 | Termo de Responsabilidade LGPD assinado | ❌ PENDENTE |
| 10 | Autorização exportação PEC pela Secretaria | ❌ PENDENTE |
| 11 | Treinamento gestor concluído | ❌ PENDENTE |
| 12 | Homologador técnico confirmado | ❌ PENDENTE |
| 13 | Plano de rollback aceito | ❌ PENDENTE |
| 14 | Ambiente staging smoke-testado com dados reais | ❌ PENDENTE |
| 15 | Regressão APS-01A a APS-01F confirmada em staging | ❌ PENDENTE |

**Decisão executiva:** A primeira migração real **NÃO pode ser executada** em 2026-06-23.

Todos os 15 itens estão pendentes.

---

## RESULTADO OBRIGATÓRIO

| # | Item | Resultado |
|---|------|-----------|
| 1 | UBS piloto definida? | **NÃO** |
| 2 | Dados disponíveis? | **NÃO** |
| 3 | Tabelas de referência disponíveis? | **NÃO** |
| 4 | LGPD validada? | **NÃO** |
| 5 | Treinamento concluído? | **NÃO** |
| 6 | Rollback definido? | **SIM** ✅ (definido neste documento, FASE 6) |
| 7 | Migração real autorizada? | **NÃO** |
| 8 | Status | **FAIL** |

---

## Decisão Final

**PILOT-REAL-01: FAIL — migração real não autorizada.**

Todos os pré-requisitos não técnicos estão pendentes, exceto o plano de rollback (definido neste documento).

**MIG-02 permanece BLOQUEADO** até PILOT-REAL-01 atingir PASS completo.

### O que muda quando uma UBS for selecionada

Quando a equipe identificar uma UBS piloto real:

1. Preencher FASE 1 (template UBS)
2. Executar FASE 2 a FASE 5 com a UBS real
3. Emitir novo parecer GOV-01 específico para aquela UBS
4. Re-avaliar PILOT-REAL-01 — quando todos os 15 itens do checklist forem ✅, status muda para PASS
5. Smoke test em staging com dados reais antes de qualquer commit em produção

### Responsável pela próxima reavaliação

**Qualquer um dos seguintes eventos** deve triggerar reavaliação deste documento:

- UBS piloto identificada formalmente
- Parceria com Secretaria Municipal de Saúde estabelecida
- Acesso ao PEC real negociado
- Mudança de contexto operacional do piloto

---

## Rastreabilidade

| Documento | Relação |
|-----------|---------|
| `MIG-01-first-end-to-end-simulated-migration.md` | Pipeline técnico aprovado (pré-condição) |
| `ARCH-INT-01-national-import-interoperability-architecture.md` | Arquitetura base (imutável) |
| `docs/governanca/06-gov-01-product-scope-governance.md` | Gate de governança |
| `docs/governanca/01-politica-lgpd-minima.md` | Base LGPD |
| `docs/governanca/04-checklist-go-live-ubs.md` | Complementar ao go-live |
| `docs/CTRL-01-product-control-map.md` | Ponto único de verdade — PILOT-REAL-01 registrado |
