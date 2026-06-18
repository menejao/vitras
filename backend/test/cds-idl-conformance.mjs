/**
 * CDS IDL Conformance Test — A-04
 * Validates that FCI, FCD, CondicaoMoradia emit exactly the field IDs
 * mandated by the LEDI APS 7.4.x Thrift IDL.
 *
 * Parses TBinaryProtocol bytes structurally and checks:
 *   - field IDs present
 *   - field types correct
 *   - required fields emitted
 *   - no orphaned bytes
 */

import { buildCadastroIndividual, buildCadastroDomiciliar, buildAtendimentoIndividual }
  from "../src/services/cds-export/cds-structs.js";
import { T } from "../src/services/cds-export/thrift-protocol.js";

// ── Thrift binary parser ──────────────────────────────────────────────────────

/**
 * Parse a Thrift TBinaryProtocol struct from buffer at offset.
 * Returns { fields: [{id, type, offset}], nextOffset }.
 */
function parseStruct(buf, offset = 0) {
  const fields = [];
  while (offset < buf.length) {
    const type = buf[offset];
    if (type === T.STOP) { offset++; break; }
    const fieldId = buf.readInt16BE(offset + 1);
    const dataOffset = offset + 3;
    fields.push({ type, fieldId, dataOffset });
    offset = skipField(buf, type, dataOffset);
  }
  return { fields, nextOffset: offset };
}

