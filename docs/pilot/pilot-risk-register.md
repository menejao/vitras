# Pilot Risk Register — Top 20 — VITRAS APS

**Versão:** 1.0  
**Data:** 2026-06-18  
**Escopo:** riscos para o piloto municipal — produto, dados, usuários, infra, LGPD, homologação

**Classificação:**  
Probabilidade: A = Alta / M = Média / B = Baixa  
Impacto: C = Crítico / A = Alto / M = Médio / B = Baixo  
Prioridade: P1 = bloqueante / P2 = atenção / P3 = monitorar

---

## Produto

### R-01 — CDS Export ausente do repositório git

| Campo | Valor |
|-------|-------|
| Descrição | `cds-export.js` e `households.js` foram deletados do git HEAD no commit b562ec7 mas ainda são importados em `app.js`. Backend local não inicia. CDS Export disponível apenas em deploy zips. |
| Probabilidade | Alta (já ocorreu) |
| Impacto | Alto |
| Prioridade | P1 |
| Evidência | `git ls-files backend/src/routes/` — arquivos ausentes; `app.js` importa ambos |
| Mitigação | Restaurar arquivos do git history (`git show <hash>:backend/src/routes/cds-export.js`) e commitar |
| Status | ABERTO |

---

### R-02 — nursing_tech sem acesso ao prontuário completo

| Campo | Valor |
|-------|-------|
| Descrição | nursing_tech tem canWriteRecords=true mas CHART_ROLES não inclui nursing_tech — não acessa ChartPage. Inconsistência entre capacidade de criar registro e não ver histórico completo. |
| Probabilidade | Alta (comportamento atual do código) |
| Impacto | Médio |
| Prioridade | P2 |
| Evidência | `medical-records.js` CHART_ROLES = {doctor, dentist, nurse_manager}; `roles.js` canWriteRecords inclui nursing_tech |
| Mitigação | Documentar limitação no treinamento ou adicionar nursing_tech ao CHART_ROLES |
| Status | ABERTO |

---

### R-03 — Capabilities não configuradas no onboarding

| Campo | Valor |
|-------|-------|
| Descrição | Agenda, farmácia e referrals são 100% capability-based. Se capabilities não forem configuradas no cadastro do usuário, profissionais não acessam esses módulos — sem mensagem de erro clara. |
| Probabilidade | Alta (risco de onboarding) |
| Impacto | Médio |
| Prioridade | P2 |
| Evidência | `App.jsx` canUseAgenda, canUsePharmacy, canUseReferrals — todos verificam capabilities |
| Mitigação | Checklist de capabilities no go-live. Bootstrap por perfil documentado na tabela RBAC. |
| Status | ABERTO |

---

### R-04 — Validação de CNS no frontend

| Campo | Valor |
|-------|-------|
| Descrição | Campo CNS no cadastro de paciente não confirma dígito verificador no frontend — CNS inválido pode ser salvo e gerar rejeição silenciosa no PEC. |
| Probabilidade | Média |
| Impacto | Médio |
| Prioridade | P2 |
| Mitigação | Treinar usuários para buscar CNS no CADSUS antes de digitar. Fix: adicionar validação de DV no PatientModal. |
| Status | ABERTO |

---

### R-05 — CID-10 / CIAP-2 não testados em uso real

| Campo | Valor |
|-------|-------|
| Descrição | Campos CID-10 e CIAP-2 nos atendimentos não têm evidência de teste em condições reais de UBS. FAI exportada sem esses campos pode gerar warnings no PEC ou registros incompletos no SISAB. |
| Probabilidade | Média |
| Impacto | Médio |
| Prioridade | P2 |
| Mitigação | Incluir no treinamento médico. Validar na homologação PEC (cenário AT-01). |
| Status | ABERTO |

---

## Dados

### R-06 — Dados reais usados em homologação PEC

