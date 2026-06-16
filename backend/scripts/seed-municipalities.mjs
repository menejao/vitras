/**
 * seed-municipalities.mjs — Popula tabela municipalities via IBGE API pública
 * Fonte: IBGE Localidades API (domínio público)
 * Uso: DATABASE_URL=... node backend/scripts/seed-municipalities.mjs
 *
 * Idempotente: INSERT ON CONFLICT DO UPDATE — seguro re-executar.
 */

import pg from "pg";

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

// Regiões IBGE: code → name
const REGIOES = { "1": "Norte", "2": "Nordeste", "3": "Sudeste", "4": "Sul", "5": "Centro-Oeste" };

// Capitais por código IBGE
const CAPITAIS = new Set([
  "1200401","1302603","1600303","1100205","1400100","1500800","1721000",
  "2111300","2211001","2304400","2408102","2507507","2611606","2704302",
  "2800308","2927408","3106200","3304557","3550308","4106902","4205407",
  "4314902","5002704","5103403","5208707","5300108"
]);

async function fetchMunicipios() {
  const url = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`IBGE API retornou ${resp.status}`);
  return resp.json();
}

async function main() {
  const pool = new Pool({ connectionString: stripSsl(DATABASE_URL), ssl: { rejectUnauthorized: false }, max: 2 });
  const client = await pool.connect();

  try {
    const tableCheck = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'municipalities') AS exists`
    );
    if (!tableCheck.rows[0]?.exists) {
      console.error("ERRO: tabela municipalities não existe — execute migration 021 antes do seed");
      process.exit(1);
    }

    console.log("Buscando municípios da API IBGE...");
    const municipios = await fetchMunicipios();
    console.log(`API retornou ${municipios.length} municípios`);

    const IBGE_VERSION = "2022";
    const BATCH = 500;
    let inserted = 0;
    let updated = 0;

    await client.query("BEGIN");
    for (let i = 0; i < municipios.length; i += BATCH) {
      const batch = municipios.slice(i, i + BATCH);
      for (const m of batch) {
        const ibge_code = String(m.id).padStart(7, "0");
        const name = String(m.nome || "").trim();
        const uf = String(m.microrregiao?.mesorregiao?.UF?.sigla || "").toUpperCase();
        const regionCode = String(m.microrregiao?.mesorregiao?.UF?.regiao?.id || "");
        const region = REGIOES[regionCode] || null;
        const is_capital = CAPITAIS.has(ibge_code);

        const { rows } = await client.query(
          `INSERT INTO municipalities (ibge_code, name, uf, region, is_capital, ibge_version, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (ibge_code) DO UPDATE
             SET name = EXCLUDED.name,
                 uf = EXCLUDED.uf,
                 region = EXCLUDED.region,
                 is_capital = EXCLUDED.is_capital,
                 ibge_version = EXCLUDED.ibge_version,
                 updated_at = NOW()
           RETURNING (xmax = 0) AS was_inserted`,
          [ibge_code, name, uf, region, is_capital, IBGE_VERSION]
        );
        if (rows[0]?.was_inserted) inserted++; else updated++;
      }
      process.stdout.write(`\r  ${Math.min(i + BATCH, municipios.length)}/${municipios.length}`);
    }
    await client.query("COMMIT");
    console.log();

    // Smokes
    const { rows: cnt } = await client.query("SELECT COUNT(*)::int AS n FROM municipalities");
    console.log(`seed-municipalities: inserted=${inserted} updated=${updated} total=${cnt[0].n}`);

    if (cnt[0].n < 5570) {
      console.error(`SMOKE FAIL: esperado >= 5570, obtido ${cnt[0].n}`);
      process.exit(1);
    }

    const { rows: rp } = await client.query("SELECT name, uf FROM municipalities WHERE ibge_code = '3534401'");
    if (!rp[0]) { console.error("SMOKE FAIL: Ribeirão Preto (3534401) não encontrado"); process.exit(1); }

    const { rows: sp } = await client.query("SELECT COUNT(*)::int AS n FROM municipalities WHERE uf = 'SP'");

    console.log(`SMOKE PASS: total=${cnt[0].n} >= 5570; 3534401='${rp[0].name}' UF=${rp[0].uf}; SP=${sp[0].n} municípios`);
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
