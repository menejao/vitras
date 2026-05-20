# Metodologia de Implantação

**[NOME_DA_EMPRESA]**  
**Versão:** 1.0 · Maio de 2026  
**Classificação:** Interno — Operacional

---

## Sumário

1. Filosofia de Implantação
2. Fases da Implantação
3. Pré-requisitos do Cliente
4. Gestão de Riscos da Implantação
5. Implantação em Múltiplas Unidades
6. Critérios de Aceite

---

## 1. Filosofia de Implantação

A metodologia de implantação da **[NOME_DA_EMPRESA]** é orientada por quatro princípios:

**Estrutura sem rigidez:** seguimos um processo definido, mas adaptamos a execução à realidade de cada cliente. Municípios têm contextos, culturas e capacidades operacionais distintas.

**Progressividade:** começamos pelo essencial e expandimos. A implantação progressiva reduz risco, aumenta a adoção e permite ajustes antes que o sistema esteja em escala total.

**Presença ativa:** a equipe da [NOME_DA_EMPRESA] não entrega e desaparece. Mantemos presença próxima durante toda a implantação e nas semanas seguintes ao go-live.

**Sucesso mensurável:** cada fase tem critérios objetivos de conclusão. Avançamos quando os critérios são atendidos — não apenas quando o prazo se esgota.

---

## 2. Fases da Implantação

### Fase 0 — Preparação Interna (pré-kickoff)

**Duração:** 3–5 dias úteis  
**Responsável:** Diretor de Infraestrutura + CEO

**Atividades:**
- Criação do ambiente de produção dedicado ao cliente
- Configuração de domínio e certificados
- Definição do plano de implantação personalizado
- Preparação dos materiais de treinamento adaptados ao contexto do cliente
- Briefing interno da equipe sobre o cliente: contexto, perfil, sensibilidades

**Critério de conclusão:** Ambiente técnico pronto, plano documentado, equipe alinhada.

---

### Fase 1 — Diagnóstico e Planejamento

**Duração:** 1 semana  
**Responsável:** CEO + Consultora Técnica + Comercial

**Atividades:**
- Reunião de kickoff com liderança do cliente
- Levantamento de fluxos operacionais atuais (como funciona hoje)
- Mapeamento de pontos de resistência e aderência
- Inventário de dados existentes a serem migrados
- Definição de escopo de módulos da fase 1
- Definição de cronograma detalhado com marcos e responsáveis
- Identificação de usuários-chave (champions locais)

**Critério de conclusão:** Plano de Implantação assinado por ambas as partes.

---

### Fase 2 — Configuração e Carga de Dados

**Duração:** 1–2 semanas  
**Responsável:** Diretor de Infraestrutura + Analista de Suporte

**Atividades:**
- Carga de dados cadastrais (pacientes, profissionais, unidades, equipes)
- Configuração de módulos ativos, permissões e perfis de acesso
- Configuração de fluxos específicos do cliente
- Configuração de parâmetros regionais e locais
- Validação de integridade dos dados carregados
- Testes internos de funcionamento

**Critério de conclusão:** Dados validados, ambiente funcionando conforme especificação.

---

### Fase 3 — Treinamento

**Duração:** 1–2 semanas  
**Responsável:** Consultora Técnica em Saúde + Analista de Suporte

**Atividades:**
- Treinamento por perfil de usuário (ver onboarding-clientes.md)
- Simulação de fluxos reais com casos fictícios
- Avaliação de assimilação dos treinamentos
- Identificação de usuários com dificuldades para reforço
- Orientação dos champions locais (multiplicadores internos)

**Critério de conclusão:** ≥ 85% dos usuários-alvo concluíram treinamento com avaliação satisfatória.

---

### Fase 4 — Operação em UAT (User Acceptance Testing)

**Duração:** 1–2 semanas  
**Responsável:** CEO + Saúde + Suporte

