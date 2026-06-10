# QA + Tech Lead — Release Flow (Fluxo de Prontidão para GO)

Workflow obrigatório antes de qualquer GO em ambiente real do Vitras.
Define a ordem de atuação, responsabilidades e formato do relatório final.

---

## Agents envolvidos

| Agent | Arquivo | Papel no fluxo |
|-------|---------|----------------|
| QA Sênior Ops | `.claude/agents/qa-senior.md` | Testa, evidencia, classifica riscos |
| Tech Lead Dev Sênior | `.claude/agents/tech-lead-dev-senior.md` | Analisa achados, decide, prioriza, emite GO/NO-GO |

---

## Ordem correta de execução

```
1. QA Sênior executa primeiro
   ↓
2. QA entrega relatório com: achados, evidências, riscos, gaps
   ↓
3. Tech Lead analisa os achados do QA
   ↓
4. Tech Lead decide: prioridade, arquitetura, correção, caminho de rollout
   ↓
5. Convergência: ambos confirmam blockers reais e não-blockers
   ↓
6. Decisão final: GO / GO CONDICIONADO / NO-GO
```

**QA não corrige. QA testa e evidencia.**
**Tech Lead não ignora QA. Tech Lead prioriza e decide.**
**Nenhum GO sem evidência.**

---

## Quando usar este fluxo

Obrigatório antes de:

- GO FINAL UBS #1 (e qualquer UBS subsequente)
- Deploy em ambiente real (prod, staging com dados reais)
- Smoke test final pré-go-live
- Teste de carga ou simulação de tráfego real
- Mudança em infraestrutura EB (env vars, health check, plataforma)
- Mudança em autenticação, RBAC, multi-tenant ou audit logs
- Mudança em pacientes, agendamento, fila ou prontuário
- Rollback de código ou restore de banco
- Mudança em CloudWatch, alarmes ou observabilidade
- Qualquer alteração que afete isolamento de dados entre equipes/unidades

---

## Responsabilidades por papel

### QA Sênior Ops
- Testa o ambiente real (não apenas o código)
- Simula perfis distintos: gestor, médico, ACS, recepcionista, breakglass
- Confirma fluxos clínicos funcionando end-to-end
- Valida isolamento multi-tenant com usuários reais
- Testa caminhos de erro (sem token, token adulterado, payload inválido)
- Verifica audit log, CPF mascarado, CSRF, rate limit
- Classifica cada achado por severidade (bloqueador → baixo)
- Entrega evidência — não opinião

### Tech Lead Dev Sênior
- Lê o relatório do QA antes de agir
- Identifica causa raiz de cada achado
- Separa blocker real de melhoria futura
- Decide se um achado impede o GO ou pode ser aceito como risco
- Propõe patch mínimo e seguro para blockers
- Valida /readyz e /health após qualquer mudança
- Emite parecer técnico de GO/NO-GO com justificativa

---

## Formato do relatório final

O relatório de convergência QA + Tech Lead deve ter exatamente estas seções:

### 1. Parecer do QA Sênior
O que foi testado, com que perfis, em que ambiente.
Lista de achados com severidade e evidência.
Cobertura obtida vs gaps identificados.

### 2. Parecer do Tech Lead
Interpretação técnica dos achados do QA.
Causa raiz de cada falha relevante.
Avaliação de coerência arquitetural e estado da infraestrutura.

### 3. Convergência entre os dois
Itens em que QA e Tech Lead concordam.
Itens em que há divergência (e qual prevalece, com justificativa).

### 4. Blockers reais
Somente itens que impedem o GO. Cada um com:
- descrição clara
- impacto se ignorado
- ação necessária
- responsável
- estimativa de esforço

### 5. Não-blockers
Itens identificados mas aceitos para este ciclo.
Cada um com: por quê não bloqueia agora + quando resolver.

### 6. Riscos críticos
Riscos de exposição de dados, falha de isolamento, auth bypass ou perda de dados.
Mesmo que não sejam blockers ativos, devem ser registrados.

### 7. Riscos altos
Falhas em fluxo clínico, permissão incorreta, degradação operacional.
Com plano de mitigação ou monitoramento.

### 8. Próximo passo recomendado
Uma ação concreta e executável. Não uma lista de dez coisas.
Quem faz, o que faz, quando faz, como valida.

### 9. Checklist mínima antes do GO
Itens binários (sim/não). Sem ambiguidade.
Cada item com responsável.

### 10. Decisão final
```
GO            — todos os blockers fechados, evidência coletada
GO CONDICIONADO — blockers fechados, riscos aceitos formalmente com mitigação
NO-GO         — blocker real sem solução ou sem evidência de resolução
```
A decisão deve citar quais critérios foram atendidos e quais não foram.

---

## Regras do fluxo

- QA executa primeiro, sempre
- Tech Lead não emite GO/NO-GO sem relatório do QA
- Blocker ≠ melhoria futura — separar explicitamente
- Evidência > opinião: HTTP status, curl output, JSON de resposta
- Não aprovar sem testar — nem revisar código nem ler doc substitui teste real
- Conservadorismo: em caso de dúvida, documentar o risco e agendar reteste
- Contexto: objetivo é piloto governado UBS #1, não produção nacional ampla
- Time pequeno: não criar processos que o time não consegue manter
- GovTech e saúde pública: erros de fluxo ou isolamento podem cancelar o piloto

---

## Critérios de GO para UBS #1

GO FINAL exige todos os itens abaixo como evidência real (não código auditado):

| # | Critério | Evidência mínima |
|---|----------|-----------------|
| 1 | /readyz HTTP 200 | curl output |
| 2 | postgres=ok, migrations=ok em /health | curl output |
| 3 | Login breakglass operacional | JWT com role=break_glass_admin |
| 4 | Unauthenticated → 401 em todas as rotas protegidas | curl sem token |
| 5 | CPF mascarado na resposta de /patients | campo cpf = ***.***.***-** |
| 6 | JWT adulterado → 401 | curl com assinatura inválida |
| 7 | Audit log registrando eventos de login e acesso | GET /audit-logs com itens |
| 8 | Isolamento multi-tenant: ACS equipe A não acessa paciente equipe B | curl com token ACS → 403 |
| 9 | Fluxo clínico mínimo: criar paciente + agendamento + audit entry | curl POST → 201 |
| 10 | CloudWatch recebendo logs da aplicação | log group com eventos |
| 11 | contatos.md preenchido | revisão manual |
| 12 | aceite-operacional.md assinado | assinaturas físicas |
| 13 | Tabletop executado com equipe (score ≥ 3/5) | tabletop-final-report.md |
| 14 | DR drill: RTO ≤ 240 min confirmado | dr-drill-final-report.md |

---

## Referências

Agentes:
- `.claude/agents/qa-senior.md`
- `.claude/agents/tech-lead-dev-senior.md`
- `.claude/agents/vitras-qa-senior.md` (QA de desenvolvimento)
- `.claude/agents/vitras-tech-lead.md` (Tech Lead de desenvolvimento)

Documentos de suporte:
- `docs/rollout/ubs-001/go-final-readiness-report.md`
- `docs/rollout/ubs-001/bo-03-tabletop-agenda.md`
- `docs/rollout/ubs-001/bo-04-dr-drill-execution.md`
- `docs/runbooks/eb-secrets-audit.md`
- `docs/runbooks/eb-deploy-reproducibility.md`
- `docs/operations/incident-response.md`
