export type PlatformHealthPlatform = 'android' | 'ios';
export type PlatformHealthSelection = PlatformHealthPlatform | 'both';
export type PlatformHealthSource = 'support' | 'google_play' | 'app_store';
export type PlatformHealthPriority = 'low' | 'normal' | 'high' | 'urgent';
export type PlatformHealthSeverity = 'critical' | 'medium' | 'low';

export type PlatformProjectId =
  | 'payments'
  | 'cards'
  | 'esim'
  | 'savings'
  | 'dms'
  | 'notifications-service'
  | 'auth'
  | 'accounts'
  | 'compliance'
  | 'mobile-app'
  | 'reporting';

export type PlatformHealthTopic = {
  id: string;
  name: string;
  projectIds: PlatformProjectId[];
  keywords: string[];
};

export type PlatformRelease = {
  platform: PlatformHealthPlatform;
  version: string;
  date: string;
};

export const platformProjects: Record<PlatformProjectId, string> = {
  payments: 'Payments',
  cards: 'Cards',
  esim: 'eSIM',
  savings: 'Savings',
  dms: 'Document Management',
  'notifications-service': 'Notifications Service',
  auth: 'Auth',
  accounts: 'Accounts',
  compliance: 'Compliance',
  'mobile-app': 'Mobile App',
  reporting: 'Reporting',
};

export const platformHealthTopics: PlatformHealthTopic[] = [
  { id: 'payment-failed', name: 'Payment failed', projectIds: ['payments', 'mobile-app'], keywords: ['payment', 'failed', 'reserved'] },
  { id: 'card-declined', name: 'Card declined', projectIds: ['cards', 'payments'], keywords: ['card', 'declined', 'authorization'] },
  { id: 'esim-installation', name: 'eSIM installation issue', projectIds: ['esim', 'mobile-app'], keywords: ['esim', 'activation', 'qr'] },
  { id: 'esim-refund', name: 'Refund eSIM', projectIds: ['esim', 'payments'], keywords: ['refund', 'esim', 'unused'] },
  { id: 'savings-balance', name: 'Savings balance not showing', projectIds: ['savings', 'accounts'], keywords: ['savings', 'balance', 'zero'] },
  { id: 'documents-missing', name: 'Documents not received', projectIds: ['dms', 'notifications-service'], keywords: ['documents', 'statement', 'email'] },
  { id: 'push-notifications', name: 'Push notification issues', projectIds: ['notifications-service', 'mobile-app'], keywords: ['push', 'alerts', 'device'] },
  { id: 'login-issues', name: 'Login issues', projectIds: ['auth', 'mobile-app'], keywords: ['login', 'otp', 'session'] },
  { id: 'account-locked', name: 'Account locked', projectIds: ['accounts', 'auth'], keywords: ['account', 'locked', 'security'] },
  { id: 'verification-stuck', name: 'Verification stuck', projectIds: ['compliance', 'accounts'], keywords: ['verification', 'kyc', 'review'] },
  { id: 'app-crashes', name: 'App crashes', projectIds: ['mobile-app'], keywords: ['crash', 'freeze', 'restart'] },
  { id: 'slow-performance', name: 'Slow performance', projectIds: ['mobile-app', 'reporting'], keywords: ['slow', 'latency', 'timeout'] },
  { id: 'feature-budgeting', name: 'Feature request: budgeting', projectIds: ['accounts', 'mobile-app'], keywords: ['budget', 'planning', 'categories'] },
  { id: 'feature-virtual-cards', name: 'Feature request: virtual cards', projectIds: ['cards', 'mobile-app'], keywords: ['virtual card', 'controls', 'wallet'] },
];

export function topicById(topicId: string) {
  return platformHealthTopics.find((topic) => topic.id === topicId);
}
