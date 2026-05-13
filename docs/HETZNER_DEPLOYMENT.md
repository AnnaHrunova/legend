# Hetzner Deployment

This is a separate deployment path for `app.legenddesk.com`.

It does not replace or modify the existing GitHub Pages prototype deployment.

## Current State

```text
Browser -> Cloudflare proxy -> Hetzner -> Caddy -> Legend frontend
```

Production URL:

```text
https://app.legenddesk.com
```

Hetzner server:

```text
65.109.29.172
```

Cloudflare:

```text
SSL/TLS mode: Full (strict)
app.legenddesk.com: Proxied
api.legenddesk.com: reserved for future backend
```

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
Proxy: Proxied
```

This creates:

```text
app.legenddesk.com
```

For first-time certificate debugging, `DNS only` is acceptable. After Caddy has issued a valid Let's Encrypt certificate, use Cloudflare proxy with SSL/TLS mode set to `Full (strict)`.

Keep `api.legenddesk.com` reserved for the future backend. It can point to the same Hetzner IP, but it is not active until the backend service and Caddy route exist.

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

Required for the on-demand AI Zendesk Agent workflow:

```text
OPENAI_API_KEY     # used only by deploy-hetzner.yml operation=run_ai_zendesk_agent
```

The workflow deploys as the fixed server user `deploy`, so `HETZNER_USER` is not required.

Optional:

```text
HETZNER_PORT       # defaults to 22
OPENAI_MODEL       # defaults to gpt-5.5 for the AI Zendesk Agent
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

The workflow also performs a public health check:

```bash
curl -fsSI https://app.legenddesk.com
```

The deploy fails if the public site does not return a successful response.

## Server Operations

SSH into the server:

```bash
ssh -i ~/.ssh/legend_hetzner deploy@65.109.29.172
```

Check running containers:

```bash
cd /opt/legend
docker compose -f docker-compose.hetzner.yml ps
```

View frontend/Caddy logs:

```bash
cd /opt/legend
docker compose -f docker-compose.hetzner.yml logs -f legend-frontend
```

Restart the frontend:

```bash
cd /opt/legend
docker compose -f docker-compose.hetzner.yml restart legend-frontend
```

Pull and restart manually, if GitHub Actions is unavailable:

```bash
cd /opt/legend
docker compose -f docker-compose.hetzner.yml pull
docker compose -f docker-compose.hetzner.yml up -d
```

Check public response from any machine:

```bash
curl -I https://app.legenddesk.com
```

Expected response includes:

```text
HTTP/2 200
server: cloudflare
```

## AI Zendesk Agent Operations

The AI Zendesk Agent is an on-demand Hetzner runner. It does not run on a
schedule and does not deploy anything by itself.

The GitHub Actions workflow uploads the selected branch as a source tarball, so
the normal runner path only requires Docker on the Hetzner host. Node,
Playwright, and browser dependencies run inside the Playwright Docker image.

Run it through GitHub Actions:

```bash
gh workflow run deploy-hetzner.yml \
  --repo AnnaHrunova/legend \
  --ref codex/ai-zendesk-agent \
  -f operation=run_ai_zendesk_agent \
  -f agent_branch=codex/ai-zendesk-agent \
  -f agent_base_url=https://app.legenddesk.com \
  -f agent_mode=triage \
  -f agent_max_steps=8
```

Server paths:

```text
/opt/legend/ai-zendesk-agent/env/legend-ai-zendesk-agent.env
/opt/legend/ai-zendesk-agent/logs/
/opt/legend/ai-zendesk-agent/runs/
/opt/legend/ai-zendesk-agent/latest/
```

The env file is written by GitHub Actions from secrets and should remain mode
`600`. Audit reports and screenshots stay out of git.

View the latest run:

```bash
ssh -i ~/.ssh/legend_hetzner deploy@65.109.29.172 \
  'ls -lt /opt/legend/ai-zendesk-agent/runs | head && cat /opt/legend/ai-zendesk-agent/latest/latest-ai-summary.md'
```

View logs:

```bash
ssh -i ~/.ssh/legend_hetzner deploy@65.109.29.172 \
  'tail -n 200 /opt/legend/ai-zendesk-agent/logs/$(ls -t /opt/legend/ai-zendesk-agent/logs | head -1)'
```

## Notes

- The workflow is manual-only.
- GitHub Pages deployment remains in `.github/workflows/deploy.yml`.
- The current setup deploys frontend only.
- Backend and Postgres will be added later as separate services in Compose.
