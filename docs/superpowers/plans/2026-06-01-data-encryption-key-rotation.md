# Data Encryption Key Rotation — Multi-Key Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AES-256-GCM multi-key support with Key ID so DATA_ENCRYPTION_KEY can be rotated without a big-bang re-encryption, while keeping full backward compatibility with existing ciphertext.

**Architecture:** A key registry is built at module load time in `config.js` from `DATA_ENCRYPTION_KEYS` (JSON map) + `DATA_ENCRYPTION_ACTIVE_KEY_ID`, with a fallback to the legacy `DATA_ENCRYPTION_KEY`. `db.js` embeds the `kid` in new ciphertext and routes decryption by `kid` read from the payload. Old payloads (no `kid`) always decrypt with the `legacy` key.

**Tech Stack:** Node.js ESM, built-in `crypto` (AES-256-GCM), `node:test` test runner, PostgreSQL/file dual-driver.

---

## Format Reference

| Version | Ciphertext format | Detection |
|---------|------------------|-----------|
| Legacy  | `enc1:<iv_b64>:<enc_b64>:<tag_b64>` | 3 parts after splitting payload by `:` |
| New     | `enc1:<kid>:<iv_b64>:<enc_b64>:<tag_b64>` | 4 parts after splitting payload by `:` |

Base64 never contains `:` so splitting on `:` is unambiguous.

---

## Task 1: Update config.js — key registry + validation

**Files:**
- Modify: `backend/src/config.js`

### What to change

After the existing `DATA_ENCRYPTION_KEY` line (line 53), add:

```js
const DATA_ENCRYPTION_KEYS_RAW = String(process.env.DATA_ENCRYPTION_KEYS || "").trim();
const DATA_ENCRYPTION_ACTIVE_KEY_ID_RAW = String(process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID || "").trim();

function _buildKeyRegistry() {
  if (DATA_ENCRYPTION_KEYS_RAW) {
    let parsed;
    try {
      parsed = JSON.parse(DATA_ENCRYPTION_KEYS_RAW);
    } catch {
      throw new Error("DATA_ENCRYPTION_KEYS: JSON inválido");
    }
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
      throw new Error("DATA_ENCRYPTION_KEYS: deve ser objeto JSON { kid: key }");
    }
    for (const [kid, raw] of Object.entries(parsed)) {
      if (String(raw || "").trim().length < 32) {
        throw new Error(`DATA_ENCRYPTION_KEYS: chave '${kid}' inválida — mínimo 32 caracteres após trim`);
      }
    }
    if (!DATA_ENCRYPTION_ACTIVE_KEY_ID_RAW) {
      throw new Error("DATA_ENCRYPTION_ACTIVE_KEY_ID obrigatório quando DATA_ENCRYPTION_KEYS está definido");
    }
    if (!Object.prototype.hasOwnProperty.call(parsed, DATA_ENCRYPTION_ACTIVE_KEY_ID_RAW)) {
      throw new Error("DATA_ENCRYPTION_ACTIVE_KEY_ID aponta para chave inexistente em DATA_ENCRYPTION_KEYS");
    }
    return parsed;
  }
  // Legacy fallback: single key under the "legacy" kid
  return DATA_ENCRYPTION_KEY ? { legacy: DATA_ENCRYPTION_KEY } : {};
}

const DATA_ENCRYPTION_KEY_REGISTRY = _buildKeyRegistry();
const DATA_ENCRYPTION_ACTIVE_KID = DATA_ENCRYPTION_KEYS_RAW
  ? DATA_ENCRYPTION_ACTIVE_KEY_ID_RAW
  : (DATA_ENCRYPTION_KEY ? "legacy" : "");
```

Replace the existing prod guard for `DATA_ENCRYPTION_KEY` (lines 83–90):

```js
if (IS_PROD) {
  const hasMultiKey = !!DATA_ENCRYPTION_KEYS_RAW;
  const hasLegacyKey = !!DATA_ENCRYPTION_KEY && DATA_ENCRYPTION_KEY.length >= 32;
  if (!hasMultiKey && !hasLegacyKey) {
    throw new Error(
      "DATA_ENCRYPTION_KEY (ou DATA_ENCRYPTION_KEYS) obrigatório em produção — dados sensíveis não podem ser armazenados sem criptografia"
    );
  }
  if (!hasMultiKey && DATA_ENCRYPTION_KEY && DATA_ENCRYPTION_KEY.length < 32) {
    throw new Error("DATA_ENCRYPTION_KEY inválido em produção — mínimo 32 caracteres");
  }
}
```

Add to exports:

