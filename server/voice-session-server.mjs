import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.VOICE_API_PORT ?? process.env.PORT ?? 8787);
const livekitUrl = process.env.LIVEKIT_URL;
const livekitApiKey = process.env.LIVEKIT_API_KEY;
const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
const agentName = process.env.LIVEKIT_AGENT_NAME ?? 'legend-voice-agent';

app.use(cors({ origin: process.env.VOICE_API_CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '256kb' }));

app.get('/healthz', (_request, response) => {
  response.json({
    ok: true,
    livekitConfigured: hasLiveKitConfig(),
    agentName,
  });
});

app.post('/api/voice-sessions', async (request, response) => {
  const payload = request.body ?? {};
  const ticketId = stringOrUndefined(payload.ticketId);
  const voiceSessionId = stringOrUndefined(payload.voiceSessionId);
  const requestedRoomName = stringOrUndefined(payload.roomName);
  const appContext = payload.appContext && typeof payload.appContext === 'object'
    ? payload.appContext
    : undefined;

  if (!ticketId || !voiceSessionId || !requestedRoomName || !appContext) {
    response.status(400).send('ticketId, voiceSessionId, roomName, and appContext are required');
    return;
  }

  const roomName = safeRoomName(requestedRoomName);
  const setupWarnings = [];

  if (!hasLiveKitConfig()) {
    response.json({
      ticketId,
      voiceSessionId,
      roomName,
      mode: 'mock',
      setupWarnings: [
        'LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are not configured. Returning mock voice session metadata.',
      ],
    });
    return;
  }

  try {
    const roomService = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret);
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 60,
      maxParticipants: 4,
      metadata: JSON.stringify({ ticketId, voiceSessionId, appContext }),
    });

    let agentDispatchId;
    try {
      const dispatchClient = new AgentDispatchClient(livekitUrl, livekitApiKey, livekitApiSecret);
      const dispatch = await dispatchClient.createDispatch(roomName, agentName, {
        metadata: JSON.stringify({ ticketId, voiceSessionId, appContext }),
      });
      agentDispatchId = dispatch.id;
    } catch (error) {
      setupWarnings.push(`Agent dispatch failed: ${errorMessage(error)}`);
    }

    const supportToken = await createParticipantToken({
      identity: `support:${ticketId}`,
      name: 'LegendDesk support',
      roomName,
      metadata: { role: 'support_agent', ticketId, voiceSessionId },
    });
    const customerToken = await createParticipantToken({
      identity: `customer:${appContext.userId ?? voiceSessionId}`,
      name: appContext.fullName ?? 'Mobile customer',
      roomName,
      metadata: { role: 'mobile_customer', ticketId, voiceSessionId },
    });

    response.json({
      ticketId,
      voiceSessionId,
      roomName,
      livekitUrl: livekitUrl.replace(/^http/, 'ws'),
      supportToken,
      customerToken,
      agentDispatchId,
      mode: 'livekit',
      setupWarnings,
    });
  } catch (error) {
    response.status(502).send(`Unable to start LiveKit voice session: ${errorMessage(error)}`);
  }
});

app.listen(port, () => {
  console.log(`[voice-api] listening on :${port}`);
});

function hasLiveKitConfig() {
  return Boolean(livekitUrl && livekitApiKey && livekitApiSecret);
}

function stringOrUndefined(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function safeRoomName(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 96);
}

async function createParticipantToken({ identity, name, roomName, metadata }) {
  const token = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity,
    name,
    ttl: '30m',
    metadata: JSON.stringify(metadata),
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return token.toJwt();
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
