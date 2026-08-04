/**
 * p0-env-validation.test.mjs — P0-4: Fail-fast startup config validation
 *
 * Verifica que config.js lança erros imediatos quando variáveis obrigatórias
 * de produção estão ausentes ou inválidas.
 *
 * Critérios de aceite:
 * - [P0-4-A] JWT_SECRET ausente em produção → throw
 * - [P0-4-B] DATA_ENCRYPTION_KEY ausente em produção → throw
 * - [P0-4-C] DATA_ENCRYPTION_KEY < 32 chars em produção → throw
 * - [P0-4-D] PATIENT_LOOKUP_HASH_KEY ausente em produção → throw
 * - [P0-4-E] PATIENT_LOOKUP_HASH_KEY < 32 chars em produção → throw
 * - [P0-4-F] MUNICIPALITY_ID ausente em produção → throw
 * - [P0-4-G] BACKUP_EXPORT_KEY ausente em produção → throw
 * - [P0-4-H] Em modo não-produção (NODE_ENV=test), sem chaves obrigatórias → não throw
 * - [P0-4-I] FRONTEND_ORIGINS ausente em produção sem CORS_ALLOW_ALL → throw
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "../src/config.js");

/**
 * Run config.js in a child process with specified env vars.
 * Returns { code, stdout, stderr }.
 */
