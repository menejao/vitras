export const id = "027_add_iam_fields_to_users";

// Rollback:
//   ALTER TABLE app_users DROP COLUMN IF EXISTS force_password_change;
//   ALTER TABLE app_users DROP COLUMN IF EXISTS password_updated_at;
//   ALTER TABLE app_users DROP COLUMN IF EXISTS temporary_password_issued_at;
//   ALTER TABLE app_users DROP COLUMN IF EXISTS created_by_support;

export async function up(client) {
  await client.query(`
    ALTER TABLE app_users
      ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS password_updated_at   TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS temporary_password_issued_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_by_support    BOOLEAN NOT NULL DEFAULT false
  `);

  // Backfill: existing users already have a set password, so passwordUpdatedAt = createdAt
  await client.query(`
    UPDATE app_users
    SET password_updated_at = COALESCE((payload->>'createdAt')::timestamptz, NOW())
    WHERE password_updated_at IS NULL
  `);
}
