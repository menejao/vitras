import pg from "pg";
import crypto from "node:crypto";
import { randomUUID } from "node:crypto";

const { hashPassword } = await import("../src/services/crypto.js");

const PASSWORD = "Vitras@Console2026!";
const VITRAS_ID = "900000001";
const NAME = "Console Admin";
const ROLE = "support_admin";

function stripSslParams(url) {
  try {
    const u = new URL(url);
    ["sslmode","sslcert","sslkey","sslrootcert","sslpassword","channel_binding"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return url; }
}

const url = stripSslParams(process.env.DATABASE_URL || "");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const r = await client.query("SELECT data FROM app_state WHERE id = 1");
const db = r.rows[0].data;

const existing = db.users?.find(u => String(u.vitrasId) === VITRAS_ID);
if (existing) {
  // reset password only
  existing.password = hashPassword(PASSWORD);
  existing.forcePasswordChange = false;
  await client.query("UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1", [JSON.stringify(db)]);
  console.log("Senha resetada para usuário existente:", VITRAS_ID);
} else {
  const nowIso = new Date().toISOString();
  const userId = randomUUID();
  const payload = {
    id: userId,
    vitrasId: VITRAS_ID,
    name: NAME,
    email: "console@vitras.local",
    role: ROLE,
    password: hashPassword(PASSWORD),
    unitId: "",
    teamId: "",
    municipalityId: "",
    forcePasswordChange: false,
    passwordUpdatedAt: nowIso,
    temporaryPasswordIssuedAt: null,
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  if (!Array.isArray(db.users)) db.users = [];
  db.users.push(payload);
  await client.query("UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1", [JSON.stringify(db)]);
  console.log("Usuário criado!");
}

console.log("  vitrasId:", VITRAS_ID);
console.log("  senha   :", PASSWORD);
console.log("  role    :", ROLE);
await client.end();
