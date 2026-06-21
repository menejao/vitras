# 04 — Homologação e-SUS / CDS Export

**Versão:** 1.0 | **Produto:** VITRAS APS | **Aplicação:** qualquer UBS do Brasil

---

## Princípio

A homologação CDS valida que os arquivos `.esus` gerados pelo VITRAS são aceitos pelo PEC/e-SUS da UBS sem erros críticos.

**Pré-requisito absoluto:** PEC ≥ 5.4.36 instalado e acessível.

---

## Pré-condições

- [ ] Homologação funcional (doc 03) concluída com PASS
- [ ] PEC ≥ 5.4.36 confirmado (`Menu Sobre` no PEC)
- [ ] Profissional gestor com `cds.export` capability ativo
- [ ] `cnsProfissional` e `cboCodigo` configurados para o gestor
- [ ] CNES da unidade configurado
- [ ] INE da equipe configurado
- [ ] `MUNICIPALITY_ID` = código IBGE correto no ambiente

---

## EC-01 — Verificar PEC

**Responsável:** Tech Lead  
**Duração:** 5 min

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Acessar PEC → Menu Sobre | Versão exibida | [ ] |
| 2 | Confirmar versão ≥ 5.4.36 | `PEC ≥ 5.4.36` | [ ] |
| 3 | Registrar versão exata | _____________ | [ ] |

**Se versão < 5.4.36:** parar. Não continuar. Escalar atualização para SMS/TI prefeitura.

---

## EC-02 — Exportar Cadastro Individual

**Responsável:** APS Specialist + QA Senior  
**Duração:** 10 min

**Pré-condições:** paciente com dados completos criado (raça/cor, sexo, data nasc., endereço)

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Login como gestor | Token com capability `cds.export` | [ ] |
| 2 | `GET /export/cds/individual/[patientId]` | Resposta 200, `Content-Type: application/zip` | [ ] |
| 3 | Salvar arquivo `.esus` baixado | Arquivo presente no disco | [ ] |
| 4 | Verificar que arquivo é ZIP válido | `unzip -t arquivo.esus` sem erros | [ ] |
| 5 | Importar `.esus` no PEC (Transmissão de Dados → Importar) | Importação iniciada sem erro imediato | [ ] |
| 6 | Verificar relatório de importação no PEC | Status da ficha | [ ] |

**Evidência:** screenshot do PEC mostrando importação + resultado

---

## EC-03 — Exportar Cadastro Domiciliar

**Responsável:** APS Specialist + QA Senior  
**Duração:** 10 min

**Pré-condições:** household criado para o paciente

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | `GET /export/cds/domiciliar/[householdId]` | 200, `Content-Type: application/zip` | [ ] |
| 2 | Salvar e validar arquivo `.esus` | ZIP válido | [ ] |
| 3 | Importar no PEC | Importação sem erro crítico | [ ] |
| 4 | Verificar relatório | Status da ficha | [ ] |

**Evidência:** screenshot do relatório PEC

---

## EC-04 — Exportar Visita Domiciliar

**Responsável:** APS Specialist + QA Senior  
**Duração:** 10 min

**Pré-condições:** visita ACS registrada com campos LEDI válidos

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | `GET /export/cds/visita/[visitId]` | 200, `Content-Type: application/zip` | [ ] |
| 2 | Salvar e validar arquivo `.esus` | ZIP válido | [ ] |
| 3 | Importar no PEC | Importação sem erro crítico | [ ] |
| 4 | Verificar relatório | Status da ficha | [ ] |

**Evidência:** screenshot do relatório PEC

---

## EC-05 — Exportar Atendimento Individual

**Responsável:** APS Specialist + QA Senior  
**Duração:** 10 min

**Pré-condições:** atendimento clínico registrado com CIAP-2/CID-10

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | `GET /export/cds/atendimento/[appointmentId]` | 200, `Content-Type: application/zip` | [ ] |
| 2 | Salvar e validar arquivo `.esus` | ZIP válido | [ ] |
| 3 | Importar no PEC | Importação sem erro crítico | [ ] |
| 4 | Verificar relatório | Status da ficha | [ ] |

**Evidência:** screenshot do relatório PEC

---

## Registro de Resultados por Ficha

| Ficha | IBGE correto? | CNES correto? | INE correto? | CNS profissional? | Importou? | Erros PEC | Status |
|-------|--------------|--------------|-------------|------------------|-----------|-----------|--------|
| Cadastro Individual | | | | | | | |
| Cadastro Domiciliar | | | | | | | |
| Visita Domiciliar | | | | | | | |
| Atendimento Individual | | | | | | | |

---

## Classificação de Erros PEC

| Tipo | Definição | Ação |
|------|-----------|------|
| **Erro crítico** | PEC rejeita ficha; não processa | Parar; investigar campo inválido; corrigir configuração |
| **Warning** | PEC aceita mas emite alerta | Documentar; avaliar impacto; CNS/CBO ausente é comum em DEV |
| **Sucesso** | Ficha importada sem erros | Registrar como PASS |

---

## Critério de Aprovação da Homologação CDS

| Resultado | Definição |
|-----------|-----------|
| **PASS** | Todas as 4 fichas importadas sem erro crítico |
| **PASS COM WARNING** | Todas importadas; warnings documentados e com causa explicada |
| **FAIL** | Qualquer ficha rejeitada com erro crítico |

---

## Causas Comuns de Falha

| Erro PEC | Causa provável | Correção |
|----------|---------------|---------|
| "IBGE inválido" | `MUNICIPALITY_ID` env var errado ou ausente | Corrigir env var e restartar |
| "CNES inválido" | CNES não configurado na unidade | `PUT /users/:id` com `cnes` |
| "CNS profissional inválido" | `cnsProfissional` ausente ou formato errado | `PUT /users/:id` com CNS 15 dígitos |
| "CBO inválido" | `cboCodigo` ausente ou código errado | `PUT /users/:id` com CBO correto |
| "INE não encontrado" | INE não configurado na equipe | `PATCH /teams/:id` com `ine` de 10 dígitos |
| Arquivo corrompido | Problema de rede no download | Tentar novamente; verificar `Content-Length` |

---

**Assinatura do APS Specialist:**  
Data: ______  
PEC versão: ______  
Resultado: ______  
Observações: ______
