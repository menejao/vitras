/**
 * seed-cid10.mjs — Popula tabela cid10 a partir de arquivo CSV DATASUS pt-BR
 *
 * Fonte: DATASUS — CID-10 pt-BR (domínio público federal)
 * Download: http://www.datasus.gov.br/cid10/V2008/cid10.htm
 *   → "Arquivo para download" → CID-10-CATEGORIAS.CSV + CID-10-SUBCATEGORIAS.CSV
 *
 * Uso:
 *   DATABASE_URL=... node backend/scripts/seed-cid10.mjs \
 *     --categorias ./CID-10-CATEGORIAS.CSV \
 *     --subcategorias ./CID-10-SUBCATEGORIAS.CSV
 *
 * Flags opcionais:
 *   --categorias <path>     CSV de categorias DATASUS (padrão: ./CID-10-CATEGORIAS.CSV)
 *   --subcategorias <path>  CSV de subcategorias DATASUS (padrão: ./CID-10-SUBCATEGORIAS.CSV)
 *   --version <str>         versão a registrar na tabela (padrão: BR-2008)
 *
 * Encoding esperado: Windows-1252 (padrão DATASUS). Se UTF-8, ajustar ENCODING abaixo.
 *
 * Idempotente: INSERT ON CONFLICT DO UPDATE — seguro re-executar.
 */

import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const { Pool } = pg;

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
if (!DATABASE_URL) { console.error("DATABASE_URL não definido"); process.exit(1); }

function stripSsl(url) {
  try {
    const u = new URL(url);
    ["sslmode","sslcert","sslkey","sslrootcert","sslpassword"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return url; }
}

function parseArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : fallback;
}

const CATEGORIAS_PATH    = parseArg("--categorias",    "./CID-10-CATEGORIAS.CSV");
const SUBCATEGORIAS_PATH = parseArg("--subcategorias", "./CID-10-SUBCATEGORIAS.CSV");
const VERSION            = parseArg("--version",       "BR-2008");

// Detect and handle Windows-1252 via Buffer (Node has no built-in cp1252 decoder)
// DATASUS files use ";" as delimiter, first row is header, quoted fields optional
function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${path.resolve(filePath)}\n` +
      `Baixe em: http://www.datasus.gov.br/cid10/V2008/cid10.htm`);
  }

  // Try UTF-8 first; fall back to latin1 if buffer contains high bytes
  const buf = fs.readFileSync(filePath);
  const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const encoding = hasBom ? "utf8" : "latin1"; // latin1 preserves cp1252 bytes
  const raw = buf.toString(encoding).replace(/^﻿/, "");

  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) throw new Error(`Arquivo vazio: ${filePath}`);

  const header = lines[0].split(";").map(h => h.replace(/^"|"$/g, "").trim().toUpperCase());

  return lines.slice(1).map(line => {
    const cols = line.split(";").map(c => c.replace(/^"|"$/g, "").trim());
    const obj = {};
    header.forEach((h, i) => { obj[h] = cols[i] || ""; });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

// DATASUS CSV columns for CID-10-CATEGORIAS.CSV:
//   CAT;DESCRICAO;REFER;EXCLUIDOS (or similar)
// DATASUS CSV columns for CID-10-SUBCATEGORIAS.CSV:
//   SUBCAT;DESCRICAO;REFER;EXCLUIDOS;CLASSIF;RESTRSEXO;CAUSAOBITO;...
//
// Column names vary by version — resolve by position fallback

function getField(row, ...candidates) {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== "") return row[c];
  }
  return "";
}

