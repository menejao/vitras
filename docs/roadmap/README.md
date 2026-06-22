# VITRAS APS — Roadmap

**Atualizado:** 2026-06-22  
**Gate obrigatório:** GOV-01 (ver `docs/governanca/06-gov-01-product-scope-governance.md`)

---

## Regra de entrada

Nenhuma funcionalidade entra no roadmap ativo sem parecer GOV-01.

O resultado do gate determina a faixa:

| GOV-01 | Faixa |
|---|---|
| GO | Sprint atual |
| GO WITH LIMITS | Sprint atual com escopo restrito |
| BACKLOG | Backlog priorizado |
| NO GO | Rejeitado — não entra |

---

## Entregues (junho 2026)

| ID | Título | Status |
|---|---|---|
| APS-01A | ACS Workspace — estrutura base | PASS |
| APS-01B | Tarefas e Agenda ACS | PASS |
| APS-01C | Visitas ACS com persistência real | PASS |
| APS-01D | Grupo Familiar Workspace | PASS |
| APS-01E | Busca Ativa Inteligente (score 0–100, 8 regras) | PASS |
| APS-01F | Produção ACS Automática (4 APIs, dashboards) | PASS |
| GOV-01 | Product Scope Governance Gate | ATIVO |
| INTEGRATION-GOV-01A | Governança Nacional de Ingestão de Dados | ATIVO |
| HOMOLOG-01 | Critérios Nacionais de Homologação de UBS | ATIVO |
| ARCH-DOC-01 | Registro de Regras de Negócio e Dicionário Nacional de Dados | ATIVO |
| ARCH-DOC-02 | Documentação Funcional por Página (escopo, campos, regras, navegação) | ATIVO |

---

## Próximo candidato (sujeito a GOV-01)

### APS-02A — Territorialização Inteligente

**Proposta:** Transformar microáreas em entidades operacionais completas.

**GOV-01 pendente:** Sim — não entra antes de parecer completo.

**Hipótese de valor:** ACS e gestores hoje não conseguem visualizar distribuição de grupos familiares por microárea nem balancear carga entre ACS. A infraestrutura de microárea já existe via `GET /production/microareas` (APS-01F).

**Perguntas abertas (Business Analyst deve responder antes de GOV-01):**

1. Gestores realmente gerenciam microáreas hoje? Como?
2. O desequilíbrio de carga entre ACS é um problema confirmado no campo?
3. Isso é necessário antes do piloto ou pode esperar observação real?

**Bloqueios potenciais identificados:**

- Se exigir geolocalização/mapa: NO GO até piloto estável.
- Se exigir nova entidade `microarea`: avaliar reutilização de `familyGroup.microArea`.
- Se for "dashboard territorial bonito sem ação": REDESENHAR.

---

## Backlog congelado (COULD HAVE / WON'T DO NOW)

Os itens abaixo **não entram** antes do piloto sem novo parecer GOV-01:

- Mapa territorial com polígonos de microárea
- Integração RNDS
- App nativo mobile (PWA já cobre campo)
- Relatórios PDF complexos
- Dashboards epidemiológicos avançados
- Integrações com sistemas externos além de e-SUS/CDS (processo definido em `docs/governanca/07-integration-gov-01.md`)
- Gamificação / indicadores de performance individual
- Módulo de gestão de medicamentos ACS
- Agenda para ACS (ACS não tem agenda clínica)

---

## Critérios de saída do backlog

Um item sai do backlog congelado quando:

1. Piloto real completar 30 dias de operação.
2. Usuário real (ACS, enfermeiro ou gestor) reportar essa dor explicitamente.
3. GOV-01 for aplicado e resultar em GO ou GO WITH LIMITS.

---

## Compromissos antes do piloto

Antes do primeiro município em operação real, o time deve:

- [ ] Completar homologação com PEC em ambiente real
- [ ] Realizar treinamento mínimo com ACS e enfermeiros
- [ ] Confirmar que CDS Export funciona com dados reais
- [ ] Validar LGPD (DPA assinado, privacidade operacional)
- [ ] Executar smoke completo em staging com dados reais (não seed)
- [ ] Documentar fluxo de suporte operacional para incidentes

Nenhuma nova funcionalidade entra enquanto estes itens estiverem abertos.
