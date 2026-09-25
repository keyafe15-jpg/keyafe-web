# Production deploy — DigitalOcean droplet + GitHub Actions

Storefront: `https://keyafe.com`  
Admin: `https://admin.keyafe.com`  
API: `/api` on both hosts → Node on `127.0.0.1:4000`

**Push to `main` does not deploy.** It only runs CI (install + build).  
**Production ships** when you manually run **Actions → Cut release**.

---

## Your checklist (in order)

### 1. DNS (you said A records are done)

Confirm from your laptop:

```bash
dig +short keyafe.com A
dig +short www.keyafe.com A
dig +short admin.keyafe.com A
```

All three should return your droplet IP.

### 2. SSH into the droplet

```bash
ssh root@YOUR_DROPLET_IP
```

(Or the user you created in the DO UI.)

### 3. Bootstrap the server (once)

Copy `deploy/bootstrap-droplet.sh` to the droplet (or clone the repo later). As root:

```bash
bash bootstrap-droplet.sh
```

Then:

```bash
# Set a strong DB password (same in Postgres + .env)
sudo -u postgres psql -c "ALTER USER keyafe WITH PASSWORD 'YOUR_STRONG_DB_PASSWORD';"

nano /var/www/keyafe/shared/.env
```

Fill in at least:

- `DATABASE_URL=postgresql://keyafe:YOUR_STRONG_DB_PASSWORD@127.0.0.1:5432/keyafe?schema=public`
- `JWT_SECRET` — 32+ random chars  
- `UPLOAD_TOKEN_SECRET` — 32+ random chars  
- `CLIENT_ORIGIN=https://keyafe.com`  
- `ADMIN_ORIGIN=https://admin.keyafe.com`  
- `PUBLIC_BASE_URL=https://keyafe.com`  
- `UPLOAD_DIR=/var/www/keyafe/shared/uploads`

Generate secrets:

```bash
openssl rand -hex 32
```

### 4. Create `deploy` SSH access for GitHub Actions

On the droplet (as root):

```bash
# If bootstrap created user "deploy":
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy ssh-keygen -t ed25519 -N "" -f /home/deploy/.ssh/id_ed25519
# Add the PUBLIC key as authorized for deploy:
sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys < /home/deploy/.ssh/id_ed25519.pub
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Copy the **private** key (`/home/deploy/.ssh/id_ed25519`) into GitHub later as `DROPLET_SSH_KEY`.

Allow `deploy` to own the app tree (bootstrap already does). Ensure `deploy` can run `pm2` (installed globally).

Optional: enable linger/startup for PM2 after first release:

```bash
sudo -u deploy pm2 startup systemd -u deploy --hp /home/deploy
# run the command it prints, then:
sudo -u deploy pm2 save
```

### 5. Nginx (before first release, use a placeholder root)

Nginx expects `/var/www/keyafe/current/{client,admin}`. Create empty placeholders until the first release:

```bash
sudo mkdir -p /var/www/keyafe/releases/placeholder/{client,admin}
echo '<!doctype html><title>Keyafe</title><p>Deploy pending</p>' | sudo tee /var/www/keyafe/releases/placeholder/client/index.html
echo '<!doctype html><title>Keyafe Admin</title><p>Deploy pending</p>' | sudo tee /var/www/keyafe/releases/placeholder/admin/index.html
sudo ln -sfn /var/www/keyafe/releases/placeholder /var/www/keyafe/current
sudo chown -R deploy:deploy /var/www/keyafe
```

Install configs from this repo (after you pull/copy them):

```bash
sudo cp deploy/nginx/00-keyafe-upstream.conf /etc/nginx/conf.d/keyafe-upstream.conf
sudo cp deploy/nginx/keyafe.com.conf /etc/nginx/sites-available/keyafe.com
sudo cp deploy/nginx/admin.keyafe.com.conf /etc/nginx/sites-available/admin.keyafe.com
sudo ln -sf /etc/nginx/sites-available/keyafe.com /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/admin.keyafe.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 6. HTTPS (Certbot)

```bash
sudo certbot --nginx -d keyafe.com -d www.keyafe.com -d admin.keyafe.com
```

Follow prompts (email, agree to ToS). Renewals are automatic via systemd timer.

### 7. GitHub secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|--------|
| `DROPLET_HOST` | Droplet IP (or hostname) |
| `DROPLET_USER` | `deploy` |
| `DROPLET_SSH_KEY` | Full private key PEM (including `BEGIN`/`END` lines) |
| `VITE_GOOGLE_MAPS_API_KEY` | Same key as local (restrict referrers to prod domains) |
| `VITE_GOOGLE_PLACE_ID` | Optional; client reviews |

Also update Google Cloud key **HTTP referrers**:

- `https://keyafe.com/*`
- `https://www.keyafe.com/*`
- `https://admin.keyafe.com/*`
- `http://localhost:5173/*`
- `http://localhost:5175/*`

### 8. Merge this deploy work to `main`

Push the branch with `deploy/` + workflows, open PR or merge to `main`. CI should go green (build only).

### 9. First production release

GitHub → **Actions → Cut release → Run workflow**

- Bump: `patch` (first time becomes `v0.0.1` if no tags, or from latest tag)  
  For a clean start you can set **version** to `1.0.0` explicitly.

Watch the job: tag + `release/vX.Y.Z` branch + tarball upload + migrate + PM2.

### 10. Smoke test

```bash
curl -s https://keyafe.com/api/health
# expect { "status":"ok", "version":"v1.0.0", "db":"connected", ... }

open https://keyafe.com
open https://admin.keyafe.com
```

Seed/bootstrap admin if needed (see server RBAC seed / `ADMIN_BOOTSTRAP_*` if you use it).

### Rollback

```bash
ssh deploy@YOUR_IP
ls /var/www/keyafe/releases
ln -sfn /var/www/keyafe/releases/vPREV /var/www/keyafe/current
pm2 reload keyafe-api
```

DB migrations are not auto-reverted; prefer forward fixes for schema.

---

## Repo layout

| Path | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Build on push/PR to `main` |
| `.github/workflows/release.yml` | Manual cut release → deploy |
| `deploy/bootstrap-droplet.sh` | One-time server setup |
| `deploy/pack-release.sh` | Build tarball (CI) |
| `deploy/remote-release.sh` | Activate release on droplet |
| `deploy/nginx/*` | Nginx site configs |

---

## Local pack test (optional)

```bash
pnpm install
pnpm --filter server build && pnpm --filter client build && pnpm --filter admin build
APP_VERSION=v0.0.0-test ./deploy/pack-release.sh
```
