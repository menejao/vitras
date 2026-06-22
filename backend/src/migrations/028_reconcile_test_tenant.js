export const id = "028_reconcile_test_tenant";

export async function up(client) {
  // Create test-unit in app_units if not exists.
  // Only inserts columns that are confirmed to exist in the schema (004, 010, 013).
  // Columns uf, status, contact_email, phone, municipality_name are not yet in the
  // relational schema — they live in payload JSONB or in the JSON file DB used by
  // platform.js. Do not reference them here.
  await client.query(`
    INSERT INTO app_units (id, name, cnes, municipality_id, created_at, updated_at)
    VALUES ('test-unit', 'UBS Teste VITRAS', '0000000', '3534401', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      cnes = EXCLUDED.cnes,
      municipality_id = EXCLUDED.municipality_id,
      updated_at = NOW()
  `);

  // Create test-team in app_teams if table exists (shadow table may not exist yet — handle gracefully)
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'app_teams') THEN
        INSERT INTO app_teams (id, name, unit_id, ine, tipo_equipe, created_at, updated_at)
        VALUES ('test-team', 'Equipe Teste VITRAS', 'test-unit', '0000000000', 'ESF', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          unit_id = EXCLUDED.unit_id,
          updated_at = NOW();
      END IF;
    END $$;
  `);

  // Update any app_users without unit_id to test-unit
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='app_users' AND column_name='unit_id') THEN
        UPDATE app_users SET unit_id = 'test-unit', updated_at = NOW()
        WHERE unit_id IS NULL OR unit_id = '' OR unit_id = 'unit-default';
      END IF;
    END $$;
  `);

  // Update app_users without team_id (non-platform roles)
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='app_users' AND column_name='team_id') THEN
        UPDATE app_users SET team_id = 'test-team', updated_at = NOW()
        WHERE team_id IS NULL OR team_id = '' OR team_id = 'team-default';
      END IF;
    END $$;
  `);
}
