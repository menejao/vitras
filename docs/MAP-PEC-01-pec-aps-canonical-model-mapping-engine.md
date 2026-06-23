# MAP-PEC-01 — PEC APS to Canonical Model Mapping Engine

**Emitido em:** 2026-06-23  
**Status:** PASS  
**Depende de:** ARCH-INT-01 (PASS), SP-PEC-01 (PASS — `sp-pec-aps-v01` CERTIFIED)  
**Pré-requisito para:** UI-STG-01, UI-HOMO-01  
**Implementação de ingestão real:** BLOQUEADA até REM-01 + REM-02  
**Autoridade:** Este documento é a especificação formal de tradução PEC APS → Canonical Model VITRAS APS

---

## GOV-01

| # | Critério | Resultado |
|---|---|---|
| 1 | Mapeamento de paciente definido? | **SIM** |
| 2 | Mapeamento de profissional definido? | **SIM** |
| 3 | Mapeamento de equipe definido? | **SIM** |
| 4 | Mapeamento de unidade definido? | **SIM** |
| 5 | Mapeamento de eventos assistenciais definido? | **SIM** |
| 6 | Mapeamento de condições clínicas definido? | **SIM** |
| 7 | Mapeamento de indicadores definido? | **SIM** |
| 8 | Regras de certeza 100% aplicadas? | **SIM** |
| 9 | Ambiguidades identificadas? | **SIM** |
| 10 | Gaps documentados? | **SIM** |
| 11 | Auditabilidade preservada? | **SIM** |
| 12 | MAP-PEC-01 pronto para homologação? | **SIM** |

---

## Convenções deste documento

| Símbolo | Significado |
|---|---|
| ✅ COMPATIBLE | Mapeamento direto, certeza 100%, aprovado automaticamente |
| ⚙️ NORMALIZE | Requer transformação determinística antes do mapeamento |
| 🔑 RESOLVE | Requer lookup em tabela de resolução externa (INE/CNES/CNS) |
| ⚠️ PARTIAL | Campo parcialmente compatível — regra de certeza aplicada, parte rejeitada |
| ❌ NO_EQUIV | Sem equivalente no Canonical Model — descartado com log |
| 🚫 BLOCKED | Incompatível — rejeita o registro se campo for obrigatório no canônico |

**Regra universal de certeza:** qualquer mapeamento classificado como ⚠️ PARTIAL tem a parte ambígua rejeitada — nunca estimada ou inferida. Campo descartado ≠ registro rejeitado; campo obrigatório descartado = registro rejeitado.

---

## FASE 1 — Patient Mapping Matrix

### Tabela completa de campos

| Campo PEC | Path LEDI APS | Classificação | Campo Canônico VITRAS | Regra de Transformação |
|---|---|---|---|---|
| `nuCns` | `FichaCadastroIndividual/nuCns` | ✅ COMPATIBLE | `patient.cns` | padStart(15, '0') |
| `cpfCidadao` | `FichaCadastroIndividual/cpfCidadao` | ⚙️ NORMALIZE | `patient.cpf` | remover `.` e `-`; validar 11 dígitos + dígito verificador |
| `nomeCidadao` | `FichaCadastroIndividual/nomeCidadao` | ✅ COMPATIBLE | `patient.name` | trim(); min 2 chars |
| `nomeSocial` | `FichaCadastroIndividual/nomeSocial` | ✅ COMPATIBLE | `patient.nomeSocial` | trim(); null se vazio |
| `dataNascimento` | `FichaCadastroIndividual/dataNascimento` | ⚙️ NORMALIZE | `patient.birthDate` | YYYYMMDD → YYYY-MM-DD; validar ≥ 1900, ≤ hoje |
| `nomeMaeSocial` | `FichaCadastroIndividual/nomeMaeSocial` | ✅ COMPATIBLE | `patient.motherName` | trim(); null se vazio |
| `sexo` | `FichaCadastroIndividual/sexo` | ⚙️ NORMALIZE | `patient.sexAtBirth` | ver Enum §7.1 |
| `racaCor` | `FichaCadastroIndividual/racaCor` | ⚙️ NORMALIZE | `patient.racaCor` | ver Enum §7.2; LGPD Art.11 |
| `genderIdentity` | não existe no PEC | ❌ NO_EQUIV | — | não mapeado; campo fica null |
| `telefoneCelular` | `FichaCadastroIndividual/telefoneCelular` | ⚙️ NORMALIZE | `patient.phone` | preferido sobre residencial; manter só dígitos |
| `telefoneResidencial` | `FichaCadastroIndividual/telefoneResidencial` | ⚙️ NORMALIZE | `patient.phone` | fallback se celular ausente |
| `logradouro + numero + bairro` | múltiplos campos | ⚙️ NORMALIZE | `patient.address` | concat: `"${logradouro}, ${numero} — ${bairro}"` |
| `microarea` | `FichaCadastroIndividual/microarea` | ✅ COMPATIBLE | `patient.microArea` | string; preservar código como string sem conversão |
| `nuIne` | FK equipe | 🔑 RESOLVE | `patient.teamId` | INE(10) → UUID VITRAS via `ine_to_team_map` |
| `coCnes` | FK unidade | 🔑 RESOLVE | `patient.unitId` | CNES(7) → UUID VITRAS via `cnes_to_unit_map` |
| `municipioNascimento` | `FichaCadastroIndividual/municipioNascimento` | ❌ NO_EQUIV | — | município de nascimento ≠ município de residência; não mapeado |
| `municipioResidencia` | `FichaCadastroIndividual/municipioResidencia` | ⚙️ NORMALIZE | `patient.municipalityId` | IBGE 6 dígitos → 7 dígitos; preferência: cabeçalho Import Job |
| `statusEhSituacaoRua` | `FichaCadastroIndividual/statusEhSituacaoRua` | ✅ COMPATIBLE | `patient.situacaoRua` | boolean; LGPD Art.11 |
| `deficiencia[]` | `FichaCadastroIndividual/deficiencia` | ⚙️ NORMALIZE | `patient.deficiencia[]` | ver Enum §7.4; LGPD Art.11 |
| `statusEhGestante` | `FichaCadastroIndividual/statusEhGestante` | ⚙️ NORMALIZE | `patient.careCategory` | se `true` → `pregnant`; não sobrescreve careCategory já definido |
| `condicoesSaude[]` | `FichaCadastroIndividual/condicoesSaude` | ⚙️ NORMALIZE | `patient.careCategory` + `patient.chronicConditions[]` | ver Condition Mapping §6 |
| `motivoCadastro` | `FichaCadastroIndividual/motivoCadastro` | ❌ NO_EQUIV | — | metadado PEC; sem equivalente |
| `statusEhFaleceu` | `FichaCadastroIndividual/statusEhFaleceu` | ⚙️ NORMALIZE | `patient.inactive` | se `true` → `inactive = true`; não rejeita registro |
| `statusEhSaidaCadastro` | `FichaCadastroIndividual/statusEhSaidaCadastro` | ⚙️ NORMALIZE | `patient.inactive` | motivo de saída → `inactive = true` com log de motivo |
| `dtAtualizado` | header | ✅ COMPATIBLE | `patient.updatedAt` | ISO 8601 |
| `coUnicoFicha` | `FichaCadastroIndividual/coUnicoFicha` | ✅ COMPATIBLE | `patient.sourceId` | string; identificador de rastreabilidade |
| `nuProntuarioFamiliar` | `FichaCadastroIndividual/nuProntuarioFamiliar` | ❌ NO_EQUIV | — | prontuário familiar PEC ≠ FamilyGroup VITRAS |
| `responsavelCidadao` | `FichaCadastroIndividual/responsavelCidadao` | ❌ NO_EQUIV | — | relação de responsabilidade não modela em VITRAS atualmente |

