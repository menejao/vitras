# DATA_ENCRYPTION_KEY Rotation Plan

## When to rotate

- Suspected key exposure (team member departure, secret leak, audit finding)
- Regulatory review requiring key change (LGPD Article 46)
- Scheduled annual rotation (recommended practice)

## Affected fields

| Collection | Fields |
|---|---|
| `patients` | `cpf`, `cns`, `cnsCpf` |
| `users` | `twoFactorSecret`, `twoFactorPendingSecret` |

Format: `enc1:<iv_base64>:<ciphertext_base64>:<gcm_tag_base64>` (AES-256-GCM)

## Pre-rotation checklist

- [ ] Generate new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Store new key in Render/Doppler/Vault **before** running the script
- [ ] Schedule maintenance window (brief downtime recommended for file driver)
- [ ] Take a manual backup: `curl -H "x-backup-key: $BACKUP_EXPORT_KEY" $API_URL/admin/backup/export > pre-rotation-backup.json`
- [ ] Test rotation against backup copy with `--dry-run` first

## Rotation steps

### File driver

```bash
# 1. Dry-run — verify counts, no write
OLD_DATA_ENCRYPTION_KEY=<old> NEW_DATA_ENCRYPTION_KEY=<new> \
  node scripts/rotate-encryption-key.js --dry-run

# 2. Stop the API (prevent concurrent writes during rotation)
# 3. Run rotation
OLD_DATA_ENCRYPTION_KEY=<old> NEW_DATA_ENCRYPTION_KEY=<new> \
  node scripts/rotate-encryption-key.js

# 4. Update DATA_ENCRYPTION_KEY on Render to the new value
# 5. Restart the API
# 6. Verify: POST /auth/login, then GET /patients — check CPF decrypts correctly
```

The script creates `db.json.bak.<timestamp>` automatically before writing.

### Postgres driver (Neon)

```bash
OLD_DATA_ENCRYPTION_KEY=<old> NEW_DATA_ENCRYPTION_KEY=<new> \
  DATABASE_URL="postgres://..." \
  node scripts/rotate-encryption-key.js [--dry-run]
```

No downtime required for Postgres — the UPDATE is atomic. However:
- Neon free tier pauses after 5 min inactivity; ensure the instance is awake before running.
- Rotation reads and rewrites the entire JSONB blob in one transaction. With 1 250 patients this takes < 1 s.

## Post-rotation checklist

- [ ] Update `DATA_ENCRYPTION_KEY` env var in Render dashboard
- [ ] Redeploy service
- [ ] Smoke test: login + view patient CPF/CNS in UI
- [ ] Confirm old key is revoked in secret manager
- [ ] Record rotation date in this file under [Rotation log](#rotation-log)
- [ ] Shred `pre-rotation-backup.json`

## Rotation log

| Date | Reason | Rotated by |
|---|---|---|
| _pending_ | Initial production deploy | — |
