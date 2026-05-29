# LGPD — DPO e RIPD — Vitras UBS #1

**Data de criação:** 2026-05-29
**Autor:** Tech Lead Vitras
**Versão:** v1.0
**Bloqueia:** Gate 3 — live com pacientes reais
**Base normativa:** LGPD Lei 13.709/2018 (Art. 38, 41), ANPD Resolução CD/ANPD n.º 02/2022

---

## Parte A — DPO (Encarregado de Dados) — LGPD Art. 41

### O que é obrigatório

LGPD Art. 41 obriga o **controlador** a designar um Encarregado (DPO) que:

1. Aceita reclamações e comunicações dos titulares (pacientes)
2. Presta esclarecimentos ao controlador
3. Recebe comunicações da ANPD
4. Orienta funcionários sobre LGPD

> **Quem é o controlador em Vitras?**
> A **Prefeitura Municipal** (Secretaria de Saúde) é o controlador — determina a finalidade do tratamento.
> A **Vitras** é o operador — processa dados a serviço do controlador.
> Portanto, **a Prefeitura deve designar o DPO**, e a Vitras deve cooperar.

### Designação formal — checklist

| # | Ação | Responsável | Status |
|---|------|-------------|--------|
| 1 | Identificar candidato (interno ou empresa especializada) | Secretaria de Saúde / Prefeitura | [ ] PENDENTE |
| 2 | Emitir portaria ou contrato de designação formal | Secretaria de Saúde | [ ] PENDENTE |
| 3 | Publicar nome + canal de contato do DPO (Art. 41 §1) | Prefeitura | [ ] PENDENTE |
| 4 | Preencher Seção C de `contatos.md` com dados do DPO | João Pedro (após designação) | [ ] PENDENTE |
| 5 | Confirmar disponibilidade 24h para incidente P0 LGPD | DPO designado | [ ] PENDENTE |
| 6 | Confirmar conhecimento do prazo ANPD de 72h (Art. 48 §1) | DPO designado | [ ] PENDENTE |

### Canal de contato do DPO

Após designação, publicar:
- Email dedicado (ex: `dpo@prefeitura-[municipio].gov.br`)
- Telefone com ramal ou celular funcional 24h para P0

### Quando acionar o DPO

| Situação | Prazo para acionar |
|----------|--------------------|
| Incidente de segurança com dados de pacientes | Imediato (DPO deve ser avisado em < 1h) |
| Notificação à ANPD (Art. 48 §1) | DPO prepara notificação em < 72h |
| Solicitação de titular (acesso, correção, exclusão) | DPO orienta resposta em < 15 dias úteis |
| Uso de `break_glass_admin` com acesso a dados | DPO notificado se houver suspeita de violação |

---

## Parte B — RIPD (Relatório de Impacto à Proteção de Dados) — LGPD Art. 38

### O que é obrigatório

LGPD Art. 38 exige que a ANPD possa solicitar o RIPD a qualquer momento. Para dados de saúde (Art. 11 — dados sensíveis), a elaboração **preventiva** é obrigatória antes do início do tratamento.

> **Responsável pelo RIPD:** Controlador (Prefeitura), com suporte do operador (Vitras).

---

### RIPD — Template Vitras UBS #1

```
RELATÓRIO DE IMPACTO À PROTEÇÃO DE DADOS (RIPD)
SISTEMA: Vitras — Sistema de Gestão de UBS
CONTROLADOR: Prefeitura Municipal de [MUNICÍPIO]
OPERADOR: Vitras Tecnologia (CNPJ: [PREENCHER])
VERSÃO DO SISTEMA: v1.0-pilot-governed
DATA DE ELABORAÇÃO: [PREENCHER]
RESPONSÁVEL: [DPO designado — Nome + Cargo]
BASE NORMATIVA: LGPD Art. 38 + ANPD Resolução CD/ANPD n.º 02/2022
```

---

#### Seção 1 — Descrição do tratamento

