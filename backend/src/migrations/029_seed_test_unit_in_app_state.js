/**
 * Migration 029: Seed test-unit into app_state.units (canonical source).
 *
 * Migration 028 inserted test-unit into app_units shadow table only.
 * syncShadowTables() rebuilds app_units from app_state.units on every withDb() call,
 * so direct shadow table inserts are wiped. The canonical source is app_state.units.
 *
 * This migration upserts the test-unit and test-team entries into the app_state
 * JSONB so they survive every subsequent withDb() call.
 *
 * Idempotent: checks by id before inserting.
 */
export const id = "029_seed_test_unit_in_app_state";

export async function up(client) {
  const stateRes = await client.query("SELECT data FROM app_state WHERE id = 1");
  if (!stateRes.rows.length) return; // app_state not initialized — skip

  const db = stateRes.rows[0].data;
  const now = new Date().toISOString();

  if (!Array.isArray(db.units)) db.units = [];
  if (!Array.isArray(db.teams)) db.teams = [];

  // Upsert test-unit
  const unitIdx = db.units.findIndex((u) => u.id === "test-unit");
  const testUnit = {
    id: "test-unit",
    name: "UBS Teste VITRAS",
    cnes: "0000000",
    municipalityId: "3534401",
    municipalityName: "São Paulo",
    uf: "SP",
    contactEmail: "",
    phone: "",
    status: "onboarding",
    createdBy: "system-migration",
    createdAt: now,
    updatedAt: now
  };
  if (unitIdx < 0) {
    db.units.push(testUnit);
  } else {
    // Preserve existing, just ensure required fields present
    db.units[unitIdx] = { ...testUnit, ...db.units[unitIdx] };
  }

  // Upsert test-team
  const teamIdx = db.teams.findIndex((t) => t.id === "test-team");
  const testTeam = {
    id: "test-team",
    name: "Equipe Teste VITRAS",
    unitId: "test-unit",
    ine: "0000000000",
    tipoEquipe: "ESF",
    managerUserId: "",
    createdAt: now,
    updatedAt: now
  };
  if (teamIdx < 0) {
    db.teams.push(testTeam);
  } else {
    db.teams[teamIdx] = { ...testTeam, ...db.teams[teamIdx] };
  }

  await client.query(
    "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
    [JSON.stringify(db)]
  );
}

export async function down(client) {
  const stateRes = await client.query("SELECT data FROM app_state WHERE id = 1");
  if (!stateRes.rows.length) return;
  const db = stateRes.rows[0].data;
  if (Array.isArray(db.units)) {
    db.units = db.units.filter((u) => u.id !== "test-unit");
  }
  if (Array.isArray(db.teams)) {
    db.teams = db.teams.filter((t) => t.id !== "test-team");
  }
  await client.query(
    "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
    [JSON.stringify(db)]
  );
}
