import { agents } from './mockUsers';
import { customers } from './mockCustomers';
import type { Priority, SlaState, Team, Ticket, TicketStatus } from '../domain/types';

const subjects = [
  'Cannot access invoice history',
  'SSO login redirects to blank page',
  'Payment marked failed after bank approval',
  'Need vendor security questionnaire completed',
  'Export job has been stuck since yesterday',
  'Webhook retries are not firing',
  'Add user to enterprise workspace',
  'Data retention policy clarification',
  'Product usage report has missing rows',
  'Refund needed for duplicate subscription',
  'API returns 429 during low traffic',
  'Unable to update billing address',
  'Feature flag behavior differs by region',
  'Attachment upload fails for PDF files',
  'Account locked after password reset',
  'Tax ID rejected during checkout',
  'Escalation requested for production incident',
  'Customer cannot see shared dashboard',
  'Compliance review for new processor',
  'Search results omit archived records',
  'Trial extension request',
  'Incorrect seat count on renewal quote',
  'Audit log export is missing IP address',
  'Mobile notification settings not saving',
  'Workspace invite link expired too early',
];

const descriptions = [
  'The customer reported that the workflow blocks an important internal process and needs a practical next step.',
  'The issue is reproducible for the customer account but has not yet been reproduced on an internal sandbox.',
  'The customer is asking for status clarity before their next internal reporting deadline.',
  'Initial triage suggests the account configuration and recent changes should be checked first.',
];

const tagPool = [
  'billing',
  'sso',
  'api',
  'enterprise',
  'security',
  'refund',
  'export',
  'bug',
  'renewal',
  'onboarding',
  'compliance',
  'mobile',
  'dashboard',
  'urgent-customer',
];

const statuses: TicketStatus[] = [
  'New',
  'Open',
  'Pending',
  'Waiting on customer',
  'Escalated',
  'Solved',
  'Closed',
];

const priorities: Priority[] = ['Low', 'Normal', 'High', 'Urgent'];
const teams: Team[] = ['Billing', 'Technical Support', 'Compliance', 'Product Support'];
const slaStates: SlaState[] = ['Healthy', 'Due soon', 'At risk', 'Breached'];

function iso(daysAgo: number, hoursOffset = 0): string {
  const date = new Date('2026-04-30T16:00:00.000Z');
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() + hoursOffset);
  return date.toISOString();
}

function ticketTags(index: number): string[] {
  return [
    tagPool[index % tagPool.length],
    tagPool[(index + 4) % tagPool.length],
    ...(index % 5 === 0 ? ['vip'] : []),
  ];
}

function ticketTeam(subject: string, index: number): Team {
  if (/invoice|payment|billing|refund|tax|renewal/i.test(subject)) return 'Billing';
  if (/security|compliance|audit|retention/i.test(subject)) return 'Compliance';
  if (/feature|dashboard|mobile|search|export/i.test(subject)) return 'Product Support';
  return teams[index % teams.length];
}

export const mockTickets: Ticket[] = Array.from({ length: 56 }, (_, offset) => {
  const index = offset + 1;
  const subject = subjects[offset % subjects.length];
  const customer = customers[offset % customers.length];
  const team = ticketTeam(subject, offset);
  const assignee = offset % 6 === 0 ? null : agents[(offset + 1) % agents.length];
  const priority = priorities[(offset + (offset % 4 === 0 ? 2 : 0)) % priorities.length];
  const status = statuses[offset % statuses.length];
  const createdAt = iso((offset % 28) + 1, offset % 7);
  const updatedAt = iso(offset % 9, (offset % 6) - 3);
  const id = `TCK-${String(1000 + index).padStart(4, '0')}`;
  const customerQuestion =
    'Hi, we are blocked on this and need help understanding what changed. Can your team take a look?';
  const agentReply =
    'Thanks for the details. We are checking the account history and will update this thread with the next step.';

  return {
    id,
    subject,
    description: descriptions[offset % descriptions.length],
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    company: customer.company,
    priority,
    status,
    assigneeId: assignee?.id ?? null,
    assigneeName: assignee?.name ?? 'Unassigned',
    team,
    tags: ticketTags(offset),
    createdAt,
    updatedAt,
    sla: {
      state: slaStates[(offset + (priority === 'Urgent' ? 2 : 0)) % slaStates.length],
      firstResponseDueAt: iso(offset % 3, 2),
      resolutionDueAt: iso(-((offset % 5) + 1), 4),
    },
    messages: [
      {
        id: `${id}-msg-1`,
        kind: 'customer',
        authorName: customer.name,
        authorRole: 'Customer',
        body: customerQuestion,
        createdAt,
      },
      {
        id: `${id}-msg-2`,
        kind: assignee ? 'agent' : 'internal',
        authorName: assignee?.name ?? 'System',
        authorRole: assignee ? 'Agent' : 'System',
        body: assignee ? agentReply : 'Ticket is waiting for assignment from the queue.',
        createdAt: iso(offset % 10, 1),
      },
      ...(offset % 4 === 0
        ? [
            {
              id: `${id}-msg-3`,
              kind: 'internal' as const,
              authorName: agents[offset % agents.length].name,
              authorRole: 'Agent' as const,
              body: 'Watch the SLA on this one. Customer impact is higher than the first message makes it look.',
              createdAt: iso(offset % 8, 4),
            },
          ]
        : []),
    ],
    activity: [
      {
        id: `${id}-act-1`,
        actorName: 'System',
        action: 'Ticket created from support inbox',
        createdAt,
      },
      {
        id: `${id}-act-2`,
        actorName: assignee?.name ?? 'Queue manager',
        action: assignee ? `Assigned to ${assignee.name}` : 'Left unassigned for triage',
        createdAt: iso(offset % 10, 2),
      },
    ],
  };
});
