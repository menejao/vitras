# Operação Geral

**[NOME_DA_EMPRESA]**  
**Versão:** 1.0 · Maio de 2026  
**Classificação:** Interno — Operacional

---

## Sumário

1. Modelo Operacional
2. Jornada do Cliente
3. Níveis de Serviço (SLA)
4. Ciclo de Operação
5. Indicadores Operacionais
6. Ferramentas e Processos

---

## 1. Modelo Operacional

A **[NOME_DA_EMPRESA]** opera como empresa de SaaS com modelo de entrega totalmente em nuvem. O modelo operacional é estruturado em três dimensões:

### Dimensão 1 — Operação da Plataforma

Responsabilidade: Infraestrutura e Tecnologia (Jefferson Mattoso)

- Manutenção e disponibilidade dos ambientes de produção
- Monitoramento contínuo de performance e disponibilidade
- Deploy de novas versões e atualizações
- Gestão de incidentes de infraestrutura
- Segurança operacional e controle de acessos

### Dimensão 2 — Operação com Clientes

Responsabilidade: Suporte (Luana Bonfim) + Saúde (Beatriz Menegucci)

- Atendimento e suporte técnico-operacional
- Acompanhamento de implantações ativas
- Gestão de relacionamento operacional com clientes
- Treinamento e capacitação de usuários
- Monitoramento de satisfação e adoção

### Dimensão 3 — Operação Comercial

Responsabilidade: Comercial (Mateus Menegucci)

- Pipeline de prospecção e vendas
- Relacionamento com clientes atuais
- Gestão de contratos e renovações
- Expansão dentro de clientes existentes

---

## 2. Jornada do Cliente

```
[PROSPECÇÃO]
     ↓
[QUALIFICAÇÃO & PROPOSTA]
     ↓
[CONTRATO & ONBOARDING]
     ↓
[IMPLANTAÇÃO]
     ↓
[GO-LIVE]
     ↓
[SUPORTE ATIVO & CRESCIMENTO]
     ↓
[RENOVAÇÃO]
```

### Fase 1 — Prospecção

**Responsável:** Comercial  
**Atividades:** identificação de oportunidades, contato inicial, apresentação institucional, qualificação do lead

### Fase 2 — Qualificação e Proposta

**Responsável:** Comercial + CEO  
**Atividades:** visita técnica, levantamento de necessidades, elaboração e apresentação de proposta

### Fase 3 — Contrato e Onboarding

**Responsável:** CEO + Comercial + Infraestrutura  
**Atividades:** negociação final, assinatura de contrato, kickoff de projeto, provisionamento de ambiente

### Fase 4 — Implantação

**Responsável:** Infraestrutura + Saúde + Suporte  
**Atividades:** configuração, carga de dados, treinamento, testes, homologação  
**Duração típica:** 30 a 90 dias

### Fase 5 — Go-Live

**Responsável:** CEO + Infraestrutura + Suporte  
**Atividades:** entrada em produção, monitoramento intensivo, suporte dedicado por 30 dias

### Fase 6 — Suporte Ativo

**Responsável:** Suporte + Infraestrutura  
**Atividades:** atendimento contínuo, atualizações, monitoramento de SLA, relatórios periódicos

### Fase 7 — Renovação

**Responsável:** Comercial + CEO  
**Atividades:** revisão de contrato, expansão de módulos, negociação de renovação

---

## 3. Níveis de Serviço (SLA)

### Disponibilidade da Plataforma

| Métrica | Compromisso |
|---------|-------------|
| Disponibilidade mensal | ≥ 99,5% |
| Janela de manutenção programada | Domingos, 00h–06h |
| Aviso prévio de manutenção | Mínimo 48h |

### Suporte ao Cliente

| Severidade | Descrição | Tempo de Primeira Resposta | Tempo de Resolução |
|-----------|-----------|---------------------------|-------------------|
| **Crítico (S1)** | Sistema indisponível para o cliente | 30 minutos | 4 horas |
| **Alto (S2)** | Funcionalidade principal comprometida | 2 horas | 8 horas |
| **Médio (S3)** | Funcionalidade impactada, workaround disponível | 4 horas | 2 dias úteis |
| **Baixo (S4)** | Dúvida, melhoria ou problema não-urgente | 1 dia útil | 5 dias úteis |

### Comunicação de Incidentes

| Evento | Prazo de Comunicação |
|--------|---------------------|
| Incidente S1 identificado | Até 30 minutos |
| Incidente S2 identificado | Até 2 horas |
| Resolução de incidente | Imediata + relatório em 48h |

---

## 4. Ciclo de Operação

### Rotinas Diárias

- Verificação de monitoramento de disponibilidade (Infraestrutura)
- Triagem e resposta a tickets abertos (Suporte)
- Verificação de alertas de sistema (Infraestrutura)

### Rotinas Semanais

- Revisão de incidentes da semana (CEO + Infraestrutura)
- Atualização de pipeline comercial (Comercial)
- Revisão de onboardings em andamento (Suporte + Saúde)

### Rotinas Mensais

- Relatório de disponibilidade e SLA por cliente
- Revisão de métricas de suporte e satisfação
- Revisão de pipeline e meta comercial
- Atualização de backlog de produto

### Rotinas Trimestrais

- Revisão estratégica de produto e roadmap
- Revisão de governança e processos
- Avaliação de riscos organizacionais
- Planejamento do próximo trimestre

---

## 5. Indicadores Operacionais

| Indicador | Frequência | Responsável |
|-----------|------------|-------------|
| Uptime da plataforma | Diário | Infraestrutura |
| Tempo médio de resposta ao suporte | Semanal | Suporte |
| Satisfação do cliente (NPS ou CSAT) | Mensal | Suporte |
| Incidentes abertos por severidade | Semanal | Infraestrutura + Suporte |
| Taxa de adoção por cliente | Mensal | Suporte |
| Pipeline comercial ativo | Semanal | Comercial |

---

## 6. Ferramentas e Processos

| Função | Ferramenta | Responsável |
|--------|-----------|-------------|
| Gestão de tickets de suporte | A definir | Suporte |
| Monitoramento de infraestrutura | A definir | Infraestrutura |
| CRM e pipeline | A definir | Comercial |
| Comunicação interna | A definir | Todos |
| Documentação | Este repositório | CEO |
| Controle de versão | Git | CEO + Infraestrutura |

---

*[NOME_DA_EMPRESA] · [NOME_FINAL_DO_PRODUTO] · Operação Geral v1.0*  
*Classificação: Interno — Operacional · Maio de 2026*
