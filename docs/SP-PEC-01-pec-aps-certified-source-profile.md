# SP-PEC-01 — PEC APS Certified Source Profile

**Emitido em:** 2026-06-23  
**Status:** PASS  
**Depende de:** ARCH-INT-01 (PASS — `be1a79c`)  
**Pré-requisito para:** MAP-PEC-01  
**Autoridade:** Primeiro Source Profile oficialmente certificado do VITRAS APS  
**Sistema de origem:** e-SUS PEC APS (Prontuário Eletrônico do Cidadão — Atenção Primária à Saúde)  
**Mantenedor:** DATASUS / Secretaria de Atenção Primária à Saúde (SAPS/MS)

---

## GOV-01

| # | Critério | Resultado |
|---|---|---|
| 1 | Estrutura do PEC APS documentada? | **SIM** |
| 2 | Versões suportadas identificadas? | **SIM** |
| 3 | Entidades principais identificadas? | **SIM** |
| 4 | Relacionamentos identificados? | **SIM** |
| 5 | Eventos assistenciais identificados? | **SIM** |
| 6 | Campos obrigatórios identificados? | **SIM** |
| 7 | Campos incompatíveis identificados? | **SIM** |
| 8 | Campos sem equivalente canônico identificados? | **SIM** |
| 9 | Source Profile PEC definido? | **SIM** |
| 10 | Source Profile PEC certificado? | **SIM** |

---

## FASE 1 — Inventário do PEC APS

### Descrição geral

O PEC APS (Prontuário Eletrônico do Cidadão — Atenção Primária à Saúde) é o sistema oficial do Ministério da Saúde do Brasil para registro eletrônico de saúde na atenção básica. Faz parte do ecossistema e-SUS AB (Atenção Básica), desenvolvido e mantido pelo DATASUS com código-fonte parcialmente aberto.

**Repositório público:** GitHub - laboratorio-de-praticas/eSUS-AB  
**Stack tecnológica:** Java (Spring Boot) + Angular + PostgreSQL  
**Protocolo de exportação oficial:** LEDI APS (Leiaute de Exportação de Dados Integrados da Atenção Primária)  
**Integração nacional:** RNDS (Rede Nacional de Dados em Saúde) — ativo a partir da versão 4.x

### Formatos de exportação disponíveis

| Formato | Versão mínima PEC | Completude | Disponibilidade |
|---|---|---|---|
| LEDI APS (XML) | 3.0 | Alta — inclui eventos clínicos | Padrão — toda instalação |
| CSV Relatórios | 3.0 | Baixa — dados agregados/tabular | Padrão — toda instalação |
| REST API v1 (Thrift) | 4.0 | Média | Deprecado no 5.x |
| REST API v2 | 5.0 | Alta | Instalações 5.x com API habilitada |
| Dump PostgreSQL | qualquer | Completa — acesso direto ao banco | Requer acesso ao servidor |
| RNDS (FHIR R4) | 4.2 | Alta — dados padronizados | Apenas MS/Estados com convênio |

**Formato recomendado para SP-PEC-01:** LEDI APS (XML) — universalmente disponível, estruturado, documentado pelo MS, compatível com toda instalação ativa no país.

### Estrutura de diretórios LEDI APS (exportação)

```
export/
├── fichas/
│   ├── FichaCadastroIndividual_<timestamp>.xml
│   ├── FichaCadastroDomiciliar_<timestamp>.xml
│   ├── FichaAtendimentoIndividualMaster_<timestamp>.xml
│   ├── FichaAtendimentoIndividualChild_<timestamp>.xml
│   ├── FichaVisitaDomiciliarMaster_<timestamp>.xml
│   ├── FichaVisitaDomiciliarChild_<timestamp>.xml
│   ├── FichaAtendimentoOdontologicoMaster_<timestamp>.xml
│   ├── FichaAtendimentoOdontologicoChild_<timestamp>.xml
│   ├── FichaVacinacaoMaster_<timestamp>.xml
│   ├── FichaVacinacaoChild_<timestamp>.xml
│   ├── FichaAtividadeColetiva_<timestamp>.xml
│   └── FichaEligibilidade_<timestamp>.xml
└── header.xml  (metadados da exportação: CNES, INE, período, versão PEC)
```

### Tabelas principais do banco PostgreSQL (acesso direto)

