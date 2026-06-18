# Pilot Success Criteria — VITRAS APS

**Versão:** 1.0  
**Data:** 2026-06-18  
**Escopo:** critérios objetivos de encerramento do piloto municipal

---

## Horizonte do Piloto

**Duração esperada:** 30 dias corridos a partir da ativação da UBS  
**Revisão de meados:** Dia 15  
**Avaliação final:** Dia 30  

---

## 1. Critérios de Sucesso — Obrigatórios (Gate de Encerramento)

Todos os critérios abaixo devem ser atendidos para o piloto ser declarado APROVADO.

### 1.1 Usuários e Adoção

| Critério | Meta | Medição |
|----------|------|---------|
| Profissionais com primeiro acesso realizado | 100% dos usuários criados | /admin — usuários com last_login != null |
| Profissionais ativos no último ciclo de 7 dias | >= 80% | Audit log — logins distintos |
| Zero chamados de "não consigo entrar" abertos sem resolução | 0 | Canal de suporte |

### 1.2 Cadastros

| Critério | Meta | Medição |
|----------|------|---------|
| Cadastros Individuais criados | >= 50 pacientes reais | COUNT(patients) |
| Cadastros Domiciliares associados | >= 20 domicílios | COUNT(households) |
| Taxa de preenchimento de CNS | >= 60% dos pacientes | patients com cnsCidadao != null |
| Nome social preenchido quando aplicável | 100% dos casos identificados | Auditoria amostral |

### 1.3 Atendimentos

| Critério | Meta | Medição |
|----------|------|---------|
| Atendimentos registrados | >= 100 registros clínicos | COUNT(records) |
| Atendimentos com CID/CIAP informado | >= 50% | Records com cid10 ou ciap2 |
| Médico realizou pelo menos 1 atendimento completo | Sim | records filtrados por doctor |
| Enfermeiro realizou pelo menos 1 protocolo | Sim | records filtrados por nurse_manager |

### 1.4 CDS Export e Integração PEC

| Critério | Meta | Medição |
|----------|------|---------|
| Sessão de homologação PEC realizada | >= 1 sessão PASS | evidence-package preenchido |
| Exportações .esus geradas sem erro | >= 3 exports bem-sucedidos | logs CDS export |
| Importação PEC sem divergência de contagem | 0 divergências | evidence package |
| Nome social preservado no PEC | Confirmado | evidência screenshot |

### 1.5 Segurança e Auditoria

| Critério | Meta | Medição |
|----------|------|---------|
| Zero incidentes SEV1 | 0 | Canal de suporte + runbook |
| Audit log populando sem interrupção | 100% do período | audit_logs — sem gaps de 24h+ |
| Hash chain sem falha de integridade | 0 falhas | AUD-01 check |
| Nenhuma credencial exposta ou compartilhada | 0 | Relato dos usuários |

---

## 2. Critérios de Sucesso — Desejáveis

Indicadores que demonstram maturidade, mas não bloqueiam aprovação.

| Critério | Meta |
|----------|------|
| ACS registrou tarefas de visita domiciliar | >= 10 tarefas |
| Recepção usou fila de espera ativamente | >= 20 tickets de fila |
| Encaminhamentos registrados | >= 5 referrals |
| Gestor acessou dashboard >= 3 vezes | Sim |
| Feedback positivo de pelo menos 1 profissional por perfil | Sim |
| Farmácia registrou ao menos 1 dispensação | Sim (se módulo ativo) |

---

## 3. Critérios de Falha (No-Go Definitivo)

O piloto é declarado REPROVADO se qualquer dos itens abaixo ocorrer:

| Critério de Falha | Ação |
|-------------------|------|
| Perda de dados de pacientes em produção | Stop imediato + DR Runbook |
| Incidente LGPD com dados reais expostos | Acionar DPO + ANPD |
| Importação PEC sistematicamente falhando | Interromper export, corrigir, re-homologar |
| Adoção < 30% após 15 dias | Revisar treinamento + suporte |
| >= 3 incidentes SEV1 no mês | Revisar prontidão operacional |
| Município solicita suspensão | Iniciar encerramento ordenado |

---

## 4. Processo de Avaliação

### Revisão de Meados (Dia 15)

- Verificar métricas 1.1 e 1.2
- Entrevistar 1 profissional por perfil (5 min cada)
- Ajustar treinamento se adoção < 50%
- Registrar em: `docs/pilot/evidence-dia-15-{municipio}.md`

### Avaliação Final (Dia 30)

- Verificar todos os critérios obrigatórios
- Calcular taxa de sucesso por categoria
- Coletar feedback qualitativo
- Emitir: `docs/pilot/final-report-{municipio}.md`
- Assinar: operador VITRAS + gestor municipal

---

## 5. Declaração de Encerramento

O piloto é encerrado com:

**APROVADO** — todos os critérios obrigatórios atendidos.  
**APROVADO COM RESSALVAS** — critérios obrigatórios atendidos, >= 1 desejável não atingido. Plano de melhoria documentado.  
**REPROVADO** — pelo menos 1 critério obrigatório não atendido. Plano de correção e re-piloto.

---

*VITRAS APS — docs/pilot/success-criteria.md*
