# VITRAS — Analise de Conformidade e-SUS APS

**Versao:** 1.0
**Data:** 2026-06-10
**Escopo:** VITRAS v1.0 (branch `release/pilot-baseline`) vs. ecossistema e-SUS APS
**Autor:** Tech Lead / Dev Senior — VITRAS
**Status:** FINAL — Plataforma Go Congelada (nao altera codigo)

---

## Metadados do Documento

| Campo | Valor |
|---|---|
| Versao do sistema analisado | v1.0-pilot-governed |
| Commit de referencia | `d20add9` (2026-06-10) |
| Branch | `release/pilot-baseline` |
| Banco de dados | PostgreSQL / AWS RDS |
| Migrations verificadas | 001–011 (11 migrations; CRITICAL=[006,009,010,011]) |
| municipalityId hardcoded (migration 010) | **3534401 = Ribeirao Preto – SP** (ver secao de alertas) |
| Piloto | UBS-001 — piloto controlado |
| Modelo operacional | VITRAS como complemento ao PEC e-SUS (NAO substituto) |
| Legislacao de referencia | e-SUS APS CDS v3.2+, RNDS, Previne Brasil, LGPD |
| Publico-alvo deste documento | Time tecnico, Juridico, Prefeitura/Secretaria de Saude |

---

## Resumo Executivo

O VITRAS v1.0 e um sistema de gestao de saude da familia (ESF) construido para piloto controlado em ambiente de UBS municipal. A analise realizada compara o sistema atual contra os requisitos do ecossistema e-SUS APS — especificamente os formularios CDS (Coleta de Dados Simplificada), as normas de integracao federal (SISAB, SINAN, RNDS) e as obrigacoes LGPD aplicaveis.

**Resultado global:** PARTIAL — o VITRAS cobre adequadamente os fluxos operacionais da UBS (fila, agenda, prontuario, farmacia, encaminhamentos) mas nao cobre a camada de integracao federal com os sistemas do Ministerio da Saude.

**Modelo defensavel para o piloto:** VITRAS como sistema complementar ao e-SUS PEC (nao substituto). Nesse modelo, a UBS continua operando o PEC para envio ao SISAB e notificacoes compulsorias. O VITRAS gerencia os fluxos internos de atendimento. Esse modelo e juridicamente defensavel durante o piloto controlado e deve ser declarado explicitamente no aceite-operacional e no instrumento juridico.

**Gaps bloqueantes para go-live:** GAP-3 (CNES ausente), GAP-7 (RIPD nao assinado / DPO nao designado) e GAP-1 (clausula contratual sobre ausencia de SISAB) sao os tres itens que devem ser resolvidos antes da abertura do piloto — mesmo no modelo de coexistencia com PEC.

**Cobertura estimada por area:**

| Area | Status | Cobertura |
|---|---|---|
| Cadastro Individual | PARTIAL | ~55% |
| Cadastro Domiciliar | PARTIAL | ~25% |
| Atendimento Individual | PARTIAL | ~40% |
| Identificacao do Profissional | PARTIAL | ~50% |
| CID-10 | NONE | 0% |
| CIAP-2 | NONE | 0% |
| SIGTAP / Procedimentos | NONE | 0% |
| Previne Brasil | PARTIAL | ~55% |
| Vacinacao | PARTIAL | ~30% |
| Visitas ACS | PARTIAL | ~60% |

---

## Metodologia

1. **Auditoria de codigo estatica:** leitura direta dos arquivos `src/schemas.js`, `src/routes/patients.js`, `src/routes/family-groups.js`, `src/routes/medical-records.js`, `src/routes/users.js`, `src/migrations/010_add_municipality_id.js`, `src/migrations/011_add_executing_context_to_appointments.js`.
2. **Busca por termos criticos:** varredura por `cid10`, `cid_10`, `ciap`, `sigtap`, `procedure_code`, `tuss`, `diagnosis_code`, `cns_profissional`, `ine`, `cnes` em `src/`.
3. **Cruzamento normativo:** comparacao campo-a-campo com Fichas CDS e-SUS APS v3.2 (Cadastro Individual, Cadastro Domiciliar, Atendimento Individual, Vacinacao, Visita Domiciliar ACS, Procedimentos).
4. **Revisao juridica:** dados fornecidos pelo agente de compliance legal com mapeamento de portarias e resolucoes.
5. **Congelamento de plataforma:** nenhuma alteracao foi feita no codigo. Este documento e somente leitura/analise.

---

## Escopo

### Dentro do escopo
- Fichas CDS do e-SUS APS: Cadastro Individual, Cadastro Domiciliar, Atendimento Individual, Vacinacao, Visita Domiciliar ACS, Procedimentos
- Previne Brasil (7 indicadores)
- Identificacao de profissional de saude (CNS, CBO, INE, CNES)
- Integracao SISAB (obrigatoriedade de envio de producao)
- Notificacao compulsoria SINAN
- RNDS (RAAS, RACINE, SIPNI)
- LGPD (RIPD, DPO, DPA com subprocessadores AWS)
- SBIS certificacao PEP NG

### Fora do escopo desta analise
- Qualidade clinica dos atendimentos registrados
- Performance e carga do sistema
- Infraestrutura AWS (coberta em outros documentos de rollout)
- Auditoria de seguranca (coberta em `go-live-status-consolidated.md`)

---

## Resultado por Sistema

### 1. Cadastro Individual

