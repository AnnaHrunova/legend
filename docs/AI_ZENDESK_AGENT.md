# AI Zendesk Agent

Legend has a local AI-powered tester that acts as a senior Zendesk power user
and audits the deployed prototype at `https://app.legenddesk.com`.

The current mode is triage-only. The agent explores the UI, writes a short
summary, saves evidence, and prepares a fix prompt. It does not change code,
push, deploy, or open PRs by itself.

## Local Runner

Run from the Legend repo:

```bash
npm run audit:ai:zendesk:prod
```

Required local secret:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5
```

Local outputs:

- `.legend-ai-audits/latest-ai-summary.md`
- `.legend-ai-audits/latest-ai.md`
- `.legend-ai-audits/latest-ai.json`
- `.legend-ai-audits/latest-ai-codex-prompt.md`
- `.legend-ai-audits/latest-ai-fix-prompt.md`
- `.legend-ai-audits/screenshots/*.png`

Local audit artifacts are ignored by git. Do not commit `.legend-ai-audits`,
screenshots, `.env`, `.env.local`, or temporary run files.

## Hetzner Runner

The production runner is on-demand and runs on Hetzner, not on a developer
laptop.

GitHub Actions entrypoint:

```text
.github/workflows/deploy-hetzner.yml
```

Use `operation=run_ai_zendesk_agent` for the audit runner. The default
`operation=deploy_frontend` remains the normal frontend deployment path.

Server runner script:

```text
/opt/legend/ai-zendesk-agent/bin/run-ai-zendesk-agent.sh
```

Source-controlled script copied to Hetzner by the workflow:

```text
ops/hetzner/run-ai-zendesk-agent.sh
```

Server layout:

```text
/opt/legend/ai-zendesk-agent/
  bin/run-ai-zendesk-agent.sh
  env/legend-ai-zendesk-agent.env
  env/run.env
  repo/
  runs/<run-id>/
  runs/<run-id>.tar.gz
  latest/
  logs/<run-id>.log
```

The workflow SSHes to the existing Hetzner host using the same deploy secrets
as the frontend deployment, then runs the agent inside the official Playwright
Docker image. This keeps Node and browser dependencies out of the host OS and
uses the Docker setup already required by the Hetzner frontend deployment.

For normal Bagutka/GitHub Actions runs, the workflow checks out the selected
branch, uploads a source tarball to Hetzner, and the server extracts that exact
source into `repo/`. The server does not need local `git` for the normal path.
The script can still fall back to `git clone` for manual server-only reruns when
no source tarball is provided.

Required GitHub Actions secrets:

- `HETZNER_HOST`
- `HETZNER_PORT` (optional, defaults to `22`)
- `HETZNER_SSH_KEY`
- `OPENAI_API_KEY`

Optional GitHub Actions secret:

- `OPENAI_MODEL` (defaults to `gpt-5.5`)

The workflow writes `OPENAI_API_KEY` and `OPENAI_MODEL` to
`/opt/legend/ai-zendesk-agent/env/legend-ai-zendesk-agent.env` with `600`
permissions. Secrets are not stored in git.

Manual trigger:

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

Optional model override for one run:

```bash
gh workflow run deploy-hetzner.yml \
  --repo AnnaHrunova/legend \
  --ref codex/ai-zendesk-agent \
  -f operation=run_ai_zendesk_agent \
  -f agent_branch=codex/ai-zendesk-agent \
  -f agent_model=gpt-5.5
```

Artifacts:

- Hetzner latest summary: `/opt/legend/ai-zendesk-agent/latest/latest-ai-summary.md`
- Hetzner latest full report: `/opt/legend/ai-zendesk-agent/latest/latest-ai.md`
- Hetzner latest JSON: `/opt/legend/ai-zendesk-agent/latest/latest-ai.json`
- Hetzner latest Codex prompt: `/opt/legend/ai-zendesk-agent/latest/latest-ai-codex-prompt.md`
- Hetzner latest fix prompt: `/opt/legend/ai-zendesk-agent/latest/latest-ai-fix-prompt.md`
- GitHub Actions artifact: `latest-ai-report`

Logs:

```bash
ssh deploy@<hetzner-host> 'tail -n 200 /opt/legend/ai-zendesk-agent/logs/<run-id>.log'
ssh deploy@<hetzner-host> 'ls -lt /opt/legend/ai-zendesk-agent/logs | head'
```

Manual rerun on the server after a workflow has installed the runner and env:

```bash
ssh deploy@<hetzner-host> \
  'set -a && . /opt/legend/ai-zendesk-agent/env/run.env && set +a && /opt/legend/ai-zendesk-agent/bin/run-ai-zendesk-agent.sh'
```

End-to-end check:

1. Run `deploy-hetzner.yml` with `operation=run_ai_zendesk_agent` through GitHub Actions.
2. Wait for the workflow to finish.
3. Open the `latest-ai-report` artifact.
4. Confirm it contains:
   - `latest-ai-summary.md`
   - `latest-ai.md`
   - `latest-ai.json`
   - `latest-ai-codex-prompt.md`
   - `latest-ai-fix-prompt.md`
   - `screenshots/*.png`
5. Confirm the workflow summary contains the short summary Bagutka should show.

## Bagutka Flow

`/legendaitest` should dispatch `deploy-hetzner.yml` with
`operation=run_ai_zendesk_agent` and store one pending audit for the owner chat.

Expected Telegram flow:

1. Bagutka starts the GitHub Actions workflow.
2. Bagutka returns a short summary in Telegram.
3. Bagutka asks for confirmation with `Fix in new branch` and `Skip`.
4. `Skip` consumes the pending audit without sending anything to Codex.
5. `Fix in new branch` sends `latest-ai-fix-prompt.md` from the workflow
   artifact or Hetzner latest directory into the Legend `Agent findings` thread
   through Nexus.

The fix prompt tells Codex to fetch latest `origin/main`, create a new branch,
implement only safe evidence-backed fixes, update docs when behavior changes,
run `npm run lint` plus `npm run build`, commit, push the branch, and deploy
that branch to production through the Hetzner GitHub Actions workflow.

Bagutka relays Codex progress from the `Agent findings` turn. The fix prompt
therefore requires explicit milestone messages:

- `LEGEND FIX STATUS 1/3: code ready` after local fixes and checks pass.
- `LEGEND FIX STATUS 2/3: code pushed` after the branch is pushed to origin.
- `LEGEND FIX STATUS 3/3: branch deployed` after the branch deployment workflow
  succeeds.

If a milestone fails, Codex must stop and send `LEGEND FIX FAILED: <stage> -
<specific reason>`.

## Fix Flow

The runner remains triage-only. Fixes start only after human approval in
Bagutka.

Approved fix flow:

1. Codex fetches latest `origin/main`.
2. Codex creates a fresh branch from `origin/main`.
3. Codex fixes only confirmed evidence-backed findings.
4. Codex runs `npm run lint` and `npm run build`.
5. Codex commits and pushes the fix branch.
6. Codex dispatches the existing Hetzner deploy workflow for that exact branch:

```bash
gh workflow run deploy-hetzner.yml \
  --repo AnnaHrunova/legend \
  --ref <fix-branch>
```

Do not merge `main` automatically. Do not open a PR automatically unless the
owner asks for it.
