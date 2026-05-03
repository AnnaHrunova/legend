export type ProjectId =
  | 'esim'
  | 'savings'
  | 'payments'
  | 'notifications-service'
  | 'dms'
  | 'auth'
  | 'accounts'
  | 'cards'
  | 'compliance'
  | 'reporting'
  | 'mobile-app';

export type Topic = {
  id: string;
  name: string;
  projectIds: ProjectId[];
  keywords: string[];
};

export type Project = {
  id: ProjectId;
  name: string;
};

export const projects: Project[] = [
  { id: 'esim', name: 'eSIM' },
  { id: 'savings', name: 'Savings' },
  { id: 'payments', name: 'Payments' },
  { id: 'notifications-service', name: 'Notifications Service' },
  { id: 'dms', name: 'Document Management' },
  { id: 'auth', name: 'Auth' },
  { id: 'accounts', name: 'Accounts' },
  { id: 'cards', name: 'Cards' },
  { id: 'compliance', name: 'Compliance' },
  { id: 'reporting', name: 'Reporting' },
  { id: 'mobile-app', name: 'Mobile App' },
];

export const topics: Topic[] = [
  {
    id: 'esim-installation',
    name: 'eSIM installation issue',
    projectIds: ['esim'],
    keywords: ['esim', 'installation', 'qr', 'iphone', 'activation'],
  },
  {
    id: 'esim-refund',
    name: 'Refund eSIM',
    projectIds: ['esim', 'payments'],
    keywords: ['refund', 'unused', 'esim', 'payment', 'credit'],
  },
  {
    id: 'savings-balance',
    name: 'Savings balance not showing',
    projectIds: ['savings', 'accounts'],
    keywords: ['savings', 'balance', 'interest', 'account', 'zero'],
  },
  {
    id: 'documents-missing',
    name: 'Documents not received',
    projectIds: ['dms', 'notifications-service'],
    keywords: ['documents', 'statement', 'email', 'delivery', 'pdf'],
  },
  {
    id: 'push-notifications',
    name: 'Push notification issues',
    projectIds: ['notifications-service'],
    keywords: ['push', 'notification', 'alert', 'device', 'delivery'],
  },
  {
    id: 'payment-failed',
    name: 'Payment failed',
    projectIds: ['payments'],
    keywords: ['payment', 'failed', 'declined', 'transfer', 'retry'],
  },
  {
    id: 'card-declined',
    name: 'Card declined',
    projectIds: ['cards', 'payments'],
    keywords: ['card', 'declined', 'merchant', 'authorization', 'terminal'],
  },
  {
    id: 'login-issues',
    name: 'Login issues',
    projectIds: ['auth'],
    keywords: ['login', 'password', 'otp', 'biometrics', 'session'],
  },
  {
    id: 'account-locked',
    name: 'Account locked',
    projectIds: ['accounts', 'auth'],
    keywords: ['locked', 'account', 'security', 'unlock', 'verification'],
  },
  {
    id: 'transaction-missing',
    name: 'Transaction missing',
    projectIds: ['payments', 'reporting'],
    keywords: ['transaction', 'missing', 'history', 'statement', 'pending'],
  },
  {
    id: 'verification-stuck',
    name: 'Verification stuck',
    projectIds: ['compliance', 'accounts'],
    keywords: ['verification', 'kyc', 'identity', 'review', 'compliance'],
  },
  {
    id: 'app-crashes',
    name: 'App crashes',
    projectIds: ['mobile-app'],
    keywords: ['crash', 'freeze', 'release', 'mobile', 'startup'],
  },
  {
    id: 'app-performance',
    name: 'Slow app performance',
    projectIds: ['mobile-app', 'accounts', 'payments', 'reporting'],
    keywords: ['slow', 'loading', 'timeout', 'performance', 'latency'],
  },
  {
    id: 'card-delivery',
    name: 'Card delivery delay',
    projectIds: ['cards', 'notifications-service'],
    keywords: ['card', 'delivery', 'shipping', 'tracking', 'address'],
  },
  {
    id: 'direct-debit',
    name: 'Direct debit setup failed',
    projectIds: ['payments', 'accounts'],
    keywords: ['direct debit', 'mandate', 'setup', 'bank', 'authorization'],
  },
  {
    id: 'report-export',
    name: 'Report export incorrect',
    projectIds: ['reporting', 'dms'],
    keywords: ['report', 'export', 'csv', 'pdf', 'incorrect'],
  },
  {
    id: 'personal-data-update',
    name: 'Personal data update blocked',
    projectIds: ['accounts', 'compliance', 'dms'],
    keywords: ['personal data', 'address', 'name', 'documents', 'blocked'],
  },
];

export function getTopic(topicId: string) {
  return topics.find((topic) => topic.id === topicId);
}

export function getProject(projectId: string) {
  return projects.find((project) => project.id === projectId);
}
