import type { Ticket, VoiceAppContext } from '../domain/types';

export interface StartVoiceSessionRequest {
  ticketId: string;
  voiceSessionId: string;
  roomName: string;
  appContext: VoiceAppContext;
}

export interface StartVoiceSessionResponse {
  voiceSessionId: string;
  ticketId: string;
  roomName: string;
  livekitUrl?: string;
  supportToken?: string;
  customerToken?: string;
  agentDispatchId?: string;
  mode: 'livekit' | 'mock';
  setupWarnings: string[];
}

export interface StartMobileVoiceSessionResponse extends StartVoiceSessionResponse {
  ticket: Ticket;
}

const apiBaseUrl = import.meta.env.VITE_VOICE_API_BASE_URL ?? '/api';

export async function startVoiceSession(
  payload: StartVoiceSessionRequest,
): Promise<StartVoiceSessionResponse> {
  const response = await fetch(`${apiBaseUrl}/voice-sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Voice session API failed with ${response.status}`);
  }

  return response.json() as Promise<StartVoiceSessionResponse>;
}

export async function startMobileVoiceSession(
  appContext: VoiceAppContext,
): Promise<StartMobileVoiceSessionResponse> {
  const response = await fetch(`${apiBaseUrl}/mobile-voice-sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ appContext }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Mobile voice session API failed with ${response.status}`);
  }

  return response.json() as Promise<StartMobileVoiceSessionResponse>;
}

export async function listMobileVoiceTickets(): Promise<Ticket[]> {
  const response = await fetch(`${apiBaseUrl}/mobile-voice-sessions/tickets`);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Mobile voice tickets API failed with ${response.status}`);
  }

  const payload = (await response.json()) as { tickets?: Ticket[] };
  return payload.tickets ?? [];
}

export async function endVoiceRoom(roomName: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/voice-sessions/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomName }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Voice session end API failed with ${response.status}`);
  }
}