### Campos gerados pelo pipeline (não vêm do PEC)

| Campo Canônico VITRAS | Origem | Regra |
|---|---|---|
| `patient.id` | UUID gerado | `uuidv4()` no momento do commit |
| `patient.importJobId` | Import Job | ID do Import Job em execução |
| `patient.sourceSystem` | Source Profile | `"sp-pec-aps-v01"` |
| `patient.createdAt` | pipeline | `new Date().toISOString()` |
| `patient.createdBy` | Import Job | `importJob.createdBy` (support_admin) |
| `patient.incompleteProfile` | derivado | `true` se CPF e CNS ausentes |

### Regras de careCategory derivadas do cadastro

| Condição PEC | `careCategory` VITRAS | Prioridade |
|---|---|---|
| `statusEhGestante = true` | `pregnant` | 1 (mais específico) |
| `condicoesSaude` contém hipertensão OU diabetes OU TB | `chronic` | 2 |
| Criança < 2 anos (birthDate nos últimos 24 meses) | `child_followup` | 3 |
| Nenhuma das anteriores | `general` | default |
| `condicoesSaude` contém `PUERPERA` | `puerperal` | 1 (igual a gestante) |

**Regra de conflito:** gestante + crônica → `pregnant` (Rede Cegonha tem maior protocolo). Puérpera + crônica → `puerperal`.

---

## FASE 2 — Professional Mapping Matrix

### Tabela de campos

| Campo PEC | Path LEDI APS | Classificação | Campo Canônico VITRAS | Regra |
|---|---|---|---|---|
| `cnsProfissional` | `header/cnsProfissional` | ✅ COMPATIBLE | identificador de lookup | CNS → `user.id` via `cns_to_user_map` |
| `cpfProfissional` | `header/cpfProfissional` | ⚙️ NORMALIZE | identificador secundário | remover pontuação; fallback se CNS ausente |
| `nomeProfissional` | base cadastral PEC | ✅ COMPATIBLE | `user.name` | trim() |
| `cboProfissional` | `header/cboProfissional` | 🔑 RESOLVE | `user.role` | ver §7.5 — CBO → role VITRAS |
| `nuIne` | FK equipe | 🔑 RESOLVE | `user.teamId` | INE → teamId via `ine_to_team_map` |
| `coCnes` | FK unidade | 🔑 RESOLVE | `user.unitId` | CNES → unitId via `cnes_to_unit_map` |
| `vinculo` | `header/vinculo` | ❌ NO_EQUIV | — | tipo de vínculo trabalhista sem equivalente |
| `cns` | `profissional/coConselhoClasse` | ⚠️ PARTIAL | `user.councilType` + `user.councilNumber` | requer parser específico por conselho |

### Regra de resolução de profissional

O pipeline não cria usuários VITRAS automaticamente a partir do PEC. Profissionais devem existir em VITRAS antes da importação.

**Sequência de lookup:**

```
1. cnsProfissional → buscar em app_users por campo cns (futuro) ou por mapeamento cns_to_user_map
2. cpfProfissional → buscar em app_users por cpf (se CNS não resolver)
3. não encontrado → evento rejeitado (V-REF-02: createdBy inexistente)
```

**Exceção:** se Import Job configurar `fallback_professional_id`, eventos sem profissional resolvível são vinculados ao profissional fallback em vez de rejeitados. Deve ser `break_glass_admin` da UBS.

---

## FASE 3 — Unit Mapping Matrix

### Tabela de campos

| Campo PEC | Classificação | Campo Canônico VITRAS | Regra |
|---|---|---|---|
| `coCnes` | 🔑 RESOLVE | `unit.id` (UUID VITRAS) | CNES(7) → UUID via `cnes_to_unit_map` obrigatória |
| `noUnidadeSaude` | ✅ COMPATIBLE | `unit.name` (referência) | usado apenas para validação cruzada, não sobrescreve |
| `coMunicipio` | ⚙️ NORMALIZE | `unit.municipalityId` | IBGE 6 → 7 dígitos; cabeçalho Import Job tem precedência |
| `coTipoUnidade` | ❌ NO_EQUIV | — | tipo de unidade PEC (UBS/CEO/CAPS) sem campo canônico VITRAS |
| `nuTelefone` | ❌ NO_EQUIV | — | telefone da unidade sem campo canônico |

### Regra de resolução de unidade

Unidade VITRAS deve existir antes do Import Job. A tabela `cnes_to_unit_map` é fornecida pela UBS no cabeçalho do Import Job:

```json
{ "cnes_to_unit": { "1234567": "uuid-vitras-unit" } }
```

CNES não encontrado no mapa → Import Job falha na fase de validação (V-TER-04).

---

## FASE 4 — Team Mapping Matrix

### Tabela de campos

| Campo PEC | Classificação | Campo Canônico VITRAS | Regra |
|---|---|---|---|
| `nuIne` | 🔑 RESOLVE | `team.id` (UUID VITRAS) | INE(10) → UUID via `ine_to_team_map` obrigatória |
| `noEquipe` | ✅ COMPATIBLE | `team.name` (referência) | validação cruzada apenas |
| `tpEquipe` | ⚠️ PARTIAL | não mapeado | código de tipo (70=eSF, 76=eAP) sem campo VITRAS; registrado em log |
| `coArea` | ❌ NO_EQUIV | — | código de área PEC sem equivalente |

### Regra de resolução de equipe

A tabela `ine_to_team_map` é fornecida pela UBS:

```json
{ "ine_to_team": { "0000001234": "uuid-vitras-team" } }
```

INE não encontrado → pacientes/eventos dessa equipe rejeitados (V-TER-03).

---

## FASE 5 — Clinical Event Mapping Matrix

### 5.1 — FichaAtendimentoIndividual → ClinicalRecord

