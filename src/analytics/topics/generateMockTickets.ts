export type SupportTopicKey =
  | 'billing'
  | 'login'
  | 'bugs'
  | 'features'
  | 'performance'
  | 'integrations'
  | 'notifications'
  | 'account';

export type TopicTicket = {
  id: string;
  subject: string;
  description: string;
  createdAt: string;
  tags: string[];
  seedTopic: SupportTopicKey;
};

type TopicTemplate = {
  tag: SupportTopicKey;
  subjects: string[];
  descriptions: string[];
  tags: string[];
};

const templates: Record<SupportTopicKey, TopicTemplate> = {
  billing: {
    tag: 'billing',
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
};

const topicKeys = Object.keys(templates) as SupportTopicKey[];

export function generateMockTopicTickets(): TopicTicket[] {
  const random = seededRandom(42);
  const start = startOfDay(daysAgo(83));
  const tickets: TopicTicket[] = [];
  let ticketNumber = 7000;

  for (let day = 0; day < 84; day += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    const dailyVolume = 16 + Math.floor(random() * 11) + (day > 45 ? 3 : 0);

    for (let index = 0; index < dailyVolume; index += 1) {
      const topic = pickTopic(day, random);
      const template = templates[topic];
      const subject = pick(template.subjects, random);
      const description = pick(template.descriptions, random);
      const createdAt = new Date(date);
      createdAt.setHours(Math.floor(random() * 24), Math.floor(random() * 60), 0, 0);

      tickets.push({
        id: `TOP-${ticketNumber}`,
        subject,
        description,
        createdAt: createdAt.toISOString(),
        tags: [template.tag, ...template.tags.slice(0, 2)],
        seedTopic: topic,
      });
      ticketNumber += 1;
    }
  }

  return tickets;
}

function pickTopic(day: number, random: () => number): SupportTopicKey {
  const weights: Record<SupportTopicKey, number> = {
    billing: 0.9 + Math.max(0, day - 30) * 0.055,
    login: Math.max(0.5, 3.2 - day * 0.032),
    bugs: 0.8 + Math.max(0, day - 45) * 0.085,
    features: 1.1 + Math.sin(day / 9) * 0.25,
    performance: 0.9 + Math.max(0, day - 35) * 0.025,
    integrations: 1.2 + (day > 55 ? 0.65 : 0),
    notifications: 0.75 + (day > 62 ? 1.1 : 0),
    account: 1.0,
  };

  const total = topicKeys.reduce((sum, key) => sum + weights[key], 0);
  let cursor = random() * total;

  for (const key of topicKeys) {
    cursor -= weights[key];
    if (cursor <= 0) return key;
  }

  return 'account';
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

