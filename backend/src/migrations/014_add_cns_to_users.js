export const id = "014_add_cns_to_users";

// Rollback:
//   DROP INDEX IF EXISTS idx_app_users_cns;
//   ALTER TABLE app_users DROP COLUMN IF EXISTS cns;

export async function up(client) {
  // Gate: abort if any JSONB payload already has duplicate non-empty CNS values.
  // Protects against future unique constraint upgrade during F4.
  const dupes = await client.query(`
    SELECT payload->>'cns' AS cns, COUNT(*) AS cnt
    FROM app_users
    WHERE payload->>'cns' IS NOT NULL
      AND payload->>'cns' != ''
    GROUP BY payload->>'cns'
    HAVING COUNT(*) > 1
  `);

  if (dupes.rows.length > 0) {
    const list = dupes.rows.map((r) => `${r.cns} (${r.cnt}x)`).join(", ");
    throw new Error(
      `Migration 014 abortada: CNS duplicados encontrados no payload: ${list}. Corrija antes de prosseguir.`
    );
  }

  await client.query(`
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS cns VARCHAR(20) NOT NULL DEFAULT ''
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_users_cns ON app_users (cns)
    WHERE cns != ''
  `);
}
