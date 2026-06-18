// Minimal ZIP generator (STORE mode — no compression, no external deps).
// Produces a buffer with .esus extension compatible for import in e-SUS PEC.

// CRC-32 lookup table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const byte of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime() {
  const now = new Date();
  const time = ((now.getHours() & 0x1F) << 11) | ((now.getMinutes() & 0x3F) << 5) | ((now.getSeconds() >> 1) & 0x1F);
  const date = (((now.getFullYear() - 1980) & 0x7F) << 9) | (((now.getMonth() + 1) & 0x0F) << 5) | (now.getDate() & 0x1F);
  return { time, date };
}

/**
 * Build a .esus (ZIP) buffer from an array of {name, data} entries.
 * Uses STORE compression (method=0) — no deflate needed.
 *
 * @param {Array<{name: string, data: Buffer}>} entries
 * @returns {Buffer}
 */
export function buildEsusZip(entries) {
  const localParts = [];
  const dirMeta = [];
  let localOffset = 0;
  const { time, date } = dosDateTime();

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const size = data.length;

    // Local file header (30 bytes + filename)
    const lh = Buffer.alloc(30 + nameBytes.length);
    lh.writeUInt32LE(0x04034B50, 0);   // signature PK\x03\x04
    lh.writeUInt16LE(20, 4);            // version needed: 2.0
    lh.writeUInt16LE(0, 6);             // general flags
    lh.writeUInt16LE(0, 8);             // compression: STORE
    lh.writeUInt16LE(time, 10);         // mod time
    lh.writeUInt16LE(date, 12);         // mod date
    lh.writeUInt32LE(crc, 14);          // CRC-32
    lh.writeUInt32LE(size, 18);         // compressed size
    lh.writeUInt32LE(size, 22);         // uncompressed size
    lh.writeUInt16LE(nameBytes.length, 26); // filename length
    lh.writeUInt16LE(0, 28);            // extra field length
    nameBytes.copy(lh, 30);

    localParts.push(lh, data);
    dirMeta.push({ nameBytes, crc, size, offset: localOffset });
    localOffset += lh.length + size;
  }

  // Central directory
  const cdParts = [];
  const { time: cTime, date: cDate } = dosDateTime();
  for (const { nameBytes, crc, size, offset } of dirMeta) {
    const cd = Buffer.alloc(46 + nameBytes.length);
    cd.writeUInt32LE(0x02014B50, 0);    // central dir signature PK\x01\x02
    cd.writeUInt16LE(20, 4);             // version made by
    cd.writeUInt16LE(20, 6);             // version needed
    cd.writeUInt16LE(0, 8);              // flags
    cd.writeUInt16LE(0, 10);             // compression
    cd.writeUInt16LE(cTime, 12);         // mod time
    cd.writeUInt16LE(cDate, 14);         // mod date
    cd.writeUInt32LE(crc, 16);           // CRC-32
    cd.writeUInt32LE(size, 20);          // compressed size
    cd.writeUInt32LE(size, 24);          // uncompressed size
    cd.writeUInt16LE(nameBytes.length, 28); // filename length
    cd.writeUInt16LE(0, 30);             // extra length
    cd.writeUInt16LE(0, 32);             // comment length
    cd.writeUInt16LE(0, 34);             // disk number start
    cd.writeUInt16LE(0, 36);             // internal attrs
    cd.writeUInt32LE(0, 38);             // external attrs
    cd.writeUInt32LE(offset, 42);        // local header offset
    nameBytes.copy(cd, 46);
    cdParts.push(cd);
  }

  const cdBuf = Buffer.concat(cdParts);
  const cdSize = cdBuf.length;

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054B50, 0);    // EOCD signature PK\x05\x06
  eocd.writeUInt16LE(0, 4);              // disk number
  eocd.writeUInt16LE(0, 6);              // disk with central dir
  eocd.writeUInt16LE(dirMeta.length, 8); // entries on this disk
  eocd.writeUInt16LE(dirMeta.length, 10); // total entries
  eocd.writeUInt32LE(cdSize, 12);         // central dir size
  eocd.writeUInt32LE(localOffset, 16);    // central dir offset
  eocd.writeUInt16LE(0, 20);              // comment length

  return Buffer.concat([...localParts, cdBuf, eocd]);
}
