#!/usr/bin/env node
/**
 * Smoke test — ERP-02 Municipality entity
 *
 * Gates operacionais obrigatórios antes de ERP-02 READY:
 *   G1: seed-municipalities.mjs executado (municipalities >= 5570 linhas)
 *   G2: migration 033 aplicada (municipalities.id UUID existe)
 *   G3: migration 022 aplicada (FK app_units.municipality_id intacta)
 *   G4: busca de município funciona
 *   G5: criação de UBS valida município
 *   G6: MunicipalityPicker retorna resultados
 *   G7: filtro GET /platform/units?municipalityId= funciona
 *   G8: sem UBS órfãs (municipalityId sem correspondência em municipalities)
 *   G9: sem municípios duplicados por ibge_code
 *   G10: rollback 033 seguro (verificação estrutural)
 *
 * Usage:
 *   DATABASE_URL="postgres://..." \
 *   SUPPORT_ADMIN_VITRASID="000000001" \
 *   SUPPORT_ADMIN_PASSWORD="..." \
 *   BASE_URL="https://api.saudeubs.com.br" \
 *   node scripts/smoke-erp02-municipalities.mjs
 */

import pg from "pg";
import https from "https";
import http from "http";

const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL     = (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const VID          = process.env.SUPPORT_ADMIN_VITRASID;
const PASSWORD     = process.env.SUPPORT_ADMIN_PASSWORD;

function stripSslParams(url) {
  try {
    const u = new URL(url);
    ["sslmode","sslcert","sslkey","sslrootcert","sslpassword","channel_binding"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return url; }
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const mod = url.protocol === "https:" ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = mod.request(opts, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const results = [];
let pass = 0, fail = 0;

function ok(gate, msg) {
  console.log(`  ✓ ${gate}: ${msg}`);
  results.push({ gate, ok: true, msg });
  pass++;
}

function ko(gate, msg) {
  console.error(`  ✗ ${gate}: ${msg}`);
  results.push({ gate, ok: false, msg });
  fail++;
}

async function runDbGates(client) {
  console.log("\n[DB Gates]");

  // G1: municipalities count
  const { rows: cnt } = await client.query("SELECT COUNT(*)::int AS n FROM municipalities");
  const n = cnt[0]?.n || 0;
  if (n >= 5570) ok("G1", `municipalities seed OK — ${n} linhas`);
  else           ko("G1", `municipalities tem ${n} linhas — execute seed-municipalities.mjs`);

  // G2: migration 033 — id UUID column exists
  const { rows: cols } = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'municipalities'
    ORDER BY ordinal_position
  `);
  const idCol = cols.find(c => c.column_name === "id");
  if (idCol?.data_type === "uuid" && idCol.is_nullable === "NO")
    ok("G2", "municipalities.id UUID NOT NULL presente (migration 033 OK)");
  else
    ko("G2", `municipalities.id ausente ou tipo errado: ${JSON.stringify(idCol)}`);

  const createdAtCol = cols.find(c => c.column_name === "created_at");
  if (createdAtCol) ok("G2b", "municipalities.created_at presente");
  else              ko("G2b", "municipalities.created_at ausente");

  // G3: FK app_units.municipality_id → municipalities(ibge_code)
  const { rows: fkRows } = await client.query(`
    SELECT tc.constraint_name, tc.table_name, kcu.column_name,
           ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'app_units'
      AND kcu.column_name = 'municipality_id'
  `);
  const fk = fkRows.find(r => r.foreign_table === "municipalities");
  if (fk) ok("G3", `FK app_units.municipality_id → municipalities.${fk.foreign_column} válida`);
  else    ko("G3", "FK app_units.municipality_id → municipalities AUSENTE — migration 022 não aplicada ou seed vazio");

  // G8: UBS órfãs
  const { rows: orphans } = await client.query(`
    SELECT COUNT(*)::int AS n FROM app_units u
    WHERE u.municipality_id IS NOT NULL AND u.municipality_id != ''
      AND NOT EXISTS (
        SELECT 1 FROM municipalities m WHERE m.ibge_code = u.municipality_id
      )
  `);
  const orphanCount = orphans[0]?.n || 0;
  if (orphanCount === 0) ok("G8", "Nenhuma UBS órfã encontrada");
  else                   ko("G8", `${orphanCount} UBS com municipalityId sem correspondência em municipalities`);

  // G9: duplicados
  const { rows: dups } = await client.query(`
    SELECT ibge_code, COUNT(*)::int AS n FROM municipalities
    GROUP BY ibge_code HAVING COUNT(*) > 1
  `);
  if (dups.length === 0) ok("G9", "Sem ibge_code duplicado em municipalities");
  else                   ko("G9", `${dups.length} ibge_code duplicados detectados`);

  // G10: rollback estrutural — verifica que down() pode restaurar PK
  const { rows: pkRows } = await client.query(`
    SELECT kcu.column_name FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = 'municipalities'
  `);
  const pkCol = pkRows[0]?.column_name;
  if (pkCol === "id") ok("G10", "PK atual = id (UUID). down() pode restaurar ibge_code como PK.");
  else                ko("G10", `PK atual inesperada: ${pkCol}`);
}

async function runApiGates(token) {
  console.log("\n[API Gates]");

  // G4: busca de município
  const { status, body } = await request("GET", "/platform/municipalities?search=S%C3%A3o+Paulo&limit=5", null, token);
  if (status === 200 && Array.isArray(body?.municipalities))
    ok("G4", `GET /platform/municipalities — ${body.total} municípios total, ${body.municipalities.length} retornados`);
  else
    ko("G4", `GET /platform/municipalities status=${status} body=${JSON.stringify(body).slice(0, 80)}`);

  // G4b: busca por código IBGE
  const { status: s4b, body: b4b } = await request("GET", "/platform/municipalities?search=3534401&limit=5", null, token);
  if (s4b === 200 && b4b?.municipalities?.length >= 1)
    ok("G4b", `Busca por IBGE code retornou ${b4b.municipalities.length} resultado(s)`);
  else
    ko("G4b", `Busca por IBGE code retornou 0 resultados (status=${s4b})`);

  // G4c: filtro por UF
  const { status: s4c, body: b4c } = await request("GET", "/platform/municipalities?uf=SP&limit=1", null, token);
  if (s4c === 200 && b4c?.municipalities?.every(m => m.uf === "SP"))
    ok("G4c", `Filtro ?uf=SP retorna apenas municípios de SP`);
  else
    ko("G4c", `Filtro ?uf=SP falhou (status=${s4c})`);

  // G4d: paginação
  const { status: s4d, body: b4d } = await request("GET", "/platform/municipalities?page=2&limit=10", null, token);
  if (s4d === 200 && b4d?.page === 2)
    ok("G4d", `Paginação page=2 retornou corretamente`);
  else
    ko("G4d", `Paginação falhou (status=${s4d} page=${b4d?.page})`);

  // G4e: UUID de município válido
  const firstMuni = body?.municipalities?.[0];
  if (firstMuni?.id) {
    const { status: s4e, body: b4e } = await request("GET", `/platform/municipalities/${firstMuni.id}`, null, token);
    if (s4e === 200 && b4e?.ibgeCode && typeof b4e.unitsCount === "number")
      ok("G4e", `GET /platform/municipalities/:id retorna ibgeCode=${b4e.ibgeCode} unitsCount=${b4e.unitsCount}`);
    else
      ko("G4e", `GET /platform/municipalities/:id falhou (status=${s4e})`);

    // G7: filtro units por municipalityId (UUID)
    const { status: s7, body: b7 } = await request(
      "GET", `/platform/units?municipalityId=${firstMuni.id}&limit=10`, null, token
    );
    if (s7 === 200 && Array.isArray(b7?.units))
      ok("G7", `GET /platform/units?municipalityId=UUID retorna ${b7.units.length} UBS`);
    else
      ko("G7", `Filtro por UUID falhou (status=${s7})`);

    // G7b: filtro units por IBGE code (compat legado)
    const { status: s7b, body: b7b } = await request(
      "GET", `/platform/units?municipalityId=${firstMuni.ibgeCode}&limit=10`, null, token
    );
    if (s7b === 200 && Array.isArray(b7b?.units))
      ok("G7b", `GET /platform/units?municipalityId=IBGE_CODE retorna ${b7b.units.length} UBS (compat OK)`);
    else
      ko("G7b", `Filtro por IBGE code falhou (status=${s7b})`);
  } else {
    ko("G4e", "Nenhum município retornado — seed ausente");
    ko("G7",  "Filtro UUID não testado — seed ausente");
    ko("G7b", "Filtro IBGE compat não testado — seed ausente");
  }

  // G5: criação de UBS com município inválido → 422
  const { status: s5 } = await request("POST", "/platform/units", {
    name: "UBS Smoke Inválida", cnes: "9991001",
    municipalityId: "0000000",  // não existe na base
    municipalityName: "Fantasma", uf: "XX",
    street: "Rua A", streetNumber: "1", neighborhood: "A",
  }, token);
  if (s5 === 422) ok("G5", "POST /platform/units com município inexistente → 422");
  else            ko("G5", `Esperado 422, recebido ${s5} — validação FK pode não estar ativa`);

  // G6: MunicipalityPicker endpoint — busca funciona com 2+ caracteres
  const { status: s6, body: b6 } = await request("GET", "/platform/municipalities?search=re&limit=5", null, token);
  if (s6 === 200 && b6?.municipalities?.length > 0)
    ok("G6", `MunicipalityPicker search='re' retorna ${b6.municipalities.length} resultado(s)`);
  else
    ko("G6", `MunicipalityPicker retornou 0 resultados para search='re' (status=${s6})`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Smoke ERP-02 — Municipality Gates              ║");
  console.log(`║  BASE: ${BASE_URL.padEnd(42)}║`);
  console.log("╚══════════════════════════════════════════════════╝");

  // Login
  if (!VID || !PASSWORD) {
    console.error("\nERROR: SUPPORT_ADMIN_VITRASID e SUPPORT_ADMIN_PASSWORD são obrigatórios");
    process.exit(1);
  }
  const { status: ls, body: lb } = await request("POST", "/auth/login", { identifier: VID, password: PASSWORD });
  if (ls !== 200 || !lb?.token) {
    console.error(`\nLogin falhou (status=${ls}): ${JSON.stringify(lb)}`);
    process.exit(1);
  }
  const token = lb.token || lb.accessToken;
  console.log(`\n[Login OK] support_admin autenticado`);

  // API gates (always run)
  await runApiGates(token);

  // DB gates (only if DATABASE_URL provided)
  if (DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: stripSslParams(DATABASE_URL),
      ssl: { rejectUnauthorized: true },
      max: 2,
    });
    const client = await pool.connect();
    try { await runDbGates(client); }
    finally { client.release(); await pool.end(); }
  } else {
    console.log("\n[DB Gates] SKIPPED — DATABASE_URL não definida");
    ["G1","G2","G2b","G3","G8","G9","G10"].forEach(g =>
      ko(g, "DATABASE_URL ausente — gate não verificado")
    );
  }

  // Summary
  console.log("\n══════════════════════════════════════");
  console.log(`PASS: ${pass}  FAIL: ${fail}  TOTAL: ${pass + fail}`);
  if (fail === 0) {
    console.log("\n✓ TODOS OS GATES PASSARAM — ERP-02 READY");
  } else {
    console.log(`\n✗ ${fail} GATE(S) FALHARAM — ERP-02 CONDITIONALLY READY`);
    console.log("\nGates pendentes:");
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.gate}: ${r.msg}`));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
