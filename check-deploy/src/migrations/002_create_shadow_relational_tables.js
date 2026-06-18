export const id = "002_create_shadow_relational_tables";

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      inactive BOOLEAN NOT NULL DEFAULT FALSE,
      two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NULL,
      updated_at TIMESTAMPTZ NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_users_team_id ON app_users (team_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users (role)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS app_refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      token_hash TEXT NOT NULL DEFAULT '',
      scope_team_id TEXT NOT NULL DEFAULT '',
      revoked_at TIMESTAMPTZ NULL,
      expires_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_user_id ON app_refresh_tokens (user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_token_hash ON app_refresh_tokens (token_hash)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_revoked_at ON app_refresh_tokens (revoked_at)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS app_audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT '',
      entity TEXT NOT NULL DEFAULT '',
      entity_id TEXT NOT NULL DEFAULT '',
      team_id TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_audit_logs_created_at ON app_audit_logs (created_at DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_audit_logs_action ON app_audit_logs (action)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_audit_logs_category ON app_audit_logs (category)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_audit_logs_team_id ON app_audit_logs (team_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_app_audit_logs_entity ON app_audit_logs (entity, entity_id)`);
}
