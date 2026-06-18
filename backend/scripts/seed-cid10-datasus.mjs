/**
 * seed-cid10-datasus.mjs — Baixa CID-10 diretamente do DATASUS e popula tabela cid10
 *
 * Fonte: DATASUS CID-10 V2008 (domínio público federal)
 * URL: http://www2.datasus.gov.br/cid10/V2008/downloads/CID10CSV.zip
 *
 * Uso: DATABASE_URL=... node backend/scripts/seed-cid10-datasus.mjs
 *
 * Idempotente: INSERT ON CONFLICT DO UPDATE — seguro re-executar.
 */

import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createUnzip } from "node:zlib";
import { tmpdir } from "node:os";

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

const CID10_ZIP_URL = "http://www2.datasus.gov.br/cid10/V2008/downloads/CID10CSV.zip";
const VERSION = "BR-V2008";

async function downloadFile(url, destPath) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!resp.ok) throw new Error(`Download falhou: ${resp.status} ${url}`);
  const dest = createWriteStream(destPath);
  await pipeline(resp.body, dest);
  console.log(`Download OK: ${destPath} (${fs.statSync(destPath).size} bytes)`);
}

async function extractZip(zipPath, destDir) {
  // Use system unzip — available on Amazon Linux 2023
  const { execSync } = await import("node:child_process");
  execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "pipe" });
  const files = fs.readdirSync(destDir);
  console.log(`Extraídos: ${files.join(", ")}`);
  return files.map(f => path.join(destDir, f));
}

function parseCsvDatasus(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const buf = fs.readFileSync(filePath);
  // DATASUS files use Windows-1252 (latin1); Node's 'latin1' preserves all bytes
  const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const raw = buf.toString(hasBom ? "utf8" : "latin1").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];

  const header = lines[0].split(";").map(h => h.replace(/^"|"$/g, "").trim().toUpperCase());

  return lines.slice(1).map(line => {
    const cols = [];
    let inQuote = false, cur = "";
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ";" && !inQuote) { cols.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    const obj = {};
    header.forEach((h, i) => { obj[h] = (cols[i] || "").trim(); });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

function getField(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return "";
}

async function upsertRows(client, rows, isBillable) {
  let ins = 0, upd = 0;
  for (const row of rows) {
    // Try common column name patterns in DATASUS CSV
    const code = getField(row, "SUBCAT", "CAT", "CATEGORIA", "CODIGO", "COD").toUpperCase();
    const desc = getField(row, "DESCRICAO", "DESC", "NOME", "DESCRIPTION");
    if (!code || !desc || !/^[A-Z]/.test(code)) continue;

    const chapter = code.charAt(0);

    const { rows: r } = await client.query(
      `INSERT INTO cid10 (code, description, chapter, is_billable, version, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (code) DO UPDATE
         SET description = EXCLUDED.description,
             chapter = EXCLUDED.chapter,
             is_billable = EXCLUDED.is_billable,
             version = EXCLUDED.version,
             updated_at = NOW()
       RETURNING (xmax = 0) AS was_inserted`,
      [code, desc.substring(0, 499), chapter, isBillable, VERSION]
    );
    if (r[0]?.was_inserted) ins++; else upd++;
  }
  return { ins, upd };
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(tmpdir(), "cid10-"));
  const zipPath = path.join(tmpDir, "CID10CSV.zip");

  console.log("Baixando CID-10 do DATASUS...");
  await downloadFile(CID10_ZIP_URL, zipPath);

  console.log("Extraindo ZIP...");
  const extractDir = path.join(tmpDir, "extracted");
  fs.mkdirSync(extractDir, { recursive: true });
  const files = await extractZip(zipPath, extractDir);

  // Identify categorias and subcategorias files by name patterns
  const categorias = files.filter(f => /CATEGOR/i.test(path.basename(f)) && /\.csv$/i.test(f))[0];
  const subcategorias = files.filter(f => /SUBCAT/i.test(path.basename(f)) && /\.csv$/i.test(f))[0];
  const allCsvs = files.filter(f => /\.csv$/i.test(f));

  console.log("Categorias:", categorias || "(não encontrado)");
  console.log("Subcategorias:", subcategorias || "(não encontrado)");
  console.log("Todos os CSVs:", allCsvs.map(f => path.basename(f)).join(", "));

  if (!allCsvs.length) { console.error("ERRO: nenhum CSV encontrado no ZIP"); process.exit(1); }

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

    await client.query("BEGIN");
    let totalIns = 0, totalUpd = 0;

    if (categorias) {
      const rows = parseCsvDatasus(categorias);
      console.log(`Categorias: ${rows.length} linhas lidas`);
      const { ins, upd } = await upsertRows(client, rows, false);
      totalIns += ins; totalUpd += upd;
      console.log(`Categorias: inserted=${ins} updated=${upd}`);
    }

    if (subcategorias) {
      const rows = parseCsvDatasus(subcategorias);
      console.log(`Subcategorias: ${rows.length} linhas lidas`);
      const { ins, upd } = await upsertRows(client, rows, true);
      totalIns += ins; totalUpd += upd;
      console.log(`Subcategorias: inserted=${ins} updated=${upd}`);
    } else if (!categorias) {
      // Try all CSVs
      for (const f of allCsvs) {
        const rows = parseCsvDatasus(f);
        const name = path.basename(f);
        console.log(`${name}: ${rows.length} linhas lidas`);
        const isBillable = /SUBCAT/i.test(name);
        const { ins, upd } = await upsertRows(client, rows, isBillable);
        totalIns += ins; totalUpd += upd;
        console.log(`${name}: inserted=${ins} updated=${upd}`);
      }
    }

    await client.query("COMMIT");

    const { rows: cnt } = await client.query("SELECT COUNT(*)::int AS n FROM cid10");
    console.log(`\nseed-cid10-datasus: inserted=${totalIns} updated=${totalUpd} total=${cnt[0].n}`);

    if (cnt[0].n < 14000) {
      console.error(`SMOKE FAIL: esperado >= 14000, obtido ${cnt[0].n}`);
      // List what chapters are present
      const { rows: chaps } = await client.query("SELECT chapter, COUNT(*)::int AS n FROM cid10 GROUP BY chapter ORDER BY chapter");
      console.log("Chapters:", chaps.map(r => `${r.chapter}=${r.n}`).join(" "));
      process.exit(1);
    }

    const { rows: j18 } = await client.query("SELECT code, description FROM cid10 WHERE code = 'J18'");
    if (!j18[0]) {
      console.error("SMOKE FAIL: J18 não encontrado");
      process.exit(1);
    }
    console.log(`J18 = '${j18[0].description}'`);
    console.log(`SMOKE PASS: cid10 COUNT=${cnt[0].n} >= 14000; J18 encontrado`);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERRO:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    // Cleanup temp
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

main();
