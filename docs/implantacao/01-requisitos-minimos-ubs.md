# 01 — Requisitos Mínimos da UBS

**Versão:** 1.0 | **Produto:** VITRAS APS | **Aplicação:** qualquer UBS do Brasil

---

## Princípio

Cada implantação é local. O produto é nacional.

Nenhum dado desta lista é fixo no código.  
Todos os campos abaixo são parâmetros de configuração da implantação.

---

## Checklist de Requisitos

### A — Dados do Município

| # | Item | Obrigatoriedade | Responsável | Status |
|---|------|----------------|-------------|--------|
| A1 | Nome do município | **Antes da homologação** | Delivery Governor | [ ] |
| A2 | UF | **Antes da homologação** | Delivery Governor | [ ] |
| A3 | Código IBGE — 7 dígitos (ex: `2304400` = Fortaleza) | **Antes da homologação** | Delivery Governor | [ ] |
| A4 | Secretaria Municipal de Saúde — nome e contato | Antes do go-live | Delivery Governor | [ ] |
| A5 | Responsável TI da prefeitura — nome, celular, e-mail | Antes do go-live | Delivery Governor | [ ] |

> **Como obter código IBGE:** [ibge.gov.br/cidades-e-estados](https://www.ibge.gov.br/cidades-e-estados)

---

### B — Dados da UBS

| # | Item | Obrigatoriedade | Responsável | Status |
|---|------|----------------|-------------|--------|
| B1 | Nome completo da UBS | **Antes da homologação** | Business Analyst | [ ] |
| B2 | CNES da UBS — 7 dígitos | **Antes da homologação** | Business Analyst | [ ] |
| B3 | Endereço completo | Antes do go-live | Business Analyst | [ ] |
| B4 | Telefone da UBS | Antes do go-live | Business Analyst | [ ] |

> **Como obter CNES:** [cnes.datasus.gov.br](http://cnes.datasus.gov.br) → pesquisar pela UBS

---

### C — Equipes de Saúde

| # | Item | Obrigatoriedade | Responsável | Status |
|---|------|----------------|-------------|--------|
| C1 | Número de equipes | **Antes da homologação** | APS Specialist | [ ] |
| C2 | INE de cada equipe — 10 dígitos | **Antes da homologação** | APS Specialist | [ ] |
| C3 | Nome de cada equipe | **Antes da homologação** | APS Specialist | [ ] |
| C4 | Tipo de equipe (eSF, eAP, EMAD, etc.) | Antes do go-live | APS Specialist | [ ] |
| C5 | Microáreas por equipe (lista) | Opcional | APS Specialist | [ ] |

> **Como obter INE:** Sistema CNES → equipe de saúde → código INE da equipe selecionada

---

### D — Profissionais

| # | Item | Obrigatoriedade | Responsável | Status |
|---|------|----------------|-------------|--------|
| D1 | Gestor responsável — nome completo, e-mail, CRM/COREN, UF | **Antes da homologação** | Delivery Governor | [ ] |
| D2 | Lista de enfermeiros — nome, e-mail, COREN, UF, equipe | **Antes da homologação** | Delivery Governor | [ ] |
| D3 | Lista de ACS — nome, e-mail, microárea, equipe | **Antes da homologação** | Delivery Governor | [ ] |
| D4 | Lista de médicos (se houver) — nome, e-mail, CRM, UF | Antes do go-live | Delivery Governor | [ ] |
| D5 | CNS profissional de cada ACS/enfermeiro — 15 dígitos | **Antes da homologação CDS** | APS Specialist | [ ] |
| D6 | CBO de cada profissional (ACS = 516220; Enfermeiro = 223505) | **Antes da homologação CDS** | APS Specialist | [ ] |

> **Como obter CNS profissional:** CADSUS/e-SUS → cadastro do profissional → CNS

---

### E — Governança e LGPD

| # | Item | Obrigatoriedade | Responsável | Status |
|---|------|----------------|-------------|--------|
| E1 | DPO/Encarregado LGPD — nome, e-mail, celular | **Antes do go-live** | Security/LGPD Lead | [ ] |
| E2 | DPA (contrato de responsabilidade compartilhada) assinado | **Antes do go-live** | Security/LGPD Lead | [ ] |
| E3 | Política de privacidade local aprovada | Antes do go-live | Security/LGPD Lead | [ ] |
| E4 | Processo de notificação de incidente documentado | Antes do go-live | Security/LGPD Lead | [ ] |

---

### F — Infraestrutura e-SUS

| # | Item | Obrigatoriedade | Responsável | Status |
|---|------|----------------|-------------|--------|
| F1 | Versão do PEC instalado na UBS | **Antes da homologação CDS** | Tech Lead | [ ] |
| F2 | PEC ≥ 5.4.36 confirmado | **Obrigatório para CDS Export** | Tech Lead | [ ] |
| F3 | Acesso ao PEC (URL, credencial de teste) | Antes da homologação CDS | Tech Lead | [ ] |
| F4 | Canal de suporte técnico definido (ex: WhatsApp, e-mail) | Antes do go-live | Delivery Governor | [ ] |

> **Se PEC < 5.4.36:** não ativar CDS Export. Escalar atualização do PEC junto à SMS antes do go-live.

---

### G — Canal de Suporte

| # | Item | Obrigatoriedade | Responsável | Status |
|---|------|----------------|-------------|--------|
| G1 | Contato técnico VITRAS — nome, celular, e-mail | **Antes do go-live** | Delivery Governor | [ ] |
| G2 | Horário de suporte definido | Antes do go-live | Delivery Governor | [ ] |
| G3 | Procedimento P0 (indisponibilidade total) documentado | Antes do go-live | Delivery Governor | [ ] |
| G4 | Procedimento P1 (falha funcional crítica) documentado | Antes do go-live | Delivery Governor | [ ] |

---

## Resumo de Obrigatoriedade

| Quando | Itens obrigatórios |
|--------|--------------------|
| **Antes de iniciar homologação** | A1, A2, A3, B1, B2, C1, C2, C3, D1, D2, D3 |
| **Antes da homologação CDS** | D5, D6, F1, F2, F3 |
| **Antes do go-live** | Todos os obrigatórios + E1, E2, E3, E4, F4, G1, G2, G3, G4 |
| **Opcional** | A4 em alguns municípios, C5 |
