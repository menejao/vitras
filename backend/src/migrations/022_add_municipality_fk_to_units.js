// Runs AFTER seed-municipalities.mjs confirms municipalities table has data.
// Safe because: (1) migration 021 creates the table; (2) seed populates it;
// (3) app_units.municipality_id was backfilled to '3534401' in migration 010,
// which exists in the municipalities dataset.
//
// DO NOT include this migration in index.js until seed-municipalities.mjs
// has been executed and COUNT(*) FROM municipalities >= 5570 is confirmed.
export const id = "022_add_municipality_fk_to_units";

export async function up(client) {
  // Guard: refuse to run if reference table is empty (would corrupt app_units inserts)
  const { rows } = await client.query("SELECT COUNT(*)::int AS cnt FROM municipalities");
  const cnt = rows[0]?.cnt ?? 0;
  if (cnt < 100) {
    throw new Error(
      `022_add_municipality_fk_to_units: municipalities table has ${cnt} rows — run seed-municipalities.mjs first`
    );
  }

  // Fix any rows with empty municipality_id (can occur if unit was created before migration 010 backfill)
  const { rowCount: fixed } = await client.query(`
    UPDATE app_units SET municipality_id = '3534401' WHERE municipality_id = '' OR municipality_id IS NULL
  `);
  if (fixed > 0) {
    console.log(`022: fixed ${fixed} app_units row(s) with empty municipality_id → '3534401'`);
  }

  await client.query(`
    ALTER TABLE app_units
      ADD CONSTRAINT fk_app_units_municipality_id
      FOREIGN KEY (municipality_id)
      REFERENCES municipalities (ibge_code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID
  `);

  // Validate existing rows without locking the table
  await client.query(`
    ALTER TABLE app_units VALIDATE CONSTRAINT fk_app_units_municipality_id
  `);
}