**Status:** PARTIAL
**Cobertura:** ~55%
**Norma:** Portaria GM/MS no 3.222/2019 (e-SUS APS CDS Ficha de Cadastro Individual)
**Implementado:**
- Nome completo (`name`) — schemas.js:25
- Data de nascimento (`birthDate`) — schemas.js:47
- Sexo ao nascer (`sexAtBirth`) — schemas.js:45
- Identidade de genero (`genderIdentity`) — schemas.js:46
- CPF (opcional) (`cpf`) — schemas.js:29
- CNS do paciente (opcional) (`cns`) — schemas.js:30
- Nome da mae (`motherName`) — schemas.js:26
- Microarea (`microArea`) — schemas.js:34
- Estado civil (`maritalStatus`) — schemas.js:39
- Municipio de residencia (via `municipalityId` derivado do usuario — patients.js:156)
- ACS responsavel (`assignedAcsId`) — schemas.js:35
- Telefone de contato (`phone`, `phoneAlt`)

**Ausente (campos obrigatorios e-SUS CDS):**
- Raca/cor (campo obrigatorio na Ficha CDS Individual — ausente em PatientBaseShape)
- Escolaridade (campo obrigatorio na Ficha CDS Individual — ausente)
- Situacao de rua (flag obrigatorio na Ficha CDS Individual — ausente)
- Pais de nascimento (ausente)
- Municipio de nascimento (ausente — o campo `municipalityId` e apenas residencia atual)
- Deficiencia(s) (ausente)
- Saida do cadastro (obito / mudanca de territorio — apenas `inactive`/`inactivationReason`, sem motivo estruturado)

**Critico — validacao ausente:**
- A validacao de "CPF ou CNS obrigatorio" esta ausente. patients.js:140 exige apenas `name` e `phone`. O campo CNS do paciente e `cns` (string opcional). Para integracao federal, ao menos um identificador estruturado e necessario.

**Evidencia de codigo:**
- `src/schemas.js:24–62` — `PatientBaseShape` (campos aceitos)
- `src/routes/patients.js:140` — validacao `if (!payload.name || !payload.phone)`

**Risco:** ALTO
**Sprint sugerida:** Sprint 5A — adicionar raca/cor, escolaridade, situacao de rua; tornar CNS obrigatorio ou condicional a CPF

---

### 2. Cadastro Domiciliar

**Status:** PARTIAL
**Cobertura:** ~25%
**Norma:** Portaria GM/MS no 3.222/2019 (e-SUS APS CDS Ficha de Cadastro Domiciliar e Territorial)
**Implementado:**
- Endereco (`address`) — presente em `familyGroups` e `PatientBaseShape`
- Microarea (`microArea`) — presente em `familyGroups`
- ACS responsavel (`assignedAcsId`) — presente em `familyGroups`
- Relacao de membros (`memberPatientIds`) — presente em `familyGroups`

**Ausente (campos obrigatorios e-SUS CDS):**
- Tipo de imovel (domicilio / comercio / terreno baldio / etc.) — ausente
- Tipo de acesso ao domicilio (pavimento / chao batido / etc.) — ausente
- Condicoes de moradia: abastecimento de agua — ausente
- Condicoes de moradia: escoamento do banheiro/sanitario — ausente
- Condicoes de moradia: destino do lixo — ausente
- Condicoes de moradia: energia eletrica — ausente
- Numero de comodos / dormitorios — ausente
- Animais no domicilio (tipo e quantidade) — ausente
- Numero de moradores — ausente (inferivel de `memberPatientIds.length` mas nao estruturado)

**Cobertura CDS:** 2 de 8 grupos de campos obrigatorios da Ficha de Cadastro Domiciliar.

**Evidencia de codigo:**
- `src/routes/family-groups.js:22–34` — campos gerenciados: `address`, `microArea`, `assignedAcsId`, `memberPatientIds`
- Nao ha schema Zod dedicado para criacao de grupo familiar — `memberPatientIds` e o unico campo validado (family-groups.js:43)

**Risco:** MEDIO (coberto pelo modelo PEC-paralelo no piloto; dados domiciliares continuam sendo coletados pelo ACS via PEC)
**Sprint sugerida:** Sprint 6 — modulo de cadastro domiciliar completo

---

### 3. Atendimento Individual

**Status:** PARTIAL
**Cobertura:** ~40%
**Norma:** Portaria GM/MS no 3.222/2019 (e-SUS APS CDS Ficha de Atendimento Individual); Portaria GM/MS no 2.436/2017 (PNAB)
**Implementado:**
- Data do atendimento (`date`) — AppointmentCreateSchema:121
- Tipo de demanda (`demandType`: scheduled/spontaneous) — AppointmentCreateSchema:123
- Tipo de consulta (`type`: consultation/return/procedure/other) — AgendaCreateSchema:133
- Conduta em texto livre (`conduct`) — AppointmentCreateSchema:124
- Encaminhamentos (modulo separado — `src/routes/referrals.js`)
- Contexto de execucao: `executing_team_id` e `executing_unit_id` — migration 011
- Vinculo equipe/unidade do paciente — migration 010+011

**Ausente (campos obrigatorios Ficha Atendimento Individual CDS):**
- CID-10 da condicao principal — NONE (ver secao 5)
- CIAP-2 do motivo da consulta — NONE (ver secao 6)
- CNS do profissional executante — ausente (ver secao 4)
- CBO (Classificacao Brasileira de Ocupacoes) do profissional — ausente
- INE (Identificador Nacional de Equipe) — ausente
- CNES da unidade de saude — ausente (ver GAP-3)
- Tipo de atendimento (consulta medica/odontologica/enfermagem — mapeado parcialmente via `type`)
- Racionalidade em saude (alopatica/homeopatica/fitoterapia etc.) — ausente
- Crianca: peso, altura, perimetro cefalico — ausente como campos estruturados
- Gestante: IG e risco gestacional — parcialmente presente via campos de gestacao no paciente; ausente no registro do atendimento