**Atividades:**
- Operação com dados reais em ambiente de homologação
- Usuários executam suas rotinas reais na plataforma
- Equipe da [NOME_DA_EMPRESA] acompanha e documenta fricções
- Ajustes de configuração baseados na operação real
- Validação dos fluxos assistenciais pela Consultora Técnica
- Coleta de feedback sistematizado dos usuários

**Critério de conclusão:** Termo de Aceite de Homologação assinado pelo responsável do cliente.

---

### Fase 5 — Go-Live e Estabilização

**Duração:** 4–6 semanas (2 de go-live intensivo + 4 de monitoramento)  
**Responsável:** Toda a equipe

**Semanas 1–2 (Go-Live intensivo):**
- Entrada em produção
- Suporte dedicado com atendimento prioritário
- Monitoramento intensivo de performance e erros
- Reunião diária de acompanhamento (interno)

**Semanas 3–6 (Estabilização):**
- Operação normal com monitoramento especial
- Reunião semanal de acompanhamento com o cliente
- Métricas de adoção e uso acompanhadas semanalmente
- Ajustes finos de configuração e UX

**Critério de conclusão:** 30 dias de operação estável, taxa de adoção ≥ 80%, nenhum incidente crítico em aberto.

---

## 3. Pré-requisitos do Cliente

Para garantir o sucesso da implantação, o cliente deve assegurar:

| Pré-requisito | Detalhe |
|--------------|---------|
| Ponto focal designado | Coordenador de implantação com autoridade para decidir sobre configurações locais |
| Equipe disponível para treinamento | Agenda bloqueada para participação nos treinamentos |
| Conectividade à internet | Conexão de banda larga nas unidades de atendimento |
| Dados cadastrais organizados | Lista de pacientes, profissionais e unidades em formato padronizado |
| Infraestrutura de acesso | Dispositivos (computadores, tablets) para os usuários finais |
| Comprometimento da liderança | Apoio ativo do Secretário de Saúde ao processo de mudança |

---

## 4. Gestão de Riscos da Implantação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Resistência dos usuários | Médio | Alto | Engajamento dos champions, treinamento adaptado, presença intensiva |
| Dados cadastrais inconsistentes | Alto | Médio | Carga progressiva, validação antes da migração |
| Indisponibilidade de internet no cliente | Médio | Alto | Verificação de infraestrutura na Fase 0, plano alternativo |
| Rotatividade de usuários-chave | Médio | Médio | Treinamento de múltiplos champions, base de conhecimento robusta |
| Escopo creep (cliente quer mais do combinado) | Alto | Médio | Plano de implantação assinado, gestão de expectativas ativa |
| Não-disponibilidade da equipe do cliente | Médio | Alto | Cronograma com folgas, comprometimento formal antes do kickoff |

---

## 5. Implantação em Múltiplas Unidades

Para clientes com rede de unidades de saúde, a implantação segue modelo progressivo:

1. **Unidade piloto:** uma unidade de menor complexidade e maior abertura à mudança
2. **Validação e ajustes:** 2–4 semanas de operação na unidade piloto
3. **Replicação escalonada:** expansão para demais unidades em ondas de 2–5 unidades
4. **Go-live de rede:** toda a rede em operação, com suporte centralizado

Esta abordagem reduz risco, gera aprendizados na unidade piloto e cria referências internas (champions) antes da expansão.

---

## 6. Critérios de Aceite Final

A implantação é considerada concluída quando:

- [ ] Todas as unidades previstas em produção
- [ ] 100% dos módulos contratados funcionando conforme especificação
- [ ] Toda a equipe-alvo treinada
- [ ] Termo de Aceite de Homologação assinado
- [ ] Suporte regular ativado (transição para operação normal)
- [ ] Relatório de implantação entregue ao cliente
- [ ] Taxa de adoção ≥ 80% após 30 dias de produção

---

*[NOME_DA_EMPRESA] · [NOME_FINAL_DO_PRODUTO] · Metodologia de Implantação v1.0*  
*Classificação: Interno — Operacional · Maio de 2026*