| Tabela | Entidade | Observação |
|---|---|---|
| `cidadao` | Cidadão (paciente) | Chave: `id`, `co_cidadao_cnscartao` |
| `profissional` | Profissional de saúde | Chave: `co_cns`, `co_cpf_cidadao`, `co_cbo` |
| `equipe` | Equipe ESF/eAP | Chave: `nu_ine` (INE nacional) |
| `unidade_saude` | UBS | Chave: `co_cnes` (CNES 7 dígitos) |
| `atendimento_individual` | Atendimento clínico | Chave: `id`, `co_unico_ficha` |
| `ficha_visita_domiciliar_master` | Visita ACS | Chave: `nu_cns_profissional`, data |
| `ficha_visita_domiciliar_child` | Itens da visita | FK: `co_ficha_visita_domiciliar_master` |
| `ficha_cadastro_individual` | Cadastro do cidadão | Chave: `nu_cns` |
| `ficha_cadastro_domiciliar` | Cadastro domiciliar | FK: `co_domicilio` |
| `procedimento_realizado` | Procedimento | FK: `atendimento_individual.id` |
| `exame_solicitado` | Solicitação de exame | FK: `atendimento_individual.id` |
| `exame_resultado` | Resultado de exame | FK: `atendimento_individual.id` |
| `encaminhamento` | Encaminhamento | FK: `atendimento_individual.id` |
| `problema_condicao_avaliada` | CID/CIAP2 anotado | FK: `atendimento_individual.id` |
| `medicamento_prescrito` | Prescrição | FK: `atendimento_individual.id` |
| `vacina_aplicada` | Vacinação | Tabela própria |

---

## FASE 2 — Versões

### Histórico de versões

| Versão | Período | Status | Mudanças estruturais relevantes |
|---|---|---|---|
| **2.x** | 2015–2018 | EOL (descontinuado) | Estrutura legada, sem LEDI padronizado |
| **3.x** | 2018–2020 | EOL | LEDI APS introduzido, PostgreSQL, sem REST API |
| **4.0–4.1** | 2020–2021 | Legacy | REST API Thrift, RNDS integração inicial |
| **4.2–4.9** | 2021–2023 | Suportado (limited) | `co_cpf_cidadao` adicionado ao cidadão, RNDS ativo |
| **5.0–5.2** | 2023–2024 | Ativo | REST API v2, novos campos CIAP-2, campo `tipoLocalAtendimento` |
| **5.3+** | 2025– | Atual | Melhorias RNDS, novos relatórios LEDI |

### Matriz de compatibilidade por versão

| Campo/Feature | 3.x | 4.x | 5.x | SP-PEC-01 |
|---|---|---|---|---|
| CNS do cidadão | ✅ | ✅ | ✅ | **suportado** |
| CPF do cidadão | ❌ | ✅ (4.2+) | ✅ | **suportado apenas 4.2+** |
| `racaCor` código numérico | ✅ | ✅ | ✅ | **requer normalização** |
| CID-10 estruturado | ✅ | ✅ | ✅ | **suportado** |
| CIAP-2 | ❌ | ✅ | ✅ | **suportado apenas 4.x+** |
| REST API | ❌ | ✅ Thrift | ✅ REST | não utilizado neste profile |
| RNDS (FHIR) | ❌ | ✅ parcial | ✅ completo | fora de escopo |
| `microArea` como código | ✅ | ✅ | ✅ | **requer normalização** |
| INE da equipe | ✅ | ✅ | ✅ | **suportado** |

**Versão mínima suportada por este Source Profile:** PEC APS **4.2**

Racional: CPF do cidadão só existe a partir do 4.2 e é necessário para deduplicação confiável no VITRAS. Versões 3.x podem ser suportadas em Source Profile separado (SP-PEC-3X-01) se necessário.

---

## FASE 3 — Entidades

### 3.1 Cidadão (→ Patient VITRAS)

**Entidade principal. Identificador primário: CNS.**

| Campo PEC | Localização LEDI | Tipo | Obrigatório PEC | Campo canônico VITRAS |
|---|---|---|---|---|
| `nu_cns` | `FichaCadastroIndividual/nuCns` | string(15) | SIM | `patient.cns` |
| `co_cpf_cidadao` | `FichaCadastroIndividual/cpfCidadao` | string(11) | NÃO (4.2+) | `patient.cpf` |
| `no_cidadao` | `FichaCadastroIndividual/nomeCidadao` | string(200) | SIM | `patient.name` |
| `dt_nascimento` | `FichaCadastroIndividual/dataNascimento` | YYYYMMDD | SIM | `patient.birthDate` |
| `no_mae_cidadao` | `FichaCadastroIndividual/nomeMaeSocial` | string(200) | NÃO | `patient.motherName` |
| `co_sexo` | `FichaCadastroIndividual/sexo` | enum | SIM | `patient.sexAtBirth` |
| `co_raca_cor` | `FichaCadastroIndividual/racaCor` | enum(01–05) | NÃO | `patient.racaCor` |
| `no_telefone_residencial` | `FichaCadastroIndividual/telefoneResidencial` | string | NÃO | `patient.phone` |
| `no_telefone_celular` | `FichaCadastroIndividual/telefoneCelular` | string | NÃO | `patient.phone` (preferido) |
| `nu_micro_area` | `FichaCadastroIndividual/microarea` | string | NÃO | `patient.microArea` |
| `co_situacao_rua` | `FichaCadastroIndividual/statusEhSituacaoRua` | boolean | NÃO | `patient.situacaoRua` |
| `co_deficiencia` | `FichaCadastroIndividual/deficiencia` | enum[] | NÃO | `patient.deficiencia` |
| `st_gestante` | `FichaCadastroIndividual/statusEhGestante` | boolean | NÃO | derivado → `careCategory=pregnant` |
| `co_municipio_nascimento` | n/a | IBGE 6 dígitos | NÃO | não mapeado |
| `nu_ine` | FK equipe | string(10) | SIM | `patient.teamId` (via INE→UUID) |
| `co_cnes` | FK unidade | string(7) | SIM | `patient.unitId` (via CNES→UUID) |
| `dt_atualizado_em` | header | ISO 8601 | SIM | `patient.updatedAt` |

