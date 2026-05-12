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

## Bagutka Flow

`/legendaitest` runs the local agent and stores one pending audit for the owner
chat.

Expected Telegram flow:

1. Bagutka runs the agent.
2. Bagutka returns a short summary in Telegram.
3. Bagutka asks for confirmation with `Fix in new branch` and `Skip`.
4. `Skip` consumes the pending audit without sending anything to Codex.
5. `Fix in new branch` sends `.legend-ai-audits/latest-ai-fix-prompt.md` into
   the Legend `Agent findings` thread through Nexus.

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

## Prompt For Hetzner Setup Thread

Use this in the existing Legend thread that already has Hetzner and GitHub
Actions context:

```text
We have a local AI Zendesk agent for Legend at:
/Users/anna/IdeaProjects/private/legend/scripts/ai-zendesk-agent.mjs

Current local contract:
- command: npm run audit:ai:zendesk:prod
- mode: triage only
- model: gpt-5.5 via OPENAI_MODEL
- required secret: OPENAI_API_KEY
- target URL: https://app.legenddesk.com
- outputs:
  - .legend-ai-audits/latest-ai-summary.md
  - .legend-ai-audits/latest-ai.md
  - .legend-ai-audits/latest-ai.json
  - .legend-ai-audits/latest-ai-codex-prompt.md
  - .legend-ai-audits/latest-ai-fix-prompt.md
  - .legend-ai-audits/screenshots/*.png

Goal:
Prepare production-grade Hetzner deployment for this runner, but keep the same
approval model:

1. Bagutka receives /legendaitest.
2. The AI Zendesk agent runs against https://app.legenddesk.com.
3. The runner returns a short human summary to Bagutka.
4. Bagutka asks the owner to confirm Fix in new branch or Skip.
5. Only after explicit confirmation, the fix prompt is routed to the Legend
   Agent findings thread.
6. The fixing Codex task must create a fresh branch from latest origin/main,
   implement only evidence-backed fixes, update docs when needed, and run
   npm run lint plus npm run build.
7. The fixing Codex task must commit the fixes, push the branch, and dispatch
   `.github/workflows/deploy-hetzner.yml` with `--ref <branch>` so that exact
   branch is deployed to production for human review.
8. The fixing Codex task must report:
   - `LEGEND FIX STATUS 1/3: code ready`
   - `LEGEND FIX STATUS 2/3: code pushed`
   - `LEGEND FIX STATUS 3/3: branch deployed`
9. Main merge and PR creation remain separate explicit steps after the deployed
   branch is reviewed.

Please inspect existing Hetzner/GitHub Actions context in this thread and
produce a clean implementation plan for:
- server directory layout
- systemd service/timer or long-running runner
- env file location and permissions
- Node 22 and Playwright browser dependencies
- artifact retention for .legend-ai-audits
- logs and failure reporting
- how Bagutka should trigger the remote runner
- how the result should return to Bagutka/Nexus without exposing secrets
- rollback and health-check commands

Do not implement yet. First return the proposed architecture and exact files
that should be changed.
```