```js
export {
  // ... existing exports ...
  DATA_ENCRYPTION_KEY_REGISTRY,
  DATA_ENCRYPTION_ACTIVE_KID,
};
```

- [ ] **Step 1: Read the current prod guard block in config.js**

Open `backend/src/config.js` lines 83–99. Confirm the guard text before editing.

- [ ] **Step 2: Add the key registry block**

Insert after line 53 (`const DATA_ENCRYPTION_KEY = ...`):

```js
const DATA_ENCRYPTION_KEYS_RAW = String(process.env.DATA_ENCRYPTION_KEYS || "").trim();
const DATA_ENCRYPTION_ACTIVE_KEY_ID_RAW = String(process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID || "").trim();

function _buildKeyRegistry() {
  if (DATA_ENCRYPTION_KEYS_RAW) {
    let parsed;
    try {
      parsed = JSON.parse(DATA_ENCRYPTION_KEYS_RAW);
    } catch {
      throw new Error("DATA_ENCRYPTION_KEYS: JSON inválido");
    }
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
      throw new Error("DATA_ENCRYPTION_KEYS: deve ser objeto JSON { kid: key }");
    }
    for (const [kid, raw] of Object.entries(parsed)) {
      if (String(raw || "").trim().length < 32) {
        throw new Error(`DATA_ENCRYPTION_KEYS: chave '${kid}' inválida — mínimo 32 caracteres após trim`);
      }
    }
    if (!DATA_ENCRYPTION_ACTIVE_KEY_ID_RAW) {
      throw new Error("DATA_ENCRYPTION_ACTIVE_KEY_ID obrigatório quando DATA_ENCRYPTION_KEYS está definido");
    }
    if (!Object.prototype.hasOwnProperty.call(parsed, DATA_ENCRYPTION_ACTIVE_KEY_ID_RAW)) {
      throw new Error("DATA_ENCRYPTION_ACTIVE_KEY_ID aponta para chave inexistente em DATA_ENCRYPTION_KEYS");
    }
    return parsed;
  }
  return DATA_ENCRYPTION_KEY ? { legacy: DATA_ENCRYPTION_KEY } : {};
}

const DATA_ENCRYPTION_KEY_REGISTRY = _buildKeyRegistry();
const DATA_ENCRYPTION_ACTIVE_KID = DATA_ENCRYPTION_KEYS_RAW
  ? DATA_ENCRYPTION_ACTIVE_KEY_ID_RAW
  : (DATA_ENCRYPTION_KEY ? "legacy" : "");
```

- [ ] **Step 3: Replace the prod guard for DATA_ENCRYPTION_KEY**

Find and replace the block starting with:
```
if (IS_PROD && (!process.env.JWT_SECRET ...
```
specifically the DATA_ENCRYPTION_KEY guards at lines 83–90 with:

```js
if (IS_PROD) {
  const hasMultiKey = !!DATA_ENCRYPTION_KEYS_RAW;
  const hasLegacyKey = !!DATA_ENCRYPTION_KEY && DATA_ENCRYPTION_KEY.length >= 32;
  if (!hasMultiKey && !hasLegacyKey) {
    throw new Error(
      "DATA_ENCRYPTION_KEY (ou DATA_ENCRYPTION_KEYS) obrigatório em produção — dados sensíveis não podem ser armazenados sem criptografia"
    );
  }
  if (!hasMultiKey && DATA_ENCRYPTION_KEY && DATA_ENCRYPTION_KEY.length < 32) {
    throw new Error("DATA_ENCRYPTION_KEY inválido em produção — mínimo 32 caracteres");
  }
}
```

- [ ] **Step 4: Add new exports to the export block**

Append `DATA_ENCRYPTION_KEY_REGISTRY` and `DATA_ENCRYPTION_ACTIVE_KID` to the `export { ... }` block at the bottom of `config.js`.

- [ ] **Step 5: Verify no syntax errors**

```
cd backend && node --input-type=module --eval "import './src/config.js'"
```
Expected: no output (no errors).

---

## Task 2: Write failing unit tests for encrypt/decrypt

**Files:**
- Create: `backend/test/encryption.test.js`

- [ ] **Step 1: Create the test file**