| Campo PEC | Classificação | Campo Canônico VITRAS | Regra |
|---|---|---|---|
| `nuCnsCidadao` | 🔑 RESOLVE | `clinicalRecord.patientId` | CNS → UUID via `cns_to_patient_map` |
| `nuCnsProfissional` | 🔑 RESOLVE | `clinicalRecord.createdBy` | CNS → UUID via `cns_to_user_map` |
| `dtAtendimento` | ⚙️ NORMALIZE | `clinicalRecord.date` | YYYYMMDD → YYYY-MM-DD |
| `coTurno` | ⚙️ NORMALIZE | `clinicalRecord.turno` | ver Enum §7.6 |
| `coLocalAtendimento` | ⚙️ NORMALIZE | `clinicalRecord.localDeAtendimento` | ver Enum §7.7 |
| `coTipoAtendimento` | 🔑 RESOLVE | `clinicalRecord.type` | ver §5.1.1 — tabela de tipos |
| `coCidPrincipal` | ✅ COMPATIBLE | `clinicalRecord.cidPrincipal` | já no formato CID-10; validar contra tabela CID |
| `coCidSecundario[]` | ✅ COMPATIBLE | `clinicalRecord.cidSecundarios[]` | array; max 10 |
| `coCiapPrincipal` | ✅ COMPATIBLE | `clinicalRecord.ciapPrincipal` | já no formato CIAP-2; validar contra tabela CIAP |
| `dsNotas` | ✅ COMPATIBLE | `clinicalRecord.details` | texto livre; max 20.000 chars (truncar se necessário) |
| `coUnicoFicha` | ✅ COMPATIBLE | `clinicalRecord.sourceId` | identificador de deduplicação |
| `procedimentoRealizado[]` | ⚠️ PARTIAL | `clinicalRecord.metadata.procedimentos[]` | códigos SIGTAP em metadata; não estruturado |
| `medicamentoPrescrito[]` | ⚠️ PARTIAL | evento separado `type=prescription` | ver §5.5 |
| `exameSolicitado[]` | ⚠️ PARTIAL | evento separado `type=exam_request` | ver §5.6 |
| `encaminhamento[]` | ⚠️ PARTIAL | evento separado `type=referral` | ver §5.7 |
| `problemaConcicaoAvaliada[]` | ⚙️ NORMALIZE | `clinicalRecord.cidPrincipal` + `cidSecundarios[]` | duplica CID/CIAP do atendimento se não preenchidos |
| `nuIne` | 🔑 RESOLVE | `clinicalRecord.teamId` | INE → teamId |

#### 5.1.1 — Mapeamento `coTipoAtendimento` → `type` VITRAS

| `coTipoAtendimento` PEC | Descrição PEC | `type` VITRAS | Certeza |
|---|---|---|---|
| `CONSULTA_NO_DIA` | Consulta de demanda espontânea | `consultation` | 100% |
| `CONSULTA_AGENDADA` | Consulta agendada | `consultation` | 100% |
| `CONSULTA_AGENDADA_PROGRAMADA` | Consulta programada | `consultation` | 100% |
| `RETORNO` | Retorno | `return` | 100% |
| `URGENCIA` | Urgência/emergência | `consultation` | 100% |
| `ESCUTA_INICIAL_OU_ORIENTACAO` | Escuta inicial / orientação | `evolution` | 100% |
| `PROCEDIMENTO` | Procedimento | `procedure` | 100% |
| `ATENDIMENTO_DE_URGENCIA` | Atendimento de urgência | `consultation` | 100% |
| `ACOMPANHAMENTO` | Acompanhamento | `evolution` | 100% |
| `TELEATENDIMENTO_DERIVADO_DE_TELECONSULTA` | Teleconsulta | `consultation` | 100% |
| *(valor desconhecido)* | — | 🚫 BLOCKED | rejeita evento (campo obrigatório) |

### 5.2 — FichaVisitaDomiciliar → ClinicalRecord (type=visit)

| Campo PEC | Classificação | Campo Canônico VITRAS | Regra |
|---|---|---|---|
| `nuCnsCidadao` | 🔑 RESOLVE | `clinicalRecord.patientId` | CNS → UUID |
| `nuCnsAcs` | 🔑 RESOLVE | `clinicalRecord.createdBy` | CNS do ACS → UUID |
| `dtVisita` | ⚙️ NORMALIZE | `clinicalRecord.dataVisita` | YYYYMMDD → YYYY-MM-DD |
| `coTurno` | ⚙️ NORMALIZE | `clinicalRecord.turno` | ver Enum §7.6 |
| `coTipoVisita` | ⚙️ NORMALIZE | `clinicalRecord.tipoVisita` | ver Enum §7.8 |
| `coMotivoVisita[]` | ⚙️ NORMALIZE | `clinicalRecord.motivosVisita[]` | ver Enum §7.9; min 1 item |
| `coDesfecho` | ⚙️ NORMALIZE | `clinicalRecord.desfecho` | ver Enum §7.10 |
| `nuPeso` | ✅ COMPATIBLE | `clinicalRecord.metadata.peso` | decimal kg; null se ausente |
| `nuAltura` | ✅ COMPATIBLE | `clinicalRecord.metadata.altura` | decimal cm; null se ausente |
| `stVisitaSharedWithTeam` | ❌ NO_EQUIV | — | compartilhamento de visita PEC sem equivalente |
| `coUnicoFicha` | ✅ COMPATIBLE | `clinicalRecord.sourceId` | identificador |
| — | gerado | `clinicalRecord.type` | sempre `"visit"` |
| — | gerado | `clinicalRecord.date` | igual a `dataVisita` |
| — | gerado | `clinicalRecord.title` | `"Visita domiciliar — ${desfecho}"` |

**Score impact:** visitas com `desfecho=VISITA_REALIZADA` e `dataVisita` nos últimos 90 dias contribuem `+25 pontos` ao componente `recentVisit` do score familiar.

### 5.3 — FichaAtendimentoOdontologico → ClinicalRecord (type=procedure)

| Campo PEC | Classificação | Campo Canônico VITRAS | Regra |
|---|---|---|---|
| `nuCnsCidadao` | 🔑 RESOLVE | `clinicalRecord.patientId` | CNS → UUID |
| `nuCnsDentista` | 🔑 RESOLVE | `clinicalRecord.createdBy` | CNS dentista → UUID (role=dentist) |
| `dtAtendimento` | ⚙️ NORMALIZE | `clinicalRecord.date` | YYYYMMDD → YYYY-MM-DD |
| `procedimentoOdontologico[]` | ⚠️ PARTIAL | `clinicalRecord.metadata.sigtap[]` | códigos SIGTAP; sem enum canônico |
| `coCidPrincipal` | ✅ COMPATIBLE | `clinicalRecord.cidPrincipal` | se presente |
| `coUnicoFicha` | ✅ COMPATIBLE | `clinicalRecord.sourceId` | |
| — | gerado | `clinicalRecord.type` | sempre `"procedure"` |
| — | gerado | `clinicalRecord.title` | `"Atendimento odontológico"` |

### 5.4 — FichaVacinacao → ClinicalRecord (type=vaccine)