| Campo | Descrição |
|-------|-----------|
| Nome do processo | Gestão de prontuário eletrônico e atendimento em UBS |
| Sistema | Vitras v1.0-pilot-governed |
| Ambiente | AWS Elastic Beanstalk + RDS PostgreSQL (sa-east-1) |
| Data de início do tratamento | [PREENCHER — data prevista do go-live] |
| Escopo do piloto | UBS #1 — [Nome da UBS], [Município], [Estado] |

---

#### Seção 2 — Categorias de dados e finalidade

| Categoria | Dados específicos | Finalidade | Base legal (LGPD) |
|-----------|------------------|-----------|-------------------|
| Dados de identificação | Nome, CPF (cifrado), CNS, data de nascimento, filiação | Identificação do paciente e prevenção de cadastro duplicado | Art. 11, II, f |
| Dados de contato | Telefone, endereço, e-mail (se fornecido) | Comunicação clínica e agendamento | Art. 11, II, f |
| Dados clínicos | Prontuário, consultas, vacinas, exames, encaminhamentos, medicamentos, prescrições | Prestação de serviço de saúde, continuidade do cuidado | Art. 11, II, f |
| Dados de saúde sensíveis | Condições crônicas, gravidez, puericultura, categoria de cuidado, alergias | Condução do cuidado clínico individualizado | Art. 11, II, f |
| Dados de atividade no sistema | Audit logs (quem acessou o quê, quando, de qual IP) | Controle de acesso, prevenção de vazamento, rastreabilidade legal | Art. 11, II, f + obrigação legal |
| Dados profissionais | Nome, e-mail, CRM/COREN, equipe, perfil de acesso dos profissionais | Autenticação e controle de acesso ao sistema | Art. 7, V (execução de contrato) |

> **Dados NÃO tratados pelo Vitras:** Dados financeiros, dados de fora do contexto de saúde, dados de menores sem relação clínica direta (exceto quando paciente).

---

#### Seção 3 — Fluxo de dados

```
[Paciente / Responsável]
         ↓
[Recepção UBS — cadastro e agendamento]
         ↓
[Profissional de saúde — prontuário, vacinas, exames, prescrições]
         ↓
[Gestor UBS — dashboard de produção, audit logs de unidade]
         ↓
[Auditor de segurança — audit chain, cross-team access reports]
         ↓
[Backup cifrado — AWS RDS + snapshot manual]

Suboperadores (dados em trânsito/repouso):
  AWS Elastic Beanstalk (sa-east-1) → processamento e hosting
  AWS RDS PostgreSQL (sa-east-1) → persistência de dados clínicos
  Upstash Redis (região: [verificar]) → metadados de rate limiting (IP, timestamp)
  Neon (se ainda em uso) → confirmar se base produtiva
  Render (se ainda em uso) → confirmar se ainda em escopo
```

---

#### Seção 4 — Retenção e descarte

| Dado | Retenção mínima | Base | Descarte |
|------|----------------|------|---------|
| Prontuário eletrônico (adulto) | 20 anos após último atendimento | CFM Res. 1.821/2007 + Art. 7 LGPD | Anonimização via endpoint `/privacy/retention/anonymize` — somente após revisão legal (KI-02 ativo) |
| Prontuário eletrônico (menor) | Até 25 anos de idade ou 5 anos após maioridade (o que for maior) | CFM Res. 1.821/2007 | Mesma política de anonimização |
| Audit logs | Mínimo 5 anos | Obrigação legal / rastreabilidade | Exclusão após período ou compressão |
| Dados de autenticação (profissionais) | Duração do vínculo + 2 anos | Obrigação legal trabalhista | Desativação da conta + anonimização após prazo |
| Backups RDS | 1 dia (atual, Free Tier) → 7 dias (pós-upgrade AWS) | BT-02 | Expiração automática conforme retention policy AWS |

---

#### Seção 5 — Riscos identificados e medidas de mitigação

