export const id = "023_create_cid10";

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS cid10 (
      code         VARCHAR(8)   PRIMARY KEY,
      description  VARCHAR(500) NOT NULL,
      chapter      VARCHAR(5),
      block_start  VARCHAR(8),
      block_end    VARCHAR(8),
      is_billable  BOOLEAN      NOT NULL DEFAULT true,
      active       BOOLEAN      NOT NULL DEFAULT true,
      version      VARCHAR(10)  NOT NULL DEFAULT '10',
      updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_cid10_chapter ON cid10 (chapter)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_cid10_active  ON cid10 (active) WHERE active = true`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cid10_desc_fts
    ON cid10 USING gin(to_tsvector('portuguese', description))
  `);
}
