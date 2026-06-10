# Key Rotation SOP — PATIENT_LOOKUP_HASH_KEY

## When to use

When rotating `PATIENT_LOOKUP_HASH_KEY` in production (e.g., key compromise, periodic rotation policy).

If the key is rotated without running this procedure, existing `cpf_hash`/`cns_hash` values in `app_patients` become stale — new patient writes use the new key, old rows keep hashes from the old key, silently breaking uniqueness enforcement.

---

## Steps (in order — do NOT skip)

### 1. Generate new key

```bash
openssl rand -hex 32
```

### 2. Deploy with new key

Set `PATIENT_LOOKUP_HASH_KEY=<new_key>` in the EB environment configuration.  
Do **not** remove the old key from any in-flight secrets store until step 7.  
Deploy and confirm the `server_started` log event appears in CloudWatch — instance is up.

### 3. Run dry-run rebuild

```
POST /admin/rebuild-patient-hashes?dryRun=true
Authorization: Bearer <valid_admin_JWT>
x-backup-key: <BACKUP_EXPORT_KEY>
```

Confirm the response shows the expected patient count and `dryRun: true`:

```json
{ "ok": true, "processed": 123, "updated": 123, "skipped": 0, "dryRun": true }
```

### 4. Run actual rebuild

```
POST /admin/rebuild-patient-hashes?dryRun=false
Authorization: Bearer <valid_admin_JWT>
x-backup-key: <BACKUP_EXPORT_KEY>
```

Monitor `hash_rebuild_progress` and `hash_rebuild_completed` events in CloudWatch Logs (search `hash_rebuild`).

Expected final log:

```json
{ "event": "hash_rebuild_completed", "processed": 123, "updated": 123, "skipped": 0, "dryRun": false }
```

If `skipped > 0`, inspect `hash_rebuild_row_error` events for individual patient failures before proceeding.

### 5. Verify uniqueness integrity

Connect to RDS and run:

```sql
SELECT cpf_hash, count(*) FROM app_patients
WHERE cpf_hash IS NOT NULL AND cpf_hash != ''
GROUP BY cpf_hash HAVING count(*) > 1;

SELECT cns_hash, count(*) FROM app_patients
WHERE cns_hash IS NOT NULL AND cns_hash != ''
GROUP BY cns_hash HAVING count(*) > 1;
```

Both queries must return 0 rows. If any duplicates appear, investigate before proceeding.

### 6. Recycle EB instances

Perform a rolling restart of all EB instances to ensure all in-memory state (e.g., the `PATIENT_LOOKUP_HASH_KEY` captured at startup in `db.js`) picks up the new key:

```bash
eb restart --environment <env-name>
```

Or trigger a rolling deployment from the EB console.

### 7. Verify end-to-end

Register a test patient and confirm:
- No duplicate detection false positives
- `app_patients` receives correct `cpf_hash`/`cns_hash` values

### 8. Retire old key material

Once verified, remove the old key from all secrets stores and rotation records.

---

## Rollback

If the rebuild fails or produces incorrect results before step 6:

1. Revert `PATIENT_LOOKUP_HASH_KEY` to the previous value in the EB environment.
2. Redeploy — the old hashes in `app_patients` are still valid with the old key.
3. The endpoint will return 409 if a rebuild is already in progress — wait for it to finish or restart the instance to clear the lock.

---

## Security notes

- The endpoint requires a valid authenticated session with `backup.export` capability AND the `x-backup-key` header matching `BACKUP_EXPORT_KEY`.
- In file-mode (no `DATABASE_URL`), the endpoint returns 400 — hashes are recomputed automatically on every `syncShadowTables` call and do not require a separate rebuild.
- All rebuild runs (dry or actual) are recorded in the audit log under action `admin.hash_rebuild`.
