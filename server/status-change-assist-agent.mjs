import { refreshCodexModelAuth, resolveCodexModelAuth, resolveFreshCodexModelAuth } from './codex-model-auth.mjs';

const AGENT_NAME = 'legend-status-change-assist-agent';
const DEFAULT_MODEL = 'gpt-5.5';
const MODEL_TIMEOUT_MS = 60_000;
const MAX_TEXT_CHARS = 5_500;

const BACKEND_SIGNAL_CATALOG = [
  {
    id: 'missing_payment_provider',
    label: 'Payment provider missing',
    detail: 'Capture provider or rail before backend design decisions.',
  },
  {
    id: 'missing_transaction_reference',
    label: 'Transaction reference missing',
    detail: 'A transaction or charge reference would make payment triage traceable.',
  },
  {
    id: 'missing_platform',
    label: 'Platform missing',
    detail: 'Capture iOS or Android for mobile support patterns.',
  },
  {
    id: 'missing_app_version',
    label: 'App version missing',
    detail: 'Version is needed to connect support behavior to releases.',
  },
  {
    id: 'known_issue_not_linked',
    label: 'Known issue not linked',
    detail: 'A matching known issue exists but is not linked to the ticket.',
  },
  {
    id: 'possible_duplicate_not_linked',
    label: 'Possible duplicate not linked',
    detail: 'Related tickets can explain repeated status changes.',
  },
];

export async function assistStatusChange(payload) {
  const request = normalizeAssistRequest(payload);
  let modelAuth = await resolveFreshCodexModelAuth({ agentName: AGENT_NAME });
  const model = process.env.STATUS_ASSIST_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const content = renderPrompt(request);
  let text;
  try {
    text = await createResponse({ modelAuth, model, content });
  } catch (error) {
    if (!isExpiredTokenError(error)) throw error;
    modelAuth = await refreshCodexModelAuth({ agentName: AGENT_NAME });
    text = await createResponse({ modelAuth, model, content });
  }
  const parsed = parseJsonResponse(text);

  const values = validateValues(parsed.values, request.requirement.fields);
  return {
    values,
    aiPrefilledFieldIds: Object.keys(values),
    backendSignals: validateBackendSignals(parsed.backendSignalIds),
    model,
    agentName: AGENT_NAME,
  };
}

export function statusAssistHealth() {
  try {
    resolveCodexModelAuth({ agentName: AGENT_NAME });
    return { configured: true, agentName: AGENT_NAME };
  } catch (error) {
    return { configured: false, agentName: AGENT_NAME, error: error.message };
  }
}

function normalizeAssistRequest(payload) {
  const status = stringOrUndefined(payload?.status);
  const ticket = payload?.ticket && typeof payload.ticket === 'object' ? payload.ticket : undefined;
  const requirement = payload?.requirement && typeof payload.requirement === 'object' ? payload.requirement : undefined;
  const fields = Array.isArray(requirement?.fields) ? requirement.fields.map(normalizeField).filter(Boolean) : [];

  if (!status || !ticket || !requirement || !fields.length) {
    throw new Error('status, ticket, and requirement.fields are required');
  }

  return {
    status,
    ticket: compactTicket(ticket),
    requirement: {
      status,
      title: stringOrUndefined(requirement.title) ?? `${status} details`,
      fields,
    },
    context: {
      knownIssue: compactKnownIssue(payload?.knownIssue),
      duplicateCount: Number.isFinite(payload?.duplicateCount) ? payload.duplicateCount : 0,
    },
  };
}

function normalizeField(field) {
  if (!field || typeof field !== 'object') return undefined;
  const id = stringOrUndefined(field.id);
  const label = stringOrUndefined(field.label);
  const kind = stringOrUndefined(field.kind);
  if (!id || !label || !['select', 'text', 'date'].includes(kind)) return undefined;

  return {
    id,
    label,
    kind,
    required: Boolean(field.required),
    options: Array.isArray(field.options)
      ? field.options.map(stringOrUndefined).filter(Boolean).slice(0, 20)
      : [],
  };
}

