#!/usr/bin/env node
/**
 * Seed municipalities from IBGE API into Neon/Postgres.
 * Run BEFORE migration 022.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/seed-municipalities.mjs
 */

import pg from "pg";
import https from "https";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

function stripSslParams(url) {
  try {
    const u = new URL(url);
    ["sslmode", "sslcert", "sslkey", "sslrootcert", "sslpassword", "channel_binding"].forEach(
      (p) => u.searchParams.delete(p)
    );
    return u.toString();
  } catch {
    return url;
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

const UF_REGION = {
  AC:"Norte", AM:"Norte", AP:"Norte", PA:"Norte", RO:"Norte", RR:"Norte", TO:"Norte",
  AL:"Nordeste", BA:"Nordeste", CE:"Nordeste", MA:"Nordeste", PB:"Nordeste",
  PE:"Nordeste", PI:"Nordeste", RN:"Nordeste", SE:"Nordeste",
  DF:"Centro-Oeste", GO:"Centro-Oeste", MS:"Centro-Oeste", MT:"Centro-Oeste",
  ES:"Sudeste", MG:"Sudeste", RJ:"Sudeste", SP:"Sudeste",
  PR:"Sul", RS:"Sul", SC:"Sul",
};

const CAPITALS = new Set([
  "1200401","1302603","1600303","1501402","1100205","1400100","1721000","2111300",
  "2211001","2304400","2507507","2611606","2800308","2927408","5002704","5103403",
  "5208707","3106200","3304557","3550308","4106902","4205407","4314902",
  "2704302","2927408",
]);

async function main() {
  console.log("[1/3] Buscando municípios da API IBGE...");
  const data = await fetchJson(
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome"
  );
  console.log(`      ${data.length} municípios recebidos`);

  const pool = new pg.Pool({
    connectionString: stripSslParams(DATABASE_URL),
    ssl: { rejectUnauthorized: true },
    max: 3,
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();
  try {
    console.log("[2/3] Inserindo no banco (upsert)...");
    let count = 0;

    await client.query("BEGIN");
    for (const m of data) {
      const ibge = String(m.id);
      const name = m.nome;
      const uf   = m?.microrregiao?.mesorregiao?.UF?.sigla ?? m?.["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ?? "??";

      const region = UF_REGION[uf] ?? null;
      const isCapital = CAPITALS.has(ibge);

      await client.query(
        `INSERT INTO municipalities (ibge_code, name, uf, region, is_capital, ibge_version)
         VALUES ($1, $2, $3, $4, $5, '2022')
         ON CONFLICT (ibge_code) DO UPDATE
           SET name=$2, uf=$3, region=$4, is_capital=$5, updated_at=NOW()`,
        [ibge, name, uf, region, isCapital]
      );
      count++;
      if (count % 1000 === 0) process.stdout.write(`      ${count}...\n`);
    }
    await client.query("COMMIT");

    const { rows } = await client.query("SELECT COUNT(*)::int AS cnt FROM municipalities");
    console.log(`[3/3] Seed concluído — ${rows[0].cnt} municípios no banco`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
