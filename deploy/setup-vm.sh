#!/usr/bin/env bash
# =============================================================
# Legalok — Oracle Cloud Always-Free VM bootstrap (Ubuntu 22.04+)
# Run as root:  bash setup-vm.sh
# Installs Node 20, deploys the API, sets up systemd + keepalive.
# (cloudflared tunnel setup is done interactively afterwards — see DEPLOY.md)
# =============================================================
set -euo pipefail

APP_DIR=/opt/legalok
REPO_URL="${REPO_URL:-https://github.com/YOUR_USER/legalok.git}"

echo "==> 1/6 Base packages"
apt-get update -y && apt-get install -y git curl unzip ca-certificates cron

# Low-RAM shapes (VM.Standard.E2.1.Micro = 1 GB) need swap or the TypeScript
# build gets OOM-killed. Harmless on larger shapes.
echo "==> 1b/6 Swap 2G"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h

echo "==> 2/6 Node.js 20"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> 3/6 Service user + code"
id -u legalok >/dev/null 2>&1 || useradd -r -m -d /home/legalok -s /usr/sbin/nologin legalok
mkdir -p "$APP_DIR"
[ -d "$APP_DIR/.git" ] || git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR" && git pull --ff-only || true

echo "==> 4/6 Build API"
cd "$APP_DIR/server"
sudo -u legalok npm ci
sudo -u legalok npm run build
mkdir -p "$APP_DIR/server/data/uploads"
chown -R legalok:legalok "$APP_DIR"

echo "==> 5/6 Environment file"
if [ ! -f "$APP_DIR/server/.env" ]; then
  cp "$APP_DIR/server/.env.example" "$APP_DIR/server/.env"
  echo "    --> EDIT $APP_DIR/server/.env now (secrets, DATABASE_URL, SUPABASE_*, APP_URL, CORS_ORIGIN)"
fi

echo "==> 6/6 systemd service + keepalive cron"
cp "$APP_DIR/deploy/legalok.service" /etc/systemd/system/legalok.service
systemctl daemon-reload
systemctl enable --now legalok
# Keep-alive: prevents Supabase free-tier DB pause + warms the API every 5 minutes
( crontab -l 2>/dev/null; echo '*/5 * * * * curl -fsS -o /dev/null http://localhost:4000/api/health' ) | crontab -
sleep 2
systemctl status legalok --no-pager | head -n 5 || true
curl -fsS http://localhost:4000/api/health && echo " <-- API is UP"
echo "Done. Next: cloudflared tunnel (see DEPLOY.md step 3)."
