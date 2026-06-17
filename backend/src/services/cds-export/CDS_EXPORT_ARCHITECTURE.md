# CDS Export — Arquitetura v1

**Versão:** 1.0  
**Data:** 2026-06-17  
**LEDI APS:** 7.4.0  
**Thrift IDL ref:** [laboratoriobridge/esusaps-integracao](https://github.com/laboratoriobridge/esusaps-integracao)

---

## Fichas Implementadas

| Ficha | Sprint | Endpoint | Struct LEDI |
|-------|--------|----------|-------------|
| Cadastro Individual | C04A | `GET /export/cds/individual/:patientId` | `CadastroIndividualTransport` |
| Cadastro Domiciliar | C04B | `GET /export/cds/domiciliar/:householdId` | `CadastroDomiciliarTransport` |
| Atendimento Individual | C04C | `GET /export/cds/atendimento/:patientId/:recordId` | `FichaAtendimentoIndividualMasterThrift` |

---

## Fluxo de Exportação

```
HTTP GET /export/cds/<ficha>/<id>
  │
  ├─ requireAuth → RBAC: hasCapability(user, "cds.export")
  │    authorized: gestor, break_glass_admin
  │    denied: acs, receptionist, nurse_manager, doctor, nursing_tech
  │
  ├─ readDb() → resolve patient/household/record + professional + unit + team
  │
  ├─ build<Ficha>() → TBinaryProtocol buffer
  │    enum-maps.js → VITRAS strings → LEDI i64/string
  │    cds-structs.js → Thrift field serialization
  │    thrift-protocol.js → BinaryWriter (pure Node, no deps)
  │
  ├─ buildEsusZip([{name, data}]) → ZIP STORE buffer
  │    esus-packer.js → CRC-32 + local header + central directory + EOCD
  │
  ├─ addAuditLog(db, actor, "cds.export.<ficha>", ...) → audit chain
  │    CID/CIAP/HIV/sifilis: SPECIAL_CATEGORY_FIELDS → redacted in before/after
  │    NOT included in export audit details (by design)
  │
  └─ res.send(buffer) Content-Type: application/zip
       X-Ficha-UUID, X-Origin-UUID, X-CDS-Warnings headers
```

---

## Arquivos do Subsistema

| Arquivo | Responsabilidade |
|---------|-----------------|
| `thrift-protocol.js` | BinaryWriter + field writers (pure impl, zero deps) |
| `enum-maps.js` | VITRAS string → LEDI i64/string mappings |
| `cds-structs.js` | Thrift struct serializers para cada ficha |
| `index.js` | Funções públicas de exportação (buildZip + filename) |
| `esus-packer.js` | ZIP STORE com CRC-32 (compatível Linux unzip) |
| `../routes/cds-export.js` | Express routes + RBAC + audit |

---

## Padrão de Serialização

### Protocolo
- **Apache Thrift TBinaryProtocol** — implementado em pure Node.js sem deps
- Campo: `[type:1B][fieldId:2B BE][value]`
- Struct termina com `STOP (0x00)`
- Lista: `[LIST_type:1B][fieldId:2B][elem_type:1B][count:4B][elements...]`

### Tipos usados
| Tipo Thrift | JS | Uso |
|-------------|-----|-----|
| `i64` | `BigInt` | Enums LEDI, timestamps epoch ms |
| `i32` | `Number` | tpCdsOrigem, tipoEndereco, contagens |
| `string` | `String` | CID-10, CIAP-2, CNS, CNES, CPF, nomes |
| `bool` | `Boolean` | fichaAtualizada, indicadores |
| `LIST<STRUCT>` | `Array` | problemasCondicoes (C04C) |

### tpCdsOrigem
Hardcoded `3` em todas as fichas — identifica VITRAS como sistema terceiro.

---

## Headers LEDI por Ficha

| Ficha | Header Struct | Campo | Diferença |
|-------|--------------|-------|-----------|
| CadastroIndividual | `UnicaLotacaoHeaderThrift` | field 11 | dataAtendimento = now() |
| CadastroDomiciliar | `UnicaLotacaoHeaderThrift` | field 17 | dataAtendimento = now() |
| AtendimentoIndividual | `VariasLotacoesHeaderThrift` | field 1 | dataAtendimento = record.date |

`UnicaLotacaoHeaderThrift`: fields 1-6 (profissionalCNS, cboCodigo, cnes, ine, dataAtendimento, ibge)  
`VariasLotacoesHeaderThrift`: field 6 = `LotacaoHeaderThrift` (profissional), fields 8-9 (data, ibge)

---

## Mapeamento de Campos Clínicos (C04C)

### Record → FichaAtendimentoIndividualChildThrift

| Campo VITRAS | Field ID | Tipo LEDI | Observação |
|-------------|----------|-----------|------------|
| `patient.cns` | 2 | string | opcional |
| `patient.birthDate` | 3 | i64 epoch ms | opcional |
| `record.localDeAtendimento` | 4 | i64 | default UBS=1n |
| `patient.sex` | 5 | i64 | M=0n, F=1n |
| `record.turno` | 6 | i64 | default TARDE=2n |
| `record.type + demandType` | 7 | i64 | resolveTipoAtendimento() |
| `patient.cpf` | 30 | string | opcional |
| `cidPrincipal + ciapPrincipal + cidSecundarios` | 40 | list<ProblemaCondicaoThrift> | strings |

### ProblemaCondicaoThrift (field 40 items)
- field 4: `ciap` (string, ex: "R96")
- field 5: `cid10` (string, ex: "J45")
- field 6: `situacao` (i64, 1=ATIVO)
- field 9: `isAvaliado` (bool, true)

**CIAP-2:** string normalizado (`[A-Z]\d{2}`). `mapCiap2ToLedi()` retorna null para formatos inválidos.  
**CID-10:** string passada como-está (validada pelo schema Zod na criação do record).

---

## RBAC — Capability `cds.export`

| Role | cds.export |
|------|-----------|
| `break_glass_admin` | ✅ |
| `gestor` | ✅ |
| `nurse_manager` | ❌ |
| `doctor` | ❌ |
| `acs` | ❌ |
| `receptionist` | ❌ |
| `nursing_tech` | ❌ |

Proteção dupla: `requireAuth` middleware + `hasCapability(req.user, "cds.export")` em cada rota.

---

## LGPD — Campos Sensíveis

`SPECIAL_CATEGORY_FIELDS` (Art. 11 LGPD) — redactados em `details.before`/`details.after` do audit:

```
genderIdentity, racaCor, etnia, situacaoRua, deficiencia,
hivGestante, sifilis, cidPrincipal, cidSecundarios, ciapPrincipal
```

Audit de exportação (`cds.export.atendimento`) **não inclui** cidPrincipal/ciapPrincipal nas details por design — apenas recordId, recordType, recordDate, fichaUuid, exportedBy.

---

## Tipos Elegíveis por Ficha

### Cadastro Individual
Qualquer paciente ativo. Pacientes inativos incluem `SaidaCidadaoCadastro`.

### Cadastro Domiciliar
Qualquer household registrado no sistema.

### Atendimento Individual
Apenas records com `type` em: `consultation`, `nursing`, `procedure`.  
Excluídos: `visit`, `note`, `prescription`, `referral`, `exam_request`, `vaccine`, `attendance_attest`, `medical_attest`.  
`visit` (Visita ACS) ≠ Atendimento Clínico — CLAUDE.md constraint permanente.

---

## Limitações Conhecidas

| # | Limitação | Impacto | Resolução |
|---|-----------|---------|-----------|
| L-01 | `ciapSecundarios` não exportado em C04C | Apenas CIAP principal vai em ProblemaCondicaoThrift[0] | Implementar quando schema suportar array de CIAP |
| L-02 | `double writeFieldStop()` em writeStruct pattern | PEC tolera atualmente; risco com PEC strict | Refatorar sem alterar comportamento (próxima sprint) |
| L-03 | ibgeMunicipio hardcode fallback "3534401" | Correto para staging; produção requer municipalityId configurado | OK para staging |
| L-04 | CIAP-2 validado apenas por formato regex | Não valida existência na tabela ciap2 | Aceitável — schema Zod já valida na criação |
| L-05 | `TIPO_ATENDIMENTO_MAP` não usado em resolveTipoAtendimento() | Dead code | Remover ou usar na próxima sprint |

---

## Pendências PEC

| ID | Item | Prioridade |
|----|------|------------|
| M-05 | Confirmar PEC ≥ 5.4.36 na UBS-001 | Alta |
| M-06 | Import .esus no PEC homologação | Alta |
| M-07 | Validar Cadastro Individual no PEC CDS | Alta |
| M-08 | Validar Cadastro Domiciliar no PEC CDS | Alta |
| M-09 | Validar Atendimento Individual no PEC CDS | Alta |
| M-10 | Substituir CNS/CNES/INE sintéticos por dados reais antes go-live | Crítica |

---

## Dependências Externas

- **Nenhuma** — Zero deps externos no subsistema CDS export  
- `uuid` (já no package.json) — para fichaUuid/originUuid
- Thrift: pure Node.js BinaryWriter (sem lib thrift)
- ZIP: pure Node.js esus-packer.js (sem lib zip)

---

## Não Implementado (fora de escopo)

- Ficha de Visita Domiciliar ACS (Visita ACS ≠ Atendimento Clínico)
- Ficha de Procedimentos Consolidados
- Ficha de Atividade Coletiva
- Ficha de Vacinação
- RNDS
- SISAB
- APIs federais