**Evidencia de codigo:**
- `src/schemas.js:120–126` — `AppointmentCreateSchema` (campos aceitos)
- `src/schemas.js:128–136` — `AgendaCreateSchema`
- `src/migrations/011_add_executing_context_to_appointments.js:7–8` — colunas `executing_team_id`, `executing_unit_id`

**Risco:** ALTO (sem CID-10 e CNS do profissional, registros nao sao aproveitaveis para integracao com SISAB/FAI)
**Sprint sugerida:** Sprint 5A — CID-10 estruturado; Sprint 5B — CBO, INE, CNES no atendimento

---

### 4. Identificacao do Profissional

**Status:** PARTIAL
**Cobertura:** ~50%
**Norma:** Portaria MS no 940/2011 (CNS); Resolucao CFM no 2.299/2021; Portaria GM/MS no 3.276/2019 (CNES)
**Implementado:**
- Nome do profissional (`name`) — RegisterSchema:14
- Numero do conselho profissional (`councilNumber`: CRM/COREN/CRO) — RegisterSchema:21
- UF do conselho (`councilUf`) — RegisterSchema:22
- Vinculo com equipe (`teamId`) e unidade (`unitId`) — RegisterSchema:18–19
- Role/perfil (`role`) — RegisterSchema:17

**Ausente:**
- CNS do profissional — AUSENTE. `RegisterSchema` e `MePatchSchema` nao possuem campo `cns` para o profissional. Apenas `councilNumber` (CRM/COREN).
- CBO (Classificacao Brasileira de Ocupacoes) numerico — ausente. Nao ha campo `cbo` em nenhum schema de usuario.
- INE (Identificador Nacional de Equipe) — ausente no cadastro de usuario e de equipe.
- CNES da unidade de saude — ausente como campo estruturado em `app_units` (ver GAP-3).

**Evidencia de codigo:**
- `src/schemas.js:13–22` — `RegisterSchema`
- `src/schemas.js:273–280` — `MePatchSchema` (sem campo `cns`)
- `src/routes/users.js:20–33` — `buildUserAuditSnapshot` (campos auditados: `councilType`, `councilNumber`, `councilUf` — sem `cns`)

**Risco:** ALTO (CNS do profissional e exigido pelo CNES/SCNES e pelo SISAB para validacao da producao)
**Sprint sugerida:** Sprint 5A — adicionar campo `cns` opcional para usuarios de saude

---

### 5. CID-10

**Status:** NONE
**Cobertura:** 0%
**Norma:** Portaria GM/MS no 2.073/2011 (adocao ICD-10/CID-10 no SUS); Ficha de Atendimento Individual CDS campo "CID-10 do diagnostico"
**Implementado:** Nada. `chronicConditions` em `PatientBaseShape` e uma lista de strings em texto livre (ex: "Hipertensao", "Diabetes"). Nao ha campo de CID-10 estruturado em nenhum endpoint.
**Ausente:**
- Campo `cid10` (ou `diagnosisCode`) em `AppointmentCreateSchema`
- Campo `cid10` em `RecordCreateSchema` para tipo `consultation`
- Tabela/lista de codigos CID-10 para validacao/autocomplete
- CID-10 secundario (comorbidade no atendimento)

**Evidencia de codigo:**
- Busca por `cid10`, `cid_10`, `diagnosis_code` em `src/` — zero ocorrencias confirmadas pela auditoria
- `src/schemas.js:38` — `chronicConditions: z.array(z.string().trim().max(100))` — texto livre, sem estrutura de codigo

**Risco:** CRITICO (sem CID-10, o VITRAS nao pode gerar FAI — Ficha de Atendimento Individual — compativel com e-SUS CDS, bloqueando qualquer integracao futura com SISAB)
**Sprint sugerida:** Sprint 5A — adicionar campo `cid10` opcional em `AppointmentCreateSchema` e em `RecordCreateSchema` tipo `consultation`

---

### 6. CIAP-2

**Status:** NONE
**Cobertura:** 0%
**Norma:** Portaria GM/MS no 3.222/2019 (CIAP-2 na Ficha de Atendimento Individual — campo "problema/condicao avaliada"); OMS — ICPC-2
**Implementado:** Nada. Campo `summary` em `AppointmentCreateSchema` e texto livre (max 10.000 chars).
**Ausente:**
- Campo `ciap2` (ou `reasonCode`) em `AppointmentCreateSchema`
- Tabela de codigos CIAP-2 para validacao

**Evidencia de codigo:**
- Busca por `ciap`, `ciap2`, `reason_code` em `src/` — zero ocorrencias
- `src/schemas.js:122` — `summary: z.string().trim().min(1).max(10000)` — texto livre

**Risco:** ALTO (CIAP-2 e campo obrigatorio na Ficha de Atendimento Individual do e-SUS para classificacao do motivo de consulta na APS)
**Sprint sugerida:** Sprint 6 (pos-piloto) — CIAP-2 e mais complexo que CID-10; requer tabela de ~700 codigos e UX de busca; adiar para versao de integracao e-SUS

---

### 7. SIGTAP / Procedimentos

**Status:** NONE
**Cobertura:** 0%
**Norma:** Portaria GM/MS no 2.073/2011 (SIGTAP); Ficha de Procedimentos CDS e-SUS
**Implementado:** Nada. `ExamCreateSchema` possui apenas `title` (texto livre), `date`, `notes`, `source`. `ReferralCreateSchema` possui `specialty` (texto livre). Nenhum campo de codigo de procedimento SIGTAP ou TUSS.
**Ausente:**
- Codigo SIGTAP de procedimento
- Quantidade de procedimentos por codigo
- Vinculo com profissional executante (CNS + CBO)
- Ficha de Procedimentos CDS completa

