import { ServerOptions, cli, defineAgent, voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const agentName = process.env.LIVEKIT_AGENT_NAME ?? 'legend-voice-agent';
const realtimeVoice = process.env.OPENAI_REALTIME_VOICE ?? 'coral';

class LegendDeskVoiceAgent extends voice.Agent {
  constructor(sessionContext) {
    super({
      instructions: buildInstructions(sessionContext),
    });
  }
}

export default defineAgent({
  entry: async (ctx) => {
    const sessionContext = parseMetadata(ctx.job?.metadata);
    console.log('[legend-voice-agent] job received', {
      room: ctx.room.name,
      ticketId: sessionContext.ticketId,
      voiceSessionId: sessionContext.voiceSessionId,
    });

    await ctx.connect();
    const participant = await ctx.waitForParticipant();
    console.log('[legend-voice-agent] participant linked', {
      identity: participant.identity,
      kind: participant.info?.kind,
    });

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        voice: realtimeVoice,
      }),
    });

    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (event) => {
      console.log('[legend-voice-agent] agent state changed', {
        oldState: event.oldState,
        newState: event.newState,
      });
    });
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
      console.log('[legend-voice-agent] user transcribed', {
        isFinal: event.isFinal,
        transcriptLength: event.transcript.length,
      });
    });
    session.on(voice.AgentSessionEventTypes.Error, (event) => {
      console.error('[legend-voice-agent] session error', event.error);
    });
    session.on(voice.AgentSessionEventTypes.Close, (event) => {
      console.log('[legend-voice-agent] session closed', {
        reason: event.reason,
        error: event.error,
      });
    });

    await session.start({
      agent: new LegendDeskVoiceAgent(sessionContext),
      room: ctx.room,
      inputOptions: {
        participantIdentity: participant.identity,
      },
    });
    await session.generateReply({
      instructions:
        'Start with one concise contextual sentence. Mention the screen or recent error if present, then ask the user to confirm the problem.',
    });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName }));

function parseMetadata(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function buildInstructions(sessionContext) {
  const appContext = sessionContext.appContext ?? {};
  const recentErrors = Array.isArray(appContext.recentErrors)
    ? appContext.recentErrors.join(', ')
    : 'none';

  return `You are LegendDesk's in-app support voice agent.

The user is already authenticated in the mobile app. Do not ask for email, name, or account identity unless the user explicitly says the account context is wrong.

Use the mobile app context before asking broad discovery questions:
- User: ${appContext.fullName ?? 'unknown'}
- Email: ${appContext.email ?? 'unknown'}
- Platform: ${appContext.platform ?? 'unknown'}
- App version: ${appContext.appVersion ?? 'unknown'}
- Current screen: ${appContext.currentScreen ?? 'unknown'}
- Last action: ${appContext.lastAction ?? 'unknown'}
- Recent errors: ${recentErrors}

Your job:
1. Confirm the likely issue from context.
2. Ask at most one focused clarifying question at a time.
3. Keep spoken answers short.
4. If confidence is low, if the user asks for a person, or if the issue needs manual account/payment action, say you will connect a support specialist.
5. Never claim that a backend action was completed unless a tool confirmed it.

This is a prototype. Do not invent policies, refunds, passwords, OAuth flows, or backend state.`;
}
