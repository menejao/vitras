export const id = "024_create_ciap2";

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ciap2 (
      code         VARCHAR(5)   PRIMARY KEY,
      description  VARCHAR(300) NOT NULL,
      chapter      CHAR(1)      NOT NULL,
      chapter_name VARCHAR(100),
      component    SMALLINT,
      active       BOOLEAN      NOT NULL DEFAULT true,
      updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_ciap2_chapter ON ciap2 (chapter)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ciap2_active  ON ciap2 (active) WHERE active = true`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ciap2_desc_fts
    ON ciap2 USING gin(to_tsvector('portuguese', description))
  `);
}