**Evidencia de codigo:**
- Busca por `sigtap`, `procedure_code`, `tuss` em `src/` — zero ocorrencias
- `src/schemas.js:223–228` — `ExamCreateSchema`: apenas `title`, `date`, `notes`, `source`
- `src/schemas.js:148–156` — `ReferralCreateSchema`: `specialty` em texto livre

**Risco:** MEDIO (no modelo PEC-paralelo, procedimentos sao registrados no PEC para fins de SISAB; o VITRAS registra o fluxo clinico interno)
**Sprint sugerida:** Sprint 6+ — planejar tabela SIGTAP como modulo de integracao

---

### 8. Previne Brasil

**Status:** PARTIAL
**Cobertura:** ~55%
**Norma:** Portaria GM/MS no 2.979/2019 (Previne Brasil); Nota Tecnica no 3/2020 DESF/SAPS/MS
**Implementado:**
- Hipertensao Arterial Sistolica (HAS): `chronicConditions` + protocolo semestral (6/6m) — PARTIAL (sem CID-10 estruturado, mas logica de acompanhamento presente)
- Diabetes Mellitus (DM): `chronicConditions` + HbA1c como exame + avaliacao de pes como registro — PARTIAL
- Pre-natal 1a consulta: `pregnancyStartDate` + semana gestacional verificada + `prenatalStartDate` — FULL para deteccao; CID-10 ausente para reporte SISAB
- Pre-natal 6+ consultas: contagem de consultas vs. meta configuravel por protocolo — PARTIAL
- Sifilis gestante: deteccao por REGEX em `chronicConditions` texto livre — PARTIAL (fragil; sujeito a variacao de texto)
- HIV gestante: AUSENTE — sem campo estruturado; sem busca por condicao HIV

**Ausente:**
- Indicador Previne Brasil: HIV gestante — AUSENTE (nao ha deteccao estruturada)
- Indicador Previne Brasil: Saude bucal gestante — AUSENTE (sem modulo odontologico para gestante)
- Indicador Previne Brasil: Citopatologico cervico-uterino — AUSENTE (sem rastreamento estruturado)
- CID-10 dos agravos acompanhados — ausente (impede geracao de relatorio Previne Brasil compativel com e-SUS)
- Vinculo dos indicadores ao CNS da paciente (para identificacao no SISAB) — ausente

**Evidencia de codigo:**
- `src/schemas.js:38` — `chronicConditions` como lista de strings (HAS, DM identificados por texto livre)
- `src/schemas.js:48–57` — campos de gestacao presentes (`pregnancyStartDate`, `prenatalStartDate`, `gestationalAge*`)
- Logica de deteccao de sifilis: busca por regex em texto — fragil

**Risco:** ALTO (sem CID-10 e CNS, nenhum dos 7 indicadores pode ser reportado ao SISAB; a cobertura interna e suficiente para gestao da UBS mas nao para faturamento Previne Brasil)
**Sprint sugerida:** Sprint 5A — CID-10 estruturado (pre-requisito para todos os indicadores); Sprint 5B — HIV gestante como campo booleano; Sprint 6 — citopatologico, saude bucal gestante

---

### 9. Vacinacao

**Status:** PARTIAL
**Cobertura:** ~30%
**Norma:** Portaria GM/MS no 597/2004 (PNI); RNDS/SIPNI (integracao nacional de imunizacoes)
**Implementado:**
- Tipo de registro `vaccine` existe em `RecordCreateSchema` — schemas.js:239
- Data de vacinacao (`date`) — presente
- Titulo/nome da vacina (`title`) — presente como texto livre
- Detalhes (`details`) — texto livre, max 20.000 chars

**Ausente:**
- Lote da vacina (campo obrigatorio PNI) — ausente em `RecordCreateSchema`
- Dose estruturada (D1, D2, D3, reforco, anual etc.) — ausente
- Via de administracao (IM, SC, ID, VO) — ausente
- Local de aplicacao (braco esquerdo/direito, coxa etc.) — ausente
- CNS do aplicador — ausente
- Codigo PNI / codigo SIPNI da vacina — ausente
- Modulo dedicado de vacinacao (apenas `type = "vaccine"` em clinicalRecord)
- Integracao RNDS/SIPNI — ausente

**Evidencia de codigo:**
- `src/schemas.js:238–245` — `RecordCreateSchema`: `type` (enum incluindo "vaccine"), `date`, `title`, `details`, `protocolTag`, `metadata`
- Campo `metadata` e `z.record(z.any())` — pode carregar dados de lote/dose via metadata nao estruturado, mas sem validacao formal

**Risco:** ALTO (sem lote e dose estruturados, os registros de vacinacao do VITRAS nao sao validos para SIPNI; a integracao RNDS e necessaria para o PNI)
**Sprint sugerida:** Sprint 6 — modulo de vacinacao dedicado com campos PNI estruturados; Sprint 7+ — integracao RNDS/SIPNI

---

### 10. Visitas ACS

**Status:** PARTIAL
**Cobertura:** ~60%
**Norma:** Portaria GM/MS no 3.222/2019 (e-SUS APS CDS Ficha de Visita Domiciliar e Territorial)
**Implementado:**
- Tipo de registro `visit` em `RecordCreateSchema` — schemas.js:239
- Restricao de perfil ACS (role `acs` tem acesso restrito a seus pacientes) — family-groups.js:18
- Data da visita (`date`) — presente
- Identificacao do ACS (`assignedAcsId`) — presente no cadastro do paciente

**Ausente:**
- Motivo da visita codificado (consulta/acompanhamento/busca ativa/etc.) — ausente; apenas texto livre em `details`
- Desfecho da visita codificado (visita realizada/visita nao realizada — motivo) — ausente
- Situacao do morador no momento da visita — ausente
- Flags estruturados: gestante localizada, crianca com vacina em atraso, suspeita de agravo — ausente
- Vinculo ao numero de membros visitados (contagem) — ausente
- CNS do ACS executante — ausente (apenas `assignedAcsId` interno)
- Peso/altura da crianca na visita — ausente como campo estruturado

