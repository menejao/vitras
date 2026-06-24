/**
 * ACCESS-MIGRATION-01: gerar vitrasId (9 dígitos) para todos os usuários sem ele.
 *
 * File mode: atualiza backend/data/db.json diretamente.
 * Postgres mode: UPDATE app_users via payload JSONB.
 *
 * Uso:
 *   node scripts/migrate-vitras-ids.mjs
 *   DATABASE_URL=postgres://... node scripts/migrate-vitras-ids.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

function generateUniqueVitrasId(existingIds) {
  let attempts = 0;
  while (attempts < 200) {
    const id = String(100000000 + crypto.randomInt(0, 900000000));
    if (!existingIds.has(id)) return id;
    attempts++;
  }
  throw new Error("Impossível gerar vitrasId único após 200 tentativas");
}

// ─── Postgres mode ────────────────────────────────────────────────────────────

async function migratePostgres(databaseUrl) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("Postgres mode — conectado.");

  // Buscar todos os usuários
  const { rows } = await client.query("SELECT id, payload FROM app_users ORDER BY created_at ASC NULLS LAST");
  console.log(`Total de usuários: ${rows.length}`);

  // Coletar IDs existentes
  const existingIds = new Set(
    rows.map(r => String((r.payload || {}).vitrasId || "")).filter(Boolean)
  );

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const payload = row.payload || {};
    if (payload.vitrasId && /^\d{9}$/.test(payload.vitrasId)) {
      console.log(`  SKIP [${payload.name || row.id}] — já possui vitrasId ${payload.vitrasId}`);
      skipped++;
      continue;
    }
    const vitrasId = generateUniqueVitrasId(existingIds);
    existingIds.add(vitrasId);
    await client.query(
      "UPDATE app_users SET payload = payload || $1::jsonb, updated_at = NOW() WHERE id = $2",
      [JSON.stringify({ vitrasId }), row.id]
    );
    console.log(`  MIGRATED [${payload.name || row.id}] → vitrasId ${vitrasId}`);
    migrated++;
  }

  await client.end();
  console.log(`\nResultado: ${migrated} migrados, ${skipped} já tinham vitrasId.`);
  return { migrated, skipped, total: rows.length };
}

// ─── File mode ────────────────────────────────────────────────────────────────

function migrateFile() {
  const dbPath = join(__dirname, "../data/db.json");
  const db = JSON.parse(readFileSync(dbPath, "utf8"));
  const users = Array.isArray(db.users) ? db.users : [];

  console.log(`File mode — ${users.length} usuário(s) em db.json.`);

  const existingIds = new Set(users.map(u => String(u.vitrasId || "")).filter(Boolean));
  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    if (user.vitrasId && /^\d{9}$/.test(user.vitrasId)) {
      console.log(`  SKIP [${user.name}] — já possui vitrasId ${user.vitrasId}`);
      skipped++;
      continue;
    }
    const vitrasId = generateUniqueVitrasId(existingIds);
    existingIds.add(vitrasId);
    user.vitrasId = vitrasId;
    user.updatedAt = new Date().toISOString();
    console.log(`  MIGRATED [${user.name}] (${user.role}) → vitrasId ${vitrasId}`);
    migrated++;
  }

  if (migrated > 0) {
    writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
    console.log("db.json atualizado.");
  }

  console.log(`\nResultado: ${migrated} migrados, ${skipped} já tinham vitrasId.`);
  return { migrated, skipped, total: users.length };
}

// ─── Validação pós-migração ───────────────────────────────────────────────────

async function validate(databaseUrl) {
  console.log("\n── Validação de unicidade ──");
  let ids = [];

  if (databaseUrl) {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const { rows } = await client.query("SELECT payload->>'vitrasId' AS vitras_id FROM app_users");
    ids = rows.map(r => r.vitras_id);
    await client.end();
  } else {
    const dbPath = join(__dirname, "../data/db.json");
    const db = JSON.parse(readFileSync(dbPath, "utf8"));
    ids = (db.users || []).map(u => u.vitrasId);
  }

  const missing = ids.filter(id => !id || !/^\d{9}$/.test(id));
  const unique = new Set(ids);
  const duplicates = ids.length - unique.size;

  console.log(`  Total: ${ids.length}`);
  console.log(`  Sem vitrasId ou formato inválido: ${missing.length}`);
  console.log(`  Duplicados: ${duplicates}`);
  console.log(`  Únicos: ${unique.size}`);

  if (missing.length > 0) {
    console.error("ERRO: usuários sem vitrasId válido:", missing);
    process.exit(1);
  }
  if (duplicates > 0) {
    console.error("ERRO: vitrasIds duplicados detectados!");
    process.exit(1);
  }
  console.log("  PASS — todos os IDs são únicos e válidos.");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const databaseUrl = process.env.DATABASE_URL || "";

console.log("ACCESS-MIGRATION-01: migração de vitrasId");
console.log(`Modo: ${databaseUrl ? "POSTGRES" : "FILE"}`);
console.log("─".repeat(50));

try {
  if (databaseUrl) {
    await migratePostgres(databaseUrl);
  } else {
    migrateFile();
  }
  await validate(databaseUrl);
  console.log("\nMigração concluída com sucesso.");
} catch (err) {
  console.error("\nERRO na migração:", err.message);
  process.exit(1);
}