function compactTicket(ticket) {
  return {
    id: stringOrUndefined(ticket.id),
    subject: stringOrUndefined(ticket.subject),
    description: stringOrUndefined(ticket.description),
    priority: stringOrUndefined(ticket.priority),
    status: stringOrUndefined(ticket.status),
    team: stringOrUndefined(ticket.team),
    tags: Array.isArray(ticket.tags) ? ticket.tags.map(stringOrUndefined).filter(Boolean).slice(0, 20) : [],
    source: stringOrUndefined(ticket.source),
    reviewSource: stringOrUndefined(ticket.reviewSource),
    platform: stringOrUndefined(ticket.platform),
    rating: Number.isFinite(ticket.rating) ? ticket.rating : undefined,
    appVersion: stringOrUndefined(ticket.appVersion),
    projectIds: Array.isArray(ticket.projectIds) ? ticket.projectIds.map(stringOrUndefined).filter(Boolean) : [],
    knownIssueIds: Array.isArray(ticket.knownIssueIds) ? ticket.knownIssueIds.map(stringOrUndefined).filter(Boolean) : [],
    relatedTicketIds: Array.isArray(ticket.relatedTicketIds) ? ticket.relatedTicketIds.map(stringOrUndefined).filter(Boolean) : [],
    messages: Array.isArray(ticket.messages)
      ? ticket.messages.slice(-8).map((message) => ({
          kind: stringOrUndefined(message.kind),
          authorRole: stringOrUndefined(message.authorRole),
          body: truncate(stringOrUndefined(message.body) ?? '', 900),
        }))
      : [],
    voiceSession: ticket.voiceSession
      ? {
          detectedIntent: stringOrUndefined(ticket.voiceSession.detectedIntent),
          summary: stringOrUndefined(ticket.voiceSession.summary),
          activityContext: compactActivityContext(ticket.voiceSession.activityContext),
          appContext: ticket.voiceSession.appContext
            ? {
                platform: stringOrUndefined(ticket.voiceSession.appContext.platform),
                appVersion: stringOrUndefined(ticket.voiceSession.appContext.appVersion),
                currentScreen: stringOrUndefined(ticket.voiceSession.appContext.currentScreen),
                lastAction: stringOrUndefined(ticket.voiceSession.appContext.lastAction),
                recentErrors: Array.isArray(ticket.voiceSession.appContext.recentErrors)
                  ? ticket.voiceSession.appContext.recentErrors.map(stringOrUndefined).filter(Boolean).slice(0, 5)
                  : [],
              }
            : undefined,
        }
      : undefined,
  };
}

function compactActivityContext(activityContext) {
  if (!activityContext || typeof activityContext !== 'object') return undefined;
  return {
    summary: stringOrUndefined(activityContext.summary),
    riskLevel: stringOrUndefined(activityContext.riskLevel),
    lastSeenAt: stringOrUndefined(activityContext.lastSeenAt),
    recentErrors: Array.isArray(activityContext.recentErrors)
      ? activityContext.recentErrors.map(stringOrUndefined).filter(Boolean).slice(0, 10)
      : [],
    lastActions: compactActivityItems(activityContext.lastActions, 6),
    recentBackendEvents: compactActivityItems(activityContext.recentBackendEvents, 6),
    paymentContext: activityContext.paymentContext
      ? {
          provider: stringOrUndefined(activityContext.paymentContext.provider),
          method: stringOrUndefined(activityContext.paymentContext.method),
          transactionReference: stringOrUndefined(activityContext.paymentContext.transactionReference),
          lastAttemptStatus: stringOrUndefined(activityContext.paymentContext.lastAttemptStatus),
          amount: stringOrUndefined(activityContext.paymentContext.amount),
          currency: stringOrUndefined(activityContext.paymentContext.currency),
        }
      : undefined,
    linkedKnownIssue: activityContext.linkedKnownIssue
      ? {
          id: stringOrUndefined(activityContext.linkedKnownIssue.id),
          title: stringOrUndefined(activityContext.linkedKnownIssue.title),
          status: stringOrUndefined(activityContext.linkedKnownIssue.status),
        }
      : undefined,
    duplicateHints: Array.isArray(activityContext.duplicateHints)
      ? activityContext.duplicateHints.slice(0, 5).map((hint) => ({
          ticketId: stringOrUndefined(hint.ticketId),
          reason: stringOrUndefined(hint.reason),
          status: stringOrUndefined(hint.status),
        }))
      : [],
    backendSignals: Array.isArray(activityContext.backendSignals)
      ? activityContext.backendSignals.slice(0, 8).map((signal) => ({
          id: stringOrUndefined(signal.id),
          label: stringOrUndefined(signal.label),
          detail: stringOrUndefined(signal.detail),
        }))
      : [],
  };
}

function compactActivityItems(items, limit) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map((item) => ({
    occurredAt: stringOrUndefined(item.occurredAt),
    source: stringOrUndefined(item.source),
    label: stringOrUndefined(item.label),
    detail: stringOrUndefined(item.detail),
    outcome: stringOrUndefined(item.outcome),
  }));
}

function compactKnownIssue(issue) {
  if (!issue || typeof issue !== 'object') return undefined;
  return {
    id: stringOrUndefined(issue.id),
    title: stringOrUndefined(issue.title),
    description: stringOrUndefined(issue.description),
    status: stringOrUndefined(issue.status),
    topicIds: Array.isArray(issue.topicIds) ? issue.topicIds.map(stringOrUndefined).filter(Boolean) : [],
    projectIds: Array.isArray(issue.projectIds) ? issue.projectIds.map(stringOrUndefined).filter(Boolean) : [],
  };
}