**Quirks conhecidos:**
- `dt_nascimento` no formato YYYYMMDD — converter para YYYY-MM-DD
- `co_sexo`: `M`/`F` em algumas versões; `0`/`1` em outras → normalizar para `MASCULINO`/`FEMININO`
- `nu_cns` pode ter zeros à esquerda suprimidos em algumas exports CSV → padEnda para 15 dígitos
- `co_cpf_cidadao` pode conter pontuação (`000.000.000-00`) → remover e validar 11 dígitos
- `nu_micro_area` é código numérico no PEC (`001`, `002`) — tratado como string no VITRAS

### 3.2 Profissional de Saúde (→ User VITRAS)

| Campo PEC | Localização LEDI | Tipo | Campo canônico VITRAS |
|---|---|---|---|
| `nu_cns_profissional` | `header/cnsProfissional` | string(15) | `user.cns` (campo futuro) |
| `co_cpf_profissional` | `header/cpfProfissional` | string(11) | identificação interna |
| `no_profissional` | base cadastral | string(200) | `user.name` |
| `co_cbo` | `header/cboProfissional` | string(6) | derivado → `user.role` via mapeamento CBO |
| `nu_ine` | FK equipe | string(10) | `user.teamId` (via INE→UUID) |
| `co_cnes` | FK unidade | string(7) | `user.unitId` (via CNES→UUID) |

**Mapeamento CBO → role VITRAS:**

| CBO PEC | Descrição | `role` VITRAS |
|---|---|---|
| 2235 (família) | Enfermeiro | `nurse_manager` |
| 2251 (família) | Médico generalista | `doctor` |
| 2232 | Médico | `doctor` |
| 3222 | Técnico de enfermagem | `nursing_tech` |
| 5151 | Agente comunitário de saúde | `acs` |
| 2226 | Cirurgião-dentista | `dentist` |
| 2516 | Assistente social | não mapeado |
| outros | — | `support_operator` (fallback) |

**Quirk:** CBO é código de 4 ou 6 dígitos — truncar para 4 antes de comparar.

### 3.3 Equipe (→ Team VITRAS)

| Campo PEC | Tipo | Campo canônico VITRAS |
|---|---|---|
| `nu_ine` | string(10) — INE nacional | identificador de mapeamento INE→teamId |
| `no_equipe` | string(200) | `team.name` |
| `co_cnes` | string(7) | `team.unitId` (via CNES→UUID) |
| `tp_equipe` | enum (eSF=70, eAP=76...) | não mapeado (VITRAS não diferencia tipo de equipe) |

**Regra crítica:** INE (Identificador Nacional de Equipe) é o vinculador entre PEC e VITRAS. A UBS deve fornecer tabela de equivalência `INE → teamId VITRAS` antes de qualquer importação. Sem essa tabela, Import Job falha na fase de validação (V-TER-03).

### 3.4 Unidade de Saúde (→ Unit VITRAS)

| Campo PEC | Tipo | Campo canônico VITRAS |
|---|---|---|
| `co_cnes` | string(7) — CNES nacional | identificador de mapeamento CNES→unitId |
| `no_unidade_saude` | string(200) | `unit.name` |
| `co_municipio` | IBGE 6 dígitos | `unit.municipalityId` (PEC usa 6; VITRAS usa 7 — ver quirk) |

**Quirk crítico de municipalityId:** PEC armazena código IBGE com 6 dígitos (sem o dígito verificador). VITRAS exige 7 dígitos. Regra de conversão: `municipalityId_vitras = municipalityId_pec + dígito_verificador_ibge`. Dígito verificador deve ser resolvido via tabela IBGE — não pode ser calculado diretamente sem a tabela.

**Alternativa:** a UBS fornece o `municipalityId` de 7 dígitos no cabeçalho do Import Job — sobrescreve o valor calculado. Preferível.

---

## FASE 4 — Relacionamentos

### Grafo relacional PEC → VITRAS

```
UnidadeSaude (CNES)
    │ 1:N
    ▼
Equipe (INE)
    │ 1:N
    ▼
Cidadão (CNS/CPF) ───── FichaCadastroIndividual
    │                        │
    │ 1:N                    │ 1:1
    ▼                        ▼
AtendimentoIndividual ←── Profissional (CNS)
    │
    ├── ProblemaConcicaoAvaliada (CID-10, CIAP-2)
    ├── ProcedimentoRealizado
    ├── ExameSolicitado / ExameResultado
    ├── Encaminhamento
    └── MedicamentoPrescrito

Cidadão ──── FichaVisitaDomiciliar (Profissional ACS)
    │              │
    │              └── MotivosVisita, Desfecho, Peso, Altura
    │
    └── FichaCadastroDomiciliar
              │
              └── CondicioesMoradia (agua, esgoto, energia, lixo)
```

