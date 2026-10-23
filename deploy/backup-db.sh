#!/usr/bin/env bash
# Scheduled / pre-release Postgres dump for Keyafe.
# Cron: /var/www/keyafe/current/deploy/backup-db.sh
# Release: MODE=pre-release APP_VERSION=vX.Y.Z /path/to/backup-db.sh
set -euo pipefail

MODE="${MODE:-scheduled}"
APP_ROOT="${APP_ROOT:-/var/www/keyafe}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/shared/.env}"
UPLOAD_DIR="${UPLOAD_DIR:-$APP_ROOT/shared/uploads}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/keyafe}"
RCLONE_REMOTE="${RCLONE_REMOTE:-keyafe-backup}"
R2_BUCKET="${R2_BUCKET:-keyafe-backups}"
KEEP_SCHEDULED="${KEEP_SCHEDULED:-5}"
KEEP_PRE_RELEASE="${KEEP_PRE_RELEASE:-3}"

if [[ "$MODE" == "pre-release" ]]; then
  BACKUP_DIR="$BACKUP_ROOT/pre-release"
  KEEP="$KEEP_PRE_RELEASE"
else
  BACKUP_DIR="$BACKUP_ROOT"
  KEEP="$KEEP_SCHEDULED"
fi

HEALTHCHECK_URL=""
fail() {
  echo "backup-db: $*" >&2
  if [[ "$MODE" != "pre-release" && -n "$HEALTHCHECK_URL" ]]; then
    curl -fsS -m 10 "${HEALTHCHECK_URL%/}/fail" >/dev/null 2>&1 || true
  fi
  unset PGPASSWORD KEYAFE_DATABASE_URL 2>/dev/null || true
  exit 1
}