| Campo | Valor |
|-------|-------|
| Descrição | Operador pode exportar pacientes reais por engano para o PEC de homologação, violando LGPD. |
| Probabilidade | Baixa |
| Impacto | Crítico |
| Prioridade | P1 |
| Mitigação | Homologação usa ambiente staging com pacientes sintéticos do test-data-package.md. Checklist explícito antes do export. |
| Status | ABERTO |

---

### R-07 — Perda de dados por falha de backup

| Campo | Valor |
|-------|-------|
| Descrição | Falha silenciosa no RDS automated backup — dados não recuperáveis em caso de incidente. |
| Probabilidade | Baixa |
| Impacto | Crítico |
| Prioridade | P1 |
| Mitigação | Verificar snapshot gerado no go-live checklist (item 5.01). Alarme CloudWatch para falha de backup. |
| Status | ABERTO |

---

### R-08 — Migração de dados legados incorreta

| Campo | Valor |
|-------|-------|
| Descrição | Município pode ter dados em sistema legado (papel ou outro sistema) que são inseridos manualmente no VITRAS com erros — datas invertidas, nomes incompletos, CNS errado. |
| Probabilidade | Alta |
| Impacto | Médio |
| Prioridade | P2 |
| Mitigação | Sem importação em massa no piloto. Dados inseridos manualmente pelos profissionais. Treinamento em campos obrigatórios. |
| Status | MONITORAR |

---

## Usuários

### R-09 — Baixa adoção por resistência da equipe

| Campo | Valor |
|-------|-------|
| Descrição | Profissionais acostumados com papel ou sistema legado resistem ao novo sistema. Taxa de adoção < 30% após 15 dias. |
| Probabilidade | Alta |
| Impacto | Alto |
| Prioridade | P2 |
| Mitigação | Gestor municipal como "campeão do produto". Treinamento presencial. Revisão de meados no Dia 15. |
| Status | ABERTO |

---

### R-10 — Compartilhamento de credenciais

| Campo | Valor |
|-------|-------|
| Descrição | Profissionais compartilham login e senha, impossibilitando rastreabilidade clínica e auditoria individual. |
| Probabilidade | Média |
| Impacto | Alto |
| Prioridade | P2 |
| Mitigação | Orientação no treinamento. 2FA por usuário. Audit log rastreia por usuário individual. |
| Status | ABERTO |

---

### R-11 — Rotatividade de profissionais durante o piloto

| Campo | Valor |
|-------|-------|
| Descrição | ACS ou profissional clínico sai durante o piloto — conta não desativada a tempo, acesso indevido. |
| Probabilidade | Média |
| Impacto | Médio |
| Prioridade | P3 |
| Mitigação | Definir responsável por gestão de usuários (nurse_manager ou gestor). Runbook de offboarding no suporte. |
| Status | ABERTO |

---

## Infraestrutura

### R-12 — Indisponibilidade da instância EB

| Campo | Valor |
|-------|-------|
| Descrição | Elastic Beanstalk entra em estado degraded ou termina instância. UBS sem acesso ao sistema. |
| Probabilidade | Baixa |
| Impacto | Alto |
| Prioridade | P2 |
| Mitigação | CloudWatch alarme CPU/mem. Health check ativo. Runbook de restart EB no support-runbook.md. RTO documentado: 100min (DR Drill). |
| Status | MONITORAR |

---

### R-13 — Conectividade da UBS

| Campo | Valor |
|-------|-------|
| Descrição | UBS com internet instável — sistema inacessível durante atendimentos. |
| Probabilidade | Alta (realidade de UBS municipais) |
| Impacto | Alto |
| Prioridade | P2 |
| Mitigação | Service worker ativo — app carrega offline para visualização. Dados salvam quando conectividade volta. Testar SW antes do go-live. |
| Status | ABERTO |

---

### R-14 — Certificado SSL expirando durante piloto