**Evidencia de codigo:**
- `src/schemas.js:238–245` — `RecordCreateSchema`: ausencia de campos estruturados de visita
- `src/routes/family-groups.js:16–19` — restricao correta por perfil ACS

**Risco:** MEDIO (visitas ACS no VITRAS servem para rastreamento interno; para fins de SISAB, as visitas continuam sendo registradas no PEC no modelo de coexistencia)
**Sprint sugerida:** Sprint 6 — adicionar motivo e desfecho codificados na visita ACS

---

## Gaps Criticos para Go-Live UBS-001

Os gaps abaixo requerem resolucao ou mitigacao formal **antes da abertura do piloto**, independente do modelo de coexistencia com PEC.

### GAP-1 — SISAB: ausencia de integracao (BLOQUEANTE para faturamento municipal)

**Norma:** Portaria GM/MS no 1.412/2013 + no 2.979/2019 (Previne Brasil)
**Impacto financeiro:** Sem envio ao SISAB, o municipio perde PAB variavel e incentivos Previne Brasil (~R$18.000 a R$55.000/equipe ESF/ano).
**Status no VITRAS:** AUSENTE — o sistema nao possui nenhum modulo de exportacao para o formato CDS/SISAB.
**Mitigacao para piloto:** Declarar explicitamente no instrumento juridico e no aceite-operacional que o VITRAS e complementar ao PEC e-SUS, que permanece como sistema oficial de envio ao SISAB. A UBS deve manter o fluxo de digitacao no PEC em paralelo para os registros que exigem envio federal.
**Acao necessaria:** Incluir clausula de ausencia de SISAB no instrumento juridico **antes do go-live**.
**Responsavel:** Juridico / Joao Pedro

---

### GAP-2 — SINAN: ausencia de automacao de notificacao compulsoria (CRITICO)

**Norma:** Lei 6.259/1975; Portaria GM/MS no 264/2020 (Lista Nacional de Notificacao Compulsoria — LNNC com 204 agravos)
**Impacto:** Ausencia de suporte sistemico para identificacao e notificacao de agravos compulsorios. O medico continua sendo o responsavel legal pela notificacao.
**Status no VITRAS:** AUSENTE — nao ha deteccao automatica de agravos, nem fluxo de notificacao ao SINAN.
**Mitigacao para piloto:** Documentar no aceite-operacional que o profissional de saude e responsavel por notificar manualmente os agravos compulsorios via formulario proprio da Vigilancia Epidemiologica. O VITRAS nao desonera essa obrigacao legal.
**Acao necessaria:** Clausula contratual + procedimento operacional no aceite-operacional descrevendo fluxo manual de notificacao SINAN **antes do go-live**.
**Responsavel:** Juridico + Coordenador UBS

---

### GAP-3 — CNES ausente como campo estruturado (CRITICO)

**Norma:** Portaria GM/MS no 3.276/2019 (SCNES — Sistema do Cadastro Nacional de Estabelecimentos de Saude)
**Impacto:** Toda producao historica do VITRAS sera invalida para integracao federal sem o CNES. O campo `[CNES_PENDENTE]` ainda esta presente no instrumento juridico.
**Status no VITRAS:** AUSENTE — a tabela `app_units` nao possui coluna `cnes`. O `municipalityId` esta presente (migration 010, valor `3534401` para Ribeirao Preto – SP), mas nao o CNES da unidade.
**Mitigacao para piloto:** Preencher o CNES da UBS-001 manualmente no aceite-operacional e no instrumento juridico. Adicionar como campo obrigatorio no bootstrap da unidade (Sprint 5A).
**Acao necessaria:** Substituir `[CNES_PENDENTE]` pelo CNES real da UBS-001 no instrumento juridico **antes do go-live**.
**Responsavel:** Joao Pedro (campo no instrumento) + UBS Coordinator (fornecer CNES)

---

### GAP-4 — Certificacao SBIS PEP NG ausente (CRITICO — impacto no CRM do medico)

**Norma:** Resolucao CFM no 2.299/2021 Art. 3o; CEM Art. 88
**Impacto:** Medico que usa sistema sem certificacao SBIS PEP NG pode ter validade de prescricoes e atestados questionada pelo CRM. O risco e do medico, nao do municipio.
**Status no VITRAS:** AUSENTE — o sistema nao possui certificacao SBIS em nenhum nivel (basico, intermediario ou pleno).
**Mitigacao para piloto:** RISCO — VALIDAR COM JURIDICO. O piloto controlado com escopo limitado pode ser defensavel como "uso experimental sob supervisao". Deve ser declarado no instrumento juridico com ciencia explicita do medico e do municipio.
**Acao necessaria:** Consulta formal ao juridico sobre validade do uso em piloto controlado sem certificacao SBIS. Ciencia do CRM-SP pode ser prudente.
**Responsavel:** Juridico

---

### GAP-5 — CNS do profissional nao armazenado (ALTO)

**Norma:** Portaria MS no 940/2011 (CNS como identificador unico nacional do profissional de saude)
**Impacto:** Sem CNS do profissional, qualquer integracao com CNES, SCNES, SISAB ou RNDS e impossivel. O campo `councilNumber` (CRM/COREN) e insuficiente para identificacao federal.
**Status no VITRAS:** AUSENTE — `RegisterSchema` e `MePatchSchema` nao possuem campo `cns` para usuarios.
**Mitigacao para piloto:** Coletar CNS manualmente na documentacao de onboarding dos profissionais (folha de cadastro fisica). Armazenar no aceite-operacional.
**Acao necessaria:** Adicionar campo `cns` opcional para usuarios de saude (Sprint 5A).
**Responsavel:** Joao Pedro

