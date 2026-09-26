#!/usr/bin/env bash
# Build a deployable tarball on CI (or locally).
# Output: ./keyafe-release.tgz
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Stage inside the repo — pnpm deploy breaks on system /tmp (relative paths → EACCES /home/tmp).
STAGE="$ROOT/.release-stage"
rm -rf "$STAGE"
mkdir -p "$STAGE"
trap 'rm -rf "$STAGE"' EXIT

VERSION="${APP_VERSION:-unknown}"
echo "==> Staging release $VERSION"

mkdir -p "$STAGE/client" "$STAGE/admin" "$STAGE/server"

# Static SPAs
cp -a "$ROOT/client/dist/." "$STAGE/client/"
cp -a "$ROOT/admin/dist/." "$STAGE/admin/"

# Portable server package (prod deps + built dist)
# pnpm deploy creates an isolated install directory.
pnpm --dir "$ROOT" --filter server deploy --prod "$STAGE/server-deploy"
# Flatten into stage/server (deploy puts package contents in the target)
rm -rf "$STAGE/server"
mv "$STAGE/server-deploy" "$STAGE/server"

# Ensure prisma schema/migrations are present for migrate deploy
mkdir -p "$STAGE/server/prisma"
cp -a "$ROOT/server/prisma/." "$STAGE/server/prisma/"

# Prisma CLI needed on server for migrate (not always in --prod deploy)
pnpm --dir "$STAGE/server" add prisma@5.22.0 --save-prod

# Generate client against shipped schema (in case deploy pruned it)
pnpm --dir "$STAGE/server" exec prisma generate

echo "$VERSION" > "$STAGE/VERSION"

OUT="${RELEASE_OUT:-$ROOT/keyafe-release.tgz}"
tar -czf "$OUT" -C "$STAGE" client admin server VERSION
echo "==> Wrote $OUT"
ls -lh "$OUT"
