import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { mockTickets } from '../data/mockTickets';
import { agents } from '../data/mockUsers';
import { customers } from '../data/mockCustomers';
import { topics } from '../analytics/topics/domain';
import { buildMockActivityContext } from '../data/mockActivityContext';
import { initialVoiceTranscript } from '../data/mockVoiceSupport';
import { getActiveAgent } from './activeAgent';
import type {
  Priority,
  Ticket,
  TicketDraft,
  TicketStatus,
  VoiceAppContext,
  VoiceSession,
} from '../domain/types';

const STORAGE_KEY = 'legend.support.tickets.v1';

interface TicketStore {
  tickets: Ticket[];
  getTicket: (id: string) => Ticket | undefined;
  updateTicket: (id: string, patch: Partial<Ticket>, activity: string, actorName?: string) => void;
  updateTicketSilently: (id: string, patch: Partial<Ticket>) => void;
  upsertTicketsSilently: (incomingTickets: Ticket[]) => void;
  assignToCurrentUser: (ids: string[]) => void;
  bulkUpdateStatus: (ids: string[], status: TicketStatus) => void;
  bulkUpdatePriority: (ids: string[], priority: Priority) => void;
  bulkAddTag: (ids: string[], tag: string) => void;
  addInternalNote: (id: string, body: string) => void;
  addPublicReply: (id: string, body: string) => void;
  createTicket: (draft: TicketDraft) => Ticket;
  createVoiceTicket: (appContext: VoiceAppContext) => Ticket;
}

const TicketContext = createContext<TicketStore | null>(null);

function readTickets(): Ticket[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeTickets(JSON.parse(stored) as Ticket[]) : mockTickets;
  } catch {
    return mockTickets;
  }
}

function normalizeTickets(tickets: Ticket[]): Ticket[] {
  const normalized = tickets.map((ticket, index) => {
    const topic = topics[index % topics.length] ?? topics[0]!;
    const legacyReview = ticket.source === ('app_store' as Ticket['source']);
    const reviewSource = ticket.reviewSource ?? (legacyReview || ticket.source === 'review'
      ? ticket.platform === 'android' ? 'google_play' : 'app_store'
      : undefined);
    const platform: Ticket['platform'] | undefined = reviewSource
      ? reviewSource === 'google_play' ? 'android' : 'ios'
      : ticket.platform;
    return {
      ...ticket,
      topicId: ticket.topicId ?? topic.id,
      projectIds: ticket.projectIds ?? topic.projectIds,
      source: legacyReview ? 'review' : ticket.source ?? 'support',
      ...(reviewSource ? { reviewSource } : {}),
      ...(platform ? { platform } : {}),
      relatedTicketIds: ticket.relatedTicketIds ?? [],
      mergedTicketIds: ticket.mergedTicketIds ?? [],
      knownIssueIds: ticket.knownIssueIds ?? [],
      statusDetails: ticket.statusDetails ?? [],
      ...(ticket.voiceSession
        ? {
            voiceSession: {
              callStatus:
                ticket.voiceSession.callStatus ??
                (ticket.voiceSession.status === 'resolved' || ticket.voiceSession.status === 'abandoned'
                  ? 'ended'
                  : ticket.voiceSession.status === 'failed'
                    ? 'failed'
                    : 'connecting'),
              ...ticket.voiceSession,
            },
          }
        : {}),
    };
  });

  if (normalized.some((ticket) => ticket.source === 'review')) {
    return normalized;
  }

  const existingIds = new Set(normalized.map((ticket) => ticket.id));
  return [
    ...normalized,
    ...mockTickets.filter((ticket) => ticket.source === 'review' && !existingIds.has(ticket.id)),
  ];
}

function nowIso(): string {
  return new Date().toISOString();
}

function activity(actorName: string, action: string) {
  return {
    id: crypto.randomUUID(),
    actorName,
    action,
    createdAt: nowIso(),
  };
}

