# Backup & Restore Runbook (Batch 4)

## Backup

`infra/scripts/backup.sh [output-dir]` — runs `pg_dump -Fc` (custom format:
compressed, supports selective/parallel restore) against `DATABASE_URL`,
writes a timestamped `.dump` file to `backups/` by default, and prunes
anything past the last 14 dumps in that directory.

**Schedule this** via cron/systemd-timer/your platform's scheduled-job
feature — nothing in this repo runs it automatically. Recommended: daily,
plus one retained off-box copy (S3/GCS/etc.) per dump — `backup.sh` only
manages the local file's lifetime, it does not upload anywhere.

```bash
# Example cron line (daily at 03:00, ship to S3 immediately after):
0 3 * * * /path/to/handly/infra/scripts/backup.sh /path/to/handly/backups \
  && aws s3 cp /path/to/handly/backups/handly-$(date -u +\%Y\%m\%dT*Z).dump s3://your-bucket/handly-backups/
```

## Restore verification procedure

**Never restore directly into production to "test" a backup.** The
procedure below restores into a throwaway database and checks it, which is
the only way to actually know a backup is good before you need it for real.

1. Spin up a scratch Postgres (a second container, or a temporary database
   on the same instance — must have the `postgis` extension available,
   matching `infra/docker/docker-compose.yml`'s image):
   ```bash
   docker run -d --name handly-restore-check -p 5433:5432 \
     -e POSTGRES_USER=handly -e POSTGRES_PASSWORD=handly_dev_pw -e POSTGRES_DB=handly \
     postgis/postgis:16-3.4
   ```
2. Restore the dump into it:
   ```bash
   infra/scripts/restore.sh backups/handly-<timestamp>.dump \
     "postgresql://handly:handly_dev_pw@localhost:5433/handly?schema=public"
   ```
3. Verify real data landed, not just an empty schema:
   ```bash
   psql "postgresql://handly:handly_dev_pw@localhost:5433/handly" -c "
     SELECT
       (SELECT count(*) FROM users) AS users,
       (SELECT count(*) FROM orders) AS orders,
       (SELECT count(*) FROM payments) AS payments,
       (SELECT count(*) FROM audit_logs) AS audit_logs;
   "
   ```
   Compare these counts against what you expect from the source database at
   backup time (even an approximate "not zero, not obviously truncated" check
   catches the most common failure mode: a dump that silently only captured
   part of the database).
4. Verify the PostGIS-dependent generated columns survived (a real gap this
   project has hit before with migration diffs — see CLAUDE.md's known
   migration-artifact issue):
   ```bash
   psql "postgresql://handly:handly_dev_pw@localhost:5433/handly" -c "\d orders" | grep -i gist
   ```
   Expect to see `orders_location_gist`. If it's missing, the restore is
   incomplete — do not trust this backup.
5. Tear down the scratch container:
   ```bash
   docker rm -f handly-restore-check
   ```

**Run this procedure at least once a month** against your most recent real
backup, not just once at launch — a backup that was good on day one can
silently start failing (disk full during dump, credential rotation breaking
the cron job, etc.) with nothing but the restore test itself to catch it.

## What this does NOT cover

- Redis is not backed up by this procedure — BullMQ job state is designed to
  be re-derivable/lossy-tolerant (see `docs/runbooks/disaster-recovery.md`'s
  "Redis recovery" section), not a system of record. Nothing here restores
  in-flight dispatch offers after a Redis loss; the dispatch/offer-expiry
  design already treats a lost job as a rare, bounded-impact event (Batch 2's
  BullMQ retry/backoff addition narrows this further, not eliminates it).
- Uploaded media (`UPLOAD_DIR`, LocalDiskStorage) is a plain filesystem/volume
  — back it up with your normal volume/disk snapshot tooling, not this script.
