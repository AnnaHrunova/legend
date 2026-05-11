# Hetzner Deployment

This is a separate deployment path for `app.legenddesk.com`.

It does not replace or modify the existing GitHub Pages prototype deployment.

## What Gets Deployed

The current Vite frontend is built into a Docker image and served by Caddy.

Caddy:

- serves the static frontend from `/srv/legend`
- handles SPA fallback through `try_files {path} /index.html`
- automatically issues and renews HTTPS certificates

## Files

```text
Dockerfile.frontend
docker-compose.hetzner.yml
Caddyfile
.github/workflows/deploy-hetzner.yml
```

## DNS

After Hetzner provides the server IP, configure Cloudflare DNS:

```text
Type: A
Name: app
Value: HETZNER_SERVER_IP
Proxy: DNS only
```

This creates:

```text
app.legenddesk.com
```

Keep `api.legenddesk.com` reserved for the future backend.

## Server Bootstrap

Run once on a fresh Ubuntu 24.04 server as `root`.

```bash
apt update
apt upgrade -y
apt install -y ca-certificates curl ufw

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

adduser deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

mkdir -p /opt/legend
chown -R deploy:deploy /opt/legend

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Then verify deploy user access from your machine:

```bash
ssh -i ~/.ssh/legend_hetzner deploy@HETZNER_SERVER_IP
```

## GitHub Secrets

Add these in:

```text
GitHub -> Settings -> Secrets and variables -> Actions -> Secrets
```

Required:

```text
HETZNER_HOST       # server IP
HETZNER_SSH_KEY    # private key allowed for deploy user
HETZNER_DOMAIN     # app.legenddesk.com
CADDY_EMAIL        # email for Let's Encrypt notices
VITE_POSTHOG_KEY   # existing PostHog project key
```

The workflow deploys as the fixed server user `deploy`, so `HETZNER_USER` is not required.

Optional:

```text
HETZNER_PORT       # defaults to 22
```

## Deploy

Run manually:

```text
GitHub -> Actions -> Deploy to Hetzner -> Run workflow
```

The deploy step writes `/opt/legend/.env` on the server:

```text
HETZNER_DOMAIN=app.legenddesk.com
CADDY_EMAIL=your-email@example.com
```

That keeps manual server checks clean:

```bash
cd /opt/legend
docker compose -f docker-compose.hetzner.yml ps
```

## Notes

- The workflow is manual-only.
- GitHub Pages deployment remains in `.github/workflows/deploy.yml`.
- The current setup deploys frontend only.
- Backend and Postgres will be added later as separate services in Compose.
