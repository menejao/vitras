# Risk Register — Homologação PEC VITRAS APS

**Versão:** 1.0  
**Data:** 2026-06-18  
**Escopo:** riscos identificados para sessão de homologação real com município parceiro

---

## Classificação

**Probabilidade:** Alta (A) / Média (M) / Baixa (B)  
**Impacto:** Crítico (C) / Alto (A) / Médio (M) / Baixo (B)  
**Prioridade:** P1 = bloqueante imediato / P2 = alto / P3 = monitorar

---

## Registro de Riscos

### R-01 — PEC versão incompatível

| Campo | Valor |
|-------|-------|
| Descrição | Município tem PEC < 5.4.36 instalado. Formato IDL incompatível. |
| Probabilidade | Alta |
| Impacto | Crítico |
| Prioridade | P1 |
| Sintomas | Import rejeitado na entrada / erro de protocolo |
| Mitigação pré | Confirmar versão PEC no Gate 1, antes de agendar sessão |
| Mitigação reativa | Não realizar sessão. Aguardar atualização do PEC municipal. |
| Responsável | Técnico municipal + VITRAS (coordenação) |
| Status | Aberto |

---

### R-02 — CNES inválido ou inativo

| Campo | Valor |
|-------|-------|
| Descrição | CNES informado pelo município não está ativo no SCNES nacional ou não corresponde à UBS. |
| Probabilidade | Média |
| Impacto | Crítico |
| Prioridade | P1 |
| Sintomas | PEC retorna "CNES não encontrado" / import rejeitado |
| Mitigação pré | Verificar CNES em cnes.datasus.gov.br antes da sessão (Gate 1) |
| Mitigação reativa | Interromper sessão. Gestor municipal regulariza CNES. Reagendar. |
| Responsável | Técnico municipal |
| Status | Aberto |

---

### R-03 — INE inválido ou não vinculado ao CNES

| Campo | Valor |
|-------|-------|
| Descrição | INE fornecido não está vinculado ao CNES da UBS no sistema federal. |
| Probabilidade | Média |
| Impacto | Crítico |
| Prioridade | P1 |
| Sintomas | Import rejeitado com mensagem de INE / fichas não associadas à equipe |
| Mitigação pré | Confirmar vínculo INE-CNES na consulta CNES (Gate 1) |
| Mitigação reativa | Corrigir vínculo no CNES nacional (processo lento). Usar INE correto. Reagendar. |
| Responsável | Técnico municipal |
| Status | Aberto |

---

### R-04 — CNS de profissional inválido

| Campo | Valor |
|-------|-------|
| Descrição | CNS do profissional operador não existe no CADSUS ou não tem vínculo com o CNES. |
| Probabilidade | Baixa |
| Impacto | Alto |
| Prioridade | P2 |
| Sintomas | FAI rejeitada / profissional não identificado no PEC |
| Mitigação pré | Consultar CNS em cadsus.saude.gov.br antes da sessão |
| Mitigação reativa | Usar CNS de outro profissional com acesso PEC válido. Corrigir para sessão definitiva. |
| Responsável | Técnico municipal + operador PEC |
| Status | Aberto |

---

### R-05 — Rejeição silenciosa pelo PEC

| Campo | Valor |
|-------|-------|
| Descrição | PEC aceita o arquivo sem erro visível mas não processa as fichas (zero registros importados). |
| Probabilidade | Média |
| Impacto | Alto |
| Prioridade | P2 |
| Sintomas | PEC exibe "sucesso" mas fichas não aparecem no sistema |
| Mitigação pré | Validar `versaoLote` no headerTransport antes do envio |
| Mitigação reativa | Verificar logs internos do PEC com técnico. Comparar versão do protocolo. Contatar suporte e-SUS AB. |
| Responsável | VITRAS + suporte DATASUS |
| Status | Aberto |

---

### R-06 — Divergência de contagem LEDI / RNDS