---

### GAP-6 — CID-10 nao estruturado (ALTO)

**Norma:** Portaria GM/MS no 2.073/2011 (adocao CID-10 no SUS)
**Impacto:** Impede geracao de FAI (Ficha de Atendimento Individual) compativel com e-SUS CDS. Impede todos os 7 indicadores Previne Brasil de serem reportados ao SISAB.
**Status no VITRAS:** NONE — zero ocorrencias de campo CID-10 em todo o codigo.
**Mitigacao para piloto:** No modelo PEC-paralelo, CID-10 continua sendo registrado no PEC. O VITRAS registra a conduta clinica em texto livre.
**Acao necessaria:** Adicionar campo `cid10` opcional em `AppointmentCreateSchema` e `RecordCreateSchema` (Sprint 5A).
**Responsavel:** Joao Pedro

---

### GAP-7 — RIPD nao assinado, DPO nao designado (CRITICO — bloqueador LGPD)

**Norma:** LGPD Art. 38; Resolucao CD/ANPD no 02/2022
**Impacto:** Sem RIPD assinado e DPO designado, o municipio opera em descumprimento da LGPD ao processar dados sensiveis de saude. A multa administrativa da ANPD pode chegar a 2% do faturamento, limitada a R$50 milhoes por infracao.
**Status no VITRAS:** AUSENTE — bloqueador ja registrado em `go-live-status-consolidated.md`.
**Acao necessaria:** (1) Prefeitura designa DPO formalmente; (2) RIPD e assinado bilateralmente entre Prefeitura e Vitras; (3) DPA com AWS e Upstash deve ser aceito (item T-7 dias no roadmap).
**Responsavel:** Prefeitura (DPO + RIPD) + Joao Pedro (DPA AWS/Upstash)

---

## Alerta — municipalityId Hardcoded

**Arquivo:** `src/migrations/010_add_municipality_id.js:7`
**Valor hardcoded:** `'3534401'` = Ribeirao Preto – SP (codigo IBGE)

Este valor foi usado para backfill de todas as entidades existentes (`app_units`, `app_patients`, `app_users`, `app_audit_logs`) no momento da execucao da migration 010. Novos pacientes criados com usuario sem `municipalityId` definido tambem recebem este valor como fallback (patients.js:156: `req.user.municipalityId || "3534401"`).

**Acao necessaria antes do go-live:**
1. Confirmar com a UBS-001 qual e o municipio correto e seu codigo IBGE.
2. Se a UBS-001 for em municipio diferente de Ribeirao Preto, executar UPDATE corretivo no banco antes de qualquer dado de producao ser inserido (responsavel execucao SQL: Joao Pedro via migration avulsa ou script com backup pre-execucao no RDS).
3. No bootstrap da unidade (POST /admin/units/bootstrap), garantir que `municipalityId` correto e passado pelo operador — nao depender do fallback hardcoded.

**Risco:** ALTO — dados associados ao municipio errado invalidam toda a producao para fins de SISAB e IBGE.

---

## Roadmap de Conformidade

### Sprint 5A (imediata — pre-escalonamento)
Itens que desbloqueiam conformidade minima e reducao de risco juridico:

| Item | Descricao | Norma | Prioridade |
|---|---|---|---|
| 5A-01 | Substituir `[CNES_PENDENTE]` pelo CNES real da UBS-001 no instrumento juridico | Portaria 3.276/2019 | CRITICA |
| 5A-02 | Clausula contratual: ausencia SISAB + modelo PEC-paralelo | Portaria 2.979/2019 | CRITICA |
| 5A-03 | Clausula contratual: responsabilidade medico por notificacao SINAN | Lei 6.259/1975 | CRITICA |
| 5A-04 | RIPD assinado + DPO designado pela Prefeitura | LGPD Art. 38 | CRITICA |
| 5A-05 | DPA com AWS aceito via Artifact | LGPD / ANPD | ALTA |
| 5A-06 | Validar municipalityId da UBS-001 vs. valor hardcoded `3534401` | Integridade de dados | ALTA |
| 5A-07 | Adicionar campo `cns` opcional para usuarios de saude (backend) | Portaria 940/2011 | ALTA |
| 5A-08 | Adicionar campos `raca_cor`, `escolaridade`, `situacao_de_rua` em PatientBaseShape | Portaria 3.222/2019 | ALTA |
| 5A-09 | Adicionar campo `cid10` opcional em AppointmentCreateSchema e RecordCreateSchema | Portaria 2.073/2011 | CRITICA |
| 5A-10 | Adicionar campo `cnes` em app_units (migration) | Portaria 3.276/2019 | ALTA |
| 5A-11 | Consulta formal ao juridico: piloto controlado sem certificacao SBIS | CFM 2.299/2021 | CRITICA |
| 5A-12 | Revalidar prazo retencao anonimizacao = 20 anos (KI-02) | LGPD + CFM | MEDIA |

### Sprint 5B (pos-go-live imediato)
Itens que melhoram conformidade operacional durante o piloto:

| Item | Descricao | Norma | Prioridade |
|---|---|---|---|
| 5B-01 | Adicionar CBO numerico ao cadastro de usuario | e-SUS CDS | ALTA |
| 5B-02 | Adicionar INE (Identificador Nacional de Equipe) ao cadastro de equipe | e-SUS CDS | ALTA |
| 5B-03 | Adicionar campo booleano `hiv_gestante` e melhorar deteccao sifilis | Previne Brasil | ALTA |
| 5B-04 | Ficha de Visita ACS: adicionar motivo e desfecho codificados | Portaria 3.222/2019 | MEDIA |
| 5B-05 | Validacao "CPF ou CNS obrigatorio" em PatientCreateSchema | Portaria 940/2011 | MEDIA |
| 5B-06 | Modo somente-leitura durante outage Redis (mitigacao manual — Gap 3 lessons-learned) | Resiliencia | ALTA |

