import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import pg from 'pg';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.VOICE_API_PORT ?? process.env.PORT ?? 8787);
const livekitUrl = process.env.LIVEKIT_URL;
const livekitApiKey = process.env.LIVEKIT_API_KEY;
const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
const agentName = process.env.LIVEKIT_AGENT_NAME ?? 'legend-voice-agent';
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl }) : undefined;
let databaseReady = false;

app.use(cors({ origin: process.env.VOICE_API_CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '256kb' }));

app.get('/healthz', (_request, response) => {
  response.json({
    ok: true,
    livekitConfigured: hasLiveKitConfig(),
    databaseConfigured: Boolean(pool),
    databaseReady,
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
  try {
    const started = await createLiveKitVoiceSession({
      ticketId,
      voiceSessionId,
      roomName,
      appContext,
    });
    response.json(started);
  } catch (error) {
    response.status(502).send(`Unable to start LiveKit voice session: ${errorMessage(error)}`);
  }
});

app.post('/api/mobile-voice-sessions', async (request, response) => {
  const payload = request.body ?? {};
  const appContext = payload.appContext && typeof payload.appContext === 'object'
    ? payload.appContext
    : undefined;

  if (!appContext) {
    response.status(400).send('appContext is required');
    return;
  }

  try {
    const now = new Date().toISOString();
    const ticketId = await nextVoiceTicketId();
    const voiceSessionId = `voice_${crypto.randomUUID()}`;
    const roomName = safeRoomName(`legend-${voiceSessionId}`);
    const started = await createLiveKitVoiceSession({
      ticketId,
      voiceSessionId,
      roomName,
      appContext,
    });
    const ticket = buildMobileVoiceTicket({
      ticketId,
      now,
      appContext,
      voiceSession: {
        id: voiceSessionId,
        roomName: started.roomName,
        status: started.mode === 'livekit' ? 'ai_active' : 'connecting',
        callStatus: 'connecting',
        startedAt: now,
        livekitUrl: started.livekitUrl,
        supportToken: started.supportToken,
        customerToken: started.customerToken,
        agentDispatchId: started.agentDispatchId,
        mode: started.mode,
        appContext,
        detectedIntent: detectVoiceIntent(appContext),
        summary: voiceSummary(appContext),
        transcript: initialVoiceTranscript(now),
        setupWarnings: started.setupWarnings,
      },
    });

    await saveVoiceTicket(ticket);
    response.status(201).json({
      ...started,
      ticket,
    });
  } catch (error) {
    response.status(502).send(`Unable to start mobile voice session: ${errorMessage(error)}`);
  }
});

app.get('/api/mobile-voice-sessions/tickets', async (_request, response) => {
  try {
    response.json({ tickets: await listVoiceTickets() });
  } catch (error) {
    response.status(502).send(`Unable to list mobile voice tickets: ${errorMessage(error)}`);
  }
});

app.post('/api/voice-sessions/end', async (request, response) => {
  const payload = request.body ?? {};
  const requestedRoomName = stringOrUndefined(payload.roomName);

  if (!requestedRoomName) {
    response.status(400).send('roomName is required');
    return;
  }

  const roomName = safeRoomName(requestedRoomName);

  if (!hasLiveKitConfig()) {
    response.json({ roomName, mode: 'mock', ended: true });
    return;
  }

  try {
    await deleteLiveKitRoom(roomName);
    response.json({ roomName, mode: 'livekit', ended: true });
  } catch (error) {
    const message = errorMessage(error);
    const normalizedMessage = message.toLowerCase();
    if (normalizedMessage.includes('not found') || normalizedMessage.includes('not_found')) {
      response.json({ roomName, mode: 'livekit', ended: true, alreadyEnded: true });
      return;
    }

    response.status(502).send(`Unable to end LiveKit voice session: ${message}`);
  }
});

await initializeDatabase();

app.listen(port, () => {
  console.log(`[voice-api] listening on :${port}`);
});

function hasLiveKitConfig() {
  return Boolean(livekitUrl && livekitApiKey && livekitApiSecret);
}

async function initializeDatabase() {
  if (!pool) return;
  const migration = `
      CREATE SEQUENCE IF NOT EXISTS voice_ticket_number_seq START 2000;

      CREATE TABLE IF NOT EXISTS voice_tickets (
        id text PRIMARY KEY,
        ticket jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await pool.query(migration);
      databaseReady = true;
      return;
    } catch (error) {
      if (attempt === 10) throw error;
      console.warn(`[voice-api] waiting for postgres (${attempt}/10): ${errorMessage(error)}`);
      await delay(1000);
    }
  }
}

async function nextVoiceTicketId() {
  if (!pool) {
    return `TCK-${Date.now().toString(36).toUpperCase()}`;
  }
  const result = await pool.query(`SELECT nextval('voice_ticket_number_seq') AS value`);
  return `TCK-${result.rows[0].value}`;
}

async function saveVoiceTicket(ticket) {
  if (!pool) return;
  await pool.query(
    `
      INSERT INTO voice_tickets (id, ticket, created_at, updated_at)
      VALUES ($1, $2::jsonb, $3, $4)
      ON CONFLICT (id) DO UPDATE
      SET ticket = EXCLUDED.ticket,
          updated_at = EXCLUDED.updated_at
    `,
    [ticket.id, JSON.stringify(ticket), ticket.createdAt, ticket.updatedAt],
  );
}

async function listVoiceTickets() {
  if (!pool) return [];
  const result = await pool.query(`
    SELECT ticket
    FROM voice_tickets
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return result.rows.map((row) => row.ticket);
}

async function createLiveKitVoiceSession({ ticketId, voiceSessionId, roomName, appContext }) {
  const setupWarnings = [];

  if (!hasLiveKitConfig()) {
    return {
      ticketId,
      voiceSessionId,
      roomName,
      mode: 'mock',
      setupWarnings: [
        'LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are not configured. Returning mock voice session metadata.',
      ],
    };
  }

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

  return {
    ticketId,
    voiceSessionId,
    roomName,
    livekitUrl: livekitUrl.replace(/^http/, 'ws'),
    supportToken,
    customerToken,
    agentDispatchId,
    mode: 'livekit',
    setupWarnings,
  };
}

function buildMobileVoiceTicket({ ticketId, now, appContext, voiceSession }) {
  return {
    id: ticketId,
    subject: voiceSubject(appContext),
    description: 'Authenticated mobile user started a contextual voice support session.',
    customerId: appContext.userId ?? `customer-${ticketId}`,
    customerName: appContext.fullName ?? 'Mobile customer',
    customerEmail: appContext.email ?? 'unknown@example.com',
    company: 'Mobile App',
    priority: 'High',
    status: 'Open',
    assigneeId: null,
    assigneeName: 'Unassigned',
    team: 'Billing',
    tags: ['voice', 'in-app', 'mobile'],
    createdAt: now,
    updatedAt: now,
    topicId: 'payment-failed',
    projectIds: ['billing-platform'],
    source: 'support',
    platform: appContext.platform,
    appVersion: appContext.appVersion,
    relatedTicketIds: [],
    mergedTicketIds: [],
    knownIssueIds: [],
    voiceSession,
    sla: {
      state: 'Due soon',
      firstResponseDueAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      resolutionDueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
    messages: [
      {
        id: crypto.randomUUID(),
        kind: 'customer',
        authorName: appContext.fullName ?? 'Mobile customer',
        authorRole: 'Customer',
        body: 'Voice session started from the mobile app with authenticated app context attached.',
        createdAt: now,
      },
    ],
    activity: [
      {
        id: crypto.randomUUID(),
        actorName: 'Legend Voice',
        action: 'Created voice ticket from mobile voice API',
        createdAt: now,
      },
    ],
  };
}

function voiceSubject(appContext) {
  if (String(appContext.currentScreen ?? '').includes('payment')) {
    return 'In-app voice: payment failed after 3DS';
  }
  return `In-app voice: ${appContext.currentScreen ?? 'mobile support'}`;
}

function voiceSummary(appContext) {
  return `Customer started an in-app voice session from ${appContext.currentScreen ?? 'the mobile app'} after ${appContext.lastAction ?? 'an app action'}.`;
}

function detectVoiceIntent(appContext) {
  const errors = Array.isArray(appContext.recentErrors) ? appContext.recentErrors.join('_') : '';
  if (/payment|3ds|card/i.test(`${appContext.currentScreen ?? ''}_${appContext.lastAction ?? ''}_${errors}`)) {
    return 'payment_failed_after_3ds';
  }
  return 'mobile_support_request';
}

function initialVoiceTranscript(now) {
  return [
    {
      id: crypto.randomUUID(),
      speaker: 'system',
      text: 'In-app voice session started with authenticated mobile context.',
      createdAt: now,
      isFinal: true,
    },
  ];
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

async function deleteLiveKitRoom(roomName) {
  const token = new AccessToken(livekitApiKey, livekitApiSecret, { ttl: '2m' });
  token.addGrant({
    room: roomName,
    roomAdmin: true,
    roomCreate: true,
    roomList: true,
  });

  const response = await fetch(`${livekitHttpUrl()}/twirp/livekit.RoomService/DeleteRoom`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await token.toJwt()}`,
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({ room: roomName }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `LiveKit deleteRoom failed with ${response.status}`);
  }
}

function livekitHttpUrl() {
  return livekitUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '');
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
