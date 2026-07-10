const { Client } = require("pg");

const DB_URL = process.argv[2];
if (!DB_URL) {
  console.error("Usage: node inject-admin.js <DATABASE_URL>");
  process.exit(1);
}

const newUser = {
  id: "seed-breakglass-admin",
  vitrasId: "999000001",
  name: "Admin Bootstrap",
  email: "admin@vitras.internal",
  role: "break_glass_admin",
  password: "s1$e29976c02ddfc2792809228d971751f0$017cb8ae4baa3c2c5b0d95867e3577ef4e309deed7920b7f50cffedf0f51a0c8f9febaba5edcef5c1abfb47abaaed3d4260eb5023d0dc6f8435c07d9815a9f2f",
  forcePasswordChange: false,
};

async function main() {
  console.log("DB_URL:", DB_URL);
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check if user already exists
  const check = await client.query(
    "SELECT data->'users' @> $1::jsonb as exists FROM app_state WHERE id=1",
    [JSON.stringify([{ id: newUser.id }])]
  );
  if (check.rows[0]?.exists) {
    console.log("User already exists, removing old entry first...");
    await client.query(`
      UPDATE app_state
      SET data = jsonb_set(
        data,
        '{users}',
        (SELECT jsonb_agg(u) FROM jsonb_array_elements(data->'users') u WHERE u->>'id' != $1)
      )
      WHERE id = 1
    `, [newUser.id]);
  }

  const result = await client.query(`
    UPDATE app_state
    SET data = jsonb_set(
      data,
      '{users}',
      data->'users' || $1::jsonb
    )
    WHERE id = 1
    RETURNING (data->'users' @> $1::jsonb) as ok
  `, [JSON.stringify([newUser])]);

  console.log("Update result:", result.rows[0]);

  // Verify
  const verify = await client.query(
    "SELECT u->>'role' as role, u->>'vitrasId' as id FROM app_state, jsonb_array_elements(data->'users') u WHERE app_state.id=1 AND u->>'id'='seed-breakglass-admin'"
  );
  console.log("Verified user:", verify.rows[0]);

  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
