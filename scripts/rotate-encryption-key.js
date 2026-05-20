#!/usr/bin/env node
/**
 * DATA_ENCRYPTION_KEY rotation script.
 *
 * Usage:
 *   OLD_DATA_ENCRYPTION_KEY=<old> NEW_DATA_ENCRYPTION_KEY=<new> \
 *     node scripts/rotate-encryption-key.js [--dry-run]
 *
 * Supports both drivers:
 *   - File: set DB_FILE_PATH (default: backend/data/db.json)
 *   - Postgres: set DATABASE_URL
 *
 * Dry-run: prints counts only, writes nothing.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OLD_KEY_RAW = String(process.env.OLD_DATA_ENCRYPTION_KEY || "").trim();
const NEW_KEY_RAW = String(process.env.NEW_DATA_ENCRYPTION_KEY || "").trim();
const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const DB_FILE_PATH = String(process.env.DB_FILE_PATH || "").trim()
  || path.resolve(__dirname, "../backend/data/db.json");

const DRY_RUN = process.argv.includes("--dry-run");
const ENC_PREFIX = "enc1:";
const SENSITIVE_PATIENT_FIELDS = ["cpf", "cns", "cnsCpf"];
const SENSITIVE_USER_FIELDS = ["twoFactorSecret", "twoFactorPendingSecret"];

function deriveKey(raw) {
  return crypto.createHash("sha256").update(raw).digest();
}

function isEncryptedText(value) {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

function decryptText(value, key) {
  const raw = String(value || "");
  if (!raw || !isEncryptedText(raw)) return raw;
  const [, payload] = raw.split(ENC_PREFIX);
  const [ivB64, encB64, tagB64] = String(payload || "").split(":");
  if (!ivB64 || !encB64 || !tagB64) throw new Error(`Invalid encrypted format: ${raw.slice(0, 30)}`);
  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function encryptText(value, key) {
  const raw = String(value || "");
  if (!raw) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

function reEncryptField(value, oldKey, newKey) {
  if (!isEncryptedText(String(value || ""))) return { value, rotated: false };
  const plain = decryptText(value, oldKey);
  return { value: encryptText(plain, newKey), rotated: true };
}

function rotateState(state, oldKey, newKey) {
  let patientFields = 0;
  let userFields = 0;

  const data = JSON.parse(JSON.stringify(state));

  if (Array.isArray(data.patients)) {
    data.patients = data.patients.map((patient) => {
      const next = { ...patient };
      for (const field of SENSITIVE_PATIENT_FIELDS) {
        if (next[field]) {
          const { value, rotated } = reEncryptField(next[field], oldKey, newKey);
          next[field] = value;
          if (rotated) patientFields++;
        }
      }
      return next;
    });
  }

  if (Array.isArray(data.users)) {
    data.users = data.users.map((user) => {
      const next = { ...user };
      for (const field of SENSITIVE_USER_FIELDS) {
        if (next[field]) {
          const { value, rotated } = reEncryptField(next[field], oldKey, newKey);
          next[field] = value;
          if (rotated) userFields++;
        }
      }
      return next;
    });
  }

  return { data, patientFields, userFields };
}

async function rotateFile(oldKey, newKey) {
  console.log(`Driver: file  path: ${DB_FILE_PATH}`);
  const raw = (await fs.readFile(DB_FILE_PATH, "utf-8")).replace(/^﻿/, "");
  const state = JSON.parse(raw);
  const { data, patientFields, userFields } = rotateState(state, oldKey, newKey);
  console.log(`Rotated: ${patientFields} patient fields, ${userFields} user fields`);
  if (DRY_RUN) {
    console.log("Dry-run: no changes written.");
    return;
  }
  const backup = DB_FILE_PATH + ".bak." + Date.now();
  await fs.copyFile(DB_FILE_PATH, backup);
  console.log(`Backup saved to: ${backup}`);
  await fs.writeFile(DB_FILE_PATH, JSON.stringify(data), "utf-8");
  console.log("File updated.");
}

async function rotatePostgres(oldKey, newKey) {
  console.log("Driver: postgres");
  let pg;
  const pgCandidates = [
    "pg",
    new URL("../backend/node_modules/pg/lib/index.js", import.meta.url).href
  ];
  for (const candidate of pgCandidates) {
    try {
      const mod = await import(candidate);
      pg = mod.default ?? mod;
      break;
    } catch {}
  }
  if (!pg) throw new Error("pg module not found — run: npm install pg  (or cd backend && npm install)");

  const { Pool } = pg;
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT data FROM app_state WHERE id = 1");
    if (rows.length === 0) throw new Error("No row found in app_state");

    const state = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
    const { data, patientFields, userFields } = rotateState(state, oldKey, newKey);
    console.log(`Rotated: ${patientFields} patient fields, ${userFields} user fields`);

    if (DRY_RUN) {
      console.log("Dry-run: no changes written.");
      return;
    }

    await client.query(
      "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
      [JSON.stringify(data)]
    );
    console.log("Postgres row updated.");
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  if (!OLD_KEY_RAW) {
    console.error("Error: OLD_DATA_ENCRYPTION_KEY env var required");
    process.exit(1);
  }
  if (!NEW_KEY_RAW) {
    console.error("Error: NEW_DATA_ENCRYPTION_KEY env var required");
    process.exit(1);
  }
  if (OLD_KEY_RAW === NEW_KEY_RAW) {
    console.error("Error: OLD and NEW keys are identical — nothing to rotate");
    process.exit(1);
  }

  const oldKey = deriveKey(OLD_KEY_RAW);
  const newKey = deriveKey(NEW_KEY_RAW);

  console.log("=== DATA_ENCRYPTION_KEY rotation" + (DRY_RUN ? " (DRY RUN)" : "") + " ===");

  try {
    if (DATABASE_URL) {
      await rotatePostgres(oldKey, newKey);
    } else {
      await rotateFile(oldKey, newKey);
    }
    console.log("Done.");
  } catch (err) {
    console.error("Rotation failed:", err.message);
    process.exit(1);
  }
}

main();
