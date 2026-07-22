# Migration Verification Checklist (Batch 4)

Every migration in this repo so far (M3 onward) has hit the same recurring
issue: Prisma's diff engine doesn't know `orders.location` and
`service_areas.centerPoint` are hand-written generated columns (see
`schema.prisma`'s `Unsupported("geography(Point, 4326)")` fields), so
`prisma migrate dev` regenerates a spurious `DROP INDEX` / `ALTER COLUMN
DROP DEFAULT` diff for them on **every** new migration. This checklist
exists so that never reaches production.

## Before running `pnpm db:migrate` against anything but a throwaway dev DB

- [ ] Open the generated `migration.sql` and check for any of:
  - `DROP INDEX "orders_location_gist"` / `DROP INDEX "service_areas_center_point_gist"`
  - `ALTER TABLE "orders" ALTER COLUMN "location" DROP DEFAULT`
  - `ALTER TABLE "service_areas" ALTER COLUMN "centerPoint" DROP DEFAULT`
  If present, **delete those lines** — they're the known Prisma-diff
  artifact, not an intended change. Every prior migration in this repo's
  history had these hand-stripped; grep the migrations folder for
  `centerPoint` if you want to see the pattern.
- [ ] After stripping, re-read the full `migration.sql` top to bottom. Does
      every statement match what you actually intended to change? A stray
      unrelated `DROP`/`ALTER` here is the single most common way this class
      of migration silently corrupts geo search in production.
- [ ] Does this migration add a `NOT NULL` column to a table that already
      has rows, with no `DEFAULT`? That's a hard failure against real data —
      either add a default or make the column nullable + backfill separately.
- [ ] Does it drop a column or table? Confirm nothing in the current
      codebase still reads it (`grep -rn "<column/table name>" apps/ packages/`).
      A column that's merely *unused* going forward is safe to keep for one
      release and drop in the next; dropping something still read is a
      guaranteed runtime error.
- [ ] Run it against a **copy of production data**, not just an empty dev DB,
      at least once before it ships — an empty dev database will never
      surface a lock-contention or long-running-migration problem a
      populated table will.
- [ ] For any migration touching a large/hot table (`orders`, `payments`,
      `audit_logs`): does it take an `ACCESS EXCLUSIVE` lock for longer than
      you're comfortable with in production? (`CREATE INDEX CONCURRENTLY`
      instead of a plain index add is the usual fix — Prisma doesn't generate
      this automatically; hand-edit the migration if the table is large.)
- [ ] After applying, run the exact verification query from this project's
      own migration history: confirm both GIST indexes are still present —
      ```bash
      psql "$DATABASE_URL" -c "\d orders" | grep -i gist
      psql "$DATABASE_URL" -c "\d service_areas" | grep -i gist
      ```
- [ ] `pnpm --filter @handly/api test` still passes 100% after the migration
      is applied (not just typechecks — the DB-touching integration tests are
      what actually exercise the new/changed schema).

## Applying to production

- [ ] Use `prisma migrate deploy` (via `pnpm db:deploy`), never
      `prisma migrate dev`, against a real environment — `dev` can prompt
      interactively or reset the database in ways `deploy` never will.
- [ ] Take a fresh backup immediately before applying (`infra/scripts/backup.sh`)
      — a migration is exactly the moment you most want a same-minute
      rollback point, not last night's.
- [ ] Have the rollback plan ready *before* running: for an additive
      migration (new table/column), rollback is usually "do nothing, ship a
      fix-forward migration." For anything destructive (dropped column,
      changed type), the rollback plan is "restore the pre-migration backup"
      — know that going in, don't figure it out after something breaks. See
      `docs/runbooks/disaster-recovery.md`.