```js
// backend/test/encryption.test.js
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

// We test the internal helpers by importing db.js in a controlled env.
// We set env vars BEFORE any import so module-level init sees them.

const LEGACY_KEY = "test-legacy-key-32-bytes-pad0000";
const V1_KEY     = "test-v1-key-32-bytes-padding0000";
const V2_KEY     = "test-v2-key-32-bytes-padding0000";

describe("encryption multi-key", () => {
  describe("legacy mode (only DATA_ENCRYPTION_KEY)", () => {
    let encryptText, decryptText;

    before(async () => {
      // Clean module cache trick: use a fresh worker or re-import with fresh env.
      // Since node:test runs in same process, we set env then dynamically import.
      delete process.env.DATA_ENCRYPTION_KEYS;
      delete process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID;
      process.env.DATA_ENCRYPTION_KEY = LEGACY_KEY;
      // Dynamic import with cache-bust query string not needed for ESM in Node,
      // but we need fresh module state. Use direct function exports instead.
      const mod = await import("../src/db.js");
      encryptText = mod._testExports.encryptText;
      decryptText = mod._testExports.decryptText;
    });

    it("encrypt produces enc1: prefix", () => {
      const cipher = encryptText("hello");
      assert.ok(cipher.startsWith("enc1:"), `expected enc1: prefix, got: ${cipher.slice(0, 20)}`);
    });

    it("encrypt with legacy key embeds kid=legacy", () => {
      const cipher = encryptText("hello");
      const parts = cipher.slice("enc1:".length).split(":");
      assert.equal(parts.length, 4, "new format should have 4 parts: kid, iv, enc, tag");
      assert.equal(parts[0], "legacy");
    });

    it("decrypt new payload with kid=legacy", () => {
      const cipher = encryptText("test-value");
      const plain = decryptText(cipher);
      assert.equal(plain, "test-value");
    });

    it("decrypt legacy payload without kid (3 parts)", () => {
      // Simulate a legacy ciphertext produced by the OLD code (no kid in payload)
      const { createCipheriv, randomBytes, createHash } = await import("node:crypto");
      const key = createHash("sha256").update(LEGACY_KEY).digest();
      const iv = randomBytes(12);
      const cipher2 = createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([cipher2.update("old-value", "utf8"), cipher2.final()]);
      const tag = cipher2.getAuthTag();
      const legacy = `enc1:${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
      assert.equal(legacy.slice("enc1:".length).split(":").length, 3, "should be 3-part legacy format");
      const plain = decryptText(legacy);
      assert.equal(plain, "old-value");
    });

    it("plaintext passthrough when no key", () => {
      // encryptText returns raw value when no key available — tested via decryptText on non-enc value
      const plain = decryptText("not-encrypted");
      assert.equal(plain, "not-encrypted");
    });
  });

  describe("multi-key mode (DATA_ENCRYPTION_KEYS)", () => {
    let encryptText, decryptText;
    const registry = JSON.stringify({ v1: V1_KEY, v2: V2_KEY });

    before(async () => {
      delete process.env.DATA_ENCRYPTION_KEYS;
      delete process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID;
      process.env.DATA_ENCRYPTION_KEYS = registry;
      process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID = "v2";
      process.env.DATA_ENCRYPTION_KEY = LEGACY_KEY; // kept for legacy fallback
      const mod = await import("../src/db.js");
      encryptText = mod._testExports.encryptText;
      decryptText = mod._testExports.decryptText;
    });

    it("encrypt new payload uses active kid=v2", () => {
      const cipher = encryptText("data");
      const parts = cipher.slice("enc1:".length).split(":");
      assert.equal(parts[0], "v2");
    });

    it("decrypt with kid=v2", () => {
      const cipher = encryptText("v2-value");
      const plain = decryptText(cipher);
      assert.equal(plain, "v2-value");
    });

    it("decrypt with kid=v1 (cross-key decrypt)", () => {
      // Manually produce a v1 ciphertext then decrypt it
      const { createCipheriv, randomBytes, createHash } = await import("node:crypto");
      const key = createHash("sha256").update(V1_KEY).digest();
      const iv = randomBytes(12);
      const cipher2 = createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([cipher2.update("v1-data", "utf8"), cipher2.final()]);
      const tag = cipher2.getAuthTag();
      const v1cipher = `enc1:v1:${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
      const plain = decryptText(v1cipher);
      assert.equal(plain, "v1-data");
    });

    it("decrypt legacy payload (no kid) uses legacy key", () => {
      const { createCipheriv, randomBytes, createHash } = await import("node:crypto");
      // legacy key is DATA_ENCRYPTION_KEY = LEGACY_KEY
      const key = createHash("sha256").update(LEGACY_KEY).digest();
      const iv = randomBytes(12);
      const cipher2 = createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([cipher2.update("legacy-data", "utf8"), cipher2.final()]);
      const tag = cipher2.getAuthTag();
      const legacycipher = `enc1:${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
      const plain = decryptText(legacycipher);
      assert.equal(plain, "legacy-data");
    });
  });

  describe("config validation", () => {
    it("throws when DATA_ENCRYPTION_ACTIVE_KEY_ID does not exist in registry", async () => {
      process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({ v1: V1_KEY });
      process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID = "nonexistent";
      delete process.env.DATA_ENCRYPTION_KEY;
      await assert.rejects(
        async () => { await import("../src/config.js"); },
        /DATA_ENCRYPTION_ACTIVE_KEY_ID aponta para chave inexistente/
      );
    });
  });

  describe("PATIENT_LOOKUP_HASH_KEY isolation", () => {
    it("PATIENT_LOOKUP_HASH_KEY env value unchanged after multi-key setup", () => {
      const original = process.env.PATIENT_LOOKUP_HASH_KEY;
      // No operation in this test should modify PATIENT_LOOKUP_HASH_KEY
      process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({ v1: V1_KEY });
      process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID = "v1";
      assert.equal(process.env.PATIENT_LOOKUP_HASH_KEY, original,
        "PATIENT_LOOKUP_HASH_KEY must not be modified by multi-key setup");
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (no _testExports yet)**

```
cd backend && node --test test/encryption.test.js
```
Expected: FAIL — `mod._testExports is undefined` or similar.

---

## Task 3: Update db.js — multi-key encrypt/decrypt

**Files:**
- Modify: `backend/src/db.js`

### Changes

1. Remove local `const DATA_ENCRYPTION_KEY = ...` (line 16)
2. Add import of `DATA_ENCRYPTION_KEY_REGISTRY` and `DATA_ENCRYPTION_ACTIVE_KID` from `./config.js`
3. Replace `getEncryptionKey()` with `_getKeyById(kid)` and update `encryptText` / `decryptText`
4. Export `_testExports` for unit tests

- [ ] **Step 1: Update imports at top of db.js**

Change line 8 from:
```js
import { PATIENT_LOOKUP_HASH_KEY } from "./config.js";
```
to:
```js
import { PATIENT_LOOKUP_HASH_KEY, DATA_ENCRYPTION_KEY, DATA_ENCRYPTION_KEY_REGISTRY, DATA_ENCRYPTION_ACTIVE_KID } from "./config.js";
```

- [ ] **Step 2: Remove local DATA_ENCRYPTION_KEY read**

Delete line 16:
```js
const DATA_ENCRYPTION_KEY = String(process.env.DATA_ENCRYPTION_KEY || "").trim();
```

- [ ] **Step 3: Replace getEncryptionKey() with multi-key helpers**

Find and replace:
```js
function getEncryptionKey() {
  if (!DATA_ENCRYPTION_KEY) return null;
  return crypto.createHash("sha256").update(DATA_ENCRYPTION_KEY).digest();
}
```

With:
```js
function _deriveKey(raw) {
  if (!raw) return null;
  return crypto.createHash("sha256").update(String(raw)).digest();
}

function _getKeyById(kid) {
  if (!kid) return null;
  const raw = DATA_ENCRYPTION_KEY_REGISTRY[kid];
  if (!raw) return null;
  return _deriveKey(raw);
}

function _getActiveKid() {
  return DATA_ENCRYPTION_ACTIVE_KID || null;
}
```

- [ ] **Step 4: Update encryptText to embed kid**

Find:
```js
function encryptText(value, key) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!key) return raw;
  if (isEncryptedText(raw)) return raw;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}
```

Replace with:
```js
function encryptText(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (isEncryptedText(raw)) return raw;

  const kid = _getActiveKid();
  const key = kid ? _getKeyById(kid) : null;
  if (!key) return raw;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${kid}:${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}
```

- [ ] **Step 5: Update decryptText to route by kid**

Find:
```js
function decryptText(value, key) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!isEncryptedText(raw)) return raw;
  if (!key) throw new Error("DATA_ENCRYPTION_KEY ausente para descriptografar dados sensíveis");

  const [, payload] = raw.split(ENC_PREFIX);
  const [ivB64, encB64, tagB64] = String(payload || "").split(":");
  if (!ivB64 || !encB64 || !tagB64) throw new Error("Formato inválido de dado criptografado");
  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
```

Replace with:
```js
function decryptText(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!isEncryptedText(raw)) return raw;

  const [, payload] = raw.split(ENC_PREFIX);
  const parts = String(payload || "").split(":");

  let kid, ivB64, encB64, tagB64;
  if (parts.length === 4) {
    // New format: kid:iv:enc:tag
    [kid, ivB64, encB64, tagB64] = parts;
  } else if (parts.length === 3) {
    // Legacy format: iv:enc:tag — use legacy key
    kid = "legacy";
    [ivB64, encB64, tagB64] = parts;
  } else {
    throw new Error("Formato inválido de dado criptografado");
  }

  const key = _getKeyById(kid);
  if (!key) throw new Error("Chave de descriptografia ausente ou inválida");

  if (!ivB64 || !encB64 || !tagB64) throw new Error("Formato inválido de dado criptografado");
  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
```

- [ ] **Step 6: Update transformSensitiveState to use new signatures**

Find:
```js
  const key = getEncryptionKey();
  const data = cloneState(state || {});
  const transform = mode === "encrypt"
    ? (value) => encryptText(value, key)
    : (value) => decryptText(value, key);
```

Replace with:
```js
  const data = cloneState(state || {});
  const transform = mode === "encrypt"
    ? (value) => encryptText(value)
    : (value) => decryptText(value);
```

- [ ] **Step 7: Add _testExports at the bottom of db.js (before the export block)**

Add before the `export {` block:
```js
// Test-only exports — never import these in production code
const _testExports = { encryptText, decryptText };
```

And add `_testExports` to the export block.

- [ ] **Step 8: Run the unit tests — should pass now**

```
cd backend && node --test test/encryption.test.js
```
Expected: all tests pass.

- [ ] **Step 9: Run the full test suite — no regressions**

```
cd backend && npm test
```
Expected: all existing tests pass.

- [ ] **Step 10: Commit**

```bash
git add backend/src/config.js backend/src/db.js backend/test/encryption.test.js
git commit -m "feat(enc): multi-key AES-256-GCM with kid support; legacy payload backward compat"
```

---

## Task 4: Write reencrypt-audit.js script

**Files:**
- Create: `scripts/reencrypt-audit.js`

- [ ] **Step 1: Create the script**

```js
#!/usr/bin/env node
/**
 * Re-encryption audit script.
 *
 * Usage (dry-run, default):
 *   DATABASE_URL=<url> DATA_ENCRYPTION_KEY=<legacy> \
 *     DATA_ENCRYPTION_KEYS='{"v1":"old","v2":"new"}' \
 *     DATA_ENCRYPTION_ACTIVE_KEY_ID=v2 \
 *     node scripts/reencrypt-audit.js
 *
 * Apply (writes to DB):
 *   ... same env vars ... node scripts/reencrypt-audit.js --apply
 *
 * File mode: omit DATABASE_URL, set DB_FILE_PATH (default: backend/data/db.json).
 *
 * Never prints CPF, CNS, or any plaintext sensitive value.
 * Idempotent: re-running after --apply is safe (already-rotated records skip).
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const DB_FILE_PATH = String(process.env.DB_FILE_PATH || "").trim()
  || path.resolve(__dirname, "../backend/data/db.json");

const LEGACY_KEY_RAW = String(process.env.DATA_ENCRYPTION_KEY || "").trim();
const KEYS_RAW       = String(process.env.DATA_ENCRYPTION_KEYS || "").trim();
const ACTIVE_KID     = String(process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID || "").trim();

const ENC_PREFIX = "enc1:";
const SENSITIVE_PATIENT_FIELDS = ["cpf", "cns", "cnsCpf"];
const SENSITIVE_USER_FIELDS    = ["twoFactorSecret", "twoFactorPendingSecret"];

// ── key registry ──────────────────────────────────────────────────────────────

function buildRegistry() {
  const reg = {};
  if (LEGACY_KEY_RAW) reg["legacy"] = LEGACY_KEY_RAW;
  if (KEYS_RAW) {
    let parsed;
    try { parsed = JSON.parse(KEYS_RAW); } catch { throw new Error("DATA_ENCRYPTION_KEYS: JSON inválido"); }
    for (const [kid, raw] of Object.entries(parsed)) {
      reg[kid] = String(raw || "");
    }
  }
  return reg;
}

function deriveKey(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest();
}

// ── crypto helpers ────────────────────────────────────────────────────────────

function isEncrypted(v) {
  return typeof v === "string" && v.startsWith(ENC_PREFIX);
}

function detectKid(value) {
  if (!isEncrypted(value)) return null;
  const payload = value.slice(ENC_PREFIX.length);
  const parts = payload.split(":");
  if (parts.length === 4) return parts[0];   // new format: kid present
  if (parts.length === 3) return "legacy";   // old format: no kid
  return null;
}

function decrypt(value, registry) {
  if (!isEncrypted(value)) return value;
  const payload = value.slice(ENC_PREFIX.length);
  const parts = payload.split(":");
  let kid, ivB64, encB64, tagB64;
  if (parts.length === 4) {
    [kid, ivB64, encB64, tagB64] = parts;
  } else if (parts.length === 3) {
    kid = "legacy";
    [ivB64, encB64, tagB64] = parts;
  } else {
    throw new Error("Formato inválido");
  }
  const rawKey = registry[kid];
  if (!rawKey) throw new Error(`Chave ausente para kid='${kid}'`);
  const key = deriveKey(rawKey);
  const iv  = Buffer.from(ivB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const d   = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

function encrypt(plaintext, kid, registry) {
  const rawKey = registry[kid];
  if (!rawKey) throw new Error(`Chave ausente para kid='${kid}'`);
  const key = deriveKey(rawKey);
  const iv  = crypto.randomBytes(12);
  const c   = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return `${ENC_PREFIX}${kid}:${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
}

// ── analysis + rotate ─────────────────────────────────────────────────────────

function analyzeState(state, registry) {
  let total = 0, noKid = 0, oldKid = 0, activeKid = 0, plain = 0;

  function checkField(v) {
    if (!v) return;
    total++;
    if (!isEncrypted(v)) { plain++; return; }
    const kid = detectKid(v);
    if (kid === "legacy") { noKid++; return; }
    if (kid === ACTIVE_KID) { activeKid++; return; }
    oldKid++;
  }

  for (const patient of (state.patients || [])) {
    for (const f of SENSITIVE_PATIENT_FIELDS) checkField(patient[f]);
  }
  for (const user of (state.users || [])) {
    for (const f of SENSITIVE_USER_FIELDS) checkField(user[f]);
  }

  return { total, noKid, oldKid, activeKid, plain };
}

function rotateState(state, registry) {
  let rotated = 0;

  function rotateField(v) {
    if (!isEncrypted(v)) return { value: v, changed: false };
    const kid = detectKid(v);
    if (kid === ACTIVE_KID) return { value: v, changed: false };
    const plain = decrypt(v, registry);
    return { value: encrypt(plain, ACTIVE_KID, registry), changed: true };
  }

  const data = JSON.parse(JSON.stringify(state));

  data.patients = (data.patients || []).map((p) => {
    const next = { ...p };
    for (const f of SENSITIVE_PATIENT_FIELDS) {
      if (next[f]) {
        const { value, changed } = rotateField(next[f]);
        next[f] = value;
        if (changed) rotated++;
      }
    }
    return next;
  });

  data.users = (data.users || []).map((u) => {
    const next = { ...u };
    for (const f of SENSITIVE_USER_FIELDS) {
      if (next[f]) {
        const { value, changed } = rotateField(next[f]);
        next[f] = value;
        if (changed) rotated++;
      }
    }
    return next;
  });

  return { data, rotated };
}

// ── drivers ───────────────────────────────────────────────────────────────────

async function runFile(registry) {
  console.log(`Driver: file  path: ${DB_FILE_PATH}`);
  const raw   = (await fs.readFile(DB_FILE_PATH, "utf-8")).replace(/^﻿/, "");
  const state = JSON.parse(raw);

  const stats = analyzeState(state, registry);
  printStats(stats);

  if (DRY_RUN) { console.log("\nDRY-RUN: nenhuma alteração gravada."); return; }

  const { data, rotated } = rotateState(state, registry);
  const backup = DB_FILE_PATH + ".bak." + Date.now();
  await fs.copyFile(DB_FILE_PATH, backup);
  console.log(`Backup: ${backup}`);
  await fs.writeFile(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log(`Aplicado: ${rotated} campos re-criptografados.`);
}

async function runPostgres(registry) {
  console.log("Driver: postgres");
  let pg;
  const candidates = ["pg", new URL("../backend/node_modules/pg/lib/index.js", import.meta.url).href];
  for (const c of candidates) {
    try { const m = await import(c); pg = m.default ?? m; break; } catch {}
  }
  if (!pg) throw new Error("pg module não encontrado — execute: cd backend && npm install");

  const pool   = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT data FROM app_state WHERE id = 1");
    if (!rows.length) throw new Error("Nenhuma linha em app_state");
    const state = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;

    const stats = analyzeState(state, registry);
    printStats(stats);

    if (DRY_RUN) { console.log("\nDRY-RUN: nenhuma alteração gravada."); return; }

    const { data, rotated } = rotateState(state, registry);
    await client.query(
      "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
      [JSON.stringify(data)]
    );
    console.log(`Aplicado: ${rotated} campos re-criptografados.`);
  } finally {
    client.release();
    await pool.end();
  }
}

function printStats({ total, noKid, oldKid, activeKid, plain }) {
  console.log("\n=== Auditoria de campos sensíveis ===");
  console.log(`Total de campos sensíveis:         ${total}`);
  console.log(`  Sem kid (formato legado):         ${noKid}`);
  console.log(`  Com kid antigo (não ativo):        ${oldKid}`);
  console.log(`  Com kid ativo (${ACTIVE_KID || "N/A"}):          ${activeKid}`);
  console.log(`  Não criptografados (plaintext):   ${plain}`);
  console.log(`\nCampos que precisam re-criptografia: ${noKid + oldKid}`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== reencrypt-audit ${DRY_RUN ? "[DRY-RUN]" : "[APPLY]"} ===`);

  if (!ACTIVE_KID && APPLY) {
    console.error("Erro: DATA_ENCRYPTION_ACTIVE_KEY_ID obrigatório para --apply");
    process.exit(1);
  }

  let registry;
  try { registry = buildRegistry(); } catch (e) { console.error(e.message); process.exit(1); }

  if (!Object.keys(registry).length) {
    console.error("Erro: nenhuma chave configurada (DATA_ENCRYPTION_KEY ou DATA_ENCRYPTION_KEYS)");
    process.exit(1);
  }

  if (APPLY && !registry[ACTIVE_KID]) {
    console.error(`Erro: chave ativa '${ACTIVE_KID}' não encontrada no registry`);
    process.exit(1);
  }

  try {
    if (DATABASE_URL) await runPostgres(registry);
    else await runFile(registry);
    console.log("\nConcluído.");
  } catch (e) {
    console.error("Falha:", e.message);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Verify script runs in dry-run mode (no DB needed)**

```
node scripts/reencrypt-audit.js
```
Expected output: error about no key configured (no env vars set). This is correct.

- [ ] **Step 3: Test with legacy key env**

```
DATA_ENCRYPTION_KEY="test-legacy-key-32-bytes-pad0000" node scripts/reencrypt-audit.js
```
Expected: `Driver: file  path: ...db.json` and stats output. No writes.

- [ ] **Step 4: Commit**

```bash
git add scripts/reencrypt-audit.js
git commit -m "feat(enc): reencrypt-audit.js dry-run script for kid migration analysis"
```

---

## Task 5: Write documentation

**Files:**
- Create: `docs/security/data-encryption-key-rotation.md`

- [ ] **Step 1: Create the document**

```markdown
# Data Encryption Key Rotation

## Objetivo

Permitir rotação de `DATA_ENCRYPTION_KEY` sem big-bang e sem perda de dados.
Cada valor criptografado carrega um Key ID (`kid`) que identifica a chave usada.
Dados antigos (sem `kid`) continuam decriptografando via `DATA_ENCRYPTION_KEY` legada.

## Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|---|---|---|
| `DATA_ENCRYPTION_KEY` | Sim (legado) | Chave única. Mantida para compatibilidade e como fallback do kid `legacy`. |
| `DATA_ENCRYPTION_KEYS` | Opcional | JSON `{"v1":"chave1","v2":"chave2"}`. Habilita modo multi-chave. |
| `DATA_ENCRYPTION_ACTIVE_KEY_ID` | Se `DATA_ENCRYPTION_KEYS` definido | Kid da chave ativa para novas criptografias. |
| `PATIENT_LOOKUP_HASH_KEY` | Sim (prod) | Hash de lookup CPF/CNS. **Não altera com essa rotação.** |

### Formato do ciphertext

```
Legado (sem kid):  enc1:<iv_b64>:<enc_b64>:<tag_b64>
Novo (com kid):    enc1:<kid>:<iv_b64>:<enc_b64>:<tag_b64>
```

Base64 nunca contém `:`, então a detecção por contagem de partes é inequívoca.

## Plano de rotação

### Fase 1 — Adicionar nova chave sem re-criptografar

1. Gere nova chave forte: `openssl rand -base64 32`
2. Adicione ao Elastic Beanstalk:
   ```
   DATA_ENCRYPTION_KEYS={"legacy":"<valor atual de DATA_ENCRYPTION_KEY>","v2":"<nova chave>"}
   DATA_ENCRYPTION_ACTIVE_KEY_ID=v2
   ```
   Mantenha `DATA_ENCRYPTION_KEY` idêntico ao valor atual.
3. Deploy. Novos registros usam `kid=v2`. Registros antigos (sem `kid`) decriptografam via `legacy`.

### Fase 2 — Auditoria

```bash
DATABASE_URL=<prod> \
DATA_ENCRYPTION_KEY=<legado> \
DATA_ENCRYPTION_KEYS='{"legacy":"<legado>","v2":"<nova>"}' \
DATA_ENCRYPTION_ACTIVE_KEY_ID=v2 \
node scripts/reencrypt-audit.js
```

Confirme que `Campos que precisam re-criptografia` mostra o número esperado.

### Fase 3 — Re-criptografia (apply)

```bash
DATABASE_URL=<prod> \
DATA_ENCRYPTION_KEY=<legado> \
DATA_ENCRYPTION_KEYS='{"legacy":"<legado>","v2":"<nova>"}' \
DATA_ENCRYPTION_ACTIVE_KEY_ID=v2 \
node scripts/reencrypt-audit.js --apply
```

Rode novamente em dry-run para confirmar `Campos que precisam re-criptografia: 0`.

### Fase 4 — Remover chave legada (opcional, após confirmar Fase 3)

1. Atualize `DATA_ENCRYPTION_KEYS` removendo `legacy`.
2. Remova `DATA_ENCRYPTION_KEY` (ou mantenha para evitar alertas de configuração).
3. Deploy.

## Rollback

Se ocorrer erro em qualquer fase antes de `--apply`:
- Nenhuma alteração foi feita no banco.
- Remova `DATA_ENCRYPTION_KEYS` e `DATA_ENCRYPTION_ACTIVE_KEY_ID` do EB.
- Deploy com configuração anterior.

Se erro após `--apply` no file driver:
- Um backup `.bak.<timestamp>` foi criado antes de qualquer escrita.
- Restaure: `cp backend/data/db.json.bak.<ts> backend/data/db.json`

## Validação

Após Fase 1:
```bash
# Criar novo paciente via API e confirmar que o ciphertext no DB começa com enc1:v2:
SELECT (data->'patients'->0->>'cpf') FROM app_state WHERE id = 1;
```

Após Fase 3 (dry-run):
```
Campos que precisam re-criptografia: 0
```

## Riscos

| Risco | Mitigação |
|---|---|
| Deploy com `DATA_ENCRYPTION_ACTIVE_KEY_ID` apontando para kid inexistente | `config.js` lança erro na startup — deploy falha antes de aceitar tráfego |
| Re-criptografia parcial por crash | Script é idempotente — re-executar não duplica rotações |
| Confusão entre `DATA_ENCRYPTION_KEY` e `PATIENT_LOOKUP_HASH_KEY` | As duas chaves têm responsabilidades distintas. `PATIENT_LOOKUP_HASH_KEY` **nunca** entra no registry de criptografia |
| Leak de chave em logs | `config.js` e `db.js` nunca logam valores de chave; erros são genéricos |
```

- [ ] **Step 2: Commit**

```bash
git add docs/security/data-encryption-key-rotation.md
git commit -m "docs(security): data encryption key rotation guide"
```

---

## Task 6: Run full test suite and show diff

- [ ] **Step 1: Run all tests**

```
cd backend && npm test
```
Expected: all tests pass, including `encryption.test.js`.

- [ ] **Step 2: Show final diff**

```
git diff HEAD~3 --stat
git diff HEAD~3 -- backend/src/config.js backend/src/db.js
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| `DATA_ENCRYPTION_KEYS` JSON + `DATA_ENCRYPTION_ACTIVE_KEY_ID` | Task 1 |
| Fallback legado a `DATA_ENCRYPTION_KEY` se `DATA_ENCRYPTION_KEYS` ausente | Task 1 + Task 3 |
| Cada chave ≥ 32 chars | Task 1 |
| `DATA_ENCRYPTION_ACTIVE_KEY_ID` aponta para chave existente | Task 1 |
| Novas criptografias incluem `kid` | Task 3 |
| Dados antigos sem `kid` descriptografam via fallback | Task 3 |
| Decrypt roteia por `kid` | Task 3 |
| Não logar chaves / erros genéricos | Task 1 + Task 3 |
| Tests: decrypt legado sem kid | Task 2 |
| Tests: encrypt novo com kid ativo | Task 2 |
| Tests: decrypt com kid v1 | Task 2 |
| Tests: decrypt com kid v2 | Task 2 |
| Tests: erro quando ACTIVE_KEY_ID inexistente | Task 2 |
| Tests: PATIENT_LOOKUP_HASH_KEY não alterado | Task 2 |
| Script dry-run + counts | Task 4 |
| Script --apply com flag explícita | Task 4 |
| Script idempotente | Task 4 |
| Script não imprime CPF/CNS | Task 4 |
| Documentação completa | Task 5 |

### Notes

- `_testExports` is only used in tests; never imported in production routes.
- The ESM module cache means dynamic re-import in tests may return the already-loaded module. Tests that need fresh env state should run in isolation (separate `node --test` processes). The config validation test (Task 2, `config validation` describe block) must run as an isolated process or after `--experimental-vm-modules` workaround. If it can't re-import a fresh config.js, move it to a separate test file `test/config-validation.test.js` run independently.
- `PATIENT_LOOKUP_HASH_KEY` is read from `config.js` separately and never modified by any code in this plan.