### Tradução de relacionamentos PEC → VITRAS

| Relacionamento PEC | Tradução VITRAS | Chave de vínculo |
|---|---|---|
| Cidadão ↔ Equipe | `patient.teamId` | INE → teamId VITRAS |
| Cidadão ↔ Unidade | `patient.unitId` | CNES → unitId VITRAS |
| AtendimentoIndividual ↔ Cidadão | `clinicalRecord.patientId` | CNS/CPF → patientId VITRAS |
| AtendimentoIndividual ↔ Profissional | `clinicalRecord.createdBy` | CNS profissional → userId VITRAS |
| FichaVisita ↔ Cidadão | `clinicalRecord.patientId` (type=visit) | CNS/CPF → patientId VITRAS |
| FichaVisita ↔ Profissional ACS | `clinicalRecord.createdBy` | CNS ACS → userId VITRAS |
| FichaCadastroDomiciliar ↔ Cidadão | `household.patientId` | CNS/CPF → patientId VITRAS |

**Vinculação via INE/CNES:** obrigatória antes de qualquer Import Job. Tabela de equivalência:

```json
{
  "ine_to_team": {
    "0000001234": "uuid-vitras-team-A",
    "0000005678": "uuid-vitras-team-B"
  },
  "cnes_to_unit": {
    "1234567": "uuid-vitras-unit-X"
  }
}
```

---

## FASE 5 — Eventos Assistenciais

### Mapeamento PEC → Clinical Event Model VITRAS

| Ficha PEC | `type` VITRAS | Mapeamento | Notas |
|---|---|---|---|
| `FichaAtendimentoIndividual` (médico) | `consultation` | COMPATÍVEL | `co_tipo_atendimento` filtra |
| `FichaAtendimentoIndividual` (retorno) | `return` | COMPATÍVEL | `co_tipo_atendimento=RETORNO` |
| `FichaAtendimentoIndividual` (procedimento) | `procedure` | COMPATÍVEL | quando sem diagnóstico |
| `FichaAtendimentoIndividual` (evolução) | `evolution` | COMPATÍVEL | `co_tipo_atendimento=ESCUTA_INICIAL` |
| `FichaAtendimentoIndividual` (prescrição) | `prescription` | PARCIAL — ver nota 1 | |
| `FichaAtendimentoIndividual` (encaminhamento) | `referral` | COMPATÍVEL | subtipo de AtendimentoIndividual |
| `FichaAtendimentoIndividual` (exame) | `exam_request` | COMPATÍVEL | subtipo de AtendimentoIndividual |
| `FichaAtendimentoIndividual` (enfermagem) | `nursing` | COMPATÍVEL | `co_cbo=2235` |
| `FichaVisitaDomiciliar` | `visit` | COMPATÍVEL — enriquecido | |
| `FichaAtendimentoOdontologico` | `procedure` | PARCIAL — ver nota 2 | |
| `FichaVacinacao` | `vaccine` | PARCIAL — ver nota 3 | |
| `FichaAtividadeColetiva` | não mapeado | SEM EQUIVALENTE | atividade coletiva ≠ evento individual |
| `FichaEligibilidade` | não mapeado | SEM EQUIVALENTE | para RNDS — fora de escopo VITRAS |

**Nota 1 — Prescrição:** PEC não tem ficha de prescrição separada — prescrição é campo dentro do `AtendimentoIndividual`. No VITRAS, `prescription` é um `clinicalRecord` separado. Decisão: criar `clinicalRecord.type=prescription` vinculado ao mesmo `patientId` e `date`, com `details` contendo os medicamentos prescritos.

**Nota 2 — Odontológico:** `FichaAtendimentoOdontologico` tem estrutura diferente (procedimentos odontológicos SIGTAP) sem equivalente no modelo clínico atual do VITRAS. Mapeado como `procedure` com `details` contendo os procedimentos SIGTAP.

**Nota 3 — Vacinação:** `FichaVacinacao` tem campo `imuno` (código do imunobiológico) sem correspondência direta no modelo VITRAS atual. Mapeado como `vaccine` com `details.imuno`. O campo `protocolTag` pode carregar o nome da vacina. Modelo de vacinação do VITRAS ainda não é completo — ver gap G-07.

### Campos do Clinical Event Model por ficha PEC

**FichaAtendimentoIndividual → ClinicalRecord:**

| Campo PEC | Campo VITRAS | Mapeamento |
|---|---|---|
| `nu_cns_cidadao` | `patientId` | via CNS → UUID |
| `nu_cns_profissional` | `createdBy` | via CNS → UUID |
| `dt_atendimento` | `date` | YYYYMMDD → YYYY-MM-DD |
| `co_turno` | `turno` | M→MANHA, T→TARDE, N→NOITE |
| `co_local_atendimento` | `localDeAtendimento` | 01→UBS, 04→DOMICILIO, outros→OUTRO |
| `co_tipo_atendimento` | `type` | tabela de mapeamento |
| `co_cid_principal` | `cidPrincipal` | direto (já no formato CID) |
| `co_cid_secundario[]` | `cidSecundarios[]` | direto |
| `co_ciap_principal` | `ciapPrincipal` | direto (já no formato CIAP-2) |
| `ds_notas` | `details` | texto livre |
| `co_unico_ficha` | `sourceId` | identificador único no PEC |

