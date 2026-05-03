import { agents } from './mockUsers';
import { customers } from './mockCustomers';
import { topics } from '../analytics/topics/domain';
import type {
  Priority,
  ReviewPlatform,
  ReviewRating,
  ReviewSource,
  SlaState,
  Team,
  Ticket,
  TicketStatus,
} from '../domain/types';

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

const reviewSubjects = [
  "App crashes when I try to pay",
  'Refund not received for eSIM',
  'Notifications not working',
  'Login keeps failing',
  'Savings balance shows zero',
  'Card keeps getting declined',
  'Cannot install eSIM on iPhone',
  'Transaction disappeared from history',
  'Verification has been stuck for days',
  'Great app but reports load slowly',
  'Payment alerts are delayed',
  'Physical card tracking is missing',
];

const reviewDescriptions = [
  'The app crashes right after I confirm a payment. I tried twice and still cannot complete it.',
  'I bought an eSIM that never worked and the refund still has not arrived.',
  'Push notifications stopped working after the latest update.',
  'Every login asks for a code and then sends me back to the start.',
  'My savings balance suddenly shows zero even though the money is still in transaction history.',
  'Card was declined at the store despite enough balance.',
  'The eSIM setup screen hangs after scanning the QR code.',
  'A transaction that was pending yesterday is now missing from the app.',
  'Verification has been under review for days with no update.',
  'Useful app overall, but reports and transaction history are too slow.',
  'Payment alerts arrive much later than the actual charge.',
  'I ordered a replacement card and cannot find delivery tracking.',
];

const reviewUsers = [
  'maria_82',
  'payrunner',
  'ios_user_17',
  'android_nomad',
  'traveller_kyiv',
  'budgetpilot',
  'cardholder77',
  'esimfan',
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

function topicForSubject(subject: string) {
  if (/esim.*refund|refund.*esim/i.test(subject)) return topics.find((topic) => topic.id === 'esim-refund')!;
  if (/esim|qr|activation/i.test(subject)) return topics.find((topic) => topic.id === 'esim-installation')!;
  if (/saving|balance|interest/i.test(subject)) return topics.find((topic) => topic.id === 'savings-balance')!;
  if (/notification|alert/i.test(subject)) return topics.find((topic) => topic.id === 'push-notifications')!;
  if (/payment|transfer|pay/i.test(subject)) return topics.find((topic) => topic.id === 'payment-failed')!;
  if (/card.*declin|declined/i.test(subject)) return topics.find((topic) => topic.id === 'card-declined')!;
  if (/login|password|sso|auth/i.test(subject)) return topics.find((topic) => topic.id === 'login-issues')!;
  if (/locked/i.test(subject)) return topics.find((topic) => topic.id === 'account-locked')!;
  if (/transaction|history/i.test(subject)) return topics.find((topic) => topic.id === 'transaction-missing')!;
  if (/verification|compliance|kyc/i.test(subject)) return topics.find((topic) => topic.id === 'verification-stuck')!;
  if (/slow|crash|stuck|mobile/i.test(subject)) return topics.find((topic) => topic.id === 'app-performance')!;
  if (/report|export/i.test(subject)) return topics.find((topic) => topic.id === 'report-export')!;
  if (/document|pdf|attachment/i.test(subject)) return topics.find((topic) => topic.id === 'documents-missing')!;
  return topics[indexSafe(subject) % topics.length] ?? topics[0]!;
}

function indexSafe(value: string) {
  return value.split('').reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
}

const supportTickets: Ticket[] = Array.from({ length: 56 }, (_, offset) => {
  const index = offset + 1;
  const subject = subjects[offset % subjects.length];
  const customer = customers[offset % customers.length];
  const team = ticketTeam(subject, offset);
  const topic = topicForSubject(subject);
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
    topicId: topic.id,
    projectIds: topic.projectIds,
    source: 'support',
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

const appVersions = ['2.3.1', '2.3.2', '2.4.0', '2.4.1', '2.5.0'];

const reviewTickets: Ticket[] = Array.from({ length: 28 }, (_, offset) => {
  const index = offset + 1;
  const subject = reviewSubjects[offset % reviewSubjects.length];
  const topic = topicForSubject(subject);
  const reviewSource: ReviewSource = offset % 2 === 0 ? 'app_store' : 'google_play';
  const platform: ReviewPlatform = reviewSource === 'app_store' ? 'ios' : 'android';
  const rating = ratingForTopic(topic.id, offset);
  const createdAt = iso((offset % 32) + 1, offset % 9);
  const updatedAt = iso(offset % 12, (offset % 5) - 2);
  const id = `REV-${String(2000 + index).padStart(4, '0')}`;
  const team = topic.projectIds.includes('payments')
    ? 'Billing'
    : topic.projectIds.includes('compliance')
      ? 'Compliance'
      : 'Product Support';
  const assignee = offset % 4 === 0 ? null : agents[(offset + 2) % agents.length];
  const customer = customers[offset % customers.length];
  const userName = reviewUsers[offset % reviewUsers.length];

  return {
    id,
    subject,
    description: reviewDescriptions[offset % reviewDescriptions.length],
    customerId: customer.id,
    customerName: userName,
    customerEmail: `${userName}@app-store.example`,
    company: platform === 'ios' ? 'Apple App Store' : 'Google Play',
    priority: rating <= 2 ? 'High' : rating === 3 ? 'Normal' : 'Low',
    status: offset % 5 === 0 ? 'New' : statuses[(offset + 1) % statuses.length],
    assigneeId: assignee?.id ?? null,
    assigneeName: assignee?.name ?? 'Unassigned',
    team,
    tags: ['review', reviewSource, platform, topic.id, ...(rating <= 2 ? ['low-rating'] : [])],
    createdAt,
    updatedAt,
    topicId: topic.id,
    projectIds: topic.projectIds,
    source: 'review',
    reviewSource,
    platform,
    rating,
    appVersion: appVersions[offset % appVersions.length],
    userName,
    sla: {
      state: rating <= 2 ? 'At risk' : rating === 3 ? 'Due soon' : 'Healthy',
      firstResponseDueAt: iso(offset % 3, 2),
      resolutionDueAt: iso(-((offset % 5) + 1), 4),
    },
    messages: [
      {
        id: `${id}-msg-1`,
        kind: 'customer',
        authorName: userName,
        authorRole: 'Customer',
        body: reviewDescriptions[offset % reviewDescriptions.length],
        createdAt,
      },
    ],
    activity: [
      {
        id: `${id}-act-1`,
        actorName: 'System',
        action: `Review imported from ${reviewSource === 'app_store' ? 'App Store' : 'Google Play'}`,
        createdAt,
      },
    ],
  };
});

function ratingForTopic(topicId: string, offset: number): ReviewRating {
  if (['payment-failed', 'card-declined', 'app-performance', 'login-issues'].includes(topicId)) {
    return ([1, 2, 2, 3] as ReviewRating[])[offset % 4];
  }
  if (['esim-refund', 'esim-installation', 'transaction-missing'].includes(topicId)) {
    return ([1, 2, 3, 2] as ReviewRating[])[offset % 4];
  }
  if (['push-notifications', 'savings-balance', 'report-export'].includes(topicId)) {
    return ([2, 3, 4, 3] as ReviewRating[])[offset % 4];
  }
  return ([3, 4, 5, 4] as ReviewRating[])[offset % 4];
}

export const mockTickets: Ticket[] = [...supportTickets, ...reviewTickets].sort(
  (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
);
