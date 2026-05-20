#!/usr/bin/env node
/**
 * Safe restore script for SaudeUbs/SIGUS backup files.
 *
 * Usage:
 *   node scripts/restore-backup.js --file <backup.json> --env <staging|production> [--confirm] [--force]
 *
 * Environment variables required:
 *   DATABASE_URL          — target Neon connection string
 *   DATA_ENCRYPTION_KEY   — AES-256-GCM key (must match the origin env)
 *
 * Safety rules:
 *   --env production      requires --force (never runs silently in prod)
 *   --confirm             required for all restores (interactive confirmation)
 *   Script never reads DATABASE_URL from args — only from process.env
 */

import { readFileSync } from "fs";
import { createInterface } from "readline";

// ── arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) {
    return args[idx + 1];
  }
  return null;
}

const filePath = getArg("--file");
const env = getArg("--env");
const hasConfirm = args.includes("--confirm");
const hasForce = args.includes("--force");
const dryRun = args.includes("--dry-run");

// ── validation ───────────────────────────────────────────────────────────────

function fatal(msg) {
  console.error(`\n[ERRO] ${msg}\n`);
  process.exit(1);
}

if (!filePath) fatal("--file <path> obrigatório.");
if (!env) fatal("--env <staging|production> obrigatório.");
if (!["staging", "production"].includes(env)) fatal("--env deve ser 'staging' ou 'production'.");
if (!hasConfirm) fatal("--confirm obrigatório. Confirme que você leu o runbook antes de restaurar.");
if (env === "production" && !hasForce) {
  fatal(
    "Restore em PRODUÇÃO requer --force.\n" +
    "  Leia RUNBOOK_BACKUP_RESTORE.md seção 5 antes de prosseguir.\n" +
    "  Apenas use --force com dois responsáveis presentes (regra dos quatro olhos)."
  );
}

const DATABASE_URL = process.env.DATABASE_URL;
const DATA_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY;

if (!DATABASE_URL) fatal("DATABASE_URL não definida no ambiente.");
if (!DATA_ENCRYPTION_KEY) fatal("DATA_ENCRYPTION_KEY não definida no ambiente.");
if (DATA_ENCRYPTION_KEY.length < 32) fatal("DATA_ENCRYPTION_KEY parece inválida (< 32 chars).");

// Heuristic: staging URLs usually differ from production — warn if prod-looking URL used in staging
if (env === "staging" && DATABASE_URL.includes("neon.tech") && !DATABASE_URL.includes("staging")) {
  console.warn(
    "\n[AVISO] DATABASE_URL parece ser de produção mas --env=staging foi passado.\n" +
    "         Verifique se DATABASE_URL aponta para o banco de staging correto.\n"
  );
}

// ── read backup file ─────────────────────────────────────────────────────────

let backup;
try {
  const raw = readFileSync(filePath, "utf8");
  backup = JSON.parse(raw);
} catch (err) {
  fatal(`Falha ao ler/parsear ${filePath}: ${err.message}`);
}

if (!backup.generatedAt || !backup.encryptedSnapshot) {
  fatal("Arquivo de backup inválido — faltam campos 'generatedAt' ou 'encryptedSnapshot'.");
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log("\n=== RESTORE DE BACKUP — SaudeUbs/SIGUS ===\n");
console.log(`  Arquivo:       ${filePath}`);
console.log(`  Gerado em:     ${backup.generatedAt}`);
console.log(`  Driver:        ${backup.driver || "n/a"}`);
console.log(`  Ambiente alvo: ${env.toUpperCase()}`);
console.log(`  DB URL (host): ${maskUrl(DATABASE_URL)}`);
console.log(`  Dry-run:       ${dryRun ? "SIM — nenhuma escrita será feita" : "NÃO"}`);
if (env === "production") {
  console.log("\n  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.log("  !!! ATENÇÃO: RESTORE EM PRODUÇÃO SOLICITADO !!!");
  console.log("  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}
console.log();

// ── interactive confirmation ──────────────────────────────────────────────────

await confirmInteractive(env);

// ── connect and restore ───────────────────────────────────────────────────────

if (dryRun) {
  console.log("[DRY-RUN] Nenhuma escrita realizada. Validação concluída com sucesso.");
  process.exit(0);
}

await performRestore(backup, DATABASE_URL);

// ─────────────────────────────────────────────────────────────────────────────

function maskUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return url.slice(0, 20) + "...";
  }
}

async function confirmInteractive(targetEnv) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const prompt = (q) => new Promise((resolve) => rl.question(q, resolve));

  const answer = await prompt(
    targetEnv === "production"
      ? "  Digite CONFIRMAR-PRODUCAO para prosseguir: "
      : "  Digite CONFIRMAR para prosseguir: "
  );
  rl.close();

  const expected = targetEnv === "production" ? "CONFIRMAR-PRODUCAO" : "CONFIRMAR";
  if (answer.trim() !== expected) {
    console.log("\nRestore cancelado.\n");
    process.exit(0);
  }
  console.log();
}

async function performRestore(backupData, dbUrl) {
  // Try local scripts/node_modules first, then fall back to backend/node_modules
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
    } catch {
      // try next
    }
  }
  if (!pg) {
    fatal(
      "Módulo 'pg' não encontrado.\n" +
      "  Opção A: cd scripts && npm install\n" +
      "  Opção B: cd backend && node ../scripts/restore-backup.js ..."
    );
  }

  const { Client } = pg;

  // Build connection config — Neon pooler requires SSL
  const connectionString = dbUrl;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  console.log("[1/4] Conectando ao banco de dados...");
  try {
    await client.connect();
  } catch (err) {
    fatal(`Falha ao conectar: ${err.message}`);
  }

  console.log("[2/4] Verificando estrutura da tabela...");
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'app_state'
    ) AS exists
  `);
  const tableExists = tableCheck.rows[0]?.exists;

  if (!tableExists) {
    console.log("     Tabela 'app_state' não existe — criando...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  console.log("[3/4] Aplicando backup...");

  // backup.encryptedSnapshot is the raw JSONB payload from app_state.data in the origin DB.
  // Restore as-is — DATA_ENCRYPTION_KEY must match the origin environment.
  const payload = backupData.encryptedSnapshot;

  await client.query(`
    INSERT INTO app_state (id, data, updated_at)
    VALUES (1, $1::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `, [JSON.stringify(payload)]);

  console.log("[4/4] Verificando restore...");
  const verify = await client.query("SELECT id, (data IS NOT NULL) AS has_data FROM app_state WHERE id = 1");
  if (!verify.rows[0]?.has_data) {
    await client.end();
    fatal("Verificação pós-restore falhou — linha não encontrada.");
  }

  await client.end();

  console.log("\n✓ Restore concluído com sucesso.");
  console.log(`  Ambiente: ${env.toUpperCase()}`);
  console.log(`  Backup de: ${backupData.generatedAt}`);
  console.log(`  DB: ${maskUrl(dbUrl)}`);
  console.log("\nPróximos passos:");
  console.log("  1. Iniciar backend apontando para este banco");
  console.log("  2. Executar: node scripts/smoke-production.js --base http://localhost:3001");
  console.log("  3. Testar login com conta conhecida");
  if (env === "staging") {
    console.log("  4. Se OK em staging: aplicar em produção via Neon PITR (preferido)");
  }
  console.log();
}