async function main() {
  const pool = new Pool({ connectionString: stripSsl(DATABASE_URL), ssl: { rejectUnauthorized: false }, max: 2 });
  const client = await pool.connect();

  try {
    const tableCheck = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cid10') AS exists`
    );
    if (!tableCheck.rows[0]?.exists) {
      console.error("ERRO: tabela cid10 não existe — execute migration 023 antes do seed");
      process.exit(1);
    }

    let totalInserted = 0;
    let totalUpdated  = 0;

    // --- Categorias (ex: A00, B01, ...) ---
    let categorias = [];
    if (fs.existsSync(CATEGORIAS_PATH)) {
      console.log(`Lendo categorias: ${CATEGORIAS_PATH}`);
      categorias = parseCsv(CATEGORIAS_PATH);
      console.log(`  ${categorias.length} categorias lidas`);
    } else {
      console.warn(`AVISO: ${CATEGORIAS_PATH} não encontrado — pulando categorias`);
    }

    // --- Subcategorias (ex: A00.0, A00.1, ...) ---
    let subcategorias = [];
    if (fs.existsSync(SUBCATEGORIAS_PATH)) {
      console.log(`Lendo subcategorias: ${SUBCATEGORIAS_PATH}`);
      subcategorias = parseCsv(SUBCATEGORIAS_PATH);
      console.log(`  ${subcategorias.length} subcategorias lidas`);
    } else {
      console.warn(`AVISO: ${SUBCATEGORIAS_PATH} não encontrado — pulando subcategorias`);
    }

    if (!categorias.length && !subcategorias.length) {
      console.error("ERRO: nenhum arquivo CSV encontrado. Baixe os arquivos DATASUS conforme instruções no topo deste script.");
      process.exit(1);
    }

    await client.query("BEGIN");

    // Upsert categorias
    for (const row of categorias) {
      const code = getField(row, "CAT", "CATEGORIA", "CODIGO");
      const desc = getField(row, "DESCRICAO", "DESC", "NOME");
      if (!code || !desc) continue;

      // Chapter = first letter of code
      const chapter = code.charAt(0).toUpperCase();

      const { rows } = await client.query(
        `INSERT INTO cid10 (code, description, chapter, is_billable, version, updated_at)
         VALUES ($1, $2, $3, false, $4, NOW())
         ON CONFLICT (code) DO UPDATE
           SET description = EXCLUDED.description,
               chapter = EXCLUDED.chapter,
               version = EXCLUDED.version,
               updated_at = NOW()
         RETURNING (xmax = 0) AS was_inserted`,
        [code.trim(), desc.trim(), chapter, VERSION]
      );
      if (rows[0]?.was_inserted) totalInserted++; else totalUpdated++;
    }

    // Upsert subcategorias
    for (const row of subcategorias) {
      const code = getField(row, "SUBCAT", "SUBCATEGORIA", "CODIGO");
      const desc = getField(row, "DESCRICAO", "DESC", "NOME");
      if (!code || !desc) continue;

      const chapter = code.charAt(0).toUpperCase();
      // is_billable = subcategoria nível folha (não tem filhos) — DATASUS não fornece direto;
      // assume true para todas as subcategorias (diagnóstico primário)
      const is_billable = true;

      const { rows } = await client.query(
        `INSERT INTO cid10 (code, description, chapter, is_billable, version, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (code) DO UPDATE
           SET description = EXCLUDED.description,
               chapter = EXCLUDED.chapter,
               is_billable = EXCLUDED.is_billable,
               version = EXCLUDED.version,
               updated_at = NOW()
         RETURNING (xmax = 0) AS was_inserted`,
        [code.trim(), desc.trim(), chapter, is_billable, VERSION]
      );
      if (rows[0]?.was_inserted) totalInserted++; else totalUpdated++;
    }

    await client.query("COMMIT");

    // Smokes
    const { rows: cnt } = await client.query("SELECT COUNT(*)::int AS n FROM cid10");
    console.log(`seed-cid10: inserted=${totalInserted} updated=${totalUpdated} total=${cnt[0].n}`);

    if (cnt[0].n < 14000) {
      console.error(`SMOKE FAIL: esperado >= 14000, obtido ${cnt[0].n}`);
      process.exit(1);
    }

    // Código conhecido: J18 = Pneumonia
    const { rows: j18 } = await client.query("SELECT description FROM cid10 WHERE code = 'J18'");
    if (!j18[0]) { console.error("SMOKE FAIL: J18 não encontrado"); process.exit(1); }

    const { rows: byChap } = await client.query(
      "SELECT chapter, COUNT(*)::int AS n FROM cid10 GROUP BY chapter ORDER BY chapter LIMIT 5"
    );
    console.log("Amostra por capítulo:", byChap.map(r => `${r.chapter}=${r.n}`).join(" "));
    console.log(`SMOKE PASS: cid10 COUNT=${cnt[0].n} >= 14000; J18='${j18[0].description}'`);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERRO:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
