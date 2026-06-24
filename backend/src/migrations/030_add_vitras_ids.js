import crypto from "node:crypto";

export const id = "030_add_vitras_ids";

function generateUniqueVitrasId(existingIds) {
  let attempts = 0;
  while (attempts < 200) {
    const candidate = String(100000000 + crypto.randomInt(0, 900000000));
    if (!existingIds.has(candidate)) return candidate;
    attempts++;
  }
  throw new Error("Impossível gerar vitrasId único após 200 tentativas");
}

export async function up(client) {
  const { rows } = await client.query(
    "SELECT id, payload FROM app_users WHERE payload->>'vitrasId' IS NULL OR payload->>'vitrasId' = '' ORDER BY created_at ASC NULLS LAST"
  );

  if (rows.length === 0) {
    console.log("[003_add_vitras_ids] todos os usuários já possuem vitrasId — skip.");
    return;
  }

  const existingRes = await client.query(
    "SELECT payload->>'vitrasId' AS vitras_id FROM app_users WHERE payload->>'vitrasId' IS NOT NULL AND payload->>'vitrasId' != ''"
  );
  const existingIds = new Set(existingRes.rows.map(r => r.vitras_id));

  for (const row of rows) {
    const vitrasId = generateUniqueVitrasId(existingIds);
    existingIds.add(vitrasId);
    await client.query(
      "UPDATE app_users SET payload = payload || $1::jsonb, updated_at = NOW() WHERE id = $2",
      [JSON.stringify({ vitrasId }), row.id]
    );
    const name = (row.payload || {}).name || row.id;
    console.log(`[003_add_vitras_ids] ${name} → vitrasId ${vitrasId}`);
  }

  console.log(`[003_add_vitras_ids] ${rows.length} usuário(s) migrado(s).`);
}

export async function down(_client) {
  // vitrasId é imutável — não remover em rollback
}