read_env_value() {
  local key="$1"
  local line=""
  [[ -f "$ENV_FILE" ]] || return 0
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#"${key}="}"
  line="${line%$'\r'}"
  if [[ "$line" == \"*\" && "$line" == *\" ]]; then
    line="${line#\"}"
    line="${line%\"}"
  elif [[ "$line" == \'*\' && "$line" == *\' ]]; then
    line="${line#\'}"
    line="${line%\'}"
  fi
  printf '%s' "$line"
}

HEALTHCHECK_URL="$(read_env_value HEALTHCHECK_URL || true)"

command -v python3 >/dev/null || fail "python3 is required"
command -v pg_dump >/dev/null || fail "pg_dump is required (install postgresql-client)"
command -v pg_restore >/dev/null || fail "pg_restore is required (install postgresql-client)"

mkdir -p "$BACKUP_DIR" || fail "cannot create $BACKUP_DIR (create it owned by this user)"

LOCK="$BACKUP_ROOT/backup.lock"
mkdir -p "$BACKUP_ROOT" || fail "cannot create $BACKUP_ROOT"
exec 9>"$LOCK"
flock -n 9 || fail "another backup is already running"

[[ -f "$ENV_FILE" ]] || fail "missing $ENV_FILE"

load_pg_env() {
  local raw
  raw="$(read_env_value DATABASE_URL)"
  [[ -n "$raw" ]] || fail "DATABASE_URL is not set in $ENV_FILE"
  eval "$(
    KEYAFE_DATABASE_URL="$raw" python3 - <<'PY'
import os
import shlex
from urllib.parse import unquote, urlparse

raw = os.environ.get("KEYAFE_DATABASE_URL", "").strip()
u = urlparse(raw)
db = unquote((u.path or "").lstrip("/").split("?")[0])
if not u.hostname or not db:
    raise SystemExit("invalid DATABASE_URL")
port = str(u.port or 5432)
user = unquote(u.username or "")
password = unquote(u.password or "")
print("export PGHOST=" + shlex.quote(u.hostname))
print("export PGPORT=" + shlex.quote(port))
print("export PGUSER=" + shlex.quote(user))
print("export PGPASSWORD=" + shlex.quote(password))
print("export PGDATABASE=" + shlex.quote(db))
PY
  )" || fail "could not parse DATABASE_URL"
}

load_pg_env
trap 'unset PGPASSWORD KEYAFE_DATABASE_URL 2>/dev/null || true' EXIT

STAMP="$(date -u +%Y-%m-%d_%H%M)"
if [[ "$MODE" == "pre-release" ]]; then
  VERSION_TAG="${APP_VERSION:-unknown}"
  DUMP="$BACKUP_DIR/pre-${VERSION_TAG}-${STAMP}.dump"
else
  DUMP="$BACKUP_DIR/keyafe-${STAMP}.dump"
fi

echo "==> Dumping $PGDATABASE to $DUMP"
pg_dump --format=custom --no-owner --file="$DUMP" \
  || fail "pg_dump failed"

[[ -s "$DUMP" ]] || fail "dump is empty: $DUMP"
pg_restore --list "$DUMP" >/dev/null \
  || fail "pg_restore --list failed (dump is not a valid custom archive)"

prune_local() {
  local dir="$1"
  local pattern="$2"
  local keep="$3"
  local -a files=()
  local i
  shopt -s nullglob
  files=( "$dir"/$pattern )
  shopt -u nullglob
  (( ${#files[@]} == 0 )) && return 0
  mapfile -t files < <(ls -1t "${files[@]}")
  if (( ${#files[@]} > keep )); then
    for (( i=keep; i<${#files[@]}; i++ )); do
      rm -f "${files[$i]}"
    done
  fi
}

rclone_ready() {
  command -v rclone >/dev/null 2>&1 || return 1
  rclone listremotes 2>/dev/null | grep -qx "${RCLONE_REMOTE}:"
}

if [[ "$MODE" != "pre-release" ]] && rclone_ready; then
  echo "==> Upload dump to ${RCLONE_REMOTE}:${R2_BUCKET}/db/"
  rclone copy "$DUMP" "${RCLONE_REMOTE}:${R2_BUCKET}/db/" --quiet \
    || fail "rclone copy of dump failed"

  if [[ -d "$UPLOAD_DIR" ]]; then
    echo "==> Sync uploads to ${RCLONE_REMOTE}:${R2_BUCKET}/uploads/"
    rclone sync "$UPLOAD_DIR" "${RCLONE_REMOTE}:${R2_BUCKET}/uploads/" --quiet \
      || fail "rclone sync of uploads failed"
  fi

  echo "==> Prune R2 dumps (keep $KEEP)"
  mapfile -t remote_dumps < <(
    rclone lsf --files-only "${RCLONE_REMOTE}:${R2_BUCKET}/db/" 2>/dev/null | sort || true
  )
  if (( ${#remote_dumps[@]} > KEEP )); then
    stale_count=$((${#remote_dumps[@]} - KEEP))
    for (( i=0; i<stale_count; i++ )); do
      rclone deletefile "${RCLONE_REMOTE}:${R2_BUCKET}/db/${remote_dumps[$i]}" --quiet \
        || fail "rclone deletefile failed for ${remote_dumps[$i]}"
    done
  fi
elif [[ "$MODE" != "pre-release" ]]; then
  echo "==> rclone remote ${RCLONE_REMOTE} not configured — local dump only"
fi

if [[ "$MODE" == "pre-release" ]]; then
  prune_local "$BACKUP_DIR" "pre-*.dump" "$KEEP"
else
  prune_local "$BACKUP_DIR" "keyafe-*.dump" "$KEEP"
fi

unset PGPASSWORD

if [[ "$MODE" != "pre-release" && -n "$HEALTHCHECK_URL" ]]; then
  curl -fsS -m 10 "$HEALTHCHECK_URL" >/dev/null \
    || echo "backup-db: warning: healthcheck ping failed" >&2
fi

echo "==> Backup ok: $DUMP"
