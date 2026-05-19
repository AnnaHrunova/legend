# Hetzner Deployment

This is a separate deployment path for `app.legenddesk.com`.

It does not replace or modify the existing GitHub Pages prototype deployment.

## Current State

```text
Browser -> Cloudflare proxy -> Hetzner -> Caddy -> Legend frontend
                                      -> voice API
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

The current Vite frontend and voice support services are built into Docker
images:

```text
ghcr.io/annahrunova/legend-frontend:latest
ghcr.io/annahrunova/legend-voice-api:latest
ghcr.io/annahrunova/legend-voice-agent:latest
```

Caddy:

- serves the static frontend from `/srv/legend`
- handles SPA fallback through `try_files {path} /index.html`
- proxies `/api/*` and `/healthz` to `legend-voice-api`
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

Required in `/opt/legend/.env` on the Hetzner server for voice support:

```text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_AGENT_NAME
OPENAI_API_KEY
OPENAI_REALTIME_MODEL
OPENAI_REALTIME_VOICE
```

The deploy workflow preserves these server-side values. It only upserts
`HETZNER_DOMAIN` and `CADDY_EMAIL`, then validates that the voice variables are
present without printing their values.

Required for the on-demand AI Zendesk Agent workflow:

```text
Codex auth.json on the server, default /var/lib/codex-nexus/auth.json
```

The AI Zendesk Agent and the status-change assist endpoint use Codex/ChatGPT
authorization and do not require an `OPENAI_API_KEY` GitHub secret. The
status-change assist endpoint mounts the same auth file into `legend-voice-api`
as `/run/codex/auth.json`, refreshes expired Codex access tokens, and rejects
API-key auth. The voice stack still uses `OPENAI_API_KEY` separately through
`/opt/legend/.env`.

The workflow deploys as the fixed server user `deploy`, so `HETZNER_USER` is not required.

Optional:

```text
HETZNER_PORT       # defaults to 22
OPENAI_MODEL       # defaults to gpt-5.5 for the AI Zendesk Agent
STATUS_ASSIST_MODEL # defaults to gpt-5.5 for status-change assist
CODEX_AUTH_JSON_HOST # defaults to /var/lib/codex-nexus/auth.json
```

## Deploy

Run manually:

```text
GitHub -> Actions -> Deploy to Hetzner -> Run workflow
```

The deploy step upserts these values in `/opt/legend/.env` on the server:

```text
HETZNER_DOMAIN=app.legenddesk.com
CADDY_EMAIL=your-email@example.com
```

It does not overwrite existing LiveKit/OpenAI voice variables. If `OPENAI_REALTIME_MODEL`
is missing, the workflow initializes it to `gpt-realtime-2`.

That keeps manual server checks clean:

```bash
cd /opt/legend
docker compose -f docker-compose.hetzner.yml ps
```

The workflow also performs a public health check:

```bash
curl -fsSI https://app.legenddesk.com
curl -fsS https://app.legenddesk.com/healthz
```

The deploy fails if the public site is unavailable or `/healthz` does not show
`"livekitConfigured":true`.

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

View voice service logs:

```bash
cd /opt/legend
docker compose -f docker-compose.hetzner.yml logs -f legend-voice-api
docker compose -f docker-compose.hetzner.yml logs -f legend-voice-agent
```

Restart services:

```bash
cd /opt/legend
docker compose -f docker-compose.hetzner.yml restart legend-frontend
docker compose -f docker-compose.hetzner.yml restart legend-voice-api legend-voice-agent
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
curl -s https://app.legenddesk.com/healthz
```

Expected response includes:

```text
HTTP/2 200
server: cloudflare
```

Voice health should return JSON like:

```json
{"ok":true,"livekitConfigured":true,"agentName":"legend-voice-agent"}
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
  --ref main \
  -f operation=run_ai_zendesk_agent \
  -f agent_branch=main \
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
