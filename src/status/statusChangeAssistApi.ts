import type { KnownIssue, Ticket, TicketStatus } from '../domain/types';
import type { StatusBackendSignal, StatusRequirementDefinition } from '../domain/statusRequirements';

export interface StatusChangeAssistRequest {
  status: TicketStatus;
  ticket: Ticket;
  requirement: StatusRequirementDefinition;
  knownIssue?: KnownIssue;
  duplicateCount: number;
}

export interface StatusChangeAssistResponse {
  values: Record<string, string>;
  aiPrefilledFieldIds: string[];
  backendSignals: StatusBackendSignal[];
  model?: string;
  agentName?: string;
}

const apiBaseUrl = import.meta.env.VITE_VOICE_API_BASE_URL ?? '/api';

export async function requestStatusChangeAssist(
  payload: StatusChangeAssistRequest,
): Promise<StatusChangeAssistResponse> {
  const response = await fetch(`${apiBaseUrl}/status-change-assist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Status change assist failed with ${response.status}`);
  }

  return response.json() as Promise<StatusChangeAssistResponse>;
}