export function TicketProvider({ children }: { children: ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>(readTickets);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  }, [tickets]);

  const updateTicket = useCallback(
    (id: string, patch: Partial<Ticket>, action: string, actorName = getActiveAgent().name) => {
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === id
            ? {
                ...ticket,
                ...patch,
                ...(patch.voiceSession && ticket.voiceSession
                  ? { voiceSession: { ...ticket.voiceSession, ...patch.voiceSession } }
                  : {}),
                updatedAt: nowIso(),
                activity: [activity(actorName, action), ...ticket.activity],
              }
            : ticket,
        ),
      );
    },
    [],
  );

  const updateTicketSilently = useCallback((id: string, patch: Partial<Ticket>) => {
    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === id
          ? {
              ...ticket,
              ...patch,
              ...(patch.voiceSession && ticket.voiceSession
                ? { voiceSession: { ...ticket.voiceSession, ...patch.voiceSession } }
                : {}),
              updatedAt: nowIso(),
            }
          : ticket,
      ),
    );
  }, []);

  const upsertTicketsSilently = useCallback((incomingTickets: Ticket[]) => {
    if (!incomingTickets.length) return;
    setTickets((current) => {
      const existingIds = new Set(current.map((ticket) => ticket.id));
      const newTickets = incomingTickets.filter((ticket) => !existingIds.has(ticket.id));
      return newTickets.length ? normalizeTickets([...newTickets, ...current]) : current;
    });
  }, []);

  const assignToCurrentUser = useCallback((ids: string[]) => {
    const activeAgent = getActiveAgent();
    setTickets((current) =>
      current.map((ticket) =>
        ids.includes(ticket.id)
          ? {
              ...ticket,
              assigneeId: activeAgent.id,
              assigneeName: activeAgent.name,
              updatedAt: nowIso(),
              activity: [activity(activeAgent.name, 'Assigned to current user'), ...ticket.activity],
            }
          : ticket,
      ),
    );
  }, []);

  const bulkUpdateStatus = useCallback((ids: string[], status: TicketStatus) => {
    const activeAgent = getActiveAgent();
    setTickets((current) =>
      current.map((ticket) =>
        ids.includes(ticket.id)
          ? {
              ...ticket,
              status,
              updatedAt: nowIso(),
              activity: [activity(activeAgent.name, `Changed status to ${status}`), ...ticket.activity],
            }
          : ticket,
      ),
    );
  }, []);

  const bulkUpdatePriority = useCallback((ids: string[], priority: Priority) => {
    const activeAgent = getActiveAgent();
    setTickets((current) =>
      current.map((ticket) =>
        ids.includes(ticket.id)
          ? {
              ...ticket,
              priority,
              updatedAt: nowIso(),
              activity: [
                activity(activeAgent.name, `Changed priority to ${priority}`),
                ...ticket.activity,
              ],
            }
          : ticket,
      ),
    );
  }, []);

  const bulkAddTag = useCallback((ids: string[], tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized) return;
    const activeAgent = getActiveAgent();

    setTickets((current) =>
      current.map((ticket) =>
        ids.includes(ticket.id)
          ? {
              ...ticket,
              tags: ticket.tags.includes(normalized) ? ticket.tags : [...ticket.tags, normalized],
              updatedAt: nowIso(),
              activity: [activity(activeAgent.name, `Added tag ${normalized}`), ...ticket.activity],
            }
          : ticket,
      ),
    );
  }, []);

  const addInternalNote = useCallback((id: string, body: string) => {
    const activeAgent = getActiveAgent();
    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === id
          ? {
              ...ticket,
              updatedAt: nowIso(),
              messages: [
                ...ticket.messages,
                {
                  id: crypto.randomUUID(),
                  kind: 'internal',
                  authorName: activeAgent.name,
                  authorRole: 'Agent',
                  body,
                  createdAt: nowIso(),
                },
              ],
              activity: [activity(activeAgent.name, 'Added internal note'), ...ticket.activity],
            }
          : ticket,
      ),
    );
  }, []);

  const addPublicReply = useCallback((id: string, body: string) => {
    const activeAgent = getActiveAgent();
    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === id
          ? {
              ...ticket,
              updatedAt: nowIso(),
              messages: [
                ...ticket.messages,
                {
                  id: crypto.randomUUID(),
                  kind: 'agent',
                  authorName: activeAgent.name,
                  authorRole: 'Agent',
                  body,
                  createdAt: nowIso(),
                },
              ],
              activity: [activity(activeAgent.name, 'Added public reply'), ...ticket.activity],
            }
          : ticket,
      ),
    );
  }, []);

  const createTicket = useCallback((draft: TicketDraft) => {
    const activeAgent = getActiveAgent();
    const customer =
      customers.find((item) => item.id === draft.customerId) ??
      customers.find((item) => item.company === draft.company) ??
      customers[0];
    const nextNumber =
      Math.max(...tickets.map((ticket) => Number(ticket.id.replace('TCK-', ''))), 1000) + 1;
    const now = nowIso();
    const teamAgents = agents.filter((agent) => agent.team === draft.team);
    const topic = topics.find((item) =>
      draft.tags.some((tag) => item.keywords.some((keyword) => keyword.includes(tag.toLowerCase()))),
    ) ?? topics[0]!;
    const newTicket: Ticket = {
      id: `TCK-${nextNumber}`,
      subject: draft.subject,
      description: draft.description,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      company: draft.company || customer.company,
      priority: draft.priority,
      status: 'New',
      assigneeId: null,
      assigneeName: 'Unassigned',
      team: draft.team,
      tags: draft.tags,
      createdAt: now,
      updatedAt: now,
      topicId: topic.id,
      projectIds: topic.projectIds,
      source: 'support',
      relatedTicketIds: [],
      mergedTicketIds: [],
      knownIssueIds: [],
      sla: {
        state: draft.priority === 'Urgent' ? 'At risk' : 'Healthy',
        firstResponseDueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        resolutionDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      messages: [
        {
          id: crypto.randomUUID(),
          kind: 'customer',
          authorName: customer.name,
          authorRole: 'Customer',
          body: draft.description,
          createdAt: now,
        },
      ],
      activity: [
        activity(
          activeAgent.name,
          `Created ticket for ${teamAgents.length ? draft.team : 'support queue'}`,
        ),
      ],
    };
    setTickets((current) => [newTicket, ...current]);
    return newTicket;
  }, [tickets]);

  const createVoiceTicket = useCallback((appContext: VoiceAppContext) => {
    const customer =
      customers.find((item) => item.email === appContext.email) ??
      customers.find((item) => item.name === appContext.fullName) ??
      customers[0];
    const numericIds = tickets
      .map((ticket) => Number(ticket.id.replace('TCK-', '')))
      .filter((value) => Number.isFinite(value));
    const nextNumber = Math.max(...numericIds, 1000) + 1;
    const now = nowIso();
    const topic = topics.find((item) => item.id === 'payment-failed') ?? topics[0]!;
    const sessionId = `voice_${crypto.randomUUID()}`;
    const activityContext = buildMockActivityContext(appContext, now);
    const voiceSession: VoiceSession = {
      id: sessionId,
      roomName: `legend-${sessionId}`,
      status: 'connecting',
      callStatus: 'connecting',
      startedAt: now,
      mode: 'mock',
      appContext,
      activityContext,
      detectedIntent: 'payment_failed_after_3ds',
      summary: activityContext.summary,
      transcript: initialVoiceTranscript(now, activityContext),
    };
    const newTicket: Ticket = {
      id: `TCK-${nextNumber}`,
      subject: 'In-app voice: payment failed after 3DS',
      description:
        'Authenticated mobile user started a contextual voice support session from payment checkout.',
      customerId: customer.id,
      customerName: appContext.fullName || customer.name,
      customerEmail: appContext.email || customer.email,
      company: customer.company,
      priority: 'High',
      status: 'Open',
      assigneeId: null,
      assigneeName: 'Unassigned',
      team: 'Billing',
      tags: ['voice', 'in-app', 'payment', '3ds'],
      createdAt: now,
      updatedAt: now,
      topicId: topic.id,
      projectIds: topic.projectIds,
      source: 'support',
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
          authorName: appContext.fullName,
          authorRole: 'Customer',
          body: 'Voice session started from the mobile app with checkout context attached.',
          createdAt: now,
        },
      ],
      activity: [
        activity('Legend Voice', 'Created voice ticket from authenticated in-app session'),
        activity(
          'Activity Context',
          `Attached ${activityContext.lastActions.length} recent user actions and ${activityContext.backendSignals.length} backend signals`,
        ),
      ],
    };
    setTickets((current) => [newTicket, ...current]);
    return newTicket;
  }, [tickets]);

  const value = useMemo<TicketStore>(
    () => ({
      tickets,
      getTicket: (id) => tickets.find((ticket) => ticket.id === id),
      updateTicket,
      assignToCurrentUser,
      bulkUpdateStatus,
      bulkUpdatePriority,
      bulkAddTag,
      addInternalNote,
      addPublicReply,
      createTicket,
      createVoiceTicket,
      updateTicketSilently,
      upsertTicketsSilently,
    }),
    [
      addInternalNote,
      addPublicReply,
      assignToCurrentUser,
      bulkAddTag,
      bulkUpdatePriority,
      bulkUpdateStatus,
      createTicket,
      createVoiceTicket,
      tickets,
      updateTicket,
      updateTicketSilently,
      upsertTicketsSilently,
    ],
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTickets() {
  const context = useContext(TicketContext);
  if (!context) {
    throw new Error('useTickets must be used within TicketProvider');
  }
  return context;
}
