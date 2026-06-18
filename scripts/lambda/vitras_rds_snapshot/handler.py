import boto3
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger()
logger.setLevel(logging.INFO)

DB_INSTANCE = "vitras-drill-restore"
SNAPSHOT_PREFIX = "vitras-auto"
RETENTION_DAYS = 7
REGION = "sa-east-1"
TAGS = [
    {"Key": "Project", "Value": "VITRAS"},
    {"Key": "Type", "Value": "AutomatedManualSnapshot"},
    {"Key": "Environment", "Value": "staging"},
]


def handler(event, context):
    rds = boto3.client("rds", region_name=REGION)
    now = datetime.now(timezone.utc)
    snapshot_id = f"{SNAPSHOT_PREFIX}-{now.strftime('%Y%m%d-%H%M')}"

    logger.info("Creating snapshot: %s for %s", snapshot_id, DB_INSTANCE)

    response = rds.create_db_snapshot(
        DBSnapshotIdentifier=snapshot_id,
        DBInstanceIdentifier=DB_INSTANCE,
        Tags=TAGS,
    )
    created_id = response["DBSnapshot"]["DBSnapshotIdentifier"]
    status = response["DBSnapshot"]["Status"]
    logger.info("Snapshot initiated: %s status=%s", created_id, status)

    # Cleanup: delete vitras-auto-* snapshots older than RETENTION_DAYS
    cutoff = now - timedelta(days=RETENTION_DAYS)
    paginator = rds.get_paginator("describe_db_snapshots")
    pages = paginator.paginate(
        DBInstanceIdentifier=DB_INSTANCE,
        SnapshotType="manual",
    )
    deleted = []
    for page in pages:
        for snap in page["DBSnapshots"]:
            sid = snap["DBSnapshotIdentifier"]
            if not sid.startswith(SNAPSHOT_PREFIX + "-"):
                continue
            created_at = snap["SnapshotCreateTime"]
            if created_at.replace(tzinfo=timezone.utc) < cutoff:
                logger.info("Deleting expired snapshot: %s (created %s)", sid, created_at)
                rds.delete_db_snapshot(DBSnapshotIdentifier=sid)
                deleted.append(sid)

    logger.info("Done. created=%s deleted=%s", created_id, deleted)
    return {
        "statusCode": 200,
        "created": created_id,
        "snapshotStatus": status,
        "deleted": deleted,
        "retentionDays": RETENTION_DAYS,
    }
