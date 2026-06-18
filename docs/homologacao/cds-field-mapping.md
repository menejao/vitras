# CDS Field Mapping Reference — VITRAS → IDL → PEC

**Versão:** 1.0  
**Data:** 2026-06-18  
**Protocolo:** e-SUS AB — Lote CDS  
**PEC referência:** >= 5.4.36  

**Objetivo:** acelerar diagnóstico de erros de importação mapeando cada campo VITRAS ao campo IDL correspondente e ao campo visível no PEC.

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Mapeamento direto, sem transformação |
| 🔄 | Requer transformação/lookup |
| ⚠️ | Campo opcional — ausência pode gerar warning |
| ❌ | Campo não suportado nesta versão |
| `[obrig]` | Obrigatório no IDL |

---

## 1. FCI — Ficha de Cadastro Individual

### 1.1 Identificação do Paciente

| Campo VITRAS | Campo IDL | Campo PEC | Transformação | Status |
|-------------|-----------|-----------|---------------|--------|
| `patient.name` | `identificacaoUsuarioCidadao.nomeCidadao` | Nome completo | Uppercase | ✅ `[obrig]` |
| `patient.social_name` | `identificacaoUsuarioCidadao.nomeSocial` | Nome social | Direto | ✅ |
| `patient.birth_date` | `identificacaoUsuarioCidadao.dataNascimento` | Data nascimento | ISO 8601 → timestamp ms | 🔄 `[obrig]` |
| `patient.sex` | `identificacaoUsuarioCidadao.sexo` | Sexo | enum: 0=Masc, 1=Fem | 🔄 `[obrig]` |
| `patient.gender_identity` | `identificacaoUsuarioCidadao.identidadeGeneroDbEnum` | Identidade de gênero | enum IDL | 🔄 |
| `patient.cns` | `identificacaoUsuarioCidadao.cnsCidadao` | CNS | Direto | ✅ |
| `patient.cpf` | `identificacaoUsuarioCidadao.cpfCidadao` | CPF | Direto (sem pontuação) | 🔄 |
| `patient.race` | `identificacaoUsuarioCidadao.racaCorCidadao` | Raça/cor | enum IDL | 🔄 |
| `patient.ethnicity` | `identificacaoUsuarioCidadao.etnia` | Etnia | código SIGTAP | 🔄 |
| `patient.nationality` | `identificacaoUsuarioCidadao.nacionalidadeCidadao` | Nacionalidade | enum: 1=Bras, 2=Estrang, 3=Natural | 🔄 |

### 1.2 Endereço

| Campo VITRAS | Campo IDL | Campo PEC | Transformação | Status |
|-------------|-----------|-----------|---------------|--------|
| `patient.address.street` | `enderecoLocalPermanencia.nomeLogradouro` | Logradouro | Direto | ✅ `[obrig]` |
| `patient.address.number` | `enderecoLocalPermanencia.numero` | Número | "S/N" se nulo | 🔄 `[obrig]` |
| `patient.address.complement` | `enderecoLocalPermanencia.complemento` | Complemento | Direto | ⚠️ |
| `patient.address.neighborhood` | `enderecoLocalPermanencia.bairro` | Bairro | Direto | ✅ `[obrig]` |
| `patient.address.zip_code` | `enderecoLocalPermanencia.cep` | CEP | Sem hífen (8 dígitos) | 🔄 `[obrig]` |
| `patient.address.city_ibge` | `enderecoLocalPermanencia.codigoIbgeMunicipio` | Município | Código IBGE 7 dígitos | 🔄 `[obrig]` |
| `patient.address.microarea` | `enderecoLocalPermanencia.microarea` | Microárea | Direto | ⚠️ |
| `patient.address.fora_area` | `enderecoLocalPermanencia.stForaArea` | Fora de área | boolean | 🔄 |

### 1.3 Contato

| Campo VITRAS | Campo IDL | Campo PEC | Transformação | Status |
|-------------|-----------|-----------|---------------|--------|
| `patient.phone` | `contatoCidadao.numeroCelular` | Celular | Apenas dígitos | 🔄 |
| `patient.phone_home` | `contatoCidadao.numeroResidencial` | Telefone fixo | Apenas dígitos | 🔄 |
| `patient.email` | `contatoCidadao.email` | E-mail | Lowercase | 🔄 |

### 1.4 Socioeconômico

| Campo VITRAS | Campo IDL | Campo PEC | Transformação | Status |
|-------------|-----------|-----------|---------------|--------|
| `patient.education` | `informacoesSocioDemograficas.grauInstrucaoCidadao` | Escolaridade | enum IDL | 🔄 |
| `patient.employment` | `informacoesSocioDemograficas.situacaoMercadoTrabalho` | Situação trabalho | enum IDL | 🔄 |
| `patient.bolsa_familia` | `informacoesSocioDemograficas.statusPossuiBolsaFamilia` | Bolsa Família | boolean | 🔄 |
| `patient.deficiencies` | `informacoesSocioDemograficas.deficienciasCidadao` | Deficiências | lista enum | 🔄 |

---

## 2. FCD — Ficha de Cadastro Domiciliar

