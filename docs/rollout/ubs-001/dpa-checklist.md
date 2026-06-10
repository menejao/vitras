# DPA — Checklist de Cláusulas por Suboperador — Vitras UBS #1

**Data de criação:** 2026-05-29
**Autor:** Tech Lead Vitras
**Versão:** v1.0
**Bloqueia:** Gate 3 — live com pacientes reais (LGPD Art. 37-39)
**Base normativa:** LGPD Art. 37-39 (obrigações do operador), Art. 46 (segurança), Art. 48 (incidentes)

---

## Contexto

**Controlador:** Prefeitura Municipal (Secretaria de Saúde)
**Operador principal:** Vitras Tecnologia
**Suboperadores:** AWS, Neon, Upstash, Render (se ainda ativo)

LGPD Art. 39 exige que o operador principal (Vitras) assine DPA com cada suboperador que processa dados dos pacientes. O DPA deve garantir que os suboperadores processem os dados **apenas conforme as instruções do operador principal**.

---

## Cláusulas obrigatórias em cada DPA (LGPD Art. 37-39)

Para cada DPA, verificar se as seguintes cláusulas estão presentes:

| # | Cláusula | Obrigatoriedade |
|---|----------|----------------|
| C-01 | Finalidade limitada: suboperador só pode processar dados para prestar o serviço contratado | OBRIGATÓRIO (Art. 39) |
| C-02 | Proibição de uso secundário: vedado uso dos dados para perfil, marketing, treinamento de modelo, etc. | OBRIGATÓRIO (Art. 39) |
| C-03 | Confidencialidade: funcionários do suboperador com acesso aos dados sujeitos a NDA | OBRIGATÓRIO (Art. 46) |
| C-04 | Medidas de segurança: criptografia em repouso e em trânsito, controle de acesso, MFA | OBRIGATÓRIO (Art. 46) |
| C-05 | Notificação de incidente: suboperador notifica Vitras em ≤ 24h (para Vitras notificar ANPD em 72h) | OBRIGATÓRIO (Art. 48 §1) |
| C-06 | Lista de sub-suboperadores: suboperador declara quais empresas têm acesso aos dados | RECOMENDADO |
| C-07 | Localização dos dados: confirmar região de armazenamento (preferência Brasil) | RECOMENDADO (Art. 33) |
| C-08 | Exclusão na rescisão: suboperador apaga dados em ≤ 30 dias após fim do contrato | OBRIGATÓRIO (Art. 16) |
| C-09 | Direito de auditoria: Vitras pode auditar as práticas do suboperador | RECOMENDADO |
| C-10 | Cooperação com autoridade: suboperador coopera com ANPD se solicitado | OBRIGATÓRIO (Art. 39) |

---

## AWS — Amazon Web Services (EB + RDS)

**Serviços em uso:** Elastic Beanstalk (processamento), RDS PostgreSQL (armazenamento de todos os dados de pacientes)

**Dados transmitidos:** TODOS os dados de pacientes (dados mais sensíveis do sistema)