| Campo PEC | Classificação | Campo Canônico VITRAS | Regra |
|---|---|---|---|
| `nuCnsCidadao` | 🔑 RESOLVE | `clinicalRecord.patientId` | CNS → UUID |
| `nuCnsVacinador` | 🔑 RESOLVE | `clinicalRecord.createdBy` | CNS → UUID |
| `dtVacinacao` | ⚙️ NORMALIZE | `clinicalRecord.date` | YYYYMMDD → YYYY-MM-DD |
| `coImunobiologico` | ⚠️ PARTIAL | `clinicalRecord.metadata.imuno` + `clinicalRecord.title` | código SIGTAP → nome da vacina via tabela `imuno_to_name`; sem enum canônico VITRAS |
| `doseVacina` | ✅ COMPATIBLE | `clinicalRecord.metadata.dose` | string (`D1`, `D2`, `Reforço`, etc.) |
| `nuLote` | ✅ COMPATIBLE | `clinicalRecord.metadata.lote` | string |
| `coUnicoFicha` | ✅ COMPATIBLE | `clinicalRecord.sourceId` | |
| — | gerado | `clinicalRecord.type` | sempre `"vaccine"` |

**Tabela parcial `imuno_to_name` (SIGTAP → nome):**

| Código SIGTAP | Nome da vacina | `protocolTag` VITRAS |
|---|---|---|
| 04.01.01.001-0 | BCG | `BCG` |
| 04.01.01.002-9 | Hepatite B | `Hepatite B` |
| 04.01.01.018-5 | Pentavalente | `Pentavalente` |
| 04.01.01.042-8 | Influenza | `Influenza` |
| 04.01.01.052-5 | dTpa | `dTpa` |
| 04.01.01.054-1 | COVID-19 | `COVID-19` |
| *(outros)* | sem mapeamento | `metadata.imuno = codigo` (sem `protocolTag`) |

### 5.5 — Prescrição (sub-evento de AtendimentoIndividual)

PEC não tem Ficha de Prescrição separada. Medicamentos prescritos ficam em `medicamentoPrescrito[]` dentro do `AtendimentoIndividual`.

**Regra de extração:** um `ClinicalRecord` de `type=prescription` é criado para cada `AtendimentoIndividual` que tenha `medicamentoPrescrito[]` com ao menos um item.

| Campo PEC (dentro do atendimento) | Classificação | Campo Canônico VITRAS | Regra |
|---|---|---|---|
| `medicamentoPrescrito[].principioAtivo` | ✅ COMPATIBLE | `clinicalRecord.details` (linha) | concatenado com posologia |
| `medicamentoPrescrito[].posologia` | ✅ COMPATIBLE | `clinicalRecord.details` (linha) | |
| `medicamentoPrescrito[].viaAdministracao` | ✅ COMPATIBLE | `clinicalRecord.details` (linha) | |
| — | gerado | `clinicalRecord.type` | `"prescription"` |
| — | herdado | `clinicalRecord.patientId` | do AtendimentoIndividual pai |
| — | herdado | `clinicalRecord.createdBy` | do AtendimentoIndividual pai |
| — | herdado | `clinicalRecord.date` | do AtendimentoIndividual pai |
| — | derivado | `clinicalRecord.sourceId` | `"${coUnicoFichaAtendimento}:prescription"` |

### 5.6 — Solicitação de Exame (sub-evento de AtendimentoIndividual)

| Campo PEC | Classificação | Campo Canônico VITRAS | Regra |
|---|---|---|---|
| `exameSolicitado[].coExame` | ⚠️ PARTIAL | `clinicalRecord.metadata.examCode` | código SIGTAP; sem enum canônico |
| `exameSolicitado[].noExame` | ✅ COMPATIBLE | `clinicalRecord.title` | nome do exame |
| `exameSolicitado[].dtSolicitacao` | ⚙️ NORMALIZE | `clinicalRecord.date` | YYYYMMDD → YYYY-MM-DD |
| — | gerado | `clinicalRecord.type` | `"exam_request"` |
| — | derivado | `clinicalRecord.sourceId` | `"${coUnicoFichaAtendimento}:exam:${index}"` |

### 5.7 — Encaminhamento (sub-evento de AtendimentoIndividual)

| Campo PEC | Classificação | Campo Canônico VITRAS | Regra |
|---|---|---|---|
| `encaminhamento.coClassificacaoRisco` | ⚙️ NORMALIZE | `clinicalRecord.metadata.priority` | VERMELHO/LARANJA/AMARELO/VERDE/AZUL → urgência |
| `encaminhamento.coCidPrincipal` | ✅ COMPATIBLE | `clinicalRecord.cidPrincipal` | se presente |
| `encaminhamento.noEspecialidade` | ✅ COMPATIBLE | `clinicalRecord.title` | especialidade de destino |
| `encaminhamento.coJustificativa` | ✅ COMPATIBLE | `clinicalRecord.details` | texto |
| — | gerado | `clinicalRecord.type` | `"referral"` |
| — | derivado | `clinicalRecord.sourceId` | `"${coUnicoFichaAtendimento}:referral"` |

### 5.8 — Eventos não mapeáveis (descarte com log)

| Ficha PEC | Motivo | Ação |
|---|---|---|
| `FichaAtividadeColetiva` | Evento coletivo — sem cidadão individual | Descartar com log: `"COLETIVO_DESCARTADO"` |
| `FichaEligibilidade` | RNDS-only, fora de escopo | Descartar com log: `"RNDS_ONLY"` |

---

## FASE 6 — Condition Mapping Matrix

### 6.1 — `condicoesSaude[]` PEC → VITRAS

PEC armazena condições de saúde como array de enums no `FichaCadastroIndividual.condicoesSaude`. Esses enums mapeiam para campos estruturados no VITRAS.

