import type { Priority, TicketStatus } from '../../domain/types';

export type SupportTopicKey =
  | 'billing'
  | 'login'
  | 'bugs'
  | 'features'
  | 'performance'
  | 'integrations'
  | 'notifications'
  | 'account'
  | 'compliance'
  | 'reporting';

export type TopicTicket = {
  id: string;
  subject: string;
  description: string;
  createdAt: string;
  tags: string[];
  status: TicketStatus;
  priority: Priority;
  seedTopic: SupportTopicKey;
};

type TopicTemplate = {
  tag: SupportTopicKey;
  label: string;
  subjects: string[];
  descriptions: string[];
  tags: string[];
};

const templates: Record<SupportTopicKey, TopicTemplate> = {
  billing: {
    tag: 'billing',
    label: 'Billing & Payments',
    tags: ['billing', 'payment', 'invoice'],
    subjects: [
      'Invoice total does not match renewal quote',
      'Payment failed after card was approved',
      'Duplicate subscription charge needs review',
      'Refund request for unused seats',
      'Tax ID rejected during checkout',
    ],
    descriptions: [
      'Customer is asking why the invoice amount changed after renewal approval.',
      'The payment provider shows approval but the app still marks the payment as failed.',
      'Finance team needs a refund or credit memo before month end.',
      'Billing address and tax details were updated but the invoice still uses old data.',
    ],
  },
  login: {
    tag: 'login',
    label: 'Login & Authentication',
    tags: ['login', 'auth', 'sso'],
    subjects: [
      'SSO login redirects to blank page',
      'User locked out after password reset',
      'Magic link expires immediately',
      'Two factor code is not accepted',
      'Cannot invite users with company domain',
    ],
    descriptions: [
      'Customer cannot sign in after identity provider configuration changed.',
      'Authentication works for admins but fails for regular workspace members.',
      'Password reset email arrives but the link cannot be used successfully.',
      'SAML metadata was updated and login errors started shortly after.',
    ],
  },
  bugs: {
    tag: 'bugs',
    label: 'Bugs & Crashes',
    tags: ['bug', 'crash', 'regression'],
    subjects: [
      'Dashboard crashes when filters are applied',
      'Attachment upload fails for PDF files',
      'Export job gets stuck overnight',
      'Mobile app closes after opening notifications',
      'Search results omit archived records',
    ],
    descriptions: [
      'Customer reports a regression after the latest release and needs a workaround.',
      'The issue is reproducible with a specific account and file type.',
      'Browser console shows an error when the customer repeats the workflow.',
      'Production workflow is blocked until the defect is triaged by product support.',
    ],
  },
  features: {
    tag: 'features',
    label: 'Feature Requests',
    tags: ['feature-request', 'workflow', 'roadmap'],
    subjects: [
      'Request for saved dashboard filters',
      'Need bulk export for audit records',
      'Add approval workflow for billing changes',
      'Request to customize notification templates',
      'Need team-level reporting permissions',
    ],
    descriptions: [
      'Customer wants a workflow improvement for repeated operational tasks.',
      'The requested feature would reduce manual work for a large enterprise account.',
      'The current workaround is possible but slow and error-prone.',
      'Product feedback should be reviewed during roadmap planning.',
    ],
  },
  performance: {
    tag: 'performance',
    label: 'Performance',
    tags: ['performance', 'latency', 'slow'],
    subjects: [
      'Reports page loads slowly for large workspace',
      'API response time increased this week',
      'Dashboard filter takes too long to apply',
      'Export preview times out for enterprise account',
      'Search latency is high during business hours',
    ],
    descriptions: [
      'Customer reports slow response times after data volume increased.',
      'The page eventually loads but the delay is blocking daily operations.',
      'Performance appears worse during peak usage hours.',
      'Large workspaces need optimization or pagination for this workflow.',
    ],
  },
  integrations: {
    tag: 'integrations',
    label: 'Integrations',
    tags: ['integration', 'webhook', 'api'],
    subjects: [
      'Webhook retries are not firing',
      'CRM integration stopped syncing contacts',
      'API returns 429 during low traffic',
      'Slack notification integration needs reconnect',
      'OAuth token refresh fails for partner app',
    ],
    descriptions: [
      'Customer integration stopped sending updates to downstream systems.',
      'Webhook delivery logs show intermittent failures and missing retries.',
      'Third-party connection needs investigation before customer can continue rollout.',
      'API behavior differs from documented integration expectations.',
    ],
  },
  notifications: {
    tag: 'notifications',
    label: 'Notifications',
    tags: ['notifications', 'email', 'alerts'],
    subjects: [
      'Email notifications are delayed',
      'Users receive duplicate digest emails',
      'Notification preferences are not saving',
      'Alert rules do not trigger for urgent tickets',
      'Mobile push notification is missing ticket link',
    ],
    descriptions: [
      'Customer is missing important notifications for time-sensitive workflow changes.',
      'Notification settings appear saved but revert after the page reloads.',
      'Email delivery is inconsistent across users in the same workspace.',
      'Alert behavior needs review because important events are being missed.',
    ],
  },
  account: {
    tag: 'account',
    label: 'Account Settings',
    tags: ['account', 'settings', 'users'],
    subjects: [
      'Need to update workspace owner',
      'Cannot change company profile settings',
      'User role permissions look incorrect',
      'Workspace invite link expired too early',
      'Account settings page does not save changes',
    ],
    descriptions: [
      'Customer needs help changing account settings before onboarding a new team.',
      'Admin permissions do not match the expected workspace role.',
      'The account configuration appears inconsistent after recent user changes.',
      'Workspace setup is blocked by profile or permission settings.',
    ],
  },
  compliance: {
    tag: 'compliance',
    label: 'Compliance',
    tags: ['compliance', 'security', 'audit'],
    subjects: [
      'Security questionnaire needs completion',
      'Data retention policy clarification',
      'Audit log export is missing IP address',
      'Compliance review for new processor',
      'Need DPA update for legal review',
    ],
    descriptions: [
      'Customer security team needs documentation before procurement can proceed.',
      'Legal requested clarification about retention, audit logs, and subprocessors.',
      'Compliance data must be reviewed before the customer can finish onboarding.',
      'The account team needs a reliable answer for an enterprise review.',
    ],
  },
  reporting: {
    tag: 'reporting',
    label: 'Reporting',
    tags: ['reporting', 'dashboard', 'analytics'],
    subjects: [
      'Usage report has missing rows',
      'Dashboard totals do not match CSV export',
      'Need scheduled report for leadership',
      'Saved report filters are not applied',
      'Analytics chart shows incorrect date range',
    ],
    descriptions: [
      'Customer relies on the report for weekly internal operations review.',
      'The dashboard and exported CSV disagree, so the customer cannot trust the numbers.',
      'Reporting workflow needs better date range and saved filter behavior.',
      'Leadership report is blocked by inconsistent analytics output.',
    ],
  },
};

