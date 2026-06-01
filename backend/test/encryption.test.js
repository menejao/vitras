/**
 * Unit tests for multi-key AES-256-GCM encrypt/decrypt.
 *
 * Runs as its own node process (separate node --test invocation).
 * Env vars are set at module-level before any dynamic imports of app code,
 * so config.js sees the correct registry on first load.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const LEGACY_KEY = "test-legacy-key-32-bytes-pad0000";
const V1_KEY     = "test-v1-key-32-bytes-padding0000";
const V2_KEY     = "test-v2-key-32-bytes-padding0000";

// Set env BEFORE dynamic import of db.js so config.js builds the correct registry.
// Multi-key mode: registry includes legacy, v1, v2; active kid = v2.
// This single env setup covers all test scenarios.
process.env.NODE_ENV = "test";
process.env.DATA_ENCRYPTION_KEY = LEGACY_KEY;
process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({ legacy: LEGACY_KEY, v1: V1_KEY, v2: V2_KEY });
process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID = "v2";
// Preserve PATIENT_LOOKUP_HASH_KEY (may not be set in this isolated process)
const _original_plhk = process.env.PATIENT_LOOKUP_HASH_KEY;

const ENC_PREFIX = "enc1:";

function rawEncrypt(plaintext, keyRaw, kid) {
  const key = crypto.createHash("sha256").update(keyRaw).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const body = `${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
  return kid ? `${ENC_PREFIX}${kid}:${body}` : `${ENC_PREFIX}${body}`;
}

describe("encryption multi-key", () => {
  let encryptText, decryptText;

  before(async () => {
    // Dynamic import happens AFTER module-level env vars are set.
    // encryption.test.js runs in its own process, so db.js is not yet cached.
    const mod = await import("../src/db.js");
    encryptText = mod._testExports.encryptText;
    decryptText = mod._testExports.decryptText;
  });

  describe("new-format encrypt", () => {
    it("produces enc1: prefix", () => {
      const cipher = encryptText("hello");
      assert.ok(cipher.startsWith(ENC_PREFIX), `expected enc1: prefix, got: ${cipher.slice(0, 30)}`);
    });

    it("embeds active kid=v2 in payload", () => {
      const cipher = encryptText("hello");
      const parts = cipher.slice(ENC_PREFIX.length).split(":");
      assert.equal(parts.length, 4, "new format: kid:iv:enc:tag — expect 4 parts");
      assert.equal(parts[0], "v2");
    });

    it("returns plaintext when value is empty", () => {
      assert.equal(encryptText(""), "");
    });

    it("does not double-encrypt already-encrypted value", () => {
      const first = encryptText("hello");
      const second = encryptText(first);
      assert.equal(second, first);
    });
  });

  describe("decrypt new-format payload (kid present)", () => {
    it("roundtrip: encrypt then decrypt returns original", () => {
      const plain = "test-roundtrip-value";
      assert.equal(decryptText(encryptText(plain)), plain);
    });

    it("decrypt with active kid=v2", () => {
      const cipher = encryptText("v2-value");
      assert.equal(decryptText(cipher), "v2-value");
    });

    it("decrypt with kid=v1 (cross-key)", () => {
      const v1cipher = rawEncrypt("v1-data", V1_KEY, "v1");
      assert.equal(decryptText(v1cipher), "v1-data");
    });
  });

  describe("decrypt legacy-format payload (no kid, 3 parts)", () => {
    it("decrypts 3-part legacy ciphertext using registry[legacy]", () => {
      const legacyCipher = rawEncrypt("old-value", LEGACY_KEY, null);
      const parts = legacyCipher.slice(ENC_PREFIX.length).split(":");
      assert.equal(parts.length, 3, "should be 3-part legacy format");
      assert.equal(decryptText(legacyCipher), "old-value");
    });

    it("passthrough: non-encrypted value returned as-is", () => {
      assert.equal(decryptText("not-encrypted"), "not-encrypted");
    });

    it("passthrough: empty string returns empty string", () => {
      assert.equal(decryptText(""), "");
    });
  });

  describe("PATIENT_LOOKUP_HASH_KEY isolation", () => {
    it("PATIENT_LOOKUP_HASH_KEY env is not modified by multi-key setup", () => {
      assert.equal(
        process.env.PATIENT_LOOKUP_HASH_KEY,
        _original_plhk,
        "PATIENT_LOOKUP_HASH_KEY must not be changed by encryption key registry setup"
      );
    });
  });
});
