# Onboarding de Clientes

**[NOME_DA_EMPRESA]**  
**Versão:** 1.0 · Maio de 2026  
**Classificação:** Interno — Operacional

---

## Sumário

1. Visão Geral do Processo
2. Etapas do Onboarding
3. Cronograma Padrão
4. Responsabilidades
5. Documentação e Artefatos
6. Critérios de Sucesso

---

## 1. Visão Geral do Processo

O processo de onboarding da **[NOME_DA_EMPRESA]** tem como objetivo garantir que cada novo cliente do **[NOME_FINAL_DO_PRODUTO]** inicie suas operações com:

- Ambiente configurado e estável em produção
- Equipe treinada e operando com autonomia
- Dados essenciais carregados e validados
- Canal de suporte ativo e conhecido pelos usuários
- Métricas de adoção sendo monitoradas

O onboarding é conduzido de forma estruturada, com etapas claras, responsáveis definidos e critérios objetivos de conclusão de cada fase.

---

## 2. Etapas do Onboarding

### Etapa 1 — Kickoff (Semana 1)

**Objetivo:** Alinhar expectativas, definir cronograma e iniciar provisionamento.

**Atividades:**
- Reunião de kickoff com representantes do cliente (gestor, TI, coordenador operacional)
- Apresentação da metodologia de implantação
- Levantamento de dados institucionais: unidades, equipes, fluxos locais
- Definição do cronograma de implantação
- Criação do canal de comunicação dedicado (WhatsApp Business ou e-mail)
- Início do provisionamento de ambiente pelo Diretor de Infraestrutura

**Responsável:** CEO + Diretor de Infraestrutura + Analista de Suporte  
**Entregável:** Plano de Implantação documentado, canal de comunicação ativo

---

### Etapa 2 — Provisionamento e Configuração (Semanas 1–2)

**Objetivo:** Preparar o ambiente técnico do cliente.

**Atividades:**
- Criação e configuração do ambiente de produção dedicado
- Configuração de domínio, certificados e acessos iniciais
- Carga de dados cadastrais: unidades, equipes, profissionais, pacientes (quando aplicável)
- Configuração de parâmetros específicos do cliente (fluxos, permissões, módulos ativos)
- Validação técnica do ambiente com o TI do cliente

**Responsável:** Diretor de Infraestrutura  
**Entregável:** Ambiente de produção funcional e validado

---

### Etapa 3 — Treinamento (Semanas 2–4)

**Objetivo:** Capacitar as equipes do cliente para operação autônoma.

**Atividades:**

**Treinamento de Gestores e Administradores** (1–2 dias)
- Painel gerencial, relatórios e indicadores
- Gestão de usuários e permissões
- Configurações administrativas
- Responsável: Analista de Suporte + Consultora Técnica

**Treinamento de Profissionais de Saúde** (2–3 dias)
- Atendimento, prontuário eletrônico, prescrição
- Fluxos de vacinação, farmácia, encaminhamentos
- Uso no contexto clínico diário
- Responsável: Consultora Técnica em Saúde

**Treinamento de Recepção e Agendamento** (1 dia)
- Cadastro de pacientes, agendamento, fila
- Emissão de documentos
- Responsável: Analista de Suporte

**Entregável:** Equipes treinadas, avaliação de assimilação realizada

---

### Etapa 4 — Operação Assistida e Homologação (Semanas 3–5)

**Objetivo:** Validar o sistema em operação real antes do go-live oficial.

**Atividades:**
- Operação em ambiente de homologação com dados reais (testes)
- Identificação e correção de configurações inadequadas ao fluxo local
- Validação pela Consultora Técnica dos fluxos assistenciais
- Testes de carga e stress do ambiente
- Aceite formal do cliente sobre funcionamento

**Responsável:** CEO + Infraestrutura + Saúde + Suporte  
**Entregável:** Termo de Aceite de Homologação assinado

---

### Etapa 5 — Go-Live (Semana 5–6)

**Objetivo:** Entrada em operação de produção.

**Atividades:**
- Ativação do ambiente de produção
- Suporte intensivo presencial ou remoto no(s) primeiro(s) dia(s)
- Monitoramento especial de performance e disponibilidade
- Canal de suporte dedicado durante a primeira semana de produção

**Responsável:** CEO + Infraestrutura + Suporte + Saúde  
**Entregável:** Sistema em operação de produção, relatório do primeiro dia

---

### Etapa 6 — Acompanhamento Pós Go-Live (Semanas 6–10)

**Objetivo:** Garantir estabilidade e adoção.

**Atividades:**
- Reuniões semanais de acompanhamento (primeiras 4 semanas)
- Monitoramento de métricas de adoção e uso
- Resolução de dúvidas operacionais
- Ajustes de configuração baseados no uso real
- Avaliação de satisfação do cliente

**Responsável:** Analista de Suporte (principal) + Consultora Técnica  
**Entregável:** Relatório mensal de adoção, cliente em operação estável

---

## 3. Cronograma Padrão

| Semana | Etapa |
|--------|-------|
| 1 | Kickoff + início de provisionamento |
| 2 | Configuração + início de treinamentos |
| 3 | Treinamentos completos + início de homologação |
| 4 | Homologação e ajustes |
| 5 | Go-Live |
| 6–9 | Acompanhamento pós go-live |

> **Observação:** O cronograma pode ser ajustado conforme a complexidade do cliente, número de unidades e disponibilidade das equipes locais.

---

## 4. Responsabilidades por Etapa

| Etapa | CEO | DIR-INFRA | DIR-COM | CONS-SAU | AN-SUP |
|-------|-----|-----------|---------|----------|--------|
| Kickoff | A | R | C | C | R |
| Provisionamento | C | A/R | I | I | C |
| Treinamento gestores | C | I | I | C | A/R |
| Treinamento saúde | C | I | I | A/R | C |
| Homologação | A | R | I | R | R |
| Go-Live | A | R | I | C | C |
| Pós go-live | C | C | I | C | A/R |

---

## 5. Documentação e Artefatos

| Documento | Quando | Responsável |
|-----------|--------|-------------|
| Plano de Implantação | Kickoff | CEO |
| Cronograma detalhado | Kickoff | Suporte |
| Checklist de configuração | Provisionamento | Infraestrutura |
| Materiais de treinamento | Treinamento | Saúde + Suporte |
| Relatório de treinamento | Pós-treinamento | Saúde + Suporte |
| Termo de Aceite de Homologação | Homologação | CEO (emite) + Cliente (assina) |
| Relatório de go-live | Go-Live | Infraestrutura |
| Relatório de adoção mensal | Pós go-live | Suporte |

---

## 6. Critérios de Sucesso

O onboarding é considerado concluído com sucesso quando:

- [ ] Ambiente de produção em operação estável por 30 dias
- [ ] Toda a equipe-alvo do cliente treinada e operando com autonomia
- [ ] Taxa de adoção da plataforma ≥ 80% dos usuários cadastrados com login nos últimos 7 dias
- [ ] Nenhum incidente crítico (S1) não resolvido em aberto
- [ ] Termo de Aceite de Homologação assinado
- [ ] NPS ou avaliação de satisfação pós go-live coletada

---

*[NOME_DA_EMPRESA] · [NOME_FINAL_DO_PRODUTO] · Onboarding de Clientes v1.0*  
*Classificação: Interno — Operacional · Maio de 2026*
