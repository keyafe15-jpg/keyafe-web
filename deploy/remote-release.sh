#!/usr/bin/env bash
# Run ON the droplet after a release tarball is uploaded to /tmp/keyafe-release.tgz
# Usage (as deploy user): APP_VERSION=v1.2.3 bash remote-release.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/keyafe}"
VERSION="${APP_VERSION:?APP_VERSION required e.g. v1.0.0}"
TARBALL="${RELEASE_TARBALL:-/tmp/keyafe-release.tgz}"
RELEASE_DIR="$APP_ROOT/releases/$VERSION"

if [[ ! -f "$TARBALL" ]]; then
  echo "Missing tarball: $TARBALL" >&2
  exit 1
fi

echo "==> Unpack $VERSION"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$TARBALL" -C "$RELEASE_DIR"
echo "$VERSION" > "$RELEASE_DIR/VERSION"

echo "==> Link shared env"
ln -sfn "$APP_ROOT/shared/.env" "$RELEASE_DIR/server/.env"

echo "==> Prisma migrate"
cd "$RELEASE_DIR/server"
pnpm exec prisma migrate deploy

echo "==> Symlink current → $VERSION"
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

echo "==> Restart API (PM2)"
# Persist version for health endpoint (also readable from VERSION file if needed)
if grep -q '^APP_VERSION=' "$APP_ROOT/shared/.env" 2>/dev/null; then
  sed -i "s/^APP_VERSION=.*/APP_VERSION=$VERSION/" "$APP_ROOT/shared/.env"
else
  echo "APP_VERSION=$VERSION" >> "$APP_ROOT/shared/.env"
fi

if pm2 describe keyafe-api >/dev/null 2>&1; then
  pm2 reload keyafe-api --update-env
else
  pm2 start "$APP_ROOT/current/server/dist/index.js" \
    --name keyafe-api \
    --cwd "$APP_ROOT/current/server"
  pm2 save
fi

echo "==> Prune old releases (keep 5)"
cd "$APP_ROOT/releases"
ls -1dt v* 2>/dev/null | tail -n +6 | xargs -r rm -rf || true

echo "==> Release $VERSION live"