| Código PEC `condicoesSaude` | Descrição | Campo VITRAS | Valor | Certeza |
|---|---|---|---|---|
| `HIPERTENSAO_ARTERIAL` | Hipertensão arterial | `chronicConditions[]` | `"Hipertensão Arterial"` | 100% |
| `DIABETES` | Diabetes mellitus | `chronicConditions[]` | `"Diabetes"` | 100% |
| `ASMA` | Asma | `chronicConditions[]` | `"Asma"` | 100% |
| `DPOC_ENFISEMA` | DPOC/Enfisema | `chronicConditions[]` | `"DPOC"` | 100% |
| `CANCER` | Câncer (geral) | `chronicConditions[]` | `"Câncer"` | 100% |
| `GESTANTE` | Gestante | `careCategory` | `pregnant` | 100% |
| `PUERPERA` | Puérpera | `careCategory` | `puerperal` | 100% |
| `TUBERCULOSE` | Tuberculose | `chronicConditions[]` | `"Tuberculose"` | 100% |
| `HANSENIASE` | Hanseníase | `chronicConditions[]` | `"Hanseníase"` | 100% |
| `SAUDE_MENTAL` | Saúde mental | `chronicConditions[]` | `"Saúde Mental"` | 100% |
| `RENAL_CRONICO` | Doença renal crônica | `chronicConditions[]` | `"Doença Renal Crônica"` | 100% |
| `CARDIOVASCULAR` | Doença cardiovascular | `chronicConditions[]` | `"Doença Cardiovascular"` | 100% |
| `HEMOGLOBINA_PATO` | Hemoglobinopatia | `chronicConditions[]` | `"Hemoglobinopatia"` | 100% |
| `DEPENDENCIA_ALCOOL` | Dependência de álcool | `chronicConditions[]` | `"Dependência de Álcool"` | 100% |
| `DEPENDENCIA_OUTRAS_DROGAS` | Dependência de drogas | `chronicConditions[]` | `"Dependência de Outras Drogas"` | 100% |
| `HIV` | HIV/AIDS | `hivGestante` (se gestante) / `chronicConditions[]` | LGPD Art.11 — ver nota | 100% |
| `SIFILIS` | Sífilis | `sifilis` | `true` | 100% |
| `ACAMADO` | Acamado | `chronicConditions[]` | `"Acamado"` | 100% |
| `DOMICILIADO` | Domiciliado | `chronicConditions[]` | `"Domiciliado"` | 100% |
| `PROBLEMA_RIM` | Problemas renais | `chronicConditions[]` | `"Doença Renal"` | 100% |
| `OUTRA` | Outra condição | ❌ NO_EQUIV | descartado | sem destino específico |

**Nota HIV:** se paciente tem `GESTANTE` + `HIV` → `hivGestante = true` (campo LGPD Art.11 estruturado). Se paciente tem `HIV` sem gestação → `chronicConditions[]` contém `"HIV"`. Em ambos os casos: campo redacted em audit logs.

### 6.2 — Hierarquia de resolução de `careCategory`

```
1. GESTANTE em condicoesSaude OU statusEhGestante = true → "pregnant"
2. PUERPERA em condicoesSaude → "puerperal"
3. birthDate < 2 anos atrás → "child_followup"
4. HIPERTENSAO_ARTERIAL OU DIABETES OU TUBERCULOSE OU HANSENIASE OU
   CANCER OU DPOC_ENFISEMA OU RENAL_CRONICO OU CARDIOVASCULAR → "chronic"
5. nenhuma das anteriores → "general"
```

Prioridade estrita: item 1 > item 2 > item 3 > item 4 > item 5.

---

## FASE 7 — Enum Translation Registry

### 7.1 — Sexo (`sexo` PEC → `sexAtBirth` VITRAS)

| Valor PEC (versões modernas) | Valor PEC (legado) | `sexAtBirth` VITRAS |
|---|---|---|
| `M` | `0` | `MASCULINO` |
| `F` | `1` | `FEMININO` |
| *(outros)* | *(outros)* | 🚫 BLOCKED — rejeita campo (obrigatório) |

**Detecção de versão:** se valor é `0` ou `1`, trata como legado. Se é `M` ou `F`, trata como moderno. Qualquer outro valor: campo rejeitado.

### 7.2 — Raça/Cor (`racaCor` PEC → `racaCor` VITRAS)

| Código PEC | `racaCor` VITRAS | LGPD |
|---|---|---|
| `01` | `BRANCA` | Art. 11 |
| `02` | `PRETA` | Art. 11 |
| `03` | `PARDA` | Art. 11 |
| `04` | `AMARELA` | Art. 11 |
| `05` | `INDIGENA` | Art. 11 |
| `99` ou ausente | null (não mapeado) | campo omitido |
| *(outros)* | ❌ NO_EQUIV — campo descartado | campo omitido |

### 7.3 — Situação de rua (`statusEhSituacaoRua` → `situacaoRua`)

| Valor PEC | `situacaoRua` VITRAS |
|---|---|
| `true` / `1` / `S` | `true` |
| `false` / `0` / `N` / ausente | `false` |

LGPD Art. 11 — redacted em audit logs.

### 7.4 — Deficiência (`deficiencia[]` PEC → `deficiencia[]` VITRAS)

| Código PEC | `deficiencia` VITRAS |
|---|---|
| `AUDITIVA` | `AUDITIVA` |
| `VISUAL` | `VISUAL` |
| `INTELECTUAL_COGNITIVA` | `INTELECTUAL_COGNITIVA` |
| `FISICA` | `FISICA` |
| `MULTIPLA` | `MULTIPLA` |
| `NAO_INFORMADO` | `NAO_INFORMADO` |
| *(valor legado desconhecido)* | ❌ NO_EQUIV — item descartado do array |

### 7.5 — CBO → role VITRAS

| Família CBO | Exemplos CBO | `role` VITRAS | Certeza |
|---|---|---|---|
| 2235 | 223505, 223506 | `nurse_manager` | 100% |
| 2251 | 225103, 225120 | `doctor` | 100% |
| 2232 | 223212, 223204 | `doctor` | 100% |
| 2226 | 226305, 226310 | `dentist` | 100% |
| 3222 | 322205, 322230 | `nursing_tech` | 100% |
| 5151 | 515105 | `acs` | 100% |
| 2516 | 251605 | ❌ sem equivalente → `support_operator` | 100% (fallback documentado) |
| 2231 (fisio) | 223120 | ❌ sem equivalente → `support_operator` | 100% (fallback) |
| 2237 (nutrição) | 223710 | ❌ sem equivalente → `support_operator` | 100% (fallback) |
| 2515 (psicologia) | 251510 | ❌ sem equivalente → `support_operator` | 100% (fallback) |
| *(outros)* | — | `support_operator` | fallback universal |

**Regra de fallback:** CBO sem mapeamento específico → `support_operator`. Role nunca fica nulo. Fallback registrado no log de mapeamento para auditoria.

### 7.6 — Turno (`coTurno` → `turno`)

| Valor PEC | `turno` VITRAS |
|---|---|
| `M` / `1` / `MANHA` | `MANHA` |
| `T` / `2` / `TARDE` | `TARDE` |
| `N` / `3` / `NOITE` | `NOITE` |
| ausente / null | null (campo opcional) |
| *(outros)* | ❌ NO_EQUIV — campo descartado |

### 7.7 — Local de atendimento (`coLocalAtendimento` → `localDeAtendimento`)

| Código PEC | `localDeAtendimento` VITRAS |
|---|---|
| `01` | `UBS` |
| `04` | `DOMICILIO` |
| `02`, `03`, `05`–`09` | `OUTRO` |
| ausente | null (campo opcional) |

### 7.8 — Tipo de visita (`coTipoVisita` → `tipoVisita`)

