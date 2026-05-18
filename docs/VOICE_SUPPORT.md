# In-App Voice Support

LegendDesk voice support is built as an in-app voice session, not as phone-line support.

Runtime pieces:

- `legend-frontend`: static Vite app served by Caddy.
- `legend-voice-api`: small Node API that creates LiveKit rooms and participant tokens.
- `legend-voice-agent`: LiveKit Agents worker using OpenAI Realtime.

## Local dev

Run the frontend:

```bash
npm run dev
```

Run the voice session API:

```bash
npm run voice:api
```

Run the voice agent:

```bash
npm run voice:agent
```

Required environment for real LiveKit/OpenAI mode:

```bash
LIVEKIT_URL=https://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_AGENT_NAME=legend-voice-agent
OPENAI_API_KEY=...
OPENAI_REALTIME_VOICE=coral
```

If LiveKit variables are missing, `/api/voice-sessions` returns mock-mode metadata. That keeps the UX prototype testable without pretending the real voice stack is connected.

## Flow

1. Agent clicks `Voice ticket` in the LegendDesk header.
2. The frontend creates a local voice ticket with authenticated mobile app context.
3. The frontend calls `POST /api/voice-sessions`.
4. The API creates a LiveKit room and support/customer tokens.
5. The API dispatches `legend-voice-agent` into the room.
6. Ticket detail shows status, app context, transcript scaffold, handoff controls, and LiveKit join controls.

In production the mobile app should call the same API with real authenticated user context. The current frontend button is a dev harness for testing the lifecycle from the LegendDesk side.

## Hetzner

`docker-compose.hetzner.yml` now expects three images:

- `ghcr.io/annahrunova/legend-frontend:latest`
- `ghcr.io/annahrunova/legend-voice-api:latest`
- `ghcr.io/annahrunova/legend-voice-agent:latest`

Caddy serves the frontend and proxies `/api/*` to `legend-voice-api:8787`.

Build targets:

```bash
docker build -f Dockerfile.frontend --target production -t ghcr.io/annahrunova/legend-frontend:latest .
docker build -f Dockerfile.frontend --target voice-api -t ghcr.io/annahrunova/legend-voice-api:latest .
docker build -f Dockerfile.frontend --target voice-agent -t ghcr.io/annahrunova/legend-voice-agent:latest .
```
