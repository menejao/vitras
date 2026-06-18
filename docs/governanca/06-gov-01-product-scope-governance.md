# GOV-01 — Product Scope Governance Gate

**Status:** ATIVO  
**Vigência:** A partir de 2026-06-18  
**Aplicação:** Obrigatório antes de qualquer nova funcionalidade, sprint ou épica

---

## 1. Objetivo

Impedir crescimento artificial do escopo do VITRAS APS.

Toda funcionalidade deve resolver um problema operacional real da Atenção Primária.

"Legal de ter" não é critério de entrada.

---

## 2. Contexto

O VITRAS APS entregou até junho de 2026:

- CDS Export (e-SUS)
- LGPD mínima operacional
- Cadastro Individual e Domiciliar (ACS)
- Grupo Familiar Workspace (APS-01D)
- Visitas ACS com persistência real (APS-01C)
- Busca Ativa Inteligente com score 0–100 (APS-01E)
- Produção automática ACS/Enfermeiro/Gestor (APS-01F)

A partir deste ponto existe risco real de escopo inflado antes do piloto.

Este gate é a barreira.

---

## 3. Papéis obrigatórios

Todo novo sprint deve ter parecer dos cinco papéis abaixo.

Nenhum sprint avança sem todos os pareceres.

| Papel | Responsabilidade |
|---|---|
| Business Analyst | Valida o problema real |
| Product Designer | Valida a experiência operacional |
| Tech Lead | Valida a viabilidade e dívida técnica |
| QA Senior | Valida testabilidade e regressão |
| Delivery Governor | Classifica prioridade e libera ou bloqueia |

---

## 4. Perguntas obrigatórias

### 4.1 Business Analyst

1. Qual problema real da APS essa funcionalidade resolve?
2. Quem usa? (ACS / enfermeiro / gestor / paciente)
3. Em que momento do dia usa?
4. Como isso é feito hoje sem o VITRAS?
5. Existe evidência de que isso é dor real? (relato de campo, observação, dado)
6. Essa funcionalidade é necessária para o piloto ou pode esperar?

**Se não houver resposta clara para todos: NO GO.**

### 4.2 Product Designer

1. Reduz cliques?
2. Reduz retrabalho?
3. Reduz erro operacional?
4. Reduz necessidade de treinamento?
5. Funciona bem em celular de campo (360–412px, conexão instável)?
6. Melhora o trabalho do ACS, enfermeiro ou gestor de forma mensurável?

**Se não melhorar a operação real: REDESENHAR ou NO GO.**

### 4.3 Tech Lead

1. Dá para reutilizar algo existente?
2. Exige nova entidade no banco?
3. Exige nova tabela?
4. Exige nova permissão no RBAC?
5. Aumenta dívida técnica?
6. Pode quebrar CDS Export, LGPD, RBAC ou cadeia de auditoria?

**Regra de decisão: reusar > adaptar > criar.**

Nova entidade só com justificativa técnica forte.

### 4.4 QA Senior

1. Como testar em ambiente de staging?
2. Qual regressão pode causar nos fluxos existentes?
3. Quais fluxos existentes toca? (listar por nome)
4. Que evidência concreta prova que funciona? (teste, smoke, validação)
5. Existe risco mobile (360px, offline parcial)?
6. Existe risco LGPD (dados pessoais expostos, novo campo sensível)?

**Sem plano de teste definido: NO GO.**

### 4.5 Delivery Governor

Classificar a funcionalidade em:

| Classe | Significado |
|---|---|
| **MUST HAVE** | Necessária para piloto ou operação básica |
| **SHOULD HAVE** | Agrega valor real mas não bloqueia piloto |
| **COULD HAVE** | Útil mas dispensável por longo prazo |
| **WON'T DO NOW** | Rejeitado neste ciclo |

**Somente MUST HAVE entra no sprint atual.**

SHOULD HAVE vai para backlog priorizado.

COULD HAVE fica congelado sem data.

WON'T DO NOW é formalmente rejeitado.

---

## 5. Critérios de aprovação (todos obrigatórios)

Uma funcionalidade só avança se cumprir todos os dez:

1. Resolve problema operacional real — não hipotético.
2. Tem usuário claro e identificado.
3. Tem frequência de uso definida (diária / semanal / mensal).
4. É necessária para piloto ou para operação básica da APS.
5. Reutiliza estrutura existente sempre que possível.
6. Não cria complexidade desnecessária no sistema.
7. Tem plano de teste definido antes de entrar em sprint.
8. Não compromete LGPD, CDS Export, RBAC ou cadeia de auditoria.
9. Funciona em mobile quando envolver ACS em campo.
10. Tem critério de sucesso mensurável (o que muda quando funcionar?).

---

## 6. Critérios de bloqueio imediato

Bloquear sem discussão se a proposta:

- for descrita como "legal de ter" ou "nice to have"
- for dashboard sem ação operacional resultante
- criar entidade nova sem necessidade técnica clara
- depender de mapa / geolocalização sem validação real em campo
- exigir app nativo antes do piloto web estar estável
- exigir offline-first sem infraestrutura validada
- duplicar funcionalidade já existente no sistema
- aumentar escopo antes do primeiro município piloto
- usar linguagem "vamos aproveitar e adicionar..."
- não tiver usuário claro e nomeado

---

## 7. Regra especial: antes do primeiro piloto

Enquanto o primeiro município piloto não estiver operando em produção real:

**Priorizar apenas:**

- Correção de bugs que bloqueiam operação
- Melhoria de fluxos ACS identificados em campo
- Estabilização técnica do piloto
- Treinamento mínimo operacional
- Homologação com PEC quando houver ambiente real

**Evitar:**

- Grandes dashboards novos
- Mapa territorial ou geolocalização
- Novas integrações com sistemas externos
- Inteligência avançada ou algoritmos novos
- Relatórios complexos ou exportações adicionais
- Módulos completamente novos

---

## 8. Saída obrigatória (formato)

Para cada nova proposta, o Delivery Governor deve emitir:

```
GOV-01 RESULT

Proposta: [nome da funcionalidade]
Data: [YYYY-MM-DD]

Status: GO | GO WITH LIMITS | BACKLOG | NO GO

Justificativa:
[texto]

Escopo permitido:
- [item]

Escopo proibido neste ciclo:
- [item]

Riscos identificados:
- [risco]

Próximo passo:
[ação concreta]
```

---

## 9. Aplicação

Este gate é permanente.

Não tem exceções por urgência sem parecer formal.

Não tem "aprovação informal".

Qualquer sprint que avance sem GOV-01 deve ser bloqueado no review.

---

## 10. Histórico

| Data | Evento |
|---|---|
| 2026-06-18 | GOV-01 criado após entrega de APS-01A a APS-01F |
