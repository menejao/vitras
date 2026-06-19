export const id = "021_create_municipalities";

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS municipalities (
      ibge_code    CHAR(7)      PRIMARY KEY,
      name         VARCHAR(100) NOT NULL,
      uf           CHAR(2)      NOT NULL,
      region       VARCHAR(20),
      is_capital   BOOLEAN      NOT NULL DEFAULT false,
      active       BOOLEAN      NOT NULL DEFAULT true,
      ibge_version VARCHAR(10),
      updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_municipalities_uf     ON municipalities (uf)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_municipalities_active  ON municipalities (active) WHERE active = true`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_municipalities_name_fts
    ON municipalities USING gin(to_tsvector('portuguese', name))
  `);
}
