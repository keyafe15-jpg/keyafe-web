#!/usr/bin/env bash
# One-time DigitalOcean droplet bootstrap for Keyafe.
# Run as root on Ubuntu 24.04:  bash bootstrap-droplet.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/keyafe}"
APP_USER="${APP_USER:-deploy}"

echo "==> Swap (2G) if missing"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg ufw nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib build-essential git rsync

echo "==> Node 22"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> pnpm"
corepack enable
corepack prepare pnpm@9.15.0 --activate

echo "==> PM2"
npm install -g pm2

echo "==> App user + dirs"
id -u "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
mkdir -p "$APP_ROOT"/{releases,shared/uploads} /var/www/certbot
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"

echo "==> Postgres role/db (change password after!)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='keyafe'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER keyafe WITH PASSWORD 'CHANGE_ME_NOW';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='keyafe'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE keyafe OWNER keyafe;"

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable || true

echo "==> Env template"
ENV_FILE="$APP_ROOT/shared/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=https://keyafe.com
ADMIN_ORIGIN=https://admin.keyafe.com
DATABASE_URL=postgresql://keyafe:CHANGE_ME_NOW@127.0.0.1:5432/keyafe?schema=public
LOG_LEVEL=info
STORAGE_PROVIDER=local
UPLOAD_DIR=/var/www/keyafe/shared/uploads
PUBLIC_BASE_URL=https://keyafe.com
UPLOAD_TOKEN_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET_32PLUS
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET_32PLUS
JWT_EXPIRES_IN=7d
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Wrote $ENV_FILE — edit secrets/passwords before first start."
fi

echo "==> Done bootstrap."
echo "Next:"
echo "  1. Edit $ENV_FILE (DB password, JWT/upload secrets)"
echo "  2. Copy nginx configs from repo deploy/nginx/ and enable sites"
echo "  3. certbot --nginx -d keyafe.com -d www.keyafe.com -d admin.keyafe.com"
echo "  4. Add GitHub secrets and run Cut release workflow"
echo "  5. pm2 startup && pm2 save  (after first successful release)"
