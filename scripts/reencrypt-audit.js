#!/usr/bin/env node
/**
 * Re-encryption audit/migration script.
 *
 * Usage (dry-run, DEFAULT — reads only, writes nothing):
 *   DATABASE_URL=<url> \
 *     DATA_ENCRYPTION_KEY=<legacy-key> \
 *     DATA_ENCRYPTION_KEYS='{"legacy":"<old>","v2":"<new>"}' \
 *     DATA_ENCRYPTION_ACTIVE_KEY_ID=v2 \
 *     node scripts/reencrypt-audit.js
 *
 * Apply mode (WRITES to DB — explicit flag required):
 *   ... same env vars ... node scripts/reencrypt-audit.js --apply
 *
 * File driver: omit DATABASE_URL; set DB_FILE_PATH (default: backend/data/db.json).
 *
 * Safety guarantees:
 *   - Default is dry-run — never writes without --apply.
 *   - File driver creates a .bak.<timestamp> backup before writing.
 *   - Never prints CPF, CNS, or any plaintext sensitive value.
 *   - Idempotent: records already using active kid are skipped.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APPLY   = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

const DATABASE_URL  = String(process.env.DATABASE_URL || "").trim();
const DB_FILE_PATH  = String(process.env.DB_FILE_PATH || "").trim()
  || path.resolve(__dirname, "../backend/data/db.json");

const LEGACY_KEY_RAW = String(process.env.DATA_ENCRYPTION_KEY || "").trim();
const KEYS_RAW       = String(process.env.DATA_ENCRYPTION_KEYS || "").trim();
const ACTIVE_KID     = String(process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID || "").trim();

const ENC_PREFIX             = "enc1:";
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
  const parts = value.slice(ENC_PREFIX.length).split(":");
  if (parts.length === 4) return parts[0];
  if (parts.length === 3) return "legacy";
  return null;
}

function decrypt(value, registry) {
  if (!isEncrypted(value)) return value;
  const parts = value.slice(ENC_PREFIX.length).split(":");
  let kid, ivB64, encB64, tagB64;
  if (parts.length === 4) {
    [kid, ivB64, encB64, tagB64] = parts;
  } else if (parts.length === 3) {
    kid = "legacy";
    [ivB64, encB64, tagB64] = parts;
  } else {
    throw new Error("Formato inválido de ciphertext");
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

// ── analysis ──────────────────────────────────────────────────────────────────

function analyzeState(state) {
  let total = 0, noKid = 0, oldKid = 0, activeKidCount = 0, plain = 0;

  function check(v) {
    if (!v) return;
    total++;
    if (!isEncrypted(v)) { plain++; return; }
    const kid = detectKid(v);
    if (kid === "legacy") { noKid++; return; }
    if (kid === ACTIVE_KID) { activeKidCount++; return; }
    oldKid++;
  }

  for (const p of (state.patients || [])) {
    for (const f of SENSITIVE_PATIENT_FIELDS) check(p[f]);
  }
  for (const u of (state.users || [])) {
    for (const f of SENSITIVE_USER_FIELDS) check(u[f]);
  }

  return { total, noKid, oldKid, activeKid: activeKidCount, plain };
}

// ── rotate ────────────────────────────────────────────────────────────────────

function rotateState(state, registry) {
  let rotated = 0;

  function rotateField(v) {
    if (!isEncrypted(v)) return { value: v, changed: false };
    if (detectKid(v) === ACTIVE_KID) return { value: v, changed: false };
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

// ── output ────────────────────────────────────────────────────────────────────

function printStats({ total, noKid, oldKid, activeKid, plain }) {
  const needsRotation = noKid + oldKid;
  console.log("\n=== Auditoria de campos sensíveis ===");
  console.log(`Total de campos sensíveis:            ${total}`);
  console.log(`  Sem kid (formato legado):            ${noKid}`);
  console.log(`  Com kid antigo (≠ ativo):            ${oldKid}`);
  console.log(`  Com kid ativo (${ACTIVE_KID || "N/A"}):              ${activeKid}`);
  console.log(`  Sem criptografia (plaintext):        ${plain}`);
  console.log(`\nCampos que precisam re-criptografia: ${needsRotation}`);
}

// ── drivers ───────────────────────────────────────────────────────────────────

async function runFile(registry) {
  console.log(`Driver: file`);
  console.log(`Caminho: ${DB_FILE_PATH}`);
  const raw   = (await fs.readFile(DB_FILE_PATH, "utf-8")).replace(/^﻿/, "");
  const state = JSON.parse(raw);

  printStats(analyzeState(state));

  if (DRY_RUN) { console.log("\nDRY-RUN: nenhuma alteração gravada."); return; }

  const { data, rotated } = rotateState(state, registry);
  const backup = `${DB_FILE_PATH}.bak.${Date.now()}`;
  await fs.copyFile(DB_FILE_PATH, backup);
  console.log(`\nBackup criado: ${backup}`);
  await fs.writeFile(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log(`Aplicado: ${rotated} campo(s) re-criptografado(s).`);
}

async function runPostgres(registry) {
  console.log("Driver: postgres");
  let pg;
  const candidates = [
    "pg",
    new URL("../backend/node_modules/pg/lib/index.js", import.meta.url).href
  ];
  for (const c of candidates) {
    try { const m = await import(c); pg = m.default ?? m; break; } catch {}
  }
  if (!pg) throw new Error("pg module não encontrado — execute: cd backend && npm install");

  const pool   = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT data FROM app_state WHERE id = 1");
    if (!rows.length) throw new Error("Nenhuma linha encontrada em app_state");
    const state = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;

    printStats(analyzeState(state));

    if (DRY_RUN) { console.log("\nDRY-RUN: nenhuma alteração gravada."); return; }

    const { data, rotated } = rotateState(state, registry);
    await client.query(
      "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
      [JSON.stringify(data)]
    );
    console.log(`\nAplicado: ${rotated} campo(s) re-criptografado(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== reencrypt-audit ${DRY_RUN ? "[DRY-RUN]" : "[APPLY]"} ===`);

  if (APPLY && !ACTIVE_KID) {
    console.error("Erro: DATA_ENCRYPTION_ACTIVE_KEY_ID obrigatório para --apply");
    process.exit(1);
  }

  let registry;
  try { registry = buildRegistry(); } catch (e) { console.error(e.message); process.exit(1); }

  if (!Object.keys(registry).length) {
    console.error("Erro: nenhuma chave configurada — defina DATA_ENCRYPTION_KEY ou DATA_ENCRYPTION_KEYS");
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
