/**
 * Smoke tests Deploy 3A — Fase 3: Migrations 012, 013, 014 (DDL only)
 *
 * Strategy: mock pg client captures SQL. No real DB required.
 * Validates: DDL structure, idempotency, no data mutation, rollback documented.
 */

function makeMockClient() {
  const log = [];
  const client = {
    queries: log,
    async query(sql) {
      log.push(sql.trim());
      return { rows: [] };
    },
  };
  return client;
}

const results = [];
function record(smoke, pass, evidence, risco = "CRITICAL") {
  results.push({ smoke, pass, evidence, risco });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${smoke}`);
  if (!pass) console.error("  EVIDENCE:", JSON.stringify(evidence, null, 2));
}

// ============================================================
// Smoke 1 — Migration 012 aplica (ADD COLUMN race_color)
// ============================================================
{
  const { up, id } = await import("../src/migrations/012_add_race_color_to_patients.js");
  const client = makeMockClient();
  let err = null;
  try { await up(client); } catch (e) { err = e.message; }

  const ddl = client.queries.join("\n");
  const hasColumn = ddl.includes("race_color") && ddl.includes("app_patients");
  const hasIfNotExists = ddl.includes("IF NOT EXISTS");
  const hasNoUpdate = !client.queries.some(q => /^\s*UPDATE\s+/i.test(q));
  const pass = !err && hasColumn && hasIfNotExists && hasNoUpdate;

  record("Smoke 1 — Migration 012 aplica (race_color em app_patients)", pass,
    { id, err, hasColumn, hasIfNotExists, hasNoUpdate, queries: client.queries });
}

// ============================================================
// Smoke 2 — Migration 013 aplica (ADD COLUMN cnes em app_units)
// ============================================================
{
  const { up, id } = await import("../src/migrations/013_add_cnes_to_units.js");
  // Mock with empty duplicate check result
  const client = makeMockClient();
  let err = null;
  try { await up(client); } catch (e) { err = e.message; }

  const ddl = client.queries.join("\n");
  const hasColumn = ddl.includes("cnes") && ddl.includes("app_units");
  const hasIfNotExists = ddl.includes("IF NOT EXISTS");
  const hasIndex = ddl.toLowerCase().includes("create index");
  const hasNoUpdate = !client.queries.some(q => /^\s*UPDATE\s+/i.test(q));
  const pass = !err && hasColumn && hasIfNotExists && hasIndex && hasNoUpdate;

  record("Smoke 2 — Migration 013 aplica (cnes em app_units + índice)", pass,
    { id, err, hasColumn, hasIfNotExists, hasIndex, hasNoUpdate, queries: client.queries });
}

// ============================================================
// Smoke 3 — Migration 014 aplica (ADD COLUMN cns em app_users)
// ============================================================
{
  const { up, id } = await import("../src/migrations/014_add_cns_to_users.js");
  const client = makeMockClient();
  let err = null;
  try { await up(client); } catch (e) { err = e.message; }

  const ddl = client.queries.join("\n");
  const hasColumn = ddl.includes("cns") && ddl.includes("app_users");
  const hasIfNotExists = ddl.includes("IF NOT EXISTS");
  const hasIndex = ddl.toLowerCase().includes("create index");
  const hasNoUpdate = !client.queries.some(q => /^\s*UPDATE\s+/i.test(q));
  const pass = !err && hasColumn && hasIfNotExists && hasIndex && hasNoUpdate;

  record("Smoke 3 — Migration 014 aplica (cns em app_users + índice)", pass,
    { id, err, hasColumn, hasIfNotExists, hasIndex, hasNoUpdate, queries: client.queries });
}

// ============================================================
// Smoke 4 — Idempotência: reexecutar migrations sem erro/duplicação
// ============================================================
{
  const migrations = await Promise.all([
    import("../src/migrations/012_add_race_color_to_patients.js"),
    import("../src/migrations/013_add_cnes_to_units.js"),
    import("../src/migrations/014_add_cns_to_users.js"),
  ]);

  let allIdempotent = true;
  const evidence = [];

  for (const m of migrations) {
    const client1 = makeMockClient();
    const client2 = makeMockClient();
    let err1 = null, err2 = null;
    try { await m.up(client1); } catch (e) { err1 = e.message; }
    try { await m.up(client2); } catch (e) { err2 = e.message; }

    // Both runs must succeed AND produce same SQL (IF NOT EXISTS guarantees idempotency on real DB)
    const ddl1 = client1.queries.join("|");
    const ddl2 = client2.queries.join("|");
    const sameQueries = ddl1 === ddl2;
    const allHaveIfNotExists = client1.queries.every(q => !q.match(/^(CREATE|ALTER)/i) || q.includes("IF NOT EXISTS"));
    const ok = !err1 && !err2 && sameQueries && allHaveIfNotExists;
    if (!ok) allIdempotent = false;
    evidence.push({ id: m.id, err1, err2, sameQueries, allHaveIfNotExists, ok });
  }

  record("Smoke 4 — Idempotência: IF NOT EXISTS em toda DDL, reexecução estável", allIdempotent, evidence);
}

// ============================================================
// Smoke 5 — Rollback documentado nas migrations
// ============================================================
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");

  const dir = dirname(fileURLToPath(import.meta.url)).replace(/test$/, "src/migrations");
  const files = [
    "012_add_race_color_to_patients.js",
    "013_add_cnes_to_units.js",
    "014_add_cns_to_users.js",
  ];

  const evidence = [];
  let allHaveRollback = true;

  for (const f of files) {
    const src = readFileSync(join(dir, f), "utf8");
    // Rollback must be documented: DROP COLUMN or DROP INDEX mentioned in comment
    const hasRollbackComment = src.includes("Rollback") || src.includes("rollback");
    const hasDrop = src.toLowerCase().includes("drop");
    const ok = hasRollbackComment && hasDrop;
    if (!ok) allHaveRollback = false;
    evidence.push({ file: f, hasRollbackComment, hasDrop, ok });
  }

  record("Smoke 5 — Rollback documentado (DROP COLUMN + DROP INDEX comentados)", allHaveRollback, evidence);
}

// ============================================================
// Smoke 6 — SELECT nas novas colunas: consulta válida
// (validates column names and types appear correctly in DDL)
// ============================================================
{
  const migrations = await Promise.all([
    import("../src/migrations/012_add_race_color_to_patients.js"),
    import("../src/migrations/013_add_cnes_to_units.js"),
    import("../src/migrations/014_add_cns_to_users.js"),
  ]);

  const expected = [
    { id: "012_add_race_color_to_patients", col: "race_color", table: "app_patients", type: "VARCHAR(20)" },
    { id: "013_add_cnes_to_units", col: "cnes", table: "app_units", type: "VARCHAR(7)" },
    { id: "014_add_cns_to_users", col: "cns", table: "app_users", type: "VARCHAR(20)" },
  ];

  const evidence = [];
  let allOk = true;

  for (let i = 0; i < migrations.length; i++) {
    const client = makeMockClient();
    await migrations[i].up(client);
    const ddl = client.queries.join("\n");
    const { col, table, type } = expected[i];
    const hasCol = ddl.includes(col);
    const hasTable = ddl.includes(table);
    const hasType = ddl.includes(type);
    const ok = hasCol && hasTable && hasType;
    if (!ok) allOk = false;
    evidence.push({ id: expected[i].id, col, table, type, hasCol, hasTable, hasType, ok });
  }

  record("Smoke 6 — Colunas declaradas com nome e tipo corretos", allOk, evidence);
}

// ============================================================
// Smoke 7 — Nenhum dado existente alterado (zero UPDATE/INSERT/DELETE)
// ============================================================
{
  const migrations = await Promise.all([
    import("../src/migrations/012_add_race_color_to_patients.js"),
    import("../src/migrations/013_add_cnes_to_units.js"),
    import("../src/migrations/014_add_cns_to_users.js"),
  ]);

  const evidence = [];
  let allClean = true;

  for (const m of migrations) {
    const client = makeMockClient();
    await m.up(client);
    // Allow SELECT (gate queries); block UPDATE/INSERT/DELETE
    const mutations = client.queries.filter(q => /^\s*(UPDATE|INSERT|DELETE)\s+/i.test(q));
    const ok = mutations.length === 0;
    if (!ok) allClean = false;
    evidence.push({ id: m.id, mutations, ok });
  }

  record("Smoke 7 — Zero UPDATE/INSERT/DELETE: dados existentes intactos", allClean, evidence);
}

// ============================================================
// Regressão Deploy 2C — garantir Fase 2 estável
// ============================================================
import { spawnSync } from "node:child_process";
const backendDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
{
  const r = spawnSync("node", ["test/smoke-deploy2c.mjs"], { cwd: backendDir, encoding: "utf8", timeout: 180000, shell: true });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = r.status === 0 && out.includes("APPROVED FOR DEPLOY 2C") && out.includes("7/7 PASS");
  record("Smoke 8 — Regressão Deploy 2C (7/7 PASS)", pass,
    { exitCode: r.status, lastLines: out.split("\n").filter(Boolean).slice(-4).join(" | ") });
}

// ============================================================
// Summary
// ============================================================
console.log("\n=== SMOKE DEPLOY 3A — SUMMARY ===");
const total = results.length;
const passed = results.filter((r) => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach((r) => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY 3A — FASE 3 COMPLETE" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