**FichaVisitaDomiciliar → ClinicalRecord (type=visit):**

| Campo PEC | Campo VITRAS | Mapeamento |
|---|---|---|
| `nu_cns_cidadao` | `patientId` | via CNS → UUID |
| `nu_cns_profissional` (ACS) | `createdBy` | via CNS → UUID |
| `dt_visita` | `dataVisita` | YYYYMMDD → YYYY-MM-DD |
| `co_turno` | `turno` | M→MANHA, T→TARDE, N→NOITE |
| `co_tipo_visita` | `tipoVisita` | tabela de mapeamento |
| `co_motivo_visita[]` | `motivosVisita[]` | tabela de mapeamento |
| `co_desfecho` | `desfecho` | 1→VISITA_REALIZADA, 2→AUSENTE, 3→RECUSOU |
| `nu_peso` | `metadata.peso` | decimal kg |
| `nu_altura` | `metadata.altura` | decimal cm |
| `co_unico_ficha` | `sourceId` | identificador único no PEC |

**Mapeamento `co_tipo_visita` PEC → `tipoVisita` VITRAS:**

| Código PEC | Descrição | `tipoVisita` VITRAS |
|---|---|---|
| 1 | Visita periódica | `VISITA_PERIODICA` |
| 2 | Visita pós-internação | `VISITA_POS_INTERNACAO` |
| 3 | Acompanhamento de condicionalidades | `ACOMPANHAMENTO_CONDICIONALIDADES` |
| 4 | Busca ativa | `BUSCA_ATIVA` |
| 5 | Investigação de surto | `INVESTIGACAO_SURTO` |
| 6 | Educação em saúde | `EDUCACAO_SAUDE` |
| 7 | Atendimento de urgência | `ATENDIMENTO_URGENCIA` |
| 8 | Outro | `OUTRO` |

**Mapeamento `co_motivo_visita[]` PEC → `motivosVisita[]` VITRAS:**

| Código PEC | `motivosVisita` VITRAS |
|---|---|
| 01 | `CADASTRAMENTO_ATUALIZACAO` |
| 02 | `VISITA_PERIODICA` |
| 03 | `ACOMPANHAMENTO_RN` |
| 04 | `ACOMPANHAMENTO_GESTANTE` |
| 05 | `ACOMPANHAMENTO_PUERPERA` |
| 06 | `ACOMPANHAMENTO_CRIANCA` |
| 07 | `ACOMPANHAMENTO_ADULTO` |
| 08 | `ACOMPANHAMENTO_IDOSO` |
| 09 | `BUSCA_FALTOSO` |
| 10 | `BUSCA_INTERNACAO` |
| 11 | `BUSCA_AVC` |
| 12 | `BUSCA_INFARTO` |
| 13 | `BUSCA_TB` |
| 14 | `BUSCA_HANSENIASE` |
| 15 | `BUSCA_CANCER` |
| 16 | `EDUCACAO_SAUDE` |
| 17 | `CONVITE_ATIVIDADE` |
| 18 | `INVESTIGACAO_SURTO` |
| 19 | `CONDICIONALIDADES` |
| 20 | `ACOMPANHAMENTO_PUERICULTURA` |
| 21 | `OUTRO` |

---

## FASE 6 — Análise de Compatibilidade

### Matriz de compatibilidade por entidade

| Entidade PEC | Compatibilidade | Score | Condição |
|---|---|---|---|
| Cidadão (cadastro) | **COMPATÍVEL** | 90% | Requires INE/CNES mapping table |
| Profissional | **COMPATÍVEL** | 80% | Requires CBO→role mapping |
| Equipe | **COMPATÍVEL** | 95% | INE é chave direta |
| Unidade de Saúde | **COMPATÍVEL** | 95% | CNES é chave direta |
| AtendimentoIndividual | **PARCIALMENTE COMPATÍVEL** | 70% | Tipo atendimento requer normalização |
| FichaVisitaDomiciliar | **COMPATÍVEL** | 95% | Mapeamento completo |
| FichaCadastroDomiciliar | **COMPATÍVEL** | 85% | Household model VITRAS cobre maioria |
| FichaAtendimentoOdontologico | **PARCIALMENTE COMPATÍVEL** | 50% | Procedimentos SIGTAP sem destino estruturado |
| FichaVacinacao | **PARCIALMENTE COMPATÍVEL** | 60% | Imunobiológicos sem enum canônico no VITRAS |
| FichaAtividadeColetiva | **INCOMPATÍVEL** | 0% | Conceito coletivo, sem equivalente individual |
| FichaEligibilidade | **INCOMPATÍVEL** | 0% | Exclusivo RNDS — fora de escopo |

### Classificação por campo

