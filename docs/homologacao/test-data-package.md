# Test Data Package — Homologação CDS Export V1

**Versão:** 1.0  
**Data:** 2026-06-18  
**Status:** Dados sintéticos — uso exclusivo em ambiente de homologação/staging  
**Atenção:** Nunca usar CNS/CPF reais. Nunca submeter dados de pacientes reais ao PEC de homologação.

---

## 1. Paciente Alpha — Cenário Padrão (FCI + FCD + FAI)

**Objetivo:** cenário mínimo completo com todos os três tipos de ficha.

### 1.1 Dados do Paciente (FCI)

| Campo | Valor sintético |
|-------|----------------|
| Nome completo | Maria da Conceição Oliveira |
| Nome social | — (não informado) |
| Data de nascimento | 1978-03-15 |
| Sexo | Feminino |
| CNS | 898 0034 0497 1004 (sintético) |
| CPF | 000.000.001-91 (sintético) |
| Raça/cor | Parda |
| Escolaridade | Ensino Fundamental incompleto |
| Situação no mercado de trabalho | Empregada |
| Telefone | (11) 90000-0001 |
| E-mail | — |
| Logradouro | Rua das Flores |
| Número | 42 |
| Complemento | Ap 3 |
| Bairro | Centro |
| CEP | 01001-000 |
| Município | São Paulo |
| UF | SP |
| Código IBGE | 3550308 |
| Microárea | 001 |

### 1.2 Cadastro Domiciliar (FCD)

| Campo | Valor sintético |
|-------|----------------|
| Logradouro | Rua das Flores |
| Número | 42 |
| CEP | 01001-000 |
| Tipo imóvel | Domicílio |
| Tipo posse da terra | Cedido |
| Número de moradores | 3 |
| Família responsável | Maria da Conceição Oliveira |
| CNS responsável | 898 0034 0497 1004 |

### 1.3 Atendimento Individual (FAI)

| Campo | Valor sintético |
|-------|----------------|
| Data atendimento | 2026-06-10 |
| Turno | Manhã |
| Tipo atendimento | Consulta agendada |
| Profissional CNS | (usar CNS do profissional de teste) |
| CBO | 225125 (Médico de Família) |
| Problema / Condição avaliada | Hipertensão arterial |
| Conduta | Retorno para consulta agendada |
| CIAP-2 | K86 |
| CID-10 | I10 |
| Encaminhamento | Não |

---

## 2. Paciente Beta — Nome Social (FCI + FAI)

**Objetivo:** validar que campo `nomeSocial` é preservado na importação PEC.

### 2.1 Dados do Paciente (FCI)

| Campo | Valor sintético |
|-------|----------------|
| Nome completo | João Carlos Mendes |
| Nome social | **Carla Mendes** |
| Data de nascimento | 1995-07-22 |
| Sexo | Masculino |
| Identidade de gênero | Mulher transexual |
| CNS | 898 0034 0497 1012 (sintético) |
| CPF | 000.000.002-72 (sintético) |
| Raça/cor | Branca |
| Logradouro | Avenida Principal |
| Número | 100 |
| Bairro | Vila Nova |
| CEP | 02002-000 |
| Município | São Paulo |
| UF | SP |
| Código IBGE | 3550308 |
| Microárea | 002 |

### 2.2 Atendimento Individual (FAI)

| Campo | Valor sintético |
|-------|----------------|
| Data atendimento | 2026-06-11 |
| Turno | Tarde |
| Tipo atendimento | Atendimento de urgência |
| CIAP-2 | A97 |
| Conduta | Orientações |

---

## 3. Paciente Gamma — Endereço Incompleto / Sem Número

**Objetivo:** validar comportamento quando número do logradouro é "S/N".

| Campo | Valor sintético |
|-------|----------------|
| Nome completo | Antônio Ferreira Lima |
| Data de nascimento | 1950-11-08 |
| Sexo | Masculino |
| CNS | 898 0034 0497 1020 (sintético) |
| Logradouro | Estrada da Roça |
| Número | S/N |
| Bairro | Sítio Bom Jesus |
| CEP | 03003-000 |
| Município | São Paulo |
| Microárea | 003 |

---

## 4. Família Completa — Cenário Multi-membro

**Objetivo:** validar FCD com múltiplos membros de família.

| Membro | Nome | CNS sintético | Parentesco |
|--------|------|---------------|-----------|
| Responsável | Paula Regina Santos | 898 0034 0497 1039 | Cônjuge |
| Membro 2 | Roberto Santos | 898 0034 0497 1047 | Filho(a) |
| Membro 3 | Laura Santos | 898 0034 0497 1055 | Filho(a) |

**Domicílio:**  
Rua do Sol, 55 — Bairro Alto — CEP 04004-000 — São Paulo/SP  
Tipo: Domicílio — Posse: Próprio — 4 moradores

---

## 5. Profissional de Teste

| Campo | Valor |
|-------|-------|
| Nome | Dr. Carlos Eduardo Lima (fictício) |
| CNS | (substituir pelo CNS real do operador PEC em homologação) |
| CBO | 225125 (Médico de Família e Comunidade) |
| CNES | (substituir pelo CNES real da UBS em homologação) |
| INE | (substituir pelo INE real da equipe) |

---

## 6. Cenários de Validação

| Cenário | Fichas | Paciente | Resultado esperado |
|---------|--------|----------|--------------------|
| C-01 Mínimo | FCI | Alpha | Cadastro visível no PEC |
| C-02 Nome social | FCI + FAI | Beta | Campo nomeSocial preservado |
| C-03 Domicílio + família | FCI + FCD | Alpha + Família | FCD vinculado ao responsável |
| C-04 Atendimento completo | FCI + FAI | Alpha | FAI com CID/CIAP visível |
| C-05 Sem número | FCI | Gamma | "S/N" preservado no PEC |
| C-06 Multi-membro | FCI + FCD | Família | 4 membros no domicílio |
| C-07 Lote completo | FCI + FCD + FAI | Alpha + Beta + Gamma | Todos importados, zero FAIL |

---

## 7. Como Usar

1. Configurar UBS de homologação com CNES/INE reais da parceria
2. Cadastrar pacientes Alpha, Beta, Gamma, Família no VITRAS (staging)
3. Registrar atendimento para Alpha e Beta
4. Executar CDS Export selecionando os pacientes acima
5. Importar arquivo `.esus` gerado no PEC de homologação
6. Validar cada cenário da tabela acima
7. Preencher `evidence-package-template.md`

---

*VITRAS APS — docs/homologacao/test-data-package.md*