| Campo VITRAS | Campo IDL | Campo PEC | Transformação | Status |
|-------------|-----------|-----------|---------------|--------|
| `household.address.street` | `enderecoLocalPermanencia.nomeLogradouro` | Logradouro | Direto | ✅ `[obrig]` |
| `household.address.number` | `enderecoLocalPermanencia.numero` | Número | "S/N" se nulo | 🔄 `[obrig]` |
| `household.address.zip_code` | `enderecoLocalPermanencia.cep` | CEP | 8 dígitos | 🔄 `[obrig]` |
| `household.address.city_ibge` | `enderecoLocalPermanencia.codigoIbgeMunicipio` | Município | Código IBGE | 🔄 `[obrig]` |
| `household.type` | `tipoDomicilio` | Tipo do imóvel | enum IDL | 🔄 |
| `household.land_tenure` | `tipoPosse` | Posse da terra | enum IDL | 🔄 |
| `household.resident_count` | `quantosComodos` | Nº de cômodos | integer | ✅ |
| `household.member_count` | `quantosMoradores` | Nº de moradores | integer | ✅ |
| `household.members[].cns` | `familiaRow[].numeroCnsResponsavel` | CNS familiar | Direto | ✅ |
| `household.members[].is_head` | `familiaRow[].stResponsavelPelaDomicilio` | Responsável | boolean | 🔄 |

---

## 3. FAI — Ficha de Atendimento Individual

### 3.1 Header do Atendimento

| Campo VITRAS | Campo IDL | Campo PEC | Transformação | Status |
|-------------|-----------|-----------|---------------|--------|
| `encounter.date` | `atendimentoIndividual.dtAtendimento` | Data atendimento | ISO → timestamp ms | 🔄 `[obrig]` |
| `encounter.shift` | `atendimentoIndividual.turno` | Turno | enum: 1=M, 2=T, 3=N | 🔄 `[obrig]` |
| `encounter.type` | `atendimentoIndividual.tipoAtendimento` | Tipo atendimento | enum IDL | 🔄 `[obrig]` |
| `encounter.patient_cns` | `atendimentoIndividual.cnsCidadao` | CNS paciente | Direto | ✅ `[obrig]` |
| `professional.cns` | `headerTransport.cboCodigo2002` ... `profissionalCNS` | CNS profissional | Direto | ✅ `[obrig]` |
| `professional.cbo` | `cboCodigo2002` | CBO | Código 6 dígitos | ✅ `[obrig]` |

### 3.2 Diagnóstico

| Campo VITRAS | Campo IDL | Campo PEC | Transformação | Status |
|-------------|-----------|-----------|---------------|--------|
| `encounter.ciap_codes[]` | `problemasCondicoesAvaliadas.ciap2Codigo` | CIAP-2 | Array → list IDL | 🔄 |
| `encounter.cid_codes[]` | `problemasCondicoesAvaliadas.cid10Codigo` | CID-10 | Array → list IDL | 🔄 |
| `encounter.notes` (SOAP-O) | `observacao` | Observações | Texto livre | ⚠️ |

### 3.3 Conduta

| Campo VITRAS | Campo IDL | Campo PEC | Transformação | Status |
|-------------|-----------|-----------|---------------|--------|
| `encounter.conducts[]` | `condutaEncaminhamento` | Conduta | enum IDL | 🔄 |
| `encounter.referral` | `encaminhamento` | Encaminhamento | enum IDL | 🔄 |
| `encounter.procedures[]` | `procedimentosRealizados` | Procedimentos | código SIGTAP | 🔄 |

---

## 4. headerTransport (todos os tipos de ficha)

| Campo VITRAS | Campo IDL | Valor fixo/derivado |
|-------------|-----------|---------------------|
| `ubs.cnes` | `headerTransport.cnes` | CNES da UBS ativa |
| `team.ine` | `headerTransport.ine` | INE da equipe |
| `export.timestamp` | `headerTransport.dataHoraEnvio` | Timestamp geração |
| — | `headerTransport.origem` | `"VITRAS"` (fixo) |
| — | `headerTransport.versaoSistema` | Versão VITRAS (semver) |
| — | `headerTransport.versaoLote` | Versão protocolo e-SUS |

---

## 5. Enums de Referência

### Sexo
| Valor IDL | Significado |
|-----------|-------------|
| 0 | Masculino |
| 1 | Feminino |

### Raça/cor
| Valor IDL | Significado |
|-----------|-------------|
| 1 | Branca |
| 2 | Preta |
| 3 | Parda |
| 4 | Amarela |
| 5 | Indígena |

### Turno (FAI)
| Valor IDL | Significado |
|-----------|-------------|
| 1 | Manhã |
| 2 | Tarde |
| 3 | Noite |

### Tipo atendimento (FAI)
| Valor IDL | Significado |
|-----------|-------------|
| 1 | Consulta agendada |
| 2 | Consulta agendada programada/cuidado continuado |
| 3 | Escuta inicial / Orientação |
| 4 | Atendimento de urgência |
| 6 | Visita domiciliar |

---

## 6. Erros Comuns e Diagnóstico

| Sintoma PEC | Campo suspeito | Verificar |
|-------------|---------------|-----------|
| "CNS inválido" | `cnsCidadao` / `profissionalCNS` | Dígito verificador CNS |
| "Data inválida" | `dtAtendimento` / `dataNascimento` | Formato timestamp ms, não string |
| "CNES não encontrado" | `headerTransport.cnes` | CNES ativo no SCNES |
| "INE não associado" | `headerTransport.ine` | INE vinculado ao CNES |
| "Campo obrigatório" | Ver coluna `[obrig]` acima | Campo nulo ou vazio |
| "CEP inválido" | `cep` | Exatamente 8 dígitos, sem hífen |
| "CBO inválido" | `cboCodigo2002` | 6 dígitos, código ativo |
| Importação silenciosa (zero registros) | `versaoLote` | Versão compatível com PEC |

---

*VITRAS APS — docs/homologacao/cds-field-mapping.md*