**DPA da AWS:** Disponível em [AWS Data Processing Addendum](https://aws.amazon.com/agreement/data-processing-addendum/)

### Checklist AWS

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| 1 | Acessar AWS Customer Agreement + DPA em console.aws.amazon.com/legal | [ ] PENDENTE | — |
| 2 | Aceitar o AWS DPA (requer clique formal na console ou assinatura para planos enterprise) | [ ] PENDENTE | — |
| 3 | Confirmar: dados em `sa-east-1` (São Paulo) — verificar no console RDS + EB | [ ] PENDENTE | — |
| 4 | Confirmar: RDS `StorageEncrypted: true` (já verificado: ✅) | [x] CONFIRMADO | go-final-readiness-report.md |
| 5 | Confirmar: VPC isolation — RDS acessível apenas do SG do EB (já verificado: ✅) | [x] CONFIRMADO | go-final-readiness-report.md |
| 6 | Verificar se a conta AWS tem suporte ao LGPD (plano de suporte atual: [PREENCHER]) | [ ] PENDENTE | contatos.md Seção D |
| C-05 | AWS notifica violações de segurança via AWS Shield / Security Advisories? Confirmar canal | [ ] PENDENTE | — |

**Ação para João:** Acessar `console.aws.amazon.com` → `AWS Artifact` → aceitar/baixar o AWS DPA e o GDPR/LGPD Addendum. Guardar PDF assinado.

---

## Neon — Banco de dados (se ainda ativo)

**Verificar:** O ambiente de produção (`vitras-drill-sa-3`) usa DATABASE_URL apontando para RDS AWS, não Neon.

> **Ação obrigatória:** Confirmar se o Neon ainda é suboperador ativo.
> Se `DATABASE_URL` em EB Console não contém `neon.tech` → Neon não está em uso em produção → DPA não é necessário agora.
> Se ainda há dados em Neon de fase anterior → executar deleção ou migração documentada.

| # | Item | Status |
|---|------|--------|
| 1 | Verificar se DATABASE_URL em EB Console contém `neon.tech` | [ ] PENDENTE — João verifica |
| 2 | Se não: confirmar que nenhum dado de paciente permanece em instâncias Neon | [ ] PENDENTE |
| 3 | Se sim: Neon tem DPA disponível em console.neon.tech → aceitar e baixar PDF | [ ] CONDICIONAL |

---

## Upstash — Redis (rate limiting)

**Serviços em uso:** Armazenamento de metadados de rate limiting (IP, timestamp de requisições)
**Dados transmitidos:** Endereços IP e timestamps — dados pessoais conforme LGPD Art. 5, I

**DPA do Upstash:** Disponível em [upstash.com/legal/dpa](https://upstash.com/legal/dpa)

### Checklist Upstash

| # | Item | Status |
|---|------|--------|
| 1 | Verificar plano atual no console Upstash | [ ] PENDENTE — contatos.md Seção D |
| 2 | Confirmar região do cluster Redis (idealmente `us-east-1` ou `sa-east-1`) | [ ] PENDENTE |
| 3 | Acessar `console.upstash.com` → Settings → DPA → assinar/baixar | [ ] PENDENTE |
| C-02 | Confirmar: Upstash não usa dados de requisição para treinamento ou analytics próprios | [ ] PENDENTE — verificar ToS |
| C-05 | Confirmar canal de notificação de incidente do Upstash (email/portal) | [ ] PENDENTE |

> **Nota:** Se `UPSTASH_REDIS_REST_URL` não estiver configurado no EB (PNB-03), Upstash não está em uso e DPA não é urgente. Confirmar antes de go-live se Upstash será provisionado.

---

## Render (se ainda ativo como suboperador)

**Verificar:** O ambiente de produção usa AWS EB como plataforma principal. Render pode ter sido usado em fases anteriores.

| # | Item | Status |
|---|------|--------|
| 1 | Confirmar se algum serviço Vitras ainda está ativo no Render (`onrender.com`) | [ ] PENDENTE — João verifica |
| 2 | Se não: nenhum DPA necessário para go-live | [ ] CONDICIONAL |
| 3 | Se sim (ex: frontend, worker): acessar `render.com/legal/dpa` e assinar | [ ] CONDICIONAL |
| 4 | Se dados de fase anterior em Render: solicitar deleção formal + confirmação escrita | [ ] CONDICIONAL |

---

## Resumo de ações por João

| # | Ação | Urgência | Plataforma |
|---|------|----------|-----------|
| 1 | AWS DPA: acessar AWS Artifact, aceitar DPA, baixar PDF | T-7 | console.aws.amazon.com/artifact |
| 2 | Confirmar região sa-east-1 para EB + RDS | T-7 | AWS Console |
| 3 | Verificar DATABASE_URL — confirmar se Neon ainda em uso | T-7 | EB Console → Environment Properties |
| 4 | Verificar se Render ainda é suboperador ativo | T-7 | render.com/dashboard |
| 5 | Confirmar plano Upstash + região | T-7 | console.upstash.com |
| 6 | Upstash DPA: aceitar e baixar se Upstash for usado em prod | T-3 | console.upstash.com |
| 7 | Guardar todos os PDFs de DPA em pasta segura (não commitar no repositório) | T-3 | Pasta local ou vault |

---

## Checklist de conclusão

Antes do go-live com pacientes reais, confirmar:

- [ ] AWS DPA aceito e PDF arquivado
- [ ] Neon: confirmado como não-ativo em prod ou DPA aceito
- [ ] Upstash: DPA aceito (se configurado) ou confirmado como não-ativo
- [ ] Render: confirmado como não-ativo em prod ou DPA aceito
- [ ] Nenhum suboperador com dados de pacientes sem DPA em vigor

---

*Criado em: 2026-05-29 — Vitras Tech Lead*
*Referência: LGPD Art. 37-39, 46, 48; ANPD orientações sobre suboperadores*
*Status: PENDENTE EXECUÇÃO — João deve executar ações acima antes do go-live*