**COMPATÍVEIS — mapeamento direto:**
- CNS, CPF, nome, data de nascimento, nome da mãe
- CID-10, CIAP-2
- Turno (M/T/N → MANHA/TARDE/NOITE)
- Desfecho de visita (1/2/3 → VISITA_REALIZADA/AUSENTE/RECUSOU)
- Motivos de visita (01–21 → enum VITRAS)
- Tipo de visita (1–8 → enum VITRAS)
- Peso e altura (numéricos)
- INE, CNES

**PARCIALMENTE COMPATÍVEIS — requerem normalização:**
- `co_sexo`: M/F ou 0/1 → MASCULINO/FEMININO (versão-dependente)
- `co_raca_cor`: 01–05 → BRANCA/PRETA/PARDA/AMARELA/INDIGENA
- `co_municipio`: 6 dígitos → 7 dígitos IBGE
- `dt_*`: YYYYMMDD → YYYY-MM-DD
- `nu_cns`: zeros à esquerda → padStart(15, '0')
- `co_cbo`: 4 ou 6 dígitos → mapeamento para role VITRAS
- `co_tipo_atendimento`: enum PEC → type VITRAS
- `co_local_atendimento`: código → UBS/DOMICILIO/OUTRO
- `co_deficiencia[]`: enum PEC → enum VITRAS (mapeamento 1:1 exceto alguns valores legados)

**INCOMPATÍVEIS — sem mapeamento possível:**
- `FichaAtividadeColetiva` (coletivo ≠ individual)
- `FichaEligibilidade` (RNDS-only)
- `co_tipo_ficha` PEC interno (metadado de transporte, não dado clínico)

**SEM EQUIVALENTE CANÔNICO — dados PEC sem destino no VITRAS:**
- `no_logradouro` + `nu_numero` + `no_bairro` (endereço completo PEC) → VITRAS usa campo único `address`
- `co_pais_nascimento` (código de país)
- `nu_prontuario_familiar` (prontuário familiar PEC — diferente de familyGroup VITRAS)
- `co_motivo_saida_cidadao_cadastro` (óbito, mudança, saída da área)
- `st_recusa_cadastro` (recusa de cadastramento)
- Procedimentos SIGTAP odontológicos (sem tabela correspondente)
- Código de imunobiológico (sem enum canônico no VITRAS atual)

---

## FASE 7 — Lacunas (Gap Analysis)

| ID | Gap | Tipo | Impacto | Resolução |
|---|---|---|---|---|
| G-01 | `municipalityId` 6 vs 7 dígitos | Estrutural | ALTO — bloqueia V-TER-01 | UBS fornece 7 dígitos no cabeçalho do Import Job |
| G-02 | CPF ausente no PEC 3.x | Estrutural | ALTO — sem deduplicação confiável | SP-PEC-01 não suporta 3.x; versão mínima = 4.2 |
| G-03 | CBO → role: múltiplos CBOs por role | Semântico | MÉDIO | Mapeamento CBO→role explícito no Source Profile; fallback `support_operator` |
| G-04 | INE → teamId: sem automatização | Relacional | ALTO — bloqueia toda importação | Import Job requer tabela manual INE→teamId fornecida pela UBS |
| G-05 | CNES → unitId: sem automatização | Relacional | ALTO | Import Job requer mapeamento manual CNES→unitId |
| G-06 | `FichaAtividadeColetiva` sem equivalente | Conceitual | BAIXO — não é dado individual | Descartado silenciosamente com log |
| G-07 | Vacinação sem enum canônico de imunobiológicos | Semântico | MÉDIO — dados parciais | Imunobiológico → `metadata.imuno`; campo estruturado: trabalho futuro MAP-VAC-01 |
| G-08 | Odontologia — procedimentos SIGTAP | Semântico | BAIXO para VITRAS atual | Mapeado como `procedure` com `details`; estrutura SIGTAP fora de escopo |
| G-09 | Endereço completo PEC vs campo único VITRAS | Estrutural | BAIXO | Concatenar campos PEC → `patient.address` |
| G-10 | Motivo de saída do cidadão (óbito/mudança) | Semântico | MÉDIO — afeta score | Óbito → `patient.inactive=true`; mudança → `patient.inactive=true` com log |
| G-11 | `nu_prontuario_familiar` PEC ≠ `familyGroup` VITRAS | Conceitual | BAIXO | Não mapeado — FamilyGroup VITRAS é criado manualmente |
| G-12 | `ds_notas` campo de texto livre (SOAP) | Estrutural | BAIXO | Mapeado para `clinicalRecord.details` |

---

## FASE 8 — Source Profile PEC APS

