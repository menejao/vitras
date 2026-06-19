export const id = "015_create_app_households";

// Rollback:
//   DROP TABLE IF EXISTS app_households;

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_households (
      id            VARCHAR(100) PRIMARY KEY,
      patient_id    VARCHAR(100) NOT NULL DEFAULT '',
      team_id       VARCHAR(100) NOT NULL DEFAULT '',
      family_code   VARCHAR(50)  NOT NULL DEFAULT '',
      housing_type  VARCHAR(100) NOT NULL DEFAULT '',
      water_supply  VARCHAR(100) NOT NULL DEFAULT '',
      sewage        VARCHAR(100) NOT NULL DEFAULT '',
      garbage       VARCHAR(100) NOT NULL DEFAULT '',
      electricity   VARCHAR(100) NOT NULL DEFAULT '',
      home_visit_freq VARCHAR(50) NOT NULL DEFAULT '',
      payload       JSONB        NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ,
      updated_at    TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_households_patient_id
      ON app_households (patient_id)
      WHERE patient_id != ''
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_households_team_id
      ON app_households (team_id)
      WHERE team_id != ''
  `);
}