| Campo | Valor |
|-------|-------|
| Descrição | Registros importados no PEC não aparecem no consolidado LEDI ou são rejeitados na transmissão RNDS. |
| Probabilidade | Baixa |
| Impacto | Alto |
| Prioridade | P2 |
| Sintomas | Fichas visíveis no PEC local mas ausentes no SISAB / RNDS |
| Mitigação pré | Homologar em ambiente de homologação PEC (não produção) para evitar contaminação LEDI |
| Mitigação reativa | Identificar campo divergente via cds-field-mapping.md. Corrigir export. Re-homologar. |
| Responsável | VITRAS (campo) + DATASUS (validação RNDS) |
| Status | Aberto |

---

### R-07 — Erro de codificação de caracteres

| Campo | Valor |
|-------|-------|
| Descrição | Nomes com acentos, cedilhas ou caracteres especiais corrompidos após importação. |
| Probabilidade | Baixa |
| Impacto | Médio |
| Prioridade | P3 |
| Sintomas | "Maria da Concei??o" no PEC em vez de "Maria da Conceição" |
| Mitigação pré | Garantir UTF-8 em todo o pipeline de geração do JSON |
| Mitigação reativa | Verificar encoding do arquivo .esus. Corrigir serialização JSON. |
| Responsável | VITRAS (backend) |
| Status | Aberto |

---

### R-08 — Dados reais expostos em ambiente de teste

| Campo | Valor |
|-------|-------|
| Descrição | Pacientes reais exportados por engano para PEC de homologação ou arquivo compartilhado com terceiros. |
| Probabilidade | Baixa |
| Impacto | Crítico |
| Prioridade | P1 |
| Sintomas | Nomes/CNS/CPF reais identificados no arquivo de exportação |
| Mitigação pré | Usar apenas pacientes sintéticos do test-data-package.md em homologação |
| Mitigação reativa | PARAR sessão. Acionar DPO (lgpd@vitras.com.br). Registrar como incidente LGPD. Notificar ANPD se necessário. |
| Responsável | DPO VITRAS + operador |
| Status | Aberto |

---

### R-09 — Indisponibilidade do técnico PEC no dia

| Campo | Valor |
|-------|-------|
| Descrição | Técnico municipal responsável pelo PEC indisponível na data agendada. |
| Probabilidade | Média |
| Impacto | Médio |
| Prioridade | P3 |
| Sintomas | Sessão não pode prosseguir por falta de acesso ao PEC |
| Mitigação pré | Confirmar presença 48h antes. Ter backup identificado. |
| Mitigação reativa | Reagendar para próxima janela disponível (< 7 dias). |
| Responsável | Gestor municipal |
| Status | Aberto |

---

### R-10 — Versão VITRAS desatualizada no staging municipal

| Campo | Valor |
|-------|-------|
| Descrição | Município usa versão VITRAS desatualizada sem suporte a CDS Export. |
| Probabilidade | Baixa |
| Impacto | Alto |
| Prioridade | P2 |
| Sintomas | Módulo e-SUS não aparece / export não disponível |
| Mitigação pré | Confirmar versão VITRAS ativa no município antes da sessão (Gate 2) |
| Mitigação reativa | Deploy da versão correta no ambiente municipal. Reagendar. |
| Responsável | VITRAS (infra) |
| Status | Aberto |

---

## Resumo de Prioridades

| Prioridade | Riscos | Bloqueante? |
|------------|--------|------------|
| P1 | R-01, R-02, R-03, R-05 (parcial), R-08 | Sim — paralisar sessão |
| P2 | R-04, R-05, R-06, R-10 | Condicional — avaliar caso a caso |
| P3 | R-07, R-09 | Não — documentar e continuar |

---

## Histórico de Ocorrências

| Data | Risco | Sessão | Resultado | Resolução |
|------|-------|--------|-----------|-----------|
| | | | | |

---

*VITRAS APS — docs/homologacao/pec-risk-register.md*