| Código PEC | `tipoVisita` VITRAS |
|---|---|
| `1` | `VISITA_PERIODICA` |
| `2` | `VISITA_POS_INTERNACAO` |
| `3` | `ACOMPANHAMENTO_CONDICIONALIDADES` |
| `4` | `BUSCA_ATIVA` |
| `5` | `INVESTIGACAO_SURTO` |
| `6` | `EDUCACAO_SAUDE` |
| `7` | `ATENDIMENTO_URGENCIA` |
| `8` | `OUTRO` |
| *(outros)* | 🚫 BLOCKED — campo obrigatório; rejeita evento |

### 7.9 — Motivos de visita (`coMotivoVisita[]` → `motivosVisita[]`)

| Código PEC | `motivosVisita` VITRAS |
|---|---|
| `01` | `CADASTRAMENTO_ATUALIZACAO` |
| `02` | `VISITA_PERIODICA` |
| `03` | `ACOMPANHAMENTO_RN` |
| `04` | `ACOMPANHAMENTO_GESTANTE` |
| `05` | `ACOMPANHAMENTO_PUERPERA` |
| `06` | `ACOMPANHAMENTO_CRIANCA` |
| `07` | `ACOMPANHAMENTO_ADULTO` |
| `08` | `ACOMPANHAMENTO_IDOSO` |
| `09` | `BUSCA_FALTOSO` |
| `10` | `BUSCA_INTERNACAO` |
| `11` | `BUSCA_AVC` |
| `12` | `BUSCA_INFARTO` |
| `13` | `BUSCA_TB` |
| `14` | `BUSCA_HANSENIASE` |
| `15` | `BUSCA_CANCER` |
| `16` | `EDUCACAO_SAUDE` |
| `17` | `CONVITE_ATIVIDADE` |
| `18` | `INVESTIGACAO_SURTO` |
| `19` | `CONDICIONALIDADES` |
| `20` | `ACOMPANHAMENTO_PUERICULTURA` |
| `21` | `OUTRO` |
| *(desconhecido)* | ❌ NO_EQUIV — item descartado do array |

**Regra:** se após descartar itens desconhecidos o array ficar vazio → campo obrigatório → evento rejeitado.

### 7.10 — Desfecho de visita (`coDesfecho` → `desfecho`)

| Valor PEC | `desfecho` VITRAS |
|---|---|
| `1` / `01` / `VISITA_REALIZADA` | `VISITA_REALIZADA` |
| `2` / `02` / `AUSENTE` | `AUSENTE` |
| `3` / `03` / `RECUSOU` | `RECUSOU` |
| *(outros)* | 🚫 BLOCKED — campo obrigatório; rejeita evento |

---

## FASE 8 — Relationship Mapping Graph

### Grafo de relacionamentos PEC → VITRAS

```
UnidadeSaude (CNES)          Unit (UUID VITRAS)
      │                             │
      │ 1:N                         │ 1:N
      ▼                             ▼
  Equipe (INE) ────────────── Team (UUID VITRAS)
      │                             │
      │ 1:N                         │ 1:N
      ▼                             ▼
  Cidadão (CNS/CPF) ─────── Patient (UUID VITRAS)
      │                             │
      │ 1:N                         │ 1:N
      ▼                             ▼
AtendimentoIndividual ──── ClinicalRecord (UUID VITRAS)
      │   │   │                     │
      │   │   │                     │
      │   │   └── Encaminhamento ──► ClinicalRecord type=referral
      │   └────── ExameSolicitado ──► ClinicalRecord type=exam_request
      └────────── MedicamentoPrescrito ──► ClinicalRecord type=prescription
      
  Cidadão
      │
      └── FichaVisitaDomiciliar ──► ClinicalRecord type=visit
      └── FichaVacinacao ──────────► ClinicalRecord type=vaccine
      └── FichaAtendOdonto ────────► ClinicalRecord type=procedure
      └── FichaCadastroDomiciliar ──► Household (UUID VITRAS)

Profissional (CNS) ────────── User (UUID VITRAS)
      │                             │
      └── cria AtendimentoIndividual ──► ClinicalRecord.createdBy
      └── cria FichaVisita ──────────── ClinicalRecord.createdBy
```

### Chaves de resolução obrigatórias

| Relacionamento | Chave PEC | Resolve para | Falha se |
|---|---|---|---|
| Cidadão → Patient | CNS ou CPF | UUID VITRAS | CNS e CPF ambos ausentes → `incompleteProfile=true` |
| Equipe → Team | INE | UUID VITRAS | INE não encontrado → todos pacientes/eventos da equipe rejeitados |
| Unidade → Unit | CNES | UUID VITRAS | CNES não encontrado → Import Job falha |
| Profissional → User | CNS | UUID VITRAS | CNS não resolvido → evento rejeitado (ou fallback_professional_id) |
| AtendimentoIndividual → Patient | CNS cidadão | UUID VITRAS | CNS não resolvido → evento rejeitado |

### Regra de deduplicação de paciente

```
1. Buscar app_patients WHERE cpf_hash = hash(cpf) — se encontrado: MERGE CANDIDATE
2. Buscar app_patients WHERE cns_hash = hash(cns) — se encontrado: MERGE CANDIDATE
3. Nenhum encontrado: novo paciente → INSERT

MERGE CANDIDATE:
  - dados do PEC mais recentes que produção → atualizar campos não clínicos
  - dados do PEC mais antigos → manter produção; log "merge_skipped_outdated"
  - ambos com updatedAt igual → manter produção; log "merge_skipped_tie"
```

---

## FASE 9 — Indicator Impact Mapping

### Score engine: `evaluateGroup()` — 5 componentes

| Componente Score | Peso | Alimentado por PEC? | Fonte PEC | Impacto |
|---|---|---|---|---|
| `recentVisit` | 25 pts | **SIM — DIRETO** | `FichaVisitaDomiciliar` com `desfecho=VISITA_REALIZADA` e `dataVisita` < 90 dias | Importar visitas recentes aumenta score |
| `updatedRegistration` | 25 pts | **SIM — DIRETO** | `FichaCadastroIndividual.dtAtualizado` < 12 meses | Cadastro recente no PEC preserva pontuação |
| `allCns` | 15 pts | **SIM — DIRETO** | `nuCns` presente em todos os membros do grupo | CNS no PEC → CNS no VITRAS → score |
| `completeAddress` | 15 pts | **SIM — DIRETO** | `logradouro` + `numero` + `bairro` preenchidos | Endereço do PEC → `patient.address` |
| `noOverdueTasks` | 20 pts | **NÃO** | Tarefas são criadas no VITRAS — não existem no PEC | Não afetado pela importação |

### Matriz de impacto por tipo de evento importado

