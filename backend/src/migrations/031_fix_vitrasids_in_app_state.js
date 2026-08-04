/**
 * Migration 031 — P0-3: Fix vitrasId em app_state.data.users
 *
 * Migration 030 adicionou vitrasId somente ao shadow table (app_users.payload).
 * Esta migration adiciona vitrasId diretamente em app_state.data.users, que é
 * a fonte autoritativa lida por readDb() em modo Postgres.
 *
 * Rollback: vitrasId é imutável — não remover.
 */
import crypto from "node:crypto";

export const id = "031_fix_vitrasids_in_app_state";

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
  // 1. Ler estado atual de app_state com lock exclusivo
  const { rows: stateRows } = await client.query(
    "SELECT data FROM app_state WHERE id = 1 FOR UPDATE"
  );

  if (!stateRows.length) {
    console.log("[031_fix_vitrasids_in_app_state] app_state vazio — skip.");
    return;
  }

  const state = stateRows[0].data || {};
  const users = Array.isArray(state.users) ? state.users : [];

  // 2. Coletar vitrasIds existentes (de app_state E de app_users shadow)
  const existingIds = new Set();
  for (const u of users) {
    if (u.vitrasId) existingIds.add(String(u.vitrasId));
  }

  // 3. Também coletar vitrasIds do shadow table para evitar colisões
  try {
    const { rows: shadowRows } = await client.query(
      "SELECT payload->>'vitrasId' AS vitras_id FROM app_users WHERE payload->>'vitrasId' IS NOT NULL AND payload->>'vitrasId' != ''"
    );
    for (const row of shadowRows) {
      if (row.vitras_id) existingIds.add(row.vitras_id);
    }
  } catch {
    // shadow table pode não existir em teste — ignorar
  }

  // 4. Atribuir vitrasId aos usuários que não têm
  let changed = 0;
  const updatedUsers = users.map(u => {
    if (u.vitrasId && String(u.vitrasId).trim()) return u;
    const vitrasId = generateUniqueVitrasId(existingIds);
    existingIds.add(vitrasId);
    changed++;
    console.log(`[031_fix_vitrasids_in_app_state] ${u.name || u.id} → vitrasId ${vitrasId}`);
    return { ...u, vitrasId, updatedAt: new Date().toISOString() };
  });

  if (changed === 0) {
    console.log("[031_fix_vitrasids_in_app_state] todos os usuários já têm vitrasId em app_state — skip.");
    return;
  }

  // 5. Salvar app_state atualizado
  const updatedState = { ...state, users: updatedUsers };
  await client.query(
    "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
    [JSON.stringify(updatedState)]
  );

  // 6. Sincronizar shadow table (atualizar apenas os usuários modificados)
  for (const u of updatedUsers) {
    if (!u.vitrasId) continue;
    try {
      await client.query(
        "UPDATE app_users SET payload = payload || $1::jsonb, updated_at = NOW() WHERE id = $2",
        [JSON.stringify({ vitrasId: u.vitrasId }), u.id]
      );
    } catch {
      // shadow table pode estar dessincronizada — não é fatal
    }
  }

  console.log(`[031_fix_vitrasids_in_app_state] ${changed} usuário(s) migrado(s) em app_state.`);
}

export async function down(_client) {
  // vitrasId é imutável — não remover em rollback
  console.log("[031_fix_vitrasids_in_app_state] rollback: vitrasId é imutável — operação ignorada.");
}
