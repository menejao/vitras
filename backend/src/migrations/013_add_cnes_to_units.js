export const id = "013_add_cnes_to_units";

// Rollback:
//   DROP INDEX IF EXISTS idx_app_units_cnes;
//   ALTER TABLE app_units DROP COLUMN IF EXISTS cnes;

export async function up(client) {
  // Gate: abort if any JSONB payload already has duplicate non-empty CNES values.
  // Protects against future unique constraint upgrade during F4.
  const dupes = await client.query(`
    SELECT payload->>'cnes' AS cnes, COUNT(*) AS cnt
    FROM app_units
    WHERE payload->>'cnes' IS NOT NULL
      AND payload->>'cnes' != ''
    GROUP BY payload->>'cnes'
    HAVING COUNT(*) > 1
  `);

  if (dupes.rows.length > 0) {
    const list = dupes.rows.map((r) => `${r.cnes} (${r.cnt}x)`).join(", ");
    throw new Error(
      `Migration 013 abortada: CNES duplicados encontrados no payload: ${list}. Corrija antes de prosseguir.`
    );
  }

  await client.query(`
    ALTER TABLE app_units ADD COLUMN IF NOT EXISTS cnes VARCHAR(7) NOT NULL DEFAULT ''
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_units_cnes ON app_units (cnes)
    WHERE cnes != ''
  `);
}