const topicKeys = Object.keys(templates) as SupportTopicKey[];
const statuses: TicketStatus[] = ['New', 'Open', 'Pending', 'Waiting on customer', 'Escalated', 'Solved'];
const priorities: Priority[] = ['Low', 'Normal', 'High', 'Urgent'];

export function generateMockTopicTickets(): TopicTicket[] {
  const random = seededRandom(84);
  const start = startOfMonth(monthsAgo(5));
  const end = new Date();
  const tickets: TopicTicket[] = [];
  let ticketNumber = 9000;

  for (let day = 0; day <= daysBetween(start, end); day += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    const monthIndex = monthOffset(start, date);
    const dailyVolume = 14 + Math.floor(random() * 10) + monthIndex * 2;

    for (let index = 0; index < dailyVolume; index += 1) {
      const topic = pickTopic(monthIndex, day, random);
      const template = templates[topic];
      const createdAt = new Date(date);
      createdAt.setHours(Math.floor(random() * 24), Math.floor(random() * 60), 0, 0);

      tickets.push({
        id: `TOP-${ticketNumber}`,
        subject: pick(template.subjects, random),
        description: pick(template.descriptions, random),
        createdAt: createdAt.toISOString(),
        tags: [template.tag, ...template.tags.slice(0, 2)],
        status: weightedPick(statuses, [0.12, 0.26, 0.16, 0.12, 0.08, 0.26], random),
        priority: weightedPick(priorities, priorityWeights(topic), random),
        seedTopic: topic,
      });
      ticketNumber += 1;
    }
  }

  return tickets;
}

function pickTopic(monthIndex: number, day: number, random: () => number): SupportTopicKey {
  const releaseSpike = Math.exp(-Math.pow(monthIndex - 3, 2) / 0.55);
  const weights: Record<SupportTopicKey, number> = {
    billing: 1.0 + Math.max(0, monthIndex - 3) * 1.65,
    login: Math.max(0.55, 3.4 - monthIndex * 0.62),
    bugs: 0.85 + releaseSpike * 4.2,
    features: 1.0 + monthIndex * 0.22,
    performance: 0.9 + Math.max(0, monthIndex - 2) * 0.28,
    integrations: 1.35,
    notifications: 0.8 + (monthIndex >= 4 ? 0.7 : 0),
    account: 1.0 + Math.sin(day / 14) * 0.08,
    compliance: 0.48,
    reporting: 0.75 + monthIndex * 0.18,
  };

  const total = topicKeys.reduce((sum, key) => sum + weights[key], 0);
  let cursor = random() * total;

  for (const key of topicKeys) {
    cursor -= weights[key];
    if (cursor <= 0) return key;
  }

  return 'account';
}

function priorityWeights(topic: SupportTopicKey): number[] {
  if (topic === 'bugs') return [0.08, 0.34, 0.42, 0.16];
  if (topic === 'billing' || topic === 'login') return [0.1, 0.46, 0.32, 0.12];
  if (topic === 'compliance') return [0.18, 0.5, 0.26, 0.06];
  return [0.2, 0.55, 0.2, 0.05];
}

function weightedPick<T>(items: T[], weights: number[], random: () => number): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;
  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return items[index];
  }
  return items[items.length - 1];
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function monthsAgo(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function monthOffset(start: Date, date: Date) {
  return (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}
