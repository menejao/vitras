# 08 — Pós Go-Live

**Versão:** 1.0 | **Produto:** VITRAS APS | **Aplicação:** qualquer UBS do Brasil

---

## Princípio

Os primeiros 30 dias são críticos para detectar problemas de uso real que testes em staging não antecipam.

O acompanhamento pós go-live não é opcional.

---

## Estrutura de Acompanhamento

| Marco | Foco | Responsável |
|-------|------|-------------|
| D+1 | Estabilidade técnica + primeiros erros | Tech Lead + QA Senior |
| D+7 | Adoção real + erros de uso + CDS | APS Specialist + Training Lead |
| D+30 | Operação sustentável + indicadores + roadmap | Delivery Governor + todos |

---

## D+1 — Relatório de Primeiro Dia

**Data:** ______  
**UBS:** ______

### Métricas Técnicas

| Métrica | Valor | Normal? |
|---------|-------|---------|
| `/health` status | | [ ] |
| Erros 5xx (CloudWatch) | | [ ] |
| Erros 4xx (CloudWatch) | | [ ] |
| Tentativas de login | | [ ] |
| Taxa de erro de login | | [ ] |
| Rate limit hits | | [ ] |
| Latência média (ms) | | [ ] |

### Atividade Clínica

| Atividade | Quantidade |
|-----------|-----------|
| Logins bem-sucedidos | |
| Pacientes acessados | |
| Cadastros individuais criados | |
| Cadastros domiciliares criados | |
| Visitas ACS registradas | |
| Arquivos CDS exportados | |
| Erros de importação CDS no PEC | |

### Erros e Incidentes D+1

| # | Descrição | Severidade | Status |
|---|-----------|-----------|--------|
| | | | |

### Ações Necessárias D+1

| # | Ação | Responsável | Prazo |
|---|------|-------------|-------|
| | | | |

---

## D+7 — Relatório de Primeira Semana

**Data:** ______  
**UBS:** ______

### Adoção

| Indicador | D+1 | D+7 | Tendência |
|-----------|-----|-----|-----------|
| ACS usando o sistema | | | |
| Visitas registradas | | | |
| Cadastros criados | | | |
| CDS exportados e importados no PEC | | | |

### Dúvidas Recorrentes dos Usuários

| Dúvida | Frequência | Ação |
|--------|-----------|------|
| | | |

### Erros de Importação CDS (se houver)

| Ficha | Erro PEC | Causa | Correção |
|-------|----------|-------|---------|
| | | | |

### Incidentes LGPD (se houver)

| # | Descrição | Titular afetado? | DPO notificado? | ANPD notificada? |
|---|-----------|-----------------|----------------|-----------------|
| | | | | |

### Feedback ACS

Coletar via formulário ou entrevista rápida (5 min por ACS):

- O que funcionou bem?
- O que foi difícil ou confuso?
- Qual funcionalidade mais precisou?
- Qual funcionalidade não usou ou não entendeu?

### Feedback Enfermeiro / Gestor

- Dashboard de produção está claro?
- CDS Export está funcionando sem erros?
- Alguma dificuldade na gestão de usuários?

### Ações Necessárias D+7

| # | Ação | Responsável | Prazo |
|---|------|-------------|-------|
| | | | |

---

## D+30 — Relatório de Primeiro Mês

**Data:** ______  
**UBS:** ______

### Indicadores de Operação Sustentável

| Indicador | Meta | Real | Status |
|-----------|------|------|--------|
| % ACS usando o sistema semanalmente | ≥ 80% | | |
| Visitas registradas no VITRAS vs. total relatado | ≥ 70% | | |
| Fichas CDS exportadas sem erro no PEC | ≥ 90% | | |
| Incidentes P0 | 0 | | |
| Incidentes P1 | ≤ 2 | | |
| Tickets/dúvidas resolvidos em ≤ 24h | ≥ 95% | | |

### Performance Técnica

| Métrica | Alvo | Real | Status |
|---------|------|------|--------|
| Uptime `/readyz` | ≥ 99,5% | | |
| Latência P95 | ≤ 800ms | | |
| Erros 5xx | ≤ 0,1% | | |

### Erros e Incidentes D+30 (consolidado)

| # | Descrição | Data | Severidade | Resolvido? |
|---|-----------|------|-----------|------------|
| | | | | |

### Rejeições CDS no PEC (consolidado)

| Tipo de ficha | Total exportados | Total importados OK | Taxa de rejeição |
|---------------|-----------------|--------------------|--------------------|
| Cadastro Individual | | | |
| Cadastro Domiciliar | | | |
| Visita Domiciliar | | | |
| Atendimento Individual | | | |

### Incidentes LGPD (consolidado)

| # | Tipo | Data | Titular afetado? | Resolvido? |
|---|------|------|-----------------|------------|
| | | | | |

### Feedback Consolidado

**Principais elogios:**
- 

**Principais problemas relatados:**
- 

**Funcionalidades mais usadas:**
- 

**Funcionalidades não usadas ou desconhecidas:**
- 

### Avaliação de Necessidade de Treinamento Adicional

| Grupo | Necessidade de reforço | Tema |
|-------|----------------------|------|
| ACS | [ ] SIM / [ ] NÃO | |
| Enfermeiro | [ ] SIM / [ ] NÃO | |
| Gestor | [ ] SIM / [ ] NÃO | |

---

## Critério de Operação Sustentável

A UBS é considerada em **operação sustentável** quando, ao D+30:

- [ ] Nenhum incidente P0 nos últimos 7 dias
- [ ] Taxa de uso ACS ≥ 80%
- [ ] Taxa CDS OK ≥ 90%
- [ ] Nenhuma pendência LGPD crítica aberta
- [ ] Equipe opera sem suporte ativo diário do VITRAS

---

## Transição para Suporte Padrão

Após D+30 em operação sustentável:

| Item | Ação |
|------|------|
| Canal de suporte | Mover de suporte intensivo para SLA normal |
| Rotinas operacionais | Ativar rotina semanal (doc `docs/governanca/02-rotina-semanal-0800.md`) |
| Auditoria mensal | Ativar rotina mensal (doc `docs/governanca/05-rotina-mensal-auditoria.md`) |
| Próxima implantação | Feedback desta UBS alimenta playbook para a próxima |

---

**Assinatura do Delivery Governor:**  
Data: ______  
Status operacional: ______  
Observações finais: ______
