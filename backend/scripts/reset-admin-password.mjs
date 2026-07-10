import pg from "pg";
const { hashPassword } = await import("../src/services/crypto.js");

const NEW_PASSWORD = "Vitras@2026!";
const VITRAS_ID = "454670590";

const url = (process.env.DATABASE_URL || "").replace(/[?&]channel_binding=[^&]*/g, "").replace(/[?&]sslmode=[^&]*/g, "");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const r = await client.query("SELECT data FROM app_state WHERE id = 1");
const db = r.rows[0].data;
const user = db.users.find(u => String(u.vitrasId || "") === VITRAS_ID);
if (!user) { console.error("Usuário não encontrado"); process.exit(1); }

user.password = hashPassword(NEW_PASSWORD);
user.forcePasswordChange = false;

await client.query("UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1", [JSON.stringify(db)]);
console.log("Senha resetada com sucesso!");
console.log("  vitrasId:", VITRAS_ID);
console.log("  senha   :", NEW_PASSWORD);
await client.end();