function runConfig(env = {}) {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", `import "${configPath}"; console.log("OK");`],
    {
      env: {
        PATH: process.env.PATH,
        ...env
      },
      timeout: 10000,
      encoding: "utf8"
    }
  );
  return {
    code: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

// ── Baseline: production env with all required vars ──────────────────────────
const PROD_BASE_ENV = {
  NODE_ENV: "production",
  JWT_SECRET: "prod-jwt-secret-at-least-32-characters-long-padding",
  DATA_ENCRYPTION_KEY: "prod-data-enc-key-exactly-32-bytes-pad",
  PATIENT_LOOKUP_HASH_KEY: "prod-plhk-at-least-32-chars-padding00",
  MUNICIPALITY_ID: "3550308",
  BACKUP_EXPORT_KEY: "prod-backup-export-key-for-test-validation",
  ADMIN_SEED_KEY: "prod-admin-seed-key-for-validation-test",
  FRONTEND_ORIGINS: "https://vitras.example.com",
  DATABASE_URL: "postgres://user:pass@localhost:5432/vitras"
};

describe("P0-4: Fail-fast startup config validation", () => {

  it("[P0-4-baseline] Produção com todas as vars → sem throw", () => {
    const { code, stderr } = runConfig(PROD_BASE_ENV);
    assert.equal(
      code, 0,
      `Config should load cleanly with all required vars. stderr: ${stderr}`
    );
  });

  it("[P0-4-A] JWT_SECRET ausente em produção → throw imediato", () => {
    const env = { ...PROD_BASE_ENV };
    delete env.JWT_SECRET;
    const { code, stderr } = runConfig(env);
    assert.notEqual(code, 0, "Should throw with missing JWT_SECRET");
    assert.ok(
      stderr.includes("JWT_SECRET") || stderr.includes("jwt"),
      `Error must mention JWT_SECRET. stderr: ${stderr}`
    );
  });

  it("[P0-4-B] DATA_ENCRYPTION_KEY ausente em produção → throw imediato", () => {
    const env = { ...PROD_BASE_ENV };
    delete env.DATA_ENCRYPTION_KEY;
    const { code, stderr } = runConfig(env);
    assert.notEqual(code, 0, "Should throw with missing DATA_ENCRYPTION_KEY");
    assert.ok(
      stderr.includes("DATA_ENCRYPTION_KEY") || stderr.includes("criptografia"),
      `Error must mention DATA_ENCRYPTION_KEY. stderr: ${stderr}`
    );
  });

  it("[P0-4-C] DATA_ENCRYPTION_KEY muito curto (<32 chars) → throw", () => {
    const env = { ...PROD_BASE_ENV, DATA_ENCRYPTION_KEY: "short" };
    const { code, stderr } = runConfig(env);
    assert.notEqual(code, 0, "Should throw with short DATA_ENCRYPTION_KEY");
    assert.ok(
      stderr.includes("DATA_ENCRYPTION_KEY") || stderr.includes("32"),
      `Error must mention key length requirement. stderr: ${stderr}`
    );
  });

  it("[P0-4-D] PATIENT_LOOKUP_HASH_KEY ausente em produção → throw imediato", () => {
    const env = { ...PROD_BASE_ENV };
    delete env.PATIENT_LOOKUP_HASH_KEY;
    const { code, stderr } = runConfig(env);
    assert.notEqual(code, 0, "Should throw with missing PATIENT_LOOKUP_HASH_KEY");
    assert.ok(
      stderr.includes("PATIENT_LOOKUP_HASH_KEY"),
      `Error must mention PATIENT_LOOKUP_HASH_KEY. stderr: ${stderr}`
    );
  });

  it("[P0-4-E] PATIENT_LOOKUP_HASH_KEY muito curto (<32 chars) → throw", () => {
    const env = { ...PROD_BASE_ENV, PATIENT_LOOKUP_HASH_KEY: "tooshort" };
    const { code, stderr } = runConfig(env);
    assert.notEqual(code, 0, "Should throw with short PATIENT_LOOKUP_HASH_KEY");
    assert.ok(
      stderr.includes("PATIENT_LOOKUP_HASH_KEY") || stderr.includes("32"),
      `Error must mention key length. stderr: ${stderr}`
    );
  });

  it("[P0-4-F] MUNICIPALITY_ID ausente em produção → throw imediato", () => {
    const env = { ...PROD_BASE_ENV };
    delete env.MUNICIPALITY_ID;
    const { code, stderr } = runConfig(env);
    assert.notEqual(code, 0, "Should throw with missing MUNICIPALITY_ID");
    assert.ok(
      stderr.includes("MUNICIPALITY_ID"),
      `Error must mention MUNICIPALITY_ID. stderr: ${stderr}`
    );
  });

  it("[P0-4-G] BACKUP_EXPORT_KEY ausente em produção → throw imediato", () => {
    const env = { ...PROD_BASE_ENV };
    delete env.BACKUP_EXPORT_KEY;
    const { code, stderr } = runConfig(env);
    assert.notEqual(code, 0, "Should throw with missing BACKUP_EXPORT_KEY");
    assert.ok(
      stderr.includes("BACKUP_EXPORT_KEY"),
      `Error must mention BACKUP_EXPORT_KEY. stderr: ${stderr}`
    );
  });

  it("[P0-4-H] Em NODE_ENV=test, chaves ausentes não causam throw", () => {
    const env = {
      NODE_ENV: "test",
      // No JWT_SECRET, no encryption keys — should be fine in test mode
    };
    const { code } = runConfig(env);
    assert.equal(code, 0, "Test mode should not throw for missing prod-only vars");
  });

  it("[P0-4-I] FRONTEND_ORIGINS ausente em produção sem CORS_ALLOW_ALL → throw", () => {
    const env = { ...PROD_BASE_ENV };
    delete env.FRONTEND_ORIGINS;
    const { code, stderr } = runConfig(env);
    assert.notEqual(code, 0, "Should throw with missing FRONTEND_ORIGINS in production");
    assert.ok(
      stderr.includes("FRONTEND_ORIGINS") || stderr.includes("CORS"),
      `Error must mention FRONTEND_ORIGINS. stderr: ${stderr}`
    );
  });

  it("[P0-4-I2] CORS_ALLOW_ALL=true permite ausência de FRONTEND_ORIGINS em produção", () => {
    const env = { ...PROD_BASE_ENV, CORS_ALLOW_ALL: "true" };
    delete env.FRONTEND_ORIGINS;
    const { code } = runConfig(env);
    assert.equal(code, 0, "CORS_ALLOW_ALL=true should allow missing FRONTEND_ORIGINS");
  });
});