| Evento importado | Score impact | Componente afetado |
|---|---|---|
| Visita `desfecho=VISITA_REALIZADA` < 90 dias | +25 pts | `recentVisit` |
| Visita `desfecho=VISITA_REALIZADA` ≥ 90 dias | 0 pts diretos | histórico preservado |
| Visita `desfecho=AUSENTE` ou `RECUSOU` | 0 pts | sem impacto no score |
| Cadastro atualizado < 12 meses | +25 pts | `updatedRegistration` |
| Cadastro atualizado ≥ 12 meses | 0 pts | sem impacto |
| CNS presente no cidadão importado | +15 pts (se todos do grupo) | `allCns` |
| Endereço completo no cadastro | +15 pts (se grupo tem endereço) | `completeAddress` |
| AtendimentoIndividual (qualquer tipo) | 0 pts diretos | não afeta score do grupo |
| FichaVacinacao | 0 pts diretos | não afeta score do grupo |
| FichaAtendOdonto | 0 pts diretos | não afeta score do grupo |

### Indicadores de produção ACS (`getAcsMetrics()`)

| Indicador VITRAS | Alimentado por PEC? | Fonte |
|---|---|---|
| Total de visitas do período | **SIM** | `FichaVisitaDomiciliar` importadas |
| Visitas realizadas | **SIM** | `desfecho=VISITA_REALIZADA` |
| Visitas ausentes | **SIM** | `desfecho=AUSENTE` |
| Visitas recusadas | **SIM** | `desfecho=RECUSOU` |
| Cobertura de cadastro | **SIM** | `FichaCadastroIndividual` importado |
| Grupos com visita recente | **SIM** | derivado do score `recentVisit` |
| Grupos críticos (score < 50) | Parcial | score recalculado pós-import |
| Produção por profissional | **SIM** | `createdBy` dos eventos importados |

**Risco de distorção de histórico:** importar dados históricos (> 12 meses) não afeta o score atual, mas afeta métricas de produção retrospectiva. Relatórios de período devem filtrar por `importJobId` para separar produção real de produção histórica importada.

---

## FASE 10 — Certainty Engine

### Política nacional de certeza

**Regra única: certeza de 100% ou rejeição. Sem estimativa, sem inferência, sem heurística.**

### Tabela de decisões por situação

| Situação | Certeza | Ação |
|---|---|---|
| Valor presente e mapeamento direto unívoco | 100% | ✅ AUTO APPROVED |
| Valor presente, normalização determinística (YYYYMMDD→ISO) | 100% | ✅ AUTO APPROVED |
| Valor presente, lookup em tabela com resultado único | 100% | ✅ AUTO APPROVED |
| Valor ausente/nulo em campo opcional | 100% | ✅ campo null; registro aceito |
| Valor ausente/nulo em campo obrigatório | — | 🚫 registro rejeitado |
| Valor desconhecido em enum mapeado | 0% | ❌ campo descartado (se opcional) ou 🚫 registro rejeitado (se obrigatório) |
| Dois valores possíveis para mesmo destino (ambiguidade) | 0% | 🚫 BLOCKED — Import Job falha na fase de mapping |
| Heurística necessária (ex: infererir sexo por nome) | 0% | ❌ NEVER — proibido |
| Valor corrigível (ex: CPF com dígito errado mas "parece válido") | 0% | 🚫 BLOCKED — não corrigir dados de origem |

### Exemplos de aplicação

**Exemplo 1 — campo obrigatório ausente:**
```
AtendimentoIndividual sem coTipoAtendimento
→ type VITRAS não mapeável
→ 🚫 evento rejeitado
→ log: { field: "type", reason: "coTipoAtendimento_absent", action: "event_rejected" }
```

**Exemplo 2 — valor enum desconhecido em campo opcional:**
```
racaCor = "06" (código desconhecido)
→ campo racaCor descartado
→ patient.racaCor = null
→ ✅ paciente aceito com racaCor nulo
→ log: { field: "racaCor", value: "06", reason: "unknown_enum", action: "field_discarded" }
```

**Exemplo 3 — normalização determinística:**
```
dataNascimento = "19850315"
→ YYYYMMDD → YYYY-MM-DD: "1985-03-15"
→ validar: ≥ 1900 ✅, ≤ hoje ✅
→ ✅ AUTO APPROVED
→ certeza: 100%
```

**Exemplo 4 — ambiguidade proibida:**
```
FichaCadastroIndividual tem dois campos: "nuCns" E "cnsAlternativo"
→ dois candidatos para patient.cns
→ 🚫 BLOCKED — Import Job falha, exige escolha explícita no Source Profile
```

---

## FASE 11 — Gap Register

| ID | Campo/Conceito PEC | Status | Impacto | Causa | Ação futura |
|---|---|---|---|---|---|
| MG-01 | `municipioNascimento` (município de nascimento) | ❌ NO_EQUIV | BAIXO | VITRAS não tem campo de município de nascimento | Avaliar adição futura |
| MG-02 | `responsavelCidadao` (responsável pelo cidadão) | ❌ NO_EQUIV | BAIXO | Relação de responsabilidade não modelada | Avaliar em modelo de grupo familiar |
| MG-03 | `nuProntuarioFamiliar` | ❌ NO_EQUIV | BAIXO | Prontuário familiar PEC ≠ FamilyGroup VITRAS | FamilyGroup criado manualmente |
| MG-04 | `motivoCadastro` | ❌ NO_EQUIV | ZERO | Metadado interno PEC | Descartar |
| MG-05 | `vinculo` do profissional | ❌ NO_EQUIV | ZERO | Vínculo trabalhista sem campo VITRAS | Descartar |
| MG-06 | `stRecusaCadastro` | ❌ NO_EQUIV | BAIXO | Recusa de cadastramento sem equivalente | Descartar com log |
| MG-07 | Procedimentos SIGTAP odontológicos | ⚠️ PARTIAL | MÉDIO | Sem enum canônico de SIGTAP no VITRAS | `metadata.sigtap[]` — estrutura futura: MAP-SIGTAP-01 |
| MG-08 | Código de imunobiológico (SIGTAP vacinas) | ⚠️ PARTIAL | MÉDIO | Sem enum canônico de imunobiológicos | `metadata.imuno` — estrutura futura: MAP-VAC-01 |
| MG-09 | `FichaAtividadeColetiva` | ❌ NO_EQUIV | BAIXO | Evento coletivo sem equivalente individual | Descartar silenciosamente |
| MG-10 | `FichaEligibilidade` | ❌ NO_EQUIV | ZERO | RNDS-only | Descartar |
| MG-11 | `coTipoUnidade` | ❌ NO_EQUIV | BAIXO | Tipo de UBS sem campo VITRAS | Descartar |
| MG-12 | `nuTelefone` (unidade) | ❌ NO_EQUIV | ZERO | Telefone da UBS sem campo VITRAS | Descartar |
| MG-13 | `genderIdentity` | ❌ NO_EQUIV | BAIXO | PEC não tem identidade de gênero — campo VITRAS fica null | Aceitável — campo é optional no VITRAS |
| MG-14 | `statusEhSaidaCadastro` motivo | ⚠️ PARTIAL | BAIXO | Motivo de saída (óbito/mudança) → `inactive=true` mas motivo não estruturado | Registrar motivo em `metadata.exitReason` |
| MG-15 | Produção histórica vs. produção real | ⚠️ PARTIAL | MÉDIO | Relatórios de produção não distinguem dado real de dado importado | `importJobId` em todos os registros permite filtro manual |