| Campo | Valor |
|-------|-------|
| Descrição | Certificado TLS expira — usuários recebem aviso de segurança e não acessam. |
| Probabilidade | Baixa (se renovação automática ativa) |
| Impacto | Alto |
| Prioridade | P3 |
| Mitigação | Verificar renovação automática ACM antes do go-live. Alarme 30 dias antes da expiração. |
| Status | MONITORAR |

---

## LGPD

### R-15 — DPA não assinado antes do go-live

| Campo | Valor |
|-------|-------|
| Descrição | Município inicia o piloto sem Acordo de Processamento de Dados assinado — uso de dados de pacientes reais sem base legal. |
| Probabilidade | Média |
| Impacto | Crítico |
| Prioridade | P1 |
| Mitigação | DPA é critério no go-live checklist (item 4.01). Bloqueante absoluto. |
| Status | ABERTO |

---

### R-16 — Incidente de segurança com dados de saúde

| Campo | Valor |
|-------|-------|
| Descrição | Acesso não autorizado a dados de pacientes por falha de autenticação ou configuração incorreta. |
| Probabilidade | Baixa |
| Impacto | Crítico |
| Prioridade | P1 |
| Mitigação | 2FA, RBAC, audit log, session timeout idle. Resposta: acionar DPO imediatamente, avaliar notificação ANPD. |
| Status | MONITORAR |

---

### R-17 — Gestor acessando dados clínicos indevidamente

| Campo | Valor |
|-------|-------|
| Descrição | Bug ou configuração incorreta desativa filtro F7-03 — gestor vê dados clínicos especiais (LGPD Art. 11). |
| Probabilidade | Baixa |
| Impacto | Alto |
| Prioridade | P2 |
| Mitigação | F7-03 testado (Sprint 5A). Validar no QA pré-piloto que gestor não recebe campos sensíveis. |
| Status | MONITORAR |

---

## Homologação PEC

### R-18 — PEC do município < 5.4.36

| Campo | Valor |
|-------|-------|
| Descrição | Município confirma piloto mas PEC está em versão incompatível — homologação inviável no dia agendado. |
| Probabilidade | Alta |
| Impacto | Médio |
| Prioridade | P2 |
| Mitigação | Gate 1 do go-no-go.md — confirmar versão antes de agendar. Não é bloqueante para iniciar o piloto clínico (export pode aguardar). |
| Status | ABERTO |

---

### R-19 — Rejeição sistemática pelo PEC sem causa clara

| Campo | Valor |
|-------|-------|
| Descrição | PEC aceita o arquivo mas não processa fichas (rejeição silenciosa). Difícil de diagnosticar sem acesso aos logs internos do PEC. |
| Probabilidade | Média |
| Impacto | Alto |
| Prioridade | P2 |
| Mitigação | Usar import-validation.md antes do envio. Contato com suporte e-SUS AB do DATASUS. cds-field-mapping.md para diagnóstico. |
| Status | ABERTO |

---

### R-20 — Divergência entre piloto clínico e homologação PEC

| Campo | Valor |
|-------|-------|
| Descrição | Piloto clínico avança (atendimentos sendo registrados) mas homologação PEC ainda não validada — dados não chegam ao SISAB. Municípios têm obrigação de envio. |
| Probabilidade | Média |
| Impacto | Médio |
| Prioridade | P2 |
| Mitigação | Alinhar com gestor municipal: piloto pode iniciar, mas homologação PEC deve ocorrer no máximo até o Dia 15. Critério de sucesso 1.4 obrigatório. |
| Status | ABERTO |

---

## Resumo de Prioridades

| Prioridade | Quantidade | Riscos |
|-----------|-----------|--------|
| P1 — Bloqueante | 5 | R-01, R-06, R-07, R-15, R-16 |
| P2 — Atenção ativa | 11 | R-02 a R-05, R-08 a R-10, R-12, R-13, R-17 a R-20 |
| P3 — Monitorar | 4 | R-11, R-14, + outros sinalizados como MONITORAR |

---

*VITRAS APS — docs/pilot/pilot-risk-register.md*
