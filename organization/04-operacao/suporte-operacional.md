# Suporte Operacional

**[NOME_DA_EMPRESA]**  
**Versão:** 1.0 · Maio de 2026  
**Classificação:** Interno — Operacional

---

## Modelo de Suporte

O suporte operacional da **[NOME_DA_EMPRESA]** é estruturado em três níveis, com canais definidos, SLAs contratuais e escalação clara entre os níveis.

---

## Canais de Suporte

| Canal | Uso | Horário |
|-------|-----|---------|
| E-mail | Tickets não urgentes, dúvidas gerais | Dias úteis, 08h–18h |
| WhatsApp Business | Tickets urgentes e acompanhamento de implantação | Dias úteis, 08h–18h |
| Telefone | Incidentes críticos (S1) | Dias úteis, 08h–18h |
| Base de conhecimento (self-service) | Dúvidas comuns, guias, FAQs | 24h/7d |

> **Plantão emergencial:** Para incidentes S1 fora do horário comercial, o cliente aciona o contato de emergência definido em contrato.

---

## Níveis de Suporte

### Nível 1 — Atendimento Operacional (Analista de Suporte)

**Responsável:** Luana Bonfim — Analista de Suporte e Relacionamento Operacional

**Escopo:**
- Dúvidas de uso da plataforma
- Erros de operação (navegação, preenchimento, configurações)
- Redefinição de senhas e acessos básicos
- Orientação sobre fluxos e funcionalidades
- Registro e triagem de todos os tickets recebidos

**Limite:** Se o problema não for resolvido em nível 1 após 2 tentativas ou 2 horas, escalação obrigatória para nível 2.

---

### Nível 2 — Suporte Técnico (Diretor de Infraestrutura)

**Responsável:** Jefferson Mattoso — Diretor de Infraestrutura e Operações Tecnológicas

**Escopo:**
- Problemas de infraestrutura e ambiente
- Erros de sistema não reproduzíveis em nível 1
- Problemas de performance e lentidão
- Configurações avançadas de ambiente
- Análise de logs e diagnóstico técnico

**Limite:** Se o problema requerer alteração de código ou decisão de produto, escalação para nível 3.

---

### Nível 3 — Escalação Executiva (CEO)

**Responsável:** João Menegucci — CEO

**Escopo:**
- Bugs críticos que requerem correção de código
- Decisões de produto relacionadas ao problema reportado
- Incidentes com impacto na reputação da empresa
- Situações que excedem o mandato das áreas operacionais

---

## Classificação de Incidentes

| Severidade | Critério | Exemplo |
|-----------|---------|---------|
| **S1 — Crítico** | Sistema totalmente indisponível para o cliente | Plataforma fora do ar, impossibilidade de acessar o sistema |
| **S2 — Alto** | Funcionalidade principal comprometida, impacto operacional grave | Erro ao salvar prontuário, falha no agendamento |
| **S3 — Médio** | Funcionalidade impactada, workaround disponível | Relatório com dado incorreto, funcionalidade secundária com erro |
| **S4 — Baixo** | Dúvida, melhoria ou inconveniência não-urgente | Dúvida de uso, sugestão de funcionalidade |

---

## SLAs de Atendimento

| Severidade | Tempo de 1ª Resposta | Tempo de Resolução |
|-----------|---------------------|--------------------|
| S1 — Crítico | 30 minutos | 4 horas |
| S2 — Alto | 2 horas | 8 horas (1 dia útil) |
| S3 — Médio | 4 horas | 2 dias úteis |
| S4 — Baixo | 1 dia útil | 5 dias úteis |

> SLAs válidos em dias e horários úteis (segunda a sexta, 08h–18h), exceto S1 que tem plantão emergencial.

---

## Processo de Atendimento

```
1. ABERTURA
   Cliente abre ticket (e-mail, WhatsApp ou telefone)
   Analista de Suporte registra e classifica severidade
            ↓
2. TRIAGEM
   Nível 1 investiga e tenta resolução
   Prazo: dentro do SLA da severidade
            ↓
3. RESOLUÇÃO N1 (se resolvido)
   Analista documenta solução
   Ticket fechado com confirmação do cliente
            ↓
3. ESCALAÇÃO N2 (se não resolvido em N1)
   Infraestrutura assume o ticket
   Analista comunica ao cliente: "escalado para suporte técnico"
            ↓
4. ESCALAÇÃO N3 (se não resolvido em N2)
   CEO assume
   Comunicação especial ao cliente
            ↓
5. RESOLUÇÃO
   Solução documentada
   Cliente notificado
   Post-mortem (para S1 e S2)
```

---

## Comunicação com o Cliente Durante Incidentes

**Para incidentes S1 e S2:**

1. **Abertura (t=0):** confirmação de recebimento e início de investigação
2. **30 minutos:** primeira atualização com diagnóstico preliminar
3. **A cada 1 hora:** atualização de status enquanto não resolvido
4. **Resolução:** comunicação formal de resolução com descrição da causa e ação tomada
5. **Relatório pós-incidente (até 48h):** documento com causa raiz, resolução e medidas preventivas

---

## Monitoramento de Qualidade do Suporte

O desempenho do suporte é monitorado com os seguintes indicadores:

| Indicador | Meta | Frequência |
|-----------|------|------------|
| Compliance com SLA (S1) | 100% | Mensal |
| Compliance com SLA (S2) | ≥ 95% | Mensal |
| Compliance com SLA (S3/S4) | ≥ 90% | Mensal |
| Satisfação do cliente pós-atendimento | ≥ 4,0/5,0 | Por ticket |
| Tickets reabertos (resolução ineficaz) | ≤ 5% | Mensal |

---

*[NOME_DA_EMPRESA] · [NOME_FINAL_DO_PRODUTO] · Suporte Operacional v1.0*  
*Classificação: Interno — Operacional · Maio de 2026*