| # | Risco | Probabilidade | Impacto | Medidas de mitigação implementadas | Status |
|---|-------|--------------|---------|-----------------------------------|--------|
| R-01 | Acesso não autorizado por profissional de outra equipe | Média | Alto | `canAccessPatient()` — teamId enforced + audit log completo | MITIGADO |
| R-02 | Acesso cross-município por profissional clínico | Baixa | Alto | US-204: `canAccessPatient(mode=read)` — municipalityId check | MITIGADO |
| R-03 | Vazamento de CPF/CNS via API | Baixa | Crítico | `maskSensitivePatientFields()` — máscara em todas as respostas de paciente | MITIGADO |
| R-04 | Uso indevido de `break_glass_admin` | Baixa | Crítico | Audit log obrigatório + revisor designado em < 24h | PARCIALMENTE MITIGADO (security_auditor pendente) |
| R-05 | Incidente de segurança sem notificação ANPD em 72h | Baixa | Crítico | Plano de resposta a incidentes documentado + DPO designado | PENDENTE — DPO não designado |
| R-06 | Transferência de dados para fora do Brasil | Baixa | Médio | AWS RDS na região sa-east-1 (Brasil); Upstash — verificar região | PARCIALMENTE MITIGADO — verificar Upstash |
| R-07 | Anonimização sem validação legal (KI-02) | Média | Alto | Endpoint bloqueado até Sprint 5A legal review | MITIGADO |
| R-08 | Acesso indevido ao banco por terceiros | Muito Baixa | Crítico | VPC isolation — RDS acessível apenas de SG do EB | MITIGADO |
| R-09 | Perda de dados por falha de hardware | Baixa | Alto | RDS backups (1 dia atual, 7 dias pós-upgrade) + DR drill | PARCIALMENTE MITIGADO |

---

#### Seção 6 — Direitos dos titulares

| Direito (Art. 18) | Mecanismo no Vitras | Canal para o paciente |
|------------------|--------------------|-----------------------|
| Confirmação de existência | Gestor consulta sistema | Presencial na UBS |
| Acesso aos dados | `GET /patients/:id/report` — relatório completo | Solicitação ao gestor da UBS |
| Correção | `PATCH /patients/:id` | Solicitação ao profissional responsável |
| Anonimização / eliminação | `POST /privacy/retention/anonymize` — BLOQUEADO (KI-02) | Aguardar Sprint 5A legal review |
| Portabilidade | Backup export cifrado | Via DPO + autorização médica |
| Revogação de consentimento | N/A — base legal é saúde pública (Art. 11, II, f), não consentimento | Orientar ao DPO |
| Oposição | Avaliar caso a caso com DPO | Via DPO |

---

#### Seção 7 — Aprovação do RIPD

```
RIPD Status: PENDENTE — preencher e revisar com DPO antes do go-live

Elaborado por:     [Nome do responsável técnico — Tech Lead Vitras]
Revisado por:      [Nome do DPO]
Aprovado por:      [Nome do controlador — Secretário de Saúde / Prefeito]
Data de aprovação: [PREENCHER]
Próxima revisão:   [data + 1 ano ou após mudança significativa no tratamento]

Assinatura DPO:    _________________________
Assinatura controlador: ____________________
```

---

## Parte C — Ações imediatas para João Pedro

| # | Ação | Prazo | Status |
|---|------|-------|--------|
| 1 | Encaminhar este documento ao jurídico/Secretaria de Saúde com pedido de designação de DPO | T-14 | [ ] PENDENTE |
| 2 | Preencher campos `[PREENCHER]` do RIPD com DPO designado | T-7 | [ ] PENDENTE |
| 3 | Obter assinatura do DPO e do controlador no RIPD | T-3 | [ ] PENDENTE |
| 4 | Preencher Seção C de `contatos.md` com dados do DPO designado | T-7 | [ ] PENDENTE |
| 5 | Confirmar região do Upstash (verificar se dados em Brasil) | T-7 | [ ] PENDENTE |
| 6 | Confirmar se Render ainda é suboperador ativo ou se foi substituído por EB | T-7 | [ ] PENDENTE |

---

*Criado em: 2026-05-29 — Vitras Tech Lead*
*Referência: LGPD Art. 38, 41, 48; CFM Res. 1.821/2007; ANPD Res. CD/ANPD n.º 02/2022*
*Status: PENDENTE ASSINATURA — não substitui aconselhamento jurídico*
