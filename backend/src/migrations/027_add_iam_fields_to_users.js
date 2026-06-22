export const id = "027_add_iam_fields_to_users";

// Rollback:
//   ALTER TABLE app_users DROP COLUMN IF EXISTS force_password_change;
//   ALTER TABLE app_users DROP COLUMN IF EXISTS password_updated_at;
//   ALTER TABLE app_users DROP COLUMN IF EXISTS temporary_password_issued_at;
//   ALTER TABLE app_users DROP COLUMN IF EXISTS created_by_support;
//   ALTER TABLE app_users DROP COLUMN IF EXISTS created_by_user_id;
//   ALTER TABLE app_users DROP COLUMN IF EXISTS last_password_reset_at;
//   ALTER TABLE app_users DROP COLUMN IF EXISTS password_reset_by;

export async function up(client) {
  await client.query(`
    ALTER TABLE app_users
      ADD COLUMN IF NOT EXISTS force_password_change      BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS password_updated_at        TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS temporary_password_issued_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_by_support         BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS created_by_user_id         TEXT,
      ADD COLUMN IF NOT EXISTS last_password_reset_at     TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS password_reset_by          TEXT
  `);

  // Backfill: existing users already have a set password, so passwordUpdatedAt = createdAt
  await client.query(`
    UPDATE app_users
    SET password_updated_at = COALESCE((payload->>'createdAt')::timestamptz, NOW())
    WHERE password_updated_at IS NULL
  `);
}