### Sprint 6 (versao de integracao e-SUS)
Itens que habilitam integracao direta com ecossistema federal:

| Item | Descricao | Norma | Prioridade |
|---|---|---|---|
| 6-01 | Cadastro domiciliar completo (tipo imovel, condicoes de moradia, animais) | CDS Cadastro Domiciliar | ALTA |
| 6-02 | CIAP-2: tabela de codigos + campo em AppointmentCreateSchema | Portaria 3.222/2019 | ALTA |
| 6-03 | Modulo de vacinacao dedicado (lote, dose, via, local, codigo PNI) | PNI / SIPNI | ALTA |
| 6-04 | Exportacao CDS (geracao de arquivo .esus compativel para importacao no PEC) | SISAB | ALTA |
| 6-05 | SIGTAP: tabela de procedimentos + campo em atendimento | SIGTAP | MEDIA |
| 6-06 | Citopatologico: rastreamento estruturado (indicador Previne Brasil) | Previne Brasil | MEDIA |
| 6-07 | Saude bucal gestante: modulo odontologico minimo | Previne Brasil | MEDIA |

### Sprint 7+ (integracao nacional)
Itens de longo prazo dependentes de habilitacao RNDS:

| Item | Descricao | Norma |
|---|---|---|
| 7-01 | Integracao RNDS / SIPNI (vacinacao nacional) | Portaria GM/MS 1.434/2020 |
| 7-02 | RNDS RAAS / RACINE (registro de atendimento ambulatorial) | Portaria GM/MS 234/2022 |
| 7-03 | Solicitacao certificacao SBIS PEP NG (nivel basico) | CFM 2.299/2021 |
| 7-04 | SINAN: automacao de notificacao compulsoria (204 agravos) | Lei 6.259/1975 |
| 7-05 | CNPJ Vitras + habilitacao como operador RNDS | RNDS |

---

## Veredicto

### Para o Time Tecnico

O VITRAS v1.0 e tecnicamente solido para os fluxos operacionais da UBS: fila de recepcao, agenda, prontuario clinico, farmacia, encaminhamentos e rastreamento de gestantes/cronicos. A arquitetura multi-tenant, isolamento por equipe/unidade, auditoria com hash chain e mascaramento de dados sensiveis estao implementados e verificados.

Os gaps de conformidade e-SUS nao sao bugs de software — sao ausencias de funcionalidades que ficaram fora do escopo do MVP v1.0. Eles nao comprometem o piloto no modelo de coexistencia com PEC.

A Sprint 5A deve priorizar os itens 5A-07 a 5A-10 (CNS profissional, raca/cor, CID-10, CNES unidade) como pre-requisitos para qualquer integracao futura.

### Para o Juridico

O piloto UBS-001 e defensavel juridicamente sob as seguintes condicoes:
1. Instrumento juridico deve declarar explicitamente que o VITRAS e complementar ao PEC e-SUS, que permanece como sistema oficial de envio ao SISAB.
2. O campo `[CNES_PENDENTE]` deve ser substituido pelo CNES real antes da assinatura.
3. O RIPD deve ser assinado e o DPO designado antes do go-live (bloqueador hard).
4. O medico responsavel deve assinar ciencia de que o sistema nao possui certificacao SBIS PEP NG e que as obrigacoes de notificacao SINAN continuam sendo de sua responsabilidade legal.
5. DPA com AWS e Upstash devem ser formalizados.

### Para a Prefeitura / Secretaria de Saude

O VITRAS v1.0 cobre a gestao operacional interna da UBS mas nao substitui o e-SUS PEC para fins de:
- Envio de producao ao SISAB (essencial para PAB variavel e Previne Brasil)
- Notificacao compulsoria de agravos (SINAN)
- Integracao com historico nacional do paciente (RNDS)

O modelo recomendado para o piloto e: **VITRAS gerencia o fluxo de atendimento interno (fila, agenda, prontuario); PEC continua sendo alimentado pelos profissionais para fins de envio federal.** Esse modelo foi adotado com sucesso em outros municipios que implantaram sistemas complementares ao PEC antes de obter integracao completa.

O roadmap Sprint 6 planeja a exportacao no formato CDS, que permitira que os dados registrados no VITRAS sejam importados no PEC — eliminando a dupla digitacao no futuro.

---

## Apendice A — Tabela Normativa Completa