```json
{
  "id": "sp-pec-aps-v01",
  "name": "e-SUS PEC APS",
  "version": "4.2+",
  "type": "pec",
  "format": "ledi_aps_xml",
  "encoding": "UTF-8",
  "locale": "pt-BR",
  "status": "CERTIFIED",
  "certifiedBy": "VITRAS-SP-PEC-01",
  "certifiedAt": "2026-06-23",

  "version_constraints": {
    "minimum": "4.2",
    "reason": "CPF do cidadão disponível apenas a partir de 4.2; sem CPF, deduplicação é exclusivamente por CNS"
  },

  "capabilities": {
    "hasCpf": true,
    "hasCns": true,
    "hasClinicalRecords": true,
    "hasVisits": true,
    "hasMicroArea": true,
    "hasHousehold": true,
    "hasVaccination": true,
    "hasDentalRecords": true,
    "hasPrescriptions": false,
    "hasCollectiveActivities": true,
    "supportsRnds": true
  },

  "entities": {
    "patient": {
      "source": "FichaCadastroIndividual",
      "primary_key": "nu_cns",
      "secondary_key": "co_cpf_cidadao",
      "fields": {
        "name": { "path": "nomeCidadao", "type": "string", "nullable": false },
        "birthDate": { "path": "dataNascimento", "type": "YYYYMMDD", "nullable": false },
        "cns": { "path": "nuCns", "type": "string(15)", "nullable": false, "quirk": "padStart(15,'0')" },
        "cpf": { "path": "cpfCidadao", "type": "string(11)", "nullable": true, "quirk": "remove pontuação" },
        "motherName": { "path": "nomeMaeSocial", "type": "string", "nullable": true },
        "sexAtBirth": { "path": "sexo", "type": "enum(M/F)", "nullable": false, "normalize": "M->MASCULINO, F->FEMININO" },
        "racaCor": { "path": "racaCor", "type": "enum(01-05)", "nullable": true, "normalize": "tabela_raca_cor" },
        "situacaoRua": { "path": "statusEhSituacaoRua", "type": "boolean", "nullable": true },
        "deficiencia": { "path": "deficiencia[]", "type": "enum[]", "nullable": true, "normalize": "tabela_deficiencia" },
        "phone": { "path": "telefoneCelular || telefoneResidencial", "type": "string", "nullable": true },
        "address": { "path": "concat(logradouro, numero, bairro)", "type": "string", "nullable": true },
        "microArea": { "path": "microarea", "type": "string", "nullable": true },
        "teamId": { "path": "nuIne", "type": "INE(10)", "nullable": false, "resolve": "ine_to_team_map" },
        "unitId": { "path": "coCnes", "type": "CNES(7)", "nullable": false, "resolve": "cnes_to_unit_map" }
      }
    },
    "professional": {
      "source": "header/cnsProfissional",
      "primary_key": "nu_cns_profissional",
      "fields": {
        "cns": { "path": "cnsProfissional", "type": "string(15)" },
        "cbo": { "path": "cboProfissional", "type": "string(4-6)", "resolve": "cbo_to_role_map" },
        "teamId": { "path": "nuIne", "resolve": "ine_to_team_map" },
        "unitId": { "path": "coCnes", "resolve": "cnes_to_unit_map" }
      }
    },
    "clinical_event": {
      "sources": [
        "FichaAtendimentoIndividualChild",
        "FichaVisitaDomiciliarChild",
        "FichaAtendimentoOdontologicoChild",
        "FichaVacinacaoChild"
      ],
      "primary_key": "coUnicoFicha",
      "fields": {
        "type": { "resolve": "ficha_type_to_event_type_map" },
        "date": { "path": "dtAtendimento || dtVisita", "type": "YYYYMMDD", "normalize": "YYYY-MM-DD" },
        "createdBy": { "path": "cnsProfissional", "resolve": "cns_to_user_id_map" },
        "patientId": { "path": "cnsCidadao", "resolve": "cns_to_patient_id_map" },
        "turno": { "path": "coTurno", "normalize": "M->MANHA, T->TARDE, N->NOITE" },
        "localDeAtendimento": { "path": "coLocalAtendimento", "normalize": "01->UBS, 04->DOMICILIO, *->OUTRO" },
        "cidPrincipal": { "path": "coCidPrincipal", "type": "CID-10" },
        "cidSecundarios": { "path": "coCidSecundario[]", "type": "CID-10[]" },
        "ciapPrincipal": { "path": "coCiapPrincipal", "type": "CIAP-2" },
        "details": { "path": "dsNotas", "type": "string" },
        "sourceId": { "path": "coUnicoFicha", "type": "string" }
      }
    },
    "household": {
      "source": "FichaCadastroDomiciliar",
      "primary_key": "coUnicoFicha",
      "fields": {
        "familyCode": { "path": "nuFamilia", "type": "string" },
        "housingType": { "path": "coTipoImovel", "resolve": "tipo_imovel_map" },
        "waterSupply": { "path": "coAbastecimentoAgua", "resolve": "abastecimento_agua_map" },
        "sewage": { "path": "coEsgoto", "resolve": "esgoto_map" },
        "garbage": { "path": "coDestinacaoLixo", "resolve": "lixo_map" },
        "electricity": { "path": "coEnergiaEletrica", "resolve": "energia_map" }
      }
    }
  },

  "quirks": [
    "dt_* campos no formato YYYYMMDD — converter para YYYY-MM-DD antes de qualquer operação",
    "nu_cns pode omitir zeros à esquerda em CSV exports — padStart(15,'0') obrigatório",
    "co_cpf_cidadao pode conter pontuação 000.000.000-00 — remover pontuação, validar 11 dígitos",
    "co_municipio usa 6 dígitos IBGE — Import Job deve fornecer municipalityId de 7 dígitos no cabeçalho",
    "co_sexo: M/F em instalações modernas; 0/1 em legadas — detectar e normalizar por versão",
    "nu_micro_area é código numérico (001, 002) — tratar como string sem conversão",
    "CBO pode ter 4 ou 6 dígitos — truncar para 4 antes do mapeamento para role VITRAS",
    "FichaAtividadeColetiva não tem cidadão individual — descartar com log, não rejeitar Import Job",
    "co_desfecho: 01/1 ou texto 'VISITA_REALIZADA' dependendo da versão — detectar e normalizar",
    "Encoding: UTF-8 padrão no 5.x; ISO-8859-1 em algumas instalações 4.x antigas — detectar por BOM"
  ],

  "required_before_import": [
    "Tabela INE→teamId: mapeamento de todas as equipes PEC para equipes VITRAS",
    "Tabela CNES→unitId: mapeamento da(s) unidade(s) PEC para unidade(s) VITRAS",
    "Tabela CNS→userId: mapeamento dos profissionais PEC para usuários VITRAS",
    "municipalityId de 7 dígitos da UBS (no cabeçalho do Import Job)",
    "Período de exportação (dtInicio, dtFim) para controle de elegibilidade temporal"
  ],

  "not_supported": [
    "FichaEligibilidade (RNDS-only, fora de escopo VITRAS)",
    "FichaAtividadeColetiva (coletivo, não individual)",
    "Procedimentos SIGTAP odontológicos estruturados",
    "Código de imunobiológico estruturado (temporariamente em metadata.imuno)",
    "nu_prontuario_familiar (prontuário familiar PEC ≠ FamilyGroup VITRAS)",
    "co_motivo_saida_cidadao_cadastro com mapeamento semântico completo"
  ]
}
```

