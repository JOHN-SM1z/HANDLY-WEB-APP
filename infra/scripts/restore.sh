#!/usr/bin/env bash
# Handly — Postgres restore (Batch 4).
#
# Usage: infra/scripts/restore.sh <dump-file> [target-database-url]
#
# SAFETY: this restores INTO whatever DATABASE_URL/target-database-url
# points at, dropping conflicting objects along the way (pg_restore -c).
# Never point this at a live production database directly — restore into a
# fresh/scratch database first and verify (see docs/runbooks/backup-restore.md
# "Restore verification procedure"), then cut over deliberately.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

DUMP_FILE="${1:-}"
TARGET_URL="${2:-${DATABASE_URL:-}}"

if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
  echo "Usage: $0 <dump-file> [target-database-url]" >&2
  exit 1
fi

if [ -z "$TARGET_URL" ] && [ -f "$ROOT_DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a; source "$ROOT_DIR/.env"; set +a
  TARGET_URL="${DATABASE_URL:-}"
fi

if [ -z "$TARGET_URL" ]; then
  echo "No target database URL (pass as \$2, set DATABASE_URL, or have a root .env)" >&2
  exit 1
fi

echo "About to restore:"
echo "  dump:   $DUMP_FILE"
echo "  target: $TARGET_URL"
read -r -p "Type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

# -c: drop existing objects before recreating (clean restore into a database
# that may already have the schema). --if-exists avoids errors on a truly
# empty target. -1: single transaction — an interrupted restore rolls back
# completely rather than leaving a half-restored, silently-broken database.
pg_restore -d "$TARGET_URL" -c --if-exists -1 -v "$DUMP_FILE"

echo "Restore complete. Now run the verification procedure in docs/runbooks/backup-restore.md before trusting this data."