---

## FASE 12 — Mapping Audit Trail

### Estrutura do log de mapeamento por Import Job

Todo Import Job gera um `mapping_audit_log` com a seguinte estrutura por registro processado:

```json
{
  "importJobId": "uuid",
  "sourceSystem": "sp-pec-aps-v01",
  "sourceId": "coUnicoFicha",
  "entityType": "patient | clinical_event | household",
  "pecVersion": "5.x",
  "mappingRuleVersion": "MAP-PEC-01-v1",
  "fields": [
    {
      "sourcePath": "FichaCadastroIndividual/racaCor",
      "sourceValue": "03",
      "rule": "enum_normalize:racaCor_pec_to_vitras",
      "canonicalField": "patient.racaCor",
      "canonicalValue": "PARDA",
      "certainty": 100,
      "action": "MAPPED",
      "lgpd": "Art.11"
    },
    {
      "sourcePath": "FichaCadastroIndividual/motivoCadastro",
      "sourceValue": "1",
      "rule": "NO_EQUIV",
      "canonicalField": null,
      "canonicalValue": null,
      "certainty": 0,
      "action": "DISCARDED",
      "reason": "no_canonical_equivalent"
    }
  ],
  "outcome": "ACCEPTED | REJECTED | MERGE_CANDIDATE",
  "rejectionReason": null,
  "timestamp": "ISO 8601"
}
```

### Campos obrigatórios no audit trail

| Campo | Obrigatório | Descrição |
|---|---|---|
| `importJobId` | SIM | rastreabilidade |
| `sourceSystem` | SIM | `"sp-pec-aps-v01"` |
| `sourceId` | SIM | `coUnicoFicha` do PEC |
| `mappingRuleVersion` | SIM | `"MAP-PEC-01-v1"` — versão deste documento |
| `fields[].rule` | SIM | qual regra de mapeamento foi aplicada |
| `fields[].certainty` | SIM | 100 ou 0 — sem valores intermediários |
| `fields[].action` | SIM | `MAPPED | DISCARDED | REJECTED | FALLBACK` |
| `fields[].lgpd` | se LGPD Art.11 | campo Art.11 identificado no log |
| `outcome` | SIM | resultado final do registro |

### Retenção do audit trail

- Audit trail de mapeamento: retido pelo tempo de vida do Import Job + 5 anos (LGPD Art. 37)
- Audit trail não contém valores de CPF, CNS nem campos LGPD Art.11 — apenas campo `lgpd: "Art.11"` como marcador
- Audit trail é parte do hash chain do AUD-01 se o Import Job for committed

---

## FASE 13 — Prontidão para Staging

### Avaliação UI-STG-01 (Interface de Staging)

| Critério | Status |
|---|---|
| Canonical Model definido (ARCH-INT-01)? | ✅ SIM |
| Source Profile certificado (SP-PEC-01)? | ✅ SIM |
| Mapeamentos formalizados (MAP-PEC-01)? | ✅ SIM |
| Estrutura de staging isolada definida (ARCH-INT-01 §9)? | ✅ SIM |
| REM-01 (shadow sync incremental) concluído? | ❌ NÃO |
| REM-02 (bootstrap paginado) concluído? | ❌ NÃO |
| API de ingestão implementada? | ❌ NÃO |

**Decisão UI-STG-01:** ✅ **AUTORIZADO** para design e implementação de interface.

UI-STG-01 pode implementar:
- UI de visualização de Import Jobs (list, detail, status)
- UI de visualização de staging (tabela de registros pré-commit)
- UI de diff (paciente importado vs. paciente em produção para merge candidates)
- UI de estatísticas do Import Job (stats.totalRaw, mapped, validated, selected, staged)
- UI de filtragem de staging por status (valid/warning/rejected)

UI-STG-01 NÃO deve implementar:
- Qualquer botão de commit real
- Qualquer upload de arquivo LEDI
- Qualquer conexão com PEC real

### Avaliação UI-HOMO-01 (Interface de Homologação)

| Critério | Status |
|---|---|
| Fluxo de homologação definido (ARCH-INT-01 §9)? | ✅ SIM |
| Roles de homologação definidos? | ✅ SIM (break_glass_admin, support_admin) |
| Checklist de homologação definido (ARCH-INT-01 §9)? | ✅ SIM — 7 itens |
| GO/NO GO flow definido? | ✅ SIM |
| Audit trail de homologação definido? | ✅ SIM |

**Decisão UI-HOMO-01:** ✅ **AUTORIZADO** para design e implementação de interface.

UI-HOMO-01 pode implementar:
- Checklist de homologação digital (7 itens do ARCH-INT-01)
- UI de amostragem (exibição de N% dos registros de staging para revisão)
- UI de decisão GO/NO GO com campo de justificativa obrigatória
- UI de detalhes de merge candidate (side-by-side: produção vs. importado)
- Audit log de homologação

UI-HOMO-01 NÃO deve implementar:
- Botão de commit real (permanece bloqueado até REM-01)
- Qualquer escrita em `app_state` ou shadow tables de produção

---

## RESULTADO OBRIGATÓRIO

| Item | Resultado |
|---|---|
| Patient Mapping definido? | **SIM** — 28 campos mapeados, regras de careCategory, deduplicação |
| Professional Mapping definido? | **SIM** — CBO→role (14 famílias), lookup CNS, fallback documentado |
| Unit Mapping definido? | **SIM** — CNES→unitId, municipalityId 6→7 |
| Team Mapping definido? | **SIM** — INE→teamId |
| Clinical Event Mapping definido? | **SIM** — 8 tipos de ficha, 10+ tipos de evento |
| Condition Mapping definido? | **SIM** — 20 condições PEC → chronicConditions/careCategory/campos LGPD |
| Enum Registry definido? | **SIM** — 10 tabelas de tradução (sexo, racaCor, situacaoRua, deficiência, CBO, turno, local, tipoVisita, motivosVisita, desfecho) |
| Relationship Mapping definido? | **SIM** — grafo completo, 5 chaves de resolução |
| Indicator Impact Mapping definido? | **SIM** — 5 componentes do score, 10 tipos de evento analisados |
| Certainty Policy aplicada? | **SIM** — 100% ou rejeição; 7 situações classificadas |
| Gap Register criado? | **SIM** — 15 gaps, classificados COMPATIBLE/PARTIAL/NO_EQUIV/BLOCKED |
| Audit Trail criado? | **SIM** — estrutura por campo, rastreabilidade, LGPD, retenção |
| UI-STG-01 autorizado? | **SIM** |
| UI-HOMO-01 autorizado? | **SIM** |
| **Status MAP-PEC-01** | **PASS** |