| Requisito | Status VITRAS | Acao necessaria | Prazo |
|---|---|---|---|
| SISAB envio de producao | AUSENTE | Clausula contratual: PEC permanece como sistema oficial SISAB | Antes go-live |
| CNES da UBS como campo estruturado | AUSENTE | (1) Substituir `[CNES_PENDENTE]` no instrumento; (2) Adicionar coluna `cnes` em app_units | Sprint 5A + antes go-live |
| municipalityId correto (nao hardcoded) | PENDENTE | Validar se `3534401` e o municipio correto para UBS-001; se nao, executar UPDATE antes de producao | Antes go-live |
| Notificacao SINAN | AUSENTE | Procedimento manual documentado no aceite-operacional + clausula contratual de responsabilidade medica | Antes go-live |
| CID-10 estruturado | AUSENTE | Adicionar campo `cid10` em AppointmentCreateSchema e RecordCreateSchema | Sprint 5A |
| CIAP-2 | AUSENTE | Planejar para versao de integracao e-SUS | Sprint 6 |
| Raca/cor, escolaridade, situacao de rua | AUSENTE | Adicionar em PatientBaseShape | Sprint 5A |
| SIPNI vacinacao (lote, dose, codigo PNI) | AUSENTE | Modulo dedicado de vacinacao | Sprint 6 |
| Integracao RNDS/SIPNI | AUSENTE | Monitorar portarias; habilitar como operador RNDS | Sprint 7+ |
| Certificacao SBIS PEP NG | AUSENTE | RISCO — consulta urgente ao juridico antes do go-live | Antes go-live |
| CNS do profissional | AUSENTE | Adicionar campo `cns` opcional para usuarios de saude | Sprint 5A |
| CBO numerico do profissional | AUSENTE | Adicionar campo `cbo` ao cadastro de usuario | Sprint 5B |
| INE da equipe | AUSENTE | Adicionar campo `ine` ao cadastro de equipe | Sprint 5B |
| RIPD assinado + DPO designado | AUSENTE | Prefeitura designa DPO; assina RIPD bilateralmente | Bloqueador go-live |
| DPA com AWS/Upstash | PENDENTE | Joao: aceitar AWS DPA via Artifact; verificar Upstash DPA | T-7 dias |
| Instrumento juridico assinado | AUSENTE | Constituicao juridica Vitras (CNPJ) + assinatura bilateral | Antes go-live |
| SIGTAP procedimentos | AUSENTE | Planejar tabela SIGTAP | Sprint 6 |
| Cadastro domiciliar completo (CDS) | PARTIAL | Modulo completo com condicoes de moradia | Sprint 6 |
| Validacao CPF ou CNS obrigatorio | AUSENTE | Regra de validacao em PatientCreateSchema | Sprint 5B |
| Retencao 20 anos / anonimizacao legal | PENDENTE | Validar parametro minimo inatividade = 20 anos (KI-02) | Sprint 5A |

---

## Apendice B — Evidencias de Codigo por Area

### Cadastro Individual
- `src/schemas.js:24–62` — `PatientBaseShape`: campos aceitos no cadastro de paciente
- `src/routes/patients.js:140` — validacao minima: apenas `name` e `phone` obrigatorios
- `src/routes/patients.js:156` — fallback `municipalityId = req.user.municipalityId || "3534401"`
- `src/migrations/010_add_municipality_id.js:7` — backfill com valor `'3534401'` hardcoded

### Cadastro Domiciliar
- `src/routes/family-groups.js:22–34` — GET retorna grupos; campos: `address`, `microArea`, `assignedAcsId`, `memberPatientIds`
- `src/routes/family-groups.js:36–63` — PATCH members: unico campo validado e `memberPatientIds`
- Ausencia de schema Zod para criacao de grupo familiar completo

### Atendimento Individual
- `src/schemas.js:120–126` — `AppointmentCreateSchema`: `date`, `summary`, `demandType`, `conduct`, `nextStep` — sem CID-10, sem CIAP-2
- `src/schemas.js:128–136` — `AgendaCreateSchema`: `type` enum (consultation/return/procedure/other) — sem CBO, sem CNS profissional
- `src/migrations/011_add_executing_context_to_appointments.js:7–8` — colunas `executing_team_id`, `executing_unit_id` (contexto de execucao, mas sem CNES e INE)

### Identificacao do Profissional
- `src/schemas.js:13–22` — `RegisterSchema`: campos de usuario — sem `cns`, sem `cbo`
- `src/schemas.js:273–280` — `MePatchSchema`: edicao de perfil — sem `cns`
- `src/routes/users.js:20–33` — `buildUserAuditSnapshot`: auditoria registra `councilType`, `councilNumber`, `councilUf` — sem `cns` (nota: `councilType` e derivado em runtime via `councilTypeForRole(role)`, nao e campo de entrada do RegisterSchema)

### CID-10
- Zero ocorrencias de `cid10`, `cid_10`, `diagnosis_code` em `src/` (confirmado por varredura)
- `src/schemas.js:38` — `chronicConditions: z.array(z.string().trim().max(100))` — texto livre

### CIAP-2
- Zero ocorrencias de `ciap`, `ciap2`, `reason_code` em `src/` (confirmado por varredura)
- `src/schemas.js:122` — `summary: z.string().trim().min(1).max(10000)` — texto livre

### SIGTAP
- Zero ocorrencias de `sigtap`, `procedure_code`, `tuss` em `src/` (confirmado por varredura)
- `src/schemas.js:223–228` — `ExamCreateSchema`: `title`, `date`, `notes`, `source`
- `src/schemas.js:148–156` — `ReferralCreateSchema`: `specialty` em texto livre

### Previne Brasil
- `src/schemas.js:38` — `chronicConditions` como lista de strings (HAS, DM por texto)
- `src/schemas.js:48–57` — campos de gestacao: `pregnancyStartDate`, `prenatalStartDate`, `gestationalAge*`
- Deteccao de sifilis: regex em texto livre (fragil — localizacao exata sujeita a auditoria de runtime)

### Vacinacao
- `src/schemas.js:238–245` — `RecordCreateSchema`: `type` enum inclui "vaccine"; sem lote, dose, via, local, codigo PNI
- `src/schemas.js:244` — `metadata: z.record(z.any())` — dados nao estruturados possiveis via metadata

### Visitas ACS
- `src/schemas.js:239` — `RecordCreateSchema` `type` enum inclui "visit"
- `src/routes/family-groups.js:16–19` — restricao correta de visibilidade por perfil ACS (`group.assignedAcsId === user.id`)

---

*Documento gerado em 2026-06-10. Plataforma go congelada — nenhum codigo foi alterado para producao deste documento.*
*Proxima revisao recomendada: apos Sprint 5A (quando campos CNS, CID-10 e CNES forem implementados).*
