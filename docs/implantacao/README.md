# VITRAS APS — Playbook Oficial de Implantação

**Versão:** 1.0 | **Data:** 2026-06-21  
**Aplicação:** qualquer UBS do Brasil  
**Produto:** VITRAS APS — Sistema de Atenção Primária à Saúde

---

## Princípio Fundamental

O VITRAS APS é um produto **nacional e configurável**.  
Não existe UBS piloto fixa. Cada implantação é local.

```
Produto  = regras nacionais (PNAB, e-SUS, LGPD, LEDI APS 7.4.0)
Implantação = dados locais (CNES, INE, IBGE, profissionais, equipes)
```

Qualquer UBS do Brasil — Manaus, Recife, Porto Alegre, Fortaleza, interior do Piauí — opera com o mesmo produto, apenas configurando seus dados locais.

---

## Visão Geral do Processo

```
Pré-implantação       Homologação          Go-Live         Pós-live
─────────────         ────────────         ───────         ────────
01 Requisitos    →    03 Funcional    →    07 Checklist →  08 D+1/D+7/D+30
02 Configuração  →    04 CDS/e-SUS    →    Decisão GO
                      05 LGPD         →
                      06 Treinamento  →
```

---

## Documentos do Playbook

| # | Documento | Fase | Responsável principal |
|---|-----------|------|-----------------------|
| [01](01-requisitos-minimos-ubs.md) | Requisitos Mínimos da UBS | Pré-implantação | Delivery Governor |
| [02](02-configuracao-tecnica.md) | Configuração Técnica | Pré-implantação | Tech Lead |
| [03](03-roteiro-homologacao-funcional.md) | Roteiro de Homologação Funcional | Homologação | QA Senior |
| [04](04-homologacao-esus-cds.md) | Homologação e-SUS / CDS Export | Homologação | APS Specialist |
| [05](05-lgpd-seguranca.md) | LGPD e Segurança | Homologação | Security/LGPD Lead |
| [06](06-plano-treinamento.md) | Plano de Treinamento | Homologação | Training Lead |
| [07](07-checklist-go-live.md) | Checklist de Go-Live | Go-Live | Delivery Governor |
| [08](08-pos-go-live.md) | Pós Go-Live | Operação | Delivery Governor |

---

## Timeline Típica de Implantação

| Semana | Atividades |
|--------|-----------|
| **S-4** | Coletar dados da UBS (doc 01) — IBGE, CNES, INE, profissionais |
| **S-3** | Configuração técnica (doc 02) — env vars, bootstrap, usuários |
| **S-2** | Homologação funcional (doc 03) + LGPD (doc 05) |
| **S-1** | Homologação CDS (doc 04) + treinamento (doc 06) |
| **S-0** | Checklist go-live (doc 07) → decisão GO/NO GO |
| **D+1** | Acompanhamento D+1 (doc 08) |
| **D+7** | Relatório D+7 (doc 08) |
| **D+30** | Avaliação de sustentabilidade (doc 08) |

---

## Papéis e Responsabilidades

| Papel | Responsabilidade |
|-------|-----------------|
| **Delivery Governor** | Autoriza go-live; emite decisão formal GO/NO GO |
| **Business Analyst** | Coleta dados da UBS; valida requisitos com a SMS |
| **APS Specialist** | Valida fluxos ACS/enfermeiro; homologa CDS |
| **Tech Lead** | Configuração técnica; troubleshooting; migrations |
| **DevOps Lead** | Deploy, ambiente, env vars, CloudWatch |
| **Security/LGPD Lead** | DPA, 2FA, auditoria, resposta a incidente |
| **QA Senior** | Executa roteiro de homologação funcional |
| **Training Lead** | Executa e assina checklists de treinamento |

---

## Critério de Go-Live

**GO** quando:
- Todos os itens do checklist (doc 07) marcados
- Homologação funcional: PASS
- Homologação CDS: PASS ou PASS COM WARNING aceito pelo gestor
- Checklist LGPD: completo
- Todos os treinamentos: aprovados

**NO GO** quando qualquer item obrigatório de GL-A, GL-B, GL-C ou GL-E não estiver completo.

---

## Aderência Nacional

Este playbook é aderente a:

- **PNAB 2017** — Política Nacional de Atenção Básica
- **e-SUS APS LEDI 7.4.0** — protocolo oficial de integração CDS
- **LGPD (Lei 13.709/2018)** — Art. 6, 7, 9, 11, 18, 41
- **CFM 1821/2007** — retenção de prontuário eletrônico (20 anos)
- **RDC ANVISA / MS** — normativas de APS vigentes

---

## Reutilização

Este playbook é reutilizável por implantação.

Para cada nova UBS, criar um diretório:

```
docs/rollout/[ubs-id]/
  - requisitos-preenchidos.md  (cópia de 01 com dados reais)
  - configuracao-aplicada.md   (registro das decisões técnicas)
  - homologacao-funcional.md   (relatório assinado)
  - homologacao-cds.md         (relatório assinado)
  - lgpd.md                    (relatório assinado)
  - treinamento.md             (listas de presença + checklists)
  - go-live.md                 (checklist assinado + decisão)
  - pos-live.md                (relatórios D+1, D+7, D+30)
```

O playbook (`docs/implantacao/`) nunca contém dados de uma implantação específica.

---

## Atualização deste Playbook

Este playbook deve ser atualizado quando:

- Uma nova versão do VITRAS APS muda algum fluxo
- Uma nova versão do e-SUS/LEDI muda os códigos CDS
- Uma mudança regulatória (LGPD, MS, CFM) altera requisitos
- Uma implantação real identificar lacuna ou melhoria

**Responsável pela atualização:** Tech Lead + Delivery Governor  
**Processo:** PR com revisão do APS Specialist e Security Lead
