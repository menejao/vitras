#!/usr/bin/env node
/**
 * Cria o primeiro usuário break_glass_admin no Neon com vitrasId.
 * Uso: node scripts/bootstrap-first-admin.mjs
 */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL ausente"); process.exit(1); }

function stripSslParams(url) {
  try {
    const u = new URL(url);
    ["sslmode","sslcert","sslkey","sslrootcert","sslpassword","channel_binding"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return url; }
}

const { hashPassword, generateTempPassword } = await import("../src/services/crypto.js");

const client = new Client({ connectionString: stripSslParams(DATABASE_URL), ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  // Gerar vitrasId único
  const existingRes = await client.query("SELECT payload->>'vitrasId' AS vid FROM app_users WHERE payload->>'vitrasId' IS NOT NULL");
  const existingIds = new Set(existingRes.rows.map(r => r.vid).filter(Boolean));
  let vitrasId;
  for (let i = 0; i < 200; i++) {
    const c = String(100000000 + crypto.randomInt(0, 900000000));
    if (!existingIds.has(c)) { vitrasId = c; break; }
  }
  if (!vitrasId) { console.error("Não foi possível gerar vitrasId"); process.exit(1); }

  const tempPassword = generateTempPassword();
  const nowIso = new Date().toISOString();
  const userId = randomUUID();

  const payload = {
    id: userId,
    vitrasId,
    name: "Admin Vitras",
    email: "admin@vitras.local",
    role: "break_glass_admin",
    password: hashPassword(tempPassword),
    unitId: "",
    teamId: "",
    municipalityId: "",
    forcePasswordChange: true,
    passwordUpdatedAt: null,
    temporaryPasswordIssuedAt: nowIso,
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await client.query(
    `INSERT INTO app_users (id, payload, created_at, updated_at)
     VALUES ($1, $2::jsonb, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [userId, JSON.stringify(payload)]
  );

  // Sincronizar no app_state também
  const stateRes = await client.query("SELECT data FROM app_state WHERE id = 1");
  if (stateRes.rows.length) {
    const db = stateRes.rows[0].data;
    if (!Array.isArray(db.users)) db.users = [];
    if (!db.users.find(u => u.id === userId)) {
      db.users.push(payload);
      await client.query("UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1", [JSON.stringify(db)]);
    }
  }

  console.log("✓ Admin criado com sucesso!");
  console.log(`  vitrasId : ${vitrasId}`);
  console.log(`  Senha    : ${tempPassword}`);
  console.log(`  Role     : break_glass_admin`);
  console.log(`  ATENÇÃO  : troca de senha obrigatória no primeiro login`);
} finally {
  await client.end();
}