function skipField(buf, type, offset) {
  switch (type) {
    case T.BOOL:   return offset + 1;
    case T.BYTE:   return offset + 1;
    case T.I16:    return offset + 2;
    case T.I32:    return offset + 4;
    case T.I64:    return offset + 8;
    case T.DOUBLE: return offset + 8;
    case T.STRING: {
      const len = buf.readInt32BE(offset);
      return offset + 4 + len;
    }
    case T.STRUCT: {
      // skip nested struct recursively
      const r = parseStruct(buf, offset);
      return r.nextOffset;
    }
    case T.LIST: {
      const elemType = buf[offset];
      const count = buf.readInt32BE(offset + 1);
      let pos = offset + 5;
      for (let i = 0; i < count; i++) {
        if (elemType === T.STRUCT) {
          const r = parseStruct(buf, pos);
          pos = r.nextOffset;
        } else {
          pos = skipField(buf, elemType, pos);
        }
      }
      return pos;
    }
    default:
      throw new Error(`Unknown Thrift type 0x${type.toString(16)} at offset ${offset}`);
  }
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

function assertField(fields, fieldId, expectedType, label) {
  const f = fields.find(x => x.fieldId === fieldId);
  assert(f != null, `${label}: field ${fieldId} present`);
  if (f && expectedType != null) {
    assert(f.type === expectedType, `${label}: field ${fieldId} type=${expectedType} (got ${f?.type})`);
  }
}

function assertNoField(fields, fieldId, label) {
  const f = fields.find(x => x.fieldId === fieldId);
  assert(f == null, `${label}: field ${fieldId} absent (was wrong ID in old impl)`);
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

const PROF = { cnsProfissional: "700000000000001", cboCodigo: "223565" };
const UNIT = { cnes: "1234567", municipalityId: "3534401" };
const TEAM = { ine: "0000000001" };
const PATIENT_BASE = {
  id: "pat-001", name: "Ana Teste", birthDate: "1990-01-01", sex: "F",
  racaCor: "PARDA", cns: "700000000000001", cpf: "12345678900",
};
const HOUSEHOLD_BASE = {
  id: "hh-001", tipoImovel: "DOMICILIO", localizacao: "URBANA",
  abastecimentoAgua: "REDE_ENCANADA", tratamentoAgua: "FILTRACAO",
  destinacaoLixo: "COLETA_PUBLICA", esgotamento: "REDE_COLETORA",
  energiaEletrica: true, materialPredominanteParedes: "ALVENARIA_COM_REVESTIMENTO",
  numComodos: 4, numMoradores: 3, situacaoMoradiaPosseTerra: "PROPRIO",
};

// ── FCI Tests ─────────────────────────────────────────────────────────────────

console.log("\n=== FCI (CadastroIndividualTransport) ===");
{
  const { buffer } = buildCadastroIndividual({
    patient: PATIENT_BASE, professional: PROF, unit: UNIT, team: TEAM,
    fichaUuid: "ficha-uuid-001", originUuid: "origin-uuid-001",
  });

  const { fields, nextOffset } = parseStruct(buffer, 0);
  const ids = fields.map(f => f.fieldId);

  assert(nextOffset === buffer.length, `All bytes consumed (${nextOffset}/${buffer.length})`);

  // IDL-mandated fields
  assertField(fields, 4,  T.BOOL,   "FCI fichaAtualizada");
  assertField(fields, 5,  T.STRUCT, "FCI identificacaoUsuarioCidadao");
  assertField(fields, 8,  T.I32,    "FCI tpCdsOrigem");
  assertField(fields, 9,  T.STRING, "FCI uuid");
  assertField(fields, 10, T.STRING, "FCI uuidFichaOriginadora");
  assertField(fields, 13, T.STRUCT, "FCI headerTransport");

  // Old wrong IDs must be absent
  assertNoField(fields, 3,  "FCI emSituacaoDeRua old-id=2 not present at 3");
  assertNoField(fields, 7,  "FCI tpCdsOrigem old-id=7 absent");
  assertNoField(fields, 11, "FCI headerTransport old-id=11 absent");

  // uuid value = fichaUuid
  const uuidField = fields.find(f => f.fieldId === 9);
  if (uuidField) {
    const len = buffer.readInt32BE(uuidField.dataOffset);
    const val = buffer.slice(uuidField.dataOffset + 4, uuidField.dataOffset + 4 + len).toString();
    assert(val === "ficha-uuid-001", `FCI uuid value = fichaUuid (got "${val}")`);
  }
}

// FCI with inactive patient (saidaCidadao)
console.log("\n--- FCI inactive patient (saidaCidadaoCadastro) ---");
{
  const { buffer } = buildCadastroIndividual({
    patient: { ...PATIENT_BASE, inactive: true, inactivationReason: "OBITO" },
    professional: PROF, unit: UNIT, team: TEAM,
    fichaUuid: "ficha-uuid-002", originUuid: "origin-uuid-002",
  });
  const { fields } = parseStruct(buffer, 0);
  assertField(fields, 12, T.STRUCT, "FCI saidaCidadaoCadastro at field 12");
}

// ── FCD Tests ────────────────────────────────────────────────────────────────

console.log("\n=== FCD (CadastroDomiciliarTransport) ===");
{
  const { buffer } = buildCadastroDomiciliar({
    household: HOUSEHOLD_BASE, patient: PATIENT_BASE,
    professional: PROF, unit: UNIT, team: TEAM,
    fichaUuid: "ficha-uuid-010", originUuid: "origin-uuid-010",
  });

  const { fields, nextOffset } = parseStruct(buffer, 0);

  assert(nextOffset === buffer.length, `All bytes consumed (${nextOffset}/${buffer.length})`);

  // IDL-mandated fields
  assertField(fields, 2,  T.STRUCT, "FCD condicaoMoradia");
  assertField(fields, 6,  T.BOOL,   "FCD fichaAtualizada");
  assertField(fields, 10, T.I32,    "FCD tpCdsOrigem");
  assertField(fields, 11, T.STRING, "FCD uuid");
  assertField(fields, 12, T.STRING, "FCD uuidFichaOriginadora");
  assertField(fields, 13, T.I64,    "FCD tipoDeImovel");
  assertField(fields, 15, T.STRUCT, "FCD headerTransport");
  assertField(fields, 20, T.I64,    "FCD tipoEndereco");

  // Old wrong IDs must be absent
  assertNoField(fields, 4,  "FCD condicaoMoradia old-id=4 absent");
  assertNoField(fields, 5,  "FCD fichaAtualizada old-id=5 absent");
  assertNoField(fields, 14, "FCD tipoEndereco old-id=14 absent");
  assertNoField(fields, 17, "FCD headerTransport old-id=17 absent");

  // numMoradores must NOT be in root (moved to CondicaoMoradia)
  assertNoField(fields, 9, "FCD numMoradores absent from root (moved to CondicaoMoradia.8)");

  // uuid value = fichaUuid
  const uuidField = fields.find(f => f.fieldId === 11);
  if (uuidField) {
    const len = buffer.readInt32BE(uuidField.dataOffset);
    const val = buffer.slice(uuidField.dataOffset + 4, uuidField.dataOffset + 4 + len).toString();
    assert(val === "ficha-uuid-010", `FCD uuid value = fichaUuid (got "${val}")`);
  }

  // tipoEndereco must be i64 (8 bytes)
  const teField = fields.find(f => f.fieldId === 20);
  if (teField) {
    // i64 field: dataOffset points to 8 bytes
    assert(teField.type === T.I64, "FCD tipoEndereco emitted as i64");
  }
}

// ── CondicaoMoradia Tests ────────────────────────────────────────────────────

console.log("\n=== CondicaoMoradia (nested in FCD field 2) ===");
{
  const { buffer } = buildCadastroDomiciliar({
    household: HOUSEHOLD_BASE, patient: PATIENT_BASE,
    professional: PROF, unit: UNIT, team: TEAM,
    fichaUuid: "f", originUuid: "o",
  });

  const rootFields = parseStruct(buffer, 0).fields;
  const cmField = rootFields.find(f => f.fieldId === 2);
  assert(cmField != null, "CondicaoMoradia struct found at FCD field 2");

  if (cmField) {
    const { fields: cm } = parseStruct(buffer, cmField.dataOffset);

    assertField(cm, 1,  T.I64,   "CM abastecimentoDeAgua i64");
    assertField(cm, 2,  T.I64,   "CM aguaConsumoDomicilio i64");
    assertField(cm, 3,  T.I64,   "CM destinoLixo i64");
    assertField(cm, 4,  T.I64,   "CM formaEscoamentoBanheiro i64");
    assertField(cm, 5,  T.I64,   "CM localizacao i64");
    assertField(cm, 6,  T.I64,   "CM materialPredominante i64");
    assertField(cm, 7,  T.STRING,"CM nuComodos string");
    assertField(cm, 8,  T.STRING,"CM nuMoradores string");
    assertField(cm, 9,  T.I64,   "CM situacaoMoradiaPosseTerra i64");
    assertField(cm, 10, T.BOOL,  "CM stDisponibilidadeEnergiaEletrica bool");

    // field 5 must be localizacao (i64), not energiaEletrica (bool) as in old impl
    const f5 = cm.find(f => f.fieldId === 5);
    assert(f5?.type === T.I64, "CM field 5 is i64 (localizacao), not bool (old energiaEletrica)");

    // nuComodos value = "4" (string)
    const f7 = cm.find(f => f.fieldId === 7);
    if (f7) {
      const len = buffer.readInt32BE(f7.dataOffset);
      const val = buffer.slice(f7.dataOffset + 4, f7.dataOffset + 4 + len).toString();
      assert(val === "4", `CM nuComodos string value = "4" (got "${val}")`);
    }

    // nuMoradores value = "3" (string)
    const f8 = cm.find(f => f.fieldId === 8);
    if (f8) {
      const len = buffer.readInt32BE(f8.dataOffset);
      const val = buffer.slice(f8.dataOffset + 4, f8.dataOffset + 4 + len).toString();
      assert(val === "3", `CM nuMoradores string value = "3" (got "${val}")`);
    }
  }
}

// ── FAI regression (must still pass) ─────────────────────────────────────────

console.log("\n=== FAI regression (AtendimentoIndividual) ===");
{
  const { buffer } = buildAtendimentoIndividual({
    record: { id: "r1", type: "consultation", date: "2026-06-18",
              cidPrincipal: "J45", ciapPrincipal: "R96" },
    patient: PATIENT_BASE,
    professional: PROF, unit: UNIT, team: TEAM,
    fichaUuid: "ficha-ai-001",
  });

  const { fields, nextOffset } = parseStruct(buffer, 0);
  assert(nextOffset === buffer.length, `FAI all bytes consumed (${nextOffset}/${buffer.length})`);
  assertField(fields, 1, T.STRUCT, "FAI headerTransport");
  assertField(fields, 2, T.LIST,   "FAI atendimentosIndividuais");
  assertField(fields, 3, T.STRING, "FAI uuidFicha");
  assertField(fields, 4, T.I32,    "FAI tpCdsOrigem");
}

// ── Summary ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${"─".repeat(60)}`);
console.log(`A-04 IDL Conformance: ${passed}/${total} PASS  ${failed > 0 ? `| ${failed} FAIL` : ""}`);
if (failed === 0) {
  console.log("CDS EXPORT IDL CONFORMANT ✓");
} else {
  console.log("CDS EXPORT NOT CONFORMANT — see FAIL lines above");
  process.exit(1);
}
