-- Safe indexes for shadow tables — idempotent (IF NOT EXISTS)
-- Run once against the Neon Postgres database.

-- app_users: lookups by email (login), id, team, role
CREATE INDEX IF NOT EXISTS idx_app_users_email   ON app_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_app_users_team_id  ON app_users (team_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role     ON app_users (role);

-- app_patients: lookups by team, ACS, category
CREATE INDEX IF NOT EXISTS idx_app_patients_team_id      ON app_patients (team_id);
CREATE INDEX IF NOT EXISTS idx_app_patients_assigned_acs ON app_patients (assigned_acs_id);
CREATE INDEX IF NOT EXISTS idx_app_patients_category     ON app_patients (care_category);

-- app_appointments: lookups by patient
CREATE INDEX IF NOT EXISTS idx_app_appointments_patient ON app_appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_app_appointments_team    ON app_appointments (team_id);

-- app_refresh_tokens: lookups by user, token value, session
CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_user_id    ON app_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_token_hash ON app_refresh_tokens (token_hash);

-- app_audit_logs: lookups by actor, resource, timestamp
CREATE INDEX IF NOT EXISTS idx_app_audit_logs_actor_id  ON app_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_app_audit_logs_team_id   ON app_audit_logs (team_id);
CREATE INDEX IF NOT EXISTS idx_app_audit_logs_created   ON app_audit_logs (created_at DESC);