function renderPrompt(request) {
  return [
    {
      type: 'input_text',
      text: [
        'You are Legend Status Change Assist Agent.',
        'You help a support agent complete a status-change drawer in LegendDesk.',
        'This is a frontend prototype, but your output must be production-disciplined.',
        '',
        'Hard rules:',
        '- Use ONLY the provided requirement.fields.',
        '- For select fields, choose ONLY an exact option from that field options array.',
        '- For date fields, return YYYY-MM-DD only.',
        '- Do not invent fields, statuses, options, backend signal IDs, policies, refunds, auth flows, or backend state.',
        '- If evidence is insufficient for a field, omit that field from values.',
        '- Backend signals must be selected only from backendSignalCatalog IDs.',
        '- Return JSON only, no markdown.',
        '',
        'JSON shape:',
        '{"values":{"field_id":"allowed value"},"backendSignalIds":["allowed_signal_id"]}',
        '',
        `Today: ${new Date().toISOString().slice(0, 10)}`,
        `Status: ${request.status}`,
        `Requirement: ${JSON.stringify(request.requirement, null, 2)}`,
        `Backend signal catalog: ${JSON.stringify(BACKEND_SIGNAL_CATALOG.map(({ id, label }) => ({ id, label })), null, 2)}`,
        `Ticket and context: ${truncate(JSON.stringify({ ticket: request.ticket, context: request.context }, null, 2), MAX_TEXT_CHARS)}`,
      ].join('\n'),
    },
  ];
}

async function createResponse({ modelAuth, model, content }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const response = await fetch(`${modelAuth.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...modelAuth.headers,
      },
      body: JSON.stringify({
        model,
        instructions:
          'You are Legend Status Change Assist Agent. Return only strict JSON for the provided status field contract.',
        store: false,
        stream: true,
        reasoning: { effort: 'low' },
        input: [{ role: 'user', content }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new CodexResponseError(response.status, errorBody);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return readStreamedOutput(response);
    const json = await response.json().catch(() => undefined);
    return extractOutputText(json);
  } finally {
    clearTimeout(timer);
  }
}

class CodexResponseError extends Error {
  constructor(status, body) {
    super(`Codex Responses API failed: HTTP ${status} ${body}`);
    this.name = 'CodexResponseError';
    this.status = status;
    this.body = body;
  }
}

function isExpiredTokenError(error) {
  return error instanceof CodexResponseError && error.status === 401 && error.body.includes('token_expired');
}

async function readStreamedOutput(response) {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let buffer = '';
  let deltaText = '';
  let finalText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (!event) continue;
      const text = extractStreamText(event);
      deltaText += text.delta;
      if (text.final) finalText = text.final;
    }
  }

  buffer += decoder.decode();
  const event = parseSseBlock(buffer);
  if (event) {
    const text = extractStreamText(event);
    deltaText += text.delta;
    if (text.final) finalText = text.final;
  }

  return (deltaText || finalText).trim();
}

function parseSseBlock(block) {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();

  if (!data || data === '[DONE]') return undefined;
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

function extractStreamText(event) {
  if (typeof event?.delta === 'string' && event.type === 'response.output_text.delta') {
    return { delta: event.delta, final: '' };
  }

  if (typeof event?.text === 'string' && event.type === 'response.output_text.done') {
    return { delta: '', final: event.text };
  }

  if (event?.type === 'response.completed' || event?.type === 'response.done') {
    return { delta: '', final: extractOutputText(event.response ?? event) };
  }

  if (typeof event?.output_text === 'string') {
    return { delta: '', final: event.output_text };
  }

  return { delta: '', final: '' };
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  const chunks = [];
  for (const item of response?.output ?? []) {
    for (const part of item.content ?? []) {
      if (typeof part.text === 'string') chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
}

function parseJsonResponse(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Status assist response was not JSON: ${trimmed.slice(0, 300)}`);
    return JSON.parse(match[0]);
  }
}

function validateValues(values, fields) {
  if (!values || typeof values !== 'object') return {};
  const accepted = {};
  for (const field of fields) {
    const value = stringOrUndefined(values[field.id]);
    if (!value) continue;
    if (field.kind === 'select' && field.options.includes(value)) {
      accepted[field.id] = value;
    } else if (field.kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      accepted[field.id] = value;
    } else if (field.kind === 'text') {
      accepted[field.id] = truncate(value, 400);
    }
  }
  return accepted;
}

function validateBackendSignals(signalIds) {
  const allowed = new Map(BACKEND_SIGNAL_CATALOG.map((signal) => [signal.id, signal]));
  if (!Array.isArray(signalIds)) return [];
  return [...new Set(signalIds.map(stringOrUndefined).filter(Boolean))]
    .map((id) => allowed.get(id))
    .filter(Boolean);
}

function stringOrUndefined(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