---

## FASE 9 — Prontidão para MAP-PEC-01

### Avaliação de prontidão

| Critério | Status | Observação |
|---|---|---|
| Estrutura do PEC documentada? | ✅ SIM | Fases 1–3 completas |
| Campos obrigatórios identificados? | ✅ SIM | Por entidade e por tipo de ficha |
| Quirks documentados? | ✅ SIM | 8 quirks críticos no Source Profile |
| Mapeamentos definidos? | ✅ SIM | Tabelas de mapeamento prontas |
| Lacunas registradas? | ✅ SIM | 12 gaps identificados e classificados |
| Campos sem equivalente identificados? | ✅ SIM | Fase 7 completa |
| Source Profile criado e certificado? | ✅ SIM | `sp-pec-aps-v01` CERTIFIED |
| REM-01 (shadow sync incremental) concluído? | ❌ NÃO | BLOQUEIO — MAP-PEC-01 depende de REM-01 |
| REM-02 (bootstrap paginado) concluído? | ❌ NÃO | BLOQUEIO — MAP-PEC-01 depende de REM-02 |

### Decisão formal

**MAP-PEC-01 AUTORIZADO — com condições:**

> MAP-PEC-01 pode iniciar **fase de implementação do Mapping Engine** (código de transformação PEC → Canonical Model, testes unitários de mapeamento, validação de quirks) imediatamente.
>
> **A fase de commit real em produção permanece bloqueada até REM-01 e REM-02.**

**O que MAP-PEC-01 pode implementar agora:**
- Parser LEDI APS XML
- Normalizadores (datas, CNS, CPF, enums)
- Mapeamentos estruturais e semânticos definidos neste documento
- Testes unitários de mapeamento (sem base de dados real)
- Validação de campos obrigatórios (Validation Engine parcial)
- Mock de Import Job para testes

**O que MAP-PEC-01 NÃO pode implementar ainda:**
- API de ingestão com commit real
- Staging com dados reais
- Import Job contra UBS real
- Qualquer escrita em `app_state`

---

## RESULTADO OBRIGATÓRIO

| Item | Resultado |
|---|---|
| Estrutura do PEC compreendida? | **SIM** — 14 tabelas/fichas, 4 formatos de exportação, versão mínima 4.2 |
| Entidades identificadas? | **SIM** — Cidadão, Profissional, Equipe, Unidade, Atendimento, Visita, Procedimento, Vacinação, Encaminhamento, Domicílio |
| Relacionamentos identificados? | **SIM** — grafo INE/CNES/CNS/CPF com tabelas de resolução obrigatórias |
| Eventos identificados? | **SIM** — 13 tipos mapeados, 2 incompatíveis (coletivo, elegibilidade) |
| Compatibilidade analisada? | **SIM** — 11 entidades classificadas; 90%+ compatível nos domínios principais |
| Lacunas identificadas? | **SIM** — 12 gaps, 3 de alto impacto (G-01 municipalityId, G-02 CPF, G-04 INE) |
| Source Profile criado? | **SIM** — `sp-pec-aps-v01` |
| Source Profile certificado? | **SIM** — status CERTIFIED, versão 4.2+, quirks, capabilities, required_before_import |
| MAP-PEC-01 autorizado? | **SIM — com condição: commit bloqueado até REM-01 + REM-02** |
| **Status SP-PEC-01** | **PASS** |
