/**
 * Cria/atualiza UBS Padrão e associa todos os usuários, pacientes e equipes a ela.
 * Uso: DATABASE_URL=... node scripts/setup-default-ubs.mjs
 */
import pg from "pg";

function stripSslParams(url) {
  try {
    const u = new URL(url);
    ["sslmode","sslcert","sslkey","sslrootcert","sslpassword","channel_binding"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return url; }
}

const client = new pg.Client({
  connectionString: stripSslParams(process.env.DATABASE_URL || ""),
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const r = await client.query("SELECT data FROM app_state WHERE id = 1");
const db = r.rows[0].data;

const UNIT_ID = "unit-default";
const UNIT_NAME = "UBS Padrão";

// 1. Criar ou atualizar a unidade
if (!Array.isArray(db.units)) db.units = [];
const existingUnit = db.units.find(u => u.id === UNIT_ID);
if (existingUnit) {
  existingUnit.name = UNIT_NAME;
  console.log("Unidade atualizada:", UNIT_ID, "→", UNIT_NAME);
} else {
  db.units.push({ id: UNIT_ID, name: UNIT_NAME, cnes: null, createdAt: new Date().toISOString() });
  console.log("Unidade criada:", UNIT_ID, "→", UNIT_NAME);
}

// 2. Associar todas as equipes
let teamsUpdated = 0;
if (Array.isArray(db.teams)) {
  db.teams = db.teams.map(t => {
    if (t.unitId === UNIT_ID) return t;
    teamsUpdated++;
    return { ...t, unitId: UNIT_ID };
  });
}
console.log("Equipes atualizadas:", teamsUpdated, "de", db.teams?.length ?? 0);

// 3. Associar todos os usuários
let usersUpdated = 0;
if (Array.isArray(db.users)) {
  db.users = db.users.map(u => {
    if (u.unitId === UNIT_ID) return u;
    usersUpdated++;
    return { ...u, unitId: UNIT_ID };
  });
}
console.log("Usuários atualizados:", usersUpdated, "de", db.users?.length ?? 0);

// 4. Associar todos os pacientes
let patientsUpdated = 0;
if (Array.isArray(db.patients)) {
  db.patients = db.patients.map(p => {
    if (p.unitId === UNIT_ID) return p;
    patientsUpdated++;
    return { ...p, unitId: UNIT_ID };
  });
}
console.log("Pacientes atualizados:", patientsUpdated, "de", db.patients?.length ?? 0);

// 5. Salvar
await client.query(
  "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
  [JSON.stringify(db)]
);
console.log("\n✓ UBS Padrão configurada com sucesso. Faça redeploy no Render para recarregar o cache.");
await client.end();
