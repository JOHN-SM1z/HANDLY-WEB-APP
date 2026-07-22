#!/usr/bin/env bash
# Handly — Postgres backup (Batch 4).
#
# Usage: infra/scripts/backup.sh [output-dir]
# Reads DATABASE_URL from the environment (or the root .env if not already
# set) — same source of truth every other script in this repo uses.
#
# Produces a timestamped, custom-format pg_dump (-Fc): compressed, and the
# only format pg_restore can do selective/parallel restores from — a plain
# SQL dump is NOT enough for the restore-verification procedure in
# docs/runbooks/backup-restore.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/backups}"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$ROOT_DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a; source "$ROOT_DIR/.env"; set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (checked environment and $ROOT_DIR/.env)" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$OUT_DIR/handly-$TIMESTAMP.dump"

echo "Backing up to $DEST ..."
pg_dump "$DATABASE_URL" -Fc -f "$DEST"

SIZE="$(du -h "$DEST" | cut -f1)"
echo "Done: $DEST ($SIZE)"

# Retention: keep the last 14 daily dumps in this directory by default — a
# real deployment should also ship this file off-box (S3/GCS/etc.) before
# pruning; this script only manages the local copy's lifetime. Portable
# (no GNU-only `xargs -r`) since this may run on either Linux or macOS.
KEEP=14
OLD_DUMPS="$(ls -1t "$OUT_DIR"/handly-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) || true)"
if [ -n "$OLD_DUMPS" ]; then
  echo "$OLD_DUMPS" | while IFS= read -r f; do rm -v -- "$f"; done
fi
