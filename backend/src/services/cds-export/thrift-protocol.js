// Apache Thrift TBinaryProtocol writer — pure Node.js, no external deps.
// Spec: https://github.com/apache/thrift/blob/master/doc/specs/thrift-binary-encoding.md

export const T = Object.freeze({
  STOP:   0,
  BOOL:   2,
  BYTE:   3,
  DOUBLE: 4,
  I16:    6,
  I32:    8,
  I64:   10,
  STRING: 11,
  STRUCT: 12,
  MAP:   13,
  SET:   14,
  LIST:  15,
});

export class BinaryWriter {
  constructor() {
    this._chunks = [];
  }

  _push(buf) { this._chunks.push(buf); }

  writeByte(v) {
    const b = Buffer.alloc(1);
    b.writeInt8(v & 0xFF);
    this._push(b);
  }

  writeUByte(v) {
    const b = Buffer.alloc(1);
    b.writeUInt8(v & 0xFF);
    this._push(b);
  }

  writeI16(v) {
    const b = Buffer.alloc(2);
    b.writeInt16BE(v);
    this._push(b);
  }

  writeI32(v) {
    const b = Buffer.alloc(4);
    b.writeInt32BE(v);
    this._push(b);
  }

  writeI64(v) {
    const b = Buffer.alloc(8);
    b.writeBigInt64BE(BigInt(v));
    this._push(b);
  }

  writeDouble(v) {
    const b = Buffer.alloc(8);
    b.writeDoubleBE(v);
    this._push(b);
  }

  writeBool(v) {
    this.writeUByte(v ? 1 : 0);
  }

  writeString(s) {
    const encoded = Buffer.from(String(s ?? ""), "utf8");
    this.writeI32(encoded.length);
    this._push(encoded);
  }

  // Field header: type (1 byte) + field id (2 bytes BE)
  writeFieldBegin(type, fieldId) {
    this.writeUByte(type);
    this.writeI16(fieldId);
  }

  writeFieldStop() {
    this.writeUByte(T.STOP);
  }

  // List: element_type (1 byte) + count (4 bytes)
  writeListBegin(elemType, size) {
    this.writeUByte(elemType);
    this.writeI32(size);
  }

  toBuffer() {
    return Buffer.concat(this._chunks);
  }
}

/** Write a nested struct: write all inner fields then STOP, wrapped in outer field header. */
export function writeStruct(w, fieldId, writeInnerFn) {
  w.writeFieldBegin(T.STRUCT, fieldId);
  writeInnerFn(w);
  w.writeFieldStop();
}

/** Write I32 field — skips if value is null/undefined. */
export function writeI32Field(w, fieldId, value) {
  if (value == null) return;
  w.writeFieldBegin(T.I32, fieldId);
  w.writeI32(Number(value));
}

/** Write I64 field (accepts number or BigInt) — skips if null/undefined. */
export function writeI64Field(w, fieldId, value) {
  if (value == null) return;
  w.writeFieldBegin(T.I64, fieldId);
  w.writeI64(value);
}

/** Write STRING field — skips if null/undefined/empty. */
export function writeStringField(w, fieldId, value) {
  if (value == null || value === "") return;
  w.writeFieldBegin(T.STRING, fieldId);
  w.writeString(value);
}

/** Write BOOL field — skips if null/undefined. */
export function writeBoolField(w, fieldId, value) {
  if (value == null) return;
  w.writeFieldBegin(T.BOOL, fieldId);
  w.writeBool(Boolean(value));
}

/** Write List<I64> field — skips if null/empty. */
export function writeI64ListField(w, fieldId, values) {
  if (!Array.isArray(values) || values.length === 0) return;
  w.writeFieldBegin(T.LIST, fieldId);
  w.writeListBegin(T.I64, values.length);
  for (const v of values) w.writeI64(v);
}

/**
 * Write List<STRUCT> field.
 * writeItemFn(w, item) must write all struct fields + call w.writeFieldStop().
 * Skips if null/empty.
 */
export function writeStructListField(w, fieldId, items, writeItemFn) {
  if (!Array.isArray(items) || items.length === 0) return;
  w.writeFieldBegin(T.LIST, fieldId);
  w.writeListBegin(T.STRUCT, items.length);
  for (const item of items) {
    writeItemFn(w, item);
  }
}
